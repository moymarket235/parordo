/*
 * PAR ORDO — GRAND LUXURY PORTAL V119 · SITE ONLY
 * Original, dependency-free WebGL luxury portal intro for mobile + desktop.
 * Replaces legacy V112/V116 intro loaders when installed as the sole cinematic script.
 * No external CDN, API, database, Worker, login or business-logic access.
 */
(() => {
  'use strict';

  const VERSION = '119';
  if (window.PARORDOCinematicHome?.version === VERSION) return;

  const SITE_DURATION = 8200;
  const PANEL_DURATION = 3600;
  const REDUCED = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const $ = (selector, root = document) => root.querySelector(selector);
  let activeIntro = null;
  let lastIntroAt = 0;

  const labels = {
    SITE: {
      eyebrow: 'ПРЕМИУМ ПРОСТРАНСТВО ОТДЫХА',
      title: 'PAR ORDO',
      sub: 'GRAND LUXURY EXPERIENCE',
      foot: 'ОТДЫХ  ·  ЗДОРОВЬЕ  ·  КОМФОРТ'
    }
  };

  const css = `
  #po119-grand-portal{position:fixed;inset:0;z-index:2147483500;display:grid;place-items:center;overflow:hidden;isolation:isolate;background:#030403;color:#fff7e7;opacity:1;visibility:visible;pointer-events:auto;contain:layout paint style;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
  #po119-grand-portal *{box-sizing:border-box}
  #po119-grand-portal canvas{position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none}#po119-grand-portal .po119-scene-canvas{z-index:0}#po119-grand-portal .po119-particle-canvas{z-index:1;mix-blend-mode:screen}#po119-grand-portal .po119-vignette{z-index:2}#po119-grand-portal .po119-beam{z-index:2}
  #po119-grand-portal .po119-vignette{position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 43%,transparent 12%,rgba(0,0,0,.1) 44%,rgba(0,0,0,.76) 100%),linear-gradient(180deg,rgba(0,0,0,.38),transparent 23%,transparent 65%,rgba(0,0,0,.55))}
  #po119-grand-portal .po119-beam{position:absolute;inset:-30% -60%;pointer-events:none;background:linear-gradient(105deg,transparent 40%,rgba(255,190,94,.018) 45%,rgba(255,218,147,.19) 49.7%,rgba(255,176,67,.06) 51%,transparent 58%);transform:translateX(-72%) rotate(-5deg);animation:po119Beam 3.9s cubic-bezier(.16,.7,.18,1) .35s both;mix-blend-mode:screen}
  #po119-grand-portal .po119-content{position:relative;z-index:3;width:min(92vw,760px);padding:22px 16px 32px;display:flex;flex-direction:column;align-items:center;text-align:center;transform:translateY(-1.8vh);pointer-events:none;animation:po119Content 7.2s cubic-bezier(.2,.65,.2,1) both}
  #po119-grand-portal .po119-brandmark{position:relative;width:clamp(54px,9vw,82px);height:clamp(54px,9vw,82px);margin:0 0 15px;display:grid;place-items:center;border-radius:50%;border:1px solid rgba(242,195,112,.72);background:radial-gradient(circle,rgba(255,224,165,.18),rgba(13,12,9,.82) 70%);box-shadow:0 0 24px rgba(244,181,83,.26),inset 0 0 22px rgba(255,232,180,.12);animation:po119MarkPulse 3.2s ease-in-out infinite,po119MarkBloom 1.25s cubic-bezier(.16,.78,.2,1) 5.7s both}
  #po119-grand-portal .po119-brandmark:before,#po119-grand-portal .po119-brandmark:after{content:"";position:absolute;inset:-8px;border-radius:50%;border:1px solid rgba(255,208,129,.34);border-left-color:rgba(111,178,255,.7);border-right-color:rgba(255,153,74,.75);animation:po119Orbit 9s linear infinite}
  #po119-grand-portal .po119-brandmark:after{inset:-15px;border-color:rgba(255,211,145,.18);border-top-color:rgba(255,231,186,.72);animation-duration:15s;animation-direction:reverse}
  #po119-grand-portal .po119-brandmark img{width:76%;height:76%;object-fit:contain;filter:drop-shadow(0 0 12px rgba(255,197,105,.65))}#po119-grand-portal .po119-brandmark.po119-no-logo:after{content:'P';font:700 34px/1 Georgia,serif;color:#f5d18f;text-shadow:0 0 16px rgba(255,190,88,.75)}
  #po119-grand-portal .po119-eyebrow{margin:0;color:rgba(255,224,172,.92);font-size:clamp(9px,1.7vw,12px);font-weight:800;letter-spacing:.28em;text-transform:uppercase;text-shadow:0 0 22px rgba(255,187,92,.48);opacity:0;animation:po119Rise .8s ease-out .38s both}
  #po119-grand-portal .po119-title{margin:14px 0 0;padding-left:.18em;font-family:Georgia,"Times New Roman",serif;font-size:clamp(39px,9vw,79px);font-weight:700;line-height:.98;letter-spacing:.18em;color:#fff3d2;text-shadow:0 1px 0 #8a5d26,0 0 10px rgba(255,219,151,.35),0 0 36px rgba(255,171,72,.48);opacity:0;animation:po119Title .95s cubic-bezier(.15,.72,.2,1) .62s both}
  #po119-grand-portal .po119-rule{width:min(46vw,240px);height:1px;margin:20px 0 0;background:linear-gradient(90deg,transparent,rgba(255,214,142,.95),rgba(255,245,218,.85),rgba(255,178,82,.8),transparent);box-shadow:0 0 16px rgba(255,187,89,.72);opacity:0;animation:po119Rise .7s ease-out .92s both}
  #po119-grand-portal .po119-sub{margin:15px 0 0;color:rgba(255,245,224,.91);font-size:clamp(9px,2vw,13px);font-weight:800;letter-spacing:.23em;text-shadow:0 0 20px rgba(255,177,81,.42);opacity:0;animation:po119Rise .8s ease-out 1.05s both}
  #po119-grand-portal .po119-foot{margin:12px 0 0;color:rgba(228,218,196,.74);font-size:clamp(8px,1.65vw,10px);font-weight:700;letter-spacing:.16em;opacity:0;animation:po119Rise .8s ease-out 1.2s both}
  #po119-grand-portal .po119-progress{width:min(42vw,190px);height:2px;margin-top:23px;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.16);opacity:0;animation:po119Rise .45s ease-out 1.25s both}
  #po119-grand-portal .po119-progress span{display:block;width:100%;height:100%;transform:scaleX(0);transform-origin:left;background:linear-gradient(90deg,#9f6c2c,#fff0c6,#dc9d48);box-shadow:0 0 13px rgba(255,204,120,.9);animation:po119Progress 7.0s linear .18s both}
  #po119-grand-portal .po119-skip{position:absolute;z-index:5;right:max(16px,env(safe-area-inset-right));bottom:max(17px,env(safe-area-inset-bottom));min-height:42px;padding:10px 17px;border:1px solid rgba(236,195,119,.44);border-radius:999px;background:rgba(8,8,7,.76);color:#fff3d6;font:800 11px system-ui,sans-serif;letter-spacing:.08em;cursor:pointer;backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px);box-shadow:0 5px 25px rgba(0,0,0,.28)}
  #po119-grand-portal.is-leaving{pointer-events:none;animation:po119Exit .68s ease-in forwards}
  #po119-grand-portal.is-leaving .po119-content{animation:po119ContentExit .62s ease-in forwards}
  @keyframes po119Rise{from{opacity:0;transform:translateY(17px);filter:blur(6px)}to{opacity:1;transform:translateY(0);filter:blur(0)}}
  @keyframes po119Title{0%{opacity:0;transform:translateY(25px) scale(.93);filter:blur(10px);letter-spacing:.34em}75%{opacity:1;filter:blur(0)}100%{opacity:1;transform:translateY(0) scale(1);letter-spacing:.18em}}
  @keyframes po119Content{0%{transform:translateY(-1.8vh) scale(.97)}18%{transform:translateY(-1.8vh) scale(1)}86%{transform:translateY(-1.8vh) scale(1)}100%{transform:translateY(-.8vh) scale(1.01)}}
  @keyframes po119ContentExit{to{opacity:0;transform:translateY(-8px) scale(1.24);filter:blur(14px)}}
  @keyframes po119Progress{to{transform:scaleX(1)}}
  @keyframes po119Beam{0%{transform:translateX(-72%) rotate(-5deg);opacity:0}18%{opacity:1}100%{transform:translateX(72%) rotate(-5deg);opacity:0}}
  @keyframes po119Orbit{to{transform:rotate(360deg)}}
  @keyframes po119MarkPulse{0%,100%{filter:brightness(.92);box-shadow:0 0 24px rgba(244,181,83,.22),inset 0 0 22px rgba(255,232,180,.12)}50%{filter:brightness(1.18);box-shadow:0 0 38px rgba(244,181,83,.4),inset 0 0 27px rgba(255,232,180,.18)}}
  @keyframes po119MarkBloom{0%{transform:scale(1)}55%{transform:scale(1.24)}100%{transform:scale(1.08)}}
  @keyframes po119Exit{to{opacity:0;visibility:hidden}}
  @media(max-height:650px){#po119-grand-portal .po119-content{transform:translateY(-1vh) scale(.88)}#po119-grand-portal .po119-rule{margin-top:13px}#po119-grand-portal .po119-sub{margin-top:10px}#po119-grand-portal .po119-progress{margin-top:15px}}
  @media(max-width:420px){#po119-grand-portal .po119-content{width:96vw;padding-inline:9px}#po119-grand-portal .po119-title{letter-spacing:.13em}#po119-grand-portal .po119-sub{letter-spacing:.16em}#po119-grand-portal .po119-foot{letter-spacing:.11em}}
  @media(prefers-reduced-motion:reduce){#po119-grand-portal *{animation-duration:.01ms!important;animation-delay:0ms!important}#po119-grand-portal canvas{display:none}.po119-panel-enter,.po119-card-enter{animation:none!important;opacity:1!important;filter:none!important;transform:none!important}#appView.po119-panel-sweep:after{display:none}}
  `;

  const VERTEX_SHADER = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.0,1.0);}
  `;
  const FRAGMENT_SHADER = `
    precision highp float;
    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_progress;
    varying vec2 v_uv;
    float hash21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash21(i),hash21(i+vec2(1.,0.)),f.x),mix(hash21(i+vec2(0.,1.)),hash21(i+vec2(1.,1.)),f.x),f.y);}
    float fbm(vec2 p){float v=0.0,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+vec2(13.1,7.7);a*=.5;}return v;}
    float ring(float d,float r,float w){return 1.0-smoothstep(w*.25,w,abs(d-r));}
    void main(){
      vec2 uv=v_uv;
      float aspect=u_resolution.x/u_resolution.y;
      vec2 p=vec2((uv.x-.5)*aspect,uv.y-.5);
      float t=u_time;
      float dive=smoothstep(.70,.985,u_progress);
      float zoom=mix(1.0,.49,dive);
      p*=zoom;
      float radius=min(.335,aspect*.425);
      vec2 center=vec2(0.0,.035);
      vec2 q=p-center;
      float r=length(q);
      float a=atan(q.y,q.x);
      vec3 col=vec3(.005,.008,.008);
      float stars=step(.996,hash21(floor(uv*vec2(190.,260.))))*.48;
      col+=stars*vec3(.46,.39,.25);
      float fogN=fbm(q*12.0+vec2(t*.035,-t*.08));
      float fogN2=fbm(vec2(a*1.8+t*.1,r*11.0-t*.13));
      float innerMask=1.0-smoothstep(radius*.28,radius*.93,r);
      float swirl=sin(a*3.0-t*.7+fogN*4.5+fogN2*2.8);
      float nebula=pow(max(0.0,fogN*.62+fogN2*.38),2.1)*innerMask;
      col+=nebula*vec3(.25,.105,.025)*(.6+.4*swirl);
      float steamNoise=fbm(vec2(p.x*8.5+t*.035,p.y*4.2-t*.075));
      float steamShape=(1.0-smoothstep(.16,.52,abs(p.x)))*smoothstep(-.39,-.05,p.y)*(1.0-smoothstep(.18,.42,p.y));
      float steam=pow(max(0.0,steamNoise-.36),2.0)*steamShape;
      col+=steam*vec3(.24,.17,.095)*.42;
      col+=innerMask*pow(max(0.0,swirl),7.0)*.025*vec3(1.0,.56,.19);
      float rayNoise=fbm(vec2(a*5.0+t*.21,r*8.0-t*.7));
      float rays=pow(max(0.0,sin(a*58.0+rayNoise*5.5-t*2.6)),18.0);
      float rayArea=1.0-smoothstep(radius*.34,radius*1.22,r);
      col+=rays*rayArea*dive*vec3(1.0,.53,.19)*.34;
      float outerGlow=exp(-pow((r-radius)/(.045+radius*.025),2.0));
      col+=outerGlow*vec3(.46,.22,.055)*.32;
      float halo=exp(-pow((r-radius*1.13)/(.105+radius*.05),2.0));
      col+=halo*vec3(.15,.085,.025)*.5;
      float rim1=ring(r,radius,.009);
      float rim2=ring(r,radius*.965,.0035);
      float rim3=ring(r,radius*1.055,.0024);
      float rim4=ring(r,radius*1.115,.0013);
      float brushed=.78+.22*sin(a*88.0+sin(a*7.0)*3.0+t*.06);
      float gold= rim1*brushed + rim2*.9 + rim3*.65 + rim4*.4;
      col+=gold*vec3(1.0,.63,.19)*1.15;
      col+=rim2*vec3(1.0,.92,.69)*.9;
      float glint=pow(max(0.0,cos(a*1.0-t*.22)),50.0);
      col+=glint*rim1*vec3(1.0,.91,.68)*2.1;
      float tick=step(.985,fract((a+3.14159)*42.0/6.28318));
      col+=tick*rim1*.32*vec3(1.0,.76,.4);
      float innerR=radius*.82;
      float innerRim=ring(r,innerR,.0018);
      col+=innerRim*vec3(.36,.2,.07)*.36;
      float floorY=-.285;
      float waterBand=exp(-pow((p.y-floorY)/.045,2.0));
      float waterNoise=fbm(vec2(p.x*24.0+t*.12,p.y*35.0-t*.2));
      float ripples=sin(p.x*42.0+sin(p.x*8.0+t*.4)*2.1+t*.5+waterNoise*3.0);
      float water=waterBand*(.45+.55*pow(max(0.0,ripples),7.0));
      col+=water*vec3(.33,.2,.085)*.5;
      float reflection=exp(-pow((r-radius*1.02)/.018,2.0))*exp(-pow((p.y+radius*.82)/.11,2.0));
      col+=reflection*vec3(.7,.36,.095)*.2;
      float vignette=1.0-smoothstep(.24,.82,length(vec2(p.x/aspect,p.y)));
      col*=.54+.46*vignette;
      float crossing=smoothstep(.88,.985,u_progress);
      float portalFlash=exp(-pow(u_progress-.965,2.0)/.00042);
      col+=crossing*vec3(.24,.15,.055)*.18;
      col+=portalFlash*vec3(.34,.24,.12)*.42;
      float fade=1.0-smoothstep(.965,1.0,u_progress);
      col*=fade;
      gl_FragColor=vec4(col,1.0);
    }
  `;

  function compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader) || 'Shader compile failed';
      gl.deleteShader(shader);
      throw new Error(error);
    }
    return shader;
  }

  function startPortalRender(canvas, particleCanvas, overlay, duration) {
    if (REDUCED) return () => {};
    let gl = null;
    try { gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', premultipliedAlpha: false }); } catch (_) {}
    if (!gl) return startFallback(particleCanvas, overlay, duration);

    let program, buffer;
    try {
      const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      program = gl.createProgram();
      gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'Program link failed');
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
      gl.useProgram(program);
      const position = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    } catch (_) {
      try { if (program) gl.deleteProgram(program); } catch (_) {}
      canvas.style.display = 'none';
      return startFallback(particleCanvas, overlay, duration);
    }

    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const progressLoc = gl.getUniformLocation(program, 'u_progress');
    let raf = 0, stopped = false, lastFrame = 0, startAt = performance.now(), width = 1, height = 1;
    const mobile = Math.min(innerWidth, innerHeight) < 700 || matchMedia('(pointer:coarse)').matches;
    const dprCap = mobile ? 1.15 : 1.55;
    const resize = () => {
      width = Math.max(1, Math.floor(canvas.clientWidth));
      height = Math.max(1, Math.floor(canvas.clientHeight));
      const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize, { passive: true });

    // A small, adaptive ember field adds depth without a large GPU/CPU cost.
    const count = mobile ? 105 : 190;
    const embers = Array.from({ length: count }, (_, i) => ({
      angle: Math.random() * Math.PI * 2,
      radius: .23 + Math.random() * .33,
      speed: .08 + Math.random() * .2,
      rise: Math.random(),
      drift: (Math.random() - .5) * .09,
      size: .45 + Math.random() * 1.35,
      alpha: .12 + Math.random() * .38,
      warm: Math.random() > .35,
      seed: Math.random() * 8
    }));
    const ctx = particleCanvas?.getContext('2d', { alpha: true, desynchronized: true });
    if (ctx) {
      const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
      particleCanvas.width = Math.max(1, Math.floor(width * dpr));
      particleCanvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(now) {
      if (stopped || !overlay.isConnected) return;
      raf = requestAnimationFrame(draw);
      const frameGap = mobile ? 38 : 30;
      if (now - lastFrame < frameGap) return;
      lastFrame = now;
      const elapsed = now - startAt;
      const progress = Math.min(1, elapsed / duration);
      gl.useProgram(program);
      gl.uniform1f(timeLoc, elapsed * .001);
      gl.uniform2f(resLoc, canvas.width, canvas.height);
      gl.uniform1f(progressLoc, progress);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (ctx && particleCanvas) {
        const dpr = Math.min(dprCap, window.devicePixelRatio || 1);
        if (particleCanvas.width !== canvas.width || particleCanvas.height !== canvas.height) {
          particleCanvas.width = canvas.width; particleCanvas.height = canvas.height;
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        ctx.clearRect(0, 0, width, height);
        const scale = Math.min(width, height);
        const cx = width * .5, cy = height * .5;
        const radius = Math.min(height * .335, width * .425);
        for (const p of embers) {
          const a = p.angle + elapsed * .00012 * p.speed * 10;
          const drift = Math.sin(elapsed * .00055 + p.seed) * 7;
          const x = cx + Math.cos(a) * radius * p.radius * 2.05 + drift + p.drift * scale;
          const y = cy + Math.sin(a) * radius * p.radius * 1.82 - progress * p.rise * 28;
          const alpha = p.alpha * (.58 + .42 * Math.sin(elapsed * .0014 + p.seed));
          ctx.beginPath();
          ctx.fillStyle = p.warm ? `rgba(255,190,108,${alpha})` : `rgba(135,184,225,${alpha*.62})`;
          ctx.arc(x, y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    raf = requestAnimationFrame(draw);
    return () => {
      stopped = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize);
      try { gl.deleteBuffer(buffer); gl.deleteProgram(program); } catch (_) {}
    };
  }

  function startFallback(canvas, overlay, duration) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return () => {};
    let raf = 0, stopped = false, start = performance.now(), last = 0;
    const mobile = Math.min(innerWidth, innerHeight) < 700;
    const sparks = Array.from({ length: mobile ? 75 : 125 }, () => ({ a: Math.random()*Math.PI*2, r:.65+Math.random()*.55, s:.4+Math.random(), z:Math.random()*6.28 }));
    function resize(){const d=Math.min(mobile?1:1.25,devicePixelRatio||1);canvas.width=Math.floor(innerWidth*d);canvas.height=Math.floor(innerHeight*d);ctx.setTransform(d,0,0,d,0,0);}
    resize(); window.addEventListener('resize',resize,{passive:true});
    function frame(now){if(stopped||!overlay.isConnected)return;raf=requestAnimationFrame(frame);if(now-last<36)return;last=now;const t=(now-start)/1000,w=innerWidth,h=innerHeight,cx=w/2,cy=h*.48,r=Math.min(h*.30,w*.43);
      ctx.clearRect(0,0,w,h);ctx.fillStyle='#030403';ctx.fillRect(0,0,w,h);
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,r*1.8);g.addColorStop(0,'rgba(115,66,20,.18)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
      for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(cx,cy,r*(1+i*.018),r*(.82+i*.017),Math.sin(t*.12+i)*.025,0,Math.PI*2);ctx.strokeStyle=`rgba(235,177,91,${.20-i*.027})`;ctx.lineWidth=i===0?2.3:1;ctx.shadowBlur=16;ctx.shadowColor='#ce8d39';ctx.stroke();}
      ctx.shadowBlur=0;
      for(const p of sparks){const a=p.a+t*p.s*.12,x=cx+Math.cos(a)*r*p.r,y=cy+Math.sin(a)*r*p.r*.82;ctx.beginPath();ctx.fillStyle=`rgba(255,190,103,${.2+.22*Math.sin(t+p.z)})`;ctx.arc(x,y,1.1,0,Math.PI*2);ctx.fill();}
      for(let j=0;j<5;j++){ctx.beginPath();for(let x=0;x<=w;x+=5){const y=h*.78+j*5+Math.sin(x*.012+t*1.2+j*.6)*7+Math.sin(x*.028-t*.6)*2;if(x===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.strokeStyle='rgba(207,151,72,.2)';ctx.lineWidth=.8;ctx.stroke();}
    }
    raf=requestAnimationFrame(frame);return()=>{stopped=true;cancelAnimationFrame(raf);window.removeEventListener('resize',resize);};
  }

  function createOverlay(mode, duration) {
    $('#po119-grand-portal')?.remove(); $('#po119-grand-portal-style')?.remove();
    const data=labels[mode]||labels.SITE;
    const style=document.createElement('style');style.id='po119-grand-portal-style';style.textContent=css;document.head.appendChild(style);
    const overlay=document.createElement('section');overlay.id='po119-grand-portal';overlay.setAttribute('role','status');overlay.setAttribute('aria-label','PAR ORDO Grand Luxury Portal');
    overlay.innerHTML=`
      <canvas class="po119-scene-canvas" aria-hidden="true"></canvas>
      <canvas class="po119-particle-canvas" aria-hidden="true"></canvas>
      <div class="po119-vignette" aria-hidden="true"></div>
      <div class="po119-beam" aria-hidden="true"></div>
      <div class="po119-content">
        <div class="po119-brandmark" aria-hidden="true"><img src="./assets/par-ordo-logo.png" alt="" onerror="this.parentNode.classList.add('po119-no-logo');this.remove()"></div>
        <p class="po119-eyebrow"></p><h1 class="po119-title">PAR ORDO</h1>
        <div class="po119-rule" aria-hidden="true"></div><p class="po119-sub"></p><p class="po119-foot"></p>
        <div class="po119-progress" aria-hidden="true"><span></span></div>
      </div>
      <button type="button" class="po119-skip">ӨТКӨРҮҮ →</button>`;
    $('.po119-eyebrow',overlay).textContent=data.eyebrow;$('.po119-sub',overlay).textContent=data.sub;$('.po119-foot',overlay).textContent=data.foot;
    document.body.appendChild(overlay);
    const progress=$('.po119-progress span',overlay);if(progress)progress.style.animationDuration=Math.max(1,duration/1000)+'s';
    return {overlay,style,canvas:$('.po119-scene-canvas',overlay),particleCanvas:$('.po119-particle-canvas',overlay),mode,duration};
  }

  function play() {
    if (activeIntro) return activeIntro.promise;
    const now = Date.now();
    if (now - lastIntroAt < 450) return Promise.resolve();
    lastIntroAt = now;
    const mode = 'SITE';
    const duration = SITE_DURATION;
    const made = createOverlay(mode, duration);
    const { overlay, style, canvas, particleCanvas } = made;
    const stopRender = startPortalRender(canvas, particleCanvas, overlay, duration);
    let resolve;
    const promise = new Promise(r => { resolve = r; });
    let finished = false;
    let timer = null;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      stopRender();
      overlay.classList.add('is-leaving');
      window.setTimeout(() => {
        overlay.remove();
        style.remove();
        activeIntro = null;
        resolve();
      }, REDUCED ? 70 : 690);
    };
    activeIntro = { mode, overlay, promise, finish };
    $('.po119-skip', overlay).addEventListener('click', finish, { once: true });
    const onKey = e => {
      if (e.key === 'Escape' && activeIntro?.overlay === overlay) finish();
    };
    window.addEventListener('keydown', onKey, { once: true });
    timer = window.setTimeout(finish, REDUCED ? 950 : duration);
    return promise;
  }

  // Deliberately no staff, manager, navigation, or CEO observers: portal runs only on site entry.
  window.PARORDOCinematicHome = Object.freeze({ version: VERSION });

  const beginSite = () => { play(); };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', beginSite, { once: true });
  } else {
    window.setTimeout(beginSite, 80);
  }

})();
