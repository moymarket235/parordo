/* PAR ORDO — FIT TO SCREEN V10 (observer-loop fix)
   UI-only add-on. Does not modify API, authentication, bookings, payments or records.
*/
(() => {
  'use strict';
  const MARKER='poDtFitScreenV10';
  const STYLE='poDtFitScreenV10Style';
  let panel=null, scroll=null, map=null, zoom=1, ready=false;

  const css=`
    #poCeoOverlay .po-dt-map-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:7px}
    #poCeoOverlay .po-dt-map-toolbar .po-dt-motion-key{flex:1 1 130px;min-width:110px}
    #poCeoOverlay .po-dt-fit-screen{
      flex:0 0 auto;min-height:32px;padding:7px 10px;border:1px solid rgba(77,224,154,.65);
      border-radius:10px;color:#b5ffd1;background:linear-gradient(145deg,#174c32,#0a2116);
      font:900 8px/1.2 Arial,sans-serif;letter-spacing:.04em
    }
    #poCeoOverlay .po-dt-map-scroll{width:100%;max-width:100%;overflow-x:auto;overflow-y:hidden;overscroll-behavior-x:contain}
    #poCeoOverlay .po-dt-map-scroll #poDtMap{
      display:block;height:auto!important;max-width:none!important;aspect-ratio:2/1;flex:0 0 auto
    }
    #poCeoOverlay .po-dt-map-foot{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between}
    @media(max-width:760px){
      #poCeoOverlay .po-dt-map-toolbar{gap:5px;padding:8px}
      #poCeoOverlay .po-dt-fit-screen{font-size:7px;padding:6px 8px}
      #poCeoOverlay .po-dt-map-foot{font-size:7px}
    }`;

  function ensureStyle(){
    if(document.getElementById(STYLE))return;
    const el=document.createElement('style');
    el.id=STYLE;el.textContent=css;document.head.appendChild(el);
  }
  function setText(el,value){
    if(el && el.textContent!==value) el.textContent=value;
  }
  function availableWidth(){
    return Math.floor(scroll?.getBoundingClientRect().width || scroll?.clientWidth || 0);
  }
  function applyZoom(reset=false){
    if(!map||!scroll)return;
    const available=availableWidth();
    if(available<80)return;
    const width=Math.max(240,Math.round(available*zoom));
    map.style.setProperty('width',width+'px','important');
    map.style.setProperty('min-width',width+'px','important');
    map.style.setProperty('max-width','none','important');
    map.style.setProperty('height','auto','important');
    const label=panel.querySelector('#poDtZoomLabel');
    setText(label,Math.round(zoom*100)+'%');
    if(reset||zoom===1)scroll.scrollLeft=0;
    else scroll.scrollLeft=Math.min(scroll.scrollLeft,Math.max(0,width-scroll.clientWidth));
  }
  function changeZoom(value,reset=false){
    zoom=Math.max(.65,Math.min(1.6,Math.round(value*10)/10));
    applyZoom(reset);
  }
  function addFitButton(){
    const toolbar=panel.querySelector('.po-dt-map-toolbar');
    if(!toolbar||toolbar.querySelector('#poDtFitScreen'))return;
    const button=document.createElement('button');
    button.type='button';button.id='poDtFitScreen';button.className='po-dt-fit-screen';
    button.textContent='⤢ ВЕСЬ КОМПЛЕКС';
    button.setAttribute('aria-label','Показать всю карту на экране');
    button.addEventListener('click',()=>changeZoom(1,true));
    toolbar.appendChild(button);
  }
  function interceptZoomButtons(){
    const bindings=[
      ['poDtZoomIn',()=>changeZoom(zoom+.1)],
      ['poDtZoomOut',()=>changeZoom(zoom-.1)],
      ['poDtZoomReset',()=>changeZoom(1,true)]
    ];
    for(const [id,fn] of bindings){
      const button=panel.querySelector('#'+id);
      if(!button||button.dataset.poDtV10Bound==='1')continue;
      button.dataset.poDtV10Bound='1';
      button.addEventListener('click',event=>{
        event.preventDefault();event.stopImmediatePropagation();fn();
      },true);
    }
  }
  function cleanText(){
    const foot=panel.querySelector('.po-dt-map-foot');
    const spans=foot?.querySelectorAll('span');
    setText(spans?.[0],'Вся карта помещается на экран · + увеличивает детали');
    setText(spans?.[1],'Активные номера браслетов · взрослые / детские');

    const disclaimer=panel.querySelector('.po-dt-disclaimer');
    setText(disclaimer,'Номера показаны в условных зонах для визуализации активности. Карта не определяет реальное местоположение гостей.');

    const heading=panel.querySelector('.po-dt-heading p');
    setText(heading,'На карте отображаются только активные номера браслетов: взрослые — зелёные, детские — синие');

    const selected=panel.querySelector('#poDtSelectedGuest');
    if(selected && /движущ|двигающ|маршрут/i.test(selected.textContent||'')){
      selected.innerHTML='<b>Выберите браслет</b><small>Нажмите на активный номер, чтобы посмотреть категорию и статус</small>';
    }
  }
  function install(){
    const next=document.getElementById('poDtLivePanel');
    if(!next)return false;
    const nextScroll=next.querySelector('.po-dt-map-scroll');
    const nextMap=next.querySelector('#poDtMap');
    const toolbar=next.querySelector('.po-dt-map-toolbar');
    if(!nextScroll||!nextMap||!toolbar)return false;

    panel=next;scroll=nextScroll;map=nextMap;
    ensureStyle();addFitButton();interceptZoomButtons();cleanText();
    if(!ready){
      ready=true;zoom=1;
      applyZoom(true);
      const full=panel.querySelector('#poDtExpand');
      if(full){
        full.addEventListener('click',()=> {
          window.setTimeout(()=>applyZoom(true),100);
          window.setTimeout(()=>applyZoom(true),350);
        });
      }
      window.addEventListener('resize',()=>applyZoom(true),{passive:true});
      if('ResizeObserver'in window){
        const ro=new ResizeObserver(()=>applyZoom(true));
        ro.observe(scroll);
      }
    }
    return true;
  }
  function boot(){
    if(document.getElementById(MARKER))return;
    const marker=document.createElement('meta');marker.id=MARKER;document.head.appendChild(marker);
    ensureStyle();
    // Wait only until the CEO panel is fully created, then stop observing the whole page.
    if(install())return;
    const observer=new MutationObserver(()=>{
      if(install())observer.disconnect();
    });
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
