'use client';
import { useTranslations } from 'next-intl';

/** The digest matches `digest=` on the server's `request.failed` log line, so a reported reference finds the cause. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('errors');
  return (
    <div role="alert" className="card mx-auto max-w-lg p-8 text-center">
      <p className="font-serif text-2xl">{t('generic')}</p>
      {error.digest && <p className="mt-3 text-sm muted">{t('reference', { digest: error.digest })}</p>}
      <button className="btn mt-6" onClick={reset}>↻</button>
    </div>
  );
}
