import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import * as s from '../db/schema';
import { createPendingAnalysis } from './run';
import { failStuckAnalyses } from './stuck';

process.env.PARALLAXA_DB = 'memory';

describe('stuck checks', () => {
  let db: Awaited<ReturnType<typeof getDb>>;
  beforeAll(async () => {
    db = await getDb();
  });

  it('fails checks with no progress for 15 minutes and leaves recent ones alone', async () => {
    const old = await createPendingAnalysis({ kind: 'text', text: 'a' }, 'en');
    const fresh = await createPendingAnalysis({ kind: 'text', text: 'b' }, 'en');
    const longAgo = new Date(Date.now() - 20 * 60_000).toISOString();
    await db.update(s.analyses).set({ status: 'running', progress: { stage: 'investigate', done: ['ingest'], updatedAt: longAgo } }).where(eq(s.analyses.id, old));
    await db.update(s.analyses).set({ status: 'running', progress: { stage: 'investigate', done: ['ingest'], updatedAt: new Date().toISOString() } }).where(eq(s.analyses.id, fresh));
    expect(await failStuckAnalyses()).toBeGreaterThanOrEqual(1);
    const [a] = await db.select().from(s.analyses).where(eq(s.analyses.id, old));
    const [b] = await db.select().from(s.analyses).where(eq(s.analyses.id, fresh));
    expect(a!.status).toBe('failed');
    expect(b!.status).toBe('running');
  });
});
