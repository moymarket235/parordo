/* PAR ORDO — customer frontend v2. Local product data now uses supplied brand images.
   Prices are intentionally empty until administration enters them. */
const LOGO='./assets/par-ordo-logo.png';
const CONFIG={
  instagramUrl:'https://www.instagram.com/',
  whatsappGroupUrl:'https://chat.whatsapp.com/',
  apiUrl:'https://par-ordo-api.moimarketjibekjolu.workers.dev',
  currency:'сом',
  hours:'10:00 — 23:00',
  address:'Бишкек, Торокул Айтматова 677'
};

const DEFAULT_PRODUCTS=[
{id:1,name:'Одноразовые шорты — взрослые',cat:'Шорты',price:null,stock:null,img:'./assets/products/shorts-adult.png',detailImg:'./assets/products/shorts-adult.png'},
{id:2,name:'Одноразовые шорты — детские',cat:'Шорты',price:null,stock:null,img:'./assets/products/shorts-kids.png',detailImg:'./assets/products/shorts-kids.png'},
{id:3,name:'Полотенце',cat:'Полотенца',price:null,stock:null,img:'./assets/products/towel.png',detailImg:'./assets/products/towel.png'},
{id:4,name:'Мыло для бани',cat:'Мыло',price:null,stock:null,img:'./assets/products/soap.png',detailImg:'./assets/products/soap.png'},
{id:5,name:'Трусы мужские',cat:'Трусы',price:null,stock:null,img:'./assets/products/briefs.png',detailImg:'./assets/products/briefs.png'},
{id:6,name:'Носки мужские',cat:'Носки',price:null,stock:null,img:'./assets/products/socks.png',detailImg:'./assets/products/socks.png'},
{id:7,name:'Веник для пара',cat:'Веник',price:null,stock:null,img:'./assets/products/broom.png',detailImg:'./assets/products/broom.png'},
{id:8,name:'Чёрный чай',cat:'Чай',price:null,stock:null,img:'./assets/products/tea-black.png',detailImg:'./assets/products/tea-black.png'},
{id:9,name:'Зелёный чай',cat:'Чай',price:null,stock:null,img:'./assets/products/tea-green.png',detailImg:'./assets/products/tea-green.png'},
{id:10,name:'Чай с лимоном',cat:'Чай',price:null,stock:null,img:'./assets/products/tea-lemon.png',detailImg:'./assets/products/tea-lemon.png'},
{id:11,name:'Минеральная вода — Tien-Shan Legend',cat:'Минеральная вода',price:null,stock:null,img:'./assets/products/water.png',detailImg:'./assets/products/water.png'},
{id:12,name:'Coca-Cola',cat:'Напитки',price:null,stock:null,img:'./assets/products/coca-cola.png',detailImg:'./assets/products/coca-cola.png'},
{id:13,name:'Pepsi',cat:'Напитки',price:null,stock:null,img:'./assets/products/pepsi.png',detailImg:'./assets/products/pepsi.png'},
{id:14,name:'Fanta',cat:'Напитки',price:null,stock:null,img:'./assets/products/fanta.png',detailImg:'./assets/products/fanta.png'},
{id:15,name:'Sprite',cat:'Напитки',price:null,stock:null,img:'./assets/products/sprite.png',detailImg:'./assets/products/sprite.png'},
{id:16,name:'Sprite Mojito',cat:'Напитки',price:null,stock:null,img:'./assets/products/sprite-mojito.png',detailImg:'./assets/products/sprite-mojito.png'},
{id:17,name:'Шоро Аралаш',cat:'Шоро',price:null,stock:null,img:'./assets/products/shoro-aralash.webp',detailImg:'./assets/products/shoro-aralash.webp'},
{id:18,name:'Шоро Чалап',cat:'Шоро',price:null,stock:null,img:'./assets/products/shoro-chalap.webp',detailImg:'./assets/products/shoro-chalap.webp'},
{id:19,name:'Шоро Тан',cat:'Шоро',price:null,stock:null,img:'./assets/products/shoro-tan.webp',detailImg:'./assets/products/shoro-tan.webp'},
{id:20,name:'Шоро Максым',cat:'Шоро',price:null,stock:null,img:'./assets/products/shoro-maksym.webp',detailImg:'./assets/products/shoro-maksym.webp'}

];

