import { DEFAULT_LOCALE, type Locale } from './languages';

/** Namespaces: one JSON file per namespace in messages/<locale>/. */
export const NAMESPACES = [
  'common',
  'home',
  'check',
  'result',
  'today',
  'ledger',
  'quiz',
  'trust',
  'settings',
  'onboarding',
  'admin',
  'errors',
] as const;

export type Messages = Record<string, unknown>;

export async function loadMessages(locale: Locale): Promise<Messages> {
  const out: Messages = {};
  for (const ns of NAMESPACES) {
    try {
      out[ns] = (await import(`../../messages/${locale}/${ns}.json`)).default;
    } catch {
      out[ns] = (await import(`../../messages/${DEFAULT_LOCALE}/${ns}.json`)).default;
    }
  }
  return out;
}
