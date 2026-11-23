import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../config/schema';
import { executeTool, type ToolContext } from './tools';

vi.mock('./snapshots', () => ({ saveSnapshot: async () => null }));

describe('investigation tools', () => {
  const queries: string[] = [];
  beforeEach(() => {
    queries.length = 0;
    process.env.EXA_API_KEY = 'test-exa';
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit = {}) => {
      const { query } = JSON.parse(String(init.body)) as { query: string };
      queries.push(query);
      return Response.json({ results: [{ title: query, url: `https://example.org/${encodeURIComponent(query)}`, highlights: ['h'] }] });
    });
  });
  afterEach(() => {
    delete process.env.EXA_API_KEY;
    vi.unstubAllGlobals();
  });

  const ctx = (maxWebSearches: number): ToolContext => ({
    pageCache: new Map([['https://www.ine.es/epa', { title: 'EPA', text: 'La tasa de paro bajó al 9,9%.', hash: 'h1' }]]),
    search: defaultConfig().search,
    counters: { web: 0, x: 0, scrape: 0, toolCalls: 0 },
    budget: { maxWebSearches, maxScrapes: 0 },
  });

  it('runs several phrasings in one call, within the search budget', async () => {
    const c = ctx(2);
    const out = await executeTool('search_web', JSON.stringify({ queries: ['paro EPA 2026', 'Spain unemployment 2026', 'paro mínimo histórico'] }), c);
    expect(queries).toEqual(['paro EPA 2026', 'Spain unemployment 2026']);
    expect(c.counters.web).toBe(2);
    expect(out).toContain('"queriesRun":2');
    expect(out).toContain('search budget');
    expect(await executeTool('search_web', JSON.stringify({ queries: ['more'] }), c)).toContain('Web search budget reached');
  });

  it('opens pages the research step already read at no budget cost', async () => {
    const c = ctx(0);
    const out = await executeTool('fetch_source', JSON.stringify({ url: 'https://www.ine.es/epa' }), c);
    expect(out).toContain('9,9%');
    expect(c.counters.scrape).toBe(0);
    expect(await executeTool('fetch_source', JSON.stringify({ url: 'https://elsewhere.example/page' }), c)).toContain('Page budget reached');
  });
});
