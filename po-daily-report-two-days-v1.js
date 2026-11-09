/* PAR ORDO PRO — show previous and selected day reports side-by-side vertically.
   Read-only overlay: does not modify Worker, D1, shifts, stock, cash, or stored reports.
   Report date is derived from shiftStartAt in Asia/Bishkek, not closedAt/shiftDate.
*/
(() => {
  'use strict';
  const API_BASE = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const MODAL_ID = 'poInlineDailyReportModal';
  let modal = null;
  let loading = false;
  let lastRenderedKey = '';

  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
  const money = value => `${Number(value || 0).toLocaleString('ru-RU')} сом`;
  const num = value => Number(value || 0).toLocaleString('ru-RU');

  function dateKey(value = new Date()) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone:'Asia/Bishkek', year:'numeric', month:'2-digit', day:'2-digit'
    }).formatToParts(date);
    const part = type => parts.find(item => item.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
  }

  function previousDay(day) {
    const [year, month, dayOfMonth] = String(day).split('-').map(Number);
    const date = new Date(year, month - 1, dayOfMonth, 12, 0, 0);
    date.setDate(date.getDate() - 1);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }

  function dateLabel(day) {
    const [year, month, date] = String(day).split('-');
    return `${date}.${month}.${year}`;
  }

  function reportDay(report) {
    // A shift belongs to the day it opened. It may be closed after midnight.
    return dateKey(report?.shiftStartAt || report?.shiftDate || report?.closedAt);
  }

  function fmtDateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Время не указано' : date.toLocaleString('ru-RU', {
      timeZone:'Asia/Bishkek', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
    });
  }

  function fmtTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('ru-RU', {
      timeZone:'Asia/Bishkek', hour:'2-digit', minute:'2-digit'
    });
  }

  async function api(path) {
    const token = sessionStorage.getItem('parordo_admin_token') || '';
    if (!token) throw new Error('Сессия не найдена. Войдите в панель руководителя заново.');
    const response = await fetch(API_BASE + path, {
      method:'GET', cache:'no-store', headers:{Accept:'application/json', Authorization:`Bearer ${token}`}
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data?.error || `Ошибка API ${response.status}`);
    return data;
  }

  function isAdmission(item) {
    const name = String(item?.name || '').trim().toLocaleLowerCase('ru');
    return ['вход','вход детский','бонусный вход (5-й визит)','бонусный вход'].includes(name);
  }

  function emptyTotals() {
    return {entry:0,adult:0,adultQty:0,child:0,childQty:0,bonusQty:0,products:0,productQty:0,total:0,clients:0,shifts:0,items:new Map()};
  }

  function accumulate(totals, report) {
    totals.shifts++;
    const clients = Array.isArray(report?.clients) ? report.clients : [];
    totals.clients += Number(report?.clientCount || clients.length || 0);
    for (const client of clients) {
      for (const item of (Array.isArray(client?.items) ? client.items : [])) {
        const qty = Math.max(1, Math.floor(Number(item?.qty || 1)));
        const price = Math.max(0, Number(item?.price || 0));
        const amount = qty * price;
        const method = String(item?.method || '');
        if (amount > 0 && !['cash','transfer'].includes(method)) continue;
        const name = String(item?.name || 'Товар').trim() || 'Товар';
        const lower = name.toLocaleLowerCase('ru');
        if (isAdmission(item)) {
          totals.entry += amount;
          if (lower === 'вход') { totals.adult += amount; totals.adultQty += qty; }
          else if (lower === 'вход детский') { totals.child += amount; totals.childQty += qty; }
          else totals.bonusQty += qty;
        } else {
          totals.products += amount;
          totals.productQty += qty;
          const row = totals.items.get(lower) || {name,qty:0,total:0};
          row.qty += qty;
          row.total += amount;
          totals.items.set(lower,row);
        }
      }
    }
    totals.total = totals.entry + totals.products;
  }

  function renderSales(day, reports) {
    if (!reports.length) {
      return `<div class="poir-empty"><strong>Отчёт за ${dateLabel(day)} ещё не сформирован.</strong><span>Он появится здесь после закрытия смены и отправки отчёта руководителю.</span></div>`;
    }
    const totals = emptyTotals();
    reports.forEach(report => accumulate(totals, report));
    const rows = [...totals.items.values()].sort((a,b) => b.total-a.total || b.qty-a.qty);
    return `
      <div class="poir-kpis">
        <article class="poir-kpi"><small>ДОХОД ОТ ВХОДОВ</small><strong class="poir-green">${money(totals.entry)}</strong><span>Взрослые: ${num(totals.adultQty)} · ${money(totals.adult)}</span><span>Детские: ${num(totals.childQty)} · ${money(totals.child)}</span>${totals.bonusQty?`<span>Бонусные входы: ${num(totals.bonusQty)}</span>`:''}</article>
        <article class="poir-kpi"><small>ВЫРУЧКА ОТ ТОВАРОВ</small><strong class="poir-blue">${money(totals.products)}</strong><span>Продано: ${num(totals.productQty)} шт. · ${rows.length} наимен.</span></article>
        <article class="poir-kpi poir-full"><small>ВСЕГО ПОЛУЧЕНО</small><strong>${money(totals.total)}</strong><span>${num(totals.shifts)} закрытых смен · ${num(totals.clients)} клиентов</span></article>
      </div>
      <section class="poir-table"><h3>ТОВАРЫ ЗА ДЕНЬ</h3>
        ${rows.length ? `<div class="poir-table-head"><span>Название товара</span><span>Кол-во</span><span>Выручка</span></div>${rows.map(row=>`<div class="poir-table-row"><strong>${esc(row.name)}</strong><span>${num(row.qty)} шт.</span><b>${money(row.total)}</b></div>`).join('')}` : '<div class="poir-muted">Продаж товаров за эту дату нет.</div>'}
      </section>
      <div class="poir-shifts">${reports.map(report=>{const one=emptyTotals();accumulate(one,report);return `<div><span>Смена закрыта · ${esc(fmtDateTime(report.closedAt))}</span><b>Входы ${money(one.entry)} · Товары ${money(one.products)}</b></div>`;}).join('')}</div>`;
  }

  function renderReceipts(day, receipts) {
    const sorted = receipts.filter(event => dateKey(event.createdAt) === day)
      .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
    const qty = sorted.reduce((sum,event) => sum + Math.max(0,Number(event.details?.qty || 0)),0);
    if (!sorted.length) {
      return `<div class="poir-empty"><strong>Поступлений за ${dateLabel(day)} нет.</strong><span>Оформленные поступления товаров появятся здесь.</span></div>`;
    }
    return `
      <div class="poir-stock-summary"><span>Операций: <b>${num(sorted.length)}</b></span><span>Добавлено: <b>+${num(qty)} шт.</b></span></div>
      <div class="poir-stock-list">${sorted.map(event=>{
        const details = event.details || {};
        const name = details.productName || `Товар №${event.target || '—'}`;
        return `<article><div><strong>${esc(name)}</strong><small>${esc(fmtTime(event.createdAt))} · Добавил: ${esc(details.by || event.username || 'Не указано')}</small></div><b>+${num(details.qty || 0)} шт.</b></article>`;
      }).join('')}</div>`;
  }

  async function loadAndRender(force = false) {
    modal = modal || $('#'+MODAL_ID);
    if (!modal || !modal.classList.contains('is-open') || loading) return;
    const root = $('#poInlineReportBody', modal);
    const dateInput = $('#poInlineReportDate', modal);
    if (!root || !dateInput) return;
    const endDay = dateInput.value || dateKey();
    const startDay = previousDay(endDay);
    const renderKey = `${startDay}|${endDay}`;
    if (!force && lastRenderedKey === renderKey && root.dataset.twoDayReady === '1') return;

    loading = true;
    root.innerHTML = '<div class="poir-loading">Загружаем отчёты за два дня…</div>';
    try {
      const results = await Promise.all([api('/api/admin/control/reports'),api('/api/admin/audit?limit=200')]);
      const reports = Array.isArray(results[0]?.reports) ? results[0].reports : [];
      const receipts = Array.isArray(results[1]?.events) ? results[1].events.filter(event => event.action === 'stock_receipt') : [];
      if (!modal.isConnected || !modal.classList.contains('is-open')) return;

      const days = [startDay,endDay];
      const blocks = days.map(day => {
        const dayReports = reports.filter(report => reportDay(report) === day)
          .sort((a,b) => new Date(a.closedAt)-new Date(b.closedAt));
        return `
          <section class="poir-section poir-two-day-card">
            <div class="poir-two-day-heading">
              <div><span>ФИНАНСОВЫЙ ОТЧЁТ</span><h2>${dateLabel(day)} · Отчёт</h2></div>
              <b>${dayReports.length ? `${num(dayReports.length)} смен` : 'ОЖИДАЕТСЯ'}</b>
            </div>
            <div class="poir-section-title"><span>ФИНАНСЫ · ЗА ДЕНЬ</span><h2>Доходы и продажи</h2></div>
            ${renderSales(day,dayReports)}
            <div class="poir-section-title poir-two-day-stock-title"><span>СКЛАД · ИСТОРИЯ</span><h2>Поступления товаров</h2></div>
            ${renderReceipts(day,receipts)}
          </section>`;
      }).join('');
      root.innerHTML = `<div class="poir-two-day-hint">Показаны два отдельных отчёта: ${dateLabel(startDay)} и ${dateLabel(endDay)}. Дата смены определяется по времени её открытия.</div>${blocks}`;
      root.dataset.twoDayReady = '1';
      lastRenderedKey = renderKey;
    } catch (error) {
      if (modal?.isConnected && modal.classList.contains('is-open')) {
        root.innerHTML = `<div class="poir-error">Не удалось загрузить отчёты за два дня: ${esc(error.message)}</div>`;
      }
    } finally {
      loading = false;
    }
  }

  function addStyles() {
    if ($('#poTwoDayReportStyles')) return;
    const style = document.createElement('style');
    style.id = 'poTwoDayReportStyles';
    style.textContent = `
      #${MODAL_ID} .poir-two-day-hint{padding:10px 12px;border:1px solid rgba(205,170,102,.2);border-radius:11px;background:rgba(205,170,102,.06);color:#cdbb97;font-size:11px;line-height:1.45;font-weight:700;margin-bottom:2px}
      #${MODAL_ID} .poir-two-day-card{gap:12px}
      #${MODAL_ID} .poir-two-day-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 2px;padding:13px;border:1px solid rgba(231,190,107,.56);border-radius:15px;background:radial-gradient(100% 130% at 0% 0%,rgba(222,168,77,.2),transparent 65%),linear-gradient(120deg,#201709,#10150e);box-shadow:inset 0 1px 0 rgba(255,239,198,.1),0 7px 18px rgba(0,0,0,.18)}
      #${MODAL_ID} .poir-two-day-heading span{color:#e6c47e;font-size:9px;font-weight:950;letter-spacing:.14em}
      #${MODAL_ID} .poir-two-day-heading h2{margin:4px 0 0;color:#ffebc0;font:900 italic clamp(20px,5vw,26px)/1.12 Georgia,serif}
      #${MODAL_ID} .poir-two-day-heading>b{flex:0 0 auto;padding:7px 9px;border:1px solid rgba(223,185,113,.3);border-radius:9px;background:#120f09;color:#dfc48e;font-size:9px;letter-spacing:.06em;white-space:nowrap}
      #${MODAL_ID} .poir-two-day-stock-title{margin-top:14px}
    `;
    document.head.appendChild(style);
  }

  function attachToModal(found) {
    if (!found || modal === found) return;
    modal = found;
    addStyles();
    const dateInput = $('#poInlineReportDate',modal);
    const refresh = $('#poirRefresh',modal);
    dateInput?.addEventListener('change',() => {
      lastRenderedKey = '';
      window.setTimeout(() => loadAndRender(true),80);
    });
    refresh?.addEventListener('click',() => {
      lastRenderedKey = '';
      window.setTimeout(() => loadAndRender(true),300);
    });
    const classObserver = new MutationObserver(() => {
      if (modal?.classList.contains('is-open')) {
        lastRenderedKey = '';
        loadAndRender(true);
      }
    });
    classObserver.observe(modal,{attributes:true,attributeFilter:['class']});
    if (modal.classList.contains('is-open')) loadAndRender(true);
  }

  function init() {
    addStyles();
    attachToModal($('#'+MODAL_ID));
    const observer = new MutationObserver(() => {
      if (!modal || !modal.isConnected) attachToModal($('#'+MODAL_ID));
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    // The original report module may create/open the modal just before this file loads.
    if ($('#'+MODAL_ID)?.classList.contains('is-open')) loadAndRender(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
