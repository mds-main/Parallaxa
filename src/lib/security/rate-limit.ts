/** Fixed-window rate limiting keyed by a salted IP hash (TODO 9.7, 23.1). Postgres-backed; KV is the scale-up path. */
import { sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { rateCounters } from '../db/schema';

export async function rateLimit(key: string, limit: number, windowSec: number): Promise<{ ok: boolean; remaining: number }> {
  const db = await getDb();
  const windowStart = Math.floor(Date.now() / 1000 / windowSec) * windowSec;
  const [row] = await db
    .insert(rateCounters)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateCounters.key, rateCounters.windowStart], set: { count: sql`${rateCounters.count} + 1` } })
    .returning({ count: rateCounters.count });
  const count = row?.count ?? 1;
  return { ok: count <= limit, remaining: Math.max(0, limit - count) };
}
