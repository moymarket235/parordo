/*
 * PAR ORDO SMART INVENTORY PRO — DESIGN LAYER V5
 * Visual-only enhancement loaded AFTER par-ordo-smart-inventory-v4.js.
 * Keeps V4 product calculations, role permissions, product IDs, API calls,
 * stock movements, receipts, and existing event handlers unchanged.
 */
(() => {
  'use strict';
  const VERSION = '5.0.0';
  const STYLE_ID = 'po-smart-inventory-design-v5';
  if (window.PARORDOSmartInventoryDesign?.version === VERSION) return;

  const CSS = String.raw`
  /* Page title: more deliberate premium hierarchy */
  #productsView .section-head.po-si-page-head{
    box-sizing:border-box;width:100%;max-width:100%;padding:13px 12px;margin:0 0 12px;
    border:1px solid rgba(190,143,65,.62);border-radius:18px;
    background:radial-gradient(circle at 0% 0%,rgba(218,163,63,.15),transparent 44%),linear-gradient(135deg,rgba(17,19,12,.98),rgba(6,17,12,.98));
    box-shadow:inset 0 1px rgba(255,235,184,.09),0 8px 22px rgba(0,0,0,.28);
  }
  #productsView .po-si-page-title{align-items:center;gap:10px;flex:1 1 auto;min-width:0}
  #productsView .po-si-page-mark{width:40px;height:40px;flex-basis:40px;border-radius:13px;font-size:21px;box-shadow:0 0 18px rgba(217,163,61,.18)}
  #productsView .po-si-page-copy{min-width:0;max-width:100%}
  #productsView .po-si-page-copy .eyebrow{font-size:9px;letter-spacing:.15em;line-height:1.35;overflow-wrap:anywhere}
  #productsView .po-si-page-copy h2{font-size:clamp(20px,5vw,26px);line-height:1.08;overflow-wrap:anywhere}
  #productsView .po-si-page-copy small{font-size:11px;line-height:1.4;overflow-wrap:anywhere}
  #productsView .po-si-head-actions{gap:7px;flex:0 0 auto;min-width:0}
  #productsView .po-si-head-actions #refreshProducts{width:40px;min-width:40px;height:40px;border-radius:13px}
  #productsView #poSmartAddProduct{min-height:42px;padding:9px 12px;border-radius:13px;font-size:11px;max-width:100%;white-space:normal;line-height:1.2}

  /* Four KPI cards: readable two-by-two dashboard on phones */
  #productsView #inventoryKpis{
    display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:9px!important;margin:0 0 12px!important;
  }
  #productsView #inventoryKpis .po-si-kpi{
    box-sizing:border-box;min-width:0;min-height:88px;padding:11px 10px!important;border-radius:17px!important;
    background:radial-gradient(circle at 100% 0%,rgba(218,163,63,.10),transparent 52%),linear-gradient(145deg,#14130d,#08140e)!important;
    border:1px solid #765728!important;box-shadow:inset 0 1px rgba(255,231,168,.08),0 6px 16px rgba(0,0,0,.32)!important;
    align-items:flex-start!important;text-align:left!important;gap:5px!important;
  }
  #productsView #inventoryKpis .po-si-kpi.stock{border-color:#218957!important;box-shadow:inset 0 0 18px rgba(20,190,108,.08),0 0 14px rgba(20,190,108,.09)!important}
  #productsView #inventoryKpis .po-si-kpi.profit{border-color:#218957!important}
  #productsView #inventoryKpis .po-si-kpi .po-si-kpi-icon{display:grid;place-items:center;width:27px;height:27px;border:1px solid rgba(237,194,101,.35);border-radius:9px;background:rgba(208,151,48,.08);font-size:14px}
  #productsView #inventoryKpis .po-si-kpi small{font-size:10px!important;line-height:1.25!important;max-width:100%;white-space:normal;overflow-wrap:anywhere}
  #productsView #inventoryKpis .po-si-kpi strong{font-size:clamp(14px,3.8vw,18px)!important;line-height:1.15!important;max-width:100%;white-space:normal;overflow-wrap:anywhere;word-break:normal}
  #productsView #inventoryKpis .po-si-kpi-note{font-size:8px!important;line-height:1.2!important;white-space:normal;overflow-wrap:anywhere}

  /* Category review notice: tidy, readable and contained */
  #productsView .po-si-review{
    box-sizing:border-box;width:100%;max-width:100%;min-width:0;margin:0 0 11px!important;padding:11px 12px!important;
    border:1px solid rgba(166,125,52,.68)!important;border-left:3px solid #e6b951!important;border-radius:14px!important;
    background:linear-gradient(115deg,rgba(44,30,10,.96),rgba(17,18,12,.98))!important;
    color:#e8d9bd!important;font-size:11px!important;line-height:1.5!important;
    white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;
  }
  #productsView .po-si-review b{color:#ffdf91!important}

  /* Search first row, filters second row — no clipped controls */
  #productsView .po-si-dashboard-tools{
    display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin:0 0 12px!important;
  }
  #productsView .po-si-dashboard-tools .po-si-search{grid-column:1/-1;width:100%;max-width:100%;box-sizing:border-box;height:45px;padding:10px 13px;font-size:12px;border-radius:14px}
  #productsView .po-si-tool-select{width:100%;max-width:none!important;min-width:0;height:42px;padding:0 11px!important;border-radius:12px!important;font-size:11px!important;box-sizing:border-box}

  /* Category cards: premium frame, more breathing room, never clip labels */
  #productsView .po-si-categories{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}
  #productsView .po-si-category{
    box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:158px!important;padding:11px 9px!important;
    border:1px solid #9c7134!important;border-radius:19px!important;
    background:radial-gradient(circle at 92% 2%,rgba(222,168,69,.15),transparent 38%),linear-gradient(145deg,#17170f 0%,#0c170f 72%,#080f0b 100%)!important;
    box-shadow:inset 0 1px rgba(255,234,178,.12),0 8px 19px rgba(0,0,0,.36)!important;
    overflow:hidden!important;white-space:normal!important;gap:9px!important;
  }
  #productsView .po-si-category:before{height:2px!important;opacity:1!important;background:linear-gradient(90deg,transparent,#f5d17a,#b78028,transparent)!important}
  #productsView .po-si-card-head{grid-template-columns:46px minmax(0,1fr) 13px!important;gap:7px!important;align-items:center!important;width:100%;min-width:0}
  #productsView .po-si-cat-icon{
    box-sizing:border-box;width:44px!important;height:46px!important;border:1px solid rgba(188,144,68,.5);border-radius:14px;
    background:linear-gradient(145deg,rgba(53,38,14,.8),rgba(8,19,13,.9));font-size:28px!important;
  }
  #productsView .po-si-card-title{min-width:0;width:100%;max-width:100%;gap:4px!important}
  #productsView .po-si-cat-name{display:block;max-width:100%;font-size:clamp(12px,3.4vw,15px)!important;line-height:1.18!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;hyphens:auto}
  #productsView .po-si-cat-meta{font-size:9px!important;line-height:1.25!important;white-space:normal!important;overflow-wrap:anywhere!important}
  #productsView .po-si-card-arrow{font-size:24px!important;font-weight:500}
  #productsView .po-si-mini-metrics{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:5px!important;width:100%;min-width:0}
  #productsView .po-si-mini-metric{
    box-sizing:border-box;width:100%;min-width:0;min-height:52px!important;padding:6px 3px!important;border-radius:11px!important;
    background:linear-gradient(145deg,rgba(6,31,18,.92),rgba(8,17,12,.98))!important;
  }
  #productsView .po-si-mini-metric.amount{background:linear-gradient(145deg,rgba(47,31,9,.96),rgba(15,13,8,.98))!important}
  #productsView .po-si-mini-metric b{display:block;width:100%;max-width:100%;font-size:clamp(8px,2.6vw,12px)!important;line-height:1.15!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}
  #productsView .po-si-mini-metric small{display:block;max-width:100%;font-size:8px!important;line-height:1.15!important;white-space:normal!important;overflow-wrap:anywhere!important}

  /* Category detail heading and totals */
  #productsView .po-si-detail-head{box-sizing:border-box;width:100%;max-width:100%;padding:12px;border:1px solid rgba(174,129,53,.52);border-radius:16px;background:linear-gradient(120deg,rgba(28,21,10,.92),rgba(7,19,13,.94));gap:8px!important}
  #productsView .po-si-detail-head>div{min-width:0;max-width:100%}
  #productsView .po-si-detail-title{font-size:clamp(21px,6vw,27px)!important;line-height:1.1!important;white-space:normal!important;overflow-wrap:anywhere!important}
  #productsView .po-si-back{box-sizing:border-box;max-width:42%;white-space:normal!important;overflow-wrap:anywhere;line-height:1.2}
  #productsView .po-si-summary{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important}
  #productsView .po-si-summary-card{box-sizing:border-box;min-width:0;padding:11px 8px!important;border-radius:14px!important}
  #productsView .po-si-summary-card small{font-size:9px!important;line-height:1.3!important;white-space:normal;overflow-wrap:anywhere}
  #productsView .po-si-summary-card strong{font-size:clamp(12px,3.5vw,17px)!important;line-height:1.15!important;white-space:normal;overflow-wrap:anywhere}

  /* Mobile product cards: premium but functional */
  #productsView .po-si-mobile-cards{gap:11px!important;padding:2px 1px 14px!important}
  #productsView .po-si-mobile-product{
    box-sizing:border-box;width:100%;max-width:100%;min-width:0;padding:14px!important;border:1px solid #a47a3d!important;border-radius:19px!important;
    background:radial-gradient(circle at 100% 0%,rgba(218,163,63,.10),transparent 40%),linear-gradient(145deg,#17170f 0%,#0b180f 72%,#080f0b 100%)!important;
    box-shadow:inset 0 1px rgba(255,236,190,.12),0 9px 20px rgba(0,0,0,.4)!important;overflow:hidden!important;
  }
  #productsView .po-si-mobile-product-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;min-width:0;margin:0 0 12px!important}
  #productsView .po-si-mobile-product-main{display:grid!important;grid-template-columns:46px minmax(0,1fr)!important;align-items:center!important;gap:9px!important;min-width:0;width:100%}
  #productsView .po-si-mobile-product-main>div{min-width:0!important;width:100%;max-width:100%}
  #productsView .po-si-mobile-product-name{display:block;width:100%;max-width:100%;min-width:0;font-size:clamp(14px,3.9vw,17px)!important;line-height:1.25!important;font-weight:950;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;hyphens:auto}
  #productsView .po-si-mobile-product-sub{display:block;max-width:100%;font-size:9px!important;line-height:1.35!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}
  #productsView .po-si-mobile-category-note{box-sizing:border-box;width:100%;max-width:100%;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;line-height:1.45!important}
  #productsView .po-si-mobile-product-number{box-sizing:border-box;max-width:90px;white-space:normal!important;overflow-wrap:anywhere!important;text-align:center;line-height:1.2}
  #productsView .po-si-mobile-metrics{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;width:100%;min-width:0}
  #productsView .po-si-mobile-metric{box-sizing:border-box;min-width:0;min-height:68px!important;padding:9px 5px!important;border-radius:13px!important;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;gap:5px}
  #productsView .po-si-mobile-metric b{display:block;width:100%;max-width:100%;font-size:clamp(10px,3vw,14px)!important;line-height:1.15!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}
  #productsView .po-si-mobile-metric small{display:block;width:100%;max-width:100%;font-size:8px!important;line-height:1.2!important;white-space:normal!important;overflow-wrap:anywhere!important}
  #productsView .po-si-mobile-prices{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;width:100%;min-width:0;margin-top:9px}
  #productsView .po-si-mobile-price{box-sizing:border-box;min-width:0;width:100%;padding:10px 9px!important;border:1px solid #604827!important;border-radius:12px!important;background:linear-gradient(145deg,#17140c,#0b120d)!important}
  #productsView .po-si-mobile-price small{display:block;width:100%;max-width:100%;font-size:9px!important;line-height:1.25!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}
  #productsView .po-si-mobile-price b{display:block;max-width:100%;font-size:13px!important;line-height:1.2!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}
  #productsView .po-si-mobile-actions{width:100%;max-width:100%;margin-top:10px}
  #productsView .po-si-mobile-actions>summary{box-sizing:border-box;width:100%;min-height:44px;padding:11px 12px!important;border:1px solid #9a743c!important;border-radius:12px!important;background:linear-gradient(110deg,#2a1e0b,#10170f)!important;color:#ffe5a5!important;font-size:11px!important;line-height:1.25!important;white-space:normal!important;overflow-wrap:anywhere!important}
  #productsView .po-si-mobile-actions-body{box-sizing:border-box;width:100%;max-width:100%;min-width:0;display:grid;gap:9px;padding:11px 3px 2px!important}
  #productsView .po-si-mobile-control-label{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;min-width:0;width:100%;max-width:100%;font-size:10px!important;line-height:1.35!important;white-space:normal!important;overflow-wrap:anywhere!important}
  #productsView .po-si-mobile-control-label select,#productsView .po-si-mobile-control-label input{box-sizing:border-box;width:100%;max-width:100%;min-width:0;min-height:42px;border-radius:10px}
  #productsView .po-si-mobile-receipt{display:grid;grid-template-columns:minmax(0,1fr) 46px;gap:6px;min-width:0;width:100%}
  #productsView .po-si-mobile-receipt input{box-sizing:border-box;width:100%;min-width:0}
  #productsView .po-si-mobile-receipt button{min-width:46px;min-height:42px;border-radius:10px}
  #productsView .po-si-mobile-action-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;width:100%;min-width:0}
  #productsView .po-si-mobile-action-grid .po-si-action{box-sizing:border-box;width:100%;min-width:0;min-height:42px;padding:8px 7px!important;border-radius:10px!important;font-size:10px!important;line-height:1.3!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important}
  #productsView .po-si-save-cat{box-sizing:border-box;width:100%;max-width:100%;min-height:39px;padding:8px 10px!important;font-size:10px!important;line-height:1.3!important;white-space:normal!important;overflow-wrap:anywhere!important}
  #productsView .po-si-mobile-empty{box-sizing:border-box;width:100%;max-width:100%;padding:18px;border:1px dashed #8f6d38;border-radius:15px;text-align:center;color:#d7c39d;white-space:normal;overflow-wrap:anywhere}

  @media(max-width:390px){
    #productsView .section-head.po-si-page-head{padding:10px 9px;gap:7px}
    #productsView .po-si-page-mark{width:35px;height:35px;flex-basis:35px}
    #productsView #poSmartAddProduct{font-size:9px;padding:8px 9px}
    #productsView .po-si-category{min-height:150px!important;padding:9px 7px!important}
    #productsView .po-si-card-head{grid-template-columns:38px minmax(0,1fr) 10px!important;gap:5px!important}
    #productsView .po-si-cat-icon{width:37px!important;height:39px!important;font-size:24px!important}
    #productsView .po-si-cat-name{font-size:12px!important}
    #productsView .po-si-mini-metric{min-height:49px!important;padding:5px 2px!important}
    #productsView .po-si-mini-metric b{font-size:8px!important}
    #productsView .po-si-mini-metric small{font-size:7px!important}
    #productsView .po-si-mobile-product{padding:11px!important}
    #productsView .po-si-mobile-metrics{gap:4px!important}
    #productsView .po-si-mobile-metric{min-height:61px!important;padding:7px 3px!important}
    #productsView .po-si-mobile-metric b{font-size:10px!important}
    #productsView .po-si-mobile-prices{gap:6px!important}
    #productsView .po-si-mobile-price{padding:8px 7px!important}
  }
  @media(max-width:340px){
    #productsView .po-si-categories{grid-template-columns:1fr!important}
    #productsView .po-si-category{min-height:138px!important;padding:12px!important}
    #productsView .po-si-card-head{grid-template-columns:46px minmax(0,1fr) 14px!important}
    #productsView .po-si-cat-icon{width:44px!important;height:44px!important;font-size:28px!important}
    #productsView .po-si-cat-name{font-size:14px!important}
    #productsView .po-si-mini-metric b{font-size:11px!important}
    #productsView .po-si-mini-metric small{font-size:8px!important}
  }
  @media(min-width:701px){
    #productsView #inventoryKpis{grid-template-columns:repeat(4,minmax(0,1fr))!important}
    #productsView .po-si-categories{grid-template-columns:repeat(3,minmax(0,1fr))!important}
    #productsView .po-si-mobile-cards{display:none!important}
    #productsView .po-si-table-wrap{display:block!important}
    #productsView .po-si-page-copy h2{font-size:25px}
    #productsView .po-si-category{min-height:165px!important;padding:14px!important}
    #productsView .po-si-cat-name{font-size:15px!important}
  }
  `;

  function install() {
    if (!document.querySelector('#productsView') || !document.querySelector('#productsGrid')) return false;
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    document.documentElement.classList.add('po-inventory-design-v5');
    window.PARORDOSmartInventoryDesign = Object.freeze({ version: VERSION, visualOnly: true });
    return true;
  }

  const start = () => {
    if (install()) return;
    let tries = 0;
    const observer = new MutationObserver(() => {
      if (install() || ++tries > 80) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 12000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
