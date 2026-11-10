/*
 * PAR ORDO PRO: black marble vault entrance.
 * Plays the opening, dresses the login form and carries the user into the panel.
 * Holds no business logic: the existing login handler and API calls stay in charge.
 * If anything here fails, the normal login form is shown.
 */
(()=>{'use strict';
if(window.PARORDOVault)return;
const root=document.documentElement,TOKEN='parordo_admin_token',SEEN='po_vault_seen',TAU=Math.PI*2;
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(x,a=0,b=1)=>x<a?a:x>b?b:x,mix=(a,b,k)=>a+(b-a)*k,ss=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)},rnd=(a=1,b)=>b===undefined?Math.random()*a:a+Math.random()*(b-a);
const E={out2:k=>1-(1-k)*(1-k),out3:k=>1-(1-k)**3,out4:k=>1-(1-k)**4,in2:k=>k*k,in3:k=>k*k*k,io2:k=>k<.5?2*k*k:1-(-2*k+2)**2/2,io3:k=>k<.5?4*k*k*k:1-(-2*k+2)**3/2,back:k=>{const c=1.70158;return 1+(c+1)*(k-1)**3+c*(k-1)**2},soft:k=>{const c=.9;return 1+(c+1)*(k-1)**3+c*(k-1)**2}};
const reduce=!!(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches);
const hasToken=()=>{try{return !!sessionStorage.getItem(TOKEN)}catch(_){return false}};
const buzz=ms=>{try{if(navigator.userActivation&&!navigator.userActivation.hasBeenActive)return;navigator.vibrate&&navigator.vibrate(ms)}catch(_){}};
const loginView=$('#loginView'),form=$('#loginForm'),uI=$('#loginUser'),pI=$('#loginPass'),btn=$('#loginButton'),errBox=$('#loginError'),appView=$('#appView');
const release=()=>root.classList.remove('po-vault-boot');
if(!loginView||!form||!uI||!pI||!btn||!appView){release();return}

/* ---------- timeline ---------- */
let tasks=[],speed=1;
const tl=(ms,fn)=>new Promise(res=>{tasks.push({e:0,d:Math.max(.001,ms/1000),fn,res});wake()});
const wait=ms=>tl(ms,()=>{});
const later=(ms,fn)=>{tl(ms,()=>{}).then(fn)};

/* ---------- state ---------- */
const View={W:innerWidth,H:innerHeight};
let phase='off',bgCv=null,fxCv=null,logoEl=null,skipBtn=null,gl=null,pr=null,G3=null,scT=null,mbT=null,extras=[],obs=[],texts=null,dogs=[];
let bootP=null,chain=null;
const S={amb:0,arc:0,seam:0,bars:new Float32Array(12),tum:0,wheel:0,tumV:0,tumT:0,lit:0,swing:0,haze:0,hot:0,R:200,hub:400,diveZ:0,hold:false,busy:false,lamp:[1,.6,.18]};
const readView=()=>{View.W=Math.max(280,innerWidth);View.H=Math.max(420,innerHeight);root.style.setProperty('--po-vh',View.H+'px')};

/* ---------- gl helpers ---------- */
const HEAD='#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
function sh(g,t,src){const s=g.createShader(t);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw new Error(g.getShaderInfoLog(s)||'shader');return s}
function prog(g,vs,fs){const p=g.createProgram();g.attachShader(p,sh(g,g.VERTEX_SHADER,vs));g.attachShader(p,sh(g,g.FRAGMENT_SHADER,fs));g.linkProgram(p);if(!g.getProgramParameter(p,g.LINK_STATUS))throw new Error('link');const u={},a={};for(let i=0,n=g.getProgramParameter(p,g.ACTIVE_UNIFORMS);i<n;i++){const x=g.getActiveUniform(p,i);u[x.name]=g.getUniformLocation(p,x.name)}for(let i=0,n=g.getProgramParameter(p,g.ACTIVE_ATTRIBUTES);i<n;i++){const x=g.getActiveAttrib(p,i);a[x.name]=g.getAttribLocation(p,x.name)}return{p,u,a}}
const loadImg=src=>new Promise(res=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src=src});

/* ---------- the door's power level follows the phone ---------- */
const Perf={level:3,n:0,bad:0,near:0,skip:16,strikes:0,lastDown:0,openBad:0,capped:false,known:false,key:'po_vault_perf',
  init(){const ua=navigator.userAgent||'',iOS=/iP(hone|ad|od)/.test(ua),cores=navigator.hardwareConcurrency||4,mem=navigator.deviceMemory||4,sv=!!(navigator.connection&&navigator.connection.saveData);
    let l=3;if(!iOS){if(cores<=4||mem<=3)l=1;if(cores<=2||mem<=1)l=0}if(sv)l=Math.min(l,1);if(reduce)l=0;
    let st=null;try{st=JSON.parse(localStorage.getItem(this.key))}catch(_){}let up=false;
    if(st&&typeof st.l==='number'){this.known=true;let v=st.l;if(Date.now()-st.t>2592e5&&v<l){v++;up=true}l=Math.min(l,v)}
    this.level=l;if(up)this.save();Object.assign(this,{n:0,bad:0,near:0,skip:16,strikes:0,lastDown:0,openBad:0,capped:false})},
  save(){try{localStorage.setItem(this.key,JSON.stringify({l:this.level,t:Date.now()}))}catch(_){}},
  res(){return[1,1,1.3,1.75][this.level]},fx(){return[0,.35,.65,1][this.level]},
  apply(){BG.res(this.res())},
  down(now){if(this.level<=1)return;this.level--;this.lastDown=now;this.skip=20;this.save();this.apply()},
  clear(){this.n=this.bad=this.near=0},
  bench(){if(!gl)return;const c=bgCv,px=new Uint8Array(4),sync=()=>gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);c.width=256;c.height=512;gl.viewport(0,0,256,512);
    const run=fn=>{let b=1e9;for(let i=0;i<3;i++){sync();const t0=performance.now();fn();sync();b=Math.min(b,performance.now()-t0)}return b};S.amb=1;S.R=120;S.hub=View.H/2;
    const base=run(()=>BG.clear()),full=run(()=>drawScene(3.3)),perMP=Math.max(0,full-base)/(256*512/1e6);S.amb=0;
    if(perMP>40)this.level=Math.min(this.level,1);else if(perMP>14)this.level=Math.min(this.level,2);this.save()},
  /* a steady 30 fps is an OS cap or a saturated GPU: time one frame to tell which */
  gpuBound(){if(!gl)return null;const px=new Uint8Array(4),sync=()=>gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,px);sync();const t0=performance.now();drawScene(t0/1000);sync();return performance.now()-t0>9},
  sample(dt,now){if(this.skip>0){this.skip--;return}if(dt>.25)return;
    if(phase==='open'){if(dt>.05)this.openBad++;if(this.openBad>=12){this.openBad=0;if(this.level>1){this.level--;this.save();this.apply()}this.clear();this.skip=20;snapToLogin();return}}
    this.n++;if(dt>.0225)this.bad++;if(dt>.05)this.bad++;if(dt>.028&&dt<.039)this.near++;if(this.n<36)return;
    const r=this.bad/this.n,steady=this.near/this.n>=.8;this.clear();if(r<=.34){this.strikes=0;return}if(now-this.lastDown<1400)return;
    if(steady){if(this.capped||phase==='open')return;const g=this.gpuBound();if(g===true)this.down(now);else if(g===false)this.capped=true;return}
    if(r>.75||++this.strikes>=2){this.strikes=0;this.down(now)}}
};

