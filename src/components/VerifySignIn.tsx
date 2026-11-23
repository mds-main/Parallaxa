'use client';
import { useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

/** A button (not an automatic GET) consumes the token, so email link scanners cannot burn it. */
export function VerifySignIn({ token }: { token: string }) {
  const t = useTranslations('settings.account');
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  // Enabled only once the page is interactive (false on the server, true after hydration), so an early tap is never lost.
  const ready = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const [busy, setBusy] = useState(false);
  return (
    <div className="card mx-auto max-w-md space-y-4 p-6">
      <h1 className="text-2xl font-semibold">{t('verifyTitle')}</h1>
      {failed ? (
        <p role="alert">{t('verifyFailed')}</p>
      ) : (
        <button
          className="btn btn-accent"
          disabled={!ready || busy}
          aria-busy={busy}
          onClick={async () => {
            setBusy(true);
            const res = await fetch('/api/auth/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }).catch(() => null);
            if (res?.ok) router.replace('/account');
            else {
              setFailed(true);
              setBusy(false);
            }
          }}
        >
          {t('verifyButton')}
        </button>
      )}
    </div>
  );
}
