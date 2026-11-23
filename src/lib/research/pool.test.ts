import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultConfig } from '../config/schema';
import type { AtomicClaim } from '../domain/types';

const planned: { content: string; fail: boolean; userMessages: string[] } = { content: '', fail: false, userMessages: [] };
vi.mock('../ai/provider', () => ({
  callModel: async (opts: { request: { messages: { role: string; content: string }[] } }) => {
    planned.userMessages.push(opts.request.messages.find((m) => m.role === 'user')!.content);
    if (planned.fail) throw new Error('planner down');
    return { content: planned.content };
  },
}));
vi.mock('../ai/snapshots', () => ({ saveSnapshot: async () => 'hash-1' }));

const { bestPassage, buildEvidencePool, fallbackPlan, rankCandidates } = await import('./pool');

const RAW_USER_TEXT = 'Mi vecina Lucía García (lucia@example.com) dice que el paro está en mínimos de 15 años';
const claim: AtomicClaim = {
  id: 'c1',
  canonical: 'Unemployment in Spain is at its lowest level in 15 years.',
  localized: 'El paro en España está en su nivel más bajo en 15 años.',
  type: 'fact',
  checkable: true,
};

describe('deep research pool', () => {
  const searched: string[] = [];
  beforeEach(() => {
    searched.length = 0;
    planned.fail = false;
    planned.userMessages.length = 0;
    planned.content = JSON.stringify({
      queries: [
        { query: 'INE EPA tasa de paro tercer trimestre 2026', purpose: 'primary' },
        { query: 'Spain unemployment rate lowest since 2008', purpose: 'figure' },
        { query: 'paro mínimo 15 años verificación', purpose: 'factcheck' },
      ],
    });
    process.env.EXA_API_KEY = 'test-exa';
    vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
      if (!url.includes('api.exa.ai')) return new Response('not here', { status: 404 });
      const { query } = JSON.parse(String(init.body)) as { query: string };
      searched.push(query);
      return Response.json({
        results: [
          { title: 'EPA Q3 2026', url: 'https://www.ine.es/epa-q3', text: 'Introducción general. La tasa de paro bajó al 9,9% en el tercer trimestre de 2026, la más baja desde 2008. Otros datos.' },
          { title: 'Paper A', url: 'https://news.example.com/a', text: 'Some article text about unemployment.' },
          { title: 'Paper B', url: 'https://news.example.com/b?utm_source=x', text: 'Another article.' },
          { title: 'Paper C', url: 'https://news.example.com/c', text: 'A third article.' },
          { title: 'Post', url: 'https://x.com/someone/status/1', text: 'a post' },
        ],
      });
    });
  });
  afterEach(() => {
    delete process.env.EXA_API_KEY;
    vi.unstubAllGlobals();
  });

  it("plans several angles, searches only canonical text, never the user's words", async () => {
    const config = defaultConfig();
    const r = await buildEvidencePool(claim, config, undefined, { placeIds: ['ES'] });
    expect(r.queries.map((q) => q.query)).toContain(claim.canonical);
    expect(searched.length).toBe(4);
    for (const q of [...searched, ...planned.userMessages]) {
      expect(q).not.toContain('Lucía');
      expect(q).not.toContain('@example.com');
      expect(q).not.toBe(RAW_USER_TEXT);
    }
    expect(planned.userMessages[0]).toContain(claim.localized);
    expect(planned.userMessages[0]).toContain('INE (ine.es)');
  });

  it('puts primary sources first, reads them and quotes the passage that matters', async () => {
    const r = await buildEvidencePool(claim, defaultConfig(), undefined, { placeIds: ['ES'] });
    expect(r.pool[0]).toMatchObject({ url: 'https://www.ine.es/epa-q3', tier: 1, quoteVerified: true, contentHash: 'hash-1' });
    expect(r.pool[0]!.quote).toContain('9,9% en el tercer trimestre de 2026');
    expect(r.pages.has('https://www.ine.es/epa-q3')).toBe(true);
    expect(r.pool.filter((s) => s.url.includes('news.example.com'))).toHaveLength(2);
    expect(r.pool.find((s) => s.url.includes('x.com'))?.quoteVerified).toBe(false);
  });

  it('still researches several angles when the planner is down', async () => {
    planned.fail = true;
    const r = await buildEvidencePool(claim, defaultConfig(), undefined, { placeIds: [] });
    expect(r.queries).toEqual(fallbackPlan(claim));
    expect(searched).toContain(claim.localized);
    expect(r.pool.length).toBeGreaterThan(0);
  });

  it('picks the passage with the claim’s numbers and words', () => {
    const text = 'Weather was mild. Unemployment fell to 9.9% in 2026, the lowest in 15 years. Football results followed.';
    expect(bestPassage(text, [claim.canonical], 120)).toContain('9.9% in 2026');
  });

  it('keeps at most two results per domain', () => {
    const c = (url: string) => ({ title: url, url, snippet: '', engine: 'exa' as const, hits: 1, purposes: new Set<string>() });
    const out = rankCandidates([c('https://a.com/1'), c('https://a.com/2'), c('https://a.com/3'), c('https://b.com/1')]);
    expect(out.map((x) => x.url)).toEqual(['https://a.com/1', 'https://a.com/2', 'https://b.com/1']);
  });
});
