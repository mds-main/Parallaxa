/**
 * Admin console authentication (PRD F8, TODO 22.1–22.5): ADMIN_USERNAME / ADMIN_PASSWORD env vars,
 * constant-time comparison, lockout after 5 failures in 15 minutes per IP hash, signed short-lived
 * session cookie backed by a revocable session row, 30-minute idle timeout.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { adminLoginAttempts, adminSessions } from '../db/schema';
import { clientIp, hashIp, ipAllowed } from '../security/ip';
import { raiseAlert } from './alerts';

export const ADMIN_COOKIE = 'plx_admin';
const SESSION_HOURS = 8;
const IDLE_MINUTES = 30;
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

export function adminConfigured(): boolean {
  const u = process.env.ADMIN_USERNAME;
  const p = process.env.ADMIN_PASSWORD;
  const s = process.env.ADMIN_SESSION_SECRET;
  return Boolean(u && p && p.length >= 20 && s && s.length >= 32);
}

function secret() {
  return new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET!);
}

function sameSecret(a: string, b: string): boolean {
  // Hash first so lengths match and timing does not leak length.
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function isLockedOut(ipHash: string): Promise<boolean> {
  const db = await getDb();
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(adminLoginAttempts)
    .where(and(eq(adminLoginAttempts.ipHash, ipHash), eq(adminLoginAttempts.success, false), gte(adminLoginAttempts.at, since)));
  return (row?.n ?? 0) >= MAX_FAILURES;
}

export type LoginResult = 'ok' | 'invalid' | 'locked' | 'disabled';

export async function login(username: string, password: string): Promise<LoginResult> {
  if (!adminConfigured()) return 'disabled';
  const h = await headers();
  const ip = clientIp(h);
  if (!ipAllowed(ip, process.env.ADMIN_IP_ALLOWLIST)) return 'invalid';
  const ipHash = await hashIp(ip);
  if (await isLockedOut(ipHash)) return 'locked';
  const ok = sameSecret(username, process.env.ADMIN_USERNAME!) && sameSecret(password, process.env.ADMIN_PASSWORD!);
  const db = await getDb();
  await db.insert(adminLoginAttempts).values({ ipHash, success: ok });
  if (!ok) {
    if (await isLockedOut(ipHash)) await raiseAlert('login_lockout', `Admin login locked for 15 minutes after ${MAX_FAILURES} failed attempts (ip hash ${ipHash}).`);
    return 'invalid';
  }
  const sid = randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await db.insert(adminSessions).values({ id: sid, expiresAt, ipHash });
  const token = await new SignJWT({ sid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(expiresAt).sign(secret());
  (await cookies()).set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    expires: expiresAt,
  });
  return 'ok';
}

export type AdminSession = { sid: string; ipHash: string };

export async function getAdminSession(): Promise<AdminSession | null> {
  if (!adminConfigured()) return null;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'] });
    const sid = String(payload.sid ?? '');
    const db = await getDb();
    const [row] = await db.select().from(adminSessions).where(and(eq(adminSessions.id, sid), isNull(adminSessions.revokedAt)));
    if (!row || row.expiresAt < new Date()) return null;
    if (Date.now() - row.lastSeenAt.getTime() > IDLE_MINUTES * 60_000) return null;
    if (Date.now() - row.lastSeenAt.getTime() > 60_000) await db.update(adminSessions).set({ lastSeenAt: new Date() }).where(eq(adminSessions.id, sid));
    const h = await headers();
    if (!ipAllowed(clientIp(h), process.env.ADMIN_IP_ALLOWLIST)) return null;
    return { sid, ipHash: row.ipHash };
  } catch {
    return null;
  }
}

/** Use in every admin page and server action (not only the proxy). */
export async function requireAdmin(locale = 'en'): Promise<AdminSession> {
  const s = await getAdminSession();
  if (!s) redirect(`/${locale === 'es-ES' ? 'es' : 'en'}/admin/login`);
  return s;
}

export async function logout() {
  const s = await getAdminSession();
  if (s) {
    const db = await getDb();
    await db.update(adminSessions).set({ revokedAt: new Date() }).where(eq(adminSessions.id, s.sid));
  }
  (await cookies()).delete(ADMIN_COOKIE);
}
