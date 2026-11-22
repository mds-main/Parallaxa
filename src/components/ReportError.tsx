'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';

export function ReportError({ analysisId, version }: { analysisId: string; version: number }) {
  const t = useTranslations('result.report');
  const [body, setBody] = useState('');
  const [sent, setSent] = useState(false);
  if (sent) return <p role="status" className="card p-4">{t('thanks')}</p>;
  return (
    <form
      className="card space-y-3 p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (body.trim().length < 10) return;
        await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analysisId, version, body }) });
        setSent(true);
      }}
    >
      <h3 className="font-semibold">{t('title')}</h3>
      <label className="block">
        <span className="label">{t('label')}</span>
        <textarea className="field mt-1 min-h-24" value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
      </label>
      <button className="btn">{t('submit')}</button>
    </form>
  );
}
