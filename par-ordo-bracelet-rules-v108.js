/* PAR ORDO PRO V108 — bracelet duration alerts + free manager bracelet №3.
   Install this classic script AFTER the main inline application script.
   Does not alter bracelet photos or printed numbers. */
(() => {
  'use strict';
  if (window.__PAR_ORDO_BRACELET_RULES_V108__) return;
  window.__PAR_ORDO_BRACELET_RULES_V108__ = true;

  const MANAGER_ROOM = 3;
  const ALERT_AFTER_MS = 3 * 60 * 60 * 1000;
  const FREE_REASON = 'Бесплатно — браслет руководителя №3';
  const style = document.createElement('style');
  style.id = 'par-ordo-bracelet-rules-v108-style';
  style.textContent = `
    /* Three-hour indicator: keep the bracelet photo and number untouched. */
    #roomsGrid .room.over-time{
      border-color:#ff3f4e!important;
      box-shadow:0 0 0 1px rgba(255,63,78,.28),0 0 20px rgba(255,39,55,.20),0 8px 22px #0006!important;
    }
    #roomsGrid .room.over-time .lamp{
      background:#ff263b!important;
      box-shadow:0 0 7px #ff263b,0 0 18px rgba(255,38,59,.9),inset 0 0 0 2px #ffe0e3!important;
      animation:parOrdoTimeAlertV108 1.1s ease-in-out infinite!important;
    }
    #roomsGrid .room.over-time .room-visual-state.is-active i{
      background:#ff263b!important;
      box-shadow:0 0 8px #ff263b,0 0 13px rgba(255,38,59,.75)!important;
    }
    #roomsGrid .room.over-time .room-elapsed{color:#ff5967!important;font-weight:950!important}
    #roomsGrid .room-elapsed{display:block;margin-top:2px;color:#bed4c5;font-size:10px;font-weight:750;line-height:1.25;letter-spacing:.01em}
    #roomsGrid .room.manager-free{border-color:rgba(234,190,95,.72)!important;box-shadow:0 0 0 1px rgba(234,190,95,.12),0 8px 22px #0005!important}
    #roomsGrid .room.manager-free .room-time{color:#f4d488!important;font-weight:800!important}
    #roomsGrid .room.manager-free .room-summary{border-color:rgba(218,177,90,.45)!important}
    #roomsGrid .room.manager-free .room-summary b{color:#f7d783!important}
    @keyframes parOrdoTimeAlertV108{0%,100%{opacity:1}50%{opacity:.42}}

    .par-ordo-manager-free-banner{
      display:flex;align-items:flex-start;gap:10px;margin:11px 0 13px;padding:12px 13px;
      border:1px solid rgba(225,184,96,.55);border-radius:15px;
      background:linear-gradient(135deg,rgba(60,42,13,.82),rgba(15,17,10,.94));
      color:#ffdfa0;box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 6px 16px rgba(0,0,0,.16);
      font-size:12px;font-weight:800;line-height:1.45;
    }
    .par-ordo-manager-free-banner small{display:block;margin-top:3px;color:#d7c49b;font-size:11px;font-weight:650}
    #clientModalCard.manager-free-visit .purchase-price{font-size:12px;font-weight:900;color:#8ef0b0}
    #clientModalCard.manager-free-visit .purchase-price .par-ordo-free-price{color:#7af0a5;font-weight:950;letter-spacing:.05em}
    #clientModalCard.manager-free-visit .edit-price,
    #clientModalCard.manager-free-visit .pay-methods{display:none!important}
    #clientModalCard .client-session-timer{display:block;margin-top:5px;color:#c4d8cb;font-size:11px;font-weight:800;line-height:1.35}
    #clientModalCard .client-session-timer.over-time{color:#ff5967!important}
    #addModalCard.manager-free-visit .entry-add span{color:#83f2a9!important;font-weight:950!important}
    #addModalCard.manager-free-visit .add-product small{color:#83f2a9!important;font-weight:800!important}
    #addModalCard.manager-free-visit .product-edit-actions{display:none!important}
    .pay-tag.free{background:#123c26;color:#9affbc;border:1px solid #227a4b}
    .manager-free-history-card{border-color:rgba(219,178,91,.55)!important}
    @media(prefers-reduced-motion:reduce){#roomsGrid .room.over-time .lamp{animation:none!important}}
  `;
  (document.head || document.documentElement).appendChild(style);

  const isManagerFreeVisit = c => Number(c && c.room) === MANAGER_ROOM;
  const formatElapsed = ms => {
    const seconds = Math.max(0, Math.floor(ms / 1000));
    const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };
  const getRoomClient = n => {
    try { return typeof clientForRoom === 'function' ? clientForRoom(n) : null; }
    catch (_) { return null; }
  };

  /* Bracelet №3 is always a manager visit: total and revenue are zero. */
  const originalTotal = total;
  total = function(c) { return isManagerFreeVisit(c) ? 0 : originalTotal(c); };
  const originalPayments = payments;
  payments = function(c) {
    return isManagerFreeVisit(c) ? { cash: 0, transfer: 0, pending: 0 } : originalPayments(c);
  };

  /* While adding through room №3, normalize the changed item before the API save.
     Regular catalogue price is retained only as metadata; charged price is zero. */
  const originalPersistClient = persistClient;
  let freePurchaseContext = null;
  persistClient = async function(c) {
    if (isManagerFreeVisit(c) && freePurchaseContext && String(freePurchaseContext.clientId) === String(c.id)) {
      const previousQty = new Map(freePurchaseContext.beforeItems.map(i => [String(i.id), Number(i.qty || 0)]));
      const changed = (c.items || []).find(i => !previousQty.has(String(i.id)) || previousQty.get(String(i.id)) !== Number(i.qty || 0));
      if (changed) {
        if (changed.regularPrice == null) changed.regularPrice = freePurchaseContext.regularPrice;
        changed.price = 0;
        changed.method = 'pending'; // allows another identical free item to merge; no payment controls are shown.
        changed.isManagerFree = true;
        changed.freeReason = FREE_REASON;
      }
    }
    return originalPersistClient(c);
  };

  const originalAddPurchase = addPurchase;
  let freePurchaseBusy = false;
  addPurchase = async function(payload) {
    const c = (db.clients || []).find(x => String(x.id) === String(currentClientId));
    if (!isManagerFreeVisit(c)) return originalAddPurchase.apply(this, arguments);
    if (freePurchaseBusy) { toast('Браслет №3: предыдущая операция сохраняется. Подождите.'); return; }
    freePurchaseBusy = true;
    const context = {
      clientId: c.id,
      regularPrice: payload && payload.price != null ? Number(payload.price) : 0,
      beforeItems: (c.items || []).map(i => ({id:i.id, qty:i.qty}))
    };
    freePurchaseContext = context;
    try {
      await originalAddPurchase.call(this, {...payload, price:0});
    } finally {
      if (freePurchaseContext === context) freePurchaseContext = null;
      freePurchaseBusy = false;
      decorateManagerModals();
      updateLiveRoomClocks();
    }
  };

  /* Don't let room №3 be charged via the normal payment or price-edit controls. */
  const originalItemPayment = itemPayment;
  itemPayment = function(id, method) {
    const c = (db.clients || []).find(x => String(x.id) === String(currentClientId));
    if (isManagerFreeVisit(c)) { toast('Браслет №3 — всё бесплатно. Оплата не взимается.'); return; }
    return originalItemPayment.apply(this, arguments);
  };
  const originalEditPrice = editPrice;
  editPrice = function(id) {
    const c = (db.clients || []).find(x => String(x.id) === String(currentClientId));
    if (isManagerFreeVisit(c)) { toast('Браслет №3 — цена фиксированно 0 сом.'); return; }
    return originalEditPrice.apply(this, arguments);
  };

  /* Convert every line on room №3 to free before completion so an old pending line
     cannot block closing the manager's visit. Inventory quantity changes still run normally. */
  const originalCompleteClient = completeClient;
  completeClient = async function() {
    const c = (db.clients || []).find(x => String(x.id) === String(currentClientId) && x.status === 'active');
    if (!isManagerFreeVisit(c)) return originalCompleteClient.apply(this, arguments);
    const oldItems = JSON.parse(JSON.stringify(c.items || []));
    c.items = (c.items || []).map(i => {
      const item = {...i};
      if (item.regularPrice == null) item.regularPrice = Number(item.price || 0);
      item.price = 0;
      item.method = 'cash';
      item.isManagerFree = true;
      item.freeReason = FREE_REASON;
      return item;
    });
    try {
      await originalPersistClient(c);
      saveLocal();
    } catch (e) {
      c.items = oldItems;
      saveLocal();
      toast('Не удалось сохранить бесплатные позиции руководителя: ' + (e && e.message || 'ошибка'));
      return;
    }
    return originalCompleteClient.apply(this, arguments);
  };

  /* Show elapsed time in every active bracelet except №3. Red indicator activates at 3 hours. */
  function decorateRooms() {
    const rooms = document.querySelectorAll('#roomsGrid .room');
    rooms.forEach(room => {
      const numberNode = room.querySelector('.band-number-overlay');
      const n = Number((numberNode && numberNode.textContent || '').trim());
      if (!n) return;
      const c = getRoomClient(n);
      const timeNode = room.querySelector('.room-time');
      let clockNode = room.querySelector('.room-elapsed');
      if (!c || c.status !== 'active') {
        room.classList.remove('over-time', 'manager-free');
        if (clockNode) clockNode.remove();
        return;
      }
      if (n === MANAGER_ROOM) {
        room.classList.add('manager-free');
        room.classList.remove('over-time');
        if (clockNode) clockNode.remove();
        if (timeNode) timeNode.textContent = 'Бесплатно · без ограничения времени';
        const title = room.querySelector('.room-name');
        if (title) title.textContent = 'Руководитель · Бесплатно';
        const summary = room.querySelector('.room-summary b');
        if (summary) summary.textContent = `Товаров: ${(c.items || []).reduce((sum,i)=>sum+Number(i.qty||0),0)} · БЕСПЛАТНО`;
        return;
      }
      room.classList.remove('manager-free');
      const started = Date.parse(c.startedAt || '');
      if (!clockNode && timeNode) {
        clockNode = document.createElement('span');
        clockNode.className = 'room-elapsed';
        clockNode.setAttribute('aria-label', 'Время с начала сеанса');
        timeNode.insertAdjacentElement('afterend', clockNode);
      }
      if (!Number.isFinite(started)) {
        room.classList.remove('over-time');
        if (clockNode) clockNode.textContent = '⏱ Время не определено';
        return;
      }
      const elapsed = Math.max(0, Date.now() - started);
      const overtime = elapsed >= ALERT_AFTER_MS;
      room.classList.toggle('over-time', overtime);
      if (clockNode) clockNode.textContent = overtime ? `⚠ 3 ЧАСА+ · ${formatElapsed(elapsed)}` : `⏱ Время: ${formatElapsed(elapsed)}`;
    });
  }
  const originalRenderRooms = renderRooms;
  renderRooms = function() {
    const value = originalRenderRooms.apply(this, arguments);
    decorateRooms();
    return value;
  };

  function decorateManagerModals() {
    const client = (db.clients || []).find(x => String(x.id) === String(currentClientId));
    const clientCard = document.getElementById('clientModalCard');
    if (clientCard && client) {
      const free = isManagerFreeVisit(client);
      clientCard.classList.toggle('manager-free-visit', free);
      clientCard.querySelector('.par-ordo-manager-free-banner')?.remove();
      clientCard.querySelector('.client-session-timer')?.remove();
      if (free) {
        const head = clientCard.querySelector('.modal-head');
        if (head) {
          const eyebrow = head.querySelector('.eyebrow');
          const title = head.querySelector('h2');
          const meta = head.querySelector('.history-meta');
          if (eyebrow) eyebrow.textContent = 'РУКОВОДИТЕЛЬ · БРАСЛЕТ №3';
          if (title) title.textContent = 'Руководитель · Бесплатно';
          if (meta) meta.textContent = `Без ограничения времени · Клиент №${client.clientNo}`;
          const banner = document.createElement('div');
          banner.className = 'par-ordo-manager-free-banner';
          banner.innerHTML = '<span aria-hidden="true">✦</span><span>ВСЁ БЕСПЛАТНО<small>Товары записываются и списываются со склада. Оплата не взимается; доход = 0 сом.</small></span>';
          head.insertAdjacentElement('afterend', banner);
        }
        clientCard.querySelectorAll('.purchase').forEach((purchase, index) => {
          purchase.classList.add('manager-free-item');
          const price = purchase.querySelector('.purchase-price');
          const item = (client.items || [])[index];
          if (price) price.innerHTML = `<span class="par-ordo-free-price">БЕСПЛАТНО${item && Number(item.regularPrice)>0 ? ` · цена каталога ${escapeHtml(money(item.regularPrice))}` : ''}</span>`;
          purchase.querySelector('.edit-price')?.remove();
          purchase.querySelector('.pay-methods')?.remove();
        });
      } else {
        const headContent = clientCard.querySelector('.modal-head > div');
        if (headContent) {
          const timer = document.createElement('div');
          timer.className = 'client-session-timer';
          timer.setAttribute('data-client-room', String(client.room));
          headContent.appendChild(timer);
        }
      }
    }

    const addCard = document.getElementById('addModalCard');
    const addClient = (db.clients || []).find(x => String(x.id) === String(currentClientId));
    if (addCard && addClient) {
      const free = isManagerFreeVisit(addClient);
      addCard.classList.toggle('manager-free-visit', free);
      addCard.querySelector('.par-ordo-manager-free-banner')?.remove();
      if (free) {
        const head = addCard.querySelector('.modal-head');
        if (head) {
          const banner = document.createElement('div');
          banner.className = 'par-ordo-manager-free-banner';
          banner.innerHTML = '<span aria-hidden="true">✦</span><span>БРАСЛЕТ РУКОВОДИТЕЛЯ №3<small>Вход и все товары — бесплатно. Остаток склада учитывается, деньги в кассу не добавляются.</small></span>';
          head.insertAdjacentElement('afterend', banner);
        }
        addCard.querySelectorAll('.entry-add span').forEach(span => { span.textContent = 'БЕСПЛАТНО　＋'; });
        decorateAddProductButtons();
      }
    }
  }

  function decorateAddProductButtons() {
    const client = (db.clients || []).find(x => String(x.id) === String(currentClientId));
    if (!isManagerFreeVisit(client)) return;
    document.querySelectorAll('#addProductGrid [data-product]').forEach(button => {
      const p = (db.products || []).find(x => Number(x.id) === Number(button.dataset.product));
      if (!p) return;
      const small = button.querySelector('small');
      if (small) small.textContent = `БЕСПЛАТНО · в наличии ${Number(p.available ?? p.stock ?? 0)} шт.`;
      /* When a product has no catalogue price, the manager must not be prompted for a sale price. */
      button.onclick = async () => {
        await addPurchase({name:p.name, price:Number(p.price || 0), productId:Number(p.id)});
      };
    });
  }

  const originalRenderClientModal = renderClientModal;
  renderClientModal = function() {
    const value = originalRenderClientModal.apply(this, arguments);
    decorateManagerModals();
    updateLiveRoomClocks();
    return value;
  };
  const originalOpenAdd = openAdd;
  openAdd = async function() {
    const value = await originalOpenAdd.apply(this, arguments);
    decorateManagerModals();
    decorateAddProductButtons();
    return value;
  };
  if (typeof renderAddProductGrid === 'function') {
    const originalRenderAddProductGrid = renderAddProductGrid;
    renderAddProductGrid = function() {
      const value = originalRenderAddProductGrid.apply(this, arguments);
      decorateAddProductButtons();
      return value;
    };
  }

  /* Completed history clearly says free, never cash/transfer, for room №3. */
  const originalRecordCard = recordCard;
  recordCard = function(c, isArchive) {
    if (!isManagerFreeVisit(c)) return originalRecordCard.apply(this, arguments);
    const itemRows = (c.items || []).map(i => `<div class="history-line"><span>${escapeHtml(i.name)} ×${Number(i.qty || 0)}</span><span><em class="pay-tag free">Бесплатно</em></span></div>`).join('') || '<div class="history-meta">Покупок пока нет</div>';
    return `<article class="history-card manager-free-history-card"><div class="history-top"><div><b>Руководитель · Браслет №3</b><div class="history-meta">${escapeHtml(fmtDate(c.startedAt))}${c.endedAt?' — '+escapeHtml(fmtDate(c.endedAt)):''}</div></div><strong>БЕСПЛАТНО</strong></div><div class="history-lines">${itemRows}</div><div class="history-bottom"><span>Доход: ${money(0)}</span><span>${isArchive?'📦 Архив':'✓ Завершён'}</span></div></article>`;
  };

  function updateLiveRoomClocks() {
    if (document.hidden) return;
    decorateRooms();
    const card = document.getElementById('clientModalCard');
    if (card && card.classList.contains('manager-free-visit')) return;
    const timer = card && card.querySelector('.client-session-timer');
    if (timer) {
      const n = Number(timer.dataset.clientRoom);
      const c = (db.clients || []).find(x => x.status === 'active' && Number(x.room) === n);
      const started = Date.parse(c && c.startedAt || '');
      if (c && n !== MANAGER_ROOM && Number.isFinite(started)) {
        const elapsed = Math.max(0, Date.now() - started);
        const overtime = elapsed >= ALERT_AFTER_MS;
        timer.classList.toggle('over-time', overtime);
        timer.textContent = overtime ? `⚠ 3 ЧАСА+ · ${formatElapsed(elapsed)}` : `⏱ Время сеанса: ${formatElapsed(elapsed)} / 03:00:00`;
      }
    }
  }

  updateLiveRoomClocks();
  window.setInterval(updateLiveRoomClocks, 1000);
  document.addEventListener('visibilitychange', updateLiveRoomClocks);
  console.info('[PAR ORDO] V108 bracelet timers and manager-free bracelet #3 loaded');
})();
