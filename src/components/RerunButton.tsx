'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';

/** Re-runs a claim with today's model lineup; the original analysis stays as published (PRD 9.4). */
export function RerunButton({ analysisId, claim }: { analysisId: string; claim: string }) {
  const t = useTranslations('result.rerun');
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-lg border border-line p-3 text-sm">
      <p>{t('note')}</p>
      <button
        className="btn btn-ghost mt-2 !min-h-9 !py-1 text-sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'text', text: claim, lang: locale, rerunOf: analysisId }) });
          if (res.ok) router.push(`/a/${((await res.json()) as { id: string }).id}`);
          else setBusy(false);
        }}
      >
        {t('button')}
      </button>
    </div>
  );
}
