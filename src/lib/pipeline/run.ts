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
import { buildEvidencePool } from '../research/pool';
import { dedupeSources } from '../ai/sources';
import { isDemoMode } from '../ai/client';
import { hash } from '../ai/demo';
import { ingest, textHash, type CheckInput } from './ingest';
import { embedText, findCached } from './cache';
import { renderAnalysis } from './render';
import { domainOf } from '../ai/sources';
import { trace } from '@opentelemetry/api';
import { withSpan } from '../telemetry';
import { log } from '../log';
import {
  CLAIM_TYPES,
  type AnalysisProgress,
  type ClaimTags,
  type PendingCheck,
  type MirrorTest,
  type AtomicClaim,
  type PipelineStage,
  type SlotVerdict,
  type StructuredAnalysis,
  type Technique,
  TECHNIQUES,
} from '../domain/types';

export type RunResult = { analysisId: string; status: 'published' | 'review' | 'failed' | 'needs_input'; reusedFrom?: string };

export type RunOptions = {
  skipCache?: boolean;
  /** The place the claim is about when it doesn't say (a briefing knows its edition's place). Without it, the reader is asked. */
  place?: string;
};

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
    backupModel: config.roles.backup,
    model: config.roles.canonicalize,
    rawUserText,
    config,
    analysisId,
    request: { messages: [{ role: 'system', content: prompt.text }, { role: 'user', content: `<user_input>${text}</user_input>` }], responseSchema: CANONICALIZE_SCHEMA, temperature: 0, thinking: false },
  });
  return toAtomicClaims(parseJson<{ claims: RawClaim[] }>(res.content).claims, config.pipeline.maxClaimsPerCheck);
}

type RawClaim = { canonical: string; local?: string; type: string; checkable: boolean };

/** Model output → claims. `local` is the same PII-free claim in the input's language, used to search local sources. */
export function toAtomicClaims(raw: RawClaim[], max: number): AtomicClaim[] {
  return raw
    .filter((c) => c.canonical?.trim())
    .slice(0, max)
    .map((c, i) => {
      const local = c.local?.trim();
      return {
        id: `c${i + 1}`,
        canonical: c.canonical.trim(),
        ...(local && local !== c.canonical.trim() ? { localized: local } : {}),
        type: (CLAIM_TYPES as readonly string[]).includes(c.type) ? (c.type as AtomicClaim['type']) : 'fact',
        checkable: Boolean(c.checkable),
      };
    });
}

