/**
 * Admin alerts (TODO 22.18): stored in alerts_log (one per kind per hour while unacknowledged) and posted to the
 * admins' Telegram chat. Never emailed. Messages carry operational facts only: no reader data.
 */
import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { getDb } from '../db/client';
import { alertsLog } from '../db/schema';
import { escapeHtml, sendTelegram, telegramConfigured } from './telegram';
import { siteUrl } from '../site';

export type AlertKind = 'spend' | 'slo' | 'error_rate' | 'fallback' | 'eval_regression' | 'late_briefing' | 'login_lockout' | 'catalog';

type AlertSpec = { icon: string; title: string; action: string; page: string; silent?: boolean };

/** What each alert means and what to do, as read on a phone. Pages are admin console paths. */
export const ALERT_SPECS: Record<AlertKind, AlertSpec> = {
  spend: { icon: '💸', title: 'AI spend is near the daily ceiling', action: 'Check Metrics › Costs; lower search budgets or the ceiling if needed.', page: '/admin/metrics' },
  slo: { icon: '🐢', title: 'Checks are slower than the target', action: 'Look at Models for slow or failing slots.', page: '/admin/models' },
  error_rate: { icon: '⚠️', title: 'Failed checks or error reports are up', action: 'Open the review queue and Metrics; a burst of reports may be coordinated.', page: '/admin/review' },
  fallback: { icon: '🔁', title: 'The backup AI vendor is serving requests', action: 'The primary vendor may be down: see Models › AI vendors and the runbook.', page: '/admin/models' },
  eval_regression: { icon: '📉', title: 'Accuracy dropped below the release gate', action: 'Consider rolling back the last model or prompt change (Models › Change history).', page: '/admin/models' },
  late_briefing: { icon: '⏰', title: 'A daily briefing is late', action: 'Review and publish the edition in Content.', page: '/admin/content' },
  login_lockout: { icon: '🔐', title: 'Admin login locked after failed attempts', action: 'If this was not you, check the audit log and rotate the admin password.', page: '/admin/audit' },
  catalog: { icon: '🗂️', title: 'An active model changed on Venice', action: 'Check Models: it may be offline, deprecated or repriced.', page: '/admin/models', silent: true },
};

/** An alert as Telegram HTML: what is wrong, the details, what to do, a link to the console, then the environment. */
export function formatAlert(kind: AlertKind, message: string, base = siteUrl()): string {
  const spec = ALERT_SPECS[kind];
  const env = process.env.VERCEL_ENV ?? 'local';
  return [
    `${spec.icon} <b>${escapeHtml(spec.title)}</b>`,
    escapeHtml(message),
    `👉 ${escapeHtml(spec.action)}`,
    `🛡️ <a href="${escapeHtml(`${base}/en${spec.page}`)}">Open in the admin console</a>`,
    `<i>${escapeHtml(kind)} · ${escapeHtml(env)}</i>`,
  ].join('\n\n');
}

export async function raiseAlert(kind: AlertKind, message: string): Promise<void> {
  const db = await getDb();
  const since = new Date(Date.now() - 3600_000);
  const [recent] = await db.select().from(alertsLog).where(and(eq(alertsLog.kind, kind), gte(alertsLog.at, since), isNull(alertsLog.acknowledgedAt))).limit(1);
  if (recent) return;
  await db.insert(alertsLog).values({ kind, message });
  const delivered = await sendTelegram({ html: formatAlert(kind, message), silent: ALERT_SPECS[kind].silent });
  if (delivered === 0 && telegramConfigured()) console.warn(`alert ${kind}: Telegram did not accept it (still listed in Admin › Alerts)`);
}

/** Posts a test message so an admin can confirm the bot and chats work. Returns how many chats accepted it. */
export async function sendTestAlert(): Promise<number> {
  const env = process.env.VERCEL_ENV ?? 'local';
  return sendTelegram({ html: `✅ <b>Parallaxa alerts are connected</b>\n\nThis chat will receive admin alerts.\n\n<i>test · ${escapeHtml(env)}</i>`, silent: true });
}

export async function listAlerts(limit = 50) {
  const db = await getDb();
  return db.select().from(alertsLog).orderBy(desc(alertsLog.at)).limit(limit);
}

export async function acknowledgeAlert(id: number) {
  const db = await getDb();
  await db.update(alertsLog).set({ acknowledgedAt: new Date() }).where(eq(alertsLog.id, id));
}
