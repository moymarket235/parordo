/* PAR ORDO Customer App — isolated cache for /customer/ only. */
'use strict';

const CACHE_NAME = 'par-ordo-customer-v1';
const SHELL = [
  './',
  './index.html',
  './styles.css?v=1',
  './app.js?v=1',
  './manifest.webmanifest',
  '../assets/par-ordo-logo.png',
  '../assets/par-ordo-spa-background.webp'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL.map(async path => {
      try {
        const url = new URL(path, self.registration.scope);
        const response = await fetch(new Request(url.href, { cache: 'reload' }));
        if (response.ok && response.type === 'basic') {
          await cache.put(url.href, response.clone());
        }
      } catch (_) {
        // Optional assets may be unavailable; keep the app installable.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('par-ordo-customer-') && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response && response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(new URL('./index.html', self.registration.scope).href, response.clone());
        }
        return response;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) ||
          (await cache.match(new URL('./index.html', self.registration.scope).href)) ||
          Response.error();
      }
    })());
    return;
  }

  if (!url.pathname.includes('/customer/') && !url.pathname.endsWith('/assets/par-ordo-logo.png') && !url.pathname.endsWith('/assets/par-ordo-spa-background.webp')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      fetch(request).then(response => {
        if (response && response.ok && response.type === 'basic') {
          cache.put(request, response.clone());
        }
      }).catch(() => {});
      return cached;
    }
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
