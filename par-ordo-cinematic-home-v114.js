/* PAR ORDO CINEMATIC HOME V114
   Reference-inspired fluid particle intro: dark canvas, blue/violet/coral energy orb,
   twisting helix, horizontal wave and particle burst. Shared by site, staff, manager, CEO.
   No external libraries, API calls, storage writes, or backend changes.
*/
(() => {
  'use strict';
  if (window.PARORDOCinematicHome && window.PARORDOCinematicHome.version === '114') return;

  const VERSION = '114';
  const DURATION = 5200;
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const $ = (selector, root = document) => root.querySelector(selector);
  let active = null, queuedMode = null, lastPlayAt = 0, activePanel = '', lastCeoOpen = false;

  const labels = {
    SITE: { eyebrow: 'ПРЕМИАЛЬНЫЙ ОПЫТ ОТДЫХА', title: 'PAR ORDO', subtitle: 'CINEMATIC HOME EXPERIENCE', tagline: 'ОТДЫХ · ЗДОРОВЬЕ · КОМФОРТ' },
    STAFF: { eyebrow: 'СОТРУДНИК · WORKSPACE', title: 'PAR ORDO', subtitle: 'STAFF CONTROL EXPERIENCE', tagline: 'СМЕНА · КЛИЕНТЫ · CLEAN CONTROL PRO' },
    MANAGER: { eyebrow: 'РУКОВОДИТЕЛЬ · OWNER INTELLIGENCE', title: 'PAR ORDO', subtitle: 'MANAGEMENT EXPERIENCE', tagline: 'КОНТРОЛЬ · АНАЛИТИКА · УПРАВЛЕНИЕ' },
    CEO: { eyebrow: 'CEO MODE · LIVE MANAGEMENT', title: 'PAR ORDO', subtitle: 'OWNER INTELLIGENCE', tagline: 'DIGITAL TWIN · ENGINEERING · BUSINESS SIGNALS' }
  };

  const css = `
  #po114-cinematic{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;overflow:hidden;isolation:isolate;background:#02030a;color:#f5f6ff;opacity:1;visibility:visible;pointer-events:auto;contain:layout paint style;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
  #po114-cinematic *{box-sizing:border-box}
  #po114-cinematic .po114-bg{position:absolute;inset:0;z-index:-4;background:radial-gradient(ellipse at 50% 42%,rgba(35,40,91,.3),transparent 48%),radial-gradient(ellipse at 18% 58%,rgba(116,38,80,.13),transparent 40%),linear-gradient(155deg,#02030a 0%,#080a18 52%,#02030a 100%)}
  #po114-cinematic canvas{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}
  #po114-cinematic .po114-vignette{position:absolute;inset:0;z-index:0;pointer-events:none;background:radial-gradient(ellipse at 50% 45%,transparent 18%,rgba(1,2,8,.16) 58%,rgba(1,2,8,.8) 100%),linear-gradient(180deg,rgba(1,2,8,.22),transparent 28%,transparent 72%,rgba(1,2,8,.52)}
  #po114-cinematic .po114-content{position:relative;z-index:2;width:min(92vw,760px);padding:24px 18px 34px;text-align:center;display:flex;flex-direction:column;align-items:center;transform:translateY(1vh);animation:po114Content 5.2s cubic-bezier(.18,.7,.2,1) both;pointer-events:none}
  #po114-cinematic .po114-kicker{margin:0;color:#d9d9f8;font-size:clamp(9px,2.1vw,12px);font-weight:750;letter-spacing:.3em;text-transform:uppercase;text-shadow:0 0 18px rgba(119,126,255,.5);opacity:0;animation:po114Rise .7s ease-out .3s both}
  #po114-cinematic .po114-title{margin:13px 0 0;padding-left:.13em;font-size:clamp(38px,10vw,76px);font-weight:800;line-height:1;letter-spacing:.13em;color:#fff;text-shadow:0 0 10px rgba(255,255,255,.36),0 0 34px rgba(101,130,255,.68),0 0 70px rgba(239,89,139,.22);opacity:0;animation:po114Rise .85s cubic-bezier(.16,.7,.2,1) .52s both}
  #po114-cinematic .po114-subtitle{margin:14px 0 0;color:rgba(225,230,255,.9);font-size:clamp(9px,2.5vw,14px);font-weight:700;letter-spacing:.24em;text-shadow:0 0 16px rgba(96,135,255,.38);opacity:0;animation:po114Rise .75s ease-out .78s both}
  #po114-cinematic .po114-divider{width:min(44vw,220px);height:1px;margin:18px 0 0;background:linear-gradient(90deg,transparent,rgba(113,159,255,.95),rgba(248,117,157,.85),transparent);box-shadow:0 0 18px rgba(103,132,255,.55);opacity:0;animation:po114Rise .6s ease-out 1s both}
  #po114-cinematic .po114-tagline{margin:13px 0 0;color:rgba(223,226,246,.76);font-size:clamp(8px,2vw,11px);font-weight:650;letter-spacing:.17em;opacity:0;animation:po114Rise .65s ease-out 1.12s both}
  #po114-cinematic .po114-progress{width:min(42vw,200px);height:2px;margin-top:25px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.13);opacity:0;animation:po114Rise .4s ease-out 1.2s both}
  #po114-cinematic .po114-progress span{display:block;width:100%;height:100%;transform:scaleX(0);transform-origin:left;background:linear-gradient(90deg,#6579ff,#d36bdc,#ff8e9c);box-shadow:0 0 12px rgba(143,126,255,.8);animation:po114Progress 4.8s linear .15s both}
  #po114-cinematic .po114-skip{position:absolute;z-index:4;right:max(16px,env(safe-area-inset-right));bottom:max(18px,env(safe-area-inset-bottom));min-height:42px;padding:10px 16px;border:1px solid rgba(157,169,255,.42);border-radius:999px;background:rgba(5,7,18,.72);color:#f5f6ff;font:750 11px system-ui,sans-serif;letter-spacing:.08em;cursor:pointer;backdrop-filter:blur(8px)}
  #po114-cinematic.is-leaving{pointer-events:none;animation:po114Exit .58s ease-in forwards}
  #po114-cinematic.is-leaving .po114-content{animation:po114ExitContent .58s ease-in forwards}
  @keyframes po114Rise{from{opacity:0;transform:translateY(16px);filter:blur(6px)}to{opacity:1;transform:translateY(0);filter:blur(0)}}
  @keyframes po114Content{0%{transform:translateY(2vh) scale(.975)}25%{transform:translateY(0) scale(1)}82%{transform:translateY(0) scale(1)}100%{transform:translateY(-.5vh) scale(1.01)}}
  @keyframes po114Progress{to{transform:scaleX(1)}}
  @keyframes po114Exit{to{opacity:0;visibility:hidden}}
  @keyframes po114ExitContent{to{opacity:0;transform:translateY(-9px) scale(.985);filter:blur(7px)}}
  @media(max-height:650px){#po114-cinematic .po114-title{font-size:clamp(32px,8vh,58px)}#po114-cinematic .po114-subtitle{margin-top:8px}#po114-cinematic .po114-divider{margin-top:11px}#po114-cinematic .po114-tagline{margin-top:8px}#po114-cinematic .po114-progress{margin-top:14px}}
  @media(prefers-reduced-motion:reduce){#po114-cinematic *{animation-duration:.01ms!important;animation-delay:0ms!important}#po114-cinematic canvas{display:none}}
  `;

  function createOverlay(mode) {
    const old = $('#po114-cinematic'); if (old) old.remove();
    const data = labels[mode] || labels.SITE;
    const style = document.createElement('style'); style.id = 'po114-cinematic-style'; style.textContent = css; document.head.appendChild(style);
    const overlay = document.createElement('section');
    overlay.id = 'po114-cinematic'; overlay.setAttribute('role','status'); overlay.setAttribute('aria-label','PAR ORDO Cinematic Experience');
    overlay.innerHTML = `
      <div class="po114-bg" aria-hidden="true"></div><canvas aria-hidden="true"></canvas><div class="po114-vignette" aria-hidden="true"></div>
      <div class="po114-content"><p class="po114-kicker"></p><h1 class="po114-title">PAR ORDO</h1><p class="po114-subtitle"></p><div class="po114-divider" aria-hidden="true"></div><p class="po114-tagline"></p><div class="po114-progress" aria-hidden="true"><span></span></div></div>
      <button type="button" class="po114-skip">ПРОПУСТИТЬ →</button>`;
    $('.po114-kicker',overlay).textContent=data.eyebrow; $('.po114-subtitle',overlay).textContent=data.subtitle; $('.po114-tagline',overlay).textContent=data.tagline;
    document.body.appendChild(overlay); return {overlay,style,canvas:$('canvas',overlay),mode};
  }

  function startCanvas(canvas, overlay) {
    if (REDUCED || !canvas || !canvas.getContext) return () => {};
    const ctx=canvas.getContext('2d',{alpha:true,desynchronized:true}); if(!ctx) return () => {};
    let width=0,height=0,dpr=1,raf=0,stopped=false,lastFrame=0;
    const mobile=window.innerWidth<600;
    const count=mobile?760:1180;
    const particles=Array.from({length:count},(_,i)=>({
      u:Math.random()*Math.PI*2,v:Math.acos(2*Math.random()-1),
      drift:Math.random()*Math.PI*2,speed:.3+Math.random()*.9,
      size:.45+Math.random()*1.15,band:Math.random(),seed:i
    }));
    const stars=Array.from({length:mobile?55:90},()=>({x:Math.random(),y:Math.random(),r:.35+Math.random()*.9,p:Math.random()*6.28}));
    const resize=()=>{const r=canvas.getBoundingClientRect();width=Math.max(1,r.width);height=Math.max(1,r.height);dpr=Math.min(1.5,window.devicePixelRatio||1);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);};
    resize(); window.addEventListener('resize',resize,{passive:true});
    const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
    function draw(now){
      if(stopped||!overlay.isConnected)return; raf=requestAnimationFrame(draw); if(now-lastFrame<30)return; lastFrame=now;
      ctx.clearRect(0,0,width,height);
      const elapsed=(now-startTime)/1000,phase=Math.min(1,elapsed/(DURATION/1000));
      const t=now*.00042,cx=width*.5,cy=height*.43;
      const baseR=Math.min(width*.39,height*.29,290);
      const ambient=ctx.createRadialGradient(cx,cy,baseR*.05,cx,cy,baseR*1.75);
      ambient.addColorStop(0,'rgba(91,105,220,.13)');ambient.addColorStop(.43,'rgba(114,60,149,.075)');ambient.addColorStop(1,'rgba(1,2,8,0)');ctx.fillStyle=ambient;ctx.fillRect(0,0,width,height);

      // Timeline morphs the same field: energy orb -> twisting helix -> horizontal fluid wave.
      const morphHelix=smooth(.42,.66,phase),morphWave=smooth(.68,.9,phase);
      const burst=smooth(.82,.98,phase);
      const projected=new Array(particles.length);
      for(let i=0;i<particles.length;i++){
        const p=particles[i],u=p.u+t*p.speed*.22,v=p.v;
        const sphereR=baseR*(.72+.1*Math.sin(u*5+v*4+t*2));
        let sx=Math.sin(v)*Math.cos(u)*sphereR,sy=Math.cos(v)*sphereR*.83,sz=Math.sin(v)*Math.sin(u)*sphereR*.58;
        // Organic membrane ripples give the orb a soft, fluid edge.
        const ripple=1+.075*Math.sin(u*7+t*2.4+p.drift)+.035*Math.cos(v*13-t*1.6);
        sx*=ripple;sy*=ripple;sz*=ripple;
        // A double-helix-like twisting ribbon, like the narrow vertical form in the reference.
        const hv=Math.cos(v),hu=Math.sin(v);
        const hx=Math.sin(u*1.55+t*1.7+v*2.2)*baseR*.42+Math.cos(u*2.4-t)*baseR*.08;
        const hy=(.5-v/Math.PI)*baseR*2.15;
        const hz=Math.cos(u*1.55+t*1.7+v*2.2)*baseR*.42;
        sx=sx*(1-morphHelix)+hx*morphHelix;sy=sy*(1-morphHelix)+hy*morphHelix;sz=sz*(1-morphHelix)+hz*morphHelix;
        // The form opens into a broad wave made from flowing particle ribbons.
        const wx=(p.band-.5)*width*1.65;
        const wy=Math.sin((p.band*2.4+u*.55)*Math.PI*2+t*2.8+v*1.8)*height*.105+(p.v/Math.PI-.5)*height*.18;
        const wz=Math.cos(u*2.1+v*3+t)*baseR*.28;
        sx=sx*(1-morphWave)+wx*morphWave;sy=sy*(1-morphWave)+(wy-height*.02)*morphWave;sz=sz*(1-morphWave)+wz*morphWave;
        const rotX=sx*Math.cos(t*.26)-sz*Math.sin(t*.26),rotZ=sx*Math.sin(t*.26)+sz*Math.cos(t*.26);
        const depth=1.15/(1.9-rotZ/(baseR*2.8));
        let x=cx+rotX*depth,y=cy+sy*depth;
        // A subtle final burst expands particles radially, then the overlay fades away.
        const dx=x-cx,dy=y-cy,dist=Math.hypot(dx,dy)||1;
        const spread=burst*baseR*.58;
        x+=(dx/dist)*spread;y+=(dy/dist)*spread;
        projected[i]={x,y,z:rotZ,depth,band:p.band,size:p.size,seed:p.seed};
      }

      // Thin luminous trails across nearby particles create the mesh-like energy skin.
      ctx.lineWidth=.48;
      for(let i=0;i<projected.length;i+=2){const a=projected[i];if(a.depth<.48)continue;for(let k=1;k<=2;k++){const b=projected[(i+k*9)%projected.length];const dx=a.x-b.x,dy=a.y-b.y;if(dx*dx+dy*dy<(baseR*.115)**2){const alpha=(.035+a.depth*.085)*(1-burst*.45);ctx.strokeStyle=a.band<.5?`rgba(105,143,255,${alpha})`:`rgba(244,105,153,${alpha})`;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}}

      for(let i=0;i<projected.length;i++){
        const p=projected[i],pulse=.6+.4*Math.sin(now*.002+p.seed*.13);
        const warm=p.band>.52; const r=(p.size+(p.depth*.7))*pulse*(1+burst*.45);
        const alpha=Math.max(.08,Math.min(.9,(.22+p.depth*.45)*(1-burst*.38)));
        ctx.fillStyle=warm?`rgba(255,116,151,${alpha})`:`rgba(100,157,255,${alpha})`;
        ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
        if(i%19===0){ctx.fillStyle=warm?'rgba(255,119,162,.12)':'rgba(106,151,255,.13)';ctx.beginPath();ctx.arc(p.x,p.y,r*4.5,0,Math.PI*2);ctx.fill();}
      }

      // Secondary flowing wave remains visible below the main form, as in the source video.
      const waveY=height*.76;
      for(let layer=0;layer<4;layer++){
        ctx.beginPath();for(let x=0;x<=width+4;x+=4){const u=x/width;const y=waveY+Math.sin(u*7.2+t*2.25+layer*.7)*height*(.022+layer*.004)+Math.sin(u*15-t*1.1+layer)*height*.008+(layer-1.5)*height*.018;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.strokeStyle=layer%2?'rgba(111,135,255,.2)':'rgba(243,107,155,.18)';ctx.lineWidth=layer===1?1.2:.75;ctx.stroke();
        for(let i=0;i<62;i++){const u=i/61,x=u*width,y=waveY+Math.sin(u*7.2+t*2.25+layer*.7)*height*(.022+layer*.004)+Math.sin(u*15-t*1.1+layer)*height*.008+(layer-1.5)*height*.018;const a=.2+.55*(.5+.5*Math.sin(now*.0018+i*.66+layer));ctx.fillStyle=layer%2?`rgba(115,148,255,${a})`:`rgba(255,128,164,${a})`;ctx.beginPath();ctx.arc(x,y,.55+a*.8,0,Math.PI*2);ctx.fill();}
      }
      for(const s of stars){const a=.1+.25*(.5+.5*Math.sin(now*.001+s.p));ctx.fillStyle=`rgba(218,224,255,${a})`;ctx.beginPath();ctx.arc(s.x*width,s.y*height,s.r,0,Math.PI*2);ctx.fill();}
    }
    const startTime=performance.now();raf=requestAnimationFrame(draw);
    return()=>{stopped=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);};
  }

  function play(mode='SITE'){
    mode=String(mode||'SITE').toUpperCase();if(!labels[mode])mode='SITE';const now=Date.now();
    if(active){if(active.mode!==mode)queuedMode=mode;return active.promise;}if(now-lastPlayAt<550)return Promise.resolve();lastPlayAt=now;
    const made=createOverlay(mode),{overlay,style,canvas}=made,stopCanvas=startCanvas(canvas,overlay);
    let resolvePromise;const promise=new Promise(resolve=>{resolvePromise=resolve;});active={mode,overlay,promise,finish:null};let ended=false,timer=null;
    const finish=()=>{if(ended)return;ended=true;if(timer)clearTimeout(timer);stopCanvas();overlay.classList.add('is-leaving');window.setTimeout(()=>{overlay.remove();style.remove();const next=queuedMode;queuedMode=null;active=null;resolvePromise();if(next)window.setTimeout(()=>play(next),100);},REDUCED?60:600);};
    active.finish=finish;$('.po114-skip',overlay).addEventListener('click',finish,{once:true});
    const onKey=e=>{if(e.key==='Escape'&&active?.overlay===overlay)finish();};window.addEventListener('keydown',onKey,{once:true});timer=window.setTimeout(finish,REDUCED?850:DURATION);return promise;
  }
  function appIsVisible(){const app=$('#appView');return!!app&&!app.classList.contains('hidden');}
  function currentPanelMode(){if(!appIsVisible())return'';const manager=$('#managerView');if(sessionStorage.getItem('parordo_manager_portal_active')==='1'||manager?.classList.contains('active'))return'MANAGER';const home=$('#homeView');if(home?.classList.contains('active'))return'STAFF';return manager?'':'STAFF';}
  function syncPanelMode(){const next=currentPanelMode();if(!next){activePanel='';return;}if(next!==activePanel){activePanel=next;play(next);}}
  function watchCeoOverlay(node){if(!node||node.dataset.po114Watching==='1')return;node.dataset.po114Watching='1';const check=()=>{const opened=node.classList.contains('po-ceo-open');if(opened&&!lastCeoOpen){lastCeoOpen=true;play('CEO');}else if(!opened&&lastCeoOpen)lastCeoOpen=false;};new MutationObserver(check).observe(node,{attributes:true,attributeFilter:['class']});check();}
  window.PARORDOCinematicHome=Object.freeze({version:VERSION,play});
  const startSiteIntro=()=>{play('SITE');if(appIsVisible())window.setTimeout(syncPanelMode,REDUCED?1000:DURATION+700);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startSiteIntro,{once:true});else window.setTimeout(startSiteIntro,80);
  const app=$('#appView');if(app){let previousVisible=!app.classList.contains('hidden');new MutationObserver(()=>{const visible=!app.classList.contains('hidden');if(visible&&!previousVisible)window.setTimeout(syncPanelMode,80);if(!visible)activePanel='';previousVisible=visible;}).observe(app,{attributes:true,attributeFilter:['class']});}
  ['#homeView','#managerView'].forEach(selector=>{const node=$(selector);if(node)new MutationObserver(()=>window.setTimeout(syncPanelMode,40)).observe(node,{attributes:true,attributeFilter:['class']});});
  const existingCeo=$('#poCeoOverlay');if(existingCeo)watchCeoOverlay(existingCeo);
  new MutationObserver(records=>{for(const record of records)for(const added of record.addedNodes){if(added.nodeType!==1)continue;if(added.id==='poCeoOverlay')watchCeoOverlay(added);else if(added.querySelector){const ceo=added.querySelector('#poCeoOverlay');if(ceo)watchCeoOverlay(ceo);}}}).observe(document.body,{childList:true,subtree:true});
  if(appIsVisible())window.setTimeout(syncPanelMode,160);
})();
