/**
 * Versioned configuration store (TODO 10.24, 22.9). Postgres is the source of truth; the active
 * version is cached in memory for 10 s and, when Edge Config is configured, published there for
 * fast reads. In-flight analyses keep the version they started with (they receive it as an argument).
 */
import { desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { configVersions } from '../db/schema';
import { appConfigSchema, defaultConfig, type AppConfig } from './schema';
import { checkLineup } from './models';
import { audit } from '../admin/audit';

export type ActiveConfig = { id: number; config: AppConfig; activatedAt: Date | null };

let cache: { value: ActiveConfig; at: number } | null = null;
const TTL_MS = 10_000;

export function invalidateConfigCache() {
  cache = null;
}

export async function getActiveConfig(): Promise<ActiveConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const fromEdge = await readEdgeConfig();
  if (fromEdge) {
    cache = { value: fromEdge, at: Date.now() };
    return fromEdge;
  }
  const db = await getDb();
  const [row] = await db.select().from(configVersions).where(eq(configVersions.status, 'active')).orderBy(desc(configVersions.id)).limit(1);
  const value: ActiveConfig = row
    ? { id: row.id, config: appConfigSchema.parse(row.config), activatedAt: row.activatedAt }
    : { id: 0, config: defaultConfig(), activatedAt: null };
  cache = { value, at: Date.now() };
  return value;
}

export type SaveResult = { ok: true; id: number } | { ok: false; problems: string[] };

/** Validates, stores and activates a new configuration version, then publishes it. */
export async function activateConfig(next: AppConfig, opts: { reason: string; ipHash?: string; status?: 'active' | 'draft' }): Promise<SaveResult> {
  const parsed = appConfigSchema.safeParse(next);
  if (!parsed.success) return { ok: false, problems: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  const lineup = checkLineup(parsed.data);
  if (!lineup.ok) return { ok: false, problems: lineup.problems };
  if (!opts.reason.trim()) return { ok: false, problems: ['A reason is required for every change.'] };

  const db = await getDb();
  const before = await getActiveConfig();
  const status = opts.status ?? 'active';
  const id = await db.transaction(async (tx) => {
    if (status === 'active') await tx.update(configVersions).set({ status: 'retired' }).where(eq(configVersions.status, 'active'));
    const [row] = await tx
      .insert(configVersions)
      .values({ reason: opts.reason, config: parsed.data, status, activatedAt: status === 'active' ? new Date() : null })
      .returning({ id: configVersions.id });
    return row!.id;
  });
  await audit({ action: 'config.activate', target: `config:${id}`, before: before.config, after: parsed.data, reason: opts.reason, ipHash: opts.ipHash });
  invalidateConfigCache();
  if (status === 'active') await publishEdgeConfig({ id, config: parsed.data, activatedAt: new Date() });
  return { ok: true, id };
}

export async function listConfigVersions(limit = 50) {
  const db = await getDb();
  return db.select().from(configVersions).orderBy(desc(configVersions.id)).limit(limit);
}

/** One-step rollback to any earlier version (TODO 10.27): re-activates a copy of it. */
export async function rollbackTo(versionId: number, opts: { reason: string; ipHash?: string }): Promise<SaveResult> {
  const db = await getDb();
  const [row] = await db.select().from(configVersions).where(eq(configVersions.id, versionId));
  if (!row) return { ok: false, problems: [`Version ${versionId} not found.`] };
  return activateConfig(appConfigSchema.parse(row.config), { reason: `Rollback to v${versionId}: ${opts.reason}`, ipHash: opts.ipHash });
}

// ── Edge Config (optional) ────────────────────────────────────────────────────
const EDGE_KEY = 'activeConfig';

async function readEdgeConfig(): Promise<ActiveConfig | null> {
  if (!process.env.EDGE_CONFIG) return null;
  try {
    const { get } = await import('@vercel/edge-config');
    const raw = (await get(EDGE_KEY)) as { id: number; config: unknown; activatedAt: string } | undefined;
    if (!raw) return null;
    return { id: raw.id, config: appConfigSchema.parse(raw.config), activatedAt: new Date(raw.activatedAt) };
  } catch {
    return null;
  }
}

async function publishEdgeConfig(value: ActiveConfig) {
  const id = process.env.EDGE_CONFIG_ID;
  const token = process.env.VERCEL_API_TOKEN;
  if (!id || !token) return;
  const res = await fetch(`https://api.vercel.com/v1/edge-config/${id}/items`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ operation: 'upsert', key: EDGE_KEY, value: { ...value, activatedAt: value.activatedAt?.toISOString() } }] }),
  });
  if (!res.ok) console.error('Edge Config publish failed', res.status);
}
