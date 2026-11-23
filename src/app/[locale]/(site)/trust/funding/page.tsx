import { getTranslations, setRequestLocale } from 'next-intl/server';

export default async function FundingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('trust.funding');
  return (
    <article className="max-w-4xl space-y-4">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="max-w-[70ch] text-lg leading-relaxed xl:text-xl">{t('body')}</p>
    </article>
  );
}
