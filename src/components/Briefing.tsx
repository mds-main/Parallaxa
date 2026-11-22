'use client';
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useSessionScope, useStoredPreferences } from '@/lib/prefs/hooks';
import { savePreferences } from '@/lib/prefs/storage';
import { markEngaged } from './InstallPrompt';
import { MicroSurvey } from './MicroSurvey';
import { defaultPreferences } from '@/lib/prefs/types';
import { assembleBriefing, type EditionStory } from '@/lib/briefing/assemble';
import { GradeIcon } from './VerdictChip';
import type { Grade } from '@/lib/domain/types';

type Props = {
  editions: { placeId: string; stories: EditionStory[] }[];
  parents: Record<string, string | null>;
  placeNames: Record<string, Record<string, string>>;
  topicNames: Record<string, Record<string, string>>;
  gradeLabels: Record<string, string>;
};

export function Briefing({ editions, parents, placeNames, topicNames, gradeLabels }: Props) {
  const t = useTranslations('today');
  const locale = useLocale();
  const stored = useStoredPreferences();
  const session = useSessionScope();
  const prefs = useMemo(() => {
    const base = stored ?? defaultPreferences();
    if (!session) return base;
    // Session-only scope from the header chip narrows places for this visit without saving anything.
    return { ...base, places: base.places.filter((p) => session.includes(p.id)), global: session.includes('GLOBAL') };
  }, [stored, session]);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    fetch('/api/usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event: 'briefing_opened', lang: locale }) }).catch(() => undefined);
  }, [locale]);
  const result = useMemo(() => assembleBriefing(editions, prefs, (id) => parents[id] ?? null), [editions, prefs, parents]);
  const stories = result.stories;
  const total = stories.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'j') setIndex((i) => Math.min(i + 1, total));
      if (e.key === 'ArrowLeft' || e.key === 'k') setIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total]);

  useEffect(() => {
    if (total && index >= total) markEngaged();
  }, [index, total]);
  const name = (id: string) => placeNames[id]?.[locale] ?? id;
  if (!total) return <p className="card p-6">{t('empty')}</p>;
  if (index >= total) {
    return (
      <div className="card p-10 text-center">
        <p className="font-serif text-2xl">{t('upToDate')}</p>
        <div className="mx-auto mt-6 max-w-md text-left">
          <MicroSurvey questions={['relevant', 'calmer']} />
        </div>
        <button className="btn btn-ghost mt-6" onClick={() => setIndex(0)}>{t('previous')}</button>
      </div>
    );
  }
  const s = stories[index]!;
  const reason =
    s.reason.kind === 'outside'
      ? t('reasons.outside')
      : s.reason.kind === 'topic'
        ? t('reasons.topic', { topic: topicNames[s.reason.topicId!]?.[locale] ?? s.reason.topicId! })
        : s.reason.kind === 'place'
          ? t('reasons.place', { place: name(s.reason.placeId!) })
          : t('reasons.default', { place: name(s.reason.placeId ?? 'GLOBAL') });
  const offSince = prefs.briefing.outsideOffSince ? Date.parse(prefs.briefing.outsideOffSince) : null;
  // eslint-disable-next-line react-hooks/purity -- a once-per-render date comparison is intended here
  const remind = !prefs.briefing.outsideFilters && offSince !== null && Date.now() - offSince > 90 * 24 * 3600_000;
  return (
    <div>
      {remind && (
        <p className="mb-3 rounded-lg border border-line p-3 text-sm">
          {t('outsideReminder')}{' '}
          <button className="underline" onClick={() => savePreferences({ ...prefs, briefing: { ...prefs.briefing, outsideFilters: true, outsideOffSince: undefined } })}>{t('outsideTurnOn')}</button>
        </p>
      )}
      {result.fallbackPlace && <p className="mb-3 rounded-lg bg-paper-2 p-3 text-sm">{t('fallback', { place: name(result.fallbackPlace) })}</p>}
      <article
        className="card p-6 md:p-8"
        aria-roledescription="slide"
        aria-label={t('storyOf', { n: index + 1, total })}
        onTouchStart={(e) => ((e.currentTarget as HTMLElement).dataset.x = String(e.touches[0]!.clientX))}
        onTouchEnd={(e) => {
          const start = Number((e.currentTarget as HTMLElement).dataset.x);
          const dx = e.changedTouches[0]!.clientX - start;
          if (dx < -50) setIndex((i) => i + 1);
          if (dx > 50) setIndex((i) => Math.max(0, i - 1));
        }}
      >
        <p className="text-sm muted">{t('storyOf', { n: index + 1, total })}</p>
        {s.reason.kind === 'outside' && <p className="chip mt-2">{t('outsideLabel')}</p>}
        <h2 className="mt-3 text-2xl font-semibold">{s.headline[locale] ?? s.headline.en}</h2>
        {s.claim && <blockquote className="mt-2 font-serif text-lg text-ink-2">“{s.claim}”</blockquote>}
        <p className="mt-3 flex items-center gap-2 text-sm">
          <GradeIcon grade={s.grade as Grade} /> {gradeLabels[s.grade]}
        </p>
        <p className="mt-2 text-sm muted">
          {name(s.editionPlaceId)} · {topicNames[s.topicId]?.[locale] ?? s.topicId}
        </p>
        {s.perceptionFact?.[locale] && (
          <p className="mt-4 rounded-lg bg-paper-2 p-3 text-sm">
            <strong>{t('perceptionFact')}:</strong> {s.perceptionFact[locale]}
          </p>
        )}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer underline">{t('why')}</summary>
          <p className="mt-1">{reason}</p>
        </details>
        <Link href={`/a/${s.analysisId}`} className="btn mt-6 no-underline">{t('readAnalysis')}</Link>
      </article>
      <div className="mt-4 flex items-center justify-between">
        <button className="btn btn-ghost" disabled={index === 0} onClick={() => setIndex(index - 1)}>← {t('previous')}</button>
        <button className="btn" onClick={() => setIndex(index + 1)}>{t('next')} →</button>
      </div>
    </div>
  );
}
