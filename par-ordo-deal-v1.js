/* PAR ORDO PRO — DEAL V1 · «Браслет таратуу»
   Opening of the «Номера и клиенты» screen: every visible card (hero, смена, CLEAN CONTROL,
   QR сканер, KPI, база клиентов, браслеты) gathers into a PAR ORDO deck in the middle of the
   screen and is dealt back to its place, turning face-up in flight. Cards below the fold are
   dealt the first time they scroll into view; a card is never dealt twice in one session.
   - After login it replaces the vault's «arrive» step (par-ordo-vault-v1.js calls PARORDODeal.arrive).
   - When the panel opens with a saved session, it waits for the data, then deals.
   Decoration only: no API, login, shift or bracelet logic is touched. Web Animations API on
   transform/opacity; every helper node is removed when done. If anything fails, the normal
   screen is shown at once. */
(() => {
  'use strict';
  if (window.PARORDODeal) return;

  const root = document.documentElement;
  const ARMED = 'po-deal-armed';
  const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const canAnimate = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const EASE = {
    out: 'cubic-bezier(.16,1,.3,1)',
    gather: 'cubic-bezier(.2,.8,.3,1)',
    toEdge: 'cubic-bezier(.45,0,.85,.55)',
    land: 'cubic-bezier(.18,1.1,.32,1)',
    spring: 'cubic-bezier(.34,1.56,.64,1)'
  };
  const T = { gather: 380, gatherStep: 28, hold: 110, dealStep: 115, flight: 780, maxCards: 14 };
  const FAN = [-5, 3, -2, 4, -4, 2, -3, 5];
  const DECK_AREA = 175 * 230;

  const CARD_SEL = [
    '#homeView > .hero',
    '#shiftControl .shift-control-card',
    '#poCleanControlLauncherV83',
    '#goScannerQuickWrap:not([hidden]) .go-scanner-quick',
    '#homeKpis > .kpi',
    '#homeView .customer-base-launch',
    '#roomsGrid > .room'
  ].join(',');
  const SOFT_SEL = '#homeView > .section-head, #homeView > .filters';

  let playing = false;
  let waiting = false;
  let deckEl = null;
  let io = null;
  const seen = new Set();
  const live = new Set();

  const disarm = () => root.classList.remove(ARMED);

  /* A stable name per card, so a re-rendered card is recognised. */
  function keyOf(el) {
    const index = () => (el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0);
    if (el.matches('#roomsGrid > .room')) {
      const n = el.querySelector('.band-number-overlay');
      return 'room:' + ((n && n.textContent.trim()) || index());
    }
    if (el.matches('#homeKpis > .kpi')) {
      const k = Array.from(el.classList).find(c => /^kpi-(clients|cash|transfer|total)$/.test(c));
      return 'kpi:' + (k || index());
    }
    if (el.id) return '#' + el.id;
    const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
    return c ? '.' + c : el.tagName;
  }

  /* The free area between the sticky header and the bottom bar; its centre holds the deck. */
  function bounds() {
    const hdr = $('#appView .header');
    const nav = $('.bottom-nav');
    let top = 0;
    let bottom = innerHeight;
    if (hdr) {
      const r = hdr.getBoundingClientRect();
      if (r.height) top = clamp(r.bottom, 0, innerHeight * 0.4);
    }
    if (nav && getComputedStyle(nav).display !== 'none') {
      const r = nav.getBoundingClientRect();
      if (r.height && r.top > innerHeight * 0.5) bottom = r.top;
    }
    /* centre of the content column (on a PC the side menu is left out) */
    let cx = innerWidth / 2;
    const view = $('#homeView');
    if (view) {
      const r = view.getBoundingClientRect();
      if (r.width > 0) cx = clamp(r.left + r.width / 2, 0, innerWidth);
    }
    return { top, bottom, cx, cy: (top + bottom) / 2 };
  }

  function inView(el, b) {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > b.top + 6 && r.top < b.bottom - 6;
  }

  const tf = (P, x, y, rz, ry, s) =>
    `perspective(${P}px) translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) rotate(${rz}deg) rotateY(${ry}deg) scale(${s.toFixed(3)})`;

  /* Give a card its temporary back face. */
  function prep(el) {
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const saved = { position: el.style.position, zIndex: el.style.zIndex, backface: el.style.backfaceVisibility };
    if (cs.position === 'static') el.style.position = 'relative';
    el.style.backfaceVisibility = 'visible';
    const back = document.createElement('span');
    back.className = 'po-deal-back';
    back.setAttribute('aria-hidden', 'true');
    back.style.borderRadius = cs.borderRadius;
    back.style.setProperty('--po-deal-logo', Math.round(clamp(Math.min(rect.height * 0.46, rect.width * 0.36), 26, 72)) + 'px');
    back.appendChild(document.createElement('i'));
    el.appendChild(back);
    const p = { el, back, rect, saved };
    live.add(p);
    return p;
  }

  function restore(p) {
    if (!live.has(p)) return;
    live.delete(p);
    p.back.remove();
    p.el.style.position = p.saved.position;
    p.el.style.zIndex = p.saved.zIndex;
    p.el.style.backfaceVisibility = p.saved.backface;
  }

  /* Landing accents */
  function pop(node, from, ms) {
    const base = getComputedStyle(node).transform;
    const b = base && base !== 'none' ? base : '';
    node.animate([
      { transform: (b + ' scale(' + from + ')').trim(), filter: 'brightness(1.7)' },
      { transform: b || 'none', filter: 'brightness(1)' }
    ], { duration: ms, easing: EASE.spring });
  }

  function flash(parent, cls, keyframes, opts) {
    const n = document.createElement('i');
    n.className = cls;
    n.setAttribute('aria-hidden', 'true');
    parent.appendChild(n);
    const done = () => n.remove();
    n.animate(keyframes, opts).finished.then(done, done);
  }

  function land(el) {
    if (!el.isConnected) return;
    try {
      if (el.matches('#roomsGrid > .room')) {
        const num = el.querySelector('.band-number-overlay');
        if (num) pop(num, 1.85, 720);
        const photo = el.querySelector('.room-visual');
        if (photo) flash(photo, 'po-deal-glint', [
          { transform: 'translateX(-120%) skewX(-18deg)' },
          { transform: 'translateX(270%) skewX(-18deg)' }
        ], { duration: 900, easing: 'cubic-bezier(.4,0,.2,1)' });
        if (el.classList.contains('active')) flash(el, 'po-deal-rim', [
          { opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }
        ], { duration: 1300, easing: 'ease-out' });
      } else {
        const badge = el.querySelector('.live-badge');
        if (badge) pop(badge, 1.22, 640);
        const icon = el.querySelector('.kpi-icon,.po-cc-icon,.go-scanner-quick-icon,.customer-base-launch-icon');
        if (icon) pop(icon, 1.35, 620);
      }
    } catch (_) { /* accents are optional */ }
  }

  /* Waiting deck */
  function showDeck() {
    if (deckEl || reduced || !document.body) return;
    const b = bounds();
    deckEl = document.createElement('div');
    deckEl.className = 'po-deal-deck';
    deckEl.setAttribute('aria-hidden', 'true');
    deckEl.style.top = Math.round(b.cy) + 'px';
    deckEl.style.left = Math.round(b.cx) + 'px';
    deckEl.innerHTML = '<span></span><span></span><span><i></i></span>';
    document.body.appendChild(deckEl);
  }

  function fadeDeck(fast) {
    const d = deckEl;
    deckEl = null;
    if (!d) return;
    if (fast || !canAnimate) { d.remove(); return; }
    const done = () => d.remove();
    d.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.9)' }],
      { duration: 320, easing: 'ease-out', fill: 'forwards' }).finished.then(done, done);
  }

  /* The deal */
  function deal(opts) {
    opts = opts || {};
    const view = $('#homeView');
    if (playing || reduced || !canAnimate || !view || !view.classList.contains('active')) {
      disarm();
      fadeDeck(true);
      return false;
    }
    playing = true;
    const anims = [];
    try {
      const b = bounds();
      const cards = $$(CARD_SEL).filter(el => inView(el, b)).slice(0, T.maxCards);
      const soft = $$(SOFT_SEL).filter(el => inView(el, b));
      cards.forEach(el => seen.add(keyOf(el)));
      soft.forEach(el => seen.add(keyOf(el)));
      const preps = cards.map(prep);
      const n = preps.length;
      const dealAt = Math.max(0, n - 1) * T.gatherStep + T.gather + T.hold;
      let end = 0;

      preps.forEach((p, i) => {
        const w = Math.max(1, p.rect.width);
        const h = Math.max(1, p.rect.height);
        const dx = b.cx - (p.rect.left + w / 2);
        const dy = b.cy - (p.rect.top + h / 2);
        const s = clamp(Math.sqrt(DECK_AREA / (w * h)), 0.5, 0.86);
        const rz = FAN[i % FAN.length];
        const P = Math.round(Math.max(900, w * 3));
        const startA = (n - 1 - i) * T.gatherStep;       /* the first card to be dealt lands on top */
        const startB = dealAt + i * T.dealStep;
        const dur = startB + T.flight - startA;
        const o1 = T.gather / dur;
        const o2 = (startB - startA) / dur;
        const o3 = o2 + (T.flight * 0.36) / dur;          /* edge-on: the back face swaps for the front */
        const deck = tf(P, dx, dy, rz, 180, s);
        p.el.style.zIndex = String(Math.max(1, 19 - i));
        const a = p.el.animate([
          { offset: 0, transform: tf(P, dx, dy - 70, rz, 180, s), opacity: 0, easing: 'ease-out' },
          { offset: o1 * 0.35, transform: tf(P, dx, dy - 34, rz, 180, s), opacity: 1, easing: EASE.gather },
          { offset: o1, transform: deck, opacity: 1, easing: 'linear' },
          { offset: o2, transform: deck, opacity: 1, easing: EASE.toEdge },
          { offset: o3, transform: tf(P, dx * 0.5, dy * 0.5 - 28, rz * 0.4, 90, ((s + 1) / 2) * 1.04), opacity: 1, easing: EASE.land },
          { offset: 1, transform: tf(P, 0, 0, 0, 0, 1), opacity: 1 }
        ], { duration: dur, delay: startA, fill: 'backwards' });
        const back = p.back.animate([
          { offset: 0, opacity: 1 },
          { offset: o3, opacity: 1 },
          { offset: Math.min(1, o3 + 0.0005), opacity: 0 },
          { offset: 1, opacity: 0 }
        ], { duration: dur, delay: startA, fill: 'both' });
        anims.push(a, back);
        end = Math.max(end, startA + dur);
        a.finished.then(() => { restore(p); land(p.el); }, () => restore(p));
      });

      soft.forEach(el => {
        const before = preps.filter(p => p.el.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).length;
        const delay = dealAt + Math.max(0, before - 1) * T.dealStep + 380;
        anims.push(el.animate(
          [{ opacity: 0, transform: 'translate3d(0,14px,0)' }, { opacity: 1, transform: 'none' }],
          { duration: 520, delay, easing: EASE.out, fill: 'backwards' }
        ));
      });

      if (opts.chrome) {
        const hdr = $('#appView .header');
        const nav = $('.bottom-nav');
        if (hdr) anims.push(hdr.animate([{ transform: 'translate3d(0,-110%,0)' }, { transform: 'none' }],
          { duration: 640, delay: 60, easing: EASE.out, fill: 'backwards' }));
        if (nav && getComputedStyle(nav).display !== 'none') anims.push(nav.animate([{ transform: 'translate3d(0,110%,0)' }, { transform: 'none' }],
          { duration: 640, delay: 140, easing: EASE.out, fill: 'backwards' }));
      }

      fadeDeck();
      disarm();
      setTimeout(() => { playing = false; live.forEach(restore); }, end + 160);
      return true;
    } catch (e) {
      console.warn('PAR ORDO deal', e);
      anims.forEach(a => { try { a.cancel(); } catch (_) {} });
      live.forEach(restore);
      playing = false;
      disarm();
      fadeDeck(true);
      return false;
    }
  }

  /* A card that scrolls into view for the first time is dealt from below. */
  function reveal(el, delay) {
    try {
      if (el.matches(SOFT_SEL)) {
        el.animate([{ opacity: 0, transform: 'translate3d(0,16px,0)' }, { opacity: 1, transform: 'none' }],
          { duration: 560, delay, easing: EASE.out, fill: 'backwards' });
        return;
      }
      const p = prep(el);
      const P = Math.round(Math.max(900, p.rect.width * 3));
      const dur = 760;
      const a = el.animate([
        { offset: 0, transform: tf(P, 0, 70, 0, 180, 0.88), opacity: 0, easing: 'cubic-bezier(.3,.6,.6,1)' },
        { offset: 0.18, transform: tf(P, 0, 56, 0, 180, 0.9), opacity: 1, easing: EASE.toEdge },
        { offset: 0.48, transform: tf(P, 0, 22, 0, 90, 0.96), opacity: 1, easing: EASE.land },
        { offset: 1, transform: tf(P, 0, 0, 0, 0, 1), opacity: 1 }
      ], { duration: dur, delay, fill: 'backwards' });
      p.back.animate([
        { offset: 0, opacity: 1 }, { offset: 0.48, opacity: 1 }, { offset: 0.4805, opacity: 0 }, { offset: 1, opacity: 0 }
      ], { duration: dur, delay, fill: 'both' });
      a.finished.then(() => { restore(p); land(el); }, () => restore(p));
    } catch (_) { /* the card simply stays as it is */ }
  }

  function initReveal() {
    if (io || reduced || !canAnimate || !('IntersectionObserver' in window)) return;
    io = new IntersectionObserver(entries => {
      const hits = [];
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        const key = keyOf(en.target);
        if (seen.has(key)) return;
        seen.add(key);
        /* seen during the opening, behind the vault or in a hidden tab: shown without motion */
        if (playing || document.hidden || root.classList.contains(ARMED) || root.classList.contains('po-vault-on')) return;
        hits.push(en.target);
      });
      if (!hits.length) return;
      hits.sort((a, c) => {
        const ra = a.getBoundingClientRect();
        const rc = c.getBoundingClientRect();
        return (ra.top - rc.top) || (ra.left - rc.left);
      });
      hits.forEach((el, k) => reveal(el, Math.min(k, 8) * 75));
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    const scan = () => {
      if (!io) return;
      $$(CARD_SEL + ',' + SOFT_SEL).forEach(el => { if (!seen.has(keyOf(el))) io.observe(el); });
    };
    scan();
    ['#roomsGrid', '#homeKpis', '#shiftControl', '#homeView'].forEach(sel => {
      const node = $(sel);
      if (node) new MutationObserver(scan).observe(node, { childList: true });
    });
  }

  /* The panel has its data: KPI tiles and bracelets are rendered only after bootApp() loads it. */
  function isReady() {
    const view = $('#homeView');
    return !!(view && view.classList.contains('active') && $('#roomsGrid > .room') && $('#homeKpis > .kpi'));
  }

  /* Keep the cards face-down on the waiting deck until the data is in and the DOM is quiet, then deal.
     A tap, key or scroll while waiting cancels the opening and shows the panel at once. */
  function waitAndDeal(opts) {
    if (waiting) return true;
    if (reduced || !canAnimate) { disarm(); return false; }
    waiting = true;
    root.classList.add(ARMED);
    showDeck();
    const view = $('#homeView');
    const events = ['pointerdown', 'keydown', 'wheel', 'touchmove'];
    let done = false;
    let quiet = 0;
    let maxWait = 0;
    let mo = null;
    const finish = go => {
      if (done) return;
      done = true;
      waiting = false;
      clearTimeout(quiet);
      clearTimeout(maxWait);
      if (mo) mo.disconnect();
      events.forEach(t => removeEventListener(t, abort, true));
      if (go && root.classList.contains(ARMED) && isReady()) deal(opts);
      else { disarm(); fadeDeck(); }
    };
    const abort = () => finish(false);
    const check = () => {
      clearTimeout(quiet);
      if (isReady()) quiet = setTimeout(() => finish(true), 220);
    };
    if (view) {
      mo = new MutationObserver(check);
      mo.observe(view, { childList: true, subtree: true });
    }
    maxWait = setTimeout(() => finish(true), 4600);
    events.forEach(t => addEventListener(t, abort, { capture: true, passive: true }));
    check();
    return true;
  }

  /* Called by the vault when its door opens. With the data already in, the header, bar and cards
     arrive together under the fading vault; otherwise the cards wait face-down for the data. */
  function arrive(o) {
    if (playing) return false;
    if (isReady()) return deal(Object.assign({ chrome: true }, o || {}));
    return waitAndDeal(Object.assign({}, o || {}, { chrome: false }));
  }

  /* Opening with a saved session (the head of index.html has already turned the cards face-down). */
  function autoBoot() {
    if (!root.classList.contains(ARMED)) return;
    waitAndDeal({ source: 'boot' });
  }

  window.PARORDODeal = Object.freeze({
    version: '1.0.0',
    play: () => deal({ source: 'manual' }),
    arrive: arrive,
    playing: () => playing
  });

  const start = () => {
    try { autoBoot(); } catch (e) { console.warn('PAR ORDO deal', e); disarm(); fadeDeck(true); }
    try { initReveal(); } catch (_) { /* reveal is optional */ }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
