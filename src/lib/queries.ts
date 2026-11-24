/** Read-side queries shared by pages and API routes. */
import { unstable_cache } from 'next/cache';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from './db/client';
import * as s from './db/schema';

const CACHE_TTL_SECONDS = 300;

function cachedQuery<T>(fn: () => Promise<T>, keyParts: string[], tags: string[], revalidate = CACHE_TTL_SECONDS): () => Promise<T> {
  const cached = unstable_cache(fn, keyParts, { revalidate, tags });
  return async () => {
    try {
      return await cached();
    } catch (e) {
      // Unit tests and CLI scripts run outside the Next.js server runtime (no incrementalCache).
      if (e instanceof Error && e.message.includes('incrementalCache missing')) return fn();
      throw e;
    }
  };
}

async function loadPlaces() {
  const db = await getDb();
  return db.select().from(s.places).where(eq(s.places.active, true));
}

async function loadTopics() {
  const db = await getDb();
  return db.select().from(s.topics).where(eq(s.topics.active, true));
}

export const getPlaces = cachedQuery(loadPlaces, ['queries', 'places'], ['places']);
export const getTopics = cachedQuery(loadTopics, ['queries', 'topics'], ['topics']);

export async function getAnalysis(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const [a] = await db.select().from(s.analyses).where(eq(s.analyses.id, id));
  if (!a) return null;
  const [claim] = a.claimId ? await db.select().from(s.claims).where(eq(s.claims.id, a.claimId)) : [];
  return { analysis: a, claim: claim ?? null };
}

export async function getCorrections(analysisId?: string) {
  const db = await getDb();
  const q = db.select().from(s.corrections).orderBy(desc(s.corrections.createdAt)).limit(100);
  return analysisId ? db.select().from(s.corrections).where(eq(s.corrections.analysisId, analysisId)).orderBy(desc(s.corrections.createdAt)) : q;
}

export function todayIn(timezone: string, d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** Published editions for each place's local "today" (falls back to the latest published edition within 2 days). */
async function loadPublishedEditions() {
  const db = await getDb();
  const editions = await db.select().from(s.briefingEditions).where(eq(s.briefingEditions.status, 'published')).orderBy(desc(s.briefingEditions.date)).limit(200);
  const latest = new Map<string, (typeof editions)[number]>();
  for (const e of editions) if (!latest.has(e.placeId)) latest.set(e.placeId, e);
  const cutoff = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().slice(0, 10);
  const chosen = [...latest.values()].filter((e) => e.date >= cutoff);
  if (!chosen.length) return [];
  const stories = await db
    .select({ st: s.editionStories, grade: s.analyses.grade, claim: s.claims.canonicalText })
    .from(s.editionStories)
    .innerJoin(s.analyses, eq(s.analyses.id, s.editionStories.analysisId))
    .leftJoin(s.claims, eq(s.claims.id, s.analyses.claimId))
    .where(inArray(s.editionStories.editionId, chosen.map((e) => e.id)));
  const placesByAnalysis = new Map<string, string[]>();
  const ids = [...new Set(stories.map((x) => x.st.analysisId))];
  if (ids.length) {
    for (const cp of await db.select().from(s.claimPlaces).where(inArray(s.claimPlaces.analysisId, ids))) {
      placesByAnalysis.set(cp.analysisId, [...(placesByAnalysis.get(cp.analysisId) ?? []), cp.placeId]);
    }
  }
  return chosen.map((e) => ({
    placeId: e.placeId,
    date: e.date,
    stories: stories
      .filter((x) => x.st.editionId === e.id)
      .sort((a, b) => a.st.rank - b.st.rank)
      .map((x) => ({
        analysisId: x.st.analysisId,
        editionPlaceId: e.placeId,
        rank: x.st.rank,
        topicId: x.st.topicId,
        salience: x.st.salience,
        placeIds: placesByAnalysis.get(x.st.analysisId) ?? [e.placeId],
        headline: x.st.headline,
        claim: x.claim ?? undefined,
        grade: x.grade ?? 'not_checkable',
        perceptionFact: x.st.perceptionFact ?? undefined,
      })),
  }));
}

export const getPublishedEditions = cachedQuery(loadPublishedEditions, ['queries', 'published-editions'], ['editions']);

export async function countRecentChecks(hours: number) {
  const db = await getDb();
  const since = new Date(Date.now() - hours * 3600 * 1000);
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(s.analyses).where(and(sql`${s.analyses.createdAt} >= ${since}`));
  return row?.n ?? 0;
}
