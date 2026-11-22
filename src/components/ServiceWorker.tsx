'use client';
import { useEffect } from 'react';

/** Registers the service worker (offline reading, share target caching). */
export function ServiceWorker({ prefix }: { prefix: string }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
    }
    try {
      localStorage.setItem('plx:lastPrefix', prefix);
    } catch {
      /* ignore */
    }
  }, [prefix]);
  return null;
}
