import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

const SECTIONS = [
  ['methodology', '/trust/methodology'],
  ['models', '/trust/models'],
  ['corrections', '/trust/corrections'],
  ['prompts', 'https://github.com/mds-main/Parallaxa/tree/main/prompts'],
  ['audits', '/trust/audits'],
  ['funding', '/trust/funding'],
  ['status', '/trust/status'],
] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'trust' }))('title') };
}

export default async function TrustPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('trust');
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="max-w-3xl text-lg">{t('intro')}</p>
      <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(([key, href]) => (
          <li key={key}>
            {href.startsWith('http') ? (
              <a href={href} className="card block h-full p-5 no-underline" rel="noopener noreferrer">
                <h2 className="text-lg font-semibold">{t(`sections.${key}.title`)}</h2>
                <p className="mt-1 text-sm muted">{t(`sections.${key}.text`)}</p>
              </a>
            ) : (
              <Link href={href} className="card block h-full p-5 no-underline">
                <h2 className="text-lg font-semibold">{t(`sections.${key}.title`)}</h2>
                <p className="mt-1 text-sm muted">{t(`sections.${key}.text`)}</p>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