/* ---------- background context ---------- */
const BG={q:1,res(q){if(!gl)return;this.q=q;const d=Math.min(devicePixelRatio||1,q);bgCv.width=Math.max(2,Math.round(View.W*d));bgCv.height=Math.max(2,Math.round(View.H*d));gl.viewport(0,0,bgCv.width,bgCv.height)},clear(){if(!gl)return;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT)}};

/* ---------- sparks and glows above the plate ---------- */
const FX={gl:null,MAX:500,list:[],shk:0,pr:null,buf:null,arr:null,
  init(){const g=this.gl=fxCv.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false});if(!g)return;this.list.length=0;this.shk=0;
    this.pr=prog(g,'attribute vec2 P,Q;attribute vec4 C;attribute float K;uniform vec2 R;varying vec2 q;varying vec4 c;varying float k;void main(){q=Q;c=C;k=K;gl_Position=vec4(P.x/R.x*2.-1.,1.-P.y/R.y*2.,0.,1.);}',HEAD+'varying vec2 q;varying vec4 c;varying float k;void main(){float a;if(k<.5){float v=1.-abs(q.y);float u=1.-q.x*q.x;a=v*v*u;}else if(k<1.5){float r=length(q);a=max(0.,1.-r);a=a*a*a;}else{float r=length(q);a=(1.-smoothstep(0.,.07,abs(r-.9)))*(1.-smoothstep(.93,1.,r));}gl_FragColor=vec4(c.rgb*a*c.a,0.);}');
    this.buf=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,this.buf);this.arr=new Float32Array(this.MAX*6*9);g.bufferData(g.ARRAY_BUFFER,this.arr.byteLength,g.DYNAMIC_DRAW);this.res()},
  res(){const g=this.gl;if(!g)return;const d=Math.min(devicePixelRatio||1,1.5);fxCv.width=Math.round(View.W*d);fxCv.height=Math.round(View.H*d);g.viewport(0,0,fxCv.width,fxCv.height)},
  add(o){if(this.gl&&this.list.length<this.MAX)this.list.push(Object.assign({x:0,y:0,vx:0,vy:0,ay:0,drag:0,age:0,life:1,s0:3,s1:1,r:1,g:.7,b:.3,a:1,k:0,delay:0},o))},
  sparks(x,y,n,o={}){const m=Math.round(n*Perf.fx());for(let i=0;i<m;i++){const an=rnd(TAU),sp=rnd(o.v0||90,o.v1||520);this.add({x,y,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp,ay:o.g===undefined?620:o.g,drag:1.4,life:rnd(.35,o.life||1.1),s0:rnd(1.3,3),s1:.4,g:rnd(.62,.86),b:rnd(.18,.42)})}wake()},
  glow(x,y,s,o={}){this.add(Object.assign({x,y,s0:s,s1:s*(o.grow||1.3),k:1,life:o.life||.5,g:.72,b:.34,a:o.a||.9},o));wake()},
  ring(x,y,s0,s1,o={}){this.add(Object.assign({x,y,s0,s1,k:2,life:o.life||.6,g:.8,b:.46,a:o.a||.9},o));wake()},
  shake(a){this.shk=Math.max(this.shk,a);wake()},
  tick(dt){const L=this.list;let w=0;for(let i=0;i<L.length;i++){const p=L[i];if(p.delay>0){p.delay-=dt;L[w++]=p;continue}p.age+=dt;if(p.age>=p.life)continue;p.vy+=p.ay*dt;if(p.drag){const d=Math.exp(-p.drag*dt);p.vx*=d;p.vy*=d}p.x+=p.vx*dt;p.y+=p.vy*dt;L[w++]=p}L.length=w;this.shk*=Math.exp(-dt*9);if(this.shk<.05)this.shk=0},
  draw(){const g=this.gl;if(!g)return;g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);if(!this.list.length)return;const a=this.arr;let n=0;const put=(x,y,u,v,p,al)=>{a[n++]=x;a[n++]=y;a[n++]=u;a[n++]=v;a[n++]=p.r;a[n++]=p.g;a[n++]=p.b;a[n++]=al;a[n++]=p.k};
    for(const p of this.list){if(p.delay>0)continue;const t=p.age/p.life,s=mix(p.s0,p.s1,t),al=p.a*(p.k===0?1-t*t:1-t);let ax,ay,bx,by;if(p.k===0){const sp=Math.hypot(p.vx,p.vy),ux=sp>1?p.vx/sp:1,uy=sp>1?p.vy/sp:0,L=Math.max(s,sp*.024),W=s*.62;ax=ux*L;ay=uy*L;bx=-uy*W;by=ux*W}else{ax=s;ay=0;bx=0;by=s}const X=p.x,Y=p.y,x0=X-ax-bx,y0=Y-ay-by,x1=X+ax-bx,y1=Y+ay-by,x2=X-ax+bx,y2=Y-ay+by,x3=X+ax+bx,y3=Y+ay+by;put(x0,y0,-1,-1,p,al);put(x1,y1,1,-1,p,al);put(x2,y2,-1,1,p,al);put(x1,y1,1,-1,p,al);put(x2,y2,-1,1,p,al);put(x3,y3,1,1,p,al)}
    const r=this.pr;g.useProgram(r.p);g.uniform2f(r.u.R,View.W,View.H);g.bindBuffer(g.ARRAY_BUFFER,this.buf);g.bufferSubData(g.ARRAY_BUFFER,0,a.subarray(0,n));const st=36;g.enableVertexAttribArray(r.a.P);g.vertexAttribPointer(r.a.P,2,g.FLOAT,false,st,0);g.enableVertexAttribArray(r.a.Q);g.vertexAttribPointer(r.a.Q,2,g.FLOAT,false,st,8);g.enableVertexAttribArray(r.a.C);g.vertexAttribPointer(r.a.C,4,g.FLOAT,false,st,16);g.enableVertexAttribArray(r.a.K);g.vertexAttribPointer(r.a.K,1,g.FLOAT,false,st,32);g.enable(g.BLEND);g.blendFunc(g.ONE,g.ONE);g.drawArrays(g.TRIANGLES,0,n/9)}
};

