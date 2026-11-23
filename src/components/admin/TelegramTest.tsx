'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { sendTestAlertAction } from '@/app/[locale]/admin/actions';

export function TelegramTest() {
  const t = useTranslations('admin.alerts.telegram');
  const [state, setState] = useState<'idle' | 'busy' | 'ok' | 'failed'>('idle');
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        className="btn btn-ghost"
        disabled={state === 'busy'}
        onClick={async () => {
          setState('busy');
          const r = await sendTestAlertAction().catch(() => ({ delivered: 0 }));
          setState(r.delivered > 0 ? 'ok' : 'failed');
        }}
      >
        {t('test')}
      </button>
      {state === 'ok' && <span role="status">✓ {t('testOk')}</span>}
      {state === 'failed' && <span role="alert">✗ {t('testFailed')}</span>}
    </div>
  );
}
