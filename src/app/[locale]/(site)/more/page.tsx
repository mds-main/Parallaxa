import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default async function MorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('common.nav');
  const ta = await getTranslations('settings.account');
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {(['/quiz', '/trust', '/settings', '/account'] as const).map((href) => (
        <Link key={href} href={href} className="card block p-4 text-lg font-medium no-underline">
          {href === '/account' ? ta('title') : t(href === '/quiz' ? 'quiz' : href === '/trust' ? 'trust' : 'settings')}
        </Link>
      ))}
      <div className="card p-4 sm:col-span-2 xl:col-span-4"><LanguageSwitcher /></div>
    </div>
  );
}
