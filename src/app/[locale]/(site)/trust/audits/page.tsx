import { getTranslations, setRequestLocale } from 'next-intl/server';
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { analyses, analysisVerdicts, briefingEditions, editionStories } from '@/lib/db/schema';
import { getTopics } from '@/lib/queries';
import { GRADES } from '@/lib/domain/types';

/** Weekly symmetry audit per edition (TODO 16.7): which topics each edition covered in the last 7 days. */
async function loadEditionAudit() {
  const db = await getDb();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString().slice(0, 10);
  return db
    .select({ placeId: briefingEditions.placeId, topicId: editionStories.topicId, n: sql<number>`count(*)::int` })
    .from(editionStories)
    .innerJoin(briefingEditions, eq(briefingEditions.id, editionStories.editionId))
    .where(gte(briefingEditions.date, weekAgo))
    .groupBy(briefingEditions.placeId, editionStories.topicId);
}

/** Live symmetry figures (TODO 19.4); quarterly reports add raw data and outside review. */
export default async function AuditsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('trust.audits');
  const tc = await getTranslations('common');
  const db = await getDb();
  const byGrade = await db.select({ grade: analyses.grade, n: sql<number>`count(*)::int` }).from(analyses).where(eq(analyses.status, 'published')).groupBy(analyses.grade);
  const [dis] = await db.select({ n: sql<number>`count(*)::int` }).from(analyses).where(and(eq(analyses.status, 'published'), eq(analyses.disagreement, true)));
  const [mirrors] = await db.select({ n: sql<number>`count(*)::int` }).from(analyses).where(isNotNull(analyses.mirrorTest));
  const refusals = await db
    .select({ slot: analysisVerdicts.slot, total: sql<number>`count(*)::int`, abstained: sql<number>`sum(case when ${analysisVerdicts.abstained} then 1 else 0 end)::int` })
    .from(analysisVerdicts)
    .where(eq(analysisVerdicts.shadow, false))
    .groupBy(analysisVerdicts.slot);
  const perEdition = await loadEditionAudit();
  const topics = await getTopics();
  const topicName = (id: string) => topics.find((x) => x.id === id)?.names[locale] ?? id;
  const editionIds = [...new Set(perEdition.map((r) => r.placeId))];
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="muted">{t('intro')}</p>
      <section className="card p-5">
        <h2 className="font-semibold">{t('byGrade')}</h2>
        <ul className="mt-2 space-y-1">
          {GRADES.map((g) => <li key={g} className="flex justify-between"><span>{tc(`grades.${g}`)}</span><span>{byGrade.find((x) => x.grade === g)?.n ?? 0}</span></li>)}
        </ul>
      </section>
      <section className="card grid gap-2 p-5 sm:grid-cols-2">
        <p>{t('disagreement')}: <strong>{dis?.n ?? 0}</strong></p>
        <p>{t('mirror')}: <strong>{mirrors?.n ?? 0}</strong></p>
      </section>
      {editionIds.length > 0 && (
        <section className="card overflow-x-auto p-5">
          <h2 className="font-semibold">{t('editions.title')}</h2>
          <table className="mt-2 w-full text-sm">
            <thead><tr className="text-left"><th className="p-1">{t('editions.edition')}</th><th className="p-1">{t('editions.stories')}</th><th className="p-1">{t('editions.topics')}</th></tr></thead>
            <tbody>
              {editionIds.map((pid) => {
                const rows = perEdition.filter((r) => r.placeId === pid);
                return (
                  <tr key={pid} className="border-t border-line align-top">
                    <td className="p-1 font-medium">{pid}</td>
                    <td className="p-1">{rows.reduce((a, r) => a + r.n, 0)}</td>
                    <td className="p-1">{rows.map((r) => `${topicName(r.topicId)} (${r.n})`).join(', ')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
      <section className="card p-5">
        <h2 className="font-semibold">{t('refusals')}</h2>
        <ul className="mt-2 space-y-1">{refusals.map((r) => <li key={r.slot} className="flex justify-between"><span>{r.slot}</span><span>{r.abstained} / {r.total}</span></li>)}</ul>
      </section>
    </div>
  );
}
