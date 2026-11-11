/* PAR ORDO PRO — BRIEFING V1 · панель руководителя «Брифинг»
   The manager panel (#managerView) becomes a briefing: masthead, the month's main number,
   four live headlines, figures, the index of sections, top sellers and the month's statement.

   Data: the app's own loadManagerDashboard() is wrapped. While it starts, its four api() calls
   (customer-base, expenses, analytics, profit) are observed, so this file makes no extra
   requests. Live lines (guests, shift, low stock) are read from the app's state.
   Actions reuse the app's handlers: [data-manager-open], #openDailyManagerReport, #poCeoLaunch,
   #managerExitToControl; the real #profitMonth input is moved into the statement.

   Opening (first visit in a session, or right after the manager login): letterbox, teletype,
   the month's number rolls in like an odometer, lands with a flash and flies into the lead
   card while the page builds. A tap, Esc or Enter skips it. Later visits: a short entrance.
   prefers-reduced-motion: the new design without motion. */
(() => {
  'use strict';
  if (window.PARORDOBriefing) return;

  const VERSION = '1.0.0';
  const root = document.documentElement;
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const motion = !reduced && typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const EASE = {
    out: 'cubic-bezier(.16,1,.3,1)',
    io: 'cubic-bezier(.65,0,.35,1)',
    in: 'cubic-bezier(.5,0,.75,0)',
    roll: 'cubic-bezier(.12,.62,.2,1)',
    curtain: 'cubic-bezier(.76,0,.24,1)',
    slam: 'cubic-bezier(.2,.9,.3,1)'
  };
  const SEEN_KEY = 'po_bf_seen';
  const PORTAL_KEY = 'parordo_manager_portal_active';
  const BRACELETS = 36;
  const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const MONTHS_G = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const FACES = ['400 16px "PO Inter"', '600 16px "PO Inter"', '700 16px "PO Inter"', '700 16px "PO Inter Display"', '700 16px "PO Serif"', '400 16px "PO Mono"', '700 16px "PO Mono"'];
  const ICON = {
    back: '<path d="M15 6l-6 6 6 6"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4.5V9h-4.5"/>',
    arrow: '<path d="M9 6l6 6-6 6"/>',
    cal: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    box: '<path d="m12 3 8 4.2v9.6L12 21l-8-4.2V7.2L12 3z"/><path d="m4.4 7.3 7.6 4 7.6-4M12 11.5V21"/>'
  };
  const ROWS = [
    { n: '01', key: 'customers', go: 'customers', t: 'База клиентов', s: 'Поиск, история посещений и бонусы', cls: 'g' },
    { n: '02', key: 'stats', go: 'productStats', t: 'Статистика товаров', s: 'Рейтинг продаж: 1, 2, 3…', cls: '' },
    { n: '03', key: 'expenses', go: 'expensesView', t: 'Расходы бани', s: 'Затраты за день и месяц', cls: 'r' },
    { n: '04', key: 'cash', go: 'reportView', t: 'Касса и отчёты', s: 'Итоги смены и оплата', cls: 'g' },
    { n: '05', key: 'stock', go: 'productsView', t: 'Товары и склад', s: 'Наличие и поступления', cls: 'a' },
    { n: '06', key: 'history', go: 'historyView', t: 'История клиентов', s: 'Завершённые посещения', cls: 'm' },
    { n: '07', key: 'daily', proxy: 'openDailyManagerReport', t: 'Ежедневный отчёт', s: 'Доход от входов, продажи и поступления товаров', cls: 'feat' },
    { n: '08', key: 'ceo', proxy: 'poCeoLaunch', t: 'CEO MODE · OWNER APP', s: 'Digital Twin, прогноз дохода и панель владельца', cls: 'ceo g' }
  ];

  const svg = (body, cls) => `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  const esc = v => (typeof escapeHtml === 'function'
    ? escapeHtml(v)
    : String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  /* one group separator everywhere, so the odometer and the lead number line up exactly */
  const num = v => Math.round(Number(v) || 0).toLocaleString('ru-RU').replace(/[\s  ]/g, ' ');
  const pad = n => String(n).padStart(2, '0');
  const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const timeOf = t => { const d = new Date(t); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const viewActive = () => !!$('#managerView.active');
  const onScreen = (el, edge = 0) => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight - edge && r.bottom > 0; };
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} }
  };
  const userName = () => (store.get('parordo_admin_user') || 'admin').toUpperCase();
  const buzz = ms => { try { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; if (navigator.vibrate) navigator.vibrate(ms); } catch (_) {} };
  const toTop = () => { if ((window.scrollY || 0) <= 0) return; try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (_) { window.scrollTo(0, 0); } };

  /* ---------- motion helpers ---------- */
  const groups = new Map();
  function A(el, keyframes, options, group = 'page') {
    if (!motion || !el || typeof el.animate !== 'function') return null;
    try {
      const a = el.animate(keyframes, Object.assign({ fill: 'backwards' }, options));
      if (!groups.has(group)) groups.set(group, new Set());
      const set = groups.get(group);
      set.add(a);
      const drop = () => set.delete(a);
      a.finished.then(drop, drop);
      return a;
    } catch (_) { return null; }
  }
  function stop(group) {
    const set = groups.get(group);
    if (!set) return;
    set.forEach(a => { try { a.cancel(); } catch (_) {} });
    set.clear();
  }
  function countTo(el, from, to, ms, delay = 0) {
    if (!el) return;
    const token = (el._bfCount = (el._bfCount || 0) + 1);
    if (!motion || from === to) { el.textContent = num(to); return; }
    const t0 = performance.now() + delay;
    el.textContent = num(from);
    const step = now => {
      if (!el.isConnected || el._bfCount !== token) return;
      if (now < t0) { requestAnimationFrame(step); return; }
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = num(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- fonts: fetched when the manager panel is near, never for staff ---------- */
  let fontsP = null;
  function loadFonts() {
    if (fontsP) return fontsP;
    try {
      fontsP = document.fonts && typeof document.fonts.load === 'function'
        ? Promise.all(FACES.map(f => document.fonts.load(f, 'БРИФИНГ Ң Ү Ө 0123456789'))).then(() => true, () => false)
        : Promise.resolve(false);
    } catch (_) { fontsP = Promise.resolve(false); }
    return fontsP;
  }

  /* =====================================================================
     data: observed from the app's loadManagerDashboard()
     ===================================================================== */
  const data = { cust: null, exp: null, ana: null, prof: null, month: '', at: 0 };
  let loadGen = 0;
  let loading = false;
  const waiters = new Set();

  function dataReady(timeout) {
    if (!loading && data.at) return Promise.resolve(true);
    return new Promise(res => {
      const w = ok => { clearTimeout(t); waiters.delete(w); res(ok); };
      const t = setTimeout(() => w(false), timeout);
      waiters.add(w);
    });
  }
  function monthValue() {
    const i = $('#profitMonth');
    const v = i && i.value;
    if (/^\d{4}-\d{2}$/.test(v || '')) return v;
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }
  function monthInfo(ym) {
    const m = /^(\d{4})-(\d{2})$/.exec(ym || '');
    const d = new Date();
    const y = m ? +m[1] : d.getFullYear(), i = m ? +m[2] - 1 : d.getMonth();
    const name = MONTHS[i] || MONTHS[d.getMonth()];
    return { name, title: name.charAt(0).toUpperCase() + name.slice(1) + ' ' + y, current: y === d.getFullYear() && i === d.getMonth() };
  }
  function onLoadStart() {
    loading = true;
    const r = $('#poBrief .bf-refresh');
    if (r) r.classList.add('is-busy');
    const b = $('#poBrief');
    if (b) renderMast(b);
  }
  function onData(gen, got) {
    if (gen !== loadGen) return;
    loading = false;
    const ok = v => (v && !v.__error ? v : null);
    data.cust = ok(got['customer-base']);
    data.exp = ok(got.expenses);
    data.ana = ok(got.analytics);
    data.prof = ok(got.profit);
    data.month = monthValue();
    data.at = Date.now();
    const r = $('#poBrief .bf-refresh');
    if (r) r.classList.remove('is-busy');
    try { render({ animate: !run && viewActive() }); } catch (e) { console.warn('PAR ORDO briefing', e); }
    waiters.forEach(w => w(true));
  }
  function wrapLoad() {
    const orig = window.loadManagerDashboard;
    if (typeof orig !== 'function') return false;
    if (orig.__bf) return true;
    const wrapped = function () {
      const realApi = window.api;
      const got = {};
      const gen = ++loadGen;
      if (typeof realApi === 'function') {
        /* the four requests are made synchronously before the first await, so the observer
           is only in place for this one call and the original api() is back right after */
        window.api = function (path, opts) {
          const p = realApi.apply(this, arguments);
          try {
            const m = /^\/api\/admin\/control\/(customer-base|expenses|analytics|profit)(?:[?/#]|$)/.exec(String(path || ''));
            const get = !opts || !opts.method || String(opts.method).toUpperCase() === 'GET';
            if (m && get && p && typeof p.then === 'function') p.then(v => { got[m[1]] = v; }, e => { got[m[1]] = { __error: e }; });
          } catch (_) {}
          return p;
        };
      }
      let out;
      try { out = orig.apply(this, arguments); }
      finally { if (typeof realApi === 'function' && window.api !== realApi) window.api = realApi; }
      onLoadStart();
      Promise.resolve(out).then(() => onData(gen, got), () => onData(gen, got));
      return out;
    };
    wrapped.__bf = true;
    window.loadManagerDashboard = wrapped;
    return true;
  }

  /* live lines from the app's own state (the same rules as the CEO screen) */
  function live() {
    const out = { loaded: false, open: false, active: 0, today: 0, stock: false, low: 0 };
    try { out.loaded = !!shiftState.loaded; out.open = !!shiftState.isOpen; } catch (_) {}
    try { if (typeof activeClients === 'function') out.active = activeClients().length; } catch (_) {}
    try { if (typeof allTodayClients === 'function') out.today = allTodayClients().length; } catch (_) {}
    try {
      const ps = typeof products === 'function' ? products() : db.products;
      out.stock = Array.isArray(ps) && ps.length > 0;
      if (out.stock) out.low = ps.filter(p => Number(p.available ?? (Number(p.stock || 0) - Number(p.reserved || 0))) <= 3).length;
    } catch (_) {}
    return out;
  }

  function model() {
    const s = (data.prof && data.prof.summary) || null;
    const cs = (data.cust && data.cust.summary) || null;
    const es = (data.exp && data.exp.summary) || null;
    const ps = data.ana && Array.isArray(data.ana.products) ? data.ana.products : null;
    const entries = s ? Number(s.entryRevenue) || 0 : null;
    const goods = s ? Number(s.productRevenue) || 0 : null;
    return {
      entries,
      goods,
      turnover: s ? entries + goods : null,
      spend: s ? Number(s.expenses) || 0 : (es ? Number(es.monthTotal) || 0 : null),
      clients: data.cust ? Number(cs && cs.customers != null ? cs.customers : (Array.isArray(data.cust.customers) ? data.cust.customers.length : 0)) || 0 : null,
      visits: data.cust ? Number(cs && cs.completedVisits) || 0 : null,
      spent: data.cust ? Number(cs && cs.customerRevenue) || 0 : null,
      monthSpend: es ? Number(es.monthTotal) || 0 : null,
      products: ps,
      top: ps && ps.length ? ps[0] : null,
      profit: s ? { cc: !!s.costComplete, net: Number(s.netProfit) || 0, missing: Number(s.missingCostQty) || 0 } : null
    };
  }

  /* =====================================================================
     the briefing page
     ===================================================================== */
  const prev = {};
  let holdUntil = 0;
  let headsWaiting = 0;
  let run = null;

  const setText = (b, key, text) => { const el = $(`[data-bf="${key}"]`, b); if (el && el.textContent !== text) el.textContent = text; };

  function build() {
    const v = $('#managerView');
    if (!v) return null;
    let b = $('#poBrief', v);
    if (b) return b;
    b = document.createElement('div');
    b.id = 'poBrief';
    b.innerHTML = `
      <header class="bf-mast">
        <div class="bf-kicker"><span>Пар Ордо · брифинг</span><span class="bf-date" data-bf="date"></span></div>
        <h1 class="bf-title">Руководитель панели</h1>
        <div class="bf-by"><span class="bf-shift wait" data-bf="shift"><i></i><span>Смена: загрузка…</span></span><span>Доступ: <b data-bf="user"></b></span><span data-bf="upd"></span></div>
        <div class="bf-rule"></div>
        <div class="bf-acts"><button type="button" class="bf-exit" data-bf-act="exit">${svg(ICON.back)}Вернуться в «Управление баней»</button><button type="button" class="bf-refresh" data-bf-act="refresh" aria-label="Обновить данные панели">${svg(ICON.refresh)}</button></div>
      </header>
      <section class="bf-lead" data-bf="lead" aria-label="Главная цифра месяца">
        <div class="bf-eyebrow" data-bf="leadEyebrow"></div>
        <div class="bf-num"><b class="tn" data-bf="turn">…</b><span>сом</span></div>
        <p class="bf-deck" data-bf="deck"></p>
        <div class="bf-split" aria-hidden="true"><i class="g" data-bf="sg"></i><i class="b" data-bf="sb"></i></div>
        <div class="bf-foot" data-bf="foot"></div>
      </section>
      <section class="bf-block bf-b-heads" aria-label="Главное сейчас"><div class="bf-sec"><h2>Главное сейчас</h2><i></i><em>4 новости</em></div><div class="bf-heads" data-bf="heads"></div></section>
      <section class="bf-block bf-b-figs" aria-label="В цифрах"><div class="bf-sec"><h2>В цифрах</h2><i></i><em>база · месяц</em></div><div class="bf-figs" data-bf="figs"></div></section>
      <section class="bf-block bf-b-idx" aria-label="Разделы"><div class="bf-sec"><h2>Разделы</h2><i></i><em>быстрый доступ</em></div><nav class="bf-idx" data-bf="idx" aria-label="Разделы панели"></nav></section>
      <section class="bf-block bf-b-top" aria-label="Топ продаж"><div class="bf-sec"><h2>Топ продаж</h2><i></i><em>по количеству</em></div><div data-bf="top"></div></section>
      <section class="bf-block bf-b-bill" aria-label="Счёт за месяц"><div class="bf-sec"><h2>Счёт за месяц</h2><i></i><em>прибыль</em></div>
        <div class="bf-bill">
          <div class="bf-bill-h"><div><b data-bf="billMonth"></b><small>Пар Ордо · расчёт прибыли</small></div><label class="bf-mchip" data-bf="mchip">${svg(ICON.cal)}<span data-bf="mchipText">Месяц</span></label></div>
          <div data-bf="billBody"></div>
        </div>
      </section>`;
    v.insertBefore(b, v.firstChild);
    $('[data-bf="idx"]', b).innerHTML = ROWS.map(r => `<button type="button" class="bf-row ${r.cls}" ${r.go ? `data-manager-open="${r.go}"` : `data-bf-proxy="${r.proxy}"`} data-bf-row="${r.key}"><span class="n">${r.n}</span><span style="min-width:0"><b>${esc(r.t)}</b><small>${esc(r.s)}</small></span><span class="v" data-bf-v="${r.key}"></span>${svg(ICON.arrow, 'ar')}</button>`).join('');
    $('[data-bf="figs"]', b).innerHTML = [
      ['clients', 'gold', 'клиентов в базе', ''],
      ['visits', '', 'посещений всего', ''],
      ['spent', 'green', 'потрачено клиентами', 'сом'],
      ['spend', 'red', 'расходы за месяц', 'сом']
    ].map(([k, cls, label, unit]) => `<div class="bf-fig ${cls}"><b><span class="tn" data-bf-n="${k}">—</span>${unit ? `<small>${unit}</small>` : ''}</b><span data-bf-l="${k}">${label}</span></div>`).join('');
    /* the app's own month input: its change handler reloads the panel */
    const input = $('#profitMonth');
    const chip = $('[data-bf="mchip"]', b);
    if (input && chip) {
      chip.appendChild(input);
      input.setAttribute('aria-label', 'Месяц расчёта прибыли');
      input.addEventListener('click', () => { try { if (typeof input.showPicker === 'function') input.showPicker(); } catch (_) {} });
      input.addEventListener('change', syncMonthChip);
    }
    b.addEventListener('click', onClick);
    root.classList.add('po-bf');
    return b;
  }

  function onClick(e) {
    const t = e.target;
    if (!t || !t.closest) return;
    const act = t.closest('[data-bf-act]');
    if (act) {
      const a = act.dataset.bfAct;
      if (a === 'exit') { const x = $('#managerExitToControl'); if (x) x.click(); }
      else if (a === 'refresh') { if (typeof window.loadManagerDashboard === 'function') window.loadManagerDashboard(); }
      else if (a === 'bill') { const bill = $('#poBrief .bf-b-bill'); if (bill) bill.scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'start' }); }
      else if (a === 'note') toggleNote(act);
      return;
    }
    const proxy = t.closest('[data-bf-proxy]');
    if (proxy) { const el = document.getElementById(proxy.dataset.bfProxy); if (el) el.click(); }
    /* [data-manager-open] buttons are handled by the app's own document listener */
  }
  function toggleNote(btn) {
    const body = btn.closest('[data-bf="billBody"]');
    const open = !btn.classList.contains('is-open');
    btn.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
    if (body) body.dataset.open = open ? '1' : '';
    const em = $('.bf-note-h em', btn);
    if (em) em.textContent = open ? 'Скрыть ▲' : 'Список ▼';
    if (open) $$('.bf-miss span', btn).forEach((el, i) => A(el, [{ opacity: 0, transform: 'translate3d(0,8px,0)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay: i * 45, easing: EASE.out }));
  }
  function syncMonthChip() {
    const input = $('#profitMonth');
    const text = input && /^\d{4}-\d{2}$/.test(input.value || '') ? monthInfo(input.value).title : 'Выбрать месяц';
    const el = $('#poBrief [data-bf="mchipText"]');
    if (el && el.textContent !== text) el.textContent = text;
  }

  function render(opts = {}) {
    const b = build();
    if (!b) return;
    const animate = !!opts.animate && motion;
    renderMast(b);
    renderLead(b, animate);
    renderHeads(b);
    renderFigs(b, animate);
    renderIdx(b);
    renderTop(b);
    renderBill(b);
  }

  function renderMast(b) {
    const now = new Date();
    setText(b, 'date', `${now.getDate()} ${MONTHS_G[now.getMonth()]} · ${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setText(b, 'user', userName());
    setText(b, 'upd', loading ? 'обновляем…' : data.at ? `обновлено ${timeOf(data.at)}` : '');
    const L = live();
    const sh = $('[data-bf="shift"]', b);
    if (sh) {
      sh.className = 'bf-shift' + (!L.loaded ? ' wait' : L.open ? '' : ' off');
      const t = !L.loaded ? 'Смена: загрузка…' : L.open ? 'Смена открыта' : 'Смена закрыта';
      if (sh.lastElementChild.textContent !== t) sh.lastElementChild.textContent = t;
    }
  }

  function renderLead(b, animate) {
    const m = model();
    const mi = monthInfo(data.month || monthValue());
    setText(b, 'leadEyebrow', `Главная цифра · ${mi.name}${mi.current ? '' : ' · архив'}`);
    const turn = $('[data-bf="turn"]', b);
    const lead = $('[data-bf="lead"]', b);
    if (lead) lead.classList.toggle('is-empty', m.turnover == null);
    if (m.turnover == null) { turn._bfCount = (turn._bfCount || 0) + 1; turn.textContent = data.at ? 'нет данных' : 'загрузка…'; }
    else if (animate && prev.turn != null && prev.turn !== m.turnover) countTo(turn, prev.turn, m.turnover, 900);
    else { turn._bfCount = (turn._bfCount || 0) + 1; turn.textContent = num(m.turnover); }
    if (m.turnover != null) prev.turn = m.turnover;
    $('[data-bf="deck"]', b).innerHTML = m.turnover == null
      ? (data.at ? 'Расчёт прибыли недоступен — проверьте Worker API и доступ к финансовым данным.' : 'Загружаем входы и продажи…')
      : `Оборот бани за ${esc(mi.name)}: входы <b class="g">${num(m.entries)}</b> + товары <b class="b">${num(m.goods)}</b> сом.`;
    const both = (m.entries || 0) + (m.goods || 0);
    $('[data-bf="sg"]', b).style.flex = `${both ? m.entries : 1} 1 0`;
    $('[data-bf="sb"]', b).style.flex = `${both ? m.goods : 1} 1 0`;
    const share = m.turnover && m.spend ? Math.max(1, Math.round(m.spend / m.turnover * 100)) : 0;
    $('[data-bf="foot"]', b).innerHTML = m.spend == null
      ? '<span>Расходы месяца: нет данных</span>'
      : `<span>Расходы месяца <b>−${num(m.spend)} сом</b></span>${share ? `<span>${share}% от оборота</span>` : ''}`;
  }

  function heads() {
    const m = model(), L = live();
    const out = [];
    if (!L.loaded) out.push({ cls: 'mute', kick: 'LIVE · смена', hd: 'Загружаем смену…', dk: 'Гости и браслеты появятся через секунду', go: 'reportView' });
    else if (!L.open) out.push({ cls: 'mute', kick: 'Смена', hd: 'Смена закрыта', dk: 'Гостей в бане нет до открытия смены', go: 'reportView' });
    else if (L.active > 0) out.push({ cls: 'live', kick: 'LIVE · сейчас', hd: `${L.active} ${plural(L.active, 'гость', 'гостя', 'гостей')} в бане`, dk: `Занято ${L.active} из ${BRACELETS} браслетов · за смену ${L.today}`, go: 'reportView' });
    else out.push({ cls: 'live', kick: 'LIVE · сейчас', hd: 'Сейчас в бане никого', dk: `Смена открыта · за смену ${L.today}`, go: 'reportView' });

    if (m.top) out.push({ cls: 'gold', kick: 'Хит продаж', hd: `${m.top.name || 'Товар'}: ${num(m.top.soldQty)} шт.`, dk: `${m.top.category || 'Товар'} · выручка ${num(m.top.revenue)} сом`, go: 'productStats' });
    else if (data.at && !data.ana) out.push({ cls: 'mute', kick: 'Хит продаж', hd: 'Рейтинг недоступен', dk: 'Проверьте Worker API и права доступа', go: 'productStats' });
    else out.push({ cls: 'mute', kick: 'Хит продаж', hd: data.at ? 'Рейтинг продаж пока пуст' : 'Загружаем рейтинг…', dk: 'Данные появятся после первых продаж', go: 'productStats' });

    if (m.profit && m.profit.cc) out.push({ cls: m.profit.net >= 0 ? 'ok' : 'red', kick: 'Прибыль', hd: `${m.profit.net < 0 ? '−' : ''}${num(Math.abs(m.profit.net))} сом после расходов`, dk: 'Закупка и расходы учтены', act: 'bill' });
    else if (m.profit && m.profit.missing > 0) out.push({ cls: 'warn', kick: 'Важно', hd: 'Прибыль ждёт закупочных цен', dk: `${m.profit.missing} ${plural(m.profit.missing, 'проданная шт.', 'проданных шт.', 'проданных шт.')} без себестоимости`, act: 'bill' });
    else out.push({ cls: 'mute', kick: 'Прибыль', hd: data.at ? 'Расчёт прибыли недоступен' : 'Считаем прибыль…', dk: 'Подробно — в счёте за месяц', act: 'bill' });

    if (!L.stock) out.push({ cls: 'mute', kick: 'Склад', hd: 'Загружаем склад…', dk: 'Остатки появятся через секунду', go: 'productsView' });
    else if (L.low > 0) out.push({ cls: 'red', kick: 'Склад', hd: `${L.low} ${plural(L.low, 'товар заканчивается', 'товара заканчиваются', 'товаров заканчиваются')}`, dk: 'Остаток 3 шт. и меньше', go: 'productsView' });
    else out.push({ cls: 'ok', kick: 'Склад', hd: 'Склад в порядке', dk: 'Нет товаров с остатком 3 шт. и меньше', go: 'productsView' });
    return out;
  }
  function renderHeads(b, force) {
    const box = $('[data-bf="heads"]', b);
    if (!box) return;
    const list = heads();
    const sig = JSON.stringify(list);
    if (box.dataset.sig === sig && box.firstChild) return;
    /* never swap the cards while their entrance is playing: try again right after */
    const wait = Math.max(holdUntil - performance.now(), run ? 400 : 0);
    if (!force && box.firstChild && wait > 0) {
      clearTimeout(headsWaiting);
      headsWaiting = setTimeout(() => renderHeads(b), wait + 40);
      return;
    }
    box.dataset.sig = sig;
    box.innerHTML = list.map(c => `<button type="button" class="bf-hl ${c.cls}" ${c.go ? `data-manager-open="${c.go}"` : `data-bf-act="${c.act}"`}><span class="bf-kick"><i></i>${esc(c.kick)}</span><span class="hd">${esc(c.hd)}</span><span class="dk">${esc(c.dk)}</span></button>`).join('');
  }

  function renderFigs(b, animate) {
    const m = model();
    const mi = monthInfo(data.month || monthValue());
    const vals = { clients: m.clients, visits: m.visits, spent: m.spent, spend: m.monthSpend };
    Object.keys(vals).forEach(k => {
      const el = $(`[data-bf-n="${k}"]`, b);
      if (!el) return;
      const v = vals[k];
      if (v == null) { el.textContent = data.at ? '—' : '…'; delete el.dataset.v; return; }
      el.dataset.v = String(v);
      if (animate && prev[k] != null && prev[k] !== v) countTo(el, prev[k], v, 800);
      else { el._bfCount = (el._bfCount || 0) + 1; el.textContent = num(v); }
      prev[k] = v;
    });
    const l = $('[data-bf-l="spend"]', b);
    if (l) l.textContent = `расходы за ${mi.name}`;
  }

  function renderIdx(b) {
    const m = model(), L = live();
    const vals = {
      customers: m.clients != null ? `${num(m.clients)} ${plural(m.clients, 'клиент', 'клиента', 'клиентов')}` : '',
      stats: m.products && m.products.length ? `${m.products.length} ${plural(m.products.length, 'позиция', 'позиции', 'позиций')}` : 'рейтинг',
      expenses: m.monthSpend != null ? `${num(m.monthSpend)} сом` : '',
      cash: !L.loaded ? '' : L.open ? 'смена открыта' : 'смена закрыта',
      stock: L.stock ? (L.low ? `${L.low} мало` : 'в норме') : '',
      history: '',
      daily: '2 дня',
      ceo: 'LIVE'
    };
    ROWS.forEach(r => {
      const row = $(`[data-bf-row="${r.key}"]`, b);
      if (!row) return;
      if (r.proxy) row.hidden = !document.getElementById(r.proxy);
      const v = $(`[data-bf-v="${r.key}"]`, row);
      if (v && v.textContent !== vals[r.key]) v.textContent = vals[r.key];
    });
    const cash = $('[data-bf-row="cash"]', b);
    if (cash) { cash.classList.toggle('g', L.open); cash.classList.toggle('m', !L.open); }
    const stock = $('[data-bf-row="stock"]', b);
    if (stock) { stock.classList.toggle('a', L.low > 0); stock.classList.toggle('g', L.stock && !L.low); }
  }

  function renderTop(b) {
    const box = $('[data-bf="top"]', b);
    const ps = data.ana && Array.isArray(data.ana.products) ? data.ana.products : null;
    if (!ps) { box.innerHTML = `<div class="bf-empty">${data.at ? 'Не удалось загрузить статистику товаров. Проверьте Worker API и права доступа.' : 'Загружаем статистику продаж…'}</div>`; return; }
    const list = ps.slice(0, 6);
    if (!list.length) { box.innerHTML = '<div class="bf-empty">Рейтинг пока пуст: данные появятся после первых продаж.</div>'; return; }
    const max = Math.max(1, ...list.map(p => Number(p.soldQty) || 0));
    box.innerHTML = `<ol class="bf-top">${list.map((p, i) => {
      const q = Number(p.soldQty) || 0;
      const r = Number(p.rank) || i + 1;
      return `<li class="bf-trow"><span class="rk${r <= 3 ? ' r' + r : ''}">${r}</span><span class="nm"><b>${esc(p.name || 'Товар')}</b><small>${esc(p.category || 'Товар')} · выручка ${num(p.revenue)} сом</small><span class="bf-tbar"><i style="width:${Math.max(4, Math.round(q / max * 100))}%"></i></span></span><span class="q"><b>${num(q)}</b><small>шт.</small></span></li>`;
    }).join('')}</ol>`;
  }

  function renderBill(b) {
    const mi = monthInfo(data.month || monthValue());
    setText(b, 'billMonth', mi.title);
    syncMonthChip();
    const body = $('[data-bf="billBody"]', b);
    const s = data.prof && data.prof.summary;
    if (!s) {
      body.innerHTML = `<p class="bf-err">${data.at ? 'Не удалось загрузить расчёт прибыли. Проверьте Worker API и доступ к финансовым данным.' : 'Рассчитываем входы, продажи, закупочную стоимость и расходы…'}</p>`;
      return;
    }
    const cc = !!s.costComplete;
    const net = Number(s.netProfit) || 0;
    const missing = Number(s.missingCostQty) || 0;
    const list = Array.isArray(s.missingCostProducts) ? s.missingCostProducts : [];
    const open = body.dataset.open === '1';
    const row = (label, value, cls = '', sub = false) => `<div class="bf-bl${sub ? ' sub' : ''}"><span>${label}</span><i></i><b class="${cls}">${value}</b></div>`;
    body.innerHTML = [
      row('Доход от входов', num(s.entryRevenue)),
      row('взрослый вход', num(s.adultEntryRevenue), '', true),
      row('детский вход', num(s.childEntryRevenue), '', true),
      row('Выручка от товаров', num(s.productRevenue)),
      row('Закупочная стоимость', cc ? '−' + num(s.productCost) : 'не указана', cc ? 'neg' : 'na'),
      row('Прибыль от товаров', cc ? num(s.productGrossProfit) : 'не рассчитана', cc ? '' : 'na'),
      row('Расходы за месяц', '−' + num(s.expenses), 'neg'),
      `<div class="bf-total"><span>Прибыль после расходов</span>${cc
        ? `<b class="${net >= 0 ? 'pos' : 'neg'}">${net < 0 ? '−' : ''}${num(Math.abs(net))} сом</b>`
        : '<span class="bf-stamp">НЕ РАССЧИТАНА</span>'}</div>`,
      missing > 0
        ? `<button type="button" class="bf-note${open ? ' is-open' : ''}" data-bf-act="note" aria-expanded="${open}"><span class="bf-note-h">${missing} ${plural(missing, 'проданная шт.', 'проданных шт.', 'проданных шт.')} без закупочной цены<em>${open ? 'Скрыть ▲' : 'Список ▼'}</em></span><span class="tx">Итоговая прибыль не показывается, чтобы не завысить результат. Закупочную цену указывает администратор в «Товары и склад».</span>${list.length ? `<span class="bf-miss">${list.map(p => `<span>${esc(p.name)}<b>${Number(p.qty) || 0} шт.</b></span>`).join('')}</span>` : ''}</button><button type="button" class="bf-cta" data-manager-open="productsView">${svg(ICON.box)}Открыть «Товары и склад»</button>`
        : `<p class="bf-info">Период: <b>${esc(mi.title.toLowerCase())}</b>. Учитываются только оплаченные входы и товары (наличные и перевод) минус закупочная стоимость и записанные расходы. Бонусный вход за 0 сом не считается доходом.</p>`
    ].join('');
  }

  /* ---------- entrances ---------- */
  const fadeIn = [{ opacity: 0 }, { opacity: 1 }];
  const grow = [{ transform: 'scaleX(0)' }, { transform: 'none' }];
  let revealIO = null;
  function clearReveal() {
    if (revealIO) { revealIO.disconnect(); revealIO = null; }
    $$('#poBrief .bf-pend').forEach(el => el.classList.remove('bf-pend'));
  }
  function revealBlock(el, delay) {
    A(el, [{ opacity: 0, transform: 'translate3d(0,26px,0)' }, { opacity: 1, transform: 'none' }], { duration: 600, delay, easing: EASE.out });
    const line = $('.bf-sec i', el);
    if (line) A(line, grow, { duration: 760, delay: delay + 140, easing: EASE.out });
    if (el.classList.contains('bf-b-figs')) {
      $$('[data-bf-n]', el).forEach((n, i) => {
        const to = Number(n.dataset.v);
        if (n.dataset.v != null && !Number.isNaN(to) && to > 0) countTo(n, 0, to, 1000, delay + 160 + i * 90);
        A(n.parentElement, [{ opacity: 0, transform: 'translate3d(0,10px,0)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: delay + 120 + i * 90, easing: EASE.out });
      });
    }
    if (el.classList.contains('bf-b-idx')) {
      $$('.bf-row', el).forEach((r, i) => {
        A(r, [{ opacity: 0, transform: 'translate3d(-16px,0,0)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: delay + 100 + i * 55, easing: EASE.out });
        try { if (motion) r.animate(grow, { duration: 700, delay: delay + 160 + i * 55, easing: EASE.out, fill: 'backwards', pseudoElement: '::after' }); } catch (_) {}
      });
    }
    if (el.classList.contains('bf-b-top')) {
      $$('.bf-trow', el).forEach((r, i) => {
        A(r, [{ opacity: 0, transform: 'translate3d(0,12px,0)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: delay + 100 + i * 70, easing: EASE.out });
        A($('.bf-tbar i', r), [{ transform: 'scaleX(0)' }, { transform: 'none' }], { duration: 900, delay: delay + 260 + i * 70, easing: EASE.out });
      });
    }
    if (el.classList.contains('bf-b-bill')) {
      A($('.bf-bill', el), [{ opacity: 0, transform: 'translate3d(0,-14px,0) rotate(-.8deg)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: delay + 80, easing: EASE.out });
      $$('.bf-bl', el).forEach((r, i) => A(r, fadeIn, { duration: 360, delay: delay + 260 + i * 60, easing: 'ease-out' }));
      const stamp = $('.bf-stamp', el);
      if (stamp) A(stamp, [{ opacity: 0, transform: 'rotate(-7deg) scale(2.4)' }, { opacity: .9, transform: 'rotate(-7deg) scale(.94)', offset: .72 }, { opacity: .9, transform: 'rotate(-7deg) scale(1)' }], { duration: 480, delay: delay + 780, easing: EASE.slam });
    }
  }
  function setupReveal(b) {
    if (!motion) return;
    const blocks = $$('.bf-b-figs, .bf-b-idx, .bf-b-top, .bf-b-bill', b);
    let k = 0;
    const later = [];
    blocks.forEach(el => { if (onScreen(el, 30)) revealBlock(el, 760 + 130 * k++); else later.push(el); });
    if (!later.length || typeof IntersectionObserver !== 'function') return;
    later.forEach(el => el.classList.add('bf-pend'));
    revealIO = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting || !revealIO) return;
      revealIO.unobserve(en.target);
      en.target.classList.remove('bf-pend');
      revealBlock(en.target, 0);
    }), { threshold: 0.1 });
    later.forEach(el => revealIO.observe(el));
  }
  function entrance(kind) {
    const b = build();
    if (!b) return;
    stop('page');
    clearReveal();
    if (!motion || kind === 'static') return;
    const mast = $('.bf-mast', b), lead = $('.bf-lead', b), headsB = $('.bf-b-heads', b);
    if (kind === 'skip') {
      A(b, fadeIn, { duration: 240, easing: 'ease-out' });
      return;
    }
    if (kind === 'lite') {
      [mast, lead, headsB].forEach((el, i) => A(el, [{ opacity: 0, transform: 'translate3d(0,12px,0)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: i * 60, easing: EASE.out }));
      holdUntil = performance.now() + 560;
      return;
    }
    /* full: plays while the curtain opens */
    A($('.bf-kicker', b), [{ opacity: 0, letterSpacing: '.5em' }, { opacity: 1, letterSpacing: '.24em' }], { duration: 760, easing: EASE.out });
    A($('.bf-title', b), [{ opacity: 0, clipPath: 'inset(0 0 100% 0)', transform: 'translate3d(0,24px,0)' }, { opacity: 1, clipPath: 'inset(0 0 -25% 0)', transform: 'none' }], { duration: 780, delay: 90, easing: EASE.out });
    A($('.bf-rule', b), grow, { duration: 820, delay: 200, easing: EASE.out });
    A($('.bf-by', b), fadeIn, { duration: 460, delay: 320, easing: 'ease-out' });
    A($('.bf-acts', b), [{ opacity: 0, transform: 'translate3d(0,8px,0)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 400, easing: EASE.out });
    A(lead, fadeIn, { duration: 420, delay: 60, easing: 'ease-out' });
    A($('.bf-eyebrow', lead), fadeIn, { duration: 420, delay: 300, easing: 'ease-out' });
    A($('.bf-deck', lead), [{ opacity: 0, transform: 'translate3d(0,8px,0)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 560, easing: EASE.out });
    $$('.bf-split i', lead).forEach((el, i) => A(el, grow, { duration: 820, delay: 620 + i * 150, easing: EASE.out }));
    A($('.bf-foot', lead), fadeIn, { duration: 460, delay: 700, easing: 'ease-out' });
    A($('.bf-sec', headsB), fadeIn, { duration: 460, delay: 540, easing: 'ease-out' });
    A($('.bf-sec i', headsB), grow, { duration: 760, delay: 600, easing: EASE.out });
    $$('.bf-hl', headsB).forEach((el, i) => A(el, [{ opacity: 0, transform: 'perspective(900px) rotateX(-20deg) translate3d(0,30px,0)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 640 + i * 100, easing: EASE.out }));
    holdUntil = performance.now() + 1500;
    setupReveal(b);
  }

  /* =====================================================================
     the opening
     ===================================================================== */
  let toastObs = null;
  function quietToasts(on) {
    if (!on) { if (toastObs) { toastObs.disconnect(); toastObs = null; } return; }
    if (toastObs || typeof MutationObserver !== 'function') return;
    const mark = n => { if (n.nodeType === 1 && n.classList.contains('toast') && /Панель руководителя открыта/.test(n.textContent || '')) n.classList.add('bf-quiet'); };
    $$('body > .toast').forEach(mark);
    toastObs = new MutationObserver(list => list.forEach(r => r.addedNodes.forEach(mark)));
    toastObs.observe(document.body, { childList: true });
  }
  function makeOverlay() {
    const now = new Date();
    const issue = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
    const ov = document.createElement('div');
    ov.className = 'bf-intro';
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = `<div class="bf-band"></div><i class="bf-scan"></i>
      <div class="bf-bar t"><span>ПАР ОРДО · ДОСТУП ${esc(userName())}</span><span>LIVE · ${pad(now.getHours())}:${pad(now.getMinutes())}</span></div>
      <div class="bf-stage">
        <div class="bf-tele"><span class="bf-type"></span><i class="bf-caret"></i></div>
        <div class="bf-dline">${esc(`${WD[now.getDay()]} · ${now.getDate()} ${MONTHS_G[now.getMonth()]} ${now.getFullYear()}`.toUpperCase())}</div>
        <div class="bf-wait"></div>
        <div class="bf-numwrap"><i class="bf-flash"></i><div class="bf-odo"></div><i class="bf-sheen"></i></div>
        <div class="bf-grule"></div>
        <div class="bf-cap"></div>
        <div class="bf-facts"></div>
      </div>
      <div class="bf-bar b"><span>ВЫПУСК № ${issue}</span><span class="bf-hint">Коснитесь — пропустить</span></div>`;
    return ov;
  }
  function typeText(el, text, per, alive) {
    return new Promise(res => {
      if (!el) { res(); return; }
      let i = 0;
      const tick = () => {
        if (!alive()) { res(); return; }
        el.textContent = text.slice(0, ++i);
        if (i >= text.length) { res(); return; }
        setTimeout(tick, per);
      };
      tick();
    });
  }
  /* the odometer: one rolling strip per digit, the separator is the same no-break space as in the page */
  function buildOdo(odo, text, digits) {
    odo.textContent = '';
    odo.classList.toggle('word', !digits);
    if (!digits) { odo.textContent = text; return; }
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:700 100px "PO Inter Display","PO Inter",Inter,system-ui,sans-serif;font-variant-numeric:tabular-nums lining-nums;letter-spacing:0';
    probe.textContent = '0123456789';
    document.body.appendChild(probe);
    const adv = probe.getBoundingClientRect().width / 1000 || 0.62;
    probe.remove();
    odo.style.setProperty('--adv', adv.toFixed(4));
    let strip = '';
    for (let c = 0; c < 3; c++) for (let d = 0; d < 10; d++) strip += `<span>${d}</span>`;
    for (const ch of text) {
      if (/\d/.test(ch)) {
        const slot = document.createElement('span');
        slot.className = 'bf-dg';
        slot.style.width = `${adv}em`;
        slot.dataset.d = ch;
        slot.innerHTML = `<i>${strip}</i>`;
        odo.appendChild(slot);
      } else {
        const g = document.createElement('span');
        g.className = 'bf-gp';
        g.textContent = ch;
        odo.appendChild(g);
      }
    }
    odo.style.fontSize = '100px';
    const w100 = odo.scrollWidth || 1;
    const max = innerWidth >= 700 ? 118 : 86;
    odo.style.fontSize = `${Math.max(40, Math.min(max, (innerWidth - 48) / (w100 / 100))).toFixed(1)}px`;
  }
  function rollOdo(odo) {
    const slots = $$('.bf-dg', odo);
    let last = 0;
    A(odo, [{ opacity: 0, transform: 'translate3d(0,16px,0)' }, { opacity: 1, transform: 'none' }], { duration: 280, easing: EASE.out }, 'intro');
    slots.forEach((slot, i) => {
      const d = Number(slot.dataset.d) || 0;
      const from = (i * 3 + 2) % 10;
      const dur = 780 + i * 90;
      const delay = i * 28;
      A($('i', slot), [
        { transform: `translate3d(0,${-from}em,0)`, filter: 'blur(0px)' },
        { offset: 0.14, filter: 'blur(2.4px)' },
        { offset: 0.78, filter: 'blur(.6px)' },
        { transform: `translate3d(0,${-(20 + d)}em,0)`, filter: 'blur(0px)' }
      ], { duration: dur, delay, easing: EASE.roll, fill: 'both' }, 'intro');
      last = Math.max(last, dur + delay);
    });
    return last;
  }
  function slam(ov, odo) {
    const stage = $('.bf-stage', ov);
    A($('.bf-flash', ov), [{ opacity: 0, transform: 'scale(.35)' }, { opacity: 1, transform: 'scale(.8)', offset: 0.22 }, { opacity: 0, transform: 'scale(1.4)' }], { duration: 780, easing: 'ease-out', fill: 'none' }, 'intro');
    A(odo, [{ transform: 'scale(1.08)' }, { transform: 'none' }], { duration: 320, easing: EASE.out, fill: 'none' }, 'intro');
    A(stage, [
      { transform: 'translateY(-50%)' },
      { transform: 'translateY(-50%) translate3d(-5px,2px,0)' },
      { transform: 'translateY(-50%) translate3d(4px,-2px,0)' },
      { transform: 'translateY(-50%) translate3d(-2px,1px,0)' },
      { transform: 'translateY(-50%)' }
    ], { duration: 240, easing: 'linear', fill: 'none' }, 'intro');
    A($('.bf-sheen', ov), [{ opacity: 0, transform: 'translateX(-55%)' }, { opacity: 1, offset: 0.3 }, { opacity: 0, transform: 'translateX(55%)' }], { duration: 800, delay: 90, easing: 'ease-out', fill: 'none' }, 'intro');
    A($('.bf-grule', ov), [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 560, delay: 60, easing: EASE.out, fill: 'forwards' }, 'intro');
    A($('.bf-cap', ov), [{ opacity: 0, letterSpacing: '.72em' }, { opacity: 1, letterSpacing: '.26em' }], { duration: 680, delay: 120, easing: EASE.out, fill: 'forwards' }, 'intro');
    $$('.bf-facts span', ov).forEach((el, i) => A(el, [{ opacity: 0, transform: 'translate3d(0,10px,0) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 440, delay: 240 + i * 95, easing: EASE.out, fill: 'forwards' }, 'intro'));
    buzz(12);
  }
  function endOpening(me, how) {
    if (run !== me) return;
    me.stopped = true;
    run = null;
    document.removeEventListener('keydown', me.key, true);
    quietToasts(false);
    root.classList.remove('bf-opening');
    const target = $('#poBrief [data-bf="turn"]');
    if (target) target.style.opacity = '';
    const ov = me.ov;
    if (how === 'leave') { stop('intro'); if (ov) ov.remove(); return; }
    if (how === 'skip') {
      stop('intro');
      stop('page');
      if (ov) {
        ov.style.pointerEvents = 'none';
        try { const a = ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }); a.finished.then(() => ov.remove(), () => ov.remove()); } catch (_) { ov.remove(); }
      }
      entrance('skip');
      holdUntil = 0;
      return;
    }
    stop('intro');
    if (ov) ov.remove();
  }
  async function playOpening() {
    if (!motion) { entrance('static'); return; }
    if (run) return;
    const me = { stopped: false, ov: null, key: null };
    run = me;
    const alive = () => run === me && !me.stopped;
    root.classList.add('bf-opening');
    quietToasts(true);
    const ov = makeOverlay();
    me.ov = ov;
    document.body.appendChild(ov);
    const skip = e => { if (e && e.cancelable) e.preventDefault(); if (alive()) endOpening(me, 'skip'); };
    ov.addEventListener('pointerdown', skip);
    ov.addEventListener('wheel', e => e.preventDefault(), { passive: false });
    ov.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    me.key = e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') skip(e); };
    document.addEventListener('keydown', me.key, true);
    const fonts = loadFonts();
    const target = $('#poBrief [data-bf="turn"]');
    if (target) target.style.opacity = '0';

    /* 1 · the letterbox closes, the teletype prints */
    const barT = $('.bf-bar.t', ov), barB = $('.bf-bar.b', ov);
    A(barT, [{ transform: 'translateY(-100%)' }, { transform: 'none' }], { duration: 440, easing: EASE.out }, 'intro');
    A(barB, [{ transform: 'translateY(100%)' }, { transform: 'none' }], { duration: 440, easing: EASE.out }, 'intro');
    A($('.bf-scan', ov), [{ transform: 'translateY(0)' }, { transform: `translateY(${innerHeight + 300}px)` }], { duration: 1400, delay: 220, easing: 'linear', fill: 'none' }, 'intro');
    await Promise.all([Promise.race([fonts, sleep(450)]), sleep(320)]);
    if (!alive()) return;
    await typeText($('.bf-type', ov), 'БРИФИНГ РУКОВОДИТЕЛЯ', 30, alive);
    if (!alive()) return;
    A($('.bf-dline', ov), [{ opacity: 0, transform: 'translate3d(0,6px,0)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: EASE.out, fill: 'forwards' }, 'intro');

    /* 2 · wait for the numbers */
    const wait = $('.bf-wait', ov);
    const waitTimer = setTimeout(() => { if (alive()) wait.classList.add('on'); }, 280);
    await Promise.all([dataReady(4500), Promise.race([fonts, sleep(900)]), sleep(300)]);
    clearTimeout(waitTimer);
    wait.classList.remove('on');
    if (!alive()) return;

    /* 3 · the odometer rolls and lands */
    const m = model();
    const mi = monthInfo(data.month || monthValue());
    const hasNum = m.turnover != null;
    const odo = $('.bf-odo', ov);
    buildOdo(odo, hasNum ? num(m.turnover) : 'БРИФИНГ ГОТОВ', hasNum);
    $('.bf-cap', ov).textContent = hasNum ? `сом оборота за ${mi.name}` : (data.at ? 'часть данных недоступна' : 'данные ещё загружаются');
    $('.bf-facts', ov).innerHTML = hasNum
      ? `<span class="g">входы ${num(m.entries)}</span><span class="b">товары ${num(m.goods)}</span>${m.spend != null ? `<span class="r">расходы −${num(m.spend)}</span>` : ''}`
      : '';
    let land = 360;
    if (hasNum) land = rollOdo(odo);
    else A(odo, [{ opacity: 0, letterSpacing: '.3em' }, { opacity: 1, letterSpacing: '.06em' }], { duration: 520, easing: EASE.out }, 'intro');
    await sleep(land);
    if (!alive()) return;
    slam(ov, odo);
    await sleep(760);
    if (!alive()) return;

    /* 4 · the curtain opens; the number flies into the lead card while the page builds */
    toTop();
    const page = build();
    if (page) { clearTimeout(headsWaiting); renderHeads(page, true); }
    entrance('full');
    A(barT, [{ transform: 'none' }, { transform: 'translateY(-101%)' }], { duration: 660, easing: EASE.curtain, fill: 'forwards' }, 'intro');
    A(barB, [{ transform: 'none' }, { transform: 'translateY(101%)' }], { duration: 660, easing: EASE.curtain, fill: 'forwards' }, 'intro');
    A($('.bf-band', ov), [{ opacity: 1 }, { opacity: 0 }], { duration: 540, delay: 80, easing: 'ease-in', fill: 'forwards' }, 'intro');
    $$('.bf-tele, .bf-dline, .bf-grule, .bf-cap, .bf-facts', ov).forEach(el => A(el, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0,-28px,0)' }], { duration: 400, easing: EASE.in, fill: 'forwards' }, 'intro'));
    const tgt = $('#poBrief [data-bf="turn"]');
    if (hasNum && tgt && onScreen(tgt)) {
      const s = odo.getBoundingClientRect(), t = tgt.getBoundingClientRect();
      const k = s.height ? t.height / s.height : 1;
      A(odo, [{ transform: 'none' }, { transform: `translate3d(${(t.left - s.left).toFixed(1)}px,${(t.top - s.top).toFixed(1)}px,0) scale(${k.toFixed(4)})` }], { duration: 720, easing: EASE.io, fill: 'forwards' }, 'intro');
      await sleep(640);
      if (!alive()) return;
      tgt.style.opacity = '';
      A(tgt, fadeIn, { duration: 150, easing: 'linear' });
      A(odo, [{ opacity: 1 }, { opacity: 0 }], { duration: 170, delay: 40, easing: 'linear', fill: 'forwards' }, 'intro');
      await sleep(230);
    } else {
      A(odo, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.92)' }], { duration: 400, easing: EASE.in, fill: 'forwards' }, 'intro');
      if (tgt) tgt.style.opacity = '';
      await sleep(600);
    }
    if (!alive()) return;
    endOpening(me, 'done');
  }

  /* =====================================================================
     wiring
     ===================================================================== */
  let liveTimer = 0;
  let liveSig = '';
  let loginClosedAt = -1e9;

  function tickLive() {
    if (!viewActive()) return;
    const b = $('#poBrief');
    if (!b) return;
    const L = live();
    renderMast(b);
    const sig = JSON.stringify(L);
    if (sig === liveSig) return;
    liveSig = sig;
    renderHeads(b);
    renderIdx(b);
  }
  function startLive() { stopLive(); liveSig = JSON.stringify(live()); liveTimer = setInterval(tickLive, 4000); }
  function stopLive() { clearInterval(liveTimer); liveTimer = 0; }

  function enter() {
    const b = build();
    if (!b) return;
    render({ animate: false });
    startLive();
    loadFonts();
    toTop();
    const fresh = performance.now() - loginClosedAt < 3000;
    const full = motion && (fresh || store.get(SEEN_KEY) !== '1');
    store.set(SEEN_KEY, '1');
    if (!motion) return;
    if (full) playOpening(); else entrance('lite');
  }
  function leave() {
    stopLive();
    if (run) endOpening(run, 'leave');
    stop('page');
    clearReveal();
  }
  function onNavigate(view, prevView) {
    if (view !== 'managerView') { if (prevView === 'managerView' || run) leave(); return; }
    if (prevView === 'managerView' && $('#poBrief') && !run) return;
    enter();
  }
  function watchLogin() {
    const modal = $('#managerLoginModal');
    if (!modal || typeof MutationObserver !== 'function') return;
    let was = modal.classList.contains('open');
    new MutationObserver(() => {
      const open = modal.classList.contains('open');
      if (open && !was) loadFonts();
      if (!open && was) loginClosedAt = performance.now();
      was = open;
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
  }

  function install() {
    const v = $('#managerView');
    if (!v || typeof window.navigate !== 'function' || typeof window.loadManagerDashboard !== 'function') return false;
    if (!wrapLoad()) return false;
    const origNav = window.navigate;
    window.navigate = function (view) {
      let prevView = '';
      try { prevView = currentView; } catch (_) {}
      const r = origNav.apply(this, arguments);
      try { onNavigate(view, prevView); } catch (e) { console.warn('PAR ORDO briefing', e); }
      return r;
    };
    watchLogin();
    if (store.get(PORTAL_KEY) === '1') loadFonts();
    build();
    render();
    if (viewActive()) {
      /* the panel was opened before this file ran: load once more so the data is observed */
      startLive();
      store.set(SEEN_KEY, '1');
      try { window.loadManagerDashboard(); } catch (_) {}
    }
    window.PARORDOBriefing = Object.freeze({
      version: VERSION,
      motion,
      replay() { if (viewActive()) { if (run) endOpening(run, 'leave'); playOpening(); } }
    });
    return true;
  }
  const start = () => {
    try { if (install()) return; } catch (e) { console.warn('PAR ORDO briefing', e); return; }
    let tries = 0;
    const timer = setInterval(() => {
      let done = false;
      try { done = install(); } catch (e) { console.warn('PAR ORDO briefing', e); done = true; }
      if (done || ++tries > 40) clearInterval(timer);
    }, 250);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
