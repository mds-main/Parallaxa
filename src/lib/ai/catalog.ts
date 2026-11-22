/** Venice model catalog sync (TODO 10.2): capabilities, privacy, status and prices, refreshed every 15 minutes. */
import { getDb } from '../db/client';
import { modelCatalog } from '../db/schema';
import type { CatalogModel } from '../config/models';
import { DEMO_CATALOG } from './demo-catalog';
import { isDemoMode } from './client';

type VeniceModel = {
  id: string;
  context_length?: number;
  model_spec?: {
    name?: string;
    privacy?: 'private' | 'anonymized';
    offline?: boolean;
    deprecation?: unknown;
    availableContextTokens?: number;
    capabilities?: {
      supportsFunctionCalling?: boolean;
      supportsResponseSchema?: boolean;
      supportsWebSearch?: boolean;
      supportsXSearch?: boolean;
      reasoningEffortOptions?: string[];
    };
    pricing?: { input?: { usd?: number }; output?: { usd?: number }; cache_input?: { usd?: number } };
  };
};

export function normalizeModel(m: VeniceModel): CatalogModel {
  const s = m.model_spec ?? {};
  const c = s.capabilities ?? {};
  return {
    id: m.id,
    name: s.name ?? m.id,
    privacy: s.privacy ?? 'anonymized',
    offline: Boolean(s.offline),
    deprecated: Boolean(s.deprecation),
    contextLength: m.context_length ?? s.availableContextTokens ?? 0,
    capabilities: {
      functionCalling: Boolean(c.supportsFunctionCalling),
      responseSchema: Boolean(c.supportsResponseSchema),
      webSearch: Boolean(c.supportsWebSearch),
      xSearch: Boolean(c.supportsXSearch),
      reasoningEffortOptions: c.reasoningEffortOptions ?? [],
    },
    pricing: {
      inputUsdPerM: s.pricing?.input?.usd ?? 0,
      outputUsdPerM: s.pricing?.output?.usd ?? 0,
      cacheInputUsdPerM: s.pricing?.cache_input?.usd,
    },
  };
}

let memory: { models: CatalogModel[]; at: number } | null = null;
const TTL = 15 * 60_000;

/** Fetches the live catalog (public endpoint; the API key tailors it to the account when present). */
export async function syncCatalog(): Promise<{ count: number; changed: string[] }> {
  if (isDemoMode() && !process.env.VENICE_CATALOG_LIVE) {
    memory = { models: DEMO_CATALOG, at: Date.now() };
    return { count: DEMO_CATALOG.length, changed: [] };
  }
  const res = await fetch('https://api.venice.ai/api/v1/models?type=text', {
    headers: process.env.VENICE_API_KEY ? { Authorization: `Bearer ${process.env.VENICE_API_KEY}` } : {},
  });
  if (!res.ok) throw new Error(`Venice catalog ${res.status}`);
  const json = (await res.json()) as { data: VeniceModel[] };
  const models = json.data.map(normalizeModel);
  const db = await getDb();
  const previous = new Map((await db.select().from(modelCatalog)).map((r) => [r.id, r.data as unknown as CatalogModel]));
  const changed: string[] = [];
  for (const m of models) {
    const prev = previous.get(m.id);
    if (prev && (prev.offline !== m.offline || prev.deprecated !== m.deprecated || prev.pricing.inputUsdPerM !== m.pricing.inputUsdPerM || prev.pricing.outputUsdPerM !== m.pricing.outputUsdPerM)) {
      changed.push(m.id);
    }
    await db
      .insert(modelCatalog)
      .values({ id: m.id, data: m as unknown as Record<string, unknown>, fetchedAt: new Date() })
      .onConflictDoUpdate({ target: modelCatalog.id, set: { data: m as unknown as Record<string, unknown>, fetchedAt: new Date() } });
  }
  memory = { models, at: Date.now() };
  return { count: models.length, changed };
}

export async function getCatalog(): Promise<CatalogModel[]> {
  if (memory && Date.now() - memory.at < TTL) return memory.models;
  if (isDemoMode() && !process.env.VENICE_CATALOG_LIVE) {
    memory = { models: DEMO_CATALOG, at: Date.now() };
    return DEMO_CATALOG;
  }
  const db = await getDb();
  const rows = await db.select().from(modelCatalog);
  if (rows.length) {
    memory = { models: rows.map((r) => r.data as unknown as CatalogModel), at: Date.now() };
    const stale = rows.every((r) => Date.now() - r.fetchedAt.getTime() > TTL);
    if (stale) syncCatalog().catch(() => undefined);
    return memory.models;
  }
  try {
    await syncCatalog();
  } catch {
    memory = { models: DEMO_CATALOG, at: Date.now() };
  }
  return memory!.models;
}

export async function getModel(id: string): Promise<CatalogModel | undefined> {
  return (await getCatalog()).find((m) => m.id === id);
}
