/** Email magic links (TODO 9.3): single use, 15-minute expiry, only hashes stored, sent via Resend (EU). */
import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { getTranslations } from 'next-intl/server';
import { getDb } from '../db/client';
import { magicLinks } from '../db/schema';
import { emailHash, findOrCreateUserByEmailHash } from './session';
import { prefixFor, isLocale, DEFAULT_LOCALE } from '../../i18n/languages';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export async function requestMagicLink(email: string, lang: string, origin: string): Promise<{ sent: boolean; devLink?: string }> {
  const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
  const token = randomBytes(32).toString('base64url');
  const db = await getDb();
  await db.insert(magicLinks).values({ tokenHash: sha(token), emailHash: emailHash(email), lang: locale, expiresAt: new Date(Date.now() + 15 * 60_000) });
  const link = `${origin}/${prefixFor(locale)}/auth/verify?token=${encodeURIComponent(token)}`;
  if (process.env.RESEND_API_KEY) {
    const t = await getTranslations({ locale, namespace: 'settings.account' });
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.AUTH_EMAIL_FROM ?? 'Parallaxa <signin@parallaxa.app>', to: [email], subject: t('emailSubject'), text: t('emailBody', { link }) }),
    });
    return { sent: res.ok };
  }
  // Local development and automated tests only (AUTH_DEV_LINKS=1 is never set in a real deployment):
  // with no email service configured, the link is returned to the caller.
  if (process.env.NODE_ENV !== 'production' || process.env.AUTH_DEV_LINKS === '1') return { sent: true, devLink: link };
  return { sent: false };
}

export async function verifyMagicLink(token: string): Promise<{ userId: string; lang: string } | null> {
  const db = await getDb();
  const [row] = await db.select().from(magicLinks).where(and(eq(magicLinks.tokenHash, sha(token)), isNull(magicLinks.usedAt), gt(magicLinks.expiresAt, new Date())));
  if (!row) return null;
  const updated = await db.update(magicLinks).set({ usedAt: new Date() }).where(and(eq(magicLinks.tokenHash, row.tokenHash), isNull(magicLinks.usedAt))).returning({ t: magicLinks.tokenHash });
  if (!updated.length) return null;
  return { userId: await findOrCreateUserByEmailHash(row.emailHash, row.lang), lang: row.lang };
}
