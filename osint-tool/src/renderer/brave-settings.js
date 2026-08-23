document.addEventListener('DOMContentLoaded', () => {
  ensureEnrichmentProviderUi();
  document.getElementById('save-brave-key')?.addEventListener('click', saveBraveKey);
  document.getElementById('clear-brave-key')?.addEventListener('click', clearBraveKey);
  document.getElementById('save-urlscan-key')?.addEventListener('click', () => saveProviderKey({ inputId: 'urlscan-api-key', settingName: 'urlscanApiKey', label: 'urlscan.io' }));
  document.getElementById('clear-urlscan-key')?.addEventListener('click', () => clearProviderKey({ inputId: 'urlscan-api-key', clearName: 'clearUrlscanApiKey', label: 'urlscan.io' }));
  document.getElementById('save-virustotal-key')?.addEventListener('click', () => saveProviderKey({ inputId: 'virustotal-api-key', settingName: 'virusTotalApiKey', label: 'VirusTotal' }));
  document.getElementById('clear-virustotal-key')?.addEventListener('click', () => clearProviderKey({ inputId: 'virustotal-api-key', clearName: 'clearVirusTotalApiKey', label: 'VirusTotal' }));
  document.getElementById('save-shodan-key')?.addEventListener('click', () => saveProviderKey({ inputId: 'shodan-api-key', settingName: 'shodanApiKey', label: 'Shodan' }));
  document.getElementById('clear-shodan-key')?.addEventListener('click', () => clearProviderKey({ inputId: 'shodan-api-key', clearName: 'clearShodanApiKey', label: 'Shodan' }));
  refreshProviderStates();
});

function ensureEnrichmentProviderUi() {
  const readinessPanel = document.querySelector('.readiness-panel');
  if (readinessPanel && !document.getElementById('urlscan-readiness')) {
    const note = readinessPanel.querySelector('.panel-note');
    const rows = document.createElement('div');
    rows.innerHTML = `
      <div class="readiness-row"><span>Wayback Archive + IP RDAP</span><strong class="status-ready">جاهز</strong></div>
      <div class="readiness-row"><span>urlscan.io Search API</span><strong id="urlscan-readiness" class="status-muted">غير مضبوط</strong></div>
      <div class="readiness-row"><span>VirusTotal API v3</span><strong id="virustotal-readiness" class="status-muted">غير مضبوط</strong></div>
      <div class="readiness-row"><span>Shodan Host API</span><strong id="shodan-readiness" class="status-muted">غير مضبوط</strong></div>`;
    while (rows.firstElementChild) readinessPanel.insertBefore(rows.firstElementChild, note || null);
  }

  const settingsLayout = document.querySelector('.settings-layout');
  if (settingsLayout && !document.getElementById('urlscan-api-key')) {
    settingsLayout.insertAdjacentHTML('beforeend', `
      <div class="panel">
        <div class="panel-heading"><div><h3>urlscan.io</h3><p>يبحث في website scans الموجودة مسبقًا؛ التطبيق لا ينشئ scans عامة تلقائيًا.</p></div><span id="urlscan-key-state" class="status-muted">غير مضبوط</span></div>
        <label class="field"><span>API key</span><input type="password" id="urlscan-api-key" maxlength="256" autocomplete="new-password" placeholder="أدخل urlscan.io API key"></label>
        <div class="inline-actions"><button class="btn btn-primary" id="save-urlscan-key" type="button">حفظ المفتاح</button><button class="btn btn-ghost" id="clear-urlscan-key" type="button">حذف المفتاح</button></div>
        <p class="panel-note">يتم استخدام Search API فقط. إرسال URL لإنشاء scan جديد غير مفعّل تلقائيًا.</p>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><h3>VirusTotal API v3</h3><p>قراءة domain reputation والتصنيفات ونتائج التحليل الموجودة لدى المزود.</p></div><span id="virustotal-key-state" class="status-muted">غير مضبوط</span></div>
        <label class="field"><span>API key</span><input type="password" id="virustotal-api-key" maxlength="256" autocomplete="new-password" placeholder="أدخل VirusTotal API key"></label>
        <div class="inline-actions"><button class="btn btn-primary" id="save-virustotal-key" type="button">حفظ المفتاح</button><button class="btn btn-ghost" id="clear-virustotal-key" type="button">حذف المفتاح</button></div>
        <p class="panel-note">التكامل read-only لتقارير النطاق؛ لا يرفع ملفات ولا يطلب scan جديدًا.</p>
      </div>
      <div class="panel">
        <div class="panel-heading"><div><h3>Shodan Host API</h3><p>قراءة host/services الموجودة مسبقًا في فهرس Shodan لعناوين IP العامة التي ظهرت من DNS.</p></div><span id="shodan-key-state" class="status-muted">غير مضبوط</span></div>
        <label class="field"><span>API key</span><input type="password" id="shodan-api-key" maxlength="256" autocomplete="new-password" placeholder="أدخل Shodan API key"></label>
        <div class="inline-actions"><button class="btn btn-primary" id="save-shodan-key" type="button">حفظ المفتاح</button><button class="btn btn-ghost" id="clear-shodan-key" type="button">حذف المفتاح</button></div>
        <p class="panel-note">يستخدم Host Information read-only مع minify=true. لا يطلب scan أو monitor جديدًا.</p>
      </div>`);
  }

  const toolsGrid = document.querySelector('.tools-grid');
  if (toolsGrid && !document.getElementById('tools-passive-state')) {
    toolsGrid.insertAdjacentHTML('beforeend', `
      <article class="panel tool-panel">
        <div class="panel-heading"><div><h3>Passive Infrastructure Enrichment</h3><p>Wayback + IP RDAP + urlscan.io + VirusTotal + Shodan.</p></div><span id="tools-passive-state" class="status-ready">2 built-in</span></div>
        <p class="panel-note">يعمل على domain وpublic IP المشتقين من بيانات الحالة. Wayback وIP RDAP جاهزان بدون مفتاح؛ باقي المزودات اختيارية بمفاتيح محفوظة بأمان.</p>
      </article>`);
  }

  const formHint = document.getElementById('form-hint');
  if (formHint) formHint.textContent = 'مفاتيح HIBP وBrave وurlscan وVirusTotal وShodan لا تُعاد إلى renderer بعد حفظها.';
}

