import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb } from '@/lib/db/client';
import { subscriptions, users } from '@/lib/db/schema';
import { encrypt } from '@/lib/security/crypto';
import { isLocale, DEFAULT_LOCALE } from '@/i18n/languages';
import { rateLimit } from '@/lib/security/rate-limit';
import { clientIp, hashIp } from '@/lib/security/ip';

const body = z.object({
  subscription: z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }),
  lang: z.string(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().max(64),
  days: z.enum(['everyday', 'weekdays']).optional(),
});

/** Stores a Web Push subscription, encrypted at rest, with no other personal data (PRD 9.3). */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  if (!(await rateLimit(`push:${await hashIp(clientIp(req.headers))}`, 10, 3600)).ok) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  const lang = isLocale(parsed.data.lang) ? parsed.data.lang : DEFAULT_LOCALE;
  const db = await getDb();
  const [user] = await db.insert(users).values({ locale: lang, authProvider: 'push-only' }).returning({ id: users.id });
  const enc = encrypt(JSON.stringify(parsed.data.subscription));
  await db.insert(subscriptions).values({
    userId: user!.id,
    targetType: 'topic',
    targetId: 'briefing',
    channel: 'push',
    pushEndpointCiphertext: enc.ciphertext,
    lang,
    settings: { time: parsed.data.time, timezone: parsed.data.timezone, days: parsed.data.days ?? 'everyday' },
  });
  return NextResponse.json({ ok: true });
}
