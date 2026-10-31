'use strict';
const CACHE = 'par-ordo-customer-v2';
const CORE = ['./', './index.html', './styles.css?v=2', './app.js?v=2', './manifest.webmanifest', '../assets/par-ordo-logo.png', '../assets/par-ordo-spa-background.webp'];
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await Promise.all(CORE.map(async item => { try { const url = new URL(item, self.registration.scope); const res = await fetch(url, { cache: 'reload' }); if (res.ok && res.type === 'basic') await cache.put(url, res); } catch (_) {} }));
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil((async () => { const keys = await caches.keys(); await Promise.all(keys.filter(k => k.startsWith('par-ordo-customer-') && k !== CACHE).map(k => caches.delete(k))); await self.clients.claim(); })()));
self.addEventListener('fetch', event => {
  const req = event.request; if (req.method !== 'GET') return;
  const url = new URL(req.url); if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') event.respondWith((async () => { try { const live = await fetch(req); if (live.ok) { const cache = await caches.open(CACHE); await cache.put(new URL('./index.html', self.registration.scope), live.clone()); } return live; } catch (_) { const cache = await caches.open(CACHE); return (await cache.match(req)) || (await cache.match(new URL('./index.html', self.registration.scope))) || Response.error(); } })());
  else if (url.pathname.includes('/customer/') || url.pathname.endsWith('/assets/par-ordo-logo.png') || url.pathname.endsWith('/assets/par-ordo-spa-background.webp')) event.respondWith((async () => { const cache = await caches.open(CACHE); const hit = await cache.match(req); if (hit) return hit; const live = await fetch(req); if (live.ok && live.type === 'basic') await cache.put(req, live.clone()); return live; })());
});
