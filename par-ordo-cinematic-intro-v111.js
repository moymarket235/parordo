/* PAR ORDO PRO V111 — cinematic intro before the existing sign-in screen.
   Lightweight CSS-only animation; preserves all existing authentication and app logic. */
(() => {
  'use strict';
  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base = new URL('./', document.currentScript?.src || location.href);
  const logoUrl = new URL('./assets/par-ordo-logo.png', base).href;
  const bgUrl = new URL('./assets/par-ordo-spa-background.webp', base).href;

  const style = document.createElement('style');
  style.id = 'par-ordo-cinematic-intro-style-v111';
  style.textContent = `
  .po-cinematic-intro{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:hidden;isolation:isolate;background:#030504;color:#fff0ca;opacity:1;visibility:visible;pointer-events:auto;}
  .po-cinematic-intro *{box-sizing:border-box}
  .po-intro-scene{position:absolute;inset:-2%;z-index:-3;background-image:linear-gradient(180deg,rgba(2,5,3,.43),rgba(2,5,3,.36) 40%,rgba(2,5,3,.82)),url("${bgUrl}");background-position:center center;background-size:cover;background-repeat:no-repeat;filter:saturate(1.08);animation:poIntroScene 4.1s ease-out both;}
  .po-intro-vignette{position:absolute;inset:0;z-index:-2;background:radial-gradient(ellipse at 50% 46%,transparent 0,rgba(0,0,0,.08) 36%,rgba(0,0,0,.76) 100%),linear-gradient(180deg,rgba(0,0,0,.14),transparent 30%,rgba(0,0,0,.37));}
  .po-intro-light{position:absolute;left:50%;top:45%;width:min(78vw,440px);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,rgba(249,179,61,.2) 0,rgba(230,141,25,.08) 35%,transparent 68%);filter:blur(8px);animation:poIntroLight 3.8s ease-out both;}
  .po-intro-ring{position:absolute;left:50%;top:45%;width:min(58vw,280px);aspect-ratio:1;border:1px solid rgba(255,203,99,.0);border-radius:50%;transform:translate(-50%,-50%) scale(.42);opacity:0;box-shadow:0 0 22px rgba(247,169,44,0),inset 0 0 16px rgba(247,169,44,0);animation:poIntroRing 3.8s cubic-bezier(.15,.7,.14,1) both;}
  .po-intro-ring.ring-two{width:min(72vw,350px);border-style:dashed;animation:poIntroRingTwo 3.8s cubic-bezier(.15,.7,.14,1) both;}
  .po-intro-ring.ring-three{width:min(44vw,220px);border-color:rgba(255,207,116,.0);animation:poIntroRingThree 3.8s ease-out both;}
  .po-intro-particles{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .po-intro-particle{position:absolute;left:var(--x);top:var(--y);width:var(--s);height:var(--s);border-radius:50%;opacity:0;background:radial-gradient(circle,#fff0bc 0,#ffc354 42%,rgba(221,128,22,0) 75%);box-shadow:0 0 10px rgba(255,184,63,.8);animation:poIntroParticle var(--d) cubic-bezier(.17,.65,.2,1) var(--delay) both;}
  .po-intro-core{position:relative;z-index:2;width:min(86vw,440px);display:flex;flex-direction:column;align-items:center;text-align:center;transform:translateY(-1vh);animation:poIntroCore 3.8s cubic-bezier(.18,.7,.2,1) both;}
  .po-intro-logo-wrap{position:relative;width:clamp(100px,28vw,156px);height:clamp(100px,28vw,156px);display:grid;place-items:center;border:1px solid rgba(255,206,102,.8);border-radius:50%;padding:7px;background:radial-gradient(circle,rgba(247,184,72,.17),rgba(4,7,4,.6) 68%);box-shadow:0 0 0 6px rgba(239,166,49,.08),0 0 42px rgba(231,151,30,.22),inset 0 0 24px rgba(255,204,99,.13);opacity:0;animation:poIntroLogo 3.8s cubic-bezier(.16,.72,.17,1) both;}
  .po-intro-logo-wrap::before,.po-intro-logo-wrap::after{content:"";position:absolute;inset:-12px;border:1px solid rgba(255,195,79,.36);border-radius:50%;animation:poIntroOrbit 3.8s ease-out both;}
  .po-intro-logo-wrap::after{inset:-22px;border-style:dashed;border-color:rgba(255,195,79,.16);animation:poIntroOrbitReverse 3.8s linear both;}
  .po-intro-logo{width:100%;height:100%;object-fit:contain;border-radius:50%;filter:drop-shadow(0 0 13px rgba(255,183,60,.42));}
  .po-intro-title{margin:24px 0 0;font:700 clamp(28px,7vw,39px)/1.03 Georgia,'Times New Roman',serif;letter-spacing:.12em;color:#ffdf95;text-shadow:0 2px 10px #000,0 0 28px rgba(245,175,57,.2);opacity:0;animation:poIntroText .72s ease-out 1.05s both;}
  .po-intro-subtitle{margin:11px 0 0;font:600 11px/1.5 system-ui,sans-serif;letter-spacing:.28em;color:#fff3d4;opacity:0;animation:poIntroText .62s ease-out 1.35s both;}
  .po-intro-ecosystem{margin:8px 0 0;font:700 9px/1.5 system-ui,sans-serif;letter-spacing:.19em;color:#d8b66c;opacity:0;animation:poIntroText .62s ease-out 1.55s both;}
  .po-intro-tagline{margin:28px 0 0;font:500 11px/1.6 system-ui,sans-serif;letter-spacing:.12em;color:rgba(255,245,219,.78);opacity:0;animation:poIntroText .55s ease-out 1.7s both;}
  .po-intro-progress{width:min(54vw,230px);height:3px;margin-top:24px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.12);opacity:0;animation:poIntroText .4s ease-out 1.45s both;}
  .po-intro-progress span{display:block;width:100%;height:100%;background:linear-gradient(90deg,#9a5f1b,#ffe39a,#db8c21);transform:scaleX(0);transform-origin:left;box-shadow:0 0 13px rgba(255,189,63,.85);animation:poIntroProgress 3.55s linear both;}
  .po-intro-skip{position:absolute;z-index:5;right:max(18px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom));min-height:40px;padding:9px 14px;border:1px solid rgba(255,205,106,.4);border-radius:999px;background:rgba(5,8,5,.58);color:#ffebc0;font:650 11px system-ui,sans-serif;letter-spacing:.06em;backdrop-filter:none;-webkit-backdrop-filter:none;}
  .po-cinematic-intro.is-leaving{animation:poIntroExit .55s ease-in forwards;pointer-events:none}
  @keyframes poIntroScene{0%{transform:scale(1.11);filter:brightness(.54) saturate(.65)}25%{filter:brightness(.78) saturate(.9)}65%{transform:scale(1.03);filter:brightness(.83) saturate(1.05)}100%{transform:scale(1);filter:brightness(.8) saturate(1.08)}}
  @keyframes poIntroLight{0%{opacity:0;transform:translate(-50%,-50%) scale(.2)}20%{opacity:1}55%{opacity:.86;transform:translate(-50%,-50%) scale(1.16)}100%{opacity:.3;transform:translate(-50%,-50%) scale(1.38)}}
  @keyframes poIntroRing{0%{opacity:0;transform:translate(-50%,-50%) scale(.35) rotate(-60deg);border-color:rgba(255,197,79,0);box-shadow:0 0 0 rgba(247,169,44,0)}20%{opacity:.9;border-color:rgba(255,197,79,.82)}55%{opacity:.85;transform:translate(-50%,-50%) scale(1) rotate(110deg);box-shadow:0 0 28px rgba(247,169,44,.28)}88%{opacity:.45}100%{opacity:0;transform:translate(-50%,-50%) scale(1.18) rotate(160deg)}}
  @keyframes poIntroRingTwo{0%,12%{opacity:0;transform:translate(-50%,-50%) scale(.22) rotate(0)}30%{opacity:.56}62%{opacity:.38;transform:translate(-50%,-50%) scale(1.08) rotate(210deg)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.32) rotate(300deg)}}
  @keyframes poIntroRingThree{0%,25%{opacity:0;transform:translate(-50%,-50%) scale(.4)}45%{opacity:.65;border-color:rgba(255,218,136,.6)}78%{opacity:.18;transform:translate(-50%,-50%) scale(1.12)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.25)}}
  @keyframes poIntroOrbit{0%{transform:scale(.7) rotate(0);opacity:0}25%{opacity:.8}75%{transform:scale(1.08) rotate(200deg);opacity:.5}100%{transform:scale(1.14) rotate(300deg);opacity:0}}
  @keyframes poIntroOrbitReverse{0%,22%{opacity:0;transform:rotate(0) scale(.8)}40%{opacity:.7}100%{opacity:0;transform:rotate(-280deg) scale(1.12)}}
  @keyframes poIntroParticle{0%{opacity:0;transform:translate3d(var(--dx),var(--dy),0) scale(.2)}18%{opacity:.95}55%{opacity:.8;transform:translate3d(0,0,0) scale(1)}100%{opacity:0;transform:translate3d(calc(var(--dx)*-.65),calc(var(--dy)*-.65),0) scale(.1)}}
  @keyframes poIntroLogo{0%{opacity:0;transform:perspective(700px) rotateX(38deg) rotateY(-28deg) rotateZ(-18deg) scale(.18);filter:blur(18px) brightness(2.7)}17%{opacity:1;transform:perspective(700px) rotateX(15deg) rotateY(10deg) rotateZ(8deg) scale(.82);filter:blur(1px) brightness(1.9)}31%{transform:perspective(700px) rotateX(0) rotateY(0) rotateZ(-2deg) scale(1.08);filter:blur(0) brightness(1.25)}42%{transform:perspective(700px) rotateX(0) rotateY(0) rotateZ(0) scale(1);filter:brightness(1)}78%{opacity:1;transform:scale(1)}100%{opacity:0;transform:translateY(-8px) scale(.91)}}
  @keyframes poIntroText{0%{opacity:0;filter:blur(8px);transform:translateY(12px);letter-spacing:.34em}100%{opacity:1;filter:blur(0);transform:translateY(0)}}
  @keyframes poIntroCore{0%{transform:translateY(2vh) scale(.97)}20%{transform:translateY(0) scale(1)}78%{transform:translateY(0) scale(1)}100%{transform:translateY(-2vh) scale(1.02)}}
  @keyframes poIntroProgress{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}
  @keyframes poIntroExit{to{opacity:0;visibility:hidden;filter:blur(4px)}}
  @media(min-width:700px){.po-intro-logo-wrap{width:144px;height:144px}.po-intro-title{font-size:38px}.po-intro-tagline{font-size:12px}}
  @media(prefers-reduced-motion:reduce){.po-intro-scene,.po-intro-light,.po-intro-ring,.po-intro-logo-wrap,.po-intro-logo-wrap::before,.po-intro-logo-wrap::after,.po-intro-title,.po-intro-subtitle,.po-intro-ecosystem,.po-intro-tagline,.po-intro-progress,.po-intro-progress span,.po-intro-core,.po-intro-particle{animation-duration:.01ms!important;animation-delay:0ms!important}.po-intro-particle{display:none}}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'po-cinematic-intro';
  overlay.setAttribute('role','status');
  overlay.setAttribute('aria-label','ПАР ОРДО PRO загружается');
  const particles = [];
  if (!reducedMotion) {
    const count = Math.min(36, Math.max(18, Math.floor(window.innerWidth / 12)));
    for (let i=0;i<count;i++) {
      const span = document.createElement('span');
      span.className = 'po-intro-particle';
      const x = 7 + Math.random()*86;
      const y = 8 + Math.random()*84;
      const size = 2 + Math.random()*3.5;
      span.style.cssText = `--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;--s:${size.toFixed(1)}px;--d:${(2.1+Math.random()*1.2).toFixed(2)}s;--delay:${(Math.random()*.45).toFixed(2)}s;--dx:${(-60+Math.random()*120).toFixed(0)}px;--dy:${(-90+Math.random()*180).toFixed(0)}px;`;
      particles.push(span);
    }
  }
  overlay.innerHTML = `
    <div class="po-intro-scene" aria-hidden="true"></div>
    <div class="po-intro-vignette" aria-hidden="true"></div>
    <div class="po-intro-light" aria-hidden="true"></div>
    <div class="po-intro-ring" aria-hidden="true"></div><div class="po-intro-ring ring-two" aria-hidden="true"></div><div class="po-intro-ring ring-three" aria-hidden="true"></div>
    <div class="po-intro-particles" aria-hidden="true"></div>
    <div class="po-intro-core">
      <div class="po-intro-logo-wrap"><img class="po-intro-logo" src="${logoUrl}" alt="ПАР ОРДО" fetchpriority="high"></div>
      <h1 class="po-intro-title">ПАР ОРДО</h1>
      <p class="po-intro-subtitle">ПРЕМИУМ СИСТЕМА</p>
      <p class="po-intro-ecosystem">AZA DIGITAL ECOSYSTEM</p>
      <p class="po-intro-tagline">ОТДЫХ · ЗДОРОВЬЕ · КОМФОРТ</p>
      <div class="po-intro-progress" aria-hidden="true"><span></span></div>
    </div>
    <button type="button" class="po-intro-skip">Пропустить →</button>`;
  overlay.querySelector('.po-intro-particles').append(...particles);
  document.body.appendChild(overlay);

  let ended = false;
  let timer = null;
  const finish = () => {
    if (ended) return;
    ended = true;
    if (timer) clearTimeout(timer);
    overlay.classList.add('is-leaving');
    window.setTimeout(() => {
      overlay.remove();
      style.remove();
    }, reducedMotion ? 30 : 560);
  };
  overlay.querySelector('.po-intro-skip').addEventListener('click',finish,{once:true});
  timer = window.setTimeout(finish, reducedMotion ? 450 : 4100);
})();
