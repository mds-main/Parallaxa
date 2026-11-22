/** Ledger factual-reliability scoring (PRD F3): reach-weighted, n ≥ 10 before any score, no overall score. */
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client';
import { actorClaims, actorDimensionScores, analyses } from '../db/schema';
import type { Confidence } from '../domain/types';

export const MIN_N = 10;
export const RUBRIC_VERSION = 'ledger-v1';
const BAD = new Set(['contradicted', 'mostly_unsupported']);

export function factualReliability(claims: { grade: string | null; reach: number }[]): { n: number; bad: number; value: number | null; confidence: Confidence | null } {
  const graded = claims.filter((c) => c.grade && c.grade !== 'not_checkable');
  const n = graded.length;
  const bad = graded.filter((c) => BAD.has(c.grade!)).length;
  if (n < MIN_N) return { n, bad, value: null, confidence: null };
  const totalReach = graded.reduce((a, c) => a + Math.max(1, c.reach), 0);
  const badReach = graded.filter((c) => BAD.has(c.grade!)).reduce((a, c) => a + Math.max(1, c.reach), 0);
  return { n, bad, value: 1 - badReach / totalReach, confidence: n >= 40 ? 'high' : n >= 20 ? 'medium' : 'low' };
}

export async function recomputeActor(actorId: string) {
  const db = await getDb();
  const rows = await db
    .select({ grade: analyses.grade, reach: actorClaims.reach })
    .from(actorClaims)
    .innerJoin(analyses, eq(analyses.id, actorClaims.analysisId))
    .where(and(eq(actorClaims.actorId, actorId), eq(analyses.status, 'published')));
  const fr = factualReliability(rows);
  await db
    .insert(actorDimensionScores)
    .values({ actorId, dimension: 'factual_reliability', value: fr.value, n: fr.n, confidence: fr.confidence, rubricVersion: RUBRIC_VERSION })
    .onConflictDoUpdate({ target: [actorDimensionScores.actorId, actorDimensionScores.dimension], set: { value: fr.value, n: fr.n, confidence: fr.confidence, computedAt: sql`now()` } });
  return fr;
}
