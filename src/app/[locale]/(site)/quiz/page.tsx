import { getTranslations, setRequestLocale } from 'next-intl/server';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { quizItems } from '@/lib/db/schema';
import { getActiveConfig } from '@/lib/config/store';
import { getPlaces } from '@/lib/queries';
import { Quiz } from '@/components/Quiz';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'quiz' }))('title') };
}

export default async function QuizPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('quiz');
  const { config } = await getActiveConfig();
  const db = await getDb();
  const items = config.killSwitches.quiz && config.content.quizCountries.length
    ? await db.select().from(quizItems).where(and(eq(quizItems.active, true), inArray(quizItems.placeId, config.content.quizCountries)))
    : [];
  const places = await getPlaces();
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">{t('title')}</h1>
      <p className="max-w-3xl muted">{t('intro')}</p>
      <Quiz items={items} countryNames={Object.fromEntries(places.map((p) => [p.id, p.names[locale] ?? p.id]))} />
    </div>
  );
}
