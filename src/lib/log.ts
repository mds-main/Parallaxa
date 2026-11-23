/**
 * Server logging: one line per event, in logfmt, so Vercel's log search finds them by any field
 * (`event=analysis.failed`, `analysis=9f3c…`, `model=grok-4-7`).
 *
 *   error  analysis.failed analysis=9f3c2a stage=verdict ms=41234 err="AiError(timeout): Request timed out" at=src/lib/ai/client.ts:212
 *
 * - Levels map to console.error / warn / info / debug, which Vercel shows as error / warning / info / debug.
 *   `LOG_LEVEL` (debug | info | warn | error, default info) sets the threshold.
 * - No spam: the same event with the same error is written once per minute per instance; the next line says
 *   how many were held back (`repeated=12`).
 * - No personal data (PRD rule): fields whose names suggest user content or secrets are replaced with
 *   `[redacted]`, tokens, bearer headers, database URLs and email addresses are scrubbed from every value,
 *   and long values are cut. Log events and ids, never what a reader wrote.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, unknown>;

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const DEDUPE_MS = 60_000;
const MAX_VALUE = 300;

/** Field names that could carry what a reader wrote, or a secret. */
const SENSITIVE_KEY = /(text|prompt|content|claim|claims|query|queries|message|messages|email|password|secret|token|cookie|authorization|body|input|answer)$/i;
const SAFE_KEYS = new Set(['err', 'event', 'level', 'at', 'repeated']);

const SCRUBBERS: [RegExp, string][] = [
  [/bot\d{5,}:[A-Za-z0-9_-]{20,}/g, 'bot[redacted]'],
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [redacted]'],
  [/\b(postgres(ql)?|redis|mysql):\/\/[^\s"']+/gi, '$1://[redacted]'],
  [/\b(sk|pk|vck|key|whsec)[-_][A-Za-z0-9_-]{12,}/g, '[redacted-key]'],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email]'],
  [/([?&](token|key|secret|signature|sig|code)=)[^&\s"']+/gi, '$1[redacted]'],
];

export function scrub(value: string): string {
  let out = value;
  for (const [re, by] of SCRUBBERS) out = out.replace(re, by);
  return out.length > MAX_VALUE ? `${out.slice(0, MAX_VALUE)}…` : out;
}

/** `Name(class/status): message` plus the first frame in our own code. */
export function describeError(e: unknown): { err: string; at?: string } {
  if (!(e instanceof Error)) return { err: scrub(String(e)) };
  const extra = e as Error & { errorClass?: string; status?: number; code?: string; digest?: string };
  const tags = [extra.errorClass, extra.status, extra.code].filter((x) => x !== undefined && x !== '').join('/');
  const err = scrub(`${e.name}${tags ? `(${tags})` : ''}: ${e.message}`);
  const frame = e.stack
    ?.split('\n')
    .slice(1)
    .map((l) => l.trim())
    .find((l) => /src\//.test(l) && !/node_modules/.test(l));
  const at = frame?.match(/(src\/[^\s)]+?:\d+)(:\d+)?\)?$/)?.[1];
  return at ? { err, at } : { err };
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '-';
  if (v instanceof Date) return v.toISOString();
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  const clean = scrub(s);
  return /^[\w.:/@+\[\]-]+$/.test(clean) ? clean : JSON.stringify(clean);
}

export function formatLine(level: LogLevel, event: string, fields: LogFields = {}): string {
  const parts = [level.padEnd(5), event];
  for (const [k, raw] of Object.entries(fields)) {
    if (raw === undefined) continue;
    if (k === 'error') {
      const d = describeError(raw);
      parts.push(`err=${formatValue(d.err)}`);
      if (d.at) parts.push(`at=${d.at}`);
      continue;
    }
    const value = !SAFE_KEYS.has(k) && SENSITIVE_KEY.test(k) ? '[redacted]' : raw;
    parts.push(`${k}=${formatValue(value)}`);
  }
  return parts.join(' ');
}

function threshold(): number {
  const v = (process.env.LOG_LEVEL ?? '').trim().toLowerCase() as LogLevel;
  return ORDER[v] ?? ORDER.info;
}

const recent = new Map<string, { at: number; held: number }>();

/** True when the line should be written now; `held` is how many identical lines were skipped before it. */
function admit(key: string, now: number): { write: boolean; held: number } {
  const seen = recent.get(key);
  if (seen && now - seen.at < DEDUPE_MS) {
    seen.held++;
    return { write: false, held: 0 };
  }
  const held = seen?.held ?? 0;
  recent.set(key, { at: now, held: 0 });
  if (recent.size > 500) for (const [k, v] of recent) if (now - v.at >= DEDUPE_MS) recent.delete(k);
  return { write: true, held };
}

const SINK: Record<LogLevel, (line: string) => void> = {
  debug: (l) => console.debug(l),
  info: (l) => console.info(l),
  warn: (l) => console.warn(l),
  error: (l) => console.error(l),
};

function emit(level: LogLevel, event: string, fields: LogFields = {}) {
  if (ORDER[level] < threshold()) return;
  // Repeats are keyed by event, level and error text (or an explicit `dedupe` field), not by ids or timings.
  const { dedupe, ...rest } = fields;
  const errKey = rest.error ? describeError(rest.error).err : '';
  const { write, held } = admit(`${level}|${event}|${dedupe ?? errKey}`, Date.now());
  if (!write) return;
  SINK[level](formatLine(level, event, held ? { ...rest, repeated: held } : rest));
}

export const log = {
  debug: (event: string, fields?: LogFields) => emit('debug', event, fields),
  info: (event: string, fields?: LogFields) => emit('info', event, fields),
  warn: (event: string, fields?: LogFields) => emit('warn', event, fields),
  error: (event: string, fields?: LogFields) => emit('error', event, fields),
};

/** Vercel's id for the request (shown in the dashboard's request details), to tie log lines to one request. */
export function requestId(headers: Headers | Record<string, string | string[] | undefined>): string | undefined {
  const raw = headers instanceof Headers ? headers.get('x-vercel-id') : headers['x-vercel-id'];
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v ? v.split('::').pop() : undefined;
}

/** For tests. */
export function resetLogState() {
  recent.clear();
}
