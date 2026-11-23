/**
 * The AI Gateway's public model list (no key needed, no user data sent), cached in memory.
 * Lets routing send only model ids that exist and match each Venice model to its Gateway twin.
 */
const MODELS_URL = 'https://ai-gateway.vercel.sh/v1/models';
let cache: { at: number; ids: string[] | null } | null = null;

export async function getGatewayModelIds(): Promise<string[] | null> {
  if (process.env.NODE_ENV === 'test') return null;
  const ttl = cache?.ids ? 3600_000 : 300_000;
  if (cache && Date.now() - cache.at < ttl) return cache.ids;
  try {
    const res = await fetch(MODELS_URL, { signal: AbortSignal.timeout(3000), headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as { data?: { id?: string; type?: string }[] };
    const ids = (json.data ?? []).filter((m) => typeof m.id === 'string' && (m.type ?? 'language') === 'language').map((m) => m.id!);
    cache = { at: Date.now(), ids: ids.length ? ids : (cache?.ids ?? null) };
  } catch {
    // Keep the last good list; without one, routing falls back to the per-vendor defaults.
    cache = { at: Date.now(), ids: cache?.ids ?? null };
  }
  return cache.ids;
}
