/** Health and alert checks (TODO 10.10, 25.3): model pings, spend, error rate, latency, fallback. */
import { getActiveConfig } from '../config/store';
import { callModel } from '../ai/provider';
import { getOverview } from '../admin/metrics';
import { raiseAlert } from '../admin/alerts';
import { checkLateEditions } from '../briefing/generate';

export async function runHealthChecks() {
  const { config } = await getActiveConfig();
  const pings: Record<string, string> = {};
  for (const slot of config.slots.filter((s) => s.enabled)) {
    try {
      await callModel({ step: 'health', model: slot.model, slot: slot.id, config, request: { messages: [{ role: 'user', content: 'Reply with: ok' }], maxCompletionTokens: 5, timeoutMs: 15_000 } });
      pings[slot.id] = 'ok';
    } catch (e) {
      pings[slot.id] = (e as Error).message.slice(0, 120);
    }
  }
  const o = await getOverview();
  const recipients = config.alerts.emails;
  if (o.spendToday >= (config.limits.dailySpendCeilingUsd * config.limits.spendAlertPercent) / 100) {
    await raiseAlert('spend', `AI spend today is $${o.spendToday.toFixed(2)} of the $${config.limits.dailySpendCeilingUsd} ceiling.`, recipients);
  }
  if (o.fallbackActive && config.alerts.onFallback) await raiseAlert('fallback', 'The AI Gateway fallback is in use: Venice may be degraded.', recipients);
  if (o.errorRate > config.alerts.errorRatePercent / 100) await raiseAlert('error_rate', `Failed checks in the last 24 h: ${(o.errorRate * 100).toFixed(1)}%.`, recipients);
  if (o.p95Seconds !== null && o.p95Seconds > config.alerts.sloP95Seconds) await raiseAlert('slo', `p95 time to result is ${o.p95Seconds}s (target ${config.alerts.sloP95Seconds}s).`, recipients);
  await checkLateEditions();
  return { pings, attention: o.attention };
}
