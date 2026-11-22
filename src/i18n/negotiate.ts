import { DEFAULT_LOCALE, ENABLED_LANGUAGES, type Locale } from './languages';

type Entry = { tag: string; q: number; index: number };

/** Parses an Accept-Language header into entries ordered by q-value (stable for equal q). */
export function parseAcceptLanguage(header: string | null | undefined): Entry[] {
  if (!header) return [];
  return header
    .split(',')
    .map((part, index) => {
      const [rawTag, ...params] = part.trim().split(';');
      const tag = (rawTag ?? '').trim();
      let q = 1;
      for (const p of params) {
        const [k, v] = p.trim().split('=');
        if (k === 'q' && v !== undefined) {
          const n = Number(v);
          q = Number.isFinite(n) ? n : 0;
        }
      }
      return { tag, q, index };
    })
    .filter((e) => e.tag && e.tag !== '*' && e.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
}

/**
 * Picks the language from browser settings (PRD F7): entries in preference order, matched on the
 * primary subtag against enabled languages; English when nothing matches. Never uses IP or place.
 */
export function negotiateLocale(
  acceptLanguage: string | null | undefined,
  languages = ENABLED_LANGUAGES,
): Locale {
  for (const entry of parseAcceptLanguage(acceptLanguage)) {
    const primary = entry.tag.toLowerCase().split('-')[0];
    const match = languages.find((l) => l.primary === primary && !l.devOnly);
    if (match) return match.tag as Locale;
  }
  return DEFAULT_LOCALE;
}

/** Full resolution order: URL prefix → saved choice (cookie) → browser → English. */
export function resolveLocale(input: {
  urlLocale?: string | null;
  savedLocale?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  const enabled = ENABLED_LANGUAGES.map((l) => l.tag);
  if (input.urlLocale && enabled.includes(input.urlLocale)) return input.urlLocale as Locale;
  if (input.savedLocale && enabled.includes(input.savedLocale)) return input.savedLocale as Locale;
  return negotiateLocale(input.acceptLanguage);
}
