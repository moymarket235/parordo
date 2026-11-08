/*
 * PAR ORDO SMART INVENTORY PRO V3
 * Category-first inventory UI for the existing PAR ORDO catalogue/API.
 * - Keeps product IDs and existing client receipt history intact.
 * - Sales totals count only paid cash/transfer client receipt lines.
 * - Product variants (clothing size / shorts type) are stored in the existing name field.
 * - Initial stock is recorded through the existing stock-receipt endpoint.
 * - Does not modify client, shift, bracelet, payment, Worker auth, or D1 schema logic.
 */
(() => {
  'use strict';

  if (window.PARORDOSmartInventory?.version === '3.0.0') return;

  const VERSION = '3.0.0';
  const CATEGORIES = [
    'Напитки', 'Чай', 'Шорты', 'Одежда', 'Снеки',
    'Полотенца', 'Аксессуары', 'Гигиена', 'Для бани', 'Прочее'
  ];
  const CATEGORY_META = {
    'Напитки': { icon: '🥤', description: 'Вода, соки, лимонады и напитки' },
    'Чай': { icon: '🍵', description: 'Көк чай, кара чай, лимон чай' },
    'Шорты': { icon: '🩳', description: 'Взрослые и детские' },
    'Одежда': { icon: '👕', description: 'Трусы, носки и размеры' },
    'Снеки': { icon: '🥨', description: 'Чипсы, сладости и закуски' },
    'Полотенца': { icon: '🧺', description: 'Полотенца и простыни' },
    'Аксессуары': { icon: '🧴', description: 'Банные принадлежности' },
    'Гигиена': { icon: '🧼', description: 'Средства личной гигиены' },
    'Для бани': { icon: '♨️', description: 'Остальные товары для бани' },
    'Прочее': { icon: '📦', description: 'Товары без отдельной категории' }
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  let selectedCategory = '';
  let searchQuery = '';
  let filterMode = 'all';
  let sortMode = 'manual';
  let renderQueued = false;

  function safeMoney(value) {
    try { return money(Number(value || 0)); }
    catch (_) { return `${Number(value || 0).toLocaleString('ru-RU')} сом`; }
  }

  function esc(value) {
    try { return escapeHtml(value); }
    catch (_) {
      return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      }[c]));
    }
  }

  function role() {
    try { return currentRole(); } catch (_) { return 'admin'; }
  }

  function catalog() {
    return Array.isArray(db?.products) ? db.products : [];
  }

  function clientRows() {
    return Array.isArray(db?.clients) ? db.clients : [];
  }

  function storedCategory(product) {
    return String(product?.cat || product?.category || '').trim();
  }

  // This only proposes a category for older catalogue rows; it never writes automatically.
  function suggestedCategory(product) {
    const name = String(product?.name || '').toLocaleLowerCase('ru-RU');
    const stored = storedCategory(product);
    if (/шорт|shorts?/.test(name)) return 'Шорты';
    if (/coca[- ]?cola|pepsi|fanta|sprite|7up|mirinda|cola|кола|пепси|фанта|спрайт|вода|минерал|энергет|лимонад|сок|морс|шоро|максым|тан(?!ц)|айран|drink/.test(name)) return 'Напитки';
    if (/чай|tea/.test(name)) return 'Чай';
    if (/полотенц|простын|полотен/.test(name)) return 'Полотенца';
    if (/снек|чипс|сухар|ореш|шоколад|конфет|батончик|попкорн/.test(name)) return 'Снеки';
    if (/трус|носк|футбол|майк|халат|бель[её]|одежд|размер/.test(name)) return 'Одежда';
    if (/веник|ковш|таз|шапк|сланц|тапоч|мочал|щетк|ароматизатор/.test(name)) return 'Аксессуары';
    if (/шампун|мыло|гель|бритв|дезодорант|зубн|паста|гигиен|салфетк/.test(name)) return 'Гигиена';
    if (CATEGORIES.includes(stored)) return stored;
    if (stored === 'Напитки') return 'Напитки';
    if (stored === 'Для бани') return 'Для бани';
    if (stored === 'Одежда') return 'Одежда';
    if (stored === 'Гигиена') return 'Гигиена';
    return 'Прочее';
  }

  function paidSalesByProduct() {
    const result = new Map();
    const productById = new Map(catalog().map(product => [Number(product.id), product]));
    for (const client of clientRows()) {
      const items = Array.isArray(client?.items) ? client.items : [];
      for (const item of items) {
        if (item?.productId == null) continue;
        if (!['cash', 'transfer'].includes(String(item?.method || ''))) continue;
        const id = Number(item.productId);
        if (!Number.isFinite(id)) continue;
        const qty = Math.max(0, Number(item.qty || 0));
        const price = Math.max(0, Number(item.price || 0));
        if (!qty) continue;
        const product = productById.get(id);
        const rawCost = item.costPrice != null ? item.costPrice : product?.costPrice;
        const costPrice = rawCost == null || rawCost === '' ? null : Number(rawCost);
        const row = result.get(id) || { qty: 0, revenue: 0, cost: 0, profit: 0, missingCostQty: 0 };
        row.qty += qty;
        row.revenue += qty * price;
        if (costPrice != null && Number.isFinite(costPrice) && costPrice >= 0) {
          row.cost += qty * costPrice;
          row.profit += qty * (price - costPrice);
        } else {
          row.missingCostQty += qty;
        }
        result.set(id, row);
      }
    }
    return result;
  }

  function available(product) {
    return Math.max(0, Number(product?.available ?? (Number(product?.stock || 0) - Number(product?.reserved || 0))));
  }

  function viewRows() {
    const sales = paidSalesByProduct();
    return catalog().map(product => {
      const sale = sales.get(Number(product.id)) || { qty: 0, revenue: 0, cost: 0, profit: 0, missingCostQty: 0 };
      return {
        ...product,
        _poCategory: suggestedCategory(product),
        _poStoredCategory: storedCategory(product),
        _poStock: available(product),
        _poSoldQty: sale.qty,
        _poRevenue: Math.round(sale.revenue),
        _poProfit: Math.round(sale.profit),
        _poMissingCostQty: sale.missingCostQty
      };
    });
  }

  function inventoryTotals(rows) {
    return rows.reduce((sum, product) => {
      sum.stock += product._poStock;
      sum.soldQty += product._poSoldQty;
      sum.revenue += product._poRevenue;
      sum.profit += product._poProfit;
      sum.missingCostQty += product._poMissingCostQty;
      return sum;
    }, { stock: 0, soldQty: 0, revenue: 0, profit: 0, missingCostQty: 0 });
  }

  function filteredRows(rows) {
    const q = searchQuery.trim().toLocaleLowerCase('ru-RU');
    let result = rows.filter(product => !q || `${product.name} ${product._poCategory}`.toLocaleLowerCase('ru-RU').includes(q));
    if (filterMode === 'in-stock') result = result.filter(product => product._poStock > 0);
    else if (filterMode === 'low-stock') result = result.filter(product => product._poStock > 0 && product._poStock <= 5);
    else if (filterMode === 'out') result = result.filter(product => product._poStock <= 0);
    else if (filterMode === 'sold') result = result.filter(product => product._poSoldQty > 0);
    return result;
  }

  function sortedRows(rows) {
    const result = [...rows];
    const by = {
      manual: (a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'),
      name: (a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'),
      stock: (a,b) => b._poStock - a._poStock || String(a.name||'').localeCompare(String(b.name||''),'ru'),
      sold: (a,b) => b._poSoldQty - a._poSoldQty || String(a.name||'').localeCompare(String(b.name||''),'ru'),
      revenue: (a,b) => b._poRevenue - a._poRevenue || String(a.name||'').localeCompare(String(b.name||''),'ru')
    };
    return result.sort(by[sortMode] || by.name);
  }

  function injectStyles() {
    if ($('#po-smart-inventory-style-v3')) return;
    const style = document.createElement('style');
    style.id = 'po-smart-inventory-style-v3';
    style.textContent = `
      #productsView .section-head.po-si-page-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:nowrap}
      #productsView .po-si-page-title{display:flex;align-items:flex-start;gap:9px;min-width:0}
      #productsView .po-si-page-mark{display:grid;place-items:center;flex:0 0 34px;width:34px;height:34px;border:1px solid #b8862f;border-radius:11px;background:linear-gradient(145deg,#261a08,#080d09);color:#fbd36d;font-size:20px;box-shadow:0 0 14px #d89c3020}
      #productsView .po-si-page-copy{min-width:0}
      #productsView .po-si-page-copy .eyebrow{color:#e5c57f;font-size:9px;letter-spacing:.12em}
      #productsView .po-si-page-copy h2{margin:0;color:#fff1d2;font:700 clamp(19px,4.7vw,24px)/1.12 Georgia,serif}
      #productsView .po-si-page-copy small{display:block;margin-top:4px;color:#bcae96;font-size:10px;line-height:1.35}
      #productsView .po-si-head-actions{display:flex;align-items:center;gap:7px;flex:0 0 auto;flex-wrap:nowrap}
      #productsView .po-si-head-actions #refreshProducts{min-width:36px;width:36px;height:38px;padding:0;font-size:0;border-radius:11px}
      #productsView .po-si-head-actions #refreshProducts:after{content:'↻';font-size:17px}
      #productsView #poSmartAddProduct{min-height:40px;padding:9px 11px;border:1px solid #f0c45f;border-radius:12px;background:linear-gradient(135deg,#9a620e,#ffd36c);color:#261705;font-size:10px;font-weight:950;box-shadow:0 5px 20px #d99b2b25;white-space:nowrap}
      #productsView #productsGrid.po-si-layout{display:block!important;grid-template-columns:1fr!important;gap:0!important}
      #productsView #inventoryKpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:0 0 10px}
      #productsView #inventoryKpis .po-si-kpi{min-width:0;min-height:76px;padding:9px 6px;border:1px solid #6b4c20;border-radius:14px;background:linear-gradient(150deg,#141008,#07110c);box-shadow:inset 0 1px #ffdf7a12,0 4px 14px #0005;text-align:center;display:flex;flex-direction:column;justify-content:space-between;gap:5px}
      #productsView #inventoryKpis .po-si-kpi.stock{border-color:#16834f;box-shadow:inset 0 0 16px #00a96012,0 0 12px #00a96012}
      #productsView #inventoryKpis .po-si-kpi.profit{border-color:#16834f}
      #productsView #inventoryKpis .po-si-kpi small{font-size:clamp(7px,1.9vw,9px);line-height:1.2;color:#cbb993;overflow-wrap:anywhere}
      #productsView #inventoryKpis .po-si-kpi strong{display:block;font-size:clamp(10px,2.7vw,15px);line-height:1.15;color:#ffdc84;overflow-wrap:anywhere}
      #productsView #inventoryKpis .po-si-kpi.stock strong,#productsView #inventoryKpis .po-si-kpi.profit strong{color:#70ebb0}
      #productsView #inventoryKpis .po-si-kpi .po-si-kpi-icon{font-size:14px;line-height:1;color:#ffd36d}
      #productsView #inventoryKpis .po-si-kpi-note{font-size:7px;color:#b5a587;line-height:1.1}
      #productsView .po-si-dashboard-tools{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;margin:0 0 10px}
      #productsView .po-si-search{width:100%;min-width:0;height:42px;margin:0;padding:10px 12px;border:1px solid #765423;border-radius:12px;background:#100b07;color:#f8eddb;font-size:11px;outline:none}
      #productsView .po-si-search:focus{border-color:#efc15b;box-shadow:0 0 0 3px #efc15b20}
      #productsView .po-si-tool-select{height:42px;min-width:0;max-width:100px;padding:0 8px;border:1px solid #765423;border-radius:11px;background:#100d08;color:#f5dda8;font-size:9px;font-weight:800}
      #productsView .po-si-categories{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      #productsView .po-si-category{min-width:0;min-height:135px;padding:9px 8px;text-align:left;border:1px solid #9a6a20;border-radius:16px;background:linear-gradient(145deg,#171109 0%,#0b120d 78%);color:#fff0d1;box-shadow:0 7px 17px #0005,inset 0 1px #ffe5a21c;display:flex;flex-direction:column;gap:7px;position:relative;overflow:hidden}
      #productsView .po-si-category:before{content:'';position:absolute;inset:0 0 auto;height:2px;background:linear-gradient(90deg,transparent,#ffdc76,transparent);opacity:.75}
      #productsView .po-si-category:active{transform:scale(.985)}
      #productsView .po-si-category.is-active{border-color:#69e6a1;box-shadow:0 0 0 1px #69e6a133,0 0 20px #2ce58b19}
      #productsView .po-si-card-head{display:grid;grid-template-columns:43px minmax(0,1fr) 16px;align-items:center;gap:7px;min-width:0}
      #productsView .po-si-cat-icon{display:grid;place-items:center;width:40px;height:43px;font-size:29px;line-height:1;filter:drop-shadow(0 2px 4px #0008)}
      #productsView .po-si-card-title{min-width:0;display:flex;flex-direction:column;gap:3px}
      #productsView .po-si-cat-name{font-size:clamp(11px,3vw,14px);font-weight:950;line-height:1.18;overflow-wrap:anywhere;color:#fff1d5}
      #productsView .po-si-cat-meta{font-size:9px;color:#c8b99e;line-height:1.25}
      #productsView .po-si-card-arrow{font-size:22px;line-height:1;color:#f5c85b;text-align:right}
      #productsView .po-si-mini-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:auto}
      #productsView .po-si-mini-metric{min-width:0;min-height:46px;padding:5px 3px;border:1px solid #255c3e;border-radius:10px;background:linear-gradient(150deg,#071b11,#09100b);display:flex;flex-direction:column;justify-content:center;align-items:center;gap:3px;text-align:center}
      #productsView .po-si-mini-metric.amount{border-color:#6e511c;background:linear-gradient(150deg,#211806,#0d0c08)}
      #productsView .po-si-mini-metric b{font-size:clamp(9px,2.6vw,12px);line-height:1.1;color:#8ce8b5;white-space:nowrap}
      #productsView .po-si-mini-metric.amount b{color:#ffdb7a}
      #productsView .po-si-mini-metric small{font-size:8px;line-height:1.1;color:#bcb09a}
      #productsView .po-si-review{display:flex;align-items:flex-start;gap:8px;margin:0 0 9px;padding:9px 11px;border:1px solid #7d622f;border-radius:12px;background:#201708;color:#e6d5b7;font-size:10px;line-height:1.5}
      #productsView .po-si-review b{color:#ffd77c}
      #productsView .po-si-detail-head{display:flex;justify-content:space-between;align-items:center;gap:9px;margin:8px 0 10px}
      #productsView .po-si-back{min-height:38px;padding:8px 12px;border:1px solid #654720;border-radius:11px;background:#151008;color:#ffe7b3;font-size:10px;font-weight:900;white-space:nowrap}
      #productsView .po-si-detail-title{min-width:0;font:700 22px/1.1 Georgia,serif;color:#fff1d3;overflow-wrap:anywhere}
      #productsView .po-si-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:10px 0 12px}
      #productsView .po-si-summary-card{min-width:0;padding:10px 8px;border:1px solid #4e3a25;border-radius:13px;background:linear-gradient(145deg,#0b1a12,#0a0b08)}
      #productsView .po-si-summary-card small{display:block;font-size:8px;color:#c3b599;line-height:1.35}
      #productsView .po-si-summary-card strong{display:block;margin-top:5px;font-size:16px;line-height:1.1;overflow-wrap:anywhere}
      #productsView .po-si-summary-card.stock strong,#productsView .po-si-summary-card.sold strong{color:#82edb0}
      #productsView .po-si-summary-card.revenue strong{color:#ffd36d}
      #productsView .po-si-table-wrap{width:100%;overflow-x:auto;border:1px solid #4b361f;border-radius:14px;background:#0c0a07;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch}
      #productsView .po-si-table{width:100%;min-width:760px;border-collapse:separate;border-spacing:0;font-size:10px}
      #productsView .po-si-table th{position:sticky;top:0;z-index:1;padding:10px 8px;background:#22170b;color:#f3d89f;text-align:left;white-space:nowrap;border-bottom:1px solid #694a25}
      #productsView .po-si-table td{padding:10px 8px;border-bottom:1px solid #2e2418;color:#e8decd;vertical-align:middle}
      #productsView .po-si-table tr:last-child td{border-bottom:0}
      #productsView .po-si-table tfoot td{background:#191207;color:#ffdf8a;font-weight:950;border-top:1px solid #775427}
      #productsView .po-si-name{min-width:145px;font-weight:900;line-height:1.35}
      #productsView .po-si-stock{color:#91efb8!important;font-weight:950;white-space:nowrap}
      #productsView .po-si-revenue{color:#ffdc83!important;font-weight:950;white-space:nowrap}
      #productsView .po-si-sold{color:#9fc6ff!important;font-weight:900;white-space:nowrap}
      #productsView .po-si-cost{color:#dec6a1;white-space:nowrap}
      #productsView .po-si-price{white-space:nowrap}
      #productsView .po-si-category-select{max-width:128px;min-height:34px;padding:5px 6px;border:1px solid #594329;border-radius:8px;background:#100d08;color:#ffe9c0;font-size:9px}
      #productsView .po-si-save-cat{display:block;margin-top:5px;padding:5px 7px;border:1px solid #338658;border-radius:8px;background:#0d2b1b;color:#92f0b7;font-size:9px;font-weight:900;white-space:nowrap}
      #productsView .po-si-actions{min-width:102px}
      #productsView .po-si-actions>summary{display:flex;align-items:center;justify-content:center;min-height:32px;padding:6px 8px;border:1px solid #66502e;border-radius:8px;background:#1c1409;color:#ffdf9b;font-size:9px;font-weight:900;cursor:pointer;list-style:none;white-space:nowrap}
      #productsView .po-si-actions>summary::-webkit-details-marker{display:none}
      #productsView .po-si-actions[open]>summary{border-color:#b78a42;background:#2a1d0b}
      #productsView .po-si-row-actions{display:flex;flex-direction:column;gap:4px;min-width:100px;padding-top:5px}
      #productsView .po-si-action{min-height:31px;padding:6px 8px;border:1px solid #66502e;border-radius:8px;background:#1c1409;color:#ffdf9b;font-size:9px;font-weight:850;white-space:nowrap}
      #productsView .po-si-receipt{display:flex;gap:4px;align-items:center}
      #productsView .po-si-receipt input{width:54px;min-height:31px;padding:4px;border:1px solid #57442d;border-radius:7px;background:#fff;color:#18110a;font-size:10px}
      #productsView .po-si-empty{padding:20px 12px;text-align:center;color:#c5b494;font-size:11px;line-height:1.55}
      #productsView .po-si-product-sub{display:block;margin-top:4px;color:#b1a48f;font-size:9px;font-weight:600}
      /* Desktop keeps the full table; mobile uses readable product cards. */
      #productsView .po-si-mobile-cards{display:none}
      #productsView .po-si-mobile-product{min-width:0;padding:13px;border:1px solid #805a28;border-radius:16px;background:linear-gradient(145deg,#171109 0%,#09140e 86%);box-shadow:inset 0 1px #ffe1a018,0 7px 18px #0005;overflow:hidden}
      #productsView .po-si-mobile-product-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:11px}
      #productsView .po-si-mobile-product-main{min-width:0;display:flex;align-items:flex-start;gap:9px}
      #productsView .po-si-mobile-product-icon{width:38px;height:38px;flex:0 0 38px;display:grid;place-items:center;border:1px solid #765523;border-radius:11px;background:#100d08;color:#ffdb83;font-size:19px}
      #productsView .po-si-mobile-product-name{min-width:0;color:#fff2d7;font-size:14px;font-weight:950;line-height:1.28;overflow-wrap:anywhere}
      #productsView .po-si-mobile-product-sub{display:block;margin-top:4px;color:#bcae98;font-size:9px;line-height:1.35}
      #productsView .po-si-mobile-product-number{flex:0 0 auto;color:#d8c49b;font-size:9px;font-weight:900}
      #productsView .po-si-mobile-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0 0 9px}
      #productsView .po-si-mobile-metric{min-width:0;min-height:58px;padding:8px 5px;border:1px solid #285d40;border-radius:11px;background:linear-gradient(150deg,#071b11,#09100b);display:flex;flex-direction:column;justify-content:center;align-items:center;gap:4px;text-align:center}
      #productsView .po-si-mobile-metric.sold{border-color:#365679;background:linear-gradient(150deg,#0a1726,#0b100e)}
      #productsView .po-si-mobile-metric.amount{border-color:#73531d;background:linear-gradient(150deg,#211806,#0d0c08)}
      #productsView .po-si-mobile-metric b{max-width:100%;color:#8ce8b5;font-size:clamp(10px,3vw,13px);line-height:1.15;overflow-wrap:anywhere}
      #productsView .po-si-mobile-metric.sold b{color:#a9cfff}
      #productsView .po-si-mobile-metric.amount b{color:#ffdc83}
      #productsView .po-si-mobile-metric small{color:#b9ae98;font-size:8px;line-height:1.15}
      #productsView .po-si-mobile-prices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin-bottom:9px}
      #productsView .po-si-mobile-price{min-width:0;padding:8px 9px;border:1px solid #493b27;border-radius:10px;background:#100e09}
      #productsView .po-si-mobile-price small{display:block;color:#bcae98;font-size:8px;line-height:1.2}
      #productsView .po-si-mobile-price b{display:block;margin-top:4px;color:#f0d6a0;font-size:12px;line-height:1.2;overflow-wrap:anywhere}
      #productsView .po-si-mobile-price.sale b{color:#ffdc83}
      #productsView .po-si-mobile-category-note{margin:0 0 8px;padding:7px 9px;border:1px solid #7b602f;border-radius:9px;background:#211707;color:#e4d0a7;font-size:9px;line-height:1.4}
      #productsView .po-si-mobile-actions{margin-top:8px;border-top:1px solid #40301c;padding-top:8px}
      #productsView .po-si-mobile-actions>summary{display:flex;align-items:center;justify-content:space-between;min-height:38px;padding:8px 10px;border:1px solid #725328;border-radius:10px;background:#1b140a;color:#ffdfa0;font-size:10px;font-weight:900;list-style:none;cursor:pointer}
      #productsView .po-si-mobile-actions>summary::-webkit-details-marker{display:none}
      #productsView .po-si-mobile-actions[open]>summary{border-color:#c29343;background:#2a1d0b}
      #productsView .po-si-mobile-actions-body{display:grid;gap:8px;padding:10px 1px 1px}
      #productsView .po-si-mobile-control-label{display:grid;gap:5px;color:#e7d4b0;font-size:9px;font-weight:850}
      #productsView .po-si-mobile-control-label select,#productsView .po-si-mobile-control-label input{width:100%;min-height:39px;padding:8px 10px;border:1px solid #644b2c;border-radius:9px;background:#100d08;color:#ffe8bd;font-size:11px}
      #productsView .po-si-mobile-receipt{display:grid;grid-template-columns:minmax(0,1fr) 42px;gap:6px}
      #productsView .po-si-mobile-receipt button{min-height:39px;border:1px solid #3c9a67;border-radius:9px;background:#0b2a1b;color:#9bf0bd;font-size:17px;font-weight:950}
      #productsView .po-si-mobile-action-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
      #productsView .po-si-mobile-action-grid .po-si-action{min-height:38px;white-space:normal;line-height:1.25}
      #productsView .po-si-mobile-empty{padding:18px;border:1px dashed #725328;border-radius:12px;color:#d4c19d;text-align:center;font-size:11px}
      #poSmartProductModal .modal-card{max-width:540px}
      #poSmartProductForm{display:grid;gap:10px;margin-top:12px}
      #poSmartProductForm label{display:grid;gap:5px;color:#f1dfbf;font-size:10px;font-weight:850}
      #poSmartProductForm input,#poSmartProductForm select{width:100%;min-height:44px;padding:10px 12px;border:1px solid #664a27;border-radius:11px;background:#fff;color:#1c1409;font-size:13px}
      #poSmartProductForm .po-si-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      #poSmartProductForm .po-si-form-actions{display:grid;grid-template-columns:1fr 1.2fr;gap:8px;margin-top:3px}
      #poSmartProductForm .po-si-form-actions button{min-height:45px}
      #poSmartProductForm .po-si-hint{font-size:9px;line-height:1.45;color:#bfae8e}
      @media(max-width:700px){
        #productsView .po-si-table-wrap{display:none!important}
        #productsView .po-si-mobile-cards{display:grid;grid-template-columns:minmax(0,1fr);gap:9px}
        #productsView .po-si-summary{gap:5px}
        #productsView .po-si-summary-card{padding:9px 7px}
        #productsView .po-si-summary-card strong{font-size:clamp(13px,3.7vw,17px)}
        #productsView .po-si-detail-title{font-size:21px}
      }
      @media(max-width:380px){
        #productsView .po-si-mobile-product{padding:10px}
        #productsView .po-si-mobile-product-name{font-size:12px}
        #productsView .po-si-mobile-metric{min-height:53px;padding:6px 3px}
        #productsView .po-si-mobile-metric b{font-size:10px}
        #productsView .po-si-mobile-metric small{font-size:7px}
      }
      @media(min-width:701px){#productsView .po-si-mobile-cards{display:none!important}}
      @media(min-width:720px){#productsView .po-si-categories{grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}#productsView .po-si-table{min-width:860px}#productsView #inventoryKpis{gap:10px}#productsView #inventoryKpis .po-si-kpi{min-height:92px;padding:12px}#productsView .po-si-kpi small{font-size:11px}#productsView .po-si-kpi strong{font-size:18px}#productsView .po-si-category{min-height:150px;padding:13px}#productsView .po-si-cat-name{font-size:15px}#productsView .po-si-mini-metric{min-height:55px}}
      @media(max-width:380px){#productsView .po-si-category{min-height:125px;padding:7px 6px}#productsView .po-si-card-head{grid-template-columns:36px minmax(0,1fr) 12px;gap:5px}#productsView .po-si-cat-icon{width:34px;height:38px;font-size:25px}#productsView .po-si-cat-name{font-size:11px}#productsView .po-si-cat-meta{font-size:8px}#productsView .po-si-mini-metric{min-height:42px;padding:4px 2px}#productsView .po-si-mini-metric b{font-size:8px}#productsView .po-si-mini-metric small{font-size:7px}#productsView .po-si-tool-select{max-width:82px;font-size:8px;padding:0 5px}#productsView #inventoryKpis .po-si-kpi{min-height:70px;padding:7px 4px}#productsView #inventoryKpis .po-si-kpi strong{font-size:10px}#poSmartProductForm .po-si-form-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureHeaderControls() {
    const head = $('#productsView .section-head');
    if (!head) return;
    head.classList.add('po-si-page-head');
    const titleWrap = head.querySelector(':scope > div');
    if (titleWrap && !titleWrap.dataset.poSiTitle) {
      titleWrap.dataset.poSiTitle = '1';
      titleWrap.className = 'po-si-page-title';
      titleWrap.innerHTML = `<span class="po-si-page-mark" aria-hidden="true">⬡</span><span class="po-si-page-copy"><div class="eyebrow">PAR ORDO · SMART INVENTORY</div><h2>Товары и категории</h2><small>Управление товарами по категориям</small></span>`;
    }
    const refresh = $('#refreshProducts');
    if (refresh && !$('#poSiHeadActions')) {
      const actions = document.createElement('div');
      actions.id = 'poSiHeadActions';
      actions.className = 'po-si-head-actions';
      refresh.parentNode.insertBefore(actions, refresh);
      actions.appendChild(refresh);
      refresh.setAttribute('aria-label', 'Обновить каталог');
      refresh.setAttribute('title', 'Обновить каталог');
      if (role() !== 'manager' && role() !== 'leader') {
        const add = document.createElement('button');
        add.id = 'poSmartAddProduct';
        add.type = 'button';
        add.textContent = '＋ Добавить товар';
        add.addEventListener('click', openSmartProductModal);
        actions.appendChild(add);
      }
    }
  }

  function ensureSmartModal() {
    if ($('#poSmartProductModal')) return;
    const modal = document.createElement('div');
    modal.id = 'poSmartProductModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <form class="modal-card" id="poSmartProductForm">
        <div class="modal-head">
          <div><div class="eyebrow">PAR ORDO · SMART INVENTORY PRO</div><h2>Добавить товар</h2><div class="history-meta">Товар сохранится в общей базе и будет доступен на всех устройствах.</div></div>
          <button class="close" type="button" data-po-si-close aria-label="Закрыть">×</button>
        </div>
        <label>Категория *<select name="category" id="poSiCategory" required></select></label>
        <label>Название товара *<input name="name" id="poSiName" maxlength="120" required placeholder="Например, Coca-Cola"></label>
        <div id="poSiVariantWrap" hidden>
          <label id="poSiVariantLabel">Вариант<select name="variant" id="poSiVariant"></select></label>
        </div>
        <div class="po-si-form-grid">
          <label>Количество на складе *<input name="stock" id="poSiStock" type="number" min="0" step="1" inputmode="numeric" value="0" required></label>
          <label>Цена продажи, сом *<input name="price" id="poSiPrice" type="number" min="0" step="1" inputmode="numeric" required placeholder="0"></label>
          ${role() === 'admin' ? '<label>Закупочная цена, сом<input name="costPrice" id="poSiCost" type="number" min="0" step="1" inputmode="numeric" placeholder="0"></label>' : ''}
        </div>
        <div class="po-si-hint" id="poSiStockHint">Баштапкы сан товар түзүлгөндөн кийин «Поступление» кыймылы катары катталат.</div>
        <div class="po-si-form-actions"><button type="button" class="ghost" data-po-si-close>Отмена</button><button type="submit" class="primary" id="poSiSave">Сохранить товар</button></div>
      </form>`;
    document.body.appendChild(modal);
    $$('[data-po-si-close]', modal).forEach(button => button.addEventListener('click', closeSmartProductModal));
    modal.addEventListener('click', event => { if (event.target === modal) closeSmartProductModal(); });
    $('#poSmartProductForm').addEventListener('submit', saveSmartProduct);
    $('#poSiCategory').addEventListener('change', updateVariantControl);
    fillCategorySelect($('#poSiCategory'));
    updateVariantControl();
  }

  function fillCategorySelect(select) {
    if (!select) return;
    const previous = select.value;
    select.innerHTML = CATEGORIES.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join('');
    if (CATEGORIES.includes(previous)) select.value = previous;
  }

  function updateVariantControl() {
    const category = $('#poSiCategory')?.value || $('#newProductCategory')?.value || '';
    const wrap = $('#poSiVariantWrap');
    const select = $('#poSiVariant');
    const label = $('#poSiVariantLabel');
    if (!wrap || !select || !label) return;
    if (category === 'Шорты') {
      wrap.hidden = false;
      label.firstChild.textContent = 'Тип шорт *';
      select.innerHTML = '<option value="Взрослый">Взрослый</option><option value="Детский">Детский</option>';
    } else if (category === 'Одежда') {
      wrap.hidden = false;
      label.firstChild.textContent = 'Размер *';
      select.innerHTML = '<option value="XS">XS</option><option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option><option value="XXL">XXL</option><option value="3XL">3XL</option><option value="Другой">Другой</option>';
    } else {
      wrap.hidden = true;
      select.innerHTML = '';
    }
  }

  function openSmartProductModal() {
    ensureSmartModal();
    const form = $('#poSmartProductForm');
    form.reset();
    $('#poSiStock').value = '0';
    fillCategorySelect($('#poSiCategory'));
    updateVariantControl();
    $('#poSmartProductModal').classList.add('open');
    $('#poSiName')?.focus({ preventScroll: true });
  }

  function closeSmartProductModal() {
    $('#poSmartProductModal')?.classList.remove('open');
  }

  async function saveSmartProduct(event) {
    event.preventDefault();
    if (!['admin', 'staff'].includes(role())) { toast('Недостаточно прав для добавления товара.'); return; }
    const category = $('#poSiCategory').value;
    const baseName = String($('#poSiName').value || '').trim().replace(/\s+/g, ' ');
    const variant = $('#poSiVariantWrap').hidden ? '' : String($('#poSiVariant').value || '').trim();
    const name = variant ? `${baseName} — ${variant}` : baseName;
    const priceRaw = $('#poSiPrice').value.trim();
    const stockRaw = $('#poSiStock').value.trim();
    const costRaw = role() === 'admin' ? ($('#poSiCost')?.value.trim() || '') : '';
    const price = Number(priceRaw);
    const stock = Number(stockRaw);
    const costPrice = costRaw === '' ? null : Number(costRaw);
    if (!name || name.length > 120) { toast('Название товара должно быть от 1 до 120 символов.'); return; }
    if (!CATEGORIES.includes(category)) { toast('Выберите категорию товара.'); return; }
    if (priceRaw === '' || !Number.isInteger(price) || price < 0) { toast('Введите корректную цену продажи.'); return; }
    if (stockRaw === '' || !Number.isInteger(stock) || stock < 0) { toast('Количество должно быть целым числом от 0.'); return; }
    if (costPrice !== null && (!Number.isInteger(costPrice) || costPrice < 0)) { toast('Закупочная цена должна быть целым числом от 0.'); return; }
    const button = $('#poSiSave');
    button.disabled = true;
    button.textContent = 'Сохраняем…';
    try {
      const payload = { name, category, price };
      if (role() === 'admin') payload.costPrice = costPrice;
      const created = await api('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
      if (!created?.product?.id) throw new Error('Сервер не вернул ID созданного товара.');
      if (stock > 0) {
        try {
          await api(`/api/admin/products/${Number(created.product.id)}/stock`, { method: 'POST', body: JSON.stringify({ qty: stock }) });
        } catch (stockError) {
          await loadProducts();
          closeSmartProductModal();
          renderInventory();
          throw new Error(`Товар создан, но остаток не записан: ${stockError.message}. Добавьте поступление отдельно.`);
        }
      }
      await loadProducts();
      closeSmartProductModal();
      renderInventory();
      toast(`Товар «${name}» добавлен в «${category}» ✅`);
    } catch (error) {
      toast(`Не удалось завершить добавление: ${error.message}`);
    } finally {
      button.disabled = false;
      button.textContent = 'Сохранить товар';
    }
  }

  function installLegacyAddFormObserver() {
    const root = $('#addModal') || document.body;
    const enhance = () => {
      const select = $('#newProductCategory');
      const form = $('#newProductForm');
      if (!select || !form) return;
      const current = select.value;
      fillCategorySelect(select);
      if (CATEGORIES.includes(current)) select.value = current;
      if (!$('#poLegacyStock')) {
        const actions = $('.new-product-form-actions', form);
        if (actions) {
          const extra = document.createElement('label');
          extra.id = 'poLegacyStockWrap';
          extra.innerHTML = 'Количество на складе<input id="poLegacyStock" type="number" min="0" step="1" inputmode="numeric" value="0" placeholder="0">';
          actions.parentNode.insertBefore(extra, actions);
          const category = document.createElement('label');
          category.id = 'poLegacyVariantWrap';
          category.hidden = true;
          category.innerHTML = 'Вариант / размер<select id="poLegacyVariant"></select>';
          actions.parentNode.insertBefore(category, actions);
        }
      }
      if (!select.dataset.poSmartBound) {
        select.dataset.poSmartBound = '1';
        select.addEventListener('change', () => updateLegacyVariant(select.value));
      }
      updateLegacyVariant(select.value);
    };
    const updateLegacyVariant = category => {
      const wrap = $('#poLegacyVariantWrap');
      const select = $('#poLegacyVariant');
      if (!wrap || !select) return;
      if (category === 'Шорты') {
        wrap.hidden = false;
        wrap.firstChild.textContent = 'Тип шорт';
        select.innerHTML = '<option value="Взрослый">Взрослый</option><option value="Детский">Детский</option>';
      } else if (category === 'Одежда') {
        wrap.hidden = false;
        wrap.firstChild.textContent = 'Размер одежды';
        select.innerHTML = '<option value="XS">XS</option><option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option><option value="XXL">XXL</option><option value="3XL">3XL</option><option value="Другой">Другой</option>';
      } else {
        wrap.hidden = true;
        select.innerHTML = '';
      }
    };
    new MutationObserver(enhance).observe(root, { childList: true, subtree: true });
    enhance();
  }

  async function createCatalogProductSmart() {
    if (!['admin', 'staff'].includes(role())) { toast('Добавлять товары может только администратор или сотрудник.'); return; }
    const baseName = String($('#newProductName')?.value || '').trim().replace(/\s+/g, ' ');
    const category = $('#newProductCategory')?.value || '';
    const variant = $('#poLegacyVariantWrap')?.hidden ? '' : String($('#poLegacyVariant')?.value || '').trim();
    const name = variant ? `${baseName} — ${variant}` : baseName;
    const priceRaw = $('#newProductPrice')?.value.trim() || '';
    const stockRaw = $('#poLegacyStock')?.value.trim() || '0';
    const costRaw = role() === 'admin' ? ($('#newProductCostPrice')?.value.trim() || '') : '';
    const price = Number(priceRaw), stock = Number(stockRaw);
    const costPrice = costRaw === '' ? null : Number(costRaw);
    if (!name || name.length > 120) { toast('Название товара должно быть от 1 до 120 символов.'); return; }
    if (!CATEGORIES.includes(category)) { toast('Выберите категорию товара.'); return; }
    if (priceRaw === '' || !Number.isInteger(price) || price < 0) { toast('Введите корректную цену продажи.'); return; }
    if (!Number.isInteger(stock) || stock < 0) { toast('Количество должно быть целым числом от 0.'); return; }
    if (costPrice !== null && (!Number.isInteger(costPrice) || costPrice < 0)) { toast('Введите корректную закупочную цену.'); return; }
    const button = $('#saveNewProduct');
    if (button) { button.disabled = true; button.textContent = 'Сохраняем…'; }
    try {
      const payload = { name, category, price };
      if (role() === 'admin') payload.costPrice = costPrice;
      const created = await api('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
      if (!created?.product?.id) throw new Error('Сервер не вернул ID созданного товара.');
      if (stock > 0) {
        try {
          await api(`/api/admin/products/${Number(created.product.id)}/stock`, { method: 'POST', body: JSON.stringify({ qty: stock }) });
        } catch (stockError) {
          await loadProducts();
          renderInventory();
          throw new Error(`Товар уже создан, но начальный остаток не записан: ${stockError.message}. Откройте категорию и добавьте поступление отдельно.`);
        }
      }
      await loadProducts();
      if (typeof addProductCategory !== 'undefined') addProductCategory = category;
      if (typeof renderAddProductCategories === 'function') renderAddProductCategories();
      if (typeof renderAddProductGrid === 'function') renderAddProductGrid();
      renderInventory();
      $('#newProductForm').hidden = true;
      $('#newProductName').value = '';
      $('#newProductPrice').value = '';
      if ($('#newProductCostPrice')) $('#newProductCostPrice').value = '';
      if ($('#poLegacyStock')) $('#poLegacyStock').value = '0';
      toast(`Товар «${name}» добавлен в категорию «${category}» ✅`);
    } catch (error) {
      toast(`Не удалось добавить товар: ${error.message}`);
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Сохранить товар'; }
    }
  }

  function updateLegacyCategoryChips() {
    const root = $('#addCategoryTabs');
    if (!root) return;
    root.innerHTML = ['Все', ...CATEGORIES].map(category => `
      <button type="button" class="category-chip ${category === addProductCategory ? 'active' : ''}" data-add-category="${esc(category)}" aria-pressed="${category === addProductCategory ? 'true' : 'false'}">
        <span style="font-size:15px">${category === 'Все' ? '▦' : (CATEGORY_META[category]?.icon || '📦')}</span><span>${esc(category)}</span>
      </button>`).join('');
    $$('[data-add-category]', root).forEach(button => button.onclick = () => {
      addProductCategory = button.dataset.addCategory;
      updateLegacyCategoryChips();
      renderAddProductGridSmart();
    });
  }

  function renderAddProductGridSmart() {
    const root = $('#addProductGrid');
    if (!root) return;
    const rows = catalog().filter(product => addProductCategory === 'Все' || suggestedCategory(product) === addProductCategory);
    if (!rows.length) {
      root.innerHTML = '<div class="add-products-empty">В этой категории пока нет товаров.</div>';
      return;
    }
    root.innerHTML = rows.map(product => `
      <article class="add-product-tile">
        <button type="button" class="add-product" data-po-product="${Number(product.id)}">
          ${typeof productPhotoMarkup === 'function' ? productPhotoMarkup(product, 'picker-photo') : ''}
          <span><b>${esc(product.name)}</b><small>${product.price == null ? 'Цена не указана' : safeMoney(product.price)} · остаток ${available(product)} шт.</small></span>
        </button>
      </article>`).join('');
    $$('[data-po-product]', root).forEach(button => button.addEventListener('click', async () => {
      const product = catalog().find(row => Number(row.id) === Number(button.dataset.poProduct));
      if (!product) return;
      const price = product.price == null ? NaN : Number(product.price);
      if (!Number.isInteger(price) || price < 0) { toast('Сначала укажите цену продажи товара.'); return; }
      await addPurchase({ name: product.name, price, productId: Number(product.id) });
    }));
  }

  function categoryOptions(selected) {
    return CATEGORIES.map(category => `<option value="${esc(category)}" ${category === selected ? 'selected' : ''}>${esc(category)}</option>`).join('');
  }

  async function changeCategory(productId, category, select) {
    const product = catalog().find(row => Number(row.id) === Number(productId));
    if (!product || !CATEGORIES.includes(category)) return;
    if (!['admin', 'staff'].includes(role())) { toast('Нет прав для изменения категории.'); return; }
    const previous = storedCategory(product);
    if (previous === category) return;
    if (select) select.disabled = true;
    try {
      await api(`/api/admin/products/${Number(product.id)}`, { method: 'PATCH', body: JSON.stringify({ category }) });
      product.cat = category;
      product.category = category;
      if (typeof saveLocal === 'function') saveLocal();
      toast(`«${product.name}» перенесён в «${category}» ✅`);
      renderInventory();
      if ($('#addProductGrid')) { updateLegacyCategoryChips(); renderAddProductGridSmart(); }
    } catch (error) {
      if (select) select.value = previous;
      toast(`Не удалось изменить категорию: ${error.message}`);
    } finally { if (select) select.disabled = false; }
  }

  async function addStockFromRow(productId) {
    const id = Number(productId);
    const mobileInput = $(`#po-si-mobile-incoming-${id}`);
    const mobileVisible = mobileInput && mobileInput.getClientRects().length > 0;
    const input = mobileVisible ? mobileInput : $(`#po-si-incoming-${id}`);
    const qty = Number(input?.value || 0);
    if (!Number.isInteger(qty) || qty <= 0) { toast('Введите количество больше нуля.'); return; }
    try {
      await api(`/api/admin/products/${Number(productId)}/stock`, { method: 'POST', body: JSON.stringify({ qty }) });
      await loadProducts();
      renderInventory();
      toast(`Поступление +${qty} шт. ✅`);
    } catch (error) { toast(`Ошибка поступления: ${error.message}`); }
  }

  function mobileProductCards(rows, canSeeCost) {
    if (!rows.length) return '<div class="po-si-mobile-empty">В этой категории пока нет товаров.</div>';
    return `<div class="po-si-mobile-cards">${rows.map((product, index) => {
      const id = Number(product.id);
      const actual = product._poStoredCategory;
      const suggested = product._poCategory;
      const suggestionDiffers = actual !== suggested;
      const purchase = product.costPrice != null ? safeMoney(product.costPrice) : 'Не указана';
      const price = product.price == null ? '—' : safeMoney(product.price);
      const categoryControl = ['admin', 'staff'].includes(role()) ? `
        <label class="po-si-mobile-control-label">Категория товара
          <select data-po-category="${id}" aria-label="Категория товара ${esc(product.name)}">${categoryOptions(CATEGORIES.includes(actual) ? actual : suggested)}</select>
        </label>
        ${suggestionDiffers ? `<button class="po-si-save-cat" type="button" data-po-save-suggested="${id}" data-category="${esc(suggested)}">Сохранить «${esc(suggested)}»</button>` : ''}` : `<div class="po-si-mobile-product-sub">Категория: ${esc(actual || suggested)}</div>`;
      const inventoryControls = ['admin', 'staff'].includes(role()) ? `
        <label class="po-si-mobile-control-label">Добавить поступление, шт.
          <span class="po-si-mobile-receipt"><input type="number" id="po-si-mobile-incoming-${id}" min="1" step="1" inputmode="numeric" placeholder="Количество"><button type="button" data-po-receive="${id}" aria-label="Добавить поступление для ${esc(product.name)}">＋</button></span>
        </label>
        <div class="po-si-mobile-action-grid">
          ${role() === 'admin' ? `<button type="button" class="po-si-action" data-po-edit-stock="${id}">Изменить остаток</button>` : ''}
          <button type="button" class="po-si-action" data-po-edit-price="${id}">Изменить цену продажи</button>
          ${canSeeCost ? `<button type="button" class="po-si-action" data-po-edit-cost="${id}">Изменить закупочную цену</button>` : ''}
        </div>` : '<div class="history-meta">Только просмотр</div>';
      return `<article class="po-si-mobile-product" data-po-mobile-product="${id}">
        <div class="po-si-mobile-product-head">
          <div class="po-si-mobile-product-main">
            <span class="po-si-mobile-product-icon" aria-hidden="true">${CATEGORY_META[product._poCategory]?.icon || '📦'}</span>
            <div style="min-width:0">
              <div class="po-si-mobile-product-name">${esc(product.name)}</div>
              <span class="po-si-mobile-product-sub">${esc(product._poCategory)} · товар №${id}</span>
            </div>
          </div>
          <span class="po-si-mobile-product-number">#${index + 1}</span>
        </div>
        ${suggestionDiffers ? `<div class="po-si-mobile-category-note">Текущая категория: ${esc(actual || 'не задана')}. Предложение системы: ${esc(suggested)}.</div>` : ''}
        <div class="po-si-mobile-metrics">
          <div class="po-si-mobile-metric"><b>${product._poStock.toLocaleString('ru-RU')} шт.</b><small>Остаток</small></div>
          <div class="po-si-mobile-metric sold"><b>${product._poSoldQty.toLocaleString('ru-RU')} шт.</b><small>Продано</small></div>
          <div class="po-si-mobile-metric amount"><b>${safeMoney(product._poRevenue)}</b><small>Продано на сумму</small></div>
        </div>
        <div class="po-si-mobile-prices">
          ${canSeeCost ? `<div class="po-si-mobile-price"><small>Закупочная цена</small><b>${purchase}</b></div>` : ''}
          <div class="po-si-mobile-price sale"><small>Цена продажи</small><b>${price}</b></div>
        </div>
        <details class="po-si-mobile-actions">
          <summary><span>Управление товаром</span><span>⌄</span></summary>
          <div class="po-si-mobile-actions-body">${categoryControl}${inventoryControls}</div>
        </details>
      </article>`;
    }).join('')}</div>`;
  }

  function categorySummary(rows) {
    const totals = inventoryTotals(rows);
    const canSeeCost = role() === 'admin';
    const sorted = sortedRows(rows);
    const tableRows = sorted.map((product, index) => {
      const purchase = canSeeCost && product.costPrice != null ? safeMoney(product.costPrice) : (canSeeCost ? '—' : 'Скрыто');
      const price = product.price == null ? '—' : safeMoney(product.price);
      const actual = product._poStoredCategory;
      const suggested = product._poCategory;
      const suggestionDiffers = actual !== suggested;
      const selector = ['admin', 'staff'].includes(role()) ? `
        <select class="po-si-category-select" data-po-category="${Number(product.id)}" aria-label="Категория товара ${esc(product.name)}">${categoryOptions(CATEGORIES.includes(actual) ? actual : suggested)}</select>
        ${suggestionDiffers ? `<button class="po-si-save-cat" type="button" data-po-save-suggested="${Number(product.id)}" data-category="${esc(suggested)}">Сохранить «${esc(suggested)}»</button>` : ''}` : `<span>${esc(actual || suggested)}</span>`;
      const stockActions = role() === 'admin' || role() === 'staff' ? `
        <div class="po-si-receipt"><input type="number" id="po-si-incoming-${Number(product.id)}" min="1" step="1" inputmode="numeric" placeholder="+шт." aria-label="Поступление ${esc(product.name)}"><button type="button" class="po-si-action" data-po-receive="${Number(product.id)}">＋</button></div>
        ${role() === 'admin' ? `<button type="button" class="po-si-action" data-po-edit-stock="${Number(product.id)}">Изменить остаток</button>` : ''}` : 'Только просмотр';
      return `<tr>
        <td>${index + 1}</td>
        <td class="po-si-name">${esc(product.name)}${suggestionDiffers ? `<span class="po-si-product-sub">Текущая категория: ${esc(actual || 'не задана')}</span>` : ''}</td>
        <td class="po-si-stock">${product._poStock.toLocaleString('ru-RU')} шт.</td>
        ${canSeeCost ? `<td class="po-si-cost">${purchase}</td>` : ''}
        <td class="po-si-price">${price}</td>
        <td class="po-si-sold">${product._poSoldQty.toLocaleString('ru-RU')} шт.</td>
        <td class="po-si-revenue">${safeMoney(product._poRevenue)}</td>
        <td>${selector}</td>
        <td><details class="po-si-actions"><summary>Действия ▾</summary><div class="po-si-row-actions">${stockActions}
          ${['admin', 'staff'].includes(role()) ? `<button type="button" class="po-si-action" data-po-edit-price="${Number(product.id)}">Изменить цену</button>` : ''}
          ${canSeeCost ? `<button type="button" class="po-si-action" data-po-edit-cost="${Number(product.id)}">Изменить закупку</button>` : ''}
        </div></details></td>
      </tr>`;
    }).join('');
    return `<div class="po-si-summary">
      <div class="po-si-summary-card stock"><small>Остаток на складе</small><strong>${totals.stock.toLocaleString('ru-RU')} шт.</strong></div>
      <div class="po-si-summary-card sold"><small>Продано</small><strong>${totals.soldQty.toLocaleString('ru-RU')} шт.</strong></div>
      <div class="po-si-summary-card revenue"><small>Продано на сумму</small><strong>${safeMoney(totals.revenue)}</strong></div>
    </div>
    <div class="po-si-table-wrap"><table class="po-si-table">
      <thead><tr><th>№</th><th>Название</th><th>Количество</th>${canSeeCost ? '<th>Закупочная цена</th>' : ''}<th>Цена продажи</th><th>Продано, шт.</th><th>Итог · продано на сумму</th><th>Категория</th><th>Действия</th></tr></thead>
      <tbody>${tableRows || `<tr><td colspan="${canSeeCost ? 9 : 8}" class="po-si-empty">В категории пока нет товаров.</td></tr>`}</tbody>
      <tfoot><tr><td colspan="2">ИТОГО</td><td class="po-si-stock">${totals.stock.toLocaleString('ru-RU')} шт.</td>${canSeeCost ? '<td>—</td>' : ''}<td>—</td><td class="po-si-sold">${totals.soldQty.toLocaleString('ru-RU')} шт.</td><td class="po-si-revenue">${safeMoney(totals.revenue)}</td><td colspan="2">За всё время</td></tr></tfoot>
    </table></div>
    ${mobileProductCards(sorted, canSeeCost)}
    <div class="history-meta" style="margin-top:8px">Продажи считаются по оплаченным чекам (наличные и перевод). Неоплаченные позиции не учитываются.</div>`;
  }

  function dashboardTools() {
    return `<div class="po-si-dashboard-tools">
      <input class="po-si-search" id="poSiSearch" type="search" value="${esc(searchQuery)}" placeholder="⌕ Поиск по товару или категории…" autocomplete="off" aria-label="Поиск по товару или категории">
      <select class="po-si-tool-select" id="poSiFilter" aria-label="Фильтр товаров">
        <option value="all" ${filterMode==='all'?'selected':''}>Фильтр</option>
        <option value="in-stock" ${filterMode==='in-stock'?'selected':''}>В наличии</option>
        <option value="low-stock" ${filterMode==='low-stock'?'selected':''}>Мало</option>
        <option value="out" ${filterMode==='out'?'selected':''}>Нет</option>
        <option value="sold" ${filterMode==='sold'?'selected':''}>Продано</option>
      </select>
      <select class="po-si-tool-select" id="poSiSort" aria-label="Сортировка товаров">
        <option value="manual" ${sortMode==='manual'?'selected':''}>Порядок</option>
        <option value="name" ${sortMode==='name'?'selected':''}>А–Я</option>
        <option value="stock" ${sortMode==='stock'?'selected':''}>Остаток ↓</option>
        <option value="sold" ${sortMode==='sold'?'selected':''}>Продажи ↓</option>
        <option value="revenue" ${sortMode==='revenue'?'selected':''}>Сумма ↓</option>
      </select>
    </div>`;
  }

  function renderCategoryDashboard(rows) {
    const visibleRows = filteredRows(rows);
    const allCards = ['Все товары', ...CATEGORIES];
    const cardData = allCards.map(category => {
      const subset = category === 'Все товары' ? visibleRows : visibleRows.filter(product => product._poCategory === category);
      return { category, subset, totals: inventoryTotals(subset), meta: CATEGORY_META[category] || { icon: '▦', description: 'Весь каталог товаров' } };
    });
    const all = cardData.shift();
    let ordered = cardData;
    if (sortMode === 'stock') ordered = [...ordered].sort((a,b) => b.totals.stock-a.totals.stock);
    else if (sortMode === 'sold') ordered = [...ordered].sort((a,b) => b.totals.soldQty-a.totals.soldQty);
    else if (sortMode === 'revenue') ordered = [...ordered].sort((a,b) => b.totals.revenue-a.totals.revenue);
    else if (sortMode === 'name') ordered = [...ordered].sort((a,b) => a.category.localeCompare(b.category,'ru'));
    const cards = [all, ...ordered].map(({category,subset,totals,meta}) => `
      <button type="button" class="po-si-category ${selectedCategory === category ? 'is-active' : ''}" data-po-category-open="${esc(category)}">
        <span class="po-si-card-head">
          <span class="po-si-cat-icon">${meta.icon}</span>
          <span class="po-si-card-title"><b class="po-si-cat-name">${esc(category)}</b><small class="po-si-cat-meta">${subset.length} товаров</small></span>
          <span class="po-si-card-arrow">›</span>
        </span>
        <span class="po-si-mini-metrics">
          <span class="po-si-mini-metric"><b>${totals.stock.toLocaleString('ru-RU')} шт.</b><small>Остаток</small></span>
          <span class="po-si-mini-metric"><b>${totals.soldQty.toLocaleString('ru-RU')} шт.</b><small>Продано</small></span>
          <span class="po-si-mini-metric amount"><b>${safeMoney(totals.revenue)}</b><small>Сумма</small></span>
        </span>
      </button>`).join('');
    const mismatches = rows.filter(product => product._poStoredCategory !== product._poCategory).length;
    return `${mismatches ? `<div class="po-si-review"><span>✦</span><span><b>${mismatches} товаров требуют проверки категории.</b> Система предлагает распределение по названию. Подтвердите перенос в таблице товара; автоматического изменения базы без подтверждения нет.</span></div>` : ''}
      ${dashboardTools()}
      <div class="po-si-categories">${cards}</div>`;
  }

  function renderCategoryDetail(rows, category) {
    const list = category === 'Все товары' ? rows : rows.filter(product => product._poCategory === category);
    const filtered = sortedRows(filteredRows(list));
    const meta = CATEGORY_META[category] || { icon: '📦', description: 'Каталог товаров' };
    return `<div class="po-si-detail-head">
        <div style="min-width:0"><div class="eyebrow">КАТЕГОРИЯ ТОВАРОВ</div><div class="po-si-detail-title">${meta.icon} ${esc(category)}</div><div class="history-meta">${meta.description} · ${filtered.length} товаров</div></div>
        <button type="button" class="po-si-back" data-po-back>← Категории</button>
      </div>
      ${dashboardTools()}
      ${categorySummary(filtered)}`;
  }

  function renderInventorySmart() {
    const seedButton = $('#seedNewProducts');
    if (seedButton) seedButton.hidden = true;
    const addButton = $('#poSmartAddProduct');
    if (addButton) addButton.hidden = role() === 'manager' || role() === 'leader';
    const rows = viewRows();
    const totals = inventoryTotals(rows);
    const profitReady = totals.missingCostQty === 0;
    const kpis = $('#inventoryKpis');
    if (kpis) kpis.innerHTML = `
      <div class="po-si-kpi stock"><span class="po-si-kpi-icon">⬡</span><small>Остаток на складе</small><strong>${totals.stock.toLocaleString('ru-RU')} шт.</strong></div>
      <div class="po-si-kpi"><span class="po-si-kpi-icon">🛒</span><small>Продано (всего)</small><strong>${totals.soldQty.toLocaleString('ru-RU')} шт.</strong></div>
      <div class="po-si-kpi"><span class="po-si-kpi-icon">🪙</span><small>Продано на сумму</small><strong>${safeMoney(totals.revenue)}</strong></div>
      <div class="po-si-kpi profit"><span class="po-si-kpi-icon">▥</span><small>Прибыль · оценка</small><strong>${profitReady ? (totals.profit >= 0 ? '+ ' : '− ') + safeMoney(Math.abs(totals.profit)) : '—'}</strong><span class="po-si-kpi-note">${profitReady ? 'по указанной закупке' : `не указана закупка: ${totals.missingCostQty} шт.`}</span></div>`;
    const root = $('#productsGrid');
    if (!root) return;
    root.classList.add('po-si-layout');
    root.innerHTML = selectedCategory
      ? renderCategoryDetail(rows, selectedCategory)
      : renderCategoryDashboard(rows);
    bindInventoryEvents(root);
  }
  function bindInventoryEvents(root) {
    $$('[data-po-category-open]', root).forEach(button => button.addEventListener('click', () => {
      selectedCategory = button.dataset.poCategoryOpen;
      searchQuery = '';
      renderInventorySmart();
    }));
    $$('[data-po-back]', root).forEach(button => button.addEventListener('click', () => {
      selectedCategory = '';
      searchQuery = '';
      renderInventorySmart();
    }));
    $('#poSiSearch', root)?.addEventListener('input', event => {
      searchQuery = event.target.value || '';
      const position = event.target.selectionStart;
      renderInventorySmart();
      const next = $('#poSiSearch', root);
      if (next) { next.focus(); try { next.setSelectionRange(position, position); } catch (_) {} }
    });
    $('#poSiFilter', root)?.addEventListener('change', event => { filterMode = event.target.value || 'all'; renderInventorySmart(); });
    $('#poSiSort', root)?.addEventListener('change', event => { sortMode = event.target.value || 'manual'; renderInventorySmart(); });
    $$('[data-po-category]', root).forEach(select => select.addEventListener('change', () => changeCategory(Number(select.dataset.poCategory), select.value, select)));
    $$('[data-po-save-suggested]', root).forEach(button => button.addEventListener('click', () => changeCategory(Number(button.dataset.poSaveSuggested), button.dataset.category, null)));
    $$('[data-po-receive]', root).forEach(button => button.addEventListener('click', () => addStockFromRow(Number(button.dataset.poReceive))));
    $$('[data-po-edit-stock]', root).forEach(button => button.addEventListener('click', () => editStock(Number(button.dataset.poEditStock))));
    $$('[data-po-edit-price]', root).forEach(button => button.addEventListener('click', () => editCatalogProduct(Number(button.dataset.poEditPrice), 'price')));
    $$('[data-po-edit-cost]', root).forEach(button => button.addEventListener('click', () => editCatalogProduct(Number(button.dataset.poEditCost), 'costPrice')));
  }

  function renderAddProductCategoriesSmart() { updateLegacyCategoryChips(); }

  function install() {
    if (typeof db === 'undefined' || typeof api !== 'function' || !$('#productsView') || !$('#productsGrid')) return false;
    injectStyles();
    ensureHeaderControls();
    ensureSmartModal();
    window.renderInventory = renderInventorySmart;
    window.productPickerCategory = suggestedCategory;
    window.renderAddProductCategories = renderAddProductCategoriesSmart;
    window.renderAddProductGrid = renderAddProductGridSmart;
    window.createCatalogProduct = createCatalogProductSmart;
    installLegacyAddFormObserver();
    renderInventorySmart();
    window.PARORDOSmartInventory = Object.freeze({ version: VERSION, mobileCards: true, categories: [...CATEGORIES], render: renderInventorySmart, totals: inventoryTotals, paidSalesByProduct, suggestedCategory, filters: ['all','in-stock','low-stock','out','sold'], sorting: ['name','stock','sold','revenue'] });
    return true;
  }

  const start = () => {
    if (install()) return;
    let attempts = 0;
    const retry = () => {
      if (install() || attempts++ > 30) return;
      window.setTimeout(retry, 150);
    };
    retry();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else window.setTimeout(start, 50);
})();
