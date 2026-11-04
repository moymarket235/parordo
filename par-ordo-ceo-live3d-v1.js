/* PAR ORDO LIVE DIGITAL TWIN v1.0
   Animated visual simulation for CEO Mode.
   Guest markers follow decorative routes; this is NOT real indoor tracking.
*/
(() => {
  'use strict';
  const API = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const TOKEN_KEY = 'parordo_admin_token';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const REFRESH_MS = 15000;

  function q(selector, root = document) { return root.querySelector(selector); }
  function qa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }
  function fmt(value) { return Number(value || 0).toLocaleString('ru-RU'); }

  let overlay = null, panel = null, observer = null, pollTimer = null;
  let frameId = 0, busy = false, wasOpen = false, lastSignature = '';
  let guests = [], motionNodes = [], selectedBracelet = null, running = false, lastUpdated = null;

  function braceletNumber(client) {
    const raw = String(client.room ?? client.braceletNo ?? client.bracelet ?? '')
      .trim().replace(/^браслет\s*/i, '').replace(/^№\s*/, '');
    const value = Number(raw);
    return Number.isInteger(value) && value >= 1 && value <= 36 ? value : null;
  }

  function guestType(client) {
    const items = Array.isArray(client.items) ? client.items : [];
    const raw = [
      client.type, client.category, client.kind, client.clientType, client.ageType,
      client.entryType, client.tariff, client.isChild === true ? 'child' : '',
      ...items.flatMap(item => [item?.name, item?.title, item?.category, item?.type])
    ].filter(Boolean).join(' ').toLocaleLowerCase('ru-RU');
    return /детск|реб[её]нок|child|minor/.test(raw) ? 'child' : 'adult';
  }

  function buildPanel() {
    if (panel || !overlay) return panel;
    const kpis = q('#poCeoKpis', overlay);
    if (!kpis) return null;

    panel = document.createElement('section');
    panel.id = 'poDtLivePanel';
    panel.className = 'po-dt-panel';
    panel.setAttribute('aria-label', 'PAR ORDO Live Digital Twin');
    panel.innerHTML = `
      <div class="po-dt-heading">
        <div>
          <div class="po-dt-eyebrow"><i class="po-dt-live-dot"></i> PAR ORDO · LIVE DIGITAL TWIN</div>
          <h2>3D Обзор комплекса</h2>
          <p>Активные браслеты появляются внутри макета и двигаются по декоративным маршрутам</p>
        </div>
        <div class="po-dt-heading-actions">
          <span class="po-dt-live-pill" id="poDtLiveStatus">● LIVE</span>
          <button type="button" class="po-dt-refresh" id="poDtRefresh">↻ Обновить</button>
        </div>
      </div>

      <div class="po-dt-workspace">
        <nav class="po-dt-zone-nav" aria-label="Зоны комплекса">
          <div class="po-dt-nav-caption">ЗОНЫ КОМПЛЕКСА</div>
          <button type="button" class="is-selected" data-po-dt-zone="overview"><span>⌂</span>Обзор</button>
          <button type="button" data-po-dt-zone="entry"><span>⇢</span>Вход / шлёпки</button>
          <button type="button" data-po-dt-zone="reception"><span>▤</span>Ресепшн</button>
          <button type="button" data-po-dt-zone="shoe-storage"><span>▦</span>Обувные шкафы</button>
          <button type="button" data-po-dt-zone="lockers"><span>▦</span>Раздевалка 1–36</button>
          <button type="button" data-po-dt-zone="lounge"><span>☕</span>Чай / еда · 2 места</button>
          <button type="button" data-po-dt-zone="wash"><span>♨</span>Моечная зона</button>
          <button type="button" data-po-dt-zone="toilet"><span>WC</span>Туалет · 1 дверь</button>
          <button type="button" data-po-dt-zone="showers"><span>♧</span>Душевые · 2</button>
          <button type="button" data-po-dt-zone="buckets"><span>▤</span>Обливные · 2</button>
          <button type="button" data-po-dt-zone="steam"><span>♨</span>Парная · PAR</button>
        </nav>

        <div class="po-dt-map-column">
          <div class="po-dt-map-toolbar">
            <span>ПЛАН КОМПЛЕКСА <b>· 10 ЗОН</b></span>
            <span class="po-dt-motion-key"><i></i> ДВИЖЕНИЕ АВАТАРОВ</span>
          </div>
          <div class="po-dt-map-scroll">
            <svg id="poDtMap" class="po-dt-map" viewBox="0 0 1200 650" role="img" aria-label="Концептуальная 3D карта PAR ORDO с анимированными браслетами">
              <defs>
                <linearGradient id="poDtFloor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#29372e"/><stop offset=".52" stop-color="#18251e"/><stop offset="1" stop-color="#0d1712"/></linearGradient>
                <linearGradient id="poDtWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d6049"/><stop offset="1" stop-color="#25291f"/></linearGradient>
                <linearGradient id="poDtWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a0f8ef" stop-opacity=".9"/><stop offset="1" stop-color="#20b7a7" stop-opacity=".2"/></linearGradient>
                <linearGradient id="poDtGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8ee9e2" stop-opacity=".35"/><stop offset="1" stop-color="#2a8279" stop-opacity=".08"/></linearGradient>
                <pattern id="poDtTile" width="34" height="34" patternUnits="userSpaceOnUse"><path d="M34 0H0V34" fill="none" stroke="#d5bd8b" stroke-opacity=".10" stroke-width="1"/></pattern>
                <filter id="poDtShadow" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="7"/><feOffset dy="7" dx="1" result="blur"/><feComponentTransfer><feFuncA type="linear" slope=".42"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                <filter id="poDtGlow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>

              <rect x="10" y="10" width="1180" height="630" rx="26" fill="#07100c" stroke="#9b7338" stroke-opacity=".55"/>
              <path d="M34 77L1120 52L1170 525L92 590Z" fill="#0c1711" stroke="#b88a43" stroke-opacity=".5" stroke-width="3" filter="url(#poDtShadow)"/>
              <path d="M50 90L1100 70L1148 505L110 564Z" fill="url(#poDtFloor)" stroke="#d4ae6c" stroke-opacity=".52" stroke-width="2"/>
              <path d="M50 90L1100 70L1148 505L110 564Z" fill="url(#poDtTile)" opacity=".8"/>

              <g data-po-dt-room="entry" filter="url(#poDtShadow)">
                <path d="M65 112H235V250H65Z" fill="#17261d" stroke="#a77c3c" stroke-width="3"/><path d="M65 112L85 96H252L235 112Z" fill="url(#poDtWall)" stroke="#c49a55"/><path d="M235 112L252 96V232L235 250Z" fill="#22271d"/>
                <path d="M78 125H222V238H78Z" fill="url(#poDtTile)"/>
                <g fill="#b88d50" stroke="#f2d08c" stroke-width="1.5"><path d="M88 143q8-13 17 0v10H88Z"/><path d="M111 143q8-13 17 0v10h-17Z"/><path d="M134 143q8-13 17 0v10h-17Z"/><path d="M157 143q8-13 17 0v10h-17Z"/><path d="M180 143q8-13 17 0v10h-17Z"/><path d="M203 143q8-13 13 0v10h-13Z"/></g>
                <text x="92" y="207" class="po-dt-svg-label">ВХОД / ШЛЁПКИ</text><text x="92" y="224" class="po-dt-svg-sub">Входная зона</text>
              </g>

              <g data-po-dt-room="reception" filter="url(#poDtShadow)">
                <path d="M275 84H535V225H275Z" fill="#1b281f" stroke="#b28b4b" stroke-width="3"/><path d="M275 84L295 66H555L535 84Z" fill="url(#poDtWall)" stroke="#d0aa64"/><path d="M535 84L555 66V207L535 225Z" fill="#29281d"/>
                <rect x="300" y="100" width="150" height="88" rx="8" fill="#24190e" stroke="#d2a45c" stroke-width="2"/><rect x="310" y="110" width="130" height="38" rx="5" fill="#563718"/>
                <text x="375" y="135" text-anchor="middle" class="po-dt-brand">ПАР ОРДО</text><rect x="315" y="151" width="120" height="25" rx="5" fill="#b17a36"/>
                <g><rect x="464" y="99" width="31" height="93" rx="4" fill="#23443e" stroke="#75d9cd" stroke-width="2"/><rect x="501" y="99" width="26" height="93" rx="4" fill="#23443e" stroke="#75d9cd" stroke-width="2"/><path d="M470 110h18m-18 15h18m-18 15h18m-18 15h18m-18 15h18M506 110h15m-15 15h15m-15 15h15m-15 15h15m-15 15h15" stroke="#a8e8da" stroke-width="3"/></g>
                <text x="302" y="211" class="po-dt-svg-sub">Ресепшн · товары · 2 холодильника</text>
              </g>

              <g data-po-dt-room="shoe-storage" filter="url(#poDtShadow)">
                <path d="M275 266H445V365H275Z" fill="#1a281f" stroke="#a77b3f" stroke-width="3"/><path d="M275 266L291 251H461L445 266Z" fill="url(#poDtWall)"/><path d="M445 266L461 251V348L445 365Z" fill="#24291e"/>
                <g fill="#4a341b" stroke="#d2a864" stroke-width="1.5"><rect x="290" y="281" width="28" height="32" rx="3"/><rect x="322" y="281" width="28" height="32" rx="3"/><rect x="354" y="281" width="28" height="32" rx="3"/><rect x="386" y="281" width="28" height="32" rx="3"/><rect x="290" y="320" width="28" height="32" rx="3"/><rect x="322" y="320" width="28" height="32" rx="3"/><rect x="354" y="320" width="28" height="32" rx="3"/><rect x="386" y="320" width="28" height="32" rx="3"/></g>
                <text x="295" y="382" class="po-dt-svg-sub">Обувные шкафы · чип-доступ</text>
              </g>

              <g data-po-dt-room="lockers" filter="url(#poDtShadow)">
                <path d="M475 254H745V465H475Z" fill="#202a20" stroke="#b18a4b" stroke-width="3"/><path d="M475 254L493 238H763L745 254Z" fill="url(#poDtWall)"/><path d="M745 254L763 238V446L745 465Z" fill="#25271d"/>
                <rect x="488" y="270" width="244" height="178" rx="6" fill="#151d16" stroke="#8d6836"/>
                ${Array.from({length:36},(_,i)=>{const col=i%6,row=Math.floor(i/6),x=498+col*39,y=280+row*27;return `<g><rect x="${x}" y="${y}" width="34" height="22" rx="3" fill="#604321" stroke="#d3aa68" stroke-width="1"/><text x="${x+17}" y="${y+15}" text-anchor="middle" class="po-dt-locker-number">${i+1}</text></g>`;}).join('')}
                <text x="497" y="487" class="po-dt-svg-sub">Раздевалка · шкафчики 1–36</text>
              </g>

              <g data-po-dt-room="lounge" filter="url(#poDtShadow)">
                <path d="M65 411H265V535H65Z" fill="#1c2b21" stroke="#a88043" stroke-width="3"/><path d="M65 411L82 395H282L265 411Z" fill="url(#poDtWall)"/><path d="M265 411L282 395V519L265 535Z" fill="#25271d"/>
                <rect x="91" y="452" width="148" height="50" rx="12" fill="#59391e" stroke="#e1b56c" stroke-width="2"/><rect x="111" y="438" width="52" height="30" rx="9" fill="#a87c4a" stroke="#f0d29a"/><rect x="181" y="438" width="52" height="30" rx="9" fill="#a87c4a" stroke="#f0d29a"/><circle cx="137" cy="450" r="8" fill="#f0d59e"/><circle cx="207" cy="450" r="8" fill="#f0d59e"/>
                <text x="86" y="522" class="po-dt-svg-sub">Чай / еда · ровно 2 места</text>
              </g>

              <g data-po-dt-room="wash" filter="url(#poDtShadow)">
                <path d="M770 254H940V445H770Z" fill="#1c2b27" stroke="#8caa92" stroke-width="3"/><path d="M770 254L788 238H958L940 254Z" fill="url(#poDtWall)"/><path d="M940 254L958 238V428L940 445Z" fill="#202c26"/><rect x="784" y="270" width="142" height="160" fill="url(#poDtTile)"/>
                ${[0,1,2,3].map(i=>`<g transform="translate(${796+i*33},${302+(i%2)*5})"><ellipse cx="11" cy="22" rx="13" ry="8" fill="#b4b9a3" stroke="#e9d5aa" stroke-width="2"/><path d="M11 7v13m-5-13h10" stroke="#b4d9cf" stroke-width="3"/><rect x="8" y="29" width="6" height="26" fill="#8c7450"/></g>`).join('')}
                <text x="785" y="466" class="po-dt-svg-sub">Моечная зона · тазики / вода</text>
              </g>

              <g data-po-dt-room="toilet" filter="url(#poDtShadow)">
                <path d="M630 86H730V218H630Z" fill="#202a22" stroke="#ae8b50" stroke-width="3"/><path d="M630 86L647 71H747L730 86Z" fill="url(#poDtWall)"/><rect x="654" y="105" width="53" height="102" rx="4" fill="#4a3822" stroke="#dfbb78" stroke-width="3"/><circle cx="696" cy="158" r="3" fill="#f3d795"/>
                <text x="680" y="232" text-anchor="middle" class="po-dt-svg-sub">Туалет · 1 дверь</text>
              </g>

              <g data-po-dt-room="showers" filter="url(#poDtShadow)">
                <path d="M775 86H1055V225H775Z" fill="#192b29" stroke="#79b4aa" stroke-width="3"/><path d="M775 86L792 71H1072L1055 86Z" fill="url(#poDtWall)"/>
                <g fill="url(#poDtGlass)" stroke="#8ee5db" stroke-width="3"><rect x="797" y="104" width="110" height="101" rx="5"/><rect x="916" y="104" width="110" height="101" rx="5"/></g>
                <g stroke="#a5eee4" stroke-width="3" stroke-linecap="round"><path d="M850 114v12m-13 8l13 32m0-32l-13 32m13-32l13 32"/><path d="M970 114v12m-13 8l13 32m0-32l-13 32m13-32l13 32"/></g>
                <text x="916" y="236" text-anchor="middle" class="po-dt-svg-sub">Душевые · 2 кабины</text>
              </g>

              <g data-po-dt-room="buckets" filter="url(#poDtShadow)">
                <path d="M965 270H1115V445H965Z" fill="#14241e" stroke="#a78145" stroke-width="3"/><path d="M965 270L982 254H1132L1115 270Z" fill="url(#poDtWall)"/><path d="M1115 270L1132 254V428L1115 445Z" fill="#24271d"/><path d="M993 292H1088" stroke="#e1bc7b" stroke-width="5"/>
                ${[0,1].map(i=>`<g transform="translate(${1005+i*70},300)"><path d="M15 0v25" stroke="#d8b878" stroke-width="3"/><path d="M0 25q15-8 30 0l-4 33q-11 10-22 0Z" fill="#96632f" stroke="#f0c77d" stroke-width="2"/><path d="M15 62v23m-9-10l9 10 9-10" stroke="#80e8e4" stroke-width="3" stroke-linecap="round"/><path d="M15 85v18" stroke="url(#poDtWater)" stroke-width="5" stroke-linecap="round"/></g>`).join('')}
                <text x="980" y="432" class="po-dt-svg-sub">Обливные устройства · 2 шт.</text><text x="980" y="449" class="po-dt-svg-micro">Подвесные вёдра с тягой</text>
              </g>

              <g data-po-dt-room="steam" filter="url(#poDtShadow)">
                <path d="M930 465H1130V565H930Z" fill="#251a12" stroke="#d0a35d" stroke-width="3"/><path d="M930 465L947 449H1147L1130 465Z" fill="url(#poDtWall)"/><rect x="950" y="477" width="158" height="73" rx="3" fill="#4b301a" stroke="#e0bb78" stroke-width="2"/><rect x="955" y="482" width="148" height="63" fill="url(#poDtGlass)" stroke="#82c9bc" stroke-opacity=".65"/>
                <path d="M975 534q-12-20 0-35m25 35q-12-22 0-40m25 40q-12-22 0-40" fill="none" stroke="#f3d5a1" stroke-width="4" stroke-linecap="round" opacity=".8"/>
                <text x="1030" y="588" text-anchor="middle" class="po-dt-svg-sub">Парная · PAR</text>
              </g>

              <g class="po-dt-routes" fill="none" stroke-linecap="round" stroke-linejoin="round">
                <path id="poDtRouteA" d="M120 174C180 164 240 138 325 150S390 220 430 285S505 360 575 400S700 430 785 365S820 265 855 190S960 190 985 300S1050 450 1040 520S830 540 690 500S330 520 160 465S80 300 120 174" stroke="#48dbc1" stroke-width="5" stroke-dasharray="8 13"/>
                <path id="poDtRouteB" d="M115 215C200 245 260 325 330 330S460 300 550 310S690 270 690 160S800 120 870 150S970 245 1010 330S1070 485 1000 530S800 480 720 420S500 470 340 450S100 380 115 215" stroke="#e5ba6d" stroke-width="4" stroke-dasharray="5 15" opacity=".65"/>
                <path id="poDtRouteC" d="M180 120C270 110 390 180 410 260S455 405 600 420S760 425 800 350S810 270 850 220S940 290 1030 370S1080 500 950 530S700 510 540 500S300 475 180 420" stroke="#53c4f4" stroke-width="4" stroke-dasharray="6 15" opacity=".65"/>
              </g>
              <g id="poDtGuestLayer" aria-live="polite"></g>
            </svg>
          </div>
          <div class="po-dt-map-foot"><span>↔ На телефоне карту можно двигать по горизонтали</span><span>Маршрут — визуальная симуляция</span></div>
        </div>

        <aside class="po-dt-live-stats">
          <div class="po-dt-stat-card po-dt-stat-main"><span>СЕЙЧАС В БАНЕ</span><strong id="poDtActiveCount">0</strong><small>активных браслетов</small></div>
          <div class="po-dt-stat-card"><span><i class="po-dt-dot adult"></i> Взрослый</span><strong id="poDtAdultCount">0</strong></div>
          <div class="po-dt-stat-card"><span><i class="po-dt-dot child"></i> Детский</span><strong id="poDtChildCount">0</strong></div>
          <div class="po-dt-stat-card po-dt-capacity"><span>ЗАНЯТО БРАСЛЕТОВ</span><strong><b id="poDtOccupied">0</b> / 36</strong><div class="po-dt-capacity-track"><i id="poDtCapacityBar"></i></div></div>
          <div class="po-dt-selected" id="poDtSelectedGuest"><b>Выберите браслет</b><small>Нажмите на движущийся номер, чтобы посмотреть категорию</small></div>
        </aside>
      </div>

      <div class="po-dt-guest-footer">
        <div class="po-dt-guest-footer-head"><strong>АКТИВНЫЕ БРАСЛЕТЫ <span id="poDtGuestCount">(0)</span></strong><div class="po-dt-legend"><span><i class="po-dt-dot adult"></i> Взрослый</span><span><i class="po-dt-dot child"></i> Детский</span></div></div>
        <div class="po-dt-guest-list" id="poDtGuestList"><span class="po-dt-empty">Активных браслетов пока нет</span></div>
      </div>
      <p class="po-dt-disclaimer">Важно: человечки и их маршруты — декоративная анимация для визуализации активности. Они не показывают реальное местоположение или фактическое перемещение гостей.</p>
      <div class="po-dt-fetch-hint" id="poDtFetchHint"></div>
    `;

    kpis.insertAdjacentElement('afterend', panel);
    const oldCard = q('.po-ceo-columns > .po-ceo-card:first-child', overlay);
    if (oldCard) oldCard.classList.add('po-dt-hide-old-bracelets');

    q('#poDtRefresh', panel).addEventListener('click', fetchGuests);
    q('#poDtGuestLayer', panel).addEventListener('click', event => {
      const marker = event.target.closest('[data-po-dt-guest]');
      if (marker) selectGuest(Number(marker.getAttribute('data-po-dt-guest')));
    });
    q('#poDtGuestList', panel).addEventListener('click', event => {
      const chip = event.target.closest('[data-po-dt-select]');
      if (chip) selectGuest(Number(chip.getAttribute('data-po-dt-select')));
    });
    q('.po-dt-zone-nav', panel).addEventListener('click', event => {
      const button = event.target.closest('[data-po-dt-zone]');
      if (!button) return;
      const zone = button.getAttribute('data-po-dt-zone');
      qa('[data-po-dt-zone]', panel).forEach(el => el.classList.toggle('is-selected', el === button));
      qa('[data-po-dt-room]', panel).forEach(el => el.classList.toggle('is-focused', zone !== 'overview' && el.getAttribute('data-po-dt-room') === zone));
    });
    return panel;
  }

  function makeMarker(guest) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute('class', 'po-dt-guest ' + (guest.type === 'child' ? 'is-child' : 'is-adult'));
    group.setAttribute('data-po-dt-guest', String(guest.number));
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', 'Браслет №' + guest.number + ', ' + (guest.type === 'child' ? 'детский' : 'взрослый'));
    group.innerHTML = `
      <ellipse cx="0" cy="17" rx="12" ry="4" class="po-dt-guest-shadow"/>
      <circle cx="0" cy="-1" r="18" class="po-dt-guest-halo"/>
      <circle cx="0" cy="-15" r="5.5" class="po-dt-person-head"/>
      <path d="M0 -8L0 6M0 -3L-8 3M0 -3L8 3" class="po-dt-person-body"/>
      <path d="M0 6L-6 15M0 6L7 14" class="po-dt-person-legs"/>
      <rect x="11" y="-32" width="52" height="21" rx="10" class="po-dt-guest-tag"/>
      <text x="37" y="-18" text-anchor="middle" class="po-dt-guest-number">№${String(guest.number).padStart(2,'0')}</text>`;
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectGuest(guest.number);
      }
    });
    return group;
  }

  function createRouteNodes() {
    const svg = q('#poDtMap', panel);
    const layer = q('#poDtGuestLayer', panel);
    if (!svg || !layer) return;
    layer.replaceChildren();
    motionNodes = [];
    const routeIds = ['poDtRouteA','poDtRouteB','poDtRouteC'];
    guests.forEach((guest, index) => {
      const marker = makeMarker(guest);
      layer.appendChild(marker);
      const route = q('#' + routeIds[(guest.number + index) % routeIds.length], svg);
      if (!route || typeof route.getTotalLength !== 'function') return;
      motionNodes.push({
        number: guest.number, marker, route, length: route.getTotalLength(),
        duration: 19000 + (guest.number % 7) * 1700,
        offset: ((guest.number * .137) + (index * .071)) % 1
      });
    });
  }

  function animate(now) {
    if (!running || !panel || !overlay || !overlay.classList.contains('po-ceo-open')) {
      frameId = 0;
      return;
    }
    for (const node of motionNodes) {
      const progress = ((now / node.duration) + node.offset) % 1;
      const distance = progress * node.length;
      const point = node.route.getPointAtLength(distance);
      const next = node.route.getPointAtLength(Math.min(node.length, distance + 2));
      const angle = Math.atan2(next.y - point.y, next.x - point.x) * 180 / Math.PI;
      node.marker.setAttribute('transform', `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)}) rotate(${angle.toFixed(1)})`);
    }
    frameId = window.requestAnimationFrame(animate);
  }

  function startAnimation() {
    if (!motionNodes.length) return stopAnimation();
    if (running) return;
    running = true;
    if (!frameId) frameId = window.requestAnimationFrame(animate);
  }

  function stopAnimation() {
    running = false;
    if (frameId) window.cancelAnimationFrame(frameId);
    frameId = 0;
  }

  function renderCounters() {
    const adults = guests.filter(guest => guest.type === 'adult').length;
    const children = guests.length - adults;
    q('#poDtActiveCount', panel).textContent = fmt(guests.length);
    q('#poDtAdultCount', panel).textContent = fmt(adults);
    q('#poDtChildCount', panel).textContent = fmt(children);
    q('#poDtOccupied', panel).textContent = fmt(guests.length);
    q('#poDtGuestCount', panel).textContent = '(' + guests.length + ')';
    q('#poDtCapacityBar', panel).style.width = Math.min(100, guests.length / 36 * 100) + '%';
    q('#poDtGuestList', panel).innerHTML = guests.length
      ? guests.map(guest => `<button type="button" class="po-dt-guest-chip ${guest.type === 'child' ? 'is-child' : 'is-adult'} ${selectedBracelet === guest.number ? 'is-selected' : ''}" data-po-dt-select="${guest.number}"><span>♙</span> №${String(guest.number).padStart(2,'0')}</button>`).join('')
      : '<span class="po-dt-empty">Активных браслетов пока нет</span>';
  }

  function selectGuest(numberValue) {
    const guest = guests.find(item => item.number === numberValue);
    if (!guest || !panel) return;
    selectedBracelet = numberValue;
    q('#poDtSelectedGuest', panel).innerHTML = `
      <div class="po-dt-selected-title">
        <span class="po-dt-selected-icon ${guest.type === 'child' ? 'is-child' : 'is-adult'}">№${String(guest.number).padStart(2,'0')}</span>
        <div><b>Браслет №${guest.number}</b><small>${guest.type === 'child' ? 'Детский вход' : 'Взрослый вход'}</small></div>
      </div>
      <small>Статус: Активен · Движение: визуальная анимация</small>`;
    qa('.po-dt-guest-chip', panel).forEach(chip => chip.classList.toggle('is-selected', Number(chip.getAttribute('data-po-dt-select')) === numberValue));
    motionNodes.forEach(node => node.marker.classList.toggle('is-selected', node.number === numberValue));
  }

  function normalizeGuests(clients) {
    const seen = new Set();
    return (Array.isArray(clients) ? clients : [])
      .filter(client => client && client.status === 'active')
      .map(client => ({ client, number: braceletNumber(client), type: guestType(client) }))
      .filter(item => {
        if (!item.number || seen.has(item.number)) return false;
        seen.add(item.number);
        return true;
      })
      .map(item => ({ number: item.number, type: item.type, client: item.client }))
      .sort((a,b) => a.number - b.number);
  }

  function renderGuests(nextGuests) {
    const signature = nextGuests.map(guest => guest.number + ':' + guest.type).join('|');
    guests = nextGuests;
    if (signature !== lastSignature) {
      lastSignature = signature;
      createRouteNodes();
    }
    renderCounters();
    if (selectedBracelet && guests.some(guest => guest.number === selectedBracelet)) selectGuest(selectedBracelet);
    else if (selectedBracelet) {
      selectedBracelet = null;
      q('#poDtSelectedGuest', panel).innerHTML = '<b>Выберите браслет</b><small>Неактивный браслет удалён с карты</small>';
    }
    q('#poDtLiveStatus', panel).textContent = '● LIVE · ' + (lastUpdated ? lastUpdated.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}) : '…');
    q('#poDtFetchHint', panel).textContent = '';
    startAnimation();
  }

  async function fetchGuests() {
    if (busy || !panel || !overlay || !overlay.classList.contains('po-ceo-open')) return;
    const token = sessionStorage.getItem(TOKEN_KEY) || '';
    if (!token) {
      q('#poDtLiveStatus', panel).textContent = '● НЕТ СЕССИИ';
      return;
    }
    busy = true;
    try {
      const response = await fetch(API + '/api/admin/control/clients', {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: 'Bearer ' + token },
        cache: 'no-store'
      });
      let data = {};
      try { data = await response.json(); } catch (_) {}
      if (!response.ok) throw new Error(data.error || ('API ' + response.status));
      lastUpdated = new Date();
      renderGuests(normalizeGuests(data.clients));
    } catch (error) {
      q('#poDtLiveStatus', panel).textContent = '● ДАННЫЕ НЕ ОБНОВЛЕНЫ';
      q('#poDtFetchHint', panel).textContent = 'Не удалось обновить: ' + String(error.message || 'ошибка');
    } finally {
      busy = false;
    }
  }

  function syncOpenState() {
    const candidate = q('#poCeoOverlay');
    if (candidate && candidate !== overlay) {
      overlay = candidate;
      panel = null;
      lastSignature = '';
    }
    const isOpen = Boolean(candidate && candidate.classList.contains('po-ceo-open'));
    if (isOpen && !wasOpen) {
      wasOpen = true;
      buildPanel();
      fetchGuests();
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = window.setInterval(fetchGuests, REFRESH_MS);
      startAnimation();
    } else if (!isOpen && wasOpen) {
      wasOpen = false;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      stopAnimation();
    }
  }

  function boot() {
    if (!document.body || observer) return;
    observer = new MutationObserver(syncOpenState);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    document.addEventListener('click', event => {
      if (event.target.closest('#poCeoRefresh')) window.setTimeout(fetchGuests, 250);
    });
    syncOpenState();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
