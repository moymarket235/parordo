/*
 * PAR ORDO PRODUCT PHOTOS V7
 * Fixes the live product lookup (the main app declares `const db`, not `window.db`).
 * Uses existing real product images and brand marks from assets/products/.
 * Safe visual-only module: no API calls, database writes, stock changes, or Worker/D1 changes.
 */
(() => {
  'use strict';

  if (window.PARORDOProductPhotos?.version === '7.0.0') return;

  const BASE = './assets/products/';
  const ASSET = {
    coca: 'coca-cola.png', pepsi: 'pepsi.png', fanta: 'fanta.png',
    sprite: 'sprite.png', spriteMojito: 'sprite-mojito.png', water: 'water.png',
    shoroAralash: 'shoro-aralash.webp', shoroChalap: 'shoro-chalap.webp',
    shoroMaksym: 'shoro-maksym.webp', shoroTan: 'shoro-tan.webp',
    teaBlack: 'tea-black.png', teaGreen: 'tea-green.png', teaLemon: 'tea-lemon.png',
    shortsAdult: 'shorts-adult.png', shortsKids: 'shorts-kids.png',
    briefs: 'briefs.png', socks: 'socks.png', towel: 'towel.png', soap: 'soap.png',
    broom: 'broom.png', beverageIcon: 'icon-beverage.svg', defaultIcon: 'icon-default.svg',
    shampooIcon: 'icon-shampoo.svg', showerGelIcon: 'icon-shower-gel.svg',
    deodorantIcon: 'icon-deodorant.svg', loofahIcon: 'icon-loofah.svg',
    footFileIcon: 'icon-foot-file.svg', tankTopIcon: 'icon-tank-top.svg'
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
    return String(value || '').toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }

  // IMPORTANT: `const db` is a top-level lexical binding in index.html.
  // It is not exposed as window.db, which caused V6 to skip every mobile card.
  function catalogProducts() {
    try {
      if (typeof db !== 'undefined' && Array.isArray(db.products)) return db.products;
    } catch (_) {}
    try {
      if (Array.isArray(window.db?.products)) return window.db.products;
    } catch (_) {}
    return [];
  }

  function findBrand(name) {
    const value = normalize(name);
    return BRANDS.find(([pattern]) => pattern.test(value)) || null;
  }

  function assetPath(file) { return BASE + file; }

  function productAsset(product) {
    const name = normalize(product?.name);
    const category = normalize(product?.cat || product?.category);

    // Respect a product-specific image already entered in the catalogue.
    const custom = [product?.image, product?.img, product?.photo, product?.imageUrl]
      .find(value => typeof value === 'string' && value.trim());
    if (custom) {
      const src = custom.trim();
      if (/^(https:\/\/|\.\/assets\/|assets\/|\/assets\/|data:image\/)/i.test(src)) {
        return { src: src.startsWith('assets/') ? `./${src}` : src, direct: true };
      }
    }

    // Exact product photos — specific names must be checked before broad matches.
    if (/sprite\s*mojito|спрайт\s*мохито|мохито\s*спрайт/.test(name)) return { src: assetPath(ASSET.spriteMojito) };
    if (/coca[-\s]?cola|кока\s*кола|кока-кола|кола/.test(name)) return { src: assetPath(ASSET.coca) };
    if (/\bpepsi\b|пепси/.test(name)) return { src: assetPath(ASSET.pepsi) };
    if (/\bfanta\b|фанта/.test(name)) return { src: assetPath(ASSET.fanta) };
    if (/\bsprite\b|спрайт/.test(name)) return { src: assetPath(ASSET.sprite) };
    if (/шоро.*аралаш|аралаш.*шоро|\baralash\b/.test(name)) return { src: assetPath(ASSET.shoroAralash) };
    if (/чалап|\bchalap\b/.test(name)) return { src: assetPath(ASSET.shoroChalap) };
    if (/максым|\bmaksym\b|\bmaxsym\b/.test(name)) return { src: assetPath(ASSET.shoroMaksym) };
    if (/тан\b|\btan\b/.test(name)) return { src: assetPath(ASSET.shoroTan) };
    if (/лимон.*чай|чай.*лимон/.test(name)) return { src: assetPath(ASSET.teaLemon) };
    if (/зелен.*чай|кок\s*чай|көк\s*чай|green\s*tea/.test(name)) return { src: assetPath(ASSET.teaGreen) };
    if (/черн.*чай|кара\s*чай|қара\s*чай|black\s*tea/.test(name)) return { src: assetPath(ASSET.teaBlack) };
    if (/шорт/.test(name) || category === 'шорты') {
      return { src: assetPath(/дет|kids|ребен|ребенок/.test(name) ? ASSET.shortsKids : ASSET.shortsAdult) };
    }
    if (/трус|brief/.test(name)) return { src: assetPath(ASSET.briefs) };
    if (/носк|sock/.test(name)) return { src: assetPath(ASSET.socks) };
    if (/полотен|простын/.test(name)) return { src: assetPath(ASSET.towel) };
    if (/мыл|soap/.test(name)) return { src: assetPath(ASSET.soap) };
    if (/веник|broom/.test(name)) return { src: assetPath(ASSET.broom) };
    if (/минерал|legend|питьев.*вода|вода/.test(name)) return { src: assetPath(ASSET.water) };
    if (/шампун|shampoo/.test(name)) return { src: assetPath(ASSET.shampooIcon) };
    if (/гель.*душ|душ.*гель|shower.?gel/.test(name)) return { src: assetPath(ASSET.showerGelIcon) };
    if (/дезодорант|deodorant|antiperspirant/.test(name)) return { src: assetPath(ASSET.deodorantIcon) };
    if (/мочалк|loofah/.test(name)) return { src: assetPath(ASSET.loofahIcon) };
    if (/пилк.*ног|терк.*ног|foot.?file/.test(name)) return { src: assetPath(ASSET.footFileIcon) };
    if (/майк|борцовк|tank.?top/.test(name)) return { src: assetPath(ASSET.tankTopIcon) };

    // Brand mark is preferred when the exact product photo is not available.
    const brand = findBrand(name);
    if (brand) return { src: assetPath(brand[1]), brandOnly: true, brandName: brand[2] };

    // Distinct semantic fallback by product category; never reuse a generic drink icon
    // for a non-drink product.
    if (category === 'напитки') return { src: assetPath(ASSET.beverageIcon), fallbackOnly: true };
    if (category === 'чай') return { src: assetPath(ASSET.teaBlack), fallbackOnly: true };
    if (category === 'шорты') return { src: assetPath(ASSET.shortsAdult), fallbackOnly: true };
    if (category === 'одежда') return { src: assetPath(ASSET.tankTopIcon), fallbackOnly: true };
    if (category === 'полотенца') return { src: assetPath(ASSET.towel), fallbackOnly: true };
    if (category === 'аксессуары' || category === 'для бани') return { src: assetPath(ASSET.broom), fallbackOnly: true };
    if (category === 'гигиена') return { src: assetPath(ASSET.showerGelIcon), fallbackOnly: true };
    return { src: assetPath(ASSET.defaultIcon), fallbackOnly: true };
  }

  function brandFor(name) {
    const brand = findBrand(name);
    return brand ? { src: assetPath(brand[1]), name: brand[2] } : null;
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
    if (document.getElementById('po-product-photos-v7-style')) return;
    const style = document.createElement('style');
    style.id = 'po-product-photos-v7-style';
    style.textContent = `
      .product-photo-wrap.po-product-photo{position:relative;display:grid;place-items:center;isolation:isolate;overflow:hidden;background:radial-gradient(circle at 50% 32%,#382b16,#080b08 78%);border:1px solid #b28a43;box-shadow:inset 0 1px #ffedbf22,0 3px 12px #0008}
      .product-photo-wrap.po-product-photo>.po-real-product-image{position:relative;z-index:1;display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;min-width:0!important;min-height:0!important;object-fit:contain!important;object-position:center!important;padding:4px!important;margin:0!important;border:0!important;border-radius:inherit!important;background:transparent!important}
      .product-photo-wrap.po-product-photo>.po-real-product-image.po-brand-only{padding:7px!important;object-fit:contain!important;background:#090e0b!important}
      .po-product-brand-badge{position:absolute;z-index:3;right:2px;bottom:2px;width:25px;height:19px;display:grid;place-items:center;padding:2px;border:1px solid #d7ae63;border-radius:6px;background:linear-gradient(145deg,#fff8e8,#d9c59d);box-shadow:0 2px 5px #0009}
      .po-product-brand-badge img{display:block;width:100%;height:100%;object-fit:contain}
      #productsView .po-si-mobile-product-icon.po-photo-ready{position:relative;display:grid;place-items:center;flex:0 0 54px;width:54px;height:54px;overflow:hidden;padding:2px;border:1px solid #b28a43;border-radius:14px;background:radial-gradient(circle at 50% 35%,#382b16,#080b08 78%);box-shadow:inset 0 1px #ffedbf22,0 3px 12px #0008}
      #productsView .po-si-mobile-product-icon.po-photo-ready>img{display:block;width:100%;height:100%;min-width:0;min-height:0;object-fit:contain;object-position:center;padding:2px;border-radius:inherit}
      #productsView .po-si-mobile-product-icon.po-photo-ready>img.po-mobile-brand-only{padding:5px;background:#0a0e0b}
      #productsView .po-si-mobile-product-icon .po-product-brand-badge{width:19px;height:15px;right:0;bottom:0;border-radius:5px}
      @media(max-width:390px){#productsView .po-product-brand-badge{width:22px;height:17px}}
    `;
    document.head.appendChild(style);
  }

  function productById(id) {
    const products = catalogProducts();
    return products.find(product => Number(product.id) === Number(id)) || null;
  }

  function setMobileImage(icon, product, info) {
    if (!icon || !product || !info) return;
    if (icon.dataset.poPhotoSrc === info.src) return;
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
  }

  function enhanceMobileProductCards(root = document) {
    root.querySelectorAll('.po-si-mobile-product[data-po-mobile-product]').forEach(card => {
      const product = productById(card.getAttribute('data-po-mobile-product'));
      if (!product) return;
      const icon = card.querySelector('.po-si-mobile-product-icon');
      setMobileImage(icon, product, productAsset(product));
    });
  }

  function upgradeExistingProductPhotos(root = document) {
    root.querySelectorAll('.product-photo-wrap.product-icon-wrap:not(.po-product-photo)').forEach(node => {
      const label = node.getAttribute('aria-label') || node.getAttribute('title') || '';
      if (!label) return;
      const product = catalogProducts().find(item => normalize(item.name) === normalize(label)) || { name: label };
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
    window.productPhotoMarkup = photoMarkup;
    if (typeof window.renderInventory === 'function') window.renderInventory();
    enhanceMobileProductCards();
    upgradeExistingProductPhotos();
    if (typeof window.renderAddProductGrid === 'function') window.renderAddProductGrid();
    enhanceMobileProductCards();

    const grid = document.getElementById('productsGrid');
    if (grid && !grid.dataset.poPhotoObserverV7) {
      grid.dataset.poPhotoObserverV7 = '1';
      const observer = new MutationObserver(() => enhanceMobileProductCards(grid));
      observer.observe(grid, { childList: true, subtree: true });
    }

    window.PARORDOProductPhotos = Object.freeze({
      version: '7.0.0',
      mappedAssets: Object.keys(ASSET).length + BRANDS.length,
      catalogLookup: 'top-level-const-db',
      resolve: productAsset,
      brandFor,
      render: photoMarkup,
      refresh: enhanceMobileProductCards
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else window.setTimeout(install, 100);
})();
