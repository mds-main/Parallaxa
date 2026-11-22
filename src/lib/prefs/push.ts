'use client';
import type { Preferences } from './types';

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Web Push opt-in (PRD 8.5): asks permission only when the user presses the button, subscribes with the
 * VAPID key and stores the subscription server-side (encrypted) with the briefing time and language.
 */
export async function enablePush(prefs: Preferences): Promise<boolean> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return true;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON(), lang: document.documentElement.lang, time: prefs.briefing.time, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
  });
  return true;
}
