'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { resolveReviewAction } from '@/app/[locale]/admin/actions';
import { CorrectionForm } from './CorrectionForm';

type Task = { id: string; kind: string; refId: string; priority: number; dueAt: string | null; notes: string | null; createdAt: string; summary?: string; verdicts?: { slot: string; model: string; grade: string | null; abstained: boolean; coi: boolean; reasoning: string }[]; sources?: { title: string; url: string; tier: number; hash?: string }[] };

export function ReviewQueue({ tasks }: { tasks: Task[] }) {
  const t = useTranslations('admin.review');
  const router = useRouter();
  const [reviewer, setReviewer] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  if (!tasks.length) return <p className="card p-6">{t('empty')}</p>;
  const act = async (id: string, decision: 'approve' | 'reviewed' | 'escalate') => {
    setBusy(id);
    await resolveReviewAction(id, decision, reviewer, notes[id] ?? '');
    setBusy(null);
    router.refresh();
  };
  return (
    <div className="space-y-4">
      <label className="block max-w-sm">
        <span className="label">{t('reviewer')}</span>
        <input className="field mt-1" value={reviewer} onChange={(e) => setReviewer(e.target.value)} />
      </label>
      <ul className="grid items-start gap-3 3xl:grid-cols-2">
        {tasks.map((task) => {
          const analysisId = task.kind === 'error_report' ? task.notes?.split('\n')[0] : task.refId.split(':')[0];
          return (
            <li key={task.id} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip">P{task.priority}</span>
                <span className="font-semibold">{t(`kinds.${task.kind}`)}</span>
                {task.dueAt && <span className="text-sm muted">{t('due', { date: new Date(task.dueAt) })}</span>}
                {analysisId && /^[0-9a-f-]{36}$/.test(analysisId) && <Link href={`/a/${analysisId}`} className="ml-auto text-sm" target="_blank">{t('open')} ↗</Link>}
              </div>
              {task.summary && <p className="text-sm">{task.summary}</p>}
              {task.verdicts && task.verdicts.length > 0 && (
                <div className="grid gap-2 md:grid-cols-3">
                  {task.verdicts.map((v) => (
                    <div key={v.slot} className="rounded-lg border border-line p-2 text-xs">
                      <p className="font-semibold">{v.slot} · {v.model}</p>
                      <p>{v.abstained ? 'abstained' : v.grade}{v.coi ? ' · COI (not counted)' : ''}</p>
                      <p className="mt-1 whitespace-pre-line muted">{v.reasoning}</p>
                    </div>
                  ))}
                </div>
              )}
              {task.sources && task.sources.length > 0 && (
                <ul className="text-xs">
                  {task.sources.map((src) => (
                    <li key={src.url}>
                      T{src.tier} <a href={src.url} target="_blank" rel="noopener noreferrer">{src.title}</a>
                      {src.hash && <> · <a href={`/api/admin/snapshot/${src.hash}`} target="_blank" rel="noopener noreferrer">archived copy</a></>}
                    </li>
                  ))}
                </ul>
              )}
              {task.notes && task.kind !== 'error_report' && <p className="text-sm muted whitespace-pre-line">{task.notes}</p>}
              <label className="block text-sm">
                <span className="muted">{t('notes')}</span>
                <input className="field mt-1 !min-h-9" value={notes[task.id] ?? ''} onChange={(e) => setNotes({ ...notes, [task.id]: e.target.value })} />
              </label>
              {analysisId && /^[0-9a-f-]{36}$/.test(analysisId) && <CorrectionForm analysisId={analysisId} taskId={task.id} reviewer={reviewer} />}
              <div className="flex flex-wrap gap-2">
                <button className="btn !min-h-9 !py-1 text-sm" disabled={!reviewer.trim() || busy === task.id} onClick={() => act(task.id, 'approve')}>{t('approve')}</button>
                <button className="btn btn-ghost !min-h-9 !py-1 text-sm" disabled={!reviewer.trim() || busy === task.id} onClick={() => act(task.id, 'reviewed')}>{t('markReviewed')}</button>
                <button className="btn btn-ghost !min-h-9 !py-1 text-sm" disabled={!reviewer.trim() || busy === task.id} onClick={() => act(task.id, 'escalate')}>{t('escalate')}</button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
