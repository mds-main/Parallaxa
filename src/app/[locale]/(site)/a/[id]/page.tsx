import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { getAnalysis, getCorrections, getPlaces, getTopics } from '@/lib/queries';
import { ensureRendering } from '@/lib/pipeline/render';
import { getActiveConfig } from '@/lib/config/store';
import { modelVendor } from '@/lib/config/models';
import { VerdictChip, GradeIcon } from '@/components/VerdictChip';
import { AnalysisProgress } from '@/components/AnalysisProgress';
import { ResultActions } from '@/components/ResultActions';
import { RerunButton } from '@/components/RerunButton';
import { recordUsage } from '@/lib/metrics/usage';
import type { Grade, RenderedAnalysis, VerdictSource } from '@/lib/domain/types';

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const found = await getAnalysis(id);
  if (!found || found.analysis.status !== 'published') return { robots: { index: false } };
  const r = await ensureRendering(id, locale).catch(() => null);
  return { title: r?.headline ?? found.claim?.canonicalText.slice(0, 80), description: r?.summary };
}

function List({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  if (!items.length && !empty) return null;
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      {items.length ? (
        <ul className="mt-2 list-disc space-y-1.5 pl-5">
          {items.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm muted">{empty}</p>
      )}
    </section>
  );
}

export default async function AnalysisPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const found = await getAnalysis(id);
  if (!found) notFound();
  const { analysis: a, claim } = found;
  const t = await getTranslations('result');
  const tc = await getTranslations('common');
  const format = await getFormatter();

  if (a.status === 'queued' || a.status === 'running') return <AnalysisProgress id={id} />;
  if (a.status === 'failed') {
    const reused = a.error?.startsWith('reused:') ? a.error.slice(7) : null;
    if (reused) return <AnalysisProgress id={id} />;
    const tch = await getTranslations('check');
    return <p role="alert" className="card p-6">{tch('failed', { reason: a.error ?? '' })}</p>;
  }
  if (a.status === 'review' || !a.structured) {
    return (
      <div className="card p-6">
        <p className="text-sm muted">{t('claim')}</p>
        <p className="mt-1 font-serif text-xl">{claim?.canonicalText}</p>
        <p role="status" className="mt-4 rounded-lg bg-paper-2 p-3">{t('banners.review')}</p>
      </div>
    );
  }

  const s = a.structured;
  const rendered: RenderedAnalysis | null = await ensureRendering(id, locale).catch(() => null);
  const { config, id: activeConfigId } = await getActiveConfig();
  const [places, topics, history] = await Promise.all([getPlaces(), getTopics(), getCorrections(id)]);
  const placeName = (pid: string) => places.find((p) => p.id === pid)?.names[locale] ?? pid;
  const topicName = (tid: string) => topics.find((x) => x.id === tid)?.names[locale] ?? tid;
  const slotLabel = (slotId: string) => config.slots.find((x) => x.id === slotId)?.label[locale] ?? slotId;
  await recordUsage('analysis_viewed', { lang: locale, placeId: s.placeTags[0]?.id, topicId: s.topicTags[0]?.id });
  const grade = s.grade as Grade;
  const isValues = Boolean(s.valuesQuestion) || (grade === 'not_checkable' && s.verdicts.length === 0);
  const r = rendered;

  return (
    <article className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        <header className="space-y-3">
          <p className="text-sm muted">{t('claim')}</p>
          <blockquote className="font-serif text-xl leading-snug md:text-2xl" lang={claim?.lang === 'es' ? 'es' : claim?.lang === 'en' ? 'en' : undefined}>
            “{claim?.canonicalText}”
          </blockquote>
          <div className="flex flex-wrap items-center gap-3">
            {isValues ? <span className="chip">{t('banners.values')}</span> : <VerdictChip grade={grade} label={tc(`grades.${grade}`)} large />}
            {!isValues && (
              <span className="text-sm">
                {tc('confidence.label')}: <strong>{tc(`confidence.${s.confidence}`)}</strong>
              </span>
            )}
          </div>
          {r && <h1 className="text-2xl font-semibold md:text-3xl">{r.headline}</h1>}
        </header>

        <div className="space-y-2" role="region" aria-label="Notices">
          {s.disclosures.demoMode && <p className="rounded-lg border border-line bg-accent/15 p-3 text-sm">{t('banners.demo')}</p>}
          {s.disclosures.modelsDisagree && <p className="rounded-lg border-2 border-ink p-3 text-sm font-medium">{t('banners.disagree')}</p>}
          {s.disclosures.fallbackProvider && <p className="rounded-lg border border-line bg-paper-2 p-3 text-sm">{t('banners.fallback')}</p>}
          {s.disclosures.staleData && <p className="rounded-lg border border-line bg-paper-2 p-3 text-sm">{t('banners.stale', { months: config.pipeline.staleDataMonths })}</p>}
        </div>

        {r && (
          <section>
            <h2 className="text-lg font-semibold">{t('summary')}</h2>
            <p className="mt-2 text-lg leading-relaxed">{r.summary}</p>
          </section>
        )}

        {isValues && r?.valuesPositions?.length ? (
          <section className="card p-5">
            <h2 className="text-lg font-semibold">{t('valuesTitle')}</h2>
            <p className="mt-1 text-sm muted">{t('valuesIntro')}</p>
            <ul className="mt-3 space-y-3">
              {r.valuesPositions.map((p, i) => (
                <li key={i}>
                  <strong>{p.label}</strong>
                  <p className="mt-1">{p.steelman}</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {r && !isValues && (
          <div className="grid gap-6 md:grid-cols-3">
            <List title={t('whatsTrue')} items={r.whatsTrue} empty="—" />
            <List title={t('whatsMissing')} items={r.whatsMissing} empty="—" />
            <List title={t('whatsWrong')} items={r.whatsWrong} empty="—" />
          </div>
        )}

        {r && !isValues && (
          <section className="card p-5">
            <h2 className="text-lg font-semibold">{t('sides.title')}</h2>
            <div className="mt-3 grid gap-5 md:grid-cols-2">
              <List title={t('sides.left')} items={r.sidesRight.left} empty={t('sides.empty')} />
              <List title={t('sides.right')} items={r.sidesRight.right} empty={t('sides.empty')} />
            </div>
            <p className="mt-3 text-xs muted">{t('sides.note')}</p>
          </section>
        )}

        {s.techniques.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold">{t('techniques')}</h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              {s.techniques.map((x) => (
                <li key={x} className="chip">{tc(`techniques.${x}`)}</li>
              ))}
            </ul>
          </section>
        )}

        {s.sources.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold">{t('sources')}</h2>
            <ol className="mt-2 space-y-3">
              {s.sources.map((src: VerdictSource, i) => (
                <li key={src.url + i} className="card p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold">[{i + 1}]</span>
                    <span className="chip">{tc(`tiers.${src.tier}`)}</span>
                    <span className="chip">{tc(`stance.${src.stance}`)}</span>
                    {src.quoteVerified && <span className="chip">✓ {t('quoteVerified')}</span>}
                  </div>
                  <a href={src.url} rel="noopener noreferrer nofollow" target="_blank" className="mt-1 block font-medium">
                    {src.title}
                  </a>
                  {src.quoteVerified && src.quote && <blockquote className="mt-1 border-l-2 border-line pl-3 text-sm italic">“{src.quote}”</blockquote>}
                </li>
              ))}
            </ol>
          </section>
        )}

        {r && r.reasoning.length > 0 && (
          <details className="card p-4">
            <summary className="cursor-pointer font-semibold">{t('reasoning')}</summary>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5">
              {r.reasoning.map((x, i) => (
                <li key={i}>{x}</li>
              ))}
            </ol>
            <p className="mt-3 text-sm muted">{r.confidenceReason}</p>
          </details>
        )}

        {a.configVersionId !== null && a.configVersionId !== activeConfigId && claim && !s.disclosures.demoMode && <RerunButton analysisId={a.id} claim={claim.canonicalText} />}
        <ResultActions analysisId={a.id} version={a.version} pushBackEnabled={config.killSwitches.pushBack} maxTurns={config.limits.dialogueMaxTurns} />
      </div>

      <aside className="space-y-6">
        {s.verdicts.length > 0 && (
          <section className="card p-4" aria-labelledby="models-title">
            <h2 id="models-title" className="font-semibold">{t('models.title')}</h2>
            <p className="mt-1 text-sm muted">{t('models.intro')}</p>
            <p className="mt-2 text-sm font-medium">{s.aggregate.disagreement ? t('models.disagree') : t('models.agree')}</p>
            <ul className="mt-3 space-y-3">
              {s.verdicts.map((v) => (
                <li key={v.slot} className="rounded-xl border border-line p-3">
                  <p className="text-xs muted">{slotLabel(v.slot)}</p>
                  <p className="text-sm font-medium">
                    {v.model} · {modelVendor(v.model).label}
                  </p>
                  {v.abstained ? (
                    <p className="mt-1 text-sm">{t('models.abstained')}</p>
                  ) : (
                    v.grade && (
                      <p className="mt-1 flex items-center gap-2 text-sm">
                        <GradeIcon grade={v.grade} size={16} />
                        {tc(`grades.${v.grade}`)} · {tc(`confidence.${v.confidence ?? 'low'}`)}
                      </p>
                    )
                  )}
                  {v.coiExcluded && <p className="mt-1 text-xs">{t('models.coi')}</p>}
                  <p className="mt-1 text-xs muted">{t('models.searches', { web: v.searches.web, x: v.searches.x, pages: v.searches.scrape })}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card space-y-2 p-4 text-sm">
          <p>{t('meta.checkedAt', { date: a.publishedAt ?? a.createdAt })}</p>
          <p>{t('meta.version', { version: a.version })}</p>
          <p>{a.humanReviewed ? t('meta.humanReviewed') : t('meta.notReviewed')}</p>
          <p className="muted">{t('meta.aiAssisted')}</p>
          {a.promptVersion && <p className="muted">{t('meta.prompt', { version: a.promptVersion })}</p>}
          <p className="muted">{format.dateTime(a.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</p>
        </section>

        {history.length > 0 && (
          <section className="card p-4 text-sm">
            <h2 className="font-semibold">{t('history.title')}</h2>
            <ol className="mt-2 space-y-2">
              {history.map((c) => (
                <li key={c.id}>
                  {t('history.item', { from: c.fromVersion, to: c.toVersion, reason: c.reason[locale] ?? c.reason.en ?? '' })}
                  <ul className="mt-1 text-xs muted">{c.diff.map((d) => <li key={d.field}>{d.field}: {String(d.before ?? '—')} → {String(d.after ?? '—')}</li>)}</ul>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="card p-4 text-sm">
          <h2 className="font-semibold">{t('places')}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {s.placeTags.map((p) => (
              <li key={p.id} className="chip">{placeName(p.id)}</li>
            ))}
          </ul>
          <h2 className="mt-3 font-semibold">{t('topics')}</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {s.topicTags.map((x) => (
              <li key={x.id} className="chip">{topicName(x.id)}</li>
            ))}
          </ul>
        </section>
      </aside>
    </article>
  );
}
