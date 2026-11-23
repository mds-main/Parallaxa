/**
 * The truth-seeking pipeline (PRD F1). Each stage updates `analyses.progress` so the UI can show
 * honest stage labels while it runs. The configuration version is fixed at the start (TODO 10.24).
 */
import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import * as s from '../db/schema';
import { getActiveConfig } from '../config/store';
import type { AppConfig, SlotConfig } from '../config/schema';
import { callModel } from '../ai/provider';
import { loadPrompt } from '../ai/prompts';
import { CANONICALIZE_SCHEMA, COMPOSE_SCHEMA, TAG_SCHEMA, parseJson } from '../ai/json';
import { investigate } from '../ai/harness';
import { aggregateVerdicts } from '../ai/aggregate';
import { searchWeb } from '../ai/tools';
import { dedupeSources, inferTier } from '../ai/sources';
import { isDemoMode } from '../ai/client';
import { hash } from '../ai/demo';
import { ingest, textHash, type CheckInput } from './ingest';
import { embedText, findCached } from './cache';
import { renderAnalysis } from './render';
import { PRIMARY_SOURCES } from '../data/outlets';
import { domainOf } from '../ai/sources';
import { trace } from '@opentelemetry/api';
import { withSpan } from '../telemetry';
import {
  CLAIM_TYPES,
  type AnalysisProgress,
  type MirrorTest,
  type AtomicClaim,
  type PipelineStage,
  type SlotVerdict,
  type StructuredAnalysis,
  type Technique,
  TECHNIQUES,
  type VerdictSource,
} from '../domain/types';

export type RunResult = { analysisId: string; status: 'published' | 'review' | 'failed'; reusedFrom?: string };

const POLITICAL_TOPICS = new Set(['elections', 'immigration', 'justice', 'territorial', 'economy', 'economy.taxes', 'pensions', 'security', 'equality', 'public_spending', 'housing', 'climate']);

async function setProgress(analysisId: string, stage: PipelineStage, done: PipelineStage[]) {
  const db = await getDb();
  const progress: AnalysisProgress = { stage, done, updatedAt: new Date().toISOString() };
  await db.update(s.analyses).set({ progress, status: 'running' }).where(eq(s.analyses.id, analysisId));
}

export async function createPendingAnalysis(input: CheckInput, lang: string): Promise<string> {
  const db = await getDb();
  const [row] = await db
    .insert(s.analyses)
    .values({ status: 'queued', inputKind: input.kind, inputLang: lang, progress: { stage: 'ingest', done: [], updatedAt: new Date().toISOString() } })
    .returning({ id: s.analyses.id });
  return row!.id;
}

/** `rawUserText`: typed text and screenshots are the user's own words and stay on Venice's private models; fetched pages may use either vendor. */
async function canonicalize(text: string, config: AppConfig, analysisId: string, rawUserText: boolean): Promise<AtomicClaim[]> {
  const prompt = loadPrompt('canonicalize', 'en', { maxClaims: config.pipeline.maxClaimsPerCheck });
  const res = await callModel({
    step: 'canonicalize',
    model: config.roles.canonicalize,
    rawUserText,
    config,
    analysisId,
    request: { messages: [{ role: 'system', content: prompt.text }, { role: 'user', content: `<user_input>${text}</user_input>` }], responseSchema: CANONICALIZE_SCHEMA, temperature: 0 },
  });
  const out = parseJson<{ claims: { canonical: string; type: string; checkable: boolean }[] }>(res.content);
  return out.claims
    .filter((c) => c.canonical?.trim())
    .slice(0, config.pipeline.maxClaimsPerCheck)
    .map((c, i) => ({ id: `c${i + 1}`, canonical: c.canonical.trim(), type: (CLAIM_TYPES as readonly string[]).includes(c.type) ? (c.type as AtomicClaim['type']) : 'fact', checkable: Boolean(c.checkable) }));
}