/* ---------- door geometry ---------- */
const VS=`attribute vec3 P,N,T;uniform mat4 VP,M;varying vec3 vW,vN,vT,vL;void main(){vec4 w=M*vec4(P,1.);vW=w.xyz;mat3 m=mat3(M[0].xyz,M[1].xyz,M[2].xyz);vN=m*N;vT=m*T;vL=P;gl_Position=VP*w;}`;
const FS=HEAD+`varying vec3 vW,vN,vT,vL;uniform vec3 Eye,Base,LD,LampC;uniform float Amb,Spec,An,Kind,Px,Lit,Seam,Arc,Em,Hot;uniform sampler2D Sc,Mb;
const float TAU=6.2831853;const vec3 SeamC=vec3(1.,.74,.36),TickC=vec3(.95,.7,.32),HazeC=vec3(1.,.74,.38),WallA=vec3(.02,.018,.018),WallB=vec3(.045,.04,.04);
vec3 env(vec3 R){float y=R.y*.5+.5;vec3 c=mix(vec3(.018,.012,.008),vec3(.21,.13,.07),y*y);c+=vec3(1.,.78,.5)*pow(max(dot(R,normalize(vec3(-.42,.78,.46))),0.),18.)*1.5;c+=vec3(1.,.5,.16)*pow(max(dot(R,normalize(vec3(.8,-.5,.34))),0.),9.)*.8;c+=vec3(.9,.7,.45)*pow(max(R.z,0.),40.)*.35;return c;}
float band(float x,float a,float b,float w){return smoothstep(a-w,a+w,x)*(1.-smoothstep(b-w,b+w,x));}
vec3 polish(vec3 al,vec3 N,vec3 V,float ct){vec3 R=reflect(-V,N);float NV=max(dot(N,V),0.),F=.04+.96*pow(1.-NV,5.),NL=max(dot(N,LD),0.);vec3 H=normalize(LD+V);float NH=max(dot(N,H),0.);return al*(.6+NL*.75)+env(R)*F*2.4*ct+vec3(1.,.9,.72)*pow(NH,300.)*1.1;}
void main(){vec3 N=normalize(vN),V=normalize(Eye-vW),T=normalize(vT);float r=length(vL.xy),w=1.3/Px;
if(Kind>4.5&&Kind<5.5){float rr=length(vW.xy),fall=exp(-max(rr-1.6,0.)*.9),nn=texture2D(Mb,vW.xy*.07+.5).g;vec3 c=mix(WallA,WallB,clamp(nn*4.,0.,1.3));gl_FragColor=vec4(c*(.25+fall*1.5)*Amb+SeamC*vec3(.3,.18,.1)*exp(-(rr-1.62)*4.)*Hot,1.);return;}
if(Kind>5.5&&Kind<6.5){float f=clamp(1.-r/1.05,0.,1.);gl_FragColor=vec4(HazeC*(.25+f*1.2)*Em,0.);return;}
if(Kind>1.5&&Kind<2.5){float a=fract(atan(vL.y,vL.x)/TAU+.25);float on=1.-smoothstep(Arc-.002,Arc+.002,a),head=exp(-max(Arc-a,0.)*60.)*step(a,Arc);gl_FragColor=vec4(SeamC*(Seam*on+head*4.*step(.001,Arc)*step(Arc,.999)),1.);return;}
vec3 H=normalize(LD+V);float NH=max(dot(N,H),0.);
if(Kind>6.5){vec2 fu=abs(mod(vL.xy*vec2(.62,.125)+.5,2.)-1.);vec3 m=texture2D(Mb,vec2(fu.x,clamp((fu.y-.285)/.43,0.,1.))).rgb;float v=smoothstep(.1,.4,m.r-m.b);vec3 c=polish(m*1.1,N,V,.8);c+=vec3(1.,.76,.36)*v*(.1+pow(NH,24.)*1.3);gl_FragColor=vec4(c*Amb,1.);return;}
vec3 B=normalize(cross(N,T));float sc=texture2D(Sc,vec2(r*7.,.5)).r-.5;vec3 Np=normalize(N+B*sc*An*.5),R=reflect(-V,Np);float NV=max(dot(Np,V),0.);
vec3 c=env(R)*mix(vec3(.9),Base,.94)*Spec;float TH=dot(T,H),NL=max(dot(N,LD),0.);c+=Base*pow(sqrt(max(0.,1.-TH*TH)),mix(1400.,120.,An))*NL*(.5+An*1.8);
vec3 H2=normalize(normalize(vec3(.7,-.55,.5))+V);float TH2=dot(T,H2);c+=Base*vec3(1.,.7,.42)*pow(sqrt(max(0.,1.-TH2*TH2)),mix(1400.,160.,An))*.5;c+=env(R)*pow(1.-NV,4.)*.4;c*=Amb;
if(Kind>.5&&Kind<1.5&&N.z>.9){float a=atan(vL.y,vL.x)/TAU+.5,wa=72./(TAU*r*Px)*1.1,f=abs(fract(a*72.)-.5);float mi=(1.-smoothstep(.09-wa,.09+wa,f))*band(r,.705,.752,w),ma=(1.-smoothstep(.022-wa/6.,.022+wa/6.,abs(fract(a*12.+.5)-.5)))*band(r,.672,.758,w);c=mix(c,TickC*(Amb*.9+.05),clamp(mi*.8+ma,0.,1.));float i=floor(a*12.),th=((i+.5)/12.-.5)*TAU;vec2 lp=vec2(cos(th),sin(th))*.645;float d=length(vL.xy-lp),lamp=1.-smoothstep(.0185-w,.0185+w,d),halo=exp(-d*d*2600.),on=1.-step(Lit,i);c=mix(c,LampC*.1*Amb,lamp);c+=LampC*on*(lamp*1.7+halo*.9);}
c+=Base*Em;gl_FragColor=vec4(c,1.);}`;
const v3=(a,x,y,z)=>a.push(x,y,z);
function lathe(prof,seg=132){const v=[];for(let i=0;i<prof.length-1;i++){const[r0,z0]=prof[i],[r1,z1]=prof[i+1];let nr=z1-z0,nz=r0-r1;const l=Math.hypot(nr,nz)||1;nr/=l;nz/=l;for(let j=0;j<seg;j++){const a0=j/seg*TAU,a1=(j+1)/seg*TAU,c0=Math.cos(a0),s0=Math.sin(a0),c1=Math.cos(a1),s1=Math.sin(a1),add=(r,z,c,s)=>{v3(v,r*c,r*s,z);v3(v,nr*c,nr*s,nz);v3(v,-s,c,0)};add(r0,z0,c0,s0);add(r1,z1,c0,s0);add(r0,z0,c1,s1);add(r1,z1,c0,s0);add(r1,z1,c1,s1);add(r0,z0,c1,s1)}}return v}
function torus(R,r,seg,side,z0){const v=[];for(let j=0;j<seg;j++){const a0=j/seg*TAU,a1=(j+1)/seg*TAU;for(let i=0;i<side;i++){const b0=i/side*TAU,b1=(i+1)/side*TAU,add=(a,b)=>{const c=Math.cos(a),s=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),rr=R+r*cb;v3(v,rr*c,rr*s,z0+r*sb);v3(v,cb*c,cb*s,sb);v3(v,-s,c,0)};add(a0,b0);add(a1,b0);add(a0,b1);add(a1,b0);add(a1,b1);add(a0,b1)}}return v}
function cyl(x0,x1,r,z,seg){const v=[];for(let i=0;i<seg;i++){const b0=i/seg*TAU,b1=(i+1)/seg*TAU,add=(x,b)=>{const c=Math.cos(b),s=Math.sin(b);v3(v,x,r*c,z+r*s);v3(v,0,c,s);v3(v,1,0,0)};add(x0,b0);add(x1,b0);add(x0,b1);add(x1,b0);add(x1,b1);add(x0,b1)}return v}
function box(l,w,z0,z1,b=.012){const v=[],q=(p0,p1,p2,p3,n,t)=>{for(const p of[p0,p1,p2,p1,p3,p2]){v3(v,p[0],p[1],p[2]);v3(v,n[0],n[1],n[2]);v3(v,t[0],t[1],t[2])}},T=[1,0,0],hl=l/2,il=hl-b,a=w/2,ia=a-b,n=.7071;q([-il,-ia,z1],[il,-ia,z1],[-il,ia,z1],[il,ia,z1],[0,0,1],T);q([-hl,a,z1-b],[hl,a,z1-b],[-il,ia,z1],[il,ia,z1],[0,n,n],T);q([il,-ia,z1],[hl,-a,z1-b],[-il,-ia,z1],[-hl,-a,z1-b],[0,-n,n],T);q([hl,a,z1-b],[hl,-a,z1-b],[il,ia,z1],[il,-ia,z1],[n,0,n],[0,1,0]);q([-hl,-a,z1-b],[-hl,a,z1-b],[-il,-ia,z1],[-il,ia,z1],[-n,0,n],[0,1,0]);q([-hl,a,z0],[hl,a,z0],[-hl,a,z1-b],[hl,a,z1-b],[0,1,0],T);q([hl,-a,z0],[-hl,-a,z0],[hl,-a,z1-b],[-hl,-a,z1-b],[0,-1,0],T);q([hl,a,z0],[hl,-a,z0],[hl,a,z1-b],[hl,-a,z1-b],[1,0,0],[0,1,0]);q([-hl,-a,z0],[-hl,a,z0],[-hl,-a,z1-b],[-hl,a,z1-b],[-1,0,0],[0,1,0]);return v}
function around(src,n,x,z,a0=0){const o=[];for(let i=0;i<n;i++){const a=a0+i/n*TAU,c=Math.cos(a),s=Math.sin(a);for(let j=0;j<src.length;j+=9){const px=src[j]+x,py=src[j+1],pz=src[j+2]+z,nx=src[j+3],ny=src[j+4],nz=src[j+5],tx=src[j+6],ty=src[j+7],tz=src[j+8];o.push(px*c-py*s,px*s+py*c,pz,nx*c-ny*s,nx*s+ny*c,nz,tx*c-ty*s,tx*s+ty*c,tz)}}return o}
const m4={id:()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),mul(a,b){const o=new Float32Array(16);for(let i=0;i<4;i++)for(let j=0;j<4;j++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+j]*b[i*4+k];o[i*4+j]=s}return o},tr(x,y,z){const o=m4.id();o[12]=x;o[13]=y;o[14]=z;return o},rz(a){const o=m4.id(),c=Math.cos(a),s=Math.sin(a);o[0]=c;o[1]=s;o[4]=-s;o[5]=c;return o},ry(a){const o=m4.id(),c=Math.cos(a),s=Math.sin(a);o[0]=c;o[2]=-s;o[8]=s;o[10]=c;return o},persp(f,asp,n,fr){const o=new Float32Array(16);o[0]=f/asp;o[5]=f;o[10]=(fr+n)/(n-fr);o[11]=-1;o[14]=2*fr*n/(n-fr);return o}};
const M={gold:{b:[1,.73,.31],s:1.25,an:.28},bright:{b:[1,.8,.42],s:1.45,an:.12},back:{b:[.05,.045,.04],s:.5,an:.4},ink:{b:[.03,.028,.03],s:1.1,an:.15},dark:{b:[.085,.075,.07],s:.8,an:.6}};
const FOV=38*Math.PI/180,tanH=Math.tan(FOV/2),HINGE=-1.035,BARS=12;
const fp=()=>View.H/2/tanH;
function layout(){const W=View.W,H=View.H,Rl=clamp(W*.7,220,312)*clamp(H/800,.82,1.08);return{est:Math.min(W*.43,H*.26),Rl,hl:Math.max(H*.215,Rl*.585+58)}}
function project(x,y,z){const f=fp(),cz=f/S.R+S.diveZ,cy=(S.hub-View.H/2)/S.R,d=cz-z;return{x:View.W/2+x*f/d,y:View.H/2-(y-cy)*f/d,s:f/d}}
const up=arr=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(arr),gl.STATIC_DRAW);return{b,n:arr.length/9}};
function buildScene(){pr=prog(gl,VS,FS);const sc=document.createElement('canvas');sc.width=512;sc.height=4;const g=sc.getContext('2d');for(let x=0;x<512;x++){const v=Math.floor(128+(Math.random()-.5)*210);g.fillStyle='rgb('+v+','+v+','+v+')';g.fillRect(x,0,1,4)}
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);scT=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,scT);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,sc);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  mbT=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,mbT);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([6,5,5,255]));gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  G3={frameA:up(lathe([[1.72,-.08],[1.70,.07],[1.66,.11],[1.34,.11],[1.31,.075]],150)),frameB:up(lathe([[1.31,.075],[1.075,.075],[1.05,.045],[1.05,-.82]],150)),trim:up(lathe([[1.285,.085],[1.27,.112],[1.21,.112],[1.195,.085]],150)),seam:up(lathe([[1.045,.012],[1.024,.012]],150)),body:up(lathe([[1.02,-.46],[1.02,-.015]],132)),bev:up(lathe([[1.02,-.015],[.995,.016]],132)),face:up(lathe([[.995,.016],[.812,.016]],132)),faceBev:up(lathe([[.812,.016],[.792,-.02]],132)),back:up(lathe([[1.02,-.46],[0,-.46]],64)),tum:up(lathe([[.79,-.02],[.778,.034],[.612,.034],[.6,-.02]],132)),band:up(lathe([[.598,-.02],[.568,.062],[.505,.062],[.475,-.034]],132)),rec:up(lathe([[.475,-.034],[.0,-.034]],96)),boss:up(lathe([[.272,-.034],[.272,.09],[.256,.112],[.232,.116],[0,.116]],96)),wall:up(lathe([[9,.0],[1.7,.0]],64)),haze:up(lathe([[1.05,-.8],[0,-.8]],64)),wheel:up([...torus(.425,.017,120,10,.05),...around(cyl(.24,.42,.012,.05,10),3,0,0,Math.PI/2)]),bolt:up(box(.31,.058,.018,.122)),rail:up(box(.07,.11,.016,.05))}}
function dr(m,Mx,mat,kind=0){const u=pr.u;gl.bindBuffer(gl.ARRAY_BUFFER,m.b);gl.vertexAttribPointer(pr.a.P,3,gl.FLOAT,false,36,0);gl.vertexAttribPointer(pr.a.N,3,gl.FLOAT,false,36,12);gl.vertexAttribPointer(pr.a.T,3,gl.FLOAT,false,36,24);gl.uniformMatrix4fv(u.M,false,Mx);if(mat){gl.uniform3fv(u.Base,mat.b);gl.uniform1f(u.Spec,mat.s);gl.uniform1f(u.An,mat.an)}gl.uniform1f(u.Kind,kind);gl.drawArrays(gl.TRIANGLES,0,m.n)}
const I4=m4.id();
function drawScene(t){if(!gl||!G3)return;const f=fp(),cz0=f/S.R,cy=(S.hub-View.H/2)/S.R,cz=cz0+S.diveZ,shx=FX.shk?Math.sin(t*87.)*FX.shk*.0022*(cz0/3):0,shy=FX.shk?Math.cos(t*113.)*FX.shk*.0022*(cz0/3):0;
  const VP=m4.mul(m4.persp(1/tanH,View.W/View.H,.4,30),m4.tr(-shx,-cy-shy,-cz));BG.clear();gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.BLEND);gl.disable(gl.CULL_FACE);gl.useProgram(pr.p);const u=pr.u;gl.uniformMatrix4fv(u.VP,false,VP);gl.uniform3f(u.Eye,shx,cy+shy,cz);
  const la=t*.28,ld=[Math.cos(la)*.55,Math.sin(la)*.55+.1,.82],l=Math.hypot(ld[0],ld[1],ld[2]);gl.uniform3f(u.LD,ld[0]/l,ld[1]/l,ld[2]/l);gl.uniform1f(u.Amb,S.amb);gl.uniform1f(u.Px,S.R*(bgCv.width/View.W));gl.uniform1f(u.Lit,S.lit);gl.uniform1f(u.Seam,S.seam);gl.uniform1f(u.Arc,S.arc);gl.uniform1f(u.Em,0);gl.uniform1f(u.Hot,S.hot);gl.uniform3fv(u.LampC,S.lamp);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,scT);gl.uniform1i(u.Sc,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,mbT);gl.uniform1i(u.Mb,1);gl.enableVertexAttribArray(pr.a.P);gl.enableVertexAttribArray(pr.a.N);gl.enableVertexAttribArray(pr.a.T);
  dr(G3.wall,I4,M.dark,5);dr(G3.frameA,I4,M.ink,7);dr(G3.frameB,I4,M.ink);dr(G3.trim,I4,M.gold);dr(G3.seam,I4,M.dark,2);
  const Gd=m4.mul(m4.mul(m4.tr(HINGE,0,0),m4.ry(-S.swing)),m4.tr(-HINGE,0,0));dr(G3.body,Gd,M.ink);dr(G3.bev,Gd,M.gold);dr(G3.face,Gd,M.ink,7);dr(G3.faceBev,Gd,M.gold);dr(G3.back,Gd,M.back);dr(G3.tum,m4.mul(Gd,m4.rz(S.tum)),M.ink,1);dr(G3.band,m4.mul(Gd,m4.rz(-S.tum*.3)),M.bright);dr(G3.rec,Gd,M.ink,7);dr(G3.wheel,m4.mul(Gd,m4.rz(S.wheel)),M.bright);dr(G3.boss,Gd,M.gold);
  for(let i=0;i<BARS;i++){const Ga=m4.mul(Gd,m4.rz((i+.5)/BARS*TAU));dr(G3.rail,m4.mul(Ga,m4.tr(.86,0,0)),M.ink);dr(G3.bolt,m4.mul(Ga,m4.tr(mix(.905,1.11,S.bars[i]),0,0)),M.bright)}
  if(S.haze>.001){gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE);gl.depthMask(false);gl.uniform1f(u.Em,S.haze);dr(G3.haze,I4,M.dark,6);gl.depthMask(true);gl.disable(gl.BLEND)}
  gl.disable(gl.DEPTH_TEST)}

