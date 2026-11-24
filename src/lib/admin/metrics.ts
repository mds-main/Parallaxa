/** Aggregate metrics for the admin console (PRD F8 sections 1 and 7). No per-user data. */
import { and, desc, eq, gte, isNull, not, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import * as s from '../db/schema';
import { spendToday, startOfUtcDay } from '../ai/spend';
import { breakerSnapshot } from '../ai/breaker';
import { getActiveConfig } from '../config/store';
import type { AppConfig } from '../config/schema';
import { todayIn } from '../queries';

const percentile = (values: number[], p: number) => {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  return v[Math.min(v.length - 1, Math.floor(p * v.length))]!;
};

function computeAttention(args: {
  config: AppConfig;
  spend: number;
  fallbackCount: number;
  total24: number;
  failed24: number;
  p95Ms: number | null;
  breakers: string[];
  openAlerts: number;
}) {
  const attention: string[] = [];
  if (args.spend >= (args.config.limits.dailySpendCeilingUsd * args.config.limits.spendAlertPercent) / 100) attention.push('spend');
  if (args.fallbackCount > 0) attention.push('fallback');
  if (args.total24 && args.failed24 / args.total24 > args.config.alerts.errorRatePercent / 100) attention.push('errors');
  if (args.p95Ms !== null && args.p95Ms / 1000 > args.config.alerts.sloP95Seconds) attention.push('latency');
  if (args.breakers.length) attention.push('breakers');
  if (args.openAlerts > 0) attention.push('alerts');
  return attention;
}

/** Focused subset of overview metrics needed by the periodic health cron (5 parallel queries). */
export async function getHealthMetrics(configArg?: AppConfig, now = new Date()) {
  const db = await getDb();
  const config = configArg ?? (await getActiveConfig()).config;
  const dayAgo = new Date(now.getTime() - 24 * 3600_000);
  const halfHour = new Date(now.getTime() - 30 * 60_000);

  const [[analyses24], durations, [fallback], [alerts], spend] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        failed: sql<number>`count(*) filter (where ${s.analyses.status} = 'failed' and coalesce(${s.analyses.error}, '') not like 'reused:%')::int`,
      })
      .from(s.analyses)
      .where(gte(s.analyses.createdAt, dayAgo)),
    db
      .select({ ms: sql<number>`extract(epoch from (${s.analyses.publishedAt} - ${s.analyses.createdAt})) * 1000` })
      .from(s.analyses)
      .where(and(gte(s.analyses.createdAt, dayAgo), eq(s.analyses.status, 'published'))),
    // Calls the backup vendor actually served: the primary (whichever is configured) is failing.
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.llmCalls)
      .where(and(gte(s.llmCalls.createdAt, halfHour), eq(s.llmCalls.fallback, true), isNull(s.llmCalls.errorClass))),
    db.select({ n: sql<number>`count(*)::int` }).from(s.alertsLog).where(isNull(s.alertsLog.acknowledgedAt)),
    spendToday(now),
  ]);

  const ms = durations.map((d) => Number(d.ms)).filter((x) => Number.isFinite(x));
  const p95 = percentile(ms, 0.95);
  const total24 = analyses24?.total ?? 0;
  const failed24 = analyses24?.failed ?? 0;
  const fallbackCount = fallback?.n ?? 0;
  const openAlerts = alerts?.n ?? 0;
  const breakers = Object.entries(breakerSnapshot())
    .filter(([, v]) => v.open)
    .map(([k]) => k);
  const attention = computeAttention({ config, spend, fallbackCount, total24, failed24, p95Ms: p95, breakers, openAlerts });

  return {
    p95Seconds: p95 !== null ? Math.round(p95 / 100) / 10 : null,
    errorRate: total24 ? failed24 / total24 : 0,
    spendToday: spend,
    fallbackActive: fallbackCount > 0,
    breakers,
    openAlerts,
    attention,
  };
}

