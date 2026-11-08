/*
 * PAR ORDO PRODUCT PHOTOS V6
 * Uses the real product image and brand-logo assets already present in assets/products/.
 * Safe add-on: no API calls, database writes, stock changes, or Worker/D1 changes.
 */
(() => {
  'use strict';
  if (window.PARORDOProductPhotos?.version === '6.0.0') return;

  const BASE = './assets/products/';
  const ASSETS = {
    coca: 'coca-cola.png', pepsi: 'pepsi.png', fanta: 'fanta.png',
    sprite: 'sprite.png', spriteMojito: 'sprite-mojito.png', water: 'water.png',
    shoroAralash: 'shoro-aralash.webp', shoroChalap: 'shoro-chalap.webp',
    shoroMaksym: 'shoro-maksym.webp', shoroTan: 'shoro-tan.webp',
    teaBlack: 'tea-black.png', teaGreen: 'tea-green.png', teaLemon: 'tea-lemon.png',
    shortsAdult: 'shorts-adult.png', shortsKids: 'shorts-kids.png',
    briefs: 'briefs.png', socks: 'socks.png', towel: 'towel.png', soap: 'soap.png',
    broom: 'broom.png'
  };
  const BRANDS = [
    [/adidas/i, 'brand-adidas.svg', 'Adidas'],
    [/\baxe\b/i, 'brand-axe.svg', 'Axe'],
    [/\bclear\b/i, 'brand-clear.svg', 'Clear'],
    [/deonica/i, 'brand-deonica.svg', 'Deonica'],
    [/\bdove\b/i, 'brand-dove.svg', 'Dove'],
    [/\bfa\b/i, 'brand-fa.svg', 'Fa'],
    [/\bforx\b/i, 'brand-forx.svg', 'Forx'],
    [/garnier/i, 'brand-garnier.svg', 'Garnier'],
    [/\blegend\b/i, 'brand-legend.svg', 'Legend'],
    [/\bnivea\b/i, 'brand-nivea.svg', 'Nivea'],
    [/old\s*spice/i, 'brand-old-spice.svg', 'Old Spice'],
    [/pro\s*series/i, 'brand-pro-series.svg', 'Pro Series'],
    [/rexona/i, 'brand-rexona.svg', 'Rexona'],
    [/шоро|shoro/i, 'brand-shoro.svg', 'Шоро'],
    [/viking/i, 'brand-viking.svg', 'Viking']
  ];

  const originalPhotoMarkup = typeof window.productPhotoMarkup === 'function'
    ? window.productPhotoMarkup.bind(window)
    : null;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function normalize(value) {
    return String(value || '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  function findBrand(name) {
    const value = normalize(name);
    return BRANDS.find(([pattern]) => pattern.test(value)) || null;
  }

  function productAsset(product) {
    const name = normalize(product?.name);
    const category = normalize(product?.cat || product?.category);

    // If a product already has its own explicit image, keep using it.
    const custom = [product?.image, product?.img, product?.photo, product?.imageUrl]
      .find(value => typeof value === 'string' && value.trim());
    if (custom) {
      const src = custom.trim();
      if (/^(https:\/\/|\.\/assets\/|assets\/)/i.test(src)) {
        return { src: src.startsWith('assets/') ? `./${src}` : src, direct: true };
      }
    }

    if (/sprite\s*mojito|спрайт\s*мохито|мохито\s*спрайт/.test(name)) return { src: BASE + ASSETS.spriteMojito };
    if (/coca[-\s]?cola|кока\s*кола|кока-кола|кола/.test(name)) return { src: BASE + ASSETS.coca };
    if (/\bpepsi\b|пепси/.test(name)) return { src: BASE + ASSETS.pepsi };
    if (/\bfanta\b|фанта/.test(name)) return { src: BASE + ASSETS.fanta };
    if (/\bsprite\b|спрайт/.test(name)) return { src: BASE + ASSETS.sprite };
    if (/шоро.*аралаш|аралаш.*шоро|\baralash\b/.test(name)) return { src: BASE + ASSETS.shoroAralash };
    if (/чалап|\bchalap\b/.test(name)) return { src: BASE + ASSETS.shoroChalap };
    if (/максым|\bmaksym\b|\bmaxsym\b/.test(name)) return { src: BASE + ASSETS.shoroMaksym };
    if (/тан\b|\btan\b/.test(name)) return { src: BASE + ASSETS.shoroTan };
    if (/лимон.*чай|чай.*лимон/.test(name)) return { src: BASE + ASSETS.teaLemon };
    if (/зелен.*чай|кок\s*чай|көк\s*чай|green\s*tea/.test(name)) return { src: BASE + ASSETS.teaGreen };
    if (/черн.*чай|кара\s*чай|қара\s*чай|black\s*tea/.test(name)) return { src: BASE + ASSETS.teaBlack };
    if (/шорт/.test(name) || category === 'шорты') {
      if (/дет|kids|ребен|ребенок/.test(name)) return { src: BASE + ASSETS.shortsKids };
      return { src: BASE + ASSETS.shortsAdult };
    }
    if (/трус|brief/.test(name)) return { src: BASE + ASSETS.briefs };
    if (/носк|sock/.test(name)) return { src: BASE + ASSETS.socks };
    if (/полотен|простын/.test(name)) return { src: BASE + ASSETS.towel };
    if (/мыл|soap/.test(name)) return { src: BASE + ASSETS.soap };
    if (/веник|broom/.test(name)) return { src: BASE + ASSETS.broom };
    if (/минерал|legend|питьев.*вода|вода/.test(name)) return { src: BASE + ASSETS.water };

    // Brand logo is used as the main visual when no product photograph exists.
    const brand = findBrand(name);
    if (brand) return { src: BASE + brand[1], brandOnly: true, brandName: brand[2] };
    return null;
  }

  function brandFor(name) {
    const brand = findBrand(name);
    return brand ? { src: BASE + brand[1], name: brand[2] } : null;
  }

  function photoMarkup(product, extraClass = '') {
    const name = String(product?.name || 'Товар');
    const info = productAsset(product);
    if (!info) return originalPhotoMarkup ? originalPhotoMarkup(product, extraClass) : `<span class="product-photo-wrap product-icon-wrap ${esc(extraClass)}">📦</span>`;
    const brand = !info.brandOnly ? brandFor(name) : null;
    const brandBadge = brand
      ? `<span class="po-product-brand-badge" title="${esc(brand.name)}"><img src="${esc(brand.src)}" alt="${esc(brand.name)}" loading="lazy" decoding="async"></span>`
      : '';
    return `<span class="product-photo-wrap product-icon-wrap po-product-photo ${esc(extraClass)}" role="img" aria-label="${esc(name)}" title="${esc(name)}" data-po-product-photo="${esc(info.src)}">
      <img class="po-real-product-image ${info.brandOnly ? 'po-brand-only' : ''}" src="${esc(info.src)}" alt="${esc(name)}" loading="lazy" decoding="async">
      ${brandBadge}
    </span>`;
  }

  function injectStyles() {
    if (document.getElementById('po-product-photos-v6-style')) return;
    const style = document.createElement('style');
    style.id = 'po-product-photos-v6-style';
    style.textContent = `
      .product-photo-wrap.po-product-photo{position:relative;display:grid;place-items:center;isolation:isolate;overflow:hidden;background:radial-gradient(circle at 50% 32%,#382b16,#080b08 78%);border:1px solid #b28a43;box-shadow:inset 0 1px #ffedbf22,0 3px 12px #0008}
      .product-photo-wrap.po-product-photo>.po-real-product-image{position:relative;z-index:1;display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;min-width:0!important;min-height:0!important;object-fit:contain!important;object-position:center!important;padding:4px!important;margin:0!important;border:0!important;border-radius:inherit!important;background:transparent!important}
      .product-photo-wrap.po-product-photo>.po-real-product-image.po-brand-only{padding:7px!important;object-fit:contain!important;background:#090e0b!important}
      .po-product-brand-badge{position:absolute;z-index:3;right:2px;bottom:2px;width:25px;height:19px;display:grid;place-items:center;padding:2px;border:1px solid #d7ae63;border-radius:6px;background:linear-gradient(145deg,#fff8e8,#d9c59d);box-shadow:0 2px 5px #0009}
      .po-product-brand-badge img{display:block;width:100%;height:100%;object-fit:contain}
      #productsView .po-si-mobile-product-icon.po-photo-ready{position:relative;display:grid;place-items:center;overflow:hidden;padding:2px;background:radial-gradient(circle at 50% 35%,#382b16,#080b08 78%)}
      #productsView .po-si-mobile-product-icon.po-photo-ready>img{display:block;width:100%;height:100%;min-width:0;min-height:0;object-fit:contain;object-position:center;padding:2px;border-radius:inherit}
      #productsView .po-si-mobile-product-icon.po-photo-ready>img.po-mobile-brand-only{padding:5px;background:#0a0e0b}
      #productsView .po-si-mobile-product-icon .po-product-brand-badge{width:19px;height:15px;right:0;bottom:0;border-radius:5px}
      @media(max-width:390px){#productsView .po-product-brand-badge{width:22px;height:17px}}
    `;
    document.head.appendChild(style);
  }

  function productById(id) {
    try {
      const products = Array.isArray(window.db?.products) ? window.db.products : [];
      return products.find(product => Number(product.id) === Number(id)) || null;
    } catch (_) { return null; }
  }

  function enhanceMobileProductCards(root = document) {
    const cards = root.querySelectorAll('.po-si-mobile-product[data-po-mobile-product]');
    cards.forEach(card => {
      const id = Number(card.getAttribute('data-po-mobile-product'));
      const product = productById(id);
      if (!product) return;
      const info = productAsset(product);
      if (!info) return; // Keep category fallback for genuinely unmapped products.
      const icon = card.querySelector('.po-si-mobile-product-icon');
      if (!icon || icon.dataset.poPhotoSrc === info.src) return;
      icon.dataset.poPhotoSrc = info.src;
      icon.classList.add('po-photo-ready');
      icon.replaceChildren();
      const image = document.createElement('img');
      image.src = info.src;
      image.alt = String(product.name || 'Товар');
      image.loading = 'lazy';
      image.decoding = 'async';
      if (info.brandOnly) image.classList.add('po-mobile-brand-only');
      image.addEventListener('error', () => {
        icon.classList.remove('po-photo-ready');
        icon.removeAttribute('data-po-photo-src');
        icon.textContent = '📦';
      }, { once: true });
      icon.appendChild(image);
      const brand = !info.brandOnly ? brandFor(product.name) : null;
      if (brand) {
        const badge = document.createElement('span');
        badge.className = 'po-product-brand-badge';
        const mark = document.createElement('img');
        mark.src = brand.src;
        mark.alt = brand.name;
        mark.loading = 'lazy';
        mark.decoding = 'async';
        badge.appendChild(mark);
        icon.appendChild(badge);
      }
    });
  }

  function upgradeExistingProductPhotos(root = document) {
    root.querySelectorAll('.product-photo-wrap.product-icon-wrap:not(.po-product-photo)').forEach(node => {
      const label = node.getAttribute('aria-label') || node.getAttribute('title') || '';
      if (!label) return;
      const products = Array.isArray(window.db?.products) ? window.db.products : [];
      const product = products.find(item => normalize(item.name) === normalize(label)) || { name: label };
      const info = productAsset(product);
      if (!info) return;
      const extras = [...node.classList].filter(name => !['product-photo-wrap','product-icon-wrap'].includes(name)).join(' ');
      const holder = document.createElement('span');
      holder.innerHTML = photoMarkup(product, extras);
      const replacement = holder.firstElementChild;
      if (replacement) node.replaceWith(replacement);
    });
  }

  function install() {
    injectStyles();
    // The original global helper is used by the existing product picker, receipt and product list.
    window.productPhotoMarkup = photoMarkup;
    enhanceMobileProductCards();
    upgradeExistingProductPhotos();
    const grid = document.getElementById('productsGrid');
    if (grid && !grid.dataset.poPhotoObserver) {
      grid.dataset.poPhotoObserver = '1';
      const observer = new MutationObserver(() => enhanceMobileProductCards(grid));
      observer.observe(grid, { childList: true, subtree: true });
    }
    if (typeof window.renderInventory === 'function') window.renderInventory();
    if (typeof window.renderAddProductGrid === 'function') window.renderAddProductGrid();
    // Existing open receipts/pickers can render again with the new helper.
    enhanceMobileProductCards();
    upgradeExistingProductPhotos();
    window.PARORDOProductPhotos = Object.freeze({
      version: '6.0.0',
      mappedAssets: Object.keys(ASSETS).length + BRANDS.length,
      resolve: productAsset,
      brandFor,
      render: photoMarkup
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else window.setTimeout(install, 80);
})();
