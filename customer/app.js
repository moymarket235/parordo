(() => {
'use strict';
const $ = s => document.querySelector(s);
const screens = [...document.querySelectorAll('.screen')], tabs = [...document.querySelectorAll('[data-tab]')];
let guests=2, deferredPrompt=null, toastTimer;
function toast(msg){const n=$('#toast');n.textContent=msg;n.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove('show'),2800)}
function go(id){screens.forEach(s=>s.classList.toggle('active',s.id===id));tabs.forEach(t=>t.classList.toggle('active',t.dataset.tab===id));window.scrollTo({top:0,behavior:'smooth'})}
document.addEventListener('click',e=>{const t=e.target.closest('[data-tab]');if(t)return go(t.dataset.tab);const g=e.target.closest('[data-go]');if(g)return go(g.dataset.go);const f=e.target.closest('[data-filter-go]');if(f){go('gallery');document.querySelector(`[data-filter="${f.dataset.filterGo}"]`)?.click()}});
$('#menuBtn').addEventListener('click',()=>go('profile'));
$('#installBtn').addEventListener('click',async()=>{if(deferredPrompt){deferredPrompt.prompt();try{const r=await deferredPrompt.userChoice;toast(r.outcome==='accepted'?'Установка началась':'Установку можно выполнить позже')}catch(_){toast('Откройте меню Chrome → Установить приложение')}deferredPrompt=null}else toast('Меню Chrome → «Установить приложение» или «Добавить на главный экран»')});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e});
const filters=[...document.querySelectorAll('[data-filter]')], tiles=[...document.querySelectorAll('[data-category]')];
filters.forEach(f=>f.addEventListener('click',()=>{filters.forEach(x=>x.classList.toggle('active',x===f));tiles.forEach(t=>t.hidden=f.dataset.filter!=='all'&&t.dataset.category!==f.dataset.filter)}));
function estimate(){const shorts=$('#bookingForm').elements.shorts.checked?guests*50:0;$('#guestCount').textContent=guests;$('#estimate').textContent=(guests*300+shorts).toLocaleString('ru-RU')+' сом'}
$('#guestMinus').addEventListener('click',()=>{guests=Math.max(1,guests-1);estimate()});
$('#guestPlus').addEventListener('click',()=>{guests=Math.min(30,guests+1);estimate()});
$('#bookingForm').elements.shorts.addEventListener('change',estimate);
const date=$('#bookingForm').elements.date, now=new Date();date.min=new Date(now-now.getTimezoneOffset()*60000).toISOString().slice(0,10);estimate();
$('#bookingForm').addEventListener('submit',e=>{e.preventDefault();if(!e.currentTarget.reportValidity())return;const d=new FormData(e.currentTarget),name=String(d.get('name')).trim(),phone=String(d.get('phone')).trim();if(!name||phone.replace(/\D/g,'').length<9)return toast('Проверьте имя и номер телефона');const shorts=d.get('shorts')?guests*50:0,total=guests*300+shorts;localStorage.setItem('parordo_customer_profile_v1',JSON.stringify({name,phone}));$('#profileName').textContent=name;$('#profilePhone').textContent=phone;$('#modalText').textContent=`Гости: ${guests}\nДата: ${d.get('date')}\nВремя: ${d.get('time')}\nСумма: ${total} сом\n\nЭто заявка, не подтверждённая бронь. Администратор должен подтвердить время.`;$('#modal').hidden=false});
$('#modalClose').addEventListener('click',()=>$('#modal').hidden=true);$('#modalOk').addEventListener('click',()=>$('#modal').hidden=true);$('#modal').addEventListener('click',e=>{if(e.target===$('#modal'))$('#modal').hidden=true});
function loadProfile(){try{const p=JSON.parse(localStorage.getItem('parordo_customer_profile_v1')||'null');if(p){$('#profileName').textContent=p.name||'Гость PAR ORDO';$('#profilePhone').textContent=p.phone||'Номер пока не указан'}}catch(_){}}
loadProfile();
$('#editProfile').addEventListener('click',()=>{const name=prompt('Ваше имя:',$('#profileName').textContent==='Гость PAR ORDO'?'':$('#profileName').textContent);if(name===null)return;const phone=prompt('Номер телефона:',$('#profilePhone').textContent==='Номер пока не указан'?'':$('#profilePhone').textContent);if(phone===null)return;localStorage.setItem('parordo_customer_profile_v1',JSON.stringify({name:name.trim(),phone:phone.trim()}));loadProfile();toast('Профиль сохранён')});
if('serviceWorker'in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(e=>console.warn(e)),{once:true});
})();