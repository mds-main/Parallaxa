import { describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { getDb } from './client';
import * as s from './schema';

describe('database', () => {
  it('migrates and seeds reference data in memory', async () => {
    const db = await getDb();
    const [p] = await db.select({ n: sql<number>`count(*)::int` }).from(s.places);
    const [t] = await db.select({ n: sql<number>`count(*)::int` }).from(s.topics);
    const [c] = await db.select().from(s.configVersions);
    expect(p!.n).toBeGreaterThan(70);
    expect(t!.n).toBeGreaterThanOrEqual(20);
    expect(c!.status).toBe('active');
    expect(c!.config.slots.map((x) => x.id)).toEqual(['US-R', 'US-L', 'CN']);
  });
});
