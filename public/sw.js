/* Parallaxa service worker (PRD 8.5): offline reading of recent briefings and saved checks,
   network-first for the API, stale-while-revalidate for briefing pages, Web Push. */
const VERSION = 'plx-v2';
const SHELL = `${VERSION}-shell`;
const PAGES = `${VERSION}-pages`;
const MAX_PAGES = 40;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(['/icons/icon.svg', '/icons/icon-192.png'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - max))) await cache.delete(k);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.includes('/admin')) return; // network only
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(caches.open(SHELL).then(async (c) => (await c.match(req)) || fetch(req).then((r) => (c.put(req, r.clone()), r))));
    return;
  }
  if (req.mode === 'navigate') {
    const isBriefing = /\/today$/.test(url.pathname);
    const isAnalysis = /\/a\/[0-9a-f-]{36}$/.test(url.pathname);
    if (isBriefing || isAnalysis) {
      // Stale-while-revalidate: show the cached copy instantly when offline, refresh in the background.
      event.respondWith(
        caches.open(PAGES).then(async (cache) => {
          const cached = await cache.match(req);
          const network = fetch(req)
            .then((res) => {
              if (res.ok) cache.put(req, res.clone()).then(() => trim(PAGES, MAX_PAGES));
              return res;
            })
            .catch(() => cached);
          return isBriefing ? cached || network : network.then((r) => r || cached);
        }),
      );
    }
  }
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: 'Parallaxa', body: event.data && event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Parallaxa', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: data.url || '/' },
      tag: data.tag || 'plx-briefing',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((list) => {
      for (const c of list) if ('focus' in c) { c.navigate(url); return c.focus(); }
      return self.clients.openWindow(url);
    }),
  );
});
