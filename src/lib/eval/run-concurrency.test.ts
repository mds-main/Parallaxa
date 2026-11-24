import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../config/schema';
import type { SlotVerdict } from '../domain/types';

let active = 0;
let maxActive = 0;

vi.mock('../ai/harness', () => ({
  investigate: async ({ slot }: { slot: { id: string; model: string } }): Promise<SlotVerdict> => {
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, 15));
    active--;
    return {
      slot: slot.id as SlotVerdict['slot'],
      model: slot.model,
      provider: 'venice',
      grade: 'well_supported',
      confidence: 'high',
      abstained: false,
      coiExcluded: false,
      reasoning: 'stub',
      sources: [],
      toolCalls: 1,
      searches: { web: 1, x: 0, scrape: 0 },
      costUsd: 0,
      latencyMs: 15,
    };
  },
}));

const { loadGoldSet, runEval } = await import('./run');

describe('eval bounded concurrency', () => {
  beforeEach(() => {
    active = 0;
    maxActive = 0;
    process.env.VENICE_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.VENICE_API_KEY;
  });

  it('runs multiple gold items in parallel up to the concurrency bound with deterministic result order', async () => {
    const limit = 8;
    const concurrency = 3;
    const cfg = defaultConfig();
    const enabledSlots = cfg.slots.filter((s) => s.enabled).length;
    const m = await runEval({ config: cfg, kind: 'nightly', limit, persist: false, concurrency });
    expect(m.demo).toBe(false);
    expect(m.n).toBe(limit);
    // Deterministic result order matching the gold set regardless of worker finish order.
    expect(m.results.map((r) => r.id)).toEqual(loadGoldSet().slice(0, limit).map((g) => g.id));
    // Multiple items ran concurrently (> 1 item * enabledSlots) while respecting the cap (<= concurrency * enabledSlots).
    expect(maxActive).toBeGreaterThan(enabledSlots);
    expect(maxActive).toBeLessThanOrEqual(concurrency * enabledSlots);
  });
});
