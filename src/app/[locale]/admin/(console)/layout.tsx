import { getLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { logoutAction } from '../actions';
import { isDemoMode } from '@/lib/ai/client';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

const NAV = ['overview', 'models', 'investigation', 'pipeline', 'limits', 'content', 'review', 'metrics', 'alerts', 'audit'] as const;

export const metadata = { robots: { index: false, follow: false }, title: 'Admin' };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  await requireAdmin(locale);
  const t = await getTranslations('admin');
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[14rem_1fr]">
      <aside className="border-b border-line bg-paper-2 md:min-h-dvh md:border-r md:border-b-0">
        <div className="flex items-center justify-between p-4 md:block">
          <p className="font-serif text-lg font-semibold">{t('title')}</p>
          <div className="md:mt-3"><LanguageSwitcher /></div>
        </div>
        <nav aria-label={t('title')} className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:overflow-visible">
          {NAV.map((k) => (
            <Link key={k} href={k === 'overview' ? '/admin' : `/admin/${k}`} className="rounded-lg px-3 py-2 text-sm whitespace-nowrap no-underline hover:bg-card">
              {t(`nav.${k}`)}
            </Link>
          ))}
          <Link href="/" className="rounded-lg px-3 py-2 text-sm whitespace-nowrap no-underline hover:bg-card">{t('nav.viewSite')} ↗</Link>
          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="w-full rounded-lg px-3 py-2 text-left text-sm whitespace-nowrap hover:bg-card">{t('nav.logout')}</button>
          </form>
        </nav>
      </aside>
      <main id="main" className="px-4 py-6 md:px-8">
        {isDemoMode() && <p role="note" className="mb-4 rounded-lg bg-accent/20 p-3 text-sm">{t('common.demoMode')}</p>}
        {children}
      </main>
    </div>
  );
}
