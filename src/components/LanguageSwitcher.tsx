'use client';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { ENABLED_LANGUAGES, type Locale } from '@/i18n/languages';
import { useTransition } from 'react';

export function LanguageSwitcher({ disabled = [] }: { disabled?: string[] }) {
  const t = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <span className="sr-only">{t('language')}</span>
      <select
        className="field !min-h-9 !w-auto !py-1 text-sm"
        value={locale}
        disabled={pending}
        aria-label={t('language')}
        onChange={(e) => {
          const next = e.target.value as Locale;
          document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
          start(() => router.replace(pathname, { locale: next }));
        }}
      >
        {ENABLED_LANGUAGES.filter((l) => !disabled.includes(l.tag)).map((l) => (
          <option key={l.tag} value={l.tag} lang={l.tag}>
            {l.nativeName}
          </option>
        ))}
      </select>
    </label>
  );
}
