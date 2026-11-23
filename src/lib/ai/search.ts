/**
 * Web search for investigations, across interchangeable engines (Admin › Investigation › Search engines).
 * Engines are tried in the configured order; an engine that fails or finds nothing hands over to the next.
 * With `combine`, the first two engines run together and their results are merged.
 *
 * Queries sent here are always model-written or canonical, PII-free claims: never the user's own words.
 */
import type { SearchConfig, SearchEngineId } from '../config/schema';
import { ENGINES, planEngines, type EngineKey, type KeyStatus } from './search-engines';

export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  /** Page text when the engine returns it (Exa with `read`), so the page needs no separate fetch. */
  text?: string;
  engine: SearchEngineId;
};

export type SearchOptions = {
  limit?: number;
  /** Ask engines that can for page text as well (used by the research step). */
  read?: boolean;
  timeoutMs?: number;
};

const ENGINE_ENV: Record<EngineKey, string> = { exa: 'EXA_API_KEY', brave: 'BRAVE_SEARCH_API_KEY', venice: 'VENICE_API_KEY' };

export function engineKeys(): Record<EngineKey, boolean> {
  return { exa: Boolean(process.env[ENGINE_ENV.exa]), brave: Boolean(process.env[ENGINE_ENV.brave]), venice: Boolean(process.env[ENGINE_ENV.venice]) };
}

/** For the admin console: whether each key is set and its variable name. Never the value. */
export function engineKeyStatus(): Record<EngineKey, KeyStatus> {
  const set = engineKeys();
  return { exa: { set: set.exa, env: ENGINE_ENV.exa }, brave: { set: set.brave, env: ENGINE_ENV.brave }, venice: { set: set.venice, env: ENGINE_ENV.venice } };
}

async function exa(query: string, o: SearchOptions): Promise<SearchHit[]> {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'x-api-key': process.env.EXA_API_KEY!, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      query,
      numResults: o.limit ?? 8,
      type: 'auto',
      // Exa bills per page and content type: page text when reading, short highlights otherwise.
      contents: o.read ? { text: { maxCharacters: 12_000 } } : { highlights: { maxCharacters: 600 } },
    }),
    signal: AbortSignal.timeout(o.timeoutMs ?? 10_000),
  });
  if (!res.ok) throw new Error(`Exa ${res.status}`);
  const j = (await res.json()) as { results?: { title?: string; url: string; publishedDate?: string; text?: string; highlights?: string[] }[] };
  return (j.results ?? []).map((r) => ({
    title: r.title || r.url,
    url: r.url,
    snippet: (r.highlights?.join(' … ') || r.text || '').slice(0, 600),
    date: r.publishedDate || undefined,
    text: o.read && r.text ? r.text : undefined,
    engine: 'exa' as const,
  }));
}

async function brave(query: string, o: SearchOptions): Promise<SearchHit[]> {
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${Math.min(o.limit ?? 8, 20)}`, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY! },
    signal: AbortSignal.timeout(o.timeoutMs ?? 10_000),
  });
  if (!res.ok) throw new Error(`Brave ${res.status}`);
  const j = (await res.json()) as { web?: { results?: { title: string; url: string; description: string; age?: string; page_age?: string }[] } };
  return (j.web?.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.description, date: r.page_age ?? r.age, engine: 'brave' as const }));
}

async function venice(provider: 'exa' | 'brave', engine: SearchEngineId, query: string, o: SearchOptions): Promise<SearchHit[]> {
  const res = await fetch('https://api.venice.ai/api/v1/augment/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.VENICE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query.slice(0, 400), limit: Math.min(o.limit ?? 8, 20), search_provider: provider }),
    signal: AbortSignal.timeout(o.timeoutMs ?? 12_000),
  });
  if (!res.ok) throw new Error(`Venice search (${provider}) ${res.status}`);
  const j = (await res.json()) as { results?: { title: string; url: string; content: string; date?: string }[] };
  return (j.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: (r.content ?? '').slice(0, 600), date: r.date || undefined, engine }));
}

export function runEngine(engine: SearchEngineId, query: string, o: SearchOptions = {}): Promise<SearchHit[]> {
  switch (engine) {
    case 'exa':
      return exa(query, o);
    case 'brave':
      return brave(query, o);
    case 'venice-exa':
      return venice('exa', engine, query, o);
    case 'venice-brave':
      return venice('brave', engine, query, o);
  }
}

/** Same page, different URL dressing (scheme, www, trailing slash, tracking parameters, fragment). */
export function urlKey(url: string): string {
  try {
    const u = new URL(url);
    for (const p of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$)/i.test(p)) u.searchParams.delete(p);
    const q = u.searchParams.toString();
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}${q ? `?${q}` : ''}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Interleaves result lists by rank and drops duplicates, so no single engine's ranking dominates. */
export function mergeHits(lists: SearchHit[][], limit: number): SearchHit[] {
  const seen = new Map<string, SearchHit>();
  const longest = Math.max(0, ...lists.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const hit = list[i];
      if (!hit) continue;
      const key = urlKey(hit.url);
      const prev = seen.get(key);
      if (!prev) seen.set(key, hit);
      else if (!prev.text && hit.text) seen.set(key, { ...prev, text: hit.text, date: prev.date ?? hit.date });
    }
  }
  return [...seen.values()].slice(0, limit);
}

/**
 * One web search through the configured engines. Throws only when every engine failed;
 * an empty array means the engines worked but found nothing.
 */
export async function webSearch(query: string, cfg: SearchConfig, o: SearchOptions = {}, keys = engineKeys()): Promise<SearchHit[]> {
  const order = planEngines(cfg, keys);
  const limit = o.limit ?? 8;
  let lastError: unknown = null;
  let anyWorked = false;
  let rest = order;
  if (cfg.combine && order.length >= 2) {
    const settled = await Promise.allSettled(order.slice(0, 2).map((e) => runEngine(e, query, o)));
    const ok = settled.filter((s): s is PromiseFulfilledResult<SearchHit[]> => s.status === 'fulfilled').map((s) => s.value);
    const merged = mergeHits(ok, limit);
    if (merged.length) return merged;
    anyWorked = ok.length > 0;
    lastError = settled.find((s) => s.status === 'rejected')?.reason ?? null;
    rest = order.slice(2);
  }
  for (const engine of rest) {
    try {
      const hits = await runEngine(engine, query, o);
      anyWorked = true;
      if (hits.length) return hits.slice(0, limit);
    } catch (e) {
      lastError = e;
    }
  }
  if (!anyWorked && lastError) throw lastError instanceof Error ? lastError : new Error(String(lastError));
  return [];
}

export { ENGINES };
