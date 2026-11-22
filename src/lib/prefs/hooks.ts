'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { defaultPreferences, type Preferences } from './types';
import type { HistoryItem } from './storage';

const PREFS_KEY = 'plx:prefs:v1';
const HISTORY_KEY = 'plx:history:v1';

function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener('plx:prefs', cb);
  window.addEventListener('plx:history', cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener('plx:prefs', cb);
    window.removeEventListener('plx:history', cb);
  };
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Device-stored preferences (null on the server and before the user has any). */
export function useStoredPreferences(): Preferences | null {
  const raw = useSyncExternalStore(subscribe, () => read(PREFS_KEY), () => null);
  return useMemo(() => {
    if (!raw) return null;
    try {
      return { ...defaultPreferences(), ...(JSON.parse(raw) as Partial<Preferences>) } as Preferences;
    } catch {
      return null;
    }
  }, [raw]);
}

export function useHistory(): HistoryItem[] | null {
  const raw = useSyncExternalStore(subscribe, () => read(HISTORY_KEY) ?? '[]', () => null);
  return useMemo(() => {
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as HistoryItem[];
    } catch {
      return [];
    }
  }, [raw]);
}

/** True only after hydration on the client. */
export function useIsClient(): boolean {
  return useSyncExternalStore(() => () => undefined, () => true, () => false);
}

export function useBrowserLanguages(): string {
  return useSyncExternalStore(() => () => undefined, () => (navigator.languages ?? [navigator.language]).join(','), () => '');
}

export function usePushSupport(): 'unsupported' | 'off' | 'on' | null {
  return useSyncExternalStore(
    () => () => undefined,
    () => (!('Notification' in window) || !('serviceWorker' in navigator) ? 'unsupported' : Notification.permission === 'granted' ? 'on' : 'off'),
    () => null,
  );
}

const SCOPE_KEY = 'plx:scope:session';

function subscribeSession(cb: () => void) {
  window.addEventListener('plx:scope', cb);
  return () => window.removeEventListener('plx:scope', cb);
}

/** Session-only scope (PRD F6 header chip): place ids to show for this visit, or null for saved settings. */
export function useSessionScope(): string[] | null {
  const raw = useSyncExternalStore(subscribeSession, () => {
    try {
      return sessionStorage.getItem(SCOPE_KEY);
    } catch {
      return null;
    }
  }, () => null);
  return useMemo(() => (raw ? (JSON.parse(raw) as string[]) : null), [raw]);
}

export function setSessionScope(ids: string[] | null) {
  try {
    if (ids === null) sessionStorage.removeItem(SCOPE_KEY);
    else sessionStorage.setItem(SCOPE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event('plx:scope'));
  } catch {
    /* ignore */
  }
}