export async function getOverview(now = new Date()) {
  const db = await getDb();
  const { config } = await getActiveConfig();
  const today = startOfUtcDay(now);
  const dayAgo = new Date(now.getTime() - 24 * 3600_000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000);
  const halfHour = new Date(now.getTime() - 30 * 60_000);

  const [[todayStats], durations, [analyses24], [recentLlm], editions, places, [openReviews], [agree], [lastEval], [alerts], spend] = await Promise.all([
    db
      .select({
        checks: sql<number>`count(*)::int`,
        reused: sql<number>`count(*) filter (where ${s.analyses.error} like 'reused:%')::int`,
      })
      .from(s.analyses)
      .where(gte(s.analyses.createdAt, today)),
    db
      .select({ ms: sql<number>`extract(epoch from (${s.analyses.publishedAt} - ${s.analyses.createdAt})) * 1000` })
      .from(s.analyses)
      .where(and(gte(s.analyses.createdAt, dayAgo), eq(s.analyses.status, 'published'))),
    db
      .select({
        total: sql<number>`count(*)::int`,
        failed: sql<number>`count(*) filter (where ${s.analyses.status} = 'failed' and coalesce(${s.analyses.error}, '') not like 'reused:%')::int`,
      })
      .from(s.analyses)
      .where(gte(s.analyses.createdAt, dayAgo)),
    // Calls the backup vendor actually served and Venice error rate over the last 30 min.
    db
      .select({
        fallback: sql<number>`count(*) filter (where ${s.llmCalls.fallback} and ${s.llmCalls.errorClass} is null)::int`,
        veniceErrors: sql<number>`count(*) filter (where ${s.llmCalls.provider} = 'venice' and ${s.llmCalls.errorClass} is not null)::int`,
        veniceTotal: sql<number>`count(*) filter (where ${s.llmCalls.provider} = 'venice')::int`,
      })
      .from(s.llmCalls)
      .where(gte(s.llmCalls.createdAt, halfHour)),
    db.select({ placeId: s.briefingEditions.placeId, status: s.briefingEditions.status, date: s.briefingEditions.date }).from(s.briefingEditions).orderBy(desc(s.briefingEditions.createdAt)).limit(50),
    db.select({ id: s.places.id, timezone: s.places.timezone }).from(s.places),
    db.select({ n: sql<number>`count(*)::int` }).from(s.reviewTasks).where(eq(s.reviewTasks.status, 'open')),
    db
      .select({ total: sql<number>`count(*)::int`, agreed: sql<number>`sum(case when ${s.analyses.disagreement} then 0 else 1 end)::int` })
      .from(s.analyses)
      .where(and(gte(s.analyses.createdAt, weekAgo), eq(s.analyses.status, 'published'), sql`${s.analyses.grade} <> 'not_checkable'`)),
    db.select().from(s.evalRuns).where(not(eq(s.evalRuns.kind, 'harness_check'))).orderBy(desc(s.evalRuns.createdAt)).limit(1),
    db.select({ n: sql<number>`count(*)::int` }).from(s.alertsLog).where(isNull(s.alertsLog.acknowledgedAt)),
    spendToday(now),
  ]);

  const ms = durations.map((d) => Number(d.ms)).filter((x) => Number.isFinite(x));
  const todaysEditions = config.content.editionPlaces.map((pid) => {
    const tz = places.find((p) => p.id === pid)?.timezone ?? 'UTC';
    const e = editions.find((x) => x.placeId === pid && x.date === todayIn(tz));
    return { placeId: pid, status: e?.status ?? 'missing' };
  });
  const breakers = Object.entries(breakerSnapshot())
    .filter(([, v]) => v.open)
    .map(([k]) => k);

  const p50 = percentile(ms, 0.5);
  const p95 = percentile(ms, 0.95);
  const total24 = analyses24?.total ?? 0;
  const failed24 = analyses24?.failed ?? 0;
  const fallbackCount = recentLlm?.fallback ?? 0;
  const veniceErrors = recentLlm?.veniceErrors ?? 0;
  const veniceTotal = recentLlm?.veniceTotal ?? 0;
  const openAlerts = alerts?.n ?? 0;
  const attention = computeAttention({ config, spend, fallbackCount, total24, failed24, p95Ms: p95, breakers, openAlerts });

  return {
    checksToday: todayStats?.checks ?? 0,
    reusedToday: todayStats?.reused ?? 0,
    p50Seconds: p50 !== null ? Math.round(p50 / 100) / 10 : null,
    p95Seconds: p95 !== null ? Math.round(p95 / 100) / 10 : null,
    errorRate: total24 ? failed24 / total24 : 0,
    spendToday: spend,
    ceiling: config.limits.dailySpendCeilingUsd,
    fallbackActive: fallbackCount > 0,
    routing: config.routing,
    veniceErrorRate: veniceTotal ? veniceErrors / veniceTotal : 0,
    breakers,
    editions: todaysEditions,
    openReviews: openReviews?.n ?? 0,
    agreementRate: agree?.total ? (agree.agreed ?? 0) / agree.total : null,
    lastEval: lastEval ? { kind: lastEval.kind, at: lastEval.createdAt, metrics: lastEval.metrics as Record<string, number | null> } : null,
    openAlerts,
    attention,
  };
}

