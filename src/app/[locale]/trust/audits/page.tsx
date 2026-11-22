import { getTranslations, setRequestLocale } from 'next-intl/server';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { analyses, analysisVerdicts } from '@/lib/db/schema';
import { GRADES } from '@/lib/domain/types';

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
      <section className="card p-5">
        <h2 className="font-semibold">{t('refusals')}</h2>
        <ul className="mt-2 space-y-1">{refusals.map((r) => <li key={r.slot} className="flex justify-between"><span>{r.slot}</span><span>{r.abstained} / {r.total}</span></li>)}</ul>
      </section>
    </div>
  );
}
