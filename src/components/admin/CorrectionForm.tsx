'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { GRADES, CONFIDENCES } from '@/lib/domain/types';
import { publishCorrectionAction } from '@/app/[locale]/admin/actions';

export function CorrectionForm({ analysisId, taskId, reviewer }: { analysisId: string; taskId?: string; reviewer: string }) {
  const t = useTranslations('admin.review');
  const tc = useTranslations('common');
  const router = useRouter();
  const [grade, setGrade] = useState<string>('mixed');
  const [confidence, setConfidence] = useState<string>('medium');
  const [reasonEn, setReasonEn] = useState('');
  const [reasonEs, setReasonEs] = useState('');
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (done) return <p role="status" className="text-sm">{t('corrected', { version: done })}</p>;
  return (
    <details className="rounded-lg border border-line p-3">
      <summary className="cursor-pointer text-sm font-medium">{t('correct')}</summary>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <label className="text-sm">{t('newGrade')}
          <select className="field mt-1" value={grade} onChange={(e) => setGrade(e.target.value)}>{GRADES.map((g) => <option key={g} value={g}>{tc(`grades.${g}`)}</option>)}</select>
        </label>
        <label className="text-sm">{t('newConfidence')}
          <select className="field mt-1" value={confidence} onChange={(e) => setConfidence(e.target.value)}>{CONFIDENCES.map((c) => <option key={c} value={c}>{tc(`confidence.${c}`)}</option>)}</select>
        </label>
        <label className="text-sm md:col-span-2">{t('reasonEn')}<input className="field mt-1" value={reasonEn} onChange={(e) => setReasonEn(e.target.value)} /></label>
        <label className="text-sm md:col-span-2">{t('reasonEs')}<input className="field mt-1" value={reasonEs} onChange={(e) => setReasonEs(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm md:col-span-2">{error}</p>}
        <button
          className="btn !min-h-9 !py-1 text-sm md:col-span-2"
          disabled={!reviewer.trim() || !reasonEn.trim()}
          onClick={async () => {
            try {
              const r = await publishCorrectionAction(analysisId, { grade, confidence, reasonEn, reasonEs, reviewer, taskId });
              setDone(r.toVersion);
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            }
          }}
        >
          {t('correct')}
        </button>
      </div>
    </details>
  );
}
