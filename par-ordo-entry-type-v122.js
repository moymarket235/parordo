/* PAR ORDO PRO V122 — position adult/child badge inside the bracelet photo's Active pill.
   Keep V121 loaded; add this script immediately AFTER par-ordo-entry-type-v121.js.
   The badge is moved from the date/status row into .room-visual-state beside "Активный". */
(() => {
  'use strict';
  if (window.__PAR_ORDO_ENTRY_TYPE_POSITION_V122__) return;
  window.__PAR_ORDO_ENTRY_TYPE_POSITION_V122__ = true;

  const style = document.createElement('style');
  style.id = 'par-ordo-entry-type-position-v122-style';
  style.textContent = `
    /* The adult/child label belongs inside the bracelet photo's status pill. */
    #roomsGrid .room-visual-state .par-ordo-entry-type{
      display:inline-flex!important;
      flex:0 0 auto!important;
      align-items:center!important;
      justify-content:center!important;
      min-height:18px!important;
      margin:0 0 0 3px!important;
      padding:3px 6px!important;
      border:1px solid!important;
      border-radius:999px!important;
      font-size:8px!important;
      font-weight:950!important;
      line-height:1!important;
      letter-spacing:0!important;
      white-space:nowrap!important;
      box-shadow:0 0 9px currentColor!important;
      backdrop-filter:blur(7px);
    }
    #roomsGrid .room-visual-state .par-ordo-entry-type.adult{
      color:#b9dcff!important;
      border-color:#478dc8!important;
      background:linear-gradient(135deg,rgba(16,41,67,.96),rgba(12,27,42,.96))!important;
    }
    #roomsGrid .room-visual-state .par-ordo-entry-type.child{
      color:#a5ffc3!important;
      border-color:#27975a!important;
      background:linear-gradient(135deg,rgba(16,59,39,.96),rgba(11,33,23,.96))!important;
    }
    /* V121 placed the badge before the right-hand lamp in the text/date row.
       Restore the lamp's original right alignment after moving that badge away. */
    #roomsGrid .room-top .lamp{margin-left:auto!important}
    @media(max-width:420px){
      #roomsGrid .room-visual-state{gap:4px;padding:5px 6px}
      #roomsGrid .room-visual-state .par-ordo-entry-type{font-size:7px!important;padding:3px 5px!important;min-height:16px!important}
    }
  `;
  document.head.appendChild(style);

  function readEntryType(client) {
    if (!client) return null;
    const items = Array.isArray(client.items) ? client.items : [];
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i] || {};
      const name = String(item.name || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
      if (!/^вход(?:\s|$)/u.test(name)) continue;
      if (/детск/u.test(name)) return { type:'child', label:'Детский', price:Number(item.price || 200) };
      return { type:'adult', label:'Взрослый', price:Number(item.price || 300) };
    }
    if (client.entryType === 'child') return { type:'child', label:'Детский', price:Number(client.entryPrice || 200) };
    if (client.entryType === 'adult') return { type:'adult', label:'Взрослый', price:Number(client.entryPrice || 300) };
    return null;
  }

  function moveBadgesIntoActivePill() {
    const root = document.getElementById('roomsGrid');
    if (!root || typeof window.clientForRoom !== 'function') return;

    root.querySelectorAll('.room').forEach(room => {
      const numberNode = room.querySelector('.band-number-overlay');
      const roomNumber = Number(String(numberNode?.textContent || '').trim());
      const activePill = room.querySelector('.room-visual-state');
      if (!roomNumber || !activePill) return;

      let client = null;
      try { client = window.clientForRoom(roomNumber); } catch (_) {}
      const info = readEntryType(client);

      // Also relocate the badge created by V121; do not leave a duplicate near the date.
      let badge = room.querySelector('.par-ordo-entry-type');
      if (!client || !info) {
        if (badge) badge.remove();
        return;
      }

      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'par-ordo-entry-type';
        badge.setAttribute('aria-live', 'polite');
      }
      if (badge.parentElement !== activePill) activePill.appendChild(badge);
      badge.className = 'par-ordo-entry-type ' + info.type;
      badge.textContent = info.label;
      badge.title = info.label + ' вход · ' + info.price + ' сом';
      badge.setAttribute('aria-label', info.label + ' вход');
    });
  }

  const originalRenderRooms = window.renderRooms;
  if (typeof originalRenderRooms === 'function' && !originalRenderRooms.__parOrdoEntryTypePositionV122) {
    const renderWithCorrectBadgePosition = function() {
      const result = originalRenderRooms.apply(this, arguments);
      moveBadgesIntoActivePill();
      return result;
    };
    renderWithCorrectBadgePosition.__parOrdoEntryTypePositionV122 = true;
    window.renderRooms = renderWithCorrectBadgePosition;
  }

  // Correct the current screen immediately, then run again after initial layout/data render.
  moveBadgesIntoActivePill();
  window.setTimeout(moveBadgesIntoActivePill, 0);
  console.info('[PAR ORDO] V122 adult/child badge moved into Active pill');
})();
