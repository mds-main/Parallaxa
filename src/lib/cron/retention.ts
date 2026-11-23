/** Data retention (PRD 9.3, TODO 7.7): short-lived security data, aggregate-then-delete telemetry. */
import { and, eq, lt, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import * as s from '../db/schema';

export async function runRetention(now = new Date()) {
  const db = await getDb();
  const days = (n: number) => new Date(now.getTime() - n * 24 * 3600_000);
  // Aggregate daily LLM spend into metrics_daily before deleting raw call logs older than 90 days.
  await db.execute(sql`
    insert into metrics_daily (date, metric, dims, value)
    select to_char(date_trunc('day', created_at), 'YYYY-MM-DD'), 'llm_cost_usd', provider, sum(cost_usd)
    from llm_calls where created_at < ${days(90)} group by 1, 3
    on conflict (date, metric, dims) do update set value = excluded.value`);
  const results = {
    llmCalls: (await db.delete(s.llmCalls).where(lt(s.llmCalls.createdAt, days(90))).returning({ id: s.llmCalls.id })).length,
    rateCounters: (await db.delete(s.rateCounters).where(lt(s.rateCounters.windowStart, Math.floor(days(2).getTime() / 1000))).returning({ k: s.rateCounters.key })).length,
    loginAttempts: (await db.delete(s.adminLoginAttempts).where(lt(s.adminLoginAttempts.at, days(7))).returning({ id: s.adminLoginAttempts.id })).length,
    sessions: (await db.delete(s.adminSessions).where(lt(s.adminSessions.expiresAt, days(7))).returning({ id: s.adminSessions.id })).length,
    usageEvents: (await db.delete(s.usageEvents).where(lt(s.usageEvents.at, days(400))).returning({ id: s.usageEvents.id })).length,
    // Checks still waiting for the reader to choose a place after a day: drop the saved claim and close them.
    unansweredChecks: (
      await db
        .update(s.analyses)
        .set({ status: 'failed', error: 'expired: no place was chosen', pending: null })
        .where(and(eq(s.analyses.status, 'needs_input'), lt(s.analyses.createdAt, days(1))))
        .returning({ id: s.analyses.id })
    ).length,
  };
  return results;
}
