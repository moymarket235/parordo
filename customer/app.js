(() => {
  'use strict';

  const installButtons = [
    document.getElementById('installApp'),
    document.getElementById('floatingInstall')
  ].filter(Boolean);
  const toastNode = document.getElementById('toast');
  let installPrompt = null;
  let toastTimer = null;

  function showToast(message) {
    if (!toastNode) return;
    toastNode.textContent = message;
    toastNode.classList.add('show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastNode.classList.remove('show'), 3200);
  }

  function isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
  }

  function showInstallButtons() {
    if (isInstalled()) {
      installButtons.forEach(button => button.hidden = true);
      return;
    }
    installButtons.forEach(button => button.hidden = false);
  }

  async function installApp() {
    if (isInstalled()) {
      showToast('Приложение ПАР ОРДО уже установлено.');
      return;
    }

    if (installPrompt) {
      installPrompt.prompt();
      try {
        const result = await installPrompt.userChoice;
        if (result && result.outcome === 'accepted') {
          showToast('Установка приложения запущена.');
        }
      } catch (error) {
        console.warn('[PAR ORDO] Install prompt error:', error);
      }
      installPrompt = null;
      return;
    }

    const ua = navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    if (isIOS) {
      showToast('На iPhone: откройте сайт в Safari → «Поделиться» → «На экран Домой».');
    } else {
      showToast('Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».');
    }
  }

  installButtons.forEach(button => button.addEventListener('click', installApp));
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    showInstallButtons();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    showInstallButtons();
    showToast('ПАР ОРДО добавлено на главный экран!');
  });
  showInstallButtons();

  // Gallery category filters.
  const galleryTabs = [...document.querySelectorAll('.gallery-tab')];
  const galleryCards = [...document.querySelectorAll('.gallery-card')];
  galleryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const filter = tab.dataset.filter;
      galleryTabs.forEach(item => item.classList.toggle('active', item === tab));
      galleryCards.forEach(card => {
        card.hidden = filter !== 'all' && card.dataset.category !== filter;
      });
    });
  });

  // Mobile menu closes after selecting a section.
  const menuToggle = document.getElementById('menuToggle');
  const mobileNav = document.getElementById('mobileNav');
  if (menuToggle && mobileNav) {
    menuToggle.addEventListener('click', () => {
      const opened = mobileNav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(opened));
      menuToggle.textContent = opened ? '×' : '☰';
    });
    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
        menuToggle.textContent = '☰';
      });
    });
  }

  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  // Register this page's own service worker. Its scope is /customer/ only,
  // so the staff/admin PWA at the site root remains separate.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(() => console.info('[PAR ORDO] Customer PWA ready'))
        .catch(error => console.warn('[PAR ORDO] Customer PWA offline mode unavailable:', error));
    }, { once: true });
  }
})();
