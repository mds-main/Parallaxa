import { describe, expect, it } from 'vitest';
import { negotiateLocale, parseAcceptLanguage, resolveLocale } from './negotiate';
import { ENABLED_LANGUAGES, LANGUAGES } from './languages';

describe('negotiateLocale (PRD F7 acceptance criteria)', () => {
  it.each([
    ['es-MX,es;q=0.9', 'es-ES'],
    ['es-419', 'es-ES'],
    ['ca,es;q=0.8,en;q=0.5', 'es-ES'],
    ['en-GB', 'en'],
    ['fr-FR,de;q=0.8', 'en'],
    ['', 'en'],
    [null, 'en'],
    ['en;q=0.4,es;q=0.9', 'es-ES'],
    ['*', 'en'],
    ['es;q=0', 'en'],
  ])('%s → %s', (header, expected) => {
    expect(negotiateLocale(header)).toBe(expected);
  });

  it('keeps header order for equal q-values', () => {
    expect(parseAcceptLanguage('es, en').map((e) => e.tag)).toEqual(['es', 'en']);
  });
});

describe('resolveLocale order', () => {
  it('URL beats cookie beats header', () => {
    expect(resolveLocale({ urlLocale: 'en', savedLocale: 'es-ES', acceptLanguage: 'es' })).toBe('en');
    expect(resolveLocale({ savedLocale: 'es-ES', acceptLanguage: 'en' })).toBe('es-ES');
    expect(resolveLocale({ savedLocale: 'xx', acceptLanguage: 'es-AR' })).toBe('es-ES');
  });
});

describe('registry-driven (runs for every language, TODO 4.5)', () => {
  it.each(ENABLED_LANGUAGES.map((l) => [l.tag, l.primary]))('%s is chosen for its primary subtag %s', (tag, primary) => {
    expect(negotiateLocale(`${primary}-ZZ`)).toBe(tag);
  });
  it('prefixes and tags are unique', () => {
    expect(new Set(LANGUAGES.map((l) => l.prefix)).size).toBe(LANGUAGES.length);
    expect(new Set(LANGUAGES.map((l) => l.tag)).size).toBe(LANGUAGES.length);
  });
});
