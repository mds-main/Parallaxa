/** Alerts (TODO 22.18): stored in alerts_log (deduplicated per hour) and emailed via Resend when configured. */
import { and, desc, eq, gte, isNull } from 'drizzle-orm';
import { getDb } from '../db/client';
import { alertsLog } from '../db/schema';

export type AlertKind = 'spend' | 'slo' | 'error_rate' | 'fallback' | 'eval_regression' | 'late_briefing' | 'login_lockout' | 'catalog';

export async function raiseAlert(kind: AlertKind, message: string, recipients?: string) {
  const db = await getDb();
  const since = new Date(Date.now() - 3600_000);
  const [recent] = await db.select().from(alertsLog).where(and(eq(alertsLog.kind, kind), gte(alertsLog.at, since), isNull(alertsLog.acknowledgedAt))).limit(1);
  if (recent) return;
  await db.insert(alertsLog).values({ kind, message });
  const to = (recipients ?? process.env.ALERT_EMAIL_TO ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (process.env.RESEND_API_KEY && to.length) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.ALERT_EMAIL_FROM ?? 'Parallaxa alerts <alerts@parallaxa.app>', to, subject: `[Parallaxa] ${kind}`, text: message }),
    }).catch(() => undefined);
  }
}

export async function listAlerts(limit = 50) {
  const db = await getDb();
  return db.select().from(alertsLog).orderBy(desc(alertsLog.at)).limit(limit);
}

export async function acknowledgeAlert(id: number) {
  const db = await getDb();
  await db.update(alertsLog).set({ acknowledgedAt: new Date() }).where(eq(alertsLog.id, id));
}
