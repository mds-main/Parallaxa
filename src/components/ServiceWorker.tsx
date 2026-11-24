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
    try {
      // A/B bucketing (TODO 26.2): random bucket 0–99, no identifiers, set client-side so server responses stay CDN-cacheable.
      if (!/(?:^|;\s*)plx_ab=/.test(document.cookie)) {
        document.cookie = `plx_ab=${Math.floor(Math.random() * 100)}; path=/; max-age=15552000; samesite=lax`;
      }
    } catch {
      /* ignore */
    }
  }, [prefix]);
  return null;
}
