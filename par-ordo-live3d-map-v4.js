/* PAR ORDO LIVE DIGITAL TWIN — LAYOUT V4
   Replaces the old schematic illustration with the selected isometric layout.
   Active bracelet avatars, Fullscreen, Zoom and API polling remain in their
   original modules. This file only adapts the visual map and zone selector.
*/
(() => {
  'use strict';

  const VERSION = '4.0.0';
  const MAP_SRC = './par-ordo-live3d-map-v4.jpg?v=4.0.0';
  const NS = 'http://www.w3.org/2000/svg';
  const STYLE_ID = 'poDtLayoutV4Style';
  let observer = null;

  const zones = [
    ['overview','⌂','Обзор'],
    ['smoking','♨','Курилка'],
    ['entry','⇢','Шлёпки / вход'],
    ['reception','▤','Ресепшн + напитки'],
    ['shoe-storage','▦','Обувные шкафы 1–28'],
    ['mirror','◉','Зеркало + 2 фена'],
    ['lounge','☕','Чай / 2 места'],
    ['lockers','▦','Раздевалка 1–36'],
    ['shorts','▤','Шорты / штора'],
    ['wash-one','♨','Первая моечная'],
    ['toilet','WC','Туалет / 1 дверь'],
    ['wash-two','♨','Моечная / тазики'],
    ['showers','♧','Душевые / 2'],
    ['buckets','▤','Бочки / 2'],
    ['steam','♨','PAR / 3 уровня']
  ];

  function svg(tag, attrs, text) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, String(value)));
    if (text != null) node.textContent = text;
    return node;
  }

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #poCeoOverlay .po-dt-zone-nav.po-dt-zones-v4{
        display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px
      }
      #poCeoOverlay .po-dt-zone-nav.po-dt-zones-v4 .po-dt-nav-caption{grid-column:1/-1}
      #poCeoOverlay .po-dt-zone-nav.po-dt-zones-v4 button{
        min-width:0;min-height:34px;padding:5px 7px;font-size:9px
      }
      #poCeoOverlay .po-dt-zone-nav.po-dt-zones-v4 button span{flex:0 0 22px}
      #poCeoOverlay #poDtMap .po-dt-v4-art{pointer-events:none}
      #poCeoOverlay #poDtMap .po-dt-v4-routes{pointer-events:none;opacity:.82}
      #poCeoOverlay #poDtMap .po-dt-v4-label rect{
        fill:#07100c;fill-opacity:.88;stroke:#e0b766;stroke-width:1.5
      }
      #poCeoOverlay #poDtMap .po-dt-v4-label text{
        fill:#ffedc7;font:900 10px Arial,sans-serif;letter-spacing:.45px;
        text-anchor:middle;dominant-baseline:middle
      }
      #poCeoOverlay #poDtMap .po-dt-v4-label .sub{
        fill:#b6cfbf;font-size:7px;font-weight:700;letter-spacing:.2px
      }
      #poCeoOverlay #poDtMap .po-dt-v4-lockers rect{
        fill:#0b1710;fill-opacity:.84;stroke:#f0c36e;stroke-width:1.15
      }
      #poCeoOverlay #poDtMap .po-dt-v4-lockers text{
        fill:#fff0c8;font:900 8px Arial,sans-serif;text-anchor:middle;dominant-baseline:middle
      }
      #poCeoOverlay #poDtMap .po-dt-v4-focus{
        fill:transparent;stroke:transparent;stroke-width:3;pointer-events:none
      }
      #poCeoOverlay #poDtMap .po-dt-v4-focus.is-focused{
        stroke:#63f0b1;filter:drop-shadow(0 0 9px rgba(75,240,165,.9))
      }
      @media(max-width:760px){
        #poCeoOverlay .po-dt-zone-nav.po-dt-zones-v4{grid-template-columns:repeat(2,minmax(0,1fr))}
        #poCeoOverlay .po-dt-zone-nav.po-dt-zones-v4 button{font-size:8px}
        #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-zone-nav.po-dt-zones-v4{grid-template-columns:repeat(3,minmax(0,1fr))}
      }
    `;
    document.head.appendChild(style);
  }

  function updateZoneNavigation(panel) {
    const nav = panel.querySelector('.po-dt-zone-nav');
    if (!nav || nav.dataset.poDtZonesVersion === VERSION) return;
    nav.classList.add('po-dt-zones-v4');
    nav.innerHTML =
      '<div class="po-dt-nav-caption">ЗОНЫ PAR ORDO · 14 ЗОН</div>' +
      zones.map(([id, icon, label]) =>
        `<button type="button" class="${id === 'overview' ? 'is-selected' : ''}" data-po-dt-zone="${id}"><span>${icon}</span>${label}</button>`
      ).join('');
    nav.dataset.poDtZonesVersion = VERSION;
    const toolbar = panel.querySelector('.po-dt-map-toolbar');
    if (toolbar) {
      const title = toolbar.querySelector('span');
      if (title) title.innerHTML = 'ПЛАН PAR ORDO <b>· 14 ЗОН</b>';
    }
  }

  function addLabel(group, x, y, width, title, subtitle = '') {
    const height = subtitle ? 30 : 22;
    const item = svg('g', { class: 'po-dt-v4-label' });
    item.appendChild(svg('rect', { x, y, width, height, rx: 7 }));
    item.appendChild(svg('text', { x: x + width / 2, y: y + (subtitle ? 11 : 11) }, title));
    if (subtitle) item.appendChild(svg('text', { x: x + width / 2, y: y + 23, class: 'sub' }, subtitle));
    group.appendChild(item);
  }

  function addNumberPanel(group, x, y, columns, rows, first, cellW, cellH, gap = 2) {
    const g = svg('g', { class: 'po-dt-v4-lockers' });
    for (let index = 0; index < columns * rows; index++) {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const px = x + col * (cellW + gap);
      const py = y + row * (cellH + gap);
      g.appendChild(svg('rect', { x:px, y:py, width:cellW, height:cellH, rx:2 }));
      g.appendChild(svg('text', { x:px + cellW/2, y:py + cellH/2 + .5 }, String(first + index)));
    }
    group.appendChild(g);
  }

  function addFocusAreas(group) {
    const areas = [
      ['smoking', 8, 70, 130, 180],
      ['entry', 8, 280, 135, 270],
      ['reception', 195, 95, 225, 185],
      ['shoe-storage', 435, 105, 190, 175],
      ['mirror', 185, 280, 130, 175],
      ['lounge', 190, 365, 180, 120],
      ['lockers', 365, 285, 260, 190],
      ['shorts', 610, 300, 85, 190],
      ['wash-one', 675, 100, 100, 265],
      ['toilet', 660, 105, 75, 110],
      ['wash-two', 760, 95, 170, 170],
      ['showers', 710, 275, 130, 205],
      ['buckets', 830, 275, 135, 205],
      ['steam', 930, 95, 255, 395]
    ];
    areas.forEach(([id,x,y,width,height]) => {
      group.appendChild(svg('rect', {
        x,y,width,height,rx:12,
        class:'po-dt-v4-focus',
        'data-po-dt-room':id
      }));
    });
  }

  function installArtwork(panel) {
    const map = panel.querySelector('#poDtMap');
    if (!map || map.dataset.poDtLayoutVersion === VERSION) return;
    const defs = map.querySelector('defs');
    const guestLayer = map.querySelector('#poDtGuestLayer');
    const routesGroup = map.querySelector('.po-dt-routes');
    if (!defs || !guestLayer || !routesGroup) return;

    map.setAttribute('viewBox','0 0 1200 600');
    map.setAttribute('aria-label','PAR ORDO isometric architectural floorplan, 14 zones');

    Array.from(map.children).forEach(child => {
      if (child === defs || child === routesGroup || child === guestLayer) return;
      child.style.display = 'none';
    });

    let artwork = map.querySelector('#poDtMapV4Artwork');
    if (!artwork) {
      artwork = svg('image', {
        id:'poDtMapV4Artwork', x:0, y:0, width:1200, height:600,
        preserveAspectRatio:'none', class:'po-dt-v4-art'
      });
      artwork.setAttribute('href', MAP_SRC);
      artwork.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',MAP_SRC);
      map.insertBefore(artwork, routesGroup);
    }

    const routePaths = {
      poDtRouteA: 'M 75 438 C 110 405 120 350 165 325 S 250 205 345 210 S 485 170 545 200 S 560 340 490 370 S 420 410 520 430 S 650 430 685 350 S 735 240 810 205 S 820 325 805 370 S 890 360 930 340 S 1030 340 1090 285 S 1120 440 1040 465 S 800 515 620 490 S 280 520 120 510 S 40 480 75 438',
      poDtRouteB: 'M 92 470 C 170 520 210 425 245 360 S 270 220 350 215 S 510 185 580 205 S 650 295 630 385 S 690 390 740 330 S 770 185 845 205 S 900 300 905 390 S 1000 440 1080 360 S 1100 485 1000 505 S 700 505 520 475 S 230 535 92 470',
      poDtRouteC: 'M 120 420 C 155 350 205 325 255 270 S 385 160 480 190 S 560 285 560 350 S 610 440 700 410 S 760 325 800 260 S 860 220 905 285 S 945 390 1010 400 S 1125 390 1120 470 S 900 535 740 485 S 450 530 250 500 S 110 470 120 420'
    };
    Object.entries(routePaths).forEach(([id,d]) => {
      const path = map.querySelector('#' + id);
      if (path) {
        path.setAttribute('d',d);
        path.setAttribute('stroke-width','4.5');
        path.setAttribute('stroke-dasharray','9 13');
      }
    });
    routesGroup.classList.add('po-dt-v4-routes');
    routesGroup.style.opacity = '.8';

    let overlay = map.querySelector('#poDtMapV4Overlay');
    if (!overlay) {
      overlay = svg('g',{id:'poDtMapV4Overlay'});
      // Exact bracelet/locker number overlays, drawn as code rather than baked into an image.
      addNumberPanel(overlay, 458, 153, 7, 4, 1, 19, 18, 2);   // shoe storage 1–28
      addNumberPanel(overlay, 385, 337, 6, 6, 1, 31, 16, 2);   // changing lockers 1–36

      addLabel(overlay, 17, 105, 118, 'КУРИЛКА', 'УЛИЦА');
      addLabel(overlay, 15, 500, 122, 'ШЛЁПКИ', 'ВХОД В БАНЮ');
      addLabel(overlay, 202, 258, 205, 'РЕСЕПШН', 'ТОВАРЫ · 2 ХОЛОДИЛЬНИКА');
      addLabel(overlay, 452, 112, 178, 'ОБУВНЫЕ ШКАФЫ', 'ЧИП · 1–28');
      addLabel(overlay, 180, 282, 155, 'ЗЕРКАЛО · 2 ФЕНА');
      addLabel(overlay, 190, 455, 152, 'ЧАЙ · 2 МЕСТА');
      addLabel(overlay, 398, 490, 190, 'РАЗДЕВАЛКА · 1–36');
      addLabel(overlay, 620, 472, 108, 'ШОРТЫ', 'ШТОРА · СБРОС');
      addLabel(overlay, 662, 120, 94, 'WC', '1 ДВЕРЬ');
      addLabel(overlay, 770, 110, 160, 'МОЕЧНАЯ 2', 'ТАЗИКИ · ЧЁМЫЧ');
      addLabel(overlay, 720, 470, 126, 'ДУШЕВЫЕ · 2');
      addLabel(overlay, 842, 470, 130, 'БОЧКИ · 2', 'ПОДВЕСНЫЕ');
      addLabel(overlay, 1000, 490, 155, 'PAR · 3 УРОВНЯ');
      addFocusAreas(overlay);
      map.insertBefore(overlay, guestLayer);
    }

    map.dataset.poDtLayoutVersion = VERSION;
  }

  function apply() {
    const panel = document.getElementById('poDtLivePanel');
    if (!panel) return;
    addStyle();
    updateZoneNavigation(panel);
    installArtwork(panel);
  }

  function boot() {
    if (observer) return;
    observer = new MutationObserver(apply);
    observer.observe(document.documentElement, {
      childList:true, subtree:true, attributes:true,
      attributeFilter:['id','class']
    });
    apply();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded',boot,{once:true});
  } else {
    boot();
  }
})();
