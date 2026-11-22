/** Account data: encrypted preference sync, export, deletion and optional political self-placement (TODO 9.4–9.6). */
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { passkeys, subscriptions, userPoliticalSelfId, userPreferences, users } from '../db/schema';
import { decrypt, encrypt } from '../security/crypto';

export const PLACEMENTS = ['left', 'centre_left', 'centre', 'centre_right', 'right', 'none'] as const;

export async function savePreferencesFor(userId: string, prefs: unknown) {
  const json = JSON.stringify(prefs);
  if (json.length > 50_000) throw new Error('Preferences too large');
  const enc = encrypt(json);
  const db = await getDb();
  await db
    .insert(userPreferences)
    .values({ userId, prefsCiphertext: enc.ciphertext, keyId: enc.keyId })
    .onConflictDoUpdate({ target: userPreferences.userId, set: { prefsCiphertext: enc.ciphertext, keyId: enc.keyId, updatedAt: new Date() } });
}

export async function loadPreferencesFor(userId: string): Promise<unknown | null> {
  const db = await getDb();
  const [row] = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId));
  return row ? JSON.parse(decrypt(row.prefsCiphertext)) : null;
}

/** Art. 9 data: explicit consent, separate table, separate encryption, aggregate use only (k ≥ 50). */
export async function setSelfPlacement(userId: string, placement: (typeof PLACEMENTS)[number], consent: boolean) {
  if (!consent) throw new Error('Explicit consent is required.');
  const enc = encrypt(JSON.stringify({ placement }));
  const db = await getDb();
  await db
    .insert(userPoliticalSelfId)
    .values({ userId, placementCiphertext: enc.ciphertext, keyId: enc.keyId, consentAt: new Date(), purpose: 'aggregate_trust_and_reach_metrics' })
    .onConflictDoUpdate({ target: userPoliticalSelfId.userId, set: { placementCiphertext: enc.ciphertext, keyId: enc.keyId, consentAt: new Date() } });
}

export async function deleteSelfPlacement(userId: string) {
  const db = await getDb();
  await db.delete(userPoliticalSelfId).where(eq(userPoliticalSelfId.userId, userId));
}

export async function exportAccount(userId: string) {
  const db = await getDb();
  const [user] = await db.select({ createdAt: users.createdAt, locale: users.locale }).from(users).where(eq(users.id, userId));
  const [self] = await db.select().from(userPoliticalSelfId).where(eq(userPoliticalSelfId.userId, userId));
  const keys = await db.select({ id: passkeys.id, createdAt: passkeys.createdAt, lastUsedAt: passkeys.lastUsedAt }).from(passkeys).where(eq(passkeys.userId, userId));
  const subs = await db.select({ targetType: subscriptions.targetType, targetId: subscriptions.targetId, channel: subscriptions.channel, createdAt: subscriptions.createdAt }).from(subscriptions).where(eq(subscriptions.userId, userId));
  return {
    account: user,
    preferences: await loadPreferencesFor(userId),
    politicalSelfPlacement: self ? { ...JSON.parse(decrypt(self.placementCiphertext)), consentAt: self.consentAt } : null,
    passkeys: keys,
    subscriptions: subs,
    note: 'Parallaxa stores no email address, only a keyed hash of it.',
  };
}

/** Hard delete: removes the user and, by cascade, sessions, passkeys, preferences, self-placement and subscriptions. */
export async function deleteAccount(userId: string) {
  const db = await getDb();
  await db.delete(users).where(eq(users.id, userId));
}
