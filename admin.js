const API='https://par-ordo-api.moimarketjibekjolu.workers.dev';
const TOKEN_KEY='parordo_admin_token';
const USER_KEY='parordo_admin_user';
const CURRENCY='сом';
let bookingPollTimer=null;

const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const money=n=>`${Number(n||0).toLocaleString('ru-RU')} ${CURRENCY}`;

function token(){return sessionStorage.getItem(TOKEN_KEY)||''}
function setToken(v){sessionStorage.setItem(TOKEN_KEY,v)}
function clearToken(){sessionStorage.removeItem(TOKEN_KEY);sessionStorage.removeItem(USER_KEY)}
function apiHeaders(json=false){
  const h={Accept:'application/json'};
  if(json)h['Content-Type']='application/json';
  if(token())h.Authorization=`Bearer ${token()}`;
  return h;
}
async function api(path,options={}){
  const res=await fetch(API+path,{...options,headers:{...apiHeaders(Boolean(options.body)),...(options.headers||{})}});
  let data=null;
  try{data=await res.json()}catch{}
  if(!res.ok){
    if(res.status===401){clearToken();showLogin();throw new Error('Сессия истекла. Войдите снова.')}
    throw new Error(data?.error||`Ошибка API ${res.status}`);
  }
  return data;
}
function toast(msg){
  const t=document.createElement('div');t.className='toast';t.textContent=msg;
  document.body.appendChild(t);setTimeout(()=>t.remove(),1800);
}
function showLogin(){
  stopBookingPolling();
  $('#loginView').classList.remove('hidden');
  $('#dashView').classList.add('hidden');
  $('#loginPass').value='';
}
function showDash(){
  $('#loginView').classList.add('hidden');
  $('#dashView').classList.remove('hidden');
}
async function login(){
  const username=$('#loginUser').value.trim().toLowerCase();
  const password=$('#loginPass').value;
  if(!username||!password){$('#loginStatus').textContent='Введите логин и пароль.';return}
  $('#loginStatus').textContent='';
  $('#loginBtn').disabled=true;
  try{
    const data=await api('/api/admin/login',{
      method:'POST',
      body:JSON.stringify({username,password})
    });
    setToken(data.token);
    sessionStorage.setItem(USER_KEY,username);
    showDash();
    $('#whoami').textContent=`Выполнен вход: ${username} · полный доступ`;
    await refreshAll();
    startBookingPolling();
  }catch(e){
    $('#loginStatus').textContent=e.message;
  }finally{$('#loginBtn').disabled=false}
}
function renderStats(s){
  $('#kpi').innerHTML=`
    <div class="kpi"><span>🛒</span><b>Оплачено заказов</b><strong>${s.orders}</strong></div>
    <div class="kpi"><span>💰</span><b>Выручка</b><strong>${money(s.revenue)}</strong></div>
    <div class="kpi"><span>📥</span><b>Поступило</b><strong>${s.incoming} шт.</strong></div>
    <div class="kpi"><span>📦</span><b>Продано</b><strong>${s.sold} шт.</strong></div>`;
}
function statusBadge(status){
  if(status==='paid')return '<span class="badge ok">Оплачено</span>';
  if(status==='cancelled')return '<span class="badge no">Отменён</span>';
  if(status==='expired')return '<span class="badge no">Истёк</span>';
  return '<span class="badge wait">Ожидает оплаты</span>';
}
function escapeHtml(value){
  return String(value??'').replace(/[&<>"']/g,ch=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
}
function bookingDate(value){
  const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  return m?`${m[3]}.${m[2]}.${m[1]} · ${m[4]}:${m[5]}`:escapeHtml(value||'');
}
function bookingStatusBadge(status){
  if(status==='pending')return '<span class="badge wait">Новая заявка</span>';
  if(status==='booked')return '<span class="badge ok">Подтверждена</span>';
  if(status==='cancelled')return '<span class="badge no">Отменена</span>';
  if(status==='completed')return '<span class="badge ok">Выполнена</span>';
  return '<span class="badge wait">Неизвестный статус</span>';
}
async function renderBookings(){
  const data=await api('/api/admin/control/bookings');
  const rows=Array.isArray(data.bookings)?data.bookings:[];
  const pending=rows.filter(b=>b.status==='pending').length;
  const count=$('#bookingCount');
  if(count){
    count.textContent=`${pending} новых`;
    count.className=`badge ${pending?'wait':'ok'}`;
  }
  $('#bookings').innerHTML=rows.length?rows.map(b=>{
    const id=encodeURIComponent(String(b.id||''));
    const name=escapeHtml(b.name||'Клиент');
    const phone=escapeHtml(b.phone||'');
    const note=escapeHtml(b.note||'');
    const createdBy=b.createdBy?`<div class="muted">Источник: ${escapeHtml(b.createdBy)}</div>`:'';
    let actions='';
    if(b.status==='pending'){
      actions=`<div class="booking-actions"><button class="confirm" data-booking-confirm="${id}">✓ Подтвердить</button><button class="cancel" data-booking-cancel="${id}">Отклонить</button></div>`;
    }else if(b.status==='booked'){
      actions=`<div class="booking-actions"><button class="complete" data-booking-complete="${id}">✓ Выполнено</button><button class="cancel" data-booking-cancel="${id}">Отменить</button></div>`;
    }
    return `<article class="booking">
      <div class="booking-top"><div><b>${name}</b><div class="muted">${phone}</div></div><div>${bookingStatusBadge(b.status)}</div></div>
      <div class="booking-time">🗓 ${bookingDate(b.appointmentAt)}</div>
      ${note?`<div class="booking-note">${note}</div>`:''}
      ${createdBy}${actions}
    </article>`;
  }).join(''):'<div class="message">Ближайших броней пока нет.</div>';
  $$('[data-booking-confirm]').forEach(b=>b.onclick=()=>changeBookingStatus(decodeURIComponent(b.dataset.bookingConfirm),'booked'));
  $$('[data-booking-cancel]').forEach(b=>b.onclick=()=>changeBookingStatus(decodeURIComponent(b.dataset.bookingCancel),'cancelled'));
  $$('[data-booking-complete]').forEach(b=>b.onclick=()=>changeBookingStatus(decodeURIComponent(b.dataset.bookingComplete),'completed'));
}
async function changeBookingStatus(id,status){
  try{
    await api(`/api/admin/control/bookings/${encodeURIComponent(id)}/status`,{
      method:'POST',
      body:JSON.stringify({status})
    });
    const messages={booked:'Бронирование подтверждено ✅',cancelled:'Бронирование отменено',completed:'Посещение отмечено выполненным ✅'};
    toast(messages[status]||'Статус обновлён');
    await renderBookings();
  }catch(e){toast(e.message)}
}
function startBookingPolling(){
  stopBookingPolling();
  bookingPollTimer=setInterval(()=>{
    if(token()&&!$('#dashView').classList.contains('hidden')){
      renderBookings().catch(()=>{});
    }
  },20000);
}
function stopBookingPolling(){
  if(bookingPollTimer){clearInterval(bookingPollTimer);bookingPollTimer=null;}
}
async function renderOrders(){
  const data=await api('/api/admin/orders');
  const rows=data.orders||[];
  $('#orders').innerHTML=rows.length?rows.map(o=>{
    const lines=(o.items||[]).map(i=>`<div class="order-item-line">${i.name||'Товар'} · ${i.qty||1} шт. × ${money(i.unit_price||i.price||0)}</div>`).join('');
    const time=o.created_at?new Date(o.created_at).toLocaleString('ru-RU'):'';
    const actions=o.status==='pending_payment'
      ?`<div class="order-actions"><button class="pay" data-order-pay="${encodeURIComponent(o.id)}">✓ Подтвердить оплату</button><button class="cancel" data-order-cancel="${encodeURIComponent(o.id)}">Отменить</button></div>`:'';
    return `<div class="order">
      <div class="order-top"><div><b>Заказ №${o.id}</b><div class="muted">${time} · ${o.method} · ${o.customer_name||''}</div><div class="muted">${o.phone||''}</div></div>
      <div style="text-align:right"><b>${money(o.total)}</b><div>${statusBadge(o.status)}</div></div></div>
      <div class="order-items">${lines||'<div class="muted">Состав заказа скрыт API-списком</div>'}</div>${actions}</div>`;
  }).join(''):'<div class="message">Заказов пока нет.</div>';
  $$('[data-order-pay]').forEach(b=>b.onclick=()=>changeOrder(decodeURIComponent(b.dataset.orderPay),'paid'));
  $$('[data-order-cancel]').forEach(b=>b.onclick=()=>changeOrder(decodeURIComponent(b.dataset.orderCancel),'cancelled'));
}
async function changeOrder(id,status){
  try{
    await api(`/api/admin/orders/${encodeURIComponent(id)}/status`,{
      method:'PATCH',
      body:JSON.stringify({status})
    });
    toast(status==='paid'?'Оплата подтверждена ✅':'Заказ отменён');
    await refreshAll();
  }catch(e){toast(e.message)}
}
async function renderProducts(){
  const data=await api('/api/products');
  const rows=data.products||[];
  $('#products').innerHTML=rows.map(p=>{
    const price=p.price==null?'':p.price;
    const stock=Number(p.stock||0);
    const available=Number(p.available??stock);
    return `<div class="product">
      <div class="product-head"><div><b>${p.name}</b><small>${p.cat}</small></div><span class="badge ${available>0?'ok':'wait'}">${available} доступно</span></div>
      <div class="product-fields">
        <label>Цена (сом)<input inputmode="numeric" data-price="${p.id}" value="${price}" placeholder="Цена"></label>
        <label>Остаток<input inputmode="numeric" data-stock="${p.id}" value="${stock}" placeholder="0"></label>
        <label>Поступление +<input inputmode="numeric" data-add="${p.id}" placeholder="+ шт."></label>
      </div>
      <div class="product-buttons">
        <button class="btn btn-gold" data-save="${p.id}">Сохранить изменения</button>
        <button class="btn back-btn" data-add-btn="${p.id}">+ Поступление</button>
      </div>
    </div>`;
  }).join('');
  $$('[data-save]').forEach(b=>b.onclick=()=>saveProduct(Number(b.dataset.save)));
  $$('[data-add-btn]').forEach(b=>b.onclick=()=>addStock(Number(b.dataset.addBtn)));
}
async function saveProduct(id){
  const priceEl=document.querySelector(`[data-price="${id}"]`);
  const stockEl=document.querySelector(`[data-stock="${id}"]`);
  const price=priceEl.value.trim();
  const stock=stockEl.value.trim();
  try{
    await api(`/api/admin/products/${id}`,{
      method:'PATCH',
      body:JSON.stringify({
        price:price===''?null:Number(price),
        stock:stock===''?0:Number(stock)
      })
    });
    toast('Товар сохранён ✅');
    await refreshAll();
  }catch(e){toast(e.message)}
}
async function addStock(id){
  const el=document.querySelector(`[data-add="${id}"]`);
  const qty=Number(el.value.trim());
  if(!Number.isInteger(qty)||qty<=0){toast('Введите поступление больше 0');return}
  try{
    await api(`/api/admin/products/${id}/stock`,{
      method:'POST',
      body:JSON.stringify({qty})
    });
    toast(`Поступление +${qty} ✅`);
    await refreshAll();
  }catch(e){toast(e.message)}
}
async function renderStatsRange(range){
  const s=await api(`/api/admin/stats?range=${range}`);
  renderStats(s);
  $$('#rangeTabs button').forEach(b=>b.classList.toggle('active',b.dataset.range===range));
}
async function refreshAll(){
  const username=sessionStorage.getItem(USER_KEY)||'admin';
  $('#whoami').textContent=`Выполнен вход: ${username} · полный доступ`;
  const active=document.querySelector('#rangeTabs button.active')?.dataset.range||'today';
  await Promise.all([renderStatsRange(active),renderOrders(),renderBookings(),renderProducts()]);
}
function logout(){
  stopBookingPolling();
  const t=token();
  if(t)fetch(API+'/api/admin/logout',{method:'POST',headers:apiHeaders()}).catch(()=>{});
  clearToken();showLogin();
}
async function boot(){
  if(!token()){showLogin();return}
  try{
    await api('/api/admin/me');
    showDash();
    await refreshAll();
    startBookingPolling();
  }catch(e){showLogin()}
}

$('#loginBtn').onclick=login;
$('#loginPass').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
$('#loginUser').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
$('#logoutBtn').onclick=logout;
$('#reloadBtn').onclick=()=>refreshAll().catch(e=>toast(e.message));
$$('#rangeTabs button').forEach(b=>b.onclick=()=>renderStatsRange(b.dataset.range).catch(e=>toast(e.message)));
boot();