/* ---------- loop: draws only when something moves, idle light is capped ---------- */
let looping=false,lastT=0,idleAcc=0;
function wake(){if(!looping&&!document.hidden&&phase!=='off'&&phase!=='plain'){looping=true;lastT=0;Perf.skip=Math.max(Perf.skip,3);requestAnimationFrame(loop)}}
function loop(now){if(document.hidden||phase==='off'||phase==='plain'){looping=false;return}
  try{const raw=lastT?(now-lastT)/1000:.016;lastT=now;const dt=Math.min(.05,raw)*speed;
    const L=tasks;tasks=[];for(const t of L){t.e+=dt;const k=clamp(t.e/t.d);t.fn(k,t.e);if(k>=1)t.res();else tasks.push(t)}
    if(phase==='off'||phase==='plain'){looping=false;return}
    S.tumV+=((S.tumT-S.tum)*120-S.tumV*13)*dt;S.tum+=S.tumV*dt;
    if(S.hold){S.tum+=dt*2.2;S.tumT=S.tum;S.wheel-=dt*3}
    if(S.busy||S.hold)S.lit=(now/1000*11)%13;
    FX.tick(dt);
    const moving=tasks.length>0||FX.list.length>0||FX.shk>0||S.busy||S.hold||Math.abs(S.tumV)>.002||Math.abs(S.tumT-S.tum)>.002;
    idleAcc+=dt;const gap=[1e9,1e9,.05,.0333][Perf.level];let drew=false;
    if(moving||idleAcc>=gap){idleAcc=0;drawScene(now/1000);drew=true}
    if(drew&&phase==='login'&&Logo.a>0)hubSet();
    FX.draw();Perf.sample(raw,now);
    if(moving||Perf.level>=2)requestAnimationFrame(loop);else looping=false;
  }catch(e){console.warn('vault',e);toPlain()}
}

