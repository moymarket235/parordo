/* PAR ORDO PRO — EXPENSES V1 · «Расходы бани»
   Variant 1 «Гроссбух» shows the month: one total, categories and a ledger by day.
   Variant 3 «Тез кошуу» adds an expense with a keypad (amount, category, payment, date).

   Saving goes through the app's own saveExpenseEntry(): the hidden original form is filled first,
   so the API request, validation, toast and reload stay exactly the app's. This file makes no
   API calls of its own. renderExpenseData() is replaced (same globals, new markup) and falls
   back to the original on any error; loadExpenses() and navigate() are wrapped.
   prefers-reduced-motion: the new design without motion. */
(() => {
  'use strict';
  if (window.PARORDOExpenses) return;

  const VERSION = '1.0.0';
  const root = document.documentElement;
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const motion = !reduced && typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const EASE = { out: 'cubic-bezier(.16,1,.3,1)', spring: 'cubic-bezier(.34,1.56,.64,1)', inOut: 'cubic-bezier(.65,0,.35,1)', slam: 'cubic-bezier(.5,0,.75,0)' };
  const K = {
    up: (y = 14) => [{ opacity: 0, transform: `translate3d(0,${y}px,0)` }, { opacity: 1, transform: 'none' }],
    down: (y = 12) => [{ opacity: 0, transform: `translate3d(0,${-y}px,0)` }, { opacity: 1, transform: 'none' }],
    left: (x = 18) => [{ opacity: 0, transform: `translate3d(${-x}px,0,0)` }, { opacity: 1, transform: 'none' }],
    right: (x = 24) => [{ opacity: 0, transform: `translate3d(${x}px,0,0)` }, { opacity: 1, transform: 'none' }],
    fade: [{ opacity: 0 }, { opacity: 1 }],
    grow: [{ transform: 'scaleX(0)' }, { transform: 'none' }],
    stamp: [{ opacity: 0, transform: 'scale(1.9) rotate(-8deg)' }, { opacity: 1, transform: 'scale(.93)', offset: 0.7 }, { opacity: 1, transform: 'none' }],
    write: [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }]
  };

  /* the seven categories of the original <select id="expenseCategory"> */
  const CATS = [
    { key: 'rem', value: 'Ремонт и обслуживание', short: 'Ремонт' },
    { key: 'mat', value: 'Расходные материалы для бани', short: 'Материалы для бани' },
    { key: 'hoz', value: 'Хозяйственные товары и уборка', short: 'Хозтовары' },
    { key: 'ele', value: 'Электричество / вода / газ', short: 'Свет, вода, газ' },
    { key: 'zp', value: 'Зарплата сотрудникам', short: 'Зарплата' },
    { key: 'tax', value: 'Налоги и комиссии', short: 'Налоги' },
    { key: 'oth', value: 'Прочее', short: 'Прочее' }
  ];
  const ICON = {
    rem: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.6-.3-.3-2.6z"/>',
    ele: '<path d="M13 3L5.5 13.5H11l-1 7.5 7.5-10.5H12z"/>',
    hoz: '<path d="M5 9h14l-1.6 11H6.6z"/><path d="M8 9a4 4 0 0 1 8 0"/>',
    mat: '<path d="M12 21v-7.5"/><path d="M12 13.5C8 12.6 5.8 9.2 6 4.5c3.6.6 6 3.4 6 9z"/><path d="M12 13.5c4-.9 6.2-4.3 6-9-3.6.6-6 3.4-6 9z"/>',
    zp: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5a5.5 5.5 0 0 1 9.4-3.9"/><circle cx="17" cy="16" r="3.5"/><path d="M17 14.5v3"/>',
    tax: '<path d="M6 18L18 6"/><circle cx="7.5" cy="7.5" r="2"/><circle cx="16.5" cy="16.5" r="2"/>',
    oth: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>'
  };
  const UI = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    note: '<path d="M5 4.5h14v15H5z"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    cash: '<rect x="3.5" y="6.5" width="17" height="11" rx="2"/><circle cx="12" cy="12" r="2.5"/>',
    card: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M3.5 10h17M7 14.5h4"/>',
    dots: '<circle cx="6.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="17.5" cy="12" r="1.2"/>',
    backspace: '<path d="M9 6h10a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 18H9l-5.5-6z"/><path d="M12 9.5l5 5M17 9.5l-5 5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>'
  };
  const METHOD = { cash: 'Наличные', transfer: 'Перевод', other: 'Другое' };
  const MCLS = { cash: 'green', transfer: 'blue', other: 'muted' };
  const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  const MONTHS_G = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

  const svg = (body, cls = 'lx-svg') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
  const esc = v => (typeof escapeHtml === 'function'
    ? escapeHtml(v)
    : String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const num = v => Math.round(Number(v) || 0).toLocaleString('ru-RU');
  const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
  const pad = n => String(n).padStart(2, '0');
  const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayISO = () => { try { if (typeof localISODate === 'function') return localISODate(); } catch (_) {} return isoOf(new Date()); };
  const parseISO = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const shiftISO = (iso, days) => { const d = parseISO(iso); if (!d) return iso; d.setDate(d.getDate() + days); return isoOf(d); };
  const shortDate = iso => { const d = parseISO(iso); return d ? `${WD[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}` : '—'; };
  const catOf = name => CATS.find(c => c.value === name) || CATS[CATS.length - 1];
  const methodOf = m => (m === 'cash' || m === 'transfer' ? m : 'other');
  const recKey = r => [r && r.id, r && r.createdAt, r && r.title, r && r.amount, r && r.spentAt].map(x => (x == null ? '' : String(x))).join('|');
  const readOnly = () => !!(document.body && document.body.classList.contains('manager-readonly'));
  const viewActive = () => !!$('#expensesView.active');
  const onScreen = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0; };
  const records = () => { try { return Array.isArray(expenseRecords) ? expenseRecords : []; } catch (_) { return []; } };
  const summary = () => { try { return expenseSummaryData || {}; } catch (_) { return {}; } };
  const toastSafe = m => { try { if (typeof toast === 'function') toast(m); } catch (_) {} };

  function dayTitle(iso) {
    const d = parseISO(iso);
    if (!d) return 'Без даты';
    const t = todayISO();
    const base = `${WD[d.getDay()]}, ${d.getDate()} ${MONTHS_G[d.getMonth()]}`;
    if (iso === t) return 'Сегодня · ' + base;
    if (iso === shiftISO(t, -1)) return 'Вчера · ' + base;
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

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
  function stop(group = 'view') {
    const set = groups.get(group);
    if (!set) return;
    set.forEach(a => { try { a.cancel(); } catch (_) {} });
    set.clear();
  }
  function countTo(el, from, to, ms, delay, prefix) {
    if (!motion || !el || from === to) return;
    const t0 = performance.now() + (delay || 0);
    const pre = prefix || '';
    const step = now => {
      if (!el.isConnected) return;
      if (now < t0) { el.textContent = (from ? pre : '') + num(from); requestAnimationFrame(step); return; }
      const k = Math.min(1, (now - t0) / ms);
      const v = from + (to - from) * (1 - Math.pow(1 - k, 3));
      el.textContent = (to || v ? pre : '') + num(v);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function shake(el, group = 'kx') {
    A(el, [{ transform: 'none' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(-5px)' }, { transform: 'translateX(3px)' }, { transform: 'none' }], { duration: 400, easing: 'ease-in-out', fill: 'none' }, group);
  }

  /* =====================================================================
     VARIANT 1 · «Гроссбух» — rendered into the app's own containers
     ===================================================================== */
  let sig = '';
  let lastTotal = null;
  let limit = 40;
  let introPending = '';
  let seen = false;
  let pendingNew = null;
  let waitTimer = 0;

  /* while the entrance waits for data the FAB stays invisible, so it does not flash before it pops */
  function setPending(kind) {
    introPending = kind || '';
    root.classList.toggle('po-ex-wait', !!introPending);
    clearTimeout(waitTimer);
    if (introPending) waitTimer = setTimeout(() => root.classList.remove('po-ex-wait'), 5000);
  }

  function heroHtml(s, recs) {
    const t = todayISO();
    const d = parseISO(t) || new Date();
    const month = t.slice(0, 7);
    const monthRecs = recs.filter(r => String(r && r.spentAt || '').slice(0, 7) === month);
    const total = Number(s.monthTotal) || 0;
    const count = Number(s.countMonth) || monthRecs.length;
    const biggest = monthRecs.reduce((m, r) => Math.max(m, Number(r.amount) || 0), 0);
    const by = { cash: 0, transfer: 0, other: 0 };
    monthRecs.forEach(r => { by[methodOf(r.method)] += Number(r.amount) || 0; });
    const parts = [['ca', by.cash], ['tr', by.transfer], ['ot', by.other]].filter(p => p[1] > 0);
    const legend = [
      by.cash ? `<span><em style="background:#69f0a0"></em>Наличные <b>${num(by.cash)} сом</b></span>` : '',
      by.transfer ? `<span><em style="background:#8fb6ff"></em>Перевод <b>${num(by.transfer)} сом</b></span>` : '',
      by.other ? `<span><em style="background:#b9ab98"></em>Другое <b>${num(by.other)} сом</b></span>` : ''
    ].join('');
    return `<section class="lx-card lx-hero">
      <div class="lx-top"><span class="lx-label">Расходы · ${MONTHS[d.getMonth()]} ${d.getFullYear()}</span><span class="lx-pill">${num(count)} ${plural(count, 'запись', 'записи', 'записей')}</span></div>
      <div class="lx-sum"><b data-lx-total="${total}">${total ? '−' : ''}${num(total)}</b><span>сом</span></div>
      <i class="lx-ink" aria-hidden="true"></i>
      <div class="lx-meta">
        <div class="lx-m"><small>Сегодня</small><b>${num(s.todayTotal)} <em>сом</em></b></div>
        <div class="lx-m"><small>В день</small><b>${num(total / d.getDate())} <em>сом</em></b></div>
        <div class="lx-m"><small>Крупнейший</small><b>${biggest ? `${num(biggest)} <em>сом</em>` : '—'}</b></div>
      </div>
      ${parts.length ? `<div class="lx-split" aria-hidden="true">${parts.map(([k, v]) => `<i class="${k}" style="flex:${v} 1 0"></i>`).join('')}</div><div class="lx-legend">${legend}</div>` : ''}
    </section>`;
  }

  function catsHtml(s) {
    const d = parseISO(todayISO()) || new Date();
    const by = s.byCategory && typeof s.byCategory === 'object' ? s.byCategory : {};
    const entries = Object.keys(by).map(name => [name, Number(by[name]) || 0]).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]);
    const label = `<span class="lx-label muted">По категориям · ${MONTHS[d.getMonth()]}</span>`;
    if (!entries.length) return `<section class="lx-card forest lx-cats"><div class="lx-top">${label}</div><div class="lx-nocats">За этот месяц расходов пока нет.</div></section>`;
    const total = entries.reduce((a, e) => a + e[1], 0);
    const zero = CATS.filter(c => !entries.some(e => e[0] === c.value));
    const rows = entries.map(([name, v]) => {
      const c = catOf(name);
      const pct = total ? Math.round(v / total * 100) : 0;
      return `<div class="lx-crow cx-${c.key}"><span class="lx-ico">${svg(ICON[c.key])}</span><div class="lx-cbody"><b>${esc(name)}</b><div class="lx-bar" aria-hidden="true"><i style="width:${Math.max(2, pct)}%"></i></div></div><div class="lx-camt"><b>${num(v)}</b><small>${pct}%</small></div></div>`;
    }).join('');
    return `<section class="lx-card forest lx-cats">
      <div class="lx-top">${label}<span class="lx-pill muted">${entries.length} из ${CATS.length}</span></div>
      <div class="lx-stack" aria-hidden="true">${entries.map(([name, v]) => `<i class="cx-${catOf(name).key}" style="flex:${v} 1 0"></i>`).join('')}</div>
      ${rows}
      ${zero.length ? `<div class="lx-zero"><span>${zero.map(c => `<i title="${esc(c.value)}">${svg(ICON[c.key])}</i>`).join('')}</span>Ещё ${zero.length} — без расходов</div>` : ''}
    </section>`;
  }

  function rowHtml(r) {
    const c = catOf(r.category);
    const m = methodOf(r.method);
    return `<div class="lx-row cx-${c.key}" data-lx-key="${esc(recKey(r))}">
      <span class="lx-ico">${svg(ICON[c.key])}</span>
      <div class="lx-rbody"><b class="t">${esc(r.title)}</b><span class="m"><span>${esc(r.category || 'Прочее')}</span><span class="lx-pill ${MCLS[m]}">${METHOD[m]}</span>${r.createdBy ? `<span>${esc(r.createdBy)}</span>` : ''}</span>${r.note ? `<span class="n">«${esc(r.note)}»</span>` : ''}</div>
      <div class="lx-amt"><b>−${num(r.amount)}</b><small>сом</small></div>
    </div>`;
  }

  function journalHtml(recs) {
    if (!recs.length) return `<section class="lx-card ink lx-book"><div class="lx-empty">${readOnly() ? 'Пока нет расходов.' : 'Пока нет расходов.<br>Нажмите «＋ Добавить расход».'}</div></section>`;
    const sorted = recs.slice().sort((a, b) => String(b.spentAt || '').localeCompare(String(a.spentAt || '')) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const sums = {};
    sorted.forEach(r => { const day = String(r.spentAt || '').slice(0, 10); sums[day] = (sums[day] || 0) + (Number(r.amount) || 0); });
    const shown = sorted.slice(0, limit);
    const days = [];
    shown.forEach(r => {
      const day = String(r.spentAt || '').slice(0, 10);
      const last = days[days.length - 1];
      if (last && last.day === day) last.rows.push(r); else days.push({ day, rows: [r] });
    });
    const more = sorted.length - shown.length;
    return `<section class="lx-card ink lx-book">${days.map(g => `<div class="lx-day"><span>${esc(dayTitle(g.day))}</span><i class="lx-rule"></i><b>−${num(sums[g.day])}</b></div>${g.rows.map(rowHtml).join('')}`).join('')}${more > 0 ? `<button type="button" class="lx-more" data-lx-more>Показать ещё · ${more}</button>` : ''}</section>`;
  }

  function renderLedger(data, force) {
    const recs = Array.isArray(data && data.expenses) ? data.expenses : [];
    const s = (data && data.summary) || {};
    const hero = $('#expenseSummary'), cats = $('#expenseCategoryBreakdown'), list = $('#expenseList');
    if (!hero || !cats || !list) throw new Error('expenses containers missing');
    const key = JSON.stringify([recs, s, limit, readOnly(), todayISO()]);
    if (!force && key === sig && list.querySelector('.lx-book') && hero.querySelector('.lx-hero')) { list.classList.remove('lx-updating'); return false; }
    sig = key;
    const before = lastTotal;
    hero.innerHTML = heroHtml(s, recs);
    cats.innerHTML = catsHtml(s);
    list.innerHTML = journalHtml(recs);
    list.classList.remove('lx-updating');
    lastTotal = Number(s.monthTotal) || 0;
    if (introPending && viewActive()) {
      const kind = introPending;
      setPending('');
      playIntro(kind);
    } else if (before !== null && before !== lastTotal && viewActive()) {
      countTo($('.lx-sum b', hero), before, lastTotal, 900, 150, '−');
    }
    tryHighlight();
    return true;
  }

  function popFab(delay) {
    const fab = $('#poExFab');
    if (!fab || getComputedStyle(fab).display === 'none') return;
    A(fab, [{ opacity: 0, transform: 'translate3d(0,24px,0) scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay, easing: EASE.spring });
    A(fab, [{ boxShadow: '0 0 0 0 rgba(246,189,71,.6)' }, { boxShadow: '0 0 0 16px rgba(246,189,71,0)' }], { duration: 1200, delay: delay + 600, iterations: 2, fill: 'none' });
  }

  function toTop() {
    if ((window.scrollY || 0) <= 0) return;
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (_) { window.scrollTo(0, 0); }
  }

  /* «Гроссбух» entrance: the month is counted up, the ledger writes itself in gold ink */
  function playIntro(kind) {
    if (!motion || !viewActive()) return;
    stop();
    toTop();
    const v = $('#expensesView');
    const head = $(':scope > .section-head', v);
    const hero = $('.lx-hero', v), cats = $('.lx-cats', v), book = $('.lx-book', v);
    const jt = $('.expense-summary-card > .section-head', v);
    if (kind !== 'full') {
      [head, hero, cats, jt, book].filter(el => el && onScreen(el)).forEach((el, k) => A(el, K.up(10), { duration: 320, delay: k * 50, easing: EASE.out }));
      popFab(300);
      return;
    }
    A(head, K.down(12), { duration: 520, easing: EASE.out });
    if (hero) {
      A(hero, [{ opacity: 0, transform: 'translate3d(0,22px,0)' }, { opacity: 1, transform: 'none' }], { duration: 760, delay: 120, easing: EASE.out });
      const total = $('.lx-sum b', hero);
      countTo(total, 0, Number(total && total.dataset.lxTotal) || 0, 1100, 320, '−');
      A($('.lx-ink', hero), K.grow, { duration: 1100, delay: 420, easing: EASE.inOut });
      $$('.lx-m', hero).forEach((el, k) => A(el, K.up(14), { duration: 560, delay: 600 + k * 90, easing: EASE.out }));
      $$('.lx-split i', hero).forEach((el, k) => A(el, K.grow, { duration: 800, delay: 820 + k * 150, easing: EASE.out }));
      A($('.lx-legend', hero), K.fade, { duration: 480, delay: 1000 });
    }
    if (cats) {
      A(cats, K.up(18), { duration: 680, delay: 720, easing: EASE.out });
      $$('.lx-stack i', cats).forEach((el, k) => A(el, K.grow, { duration: 700, delay: 980 + k * 260, easing: EASE.inOut }));
      $$('.lx-crow', cats).forEach((el, k) => {
        A(el, K.left(18), { duration: 580, delay: 1040 + k * 140, easing: EASE.out });
        A($('.lx-bar i', el), K.grow, { duration: 880, delay: 1180 + k * 140, easing: EASE.out });
      });
      A($('.lx-zero, .lx-nocats', cats), K.fade, { duration: 480, delay: 1380 });
    }
    A(jt, K.fade, { duration: 480, delay: 1260 });
    if (book) {
      A(book, K.up(16), { duration: 600, delay: 1260, easing: EASE.out });
      let t = 1380;
      let rows = 0;
      Array.from(book.children).forEach(el => {
        if (!onScreen(el) || rows >= 8) return;
        if (el.classList.contains('lx-day')) {
          A($('.lx-rule', el), K.grow, { duration: 800, delay: t, easing: EASE.inOut });
          $$('span, b', el).forEach(x => A(x, K.fade, { duration: 400, delay: t }));
          t += 90;
        } else if (el.classList.contains('lx-row')) {
          A(el, K.write, { duration: 750, delay: t, easing: 'steps(12,end)' });
          A($('.lx-amt', el), K.stamp, { duration: 450, delay: t + 500, easing: EASE.slam });
          t += 160;
          rows += 1;
        }
      });
    }
    popFab(1900);
  }

  function tryHighlight() {
    if (!pendingNew || st.open) return;
    const rows = $$('#expenseList .lx-row');
    if (!rows.length) return;
    const row = rows.find(r => !pendingNew.before.has(r.dataset.lxKey));
    if (!row) { if (Date.now() - pendingNew.at > 8000) pendingNew = null; return; }
    pendingNew = null;
    try { row.scrollIntoView({ block: 'center', behavior: motion ? 'smooth' : 'auto' }); } catch (_) {}
    A(row, K.write, { duration: 640, delay: 260, easing: 'steps(10,end)' }, 'new');
    A(row, [{ backgroundColor: 'rgba(246,189,71,.3)', boxShadow: '0 0 0 1px rgba(246,189,71,.6)' }, { backgroundColor: 'rgba(246,189,71,0)', boxShadow: '0 0 0 1px rgba(246,189,71,0)' }], { duration: 1900, delay: 420, easing: 'ease-out', fill: 'none' }, 'new');
    A($('.lx-amt', row), K.stamp, { duration: 460, delay: 760, easing: EASE.slam }, 'new');
  }

  /* =====================================================================
     VARIANT 3 · «Тез кошуу» — the keypad screen
     ===================================================================== */
  const st = { open: false, amount: 0, cat: 'rem', method: 'cash', day: 'today', other: '', busy: false };
  let sheet = null;
  let saving = null;
  let lastFocus = null;

  function loadPrefs() {
    try {
      const c = localStorage.getItem('po_ex_cat');
      if (c && CATS.some(x => x.key === c)) st.cat = c;
      const m = localStorage.getItem('po_ex_method');
      if (m && METHOD[m]) st.method = m;
    } catch (_) {}
  }
  function savePrefs() {
    try { localStorage.setItem('po_ex_cat', st.cat); localStorage.setItem('po_ex_method', st.method); } catch (_) {}
  }

  function buildSheet() {
    if (sheet) return sheet;
    const keys = [['1'], ['2'], ['3'], ['4'], ['5'], ['6'], ['7'], ['8'], ['9'], ['00', 'Два нуля'], ['0'], ['back', 'Стереть']];
    sheet = document.createElement('div');
    sheet.className = 'kx-sheet';
    sheet.id = 'poExSheet';
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    sheet.setAttribute('aria-labelledby', 'kxHeading');
    sheet.tabIndex = -1;
    sheet.innerHTML = `
      <div class="kx-topbar">
        <button type="button" class="kx-ibtn" data-kx="close" aria-label="Закрыть">${svg(UI.back)}</button>
        <div class="kx-head"><small>Расходы бани · быстро</small><h2 id="kxHeading">Новый расход</h2></div>
        <span class="kx-today" data-kx-today></span>
      </div>
      <div class="kx-body">
        <section class="kx-display" aria-label="Сумма расхода">
          <div class="kx-dtop"><span class="kx-label">Сумма расхода</span><span class="kx-sumline" data-kx-summary></span></div>
          <div class="kx-amount" aria-live="polite"><b data-kx-amount class="is-zero">0</b><i class="kx-caret" aria-hidden="true"></i><span>сом</span></div>
        </section>
        <label class="kx-input" data-kx-titlewrap>${svg(UI.note)}<input id="kxTitle" type="text" maxlength="160" placeholder="На что потратили *" autocomplete="off" aria-label="На что потратили" enterkeyhint="done"></label>
        <div class="kx-chips" role="group" aria-label="Категория">${CATS.map(c => `<button type="button" class="kx-chip cx-${c.key}" data-kx-cat="${c.key}" aria-pressed="false" title="${esc(c.value)}">${svg(ICON[c.key])}${esc(c.short)}</button>`).join('')}</div>
        <div class="kx-seg" role="group" aria-label="Как оплачено">
          <button type="button" class="ca" data-kx-method="cash" aria-pressed="false">${svg(UI.cash)}Наличные</button>
          <button type="button" class="tr" data-kx-method="transfer" aria-pressed="false">${svg(UI.card)}Перевод</button>
          <button type="button" class="ot" data-kx-method="other" aria-pressed="false">${svg(UI.dots)}Другое</button>
        </div>
        <div class="kx-dates" role="group" aria-label="Дата расхода">
          <button type="button" class="kx-date" data-kx-day="today" aria-pressed="false">Сегодня<small data-kx-d="today"></small></button>
          <button type="button" class="kx-date" data-kx-day="yest" aria-pressed="false">Вчера<small data-kx-d="yest"></small></button>
          <label class="kx-date" data-kx-day="other">Дата<small data-kx-d="other">календарь</small><input type="date" data-kx-date aria-label="Другая дата расхода"></label>
        </div>
        <label class="kx-input kx-note">${svg(UI.pen)}<input id="kxNote" type="text" maxlength="1000" placeholder="Примечание — магазин, мастер, чек" autocomplete="off" aria-label="Примечание" enterkeyhint="done"></label>
        <div class="kx-pad">${keys.map(([k, aria]) => `<button type="button" class="kx-key${aria ? ' fn' : ''}" data-kx-key="${k}" aria-label="${aria || 'Цифра ' + k}">${k === 'back' ? svg(UI.backspace) : k}</button>`).join('')}</div>
        <button type="button" class="kx-save is-zero" data-kx="save">Введите сумму</button>
      </div>`;
    document.body.appendChild(sheet);
    sheet.addEventListener('click', onSheetClick);
    const date = $('[data-kx-date]', sheet);
    date.addEventListener('change', () => { if (date.value) { st.day = 'other'; st.other = date.value; syncSheet(); } });
    date.addEventListener('click', () => { try { if (typeof date.showPicker === 'function') date.showPicker(); } catch (_) {} });
    $('#kxTitle', sheet).addEventListener('input', () => $('[data-kx-titlewrap]', sheet).classList.remove('is-error'));
    return sheet;
  }

  function syncSheet() {
    if (!sheet) return;
    const amount = $('[data-kx-amount]', sheet);
    amount.textContent = num(st.amount);
    amount.classList.toggle('is-zero', !st.amount);
    $$('[data-kx-cat]', sheet).forEach(b => { const on = b.dataset.kxCat === st.cat; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    $$('[data-kx-method]', sheet).forEach(b => { const on = b.dataset.kxMethod === st.method; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    $$('.kx-date', sheet).forEach(b => { const on = b.dataset.kxDay === st.day; b.classList.toggle('is-on', on); if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(on)); });
    const t = todayISO();
    $('[data-kx-d="today"]', sheet).textContent = shortDate(t);
    $('[data-kx-d="yest"]', sheet).textContent = shortDate(shiftISO(t, -1));
    $('[data-kx-d="other"]', sheet).textContent = st.day === 'other' && st.other ? shortDate(st.other) : 'календарь';
    const cat = CATS.find(c => c.key === st.cat) || CATS[CATS.length - 1];
    const when = st.day === 'today' ? 'сегодня' : (st.day === 'yest' ? 'вчера' : shortDate(st.other));
    $('[data-kx-summary]', sheet).textContent = `${cat.value} · ${METHOD[st.method].toLowerCase()} · ${when}`;
    $('[data-kx-today]', sheet).textContent = `Сегодня: ${num(summary().todayTotal)} сом`;
    const save = $('[data-kx="save"]', sheet);
    if (!st.busy && !save.classList.contains('is-done')) {
      save.classList.toggle('is-zero', !st.amount);
      save.innerHTML = st.amount ? `${svg(UI.check)}Сохранить · ${num(st.amount)} сом` : 'Введите сумму';
    }
  }

  function press(k) {
    if (!sheet || st.busy) return;
    let n = st.amount;
    if (k === 'back') n = Math.floor(n / 10);
    else if (k === '00') n *= 100;
    else if (/^\d$/.test(k)) n = n * 10 + Number(k);
    if (n > 9999999) { shake($('.kx-display', sheet)); return; }
    st.amount = n;
    const btn = $(`[data-kx-key="${k}"]`, sheet);
    if (btn) {
      btn.classList.add('is-hit');
      clearTimeout(btn.sxTimer);
      btn.sxTimer = setTimeout(() => btn.classList.remove('is-hit'), 160);
    }
    syncSheet();
    if (k !== 'back') A($('[data-kx-amount]', sheet), [{ transform: 'scale(1.06)' }, { transform: 'none' }], { duration: 180, easing: 'ease-out', fill: 'none' }, 'kx');
  }

  function onSheetClick(e) {
    const t = e.target;
    if (!t || !t.closest) return;
    const key = t.closest('[data-kx-key]');
    if (key) { press(key.dataset.kxKey); return; }
    const cat = t.closest('[data-kx-cat]');
    if (cat) { st.cat = cat.dataset.kxCat; syncSheet(); A(cat, [{ transform: 'scale(.94)' }, { transform: 'none' }], { duration: 260, easing: EASE.spring, fill: 'none' }, 'kx'); return; }
    const m = t.closest('[data-kx-method]');
    if (m) { st.method = m.dataset.kxMethod; syncSheet(); return; }
    const d = t.closest('[data-kx-day]');
    if (d) { if (d.dataset.kxDay !== 'other') { st.day = d.dataset.kxDay; syncSheet(); } return; }
    const act = t.closest('[data-kx]');
    if (!act) return;
    if (act.dataset.kx === 'close') closeSheet();
    else if (act.dataset.kx === 'save') save();
  }

  function onKey(e) {
    if (!st.open) return;
    const tag = e.target && e.target.tagName;
    const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    if (e.key === 'Escape') { e.preventDefault(); closeSheet(); return; }
    if (inField) {
      if (e.key === 'Enter') { e.preventDefault(); if (e.target.blur) e.target.blur(); }
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
    else if (e.key === 'Enter') { e.preventDefault(); save(); }
  }

  /* «Тез кошуу» entrance: the keypad assembles in a wave */
  function sheetIntro() {
    if (!motion || !sheet) return;
    stop('kx');
    A(sheet, K.fade, { duration: 220, easing: 'ease-out' }, 'kx');
    A($('.kx-topbar', sheet), K.down(12), { duration: 460, delay: 40, easing: EASE.out }, 'kx');
    A($('.kx-display', sheet), [{ opacity: 0, transform: 'translate3d(0,-18px,0) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 640, delay: 90, easing: EASE.spring }, 'kx');
    A($('[data-kx-titlewrap]', sheet), K.right(26), { duration: 520, delay: 180, easing: EASE.out }, 'kx');
    $$('.kx-chip', sheet).forEach((el, k) => A(el, K.right(26), { duration: 500, delay: 230 + k * 45, easing: EASE.out }, 'kx'));
    A($('.kx-seg', sheet), K.up(14), { duration: 520, delay: 330, easing: EASE.out }, 'kx');
    A($('.kx-dates', sheet), K.up(14), { duration: 520, delay: 380, easing: EASE.out }, 'kx');
    A($('.kx-note', sheet), K.up(12), { duration: 480, delay: 420, easing: EASE.out }, 'kx');
    $$('.kx-key', sheet).forEach((el, i) => {
      const w = Math.floor(i / 3) + (i % 3);
      A(el, [{ opacity: 0, transform: 'translate3d(0,28px,0) scale(.6)' }, { opacity: 1, transform: 'translate3d(0,-3px,0) scale(1.05)', offset: 0.7 }, { opacity: 1, transform: 'none' }], { duration: 560, delay: 440 + w * 55, easing: 'ease-out' }, 'kx');
    });
    A($('[data-kx="save"]', sheet), K.up(16), { duration: 560, delay: 780, easing: EASE.out }, 'kx');
  }

  function openSheet() {
    if (readOnly()) return;
    buildSheet();
    if (st.open) return;
    st.open = true;
    st.amount = 0;
    st.day = 'today';
    st.other = '';
    st.busy = false;
    loadPrefs();
    $('#kxTitle', sheet).value = '';
    $('#kxNote', sheet).value = '';
    $('[data-kx-date]', sheet).value = '';
    $('[data-kx-titlewrap]', sheet).classList.remove('is-error');
    $('[data-kx="save"]', sheet).classList.remove('is-done', 'is-busy');
    $$('.kx-slip', sheet).forEach(n => n.remove());
    syncSheet();
    lastFocus = document.activeElement;
    sheet.classList.add('is-open');
    root.classList.add('po-ex-lock');
    document.addEventListener('keydown', onKey, true);
    try { sheet.focus({ preventScroll: true }); } catch (_) { try { sheet.focus(); } catch (__) {} }
    const body = $('.kx-body', sheet);
    if (body) body.scrollTop = 0;
    const chips = $('.kx-chips', sheet), chip = $('.kx-chip.is-on', sheet);
    if (chips && chip) chips.scrollLeft = Math.max(0, chip.offsetLeft - (chips.clientWidth - chip.offsetWidth) / 2);
    sheetIntro();
  }

  function closeSheet() {
    if (!sheet || !st.open) return;
    st.open = false;
    document.removeEventListener('keydown', onKey, true);
    let anim = null;
    const done = () => {
      sheet.classList.remove('is-open');
      root.classList.remove('po-ex-lock');
      stop('kx');
      if (anim) { try { anim.cancel(); } catch (_) {} }
      if (lastFocus && typeof lastFocus.focus === 'function' && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (_) {} }
      tryHighlight();
    };
    if (!motion) { done(); return; }
    anim = sheet.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translate3d(0,40px,0)' }], { duration: 260, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    anim.finished.then(done, done);
  }

  function printSlip(info) {
    if (!motion || !sheet) return;
    const disp = $('.kx-display', sheet);
    if (!disp) return;
    const slip = document.createElement('div');
    slip.className = 'kx-slip';
    slip.setAttribute('aria-hidden', 'true');
    slip.innerHTML = `<b>ПАР ОРДО</b><div class="r" style="justify-content:center">РАСХОД · ${esc(info.date)}</div><div class="r"><span>${esc(info.title)}</span></div><div class="r"><span>${esc(info.cat)}</span><span>${esc(info.method)}</span></div><div class="tot"><span>ИТОГО</span><span>−${num(info.amount)} сом</span></div>`;
    disp.appendChild(slip);
    const a = slip.animate([
      { clipPath: 'inset(0 0 100% 0)', transform: 'translate3d(0,0,0)', opacity: 1 },
      { clipPath: 'inset(0 0 0 0)', transform: 'translate3d(0,16px,0)', opacity: 1, offset: 0.38 },
      { clipPath: 'inset(0 0 0 0)', transform: 'translate3d(0,22px,0)', opacity: 1, offset: 0.58 },
      { clipPath: 'inset(0 0 0 0)', transform: 'translate3d(0,-330px,0) rotate(-12deg) scale(.7)', opacity: 0 }
    ], { duration: 1250, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
    const rm = () => slip.remove();
    a.finished.then(rm, rm);
  }

  /* called from the loadExpenses wrapper: saveExpenseEntry() reloads only after a successful save */
  function onSaved() {
    if (!saving || saving.ok) return;
    saving.ok = true;
    pendingNew = { before: saving.before, at: Date.now() };
    if (!sheet) return;
    const btn = $('[data-kx="save"]', sheet);
    btn.classList.remove('is-busy', 'is-zero');
    btn.classList.add('is-done');
    btn.innerHTML = `${svg(UI.check)}Сохранено`;
    printSlip(saving.slip);
    setTimeout(() => closeSheet(), motion ? 1150 : 350);
  }

  async function save() {
    if (!sheet || st.busy) return;
    const titleInput = $('#kxTitle', sheet), wrap = $('[data-kx-titlewrap]', sheet), btn = $('[data-kx="save"]', sheet);
    const title = titleInput.value.trim();
    if (!st.amount) { shake($('.kx-display', sheet)); toastSafe('Введите сумму расхода.'); return; }
    if (title.length < 2) {
      wrap.classList.add('is-error');
      shake(wrap);
      try { titleInput.focus(); } catch (_) {}
      toastSafe('Напишите, на что потратили.');
      return;
    }
    const f = { title: $('#expenseTitle'), cat: $('#expenseCategory'), amount: $('#expenseAmount'), method: $('#expenseMethod'), date: $('#expenseDate'), note: $('#expenseNote') };
    if (!f.title || !f.cat || !f.amount || !f.method || !f.date || typeof window.saveExpenseEntry !== 'function') { toastSafe('Форма расходов не найдена. Обновите страницу.'); return; }
    const cat = CATS.find(c => c.key === st.cat) || CATS[CATS.length - 1];
    const spentAt = st.day === 'today' ? todayISO() : (st.day === 'yest' ? shiftISO(todayISO(), -1) : st.other);
    if (!spentAt) { shake($('.kx-dates', sheet)); return; }
    f.title.value = title;
    f.cat.value = cat.value;
    f.amount.value = String(st.amount);
    f.method.value = st.method;
    f.date.value = spentAt;
    if (f.note) f.note.value = $('#kxNote', sheet).value.trim();
    savePrefs();
    st.busy = true;
    btn.classList.add('is-busy');
    btn.innerHTML = '<i class="kx-spin" aria-hidden="true"></i>Сохраняем…';
    saving = { ok: false, before: new Set(records().map(recKey)), slip: { title, cat: cat.value, method: METHOD[st.method], amount: st.amount, date: shortDate(spentAt) } };
    const mine = saving;
    try { await window.saveExpenseEntry({ preventDefault() {}, target: $('#expenseForm') }); } catch (e) { console.warn('PAR ORDO expenses: save', e); }
    if (saving === mine) saving = null;
    st.busy = false;
    if (!mine.ok && sheet) { btn.classList.remove('is-busy'); syncSheet(); }
  }

  /* =====================================================================
     wiring
     ===================================================================== */
  function onNavigate(view, prev) {
    root.classList.toggle('po-ex-on', view === 'expensesView');
    if (view !== 'expensesView') { setPending(''); stop(); if (st.open) closeSheet(); return; }
    if (view === prev) return;
    const full = !seen;
    seen = true;
    if (!motion) return;
    if ($('#expenseList .lx-book')) playIntro(full ? 'full' : 'lite');
    else setPending(full ? 'full' : 'lite');
  }
  function install() {
    if (typeof window.renderExpenseData !== 'function' || typeof window.loadExpenses !== 'function'
      || typeof window.saveExpenseEntry !== 'function' || typeof window.navigate !== 'function') return false;
    const view = $('#expensesView');
    if (!view || !$('#expenseSummary') || !$('#expenseCategoryBreakdown') || !$('#expenseList')) return false;
    root.classList.add('po-ex');

    const card = $('.expense-form-card', view);
    const layout = $('.expense-layout', view);
    const hint = $('#expenseReadOnlyHint');
    if (hint && card && layout && card.contains(hint)) view.insertBefore(hint, layout);
    if (card) card.classList.add('po-ex-hidden');

    const origRender = window.renderExpenseData;
    window.renderExpenseData = function (data) {
      try {
        expenseRecords = Array.isArray(data && data.expenses) ? data.expenses : [];
        expenseSummaryData = (data && data.summary) || {};
        renderLedger(data);
      } catch (e) {
        console.warn('PAR ORDO expenses: render', e);
        sig = '';
        return origRender.apply(this, arguments);
      }
      return undefined;
    };

    const origLoad = window.loadExpenses;
    window.loadExpenses = function () {
      const list = $('#expenseList');
      const keep = list && list.querySelector('.lx-book') ? list.innerHTML : null;
      const title = $('#expenseTitle');
      if (saving && !saving.ok && title && !title.value) { try { onSaved(); } catch (e) { console.warn('PAR ORDO expenses: saved', e); } }
      const p = origLoad.apply(this, arguments);
      if (keep !== null && list) { list.innerHTML = keep; list.classList.add('lx-updating'); }
      if (p && typeof p.then === 'function') {
        /* a failed first load leaves no ledger: drop the pending entrance so the FAB shows */
        const settle = () => { if (list) list.classList.remove('lx-updating'); if (introPending && !$('#expenseList .lx-book')) setPending(''); };
        p.then(settle, settle);
      }
      return p;
    };
    const refresh = $('#refreshExpenses');
    if (refresh) refresh.onclick = () => window.loadExpenses();

    const origNav = window.navigate;
    window.navigate = function (view) {
      let prev = '';
      try { prev = currentView; } catch (_) {}
      const result = origNav.apply(this, arguments);
      try { onNavigate(view, prev); } catch (e) { console.warn('PAR ORDO expenses: navigate', e); }
      return result;
    };

    /* toasts shown while the keypad is open are moved to the top (see .kx-toast) */
    if (typeof MutationObserver === 'function') {
      new MutationObserver(list => {
        if (!st.open) return;
        list.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('toast')) n.classList.add('kx-toast'); }));
      }).observe(document.body, { childList: true });
    }

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'poExFab';
    fab.className = 'po-ex-fab';
    fab.innerHTML = `${svg(UI.plus)}Добавить расход`;
    fab.addEventListener('click', openSheet);
    document.body.appendChild(fab);

    $('#expenseList').addEventListener('click', e => {
      const more = e.target && e.target.closest && e.target.closest('[data-lx-more]');
      if (!more) return;
      limit += 40;
      try { renderLedger({ expenses: records(), summary: summary() }, true); } catch (err) { console.warn('PAR ORDO expenses: more', err); }
    });

    try { if (summary() && Object.keys(summary()).length) renderLedger({ expenses: records(), summary: summary() }, true); } catch (_) {}
    if (viewActive()) root.classList.add('po-ex-on');

    window.PARORDOExpenses = Object.freeze({ version: VERSION, motion, open: openSheet, close: closeSheet });
    return true;
  }
  const start = () => {
    try { if (install()) return; } catch (e) { console.warn('PAR ORDO expenses', e); return; }
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
