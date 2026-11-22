'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { setSessionScope, useSessionScope, useStoredPreferences } from '@/lib/prefs/hooks';

/**
 * Header scope chip (PRD F6): shows the user's places and lets them narrow what they see for this visit
 * only, without changing saved preferences. "Change places" opens Your Parallaxa.
 */
export function ScopeChip({ placeNames }: { placeNames: Record<string, Record<string, string>> }) {
  const t = useTranslations('common.scope');
  const locale = useLocale();
  const p = useStoredPreferences();
  const session = useSessionScope();
  const [open, setOpen] = useState(false);
  if (!p) return null;
  const all = [...p.places.map((pl) => pl.id), ...(p.global ? ['GLOBAL'] : [])];
  const active = session ?? all;
  const name = (id: string) => (id === 'GLOBAL' ? t('global') : (placeNames[id]?.[locale] ?? id));
  const label = active.map(name).join(' · ');
  const toggle = (id: string) => {
    const next = active.includes(id) ? active.filter((x) => x !== id) : [...active, id];
    setSessionScope(next.length && next.length < all.length ? next : null);
  };
  return (
    <div className="relative">
      <button type="button" className="chip max-w-[11rem] truncate hover:border-ink-3 sm:max-w-[14rem]" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
        <span className="sr-only">{t('label')}: </span>
        <span className="truncate">{label}</span>
        {session && <span aria-hidden="true">•</span>}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="card absolute right-0 z-40 mt-2 w-64 p-3 text-sm">
          <p className="muted">{t('session')}</p>
          <ul className="mt-2 space-y-1">
            {all.map((id) => (
              <li key={id}>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={active.includes(id)} onChange={() => toggle(id)} />
                  {name(id)}
                </label>
              </li>
            ))}
          </ul>
          <Link href="/settings" className="mt-3 block underline" onClick={() => setOpen(false)}>
            {t('change')}
          </Link>
        </div>
      )}
    </div>
  );
}
