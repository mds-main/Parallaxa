import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { ENABLED_LANGUAGES, getLanguage, prefixFor, type Locale } from '@/i18n/languages';
import { SiteHeader } from '@/components/SiteHeader';
import { BottomNav } from '@/components/BottomNav';
import { SiteFooter } from '@/components/SiteFooter';
import { getActiveConfig } from '@/lib/config/store';
import { isDemoMode } from '@/lib/ai/client';
import { ServiceWorker } from '@/components/ServiceWorker';
import '../globals.css';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common' });
  return {
    metadataBase: new URL(SITE),
    title: { default: `${t('appName')}: ${t('tagline')}`, template: `%s · ${t('appName')}` },
    description: t('tagline'),
    manifest: `/manifest/${locale}`,
    alternates: {
      languages: { ...Object.fromEntries(ENABLED_LANGUAGES.map((l) => [l.tag, `/${l.prefix}`])), 'x-default': '/en' },
    },
    openGraph: { siteName: 'Parallaxa', locale, type: 'website' },
    icons: { icon: '/icons/icon.svg', apple: '/icons/apple-touch-icon.png' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f5f0' },
    { media: '(prefers-color-scheme: dark)', color: '#16181c' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const lang = getLanguage(locale)!;
  const t = await getTranslations('common');
  const { config } = await getActiveConfig();
  const banner = config.content.maintenanceBanner[locale as Locale] ?? config.content.maintenanceBanner.en;
  return (
    <html lang={locale} dir={lang.dir}>
      <body className="bg-paper text-ink antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider>
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
          <ServiceWorker prefix={prefixFor(locale as Locale)} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
