/* PAR ORDO PRO — INNER V1
   Three inner screens of the manager panel get the «Брифинг» look and their own openings:
   1 · Ежедневный отчёт «Касса-маржа» — two days side by side, purchase cost and net profit,
       margin by product, stock receipts and shifts.
   2 · База клиентов «Клуб · бонус 3%» — the club card, the 3% rule and every guest's bonus
       account in som (3% of all paid purchases).
   3 · Статистика товаров «Гонка + прибыль» — purchase / sale price / net profit per product,
       hits (green), once a week (yellow), not selling (red), and the sales speed by day.

   Data and safety
   - No writes. The report and the statistics read the same endpoints the app already reads
     (control/reports, audit, analytics, products/catalog). Responses that the app's own
     modules fetch are observed through a read-only fetch tap, so opening a screen does not
     repeat their requests; a request is made only when nothing fresh was observed.
   - Purchase prices: products' costPrice (Товары и склад), or a report line's own costPrice.
     Lines without a known price are shown as «нет закупа» and left out of the profit.
   - Every original control keeps working: the client form, search, tabs, «Изменить», the
     old 5th-visit bonus switch, the report date and «Обновить».
   - Any error falls back to the original screen.

   Openings play once per session (a tap, Esc or Enter skips); later visits get a short
   entrance. prefers-reduced-motion: the new design without movement. */
