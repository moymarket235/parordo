/* PAR ORDO PRO V114 — customer WhatsApp invitations.
   Client-side only: creates a WhatsApp chat with a selected prefilled message.
   It never sends a message automatically and does not change server/customer data. */
(() => {
  'use strict';
  if (window.__parOrdoWhatsAppInvitationsV114) return;
  window.__parOrdoWhatsAppInvitationsV114 = true;

  const STORAGE_KEY = 'parordo_invite_template_v114';
  const LANG_KEY = 'parordo_invite_language_v114';
  const templates = [
    { title: 'Жылуу чакыруу / Тёплое приглашение', ky: 'Саламатсызбы, {name}! 😊 PAR ORDO сизди эс алып, күнүмдүк түйшүктөн бир аз тыныгууга чакырат. Сизди көргөнүбүзгө кубанычтабыз!', ru: 'Здравствуйте, {name}! 😊 Приглашаем вас в PAR ORDO отдохнуть и немного отвлечься от повседневных дел. Будем рады вас видеть!' },
    { title: 'Күндөн кийин эс алуу / Отдых после дня', ky: 'Саламатсызбы, {name}! Бүгүн өзүңүзгө убакыт бөлүңүз — жылуу буу, тынч атмосфера жана эс алуу PAR ORDOдо күтөт. Келиңиз!', ru: 'Здравствуйте, {name}! Найдите время для себя после насыщенного дня: тёплая парная и спокойная атмосфера ждут вас в PAR ORDO. Будем рады встрече!' },
    { title: 'Достор менен / С друзьями', ky: '{name}, досторуңуз менен эс алууну пландап жатасызбы? PAR ORDOго келип, жакшы маанайда убакыт өткөрүңүз. Сизди күтөбүз!', ru: '{name}, планируете отдых с друзьями? Загляните в PAR ORDO, чтобы приятно провести время и перезагрузиться. Будем рады вам!' },
    { title: 'Апта соңуна / На выходные', ky: 'Саламатсызбы, {name}! Апта соңунда эс алууга убакыт бөлүңүз. PAR ORDO сизди жылуу тосуп алат. Кайсы убакыт сизге ыңгайлуу?', ru: 'Здравствуйте, {name}! Запланируйте приятный отдых на выходные в PAR ORDO. Подскажите, какое время вам было бы удобно?' },
    { title: 'Кечки эс алуу / Вечерний отдых', ky: 'Кутмандуу кеч, {name}! Күндү жайлуу эс алуу менен аяктагыңыз келсе, PAR ORDOго келиңиз. Сизди күтөбүз!', ru: 'Добрый вечер, {name}! Если хочется завершить день спокойным отдыхом, приходите в PAR ORDO. Будем рады вас видеть!' },
    { title: 'Кайра көрүшүү / Будем рады снова', ky: 'Саламатсызбы, {name}! PAR ORDOго акыркы келгениңиз үчүн рахмат. Сизди кайра көрүүгө кубанычтабыз — эс алууга убакыт бөлүңүз!', ru: 'Здравствуйте, {name}! Спасибо, что ранее выбирали PAR ORDO. Будем рады снова вас видеть — найдите время для хорошего отдыха!' },
    { title: 'Кыска чакыруу / Короткое приглашение', ky: '{name}, PAR ORDO сизди күтөт! 😊 Эс алууга келип кетиңиз. Ыңгайлуу убактыңызды бизге жазыңыз.', ru: '{name}, PAR ORDO ждёт вас! 😊 Заходите отдохнуть. Напишите, в какое время вам удобно прийти.' },
    { title: 'Өзүңүзгө убакыт / Время для себя', ky: 'Саламатсызбы, {name}! Кээде эң жакшы план — өзүңүзгө убакыт бөлүү. PAR ORDOго келип, эс алып кетиңиз.', ru: 'Здравствуйте, {name}! Иногда лучший план — уделить время себе. Приходите в PAR ORDO и отдохните в комфортной атмосфере.' },
    { title: 'Жумуштан кийин / После работы', ky: '{name}, жумуштан кийин бир аз эс алып алуу кандай? PAR ORDO сизди жылуу буу жана жайлуу атмосфера менен күтөт.', ru: '{name}, как насчёт отдыха после работы? В PAR ORDO вас ждут тёплая парная и уютная атмосфера.' },
    { title: 'Жылуу салам / Привет от PAR ORDO', ky: 'Саламатсызбы, {name}! Бул — PAR ORDO. Сизге жакшы маанай каалайбыз жана жакын арада эс алууга келип кетүүгө чакырабыз! 🌿', ru: 'Здравствуйте, {name}! Это PAR ORDO. Желаем вам отличного настроения и приглашаем заглянуть к нам на отдых! 🌿' },
    { title: 'Алдын ала убакытты сүйлөшүү / Уточнить время', ky: 'Саламатсызбы, {name}! PAR ORDOго келүүнү пландасаңыз, бизге жазыңыз — сизге ылайыктуу убакытты алдын ала сүйлөшүп алабыз.', ru: 'Здравствуйте, {name}! Если планируете посетить PAR ORDO, напишите нам — заранее согласуем удобное для вас время.' },
    { title: 'Тынч атмосфера / Спокойная атмосфера', ky: '{name}, күнүмдүк ызы-чуудан алыстап, тынч эс алууга чакырабыз. PAR ORDOдо сизди жылуу тосуп алабыз.', ru: '{name}, приглашаем отвлечься от суеты и спокойно отдохнуть. В PAR ORDO вас встретят с теплом и вниманием.' },
    { title: 'Жакшы маанай / Хорошее настроение', ky: 'Саламатсызбы, {name}! Жакшы маанайга бир кадам — өзүңүзгө эс алуу тартуулоо. PAR ORDOго келиңиз!', ru: 'Здравствуйте, {name}! Иногда для хорошего настроения достаточно устроить себе отдых. Приходите в PAR ORDO!' },
    { title: 'Апта ортосунда / Среди недели', ky: '{name}, эс алуу үчүн сөзсүз дем алышты күтүүнүн кереги жок. PAR ORDOго ыңгайлуу күнү келип кетиңиз.', ru: '{name}, не обязательно ждать выходных, чтобы отдохнуть. Загляните в PAR ORDO в удобный для вас день.' },
    { title: 'Досторду чакыруу / Пригласите друзей', ky: 'Саламатсызбы, {name}! Эгер досторуңуз менен эс алууну ойлонуп жүрсөңүз, PAR ORDOго чогуу келип кетиңиз. Сиздерди күтөбүз!', ru: 'Здравствуйте, {name}! Если собираетесь отдохнуть с друзьями, приходите в PAR ORDO вместе. Будем рады вашей компании!' },
    { title: 'Кыска эскертүү / Дружеское напоминание', ky: 'Саламатсызбы, {name}! 😊 PAR ORDOго эс алууга келүү планыңыз бар беле? Ыңгайлуу убактыңызды жазсаңыз, маалымат беребиз.', ru: 'Здравствуйте, {name}! 😊 Планировали заглянуть в PAR ORDO на отдых? Напишите удобное время — подскажем необходимую информацию.' },
    { title: 'Күнүмдүк түйшүктөн тыныгуу / Пауза от забот', ky: '{name}, өзүңүзгө кичинекей тыныгуу белек кылыңыз. PAR ORDO сизди тынч жана жайлуу эс алууга чакырат.', ru: '{name}, подарите себе небольшую паузу от повседневных забот. PAR ORDO приглашает вас на спокойный и комфортный отдых.' },
    { title: 'Рахмат жана чакыруу / Благодарим и приглашаем', ky: 'Саламатсызбы, {name}! PAR ORDOну тандаганыңыз үчүн чоң рахмат. Сизди кайрадан көрүүгө жана тейлөөгө кубанычтабыз.', ru: 'Здравствуйте, {name}! Спасибо, что выбирали PAR ORDO. Будем рады снова видеть вас и позаботиться о вашем комфортном отдыхе.' },
    { title: 'Өзүңүзгө кам көрүү / Позаботьтесь о себе', ky: '{name}, өзүңүзгө кам көрүп, эс алууга убакыт бөлүңүз. PAR ORDO сизди күтөт. Келүү убактыңызды бизге жазсаңыз болот.', ru: '{name}, позаботьтесь о себе и выделите время на отдых. PAR ORDO ждёт вас. Можете написать нам, когда планируете прийти.' },
    { title: 'Жеке чакыруу / Личное приглашение', ky: 'Саламатсызбы, {name}! Сизди PAR ORDOго жеке чакырабыз. Келүүгө ыңгайлуу күнүңүз жана убактыңыз болсо, бизге жазыңыз. Кош келиңиз!', ru: 'Здравствуйте, {name}! Лично приглашаем вас в PAR ORDO. Напишите, в какой день и время вам удобно прийти. Будем рады встрече!' }
  ];

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const selectedIndex = () => {
    const raw = Number(localStorage.getItem(STORAGE_KEY) || 0);
    return Number.isInteger(raw) && raw >= 0 && raw < templates.length ? raw : 0;
  };
  const selectedLanguage = () => localStorage.getItem(LANG_KEY) === 'ky' ? 'ky' : 'ru';
  const normalizePhone = (value) => {
    let digits = String(value || '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('0')) digits = '996' + digits.slice(1);
    else if (!digits.startsWith('996') && digits.length === 9) digits = '996' + digits;
    return /^\d{8,15}$/.test(digits) ? digits : '';
  };
  const messageFor = (index, language, name) => templates[index][language].replace(/\{name\}/g, String(name || '').trim() || (language === 'ky' ? 'кардар' : 'гость'));

  const css = document.createElement('style');
  css.id = 'par-ordo-whatsapp-invites-style-v114';
  css.textContent = `
    .parordo-wa-picker{margin:12px 0 14px;padding:13px;border:1px solid #8c6b36;border-radius:16px;background:linear-gradient(140deg,rgba(25,35,25,.96),rgba(12,17,12,.96));box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 8px 22px #0003;color:#f7ecd4}
    .parordo-wa-picker-title{display:flex;align-items:center;gap:8px;font-weight:900;font-size:13px;letter-spacing:.035em}
    .parordo-wa-picker-title .wa-mark{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:10px;background:#0a3321;border:1px solid #278657;color:#83f3b0;font-size:17px}
    .parordo-wa-picker-controls{display:grid;grid-template-columns:minmax(0,1fr) 110px;gap:8px;margin-top:10px}
    .parordo-wa-picker select{width:100%;min-width:0;min-height:43px;border:1px solid #70562e;border-radius:10px;padding:8px 10px;background:#100e09;color:#f9e7bd;font-size:12px;font-weight:700}
    .parordo-wa-preview{margin-top:9px;padding:10px 11px;border:1px solid rgba(173,135,69,.42);border-radius:11px;background:rgba(5,9,6,.56)}
    .parordo-wa-preview-label{display:block;color:#c6ac79;font-weight:900;font-size:9px;letter-spacing:.13em;margin-bottom:5px}
    .parordo-wa-preview-text{margin:0;color:#eee4d2;font-size:12px;font-weight:600;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
    .parordo-wa-hint{margin:8px 0 0;color:#bbaa8e;font-size:10px;line-height:1.45}
    .parordo-wa-phone-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:3px 0 6px;min-width:0}
    .parordo-wa-phone-row>small{flex:1 1 160px;min-width:0}
    .parordo-whatsapp-notify{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:35px;padding:7px 10px;border:1px solid #2b9861;border-radius:10px;background:linear-gradient(135deg,#10472c,#0b2b1c);color:#a4ffd0;font-size:10px;font-weight:900;white-space:nowrap;box-shadow:inset 0 1px 0 #ffffff14}
    .parordo-whatsapp-notify:active{transform:translateY(1px)}
    .parordo-whatsapp-notify:disabled{opacity:.45;cursor:not-allowed}
    @media(max-width:420px){.parordo-wa-picker{padding:10px}.parordo-wa-picker-controls{grid-template-columns:minmax(0,1fr) 94px}.parordo-wa-picker select{font-size:11px;padding:7px}.parordo-whatsapp-notify{font-size:10px;min-height:38px}}
  `;
  document.head.appendChild(css);

  function renderPreview() {
    const select = document.getElementById('parordoWaTemplate');
    const lang = document.getElementById('parordoWaLanguage');
    const preview = document.getElementById('parordoWaPreviewText');
    if (!select || !lang || !preview) return;
    const index = Number(select.value);
    const validIndex = Number.isInteger(index) && index >= 0 && index < templates.length ? index : 0;
    localStorage.setItem(STORAGE_KEY, String(validIndex));
    localStorage.setItem(LANG_KEY, lang.value === 'ky' ? 'ky' : 'ru');
    preview.textContent = messageFor(validIndex, lang.value, lang.value === 'ky' ? 'Азамат' : 'Азамат');
  }

  function ensurePicker() {
    const modalCard = document.getElementById('customerBaseModalCard');
    if (!modalCard || !modalCard.querySelector('.customer-base-tabs')) return;
    let panel = modalCard.querySelector('.parordo-wa-picker');
    if (!panel) {
      const index = selectedIndex();
      const language = selectedLanguage();
      panel = document.createElement('section');
      panel.className = 'parordo-wa-picker';
      panel.setAttribute('aria-label', 'WhatsApp — приглашения клиентам');
      panel.innerHTML = `
        <div class="parordo-wa-picker-title"><span class="wa-mark" aria-hidden="true">↗</span><span>WhatsApp · Уведомления клиентам</span></div>
        <div class="parordo-wa-picker-controls">
          <select id="parordoWaTemplate" aria-label="Выбрать текст приглашения">
            ${templates.map((item, i) => `<option value="${i}" ${i === index ? 'selected' : ''}>${String(i + 1).padStart(2,'0')}. ${escapeHtml(item.title)}</option>`).join('')}
          </select>
          <select id="parordoWaLanguage" aria-label="Язык приглашения"><option value="ru" ${language === 'ru' ? 'selected' : ''}>Русский</option><option value="ky" ${language === 'ky' ? 'selected' : ''}>Кыргызча</option></select>
        </div>
        <div class="parordo-wa-preview"><span class="parordo-wa-preview-label">ПРЕДПРОСМОТР СООБЩЕНИЯ</span><p id="parordoWaPreviewText" class="parordo-wa-preview-text"></p></div>
        <p class="parordo-wa-hint">1) Выберите приглашение. 2) Нажмите «WhatsApp · Уведомление» рядом с нужным клиентом. Откроется его чат с готовым текстом — отправку подтвердите в WhatsApp.</p>`;
      modalCard.querySelector('.customer-base-tabs').insertAdjacentElement('afterend', panel);
      panel.querySelector('#parordoWaTemplate').addEventListener('change', renderPreview);
      panel.querySelector('#parordoWaLanguage').addEventListener('change', renderPreview);
    }
    renderPreview();
  }

  function enhanceCustomerCards() {
    const list = document.getElementById('customerBaseList');
    if (!list) return;
    list.querySelectorAll('.customer-base-entry').forEach(card => {
      const main = card.querySelector('.customer-base-entry-main');
      if (!main || main.querySelector('.parordo-wa-phone-row')) return;
      const metadata = Array.from(main.children).find(el => el.tagName === 'SMALL');
      const nameNode = Array.from(main.children).find(el => el.tagName === 'STRONG');
      if (!metadata || !nameNode) return;
      const metadataText = metadata.textContent || '';
      const phoneMatch = metadataText.match(/Телефон:\s*(.*?)(?:\s*[·|]\s*Добавлен:|$)/i);
      const phone = phoneMatch && !/Телефон не указан/i.test(phoneMatch[1]) ? phoneMatch[1].trim() : '';
      const row = document.createElement('div');
      row.className = 'parordo-wa-phone-row';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'parordo-whatsapp-notify';
      button.textContent = phone ? '↗ WhatsApp · Уведомление' : 'Нет телефона';
      button.disabled = !phone;
      button.setAttribute('aria-label', phone ? `Открыть WhatsApp для ${nameNode.textContent}` : 'У клиента нет телефона');
      button.dataset.phone = phone;
      button.dataset.name = nameNode.textContent || '';
      metadata.replaceWith(row);
      row.append(metadata, button);
    });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('.parordo-whatsapp-notify');
    if (!button || button.disabled) return;
    event.preventDefault();
    const phone = normalizePhone(button.dataset.phone);
    if (!phone) {
      window.alert('Номер телефона не распознан. Проверьте номер клиента, включая код страны.');
      return;
    }
    const templateIndex = selectedIndex();
    const language = selectedLanguage();
    const message = messageFor(templateIndex, language, button.dataset.name);
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = url;
  });

  const observer = new MutationObserver(() => {
    ensurePicker();
    enhanceCustomerCards();
  });
  function start() {
    ensurePicker();
    enhanceCustomerCards();
    if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
