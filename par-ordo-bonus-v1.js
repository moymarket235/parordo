/* PAR ORDO PRO · BONUS V1 — бонусный счёт 3% прямо на браслете.

   НАКОПЛЕНИЕ  3% с любой оплаченной суммы гостя (входы и товары) = floor(3% × «Всего оплачено» в Базе клиентов).
               Бонус за текущий визит начисляется после его завершения.
   СПИСАНИЕ    сотрудник открывает браслет гостя и у неоплаченной позиции нажимает «🎁 Оплатить бонусом».
               Сумма снимается со счёта автоматически; если бонуса меньше цены — бонус покрывает часть,
               остаток гость доплачивает наличными или переводом. Неизрасходованный бонус остаётся и копится дальше.
   ЗАПИСЬ      списание хранится в самой позиции чека: поля bonusPaid/bonusBasePrice/bonusBaseName/bonusCustomerId
               и метка в названии «… · бонус N» (на случай, если сервер не сохранит дополнительные поля).
               Цена позиции уменьшается на сумму бонуса — касса, выручка и «Всего оплачено» остаются честными.
               Баланс = накоплено − сумма всех таких позиций клиента (по визитам и отчётам смен), поэтому
               удалили или отменили позицию — бонус сам вернулся на счёт.

   Install after par-ordo-inner-v1.js:  <script src="./par-ordo-bonus-v1.js?v=1.0.0" defer></script>
   Styles:                              <link rel="stylesheet" href="./par-ordo-bonus-v1.css?v=1.0.0"> */
