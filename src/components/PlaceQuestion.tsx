'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useStoredPreferences } from '@/lib/prefs/hooks';

export type PlaceChoice = { id: string; parentId: string | null; level: string; names: Record<string, string>; localName: string | null };

/**
 * Asked when a claim's truth depends on a place it doesn't name. The answer becomes part of the claim,
 * so everyone who asks the same claim about the same place gets the same analysis. The reader's home
 * place is only offered as a choice; it is never applied on their behalf.
 */
export function PlaceQuestion({ id, suggestions, places, onAnswered }: { id: string; suggestions: string[]; places: PlaceChoice[]; onAnswered: () => void }) {
  const t = useTranslations('check.place');
  const locale = useLocale();
  const prefs = useStoredPreferences();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const byId = new Map(places.map((p) => [p.id, p]));
  const name = (p: PlaceChoice) => p.names[locale] ?? p.names.en ?? p.id;
  const label = (p: PlaceChoice) => (p.parentId && p.parentId !== 'GLOBAL' && byId.get(p.parentId) ? `${name(p)} · ${name(byId.get(p.parentId)!)}` : name(p));

  const home = prefs?.places.find((p) => p.home)?.id;
  const offered = [...new Set([home, ...suggestions].filter((x): x is string => Boolean(x) && byId.has(x!)))].slice(0, 5);
  const matches = q.trim()
    ? places
        .filter((p) => p.level !== 'global')
        .filter((p) => `${name(p)} ${p.localName ?? ''} ${p.names.en ?? ''} ${p.id}`.toLowerCase().includes(q.trim().toLowerCase()))
        .slice(0, 8)
    : [];

  async function choose(place: string) {
    setBusy(true);
    setError(false);
    const res = await fetch(`/api/check/${id}/place`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ place }) }).catch(() => null);
    if (res && (res.ok || res.status === 409)) onAnswered();
    else {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <section className="card mx-auto max-w-3xl space-y-4 p-6 md:p-8" aria-labelledby="place-question">
      <div>
        <h1 id="place-question" className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 muted">{t('intro')}</p>
      </div>
      {offered.length > 0 && (
        <div>
          <p className="label">{t('suggested')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {offered.map((pid) => (
              <button key={pid} type="button" className="btn btn-ghost" disabled={busy} onClick={() => choose(pid)}>
                {label(byId.get(pid)!)}
                {pid === home ? <span className="ml-1 text-sm muted">· {t('home')}</span> : null}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="relative">
        <label className="label" htmlFor="place-q">{t('search')}</label>
        <input id="place-q" className="field mt-1" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" disabled={busy} />
        {matches.length > 0 && (
          <ul className="card absolute z-10 mt-1 w-full p-1" role="listbox" aria-label={t('search')}>
            {matches.map((p) => (
              <li key={p.id}>
                <button type="button" role="option" aria-selected={false} className="w-full rounded-lg px-3 py-2 text-left hover:bg-paper-2" disabled={busy} onClick={() => choose(p.id)}>
                  {label(p)}
                  {p.localName && <span className="ml-1 text-sm muted">({p.localName})</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => choose('GLOBAL')}>
          {t('global')}
        </button>
        {busy && <span role="status">{t('sending')}</span>}
        {error && <span role="alert">{t('error')}</span>}
      </div>
      <p className="text-sm muted">{t('note')}</p>
    </section>
  );
}
