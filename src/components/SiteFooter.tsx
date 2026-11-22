import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function SiteFooter() {
  const t = await getTranslations('common');
  return (
    <footer className="mt-16 border-t border-line pb-24 lg:pb-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-ink-3 md:flex-row md:items-center md:justify-between">
        <p>{t('footer')}</p>
        <ul className="flex flex-wrap gap-4">
          <li><Link href="/trust">{t('footerLinks.trust')}</Link></li>
          <li><Link href="/trust/methodology">{t('footerLinks.methodology')}</Link></li>
          <li><Link href="/trust/privacy">{t('footerLinks.privacy')}</Link></li>
          <li><Link href="/trust/status">{t('footerLinks.status')}</Link></li>
        </ul>
      </div>
    </footer>
  );
}
