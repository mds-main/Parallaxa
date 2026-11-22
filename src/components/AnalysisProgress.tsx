'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { PIPELINE_STAGES, type PipelineStage } from '@/lib/domain/types';

type Status = { status: string; reusedFrom?: string; progress?: { stage: PipelineStage; done: PipelineStage[] }; error?: string };

export function AnalysisProgress({ id }: { id: string }) {
  const t = useTranslations('check');
  const router = useRouter();
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/check/${id}`, { cache: 'no-store' });
        const json = (await res.json()) as Status;
        if (stop) return;
        setS(json);
        if (json.status === 'reused' && json.reusedFrom) return router.replace(`/a/${json.reusedFrom}`);
        if (json.status === 'published' || json.status === 'review') return router.refresh();
        if (json.status === 'failed') return;
      } catch {
        /* retry */
      }
      setTimeout(tick, 1500);
    };
    tick();
    return () => {
      stop = true;
    };
  }, [id, router]);

  if (s?.status === 'failed') {
    return (
      <div role="alert" className="card p-6">
        <p>{t('failed', { reason: s.error ?? '' })}</p>
        <a href="./" className="btn mt-4 no-underline">{t('retry')}</a>
      </div>
    );
  }
  const done = new Set(s?.progress?.done ?? []);
  const current = s?.progress?.stage;
  return (
    <div className="card p-6" aria-live="polite" aria-busy="true">
      <h1 className="text-2xl font-semibold">{t('title')}</h1>
      <p className="mt-1 muted">{t('intro')}</p>
      <ol className="mt-5 space-y-2">
        {PIPELINE_STAGES.map((stage) => {
          const state = done.has(stage) ? 'done' : stage === current ? 'current' : 'todo';
          return (
            <li key={stage} className={`flex items-center gap-3 ${state === 'todo' ? 'text-ink-3' : ''}`}>
              <span aria-hidden="true" className={`inline-block h-3 w-3 rounded-full border-2 border-current ${state === 'done' ? 'bg-current' : ''} ${state === 'current' ? 'animate-pulse' : ''}`} />
              <span className={state === 'current' ? 'font-semibold' : ''}>{t(`stages.${stage}`)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
