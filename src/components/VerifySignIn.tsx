'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

/** A button (not an automatic GET) consumes the token, so email link scanners cannot burn it. */
export function VerifySignIn({ token }: { token: string }) {
  const t = useTranslations('settings.account');
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  return (
    <div className="card mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{t('verifyTitle')}</h1>
      {failed ? (
        <p role="alert">{t('verifyFailed')}</p>
      ) : (
        <button
          className="btn btn-accent"
          onClick={async () => {
            const res = await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
            if (res.ok) router.replace('/account');
            else setFailed(true);
          }}
        >
          {t('verifyButton')}
        </button>
      )}
    </div>
  );
}
