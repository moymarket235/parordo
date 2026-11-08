/*
 * PAR ORDO PRODUCT VISUALS V8
 * Per-product brand marks / real product photos / typography fallback.
 * Works with the app's top-level lexical `const db` and existing V4 mobile cards.
 * No API calls, database writes, stock changes, or Worker/D1 changes.
 */
(() => {
  'use strict';

  if (window.PARORDOProductVisuals?.version === '8.0.0') return;

  const BASE = './assets/products/';
  // Old V4-V7 generated placeholders must not be mistaken for original product photos.
  // When one of these is stored in product.img, V8 skips it and uses the brand logo
  // or a clear product-name tile instead.
  const LEGACY_PLACEHOLDER = /(?:icon-(?:beverage|default|shampoo|shower-gel|deodorant|loofah|foot-file|tank-top)\.svg|(?:coca-cola|pepsi|fanta|sprite(?:-mojito)?|water)\.png|shoro-(?:aralash|chalap|maksym|tan)\.webp|tea-(?:black|green|lemon)\.png)/i;

  // Existing original brand marks in assets/products/. Brand logos take priority
  // over generic category pictograms (e.g. VIKING Shampoo -> VIKING logo).
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

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function normalize(value) {
    return String(value || '')
      .toLocaleLowerCase('ru-RU')
      .replace(/ё/g, 'е')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // `const db` is a top-level lexical binding, not window.db.
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

  function explicitProductImage(product) {
    const custom = [product?.image, product?.img, product?.photo, product?.imageUrl]
      .find(value => typeof value === 'string' && value.trim());
    if (!custom) return null;
    const src = custom.trim();
    if (!/^(https:\/\/|\.\/assets\/|assets\/|\/assets\/|data:image\/)/i.test(src)) return null;
    // Ignore old generic assets which made many different products display the
    // same blue "НАПИТОК" image. Keep genuine user-uploaded photos and other assets.
    if (LEGACY_PLACEHOLDER.test(src)) return null;
    return { type: 'image', src: src.startsWith('assets/') ? `./${src}` : src, explicit: true };
  }

  function productVisual(product) {
    const name = normalize(product?.name);

    // Preserve a real photo uploaded for this exact product.
    const custom = explicitProductImage(product);
    if (custom) return custom;

    // Where a known manufacturer logo exists, use that logo as the product mark.
    const brand = findBrand(name);
    if (brand) return { type: 'brand', src: BASE + brand[1], brandName: brand[2] };

    // No manufacturer logo / original product photo: show the product's own name.
    // Never substitute a generic drink, shampoo, clothes or category icon.
    return { type: 'label', text: String(product?.name || 'Товар').trim() || 'Товар' };
  }

  function visualLabel(name) {
    const clean = String(name || 'ТОВАР').trim();
    return clean.length > 30 ? clean.slice(0, 28).trimEnd() + '…' : clean;
  }

  function photoMarkup(product, extraClass = '') {
    const name = String(product?.name || 'Товар');
    const visual = productVisual(product);
    const common = `product-photo-wrap product-icon-wrap po-product-visual ${esc(extraClass)}`;
    if (visual.type === 'label') {
      return `<span class="${common} po-product-name-tile" role="img" aria-label="${esc(name)}" title="${esc(name)}"><span>${esc(visualLabel(name))}</span></span>`;
    }
    const isBrand = visual.type === 'brand';
    return `<span class="${common}" role="img" aria-label="${esc(name)}" title="${esc(name)}"><img class="po-product-visual-image ${isBrand ? 'is-brand-logo' : ''}" src="${esc(visual.src)}" alt="${esc(name)}" loading="lazy" decoding="async"></span>`;
  }

  function injectStyles() {
    if (document.getElementById('po-product-visuals-v8-style')) return;
    const style = document.createElement('style');
    style.id = 'po-product-visuals-v8-style';
    style.textContent = `
      .product-photo-wrap.po-product-visual{position:relative;display:grid;place-items:center;isolation:isolate;overflow:hidden;box-sizing:border-box;border:1px solid #bd914a;border-radius:13px;background:radial-gradient(circle at 50% 25%,#34250f 0%,#11130d 68%,#080c09 100%);box-shadow:inset 0 1px #fff0c326,0 3px 12px #0008}
      .product-photo-wrap.po-product-visual>.po-product-visual-image{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;min-width:0!important;min-height:0!important;object-fit:contain!important;object-position:center!important;padding:4px!important;margin:0!important;border:0!important;border-radius:inherit!important;background:transparent!important}
      .product-photo-wrap.po-product-visual>.po-product-visual-image.is-brand-logo{padding:7px!important;background:linear-gradient(145deg,#fff9ec,#e5d5b7)!important}
      .product-photo-wrap.po-product-visual.po-product-name-tile{padding:5px!important;background:linear-gradient(145deg,#30230f,#0b1710 78%);}
      .po-product-name-tile>span{display:-webkit-box;max-width:100%;max-height:100%;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:3;text-align:center;color:#ffe0a0;font-family:Arial,sans-serif;font-size:clamp(8px,2.1vw,11px);font-weight:950;letter-spacing:.035em;line-height:1.18;text-transform:uppercase;overflow-wrap:anywhere;word-break:normal;text-shadow:0 1px 2px #000}
      #productsView .po-si-mobile-product-icon.po-visual-ready{position:relative;display:grid!important;place-items:center;flex:0 0 54px;width:54px;height:54px;box-sizing:border-box;overflow:hidden;padding:2px;border:1px solid #bd914a;border-radius:13px;background:radial-gradient(circle at 50% 25%,#34250f,#080c09);box-shadow:inset 0 1px #fff0c326,0 3px 12px #0008}
      #productsView .po-si-mobile-product-icon.po-visual-ready>img{display:block;width:100%;height:100%;min-width:0;min-height:0;object-fit:contain;object-position:center;padding:3px;border-radius:inherit}
      #productsView .po-si-mobile-product-icon.po-visual-ready>img.is-brand-logo{padding:6px;background:linear-gradient(145deg,#fff9ec,#e5d5b7)}
      #productsView .po-si-mobile-product-icon.po-product-name-tile{padding:5px;background:linear-gradient(145deg,#30230f,#0b1710 78%)}
      #productsView .po-si-mobile-product-icon .po-product-name-text{display:-webkit-box;max-width:100%;max-height:100%;overflow:hidden;-webkit-box-orient:vertical;-webkit-line-clamp:3;text-align:center;color:#ffe0a0;font-size:8px;font-weight:950;letter-spacing:.03em;line-height:1.15;text-transform:uppercase;overflow-wrap:anywhere;text-shadow:0 1px 2px #000}
      @media(max-width:390px){#productsView .po-si-mobile-product-icon.po-visual-ready{flex-basis:50px;width:50px;height:50px}#productsView .po-si-mobile-product-icon .po-product-name-text{font-size:7.5px}}
    `;
    document.head.appendChild(style);
  }

  function productById(id) {
    return catalogProducts().find(product => Number(product.id) === Number(id)) || null;
  }

  function setMobileVisual(icon, product) {
    if (!icon || !product) return;
    const visual = productVisual(product);
    const signature = visual.type === 'label' ? `label:${visual.text}` : `${visual.type}:${visual.src}`;
    if (icon.dataset.poVisualSignature === signature) return;
    icon.dataset.poVisualSignature = signature;
    icon.classList.add('po-visual-ready');
    icon.classList.remove('po-product-name-tile');
    icon.replaceChildren();

    if (visual.type === 'label') {
      icon.classList.add('po-product-name-tile');
      const text = document.createElement('span');
      text.className = 'po-product-name-text';
      text.textContent = visualLabel(visual.text);
      icon.appendChild(text);
      icon.setAttribute('aria-label', visual.text);
      return;
    }

    const image = document.createElement('img');
    image.src = visual.src;
    image.alt = String(product.name || 'Товар');
    image.loading = 'lazy';
    image.decoding = 'async';
    if (visual.type === 'brand') image.classList.add('is-brand-logo');
    image.addEventListener('error', () => {
      // Broken/missing asset falls back to the product's own name, not an emoji.
      icon.replaceChildren();
      icon.classList.add('po-product-name-tile');
      const text = document.createElement('span');
      text.className = 'po-product-name-text';
      text.textContent = visualLabel(product.name);
      icon.appendChild(text);
      icon.dataset.poVisualSignature = `label:${product.name}`;
    }, { once: true });
    icon.appendChild(image);
    icon.setAttribute('aria-label', String(product.name || 'Товар'));
  }

  function enhanceMobileProductCards(root = document) {
    root.querySelectorAll('.po-si-mobile-product[data-po-mobile-product]').forEach(card => {
      const product = productById(card.getAttribute('data-po-mobile-product'));
      if (!product) return;
      setMobileVisual(card.querySelector('.po-si-mobile-product-icon'), product);
    });
  }

  function upgradeExistingProductPhotos(root = document) {
    root.querySelectorAll('.product-photo-wrap.product-icon-wrap:not(.po-product-visual)').forEach(node => {
      const label = node.getAttribute('aria-label') || node.getAttribute('title') || '';
      if (!label) return;
      const product = catalogProducts().find(item => normalize(item.name) === normalize(label)) || { name: label };
      const holder = document.createElement('span');
      holder.innerHTML = photoMarkup(product, [...node.classList].filter(name => !['product-photo-wrap','product-icon-wrap'].includes(name)).join(' '));
      const replacement = holder.firstElementChild;
      if (replacement) node.replaceWith(replacement);
    });
  }

  function install() {
    injectStyles();
    window.productPhotoMarkup = photoMarkup;
    if (typeof window.renderInventory === 'function') window.renderInventory();
    if (typeof window.renderAddProductGrid === 'function') window.renderAddProductGrid();
    enhanceMobileProductCards();
    upgradeExistingProductPhotos();

    const grid = document.getElementById('productsGrid');
    if (grid && !grid.dataset.poVisualObserverV8) {
      grid.dataset.poVisualObserverV8 = '1';
      const observer = new MutationObserver(() => enhanceMobileProductCards(grid));
      observer.observe(grid, { childList: true, subtree: true });
    }

    window.PARORDOProductVisuals = Object.freeze({
      version: '8.0.0',
      mappedBrandLogos: BRANDS.length,
      fallback: 'product-title-tile',
      resolve: productVisual,
      render: photoMarkup
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else window.setTimeout(install, 100);
})();
