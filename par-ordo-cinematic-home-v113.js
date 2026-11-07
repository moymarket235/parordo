/* PAR ORDO CINEMATIC HOME V113
   Shared, lightweight cinematic intro for the public entry, staff workspace,
   manager workspace, and CEO Mode. No external libraries, API calls, or writes.
   Canvas animation runs only while the overlay is visible and stops on close.
*/
(() => {
  'use strict';
  if (window.PARORDOCinematicHome && window.PARORDOCinematicHome.version === '113') return;

  const VERSION = '113';
  const DURATION = 4100;
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const $ = (selector, root = document) => root.querySelector(selector);
  let active = null;
  let queuedMode = null;
  let lastPlayAt = 0;
  let activePanel = '';
  let lastCeoOpen = false;

  const labels = {
    SITE: { eyebrow: 'ПРЕМИУМ ЦИФРОВАЯ ЭКОСИСТЕМА', title: 'PAR ORDO', subtitle: 'CINEMATIC HOME EXPERIENCE', tagline: 'ОТДЫХ · ЗДОРОВЬЕ · КОМФОРТ' },
    STAFF: { eyebrow: 'СОТРУДНИК · WORKSPACE', title: 'PAR ORDO', subtitle: 'STAFF CONTROL EXPERIENCE', tagline: 'СМЕНА · КЛИЕНТЫ · CLEAN CONTROL PRO' },
    MANAGER: { eyebrow: 'РУКОВОДИТЕЛЬ · OWNER INTELLIGENCE', title: 'PAR ORDO', subtitle: 'MANAGEMENT EXPERIENCE', tagline: 'КОНТРОЛЬ · АНАЛИТИКА · УПРАВЛЕНИЕ' },
    CEO: { eyebrow: 'CEO MODE · LIVE MANAGEMENT', title: 'PAR ORDO', subtitle: 'OWNER INTELLIGENCE', tagline: 'DIGITAL TWIN · ENGINEERING · BUSINESS SIGNALS' }
  };

  const css = `
  #po113-cinematic{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:hidden;isolation:isolate;background:#020806;color:#f7e8c0;opacity:1;visibility:visible;pointer-events:auto;contain:layout paint style;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
  #po113-cinematic *{box-sizing:border-box}
  #po113-cinematic .po113-bg{position:absolute;inset:0;z-index:-4;background:radial-gradient(ellipse at 50% 42%,rgba(15,82,60,.33),transparent 42%),radial-gradient(ellipse at 82% 22%,rgba(28,100,133,.18),transparent 38%),linear-gradient(145deg,#020705 0%,#07140f 48%,#020605 100%)}
  #po113-cinematic .po113-texture{position:absolute;inset:0;z-index:-3;opacity:.28;background-image:linear-gradient(rgba(210,177,104,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(210,177,104,.045) 1px,transparent 1px);background-size:54px 54px;mask-image:radial-gradient(ellipse at center,#000 12%,transparent 82%)}
  #po113-cinematic canvas{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}
  #po113-cinematic .po113-vignette{position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(ellipse at 50% 43%,transparent 25%,rgba(0,0,0,.18) 57%,rgba(0,0,0,.76) 100%),linear-gradient(180deg,rgba(0,0,0,.18),transparent 26%,transparent 72%,rgba(0,0,0,.5)}
  #po113-cinematic .po113-content{position:relative;z-index:2;width:min(92vw,720px);padding:24px 18px 34px;text-align:center;display:flex;flex-direction:column;align-items:center;transform:translateY(-1vh);animation:po113Content 4.1s cubic-bezier(.18,.7,.2,1) both}
  #po113-cinematic .po113-seal{width:clamp(82px,20vw,126px);height:clamp(82px,20vw,126px);padding:7px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(246,205,118,.92);background:radial-gradient(circle,rgba(255,204,109,.19),rgba(5,15,10,.86) 68%);box-shadow:0 0 0 5px rgba(243,190,87,.07),0 0 28px rgba(237,174,59,.26),inset 0 0 22px rgba(234,187,90,.15);opacity:0;transform:scale(.56) rotate(-16deg);animation:po113Seal 1.25s cubic-bezier(.16,.78,.18,1) .16s both}
  #po113-cinematic .po113-seal img{width:100%;height:100%;object-fit:contain;border-radius:50%}
  #po113-cinematic .po113-kicker{margin:22px 0 0;color:#7ee4b0;font-size:clamp(9px,2.1vw,12px);font-weight:800;letter-spacing:.28em;text-transform:uppercase;opacity:0;animation:po113Rise .65s ease-out .65s both}
  #po113-cinematic .po113-title{margin:9px 0 0;padding-left:.12em;font-family:Georgia,'Times New Roman',serif;font-size:clamp(36px,9vw,66px);font-weight:700;line-height:1.02;letter-spacing:.12em;color:#ffe7ae;text-shadow:0 2px 12px #000,0 0 32px rgba(255,191,74,.26);opacity:0;animation:po113Rise .72s cubic-bezier(.16,.7,.2,1) .82s both}
  #po113-cinematic .po113-subtitle{margin:12px 0 0;color:#d7e6dc;font-size:clamp(10px,2.6vw,15px);font-weight:750;letter-spacing:.24em;opacity:0;animation:po113Rise .7s ease-out 1.05s both}
  #po113-cinematic .po113-divider{width:min(50vw,250px);height:1px;margin:18px 0 0;background:linear-gradient(90deg,transparent,rgba(248,207,123,.9),rgba(91,221,172,.65),transparent);box-shadow:0 0 15px rgba(245,197,97,.35);opacity:0;animation:po113Rise .55s ease-out 1.2s both}
  #po113-cinematic .po113-tagline{margin:13px 0 0;color:rgba(242,232,205,.82);font-size:clamp(8px,2vw,11px);font-weight:650;letter-spacing:.18em;opacity:0;animation:po113Rise .65s ease-out 1.3s both}
  #po113-cinematic .po113-progress{width:min(48vw,230px);height:3px;margin-top:24px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.12);opacity:0;animation:po113Rise .4s ease-out 1.35s both}
  #po113-cinematic .po113-progress span{display:block;width:100%;height:100%;transform:scaleX(0);transform-origin:left;background:linear-gradient(90deg,#277a58,#83f1bd,#f4c66f);box-shadow:0 0 12px rgba(104,239,174,.7);animation:po113Progress 3.75s linear .18s both}
  #po113-cinematic .po113-skip{position:absolute;z-index:4;right:max(16px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));min-height:42px;padding:10px 16px;border:1px solid rgba(232,194,112,.52);border-radius:999px;background:rgba(3,12,8,.74);color:#f7e8c0;font:750 11px system-ui,sans-serif;letter-spacing:.08em;cursor:pointer;backdrop-filter:blur(8px)}
  #po113-cinematic.is-leaving{pointer-events:none;animation:po113Exit .56s ease-in forwards}
  #po113-cinematic.is-leaving .po113-content{animation:po113ExitContent .56s ease-in forwards}
  @keyframes po113Rise{from{opacity:0;transform:translateY(15px);filter:blur(5px)}to{opacity:1;transform:translateY(0);filter:blur(0)}}
  @keyframes po113Seal{0%{opacity:0;transform:scale(.45) rotate(-22deg)}65%{opacity:1;transform:scale(1.08) rotate(5deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
  @keyframes po113Content{0%{transform:translateY(2vh) scale(.975)}26%{transform:translateY(0) scale(1)}84%{transform:translateY(0) scale(1)}100%{transform:translateY(-.6vh) scale(1.01)}}
  @keyframes po113Progress{to{transform:scaleX(1)}}
  @keyframes po113Exit{to{opacity:0;visibility:hidden}}
  @keyframes po113ExitContent{to{opacity:0;transform:translateY(-10px) scale(.98);filter:blur(5px)}}
  @media(min-width:760px){#po113-cinematic .po113-content{padding:32px}.po113-kicker{font-size:12px}}
  @media(max-height:650px){#po113-cinematic .po113-seal{width:72px;height:72px}.po113-kicker{margin-top:12px!important}.po113-title{font-size:clamp(32px,7vh,52px)!important}.po113-subtitle{margin-top:7px!important}.po113-divider{margin-top:10px!important}.po113-tagline{margin-top:8px!important}.po113-progress{margin-top:13px!important}}
  @media(prefers-reduced-motion:reduce){#po113-cinematic *{animation-duration:.01ms!important;animation-delay:0ms!important}#po113-cinematic canvas{display:none}}
  `;

  function makePoints(count) {
    const points = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / Math.max(1, count - 1)) * 2;
      const radius = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = golden * i;
      points.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius, phase: Math.random() * Math.PI * 2 });
    }
    return points;
  }

  function createOverlay(mode) {
    const old = $('#po113-cinematic');
    if (old) old.remove();
    const data = labels[mode] || labels.SITE;
    const style = document.createElement('style');
    style.id = 'po113-cinematic-style';
    style.textContent = css;
    document.head.appendChild(style);

    const overlay = document.createElement('section');
    overlay.id = 'po113-cinematic';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-label', 'PAR ORDO Cinematic Experience');
    overlay.innerHTML = `
      <div class="po113-bg" aria-hidden="true"></div>
      <div class="po113-texture" aria-hidden="true"></div>
      <canvas aria-hidden="true"></canvas>
      <div class="po113-vignette" aria-hidden="true"></div>
      <div class="po113-content">
        <div class="po113-seal"><img src="./assets/par-ordo-logo.png" alt="ПАР ОРДО" onerror="this.style.display='none'"></div>
        <p class="po113-kicker"></p>
        <h1 class="po113-title">PAR ORDO</h1>
        <p class="po113-subtitle">CINEMATIC HOME EXPERIENCE</p>
        <div class="po113-divider" aria-hidden="true"></div>
        <p class="po113-tagline"></p>
        <div class="po113-progress" aria-hidden="true"><span></span></div>
      </div>
      <button type="button" class="po113-skip">ПРОПУСТИТЬ →</button>`;
    $('.po113-kicker', overlay).textContent = data.eyebrow;
    $('.po113-subtitle', overlay).textContent = data.subtitle;
    $('.po113-tagline', overlay).textContent = data.tagline;
    document.body.appendChild(overlay);
    return { overlay, style, canvas: $('canvas', overlay), mode };
  }

  function startCanvas(canvas, overlay) {
    if (REDUCED || !canvas || !canvas.getContext) return () => {};
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return () => {};
    let width = 0, height = 0, dpr = 1, raf = 0, stopped = false, lastFrame = 0;
    const points = makePoints(window.innerWidth < 600 ? 230 : 340);
    const ambience = Array.from({ length: window.innerWidth < 600 ? 66 : 105 }, () => ({
      x: Math.random(), y: Math.random(), r: .5 + Math.random() * 1.25,
      speed: .000025 + Math.random() * .00007, phase: Math.random() * 6.28
    }));
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, rect.width); height = Math.max(1, rect.height);
      dpr = Math.min(1.35, window.devicePixelRatio || 1);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    function draw(now) {
      if (stopped || !overlay.isConnected) return;
      raf = requestAnimationFrame(draw);
      if (now - lastFrame < 30) return; // cap near 30 fps on mobile
      lastFrame = now;
      ctx.clearRect(0, 0, width, height);
      const t = now * .00022;
      const cx = width * .5, cy = height * .385;
      const radius = Math.min(width * .32, height * .245, 235);

      // Soft blue/emerald and amber atmospheric glows.
      const glow = ctx.createRadialGradient(cx, cy, radius * .04, cx, cy, radius * 1.65);
      glow.addColorStop(0, 'rgba(40,154,130,.12)');
      glow.addColorStop(.48, 'rgba(34,126,157,.065)');
      glow.addColorStop(1, 'rgba(2,8,6,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);

      // Fibonacci sphere: rotating particle field with depth and color shift.
      const c = Math.cos(t), s = Math.sin(t), cxr = Math.cos(t * .63), sxr = Math.sin(t * .63);
      const projected = new Array(points.length);
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const x1 = p.x * c - p.z * s;
        const z1 = p.x * s + p.z * c;
        const y2 = p.y * cxr - z1 * sxr;
        const z2 = p.y * sxr + z1 * cxr;
        const perspective = 1.22 / (1.82 - z2 * .36);
        const x = cx + x1 * radius * perspective;
        const y = cy + y2 * radius * perspective;
        const depth = Math.max(0, Math.min(1, (z2 + 1) * .5));
        projected[i] = { x, y, depth };
      }

      // Fine orbital arcs around the particle sphere.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * .23);
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, radius * (1.02 + ring * .12), radius * (.37 + ring * .07), ring * .82, 0, Math.PI * 2);
        ctx.strokeStyle = ring === 1 ? 'rgba(229,190,111,.22)' : 'rgba(94,216,190,.13)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      // Selective short connections create a light mesh without a heavy 3D engine.
      ctx.lineWidth = .55;
      for (let i = 0; i < projected.length; i++) {
        const a = projected[i];
        if (a.depth < .23) continue;
        for (let step = 1; step <= 2; step++) {
          const j = (i + step * 7) % projected.length;
          const b = projected[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < radius * .23) {
            ctx.strokeStyle = `rgba(104,211,190,${.06 + a.depth * .12})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }

      for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        const pulse = .72 + .28 * Math.sin(now * .0016 + points[i].phase);
        const r = (.55 + p.depth * 1.55) * pulse;
        const color = p.depth > .72 ? `rgba(246,204,120,${.35 + p.depth * .55})` : `rgba(89,222,191,${.22 + p.depth * .64})`;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        if (p.depth > .78 && i % 13 === 0) {
          ctx.fillStyle = `rgba(246,204,120,${.1 + p.depth * .12})`;
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 3.5, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Flowing particle waves at the lower third, echoing the reference video.
      const waveY = height * .73;
      for (let layer = 0; layer < 4; layer++) {
        const amp = height * (.022 + layer * .009);
        ctx.beginPath();
        for (let x = 0; x <= width + 3; x += 4) {
          const u = x / width;
          const y = waveY + Math.sin(u * 8.3 + t * 1.7 + layer * .75) * amp
            + Math.sin(u * 15.5 - t * 1.1 + layer) * amp * .29
            + (layer - 1.5) * height * .028;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = layer % 2 ? 'rgba(54,174,173,.19)' : 'rgba(226,176,87,.19)';
        ctx.lineWidth = layer === 1 ? 1.25 : .8;
        ctx.stroke();
        for (let i = 0; i < 58; i++) {
          const u = i / 57, x = u * width;
          const y = waveY + Math.sin(u * 8.3 + t * 1.7 + layer * .75) * amp
            + Math.sin(u * 15.5 - t * 1.1 + layer) * amp * .29
            + (layer - 1.5) * height * .028;
          const twinkle = .22 + .55 * (.5 + .5 * Math.sin(now * .0018 + i * .71 + layer));
          ctx.fillStyle = layer % 2 ? `rgba(78,213,208,${twinkle})` : `rgba(245,195,112,${twinkle})`;
          ctx.beginPath(); ctx.arc(x, y, .65 + twinkle * 1.15, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Sparse ambient stars drift slowly in the background.
      for (const p of ambience) {
        p.y -= p.speed * 10;
        if (p.y < -.02) { p.y = 1.02; p.x = Math.random(); }
        const alpha = .16 + .28 * (.5 + .5 * Math.sin(now * .001 + p.phase));
        ctx.fillStyle = `rgba(225,222,188,${alpha})`;
        ctx.beginPath(); ctx.arc(p.x * width, p.y * height, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    raf = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }

  function play(mode = 'SITE') {
    mode = String(mode || 'SITE').toUpperCase();
    if (!labels[mode]) mode = 'SITE';
    const now = Date.now();
    if (active) {
      if (active.mode !== mode) queuedMode = mode;
      return active.promise;
    }
    if (now - lastPlayAt < 550) return Promise.resolve();
    lastPlayAt = now;

    const made = createOverlay(mode);
    const { overlay, style, canvas } = made;
    const stopCanvas = startCanvas(canvas, overlay);
    let resolvePromise;
    const promise = new Promise(resolve => { resolvePromise = resolve; });
    active = { mode, overlay, promise, finish: null };
    let ended = false;
    let timer = null;

    const finish = () => {
      if (ended) return;
      ended = true;
      if (timer) clearTimeout(timer);
      stopCanvas();
      overlay.classList.add('is-leaving');
      window.setTimeout(() => {
        overlay.remove(); style.remove();
        const next = queuedMode; queuedMode = null;
        active = null;
        resolvePromise();
        if (next) window.setTimeout(() => play(next), 100);
      }, REDUCED ? 60 : 580);
    };
    active.finish = finish;
    $('.po113-skip', overlay).addEventListener('click', finish, { once: true });
    const onKey = event => { if (event.key === 'Escape' && active?.overlay === overlay) finish(); };
    window.addEventListener('keydown', onKey, { once: true });
    timer = window.setTimeout(finish, REDUCED ? 850 : DURATION);
    return promise;
  }

  function appIsVisible() {
    const app = $('#appView');
    return !!app && !app.classList.contains('hidden');
  }
  function currentPanelMode() {
    if (!appIsVisible()) return '';
    const manager = $('#managerView');
    if (sessionStorage.getItem('parordo_manager_portal_active') === '1' || manager?.classList.contains('active')) return 'MANAGER';
    const home = $('#homeView');
    if (home?.classList.contains('active')) return 'STAFF';
    // Standalone staff-control page has an appView but no managerView.
    return manager ? '' : 'STAFF';
  }
  function syncPanelMode() {
    const next = currentPanelMode();
    if (!next) { activePanel = ''; return; }
    if (next !== activePanel) {
      activePanel = next;
      play(next);
    }
  }

  function watchCeoOverlay(node) {
    if (!node || node.dataset.po113Watching === '1') return;
    node.dataset.po113Watching = '1';
    const check = () => {
      const opened = node.classList.contains('po-ceo-open');
      if (opened && !lastCeoOpen) { lastCeoOpen = true; play('CEO'); }
      else if (!opened && lastCeoOpen) lastCeoOpen = false;
    };
    new MutationObserver(check).observe(node, { attributes: true, attributeFilter: ['class'] });
    check();
  }

  window.PARORDOCinematicHome = Object.freeze({ version: VERSION, play });

  // Site-level opening on every fresh page visit.
  const startSiteIntro = () => {
    play('SITE');
    // For an already authenticated session, show the appropriate workspace intro
    // after the site reveal, without waiting for another login event.
    if (appIsVisible()) window.setTimeout(syncPanelMode, REDUCED ? 1000 : DURATION + 700);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startSiteIntro, { once: true });
  else window.setTimeout(startSiteIntro, 80);

  // Detect successful authentication and transitions between staff/manager panels.
  const app = $('#appView');
  if (app) {
    let previousVisible = !app.classList.contains('hidden');
    new MutationObserver(() => {
      const visible = !app.classList.contains('hidden');
      if (visible && !previousVisible) window.setTimeout(syncPanelMode, 80);
      if (!visible) { activePanel = ''; }
      previousVisible = visible;
    }).observe(app, { attributes: true, attributeFilter: ['class'] });
  }
  ['#homeView', '#managerView'].forEach(selector => {
    const node = $(selector);
    if (!node) return;
    new MutationObserver(() => window.setTimeout(syncPanelMode, 40)).observe(node, { attributes: true, attributeFilter: ['class'] });
  });
  // CEO Mode is inserted lazily by the existing CEO script. Watch only newly
  // inserted matching overlays, not the whole DOM attribute tree.
  const existingCeo = $('#poCeoOverlay');
  if (existingCeo) watchCeoOverlay(existingCeo);
  new MutationObserver(records => {
    for (const record of records) {
      for (const added of record.addedNodes) {
        if (added.nodeType !== 1) continue;
        if (added.id === 'poCeoOverlay') watchCeoOverlay(added);
        else if (added.querySelector) {
          const ceo = added.querySelector('#poCeoOverlay');
          if (ceo) watchCeoOverlay(ceo);
        }
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  // When V113 loads after an existing authenticated app boot, catch its current view.
  if (appIsVisible()) window.setTimeout(syncPanelMode, 160);
})();
