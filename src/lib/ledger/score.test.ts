import { describe, expect, it } from 'vitest';
import { factualReliability } from './score';

describe('factualReliability', () => {
  it('gives no score below 10 graded claims', () => {
    const r = factualReliability(Array.from({ length: 9 }, () => ({ grade: 'contradicted', reach: 1 })));
    expect(r.value).toBeNull();
    expect(r.n).toBe(9);
  });
  it('is reach-weighted and ignores not-checkable claims', () => {
    const claims = [
      ...Array.from({ length: 8 }, () => ({ grade: 'well_supported', reach: 1 })),
      { grade: 'contradicted', reach: 8 },
      { grade: 'mostly_unsupported', reach: 0 },
      { grade: 'not_checkable', reach: 100 },
    ];
    const r = factualReliability(claims);
    expect(r.n).toBe(10);
    expect(r.bad).toBe(2);
    expect(r.value).toBeCloseTo(1 - 9 / 17, 5);
    expect(r.confidence).toBe('low');
  });
});
