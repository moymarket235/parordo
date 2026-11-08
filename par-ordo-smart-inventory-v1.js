/*
 * PAR ORDO SMART INVENTORY PRO V1
 * Category-first inventory UI for the existing PAR ORDO catalogue/API.
 * - Keeps product IDs and existing client receipt history intact.
 * - Sales totals count only paid cash/transfer client receipt lines.
 * - Product variants (clothing size / shorts type) are stored in the existing name field.
 * - Initial stock is recorded through the existing stock-receipt endpoint.
 * - Does not modify client, shift, bracelet, payment, Worker auth, or D1 schema logic.
 */
(() => {
  'use strict';

  if (window.PARORDOSmartInventory?.version === '1.0.0') return;

  const VERSION = '1.0.0';
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
        const row = result.get(id) || { qty: 0, revenue: 0 };
        row.qty += qty;
        row.revenue += qty * price;
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
      const sale = sales.get(Number(product.id)) || { qty: 0, revenue: 0 };
      return {
        ...product,
        _poCategory: suggestedCategory(product),
        _poStoredCategory: storedCategory(product),
        _poStock: available(product),
        _poSoldQty: sale.qty,
        _poRevenue: Math.round(sale.revenue)
      };
    });
  }

  function inventoryTotals(rows) {
    return rows.reduce((sum, product) => {
      sum.stock += product._poStock;
      sum.soldQty += product._poSoldQty;
      sum.revenue += product._poRevenue;
      return sum;
    }, { stock: 0, soldQty: 0, revenue: 0 });
  }

  function injectStyles() {
    if ($('#po-smart-inventory-style')) return;
    const style = document.createElement('style');
    style.id = 'po-smart-inventory-style';
    style.textContent = `
      #productsView .po-si-head-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
      #productsView #productsGrid.po-si-layout{display:block!important;grid-template-columns:1fr!important;gap:0!important}
      #productsView #inventoryKpis{grid-template-columns:repeat(2,minmax(0,1fr))}
      #productsView .po-si-add{min-height:42px;padding:9px 13px;border:1px solid #f0c45f;border-radius:12px;background:linear-gradient(135deg,#9a620e,#ffd36c);color:#261705;font-size:10px;font-weight:950;box-shadow:0 5px 20px #d99b2b25}
      #productsView .po-si-search{width:100%;height:43px;margin:4px 0 11px;padding:10px 13px;border:1px solid #624522;border-radius:12px;background:#100b07;color:#f8eddb;font-size:12px;outline:none}
      #productsView .po-si-search:focus{border-color:#efc15b;box-shadow:0 0 0 3px #efc15b20}
      #productsView .po-si-categories{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
      #productsView .po-si-category{min-width:0;min-height:112px;padding:13px 12px;text-align:left;border:1px solid #624522;border-radius:17px;background:linear-gradient(145deg,#171109,#09140e);color:#fff0d1;box-shadow:0 8px 20px #0004;display:flex;flex-direction:column;gap:5px}
      #productsView .po-si-category:active{transform:scale(.985)}
      #productsView .po-si-category.is-active{border-color:#69e6a1;box-shadow:0 0 0 1px #69e6a133,0 0 20px #2ce58b19}
      #productsView .po-si-cat-icon{font-size:25px;line-height:1.1}
      #productsView .po-si-cat-name{font-size:13px;font-weight:950;overflow-wrap:anywhere}
      #productsView .po-si-cat-meta{font-size:9px;color:#c8b99e;line-height:1.4}
      #productsView .po-si-category strong{margin-top:auto;font-size:11px;color:#8cf0b5}
      #productsView .po-si-review{display:flex;align-items:flex-start;gap:8px;margin:0 0 11px;padding:10px 12px;border:1px solid #7d622f;border-radius:12px;background:#201708;color:#e6d5b7;font-size:10px;line-height:1.5}
      #productsView .po-si-review b{color:#ffd77c}
      #productsView .po-si-detail-head{display:flex;justify-content:space-between;align-items:center;gap:9px;margin:8px 0 10px}
      #productsView .po-si-back{min-height:38px;padding:8px 12px;border:1px solid #654720;border-radius:11px;background:#151008;color:#ffe7b3;font-size:10px;font-weight:900}
      #productsView .po-si-detail-title{min-width:0;font:700 22px/1.1 Georgia,serif;color:#fff1d3;overflow-wrap:anywhere}
      #productsView .po-si-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:10px 0 12px}
      #productsView .po-si-summary-card{min-width:0;padding:13px 12px;border:1px solid #4e3a25;border-radius:15px;background:linear-gradient(145deg,#0b1a12,#0a0b08)}
      #productsView .po-si-summary-card small{display:block;font-size:9px;color:#c3b599;line-height:1.4}
      #productsView .po-si-summary-card strong{display:block;margin-top:6px;font-size:20px;line-height:1.1;overflow-wrap:anywhere}
      #productsView .po-si-summary-card.stock strong{color:#82edb0}
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
      #poSmartProductModal .modal-card{max-width:540px}
      #poSmartProductForm{display:grid;gap:10px;margin-top:12px}
      #poSmartProductForm label{display:grid;gap:5px;color:#f1dfbf;font-size:10px;font-weight:850}
      #poSmartProductForm input,#poSmartProductForm select{width:100%;min-height:44px;padding:10px 12px;border:1px solid #664a27;border-radius:11px;background:#fff;color:#1c1409;font-size:13px}
      #poSmartProductForm .po-si-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      #poSmartProductForm .po-si-form-actions{display:grid;grid-template-columns:1fr 1.2fr;gap:8px;margin-top:3px}
      #poSmartProductForm .po-si-form-actions button{min-height:45px}
      #poSmartProductForm .po-si-hint{font-size:9px;line-height:1.45;color:#bfae8e}
      @media(min-width:720px){#productsView .po-si-categories{grid-template-columns:repeat(4,minmax(0,1fr))}#productsView .po-si-table{min-width:860px}#productsView #inventoryKpis{grid-template-columns:repeat(5,minmax(0,1fr))}}
      @media(max-width:380px){#productsView .po-si-category{min-height:102px;padding:10px}#productsView .po-si-cat-name{font-size:12px}#productsView .po-si-summary-card strong{font-size:17px}#poSmartProductForm .po-si-form-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureHeaderControls() {
    const head = $('#productsView .section-head');
    if (!head) return;
    const refresh = $('#refreshProducts');
    if (refresh && !$('#poSmartAddProduct')) {
      const actions = document.createElement('div');
      actions.className = 'po-si-head-actions';
      refresh.parentNode.insertBefore(actions, refresh);
      actions.appendChild(refresh);
      if (role() !== 'manager') {
        const add = document.createElement('button');
        add.id = 'poSmartAddProduct';
        add.type = 'button';
        add.className = 'po-si-add';
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
    const input = $(`#po-si-incoming-${Number(productId)}`);
    const qty = Number(input?.value || 0);
    if (!Number.isInteger(qty) || qty <= 0) { toast('Введите количество больше нуля.'); return; }
    try {
      await api(`/api/admin/products/${Number(productId)}/stock`, { method: 'POST', body: JSON.stringify({ qty }) });
      await loadProducts();
      renderInventory();
      toast(`Поступление +${qty} шт. ✅`);
    } catch (error) { toast(`Ошибка поступления: ${error.message}`); }
  }

  function categorySummary(rows) {
    const totals = inventoryTotals(rows);
    const canSeeCost = role() === 'admin';
    const tableRows = rows.map((product, index) => {
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
      <div class="po-si-summary-card stock"><small>Остаток на складе · ${rows.length} товаров</small><strong>${totals.stock.toLocaleString('ru-RU')} шт.</strong></div>
      <div class="po-si-summary-card revenue"><small>Продано на сумму · оплаченные продажи</small><strong>${safeMoney(totals.revenue)}</strong></div>
    </div>
    <div class="history-meta" style="margin:0 0 6px">На телефоне прокрутите таблицу влево, чтобы увидеть все столбцы.</div>
    <div class="po-si-table-wrap"><table class="po-si-table">
      <thead><tr><th>№</th><th>Название</th><th>Количество</th>${canSeeCost ? '<th>Закупочная цена</th>' : ''}<th>Цена продажи</th><th>Продано, шт.</th><th>Итог · продано на сумму</th><th>Категория</th><th>Действия</th></tr></thead>
      <tbody>${tableRows || `<tr><td colspan="${canSeeCost ? 9 : 8}" class="po-si-empty">В категории пока нет товаров.</td></tr>`}</tbody>
      <tfoot><tr><td colspan="2">ИТОГО</td><td class="po-si-stock">${totals.stock.toLocaleString('ru-RU')} шт.</td>${canSeeCost ? '<td>—</td>' : ''}<td>—</td><td class="po-si-sold">${totals.soldQty.toLocaleString('ru-RU')} шт.</td><td class="po-si-revenue">${safeMoney(totals.revenue)}</td><td colspan="2">За всё время</td></tr></tfoot>
    </table></div>
    <div class="history-meta" style="margin-top:8px">«Продано на сумму» считается по чекам с оплатой наличными или переводом. Ожидающие оплаты позиции в выручку не входят.</div>`;
  }

  function renderCategoryDashboard(rows) {
    const categories = ['Все товары', ...CATEGORIES];
    const q = searchQuery.trim().toLocaleLowerCase('ru-RU');
    const filtered = q ? rows.filter(product => `${product.name} ${product._poCategory}`.toLocaleLowerCase('ru-RU').includes(q)) : rows;
    const cards = categories.map(category => {
      const subset = category === 'Все товары' ? filtered : filtered.filter(product => product._poCategory === category);
      const totals = inventoryTotals(subset);
      const meta = CATEGORY_META[category] || { icon: '▦', description: 'Весь каталог товаров' };
      return `<button type="button" class="po-si-category ${selectedCategory === category ? 'is-active' : ''}" data-po-category-open="${esc(category)}">
        <span class="po-si-cat-icon">${meta.icon}</span>
        <span class="po-si-cat-name">${esc(category)}</span>
        <span class="po-si-cat-meta">${subset.length} товаров · ${totals.stock} шт. в наличии</span>
        <strong>${safeMoney(totals.revenue)} продано</strong>
      </button>`;
    }).join('');
    const mismatches = rows.filter(product => product._poStoredCategory !== product._poCategory).length;
    return `${mismatches ? `<div class="po-si-review"><span>✦</span><span><b>${mismatches} товаров требуют проверки категории.</b> Система предлагает распределение по названию. Подтвердите перенос в таблице товара; автоматического изменения базы без подтверждения нет.</span></div>` : ''}
      <input class="po-si-search" id="poSiSearch" type="search" value="${esc(searchQuery)}" placeholder="Поиск по товару или категории…" autocomplete="off">
      <div class="po-si-categories">${cards}</div>`;
  }

  function renderCategoryDetail(rows, category) {
    const list = category === 'Все товары' ? rows : rows.filter(product => product._poCategory === category);
    const q = searchQuery.trim().toLocaleLowerCase('ru-RU');
    const filtered = q ? list.filter(product => String(product.name || '').toLocaleLowerCase('ru-RU').includes(q)) : list;
    const meta = CATEGORY_META[category] || { icon: '📦', description: 'Каталог товаров' };
    return `<div class="po-si-detail-head">
        <div style="min-width:0"><div class="eyebrow">КАТЕГОРИЯ ТОВАРОВ</div><div class="po-si-detail-title">${meta.icon} ${esc(category)}</div><div class="history-meta">${meta.description} · ${filtered.length} товаров</div></div>
        <button type="button" class="po-si-back" data-po-back>← Категории</button>
      </div>
      <input class="po-si-search" id="poSiSearch" type="search" value="${esc(searchQuery)}" placeholder="Поиск товара в категории…" autocomplete="off">
      ${categorySummary(filtered)}`;
  }

  function renderInventorySmart() {
    const seedButton = $('#seedNewProducts');
    if (seedButton) seedButton.hidden = role() !== 'admin';
    const addButton = $('#poSmartAddProduct');
    if (addButton) addButton.hidden = role() === 'manager' || role() === 'leader';
    const rows = viewRows();
    const totals = inventoryTotals(rows);
    const paidSales = totals.revenue;
    const count = rows.length;
    const kpis = $('#inventoryKpis');
    if (kpis) kpis.innerHTML = `
      <div class="kpi"><small>Товаров в каталоге</small><strong>${count}</strong></div>
      <div class="kpi green"><small>Остаток на складе</small><strong>${totals.stock.toLocaleString('ru-RU')} шт.</strong></div>
      <div class="kpi blue"><small>Продано, всего</small><strong>${totals.soldQty.toLocaleString('ru-RU')} шт.</strong></div>
      <div class="kpi"><small>Продано на сумму · за всё время</small><strong>${safeMoney(paidSales)}</strong></div>`;
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
    window.PARORDOSmartInventory = Object.freeze({ version: VERSION, categories: [...CATEGORIES], render: renderInventorySmart, totals: inventoryTotals, paidSalesByProduct, suggestedCategory });
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
