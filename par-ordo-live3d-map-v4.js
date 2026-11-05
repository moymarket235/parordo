/* PAR ORDO LIVE DIGITAL TWIN — STATIONARY ACTION AVATARS V5
   - Removes decorative movement routes.
   - Shows only active bracelets (1–36).
   - Each bracelet has a stable illustrative zone/spot.
   - Avatars stay in place; only the pose/action animates.
   - This is visual simulation, NOT real indoor tracking.
*/
(() => {
  'use strict';

  const VERSION = '8.0.0';
  const MAP_SRC = './par-ordo-live3d-map-v4.jpg?v=4.0.0';
  const API = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const TOKEN_KEY = 'parordo_admin_token';
  const NS = 'http://www.w3.org/2000/svg';
  const STYLE_ID = 'poDtActiveNumbersV8Style';
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

  // Fixed visual positions constrained to the interior of each room.
  // The map is a conceptual illustration; these slots are NOT indoor tracking.
  const SLOTS = [
    // 01–10: changing room, two neat rows inside the room
    {x:420,y:408,zone:'Раздевалка',action:'locker'},
    {x:460,y:408,zone:'Раздевалка',action:'locker'},
    {x:500,y:408,zone:'Раздевалка',action:'locker'},
    {x:540,y:408,zone:'Раздевалка',action:'locker'},
    {x:580,y:408,zone:'Раздевалка',action:'locker'},
    {x:420,y:442,zone:'Раздевалка',action:'locker'},
    {x:460,y:442,zone:'Раздевалка',action:'locker'},
    {x:500,y:442,zone:'Раздевалка',action:'locker'},
    {x:540,y:442,zone:'Раздевалка',action:'locker'},
    {x:580,y:442,zone:'Раздевалка',action:'locker'},

    // 11–12: mirror and two hair dryers
    {x:245,y:345,zone:'Зеркало / фен',action:'mirror'},
    {x:310,y:345,zone:'Зеркало / фен',action:'mirror'},

    // 13–14: tea lounge, exactly two seats
    {x:265,y:420,zone:'Чайная зона',action:'tea'},
    {x:330,y:420,zone:'Чайная зона',action:'tea'},

    // 15–17: wash basins
    {x:780,y:238,zone:'Моечная',action:'wash'},
    {x:840,y:238,zone:'Моечная',action:'wash'},
    {x:900,y:238,zone:'Моечная',action:'wash'},

    // 18–19: two shower cabins
    {x:750,y:390,zone:'Душевая кабина 1',action:'shower'},
    {x:820,y:390,zone:'Душевая кабина 2',action:'shower'},

    // 20–21: two overhead cold-water buckets
    {x:865,y:390,zone:'Обливная бочка 1',action:'bucket'},
    {x:930,y:390,zone:'Обливная бочка 2',action:'bucket'},

    // 22–31: PAR, distributed across three levels
    {x:980,y:205,zone:'PAR / верхний уровень',action:'steam'},
    {x:1045,y:205,zone:'PAR / верхний уровень',action:'steam'},
    {x:1110,y:205,zone:'PAR / верхний уровень',action:'steam'},
    {x:1165,y:205,zone:'PAR / верхний уровень',action:'steam'},
    {x:995,y:295,zone:'PAR / средний уровень',action:'steam'},
    {x:1080,y:295,zone:'PAR / средний уровень',action:'steam'},
    {x:1160,y:295,zone:'PAR / средний уровень',action:'steam'},
    {x:995,y:395,zone:'PAR / нижний уровень',action:'steam'},
    {x:1080,y:395,zone:'PAR / нижний уровень',action:'steam'},
    {x:1160,y:395,zone:'PAR / нижний уровень',action:'steam'},

    // 32–33: curtain and used disposable-shorts basket
    {x:640,y:410,zone:'Шторка / сброс шорт',action:'shorts'},
    {x:690,y:410,zone:'Шторка / сброс шорт',action:'shorts'},

    // 34–36: outdoor smoking shelter
    {x:40,y:220,zone:'Курилка',action:'smoke'},
    {x:85,y:220,zone:'Курилка',action:'smoke'},
    {x:130,y:220,zone:'Курилка',action:'smoke'}
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
      #poCeoOverlay #poDtMap .po-dt-routes,
      #poCeoOverlay #poDtMap .po-dt-v4-routes,
      #poCeoOverlay #poDtMap .po-dt-v5-routes{display:none!important;opacity:0!important}
      #poCeoOverlay #poDtMap #poDtGuestLayer{display:none!important}
      #poCeoOverlay #poDtMap #poDtV5PeopleLayer{pointer-events:auto}
      #poCeoOverlay #poDtMap .po-dt-v5-person,
      #poCeoOverlay #poDtMap .po-dt-v6-sprite{display:none!important}
      #poCeoOverlay #poDtMap .po-dt-v8-number{cursor:pointer;filter:drop-shadow(0 2px 4px rgba(0,0,0,.75))}
      #poCeoOverlay #poDtMap .po-dt-v8-number .po-dt-v8-number-pill{transition:stroke-width .15s ease,filter .15s ease}
      #poCeoOverlay #poDtMap .po-dt-v8-number.is-selected .po-dt-v8-number-pill{stroke:#ffe39b;stroke-width:3;filter:drop-shadow(0 0 5px rgba(255,220,145,.85))}
      #poCeoOverlay #poDtMap .po-dt-v8-number:focus{outline:none}
      #poCeoOverlay #poDtMap .po-dt-v8-number:focus .po-dt-v8-number-pill{stroke:#fff1bf;stroke-width:3}
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
      @media(max-width:760px){
        #poCeoOverlay .po-dt-zone-nav.po-dt-zones-v4{grid-template-columns:repeat(2,minmax(0,1fr))}
        #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-zone-nav.po-dt-zones-v4{grid-template-columns:repeat(3,minmax(0,1fr))}
      }
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
      if (spans[1]) spans[1].innerHTML = '<i></i> АКТИВНЫЕ НОМЕРА · БЕЗ ЛЮДЕЙ И ЛИНИЙ';
    }
    const desc = currentPanel.querySelector('.po-dt-heading p');
    if (desc) desc.textContent = 'На карте отображаются только активные номера браслетов: взрослые — зелёные, детские — синие';
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
    currentMap.setAttribute('aria-label','PAR ORDO 3D map with active bracelet numbers only');

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
      peopleLayer = svg('g',{id:'poDtV5PeopleLayer','aria-label':'Active bracelet numbers only'});
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

  function personMarkup(guest) {
    const child = guest.type === 'child';
    const numberText = String(guest.number).padStart(2, '0');
    const numberClass = child ? 'is-child' : 'is-adult';
    const g = svg('g', {
      class: 'po-dt-v8-number ' + numberClass,
      transform: 'translate(' + guest.x + ' ' + guest.y + ')',
      'data-po-dt-v8-number': guest.number,
      role: 'button',
      tabindex: '0',
      'aria-label': 'Активный браслет №' + numberText + ', ' + (child ? 'детский' : 'взрослый') + ', визуальная зона: ' + guest.zone
    });
    const fill = child ? '#082b46' : '#08291b';
    const stroke = child ? '#4bbaff' : '#42e397';
    const textFill = child ? '#d2edff' : '#d1ffe2';
    g.appendChild(svg('rect', {
      x: -23, y: -12, width: 46, height: 24, rx: 9,
      fill: fill, stroke: stroke, 'stroke-width': 1.8,
      class: 'po-dt-v8-number-pill'
    }));
    g.appendChild(svg('circle', {
      cx: -15, cy: 0, r: 3, fill: child ? '#57bfff' : '#52e99f'
    }));
    g.appendChild(svg('text', {
      x: 5, y: 4, 'text-anchor': 'middle', fill: textFill,
      'font-family': 'Arial, sans-serif', 'font-size': 11,
      'font-weight': 900, 'letter-spacing': .2, class: 'po-dt-v8-number-text'
    }, '№' + numberText));

    const showSelected = () => {
      const selected = panel && panel.querySelector('#poDtSelectedGuest');
      if (selected) {
        selected.innerHTML = '<div class="po-dt-selected-title">' +
          '<span class="po-dt-selected-icon ' + numberClass + '">№' + numberText + '</span>' +
          '<div><b>Браслет №' + guest.number + '</b><small>' + (child ? 'Детский' : 'Взрослый') + ' · ' + guest.zone + '</small></div>' +
          '</div><small>Статус: Активен · зона указана как визуальная схема</small>';
      }
      if (peopleLayer) {
        peopleLayer.querySelectorAll('.po-dt-v8-number').forEach(el =>
          el.classList.toggle('is-selected', Number(el.getAttribute('data-po-dt-v8-number')) === guest.number)
        );
      }
    };
    g.addEventListener('click', showSelected);
    g.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showSelected();
      }
    });
    return g;
  }

  function renderPeople(nextGuests) {
    if (!peopleLayer) return;
    const signature=nextGuests.map(g=>`${g.number}:${g.type}`).join('|');
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
      map.setAttribute('aria-label','PAR ORDO 3D map with active bracelet numbers only');
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
      peopleLayer=svg('g',{id:'poDtV5PeopleLayer','aria-label':'Active bracelet numbers only'});
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
