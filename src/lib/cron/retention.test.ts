import { beforeEach, describe, expect, it } from 'vitest';
import { getDb, resetDbForTests } from '../db/client';
import * as s from '../db/schema';
import { runRetention } from './retention';

describe('data retention', () => {
  beforeEach(() => {
    resetDbForTests();
  });

  it('aggregates expired llm_calls into metrics_daily before deleting and purges expired rows concurrently', async () => {
    const db = await getDb();
    const now = new Date('2026-11-24T03:30:00Z');
    const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 3600_000);

    await db.insert(s.llmCalls).values([
      { provider: 'venice', model: 'm1', step: 'tag', costUsd: 0.25, createdAt: daysAgo(100) },
      { provider: 'venice', model: 'm1', step: 'tag', costUsd: 0.75, createdAt: daysAgo(100) },
      { provider: 'venice', model: 'm1', step: 'tag', costUsd: 0.5, createdAt: daysAgo(10) },
    ]);
    await db.insert(s.rateCounters).values([
      { key: 'old-ip', windowStart: Math.floor(daysAgo(5).getTime() / 1000), count: 3 },
      { key: 'fresh-ip', windowStart: Math.floor(daysAgo(1).getTime() / 1000), count: 1 },
    ]);
    await db.insert(s.adminLoginAttempts).values([
      { ipHash: 'h1', success: false, at: daysAgo(10) },
      { ipHash: 'h2', success: true, at: daysAgo(1) },
    ]);
    await db.insert(s.adminSessions).values([
      { id: 's-old', ipHash: 'h1', expiresAt: daysAgo(10) },
      { id: 's-fresh', ipHash: 'h2', expiresAt: daysAgo(1) },
    ]);
    await db.insert(s.usageEvents).values([
      { event: 'check_started', lang: 'en', at: daysAgo(450) },
      { event: 'check_started', lang: 'en', at: daysAgo(10) },
    ]);
    await db.insert(s.analyses).values([
      { status: 'needs_input', inputKind: 'text', createdAt: daysAgo(2) },
      { status: 'needs_input', inputKind: 'text', createdAt: new Date(now.getTime() - 2 * 3600_000) },
    ]);

    const res = await runRetention(now);
    expect(res).toEqual({
      llmCalls: 2,
      rateCounters: 1,
      loginAttempts: 1,
      sessions: 1,
      usageEvents: 1,
      unansweredChecks: 1,
    });

    const daily = await db.select().from(s.metricsDaily);
    expect(daily).toHaveLength(1);
    expect(daily[0]!.metric).toBe('llm_cost_usd');
    expect(daily[0]!.dims).toBe('venice');
    expect(daily[0]!.value).toBeCloseTo(1.0, 5);

    expect(await db.select().from(s.llmCalls)).toHaveLength(1);
    expect(await db.select().from(s.rateCounters)).toHaveLength(1);
  });
});
