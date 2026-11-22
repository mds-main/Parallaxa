import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default async function MorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('common.nav');
  return (
    <div className="mx-auto max-w-md space-y-3">
      {(['/quiz', '/trust', '/settings'] as const).map((href) => (
        <Link key={href} href={href} className="card block p-4 text-lg font-medium no-underline">
          {t(href === '/quiz' ? 'quiz' : href === '/trust' ? 'trust' : 'settings')}
        </Link>
      ))}
      <div className="card p-4"><LanguageSwitcher /></div>
    </div>
  );
}
