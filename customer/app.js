(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const screens = [...document.querySelectorAll('.screen')];
  const tabs = [...document.querySelectorAll('[data-tab]')];
  const toastNode = $('#toast');
  const modal = $('#modal');
  let toastTimer;
  let deferredPrompt = null;
  let guests = 2;

  function toast(message) {
    toastNode.textContent = message;
    toastNode.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastNode.classList.remove('show'), 3000);
  }
  function go(id) {
    if (!screens.some((screen) => screen.id === id)) id = 'home';
    screens.forEach((screen) => screen.classList.toggle('active', screen.id === id));
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === id));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  document.addEventListener('click', (event) => {
    const tab = event.target.closest('[data-tab]');
    if (tab) return go(tab.dataset.tab);
    const goto = event.target.closest('[data-go]');
    if (goto) return go(goto.dataset.go);
    const filterGo = event.target.closest('[data-filter-go]');
    if (filterGo) {
      go('gallery');
      const value = filterGo.dataset.filterGo;
      const filter = document.querySelector(`[data-filter="${value}"]`);
      if (filter) filter.click();
    }
  });
  $('#menuBtn').addEventListener('click', () => go('profile'));

  // Install prompt: only shown from the explicit install action.
  $('#installBtn').addEventListener('click', async () => {
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) {
      toast('Приложение PAR ORDO уже установлено.');
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        const choice = await deferredPrompt.userChoice;
        toast(choice.outcome === 'accepted' ? 'Установка началась.' : 'Установку можно выполнить позже.');
      } catch (_) { toast('Откройте меню браузера и выберите «Установить приложение».'); }
      deferredPrompt = null;
      return;
    }
    toast(/iphone|ipad|ipod/i.test(navigator.userAgent)
      ? 'Safari → Поделиться → На экран «Домой». '
      : 'Меню браузера → «Установить приложение» или «Добавить на главный экран».');
  });
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
  });
  window.addEventListener('appinstalled', () => toast('PAR ORDO установлено на устройство!'));

  // Gallery filters.
  const filters = [...document.querySelectorAll('[data-filter]')];
  const galleryTiles = [...document.querySelectorAll('[data-category]')];
  filters.forEach((filter) => filter.addEventListener('click', () => {
    filters.forEach((item) => item.classList.toggle('active', item === filter));
    const value = filter.dataset.filter;
    galleryTiles.forEach((tile) => { tile.hidden = value !== 'all' && tile.dataset.category !== value; });
  }));

  // Simple visit estimator. It does not claim a reservation has been confirmed.
  const guestCount = $('#guestCount');
  const estimate = $('#estimate');
  function renderEstimate() {
    guestCount.textContent = String(guests);
    const shorts = $('#bookingForm').elements.shorts.checked ? guests * 50 : 0;
    estimate.textContent = `${(guests * 300 + shorts).toLocaleString('ru-RU')} сом`;
  }
  $('#guestMinus').addEventListener('click', () => { guests = Math.max(1, guests - 1); renderEstimate(); });
  $('#guestPlus').addEventListener('click', () => { guests = Math.min(30, guests + 1); renderEstimate(); });
  $('#bookingForm').elements.shorts.addEventListener('change', renderEstimate);
  const dateInput = $('#bookingForm').elements.date;
  const today = new Date();
  const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  dateInput.min = localDate;
  renderEstimate();

  $('#bookingForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') || '').trim();
    const phone = String(data.get('phone') || '').trim();
    if (!name || phone.replace(/\D/g, '').length < 9) {
      toast('Проверьте имя и номер телефона.');
      return;
    }
    localStorage.setItem('parordo_customer_profile_v1', JSON.stringify({ name, phone }));
    const shortLine = data.get('shorts') ? `\nОдноразовые шорты: ${guests} шт.` : '';
    const amount = guests * 300 + (data.get('shorts') ? guests * 50 : 0);
    $('#modalTitle').textContent = 'Запрос подготовлен';
    $('#modalText').textContent = `Гости: ${guests}\nДата: ${data.get('date')}\nВремя: ${data.get('time')}\nПредварительная сумма: ${amount} сом${shortLine}\n\nВажно: онлайн-подтверждение ещё не подключено. Это не является подтверждённой бронью.`;
    modal.hidden = false;
    $('#profileName').textContent = name;
    $('#profilePhone').textContent = phone;
  });
  $('#modalClose').addEventListener('click', () => { modal.hidden = true; });
  $('#modalOk').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.hidden = true; });

  const savedProfile = (() => { try { return JSON.parse(localStorage.getItem('parordo_customer_profile_v1') || 'null'); } catch (_) { return null; } })();
  function showProfile() {
    if (savedProfile) {
      $('#profileName').textContent = savedProfile.name || 'Гость PAR ORDO';
      $('#profilePhone').textContent = savedProfile.phone || 'Номер пока не указан';
    }
  }
  showProfile();
  $('#editProfile').addEventListener('click', () => {
    const name = prompt('Ваше имя:', savedProfile?.name || '');
    if (name === null) return;
    const phone = prompt('Номер телефона:', savedProfile?.phone || '');
    if (phone === null) return;
    const profile = { name: name.trim(), phone: phone.trim() };
    localStorage.setItem('parordo_customer_profile_v1', JSON.stringify(profile));
    $('#profileName').textContent = profile.name || 'Гость PAR ORDO';
    $('#profilePhone').textContent = profile.phone || 'Номер пока не указан';
    toast('Профиль сохранён на этом устройстве.');
  });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(() => console.info('[PAR ORDO CUSTOMER] PWA ready'))
        .catch((error) => console.warn('[PAR ORDO CUSTOMER] Service worker unavailable:', error));
    }, { once: true });
  }
})();
