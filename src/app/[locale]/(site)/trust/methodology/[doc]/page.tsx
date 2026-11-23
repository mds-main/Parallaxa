import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { loadDoc, renderMarkdown } from '@/lib/markdown';
import { MethodologyLayout } from '@/components/MethodologyLayout';

export default async function MethodologyDoc({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params;
  setRequestLocale(locale);
  const md = loadDoc('methodology', doc, locale);
  if (!md) notFound();
  return (
    <MethodologyLayout current={doc} locale={locale}>
      {renderMarkdown(md)}
    </MethodologyLayout>
  );
}
