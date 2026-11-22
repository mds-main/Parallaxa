'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { addHistory } from '@/lib/prefs/storage';
import { useIsClient } from '@/lib/prefs/hooks';

type Tab = 'text' | 'link' | 'image';
const MAX_IMAGE = 5 * 1024 * 1024;

export function CheckForm({ initialText = '' }: { initialText?: string }) {
  const t = useTranslations('home');
  const te = useTranslations('check.errors');
  const locale = useLocale();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('text');
  const [text, setText] = useState(initialText);
  const [url, setUrl] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const isClient = useIsClient();
  const speechSupported = isClient && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // "/" focuses the input (PRD 8.3 desktop shortcut).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        setTab('text');
        textRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function dictate() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    type Rec = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void };
    const Ctor = (window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Rec }).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = locale;
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const said = Array.from(e.results).map((r) => r[0]?.transcript ?? '').join(' ');
      setText((prev) => `${prev ? `${prev} ` : ''}${said}`.trim());
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  async function onFile(file: File | undefined) {
    setError(null);
    if (!file) return setImage(null);
    if (file.size > MAX_IMAGE) return setError(te('tooLarge'));
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const body = tab === 'text' ? { kind: 'text', text } : tab === 'link' ? { kind: 'url', url } : { kind: 'image', dataUrl: image };
    if ((tab === 'text' && text.trim().length < 8) || (tab === 'link' && !/^https?:\/\//.test(url)) || (tab === 'image' && !image)) return setError(te('invalid'));
    setBusy(true);
    try {
      const res = await fetch('/api/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, lang: locale }) });
      if (!res.ok) {
        const map: Record<number, string> = { 429: 'rateLimited', 503: 'disabled', 402: 'spendLimit', 400: 'invalid', 413: 'tooLarge' };
        setError(te((map[res.status] ?? 'generic') as 'generic'));
        return;
      }
      const { id } = (await res.json()) as { id: string };
      addHistory({ id, excerpt: (tab === 'text' ? text : tab === 'link' ? url : '🖼').slice(0, 140), at: new Date().toISOString() });
      router.push(`/a/${id}`);
    } catch {
      setError(te('generic'));
    } finally {
      setBusy(false);
    }
  }

  const tabs: Tab[] = ['text', 'link', 'image'];
  return (
    <form onSubmit={submit} className="card p-4 md:p-6" aria-describedby="check-privacy">
      <div role="tablist" aria-label={t('inputLabel')} className="mb-3 flex gap-1">
        {tabs.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-ink text-paper' : 'hover:bg-paper-2'}`}
          >
            {t(`tabs.${k}`)}
          </button>
        ))}
      </div>
      {tab === 'text' && (
        <label className="block">
          <span className="label mb-2 block text-base">{t('inputLabel')}</span>
          <textarea
            ref={textRef}
            className="field min-h-36 resize-y text-lg"
            value={text}
            maxLength={8000}
            placeholder={t('placeholder')}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit();
            }}
            autoFocus
          />
          {speechSupported && (
            <button type="button" className="btn btn-ghost mt-2 !min-h-9 !py-1 text-sm" onClick={dictate} aria-pressed={listening}>
              🎙 {listening ? t('listening') : t('dictate')}
            </button>
          )}
        </label>
      )}
      {tab === 'link' && (
        <label className="block">
          <span className="label mb-2 block text-base">{t('urlLabel')}</span>
          <input className="field text-lg" type="url" inputMode="url" value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} />
        </label>
      )}
      {tab === 'image' && (
        <label className="block">
          <span className="label mb-2 block text-base">{t('imageLabel')}</span>
          <input className="field" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onFile(e.target.files?.[0])} />
          <span className="mt-1 block text-sm muted">{t('imageHint')}</span>
        </label>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-line bg-paper-2 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p id="check-privacy" className="text-sm muted">
          {t('privacyNote')}
        </p>
        <button className="btn btn-accent" disabled={busy}>
          {busy ? t('submitting') : t('submit')}
        </button>
      </div>
    </form>
  );
}
