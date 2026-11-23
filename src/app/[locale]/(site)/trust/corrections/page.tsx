import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getCorrections } from '@/lib/queries';

export default async function CorrectionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('trust.corrections');
  const format = await getFormatter();
  const list = await getCorrections();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold">{t('title')}</h1>
        <a href={`/rss/corrections?lang=${locale}`} className="text-sm">{t('rss')}</a>
      </div>
      {list.length === 0 ? (
        <p className="card p-6">{t('empty')}</p>
      ) : (
        <ol className="grid gap-3 lg:grid-cols-2 3xl:grid-cols-3">
          {list.map((c) => (
            <li key={c.id} className="card p-4">
              <p className="text-sm muted">{format.dateTime(c.createdAt, { dateStyle: 'medium' })} · {t('changed', { from: c.fromVersion, to: c.toVersion })}</p>
              <p className="mt-1">{c.reason[locale] ?? c.reason.en}</p>
              <Link href={`/a/${c.analysisId}`} className="text-sm">→</Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
