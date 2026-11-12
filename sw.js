/* PAR ORDO PRO + OWNER — conservative offline app-shell cache V2 */
'use strict';
const CACHE_NAME = 'par-ordo-pro-shell-v3';
const APP_SHELL = [
  './index.html','./manager.html','./manifest.webmanifest','./owner.webmanifest',
  './pwa-init.js','./par-ordo-ceo-v1.css','./par-ordo-ceo-v1.js',
  './par-ordo-ceo-live3d-v1.css','./par-ordo-ceo-live3d-v1.js',
  './par-ordo-live3d-map-v4.js','./par-ordo-live3d-map-v4.jpg',
  './par-ordo-live3d-fullscreen-v1.js','./assets/par-ordo-logo.png'
];
const STATIC_ASSET = /\/(?:index\.html|manager\.html|manifest\.webmanifest|owner\.webmanifest|pwa-init\.js|par-ordo-ceo-v1\.(?:css|js)|par-ordo-ceo-live3d-v1\.(?:css|js)|par-ordo-live3d-map-v4\.(?:js|jpg)|par-ordo-live3d-fullscreen-v1\.js|assets\/par-ordo-logo\.png)$/;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async path => {
      try {
        const url = new URL(path, self.registration.scope);
        const response = await fetch(new Request(url.href,{cache:'reload'}));
        if(response.ok && (response.type==='basic' || response.type==='default')) {
          await cache.put(url.href,response.clone());
        }
      } catch (_) { /* Optional assets must not block app installation. */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names=await caches.keys();
    await Promise.all(names
      .filter(name=>name.startsWith('par-ordo-pro-shell-') && name!==CACHE_NAME)
      .map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  // Cloudflare Worker API, payment and third-party requests are never cached/intercepted.
  if(url.origin!==self.location.origin) return;

  if(request.mode==='navigate') {
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      try {
        const live=await fetch(request);
        if(live && live.ok) {
          await cache.put(request,live.clone());
          await cache.put(new URL(url.pathname,self.location.origin).href,live.clone());
        }
        return live;
      } catch (_) {
        const exact=await cache.match(request,{ignoreSearch:true});
        if(exact) return exact;
        const isOwner=url.pathname.endsWith('/manager.html');
        const fallback=new URL(isOwner?'./manager.html':'./index.html',self.registration.scope).href;
        return (await cache.match(fallback)) || Response.error();
      }
    })());
    return;
  }

  if(!STATIC_ASSET.test(url.pathname)) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(request,{ignoreSearch:true});
    if(cached) return cached;
    try {
      const live=await fetch(request);
      if(live && live.ok && (live.type==='basic' || live.type==='default')) {
        await cache.put(new URL(url.pathname,self.location.origin).href,live.clone());
      }
      return live;
    } catch (_) { return Response.error(); }
  })());
});

self.addEventListener('push', event => {
  let data={title:'ПАР ОРДО PRO',body:'Важное уведомление',url:'./'};
  try { data={...data,...(event.data?event.data.json():{})}; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title,{
    body:data.body,icon:'./assets/par-ordo-logo.png',badge:'./assets/par-ordo-logo.png',
    data:{url:data.url||'./'}
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async()=>{
    let target=new URL('./',self.registration.scope).href;
    try {
      const candidate=new URL(event.notification.data?.url||'./',self.registration.scope);
      if(candidate.origin===self.location.origin) target=candidate.href;
    } catch (_) {}
    const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    const existing=windows.find(client=>{
      try{return new URL(client.url).origin===self.location.origin;}catch(_){return false;}
    });
    if(existing) return existing.focus();
    return self.clients.openWindow(target);
  })());
});
