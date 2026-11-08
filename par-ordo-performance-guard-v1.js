/*
 * PAR ORDO PERFORMANCE GUARD V1
 * Desktop-only startup optimization for the existing V119 + V121 grand portal.
 * - Skips the synchronous WebGL shader compile on desktop/fine-pointer devices.
 * - Uses the portal's already-existing lightweight 2D fallback renderer instead.
 * - Caps DPR at 1.0 only while the desktop intro is active.
 * - Skips V121's second blurred steam canvas on desktop (V119 fallback retains rings/embers/waves).
 * - Restores all patched browser APIs as soon as the portal is removed (12s fail-safe).
 * Mobile/tablet coarse-pointer rendering remains unchanged.
 * No API, Worker, D1, authentication, inventory, or business-logic access.
 */
(() => {
  'use strict';

  const VERSION = '1.0.0';
  if (window.PARORDOPerformanceGuard?.version === VERSION) return;

  const isDesktop = (() => {
    try {
      return !!window.matchMedia('(min-width: 701px) and (pointer: fine)').matches;
    } catch (_) {
      return Number(window.innerWidth || 0) >= 900;
    }
  })();

  if (!isDesktop || !window.HTMLCanvasElement?.prototype) {
    window.PARORDOPerformanceGuard = Object.freeze({
      version: VERSION,
      mode: 'native-mobile-or-touch',
      active: false
    });
    return;
  }

  const PORTAL_ID = 'po119-grand-portal';
  const STEAM_CLASS = 'po121-steam-canvas';
  const originalContextDescriptor = Object.getOwnPropertyDescriptor(
    HTMLCanvasElement.prototype,
    'getContext'
  );
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalDprDescriptor = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
  const originalDpr = Number(window.devicePixelRatio || 1);
  let contextPatched = false;
  let dprPatched = false;
  let restored = false;
  let failSafeTimer = 0;
  let observer = null;

  const style = document.createElement('style');
  style.id = 'po-performance-guard-v1-style';
  style.textContent = `
    @media (min-width:701px) and (pointer:fine) {
      #${PORTAL_ID} .po119-scene-canvas { display:none!important; }
      #${PORTAL_ID} .po119-particle-canvas { mix-blend-mode:normal!important; }
      #${PORTAL_ID} .po119-beam { mix-blend-mode:normal!important; }
      #${PORTAL_ID} .po119-skip {
        -webkit-backdrop-filter:none!important;
        backdrop-filter:none!important;
      }
      #${PORTAL_ID} .${STEAM_CLASS} { display:none!important; }
      #${PORTAL_ID}.po121-diving .po119-scene-canvas,
      #${PORTAL_ID}.po121-diving .po119-particle-canvas,
      #${PORTAL_ID}.po121-diving .${STEAM_CLASS} {
        transition-duration:850ms!important;
      }
      #${PORTAL_ID}.po121-diving .po119-content { filter:none!important; }
      #loginView.po121-login-arrive,
      #loginView .login-card.po121-login-arrive,
      #loginView .login-card.po121-login-arrive > * {
        filter:none!important;
      }
    }
  `;
  document.head?.appendChild(style);

  function restore() {
    if (restored) return;
    restored = true;
    if (failSafeTimer) window.clearTimeout(failSafeTimer);
    try { observer?.disconnect(); } catch (_) {}
    observer = null;

    if (contextPatched) {
      try {
        if (originalContextDescriptor) {
          Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', originalContextDescriptor);
        } else {
          HTMLCanvasElement.prototype.getContext = originalGetContext;
        }
      } catch (_) {
        try { HTMLCanvasElement.prototype.getContext = originalGetContext; } catch (_) {}
      }
    }

    if (dprPatched) {
      try {
        if (originalDprDescriptor) {
          Object.defineProperty(window, 'devicePixelRatio', originalDprDescriptor);
        } else {
          delete window.devicePixelRatio;
        }
      } catch (_) {}
    }

    style.remove();
    window.PARORDOPerformanceGuard = Object.freeze({
      version: VERSION,
      mode: 'desktop-2d-light-complete',
      active: false
    });
  }

  // The existing V119 renderer requests WebGL on this exact scene canvas.
  // Returning null makes V119 take its own built-in 2D fallback path, avoiding
  // synchronous shader compilation on the page's first visible frame.
  try {
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      enumerable: originalContextDescriptor?.enumerable ?? false,
      writable: true,
      value: function (type, ...args) {
        const kind = String(type || '').toLowerCase();
        if (this?.classList?.contains('po119-scene-canvas') &&
            (kind === 'webgl' || kind === 'experimental-webgl' || kind === 'webgl2')) {
          this.style.setProperty('display', 'none', 'important');
          this.dataset.poDesktopFallback = '1';
          return null;
        }
        // V121's independent steam renderer adds another blurred canvas loop.
        // V119's own scene already contains steam, so skip this duplicate only on desktop.
        if (this?.classList?.contains(STEAM_CLASS) && kind === '2d') return null;
        return originalGetContext.apply(this, [type, ...args]);
      }
    });
    contextPatched = true;
  } catch (_) {
    // If the browser locks this prototype, keep the native renderer rather than
    // risking a broken page.
  }

  // The existing V119 fallback is CPU/2D-based. Keep its backing canvas at a
  // sensible desktop pixel ratio while the intro is on screen, then restore DPR.
  try {
    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      enumerable: originalDprDescriptor?.enumerable ?? true,
      get: () => Math.min(originalDpr, 1.0)
    });
    dprPatched = true;
  } catch (_) {}

  observer = new MutationObserver(records => {
    for (const record of records) {
      for (const node of record.removedNodes || []) {
        if (node?.nodeType === 1 &&
            (node.id === PORTAL_ID || node.querySelector?.(`#${PORTAL_ID}`))) {
          restore();
          return;
        }
      }
    }
  });
  if (document.documentElement) {
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // V119 intro lasts 8.2s plus its 690ms exit. This is only a safety release.
  failSafeTimer = window.setTimeout(restore, 12000);

  window.PARORDOPerformanceGuard = Object.freeze({
    version: VERSION,
    mode: 'desktop-2d-light-active',
    active: true,
    target: 'V119 desktop portal only'
  });
})();
