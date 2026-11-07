/* PAR ORDO OWNER — CLEAN CONTROL overlay for the existing 3D floor map.
   Red pulse = not submitted/rejected; amber = pending manager review; green check = approved.
   Uses read-only Clean Control API endpoints and does not change guest tracking. */
(() => {
  'use strict';
  const API = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const TOKEN_KEY = 'parordo_admin_token';
  const POLL_MS = 15000;
  const NS = 'http://www.w3.org/2000/svg';
  const STYLE_ID = 'poCleanControlMapV1Style';

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
    'clean-20':['entry','shoe-storage'],
    'clean-21':['steam'],
    'clean-22':['wash-one','wash-two','showers','buckets'],
    'clean-23':['steam','wash-one','wash-two','showers'],
    'clean-24':['steam'],
    'clean-25':['steam']
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
  let watchTimer = null;
  let observer = null;

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
    let layer = $('#poCleanControlZones', map);
    if (!layer) {
      layer = svg('g',{id:'poCleanControlZones','aria-label':'Статус CLEAN CONTROL по зонам'});
      const labels = $('#poDtMapV5Overlay', map);
      if (labels) map.insertBefore(layer, labels);
      else map.appendChild(layer);
    }
    layer.replaceChildren();

    if (!payload || !payload.shiftOpen) {
      legend.innerHTML = '<b>CLEAN CONTROL PRO</b><span class="po-clean-legend-item">Смена закрыта — статусы не оцениваются</span>';
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
    const mapReady = Boolean($('#poDtMap', overlay || document));
    if (open && mapReady) {
      renderMap();
      if (!active) {
        active = true;
        refresh();
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = window.setInterval(refresh,POLL_MS);
      }
    } else if (!open && active) {
      active = false;
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }
  }
  function boot() {
    addStyles();
    observer = new MutationObserver(sync);
    observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-po-dt-layout-version']});
    watchTimer = window.setInterval(sync,1200);
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&active)refresh()});
    sync();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
