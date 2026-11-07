/* PAR ORDO CONTROL V83 — horizontal CLEAN CONTROL PRO launcher
   Opens the existing clean-control.html page; does not alter shift logic. */
(() => {
  'use strict';
  const ID = 'poCleanControlLauncherV83';
  const STYLE_ID = 'poCleanControlLauncherV83Style';

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ID}{
        width:100%;min-height:82px;margin:12px 0 15px;padding:12px 15px;
        display:grid;grid-template-columns:54px minmax(0,1fr) auto;align-items:center;gap:12px;
        border:1px solid #b88a43;border-radius:19px;text-decoration:none;color:#fff2d6;
        background:linear-gradient(105deg,rgba(17,47,31,.98),rgba(10,23,17,.98) 58%,rgba(35,22,9,.98));
        box-shadow:0 8px 24px rgba(0,0,0,.28),inset 0 0 22px rgba(89,216,151,.06);
        -webkit-tap-highlight-color:transparent;transition:transform .16s ease,border-color .16s ease,box-shadow .16s ease;
      }
      #${ID}:hover,#${ID}:focus-visible{border-color:#75e5a8;box-shadow:0 0 0 2px rgba(80,218,145,.16),0 10px 28px rgba(0,0,0,.32);outline:none}
      #${ID}:active{transform:scale(.992)}
      #${ID} .po-cc-icon{width:50px;height:50px;border-radius:15px;display:grid;place-items:center;
        border:1px solid rgba(105,231,165,.55);background:linear-gradient(145deg,#164b30,#092619);color:#8af3b5;
        font-size:27px;font-weight:900;box-shadow:0 0 22px rgba(77,227,151,.16)}
      #${ID} .po-cc-copy{display:block;min-width:0}
      #${ID} .po-cc-copy strong{display:block;color:#ffe2a0;font:900 14px/1.25 system-ui,-apple-system,Segoe UI,sans-serif;letter-spacing:.08em}
      #${ID} .po-cc-copy small{display:block;margin-top:5px;color:#c0d7c6;font-size:11px;line-height:1.35}
      #${ID} .po-cc-side{display:flex;align-items:center;gap:8px;color:#88efb2;font-weight:850;white-space:nowrap}
      #${ID} .po-cc-side small{font-size:10px;letter-spacing:.06em}
      #${ID} .po-cc-arrow{width:34px;height:34px;border:1px solid rgba(110,231,164,.4);border-radius:50%;display:grid;place-items:center;font-size:19px}
      @media(max-width:380px){#${ID}{grid-template-columns:45px minmax(0,1fr) auto;padding:10px;gap:9px;min-height:74px}#${ID} .po-cc-icon{width:43px;height:43px}#${ID} .po-cc-copy strong{font-size:12px}#${ID} .po-cc-copy small{font-size:9px}#${ID} .po-cc-side small{display:none}}
      @media(prefers-reduced-motion:reduce){#${ID}{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function mount() {
    const shiftSlot = document.getElementById('shiftControl');
    if (!shiftSlot || document.getElementById(ID)) return;
    const link = document.createElement('a');
    link.id = ID;
    link.href = './clean-control.html';
    link.setAttribute('aria-label', 'Открыть CLEAN CONTROL PRO — 25 задач в 3 разделах');
    link.innerHTML = `
      <span class="po-cc-icon" aria-hidden="true">✓</span>
      <span class="po-cc-copy"><strong>CLEAN CONTROL PRO</strong><small>25 задач · 3 раздела · контроль выполнения и проверка</small></span>
      <span class="po-cc-side"><small>ОТКРЫТЬ</small><span class="po-cc-arrow" aria-hidden="true">→</span></span>`;
    shiftSlot.insertAdjacentElement('afterend', link);
  }

  function boot() {
    addStyle();
    mount();
    const observer = new MutationObserver(mount);
    observer.observe(document.body || document.documentElement, { childList:true, subtree:true });
    window.setTimeout(() => observer.disconnect(), 15000);
    window.addEventListener('pageshow', mount);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
