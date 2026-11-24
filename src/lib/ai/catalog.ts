/** Venice model catalog sync (TODO 10.2): capabilities, privacy, status and prices, synced every 2 hours. */
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { modelCatalog } from '../db/schema';
import type { CatalogModel } from '../config/models';
import { DEMO_CATALOG } from './demo-catalog';
import { isDemoMode } from './client';
import { log } from '../log';

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

/** Key-order-independent comparison (Postgres jsonb reorders object keys). */
export function sameCatalogModel(a: CatalogModel, b: CatalogModel): boolean {
  const aEffort = a.capabilities?.reasoningEffortOptions ?? [];
  const bEffort = b.capabilities?.reasoningEffortOptions ?? [];
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.privacy === b.privacy &&
    a.offline === b.offline &&
    a.deprecated === b.deprecated &&
    a.contextLength === b.contextLength &&
    Boolean(a.capabilities?.functionCalling) === Boolean(b.capabilities?.functionCalling) &&
    Boolean(a.capabilities?.responseSchema) === Boolean(b.capabilities?.responseSchema) &&
    Boolean(a.capabilities?.webSearch) === Boolean(b.capabilities?.webSearch) &&
    Boolean(a.capabilities?.xSearch) === Boolean(b.capabilities?.xSearch) &&
    aEffort.length === bEffort.length &&
    aEffort.every((v, i) => v === bEffort[i]) &&
    a.pricing?.inputUsdPerM === b.pricing?.inputUsdPerM &&
    a.pricing?.outputUsdPerM === b.pricing?.outputUsdPerM &&
    (a.pricing?.cacheInputUsdPerM ?? null) === (b.pricing?.cacheInputUsdPerM ?? null)
  );
}

/** Tests only: clear the in-memory catalog cache. */
export function resetCatalogMemoryForTests() {
  memory = null;
}

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
  const toUpsert: CatalogModel[] = [];
  for (const m of models) {
    const prev = previous.get(m.id);
    if (prev && (prev.offline !== m.offline || prev.deprecated !== m.deprecated || prev.pricing.inputUsdPerM !== m.pricing.inputUsdPerM || prev.pricing.outputUsdPerM !== m.pricing.outputUsdPerM)) {
      changed.push(m.id);
    }
    if (!prev || !sameCatalogModel(prev, m)) {
      toUpsert.push(m);
    }
  }
  if (toUpsert.length) {
    const now = new Date();
    await db
      .insert(modelCatalog)
      .values(toUpsert.map((m) => ({ id: m.id, data: m as unknown as Record<string, unknown>, fetchedAt: now })))
      .onConflictDoUpdate({
        target: modelCatalog.id,
        set: { data: sql`excluded.data`, fetchedAt: sql`excluded.fetched_at` },
      });
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
    return memory.models;
  }
  try {
    await syncCatalog();
  } catch (e) {
    log.error('catalog.sync_failed', { error: e, fallback: 'demo catalog' });
    memory = { models: DEMO_CATALOG, at: Date.now() };
  }
  return memory!.models;
}

export async function getModel(id: string): Promise<CatalogModel | undefined> {
  return (await getCatalog()).find((m) => m.id === id);
}
