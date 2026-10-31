/* PAR ORDO PRO V120 — friendly handling for already-processed bookings.
   Load this script AFTER par-ordo-customer-features-v118.js.
   Uses the existing authenticated Worker API; does not replace the current CRM tabs. */
(() => {
  'use strict';

  const API_BASE = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const TAB_KEY = 'client-bookings';
  const POLL_MS = 20000;
  let activeTab = 'clients';
  let pollTimer = null;
  let observer = null;
  let ensureTimer = null;
  let loading = false;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  function toast(message) {
    if (typeof window.toast === 'function') window.toast(message);
    else if (typeof window.showToast === 'function') window.showToast(message);
    else window.alert(message);
  }

  async function api(path, options = {}) {
    if (typeof window.api === 'function') return window.api(path, options);
    const headers = { Accept: 'application/json' };
    if (options.body) headers['Content-Type'] = 'application/json';
    const token = sessionStorage.getItem('parordo_admin_token') || '';
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(API_BASE + path, {
      ...options,
      headers: { ...headers, ...(options.headers || {}) }
    });
    let data = null;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data?.error || `API ${response.status}`);
    return data;
  }

  function readonly() {
    return document.body.classList.contains('manager-readonly');
  }

  function formatDate(value) {
    const raw = String(value || '');
    return raw.replace('T', ' · ');
  }

  function addStyles() {
    if ($('#parOrdoClientBookingsV120Style')) return;
    const style = document.createElement('style');
    style.id = 'parOrdoClientBookingsV120Style';
    style.textContent = `
      .parordo-client-bookings-hint{margin:0 0 10px;color:#c7d1c5;font-size:11px;line-height:1.55}
      #parOrdoClientBookingsPanel .parordo-booking-item{align-items:start}
      #parOrdoClientBookingsPanel .parordo-booking-actions{min-width:112px}
      #parOrdoClientBookingsPanel .parordo-booking-actions button{flex:1 1 100%;min-height:34px}
      #parOrdoClientBookingsPanel .parordo-booking-item.is-pending{border-color:rgba(0,210,180,.58)}
      #parOrdoClientBookingsPanel .parordo-client-booking-status{display:inline-flex;margin-top:5px;padding:4px 7px;border:1px solid #8c6a35;border-radius:999px;color:#ffdf9a;font-size:9px;font-weight:900}
      #parOrdoClientBookingsPanel .parordo-client-booking-status.confirmed{border-color:#3b9c66;color:#9bf0b8}
    `;
    document.head.appendChild(style);
  }

  function getCoreElements(card) {
    return [
      $('#customerBaseForm', card),
      $('#customerBaseOverview', card),
      $('#customerBaseSearchWrap', card),
      $('#customerBaseCount', card),
      $('#customerBaseList', card)
    ].filter(Boolean);
  }

  function selectThisTab(card) {
    const panel = $('#parOrdoClientBookingsPanel', card);
    const tabs = $('.customer-base-tabs', card);
    if (!panel || !tabs) return;
    activeTab = TAB_KEY;
    getCoreElements(card).forEach(el => el.classList.add('parordo-extra-hidden'));
    ['#parOrdoBookingsPanel', '#parOrdoTariffsPanel'].forEach(selector => {
      const el = $(selector, card);
      if (el) el.classList.add('parordo-extra-hidden');
    });
    panel.classList.remove('parordo-extra-hidden');
    $$('button[data-customer-base-tab], button[data-parordo-tab]', tabs).forEach(button => {
      button.classList.toggle('active', button.dataset.parordoTab === TAB_KEY);
    });
    loadBookings(card, true);
  }

  function buildPanel(card) {
    const tabs = $('.customer-base-tabs', card);
    const list = $('#customerBaseList', card);
    if (!tabs || !list) return;

    let tab = $(`button[data-parordo-tab="${TAB_KEY}"]`, tabs);
    if (!tab) {
      tab = document.createElement('button');
      tab.type = 'button';
      tab.dataset.parordoTab = TAB_KEY;
      tab.textContent = 'Бронирования клиентов';
      const manualTab = $('button[data-parordo-tab="bookings"]', tabs);
      const tariffTab = $('button[data-parordo-tab="tariffs"]', tabs);
      if (manualTab && tariffTab) tabs.insertBefore(tab, tariffTab);
      else if (manualTab?.nextSibling) tabs.insertBefore(tab, manualTab.nextSibling);
      else tabs.appendChild(tab);
    }

    let panel = $('#parOrdoClientBookingsPanel', card);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'parOrdoClientBookingsPanel';
      panel.className = 'parordo-feature-panel parordo-extra-hidden';
      panel.innerHTML =
        '<div class="parordo-panel-row"><h3>Бронирования клиентов</h3>' +
          '<button id="parOrdoClientBookingsRefresh" class="parordo-action-ghost" type="button">↻ Обновить</button></div>' +
        '<p class="parordo-client-bookings-hint">Заявки, которые клиенты отправили через сайт. Здесь можно подтвердить, отклонить или отметить запись выполненной.</p>' +
        '<div id="parOrdoClientBookingsList" class="parordo-booking-list"><div class="parordo-empty">Откройте вкладку, чтобы загрузить бронирования.</div></div>';
      card.appendChild(panel);

      $('#parOrdoClientBookingsRefresh', panel)?.addEventListener('click', () => loadBookings(card, true));
      $('#parOrdoClientBookingsList', panel)?.addEventListener('click', event => {
        const button = event.target.closest('[data-client-booking-status]');
        if (!button) return;
        updateBookingStatus(button.dataset.clientBookingStatus, button.dataset.status || 'cancelled', button, card);
      });
    }

    if (!tabs.dataset.parOrdoClientBookingsV120Bound) {
      tabs.dataset.parOrdoClientBookingsV120Bound = '1';
      // Capture this new tab before V118's handler; leave all existing tabs to V118.
      tabs.addEventListener('click', event => {
        const button = event.target.closest('button[data-customer-base-tab], button[data-parordo-tab]');
        if (!button) return;
        if (button.dataset.parordoTab === TAB_KEY) {
          event.preventDefault();
          event.stopImmediatePropagation();
          selectThisTab(card);
          return;
        }
        activeTab = button.dataset.parordoTab || button.dataset.customerBaseTab || 'clients';
        panel.classList.add('parordo-extra-hidden');
      }, true);
    }
  }

  async function loadBookings(card, force = false) {
    const list = $('#parOrdoClientBookingsList', card);
    if (!list || loading) return;
    if (force) list.innerHTML = '<div class="parordo-empty">Жүктөлүүдө…</div>';
    loading = true;
    try {
      const result = await api('/api/admin/control/bookings');
      const rows = Array.isArray(result.bookings) ? result.bookings : [];
      renderBookings(list, rows);
    } catch (error) {
      list.innerHTML = '<div class="parordo-empty parordo-error">Не удалось загрузить бронирования: ' + esc(error.message) + '.</div>';
    } finally {
      loading = false;
    }
  }

  function renderBookings(list, allRows) {
    const rows = allRows
      .filter(row => row.createdBy === 'customer-app' && (row.status === 'pending' || row.status === 'booked'))
      .slice()
      .sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1));

    if (!rows.length) {
      list.innerHTML = '<div class="parordo-empty">Пока нет онлайн-заявок от клиентов. Новые бронирования появятся здесь.</div>';
      return;
    }

    list.innerHTML = rows.map(row => {
      const pending = row.status === 'pending';
      const date = esc(formatDate(row.appointmentAt));
      const note = row.note ? '<br>📋 ' + esc(row.note) : '';
      let actions = '<span class="parordo-client-booking-status confirmed">ПОДТВЕРЖДЕНО</span>';
      if (pending && !readonly()) {
        actions = '<div class="parordo-booking-actions">' +
          '<button class="parordo-action-ghost" type="button" data-client-booking-status="' + esc(row.id) + '" data-status="booked">Подтвердить</button>' +
          '<button class="parordo-action-ghost" type="button" data-client-booking-status="' + esc(row.id) + '" data-status="cancelled">Отклонить</button></div>';
      } else if (!pending && !readonly()) {
        actions = '<div class="parordo-booking-actions">' +
          '<button class="parordo-action-ghost" type="button" data-client-booking-status="' + esc(row.id) + '" data-status="completed">Выполнено</button>' +
          '<button class="parordo-action-ghost" type="button" data-client-booking-status="' + esc(row.id) + '" data-status="cancelled">Отменить</button></div>';
      } else if (pending) {
        actions = '<span class="parordo-client-booking-status">ОЖИДАЕТ</span>';
      }
      return '<article class="parordo-booking-item ' + (pending ? 'is-pending' : '') + '">' +
        '<div><strong>' + (pending ? 'НОВАЯ ЗАЯВКА · ' : '') + esc(row.name) + '</strong>' +
        '<small>☎ ' + esc(row.phone) + '<br>🗓 ' + date + note + '<br>Источник: онлайн-сайт</small></div>' + actions + '</article>';
    }).join('');
  }

  async function updateBookingStatus(id, status, button, card) {
    if (readonly() || !id || button.disabled) return;
    const promptText = status === 'booked'
      ? 'Подтвердить заявку клиента?'
      : status === 'completed'
        ? 'Отметить запись как выполненную?'
        : 'Отклонить или отменить заявку клиента?';
    if (!window.confirm(promptText)) return;
    const entry = button.closest('.parordo-booking-item');
    const rowButtons = entry ? Array.from(entry.querySelectorAll('button')) : [button];
    rowButtons.forEach(item => { item.disabled = true; });
    try {
      const result = await api('/api/admin/control/bookings/' + encodeURIComponent(id) + '/status', {
        method: 'POST', body: JSON.stringify({ status })
      });
      await loadBookings(card, true);
      toast(result.message || 'Статус бронирования обновлён ✅');
    } catch (error) {
      const message = String(error?.message || error || '');
      if (/409|уже обработана|переход статуса недоступен/i.test(message)) {
        await loadBookings(card, true);
        toast('Эта заявка уже обработана. Список обновлён ✅');
        return;
      }
      toast('Не удалось изменить статус бронирования. ' + message);
      rowButtons.forEach(item => { item.disabled = false; });
    }
  }

  function ensure() {
    const card = $('#customerBaseModalCard');
    if (!card) return;
    addStyles();
    buildPanel(card);
  }

  function queueEnsure() {
    if (ensureTimer) clearTimeout(ensureTimer);
    ensureTimer = setTimeout(() => { ensureTimer = null; ensure(); }, 80);
  }

  function start() {
    ensure();
    const card = $('#customerBaseModalCard');
    if (card && !observer) {
      observer = new MutationObserver(queueEnsure);
      observer.observe(card, { childList: true, subtree: true });
    }
    if (!pollTimer) {
      pollTimer = setInterval(() => {
        const modal = $('#customerBaseModal');
        const currentCard = $('#customerBaseModalCard');
        if (!modal?.classList.contains('open')) {
          activeTab = 'clients';
          return;
        }
        if (activeTab === TAB_KEY && currentCard) loadBookings(currentCard, true);
      }, POLL_MS);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
