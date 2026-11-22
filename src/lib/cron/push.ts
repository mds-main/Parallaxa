/** Sends the daily briefing notification at each subscriber's chosen local time (≤ 1 routine per day, PRD F6). */
import { and, eq } from 'drizzle-orm';
import webpush from 'web-push';
import { getDb } from '../db/client';
import { subscriptions } from '../db/schema';
import { decrypt } from '../security/crypto';
import { getTranslations } from 'next-intl/server';
import { prefixFor, isLocale, DEFAULT_LOCALE } from '../../i18n/languages';

export async function sendDuePushes(now = new Date()): Promise<{ sent: number; skipped: number }> {
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) return { sent: 0, skipped: 0 };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:hello@example.org', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const db = await getDb();
  const subs = await db.select().from(subscriptions).where(and(eq(subscriptions.channel, 'push'), eq(subscriptions.targetId, 'briefing')));
  let sent = 0;
  let skipped = 0;
  for (const sub of subs) {
    const tz = sub.settings?.timezone ?? 'UTC';
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(now);
    const hh = Number(parts.find((p) => p.type === 'hour')?.value);
    const mm = Number(parts.find((p) => p.type === 'minute')?.value);
    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const [th, tm] = (sub.settings?.time ?? '07:00').split(':').map(Number) as [number, number];
    const minutesNow = hh * 60 + mm;
    const target = th * 60 + tm;
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
    const lastDate = sub.lastSentAt ? new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(sub.lastSentAt) : null;
    const weekdaysOnly = sub.settings?.days === 'weekdays' && (weekday === 'Sat' || weekday === 'Sun');
    if (minutesNow < target || minutesNow >= target + 15 || lastDate === localDate || weekdaysOnly || !sub.pushEndpointCiphertext) {
      skipped++;
      continue;
    }
    const lang = isLocale(sub.lang) ? sub.lang : DEFAULT_LOCALE;
    const t = await getTranslations({ locale: lang, namespace: 'today' });
    try {
      await webpush.sendNotification(JSON.parse(decrypt(sub.pushEndpointCiphertext)), JSON.stringify({ title: t('title'), body: t('intro', { count: 5 }), url: `/${prefixFor(lang)}/today`, tag: 'plx-briefing' }));
      await db.update(subscriptions).set({ lastSentAt: now }).where(eq(subscriptions.id, sub.id));
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.delete(subscriptions).where(eq(subscriptions.id, sub.id));
    }
  }
  return { sent, skipped };
}
