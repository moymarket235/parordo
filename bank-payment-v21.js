/* PAR ORDO — V21 Bank QR selector
   Add after app.js in index.html.
   Real QR file expected at: ./assets/payment/par-ordo-qr.png
*/
const PO_BANK_APPS = [
  {
    id:'mbank',
    name:'MBANK',
    subtitle:'MBANK',
    package:'com.maanavan.mb_kyrgyzstan',
    play:'https://play.google.com/store/apps/details?id=com.maanavan.mb_kyrgyzstan',
    logo:'https://play-lh.googleusercontent.com/1TQzAUDQNWJYtuQFV8xujBqhibfcjyDPJibDTrPW8w6YE3e2rZ_N1BWJfpPYIAjcdiHnHTAkAywqNMhDw75iZ9k=w240-h480'
  },
  {
    id:'obank',
    name:'O!Bank',
    subtitle:'My O! + Bank',
    package:'kg.o.nurtelecom',
    play:'https://play.google.com/store/apps/details?id=kg.o.nurtelecom',
    logo:'https://play-lh.googleusercontent.com/BZFtXfryGkzhEUkFBfxy27Dxs9Cn51ZwTGGWSCQuxb7Xr44cE2Bb1KKtqti-T2n4GVadhsC11bVGYoAtBX5x5ns=w240-h480'
  },
  {
    id:'optima24',
    name:'Optima24',
    subtitle:'Optima Bank',
    package:'kz.optimabank.optima24',
    play:'https://play.google.com/store/apps/details?id=kz.optimabank.optima24',
    logo:'https://play-lh.googleusercontent.com/cmZ2ATaeDgIYEd-J5GLHs6ZrSg5zToHJZbRk63dMbbSk3x-QYwQbuj__rUa2LdTtauEfr94VWdSSser47vwnTA=w240-h480'
  },
  {
    id:'bakai',
    name:'BAKAI',
    subtitle:'Bakai Bank',
    package:'kg.bakai.mib',
    play:'https://play.google.com/store/apps/details?id=kg.bakai.mib',
    logo:'https://play-lh.googleusercontent.com/cyWUoPdfvpESGp6_JgMejWJfUpvgTTIIO19xmNIrxwFD_qUkdrmqFR1ggRySRYnfhtXsej1aJ6N_IoP8B_8VlNM=w240-h480'
  },
  {
    id:'simbank',
    name:'Simbank',
    subtitle:'Doscredobank',
    package:'com.doscredo.simbank',
    play:'https://play.google.com/store/apps/details?id=com.doscredo.simbank',
    logo:'https://play-lh.googleusercontent.com/0yJg6Lm-GAvECLGSios401yUD3rIRCfJjsvYV0ZbnHiwYsCs6YxvuxStGYjrSdtJnvbMPfZyaRxQ74F-I-Id=w240-h480'
  },
  {
    id:'megapay',
    name:'MegaPay',
    subtitle:'MEGA Alfa Telecom',
    package:'com.kp.megapay.kg',
    play:'https://play.google.com/store/apps/details?id=com.kp.megapay.kg',
    logo:'https://play-lh.googleusercontent.com/tnctveCuuavVY3BArTJbzZ85Xj-vMHtiVdo8BJwh3Ozo6aivax25SY86_Pn0LuZpo2seXML-lCZGh1mp57MtdDQ=w240-h480'
  },
  {
    id:'kompanion',
    name:'Компаньон',
    subtitle:'Банк Компаньон',
    package:'com.kp.kompanion',
    play:'https://play.google.com/store/apps/details?id=com.kp.kompanion',
    logo:'https://play-lh.googleusercontent.com/E9NGYmBiXHA_Cg6YBoPsdyycisSEzvmWVBdVEOww1ZkAbVM-fph0dqaHG12HNKT_Xe9Q7KmfWECXMDBRFqofYX8=w240-h480'
  },
  {
    id:'demirbank',
    name:'DemirBank',
    subtitle:'Demir Kyrgyz International Bank',
    package:'kg.demirbank.mobileib.v3',
    play:'https://play.google.com/store/apps/details?id=kg.demirbank.mobileib.v3',
    logo:'https://play-lh.googleusercontent.com/Ir2ngFLHCF3ltDQryD7Ne42OTKyTI-Wmt0gu88Xm8-LUl9OUf0U_1fTZKBC_VbVeLpTBI004z3NZtz6eI0Yy4w=w240-h480'
  },
  {
    id:'eldik',
    name:'ELDIK',
    subtitle:'Элдик Банк',
    package:'kg.rsk.staging',
    play:'https://play.google.com/store/apps/details?id=kg.rsk.staging',
    logo:'https://play-lh.googleusercontent.com/RUECbfPvwTIPRYcb6vHNkOumgB_QSoVn_Exb075KfXvz1mkeYBbNCUsBUrLbpLA810PxtKMTuHe9F-LIijIU=w240-h480'
  }
];

const PO_PAYMENT_QR_IMAGE = './assets/payment/par-ordo-qr.png';

