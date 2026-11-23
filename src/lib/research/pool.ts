/**
 * Deep research before the perspective models start (PRD 9.4, TODO 11.9): instead of one search, the shared
 * evidence pool is built by a small research loop.
 *
 *   1. Plan   - a model turns the claim into targeted queries (primary source, the exact figure, reporting,
 *               existing fact-checks, counter-evidence, the claim's own language).
 *   2. Search - every query runs across the configured search engines, in parallel.
 *   3. Rank   - primary sources first, results found by several queries rank higher, at most two per domain.
 *   4. Read   - the best pages are read (Exa returns the text; others are fetched) and archived, and the
 *               most relevant passage of each becomes its excerpt.
 *
 * Every slot then starts from the same pool, with pages it can open again at no budget cost. Only canonical,
 * PII-free text is ever searched: never the user's own words.
 */
import type { AppConfig } from '../config/schema';
import type { AtomicClaim, VerdictSource } from '../domain/types';
import { callModel } from '../ai/provider';
import { parseJson } from '../ai/json';
import { loadPrompt } from '../ai/prompts';
import { domainOf, inferTier } from '../ai/sources';
import { webSearch, urlKey, type SearchHit } from '../ai/search';
import { RESEARCH_DEPTH } from '../ai/search-engines';
import { fetchPage, type PageCache } from '../ai/tools';
import { saveSnapshot } from '../ai/snapshots';
import { PRIMARY_SOURCES } from '../data/outlets';
import { EU_MEMBERS } from '../data/places';
import { log } from '../log';

export type PlannedQuery = { query: string; purpose: string };

const PURPOSES = ['primary', 'figure', 'reporting', 'factcheck', 'counter', 'local'] as const;
const PLAN_SCHEMA = {
  name: 'research_plan',
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['queries'],
    properties: {
      queries: {
        type: 'array',
        items: { type: 'object', additionalProperties: false, required: ['query', 'purpose'], properties: { query: { type: 'string' }, purpose: { type: 'string', enum: [...PURPOSES] } } },
      },
    },
  },
};

/** Used when the planner is unavailable: still several angles, still only canonical text. */
export function fallbackPlan(claim: AtomicClaim): PlannedQuery[] {
  const q: PlannedQuery[] = [
    { query: claim.canonical, purpose: 'figure' },
    { query: `${claim.canonical} official data`, purpose: 'primary' },
    { query: `${claim.canonical} fact check`, purpose: 'factcheck' },
  ];
  if (claim.localized && claim.localized !== claim.canonical) q.splice(1, 0, { query: claim.localized, purpose: 'local' });
  return q;
}

