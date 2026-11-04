/* PAR ORDO LIVE DIGITAL TWIN — FULLSCREEN & ZOOM ENHANCEMENT v1.0
   Additive UI enhancement. Does not change API, bookings, payments or client records.
*/
(() => {
  'use strict';

  const STYLE_ID = 'poDtFullscreenEnhancementStyle';
  const SCRIPT_ID = 'poDtFullscreenEnhancement';
  let activePanel = null;
  let observer = null;
  let previousOverlayOverflow = '';
  let fullscreen = false;
  let zoom = 1;

  const STYLE = `
    #poCeoOverlay .po-dt-heading-actions{align-items:center}
    #poCeoOverlay .po-dt-expand,
    #poCeoOverlay .po-dt-zoom-controls button{
      min-height:34px;padding:7px 10px;border:1px solid rgba(218,181,111,.58);
      border-radius:10px;background:linear-gradient(140deg,#705020,#21190e);
      color:#ffebbf;font-size:9px;font-weight:950;white-space:nowrap;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.09),0 4px 12px rgba(0,0,0,.2)
    }
    #poCeoOverlay .po-dt-expand{border-color:rgba(76,222,151,.58);background:linear-gradient(140deg,#155b3c,#10271b);color:#a4f2c4}
    #poCeoOverlay .po-dt-zoom-controls{display:flex;align-items:center;gap:5px;flex:0 0 auto}
    #poCeoOverlay .po-dt-zoom-controls button{width:30px;padding:5px;font-size:14px}
    #poCeoOverlay .po-dt-zoom-label{min-width:38px;text-align:center;color:#ddc18a;font-size:8px;font-weight:900}
    #poCeoOverlay .po-dt-map-scroll{scroll-behavior:smooth}
    #poCeoOverlay .po-dt-panel.po-dt-fullscreen{
      position:fixed!important;inset:0!important;z-index:100002!important;
      width:100vw!important;height:100vh!important;height:100dvh!important;
      max-height:100vh!important;max-height:100dvh!important;
      margin:0!important;padding:calc(10px + env(safe-area-inset-top)) 12px calc(12px + env(safe-area-inset-bottom))!important;
      border:0!important;border-radius:0!important;overflow:auto!important;
      background:radial-gradient(ellipse at 50% 0,rgba(33,91,64,.23),transparent 44%),#050b08!important;
      box-shadow:none!important
    }
    #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-heading{
      position:sticky;top:0;z-index:20;padding:10px 2px 12px;
      background:rgba(5,12,8,.94);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)
    }
    #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-workspace{min-height:0}
    #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-map-scroll{
      max-height:calc(100dvh - 270px);min-height:280px;overflow:auto
    }
    #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-map{
      height:auto;max-width:none
    }
    #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-map-foot{position:sticky;bottom:0;background:#07100c}
    #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-guest-footer{margin-bottom:8px}
    #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-disclaimer{padding-bottom:8px}
    @media(max-width:760px){
      #poCeoOverlay .po-dt-heading-actions{gap:5px}
      #poCeoOverlay .po-dt-expand{min-height:32px;padding:6px 8px;font-size:8px}
      #poCeoOverlay .po-dt-zoom-controls{gap:3px}
      #poCeoOverlay .po-dt-zoom-controls button{width:27px;min-height:31px;padding:4px;font-size:13px}
      #poCeoOverlay .po-dt-zoom-label{min-width:32px;font-size:7px}
      #poCeoOverlay .po-dt-panel.po-dt-fullscreen{padding-left:8px!important;padding-right:8px!important}
      #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-workspace{grid-template-columns:minmax(0,1fr)!important}
      #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-map-scroll{max-height:58dvh;min-height:300px}
      #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-map{min-width:1040px}
      #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-zone-nav{grid-template-columns:repeat(3,minmax(0,1fr))}
      #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-zone-nav button{font-size:8px}
      #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-live-stats{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
    @media(min-width:761px){
      #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-workspace{grid-template-columns:132px minmax(0,1fr) 150px}
      #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-map-scroll{max-height:calc(100dvh - 260px);min-height:420px}
      #poCeoOverlay .po-dt-panel.po-dt-fullscreen .po-dt-map{min-width:980px}
    }
  `;

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function setMapZoom(panel, nextZoom) {
    zoom = Math.max(0.8, Math.min(1.6, Math.round(nextZoom * 10) / 10));
    const svg = panel.querySelector('#poDtMap');
    const scroll = panel.querySelector('.po-dt-map-scroll');
    const label = panel.querySelector('#poDtZoomLabel');
    if (!svg) return;
    if (!fullscreen && window.innerWidth > 760 && zoom === 1) {
      svg.style.width = '100%';
      svg.style.minWidth = '720px';
    } else {
      const baseWidth = window.innerWidth <= 760 ? (fullscreen ? 1040 : 820) : (fullscreen ? 1120 : 900);
      const width = Math.round(baseWidth * zoom);
      svg.style.width = width + 'px';
      svg.style.minWidth = width + 'px';
    }
    if (label) label.textContent = Math.round(zoom * 100) + '%';
    if (scroll && fullscreen) {
      const max = Math.max(0, width - scroll.clientWidth);
      scroll.scrollLeft = Math.min(scroll.scrollLeft, max);
    }
  }

  function setFullscreen(panel, enabled) {
    if (!panel) return;
    const overlay = document.getElementById('poCeoOverlay');
    fullscreen = Boolean(enabled);
    panel.classList.toggle('po-dt-fullscreen', fullscreen);
    const button = panel.querySelector('#poDtExpand');
    if (button) {
      button.textContent = fullscreen ? '↙ Свернуть 3D' : '⛶ Полный экран 3D';
      button.setAttribute('aria-pressed', fullscreen ? 'true' : 'false');
    }
    if (fullscreen) {
      previousOverlayOverflow = overlay ? overlay.style.overflow : '';
      if (overlay) overlay.style.overflow = 'hidden';
    } else {
      if (overlay) overlay.style.overflow = previousOverlayOverflow;
    }
    setMapZoom(panel, zoom);
  }

  function addControls(panel) {
    if (!panel || panel.dataset.poDtEnhanced === 'true') return;
    const actions = panel.querySelector('.po-dt-heading-actions');
    const toolbar = panel.querySelector('.po-dt-map-toolbar');
    if (!actions || !toolbar) return;

    const expand = document.createElement('button');
    expand.type = 'button';
    expand.id = 'poDtExpand';
    expand.className = 'po-dt-expand';
    expand.textContent = '⛶ Полный экран 3D';
    expand.setAttribute('aria-pressed', 'false');
    expand.addEventListener('click', () => setFullscreen(panel, !fullscreen));
    actions.appendChild(expand);

    const controls = document.createElement('div');
    controls.className = 'po-dt-zoom-controls';
    controls.innerHTML = `
      <button type="button" id="poDtZoomOut" aria-label="Уменьшить карту">−</button>
      <span class="po-dt-zoom-label" id="poDtZoomLabel">100%</span>
      <button type="button" id="poDtZoomIn" aria-label="Увеличить карту">+</button>
      <button type="button" id="poDtZoomReset" aria-label="Сбросить масштаб">↺</button>
    `;
    toolbar.appendChild(controls);
    controls.querySelector('#poDtZoomOut').addEventListener('click', () => setMapZoom(panel, zoom - 0.1));
    controls.querySelector('#poDtZoomIn').addEventListener('click', () => setMapZoom(panel, zoom + 0.1));
    controls.querySelector('#poDtZoomReset').addEventListener('click', () => {
      const scroll = panel.querySelector('.po-dt-map-scroll');
      setMapZoom(panel, 1);
      if (scroll) scroll.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    });

    panel.dataset.poDtEnhanced = 'true';
    setMapZoom(panel, 1);
  }

  function scan() {
    const panel = document.getElementById('poDtLivePanel');
    const overlay = document.getElementById('poCeoOverlay');
    if (panel && panel !== activePanel) {
      if (activePanel && fullscreen) setFullscreen(activePanel, false);
      activePanel = panel;
      fullscreen = false;
      zoom = 1;
      addControls(panel);
    } else if (panel && panel.dataset.poDtEnhanced !== 'true') {
      addControls(panel);
    }
    if ((!overlay || !overlay.classList.contains('po-ceo-open')) && fullscreen) {
      setFullscreen(activePanel, false);
    }
  }

  function onKeydown(event) {
    if (event.key === 'Escape' && fullscreen && activePanel) {
      event.preventDefault();
      event.stopImmediatePropagation();
      setFullscreen(activePanel, false);
    }
  }

  function boot() {
    if (document.getElementById(SCRIPT_ID)) return;
    const marker = document.createElement('meta');
    marker.id = SCRIPT_ID;
    marker.name = 'po-dt-enhancement';
    document.head.appendChild(marker);
    ensureStyle();
    observer = new MutationObserver(scan);
    observer.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class']
    });
    document.addEventListener('keydown', onKeydown, true);
    window.addEventListener('resize', () => {
      if (activePanel && activePanel.dataset.poDtEnhanced === 'true') setMapZoom(activePanel, zoom);
    });
    scan();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
