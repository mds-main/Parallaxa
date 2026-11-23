import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { loadDoc } from '@/lib/markdown';

/** Public methodology documents, in reading order. Privacy has its own route. */
export const METHODOLOGY_DOCS = [
  ['grades', '/trust/methodology/grades'],
  ['sources', '/trust/methodology/sources'],
  ['models', '/trust/methodology/models'],
  ['ledger', '/trust/methodology/ledger'],
  ['privacy', '/trust/privacy'],
] as const;

export function docTitle(name: string, locale: string): string {
  return loadDoc('methodology', name, locale)?.match(/^#\s+(.*)$/m)?.[1] ?? name;
}

/**
 * Long-form document layout: the text keeps a comfortable line length (~75 characters) at every size,
 * so on wide screens the text column and a sticky sidebar of the other methodology documents are centred together.
 */
export async function MethodologyLayout({ current, locale, children }: { current: string; locale: string; children: React.ReactNode }) {
  const t = await getTranslations('trust');
  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,50rem)] lg:justify-center xl:gap-16 2xl:grid-cols-[18rem_minmax(0,54rem)] 3xl:gap-24">
      <nav aria-label={t('sections.methodology.title')} className="order-last lg:order-none">
        <div className="lg:sticky lg:top-20">
          <p className="text-sm font-semibold muted">
            <Link href="/trust/methodology">{t('sections.methodology.title')}</Link>
          </p>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
            {METHODOLOGY_DOCS.map(([name, href]) => (
              <li key={name}>
                <Link
                  href={href}
                  aria-current={name === current ? 'page' : undefined}
                  className={`block rounded-lg px-3 py-2 text-sm no-underline ${name === current ? 'bg-paper-2 font-semibold' : 'hover:bg-paper-2'}`}
                >
                  {docTitle(name, locale)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <article className="min-w-0 max-w-[75ch] 2xl:text-lg">{children}</article>
    </div>
  );
}
