/* PAR ORDO PRO V113 — safe single-day cleanup UI. Admin-only. */
(() => {
  'use strict';
  const API = 'https://par-ordo-api.moimarketjibekjolu.workers.dev';
  const dayDefault = '2026-10-25';
  const tokenKey = 'parordo_admin_token';
  const roleKey = 'parordo_admin_role';
  const authToken = () => sessionStorage.getItem(tokenKey) || '';
  const role = () => sessionStorage.getItem(roleKey) || 'admin';
  const request = async (path, options = {}) => {
    const headers = { Accept: 'application/json', Authorization: `Bearer ${authToken()}` };
    if (options.body) headers['Content-Type'] = 'application/json';
    const res = await fetch(API + path, { ...options, headers: { ...headers, ...(options.headers || {}) }, cache: 'no-store' });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) throw new Error(data?.error || `API ${res.status}`);
    return data;
  };
  const money = value => `${Number(value || 0).toLocaleString('ru-RU')} сом`;

  const style = document.createElement('style');
  style.id = 'par-ordo-day-cleanup-v113-style';
  style.textContent = `
  #poDayCleanup{display:none;margin:16px 0;padding:18px;border:1px solid rgba(214,73,63,.52);border-radius:20px;background:linear-gradient(145deg,rgba(20,24,18,.97),rgba(7,12,9,.98));box-shadow:0 12px 28px #0005;color:#f8f0df}
  #poDayCleanup *{box-sizing:border-box}#poDayCleanup .po-dc-eyebrow{font-size:10px;font-weight:900;letter-spacing:.15em;color:#f1b96a}
  #poDayCleanup h2{margin:5px 0 8px;font:700 22px/1.2 Georgia,serif;color:#fff4dc}#poDayCleanup p{font-size:12px;line-height:1.55;color:#c6cbbf;margin:7px 0 12px;font-weight:600}
  #poDayCleanup .po-dc-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:10px 0}#poDayCleanup input[type=date],#poDayCleanup input[type=text]{min-height:44px;min-width:0;width:100%;padding:10px 12px;border-radius:11px;border:1px solid #6c5634;background:#fff8e9;color:#22170b;font:600 14px system-ui,sans-serif}
  #poDayCleanup .po-dc-btn{min-height:43px;padding:10px 13px;border-radius:11px;border:1px solid #8c6b35;background:linear-gradient(135deg,#392711,#1a1209);color:#ffdfa0;font:800 11px/1.3 system-ui,sans-serif;letter-spacing:.025em}
  #poDayCleanup .po-dc-btn.primary{background:linear-gradient(135deg,#d8a23c,#ffe09a);border-color:#ffe5a7;color:#241706}
  #poDayCleanup .po-dc-btn.danger{background:linear-gradient(135deg,#7f201d,#3a100e);border-color:#e85c51;color:#ffe6e1}
  #poDayCleanup .po-dc-btn:disabled{opacity:.45;filter:grayscale(.6)}#poDayCleanup .po-dc-results{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0}
  #poDayCleanup .po-dc-stat{padding:10px;border:1px solid rgba(210,177,104,.25);border-radius:13px;background:rgba(5,10,7,.6);min-width:0}
  #poDayCleanup .po-dc-stat small{display:block;font-size:9px;font-weight:800;letter-spacing:.05em;color:#c5b58e;line-height:1.4}
  #poDayCleanup .po-dc-stat strong{display:block;margin-top:5px;font-size:16px;font-weight:900;color:#ffe1a0;overflow-wrap:anywhere}
  #poDayCleanup .po-dc-note{padding:10px 11px;border-radius:12px;background:rgba(93,35,22,.28);border:1px solid rgba(222,98,75,.28);font-size:11px;line-height:1.5;color:#efd5c6;font-weight:600}
  #poDayCleanup .po-dc-check{display:flex;gap:9px;align-items:flex-start;margin:12px 0;font-size:11px;line-height:1.5;color:#dfd3b9;font-weight:650}#poDayCleanup .po-dc-check input{margin-top:2px;accent-color:#daac4c}
  #poDayCleanup .po-dc-status{font-size:12px;line-height:1.5;margin-top:10px;color:#dbd5c8;white-space:pre-wrap}#poDayCleanup .po-dc-status.error{color:#ff9990}#poDayCleanup .po-dc-status.success{color:#8bf0ae}
  @media(min-width:900px){#poDayCleanup{padding:22px}#poDayCleanup .po-dc-results{grid-template-columns:repeat(4,minmax(0,1fr))}#poDayCleanup h2{font-size:25px}}
  `;
  document.head.appendChild(style);

  const mount = () => {
    if (document.getElementById('poDayCleanup')) return;
    const reportView = document.getElementById('reportView');
    if (!reportView) return;
    const card = document.createElement('section');
    card.id = 'poDayCleanup';
    card.innerHTML = `
      <div class="po-dc-eyebrow">АДМИНИСТРАТОР · БЕЗОПАСНАЯ ОЧИСТКА</div>
      <h2>Очистка истории за дату</h2>
      <p>Сначала проверьте записи и скачайте резервную копию. Удаляются только посещения и сменные отчёты выбранного дня, а также бонусные claims, привязанные к удалённым сеансам. Постоянная база клиентов, товары/физические остатки, расходы, записи на посещение и журнал аудита сохраняются.</p>
      <div class="po-dc-row"><div style="flex:1 1 190px;min-width:0"><input id="poDcDay" type="date" value="${dayDefault}" aria-label="Дата для очистки"></div><button type="button" class="po-dc-btn primary" id="poDcPreview">Проверить данные</button></div>
      <div id="poDcResults" class="po-dc-results" hidden></div>
      <div class="po-dc-row"><button type="button" class="po-dc-btn" id="poDcBackup" disabled>⬇ Скачать резервную копию дня</button></div>
      <label class="po-dc-check"><input type="checkbox" id="poDcBackupSaved"><span>Я скачал и сохранил резервную копию выбранного дня.</span></label>
      <div style="margin:10px 0"><label for="poDcConfirm" style="display:block;font-size:10px;font-weight:900;letter-spacing:.08em;color:#ddb96d;margin-bottom:6px">ПОДТВЕРЖДЕНИЕ: ВВЕДИТЕ ТЕКСТ ТОЧНО</label><input id="poDcConfirm" type="text" placeholder="ОЧИСТИТЬ 2026-10-25" autocomplete="off" spellcheck="false"></div>
      <div class="po-dc-row"><button type="button" class="po-dc-btn danger" id="poDcExecute" disabled>Очистить выбранный день</button></div>
      <div class="po-dc-note">Важно: активные сеансы не удаляются — при их наличии система остановит очистку. Физические остатки товаров и журнал audit log автоматически не меняются; если данные за этот день были тестовыми и нужно восстановить остатки, это отдельная операция.</div>
      <div id="poDcStatus" class="po-dc-status" role="status" aria-live="polite"></div>`;
    const reportPanel = reportView.querySelector('.report-panel');
    if (reportPanel) reportPanel.insertAdjacentElement('afterend', card);
    else reportView.appendChild(card);

    const dayInput = card.querySelector('#poDcDay');
    const previewButton = card.querySelector('#poDcPreview');
    const backupButton = card.querySelector('#poDcBackup');
    const backupCheck = card.querySelector('#poDcBackupSaved');
    const confirmInput = card.querySelector('#poDcConfirm');
    const executeButton = card.querySelector('#poDcExecute');
    const resultBox = card.querySelector('#poDcResults');
    const statusBox = card.querySelector('#poDcStatus');
    let preview = null;

    const setStatus = (message, type='') => { statusBox.textContent = message; statusBox.className = `po-dc-status ${type}`; };
    const resetConfirmation = () => { backupCheck.checked = false; confirmInput.value = ''; executeButton.disabled = true; };
    const refreshExecuteState = () => {
      const expected = `ОЧИСТИТЬ ${dayInput.value}`;
      executeButton.disabled = !(preview?.canClear && preview?.activeClients === 0 && !preview?.currentShiftMatchesDay && backupCheck.checked && confirmInput.value.trim() === expected);
    };
    const renderPreview = data => {
      const stats = [
        ['Посещений найдено', data.clientCount],
        ['Завершённых сеансов', data.completedClients],
        ['Активных сеансов', data.activeClients],
        ['Наличные по сеансам', money(data.clientCashTotal)],
        ['Перевод по сеансам', money(data.clientTransferTotal)],
        ['Оплачено по сеансам', money(data.clientPaidTotal)],
        ['Сменных отчётов', data.reportCount],
        ['Клиентов в отчётах', data.reportClientCount],
        ['Наличные в отчётах', money(data.reportCashTotal)],
        ['Перевод в отчётах', money(data.reportTransferTotal)],
        ['Итого в отчётах', money(data.reportPaidTotal)],
        ['Связанных бонусных записей', data.linkedBonusClaims]
      ];
      resultBox.innerHTML = stats.map(([label,value]) => `<div class="po-dc-stat"><small>${label}</small><strong>${value}</strong></div>`).join('');
      resultBox.hidden = false;
      backupButton.disabled = !data.canClear;
      if (!data.canClear) setStatus('Записей для очистки по этой дате не найдено.');
      else if (data.activeClients > 0) setStatus('Найдены активные сеансы. Для безопасности очистка заблокирована.', 'error');
      else if (data.currentShiftMatchesDay) setStatus('Эта дата совпадает с активной сменой. Сначала завершите смену.', 'error');
      else setStatus('Проверьте суммы и количество. Перед очисткой скачайте резервную копию.');
      refreshExecuteState();
    };

    previewButton.addEventListener('click', async () => {
      preview = null; backupButton.disabled = true; resultBox.hidden = true; resetConfirmation(); previewButton.disabled = true; previewButton.textContent = 'Проверка…';
      try {
        const day = dayInput.value;
        if (!day) throw new Error('Выберите дату.');
        const data = await request(`/api/admin/control/cleanup-day?day=${encodeURIComponent(day)}`);
        preview = data; renderPreview(data);
      } catch (e) { setStatus(`Не удалось получить данные: ${e.message}`, 'error'); }
      finally { previewButton.disabled = false; previewButton.textContent = 'Проверить данные'; }
    });
    backupButton.addEventListener('click', async () => {
      if (!preview?.canClear) return;
      backupButton.disabled = true; backupButton.textContent = 'Подготовка копии…';
      try {
        const data = await request(`/api/admin/control/cleanup-day?day=${encodeURIComponent(dayInput.value)}&includeData=1`);
        const blob = new Blob([JSON.stringify(data.snapshot, null, 2)], {type:'application/json;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `par-ordo-day-backup-${dayInput.value}.json`; a.style.display='none'; document.body.appendChild(a); a.click(); a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 30000);
        setStatus('Резервная копия подготовлена и скачивание запущено. Проверьте её в папке Downloads/Загрузки, затем отметьте галочку.');
      } catch (e) { setStatus(`Не удалось скачать копию: ${e.message}`, 'error'); }
      finally { backupButton.disabled = !preview?.canClear; backupButton.textContent = '⬇ Скачать резервную копию дня'; }
    });
    [dayInput, backupCheck, confirmInput].forEach(el => el.addEventListener('input', () => { if (el === dayInput) { preview = null; resultBox.hidden=true; backupButton.disabled=true; } refreshExecuteState(); }));
    executeButton.addEventListener('click', async () => {
      if (!preview) return;
      const day = dayInput.value;
      if (!window.confirm(`ВНИМАНИЕ! Будут удалены история посещений и сменные отчёты за ${day}, а дневные суммы пересчитаются без этих записей. Удаление невозможно отменить без резервной копии. Продолжить?`)) return;
      executeButton.disabled = true; executeButton.textContent = 'Очистка…';
      try {
        const data = await request('/api/admin/control/cleanup-day', {method:'POST', body:JSON.stringify({day,previewHash:preview.previewHash,confirmation:`ОЧИСТИТЬ ${day}`,backupConfirmed:backupCheck.checked})});
        setStatus(`${data.message}\nУдалено сеансов: ${data.deletedClientSessions}; сменных отчётов: ${data.deletedShiftReports}; связанных бонусных записей: ${data.deletedRelatedBonusClaims}.`, 'success');
        preview = await request(`/api/admin/control/cleanup-day?day=${encodeURIComponent(day)}`);
        renderPreview(preview); resetConfirmation();
      } catch (e) { setStatus(`Очистка не выполнена: ${e.message}`, 'error'); }
      finally { executeButton.textContent = 'Очистить выбранный день'; refreshExecuteState(); }
    });

    const updateAccess = () => { card.style.display = role() === 'admin' ? 'block' : 'none'; };
    updateAccess();
    const app = document.getElementById('appView');
    if (app && 'MutationObserver' in window) new MutationObserver(updateAccess).observe(app, {attributes:true, attributeFilter:['class']});
    window.addEventListener('storage', updateAccess);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  else mount();
})();