/* ---------- crisp logo above the GL layers ---------- */
const Logo={x:0,y:0,s:100,a:0,set(x,y,s,a){this.x=x;this.y=y;this.s=s;if(a!==undefined)this.a=a;if(!logoEl)return;logoEl.style.transform='translate3d('+(x-s/2)+'px,'+(y-s/2)+'px,0) scale('+(s/176)+')';if(a!==undefined)logoEl.style.opacity=a}};
function hubSet(){const p=project(0,0,.116);Logo.set(p.x,p.y,.5*p.s,1)}
const Form={y:0,rect(el){const r=(el||form).getBoundingClientRect(),s=loginView.getBoundingClientRect();return{x:r.left-s.left,y:r.top-s.top,w:r.width,h:r.height}},place(top,dy=0){form.style.top=top+'px';this.dy(dy)},dy(v){this.y=v;form.style.transform='translate3d(-50%,'+v+'px,0)'}};
function plateTop(L){const fr=Form.rect();return Math.min(View.H-fr.h-Math.max(18,View.H*.035),L.hl+L.Rl*.62+6)}
function setSkip(on){if(skipBtn)skipBtn.classList.toggle('on',on);if(!on)speed=1}
function installFit(){const fr=Form.rect();root.classList.toggle('po-vault-busy',fr.y+fr.h+Form.y+50>View.H)}

