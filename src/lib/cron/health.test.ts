import { beforeEach, describe, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { getDb, resetDbForTests } from '../db/client';
import * as s from '../db/schema';
import { getActiveConfig, invalidateConfigCache } from '../config/store';
import { getHealthMetrics, getOverview, getSeries } from '../admin/metrics';
import { runHealthChecks } from './health';

describe('health checks and parallel metrics', () => {
  beforeEach(() => {
    resetDbForTests();
    invalidateConfigCache();
  });

  it('skips synthetic pings when slots have recent real traffic, and throttles idle pings to once per hour', async () => {
    const db = await getDb();
    const { config } = await getActiveConfig();
    const enabled = config.slots.filter((slot) => slot.enabled);
    const now = new Date();

    // 1. Seed a recent successful real call for the first slot only.
    const activeSlot = enabled[0]!;
    await db.insert(s.llmCalls).values({
      provider: 'venice',
      model: activeSlot.model,
      slot: activeSlot.id,
      step: `investigate:${activeSlot.id}`,
      costUsd: 0.01,
      latencyMs: 500,
      createdAt: new Date(now.getTime() - 10 * 60_000),
    });

    // First run: only the idle slots (without real traffic) should be synthetically pinged.
    const first = await runHealthChecks(now);
    for (const slot of enabled) expect(first.pings[slot.id]).toBe('ok');
    const healthRowsAfterFirst = await db.select().from(s.llmCalls).where(eq(s.llmCalls.step, 'health'));
    expect(healthRowsAfterFirst.map((r) => r.slot).sort()).toEqual(
      enabled
        .slice(1)
        .map((slot) => slot.id)
        .sort(),
    );

    // 2. Second run 15 minutes later: every slot either had real traffic or a synthetic ping < 55 min ago -> 0 new pings.
    const second = await runHealthChecks(new Date(now.getTime() + 15 * 60_000));
    for (const slot of enabled) expect(second.pings[slot.id]).toBe('ok');
    const healthRowsAfterSecond = await db.select().from(s.llmCalls).where(eq(s.llmCalls.step, 'health'));
    expect(healthRowsAfterSecond).toHaveLength(healthRowsAfterFirst.length);

    // 3. Third run 65 minutes later: all prior activity is outside the 60 min / 55 min windows -> all enabled slots ping once.
    const third = await runHealthChecks(new Date(now.getTime() + 65 * 60_000));
    for (const slot of enabled) expect(third.pings[slot.id]).toBe('ok');
    const healthRowsAfterThird = await db.select().from(s.llmCalls).where(eq(s.llmCalls.step, 'health'));
    expect(healthRowsAfterThird).toHaveLength(healthRowsAfterFirst.length + enabled.length);
  });

  it('keeps getHealthMetrics, getOverview and getSeries consistent in parallel', async () => {
    const db = await getDb();
    const { config } = await getActiveConfig();
    const now = new Date();
    const tenMinAgo = new Date(now.getTime() - 10 * 60_000);
    const publishedAt = new Date(tenMinAgo.getTime() + 4_500);

    await db.insert(s.analyses).values([
      { status: 'published', inputKind: 'text', grade: 'well_supported', createdAt: tenMinAgo, publishedAt },
      { status: 'failed', inputKind: 'text', error: 'timeout', createdAt: tenMinAgo },
      { status: 'failed', inputKind: 'text', error: 'reused:abc', createdAt: tenMinAgo },
    ]);
    await db.insert(s.llmCalls).values({
      provider: 'gateway',
      model: config.slots[0]!.model,
      slot: config.slots[0]!.id,
      step: 'investigate:US-R',
      costUsd: 0.42,
      fallback: true,
      createdAt: tenMinAgo,
    });

    const [health, overview, series] = await Promise.all([getHealthMetrics(config, now), getOverview(now), getSeries(7)]);
    expect(health.spendToday).toBeCloseTo(0.42, 4);
    expect(overview.spendToday).toBeCloseTo(health.spendToday, 4);
    expect(health.fallbackActive).toBe(true);
    expect(overview.fallbackActive).toBe(true);
    expect(health.errorRate).toBeCloseTo(1 / 3, 4);
    expect(overview.errorRate).toBeCloseTo(health.errorRate, 4);
    expect(health.p95Seconds).toBe(4.5);
    expect(overview.p95Seconds).toBe(4.5);
    expect(overview.checksToday).toBe(3);
    expect(overview.reusedToday).toBe(1);
    expect(series.checks.length).toBeGreaterThanOrEqual(1);
    expect(series.spend.length).toBeGreaterThanOrEqual(1);
    vi.restoreAllMocks();
  });
});