const loadProducts=()=>{
  let saved=null;
  try{saved=JSON.parse(localStorage.getItem('po_products_v3')||localStorage.getItem('po_products_v2')||'null')}catch(e){}
  const fresh=structuredClone(DEFAULT_PRODUCTS);
  if(Array.isArray(saved)){
    const byId=new Map(saved.map(p=>[Number(p.id),p]));
    fresh.forEach(p=>{const old=byId.get(Number(p.id));if(old){p.price=old.price??null;p.stock=old.stock??null;}});
  }
  localStorage.setItem('po_products_v3',JSON.stringify(fresh));
  return fresh;
};
let products=loadProducts();

async function syncProductsFromApi(){
  try{
    const res=await fetch(`${CONFIG.apiUrl}/api/products`,{
      headers:{'Accept':'application/json'},
      cache:'no-store'
    });
    if(!res.ok)throw new Error(`API ${res.status}`);
    const data=await res.json();
    if(!Array.isArray(data.products))throw new Error('Invalid products response');
    products=data.products.map(p=>({
      id:Number(p.id),
      name:p.name,
      cat:p.cat,
      price:p.price===null?null:Number(p.price),
      stock:Number(p.stock||0),
      reserved:Number(p.reserved||0),
      available:Number(p.available??(Number(p.stock||0)-Number(p.reserved||0))),
      img:p.img,
      detailImg:p.detailImg||p.img
    }));
    localStorage.setItem('po_products_v3',JSON.stringify(products));
    if(state.view==='catalog')renderCatalog();
  }catch(err){
    console.warn('PAR ORDO API unavailable; using cached products',err);
  }
}
const state={view:'home',cat:'Все',search:'',cart:JSON.parse(localStorage.getItem('po_cart_v3')||localStorage.getItem('po_cart_v2')||'[]'),orders:JSON.parse(localStorage.getItem('po_orders_v3')||localStorage.getItem('po_orders_v2')||'[]'),customer:JSON.parse(localStorage.getItem('po_customer_v3')||localStorage.getItem('po_customer_v2')||'{}')};
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const saveCart=()=>localStorage.setItem('po_cart_v3',JSON.stringify(state.cart));
const saveProducts=()=>localStorage.setItem('po_products_v3',JSON.stringify(products));
const money=n=>(n!==null&&n!==''&&Number.isFinite(Number(n)))?`${Number(n).toLocaleString('ru-RU')} ${CONFIG.currency}`:'Цена: —';
const stockLabel=n=>(n!==null&&n!==''&&Number.isFinite(Number(n)))?`В наличии · ${Number(n)} шт.`:'В наличии · — шт.';
const knownPrice=p=>!!p&&p.price!==null&&p.price!==''&&Number.isFinite(Number(p.price));
function setView(view){state.view=view;$$('.view').forEach(x=>x.classList.toggle('active',x.id===view));$$('.nav-item').forEach(x=>x.classList.toggle('active',x.dataset.view===view));if(view==='catalog')renderCatalog();if(view==='cart')renderCart();if(view==='checkout')renderCheckout();if(view==='orders')renderOrders();if(view==='notifications')renderNotifications();if(view==='profile')renderProfile();window.scrollTo(0,0)}
function cartCount(){return state.cart.reduce((s,x)=>s+x.qty,0)}
function updateBadges(){const n=cartCount();$('#cartBadge').textContent=n;$('#navBadge').textContent=n;$('#cartBadge').style.display=n?'block':'none';$('#navBadge').style.display=n?'block':'none'}
function cats(){return ['Все','Шорты','Полотенца','Мыло','Трусы','Носки','Веник','Чай','Минеральная вода','Напитки','Шоро']}
function renderCats(){const bar=$('#categoryBar');bar.innerHTML=cats().map(c=>`<button class="chip ${state.cat===c?'active':''}" data-cat="${c}">${c}</button>`).join('');$$('[data-cat]').forEach(b=>b.onclick=()=>{state.cat=b.dataset.cat;renderCats();renderCatalog()})}
function visibleProducts(){return products.filter(p=>(state.cat==='Все'||p.cat===state.cat)&&(!state.search||p.name.toLowerCase().includes(state.search.toLowerCase())))}
function renderCatalog(){renderCats();const grid=$('#productGrid');const list=visibleProducts();grid.innerHTML=list.map((p,i)=>`<article class="product-card" data-product="${p.id}"><div class="product-img"><img ${i<2?'fetchpriority="high"':''} loading="${i<2?'eager':'lazy'}" decoding="async" src="${p.img}" alt="${p.name}" onerror="this.onerror=null;this.style.display='none'"></div><div class="body"><h3>${p.name}</h3><div class="price"><small class="price-caption">Цена</small>${knownPrice(p)?money(p.price):'—'}</div><span class="stock">${stockLabel(p.stock)}</span><div class="product-actions"><button class="btn btn-small btn-cart" data-add="${p.id}">🛒 В корзину</button><button class="btn btn-small btn-buy" data-buy="${p.id}">Купить</button></div></div></article>`).join('')||`<div class="muted">Товары не найдены.</div>`;$$('[data-add]').forEach(b=>b.onclick=()=>addCart(+b.dataset.add));$$('[data-buy]').forEach(b=>b.onclick=()=>buyNow(+b.dataset.buy))}
function addCart(id,qty=1){
  const p=products.find(x=>x.id===id);
  if(!p)return;
  const available=Number.isFinite(Number(p.available))
    ?Number(p.available)
    :(Number.isFinite(Number(p.stock))?Number(p.stock):999);
  if(available<=0)return toast('Товар сейчас отсутствует');
  const item=state.cart.find(x=>x.id===id);
  const current=item?item.qty:0;
  const next=Math.min(available,current+qty);
  if(item)item.qty=next;
  else state.cart.push({id,qty:Math.min(available,qty)});
  saveCart();updateBadges();toast(`${p.name} добавлен в корзину`);
}
function buyNow(id){const p=products.find(x=>x.id===id);if(!knownPrice(p))return toast('Цена этого товара ещё не указана');addCart(id);setView('checkout')}
function total(){const vals=state.cart.map(x=>products.find(p=>p.id===x.id));if(vals.some(p=>!p||!knownPrice(p)))return null;return state.cart.reduce((s,x)=>s+Number(products.find(p=>p.id===x.id).price)*x.qty,0)}
function renderProduct(id){const p=products.find(x=>x.id===id);if(!p)return;const detailSrc=p.detailImg||p.img;$('#product').innerHTML=`<div class="detail-card"><div class="detail-img"><img fetchpriority="high" decoding="async" src="${detailSrc}" alt="${p.name}" onerror="this.onerror=null;this.src='${p.img}'"></div><div class="detail-body"><span class="eyebrow">${p.cat}</span><h2>${p.name}</h2><div class="price"><small class="price-caption">Цена</small>${knownPrice(p)?money(p.price):'—'}</div><div class="detail-row"><span class="stock">${stockLabel(p.stock)}</span><div class="qty"><button id="dqMinus">−</button><b id="dq">1</b><button id="dqPlus">+</button></div></div><div class="product-actions"><button class="btn btn-cart" id="detailCart">В корзину</button><button class="btn btn-buy" id="detailBuy">Купить сейчас</button></div><div class="product-checks">✅ Подходит для бани и отдыха<br>✅ Удобно и быстро<br>✅ Качество и чистота</div><button class="btn back-btn" data-view="catalog">← Назад в каталог</button></div></div>`;let q=1;$('#dqMinus').onclick=()=>{q=Math.max(1,q-1);$('#dq').textContent=q};$('#dqPlus').onclick=()=>{const max=Number.isFinite(Number(p.available))?Number(p.available):(Number.isFinite(Number(p.stock))?Number(p.stock):999);q=Math.min(max,q+1);$('#dq').textContent=q};$('#detailCart').onclick=()=>addCart(id,q);$('#detailBuy').onclick=()=>{if(!knownPrice(p))return toast('Цена этого товара ещё не указана');addCart(id,q);setView('checkout')};bindViewButtons()}
function renderCart(){const el=$('#cart');if(!state.cart.length){el.innerHTML=`<div class="cart-card empty-card"><div class="empty-icon">🛒</div><h2>Корзина пуста</h2><p class="muted">Добавьте товары для заказа.</p><button class="btn btn-gold" data-view="catalog">Перейти в каталог</button></div>`;bindViewButtons();return}const rows=state.cart.map(x=>{const p=products.find(y=>y.id===x.id);return `<div class="cart-row"><img src="${p.img}" alt="${p.name}"><div><h3>${p.name}</h3><small>${knownPrice(p)?money(p.price):'Цена: —'} · ${x.qty} шт.</small><div class="qty"><button data-dec="${p.id}">−</button><b>${x.qty}</b><button data-inc="${p.id}">+</button></div></div><strong>${knownPrice(p)?money(p.price*x.qty):'—'}</strong></div>`}).join('');const t=total();el.innerHTML=`<div class="cart-card"><div class="cart-head"><span class="eyebrow">ПАР ОРДО</span><h2>Корзина (${cartCount()})</h2></div>${rows}<div class="total-row"><span>Итого</span><b>${t===null?'Цена не указана':money(t)}</b></div><div class="cart-note">${t===null?'Для оформления заказа сначала укажите цены товаров в админ-панели.':''}</div><div class="cart-actions"><button class="btn btn-gold ${t===null?'disabled-btn':''}" id="goCheckout">Оформить заказ →</button><button class="btn back-btn" data-view="catalog">Продолжить покупки</button></div></div>`;$$('[data-dec]').forEach(b=>b.onclick=()=>changeQty(+b.dataset.dec,-1));$$('[data-inc]').forEach(b=>b.onclick=()=>changeQty(+b.dataset.inc,1));$('#goCheckout').onclick=()=>{if(t===null)return toast('У некоторых товаров пока нет цены');setView('checkout')};bindViewButtons()}
function changeQty(id,d){
  const item=state.cart.find(x=>x.id===id);
  const p=products.find(x=>x.id===id);
  if(!item||!p)return;
  const available=Number.isFinite(Number(p.available))
    ?Number(p.available)
    :(Number.isFinite(Number(p.stock))?Number(p.stock):999);
  item.qty+=d;
  if(item.qty<=0)state.cart=state.cart.filter(x=>x.id!==id);
  else item.qty=Math.min(available,item.qty);
  saveCart();updateBadges();renderCart();
}
function renderCheckout(){const el=$('#checkout');if(!state.cart.length){setView('cart');return}const t=total();if(t===null){el.innerHTML=`<div class="checkout-card" style="padding:18px"><h2>Оформление заказа</h2><div class="status">Некоторым товарам ещё не назначена цена.</div><button class="btn btn-gold" data-view="catalog" style="margin-top:12px">Вернуться в каталог</button></div>`;bindViewButtons();return}el.innerHTML=`<div class="checkout-card" style="padding:16px"><span class="eyebrow">ШАГ 1 / 2</span><h2>Оформление заказа</h2><div class="checkout-fields"><input id="name" placeholder="Ваше имя" value="${state.customer.name||''}"><input id="phone" placeholder="Номер телефона" value="${state.customer.phone||''}"><div class="status">📍 Получение товара: <b>в ПАР ОРДО</b><br><span class="muted">Доставка отсутствует.</span></div><div class="total-row"><span>К оплате</span><b>${money(t)}</b></div><div class="payment-grid"><button class="pay-btn" id="qrPay">▣<br>QR ОПЛАТА<br><small>Быстро и удобно</small></button><button class="pay-btn cash" id="cashPay">▤<br>НАЛИЧНЫМИ<br><small>Оплата администратору</small></button></div></div></div>`;$('#qrPay').onclick=()=>createOrder('QR');$('#cashPay').onclick=()=>createOrder('Наличные')}
async function createOrder(method){
  const name=$('#name').value.trim();
  const phone=$('#phone').value.trim();
  if(!name||!phone)return toast('Укажите имя и телефон');

  const items=state.cart.map(x=>({id:x.id,qty:x.qty}));
  if(!items.length)return toast('Корзина пуста');

  state.customer={name,phone};
  localStorage.setItem('po_customer_v3',JSON.stringify(state.customer));

  try{
    const res=await fetch(`${CONFIG.apiUrl}/api/orders`,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Accept':'application/json'
      },
      body:JSON.stringify({name,phone,method,items})
    });

    const data=await res.json();
    if(!res.ok||!data.order)throw new Error(data.error||`API ${res.status}`);

    if(method==='QR')openQr(data.order);
    else openCash(data.order);

    await syncProductsFromApi();
  }catch(err){
    console.error('PAR ORDO order error',err);
    toast(err.message||'Не удалось оформить заказ');
  }
}