async function tag(claim: string, config: AppConfig, analysisId: string) {
  const db = await getDb();
  const topicRows = await db.select({ id: s.topics.id }).from(s.topics).where(eq(s.topics.active, true));
  const placeIds = new Set((await db.select({ id: s.places.id }).from(s.places)).map((p) => p.id));
  const topicIds = new Set(topicRows.map((t) => t.id));
  const prompt = loadPrompt('tag', 'en', { topics: [...topicIds].join(', ') });
  const res = await callModel({
    step: 'tag',
    backupModel: config.roles.backup,
    model: config.roles.tag,
    config,
    analysisId,
    request: { messages: [{ role: 'system', content: prompt.text }, { role: 'user', content: `<claim>${claim}</claim>` }], responseSchema: TAG_SCHEMA, temperature: 0, thinking: false },
  });
  const out = parseJson<{ places: { id: string; confidence: number }[]; topics: { id: string; confidence: number }[]; placeNeeded?: boolean }>(res.content);
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
  return { places: places.length ? places : [{ id: 'GLOBAL', confidence: 0.3 }], topics: topics.length ? topics : [{ id: 'culture', confidence: 0.2 }], placeNeeded: Boolean(out.placeNeeded) } satisfies ClaimTags;
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

export async function runAnalysis(analysisId: string, input: CheckInput, lang: string, opts: RunOptions = {}): Promise<RunResult> {
  const started = Date.now();
  const r = await withSpan('pipeline.run', { 'plx.input_kind': input.kind, 'plx.lang': lang }, () => runAnalysisInner(analysisId, input, lang, opts), (r) => ({ 'plx.status': r.status, 'plx.reused': Boolean(r.reusedFrom) }));
  logOutcome(r, started, { kind: input.kind, lang });
  return r;
}

/** One line per analysis (failures are logged with their cause by `fail`). */
function logOutcome(r: RunResult, started: number, fields: Record<string, unknown>) {
  if (r.status === 'failed' && !r.reusedFrom) return;
  log.info('analysis.done', { analysis: r.analysisId, status: r.status, reused: r.reusedFrom, ms: Date.now() - started, ...fields });
}

type PipelineCtx = Awaited<ReturnType<typeof pipelineContext>>;

async function pipelineContext(analysisId: string, alreadyDone: PipelineStage[] = []) {
  const db = await getDb();
  const { id: configVersionId, config, activatedAt } = await getActiveConfig();
  const done: PipelineStage[] = [...alreadyDone];
  const step = async (stage: PipelineStage) => {
    trace.getActiveSpan()?.addEvent(`stage.${stage}`);
    await setProgress(analysisId, stage, [...done]);
  };
  return { db, config, configVersionId, activatedAt, done, step };
}

const pickMain = (atomic: AtomicClaim[]) => atomic.find((c) => c.checkable && c.type !== 'value') ?? atomic[0]!;
const isValuesClaim = (c: AtomicClaim) => c.type === 'value' || c.type === 'prediction' || !c.checkable;

async function fail(analysisId: string, e: unknown): Promise<RunResult> {
  const db = await getDb();
  const [row] = await db.select({ progress: s.analyses.progress, createdAt: s.analyses.createdAt }).from(s.analyses).where(eq(s.analyses.id, analysisId)).catch(() => []);
  log.error('analysis.failed', { analysis: analysisId, stage: row?.progress?.stage, ms: row?.createdAt ? Date.now() - new Date(row.createdAt).getTime() : undefined, error: e });
  await db.update(s.analyses).set({ status: 'failed', error: (e as Error).message.slice(0, 500), pending: null }).where(eq(s.analyses.id, analysisId));
  return { analysisId, status: 'failed' };
}

async function runAnalysisInner(analysisId: string, input: CheckInput, lang: string, opts: RunOptions): Promise<RunResult> {
  const ctx = await pipelineContext(analysisId);
  const { config, step, done } = ctx;
  try {
    await step('ingest');
    const ingested = await ingest(input, config, analysisId);
    if (!ingested.text) throw new Error('No readable text found.');
    done.push('ingest');

    await step('decompose');
    const atomic = await canonicalize(ingested.text, config, analysisId, ingested.kind !== 'url');
    if (!atomic.length) throw new Error('No claim found in the input.');
    done.push('decompose');

    const main = pickMain(atomic);
    await step('tag');
    const tags = await tag(main.canonical, config, analysisId);
    done.push('tag');

    let pending: PendingCheck = {
      ingested: { kind: ingested.kind, excerpt: ingested.excerpt, lang: ingested.lang },
      atomic,
      mainId: main.id,
      tags,
      lang,
      skipCache: Boolean(opts.skipCache),
      suggestions: placeSuggestions(tags, ingested.lang),
    };
    if (tags.placeNeeded && !isValuesClaim(main)) {
      if (opts.place) pending = await applyPlace(pending, opts.place);
      else return await pauseForPlace(analysisId, pending, done);
    }
    return await finishAnalysis(analysisId, pending, ctx);
  } catch (e) {
    return fail(analysisId, e);
  }
}

/** Places offered first when asking: the tagger's own guesses, then the main countries of the input's language. */
export function placeSuggestions(tags: ClaimTags, inputLang: string): string[] {
  const byLanguage: Record<string, string[]> = { es: ['ES', 'MX'], en: ['US', 'GB'], fr: ['FR', 'BE'], de: ['DE', 'AT'], it: ['IT'], pt: ['PT'] };
  const guesses = tags.places.map((p) => p.id).filter((id) => id !== 'GLOBAL');
  return [...new Set([...guesses, ...(byLanguage[inputLang.split('-')[0]!] ?? [])])].slice(0, 4);
}

async function pauseForPlace(analysisId: string, pending: PendingCheck, done: PipelineStage[]): Promise<RunResult> {
  const db = await getDb();
  const progress: AnalysisProgress = { stage: 'tag', done: [...done], updatedAt: new Date().toISOString(), question: 'place' };
  await db.update(s.analyses).set({ status: 'needs_input', pending, progress }).where(eq(s.analyses.id, analysisId));
  return { analysisId, status: 'needs_input' };
}

/** "Unemployment is at a 15-year low." + Spain → "Unemployment is at a 15-year low (Spain)." Deterministic, so the same claim and place always meet the same analysis. */
export function withPlace(text: string, placeName: string): string {
  return `${text.trim().replace(/[.!?。]+$/u, '')} (${placeName}).`;
}

/** Puts the chosen place into the main claim (canonical and local versions) and its tags. */
export async function applyPlace(pending: PendingCheck, placeId: string): Promise<PendingCheck> {
  const db = await getDb();
  const [place] = await db.select().from(s.places).where(eq(s.places.id, placeId));
  if (!place) throw new Error('Unknown place.');
  if (placeId === 'GLOBAL') return { ...pending, tags: { ...pending.tags, places: [{ id: 'GLOBAL', confidence: 1 }], placeNeeded: false } };
  const localName = pending.ingested.lang.startsWith('es') ? (place.names['es-ES'] ?? place.names.en!) : (place.localName ?? place.names.en!);
  return {
    ...pending,
    atomic: pending.atomic.map((c) =>
      c.id !== pending.mainId ? c : { ...c, canonical: withPlace(c.canonical, place.names.en!), ...(c.localized ? { localized: withPlace(c.localized, localName) } : {}) },
    ),
    tags: { ...pending.tags, places: [{ id: placeId, confidence: 1 }], placeNeeded: false },
  };
}

/** Continues a check that was waiting for the reader to choose a place. The API has already moved it to "running". */
export async function resumeWithPlace(analysisId: string, placeId: string): Promise<RunResult> {
  const db = await getDb();
  const [row] = await db.select({ pending: s.analyses.pending, progress: s.analyses.progress }).from(s.analyses).where(eq(s.analyses.id, analysisId));
  if (!row?.pending) return { analysisId, status: 'failed' };
  const started = Date.now();
  const result = await withSpan('pipeline.resume', { 'plx.place': placeId }, async () => {
    const ctx = await pipelineContext(analysisId, row.progress?.done ?? ['ingest', 'decompose', 'tag']);
    try {
      const pending = await applyPlace(row.pending!, placeId);
      await db.update(s.analyses).set({ pending: null }).where(eq(s.analyses.id, analysisId));
      return await finishAnalysis(analysisId, pending, ctx);
    } catch (e) {
      return fail(analysisId, e);
    }
  });
  logOutcome(result, started, { resumed: true, place: placeId });
  return result;
}

/** Everything after tagging: similar-claim cache, research, investigation, aggregation, writing and publishing. */
async function finishAnalysis(analysisId: string, prepared: PendingCheck, ctx: PipelineCtx): Promise<RunResult> {
  const { db, config, configVersionId, activatedAt, step, done } = ctx;
  const { ingested, atomic, tags, lang } = prepared;
  const opts = { skipCache: prepared.skipCache };
  try {
    const main = atomic.find((c) => c.id === prepared.mainId) ?? pickMain(atomic);
    const isValues = isValuesClaim(main);
    const h = textHash(main.canonical);
    const embedding = await embedText(main.canonical, config.roles.embedding);
    const cached = opts.skipCache ? null : await findCached(h, embedding, config.pipeline.cacheSimilarity);
    if (cached && cached.analysisId !== analysisId) {
      await db.update(s.analyses).set({ status: 'failed', error: `reused:${cached.analysisId}`, pending: null }).where(eq(s.analyses.id, analysisId));
      return { analysisId: cached.analysisId, status: 'published', reusedFrom: cached.analysisId };
    }
    const [claimRow] = await db
      .insert(s.claims)
      .values({ canonicalText: main.canonical, lang: ingested.lang, claimType: main.type, textHash: h, embedding })
      .onConflictDoUpdate({ target: s.claims.textHash, set: { embedding, lang: ingested.lang } })
      .returning({ id: s.claims.id });

    await step('retrieve');
    // Deep research on canonical, PII-free text only (never the user's own words): plan, search, rank, read.
    const research = isValues || isDemoMode() ? null : await buildEvidencePool(main, config, analysisId, { placeIds: tags.places.map((p) => p.id) });
    const pool = research?.pool ?? [];
    const pages = research?.pages;
    done.push('retrieve');

    await step('investigate');
    const enabled = config.slots.filter((x) => x.enabled);
    let verdicts: (SlotVerdict & { techniques: string[]; confidenceReason: string })[] = [];
    const shadows: (SlotVerdict & { techniques: string[] })[] = [];
    if (!isValues) {
      const runs = enabled.map((slot) =>
        investigate({ slot, claim: main, pool, pages, config, analysisId }).catch(
          (e): SlotVerdict & { techniques: string[]; confidenceReason: string } => {
            log.warn('slot.failed', { analysis: analysisId, slot: slot.id, model: slot.model, error: e });
            return {
            slot: slot.id, model: slot.model, provider: 'venice', grade: null, confidence: null, abstained: true, coiExcluded: false,
            reasoning: `Investigation failed: ${(e as Error).message.slice(0, 200)}`, sources: [], toolCalls: 0, searches: { web: 0, x: 0, scrape: 0 }, costUsd: 0, latencyMs: 0, techniques: [], confidenceReason: '',
            };
          },
        ),
      );
      const shadowRuns = [];
      for (const slot of enabled) {
        if (await shadowQuota(slot, activatedAt)) shadowRuns.push(investigate({ slot, claim: main, pool, pages, config, analysisId, modelOverride: slot.shadowModel }).catch((e) => (log.warn('shadow.failed', { analysis: analysisId, slot: slot.id, model: slot.shadowModel, error: e }), null)));
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
    return fail(analysisId, e);
  }
}
