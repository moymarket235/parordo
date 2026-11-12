
/* PAR ORDO CEO MODE v1.0
   Uses only existing manager API routes. Read-only dashboard; no write operations. */
(() => {
  'use strict';
  const API = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const TOKEN_KEY = 'parordo_admin_token';
  const ROLE_KEY = 'parordo_admin_role';
  const $ = (s, root = document) => root.querySelector(s);
  let overlay = null, timer = null, selectedBracelet = null, deferredInstall = null;
  let cache = { clients: [], reports: [], products: [] };
  const money = v => Number(v || 0).toLocaleString('ru-RU') + ' сом';
  const count = v => Number(v || 0).toLocaleString('ru-RU');
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const monthKey = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); };
  const dateKey = value => String(value || '').slice(0,10);
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  async function api(path) {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) throw new Error('Сессия руководителя не найдена. Войдите в панель заново.');
    const response = await fetch(API + path, { headers: { Accept:'application/json', Authorization:'Bearer '+token }, cache:'no-store' });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.error || ('API ' + response.status));
    return data;
  }

  function createOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('section');
    overlay.id = 'poCeoOverlay';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','PAR ORDO CEO Mode');
    overlay.innerHTML = `
      <div class="po-ceo-shell">
        <header class="po-ceo-top">
          <div class="po-ceo-brand"><b>PAR ORDO · OWNER INTELLIGENCE</b><small>CEO MODE / LIVE MANAGEMENT</small></div>
          <span class="po-ceo-live" id="poCeoLive">● LIVE VIEW</span>
          <button class="po-ceo-iconbtn" type="button" id="poCeoFullscreen" aria-label="Полный экран">⛶</button>
          <button class="po-ceo-iconbtn" type="button" id="poCeoClose" aria-label="Закрыть">×</button>
        </header>
        <section class="po-ceo-hero">
          <div class="po-ceo-hero-row"><div><div class="po-ceo-eyebrow">PAR ORDO · EXECUTIVE CONTROL</div><h1>Всё под контролем.</h1><p>Живая карта 36 браслетов, показатели закрытых смен, прогноз выручки и мобильный доступ владельца — в одном премиальном экране.</p></div>
          <button class="po-ceo-refresh" type="button" id="poCeoRefresh">↻ ОБНОВИТЬ ДАННЫЕ</button></div>
        </section>
        <div class="po-ceo-kpis" id="poCeoKpis">
          <div class="po-ceo-kpi"><small>Сейчас в бане</small><strong>Загрузка…</strong></div>
          <div class="po-ceo-kpi green"><small>Выручка последней смены</small><strong>Загрузка…</strong></div>
          <div class="po-ceo-kpi blue"><small>Выручка месяца</small><strong>Загрузка…</strong></div>
          <div class="po-ceo-kpi"><small>Средний чек месяца</small><strong>Загрузка…</strong></div>
        </div>
        <div class="po-ceo-columns">
          <section class="po-ceo-card">
            <div class="po-ceo-cardhead"><div><div class="po-ceo-eyebrow">DIGITAL TWIN · PHASE 1</div><h2>Карта браслетов</h2><p>Оперативная схема занятости по текущим данным системы.</p></div><span class="po-ceo-chip" id="poCeoOccupancy">— / 36</span></div>
            <div class="po-ceo-twin-grid" id="poCeoTwinGrid"><div class="po-ceo-error">Загрузка карты…</div></div>
            <div class="po-ceo-legend"><span><i class="po-ceo-dot"></i>Свободен</span><span><i class="po-ceo-dot active"></i>Активен</span></div>
            <div class="po-ceo-room-detail" id="poCeoBraceletDetail">Выберите браслет, чтобы увидеть его состояние.</div>
            <div class="po-ceo-note">Важно: текущая система содержит 36 браслетов, а не план помещений. Это первый цифровой двойник загрузки браслетов. Для полноценной 3D-модели здания понадобится утверждённый план помещений и привязка номеров.</div>
          </section>
          <section class="po-ceo-card">
            <div class="po-ceo-cardhead"><div><div class="po-ceo-eyebrow">PROFIT FORECAST</div><h2>Прогноз дохода</h2><p>Расчёт по сохранённым отчётам закрытых смен.</p></div><input class="po-ceo-month" id="poCeoMonth" type="month" aria-label="Месяц отчёта"></div>
            <div id="poCeoForecast"><div class="po-ceo-error">Загрузка отчётов…</div></div>
            <div class="po-ceo-note" id="poCeoProfitNote"></div>
            <div class="po-ceo-note">Прогноз выручки — ориентир по имеющимся закрытым сменам, не гарантия будущих поступлений. Чистую прибыль нельзя корректно показать без подтверждённых расходов и себестоимости.</div>
          </section>
          <section class="po-ceo-card">
            <div class="po-ceo-cardhead"><div><div class="po-ceo-eyebrow">OWNER MOBILE APP</div><h2>Приложение владельца</h2><p>Добавьте панель руководителя на главный экран телефона.</p></div><span class="po-ceo-chip">PWA</span></div>
            <div class="po-ceo-owner"><div class="po-ceo-owner-icon">📲</div><div><b>PAR ORDO OWNER</b><p>Отдельный ярлык на телефоне. Доступ остаётся защищённым входом руководителя.</p></div></div>
            <button class="po-ceo-install" id="poCeoInstall" type="button">＋ УСТАНОВИТЬ НА ТЕЛЕФОН</button>
            <div class="po-ceo-status" id="poCeoInstallStatus"></div>
          </section>
          <section class="po-ceo-card">
            <div class="po-ceo-cardhead"><div><div class="po-ceo-eyebrow">BUSINESS SIGNALS</div><h2>Сигналы бизнеса</h2><p>Клиенты и склад — только по доступным данным.</p></div></div>
            <div id="poCeoSignals"><div class="po-ceo-note">Загрузка аналитики…</div></div>
          </section>
        </div>
        <div class="po-ceo-footer">PAR ORDO PRO · CEO MODE · Данные из существующего защищённого Worker API</div>
      </div>`;
    document.body.appendChild(overlay);
    $('#poCeoClose',overlay).addEventListener('click', close);
    $('#poCeoRefresh',overlay).addEventListener('click', load);
    $('#poCeoFullscreen',overlay).addEventListener('click', fullscreen);
    $('#poCeoInstall',overlay).addEventListener('click', install);
    $('#poCeoMonth',overlay).value = monthKey();
    $('#poCeoMonth',overlay).addEventListener('change', load);
    $('#poCeoTwinGrid',overlay).addEventListener('click', event => {
      const tile = event.target.closest('[data-po-bracelet]');
      if (!tile) return;
      selectedBracelet = Number(tile.dataset.poBracelet);
      renderTwin(cache.clients);
    });
    return overlay;
  }

  function braceletNumber(client) {
    const raw = String(client.room ?? client.braceletNo ?? client.bracelet ?? '').trim().replace(/^браслет\s*/i,'').replace(/^№\s*/,'');
    return /^\d+$/.test(raw) ? Number(raw) : null;
  }

  function renderTwin(clients) {
    const active = (Array.isArray(clients) ? clients : []).filter(c => c.status === 'active');
    const byNumber = new Map();
    active.forEach(c => { const n = braceletNumber(c); if (n && n >= 1 && n <= 36) byNumber.set(n,c); });
    let html = '';
    for (let n=1; n<=36; n++) {
      const client = byNumber.get(n);
      html += `<button class="po-ceo-room${client?' is-active':''}${selectedBracelet===n?' is-selected':''}" type="button" data-po-bracelet="${n}"><strong>${n}</strong><small>${client?'ЗАНЯТ':'СВОБОДЕН'}</small></button>`;
    }
    $('#poCeoTwinGrid',overlay).innerHTML = html;
    $('#poCeoOccupancy',overlay).textContent = byNumber.size + ' / 36';
    const detail = $('#poCeoBraceletDetail',overlay), chosen = byNumber.get(selectedBracelet);
    if (!chosen) {
      detail.innerHTML = `<b>Занято:</b> ${byNumber.size} · <b>Свободно:</b> ${36-byNumber.size}${selectedBracelet?`<br>Браслет №${selectedBracelet} сейчас свободен.`:'<br>Выберите браслет на карте.'}`;
      return;
    }
    const stamp = chosen.startedAt ? new Date(chosen.startedAt).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';
    const items = Array.isArray(chosen.items) ? chosen.items : [];
    const purchases = items.length ? items.map(i => `${esc(i.name||'Товар')} ×${Number(i.qty||1)}`).join(' · ') : 'Покупок пока нет';
    detail.innerHTML = `<b>Браслет №${selectedBracelet} · Активен</b><br>Пришёл: ${esc(stamp)}<br>Покупки: ${purchases}`;
  }

  function renderForecast(reports, month) {
    const rows = (Array.isArray(reports) ? reports : []).filter(r => dateKey(r.shiftDate).startsWith(month));
    const revenue = rows.reduce((sum,r) => sum + Number(r.paidTotal ?? (Number(r.cashTotal||0)+Number(r.transferTotal||0))), 0);
    const days = new Set(rows.map(r => dateKey(r.shiftDate)).filter(Boolean));
    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();
    const now = new Date(), isCurrent = month === monthKey();
    const elapsed = isCurrent ? now.getDate() : daysInMonth;
    const estimate = days.size > 0 && isCurrent ? revenue / days.size * daysInMonth : revenue;
    const averagePerRecordedDay = days.size ? revenue / days.size : 0;
    const avgCheck = rows.reduce((sum,r) => sum + Number(r.clientCount||0),0);
    const avgValue = avgCheck ? revenue / avgCheck : 0;
    const progress = Math.max(1,Math.min(100,Math.round(elapsed/daysInMonth*100)));
    const caption = rows.length
      ? `${rows.length} отчётов закрытых смен · ${days.size} календарных дней с данными.`
      : 'За выбранный месяц закрытых смен в отчётах нет.';
    const headline = rows.length ? money(Math.round(estimate)) : 'Нет данных';
    $('#poCeoForecast',overlay).innerHTML = `<div class="po-ceo-forecast"><small>${isCurrent?'Ожидаемая выручка к концу месяца':'Фактическая выручка по отчётам'}</small><strong>${headline}</strong><p>${caption}</p><div class="po-ceo-progress"><span style="width:${progress}%"></span></div><div class="po-ceo-note">Выручка за период: ${money(revenue)} · Среднее за день с отчётом: ${money(Math.round(averagePerRecordedDay))}</div></div>
      <div class="po-ceo-kpis" style="margin-top:9px"><div class="po-ceo-kpi green"><small>Фактическая выручка</small><strong>${money(revenue)}</strong></div><div class="po-ceo-kpi blue"><small>Средний чек</small><strong>${avgValue?money(Math.round(avgValue)):'—'}</strong></div></div>`;
    $('#poCeoProfitNote',overlay).innerHTML = '<b>Чистая прибыль пока не рассчитывается.</b> В текущем менеджерском API доступны отчёты выручки, клиенты и товары, но не подтверждённые расходы и себестоимость. Не показываем выручку как прибыль.';
  }

  function renderSignals(clients, products) {
    const all = Array.isArray(clients) ? clients : [];
    const today = new Date().toLocaleDateString('en-CA');
    const todayClients = all.filter(c => !c.archived && (c.status === 'active' || String(c.startedDay||'') === today));
    const active = todayClients.filter(c => c.status === 'active').length;
    const productList = Array.isArray(products) ? products : [];
    const low = productList.filter(p => Number(p.available ?? (Number(p.stock||0)-Number(p.reserved||0))) <= 3);
    $('#poCeoSignals',overlay).innerHTML = `<div class="po-ceo-kpis" style="margin-top:0"><div class="po-ceo-kpi"><small>Клиентов сегодня</small><strong>${count(todayClients.length)}</strong></div><div class="po-ceo-kpi green"><small>Сейчас в бане</small><strong>${count(active)}</strong></div><div class="po-ceo-kpi red"><small>Низкий остаток</small><strong>${count(low.length)}</strong></div></div>
      ${low.length ? low.slice(0,5).map(p => `<div class="po-ceo-top-product"><span>${esc(p.name||'Товар')}</span><b>${count(p.available ?? (Number(p.stock||0)-Number(p.reserved||0)))} шт.</b></div>`).join('') : '<div class="po-ceo-note">Нет товаров с остатком 3 шт. или меньше.</div>'}`;
  }

  async function load() {
    if (!overlay) return;
    const month = $('#poCeoMonth',overlay).value || monthKey();
    $('#poCeoKpis',overlay).innerHTML = '<div class="po-ceo-kpi"><small>Загрузка</small><strong>…</strong></div>'.repeat(4);
    $('#poCeoTwinGrid',overlay).innerHTML = '<div class="po-ceo-note">Обновление карты…</div>';
    const results = await Promise.allSettled([
      api('/api/admin/control/reports'),
      api('/api/admin/control/clients'),
      api('/api/products')
    ]);
    const reportsResult = results[0].status === 'fulfilled' ? results[0].value : null;
    const clientsResult = results[1].status === 'fulfilled' ? results[1].value : null;
    const productsResult = results[2].status === 'fulfilled' ? results[2].value : null;
    cache.reports = reportsResult && Array.isArray(reportsResult.reports) ? reportsResult.reports : [];
    cache.clients = clientsResult && Array.isArray(clientsResult.clients) ? clientsResult.clients : [];
    cache.products = productsResult && Array.isArray(productsResult.products) ? productsResult.products : [];
    if (clientsResult) renderTwin(cache.clients);
    else $('#poCeoTwinGrid',overlay).innerHTML = `<div class="po-ceo-error">${esc(results[1].reason?.message||'Не удалось загрузить браслеты.')}</div>`;
    if (reportsResult) renderForecast(cache.reports, month);
    else $('#poCeoForecast',overlay).innerHTML = `<div class="po-ceo-error">${esc(results[0].reason?.message||'Не удалось загрузить отчёты.')}</div>`;
    if (clientsResult && productsResult) renderSignals(cache.clients,cache.products);
    else $('#poCeoSignals',overlay).innerHTML = '<div class="po-ceo-error">Часть данных недоступна. Проверьте подключение и права доступа.</div>';
    const latest = cache.reports[0] || null;
    const monthRows = cache.reports.filter(r => dateKey(r.shiftDate).startsWith(month));
    const monthRevenue = monthRows.reduce((s,r)=>s+Number(r.paidTotal ?? (Number(r.cashTotal||0)+Number(r.transferTotal||0))),0);
    const today = new Date().toLocaleDateString('en-CA');
    const todayActive = cache.clients.filter(c=>c.status==='active');
    const clientCount = monthRows.reduce((s,r)=>s+Number(r.clientCount||0),0);
    const monthAvg = clientCount ? monthRevenue/clientCount : 0;
    $('#poCeoKpis',overlay).innerHTML = [
      `<div class="po-ceo-kpi"><small>Сейчас в бане</small><strong>${count(todayActive.length)}</strong></div>`,
      `<div class="po-ceo-kpi green"><small>Выручка последней смены</small><strong>${latest?money(latest.paidTotal ?? (Number(latest.cashTotal||0)+Number(latest.transferTotal||0))):'—'}</strong></div>`,
      `<div class="po-ceo-kpi blue"><small>Выручка месяца</small><strong>${reportsResult?money(monthRevenue):'—'}</strong></div>`,
      `<div class="po-ceo-kpi"><small>Средний чек месяца</small><strong>${monthAvg?money(Math.round(monthAvg)):'—'}</strong></div>`
    ].join('');
    const failed = results.filter(r=>r.status==='rejected').length;
    const live = $('#poCeoLive',overlay);
    live.textContent = failed ? '● ЧАСТЬ ДАННЫХ НЕДОСТУПНА' : '● LIVE VIEW';
    live.style.color = failed ? '#ffd18a' : '#7cf0a9';
    live.style.borderColor = failed ? '#88632b' : '#286e46';
  }

  async function open() {
    const token = sessionStorage.getItem(TOKEN_KEY);
    const role = sessionStorage.getItem(ROLE_KEY) || '';
    if (!token) { alert('Сначала войдите в панель руководителя PAR ORDO.'); return; }
    if (!['admin','manager'].includes(role)) { alert('CEO Mode доступен только администратору или руководителю.'); return; }
    createOverlay();
    overlay.classList.add('po-ceo-open');
    document.body.style.overflow = 'hidden';
    await load();
    if (timer) clearInterval(timer);
    timer = setInterval(() => { if (overlay?.classList.contains('po-ceo-open') && !document.hidden) load(); }, 60000);
  }

  function close() {
    if (!overlay) return;
    overlay.classList.remove('po-ceo-open');
    document.body.style.overflow = '';
    if (timer) clearInterval(timer);
    timer = null;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(()=>{});
  }

  function fullscreen() {
    if (!overlay) return;
    if (document.fullscreenElement) { document.exitFullscreen?.().catch(()=>{}); return; }
    overlay.requestFullscreen?.().catch(()=>{});
  }

  async function install() {
    const status = $('#poCeoInstallStatus',overlay);
    if (standalone()) { status.textContent = 'Приложение уже открыто в отдельном окне.'; return; }
    if (deferredInstall) {
      try { await deferredInstall.prompt(); await deferredInstall.userChoice; } catch (_) {}
      deferredInstall = null;
      status.textContent = 'Если подтвердили установку, ярлык PAR ORDO OWNER появится на главном экране.';
      return;
    }
    status.textContent = 'Android Chrome: меню ⋮ → «Установить приложение» или «Добавить на главный экран».';
    alert('Откройте меню Chrome ⋮ и выберите «Установить приложение» или «Добавить на главный экран».');
  }

  function addLauncher() {
    if ($('#poCeoLaunch')) return;

    // Main PAR ORDO application: place CEO Mode inside the real owner dashboard.
    const managerActions = $('#managerView .manager-actions');
    if (managerActions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = 'poCeoLaunch';
      button.className = 'manager-action';
      button.innerHTML = '<span class="manager-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3.5 19.5h17M5.5 16.5 10 12l3.2 2.8 5.3-7.3"/><path d="M13.8 7.5h4.7v4.7"/></svg></span><span class="manager-action-copy"><strong>CEO MODE · OWNER APP</strong><small>Digital Twin, прогноз дохода и панель владельца</small></span>';
      button.addEventListener('click', open);
      managerActions.appendChild(button);
      return;
    }

    // Standalone manager.html compatibility.
    const host = $('#reportsPanel > .panel');
    if (!host) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'poCeoLaunch';
    button.className = 'po-ceo-launch';
    button.textContent = '✦ ОТКРЫТЬ CEO MODE · DIGITAL TWIN';
    button.addEventListener('click', open);
    const form = $('#reportsPanel > .panel .form');
    if (form) form.insertAdjacentElement('afterend', button);
    else host.appendChild(button);
  }

  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; });
  window.addEventListener('appinstalled', () => { deferredInstall = null; const status = $('#poCeoInstallStatus',overlay); if (status) status.textContent = 'PAR ORDO OWNER установлен.'; });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && overlay?.classList.contains('po-ceo-open')) close(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addLauncher, {once:true});
  else addLauncher();
  const observer = new MutationObserver(addLauncher);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  setTimeout(()=>observer.disconnect(),5000);
  if ('serviceWorker' in navigator) {
    window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{}),{once:true});
  }
})();


  // Load PAR ORDO LIVE DIGITAL TWIN assets (the previous 3D map).
  // TWIN V1 (par-ordo-twin-v1.js, loaded before this file) replaces it; if TWIN V1 is missing
  // or fails, this loader runs as before.
  window.PARORDOLoadLegacyTwin = function loadLiveDigitalTwin() {
    if (window.__poLegacyTwinLoaded) return;
    window.__poLegacyTwinLoaded = true;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = './par-ordo-ceo-live3d-v1.css?v=1.0.0';
    document.head.appendChild(css);

    const layoutV4 = document.createElement('script');
    layoutV4.src = './par-ordo-live3d-map-v4.js?v=8.0.0';
    layoutV4.async = true;
    document.head.appendChild(layoutV4);

    const fitScreenV10 = document.createElement('script');
    fitScreenV10.src = './par-ordo-dt-fit-screen-v10.js?v=10.0.0';
    fitScreenV10.async = true;
    document.head.appendChild(fitScreenV10);

    const script = document.createElement('script');
    script.src = './par-ordo-ceo-live3d-v1.js?v=1.0.0';
    script.async = true;
    document.head.appendChild(script);

    const enhancement = document.createElement('script');
    enhancement.src = './par-ordo-live3d-fullscreen-v1.js?v=1.0.0';
    enhancement.async = true;
    document.head.appendChild(enhancement);
  };
  if (!(window.PARORDOTwin && window.PARORDOTwin.active)) window.PARORDOLoadLegacyTwin();
