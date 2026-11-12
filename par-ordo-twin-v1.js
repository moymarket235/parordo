/* PAR ORDO PRO — TWIN V1 · «3D обзор комплекса» in CEO MODE
   A hologram of the complex built from the floor plan of PAR ORDO (entry, reception, shoe lockers,
   mirror, tea, changing room 1–36, shorts, wash rooms, toilet, showers, buckets, PAR) plus the
   firebox. Three modes:
   - «Гости»  — a lit locker is an active bracelet (the number on the bracelet is the locker).
   - «Уборка» — every zone shows its Clean Control state for the current shift:
                red = not done / rejected, amber = waiting for the manager, green = accepted.
   - «Топка»  — the firebox and the heat path: Топка, WENTA, NAVIEN, WATTS and the steam generator
                with their checklist states. These are staff checklist states, not sensors.

   Data (read only, the same endpoints the previous 3D map used):
   /api/admin/control/clients, /api/admin/control/shift, /api/admin/clean-control/tasks,
   /api/admin/clean-control/completions — refreshed every 15 s while CEO MODE is open.

   This file must load before par-ordo-ceo-v1.js: it sets window.PARORDOTwin, and the CEO loader
   then skips the previous 3D map modules. If anything fails while building, the previous map is
   loaded through window.PARORDOLoadLegacyTwin(). The plan is schematic, not a survey drawing. */
