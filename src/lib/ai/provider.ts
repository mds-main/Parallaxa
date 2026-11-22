/**
 * callModel: the single entry point for every model call (TODO 10.6–10.12).
 * Retries per error class, circuit breaker, AI Gateway fallback, demo mode, llm_calls logging.
 */
import { AiError, chat, isDemoMode, providerKey, type ChatRequest, type ChatResponse } from './client';
import { breakerAllows, recordFailure, recordSuccess, type BreakerSettings } from './breaker';
import { demoRespond } from './demo';
import { getDb } from '../db/client';
import { llmCalls } from '../db/schema';
import { getModel } from './catalog';
import type { AppConfig } from '../config/schema';
import { modelVendor } from '../config/models';
import { withSpan } from '../telemetry';

export type CallOptions = {
  step: string;
  model: string;
  request: Omit<ChatRequest, 'model'>;
  config: AppConfig;
  slot?: string;
  analysisId?: string;
  fallbackModel?: string;
  /** Perspective slots record refusals as abstentions instead of switching model. */
  refusalIsAbstention?: boolean;
  searches?: { web: number; x: number; scrape: number };
};

export type CallResult = Omit<ChatResponse, 'provider' | 'costUsd'> & { provider: 'venice' | 'gateway' | 'demo'; usedFallback: boolean; costUsd: number };

/** Gateway equivalents by vendor (same family and origin). Editable per slot in the admin console. */
export const GATEWAY_FALLBACKS: Record<string, string> = {
  xai: 'xai/grok-4',
  openai: 'openai/gpt-5',
  anthropic: 'anthropic/claude-sonnet-4.5',
  google: 'google/gemini-2.5-pro',
  deepseek: 'deepseek/deepseek-v3.2',
  moonshot: 'moonshotai/kimi-k2',
  alibaba: 'alibaba/qwen3-max',
  zhipu: 'zai/glm-4.6',
  mistral: 'mistral/mistral-medium',
  meta: 'meta/llama-4-maverick',
};

export function gatewayFallbackFor(model: string): string | undefined {
  return GATEWAY_FALLBACKS[modelVendor(model).vendor];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function breakerSettings(config: AppConfig): BreakerSettings {
  return {
    failures: config.limits.breakerFailures,
    windowSec: config.limits.breakerWindowSec,
    probeSec: config.limits.breakerProbeSec,
    latencyMultiplier: config.limits.breakerLatencyMultiplier,
  };
}

async function estimateCost(model: string, res: ChatResponse, searches?: CallOptions['searches']): Promise<number> {
  if (res.costUsd !== null) return res.costUsd;
  const m = await getModel(model);
  const tokens = m ? (res.usage.promptTokens / 1e6) * m.pricing.inputUsdPerM + (res.usage.completionTokens / 1e6) * m.pricing.outputUsdPerM : 0;
  const s = searches ? (searches.web + searches.x + searches.scrape) * 0.01 : 0;
  return tokens + s;
}

async function log(opts: CallOptions, provider: string, model: string, res: Partial<ChatResponse> & { costUsd?: number }, errorClass?: string) {
  try {
    const db = await getDb();
    await db.insert(llmCalls).values({
      analysisId: opts.analysisId ?? null,
      provider,
      model,
      slot: opts.slot ?? null,
      step: opts.step,
      tokensIn: res.usage?.promptTokens ?? 0,
      tokensOut: res.usage?.completionTokens ?? 0,
      searches: opts.searches ?? null,
      costUsd: res.costUsd ?? 0,
      latencyMs: res.latencyMs ?? 0,
      finishReason: res.finishReason ?? null,
      errorClass: errorClass ?? null,
    });
  } catch (e) {
    console.error('llm_calls log failed', e);
  }
}

export async function callModel(opts: CallOptions): Promise<CallResult> {
  return withSpan(
    `model.${opts.step.split(':')[0]}`,
    { 'plx.step': opts.step, 'plx.model': opts.model, 'plx.slot': opts.slot ?? '' },
    () => callModelInner(opts),
    (r) => ({ 'plx.provider': r.provider, 'plx.tokens_in': r.usage.promptTokens, 'plx.tokens_out': r.usage.completionTokens, 'plx.cost_usd': r.costUsd, 'plx.latency_ms': r.latencyMs, 'plx.finish_reason': r.finishReason, 'plx.fallback': r.usedFallback }),
  );
}

async function callModelInner(opts: CallOptions): Promise<CallResult> {
  if (isDemoMode()) {
    const res = demoRespond(opts.step, { ...opts.request, model: opts.model });
    await log(opts, 'demo', opts.model, { ...res, costUsd: 0 });
    return { ...res, model: opts.model, provider: 'demo', usedFallback: false, costUsd: 0 };
  }

  const bs = breakerSettings(opts.config);
  const fallbackModel = opts.fallbackModel || gatewayFallbackFor(opts.model);
  const canFallback = opts.config.limits.fallbackEnabled && Boolean(providerKey('gateway')) && Boolean(fallbackModel);
  const timeoutMs = opts.request.timeoutMs ?? opts.config.limits.timeoutStepSec * 1000;

  const attemptVenice = async (): Promise<CallResult> => {
    const res = await chat('venice', { ...opts.request, model: opts.model, timeoutMs });
    recordSuccess(opts.model, res.latencyMs);
    const costUsd = await estimateCost(opts.model, res, opts.searches);
    await log(opts, 'venice', opts.model, { ...res, costUsd });
    return { ...res, provider: 'venice', usedFallback: false, costUsd };
  };

  const attemptGateway = async (): Promise<CallResult> => {
    // Venice-only parameters (web/X search) do not exist on the Gateway path; the caller discloses this.
    const { veniceParameters: _drop, ...rest } = opts.request;
    void _drop;
    const res = await chat('gateway', { ...rest, model: fallbackModel!, timeoutMs });
    const costUsd = res.costUsd ?? 0;
    await log(opts, 'gateway', fallbackModel!, { ...res, costUsd });
    return { ...res, provider: 'gateway', usedFallback: true, costUsd };
  };

  if (!breakerAllows(opts.model, bs)) {
    if (canFallback) return attemptGateway();
    throw new AiError(`Circuit open for ${opts.model}`, 'server');
  }

  let lastError: AiError | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await attemptVenice();
    } catch (e) {
      const err = e instanceof AiError ? e : new AiError(String(e), 'unknown');
      lastError = err;
      await log(opts, 'venice', opts.model, {}, err.errorClass);
      if (err.errorClass === 'schema' || err.errorClass === 'not_found' || err.errorClass === 'forbidden') throw err;
      if (err.errorClass === 'refusal') {
        if (opts.refusalIsAbstention) throw err;
        break;
      }
      recordFailure(opts.model, bs);
      if (err.errorClass === 'auth' || err.errorClass === 'payment') break;
      if (attempt === 0) {
        const wait = err.errorClass === 'rate_limit' ? Math.min(err.retryAfterMs ?? 1000, 2000) : 250;
        await sleep(wait + Math.random() * 250);
      }
    }
  }
  if (canFallback) return attemptGateway();
  throw lastError ?? new AiError('Model call failed', 'unknown');
}
