'use strict';

const api = window.osint;
let currentPersonId = null;

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch { return null; }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!api) {
    document.body.textContent = 'Secure application bridge failed to load.';
    return;
  }
  initializeNavigation();
  initializeInvestigationForm();
  initializeTabs();
  initializeSettings();
  initializeDelegatedActions();
  await Promise.all([loadInvestigations(), loadRuntimeConfig()]);
});

function initializeNavigation() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => activateView(item.dataset.view));
  });
}

function activateView(viewName) {
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === viewName));
  document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
  document.getElementById(`${viewName}-view`)?.classList.add('active');
  if (viewName === 'investigations') loadInvestigations();
}

function initializeInvestigationForm() {
  document.getElementById('investigation-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = {
      name: document.getElementById('target-name').value.trim(),
      email: document.getElementById('target-email').value.trim(),
      username: document.getElementById('target-username').value.trim()
    };
    if (!data.email && !data.username) {
      showNotification('يجب إدخال بريد إلكتروني أو اسم مستخدم على الأقل', 'warning');
      return;
    }
    await startInvestigation(data);
  });
}

async function startInvestigation(data) {
  let removeProgressListener = () => {};
  try {
    showLoading('جارٍ إنشاء التحقيق…');
    const result = await api.addPerson(data);
    if (!result.success) throw new Error(result.error);
    currentPersonId = result.personId;

    removeProgressListener = api.onInvestigationUpdate((update) => addProgressMessage(update.message, update.status));
    updateLoadingMessage('جارٍ جمع الأدلة العامة…');
    const investigation = await api.startInvestigation(currentPersonId);
    if (!investigation.success) throw new Error(investigation.error);

    showResults(investigation.report);
    showNotification('اكتمل الجمع. راجع المرشحين وحدود الثقة يدويًا.', 'success');
  } catch (error) {
    showNotification(`خطأ: ${error.message}`, 'error');
  } finally {
    removeProgressListener();
    hideLoading();
  }
}

async function loadInvestigations() {
  const container = document.getElementById('investigations-list');
  try {
    const result = await api.getAllPersons();
    if (!result.success) throw new Error(result.error);
    if (result.persons.length === 0) {
      container.innerHTML = '<div class="card"><p class="empty-state">لا توجد تحقيقات بعد.</p></div>';
      return;
    }
    container.innerHTML = result.persons.map((person) => `
      <button type="button" class="investigation-card" data-person-id="${Number(person.id)}">
        <h3>${escapeHtml(person.name || person.username || 'غير محدد')}</h3>
        <p>📧 ${escapeHtml(person.email || 'غير محدد')}</p>
        <p>👤 ${escapeHtml(person.username || 'غير محدد')}</p>
        <p class="date">📅 ${escapeHtml(formatDate(person.created_at))}</p>
      </button>
    `).join('');
  } catch (error) {
    container.textContent = `تعذر تحميل التحقيقات: ${error.message}`;
  }
}

async function loadInvestigation(personId) {
  try {
    showLoading('جارٍ تحميل التحقيق…');
    currentPersonId = Number(personId);
    const result = await api.getReport(currentPersonId);
    if (!result.success) throw new Error(result.error);
    showResults(result.report);
  } catch (error) {
    showNotification(`خطأ: ${error.message}`, 'error');
  } finally {
    hideLoading();
  }
}

function showResults(report) {
  document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
  document.getElementById('results-view').classList.add('active');
  displaySummary(report);
  displayOverview(report);
  displaySocialAccounts(report.socialAccounts || []);
  displayBreaches(report.breaches || []);
  displayDomains(report.domains || []);
  displayGraph(report.graph);
  displayLogs(report.logs || []);
}

function displaySummary(report) {
  const summary = report.summary || {};
  const confidence = safeNumber(summary.overallConfidence);
  document.getElementById('results-summary').innerHTML = `
    <div class="summary-card"><div class="icon">👤</div><div class="value">${safeNumber(summary.totalSocialAccounts)}</div><div class="label">حسابات مرشحة</div></div>
    <div class="summary-card"><div class="icon">⚠️</div><div class="value">${safeNumber(summary.totalBreaches)}</div><div class="label">سجلات HIBP</div></div>
    <div class="summary-card"><div class="icon">🌐</div><div class="value">${safeNumber(summary.totalDomains)}</div><div class="label">سجلات RDAP</div></div>
    <div class="summary-card"><div class="icon">📊</div><div class="value">${confidence.toFixed(1)}%</div><div class="label">ثقة الأدلة: ${escapeHtml(summary.confidenceLevel || 'غير محدد')}</div></div>
  `;
}

