import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDb, resetDbForTests } from '../db/client';
import { modelCatalog } from '../db/schema';
import { resetCatalogMemoryForTests, syncCatalog } from './catalog';

const sampleModels = (priceA = 0.5, extra = false) => ({
  data: [
    {
      id: 'model-a',
      context_length: 131072,
      model_spec: {
        name: 'Model A',
        privacy: 'private',
        offline: false,
        capabilities: { supportsFunctionCalling: true, supportsResponseSchema: true, supportsWebSearch: true, reasoningEffortOptions: ['low', 'high'] },
        pricing: { input: { usd: priceA }, output: { usd: 1.5 } },
      },
    },
    {
      id: 'model-b',
      context_length: 200000,
      model_spec: {
        name: 'Model B',
        privacy: 'anonymized',
        offline: false,
        capabilities: { supportsFunctionCalling: true, supportsResponseSchema: true, supportsWebSearch: true, supportsXSearch: true },
        pricing: { input: { usd: 2 }, output: { usd: 6 }, cache_input: { usd: 0.5 } },
      },
    },
    ...(extra
      ? [
          {
            id: 'model-c',
            context_length: 128000,
            model_spec: {
              name: 'Model C',
              privacy: 'private',
              offline: false,
              capabilities: { supportsFunctionCalling: true, supportsResponseSchema: true, supportsWebSearch: false },
              pricing: { input: { usd: 0.2 }, output: { usd: 0.6 } },
            },
          },
        ]
      : []),
  ],
});

describe('catalog sync diffing and batched upsert', () => {
  beforeEach(() => {
    resetDbForTests();
    resetCatalogMemoryForTests();
    process.env.VENICE_CATALOG_LIVE = '1';
  });

  afterEach(() => {
    delete process.env.VENICE_CATALOG_LIVE;
    resetCatalogMemoryForTests();
    vi.unstubAllGlobals();
  });

  it('skips DB writes when catalog is unchanged and batches only changed/new models', async () => {
    let payload = sampleModels(0.5, false);
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify(payload), { status: 200 }));

    // 1. Initial sync writes both models.
    const r1 = await syncCatalog();
    expect(r1).toEqual({ count: 2, changed: [] });
    const db = await getDb();
    const before = new Map((await db.select().from(modelCatalog)).map((r) => [r.id, r.fetchedAt.getTime()]));
    expect(before.size).toBe(2);

    // Wait briefly so any unnecessary write would get a strictly newer fetchedAt timestamp.
    await new Promise((r) => setTimeout(r, 20));

    // 2. Identical sync performs zero DB writes (even after Postgres jsonb key normalization).
    const r2 = await syncCatalog();
    expect(r2).toEqual({ count: 2, changed: [] });
    const afterNoop = new Map((await db.select().from(modelCatalog)).map((r) => [r.id, r.fetchedAt.getTime()]));
    expect(afterNoop.get('model-a')).toBe(before.get('model-a'));
    expect(afterNoop.get('model-b')).toBe(before.get('model-b'));

    await new Promise((r) => setTimeout(r, 20));

    // 3. Reprice model-a and add model-c: only model-a and model-c are written; model-b stays untouched.
    payload = sampleModels(0.75, true);
    const r3 = await syncCatalog();
    expect(r3).toEqual({ count: 3, changed: ['model-a'] });
    const afterUpdate = new Map((await db.select().from(modelCatalog)).map((r) => [r.id, r.fetchedAt.getTime()]));
    expect(afterUpdate.size).toBe(3);
    expect(afterUpdate.get('model-a')).toBeGreaterThan(before.get('model-a')!);
    expect(afterUpdate.get('model-b')).toBe(before.get('model-b'));
    expect(afterUpdate.get('model-c')).toBeDefined();
  });
});