function openQr(order){
  $('#modalCard').innerHTML=`<div class="modal-head"><h2>Оплата через QR</h2><button class="icon-btn" id="closeModal">×</button></div><p>Заказ №${order.id} · К оплате <b>${money(order.total)}</b></p><div class="qr-box"><canvas id="qrCanvas" width="320" height="320"></canvas><b>Сумма: ${money(order.total)}</b></div><div class="status" style="margin-top:10px">QR пока демонстрационный. Реальный платёжный QR подключим после выбора провайдера.</div><button class="btn btn-gold" style="margin-top:10px" id="qrPending">Ожидать подтверждение оплаты</button>`;
  openModal();
  fakeQr(`PARORDO|ORDER:${order.id}|SUM:${order.total}`);
  $('#qrPending').onclick=()=>{
    state.orders.unshift({
      id:order.id,
      total:order.total,
      method:'QR',
      status:'Ожидает оплаты',
      createdAt:new Date().toISOString(),
      items:order.items||[]
    });
    localStorage.setItem('po_orders_v3',JSON.stringify(state.orders));
    state.cart=[];saveCart();updateBadges();closeModal();
    renderSuccess({
      id:order.id,
      total:order.total,
      method:'QR',
      status:'Ожидает оплаты'
    });
  };
}

function openCash(order){
  $('#modalCard').innerHTML=`<div class="modal-head"><h2>Оплата наличными</h2><button class="icon-btn" id="closeModal">×</button></div><div class="success"><div style="font-size:58px">💵</div><h3>К оплате: ${money(order.total)}</h3><p class="muted">Покажите эту сумму администратору и оплатите наличными.</p><button class="btn btn-gold" id="cashPaid">Я оплатил наличными</button><div class="status">Статус подтверждает только администратор после проверки.</div></div>`;
  openModal();
  $('#cashPaid').onclick=()=>{
    state.orders.unshift({
      id:order.id,
      total:order.total,
      method:'Наличные',
      status:'Ожидает оплаты',
      createdAt:new Date().toISOString(),
      items:order.items||[]
    });
    localStorage.setItem('po_orders_v3',JSON.stringify(state.orders));
    state.cart=[];saveCart();updateBadges();closeModal();
    renderSuccess({
      id:order.id,
      total:order.total,
      method:'Наличные',
      status:'Ожидает оплаты'
    });
  };
}


