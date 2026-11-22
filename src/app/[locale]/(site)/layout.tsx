import { getLocale, getTranslations } from 'next-intl/server';
import { SiteHeader } from '@/components/SiteHeader';
import { BottomNav } from '@/components/BottomNav';
import { SiteFooter } from '@/components/SiteFooter';
import { getActiveConfig } from '@/lib/config/store';
import { isDemoMode } from '@/lib/ai/client';
import type { Locale } from '@/i18n/languages';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations('common');
  const { config } = await getActiveConfig();
  const banner = config.content.maintenanceBanner[locale] ?? config.content.maintenanceBanner.en;
  return (
    <>
      {isDemoMode() && (
        <div role="note" className="bg-accent/20 px-4 py-1.5 text-center text-sm text-ink">
          {t('demoBanner')}
        </div>
      )}
      {banner && (
        <div role="status" className="border-b border-line bg-paper-2 px-4 py-2 text-center text-sm">
          {banner}
        </div>
      )}
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pt-6">
        {children}
      </main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
