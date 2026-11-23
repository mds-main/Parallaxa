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

  it('creates no account until a passkey verifies, and stores nothing that identifies the person', async () => {
    const { signupOptions, verifyRegistration } = await import('./passkeys');
    const { getDb } = await import('../db/client');
    const s = await import('../db/schema');
    const before = (await (await getDb()).select().from(s.users)).length;
    const options = await signupOptions('http://localhost:3000', 'es-ES');
    expect(options.challenge).toBeTruthy();
    expect(options.authenticatorSelection?.residentKey).toBe('required');
    // A forged or empty response never creates an account.
    await expect(verifyRegistration({ id: 'x', rawId: 'x', type: 'public-key', response: { clientDataJSON: '', attestationObject: '' }, clientExtensionResults: {} } as never, 'http://localhost:3000')).rejects.toThrow();
    expect((await (await getDb()).select().from(s.users)).length).toBe(before);
  });

  it('an account syncs encrypted preferences, exports and deletes everything', async () => {
    const { createPasskeyUser, createUserSession, getUserSession } = await import('./session');
    const { savePreferencesFor, loadPreferencesFor, setSelfPlacement, exportAccount, deleteAccount } = await import('./data');
    const { getDb } = await import('../db/client');
    const s = await import('../db/schema');
    const id = crypto.randomUUID();
    await createPasskeyUser(id, 'es-ES');
    await createUserSession(id);
    expect((await getUserSession())?.userId).toBe(id);

    const db = await getDb();
    const [user] = await db.select().from(s.users).where(eq(s.users.id, id));
    expect(user).toMatchObject({ authProvider: 'passkey', emailHash: null, locale: 'es-ES' });

    await savePreferencesFor(id, { places: [{ id: 'ES-MD' }] });
    const [prefRow] = await db.select().from(s.userPreferences).where(eq(s.userPreferences.userId, id));
    expect(prefRow!.prefsCiphertext).not.toContain('ES-MD');
    expect(await loadPreferencesFor(id)).toEqual({ places: [{ id: 'ES-MD' }] });

    await expect(setSelfPlacement(id, 'centre', false)).rejects.toThrow();
    await setSelfPlacement(id, 'centre', true);
    expect((await exportAccount(id)).politicalSelfPlacement).toMatchObject({ placement: 'centre' });

    await deleteAccount(id);
    expect(await db.select().from(s.userPoliticalSelfId).where(eq(s.userPoliticalSelfId.userId, id))).toHaveLength(0);
    expect(await db.select().from(s.userSessions).where(eq(s.userSessions.userId, id))).toHaveLength(0);
  });
});
