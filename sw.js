/* PAR ORDO PRO — conservative offline shell cache. Version the cache when changing assets. */
'use strict';

const CACHE_NAME = 'par-ordo-pro-shell-v1';
const APP_SHELL = [
  './index.html',
  './manifest.webmanifest',
  './pwa-init.js',
  './assets/par-ordo-logo.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async (path) => {
      try {
        const request = new Request(new URL(path, self.registration.scope), { cache: 'reload' });
        const response = await fetch(request);
        if (response.ok && (response.type === 'basic' || response.type === 'default')) {
          await cache.put(request, response.clone());
        }
      } catch (_) {
        // A single optional asset failing must not prevent the app from installing.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => name.startsWith('par-ordo-') && name !== CACHE_NAME)
      .map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache or proxy external API, payments, or third-party requests.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const live = await fetch(request);
        if (live && live.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(new URL('./index.html', self.registration.scope).href, live.clone());
        }
        return live;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) || (await cache.match(new URL('./index.html', self.registration.scope).href)) || Response.error();
      }
    })());
    return;
  }

  // Cache-first for only the static shell files we explicitly support.
  const staticShell = /\/(?:index\.html|manifest\.webmanifest|pwa-init\.js|assets\/par-ordo-logo\.png)$/.test(url.pathname);
  if (!staticShell) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      fetch(request).then((response) => {
        if (response && response.ok && response.type === 'basic') cache.put(request, response.clone());
      }).catch(() => {});
      return cached;
    }
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') await cache.put(request, response.clone());
    return response;
  })());
});

self.addEventListener('push', (event) => {
  let data = { title: 'ПАР ОРДО PRO', body: 'Важное уведомление', url: './' };
  try { data = { ...data, ...(event.data ? event.data.json() : {}) }; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: './assets/par-ordo-logo.png',
    badge: './assets/par-ordo-logo.png',
    data: { url: data.url || './' }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    let target = new URL('./', self.registration.scope).href;
    try {
      const candidate = new URL(event.notification.data?.url || './', self.registration.scope);
      if (candidate.origin === self.location.origin) target = candidate.href;
    } catch (_) {}
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  })());
});
