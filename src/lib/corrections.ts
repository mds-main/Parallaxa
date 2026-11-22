/**
 * Corrections (PRD F1 stage 9, TODO 12.15): analyses are never edited silently. A correction creates a
 * new version with a public diff and reason, listed in the corrections log and its RSS feed.
 */
import { eq } from 'drizzle-orm';
import { getDb } from './db/client';
import { analyses, corrections } from './db/schema';
import type { Confidence, Grade } from './domain/types';

export type CorrectionInput = { grade: Grade; confidence: Confidence; reason: Record<string, string>; reviewer: string };

export async function publishCorrection(analysisId: string, input: CorrectionInput) {
  const db = await getDb();
  const [a] = await db.select().from(analyses).where(eq(analyses.id, analysisId));
  if (!a?.structured) throw new Error('Analysis not found');
  if (!input.reason.en?.trim()) throw new Error('An English reason is required.');
  const diff: { field: string; before: unknown; after: unknown }[] = [];
  if (a.grade !== input.grade) diff.push({ field: 'grade', before: a.grade, after: input.grade });
  if (a.confidence !== input.confidence) diff.push({ field: 'confidence', before: a.confidence, after: input.confidence });
  if (!diff.length) diff.push({ field: 'note', before: null, after: input.reason.en });
  const toVersion = a.version + 1;
  const structured = {
    ...a.structured,
    grade: input.grade,
    confidence: input.confidence,
    reasoning: [...a.structured.reasoning, `Correction (v${toVersion}): ${input.reason.en}`],
    disclosures: { ...a.structured.disclosures, humanReviewed: true },
  };
  await db.transaction(async (tx) => {
    await tx.update(analyses).set({ version: toVersion, grade: input.grade, confidence: input.confidence, structured, humanReviewed: true, status: 'published', publishedAt: a.publishedAt ?? new Date() }).where(eq(analyses.id, analysisId));
    await tx.insert(corrections).values({ analysisId, fromVersion: a.version, toVersion, reason: input.reason, diff });
  });
  return { toVersion, diff };
}
