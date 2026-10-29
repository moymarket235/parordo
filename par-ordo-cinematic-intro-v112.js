/* PAR ORDO PRO V112 — cinematic identity reveal.
   Replaces V111's intro script file; does not change login, auth, API or bracelet logic.
   Lightweight CSS/DOM animation; no video, canvas loop, or continuous requestAnimationFrame. */
(() => {
  'use strict';
  if (document.querySelector('.po-cinematic-intro')) return;

  const reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const scriptUrl = document.currentScript?.src || location.href;
  const appBase = new URL('./', scriptUrl);
  const logoUrl = new URL('./assets/par-ordo-logo.png', appBase).href;
  const bgUrl = new URL('./assets/par-ordo-spa-background.webp', appBase).href;
  const duration = reducedMotion ? 900 : 4700;

  const style = document.createElement('style');
  style.id = 'par-ordo-cinematic-intro-style-v112';
  style.textContent = `
  .po-cinematic-intro{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:hidden;isolation:isolate;background:#030504;color:#fff0ca;opacity:1;visibility:visible;pointer-events:auto;contain:layout paint style}
  .po-cinematic-intro *{box-sizing:border-box}
  .po-intro-scene{position:absolute;inset:-3%;z-index:-5;pointer-events:none;background-image:linear-gradient(180deg,rgba(2,5,3,.25),rgba(2,5,3,.18) 38%,rgba(2,5,3,.75)),url("${bgUrl}");background-position:center center;background-size:cover;background-repeat:no-repeat;animation:po112Scene 4.7s cubic-bezier(.16,.68,.18,1) both}
  .po-intro-vignette{position:absolute;inset:0;z-index:-4;pointer-events:none;background:radial-gradient(ellipse at 50% 43%,rgba(255,192,78,.08) 0,transparent 29%,rgba(0,0,0,.18) 56%,rgba(0,0,0,.78) 100%),linear-gradient(180deg,rgba(0,0,0,.04),transparent 24%,rgba(0,0,0,.32))}
  .po112-spotlight{position:absolute;inset:-18% -50%;z-index:-3;pointer-events:none;background:linear-gradient(103deg,transparent 38%,rgba(255,190,73,.015) 44%,rgba(255,213,129,.14) 49%,rgba(255,179,53,.035) 53%,transparent 60%);transform:translateX(-65%) rotate(-3deg);animation:po112Sweep 2.8s cubic-bezier(.15,.7,.15,1) .18s both}
  .po-intro-light{position:absolute;left:50%;top:42%;width:min(88vw,500px);aspect-ratio:1;transform:translate(-50%,-50%) scale(.28);border-radius:50%;pointer-events:none;background:radial-gradient(circle,rgba(255,199,93,.22) 0,rgba(240,153,28,.1) 28%,rgba(211,119,17,.025) 53%,transparent 69%);opacity:0;animation:po112Light 3.8s ease-out both}
  .po-intro-ring{position:absolute;left:50%;top:42%;width:min(68vw,330px);aspect-ratio:1;transform:translate(-50%,-50%) scale(.45) rotate(-70deg);border-radius:50%;border:1px solid rgba(255,209,111,0);opacity:0;pointer-events:none;box-shadow:0 0 0 rgba(255,184,60,0),inset 0 0 0 rgba(255,190,70,0);animation:po112Ring 3.8s cubic-bezier(.16,.72,.18,1) both}
  .po-intro-ring::before,.po-intro-ring::after{content:"";position:absolute;inset:9px;border-radius:50%;border:1px solid rgba(255,207,112,.22)}
  .po-intro-ring::after{inset:17px;border-style:dashed;border-color:rgba(255,201,91,.19)}
  .po-intro-ring.ring-two{width:min(82vw,400px);border-style:dashed;border-color:rgba(255,191,69,0);animation:po112RingTwo 4.1s linear both}
  .po-intro-ring.ring-three{width:min(48vw,235px);border-color:rgba(255,226,159,0);animation:po112RingThree 3.7s cubic-bezier(.16,.72,.18,1) both}
  .po112-orbit-arc{position:absolute;left:50%;top:42%;width:min(74vw,360px);aspect-ratio:1;border-radius:50%;border:2px solid transparent;border-top-color:rgba(255,218,138,0);border-right-color:rgba(255,197,85,0);transform:translate(-50%,-50%) rotate(0);pointer-events:none;animation:po112Arc 3.4s cubic-bezier(.18,.7,.12,1) .25s both}
  .po112-scan{position:absolute;left:50%;top:42%;width:min(92vw,480px);height:1px;background:linear-gradient(90deg,transparent,rgba(255,220,145,.05),rgba(255,227,166,.95),rgba(255,185,56,.2),transparent);box-shadow:0 0 15px rgba(255,189,68,.45);opacity:0;transform:translate(-50%,-50%) scaleX(.06);pointer-events:none;animation:po112Scan 1.5s cubic-bezier(.15,.7,.12,1) .48s both}
  .po-intro-particles{position:absolute;inset:0;pointer-events:none;overflow:hidden}
  .po-intro-particle{position:absolute;left:var(--x);top:var(--y);width:var(--s);height:var(--s);border-radius:50%;opacity:0;background:radial-gradient(circle,#fff8d9 0,#ffca65 42%,rgba(221,128,22,0) 78%);box-shadow:0 0 6px rgba(255,184,63,.7);animation:po112Particle var(--d) cubic-bezier(.17,.65,.2,1) var(--delay) both}
  .po-intro-core{position:relative;z-index:2;width:min(88vw,460px);display:flex;flex-direction:column;align-items:center;text-align:center;transform:translateY(-2vh);animation:po112Core 4.7s cubic-bezier(.18,.7,.2,1) both}
  .po-intro-seal{position:relative;width:clamp(130px,35vw,184px);height:clamp(130px,35vw,184px);display:grid;place-items:center;border-radius:50%;padding:8px;opacity:0;border:1px solid rgba(255,216,131,.94);background:radial-gradient(circle,rgba(255,189,68,.24),rgba(7,9,5,.76) 67%);box-shadow:0 0 0 5px rgba(237,168,48,.08),0 0 0 12px rgba(237,168,48,.025),0 0 34px rgba(244,171,43,.25),inset 0 0 25px rgba(255,204,99,.18);transform:perspective(760px) rotateX(26deg) rotateY(-30deg) rotateZ(-15deg) scale(.42);animation:po112Seal 3.7s cubic-bezier(.16,.78,.18,1) .16s both}
  .po-intro-seal::before,.po-intro-seal::after{content:"";position:absolute;inset:-12px;border-radius:50%;border:1px solid rgba(255,214,128,.4);pointer-events:none}
  .po-intro-seal::before{border-left-color:rgba(255,214,128,.9);border-bottom-color:rgba(255,214,128,.08);animation:po112SealOrbit 3.2s linear .12s both}
  .po-intro-seal::after{inset:-23px;border-style:dashed;border-color:rgba(255,196,79,.22);animation:po112SealOrbitBack 3.4s linear .08s both}
  .po-intro-logo{display:block;width:100%;height:100%;object-fit:contain;border-radius:50%}
  .po-intro-wordmark{margin:23px 0 0;font:700 clamp(30px,8vw,43px)/1 Georgia,'Times New Roman',serif;letter-spacing:.17em;padding-left:.17em;color:#ffe4a1;text-shadow:0 2px 8px #000,0 0 24px rgba(255,184,53,.34);opacity:0;transform:translateY(15px);animation:po112Text .68s cubic-bezier(.18,.72,.2,1) 1.04s both}
  .po-intro-subtitle{margin:12px 0 0;font:650 11px/1.5 system-ui,sans-serif;letter-spacing:.31em;color:#fff4d7;opacity:0;animation:po112Text .6s ease-out 1.24s both}
  .po-intro-ecosystem{margin:7px 0 0;font:750 9px/1.45 system-ui,sans-serif;letter-spacing:.22em;color:#f4c96f;opacity:0;animation:po112Text .6s ease-out 1.42s both}
  .po-intro-divider{width:min(54vw,230px);height:1px;margin-top:20px;opacity:0;background:linear-gradient(90deg,transparent,rgba(255,212,124,.85),transparent);box-shadow:0 0 12px rgba(255,191,66,.22);animation:po112Text .4s ease-out 1.5s both}
  .po-intro-tagline{margin:14px 0 0;font:550 10px/1.7 system-ui,sans-serif;letter-spacing:.16em;color:rgba(255,245,219,.82);opacity:0;animation:po112Text .55s ease-out 1.58s both}
  .po-intro-progress{width:min(53vw,230px);height:3px;margin-top:25px;overflow:hidden;border-radius:999px;background:rgba(255,255,255,.12);opacity:0;animation:po112Text .35s ease-out 1.35s both}
  .po-intro-progress span{display:block;width:100%;height:100%;background:linear-gradient(90deg,#9a5f1b,#ffe8a5,#db8c21);transform:scaleX(0);transform-origin:left;box-shadow:0 0 11px rgba(255,189,63,.7);animation:po112Progress 4.25s linear both}
  .po-intro-skip{position:absolute;z-index:5;right:max(18px,env(safe-area-inset-right));bottom:max(22px,env(safe-area-inset-bottom));min-height:42px;padding:10px 15px;border:1px solid rgba(255,205,106,.45);border-radius:999px;background:rgba(5,8,5,.74);color:#ffebc0;font:700 11px system-ui,sans-serif;letter-spacing:.06em}
  .po-intro-skip:focus-visible{outline:2px solid #ffe39a;outline-offset:3px}
  .po-cinematic-intro.is-leaving{pointer-events:none;animation:po112Exit .58s cubic-bezier(.7,0,.84,0) forwards}
  .po-cinematic-intro.is-leaving .po-intro-core{animation:po112FinalCore .58s cubic-bezier(.16,.7,.2,1) forwards}
  .po-cinematic-intro.is-leaving .po112-spotlight{animation:po112FinalSweep .58s ease-out forwards}
  @keyframes po112Scene{0%{transform:scale(1.12);filter:brightness(.35) saturate(.72)}32%{filter:brightness(.72) saturate(.96)}100%{transform:scale(1);filter:brightness(.9) saturate(1.08)}}
  @keyframes po112Sweep{0%{transform:translateX(-65%) rotate(-3deg);opacity:0}22%{opacity:1}100%{transform:translateX(50%) rotate(-3deg);opacity:.65}}
  @keyframes po112Light{0%{opacity:0;transform:translate(-50%,-50%) scale(.18)}24%{opacity:1}58%{opacity:.85;transform:translate(-50%,-50%) scale(1.12)}100%{opacity:.24;transform:translate(-50%,-50%) scale(1.3)}}
  @keyframes po112Ring{0%{opacity:0;transform:translate(-50%,-50%) scale(.24) rotate(-85deg);border-color:rgba(255,197,79,0);box-shadow:0 0 0 rgba(247,169,44,0)}24%{opacity:.92;border-color:rgba(255,212,126,.88)}58%{opacity:.8;transform:translate(-50%,-50%) scale(1) rotate(110deg);box-shadow:0 0 25px rgba(247,169,44,.27),inset 0 0 18px rgba(247,169,44,.14)}100%{opacity:.1;transform:translate(-50%,-50%) scale(1.17) rotate(180deg)}}
  @keyframes po112RingTwo{0%,10%{opacity:0;transform:translate(-50%,-50%) scale(.18) rotate(0)}29%{opacity:.5}62%{opacity:.28;transform:translate(-50%,-50%) scale(1.07) rotate(220deg)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.29) rotate(310deg)}}
  @keyframes po112RingThree{0%,22%{opacity:0;transform:translate(-50%,-50%) scale(.35)}46%{opacity:.72;border-color:rgba(255,225,157,.74)}78%{opacity:.16;transform:translate(-50%,-50%) scale(1.12)}100%{opacity:0;transform:translate(-50%,-50%) scale(1.22)}}
  @keyframes po112Arc{0%{opacity:0;transform:translate(-50%,-50%) rotate(-120deg) scale(.5);border-top-color:rgba(255,218,138,0);border-right-color:rgba(255,197,85,0)}34%{opacity:.95;border-top-color:rgba(255,218,138,.95);border-right-color:rgba(255,197,85,.55)}100%{opacity:0;transform:translate(-50%,-50%) rotate(210deg) scale(1.07)}}
  @keyframes po112Scan{0%{opacity:0;transform:translate(-50%,-50%) scaleX(.04)}26%{opacity:1}65%{opacity:.75;transform:translate(-50%,-50%) scaleX(1)}100%{opacity:0;transform:translate(-50%,-50%) scaleX(1.12)}}
  @keyframes po112Particle{0%{opacity:0;transform:translate3d(var(--dx),var(--dy),0) scale(.15)}18%{opacity:.92}52%{opacity:.76;transform:translate3d(0,0,0) scale(1)}78%{opacity:.5}100%{opacity:0;transform:translate3d(calc(var(--dx)*-.5),calc(var(--dy)*-.5),0) scale(.1)}}
  @keyframes po112Seal{0%{opacity:0;transform:perspective(760px) rotateX(42deg) rotateY(-42deg) rotateZ(-22deg) scale(.16)}18%{opacity:1;transform:perspective(760px) rotateX(16deg) rotateY(12deg) rotateZ(9deg) scale(.82)}31%{transform:perspective(760px) rotateX(-3deg) rotateY(-2deg) rotateZ(-2deg) scale(1.09)}42%{transform:perspective(760px) rotateX(0) rotateY(0) rotateZ(0) scale(1)}82%{opacity:1;transform:scale(1)}100%{opacity:1;transform:scale(.96)}}
  @keyframes po112SealOrbit{0%{transform:rotate(-30deg) scale(.72);opacity:0}28%{opacity:.9}100%{transform:rotate(285deg) scale(1.04);opacity:.18}}
  @keyframes po112SealOrbitBack{0%,20%{opacity:0;transform:rotate(0) scale(.78)}46%{opacity:.68}100%{opacity:.12;transform:rotate(-255deg) scale(1.08)}}
  @keyframes po112Text{0%{opacity:0;transform:translateY(17px);letter-spacing:.38em}100%{opacity:1;transform:translateY(0)}}
  @keyframes po112Core{0%{transform:translateY(2vh) scale(.97)}22%{transform:translateY(0) scale(1)}83%{transform:translateY(0) scale(1)}100%{transform:translateY(-1vh) scale(1.02)}}
  @keyframes po112Progress{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}
  @keyframes po112Exit{0%{opacity:1;visibility:visible}100%{opacity:0;visibility:hidden}}
  @keyframes po112FinalCore{0%{transform:translateY(-1vh) scale(1);opacity:1}100%{transform:translateY(-2vh) scale(.96);opacity:0}}
  @keyframes po112FinalSweep{0%{transform:translateX(-35%) rotate(-3deg);opacity:0}40%{opacity:1}100%{transform:translateX(40%) rotate(-3deg);opacity:0}}
  @media(min-width:700px){.po-intro-seal{width:170px;height:170px}.po-intro-wordmark{font-size:44px}.po-intro-tagline{font-size:12px}}
  @media(max-height:620px){.po-intro-seal{width:clamp(100px,25vh,150px);height:clamp(100px,25vh,150px)}.po-intro-wordmark{margin-top:15px}.po-intro-tagline{margin-top:8px}.po-intro-progress{margin-top:15px}}
  @media(prefers-reduced-motion:reduce){.po-intro-scene,.po112-spotlight,.po-intro-light,.po-intro-ring,.po112-orbit-arc,.po112-scan,.po-intro-seal,.po-intro-seal::before,.po-intro-seal::after,.po-intro-wordmark,.po-intro-subtitle,.po-intro-ecosystem,.po-intro-divider,.po-intro-tagline,.po-intro-progress,.po-intro-progress span,.po-intro-core,.po-intro-particle{animation-duration:.01ms!important;animation-delay:0ms!important}.po-intro-particle{display:none}}
  `;
  document.head.appendChild(style);

  const overlay = document.createElement('div');
  overlay.className = 'po-cinematic-intro';
  overlay.setAttribute('role', 'status');
  overlay.setAttribute('aria-label', 'ПАР ОРДО PRO загружается');

  const particles = [];
  if (!reducedMotion) {
    const count = Math.min(30, Math.max(16, Math.floor(window.innerWidth / 14)));
    for (let i = 0; i < count; i++) {
      const node = document.createElement('span');
      node.className = 'po-intro-particle';
      node.style.cssText =
        `--x:${(10 + Math.random() * 80).toFixed(1)}%;` +
        `--y:${(10 + Math.random() * 80).toFixed(1)}%;` +
        `--s:${(1.5 + Math.random() * 2.5).toFixed(1)}px;` +
        `--d:${(2.1 + Math.random() * .85).toFixed(2)}s;` +
        `--delay:${(Math.random() * .38).toFixed(2)}s;` +
        `--dx:${(-52 + Math.random() * 104).toFixed(0)}px;` +
        `--dy:${(-65 + Math.random() * 130).toFixed(0)}px;`;
      particles.push(node);
    }
  }

  overlay.innerHTML = `
    <div class="po-intro-scene" aria-hidden="true"></div>
    <div class="po-intro-vignette" aria-hidden="true"></div>
    <div class="po112-spotlight" aria-hidden="true"></div>
    <div class="po-intro-light" aria-hidden="true"></div>
    <div class="po-intro-ring" aria-hidden="true"></div>
    <div class="po-intro-ring ring-two" aria-hidden="true"></div>
    <div class="po-intro-ring ring-three" aria-hidden="true"></div>
    <div class="po112-orbit-arc" aria-hidden="true"></div>
    <div class="po112-scan" aria-hidden="true"></div>
    <div class="po-intro-particles" aria-hidden="true"></div>
    <div class="po-intro-core">
      <div class="po-intro-seal"><img class="po-intro-logo" src="${logoUrl}" alt="ПАР ОРДО" fetchpriority="high"></div>
      <h1 class="po-intro-wordmark">ПАР ОРДО</h1>
      <p class="po-intro-subtitle">ПРЕМИУМ СИСТЕМА</p>
      <p class="po-intro-ecosystem">AZA DIGITAL ECOSYSTEM</p>
      <div class="po-intro-divider" aria-hidden="true"></div>
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
    }, reducedMotion ? 50 : 600);
  };
  overlay.querySelector('.po-intro-skip').addEventListener('click', finish, { once: true });
  const onKey = (event) => { if (event.key === 'Escape') finish(); };
  window.addEventListener('keydown', onKey, { once: true });
  timer = window.setTimeout(finish, duration);
})();