async function tag(claim: string, config: AppConfig, analysisId: string) {
  const db = await getDb();
  const topicRows = await db.select({ id: s.topics.id }).from(s.topics).where(eq(s.topics.active, true));
  const placeIds = new Set((await db.select({ id: s.places.id }).from(s.places)).map((p) => p.id));
  const topicIds = new Set(topicRows.map((t) => t.id));
  const prompt = loadPrompt('tag', 'en', { topics: [...topicIds].join(', ') });
  const res = await callModel({
    step: 'tag',
    model: config.roles.tag,
    config,
    analysisId,
    request: { messages: [{ role: 'system', content: prompt.text }, { role: 'user', content: `<claim>${claim}</claim>` }], responseSchema: TAG_SCHEMA, temperature: 0 },
  });
  const out = parseJson<{ places: { id: string; confidence: number }[]; topics: { id: string; confidence: number }[] }>(res.content);
  const places = out.places
    .map((p) => {
      // Low-confidence region tags fall back to their parent country (PRD F1 stage 2b).
      const id = p.id.toUpperCase();
      if (!placeIds.has(id)) return null;
      if (id.includes('-') && p.confidence < 0.5) return { id: id.split('-')[0]!, confidence: p.confidence };
      return { id, confidence: Math.max(0, Math.min(1, p.confidence)) };
    })
    .filter((x): x is { id: string; confidence: number } => Boolean(x));
  const topics = out.topics
    .map((t) => {
      if (topicIds.has(t.id)) return { id: t.id, confidence: t.confidence };
      const parent = t.id.split('.')[0]!;
      return topicIds.has(parent) ? { id: parent, confidence: t.confidence } : null;
    })
    .filter((x): x is { id: string; confidence: number } => Boolean(x))
    .slice(0, 3);
  return { places: places.length ? places : [{ id: 'GLOBAL', confidence: 0.3 }], topics: topics.length ? topics : [{ id: 'culture', confidence: 0.2 }] };
}

/** Stage 3: the shared evidence pool every perspective slot starts from. */
async function buildPool(claim: string, config: AppConfig, analysisId: string, ctx: { placeIds: string[]; originalText: string; lang: string }): Promise<VerdictSource[]> {
  if (isDemoMode()) return [];
  const pool: VerdictSource[] = [];
  // Place- and language-aware retrieval (TODO 11.9): search the canonical (English) claim and, for
  // non-English input, the original wording, so local-language sources are found too.
  const queries = [claim, ...(ctx.lang !== 'en' && ctx.originalText ? [ctx.originalText.slice(0, 300)] : [])];
  for (const q of queries) {
    try {
      for (const r of (await searchWeb(q)).slice(0, 5)) pool.push({ url: r.url, title: r.title, tier: inferTier(r.url), stance: 'context', quote: r.snippet.slice(0, 280), origin: 'pool', publishedAt: r.date });
    } catch {
      /* secondary search unavailable */
    }
  }
  const hints = [...new Set(ctx.placeIds.flatMap((p) => PRIMARY_SOURCES[p.split('-')[0]!] ?? []).concat(PRIMARY_SOURCES.GLOBAL!))];
  try {
    const res = await callModel({
      step: 'retrieve',
      model: config.roles.reader,
      config,
      analysisId,
      searches: { web: 1, x: 0, scrape: 0 },
      request: {
        messages: [
          { role: 'system', content: `List the most relevant primary and reputable sources for checking the claim, from across the political spectrum. Prefer the authoritative primary sources for the places involved: ${hints.join(', ')}. Reply with one line per source: title — URL.` },
          { role: 'user', content: `<claim>${claim}</claim>` },
        ],
        veniceParameters: { enable_web_search: 'on', enable_web_citations: true },
        temperature: 0,
      },
    });
    for (const c of res.citations) pool.push({ url: c.url, title: c.title ?? c.url, tier: inferTier(c.url), stance: 'context', quote: c.content?.slice(0, 280), origin: 'pool', publishedAt: c.date });
  } catch {
    /* reader search failed; slots will search themselves */
  }
  return dedupeSources(pool).sort((a, b) => a.tier - b.tier).slice(0, 10);
}

async function shadowQuota(slot: SlotConfig, configActivatedAt: Date | null): Promise<boolean> {
  if (!slot.shadowModel || !slot.shadowRemaining) return false;
  const db = await getDb();
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.analysisVerdicts)
    .where(and(eq(s.analysisVerdicts.shadow, true), eq(s.analysisVerdicts.slot, slot.id), eq(s.analysisVerdicts.model, slot.shadowModel), gte(s.analysisVerdicts.createdAt, configActivatedAt ?? new Date(0))));
  return (row?.n ?? 0) < slot.shadowRemaining;
}

function pickWriter(config: AppConfig, analysisId: string): SlotConfig {
  const enabled = config.slots.filter((x) => x.enabled);
  if (config.roles.writer !== 'rotate') return enabled.find((x) => x.id === config.roles.writer) ?? enabled[0]!;
  return enabled[hash(analysisId) % enabled.length]!;
}

