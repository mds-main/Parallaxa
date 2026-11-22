import { getTranslations } from 'next-intl/server';
import { isLocale, prefixFor, getLanguage, DEFAULT_LOCALE } from '@/i18n/languages';

/** One web app manifest per language (PRD 8.5, TODO 4.15). */
export async function GET(_req: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  const t = await getTranslations({ locale, namespace: 'common' });
  const prefix = prefixFor(locale);
  const manifest = {
    name: 'Parallaxa',
    short_name: 'Parallaxa',
    description: t('tagline'),
    lang: locale,
    dir: getLanguage(locale)?.dir ?? 'ltr',
    start_url: `/${prefix}?source=pwa`,
    scope: '/',
    id: '/',
    display: 'standalone',
    background_color: '#f7f5f0',
    theme_color: '#f7f5f0',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    shortcuts: [
      { name: t('nav.check'), url: `/${prefix}` },
      { name: t('nav.today'), url: `/${prefix}/today` },
    ],
    share_target: { action: '/api/share', method: 'POST', enctype: 'multipart/form-data', params: { title: 'title', text: 'text', url: 'url' } },
  };
  return new Response(JSON.stringify(manifest), { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' } });
}
