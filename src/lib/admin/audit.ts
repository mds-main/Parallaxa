import { desc } from 'drizzle-orm';
import { getDb } from '../db/client';
import { auditLog } from '../db/schema';

/** Audit log for every admin action (TODO 22.6). Actor is the shared operator login in the MVP. */
export async function audit(entry: { action: string; target: string; before?: unknown; after?: unknown; reason?: string; ipHash?: string; actor?: string }) {
  const db = await getDb();
  await db.insert(auditLog).values({
    actor: entry.actor ?? 'admin',
    action: entry.action,
    target: entry.target,
    before: (entry.before ?? null) as never,
    after: (entry.after ?? null) as never,
    reason: entry.reason ?? null,
    ipHash: entry.ipHash ?? null,
  });
}

export async function listAudit(limit = 100) {
  const db = await getDb();
  return db.select().from(auditLog).orderBy(desc(auditLog.id)).limit(limit);
}
