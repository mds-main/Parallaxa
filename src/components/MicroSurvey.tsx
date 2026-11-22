'use client';
import { useState, useSyncExternalStore } from 'react';
import { useLocale, useTranslations } from 'next-intl';

const KEY = 'plx:survey:v1';
type Q = 'respected' | 'calmer' | 'relevant';
const OPTIONS: Record<Q, string[]> = { respected: ['yes', 'no'], calmer: ['calmer', 'same', 'more_stressed'], relevant: ['yes', 'somewhat', 'no'] };

function getState(): { never?: boolean; last?: number } {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

/** Opt-in micro-survey (PRD 10, TODO 26.1/26.3): asked at most once a week, never again on request, anonymous. */
export function MicroSurvey({ questions }: { questions: Q[] }) {
  const t = useTranslations('common.survey');
  const locale = useLocale();
  const eligible = useSyncExternalStore(
    () => () => undefined,
    () => {
      const s = getState();
      return !s.never && (!s.last || Date.now() - s.last > 7 * 24 * 3600_000);
    },
    () => false,
  );
  const [step, setStep] = useState<'ask' | number | 'done' | 'hidden'>('ask');
  if (!eligible || step === 'hidden') return null;
  const save = (patch: object) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...getState(), ...patch }));
    } catch {
      /* ignore */
    }
  };
  if (step === 'done') return <p role="status" className="text-sm muted">{t('thanks')}</p>;
  if (step === 'ask') {
    return (
      <div className="card flex flex-wrap items-center gap-2 p-4 text-sm">
        <span className="flex-1">{t('ask')}</span>
        <button className="btn !min-h-9 !py-1" onClick={() => { save({ last: Date.now() }); setStep(0); }}>{t('yes')}</button>
        <button className="btn btn-ghost !min-h-9 !py-1" onClick={() => { save({ last: Date.now() }); setStep('hidden'); }}>{t('no')}</button>
        <button className="text-xs underline" onClick={() => { save({ never: true }); setStep('hidden'); }}>{t('never')}</button>
      </div>
    );
  }
  const q = questions[step]!;
  return (
    <fieldset className="card p-4 text-sm">
      <legend className="sr-only">{t(q)}</legend>
      <p className="font-medium">{t(q)}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {OPTIONS[q].map((a) => (
          <button
            key={a}
            className="btn btn-ghost !min-h-9 !py-1"
            onClick={() => {
              fetch('/api/survey', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, answer: a, lang: locale }) }).catch(() => undefined);
              setStep(step + 1 < questions.length ? step + 1 : 'done');
            }}
          >
            {t(`answers.${a}`)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
