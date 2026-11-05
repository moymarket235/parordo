/* PAR ORDO — FIT TO SCREEN + COPY CLEANUP v9
   Additive presentation layer only. Does not touch API, bookings, cash, stock or auth.
*/
(() => {
  'use strict';

  const SCRIPT_ID = 'poDtFitScreenV9';
  const STYLE_ID = 'poDtFitScreenV9Style';
  let panel = null;
  let scrollBox = null;
  let mapSvg = null;
  let resizeObserver = null;
  let mutationObserver = null;
  let scale = 1;
  let lastWidth = 0;

  const STYLE = `
    #poCeoOverlay .po-dt-map-toolbar{
      display:flex;flex-wrap:wrap;align-items:center;gap:7px
    }
    #poCeoOverlay .po-dt-map-toolbar .po-dt-motion-key{
      flex:1 1 140px;min-width:120px
    }
    #poCeoOverlay .po-dt-fit-screen{
      flex:0 0 auto;min-height:32px;padding:7px 10px;
      border:1px solid rgba(77,224,154,.65);border-radius:10px;
      color:#b5ffd1;background:linear-gradient(145deg,#174c32,#0a2116);
      font:900 8px/1.2 Arial,sans-serif;letter-spacing:.04em;
      box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 3px 10px rgba(0,0,0,.2)
    }
    #poCeoOverlay .po-dt-fit-screen:active{transform:translateY(1px)}
    #poCeoOverlay .po-dt-map-scroll{
      width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;
      overscroll-behavior-x:contain;scrollbar-width:thin
    }
    #poCeoOverlay .po-dt-map-scroll svg#poDtMap{
      display:block;height:auto!important;max-width:none!important;
      aspect-ratio:2/1;flex:0 0 auto
    }
    #poCeoOverlay .po-dt-map-foot{
      flex-wrap:wrap;align-items:center
    }
    #poCeoOverlay .po-dt-map-foot span{max-width:100%}
    @media(max-width:760px){
      #poCeoOverlay .po-dt-map-toolbar{gap:5px;padding:8px}
      #poCeoOverlay .po-dt-map-toolbar .po-dt-motion-key{flex:1 1 120px}
      #poCeoOverlay .po-dt-fit-screen{font-size:7px;padding:6px 8px;min-height:30px}
      #poCeoOverlay .po-dt-map-foot{font-size:7px}
    }
  `;

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function mapWidth() {
    if (!scrollBox) return 0;
    const rect = scrollBox.getBoundingClientRect();
    return Math.floor(rect.width || scrollBox.clientWidth || 0);
  }

  function applyScale(resetScroll = false) {
    if (!mapSvg || !scrollBox) return;
    const available = mapWidth();
    if (available < 80) return;

    const target = Math.max(240, Math.round(available * scale));
    mapSvg.style.setProperty('width', target + 'px', 'important');
    mapSvg.style.setProperty('min-width', target + 'px', 'important');
    mapSvg.style.setProperty('max-width', 'none', 'important');
    mapSvg.style.setProperty('height', 'auto', 'important');
    mapSvg.style.setProperty('display', 'block', 'important');

    const label = panel && panel.querySelector('#poDtZoomLabel');
    if (label) label.textContent = Math.round(scale * 100) + '%';

    const fitButton = panel && panel.querySelector('#poDtFitScreen');
    if (fitButton) fitButton.setAttribute('aria-pressed', scale === 1 ? 'true' : 'false');

    const maxScroll = Math.max(0, target - scrollBox.clientWidth);
    if (resetScroll || scale === 1) {
      scrollBox.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (scrollBox.scrollLeft > maxScroll) {
      scrollBox.scrollLeft = maxScroll;
    }
    lastWidth = available;
  }

  function setScale(next, resetScroll = false) {
    scale = Math.max(0.65, Math.min(1.6, Math.round(next * 10) / 10));
    applyScale(resetScroll);
  }

  function cleanCopy() {
    if (!panel) return;
    const foot = panel.querySelector('.po-dt-map-foot');
    if (foot) {
      const spans = foot.querySelectorAll('span');
      if (spans[0]) spans[0].textContent = 'Вся карта помещается на экран · + увеличивает детали';
      if (spans[1]) spans[1].textContent = 'Активные номера браслетов · взрослые / детские';
    }

    const disclaimer = panel.querySelector('.po-dt-disclaimer');
    if (disclaimer) {
      disclaimer.textContent =
        'Номера показаны в условных зонах для визуализации активности. Карта не определяет реальное местоположение гостей.';
    }

    const selected = panel.querySelector('#poDtSelectedGuest');
    if (selected && /движущ|двигающ|маршрут/i.test(selected.textContent || '')) {
      selected.innerHTML =
        '<b>Выберите браслет</b><small>Нажмите на активный номер, чтобы посмотреть категорию и статус</small>';
    }

    const heading = panel.querySelector('.po-dt-heading p');
    if (heading) {
      heading.textContent =
        'На карте отображаются только активные номера браслетов: взрослые — зелёные, детские — синие';
    }
  }

  function interceptButton(id, handler) {
    const button = panel && panel.querySelector('#' + id);
    if (!button || button.dataset.poFitIntercepted === 'true') return;
    button.dataset.poFitIntercepted = 'true';
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      handler();
    }, true);
  }

  function addFitButton() {
    const toolbar = panel && panel.querySelector('.po-dt-map-toolbar');
    if (!toolbar || toolbar.querySelector('#poDtFitScreen')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'poDtFitScreen';
    button.className = 'po-dt-fit-screen';
    button.textContent = '⤢ ВЕСЬ КОМПЛЕКС';
    button.title = 'Показать весь план комплекса на экране';
    button.setAttribute('aria-label', 'Показать всю карту на экране');
    button.addEventListener('click', () => setScale(1, true));
    toolbar.appendChild(button);
  }

  function attachZoom() {
    interceptButton('poDtZoomIn', () => setScale(scale + 0.1));
    interceptButton('poDtZoomOut', () => setScale(scale - 0.1));
    interceptButton('poDtZoomReset', () => setScale(1, true));

    // Let the existing fullscreen logic run, then refit the map to the new viewport.
    const full = panel && panel.querySelector('#poDtExpand');
    if (full && full.dataset.poFitResize !== 'true') {
      full.dataset.poFitResize = 'true';
      full.addEventListener('click', () => {
        window.setTimeout(() => applyScale(true), 80);
        window.setTimeout(() => applyScale(true), 280);
      }, true);
    }
  }

  function observeMapSize() {
    if (resizeObserver) resizeObserver.disconnect();
    if (!scrollBox || !('ResizeObserver' in window)) return;
    resizeObserver = new ResizeObserver(() => {
      const nextWidth = mapWidth();
      if (nextWidth && nextWidth !== lastWidth) applyScale(true);
    });
    resizeObserver.observe(scrollBox);
  }

  function scan() {
    const nextPanel = document.getElementById('poDtLivePanel');
    if (!nextPanel) return;

    if (nextPanel !== panel) {
      panel = nextPanel;
      scrollBox = panel.querySelector('.po-dt-map-scroll');
      mapSvg = panel.querySelector('#poDtMap');
      scale = 1;
      if (resizeObserver) resizeObserver.disconnect();
      observeMapSize();
    } else {
      scrollBox = panel.querySelector('.po-dt-map-scroll');
      mapSvg = panel.querySelector('#poDtMap');
    }

    if (!scrollBox || !mapSvg) return;
    addStyle();
    addFitButton();
    attachZoom();
    cleanCopy();
    if (!mapSvg.dataset.poDtFitApplied) {
      mapSvg.dataset.poDtFitApplied = 'true';
      applyScale(true);
    }
  }

  function boot() {
    if (document.getElementById(SCRIPT_ID)) return;
    const marker = document.createElement('meta');
    marker.id = SCRIPT_ID;
    marker.name = 'po-dt-fit-screen';
    document.head.appendChild(marker);
    addStyle();

    mutationObserver = new MutationObserver(scan);
    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['id', 'class']
    });

    window.addEventListener('resize', () => {
      if (panel) applyScale(true);
    }, { passive: true });

    scan();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