function orderStatusLabel(status){
  if(status==='paid'||status==='Оплачено'){
    return {text:'Оплачено',cls:'ok'};
  }
  if(status==='cancelled'||status==='Отменён'){
    return {text:'Отменён',cls:'no'};
  }
  if(status==='expired'||status==='Истёк'){
    return {text:'Истёк',cls:'no'};
  }
  return {text:'Ожидает оплаты',cls:'wait'};
}

async function syncOrderStatuses(){
  const phone=(state.customer.phone||'').trim();

  if(!phone || !Array.isArray(state.orders) || !state.orders.length){
    return;
  }

  let changed=false;

  await Promise.all(
    state.orders.map(async o=>{
      try{
        const res=await fetch(
          `${CONFIG.apiUrl}/api/orders/${encodeURIComponent(o.id)}?phone=${encodeURIComponent(phone)}`,
          {
            headers:{'Accept':'application/json'},
            cache:'no-store'
          }
        );

        if(!res.ok)return;

        const data=await res.json();
        const server=data.order||data;

        if(!server)return;

        if(server.status && server.status!==o.status){
          o.status=server.status;
          changed=true;
        }

        if(
          server.total!=null &&
          Number(server.total)!==Number(o.total)
        ){
          o.total=Number(server.total);
          changed=true;
        }

        if(
          server.created_at &&
          server.created_at!==o.createdAt
        ){
          o.createdAt=server.created_at;
          changed=true;
        }

        if(Array.isArray(server.items)){
          o.items=server.items;
          changed=true;
        }

      }catch(e){
        console.warn('Order status sync error',e);
      }
    })
  );

  if(changed){
    localStorage.setItem(
      'po_orders_v3',
      JSON.stringify(state.orders)
    );
  }
}

