/* PAR ORDO PRO — SECTIONS V1
   New look and entrance motion for Товары, История, Архив, Итог (with the Z-отчёт in the
   «Завершить смену» confirmation), the side menu and the manager entrance.

   Decoration only: no API calls, no writes. Screens are rebuilt from the app's own data (db,
   shiftState) and helpers (payments, total, money…), and every handler the app relies on stays.
   - История / Архив: renderHistory / renderArchive are replaced (same data, new markup).
   - Итог: renderReport is wrapped; only the open-shift state gets the new «Касса» markup.
   - Z-отчёт: confirmAction is wrapped; the receipt is added only for «Завершить рабочую смену?».
   - Товары: the smart-inventory v4 markup is decorated after each render (MutationObserver).
   - Меню / вход руководителя: classes, badges and motion on the existing markup.
   Full entrance on the first visit of each screen per launch, a short one afterwards.
   prefers-reduced-motion: the new design without motion. */
(() => {
  'use strict';
  if (window.PARORDOSections) return;

  const VERSION = '1.0.0';
  const root = document.documentElement;
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const canAnimate = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
  const motion = !reduced && canAnimate;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const EASE = {
    out: 'cubic-bezier(.16,1,.3,1)',
    spring: 'cubic-bezier(.34,1.56,.64,1)',
    inOut: 'cubic-bezier(.65,0,.35,1)',
    fall: 'cubic-bezier(.55,0,1,.45)',
    rise: 'cubic-bezier(0,.55,.45,1)',
    slam: 'cubic-bezier(.5,0,.75,0)'
  };
  const K = {
    up: (y = 14) => [{ opacity: 0, transform: `translate3d(0,${y}px,0)` }, { opacity: 1, transform: 'none' }],
    down: (y = 12) => [{ opacity: 0, transform: `translate3d(0,${-y}px,0)` }, { opacity: 1, transform: 'none' }],
    left: (x = 18) => [{ opacity: 0, transform: `translate3d(${-x}px,0,0)` }, { opacity: 1, transform: 'none' }],
    fade: [{ opacity: 0 }, { opacity: 1 }],
    grow: [{ transform: 'scaleX(0)' }, { transform: 'none' }],
    pop: [{ transform: 'scale(0)' }, { transform: 'scale(1.25)', offset: 0.6 }, { transform: 'none' }]
  };

  /* ---------- app access (globals of the main inline script) ---------- */
  const app = {
    db: () => (typeof db !== 'undefined' ? db : null),
    shift: () => (typeof shiftState !== 'undefined' ? shiftState : null),
    view: () => (typeof currentView !== 'undefined' ? currentView : '')
  };
  const esc = v => (typeof escapeHtml === 'function'
    ? escapeHtml(v)
    : String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const num = v => Number(v || 0).toLocaleString('ru-RU');
  const sum = v => (typeof money === 'function' ? money(v) : num(v) + ' сом');
  const som = v => `${num(v)}<small class="sx-unit"> сом</small>`;
  const digits = s => { const t = String(s ?? '').split(',')[0].replace(/[^\d]/g, ''); return t ? Number(t) : NaN; };
  const amountOf = i => Number((i && i.price) || 0) * Number((i && i.qty) || 0);
  const mkey = i => (i && (i.method === 'cash' || i.method === 'transfer') ? i.method : 'pending');
  const METHOD = { cash: 'Наличные', transfer: 'Перевод', pending: 'Ожидает оплаты' };
  const itemsOf = c => (c && Array.isArray(c.items) ? c.items : []);
  const totalOf = c => (typeof total === 'function' ? total(c) : itemsOf(c).reduce((s, i) => s + amountOf(i), 0));
  const pays = c => {
    if (typeof payments === 'function') return payments(c);
    return itemsOf(c).reduce((a, i) => { a[mkey(i)] += amountOf(i); return a; }, { cash: 0, transfer: 0, pending: 0 });
  };
  const isEntry = i => !(i && i.productId) && /вход/i.test(String((i && i.name) || ''));
  const dt = v => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
  const hhmm = v => { const d = dt(v); return d ? d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—'; };
  const fullDate = v => (typeof fmtDate === 'function' ? fmtDate(v) : (dt(v) ? dt(v).toLocaleString('ru-RU') : '—'));
  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const minutesBetween = (a, b) => { const x = dt(a), y = dt(b); return x && y ? Math.max(0, Math.round((y - x) / 60000)) : null; };
  const durText = m => (m == null ? '—' : m >= 60 ? `${Math.floor(m / 60)} ч ${String(m % 60).padStart(2, '0')} мин` : `${m} мин`);
  const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
  const onScreen = (el, pad = 0) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top < innerHeight + pad && r.bottom > -pad;
  };
  function dayLabel(key) {
    if (key === 'none') return 'Без даты';
    const now = new Date();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (key === dayKey(now)) return 'Сегодня';
    if (key === dayKey(y)) return 'Вчера';
    const [Y, M, D] = key.split('-').map(Number);
    const d = new Date(Y, M - 1, D);
    return d.toLocaleDateString('ru-RU', Y === now.getFullYear()
      ? { weekday: 'short', day: 'numeric', month: 'long' }
      : { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function groupByDay(list) {
    const map = new Map();
    list.forEach(c => {
      const d = dt(c.endedAt) || dt(c.startedAt);
      const key = d ? dayKey(d) : 'none';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    return Array.from(map, ([key, items]) => ({ key, label: dayLabel(key), items }));
  }
  function completedClients(archived) {
    const d = app.db();
    if (!d || !Array.isArray(d.clients)) return [];
    const arch = new Set(Array.isArray(d.archived) ? d.archived : []);
    return d.clients
      .filter(c => c && c.status === 'completed' && (archived ? arch.has(c.id) : !arch.has(c.id)))
      .sort((a, b) => new Date(b.endedAt) - new Date(a.endedAt));
  }
  const sigOf = list => list.map(c => `${c.id}~${c.endedAt}~${c.room}~${itemsOf(c).map(i => `${i.name}|${i.qty}|${i.price}|${i.method || ''}`).join(',')}`).join(';');

  /* ---------- icons ---------- */
  const svg = (body, cls = 'sx-ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  const I = {
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
    folder: '<path d="M3.5 7.2c0-.9.7-1.7 1.6-1.7h4.1l2 2.1h7.7c.9 0 1.6.7 1.6 1.6v8.6c0 .9-.7 1.7-1.6 1.7H5.1c-.9 0-1.6-.8-1.6-1.7z"/>',
    caret: '<path d="m9 5 7 7-7 7"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="5" cy="6.5" r="1" fill="currentColor"/><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="5" cy="17.5" r="1" fill="currentColor"/>'
  };
  const CAT_ICON = {
    'Все товары': I.grid,
    'Напитки': '<path d="M7 8h10l-1.2 12H8.2z"/><path d="M12.5 8l2-5h2.5"/><path d="M7.6 12h8.8"/>',
    'Чай': '<path d="M5 10h11v4a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M9 3.5c-1 1.2 1 2 0 3.2M12.5 3.5c-1 1.2 1 2 0 3.2"/>',
    'Шорты': '<path d="M5 5h14l1 14h-6l-2-7-2 7H4z"/><path d="M5 8h14"/>',
    'Одежда': '<path d="M8 4l-4.5 3 2 4L8 10v10h8V10l2.5 1 2-4L16 4c-.8 1.3-2.2 2-4 2s-3.2-.7-4-2z"/>',
    'Снеки': '<circle cx="12" cy="12" r="8.5"/><circle cx="9" cy="9.5" r="1" fill="currentColor"/><circle cx="14.6" cy="8.8" r="1" fill="currentColor"/><circle cx="9.6" cy="14.6" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/>',
    'Полотенца': '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 9.5h16M4 14.5h16"/>',
    'Аксессуары': '<path d="M8.5 10h7a1 1 0 0 1 1 1v8.5a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5V11a1 1 0 0 1 1-1z"/><path d="M10.5 10V7h3v3M12 7V4.5h3.5"/><path d="M10 15h4"/>',
    'Гигиена': '<rect x="3.5" y="10" width="14" height="9" rx="4"/><circle cx="18" cy="6" r="2"/><circle cx="13" cy="5.5" r="1.2"/><path d="M7.5 14.5h6"/>',
    'Для бани': '<path d="M12 21v-7.5"/><path d="M12 13.5C8 12.6 5.8 9.2 6 4.5c3.6.6 6 3.4 6 9z"/><path d="M12 13.5c4-.9 6.2-4.3 6-9-3.6.6-6 3.4-6 9z"/>',
    'Прочее': '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>'
  };
  const LOCK = '<svg class="sx-pad" viewBox="0 0 66 66" aria-hidden="true"><path class="sx-shackle" d="M22 30v-9a11 11 0 0 1 22 0v9"/><rect x="14" y="30" width="38" height="26" rx="6"/><path d="M33 40v6"/></svg>';

  /* ---------- motion helpers ---------- */
  const groups = new Map();
  function A(el, keyframes, options, group = 'view') {
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
  function frames(el, delay, ms, draw) {
    if (!motion || !el) return;
    const t0 = performance.now() + delay;
    const step = now => {
      if (!el.isConnected) return;
      if (now < t0) { requestAnimationFrame(step); return; }
      const k = clamp((now - t0) / ms, 0, 1);
      draw(k);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function countUp(el, to, ms, delay) {
    if (!motion || !el || !Number.isFinite(to) || to <= 0) return;
    const final = el.textContent;
    el.textContent = '0';
    frames(el, delay, ms, k => { el.textContent = k >= 1 ? final : num(Math.round(to * (1 - Math.pow(1 - k, 3)))); });
  }
  function scramble(el, ms, delay) {
    if (!motion || !el) return;
    const final = el.textContent;
    frames(el, delay, ms, k => { el.textContent = k >= 1 ? final : final.replace(/\d/g, () => String(Math.floor(Math.random() * 10))); });
  }
  function lite(list) {
    list.filter(el => el && onScreen(el, 0)).forEach((el, k) => A(el, K.up(10), { duration: 320, delay: k * 45, easing: EASE.out }));
  }
  /* Cards below the fold wait (hidden) and play their entrance when scrolled into view. First visit only. */
  const pending = new Map();
  let revealIO = null;
  function revealLater(els, play) {
    if (!motion || typeof IntersectionObserver !== 'function') return;
    if (!revealIO) {
      revealIO = new IntersectionObserver(entries => {
        const hits = entries.filter(e => e.isIntersecting && pending.has(e.target)).map(e => e.target);
        hits.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        hits.forEach((el, k) => {
          const fn = pending.get(el);
          pending.delete(el);
          revealIO.unobserve(el);
          el.classList.remove('sx-pending');
          if (el.isConnected) { try { fn(el, Math.min(k, 6) * 80); } catch (_) {} }
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -4% 0px' });
    }
    els.forEach(el => {
      if (!el || pending.has(el) || onScreen(el, 0)) return;
      if (typeof el.getAnimations === 'function' && el.getAnimations({ subtree: true }).length) return;
      pending.set(el, play);
      el.classList.add('sx-pending');
      revealIO.observe(el);
    });
  }
  function clearReveal() {
    if (revealIO) { revealIO.disconnect(); revealIO = null; }
    pending.forEach((_, el) => el.classList.remove('sx-pending'));
    pending.clear();
  }

  /* ---------- shared markup ---------- */
  function lineHtml(i) {
    const m = mkey(i);
    return `<div class="px-line"><span class="sx-m ${m}" role="img" aria-label="${METHOD[m]}" title="${METHOD[m]}"></span><span>${esc(i.name)} ×${num(i.qty)}</span><i></i><b>${sum(amountOf(i))}</b></div>`;
  }
  function footHtml(p) {
    return `<span><i class="sx-m cash"></i>Наличные <b>${sum(p.cash)}</b></span><span><i class="sx-m transfer"></i>Перевод <b>${sum(p.transfer)}</b></span>${p.pending ? `<span><i class="sx-m pending"></i>Ожидает <b>${sum(p.pending)}</b></span>` : ''}`;
  }
  function statsHtml(cells) {
    return `<div class="sx-stats">${cells.map(([value, label, tone]) => `<div class="sx-stat${tone ? ' ' + tone : ''}"><b>${value}</b><small>${label}</small></div>`).join('')}</div>`;
  }

  /* =====================================================================
     ИСТОРИЯ — receipts on a timeline, grouped by day
     ===================================================================== */
  let historySig = '';
  function receiptHtml(c) {
    const p = pays(c);
    const m = minutesBetween(c.startedAt, c.endedAt);
    const over = m != null && m > 180;
    const pct = m == null ? 0 : clamp(m / 180 * 100, 2, 100);
    const items = itemsOf(c);
    return `<article class="px-item">
      <div class="px-time"><i class="px-dot"></i><span>${hhmm(c.endedAt)}</span></div>
      <div class="px-wrap"><i class="px-slot" aria-hidden="true"></i><div class="px-paper">
        <div class="px-top"><span class="px-badge">№${esc(c.room)}</span><div class="px-who"><b>Клиент ${esc(c.clientNo)}</b><small>${hhmm(c.startedAt)} — ${hhmm(c.endedAt)}</small></div><span class="px-pill">${svg(I.clock)}${durText(m)}</span></div>
        <div class="px-dur"><div class="px-dur-top"><span>Время сеанса</span><span>${over ? 'больше 3 ч' : 'лимит 3 ч'}</span></div><div class="px-bar${over ? ' is-over' : ''}"><i style="width:${pct.toFixed(1)}%"></i></div></div>
        <div class="px-lines">${items.length ? items.map(lineHtml).join('') : '<div class="px-none">Покупок нет</div>'}</div>
        <div class="px-total"><span>Итого</span><b>${sum(totalOf(c))}</b></div>
        <div class="px-foot">${footHtml(p)}</div>
        <span class="px-stamp">✓ Завершён</span>
      </div></div>
    </article>`;
  }
  function renderHistorySx() {
    const list = $('#historyList');
    if (!list) return;
    const arr = completedClients(false);
    const sig = sigOf(arr);
    if (sig === historySig && list.dataset.sx === '1' && list.childElementCount) return;
    historySig = sig;
    list.dataset.sx = '1';
    if (!arr.length) {
      list.innerHTML = '<div class="empty-state">История пока пустая. Завершённые клиенты появятся здесь.</div>';
      return;
    }
    const amount = arr.reduce((s, c) => s + totalOf(c), 0);
    list.innerHTML = statsHtml([
      [num(arr.length), plural(arr.length, 'Сеанс', 'Сеанса', 'Сеансов')],
      [num(amount), 'Сумма · сом', 'gold'],
      [num(Math.round(amount / arr.length)), 'Средний чек · сом', 'green']
    ]) + groupByDay(arr).map(g => `<div class="sx-group">${esc(g.label)} · ${g.items.length}</div><div class="px-tl"><i class="px-rail" aria-hidden="true"></i>${g.items.map(receiptHtml).join('')}</div>`).join('');
  }
  function printReceipt(item, delay, quick) {
    const q = quick ? 0.62 : 1;
    A($('.px-dot', item), K.pop, { duration: 460, delay, easing: 'ease-out' });
    A($('.px-time span', item), K.fade, { duration: 320, delay: delay + 140 });
    A($('.px-slot', item), [{ opacity: 0, transform: 'scaleX(.5)' }, { opacity: 1, transform: 'none', offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 980 * q, delay, easing: 'linear' });
    A($('.px-paper', item), [{ clipPath: 'inset(0 0 100% 0)', transform: 'translate3d(0,-10px,0)' }, { clipPath: 'inset(0 0 0% 0)', transform: 'none' }], { duration: 840 * q, delay: delay + 70, easing: 'steps(7,end)' });
    A($('.px-bar i', item), K.grow, { duration: 720, delay: delay + 560 * q, easing: EASE.out });
    A($('.px-stamp', item), [{ opacity: 0, transform: 'rotate(-28deg) scale(2.4)' }, { opacity: 1, transform: 'rotate(-10deg) scale(.9)', offset: 0.72 }, { opacity: 0.92, transform: 'rotate(-12deg) scale(1)' }], { duration: 440, delay: delay + 900 * q, easing: EASE.slam });
    A($('.px-wrap', item), [{ transform: 'none' }, { transform: 'translate3d(0,3px,0)', offset: 0.4 }, { transform: 'none' }], { duration: 220, delay: delay + 900 * q + 320, easing: 'ease-out', fill: 'none' });
  }
  function introHistory(full) {
    const v = $('#historyView');
    if (!v) return;
    const head = $('.section-head', v);
    const items = $$('.px-item', v).filter(el => onScreen(el, 0));
    if (!full || !items.length) { lite([head, $('.sx-stats', v), $('.empty-state', v), ...items.slice(0, 6)]); return; }
    A(head, K.down(12), { duration: 520, easing: EASE.out });
    $$('.sx-stat', v).forEach((el, k) => {
      A(el, [{ opacity: 0, transform: 'translate3d(0,14px,0) scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 90 + k * 80, easing: EASE.spring });
      const b = $('b', el); countUp(b, digits(b && b.textContent), 900, 160 + k * 80);
    });
    $$('.px-rail', v).filter(el => onScreen(el, 0)).forEach((el, k) => A(el, [{ transform: 'scaleY(0)' }, { transform: 'none' }], { duration: 1100, delay: 220 + k * 200, easing: EASE.inOut }));
    $$('.sx-group', v).filter(el => onScreen(el, 0)).forEach((el, k) => A(el, K.left(16), { duration: 480, delay: 200 + k * 160, easing: EASE.out }));
    items.slice(0, 5).forEach((it, k) => printReceipt(it, 300 + k * 180));
    items.slice(5).forEach((it, k) => A(it, K.up(16), { duration: 420, delay: 1200 + k * 70, easing: EASE.out }));
    revealLater($$('.sx-group', v), (el, d) => A(el, K.left(16), { duration: 460, delay: d, easing: EASE.out }));
    revealLater($$('.px-item', v), (el, d) => printReceipt(el, d, true));
  }

  /* =====================================================================
     АРХИВ — day folders with a search; rows open on tap (built lazily)
     ===================================================================== */
  const ax = { query: '', limit: 10, open: new Set(), openRows: new Set(), seeded: false, all: [], groups: [], sig: '', bound: false };
  const axMatch = (c, q) => [
    `№${c.room}`, `клиент ${c.clientNo}`, dayLabel((dt(c.endedAt) && dayKey(dt(c.endedAt))) || 'none'), fullDate(c.endedAt),
    ...itemsOf(c).map(i => i.name)
  ].join(' ').toLowerCase().includes(q);
  function axDetail(c) {
    const items = itemsOf(c);
    return `<div class="ax-lines">${items.length ? items.map(lineHtml).join('') : '<div class="px-none">Покупок нет</div>'}</div><div class="ax-foot">${footHtml(pays(c))}<span>Архив · ${esc(fullDate(c.endedAt))}</span></div>`;
  }
  function axRow(c) {
    const open = ax.openRows.has(String(c.id));
    const n = itemsOf(c).length;
    return `<div class="ax-row${open ? ' is-open' : ''}" data-ax-row="${esc(c.id)}">
      <button type="button" class="ax-row-head" data-ax-row-toggle aria-expanded="${open}"><span class="ax-no">№${esc(c.room)}</span><span class="ax-who"><b>Клиент ${esc(c.clientNo)}</b><small>${hhmm(c.startedAt)} — ${hhmm(c.endedAt)} · ${n} ${plural(n, 'позиция', 'позиции', 'позиций')}</small></span><span class="ax-amount">${sum(totalOf(c))}${svg(I.caret, 'sx-ico ax-chev')}</span></button>
      <div class="ax-detail"><div class="ax-detail-in">${open ? axDetail(c) : ''}</div></div>
    </div>`;
  }
  function axFolder(g, open) {
    const amount = g.items.reduce((s, c) => s + totalOf(c), 0);
    return `<section class="ax-folder${open ? ' is-open' : ''}" data-ax-day="${esc(g.key)}">
      <button type="button" class="ax-tab" data-ax-toggle aria-expanded="${open}">${svg(I.folder)}<span>${esc(g.label)}</span>${svg(I.caret, 'sx-ico ax-caret')}</button>
      <div class="ax-body"><div class="ax-meta"><span>${g.items.length} ${plural(g.items.length, 'сеанс', 'сеанса', 'сеансов')}</span><span class="ax-sum">${sum(amount)}</span></div>
        <div class="ax-rows"><div class="ax-rows-in">${open ? g.items.map(axRow).join('') : ''}</div></div></div>
    </section>`;
  }
  function renderArchiveBody() {
    const body = $('#axBody');
    if (!body) return;
    const q = ax.query.trim().toLowerCase();
    const list = q ? ax.all.filter(c => axMatch(c, q)) : ax.all;
    ax.groups = groupByDay(list);
    if (!ax.groups.length) { body.innerHTML = `<div class="sx-empty">Ничего не найдено по запросу «${esc(ax.query.trim())}».</div>`; return; }
    const shown = ax.groups.slice(0, ax.limit);
    const rest = ax.groups.length - shown.length;
    body.innerHTML = shown.map(g => axFolder(g, !!q || ax.open.has(g.key))).join('')
      + (rest > 0 ? `<button type="button" class="ax-more" data-ax-more>Показать предыдущие дни · ещё ${rest}</button>` : '');
  }
  function renderArchiveSx() {
    const list = $('#archiveList');
    if (!list) return;
    bindArchive(list);
    const arr = completedClients(true);
    const sig = sigOf(arr);
    if (sig === ax.sig && list.dataset.sx === '1' && list.childElementCount) return;
    ax.sig = sig;
    list.dataset.sx = '1';
    ax.all = arr;
    if (!arr.length) { list.innerHTML = '<div class="empty-state">Архив пока пуст.</div>'; return; }
    if (!ax.seeded) {
      const first = groupByDay(arr)[0];
      if (first) { ax.open.add(first.key); if (first.items[0]) ax.openRows.add(String(first.items[0].id)); }
      ax.seeded = true;
    }
    const amount = arr.reduce((s, c) => s + totalOf(c), 0);
    const days = new Set(arr.map(c => { const d = dt(c.endedAt) || dt(c.startedAt); return d ? dayKey(d) : 'none'; })).size;
    list.innerHTML = `<label class="ax-search">${svg(I.search)}<input id="axSearch" type="search" value="${esc(ax.query)}" placeholder="Браслет, клиент, товар или дата…" autocomplete="off" aria-label="Поиск по архиву"></label>`
      + statsHtml([
        [num(arr.length), plural(arr.length, 'Сеанс', 'Сеанса', 'Сеансов')],
        [num(days), plural(days, 'День', 'Дня', 'Дней')],
        [num(amount), 'Сумма · сом', 'gold']
      ])
      + '<div id="axBody" class="ax-list"></div>';
    renderArchiveBody();
  }
  function toggleFolder(f) {
    const key = f.dataset.axDay;
    const open = !f.classList.contains('is-open');
    const inner = $('.ax-rows-in', f);
    if (open && inner && !inner.childElementCount) {
      const g = ax.groups.find(x => x.key === key);
      if (g) inner.innerHTML = g.items.map(axRow).join('');
    }
    if (open) ax.open.add(key); else ax.open.delete(key);
    f.classList.toggle('is-open', open);
    const tab = $('.ax-tab', f);
    if (tab) tab.setAttribute('aria-expanded', String(open));
    if (open) {
      A(tab, [{ transform: 'none' }, { transform: 'perspective(500px) rotateX(-28deg)', offset: 0.35 }, { transform: 'none' }], { duration: 420, easing: 'ease-out', fill: 'none' }, 'ax');
      $$('.ax-row', f).slice(0, 8).forEach((r, k) => A(r, [{ opacity: 0, transform: 'translate3d(0,-12px,0) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 400, delay: 90 + k * 45, easing: EASE.out }, 'ax'));
    }
  }
  function toggleRow(row) {
    const id = row.dataset.axRow;
    const open = !row.classList.contains('is-open');
    const inner = $('.ax-detail-in', row);
    if (open && inner && !inner.childElementCount) {
      const c = ax.all.find(x => String(x.id) === id);
      if (c) inner.innerHTML = axDetail(c);
    }
    if (open) ax.openRows.add(id); else ax.openRows.delete(id);
    row.classList.toggle('is-open', open);
    const head = $('.ax-row-head', row);
    if (head) head.setAttribute('aria-expanded', String(open));
    if (open && inner) $$('.px-line, .ax-foot', inner).forEach((el, k) => A(el, K.left(10), { duration: 340, delay: 120 + k * 45, easing: EASE.out }, 'ax'));
  }
  function bindArchive(list) {
    if (ax.bound) return;
    ax.bound = true;
    list.addEventListener('click', e => {
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('[data-ax-more]')) { ax.limit += 10; renderArchiveBody(); return; }
      const tab = t.closest('[data-ax-toggle]');
      if (tab) { toggleFolder(tab.closest('.ax-folder')); return; }
      const head = t.closest('[data-ax-row-toggle]');
      if (head) toggleRow(head.closest('.ax-row'));
    });
    list.addEventListener('input', e => {
      if (!e.target || e.target.id !== 'axSearch') return;
      ax.query = e.target.value || '';
      ax.limit = 10;
      renderArchiveBody();
    });
  }
  function introArchive(full) {
    const v = $('#archiveView');
    if (!v) return;
    const head = $('.section-head', v);
    const folders = $$('.ax-folder', v).filter(f => onScreen(f, 0)).slice(0, 4);
    if (!full || !folders.length) { lite([head, $('.ax-search', v), $('.sx-stats', v), $('.empty-state', v), ...folders]); return; }
    A(head, K.down(12), { duration: 520, easing: EASE.out });
    A($('.ax-search', v), [{ opacity: 0, transform: 'translate3d(0,-10px,0) scaleX(.95)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 90, easing: EASE.out });
    $$('.sx-stat', v).forEach((el, k) => {
      A(el, K.up(12), { duration: 480, delay: 150 + k * 70, easing: EASE.out });
      const b = $('b', el); countUp(b, digits(b && b.textContent), 800, 200 + k * 70);
    });
    folders.forEach((f, k) => {
      const d = 260 + k * 170;
      A($('.ax-body', f), [{ opacity: 0, transform: 'translate3d(0,36px,0)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: d, easing: EASE.out });
      A($('.ax-tab', f), [{ opacity: 0, transform: 'perspective(500px) rotateX(-100deg)' }, { opacity: 1, transform: 'perspective(500px) rotateX(14deg)', offset: 0.7 }, { opacity: 1, transform: 'none' }], { duration: 640, delay: d + 170, easing: 'ease-out' });
      if (!f.classList.contains('is-open')) return;
      $$('.ax-row', f).filter(r => onScreen(r, 0)).slice(0, 8).forEach((r, j) => A(r, [{ opacity: 0, transform: 'translate3d(0,-14px,0) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 440, delay: d + 380 + j * 60, easing: EASE.out }));
      const det = $('.ax-row.is-open .ax-detail-in', f);
      if (det && onScreen(det, 0)) A(det, [{ opacity: 0, clipPath: 'inset(0 0 100% 0)' }, { opacity: 1, clipPath: 'inset(0 0 0 0)' }], { duration: 560, delay: d + 760, easing: EASE.out });
    });
    revealLater($$('.ax-folder.is-open .ax-row', v), (el, d) => A(el, [{ opacity: 0, transform: 'translate3d(0,-12px,0) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: d, easing: EASE.out }));
    revealLater($$('.ax-folder', v), (el, d) => {
      A($('.ax-body', el), [{ opacity: 0, transform: 'translate3d(0,30px,0)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: d, easing: EASE.out });
      A($('.ax-tab', el), [{ opacity: 0, transform: 'perspective(500px) rotateX(-100deg)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: d + 140, easing: 'ease-out' });
    });
  }

  /* =====================================================================
     ИТОГ — «Касса» for an open shift, and the Z-отчёт before closing it
     ===================================================================== */
  let reportSig = '';
  let liveTimer = 0;
  const STRIP = Array.from({ length: 20 }, (_, k) => `<span>${k % 10}</span>`).join('');
  function elapsed(from) {
    const d = dt(from);
    if (!d) return '—';
    const s = Math.max(0, Math.floor((Date.now() - d) / 1000));
    return `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  function shiftModel() {
    const s = app.shift() || {};
    const clients = typeof allTodayClients === 'function' ? allTodayClients() : [];
    const done = typeof completedToday === 'function' ? completedToday() : [];
    const active = typeof activeClients === 'function' ? activeClients() : [];
    const m = { clients: clients.length, done: done.length, active: active.length, cash: 0, transfer: 0, pending: 0, entries: 0, entriesQty: 0, goods: 0, goodsQty: 0, openedAt: s.openedAt || '', openedBy: s.openedBy || '' };
    clients.forEach(c => itemsOf(c).forEach(i => {
      const a = amountOf(i), k = mkey(i), q = Number(i.qty || 0);
      m[k] += a;
      if (k === 'pending') return;
      if (isEntry(i)) { m.entries += a; m.entriesQty += q; } else { m.goods += a; m.goodsQty += q; }
    }));
    m.paid = m.cash + m.transfer;
    m.avg = m.clients ? Math.round(m.paid / m.clients) : 0;
    return m;
  }
  function registerHtml(m) {
    const odo = Array.from(num(m.paid)).map(ch => (/\d/.test(ch)
      ? `<span class="rx-col"><span class="rx-strip" style="transform:translateY(-${10 + Number(ch)}em)">${STRIP}</span></span>`
      : '<span class="rx-gap"></span>')).join('');
    const parts = [['ca', m.cash], ['tr', m.transfer], ['pe', m.pending]].filter(p => p[1] > 0);
    const split = parts.length
      ? parts.map(([k, v]) => `<i class="${k}" style="flex:${v} 1 0"></i>`).join('')
      : '<i style="flex:1 1 0;background:rgba(255,255,255,.08)"></i>';
    const top = Math.max(m.entries, m.goods, 1);
    return `<div class="rx-root">
      <div class="rx-live"><i></i><span>Смена открыта · с ${hhmm(m.openedAt)}${m.openedBy ? ' · ' + esc(m.openedBy) : ''}</span><b data-rx-timer>${elapsed(m.openedAt)}</b></div>
      <div class="rx-total"><span class="rx-label">Итог текущей смены · получено</span>
        <div class="rx-odo" role="img" aria-label="${esc(sum(m.paid))}">${odo}<span class="rx-cur">сом</span></div>
        <div class="rx-split" aria-hidden="true">${split}</div>
        <div class="rx-legend"><span><i class="sx-m cash"></i>Наличные <b>${sum(m.cash)}</b></span><span><i class="sx-m transfer"></i>Перевод <b>${sum(m.transfer)}</b></span>${m.pending ? `<span><i class="sx-m pending"></i>Ожидает <b>${sum(m.pending)}</b></span>` : ''}</div>
      </div>
      <div class="rx-tiles">
        <div class="rx-tile"><small>Клиентов</small><b>${num(m.clients)}</b><em>${m.active ? `активных: ${m.active}` : `завершено: ${m.done}`}</em></div>
        <div class="rx-tile"><small>Средний чек</small><b>${m.clients ? som(m.avg) : '—'}</b></div>
        <div class="rx-tile ${m.pending ? 'warn' : 'ok'}"><small>Не оплачено</small><b>${som(m.pending)}</b><em>${m.pending ? 'отметьте оплату' : '✓ всё оплачено'}</em></div>
      </div>
      <div class="rx-break"><span class="rx-label">Из чего состоит</span>
        <div class="rx-brow"><span>Входы<small>${num(m.entriesQty)} шт.</small></span><div class="px-bar"><i style="width:${(m.entries / top * 100).toFixed(1)}%"></i></div><b>${sum(m.entries)}</b></div>
        <div class="rx-brow"><span>Товары<small>${num(m.goodsQty)} шт.</small></span><div class="px-bar"><i style="width:${(m.goods / top * 100).toFixed(1)}%"></i></div><b>${sum(m.goods)}</b></div>
      </div>
      <div class="history-meta rx-note">Завершено клиентов: ${m.done}. В отчёт попадут только клиенты, созданные после открытия этой смены.</div>
    </div>`;
  }
  function startLiveTimer() {
    if (liveTimer) return;
    liveTimer = setInterval(() => {
      const el = $('#reportContent [data-rx-timer]');
      const s = app.shift();
      if (!el || !s || !s.isOpen) { clearInterval(liveTimer); liveTimer = 0; return; }
      if (document.hidden || !el.offsetParent) return;
      el.textContent = elapsed(s.openedAt);
    }, 1000);
  }
  function renderRegister() {
    const box = $('#reportContent');
    const m = shiftModel();
    const sig = JSON.stringify(m);
    if (sig !== reportSig || !box.querySelector('.rx-root')) {
      box.innerHTML = registerHtml(m);
      reportSig = sig;
    }
    startLiveTimer();
  }
  function introReport(full) {
    const v = $('#reportView');
    if (!v) return;
    const reg = $('.rx-root', v);
    const fin = $('#finishWork');
    const heads = [$('.report-panel > .eyebrow', v), $('.report-panel > .section-head', v)];
    if (!reg) { lite([...heads, $('#reportContent', v), fin]); return; }
    const live = $('.rx-live', reg), totalBox = $('.rx-total', reg), tiles = $$('.rx-tile', reg), brk = $('.rx-break', reg);
    if (!full) { lite([live, totalBox, ...tiles, brk, fin]); return; }
    heads.forEach((el, k) => A(el, K.down(10), { duration: 460, delay: k * 70, easing: EASE.out }));
    A(live, K.left(26), { duration: 540, delay: 120, easing: EASE.out });
    A(totalBox, [{ opacity: 0, transform: 'translate3d(0,24px,0) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 200, easing: EASE.out });
    $$('.rx-strip', totalBox).forEach((st, k) => A(st, [{ transform: 'translateY(0em)' }, { transform: st.style.transform }], { duration: 1150 + k * 150, delay: 320, easing: 'cubic-bezier(.2,.75,.25,1)' }));
    A($('.rx-cur', totalBox), K.fade, { duration: 400, delay: 900 });
    $$('.rx-split i', totalBox).forEach((el, k) => A(el, K.grow, { duration: 780, delay: 700 + k * 150, easing: EASE.out }));
    $$('.rx-legend > span', totalBox).forEach((el, k) => A(el, K.up(8), { duration: 420, delay: 900 + k * 90, easing: EASE.out }));
    tiles.forEach((el, k) => A(el, [{ opacity: 0, transform: 'perspective(600px) rotateX(-92deg)' }, { opacity: 1, transform: 'perspective(600px) rotateX(9deg)', offset: 0.7 }, { opacity: 1, transform: 'none' }], { duration: 740, delay: 780 + k * 120, easing: 'ease-out' }));
    A(brk, K.up(16), { duration: 540, delay: 1080, easing: EASE.out });
    $$('.rx-brow .px-bar i', reg).forEach((el, k) => A(el, K.grow, { duration: 780, delay: 1200 + k * 130, easing: EASE.out }));
    A($('.rx-note', reg), K.fade, { duration: 420, delay: 1300 });
    A(fin, K.up(16), { duration: 540, delay: 1340, easing: EASE.out });
    revealLater([brk, fin].filter(Boolean), (el, d) => A(el, K.up(16), { duration: 480, delay: d, easing: EASE.out }));
  }
  function zReport() {
    const m = shiftModel();
    const now = new Date();
    const mins = minutesBetween(m.openedAt, now);
    const row = (label, value) => `<div class="zx-row"><span>${label}</span><b>${value}</b></div>`;
    const warn = [];
    if (!m.clients) warn.push('В текущей смене нет клиентов — отчёт не сформируется.');
    if (m.active) warn.push(`Активных клиентов: ${m.active}. Сначала завершите их — иначе отчёт не отправится.`);
    if (m.pending) warn.push(`Не оплачено: ${sum(m.pending)}. Отметьте оплату перед закрытием смены.`);
    const d = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
    return `${warn.map(w => `<div class="zx-warn">${esc(w)}</div>`).join('')}<div class="zx-wrap" role="group" aria-label="Z-отчёт текущей смены">
      <div class="zx-printer" aria-hidden="true"><span class="zx-brand">PAR ORDO · KASSA</span><i class="zx-led"></i></div>
      <div class="zx-feed"><div class="zx-sway"><div class="zx-paper">
        <div class="zx-center"><div class="zx-name">ПАР ОРДО</div><div class="zx-sub">МУЖСКАЯ БАНЯ</div></div>
        <div class="zx-sep"></div>
        <div class="zx-title">Z-ОТЧЁТ · СМЕНА</div>
        <div class="zx-sep"></div>
        ${row('Открыта', esc(fullDate(m.openedAt)))}
        ${m.openedBy ? row('Открыл', esc(m.openedBy)) : ''}
        ${row('Сейчас', esc(fullDate(now)))}
        ${row('Длительность', durText(mins))}
        <div class="zx-sep"></div>
        ${row('Клиентов', num(m.clients))}
        ${row(`Входы · ${num(m.entriesQty)} шт.`, sum(m.entries))}
        ${row(`Товары · ${num(m.goodsQty)} шт.`, sum(m.goods))}
        <div class="zx-sep"></div>
        ${row('Наличные', sum(m.cash))}
        ${row('Перевод', sum(m.transfer))}
        ${row('Не оплачено', sum(m.pending))}
        <div class="zx-dbl"></div>
        <div class="zx-total"><span>ИТОГО</span><b>${sum(m.paid)}</b></div>
        <div class="zx-bar" aria-hidden="true"></div>
        <div class="zx-thanks">СПАСИБО ЗА СМЕНУ</div>
        <div class="zx-stamp" aria-hidden="true"><span>ПАР ОРДО<b>Z</b>${esc(d)}</span></div>
      </div></div></div>
    </div>`;
  }
  function printZ(card) {
    stop('z');
    const sway = $('.zx-sway', card), paper = $('.zx-paper', card);
    A($('.zx-printer', card), K.down(8), { duration: 340, easing: EASE.out }, 'z');
    A(sway, [{ transform: 'translate3d(0,-101%,0)' }, { transform: 'none' }], { duration: 1500, delay: 260, easing: 'steps(12,end)' }, 'z');
    A(paper, [{ transform: 'none' }, { transform: 'rotate(.9deg)', offset: 0.3 }, { transform: 'rotate(-.6deg)', offset: 0.65 }, { transform: 'none' }], { duration: 900, delay: 1780, easing: 'ease-in-out', fill: 'none' }, 'z');
    A($('.zx-led', card), [{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }], { duration: 300, delay: 260, iterations: 5, fill: 'none' }, 'z');
    A($('.zx-bar', card), K.grow, { duration: 520, delay: 1600, easing: EASE.out }, 'z');
    A($('.zx-stamp', card), [{ opacity: 0, transform: 'rotate(-30deg) scale(2.2)' }, { opacity: 1, transform: 'rotate(-12deg) scale(.92)', offset: 0.72 }, { opacity: 1, transform: 'rotate(-14deg) scale(1)' }], { duration: 440, delay: 1900, easing: EASE.slam }, 'z');
    $$('.zx-warn', card).forEach((el, k) => A(el, [{ opacity: 0, transform: 'translate3d(-12px,0,0)' }, { opacity: 1, transform: 'translate3d(4px,0,0)', offset: 0.7 }, { opacity: 1, transform: 'none' }], { duration: 460, delay: 120 + k * 110, easing: EASE.out }, 'z'));
  }

  /* =====================================================================
     ТОВАРЫ — decorate the smart-inventory v4 dashboard after each render
     ===================================================================== */
  const PV_KEY = 'po_sx_products_view';
  let pMode = 'grid';
  try { pMode = localStorage.getItem(PV_KEY) === 'list' ? 'list' : 'grid'; } catch (_) {}
  const RING = 2 * Math.PI * 18;
  const review = { bad: 0, total: 0, known: false };
  const metricOf = (card, k) => { const b = $$('.po-si-mini-metric b', card)[k]; return b ? (digits(b.textContent) || 0) : 0; };
  function syncToggle(wrap) {
    $$('[data-sx-view]', wrap).forEach(b => {
      const on = b.dataset.sxView === pMode;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }
  function viewsToggle() {
    const wrap = document.createElement('div');
    wrap.className = 'sx-views';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Вид категорий');
    wrap.innerHTML = `<button type="button" data-sx-view="grid">${svg(I.grid)}Сетка</button><button type="button" data-sx-view="list">${svg(I.list)}Список</button>`;
    wrap.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-sx-view]'); if (b) setMode(b.dataset.sxView); });
    syncToggle(wrap);
    return wrap;
  }
  function setMode(mode) {
    if (mode !== 'grid' && mode !== 'list') return;
    if (mode === pMode) return;
    pMode = mode;
    try { localStorage.setItem(PV_KEY, mode); } catch (_) {}
    const grid = $('#productsGrid');
    const box = grid && $('.po-si-categories', grid);
    if (grid) $$('.sx-views', grid).forEach(syncToggle);
    if (!box) return;
    stop('products');
    box.classList.toggle('sx-list', mode === 'list');
    if (mode === 'list') scanIntro(box, false); else shelfIntro(box, false);
  }
  function updateCheck(kp, grid) {
    const check = $('.sx-check', kp);
    if (!check) return;
    const banner = $('.po-si-review', grid);
    const all = $('[data-po-category-open="Все товары"] .po-si-cat-meta', grid);
    if ($('.po-si-categories', grid)) {
      const search = $('#poSiSearch', grid), filter = $('#poSiFilter', grid);
      const filtered = !!((search && search.value.trim()) || (filter && filter.value && filter.value !== 'all'));
      review.bad = banner ? (digits($('b', banner) && $('b', banner).textContent) || 0) : 0;
      if (!filtered || !review.known) review.total = all ? (digits(all.textContent) || 0) : 0;
      review.known = true;
    }
    if (banner) banner.classList.add('sx-hidden');
    const { bad, total: count } = review;
    const ok = count ? clamp((count - bad) / count, 0, 1) : 1;
    const html = `<span class="sx-check-top"><span class="sx-ring"><svg viewBox="0 0 44 44" aria-hidden="true"><circle class="bg" cx="22" cy="22" r="18"/><circle class="fg" cx="22" cy="22" r="18" stroke-dasharray="${RING.toFixed(1)}" stroke-dashoffset="${(RING * (1 - ok)).toFixed(1)}"/></svg><b>${bad ? num(bad) : '✓'}</b></span><small>${bad ? 'Проверить категории' : 'Категории в порядке'}</small></span>`
      + `<span>${bad ? `${num(bad)} из ${num(count)} товаров: система предлагает другую категорию.` : 'Все товары распределены по категориям.'}</span>`
      + (bad ? '<em>Открыть список →</em>' : '');
    if (check.dataset.sig !== html) { check.innerHTML = html; check.dataset.sig = html; }
    check.classList.toggle('is-ok', !bad);
    check.disabled = !bad;
  }
  function openAllProducts() {
    let grid = $('#productsGrid');
    if (!grid) return;
    const back = $('[data-po-back]', grid);
    if (back) { back.click(); grid = $('#productsGrid'); }
    const all = $('[data-po-category-open="Все товары"]', grid);
    if (all) all.click();
  }
  function decorateKpis(kp, grid) {
    if ($('.sx-hero', kp)) { updateCheck(kp, grid); return; }
    const tiles = $$('.po-si-kpi', kp);
    if (tiles.length < 4) { kp.classList.remove('sx-kpis'); return; }
    const val = k => digits($('strong', tiles[k]) && $('strong', tiles[k]).textContent);
    const stock = val(0), sold = val(1), rev = val(2);
    if (![stock, sold, rev].every(Number.isFinite)) { kp.classList.remove('sx-kpis'); return; }
    const share = sold + stock ? Math.round(sold / (sold + stock) * 100) : 0;
    const hero = document.createElement('div');
    hero.className = 'sx-hero';
    hero.innerHTML = `<div class="sx-hero-top"><small>Продано на сумму</small><span>${share}% продано</span></div>`
      + `<div class="sx-hero-sum"><b data-sx-count="${rev}">${num(rev)}</b><small>сом</small></div>`
      + `<div class="sx-split" aria-hidden="true">${sold + stock ? `<i class="s1" style="flex:${sold} 1 0"></i><i class="s2" style="flex:${stock} 1 0"></i>` : '<i style="flex:1 1 0;background:rgba(255,255,255,.08)"></i>'}</div>`
      + `<div class="sx-legend"><span><i style="background:#ffd77a"></i>Продано <b>${num(sold)} шт.</b></span><span><i style="background:#4ff09a"></i>На складе <b>${num(stock)} шт.</b></span></div>`;
    tiles.slice(0, 3).forEach(el => el.classList.add('sx-hidden'));
    kp.insertBefore(hero, kp.firstChild);
    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'sx-check';
    check.addEventListener('click', openAllProducts);
    kp.appendChild(check);
    kp.classList.add('sx-kpis');
    updateCheck(kp, grid);
  }
  function decorateCategories(grid) {
    const box = $('.po-si-categories', grid);
    if (!box) return;
    const tools = $('.po-si-dashboard-tools', grid);
    if (tools && !$('.sx-views', tools)) tools.appendChild(viewsToggle());
    box.classList.toggle('sx-list', pMode === 'list');
    if (box.dataset.sx === '1') return;
    box.dataset.sx = '1';
    const cards = $$('.po-si-category', box);
    const allCard = cards.find(c => c.dataset.poCategoryOpen === 'Все товары');
    const allRev = allCard ? metricOf(allCard, 2) : cards.reduce((s, c) => s + metricOf(c, 2), 0);
    const empty = [];
    cards.forEach(card => {
      const name = card.dataset.poCategoryOpen || '';
      const stock = metricOf(card, 0), sold = metricOf(card, 1), rev = metricOf(card, 2);
      const count = digits($('.po-si-cat-meta', card) && $('.po-si-cat-meta', card).textContent) || 0;
      const isAll = name === 'Все товары';
      card.classList.add('sx-cat');
      if (isAll) card.classList.add('sx-all');
      const icon = $('.po-si-cat-icon', card);
      if (icon) icon.innerHTML = svg(CAT_ICON[name] || CAT_ICON['Прочее']);
      const meta = $('.po-si-cat-meta', card);
      if (meta) meta.textContent = `${num(count)} ${plural(count, 'товар', 'товара', 'товаров')}`;
      const thru = sold + stock ? sold / (sold + stock) * 100 : 0;
      const share = isAll ? '' : `<em class="sx-share">${allRev ? Math.round(rev / allRev * 100) : 0}%</em>`;
      card.insertAdjacentHTML('beforeend', `<span class="sx-cat-sum"><span><b>${num(rev)}</b> <small>сом</small></span>${share}</span>`
        + `<span class="sx-bar" title="Продано ${num(sold)} из ${num(sold + stock)} шт."><i style="width:${thru.toFixed(1)}%"></i></span>`
        + `<span class="sx-cat-meta"><span>Продано <b>${num(sold)}</b></span><span>Остаток <b>${num(stock)}</b></span></span>`
        + '<i class="sx-shelf" aria-hidden="true"></i>');
      if (!count && !isAll) { card.classList.add('sx-void'); empty.push(card); }
    });
    empty.forEach(c => box.appendChild(c));
  }
  function decorateProducts() {
    const kp = $('#inventoryKpis'), grid = $('#productsGrid');
    if (!kp || !grid) return;
    try { decorateKpis(kp, grid); } catch (e) { console.warn('PAR ORDO sections: products kpi', e); }
    try { decorateCategories(grid); } catch (e) { console.warn('PAR ORDO sections: categories', e); }
  }
  function dropCard(card, d, full) {
    A(card, [
      { opacity: 0, transform: 'translate3d(0,-64px,0)', easing: EASE.fall },
      { opacity: 1, transform: 'translate3d(0,0,0) scale(1.04,.9)', offset: 0.55, easing: EASE.rise },
      { opacity: 1, transform: 'translate3d(0,-6px,0) scale(.98,1.03)', offset: 0.78, easing: 'ease-in-out' },
      { opacity: 1, transform: 'none' }
    ], { duration: full ? 760 : 560, delay: d }, 'products');
    A($('.sx-shelf', card), [{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: d + 330, easing: EASE.out }, 'products');
    A($('.po-si-cat-icon', card), [{ opacity: 0, transform: 'scale(.3) rotate(-28deg)' }, { opacity: 1, transform: 'scale(1.18) rotate(6deg)', offset: 0.6 }, { opacity: 1, transform: 'none' }], { duration: 580, delay: d + 380, easing: 'ease-out' }, 'products');
    A($('.sx-bar i', card), K.grow, { duration: 760, delay: d + 430, easing: EASE.out }, 'products');
    const n = $('.sx-cat-sum b', card);
    countUp(n, digits(n && n.textContent), 820, d + 300);
  }
  function shelfIntro(box, full) {
    const cards = $$('.po-si-category', box);
    const base = full ? 470 : 40;
    cards.filter(c => onScreen(c, 40)).forEach((card, k) => dropCard(card, base + k * (full ? 75 : 45), full));
    if (full) revealLater(cards, (card, d) => dropCard(card, d, false));
  }
  function scanIntro(box, full) {
    const rows = $$('.po-si-category', box).filter(r => onScreen(r, 40));
    if (!rows.length) return;
    const top = box.getBoundingClientRect().top;
    const last = rows[rows.length - 1].getBoundingClientRect();
    const dist = Math.max(40, last.bottom - top);
    const d0 = full ? 440 : 60;
    const dur = clamp(rows.length * 115, 650, 1400);
    if (full) A(box, K.up(14), { duration: 440, delay: 380, easing: EASE.out }, 'products');
    if (motion) {
      const beam = document.createElement('i');
      beam.className = 'sx-beam';
      beam.setAttribute('aria-hidden', 'true');
      box.appendChild(beam);
      const a = A(beam, [{ opacity: 1, transform: 'translate3d(0,0,0)' }, { opacity: 1, transform: `translate3d(0,${dist.toFixed(0)}px,0)`, offset: 0.92 }, { opacity: 0, transform: `translate3d(0,${dist.toFixed(0)}px,0)` }], { duration: dur, delay: d0, easing: 'linear', fill: 'both' }, 'products');
      const rm = () => beam.remove();
      if (a) a.finished.then(rm, rm); else rm();
    }
    rows.forEach(r => {
      const rr = r.getBoundingClientRect();
      scanRow(r, d0 + dur * 0.92 * clamp((rr.top + rr.height / 2 - top) / dist, 0, 1));
    });
    if (full) revealLater($$('.po-si-category', box), (r, d) => scanRow(r, d + 60));
  }
  function scanRow(r, t) {
    A(r, K.left(10), { duration: 320, delay: Math.max(0, t - 70), easing: EASE.out }, 'products');
    if (motion) {
      const f = document.createElement('i');
      f.className = 'sx-flash';
      f.setAttribute('aria-hidden', 'true');
      r.appendChild(f);
      const fa = A(f, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: 620, delay: t, fill: 'both' }, 'products');
      const rm = () => f.remove();
      if (fa) fa.finished.then(rm, rm); else rm();
    }
    scramble($('.sx-cat-sum b', r), 420, t);
  }
  function introProducts(full) {
    decorateProducts();
    const v = $('#productsView'), kp = $('#inventoryKpis'), grid = $('#productsGrid');
    if (!v || !kp || !grid) return;
    stop('products');
    const head = $('.section-head', v);
    const box = $('.po-si-categories', grid);
    if (!full) {
      lite([head, kp, $('.po-si-dashboard-tools', grid), $('.po-si-detail-head', grid)]);
      if (box) A(box, K.up(10), { duration: 340, delay: 120, easing: EASE.out });
      return;
    }
    A(head, K.down(12), { duration: 520, easing: EASE.out });
    const hero = $('.sx-hero', kp);
    if (hero) {
      A(hero, [{ opacity: 0, transform: 'translate3d(0,28px,0) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 660, delay: 80, easing: EASE.out });
      const n = $('[data-sx-count]', hero);
      countUp(n, Number(n && n.dataset.sxCount), 1150, 260);
      $$('.sx-split i', hero).forEach((el, k) => A(el, K.grow, { duration: 820, delay: 440 + k * 130, easing: EASE.out }));
      $$('.sx-legend > span', hero).forEach((el, k) => A(el, K.up(8), { duration: 420, delay: 600 + k * 90, easing: EASE.out }));
    }
    $$('.po-si-kpi:not(.sx-hidden), .sx-check', kp).forEach((el, k) => A(el, [{ opacity: 0, transform: 'translate3d(0,-24px,0)' }, { opacity: 1, transform: 'translate3d(0,3px,0)', offset: 0.75 }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 260 + k * 100, easing: EASE.out }));
    const fg = $('.sx-ring .fg', kp);
    if (fg) A(fg, [{ strokeDashoffset: RING.toFixed(1) }, { strokeDashoffset: fg.getAttribute('stroke-dashoffset') }], { duration: 900, delay: 420, easing: EASE.out });
    A($('.po-si-dashboard-tools', grid), K.up(10), { duration: 460, delay: 380, easing: EASE.out });
    if (box) { if (pMode === 'list') scanIntro(box, true); else shelfIntro(box, true); }
    else A($('.po-si-detail-head', grid), K.up(14), { duration: 500, delay: 380, easing: EASE.out });
  }
  function setupProducts() {
    const grid = $('#productsGrid'), kp = $('#inventoryKpis');
    if (!grid || !kp) return;
    const mo = new MutationObserver(() => { decorateProducts(); mo.takeRecords(); });
    mo.observe(grid, { childList: true });
    mo.observe(kp, { childList: true });
    decorateProducts();
    mo.takeRecords();
  }

  /* =====================================================================
     МЕНЮ — medallion, groups, live badges and an entrance
     ===================================================================== */
  function badge(drawer, sel, text, tone) {
    const b = $(sel, drawer);
    if (!b) return;
    let el = $('.sx-badge', b);
    if (!text) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('span'); b.insertBefore(el, $('.drawer-chevron', b)); }
    el.className = 'sx-badge ' + tone;
    el.textContent = text;
  }
  function updateDrawer(drawer) {
    const s = app.shift() || {};
    const view = app.view();
    $$('[data-drawer-view]', drawer).forEach(b => b.classList.toggle('sx-current', b.dataset.drawerView === view));
    const open = !!(s.isOpen && !s.isClosing);
    const m = open ? shiftModel() : null;
    const box = $('.sx-shift', drawer);
    if (box) {
      box.classList.toggle('is-closed', !open);
      box.innerHTML = open
        ? `<div><b>Смена открыта</b><small>с ${hhmm(s.openedAt)} · ${durText(minutesBetween(s.openedAt, new Date()))}</small></div><strong>${sum(m.paid)}</strong>`
        : `<div><b>${s.isClosing ? 'Смена закрывается' : 'Смена закрыта'}</b><small>${s.isClosing ? 'Отчёт сохраняется на сервере' : 'Откройте смену на главном экране'}</small></div>`;
    }
    badge(drawer, '[data-drawer-view="homeView"]', m && m.active ? `${m.active} акт.` : '', 'green');
    const h = completedClients(false).length;
    badge(drawer, '[data-drawer-view="historyView"]', h ? num(h) : '', 'muted');
    badge(drawer, '[data-drawer-view="reportView"]', m && m.paid ? sum(m.paid) : '', 'gold');
  }
  let drawerQueued = false;
  function refreshDrawer() {
    if (drawerQueued) return;
    drawerQueued = true;
    requestAnimationFrame(() => {
      drawerQueued = false;
      const drawer = $('#drawer');
      if (drawer && drawer.dataset.sx === '1') { try { updateDrawer(drawer); } catch (_) {} }
    });
  }
  function drawerIntro(drawer) {
    stop('drawer');
    const panel = $('.drawer-panel', drawer);
    A(drawer, K.fade, { duration: 260, easing: 'ease-out' }, 'drawer');
    A(panel, [{ transform: 'translate3d(-104%,0,0)' }, { transform: 'none' }], { duration: 500, easing: EASE.out }, 'drawer');
    A($('.sx-medal', drawer), [{ opacity: 0, transform: 'translate3d(-70px,0,0) rotate(-240deg) scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 860, delay: 110, easing: EASE.out }, 'drawer');
    $$('.drawer-brand h2, .drawer-brand small, #loggedUser, .sx-shift', drawer).forEach((el, k) => A(el, K.up(10), { duration: 440, delay: 260 + k * 60, easing: EASE.out }, 'drawer'));
    $$('.drawer-links > *', drawer).filter(el => el.offsetParent !== null).forEach((el, k) => A(el, K.left(24), { duration: 440, delay: 320 + k * 32, easing: EASE.out }, 'drawer'));
    $$('.sx-badge', drawer).forEach((el, k) => A(el, K.pop, { duration: 440, delay: 640 + k * 70, easing: 'ease-out' }, 'drawer'));
  }
  function setupDrawer() {
    const drawer = $('#drawer');
    if (!drawer || drawer.dataset.sx === '1') return;
    drawer.dataset.sx = '1';
    const img = $('.drawer-brand img', drawer);
    if (img && !img.closest('.sx-medal')) {
      const medal = document.createElement('span');
      medal.className = 'sx-medal';
      medal.innerHTML = '<i class="sx-ring-spin" aria-hidden="true"></i>';
      img.parentNode.insertBefore(medal, img);
      medal.appendChild(img);
      const original = img.getAttribute('src');
      img.addEventListener('error', () => {
        if (img.dataset.sxFallback || !original) return;
        img.dataset.sxFallback = '1';
        img.style.display = '';
        img.src = original;
      });
      img.src = './assets/par-ordo-deal-logo.webp';
    }
    const links = $('.drawer-links', drawer);
    const group = (sel, label) => {
      const b = links && $(sel, links);
      if (b && !(b.previousElementSibling && b.previousElementSibling.classList.contains('sx-dgroup'))) b.insertAdjacentHTML('beforebegin', `<div class="sx-dgroup">${label}</div>`);
    };
    group('[data-drawer-view="homeView"]', 'Работа');
    group('[data-drawer-view="archiveView"]', 'Касса');
    group('#openManagerLogin', 'Управление');
    const user = $('#loggedUser', drawer);
    if (user && !$('.sx-shift', drawer)) user.insertAdjacentHTML('afterend', '<div class="sx-shift"></div>');
    let wasOpen = drawer.classList.contains('open');
    new MutationObserver(() => {
      const open = drawer.classList.contains('open');
      if (open && !wasOpen) {
        try { updateDrawer(drawer); } catch (e) { console.warn('PAR ORDO sections: menu', e); }
        if (motion) drawerIntro(drawer);
      }
      wasOpen = open;
    }).observe(drawer, { attributes: true, attributeFilter: ['class'] });
  }

  /* =====================================================================
     ВХОД РУКОВОДИТЕЛЯ — lock emblem, busy ring, shake on error, unlock
     ===================================================================== */
  let unlockUntil = 0;
  let kpiIntroAt = 0;
  function loginIntro(modal) {
    const card = $('.manager-login-card', modal), lock = $('.sx-lock', modal);
    if (lock) lock.classList.remove('is-open', 'is-busy', 'is-error');
    if (card) card.classList.remove('sx-ok');
    if (!motion) return;
    stop('login');
    A(modal, K.fade, { duration: 240, easing: 'ease-out' }, 'login');
    A(card, [{ opacity: 0, transform: 'translate3d(0,36px,0) scale(.95)' }, { opacity: 1, transform: 'none' }], { duration: 580, easing: EASE.out }, 'login');
    A(lock, [{ opacity: 0, transform: 'translate3d(0,-28px,0) rotate(-90deg) scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 760, delay: 120, easing: EASE.spring }, 'login');
    $$('.modal-head .eyebrow, .modal-head h2, .modal-head .history-meta, .customer-base-field, #managerLoginSubmit', modal).forEach((el, k) => A(el, K.up(12), { duration: 440, delay: 230 + k * 60, easing: EASE.out }, 'login'));
  }
  function loginError(card, lock) {
    if (lock) {
      lock.classList.remove('is-error');
      void lock.offsetWidth;
      lock.classList.add('is-error');
      setTimeout(() => lock.classList.remove('is-error'), 900);
    }
    A(card, [{ transform: 'none' }, { transform: 'translate3d(-11px,0,0)' }, { transform: 'translate3d(9px,0,0)' }, { transform: 'translate3d(-6px,0,0)' }, { transform: 'translate3d(3px,0,0)' }, { transform: 'none' }], { duration: 480, easing: 'ease-in-out', fill: 'none' }, 'login');
  }
  function showUnlock() {
    const ov = document.createElement('div');
    ov.className = 'sx-unlock';
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = `<div class="sx-unlock-box"><div class="sx-lock"><i class="sx-ring-spin"></i>${LOCK}</div><span>Доступ открыт</span></div>`;
    document.body.appendChild(ov);
    const lock = $('.sx-lock', ov), label = $('.sx-unlock-box > span', ov);
    const T = 1100;
    unlockUntil = performance.now() + T;
    A(ov, [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.78 }, { opacity: 0 }], { duration: T, easing: 'linear', fill: 'both' }, 'unlock');
    A(lock, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'none' }], { duration: 440, easing: EASE.spring }, 'unlock');
    A(label, K.up(8), { duration: 380, delay: 440, easing: EASE.out }, 'unlock');
    const t1 = setTimeout(() => lock.classList.add('is-open'), 300);
    const t2 = setTimeout(() => { ov.remove(); unlockUntil = 0; }, T + 40);
    return { abort() { clearTimeout(t1); clearTimeout(t2); ov.remove(); unlockUntil = 0; } };
  }
  function setupLogin() {
    const modal = $('#managerLoginModal'), form = $('#managerLoginForm');
    if (!modal || !form || $('.sx-lock', form)) return;
    form.insertAdjacentHTML('afterbegin', `<div class="sx-lock" aria-hidden="true"><i class="sx-ring-spin"></i>${LOCK}</div>`);
    const lock = $('.sx-lock', form), btn = $('#managerLoginSubmit'), err = $('#managerLoginError');
    let wasOpen = modal.classList.contains('open');
    new MutationObserver(() => {
      const open = modal.classList.contains('open');
      if (open && !wasOpen) loginIntro(modal);
      wasOpen = open;
    }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    if (btn) new MutationObserver(() => lock.classList.toggle('is-busy', !!btn.disabled)).observe(btn, { attributes: true, attributeFilter: ['disabled'] });
    if (err) new MutationObserver(() => { if (err.textContent.trim()) loginError(form, lock); }).observe(err, { childList: true, characterData: true, subtree: true });
  }
  function introManager(full) {
    const v = $('#managerView');
    if (!v) return;
    const w = unlockUntil ? Math.max(0, unlockUntil - performance.now() - 280) : 0;
    const hero = $('.manager-hero', v);
    if (!full && !w) { lite([hero, $('#managerKpis', v), $('.manager-actions', v)]); return; }
    A(hero, [{ opacity: 0, transform: 'translate3d(0,-30px,0) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 660, delay: w, easing: EASE.out });
    kpiIntroAt = performance.now() + w + 170;
    $$('#managerKpis > .manager-kpi', v).forEach((el, k) => A(el, [{ opacity: 0, transform: 'perspective(700px) rotateX(-80deg)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: w + 170 + k * 85, easing: EASE.out }));
    $$('.manager-section-title', v).filter(el => onScreen(el, 0)).forEach((el, k) => A(el, K.up(14), { duration: 480, delay: w + 320 + k * 220, easing: EASE.out }));
    $$('.manager-action', v).filter(el => onScreen(el, 60)).forEach((el, k) => A(el, [{ opacity: 0, transform: 'translate3d(0,18px,0) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 540, delay: w + 400 + k * 55, easing: EASE.out }));
    const lower = [$('#managerTopProducts', v), $('.manager-profit-title', v), $('#managerProfitPanel', v)].filter(Boolean);
    lower.filter(el => onScreen(el, 0)).forEach((el, k) => A(el, K.up(16), { duration: 500, delay: w + 760 + k * 110, easing: EASE.out }));
    revealLater([...$$('.manager-section-title', v), ...$$('.manager-action', v), ...lower], (el, d) => A(el, K.up(16), { duration: 480, delay: d, easing: EASE.out }));
  }
  function watchManagerKpis() {
    const box = $('#managerKpis');
    if (!box) return;
    new MutationObserver(() => {
      if (!motion || !box.children.length || !$('#managerView.active')) return;
      const left = kpiIntroAt - performance.now();
      if (left > -300) {
        $$('.manager-kpi', box).forEach((el, k) => A(el, [{ opacity: 0, transform: 'perspective(700px) rotateX(-80deg)' }, { opacity: 1, transform: 'none' }], { duration: 560, delay: Math.max(0, left) + k * 85, easing: EASE.out }));
        return;
      }
      if (/Загрузка/.test(box.textContent)) return;
      $$('.manager-kpi strong', box).forEach((el, k) => A(el, [{ opacity: 0, transform: 'perspective(500px) rotateX(90deg)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: k * 75, easing: EASE.out }, 'kpi'));
    }).observe(box, { childList: true });
  }

  /* =====================================================================
     wiring
     ===================================================================== */
  const visited = new Set();
  const INTROS = { historyView: introHistory, archiveView: introArchive, reportView: introReport, productsView: introProducts, managerView: introManager };
  function toTop() {
    if ((window.scrollY || 0) <= 0) return;
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (_) { window.scrollTo(0, 0); }
  }
  function enter(view, prev) {
    if (view !== prev) clearReveal();
    if (!INTROS[view]) return;
    stop('view');
    stop('products');
    if (!motion || view === prev || root.classList.contains('po-vault-on')) return;
    const full = !visited.has(view);
    visited.add(view);
    toTop();
    try { INTROS[view](full); } catch (e) { console.warn('PAR ORDO sections: intro', e); }
  }
  function wrap(name, make) {
    const original = window[name];
    if (typeof original !== 'function') return false;
    window[name] = make(original);
    return true;
  }
  function install() {
    if (typeof db === 'undefined' || typeof window.navigate !== 'function' || typeof window.renderHistory !== 'function'
      || typeof window.renderArchive !== 'function' || typeof window.renderReport !== 'function') return false;
    root.classList.add('po-sx');

    window.renderHistory = function () {
      try { renderHistorySx(); } catch (e) { console.warn('PAR ORDO sections: history', e); }
      refreshDrawer();
    };
    window.renderArchive = function () {
      try { renderArchiveSx(); } catch (e) { console.warn('PAR ORDO sections: archive', e); }
    };
    wrap('renderReport', original => function () {
      const s = app.shift();
      if (!s || !s.isOpen || s.isClosing || !$('#reportContent')) { reportSig = ''; return original.apply(this, arguments); }
      try {
        if (typeof renderHistoricalReportAdmin === 'function') renderHistoricalReportAdmin();
        const finish = $('#finishWork');
        if (finish) finish.hidden = !s.isOpen;
        renderRegister();
        refreshDrawer();
      } catch (e) {
        console.warn('PAR ORDO sections: report', e);
        reportSig = '';
        return original.apply(this, arguments);
      }
      return undefined;
    });
    wrap('confirmAction', original => function (title) {
      const result = original.apply(this, arguments);
      try {
        const card = $('#confirmModalCard');
        if (card) {
          stop('z');
          card.classList.remove('zx-on');
          if (String(title) === 'Завершить рабочую смену?') {
            const cta = $('.modal-cta', card);
            if (cta) {
              cta.insertAdjacentHTML('beforebegin', zReport());
              card.classList.add('zx-on');
              card.scrollTop = 0;
              if (motion) printZ(card);
            }
          }
        }
      } catch (e) { console.warn('PAR ORDO sections: z-report', e); }
      return result;
    });
    wrap('closeModal', original => function (sel) {
      let overlay = null;
      try {
        const btn = $('#managerLoginSubmit');
        if (motion && sel === '#managerLoginModal' && btn && btn.disabled) {
          const card = $('#managerLoginModal .manager-login-card');
          if (card) card.classList.add('sx-ok');
          overlay = showUnlock();
        }
      } catch (_) {}
      const result = original.apply(this, arguments);
      if (overlay) Promise.resolve().then(() => { if (!$('#managerView.active')) overlay.abort(); });
      return result;
    });
    wrap('navigate', original => function (view) {
      const prev = app.view();
      const result = original.apply(this, arguments);
      try { enter(view, prev); } catch (e) { console.warn('PAR ORDO sections: navigate', e); }
      refreshDrawer();
      return result;
    });

    const refreshReport = $('#refreshReport');
    if (refreshReport) refreshReport.onclick = () => {
      reportSig = '';
      window.renderReport();
      lite($$('#reportContent .rx-total, #reportContent .rx-tile, #reportContent .rx-break'));
    };
    const refreshArchive = $('#refreshArchive');
    if (refreshArchive) refreshArchive.onclick = () => {
      ax.sig = '';
      window.renderArchive();
      lite($$('#archiveList .ax-folder').slice(0, 3));
    };

    [setupProducts, setupDrawer, setupLogin, watchManagerKpis].forEach(fn => { try { fn(); } catch (e) { console.warn('PAR ORDO sections: setup', e); } });
    try { window.renderHistory(); window.renderArchive(); window.renderReport(); } catch (_) {}
    refreshDrawer();

    window.PARORDOSections = Object.freeze({
      version: VERSION,
      motion,
      replay(view) { visited.delete(view); enter(view || app.view(), ''); },
      setProductsView: setMode
    });
    return true;
  }
  const start = () => {
    try {
      if (install()) return;
    } catch (e) { console.warn('PAR ORDO sections', e); return; }
    let tries = 0;
    const timer = setInterval(() => {
      let done = false;
      try { done = install(); } catch (_) { done = true; }
      if (done || ++tries > 40) clearInterval(timer);
    }, 250);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
