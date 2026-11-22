import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { saveSnapshot } from './snapshots';
import { getDb } from '../db/client';
import { sourceSnapshots } from '../db/schema';

describe('source snapshots', () => {
  it('stores a dated, hashed copy once per content', async () => {
    const h1 = await saveSnapshot('https://www.ine.es/x', 'INE', 'Unemployment fell to 10.5%.');
    const h2 = await saveSnapshot('https://www.ine.es/x', 'INE', 'Unemployment fell to 10.5%.');
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h2).toBe(h1);
    const db = await getDb();
    const rows = await db.select().from(sourceSnapshots).where(eq(sourceSnapshots.hash, h1!));
    expect(rows).toHaveLength(1);
  });
});