async function renderOrders(){
  const el=$('#orders');

  await syncOrderStatuses();

  const arr=state.orders;

  const rows=arr.map(o=>{
    const s=orderStatusLabel(o.status);

    const items=Array.isArray(o.items) && o.items.length
      ? `
        <div class="order-items-mini">
          ${o.items.map(i=>`
            <div>
              ${i.name||'Товар'} · ${i.qty||1} шт.
            </div>
          `).join('')}
        </div>
      `
      : '';

    return `
      <div class="order-item">
        <div>
          <b>№${o.id}</b>

          <div class="muted order-time">
            ${new Date(o.createdAt).toLocaleString('ru-RU')}
            · ${o.method}
          </div>

          ${items}
        </div>

        <div style="text-align:right">
          <b>${money(o.total)}</b>

          <div>
            <span class="badge ${s.cls}">
              ${s.text}
            </span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  el.innerHTML=`
    <div class="list-card">

      <div class="cart-head">
        <span class="eyebrow">ПАР ОРДО</span>
        <h2>Мои заказы</h2>
        <p class="muted">
          Статус обновляется автоматически.
        </p>
      </div>

      ${
        rows ||
        '<div class="empty-line">Пока заказов нет.</div>'
      }

    </div>
  `;
}
function renderNotifications(){const items=[['Добрый день!','Сегодня свежий веник для пара 🌿'],['Акция!','Специальное предложение 🔥'],['Новое поступление','Товары снова в наличии'],['Вечерний отдых','Ждём вас в ПАР ОРДО — 10:00–23:00']];$('#notifications').innerHTML=`<div class="list-card"><div class="cart-head"><span class="eyebrow">PUSH</span><h2>Уведомления</h2><p class="muted">Только после согласия пользователя.</p></div>${items.map(x=>`<div class="notification"><img src="./assets/par-ordo-logo.png"><div><b>${x[0]}</b><p>${x[1]}</p></div></div>`).join('')}<div style="padding:16px"><button class="btn btn-gold" id="enablePush">🔔 Разрешить уведомления</button></div></div>`;$('#enablePush').onclick=subscribePush}
function renderProfile(){const c=state.customer;$('#profile').innerHTML=`<div class="profile-card"><img src="./assets/par-ordo-logo.png"><h2>${c.name||'Гость'}</h2><p class="muted">${c.phone||'Добавьте номер при первом заказе'}</p><div class="profile-menu"><button data-view="orders">▤ Мои заказы</button><button data-view="notifications">🔔 Уведомления</button><button id="socialIg">◎ Instagram</button><button id="socialWa">◉ WhatsApp группа</button><button id="showInfo">ℹ О бане</button></div></div>`;bindViewButtons();$('#socialIg').onclick=()=>window.open(CONFIG.instagramUrl,'_blank','noopener');$('#socialWa').onclick=()=>window.open(CONFIG.whatsappGroupUrl,'_blank','noopener');$('#showInfo').onclick=()=>toast(`${CONFIG.hours} · ${CONFIG.address}`)}
function bindViewButtons(){$$('[data-view]').forEach(b=>b.onclick=e=>{e.preventDefault();setView(b.dataset.view);$('#drawer').classList.remove('open')})}
function openModal(){$('#modal').classList.add('open');$('#closeModal').onclick=closeModal}
function closeModal(){$('#modal').classList.remove('open')}
function fakeQr(text){const c=$('#qrCanvas');const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,320,320);ctx.fillStyle='#111';let seed=[...text].reduce((a,ch)=>((a*31+ch.charCodeAt(0))>>>0),1);for(let y=0;y<29;y++)for(let x=0;x<29;x++){seed=(seed*1664525+1013904223)>>>0;if(seed%3===0)ctx.fillRect(20+x*10,20+y*10,10,10)}[['0','0'],['22','0'],['0','22']].forEach(([xx,yy])=>{ctx.fillStyle='#fff';ctx.fillRect(20+xx*10,20+yy*10,70,70);ctx.fillStyle='#111';ctx.fillRect(30+xx*10,30+yy*10,50,50);ctx.fillStyle='#fff';ctx.fillRect(40+xx*10,40+yy*10,30,30)})}
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),2200)}
async function subscribePush(){if(!('Notification'in window))return toast('Браузер не поддерживает уведомления');const p=await Notification.requestPermission();toast(p==='granted'?'Уведомления разрешены ✅':'Уведомления отключены')}
$('#menuBtn').onclick=()=>$('#drawer').classList.add('open');$('#drawerClose').onclick=()=>$('#drawer').classList.remove('open');$('#searchBtn').onclick=()=>{$('#searchRow').classList.toggle('hidden');if(!$('#searchRow').classList.contains('hidden'))$('#searchInput').focus()};$('#searchClose').onclick=()=>{$('#searchRow').classList.add('hidden');state.search='';renderCatalog()};$('#searchInput').oninput=e=>{state.search=e.target.value;renderCatalog()};document.addEventListener('click',e=>{const v=e.target.closest('[data-view]');if(v){e.preventDefault();if(v.closest('#product'))return;setView(v.dataset.view)}});document.addEventListener('click',e=>{const p=e.target.closest('.product-card');if(p&&!e.target.closest('button')){const id=Number(p.dataset.product);if(id){setView('product');renderProduct(id)}}});$$('[data-external]').forEach(a=>a.onclick=e=>{e.preventDefault();window.open(a.dataset.external==='instagram'?CONFIG.instagramUrl:CONFIG.whatsappGroupUrl,'_blank','noopener')});updateBadges();setView('home');syncProductsFromApi();
