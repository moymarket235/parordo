/* PAR ORDO — local demo admin v2. Prices are intentionally blank until entered. */
const CURRENCY='сом';
const DEFAULT=()=>[
{id:1,name:'Одноразовые шорты — взрослые',cat:'Шорты',price:null,stock:null},
{id:2,name:'Одноразовые шорты — детские',cat:'Шорты',price:null,stock:null},
{id:3,name:'Полотенце',cat:'Полотенца',price:null,stock:null},
{id:4,name:'Мыло для бани',cat:'Мыло',price:null,stock:null},
{id:5,name:'Трусы мужские',cat:'Трусы',price:null,stock:null},
{id:6,name:'Носки мужские',cat:'Носки',price:null,stock:null},
{id:7,name:'Веник для пара',cat:'Веник',price:null,stock:null},
{id:8,name:'Чёрный чай',cat:'Чай',price:null,stock:null},{id:9,name:'Зелёный чай',cat:'Чай',price:null,stock:null},{id:10,name:'Чай с лимоном',cat:'Чай',price:null,stock:null},
{id:11,name:'Минеральная вода — Tien-Shan Legend',cat:'Минеральная вода',price:null,stock:null},
{id:12,name:'Coca-Cola',cat:'Напитки',price:null,stock:null},{id:13,name:'Pepsi',cat:'Напитки',price:null,stock:null},{id:14,name:'Fanta',cat:'Напитки',price:null,stock:null},{id:15,name:'Sprite',cat:'Напитки',price:null,stock:null},{id:16,name:'Sprite Mojito',cat:'Напитки',price:null,stock:null}
,
{id:17,name:'Шоро Аралаш',cat:'Шоро',price:null,stock:null},{id:18,name:'Шоро Чалап',cat:'Шоро',price:null,stock:null},{id:19,name:'Шоро Тан',cat:'Шоро',price:null,stock:null},{id:20,name:'Шоро Максым',cat:'Шоро',price:null,stock:null}
];
let products=JSON.parse(localStorage.getItem('po_products_v3')||localStorage.getItem('po_products_v2')||'null');
const defaults=DEFAULT();
if(!Array.isArray(products)||!products.length){
  products=defaults;
}else{
  const byId=new Map(products.map(p=>[Number(p.id),p]));
  defaults.forEach(d=>{
    const old=byId.get(Number(d.id));
    if(!old) products.push(d);
  });
}
localStorage.setItem('po_products_v3',JSON.stringify(products));
let orders=JSON.parse(localStorage.getItem('po_orders_v3')||localStorage.getItem('po_orders_v2')||'[]');
const money=n=>Number.isFinite(Number(n))?`${Number(n).toLocaleString('ru-RU')} ${CURRENCY}`:'Цена: —';
const $=s=>document.querySelector(s);
function render(){
 const paid=orders.filter(o=>o.status==='Оплачено');
 const revenue=paid.reduce((s,o)=>s+Number(o.total||0),0);
 const totalStock=products.reduce((s,p)=>s+(p.stock!==null&&p.stock!==''&&Number.isFinite(Number(p.stock))?Number(p.stock):0),0);
 $('#kpi').innerHTML=`<article><span>🛒</span><b>Оплачено заказов</b><small>${paid.length}</small></article><article><span>💰</span><b>Выручка</b><small>${money(revenue)}</small></article><article><span>📦</span><b>Остаток</b><small>${totalStock} шт.</small></article><article><span>💳</span><b>Способы</b><small>QR / Наличные</small></article>`;
 $('#orders').innerHTML=orders.length?orders.slice(0,10).map(o=>`<div class="order-item"><div><b>№${o.id}</b><div class="muted">${o.method} · ${new Date(o.createdAt).toLocaleString('ru-RU')}</div></div><div style="text-align:right"><b>${money(o.total)}</b><div><span class="badge ${o.status==='Оплачено'?'ok':'wait'}">${o.status}</span></div></div></div>`).join(''):'<p class="muted">Заказов пока нет.</p>';
 $('#products').innerHTML=products.map((p,i)=>`<div class="admin-product"><div class="admin-product-title"><div><b>${p.name}</b><small>${p.cat}</small></div><span class="badge ${p.stock!==null&&p.stock!==''&&Number.isFinite(Number(p.stock))?'ok':'wait'}">${p.stock!==null&&p.stock!==''&&Number.isFinite(Number(p.stock))?p.stock+' шт.':'Количество —'}</span></div><div class="admin-fields"><label>Цена (сом)<input inputmode="decimal" data-price="${p.id}" value="${p.price!==null&&p.price!==''&&Number.isFinite(Number(p.price))?p.price:''}" placeholder="Введите цену"></label><label>Количество<input inputmode="numeric" data-stock="${p.id}" value="${p.stock!==null&&p.stock!==''&&Number.isFinite(Number(p.stock))?p.stock:''}" placeholder="Введите количество"></label><label>Поступление +<input inputmode="numeric" data-addstock="${p.id}" placeholder="+ шт."></label></div><button class="btn btn-gold save-product" data-save="${p.id}">Сохранить</button></div>`).join('');
 $('#products').querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>saveProduct(Number(b.dataset.save)));
 $('#products').querySelectorAll('[data-addstock]').forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter')saveProduct(Number(i.dataset.addstock))}));
}
function saveProduct(id){const p=products.find(x=>x.id===id);if(!p)return;const priceEl=document.querySelector(`[data-price="${id}"]`),stockEl=document.querySelector(`[data-stock="${id}"]`),addEl=document.querySelector(`[data-addstock="${id}"]`);const price=priceEl.value.trim();const stock=stockEl.value.trim();const add=addEl.value.trim();p.price=price===''?null:Math.max(0,Number(price));p.stock=stock===''?null:Math.max(0,Math.floor(Number(stock)));if(add!==''){const inc=Math.max(0,Math.floor(Number(add)));p.stock=(p.stock!==null&&p.stock!==''&&Number.isFinite(Number(p.stock))?Number(p.stock):0)+inc}localStorage.setItem('po_products_v3',JSON.stringify(products));render();toast(`${p.name} сохранён ✅`)}
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.appendChild(t);setTimeout(()=>t.remove(),1800)}
render();