/* ---------- sequences ---------- */
function resetScene(){Object.assign(S,{amb:0,arc:0,seam:0,tum:-2.2,tumT:-2.2,tumV:0,wheel:1.4,lit:0,swing:0,haze:0,hot:0,diveZ:0,hold:false,busy:false,lamp:[1,.6,.18]});S.bars.fill(0)}
function slamWave(step,big){for(let i=0;i<BARS;i++){const j=(i+3)%BARS;later(i*step,()=>tl(120,k=>{S.bars[j]=E.back(k)}).then(()=>{const a=(j+.5)/BARS*TAU,p=project(Math.cos(a)*1.2,Math.sin(a)*1.2,.1);FX.sparks(p.x,p.y,6,{v0:50,v1:260,life:.5,g:520});FX.shake(i===BARS-1?big:2.6);if(i%3===0)buzz(8)}))}return BARS*step+150}
function loginReady(){phase='login';setSkip(false);S.lit=0;Form.dy(0);installFit();clearDogs();wake();try{sessionStorage.setItem(SEEN,'1')}catch(_){}}
/* the sequence is finished at once: used when a phone cannot keep up */
function snapToLogin(){if(phase!=='open')return;tasks=[];const L=layout();Object.assign(S,{amb:1,arc:1.01,seam:.34,hot:.8,tum:0,tumT:0,wheel:0,R:L.Rl,hub:L.hl});S.bars.fill(1);hubSet();Form.dy(0);logoEl&&(logoEl.style.opacity=1);FX.list.length=0;loginReady()}
async function fullOpening(){const L=layout(),H=View.H;resetScene();S.R=L.est*.9;S.hub=H/2;Form.place(0);Form.place(plateTop(L),H-plateTop(L)+40);setSkip(true);
  await wait(240);
  const hd=()=>{const a=(S.arc+.25)*TAU-Math.PI;return project(Math.cos(a)*1.035,Math.sin(a)*1.035,.02)};let acc=0;
  await tl(820,k=>{S.arc=E.io2(k);S.R=L.est*mix(.9,.95,k);S.amb=k*.05;const p=hd();acc++;if(acc%2===0)FX.sparks(p.x,p.y,2,{v0:60,v1:300,life:.8,g:520});FX.glow(p.x,p.y,34,{life:.09,a:.8,grow:1})});
  S.arc=1.01;S.seam=1.5;const c=project(0,0,0);FX.glow(c.x,c.y,S.R*2.4,{life:.55,a:.5});FX.shake(9);buzz(25);
  tl(460,k=>{S.seam=mix(1.5,.34,E.out2(k));S.amb=mix(.05,.82,E.out3(k));S.R=L.est*mix(.95,1,E.out3(k));S.hot=k*.8});
  await wait(300);await wait(slamWave(46,11));
  const t0=S.tum,w0=S.wheel;tl(880,k=>{const e=E.soft(k);S.tum=S.tumT=t0*(1-e);S.wheel=w0*(1-E.out3(k))});
  await wait(300);
  const hp=project(0,0,.116);Logo.set(hp.x,hp.y,.5*hp.s,0);
  await tl(360,k=>{const p=project(0,0,.116);Logo.set(p.x,p.y,.5*p.s*mix(.86,1,E.back(k)),E.out3(k));S.amb=mix(.82,1,k)});
  FX.ring(hp.x,hp.y,hp.s*.2,hp.s*.95,{life:.65,a:.9});FX.glow(hp.x,hp.y,hp.s*.8,{life:.5,a:.65});buzz(14);
  await wait(240);await riseToLogin(L);
}
async function riseToLogin(L){const R0=S.R,h0=S.hub,dy0=Form.y;tl(820,k=>{const e=E.io3(k);S.R=mix(R0,L.Rl,e);S.hub=mix(h0,L.hl,e);hubSet()});await wait(240);await tl(560,k=>{Form.dy(dy0*(1-E.out4(k)))});Form.dy(0);FX.shake(7);buzz(18);const f2=Form.rect();FX.sparks(f2.x+8,f2.y+8,10,{v0:60,v1:240,life:.6,g:500});FX.sparks(f2.x+f2.w-8,f2.y+8,10,{v0:60,v1:240,life:.6,g:500});loginReady()}
async function quickOpening(){const L=layout(),H=View.H;resetScene();S.R=L.est*.92;S.hub=H/2;S.seam=.34;S.hot=.8;S.tum=S.tumT=-1.2;S.wheel=.9;S.arc=1.01;Form.place(0);Form.place(plateTop(L),H-plateTop(L)+40);setSkip(false);
  tl(380,k=>{S.amb=E.out2(k);S.R=L.est*mix(.92,1,E.out3(k))});await wait(100);const ms=slamWave(26,8),t0=S.tum,w0=S.wheel;tl(ms+200,k=>{const e=E.soft(k);S.tum=S.tumT=t0*(1-e);S.wheel=w0*(1-E.out3(k))});await wait(ms-40);
  const hp=project(0,0,.116);Logo.set(hp.x,hp.y,.5*hp.s,0);await tl(260,k=>{const p=project(0,0,.116);Logo.set(p.x,p.y,.5*p.s*mix(.86,1,E.back(k)),E.out3(k))});await riseToLogin(L)}

