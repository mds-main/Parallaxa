import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Briefing } from '@/components/Briefing';
import { getPlaces, getPublishedEditions, getTopics } from '@/lib/queries';
import { getActiveConfig } from '@/lib/config/store';
import { GRADES } from '@/lib/domain/types';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'today' });
  return { title: t('title') };
}

export default async function TodayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('today');
  const tc = await getTranslations('common');
  const { config } = await getActiveConfig();
  if (!config.killSwitches.briefing) return <p className="card p-6">{t('empty')}</p>;
  const [editions, places, topics] = await Promise.all([getPublishedEditions(), getPlaces(), getTopics()]);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="muted">{t('intro', { count: config.content.briefingStories })}</p>
      <Briefing
        editions={editions}
        parents={Object.fromEntries(places.map((p) => [p.id, p.parentId]))}
        placeNames={Object.fromEntries(places.map((p) => [p.id, p.names]))}
        topicNames={Object.fromEntries(topics.map((x) => [x.id, x.names]))}
        gradeLabels={Object.fromEntries(GRADES.map((g) => [g, tc(`grades.${g}`)]))}
      />
      <p className="text-center text-sm">
        <Link href="/settings">{t('settings')}</Link>
      </p>
    </div>
  );
}