async function saveBraveKey() {
  return saveProviderKey({ inputId: 'brave-api-key', settingName: 'braveApiKey', label: 'Brave Search' });
}

async function clearBraveKey() {
  return clearProviderKey({ inputId: 'brave-api-key', clearName: 'clearBraveApiKey', label: 'Brave Search' });
}

async function saveProviderKey(config) {
  const input = document.getElementById(config.inputId);
  const value = input?.value.trim() || '';
  if (!value) {
    showNotification(`أدخل مفتاح ${config.label} أو استخدم زر حذف المفتاح.`, 'warning');
    return;
  }
  const result = await api.settings.save({ [config.settingName]: value });
  if (!result.success) {
    showNotification(result.error || `تعذر حفظ مفتاح ${config.label}.`, 'error');
    return;
  }
  input.value = '';
  showNotification(`تم حفظ مفتاح ${config.label} في التخزين الآمن للنظام.`, 'success');
  await refreshProviderStates();
}

async function clearProviderKey(config) {
  const result = await api.settings.save({ [config.clearName]: true });
  if (!result.success) {
    showNotification(result.error || `تعذر حذف مفتاح ${config.label}.`, 'error');
    return;
  }
  const input = document.getElementById(config.inputId);
  if (input) input.value = '';
  showNotification(`تم حذف مفتاح ${config.label} المحفوظ.`, 'success');
  await refreshProviderStates();
}

function setState(ids, ready) {
  for (const elementId of ids) {
    const element = document.getElementById(elementId);
    if (!element) continue;
    element.textContent = ready ? 'جاهز' : 'غير مضبوط';
    element.className = ready ? 'status-ready' : 'status-muted';
  }
}

async function refreshProviderStates() {
  try {
    const result = await api.settings.get();
    if (!result.success) return;
    const settings = result.settings || {};
    setState(['brave-key-state', 'brave-readiness', 'tools-brave-state'], Boolean(settings.hasBraveApiKey));
    setState(['urlscan-key-state', 'urlscan-readiness'], Boolean(settings.hasUrlscanApiKey));
    setState(['virustotal-key-state', 'virustotal-readiness'], Boolean(settings.hasVirusTotalApiKey));
    setState(['shodan-key-state', 'shodan-readiness'], Boolean(settings.hasShodanApiKey));

    const passive = document.getElementById('tools-passive-state');
    if (passive) {
      const optional = Number(Boolean(settings.hasUrlscanApiKey)) + Number(Boolean(settings.hasVirusTotalApiKey)) + Number(Boolean(settings.hasShodanApiKey));
      passive.textContent = `${2 + optional}/5 جاهز`;
      passive.className = optional === 3 ? 'status-ready' : 'status-muted';
    }
  } catch {
    // Keep conservative default state when settings cannot be read.
  }
}
