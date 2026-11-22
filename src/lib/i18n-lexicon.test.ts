import { describe, expect, it } from 'vitest';
import { latamTerms } from './i18n-lexicon';
import { negotiateLocale } from '@/i18n/negotiate';
import { LANGUAGES, type LanguageDefinition } from '@/i18n/languages';

describe('es-ES lexicon', () => {
  it('flags Latin American-only terms and accepts Spain usage', () => {
    expect(latamTerms('Usa la computadora y el celular')).toHaveLength(2);
    expect(latamTerms('Usa el ordenador y el móvil; vosotros conducís')).toHaveLength(0);
  });
});

describe('"add a language" dry run (TODO 4.20)', () => {
  it('a new registry entry is picked up by detection without other code changes, and only once enabled', () => {
    const fr: LanguageDefinition = { tag: 'fr-FR', prefix: 'fr', primary: 'fr', nativeName: 'Français', dir: 'ltr', intlLocale: 'fr-FR', enabled: false };
    const disabled = [...LANGUAGES, fr].filter((l) => l.enabled);
    expect(negotiateLocale('fr-CA,fr;q=0.9', disabled)).toBe('en');
    const enabled = [...LANGUAGES, { ...fr, enabled: true }].filter((l) => l.enabled);
    expect(negotiateLocale('fr-CA,fr;q=0.9', enabled)).toBe('fr-FR');
    expect(negotiateLocale('es-MX', enabled)).toBe('es-ES');
  });
});
