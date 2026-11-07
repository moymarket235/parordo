/* PAR ORDO OWNER — CLEAN CONTROL overlay v1.1.2 + ENGINEERING WING / WATTS NODE for the existing 3D floor map.
   Red pulse = not submitted/rejected; amber = pending manager review; green check = approved.
   Uses read-only Clean Control API endpoints and does not change guest tracking. */
(() => {
  'use strict';
  const API = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const TOKEN_KEY = 'parordo_admin_token';
  const POLL_MS = 15000;
  const TECH_DECK_ID = 'poCleanTechnicalDeck';
  const NS = 'http://www.w3.org/2000/svg';
  const STYLE_ID = 'poCleanControlMapV112Style';

  const ALL_FLOOR_ZONES = ['entry','reception','shoe-storage','mirror','lounge','lockers','shorts','wash-one','toilet','wash-two','showers','buckets','steam'];
  const TASK_ZONES = {
    'clean-01':['steam'],
    'clean-02':['showers'],
    'clean-03':['wash-one','wash-two'],
    'clean-04':['toilet'],
    'clean-05':['lockers'],
    'clean-06':ALL_FLOOR_ZONES,
    'clean-07':['mirror'],
    'clean-08':['lounge'],
    'clean-09':['entry','reception','toilet'],
    'clean-10':['shoe-storage'],
    'clean-11':['wash-one','wash-two'],
    'clean-12':['shorts'],
    'clean-13':['entry','shoe-storage'],
    'clean-14':['reception'],
    'clean-15':['reception'],
    'clean-16':ALL_FLOOR_ZONES,
    'clean-17':['steam'],
    'clean-18':['lounge'],
    'clean-19':['lounge'],
    'clean-20':['entry','shoe-storage']
  };
  const BOUNDS = {
    entry:[8,280,135,270],
    reception:[195,95,225,185],
    'shoe-storage':[435,105,190,175],
    mirror:[185,280,130,175],
    lounge:[190,365,180,120],
    lockers:[365,285,260,190],
    shorts:[610,300,85,190],
    'wash-one':[675,100,100,265],
    toilet:[660,105,75,110],
    'wash-two':[760,95,170,170],
    showers:[710,275,130,205],
    buckets:[830,275,135,205],
    steam:[930,95,255,395]
  };

  let payload = null;
  let active = false;
  let busy = false;
  let pollTimer = null;
  let syncQueued = false;
  let observer = null;
  let activeMap = null;

  const $ = (s, root=document) => root.querySelector(s);
  function svg(tag, attrs, text) {
    const el = document.createElementNS(NS, tag);
    Object.entries(attrs || {}).forEach(([k,v]) => el.setAttribute(k, String(v)));
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }
  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @keyframes poCleanRedPulse{0%,100%{opacity:.72;filter:drop-shadow(0 0 3px rgba(255,55,55,.62))}50%{opacity:1;filter:drop-shadow(0 0 11px rgba(255,55,55,.95))}}
      @keyframes poCleanAmberPulse{0%,100%{opacity:.78}50%{opacity:1}}
      #poCeoOverlay .po-clean-map-legend{display:flex;flex-wrap:wrap;align-items:center;gap:7px 13px;margin-top:9px;padding:9px 11px;border:1px solid rgba(193,153,86,.24);border-radius:12px;background:rgba(4,12,8,.82);color:#c6d3c8;font-size:10px;line-height:1.4}
      #poCeoOverlay .po-clean-map-legend b{color:#f2dfb8;letter-spacing:.08em}
      #poCeoOverlay .po-clean-legend-item{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
      #poCeoOverlay .po-clean-legend-dot{width:9px;height:9px;display:inline-block;border-radius:50%}
      #poCeoOverlay .po-clean-legend-dot.red{background:#ff4c4c;box-shadow:0 0 8px #ff4c4c}
      #poCeoOverlay .po-clean-legend-dot.amber{background:#ffcf66;box-shadow:0 0 7px #ffcf66}
      #poCeoOverlay .po-clean-legend-dot.green{background:#55e99a;box-shadow:0 0 7px #55e99a}
      #poCeoOverlay .po-clean-zone{pointer-events:none;stroke-width:4;vector-effect:non-scaling-stroke}
      #poCeoOverlay .po-clean-zone.red{fill:rgba(255,49,49,.17);stroke:#ff5555;animation:poCleanRedPulse 1.25s ease-in-out infinite}
      #poCeoOverlay .po-clean-zone.amber{fill:rgba(255,190,62,.13);stroke:#ffc85c;stroke-dasharray:7 4;animation:poCleanAmberPulse 1.7s ease-in-out infinite}
      #poCeoOverlay .po-clean-zone.green{fill:rgba(50,224,128,.13);stroke:#4be391;stroke-width:3;filter:drop-shadow(0 0 6px rgba(55,230,139,.7))}
      #poCeoOverlay .po-clean-zone-badge{stroke-width:2.5;vector-effect:non-scaling-stroke}
      #poCeoOverlay .po-clean-zone-badge.red{fill:#721a1a;stroke:#ff6c65}
      #poCeoOverlay .po-clean-zone-badge.amber{fill:#614514;stroke:#ffd16d}
      #poCeoOverlay .po-clean-zone-badge.green{fill:#0d5633;stroke:#64efaa}
      #poCeoOverlay .po-clean-zone-mark{font:900 18px Arial,sans-serif;text-anchor:middle;dominant-baseline:middle;fill:#fff7e8;pointer-events:none}
      #poCeoOverlay .po-clean-zone-count{font:800 9px Arial,sans-serif;text-anchor:middle;dominant-baseline:middle;fill:#fff8e9;pointer-events:none}
      #poCeoOverlay .po-clean-plant{margin-top:12px;overflow:hidden;border:1px solid rgba(212,171,103,.28);border-radius:16px;background:radial-gradient(ellipse at 50% 0,rgba(47,105,74,.18),transparent 55%),linear-gradient(145deg,#0c1a14,#07100d 72%,#151008);box-shadow:inset 0 1px rgba(255,255,255,.04),0 10px 25px rgba(0,0,0,.2)}
      #poCeoOverlay .po-clean-plant-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:13px 14px 8px}
      #poCeoOverlay .po-clean-plant-kicker{display:block;color:#e2c58c;font-size:9px;font-weight:900;letter-spacing:.2em}
      #poCeoOverlay .po-clean-plant-head h3{margin:4px 0 2px;color:#fff0d0;font:800 17px/1.2 Georgia,serif}
      #poCeoOverlay .po-clean-plant-head p{margin:0;color:#9eb1a4;font-size:10px;line-height:1.4}
      #poCeoOverlay .po-clean-plant-chip{flex:none;padding:6px 9px;border:1px solid rgba(92,220,151,.3);border-radius:99px;color:#8cecb4;background:rgba(45,140,87,.1);font-size:9px;font-weight:850;letter-spacing:.08em}
      #poCeoOverlay .po-clean-plant-svg{display:block;width:100%;height:auto;max-height:250px;padding:0 8px}
      #poCeoOverlay .po-clean-plant-modules{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:4px 12px 12px}
      #poCeoOverlay .po-clean-plant-module{display:grid;grid-template-columns:66px minmax(0,1fr);gap:8px;align-items:center;min-width:0;padding:7px;border:1px solid rgba(203,165,105,.17);border-radius:12px;background:rgba(2,8,6,.45)}
      #poCeoOverlay .po-clean-plant-module img{width:66px;height:74px;object-fit:cover;border-radius:8px;border:1px solid rgba(211,174,111,.25)}
      #poCeoOverlay .po-clean-plant-icon{width:66px;height:74px;display:grid;place-items:center;border:1px solid rgba(211,174,111,.25);border-radius:8px;background:radial-gradient(circle at 50% 40%,rgba(255,174,80,.25),#0b1711 70%);color:#ffd08a;font-size:34px;text-shadow:0 0 16px rgba(255,169,75,.45)}
      #poCeoOverlay .po-clean-plant-module b{display:block;color:#f5e5c4;font-size:10px;line-height:1.25}
      #poCeoOverlay .po-clean-plant-module small{display:block;margin-top:3px;color:#9daf9f;font-size:8px;line-height:1.35}
      #poCeoOverlay .po-clean-plant-status{display:inline-flex;align-items:center;gap:5px;margin-top:6px;color:#b8c8bd;font-size:8px;font-weight:850}
      #poCeoOverlay .po-clean-plant-status:before{content:"";width:7px;height:7px;display:inline-block;border-radius:50%;background:#ff5753;box-shadow:0 0 8px rgba(255,75,75,.7)}
      #poCeoOverlay .po-clean-plant-status.amber:before{background:#ffcc6a;box-shadow:0 0 8px rgba(255,204,106,.6)}
      #poCeoOverlay .po-clean-plant-status.green:before{background:#5be5a0;box-shadow:0 0 8px rgba(91,229,160,.6)}
      #poCeoOverlay .po-clean-plant-status.closed:before{background:#87958b;box-shadow:none}
      #poCeoOverlay .po-clean-plant-note{padding:0 13px 12px;color:#84988b;font-size:8px;line-height:1.45}
      @media(max-width:480px){#poCeoOverlay .po-clean-plant-head{padding:11px 11px 7px}#poCeoOverlay .po-clean-plant-head h3{font-size:15px}#poCeoOverlay .po-clean-plant-modules{gap:6px;padding:3px 8px 9px}#poCeoOverlay .po-clean-plant-module{grid-template-columns:54px minmax(0,1fr);gap:6px;padding:6px}#poCeoOverlay .po-clean-plant-module img,#poCeoOverlay .po-clean-plant-icon{width:54px;height:65px}#poCeoOverlay .po-clean-plant-module b{font-size:9px}#poCeoOverlay .po-clean-plant-module small{font-size:7px}}
      @media(prefers-reduced-motion:reduce){#poCeoOverlay .po-clean-zone.red,#poCeoOverlay .po-clean-zone.amber{animation:none}}
    `;
    document.head.appendChild(style);
  }
  function token() { return sessionStorage.getItem(TOKEN_KEY) || ''; }
  async function getJson(path, bearer) {
    const response = await fetch(API + path, {method:'GET',headers:{Accept:'application/json',Authorization:'Bearer '+bearer},cache:'no-store'});
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || ('API ' + response.status));
    return data;
  }
  function bishkekDay() {
    return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bishkek',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  }
  function ensureLegend(panel) {
    let legend = $('#poCleanControlLegend', panel);
    if (legend) return legend;
    legend = document.createElement('div');
    legend.id = 'poCleanControlLegend';
    legend.className = 'po-clean-map-legend';
    const foot = $('.po-dt-map-foot', panel);
    if (foot) foot.insertAdjacentElement('afterend', legend);
    else $('.po-dt-map-column', panel)?.appendChild(legend);
    return legend;
  }
  function ensureTechnicalDeck(panel) {
    let deck = $('#'+TECH_DECK_ID, panel);
    if (deck) return deck;
    deck = document.createElement('section');
    deck.id = TECH_DECK_ID;
    deck.className = 'po-clean-plant';
    deck.setAttribute('aria-label','Технический узел PAR ORDO: топка, бойлеры и приборы');
    deck.innerHTML = `
      <div class="po-clean-plant-head"><div><span class="po-clean-plant-kicker">ENGINEERING WING · DIGITAL TWIN</span><h3>Котельная и тепловой контур</h3><p>Отдельный технический модуль на карте PAR ORDO</p></div><span class="po-clean-plant-chip">5 ПРОВЕРОК</span></div>
      <svg class="po-clean-plant-svg" viewBox="0 0 1000 250" role="img" aria-label="Схематичная 3D-компоновка топки, WENTA, NAVIEN, WATTS и парогенератора">
        <defs>
          <linearGradient id="poPlantFloor" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#23382d"/><stop offset="1" stop-color="#0b1711"/></linearGradient>
          <linearGradient id="poPlantMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#68716a"/><stop offset=".45" stop-color="#303b35"/><stop offset="1" stop-color="#151d19"/></linearGradient>
          <linearGradient id="poPlantFire" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffcc72"/><stop offset=".55" stop-color="#e86a2b"/><stop offset="1" stop-color="#64251a"/></linearGradient>
          <filter id="poPlantShadow"><feGaussianBlur in="SourceAlpha" stdDeviation="4"/><feOffset dy="5"/><feComponentTransfer><feFuncA type="linear" slope=".45"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <path d="M40 190L300 58L955 151L590 232Z" fill="url(#poPlantFloor)" stroke="#9a7540" stroke-opacity=".55" stroke-width="2"/>
        <path d="M40 190L300 58L300 74L40 206Z" fill="#18271f" stroke="#9a7540" stroke-opacity=".32"/><path d="M300 58L955 151L955 168L300 74Z" fill="#27362c" stroke="#9a7540" stroke-opacity=".4"/>
        <path d="M115 172L315 70L315 82L115 185Z" fill="none" stroke="#c78e49" stroke-width="8" stroke-linecap="round"/><path d="M315 78L505 111L505 124L315 92Z" fill="none" stroke="#b4c6b7" stroke-width="8"/><path d="M505 112L900 176L900 190L505 126Z" fill="none" stroke="#c78e49" stroke-width="8"/>
        <g data-po-clean-tech="topka" filter="url(#poPlantShadow)"><path d="M115 98L205 53L294 69L204 116Z" fill="#6c4530" stroke="#d09a5b" stroke-width="2"/><path d="M115 98V177L204 195V116Z" fill="#39291d" stroke="#bd8a4a" stroke-width="2"/><path d="M204 116V195L294 149V69Z" fill="url(#poPlantMetal)" stroke="#bd8a4a" stroke-width="2"/><rect x="145" y="119" width="45" height="48" rx="5" fill="#141a16" stroke="#e2a65a" stroke-width="3"/><path d="M154 159Q151 137 166 129Q181 145 178 160Z" fill="url(#poPlantFire)"/><path d="M164 160Q162 146 170 141Q177 151 173 160Z" fill="#fff0aa"/><path d="M214 114L214 59L235 48L235 103" fill="#303d36" stroke="#c7a06b" stroke-width="3"/><text x="155" y="211" fill="#f6d99f" font-size="15" font-weight="900">ТОПКА</text><circle data-po-clean-led="topka" cx="271" cy="88" r="8" fill="#ff5652" stroke="#ffe0b0" stroke-width="2"/></g>
        <g data-po-clean-tech="wenta" filter="url(#poPlantShadow)"><path d="M370 102Q415 81 460 102V176Q415 198 370 176Z" fill="#202c27" stroke="#8fc3b1" stroke-width="2"/><ellipse cx="415" cy="102" rx="45" ry="14" fill="#52665b" stroke="#b4cbbd" stroke-width="2"/><path d="M370 140Q415 160 460 140" fill="none" stroke="#8fc3b1" stroke-width="2"/><rect x="397" y="88" width="36" height="22" rx="7" fill="#ecf1e9" stroke="#5f8c7c"/><text x="415" y="103" text-anchor="middle" fill="#17362b" font-size="10" font-weight="900">W</text><text x="389" y="211" fill="#dcebdc" font-size="14" font-weight="900">WENTA</text><circle data-po-clean-led="wenta" cx="455" cy="116" r="7" fill="#ff5652" stroke="#ffe0b0" stroke-width="2"/></g>
        <g data-po-clean-tech="navien" filter="url(#poPlantShadow)"><path d="M565 83L655 97V179L565 164Z" fill="#d6dedb" stroke="#e2c68b" stroke-width="2"/><path d="M655 97L678 84V163L655 179Z" fill="#87938c" stroke="#d6b77c" stroke-width="2"/><rect x="584" y="106" width="54" height="41" rx="4" fill="#202d2a"/><rect x="594" y="115" width="34" height="20" rx="3" fill="#13211c" stroke="#8cbaa5"/><text x="611" y="129" text-anchor="middle" fill="#90e5b7" font-size="10" font-weight="900">°C</text><text x="580" y="201" fill="#e2e9dc" font-size="14" font-weight="900">NAVIEN</text><circle data-po-clean-led="navien" cx="666" cy="107" r="7" fill="#ff5652" stroke="#ffe0b0" stroke-width="2"/></g>
        <g data-po-clean-tech="watts" filter="url(#poPlantShadow)">
          <path d="M680 104L835 104L835 178L680 178Z" fill="#26352d" stroke="#9db5a2" stroke-width="2"/>
          <g fill="#f4f0df" stroke="#bda16f" stroke-width="3">
            <circle cx="713" cy="137" r="25"/><circle cx="758" cy="137" r="25"/><circle cx="803" cy="137" r="25"/>
          </g>
          <g stroke="#27352d" stroke-width="2.5" stroke-linecap="round"><path d="M713 137l-8-12M758 137l5-13M803 137l-4-14"/></g>
          <g fill="#27352d" font-size="8" font-weight="900" text-anchor="middle"><text x="713" y="165">bar</text><text x="758" y="165">°C</text><text x="803" y="165">bar</text></g>
          <text x="730" y="211" fill="#dcebdc" font-size="14" font-weight="900">WATTS</text>
          <circle data-po-clean-led="watts" cx="824" cy="91" r="7" fill="#ff5652" stroke="#ffe0b0" stroke-width="2"/>
        </g>
        <g data-po-clean-tech="steam" filter="url(#poPlantShadow)" transform="translate(125 0)"><path d="M750 126L805 136V194L750 184Z" fill="#563a22" stroke="#d8a55d" stroke-width="2"/><path d="M805 136L824 124V180L805 194Z" fill="#2e382e" stroke="#d8a55d" stroke-width="2"/><path d="M765 157Q756 143 768 135M781 160Q772 145 784 137M796 164Q787 149 799 141" fill="none" stroke="#ffca79" stroke-width="4" stroke-linecap="round"/><text x="750" y="217" fill="#e7d2a7" font-size="13" font-weight="900">ПАРОГЕН.</text><circle data-po-clean-led="steam" cx="815" cy="148" r="7" fill="#ff5652" stroke="#ffe0b0" stroke-width="2"/></g>
        <g fill="#a9c0b0" font-size="10" font-weight="700"><text x="70" y="28">ТЕХНИЧЕСКАЯ ЗОНА · СХЕМАТИЧНО</text><text x="70" y="43" fill="#788f80">статусы по чек-листу сотрудников, не телеметрия</text></g>
      </svg>
      <div class="po-clean-plant-modules">
        <article class="po-clean-plant-module"><img src="./assets/clean-control/topka-burner.jpg" alt="Горелка топки" loading="lazy"><div><b>Топка · контроль огня</b><small>Задачи clean-21 и clean-24</small><span id="poCleanTechTopka" class="po-clean-plant-status red">Ожидает проверки</span></div></article>
        <article class="po-clean-plant-module"><img src="./assets/clean-control/wenta-tank.jpg" alt="Бак WENTA" loading="lazy"><div><b>WENTA · горячая вода</b><small>Задача clean-22</small><span id="poCleanTechWenta" class="po-clean-plant-status red">Ожидает проверки</span></div></article>
        <article class="po-clean-plant-module"><img src="./assets/clean-control/navien-boiler.jpg" alt="Котёл NAVIEN" loading="lazy"><div><b>NAVIEN · котёл</b><small>Задача clean-23</small><span id="poCleanTechNavien" class="po-clean-plant-status red">Ожидает проверки</span></div></article>
        <article class="po-clean-plant-module"><img src="./assets/clean-control/pressure-gauges.jpg" alt="Манометры и термометры WATTS" loading="lazy"><div><b>WATTS · приборы</b><small>Показания в комментарии clean-23</small><span id="poCleanTechMeters" class="po-clean-plant-status red">Ожидает проверки</span></div></article>
        <article class="po-clean-plant-module"><div class="po-clean-plant-icon" aria-hidden="true">♨</div><div><b>Парогенератор</b><small>Задача clean-25</small><span id="poCleanTechSteam" class="po-clean-plant-status red">Ожидает проверки</span></div></article>
      </div>
      <div class="po-clean-plant-note">Схема — визуальное представление технического узла, не монтажный чертёж. Цвет показывает статус задач в текущей смене. Температура и давление не считываются автоматически.</div>`;
    const foot = $('.po-dt-map-foot', panel);
    if (foot) foot.insertAdjacentElement('afterend', deck);
    else $('.po-dt-map-column', panel)?.appendChild(deck);
    return deck;
  }
  function combinedTaskTone(ids, taskById, rows) {
    if (!ids.every(id => taskById.has(id))) return {tone:'red',label:'Задача не найдена'};
    const tones = ids.map(id => completionState(taskById.get(id), rows));
    if (tones.includes('red')) return {tone:'red',label:'Не проверено'};
    if (tones.includes('amber')) return {tone:'amber',label:'На проверке'};
    return {tone:'green',label:'Принято'};
  }
  function setTechStatus(deck, elementId, markerId, ids, taskById, rows, shiftOpen) {
    const el = $('#'+elementId, deck);
    const marker = $('[data-po-clean-led="'+markerId+'"]', deck);
    if (!el) return;
    if (!shiftOpen) { el.className='po-clean-plant-status closed'; el.textContent='Смена закрыта'; if (marker) marker.setAttribute('fill','#8b9a90'); return; }
    const state = combinedTaskTone(ids,taskById,rows);
    el.className='po-clean-plant-status '+state.tone; el.textContent=state.label;
    if (marker) marker.setAttribute('fill',state.tone==='green'?'#51e29b':state.tone==='amber'?'#ffc95f':'#ff5652');
  }
  function renderTechnicalDeck(panel, taskById, rows, shiftOpen) {
    const deck=ensureTechnicalDeck(panel);
    const tasks=taskById||new Map();
    setTechStatus(deck,'poCleanTechTopka','topka',['clean-21','clean-24'],tasks,rows||[],shiftOpen);
    setTechStatus(deck,'poCleanTechWenta','wenta',['clean-22'],tasks,rows||[],shiftOpen);
    setTechStatus(deck,'poCleanTechNavien','navien',['clean-23'],tasks,rows||[],shiftOpen);
    setTechStatus(deck,'poCleanTechMeters','watts',['clean-23'],tasks,rows||[],shiftOpen);
    setTechStatus(deck,'poCleanTechSteam','steam',['clean-25'],tasks,rows||[],shiftOpen);
  }

  function completionState(task, rows) {

    const list = rows.filter(c => String(c.taskId) === String(task.id))
      .sort((a,b) => Date.parse(b.completedAt||0) - Date.parse(a.completedAt||0));
    const latest = list[0];
    if (!latest || latest.status === 'rejected') return 'red';
    if (latest.status === 'pending_review') return 'amber';
    if (latest.status === 'approved') return 'green';
    return 'red';
  }
  function zoneState(taskStates) {
    if (!taskStates.length) return null;
    if (taskStates.includes('red')) return 'red';
    if (taskStates.includes('amber')) return 'amber';
    return 'green';
  }
  function renderMap() {
    const overlay = $('#poCeoOverlay');
    const map = $('#poDtMap', overlay || document);
    const panel = $('#poDtLivePanel', overlay || document);
    if (!map || !panel) return;
    const legend = ensureLegend(panel);
    ensureTechnicalDeck(panel);
    let layer = $('#poCleanControlZones', map);
    if (!layer) {
      layer = svg('g',{id:'poCleanControlZones','aria-label':'Статус CLEAN CONTROL по зонам'});
      const labels = $('#poDtMapV5Overlay', map);
      if (labels) map.insertBefore(layer, labels);
      else map.appendChild(layer);
    }
    layer.replaceChildren();

    if (!payload) {
      legend.innerHTML = '<b>CLEAN CONTROL PRO</b><span class="po-clean-legend-item">Загрузка статусов инженерной зоны…</span>';
      return;
    }
    if (!payload.shiftOpen) {
      legend.innerHTML = '<b>CLEAN CONTROL PRO</b><span class="po-clean-legend-item">Смена закрыта — статусы не оцениваются</span>';
      renderTechnicalDeck(panel,new Map((payload.tasks||[]).map(t=>[String(t.id),t])),[],false);
      return;
    }
    const taskById = new Map((payload.tasks||[]).map(t => [String(t.id),t]));
    const rows = Array.isArray(payload.completions) ? payload.completions : [];
    const states = new Map();
    for (const [taskId, zones] of Object.entries(TASK_ZONES)) {
      const task = taskById.get(taskId);
      if (!task) continue;
      const state = completionState(task, rows);
      zones.forEach(zone => {
        if (!states.has(zone)) states.set(zone,[]);
        states.get(zone).push({state,task});
      });
    }

    let redCount=0, amberCount=0, greenCount=0;
    for (const [zone,bounds] of Object.entries(BOUNDS)) {
      const entries = states.get(zone) || [];
      if (!entries.length) continue;
      const status = zoneState(entries.map(x=>x.state));
      if (status === 'red') redCount++;
      else if (status === 'amber') amberCount++;
      else if (status === 'green') greenCount++;
      const [x,y,w,h] = bounds;
      const rect = svg('rect',{x,y,width:w,height:h,rx:11,class:'po-clean-zone '+status,'data-po-clean-zone':zone});
      const names = entries.map(e=>e.task.title).join(' · ');
      rect.appendChild(svg('title',{},zone+': '+names));
      layer.appendChild(rect);
      const bx=x+w-18, by=y+19;
      layer.appendChild(svg('circle',{cx:bx,cy:by,r:15,class:'po-clean-zone-badge '+status}));
      layer.appendChild(svg('text',{x:bx,y:by+1,class:'po-clean-zone-mark'},status==='green'?'✓':status==='amber'?'…':'!'));
      layer.appendChild(svg('text',{x:x+w-31,y:y+42,class:'po-clean-zone-count'},String(entries.filter(e=>e.state==='green').length)+'/'+entries.length));
    }
    const totalZones = redCount + amberCount + greenCount;
    legend.innerHTML = `<b>CLEAN CONTROL PRO</b><span class="po-clean-legend-item"><i class="po-clean-legend-dot red"></i>Аткарыла элек: ${redCount} зона</span><span class="po-clean-legend-item"><i class="po-clean-legend-dot amber"></i>Текшерүүдө: ${amberCount}</span><span class="po-clean-legend-item"><i class="po-clean-legend-dot green"></i>Бекитилген: ${greenCount}</span><span class="po-clean-legend-item">Активдүү зона: ${totalZones}</span>`;
    renderTechnicalDeck(panel,taskById,rows,true);
  }
  async function refresh() {
    if (busy) return;
    const bearer = token();
    if (!bearer) return;
    busy = true;
    try {
      const [shiftData, taskData] = await Promise.all([
        getJson('/api/admin/control/shift', bearer),
        getJson('/api/admin/clean-control/tasks', bearer)
      ]);
      const shift = shiftData.shift || {};
      const shiftOpen = shift.isOpen === true || Number(shift.isOpen) === 1;
      let completions = [];
      if (shiftOpen && shift.openedAt) {
        const qs = '?day=' + encodeURIComponent(bishkekDay()) + '&shiftStartAt=' + encodeURIComponent(shift.openedAt);
        const completionData = await getJson('/api/admin/clean-control/completions' + qs, bearer);
        completions = completionData.completions || [];
      }
      payload = {shiftOpen,tasks:taskData.tasks||[],completions,shift};
      renderMap();
    } catch (error) {
      const legend = $('#poCleanControlLegend');
      if (legend) legend.textContent = 'CLEAN CONTROL PRO · Статус жүктөлгөн жок: ' + String(error.message||'API error');
    } finally { busy = false; }
  }
  function sync() {
    const overlay = $('#poCeoOverlay');
    const open = Boolean(overlay && overlay.classList.contains('po-ceo-open'));
    const map = $('#poDtMap', overlay || document);
    const panel = $('#poDtLivePanel', overlay || document);
    const mapReady = Boolean(map && panel);

    if (open && mapReady) {
      // IMPORTANT: renderMap() mutates the SVG and legend. The document-wide
      // MutationObserver calls sync() again for those mutations, so rendering
      // on every observer callback creates an infinite mutation/render loop.
      // Render only when the overlay opens, the SVG is replaced, or our layer
      // is missing. Normal refreshes render once after the API response.
      const needsRender = !active || activeMap !== map || !$('#poCleanControlZones', map);
      if (needsRender) {
        active = true;
        activeMap = map;
        renderMap();
      }
      if (!pollTimer) {
        refresh();
        pollTimer = window.setInterval(refresh, POLL_MS);
      }
      return;
    }

    if (active) {
      active = false;
      activeMap = null;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }
  }
  function scheduleSync() {
    if (syncQueued) return;
    syncQueued = true;
    window.requestAnimationFrame(() => {
      syncQueued = false;
      sync();
    });
  }
  function boot() {
    addStyles();
    observer = new MutationObserver(scheduleSync);
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-po-dt-layout-version']});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active)refresh()});
    window.addEventListener('pagehide',()=>{
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
      if (observer) observer.disconnect();
    },{once:true});
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
