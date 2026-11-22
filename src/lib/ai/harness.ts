/**
 * Investigation harness (PRD 9.4, TODO 10.18–10.21): one agentic loop per perspective slot.
 * Same prompt, same tools and same budgets for every slot. A slot never sees other slots' verdicts.
 */
import type { ChatMessage, ToolCall } from './client';
import { AiError } from './client';
import { callModel } from './provider';
import { getModel } from './catalog';
import { loadPrompt } from './prompts';
import { TOOL_DEFINITIONS, executeTool, sourceReachable, verifySourceQuote, type ToolContext } from './tools';
import { parseJson } from './json';
import { dedupeSources, inferTier } from './sources';
import { isConflictOfInterest } from './aggregate';
import type { AppConfig, SlotConfig } from '../config/schema';
import { CONFIDENCES, GRADES, type AtomicClaim, type Confidence, type Grade, type SlotVerdict, type VerdictSource } from '../domain/types';

export type InvestigateInput = {
  slot: SlotConfig;
  claim: AtomicClaim;
  pool: VerdictSource[];
  config: AppConfig;
  analysisId?: string;
  /** Run a candidate model instead of the slot's model (shadow mode / harness check). */
  modelOverride?: string;
  /** Skip source reachability checks (tests). */
  skipVerification?: boolean;
};

type RawVerdict = {
  grade: Grade;
  confidence: Confidence;
  confidenceReason?: string;
  reasoning?: string[];
  techniques?: string[];
  abstain?: boolean;
  abstainReason?: string;
  sources?: { url: string; title: string; tier: number; stance: VerdictSource['stance']; quote?: string; publishedAt?: string }[];
};

function budgetText(slot: SlotConfig, xAvailable: boolean) {
  const h = slot.harness;
  return `${h.maxToolCalls} tool calls, ${h.maxWebSearches} web searches, ${xAvailable ? `${h.maxXSearches} X searches, ` : ''}${h.maxScrapes} pages, ${h.timeLimitSec} seconds`;
}

