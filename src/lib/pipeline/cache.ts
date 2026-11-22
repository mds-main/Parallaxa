/** Semantic cache (PRD F1 stage 1): exact text hash, then embedding similarity at pilot scale. */
import { and, desc, eq, gte, isNotNull } from 'drizzle-orm';
import { getDb } from '../db/client';
import { analyses, claims } from '../db/schema';
import { embed, isDemoMode } from '../ai/client';
import { hash } from '../ai/demo';

const DIM = 256;

/** Demo embedding: hashed bag of words (deterministic, no network). */
export function demoEmbedding(text: string): number[] {
  const v = new Array<number>(DIM).fill(0);
  for (const w of text.toLowerCase().split(/[^\p{L}\p{N}%]+/u).filter((x) => x.length > 2)) v[hash(w) % DIM]! += 1;
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
}

export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export async function embedText(text: string, model: string): Promise<number[]> {
  if (isDemoMode()) return demoEmbedding(text);
  try {
    return await embed(model, text);
  } catch {
    return demoEmbedding(text);
  }
}

export async function findCached(textHashValue: string, embedding: number[], threshold: number) {
  const db = await getDb();
  const exact = await db
    .select({ analysisId: analyses.id, publishedAt: analyses.publishedAt })
    .from(claims)
    .innerJoin(analyses, eq(analyses.claimId, claims.id))
    .where(and(eq(claims.textHash, textHashValue), eq(analyses.status, 'published')))
    .orderBy(desc(analyses.version))
    .limit(1);
  if (exact[0]) return { analysisId: exact[0].analysisId, similarity: 1 };
  const since = new Date(Date.now() - 180 * 24 * 3600 * 1000);
  const recent = await db
    .select({ analysisId: analyses.id, embedding: claims.embedding })
    .from(claims)
    .innerJoin(analyses, eq(analyses.claimId, claims.id))
    .where(and(eq(analyses.status, 'published'), isNotNull(claims.embedding), gte(claims.firstSeenAt, since)))
    .orderBy(desc(claims.firstSeenAt))
    .limit(2000);
  let best: { analysisId: string; similarity: number } | null = null;
  for (const r of recent) {
    const sim = cosine(embedding, r.embedding ?? []);
    if (sim >= threshold && (!best || sim > best.similarity)) best = { analysisId: r.analysisId, similarity: sim };
  }
  return best;
}
