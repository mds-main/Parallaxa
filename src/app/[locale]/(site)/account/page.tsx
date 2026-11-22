import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AccountPanel } from '@/components/AccountPanel';

export const metadata = { robots: { index: false } };

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings.account');
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="muted">{t('intro')}</p>
      <AccountPanel />
    </div>
  );
}
