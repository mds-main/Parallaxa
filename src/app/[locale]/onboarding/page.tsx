import { setRequestLocale } from 'next-intl/server';
import { Onboarding } from '@/components/Onboarding';
import { getPlaces, getTopics } from '@/lib/queries';

export const metadata = { robots: { index: false } };

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [places, topics] = await Promise.all([getPlaces(), getTopics()]);
  return <Onboarding places={places} topics={topics} />;
}
