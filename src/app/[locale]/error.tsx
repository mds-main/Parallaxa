'use client';
import { useTranslations } from 'next-intl';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations('errors');
  return (
    <div role="alert" className="card mx-auto max-w-lg p-8 text-center">
      <p className="font-serif text-2xl">{t('generic')}</p>
      <button className="btn mt-6" onClick={reset}>↻</button>
    </div>
  );
}
