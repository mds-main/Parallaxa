/**
 * Optional user accounts (PRD 9.3, TODO 9.1–9.6): passkeys only (SimpleWebAuthn), no email and no password.
 * An account is just an id, its passkeys and the reader's own encrypted data; nothing identifies the person.
 */
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../db/client';
import { userSessions, users } from '../db/schema';

export const USER_COOKIE = 'plx_user';
const SESSION_DAYS = 90;

export function accountsEnabled(): boolean {
  return (process.env.USER_SESSION_SECRET ?? '').length >= 32;
}

function secret() {
  return new TextEncoder().encode(process.env.USER_SESSION_SECRET!);
}

/** A new, anonymous account created by a reader's first passkey. */
export async function createPasskeyUser(id: string, locale: string): Promise<void> {
  const db = await getDb();
  await db.insert(users).values({ id, locale, authProvider: 'passkey' }).onConflictDoNothing();
}

export async function createUserSession(userId: string) {
  const db = await getDb();
  const id = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600_000);
  await db.insert(userSessions).values({ id, userId, expiresAt });
  const token = await new SignJWT({ sid: id }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(expiresAt).sign(secret());
  (await cookies()).set(USER_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: expiresAt });
}

export async function getUserSession(): Promise<{ sid: string; userId: string } | null> {
  if (!accountsEnabled()) return null;
  const token = (await cookies()).get(USER_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    const db = await getDb();
    const [row] = await db.select().from(userSessions).where(and(eq(userSessions.id, String(payload.sid)), isNull(userSessions.revokedAt)));
    if (!row || row.expiresAt < new Date()) return null;
    return { sid: row.id, userId: row.userId };
  } catch {
    return null;
  }
}

export async function signOut() {
  const s = await getUserSession();
  if (s) {
    const db = await getDb();
    await db.update(userSessions).set({ revokedAt: new Date() }).where(eq(userSessions.id, s.sid));
  }
  (await cookies()).delete(USER_COOKIE);
}

/** Short-lived signed cookie holding a WebAuthn challenge (no server-side table needed). */
export async function setChallenge(challenge: string, userId?: string, signup?: { locale: string }) {
  const token = await new SignJWT({ challenge, userId: userId ?? null, signupLocale: signup?.locale ?? null }).setProtectedHeader({ alg: 'HS256' }).setExpirationTime('5m').sign(secret());
  (await cookies()).set('plx_webauthn', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth', maxAge: 300 });
}

export async function takeChallenge(): Promise<{ challenge: string; userId: string | null; signupLocale: string | null } | null> {
  const jar = await cookies();
  const token = jar.get('plx_webauthn')?.value;
  jar.delete('plx_webauthn');
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    return { challenge: String(payload.challenge), userId: (payload.userId as string | null) ?? null, signupLocale: (payload.signupLocale as string | null) ?? null };
  } catch {
    return null;
  }
}
