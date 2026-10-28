/* PAR ORDO PRO V110 — customer bonus control, bookings, and time-based entrance tariffs.
   Add after the main app script and existing par-ordo-bracelet-rules-v108.js script.
   Requires Worker API V10.12. Does not touch bracelet artwork/timer/card markup. */
(() => {
  'use strict';

  const API_BASE = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const SELECT = (selector, root = document) => root.querySelector(selector);
  const SELECT_ALL = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const state = {
    pricing: { active: false, adultPrice: 300, childPrice: 200 },
    pricingLoaded: false,
    bookingRows: [],
    activeExtraTab: 'clients',
    coreTab: 'clients',
    busyBonusIds: new Set(),
    bookingBusy: false,
    priceBusy: false,
    observedCards: new WeakSet(),
    observedLists: new WeakSet(),
    listRefreshTimer: null,
    decorateBusy: false,
    decorateQueued: false,
    appObserver: null,
    priceObserver: null,
    interval: null
  };

  function roleIsManager() {
    return document.body.classList.contains('manager-readonly');
  }
  function canWrite() {
    return !roleIsManager();
  }
  function showToast(message) {
    if (typeof window.toast === 'function') window.toast(message);
    else window.alert(message);
  }
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  async function api(path, options = {}) {
    if (typeof window.api === 'function') return window.api(path, options);
    const headers = { Accept: 'application/json' };
    if (options.body) headers['Content-Type'] = 'application/json';
    const token = sessionStorage.getItem('parordo_admin_token');
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(API_BASE + path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    let data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data?.error || `API ${response.status}`);
    return data;
  }
  function localDateTimeValue(date = new Date()) {
    const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return adjusted.toISOString().slice(0,16);
  }
  function nextBookableTime() {
    const now = new Date();
    now.setSeconds(0, 0);
    now.setMinutes(Math.ceil((now.getMinutes() + 1) / 15) * 15);
    if (now.getHours() < 10) now.setHours(10, 0, 0, 0);
    if (now.getHours() >= 23) {
      now.setDate(now.getDate() + 1);
      now.setHours(10, 0, 0, 0);
    }
    return now;
  }
  function isEarlyWindow() {
    // The browser normally uses the device's Bishkek timezone; use an explicit timezone for consistency.
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bishkek', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':').map(Number);
    const mins = parts[0] * 60 + parts[1];
    return state.pricing.active && mins >= 10 * 60 && mins < 15 * 60;
  }
  function currentPrices() {
    return isEarlyWindow() ? { adult: 200, child: 150 } : { adult: 300, child: 200 };
  }

  const style = document.createElement('style');
  style.id = 'par-ordo-customer-features-v110-style';
  style.textContent = `
    .parordo-extra-hidden{display:none!important}
    .customer-base-tabs [data-parordo-tab]{border-color:rgba(81,190,126,.42)!important}
    .customer-base-tabs [data-parordo-tab].active{background:linear-gradient(120deg,#b87c22,#ffda7a)!important;color:#211506!important;border-color:#f5cd6c!important}
    .parordo-bonus-actions{display:flex;flex-wrap:wrap;gap:6px;width:100%;margin-top:8px}
    .parordo-bonus-actions button{flex:1 1 100px;min-height:34px;padding:7px 9px;border-radius:10px;font-size:10px;font-weight:900;border:1px solid #8c662f;background:linear-gradient(145deg,#211709,#110c07);color:#e8d0a0}
    .parordo-bonus-actions button[data-state="active"]{border-color:#3da96a;background:linear-gradient(135deg,#124d2d,#0a2919);color:#a5f4bf}
    .parordo-bonus-actions button[data-state="stopped"]{border-color:#8b4940;background:linear-gradient(135deg,#421b17,#1b0c0a);color:#ffc2b8}
    .parordo-bonus-actions button.is-selected{box-shadow:0 0 0 1px currentColor inset,0 0 12px #e8bd5520}
    .parordo-bonus-actions button:disabled{opacity:.45;cursor:not-allowed;filter:saturate(.55)}
    .parordo-bonus-summary{display:block!important;margin-top:4px;font-size:10px;line-height:1.45;color:#cfbea0}
    .parordo-feature-panel{margin:12px 0;padding:15px;border:1px solid rgba(201,164,91,.42);border-radius:18px;background:linear-gradient(145deg,rgba(17,26,18,.96),rgba(6,11,8,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 9px 22px rgba(0,0,0,.18);color:#f8edd7}
    .parordo-feature-panel h3{margin:0 0 6px;font-size:19px;font-weight:900;letter-spacing:-.02em;color:#ffdf92}
    .parordo-feature-panel .parordo-subtitle{margin:0 0 13px;color:#c6d0c4;font-size:12px;line-height:1.5;font-weight:600}
    .parordo-field-grid{display:grid;grid-template-columns:1fr;gap:9px}
    .parordo-field{display:grid;gap:5px;min-width:0}
    .parordo-field label{font-size:10px;letter-spacing:.08em;font-weight:900;color:#e5c986;text-transform:uppercase}
    .parordo-field input,.parordo-field textarea{width:100%;min-width:0;min-height:45px;padding:11px 12px;border:1px solid #624b2a;border-radius:11px;background:#fff8e9;color:#21180d;font:inherit;font-size:14px;box-sizing:border-box}
    .parordo-feature-panel button{touch-action:manipulation}
    .parordo-action-primary{width:100%;min-height:46px;margin-top:10px;padding:10px 14px;border:1px solid #e4b64f;border-radius:12px;background:linear-gradient(135deg,#a86d15,#ffda6e);color:#251807;font-weight:950;font-size:12px}
    .parordo-action-ghost{min-height:36px;padding:8px 10px;border:1px solid #5d482a;border-radius:10px;background:#15130b;color:#f1d99f;font-size:10px;font-weight:850}
    .parordo-panel-row{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
    .parordo-active-pill{display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;background:#421a17;color:#ffbeb4;border:1px solid #8c4338;font-size:10px;font-weight:950}
    .parordo-active-pill.on{background:#123d25;color:#9bf2b7;border-color:#2c8d51}
    .parordo-price-table{display:grid;grid-template-columns:1fr;gap:7px;margin:11px 0}
    .parordo-price-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:10px;border:1px solid #3e4937;border-radius:11px;background:rgba(5,10,7,.58);font-size:11px}
    .parordo-price-row span:first-child{font-weight:800;color:#e2d7bd}
    .parordo-price-row strong{color:#ffe09a;font-size:12px;white-space:nowrap}
    .parordo-price-row small{font-size:9px;color:#b6c4b8;white-space:nowrap}
    .parordo-booking-list{display:grid;gap:8px;margin-top:12px}
    .parordo-booking-item{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:9px;align-items:center;padding:11px;border:1px solid rgba(201,164,91,.28);border-radius:13px;background:rgba(5,10,7,.68)}
    .parordo-booking-item strong{display:block;font-size:12px;color:#fff1d2;overflow-wrap:anywhere}
    .parordo-booking-item small{display:block;margin-top:4px;font-size:10px;font-weight:650;color:#c7d1c5;line-height:1.4}
    .parordo-empty{padding:13px;border:1px dashed #6a5535;border-radius:12px;color:#c7b99a;font-size:11px;line-height:1.5;text-align:center}
    .parordo-error{color:#ffb7aa!important}
    #addModal .entry-add[data-parordo-entry-button]{border-color:#ba8a39!important;box-shadow:inset 0 1px 0 #ffe5a433,0 5px 15px #0002!important}
    #addModal .entry-add[data-parordo-entry-button] span{color:#ffe08b!important}
    @media(min-width:720px){.parordo-field-grid{grid-template-columns:1fr 1fr}.parordo-field-wide{grid-column:1/-1}.parordo-booking-item{grid-template-columns:minmax(0,1fr) auto}.parordo-price-row{grid-template-columns:minmax(0,1fr) 110px 125px}}
  `;
  document.head.appendChild(style);

  function coreElements(card) {
    return [
      SELECT('#customerBaseForm', card), SELECT('#customerBaseOverview', card),
      SELECT('#customerBaseSearchWrap', card), SELECT('#customerBaseCount', card),
      SELECT('#customerBaseList', card)
    ].filter(Boolean);
  }
  function setExtraTab(card, tab) {
    state.activeExtraTab = tab;
    const extra = tab === 'bookings' || tab === 'tariffs';
    coreElements(card).forEach(el => el.classList.toggle('parordo-extra-hidden', extra));
    const bookings = SELECT('#parOrdoBookingsPanel', card);
    const tariffs = SELECT('#parOrdoTariffsPanel', card);
    if (bookings) bookings.classList.toggle('parordo-extra-hidden', tab !== 'bookings');
    if (tariffs) tariffs.classList.toggle('parordo-extra-hidden', tab !== 'tariffs');
    SELECT_ALL('.customer-base-tabs [data-customer-base-tab], .customer-base-tabs [data-parordo-tab]', card).forEach(btn => {
      const isSelected = btn.dataset.parordoTab ? btn.dataset.parordoTab === tab : (!extra && btn.dataset.customerBaseTab === tab);
      btn.classList.toggle('active', isSelected);
    });
    if (tab === 'bookings') loadBookings(card);
    if (tab === 'tariffs') loadPricing(card);
  }

  function buildExtraPanels(card) {
    if (SELECT('#parOrdoBookingsPanel', card) && SELECT('#parOrdoTariffsPanel', card)) return;
    const tabs = SELECT('.customer-base-tabs', card);
    const list = SELECT('#customerBaseList', card);
    if (!tabs || !list) return;

    for (const [tab, label] of [['bookings','Записаться'],['tariffs','Тарифы входа']]) {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.parordoTab = tab; button.textContent = label;
      tabs.appendChild(button);
    }

    const bookingsPanel = document.createElement('section');
    bookingsPanel.id = 'parOrdoBookingsPanel';
    bookingsPanel.className = 'parordo-feature-panel parordo-extra-hidden';
    bookingsPanel.innerHTML = `
      <div class="parordo-panel-row"><h3>Предварительная запись</h3><span class="parordo-active-pill on">10:00–23:00</span></div>
      <p class="parordo-subtitle">Укажите имя, телефон и желаемое время. Запись будет доступна сотрудникам и руководителю на других устройствах.</p>
      <form id="parOrdoBookingForm">
        <div class="parordo-field-grid">
          <div class="parordo-field"><label for="parOrdoBookingName">Имя и фамилия *</label><input id="parOrdoBookingName" name="name" required maxlength="120" autocomplete="name" placeholder="Имя и фамилия"></div>
          <div class="parordo-field"><label for="parOrdoBookingPhone">Номер телефона *</label><input id="parOrdoBookingPhone" name="phone" type="tel" inputmode="tel" required maxlength="40" autocomplete="tel" placeholder="+996 700 000 000"></div>
          <div class="parordo-field parordo-field-wide"><label for="parOrdoBookingAt">Дата и время записи *</label><input id="parOrdoBookingAt" name="appointmentAt" type="datetime-local" required></div>
        </div>
        <button class="parordo-action-primary" id="parOrdoBookingSubmit" type="submit">＋ Сохранить запись</button>
      </form>
      <div class="parordo-panel-row" style="margin-top:16px"><h3 style="font-size:15px">Ближайшие записи</h3><button id="parOrdoBookingsRefresh" class="parordo-action-ghost" type="button">↻ Обновить</button></div>
      <div id="parOrdoBookingsList" class="parordo-booking-list"><div class="parordo-empty">Откройте вкладку, чтобы загрузить записи.</div></div>`;

    const tariffsPanel = document.createElement('section');
    tariffsPanel.id = 'parOrdoTariffsPanel';
    tariffsPanel.className = 'parordo-feature-panel parordo-extra-hidden';
    tariffsPanel.innerHTML = `
      <div class="parordo-panel-row"><h3>Тарифы входа</h3><span id="parOrdoTariffStatus" class="parordo-active-pill">НЕАКТИВ</span></div>
      <p class="parordo-subtitle">Включение меняет цены автоматом на всех браслетах. Выключение немедленно возвращает обычные цены. Настройка синхронизируется между устройствами.</p>
      <div class="parordo-price-table">
        <div class="parordo-price-row"><span>10:00–15:00</span><strong>Вход: 200 сом</strong><small>Детский: 150 сом</small></div>
        <div class="parordo-price-row"><span>15:00–23:00</span><strong>Вход: 300 сом</strong><small>Детский: 200 сом</small></div>
      </div>
      <div class="parordo-panel-row"><span id="parOrdoCurrentTariff" class="parordo-subtitle" style="margin:0">Текущая цена: 300 / 200 сом</span><button id="parOrdoPricingRefresh" class="parordo-action-ghost" type="button">↻</button></div>
      <div class="parordo-field-grid" style="margin-top:10px">
        <button id="parOrdoPricingActivate" class="parordo-action-primary" type="button" style="margin-top:0">✓ Активировать</button>
        <button id="parOrdoPricingDeactivate" class="parordo-action-primary" type="button" style="margin-top:0;background:linear-gradient(135deg,#451c18,#7e2e26);border-color:#a44c40;color:#ffe0d9">■ Неактив</button>
      </div>
      <div id="parOrdoPricingMessage" class="parordo-subtitle" style="margin-top:10px"></div>`;

    card.append(bookingsPanel, tariffsPanel);
    if (!tabs.dataset.parordoBound) {
      tabs.dataset.parordoBound = '1';
      tabs.addEventListener('click', event => {
        const ext = event.target.closest('[data-parordo-tab]');
        if (ext) {
          event.preventDefault();
          event.stopPropagation();
          setExtraTab(card, ext.dataset.parordoTab);
          return;
        }
        const core = event.target.closest('[data-customer-base-tab]');
        if (core) {
          state.coreTab = core.dataset.customerBaseTab || 'clients';
          state.activeExtraTab = state.coreTab;
          coreElements(card).forEach(el => el.classList.remove('parordo-extra-hidden'));
          bookingsPanel.classList.add('parordo-extra-hidden');
          tariffsPanel.classList.add('parordo-extra-hidden');
        }
      });
    }
    const form = SELECT('#parOrdoBookingForm', card);
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      const dt = SELECT('#parOrdoBookingAt', form);
      if (dt) { dt.min = localDateTimeValue(new Date()); dt.value = localDateTimeValue(nextBookableTime()); }
      form.addEventListener('submit', event => createBooking(event, card));
      SELECT('#parOrdoBookingsRefresh', card)?.addEventListener('click', () => loadBookings(card, true));
      SELECT('#parOrdoPricingRefresh', card)?.addEventListener('click', () => loadPricing(card, true));
      SELECT('#parOrdoPricingActivate', card)?.addEventListener('click', () => setPricing(true, card));
      SELECT('#parOrdoPricingDeactivate', card)?.addEventListener('click', () => setPricing(false, card));
      SELECT('#parOrdoBookingsList', card)?.addEventListener('click', event => {
        const button = event.target.closest('[data-cancel-booking]');
        if (button) cancelBooking(button.dataset.cancelBooking, card, button);
      });
    }
    if (!roleIsManager()) {
      [SELECT('#parOrdoBookingForm', card), SELECT('#parOrdoPricingActivate', card), SELECT('#parOrdoPricingDeactivate', card)].filter(Boolean).forEach(el => el.disabled = false);
    } else {
      SELECT_ALL('#parOrdoBookingForm input, #parOrdoBookingForm button, #parOrdoPricingActivate, #parOrdoPricingDeactivate', card).forEach(el => el.disabled = true);
    }
    setExtraTab(card, state.coreTab || 'clients');
  }

  async function loadPricing(card, force = false) {
    if (state.pricingLoaded && !force && Date.now() - (state.pricingFetchedAt || 0) < 15000) {
      renderPricing(card); updateEntryButtons(); return;
    }
    try {
      const result = await api('/api/admin/control/entry-pricing');
      state.pricing = { ...result, active: result.active === true };
      state.pricingLoaded = true; state.pricingFetchedAt = Date.now();
      renderPricing(card); updateEntryButtons();
    } catch (error) {
      const message = SELECT('#parOrdoPricingMessage', card);
      if (message) { message.textContent = 'Не удалось получить тарифы. Обновите Worker API до V10.12.'; message.classList.add('parordo-error'); }
      console.warn('[PAR ORDO] pricing API:', error);
    }
  }
  function renderPricing(card) {
    const status = SELECT('#parOrdoTariffStatus', card);
    if (status) { status.textContent = state.pricing.active ? 'АКТИВЕН' : 'НЕАКТИВ'; status.classList.toggle('on', state.pricing.active); }
    const prices = currentPrices();
    const current = SELECT('#parOrdoCurrentTariff', card);
    if (current) {
      const currentText = `Сейчас (${new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Bishkek',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date())}): взрослый ${prices.adult} сом · детский ${prices.child} сом`;
      if (current.textContent !== currentText) current.textContent = currentText;
    }
    const activeBtn = SELECT('#parOrdoPricingActivate', card), inactiveBtn = SELECT('#parOrdoPricingDeactivate', card);
    if (activeBtn) { activeBtn.disabled = roleIsManager() || state.pricing.active || state.priceBusy; activeBtn.style.opacity = state.pricing.active ? '.52' : '1'; }
    if (inactiveBtn) { inactiveBtn.disabled = roleIsManager() || !state.pricing.active || state.priceBusy; inactiveBtn.style.opacity = !state.pricing.active ? '.52' : '1'; }
    const message = SELECT('#parOrdoPricingMessage', card);
    if (message && !message.classList.contains('parordo-error')) message.textContent = state.pricing.active ? 'Тарифы активны: цены входа обновляются по времени.' : 'Обычные цены включены: взрослый 300 сом, детский 200 сом.';
  }
  async function setPricing(active, card) {
    if (roleIsManager() || state.priceBusy) return;
    state.priceBusy = true;
    const message = SELECT('#parOrdoPricingMessage', card);
    if (message) { message.textContent = 'Сохраняем настройку…'; message.classList.remove('parordo-error'); }
    try {
      const result = await api('/api/admin/control/entry-pricing', { method:'POST', body:JSON.stringify({ active }) });
      state.pricing = { ...result, active: result.active === true }; state.pricingLoaded = true; state.pricingFetchedAt = Date.now();
      renderPricing(card); updateEntryButtons();
      showToast(result.message || (active ? 'Тарифы активированы ✅' : 'Обычные цены восстановлены ✅'));
    } catch (error) {
      if (message) { message.textContent = error.message || 'Не удалось сохранить тарифы. Проверьте, установлен ли Worker V10.12.'; message.classList.add('parordo-error'); }
      showToast('Не удалось сохранить тарифы: ' + error.message);
    } finally {
      state.priceBusy = false; renderPricing(card);
    }
  }

  async function loadBookings(card, force = false) {
    const list = SELECT('#parOrdoBookingsList', card);
    if (!list) return;
    if (!force && state.bookingsFetchedAt && Date.now() - state.bookingsFetchedAt < 12000) { renderBookings(card); return; }
    list.innerHTML = '<div class="parordo-empty">Загружаем записи…</div>';
    try {
      const result = await api('/api/admin/control/bookings');
      state.bookingRows = Array.isArray(result.bookings) ? result.bookings : [];
      state.bookingsFetchedAt = Date.now();
      renderBookings(card);
    } catch (error) {
      list.innerHTML = `<div class="parordo-empty parordo-error">Не удалось загрузить записи: ${esc(error.message)}.<br>Обновите Worker API до V10.12.</div>`;
    }
  }
  function renderBookings(card) {
    const list = SELECT('#parOrdoBookingsList', card);
    if (!list) return;
    const rows = state.bookingRows.filter(row => row.status === 'booked');
    if (!rows.length) { list.innerHTML = '<div class="parordo-empty">Пока записей нет. Создайте первую запись выше.</div>'; return; }
    list.innerHTML = rows.map(row => {
      const date = String(row.appointmentAt || '').replace('T', ' · ');
      return `<article class="parordo-booking-item"><div><strong>${esc(row.name)}</strong><small>☎ ${esc(row.phone)}<br>🗓 ${esc(date)}${row.createdBy ? `<br>Записал: ${esc(row.createdBy)}` : ''}</small></div>${canWrite() ? `<button class="parordo-action-ghost" type="button" data-cancel-booking="${esc(row.id)}">Отменить</button>` : '<span class="parordo-active-pill on">Запись</span>'}</article>`;
    }).join('');
  }
  async function createBooking(event, card) {
    event.preventDefault();
    if (roleIsManager() || state.bookingBusy) return;
    const form = event.currentTarget;
    const name = SELECT('#parOrdoBookingName', form).value.trim().replace(/\s+/g, ' ');
    const phone = SELECT('#parOrdoBookingPhone', form).value.trim();
    const appointmentAt = SELECT('#parOrdoBookingAt', form).value;
    if (name.length < 2 || !phone || !appointmentAt) { showToast('Заполните имя, телефон и дату/время.'); return; }
    const clock = appointmentAt.slice(11,16);
    if (clock < '10:00' || clock >= '23:00') { showToast('Запись доступна на время с 10:00 до 23:00.'); return; }
    state.bookingBusy = true;
    const submit = SELECT('#parOrdoBookingSubmit', form);
    if (submit) { submit.disabled = true; submit.textContent = 'Сохраняем…'; }
    try {
      const result = await api('/api/admin/control/bookings', { method:'POST', body:JSON.stringify({ name, phone, appointmentAt }) });
      form.reset();
      const dt = SELECT('#parOrdoBookingAt', form); if (dt) { dt.min = localDateTimeValue(new Date()); dt.value = localDateTimeValue(nextBookableTime()); }
      state.bookingsFetchedAt = 0;
      await loadBookings(card, true);
      showToast(result.message || 'Запись сохранена ✅');
    } catch (error) {
      showToast('Не удалось сохранить запись: ' + error.message);
    } finally {
      state.bookingBusy = false;
      if (submit) { submit.disabled = roleIsManager(); submit.textContent = '＋ Сохранить запись'; }
    }
  }
  async function cancelBooking(id, card, button) {
    if (roleIsManager() || button.disabled) return;
    if (!window.confirm('Отменить эту запись клиента?')) return;
    button.disabled = true;
    try {
      const result = await api(`/api/admin/control/bookings/${encodeURIComponent(id)}/status`, { method:'POST', body:JSON.stringify({ status:'cancelled' }) });
      state.bookingsFetchedAt = 0; await loadBookings(card, true);
      showToast(result.message || 'Запись отменена.');
    } catch (error) {
      showToast('Не удалось отменить запись: ' + error.message); button.disabled = false;
    }
  }

  async function decorateBonusCards(card) {
    const list = SELECT('#customerBaseList', card);
    if (!list) return;
    if (state.decorateBusy) { state.decorateQueued = true; return; }
    state.decorateBusy = true;
    try {
      const result = await api('/api/admin/control/customer-base');
      const customers = new Map((result.customers || []).map(customer => [String(customer.id), customer]));
      for (const entry of SELECT_ALL('.customer-base-entry', list)) {
        const edit = SELECT('[data-edit-base-customer]', entry);
        const id = edit?.dataset.editBaseCustomer;
        const bonusBox = SELECT('.customer-base-bonus', entry);
        if (!id || !bonusBox) continue; // Manager/read-only view has no edit control.
        const customer = customers.get(String(id));
        if (!customer) continue;
        const oldControls = SELECT('.parordo-bonus-actions', bonusBox);
        if (oldControls) oldControls.remove();
        SELECT_ALL('[data-customer-bonus]', bonusBox).forEach(el => el.remove());
        const span = SELECT('span', bonusBox);
        const used = Number(customer.bonusUsedThisMonth || 0) > 0;
        const active = customer.bonusActive === true;
        const count = Number(customer.bonusVisitsThisMonth || 0);
        if (span) {
          span.classList.add('parordo-bonus-summary');
          if (used) span.textContent = `Бонус уже использован в этом месяце · всего использовано: ${Number(customer.bonusCount || 0)}`;
          else if (active) span.textContent = `БОНУС АКТИВЕН · визитов в активные периоды: ${count}/4`;
          else if (customer.bonusStatus === 'stopped') span.textContent = `БОНУС НЕАКТИВЕН · подсчёт приостановлен. При повторной активации он продолжится; визиты во время паузы не считаются.`;
          else span.textContent = 'БОНУС НЕАКТИВЕН · нажмите «Активировать», чтобы начать считать визиты с этого момента.';
        }
        bonusBox.classList.toggle('available', active && !used);
        const controls = document.createElement('div');
        controls.className = 'parordo-bonus-actions';
        controls.innerHTML = `<button type="button" data-parordo-bonus-toggle="${esc(id)}" data-state="active" class="${active ? 'is-selected':''}" ${active || used || state.busyBonusIds.has(String(id)) ? 'disabled':''}>✓ Активировать</button><button type="button" data-parordo-bonus-toggle="${esc(id)}" data-state="stopped" class="${!active ? 'is-selected':''}" ${!active || used || state.busyBonusIds.has(String(id)) ? 'disabled':''}>■ Неактив</button>`;
        bonusBox.appendChild(controls);
      }
    } catch (error) {
      console.warn('[PAR ORDO] bonus controls refresh failed:', error);
    } finally {
      state.decorateBusy = false;
      if (state.decorateQueued) {
        state.decorateQueued = false;
        queueBonusRefresh(card);
      }
    }
  }

  async function changeBonus(customerId, status, button, card) {
    if (!canWrite() || state.busyBonusIds.has(String(customerId))) return;
    const action = status === 'active' ? 'активировать' : 'остановить';
    if (!window.confirm(`Вы действительно хотите ${action} бонусный подсчёт? Он будет учитывать только посещения в период активного состояния.`)) return;
    state.busyBonusIds.add(String(customerId));
    SELECT_ALL(`[data-parordo-bonus-toggle="${CSS.escape(String(customerId))}"]`, card).forEach(el => el.disabled = true);
    try {
      const result = await api(`/api/admin/control/customer-base/${encodeURIComponent(customerId)}/bonus`, { method:'POST', body:JSON.stringify({ status }) });
      showToast(result.message || 'Статус бонуса обновлён ✅');
      if (typeof window.loadCustomerBaseEntries === 'function') await window.loadCustomerBaseEntries();
      else await decorateBonusCards(card);
    } catch (error) {
      showToast('Не удалось изменить бонус: ' + error.message);
    } finally {
      state.busyBonusIds.delete(String(customerId));
      queueBonusRefresh(card);
    }
  }
  function queueBonusRefresh(card) {
    clearTimeout(state.listRefreshTimer);
    state.listRefreshTimer = setTimeout(() => decorateBonusCards(card), 120);
  }

  function updateEntryButtons() {
    const card = SELECT('#addModalCard');
    if (!card) return;
    const adult = SELECT('#addEntry', card), child = SELECT('#addChildEntry', card);
    const prices = currentPrices();
    if (adult) {
      adult.dataset.parordoEntryButton = 'adult';
      const label = SELECT('span', adult);
      if (label) label.textContent = `${prices.adult} сом　＋`;
      adult.onclick = () => {
        if (typeof window.addPurchase === 'function') return window.addPurchase({ name:'Вход', price:prices.adult, productId:null });
        showToast('Не удалось добавить вход: обновите основную панель.');
      };
    }
    if (child) {
      child.dataset.parordoEntryButton = 'child';
      const label = SELECT('span', child);
      if (label) label.textContent = `${prices.child} сом　＋`;
      child.onclick = () => {
        if (typeof window.addPurchase === 'function') return window.addPurchase({ name:'Вход детский', price:prices.child, productId:null });
        showToast('Не удалось добавить детский вход: обновите основную панель.');
      };
    }
  }
  async function refreshSharedSettings(force = false) {
    if (!state.pricingLoaded || force || Date.now() - (state.pricingFetchedAt || 0) > 30000) {
      try {
        const result = await api('/api/admin/control/entry-pricing');
        state.pricing = { ...result, active: result.active === true };
        state.pricingLoaded = true; state.pricingFetchedAt = Date.now();
        const card = SELECT('#parOrdoTariffsPanel')?.closest('#customerBaseModalCard');
        if (card && SELECT('#parOrdoTariffsPanel', card)) renderPricing(card);
      } catch (error) { console.debug('[PAR ORDO] shared tariff refresh:', error.message); }
    }
    updateEntryButtons();
  }

  function observeCustomerList(list, card) {
    if (!list || state.observedLists.has(list)) return;
    state.observedLists.add(list);
    // Observe only direct list rerenders, not our own controls inside each customer card.
    const observer = new MutationObserver(() => queueBonusRefresh(card));
    observer.observe(list, { childList:true, subtree:false });
  }
  function observeApp() {
    const customerCard = SELECT('#customerBaseModalCard');
    if (customerCard && !state.observedCards.has(customerCard)) {
      state.observedCards.add(customerCard);
      const observer = new MutationObserver(() => {
        // Observe direct modal redraws only. Nested card text/control updates must not trigger repeated API calls.
        setTimeout(() => {
          const list = SELECT('#customerBaseList', customerCard);
          if (!list) return;
          observeCustomerList(list, customerCard);
          if (!SELECT('#parOrdoBookingsPanel', customerCard) || !SELECT('#parOrdoTariffsPanel', customerCard)) {
            state.coreTab = 'clients'; state.activeExtraTab = 'clients';
            buildExtraPanels(customerCard);
          }
          queueBonusRefresh(customerCard);
        }, 80);
      });
      observer.observe(customerCard, { childList:true, subtree:false });
      const existingList = SELECT('#customerBaseList', customerCard);
      if (existingList) observeCustomerList(existingList, customerCard);
    } else if (customerCard) {
      const existingList = SELECT('#customerBaseList', customerCard);
      if (existingList) observeCustomerList(existingList, customerCard);
      if (existingList && !SELECT('#parOrdoBookingsPanel', customerCard)) buildExtraPanels(customerCard);
    }
    const addCard = SELECT('#addModalCard');
    if (addCard && !state.observedCards.has(addCard)) {
      state.observedCards.add(addCard);
      // Only observe direct modal redraws. Product-grid rerenders happen deeper and must not trigger dozens of callbacks.
      const observer = new MutationObserver(() => setTimeout(updateEntryButtons, 20));
      observer.observe(addCard, { childList:true, subtree:false });
    }
    updateEntryButtons();
  }

  document.addEventListener('click', event => {
    const bonusButton = event.target.closest('[data-parordo-bonus-toggle]');
    if (bonusButton) {
      const card = SELECT('#customerBaseModalCard');
      changeBonus(bonusButton.dataset.parordoBonusToggle, bonusButton.dataset.state, bonusButton, card);
    }
  });

  function wrapOpenAdd() {
    const original = window.openAdd;
    if (typeof original !== 'function' || original.__parOrdoV110Wrapped) return;
    const wrapped = async function(...args) {
      await refreshSharedSettings(true);
      return original.apply(this, args);
    };
    wrapped.__parOrdoV110Wrapped = true;
    window.openAdd = wrapped;
  }
  function start() {
    observeApp();
    wrapOpenAdd();
    // The modal elements exist in the page shell from startup; observe those only to avoid processing bracelet timer updates on every second.
    // Keep price labels in an already-open purchase dialog current and sync the shared switch across devices.
    refreshSharedSettings(true);
    if (!state.interval) state.interval = window.setInterval(() => refreshSharedSettings(false), 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshSharedSettings(true); });
    window.addEventListener('focus', () => refreshSharedSettings(true));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
  else start();
})();
