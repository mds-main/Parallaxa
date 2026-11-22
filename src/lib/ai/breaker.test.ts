import { beforeEach, describe, expect, it } from 'vitest';
import { breakerAllows, recordFailure, recordSuccess, resetBreakers } from './breaker';

const cfg = { failures: 3, windowSec: 60, probeSec: 30, latencyMultiplier: 3 };

describe('circuit breaker', () => {
  beforeEach(() => resetBreakers());
  it('opens after N failures in the window and half-opens after the probe interval', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) recordFailure('m', cfg, t0 + i);
    expect(breakerAllows('m', cfg, t0 + 10)).toBe(false);
    expect(breakerAllows('m', cfg, t0 + 31_000)).toBe(true);
    recordSuccess('m', 100);
    expect(breakerAllows('m', cfg, t0 + 31_001)).toBe(true);
  });
  it('ignores failures outside the window', () => {
    recordFailure('m', cfg, 0);
    recordFailure('m', cfg, 1);
    recordFailure('m', cfg, 120_000);
    expect(breakerAllows('m', cfg, 120_001)).toBe(true);
  });
});
