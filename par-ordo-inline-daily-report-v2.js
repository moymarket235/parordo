/* PAR ORDO — INLINE DAILY REPORT V2
   Opens the daily revenue and stock receipts report inside the main manager page.
   Read-only: uses existing reports and audit API endpoints; no cash, shift, or stock mutations.
*/
(() => {
  'use strict';
  const API_BASE = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const BTN_ID = 'openDailyManagerReport';
  const MODAL_ID = 'poInlineDailyReportModal';
  const state = { reports: [], receipts: [], date: '', loading: false, loadedAt: 0 };
  const $ = (s, r = document) => r.querySelector(s);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = v => `${Number(v || 0).toLocaleString('ru-RU')} сом`;
  const num = v => Number(v || 0).toLocaleString('ru-RU');

  function dateKey(value = new Date()) {
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function fmtDateTime(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? 'Время не указано' : d.toLocaleString('ru-RU', {
      day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
    });
  }
  function fmtTime(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('ru-RU', {hour:'2-digit',minute:'2-digit'});
  }
  async function api(path) {
    const token = sessionStorage.getItem('parordo_admin_token') || '';
    if (!token) throw new Error('Сессия не найдена. Войдите в панель руководителя заново.');
    const res = await fetch(API_BASE + path, {
      method:'GET', cache:'no-store', headers:{Accept:'application/json', Authorization:`Bearer ${token}`}
    });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data?.error || `Ошибка API ${res.status}`);
    return data;
  }
  const isAdmission = item => {
    const n = String(item?.name || '').trim().toLocaleLowerCase('ru');
    return ['вход','вход детский','бонусный вход (5-й визит)','бонусный вход'].includes(n);
  };
  function emptyTotals() {
    return {entry:0,adult:0,adultQty:0,child:0,childQty:0,bonusQty:0,products:0,productQty:0,total:0,clients:0,shifts:0,items:new Map()};
  }
  function accumulate(target, report) {
    target.shifts++;
    const clients = Array.isArray(report?.clients) ? report.clients : [];
    target.clients += Number(report?.clientCount || clients.length || 0);
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
          target.entry += amount;
          if (lower === 'вход') { target.adult += amount; target.adultQty += qty; }
          else if (lower === 'вход детский') { target.child += amount; target.childQty += qty; }
          else target.bonusQty += qty;
        } else {
          target.products += amount;
          target.productQty += qty;
          const key = lower;
          const row = target.items.get(key) || {name,qty:0,total:0};
          row.qty += qty; row.total += amount; target.items.set(key,row);
        }
      }
    }
    target.total = target.entry + target.products;
  }
  function dailyReports() {
    const day = state.date || dateKey();
    return state.reports.filter(r => String(r?.shiftDate || '') === day);
  }
  function dailyTotals() {
    const totals = emptyTotals();
    dailyReports().forEach(r => accumulate(totals,r));
    return totals;
  }
  function renderReport() {
    const root = $('#poInlineReportBody');
    const date = $('#poInlineReportDate');
    if (!root) return;
    const day = state.date || dateKey();
    if (date && date.value !== day) date.value = day;
    const reports = dailyReports();
    const receipts = state.receipts.filter(e => dateKey(e.createdAt) === day)
      .sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
    const totalReceiptQty = receipts.reduce((sum,e) => sum + Math.max(0,Number(e.details?.qty || 0)),0);
    let salesHtml = '';
    if (!reports.length) {
      salesHtml = `<div class="poir-empty"><strong>За выбранную дату закрытых смен нет.</strong><span>После завершения смены и отправки отчёта здесь появятся доходы от входов и продажи товаров.</span></div>`;
    } else {
      const t = dailyTotals();
      const rows = [...t.items.values()].sort((a,b)=>b.total-a.total || b.qty-a.qty);
      salesHtml = `
        <div class="poir-kpis">
          <article class="poir-kpi"><small>ДОХОД ОТ ВХОДОВ</small><strong class="poir-green">${money(t.entry)}</strong><span>Взрослые: ${num(t.adultQty)} · ${money(t.adult)}</span><span>Детские: ${num(t.childQty)} · ${money(t.child)}</span>${t.bonusQty?`<span>Бонусные входы: ${num(t.bonusQty)}</span>`:''}</article>
          <article class="poir-kpi"><small>ВЫРУЧКА ОТ ТОВАРОВ</small><strong class="poir-blue">${money(t.products)}</strong><span>Продано: ${num(t.productQty)} шт. · ${rows.length} наимен.</span></article>
          <article class="poir-kpi poir-full"><small>ВСЕГО ПОЛУЧЕНО</small><strong>${money(t.total)}</strong><span>${num(t.shifts)} закрытых смен · ${num(t.clients)} клиентов</span></article>
        </div>
        <section class="poir-table"><h3>ТОВАРЫ ЗА ДЕНЬ</h3>
          ${rows.length ? `<div class="poir-table-head"><span>Название товара</span><span>Кол-во</span><span>Выручка</span></div>${rows.map(r=>`<div class="poir-table-row"><strong>${esc(r.name)}</strong><span>${num(r.qty)} шт.</span><b>${money(r.total)}</b></div>`).join('')}` : '<div class="poir-muted">Продаж товаров за эту дату нет.</div>'}
        </section>
        <div class="poir-shifts">${reports.map(r=>{const one=emptyTotals();accumulate(one,r);return `<div><span>Смена · ${esc(fmtDateTime(r.closedAt))}</span><b>Входы ${money(one.entry)} · Товары ${money(one.products)}</b></div>`;}).join('')}</div>`;
    }
    const stockHtml = receipts.length ? `
      <div class="poir-stock-summary"><span>Операций: <b>${num(receipts.length)}</b></span><span>Добавлено: <b>+${num(totalReceiptQty)} шт.</b></span></div>
      <div class="poir-stock-list">${receipts.map(e=>{
        const d=e.details||{}; const name=d.productName||`Товар №${e.target||'—'}`;
        return `<article><div><strong>${esc(name)}</strong><small>${esc(fmtTime(e.createdAt))} · Добавил: ${esc(d.by||e.username||'Не указано')}</small></div><b>+${num(d.qty||0)} шт.</b></article>`;
      }).join('')}</div>` : `<div class="poir-empty"><strong>Поступлений за выбранную дату нет.</strong><span>Оформленные поступления товаров появятся здесь.</span></div>`;
    root.innerHTML = `
      <section class="poir-section"><div class="poir-section-title"><span>ФИНАНСЫ · ЗА ДЕНЬ</span><h2>Доходы и продажи</h2></div>${salesHtml}</section>
      <section class="poir-section"><div class="poir-section-title"><span>СКЛАД · ИСТОРИЯ</span><h2>Поступления товаров</h2></div>${stockHtml}</section>`;
  }
  function renderError(message) {
    const root = $('#poInlineReportBody');
    if (root) root.innerHTML = `<div class="poir-error">${esc(message)}</div>`;
  }
  async function loadData(force = false) {
    if (state.loading) return;
    if (!force && state.loadedAt && Date.now() - state.loadedAt < 30000) {
      renderReport();
      return;
    }
    state.loading = true;
    const root = $('#poInlineReportBody');
    if (root) root.innerHTML = '<div class="poir-loading">Загружаем ежедневный отчёт…</div>';
    const results = await Promise.allSettled([
      api('/api/admin/control/reports'),
      api('/api/admin/audit?limit=200')
    ]);
    const errors = [];
    if (results[0].status === 'fulfilled') state.reports = Array.isArray(results[0].value?.reports) ? results[0].value.reports : [];
    else errors.push('Отчёты смен: ' + (results[0].reason?.message || 'ошибка API'));
    if (results[1].status === 'fulfilled') state.receipts = Array.isArray(results[1].value?.events) ? results[1].value.events.filter(e=>e.action==='stock_receipt') : [];
    else errors.push('Поступления: ' + (results[1].reason?.message || 'ошибка API'));
    state.loadedAt = Date.now();
    state.loading = false;
    if (errors.length === 2) renderError(errors.join('. '));
    else {
      renderReport();
      if (errors.length) {
        const root = $('#poInlineReportBody');
        root?.insertAdjacentHTML('afterbegin', `<div class="poir-warning">${esc(errors.join('. '))}</div>`);
      }
    }
  }
  function addStyles() {
    if ($('#poInlineReportStyles')) return;
    const style = document.createElement('style');
    style.id='poInlineReportStyles';
    style.textContent = `

      /* CEO-style full-width daily report shortcut */
      #openDailyManagerReport{
        grid-column:1/-1!important;width:100%;min-height:116px!important;
        display:grid!important;grid-template-columns:58px minmax(0,1fr) 28px!important;
        align-items:center!important;gap:14px!important;padding:16px 18px!important;
        text-align:left!important;position:relative;overflow:hidden;
        border:1px solid #bd9146!important;border-radius:22px!important;
        background:
          radial-gradient(ellipse at 12% 0%,rgba(246,189,71,.22),transparent 55%),
          linear-gradient(115deg,#241707 0%,#171008 48%,#0b1710 100%)!important;
        box-shadow:0 12px 30px rgba(0,0,0,.3),inset 0 1px 0 rgba(255,232,174,.12),0 0 22px rgba(246,189,71,.08)!important;
        transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease!important;
      }
      #openDailyManagerReport:active{transform:scale(.99)!important;border-color:#ffda82!important}
      #openDailyManagerReport::after{
        content:"↗";grid-column:3;grid-row:1;align-self:center;justify-self:end;
        width:34px;height:34px;display:grid;place-items:center;border-radius:50%;
        border:1px solid #9e783b;background:rgba(8,8,5,.45);color:#ffdb83;
        font-size:22px;font-weight:900;font-style:italic;
      }
      #openDailyManagerReport .manager-action-icon{
        width:58px!important;height:58px!important;flex-basis:58px!important;
        border-radius:17px!important;border:1px solid #b78a3d!important;
        background:linear-gradient(145deg,#34220b,#120e08)!important;
        color:#ffdc8d!important;box-shadow:0 0 20px rgba(246,189,71,.12),inset 0 1px 0 #ffffff12!important;
      }
      #openDailyManagerReport .manager-action-icon svg{width:28px!important;height:28px!important}
      #openDailyManagerReport .manager-action-copy{grid-column:2;grid-row:1;min-width:0}
      #openDailyManagerReport .manager-action-copy strong{
        display:block;font-size:clamp(17px,4.4vw,21px)!important;line-height:1.18!important;
        font-weight:950!important;font-style:italic!important;letter-spacing:-.025em!important;
        color:#ffe5aa!important;text-shadow:0 2px 12px rgba(255,190,73,.15);
      }
      #openDailyManagerReport .manager-action-copy small{
        display:block;margin-top:7px;font-size:clamp(10px,2.7vw,12px)!important;
        line-height:1.45!important;font-weight:750!important;font-style:italic!important;
        color:#d7c5a2!important;max-width:520px;
      }
      @media(min-width:760px){
        #openDailyManagerReport{min-height:126px!important;padding:20px 23px!important;grid-template-columns:66px minmax(0,1fr) 34px!important}
        #openDailyManagerReport .manager-action-icon{width:66px!important;height:66px!important}
      }
      @media(max-width:390px){
        #openDailyManagerReport{min-height:110px!important;grid-template-columns:48px minmax(0,1fr) 24px!important;gap:10px!important;padding:13px!important}
        #openDailyManagerReport .manager-action-icon{width:48px!important;height:48px!important;flex-basis:48px!important}
        #openDailyManagerReport .manager-action-icon svg{width:24px!important;height:24px!important}
      }
      #${MODAL_ID}{position:fixed;inset:0;z-index:9999;display:none;align-items:flex-start;justify-content:center;overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:max(10px,env(safe-area-inset-top)) 10px calc(14px + env(safe-area-inset-bottom));background:rgba(0,0,0,.88);}
      #${MODAL_ID}.is-open{display:flex}
      #${MODAL_ID} .poir-dialog{width:min(100%,850px);margin:auto 0;border:1px solid #8b672f;border-radius:22px;background:linear-gradient(150deg,#1b1209,#07100b);box-shadow:0 24px 80px #000c;color:#f8edda;overflow:hidden}
      #${MODAL_ID} .poir-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px;background:linear-gradient(145deg,#211608,#100d08);border-bottom:1px solid #654820}
      #${MODAL_ID} .poir-brand{color:#edce8b;font-size:10px;font-weight:950;font-style:italic;letter-spacing:.17em}#${MODAL_ID} .poir-head h1{margin:4px 0 0;font:900 italic clamp(23px,5.4vw,32px)/1.08 Georgia,serif;letter-spacing:-.035em;text-shadow:0 2px 16px rgba(255,190,73,.16)}
      #${MODAL_ID} .poir-close{width:42px;height:42px;flex:0 0 42px;border:1px solid #80602e;border-radius:12px;background:#170f07;color:#ffe8b7;font-size:25px}
      #${MODAL_ID} .poir-controls{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 15px;border-bottom:1px solid rgba(199,164,98,.17)}
      #${MODAL_ID} .poir-controls label{display:flex;align-items:center;gap:9px;color:#d2bf99;font-size:12px;font-weight:900;font-style:italic}#${MODAL_ID} .poir-controls input{width:150px;max-width:45vw;padding:9px 10px;border:1px solid #70572f;border-radius:10px;background:#0e100b;color:#fff0cb;color-scheme:dark;font:700 13px Arial}
      #${MODAL_ID} .poir-refresh{padding:10px 13px;border:1px solid #85632e;border-radius:10px;background:#2a1c0c;color:#f7dfa8;font-size:10px;font-weight:900}
      #${MODAL_ID} .poir-body{padding:13px;display:grid;gap:13px}#${MODAL_ID} .poir-section{padding:13px;border:1px solid rgba(197,164,101,.28);border-radius:16px;background:rgba(9,17,12,.62)}
      #${MODAL_ID} .poir-section-title span{color:#e5c27c;font-size:9px;font-weight:950;letter-spacing:.15em}#${MODAL_ID} .poir-section-title h2{margin:3px 0 12px;font:900 italic 25px/1.08 Georgia,serif;color:#ffe4a8;letter-spacing:-.025em;text-shadow:0 2px 13px rgba(255,190,73,.12)}
      #${MODAL_ID} .poir-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}#${MODAL_ID} .poir-kpi{display:grid;gap:6px;align-content:start;min-width:0;padding:12px;border:1px solid #4d412b;border-radius:13px;background:#0b100b}
      #${MODAL_ID} .poir-kpi small{color:#bcb49e;font-size:9px;font-weight:900;letter-spacing:.08em}#${MODAL_ID} .poir-kpi strong{font-size:clamp(19px,4.8vw,25px);line-height:1.1;font-weight:950;font-style:italic;color:#ffdf9b;letter-spacing:-.03em;overflow-wrap:anywhere}#${MODAL_ID} .poir-kpi .poir-green{color:#88e9ad}#${MODAL_ID} .poir-kpi .poir-blue{color:#a0caff}#${MODAL_ID} .poir-kpi span{font-size:11px;line-height:1.45;font-weight:700;font-style:italic;color:#c1cbbf}#${MODAL_ID} .poir-full{grid-column:1/-1}
      #${MODAL_ID} .poir-table{margin-top:10px;padding:11px;border:1px solid #403b29;border-radius:12px;background:#090e0a}#${MODAL_ID} .poir-table h3{margin:0 0 7px;color:#e4c47f;font-size:10px;letter-spacing:.12em}#${MODAL_ID} .poir-table-head,#${MODAL_ID} .poir-table-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:9px;align-items:center}#${MODAL_ID} .poir-table-head{padding:6px 0;color:#899c8e;font-size:9px;font-weight:800}#${MODAL_ID} .poir-table-row{padding:10px 0;border-top:1px solid #273028;font-size:11px;font-weight:950;font-style:italic;letter-spacing:.08em}#${MODAL_ID} .poir-table-row strong{overflow-wrap:anywhere;color:#fff0d2;font-weight:850;font-style:italic}#${MODAL_ID} .poir-table-row span{white-space:nowrap;color:#b9c8bd}#${MODAL_ID} .poir-table-row b{white-space:nowrap;color:#f3d79a;text-align:right}
      #${MODAL_ID} .poir-shifts{display:grid;gap:7px;margin-top:9px}#${MODAL_ID} .poir-shifts>div{display:flex;justify-content:space-between;gap:8px;padding:8px 2px;border-bottom:1px solid #293027;font-size:10px}#${MODAL_ID} .poir-shifts span{color:#aab6aa}#${MODAL_ID} .poir-shifts b{text-align:right;color:#e7d3aa}
      #${MODAL_ID} .poir-empty,#${MODAL_ID} .poir-loading,#${MODAL_ID} .poir-error,#${MODAL_ID} .poir-warning{padding:14px;border:1px dashed #51452f;border-radius:12px;color:#adb8aa;font-size:11px;line-height:1.5}#${MODAL_ID} .poir-empty{display:grid;gap:5px}#${MODAL_ID} .poir-empty strong{color:#f0dbb0}#${MODAL_ID} .poir-error{color:#ffc0b7;border-color:#86504a}#${MODAL_ID} .poir-warning{color:#f4d799;border-color:#80602e}
      #${MODAL_ID} .poir-stock-summary{display:flex;justify-content:space-between;gap:8px;padding:10px;border-radius:10px;background:#10251a;color:#c4d3c5;font-size:10px}#${MODAL_ID} .poir-stock-summary b{color:#92e8ac}#${MODAL_ID} .poir-stock-list{display:grid}#${MODAL_ID} .poir-stock-list article{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 2px;border-bottom:1px solid #283229}#${MODAL_ID} .poir-stock-list article>div{display:grid;gap:4px;min-width:0}#${MODAL_ID} .poir-stock-list strong{font-size:13px;font-weight:900;font-style:italic;overflow-wrap:anywhere;color:#fff0d2}#${MODAL_ID} .poir-stock-list small{font-size:9px;color:#9cab9e}#${MODAL_ID} .poir-stock-list article>b{color:#92e8ac;font-size:13px;font-weight:950;font-style:italic;white-space:nowrap;text-shadow:0 0 12px rgba(80,235,146,.12)}
      @media(max-width:520px){#${MODAL_ID} .poir-head{padding:12px}#${MODAL_ID} .poir-controls{align-items:stretch;flex-direction:column}#${MODAL_ID} .poir-controls label{justify-content:space-between}#${MODAL_ID} .poir-controls input{max-width:58vw}#${MODAL_ID} .poir-refresh{width:100%}#${MODAL_ID} .poir-shifts{font-size:9px}#${MODAL_ID} .poir-shifts>div{flex-direction:column}#${MODAL_ID} .poir-shifts b{text-align:left}}
    `;
    document.head.appendChild(style);
  }
  function ensureModal() {
    if ($('#'+MODAL_ID)) return;
    const el=document.createElement('div'); el.id=MODAL_ID; el.setAttribute('aria-hidden','true');
    el.innerHTML=`<div class="poir-dialog" role="dialog" aria-modal="true" aria-labelledby="poirTitle">
      <header class="poir-head"><div><div class="poir-brand">ПАР ОРДО · ФИНАНСОВЫЙ КОНТРОЛЬ</div><h1 id="poirTitle">Ежедневный отчёт</h1></div><button type="button" class="poir-close" id="poirClose" aria-label="Закрыть">×</button></header>
      <div class="poir-controls"><label for="poInlineReportDate">Дата <input id="poInlineReportDate" type="date"></label><button type="button" class="poir-refresh" id="poirRefresh">↻ Обновить отчёт</button></div>
      <div class="poir-body" id="poInlineReportBody"><div class="poir-loading">Загружаем ежедневный отчёт…</div></div>
    </div>`;
    document.body.appendChild(el);
    $('#poirClose',el).addEventListener('click',closeModal);
    el.addEventListener('click',e=>{if(e.target===el)closeModal();});
    $('#poirRefresh',el).addEventListener('click',loadData);
    $('#poInlineReportDate',el).addEventListener('change',e=>{state.date=e.target.value||dateKey();renderReport();});
  }
  function openModal() {
    // Modal markup and styles are prepared during boot, so tapping opens instantly.
    ensureModal(); addStyles();
    state.date=state.date||dateKey();
    const el=$('#'+MODAL_ID);
    el.classList.add('is-open'); el.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    $('#poInlineReportDate').value=state.date;
    if (state.loadedAt) renderReport();
    if ((!state.loadedAt || Date.now() - state.loadedAt >= 30000) && !state.loading) loadData(true);
  }
  function closeModal() {
    const el=$('#'+MODAL_ID); if(!el)return;
    el.classList.remove('is-open');el.setAttribute('aria-hidden','true');document.body.style.overflow='';
  }
  function boot() {
    const button=$('#'+BTN_ID); if(!button)return;
    // Warm the UI before any tap: avoid creating a large modal and injecting styles
    // at interaction time, which caused a visible pause on mobile devices.
    addStyles();
    ensureModal();
    button.removeAttribute('onclick');
    button.addEventListener('click',e=>{e.preventDefault();openModal();});
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#'+MODAL_ID)?.classList.contains('is-open'))closeModal();});
    // Start a quiet data prefetch in the background when an authenticated session exists.
    if (sessionStorage.getItem('parordo_admin_token')) loadData(true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
