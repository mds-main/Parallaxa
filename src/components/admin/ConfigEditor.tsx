'use client';
import { createContext, useContext, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import type { AppConfig } from '@/lib/config/schema';
import { FIELDS, getPath, setPath } from '@/lib/config/fields';
import { applyConfigAction } from '@/app/[locale]/admin/actions';

type Ctx = { draft: AppConfig; initial: AppConfig; update: (path: string, value: unknown) => void; replace: (next: AppConfig) => void; blockers: Record<string, string>; setBlocker: (key: string, reason: string | null) => void };
const EditorContext = createContext<Ctx | null>(null);

export function useEditor() {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor outside ConfigEditor');
  return ctx;
}

function flatten(obj: unknown, prefix = ''): Record<string, string> {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return { [prefix]: JSON.stringify(obj) };
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) Object.assign(out, flatten(v, prefix ? `${prefix}.${k}` : k));
  return out;
}

export function diffPaths(a: unknown, b: unknown): string[] {
  const fa = flatten(a);
  const fb = flatten(b);
  return [...new Set([...Object.keys(fa), ...Object.keys(fb)])].filter((k) => fa[k] !== fb[k]);
}

/** Holds a draft of the configuration; the SaveBar applies it as a new, audited version. */
export function ConfigEditor({ initial, children, costEstimate }: { initial: AppConfig; children: React.ReactNode; costEstimate?: (c: AppConfig) => { perAnalysis: number; perMonth: number } }) {
  const [draft, setDraft] = useState(initial);
  const [blockers, setBlockers] = useState<Record<string, string>>({});
  const value = useMemo<Ctx>(
    () => ({
      draft,
      initial,
      update: (path, v) => setDraft((d) => setPath(d, path, v)),
      replace: setDraft,
      blockers,
      setBlocker: (key, reason) =>
        setBlockers((b) => {
          if ((b[key] ?? null) === reason) return b;
          const next = { ...b };
          if (reason) next[key] = reason;
          else delete next[key];
          return next;
        }),
    }),
    [draft, initial, blockers],
  );
  return (
    <EditorContext.Provider value={value}>
      <div className="pb-40">{children}</div>
      <SaveBar costEstimate={costEstimate} onReset={() => setDraft(initial)} />
    </EditorContext.Provider>
  );
}

function SaveBar({ onReset, costEstimate }: { onReset: () => void; costEstimate?: (c: AppConfig) => { perAnalysis: number; perMonth: number } }) {
  const t = useTranslations('admin.common');
  const tf = useTranslations('admin.features');
  const locale = useLocale() as 'en' | 'es-ES';
  const router = useRouter();
  const { draft, initial, blockers } = useEditor();
  const blocked = Object.values(blockers);
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const changed = diffPaths(initial, draft);
  if (!changed.length && !message) return null;

  const descriptors = changed.map((p) => FIELDS.find((f) => p === f.path || p.startsWith(`${f.path}.`))).filter(Boolean);
  const killOff = changed.some((p) => p.startsWith('killSwitches.') && getPath(draft, p) === false);
  const dangerous = killOff || descriptors.some((d) => d!.dangerous);
  const affects = [...new Set(descriptors.flatMap((d) => d!.affects))];
  const est = costEstimate ? { before: costEstimate(initial), after: costEstimate(draft) } : null;
  const fmt = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: n < 1 ? 3 : 0 }).format(n);

  async function apply() {
    setBusy(true);
    setMessage(null);
    const res = await applyConfigAction(draft, reason);
    setBusy(false);
    if (res.ok) {
      setMessage({ ok: true, text: t('applied') });
      setReason('');
      setConfirmText('');
      router.refresh();
    } else setMessage({ ok: false, text: t('error', { problems: res.problems.join('; ') }) });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-card shadow-lg" role="region" aria-label={t('pending', { count: changed.length })}>
      <div className="mx-auto grid max-w-6xl gap-3 px-4 py-3 md:grid-cols-[1fr_auto]">
        <div className="space-y-2">
          {changed.length > 0 && (
            <>
              <p className="font-semibold">{t('pending', { count: changed.length })}</p>
              <ul className="flex flex-wrap gap-1 text-xs">
                {changed.slice(0, 8).map((p) => (
                  <li key={p} className="chip">
                    {FIELDS.find((f) => f.path === p)?.label[locale] ?? p}: {String(getPath(initial, p) ?? '—').slice(0, 30)} → <strong>{String(getPath(draft, p) ?? '—').slice(0, 30)}</strong>
                  </li>
                ))}
              </ul>
              {(est || affects.length > 0) && (
                <p className="text-sm muted">
                  {est && `${t('impact')}: ${t('costPerAnalysis', { value: fmt(est.after.perAnalysis) })} (${fmt(est.before.perAnalysis)} →), ${t('costPerMonth', { value: fmt(est.after.perMonth) })}. `}
                  {affects.length > 0 && t('affects', { features: affects.map((a) => tf(a)).join(', ') })}
                </p>
              )}
              <label className="block">
                <span className="label">{t('reason')}</span>
                <input className="field mt-1" value={reason} placeholder={t('reasonPlaceholder')} onChange={(e) => setReason(e.target.value)} />
              </label>
              {dangerous && (
                <label className="block">
                  <span className="label">{t('dangerous')}</span>
                  <input className="field mt-1" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                </label>
              )}
            </>
          )}
          {blocked.length > 0 && <ul className="text-sm font-medium">{blocked.map((b) => <li key={b}>⚠ {b}</li>)}</ul>}
          {message && <p role="status" className={message.ok ? 'font-medium' : 'font-medium underline'}>{message.text}</p>}
        </div>
        {changed.length > 0 && (
          <div className="flex items-end gap-2">
            <button className="btn btn-ghost" onClick={onReset} disabled={busy}>{t('discard')}</button>
            <button className="btn btn-accent" onClick={apply} disabled={busy || blocked.length > 0 || !reason.trim() || (dangerous && confirmText.trim() !== t('confirmWord'))}>
              {t('apply')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