export function runAnalysis(analysisId: string, input: CheckInput, lang: string, opts: { skipCache?: boolean } = {}): Promise<RunResult> {
  return withSpan('pipeline.run', { 'plx.input_kind': input.kind, 'plx.lang': lang }, () => runAnalysisInner(analysisId, input, lang, opts), (r) => ({ 'plx.status': r.status, 'plx.reused': Boolean(r.reusedFrom) }));
}

async function runAnalysisInner(analysisId: string, input: CheckInput, lang: string, opts: { skipCache?: boolean }): Promise<RunResult> {
  const db = await getDb();
  const { id: configVersionId, config, activatedAt } = await getActiveConfig();
  const done: PipelineStage[] = [];
  const step = async (stage: PipelineStage) => {
    trace.getActiveSpan()?.addEvent(`stage.${stage}`);
    await setProgress(analysisId, stage, [...done]);
  };
  try {
    await step('ingest');
    const ingested = await ingest(input, config, analysisId);
    if (!ingested.text) throw new Error('No readable text found.');
    done.push('ingest');

    await step('decompose');
    const atomic = await canonicalize(ingested.text, config, analysisId, ingested.kind !== 'url');
    if (!atomic.length) throw new Error('No claim found in the input.');
    const main = atomic.find((c) => c.checkable && c.type !== 'value') ?? atomic[0]!;
    const isValues = main.type === 'value' || main.type === 'prediction' || !main.checkable;
    const h = textHash(main.canonical);
    const embedding = await embedText(main.canonical, config.roles.embedding);
    const cached = opts.skipCache ? null : await findCached(h, embedding, config.pipeline.cacheSimilarity);
    if (cached && cached.analysisId !== analysisId) {
      await db.update(s.analyses).set({ status: 'failed', error: `reused:${cached.analysisId}` }).where(eq(s.analyses.id, analysisId));
      return { analysisId: cached.analysisId, status: 'published', reusedFrom: cached.analysisId };
    }
    const [claimRow] = await db
      .insert(s.claims)
      .values({ canonicalText: main.canonical, lang: ingested.lang, claimType: main.type, textHash: h, embedding })
      .onConflictDoUpdate({ target: s.claims.textHash, set: { embedding, lang: ingested.lang } })
      .returning({ id: s.claims.id });
    done.push('decompose');

    await step('tag');
    const tags = await tag(main.canonical, config, analysisId);
    done.push('tag');

    await step('retrieve');
    const pool = isValues ? [] : await buildPool(main.canonical, config, analysisId, { placeIds: tags.places.map((p) => p.id), originalText: ingested.text, lang: ingested.lang });
    done.push('retrieve');

    await step('investigate');
    const enabled = config.slots.filter((x) => x.enabled);
    let verdicts: (SlotVerdict & { techniques: string[]; confidenceReason: string })[] = [];
    const shadows: (SlotVerdict & { techniques: string[] })[] = [];
    if (!isValues) {
      const runs = enabled.map((slot) =>
        investigate({ slot, claim: main, pool, config, analysisId }).catch(
          (e): SlotVerdict & { techniques: string[]; confidenceReason: string } => ({
            slot: slot.id, model: slot.model, provider: 'venice', grade: null, confidence: null, abstained: true, coiExcluded: false,
            reasoning: `Investigation failed: ${(e as Error).message.slice(0, 200)}`, sources: [], toolCalls: 0, searches: { web: 0, x: 0, scrape: 0 }, costUsd: 0, latencyMs: 0, techniques: [], confidenceReason: '',
          }),
        ),
      );
      const shadowRuns = [];
      for (const slot of enabled) {
        if (await shadowQuota(slot, activatedAt)) shadowRuns.push(investigate({ slot, claim: main, pool, config, analysisId, modelOverride: slot.shadowModel }).catch(() => null));
      }
      verdicts = await Promise.all(runs);
      for (const sv of await Promise.all(shadowRuns)) if (sv) shadows.push(sv);
    }
    done.push('investigate');

    await step('aggregate');
    const aggregate = isValues
      ? { grade: 'not_checkable' as const, confidence: 'low' as const, disagreement: false, needsHumanReview: false, counted: [], excluded: [], spread: 0 }
      : aggregateVerdicts(verdicts, config.pipeline);
    done.push('aggregate');

    await step('mirror');
    let mirrorTest: MirrorTest | null = null;
    const political = tags.topics.some((t) => POLITICAL_TOPICS.has(t.id) || POLITICAL_TOPICS.has(t.id.split('.')[0]!));
    if (config.pipeline.mirrorTestEnabled && political && !isValues) {
      const res = await callModel({ step: 'mirror', model: config.roles.reader, config, analysisId, request: { messages: [{ role: 'system', content: loadPrompt('mirror').text }, { role: 'user', content: `<claim>${main.canonical}</claim>` }], temperature: 0 } });
      if (res.content.trim()) mirrorTest = { mirroredClaim: res.content.trim().slice(0, 400), originalGrade: aggregate.grade, note: 'Stored for symmetry audits; mirror pairs are graded in the eval suite.' };
    }
    done.push('mirror');

    await step('compose');
    const writer = pickWriter(config, analysisId);
    const sources = dedupeSources(verdicts.flatMap((v) => (v.coiExcluded ? [] : v.sources)).concat(pool)).sort((a, b) => a.tier - b.tier).slice(0, 12);
    const composePrompt = loadPrompt('compose');
    const composeRes = await callModel({
      step: 'compose',
      model: writer.model,
      slot: writer.id,
      config,
      analysisId,
      fallbackModel: writer.fallbackModel,
      request: {
        messages: [
          { role: 'system', content: composePrompt.text },
          {
            role: 'user',
            content: `<claim>${main.canonical}</claim>\ncombined grade: ${aggregate.grade}\nconfidence: ${aggregate.confidence}\ndisagreement: ${aggregate.disagreement}\nvalues question: ${isValues}\n<verdicts>${JSON.stringify(verdicts.map((v) => ({ slot: v.slot, grade: v.grade, confidence: v.confidence, abstained: v.abstained, excludedForConflictOfInterest: v.coiExcluded, reasoning: v.reasoning })))}</verdicts>\n<sources>${JSON.stringify(sources.map((x, i) => ({ n: i + 1, title: x.title, url: x.url, tier: x.tier, quote: x.quoteVerified ? x.quote : undefined })))}</sources>`,
          },
        ],
        responseSchema: COMPOSE_SCHEMA,
        temperature: 0.2,
      },
    });
    const composed = parseJson<{ whatsTrue: string[]; whatsMissing: string[]; whatsWrong: string[]; sidesRight: { left: string[]; right: string[] }; reasoning: string[]; confidenceReason: string; valuesPositions?: { label: string; steelman: string }[]; moralFrames?: StructuredAnalysis['moralFrames'] }>(composeRes.content);
    const techniques = [...new Set(verdicts.flatMap((v) => v.techniques))].filter((t): t is Technique => (TECHNIQUES as readonly string[]).includes(t));
    const staleCutoff = Date.now() - config.pipeline.staleDataMonths * 30 * 24 * 3600 * 1000;
    const datedDecisive = sources.filter((x) => x.publishedAt && x.stance !== 'context');
    const staleData = datedDecisive.length > 0 && datedDecisive.every((x) => Date.parse(x.publishedAt!) < staleCutoff);
    const usedFallback = verdicts.some((v) => v.provider === 'gateway');
    const structured: StructuredAnalysis = {
      input: { kind: ingested.kind, excerpt: ingested.excerpt },
      claims: atomic,
      mainClaimId: main.id,
      grade: aggregate.grade,
      confidence: aggregate.confidence,
      confidenceReason: composed.confidenceReason,
      whatsTrue: composed.whatsTrue,
      whatsMissing: composed.whatsMissing,
      whatsWrong: composed.whatsWrong,
      sidesRight: composed.sidesRight,
      techniques,
      sources,
      reasoning: composed.reasoning,
      verdicts,
      aggregate,
      placeTags: tags.places,
      topicTags: tags.topics,
      staleData,
      valuesQuestion: isValues && composed.valuesPositions?.length ? { positions: composed.valuesPositions } : undefined,
      moralFrames: composed.moralFrames?.slice(0, 3),
      disclosures: {
        demoMode: isDemoMode(),
        fallbackProvider: usedFallback,
        modelsDisagree: aggregate.disagreement,
        staleData,
        humanReviewed: false,
        xSearchUsed: verdicts.some((v) => v.searches.x > 0),
      },
    };
    done.push('compose');

    await step('render');
    const rendered = await renderAnalysis(structured, main.canonical, lang, config, analysisId);
    done.push('render');

    await step('publish');
    const holdForReview = !isValues && aggregate.counted.length < 2;
    const status = holdForReview ? 'review' : 'published';
    const totalCost = verdicts.reduce((acc, v) => acc + v.costUsd, 0);
    const outletRows = await db.select({ id: s.outlets.id, domain: s.outlets.domain }).from(s.outlets);
    const outletFor = (url: string) => {
      const d = domainOf(url);
      return outletRows.find((o) => d === o.domain || d.endsWith(`.${o.domain}`))?.id ?? null;
    };
    await db.transaction(async (tx) => {
      await tx
        .update(s.analyses)
        .set({
          claimId: claimRow!.id,
          status,
          grade: aggregate.grade,
          confidence: aggregate.confidence,
          structured,
          models: Object.fromEntries(enabled.map((x) => [x.id, x.model])),
          provider: isDemoMode() ? 'demo' : usedFallback ? 'gateway' : 'venice',
          promptVersion: `${config.pipeline.promptVersion}:${composePrompt.hash}`,
          configVersionId,
          mirrorTest,
          disagreement: aggregate.disagreement,
          costUsd: totalCost,
          progress: { stage: 'publish', done: [...done, 'publish'], updatedAt: new Date().toISOString() },
          publishedAt: status === 'published' ? new Date() : null,
        })
        .where(eq(s.analyses.id, analysisId));
      for (const v of [...verdicts.map((x) => ({ ...x, shadow: false })), ...shadows.map((x) => ({ ...x, shadow: true }))]) {
        await tx.insert(s.analysisVerdicts).values({
          analysisId, version: 1, slot: v.slot, model: v.model, provider: v.provider, grade: v.grade, confidence: v.confidence,
          abstained: v.abstained, coiExcluded: v.coiExcluded, shadow: v.shadow, reasoning: v.reasoning, sources: v.sources,
          toolCalls: v.toolCalls, searches: v.searches, costUsd: v.costUsd, latencyMs: v.latencyMs,
        });
      }
      for (const p of tags.places) await tx.insert(s.claimPlaces).values({ analysisId, placeId: p.id, confidence: p.confidence }).onConflictDoNothing();
      for (const t of tags.topics) await tx.insert(s.claimTopics).values({ analysisId, topicId: t.id, confidence: t.confidence }).onConflictDoNothing();
      for (const src of sources) {
        const [row] = await tx.insert(s.sources).values({ url: src.url, title: src.title, tier: src.tier, outletId: outletFor(src.url), lang: src.lang ?? null, contentHash: src.contentHash ?? null, snapshotKey: src.contentHash ?? null, publishedAt: src.publishedAt && !Number.isNaN(Date.parse(src.publishedAt)) ? new Date(src.publishedAt) : null }).returning({ id: s.sources.id });
        await tx.insert(s.analysisSources).values({ analysisId, sourceId: row!.id, tier: src.tier, quote: src.quoteVerified ? src.quote ?? null : null, quoteVerified: Boolean(src.quoteVerified), stance: src.stance }).onConflictDoNothing();
      }
      await tx.insert(s.analysisRenderings).values({ analysisId, version: 1, lang, body: rendered.body, model: rendered.model, promptVersion: rendered.promptHash, consistencyCheck: rendered.consistency }).onConflictDoNothing();
      if (aggregate.needsHumanReview || holdForReview) {
        await tx.insert(s.reviewTasks).values({ kind: 'disagreement', refId: analysisId, priority: holdForReview ? 1 : 2, dueAt: new Date(Date.now() + 24 * 3600 * 1000) });
      } else if (hash(analysisId) % 1000 < config.pipeline.humanReviewSampleRate * 1000) {
        await tx.insert(s.reviewTasks).values({ kind: 'sample', refId: analysisId, priority: 3 });
      }
      if (!rendered.consistency.ok) await tx.insert(s.reviewTasks).values({ kind: 'consistency', refId: `${analysisId}:${lang}`, priority: 2, notes: rendered.consistency.notes ?? null });
    });
    return { analysisId, status };
  } catch (e) {
    await db.update(s.analyses).set({ status: 'failed', error: (e as Error).message.slice(0, 500) }).where(eq(s.analyses.id, analysisId));
    return { analysisId, status: 'failed' };
  }
}
