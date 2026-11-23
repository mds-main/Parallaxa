import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultConfig, type SearchConfig } from '../config/schema';
import { estimateResearchCost, planEngines } from './search-engines';
import { mergeHits, urlKey, webSearch, type SearchHit } from './search';

type Call = { engine: string; body?: Record<string, unknown>; headers: Record<string, string> };

describe('search engines', () => {
  const calls: Call[] = [];
  let behaviour: Record<string, 'ok' | 'empty' | 'fail'> = {};
  const all = { exa: true, brave: true, venice: true };

  beforeEach(() => {
    calls.length = 0;
    behaviour = {};
    process.env.EXA_API_KEY = 'test-exa';
    process.env.BRAVE_SEARCH_API_KEY = 'test-brave';
    process.env.VENICE_API_KEY = 'test-venice';
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      const body = init.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
      const engine = url.includes('api.exa.ai') ? 'exa' : url.includes('search.brave.com') ? 'brave' : `venice-${body?.search_provider}`;
      calls.push({ engine, body, headers: (init.headers ?? {}) as Record<string, string> });
      const mode = behaviour[engine] ?? 'ok';
      if (mode === 'fail') return new Response('down', { status: 503 });
      const n = mode === 'empty' ? 0 : 2;
      const urls = Array.from({ length: n }, (_, i) => `https://example.org/${engine}/${i}`);
      if (engine === 'exa') return Response.json({ results: urls.map((u) => ({ title: u, url: u, publishedDate: '2026-11-01', text: `full text of ${u}`, highlights: ['a highlight'] })) });
      if (engine === 'brave') return Response.json({ web: { results: urls.map((u) => ({ title: u, url: u, description: 'brave snippet' })) } });
      return Response.json({ results: urls.map((u) => ({ title: u, url: u, content: 'venice content', date: '' })) });
    });
  });
  afterEach(() => {
    delete process.env.EXA_API_KEY;
    delete process.env.BRAVE_SEARCH_API_KEY;
    delete process.env.VENICE_API_KEY;
    vi.unstubAllGlobals();
  });

  const cfg = (patch: Partial<SearchConfig> = {}): SearchConfig => ({ ...defaultConfig().search, ...patch });

  it('defaults to Exa first with Brave, then Venice, as backups, skipping engines without a key', () => {
    expect(defaultConfig().search).toEqual({ primary: 'exa', fallbacks: ['brave', 'venice-exa', 'venice-brave'], combine: false, depth: 'deep' });
    expect(planEngines(cfg(), all)).toEqual(['exa', 'brave', 'venice-exa', 'venice-brave']);
    expect(planEngines(cfg(), { exa: false, brave: true, venice: false })).toEqual(['brave']);
    expect(planEngines(cfg({ primary: 'brave', fallbacks: ['brave', 'exa'] }), all)).toEqual(['brave', 'exa']);
  });

  it('uses only the primary when it works, and asks Exa for page text when reading', async () => {
    const hits = await webSearch('unemployment Spain 2026', cfg(), { read: true }, all);
    expect(calls.map((c) => c.engine)).toEqual(['exa']);
    expect(calls[0]!.headers['x-api-key']).toBe('test-exa');
    expect(calls[0]!.body).toMatchObject({ query: 'unemployment Spain 2026', type: 'auto', contents: { text: { maxCharacters: 12000 } } });
    expect(hits[0]).toMatchObject({ engine: 'exa', text: 'full text of https://example.org/exa/0', date: '2026-11-01' });
  });

  it('falls back in order when the primary fails or finds nothing', async () => {
    behaviour = { exa: 'fail' };
    expect((await webSearch('q', cfg(), {}, all))[0]!.engine).toBe('brave');
    calls.length = 0;
    behaviour = { exa: 'empty', brave: 'fail' };
    const hits = await webSearch('q', cfg(), {}, all);
    expect(calls.map((c) => c.engine)).toEqual(['exa', 'brave', 'venice-exa']);
    expect(hits[0]!.engine).toBe('venice-exa');
  });

  it('can switch to Brave first with Exa as backup at any time', async () => {
    const switched = cfg({ primary: 'brave', fallbacks: ['exa'] });
    behaviour = { brave: 'fail' };
    const hits = await webSearch('q', switched, {}, all);
    expect(calls.map((c) => c.engine)).toEqual(['brave', 'exa']);
    expect(hits[0]!.engine).toBe('exa');
  });

  it('combines two engines into one interleaved, de-duplicated list', async () => {
    const hits = await webSearch('q', cfg({ combine: true }), { limit: 10 }, all);
    expect(new Set(calls.map((c) => c.engine))).toEqual(new Set(['exa', 'brave']));
    expect(hits.map((h) => h.engine)).toEqual(['exa', 'brave', 'exa', 'brave']);
  });

  it('only throws when no engine worked; an empty answer is not an error', async () => {
    behaviour = { exa: 'fail', brave: 'fail', 'venice-exa': 'fail', 'venice-brave': 'fail' };
    await expect(webSearch('q', cfg(), {}, all)).rejects.toThrow();
    behaviour = { exa: 'empty', brave: 'empty', 'venice-exa': 'empty', 'venice-brave': 'empty' };
    expect(await webSearch('q', cfg(), {}, all)).toEqual([]);
    expect(await webSearch('q', cfg(), {}, { exa: false, brave: false, venice: false })).toEqual([]);
  });

  it('prices the research step so the admin preview shows what engine and depth choices cost', () => {
    // Deep: 7 searches on Exa at $7/1k plus 6 pages of text each at $1/1k.
    expect(estimateResearchCost(cfg())).toBeCloseTo(7 * (0.007 + 0.006), 6);
    expect(estimateResearchCost(cfg({ primary: 'venice-exa', depth: 'standard' }))).toBeCloseTo(5 * 0.01, 6);
    expect(estimateResearchCost(cfg({ combine: true }))).toBeGreaterThan(estimateResearchCost(cfg()));
  });

  it('sends the chosen provider to Venice search', async () => {
    await webSearch('q', cfg({ primary: 'venice-exa', fallbacks: [] }), {}, all);
    expect(calls[0]!.body).toMatchObject({ search_provider: 'exa', limit: 8 });
  });

  it('treats tracking parameters, www and trailing slashes as the same page', () => {
    expect(urlKey('https://www.ine.es/prensa/epa.pdf/?utm_source=x#top')).toBe(urlKey('http://ine.es/prensa/epa.pdf'));
    const a: SearchHit = { title: 'A', url: 'https://www.ine.es/x/?utm_medium=y', snippet: '', engine: 'brave' };
    const b: SearchHit = { title: 'B', url: 'https://ine.es/x', snippet: '', text: 'page', engine: 'exa' };
    expect(mergeHits([[a], [b]], 5)).toEqual([{ ...a, text: 'page' }]);
  });
});
