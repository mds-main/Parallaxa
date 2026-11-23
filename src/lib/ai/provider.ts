/**
 * callModel: the single entry point for every model call (TODO 10.6–10.12).
 * Vendor routing from the admin console (Venice / AI Gateway, either first, backup on or off),
 * retries per error class, circuit breaker, demo mode, llm_calls logging.
 */
import { AiError, chat, isDemoMode, providerKey, type ChatRequest, type ChatResponse } from './client';
import { breakerAllows, recordFailure, recordSuccess, type BreakerSettings } from './breaker';
import { demoRespond } from './demo';
import { getDb } from '../db/client';
import { llmCalls } from '../db/schema';
import { getModel } from './catalog';
import type { AppConfig } from '../config/schema';
import { planRoute, type RouteStep } from './routing';
import { getGatewayModelIds } from './gateway-catalog';
import { withSpan } from '../telemetry';

export type CallOptions = {
  step: string;
  model: string;
  request: Omit<ChatRequest, 'model'>;
  config: AppConfig;
  slot?: string;
  analysisId?: string;
  /** AI Gateway model for this call (the slot's choice); defaults to the vendor equivalent. */
  fallbackModel?: string;
  /** The request contains the user's own words (typed text, screenshot, dialogue): it stays on Venice's private models. */
  rawUserText?: boolean;
  /** Perspective slots record refusals as abstentions instead of switching model. */
  refusalIsAbstention?: boolean;
  searches?: { web: number; x: number; scrape: number };
};

export type CallResult = Omit<ChatResponse, 'provider' | 'costUsd'> & { provider: 'venice' | 'gateway' | 'demo'; usedFallback: boolean; costUsd: number };

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

async function log(opts: CallOptions, provider: string, model: string, res: Partial<ChatResponse> & { costUsd?: number }, errorClass?: string, fallback = false) {
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
      fallback,
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
  const timeoutMs = opts.request.timeoutMs ?? opts.config.limits.timeoutStepSec * 1000;
  const plan = planRoute({
    routing: opts.config.routing,
    model: opts.model,
    gatewayModel: opts.fallbackModel,
    rawUserText: opts.rawUserText,
    keys: { venice: Boolean(providerKey('venice')), gateway: Boolean(providerKey('gateway')) },
    gatewayIds: providerKey('gateway') && !opts.rawUserText ? await getGatewayModelIds() : null,
  });
  if (!plan.length) throw new AiError(`No AI vendor can serve ${opts.model}`, 'auth');

  const attempt = async (step: RouteStep): Promise<CallResult> => {
    // Venice-only parameters (web/X search, citations) do not exist on the Gateway; the analysis discloses it.
    const { veniceParameters, ...rest } = opts.request;
    const request = step.provider === 'venice' ? { ...rest, veniceParameters } : rest;
    const res = await chat(step.provider, { ...request, model: step.model, timeoutMs });
    recordSuccess(step.model, res.latencyMs);
    const costUsd = step.provider === 'venice' ? await estimateCost(step.model, res, opts.searches) : (res.costUsd ?? 0);
    await log(opts, step.provider, step.model, { ...res, costUsd }, undefined, step.isFallback);
    return { ...res, provider: step.provider, usedFallback: step.isFallback, costUsd };
  };

  let lastError: AiError | null = null;
  for (const step of plan) {
    if (!breakerAllows(step.model, bs)) {
      lastError = new AiError(`Circuit open for ${step.model}`, 'server');
      continue;
    }
    for (let tries = 0; tries < 2; tries++) {
      try {
        return await attempt(step);
      } catch (e) {
        const err = e instanceof AiError ? e : new AiError(String(e), 'unknown');
        lastError = err;
        await log(opts, step.provider, step.model, {}, err.errorClass, step.isFallback);
        // A malformed request would fail on any vendor; an unknown or blocked model is vendor-specific.
        if (err.errorClass === 'schema') throw err;
        if (err.errorClass === 'not_found' || err.errorClass === 'forbidden') break;
        if (err.errorClass === 'refusal') {
          if (opts.refusalIsAbstention) throw err;
          break;
        }
        recordFailure(step.model, bs);
        if (err.errorClass === 'auth' || err.errorClass === 'payment') break;
        if (tries === 0) {
          const wait = err.errorClass === 'rate_limit' ? Math.min(err.retryAfterMs ?? 1000, 2000) : 250;
          await sleep(wait + Math.random() * 250);
        }
      }
    }
  }
  throw lastError ?? new AiError('Model call failed', 'unknown');
}