function typed(el){if(phase!=='login'||!gl)return;const n=uI.value.length+pI.value.length;S.lit=Math.min(12,n);S.tumT+=(el===pI?.105:-.105);buzz(5);const i=Math.max(0,(n-1)%12),th=((i+.5)/12-.5)*TAU+S.tum,p=project(Math.cos(th)*.645,Math.sin(th)*.645,.05);FX.sparks(p.x,p.y,3,{v0:30,v1:150,life:.42,g:420});FX.glow(p.x,p.y,16,{life:.2,a:.8,grow:1});wake()}
function rejected(){if(phase!=='login'||!errBox.textContent.trim())return;S.busy=false;const y=Form.y||0,X=d=>'translate3d(calc(-50% + '+d+'px),'+y+'px,0)';form.animate([{transform:X(0)},{transform:X(-10)},{transform:X(9)},{transform:X(-6)},{transform:X(4)},{transform:X(0)}],{duration:380,easing:'ease-out'});buzz(40);if(gl){FX.shake(9);S.lamp=[1,.16,.07];S.lit=12;S.tumT-=.7;tl(620,()=>{}).then(()=>{S.lamp=[1,.6,.18];S.lit=Math.min(12,uI.value.length+pI.value.length)});wake()}}

function arriveEls(){const seen=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.top<View.H&&r.bottom>0};const view=$('main .view.active')||$('#homeView');let list=view?[...view.children]:[];const out=[];for(const e of list){if(e.id==='homeKpis')out.push(...e.children);else out.push(e)}return[$('#appView .header'),...out.filter(seen),$('.bottom-nav')].filter(Boolean)}
function arrive(fade){arriveEls().forEach((el,i)=>{const n=el.classList,left=i%2===1;if(fade){el.animate([{opacity:0},{opacity:1}],{duration:260,delay:i*24,fill:'backwards'});return}const from=n.contains('header')?'translate3d(0,-110%,0)':n.contains('bottom-nav')?'translate3d(0,110%,0)':'translate3d('+(left?-112:112)+'%,0,0)';el.animate([{transform:from},{transform:'none',offset:.78,easing:'cubic-bezier(.3,1.6,.5,1)'},{transform:'none'}],{duration:640,delay:120+i*62,easing:'cubic-bezier(.12,.8,.2,1)',fill:'backwards'})})}
async function flyLogo(ms,arc){const img=$('.brand img');let tx=View.W/2,ty=34,ts=43;if(img){const r=img.getBoundingClientRect();if(r.width){ts=r.width;tx=r.left+r.width/2;ty=r.top+r.height/2}}const x0=Logo.x,y0=Logo.y,s0=Logo.s;await tl(ms,k=>{const e=E.io3(k);Logo.set(mix(x0,tx,e)+Math.sin(k*Math.PI)*arc*.25,mix(y0,ty,e)-Math.sin(k*Math.PI)*arc,mix(s0,ts,e),1)});FX.ring(tx,ty,ts*.5,ts*1.5,{life:.5,a:.8});FX.sparks(tx,ty,14,{v0:40,v1:220,life:.7,g:260});buzz(10)}
async function enter(){if(!gl){plainEnter();return}phase='enter';setSkip(false);tasks=[];S.busy=false;bgCv.style.background='none';Logo.a||Logo.set(Logo.x,Logo.y,Logo.s,1);root.classList.add('po-vault-busy');loginView.classList.remove('hidden');
  dog(()=>finish(),11000);const L=layout(),H=View.H,dy0=Form.y||0;
  tl(380,k=>{Form.dy(dy0+H*E.in3(k))}).then(()=>{form.style.visibility='hidden'});
  const R0=S.R,h0=S.hub;tl(760,k=>{const e=E.io3(k);S.R=mix(R0,L.est,e);S.hub=mix(h0,H/2,e);hubSet()});
  const t0=S.tum,w0=S.wheel,lit0=S.lit;tl(1140,k=>{const e=E.in3(k);S.tum=S.tumT=t0+e*TAU*1.1;S.wheel=w0-e*TAU*1.7;S.lit=mix(lit0,12,E.out2(k));S.seam=mix(.34,.7,k)});
  await wait(900);
  for(let i=0;i<BARS;i++){const j=(i+3)%BARS;later(i*34,()=>tl(150,k=>{S.bars[j]=1-E.in2(k)}).then(()=>{const a=(j+.5)/BARS*TAU,p=project(Math.cos(a)*.98,Math.sin(a)*.98,.1);FX.sparks(p.x,p.y,5,{v0:40,v1:220,life:.45,g:520});FX.shake(2.4);if(i%4===0)buzz(8)}))}
  await wait(BARS*34+170);
  /* the panel's data decides when the door swings, never longer than 2.4 s */
  S.hold=true;await Promise.race([Promise.resolve(bootP).catch(()=>{}),wait(2400)]);S.hold=false;
  FX.shake(13);buzz(30);S.seam=1.7;S.haze=.5;const c=project(0,0,0);FX.glow(c.x,c.y,S.R*2,{life:.5,a:.42});
  flyLogo(820,40);
  tl(1240,k=>{S.swing=E.io3(k)*1.92;S.haze=mix(.5,1.15,ss(0,.6,k))});
  await wait(620);handOff(false);const cz0=fp()/S.R;
  await tl(980,k=>{S.diveZ=-(cz0+1.2)*E.in3(k);S.haze=mix(1.15,0,ss(.45,1,k))});
  finish();
}
/* V1.1: the panel's cards are dealt from the PAR ORDO deck (par-ordo-deal-v1.js); the old arrival stays as the fallback */
function handOff(fade){const D=window.PARORDODeal;if(D&&typeof D.arrive==='function'){try{if(D.arrive({source:fade?'plain':'vault'}))return}catch(e){console.warn('vault deal',e)}}arrive(fade)}
function plainEnter(){phase='enter';handOff(true);finish()}
function finish(){const ok=hasToken();dispose();if(ok)loginView.classList.add('hidden')}

/* ---------- plain marble login when there is no door ---------- */
function killGL(){for(const c of[gl,FX.gl]){try{c&&c.getExtension('WEBGL_lose_context')&&c.getExtension('WEBGL_lose_context').loseContext()}catch(_){}}gl=null;FX.gl=null;G3=null}
function toPlain(){release();killGL();tasks=[];clearDogs();[bgCv,fxCv,logoEl,skipBtn].forEach(e=>e&&e.remove());bgCv=fxCv=logoEl=skipBtn=null;form.style.transform='';form.style.top='';form.style.visibility='';root.classList.add('po-vault-plain');root.classList.remove('po-vault-busy');if(phase!=='enter')phase='plain';if(hasToken()){finish()}}

