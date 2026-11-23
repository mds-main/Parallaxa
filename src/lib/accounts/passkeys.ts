/** Passkeys (TODO 9.3) with SimpleWebAuthn: the only way to create and sign in to an account. Discoverable credentials, user verification preferred. */
import { randomUUID } from 'node:crypto';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { passkeys } from '../db/schema';
import { createPasskeyUser, setChallenge, takeChallenge } from './session';
import { siteUrl } from '@/lib/site';

export function rp(origin: string) {
  const url = new URL(siteUrl(origin));
  return { rpID: url.hostname, origin: url.origin, rpName: 'Parallaxa' };
}

const b64 = (u: Uint8Array) => Buffer.from(u).toString('base64url');
const unb64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64url'));

export async function registrationOptions(userId: string, origin: string) {
  const db = await getDb();
  const existing = await db.select().from(passkeys).where(eq(passkeys.userId, userId));
  const options = await generateRegistrationOptions({
    rpName: rp(origin).rpName,
    rpID: rp(origin).rpID,
    userName: `parallaxa-${userId.slice(0, 8)}`,
    userDisplayName: 'Parallaxa',
    attestationType: 'none',
    excludeCredentials: existing.map((p) => ({ id: p.id, transports: p.transports as never })),
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });
  await setChallenge(options.challenge, userId);
  return options;
}

/** Options to create a new account with its first passkey. The account row is only created once the passkey verifies. */
export async function signupOptions(origin: string, locale: string) {
  const userId = randomUUID();
  const options = await generateRegistrationOptions({
    rpName: rp(origin).rpName,
    rpID: rp(origin).rpID,
    userName: `parallaxa-${userId.slice(0, 8)}`,
    userDisplayName: 'Parallaxa',
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
  });
  await setChallenge(options.challenge, userId, { locale });
  return options;
}

/** Verifies a new passkey; for a sign-up, also creates the account. Returns the account id, or null. */
export async function verifyRegistration(response: RegistrationResponseJSON, origin: string): Promise<string | null> {
  const c = await takeChallenge();
  if (!c?.userId) return null;
  const { rpID, origin: expectedOrigin } = rp(origin);
  const v = await verifyRegistrationResponse({ response, expectedChallenge: c.challenge, expectedOrigin, expectedRPID: rpID });
  if (!v.verified) return null;
  if (c.signupLocale) await createPasskeyUser(c.userId, c.signupLocale);
  const cred = v.registrationInfo.credential;
  const db = await getDb();
  await db.insert(passkeys).values({ id: cred.id, userId: c.userId, publicKey: b64(cred.publicKey), counter: cred.counter, transports: cred.transports ?? [] }).onConflictDoNothing();
  return c.userId;
}

export async function authenticationOptions(origin: string) {
  const options = await generateAuthenticationOptions({ rpID: rp(origin).rpID, userVerification: 'preferred' });
  await setChallenge(options.challenge);
  return options;
}

export async function verifyAuthentication(response: AuthenticationResponseJSON, origin: string): Promise<string | null> {
  const c = await takeChallenge();
  if (!c) return null;
  const db = await getDb();
  const [pk] = await db.select().from(passkeys).where(eq(passkeys.id, response.id));
  if (!pk) return null;
  const { rpID, origin: expectedOrigin } = rp(origin);
  const v = await verifyAuthenticationResponse({
    response,
    expectedChallenge: c.challenge,
    expectedOrigin,
    expectedRPID: rpID,
    credential: { id: pk.id, publicKey: unb64(pk.publicKey), counter: pk.counter, transports: pk.transports },
  });
  if (!v.verified) return null;
  await db.update(passkeys).set({ counter: v.authenticationInfo.newCounter, lastUsedAt: new Date() }).where(eq(passkeys.id, pk.id));
  return pk.userId;
}