export async function investigate(input: InvestigateInput): Promise<SlotVerdict & { techniques: string[]; confidenceReason: string }> {
  const { slot, claim, pool, config } = input;
  const model = input.modelOverride ?? slot.model;
  const started = Date.now();
  const catalogModel = await getModel(model);
  const xAvailable = Boolean(catalogModel?.capabilities.xSearch) && slot.harness.xSearch;
  const h = slot.harness;
  const reasoningEffort = h.reasoningEffort && catalogModel?.capabilities.reasoningEffortOptions.includes(h.reasoningEffort) ? h.reasoningEffort : undefined;

  const ctx: ToolContext = {
    pageCache: new Map(),
    counters: { web: 0, x: 0, scrape: 0, toolCalls: 0 },
    budget: { maxWebSearches: h.maxWebSearches, maxScrapes: h.maxScrapes },
  };
  const system = loadPrompt('investigate', 'en', {
    budget: budgetText(slot, xAvailable),
    minSources: config.pipeline.minSources,
    staleMonths: config.pipeline.staleDataMonths,
  });
  const poolForModel = pool.map((s, i) => ({ n: i + 1, title: s.title, url: s.url, tier: s.tier, snippet: s.quote ?? '' }));
  const messages: ChatMessage[] = [
    { role: 'system', content: system.text },
    {
      role: 'user',
      content: `<claim>${claim.canonical}</claim>\n<claim_type>${claim.type}</claim_type>\n<evidence_pool>${JSON.stringify(poolForModel)}</evidence_pool>\nInvestigate independently, then call submit_verdict.`,
    },
  ];

  const base: Omit<SlotVerdict, 'grade' | 'confidence' | 'abstained' | 'reasoning' | 'sources'> = {
    slot: slot.id,
    model,
    provider: 'venice',
    coiExcluded: isConflictOfInterest(claim.canonical, slot.coiTopics),
    toolCalls: 0,
    searches: { web: 0, x: 0, scrape: 0 },
    costUsd: 0,
    latencyMs: 0,
  };
  const found: VerdictSource[] = [];
  let verdict: RawVerdict | null = null;
  let budgetReached = false;
  let usedProvider: SlotVerdict['provider'] = 'venice';
  let cost = 0;
  const maxTurns = h.maxToolCalls + 2;

  for (let turn = 0; turn < maxTurns && !verdict; turn++) {
    const elapsed = (Date.now() - started) / 1000;
    const finalTurn = turn === maxTurns - 1 || ctx.counters.toolCalls >= h.maxToolCalls || elapsed > h.timeLimitSec * 0.8 || cost >= h.costCapUsd;
    if (finalTurn && turn > 0) budgetReached = true;
    const webOn = h.webSearch !== 'off' && ctx.counters.web < h.maxWebSearches && !finalTurn;
    const xOn = xAvailable && ctx.counters.x < h.maxXSearches && !finalTurn;
    let res;
    try {
      res = await callModel({
        step: `investigate:${slot.id}`,
        model,
        slot: slot.id,
        analysisId: input.analysisId,
        config,
        fallbackModel: slot.fallbackModel,
        refusalIsAbstention: true,
        searches: { web: webOn ? 1 : 0, x: xOn ? 1 : 0, scrape: 0 },
        request: {
          messages,
          tools: finalTurn ? TOOL_DEFINITIONS.filter((t) => t.function.name === 'submit_verdict') : TOOL_DEFINITIONS,
          toolChoice: finalTurn ? 'required' : 'auto',
          temperature: h.temperature,
          reasoningEffort,
          timeoutMs: Math.max(10_000, (h.timeLimitSec - elapsed) * 1000),
          veniceParameters: {
            enable_web_search: webOn ? h.webSearch : 'off',
            enable_web_citations: h.citations,
            enable_web_scraping: turn === 0 && h.scraping && /https?:\/\//.test(claim.canonical),
            enable_x_search: xOn,
          },
        },
      });
    } catch (e) {
      if (e instanceof AiError && e.errorClass === 'refusal') {
        return { ...base, grade: null, confidence: null, abstained: true, reasoning: 'The model declined to investigate this claim.', sources: [], techniques: [], confidenceReason: '', latencyMs: Date.now() - started, costUsd: cost };
      }
      throw e;
    }
    usedProvider = res.provider;
    cost += res.costUsd;
    if (webOn) ctx.counters.web++;
    if (xOn) ctx.counters.x++;
    for (const c of res.citations) {
      found.push({ url: c.url, title: c.title ?? c.url, tier: inferTier(c.url), stance: 'context', origin: /(^|\.)(x|twitter)\.com/.test(c.url) ? 'x_search' : 'web_search', publishedAt: c.date });
    }
    if (res.finishReason === 'content_filter') {
      return { ...base, provider: usedProvider, grade: null, confidence: null, abstained: true, reasoning: 'The model declined to investigate this claim.', sources: [], techniques: [], confidenceReason: '', latencyMs: Date.now() - started, costUsd: cost };
    }
    if (res.toolCalls.length) {
      messages.push({ role: 'assistant', content: res.content ?? '', tool_calls: res.toolCalls, reasoning_details: res.reasoningDetails });
      for (const call of res.toolCalls as ToolCall[]) {
        if (call.function.name === 'submit_verdict') {
          try {
            verdict = parseJson<RawVerdict>(call.function.arguments);
          } catch {
            messages.push({ role: 'tool', tool_call_id: call.id, content: 'Invalid JSON. Call submit_verdict again with valid arguments.' });
          }
          if (verdict) break;
        } else {
          const out = await executeTool(call.function.name, call.function.arguments, ctx);
          messages.push({ role: 'tool', tool_call_id: call.id, content: out });
        }
      }
    } else {
      try {
        verdict = parseJson<RawVerdict>(res.content);
        if (!verdict?.grade) verdict = null;
      } catch {
        /* not a verdict */
      }
      if (!verdict) {
        messages.push({ role: 'assistant', content: res.content || '' });
        messages.push({ role: 'user', content: 'Call submit_verdict now with your verdict.' });
      }
    }
  }

  if (!verdict) {
    return { ...base, provider: usedProvider, grade: null, confidence: null, abstained: true, reasoning: 'No verdict within the budget.', sources: dedupeSources(found), techniques: [], confidenceReason: '', toolCalls: ctx.counters.toolCalls, searches: { web: ctx.counters.web, x: ctx.counters.x, scrape: ctx.counters.scrape }, latencyMs: Date.now() - started, costUsd: cost, budgetReached: true };
  }

  const grade: Grade | null = GRADES.includes(verdict.grade) ? verdict.grade : null;
  const confidence: Confidence = CONFIDENCES.includes(verdict.confidence) ? verdict.confidence : 'low';
  let sources: VerdictSource[] = (verdict.sources ?? []).map((s) => ({
    url: s.url,
    title: s.title,
    tier: inferTier(s.url, s.tier),
    stance: s.stance,
    quote: s.quote?.slice(0, 300),
    publishedAt: s.publishedAt,
    origin: /(^|\.)(x|twitter)\.com/.test(s.url) ? 'x_search' : 'web_search',
  }));

  // Verify quotes verbatim and check that cited pages exist (TODO 12.13). Demo sources skip this.
  let finalGrade = grade;
  let finalConfidence = confidence;
  if (!input.skipVerification && usedProvider !== 'demo') {
    const checked: VerdictSource[] = [];
    for (const s of sources.slice(0, 8)) {
      if (s.quote) {
        const r = await verifySourceQuote(ctx, s.url, s.quote);
        checked.push({ ...s, quote: r.verified ? s.quote : undefined, quoteVerified: r.verified, ...(r.reachable ? {} : { stance: 'context' as const }) });
        if (!r.reachable) continue;
      } else {
        const ok = await sourceReachable(ctx, s.url);
        checked.push(ok ? s : { ...s, stance: 'context' });
      }
    }
    sources = checked.map((s) => ({ ...s, contentHash: ctx.pageCache.get(s.url)?.hash ?? undefined }));
    const decisive = sources.filter((s) => s.stance !== 'context' && s.tier <= 3);
    const strong = decisive.filter((s) => s.tier <= 2);
    if (grade && grade !== 'not_checkable' && decisive.length === 0) {
      finalGrade = 'not_checkable';
      finalConfidence = 'low';
    } else if (strong.length === 0 || decisive.length < config.pipeline.minSources) {
      finalConfidence = 'low';
    }
  }

  return {
    ...base,
    provider: usedProvider,
    grade: verdict.abstain ? null : finalGrade,
    confidence: verdict.abstain ? null : finalConfidence,
    abstained: Boolean(verdict.abstain) || finalGrade === null,
    reasoning: [...(verdict.reasoning ?? []), verdict.abstain ? `Abstained: ${verdict.abstainReason ?? ''}` : ''].filter(Boolean).join('\n'),
    sources: dedupeSources([...sources, ...found.slice(0, 6)]),
    techniques: verdict.techniques ?? [],
    confidenceReason: verdict.confidenceReason ?? '',
    toolCalls: ctx.counters.toolCalls,
    searches: { web: ctx.counters.web, x: ctx.counters.x, scrape: ctx.counters.scrape },
    costUsd: cost,
    latencyMs: Date.now() - started,
    budgetReached,
  };
}
