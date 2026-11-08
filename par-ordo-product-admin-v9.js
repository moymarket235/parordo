/*
 * PAR ORDO PRODUCT ADMIN & BRAND LOGOS V9
 * - Official product logos for Coca-Cola, Fanta, Sprite, Fuse Tea and Pepsi.
 * - Existing V8 product visuals remain the fallback for other products.
 * - Products without a real photo/logo use a clean name tile instead of a repeated category emoji.
 * - Admin-only "Удалить товар" action calls a guarded soft-archive endpoint.
 * - No direct database writes; no stock, receipt, price, or payment mutations.
 */
(() => {
  'use strict';
  if (window.PARORDOProductAdminV9?.version === '9.0.0') return;

  const OFFICIAL_LOGOS = [
    {
      key: 'coca-cola',
      test: /coca\s*[- ]?cola|кока\s*[- ]?кола|кока-кола/i,
      src: 'https://www.coca-cola.com/content/dam/onexp/kg/ru/home-images/logos/artwork-logos/ru_cocacola_brandlogo_180x550.png',
      label: 'Coca-Cola'
    },
    {
      key: 'fanta',
      test: /\bfanta\b|фанта/i,
      src: 'https://www.coca-cola.com/content/dam/onexp/kg/ru/home-images/logos/artwork-logos/ru_fanta_logo_237x180.png',
      label: 'Fanta'
    },
    {
      key: 'sprite',
      test: /\bsprite\b|спрайт/i,
      src: 'https://www.coca-cola.com/content/dam/onexp/kg/ru/home-images/logos/artwork-logos/tr_sprite_logo_207x180.png',
      label: 'Sprite'
    },
    {
      key: 'fuse-tea',
      test: /fuse\s*tea|fuze\s*tea|fuzetea|фьюз\s*ти/i,
      src: 'https://www.coca-cola.com/content/dam/onexp/kg/ru/home-images/logos/artwork-logos/ru_fusetea_logo_181x180.png',
      label: 'Fuse Tea'
    },
    {
      key: 'pepsi',
      test: /\bpepsi\b|пепси/i,
      src: 'https://digitalassets.pepsico.com/transform/47a5ae69-928c-44bd-b3cf-eab35bdc943e/pepsi-logo-fullcolor-RGB?q=85&w=640',
      label: 'Pepsi'
    }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const normalize = value => String(value || '').toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();

  // PAR ORDO's app uses a top-level lexical `const db`; it is not window.db.
  function products() {
    try {
      if (typeof db !== 'undefined' && Array.isArray(db.products)) return db.products;
    } catch (_) {}
    try {
      if (Array.isArray(window.db?.products)) return window.db.products;
    } catch (_) {}
    return [];
  }

  function productById(id) {
    const numericId = Number(id);
    return products().find(product => Number(product.id) === numericId) || null;
  }

  function brandLogo(product) {
    const name = normalize(product?.name);
    return OFFICIAL_LOGOS.find(item => item.test.test(name)) || null;
  }

  function isAdmin() {
    try {
      return typeof currentRole === 'function' && String(currentRole()).toLowerCase() === 'admin';
    } catch (_) {
      return false;
    }
  }

  function notify(message, isError = false) {
    try {
      if (typeof toast === 'function') return toast(message);
    } catch (_) {}
    if (isError) window.alert(message);
    else console.info(message);
  }

  function productLogoMarkup(product, extraClass = '') {
    const logo = brandLogo(product);
    if (!logo) return null;
    const label = String(product?.name || logo.label);
    return `<span class="product-photo-wrap product-icon-wrap po-v9-brand-logo ${esc(extraClass)}" data-po-logo="${esc(logo.key)}" role="img" aria-label="${esc(label)}" title="${esc(label)}">
      <img data-po-v9-logo-img="1" src="${esc(logo.src)}" alt="${esc(logo.label)}" loading="lazy" decoding="async">
      <span class="po-v9-logo-fallback" hidden>${esc(logo.label)}</span>
    </span>`;
  }

  function textTileMarkup(product, extraClass = '') {
    const label = String(product?.name || 'Товар').trim();
    return `<span class="product-photo-wrap product-icon-wrap po-v9-name-tile ${esc(extraClass)}" role="img" aria-label="${esc(label)}" title="${esc(label)}"><span>${esc(label)}</span></span>`;
  }

  function injectStyles() {
    if ($('#po-product-admin-v9-style')) return;
    const style = document.createElement('style');
    style.id = 'po-product-admin-v9-style';
    style.textContent = `
      .product-photo-wrap.po-v9-brand-logo,
      .product-photo-wrap.po-v9-name-tile{
        position:relative;display:grid!important;place-items:center;box-sizing:border-box;
        overflow:hidden;isolation:isolate;padding:5px!important;
        border:1px solid #c19a50!important;border-radius:14px!important;
        background:radial-gradient(circle at 50% 25%,#33250f,#08110b 78%)!important;
        box-shadow:inset 0 1px #fff0c51b,0 4px 12px #0008!important;
      }
      .product-photo-wrap.po-v9-brand-logo>img{
        position:relative;z-index:1;display:block!important;width:100%!important;height:100%!important;
        max-width:100%!important;max-height:100%!important;min-width:0!important;min-height:0!important;
        object-fit:contain!important;object-position:center!important;padding:2px!important;
        border:0!important;border-radius:inherit!important;background:transparent!important;
      }
      .product-photo-wrap.po-v9-brand-logo[data-po-logo="pepsi"]{background:#fff!important}
      .product-photo-wrap.po-v9-brand-logo>.po-v9-logo-fallback{position:absolute;inset:3px;display:grid;place-items:center;color:#ffe4a4;font-size:10px;font-weight:950;text-align:center;text-transform:uppercase;overflow-wrap:anywhere}
      .product-photo-wrap.po-v9-brand-logo>.po-v9-logo-fallback[hidden]{display:none!important}
      .product-photo-wrap.po-v9-brand-logo[data-po-logo="pepsi"]{background:#fff!important}
      .product-photo-wrap.po-v9-name-tile>span{
        display:-webkit-box;width:100%;max-height:100%;overflow:hidden;
        color:#ffe4a4;font-weight:950;font-size:clamp(7px,2.1vw,11px);
        letter-spacing:.035em;line-height:1.14;text-align:center;text-transform:uppercase;
        overflow-wrap:anywhere;word-break:normal;-webkit-box-orient:vertical;-webkit-line-clamp:4;
      }
      #productsView .po-si-mobile-product-icon.po-v9-brand-logo,
      #productsView .po-si-mobile-product-icon.po-v9-name-tile{
        display:grid!important;place-items:center;box-sizing:border-box;flex:0 0 54px;
        width:54px;height:54px;min-width:54px;min-height:54px;padding:4px;
        overflow:hidden;border:1px solid #c19a50;border-radius:14px;
        background:radial-gradient(circle at 50% 25%,#33250f,#08110b 78%);
        box-shadow:inset 0 1px #fff0c51b,0 4px 12px #0008;
      }
      #productsView .po-si-mobile-product-icon.po-v9-brand-logo[data-po-logo="pepsi"]{background:#fff}
      #productsView .po-si-mobile-product-icon.po-v9-brand-logo>img{
        display:block;width:100%;height:100%;min-width:0;min-height:0;
        object-fit:contain;object-position:center;padding:2px;border-radius:inherit;
      }
      #productsView .po-si-mobile-product-icon.po-v9-brand-logo[data-po-logo="pepsi"]{background:#fff}
      #productsView .po-si-mobile-product-icon.po-v9-name-tile>span{
        display:-webkit-box;width:100%;max-height:100%;overflow:hidden;color:#ffe4a4;
        font-size:8px;font-weight:950;letter-spacing:.03em;line-height:1.12;text-align:center;
        text-transform:uppercase;overflow-wrap:anywhere;-webkit-box-orient:vertical;-webkit-line-clamp:4;
      }
      .po-v9-delete-wrap{box-sizing:border-box;width:100%;max-width:100%;margin-top:10px}
      .po-v9-delete-button{
        display:flex;align-items:center;justify-content:center;gap:8px;box-sizing:border-box;
        width:100%;min-height:42px;padding:9px 12px;border:1px solid #a83e37;border-radius:11px;
        background:linear-gradient(110deg,#32110e,#1c0b09);color:#ffc0b8;
        font-size:12px;font-weight:950;line-height:1.25;white-space:normal;overflow-wrap:anywhere;
        box-shadow:inset 0 1px #ffdfd322,0 3px 12px #0005;
      }
      .po-v9-delete-button:disabled{opacity:.38;cursor:not-allowed;filter:grayscale(.45)}
      .po-v9-delete-note{display:block;margin-top:5px;color:#c7a98c;font-size:9px;line-height:1.35}
      .po-si-row-actions .po-v9-delete-wrap{min-width:0}
      @media(min-width:701px){.po-v9-delete-button{min-height:34px;font-size:11px}}
    `;
    document.head.appendChild(style);
  }

  function applyProductVisuals(root = document) {
    const nodes = root.querySelectorAll('.po-si-mobile-product[data-po-mobile-product]');
    nodes.forEach(card => {
      const product = productById(card.getAttribute('data-po-mobile-product'));
      if (!product) return;
      const icon = $('.po-si-mobile-product-icon', card);
      if (!icon) return;
      const logo = brandLogo(product);
      const src = logo?.src || '';
      const key = logo?.key || '';
      if (logo) {
        if (icon.dataset.poV9Visual === key) return;
        icon.dataset.poV9Visual = key;
        icon.classList.remove('po-v9-name-tile');
        icon.classList.add('po-v9-brand-logo');
        icon.dataset.poLogo = key;
        icon.replaceChildren();
        const img = document.createElement('img');
        img.src = src;
        img.alt = logo.label;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.addEventListener('error', () => {
          icon.classList.remove('po-v9-brand-logo');
          icon.classList.add('po-v9-name-tile');
          icon.removeAttribute('data-po-logo');
          icon.replaceChildren();
          const text = document.createElement('span');
          text.textContent = logo.label;
          icon.appendChild(text);
        }, { once: true });
        icon.appendChild(img);
        return;
      }

      // Preserve an existing actual product photograph/brand mark from V8.
      const existingImage = $('img', icon);
      if (existingImage && !icon.classList.contains('po-v9-brand-logo')) return;
      const label = String(product.name || 'Товар').trim();
      const desiredKey = `name:${normalize(label)}`;
      if (icon.dataset.poV9Visual === desiredKey) return;
      icon.dataset.poV9Visual = desiredKey;
      icon.classList.remove('po-v9-brand-logo');
      icon.classList.add('po-v9-name-tile');
      icon.removeAttribute('data-po-logo');
      icon.replaceChildren();
      const text = document.createElement('span');
      text.textContent = label;
      icon.appendChild(text);
    });
  }

  function addDeleteButtons(root = document) {
    const admin = isAdmin();
    root.querySelectorAll('.po-si-mobile-product[data-po-mobile-product]').forEach(card => {
      const existing = $('.po-v9-delete-wrap', card);
      if (!admin) { existing?.remove(); return; }
      if (existing) return;
      const id = Number(card.getAttribute('data-po-mobile-product'));
      const product = productById(id);
      if (!product) return;
      const stock = Math.max(0, Number(product.stock ?? product.available ?? 0));
      const reserved = Math.max(0, Number(product.reserved || 0));
      const wrap = document.createElement('div');
      wrap.className = 'po-v9-delete-wrap';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'po-v9-delete-button';
      button.dataset.poV9Delete = String(id);
      button.textContent = '⌫  Удалить товар';
      button.disabled = stock > 0 || reserved > 0;
      button.title = button.disabled ? 'Сначала обнулите остаток и резерв товара.' : 'Убрать товар из активного каталога';
      const note = document.createElement('small');
      note.className = 'po-v9-delete-note';
      note.textContent = button.disabled
        ? `Сначала обнулите остаток (${stock} шт.) и резерв (${reserved} шт.).`
        : 'Товар будет архивирован. История продаж сохранится.';
      wrap.append(button, note);
      card.appendChild(wrap);
    });

    root.querySelectorAll('.po-si-table tbody tr').forEach(row => {
      const existing = $('.po-v9-delete-wrap', row);
      if (!admin) { existing?.remove(); return; }
      if (existing) return;
      const selector = $('select[data-po-category]', row);
      const edit = $('[data-po-edit-stock], [data-po-edit-price]', row);
      const id = Number(selector?.dataset.poCategory || edit?.dataset.poEditStock || edit?.dataset.poEditPrice || 0);
      if (!id) return;
      const product = productById(id);
      if (!product) return;
      const target = $('.po-si-row-actions', row) || $('.po-si-actions', row);
      if (!target) return;
      const stock = Math.max(0, Number(product.stock ?? product.available ?? 0));
      const reserved = Math.max(0, Number(product.reserved || 0));
      const wrap = document.createElement('div');
      wrap.className = 'po-v9-delete-wrap';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'po-v9-delete-button';
      button.dataset.poV9Delete = String(id);
      button.textContent = '⌫  Удалить товар';
      button.disabled = stock > 0 || reserved > 0;
      button.title = button.disabled ? 'Сначала обнулите остаток и резерв товара.' : 'Убрать товар из активного каталога';
      const note = document.createElement('small');
      note.className = 'po-v9-delete-note';
      note.textContent = button.disabled ? `Остаток: ${stock}; резерв: ${reserved}.` : 'Архивирование с сохранением истории.';
      wrap.append(button, note);
      target.appendChild(wrap);
    });
  }

  function bindLogoFallbacks(root = document) {
    root.querySelectorAll('img[data-po-v9-logo-img]').forEach(image => {
      if (image.dataset.poV9ErrorBound === '1') return;
      image.dataset.poV9ErrorBound = '1';
      image.addEventListener('error', () => {
        image.hidden = true;
        const fallback = image.nextElementSibling;
        if (fallback) fallback.hidden = false;
      }, { once: true });
    });
  }

  function decorate(root = document) {
    applyProductVisuals(root);
    addDeleteButtons(root);
    bindLogoFallbacks(root);
  }

  async function archiveProduct(button) {
    if (!isAdmin()) {
      notify('Удалять товары может только администратор.', true);
      return;
    }
    const id = Number(button.dataset.poV9Delete);
    const product = productById(id);
    if (!id || !product) {
      notify('Товар не найден. Обновите каталог.', true);
      return;
    }
    const stock = Math.max(0, Number(product.stock ?? product.available ?? 0));
    const reserved = Math.max(0, Number(product.reserved || 0));
    if (stock > 0 || reserved > 0) {
      notify(`Нельзя удалить: остаток ${stock} шт., резерв ${reserved} шт. Сначала обнулите их.`, true);
      return;
    }
    const confirmed = window.confirm(
      `Убрать товар «${product.name}» из активного каталога?\n\n` +
      `Это безопасное архивирование: запись и история продаж останутся в базе.\n` +
      `Вернуть товар в каталог можно будет отдельной операцией.`
    );
    if (!confirmed) return;
    button.disabled = true;
    const previous = button.textContent;
    button.textContent = 'Архивирование…';
    try {
      if (typeof api !== 'function') throw new Error('API недоступен. Обновите страницу.');
      await api(`/api/admin/products/${id}/archive`, { method: 'POST', body: JSON.stringify({}) });
      if (typeof loadProducts === 'function') await loadProducts();
      if (typeof window.renderInventory === 'function') window.renderInventory();
      if (typeof toast === 'function') toast(`Товар «${product.name}» убран из активного каталога ✅`);
      else window.alert(`Товар «${product.name}» убран из активного каталога.`);
    } catch (error) {
      button.disabled = false;
      button.textContent = previous;
      notify(error?.message || 'Не удалось архивировать товар.', true);
    }
  }

  function onClick(event) {
    const button = event.target?.closest?.('[data-po-v9-delete]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    archiveProduct(button);
  }

  function install() {
    injectStyles();
    const original = typeof window.productPhotoMarkup === 'function'
      ? window.productPhotoMarkup.bind(window)
      : null;
    if (original) {
      window.productPhotoMarkup = (product, extraClass = '') => {
        const brandMarkup = productLogoMarkup(product, extraClass);
        return brandMarkup || original(product, extraClass);
      };
    }
    document.removeEventListener('click', onClick, true);
    document.addEventListener('click', onClick, true);
    const grid = $('#productsGrid');
    if (grid && !grid.dataset.poV9Observer) {
      grid.dataset.poV9Observer = '1';
      const observer = new MutationObserver(() => decorate(grid));
      observer.observe(grid, { childList: true, subtree: true });
    }
    if (typeof window.renderInventory === 'function') window.renderInventory();
    if (typeof window.renderAddProductGrid === 'function') window.renderAddProductGrid();
    decorate(document);
    window.PARORDOProductAdminV9 = Object.freeze({
      version: '9.0.0',
      officialLogos: OFFICIAL_LOGOS.map(item => item.key),
      adminOnlyDelete: true,
      deleteMode: 'soft-archive',
      render: decorate
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else window.setTimeout(install, 120);
})();
