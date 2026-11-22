'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type Msg = { role: 'user' | 'assistant'; content: string };

export function PushBack({ analysisId, enabled, maxTurns }: { analysisId: string; enabled: boolean; maxTurns: number }) {
  const t = useTranslations('result.pushBack');
  const locale = useLocale();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const turns = messages.filter((m) => m.role === 'user').length;
  if (!enabled) return <p className="card p-4">{t('paused')}</p>;

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || turns >= maxTurns) return;
    const next = [...messages, { role: 'user' as const, content: input.trim() }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/dialogue', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analysisId, lang: locale, messages: next }) });
      const json = (await res.json()) as { reply?: string; error?: string };
      setMessages([...next, { role: 'assistant', content: json.reply ?? t('paused') }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card p-4" aria-labelledby="pb-title">
      <h3 id="pb-title" className="font-semibold">{t('title')}</h3>
      <p className="text-sm muted">{t('intro')}</p>
      <ol className="mt-3 space-y-3" aria-live="polite">
        {messages.map((m, i) => (
          <li key={i} className={`rounded-xl px-3 py-2 ${m.role === 'user' ? 'ml-8 bg-paper-2' : 'mr-8 border border-line'}`}>
            {m.content}
          </li>
        ))}
      </ol>
      {turns >= maxTurns ? (
        <p className="mt-3 text-sm muted">{t('limit', { max: maxTurns })}</p>
      ) : (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="pb-input">{t('placeholder')}</label>
          <input id="pb-input" className="field" value={input} maxLength={1000} placeholder={t('placeholder')} onChange={(e) => setInput(e.target.value)} />
          <button className="btn" disabled={busy}>{t('send')}</button>
        </form>
      )}
    </section>
  );
}
