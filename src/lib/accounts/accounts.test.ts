import { beforeAll, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

const jar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k)! } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
  headers: async () => new Headers(),
}));

describe('accounts', () => {
  beforeAll(() => {
    process.env.USER_SESSION_SECRET = 'test-user-session-secret-0123456789abcdef';
  });

  it('magic link signs in once, never stores the email, syncs encrypted preferences and deletes everything', async () => {
    const { requestMagicLink, verifyMagicLink } = await import('./magic');
    const { createUserSession, getUserSession, emailHash } = await import('./session');
    const { savePreferencesFor, loadPreferencesFor, setSelfPlacement, exportAccount, deleteAccount } = await import('./data');
    const { getDb } = await import('../db/client');
    const s = await import('../db/schema');

    const r = await requestMagicLink('Person@Example.org', 'es-ES', 'http://localhost:3000');
    const token = new URL(r.devLink!).searchParams.get('token')!;
    const v = await verifyMagicLink(token);
    expect(v).not.toBeNull();
    expect(await verifyMagicLink(token)).toBeNull(); // single use
    await createUserSession(v!.userId);
    const session = await getUserSession();
    expect(session?.userId).toBe(v!.userId);

    const db = await getDb();
    const [user] = await db.select().from(s.users).where(eq(s.users.id, v!.userId));
    expect(user!.emailHash).toBe(emailHash('person@example.org'));
    expect(JSON.stringify(user)).not.toContain('example.org');

    await savePreferencesFor(v!.userId, { places: [{ id: 'ES-MD' }] });
    const [prefRow] = await db.select().from(s.userPreferences).where(eq(s.userPreferences.userId, v!.userId));
    expect(prefRow!.prefsCiphertext).not.toContain('ES-MD');
    expect(await loadPreferencesFor(v!.userId)).toEqual({ places: [{ id: 'ES-MD' }] });

    await expect(setSelfPlacement(v!.userId, 'centre', false)).rejects.toThrow();
    await setSelfPlacement(v!.userId, 'centre', true);
    expect((await exportAccount(v!.userId)).politicalSelfPlacement).toMatchObject({ placement: 'centre' });

    await deleteAccount(v!.userId);
    expect(await db.select().from(s.userPoliticalSelfId).where(eq(s.userPoliticalSelfId.userId, v!.userId))).toHaveLength(0);
    expect(await db.select().from(s.userSessions).where(eq(s.userSessions.userId, v!.userId))).toHaveLength(0);
  });
});
