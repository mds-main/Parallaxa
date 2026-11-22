import { setRequestLocale } from 'next-intl/server';
import { loadDoc, renderMarkdown } from '@/lib/markdown';

export default async function PrivacyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <article className="mx-auto max-w-3xl">{renderMarkdown(loadDoc('methodology', 'privacy', locale) ?? '')}</article>;
}
