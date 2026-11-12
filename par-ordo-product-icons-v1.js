/* PAR ORDO PRO · PRODUCT ICONS V1 — живые иконки товаров.

   Каждый товар получает свою анимированную SVG-иконку по названию: банка с газом, бутылка с волной,
   кружка с пеной, пиала с паром, качающийся веник, шорты на ветру, мыло с пузырями, спрей с облаком…
   Цвет, узор и ритм движения ещё и зависят от самого названия, поэтому одинаковых иконок нет.
   Название товара на иконке не пишется. Загруженное фото товара (https/data) остаётся, с бликом.

   Заменяет par-ordo-product-visuals-v8.js. Иконки двигаются только на экране (IntersectionObserver);
   при prefers-reduced-motion — неподвижные.
   Install: <script src="./par-ordo-product-icons-v1.js?v=1.0.0" defer></script> before par-ordo-product-admin-v9.js
            <link rel="stylesheet" href="./par-ordo-product-icons-v1.css?v=1.0.0"> */
(() => {
  'use strict';
  if (window.PARORDOProductIcons) return;

  const VERSION = '1.0.0';
  const reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const norm = v => String(v || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  const f1 = n => Math.round(n * 10) / 10;
  let UID = 0;

  /* ---------- seeded randomness: the same name always moves the same way ---------- */
  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed || 1;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const between = (R, a, b) => a + (b - a) * R();

  /* ---------- colour ---------- */
  function hexHsl(hex) {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60;
    }
    return [h, s * 100, l * 100];
  }
  function hslHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
    const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
    return '#' + f(0) + f(8) + f(4);
  }
  const tone = (hex, dl, dh = 0, ds = 0) => { const [h, s, l] = hexHsl(hex); return hslHex(h + dh, s + ds, l + dl); };
  function palette(main, accent, extra) {
    return Object.assign({ a: main, l: tone(main, 16), d: tone(main, -18), c: accent || tone(main, 30, 25), g: main }, extra || {});
  }

  /* ---------- shared pieces ---------- */
  const shadow = (rx = 14) => `<ellipse cx="32" cy="57.6" rx="${rx}" ry="2.3" fill="#000" opacity=".42"/>`;
  const v = o => Object.entries(o).map(([k, x]) => `--${k}:${x}`).join(';');
  function bubbles(R, n, x0, x1, y, rise, r0, r1, color, op = .85) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const d = between(R, 1.6, 3.2);
      s += `<circle class="pi-bub" cx="${f1(between(R, x0, x1))}" cy="${f1(y - between(R, 0, 3))}" r="${f1(between(R, r0, r1))}" fill="${color}" opacity="${op}" style="${v({ rise: f1(between(R, rise * .7, rise)) + 'px', sx: f1(between(R, -2.4, 2.4)) + 'px', d: f1(d) + 's', dl: f1(-between(R, 0, d)) + 's' })}"/>`;
    }
    return s;
  }
  function steam(R, xs, y, color = '#fff', h = 9) {
    return xs.map(x => {
      const d = between(R, 2.2, 3.4);
      return `<path class="pi-steam" d="M${x} ${y}c-2.2-2.4 2.2-4.2 0-6.6s2.2-4.2 0-${f1(h - 6.6)}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" opacity=".75" style="${v({ d: f1(d) + 's', dl: f1(-between(R, 0, d)) + 's' })}"/>`;
    }).join('');
  }
  function sparkles(R, n, box = [8, 6, 56, 30]) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = between(R, box[0], box[2]), y = between(R, box[1], box[3]), r = between(R, 1.6, 2.6), d = between(R, 1.8, 3.2);
      s += `<path class="pi-tw" d="M${f1(x)} ${f1(y - r)}Q${f1(x)} ${f1(y)} ${f1(x + r)} ${f1(y)}Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y + r)}Q${f1(x)} ${f1(y)} ${f1(x - r)} ${f1(y)}Q${f1(x)} ${f1(y)} ${f1(x)} ${f1(y - r)}z" fill="#fff6dc" style="${v({ d: f1(d) + 's', dl: f1(-between(R, 0, d)) + 's' })}"/>`;
    }
    return s;
  }
  const shine = (u, d = 4.6) => `<g transform="skewX(-16)"><rect class="pi-shine" x="2" y="0" width="7" height="64" fill="#fff" opacity=".32" style="--d:${d}s"/></g>`;
  const lin = (id, stops, vertical) => `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}">${stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')}</linearGradient>`;
  const drop = (x, y, s = 1) => `M${x} ${y}c${f1(-1.6 * s)} ${f1(2.4 * s)} ${f1(-2.4 * s)} ${f1(3.6 * s)} ${f1(-2.4 * s)} ${f1(4.8 * s)}a${f1(2.4 * s)} ${f1(2.4 * s)} 0 0 0 ${f1(4.8 * s)} 0c0 ${f1(-1.2 * s)} ${f1(-.8 * s)} ${f1(-2.4 * s)} ${f1(-2.4 * s)} ${f1(-4.8 * s)}z`;

  /* =====================================================================
     the drawings — viewBox 0 0 64 64, the object stands on y≈57
     ===================================================================== */
  const K = {};

  K.can = (P, R, u, x) => {
    const energy = x === 'energy';
    const band = energy
      ? `<path class="pi-pulse" d="M34.5 24.5 26.5 36h5.2l-2.4 9.5 8.6-12.4h-5.2l2.6-8.6z" fill="${P.c}" stroke="#fff" stroke-opacity=".55" stroke-width=".6" style="--d:1.6s"/>`
      : `<path d="M20 30.5c5-3 10 3 24-1v8.5c-12 4-17-2-24 1z" fill="${P.c}"/><path d="M20 38.7c7-2.6 12 2.8 24-1" stroke="${P.b || '#fff'}" stroke-width=".9" fill="none" opacity=".75"/>${x === 'mint' ? `<path d="M37 33c2-3 5-3 6-2-1 3-4 3-6 2z" fill="#7fe08a"/><path d="M36 35c1-2.6 4-3.6 5.4-2.8" stroke="#2f8f45" stroke-width=".7" fill="none"/>` : ''}`;
    return `<defs>${lin(u + 'b', [[0, P.d], [.28, P.a], [.52, P.l], [.78, P.a], [1, P.d]])}${lin(u + 'm', [[0, '#7d838d'], [.45, '#f4f6f9'], [1, '#666c75']])}<clipPath id="${u}k"><rect x="20" y="15" width="24" height="40" rx="4.5"/></clipPath></defs>
      ${shadow(13)}
      <g class="pi-bob" style="--b:-1.6px;--d:3.4s">
        <rect x="20" y="16" width="24" height="38" rx="4.5" fill="url(#${u}b)"/>${band}
        <path d="M21 18.6c0-3 4.5-5 11-5s11 2 11 5V20H21z" fill="url(#${u}m)"/>
        <ellipse cx="32" cy="14.3" rx="8.6" ry="2" fill="#e3e6ec"/><path d="M31.5 13.6h4.4a1 1 0 0 1 0 1.6h-4.4z" fill="#9aa1ab"/>
        <path d="M20.6 51.6h22.8v.9c0 2.6-5 3.6-11.4 3.6S20.6 55.1 20.6 52.5z" fill="url(#${u}m)"/>
        <g clip-path="url(#${u}k)">${shine(u, 4.2)}
          <path class="pi-slide" d="${drop(25.5, 22, .62)}" fill="#fff" opacity=".6" style="--fall:16px;--d:3.6s;--dl:-1.2s"/>
          <path class="pi-slide" d="${drop(39, 26, .5)}" fill="#fff" opacity=".5" style="--fall:12px;--d:4.4s;--dl:-3s"/>
        </g>
      </g>
      ${bubbles(R, 6, 27.5, 36.5, 12.5, 11, .55, 1.25, '#ffffff')}`;
  };

  K.bottle = (P, R, u, x) => {
    const body = 'M28 9.5h8v4.6c0 2.3 6.5 4.2 6.5 9.5V51c0 3-2.2 5-5 5H26.5c-2.8 0-5-2-5-5V23.6c0-5.3 6.5-7.2 6.5-9.5z';
    const lv = x === 'water' ? 19 : 21.5;
    const motifs = {
      water: `<path d="${drop(32, 32.4, .9)}" fill="#e8f7ff"/>`,
      jarma: `<path d="M32 42.5v-9" stroke="#7a5320" stroke-width=".8"/><path d="M32 34c-1.6-.6-2.4-2-2.2-3.4 1.6.4 2.4 1.6 2.2 3.4zm0 0c1.6-.6 2.4-2 2.2-3.4-1.6.4-2.4 1.6-2.2 3.4zm0 3c-1.7-.5-2.6-2-2.4-3.4 1.7.4 2.6 1.7 2.4 3.4zm0 0c1.7-.5 2.6-2 2.4-3.4-1.7.4-2.6 1.7-2.4 3.4zm0 3c-1.7-.5-2.6-2-2.4-3.4 1.7.4 2.6 1.7 2.4 3.4zm0 0c1.7-.5 2.6-2 2.4-3.4-1.7.4-2.6 1.7-2.4 3.4z" fill="#c89a3c"/>`,
      grain: `<circle cx="29" cy="37" r="1.4" fill="#fff4d6"/><circle cx="33" cy="35.4" r="1.4" fill="#fff4d6"/><circle cx="35.6" cy="38.6" r="1.4" fill="#fff4d6"/><circle cx="31" cy="39.8" r="1.2" fill="#fff4d6"/>`,
      milk: `<path d="${drop(32, 32.2, .95)}" fill="#ffffff"/><circle cx="32" cy="38.6" r="1" fill="${P.c}" opacity=".6"/>`,
      swirl: `<path d="M27.5 37c1.4-3 6-3.6 8.4-1 1.6 1.8.2 4.2-2 4-1.8-.2-2-2.4-.4-2.8" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/>`,
      mix: `<path d="${drop(29.6, 33.2, .7)}" fill="#fff"/><path d="${drop(34.4, 33.2, .7)}" fill="#ffe1a6"/>`,
      tea: `<path d="M28 39.6c2.2-4.6 6.4-6 9-5.4-.6 4-4.6 6.6-9 5.4z" fill="#9fdc6a"/><path d="M28.5 39.2c2.4-1.8 4.6-3 7.4-4.4" stroke="#3f7d27" stroke-width=".6" fill="none"/>`,
      wine: `<path d="M30 33.4h4l-.4 3.4a1.6 1.6 0 0 1-3.2 0zM32 38v3M30.4 41h3.2" fill="none" stroke="#fff3" stroke-width=".8"/>`,
      dot: `<circle cx="32" cy="37" r="3.4" fill="#fff" opacity=".85"/><circle cx="32" cy="37" r="1.6" fill="${P.a}"/>`
    };
    return `<defs>${lin(u + 'g', [[0, P.glass || P.a, .55], [.4, '#ffffff', .22], [1, P.glass || P.a, .5]])}${lin(u + 'q', [[0, P.l], [1, P.d]], true)}<clipPath id="${u}k"><path d="${body}"/></clipPath></defs>
      ${shadow(12)}
      <g clip-path="url(#${u}k)">
        <rect x="18" y="8" width="28" height="50" fill="url(#${u}g)"/>
        <g class="pi-slosh" style="transform-origin:50% 100%;--d:${f1(between(R, 3, 4.4))}s"><path class="pi-wave" d="M-8 ${lv}q4-2.6 8 0t8 0t8 0t8 0t8 0t8 0t8 0t8 0t8 0t8 0V60H-8z" fill="url(#${u}q)" style="--d:${f1(between(R, 1.8, 2.8))}s"/></g>
        ${bubbles(R, 4, 25, 39, 52, 26, .6, 1.2, '#ffffff', .7)}
        ${shine(u)}
      </g>
      <path d="${body}" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width=".8"/>
      <rect x="21.5" y="31" width="21" height="12" rx="1.6" fill="${P.c}"/><rect x="21.5" y="31" width="21" height="1.4" fill="#fff" opacity=".25"/>
      ${motifs[x] || motifs.dot}
      <rect x="27" y="5" width="10" height="5.6" rx="1.6" fill="${P.cap || P.d}"/><rect x="27" y="7.7" width="10" height=".9" fill="#000" opacity=".22"/><rect x="28" y="5.6" width="2" height="4.4" rx=".8" fill="#fff" opacity=".35"/>`;
  };

  K.mug = (P, R, u) => {
    const glass = 'M16 20h25v30.5c0 3.3-2.7 6-6 6H22c-3.3 0-6-2.7-6-6z';
    const inner = 'M18.6 23h19.8v27c0 2.2-1.8 4-4 4H22.6c-2.2 0-4-1.8-4-4z';
    return `<defs>${lin(u + 'q', [[0, P.l], [1, P.d]], true)}<clipPath id="${u}k"><path d="${inner}"/></clipPath></defs>
      ${shadow(14)}
      <path d="M41 26h3.6c4 0 6.4 2.8 6.4 6.6v6.2c0 3.9-2.4 6.6-6.4 6.6H41" fill="none" stroke="#e8eef2" stroke-opacity=".7" stroke-width="3.2"/>
      <path d="${glass}" fill="#dfe9ee" fill-opacity=".25" stroke="#fff" stroke-opacity=".55" stroke-width="1"/>
      <g clip-path="url(#${u}k)"><rect x="17" y="22" width="24" height="34" fill="url(#${u}q)"/>${bubbles(R, 7, 20, 37, 54, 28, .5, 1.1, '#fff6cf', .8)}${shine(u, 5.2)}</g>
      <path d="M22 26v24M28.5 26v26M35 26v24" stroke="#fff" stroke-opacity=".12" stroke-width="1.4"/>
      <g class="pi-foam" style="transform-origin:50% 100%;--d:2.8s">
        <path d="M14.6 23.6c-.8-4 2.6-6.8 6-6 1.2-3.4 5.6-4.6 8.2-2.2 2.4-2.6 7.2-2 8.6 1.6 3.4-.4 5.4 2.6 4.4 5.6-.4 1.4-1.6 2.4-3 2.4H17.2c-1.2 0-2.3-.6-2.6-1.4z" fill="${P.foam || '#fff8e8'}"/>
        <circle cx="21" cy="19.6" r="1.4" fill="#fff" opacity=".9"/><circle cx="31" cy="17.6" r="1.1" fill="#fff" opacity=".9"/>
      </g>
      <path class="pi-drip" d="M37.6 24c0 3 .2 5.6-.6 7.4-.6 1.4-2.2 1.4-2.6 0-.4-1.6.6-4.6.6-7.4z" fill="${P.foam || '#fff8e8'}" style="transform-origin:50% 0%;--d:3.6s"/>`;
  };

  K.piala = (P, R, u, x) => {
    const lemon = x === 'lemon' ? `<g class="pi-spin" style="transform-origin:50% 50%;--d:9s"><circle cx="45.5" cy="25.5" r="5.6" fill="#ffd84a"/><circle cx="45.5" cy="25.5" r="4.4" fill="#fff2a8"/><path d="M45.5 21.1v8.8M41.1 25.5h8.8M42.4 22.4l6.2 6.2M48.6 22.4l-6.2 6.2" stroke="#ffd84a" stroke-width=".8"/></g>` : '';
    const leaf = x === 'green' ? `<path class="pi-bob" d="M36 28.6c2.6-3.4 6.6-3.6 8.4-2.4-1.6 3.2-5.6 4-8.4 2.4z" fill="#7fc24a" style="--b:-1px;--d:3s"/>` : '';
    return `<defs>${lin(u + 'b', [[0, '#f7f3ea'], [.6, '#e6dccb'], [1, '#bfae92']], true)}${lin(u + 't', [[0, P.l], [1, P.a]], true)}</defs>
      ${shadow(15)}
      <path d="M24 49.5h16l-1.6 4.6H25.6z" fill="#cdbd9f"/>
      <path d="M11.5 31h41c0 10.6-9.2 19-20.5 19S11.5 41.6 11.5 31z" fill="url(#${u}b)"/>
      <path d="M13.4 36.6h37.2" stroke="${P.c}" stroke-width="2.2"/><path d="M14.4 39.6h35.2" stroke="${P.b || '#d9a441'}" stroke-width="1" stroke-dasharray="2 2.2"/>
      <ellipse cx="32" cy="31" rx="20.5" ry="3.6" fill="#f8f4ec"/>
      <ellipse cx="32" cy="31.3" rx="18.6" ry="2.8" fill="url(#${u}t)"/>
      <ellipse class="pi-ripple" cx="32" cy="31.3" rx="8" ry="1.2" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".7" style="--d:2.6s"/>
      ${leaf}${lemon}
      ${steam(R, [25, 32, 39], 26, '#ffffff', 13)}`;
  };

  K.coffee = (P, R, u) => `<defs>${lin(u + 'b', [[0, '#fbf7f0'], [1, '#d8cbb6']], true)}</defs>
      ${shadow(16)}
      <ellipse cx="32" cy="52.6" rx="17" ry="3.4" fill="#e8dfd0"/><ellipse cx="32" cy="52" rx="11" ry="1.8" fill="#cdbfa8"/>
      <path d="M42 33h2.6c3.8 0 5.6 2.4 5.6 5.2s-2.2 5.4-5.6 5.4H41" fill="none" stroke="#efe6d6" stroke-width="2.6"/>
      <path d="M17 29h27l-2.6 18.6c-.4 2.6-2.6 4.4-5.2 4.4h-11.4c-2.6 0-4.8-1.8-5.2-4.4z" fill="url(#${u}b)"/>
      <ellipse cx="30.5" cy="29" rx="13.5" ry="2.6" fill="${P.a}"/>
      <path class="pi-pulse" d="M30.5 30.6c-1.8-1.4-3.4-2.2-3.4-3.4 0-.9.7-1.5 1.6-1.5.8 0 1.4.4 1.8 1 .4-.6 1-1 1.8-1 .9 0 1.6.6 1.6 1.5 0 1.2-1.6 2-3.4 3.4z" fill="#f3dcb8" style="--d:2.4s"/>
      ${steam(R, [25, 31, 37], 24, '#ffffff', 12)}`;

  K.glass = (P, R, u, x) => {
    const gl = 'M21.5 13.5h21l-2.6 39.4c-.2 2-1.8 3.6-3.8 3.6h-8.2c-2 0-3.6-1.6-3.8-3.6z';
    const garnish = x === 'mint'
      ? `<g class="pi-swing" style="transform-origin:0% 100%;--a:7deg;--d:3s"><path d="M40 15c1-4.6 5.4-6.6 8.4-5.6-.8 4.4-4.8 6.6-8.4 5.6z" fill="#5fcf6e"/><path d="M40.4 14.4c2.2-1.8 4.4-3.2 7-4.2" stroke="#27863a" stroke-width=".7" fill="none"/></g>`
      : `<g class="pi-spin" style="transform-origin:50% 50%;--d:10s"><circle cx="43" cy="15" r="5.2" fill="${P.fruit || '#ffd84a'}"/><circle cx="43" cy="15" r="4" fill="${P.fruitIn || '#fff2a8'}"/><path d="M43 11v8M39 15h8M40.2 12.2l5.6 5.6M45.8 12.2l-5.6 5.6" stroke="${P.fruit || '#ffd84a'}" stroke-width=".7"/></g>`;
    let ice = '';
    for (let i = 0; i < 3; i++) {
      const xx = 24.5 + i * 5.2 + between(R, -.6, .6), yy = 24 + between(R, 0, 3) + (i % 2) * 2.6;
      ice += `<rect class="pi-bob" x="${f1(xx)}" y="${f1(yy)}" width="6" height="6" rx="1.4" fill="#ffffff" fill-opacity=".55" stroke="#fff" stroke-opacity=".8" stroke-width=".5" style="${v({ b: '-1.4px', d: f1(between(R, 2.2, 3.4)) + 's', dl: f1(-between(R, 0, 2)) + 's' })}"/>`;
    }
    return `<defs>${lin(u + 'q', [[0, P.l], [1, P.d]], true)}<clipPath id="${u}k"><path d="${gl}"/></clipPath></defs>
      ${shadow(10)}
      <g clip-path="url(#${u}k)"><rect x="18" y="20" width="28" height="40" fill="url(#${u}q)" opacity=".92"/>${bubbles(R, 6, 24, 40, 54, 30, .5, 1.1, '#ffffff', .8)}${ice}${shine(u, 4.8)}</g>
      <path d="${gl}" fill="#fff" fill-opacity=".07" stroke="#fff" stroke-opacity=".6" stroke-width=".9"/>
      <path d="M35 6.6l-3.4 32" stroke="${P.straw || '#ff5a6e'}" stroke-width="2.2" stroke-linecap="round"/>
      ${garnish}`;
  };

  K.bowl = (P, R, u) => `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>
      ${shadow(16)}
      <path d="M10.5 30h43c-.6 11.6-9.8 21-21.5 21S11.1 41.6 10.5 30z" fill="url(#${u}b)"/>
      <path d="M13 38c6 1.8 32 1.8 38 0" stroke="${P.c}" stroke-width="1.6" fill="none"/>
      <ellipse cx="32" cy="30" rx="21.5" ry="4" fill="${P.d}"/>
      <ellipse cx="32" cy="30.3" rx="19.6" ry="3.1" fill="#fbf8f1"/>
      <g class="pi-spin" style="transform-origin:50% 50%;--d:7s"><path d="M26 30.3c1.8-2.2 8.6-2.4 11.4-.2 1.6 1.4-1 2.6-4.6 2.4" fill="none" stroke="#e7dcc6" stroke-width="1.2" stroke-linecap="round"/></g>
      ${bubbles(R, 3, 22, 42, 30, 6, .6, 1.1, '#ffffff', .9)}`;

  K.juice = (P, R, u, x) => {
    const fruit = {
      orange: `<circle cx="32" cy="38" r="7" fill="#ff9d2e"/><circle cx="32" cy="38" r="5.6" fill="#ffc46b"/><path d="M32 32.4v11.2M26.4 38h11.2M28 34l8 8M36 34l-8 8" stroke="#ff9d2e" stroke-width=".8"/>`,
      apple: `<path d="M32 33.4c-2-1.6-6.4-1-6.4 3.8 0 4 3 7.4 4.6 7.4 1 0 1.2-.6 1.8-.6s.8.6 1.8.6c1.6 0 4.6-3.4 4.6-7.4 0-4.8-4.4-5.4-6.4-3.8z" fill="#e8413c"/><path d="M32 33.6c0-1.6.6-2.8 1.8-3.4" stroke="#6b3d14" stroke-width=".9" fill="none"/><path d="M33 31.6c1.6-1.4 3.6-1.2 4-.6-1.2 1.2-2.8 1.4-4 .6z" fill="#6cc04a"/>`,
      cherry: `<circle cx="29" cy="40" r="3.4" fill="#c4123d"/><circle cx="35.4" cy="41" r="3.4" fill="#d81f4b"/><path d="M29 36.6c1-3.4 3.4-5.4 6-6.2M35.4 37.6c-.6-3.4-.2-5.6.6-7.4" stroke="#4d7b22" stroke-width=".9" fill="none"/>`,
      peach: `<circle cx="32" cy="38.4" r="6.4" fill="#ffab73"/><path d="M32 32.2c-1.4 2.4-1.4 9 0 12.4" stroke="#e8875a" stroke-width=".9" fill="none"/><path d="M32.6 32.4c1.4-1.8 3.6-2 4.4-1.4-1 1.6-2.8 2-4.4 1.4z" fill="#6cc04a"/>`
    }[x] || `<circle cx="32" cy="38.4" r="6.6" fill="${P.c}"/><circle cx="30" cy="36.4" r="1.6" fill="#fff" opacity=".7"/>`;
    return `<defs>${lin(u + 'b', [[0, P.d], [.4, P.a], [.7, P.l], [1, P.d]])}</defs>
      ${shadow(12)}
      <g class="pi-bob" style="--b:-1.2px;--d:3.6s">
        <path d="M21 20.5 25 15h14l4 5.5V54H21z" fill="url(#${u}b)"/><path d="M21 20.5h22" stroke="#000" stroke-opacity=".2"/>
        <path d="M25 15h14l-1.6-2.4H26.6z" fill="${P.l}"/>
        <g class="pi-spin" style="transform-origin:50% 50%;--d:12s">${fruit}</g>
        <path d="M37.4 13.4V5.4l5.4-2.4" fill="none" stroke="#f4f6f9" stroke-width="1.6" stroke-linecap="round"/>
      </g>
      ${bubbles(R, 3, 41, 45, 4, 6, .4, .9, '#ffffff', .8)}`;
  };

  K.shorts = (P, R, u, x) => {
    const kids = x === 'kids', disp = x === 'disposable';
    const s = kids ? .86 : 1, ty = kids ? 4 : 0;
    const pat = disp ? `<path d="M21 26h22" stroke="#fff" stroke-opacity=".55" stroke-width=".9" stroke-dasharray="1.6 1.6"/>` : `<path d="M22 31l8 2M42 31l-8 2" stroke="#000" stroke-opacity=".18" stroke-width="1"/>`;
    const star = kids ? `<path d="M37 37l1 2.2 2.4.2-1.8 1.6.6 2.4-2.2-1.2-2.2 1.2.6-2.4-1.8-1.6 2.4-.2z" fill="#ffe27a"/>` : '';
    return `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>
      ${shadow(15)}
      <g transform="translate(${f1(32 - 32 * s)} ${f1(ty + 10 - 10 * s)}) scale(${s})">
        <g class="pi-swing" style="transform-origin:50% 0%;--a:5deg;--d:3.4s">
          <path d="M17 18.5h30l3.4 27.4-13.4 4.4-5-15.2-5 15.2-13.4-4.4z" fill="url(#${u}b)"/>
          <rect x="17" y="17" width="30" height="5.4" rx="1.4" fill="${P.c}"/>
          <path d="M18 18.8h28M18 20.6h28" stroke="#fff" stroke-opacity=".28" stroke-width=".5"/>
          ${pat}${star}
          <path d="M32 22.4v10.6" stroke="#000" stroke-opacity=".22" stroke-width=".9"/>
          <g class="pi-swing" style="transform-origin:50% 0%;--a:12deg;--d:2.2s"><path d="M30.4 22.4c-.6 3-1.6 4.6-2.8 5.6M33.6 22.4c.6 3 1.6 4.6 2.8 5.6" stroke="#fff" stroke-width=".9" fill="none" stroke-linecap="round"/></g>
        </g>
      </g>
      ${sparkles(R, 2, [10, 14, 54, 30])}`;
  };

  K.briefs = (P, R, u) => `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>
      ${shadow(14)}
      <g class="pi-swing" style="transform-origin:50% 0%;--a:5deg;--d:3.2s">
        <path d="M14 20h36v6.4c-6 1.2-10.2 5.6-12.2 12.4l-.8 4.2H27l-.8-4.2C24.2 32 20 27.6 14 26.4z" fill="url(#${u}b)"/>
        <rect x="14" y="18" width="36" height="5.6" rx="1.6" fill="${P.c}"/>
        <path d="M15 20h34M15 21.8h34" stroke="#fff" stroke-opacity=".3" stroke-width=".5"/>
        <path d="M26 30c2.4 2.4 9.6 2.4 12 0M32 31.6v10" stroke="#000" stroke-opacity=".18" stroke-width="1" fill="none"/>
      </g>${sparkles(R, 2, [10, 12, 54, 26])}`;

  K.socks = (P, R, u) => {
    const sock = (dx, cls) => `<g class="pi-swing" style="transform-origin:50% 0%;--a:6deg;--d:3s;--dl:${cls}">
      <path d="M${18 + dx} 12h11v21c0 4 2.4 6.4 6.6 7.8l3.6 1.2c3.6 1.4 3 6.6-1.6 7.2H${27 + dx}c-6.2 0-9.4-3.4-9.4-9.4z" fill="url(#${u}b)"/>
      <rect x="${18 + dx}" y="12" width="11" height="5.4" rx="1.4" fill="${P.c}"/><path d="M${19 + dx} 14h9M${19 + dx} 16h9" stroke="#fff" stroke-opacity=".35" stroke-width=".6"/>
      <path d="M${31 + dx} 45.4c2.2-.2 4.6.6 6 2" stroke="${P.c}" stroke-width="2.2" fill="none" stroke-linecap="round"/></g>`;
    return `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>${shadow(15)}${sock(-4, '0s')}${sock(6, '-1.5s')}`;
  };

  K.tshirt = (P, R, u) => `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>
      ${shadow(15)}
      <g class="pi-flutter" style="transform-origin:50% 0%;--d:2.8s">
        <path d="M24.5 12.5c1.6 4.2 4.4 6 7.5 6s5.9-1.8 7.5-6l5 2.6c-1.6 4.4-2.6 7.6-2.6 11.6V54H22.1V26.7c0-4-1-7.2-2.6-11.6z" fill="url(#${u}b)"/>
        <path d="M24.5 12.5c1.6 4.2 4.4 6 7.5 6s5.9-1.8 7.5-6" fill="none" stroke="${P.c}" stroke-width="1.6"/>
        <path d="M25 30h14M25 34h14" stroke="#fff" stroke-opacity=".14" stroke-width="1.2"/>
      </g>${sparkles(R, 2, [8, 10, 56, 26])}`;

  K.robe = (P, R, u) => `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>
      ${shadow(16)}
      <path d="M22 11h20l8 9-4 4-2-3v34H20V21l-2 3-4-4z" fill="url(#${u}b)"/>
      <path d="M26 11l6 17 6-17" fill="none" stroke="${P.c}" stroke-width="1.6"/><path d="M32 28v27" stroke="#000" stroke-opacity=".18"/>
      <rect x="20" y="33" width="24" height="3.2" fill="${P.c}"/>
      <g class="pi-swing" style="transform-origin:50% 0%;--a:10deg;--d:2.4s"><path d="M31 36l-3 10M33 36l3 9" stroke="${P.c}" stroke-width="2" stroke-linecap="round"/></g>
      ${sparkles(R, 2, [8, 8, 56, 24])}`;

  K.slippers = (P, R, u) => {
    const sl = (dx, dl) => `<g class="pi-step" style="transform-origin:50% 100%;--d:1.8s;--dl:${dl}">
      <path d="M${dx + 10.5} 13.5c4.8 0 8 3.8 8 9.4 0 4.4-1.6 7-2.4 10.2-.6 2.6-.2 5.4-.2 8.6 0 4-2.4 7.2-5.4 7.2s-5.4-3.2-5.4-7.2c0-3.2.4-6-.2-8.6-.8-3.2-2.4-5.8-2.4-10.2 0-5.6 3.2-9.4 8-9.4z" fill="url(#${u}s)"/>
      <path d="M${dx + 10.5} 15.4c3.6 0 5.8 2.8 5.8 7 0 3.4-1.2 5.6-1.8 8.2-.5 2.2-.2 4.6-.2 7.4 0 3-1.6 5.2-3.8 5.2s-3.8-2.2-3.8-5.2c0-2.8.3-5.2-.2-7.4-.6-2.6-1.8-4.8-1.8-8.2 0-4.2 2.2-7 5.8-7z" fill="#000" opacity=".16"/>
      <path d="M${dx + 2.6} 21.6c2.6-3 5.2-4.2 7.9-4.2s5.3 1.2 7.9 4.2v6.6c-2.6-2.2-5.2-3.2-7.9-3.2s-5.3 1-7.9 3.2z" fill="${P.c}"/>
      <path d="M${dx + 4} 22.6c2-1.8 4.2-2.6 6.5-2.6s4.5.8 6.5 2.6" stroke="#fff" stroke-opacity=".45" stroke-width=".7" fill="none"/></g>`;
    return `<defs>${lin(u + 's', [[0, P.l], [1, P.d]], true)}</defs>${shadow(16)}${sl(10, '0s')}${sl(23, '-.9s')}`;
  };

  K.hat = (P, R, u) => `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>
      ${shadow(17)}
      <g class="pi-bob" style="--b:-1.8px;--d:3.2s">
        <path d="M15 46c1.8-15 7.6-30.5 17-30.5S47.2 31 49 46c-5.4 3-11 4.2-17 4.2S20.4 49 15 46z" fill="url(#${u}b)"/>
        <path d="M13 45.4c5.6 3.8 12.2 5.6 19 5.6s13.4-1.8 19-5.6l1.4 3c-6 4-13 6-20.4 6s-14.4-2-20.4-6z" fill="${P.c}"/>
        <path d="M22 38l3-3 3 3 3-3 3 3 3-3 3 3 3-3" fill="none" stroke="${P.c}" stroke-width="1.2" stroke-linejoin="round"/>
        <circle cx="32" cy="15.6" r="2" fill="${P.c}"/>
      </g>
      ${steam(R, [14, 50], 30, '#ffffff', 11)}`;

  K.venik = (P, R, u, x) => {
    const leafCol = P.leaf || '#7cc451', dark = tone(leafCol, -16);
    const shape = x === 'oak'
      ? (cx, cy, r) => `<path d="M${cx} ${cy - 4.6 * r}c1.6 1 2.6 2 1.6 3 1.6.4 2 1.8.8 2.8 1.2.8 1 2.4-.4 2.8.4 1.4-1 2.6-2 2.6s-2.4-1.2-2-2.6c-1.4-.4-1.6-2-.4-2.8-1.2-1-.8-2.4.8-2.8-1-1 0-2 1.6-3z" fill="${leafCol}" stroke="${dark}" stroke-width=".4"/>`
      : x === 'euca'
        ? (cx, cy, r) => `<ellipse cx="${cx}" cy="${cy}" rx="${f1(1.6 * r)}" ry="${f1(4.6 * r)}" fill="${leafCol}" stroke="${dark}" stroke-width=".4"/>`
        : x === 'fir'
          ? (cx, cy, r) => `<path d="M${cx} ${cy - 5 * r}v${f1(10 * r)}M${cx} ${cy - 3 * r}l${f1(-2.4 * r)} ${f1(1.6 * r)}M${cx} ${cy - 3 * r}l${f1(2.4 * r)} ${f1(1.6 * r)}M${cx} ${cy}l${f1(-2.6 * r)} ${f1(1.6 * r)}M${cx} ${cy}l${f1(2.6 * r)} ${f1(1.6 * r)}M${cx} ${cy + 3 * r}l${f1(-2.4 * r)} ${f1(1.6 * r)}M${cx} ${cy + 3 * r}l${f1(2.4 * r)} ${f1(1.6 * r)}" stroke="${leafCol}" stroke-width="1.1" stroke-linecap="round"/>`
          : (cx, cy, r) => `<path d="M${cx} ${cy - 4 * r}c${f1(3 * r)} ${f1(1.6 * r)} ${f1(3.4 * r)} ${f1(5.4 * r)} 0 ${f1(8 * r)}c${f1(-3.4 * r)} ${f1(-2.6 * r)} ${f1(-3 * r)} ${f1(-6.4 * r)} 0 ${f1(-8 * r)}z" fill="${leafCol}" stroke="${dark}" stroke-width=".4"/>`;
    const spots = [[32, 13, 1.05, 0], [26, 15.6, 1, -18], [38, 15.6, 1, 18], [21.6, 20.4, .95, -30], [42.4, 20.4, .95, 30], [27.6, 21.6, 1, -10], [36.4, 21.6, 1, 10], [32, 23.4, 1, 0], [24, 27, .9, -22], [40, 27, .9, 22], [32, 29.2, .9, 0]];
    let leaves = '';
    spots.forEach(([cx, cy, r, rot]) => { leaves += `<g transform="rotate(${rot} ${cx} ${cy})">${shape(cx, cy, r)}</g>`; });
    const fall = `<g class="pi-leaf" style="--d:${f1(between(R, 3.4, 4.6))}s;--lx:${f1(between(R, -10, -4))}px;--ly:24px;--lr:${Math.round(between(R, 160, 320))}deg">${shape(40, 26, .7)}</g>`;
    return `${shadow(13)}
      <g class="pi-swing" style="transform-origin:50% 100%;--a:5deg;--d:2.8s">
        <path d="M30 34h4l1.6 21.4c.1 1.2-.9 2.2-2.1 2.2h-3c-1.2 0-2.2-1-2.1-2.2z" fill="#8a5a2b"/><path d="M28.6 36.6h6.8M28.8 39.6h6.4" stroke="#d9b06a" stroke-width="1.2"/>
        <g class="pi-flutter" style="transform-origin:50% 100%;--d:2s">${leaves}</g>
      </g>${fall}`;
  };

  K.towel = (P, R, u, x) => {
    const sheet = x === 'sheet';
    const stripe = (y) => `<rect x="14" y="${y}" width="36" height="1.6" fill="${P.c}" opacity=".9"/>`;
    return `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}${lin(u + 'b2', [[0, tone(P.a, 8, 18)], [1, tone(P.a, -12, 18)]], true)}</defs>
      ${shadow(18)}
      <rect x="13" y="40" width="38" height="13" rx="4" fill="url(#${u}b2)"/>${sheet ? '' : stripe(49)}
      <rect x="13" y="28" width="38" height="13" rx="4" fill="url(#${u}b)"/>${sheet ? '' : stripe(37)}
      <g class="pi-foam" style="transform-origin:50% 100%;--d:3s"><path d="M13 20c0-2.2 1.8-4 4-4h30c2.2 0 4 1.8 4 4v9H13z" fill="url(#${u}b)"/><path d="M13 20c0-2.2 1.8-4 4-4h30c2.2 0 4 1.8 4 4" fill="none" stroke="#fff" stroke-opacity=".35"/>${sheet ? '' : stripe(25)}</g>
      <path d="M16 24h32M16 33h32M16 45h32" stroke="#fff" stroke-opacity=".1" stroke-width="2"/>
      ${sparkles(R, 2, [8, 6, 56, 18])}`;
  };

  K.soap = (P, R, u) => `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>
      ${shadow(17)}
      <g class="pi-squish" style="transform-origin:50% 100%;--d:3s">
        <rect x="14" y="36" width="36" height="17" rx="8.5" fill="url(#${u}b)"/>
        <rect x="19" y="38.6" width="26" height="6" rx="3" fill="#fff" opacity=".28"/>
        <path d="M22 47.4h20" stroke="${P.c}" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>
      </g>
      ${bubbles(R, 7, 16, 48, 36, 26, 1.4, 3.4, '#e9f6ff', .55)}
      <circle cx="21" cy="33" r="3.4" fill="#fff" fill-opacity=".18" stroke="#fff" stroke-opacity=".6" stroke-width=".6"/>`;

  K.shampoo = (P, R, u) => `<defs>${lin(u + 'b', [[0, P.d], [.35, P.a], [.6, P.l], [1, P.d]])}<clipPath id="${u}k"><rect x="21" y="23" width="22" height="33" rx="5"/></clipPath></defs>
      ${shadow(12)}
      <rect x="21" y="23" width="22" height="33" rx="5" fill="url(#${u}b)"/>
      <rect x="24" y="32" width="16" height="14" rx="2" fill="${P.c}"/><path d="M27 36h10M27 39.4h7" stroke="#fff" stroke-opacity=".7" stroke-width="1.2" stroke-linecap="round"/>
      <g clip-path="url(#${u}k)">${shine(u, 4.4)}</g>
      <rect x="28" y="18.6" width="8" height="5" rx="1" fill="${P.cap || '#f4f6f9'}"/>
      <g class="pi-press" style="--d:2.6s"><rect x="29.6" y="12.2" width="4.8" height="6.6" rx="1" fill="${P.cap || '#f4f6f9'}"/><path d="M29 12.2h13.4v2.6H29z" fill="${P.cap || '#f4f6f9'}"/></g>
      <path class="pi-drop" d="${drop(42.4, 15, .55)}" fill="#e9f6ff" style="--fall:14px;--d:2.6s"/>
      ${bubbles(R, 4, 14, 50, 40, 22, .9, 2.2, '#e9f6ff', .5)}`;

  K.gel = (P, R, u) => `<defs>${lin(u + 'b', [[0, P.d], [.35, P.a], [.6, P.l], [1, P.d]])}</defs>
      ${shadow(12)}
      <g class="pi-wobble" style="transform-origin:50% 0%;--a:3deg;--d:3.2s">
        <path d="M22 8h20l-2 34c-.2 3.4-3.6 6-8 6s-7.8-2.6-8-6z" fill="url(#${u}b)"/>
        <path d="M24 18h16" stroke="#fff" stroke-opacity=".4" stroke-width="1.2"/>
        <rect x="25.4" y="24" width="13.2" height="11" rx="2" fill="${P.c}"/>
        <rect x="27.6" y="47.6" width="8.8" height="5.6" rx="1.6" fill="${P.cap || '#f4f6f9'}"/>
      </g>
      <path class="pi-drop" d="${drop(32, 54, .7)}" fill="${P.l}" style="--fall:6px;--d:2.8s"/>
      ${bubbles(R, 4, 12, 52, 30, 20, .9, 2, '#e9f6ff', .45)}`;

  K.deo = (P, R, u) => {
    let mist = '';
    for (let i = 0; i < 5; i++) mist += `<circle class="pi-puff" cx="${f1(45 + between(R, -1, 1))}" cy="${f1(14.6 + between(R, -1, 1))}" r="${f1(between(R, 1.6, 2.8))}" fill="#eaf6ff" opacity=".8" style="${v({ tx: f1(between(R, 6, 13)) + 'px', ty: f1(between(R, -6, 5)) + 'px', d: '1.6s', dl: f1(-i * .32) + 's' })}"/>`;
    return `<defs>${lin(u + 'b', [[0, P.d], [.3, P.a], [.55, P.l], [1, P.d]])}<clipPath id="${u}k"><rect x="22" y="20" width="20" height="36" rx="4"/></clipPath></defs>
      ${shadow(12)}
      <rect x="22" y="20" width="20" height="36" rx="4" fill="url(#${u}b)"/>
      <path d="M22 34c5-2.4 12 2 20-1v6c-8 3-15-1.4-20 1z" fill="${P.c}"/>
      <g clip-path="url(#${u}k)">${shine(u, 4)}</g>
      <path d="M23 20.6c0-3 4-5.2 9-5.2s9 2.2 9 5.2z" fill="${P.cap || '#d9dee6'}"/>
      <g class="pi-press" style="--d:1.6s"><rect x="29" y="11.2" width="7.4" height="4.6" rx="1.2" fill="${P.cap || '#d9dee6'}"/><rect x="35.6" y="12.6" width="3" height="1.6" rx=".6" fill="#7d838d"/></g>
      ${mist}`;
  };

  K.razor = (P, R, u) => `<defs>${lin(u + 'h', [[0, P.d], [.5, P.a], [1, P.d]])}${lin(u + 'm', [[0, '#8e959f'], [.5, '#f6f8fb'], [1, '#79808a']], true)}<clipPath id="${u}k"><rect x="18" y="11" width="28" height="9" rx="2.4"/></clipPath></defs>
      ${shadow(10)}
      <g class="pi-wobble" style="transform-origin:50% 100%;--a:4deg;--d:3.4s">
        <path d="M29.4 20h5.2l2.2 33.4c.1 1.6-1.2 3-2.8 3h-4c-1.6 0-2.9-1.4-2.8-3z" fill="url(#${u}h)"/>
        <path d="M28.4 30h7.2M28.6 34h6.8M28.8 38h6.4" stroke="#fff" stroke-opacity=".3" stroke-width="1"/>
        <rect x="18" y="11" width="28" height="9" rx="2.4" fill="url(#${u}m)"/>
        <path d="M20 13.6h24M20 15.6h24M20 17.6h24" stroke="#4a515b" stroke-width=".5"/>
        <rect x="18" y="11" width="28" height="2" rx="1" fill="${P.c}"/>
        <g clip-path="url(#${u}k)"><g transform="skewX(-20)"><rect class="pi-shine" x="8" y="8" width="5" height="16" fill="#fff" opacity=".85" style="--d:2.6s"/></g></g>
      </g>
      <path class="pi-tw" d="M46 9.4Q46 12 48.6 12Q46 12 46 14.6Q46 12 43.4 12Q46 12 46 9.4z" fill="#fff" style="--d:2.6s;--dl:-1.6s"/>`;

  K.loofah = (P, R, u) => {
    let mesh = '';
    for (let i = 0; i < 5; i++) mesh += `<ellipse cx="32" cy="38" rx="${15 - i * 1.4}" ry="${f1(6 + i * 1.6)}" transform="rotate(${i * 36} 32 38)" fill="none" stroke="${i % 2 ? P.l : '#fff'}" stroke-opacity="${i % 2 ? .9 : .45}" stroke-width="1.1"/>`;
    return `<defs><radialGradient id="${u}r" cx="40%" cy="35%" r="65%"><stop offset="0" stop-color="${P.l}"/><stop offset="1" stop-color="${P.d}"/></radialGradient></defs>
      ${shadow(15)}
      <path d="M32 24c-3-6-1-12 3-14" fill="none" stroke="${P.c}" stroke-width="1.6"/>
      <g class="pi-squish" style="transform-origin:50% 100%;--d:2.4s"><circle cx="32" cy="38" r="15" fill="url(#${u}r)"/>${mesh}</g>
      ${bubbles(R, 6, 14, 50, 32, 22, 1, 2.6, '#e9f6ff', .5)}`;
  };

  K.file = (P, R, u) => {
    let grit = '';
    for (let i = 0; i < 16; i++) grit += `<circle cx="${f1(26 + (i % 4) * 4 + between(R, -.8, .8))}" cy="${f1(18 + Math.floor(i / 4) * 5 + between(R, -.8, .8))}" r=".8" fill="#000" opacity=".25"/>`;
    let dust = '';
    for (let i = 0; i < 5; i++) dust += `<circle class="pi-dust" cx="${f1(between(R, 26, 40))}" cy="${f1(between(R, 34, 40))}" r="${f1(between(R, .5, 1))}" fill="#fff3d6" style="${v({ d: f1(between(R, 1.6, 2.6)) + 's', dl: f1(-between(R, 0, 2)) + 's', tx: f1(between(R, -8, 8)) + 'px' })}"/>`;
    return `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>${shadow(10)}
      <g class="pi-wobble" style="transform-origin:50% 100%;--a:6deg;--d:1.4s">
        <rect x="24" y="12" width="16" height="26" rx="7" fill="url(#${u}b)"/>${grit}
        <rect x="29" y="37" width="6" height="18" rx="3" fill="${P.c}"/>
      </g>${dust}`;
  };

  K.brush = (P, R, u) => `${shadow(12)}
      <g class="pi-wobble" style="transform-origin:50% 100%;--a:5deg;--d:2s">
        <rect x="29.4" y="22" width="5.2" height="33" rx="2.6" fill="${P.a}"/><rect x="29.4" y="22" width="1.6" height="33" rx=".8" fill="#fff" opacity=".35"/>
        <rect x="28.6" y="10" width="6.8" height="13" rx="2" fill="#f4f6f9"/>
        <path d="M29.6 11v11M31.4 11v11M33.2 11v11M35 11v11" stroke="${P.c}" stroke-width=".9"/>
        <path class="pi-foam" d="M26.6 9.6c1.6-2.6 4-1 5.4-2.4 1.4 1.4 3.8-.2 5.4 2.4-1.8 1.2-9 1.2-10.8 0z" fill="#fff" style="transform-origin:50% 100%;--d:2.4s"/>
      </g>${sparkles(R, 3, [12, 8, 52, 30])}`;

  K.comb = (P, R, u) => {
    let teeth = '';
    for (let i = 0; i < 11; i++) teeth += `<rect x="${f1(15.6 + i * 3)}" y="31" width="1.6" height="11" rx=".8" fill="url(#${u}b)"/>`;
    return `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}<clipPath id="${u}k"><rect x="14" y="20" width="36" height="12" rx="4"/></clipPath></defs>${shadow(16)}
      <g class="pi-bob" style="--b:-1.4px;--d:3s"><rect x="14" y="20" width="36" height="12" rx="4" fill="url(#${u}b)"/>${teeth}<g clip-path="url(#${u}k)">${shine(u, 3.6)}</g></g>${sparkles(R, 2, [10, 8, 54, 20])}`;
  };

  K.wipes = (P, R, u) => `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>${shadow(17)}
      <rect x="13" y="30" width="38" height="23" rx="6" fill="url(#${u}b)"/>
      <rect x="22" y="30" width="20" height="6" rx="3" fill="${P.c}"/>
      <path class="pi-pop" d="M24 31c2-7 4-10 8-11 4 1 6 4 8 11z" fill="#fbfbff" stroke="#dfe7ef" stroke-width=".6" style="transform-origin:50% 100%;--d:2.6s;--h:-3px"/>
      <path d="M17 44h30" stroke="#fff" stroke-opacity=".3" stroke-width="1.4"/>${sparkles(R, 2, [8, 8, 56, 22])}`;

  K.ladle = (P, R, u) => {
    let drops = '';
    for (let i = 0; i < 3; i++) drops += `<path class="pi-drop" d="${drop(f1(23 + i * 4.2), 41, .6)}" fill="#bfe8ff" style="${v({ fall: '12px', d: '1.8s', dl: f1(-i * .6) + 's' })}"/>`;
    return `<defs>${lin(u + 'w', [[0, '#d39a55'], [1, '#8a5a2b']], true)}</defs>${shadow(14)}
      <g class="pi-wobble" style="transform-origin:80% 20%;--a:5deg;--d:3s">
        <path d="M37 22 55 8" stroke="url(#${u}w)" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M14 26h26c0 8-5.8 14-13 14s-13-6-13-14z" fill="url(#${u}w)"/>
        <ellipse cx="27" cy="26" rx="13" ry="2.6" fill="#7fcbf0"/><path d="M15 31h24" stroke="#5c3a17" stroke-width="1"/>
      </g>${drops}`;
  };

  K.basin = (P, R, u) => `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>${shadow(18)}
      <path d="M10 33h44l-4.4 17c-.6 2.4-2.8 4-5.2 4H19.6c-2.4 0-4.6-1.6-5.2-4z" fill="url(#${u}b)"/>
      <ellipse cx="32" cy="33" rx="22" ry="4" fill="${P.d}"/><ellipse cx="32" cy="33.4" rx="20" ry="3" fill="#7fcbf0"/>
      <ellipse class="pi-ripple" cx="32" cy="33.4" rx="8" ry="1.2" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".7" style="--d:2.4s"/>
      <path d="M13 40h38" stroke="#fff" stroke-opacity=".25" stroke-width="1.4"/>
      ${steam(R, [24, 32, 40], 28, '#ffffff', 12)}`;

  K.vial = (P, R, u, x) => {
    const swirl = x === 'aroma' ? steam(R, [26, 38], 14, P.l, 10) : '';
    return `<defs>${lin(u + 'b', [[0, P.d], [.4, P.a], [.65, P.l], [1, P.d]])}</defs>${shadow(11)}
      <path d="M26 26h12v24c0 3-2.4 5-5 5h-2c-2.6 0-5-2-5-5z" fill="url(#${u}b)" opacity=".95"/>
      <rect x="27" y="33" width="10" height="9" rx="1.4" fill="${P.c}"/>
      <rect x="28.4" y="20" width="7.2" height="6.6" rx="1.4" fill="#2b2b2b"/>
      <g class="pi-press" style="--d:2.8s"><rect x="29.4" y="13" width="5.2" height="7.6" rx="2.6" fill="#1f1f1f"/></g>
      ${swirl}${sparkles(R, 2, [10, 8, 54, 26])}`;
  };

  K.jar = (P, R, u, x) => {
    const honey = x === 'honey', salt = x === 'salt';
    let crystals = '';
    if (salt) for (let i = 0; i < 7; i++) { const cx = between(R, 22, 42), cy = between(R, 34, 50); crystals += `<path d="M${f1(cx)} ${f1(cy - 1.6)}l1.6 1.6-1.6 1.6-1.6-1.6z" fill="#fff" opacity=".85"/>`; }
    const fill = honey ? '#f2a720' : salt ? (P.salt || '#f3c6d4') : P.l;
    return `<defs>${lin(u + 'g', [[0, '#ffffff', .25], [.5, '#ffffff', .08], [1, '#ffffff', .22]])}</defs>${shadow(15)}
      <path d="M18 26h28v24c0 3.4-2.6 6-6 6H24c-3.4 0-6-2.6-6-6z" fill="${fill}"/>
      <path d="M18 26h28v24c0 3.4-2.6 6-6 6H24c-3.4 0-6-2.6-6-6z" fill="url(#${u}g)" stroke="#fff" stroke-opacity=".45" stroke-width=".8"/>
      ${crystals}
      <rect x="16.6" y="19" width="30.8" height="8" rx="2.4" fill="${P.c}"/><path d="M18 21.6h28" stroke="#fff" stroke-opacity=".3"/>
      ${honey ? `<path class="pi-drip" d="M40 27v6c0 1.6-.8 2.6-1.8 2.6s-1.8-1-1.8-2.6v-6z" fill="#f2a720" style="transform-origin:50% 0%;--d:3s"/>` : ''}
      ${sparkles(R, salt ? 4 : 2, [10, 8, 54, 34])}`;
  };

  K.chips = (P, R, u) => {
    let chips = '';
    for (let i = 0; i < 3; i++) chips += `<ellipse class="pi-pop" cx="${f1(24 + i * 8)}" cy="${f1(17 + (i % 2) * 2)}" rx="4" ry="2.6" fill="#ffd27a" stroke="#d9a441" stroke-width=".6" style="${v({ d: '2.2s', dl: f1(-i * .7) + 's', h: '-6px' })};transform-origin:50% 50%"/>`;
    return `<defs>${lin(u + 'b', [[0, P.d], [.4, P.a], [.7, P.l], [1, P.d]])}</defs>${shadow(15)}
      ${chips}
      <path d="M16 20c4 2 8 2 16 2s12 0 16-2l-2 15 2 18c-4-2-8-2-16-2s-12 0-16 2l2-18z" fill="url(#${u}b)"/>
      <path d="M16 20c4 2 8 2 16 2s12 0 16-2" fill="none" stroke="#fff" stroke-opacity=".5"/>
      <ellipse cx="32" cy="36" rx="7" ry="5.6" fill="${P.c}"/><ellipse cx="32" cy="36" rx="4.6" ry="3.2" fill="#ffd27a"/>`;
  };

  K.nuts = (P, R, u) => {
    let nuts = '';
    for (let i = 0; i < 5; i++) nuts += `<ellipse class="pi-hop" cx="${f1(20 + i * 6)}" cy="${f1(31 - (i % 2) * 2)}" rx="3.2" ry="2.4" fill="${i % 2 ? '#c88a4a' : '#e0a865'}" style="${v({ d: '1.6s', dl: f1(-i * .3) + 's', h: '-4px' })}"/>`;
    return `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>${shadow(16)}${nuts}
      <path d="M12 32h40c-.6 10-9.4 18-20 18s-19.4-8-20-18z" fill="url(#${u}b)"/><path d="M15 39h34" stroke="${P.c}" stroke-width="1.4"/>`;
  };

  K.choco = (P, R, u) => {
    let seg = '';
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) seg += `<rect x="${21 + j * 11.4}" y="${23 + i * 9.6}" width="10" height="8.4" rx="1.2" fill="${P.l}" opacity=".55"/>`;
    return `<defs><clipPath id="${u}k"><rect x="19" y="21" width="26" height="33" rx="2.4"/></clipPath></defs>${shadow(14)}
      <g class="pi-wobble" style="transform-origin:50% 100%;--a:3deg;--d:3.6s">
        <rect x="19" y="21" width="26" height="33" rx="2.4" fill="${P.a}"/>${seg}
        <path d="M17.6 33h28.8v21.4c0 1.6-1.2 2.6-2.6 2.6H20.2c-1.4 0-2.6-1-2.6-2.6z" fill="${P.c}"/>
        <path d="M17.6 33l4 3 3.4-3 3.4 3 3.4-3 3.4 3 3.4-3 3.4 3 4-3" fill="none" stroke="#fff" stroke-opacity=".4"/>
        <g clip-path="url(#${u}k)">${shine(u, 3.8)}</g>
      </g>`;
  };

  K.candy = (P, R, u) => `<defs><radialGradient id="${u}r" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="${P.l}"/><stop offset="1" stop-color="${P.d}"/></radialGradient></defs>${shadow(14)}
      <g class="pi-wobble" style="transform-origin:50% 50%;--a:14deg;--d:2.4s">
        <path d="M18 34l-8-6v12zM46 34l8-6v12z" fill="${P.c}"/>
        <ellipse cx="32" cy="34" rx="14" ry="9.4" fill="url(#${u}r)"/>
        <path d="M24 28c4 4 12 8 16 12M28 26c4 4 10 8 13 11" stroke="#fff" stroke-opacity=".45" stroke-width="1.4"/>
      </g>${sparkles(R, 2, [10, 8, 54, 22])}`;

  K.samsa = (P, R, u) => {
    let sesame = '';
    for (let i = 0; i < 6; i++) sesame += `<ellipse cx="${f1(between(R, 24, 40))}" cy="${f1(between(R, 34, 46))}" rx=".9" ry=".5" fill="#fff6dc"/>`;
    return `<defs>${lin(u + 'b', [[0, '#f6c66a'], [1, '#b8722c']], true)}</defs>${shadow(16)}
      <ellipse cx="32" cy="53" rx="18" ry="3" fill="#e9e1d2"/>
      <path d="M32 22 50 50H14z" fill="url(#${u}b)" stroke="#9a5a1f" stroke-width=".8" stroke-linejoin="round"/>
      <path d="M32 22v28M23 36l9 14 9-14" stroke="#9a5a1f" stroke-opacity=".45" stroke-width=".8" fill="none"/>${sesame}
      ${steam(R, [26, 32, 38], 20, '#ffffff', 11)}`;
  };

  K.skewer = (P, R, u) => {
    let meat = '';
    for (let i = 0; i < 4; i++) meat += `<rect x="${17 + i * 8}" y="${f1(30 - i * 2.2)}" width="7" height="7" rx="2" fill="${i % 2 ? '#8a3b1c' : '#a4512a'}" transform="rotate(-15 ${20.5 + i * 8} ${33.5 - i * 2.2})"/>`;
    const flame = (x, d) => `<path class="pi-flame" d="M${x} 56c-3-2-3.6-5.4-1.2-8.4.4 2 1.6 2.6 2.4 2.4-.6-2.8.6-5.6 3-7-.2 3 2.4 4.4 2.4 7.6 0 2.6-1.6 4.6-3.6 5.4z" fill="url(#${u}f)" style="transform-origin:50% 100%;--d:${d}s"/>`;
    return `<defs>${lin(u + 'f', [[0, '#ffe27a'], [.5, '#ff8a2a'], [1, '#e8411c']], true)}</defs>
      <ellipse cx="32" cy="57" rx="16" ry="2" fill="#000" opacity=".4"/>
      ${flame(22, .9)}${flame(30, 1.1)}${flame(38, .8)}
      <path d="M10 41 54 25" stroke="#c9ced6" stroke-width="1.6" stroke-linecap="round"/>${meat}
      ${steam(R, [24, 34, 44], 22, '#ffffff', 10)}`;
  };

  K.hotbowl = (P, R, u) => `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>${shadow(17)}
      <path d="M11 32h42c-.6 11-9.8 19.6-21 19.6S11.6 43 11 32z" fill="url(#${u}b)"/><path d="M14 40h36" stroke="${P.c}" stroke-width="1.4" stroke-dasharray="2.4 1.6"/>
      <ellipse cx="32" cy="32" rx="21" ry="4" fill="${P.food || '#f2c26b'}"/>
      <path d="M20 31c3-2 6 1 9-1s6 1 9-1 5 1 7 0" stroke="#fff3cf" stroke-width="1.2" fill="none" opacity=".8"/>
      <circle cx="26" cy="31" r="1.6" fill="#e8562a"/><circle cx="37" cy="30.4" r="1.4" fill="#5bbf4a"/>
      ${steam(R, [24, 32, 40], 26, '#ffffff', 13)}`;

  K.bread = (P, R, u) => {
    let dots = '';
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; dots += `<circle cx="${f1(32 + Math.cos(a) * 6)}" cy="${f1(38 + Math.sin(a) * 3.4)}" r=".8" fill="#7a4518"/>`; }
    return `<defs><radialGradient id="${u}r" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#f6cf86"/><stop offset="1" stop-color="#b8722c"/></radialGradient></defs>${shadow(18)}
      <ellipse cx="32" cy="40" rx="20" ry="11" fill="url(#${u}r)"/><ellipse cx="32" cy="38.6" rx="10" ry="5.6" fill="#e9b56a"/>${dots}
      ${steam(R, [26, 33, 40], 28, '#ffffff', 11)}`;
  };

  K.entry = (P, R, u, x) => {
    const mark = x === 'kids'
      ? `<path class="pi-pulse" d="M32 25.6l2 4.2 4.6.6-3.4 3.2.8 4.6-4-2.2-4 2.2.8-4.6-3.4-3.2 4.6-.6z" fill="${P.c}" style="--d:1.8s"/>`
      : x === 'bonus'
        ? `<g class="pi-pulse" style="--d:1.8s"><rect x="25" y="29" width="14" height="10" rx="1.4" fill="${P.c}"/><path d="M32 29v10M25 32.4h14" stroke="#7a1d1d" stroke-width="1.2"/><path d="M32 29c-2-3-6-3-5-.4.6 1 3 .8 5 .4zm0 0c2-3 6-3 5-.4-.6 1-3 .8-5 .4z" fill="${P.c}"/></g>`
        : `<g class="pi-pulse" style="--d:2s"><path d="M26 39c0-3 2.4-3 2.4-6S26 30 26 27M32 39c0-3 2.4-3 2.4-6S32 30 32 27M38 39c0-3 2.4-3 2.4-6S38 30 38 27" fill="none" stroke="${P.c}" stroke-width="1.8" stroke-linecap="round"/></g>`;
    return `<defs>${lin(u + 'b', [[0, P.l], [.5, P.a], [1, P.d]])}<clipPath id="${u}k"><path d="M10 20h44v8.4a3.6 3.6 0 0 0 0 7.2V44H10v-8.4a3.6 3.6 0 0 0 0-7.2z"/></clipPath></defs>${shadow(18)}
      <g class="pi-bob" style="--b:-1.6px;--d:3.2s">
        <path d="M10 20h44v8.4a3.6 3.6 0 0 0 0 7.2V44H10v-8.4a3.6 3.6 0 0 0 0-7.2z" fill="url(#${u}b)"/>
        <path d="M17 20v24" stroke="#000" stroke-opacity=".25" stroke-dasharray="2 2"/><path d="M47 20v24" stroke="#000" stroke-opacity=".25" stroke-dasharray="2 2"/>
        <rect x="11.6" y="21.6" width="40.8" height="20.8" rx="1.6" fill="none" stroke="#fff" stroke-opacity=".35"/>
        ${mark}
        <g clip-path="url(#${u}k)">${shine(u, 3.6)}</g>
      </g>${sparkles(R, 3, [8, 6, 56, 18])}`;
  };

  K.spa = (P, R, u) => `<defs><radialGradient id="${u}s" cx="40%" cy="30%" r="70%"><stop offset="0" stop-color="#7d7d86"/><stop offset="1" stop-color="#2c2c33"/></radialGradient></defs>${shadow(16)}
      <circle class="pi-pulse" cx="32" cy="36" r="20" fill="none" stroke="${P.c}" stroke-opacity=".5" stroke-width="1.2" style="--d:2.6s"/>
      <ellipse cx="32" cy="50" rx="13" ry="5" fill="url(#${u}s)"/><ellipse cx="32" cy="41" rx="10" ry="4.4" fill="url(#${u}s)"/><ellipse cx="32" cy="33.4" rx="7" ry="3.6" fill="url(#${u}s)"/>
      <g class="pi-swing" style="transform-origin:0% 100%;--a:8deg;--d:3s"><path d="M33 29c3-7 10-9 14-7-2 6-8 9-14 7z" fill="#6cc04a"/><path d="M33.4 28.6c3.4-2.6 7-4.4 10.6-5.4" stroke="#2f8f45" stroke-width=".7" fill="none"/></g>
      ${sparkles(R, 2, [10, 8, 54, 24])}`;

  K.hookah = (P, R, u) => {
    let rings = '';
    for (let i = 0; i < 2; i++) rings += `<ellipse class="pi-ring" cx="42" cy="12" rx="4" ry="2" fill="none" stroke="#e9eef3" stroke-width="1.2" style="${v({ d: '3s', dl: f1(-i * 1.5) + 's' })}"/>`;
    return `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>${shadow(13)}
      <path d="M22 44c0-6 4.6-10 10-10s10 4 10 10-4.6 10-10 10-10-4-10-10z" fill="url(#${u}b)"/>
      <rect x="30.6" y="16" width="2.8" height="19" fill="#c9a24a"/><path d="M26 16h12l-2-5h-8z" fill="#c9a24a"/>
      <path d="M33 26c6 0 10 2 12 8" stroke="#7d838d" stroke-width="1.6" fill="none"/>${rings}`;
  };

  K.cigs = (P, R, u) => `${shadow(13)}
      <rect x="20" y="24" width="24" height="30" rx="2.4" fill="${P.a}"/><rect x="20" y="24" width="24" height="9" rx="2.4" fill="${P.c}"/>
      <rect x="27" y="14" width="4" height="12" fill="#f4f6f9"/><rect x="27" y="14" width="4" height="3" fill="#d9a441"/>
      ${steam(R, [29], 12, '#d7dde4', 9)}`;

  K.lighter = (P, R, u) => `<defs>${lin(u + 'f', [[0, '#ffe27a'], [.5, '#ff8a2a'], [1, '#e8411c']], true)}</defs>${shadow(10)}
      <rect x="24" y="28" width="16" height="27" rx="3" fill="${P.a}"/><rect x="24" y="22" width="16" height="7" rx="1.4" fill="#c9ced6"/>
      <path class="pi-flame" d="M32 21c-3.6-2.4-4-6.4-1.4-10 .4 2.4 1.8 3 2.8 2.8-.6-3.2.8-6.4 3.4-8-.2 3.4 2.6 5 2.6 8.6 0 3-2 5.6-4.4 6.6z" fill="url(#${u}f)" style="transform-origin:50% 100%;--d:.9s"/>`;

  K.bag = (P, R, u) => `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>${shadow(15)}
      <g class="pi-swing" style="transform-origin:50% 0%;--a:6deg;--d:3s">
        <path d="M26 22c0-6 2.6-9 6-9s6 3 6 9" fill="none" stroke="${P.c}" stroke-width="2"/>
        <path d="M17 22h30l2.6 32H14.4z" fill="url(#${u}b)"/><path d="M17 22h30" stroke="#fff" stroke-opacity=".4"/>
      </g>${sparkles(R, 2, [8, 8, 56, 24])}`;

  K.ice = (P, R, u) => {
    let cubes = '';
    [[20, 34], [33, 30], [26, 43], [38, 43]].forEach(([x, y], i) => { cubes += `<rect class="pi-bob" x="${x}" y="${y}" width="11" height="11" rx="2.4" fill="#dff4ff" fill-opacity=".75" stroke="#fff" stroke-width=".7" style="${v({ b: '-1.6px', d: '2.6s', dl: f1(-i * .6) + 's' })}"/>`; });
    return `${shadow(16)}${cubes}${sparkles(R, 4, [10, 10, 54, 40])}`;
  };

  K.gift = (P, R, u) => `<defs>${lin(u + 'b', [[0, P.l], [1, P.d]], true)}</defs>${shadow(15)}
      <rect x="17" y="30" width="30" height="24" rx="2.6" fill="url(#${u}b)"/><rect x="29.6" y="30" width="4.8" height="24" fill="${P.c}"/>
      <g class="pi-pop" style="transform-origin:50% 100%;--d:2.4s;--h:-4px">
        <rect x="15" y="23" width="34" height="8" rx="2" fill="${P.l}"/><rect x="29.6" y="23" width="4.8" height="8" fill="${P.c}"/>
        <path d="M32 23c-3-5-9-6-8.6-2.4.4 2.4 5.6 2.6 8.6 2.4zm0 0c3-5 9-6 8.6-2.4-.4 2.4-5.6 2.6-8.6 2.4z" fill="${P.c}"/>
      </g>${sparkles(R, 3, [8, 6, 56, 22])}`;

  /* =====================================================================
     which drawing, which colours — from the product name
     ===================================================================== */
  const BRAND_COLORS = [
    [/nivea|нивеа/, '#1d3f8f', '#ffffff'], [/dove|дав/, '#e9eef6', '#c9a24a', { cap: '#1d3f8f' }], [/\baxe\b|акс/, '#25262b', '#ff9a2e'],
    [/old\s*spice|олд спайс/, '#b3122e', '#ffffff'], [/rexona|рексона/, '#1f6fb2', '#9fe0ff'], [/\bclear\b|клеар|клиар/, '#123a7a', '#7fd0ff'],
    [/forx|форкс/, '#1c1c1f', '#ff7a1a'], [/viking|викинг/, '#16385f', '#c9d6e3'], [/garnier|гарньер/, '#2f8f45', '#c6f08a'],
    [/\bfa\b|\bфа\b/, '#1aa6b7', '#ffffff'], [/deonica|деоника/, '#7b3fa0', '#ffb3d6'], [/pro\s*series|про сериес/, '#121212', '#d9a441'],
    [/adidas|адидас/, '#111111', '#e9eef3'], [/head|хэд|шолдерс/, '#1d4fa0', '#ffffff'], [/palmolive|палмолив/, '#2f8f45', '#ffe27a'],
    [/gillette|жиллет/, '#1d3f8f', '#c9d6e3'], [/bic|бик/, '#ff8a00', '#1d3f8f']
  ];
  const WATER_CAPS = ['#1f6fd1', '#14a3c7', '#2f8f45', '#e8f1f8', '#7b3fa0'];

  function classify(product) {
    const name = norm(product && product.name);
    const cat = norm(product && (product.cat || product.category));
    const h = hash(name || 'товар'), R = rng(h);
    const hue = (h % 360);
    const vary = c => tone(c, between(rng(h ^ 0x9e3779b9), -6, 6), between(rng(h ^ 0x85ebca6b), -14, 14));
    const brand = BRAND_COLORS.find(([re]) => re.test(name));
    const brandPal = (fallback, acc) => brand ? palette(brand[1], brand[2], brand[3]) : palette(vary(fallback), acc);
    let kind = null, x = '', P = null;
    const is = re => re.test(name);

    if (is(/(^|\s)вход|билет|entry/)) { kind = 'entry'; x = is(/бонус/) ? 'bonus' : is(/дет/) ? 'kids' : ''; P = palette(x === 'kids' ? '#5aa9e6' : x === 'bonus' ? '#e04f5f' : '#e0a83a', x === 'bonus' ? '#ffe9a6' : '#fff4d6'); }
    else if (is(/энергет|energy|adrenaline|адреналин|flash|флеш|red ?bull|ред ?бул|burn|берн|gorilla|горилла|monster|монстр|tornado|торнадо/)) { kind = 'can'; x = 'energy'; P = palette(is(/red ?bull|ред ?бул/) ? '#2a4c9b' : vary('#1c1c22'), is(/adrenaline|адреналин/) ? '#ff5a1f' : '#a6ff3d', { b: '#fff' }); P.g = P.c; }
    else if (is(/coca|кока|(^|[\s-])cola|(^|[\s-])кола/) && !is(/pepsi|пепси|шоколад/)) { kind = 'can'; P = palette(is(/zero|зеро/) ? '#1d1d1f' : '#d9232d', '#7a0d14', { b: '#f4f6f9' }); }
    else if (is(/pepsi|пепси/)) { kind = 'can'; P = palette('#1f4fb5', '#e7303b', { b: '#ffffff' }); }
    else if (is(/fanta|фанта|mirinda|миринда/)) { kind = 'can'; P = palette('#ff8a00', '#2f8f45', { b: '#ffe27a' }); }
    else if (is(/sprite|спрайт|7 ?up|севен/)) { kind = 'can'; x = is(/mojito|мохито/) ? 'mint' : ''; P = palette(x ? '#1fa67a' : '#1e9e4b', x ? '#d8f7c6' : '#2a6fb6', { b: '#ffe27a' }); }
    else if (is(/fuse|fuze|фьюз|ice ?tea|айс ?ти|lipton|липтон/)) { kind = 'bottle'; x = 'tea'; P = palette('#c87a1e', '#f4e1b0', { cap: '#2f8f45', glass: '#ffcf7a' }); }
    else if (is(/жарма|jarma|zharma/)) { kind = 'bottle'; x = 'jarma'; P = palette('#e8cf9a', '#7a5320', { cap: '#c89a3c', glass: '#f4e3c0' }); P.c = '#f6ead0'; }
    else if (is(/максым|maksym|maksim/)) { kind = 'bottle'; x = 'grain'; P = palette('#a86b2a', '#5c3a17', { cap: '#d9a441', glass: '#d9a46a' }); }
    else if (is(/чалап|chalap/)) { kind = 'bottle'; x = 'milk'; P = palette('#f2f5f8', '#2a6fb6', { cap: '#2a6fb6', glass: '#e9f1f8' }); }
    else if (is(/(^|\s)тан(\s|$)|(^|\s)tan(\s|$)/)) { kind = 'bottle'; x = 'swirl'; P = palette('#f4f4ee', '#3fa7d6', { cap: '#3fa7d6', glass: '#eef6f8' }); }
    else if (is(/аралаш|aralash/)) { kind = 'bottle'; x = 'mix'; P = palette('#d9b27a', '#a0522d', { cap: '#e04f5f', glass: '#ead2a8' }); }
    else if (is(/шоро|shoro/)) { kind = 'bottle'; x = 'grain'; P = palette(vary('#c8964a'), '#7a1d1d', { cap: '#d9a441' }); }
    else if (is(/квас|kvass|kvas/)) { kind = 'mug'; P = palette('#6b3410', '#d9a441', { foam: '#f1d9b5' }); }
    else if (is(/пиво|beer|арпа|arpa|живое|живая|балтика|кибо|kibo|жигул|heineken|хайнекен|kozel|козел|бочков|разлив|лагер|lager/)) { kind = 'mug'; P = palette(is(/темн|dark|козел|kozel/) ? '#5a2a10' : vary('#e8a321'), '#fff', { foam: '#fff8e8' }); }
    else if (is(/айран|кымыз|кумыс|кефир|молок|бозо|ряженк|тан ?айран|сузьм/)) { kind = 'bowl'; P = palette(is(/бозо/) ? '#c9a46a' : '#8a5a2b', '#d9a441'); }
    else if (is(/(^|\s)сок|juice|нектар|морс|компот|gracio|грасио|piko|пико|rich|рич|добрый|фруктов/)) { kind = 'juice'; x = is(/яблок|apple/) ? 'apple' : is(/вишн|cherry|черешн/) ? 'cherry' : is(/персик|peach/) ? 'peach' : is(/апельсин|orange|мультифрукт/) ? 'orange' : ''; P = palette(x === 'apple' ? '#3f9f3a' : x === 'cherry' ? '#8a1730' : x === 'peach' ? '#ff8f5a' : x === 'orange' ? '#ff8a00' : vary('#e86b3a'), '#ffe27a'); }
    else if (is(/лимонад|тархун|мохито|mojito|lemonade|дюшес|байкал|буратино/)) { kind = 'glass'; x = is(/мохито|mojito|тархун/) ? 'mint' : ''; P = palette(is(/тархун/) ? '#3fbf5a' : is(/дюшес/) ? '#f2d27a' : is(/байкал/) ? '#6b3410' : vary('#f6d046'), '#fff', { straw: '#ff5a6e' }); }
    else if (is(/вода|water|минерал|legend|легенд|bonaqua|бонаква|аш-?суу|ысык|арашан|arashan|нарзан|боржом|газиров|без газа/)) { kind = 'bottle'; x = 'water'; P = palette('#5bb8ee', '#1f6fd1', { cap: WATER_CAPS[h % WATER_CAPS.length], glass: '#bfe6ff' }); if (is(/legend|легенд/)) { P.c = '#13315c'; P.cap = '#c9a24a'; } }
    else if (is(/кофе|coffee|капучино|латте|эспрессо|американо|nescafe|нескафе|3 ?в ?1|maccoffee|маккофе/)) { kind = 'coffee'; P = palette('#6b3a1e', '#d9a441'); }
    else if (is(/чай|(^|\s)tea|көк|кок чай|кара чай|chai/)) { kind = 'piala'; x = is(/лимон|lemon/) ? 'lemon' : is(/зелен|көк|кок|green/) ? 'green' : ''; P = palette(x === 'green' ? '#a9c24a' : x === 'lemon' ? '#e0a23a' : is(/трав|herb|ромаш|мят/) ? '#c46f3a' : '#9a3f12', '#2a6fb6', { b: '#d9a441' }); }
    else if (is(/(^|\s)л[её]д|(^|\s)ice(\s|$)/)) { kind = 'ice'; P = palette('#8fd3ff', '#fff'); }
    else if (is(/шашлык|кебаб|kebab|люля/)) { kind = 'skewer'; P = palette('#a4512a', '#ff8a2a'); P.g = '#ff8a2a'; }
    else if (is(/самса|samsa|пирож|чебурек|беляш|хачапури/)) { kind = 'samsa'; P = palette('#e0a050', '#fff'); }
    else if (is(/плов|лагман|манты|шорпо|(^|\s)суп|бешбармак|куурдак|пельмен|гуляш|ашлям|ашлянфу/)) { kind = 'hotbowl'; P = palette(vary('#f2f0ea'), '#2a6fb6', { food: is(/плов/) ? '#e8a84a' : is(/лагман|ашлям/) ? '#f2d27a' : '#d9773a' }); }
    else if (is(/хлеб|лепеш|(^|\s)нан(\s|$)|боорсок|баурсак|булк|лаваш/)) { kind = 'bread'; P = palette('#e0a050', '#fff'); }
    else if (is(/чипс|lays|лейс|pringles|принглс|читос|cheetos/)) { kind = 'chips'; P = palette(is(/lays|лейс/) ? '#e8b81f' : vary('#e8413c'), '#c4123d'); }
    else if (is(/сухар|кириешк|crackers|кракер|кракерс/)) { kind = 'chips'; P = palette(vary('#c46f3a'), '#ffe27a'); }
    else if (is(/арахис|орех|ореш|фисташ|семечк|миндал|кешью|nuts/)) { kind = 'nuts'; P = palette(vary('#8a5a2b'), '#d9a441'); }
    else if (is(/шоколад|сникерс|snickers|(^|\s)марс|mars|twix|твикс|bounty|баунти|kit ?kat|кит ?кат|батончик|alpen|альпен/)) { kind = 'choco'; P = palette('#4a2412', is(/bounty|баунти/) ? '#1f6fb2' : is(/twix|твикс/) ? '#d9a441' : is(/kit|кит/) ? '#d9232d' : vary('#8a1730')); }
    else if (is(/конфет|леденц|жвачк|орбит|orbit|мармелад|candy|чупа/)) { kind = 'candy'; P = palette(vary(hslHex(hue, 70, 55)), hslHex(hue + 40, 80, 70)); }
    else if (is(/(^|\s)м[её]д|(^|\s)бал(\s|$)|honey/)) { kind = 'jar'; x = 'honey'; P = palette('#f2a720', '#8a5a2b'); }
    else if (is(/(^|\s)соль|salt/)) { kind = 'jar'; x = 'salt'; P = palette('#f3c6d4', '#7b3fa0', { salt: is(/гимал|розов/) ? '#f3c6d4' : '#eef3f8' }); }
    else if (is(/скраб|scrub|крем|лосьон|cream|бальзам/)) { kind = 'jar'; P = brandPal('#e9d6c0', '#c9a24a'); }
    else if (is(/масло|эфирн|аромат|благовон|oil|эссенц/)) { kind = 'vial'; x = is(/аромат|благовон|эссенц/) ? 'aroma' : ''; P = palette(is(/эвкал/) ? '#3f9f7a' : is(/мят/) ? '#3fbf5a' : is(/лаванд/) ? '#8a5ac4' : vary('#c87a1e'), '#f4e1b0'); }
    else if (is(/веник/)) { kind = 'venik'; x = is(/дуб/) ? 'oak' : is(/эвкал/) ? 'euca' : is(/пихт|хвой|можжев|кедр|ель/) ? 'fir' : ''; P = palette('#6b8f2a', '#d9a441', { leaf: x === 'oak' ? '#4f7d2a' : x === 'euca' ? '#5aa58f' : x === 'fir' ? '#2f6b3a' : is(/лип/) ? '#9fc24a' : is(/крапив/) ? '#3f8f2a' : '#7cc451' }); P.g = P.leaf; }
    else if (is(/шапк|колпак|папах/)) { kind = 'hat'; P = palette(vary('#d9cdb4'), '#8a1730'); }
    else if (is(/тапоч|сланц|шлепан|тапк|обув|slippers/)) { kind = 'slippers'; P = palette(vary(hslHex(hue, 45, 42)), hslHex(hue + 180, 50, 70)); }
    else if (is(/халат/)) { kind = 'robe'; P = palette(vary('#f2efe8'), '#c9a24a'); }
    else if (is(/простын|sheet|покрывал|плед/)) { kind = 'towel'; x = 'sheet'; P = palette(vary('#e9eef3'), '#c9a24a'); }
    else if (is(/полотенц|towel/)) { kind = 'towel'; P = palette(vary(hslHex(hue, 38, 60)), hslHex(hue + 30, 70, 45)); }
    else if (is(/шорт|shorts/)) { kind = 'shorts'; x = is(/дет|kids/) ? 'kids' : is(/одноразов/) ? 'disposable' : ''; P = palette(x === 'disposable' ? vary('#5b7fa6') : x === 'kids' ? vary('#e8653a') : vary('#2b4c7e'), x === 'kids' ? '#ffe27a' : '#e9eef3'); }
    else if (is(/трус|плавк|брифы|боксер|underwear/)) { kind = 'briefs'; P = palette(vary(hslHex(hue, 40, 40)), '#e9eef3'); }
    else if (is(/носк|носок|socks/)) { kind = 'socks'; P = palette(vary(hslHex(hue, 25, 38)), hslHex(hue + 40, 60, 62)); }
    else if (is(/майк|футболк|рубашк|t-?shirt|тельняшк/)) { kind = 'tshirt'; P = palette(vary(hslHex(hue, 35, 52)), '#ffffff'); }
    else if (is(/мочалк|губк|loofah/)) { kind = 'loofah'; P = palette(vary(hslHex(hue, 65, 58)), '#fff'); }
    else if (is(/пилк|терк|пемз|скребок/)) { kind = 'file'; P = palette(vary('#c9b48a'), '#8a1730'); }
    else if (is(/пена для брит|гель для брит/)) { kind = 'deo'; P = brandPal('#e9eef3', '#1d3f8f'); }
    else if (is(/бритв|станок|gillette|жиллет|razor/)) { kind = 'razor'; P = brandPal('#2b2f36', '#ff7a1a'); }
    else if (is(/дезодорант|антиперспирант|rexona|рексона|old spice|олд спайс|(^|\s)axe|деоника|deonica|спрей|spray/)) { kind = 'deo'; P = brandPal('#2b4c7e', '#c9d6e3'); }
    else if (is(/шампун|shampoo|clear|клеар|head|хэд/)) { kind = 'shampoo'; P = brandPal('#2a6fb6', '#ffffff'); }
    else if (is(/гель|gel|для душа/)) { kind = 'gel'; P = brandPal('#3fa7d6', '#ffffff'); }
    else if (is(/мыло|soap/)) { kind = 'soap'; P = palette(vary(hslHex(hue, 45, 70)), hslHex(hue + 20, 60, 45)); }
    else if (is(/зубн|щетк|паст|toothbrush/)) { kind = 'brush'; P = palette(vary(hslHex(hue, 60, 50)), '#3fa7d6'); }
    else if (is(/расческ|гребен|comb/)) { kind = 'comb'; P = palette(vary(hslHex(hue, 30, 40)), '#fff'); }
    else if (is(/салфет|wipes|платоч/)) { kind = 'wipes'; P = palette(vary('#5bb8ee'), '#ffffff'); }
    else if (is(/ковш|черпак/)) { kind = 'ladle'; P = palette('#b07a3a', '#7fcbf0'); P.g = '#d39a55'; }
    else if (is(/(^|\s)таз|ведр|шайк|кадк/)) { kind = 'basin'; P = palette(vary('#b07a3a'), '#d9a441'); }
    else if (is(/массаж|пилинг|парени|парильщ|услуг|(^|\s)спа|spa|обертыв/)) { kind = 'spa'; P = palette('#5a5a66', '#c9a24a'); }
    else if (is(/кальян|hookah/)) { kind = 'hookah'; P = palette(vary('#2a6fb6'), '#c9a24a'); }
    else if (is(/сигарет|табак|cigar|ментол/)) { kind = 'cigs'; P = palette(vary('#3a3f48'), '#d9a441'); }
    else if (is(/зажигал|спичк|lighter/)) { kind = 'lighter'; P = palette(vary(hslHex(hue, 70, 45)), '#fff'); }
    else if (is(/пакет|сумк|(^|\s)bag/)) { kind = 'bag'; P = palette(vary('#c9a24a'), '#5c3a17'); }
    // the category says the rest
    else if (/напит|drink/.test(cat)) { kind = 'bottle'; P = palette(vary(hslHex(hue, 60, 52)), hslHex(hue + 30, 70, 40), { cap: hslHex(hue + 180, 50, 50) }); }
    else if (/чай/.test(cat)) { kind = 'piala'; P = palette('#9a3f12', '#2a6fb6', { b: '#d9a441' }); }
    else if (/шорт/.test(cat)) { kind = 'shorts'; P = palette(vary('#2b4c7e'), '#e9eef3'); }
    else if (/одежд/.test(cat)) { kind = 'tshirt'; P = palette(vary(hslHex(hue, 35, 52)), '#fff'); }
    else if (/снек/.test(cat)) { kind = 'chips'; P = palette(vary(hslHex(hue, 70, 50)), '#ffe27a'); }
    else if (/полотен/.test(cat)) { kind = 'towel'; P = palette(vary(hslHex(hue, 38, 60)), hslHex(hue + 30, 70, 45)); }
    else if (/гигиен/.test(cat)) { kind = 'soap'; P = palette(vary(hslHex(hue, 45, 70)), hslHex(hue + 20, 60, 45)); }
    else if (/бан|аксессуар/.test(cat)) { kind = 'ladle'; P = palette('#b07a3a', '#7fcbf0'); }
    else { kind = 'gift'; P = palette(hslHex(hue, 55, 48), hslHex(hue + 150, 75, 62)); }

    if (!P.b) P.b = '#ffffff';
    return { kind, x, P, seed: h, R };
  }

  /* =====================================================================
     markup
     ===================================================================== */
  function iconSvg(product) {
    const { kind, x, P, seed, R } = classify(product);
    const u = 'pi' + (++UID).toString(36);
    const inner = (K[kind] || K.gift)(P, R, u, x);
    const aura = `<radialGradient id="${u}au" cx="50%" cy="55%" r="50%"><stop offset="0" stop-color="${P.g || P.a}" stop-opacity=".5"/><stop offset=".6" stop-color="${P.g || P.a}" stop-opacity=".12"/><stop offset="1" stop-color="${P.g || P.a}" stop-opacity="0"/></radialGradient>`;
    const svg = `<svg class="pi-svg" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><defs>${aura}</defs><circle class="pi-aura" cx="32" cy="36" r="27" fill="url(#${u}au)"/>${inner}${sparkles(R, 2, [6, 6, 58, 24])}</svg>`;
    return { svg, kind, sig: kind + ':' + x + ':' + seed };
  }
  /* a real photo uploaded for the product stays — with a moving gloss; generated pictures from assets/products do not */
  function realPhoto(product) {
    const src = [product && product.image, product && product.img, product && product.photo, product && product.imageUrl]
      .find(s => typeof s === 'string' && s.trim());
    if (!src) return '';
    const s = src.trim();
    if (!/^(https:\/\/|data:image\/)/i.test(s)) return '';
    return s;
  }
  function markup(product, extraClass) {
    const name = String((product && product.name) || 'Товар');
    const photo = realPhoto(product);
    if (photo) {
      return `<span class="product-photo-wrap product-icon-wrap po-pi po-pi-photo ${esc(extraClass || '')}" role="img" aria-label="${esc(name)}" title="${esc(name)}" data-pi-sig="photo"><img src="${esc(photo)}" alt="${esc(name)}" loading="lazy" decoding="async"><i class="pi-gloss" aria-hidden="true"></i></span>`;
    }
    const ic = iconSvg(product || {});
    return `<span class="product-photo-wrap product-icon-wrap po-pi pi-${ic.kind} ${esc(extraClass || '')}" role="img" aria-label="${esc(name)}" title="${esc(name)}" data-pi-sig="${esc(ic.sig)}">${ic.svg}</span>`;
  }

  /* =====================================================================
     life: animate only what is on screen; the first time a product shows, it pops in
     ===================================================================== */
  const SEEN = new Set();
  const io = ('IntersectionObserver' in window) ? new IntersectionObserver(entries => {
    for (const e of entries) {
      const el = e.target;
      if (e.isIntersecting) {
        if (reduce) continue;
        el.classList.add('is-live');
        const key = (el.getAttribute('data-pi-sig') || '') + '|' + (el.closest('#productsView') ? 'inv' : el.closest('#addModal') ? 'add' : el.closest('#clientModal') ? 'cli' : 'x');
        if (!SEEN.has(key)) { SEEN.add(key); el.classList.add('is-in'); }
      } else el.classList.remove('is-live');
    }
  }, { rootMargin: '60px 0px' }) : null;
  function watch(root) {
    const list = root.matches && root.matches('.po-pi') ? [root] : $$('.po-pi', root);
    for (const el of list) {
      if (el.__piWatched) continue;
      el.__piWatched = true;
      if (io) io.observe(el);
      else if (!reduce) el.classList.add('is-live');
    }
  }

  function productById(id) {
    try { return (Array.isArray(db.products) ? db.products : []).find(p => Number(p.id) === Number(id)) || null; } catch (_) { return null; }
  }
  /* the smart inventory cards (#productsView) draw their own little tile: fill it */
  function decorateInventory(root) {
    $$('.po-si-mobile-product[data-po-mobile-product]', root || document).forEach(card => {
      const icon = $('.po-si-mobile-product-icon', card);
      const product = productById(card.getAttribute('data-po-mobile-product'));
      if (!icon || !product) return;
      const photo = realPhoto(product);
      const ic = photo ? null : iconSvg(product);
      const sig = photo ? 'photo:' + photo : ic.sig;
      if (icon.getAttribute('data-pi-sig') === sig && icon.querySelector('svg,img')) return;
      icon.setAttribute('data-pi-sig', sig);
      icon.classList.remove('po-v9-name-tile', 'po-v9-brand-logo', 'po-product-name-tile', 'po-visual-ready');
      icon.classList.add('po-pi');
      if (photo) { icon.classList.add('po-pi-photo'); icon.innerHTML = `<img src="${esc(photo)}" alt="" loading="lazy" decoding="async"><i class="pi-gloss" aria-hidden="true"></i>`; }
      else { icon.classList.remove('po-pi-photo'); icon.className = icon.className.replace(/\bpi-[a-z]+\b/g, '').trim() + ' pi-' + ic.kind; icon.innerHTML = ic.svg; }
      icon.setAttribute('role', 'img');
      icon.setAttribute('aria-label', String(product.name || 'Товар'));
      icon.removeAttribute('aria-hidden');
      icon.__piWatched = false;
      watch(icon);
    });
    // the wide (PC) table: a small live icon before the product name
    $$('.po-si-table tbody tr', root || document).forEach(row => {
      const cell = $('td.po-si-name', row);
      if (!cell) return;
      const ref = $('select[data-po-category],[data-po-edit-price],[data-po-edit-stock],[data-po-edit-cost]', row);
      const id = ref ? Number(ref.dataset.poCategory || ref.dataset.poEditPrice || ref.dataset.poEditStock || ref.dataset.poEditCost) : 0;
      let product = id ? productById(id) : null;
      if (!product) {
        const text = norm((cell.querySelector('.pi-name-text') || cell).childNodes[0] && (cell.querySelector('.pi-name-text') || cell).childNodes[0].textContent);
        try { product = (Array.isArray(db.products) ? db.products : []).find(p => norm(p.name) === text) || null; } catch (_) { product = null; }
      }
      if (!product) return;
      const photo = realPhoto(product);
      const ic = photo ? null : iconSvg(product);
      const sig = photo ? 'photo:' + photo : ic.sig;
      const have = $('.po-pi.pi-row', cell);
      if (have && have.getAttribute('data-pi-sig') === sig) return;
      if (!cell.querySelector('.pi-namewrap')) {
        const wrap = document.createElement('span');
        wrap.className = 'pi-namewrap';
        const textBox = document.createElement('span');
        textBox.className = 'pi-name-text';
        while (cell.firstChild) textBox.appendChild(cell.firstChild);
        wrap.appendChild(textBox);
        cell.appendChild(wrap);
      }
      const holder = document.createElement('span');
      holder.innerHTML = photo
        ? `<span class="po-pi po-pi-photo pi-row" data-pi-sig="${esc(sig)}" role="img" aria-label="${esc(product.name)}"><img src="${esc(photo)}" alt="" loading="lazy" decoding="async"><i class="pi-gloss" aria-hidden="true"></i></span>`
        : `<span class="po-pi pi-row pi-${ic.kind}" data-pi-sig="${esc(sig)}" role="img" aria-label="${esc(product.name)}">${ic.svg}</span>`;
      const el = holder.firstElementChild;
      if (have) have.replaceWith(el); else cell.querySelector('.pi-namewrap').prepend(el);
      watch(el);
    });
  }

  function install() {
    window.productPhotoMarkup = markup;
    const mo = new MutationObserver(muts => {
      let inv = false;
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType !== 1) continue;
          if (n.classList && n.classList.contains('po-pi')) watch(n);
          else if (n.querySelector && n.querySelector('.po-pi')) watch(n);
          if (!inv && n.closest && (n.closest('#productsGrid') || n.closest('#productsView') || (n.querySelector && n.querySelector('.po-si-mobile-product,.po-si-table')))) inv = true;
        }
      }
      if (inv) decorateInventory(document.getElementById('productsView') || document);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    // redraw what was drawn before this module
    try { if (typeof window.renderInventory === 'function') window.renderInventory(); } catch (_) {}
    try { if (typeof window.renderAddProductGrid === 'function') window.renderAddProductGrid(); } catch (_) {}
    try { const m = document.getElementById('clientModal'); if (m && m.classList.contains('open') && typeof window.renderClientModal === 'function') window.renderClientModal(); } catch (_) {}
    decorateInventory(document);
    watch(document.body);
  }

  window.PARORDOProductIcons = { version: VERSION, render: markup, classify: p => { const c = classify(p); return { kind: c.kind, variant: c.x, palette: c.P }; }, decorate: decorateInventory };
  // keep the old name for modules that ask «which visuals are active»
  window.PARORDOProductVisuals = Object.freeze({ version: '8.0.0-icons', resolve: p => ({ type: realPhoto(p) ? 'image' : 'icon' }), render: markup });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
