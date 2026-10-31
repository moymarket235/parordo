'use strict';
const CACHE_NAME = 'par-ordo-customer-v14';
const SHELL = [
  './',
  './index.html',
  './styles.css?v=14',
  './app.js?v=14',
  './future-arena-v14.css?v=14',
  './manifest.webmanifest?v=14',
  '../assets/par-ordo-logo.png',
  '../assets/par-ordo-spa-background.webp',
  '../assets/par-ordo-hero-future.webp',
  '../assets/par-ordo-steam-room.webp',
  '../assets/par-ordo-shower-room.webp',
  '../assets/par-ordo-relax-room.webp'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(SHELL.map(async path => {
      try {
        const url = new URL(path, self.registration.scope);
        const response = await fetch(new Request(url.href, { cache: 'reload' }));
        if (response.ok && (response.type === 'basic' || response.type === 'default')) {
          await cache.put(url.href, response.clone());
        }
      } catch (_) {
        // An optional image/font must not block installation.
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
        const live = await fetch(request, { cache: 'no-store' });
        if (live && live.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(new URL('./index.html', self.registration.scope), live.clone());
        }
        return live;
      } catch (_) {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(request)) ||
          (await cache.match(new URL('./index.html', self.registration.scope))) ||
          Response.error();
      }
    })());
    return;
  }

  const customerAsset = url.pathname.includes('/customer/') ||
    url.pathname.endsWith('/assets/par-ordo-logo.png') ||
    url.pathname.endsWith('/assets/par-ordo-spa-background.webp') ||
    url.pathname.endsWith('/assets/par-ordo-hero-future.webp') ||
    url.pathname.endsWith('/assets/par-ordo-steam-room.webp') ||
    url.pathname.endsWith('/assets/par-ordo-shower-room.webp') ||
    url.pathname.endsWith('/assets/par-ordo-relax-room.webp');
  if (!customerAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
    }
    return response;
  })());
});
