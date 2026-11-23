import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountPanel } from '@/components/AccountPanel';

export const metadata = { robots: { index: false } };

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings.account');
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="max-w-3xl muted">{t('intro')}</p>
      <AccountPanel />
    </div>
  );
}
