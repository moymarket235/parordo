/*
 * PAR ORDO SMART INVENTORY PRO V5 — каталог по списку владельца
 * Category-first inventory UI for the existing PAR ORDO catalogue/API (replaces V4).
 * - Categories and the order of products follow the owner's list (CATALOG_LAYOUT below).
 *   Products are recognised by name, so names in the base are not rewritten automatically.
 * - Products that are not in the list stay visible at the end of their category until the
 *   administrator reviews them in «Порядок каталога» (rename / merge / remove — with preview).
 * - Removing = soft archive (Worker V10.19): sales history stays, a product can be returned.
 * - Keeps product IDs and existing client receipt history intact.
 * - Sales totals count only paid cash/transfer client receipt lines.
 * - Product variants (clothing size / shorts type) are stored in the existing name field.
 * - Initial stock is recorded through the existing stock-receipt endpoint.
 * - Does not modify client, shift, bracelet, payment, Worker auth, or D1 schema logic.
 */
(() => {
  'use strict';

  if (window.PARORDOSmartInventory?.version === '5.0.0') return;

  const VERSION = '5.0.0';
  const CATEGORIES = ['Напитки', 'Чай', 'Одежда', 'Шорты', 'Полотенца', 'Для бани', 'Еда'];
  const CATEGORY_META = {
    'Напитки': { icon: '🥤', description: 'Вода, шоро и газированные напитки' },
    'Чай': { icon: '🍵', description: 'Чай и кофе 3 в 1' },
    'Одежда': { icon: '👕', description: 'Трусы и майки по размерам, носки по фирмам' },
    'Шорты': { icon: '🩳', description: 'Одноразовые: взрослые и детские' },
    'Полотенца': { icon: '🧺', description: 'Полотенца по фирмам' },
    'Для бани': { icon: '♨️', description: 'Веник, гигиена, шампуни и дезодоранты' },
    'Еда': { icon: '🥟', description: 'Самса, шашлык и хлеб' }
  };
  // The Worker accepts only four stored categories. Display categories are mapped onto them;
  // Worker V10.19 additionally keeps the chosen display category (displayCategory).
  const SERVER_CATEGORY = {
    'Напитки': 'Напитки', 'Чай': 'Напитки', 'Одежда': 'Одежда', 'Шорты': 'Одежда',
    'Полотенца': 'Для бани', 'Для бани': 'Для бани', 'Еда': 'Напитки'
  };
  const CLOTHING_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
  const ORDER_STORE = 'parordo_catalog_order_v1';

  /* ---------------- catalogue layout: the owner's list ----------------
     Every entry is recognised by a test on the normalised name. «slot» entries hold any number
     of products of one kind (brands are added later by the owner). Plain entries hold one product. */
  const normName = value => String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е')
    .replace(/(\d)[.,](\d)/g, '$1\u0001$2')
    .replace(/[^\p{L}\p{N}\u0001]+/gu, ' ')
    .replace(/\u0001/g, '.')
    .replace(/\s+/g, ' ').trim();
  const SIZE_TOKENS = { xs: 'XS', s: 'S', m: 'M', l: 'L', xl: 'XL', xxl: '2XL', '2xl': '2XL', xxxl: '3XL', '3xl': '3XL', '4xl': '4XL', '5xl': '5XL', '6xl': '6XL' };
  function sizeOf(n) {
    const tokens = n.split(' ');
    const latin = word => String(word || '').replace(/х/g, 'x').replace(/с/g, 's').replace(/м/g, 'm');
    const after = tokens.indexOf('размер');
    if (after >= 0 && SIZE_TOKENS[latin(tokens[after + 1])]) return SIZE_TOKENS[latin(tokens[after + 1])];
    return SIZE_TOKENS[latin(tokens[tokens.length - 1])] || '';
  }
  const isLegend = n => /legend|легенд|tien ?shan|тянь ?шань/.test(n);
  const isHalf = n => /(^| )0\.5(л| |$)|(^| )05( |$)|пол ?литр|маленьк/.test(n);
  const isMojito = n => /majito|mojito|мохито|можито|мажито/.test(n);
  const isMisvak = n => /misvak|miswak|мисвак/.test(n);
  const isShampooBrand = n => /forx|форкс|pro ?series|про ?сер|viking|викинг|clear|клир|nivea|нивея/.test(n);
  const entry = (label, test, extra = {}) => ({ label, test, ...extra });
  const CATALOG_LAYOUT = [
    ['Напитки', [
      entry('Жарма', n => /жарма/.test(n)),
      entry('Живая Вода', n => /(^| )живая( |$)/.test(n), { renameTo: n => (/вода/.test(n) ? '' : 'Живая Вода') }),
      entry('LEGEND - Минеральная вода', n => isLegend(n) && /минерал/.test(n) && !isHalf(n), { key: 'legendWater' }),
      entry('LEGEND - Клубника', n => isLegend(n) && /клубник/.test(n)),
      entry('LEGEND - Лимон', n => isLegend(n) && /лимон/.test(n)),
      entry('LEGEND - Манго и маракуйя', n => isLegend(n) && /манго|маракуй/.test(n)),
      entry('LEGEND - Мята', n => isLegend(n) && /мят/.test(n)),
      entry('LEGEND - Персик', n => isLegend(n) && /персик/.test(n)),
      entry('LEGEND - Минеральная вода 0.5', n => isLegend(n) && /минерал/.test(n) && isHalf(n), { key: 'legendWater05', tag: '0,5 л', cheapestOf: 'legendWater' }),
      entry('Шоро Аралаш', n => /аралаш/.test(n)),
      entry('Шоро Максым', n => /максым/.test(n)),
      entry('Шоро Тан', n => /(^| )тан( |$)/.test(n)),
      entry('Шоро Чалап', n => /чалап/.test(n)),
      entry('CocaCola', n => /coca|кока/.test(n)),
      entry('Pepsi', n => /pepsi|пепси/.test(n)),
      entry('Sprite', n => /sprite|спрайт/.test(n) && !isMojito(n)),
      entry('Sprite Majito', n => /sprite|спрайт/.test(n) && isMojito(n)),
      entry('Fanta', n => /fanta|фанта/.test(n)),
      entry('FuseTea', n => /fuse|fuze|фьюз|фьюс/.test(n)),
      entry('Lipton', n => /lipton|липтон/.test(n)),
      entry('Mirinda', n => /mirinda|миринда/.test(n))
    ]],
    ['Чай', [
      entry('Черный чай', n => /чай/.test(n) && /черн/.test(n)),
      entry('Зелёный чай', n => /чай/.test(n) && /зелен/.test(n)),
      entry('Чай с лимоном', n => /чай/.test(n) && /лимон/.test(n) && !isLegend(n)),
      entry('MacTea 3в1', n => /mac ?tea|мак ?ти/.test(n)),
      entry('MacCoffee 3в1', n => /mac ?coffee|мак ?коф/.test(n))
    ]],
    ['Одежда', [
      ...CLOTHING_SIZES.map(size => entry(`Трусы мужские — размер ${size}`, n => /трус/.test(n) && sizeOf(n) === size, { base: 'Трусы мужские', variant: size })),
      ...CLOTHING_SIZES.slice(0, 7).map(size => entry(`Майка — размер ${size}`, n => /майк/.test(n) && sizeOf(n) === size, { base: 'Майка', variant: size })),
      entry('Носки', n => /носк/.test(n), { slot: true, base: 'Носки ', hint: 'каждая фирма — отдельный товар' })
    ]],
    ['Шорты', [
      entry('Одноразовые шорты — Взрослый', n => /шорт/.test(n) && /взросл/.test(n), { base: 'Одноразовые шорты', variant: 'Взрослый' }),
      entry('Одноразовые шорты — Детский', n => /шорт/.test(n) && /(^| )дет/.test(n), { base: 'Одноразовые шорты', variant: 'Детский' })
    ]],
    ['Полотенца', [
      entry('Полотенце', n => /полот/.test(n), { slot: true, base: 'Полотенце ', hint: 'каждая фирма — отдельный товар' })
    ]],
    ['Для бани', [
      entry('Веник для пара', n => /веник/.test(n)),
      entry('Зубная паста', n => /зубн/.test(n) && /паст/.test(n) && !isMisvak(n), { slot: true, base: 'Зубная паста ', hint: 'по фирмам' }),
      entry('Зубная паста Misvak', n => isMisvak(n)),
      entry('Зубная щётка', n => /щетк/.test(n), { slot: true, base: 'Зубная щётка ', hint: 'по фирмам' }),
      entry('Мочалка для тела', n => /мочал/.test(n), { slot: true, base: 'Мочалка ', hint: 'по фирмам' }),
      entry('Сидушка', n => /сидушк|сидень|подстил/.test(n)),
      entry('Бритва', n => /бритв|станок/.test(n)),
      entry('Тёрка-пилка для ног', n => /терк|пилк/.test(n)),
      entry('Мыло для бани', n => /(^| )мыл/.test(n), { slot: true, base: 'Мыло ', hint: 'по фирмам' }),
      entry('Одноразовый шампунь', n => /шампун/.test(n) && /одноразов/.test(n)),
      entry('Шампунь S', n => /шампун/.test(n) && sizeOf(n) === 'S' && !isShampooBrand(n) && !/одноразов/.test(n)),
      entry('Шампунь FORX MEN | M', n => /forx|форкс/.test(n) && sizeOf(n) === 'M'),
      entry('Шампунь FORX MEN | S', n => /forx|форкс/.test(n) && sizeOf(n) === 'S'),
      entry('Шампунь PRO SERIES', n => /pro ?series|про ?сер/.test(n)),
      entry('Шампунь VIKING FOR MEN', n => /viking|викинг/.test(n), { key: 'viking', mergeFrom: n => /ментол|menthol/.test(n) }),
      entry('Шампунь CLEAR | M', n => /clear|клир/.test(n) && sizeOf(n) === 'M'),
      entry('Шампунь CLEAR | S', n => /clear|клир/.test(n) && sizeOf(n) === 'S'),
      entry('Шампунь NIVEA | M', n => /nivea|нивея/.test(n) && /шампун/.test(n) && sizeOf(n) === 'M'),
      entry('AXE - Дезодорант', n => /(^| )(axe|акс)( |$)/.test(n)),
      entry('REXONA - Дезодорант', n => /rexona|рексона/.test(n))
    ]],
    ['Еда', [
      entry('Самса', n => /самс/.test(n)),
      entry('Шашлык', n => /шашлык/.test(n)),
      entry('Хлеб', n => /хлеб|(^| )нан( |$)|лепешк/.test(n))
    ]]
  ];
  const LAYOUT_ENTRIES = [];
  CATALOG_LAYOUT.forEach(([category, items], ci) => items.forEach((item, ii) => {
    LAYOUT_ENTRIES.push(Object.assign(item, {
      id: item.key || `${ci}.${ii}`, category, order: ci * 1000 + ii,
      words: normName(item.label).split(' ').filter(word => word.length > 1 && !['для', 'размер'].includes(word))
    }));
  }));
  const ENTRY_BY_ID = new Map(LAYOUT_ENTRIES.map(item => [item.id, item]));
  const FOOD_RE = /самс|шашлык|хлеб|(^| )нан( |$)|лепешк|лаваш|манты|плов|лагман|шаурм|донер|бургер|хот ?дог|пицц|сэндвич|сендвич|пирож|чучвар|пельмен|(^| )суп|салат|куриц|курин|котлет|колбас|сосиск|чипс|сухар|снек|орех|орешк|арахис|семечк|шоколад|конфет|печень|вафл|батончик|snickers|сникерс|twix|попкорн|еда/;
  const DRINK_RE = /вода|(^| )сок|cola|кола|pepsi|пепси|fanta|фанта|sprite|спрайт|mirinda|миринда|лимонад|энерг|напит|шоро|максым|чалап|жарма|айран|кымыз|квас|морс|компот|fuse|fuze|lipton/;
  const BATH_RE = /веник|шампун|мыл|гель|дезодор|дизодор|паст|щетк|мочал|бритв|сидушк|терк|пилк|шапк|тапоч|сланц|ковш|(^| )таз|масл|скраб|крем|салфет|расческ|бальзам|кондиционер|спрей|axe|rexona|nivea|clear|forx|viking/;

  function guessByName(n) {
    if (/шорт/.test(n)) return 'Шорты';
    if (/полот/.test(n)) return 'Полотенца';
    if (FOOD_RE.test(n)) return 'Еда';
    if (/(^| )чай|(^| )tea|кофе|coffee|3в1|3 в 1/.test(n) && !/fuse|fuze|lipton|ice/.test(n)) return 'Чай';
    if (/трус|носк|майк|футбол|халат|белье|одежд|размер/.test(n)) return 'Одежда';
    if (DRINK_RE.test(n)) return 'Напитки';
    if (BATH_RE.test(n)) return 'Для бани';
    return '';
  }
  // Category for a product that is not in the owner's list.
  function freeCategory(product) {
    const stored = storedCategory(product);
    const guess = guessByName(normName(product?.name));
    if (['Чай', 'Шорты', 'Полотенца', 'Еда'].includes(stored)) return stored; // chosen in V5, kept by Worker V10.19
    if (['Напитки', 'Одежда', 'Для бани'].includes(stored)) {
      // Without V10.19 the Worker keeps only the mapped category (Еда → Напитки…): the name tells the rest.
      if (['Чай', 'Шорты', 'Полотенца', 'Еда'].includes(guess) && SERVER_CATEGORY[guess] === stored) return guess;
      return stored;
    }
    return guess || 'Для бани';
  }

  // Assigns every product of the catalogue to an entry of the owner's list (or leaves it free).
  let layoutCache = { sig: '', plan: null };
  function layoutPlan() {
    const products = catalog();
    const sig = products.map(p => `${p.id}:${p.name}:${p.cat || p.category || ''}:${p.price}:${p.stock}`).join('|');
    if (layoutCache.sig === sig && layoutCache.plan) return layoutCache.plan;
    const byProduct = new Map();   // id -> { entry, rank, tag, merge }
    const taken = new Map();       // entry id -> product id
    const merges = [];             // { from, into }
    const prepared = products.map(product => {
      const n = normName(product.name);
      return { product, n, tokens: new Set(n.split(' ')) };
    });
    const candidates = [];
    for (const item of prepared) {
      for (const layoutEntry of LAYOUT_ENTRIES) {
        if (layoutEntry.slot || !layoutEntry.test(item.n)) continue;
        if (layoutEntry.mergeFrom && layoutEntry.mergeFrom(item.n)) continue;
        const exact = item.n === normName(layoutEntry.label) ? 2 : 0;
        const cover = layoutEntry.words.length ? layoutEntry.words.filter(word => item.tokens.has(word)).length / layoutEntry.words.length : 0;
        candidates.push({ item, layoutEntry, score: 1 + exact + cover });
      }
    }
    candidates.sort((a, b) => b.score - a.score
      || available(b.item.product) - available(a.item.product)
      || Number(a.item.product.id) - Number(b.item.product.id));
    for (const { item, layoutEntry } of candidates) {
      const id = Number(item.product.id);
      if (byProduct.has(id) || taken.has(layoutEntry.id)) continue;
      byProduct.set(id, { entry: layoutEntry, rank: 0 });
      taken.set(layoutEntry.id, id);
    }
    // Two products with the same name (the Worker strips «0.5 л» from names): the cheaper one is 0.5 л.
    for (const layoutEntry of LAYOUT_ENTRIES.filter(item => item.cheapestOf && !taken.has(item.id))) {
      const source = ENTRY_BY_ID.get(layoutEntry.cheapestOf);
      const pool = prepared.filter(item => source.test(item.n) && (!byProduct.has(Number(item.product.id)) || byProduct.get(Number(item.product.id)).entry === source));
      if (pool.length < 2) continue;
      const price = item => (item.product.price == null ? Infinity : Number(item.product.price));
      pool.sort((a, b) => price(a) - price(b) || Number(b.product.id) - Number(a.product.id));
      const small = pool[0], big = pool[pool.length - 1];
      if (price(small) === price(big)) continue;
      byProduct.set(Number(small.product.id), { entry: layoutEntry, rank: 0, tag: layoutEntry.tag });
      taken.set(layoutEntry.id, Number(small.product.id));
      if (taken.get(source.id) === Number(small.product.id)) { byProduct.set(Number(big.product.id), { entry: source, rank: 0 }); taken.set(source.id, Number(big.product.id)); }
    }
    // «VIKING … Ледяной ментол» is merged into «Шампунь VIKING FOR MEN» (owner's request).
    for (const layoutEntry of LAYOUT_ENTRIES.filter(item => item.mergeFrom)) {
      const sources = prepared.filter(item => !byProduct.has(Number(item.product.id)) && layoutEntry.test(item.n) && layoutEntry.mergeFrom(item.n));
      sources.forEach((item, index) => {
        const id = Number(item.product.id);
        if (!taken.has(layoutEntry.id)) {
          taken.set(layoutEntry.id, id);
          byProduct.set(id, { entry: layoutEntry, rank: 0, renameTo: layoutEntry.label });
        } else {
          byProduct.set(id, { entry: layoutEntry, rank: 1 + index, merge: true });
          merges.push({ from: id, into: taken.get(layoutEntry.id) });
        }
      });
    }
    // Slots take every remaining product of their kind, sorted by name.
    for (const layoutEntry of LAYOUT_ENTRIES.filter(item => item.slot)) {
      prepared.filter(item => !byProduct.has(Number(item.product.id)) && layoutEntry.test(item.n))
        .sort((a, b) => String(a.product.name).localeCompare(String(b.product.name), 'ru'))
        .forEach((item, index) => byProduct.set(Number(item.product.id), { entry: layoutEntry, rank: index }));
    }
    const renames = [];
    for (const [id, info] of byProduct) {
      const product = products.find(row => Number(row.id) === id);
      const n = normName(product?.name);
      const target = info.renameTo || (info.entry.renameTo ? info.entry.renameTo(n) : '');
      if (target && target !== product?.name && !info.merge) renames.push({ id, from: String(product?.name || ''), to: target });
    }
    for (const merge of merges) {
      const main = products.find(row => Number(row.id) === merge.into);
      const mainEntry = byProduct.get(merge.into)?.entry;
      if (main && mainEntry && main.name !== mainEntry.label && !renames.some(rename => rename.id === merge.into)) {
        renames.push({ id: merge.into, from: String(main.name || ''), to: mainEntry.label });
      }
    }
    const free = products.filter(product => !byProduct.has(Number(product.id)));
    const freeSorted = [...free].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
    const info = new Map();
    for (const product of products) {
      const id = Number(product.id);
      const placed = byProduct.get(id);
      if (placed) {
        info.set(id, { category: placed.entry.category, order: placed.entry.order + (placed.rank ? placed.rank / 1000 : 0), entry: placed.entry, tag: placed.tag || '', merge: !!placed.merge, listed: true });
      } else {
        const category = freeCategory(product);
        info.set(id, { category, order: CATEGORIES.indexOf(category) * 1000 + 900 + freeSorted.indexOf(product) / 1000, entry: null, tag: '', merge: false, listed: false });
      }
    }
    const missing = LAYOUT_ENTRIES.filter(item => !item.slot && !taken.has(item.id));
    const plan = { info, renames, merges, free, missing, taken };
    layoutCache = { sig, plan };
    return plan;
  }
  function productInfo(product) {
    return layoutPlan().info.get(Number(product?.id)) || { category: freeCategory(product), order: 99999, entry: null, tag: '', merge: false, listed: false };
  }

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

  // Display category: the owner's list first, then the name (never written to the base automatically).
  function suggestedCategory(product) {
    return productInfo(product).category;
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
      const info = productInfo(product);
      return {
        ...product,
        _poCategory: info.category,
        _poOrder: info.order,
        _poListed: info.listed,
        _poTag: info.tag,
        _poMerge: info.merge,
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
      manual: (a,b) => (a._poOrder ?? 99999) - (b._poOrder ?? 99999) || String(a.name || '').localeCompare(String(b.name || ''), 'ru'),
      name: (a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'ru'),
      stock: (a,b) => b._poStock - a._poStock || String(a.name||'').localeCompare(String(b.name||''),'ru'),
      sold: (a,b) => b._poSoldQty - a._poSoldQty || String(a.name||'').localeCompare(String(b.name||''),'ru'),
      revenue: (a,b) => b._poRevenue - a._poRevenue || String(a.name||'').localeCompare(String(b.name||''),'ru')
    };
    return result.sort(by[sortMode] || by.name);
  }

  function injectStyles() {
    if ($('#po-smart-inventory-style-v5')) return;
    const style = document.createElement('style');
    style.id = 'po-smart-inventory-style-v5';
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
      /* V4: premium card hierarchy + strict overflow protection */
      #productsView .po-si-mobile-cards{gap:12px;padding:1px 1px 14px}
      #productsView .po-si-mobile-product{position:relative;isolation:isolate;width:100%;max-width:100%;box-sizing:border-box;padding:14px;border:1px solid #9a7138;border-radius:18px;background:linear-gradient(145deg,rgba(28,20,10,.98) 0%,rgba(9,21,14,.98) 62%,rgba(7,13,10,.99) 100%);box-shadow:inset 0 1px 0 #fff0c51c,inset 0 -1px 0 #17a66b16,0 9px 22px #0007;overflow:hidden}
      #productsView .po-si-mobile-product:before{content:'';position:absolute;z-index:-1;top:0;left:12%;right:12%;height:2px;background:linear-gradient(90deg,transparent,#ffe18a,#d89b35,transparent);opacity:.9}
      #productsView .po-si-mobile-product:after{content:'';position:absolute;z-index:-1;right:-36px;top:35px;width:110px;height:110px;border-radius:50%;background:radial-gradient(circle,#d59b3020,transparent 70%);pointer-events:none}
      #productsView .po-si-mobile-product-head{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:9px;margin:1px 0 13px;min-width:0}
      #productsView .po-si-mobile-product-main{display:grid;grid-template-columns:46px minmax(0,1fr);align-items:center;gap:10px;min-width:0;width:100%}
      #productsView .po-si-mobile-product-icon{width:46px;height:46px;flex:0 0 46px;border:1px solid #9b7136;border-radius:13px;background:linear-gradient(145deg,#201606,#08130d);box-shadow:inset 0 1px #ffedbd1b,0 4px 12px #0006;color:#ffe3a0;font-size:22px}
      #productsView .po-si-mobile-product-main>div{display:block;min-width:0;width:100%;max-width:100%}
      #productsView .po-si-mobile-product-name{display:block;width:100%;max-width:100%;min-width:0;color:#fff2d7;font-size:clamp(14px,3.8vw,17px);font-weight:950;line-height:1.24;letter-spacing:.005em;white-space:normal;overflow-wrap:anywhere;word-break:normal;hyphens:auto}
      #productsView .po-si-mobile-product-sub{display:block;max-width:100%;margin-top:5px;color:#d0bd99;font-size:9px;line-height:1.35;white-space:normal;overflow-wrap:anywhere;word-break:normal}
      #productsView .po-si-mobile-product-number{display:inline-flex;align-items:center;justify-content:center;min-height:25px;padding:4px 7px;border:1px solid #654b26;border-radius:8px;background:#0e100b;color:#e4ca8e;font-size:9px;font-weight:900;white-space:nowrap}
      #productsView .po-si-mobile-category-note{max-width:100%;margin:0 0 10px;padding:9px 10px;border:1px solid #80612e;border-radius:10px;background:#211707;color:#f0d8a5;font-size:10px;line-height:1.45;white-space:normal;overflow-wrap:anywhere;word-break:normal}
      #productsView .po-si-mobile-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:0 0 9px;min-width:0}
      #productsView .po-si-mobile-metric{box-sizing:border-box;min-width:0;min-height:67px;padding:8px 4px;border:1px solid #286a48;border-radius:12px;background:linear-gradient(155deg,#082015,#09110c);box-shadow:inset 0 1px #dcffe10d;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:5px;text-align:center;overflow:hidden}
      #productsView .po-si-mobile-metric.sold{border-color:#3e668f;background:linear-gradient(155deg,#0c1b2c,#091018)}
      #productsView .po-si-mobile-metric.amount{border-color:#896629;background:linear-gradient(155deg,#281c08,#100e08)}
      #productsView .po-si-mobile-metric b{display:block;width:100%;max-width:100%;color:#91edb8;font-size:clamp(10px,2.9vw,13px);font-weight:950;line-height:1.15;white-space:normal;overflow-wrap:anywhere;word-break:break-word}
      #productsView .po-si-mobile-metric.sold b{color:#b5d5ff}
      #productsView .po-si-mobile-metric.amount b{color:#ffdf8a}
      #productsView .po-si-mobile-metric small{display:block;max-width:100%;color:#c9baa0;font-size:8px;line-height:1.2;white-space:normal;overflow-wrap:anywhere;word-break:normal}
      #productsView .po-si-mobile-prices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:0 0 10px;min-width:0}
      #productsView .po-si-mobile-price{box-sizing:border-box;min-width:0;max-width:100%;padding:9px 10px;border:1px solid #53442c;border-radius:11px;background:linear-gradient(145deg,#151209,#0d100b);overflow:hidden}
      #productsView .po-si-mobile-price small{display:block;max-width:100%;color:#c7b896;font-size:9px;line-height:1.25;white-space:normal;overflow-wrap:anywhere;word-break:normal}
      #productsView .po-si-mobile-price b{display:block;max-width:100%;margin-top:5px;color:#f3dfb5;font-size:13px;font-weight:950;line-height:1.2;white-space:normal;overflow-wrap:anywhere;word-break:break-word}
      #productsView .po-si-mobile-price.sale{border-color:#7e602e;background:linear-gradient(145deg,#211806,#100e08)}
      #productsView .po-si-mobile-price.sale b{color:#ffdf8a}
      #productsView .po-si-mobile-actions{max-width:100%;margin-top:2px;padding-top:9px;border-top:1px solid #69502b}
      #productsView .po-si-mobile-actions>summary{box-sizing:border-box;width:100%;min-height:43px;padding:10px 12px;border:1px solid #96703b;border-radius:11px;background:linear-gradient(110deg,#211808,#11140e);color:#ffe3a1;font-size:11px;font-weight:950;line-height:1.25;white-space:normal;overflow-wrap:anywhere}
      #productsView .po-si-mobile-actions[open]>summary{border-color:#d1a34e;background:linear-gradient(110deg,#35240c,#102118)}
      #productsView .po-si-mobile-actions-body{display:grid;grid-template-columns:minmax(0,1fr);gap:9px;min-width:0;padding:11px 1px 2px}
      #productsView .po-si-mobile-control-label{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;min-width:0;color:#e8d5b2;font-size:10px;font-weight:900;line-height:1.3;white-space:normal;overflow-wrap:anywhere}
      #productsView .po-si-mobile-control-label select,#productsView .po-si-mobile-control-label input{box-sizing:border-box;width:100%;min-width:0;max-width:100%;min-height:42px;padding:9px 11px;border:1px solid #72552e;border-radius:10px;background:#0c100c;color:#fff0d0;font-size:12px}
      #productsView .po-si-mobile-receipt{display:grid;grid-template-columns:minmax(0,1fr) 46px;gap:7px;min-width:0}
      #productsView .po-si-mobile-receipt button{width:46px;min-height:42px;border:1px solid #42a56c;border-radius:10px;background:linear-gradient(145deg,#0e3a24,#092015);color:#a4f2c2;font-size:20px;font-weight:950}
      #productsView .po-si-mobile-action-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;min-width:0}
      #productsView .po-si-mobile-action-grid .po-si-action{box-sizing:border-box;width:100%;min-width:0;min-height:42px;padding:8px 7px;border-color:#7b5c2f;border-radius:10px;background:#1b150b;color:#ffe1a0;font-size:10px;font-weight:900;line-height:1.25;white-space:normal;overflow-wrap:anywhere;word-break:normal}
      #productsView .po-si-save-cat{width:100%;max-width:100%;min-height:38px;padding:8px 9px;border-radius:9px;font-size:10px;line-height:1.3;white-space:normal;overflow-wrap:anywhere;word-break:normal}
      #productsView .po-si-review{box-sizing:border-box;width:100%;max-width:100%;min-width:0;white-space:normal;overflow-wrap:anywhere;word-break:normal}
      #productsView .po-si-review>span{min-width:0;max-width:100%}
      #productsView .po-si-detail-head{min-width:0;flex-wrap:wrap}
      #productsView .po-si-detail-head>div{flex:1 1 160px;min-width:0}
      #productsView .po-si-detail-title{white-space:normal;overflow-wrap:anywhere;word-break:normal}
      #productsView .po-si-tool-select{min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis}
      #productsView #inventoryKpis .po-si-kpi{min-width:0;overflow:hidden}
      #productsView #inventoryKpis .po-si-kpi small,#productsView #inventoryKpis .po-si-kpi strong,#productsView #inventoryKpis .po-si-kpi-note{max-width:100%;white-space:normal;overflow-wrap:anywhere;word-break:normal}
      @media(max-width:390px){
        #productsView .po-si-mobile-product{padding:11px;border-radius:15px}
        #productsView .po-si-mobile-product-main{grid-template-columns:40px minmax(0,1fr);gap:8px}
        #productsView .po-si-mobile-product-icon{width:40px;height:40px;font-size:20px}
        #productsView .po-si-mobile-product-name{font-size:14px}
        #productsView .po-si-mobile-metrics{gap:4px}
        #productsView .po-si-mobile-metric{min-height:62px;padding:7px 3px}
        #productsView .po-si-mobile-metric b{font-size:10px}
        #productsView .po-si-mobile-metric small{font-size:7.5px}
        #productsView .po-si-mobile-price{padding:8px}
        #productsView .po-si-mobile-price small{font-size:8px}
        #productsView .po-si-mobile-price b{font-size:12px}
      }
      @media(max-width:340px){
        #productsView .po-si-mobile-metrics{grid-template-columns:1fr 1fr}
        #productsView .po-si-mobile-metric.amount{grid-column:1 / -1;min-height:54px}
        #productsView .po-si-mobile-prices{grid-template-columns:1fr}
        #productsView .po-si-mobile-product-head{grid-template-columns:minmax(0,1fr) auto}
      }
      @media(min-width:701px){#productsView .po-si-mobile-product{display:none!important}}
      /* V5 · catalogue order */
      #productsView .po-co-link{display:grid;grid-template-columns:38px minmax(0,1fr) 16px;align-items:center;gap:10px;width:100%;margin:12px 0 4px;padding:11px 12px;border:1px solid #5d4626;border-radius:14px;background:linear-gradient(120deg,#16110a,#0b120d);color:#f3e2bf;text-align:left}
      #productsView .po-co-link>span:first-child{display:grid;place-items:center;width:38px;height:38px;border:1px solid #8a6630;border-radius:11px;background:#120d06;color:#ffd36d;font-size:17px}
      #productsView .po-co-link b{display:block;color:#fff0cf;font-size:12px;line-height:1.3}
      #productsView .po-co-link small{display:block;margin-top:2px;color:#bfae8e;font-size:9.5px;line-height:1.35}
      #productsView .po-co-link i{font-style:normal;color:#f5c85b;font-size:22px;line-height:1}
      #productsView .po-co-free button{display:inline;margin:0;padding:0;border:0;background:none;color:#ffd36d;font:inherit;font-weight:900;text-decoration:underline;text-underline-offset:2px}
      #productsView .po-co-banner{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 11px;align-items:center;margin:0 0 10px;padding:12px 13px;border:1px solid #a87a2f;border-radius:15px;background:linear-gradient(120deg,#2a1d08 0%,#15130b 58%,#0b170f 100%);box-shadow:inset 0 1px #ffe2a020,0 8px 18px #0006;color:#f3e2bf}
      #productsView .po-co-banner-mark{grid-row:1 / span 2;display:grid;place-items:center;width:38px;height:38px;border:1px solid #c79a45;border-radius:12px;background:#120d06;color:#ffd36d;font-size:19px}
      #productsView .po-co-banner strong{font-size:12px;line-height:1.3;color:#fff0cf}
      #productsView .po-co-banner small{font-size:10px;line-height:1.45;color:#cdbb97}
      #productsView .po-co-banner button{grid-column:1 / -1;margin-top:7px;min-height:42px;border:1px solid #f0c45f;border-radius:11px;background:linear-gradient(135deg,#9a620e,#ffd36c);color:#261705;font-size:11px;font-weight:950}
      .po-co-tag{display:inline-block;margin-left:6px;padding:1px 6px;border:1px solid #b8893a;border-radius:7px;background:#1d1507;color:#ffd77c;font-size:.72em;font-weight:900;line-height:1.5;vertical-align:.12em;white-space:nowrap}
      #productsView .po-co-free{margin:0 0 10px;padding:8px 10px;border:1px dashed #9a7436;border-radius:10px;background:#1a1307;color:#ebd5a6;font-size:10px;line-height:1.45}
      #productsView .po-co-missing{margin:12px 0 0;border:1px solid #5c4422;border-radius:14px;background:linear-gradient(145deg,#130f08,#0a100b)}
      #productsView .po-co-missing>summary{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:44px;padding:10px 12px;color:#ffe0a0;font-size:11px;font-weight:950;list-style:none;cursor:pointer}
      #productsView .po-co-missing>summary::-webkit-details-marker{display:none}
      #productsView .po-co-missing>summary small{color:#bfae8e;font-weight:700}
      #productsView .po-co-missing-list{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 12px}
      .po-co-chip{display:inline-flex;align-items:center;gap:5px;min-height:34px;max-width:100%;padding:6px 10px;border:1px dashed #8d6b35;border-radius:10px;background:#120e07;color:#f6deaa;font-size:10px;font-weight:850;line-height:1.25;text-align:left;overflow-wrap:anywhere}
      .po-co-chip i{font-style:normal;color:#7fe9ad;font-size:14px;line-height:1}
      .po-co-chip.slot{border-style:solid;border-color:#2f7651;background:#0b1d13;color:#b8f2cf}
      #poCatalogOrderModal .modal-card{max-width:620px;max-height:min(90vh,920px);overflow:auto;overscroll-behavior:contain}
      #poCatalogOrderModal .po-co-lead{margin:2px 0 12px;color:#cdbd9c;font-size:11px;line-height:1.5}
      #poCatalogOrderModal .po-co-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:0 0 12px}
      #poCatalogOrderModal .po-co-stat{min-width:0;padding:9px 6px;border:1px solid #4f3b22;border-radius:12px;background:linear-gradient(150deg,#141008,#09110c);text-align:center}
      #poCatalogOrderModal .po-co-stat b{display:block;color:#ffdc84;font-size:18px;line-height:1.1}
      #poCatalogOrderModal .po-co-stat.ok b{color:#86ecb3}
      #poCatalogOrderModal .po-co-stat small{display:block;margin-top:4px;color:#c3b394;font-size:9px;line-height:1.25}
      #poCatalogOrderModal .po-co-warn{margin:0 0 12px;padding:10px 12px;border:1px solid #b5663a;border-radius:12px;background:#2a1309;color:#ffd9bd;font-size:11px;line-height:1.5}
      #poCatalogOrderModal .po-co-section{margin:0 0 12px;padding:12px;border:1px solid #4d3a22;border-radius:14px;background:#0d0b07}
      #poCatalogOrderModal .po-co-section>h3{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 0 4px;color:#fff0cf;font:700 15px/1.25 Georgia,serif}
      #poCatalogOrderModal .po-co-section>h3 small{font:800 10px/1 system-ui,sans-serif;color:#cdb98f}
      #poCatalogOrderModal .po-co-section>p{margin:0 0 9px;color:#bfae8e;font-size:10px;line-height:1.5}
      #poCatalogOrderModal .po-co-row{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;padding:9px 0;border-top:1px solid #2b2216}
      #poCatalogOrderModal .po-co-row:first-of-type{border-top:0}
      #poCatalogOrderModal .po-co-row-name{color:#fff0d2;font-size:12px;font-weight:900;line-height:1.3;overflow-wrap:anywhere}
      #poCatalogOrderModal .po-co-row-meta{color:#b9a98a;font-size:9px;line-height:1.4}
      #poCatalogOrderModal .po-co-row select{width:100%;min-height:40px;padding:8px 10px;border:1px solid #6a4f2b;border-radius:10px;background:#100d08;color:#ffe8bd;font-size:11px}
      #poCatalogOrderModal .po-co-row.is-off .po-co-row-name{color:#a59577;text-decoration:line-through}
      #poCatalogOrderModal .po-co-check{display:grid;grid-template-columns:24px minmax(0,1fr);gap:9px;align-items:start;padding:9px 0;border-top:1px solid #2b2216;color:#f1dfbd;font-size:11px;line-height:1.4}
      #poCatalogOrderModal .po-co-check:first-of-type{border-top:0}
      #poCatalogOrderModal .po-co-check input{width:20px;height:20px;margin:1px 0 0;accent-color:#e9b84f}
      #poCatalogOrderModal .po-co-check b{color:#fff0cf}
      #poCatalogOrderModal .po-co-arrow{color:#ffcf63;font-weight:900}
      #poCatalogOrderModal .po-co-block{color:#e9a985}
      #poCatalogOrderModal .po-co-group{margin:8px 0 2px;color:#e6c77f;font-size:10px;font-weight:950}
      #poCatalogOrderModal .po-co-missing-list{display:flex;flex-wrap:wrap;gap:6px}
      #poCatalogOrderModal .po-co-archived{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;padding:8px 0;border-top:1px solid #2b2216}
      #poCatalogOrderModal .po-co-archived:first-of-type{border-top:0}
      #poCatalogOrderModal .po-co-archived button{min-height:36px;padding:6px 11px;border:1px solid #3c9a67;border-radius:9px;background:#0b2a1b;color:#9bf0bd;font-size:10px;font-weight:900}
      #poCatalogOrderModal .po-co-quick{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 6px}
      #poCatalogOrderModal .po-co-quick button{min-height:32px;padding:5px 10px;border:1px solid #5d4626;border-radius:9px;background:#17110a;color:#f0d7a3;font-size:10px;font-weight:850}
      #poCatalogOrderModal .po-co-foot{position:sticky;bottom:-1px;display:grid;grid-template-columns:1fr 1.5fr;gap:8px;margin:14px -2px -2px;padding:10px 2px 2px;background:linear-gradient(180deg,transparent,#0b0906 28%)}
      #poCatalogOrderModal .po-co-foot button{min-height:48px}
      #poCatalogOrderModal .po-co-progress{margin:0 0 12px;padding:10px 12px;border:1px solid #2f7651;border-radius:12px;background:#0b1d13;color:#b8f2cf;font-size:11px;line-height:1.5}
      #poCatalogOrderModal .po-co-progress.bad{border-color:#a5553a;background:#281108;color:#ffcfb5}
      #poCatalogOrderModal .po-co-progress ul{margin:6px 0 0;padding-left:16px}
      @media(max-width:420px){#poCatalogOrderModal .po-co-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(prefers-reduced-motion:reduce){#productsView .po-co-banner,#poCatalogOrderModal *{transition:none!important;animation:none!important}}

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
        add.addEventListener('click', () => openSmartProductModal());
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
    const options = CATEGORIES.map(category => `<option value="${esc(category)}">${esc(category)}</option>`).join('');
    // Do not rewrite the options when they are already correct. This keeps
    // MutationObserver callbacks idempotent and avoids needless DOM work.
    if (select.innerHTML !== options) select.innerHTML = options;
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
      select.innerHTML = sizeOptions();
    } else {
      wrap.hidden = true;
      select.innerHTML = '';
    }
  }

  function sizeOptions() {
    return [...CLOTHING_SIZES, 'Без размера'].map(size => `<option value="${size}">${size}</option>`).join('');
  }

  // prefill: { category, name, variant } — used by the empty places of the owner's list.
  function openSmartProductModal(prefill = null) {
    ensureSmartModal();
    const form = $('#poSmartProductForm');
    form.reset();
    $('#poSiStock').value = '0';
    fillCategorySelect($('#poSiCategory'));
    if (prefill && CATEGORIES.includes(prefill.category)) $('#poSiCategory').value = prefill.category;
    updateVariantControl();
    if (prefill?.name) $('#poSiName').value = prefill.name;
    if (prefill?.variant && !$('#poSiVariantWrap').hidden) {
      const select = $('#poSiVariant');
      if ([...select.options].some(option => option.value === prefill.variant)) select.value = prefill.variant;
    }
    $('#poSmartProductModal').classList.add('open');
    const focusTarget = prefill?.name ? $('#poSiPrice') : $('#poSiName');
    focusTarget?.focus({ preventScroll: true });
  }

  function composeProductName(baseName, category, variant) {
    if (!variant || variant === 'Без размера') return baseName;
    if (category === 'Одежда') return `${baseName} — размер ${variant}`;
    return `${baseName} — ${variant}`;
  }

  function productPayload(name, category, price, costPrice) {
    const payload = { name, category: SERVER_CATEGORY[category] || 'Для бани', price, displayCategory: category };
    if (role() === 'admin') payload.costPrice = costPrice;
    return payload;
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
    const name = composeProductName(baseName, category, variant);
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
      const payload = productPayload(name, category, price, costPrice);
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
      let options = '';
      if (category === 'Шорты') {
        wrap.hidden = false;
        if (wrap.firstChild.textContent !== 'Тип шорт') wrap.firstChild.textContent = 'Тип шорт';
        options = '<option value="Взрослый">Взрослый</option><option value="Детский">Детский</option>';
      } else if (category === 'Одежда') {
        wrap.hidden = false;
        if (wrap.firstChild.textContent !== 'Размер одежды') wrap.firstChild.textContent = 'Размер одежды';
        options = sizeOptions();
      } else {
        wrap.hidden = true;
      }
      if (select.innerHTML !== options) select.innerHTML = options;
    };
    // Watch only when openAdd replaces the modal card's direct content. The
    // enhancer mutates nested <select> elements; subtree:true observed those
    // very mutations and recursively called enhance forever, freezing the UI.
    const observerRoot = $('#addModalCard') || root;
    new MutationObserver(records => {
      if (records.some(record => record.type === 'childList' && record.target === observerRoot)) enhance();
    }).observe(observerRoot, { childList: true, subtree: false });
    enhance();
  }

  async function createCatalogProductSmart() {
    if (!['admin', 'staff'].includes(role())) { toast('Добавлять товары может только администратор или сотрудник.'); return; }
    const baseName = String($('#newProductName')?.value || '').trim().replace(/\s+/g, ' ');
    const category = $('#newProductCategory')?.value || '';
    const variant = $('#poLegacyVariantWrap')?.hidden ? '' : String($('#poLegacyVariant')?.value || '').trim();
    const name = composeProductName(baseName, category, variant);
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
      const payload = productPayload(name, category, price, costPrice);
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
    if (typeof addProductCategory !== 'undefined' && addProductCategory !== 'Все' && !CATEGORIES.includes(addProductCategory)) addProductCategory = 'Все';
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
    const rows = catalog()
      .filter(product => addProductCategory === 'Все' || suggestedCategory(product) === addProductCategory)
      .sort((a, b) => productInfo(a).order - productInfo(b).order || String(a.name || '').localeCompare(String(b.name || ''), 'ru'));
    if (!rows.length) {
      root.innerHTML = '<div class="add-products-empty">В этой категории пока нет товаров.</div>';
      return;
    }
    root.innerHTML = rows.map(product => `
      <article class="add-product-tile">
        <button type="button" class="add-product" data-po-product="${Number(product.id)}">
          ${typeof productPhotoMarkup === 'function' ? productPhotoMarkup(product, 'picker-photo') : ''}
          <span><b>${esc(product.name)}${productInfo(product).tag ? `<span class="po-co-tag">${esc(productInfo(product).tag)}</span>` : ''}</b><small>${product.price == null ? 'Цена не указана' : safeMoney(product.price)} · остаток ${available(product)} шт.</small></span>
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

  // Worker capabilities (V10.19 adds catalogue archive and displayCategory). Read from /api/health.
  const features = { archive: false, displayCategory: false, known: false, promise: null };
  function loadFeatures(force = false) {
    if (features.promise && !force) return features.promise;
    features.promise = (async () => {
      try {
        const health = await api('/api/health');
        const list = Array.isArray(health?.features) ? health.features : [];
        features.archive = list.includes('catalog-archive');
        features.displayCategory = list.includes('display-category');
      } catch (_) {
        features.archive = false;
        features.displayCategory = false;
      }
      features.known = true;
      return features;
    })();
    return features.promise;
  }

  // Only products outside the owner's list choose their category by hand.
  async function changeCategory(productId, category, select) {
    const product = catalog().find(row => Number(row.id) === Number(productId));
    if (!product || !CATEGORIES.includes(category)) return;
    if (!['admin', 'staff'].includes(role())) { toast('Нет прав для изменения категории.'); return; }
    const previous = suggestedCategory(product);
    if (previous === category) return;
    if (select) select.disabled = true;
    try {
      await loadFeatures();
      const server = SERVER_CATEGORY[category];
      const body = features.displayCategory ? { category: server, displayCategory: category } : { category: server };
      await api(`/api/admin/products/${Number(product.id)}`, { method: 'PATCH', body: JSON.stringify(body) });
      product.cat = features.displayCategory ? category : server;
      product.category = product.cat;
      if (typeof saveLocal === 'function') saveLocal();
      const now = suggestedCategory(product);
      toast(now === category
        ? `«${product.name}» перенесён в «${category}» ✅`
        : `Сохранено как «${server}». Категория «${category}» сохранится после обновления Worker до V10.19.`);
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
      const category = product._poCategory;
      const canEdit = ['admin', 'staff'].includes(role());
      const purchase = product.costPrice != null ? safeMoney(product.costPrice) : 'Не указана';
      const price = product.price == null ? '—' : safeMoney(product.price);
      const categoryControl = canEdit && !product._poListed ? `
        <label class="po-si-mobile-control-label">Категория товара
          <select data-po-category="${id}" aria-label="Категория товара ${esc(product.name)}">${categoryOptions(category)}</select>
        </label>` : `<div class="po-si-mobile-product-sub">Категория: ${esc(category)}${product._poListed ? ' · место по вашему списку' : ''}</div>`;
      const inventoryControls = canEdit ? `
        <label class="po-si-mobile-control-label">Добавить поступление, шт.
          <span class="po-si-mobile-receipt"><input type="number" id="po-si-mobile-incoming-${id}" min="1" step="1" inputmode="numeric" placeholder="Количество"><button type="button" data-po-receive="${id}" aria-label="Добавить поступление для ${esc(product.name)}">＋</button></span>
        </label>
        <div class="po-si-mobile-action-grid">
          ${role() === 'admin' ? `<button type="button" class="po-si-action" data-po-edit-stock="${id}">Изменить остаток</button>` : ''}
          <button type="button" class="po-si-action" data-po-edit-price="${id}">Изменить цену продажи</button>
          ${canSeeCost ? `<button type="button" class="po-si-action" data-po-edit-cost="${id}">Изменить закупочную цену</button>` : ''}
          <button type="button" class="po-si-action" data-po-edit-name="${id}">Изменить название</button>
        </div>` : '<div class="history-meta">Только просмотр</div>';
      return `<article class="po-si-mobile-product" data-po-mobile-product="${id}">
        <div class="po-si-mobile-product-head">
          <div class="po-si-mobile-product-main">
            <span class="po-si-mobile-product-icon" aria-hidden="true">${CATEGORY_META[category]?.icon || '📦'}</span>
            <div>
              <div class="po-si-mobile-product-name">${esc(product.name)}${product._poTag ? `<span class="po-co-tag">${esc(product._poTag)}</span>` : ''}</div>
              <span class="po-si-mobile-product-sub">${esc(category)} · товар №${id}${product._poListed ? '' : ' · нет в списке'}</span>
            </div>
          </div>
          <span class="po-si-mobile-product-number">${product._poStock > 0 ? 'В наличии' : 'Нет остатка'} · #${index + 1}</span>
        </div>
        ${role() === 'admin' && product._poMerge ? '<div class="po-co-free">Повтор «Шампунь VIKING FOR MEN» — объединяется в «Порядок каталога». <button type="button" data-po-open-order>Открыть</button></div>' : ''}
        ${role() === 'admin' && !product._poListed ? '<div class="po-co-free">Этого товара нет в вашем списке. <button type="button" data-po-open-order>Убрать или переименовать</button></div>' : ''}
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
          <summary><span>Управление товаром</span><span aria-hidden="true">⌄</span></summary>
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
      const category = product._poCategory;
      const selector = ['admin', 'staff'].includes(role()) && !product._poListed
        ? `<select class="po-si-category-select" data-po-category="${Number(product.id)}" aria-label="Категория товара ${esc(product.name)}">${categoryOptions(category)}</select>`
        : `<span>${esc(category)}</span>`;
      const stockActions = role() === 'admin' || role() === 'staff' ? `
        <div class="po-si-receipt"><input type="number" id="po-si-incoming-${Number(product.id)}" min="1" step="1" inputmode="numeric" placeholder="+шт." aria-label="Поступление ${esc(product.name)}"><button type="button" class="po-si-action" data-po-receive="${Number(product.id)}">＋</button></div>
        ${role() === 'admin' ? `<button type="button" class="po-si-action" data-po-edit-stock="${Number(product.id)}">Изменить остаток</button>` : ''}` : 'Только просмотр';
      return `<tr>
        <td>${index + 1}</td>
        <td class="po-si-name">${esc(product.name)}${product._poTag ? `<span class="po-co-tag">${esc(product._poTag)}</span>` : ''}${product._poListed ? '' : '<span class="po-si-product-sub">Нет в вашем списке</span>'}</td>
        <td class="po-si-stock">${product._poStock.toLocaleString('ru-RU')} шт.</td>
        ${canSeeCost ? `<td class="po-si-cost">${purchase}</td>` : ''}
        <td class="po-si-price">${price}</td>
        <td class="po-si-sold">${product._poSoldQty.toLocaleString('ru-RU')} шт.</td>
        <td class="po-si-revenue">${safeMoney(product._poRevenue)}</td>
        <td>${selector}</td>
        <td><details class="po-si-actions"><summary>Действия ▾</summary><div class="po-si-row-actions">${stockActions}
          ${['admin', 'staff'].includes(role()) ? `<button type="button" class="po-si-action" data-po-edit-price="${Number(product.id)}">Изменить цену</button><button type="button" class="po-si-action" data-po-edit-name="${Number(product.id)}">Изменить название</button>` : ''}
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
    return `${orderBanner()}
      ${dashboardTools()}
      <div class="po-si-categories">${cards}</div>
      ${role() === 'admin' ? `<button type="button" class="po-co-link" data-po-open-order><span aria-hidden="true">☰</span><span><b>Порядок каталога</b><small>Ваш список товаров, переименование, убранные товары</small></span><i aria-hidden="true">›</i></button>` : ''}`;
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
      ${categorySummary(filtered)}
      ${missingBlock(category)}`;
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
    $$('[data-po-edit-name]', root).forEach(button => button.addEventListener('click', () => editCatalogProduct(Number(button.dataset.poEditName), 'name')));
    $$('[data-po-add-entry]', root).forEach(button => button.addEventListener('click', () => addFromEntry(button.dataset.poAddEntry)));
    $$('[data-po-open-order]', root).forEach(button => button.addEventListener('click', openCatalogOrder));
  }

  /* ---------------- «Порядок каталога»: review and apply the owner's list ---------------- */
  function orderStore() {
    try { const data = JSON.parse(localStorage.getItem(ORDER_STORE) || '{}'); return data && typeof data === 'object' ? data : {}; }
    catch (_) { return {}; }
  }
  function saveOrderStore(data) {
    try { localStorage.setItem(ORDER_STORE, JSON.stringify(data)); } catch (_) {}
  }
  function receiptProductIds() {
    const archivedIds = new Set(Array.isArray(db?.archived) ? db.archived.map(String) : []);
    const ids = new Set();
    for (const client of clientRows()) {
      if (!client || client.archived || archivedIds.has(String(client.id))) continue;
      for (const item of Array.isArray(client.items) ? client.items : []) {
        if (item?.productId != null) ids.add(Number(item.productId));
      }
    }
    return ids;
  }
  // Why a product cannot be removed right now ('' = it can).
  function removeBlock(product, inReceipts) {
    const reserved = Math.max(0, Number(product?.reserved || 0));
    if (reserved > 0) return `резерв ${reserved} шт.`;
    if (inReceipts.has(Number(product?.id))) return 'есть в чеке клиента текущей смены';
    return '';
  }
  function freeDefault(product, store, inReceipts) {
    const id = Number(product.id);
    if (removeBlock(product, inReceipts)) return 'keep';
    if (Array.isArray(store.keep) && store.keep.map(Number).includes(id)) return 'keep';
    if (['Чай', 'Шорты', 'Полотенца', 'Еда'].includes(storedCategory(product))) return 'keep';
    if (Number(store.maxId) > 0 && id > Number(store.maxId)) return 'keep';
    return 'archive';
  }
  function orderTodo() {
    if (role() !== 'admin') return { total: 0, remove: 0, renames: 0, merges: 0 };
    const plan = layoutPlan();
    const store = orderStore();
    const inReceipts = receiptProductIds();
    const remove = plan.free.filter(product => freeDefault(product, store, inReceipts) === 'archive').length;
    return { total: remove + plan.renames.length + plan.merges.length, remove, renames: plan.renames.length, merges: plan.merges.length };
  }
  function orderBanner() {
    const todo = orderTodo();
    if (!todo.total) return '';
    const parts = [];
    if (todo.remove) parts.push(`${todo.remove} ${plural(todo.remove, 'товар', 'товара', 'товаров')} нет в вашем списке`);
    if (todo.renames) parts.push(`${todo.renames} ${plural(todo.renames, 'переименование', 'переименования', 'переименований')}`);
    if (todo.merges) parts.push(`${todo.merges} ${plural(todo.merges, 'объединение', 'объединения', 'объединений')}`);
    return `<div class="po-co-banner"><span class="po-co-banner-mark" aria-hidden="true">☰</span><strong>Каталог по вашему списку</strong><small>${esc(parts.join(' · '))}. Ничего не меняется без вашего подтверждения.</small><button type="button" data-po-open-order>Навести порядок</button></div>`;
  }
  function plural(n, one, few, many) {
    const a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many;
    if (b > 1 && b < 5) return few;
    if (b === 1) return one;
    return many;
  }
  function entryPrefill(layoutEntry) {
    if (layoutEntry.slot) return { category: layoutEntry.category, name: layoutEntry.base };
    if (layoutEntry.base) return { category: layoutEntry.category, name: layoutEntry.base, variant: layoutEntry.variant };
    return { category: layoutEntry.category, name: layoutEntry.label };
  }
  function addFromEntry(entryId) {
    const layoutEntry = ENTRY_BY_ID.get(String(entryId));
    if (!layoutEntry) return;
    if (!['admin', 'staff'].includes(role())) { toast('Добавлять товары может администратор или сотрудник.'); return; }
    closeCatalogOrder();
    openSmartProductModal(entryPrefill(layoutEntry));
  }
  function entryChip(layoutEntry) {
    return `<button type="button" class="po-co-chip${layoutEntry.slot ? ' slot' : ''}" data-po-add-entry="${esc(layoutEntry.id)}"><i>＋</i>${esc(layoutEntry.label)}${layoutEntry.slot ? ` <small>· ${esc(layoutEntry.hint || 'по фирмам')}</small>` : ''}</button>`;
  }
  function missingBlock(category) {
    if (!['admin', 'staff'].includes(role()) || !CATEGORIES.includes(category)) return '';
    const plan = layoutPlan();
    const missing = plan.missing.filter(layoutEntry => layoutEntry.category === category);
    const slots = LAYOUT_ENTRIES.filter(layoutEntry => layoutEntry.slot && layoutEntry.category === category);
    if (!missing.length && !slots.length) return '';
    return `<details class="po-co-missing">
      <summary><span>${missing.length ? `Нет в базе по вашему списку · ${missing.length}` : 'Добавить по фирмам'}</span><small>нажмите, чтобы добавить</small></summary>
      <div class="po-co-missing-list">${[...missing, ...slots].sort((a, b) => a.order - b.order).map(entryChip).join('')}</div>
    </details>`;
  }

  let orderState = null;
  function ensureOrderModal() {
    if ($('#poCatalogOrderModal')) return;
    const modal = document.createElement('div');
    modal.id = 'poCatalogOrderModal';
    modal.className = 'modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Порядок каталога');
    modal.innerHTML = '<div class="modal-card" id="poCatalogOrderCard"></div>';
    document.body.appendChild(modal);
    modal.addEventListener('click', event => {
      if (event.target === modal) { closeCatalogOrder(); return; }
      const target = event.target.closest?.('button');
      if (!target || orderState?.busy) return;
      if (target.matches('[data-co-close]')) closeCatalogOrder();
      else if (target.matches('[data-co-apply]')) applyCatalogOrder();
      else if (target.matches('[data-co-all]')) { setAllFree(target.dataset.coAll); }
      else if (target.matches('[data-co-restore]')) restoreProduct(Number(target.dataset.coRestore));
      else if (target.matches('[data-po-add-entry]')) addFromEntry(target.dataset.poAddEntry);
    });
    modal.addEventListener('change', event => {
      const field = event.target;
      if (!orderState || orderState.busy) return;
      if (field.matches('[data-co-free]')) { orderState.actions.set(Number(field.dataset.coFree), field.value); renderOrderModal(); }
      else if (field.matches('[data-co-rename]')) { field.checked ? orderState.renames.add(Number(field.dataset.coRename)) : orderState.renames.delete(Number(field.dataset.coRename)); renderOrderModal(); }
      else if (field.matches('[data-co-merge]')) { field.checked ? orderState.merges.add(Number(field.dataset.coMerge)) : orderState.merges.delete(Number(field.dataset.coMerge)); renderOrderModal(); }
    });
  }
  function closeCatalogOrder() {
    if (orderState?.busy) return;
    $('#poCatalogOrderModal')?.classList.remove('open');
  }
  function resetOrderState(log = null) {
    const plan = layoutPlan();
    const store = orderStore();
    const inReceipts = receiptProductIds();
    const actions = new Map();
    plan.free.forEach(product => {
      const action = freeDefault(product, store, inReceipts);
      actions.set(Number(product.id), action === 'archive' && features.known && !features.archive ? 'keep' : action);
    });
    orderState = {
      plan, inReceipts, actions,
      renames: new Set(plan.renames.map(rename => rename.id)),
      merges: new Set(plan.merges.map(merge => merge.from)),
      archived: orderState?.archived || null,
      busy: false, log, progress: ''
    };
  }
  async function openCatalogOrder() {
    if (role() !== 'admin') { toast('«Порядок каталога» доступен администратору.'); return; }
    ensureOrderModal();
    const known = features.known;
    resetOrderState();
    renderOrderModal();
    $('#poCatalogOrderModal').classList.add('open');
    await loadFeatures(true);
    if (!known) resetOrderState(); // defaults depend on what the Worker can do
    else if (!features.archive && orderState) {
      // Old Worker: nothing can be removed yet, so no row pretends it will be.
      for (const [id, action] of orderState.actions) if (action === 'archive') orderState.actions.set(id, 'keep');
    }
    await loadArchived();
    renderOrderModal();
  }
  async function loadArchived() {
    if (!features.archive) { if (orderState) orderState.archived = null; return; }
    try {
      const result = await api('/api/admin/products/archived');
      if (orderState) orderState.archived = Array.isArray(result?.products) ? result.products : [];
    } catch (_) { if (orderState) orderState.archived = null; }
  }
  function setAllFree(value) {
    if (!orderState) return;
    for (const product of orderState.plan.free) {
      if (value === 'archive' && removeBlock(product, orderState.inReceipts)) continue;
      orderState.actions.set(Number(product.id), value);
    }
    renderOrderModal();
  }
  function targetName(product, action) {
    const layoutEntry = ENTRY_BY_ID.get(action.slice(6));
    if (!layoutEntry) return '';
    if (!layoutEntry.slot) return layoutEntry.label;
    return layoutEntry.test(normName(product.name)) ? '' : `${layoutEntry.base}${product.name}`.replace(/\s+/g, ' ').trim();
  }
  function plannedSteps() {
    if (!orderState) return [];
    const { plan } = orderState;
    const byId = id => catalog().find(product => Number(product.id) === Number(id));
    const steps = [];
    for (const rename of plan.renames) {
      if (orderState.renames.has(rename.id)) steps.push({ kind: 'rename', id: rename.id, label: `«${rename.from}» → «${rename.to}»`, to: rename.to });
    }
    for (const merge of plan.merges) {
      const from = byId(merge.from), into = byId(merge.into);
      if (from && into && orderState.merges.has(merge.from) && features.archive) steps.push({ kind: 'merge', merge, label: `«${from.name}» → в «${into.name}»` });
    }
    for (const product of plan.free) {
      const action = orderState.actions.get(Number(product.id)) || 'keep';
      if (action.startsWith('entry:')) {
        const to = targetName(product, action);
        if (to && to !== product.name) steps.push({ kind: 'rename', id: Number(product.id), label: `«${product.name}» → «${to}»`, to });
      }
    }
    for (const product of plan.free) {
      if ((orderState.actions.get(Number(product.id)) || 'keep') === 'archive' && features.archive) {
        steps.push({ kind: 'archive', id: Number(product.id), label: `убрать «${product.name}»` });
      }
    }
    return steps;
  }
  function freeOptions(product, action) {
    const blocked = removeBlock(product, orderState.inReceipts);
    const archiveDisabled = !features.archive || !!blocked;
    const plan = orderState.plan;
    const used = new Set([...orderState.actions.values()].filter(value => value.startsWith('entry:')));
    let html = `<option value="archive"${action === 'archive' ? ' selected' : ''}${archiveDisabled ? ' disabled' : ''}>Убрать из каталога${blocked ? ` (нельзя: ${esc(blocked)})` : (!features.archive ? ' (нужен Worker V10.19)' : '')}</option>`;
    html += `<option value="keep"${action === 'keep' ? ' selected' : ''}>Оставить · в конце «${esc(suggestedCategory(product))}»</option>`;
    for (const [category] of CATALOG_LAYOUT) {
      const choices = LAYOUT_ENTRIES.filter(layoutEntry => layoutEntry.category === category && (layoutEntry.slot || plan.missing.includes(layoutEntry)));
      if (!choices.length) continue;
      html += `<optgroup label="Это товар из списка · ${esc(category)}">` + choices.map(layoutEntry => {
        const value = `entry:${layoutEntry.id}`;
        const takenByOther = !layoutEntry.slot && used.has(value) && action !== value;
        return `<option value="${esc(value)}"${action === value ? ' selected' : ''}${takenByOther ? ' disabled' : ''}>${esc(layoutEntry.slot ? `${layoutEntry.label} (${layoutEntry.hint || 'по фирмам'})` : layoutEntry.label)}</option>`;
      }).join('') + '</optgroup>';
    }
    return html;
  }
  function renderOrderModal() {
    const card = $('#poCatalogOrderCard');
    if (!card || !orderState) return;
    const { plan } = orderState;
    const listedCount = catalog().length - plan.free.length;
    const steps = plannedSteps();
    const removeCount = steps.filter(step => step.kind === 'archive').length;
    const renameCount = steps.filter(step => step.kind === 'rename').length + steps.filter(step => step.kind === 'merge').length;
    const freeRows = plan.free.map(product => {
      const id = Number(product.id);
      const action = orderState.actions.get(id) || 'keep';
      const to = action.startsWith('entry:') ? targetName(product, action) : '';
      const meta = [`остаток ${available(product)} шт.`, product.price == null ? 'без цены' : safeMoney(product.price), `№${id}`];
      const blocked = removeBlock(product, orderState.inReceipts);
      return `<div class="po-co-row${action === 'archive' ? ' is-off' : ''}">
        <div><div class="po-co-row-name">${esc(product.name)}</div><div class="po-co-row-meta">${esc(meta.join(' · '))}${blocked ? ` · <span class="po-co-block">${esc(blocked)}</span>` : ''}${to ? ` · станет «${esc(to)}»` : ''}</div></div>
        <select data-co-free="${id}" aria-label="Что сделать с «${esc(product.name)}»">${freeOptions(product, action)}</select>
      </div>`;
    }).join('');
    const renameRows = plan.renames.map(rename => `<label class="po-co-check"><input type="checkbox" data-co-rename="${rename.id}"${orderState.renames.has(rename.id) ? ' checked' : ''}><span>«${esc(rename.from)}» <span class="po-co-arrow">→</span> <b>«${esc(rename.to)}»</b></span></label>`).join('');
    const byId = id => catalog().find(product => Number(product.id) === Number(id));
    const mergeRows = plan.merges.map(merge => {
      const from = byId(merge.from), into = byId(merge.into);
      if (!from || !into) return '';
      const reserved = Math.max(0, Number(from.reserved || 0));
      const move = Math.max(0, Number(from.stock || 0) - reserved);
      return `<label class="po-co-check"><input type="checkbox" data-co-merge="${merge.from}"${orderState.merges.has(merge.from) ? ' checked' : ''}${features.archive ? '' : ' disabled'}><span>«${esc(from.name)}» <span class="po-co-arrow">→</span> <b>«${esc(into.name)}»</b><br><small>Остаток ${move} шт. переходит в основной товар, повтор убирается из каталога. История продаж сохраняется.</small></span></label>`;
    }).join('');
    const missingGroups = CATALOG_LAYOUT.map(([category]) => {
      const list = plan.missing.filter(layoutEntry => layoutEntry.category === category);
      return list.length ? `<div class="po-co-group">${esc(category)} · ${list.length}</div><div class="po-co-missing-list">${list.map(entryChip).join('')}</div>` : '';
    }).join('');
    const archived = Array.isArray(orderState.archived) ? orderState.archived : null;
    const log = orderState.log;
    card.innerHTML = `
      <div class="modal-head"><div><div class="eyebrow">PAR ORDO · КАТАЛОГ</div><h2>Порядок каталога</h2></div><button class="close" type="button" data-co-close aria-label="Закрыть">×</button></div>
      <p class="po-co-lead">Категории и порядок товаров уже стоят по вашему списку. Здесь — то, что меняет базу. Ничего не изменится, пока вы не нажмёте «Применить».</p>
      <div class="po-co-stats">
        <div class="po-co-stat ok"><b>${listedCount}</b><small>на своём месте</small></div>
        <div class="po-co-stat"><b>${removeCount}</b><small>убрать</small></div>
        <div class="po-co-stat"><b>${renameCount}</b><small>переименовать / объединить</small></div>
        <div class="po-co-stat"><b>${plan.missing.length}</b><small>нет в базе</small></div>
      </div>
      ${features.archive ? '' : '<div class="po-co-warn"><b>Чтобы убирать товары, обновите Worker:</b> вставьте в конец кода дополнение <b>V10.19</b>. Переименование работает уже сейчас.</div>'}
      ${orderState.progress ? `<div class="po-co-progress">${esc(orderState.progress)}</div>` : ''}
      ${log ? `<div class="po-co-progress${log.errors.length ? ' bad' : ''}">Готово: ${log.done} из ${log.total}.${log.errors.length ? `<ul>${log.errors.map(error => `<li>${esc(error)}</li>`).join('')}</ul>` : ' Каталог обновлён ✅'}</div>` : ''}
      ${plan.free.length ? `<section class="po-co-section"><h3>Нет в вашем списке <small>${plan.free.length}</small></h3>
        <p>Для каждого выберите: убрать, оставить или указать, какой это товар из списка — тогда он получит название из списка и встанет на своё место. Убранный товар можно вернуть ниже, история продаж сохраняется.</p>
        <div class="po-co-quick"><button type="button" data-co-all="archive"${features.archive ? '' : ' disabled'}>Убрать все</button><button type="button" data-co-all="keep">Оставить все</button></div>
        ${freeRows}</section>` : ''}
      ${plan.renames.length ? `<section class="po-co-section"><h3>Переименовать <small>${plan.renames.length}</small></h3>${renameRows}</section>` : ''}
      ${plan.merges.length ? `<section class="po-co-section"><h3>Объединить <small>${plan.merges.length}</small></h3>${mergeRows}</section>` : ''}
      ${plan.missing.length ? `<section class="po-co-section"><h3>Нет в базе <small>${plan.missing.length}</small></h3><p>Этих товаров из вашего списка пока нет в каталоге. Нажмите, чтобы добавить — с ценой и остатком.</p>${missingGroups}</section>` : ''}
      ${archived && archived.length ? `<section class="po-co-section"><h3>Убранные товары <small>${archived.length}</small></h3>${archived.map(product => `<div class="po-co-archived"><div><div class="po-co-row-name">${esc(product.name)}</div><div class="po-co-row-meta">остаток ${Math.max(0, Number(product.stock || 0))} шт. · №${Number(product.id)}</div></div><button type="button" data-co-restore="${Number(product.id)}">Вернуть</button></div>`).join('')}</section>` : ''}
      <div class="po-co-foot"><button type="button" class="ghost" data-co-close>Закрыть</button><button type="button" class="primary" data-co-apply${steps.length ? '' : ' disabled'}>${steps.length ? `Применить · ${steps.length}` : 'Нечего применять'}</button></div>`;
  }
  async function mergeProducts(merge) {
    const from = catalog().find(product => Number(product.id) === merge.from);
    const into = catalog().find(product => Number(product.id) === merge.into);
    if (!from || !into) throw new Error('товар не найден — обновите каталог');
    const reserved = Math.max(0, Number(from.reserved || 0));
    if (reserved > 0) throw new Error(`у «${from.name}» резерв ${reserved} шт.`);
    const move = Math.max(0, Number(from.stock || 0) - reserved);
    const intoStock = Number(into.stock || 0);
    if (move > 0) {
      await api(`/api/admin/products/${Number(into.id)}`, { method: 'PATCH', body: JSON.stringify({ stock: intoStock + move }) });
      try {
        await api(`/api/admin/products/${Number(from.id)}`, { method: 'PATCH', body: JSON.stringify({ stock: reserved }) });
      } catch (error) {
        await api(`/api/admin/products/${Number(into.id)}`, { method: 'PATCH', body: JSON.stringify({ stock: intoStock }) }).catch(() => {});
        throw error;
      }
      into.stock = intoStock + move;
      from.stock = reserved;
    }
    await api(`/api/admin/products/${Number(from.id)}/archive`, { method: 'POST', body: JSON.stringify({}) });
  }
  async function applyCatalogOrder() {
    if (!orderState || orderState.busy) return;
    const steps = plannedSteps();
    if (!steps.length) return;
    const removing = steps.filter(step => step.kind === 'archive' || step.kind === 'merge').length;
    if (removing && !window.confirm(`Применить ${steps.length} ${plural(steps.length, 'действие', 'действия', 'действий')}?\n\nИз каталога будет убрано: ${removing}. История продаж сохранится, убранный товар можно вернуть.`)) return;
    // Remember only the owner's own «Оставить»: rows that could not be removed (old Worker, reserve,
    // open receipt) are offered again later.
    const keep = !features.archive ? [] : orderState.plan.free
      .filter(product => orderState.actions.get(Number(product.id)) === 'keep' && !removeBlock(product, orderState.inReceipts))
      .map(product => Number(product.id));
    orderState.busy = true;
    orderState.log = null;
    const errors = [];
    let done = 0;
    for (const [index, step] of steps.entries()) {
      orderState.progress = `Выполняется ${index + 1} из ${steps.length}: ${step.label}`;
      renderOrderModal();
      try {
        if (step.kind === 'rename') await api(`/api/admin/products/${step.id}`, { method: 'PATCH', body: JSON.stringify({ name: step.to }) });
        else if (step.kind === 'merge') await mergeProducts(step.merge);
        else if (step.kind === 'archive') await api(`/api/admin/products/${step.id}/archive`, { method: 'POST', body: JSON.stringify({}) });
        done++;
      } catch (error) {
        errors.push(`${step.label}: ${error?.message || 'ошибка'}`);
      }
    }
    const store = orderStore();
    const maxId = catalog().reduce((max, product) => Math.max(max, Number(product.id) || 0), 0);
    saveOrderStore({ ...store, keep: [...new Set([...(Array.isArray(store.keep) ? store.keep.map(Number) : []), ...keep])], maxId: Math.max(Number(store.maxId) || 0, maxId), at: new Date().toISOString() });
    try { if (typeof loadProducts === 'function') await loadProducts(); } catch (_) {}
    await loadArchived();
    orderState.busy = false;
    resetOrderState({ done, total: steps.length, errors });
    renderInventory();
    renderOrderModal();
    toast(errors.length ? `Готово ${done} из ${steps.length}. Есть ошибки — смотрите список.` : 'Каталог приведён в порядок ✅');
  }
  async function restoreProduct(id) {
    if (!id || !orderState || orderState.busy) return;
    orderState.busy = true;
    orderState.progress = 'Возвращаем товар в каталог…';
    renderOrderModal();
    try {
      await api(`/api/admin/products/${id}/restore`, { method: 'POST', body: JSON.stringify({}) });
      const store = orderStore();
      saveOrderStore({ ...store, keep: [...new Set([...(Array.isArray(store.keep) ? store.keep.map(Number) : []), id])] });
      if (typeof loadProducts === 'function') await loadProducts();
      await loadArchived();
      toast('Товар возвращён в каталог ✅');
    } catch (error) {
      toast(`Не удалось вернуть товар: ${error?.message || 'ошибка'}`);
    }
    orderState.busy = false;
    resetOrderState(orderState.log);
    renderInventory();
    renderOrderModal();
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
    window.PARORDOSmartInventory = Object.freeze({
      version: VERSION, mobileCards: true, overflowSafeCards: true, categories: [...CATEGORIES],
      render: renderInventorySmart, totals: inventoryTotals, paidSalesByProduct, suggestedCategory,
      categoryOf: suggestedCategory, layout: () => CATALOG_LAYOUT.map(([category, items]) => ({ category, items: items.map(item => ({ id: item.id, label: item.label, slot: !!item.slot })) })),
      plan: () => { const plan = layoutPlan(); return { renames: plan.renames.slice(), merges: plan.merges.slice(), free: plan.free.map(product => Number(product.id)), missing: plan.missing.map(item => item.label) }; },
      openCatalogOrder, filters: ['all','in-stock','low-stock','out','sold'], sorting: ['manual','name','stock','sold','revenue']
    });
    loadFeatures();
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