(() => {
  'use strict';
  if (window.PARORDOInner) return;

  const VERSION = '1.0.1';
  const HOST = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const BONUS_RATE = 0.03;
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const motion = !reduced && typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const EASE = {
    out: 'cubic-bezier(.16,1,.3,1)',
    io: 'cubic-bezier(.65,0,.35,1)',
    in: 'cubic-bezier(.5,0,.75,0)',
    slam: 'cubic-bezier(.2,.9,.3,1)',
    spin: 'cubic-bezier(.2,.75,.3,1)',
    back: 'cubic-bezier(.34,1.56,.64,1)'
  };
  const SEEN = { rp: 'po_in_seen_rp', cl: 'po_in_seen_cl', gd: 'po_in_seen_gd' };
  const MONTHS_G = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const ICON = {
    back: '<path d="M15 6l-6 6 6 6"/>',
    cal: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4.5V9h-4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>'
  };
  const svg = body => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = v => Math.round(Number(v) || 0).toLocaleString('ru-RU').replace(/[\s  ]/g, ' ');
  const sgn = v => (v > 0 ? '+' : v < 0 ? '−' : '') + num(Math.abs(v));
  const pct = (a, b) => (b > 0 ? Math.round(a / b * 100) : 0);
  const pad = n => String(n).padStart(2, '0');
  const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
  const lower = v => String(v ?? '').trim().toLocaleLowerCase('ru');
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} }
  };
  const log = (where, e) => { try { console.warn('PAR ORDO inner · ' + where, e); } catch (_) {} };
  const role = () => { try { return currentRole(); } catch (_) { return store.get('parordo_admin_role') || 'admin'; } };
  const backLabel = () => { try { return currentView === 'managerView' ? 'Брифинг' : 'Назад'; } catch (_) { return 'Назад'; } };
  const call = (name, ...args) => { try { const f = window[name]; return typeof f === 'function' ? f(...args) : undefined; } catch (e) { log(name, e); return undefined; } };

  /* ---------- dates: a shift belongs to the Bishkek day it opened ---------- */
  const fmtDay = (() => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bishkek', year: 'numeric', month: '2-digit', day: '2-digit' }); } catch (_) { return null; } })();
  const fmtTime = (() => { try { return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Bishkek', hour: '2-digit', minute: '2-digit' }); } catch (_) { return null; } })();
  function dayKey(value = new Date()) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    if (fmtDay) {
      const parts = fmtDay.formatToParts(d);
      const g = t => (parts.find(p => p.type === t) || {}).value || '';
      return `${g('year')}-${g('month')}-${g('day')}`;
    }
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function moveDay(day, delta) {
    const [y, m, d] = String(day).split('-').map(Number);
    const t = new Date(y, m - 1, d, 12, 0, 0);
    t.setDate(t.getDate() + delta);
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`;
  }
  function daysBetween(a, b) {
    const pa = String(a).split('-').map(Number), pb = String(b).split('-').map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 864e5);
  }
  const timeOf = v => { const d = new Date(v); if (Number.isNaN(d.getTime())) return '—'; return fmtTime ? fmtTime.format(d) : `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const dayLong = day => { const p = String(day).split('-').map(Number); return p.length === 3 ? `${p[2]} ${MONTHS_G[p[1] - 1]}` : ''; };
  const dayShort = day => { const p = String(day).split('-'); return p.length === 3 ? `${p[2]}.${p[1]}` : ''; };
  const WD = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const WD_S = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const weekday = (day, short) => { const p = String(day).split('-').map(Number); if (p.length !== 3) return ''; const w = new Date(p[0], p[1] - 1, p[2], 12).getDay(); return short ? WD_S[w] : WD[w]; };

  /* ---------- motion ---------- */
  const groups = new Map();
  function A(el, keyframes, options, group) {
    if (!motion || !el || typeof el.animate !== 'function') return null;
    try {
      const a = el.animate(keyframes, Object.assign({ fill: 'backwards' }, options));
      const g = group || 'misc';
      if (!groups.has(g)) groups.set(g, new Set());
      const set = groups.get(g);
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
  function countTo(el, to, ms, delay = 0, fmt = num) {
    if (!el) return;
    const token = (el._inCount = (el._inCount || 0) + 1);
    if (!motion || !ms) { el.textContent = fmt(to); return; }
    const t0 = performance.now() + delay;
    el.textContent = fmt(0);
    const step = now => {
      if (!el.isConnected || el._inCount !== token) return;
      if (now < t0) { requestAnimationFrame(step); return; }
      const k = Math.min(1, (now - t0) / ms);
      el.textContent = fmt(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  /* blocks marked data-in rise in order; data-grow bars grow, data-rise columns rise */
  function assemble(scope, full, group, delay = 0) {
    if (!motion || !scope) return;
    const els = $$('[data-in]', scope).sort((a, b) => (+a.dataset.in || 0) - (+b.dataset.in || 0));
    els.forEach((el, i) => {
      if (full) A(el, [{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: delay + 40 + Math.min(i, 10) * 70, easing: EASE.out }, group);
      else A(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: delay + Math.min(i, 6) * 30, easing: 'ease-out' }, group);
    });
    $$('[data-grow]', scope).forEach((el, i) => A(el, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: full ? 900 : 500, delay: delay + (full ? 380 : 80) + Math.min(i, 12) * 40, easing: EASE.out }, group));
    $$('[data-rise]', scope).forEach((el, i) => A(el, [{ transform: 'scaleY(0)', transformOrigin: el.dataset.rise || '50% 100%' }, { transform: 'scaleY(1)', transformOrigin: el.dataset.rise || '50% 100%' }], { duration: full ? 900 : 500, delay: delay + (full ? 450 : 100) + i * 160, easing: EASE.out }, group));
  }

  /* the opening layer: it lives in the screen; tap, Esc or Enter skips it */
  function intro(host, html, total, group, lockEl) {
    const el = document.createElement('div');
    el.className = 'in-intro';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = html + '<div class="in-skip">НАЖМИТЕ, ЧТОБЫ ПРОПУСТИТЬ</div>';
    if (lockEl) {
      // inside a scrolling card the layer covers exactly the visible part
      if (host === lockEl) { el.style.top = (lockEl.scrollTop || 0) + 'px'; el.style.height = lockEl.clientHeight + 'px'; el.style.bottom = 'auto'; }
      lockEl.classList.add('in-lock');
    }
    host.appendChild(el);
    let done = false, timer = 0, resolveFn = null;
    const promise = new Promise(res => { resolveFn = res; });
    const finish = skipped => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey, true);
      if (skipped) stop(group);
      if (lockEl) lockEl.classList.remove('in-lock');
      el.remove();
      resolveFn(!!skipped);
    };
    const onKey = e => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); finish(true); } };
    el.addEventListener('pointerdown', e => { e.preventDefault(); finish(true); });
    document.addEventListener('keydown', onKey, true);
    timer = setTimeout(() => finish(false), total);
    return { el, finish, promise };
  }

  /* =====================================================================
     data: a read-only tap on fetch — the app's own requests are observed
     ===================================================================== */
  const cap = { reports: null, audit: null, ana: null, catalog: null, at: {} };
  const subs = new Set();
  function feed(key, data) {
    cap[key] = data;
    cap.at[key] = Date.now();
    subs.forEach(fn => { try { fn(key, data); } catch (e) { log('feed', e); } });
  }
  const fresh = (key, ms) => !!cap[key] && Date.now() - (cap.at[key] || 0) < ms;
  function tapFetch() {
    const orig = window.fetch;
    if (typeof orig !== 'function' || orig.__poInTap) return;
    const tapped = function (input, init) {
      const p = orig.apply(this, arguments);
      try {
        const url = String(typeof input === 'string' ? input : (input && input.url) || '');
        if (url.indexOf(HOST) === 0) {
          const method = String((init && init.method) || (typeof input !== 'string' && input && input.method) || 'GET').toUpperCase();
          if (method === 'GET') {
            const path = url.slice(HOST.length);
            const key = /^\/api\/admin\/control\/reports(?:\?|$)/.test(path) ? 'reports'
              : /^\/api\/admin\/audit(?:\?|$)/.test(path) ? 'audit'
              : /^\/api\/admin\/control\/analytics(?:\?|$)/.test(path) ? 'ana'
              : /^\/api\/admin\/products\/catalog(?:\?|$)/.test(path) ? 'catalog' : '';
            // parse a copy only when a screen needs it (or once, to have it warm): CEO MODE
            // re-reads the reports every minute and that must not cost a second parse
            const want = key && (!cap[key] || RP.open || GD.open || key === 'catalog');
            if (want) p.then(r => { if (r && r.ok) r.clone().json().then(d => feed(key, d), () => {}); }, () => {});
          }
        }
      } catch (_) {}
      return p;
    };
    tapped.__poInTap = true;
    window.fetch = tapped;
  }
  async function getJson(path) {
    const token = store.get('parordo_admin_token') || '';
    if (!token) throw new Error('Сессия не найдена. Войдите в панель руководителя заново.');
    const res = await fetch(HOST + path, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json', Authorization: 'Bearer ' + token } });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((data && data.error) || ('Ошибка API ' + res.status));
    return data;
  }

  /* ---------- shared business rules (the same as the app's report modules) ---------- */
  const ADMISSION = new Set(['вход', 'вход детский', 'бонусный вход (5-й визит)', 'бонусный вход']);
  /* a line paid with the 3% bonus (par-ordo-bonus-v1.js) is named «Чай · бонус 45» and costs less */
  const BONUS_MARK = /\s*·\s*бонус\s+(\d+)\s*$/u;
  function bonusPaidOf(it) {
    if (!it) return 0;
    const f = Math.floor(Number(it.bonusPaid));
    if (Number.isFinite(f) && f > 0) return f;
    const m = String(it.name || '').match(BONUS_MARK);
    return m ? (Number(m[1]) || 0) : 0;
  }
  const nameOf = it => String(it && it.bonusBaseName || '').trim() || String(it && it.name || '').replace(BONUS_MARK, '').trim();
  const isAdmission = it => ADMISSION.has(lower(nameOf(it)));
  function paid(it) {
    const qty = Math.max(1, Math.floor(Number(it && it.qty || 1)));
    const price = Math.max(0, Number(it && it.price || 0));
    const amount = qty * price;
    const method = String(it && it.method || '');
    if (amount > 0 && method !== 'cash' && method !== 'transfer') return null;
    return { qty, price, amount };
  }
  const validCost = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0;
  function catalog() {
    const c = cap.catalog && cap.catalog.products;
    if (Array.isArray(c) && c.length) return c;
    try { return Array.isArray(db.products) ? db.products : []; } catch (_) { return []; }
  }
  function pIndex() {
    const byId = new Map(), byName = new Map();
    for (const p of catalog()) {
      if (!p) continue;
      if (p.id != null) byId.set(String(p.id), p);
      const n = lower(p.name);
      if (n && !byName.has(n)) byName.set(n, p);
    }
    return { byId, byName };
  }
  const findProduct = (idx, id, name) => (id != null && idx.byId.get(String(id))) || idx.byName.get(lower(name)) || null;
  function costOf(it, idx) {
    if (validCost(it && it.costPrice)) return Number(it.costPrice);
    const p = findProduct(idx, it && it.productId, nameOf(it));
    return p && validCost(p.costPrice) ? Number(p.costPrice) : null;
  }
  const haveCosts = () => catalog().some(p => p && validCost(p.costPrice));
  /* a closed catalogue with prices is needed for the admin; others see what reports carry */
  function needCatalog() { return role() === 'admin' && !haveCosts() && !fresh('catalog', 300000); }
  function reportDayOf(r) { return dayKey(r && (r.shiftStartAt || r.shiftDate || r.closedAt)); }
  function dayAssigner(reports) {
    // the two-day report module's one-time correction: the first stored 09.11 report belongs to 08.11
    const over = new Map();
    const nov9 = reports.filter(r => reportDayOf(r) === '2026-11-09').slice()
      .sort((a, b) => new Date(a.closedAt || a.shiftStartAt || 0) - new Date(b.closedAt || b.shiftStartAt || 0));
    if (!reports.some(r => reportDayOf(r) === '2026-11-08') && nov9.length) over.set(nov9[0], '2026-11-08');
    return r => over.get(r) || reportDayOf(r);
  }
  function liveShift() {
    try {
      if (!shiftState || !shiftState.isOpen || !shiftState.openedAt) return null;
      const clients = typeof currentShiftClients === 'function' ? currentShiftClients() : [];
      return { day: dayKey(shiftState.openedAt), openedAt: shiftState.openedAt, clients: Array.isArray(clients) ? clients : [], active: (clients || []).filter(c => c && c.status === 'active').length };
    } catch (_) { return null; }
  }

  /* =====================================================================
     1 · ЕЖЕДНЕВНЫЙ ОТЧЁТ · «Касса-маржа»
     ===================================================================== */
  const RP = { modal: null, panel: null, open: false, day: '', tog: '', openedAt: 0, rendered: false, fallbackT: 0, busyT: 0, model: null };

  function rpModelFor(day, ctx) {
    const m = { day, reports: [], live: null, entry: 0, products: 0, total: 0, guests: 0, pending: 0, bonus: 0, rows: [], shifts: [], receipts: [], cost: 0, costRev: 0, profit: 0, missQty: 0 };
    const items = new Map();
    const add = (clients, isLive, sink) => {
      for (const c of clients || []) {
        for (const it of (Array.isArray(c && c.items) ? c.items : [])) {
          const bz = bonusPaidOf(it);
          m.bonus += bz;
          const p = paid(it);
          if (!p) { if (isLive) m.pending += Math.max(0, Number(it.price || 0)) * Math.max(1, Math.floor(Number(it.qty || 1))); continue; }
          if (isAdmission(it)) { m.entry += p.amount; if (sink) sink.entry += p.amount; continue; }
          // a product given for bonus brings no money, but it left the shelf: its purchase price is a real cost
          if (p.amount <= 0 && !bz) continue;
          m.products += p.amount;
          if (sink) sink.products += p.amount;
          const prod = findProduct(ctx.idx, it.productId, nameOf(it));
          const key = prod ? 'id:' + prod.id : 'n:' + lower(nameOf(it));
          const row = items.get(key) || { name: String((prod && prod.name) || nameOf(it) || 'Товар').trim() || 'Товар', qty: 0, rev: 0, cost: 0, costRev: 0, missQty: 0, bonus: 0 };
          row.qty += p.qty;
          row.rev += p.amount;
          row.bonus += bz;
          const cost = costOf(it, ctx.idx);
          if (cost != null) { row.cost += cost * p.qty; row.costRev += p.amount; } else row.missQty += p.qty;
          items.set(key, row);
        }
      }
    };
    for (const r of ctx.reports) {
      if (ctx.dayOf(r) !== day) continue;
      m.reports.push(r);
      m.guests += Number(r.clientCount || (Array.isArray(r.clients) ? r.clients.length : 0)) || 0;
      const one = { entry: 0, products: 0, closedAt: r.closedAt };
      add(r.clients, false, one);
      m.shifts.push(one);
    }
    if (ctx.live && ctx.live.day === day) {
      m.live = ctx.live;
      m.guests += ctx.live.clients.length;
      add(ctx.live.clients, true, null);
    }
    m.total = m.entry + m.products;
    m.rows = [...items.values()].sort((a, b) => b.rev - a.rev || b.qty - a.qty);
    m.known = 0;
    for (const r of m.rows) { m.cost += r.cost; m.costRev += r.costRev; m.missQty += r.missQty; m.known += r.qty - r.missQty; }
    m.profit = m.costRev - m.cost;
    m.shifts.sort((a, b) => new Date(a.closedAt) - new Date(b.closedAt));
    m.receipts = ctx.audit.filter(e => e && e.action === 'stock_receipt' && dayKey(e.createdAt) === day)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return m;
  }
  function rpModel() {
    const reports = cap.reports && Array.isArray(cap.reports.reports) ? cap.reports.reports : [];
    const audit = cap.audit && Array.isArray(cap.audit.events) ? cap.audit.events : [];
    const ctx = { reports, audit, idx: pIndex(), dayOf: dayAssigner(reports), live: liveShift() };
    const end = RP.day || dayKey();
    const start = moveDay(end, -1);
    const today = dayKey();
    const a = rpModelFor(start, ctx), b = rpModelFor(end, ctx);
    a.label = end === today ? 'Вчера' : dayShort(start);
    b.label = end === today ? 'Сегодня' : dayShort(end);
    a.kick = end === today ? 'Вчера' : weekday(start);
    b.kick = end === today ? 'Сегодня' : weekday(end);
    a.chip = end === today ? `Вчера · ${dayShort(start)}` : `${weekday(start, true)} · ${dayShort(start)}`;
    b.chip = end === today ? `Сегодня · ${dayShort(end)}` : `${weekday(end, true)} · ${dayShort(end)}`;
    b.isToday = end === today;
    return { a, b, today, auditOk: !!cap.audit };
  }
  function rpRange(start, end) {
    const pa = start.split('-').map(Number), pb = end.split('-').map(Number);
    return pa[1] === pb[1] ? `${pa[2]}–${pb[2]} ${MONTHS_G[pb[1] - 1]}` : `${dayShort(start)} – ${dayShort(end)}`;
  }

  function rpShell() {
    const el = document.createElement('div');
    el.id = 'poRp';
    el.className = 'po-in in-screen';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'poRpTitle');
    el.innerHTML = `
      <div class="in-scroll">
        <div class="in-wrap">
          <div class="in-bar">
            <button type="button" class="in-back" data-rp="back">${svg(ICON.back)}<span data-rp="backl">Брифинг</span></button>
            <label class="in-chip on rp-date">${svg(ICON.cal)}<span data-rp="range">—</span><input type="date" data-rp="date" aria-label="Дата отчёта"></label>
          </div>
          <header class="in-head" data-in="1"><span class="in-kick">Пар Ордо · отчёт · 2 дня</span><h1 class="in-h1" id="poRpTitle">Ежедневный отчёт</h1><p class="in-sub">Входы, продажи, закуп и чистая прибыль — вчера и сегодня рядом.</p><div class="in-rule" data-grow></div></header>
          <div class="rp-body" data-rp="body"></div>
          <button type="button" class="in-refresh" data-rp="refresh" data-in="40">${svg(ICON.refresh)}<span>Обновить отчёт</span></button>
        </div>
      </div>`;
    $('[data-rp=back]', el).addEventListener('click', () => {
      const close = $('#poirClose');
      if (close) close.click();
      else if (RP.modal) { RP.modal.classList.remove('is-open'); document.body.style.overflow = ''; }
    });
    $('[data-rp=date]', el).addEventListener('change', e => {
      const v = e.target.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
      RP.day = v;
      RP.tog = '';
      const orig = $('#poInlineReportDate');
      if (orig && orig.value !== v) { orig.value = v; orig.dispatchEvent(new Event('change', { bubbles: true })); }
      rpRender(false);
    });
    $('[data-rp=refresh]', el).addEventListener('click', rpRefresh);
    return el;
  }
  function rpRefresh() {
    const btn = RP.panel && $('[data-rp=refresh]', RP.panel);
    if (btn) btn.classList.add('busy');
    clearTimeout(RP.busyT);
    const since = Date.now();
    const orig = $('#poirRefresh');
    if (orig) orig.click();
    // if the app's modules did not fetch, fetch here
    setTimeout(() => {
      if ((cap.at.reports || 0) >= since) return;
      Promise.allSettled([getJson('/api/admin/control/reports'), getJson('/api/admin/audit?limit=200')]).then(r => {
        if (r[0].status === 'rejected') rpError(r[0].reason);
      });
    }, 1800);
    RP.busyT = setTimeout(() => btn && btn.classList.remove('busy'), 6000);
  }
  function rpError(err) {
    if (!RP.open || !RP.panel) return;
    const btn = $('[data-rp=refresh]', RP.panel);
    if (btn) btn.classList.remove('busy');
    if (RP.rendered) return;
    rpUnwait();
    $('[data-rp=body]', RP.panel).innerHTML = `<div class="in-err" data-in="2">Не удалось загрузить отчёты за два дня: ${esc((err && err.message) || 'ошибка API')}</div>`;
  }

  function rpCol(m, now) {
    const has = m.reports.length || m.live;
    let total, cap1, tag;
    if (!has) {
      total = '<div class="rp-tot wait">ожидается</div>';
      cap1 = m.isToday ? 'смена ещё не закрыта' : 'закрытых смен нет';
      tag = '';
    } else {
      total = `<div class="rp-tot" data-rp-n="${m.total}">${num(m.total)}</div>`;
      if (m.live) {
        cap1 = `сом на ${timeOf(Date.now())}`;
        tag = `<span class="rp-tag live"><i></i>смена идёт · ${m.live.active} ${plural(m.live.active, 'гость', 'гостя', 'гостей')} в бане</span>`;
      } else {
        cap1 = 'сом за день';
        tag = `<span class="rp-tag">${m.guests} ${plural(m.guests, 'гость', 'гостя', 'гостей')}</span>`;
      }
    }
    return `<div class="rp-col${now ? ' now' : ''}"><span class="rp-day">${esc(m.kick || m.label)}</span><div class="rp-date2">${esc(dayLong(m.day))}</div>${total}<span class="rp-cap">${esc(cap1)}</span>${tag}</div>`;
  }
  function rpCell(v, cls, m, kind) {
    if (!m.reports.length && !m.live) return `<b class="tn${cls}">—</b>`;
    if (kind === 'cost' || kind === 'prof') {
      if (!m.products && !m.rows.length) return `<b class="tn${cls}">0</b>`;
      if (!m.known) return `<b class="tn${cls}">—</b>`;
      const star = m.missQty ? '<small>*</small>' : '';
      return `<b class="tn${cls}">${kind === 'prof' ? sgn(v) : num(v)}${star}</b>`;
    }
    return `<b class="tn${cls}">${num(v)}</b>`;
  }
  function rpRow(label, kind, a, b, va, vb) {
    const max = Math.max(Math.abs(va), Math.abs(vb), 1);
    const w = v => Math.max(0, Math.min(100, Math.round(Math.abs(v) / max * 100)));
    const cls = kind === 'cost' ? ' cost' : kind === 'prof' ? ' prof' : kind === 'bonus' ? ' bon' : '';
    return `<div class="rp-row${cls}"><span>${label}</span>${rpCell(va, '', a, kind)}${rpCell(vb, ' now', b, kind)}<span class="rp-pair" aria-hidden="true"><i class="y"><b style="width:${w(va)}%" data-grow></b></i><i class="t"><b style="width:${w(vb)}%" data-grow></b></i></span></div>`;
  }
  function rpMissing(S) {
    const miss = new Map();
    for (const m of [S.a, S.b]) for (const r of m.rows) if (r.missQty) miss.set(r.name, (miss.get(r.name) || 0) + r.missQty);
    if (!miss.size) return '';
    const total = [...miss.values()].reduce((s, v) => s + v, 0);
    const hint = role() === 'admin'
      ? 'Укажите закупочную цену в «Товары и склад» — прибыль пересчитается.'
      : 'Закупочные цены задаёт администратор в «Товары и склад».';
    const list = [...miss.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([n, q]) => `<li>${esc(n)} — ${q} шт.</li>`).join('');
    return `<div class="in-warn" data-in="4"><b>* Без закупочной цены: ${total} шт.</b> Эти продажи не входят в закуп и прибыль.<ul>${list}</ul><div style="margin-top:6px">${hint}</div></div>`;
  }
  function rpDayParts(S) {
    const m = RP.tog === 'a' ? S.a : S.b;
    const label = m.label.toLowerCase();
    // Касса-маржа
    let wf;
    const bonusNote = m.bonus ? `<p class="rp-basis rp-bn">🎁 Бонусом 3% оплачено ${num(m.bonus)} сом — эти товары ушли без выручки, их закуп учтён в прибыли.</p>` : '';
    if (!m.reports.length && !m.live) wf = `<div class="in-empty"><b>${esc(m.label)}</b>: отчёта пока нет.</div>`;
    else if (!m.products && !m.rows.length) wf = `<div class="in-empty">Продаж товаров за ${esc(label === 'вчера' || label === 'сегодня' ? label : dayShort(m.day))} нет.</div>`;
    else if (!m.known) {
      wf = `<section class="in-card rp-wf"><div class="rp-wfm"><span><span class="in-kick">Чистая прибыль</span><b class="na">не рассчитана</b></span></div><p class="rp-basis">У проданных товаров нет закупочной цены. Продано на ${num(m.products)} сом.</p>${bonusNote}</section>`;
    } else {
      const ratio = m.costRev > 0 ? m.cost / m.costRev * 100 : (m.cost > 0 ? 100 : 0);
      const hc = Math.max(2, Math.min(100, Math.round(ratio)));
      const hp = Math.max(2, Math.min(100, Math.round(100 - ratio)));
      // each number sits right at the end of its own bar; a tall bar carries it inside
      const IN = 84;
      const labC = hc > IN ? `<span class="lab in" style="top:calc(${hc}% - 25px)">` : `<span class="lab" style="top:calc(${hc}% + 6px)">`;
      const labP = hp > IN ? `<span class="lab in" style="bottom:calc(${hp}% - 25px)">` : `<span class="lab" style="bottom:calc(${hp}% + 6px)">`;
      const basis = m.missQty ? `<p class="rp-basis">По товарам с закупочной ценой: ${num(m.costRev)} из ${num(m.products)} сом выручки.</p>` : '';
      wf = `<section class="in-card rp-wf" aria-label="Продажа минус закуп равно прибыль">
        <div class="rp-wfm"><span><span class="in-kick">Чистая прибыль · ${esc(label)}</span><b>${sgn(m.profit)} сом</b></span><em>маржа ${pct(m.profit, m.costRev)}%</em></div>
        <div class="rp-plot">
          <div class="rp-c s"><span class="wb" style="height:100%" data-rise></span><span class="lab">${num(m.costRev)}</span></div>
          <div class="rp-c c"><span class="wb" style="height:${hc}%" data-rise="50% 0"></span>${labC}−${num(m.cost)}</span></div>
          <div class="rp-c p"><span class="wb" style="height:${hp}%" data-rise></span>${labP}${sgn(m.profit)}</span></div>
        </div>
        <div class="rp-x"><span>Продажа</span><span>Закуп</span><span>Прибыль</span></div>${basis}${bonusNote}
      </section>`;
    }
    // по товарам
    let goods = '';
    if (m.rows.length) {
      goods = '<div class="rp-mg">' + m.rows.map(r => {
        const unit = r.qty ? Math.round(r.rev / r.qty) : 0;
        const bn = r.bonus ? ` · 🎁 бонус ${num(r.bonus)}` : '';
        if (r.missQty && !r.costRev && r.qty === r.missQty) {
          return `<div class="rp-it"><div class="rp-itop"><b>${esc(r.name)} × ${r.qty}</b><em class="na">нет закупа</em></div><div class="rp-mbar"><i class="na">закупочная цена не указана</i></div><div class="rp-meta"><span>цена ${num(unit)} сом · выручка ${num(r.rev)}${bn}</span><span>прибыль <b class="na">—</b></span></div></div>`;
        }
        const costUnit = r.qty - r.missQty > 0 ? r.cost / (r.qty - r.missQty) : 0;
        const pr = r.costRev - r.cost;
        if (r.rev <= 0 && r.bonus) {
          // all of it went for bonus: no money, only the purchase price
          return `<div class="rp-it rp-itb"><div class="rp-itop"><b>${esc(r.name)} × ${r.qty}</b><em class="bn">за бонус</em></div><div class="rp-mbar"><i class="b" style="width:100%">🎁 оплачено бонусом ${num(r.bonus)} сом</i></div><div class="rp-meta"><span>выручка 0 · закуп ${num(r.cost)}</span><span>прибыль <b class="neg">${sgn(pr)}</b></span></div></div>`;
        }
        const cw = Math.max(8, Math.min(92, r.costRev > 0 ? pct(r.cost, r.costRev) : 92));
        const star = r.missQty ? `<em class="na">${r.missQty} шт. без закупа</em>` : `<em${pr < 0 ? ' class="neg"' : ''}>${pct(pr, r.costRev)}%</em>`;
        return `<div class="rp-it"><div class="rp-itop"><b>${esc(r.name)} × ${r.qty}</b>${star}</div><div class="rp-mbar"><i class="c" style="width:${cw}%">закуп ${num(costUnit)}</i><i class="p${unit - costUnit < 0 ? ' neg' : ''}" style="width:${100 - cw}%">${sgn(unit - costUnit)}</i></div><div class="rp-meta"><span>цена ${num(unit)} сом · выручка ${num(r.rev)}${bn}</span><span>прибыль <b${pr < 0 ? ' class="neg"' : ''}>${sgn(pr)}</b></span></div></div>`;
      }).join('') + '</div>';
    } else goods = `<div class="in-empty">Товаров за этот день не продано.</div>`;
    // поступления
    let rc;
    if (!S.auditOk) rc = '<div class="in-empty">Поступления загружаются…</div>';
    else if (!m.receipts.length) rc = `<div class="in-empty">Поступлений за ${esc(dayShort(m.day))} нет.</div>`;
    else rc = '<div class="rp-in">' + m.receipts.map(e => {
      const d = e.details || {};
      const name = d.productName || `Товар №${e.target || '—'}`;
      const q = Math.max(0, Number(d.qty || 0));
      return `<div class="rp-rc"><span class="ic">${q}</span><span><b>${esc(name)}</b><small>${esc(timeOf(e.createdAt))} · ${esc(d.by || e.username || 'не указано')}</small></span><em>+${q}</em></div>`;
    }).join('') + '</div>';
    // смены
    const sh = m.shifts.map(s => `<div><span>Смена · закрыта ${esc(timeOf(s.closedAt))}</span><b>Входы ${num(s.entry)} · Товары ${num(s.products)}</b></div>`);
    if (m.live) sh.push(`<div class="live"><span>Смена идёт с ${esc(timeOf(m.live.openedAt))}</span><b>${num(m.entry + m.products - m.shifts.reduce((s, x) => s + x.entry + x.products, 0))} сом${m.pending ? ` · ждёт оплаты ${num(m.pending)}` : ''}</b></div>`);
    const shifts = sh.length ? `<section class="in-card rp-sh">${sh.join('')}</section>` : '';
    const rcQty = m.receipts.reduce((s, e) => s + Math.max(0, Number((e.details || {}).qty || 0)), 0);
    return `
      <section class="rp-day-part" data-rp="dayp">
        <div class="in-sec" data-in="6"><h2>Касса-маржа</h2><i data-grow></i><em>товары за день</em></div>
        <div class="in-tog" data-in="7" role="group" aria-label="День"><button type="button" class="in-chip${RP.tog === 'a' ? ' on' : ''}" data-rp-tog="a" aria-pressed="${RP.tog === 'a'}">${esc(S.a.chip)}</button><button type="button" class="in-chip${RP.tog === 'b' ? ' on' : ''}" data-rp-tog="b" aria-pressed="${RP.tog === 'b'}">${esc(S.b.chip)}</button></div>
        <div data-in="8">${wf}</div>
        <div class="in-sec" data-in="9"><h2>По товарам</h2><i data-grow></i><em>закуп | цена | прибыль</em></div>
        <div data-in="10">${goods}</div>
        <div class="in-sec" data-in="11"><h2>Поступления</h2><i data-grow></i><em>${m.receipts.length ? `+${rcQty} шт. на склад` : 'товары на склад'}</em></div>
        <div data-in="12">${rc}</div>
        ${shifts ? `<div class="in-sec" data-in="13"><h2>Смены</h2><i data-grow></i><em>${esc(dayShort(m.day))}</em></div><div data-in="14">${shifts}</div>` : ''}
      </section>`;
  }
  function rpBody(S) {
    const a = S.a, b = S.b;
    return `
      <section class="in-card rp-cmp" data-in="2" aria-label="Сравнение двух дней">${rpCol(a, false)}${rpCol(b, true)}</section>
      <section class="in-card rp-tbl" data-in="3">
        <div class="rp-hd"><span>Показатель</span><span>${esc(a.label)}</span><span>${esc(b.label)}</span></div>
        <div class="rp-rows">
          ${rpRow('Доход от входов', '', a, b, a.entry, b.entry)}
          ${rpRow('Продажи товаров', '', a, b, a.products, b.products)}
          ${rpRow('Закуп проданного', 'cost', a, b, a.cost, b.cost)}
          ${rpRow('Чистая прибыль с товаров', 'prof', a, b, a.profit, b.profit)}
          ${a.bonus || b.bonus ? rpRow('Оплачено бонусом 3%', 'bonus', a, b, a.bonus, b.bonus) : ''}
        </div>
      </section>
      ${rpMissing(S)}
      ${rpDayParts(S)}`;
  }
  function rpBind(scope) {
    $$('[data-rp-tog]', scope).forEach(btn => btn.addEventListener('click', () => {
      const t = btn.dataset.rpTog;
      if (t === RP.tog) return;
      RP.tog = t;
      const part = $('[data-rp=dayp]', RP.panel);
      if (!part || !RP.model) return;
      const tmp = document.createElement('div');
      tmp.innerHTML = rpDayParts(RP.model);
      const next = tmp.firstElementChild;
      part.replaceWith(next);
      rpBind(next);
      assemble(next, false, 'rp');
    }));
  }
  function rpHeader() {
    if (!RP.panel) return;
    const end = RP.day || dayKey();
    $('[data-rp=backl]', RP.panel).textContent = backLabel();
    $('[data-rp=range]', RP.panel).textContent = rpRange(moveDay(end, -1), end);
    const input = $('[data-rp=date]', RP.panel);
    if (input.value !== end) input.value = end;
  }
  function rpRender(withIntro) {
    if (!RP.open || !RP.panel) return;
    try {
      const S = rpModel();
      RP.model = S;
      if (!RP.tog) RP.tog = S.b.products > 0 ? 'b' : (S.a.products > 0 ? 'a' : 'b');
      const body = $('[data-rp=body]', RP.panel);
      const scroller = $('.in-scroll', RP.panel);
      const keep = RP.rendered ? scroller.scrollTop : 0;
      body.innerHTML = rpBody(S);
      rpBind(body);
      rpHeader();
      const btn = $('[data-rp=refresh]', RP.panel);
      if (btn) { btn.classList.remove('busy'); clearTimeout(RP.busyT); }
      const first = !RP.rendered;
      RP.rendered = true;
      rpUnwait();
      if (!first) { scroller.scrollTop = keep; return; }
      const wrap = $('.in-wrap', RP.panel);
      if (withIntro && motion && !store.get(SEEN.rp)) {
        store.set(SEEN.rp, '1');
        rpIntro(S, wrap);
      } else assemble(wrap, false, 'rp');
    } catch (e) {
      log('report render', e);
      rpFallback();
    }
  }
  function rpFallback() {
    if (RP.modal) RP.modal.classList.remove('po-rp-on');
  }
  function rpIntro(S, wrap) {
    const m = RP.tog === 'a' ? S.a : S.b;
    const split = m.products > 0 && m.costRev > 0;
    const page = (side, d) => {
      const has = d.reports.length || d.live;
      return `<div class="rp-pg ${side}"><small>${esc((d.kick || d.label).toUpperCase())} · ${esc(dayShort(d.day))}</small><b>Пар Ордо</b><strong>${has ? num(d.total) : '—'}</strong><p>${has ? (d.live ? 'сом · смена идёт' : `сом за день · ${d.guests} ${plural(d.guests, 'гость', 'гостя', 'гостей')}`) : 'отчёт ожидается'}</p><i></i><i style="width:80%"></i><i style="width:62%"></i></div>`;
    };
    const total = split ? 3200 : 1900;
    const html = page('l', S.a) + page('r', S.b) + '<div class="rp-vs">VS</div>' + (split
      ? `<div class="rp-sp s">${num(m.costRev)}<small>${m.missQty ? 'ТОВАРЫ С ЗАКУПОМ' : 'ПРОДАЖИ ТОВАРОВ'} · ${esc(m.label.toUpperCase())}</small></div><div class="rp-sp p">${sgn(m.profit)}<small>ЧИСТАЯ ПРИБЫЛЬ</small></div><div class="rp-sp c">−${num(m.cost)}<small>ЗАКУП</small></div>`
      : `<div class="in-cap" style="top:500px"><span>ЕЖЕДНЕВНЫЙ ОТЧЁТ</span><b>Два дня рядом</b></div>`);
    const it = intro(RP.panel, html, total, 'rpi', $('.in-scroll', RP.panel));
    const q = s => $(s, it.el);
    A(q('.rp-pg.l'), [{ transform: 'translateX(-120%) rotate(-8deg)' }, { transform: 'none' }], { duration: 620, delay: 40, easing: EASE.slam }, 'rpi');
    A(q('.rp-pg.r'), [{ transform: 'translateX(120%) rotate(8deg)' }, { transform: 'none' }], { duration: 620, delay: 150, easing: EASE.slam }, 'rpi');
    A(it.el, [{ transform: 'none' }, { transform: 'translate(-3px,2px)' }, { transform: 'translate(3px,-2px)' }, { transform: 'translate(-2px,1px)' }, { transform: 'none' }], { duration: 240, delay: 700, easing: 'linear', fill: 'none' }, 'rpi');
    A(q('.rp-vs'), [{ transform: 'scale(0) rotate(-90deg)' }, { transform: 'none' }], { duration: 460, delay: 680, easing: EASE.back }, 'rpi');
    const off = { duration: 460, delay: 1050, easing: EASE.io, fill: 'forwards' };
    A(q('.rp-pg.l'), [{ transform: 'none', opacity: 1 }, { transform: 'translate(-30px,-150px) scale(.5)', opacity: 0 }], off, 'rpi');
    A(q('.rp-pg.r'), [{ transform: 'none', opacity: 1 }, { transform: 'translate(30px,-150px) scale(.5)', opacity: 0 }], off, 'rpi');
    A(q('.rp-vs'), [{ opacity: 1 }, { opacity: 0 }], { duration: 200, delay: 1000, fill: 'forwards' }, 'rpi');
    if (split) {
      A(q('.rp-sp.s'), [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 450, delay: 1200, easing: EASE.out }, 'rpi');
      A(q('.rp-sp.s'), [{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'scale(1.15)', filter: 'blur(6px)' }], { duration: 360, delay: 1800, easing: EASE.in, fill: 'forwards' }, 'rpi');
      A(q('.rp-sp.c'), [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(180px) rotate(8deg)' }], { duration: 760, delay: 1950, easing: EASE.in, fill: 'forwards' }, 'rpi');
      A(q('.rp-sp.p'), [{ opacity: 1, transform: 'translateY(60px) scale(.7)' }, { opacity: 1, transform: 'translateY(-10px) scale(1)' }], { duration: 820, delay: 1950, easing: EASE.out, fill: 'forwards' }, 'rpi');
      A(it.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 2780, fill: 'forwards' }, 'rpi');
    } else {
      A(q('.in-cap'), [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 600, easing: EASE.out }, 'rpi');
      A(it.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 400, delay: 1500, fill: 'forwards' }, 'rpi');
    }
    assemble(wrap, true, 'rp', split ? 2750 : 1450);
    it.promise.then(skipped => { if (skipped) { stop('rp'); assemble(wrap, false, 'rp'); } });
  }
  function rpWaitData() {
    clearTimeout(RP.fallbackT);
    RP.fallbackT = setTimeout(() => {
      if (!RP.open || fresh('reports', 60000)) return;
      Promise.allSettled([getJson('/api/admin/control/reports'), fresh('audit', 60000) ? null : getJson('/api/admin/audit?limit=200')]).then(r => {
        if (r[0].status === 'rejected' && !fresh('reports', 60000)) rpError(r[0].reason);
      });
    }, 1800);
  }
  function rpOpen() {
    RP.open = true;
    RP.openedAt = performance.now();
    RP.rendered = false;
    RP.tog = '';
    if (!RP.panel || !RP.panel.isConnected) { RP.panel = rpShell(); RP.modal.appendChild(RP.panel); }
    RP.modal.classList.add('po-rp-on');
    const orig = $('#poInlineReportDate');
    RP.day = (orig && /^\d{4}-\d{2}-\d{2}$/.test(orig.value)) ? orig.value : dayKey();
    rpHeader();
    $('[data-rp=body]', RP.panel).innerHTML = '<div class="in-skel" data-in="2"></div><div class="in-skel" data-in="3" style="height:190px"></div>';
    $('.in-scroll', RP.panel).scrollTop = 0;
    // load the fonts early; the opening needs them
    try { if (document.fonts && document.fonts.load) ['700 16px "PO Serif"', '700 16px "PO Inter Display"', '700 16px "PO Mono"'].forEach(f => document.fonts.load(f)); } catch (_) {}
    if (fresh('reports', 60000)) rpRender(true);
    else {
      if (motion && !store.get(SEEN.rp)) {
        const wait = document.createElement('div');
        wait.className = 'in-intro rp-wait';
        wait.setAttribute('aria-hidden', 'true');
        wait.innerHTML = '<div class="in-cap" style="top:46%"><span>ЕЖЕДНЕВНЫЙ ОТЧЁТ</span></div>';
        RP.panel.appendChild(wait);
        A($('.in-cap', wait), [{ opacity: .25 }, { opacity: 1 }, { opacity: .25 }], { duration: 1400, iterations: Infinity, easing: 'ease-in-out' }, 'rpw');
        RP.waitT = setTimeout(rpUnwait, 2700);
      }
      rpWaitData();
    }
  }
  function rpUnwait() {
    clearTimeout(RP.waitT);
    stop('rpw');
    const w = RP.panel && $('.rp-wait', RP.panel);
    if (w) w.remove();
  }
  function rpClose() {
    RP.open = false;
    rpUnwait();
    clearTimeout(RP.fallbackT);
    stop('rpi');
    stop('rp');
    if (RP.panel) { const it = $('.in-intro', RP.panel); if (it) it.remove(); $('.in-scroll', RP.panel).classList.remove('in-lock'); }
    if (RP.modal) RP.modal.classList.remove('po-rp-on');
  }
  function rpSync() {
    if (!RP.modal) return;
    const open = RP.modal.classList.contains('is-open');
    if (open && !RP.open) { try { rpOpen(); } catch (e) { log('report open', e); rpFallback(); } }
    else if (!open && RP.open) rpClose();
  }
  function rpAttach() {
    const m = $('#poInlineDailyReportModal');
    if (!m || m === RP.modal) return !!m;
    RP.modal = m;
    new MutationObserver(rpSync).observe(m, { attributes: true, attributeFilter: ['class'] });
    rpSync();
    return true;
  }
  subs.add(key => {
    if (!RP.open) return;
    if (key === 'reports') rpRender(performance.now() - RP.openedAt < 2600);
    else if ((key === 'audit' || key === 'catalog') && RP.rendered) rpRender(false);
  });

  /* =====================================================================
     2 · БАЗА КЛИЕНТОВ · «Клуб · бонус 3%»
     ===================================================================== */
  const CL = { orig: {}, amt: 1000, open: false, openIds: new Set(), introCard: null };
  /* the account comes from par-ordo-bonus-v1.js (earned − spent on bracelets); without it — earned only */
  function accOf(c) {
    try { if (window.PARORDOBonus && typeof window.PARORDOBonus.account === 'function') return window.PARORDOBonus.account(c); } catch (_) {}
    const earned = Math.floor(Math.max(0, Number(c && c.totalSpent || 0)) * BONUS_RATE);
    return { earned, used: 0, available: earned, ready: true };
  }
  const bonusOf = c => accOf(c).available;
  const clEntries = () => { try { return Array.isArray(customerBaseEntries) ? customerBaseEntries : []; } catch (_) { return []; } };
  const clSummary = () => { try { return customerBaseSummary || null; } catch (_) { return null; } };
  const clLoaded = () => { try { return !!customerBaseLoaded; } catch (_) { return false; } };
  const clTab = () => { try { return customerBaseTab; } catch (_) { return 'clients'; } };
  const clActive = () => { const m = $('#customerBaseModal'); return !!(m && m.classList.contains('po-cl')); };
  const AMTS = [500, 1000, 2500, 5000];

  function clCardHtml(n, attr) {
    const year = new Date().getFullYear();
    return `<div class="cl-card"${attr || ''}><span class="brand">ПАР ОРДО · CLUB</span><i class="chipc"></i><span class="num" data-cl="num">${n == null ? '0000' : String(n).padStart(4, '0')} · ${year}</span><span class="who">ЧЛЕНЫ КЛУБА</span><span class="big"><b data-cl="n">${n == null ? '—' : num(n)}</b><small>КЛИЕНТОВ</small></span><span class="rate">БОНУС 3%</span></div>`;
  }
  function clDecorate() {
    const modal = $('#customerBaseModal'), card = $('#customerBaseModalCard');
    if (!modal || !card || $('.cl-top', card)) return;
    modal.classList.add('po-cl');
    card.classList.add('po-in', 'in-screen');
    const form = $('#customerBaseForm', card);
    const tabs = $('.customer-base-tabs', card);
    const list = $('#customerBaseList', card);
    const canReg = !!form && !form.classList.contains('hidden');
    const top = document.createElement('div');
    top.className = 'cl-top';
    top.innerHTML = `
      <div class="in-bar"><button type="button" class="in-back" data-cl="back">${svg(ICON.back)}<span>${esc(backLabel())}</span></button><button type="button" class="in-chip" data-cl="find">${svg(ICON.search)}Поиск</button></div>
      <header class="in-head" data-in="1"><span class="in-kick">Пар Ордо · клуб гостей</span><h1 class="in-h1">База клиентов</h1></header>
      <div data-in="2" data-cl="cardwrap">${clCardHtml(null, ' data-cl="card"')}</div>
      <div class="cl-tiers" data-in="3">
        <div class="cl-tier a"><b data-cl="t1">—</b><small>сом бонусов на счетах</small></div>
        <div class="cl-tier b"><b data-cl="t2">—</b><small>посещений всего</small></div>
        <div class="cl-tier c"><b data-cl="t3">—</b><small>сом покупок клиентов</small></div>
      </div>
      <section class="in-card cl-rule" data-in="4"><span class="in-kick">Как копится бонус</span>
        <p>С <b>любой суммы</b> покупки — <b>3%</b> на бонусный счёт гостя. Без минимума, с каждого визита. Потратить — на браслете: <b>«🎁 Оплатить бонусом»</b> у товара или входа, остаток копится дальше.</p>
        <div class="cl-amts" role="group" aria-label="Сумма чека">${AMTS.map(v => `<button type="button" class="in-chip${v === CL.amt ? ' on' : ''}" data-cl-amt="${v}" aria-pressed="${v === CL.amt}">${num(v)}</button>`).join('')}</div>
        <div class="cl-calc" aria-live="polite"><span class="cl-coin" aria-hidden="true">3%</span><span><span class="q" data-cl="q"></span><span class="r" data-cl="r"></span></span></div>
      </section>
      ${canReg ? `<button type="button" class="cl-reg" data-cl="reg" aria-expanded="false" data-in="5">${svg(ICON.plus)}<span>Зарегистрировать клиента</span></button>` : ''}`;
    card.insertBefore(top, form || $('#customerBaseOverview', card) || tabs || card.firstChild);
    if (form) form.classList.add('cl-closed');
    if (tabs) {
      const sec = document.createElement('div');
      sec.className = 'in-sec cl-sec';
      sec.setAttribute('data-in', '6');
      sec.innerHTML = '<h2>Бонусный счёт</h2><i></i><em>доступно, сом</em>';
      card.insertBefore(sec, tabs);
      const t1 = $('[data-customer-base-tab="clients"]', tabs), t2 = $('[data-customer-base-tab="bonuses"]', tabs);
      if (t1) t1.textContent = 'Все клиенты';
      if (t2) t2.textContent = 'Топ по бонусу';
    }
    if (list) {
      const foot = document.createElement('p');
      foot.className = 'in-note cl-foot';
      foot.textContent = 'Бонус — 3% от всех оплаченных покупок гостя (входы и товары) минус то, что уже оплачено бонусом на браслетах.';
      list.insertAdjacentElement('afterend', foot);
    }
    $('[data-cl=back]', top).addEventListener('click', () => { const c = $('#closeCustomerBase'); if (c) c.click(); else call('closeModal', '#customerBaseModal'); });
    $('[data-cl=find]', top).addEventListener('click', () => {
      const s = $('#customerBaseSearch');
      if (!s) return;
      try { s.scrollIntoView({ block: 'center', behavior: motion ? 'smooth' : 'auto' }); } catch (_) {}
      setTimeout(() => { try { s.focus({ preventScroll: true }); } catch (_) { s.focus(); } }, motion ? 320 : 0);
    });
    $$('[data-cl-amt]', top).forEach(b => b.addEventListener('click', () => { CL.amt = Number(b.dataset.clAmt) || 1000; clCalc(); }));
    const reg = $('[data-cl=reg]', top);
    if (reg) reg.addEventListener('click', () => clForm(!(form && !form.classList.contains('cl-closed')), true));
    clCalc();
    clOverview();
  }
  function clCalc() {
    const card = $('#customerBaseModalCard');
    if (!card) return;
    $$('[data-cl-amt]', card).forEach(b => { const on = Number(b.dataset.clAmt) === CL.amt; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const q = $('[data-cl=q]', card), r = $('[data-cl=r]', card);
    if (q) q.textContent = `Чек ${num(CL.amt)} сом → на бонусный счёт`;
    if (r) r.textContent = `+${num(Math.floor(CL.amt * BONUS_RATE))} сом`;
  }
  function clForm(open, focus) {
    const form = $('#customerBaseForm'), reg = $('#customerBaseModalCard [data-cl=reg]');
    if (!form) return;
    form.classList.toggle('cl-closed', !open);
    if (reg) reg.setAttribute('aria-expanded', String(!!open));
    if (open && focus) {
      try { form.scrollIntoView({ block: 'start', behavior: motion ? 'smooth' : 'auto' }); } catch (_) {}
      const name = $('#customerBaseName');
      if (name) setTimeout(() => { try { name.focus({ preventScroll: true }); } catch (_) {} }, motion ? 350 : 0);
    }
  }
  function clOverview() {
    const card = $('#customerBaseModalCard');
    if (!card || !clActive()) return;
    const entries = clEntries(), s = clSummary();
    if (!clLoaded() && !s && !entries.length) return;
    const count = Number((s && s.customers) ?? entries.length) || 0;
    const visits = Number(s && s.completedVisits) || entries.reduce((x, c) => x + (Number(c.visitsTotal) || 0), 0);
    const spent = Number(s && s.customerRevenue) || entries.reduce((x, c) => x + (Number(c.totalSpent) || 0), 0);
    const bonus = entries.reduce((x, c) => x + bonusOf(c), 0);
    const nEl = $('[data-cl=n]', card), numEl = $('[data-cl=num]', card);
    const first = nEl && nEl.dataset.v == null;
    if (nEl) { nEl.dataset.v = count; countTo(nEl, count, first ? 900 : 0, first ? 150 : 0); }
    if (numEl) numEl.textContent = `${String(count).padStart(4, '0')} · ${new Date().getFullYear()}`;
    [['t1', bonus], ['t2', visits], ['t3', spent]].forEach(([k, v]) => { const el = $(`[data-cl=${k}]`, card); if (el) countTo(el, v, first ? 900 : 0, first ? 250 : 0); });
    if (CL.introCard) { const b = $('[data-cl-i=n]', CL.introCard); if (b) b.textContent = num(count); const nn = $('[data-cl=num]', CL.introCard); if (nn) nn.textContent = `${String(count).padStart(4, '0')} · ${new Date().getFullYear()}`; const cap = $('[data-cl-i=cap]', CL.introCard); if (cap) cap.textContent = `${num(count)} ${plural(count, 'гость', 'гостя', 'гостей')} Пар Ордо`; }
  }
  function clRow(c, max, canEdit) {
    const id = String(c.id);
    const acc = accOf(c);
    const b = acc.available;
    const open = CL.openIds.has(id);
    const visits = Number(c.visitsTotal || 0), month = Number(c.visitsThisMonth || 0), spent = Number(c.totalSpent || 0);
    const w = max > 0 ? Math.max(b > 0 ? 3 : 0, Math.round(b / max * 100)) : 0;
    const created = (() => { try { return typeof fmtDate === 'function' ? fmtDate(c.createdAt) : ''; } catch (_) { return ''; } })();
    // the 3% account replaced «5-й вход бесплатно»; a reward that was already activated stays visible until used
    const oldLive = c.bonusActive === true && Number(c.bonusUsedThisMonth || 0) === 0;
    const sub = acc.used > 0 ? `списано ${num(acc.used)}` : (month ? `в этом месяце: ${month}` : '3% с покупок');
    return `<article class="cl-row" data-id="${esc(id)}">
      <button type="button" class="cl-rmain" aria-expanded="${open}"><span class="cl-av" aria-hidden="true">${esc((String(c.name || '?').trim()[0] || '?').toUpperCase())}</span>
        <span class="cl-rtx"><strong>${esc(c.name)}</strong><small>${visits} ${plural(visits, 'визит', 'визита', 'визитов')} · потрачено ${num(spent)} сом</small><span class="cl-bar"><i style="width:${w}%"></i></span></span>
        <span class="cl-bal${b ? '' : ' zero'}"><b>${num(b)} сом</b><em>${esc(sub)}</em></span></button>
      <div class="cl-det"${open ? '' : ' hidden'}>
        <div class="cl-kv"><span>Телефон</span><b>${c.phone ? esc(c.phone) : 'не указан'}</b></div>
        ${created ? `<div class="cl-kv"><span>Добавлен</span><b>${esc(created)}</b></div>` : ''}
        <div class="cl-kv"><span>Посещений · всего / в месяце</span><b>${visits} / ${month}</b></div>
        <div class="cl-kv"><span>Накоплено · 3% × ${num(spent)}</span><b>${num(acc.earned)} сом</b></div>
        <div class="cl-kv"><span>Оплачено бонусом</span><b>${acc.used ? '−' + num(acc.used) : '0'} сом</b></div>
        <div class="cl-kv"><span>Доступно сейчас</span><b class="g">${acc.ready === false ? '…' : num(b) + ' сом'}</b></div>
        ${c.note ? `<div class="cl-nt">${esc(c.note)}</div>` : ''}
        ${oldLive ? `<div class="cl-old"><span>Старая акция: бесплатный 5-й вход активирован — его можно применить на браслете.</span></div>` : ''}
        ${canEdit ? `<div class="cl-acts"><button type="button" data-cl-edit="${esc(id)}">✎ Изменить</button></div>` : ''}
      </div>
    </article>`;
  }
  function clList() {
    const list = $('#customerBaseList');
    if (!list) return;
    const entries = clEntries();
    const q = lower($('#customerBaseSearch') ? $('#customerBaseSearch').value : '');
    const canEdit = role() !== 'manager';
    let rows = entries.filter(c => [c.name, c.phone, c.note].some(v => lower(v).includes(q)));
    const top = clTab() === 'bonuses';
    if (top) rows = rows.filter(c => bonusOf(c) > 0).sort((a, b) => bonusOf(b) - bonusOf(a));
    const count = $('#customerBaseCount');
    if (count) count.textContent = `Клиентов в базе: ${entries.length} · найдено: ${rows.length}`;
    const max = entries.reduce((m, c) => Math.max(m, bonusOf(c)), 0);
    list.innerHTML = rows.length
      ? rows.map(c => clRow(c, max, canEdit)).join('')
      : `<div class="customer-base-empty">${top ? 'Пока ни у кого нет накопленного бонуса.<br>3% с каждой покупки появятся здесь после первых визитов.' : (entries.length ? 'Клиентов не найдено.' : 'Клиентов пока нет.<br>Нажмите «Зарегистрировать клиента», чтобы добавить первого.')}</div>`;
    list.onclick = e => {
      const edit = e.target.closest('[data-cl-edit]');
      if (edit) { call('editCustomerBaseEntry', edit.dataset.clEdit); return; }
      const bon = e.target.closest('[data-customer-bonus]');
      if (bon) { call('setCustomerBonus', bon.dataset.customerBonus, bon.dataset.bonusStatus, bon); return; }
      const main = e.target.closest('.cl-rmain');
      if (!main) return;
      const row = main.closest('.cl-row'), det = $('.cl-det', row);
      if (!row || !det) return;
      const open = det.hidden;
      det.hidden = !open;
      main.setAttribute('aria-expanded', String(open));
      if (open) { CL.openIds.add(row.dataset.id); A(det, [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE.out }, 'cl'); }
      else CL.openIds.delete(row.dataset.id);
    };
  }
  function clIntro() {
    const card = $('#customerBaseModalCard');
    const target = card && $('[data-cl=card]', card);
    if (!card || !target) return;
    const s = clSummary();
    const n = s && s.customers != null ? Number(s.customers) : (clLoaded() ? clEntries().length : null);
    const drops = [0, 1, 2, 3, 4].map(k => `<i class="cl-drop" style="left:calc(50% - 150px + ${k * 66}px)">3%</i>`).join('');
    const html = `<div class="cl-spin">${clCardHtml(n).replace('data-cl="n"', 'data-cl-i="n"')}</div>${drops}<div class="cl-plus">+3% с каждой покупки</div><div class="in-cap" style="top:560px"><span>ДОБРО ПОЖАЛОВАТЬ В КЛУБ</span><b data-cl-i="cap">${n == null ? 'Гости Пар Ордо' : `${num(n)} ${plural(n, 'гость', 'гостя', 'гостей')} Пар Ордо`}</b></div>`;
    const it = intro(card, html, 2950, 'cli', card);
    CL.introCard = it.el;
    const q = sel => $(sel, it.el);
    const spinCard = q('.cl-spin .cl-card');
    A(spinCard, [{ opacity: 0, transform: 'rotateY(-540deg) rotateX(25deg) scale(.4)' }, { opacity: 1, offset: .6 }, { opacity: 1, transform: 'none' }], { duration: 1250, delay: 80, easing: EASE.spin }, 'cli');
    A(q('.in-cap'), [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 900, easing: EASE.out }, 'cli');
    A(q('.in-cap'), [{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 1420, fill: 'forwards' }, 'cli');
    // coins drop into the card, one by one
    $$('.cl-drop', it.el).forEach((d, k) => A(d, [{ opacity: 1, transform: 'translateY(-40px) rotate(0)' }, { opacity: 1, transform: 'translateY(190px) rotate(300deg) scale(.6)', offset: .85 }, { opacity: 0, transform: 'translateY(205px) scale(.3)' }], { duration: 640, delay: 1380 + k * 85, easing: EASE.in, fill: 'forwards' }, 'cli'));
    $$('.cl-drop', it.el).forEach((d, k) => A(spinCard, [{ boxShadow: '0 24px 48px rgba(0,0,0,.6), 0 0 0 rgba(246,189,71,0)' }, { boxShadow: '0 24px 48px rgba(0,0,0,.6), 0 0 34px rgba(246,189,71,.55)' }, { boxShadow: '0 24px 48px rgba(0,0,0,.6), 0 0 0 rgba(246,189,71,0)' }], { duration: 300, delay: 1930 + k * 85, fill: 'none' }, 'cli'));
    A(q('.cl-plus'), [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 480, delay: 1500, easing: EASE.out }, 'cli');
    // the card flies into its place in the page
    setTimeout(() => {
      if (!it.el.isConnected) return;
      const from = q('.cl-spin').getBoundingClientRect(), to = target.getBoundingClientRect();
      if (!from.width || !to.width) return;
      const dx = to.left - from.left, dy = to.top - from.top, sc = to.width / from.width;
      A(q('.cl-spin'), [{ transform: 'translateX(-50%)' }, { transform: `translate(calc(-50% + ${dx + (to.width - from.width) / 2}px), ${dy + (to.height - from.height) / 2}px) scale(${sc})` }], { duration: 620, easing: EASE.io, fill: 'forwards' }, 'cli');
      A(it.el, [{ backgroundColor: 'rgba(5,4,3,1)' }, { backgroundColor: 'rgba(5,4,3,0)' }], { duration: 620, easing: EASE.io, fill: 'forwards' }, 'cli');
      $$('.cl-drop,.cl-plus,.in-cap,.in-skip', it.el).forEach(x => { x.style.visibility = 'hidden'; });
    }, 2250);
    A(target, [{ opacity: 0 }, { opacity: 1 }], { duration: 10, delay: 2860, fill: 'backwards' }, 'cl');
    assemble(card, true, 'cl', 2300);
    it.promise.then(skipped => { CL.introCard = null; if (skipped) { stop('cl'); assemble(card, false, 'cl'); } });
  }
  function clSync() {
    const modal = $('#customerBaseModal');
    if (!modal) return;
    const open = modal.classList.contains('open');
    if (open && !CL.open) {
      CL.open = true;
      if (!clActive()) return;
      const card = $('#customerBaseModalCard');
      if (card) card.scrollTop = 0;
      if (motion && !store.get(SEEN.cl)) { store.set(SEEN.cl, '1'); try { clIntro(); } catch (e) { log('club intro', e); } }
      else assemble(card, false, 'cl');
    } else if (!open && CL.open) {
      CL.open = false;
      stop('cli'); stop('cl');
      const it = $('#customerBaseModalCard > .in-intro');
      if (it) it.remove();
      const card = $('#customerBaseModalCard');
      if (card) card.classList.remove('in-lock');
      CL.introCard = null;
    }
  }
  function clInstall() {
    const names = ['renderCustomerBaseModal', 'renderCustomerBaseOverview', 'renderCustomerBaseList', 'editCustomerBaseEntry', 'resetCustomerBaseForm'];
    if (!names.every(n => typeof window[n] === 'function')) return false;
    names.forEach(n => { CL.orig[n] = window[n]; });
    window.renderCustomerBaseModal = function () {
      const r = CL.orig.renderCustomerBaseModal.apply(this, arguments);
      try { CL.openIds.clear(); clDecorate(); } catch (e) { log('club decorate', e); const m = $('#customerBaseModal'); if (m) m.classList.remove('po-cl'); }
      return r;
    };
    window.renderCustomerBaseOverview = function () {
      const r = CL.orig.renderCustomerBaseOverview.apply(this, arguments);
      try { clOverview(); } catch (e) { log('club overview', e); }
      return r;
    };
    window.renderCustomerBaseList = function () {
      if (!clActive() || clTab() === 'products') return CL.orig.renderCustomerBaseList.apply(this, arguments);
      try { return clList(); } catch (e) { log('club list', e); return CL.orig.renderCustomerBaseList.apply(this, arguments); }
    };
    window.editCustomerBaseEntry = function () {
      try { if (clActive()) clForm(true, false); } catch (_) {}
      return CL.orig.editCustomerBaseEntry.apply(this, arguments);
    };
    window.resetCustomerBaseForm = function () {
      const r = CL.orig.resetCustomerBaseForm.apply(this, arguments);
      try { if (clActive()) clForm(false, false); } catch (_) {}
      return r;
    };
    const modal = $('#customerBaseModal');
    if (modal) new MutationObserver(clSync).observe(modal, { attributes: true, attributeFilter: ['class'] });
    return true;
  }

  /* =====================================================================
     3 · СТАТИСТИКА ТОВАРОВ · «Гонка + прибыль»
     ===================================================================== */
  const GD = { orig: null, open: false, t0: 0, ana: null, err: '', rep: null, flt: 'all', sort: 'q', limit: 30, rendered: false, model: null };
  const WINDOW = 30;
  const STL = { hit: 'ХИТ', ok: 'в продаже', slow: 'раз в неделю', dead: 'не продаётся', na: '' };

  function gdVelocity(rep, idx) {
    if (!rep || rep.failed) return null;
    const reports = Array.isArray(rep.reports) ? rep.reports : [];
    const today = dayKey();
    const days = [];
    for (let i = WINDOW - 1; i >= 0; i--) days.push(moveDay(today, -i));
    const pos = new Map(days.map((d, i) => [d, i]));
    const dayOf = dayAssigner(reports);
    const map = new Map();
    let first = '';
    const add = (clients, d) => {
      const i = pos.get(d);
      if (i == null) return;
      for (const c of clients || []) for (const it of (Array.isArray(c && c.items) ? c.items : [])) {
        if (isAdmission(it)) continue;
        const p = paid(it);
        if (!p || (p.amount <= 0 && !bonusPaidOf(it))) continue;   // a bonus line also took the item off the shelf
        const prod = findProduct(idx, it.productId, nameOf(it));
        const key = prod ? 'id:' + prod.id : 'n:' + lower(nameOf(it));
        let v = map.get(key);
        if (!v) { v = { qty: 0, d: new Array(WINDOW).fill(0), last: '' }; map.set(key, v); }
        v.qty += p.qty;
        v.d[i] += p.qty;
        if (d > v.last) v.last = d;
      }
    };
    for (const r of reports) {
      const d = dayOf(r);
      if (!d) continue;
      if (!first || d < first) first = d;
      add(r.clients, d);
    }
    const live = liveShift();
    if (live) { if (!first || live.day < first) first = live.day; add(live.clients, live.day); }
    map.span = first ? Math.max(7, Math.min(WINDOW, daysBetween(first, today) + 1)) : WINDOW;
    map.days = days;
    return map;
  }
  function gdStatus(v, span) {
    if (!v) return 'na';
    if (v.qty <= 0) return 'dead';
    if (v.qty <= Math.max(1, Math.round(span / 7))) return 'slow';
    if (v.qty / span >= 1) return 'hit';
    return 'ok';
  }
  function gdVelText(v, span) {
    if (!v) return 'скорость считается…';
    if (v.qty <= 0) return `нет продаж ${span} дн.`;
    const per = v.qty / span;
    if (per >= .5) return `≈ ${per.toFixed(1).replace('.', ',')} шт в день`;
    const every = Math.max(2, Math.round(span / v.qty));
    return `1 шт за ~${every} дн.${v.last ? ` · посл. ${dayShort(v.last)}` : ''}`;
  }
  /* the server may count «Чай · бонус 45» as its own product: fold it back into «Чай» */
  function gdMergeBonus(rows) {
    if (!rows.some(r => r && BONUS_MARK.test(String(r.name || '')))) return rows;
    const out = [], at = new Map();
    for (const r of rows) {
      if (!r) continue;
      const base = String(r.name || '').replace(BONUS_MARK, '').trim();
      const k = lower(base);
      const have = at.get(k);
      if (have) {
        have.soldQty = Number(have.soldQty || 0) + Number(r.soldQty || 0);
        have.revenue = Number(have.revenue || 0) + Number(r.revenue || 0);
        if (Number(r.rank) && (!Number(have.rank) || Number(r.rank) < Number(have.rank))) have.rank = r.rank;
        continue;
      }
      const copy = Object.assign({}, r, { name: base });
      at.set(k, copy);
      out.push(copy);
    }
    return out;
  }
  function gdModel() {
    const rows = gdMergeBonus(GD.ana && Array.isArray(GD.ana.products) ? GD.ana.products : []);
    const idx = pIndex();
    const vel = GD.rep ? gdVelocity(GD.rep, idx) : null;
    const span = vel ? vel.span : WINDOW;
    const zero = { qty: 0, d: new Array(WINDOW).fill(0), last: '' };
    const list = rows.map((p, i) => {
      const prod = findProduct(idx, p.id != null ? p.id : p.productId, p.name);
      const qty = Number(p.soldQty || 0), rev = Number(p.revenue || 0);
      const price = prod && Number.isFinite(Number(prod.price)) ? Number(prod.price) : (qty ? Math.round(rev / qty) : null);
      const cost = prod && validCost(prod.costPrice) ? Number(prod.costPrice) : null;
      const profit = cost != null ? rev - qty * cost : null;
      const v = vel ? (vel.get(prod ? 'id:' + prod.id : 'n:' + lower(p.name)) || vel.get('n:' + lower(p.name)) || zero) : null;
      const st = vel ? gdStatus(v, span) : 'na';
      return { rank: Number(p.rank) || i + 1, name: String(p.name || 'Товар'), cat: String(p.category || (prod && (prod.category || prod.cat)) || 'Товар'), qty, rev, price, cost, profit, v, st, vel: vel ? gdVelText(v, span) : 'скорость считается…' };
    });
    const sold = list.filter(r => r.qty > 0);
    const known = sold.filter(r => r.cost != null);
    const t = {
      rev: sold.reduce((s, r) => s + r.rev, 0),
      cost: known.reduce((s, r) => s + r.qty * r.cost, 0),
      revKnown: known.reduce((s, r) => s + r.rev, 0),
      missN: sold.length - known.length,
      missQ: sold.filter(r => r.cost == null).reduce((s, r) => s + r.qty, 0)
    };
    t.profit = t.revKnown - t.cost;
    const counts = { hit: 0, ok: 0, slow: 0, dead: 0 };
    list.forEach(r => { if (counts[r.st] != null) counts[r.st]++; });
    return { list, t, counts, span, vel, days: vel ? vel.days : null };
  }
  function gdShell() {
    return `<div class="in-wrap">
      <div class="in-bar"><button type="button" class="in-back" data-gd="back">${svg(ICON.back)}<span>${esc(backLabel())}</span></button><span class="in-chip" data-gd="all">Все товары</span></div>
      <header class="in-head" data-in="1"><span class="in-kick">Пар Ордо · аналитика</span><h1 class="in-h1">Статистика товаров</h1><p class="in-sub">Закуп, цена продажи и чистая прибыль по каждому товару. Цвет — как товар продаётся.</p></header>
      <div data-gd="body"><div class="in-skel" data-in="2"></div><div class="in-skel" data-in="3" style="height:240px"></div></div>
    </div>`;
  }
  function gdLane(r, max) {
    const pc = r.rank <= 3 ? ' p' + r.rank : '';
    const w = r.qty ? Math.max(3, Math.round(r.qty / max * 100)) : (r.st === 'dead' ? 100 : 0);
    const badge = r.st !== 'na' && r.st !== 'ok' ? `<span class="st-b ${r.st}">${STL[r.st]}</span>` : (r.st === 'ok' ? `<span class="st-b ok">${STL.ok}</span>` : '');
    const costCell = r.cost != null ? `<b>${num(r.cost)}</b>` : '<b class="na">не указан</b>';
    const priceCell = r.price != null ? `<b>${num(r.price)}</b>` : '<b class="na">—</b>';
    let profitCell;
    if (r.cost == null) profitCell = '<b class="na">—</b>';
    else if (!r.qty) profitCell = `<b>0</b>${r.price != null ? `<em>${sgn(r.price - r.cost)} за шт.</em>` : ''}`;
    else profitCell = `<b>${sgn(r.profit)}</b>${r.price != null ? `<em>${sgn(r.price - r.cost)} за шт.</em>` : ''}`;
    return `<div class="gd-lane"><div class="gd-top"><span class="gd-pos${pc}">${r.rank}</span><span class="gd-name">${esc(r.name)}</span><span class="gd-q q-${r.st}">${num(r.qty)} шт.</span></div>
      <div class="gd-sub">${badge}<small>${esc(r.cat)} · ${esc(r.vel)}</small></div>
      <div class="gd-bar"><i class="${r.st}" style="width:${w}%"></i></div>
      <div class="gd-cells"><span class="gd-cell c"><small>Закуп</small>${costCell}</span><span class="gd-cell"><small>Цена</small>${priceCell}</span><span class="gd-cell p"><small>Прибыль</small>${profitCell}</span></div></div>`;
  }
  function gdLanesHtml(M) {
    let list = M.list.filter(r => GD.flt === 'all' || r.st === GD.flt);
    if (GD.sort === 'p') list = list.slice().sort((a, b) => (b.profit == null ? -Infinity : b.profit) - (a.profit == null ? -Infinity : a.profit) || b.qty - a.qty);
    const max = Math.max(1, ...M.list.map(r => r.qty));
    if (!list.length) return `<div class="in-empty">${GD.flt === 'all' ? 'Каталог товаров пока пуст.' : 'В этой группе сейчас нет товаров.'}</div>`;
    const shown = list.slice(0, GD.limit);
    const more = list.length > shown.length ? `<button type="button" class="gd-more" data-gd="more">Показать все · ещё ${list.length - shown.length}</button>` : '';
    return `<section class="in-card gd-list" aria-label="Рейтинг товаров">${shown.map(r => gdLane(r, max)).join('')}${more}</section>`;
  }
  function gdSpeedHtml(M) {
    if (!M.vel) return GD.rep && GD.rep.failed ? '<div class="in-empty">Скорость продаж недоступна: не удалось загрузить отчёты смен.</div>' : '<div class="in-skel" style="height:150px"></div>';
    let list = M.list.filter(r => GD.flt === 'all' || r.st === GD.flt);
    list = list.slice().sort((a, b) => (b.v ? b.v.qty : 0) - (a.v ? a.v.qty : 0) || b.qty - a.qty).slice(0, 8);
    if (!list.length) return '<div class="in-empty">Нет товаров для графика.</div>';
    const rows = list.map(r => {
      const d = (r.v ? r.v.d : []).slice(-14);
      const m = Math.max(1, ...d);
      const bars = d.map(v => `<i style="height:${r.st === 'dead' ? 8 : Math.max(5, Math.round(v / m * 100))}%"></i>`).join('');
      return `<div class="gd-sprow"><span style="min-width:0"><b>${esc(r.name)}</b><small class="q-${r.st}">${esc(r.vel)}</small></span><span class="gd-bars ${r.st}" aria-hidden="true">${bars}</span></div>`;
    }).join('');
    const d0 = M.days ? M.days[M.days.length - 14] : '';
    return `<section class="in-card gd-sp" aria-label="Сколько продаётся по дням">${rows}<div class="gd-ax"><span>${esc(dayShort(d0))}</span><span>сегодня</span></div></section>`;
  }
  function gdBodyHtml(M) {
    const t = M.t;
    const costKnown = t.revKnown > 0;
    const miss = t.missN ? `<div class="in-warn" data-in="3"><b>Нет закупочной цены у ${t.missN} ${plural(t.missN, 'товара', 'товаров', 'товаров')} (${num(t.missQ)} шт.).</b> Их прибыль не считается. ${role() === 'admin' ? 'Укажите цену в «Товары и склад».' : 'Цены задаёт администратор.'}</div>` : '';
    const c = M.counts;
    return `
      <div class="gd-pm" data-in="2">
        <div class="gd-m g"><b data-gd-n="${t.rev}">${num(t.rev)}</b><small>выручка, сом</small></div>
        <div class="gd-m c"><b${costKnown ? ` data-gd-n="${t.cost}"` : ''}>${costKnown ? num(t.cost) : '—'}</b><small>закуп проданного, сом</small></div>
        <div class="gd-m p"><b>${costKnown ? sgn(t.profit) : '—'}</b><small>чистая прибыль, сом</small></div>
        <div class="gd-m"><b>${costKnown ? pct(t.profit, t.revKnown) + '%' : '—'}</b><small>средняя маржа</small></div>
      </div>
      ${miss}
      <div class="gd-leg" data-in="4"><span class="st-b hit">ХИТ · каждый день</span><span class="st-b slow">раз в неделю</span><span class="st-b dead">не продаётся</span></div>
      <div class="gd-flt" data-in="5" role="group" aria-label="Фильтр">
        <button type="button" class="in-chip${GD.flt === 'all' ? ' on' : ''}" data-gd-f="all" aria-pressed="${GD.flt === 'all'}">Все</button>
        <button type="button" class="in-chip f-hit${GD.flt === 'hit' ? ' on' : ''}" data-gd-f="hit" aria-pressed="${GD.flt === 'hit'}">Хиты${M.vel ? ` <small>${c.hit}</small>` : ''}</button>
        <button type="button" class="in-chip f-slow${GD.flt === 'slow' ? ' on' : ''}" data-gd-f="slow" aria-pressed="${GD.flt === 'slow'}">Редкие${M.vel ? ` <small>${c.slow}</small>` : ''}</button>
        <button type="button" class="in-chip f-dead${GD.flt === 'dead' ? ' on' : ''}" data-gd-f="dead" aria-pressed="${GD.flt === 'dead'}">Стоят${M.vel ? ` <small>${c.dead}</small>` : ''}</button>
      </div>
      <div class="gd-sort" data-in="6"><span>Сортировка</span><button type="button" class="in-chip${GD.sort === 'q' ? ' on' : ''}" data-gd-s="q" aria-pressed="${GD.sort === 'q'}">по количеству</button><button type="button" class="in-chip${GD.sort === 'p' ? ' on' : ''}" data-gd-s="p" aria-pressed="${GD.sort === 'p'}">по прибыли</button></div>
      <div data-in="7" data-gd="lanes">${gdLanesHtml(M)}</div>
      <div class="in-sec" data-in="8"><h2>Скорость продаж</h2><i></i><em>${M.vel ? `14 дней · статус за ${M.span} дн.` : '14 дней'}</em></div>
      <div data-in="9" data-gd="speed">${gdSpeedHtml(M)}</div>
      <p class="in-note" data-in="10">Выручка и количество — за всё время. ХИТ: в среднем 1 шт. в день и больше · раз в неделю: не больше ${Math.max(1, Math.round(M.span / 7))} шт. за ${M.span} дн. · не продаётся: ни одной продажи за ${M.span} дн. Прибыль = выручка − закупочная цена × продано.</p>`;
  }
  function gdBind(scope) {
    $$('[data-gd-f]', scope).forEach(b => b.addEventListener('click', () => { GD.flt = b.dataset.gdF; GD.limit = 30; gdRefreshParts(true); }));
    $$('[data-gd-s]', scope).forEach(b => b.addEventListener('click', () => { GD.sort = b.dataset.gdS; GD.limit = 30; gdRefreshParts(true); }));
    scope.addEventListener('click', e => {
      if (e.target.closest('[data-gd=more]')) { GD.limit = 10000; gdRefreshParts(false); }
    });
  }
  function gdRefreshParts(anim) {
    const card = $('#productStatsModalCard');
    if (!card || !GD.model) return;
    $$('[data-gd-f]', card).forEach(b => { const on = b.dataset.gdF === GD.flt; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    $$('[data-gd-s]', card).forEach(b => { const on = b.dataset.gdS === GD.sort; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const lanes = $('[data-gd=lanes]', card), speed = $('[data-gd=speed]', card);
    if (lanes) { lanes.innerHTML = gdLanesHtml(GD.model); if (anim) $$('.gd-lane', lanes).slice(0, 8).forEach((l, i) => A(l, [{ opacity: 0, transform: 'translateX(-24px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: i * 40, easing: EASE.out }, 'gd')); }
    if (speed) speed.innerHTML = gdSpeedHtml(GD.model);
  }
  function gdRender() {
    if (!GD.open) return;
    const card = $('#productStatsModalCard');
    const body = card && $('[data-gd=body]', card);
    if (!body) return;
    if (GD.err && !GD.ana) {
      body.innerHTML = `<div class="in-err">Не удалось загрузить статистику товаров.<br>${esc(GD.err)}</div>`;
      return;
    }
    if (!GD.ana) return;
    try {
      const M = gdModel();
      GD.model = M;
      if (GD.rendered) {
        // later data (reports, catalogue): refresh in place, keep the scroll
        const keep = card.scrollTop;
        body.innerHTML = gdBodyHtml(M);
        gdBind(body);
        card.scrollTop = keep;
        return;
      }
      GD.rendered = true;
      const all = $('[data-gd=all]', card);
      if (all) all.textContent = `Все ${M.list.length}`;
      body.innerHTML = gdBodyHtml(M);
      gdBind(body);
      const top6 = M.list.filter(r => r.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, 6);
      const wrap = $('.in-wrap', card);
      if (motion && top6.length && !store.get(SEEN.gd) && performance.now() - GD.t0 < 2600) { store.set(SEEN.gd, '1'); gdIntro(top6, wrap, card); }
      else gdEnter(wrap, false, 0);
    } catch (e) {
      log('stats render', e);
      body.innerHTML = '<div class="in-err">Не удалось показать статистику. Закройте и откройте раздел ещё раз.</div>';
    }
  }
  function gdEnter(wrap, full, delay) {
    assemble(wrap, full, 'gd', delay);
    $$('.gd-lane', wrap).slice(0, 8).forEach((l, i) => A(l, [{ opacity: 0, transform: 'translateX(-30px)' }, { opacity: 1, transform: 'none' }], { duration: full ? 600 : 360, delay: delay + (full ? 560 : 80) + i * (full ? 90 : 35), easing: EASE.out }, 'gd'));
    $$('.gd-bar i', wrap).slice(0, 10).forEach((b, i) => A(b, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: full ? 900 : 520, delay: delay + (full ? 640 : 120) + i * (full ? 90 : 35), easing: EASE.out }, 'gd'));
    $$('[data-gd-n]', wrap).forEach(b => countTo(b, Number(b.dataset.gdN) || 0, full ? 1000 : 0, delay + (full ? 200 : 0)));
  }
  function gdIntro(top6, wrap, card) {
    const leader = top6[0];
    const max = leader.qty || 1;
    const runs = top6.map((r, i) => `<div class="gd-run${r.st === 'hit' ? ' hit' : ''}" style="top:${212 + i * 46}px;width:calc((100% - 66px) * ${(.34 + .66 * r.qty / max).toFixed(3)})"><span>${esc(r.name)}</span><b>${num(r.qty)}</b></div>`).join('');
    const sub = leader.profit != null ? `${leader.name} · ${sgn(leader.profit)} сом` : `${leader.name} · ${num(leader.qty)} шт.`;
    const html = `<div class="gd-start"></div><div class="gd-finish"></div>${runs}<i class="gd-tape"></i><div class="in-cap" style="top:520px"><span>ХИТ ПРОДАЖ</span><b>${esc(sub)}</b></div>`;
    const it = intro(card, html, 2600, 'gdi', card);
    $$('.gd-run', it.el).forEach((r, i) => A(r, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 1100 + i * 120, delay: 260, easing: 'cubic-bezier(.3,.1,.2,1)' }, 'gdi'));
    A($('.gd-tape', it.el), [{ transform: 'none', opacity: 1 }, { transform: 'rotate(70deg) translateY(-10px)', opacity: 0 }], { duration: 420, delay: 1360, easing: 'ease-out', fill: 'forwards' }, 'gdi');
    A($('.in-cap', it.el), [{ opacity: 0, transform: 'translateY(16px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 1420, easing: EASE.back }, 'gdi');
    A(it.el, [{ opacity: 1 }, { opacity: 0 }], { duration: 420, delay: 2180, fill: 'forwards' }, 'gdi');
    gdEnter(wrap, true, 2150);
    it.promise.then(skipped => { if (skipped) { stop('gd'); gdEnter(wrap, false, 0); } });
  }
  async function gdOpen() {
    const modal = $('#productStatsModal'), card = $('#productStatsModalCard');
    if (!modal || !card) throw new Error('modal missing');
    GD.open = true; GD.t0 = performance.now(); GD.ana = null; GD.err = ''; GD.rep = null; GD.rendered = false; GD.model = null; GD.flt = 'all'; GD.sort = 'q'; GD.limit = 30;
    modal.classList.add('po-gd');
    card.classList.add('po-in', 'in-screen');
    card.innerHTML = gdShell();
    $('[data-gd=back]', card).addEventListener('click', () => call('closeModal', '#productStatsModal'));
    call('openModal', '#productStatsModal');
    card.scrollTop = 0;
    assemble(card, false, 'gd');
    if (needCatalog()) getJson('/api/admin/products/catalog').then(() => { if (GD.rendered) gdRender(); }, () => {});
    const pR = fresh('reports', 120000) ? Promise.resolve(cap.reports) : getJson('/api/admin/control/reports');
    pR.then(d => { if (!GD.open) return; GD.rep = d || { failed: true }; gdRender(); }, () => { if (!GD.open) return; GD.rep = { failed: true }; gdRender(); });
    try {
      const d = typeof api === 'function' ? await api('/api/admin/control/analytics') : await getJson('/api/admin/control/analytics');
      try { customerBusinessAnalytics = d; } catch (_) {}
      if (!GD.open) return;
      GD.ana = d && Array.isArray(d.products) ? d : { products: [] };
    } catch (e) {
      GD.err = (e && e.message) || 'Проверьте соединение с сервером.';
    }
    gdRender();
  }
  function gdSync() {
    const modal = $('#productStatsModal');
    if (!modal) return;
    if (!modal.classList.contains('open') && GD.open) {
      GD.open = false;
      stop('gdi'); stop('gd');
      const it = $('#productStatsModalCard > .in-intro');
      if (it) it.remove();
      const card = $('#productStatsModalCard');
      if (card) card.classList.remove('in-lock');
    }
  }
  function gdInstall() {
    if (typeof window.openProductStats !== 'function') return false;
    GD.orig = window.openProductStats;
    window.openProductStats = async function () {
      if (!$('#productStatsModalCard')) return GD.orig.apply(this, arguments);
      try { return await gdOpen(); }
      catch (e) {
        log('stats', e);
        const m = $('#productStatsModal');
        if (m) m.classList.remove('po-gd');
        const c = $('#productStatsModalCard');
        if (c) c.classList.remove('po-in', 'in-screen');
        GD.open = false;
        return GD.orig.apply(this, arguments);
      }
    };
    const modal = $('#productStatsModal');
    if (modal) new MutationObserver(gdSync).observe(modal, { attributes: true, attributeFilter: ['class'] });
    return true;
  }

  /* =====================================================================
     boot
     ===================================================================== */
  tapFetch();
  function boot() {
    let ok = { report: false, club: false, stats: false };
    try { ok.club = clInstall(); } catch (e) { log('club install', e); }
    try { ok.stats = gdInstall(); } catch (e) { log('stats install', e); }
    try {
      ok.report = rpAttach();
      if (!ok.report) {
        // the report modal is created by par-ordo-inline-daily-report-v2.js at its boot
        const mo = new MutationObserver(() => { if (rpAttach()) mo.disconnect(); });
        mo.observe(document.body || document.documentElement, { childList: true });
        setTimeout(() => mo.disconnect(), 15000);
      }
    } catch (e) { log('report install', e); }
    document.documentElement.classList.add('po-in-on');
    window.PARORDOInner.installed = ok;
  }
  window.PARORDOInner = {
    version: VERSION,
    installed: null,
    /* replay an opening: 'report' | 'club' | 'stats' */
    replay(which) {
      const k = { report: SEEN.rp, club: SEEN.cl, stats: SEEN.gd }[which];
      if (k) { try { sessionStorage.removeItem(k); } catch (_) {} }
    }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
