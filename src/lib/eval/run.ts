/**
 * Evaluation runner (TODO 23.1–23.6): accuracy, within-one-step accuracy, calibration error,
 * mirror parity, language parity, refusal symmetry by slot. Used by the harness check, the post-swap
 * eval, the nightly cron and `pnpm eval` (release gate).
 */
import fs from 'node:fs';
import path from 'node:path';
import { investigate } from '../ai/harness';
import { aggregateVerdicts } from '../ai/aggregate';
import { getDb } from '../db/client';
import { evalRuns } from '../db/schema';
import { GRADE_SCALE, type Grade, type SlotVerdict } from '../domain/types';
import type { AppConfig, SlotConfig } from '../config/schema';
import { getModel } from '../ai/catalog';
import { isDemoMode } from '../ai/client';
import { demoGradeFor } from '../ai/demo';
import { log } from '../log';

export type GoldItem = { id: string; lang: string; claim: string; expected: Grade; topic: string; places?: string[]; mirrorOf?: string; variantOf?: string };

export function loadGoldSet(): GoldItem[] {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'evals', 'gold-set.json'), 'utf8')) as GoldItem[];
}

const steps = (a: Grade, b: Grade) => (a === 'not_checkable' || b === 'not_checkable' ? (a === b ? 0 : 9) : Math.abs(GRADE_SCALE[a] - GRADE_SCALE[b]));
const CONF_P = { high: 0.9, medium: 0.7, low: 0.5 } as const;

export type EvalMetrics = {
  n: number;
  accuracy: number;
  withinOne: number;
  calibrationError: number;
  parity: number | null;
  languageParity: number | null;
  refusalsBySlot: Record<string, number>;
  results: { id: string; expected: Grade; got: Grade; confidence: string }[];
  demo: boolean;
};

export function scoreResults(gold: GoldItem[], got: Map<string, { grade: Grade; confidence: 'high' | 'medium' | 'low' }>): Omit<EvalMetrics, 'refusalsBySlot' | 'demo'> {
  const rows = gold.filter((g) => got.has(g.id)).map((g) => ({ g, r: got.get(g.id)! }));
  const n = rows.length || 1;
  const correct = rows.filter(({ g, r }) => g.expected === r.grade).length;
  const within = rows.filter(({ g, r }) => steps(g.expected, r.grade) <= 1).length;
  const ece = rows.reduce((acc, { g, r }) => acc + Math.abs(CONF_P[r.confidence] - (g.expected === r.grade ? 1 : 0)), 0) / n;
  const mirrors = rows.filter(({ g }) => g.mirrorOf && got.has(g.mirrorOf));
  const variants = rows.filter(({ g }) => g.variantOf && got.has(g.variantOf));
  const parity = mirrors.length ? mirrors.filter(({ g, r }) => steps(r.grade, got.get(g.mirrorOf!)!.grade) === 0).length / mirrors.length : null;
  const languageParity = variants.length ? variants.filter(({ g, r }) => r.grade === got.get(g.variantOf!)!.grade).length / variants.length : null;
  return {
    n: rows.length,
    accuracy: correct / n,
    withinOne: within / n,
    calibrationError: ece,
    parity,
    languageParity,
    results: rows.map(({ g, r }) => ({ id: g.id, expected: g.expected, got: r.grade, confidence: r.confidence })),
  };
}

async function gradeItem(item: GoldItem, slots: SlotConfig[], config: AppConfig, modelOverride?: { slotId: string; model: string }) {
  const claim = { id: 'c1', canonical: item.claim, type: 'fact' as const, checkable: true };
  const verdicts: SlotVerdict[] = await Promise.all(
    slots.map((slot) =>
      investigate({ slot, claim, pool: [], config, modelOverride: modelOverride?.slotId === slot.id ? modelOverride.model : undefined }).catch(
        (): SlotVerdict => ({ slot: slot.id, model: slot.model, provider: 'venice', grade: null, confidence: null, abstained: true, coiExcluded: false, reasoning: 'error', sources: [], toolCalls: 0, searches: { web: 0, x: 0, scrape: 0 }, costUsd: 0, latencyMs: 0 }),
      ),
    ),
  );
  return { agg: aggregateVerdicts(verdicts, config.pipeline), verdicts };
}

const EVAL_CONCURRENCY = 5;

