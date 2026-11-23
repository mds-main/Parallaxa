import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SettingsForm } from '@/components/SettingsForm';
import { getPlaces, getPublishedEditions, getTopics } from '@/lib/queries';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'settings' }))('title'), robots: { index: false } };
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('settings');
  const [places, topics, editions] = await Promise.all([getPlaces(), getTopics(), getPublishedEditions()]);
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="max-w-3xl muted">{t('intro')}</p>
      <SettingsForm places={places} topics={topics} editions={editions} />
    </div>
  );
}