(() => {
  'use strict';
  if (window.PARORDOBonus) return;

  const VERSION = '1.0.0';
  const RATE = 0.03;
  const MANAGER_ROOM = 3;                        // браслет руководителя: всё бесплатно, бонус не нужен
  const MARK = /\s*·\s*бонус\s+(\d+)\s*$/u;      // «Чай · бонус 45»
  const STALE = 60000;
  const FIELDS = ['bonusPaid', 'bonusBasePrice', 'bonusBaseName', 'bonusCustomerId', 'bonusAt', 'bonusBy', 'bonusRate'];

  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const log = (...a) => { try { console.warn('[PAR ORDO bonus]', ...a); } catch (_) {} };
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const num = v => Math.round(Number(v) || 0).toLocaleString('ru-RU');
  const say = msg => { try { toast(msg); } catch (_) { log(msg); } };
  const role = () => { try { return currentRole(); } catch (_) { return sessionStorage.getItem('parordo_admin_role') || 'admin'; } };
  const canEdit = () => ['admin', 'staff'].includes(role());
  const who = () => { try { return sessionStorage.getItem('parordo_admin_user') || 'персонал'; } catch (_) { return 'персонал'; } };
  const nowIso = () => { try { return stamp(); } catch (_) { return new Date().toISOString(); } };
  const clients = () => { try { return Array.isArray(db.clients) ? db.clients : []; } catch (_) { return []; } };
  const entries = () => { try { return Array.isArray(customerBaseEntries) ? customerBaseEntries : []; } catch (_) { return []; } };
  const openId = () => { try { return currentClientId; } catch (_) { return null; } };
  const visit = () => clients().find(c => c && String(c.id) === String(openId())) || null;
  const customerById = id => entries().find(c => c && String(c.id) === String(id)) || null;
  const qtyOf = it => Math.max(1, Math.floor(Number(it && it.qty || 1)));
  const priceOf = it => Math.max(0, Number(it && it.price || 0));
  const lineOf = it => priceOf(it) * qtyOf(it);
  const call = (name, ...args) => { try { const fn = window[name]; return typeof fn === 'function' ? fn(...args) : undefined; } catch (e) { log(name, e); } };
  const visitTotal = c => (Array.isArray(c && c.items) ? c.items : []).reduce((s, it) => s + lineOf(it), 0);

  /* =====================================================================
     the item record
     ===================================================================== */
  function itemBonus(it) {
    if (!it) return 0;
    const f = Math.floor(Number(it.bonusPaid));
    if (Number.isFinite(f) && f > 0) return f;
    const m = String(it.name || '').match(MARK);
    return m ? (Number(m[1]) || 0) : 0;
  }
  const isBonus = it => itemBonus(it) > 0;
  function baseName(it) {
    const stored = String(it && it.bonusBaseName || '').trim();
    return stored || String(it && it.name || '').replace(MARK, '').trim();
  }
  function basePrice(it) {
    const v = it && it.bonusBasePrice;
    if (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) && Number(v) >= 0) return Number(v);
    return priceOf(it) + itemBonus(it) / qtyOf(it);
  }
  const hasBonusLines = c => (Array.isArray(c && c.items) ? c.items : []).some(isBonus);
  /* whole som, integer unit price: for 2 × 120 and 45 of bonus → 2 × 98 = 196 to pay, 44 by bonus */
  function planFor(unit, qty, available) {
    const line = unit * qty;
    const want = Math.max(0, Math.min(Math.floor(available), line));
    const next = Math.ceil((line - want) / qty);
    const covered = line - next * qty;
    return { line, covered, unit: next, rest: next * qty };
  }

  /* =====================================================================
     the ledger: earned from «Всего оплачено», spent from the visits themselves
     ===================================================================== */
  const L = { data: null, at: 0, pending: null, err: '', ver: 0 };
  function visitsAll() {
    const live = clients();
    const ids = new Set(), comps = new Set();
    const comp = c => (c && c.startedAt ? `${c.startedAt}|${c.room}` : '');
    for (const c of live) {
      if (!c) continue;
      if (c.id != null && c.id !== '') ids.add(String(c.id));
      const k = comp(c);
      if (k) comps.add(k);
    }
    const out = live.filter(Boolean);
    const seen = new Set();
    const reports = L.data && Array.isArray(L.data.reports) ? L.data.reports : [];
    for (const r of reports) {
      for (const c of (r && Array.isArray(r.clients) ? r.clients : [])) {
        if (!c) continue;
        if (c.id != null && c.id !== '' && ids.has(String(c.id))) continue;   // the live copy is newer
        const k = comp(c);
        if (k && comps.has(k)) continue;
        const own = c.id != null && c.id !== '' ? 'id:' + c.id : (k ? 'k:' + k : '');
        if (own) { if (seen.has(own)) continue; seen.add(own); }
        out.push(c);
      }
    }
    return out;
  }
  let IDX = null;
  function usedIndex() {
    const arr = clients();
    if (IDX && IDX.ver === L.ver && IDX.arr === arr && IDX.len === arr.length && Date.now() - IDX.at < 1500) return IDX.map;
    const map = new Map();
    for (const c of visitsAll()) {
      for (const it of (Array.isArray(c.items) ? c.items : [])) {
        const b = itemBonus(it);
        if (!b) continue;
        const owner = String(it.bonusCustomerId || c.customerBaseId || '');
        if (owner) map.set(owner, (map.get(owner) || 0) + b);
      }
    }
    IDX = { ver: L.ver, arr, len: arr.length, at: Date.now(), map };
    return map;
  }
  function account(customer) {
    const spent = Math.max(0, Number(customer && customer.totalSpent || 0)) || 0;
    const earned = Math.floor(spent * RATE);
    const used = customer && customer.id != null ? (usedIndex().get(String(customer.id)) || 0) : 0;
    return { spent, earned, used, available: Math.max(0, earned - used), over: Math.max(0, used - earned), ready: !!L.data };
  }
  function changed() {
    IDX = null;
    try { if (clientOpen()) decorateClient(); } catch (e) { log('client', e); }
    try {
      const m = $('#customerBaseModal');
      if (m && m.classList.contains('open')) { call('renderCustomerBaseOverview'); call('renderCustomerBaseList'); }
    } catch (e) { log('club', e); }
  }
  function loadReports(force) {
    if (!force && L.data && Date.now() - L.at < STALE) return Promise.resolve(L.data);
    if (L.pending) return L.pending;
    L.pending = (async () => {
      try {
        const d = await api('/api/admin/control/reports');
        L.data = d && Array.isArray(d.reports) ? d : { reports: [] };
        L.err = '';
      } catch (e) {
        // staff without access to reports: the visit list itself carries the history
        L.err = (e && e.message) || 'ошибка';
        if (!L.data) L.data = { reports: [] };
      } finally {
        L.at = Date.now();
        L.ver++;
        L.pending = null;
      }
      changed();
      return L.data;
    })();
    return L.pending;
  }
  async function refreshCustomers() {
    try {
      const d = await api('/api/admin/control/customer-base');
      if (d && Array.isArray(d.customers)) {
        customerBaseEntries = d.customers;
        try { if (d.summary) customerBaseSummary = d.summary; customerBaseLoaded = true; } catch (_) {}
      }
    } catch (_) { /* keep what is loaded */ }
  }

  /* =====================================================================
     the bracelet (client modal)
     ===================================================================== */
  const clientOpen = () => { const m = $('#clientModal'); return !!(m && m.classList.contains('open')); };
  const fresh = { id: '', at: 0 };
  function decorateClient() {
    const card = $('#clientModalCard');
    const c = visit();
    if (!card || !c) return;
    const free = Number(c.room) === MANAGER_ROOM;
    card.classList.toggle('po-bn', !free);
    if (free) return;
    const cust = c.customerBaseId ? customerById(c.customerBaseId) : null;
    const acc = cust ? account(cust) : null;
    decoratePanel(card, c, cust, acc);
    decorateItems(card, c, cust, acc);
  }
  function decoratePanel(card, c, cust, acc) {
    const box = $('.visit-customer-panel', card);
    if (!box) return;
    $$('.po-bn-acct,.po-bn-invite', box).forEach(x => x.remove());
    if (!cust) {
      if (!c.customerBaseId && canEdit()) {
        const gain = Math.floor(visitTotal(c) * RATE);
        box.insertAdjacentHTML('beforeend', `<p class="po-bn-invite"><span aria-hidden="true">🎁</span><span>Привяжите гостя — 3% с этого чека${gain ? ` (+${num(gain)} сом)` : ''} уйдут на его бонусный счёт.</span></p>`);
      }
      return;
    }
    // the old «5-й визит» counter gives way to the 3% account; an already activated free entry stays usable
    $$('.visit-bonus-status:not(.applied)', box).forEach(x => x.remove());
    const old = $('#applyLoyaltyBonus', box);
    if (old) old.innerHTML = '🎁 Бесплатный вход — уже активирован по старой акции 5-го визита';
    const here = (c.items || []).reduce((s, it) => s + (String(it.bonusCustomerId || c.customerBaseId) === String(cust.id) ? itemBonus(it) : 0), 0);
    const gain = Math.floor(visitTotal(c) * RATE);
    const leftPct = acc.earned > 0 ? Math.max(0, Math.min(100, Math.round(acc.available / acc.earned * 100))) : 0;
    let hint;
    if (!acc.ready) hint = 'Считаем списания по истории визитов…';
    else if (acc.available > 0 && canEdit() && c.status === 'active') hint = 'У позиции нажмите «🎁 Оплатить бонусом» — сумма спишется со счёта автоматически.';
    else if (acc.available > 0) hint = 'Бонус можно потратить на любой товар или вход.';
    else hint = 'Бонус начисляется после завершения визита: 3% с оплаченного чека.';
    const html = `<div class="po-bn-acct${acc.ready ? '' : ' wait'}" data-bn="acct">
        <div class="po-bn-top"><span class="po-bn-coin" aria-hidden="true">3%</span><span class="po-bn-tt"><small>Бонусный счёт</small><b><span data-bn="bal">${acc.ready ? num(acc.available) : '…'}</span> сом</b></span>${here ? `<em class="po-bn-here">−${num(here)} в этом чеке</em>` : ''}</div>
        <div class="po-bn-bar" role="img" aria-label="Доступно ${num(acc.available)} из ${num(acc.earned)} сом накопленного"><i style="width:${acc.ready ? leftPct : 0}%"></i></div>
        <div class="po-bn-meta"><span>накоплено <b>${num(acc.earned)}</b></span><span>списано <b>${num(acc.used)}</b></span><span>за этот визит <b class="g">+${num(gain)}</b></span></div>
        ${acc.over ? `<p class="po-bn-warn">Списано больше накопленного на ${num(acc.over)} сом — проверьте последние списания.</p>` : ''}
        <p class="po-bn-hint">${esc(hint)}</p>
      </div>`;
    const metrics = $('.visit-customer-metrics', box);
    if (metrics) metrics.insertAdjacentHTML('afterend', html);
    else box.insertAdjacentHTML('beforeend', html);
  }
  function itemIdOf(el) {
    const ref = $('[data-payment],[data-qty],[data-edit-price]', el);
    if (!ref) return '';
    return String(ref.dataset.payment || ref.dataset.qty || ref.dataset.editPrice || '').split('|')[0];
  }
  function decorateItems(card, c, cust, acc) {
    const active = c.status === 'active';
    $$('.purchase', card).forEach(el => {
      $$('.po-bn-pay,.po-bn-state,.po-bn-rest', el).forEach(x => x.remove());
      $$('.po-bn-hide', el).forEach(x => x.classList.remove('po-bn-hide'));
      el.classList.remove('po-bn-paid', 'po-bn-part', 'po-bn-fresh');
      const it = (c.items || []).find(x => String(x.id) === itemIdOf(el));
      if (!it) return;
      const b = itemBonus(it);
      if (b) { paidItem(el, it, b, active); return; }
      if (!cust || !canEdit() || !active) return;
      if (it.isLoyaltyBonus || it.isManagerFree) return;
      if (it.method === 'cash' || it.method === 'transfer') return;   // only an unpaid line can be paid with bonus
      const amount = lineOf(it);
      if (amount <= 0) return;
      const pay = $('.pay-methods', el);
      if (!pay) return;
      const avail = acc ? acc.available : 0;
      const ready = !!(acc && acc.ready);
      const can = ready && avail > 0;
      const p = can ? planFor(priceOf(it), qtyOf(it), avail) : null;
      const sub = !ready ? 'считаем бонус…'
        : !can ? 'бонуса пока нет'
        : p.rest === 0 ? `спишется ${num(p.covered)} из ${num(avail)} сом`
        : p.covered > 0 ? `бонус ${num(p.covered)} сом · доплата ${num(p.rest)}`
        : 'бонуса не хватает на эту позицию';
      pay.insertAdjacentHTML('beforeend', `<button type="button" class="po-bn-pay${can && p.covered > 0 ? '' : ' off'}" data-bn-pay="${esc(it.id)}"><span class="po-bn-gift" aria-hidden="true">🎁</span><span class="po-bn-pt"><b>Оплатить бонусом</b><small>${esc(sub)}</small></span></button>`);
    });
  }
  function paidItem(el, it, b, active) {
    const qty = qtyOf(it), unit = basePrice(it), full = priceOf(it) <= 0, rest = lineOf(it);
    el.classList.add('po-bn-paid');
    if (!full) el.classList.add('po-bn-part');
    if (fresh.id === String(it.id) && Date.now() - fresh.at < 2500) el.classList.add('po-bn-fresh');
    const title = $('.purchase-title', el);
    if (title) title.textContent = baseName(it);
    const price = $('.purchase-price', el);
    if (price) price.innerHTML = `<span class="po-bn-was">${num(unit)} × ${qty} = <s>${num(unit * qty)} сом</s></span><span class="po-bn-now">к оплате <b>${num(rest)} сом</b></span>`;
    const qtyBox = $('.quantity', el);
    if (qtyBox) qtyBox.classList.add('po-bn-hide');
    const pay = $('.pay-methods', el);
    if (pay && full) pay.classList.add('po-bn-hide');
    const undo = active && canEdit() ? `<button type="button" class="po-bn-undo" data-bn-undo="${esc(it.id)}">Отменить</button>` : '';
    const state = `<div class="po-bn-state"><span class="po-bn-chip" title="${full ? 'Оплачено бонусом полностью' : 'Часть оплачена бонусом'}"><span aria-hidden="true">🎁</span>Бонусом · ${num(b)} сом</span>${undo}</div>`;
    if (pay && !full) pay.insertAdjacentHTML('beforebegin', state + `<div class="po-bn-rest">Остаток <b>${num(rest)} сом</b> — отметьте, как гость доплатил:</div>`);
    else if (pay) pay.insertAdjacentHTML('afterend', state);
    else if (price) price.insertAdjacentHTML('afterend', state);
  }

  /* =====================================================================
     the confirmation sheet
     ===================================================================== */
  const S = { el: null, resolve: null, busy: false };
  function sheetEl() {
    if (S.el && S.el.isConnected) return S.el;
    const el = document.createElement('div');
    el.id = 'poBnSheet';
    el.className = 'po-bn-sheet';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'poBnSheetTitle');
    el.innerHTML = '<div class="po-bn-scrim" data-bn-x></div><div class="po-bn-card" data-bn="card"></div>';
    el.addEventListener('click', e => {
      if (e.target.closest('[data-bn-ok]')) { finish(true); return; }
      if (e.target.closest('[data-bn-x]')) finish(false);
    });
    el.addEventListener('keydown', e => { if (e.key === 'Escape') finish(false); });
    document.body.appendChild(el);
    S.el = el;
    return el;
  }
  function finish(ok) {
    const el = S.el;
    if (!el || el.hidden) return;
    const r = S.resolve;
    S.resolve = null;
    S.loading = null;
    if (reduce || !el.animate) el.hidden = true;
    else {
      const card = $('[data-bn=card]', el), scrim = $('.po-bn-scrim', el);
      scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' });
      card.animate([{ transform: 'none', opacity: 1 }, { transform: 'translateY(40px)', opacity: 0 }], { duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' })
        .finished.then(() => { if (!S.resolve) el.hidden = true; }, () => { el.hidden = true; });
    }
    if (r) r(ok);
  }
  function show(html, focusOk) {
    const el = sheetEl();
    const card = $('[data-bn=card]', el);
    card.innerHTML = html;
    const wasHidden = el.hidden;
    el.hidden = false;
    $$('.po-bn-scrim,[data-bn=card]', el).forEach(x => { try { x.getAnimations().forEach(a => a.cancel()); } catch (_) {} });
    if (wasHidden && !reduce && el.animate) {
      $('.po-bn-scrim', el).animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
      card.animate([{ transform: 'translateY(60px) scale(.98)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 340, easing: 'cubic-bezier(.16,1,.3,1)' });
      const coin = $('.po-bn-big', card);
      if (coin) coin.animate([{ transform: 'rotateY(-360deg) scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 700, delay: 60, easing: 'cubic-bezier(.2,.9,.25,1.15)', fill: 'backwards' });
    }
    const target = $(focusOk ? '[data-bn-ok]' : '[data-bn-x].po-bn-cancel', card) || $('button', card);
    if (target) setTimeout(() => { try { target.focus({ preventScroll: true }); } catch (_) {} }, 30);
  }
  function ask(html) {
    if (S.loading) { S.loading = null; S.resolve = null; }   // the waiting screen turns into the question
    else if (S.resolve) S.resolve(false);
    return new Promise(res => { S.resolve = res; show(html, true); });
  }
  function sheetLoading(it) {
    if (S.resolve) S.resolve(false);
    const token = { cancelled: false };
    S.loading = token;
    S.resolve = () => { token.cancelled = true; };
    show(`<span class="po-bn-big" aria-hidden="true">3%</span><span class="po-bn-kick">Оплата бонусом</span><h3 id="poBnSheetTitle">${esc(baseName(it))}</h3><p class="po-bn-load"><i></i>Сверяем бонусный счёт клиента…</p><button type="button" class="po-bn-cancel" data-bn-x>Отмена</button>`, false);
    return token;
  }
  const row = (k, v, cls) => `<div class="po-bn-r${cls ? ' ' + cls : ''}"><span>${k}</span><b>${v}</b></div>`;

  /* =====================================================================
     actions
     ===================================================================== */
  function guard(c, it) {
    if (!c || !it) return 'Позиция не найдена. Обновите экран.';
    if (!canEdit()) return 'Списывать бонус может администратор или сотрудник смены.';
    if (c.status !== 'active') return 'Визит уже завершён.';
    if (Number(c.room) === MANAGER_ROOM) return 'Браслет №3 — всё бесплатно, бонус не нужен.';
    if (!c.customerBaseId) return 'Сначала привяжите клиента из базы — бонус списывается с его счёта.';
    if (isBonus(it)) return 'Эта позиция уже оплачена бонусом.';
    if (it.isLoyaltyBonus || it.isManagerFree) return 'Позиция и так бесплатная.';
    if (it.method === 'cash' || it.method === 'transfer') return 'Позиция уже отмечена как оплаченная. Поставьте «Ожидает оплаты», затем оплатите бонусом.';
    if (lineOf(it) <= 0) return 'Позиция бесплатная — списывать нечего.';
    return '';
  }
  const findItem = (c, id) => (c && Array.isArray(c.items) ? c.items.find(x => String(x.id) === String(id)) : null) || null;
  function rerender() {
    try { renderClientModal(); } catch (e) { log('render', e); }
    call('renderHome');
  }
  function restore(it, before) {
    for (const k of Object.keys(it)) delete it[k];
    Object.assign(it, before);
  }

  async function redeemFlow(id) {
    if (S.busy) return;
    const c0 = visit(), it0 = findItem(c0, id);
    const why0 = guard(c0, it0);
    if (why0) { say(why0); return; }
    S.busy = true;
    try {
      const token = sheetLoading(it0);
      await Promise.all([loadReports(true), refreshCustomers()]);
      if (token.cancelled) return;
      const c = visit(), it = findItem(c, id);
      const why = guard(c, it);
      if (why) { finish(false); say(why); return; }
      const cust = customerById(c.customerBaseId);
      if (!cust) { finish(false); say('Клиент не найден в базе. Обновите базу клиентов.'); return; }
      const acc = account(cust);
      const unit = priceOf(it), qty = qtyOf(it);
      const plan = planFor(unit, qty, acc.available);
      const head = `<span class="po-bn-big" aria-hidden="true">3%</span><span class="po-bn-kick">Оплата бонусом · ${esc(cust.name || 'клиент')}</span><h3 id="poBnSheetTitle">${esc(baseName(it))}${qty > 1 ? ` × ${qty}` : ''}</h3>`;
      if (acc.available <= 0 || plan.covered <= 0) {
        decorateClient();
        await ask(`${head}<div class="po-bn-rows">${row('Цена позиции', num(plan.line) + ' сом')}${row('Бонусный счёт', num(acc.available) + ' сом', 'z')}</div>
          <p class="po-bn-note">${acc.available <= 0 ? `Бонуса пока нет. 3% с каждого оплаченного чека копятся после завершения визита — с этого визита начислится +${num(Math.floor(visitTotal(c) * RATE))} сом.` : 'Бонуса не хватает даже на 1 сом каждой единицы этой позиции.'}</p>
          <button type="button" class="po-bn-cancel solo" data-bn-x>Понятно</button>`);
        return;
      }
      const left = acc.available - plan.covered;
      const ok = await ask(`${head}<div class="po-bn-rows">
          ${row('Цена позиции', `${qty > 1 ? `${num(unit)} × ${qty} = ` : ''}${num(plan.line)} сом`)}
          ${row('Списать с бонуса', '−' + num(plan.covered) + ' сом', 'g')}
          ${row('К оплате', num(plan.rest) + ' сом', plan.rest ? 'a' : '')}
        </div>
        <div class="po-bn-after"><span>Бонус гостя</span><b>${num(acc.available)}</b><i aria-hidden="true">→</i><b class="g">${num(left)}</b><span>сом</span></div>
        ${plan.rest ? `<p class="po-bn-note">Остаток ${num(plan.rest)} сом гость доплатит — отметьте «наличными» или «переводом».</p>` : `<p class="po-bn-note">${left > 0 ? `Остаток бонуса ${num(left)} сом останется на счёте и будет копиться дальше.` : 'Бонус израсходован полностью — новый начнёт копиться с этого визита.'}</p>`}
        <button type="button" class="po-bn-ok" data-bn-ok>🎁 Списать ${num(plan.covered)} сом бонусом</button>
        <button type="button" class="po-bn-cancel" data-bn-x>Отмена</button>`);
      if (!ok) return;
      await apply(id);
    } finally {
      S.busy = false;
    }
  }
  async function apply(id) {
    const c = visit(), it = findItem(c, id);
    const why = guard(c, it);
    if (why) { say(why); return false; }
    const cust = customerById(c.customerBaseId);
    const acc = account(cust);
    const unit = priceOf(it), qty = qtyOf(it);
    const p = planFor(unit, qty, acc.available);
    if (p.covered <= 0) { say('Бонуса уже недостаточно.'); return false; }
    const before = JSON.parse(JSON.stringify(it));
    const base = baseName(it);
    Object.assign(it, {
      bonusPaid: p.covered, bonusBasePrice: unit, bonusBaseName: base, bonusCustomerId: String(c.customerBaseId),
      bonusAt: nowIso(), bonusBy: who(), bonusRate: RATE,
      name: `${base} · бонус ${p.covered}`, price: p.unit, method: p.unit === 0 ? 'cash' : 'pending'
    });
    L.ver++;
    fresh.id = String(it.id); fresh.at = Date.now();
    try {
      await persistClient(c);
      try { saveLocal(); } catch (_) {}
      rerender();
      const left = Math.max(0, acc.available - p.covered);
      say(p.unit === 0 ? `🎁 Оплачено бонусом ${num(p.covered)} сом ✅ На счёте осталось ${num(left)} сом`
        : `🎁 Бонусом ${num(p.covered)} сом ✅ Доплата ${num(p.rest)} сом — отметьте оплату`);
      return true;
    } catch (e) {
      restore(it, before);
      L.ver++;
      fresh.id = '';
      try { saveLocal(); } catch (_) {}
      rerender();
      say('Не удалось списать бонус: ' + ((e && e.message) || 'ошибка сервера'));
      return false;
    }
  }
  async function undoFlow(id) {
    if (S.busy) return;
    const c = visit(), it = findItem(c, id);
    if (!c || !it || !isBonus(it)) return;
    if (!canEdit()) { say('Отменить бонус может администратор или сотрудник смены.'); return; }
    if (c.status !== 'active') { say('Визит уже завершён — отмена недоступна.'); return; }
    S.busy = true;
    try {
      const b = itemBonus(it), unit = basePrice(it), qty = qtyOf(it);
      const ok = await ask(`<span class="po-bn-big back" aria-hidden="true">↺</span><span class="po-bn-kick">Отмена оплаты бонусом</span><h3 id="poBnSheetTitle">${esc(baseName(it))}${qty > 1 ? ` × ${qty}` : ''}</h3>
        <div class="po-bn-rows">${row('Вернётся на бонусный счёт', '+' + num(b) + ' сом', 'g')}${row('Позиция снова стоит', num(unit * qty) + ' сом')}</div>
        <p class="po-bn-note">Позиция станет «Ожидает оплаты» — отметьте, как гость заплатит.</p>
        <button type="button" class="po-bn-ok back" data-bn-ok>Вернуть ${num(b)} сом на счёт</button>
        <button type="button" class="po-bn-cancel" data-bn-x>Оставить как есть</button>`);
      if (!ok) return;
      const c2 = visit(), it2 = findItem(c2, id);
      if (!it2 || !isBonus(it2) || c2.status !== 'active') return;
      const before = JSON.parse(JSON.stringify(it2));
      const u = basePrice(it2), name = baseName(it2);
      FIELDS.forEach(k => { delete it2[k]; });
      Object.assign(it2, { name, price: u, method: 'pending' });
      L.ver++;
      try {
        await persistClient(c2);
        try { saveLocal(); } catch (_) {}
        rerender();
        say(`Бонус ${num(b)} сом вернулся на счёт клиента ✅`);
      } catch (e) {
        restore(it2, before);
        L.ver++;
        try { saveLocal(); } catch (_) {}
        rerender();
        say('Не удалось отменить бонус: ' + ((e && e.message) || 'ошибка сервера'));
      }
    } finally {
      S.busy = false;
    }
  }

  /* =====================================================================
     history cards: a bonus line says so instead of «Наличные»
     ===================================================================== */
  function decorateRecord(html, c) {
    const t = document.createElement('template');
    t.innerHTML = html;
    const lines = $$('.history-line', t.content);
    (c.items || []).forEach((it, i) => {
      const b = itemBonus(it), line = lines[i];
      if (!b || !line) return;
      const name = line.firstElementChild;
      if (name) name.textContent = `${baseName(it)} ×${qtyOf(it)}`;
      const tag = $('em.pay-tag', line);
      if (!tag) return;
      if (priceOf(it) <= 0) { tag.className = 'pay-tag bonus'; tag.textContent = `🎁 Бонус ${num(b)}`; }
      else tag.insertAdjacentHTML('beforebegin', `<em class="pay-tag bonus">🎁 −${num(b)}</em> `);
    });
    return t.innerHTML;
  }

  /* =====================================================================
     install
     ===================================================================== */
  function wrap(name, make) {
    const orig = window[name];
    if (typeof orig !== 'function' || orig.__poBn) return false;
    const w = make(orig);
    w.__poBn = true;
    window[name] = w;
    return true;
  }
  const bonusItemOfOpen = id => { const it = findItem(visit(), id); return it && isBonus(it) ? it : null; };
  function install() {
    const ok = {};
    ok.render = wrap('renderClientModal', orig => function () {
      const r = orig.apply(this, arguments);
      try { decorateClient(); } catch (e) { log('decorate', e); }
      return r;
    });
    ok.pay = wrap('itemPayment', orig => function (id) {
      const it = bonusItemOfOpen(id);
      if (it && priceOf(it) <= 0) { say('Позиция оплачена бонусом. Чтобы изменить — нажмите «Отменить».'); return; }
      return orig.apply(this, arguments);
    });
    ok.qty = wrap('changeQty', orig => function (id) {
      if (bonusItemOfOpen(id)) { say('Позиция оплачена бонусом — сначала «Отменить», потом меняйте количество.'); return; }
      return orig.apply(this, arguments);
    });
    ok.price = wrap('editPrice', orig => function (id) {
      if (bonusItemOfOpen(id)) { say('Позиция оплачена бонусом — сначала «Отменить», потом меняйте цену.'); return; }
      return orig.apply(this, arguments);
    });
    ok.unlink = wrap('removeCustomerFromBracelet', orig => function () {
      const c = visit();
      if (c && c.status === 'active' && hasBonusLines(c)) { say('На браслете есть оплата бонусом. Сначала отмените её в позициях — иначе бонус гостя потеряется.'); return; }
      return orig.apply(this, arguments);
    });
    ok.link = wrap('attachCustomerToVisit', orig => function (customerId) {
      const c = visit();
      if (c && hasBonusLines(c) && String(customerId || '') !== String(c.customerBaseId || '')) { say('На браслете есть оплата бонусом этого клиента. Сначала отмените её в позициях.'); return; }
      return orig.apply(this, arguments);
    });
    ok.record = wrap('recordCard', orig => function (c) {
      const html = orig.apply(this, arguments);
      try { return hasBonusLines(c) ? decorateRecord(html, c) : html; } catch (_) { return html; }
    });

    document.addEventListener('click', e => {
      const pay = e.target.closest('[data-bn-pay]');
      if (pay) { e.preventDefault(); redeemFlow(pay.dataset.bnPay); return; }
      const undo = e.target.closest('[data-bn-undo]');
      if (undo) { e.preventDefault(); undoFlow(undo.dataset.bnUndo); }
    });
    const watch = (sel, fn) => {
      const el = $(sel);
      if (!el) return;
      let was = el.classList.contains('open');
      new MutationObserver(() => { const on = el.classList.contains('open'); if (on && !was) fn(); if (!on && was && sel === '#clientModal') finish(false); was = on; })
        .observe(el, { attributes: true, attributeFilter: ['class'] });
    };
    watch('#clientModal', () => { loadReports(false); });
    watch('#customerBaseModal', () => { loadReports(false); });
    // history lists were drawn before this module: draw them once more with bonus tags
    try { call('renderHistory'); call('renderArchive'); } catch (_) {}
    if (clientOpen()) { try { decorateClient(); } catch (_) {} loadReports(false); }
    return ok;
  }

  const installed = install();
  window.PARORDOBonus = {
    version: VERSION, rate: RATE, installed,
    account, itemBonus, isBonus, baseName, basePrice, planFor,
    load: loadReports,
    visits: visitsAll
  };
})();
