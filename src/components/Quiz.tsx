'use client';
import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useStoredPreferences } from '@/lib/prefs/hooks';

export type QuizItemView = { id: string; placeId: string; question: Record<string, string>; trueValue: number; margin: number; sourceName: string; sourceUrl: string; originalWording: string; year: number };

export function Quiz({ items, countryNames }: { items: QuizItemView[]; countryNames: Record<string, string> }) {
  const t = useTranslations('quiz');
  const locale = useLocale();
  const countries = useMemo(() => [...new Set(items.map((i) => i.placeId))], [items]);
  const prefs = useStoredPreferences();
  const home = prefs?.places.find((p) => p.home)?.id.split('-')[0];
  const [picked, setCountry] = useState<string | null>(null);
  const country = picked ?? (home && countries.includes(home) ? home : (countries[0] ?? ''));
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState(50);
  const [revealed, setRevealed] = useState(false);
  const list = items.filter((i) => i.placeId === country);
  if (!countries.length) return <p className="card p-6">{t('empty')}</p>;
  const item = list[index];
  return (
    <div className="space-y-4">
      {countries.length > 1 && (
        <label className="block max-w-xs">
          <span className="label">{t('pickCountry')}</span>
          <select className="field mt-1" value={country} onChange={(e) => { setCountry(e.target.value); setIndex(0); setRevealed(false); }}>
            {countries.map((c) => <option key={c} value={c}>{countryNames[c] ?? c}</option>)}
          </select>
        </label>
      )}
      {!item ? (
        <p className="card p-6">{list.length ? t('done') : t('empty')}</p>
      ) : (
        <div className="card grid gap-x-12 gap-y-6 p-6 md:p-8 lg:grid-cols-2 xl:p-10">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold lg:text-2xl">{item.question[locale] ?? item.question.en}</h2>
            <label className="block">
              <span className="label">{t('guess', { value: guess })}</span>
              <input type="range" min={0} max={100} value={guess} disabled={revealed} onChange={(e) => setGuess(Number(e.target.value))} className="mt-2 w-full accent-[var(--accent)]" />
            </label>
            {!revealed && (
              <button
                className="btn"
                onClick={() => {
                  setRevealed(true);
                  fetch('/api/quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quizItemId: item.id, guess }) }).catch(() => undefined);
                }}
              >
                {t('reveal')}
              </button>
            )}
          </div>
          {!revealed && (
            // Wide screens: a large readout of the current guess fills the space the answer will take.
            <p aria-hidden="true" className="hidden self-center text-center font-serif text-8xl font-semibold tabular-nums text-ink-3 lg:block 3xl:text-9xl">
              {guess}%
            </p>
          )}
          {revealed && (
            <div className="space-y-3 lg:border-l lg:border-line lg:pl-12" aria-live="polite">
              <div className="relative h-8 rounded-full bg-paper-2" aria-hidden="true">
                <span className="absolute top-0 h-8 w-1 bg-ink" style={{ left: `${guess}%` }} />
                <span className="absolute top-0 h-8 w-1 bg-accent" style={{ left: `${item.trueValue}%` }} />
              </div>
              <p className="text-lg font-semibold">{t('actual', { value: item.trueValue, margin: item.margin })}</p>
              <p>{t('youWere', { diff: Math.abs(Math.round(guess - item.trueValue)), direction: Math.abs(guess - item.trueValue) <= item.margin ? 'spot' : guess > item.trueValue ? 'high' : 'low' })}</p>
              <p className="text-sm">
                {t('source')}: <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName}</a> ({item.year})
              </p>
              <p className="text-sm muted" lang="en">{t('original')}: {item.originalWording}</p>
              <p className="rounded-lg bg-paper-2 p-3">{t('reflection')}</p>
              <button className="btn" onClick={() => { setIndex(index + 1); setRevealed(false); setGuess(50); }}>{t('next')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
