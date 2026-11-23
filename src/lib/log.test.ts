import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { describeError, formatLine, log, requestId, resetLogState, scrub } from './log';

describe('log', () => {
  beforeEach(() => resetLogState());
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete process.env.LOG_LEVEL;
  });

  it('writes one logfmt line with the error and where it happened', () => {
    const e = new Error('Request timed out');
    e.stack = 'Error: Request timed out\n    at chat (/var/task/node_modules/x/index.js:1:1)\n    at chat (/vercel/path0/src/lib/ai/client.ts:212:11)';
    const line = formatLine('error', 'analysis.failed', { analysis: 'ab12', stage: 'verdict', ms: 4123, error: e });
    expect(line).toBe('error analysis.failed analysis=ab12 stage=verdict ms=4123 err="Error: Request timed out" at=src/lib/ai/client.ts:212');
  });

  it('never writes reader content or secrets', () => {
    const line = formatLine('warn', 'x', { text: 'my private words', userQuery: 'abc', model: 'grok-4-7' });
    expect(line).toContain('text=[redacted]');
    expect(line).toContain('userQuery=[redacted]');
    expect(line).toContain('model=grok-4-7');
    // Built at runtime: a literal token-shaped string would trip secret scanners.
    const fakeBotToken = `${'1'.repeat(9)}:${'x'.repeat(35)}`;
    expect(scrub(`fetch https://api.telegram.org/bot${fakeBotToken}/send`)).not.toContain(fakeBotToken);
    expect(scrub('postgres://u:pw@ep-x.neon.tech/db failed')).toBe('postgres://[redacted] failed');
    expect(scrub('Authorization: Bearer abc.def')).toBe('Authorization: Bearer [redacted]');
    expect(scrub('from ana@example.org')).toBe('from [email]');
  });

  it('tags errors with their class and status', () => {
    const e = Object.assign(new Error('slow down'), { name: 'AiError', errorClass: 'rate_limit', status: 429 });
    expect(describeError(e).err).toBe('AiError(rate_limit/429): slow down');
  });

  it('holds back repeats for a minute, then says how many', () => {
    vi.useFakeTimers();
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    for (let i = 0; i < 5; i++) log.warn('search.failed', { engine: 'exa', error: new Error('HTTP 503') });
    expect(spy).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(61_000);
    log.warn('search.failed', { engine: 'exa', error: new Error('HTTP 503') });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1]![0]).toContain('repeated=4');
  });

  it('respects LOG_LEVEL', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    log.debug('cron.done', { job: 'health' });
    expect(debug).not.toHaveBeenCalled();
    process.env.LOG_LEVEL = 'debug';
    log.debug('cron.done', { job: 'health' });
    expect(debug).toHaveBeenCalledTimes(1);
  });

  it("reads Vercel's request id", () => {
    expect(requestId(new Headers({ 'x-vercel-id': 'fra1::iad1::abc-123' }))).toBe('abc-123');
  });
});