function poOpenQr(order){
  $('#modalCard').innerHTML = `
    <div class="po-qr-modal">
      <div class="modal-head">
        <div>
          <span class="eyebrow">ПАР ОРДО · QR</span>
          <h2>Выберите банк</h2>
        </div>
        <button class="icon-btn" id="closeModal">×</button>
      </div>

      <div class="po-order-total">
        <span>Заказ №${order.id}</span>
        <b>${money(order.total)}</b>
      </div>

      <p class="muted po-lead">
        Нажмите на свой банк — приложение откроется автоматически.
      </p>

      <div class="po-bank-grid">
        ${PO_BANK_APPS.map(bank => `
          <button class="po-bank-card" type="button" data-po-bank="${bank.id}">
            <span class="po-bank-logo">
              <img src="${bank.logo}" alt="${bank.name}" loading="lazy" decoding="async">
            </span>
            <b>${bank.name}</b>
            <small>Открыть приложение →</small>
          </button>
        `).join('')}
      </div>

      <div class="po-qr-hint">
        <span class="po-hint-icon">▣</span>
        <div>
          <b>QR код ПАР ОРДО</b>
          <span>После выбора банка откроется приложение. QR код можно сохранить и отсканировать в приложении.</span>
        </div>
      </div>

      <div class="po-mini-tags">
        <span>🔐 Безопасно</span>
        <span>⚡ Быстро</span>
        <span>🏦 9 банков</span>
      </div>
    </div>
  `;

  openModal();

  $$('[data-po-bank]').forEach(btn => {
    btn.onclick = () => {
      const bank = PO_BANK_APPS.find(x => x.id === btn.dataset.poBank);
      if(bank) poOpenSelectedBank(order, bank);
    };
  });
}

function poOpenSelectedBank(order, bank){
  $('#modalCard').innerHTML = `
    <div class="po-qr-payment">
      <div class="modal-head">
        <div>
          <span class="eyebrow">QR ОПЛАТА</span>
          <h2>${bank.name}</h2>
        </div>
        <button class="icon-btn" id="closeModal">×</button>
      </div>

      <div class="po-selected-bank">
        <span class="po-bank-logo po-bank-logo-large">
          <img src="${bank.logo}" alt="${bank.name}" decoding="async">
        </span>
        <div>
          <b>${bank.name}</b>
          <span>${bank.subtitle}</span>
        </div>
        <strong>${money(order.total)}</strong>
      </div>

      <div class="po-steps">
        <div><i>1</i><span>${bank.name} колдонмосу ачылды.</span></div>
        <div><i>2</i><span>QR төлөм / QR сканерди ачыңыз.</span></div>
        <div><i>3</i><span>Төмөндөгү QR кодду сканерлеңиз.</span></div>
      </div>

      <div class="po-real-qr">
        <div class="po-real-qr-frame">
          <img id="poQrImg" src="${PO_PAYMENT_QR_IMAGE}" alt="ПАР ОРДО төлөм QR коду">
          <div id="poQrMissing" class="po-qr-missing" hidden>
            <strong>QR код азырынча кошула элек</strong>
            <span>Сен берген чыныгы QR кодду ушул файлга кошкондо автоматтык чыгат.</span>
          </div>
        </div>
        <b>К оплате: ${money(order.total)}</b>
      </div>

      <div class="po-qr-actions">
        <a class="btn btn-gold" href="${PO_PAYMENT_QR_IMAGE}" download="par-ordo-qr.png">⬇ QR сактоо</a>
        <button class="btn back-btn" id="poBankBack">← Банкты өзгөртүү</button>
      </div>

      <button class="btn btn-gold po-paid-btn" id="poQrPaid">Мен төлөдүм →</button>

      <p class="po-return-note">
        Төлөмдөн кийин сайтка кайтып, «Мен төлөдүм» басыңыз. Акыркы статус администратор тарабынан тастыкталат.
      </p>
    </div>
  `;

  openModal();

  $('#poQrImg').onerror = () => {
    $('#poQrImg').style.display = 'none';
    $('#poQrMissing').hidden = false;
  };

  $('#poBankBack').onclick = () => poOpenQr(order);

  $('#poQrPaid').onclick = () => {
    state.orders.unshift({
      id:order.id,
      total:order.total,
      method:'QR',
      status:'Ожидает оплаты',
      createdAt:new Date().toISOString(),
      items:order.items || [],
      bank:bank.name
    });

    localStorage.setItem('po_orders_v3', JSON.stringify(state.orders));
    state.cart = [];
    saveCart();
    updateBadges();
    closeModal();

    renderSuccess({
      id:order.id,
      total:order.total,
      method:'QR',
      status:'Ожидает оплаты'
    });
  };

  // Save the QR from the same user gesture, then launch the selected Android app.
  try{
    const save = document.createElement('a');
    save.href = PO_PAYMENT_QR_IMAGE;
    save.download = 'par-ordo-qr.png';
    save.style.display = 'none';
    document.body.appendChild(save);
    save.click();
    save.remove();
  }catch(e){}

  setTimeout(() => poLaunchBankApp(bank), 160);
}

function poLaunchBankApp(bank){
  const ua = navigator.userAgent || '';
  if(!/Android/i.test(ua)){
    window.open(bank.play, '_blank', 'noopener');
    return;
  }

  // Android Chrome supports intent: links with a browser fallback.
  const fallback = encodeURIComponent(bank.play);
  const intent =
    `intent:#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;` +
    `package=${bank.package};S.browser_fallback_url=${fallback};end`;

  try{
    window.location.href = intent;
  }catch(e){
    window.open(bank.play, '_blank', 'noopener');
  }
}

// Replace the existing demo QR function with the premium selector.
window.openQr = poOpenQr;
