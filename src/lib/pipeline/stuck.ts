import { and, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import * as s from '../db/schema';
import { log } from '../log';

/** Longer than any function may run (800 s), so a check this quiet was cut off, not slow. */
export const STUCK_AFTER_MIN = 15;

/**
 * Checks whose function was cut off (time limit, crash, deploy) would otherwise show "working" forever.
 * Run from the 5-minute health cron: marks them failed so the reader sees an error and can try again.
 */
export async function failStuckAnalyses(now = new Date()): Promise<number> {
  const db = await getDb();
  const cutoff = new Date(now.getTime() - STUCK_AFTER_MIN * 60_000).toISOString();
  const rows = await db
    .update(s.analyses)
    .set({ status: 'failed', error: `timeout: no progress for ${STUCK_AFTER_MIN} minutes`, pending: null })
    .where(and(inArray(s.analyses.status, ['queued', 'running']), sql`coalesce((${s.analyses.progress}->>'updatedAt')::timestamptz, ${s.analyses.createdAt}) < ${cutoff}::timestamptz`))
    .returning({ id: s.analyses.id, progress: s.analyses.progress });
  for (const r of rows) log.error('analysis.stuck', { analysis: r.id, stage: r.progress?.stage, after: `${STUCK_AFTER_MIN}m` });
  return rows.length;
}
