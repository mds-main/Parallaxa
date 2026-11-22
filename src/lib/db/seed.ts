import { sql } from 'drizzle-orm';
import type { Db } from './client';
import * as s from './schema';
import { PLACES } from '../data/places';
import { TOPICS } from '../data/topics';
import { QUIZ_ITEMS } from '../data/quiz';
import { OUTLETS } from '../data/outlets';
import { defaultConfig } from '../config/schema';

/** Idempotent reference-data seed: places, topics, quiz items and the initial active configuration. */
export async function seedIfEmpty(db: Db) {
  const [{ count } = { count: 0 }] = await db.select({ count: sql<number>`count(*)::int` }).from(s.places);
  if (count === 0) {
    await db.insert(s.places).values(PLACES.map((p) => ({ ...p, localName: p.localName ?? null })));
  }
  const [{ tc } = { tc: 0 }] = await db.select({ tc: sql<number>`count(*)::int` }).from(s.topics);
  if (tc === 0) {
    await db.insert(s.topics).values(TOPICS.map((t) => ({ ...t, countryCode: t.countryCode ?? null })));
  }
  const [{ qc } = { qc: 0 }] = await db.select({ qc: sql<number>`count(*)::int` }).from(s.quizItems);
  if (qc === 0) {
    await db.insert(s.quizItems).values(QUIZ_ITEMS);
  }
  const [{ oc } = { oc: 0 }] = await db.select({ oc: sql<number>`count(*)::int` }).from(s.outlets);
  if (oc === 0) {
    await db.insert(s.outlets).values(OUTLETS).onConflictDoNothing();
  }
  const [{ cc } = { cc: 0 }] = await db.select({ cc: sql<number>`count(*)::int` }).from(s.configVersions);
  if (cc === 0) {
    await db.insert(s.configVersions).values({
      reason: 'Initial configuration (PRD 9.4 defaults)',
      config: defaultConfig(),
      status: 'active',
      activatedAt: new Date(),
    });
  }
}