export async function planQueries(claim: AtomicClaim, config: AppConfig, analysisId: string | undefined, placeIds: string[]): Promise<PlannedQuery[]> {
  const count = RESEARCH_DEPTH[config.search.depth].queries;
  const countries = placeIds.map((p) => p.split('-')[0]!);
  const hints = [...new Set(countries.flatMap((c) => [...(PRIMARY_SOURCES[c] ?? []), ...(EU_MEMBERS.has(c) ? PRIMARY_SOURCES.EU! : [])]).concat(PRIMARY_SOURCES.GLOBAL!))];
  try {
    const res = await callModel({
      step: 'research-plan',
      model: config.roles.reader,
      config,
      analysisId,
      request: {
        messages: [
          { role: 'system', content: loadPrompt('research-plan', 'en', { count }).text },
          {
            role: 'user',
            content: [
              `<claim>${claim.canonical}</claim>`,
              claim.localized && claim.localized !== claim.canonical ? `<claim_local>${claim.localized}</claim_local>` : '',
              `<places>${placeIds.join(', ') || 'GLOBAL'}</places>`,
              `<primary_sources>${hints.join('; ')}</primary_sources>`,
              `<today>${new Date().toISOString().slice(0, 10)}</today>`,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        ],
        responseSchema: PLAN_SCHEMA,
        temperature: 0,
      },
    });
    const seen = new Set<string>();
    const planned = parseJson<{ queries: PlannedQuery[] }>(res.content)
      .queries.map((q) => ({ query: String(q.query ?? '').trim().slice(0, 300), purpose: String(q.purpose ?? '') }))
      .filter((q) => q.query && !seen.has(q.query.toLowerCase()) && seen.add(q.query.toLowerCase()));
    // The claim itself is always searched too, so a weak plan never loses the obvious results.
    const withClaim = planned.some((q) => q.query.toLowerCase() === claim.canonical.toLowerCase()) ? planned : [{ query: claim.canonical, purpose: 'figure' }, ...planned];
    return withClaim.slice(0, count + 1);
  } catch (e) {
    log.warn('research.plan_failed', { error: e, fallback: 'claim-only plan' });
    return fallbackPlan(claim);
  }
}

const words = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .split(/[^\p{L}\p{N}%.,]+/u)
    .filter((w) => w.length > 3 || /\d/.test(w));

/** The page passage that best matches the claim, quoted verbatim (numbers count double). */
export function bestPassage(text: string, claimTexts: string[], max = 400): string {
  const terms = new Set(claimTexts.flatMap(words));
  if (!text.trim() || !terms.size) return text.slice(0, max).trim();
  const sentences = text.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);
  let best = { score: -1, start: 0 };
  for (let i = 0; i < sentences.length; i++) {
    let window = '';
    let score = 0;
    for (let j = i; j < sentences.length && window.length < max; j++) {
      window += (window ? ' ' : '') + sentences[j];
      for (const w of words(sentences[j]!)) if (terms.has(w)) score += /\d/.test(w) ? 2 : 1;
    }
    if (score > best.score) best = { score, start: i };
  }
  let out = '';
  for (let j = best.start; j < sentences.length && (out + sentences[j]).length <= max; j++) out += (out ? ' ' : '') + sentences[j];
  return (out || sentences[best.start]!.slice(0, max)).trim();
}

type Candidate = SearchHit & { hits: number; purposes: Set<string> };

/** Primary sources first; results several queries agree on rank higher; at most two per domain. */
export function rankCandidates(cands: Candidate[]): Candidate[] {
  const tierWeight = { 1: 3, 2: 2, 3: 1, 4: 0 } as const;
  const scored = cands
    .map((c) => ({ c, score: tierWeight[inferTier(c.url)] + (c.hits - 1) * 0.6 + (c.text ? 0.3 : 0) + (c.purposes.has('primary') ? 0.4 : 0) }))
    .sort((a, b) => b.score - a.score);
  const perDomain = new Map<string, number>();
  const out: Candidate[] = [];
  for (const { c } of scored) {
    const d = domainOf(c.url);
    if ((perDomain.get(d) ?? 0) >= 2) continue;
    perDomain.set(d, (perDomain.get(d) ?? 0) + 1);
    out.push(c);
  }
  return out;
}

const withTimeout = <T>(p: Promise<T>, ms: number) => Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

export type ResearchResult = { pool: VerdictSource[]; pages: PageCache; queries: PlannedQuery[] };

export async function buildEvidencePool(claim: AtomicClaim, config: AppConfig, analysisId: string | undefined, ctx: { placeIds: string[] }): Promise<ResearchResult> {
  const depth = RESEARCH_DEPTH[config.search.depth];
  const pages: PageCache = new Map();
  const queries = await planQueries(claim, config, analysisId, ctx.placeIds);

  // Search every planned query across the configured engines.
  const byUrl = new Map<string, Candidate>();
  await Promise.all(
    queries.map(async (q) => {
      const hits = await webSearch(q.query, config.search, { limit: depth.perQuery, read: true }).catch(() => [] as SearchHit[]);
      for (const h of hits) {
        const key = urlKey(h.url);
        const prev = byUrl.get(key);
        if (prev) {
          prev.hits++;
          prev.purposes.add(q.purpose);
          if (!prev.text && h.text) prev.text = h.text;
        } else byUrl.set(key, { ...h, hits: 1, purposes: new Set([q.purpose]) });
      }
    }),
  );
  const ranked = rankCandidates([...byUrl.values()]);

  // Read the best non-social pages, and keep the passage that matters.
  const claimTexts = [claim.canonical, claim.localized ?? ''];
  const toRead = ranked.filter((c) => inferTier(c.url) < 4).slice(0, depth.pagesRead);
  const read = new Map<string, { excerpt: string; hash: string | null }>();
  await Promise.all(
    toRead.map(async (c) => {
      try {
        let title = c.title;
        let text = c.text ?? '';
        let hash: string | null = null;
        if (text) {
          hash = await saveSnapshot(c.url, title, text).catch(() => null);
          pages.set(c.url, { title, text, hash });
        } else {
          const page = await withTimeout(fetchPage(pages, c.url), 12_000);
          title = page.title || title;
          text = page.text;
          hash = pages.get(c.url)?.hash ?? null;
        }
        if (text.trim()) read.set(c.url, { excerpt: bestPassage(text, claimTexts), hash });
      } catch (e) {
        log.debug('research.page_unreadable', { url: c.url, error: e });
        /* unreadable page: it stays in the pool with its search snippet */
      }
    }),
  );

  const pool: VerdictSource[] = ranked.slice(0, 12).map((c) => {
    const r = read.get(c.url);
    return {
      url: c.url,
      title: c.title,
      tier: inferTier(c.url),
      stance: 'context',
      quote: (r?.excerpt || c.snippet).slice(0, 400),
      quoteVerified: Boolean(r?.excerpt),
      origin: 'pool',
      publishedAt: c.date,
      contentHash: r?.hash ?? undefined,
    };
  });
  return { pool, pages, queries };
}