function displayOverview(report) {
  const person = report.person || {};
  const summary = report.summary || {};
  document.getElementById('overview-content').innerHTML = `
    <div class="card">
      <h3>📋 مدخلات القضية</h3>
      <p><strong>الاسم:</strong> ${escapeHtml(person.name || 'غير محدد')}</p>
      <p><strong>البريد الإلكتروني:</strong> ${escapeHtml(person.email || 'غير محدد')}</p>
      <p><strong>اسم المستخدم:</strong> ${escapeHtml(person.username || 'غير محدد')}</p>
      <p><strong>تاريخ الإنشاء:</strong> ${escapeHtml(formatDate(person.created_at))}</p>
    </div>
    <div class="card">
      <h3>حدود الاستنتاج</h3>
      <p>وصول رابط حساب هو مرشح فقط، وليس إثباتًا أن الحساب يعود للشخص.</p>
      <p>نتائج HIBP وRDAP تُحفظ فقط عند وصول استجابة فعلية من مزودها؛ لا يولد التطبيق بيانات وهمية.</p>
      <p>راجع المصدر والسياق والتاريخ قبل تحويل أي مرشح إلى استنتاج.</p>
      <p>إجمالي العناصر المحفوظة: <strong>${safeNumber(summary.totalSocialAccounts) + safeNumber(summary.totalBreaches) + safeNumber(summary.totalDomains)}</strong></p>
    </div>
  `;
}

function displaySocialAccounts(accounts) {
  const container = document.getElementById('social-content');
  if (accounts.length === 0) {
    container.innerHTML = '<div class="card"><p>لم تُحفظ روابط حسابات مرشحة.</p></div>';
    return;
  }
  container.innerHTML = `<div class="data-table"><table><thead><tr><th>المنصة</th><th>اسم المستخدم</th><th>المصدر</th><th>ثقة المرشح</th></tr></thead><tbody>${accounts.map((account) => {
    const additional = parseJson(account.additional_data, {});
    const url = safeHttpsUrl(account.profile_url);
    const confidence = safeNumber(account.confidence_score);
    return `<tr>
      <td>${escapeHtml(additional.icon || '👤')} ${escapeHtml(account.platform)}</td>
      <td>@${escapeHtml(account.username)}</td>
      <td>${url ? `<button type="button" class="link-button" data-external-url="${escapeHtml(url)}">فتح المصدر</button>` : 'رابط غير صالح'}</td>
      <td><span class="badge badge-${getConfidenceBadgeClass(confidence)}">${confidence.toFixed(1)}%</span></td>
    </tr>`;
  }).join('')}</tbody></table></div>`;
}

function displayBreaches(breaches) {
  const container = document.getElementById('breaches-content');
  if (breaches.length === 0) {
    container.innerHTML = '<div class="card"><p>لا توجد سجلات HIBP محفوظة. قد يعني ذلك عدم وجود نتائج، أو أن التكامل غير معد.</p></div>';
    return;
  }
  container.innerHTML = breaches.map((breach) => {
    const classes = parseJson(breach.data_classes, []);
    return `<div class="card"><h3>⚠️ ${escapeHtml(breach.breach_name)}</h3>
      <p><strong>البريد:</strong> ${escapeHtml(breach.email)}</p>
      <p><strong>التاريخ:</strong> ${escapeHtml(breach.breach_date || 'غير محدد')}</p>
      <p><strong>الوصف:</strong> ${escapeHtml(breach.description || 'غير متوفر')}</p>
      <p><strong>أنواع البيانات:</strong> ${escapeHtml(classes.join(', ') || 'غير محدد')}</p>
    </div>`;
  }).join('');
}

function displayDomains(domains) {
  const container = document.getElementById('domains-content');
  if (domains.length === 0) {
    container.innerHTML = '<div class="card"><p>لا توجد سجلات RDAP مرتبطة.</p></div>';
    return;
  }
  container.innerHTML = domains.map((domain) => {
    const nameservers = parseJson(domain.nameservers, []);
    return `<div class="card"><h3>🌐 ${escapeHtml(domain.domain_name)}</h3>
      <p><strong>المسجل:</strong> ${escapeHtml(domain.registrar || 'غير محدد')}</p>
      <p><strong>تاريخ التسجيل:</strong> ${escapeHtml(domain.creation_date || 'غير محدد')}</p>
      <p><strong>تاريخ الانتهاء:</strong> ${escapeHtml(domain.expiration_date || 'غير محدد')}</p>
      <p><strong>خوادم الأسماء:</strong> ${escapeHtml(nameservers.join(', ') || 'غير محدد')}</p>
    </div>`;
  }).join('');
}

function displayGraph(graph) {
  const container = document.getElementById('graph-container');
  if (!graph?.nodes?.length) {
    container.innerHTML = '<div class="graph-empty">لا توجد بيانات كافية لعرض شبكة العلاقات</div>';
    return;
  }
  container.innerHTML = renderSimpleGraph(graph);
}