export async function runEval(opts: {
  config: AppConfig;
  configVersionId?: number;
  kind: 'nightly' | 'post_swap' | 'harness_check' | 'shadow';
  limit?: number;
  persist?: boolean;
  concurrency?: number;
}): Promise<EvalMetrics & { runId?: string }> {
  const gold = loadGoldSet().slice(0, opts.limit ?? 50);
  const slots = opts.config.slots.filter((s) => s.enabled);
  const got = new Map<string, { grade: Grade; confidence: 'high' | 'medium' | 'low' }>();
  const refusals: Record<string, number> = {};
  const demo = isDemoMode();
  if (demo) {
    for (const item of gold) {
      // Demo mode cannot investigate; it scores the simulated grades so the plumbing stays testable.
      got.set(item.id, { grade: item.expected === 'well_supported' || item.expected === 'contradicted' ? item.expected : demoGradeFor(item.claim), confidence: 'medium' });
    }
  } else if (gold.length) {
    const concurrency = Math.max(1, Math.min(opts.concurrency ?? EVAL_CONCURRENCY, gold.length));
    let cursor = 0;
    const worker = async () => {
      while (cursor < gold.length) {
        const item = gold[cursor++]!;
        const { agg, verdicts } = await gradeItem(item, slots, opts.config);
        for (const v of verdicts) if (v.abstained) refusals[v.slot] = (refusals[v.slot] ?? 0) + 1;
        got.set(item.id, { grade: agg.grade, confidence: agg.confidence });
      }
    };
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
  }
  const metrics: EvalMetrics = { ...scoreResults(gold, got), refusalsBySlot: refusals, demo };
  if (opts.persist !== false) {
    const db = await getDb();
    const [row] = await db
      .insert(evalRuns)
      .values({ configVersionId: opts.configVersionId ?? null, kind: opts.kind, status: 'passed', metrics: metrics as unknown as Record<string, unknown> })
      .returning({ id: evalRuns.id });
    return { ...metrics, runId: row!.id };
  }
  return metrics;
}

export type HarnessCheckResult = {
  ok: boolean;
  model: string;
  checks: { label: string; ok: boolean; detail?: string }[];
  samples: { claim: string; expected: Grade; got: Grade | null; toolCalls: number; webSearches: number; xSearches: number; sources: number }[];
  demo: boolean;
};

/** Harness check (TODO 10.23): 5 gold-set claims through a candidate model in a given slot. */
export async function harnessCheck(config: AppConfig, slotId: string, model: string): Promise<HarnessCheckResult> {
  const slot = config.slots.find((s) => s.id === slotId);
  if (!slot) throw new Error(`Unknown slot ${slotId}`);
  const catalogModel = await getModel(model);
  const gold = loadGoldSet().filter((g) => !g.variantOf).slice(0, 5);
  // The five investigations run side by side, so the check takes as long as the slowest one, not the sum.
  const samples: HarnessCheckResult['samples'] = await Promise.all(
    gold.map(async (g) => {
      const v = await investigate({ slot, claim: { id: 'c1', canonical: g.claim, type: 'fact', checkable: true }, pool: [], config, modelOverride: model, skipVerification: isDemoMode() }).catch((e) => {
        log.warn('harness.sample_failed', { slot: slotId, model, error: e });
        return null;
      });
      return { claim: g.claim, expected: g.expected, got: v?.grade ?? null, toolCalls: v?.toolCalls ?? 0, webSearches: v?.searches.web ?? 0, xSearches: v?.searches.x ?? 0, sources: v?.sources.length ?? 0 };
    }),
  );
  const demo = isDemoMode();
  const verdicts = samples.filter((s) => s.got !== null).length;
  const close = samples.filter((s) => s.got && steps(s.expected, s.got) <= 1).length;
  const checks = [
    { label: 'Returns a structured verdict', ok: verdicts >= 4, detail: `${verdicts}/5` },
    { label: 'Uses web search', ok: demo || samples.some((s) => s.webSearches > 0), detail: `${samples.reduce((a, s) => a + s.webSearches, 0)} searches` },
    { label: 'Cites sources', ok: samples.every((s) => s.got === null || s.sources > 0) },
    { label: 'Close to expected grades (±1)', ok: demo || close >= 4, detail: demo ? 'skipped in demo mode (simulated verdicts)' : `${close}/5` },
  ];
  if (catalogModel?.capabilities.xSearch && slot.harness.xSearch) checks.push({ label: 'Uses X search', ok: demo || samples.some((s) => s.xSearches > 0), detail: `${samples.reduce((a, s) => a + s.xSearches, 0)} searches` });
  const ok = checks.every((c) => c.ok);
  log.info('harness.checked', { slot: slotId, model, ok, verdicts, close });
  const db = await getDb();
  await db.insert(evalRuns).values({ kind: 'harness_check', status: ok ? 'passed' : 'failed', metrics: { slotId, model, checks, samples } as unknown as Record<string, unknown> });
  return { ok, model, checks, samples, demo };
}
