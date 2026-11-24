/** Health and alert checks (TODO 10.10, 25.3): passive traffic health + hourly synthetic fallback pings, spend, error rate, latency, fallback. */
import { and, gte, isNotNull, sql } from 'drizzle-orm';
import { getActiveConfig } from '../config/store';
import { callModel } from '../ai/provider';
import { PROVIDER_NAMES } from '../ai/routing';
import { getHealthMetrics } from '../admin/metrics';
import { raiseAlert } from '../admin/alerts';
import { checkLateEditions } from '../briefing/generate';
import { getDb } from '../db/client';
import { errorReports, llmCalls } from '../db/schema';
import { log } from '../log';
import { failStuckAnalyses } from '../pipeline/stuck';

const PASSIVE_WINDOW_MS = 60 * 60_000;
/** Slightly under 60 min so an every-15-minute cron firing a few seconds early doesn't skip an hourly slot. */
const PING_INTERVAL_MS = 55 * 60_000;

export async function runHealthChecks(now = new Date()) {
  const [{ config }, db] = await Promise.all([getActiveConfig(), getDb()]);
  const enabledSlots = config.slots.filter((s) => s.enabled);
  const hourAgo = new Date(now.getTime() - PASSIVE_WINDOW_MS);
  const pingCutoff = new Date(now.getTime() - PING_INTERVAL_MS);

  // Rely on passive real traffic in llm_calls first; only send a synthetic ping (at most once/hour)
  // for slots that have had zero successful real calls in the last 60 minutes.
  const activity = await db
    .select({
      slot: llmCalls.slot,
      model: llmCalls.model,
      realOk: sql<number>`count(*) filter (where ${llmCalls.step} <> 'health' and ${llmCalls.errorClass} is null)::int`,
      recentPingTotal: sql<number>`count(*) filter (where ${llmCalls.step} = 'health' and ${gte(llmCalls.createdAt, pingCutoff)})::int`,
      recentPingOk: sql<number>`count(*) filter (where ${llmCalls.step} = 'health' and ${gte(llmCalls.createdAt, pingCutoff)} and ${llmCalls.errorClass} is null)::int`,
    })
    .from(llmCalls)
    .where(and(gte(llmCalls.createdAt, hourAgo), isNotNull(llmCalls.slot)))
    .groupBy(llmCalls.slot, llmCalls.model);

  const bySlotModel = new Map(activity.map((r) => [`${r.slot}:${r.model}`, r]));
  const pings: Record<string, string> = {};
  const slotsToPing: typeof enabledSlots = [];
  for (const slot of enabledSlots) {
    const stats = bySlotModel.get(`${slot.id}:${slot.model}`);
    if (stats && stats.realOk > 0) {
      pings[slot.id] = 'ok';
    } else if (stats && stats.recentPingTotal > 0) {
      pings[slot.id] = stats.recentPingOk > 0 ? 'ok' : 'degraded';
    } else {
      slotsToPing.push(slot);
    }
  }

  if (slotsToPing.length) {
    await Promise.allSettled(
      slotsToPing.map(async (slot) => {
        try {
          await callModel({
            step: 'health',
            model: slot.model,
            slot: slot.id,
            config,
            request: { messages: [{ role: 'user', content: 'Reply with: ok' }], maxCompletionTokens: 5, timeoutMs: 15_000, thinking: false },
          });
          pings[slot.id] = 'ok';
        } catch (e) {
          pings[slot.id] = (e as Error).message.slice(0, 120);
          log.warn('health.slot_down', { slot: slot.id, model: slot.model, error: e, dedupe: slot.id });
        }
      }),
    );
  }

  // Only query metrics health.ts actually evaluates, in parallel with error-report burst detection.
  const [o, bursts] = await Promise.all([
    getHealthMetrics(config, now),
    db
      .select({ analysisId: errorReports.analysisId, n: sql<number>`count(*)::int` })
      .from(errorReports)
      .where(gte(errorReports.createdAt, hourAgo))
      .groupBy(errorReports.analysisId),
  ]);

  if (o.spendToday >= (config.limits.dailySpendCeilingUsd * config.limits.spendAlertPercent) / 100) {
    await raiseAlert('spend', `AI spend today is $${o.spendToday.toFixed(2)} of the $${config.limits.dailySpendCeilingUsd} ceiling.`);
  }
  if (o.fallbackActive && config.alerts.onFallback) {
    const primary = PROVIDER_NAMES[config.routing.primary];
    const backup = PROVIDER_NAMES[config.routing.primary === 'venice' ? 'gateway' : 'venice'];
    await raiseAlert('fallback', `${backup} (backup) is serving requests: ${primary} (primary) may be degraded.`);
  }
  if (o.errorRate > config.alerts.errorRatePercent / 100) await raiseAlert('error_rate', `Failed checks in the last 24 h: ${(o.errorRate * 100).toFixed(1)}%.`);
  if (o.p95Seconds !== null && o.p95Seconds > config.alerts.sloP95Seconds) await raiseAlert('slo', `p95 time to result is ${o.p95Seconds}s (target ${config.alerts.sloP95Seconds}s).`);
  // Coordinated-report detection (TODO 24.2): a burst of reports overall or against one analysis.
  const total = bursts.reduce((a, b) => a + b.n, 0);
  const hot = bursts.filter((b) => b.n >= 5);
  if (total >= 30 || hot.length) await raiseAlert('error_rate', `Possible coordinated error reports in the last hour: ${total} reports; ${hot.map((h) => `${h.analysisId} (${h.n})`).join(', ') || 'spread across analyses'}. Review before acting on them.`);
  const [, stuck] = await Promise.all([checkLateEditions(now), failStuckAnalyses(now)]);
  return { pings, attention: o.attention, stuck };
}
