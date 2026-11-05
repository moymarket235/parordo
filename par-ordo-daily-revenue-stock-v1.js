/* PAR ORDO — DAILY REVENUE & STOCK RECEIPTS V1
   Manager-only reporting add-on.
   Reads existing saved shift reports and stock_receipt audit events.
   Does not modify bookings, cash operations, stock quantities, or Worker data.
*/
(() => {
  'use strict';

  const API_BASE = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const STYLE_ID = 'poDailyRevenueStockV1Style';
  const STATE = {
    reports: [],
    receipts: [],
    loading: false,
    lastLoadedAt: 0,
    reportDate: '',
    receiptDate: ''
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));

  const money = value => `${Number(value || 0).toLocaleString('ru-RU')} сом`;
  const number = value => Number(value || 0).toLocaleString('ru-RU');

  function localDateKey(value = new Date()) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function formatTime(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function formatDateTime(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'Время не указано';
    return d.toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  async function api(path) {
    const token = sessionStorage.getItem('parordo_admin_token') || '';
    if (!token) throw new Error('Сессия не найдена. Войдите в панель руководителя заново.');
    const response = await fetch(API_BASE + path, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store'
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data?.error || `Ошибка API ${response.status}`);
    return data;
  }

  const isAdmission = item => {
    const name = String(item?.name || '').trim().toLocaleLowerCase('ru');
    return name === 'вход' ||
      name === 'вход детский' ||
      name === 'бонусный вход (5-й визит)' ||
      name === 'бонусный вход';
  };

  function emptyBreakdown() {
    return {
      entryRevenue: 0,
      adultEntryRevenue: 0,
      adultEntryQty: 0,
      childEntryRevenue: 0,
      childEntryQty: 0,
      bonusEntryQty: 0,
      productRevenue: 0,
      productQty: 0,
      totalRevenue: 0,
      clients: 0,
      products: new Map(),
      shifts: 0
    };
  }

  function addReportToBreakdown(target, report) {
    target.shifts += 1;
    const clients = Array.isArray(report?.clients) ? report.clients : [];
    target.clients += Number(report?.clientCount || clients.length || 0);

    for (const client of clients) {
      const items = Array.isArray(client?.items) ? client.items : [];
      for (const item of items) {
        const qty = Math.max(1, Math.floor(Number(item?.qty || 1)));
        const price = Math.max(0, Number(item?.price || 0));
        const amount = qty * price;
        const name = String(item?.name || 'Товар').trim() || 'Товар';
        const method = String(item?.method || '');

        // Closed shift reports should have no unpaid items. Ignore any unexpected pending line
        // rather than treating it as collected money.
        if (amount > 0 && method !== 'cash' && method !== 'transfer') continue;

        const lowerName = name.toLocaleLowerCase('ru');
        if (isAdmission(item)) {
          if (lowerName === 'вход') {
            target.adultEntryQty += qty;
            target.adultEntryRevenue += amount;
          } else if (lowerName === 'вход детский') {
            target.childEntryQty += qty;
            target.childEntryRevenue += amount;
          } else {
            target.bonusEntryQty += qty;
          }
          target.entryRevenue += amount;
          continue;
        }

        target.productQty += qty;
        target.productRevenue += amount;
        const key = name.toLocaleLowerCase('ru');
        const current = target.products.get(key) || { name, qty: 0, revenue: 0 };
        current.qty += qty;
        current.revenue += amount;
        target.products.set(key, current);
      }
    }

    target.totalRevenue = target.entryRevenue + target.productRevenue;
  }

  function selectedDayReports() {
    const day = STATE.reportDate || localDateKey();
    return STATE.reports.filter(report => String(report?.shiftDate || '') === day);
  }

  function dailyBreakdown() {
    const result = emptyBreakdown();
    selectedDayReports().forEach(report => addReportToBreakdown(result, report));
    return result;
  }

  function renderDailyRevenue() {
    const root = $('#poDailyRevenueContent');
    const dateInput = $('#poDailyRevenueDate');
    if (!root) return;

    const day = STATE.reportDate || localDateKey();
    if (dateInput && dateInput.value !== day) dateInput.value = day;

    const reports = selectedDayReports();
    if (!reports.length) {
      root.innerHTML = `
        <div class="po-dr-empty">
          <strong>За выбранную дату закрытых смен нет.</strong>
          <span>Когда персонал завершит смену и отправит отчёт, здесь появятся доход от входов, продажи товаров и количество каждой позиции.</span>
        </div>`;
      return;
    }

    const d = dailyBreakdown();
    const rows = [...d.products.values()].sort((a, b) => b.revenue - a.revenue || b.qty - a.qty);
    root.innerHTML = `
      <div class="po-dr-kpis">
        <article class="po-dr-kpi po-dr-entry"><small>ДОХОД ОТ ВХОДОВ</small><strong>${money(d.entryRevenue)}</strong><span>Взрослые: ${number(d.adultEntryQty)} · ${money(d.adultEntryRevenue)}</span><span>Детские: ${number(d.childEntryQty)} · ${money(d.childEntryRevenue)}</span>${d.bonusEntryQty ? `<span>Бонусных входов: ${number(d.bonusEntryQty)}</span>` : ''}</article>
        <article class="po-dr-kpi po-dr-products"><small>ВЫРУЧКА ОТ ТОВАРОВ</small><strong>${money(d.productRevenue)}</strong><span>Продано: ${number(d.productQty)} шт. · ${rows.length} наимен.</span></article>
        <article class="po-dr-kpi po-dr-total"><small>ВСЕГО ПОЛУЧЕНО</small><strong>${money(d.totalRevenue)}</strong><span>${number(d.shifts)} закрытых смен · ${number(d.clients)} клиентов</span></article>
      </div>
      <div class="po-dr-table-wrap">
        <div class="po-dr-table-title">ТОВАРЫ ЗА ДЕНЬ</div>
        ${rows.length ? `
          <div class="po-dr-table-head"><span>Название товара</span><span>Кол-во</span><span>Выручка</span></div>
          ${rows.map(item => `<div class="po-dr-table-row"><strong>${escapeHtml(item.name)}</strong><span>${number(item.qty)} шт.</span><b>${money(item.revenue)}</b></div>`).join('')}
        ` : '<div class="po-dr-empty-row">Продаж товаров за эту дату нет.</div>'}
      </div>
      <div class="po-dr-shifts">
        ${reports.map(report => {
          const one = emptyBreakdown();
          addReportToBreakdown(one, report);
          return `<div class="po-dr-shift-row"><span>Смена · ${escapeHtml(formatDateTime(report.closedAt))}</span><b>Входы ${money(one.entryRevenue)} · Товары ${money(one.productRevenue)}</b></div>`;
        }).join('')}
      </div>`;
  }

  function renderStockReceipts() {
    const root = $('#poStockReceiptsContent');
    const dateInput = $('#poStockReceiptsDate');
    if (!root) return;

    const day = STATE.receiptDate || localDateKey();
    if (dateInput && dateInput.value !== day) dateInput.value = day;

    const rows = STATE.receipts
      .filter(event => localDateKey(event.createdAt) === day)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalQty = rows.reduce((sum, event) => sum + Math.max(0, Number(event.details?.qty || 0)), 0);
    if (!rows.length) {
      root.innerHTML = `<div class="po-dr-empty"><strong>Поступлений за выбранную дату нет.</strong><span>Каждое новое добавление товара на склад появится здесь автоматически.</span></div>`;
      return;
    }

    root.innerHTML = `
      <div class="po-stock-summary"><span>Операций поступления: <b>${number(rows.length)}</b></span><span>Добавлено всего: <b>+${number(totalQty)} шт.</b></span></div>
      <div class="po-stock-list">
        ${rows.map(event => {
          const details = event.details || {};
          const name = details.productName || `Товар №${event.target || '—'}`;
          const qty = Math.max(0, Number(details.qty || 0));
          const by = details.by || event.username || 'Не указано';
          return `<article class="po-stock-row">
            <div class="po-stock-main"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(formatTime(event.createdAt))} · Добавил: ${escapeHtml(by)}</small></div>
            <b class="po-stock-qty">+${number(qty)} шт.</b>
          </article>`;
        }).join('')}
      </div>`;
  }

  function renderLoadError(selector, message) {
    const root = $(selector);
    if (root) root.innerHTML = `<div class="po-dr-error">${escapeHtml(message)}</div>`;
  }

  async function loadData(force = false) {
    const panel = $('#reportsPanel');
    if (!panel || panel.classList.contains('hidden') || document.hidden || STATE.loading) return;
    if (!force && Date.now() - STATE.lastLoadedAt < 12000) return;

    STATE.loading = true;
    try {
      const [reportsResult, auditResult] = await Promise.allSettled([
        api('/api/admin/control/reports'),
        api('/api/admin/audit?limit=200')
      ]);

      if (reportsResult.status === 'fulfilled') {
        STATE.reports = Array.isArray(reportsResult.value?.reports) ? reportsResult.value.reports : [];
        renderDailyRevenue();
      } else {
        renderLoadError('#poDailyRevenueContent', `Не удалось загрузить отчёты смен: ${reportsResult.reason?.message || 'ошибка API'}`);
      }

      if (auditResult.status === 'fulfilled') {
        STATE.receipts = Array.isArray(auditResult.value?.events)
          ? auditResult.value.events.filter(event => event.action === 'stock_receipt')
          : [];
        renderStockReceipts();
      } else {
        renderLoadError('#poStockReceiptsContent', `Не удалось загрузить журнал поступлений: ${auditResult.reason?.message || 'ошибка API'}`);
      }

      STATE.lastLoadedAt = Date.now();
    } finally {
      STATE.loading = false;
    }
  }

  function ensureDailyPanel() {
    const history = $('#historyPanel');
    if (history && !$('#poDailyRevenuePanel')) {
      const panel = document.createElement('section');
      panel.id = 'poDailyRevenuePanel';
      panel.className = 'po-daily-revenue-panel';
      panel.innerHTML = `
        <div class="po-dr-head">
          <div><div class="eyebrow">ФИНАНСЫ · ЗА ДЕНЬ</div><h3>Ежедневный отчёт</h3><p>Отдельно входы, товары и количество каждой проданной позиции.</p></div>
          <label>Дата<input id="poDailyRevenueDate" type="date"></label>
        </div>
        <div id="poDailyRevenueContent"><div class="po-dr-loading">Загружаем ежедневный отчёт…</div></div>
        <button type="button" id="poDailyRevenueRefresh" class="po-dr-refresh">↻ Обновить ежедневный отчёт</button>`;
      const reportList = $('#reportList');
      if (reportList) history.insertBefore(panel, reportList);
      else history.appendChild(panel);

      const input = $('#poDailyRevenueDate');
      STATE.reportDate = localDateKey();
      if (input) {
        input.value = STATE.reportDate;
        input.addEventListener('change', () => {
          STATE.reportDate = input.value || localDateKey();
          renderDailyRevenue();
        });
      }
      $('#poDailyRevenueRefresh')?.addEventListener('click', () => loadData(true));
    }
  }

  function ensureStockPanel() {
    const inventory = $('#inventoryPanel');
    if (inventory && !$('#poStockReceiptsPanel')) {
      const panel = document.createElement('section');
      panel.id = 'poStockReceiptsPanel';
      panel.className = 'po-stock-receipts-panel';
      panel.innerHTML = `
        <div class="po-dr-head">
          <div><div class="eyebrow">СКЛАД · ИСТОРИЯ</div><h3>Поступления товаров</h3><p>Какой товар добавили, сколько штук, когда и кто оформил.</p></div>
          <label>Дата<input id="poStockReceiptsDate" type="date"></label>
        </div>
        <div id="poStockReceiptsContent"><div class="po-dr-loading">Загружаем поступления…</div></div>
        <button type="button" id="poStockReceiptsRefresh" class="po-dr-refresh">↻ Обновить поступления</button>`;
      const search = $('#inventorySearch');
      if (search) inventory.insertBefore(panel, search);
      else inventory.appendChild(panel);

      const input = $('#poStockReceiptsDate');
      STATE.receiptDate = localDateKey();
      if (input) {
        input.value = STATE.receiptDate;
        input.addEventListener('change', () => {
          STATE.receiptDate = input.value || localDateKey();
          renderStockReceipts();
        });
      }
      $('#poStockReceiptsRefresh')?.addEventListener('click', () => loadData(true));
    }
  }

  function addStyles() {
    if ($('#' + STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .po-daily-revenue-panel,.po-stock-receipts-panel{margin:14px 0 18px;padding:15px;border:1px solid #5e4829;border-radius:18px;background:linear-gradient(145deg,rgba(28,25,14,.96),rgba(6,18,13,.98));box-shadow:inset 0 1px 0 rgba(255,255,255,.04)}
      .po-dr-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:13px}
      .po-dr-head h3{margin:5px 0 4px;color:#f6dfae;font-size:clamp(20px,4.5vw,25px);line-height:1.15}
      .po-dr-head p{margin:0;color:#a9b1a8;font-size:11px;line-height:1.5;max-width:420px}
      .po-dr-head label{display:grid;gap:5px;color:#c9b994;font-size:9px;font-weight:800;letter-spacing:.06em;white-space:nowrap}
      .po-dr-head input{min-width:132px;max-width:150px;padding:9px 10px;border:1px solid #745c34;border-radius:10px;background:#100f0a;color:#f7e7bf;font:700 12px Arial,sans-serif;color-scheme:dark}
      .po-dr-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
      .po-dr-kpi{display:grid;gap:6px;align-content:start;padding:12px;border:1px solid #4c432d;border-radius:13px;background:rgba(5,12,9,.64);min-width:0}
      .po-dr-kpi small{color:#b8b49f;font-size:8px;font-weight:900;letter-spacing:.09em;line-height:1.4}
      .po-dr-kpi strong{color:#ffe3a7;font-size:clamp(16px,3.8vw,22px);line-height:1.1;overflow-wrap:anywhere}
      .po-dr-kpi span{color:#9da99f;font-size:9px;line-height:1.45}
      .po-dr-entry strong{color:#89e5ad}.po-dr-products strong{color:#9dc8ff}.po-dr-total strong{color:#ffe0a0}
      .po-dr-table-wrap{margin-top:12px;padding:11px;border:1px solid rgba(204,174,117,.22);border-radius:13px;background:rgba(2,8,6,.48)}
      .po-dr-table-title{margin-bottom:8px;color:#e7c987;font-size:9px;font-weight:900;letter-spacing:.1em}
      .po-dr-table-head,.po-dr-table-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center}
      .po-dr-table-head{padding:5px 0 8px;color:#7e9384;font-size:8px;font-weight:800}
      .po-dr-table-row{padding:9px 0;border-top:1px solid rgba(203,180,139,.13);font-size:10px}
      .po-dr-table-row strong{color:#eee1c4;font-weight:700;overflow-wrap:anywhere}
      .po-dr-table-row span{color:#b8c9bc;white-space:nowrap}
      .po-dr-table-row b{color:#f4d99c;white-space:nowrap;text-align:right}
      .po-dr-empty-row,.po-dr-empty,.po-dr-loading,.po-dr-error{padding:14px;border:1px dashed rgba(200,175,125,.22);border-radius:12px;color:#a6b0a7;font-size:10px;line-height:1.55}
      .po-dr-empty{display:grid;gap:5px}.po-dr-empty strong{color:#e6d2a8;font-size:11px}
      .po-dr-error{color:#f2aaa0;border-color:rgba(231,120,104,.3)}
      .po-dr-shifts{display:grid;gap:6px;margin-top:10px}
      .po-dr-shift-row{display:flex;justify-content:space-between;gap:10px;padding:8px 2px;border-bottom:1px solid rgba(203,180,139,.1);font-size:9px}
      .po-dr-shift-row span{color:#9da99f}.po-dr-shift-row b{color:#d7c49e;text-align:right}
      .po-dr-refresh{width:100%;margin-top:11px;padding:10px;border:1px solid #5f4c2d;border-radius:11px;background:rgba(74,52,20,.36);color:#f1d69b;font-size:10px;font-weight:900}
      .po-stock-summary{display:flex;justify-content:space-between;gap:10px;padding:9px 10px;border-radius:10px;background:rgba(15,40,27,.52);color:#b3c4b7;font-size:9px}
      .po-stock-summary b{color:#92e6ae}
      .po-stock-list{display:grid;gap:0;margin-top:8px}
      .po-stock-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 2px;border-bottom:1px solid rgba(203,180,139,.13)}
      .po-stock-main{display:grid;gap:4px;min-width:0}.po-stock-main strong{color:#f0e2c5;font-size:11px;overflow-wrap:anywhere}.po-stock-main small{color:#9eaa9e;font-size:9px}
      .po-stock-qty{flex:0 0 auto;color:#8be4a8;font-size:12px;white-space:nowrap}
      @media(max-width:560px){.po-dr-kpis{grid-template-columns:1fr 1fr}.po-dr-kpi:last-child{grid-column:1/-1}.po-dr-head{align-items:stretch;flex-direction:column}.po-dr-head label{display:flex;align-items:center;justify-content:space-between}.po-dr-head input{max-width:170px}.po-dr-shift-row{flex-direction:column;gap:3px}.po-dr-shift-row b{text-align:left}}
    `;
    document.head.appendChild(style);
  }

  function observeLogin() {
    const panel = $('#reportsPanel');
    if (!panel) return;
    const onVisible = () => {
      if (!panel.classList.contains('hidden')) loadData(true);
    };
    if (!panel.classList.contains('hidden')) onVisible();

    const observer = new MutationObserver(() => {
      if (!panel.classList.contains('hidden')) onVisible();
    });
    observer.observe(panel, { attributes: true, attributeFilter: ['class'] });
  }

  function boot() {
    addStyles();
    ensureDailyPanel();
    ensureStockPanel();
    observeLogin();
    if (window.__poDailyRevenueStockTimer) clearInterval(window.__poDailyRevenueStockTimer);
    window.__poDailyRevenueStockTimer = setInterval(() => {
      const panel = $('#reportsPanel');
      if (panel && !panel.classList.contains('hidden') && !document.hidden) loadData(false);
    }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
