'use client';
import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { loadPreferences, savePreferences } from '@/lib/prefs/storage';
import type { Preferences } from '@/lib/prefs/types';

type Status = { enabled: boolean; signedIn: boolean; passkeys?: number; hasSelfPlacement?: boolean };
const PLACEMENTS = ['left', 'centre_left', 'centre', 'centre_right', 'right', 'none'] as const;

const post = (url: string, body?: unknown) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) });

/** Optional account: magic link or passkey sign-in, encrypted sync, export, delete, self-placement (TODO 9.2–9.6). */
export function AccountPanel() {
  const t = useTranslations('settings.account');
  const locale = useLocale();
  const [status, setStatus] = useState<Status | null>(null);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [placement, setPlacement] = useState<(typeof PLACEMENTS)[number]>('none');
  const [consent, setConsent] = useState(false);
  const [confirm, setConfirm] = useState('');

  const refresh = useCallback(async () => {
    const res = await fetch('/api/account/status', { cache: 'no-store' });
    setStatus((await res.json()) as Status);
  }, []);
  useEffect(() => {
    let alive = true;
    fetch('/api/account/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then((s: Status) => alive && setStatus(s))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (!status) return null;
  if (!status.enabled) return <p className="card p-5 text-sm">{t('disabled')}</p>;

  if (!status.signedIn) {
    return (
      <section className="card space-y-4 p-5">
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await post('/api/auth/email', { email, lang: locale });
            const j = (await res.json()) as { ok?: boolean; devLink?: string };
            setMsg(j.ok ? t('sent') : null);
            setDevLink(j.devLink ?? null);
          }}
        >
          <label className="block">
            <span className="label">{t('email')}</span>
            <input type="email" required autoComplete="email" className="field mt-1" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button className="btn">{t('send')}</button>
        </form>
        {msg && <p role="status" className="text-sm">{msg}</p>}
        {devLink && <a className="text-sm" href={devLink}>{t('devLink')}</a>}
        <button
          className="btn btn-ghost"
          onClick={async () => {
            try {
              const options = await (await post('/api/auth/passkey-login-options')).json();
              const response = await startAuthentication({ optionsJSON: options });
              if ((await post('/api/auth/passkey-login-verify', response)).ok) await refresh();
            } catch {
              /* cancelled */
            }
          }}
        >
          {t('passkey')}
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-5">
        <p className="font-medium">{t('signedIn')}</p>
        <p className="text-sm muted">{t('passkeys', { count: status.passkeys ?? 0 })}</p>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn btn-ghost"
            onClick={async () => {
              try {
                const options = await (await post('/api/auth/passkey-register-options')).json();
                const response = await startRegistration({ optionsJSON: options });
                if ((await post('/api/auth/passkey-register-verify', response)).ok) {
                  setMsg(t('passkeyAdded'));
                  await refresh();
                }
              } catch {
                /* cancelled */
              }
            }}
          >
            {t('addPasskey')}
          </button>
          <button className="btn btn-ghost" onClick={async () => { await post('/api/auth/logout'); await refresh(); }}>{t('signOut')}</button>
        </div>
      </section>
      <section className="card flex flex-wrap gap-2 p-5">
        <button
          className="btn"
          onClick={async () => {
            await fetch('/api/account/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferences: loadPreferences() ?? {} }) });
            setMsg(t('synced'));
          }}
        >
          {t('syncUp')}
        </button>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            const j = (await (await fetch('/api/account/preferences', { cache: 'no-store' })).json()) as { preferences: Preferences | null };
            if (j.preferences) savePreferences(j.preferences);
            setMsg(t('synced'));
          }}
        >
          {t('syncDown')}
        </button>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            const blob = await (await fetch('/api/account/export', { cache: 'no-store' })).blob();
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'parallaxa-account.json';
            a.click();
          }}
        >
          {t('export')}
        </button>
      </section>
      <section className="card space-y-3 p-5">
        <h2 className="font-semibold">{t('selfTitle')}</h2>
        <p className="text-sm muted">{t('selfIntro')}</p>
        <select className="field" value={placement} onChange={(e) => setPlacement(e.target.value as (typeof PLACEMENTS)[number])}>
          {PLACEMENTS.map((p) => <option key={p} value={p}>{t(`placements.${p}`)}</option>)}
        </select>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} /> {t('selfConsent')}</label>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn"
            disabled={!consent}
            onClick={async () => {
              const r = await fetch('/api/account/self-placement', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ placement, consent: true }) });
              if (r.ok) {
                setMsg(t('selfSaved'));
                await refresh();
              }
            }}
          >
            {t('selfSave')}
          </button>
          {status.hasSelfPlacement && (
            <button className="btn btn-ghost" onClick={async () => { await fetch('/api/account/self-placement', { method: 'DELETE' }); await refresh(); }}>{t('selfDelete')}</button>
          )}
        </div>
      </section>
      <section className="card space-y-2 p-5">
        <label className="block text-sm">
          <span className="label">{t('deleteConfirm')}</span>
          <input className="field mt-1" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <button
          className="btn btn-ghost"
          disabled={confirm !== 'DELETE'}
          onClick={async () => {
            const r = await fetch('/api/account/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm }) });
            if (r.ok) {
              setMsg(t('deleted'));
              await refresh();
            }
          }}
        >
          {t('delete')}
        </button>
      </section>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </div>
  );
}