/** Model calls per vendor over the last `hours`: served, failed, and served as the backup. */
export async function getProviderUsage(hours = 24) {
  const db = await getDb();
  const since = new Date(Date.now() - hours * 3600_000);
  const rows = await db
    .select({
      provider: s.llmCalls.provider,
      served: sql<number>`count(*) filter (where ${s.llmCalls.errorClass} is null)::int`,
      failed: sql<number>`count(*) filter (where ${s.llmCalls.errorClass} is not null)::int`,
      asBackup: sql<number>`count(*) filter (where ${s.llmCalls.fallback} and ${s.llmCalls.errorClass} is null)::int`,
    })
    .from(s.llmCalls)
    .where(gte(s.llmCalls.createdAt, since))
    .groupBy(s.llmCalls.provider);
  const empty = { served: 0, failed: 0, asBackup: 0 };
  const pick = (p: string) => {
    const r = rows.find((x) => x.provider === p);
    return r ? { served: Number(r.served), failed: Number(r.failed), asBackup: Number(r.asBackup) } : empty;
  };
  return { hours, venice: pick('venice'), gateway: pick('gateway') };
}
export type ProviderUsage = Awaited<ReturnType<typeof getProviderUsage>>;

export async function getSlotStats(days = 7) {
  const db = await getDb();
  const since = new Date(Date.now() - days * 24 * 3600_000);
  const rows = await db
    .select({
      slot: s.analysisVerdicts.slot,
      model: s.analysisVerdicts.model,
      grade: s.analysisVerdicts.grade,
      abstained: s.analysisVerdicts.abstained,
      coi: s.analysisVerdicts.coiExcluded,
      latency: s.analysisVerdicts.latencyMs,
      cost: s.analysisVerdicts.costUsd,
      shadow: s.analysisVerdicts.shadow,
      analysisGrade: s.analyses.grade,
      analysisId: s.analysisVerdicts.analysisId,
    })
    .from(s.analysisVerdicts)
    .innerJoin(s.analyses, eq(s.analyses.id, s.analysisVerdicts.analysisId))
    .where(gte(s.analysisVerdicts.createdAt, since));
  const bySlot = new Map<string, typeof rows>();
  for (const r of rows.filter((x) => !x.shadow)) bySlot.set(r.slot, [...(bySlot.get(r.slot) ?? []), r]);
  const stats = [...bySlot.entries()].map(([slot, list]) => {
    const graded = list.filter((x) => !x.abstained && x.grade);
    return {
      slot,
      n: list.length,
      refusalRate: list.length ? list.filter((x) => x.abstained).length / list.length : 0,
      agreement: graded.length ? graded.filter((x) => x.grade === x.analysisGrade).length / graded.length : null,
      coiExclusions: list.filter((x) => x.coi).length,
      p95Seconds: percentile(list.map((x) => x.latency ?? 0), 0.95) !== null ? Math.round(percentile(list.map((x) => x.latency ?? 0), 0.95)! / 100) / 10 : null,
      costUsd: list.reduce((a, x) => a + (x.cost ?? 0), 0),
    };
  });
  // Pairwise agreement matrix between slots on the same analyses.
  const byAnalysis = new Map<string, Map<string, string>>();
  for (const r of rows.filter((x) => !x.shadow && !x.abstained && x.grade)) {
    const m = byAnalysis.get(r.analysisId) ?? new Map<string, string>();
    m.set(r.slot, r.grade!);
    byAnalysis.set(r.analysisId, m);
  }
  const slots = [...bySlot.keys()].sort();
  const matrix = slots.map((a) =>
    slots.map((b) => {
      let both = 0;
      let same = 0;
      for (const m of byAnalysis.values()) {
        if (m.has(a) && m.has(b)) {
          both++;
          if (m.get(a) === m.get(b)) same++;
        }
      }
      return both ? same / both : null;
    }),
  );
  const shadow = rows.filter((x) => x.shadow);
  return { stats, matrix: { slots, values: matrix }, shadowCount: shadow.length };
}

