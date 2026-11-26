/* PAR ORDO PRO — time alert v1.1.1
   Все активные браслеты (1–36), отсчёт от времени выдачи (c.startedAt):
     2:50:00 — браслет загорается ЖЁЛТЫМ (предупреждение)
     3:00:00 — браслет загорается КРАСНЫМ
     3:00:01 — автоматически добавляется «Доп. час» 100 сом
     4:00:01 — ещё 100 сом (всего 200), 5:00:01 — ещё 100 сом (всего 300) и так далее:
               100 сом за каждый начатый час сверх 3 часов. Каждая позиция — статус «не оплачено»,
               кассир отмечает оплату как обычно.
   v1.1.0: вместо одного «Вход» 300 сом после 3 часов — почасовая доплата 100 сом.
   v1.1.1: браслет руководителя (window.PAR_ORDO_MANAGER_ROOM, сейчас №25) — без лимита времени:
           не подсвечивается и доплата за время не начисляется.
   Подключение: <script src="./par-ordo-time-alert-v1.js?v=1.1.1" defer></script> в конце index.html.
   Старые файлы (в т.ч. par-ordo-bracelet-rules-v108.js) не трогаются. */
(function () {
  'use strict';
  if (window.PAR_ORDO_TIME_ALERT) return;

  /* ---------- настройки ---------- */
  var WARN_SEC = 2 * 3600 + 50 * 60;   // 2:50:00 — жёлтый
  var LIMIT_SEC = 3 * 3600;            // 3:00:00 — красный
  var FEE_SEC = LIMIT_SEC + 1;         // 3:00:01 — первая доплата
  var HOUR_SEC = 3600;                 // дальше — за каждый начатый час
  var FEE_NAME = 'Доп. час';
  var FEE_PRICE = 100;                 // сом за каждый начатый час сверх 3 часов
  var FEE_MARK = 'over3h-hour';        // метка почасовой доплаты на позиции чека
  var LEGACY_MARK = 'over3h';          // метка старого правила («Вход» 300 сом) — второй раз не начисляем
  // Доплата добавляется только браслетам, выданным ПОСЛЕ этого момента (UTC). Так при обновлении сайта
  // клиентам, которые уже сидят дольше 3 часов, доплата не спишется задним числом (цвет у них всё равно меняется).
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

  /* ---------- браслет руководителя: всё бесплатно, без лимита времени ---------- */
  function isManagerRoom(c) {
    var n = Number(window.PAR_ORDO_MANAGER_ROOM) || 25;
    return !!c && Number(c.room) === n;
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
    var fee = feeTotal(c);
    chip.textContent = '⏱ ' + fmt(sec) + (fee > 0 ? ' · +' + fee + ' сом' : '');
  }

  function paint(now) {
    var grid = document.getElementById('roomsGrid');
    if (!grid || !hasData()) return;
    var byId = new Map();
    activeList().forEach(function (c) { if (c && c.id != null) byId.set(String(c.id), c); });
    grid.querySelectorAll('article.room').forEach(function (card) {
      var btn = card.querySelector('[data-open-client]');
      var c = btn ? byId.get(String(btn.getAttribute('data-open-client'))) : null;
      var sec = c && !isManagerRoom(c) ? elapsedSec(c, now) : null;
      var st = sec == null ? '' : stateOf(sec);
      card.classList.toggle('po-t-warn', st === 'warn');
      card.classList.toggle('po-t-over', st === 'over');
      paintChip(card, c, sec, st);
    });
  }

  /* ---------- почасовая доплата: 100 сом за каждый начатый час после 3:00:00 ---------- */
  var settled = new Map();   // id -> сколько часов уже начислено (проверено) на этом устройстве
  var legacy = new Set();    // клиенты, которых больше не проверяем (старая доплата «Вход» 300 сом или клиент завершён)
  var busy = new Set();      // клиенты, которые обрабатываются прямо сейчас
  var retry = new Map();     // id -> {n, at} — повтор после ошибки сети/сервера
  var queue = Promise.resolve();

  // 3:00:01 → 1 час, 4:00:00 → 1, 4:00:01 → 2, 5:00:01 → 3 …
  function dueHours(sec) {
    return sec != null && sec > LIMIT_SEC ? Math.ceil((sec - LIMIT_SEC) / HOUR_SEC) : 0;
  }
  function feeTotal(c) {
    if (!c || !Array.isArray(c.items)) return 0;
    return c.items.reduce(function (sum, i) {
      return i && (i.autoTimeFee === FEE_MARK || i.autoTimeFee === LEGACY_MARK) ? sum + Number(i.price || 0) * Number(i.qty || 0) : sum;
    }, 0);
  }
  function hasLegacyFee(c) {
    return !!c && Array.isArray(c.items) && c.items.some(function (i) { return i && i.autoTimeFee === LEGACY_MARK; });
  }
  // если сотрудник уже сам добавил «Вход» после 3-го часа — доплату не начисляем, чтобы не взять дважды
  function hasManualOvertimeEntry(c) {
    var t = Date.parse(c && c.startedAt);
    if (!Number.isFinite(t)) return false;
    var from = t + LIMIT_SEC * 1000;
    return Array.isArray(c.items) && c.items.some(function (i) {
      return i && !i.isLoyaltyBonus && /^вход$/iu.test(String(i.name || '').trim()) && Date.parse(i.createdAt) >= from;
    });
  }
  function isLegacy(c) { return hasLegacyFee(c) || hasManualOvertimeEntry(c); }
  function eligible(c, now) {
    if (!c || c.status !== 'active' || isManagerRoom(c)) return false;
    var t = Date.parse(c.startedAt);
    if (!Number.isFinite(t) || t < AUTO_FEE_FROM) return false;
    return Math.floor((now - t) / 1000) >= FEE_SEC;
  }
  // постоянный id позиции для каждого часа: даже если два устройства сработают одновременно, дубля не будет
  function feeItemId(clientId, hour) {
    var id = String(clientId);
    var hex = ('0000' + Number(hour).toString(16)).slice(-4);
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? 'a3a3' + hex + id.slice(8) : 'auto3h-' + id + '-h' + hour;
  }
  // часы, за которые доплата уже есть в чеке (по метке часа или по постоянному id позиции)
  function missingHours(c, due) {
    var items = Array.isArray(c && c.items) ? c.items : [];
    var ids = new Set(), hours = new Set(), list = [];
    items.forEach(function (i) {
      if (!i) return;
      ids.add(String(i.id));
      if (i.autoTimeFee === FEE_MARK && Number(i.autoTimeHour) > 0) hours.add(Number(i.autoTimeHour));
    });
    for (var h = 1; h <= due; h++) {
      if (!hours.has(h) && !ids.has(feeItemId(c.id, h))) list.push(h);
    }
    return list;
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
  function retire(id) { legacy.add(id); retry.delete(id); }
  function settle(id, due) { settled.set(id, Math.max(settled.get(id) || 0, due)); retry.delete(id); }
  function fail(id, e) {
    var r = retry.get(id) || { n: 0, at: 0 };
    r.n += 1;
    r.at = Date.now() + Math.min(RETRY_BASE_MS * Math.pow(2, r.n - 1), RETRY_MAX_MS);
    retry.set(id, r);
    try { console.warn('PAR ORDO time alert: не удалось добавить доплату за время', e); } catch (_) {}
    if (r.n === 1) {
      try { toast('№' + roomOf(id) + ': не удалось добавить доплату за время (' + FEE_PRICE + ' сом/час). Повторим автоматически.'); } catch (_) {}
    }
  }
  function refreshUi(c, added, due) {
    try { renderHome(); } catch (e) {}
    try {
      var m = document.getElementById('clientModal');
      if (m && m.classList.contains('open') && typeof currentClientId !== 'undefined' && String(currentClientId) === String(c.id)) renderClientModal();
    } catch (e) {}
    if (added && added.length) {
      try { toast('№' + c.room + ': идёт ' + (3 + due) + '-й час — «' + FEE_NAME + '» +' + (FEE_PRICE * added.length) + ' сом добавлено автоматически'); } catch (e) {}
    }
  }

  async function charge(id) {
    // 1) берём свежую запись клиента с сервера (вдруг доплату уже добавили на другом устройстве)
    var fresh = null;
    try {
      var remote = await api('/api/admin/control/clients');
      fresh = (remote.clients || []).find(function (x) { return String(x.id) === String(id); }) || null;
    } catch (e) { return fail(id, e); }
    if (!fresh) return fail(id, new Error('клиент не найден на сервере'));
    if (fresh.status !== 'active') { retire(id); return; }             // клиента уже завершили
    if (isLegacy(fresh)) {                                             // уже начислено по старому правилу (300 сом)
      adopt(fresh); retire(id); refreshUi(fresh); return;
    }
    var due = dueHours(elapsedSec(fresh, Date.now()));
    var missing = missingHours(fresh, due);
    if (!missing.length) {                                             // все часы уже в чеке
      adopt(fresh); settle(id, due); refreshUi(fresh); return;
    }
    if (!canWrite()) return;
    // 2) добавляем по 100 сом за каждый недостающий час (статус «не оплачено»)
    var at = new Date().toISOString();
    var items = missing.map(function (h) {
      return {
        id: feeItemId(fresh.id, h), productId: null, name: FEE_NAME, price: FEE_PRICE, qty: 1,
        method: 'pending', createdAt: at, stockHeldV41: false, autoTimeFee: FEE_MARK, autoTimeHour: h
      };
    });
    fresh.items = (Array.isArray(fresh.items) ? fresh.items : []).concat(items);
    var saved;
    try { saved = await persistClient(fresh); } catch (e) { return fail(id, e); }
    var result = saved && saved.id != null ? saved : fresh;
    adopt(result); settle(id, due); refreshUi(result, missing, due);
  }

  /* ---------- главный цикл (каждую секунду) ---------- */
  function tick() {
    try {
      if (!hasData()) return;
      var now = Date.now();
      paint(now);
      if (!canWrite()) return;
      activeList().forEach(function (c) {
        if (!c || legacy.has(c.id) || busy.has(c.id) || !eligible(c, now)) return;
        var due = dueHours(elapsedSec(c, now));
        if (due < 1 || (settled.get(c.id) || 0) >= due) return;       // этот час уже проверен
        if (isLegacy(c)) { legacy.add(c.id); return; }
        if (!missingHours(c, due).length) { settled.set(c.id, due); return; }
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

  window.PAR_ORDO_TIME_ALERT = { version: '1.1.1', tick: tick, WARN_SEC: WARN_SEC, LIMIT_SEC: LIMIT_SEC, FEE_SEC: FEE_SEC, HOUR_SEC: HOUR_SEC, FEE_PRICE: FEE_PRICE, AUTO_FEE_FROM: AUTO_FEE_FROM, dueHours: dueHours };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