function renderSimpleGraph(graph) {
  const width = 1000;
  const height = 600;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 200;
  const denominator = Math.max(graph.nodes.length - 1, 1);
  const nodes = graph.nodes.map((node, index) => {
    const angle = (index / denominator) * 2 * Math.PI;
    return { ...node, x: node.type === 'person' ? centerX : centerX + radius * Math.cos(angle), y: node.type === 'person' ? centerY : centerY + radius * Math.sin(angle) };
  });
  let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" role="img" aria-label="شبكة العلاقات">`;
  for (const edge of graph.edges || []) {
    const from = nodes.find((node) => node.id === edge.from);
    const to = nodes.find((node) => node.id === edge.to);
    if (!from || !to) continue;
    svg += `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="#64748b" stroke-width="2" opacity="0.6"/>`;
  }
  for (const node of nodes) {
    const color = node.type === 'person' ? '#2563eb' : node.type === 'social' ? '#10b981' : node.type === 'breach' ? '#ef4444' : '#f59e0b';
    svg += `<circle cx="${node.x}" cy="${node.y}" r="30" fill="${color}" opacity="0.85"/><text x="${node.x}" y="${node.y + 5}" fill="white" font-size="18" text-anchor="middle">${escapeHtml(node.icon || '●')}</text><text x="${node.x}" y="${node.y + 50}" fill="#f1f5f9" font-size="12" text-anchor="middle">${escapeHtml(String(node.label || '').split('\n')[0])}</text>`;
  }
  return `${svg}</svg>`;
}

function displayLogs(logs) {
  const container = document.getElementById('logs-content');
  if (logs.length === 0) {
    container.innerHTML = '<div class="card"><p>لا توجد سجلات متاحة.</p></div>';
    return;
  }
  container.innerHTML = logs.map((log) => `<div class="log-entry ${escapeHtml(String(log.status || '').toLowerCase())}"><div class="timestamp">${escapeHtml(formatDate(log.created_at))}</div><div><strong>[${escapeHtml(log.module_name)}]</strong> ${escapeHtml(log.message)}</div></div>`).join('');
}

function initializeTabs() {
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === tab));
    document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.remove('active'));
    document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
  }));
  document.getElementById('back-to-investigations').addEventListener('click', () => activateView('investigations'));
  document.getElementById('delete-investigation').addEventListener('click', deleteCurrentInvestigation);
}

async function deleteCurrentInvestigation() {
  if (!currentPersonId) return;
  const confirmed = window.confirm('سيُحذف سجل القضية وكل النتائج والسجلات المرتبطة به نهائيًا. هل تريد المتابعة؟');
  if (!confirmed) return;
  try {
    const result = await api.deleteInvestigation(currentPersonId);
    if (!result.success) throw new Error(result.error);
    currentPersonId = null;
    await loadInvestigations();
    activateView('investigations');
    showNotification('تم حذف القضية وبياناتها المرتبطة.', 'success');
  } catch (error) {
    showNotification(`تعذر حذف القضية: ${error.message}`, 'error');
  }
}

function initializeSettings() {
  const checkbox = document.getElementById('verbose-logging');
  checkbox.checked = localStorage.getItem('verbose-progress') === 'true';
  document.getElementById('save-settings').addEventListener('click', () => {
    localStorage.setItem('verbose-progress', String(checkbox.checked));
    showNotification('تم حفظ تفضيل الواجهة محليًا.', 'success');
  });
}

async function loadRuntimeConfig() {
  const config = await api.getRuntimeConfig();
  if (!config.success) return;
  document.getElementById('app-version').textContent = config.version;
  document.getElementById('hibp-status').textContent = config.hibpConfigured
    ? '✅ تكامل HIBP معد عبر متغير البيئة.'
    : 'ℹ️ تكامل HIBP غير معد؛ سيتم تخطيه بلا بيانات تجريبية.';
}

function initializeDelegatedActions() {
  document.body.addEventListener('click', async (event) => {
    const card = event.target.closest('[data-person-id]');
    if (card) await loadInvestigation(card.dataset.personId);
    const link = event.target.closest('[data-external-url]');
    if (link) await api.openExternal(link.dataset.externalUrl);
  });
}

function showLoading(message) {
  document.getElementById('loading-message').textContent = message;
  document.getElementById('progress-messages').replaceChildren();
  document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() { document.getElementById('loading-overlay').classList.add('hidden'); }
function updateLoadingMessage(message) { document.getElementById('loading-message').textContent = message; }

function addProgressMessage(message, status = 'info') {
  const icon = status === 'success' ? '✅' : status === 'warning' ? '⚠️' : status === 'error' ? '❌' : 'ℹ️';
  const element = document.createElement('div');
  element.className = 'progress-message';
  element.textContent = `${icon} ${message}`;
  const container = document.getElementById('progress-messages');
  container.appendChild(element);
  container.scrollTop = container.scrollHeight;
}

function showNotification(message, type = 'info') {
  console.log(`[${type.toUpperCase()}] ${message}`);
  window.alert(message);
}

function formatDate(value) {
  if (!value) return 'غير محدد';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'غير محدد' : date.toLocaleString('ar', { dateStyle: 'medium', timeStyle: 'short' });
}

function getConfidenceBadgeClass(confidence) {
  if (confidence >= 75) return 'success';
  if (confidence >= 50) return 'info';
  if (confidence >= 25) return 'warning';
  return 'danger';
}