export async function getSeries(days = 30) {
  const db = await getDb();
  const since = new Date(Date.now() - days * 24 * 3600_000);
  const day = (col: unknown) => sql<string>`to_char(date_trunc('day', ${col}), 'YYYY-MM-DD')`;
  const [checks, spend, byStep, usage, languages, grades, survey, evals] = await Promise.all([
    db
      .select({ d: day(s.analyses.createdAt), total: sql<number>`count(*)::int`, failed: sql<number>`sum(case when ${s.analyses.status} = 'failed' and (${s.analyses.error} is null or ${s.analyses.error} not like 'reused:%') then 1 else 0 end)::int` })
      .from(s.analyses)
      .where(gte(s.analyses.createdAt, since))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({ d: day(s.llmCalls.createdAt), usd: sql<number>`coalesce(sum(${s.llmCalls.costUsd}),0)::float`, fallback: sql<number>`sum(case when ${s.llmCalls.provider} = 'gateway' then 1 else 0 end)::int` })
      .from(s.llmCalls)
      .where(gte(s.llmCalls.createdAt, since))
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    db
      .select({ step: sql<string>`split_part(${s.llmCalls.step}, ':', 1)`, usd: sql<number>`coalesce(sum(${s.llmCalls.costUsd}),0)::float` })
      .from(s.llmCalls)
      .where(gte(s.llmCalls.createdAt, since))
      .groupBy(sql`1`),
    db
      .select({ d: day(s.usageEvents.at), event: s.usageEvents.event, n: sql<number>`count(*)::int` })
      .from(s.usageEvents)
      .where(gte(s.usageEvents.at, since))
      .groupBy(sql`1`, s.usageEvents.event)
      .orderBy(sql`1`),
    db
      .select({ lang: s.usageEvents.lang, n: sql<number>`count(*)::int` })
      .from(s.usageEvents)
      .where(and(gte(s.usageEvents.at, since), eq(s.usageEvents.event, 'check_started')))
      .groupBy(s.usageEvents.lang),
    db
      .select({ grade: s.analyses.grade, n: sql<number>`count(*)::int` })
      .from(s.analyses)
      .where(and(gte(s.analyses.createdAt, since), eq(s.analyses.status, 'published')))
      .groupBy(s.analyses.grade),
    db
      .select({ question: s.surveyResponses.question, answer: s.surveyResponses.answer, n: sql<number>`count(*)::int` })
      .from(s.surveyResponses)
      .where(gte(s.surveyResponses.at, since))
      .groupBy(s.surveyResponses.question, s.surveyResponses.answer),
    db.select().from(s.evalRuns).where(and(gte(s.evalRuns.createdAt, since), not(eq(s.evalRuns.kind, 'harness_check')))).orderBy(s.evalRuns.createdAt),
  ]);
  return {
    checks,
    spend,
    byStep,
    usage,
    languages,
    grades,
    survey,
    evals: evals.map((e) => ({ at: e.createdAt.toISOString().slice(0, 10), kind: e.kind, ...(e.metrics as Record<string, number | null>) })),
  };
}

export async function monthlyFreshAnalyses() {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(s.analyses).where(gte(s.analyses.createdAt, new Date(Date.now() - 30 * 24 * 3600_000)));
  return row?.n ?? 0;
}
