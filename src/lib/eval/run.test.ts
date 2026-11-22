import { describe, expect, it } from 'vitest';
import { loadGoldSet, scoreResults, harnessCheck } from './run';
import { defaultConfig } from '../config/schema';
import type { Grade } from '../domain/types';

describe('eval scoring', () => {
  it('computes accuracy, mirror parity and language parity', () => {
    const gold = loadGoldSet();
    const got = new Map<string, { grade: Grade; confidence: 'high' | 'medium' | 'low' }>(gold.map((g) => [g.id, { grade: g.expected, confidence: 'high' }]));
    got.set('g12', { grade: 'mixed', confidence: 'low' });
    const m = scoreResults(gold, got);
    expect(m.n).toBe(gold.length);
    expect(m.accuracy).toBeCloseTo((gold.length - 1) / gold.length);
    expect(m.parity).toBeCloseTo(2 / 3);
    expect(m.languageParity).toBe(1);
  });
  it('runs a harness check in demo mode', async () => {
    const r = await harnessCheck(defaultConfig(), 'US-R', 'grok-4-3');
    expect(r.samples).toHaveLength(5);
    expect(r.checks.find((c) => c.label === 'Uses X search')).toBeDefined();
    expect(r.demo).toBe(true);
  });
});