(() => {
  'use strict';
  if (window.PARORDOTwin) return;
  const TW = window.PARORDOTwin = { version: '1.0.0', active: true };

  const API = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const TOKEN_KEY = 'parordo_admin_token';
  const POLL_MS = 15000;
  const SEEN_KEY = 'po_tw_seen';
  const U = 0.3; // plan units → px
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const motion = !reduced && typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b > 1 && b < 5 ? few : b === 1 ? one : many; };
  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} }
  };
  const log = (where, e) => { try { console.warn('PAR ORDO twin · ' + where, e); } catch (_) {} };
  const EASE = { out: 'cubic-bezier(.16,1,.3,1)', drop: 'cubic-bezier(.2,.8,.3,1.12)' };

  /* ---------- the plan (units; x → east, y → south) ---------- */
  // key, title, label, x, y, w, d, height px, kind, note
  const ZONES = [
    ['smoking', 'Курилка', 'Курилка', 10, 20, 130, 150, 5, 'out', 'На улице, под навесом. Уборка по Clean Control сюда не входит.'],
    ['entry', 'Вход · шлёпки', 'Вход', 10, 215, 140, 205, 12, 'room', 'Входная зона, полки со шлёпками.'],
    ['reception', 'Ресепшн · напитки', 'Ресепшн', 160, 0, 250, 200, 26, 'room', 'Стойка, товары и 2 холодильника с напитками.'],
    ['shoe-storage', 'Обувные шкафы 1–28', 'Обувь', 410, 0, 220, 200, 30, 'room', 'Шкафы для обуви, 28 ячеек.'],
    ['toilet', 'Туалет', 'Туалет', 630, 0, 80, 110, 30, 'room', 'Одна дверь.'],
    ['wash-one', 'Первая моечная', 'Моечная 1', 630, 110, 80, 90, 22, 'wet', 'Первая моечная перед душевыми.'],
    ['wash-two', 'Моечная · тазики', 'Моечная', 710, 0, 220, 200, 24, 'wet', 'Раковины, тазики и вода.'],
    ['steam', 'Парная · PAR', 'Парная', 930, 0, 250, 420, 46, 'hot', 'PAR на 3 уровня. Пар — от парогенератора топки.'],
    ['mirror', 'Зеркало · 2 фена', 'Зеркало', 160, 200, 100, 220, 22, 'room', 'Зеркало и два фена.'],
    ['lounge', 'Чай · 2 места', 'Чай', 260, 200, 100, 220, 18, 'room', 'Чай и еда, ровно 2 места.'],
    ['lockers', 'Раздевалка 1–36', 'Раздевалка', 360, 200, 240, 220, 18, 'lockers', 'Шкафчики 1–36. Номер браслета — номер шкафчика.'],
    ['shorts', 'Шорты · штора', 'Шорты', 600, 200, 90, 220, 26, 'room', 'Шторка и корзина для использованных шорт.'],
    ['showers', 'Душевые · 2 кабины', 'Душевые', 690, 200, 120, 220, 30, 'wet', 'Две душевые кабины. Горячая вода — от WENTA.'],
    ['buckets', 'Обливные бочки · 2', 'Бочки', 810, 200, 120, 220, 30, 'wet', 'Два подвесных ведра с тягой.'],
    ['topka', 'Топка · котельная', 'Топка', 1185, 110, 125, 190, 34, 'fire', 'Топка, WENTA, NAVIEN, WATTS и парогенератор. Расположение на схеме условное.']
  ];
  const PLAN = { w: 1320, d: 430, slab: [155, 0, 1030, 425] };
  // where a zone's label stands on its roof, % of the box (x, y); default is the centre
  const ANCHOR = { lockers: [45, 22], showers: [50, 78], 'wash-two': [55, 22], steam: [55, 40], reception: [50, 40], entry: [50, 55], topka: [50, 55] };
  const CHIP_ORDER = ['entry', 'reception', 'shoe-storage', 'mirror', 'lounge', 'lockers', 'shorts', 'wash-one', 'toilet', 'wash-two', 'showers', 'buckets', 'steam', 'topka', 'smoking'];
  const GUEST_LABELS = new Set(['entry', 'reception', 'lockers', 'showers', 'steam', 'topka']);
  const FIRE_LABELS = new Set(['topka', 'steam', 'showers', 'wash-two']);
  const ALL_FLOOR = ['entry', 'reception', 'shoe-storage', 'mirror', 'lounge', 'lockers', 'shorts', 'wash-one', 'toilet', 'wash-two', 'showers', 'buckets', 'steam'];
  // the same task → zone map the Clean Control overlay of the previous map used
  const TASK_ZONES = {
    'clean-01': ['steam'], 'clean-02': ['showers'], 'clean-03': ['wash-one', 'wash-two'], 'clean-04': ['toilet'],
    'clean-05': ['lockers'], 'clean-06': ALL_FLOOR, 'clean-07': ['mirror'], 'clean-08': ['lounge'],
    'clean-09': ['entry', 'reception', 'toilet'], 'clean-10': ['shoe-storage'], 'clean-11': ['wash-one', 'wash-two'],
    'clean-12': ['shorts'], 'clean-13': ['entry', 'shoe-storage'], 'clean-14': ['reception'], 'clean-15': ['reception'],
    'clean-16': ALL_FLOOR, 'clean-17': ['steam'], 'clean-18': ['lounge'], 'clean-19': ['lounge'], 'clean-20': ['entry', 'shoe-storage']
  };
  const TECH = [
    { key: 'topka', title: 'Топка · контроль огня', ids: ['clean-21', 'clean-24'], img: './assets/clean-control/topka-burner.jpg' },
    { key: 'wenta', title: 'WENTA · горячая вода', ids: ['clean-22'], img: './assets/clean-control/wenta-tank.jpg' },
    { key: 'navien', title: 'NAVIEN · котёл', ids: ['clean-23'], img: './assets/clean-control/navien-boiler.jpg' },
    { key: 'watts', title: 'WATTS · приборы', ids: ['clean-23'], img: './assets/clean-control/pressure-gauges.jpg', sub: 'показания — в комментарии задачи' },
    { key: 'steam', title: 'Парогенератор', ids: ['clean-25'], img: '' }
  ];
  const ICON_REFRESH = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4.5V9h-4.5"/></svg>';
  const ST_LABEL = { red: 'не выполнено', amber: 'на проверке', green: 'принято', grey: 'смена закрыта', none: 'нет задач', na: 'нет данных' };

  /* ---------- state ---------- */
  const S = {
    overlay: null, panel: null, open: false, mode: 'guests', zone: 'lockers', bracelet: null,
    clients: null, clientsAt: 0, clientsErr: '', shift: null, tasks: null, completions: [], cleanErr: '', cleanAt: 0,
    poll: 0, busy: false, built: false, played: false, io: null, resizeT: 0
  };
  const groups = new Set();
  function A(el, kf, opt) {
    if (!motion || !el || typeof el.animate !== 'function') return null;
    try { const a = el.animate(kf, Object.assign({ fill: 'backwards' }, opt)); groups.add(a); const d = () => groups.delete(a); a.finished.then(d, d); return a; } catch (_) { return null; }
  }

  /* ---------- data ---------- */
  async function getJson(path) {
    const token = store.get(TOKEN_KEY) || '';
    if (!token) throw new Error('Сессия руководителя не найдена.');
    const res = await fetch(API + path, { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json', Authorization: 'Bearer ' + token } });
    let data = {};
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error((data && data.error) || ('API ' + res.status));
    return data;
  }
  const bishkekDay = () => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bishkek', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); } catch (_) { return new Date().toISOString().slice(0, 10); } };
  function braceletNumber(c) {
    const raw = String((c ? (c.room ?? c.braceletNo ?? c.bracelet) : '') ?? '').trim().replace(/^браслет\s*/i, '').replace(/^№\s*/, '');
    const v = Number(raw);
    return Number.isInteger(v) && v >= 1 && v <= 36 ? v : null;
  }
  function guestType(c) {
    const items = Array.isArray(c && c.items) ? c.items : [];
    const raw = [c.type, c.category, c.kind, c.clientType, c.ageType, c.entryType, c.tariff, c.isChild === true ? 'child' : '',
      ...items.flatMap(i => [i && i.name, i && i.title, i && i.category, i && i.type])].filter(Boolean).join(' ').toLocaleLowerCase('ru-RU');
    return /детск|реб[её]нок|child|minor/.test(raw) ? 'child' : 'adult';
  }
  function guests() {
    const map = new Map();
    for (const c of (Array.isArray(S.clients) ? S.clients : [])) {
      if (!c || c.status !== 'active') continue;
      const n = braceletNumber(c);
      if (n) map.set(n, c);
    }
    return map;
  }
  function ranges(nums) {
    const a = nums.slice().sort((x, y) => x - y), out = [];
    for (let i = 0; i < a.length; i++) {
      let j = i;
      while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
      out.push(j > i + 1 ? `${String(a[i]).padStart(2, '0')}–${String(a[j]).padStart(2, '0')}` : (j === i + 1 ? `${String(a[i]).padStart(2, '0')}, ${String(a[j]).padStart(2, '0')}` : String(a[i]).padStart(2, '0')));
      i = j;
    }
    return out.join(', ');
  }
  function completionState(taskId) {
    const list = (S.completions || []).filter(c => String(c.taskId) === String(taskId))
      .sort((a, b) => Date.parse(b.completedAt || 0) - Date.parse(a.completedAt || 0));
    const latest = list[0];
    if (!latest || latest.status === 'rejected') return 'red';
    if (latest.status === 'pending_review') return 'amber';
    if (latest.status === 'approved') return 'green';
    return 'red';
  }
  const shiftOpen = () => !!(S.shift && (S.shift.isOpen === true || Number(S.shift.isOpen) === 1));
  function combine(states) { if (!states.length) return 'none'; if (states.includes('red')) return 'red'; if (states.includes('amber')) return 'amber'; return 'green'; }
  function zoneClean() {
    const out = new Map();
    if (!S.tasks) return out;
    const byId = new Map(S.tasks.map(t => [String(t.id), t]));
    for (const [id, zones] of Object.entries(TASK_ZONES)) {
      const task = byId.get(id);
      if (!task) continue;
      const st = shiftOpen() ? completionState(id) : 'grey';
      zones.forEach(z => { if (!out.has(z)) out.set(z, []); out.get(z).push({ id, title: task.title || id, st }); });
    }
    return out;
  }
  function zoneState(entries) {
    if (!entries || !entries.length) return 'none';
    if (!shiftOpen()) return 'grey';
    return combine(entries.map(e => e.st));
  }
  function techState(ids) {
    if (!S.tasks) return S.cleanErr ? 'na' : 'none';
    if (!shiftOpen()) return 'grey';
    const byId = new Set(S.tasks.map(t => String(t.id)));
    if (!ids.every(id => byId.has(id))) return 'none';
    return combine(ids.map(completionState));
  }
  async function loadClients() {
    try { const d = await getJson('/api/admin/control/clients'); S.clients = Array.isArray(d.clients) ? d.clients : []; S.clientsAt = Date.now(); S.clientsErr = ''; }
    catch (e) { S.clientsErr = (e && e.message) || 'ошибка'; }
  }
  async function loadClean() {
    try {
      const [sh, tk] = await Promise.all([getJson('/api/admin/control/shift'), getJson('/api/admin/clean-control/tasks')]);
      S.shift = sh.shift || {};
      S.tasks = Array.isArray(tk.tasks) ? tk.tasks : [];
      S.completions = [];
      if (shiftOpen() && S.shift.openedAt) {
        const qs = '?day=' + encodeURIComponent(bishkekDay()) + '&shiftStartAt=' + encodeURIComponent(S.shift.openedAt);
        const c = await getJson('/api/admin/clean-control/completions' + qs);
        S.completions = Array.isArray(c.completions) ? c.completions : [];
      }
      S.cleanErr = ''; S.cleanAt = Date.now();
    } catch (e) { S.cleanErr = (e && e.message) || 'ошибка'; }
  }
  async function refresh(force) {
    if (S.busy || !S.open) return;
    S.busy = true;
    const btn = S.panel && $('.tw-refresh', S.panel);
    if (btn && force) btn.classList.add('busy');
    try { await Promise.all([loadClients(), loadClean()]); }
    finally {
      S.busy = false;
      if (btn) btn.classList.remove('busy');
      if (S.open && S.panel) paint();
    }
  }

  /* ---------- building ---------- */
  function zoneHtml(z, i) {
    const [key, , label, x, y, w, d, h, kind] = z;
    const X = Math.round(x * U), Y = Math.round(y * U), W = Math.round(w * U), D = Math.round(d * U);
    let top = '', extra = '';
    if (kind === 'lockers') top = `<div class="lk">${Array.from({ length: 36 }, (_, k) => `<i data-n="${k + 1}"></i>`).join('')}</div>`;
    else if (kind === 'wet') top = '<div class="wet"></div>';
    else if (kind === 'hot') { top = '<div class="tiers"></div>'; extra = [22, 50, 78].map((l, k) => `<i class="stm" style="left:${l}%;top:${35 + k * 15}%;animation-delay:${(k * .9).toFixed(1)}s"></i>`).join(''); }
    else if (kind === 'fire') { top = '<div class="coal"></div>'; extra = [34, 52, 68].map((l, k) => `<i class="flm" style="left:${l}%;top:${48 + (k % 2) * 8}%;animation-delay:${(k * .23).toFixed(2)}s"></i>`).join('') + [0, 1].map(k => `<i class="smk" style="left:72%;top:20%;--h:${h + 18}px;animation-delay:${(k * 1.6).toFixed(1)}s"></i>`).join(''); }
    return `<div class="bx k-${kind}" data-z="${key}" data-i="${i}" style="left:${X}px;top:${Y}px;width:${W}px;height:${D}px;--h:${h}px">` +
      `<div class="fT">${top}</div><div class="fS"></div><div class="fE"></div>${extra}` +
      `<span class="lb" data-lb="${key}"${ANCHOR[key] ? ` style="left:${ANCHOR[key][0]}%;top:${ANCHOR[key][1]}%"` : ''}><b>${esc(label)}</b><em></em></span><span class="bd" data-bd="${key}"></span></div>`;
  }
  function pipesSvg() {
    const W = Math.round(PLAN.w * U), D = Math.round(PLAN.d * U);
    const p = (pts) => 'M' + pts.map(([x, y]) => `${Math.round(x * U)} ${Math.round(y * U)}`).join(' L');
    // schematic: firebox → PAR (steam generator), firebox → WENTA → showers and wash rooms
    const hot = p([[1200, 205], [1060, 205]]);
    const warm1 = p([[1240, 110], [1240, 8], [790, 8], [790, 120]]);
    const warm2 = p([[790, 120], [790, 214], [750, 214], [750, 300]]);
    const warm3 = p([[790, 120], [670, 120], [670, 150]]);
    return `<svg class="pipes" width="${W}" height="${D}" viewBox="0 0 ${W} ${D}" aria-hidden="true"><path class="hot" d="${hot}"/><path class="warm" d="${warm1}"/><path class="warm" d="${warm2}"/><path class="warm" d="${warm3}"/></svg>`;
  }
  function build(overlay) {
    const kpis = $('#poCeoKpis', overlay);
    if (!kpis) return false;
    const panel = document.createElement('section');
    panel.id = 'poTwin';
    panel.setAttribute('aria-label', '3D обзор комплекса');
    const W = Math.round(PLAN.w * U), D = Math.round(PLAN.d * U);
    const [sx, sy, sw, sd] = PLAN.slab;
    panel.innerHTML = `
      <div class="tw-head">
        <div><div class="tw-kick"><i></i>CEO MODE · DIGITAL TWIN</div><h2>3D обзор комплекса</h2></div>
        <button type="button" class="tw-refresh">${ICON_REFRESH}<span>Обновить</span></button>
      </div>
      <div class="tw-modes" role="tablist" aria-label="Режим карты">
        <button type="button" role="tab" class="tw-mode g" data-mode="guests" aria-selected="true"><i></i>Гости</button>
        <button type="button" role="tab" class="tw-mode c" data-mode="clean" aria-selected="false"><i></i>Уборка</button>
        <button type="button" role="tab" class="tw-mode f" data-mode="fire" aria-selected="false"><i></i>Топка</button>
      </div>
      <div class="tw-body">
        <div class="tw-card m-guests" data-tw="card">
          <span class="tw-hud l" data-tw="hudl"><i></i>LIVE</span><span class="tw-hud r" data-tw="hudr">…</span>
          <div class="tw-stage"><div class="tw-flr" style="width:${W}px;height:${D}px;margin:-${Math.round(D / 2)}px 0 0 -${Math.round(W / 2)}px">
            <div class="tw-ground"></div>
            <div class="tw-slab" style="left:${Math.round(sx * U)}px;top:${Math.round(sy * U)}px;width:${Math.round(sw * U)}px;height:${Math.round(sd * U)}px"></div>
            ${pipesSvg()}
            ${ZONES.map(zoneHtml).join('')}
            <div class="tw-scan"></div>
          </div></div>
          <div class="tw-legend" data-tw="legend"></div>
        </div>
        <div class="tw-side">
          <div class="tw-chips" data-tw="chips" aria-label="Зоны комплекса"></div>
          <div class="tw-info" data-tw="info" aria-live="polite"></div>
          <div class="tw-kpis" data-tw="kpis"></div>
          <p class="tw-note" data-tw="note"></p>
        </div>
      </div>`;
    kpis.insertAdjacentElement('afterend', panel);
    S.panel = panel;
    // events
    $('.tw-refresh', panel).addEventListener('click', () => refresh(true));
    $$('.tw-mode', panel).forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    $('.tw-stage', panel).addEventListener('click', e => {
      const locker = e.target.closest('.lk i[data-n]');
      if (locker && S.mode === 'guests' && guests().has(Number(locker.dataset.n))) { S.zone = 'lockers'; S.bracelet = Number(locker.dataset.n); paint(); return; }
      const bx = e.target.closest('.bx');
      if (bx) { S.zone = bx.dataset.z; S.bracelet = null; paint(); }
    });
    $('[data-tw=chips]', panel).addEventListener('click', e => {
      const c = e.target.closest('[data-zone]');
      if (c) { S.zone = c.dataset.zone; S.bracelet = null; paint(); }
    });
    $('[data-tw=info]', panel).addEventListener('click', e => {
      const b = e.target.closest('[data-br]');
      if (b) { const n = Number(b.dataset.br); S.bracelet = S.bracelet === n ? null : n; paint(); }
    });
    S.built = true;
    document.documentElement.classList.add('po-tw-on');
    fit();
    return true;
  }

  /* fit the model into the card: measure the projected tops, then scale and centre */
  function fit() {
    const panel = S.panel;
    if (!panel) return;
    const card = $('[data-tw=card]', panel), flr = $('.tw-flr', panel);
    if (!card || !flr || !card.offsetWidth) return;
    flr.style.setProperty('--fit', '1');
    flr.style.setProperty('--tx', '0px');
    flr.style.setProperty('--ty', '0px');
    const measure = () => {
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      $$('.fT, .tw-ground', flr).forEach(el => { const q = el.getBoundingClientRect(); if (!q.width) return; l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); });
      return { l, t, r, b };
    };
    const m = measure();
    if (!Number.isFinite(m.l)) return;
    const padX = 14, padTop = 52, padBottom = 38;
    const desk = matchMedia('(min-width: 900px)').matches;
    const maxH = desk ? 520 : 420, minH = desk ? 380 : 270;
    const kW = (card.clientWidth - padX * 2) / (m.r - m.l);
    // the card takes the model's height: no empty band above or below the plan
    const need = Math.round((m.b - m.t) * Math.min(kW, 2.2) + padTop + padBottom);
    card.style.height = Math.max(minH, Math.min(maxH, need)) + 'px';
    const c = card.getBoundingClientRect();
    const k = Math.min(kW, (c.height - padTop - padBottom) / (m.b - m.t), 2.2);
    flr.style.setProperty('--fit', k.toFixed(4));
    const m2 = measure();
    const cx = c.left + c.width / 2, cy = c.top + padTop + (c.height - padTop - padBottom) / 2;
    flr.style.setProperty('--tx', (cx - (m2.l + m2.r) / 2).toFixed(1) + 'px');
    flr.style.setProperty('--ty', (cy - (m2.t + m2.b) / 2).toFixed(1) + 'px');
  }

  /* ---------- painting ---------- */
  function setMode(mode) {
    if (!['guests', 'clean', 'fire'].includes(mode) || mode === S.mode) return;
    S.mode = mode;
    S.bracelet = null;
    if (mode === 'fire') S.zone = 'topka';
    else if (mode === 'clean') {
      const zc = zoneClean();
      const red = ALL_FLOOR.find(z => zoneState(zc.get(z)) === 'red');
      S.zone = red || ALL_FLOOR.find(z => zoneState(zc.get(z)) === 'amber') || 'lockers';
    } else S.zone = 'lockers';
    paint(true);
  }
  function chip(z, dot, on) {
    return `<button type="button" class="tw-chip" data-zone="${z[0]}" aria-pressed="${on}">${dot ? `<i class="${dot}"></i>` : ''}${esc(z[1])}</button>`;
  }
  function paint(modeChanged) {
    const panel = S.panel;
    if (!panel) return;
    try {
      const card = $('[data-tw=card]', panel);
      card.classList.remove('m-guests', 'm-clean', 'm-fire');
      card.classList.add('m-' + S.mode);
      $$('.tw-mode', panel).forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === S.mode)));
      const g = guests();
      const zc = zoneClean();
      // boxes: selection, clean states, labels, badges
      ZONES.forEach(z => {
        const key = z[0];
        const bx = $(`.bx[data-z="${key}"]`, panel);
        if (!bx) return;
        bx.classList.toggle('sel', key === S.zone);
        const st = key === 'topka' ? techState(['clean-21', 'clean-24']) : zoneState(zc.get(key));
        bx.classList.remove('s-red', 's-amber', 's-green', 's-grey');
        if (S.mode === 'clean' && st !== 'none' && st !== 'na') bx.classList.add('s-' + st);
        const lb = $('.lb', bx), em = $('.lb em', bx), bd = $('.bd', bx);
        let show = false, extra = '';
        if (S.mode === 'guests') { show = GUEST_LABELS.has(key); if (key === 'lockers') extra = S.clients ? `${g.size}/36` : '—/36'; }
        else if (S.mode === 'fire') { show = FIRE_LABELS.has(key); if (key === 'topka') extra = ST_LABEL[techState(['clean-21', 'clean-24'])] || ''; if (key === 'steam') extra = ''; }
        else { show = false; }
        lb.classList.toggle('show', show);
        em.textContent = key === S.zone && S.mode === 'clean' && st !== 'none' && st !== 'na' ? ST_LABEL[st] : extra;
        let badge = '';
        if (S.mode === 'clean' && st !== 'none' && st !== 'na') badge = st;
        if (S.mode === 'fire' && (key === 'topka' || key === 'steam' || key === 'showers')) badge = key === 'topka' ? techState(['clean-21', 'clean-24']) : key === 'steam' ? techState(['clean-25']) : techState(['clean-22']);
        if (badge === 'none' || badge === 'na') badge = '';
        bd.className = 'bd' + (badge ? ' ' + badge : '');
        bd.textContent = badge === 'green' ? '✓' : badge === 'amber' ? '…' : badge === 'red' ? '!' : badge === 'grey' ? '–' : '';
      });
      // lockers
      $$('.lk i[data-n]', panel).forEach(i => {
        const n = Number(i.dataset.n), on = g.has(n);
        i.classList.toggle('on', on);
        i.classList.toggle('pick', on && S.bracelet === n);
        const has = !!$('.bm', i);
        if (on && !has) i.insertAdjacentHTML('beforeend', '<b class="bm"></b>');
        if (!on && has) $('.bm', i).remove();
      });
      // HUD and legend
      const hudl = $('[data-tw=hudl]', panel), hudr = $('[data-tw=hudr]', panel), legend = $('[data-tw=legend]', panel);
      if (S.mode === 'guests') {
        hudl.innerHTML = S.clients ? `<i></i>LIVE · ${g.size} ${plural(g.size, 'гость', 'гостя', 'гостей')}` : `<i></i>LIVE · ${S.clientsErr ? 'нет связи' : '…'}`;
        hudr.textContent = !S.clients ? (S.clientsErr ? 'нет данных' : '…') : (g.size ? '№' + ranges([...g.keys()]) : 'все свободны');
        legend.innerHTML = '<span><i style="background:#35f08a;box-shadow:0 0 6px #35f08a"></i>занят браслет</span><span><i style="background:rgba(122,240,167,.25)"></i>свободен</span>';
      } else if (S.mode === 'clean') {
        hudl.innerHTML = '<i></i>CLEAN CONTROL';
        hudr.textContent = S.tasks ? (shiftOpen() ? 'смена открыта' : 'смена закрыта') : '…';
        legend.innerHTML = '<span><i style="background:#ff4c4c"></i>не выполнено</span><span><i style="background:#ffc95f"></i>на проверке</span><span><i style="background:#4fe39a"></i>принято</span>';
      } else {
        const t = techState(['clean-21', 'clean-24']);
        hudl.innerHTML = '<i></i>ТОПКА · КОТЕЛЬНАЯ';
        hudr.textContent = 'топка: ' + (ST_LABEL[t] || '…');
        legend.innerHTML = '<span><i style="background:#ff8a52"></i>пар в PAR</span><span><i style="background:#ffcf6a"></i>горячая вода</span>';
      }
      // chips
      const chips = $('[data-tw=chips]', panel);
      chips.innerHTML = CHIP_ORDER.map(k => ZONES.find(z => z[0] === k)).filter(Boolean).map(z => {
        let dot = '';
        if (S.mode === 'clean') { const st = z[0] === 'topka' ? techState(['clean-21', 'clean-24']) : zoneState(zc.get(z[0])); dot = st === 'none' || st === 'na' ? '' : st; }
        else if (S.mode === 'guests' && z[0] === 'lockers' && g.size) dot = 'live';
        else if (S.mode === 'fire' && z[0] === 'topka') { const st = techState(['clean-21', 'clean-24']); dot = st === 'none' || st === 'na' ? '' : st; }
        return chip(z, dot, z[0] === S.zone);
      }).join('');
      const on = $('[aria-pressed="true"]', chips);
      if (on) {
        const left = Math.max(0, on.offsetLeft - (chips.clientWidth - on.offsetWidth) / 2);
        try { chips.scrollTo({ left, behavior: modeChanged && motion ? 'smooth' : 'auto' }); } catch (_) { chips.scrollLeft = left; }
      }
      // info + figures
      $('[data-tw=info]', panel).innerHTML = infoHtml(g, zc);
      $('[data-tw=kpis]', panel).innerHTML = kpiHtml(g, zc);
      $('[data-tw=kpis]', panel).hidden = S.mode === 'fire';
      const errs = [S.clientsErr && S.mode === 'guests' ? 'браслеты: ' + S.clientsErr : '', S.cleanErr && S.mode !== 'guests' ? 'Clean Control: ' + S.cleanErr : ''].filter(Boolean);
      $('[data-tw=note]', panel).innerHTML = (errs.length ? `<span class="tw-err">Не удалось обновить — ${esc(errs.join(' · '))}</span><br>` : '') +
        (S.mode === 'guests' ? 'Схема зон условная. Номер браслета — номер шкафчика; где гость внутри, система не знает.'
          : S.mode === 'clean' ? 'Статусы — по чек-листу Clean Control текущей смены. Подсветка гаснет, когда руководитель принимает задачу.'
            : 'Схема тепла условная. Статусы — по чек-листу сотрудников, а не датчики: температура и давление не считываются.');
      if (modeChanged && motion) {
        A($('[data-tw=info]', panel), [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: EASE.out });
        A($('[data-tw=kpis]', panel), [{ opacity: 0 }, { opacity: 1 }], { duration: 320 });
      }
    } catch (e) { log('paint', e); }
  }
  function infoHtml(g, zc) {
    const z = ZONES.find(x => x[0] === S.zone) || ZONES[10];
    const [key, title, , , , , , , , note] = z;
    if (S.mode === 'guests') {
      if (key === 'lockers') {
        const nums = [...g.keys()].sort((a, b) => a - b);
        let det = '';
        if (S.bracelet && g.has(S.bracelet)) {
          const c = g.get(S.bracelet);
          const since = c.startedAt ? new Date(c.startedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '—';
          const items = (Array.isArray(c.items) ? c.items : []).filter(i => i && !/^вход/i.test(String(i.name || '')));
          const buys = items.length ? items.map(i => `${esc(i.name || 'Товар')} ×${Number(i.qty || 1)}`).join(' · ') : 'покупок пока нет';
          det = `<div class="tw-brd"><b>Браслет №${String(S.bracelet).padStart(2, '0')}</b> · ${guestType(c) === 'child' ? 'детский' : 'взрослый'} · пришёл в ${esc(since)}<br>${buys}</div>`;
        }
        const list = nums.length
          ? `<div class="tw-bracelets">${nums.map(n => `<button type="button" class="tw-br${guestType(g.get(n)) === 'child' ? ' child' : ''}" data-br="${n}" aria-pressed="${S.bracelet === n}">${String(n).padStart(2, '0')}</button>`).join('')}</div>${det}`
          : '<p>Сейчас все шкафчики свободны.</p>';
        if (!S.clients) return `<span class="k">Зона</span><h3>${esc(title)}</h3><p>${S.clientsErr ? 'Браслеты не загрузились. Нажмите «Обновить».' : 'Загрузка браслетов…'}</p>`;
        return `<span class="k">Зона</span><h3>${esc(title)}</h3><span class="big g">${g.size} ${plural(g.size, 'гость', 'гостя', 'гостей')} сейчас</span><p>Занято ${g.size} из 36 · свободно ${36 - g.size}.${g.size ? ' Нажмите номер — покажу браслет.' : ''}</p>${list}`;
      }
      return `<span class="k">Зона</span><h3>${esc(title)}</h3><p>${esc(note)}</p>`;
    }
    if (S.mode === 'clean') {
      if (!S.tasks) return `<span class="k">Clean Control</span><h3>${esc(title)}</h3><p>${S.cleanErr ? 'Статусы не загрузились.' : 'Загрузка статусов…'}</p>`;
      if (!shiftOpen()) return `<span class="k">Clean Control</span><h3>${esc(title)}</h3><span class="big">Смена закрыта</span><p>Статусы уборки оцениваются только в открытой смене.</p>`;
      if (key === 'topka') return techCardsHtml('Топка и котельная');
      const entries = zc.get(key) || [];
      if (!entries.length) return `<span class="k">Clean Control</span><h3>${esc(title)}</h3><p>${esc(note)}</p>`;
      const st = zoneState(entries);
      const cls = st === 'red' ? 'r' : st === 'amber' ? 'a' : 'g';
      const done = entries.filter(e => e.st === 'green').length;
      return `<span class="k">Clean Control · зона</span><h3>${esc(title)}</h3><span class="big ${cls}">${done} из ${entries.length} принято</span>
        <div class="tw-tasks">${entries.map(e => `<div class="tw-task"><span>${esc(e.title)}</span><span class="tw-st ${e.st}">${ST_LABEL[e.st]}</span></div>`).join('')}</div>`;
    }
    // fire
    if (key === 'topka' || key === 'steam') return techCardsHtml(key === 'steam' ? 'Парная и парогенератор' : 'Топка и тепловой контур');
    return `<span class="k">Тепло</span><h3>${esc(title)}</h3><p>${esc(note)}</p>${techCardsHtml('', true)}`;
  }
  function techCardsHtml(title, compact) {
    const cards = TECH.map(t => {
      const st = techState(t.ids);
      const label = st === 'none' ? (S.tasks ? 'задача не найдена' : 'загрузка…') : ST_LABEL[st];
      const cls = st === 'none' || st === 'na' ? 'grey' : st;
      const pic = t.img ? `<img src="${t.img}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph',textContent:'♨'}))">` : '<span class="ph" aria-hidden="true">♨</span>';
      return `<div class="tw-tc">${pic}<span><b>${esc(t.title)}</b><small>${esc(t.sub || ('задачи ' + t.ids.join(', ')))}</small></span><span class="tw-st ${cls}">${esc(label)}</span></div>`;
    }).join('');
    return `${title ? `<span class="k">Инженерия · по чек-листу</span><h3>${esc(title)}</h3>` : ''}${compact ? '' : `<p>${shiftOpen() ? 'Проверки текущей смены.' : (S.tasks ? 'Смена закрыта — проверки не оцениваются.' : '')}</p>`}<div class="tw-tech">${cards}</div>`;
  }
  function kpiHtml(g, zc) {
    if (S.mode === 'guests') {
      let child = 0;
      g.forEach(c => { if (guestType(c) === 'child') child++; });
      return `<div class="tw-kpi"><small>В бане</small><b>${S.clients ? g.size : '—'}</b></div><div class="tw-kpi w"><small>Шкафчики</small><b>${S.clients ? g.size + '/36' : '—'}</b></div><div class="tw-kpi a"><small>Взр · дет</small><b>${S.clients ? `${g.size - child} · ${child}` : '—'}</b></div>`;
    }
    let red = 0, amber = 0, green = 0;
    ALL_FLOOR.forEach(z => { const st = zoneState(zc.get(z)); if (st === 'red') red++; else if (st === 'amber') amber++; else if (st === 'green') green++; });
    const ok = S.tasks && shiftOpen();
    return `<div class="tw-kpi r"><small>Не выполнено</small><b>${ok ? red : '—'}</b></div><div class="tw-kpi a"><small>На проверке</small><b>${ok ? amber : '—'}</b></div><div class="tw-kpi"><small>Принято</small><b>${ok ? green : '—'}</b></div>`;
  }

  /* ---------- the opening: the plan is scanned and the rooms drop in ---------- */
  function play(full) {
    const panel = S.panel;
    if (!panel || !motion) return;
    const boxes = $$('.bx', panel).sort((a, b) => Number(a.style.left.replace('px', '')) - Number(b.style.left.replace('px', '')));
    const scan = $('.tw-scan', panel);
    if (!full) {
      A($('[data-tw=card]', panel), [{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
      return;
    }
    A($('.tw-ground', panel), [{ opacity: 0 }, { opacity: 1 }], { duration: 500 });
    A($('.tw-slab', panel), [{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 200 });
    boxes.forEach((b, i) => A(b, [{ opacity: 0, transform: 'translateZ(260px)' }, { opacity: 1, transform: 'translateZ(-4px)', offset: .72 }, { opacity: 1, transform: 'none' }], { duration: 760, delay: 350 + i * 85, easing: EASE.drop }));
    const last = 350 + boxes.length * 85 + 700;
    A(scan, [{ opacity: 0, transform: 'translateZ(0)' }, { opacity: 1, offset: .2 }, { opacity: 0, transform: 'translateZ(64px)' }], { duration: 1300, delay: last - 200, easing: 'ease-in-out', fill: 'none' });
    $$('.lb.show, .bd', panel).forEach((l, i) => A(l, [{ opacity: 0 }, { opacity: 1 }], { duration: 400, delay: last + 150 + i * 60 }));
    $$('.lk i.on', panel).forEach((l, i) => A(l, [{ transform: 'translateZ(14px) scale(.4)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 420, delay: last + i * 70, easing: EASE.drop }));
    ['.tw-chips', '.tw-info', '.tw-kpis'].forEach((s, i) => A($(s, panel), [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 300 + i * 90, easing: EASE.out }));
    setTimeout(() => { if (scan) scan.classList.add('loop'); }, last + 1400);
  }
  function arm() {
    const panel = S.panel;
    if (!panel) return;
    const full = !store.get(SEEN_KEY);
    if (!full || !('IntersectionObserver' in window)) { if (full) store.set(SEEN_KEY, '1'); play(full); if (!full) $('.tw-scan', panel).classList.add('loop'); return; }
    // hide the rooms until the card scrolls into view, then drop them in
    const card = $('[data-tw=card]', panel);
    if (motion) card.style.visibility = 'hidden';
    if (S.io) S.io.disconnect();
    S.io = new IntersectionObserver(entries => {
      if (!entries.some(e => e.isIntersecting)) return;
      S.io.disconnect(); S.io = null;
      store.set(SEEN_KEY, '1');
      card.style.visibility = '';
      fit();
      play(true);
    }, { root: S.overlay, threshold: 0.3 });
    S.io.observe(card);
  }

  /* ---------- open / close with CEO MODE ---------- */
  function onOpen() {
    S.open = true;
    try {
      if (!S.panel || !S.panel.isConnected) {
        S.panel = null; S.built = false;
        if (!build(S.overlay)) return;
      }
      paint();
      requestAnimationFrame(() => { fit(); arm(); });
    } catch (e) {
      log('build', e);
      fallback();
      return;
    }
    refresh(false);
    clearInterval(S.poll);
    S.poll = setInterval(() => { if (S.open && !document.hidden) refresh(false); }, POLL_MS);
  }
  function onClose() {
    S.open = false;
    clearInterval(S.poll);
    S.poll = 0;
    if (S.io) { S.io.disconnect(); S.io = null; }
    groups.forEach(a => { try { a.cancel(); } catch (_) {} });
    groups.clear();
  }
  function fallback() {
    TW.active = false;
    document.documentElement.classList.remove('po-tw-on');
    if (S.panel) { try { S.panel.remove(); } catch (_) {} S.panel = null; }
    if (typeof window.PARORDOLoadLegacyTwin === 'function') { try { window.PARORDOLoadLegacyTwin(); } catch (e) { log('legacy', e); } }
  }
  function sync() {
    if (!TW.active) return;
    const ov = document.getElementById('poCeoOverlay');
    if (ov && ov !== S.overlay) {
      S.overlay = ov;
      S.panel = null;
      new MutationObserver(sync).observe(ov, { attributes: true, attributeFilter: ['class'] });
    }
    const open = !!(S.overlay && S.overlay.classList.contains('po-ceo-open'));
    if (open && !S.open) onOpen();
    else if (!open && S.open) onClose();
  }
  function boot() {
    const mo = new MutationObserver(() => { if (!S.overlay || !S.overlay.isConnected) sync(); });
    mo.observe(document.body, { childList: true });
    sync();
    addEventListener('resize', () => { clearTimeout(S.resizeT); S.resizeT = setTimeout(() => { if (S.open) fit(); }, 160); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && S.open) refresh(false); });
    // the CEO refresh button refreshes the twin too
    document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#poCeoRefresh')) setTimeout(() => refresh(true), 200); });
  }
  TW.refresh = () => refresh(true);
  TW.mode = m => setMode(m);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
