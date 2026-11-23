/**
 * Search engines the investigation can use, and the order they are tried in. Pure and client-safe:
 * the admin console previews exactly what the server will do.
 */
import type { SearchConfig, SearchEngineId } from '../config/schema';

export type EngineKey = 'exa' | 'brave' | 'venice';
/** Whether a key is set and which environment variable holds it (sent from the server, never bundled). */
export type KeyStatus = { set: boolean; env: string };

export const ENGINES: Record<SearchEngineId, { name: string; key: EngineKey; zeroRetention: boolean; fullText: boolean; usdPer1k: number }> = {
  exa: { name: 'Exa', key: 'exa', zeroRetention: false, fullText: true, usdPer1k: 7 },
  brave: { name: 'Brave Search', key: 'brave', zeroRetention: false, fullText: false, usdPer1k: 5 },
  'venice-exa': { name: 'Exa via Venice', key: 'venice', zeroRetention: true, fullText: false, usdPer1k: 10 },
  'venice-brave': { name: 'Brave via Venice', key: 'venice', zeroRetention: true, fullText: false, usdPer1k: 10 },
};

/** Engines in the order they are tried: primary first, then backups; duplicates and engines without a key are skipped. */
export function planEngines(cfg: Pick<SearchConfig, 'primary' | 'fallbacks'>, keys: Record<EngineKey, boolean>): SearchEngineId[] {
  return [...new Set([cfg.primary, ...cfg.fallbacks])].filter((e) => keys[ENGINES[e].key]);
}

export const RESEARCH_DEPTH = {
  standard: { queries: 4, pagesRead: 4, perQuery: 5 },
  deep: { queries: 6, pagesRead: 8, perQuery: 6 },
} as const;

/** Exa's price for page text, per page returned. */
const EXA_TEXT_USD_PER_PAGE = 0.001;

/**
 * Search cost of the research step for one fresh analysis (planned queries plus the claim itself), for the
 * admin cost preview. The slots' own searches are part of the investigation estimate.
 */
export function estimateResearchCost(cfg: SearchConfig): number {
  const d = RESEARCH_DEPTH[cfg.depth];
  const searches = d.queries + 1;
  const engines = cfg.combine ? [cfg.primary, cfg.fallbacks.find((f) => f !== cfg.primary) ?? cfg.primary] : [cfg.primary];
  return engines.reduce((sum, e) => sum + searches * (ENGINES[e].usdPer1k / 1000 + (e === 'exa' ? d.perQuery * EXA_TEXT_USD_PER_PAGE : 0)), 0);
}
