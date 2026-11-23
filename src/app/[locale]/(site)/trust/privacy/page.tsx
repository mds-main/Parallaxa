import { setRequestLocale } from 'next-intl/server';
import { loadDoc, renderMarkdown } from '@/lib/markdown';
import { MethodologyLayout } from '@/components/MethodologyLayout';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <MethodologyLayout current="privacy" locale={locale}>
      {renderMarkdown(loadDoc('methodology', 'privacy', locale) ?? '')}
    </MethodologyLayout>
  );
}
