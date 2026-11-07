/*
 * PAR ORDO CINEMATIC HOME V115
 * Free, dependency-free Canvas 2D particle animation inspired by the user's reference video.
 * Motion sequence: luminous particle sphere -> vertical double helix -> flowing particle wave -> burst.
 * Responsive for phones, tablets and desktop. No API/database/Worker access.
 */
(() => {
  'use strict';

  const VERSION = '115';
  if (window.PARORDOCinematicHome?.version === VERSION) return;

  const DURATION = 6800;
  const REDUCED = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, root = document) => root.querySelector(s);
  let current = null;
  let queuedMode = null;
  let lastPlayAt = 0;
  let activePanel = '';
  let ceoWasOpen = false;

  const labels = {
    SITE:    { over: 'ПРЕМИУМ ПРОСТРАНСТВО ОТДЫХА', title: 'PAR ORDO', sub: 'CINEMATIC HOME EXPERIENCE', line: 'ОТДЫХ  ·  ЗДОРОВЬЕ  ·  КОМФОРТ' },
    STAFF:   { over: 'СОТРУДНИК  ·  WORKSPACE', title: 'PAR ORDO', sub: 'STAFF CONTROL EXPERIENCE', line: 'СМЕНА  ·  КЛИЕНТЫ  ·  CLEAN CONTROL PRO' },
    MANAGER: { over: 'РУКОВОДИТЕЛЬ  ·  OWNER INTELLIGENCE', title: 'PAR ORDO', sub: 'MANAGEMENT EXPERIENCE', line: 'КОНТРОЛЬ  ·  АНАЛИТИКА  ·  УПРАВЛЕНИЕ' },
    CEO:     { over: 'CEO MODE  ·  LIVE MANAGEMENT', title: 'PAR ORDO', sub: 'OWNER INTELLIGENCE', line: 'DIGITAL TWIN  ·  ENGINEERING  ·  BUSINESS SIGNALS' }
  };

  const css = `
  #po115-cinematic{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:hidden;isolation:isolate;background:#03040b;color:#f6f7ff;opacity:1;visibility:visible;pointer-events:auto;contain:layout paint style;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
  #po115-cinematic *{box-sizing:border-box}
  #po115-cinematic .po115-bg{position:absolute;inset:0;z-index:-3;background:radial-gradient(ellipse at 50% 38%,rgba(30,47,93,.24),transparent 44%),radial-gradient(ellipse at 19% 48%,rgba(143,43,73,.11),transparent 42%),radial-gradient(ellipse at 82% 50%,rgba(33,104,151,.12),transparent 43%),linear-gradient(180deg,#03040a 0%,#070a16 55%,#02040a 100%)}
  #po115-cinematic canvas{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}
  #po115-cinematic .po115-vignette{position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(ellipse at 50% 43%,transparent 12%,rgba(2,3,9,.12) 53%,rgba(2,3,9,.82) 100%),linear-gradient(180deg,rgba(2,3,9,.28),transparent 27%,transparent 68%,rgba(2,3,9,.55)}
  #po115-cinematic .po115-content{position:relative;z-index:2;width:min(92vw,780px);padding:20px 18px 30px;text-align:center;display:flex;flex-direction:column;align-items:center;transform:translateY(-1vh);pointer-events:none;animation:po115Content 6.8s cubic-bezier(.2,.65,.2,1) both}
  #po115-cinematic .po115-over{margin:0;color:rgba(220,229,255,.88);font-size:clamp(9px,1.9vw,12px);font-weight:750;letter-spacing:.28em;text-transform:uppercase;text-shadow:0 0 20px rgba(107,143,255,.58);opacity:0;animation:po115Rise .72s ease-out .26s both}
  #po115-cinematic .po115-title{margin:15px 0 0;padding-left:.16em;font-size:clamp(37px,9.5vw,76px);font-weight:850;line-height:1;letter-spacing:.16em;color:#fff;text-shadow:0 0 10px rgba(255,255,255,.36),0 0 30px rgba(83,145,255,.6),0 0 62px rgba(255,95,118,.32);opacity:0;animation:po115Rise .9s cubic-bezier(.15,.72,.2,1) .46s both}
  #po115-cinematic .po115-sub{margin:14px 0 0;color:rgba(229,235,255,.92);font-size:clamp(9px,2.15vw,13px);font-weight:750;letter-spacing:.22em;text-shadow:0 0 18px rgba(99,145,255,.45);opacity:0;animation:po115Rise .75s ease-out .72s both}
  #po115-cinematic .po115-line{width:min(48vw,230px);height:1px;margin:19px 0 0;background:linear-gradient(90deg,transparent,rgba(255,104,117,.9),rgba(120,169,255,.95),transparent);box-shadow:0 0 18px rgba(104,152,255,.56);opacity:0;animation:po115Rise .6s ease-out .94s both}
  #po115-cinematic .po115-tag{margin:13px 0 0;color:rgba(220,228,250,.73);font-size:clamp(8px,1.75vw,10px);font-weight:650;letter-spacing:.16em;opacity:0;animation:po115Rise .65s ease-out 1.03s both}
  #po115-cinematic .po115-progress{width:min(42vw,190px);height:2px;margin-top:24px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.15);opacity:0;animation:po115Rise .4s ease-out 1.15s both}
  #po115-cinematic .po115-progress span{display:block;width:100%;height:100%;transform:scaleX(0);transform-origin:left;background:linear-gradient(90deg,#ff6e78,#a16aff,#65baff);box-shadow:0 0 13px rgba(124,153,255,.9);animation:po115Progress 6.1s linear .2s both}
  #po115-cinematic .po115-skip{position:absolute;z-index:4;right:max(15px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));min-height:42px;padding:10px 16px;border:1px solid rgba(154,179,255,.4);border-radius:999px;background:rgba(5,8,19,.76);color:#f5f7ff;font:750 11px system-ui,sans-serif;letter-spacing:.08em;cursor:pointer;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
  #po115-cinematic.is-leaving{pointer-events:none;animation:po115Exit .56s ease-in forwards}
  #po115-cinematic.is-leaving .po115-content{animation:po115ExitContent .56s ease-in forwards}
  @keyframes po115Rise{from{opacity:0;transform:translateY(16px);filter:blur(6px)}to{opacity:1;transform:translateY(0);filter:blur(0)}}
  @keyframes po115Content{0%{transform:translateY(-1vh) scale(.975)}18%{transform:translateY(-1vh) scale(1)}86%{transform:translateY(-1vh) scale(1)}100%{transform:translateY(-.5vh) scale(1.01)}}
  @keyframes po115Progress{to{transform:scaleX(1)}}
  @keyframes po115Exit{to{opacity:0;visibility:hidden}}
  @keyframes po115ExitContent{to{opacity:0;transform:translateY(-10px) scale(.985);filter:blur(7px)}}
  @media(max-height:650px){#po115-cinematic .po115-title{font-size:clamp(32px,8vh,59px)}#po115-cinematic .po115-sub{margin-top:8px}#po115-cinematic .po115-line{margin-top:11px}#po115-cinematic .po115-tag{margin-top:8px}#po115-cinematic .po115-progress{margin-top:13px}}
  @media(max-width:420px){#po115-cinematic .po115-content{width:96vw;padding-inline:10px}#po115-cinematic .po115-title{letter-spacing:.12em}#po115-cinematic .po115-sub{letter-spacing:.16em}}
  @media(prefers-reduced-motion:reduce){#po115-cinematic *{animation-duration:.01ms!important;animation-delay:0ms!important}#po115-cinematic canvas{display:none}}
  `;

  function createOverlay(mode) {
    $('#po115-cinematic')?.remove();
    $('#po115-cinematic-style')?.remove();
    const data = labels[mode] || labels.SITE;
    const style = document.createElement('style');
    style.id = 'po115-cinematic-style';
    style.textContent = css;
    document.head.appendChild(style);
    const overlay = document.createElement('section');
    overlay.id = 'po115-cinematic';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-label', 'PAR ORDO Cinematic Experience');
    overlay.innerHTML = `
      <div class="po115-bg" aria-hidden="true"></div>
      <canvas aria-hidden="true"></canvas>
      <div class="po115-vignette" aria-hidden="true"></div>
      <div class="po115-content">
        <p class="po115-over"></p><h1 class="po115-title">PAR ORDO</h1>
        <p class="po115-sub"></p><div class="po115-line" aria-hidden="true"></div>
        <p class="po115-tag"></p><div class="po115-progress" aria-hidden="true"><span></span></div>
      </div>
      <button type="button" class="po115-skip">ПРОПУСТИТЬ →</button>`;
    $('.po115-over', overlay).textContent = data.over;
    $('.po115-sub', overlay).textContent = data.sub;
    $('.po115-tag', overlay).textContent = data.line;
    document.body.appendChild(overlay);
    return { overlay, style, canvas: $('canvas', overlay), mode };
  }

  function startParticles(canvas, overlay) {
    if (REDUCED || !canvas?.getContext) return () => {};
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return () => {};

    let w = 0, h = 0, dpr = 1, raf = 0, stopped = false, lastFrame = 0;
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 600;
    const narrow = window.innerWidth < 760;
    const deviceMemory = Number(navigator.deviceMemory || 8);
    const coarsePointer = !!window.matchMedia?.('(pointer: coarse)').matches;
    const lowPower = deviceMemory <= 4 || (coarsePointer && window.innerWidth < 1100);
    const count = mobile ? 900 : lowPower ? 1350 : narrow ? 1600 : 2200;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const particles = Array.from({ length: count }, (_, i) => {
      const y = 1 - (i / (count - 1)) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const a = golden * i;
      return {
        x: Math.cos(a) * ring,
        y,
        z: Math.sin(a) * ring,
        angle: a,
        band: i / count,
        strand: i % 2,
        along: (i * 0.61803398875) % 1,
        seed: Math.random() * 1000,
        size: .55 + Math.random() * 1.15,
        speed: .65 + Math.random() * .8,
        depth: Math.random()
      };
    });
    const stars = Array.from({ length: mobile ? 48 : 90 }, () => ({ x: Math.random(), y: Math.random(), r: .3 + Math.random() * .8, p: Math.random() * 6.28 }));

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      dpr = Math.min(mobile ? 1.05 : lowPower ? 1.2 : 1.4, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    const clamp01 = v => Math.max(0, Math.min(1, v));
    const smooth = (a, b, v) => { const q = clamp01((v - a) / (b - a)); return q * q * (3 - 2 * q); };
    const mix = (a, b, q) => a + (b - a) * q;
    const start = performance.now();

    function draw(now) {
      if (stopped || !overlay.isConnected) return;
      raf = requestAnimationFrame(draw);
      if (now - lastFrame < 30) return;
      lastFrame = now;

      const elapsed = (now - start) / 1000;
      const phase = clamp01(elapsed / (DURATION / 1000));
      const t = elapsed;
      ctx.clearRect(0, 0, w, h);

      const cx = w * .5;
      const cy = h * (narrow ? .405 : .405);
      const radius = Math.min(w * (narrow ? .43 : .265), h * .245, 285);
      const glow = ctx.createRadialGradient(cx, cy, radius * .05, cx, cy, radius * 1.9);
      glow.addColorStop(0, 'rgba(74,112,207,.16)');
      glow.addColorStop(.37, 'rgba(95,67,174,.09)');
      glow.addColorStop(.72, 'rgba(24,91,135,.035)');
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      // The field transforms through the same four visual stages seen in the reference clip.
      const toHelix = smooth(2.05, 3.25, t);
      const toWave = smooth(3.72, 5.05, t);
      const burst = smooth(5.72, 6.75, t);
      const objects = new Array(particles.length);
      const spin = t * .42;
      const helixHeight = Math.min(h * .47, w * .86, 570);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const wobble = 1 + .035 * Math.sin(p.angle * 3.5 + t * 2.2 + p.seed);
        const ox = p.x * radius * wobble;
        const oy = p.y * radius * .91 * wobble;
        const oz = p.z * radius * .9;
        const orbitX = ox * Math.cos(spin) - oz * Math.sin(spin);
        const orbitZ = ox * Math.sin(spin) + oz * Math.cos(spin);

        const strandPhase = p.along * Math.PI * 2 * 2.15 + spin * 1.5;
        const strandSign = p.strand ? 1 : -1;
        const hx = Math.sin(strandPhase + strandSign * .65) * radius * .39 + strandSign * Math.cos(p.along * Math.PI * 4 + t) * radius * .10;
        const hy = (p.along - .5) * helixHeight * 2.0;
        const hz = Math.cos(strandPhase + strandSign * .65) * radius * .38;

        const wx = (p.band - .5) * w * 1.42;
        const waveBase = h * .59;
        const wy = waveBase
          + Math.sin(p.band * 13.5 + t * 2.15 + p.seed * .012) * h * .072
          + Math.sin(p.band * 27 - t * 1.45 + p.seed * .021) * h * .018
          + (p.y * .10) * h;
        const wz = Math.cos(p.band * 9 + t * 1.2 + p.angle) * radius * .4;

        let x = mix(orbitX, hx, toHelix);
        let y = mix(oy, hy, toHelix);
        let z = mix(orbitZ, hz, toHelix);
        x = mix(x, wx, toWave);
        y = mix(y, wy - cy, toWave);
        z = mix(z, wz, toWave);

        const helixRotate = x * Math.cos(t * .16) - z * Math.sin(t * .16);
        z = x * Math.sin(t * .16) + z * Math.cos(t * .16);
        x = helixRotate;
        const perspective = 1.22 / (1.75 - z / (radius * 3.5));
        let px = cx + x * perspective;
        let py = cy + y * perspective;
        const dx = px - cx;
        const dy = py - cy;
        const distance = Math.hypot(dx, dy) || 1;
        const blast = burst * (radius * .72 + p.depth * radius * .45);
        px += dx / distance * blast;
        py += dy / distance * blast;
        objects[i] = { x: px, y: py, z, perspective, band: p.band, size: p.size, seed: p.seed };
      }

      // Delicate point-to-point filaments give the sphere and helix a woven particle skin.
      const linksPerParticle = mobile ? 1 : 2;
      ctx.lineWidth = .55;
      for (let i = 0; i < objects.length; i += 3) {
        const a = objects[i];
        if (a.perspective < .55) continue;
        for (let k = 1; k <= linksPerParticle; k++) {
          const b = objects[(i + k * 13) % objects.length];
          const dx = a.x - b.x, dy = a.y - b.y;
          if (dx * dx + dy * dy < (radius * .135) ** 2) {
            const alpha = (.025 + a.perspective * .055) * (1 - burst * .55);
            ctx.strokeStyle = a.band < .5 ? `rgba(255,137,82,${alpha})` : `rgba(91,166,255,${alpha})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }

      // Fine glow nodes. Left side is coral/red, right side electric blue, with violet blending above.
      for (let i = 0; i < objects.length; i++) {
        const p = objects[i];
        const pulse = .72 + .28 * Math.sin(now * .002 + p.seed);
        const r = (p.size + p.perspective * .62) * pulse * (1 + burst * .28);
        const alpha = Math.max(.06, Math.min(.92, (.2 + p.perspective * .48) * (1 - burst * .48)));
        const blend = clamp01((p.x / w) * .9 + .05);
        const orange = `rgba(255,${Math.round(112 + blend * 48)},${Math.round(66 + blend * 7)},${alpha})`;
        const blue = `rgba(${Math.round(75 + blend * 10)},${Math.round(153 + blend * 28)},255,${alpha})`;
        const color = blend < .48 ? orange : blue;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
        if (i % (mobile ? 34 : 26) === 0) {
          ctx.fillStyle = blend < .48 ? 'rgba(255,139,83,.13)' : 'rgba(111,166,255,.13)';
          ctx.beginPath(); ctx.arc(p.x, p.y, r * 4.2, 0, Math.PI * 2); ctx.fill();
        }
      }

      // A six-ridge flowing particle landscape emerges after the helix.
      const waveY = h * .70;
      const rows = mobile ? 5 : 7;
      for (let row = 0; row < rows; row++) {
        const rowShift = (row - (rows - 1) / 2) * h * .017;
        ctx.beginPath();
        for (let x = 0; x <= w + 3; x += mobile ? 5 : 4) {
          const u = x / w;
          const y = waveY + rowShift
            + Math.sin(u * 8.4 + t * 2.0 + row * .52) * h * .038
            + Math.sin(u * 18.0 - t * 1.35 + row) * h * .009;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = row % 2 ? 'rgba(99,153,255,.22)' : 'rgba(255,139,83,.21)';
        ctx.lineWidth = row === 2 ? 1.05 : .65;
        ctx.stroke();
        const dots = mobile ? 52 : 84;
        for (let j = 0; j < dots; j++) {
          const u = j / (dots - 1);
          const x = u * w;
          const y = waveY + rowShift
            + Math.sin(u * 8.4 + t * 2.0 + row * .52) * h * .038
            + Math.sin(u * 18.0 - t * 1.35 + row) * h * .009;
          const a = .14 + .48 * (.5 + .5 * Math.sin(now * .0017 + j * .48 + row));
          ctx.fillStyle = row % 2 ? `rgba(111,164,255,${a})` : `rgba(255,145,91,${a})`;
          ctx.beginPath(); ctx.arc(x, y, .5 + a * .7, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Brief bright core and radial particle release at the end of the sequence.
      if (burst > .01) {
        const coreR = radius * (.12 + burst * .42);
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 2.2);
        core.addColorStop(0, `rgba(235,241,255,${.26 * (1 - burst * .4)})`);
        core.addColorStop(.22, `rgba(112,165,255,${.16 * (1 - burst * .5)})`);
        core.addColorStop(1, 'rgba(80,110,255,0)');
        ctx.fillStyle = core;
        ctx.beginPath(); ctx.arc(cx, cy, coreR * 2.2, 0, Math.PI * 2); ctx.fill();
      }

      for (const star of stars) {
        const a = .08 + .23 * (.5 + .5 * Math.sin(now * .001 + star.p));
        ctx.fillStyle = `rgba(222,231,255,${a})`;
        ctx.beginPath(); ctx.arc(star.x * w, star.y * h, star.r, 0, Math.PI * 2); ctx.fill();
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
    if (current) {
      if (current.mode !== mode) queuedMode = mode;
      return current.promise;
    }
    if (now - lastPlayAt < 500) return Promise.resolve();
    lastPlayAt = now;

    const made = createOverlay(mode);
    const { overlay, style, canvas } = made;
    const stopParticles = startParticles(canvas, overlay);
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    let finished = false;
    let timer = null;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      stopParticles();
      overlay.classList.add('is-leaving');
      window.setTimeout(() => {
        overlay.remove(); style.remove();
        const next = queuedMode; queuedMode = null; current = null; resolve();
        if (next) window.setTimeout(() => play(next), 100);
      }, REDUCED ? 60 : 580);
    };
    current = { mode, overlay, promise, finish };
    $('.po115-skip', overlay).addEventListener('click', finish, { once: true });
    const onKey = e => { if (e.key === 'Escape' && current?.overlay === overlay) finish(); };
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
    try {
      if (sessionStorage.getItem('parordo_manager_portal_active') === '1' || manager?.classList.contains('active')) return 'MANAGER';
    } catch (_) { if (manager?.classList.contains('active')) return 'MANAGER'; }
    const home = $('#homeView');
    if (home?.classList.contains('active')) return 'STAFF';
    return manager ? '' : 'STAFF';
  }

  function syncPanelMode() {
    const next = currentPanelMode();
    if (!next) { activePanel = ''; return; }
    if (next !== activePanel) { activePanel = next; play(next); }
  }

  function watchCeoOverlay(node) {
    if (!node || node.dataset.po115Watching === '1') return;
    node.dataset.po115Watching = '1';
    const check = () => {
      const opened = node.classList.contains('po-ceo-open');
      if (opened && !ceoWasOpen) { ceoWasOpen = true; play('CEO'); }
      else if (!opened && ceoWasOpen) ceoWasOpen = false;
    };
    new MutationObserver(check).observe(node, { attributes: true, attributeFilter: ['class'] });
    check();
  }

  window.PARORDOCinematicHome = Object.freeze({ version: VERSION, play });

  const startSiteIntro = () => {
    play('SITE');
    if (appIsVisible()) window.setTimeout(syncPanelMode, REDUCED ? 1000 : DURATION + 650);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startSiteIntro, { once: true });
  else window.setTimeout(startSiteIntro, 80);

  const app = $('#appView');
  if (app) {
    let wasVisible = !app.classList.contains('hidden');
    new MutationObserver(() => {
      const visible = !app.classList.contains('hidden');
      if (visible && !wasVisible) window.setTimeout(syncPanelMode, 90);
      if (!visible) activePanel = '';
      wasVisible = visible;
    }).observe(app, { attributes: true, attributeFilter: ['class'] });
  }
  ['#homeView', '#managerView'].forEach(selector => {
    const node = $(selector);
    if (node) new MutationObserver(() => window.setTimeout(syncPanelMode, 50)).observe(node, { attributes: true, attributeFilter: ['class'] });
  });

  const existingCeo = $('#poCeoOverlay');
  if (existingCeo) watchCeoOverlay(existingCeo);
  new MutationObserver(records => {
    for (const record of records) for (const added of record.addedNodes) {
      if (added.nodeType !== 1) continue;
      if (added.id === 'poCeoOverlay') watchCeoOverlay(added);
      else if (added.querySelector) {
        const ceo = added.querySelector('#poCeoOverlay');
        if (ceo) watchCeoOverlay(ceo);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });

  if (appIsVisible()) window.setTimeout(syncPanelMode, 180);
})();
