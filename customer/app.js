(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const API_BASE = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const screens = $$('.screen');
  const tabs = $$('.nav-button');
  let guests = 2;
  let currentRequestText = '';
  let toastTimer = null;

  function toast(message) {
    const node = $('#toast');
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('show'), 2800);
  }

  function navigate(screenId) {
    const safeId = screens.some(screen => screen.id === screenId) ? screenId : 'home';
    screens.forEach(screen => screen.classList.toggle('active', screen.id === safeId));
    tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === safeId));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('click', event => {
    const tab = event.target.closest('[data-tab]');
    if (tab) return navigate(tab.dataset.tab);
    const go = event.target.closest('[data-go]');
    if (go) return navigate(go.dataset.go);
    const filterGo = event.target.closest('[data-filter-go]');
    if (filterGo) {
      navigate('gallery');
      const matchingFilter = $(`[data-filter="${filterGo.dataset.filterGo}"]`);
      if (matchingFilter) matchingFilter.click();
    }
  });

  $('#menuBtn').addEventListener('click', () => navigate('profile'));
  $('#notifyBtn').addEventListener('click', () => toast('Уведомления PAR ORDO будут доступны после подключения сервера.'));

  // PWA install flow.
  let deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredInstallPrompt = event;
  });
  $('#installBtn')?.addEventListener('click', async () => {
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true) {
      toast('PAR ORDO уже установлено на этом устройстве.');
      return;
    }
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try {
        const choice = await deferredInstallPrompt.userChoice;
        toast(choice.outcome === 'accepted' ? 'Установка началась.' : 'Установку можно выполнить позже.');
      } catch (_) {
        toast('Откройте меню Chrome и выберите «Установить приложение».');
      }
      deferredInstallPrompt = null;
      return;
    }
    toast(/iphone|ipad|ipod/i.test(navigator.userAgent)
      ? 'Safari → Поделиться → На экран «Домой».'
      : 'Меню Chrome → «Установить приложение» или «Добавить на главный экран».');
  });

  // Gallery filters.
  const filterButtons = $$('.filter-btn');
  const galleryCards = $$('.gallery-card');
  filterButtons.forEach(button => button.addEventListener('click', () => {
    filterButtons.forEach(item => item.classList.toggle('active', item === button));
    const filter = button.dataset.filter;
    galleryCards.forEach(card => {
      card.hidden = filter !== 'all' && card.dataset.category !== filter;
    });
  }));

  // Booking price calculator.
  const bookingForm = $('#bookingForm');
  const guestCount = $('#guestCount');
  const estimate = $('#estimate');
  function calculateTotal() {
    const shortsCost = bookingForm.elements.shorts.checked ? guests * 50 : 0;
    const amount = guests * 300 + shortsCost;
    guestCount.textContent = String(guests);
    estimate.textContent = `${amount.toLocaleString('ru-RU')} сом`;
    return amount;
  }
  $('#guestMinus').addEventListener('click', () => {
    guests = Math.max(1, guests - 1);
    calculateTotal();
  });
  $('#guestPlus').addEventListener('click', () => {
    guests = Math.min(30, guests + 1);
    calculateTotal();
  });
  bookingForm.elements.shorts.addEventListener('change', calculateTotal);

  // Set min date using device-local date.
  const dateInput = bookingForm.elements.date;
  const now = new Date();
  dateInput.min = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  calculateTotal();

  function saveProfile(name, phone) {
    const profile = { name, phone, updatedAt: new Date().toISOString() };
    localStorage.setItem('parordo_customer_profile_v2', JSON.stringify(profile));
    $('#profileName').textContent = name || 'Гость PAR ORDO';
    $('#profilePhone').textContent = phone || 'Номер пока не указан';
  }

  function loadProfile() {
    try {
      const profile = JSON.parse(localStorage.getItem('parordo_customer_profile_v2') || 'null');
      if (profile) saveProfile(profile.name || '', profile.phone || '');
    } catch (_) {}
  }
  loadProfile();

  function showRequestModal(text) {
    currentRequestText = text;
    $('#requestText').textContent = text;
    $('#requestModal').hidden = false;
  }

  bookingForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!bookingForm.reportValidity()) return;
    const data = new FormData(bookingForm);
    const name = String(data.get('name') || '').trim().replace(/\s+/g, ' ');
    const phone = String(data.get('phone') || '').trim();
    const date = String(data.get('date') || '');
    const time = String(data.get('time') || '');
    const website = String(data.get('website') || '').trim();
    if (website) return; // honeypot: bots are silently ignored
    if (name.length < 2 || phone.replace(/\D/g, '').length < 9) {
      toast('Проверьте имя и номер телефона.');
      return;
    }
    if (!date || !time) {
      toast('Выберите дату и время посещения.');
      return;
    }
    const hasShorts = data.get('shorts') === 'on';
    const total = calculateTotal();
    const appointmentAt = `${date}T${time}`;
    const shortsText = hasShorts ? `\nОдноразовые шорты: ${guests} шт. × 50 сом` : '\nОдноразовые шорты: не нужны';
    const requestText = [
      'ЗАЯВКА НА ПОСЕЩЕНИЕ PAR ORDO',
      `Имя: ${name}`,
      `Телефон: ${phone}`,
      'Помещение: Большая баня',
      `Дата: ${date}`,
      `Время: ${time}`,
      `Гостей: ${guests}`,
      shortsText.trim(),
      `Предварительная сумма: ${total} сом`,
      'Продолжительность: 3 часа',
      '',
      'Просьба подтвердить наличие свободного времени.'
    ].join('\n');

    const submit = $('button[type="submit"]', bookingForm);
    if (submit) { submit.disabled = true; submit.dataset.originalText = submit.innerHTML; submit.textContent = 'ОТПРАВЛЯЕМ ЗАЯВКУ…'; }
    try {
      const response = await fetch(`${API_BASE}/api/public/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({
          name, phone, appointmentAt, guests,
          shorts: hasShorts,
          website
        })
      });
      let result = null;
      try { result = await response.json(); } catch (_) {}
      if (!response.ok || !result?.booking?.id) {
        throw new Error(result?.error || `Worker API ${response.status}`);
      }

      saveProfile(name, phone);
      const request = {
        id: result.booking.id, name, phone, date, time, guests,
        shorts: hasShorts, total, text: requestText,
        createdAt: new Date().toISOString(),
        status: 'Ожидает подтверждения администратора'
      };
      localStorage.setItem('parordo_last_guest_request', JSON.stringify(request));
      renderLastRequest();
      $('#requestModalTitle').textContent = 'Заявка отправлена';
      showRequestModal(`${requestText}\n\nСтатус: ОЖИДАЕТ ПОДТВЕРЖДЕНИЯ\nНомер заявки: ${result.booking.id}`);
      bookingForm.reset();
      guests = 2;
      calculateTotal();
      toast('Заявка сохранена в PAR ORDO PRO.');
    } catch (error) {
      console.error('[PAR ORDO] public booking submit failed:', error);
      $('#requestModalTitle').textContent = 'Не удалось отправить';
      showRequestModal(`${requestText}\n\nОшибка: ${error.message}\n\nЗаявка не сохранена на сервере. Скопируйте текст и отправьте администратору.`);
      toast('Не удалось связаться с сервером.');
    } finally {
      if (submit) { submit.disabled = false; submit.innerHTML = submit.dataset.originalText || 'ОТПРАВИТЬ ЗАЯВКУ'; }
    }
  });

  async function copyRequest() {
    if (!currentRequestText) return;
    try {
      await navigator.clipboard.writeText(currentRequestText);
      toast('Текст заявки скопирован.');
    } catch (_) {
      const area = document.createElement('textarea');
      area.value = currentRequestText;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      toast(ok ? 'Текст заявки скопирован.' : 'Не удалось скопировать текст.');
    }
  }

  async function shareRequest() {
    if (!currentRequestText) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Заявка PAR ORDO', text: currentRequestText });
        toast('Окно отправки открыто.');
      } catch (error) {
        if (error?.name !== 'AbortError') toast('Не удалось открыть отправку. Скопируйте текст заявки.');
      }
    } else {
      await copyRequest();
      toast('Скопируйте текст и отправьте администратору PAR ORDO.');
    }
  }

  $('#copyRequest').addEventListener('click', copyRequest);
  $('#shareRequest').addEventListener('click', shareRequest);
  $('#modalClose').addEventListener('click', () => { $('#requestModal').hidden = true; });
  $('#requestModal').addEventListener('click', event => {
    if (event.target === $('#requestModal')) $('#requestModal').hidden = true;
  });

  function renderLastRequest() {
    const node = $('#lastRequest');
    let req = null;
    try { req = JSON.parse(localStorage.getItem('parordo_last_guest_request') || 'null'); } catch (_) {}
    if (!req) { node.hidden = true; return; }
    node.hidden = false;
    $('#lastRequestTitle').textContent = `${req.date || ''} · ${req.time || ''} · ${req.guests || 0} гостей`;
    $('#lastRequestMeta').textContent = `Предварительно: ${Number(req.total || 0).toLocaleString('ru-RU')} сом · ${req.status || 'Заявка'}`;
  }
  renderLastRequest();

  $('#editProfile').addEventListener('click', () => {
    let current = {};
    try { current = JSON.parse(localStorage.getItem('parordo_customer_profile_v2') || '{}'); } catch (_) {}
    const name = prompt('Ваше имя:', current.name || '');
    if (name === null) return;
    const phone = prompt('Номер телефона:', current.phone || '');
    if (phone === null) return;
    saveProfile(name.trim(), phone.trim());
    toast('Профиль сохранён на этом устройстве.');
  });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js', { scope: './' })
        .then(() => console.info('[PAR ORDO] Future Arena PWA ready'))
        .catch(error => console.warn('[PAR ORDO] PWA offline shell unavailable:', error));
    }, { once: true });
  }
})();
