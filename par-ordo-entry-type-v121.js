/* PAR ORDO PRO V121 — automatic adult/child label for active bracelets.
   Detects the entrance item saved in the visit: "Вход" = adult, "Вход детский" = child.
   Persists the type with the client record and shows it beside the active status lamp. */
(() => {
  'use strict';
  if (window.__PAR_ORDO_ENTRY_TYPE_V121__) return;
  window.__PAR_ORDO_ENTRY_TYPE_V121__ = true;

  const style = document.createElement('style');
  style.id = 'par-ordo-entry-type-v121-style';
  style.textContent = [
    '#roomsGrid .room-top .par-ordo-entry-type{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;max-width:88px;min-height:24px;margin-left:auto;margin-right:7px;padding:4px 7px;border:1px solid;border-radius:999px;font-size:9px;font-weight:950;line-height:1;letter-spacing:.01em;white-space:nowrap;box-shadow:0 0 12px currentColor;background:#101820}',
    '#roomsGrid .room-top .par-ordo-entry-type.adult{color:#a9d8ff;border-color:#478dc8;background:linear-gradient(135deg,#102943,#0c1b2a)}',
    '#roomsGrid .room-top .par-ordo-entry-type.child{color:#a5ffc3;border-color:#27975a;background:linear-gradient(135deg,#103b27,#0b2117)}',
    '#roomsGrid .room-top .lamp{margin-left:0}'
  ].join('\n');
  document.head.appendChild(style);

  function entryInfo(client) {
    if (!client) return null;
    const items = Array.isArray(client.items) ? client.items : [];
    let latest = null;
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i] || {};
      const name = String(item.name || '').trim().toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
      if (!/^вход(?:\s|$)/u.test(name)) continue;
      latest = item;
      break;
    }
    if (latest) {
      const name = String(latest.name || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е');
      if (/детск/u.test(name)) return { type: 'child', label: 'Детский', price: Number(latest.price || 200) };
      return { type: 'adult', label: 'Взрослый', price: Number(latest.price || 300) };
    }
    if (client.entryType === 'child') return { type: 'child', label: 'Детский', price: Number(client.entryPrice || 200) };
    if (client.entryType === 'adult') return { type: 'adult', label: 'Взрослый', price: Number(client.entryPrice || 300) };
    return null;
  }

  // Save the derived entrance type as part of the existing client record.
  const originalPersistClient = window.persistClient;
  if (typeof originalPersistClient === 'function' && !originalPersistClient.__parOrdoEntryTypeV121) {
    const persistWithEntryType = async function(client) {
      const info = entryInfo(client);
      if (info) {
        client.entryType = info.type;
        client.entryLabel = info.label;
        client.entryPrice = info.price;
      }
      return originalPersistClient.apply(this, arguments);
    };
    persistWithEntryType.__parOrdoEntryTypeV121 = true;
    window.persistClient = persistWithEntryType;
  }

  function decorateRoomTypes() {
    const root = document.getElementById('roomsGrid');
    if (!root) return;
    root.querySelectorAll('.room').forEach(room => {
      const numberNode = room.querySelector('.band-number-overlay');
      const number = Number(String(numberNode && numberNode.textContent || '').trim());
      const lamp = room.querySelector('.room-top .lamp');
      if (!number || !lamp) return;
      let client = null;
      try {
        client = typeof window.clientForRoom === 'function' ? window.clientForRoom(number) : null;
      } catch (_) {}
      const info = entryInfo(client);
      let badge = room.querySelector('.par-ordo-entry-type');
      if (!client || !info) {
        if (badge) badge.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'par-ordo-entry-type';
        badge.setAttribute('aria-live', 'polite');
        lamp.insertAdjacentElement('beforebegin', badge);
      }
      badge.className = 'par-ordo-entry-type ' + info.type;
      badge.textContent = info.label;
      badge.title = info.label + ' вход · ' + info.price + ' сом';
    });
  }

  const originalRenderRooms = window.renderRooms;
  if (typeof originalRenderRooms === 'function' && !originalRenderRooms.__parOrdoEntryTypeV121) {
    const renderWithEntryTypes = function() {
      const result = originalRenderRooms.apply(this, arguments);
      decorateRoomTypes();
      return result;
    };
    renderWithEntryTypes.__parOrdoEntryTypeV121 = true;
    window.renderRooms = renderWithEntryTypes;
  }

  window.setTimeout(decorateRoomTypes, 0);
  console.info('[PAR ORDO] V121 adult/child bracelet labels loaded');
})();
