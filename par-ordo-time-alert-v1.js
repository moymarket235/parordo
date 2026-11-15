/* PAR ORDO PRO — time alert v1.0.0
   Все активные браслеты (1–36), отсчёт от времени выдачи (c.startedAt):
     2:50:00 — браслет загорается ЖЁЛТЫМ (предупреждение)
     3:00:00 — браслет загорается КРАСНЫМ
     3:00:01 — автоматически добавляется «Вход» 300 сом (один раз на клиента, как кнопка «Вход 300 сом»,
               статус «не оплачено» — кассир отмечает оплату как обычно)
   Подключение: <script src="./par-ordo-time-alert-v1.js?v=1.0.0" defer></script> в конце index.html.
   Старые файлы (в т.ч. par-ordo-bracelet-rules-v108.js) не трогаются. */
(function () {
  'use strict';
  if (window.PAR_ORDO_TIME_ALERT) return;

  /* ---------- настройки ---------- */
  var WARN_SEC = 2 * 3600 + 50 * 60;   // 2:50:00 — жёлтый
  var LIMIT_SEC = 3 * 3600;            // 3:00:00 — красный
  var FEE_SEC = LIMIT_SEC + 1;         // 3:00:01 — добавить «Вход»
  var FEE_NAME = 'Вход';
  var FEE_PRICE = 300;
  var FEE_MARK = 'over3h';             // метка на позиции чека, чтобы 300 сом не добавилось дважды
  // Авто-вход добавляется только браслетам, выданным ПОСЛЕ этого момента (UTC). Так при обновлении сайта
  // клиентам, которые уже сидят дольше 3 часов, 300 сом не спишется задним числом (цвет у них всё равно меняется).
  var AUTO_FEE_FROM = Date.parse('2026-11-15T06:30:00Z');
  var RETRY_BASE_MS = 30000, RETRY_MAX_MS = 300000;

  /* ---------- стили ---------- */
  var css = [
    '.room.active.po-t-warn{--room-border-beam:#ffc21a!important;--room-border-bright:#fff1a6!important;border-color:#f2b705!important;box-shadow:0 0 0 1px #ffd24a40,0 0 20px #ffc21a33,0 8px 22px #0005!important}',
    '.room.active.po-t-over{--room-border-beam:#ff2d2d!important;--room-border-bright:#ffb3b3!important;border-color:#ff3b30!important;box-shadow:0 0 0 1px #ff5a5a55,0 0 22px #ff2d2d44,0 8px 22px #0005!important}',
    '.room.active.po-t-warn .lamp{background:#ffd23f!important;box-shadow:0 0 12px #ffc21acc,inset 0 0 0 2px #fff2b3!important;animation:poLampWarn 1.6s ease-in-out infinite!important}',
    '.room.active.po-t-over .lamp{background:#ff4b42!important;box-shadow:0 0 14px #ff2d2dcc,inset 0 0 0 2px #ffc6c2!important;animation:poLampOver .9s ease-in-out infinite!important}',
    '.room.active.po-t-warn .room-visual-state.is-active i{background:#ffd23f!important;box-shadow:0 0 9px #ffd23f!important}',
    '.room.active.po-t-over .room-visual-state.is-active i{background:#ff4b42!important;box-shadow:0 0 9px #ff4b42!important}',
    '.room.active.po-t-warn .room-visual{border-color:#ffc21a!important;box-shadow:inset 0 0 0 1px #ffd24a4a,0 0 17px #ffc21a33!important}',
    '.room.active.po-t-over .room-visual{border-color:#ff3b30!important;box-shadow:inset 0 0 0 1px #ff5a5a4a,0 0 17px #ff2d2d40!important}',
    '.room.active.po-t-warn .room-number-badge{border-color:#ffd23f!important}',
    '.room.active.po-t-over .room-number-badge{border-color:#ff6b61!important}',
    '@keyframes poLampWarn{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.8}}',
    '@keyframes poLampOver{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.28);opacity:.55}}',
    '.po-timer{display:block;margin-top:3px;font-size:11px;font-weight:800;letter-spacing:.02em;font-variant-numeric:tabular-nums;color:#8cf5b4}',
    '.po-timer[data-s="warn"]{color:#ffd23f}',
    '.po-timer[data-s="over"]{color:#ff6b61}',
    '@media (prefers-reduced-motion:reduce){.room.active.po-t-warn .lamp,.room.active.po-t-over .lamp{animation:none!important}}'
  ].join('\n');
  var style = document.createElement('style');
  style.id = 'po-time-alert-css';
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- доступ к данным приложения (глобальные переменные из index.html) ---------- */
  function hasData() {
    try { return typeof db !== 'undefined' && Array.isArray(db.clients); } catch (e) { return false; }
  }
  function activeList() {
    try { return typeof activeClients === 'function' ? activeClients() : []; } catch (e) { return []; }
  }
  function canWrite() {
    try {
      if (document.body.classList.contains('manager-readonly')) return false;   // руководитель только смотрит
      var role = currentRole();
      return (role === 'admin' || role === 'staff') && !!token() &&
        shiftState.isOpen === true && shiftState.isClosing !== true;
    } catch (e) { return false; }
  }

  /* ---------- время ---------- */
  function elapsedSec(c, now) {
    var t = Date.parse(c && c.startedAt);
    return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 1000)) : null;
  }
  function stateOf(sec) {
    if (sec >= LIMIT_SEC) return 'over';
    if (sec >= WARN_SEC) return 'warn';
    return 'ok';
  }
  function fmt(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  /* ---------- подсветка карточек браслетов ---------- */
  var TIMER_RE = /\b\d{1,2}:\d{2}:\d{2}\b/;

  function paintChip(card, c, sec, st) {
    var holder = card.querySelector('.room-time');
    var chip = card.querySelector('.po-timer');
    if (sec == null || !holder) { if (chip) chip.remove(); return; }
    // если в карточке уже есть свой таймер Ч:ММ:СС — второй не рисуем
    var rest = (card.textContent || '').replace(chip ? chip.textContent : '', '');
    if (TIMER_RE.test(rest)) { if (chip) chip.remove(); return; }
    if (!chip) {
      chip = document.createElement('span');
      chip.className = 'po-timer';
      holder.appendChild(chip);
    }
    chip.setAttribute('data-s', st);
    chip.textContent = '⏱ ' + fmt(sec) + (hasFee(c) ? ' · +' + FEE_PRICE + ' сом' : '');
  }

  function paint(now) {
    var grid = document.getElementById('roomsGrid');
    if (!grid || !hasData()) return;
    var byId = new Map();
    activeList().forEach(function (c) { if (c && c.id != null) byId.set(String(c.id), c); });
    grid.querySelectorAll('article.room').forEach(function (card) {
      var btn = card.querySelector('[data-open-client]');
      var c = btn ? byId.get(String(btn.getAttribute('data-open-client'))) : null;
      var sec = c ? elapsedSec(c, now) : null;
      var st = sec == null ? '' : stateOf(sec);
      card.classList.toggle('po-t-warn', st === 'warn');
      card.classList.toggle('po-t-over', st === 'over');
      paintChip(card, c, sec, st);
    });
  }

  /* ---------- автоматический «Вход» 300 сом ---------- */
  var charged = new Set();   // клиенты, у которых «Вход» уже добавлен (или не нужен)
  var busy = new Set();      // клиенты, которые обрабатываются прямо сейчас
  var retry = new Map();     // id -> {n, at} — повтор после ошибки сети/сервера
  var queue = Promise.resolve();

  function hasFee(c) {
    return !!c && Array.isArray(c.items) && c.items.some(function (i) { return i && i.autoTimeFee === FEE_MARK; });
  }
  // если сотрудник уже сам добавил «Вход» после 3-го часа — второй раз не добавляем
  function hasManualOvertimeEntry(c) {
    var t = Date.parse(c && c.startedAt);
    if (!Number.isFinite(t)) return false;
    var from = t + LIMIT_SEC * 1000;
    return Array.isArray(c.items) && c.items.some(function (i) {
      return i && !i.isLoyaltyBonus && /^вход$/iu.test(String(i.name || '').trim()) && Date.parse(i.createdAt) >= from;
    });
  }
  function eligible(c, now) {
    if (!c || c.status !== 'active') return false;
    var t = Date.parse(c.startedAt);
    if (!Number.isFinite(t) || t < AUTO_FEE_FROM) return false;
    return Math.floor((now - t) / 1000) >= FEE_SEC;
  }
  // постоянный id позиции: даже если два устройства сработают одновременно, дубля не будет
  function feeItemId(clientId) {
    var id = String(clientId);
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? 'a3a3a3a3' + id.slice(8) : 'auto3h-' + id;
  }
  function roomOf(id) {
    var c = hasData() ? db.clients.find(function (x) { return String(x.id) === String(id); }) : null;
    return c ? c.room : '';
  }
  function adopt(c) {
    var i = db.clients.findIndex(function (x) { return String(x.id) === String(c.id); });
    if (i >= 0) db.clients[i] = c; else db.clients.push(c);
    try { saveLocal(); } catch (e) {}
  }
  function done(id) { charged.add(id); retry.delete(id); }
  function fail(id, e) {
    var r = retry.get(id) || { n: 0, at: 0 };
    r.n += 1;
    r.at = Date.now() + Math.min(RETRY_BASE_MS * Math.pow(2, r.n - 1), RETRY_MAX_MS);
    retry.set(id, r);
    try { console.warn('PAR ORDO time alert: не удалось добавить «Вход»', e); } catch (_) {}
    if (r.n === 1) {
      try { toast('№' + roomOf(id) + ': не удалось автоматически добавить «Вход» ' + FEE_PRICE + ' сом. Добавьте вручную.'); } catch (_) {}
    }
  }
  function refreshUi(c, announce) {
    try { renderHome(); } catch (e) {}
    try {
      var m = document.getElementById('clientModal');
      if (m && m.classList.contains('open') && typeof currentClientId !== 'undefined' && String(currentClientId) === String(c.id)) renderClientModal();
    } catch (e) {}
    if (announce) {
      try { toast('№' + c.room + ': прошло 3 часа — «Вход» ' + FEE_PRICE + ' сом добавлен автоматически'); } catch (e) {}
    }
  }

  async function charge(id) {
    // 1) берём свежую запись клиента с сервера (вдруг «Вход» уже добавили на другом устройстве)
    var fresh = null;
    try {
      var remote = await api('/api/admin/control/clients');
      fresh = (remote.clients || []).find(function (x) { return String(x.id) === String(id); }) || null;
    } catch (e) { return fail(id, e); }
    if (!fresh) return fail(id, new Error('клиент не найден на сервере'));
    if (fresh.status !== 'active') { done(id); return; }               // клиента уже завершили
    if (hasFee(fresh) || hasManualOvertimeEntry(fresh)) {              // уже добавлено
      adopt(fresh); done(id); refreshUi(fresh, false); return;
    }
    if (!canWrite()) return;
    // 2) добавляем «Вход» так же, как кнопка «Вход 300 сом» (статус «не оплачено»)
    var item = {
      id: feeItemId(fresh.id), productId: null, name: FEE_NAME, price: FEE_PRICE, qty: 1,
      method: 'pending', createdAt: new Date().toISOString(), stockHeldV41: false, autoTimeFee: FEE_MARK
    };
    fresh.items = (Array.isArray(fresh.items) ? fresh.items : []).concat([item]);
    var saved;
    try { saved = await persistClient(fresh); } catch (e) { return fail(id, e); }
    var result = saved && saved.id != null ? saved : fresh;
    adopt(result); done(id); refreshUi(result, true);
  }

  /* ---------- главный цикл (каждую секунду) ---------- */
  function tick() {
    try {
      if (!hasData()) return;
      var now = Date.now();
      paint(now);
      if (!canWrite()) return;
      activeList().forEach(function (c) {
        if (!c || charged.has(c.id) || busy.has(c.id) || !eligible(c, now)) return;
        if (hasFee(c) || hasManualOvertimeEntry(c)) { charged.add(c.id); return; }
        var r = retry.get(c.id);
        if (r && now < r.at) return;
        busy.add(c.id);
        queue = queue.then(function () { return charge(c.id); }).catch(function () {}).then(function () { busy.delete(c.id); });
      });
    } catch (e) {
      try { console.warn('PAR ORDO time alert', e); } catch (_) {}
    }
  }

  function start() {
    var grid = document.getElementById('roomsGrid');
    // карточки перерисовываются целиком — сразу возвращаем цвета, без мигания
    if (grid && window.MutationObserver) {
      new MutationObserver(function () { try { paint(Date.now()); } catch (e) {} }).observe(grid, { childList: true });
    }
    setInterval(tick, 1000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) tick(); });
    tick();
  }

  window.PAR_ORDO_TIME_ALERT = { version: '1.0.0', tick: tick, WARN_SEC: WARN_SEC, LIMIT_SEC: LIMIT_SEC, FEE_SEC: FEE_SEC, AUTO_FEE_FROM: AUTO_FEE_FROM };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