/* ---------- life cycle ---------- */
function clearDogs(){dogs.forEach(clearTimeout);dogs=[]}
function dog(fn,ms){dogs.push(setTimeout(fn,ms))}
function dressForm(){if(texts)return;texts={b:btn.textContent,p:pI.placeholder};btn.textContent='Войти';pI.placeholder='Введите пароль';const lab=(t,el)=>{const s=document.createElement('span');s.className='po-vl';s.textContent=t;el.before(s);extras.push(s)};lab('Логин',uI);lab('Пароль',pI.closest('.password-field-wrap')||pI);for(const c of'abcd'){const i=document.createElement('i');i.className='po-sc '+c;form.append(i);extras.push(i)}}
function undressForm(){extras.forEach(e=>e.remove());extras=[];if(texts){btn.textContent=texts.b;pI.placeholder=texts.p;texts=null}form.style.cssText=''}
function watch(){const a=()=>typed(uI),b=()=>typed(pI);uI.addEventListener('input',a);pI.addEventListener('input',b);obs.push(()=>{uI.removeEventListener('input',a);pI.removeEventListener('input',b)});const m1=new MutationObserver(()=>{S.busy=btn.disabled&&phase==='login';if(S.busy)wake();else if(phase==='login')S.lit=Math.min(12,uI.value.length+pI.value.length)});m1.observe(btn,{attributes:true,attributeFilter:['disabled']});obs.push(()=>m1.disconnect());if(errBox){const m2=new MutationObserver(rejected);m2.observe(errBox,{childList:true,characterData:true,subtree:true});obs.push(()=>m2.disconnect())}}
function kbFit(){const typing=document.activeElement===uI||document.activeElement===pI;if(!typing||phase==='off'){root.style.setProperty('--po-kb','0px');return}const vv=window.visualViewport,h=vv?vv.height+vv.offsetTop:innerHeight,g=Form.rect(btn),dy=Math.max(0,g.y+g.h+14+Form.y-h);root.style.setProperty('--po-kb',(-dy)+'px')}
const onFocus=()=>setTimeout(kbFit,300),onBlur=()=>setTimeout(kbFit,80),onVis=()=>{if(!document.hidden)wake()};
function onResize(){if(document.activeElement===uI||document.activeElement===pI)return;if(Math.abs(innerWidth-View.W)<2&&Math.abs(innerHeight-View.H)<110)return;readView();if(phase==='plain'||!gl)return;BG.res(Perf.res());FX.res();if(phase==='login'){const L=layout();S.R=L.Rl;S.hub=L.hl;Form.place(plateTop(L),0);hubSet();installFit();drawScene(performance.now()/1000)}}
function start(mode){if(phase!=='off')return;
  readView();phase='open';tasks=[];speed=1;Perf.init();root.classList.add('po-vault-on','po-vault-busy');dressForm();form.style.visibility='hidden';
  const go=()=>{release();form.style.visibility=''};
  if(Perf.level<1||mode==='plain'){go();phase='plain';root.classList.add('po-vault-plain');root.classList.remove('po-vault-busy');watch();return}
  try{
    bgCv=document.createElement('canvas');bgCv.id='poVaultBg';fxCv=document.createElement('canvas');fxCv.id='poVaultFx';logoEl=new Image();logoEl.id='poVaultLogo';logoEl.alt='';logoEl.src='./assets/vault-logo.webp';skipBtn=document.createElement('button');skipBtn.id='poVaultSkip';skipBtn.type='button';skipBtn.textContent='Пропустить';skipBtn.addEventListener('click',()=>{speed=7});document.body.append(bgCv,logoEl,fxCv,skipBtn);
    gl=bgCv.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:Perf.level>=2,depth:true,stencil:false,powerPreference:'high-performance'});if(!gl)throw new Error('no webgl');
    bgCv.addEventListener('webglcontextlost',e=>{e.preventDefault();if(phase!=='off'){gl=null;toPlain()}});
    buildScene();FX.init();
    if(!Perf.known&&Perf.level>=2){BG.res(1);Perf.bench();if(Perf.level<1)throw new Error('weak')}
    BG.res(Perf.res());
  }catch(e){console.warn('vault',e);go();toPlain();watch();return}
  watch();
  addEventListener('resize',onResize);document.addEventListener('visibilitychange',onVis);uI.addEventListener('focus',onFocus);pI.addEventListener('focus',onFocus);uI.addEventListener('blur',onBlur);pI.addEventListener('blur',onBlur);window.visualViewport&&visualViewport.addEventListener('resize',kbFit);
  obs.push(()=>{removeEventListener('resize',onResize);document.removeEventListener('visibilitychange',onVis);uI.removeEventListener('focus',onFocus);pI.removeEventListener('focus',onFocus);uI.removeEventListener('blur',onBlur);pI.removeEventListener('blur',onBlur);window.visualViewport&&visualViewport.removeEventListener('resize',kbFit)});
  const fullFirst=(()=>{if(mode==='quick')return false;try{return sessionStorage.getItem(SEEN)!=='1'}catch(_){return true}})();
  const tex=loadImg('./assets/vault-marble.webp').then(im=>{if(im&&gl){gl.bindTexture(gl.TEXTURE_2D,mbT);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,im);gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR)}});
  Promise.race([Promise.all([tex,logoEl.decode?logoEl.decode().catch(()=>{}):0]),new Promise(r=>setTimeout(r,2200))]).then(()=>{if(phase!=='open'||!gl)return;go();wake();dog(snapToLogin,12000);(fullFirst?fullOpening():quickOpening()).catch(e=>{console.warn('vault',e);toPlain()})});
}
function dispose(){phase='off';tasks=[];clearDogs();obs.forEach(f=>f());obs=[];S.busy=S.hold=false;killGL();[bgCv,fxCv,logoEl,skipBtn].forEach(e=>e&&e.remove());bgCv=fxCv=logoEl=skipBtn=null;undressForm();root.classList.remove('po-vault-on','po-vault-busy','po-vault-plain','po-vault-boot');root.style.removeProperty('--po-kb');looping=false}

/* ---------- the only hooks into the page: the same two functions it already calls ---------- */
const showAppO=window.showApp,showLoginO=window.showLogin,bootAppO=window.bootApp;
if(typeof showAppO!=='function'||typeof showLoginO!=='function'){release();return}
window.showApp=function(){const r=showAppO.apply(this,arguments);try{if(phase==='login'||phase==='open'||phase==='plain'){if(phase==='plain')plainEnter();else enter()}}catch(e){console.warn('vault',e);dispose()}return r};
if(typeof bootAppO==='function')window.bootApp=function(){const p=bootAppO.apply(this,arguments);bootP=p;return p};
window.showLogin=function(){const r=showLoginO.apply(this,arguments);try{start('quick')}catch(e){console.warn('vault',e);dispose()}return r};
window.PARORDOVault=Object.freeze({version:'1.1.0',level:()=>Perf.level,phase:()=>phase});
if(hasToken()){release();return}
try{start('auto')}catch(e){console.warn('vault',e);release();dispose()}
})();
