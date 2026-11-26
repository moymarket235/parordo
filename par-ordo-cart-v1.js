/* PAR ORDO PRO — корзина покупок v1.0.1
   • Нажатие на сам активный браслет (его карточку) сразу открывает раздел товаров —
     то же самое, что кнопка «＋ Покупка».
   • В разделе товаров «Вход», «Вход детский» и товары больше НЕ записываются в чек сразу:
     каждое нажатие кладёт 1 шт. в корзину (внизу окна, количество можно менять +/−).
   • Кнопка «＋ Добавить в чек» записывает всю корзину в чек клиента по обычным правилам
     приложения (склад, цены, тарифы входа, бесплатный браслет руководителя №25) — той же функцией addPurchase.
   • Голосовой Джарвис и автодоплата за время работают как раньше — мимо корзины.
   Подключение: <script src="./par-ordo-cart-v1.js?v=1.0.1" defer></script> — последним, после par-ordo-jarvis-v1.js. */
(function () {
  'use strict';
  if (window.PAR_ORDO_CART) return;

  var VERSION = '1.0.1';
  // кнопки раздела товаров, которые раньше сразу добавляли позицию в чек
  var TAP_SEL = '[data-product],[data-po-product],#addEntry,#addChildEntry,[data-parordo-entry-button]';
  // сообщения addPurchase, которые во время записи корзины не показываем по одному
  var SILENT_RE = /^(Добавлено|Покупка добавлена|Товар не найден|Подождите|Клиент не сохранён|Браслет №25|Внимание: проверьте|Недостаточно|«.+» закончился)/;

  var carts = new Map();     // id клиента -> [{key, name, price, productId, qty}]
  var arm = null;            // {clientId, el, used} — нажатие в окне товаров прямо сейчас
  var committing = null;     // {clientId, done, total} — корзина записывается в чек
  var silent = 0;            // > 0 — addPurchase не переключает окна и не показывает тосты
  var captured = [];
  var basePurchase = null;   // addPurchase приложения со всеми его правилами
  var syncQueued = false;

  /* ---------- стили ---------- */
  var css = [
    '#roomsGrid article.room.active{cursor:pointer;-webkit-tap-highlight-color:transparent}',
    '#addModal .po-cart-on{position:relative;border-color:#f0b13d!important;box-shadow:inset 0 0 0 1px rgba(240,177,61,.45)!important}',
    '#addModal .po-cart-badge{position:absolute;top:6px;right:6px;z-index:3;min-width:24px;height:24px;padding:0 7px;box-sizing:border-box;border-radius:12px;background:linear-gradient(135deg,#ffe08a,#f0b13d);color:#1d1204;font:normal 900 12px/24px system-ui,-apple-system,"Segoe UI",sans-serif;text-align:center;box-shadow:0 0 0 2px #100904,0 4px 10px rgba(0,0,0,.55);pointer-events:none}',
    '#addModal .add-product .po-cart-badge{left:6px;right:auto}',
    '#addModal .entry-add .po-cart-badge{top:-9px;right:-6px}',
    '@keyframes poCartPop{0%{transform:scale(1)}35%{transform:scale(.95)}100%{transform:scale(1)}}',
    '#addModal .po-cart-pop{animation:poCartPop .26s ease-out}',
    '#addModal .po-cart{position:sticky;bottom:-1px;z-index:6;margin:12px -4px 0;padding:10px;border:1px solid #7a5520;border-radius:18px;background:linear-gradient(180deg,#201508,#110a04);box-shadow:0 -14px 28px rgba(0,0,0,.75);color:#ffedce}',
    '#addModal .po-cart-head{display:flex;align-items:center;gap:8px;min-height:36px;margin-bottom:6px}',
    '#addModal .po-cart-head b{font-size:15px;font-weight:950;letter-spacing:.02em}',
    '#addModal .po-cart-count{padding:3px 9px;border-radius:999px;background:#3a250c;color:#ffd77a;font-size:12px;font-weight:900}',
    '#addModal .po-cart-clear{margin-left:auto;min-height:36px;padding:0 13px;border:1px solid #5d4223;border-radius:12px;background:transparent;color:#e6c98e;font-size:12px;font-weight:900}',
    '#addModal .po-cart-lines{display:flex;flex-direction:column;gap:5px;max-height:min(24vh,190px);overflow-y:auto;margin-bottom:8px;overscroll-behavior:contain}',
    '#addModal .po-cart-line{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:4px 6px 4px 9px;border:1px solid #3d2a14;border-radius:13px;background:#150d05}',
    '#addModal .po-cart-name{min-width:0;font-size:13px;font-weight:900;line-height:1.25;overflow-wrap:anywhere}',
    '#addModal .po-cart-name small{display:block;margin-top:2px;color:#c9b48a;font-size:11px;font-weight:800}',
    '#addModal .po-cart-qty{display:flex;align-items:center;gap:6px}',
    '#addModal .po-cart-qty button{width:36px;height:36px;padding:0;border:1px solid #6b4b22;border-radius:11px;background:#241506;color:#ffe1a2;font-size:20px;font-weight:900;line-height:1}',
    '#addModal .po-cart-qty b{min-width:22px;text-align:center;font-size:15px;font-weight:950}',
    '#addModal .po-cart-sum{min-width:70px;text-align:right;font-size:13px;font-weight:950;color:#ffd77a;white-space:nowrap}',
    '#addModal .po-cart-empty{padding:2px 2px 10px;color:#c9b48a;font-size:12px;font-weight:800;line-height:1.45}',
    '#addModal .po-cart-submit{display:flex;align-items:center;justify-content:center;width:100%;min-height:50px;padding:0 14px;border:1px solid #efbd4c;border-radius:15px;background:linear-gradient(135deg,#a9680d,#ffce5a);color:#261705;font-size:15px;font-weight:950}',
    '#addModal .po-cart-submit:disabled,#addModal .po-cart button:disabled{opacity:.5}',
    '@media (prefers-reduced-motion:reduce){#addModal .po-cart-pop{animation:none}}'
  ].join('\n');
  var style = document.createElement('style');
  style.id = 'po-cart-css';
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- доступ к приложению (глобальные переменные из index.html) ---------- */
  function appDb() { try { return typeof db !== 'undefined' ? db : null; } catch (e) { return null; } }
  function curId() { try { return typeof currentClientId !== 'undefined' ? currentClientId : null; } catch (e) { return null; } }
  function setCurId(id) { try { currentClientId = id; } catch (e) {} }
  function clientById(id) {
    var d = appDb();
    return d && Array.isArray(d.clients) ? d.clients.find(function (x) { return String(x.id) === String(id); }) || null : null;
  }
  function productOf(id) {
    var d = appDb();
    return d && Array.isArray(d.products) ? d.products.find(function (p) { return Number(p.id) === Number(id); }) || null : null;
  }
  function availableOf(p) {
    var v = p.available != null ? Number(p.available) : Number(p.stock || 0) - Number(p.reserved || 0);
    return Number.isFinite(v) ? v : 0;
  }
  function fmtMoney(v) {
    try { if (typeof money === 'function') return money(v); } catch (e) {}
    return Number(v || 0).toLocaleString('ru-RU') + ' сом';
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function say(message) { try { if (typeof window.toast === 'function') window.toast(message); } catch (e) {} }
  function call(name, arg) { try { if (typeof window[name] === 'function') return window[name](arg); } catch (e) {} }
  function addModal() { return document.getElementById('addModal'); }
  function addCard() { return document.getElementById('addModalCard'); }
  function addOpen() { var m = addModal(); return !!m && m.classList.contains('open'); }
  function freeVisit() { var c = addCard(); return !!c && c.classList.contains('manager-free-visit'); }
  function cartOf(id) { return carts.get(String(id)) || []; }
  function totals(lines) {
    return lines.reduce(function (t, l) { t.qty += l.qty; t.sum += l.price * l.qty; return t; }, { qty: 0, sum: 0 });
  }
  function stop(e) { e.preventDefault(); e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); }

  /* ---------- корзина ---------- */
  function inCartQty(lines, productId) {
    return lines.reduce(function (s, l) { return l.productId === productId ? s + l.qty : s; }, 0);
  }
  function stockAllows(lines, productId) {
    var p = productOf(productId);
    if (!p) { say('Товар не найден'); return false; }
    var avail = availableOf(p);
    if (inCartQty(lines, productId) + 1 > avail) {
      say(avail < 1 ? '«' + p.name + '» закончился на складе' : 'Недостаточно товара. Остаток: ' + avail + ' шт.');
      return false;
    }
    return true;
  }
  function addToCart(payload, el) {
    var id = curId();
    if (id == null || !payload) return;
    var name = String(payload.name || '').trim() || 'Товар';
    var price = Number(payload.price);
    if (!Number.isFinite(price) || price < 0) price = 0;
    var productId = payload.productId == null ? null : Number(payload.productId);
    var lines = cartOf(id).slice();
    if (productId != null && !stockAllows(lines, productId)) return;
    var key = (productId != null ? 'p' + productId : 'n' + name) + '|' + price;
    var line = null;
    for (var k = 0; k < lines.length; k++) if (lines[k].key === key) { line = lines[k]; break; }
    if (line) line.qty += 1;
    else lines.push({ key: key, name: name, price: price, productId: productId, qty: 1 });
    carts.set(String(id), lines);
    pop(el);
    try { if (navigator.vibrate) navigator.vibrate(12); } catch (e) {}
    sync(true);
  }
  function changeLine(key, delta) {
    if (committing) return;
    var id = curId();
    var lines = cartOf(id);
    var line = null;
    for (var k = 0; k < lines.length; k++) if (lines[k].key === key) { line = lines[k]; break; }
    if (!line) return;
    if (delta > 0 && line.productId != null && !stockAllows(lines, line.productId)) return;
    line.qty += delta;
    if (line.qty < 1) lines.splice(lines.indexOf(line), 1);
    if (lines.length) carts.set(String(id), lines); else carts.delete(String(id));
    sync(true);
  }
  function pop(el) {
    if (!el || !el.classList) return;
    el.classList.remove('po-cart-pop');
    void el.offsetWidth;
    el.classList.add('po-cart-pop');
    setTimeout(function () { el.classList.remove('po-cart-pop'); }, 320);
  }

  /* ---------- панель корзины внизу окна товаров ---------- */
  function panelHtml(id) {
    var lines = cartOf(id), t = totals(lines), free = freeVisit();
    var busy = !!committing && String(committing.clientId) === String(id);
    var off = busy ? ' disabled' : '';
    var price = function (v) { return free ? 'бесплатно' : fmtMoney(v); };
    var html = '<div class="po-cart-head"><b>Корзина</b>' +
      (t.qty ? '<span class="po-cart-count">' + t.qty + ' шт.</span><button type="button" class="po-cart-clear" data-po-cart-clear' + off + '>Очистить</button>' : '') +
      '</div>';
    if (t.qty) {
      html += '<div class="po-cart-lines">' + lines.map(function (l) {
        return '<div class="po-cart-line">' +
          '<span class="po-cart-name">' + esc(l.name) + '<small>' + (free ? 'бесплатно' : esc(fmtMoney(l.price)) + ' × ' + l.qty) + '</small></span>' +
          '<span class="po-cart-qty"><button type="button" data-po-cart-dec="' + esc(l.key) + '" aria-label="Убрать 1 шт."' + off + '>−</button><b>' + l.qty + '</b>' +
          '<button type="button" data-po-cart-inc="' + esc(l.key) + '" aria-label="Добавить 1 шт."' + off + '>+</button></span>' +
          '<strong class="po-cart-sum">' + esc(price(l.price * l.qty)) + '</strong></div>';
      }).join('') + '</div>';
    } else {
      html += '<div class="po-cart-empty">Нажимайте «Вход» и товары — они соберутся здесь. В чек попадут после кнопки «Добавить».</div>';
    }
    var label = busy ? 'Сохраняем… ' + committing.done + ' из ' + committing.total
      : (t.qty ? '＋ Добавить в чек · ' + price(t.sum) : '＋ Добавить');
    html += '<button type="button" class="po-cart-submit" data-po-cart-submit' + (t.qty && !busy ? '' : ' disabled') + '>' + esc(label) + '</button>';
    return html;
  }
  function badge(el, qty) {
    var b = null;
    for (var k = 0; k < el.children.length; k++) {
      if (el.children[k].classList && el.children[k].classList.contains('po-cart-badge')) { b = el.children[k]; break; }
    }
    if (qty > 0) {
      if (!b) { b = document.createElement('i'); b.className = 'po-cart-badge'; b.setAttribute('aria-hidden', 'true'); el.appendChild(b); }
      if (b.textContent !== String(qty)) b.textContent = String(qty);
      if (!el.classList.contains('po-cart-on')) el.classList.add('po-cart-on');
    } else {
      if (b) b.remove();
      if (el.classList.contains('po-cart-on')) el.classList.remove('po-cart-on');
    }
  }
  function decorateTiles(card, id) {
    var byProduct = new Map(), byName = new Map();
    cartOf(id).forEach(function (l) {
      if (l.productId != null) byProduct.set(l.productId, (byProduct.get(l.productId) || 0) + l.qty);
      else byName.set(l.name, (byName.get(l.name) || 0) + l.qty);
    });
    card.querySelectorAll('[data-po-product],[data-product]').forEach(function (b) {
      badge(b, byProduct.get(Number(b.getAttribute('data-po-product') || b.getAttribute('data-product'))) || 0);
    });
    var adult = card.querySelector('#addEntry'), child = card.querySelector('#addChildEntry');
    if (adult) badge(adult, byName.get('Вход') || 0);
    if (child) badge(child, byName.get('Вход детский') || 0);
  }
  function relabelHint(card) {
    card.querySelectorAll('.history-meta').forEach(function (n) {
      if (n.textContent.trim() === 'Каждое добавление записывается в чек клиента.') {
        n.textContent = 'Товары собираются в корзину и попадают в чек после кнопки «Добавить».';
      }
    });
  }
  function run() {
    var card = addCard();
    if (!card) return;
    var panel = document.getElementById('poCart');
    if (!addOpen() && !panel) return;
    var id = curId();
    if (!panel || panel.parentNode !== card) {
      if (panel) panel.remove();
      panel = document.createElement('section');
      panel.id = 'poCart';
      panel.className = 'po-cart';
      panel.setAttribute('aria-label', 'Корзина');
      card.appendChild(panel);
    }
    var html = panelHtml(id);
    if (panel.__poHtml !== html) { panel.innerHTML = html; panel.__poHtml = html; }
    relabelHint(card);
    decorateTiles(card, id);
  }
  function sync(now) {
    if (now) { run(); return; }
    if (syncQueued) return;
    syncQueued = true;
    setTimeout(function () { syncQueued = false; run(); }, 0);
  }
  function observe() {
    var card = addCard(), modal = addModal();
    if (!card || !modal) return false;
    if (card.__poCartObserved) return true;
    card.__poCartObserved = true;
    // окно товаров перерисовывается целиком (openAdd, смена категории) — возвращаем корзину и отметки
    new MutationObserver(function (records) {
      var panel = document.getElementById('poCart');
      for (var k = 0; k < records.length; k++) {
        var t = records[k].target;
        if (panel && (t === panel || panel.contains(t))) continue;
        sync(false);
        return;
      }
    }).observe(card, { childList: true, subtree: true });
    new MutationObserver(function () { sync(false); }).observe(modal, { attributes: true, attributeFilter: ['class'] });
    return true;
  }

  /* ---------- запись корзины в чек ---------- */
  function snapshot(c) {
    var m = new Map();
    (c && Array.isArray(c.items) ? c.items : []).forEach(function (i) { if (i) m.set(String(i.id), Number(i.qty || 0)); });
    return m;
  }
  function grew(before, c, line) {
    return !!c && (Array.isArray(c.items) ? c.items : []).some(function (i) {
      if (!i) return false;
      var was = before.get(String(i.id));
      if (was != null && Number(i.qty || 0) <= was) return false;
      return line.productId != null ? Number(i.productId) === line.productId : (i.productId == null && String(i.name || '') === line.name);
    });
  }
  function reasonOf(messages) {
    for (var k = 0; k < messages.length; k++) {
      if (!/^(Добавлено|Покупка добавлена)/.test(messages[k])) return messages[k].replace(/^Клиент не сохранён на сервере:\s*/, '');
    }
    return '';
  }
  async function commit() {
    var id = curId();
    if (id == null || committing) return;
    var lines = cartOf(id);
    var t = totals(lines);
    if (!t.qty) return;
    var c = clientById(id);
    if (!c || c.status !== 'active') { say('Клиент уже завершён — корзину добавить нельзя.'); return; }
    if (typeof basePurchase !== 'function') { say('Корзина не готова. Обновите страницу.'); return; }
    var free = freeVisit();
    var okQty = 0, okSum = 0, reason = '', warnings = [];
    committing = { clientId: id, done: 0, total: t.qty };
    sync(true);
    silent += 1;
    try {
      while (lines.length) {
        var line = lines[0];
        if (line.qty < 1) { lines.shift(); continue; }
        var target = clientById(id);
        if (!target || target.status !== 'active') { reason = 'клиент уже завершён'; break; }
        var before = snapshot(target);
        var mark = captured.length;
        setCurId(id);
        try {
          await basePurchase({ name: line.name, price: line.price, productId: line.productId });
        } catch (err) {
          reason = (err && err.message) || 'ошибка';
          break;
        }
        var messages = captured.slice(mark);
        messages.forEach(function (m) { if (/^Внимание/.test(m)) warnings.push(m); });
        if (!grew(before, clientById(id), line)) { reason = reasonOf(messages) || 'не сохранено — проверьте интернет'; break; }
        line.qty -= 1;
        okQty += 1;
        okSum += line.price;
        if (line.qty < 1) lines.shift();
        committing.done += 1;
        sync(true);
      }
    } finally {
      silent -= 1;
      captured.length = 0;
      committing = null;
    }
    if (lines.length) carts.set(String(id), lines); else carts.delete(String(id));
    var sumText = free ? 'бесплатно' : fmtMoney(okSum);
    if (!lines.length) {
      call('closeModal', '#addModal');
      if (String(curId()) === String(id)) { call('renderClientModal'); call('openModal', '#clientModal'); }
      call('renderHome');
      say('В чек добавлено: ' + okQty + ' шт. · ' + sumText + ' ✅');
    } else {
      sync(true);
      say((okQty ? 'Добавлено ' + okQty + ' шт. (' + sumText + '). ' : '') + 'Не добавлено: ' + reason + '. Остальное осталось в корзине.');
    }
    warnings.forEach(function (w) { say(w); });
  }

  /* ---------- перехват: нажатия в окне товаров идут в корзину ---------- */
  function installPurchase() {
    var prev = window.addPurchase;
    if (typeof prev !== 'function') return false;
    if (prev.__poCart) return true;
    var wrapped = function (payload) {
      if (arm && !committing && payload && addOpen() && String(arm.clientId) === String(curId())) {
        if (!arm.used) { arm.used = true; addToCart(payload, arm.el); }
        return Promise.resolve();
      }
      return prev.apply(this, arguments);
    };
    wrapped.__poCart = true;
    basePurchase = prev;
    window.addPurchase = wrapped;
    return true;
  }
  function wrapGlobal(name, make) {
    var original = window[name];
    if (typeof original !== 'function' || original.__poCartSilent) return;
    var wrapped = make(original);
    wrapped.__poCartSilent = true;
    window[name] = wrapped;
  }
  function installSilent() {
    wrapGlobal('toast', function (original) {
      return function (message) {
        if (silent > 0 && SILENT_RE.test(String(message || ''))) { captured.push(String(message)); return undefined; }
        return original.apply(this, arguments);
      };
    });
    wrapGlobal('closeModal', function (original) {
      return function (sel) {
        if (silent > 0 && sel === '#addModal') return undefined;
        return original.apply(this, arguments);
      };
    });
    wrapGlobal('openModal', function (original) {
      return function (sel) {
        if (silent > 0 && sel === '#clientModal') return undefined;
        return original.apply(this, arguments);
      };
    });
  }

  // 1) нажатие на «Вход» / товар в окне товаров: отмечаем, что следующий вызов addPurchase — в корзину
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest || !t.closest('#addModal')) return;
    if (t.closest('[data-close-add]')) {
      if (committing) { stop(e); say('Подождите, корзина сохраняется…'); return; }
      var id = curId(), q = totals(cartOf(id)).qty;
      if (q > 0) {
        if (!window.confirm('В корзине ' + q + ' шт. — они ещё НЕ добавлены в чек.\nЗакрыть окно и очистить корзину?')) { stop(e); return; }
        carts.delete(String(id));
      }
      return;
    }
    var tile = t.closest(TAP_SEL);
    if (!tile) return;
    if (committing) { stop(e); say('Подождите, корзина сохраняется…'); return; }
    arm = { clientId: curId(), el: tile, used: false };
    setTimeout(function () { arm = null; }, 0);
  }, true);

  // 2) кнопки самой корзины
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-po-cart-inc],[data-po-cart-dec],[data-po-cart-clear],[data-po-cart-submit]') : null;
    if (!t || !t.closest('#poCart')) return;
    e.preventDefault();
    if (t.disabled) return;
    if (t.hasAttribute('data-po-cart-inc')) changeLine(t.getAttribute('data-po-cart-inc'), 1);
    else if (t.hasAttribute('data-po-cart-dec')) changeLine(t.getAttribute('data-po-cart-dec'), -1);
    else if (t.hasAttribute('data-po-cart-clear')) { if (!committing && window.confirm('Очистить корзину?')) { carts.delete(String(curId())); sync(true); } }
    else void commit();
  });

  // 3) нажатие на сам активный браслет = кнопка «＋ Покупка»
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest || e.defaultPrevented) return;
    var room = t.closest('#roomsGrid article.room.active');
    if (!room) return;
    if (t.closest('button,a,input,select,textarea,label,summary,[role="button"],[contenteditable="true"]')) return;
    var add = room.querySelector('[data-add-client]');
    // нет видимой кнопки «＋ Покупка» (например, руководитель только смотрит) — ничего не делаем
    if (!add || add.disabled || add.offsetParent === null) return;
    add.click();
  });

  function start() {
    var tries = 0;
    (function boot() {
      var ok = installPurchase();
      installSilent();
      var watching = observe();
      if ((!ok || !watching) && ++tries < 40) { setTimeout(boot, 250); return; }
      if (!ok) { try { console.warn('[PAR ORDO] cart: addPurchase не найден — корзина выключена'); } catch (e) {} }
      sync(false);
    })();
  }

  window.PAR_ORDO_CART = {
    version: VERSION,
    lines: function (id) { return cartOf(id == null ? curId() : id).map(function (l) { return { name: l.name, price: l.price, productId: l.productId, qty: l.qty }; }); },
    clear: function (id) { carts.delete(String(id == null ? curId() : id)); sync(true); },
    commit: commit
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  try { console.info('[PAR ORDO] cart v' + VERSION + ' loaded'); } catch (e) {}
})();
