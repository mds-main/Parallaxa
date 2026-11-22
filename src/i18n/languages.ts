/**
 * Language registry: the single source of truth for every supported language (PRD F7, TODO 4.1).
 * Routing, detection, the switcher, hreflang, manifests, emails, CI checks, prompt loading and evals
 * all read from here. To add a language, follow docs/adding-a-language.md: add an entry with
 * `enabled: false`, add its folders under messages/, prompts/ and methodology/, then enable it.
 */
export type LanguageDefinition = {
  /** BCP 47 tag used as the locale everywhere (messages/<tag>/, prompts/<tag>/, DB columns). */
  tag: string;
  /** URL path prefix, without slash. */
  prefix: string;
  /** Primary language subtag matched against Accept-Language entries (e.g. every `es-*` → es-ES). */
  primary: string;
  /** The language's own name, shown in the switcher. Never a flag. */
  nativeName: string;
  dir: 'ltr' | 'rtl';
  /** Locale passed to Intl formatters. */
  intlLocale: string;
  /** Whether users can select it. Disabled languages may be incomplete. */
  enabled: boolean;
  /** Development-only languages (the pseudo-locale) never ship to production. */
  devOnly?: boolean;
};

export const LANGUAGES = [
  { tag: 'en', prefix: 'en', primary: 'en', nativeName: 'English', dir: 'ltr', intlLocale: 'en', enabled: true },
  { tag: 'es-ES', prefix: 'es', primary: 'es', nativeName: 'Español', dir: 'ltr', intlLocale: 'es-ES', enabled: true },
] as const satisfies readonly LanguageDefinition[];

export type Locale = (typeof LANGUAGES)[number]['tag'];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALES = LANGUAGES.map((l) => l.tag) as Locale[];

export const ENABLED_LANGUAGES: readonly LanguageDefinition[] = LANGUAGES.filter((l) => l.enabled);

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as string[]).includes(value);
}

export function getLanguage(tag: string): LanguageDefinition | undefined {
  return LANGUAGES.find((l) => l.tag === tag);
}

export function localeFromPrefix(prefix: string): Locale | undefined {
  return LANGUAGES.find((l) => l.prefix === prefix)?.tag;
}

export function prefixFor(locale: Locale): string {
  return getLanguage(locale)?.prefix ?? DEFAULT_LOCALE;
}

/** Validates a BCP 47 tag stored in the database against the registry (TODO 4.12). */
export function assertKnownLanguage(tag: string): Locale {
  if (!isLocale(tag)) throw new Error(`Unknown language tag "${tag}". Add it to src/i18n/languages.ts first.`);
  return tag;
}
