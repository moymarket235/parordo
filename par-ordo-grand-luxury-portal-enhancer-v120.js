/*
 * PAR ORDO — GRAND LUXURY PORTAL ENHANCER V120
 * Site-entry-only finishing layer for the active V119 portal.
 * Adds procedural steam, a stronger final camera dive, warm portal flash,
 * and a cinematic login-card reveal. No panel observers or business logic.
 * No external libraries, CDN, API, Worker, database, or storage access.
 */
(() => {
  'use strict';

  const VERSION = '120';
  if (window.PARORDOPortalEnhancer?.version === VERSION) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    window.PARORDOPortalEnhancer = Object.freeze({ version: VERSION, reducedMotion: true });
    return;
  }

  const PORTAL_ID = 'po119-grand-portal';
  const PORTAL_DIVE_START_MS = 6500;
  const PORTAL_DIVE_MS = 1450;
  const $ = (selector, root = document) => root.querySelector(selector);
  let observer = null;
  let portalState = null;
  let completed = false;

  const style = document.createElement('style');
  style.id = 'po120-grand-portal-enhancer-style';
  style.textContent = `
    #${PORTAL_ID}.po120-diving .po119-scene-canvas,
    #${PORTAL_ID}.po120-diving .po119-particle-canvas,
    #${PORTAL_ID}.po120-diving .po120-steam-canvas {
      transform: scale(1.92);
      opacity: .12;
      transition: transform ${PORTAL_DIVE_MS}ms cubic-bezier(.14,.72,.12,1), opacity 900ms ease-out;
      transform-origin: 50% 50%;
    }
    #${PORTAL_ID} .po120-steam-canvas {
      position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%;
      display: block; pointer-events: none; mix-blend-mode: screen;
      opacity: .88; transition: opacity 550ms ease-out;
    }
    #${PORTAL_ID}.po120-diving .po119-content {
      animation: po120ContentDive ${PORTAL_DIVE_MS}ms cubic-bezier(.14,.72,.12,1) both !important;
    }
    #${PORTAL_ID}.po120-diving .po119-brandmark {
      animation: po120BrandIgnition 900ms cubic-bezier(.15,.78,.18,1) both !important;
    }
    #${PORTAL_ID}.po120-diving::after {
      content: ""; position: absolute; inset: -12%; z-index: 4; pointer-events: none;
      background: radial-gradient(circle at 50% 48%, rgba(255,246,220,.84) 0%, rgba(255,211,139,.52) 9%, rgba(238,153,63,.18) 25%, transparent 52%);
      opacity: 0; animation: po120PortalFlash 1050ms ease-out 210ms both;
    }
    #loginView.po120-login-arrive { position: relative; isolation: isolate; }
    #loginView.po120-login-arrive::before {
      content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none;
      background: radial-gradient(ellipse at 50% 48%, rgba(237,174,75,.14), transparent 54%);
      opacity: 0; animation: po120LoginAmbient 1800ms ease-out both;
    }
    #loginView .login-card.po120-login-arrive {
      position: relative; overflow: hidden; transform-origin: 50% 58%;
      box-shadow: 0 25px 78px rgba(0,0,0,.62), 0 0 0 1px rgba(244,190,94,.13), 0 0 44px rgba(216,151,59,.12), inset 0 1px 0 rgba(255,244,207,.08);
      animation: po120LoginCardEnter 980ms cubic-bezier(.16,.76,.2,1) both;
    }
    #loginView .login-card.po120-login-arrive::after {
      content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
      background: linear-gradient(112deg, transparent 27%, rgba(255,222,158,.12) 47%, rgba(255,246,214,.22) 50%, rgba(255,195,102,.09) 53%, transparent 72%);
      transform: translateX(-125%); animation: po120LoginShimmer 1250ms cubic-bezier(.18,.65,.22,1) 420ms both;
    }
    #loginView .login-card.po120-login-arrive > * {
      opacity: 0; animation: po120LoginItem 720ms cubic-bezier(.18,.72,.2,1) var(--po120-login-delay, 0ms) both;
    }
    #loginView .login-card.po120-login-arrive .login-logo {
      animation: po120LoginLogo 1050ms cubic-bezier(.16,.78,.2,1) 160ms both;
    }
    @keyframes po120ContentDive {
      0% { opacity: 1; transform: translateY(-1.8vh) scale(1); filter: blur(0); }
      45% { opacity: .92; transform: translateY(-1.8vh) scale(1.13); filter: blur(1px); }
      100% { opacity: 0; transform: translateY(-1.8vh) scale(1.48); filter: blur(13px); }
    }
    @keyframes po120BrandIgnition {
      0% { filter: brightness(1); }
      38% { filter: brightness(2.1) drop-shadow(0 0 23px rgba(255,226,156,.95)); }
      100% { filter: brightness(1.28) drop-shadow(0 0 15px rgba(255,197,100,.7)); }
    }
    @keyframes po120PortalFlash {
      0% { opacity: 0; transform: scale(.62); }
      36% { opacity: .92; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.42); }
    }
    @keyframes po120LoginAmbient { 0% { opacity: 0; } 35% { opacity: 1; } 100% { opacity: .24; } }
    @keyframes po120LoginCardEnter {
      0% { opacity: 0; transform: translate3d(0,30px,0) scale(.94); filter: blur(12px); }
      68% { opacity: 1; filter: blur(0); }
      100% { opacity: 1; transform: translate3d(0,0,0) scale(1); filter: none; }
    }
    @keyframes po120LoginItem {
      0% { opacity: 0; transform: translate3d(0,13px,0); filter: blur(5px); }
      100% { opacity: 1; transform: translate3d(0,0,0); filter: none; }
    }
    @keyframes po120LoginLogo {
      0% { opacity: 0; transform: scale(.72) rotate(-9deg); filter: blur(6px) brightness(1.8); }
      66% { opacity: 1; transform: scale(1.07) rotate(2deg); filter: blur(0) brightness(1.3) drop-shadow(0 0 20px rgba(255,196,87,.55)); }
      100% { opacity: 1; transform: scale(1) rotate(0); filter: none; }
    }
    @keyframes po120LoginShimmer { 0% { transform: translateX(-125%); opacity: 0; } 20% { opacity: 1; } 100% { transform: translateX(125%); opacity: 0; } }
    @media (max-width: 600px) {
      #${PORTAL_ID}.po120-diving .po119-scene-canvas,
      #${PORTAL_ID}.po120-diving .po119-particle-canvas,
      #${PORTAL_ID}.po120-diving .po120-steam-canvas { transform: scale(1.78); }
      #loginView .login-card.po120-login-arrive { width: min(100%, 430px); }
    }
    @media (prefers-reduced-motion: reduce) {
      #${PORTAL_ID} .po120-steam-canvas { display: none; }
      #loginView.po120-login-arrive::before { animation: none; opacity: 0; }
      #loginView .login-card.po120-login-arrive,
      #loginView .login-card.po120-login-arrive > * { animation: none !important; opacity: 1 !important; filter: none !important; transform: none !important; }
      #loginView .login-card.po120-login-arrive::after { display: none; }
    }
  `;
  document.head.appendChild(style);

  function createSteamCanvas(portal) {
    const canvas = document.createElement('canvas');
    canvas.className = 'po120-steam-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    const particleCanvas = $('.po119-particle-canvas', portal);
    if (particleCanvas?.parentNode) particleCanvas.parentNode.insertBefore(canvas, particleCanvas.nextSibling);
    else portal.appendChild(canvas);
    return canvas;
  }

  function startSteam(canvas, portal) {
    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return () => {};
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 720 || window.matchMedia('(pointer:coarse)').matches;
    const dprCap = mobile ? 1.05 : 1.3;
    const wisps = Array.from({ length: mobile ? 11 : 19 }, (_, i) => ({
      x: .5 + (Math.random() - .5) * (mobile ? .34 : .42),
      y: .56 + Math.random() * .24,
      height: .17 + Math.random() * .24,
      width: .035 + Math.random() * .045,
      phase: Math.random() * Math.PI * 2,
      speed: .22 + Math.random() * .42,
      drift: (Math.random() - .5) * .035,
      alpha: .035 + Math.random() * .04,
      seed: i * .77 + Math.random() * 2
    }));
    let width = 1, height = 1, raf = 0, stopped = false, last = 0;
    const resize = () => {
      width = Math.max(1, canvas.clientWidth || window.innerWidth);
      height = Math.max(1, canvas.clientHeight || window.innerHeight);
      const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });
    const startAt = performance.now();

    function draw(now) {
      if (stopped || !portal.isConnected) return;
      raf = requestAnimationFrame(draw);
      if (document.hidden || now - last < 42) return;
      last = now;
      const t = (now - startAt) * .001;
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.filter = mobile ? 'blur(9px)' : 'blur(13px)';
      for (const w of wisps) {
        const sway = Math.sin(t * w.speed + w.phase) * width * w.drift;
        const x0 = width * w.x + sway;
        const y0 = height * w.y;
        const rise = height * w.height;
        const x1 = x0 + Math.sin(t * w.speed * .7 + w.phase) * width * w.drift * 1.9;
        const x2 = x0 + Math.cos(t * w.speed * .52 + w.seed) * width * w.drift * 1.35;
        const alpha = w.alpha * (.65 + .35 * Math.sin(t * .8 + w.phase));
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.bezierCurveTo(x0 - width * w.width, y0 - rise * .28, x1 + width * w.width, y0 - rise * .62, x2, y0 - rise);
        ctx.strokeStyle = `rgba(244,218,176,${alpha})`;
        ctx.lineWidth = width * w.width * .54;
        ctx.lineCap = 'round';
        ctx.shadowColor = 'rgba(240,187,111,.32)';
        ctx.shadowBlur = mobile ? 18 : 25;
        ctx.stroke();
      }
      ctx.filter = 'none';
      // Low, translucent vapor banks create depth below the portal ring.
      for (let i = 0; i < 5; i++) {
        const drift = Math.sin(t * .22 + i * 1.7) * width * .035;
        const x = width * (.27 + i * .115) + drift;
        const y = height * (.70 + Math.sin(t * .19 + i) * .018);
        const radius = Math.min(width, height) * (.075 + (i % 3) * .018);
        const g = ctx.createRadialGradient(x, y, radius * .08, x, y, radius);
        g.addColorStop(0, 'rgba(242,211,166,.055)');
        g.addColorStop(.48, 'rgba(224,184,126,.025)');
        g.addColorStop(1, 'rgba(224,184,126,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, radius * 1.45, radius * .42, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    raf = requestAnimationFrame(draw);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.remove();
    };
  }

  function revealLogin() {
    if (completed) return;
    completed = true;
    const loginView = $('#loginView');
    const card = $('#loginForm.login-card', loginView || document);
    if (!loginView || !card || loginView.classList.contains('hidden')) return;
    loginView.classList.add('po120-login-arrive');
    card.classList.add('po120-login-arrive');
    Array.from(card.children).forEach((child, index) => {
      child.style.setProperty('--po120-login-delay', `${220 + Math.min(index, 8) * 85}ms`);
    });
    window.setTimeout(() => {
      loginView.classList.remove('po120-login-arrive');
      card.classList.remove('po120-login-arrive');
      Array.from(card.children).forEach(child => child.style.removeProperty('--po120-login-delay'));
    }, 2600);
  }

  function enhancePortal(portal) {
    if (!portal || portal.dataset.po120Enhanced === '1') return;
    portal.dataset.po120Enhanced = '1';
    const steamCanvas = createSteamCanvas(portal);
    const stopSteam = startSteam(steamCanvas, portal);
    let diveTimer = window.setTimeout(() => {
      if (portal.isConnected) portal.classList.add('po120-diving');
    }, PORTAL_DIVE_START_MS);
    portalState = { portal, stopSteam, diveTimer };
  }

  function portalRemoved(portal) {
    if (!portal || portal.id !== PORTAL_ID) return;
    if (portalState?.portal === portal) {
      clearTimeout(portalState.diveTimer);
      portalState.stopSteam();
      portalState = null;
    }
    revealLogin();
    observer?.disconnect();
    observer = null;
  }

  function scanNode(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.id === PORTAL_ID) enhancePortal(node);
    else {
      const nested = node.querySelector?.(`#${PORTAL_ID}`);
      if (nested) enhancePortal(nested);
    }
  }

  // V119 mounts its full-screen site intro after DOMContentLoaded; observe only that portal.
  observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.addedNodes) scanNode(node);
      for (const node of record.removedNodes) {
        if (node.nodeType === 1 && node.id === PORTAL_ID) portalRemoved(node);
      }
    }
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  const existing = $(`#${PORTAL_ID}`);
  if (existing) enhancePortal(existing);

  window.PARORDOPortalEnhancer = Object.freeze({ version: VERSION });
})();
