/* PAR ORDO PRO — PWA bootstrap. Safe for GitHub Pages subpaths. */
(() => {
  'use strict';

  const scriptUrl = document.currentScript?.src || location.href;
  const appBase = new URL('./', scriptUrl);
  const assetUrl = (path) => new URL(path, appBase).href;

  const ensureMeta = (name, content, isProperty = false) => {
    const selector = isProperty ? `meta[property="${name}"]` : `meta[name="${name}"]`;
    let node = document.head.querySelector(selector);
    if (!node) {
      node = document.createElement('meta');
      if (isProperty) node.setAttribute('property', name);
      else node.setAttribute('name', name);
      document.head.appendChild(node);
    }
    node.setAttribute('content', content);
  };

  const ensureLink = (rel, href, sizes) => {
    let node = document.head.querySelector(`link[rel="${rel}"]`);
    if (!node) {
      node = document.createElement('link');
      node.rel = rel;
      document.head.appendChild(node);
    }
    node.href = href;
    if (sizes) node.sizes = sizes;
  };

  // Add install metadata at runtime, so only one script line is needed in index.html.
  ensureLink('manifest', assetUrl('manifest.webmanifest'));
  ensureLink('apple-touch-icon', assetUrl('assets/par-ordo-logo.png'), '192x192');
  ensureMeta('theme-color', '#0b1711');
  ensureMeta('mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-capable', 'yes');
  ensureMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
  ensureMeta('apple-mobile-web-app-title', 'ПАР ОРДО PRO');

  let deferredInstallPrompt = null;
  let installButton = null;

  const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  const addButton = () => {
    if (isStandalone() || installButton || sessionStorage.getItem('parordo_pwa_install_hidden') === '1') return;
    installButton = document.createElement('button');
    installButton.type = 'button';
    installButton.setAttribute('aria-label', 'Установить ПАР ОРДО PRO');
    installButton.textContent = '＋ УСТАНОВИТЬ APP';
    Object.assign(installButton.style, {
      position: 'fixed', right: '12px', bottom: 'calc(92px + env(safe-area-inset-bottom, 0px))',
      zIndex: '9998', border: '1px solid #e2b74f', borderRadius: '999px',
      padding: '11px 14px', background: 'linear-gradient(135deg,#0d3d28,#071c13)',
      color: '#ffe39a', font: '800 11px/1.1 system-ui,sans-serif', letterSpacing: '.04em',
      boxShadow: '0 8px 24px #0008,0 0 18px #36d78520', cursor: 'pointer'
    });
    installButton.addEventListener('click', async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        try { await deferredInstallPrompt.userChoice; } catch (_) {}
        deferredInstallPrompt = null;
        installButton?.remove();
        installButton = null;
        return;
      }
      const ua = navigator.userAgent || '';
      const isIOS = /iphone|ipad|ipod/i.test(ua);
      const message = isIOS
        ? 'iPhone/iPad: Safari браузеринде Share (Бөлүшүү) баскычын басып, “Add to Home Screen / На экран Домой” тандаңыз.'
        : 'Браузердин менюсун ачып, “Установить приложение” же “Добавить на главный экран” пунктун тандаңыз.';
      window.alert(message);
    });
    document.body.appendChild(installButton);
  };

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    addButton();
  });
  window.addEventListener('appinstalled', () => {
    installButton?.remove();
    installButton = null;
  });

  // The service worker only handles same-origin GET assets and page navigation.
  // API calls to the Cloudflare Worker are intentionally not cached/intercepted.
  let swRegistrationStarted = false;
  const registerServiceWorker = () => {
    if (swRegistrationStarted || !('serviceWorker' in navigator)) return;
    swRegistrationStarted = true;
    navigator.serviceWorker.register(assetUrl('sw.js'), { scope: appBase.pathname })
      .then(() => console.info('[PAR ORDO] PWA service worker registered'))
      .catch((error) => console.warn('[PAR ORDO] PWA setup failed; app remains usable online.', error));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addButton, { once: true });
  } else {
    addButton();
  }
  if (document.readyState === 'complete') registerServiceWorker();
  else window.addEventListener('load', registerServiceWorker, { once: true });
})();
