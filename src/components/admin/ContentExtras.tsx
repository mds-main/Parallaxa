'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useEditor } from './ConfigEditor';
import { LANGUAGES } from '@/i18n/languages';
import { saveQuizItemAction, toggleQuizItemAction } from '@/app/[locale]/admin/actions';

type QuizRow = { id: string; placeId: string; topicId: string; question: Record<string, string>; trueValue: number; sourceName: string; active: boolean };

export function LanguagesToggle() {
  const t = useTranslations('admin.content');
  const { draft, update } = useEditor();
  return (
    <section className="card p-4">
      <h2 className="font-semibold">{t('languages')}</h2>
      <p className="text-sm muted">{t('languageHelp')}</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {LANGUAGES.map((l) => (
          <li key={l.tag}>
            <label className="chip">
              <input type="checkbox" disabled={!l.enabled} checked={l.enabled && draft.content.languages[l.tag] !== false} onChange={(e) => update('content.languages', { ...draft.content.languages, [l.tag]: e.target.checked })} />
              {l.nativeName} <span className="muted">({l.tag})</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function QuizManager({ items, topics }: { items: QuizRow[]; topics: { id: string; names: Record<string, string> }[] }) {
  const t = useTranslations('admin.content');
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const f = (k: string) => t(`quizFields.${k}`);
  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t('quizItems')}</h2>
        <button className="btn btn-ghost !min-h-9 !py-1 text-sm" onClick={() => setOpen(!open)}>+ {t('addQuiz')}</button>
      </div>
      <ul className="divide-y divide-line text-sm">
        {items.map((q) => (
          <li key={q.id} className="flex flex-wrap items-center gap-3 py-2">
            <span className="chip">{q.placeId}</span>
            <span className="flex-1">{q.question[locale] ?? q.question.en} <span className="muted">({q.trueValue}% · {q.sourceName})</span></span>
            <label className="flex items-center gap-1"><input type="checkbox" checked={q.active} onChange={(e) => toggleQuizItemAction(q.id, e.target.checked).then(() => router.refresh())} /> ✓</label>
          </li>
        ))}
      </ul>
      {open && (
        <form
          className="grid gap-3 md:grid-cols-2"
          action={async (form) => {
            const r = await saveQuizItemAction(form);
            if (r.ok) {
              setOpen(false);
              router.refresh();
            } else setError(r.error ?? 'Error');
          }}
        >
          <label className="text-sm">{f('place')}<input name="placeId" className="field mt-1" required maxLength={6} /></label>
          <label className="text-sm">{f('topic')}<select name="topicId" className="field mt-1">{topics.map((x) => <option key={x.id} value={x.id}>{x.names[locale] ?? x.id}</option>)}</select></label>
          <label className="text-sm md:col-span-2">{f('questionEn')}<input name="questionEn" className="field mt-1" required /></label>
          <label className="text-sm md:col-span-2">{f('questionEs')}<input name="questionEs" className="field mt-1" required /></label>
          <label className="text-sm">{f('trueValue')}<input name="trueValue" type="number" min={0} max={100} step={0.1} className="field mt-1" required /></label>
          <label className="text-sm">{f('margin')}<input name="margin" type="number" min={0} max={20} step={0.1} className="field mt-1" required /></label>
          <label className="text-sm">{f('sourceName')}<input name="sourceName" className="field mt-1" required /></label>
          <label className="text-sm">{f('sourceUrl')}<input name="sourceUrl" type="url" className="field mt-1" required /></label>
          <label className="text-sm md:col-span-2">{f('originalWording')}<input name="originalWording" className="field mt-1" required /></label>
          <label className="text-sm">{f('year')}<input name="year" type="number" min={1990} max={2100} className="field mt-1" required /></label>
          {error && <p role="alert" className="text-sm md:col-span-2">{error}</p>}
          <button className="btn md:col-span-2">{t('saveQuiz')}</button>
        </form>
      )}
    </section>
  );
}
