/* PAR ORDO LIVE DIGITAL TWIN — STATIONARY ACTION AVATARS V5
   - Removes decorative movement routes.
   - Shows only active bracelets (1–36).
   - Each bracelet has a stable illustrative zone/spot.
   - Avatars stay in place; only the pose/action animates.
   - This is visual simulation, NOT real indoor tracking.
*/
(() => {
  'use strict';

  const VERSION = '6.0.0';
  const MAP_SRC = './par-ordo-live3d-map-v4.jpg?v=4.0.0';
  const API = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const TOKEN_KEY = 'parordo_admin_token';
  const NS = 'http://www.w3.org/2000/svg';
  const STYLE_ID = 'poDtStationaryV5Style';
  const REFRESH_MS = 12000;

  let observer = null;
  let pollTimer = null;
  let panel = null;
  let overlay = null;
  let map = null;
  let peopleLayer = null;
  let busy = false;
  let lastSignature = '';
  let isOpen = false;
  let guests = [];

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

  // Stable, decorative display spots: bracelet number determines its visual pose/zone.
  // Coordinates are in the selected V4 map's 1200 × 600 viewBox.
  const SLOTS = [
    // 01–10: changing room / benches
    {x:408,y:476,zone:'Раздевалка',action:'locker'},
    {x:448,y:476,zone:'Раздевалка',action:'locker'},
    {x:488,y:476,zone:'Раздевалка',action:'locker'},
    {x:528,y:476,zone:'Раздевалка',action:'locker'},
    {x:568,y:476,zone:'Раздевалка',action:'locker'},
    {x:608,y:476,zone:'Раздевалка',action:'locker'},
    {x:428,y:438,zone:'Раздевалка',action:'locker'},
    {x:468,y:438,zone:'Раздевалка',action:'locker'},
    {x:508,y:438,zone:'Раздевалка',action:'locker'},
    {x:548,y:438,zone:'Раздевалка',action:'locker'},

    // 11–12: mirror / two hair dryers
    {x:244,y:418,zone:'Зеркало / фен',action:'mirror'},
    {x:310,y:418,zone:'Зеркало / фен',action:'mirror'},

    // 13–14: tea lounge / exactly two seats
    {x:292,y:466,zone:'Чайная зона',action:'tea'},
    {x:350,y:466,zone:'Чайная зона',action:'tea'},

    // 15–17: wash basins
    {x:792,y:259,zone:'Моечная',action:'wash'},
    {x:850,y:259,zone:'Моечная',action:'wash'},
    {x:908,y:259,zone:'Моечная',action:'wash'},

    // 18–19: two shower cabins
    {x:790,y:448,zone:'Душевая кабина',action:'shower'},
    {x:880,y:448,zone:'Душевая кабина',action:'shower'},

    // 20–21: two suspended cold-water buckets
    {x:966,y:455,zone:'Обливная бочка',action:'bucket'},
    {x:1052,y:455,zone:'Обливная бочка',action:'bucket'},

    // 22–31: three-level steam room
    {x:980,y:175,zone:'PAR / верхний уровень',action:'steam'},
    {x:1032,y:175,zone:'PAR / верхний уровень',action:'steam'},
    {x:1084,y:175,zone:'PAR / верхний уровень',action:'steam'},
    {x:1136,y:175,zone:'PAR / верхний уровень',action:'steam'},
    {x:980,y:270,zone:'PAR / средний уровень',action:'steam'},
    {x:1032,y:270,zone:'PAR / средний уровень',action:'steam'},
    {x:1084,y:270,zone:'PAR / средний уровень',action:'steam'},
    {x:1136,y:270,zone:'PAR / средний уровень',action:'steam'},
    {x:1020,y:365,zone:'PAR / нижний уровень',action:'steam'},
    {x:1100,y:365,zone:'PAR / нижний уровень',action:'steam'},

    // 32–33: disposable shorts / curtain and bin
    {x:674,y:466,zone:'Шторка / сброс шорт',action:'shorts'},
    {x:718,y:466,zone:'Шторка / сброс шорт',action:'shorts'},

    // 34–36: outdoor smoking shelter
    {x:56,y:250,zone:'Курилка',action:'smoke'},
    {x:94,y:250,zone:'Курилка',action:'smoke'},
    {x:132,y:250,zone:'Курилка',action:'smoke'}
  ];

  function svg(tag, attrs, text) {
    const node = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([key,value]) => node.setAttribute(key,String(value)));
    if (text != null) node.textContent = text;
    return node;
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* No route paths or moving line effects */
      #poCeoOverlay #poDtMap .po-dt-routes,
      #poCeoOverlay #poDtMap .po-dt-v4-routes,
      #poCeoOverlay #poDtMap .po-dt-v5-routes{display:none!important;opacity:0!important}
      #poCeoOverlay #poDtMap #poDtGuestLayer{display:none!important}
      #poCeoOverlay #poDtMap #poDtV5PeopleLayer{pointer-events:auto}
      #poCeoOverlay #poDtMap .po-dt-v5-person{cursor:pointer}
      #poCeoOverlay #poDtMap .po-dt-v5-person .halo{
        fill:rgba(44,220,137,.12);stroke:rgba(61,238,153,.72);stroke-width:1.3
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-child .halo{
        fill:rgba(49,168,255,.13);stroke:rgba(74,184,255,.8)
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person .tag{
        fill:#092619;stroke:#43df92;stroke-width:1.4
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-child .tag{
        fill:#08243a;stroke:#4bbaff
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person .tag-text{
        fill:#c0ffda;font:900 10px Arial,sans-serif;text-anchor:middle;dominant-baseline:middle
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-child .tag-text{fill:#c3eaff}
      #poCeoOverlay #poDtMap .po-dt-v5-person .skin{fill:#d6a780;stroke:#f0c49d;stroke-width:.7}
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-child .skin{fill:#e7bd98;stroke:#f5d5b5}
      #poCeoOverlay #poDtMap .po-dt-v5-person .towel{
        fill:#f1e5cf;stroke:#b99d72;stroke-width:.8
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-child .towel{
        fill:#c9e8fb;stroke:#76b6dc
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person .limb{
        fill:none;stroke:#d6a780;stroke-width:4;stroke-linecap:round;stroke-linejoin:round
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-child .limb{stroke:#e7bd98;stroke-width:3.5}
      #poCeoOverlay #poDtMap .po-dt-v5-person .person-shadow{fill:rgba(0,0,0,.42)}
      #poCeoOverlay #poDtMap .po-dt-v5-person .person-body{transform-box:fill-box;transform-origin:center bottom;animation:poV5Breath 2.8s ease-in-out infinite}
      #poCeoOverlay #poDtMap .po-dt-v5-person .arm-left,
      #poCeoOverlay #poDtMap .po-dt-v5-person .arm-right{
        transform-box:fill-box;transform-origin:top center
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-shower .arm-left{animation:poV5WashArm 1.45s ease-in-out infinite alternate}
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-shower .arm-right{animation:poV5WashArm2 1.7s ease-in-out infinite alternate}
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-wash .arm-left{animation:poV5Scrub 1.0s ease-in-out infinite alternate}
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-wash .arm-right{animation:poV5Scrub2 1.0s ease-in-out infinite alternate}
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-bucket .arm-left{animation:poV5Pull 1.6s ease-in-out infinite}
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-bucket .arm-right{animation:poV5Pull2 1.6s ease-in-out infinite}
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-mirror .arm-right{animation:poV5Dry 1.2s ease-in-out infinite alternate}
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-tea .cup-arm{animation:poV5Sip 2.8s ease-in-out infinite}
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-locker .person-body,
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-steam .person-body,
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-smoke .person-body{animation:poV5SeatedBreathe 3.2s ease-in-out infinite}
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-short .arm-right{animation:poV5Drop 1.8s ease-in-out infinite}
      #poCeoOverlay #poDtMap .po-dt-v5-person .water-drop{fill:#a4f4ff;opacity:0;animation:poV5DropFall 1.05s linear infinite}
      #poCeoOverlay #poDtMap .po-dt-v5-person .water-drop.d2{animation-delay:.35s}
      #poCeoOverlay #poDtMap .po-dt-v5-person .water-drop.d3{animation-delay:.7s}
      #poCeoOverlay #poDtMap .po-dt-v5-person .water-stream{
        fill:none;stroke:#80e9f5;stroke-width:2.5;stroke-linecap:round;
        stroke-dasharray:4 5;animation:poV5Stream .7s linear infinite
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person .steam-puff{
        fill:none;stroke:#f2dfc5;stroke-width:2.2;stroke-linecap:round;
        opacity:.55;animation:poV5Steam 2.4s ease-in-out infinite
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person .steam-puff.p2{animation-delay:.8s}
      #poCeoOverlay #poDtMap .po-dt-v5-person .steam-puff.p3{animation-delay:1.5s}
      #poCeoOverlay #poDtMap .po-dt-v5-person .bucket-mini{
        fill:#95632f;stroke:#f1c477;stroke-width:1.3
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person .cup{
        fill:#f7e4ba;stroke:#b78a4b;stroke-width:.9
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person .dryer{
        fill:#d8b15d;stroke:#fff0bd;stroke-width:.8
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person .focus-ring{
        fill:none;stroke:transparent;stroke-width:2
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-selected .focus-ring{
        stroke:#ffe29a;filter:drop-shadow(0 0 5px #e9c274)
      }
      #poCeoOverlay .po-dt-heading p{max-width:520px}
      #poCeoOverlay .po-dt-map-toolbar .po-dt-motion-key{color:#86e5b1}
      #poCeoOverlay .po-dt-v5-no-people{fill:#9ab0a0;font:700 12px Arial,sans-serif}
      #poCeoOverlay .po-dt-zone-nav.po-dt-zones-v4{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
      #poCeoOverlay .po-dt-zone-nav.po-dt-zones-v4 .po-dt-nav-caption{grid-column:1/-1}
      #poCeoOverlay .po-dt-zone-nav.po-dt-zones-v4 button{min-width:0;min-height:34px;padding:5px 7px;font-size:9px}
      #poCeoOverlay .po-dt-zone-nav.po-dt-zones-v4 button span{flex:0 0 22px}
      #poCeoOverlay #poDtMap .po-dt-v4-label rect{fill:#07100c;fill-opacity:.9;stroke:#e0b766;stroke-width:1.5}
      #poCeoOverlay #poDtMap .po-dt-v4-label text{fill:#ffedc7;font:900 10px Arial,sans-serif;letter-spacing:.45px;text-anchor:middle;dominant-baseline:middle}
      #poCeoOverlay #poDtMap .po-dt-v4-label .sub{fill:#b6cfbf;font-size:7px;font-weight:700;letter-spacing:.2px}
      #poCeoOverlay #poDtMap .po-dt-v4-lockers rect{fill:#0b1710;fill-opacity:.9;stroke:#f0c36e;stroke-width:1.15}
      #poCeoOverlay #poDtMap .po-dt-v4-lockers text{fill:#fff0c8;font:900 8px Arial,sans-serif;text-anchor:middle;dominant-baseline:middle}
      #poCeoOverlay #poDtMap .po-dt-v4-focus{fill:transparent;stroke:transparent;stroke-width:3;pointer-events:none}
      #poCeoOverlay #poDtMap .po-dt-v4-focus.is-focused{stroke:#63f0b1;filter:drop-shadow(0 0 9px rgba(75,240,165,.9))}
      @media(max-width:760px){#poCeoOverlay .po-dt-zone-nav.po-dt-zones-v4{grid-template-columns:repeat(2,minmax(0,1fr))}#poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-zone-nav.po-dt-zones-v4{grid-template-columns:repeat(3,minmax(0,1fr))}}
      @keyframes poV5Breath{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.035)}}
      @keyframes poV5SeatedBreathe{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(-1px) scaleY(1.025)}}
      @keyframes poV5WashArm{from{transform:rotate(-18deg)}to{transform:rotate(32deg)}}
      @keyframes poV5WashArm2{from{transform:rotate(30deg)}to{transform:rotate(-16deg)}}
      @keyframes poV5Scrub{from{transform:rotate(-30deg)}to{transform:rotate(18deg)}}
      @keyframes poV5Scrub2{from{transform:rotate(22deg)}to{transform:rotate(-28deg)}}
      @keyframes poV5Pull{0%,100%{transform:rotate(-10deg)}45%{transform:rotate(-55deg)}70%{transform:rotate(-28deg)}}
      @keyframes poV5Pull2{0%,100%{transform:rotate(10deg)}45%{transform:rotate(55deg)}70%{transform:rotate(28deg)}}
      @keyframes poV5Dry{from{transform:rotate(-5deg)}to{transform:rotate(-48deg)}}
      @keyframes poV5Sip{0%,55%,100%{transform:rotate(0)}75%{transform:rotate(-55deg)}}
      @keyframes poV5Drop{0%,100%{transform:rotate(20deg)}50%{transform:rotate(65deg)}}
      @keyframes poV5DropFall{0%{opacity:0;transform:translateY(-5px)}20%{opacity:.9}100%{opacity:0;transform:translateY(17px)}}
      @keyframes poV5Stream{to{stroke-dashoffset:-18}}
      @keyframes poV5Steam{0%,100%{opacity:.15;transform:translateY(2px)}50%{opacity:.85;transform:translateY(-7px)}}
      @media(prefers-reduced-motion:reduce){
        #poCeoOverlay #poDtMap .po-dt-v5-person *{animation:none!important}
      }
      /* V6: photorealistic mini guest sprites, with visible body proportions */
      #poCeoOverlay #poDtMap .po-dt-v5-person .po-dt-v6-sprite{
        transform-box:fill-box;transform-origin:50% 100%;
        filter:drop-shadow(0 3px 3px rgba(0,0,0,.58));
        animation:poV6Idle 2.8s ease-in-out infinite
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-shower .po-dt-v6-sprite{
        animation:poV6Shower 1.7s ease-in-out infinite
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-bucket .po-dt-v6-sprite{
        animation:poV6Bucket 1.5s ease-in-out infinite
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-wash .po-dt-v6-sprite{
        animation:poV6Wash 1.9s ease-in-out infinite
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-steam .po-dt-v6-sprite,
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-tea .po-dt-v6-sprite{
        animation:poV6Seated 3.1s ease-in-out infinite
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person .po-dt-v6-tag{
        stroke-width:1.7;filter:drop-shadow(0 2px 3px rgba(0,0,0,.72))
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person .po-dt-v6-tagtext{
        font:900 10px Arial,sans-serif;letter-spacing:.2px
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person .po-dt-v6-action-water{
        fill:#a8f4ff;opacity:0;filter:drop-shadow(0 0 2px #62e9ff);
        animation:poV6WaterDrop 1.1s linear infinite
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person .po-dt-v6-action-water.w2{animation-delay:.35s}
      #poCeoOverlay #poDtMap .po-dt-v5-person .po-dt-v6-action-water.w3{animation-delay:.7s}
      #poCeoOverlay #poDtMap .po-dt-v5-person .po-dt-v6-action-steam{
        fill:none;stroke:#fff1dc;stroke-width:2.1;stroke-linecap:round;
        opacity:.45;animation:poV6Steam 2.4s ease-in-out infinite
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person .po-dt-v6-action-steam.s2{animation-delay:.8s}
      #poCeoOverlay #poDtMap .po-dt-v5-person .po-dt-v6-action-steam.s3{animation-delay:1.4s}
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-child .po-dt-v6-tag{
        fill:#082a46;stroke:#55bbff
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-adult .po-dt-v6-tag{
        fill:#082a1b;stroke:#4de79b
      }
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-child .po-dt-v6-tagtext{fill:#d1eeff}
      #poCeoOverlay #poDtMap .po-dt-v5-person.is-adult .po-dt-v6-tagtext{fill:#d0ffe2}
      @keyframes poV6Idle{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}
      @keyframes poV6Shower{0%,100%{transform:rotate(-.5deg) translateY(0)}50%{transform:rotate(.7deg) translateY(-1px)}}
      @keyframes poV6Bucket{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.2deg) translateY(-1px)}}
      @keyframes poV6Wash{0%,100%{transform:rotate(-.8deg)}50%{transform:rotate(.8deg) translateY(-1px)}}
      @keyframes poV6Seated{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-1px) scale(1.012)}}
      @keyframes poV6WaterDrop{0%{opacity:0;transform:translateY(-3px)}25%{opacity:.95}100%{opacity:0;transform:translateY(12px)}}
      @keyframes poV6Steam{0%,100%{opacity:.12;transform:translateY(2px)}50%{opacity:.85;transform:translateY(-6px)}}
    `;
    document.head.appendChild(style);
  }

  function updateNavigation(currentPanel) {
    const nav = currentPanel.querySelector('.po-dt-zone-nav');
    if (!nav || nav.dataset.poDtZonesVersion === VERSION) return;
    nav.classList.add('po-dt-zones-v4');
    nav.innerHTML =
      '<div class="po-dt-nav-caption">ЗОНЫ PAR ORDO · 14 ЗОН</div>' +
      zones.map(([id,icon,label]) =>
        `<button type="button" class="${id === 'overview' ? 'is-selected' : ''}" data-po-dt-zone="${id}"><span>${icon}</span>${label}</button>`
      ).join('');
    nav.dataset.poDtZonesVersion = VERSION;
    if (!nav.dataset.poDtV5Listener) {
      nav.addEventListener('click', event => {
        const button = event.target.closest('[data-po-dt-zone]');
        if (!button) return;
        const zone = button.getAttribute('data-po-dt-zone');
        const localMap = currentPanel.querySelector('#poDtMap');
        if (!localMap) return;
        localMap.querySelectorAll('[data-po-dt-room]').forEach(el => {
          el.classList.toggle('is-focused', zone !== 'overview' && el.getAttribute('data-po-dt-room') === zone);
        });
      });
      nav.dataset.poDtV5Listener = 'true';
    }
    const toolbar = currentPanel.querySelector('.po-dt-map-toolbar');
    if (toolbar) {
      const spans = toolbar.querySelectorAll('span');
      if (spans[0]) spans[0].innerHTML = 'ПЛАН PAR ORDO <b>· 14 ЗОН</b>';
      if (spans[1]) spans[1].innerHTML = '<i></i> АКТИВНЫЕ ГОСТИ · ДЕЙСТВИЯ НА МЕСТЕ';
    }
    const desc = currentPanel.querySelector('.po-dt-heading p');
    if (desc) desc.textContent = 'Активный браслет — человек появляется в своей визуальной зоне и выполняет действие на месте';
  }

  function addLabel(group,x,y,width,title,subtitle='') {
    const height = subtitle ? 30 : 22;
    const g = svg('g',{class:'po-dt-v4-label'});
    g.appendChild(svg('rect',{x,y,width,height,rx:7}));
    g.appendChild(svg('text',{x:x+width/2,y:y+11},title));
    if (subtitle) g.appendChild(svg('text',{x:x+width/2,y:y+23,class:'sub'},subtitle));
    group.appendChild(g);
  }

  function addNumberPanel(group,x,y,columns,rows,first,cellW,cellH,gap=2) {
    const g = svg('g',{class:'po-dt-v4-lockers'});
    for (let index=0; index<columns*rows; index++) {
      const col=index%columns, row=Math.floor(index/columns);
      const px=x+col*(cellW+gap), py=y+row*(cellH+gap);
      g.appendChild(svg('rect',{x:px,y:py,width:cellW,height:cellH,rx:2}));
      g.appendChild(svg('text',{x:px+cellW/2,y:py+cellH/2+.5},String(first+index)));
    }
    group.appendChild(g);
  }

  function addFocusAreas(group) {
    const areas = [
      ['smoking',8,70,130,180],['entry',8,280,135,270],
      ['reception',195,95,225,185],['shoe-storage',435,105,190,175],
      ['mirror',185,280,130,175],['lounge',190,365,180,120],
      ['lockers',365,285,260,190],['shorts',610,300,85,190],
      ['wash-one',675,100,100,265],['toilet',660,105,75,110],
      ['wash-two',760,95,170,170],['showers',710,275,130,205],
      ['buckets',830,275,135,205],['steam',930,95,255,395]
    ];
    areas.forEach(([id,x,y,width,height]) => {
      group.appendChild(svg('rect',{x,y,width,height,rx:12,class:'po-dt-v4-focus','data-po-dt-room':id}));
    });
  }

  function installArtwork(currentPanel) {
    const currentMap = currentPanel.querySelector('#poDtMap');
    if (!currentMap || currentMap.dataset.poDtLayoutVersion === VERSION) return;
    const defs = currentMap.querySelector('defs');
    const oldLayer = currentMap.querySelector('#poDtGuestLayer');
    const routesGroup = currentMap.querySelector('.po-dt-routes');
    if (!defs || !oldLayer) return;

    currentMap.setAttribute('viewBox','0 0 1200 600');
    currentMap.setAttribute('aria-label','PAR ORDO 3D map with stationary animated guest avatars');

    // Hide old schematic background, old moving route lines, and old moving avatars.
    Array.from(currentMap.children).forEach(child => {
      if (child === defs || child === oldLayer || child === routesGroup) return;
      child.style.display = 'none';
    });
    oldLayer.style.display = 'none';
    if (routesGroup) routesGroup.style.display = 'none';

    let artwork = currentMap.querySelector('#poDtMapV4Artwork');
    if (!artwork) {
      artwork = svg('image',{
        id:'poDtMapV4Artwork',x:0,y:0,width:1200,height:600,
        preserveAspectRatio:'none',class:'po-dt-v4-art'
      });
      artwork.setAttribute('href',MAP_SRC);
      artwork.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',MAP_SRC);
      currentMap.insertBefore(artwork,oldLayer);
    }

    const overlayId='poDtMapV5Overlay';
    let labelLayer=currentMap.querySelector('#'+overlayId);
    if (!labelLayer) {
      labelLayer=svg('g',{id:overlayId});
      addNumberPanel(labelLayer,458,153,7,4,1,19,18,2);  // shoes 1–28
      addNumberPanel(labelLayer,385,337,6,6,1,31,16,2);  // changing lockers 1–36
      addLabel(labelLayer,17,105,118,'КУРИЛКА','УЛИЦА');
      addLabel(labelLayer,15,500,122,'ШЛЁПКИ','ВХОД В БАНЮ');
      addLabel(labelLayer,202,258,205,'РЕСЕПШН','ТОВАРЫ · 2 ХОЛОДИЛЬНИКА');
      addLabel(labelLayer,452,112,178,'ОБУВНЫЕ ШКАФЫ','ЧИП · 1–28');
      addLabel(labelLayer,180,282,155,'ЗЕРКАЛО · 2 ФЕНА');
      addLabel(labelLayer,190,455,152,'ЧАЙ · 2 МЕСТА');
      addLabel(labelLayer,398,490,190,'РАЗДЕВАЛКА · 1–36');
      addLabel(labelLayer,620,472,108,'ШОРТЫ','ШТОРА · СБРОС');
      addLabel(labelLayer,662,120,94,'WC','1 ДВЕРЬ');
      addLabel(labelLayer,770,110,160,'МОЕЧНАЯ 2','ТАЗИКИ · ЧЁМЫЧ');
      addLabel(labelLayer,720,470,126,'ДУШЕВЫЕ · 2');
      addLabel(labelLayer,842,470,130,'БОЧКИ · 2','ПОДВЕСНЫЕ');
      addLabel(labelLayer,1000,490,155,'PAR · 3 УРОВНЯ');
      addFocusAreas(labelLayer);
      currentMap.insertBefore(labelLayer,oldLayer);
    }

    peopleLayer = currentMap.querySelector('#poDtV5PeopleLayer');
    if (!peopleLayer) {
      peopleLayer = svg('g',{id:'poDtV5PeopleLayer','aria-label':'Active guests, stationary animated actions'});
      currentMap.appendChild(peopleLayer);
    }

    map = currentMap;
    currentMap.dataset.poDtLayoutVersion=VERSION;
  }

  function numberFor(client) {
    const raw = String(client.room ?? client.braceletNo ?? client.bracelet ?? '')
      .trim().replace(/^браслет\s*/i,'').replace(/^№\s*/,'');
    const match = raw.match(/\d{1,2}/);
    const n = match ? Number(match[0]) : NaN;
    return Number.isInteger(n) && n>=1 && n<=36 ? n : null;
  }

  function typeFor(client) {
    const items = Array.isArray(client.items) ? client.items : [];
    const values = [
      client.type,client.category,client.kind,client.clientType,client.ageType,
      client.entryType,client.tariff,client.isChild===true?'child':'',
      ...items.flatMap(item=>[item&&item.name,item&&item.title,item&&item.category,item&&item.type])
    ];
    return /детск|реб[её]нок|child|minor/i.test(values.filter(Boolean).join(' ')) ? 'child' : 'adult';
  }

  function collectActive(clients) {
    const seen=new Set();
    return (Array.isArray(clients)?clients:[])
      .filter(client=>client && client.status==='active')
      .map(client=>({client,number:numberFor(client),type:typeFor(client)}))
      .filter(item=>{
        if(!item.number || seen.has(item.number)) return false;
        seen.add(item.number);
        return true;
      })
      .map(item=>{
        const slot=SLOTS[item.number-1];
        return {number:item.number,type:item.type,zone:slot.zone,action:slot.action,x:slot.x,y:slot.y};
      })
      .sort((a,b)=>a.number-b.number);
  }

  function actionName(action) {
    return ({
      locker:'размещается в раздевалке',
      mirror:'сушит волосы',
      tea:'пьёт чай',
      wash:'умывается у тазика',
      shower:'принимает душ',
      bucket:'тянет верёвку бочки',
      steam:'отдыхает в парной',
      shorts:'подходит к шторке / корзине',
      smoke:'отдыхает в курилке'
    })[action] || 'на месте';
  }

  function spriteFor(guest) {
    if (guest.type === 'child') {
      return './par-ordo-avatar-child-standing-v6.png?v=6.0.0';
    }
    const names = {
      shower: 'shower',
      bucket: 'bucket',
      steam: 'steam',
      tea: 'tea',
      wash: 'wash'
    };
    const name = names[guest.action] || 'standing';
    return `./par-ordo-avatar-adult-${name}-v6.png?v=6.0.0`;
  }

  function spriteSize(guest) {
    if (guest.type === 'child') return {width:48,height:78};
    const sizes = {
      standing:{width:56,height:86},
      shower:{width:68,height:94},
      bucket:{width:68,height:96},
      steam:{width:88,height:78},
      tea:{width:84,height:82},
      wash:{width:86,height:90}
    };
    return sizes[guest.action] || sizes.standing;
  }

  function personMarkup(guest) {
    const size = spriteSize(guest);
    const child = guest.type === 'child';
    const tagWidth = 42;
    const tagX = Math.round(size.width / 2 - 4);
    const tagY = -size.height - 12;
    const imageX = -size.width / 2;
    const imageY = -size.height;
    const cls = guest.action === 'shower' ? 'is-shower'
      : guest.action === 'bucket' ? 'is-bucket'
      : guest.action === 'steam' ? 'is-steam'
      : guest.action === 'wash' ? 'is-wash'
      : guest.action === 'tea' ? 'is-tea'
      : guest.action === 'mirror' ? 'is-mirror'
      : guest.action === 'shorts' ? 'is-short'
      : guest.action === 'smoke' ? 'is-smoke'
      : 'is-locker';

    const g = svg('g', {
      class:`po-dt-v5-person ${child?'is-child':'is-adult'} ${cls}`,
      transform:`translate(${guest.x} ${guest.y})`,
      'data-po-dt-v5-avatar':guest.number,
      role:'button',tabindex:'0',
      'aria-label':`Браслет №${guest.number}, ${child?'детский':'взрослый'}, ${guest.zone}, ${actionName(guest.action)}`
    });

    g.appendChild(svg('ellipse',{
      class:'person-shadow',cx:0,cy:2,rx:Math.max(13,size.width*.24),ry:4
    }));

    const sprite = svg('image',{
      class:'po-dt-v6-sprite',
      x:imageX,y:imageY,width:size.width,height:size.height,
      preserveAspectRatio:'xMidYMax meet'
    });
    const source = spriteFor(guest);
    sprite.setAttribute('href',source);
    sprite.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',source);
    g.appendChild(sprite);

    // Small animated action cues remain separate from the realistic figure artwork.
    const effects = svg('g',{class:'po-dt-v6-action-effects'});
    if (guest.action === 'shower' || guest.action === 'bucket' || guest.action === 'wash') {
      const fx = guest.action === 'bucket' ? 0 : guest.action === 'shower' ? 15 : 27;
      const fy = guest.action === 'bucket' ? -size.height*.45 : -size.height*.26;
      [-8,0,8].forEach((dx,i)=>{
        effects.appendChild(svg('circle',{
          cx:fx+dx,cy:fy,width:3,r:i===1?2.1:1.7,
          class:'po-dt-v6-action-water '+(i===1?'w2':i===2?'w3':'')
        }));
      });
    }
    if (guest.action === 'steam') {
      [-10,0,10].forEach((dx,i)=>{
        effects.appendChild(svg('path',{
          d:`M${dx} ${-size.height+9} q-7 -7 0 -14 q7 -7 0 -14`,
          class:'po-dt-v6-action-steam '+(i===1?'s2':i===2?'s3':'')
        }));
      });
    }
    g.appendChild(effects);

    const tag = svg('g',{class:'po-dt-v6-number'});
    tag.appendChild(svg('rect',{
      x:tagX,y:tagY,width:tagWidth,height:18,rx:8,class:'po-dt-v6-tag'
    }));
    tag.appendChild(svg('text',{
      x:tagX+tagWidth/2,y:tagY+12.3,
      'text-anchor':'middle',class:'po-dt-v6-tagtext'
    },`№${String(guest.number).padStart(2,'0')}`));
    g.appendChild(tag);

    g.appendChild(svg('ellipse',{
      class:'focus-ring',cx:0,cy:-size.height*.52,rx:size.width*.49,ry:size.height*.43
    }));

    const showSelected = () => {
      const selected = panel && panel.querySelector('#poDtSelectedGuest');
      if (selected) {
        selected.innerHTML = `<div class="po-dt-selected-title">
          <span class="po-dt-selected-icon ${child?'is-child':'is-adult'}">№${String(guest.number).padStart(2,'0')}</span>
          <div><b>Браслет №${guest.number}</b><small>${child?'Детский':'Взрослый'} · ${guest.zone}</small></div>
        </div><small>${actionName(guest.action)} · визуальная анимация на месте</small>`;
      }
      if (peopleLayer) {
        peopleLayer.querySelectorAll('.po-dt-v5-person').forEach(el =>
          el.classList.toggle('is-selected',Number(el.getAttribute('data-po-dt-v5-avatar'))===guest.number)
        );
      }
    };
    g.addEventListener('click',showSelected);
    g.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();showSelected();}
    });
    return g;
  }

  function renderPeople(nextGuests) {
    if (!peopleLayer) return;
    const signature=nextGuests.map(g=>`${g.number}:${g.type}:${g.action}`).join('|');
    guests=nextGuests;
    if(signature===lastSignature) return;
    lastSignature=signature;
    peopleLayer.replaceChildren();
    if(!guests.length){
      // No avatar or person is rendered when all bracelets are inactive.
      return;
    }
    guests.forEach(guest=>peopleLayer.appendChild(personMarkup(guest)));
    const count=panel && panel.querySelector('#poDtGuestCount');
    if(count) count.textContent=`(${guests.length})`;
  }

  async function refreshActiveGuests() {
    if (busy || !panel || !overlay || !overlay.classList.contains('po-ceo-open')) return;
    const token=sessionStorage.getItem(TOKEN_KEY)||'';
    if(!token) {
      renderPeople([]);
      return;
    }
    busy=true;
    try {
      const response=await fetch(API+'/api/admin/control/clients',{
        method:'GET',
        headers:{Accept:'application/json',Authorization:'Bearer '+token},
        cache:'no-store'
      });
      let data={};
      try{data=await response.json();}catch(_){}
      if(!response.ok) throw new Error(data.error||('API '+response.status));
      renderPeople(collectActive(data.clients));
    } catch(error) {
      // Keep last known state on transient failures; don't flash guests away.
      const status=panel.querySelector('#poDtLiveStatus');
      if(status) status.title='Аватары: не удалось обновить список активных браслетов';
    } finally {
      busy=false;
    }
  }

  function installArtwork(currentPanel) {
    panel=currentPanel;
    overlay=document.getElementById('poCeoOverlay');
    map=panel.querySelector('#poDtMap');
    if(!map) return;
    addStyles();
    updateNavigation(panel);

    const defs=map.querySelector('defs');
    const oldLayer=map.querySelector('#poDtGuestLayer');
    const routesGroup=map.querySelector('.po-dt-routes');
    if(!defs||!oldLayer) return;

    if(map.dataset.poDtLayoutVersion!==VERSION){
      map.setAttribute('viewBox','0 0 1200 600');
      map.setAttribute('aria-label','PAR ORDO 3D map with stationary animated guest avatars');
      Array.from(map.children).forEach(child=>{
        if(child===defs||child===oldLayer||child===routesGroup) return;
        child.style.display='none';
      });

      oldLayer.style.display='none';
      if(routesGroup) routesGroup.style.display='none';

      let art=map.querySelector('#poDtMapV4Artwork');
      if(!art){
        art=svg('image',{id:'poDtMapV4Artwork',x:0,y:0,width:1200,height:600,preserveAspectRatio:'none',class:'po-dt-v4-art'});
        art.setAttribute('href',MAP_SRC);
        art.setAttributeNS('http://www.w3.org/1999/xlink','xlink:href',MAP_SRC);
        map.insertBefore(art,oldLayer);
      }

      let labelLayer=map.querySelector('#poDtMapV5Overlay');
      if(!labelLayer){
        labelLayer=svg('g',{id:'poDtMapV5Overlay'});
        addNumberPanel(labelLayer,458,153,7,4,1,19,18,2);
        addNumberPanel(labelLayer,385,337,6,6,1,31,16,2);
        addLabel(labelLayer,17,105,118,'КУРИЛКА','УЛИЦА');
        addLabel(labelLayer,15,500,122,'ШЛЁПКИ','ВХОД В БАНЮ');
        addLabel(labelLayer,202,258,205,'РЕСЕПШН','ТОВАРЫ · 2 ХОЛОДИЛЬНИКА');
        addLabel(labelLayer,452,112,178,'ОБУВНЫЕ ШКАФЫ','ЧИП · 1–28');
        addLabel(labelLayer,180,282,155,'ЗЕРКАЛО · 2 ФЕНА');
        addLabel(labelLayer,190,455,152,'ЧАЙ · 2 МЕСТА');
        addLabel(labelLayer,398,490,190,'РАЗДЕВАЛКА · 1–36');
        addLabel(labelLayer,620,472,108,'ШОРТЫ','ШТОРА · СБРОС');
        addLabel(labelLayer,662,120,94,'WC','1 ДВЕРЬ');
        addLabel(labelLayer,770,110,160,'МОЕЧНАЯ 2','ТАЗИКИ · ЧЁМЫЧ');
        addLabel(labelLayer,720,470,126,'ДУШЕВЫЕ · 2');
        addLabel(labelLayer,842,470,130,'БОЧКИ · 2','ПОДВЕСНЫЕ');
        addLabel(labelLayer,1000,490,155,'PAR · 3 УРОВНЯ');
        addFocusAreas(labelLayer);
        map.insertBefore(labelLayer,oldLayer);
      }
      map.dataset.poDtLayoutVersion=VERSION;
    }

    oldLayer.style.display='none';
    if(routesGroup) routesGroup.style.display='none';
    peopleLayer=map.querySelector('#poDtV5PeopleLayer');
    if(!peopleLayer){
      peopleLayer=svg('g',{id:'poDtV5PeopleLayer','aria-label':'Active guests, stationary animated actions'});
      map.appendChild(peopleLayer);
    }
  }

  function ensurePanel() {
    const currentOverlay=document.getElementById('poCeoOverlay');
    const currentPanel=document.getElementById('poDtLivePanel');
    if(!currentOverlay||!currentPanel) return;
    if(currentPanel!==panel || currentOverlay!==overlay) {
      panel=currentPanel;
      overlay=currentOverlay;
      map=null;
      peopleLayer=null;
      installArtwork(panel);
      lastSignature='';
    } else if(!map || !peopleLayer) {
      installArtwork(panel);
    }
  }

  function start() {
    ensurePanel();
    if(!panel||!peopleLayer) return;
    refreshActiveGuests();
    if(pollTimer) clearInterval(pollTimer);
    pollTimer=setInterval(refreshActiveGuests,REFRESH_MS);
    isOpen=true;
  }

  function stop() {
    if(pollTimer) clearInterval(pollTimer);
    pollTimer=null;
    isOpen=false;
    // Leave the base map intact; the overlay itself is closed by CEO Mode.
  }

  function scan() {
    ensurePanel();
    const currentOverlay=document.getElementById('poCeoOverlay');
    const open=Boolean(currentOverlay && currentOverlay.classList.contains('po-ceo-open'));
    if(open&&!isOpen) start();
    else if(!open&&isOpen) stop();
  }

  function boot() {
    if(observer) return;
    observer=new MutationObserver(scan);
    observer.observe(document.documentElement,{
      childList:true,subtree:true,attributes:true,attributeFilter:['id','class']
    });
    scan();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
