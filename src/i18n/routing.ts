import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LANGUAGES, LOCALES } from './languages';

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: {
    mode: 'always',
    prefixes: Object.fromEntries(LANGUAGES.map((l) => [l.tag, `/${l.prefix}`])),
  },
  // Detection is done by our own negotiator (primary-subtag rules, src/i18n/negotiate.ts) in proxy.ts.
  localeDetection: false,
  localeCookie: { name: 'NEXT_LOCALE', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' },
});
