'use client';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { loadPreferences } from '@/lib/prefs/storage';

/** Header scope chip (PRD F6): shows the user's places; links to Your Parallaxa to change them. */
export function ScopeChip({ placeNames }: { placeNames: Record<string, Record<string, string>> }) {
  const t = useTranslations('common.scope');
  const locale = useLocale();
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    const update = () => {
      const p = loadPreferences();
      if (!p) return setLabel(null);
      const names = p.places.map((pl) => placeNames[pl.id]?.[locale] ?? pl.id);
      if (p.global && !p.places.some((x) => x.mode === 'focus')) names.push(t('global'));
      setLabel(names.join(' · '));
    };
    update();
    window.addEventListener('plx:prefs', update);
    return () => window.removeEventListener('plx:prefs', update);
  }, [locale, placeNames, t]);
  if (!label) return null;
  return (
    <Link href="/settings" className="chip max-w-[11rem] truncate no-underline hover:border-ink-3 sm:max-w-[14rem]" title={t('change')}>
      <span className="sr-only">{t('label')}: </span>
      <span className="truncate">{label}</span>
      <span aria-hidden="true">▾</span>
    </Link>
  );
}
