import { and, gte, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { llmCalls } from '../db/schema';

export function startOfUtcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function spendToday(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ total: sql<number>`coalesce(sum(${llmCalls.costUsd}), 0)::float` }).from(llmCalls).where(and(gte(llmCalls.createdAt, startOfUtcDay())));
  return row?.total ?? 0;
}

export async function underSpendCeiling(ceilingUsd: number): Promise<boolean> {
  return (await spendToday()) < ceilingUsd;
}
