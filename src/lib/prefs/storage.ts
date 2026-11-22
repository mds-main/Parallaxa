'use client';
import { defaultPreferences, type Preferences } from './types';

const KEY = 'plx:prefs:v1';
const HISTORY = 'plx:history:v1';

export function loadPreferences(): Preferences | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? ({ ...defaultPreferences(), ...JSON.parse(raw) } as Preferences) : null;
  } catch {
    return null;
  }
}

export function savePreferences(p: Preferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
    window.dispatchEvent(new Event('plx:prefs'));
  } catch {
    /* storage unavailable */
  }
}

export type HistoryItem = { id: string; excerpt: string; at: string; grade?: string };

export function loadHistory(): HistoryItem[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY) ?? '[]') as HistoryItem[];
  } catch {
    return [];
  }
}

export function addHistory(item: HistoryItem) {
  try {
    const list = [item, ...loadHistory().filter((x) => x.id !== item.id)].slice(0, 30);
    localStorage.setItem(HISTORY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function clearAllLocalData() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('plx:')) localStorage.removeItem(k);
    sessionStorage.clear();
  } catch {
    /* ignore */
  }
}

export function exportLocalData(): string {
  const out: Record<string, unknown> = {};
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('plx:')) out[k] = JSON.parse(localStorage.getItem(k) ?? 'null');
  } catch {
    /* ignore */
  }
  return JSON.stringify(out, null, 2);
}
