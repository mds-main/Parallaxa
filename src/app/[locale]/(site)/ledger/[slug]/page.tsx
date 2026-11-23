import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { and, desc, eq } from 'drizzle-orm';
import { Link } from '@/i18n/navigation';
import { getDb } from '@/lib/db/client';
import { actorClaims, actorDimensionScores, actorReplies, actors, analyses, claims } from '@/lib/db/schema';
import { GradeIcon } from '@/components/VerdictChip';
import type { Grade } from '@/lib/domain/types';

const DIMENSIONS = ['factual_reliability', 'correction_behaviour', 'data_integrity', 'prediction_calibration', 'integrity_record', 'influence_operations', 'civility'] as const;

export default async function ActorPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ledger');
  const tc = await getTranslations('common');
  const db = await getDb();
  const [actor] = await db.select().from(actors).where(and(eq(actors.slug, slug), eq(actors.published, true)));
  if (!actor) notFound();
  const scores = await db.select().from(actorDimensionScores).where(eq(actorDimensionScores.actorId, actor.id));
  const claimRows = await db
    .select({ id: analyses.id, grade: analyses.grade, text: claims.canonicalText, at: analyses.publishedAt })
    .from(actorClaims)
    .innerJoin(analyses, eq(analyses.id, actorClaims.analysisId))
    .innerJoin(claims, eq(claims.id, analyses.claimId))
    .where(and(eq(actorClaims.actorId, actor.id), eq(analyses.status, 'published')))
    .orderBy(desc(analyses.publishedAt))
    .limit(50);
  const replies = await db.select().from(actorReplies).where(and(eq(actorReplies.actorId, actor.id), eq(actorReplies.status, 'published')));
  const fr = scores.find((s) => s.dimension === 'factual_reliability');
  const badCount = claimRows.filter((c) => c.grade === 'contradicted' || c.grade === 'mostly_unsupported').length;
  return (
    <article className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold">{actor.name}</h1>
        <p className="muted">{t(`types.${actor.type}`)} · {actor.publicRole?.[locale] ?? ''}</p>
        <p className="mt-2 max-w-3xl text-sm">{t('conductNote')}</p>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {DIMENSIONS.map((d) => {
          const sc = scores.find((s) => s.dimension === d);
          return (
            <div key={d} className="card p-4">
              <h2 className="font-semibold">{t(`dimensions.${d}`)}</h2>
              {d === 'factual_reliability' ? (
                fr && fr.value !== null ? (
                  <p className="mt-2">{t('factual', { bad: badCount, n: fr.n })}</p>
                ) : (
                  <p className="mt-2 text-sm muted">{t('notEnough', { n: fr?.n ?? claimRows.length })}</p>
                )
              ) : sc ? (
                <p className="mt-2 text-sm">{t('sampleSize', { n: sc.n, confidence: sc.confidence ? tc(`confidence.${sc.confidence}`) : '—' })}</p>
              ) : (
                <p className="mt-2 text-sm muted">—</p>
              )}
            </div>
          );
        })}
      </section>
      <section>
        <h2 className="text-xl font-semibold">{t('analyzedClaims')}</h2>
        <ul className="mt-3 grid gap-2 xl:grid-cols-2 3xl:grid-cols-3">
          {claimRows.map((c) => (
            <li key={c.id} className="card flex items-start gap-3 p-3">
              {c.grade && <GradeIcon grade={c.grade as Grade} />}
              <div>
                <Link href={`/a/${c.id}`}>{c.text}</Link>
                {c.grade && <p className="text-xs muted">{tc(`grades.${c.grade}`)}</p>}
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="card max-w-5xl p-5">
        {replies.length ? (
          replies.map((r) => (
            <div key={r.id} className="mb-3">
              <h2 className="font-semibold">{t('reply', { name: actor.name })}</h2>
              <p className="mt-1 max-w-[75ch] whitespace-pre-line">{r.body}</p>
            </div>
          ))
        ) : (
          <p className="text-sm">{t('noReply')}</p>
        )}
      </section>
    </article>
  );
}
