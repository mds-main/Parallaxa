/**
 * Per-model circuit breaker (TODO 10.8). State lives in memory per function instance, which is enough
 * to shed load from a failing model quickly; manual overrides come from the admin console.
 * Upgrade path at scale: move state to a shared KV store.
 */
type State = { failures: number[]; openedAt: number | null; latencies: number[]; baselineMs: number | null; forced?: 'open' | 'closed' };

const states = new Map<string, State>();

export type BreakerSettings = { failures: number; windowSec: number; probeSec: number; latencyMultiplier: number };

function get(model: string): State {
  let s = states.get(model);
  if (!s) {
    s = { failures: [], openedAt: null, latencies: [], baselineMs: null };
    states.set(model, s);
  }
  return s;
}

export function breakerAllows(model: string, cfg: BreakerSettings, now = Date.now()): boolean {
  const s = get(model);
  if (s.forced === 'open') return false;
  if (s.forced === 'closed') return true;
  if (s.openedAt === null) return true;
  // Half-open: allow one probe after the probe interval.
  if (now - s.openedAt >= cfg.probeSec * 1000) {
    s.openedAt = now;
    return true;
  }
  return false;
}

export function recordSuccess(model: string, latencyMs: number) {
  const s = get(model);
  s.failures = [];
  s.openedAt = null;
  s.latencies.push(latencyMs);
  if (s.latencies.length > 50) s.latencies.shift();
  if (s.latencies.length >= 10 && s.baselineMs === null) s.baselineMs = percentile(s.latencies, 0.5);
}

export function recordFailure(model: string, cfg: BreakerSettings, now = Date.now()) {
  const s = get(model);
  s.failures = s.failures.filter((t) => now - t < cfg.windowSec * 1000);
  s.failures.push(now);
  if (s.failures.length >= cfg.failures) s.openedAt = now;
}

export function latencyTripped(model: string, cfg: BreakerSettings): boolean {
  const s = get(model);
  if (!s.baselineMs || s.latencies.length < 10) return false;
  return percentile(s.latencies, 0.95) > s.baselineMs * cfg.latencyMultiplier;
}

export function forceBreaker(model: string, state: 'open' | 'closed' | undefined) {
  get(model).forced = state;
}

export function breakerSnapshot(): Record<string, { open: boolean; failures: number; forced?: string; p95?: number }> {
  const out: Record<string, { open: boolean; failures: number; forced?: string; p95?: number }> = {};
  for (const [model, s] of states) {
    out[model] = { open: s.openedAt !== null || s.forced === 'open', failures: s.failures.length, forced: s.forced, p95: s.latencies.length ? percentile(s.latencies, 0.95) : undefined };
  }
  return out;
}

export function resetBreakers() {
  states.clear();
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}
