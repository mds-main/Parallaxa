/** Anonymous aggregate usage events (no user ids, no IPs) for the admin metrics (PRD 10). */
import { getDb } from '../db/client';
import { usageEvents } from '../db/schema';
import { log } from '../log';

export type UsageEvent = 'check_started' | 'briefing_opened' | 'quiz_answered' | 'pushback_message' | 'error_reported' | 'analysis_viewed';

export async function recordUsage(event: UsageEvent, dims: { lang?: string; placeId?: string; topicId?: string } = {}) {
  try {
    const db = await getDb();
    await db.insert(usageEvents).values({ event, lang: dims.lang ?? null, placeId: dims.placeId ?? null, topicId: dims.topicId ?? null });
  } catch (e) {
    log.warn('db.usage_insert_failed', { event, error: e });
    /* metrics must never break a request */
  }
}
