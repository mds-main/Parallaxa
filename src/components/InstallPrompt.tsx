'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
const KEY = 'plx:install:v1';
type State = { days: string[]; engaged: boolean; dismissals: number; lastShown?: number };

function read(): State {
  try {
    return { days: [], engaged: false, dismissals: 0, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { days: [], engaged: false, dismissals: 0 };
  }
}
function write(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Marks meaningful engagement (a completed check or briefing) for the install rules. */
export function markEngaged() {
  write({ ...read(), engaged: true });
}

/**
 * Install reminder (PRD 8.5): only after ≥ 2 visits on different days and ≥ 1 completed check or briefing;
 * an in-page banner, never a modal; at most once per 14 days; stops after 2 dismissals.
 */
export function InstallPrompt() {
  const t = useTranslations('common.install');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState<'native' | 'ios' | null>(null);

  useEffect(() => {
    const s = read();
    const today = new Date().toISOString().slice(0, 10);
    if (!s.days.includes(today)) write({ ...s, days: [...s.days.slice(-9), today] });
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone;
    const eligible = () => {
      const st = read();
      return !standalone && st.days.length >= 2 && st.engaged && st.dismissals < 2 && (!st.lastShown || Date.now() - st.lastShown > 14 * 24 * 3600_000) && !/\/(check|quiz|admin)/.test(location.pathname);
    };
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (eligible()) {
        setVisible('native');
        write({ ...read(), lastShown: Date.now() });
      }
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && /safari/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos && eligible()) {
      timer = setTimeout(() => {
        setVisible('ios');
        write({ ...read(), lastShown: Date.now() });
      }, 0);
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!visible) return null;
  const dismiss = () => {
    write({ ...read(), dismissals: read().dismissals + 1 });
    setVisible(null);
  };
  return (
    <div role="region" aria-label={t('install')} className="fixed inset-x-3 bottom-20 z-40 mx-auto max-w-lg rounded-2xl border border-line bg-card p-4 shadow-lg lg:bottom-6">
      {visible === 'ios' ? (
        <>
          <p className="font-semibold">{t('iosTitle')}</p>
          <ol className="mt-2 list-decimal pl-5 text-sm">
            {[0, 1, 2].map((i) => <li key={i}>{t(`iosSteps.${i}`)}</li>)}
          </ol>
        </>
      ) : (
        <p>{t('text')}</p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button className="btn btn-ghost !min-h-10" onClick={dismiss}>{t('notNow')}</button>
        {visible === 'native' && deferred && (
          <button
            className="btn btn-accent !min-h-10"
            onClick={async () => {
              await deferred.prompt();
              await deferred.userChoice;
              setVisible(null);
            }}
          >
            {t('install')}
          </button>
        )}
      </div>
    </div>
  );
}
