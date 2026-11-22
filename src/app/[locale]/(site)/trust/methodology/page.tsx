import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { loadDoc, renderMarkdown } from '@/lib/markdown';

const DOCS = ['grades', 'sources', 'models', 'ledger'] as const;

export default async function MethodologyIndex({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('trust');
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-3xl font-semibold">{t('sections.methodology.title')}</h1>
      <ul className="space-y-2">
        {DOCS.map((d) => {
          const md = loadDoc('methodology', d, locale) ?? '';
          const title = md.match(/^#\s+(.*)$/m)?.[1] ?? d;
          return (
            <li key={d}>
              <Link href={`/trust/methodology/${d}`} className="card block p-4 font-medium no-underline">{title}</Link>
            </li>
          );
        })}
      </ul>
      <div className="hidden">{renderMarkdown('')}</div>
    </div>
  );
}
