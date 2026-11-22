import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CheckForm } from '@/components/CheckForm';
import { RecentChecks } from '@/components/RecentChecks';
import { OnboardingGate } from '@/components/OnboardingGate';

export default async function Home({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ text?: string; url?: string; title?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations('home');
  const shared = [sp.title, sp.text, sp.url].filter(Boolean).join(' ').slice(0, 8000);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <OnboardingGate />
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold md:text-4xl">{t('title')}</h1>
        <CheckForm initialText={shared} />
        <section className="card p-5" aria-labelledby="how-title">
          <h2 id="how-title" className="text-lg font-semibold">{t('how.title')}</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-2">
            <li>{t('how.step1')}</li>
            <li>{t('how.step2')}</li>
            <li>{t('how.step3')}</li>
          </ol>
        </section>
      </div>
      <aside className="space-y-6">
        <section className="card p-5" aria-labelledby="today-title">
          <h2 id="today-title" className="text-lg font-semibold">{t('today.title')}</h2>
          <p className="mt-1 text-sm muted">{t('today.subtitle')}</p>
          <Link href="/today" className="btn mt-4 w-full no-underline">
            {t('today.cta')}
          </Link>
        </section>
        <RecentChecks />
      </aside>
    </div>
  );
}
