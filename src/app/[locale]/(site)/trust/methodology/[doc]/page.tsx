import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { loadDoc, renderMarkdown } from '@/lib/markdown';

export default async function MethodologyDoc({ params }: { params: Promise<{ locale: string; doc: string }> }) {
  const { locale, doc } = await params;
  setRequestLocale(locale);
  const md = loadDoc('methodology', doc, locale);
  if (!md) notFound();
  return <article className="mx-auto max-w-3xl">{renderMarkdown(md)}</article>;
}
