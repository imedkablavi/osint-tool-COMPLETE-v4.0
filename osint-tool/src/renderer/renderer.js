const api = window.osintAPI;

let currentPersonId = null;
let currentReport = null;

const viewTitles = {
  'new-investigation': 'حالة جديدة',
  investigations: 'الحالات',
  settings: 'الإعدادات',
  about: 'حول المنتج'
};

document.addEventListener('DOMContentLoaded', () => {
  if (!api) {
    showNotification('تعذر تحميل واجهة الاتصال الآمنة بالتطبيق.', 'error');
    return;
  }
  initializeNavigation();
  initializeInvestigationForm();
  initializeTabs();
  initializeSettings();
  initializeExternalLinks();
  refreshReadiness();
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function safeJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function setActiveView(viewName) {
  document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
  document.getElementById(`${viewName}-view`)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === viewName));
  document.getElementById('workspace-title').textContent = viewTitles[viewName] || 'OSINT Tool';
}

function initializeNavigation() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      const viewName = item.dataset.view;
      setActiveView(viewName);
      if (viewName === 'investigations') loadInvestigations();
      if (viewName === 'settings') refreshSettings();
    });
  });
}

function initializeInvestigationForm() {
  const form = document.getElementById('investigation-form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const data = {
      name: document.getElementById('target-name').value.trim(),
      email: document.getElementById('target-email').value.trim(),
      username: document.getElementById('target-username').value.trim()
    };
    const authorizedUse = document.getElementById('authorized-use').checked;

    if (!data.email && !data.username) {
      showNotification('أدخل بريدًا إلكترونيًا أو اسم مستخدم على الأقل.', 'warning');
      return;
    }
    if (!authorizedUse) {
      showNotification('يجب تأكيد الاستخدام المشروع قبل بدء الحالة.', 'warning');
      return;
    }

    await startInvestigation(data, authorizedUse);
  });
}

async function startInvestigation(data, authorizedUse) {
  let stopProgress = () => {};
  try {
    showLoading('إنشاء الحالة…');
    const created = await api.cases.create(data);
    if (!created.success) throw new Error(created.error);

    currentPersonId = created.personId;
    stopProgress = api.cases.onProgress((update) => {
      addProgressMessage(update?.message || 'تحديث', update?.status || 'info');
    });

    updateLoadingMessage('جمع البيانات من المصادر المفعلة…');
    const result = await api.cases.start({ personId: currentPersonId, authorizedUse });
    if (!result.success) throw new Error(result.error);

    currentReport = result.report;
    showResults(currentReport);
    showNotification('اكتملت الحالة. راجع مستوى الثقة ومصدر كل نتيجة.', 'success');
    document.getElementById('investigation-form').reset();
  } catch (error) {
    showNotification(error.message || 'تعذر إكمال الحالة.', 'error');
  } finally {
    stopProgress();
    hideLoading();
  }
}

async function loadInvestigations() {
  const container = document.getElementById('investigations-list');
  container.innerHTML = '<div class="panel empty-state">جارٍ تحميل الحالات…</div>';

  try {
    const result = await api.cases.list();
    if (!result.success) throw new Error(result.error);

    if (!result.persons.length) {
      container.innerHTML = '<div class="panel empty-state"><strong>لا توجد حالات بعد</strong><span>أنشئ حالة جديدة لبدء سجل محلي.</span></div>';
      return;
    }

    container.innerHTML = result.persons.map((person) => `
      <button class="investigation-card" type="button" data-person-id="${numberValue(person.id)}">
        <div class="card-topline"><span>CASE #${numberValue(person.id)}</span><time>${escapeHtml(formatDate(person.created_at))}</time></div>
        <h3>${escapeHtml(person.name || person.username || person.email || 'حالة بدون اسم')}</h3>
        <div class="identity-lines">
          <span>${person.email ? escapeHtml(person.email) : 'لا يوجد بريد'}</span>
          <span>${person.username ? `@${escapeHtml(person.username)}` : 'لا يوجد اسم مستخدم'}</span>
        </div>
      </button>
    `).join('');

    container.querySelectorAll('[data-person-id]').forEach((card) => {
      card.addEventListener('click', () => loadInvestigation(Number(card.dataset.personId)));
    });
  } catch (error) {
    container.innerHTML = `<div class="panel empty-state error-text">${escapeHtml(error.message)}</div>`;
  }
}

async function loadInvestigation(personId) {
  try {
    showLoading('تحميل تقرير الحالة…');
    currentPersonId = personId;
    const result = await api.cases.report(personId);
    if (!result.success) throw new Error(result.error);
    currentReport = result.report;
    showResults(currentReport);
  } catch (error) {
    showNotification(error.message || 'تعذر تحميل الحالة.', 'error');
  } finally {
    hideLoading();
  }
}

function showResults(report) {
  setActiveView('results');
  document.getElementById('workspace-title').textContent = 'تقرير الحالة';
  document.getElementById('results-subtitle').textContent = report?.person?.name || report?.person?.email || report?.person?.username || 'ملخص الحالة';
  displaySummary(report);
  displayOverview(report);
  displaySocialAccounts(report.socialAccounts || []);
  displayBreaches(report.breaches || []);
  displayDomains(report.domains || []);
  displayGraph(report.graph || { nodes: [], edges: [] });
  displayLogs(report.logs || []);
}

function displaySummary(report) {
  const summary = report?.summary || {};
  const confidence = numberValue(summary.overallConfidence);
  document.getElementById('results-summary').innerHTML = [
    ['حسابات محتملة', numberValue(summary.totalSocialAccounts)],
    ['تسريبات HIBP', numberValue(summary.totalBreaches)],
    ['سجلات RDAP', numberValue(summary.totalDomains)],
    ['ثقة تجميعية', `${confidence.toFixed(1)}%`]
  ].map(([label, value]) => `<div class="metric-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join('');
}

function displayOverview(report) {
  const person = report?.person || {};
  const summary = report?.summary || {};
  const confidence = numberValue(summary.overallConfidence);
  document.getElementById('overview-content').innerHTML = `
    <div class="report-grid">
      <article class="panel"><span class="section-kicker">IDENTITY</span><h3>${escapeHtml(person.name || 'بدون اسم')}</h3>
        <dl class="detail-list"><div><dt>البريد</dt><dd>${escapeHtml(person.email || '—')}</dd></div><div><dt>اسم المستخدم</dt><dd>${escapeHtml(person.username || '—')}</dd></div><div><dt>تاريخ الإنشاء</dt><dd>${escapeHtml(formatDate(person.created_at))}</dd></div></dl>
      </article>
      <article class="panel"><span class="section-kicker">ASSESSMENT</span><h3>${escapeHtml(summary.confidenceLevel || 'غير محدد')}</h3>
        <p class="panel-note">الثقة التجميعية ${confidence.toFixed(1)}%. هذه إشارة مساعدة وليست إثبات هوية. تحقق يدويًا من كل مصدر.</p>
      </article>
      <article class="panel"><span class="section-kicker">DATA POLICY</span><h3>مصادر حية فقط</h3>
        <p class="panel-note">المسار النشط لا يولد تسريبات أو بيانات نطاقات عشوائية. المصادر غير المضبوطة يتم تخطيها مع تسجيل السبب.</p>
      </article>
    </div>`;
}

function displaySocialAccounts(accounts) {
  const container = document.getElementById('social-content');
  if (!accounts.length) {
    container.innerHTML = emptyPanel('لا توجد مطابقات حسابات محتملة.');
    return;
  }

  container.innerHTML = `<div class="data-table"><table><thead><tr><th>المنصة</th><th>اسم المستخدم</th><th>التقييم</th><th>المصدر</th></tr></thead><tbody>${accounts.map((account) => {
    const additional = safeJson(account.additional_data, {});
    const confidence = numberValue(account.confidence_score);
    const url = String(account.profile_url || '');
    return `<tr><td>${escapeHtml(account.platform || '—')}</td><td>@${escapeHtml(account.username || '—')}</td><td><span class="badge badge-${confidenceClass(confidence)}">${confidence.toFixed(0)}%</span></td><td>${url ? `<button type="button" class="link-button" data-external-url="${escapeHtml(url)}">فتح الرابط العام</button>` : '—'}<small class="source-note">${escapeHtml(additional.checkMethod || 'URL check')}</small></td></tr>`;
  }).join('')}</tbody></table></div><p class="table-footnote">مطابقة الرابط أو استجابة HTTP لا تثبت أن الحساب يعود إلى الشخص نفسه.</p>`;
}

function displayBreaches(breaches) {
  const container = document.getElementById('breaches-content');
  if (!breaches.length) {
    container.innerHTML = `${emptyPanel('لا توجد سجلات تسريب محفوظة لهذه الحالة. قد يعني ذلك عدم وجود نتائج أو أن HIBP لم يكن مفعّلًا.')}
      <p class="attribution">مصدر بيانات التسريبات عند تفعيلها: Have I Been Pwned.</p>`;
    return;
  }

  container.innerHTML = breaches.map((breach) => {
    const classes = safeJson(breach.data_classes, []);
    return `<article class="panel breach-card"><div class="card-topline"><span>HAVE I BEEN PWNED</span><time>${escapeHtml(breach.breach_date || 'تاريخ غير متاح')}</time></div><h3>${escapeHtml(breach.breach_name || 'Unknown breach')}</h3><p>${escapeHtml(stripTags(breach.description || 'لا يوجد وصف.'))}</p><div class="tag-row">${classes.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div><span class="badge ${breach.verified ? 'badge-success' : 'badge-warning'}">${breach.verified ? 'موثق لدى المصدر' : 'غير موثق'}</span></article>`;
  }).join('') + '<p class="attribution">Breach data source: Have I Been Pwned — haveibeenpwned.com.</p>';
}

function displayDomains(domains) {
  const container = document.getElementById('domains-content');
  if (!domains.length) {
    container.innerHTML = emptyPanel('لا يوجد سجل RDAP محفوظ. يتم تخطي نطاقات البريد الاستهلاكية الشائعة تلقائيًا.');
    return;
  }

  container.innerHTML = domains.map((domain) => {
    const nameservers = safeJson(domain.nameservers, []);
    const additional = safeJson(domain.additional_data, {});
    return `<article class="panel"><div class="card-topline"><span>RDAP</span><span>${escapeHtml(additional.queryService || '')}</span></div><h3>${escapeHtml(domain.domain_name || '—')}</h3><dl class="detail-list"><div><dt>Registrar</dt><dd>${escapeHtml(domain.registrar || 'محجوب/غير متاح')}</dd></div><div><dt>Registrant</dt><dd>${escapeHtml(domain.registrant_name || 'محجوب/غير متاح')}</dd></div><div><dt>إنشاء</dt><dd>${escapeHtml(formatDateOnly(domain.creation_date))}</dd></div><div><dt>انتهاء</dt><dd>${escapeHtml(formatDateOnly(domain.expiration_date))}</dd></div><div><dt>Name servers</dt><dd>${escapeHtml(nameservers.join(', ') || '—')}</dd></div></dl></article>`;
  }).join('');
}

function displayGraph(graph) {
  const container = document.getElementById('graph-container');
  if (!graph.nodes?.length) {
    container.innerHTML = '<div class="empty-state">لا توجد بيانات كافية لبناء شبكة علاقات.</div>';
    return;
  }
  container.innerHTML = renderSimpleGraph(graph);
}

function renderSimpleGraph(graph) {
  const width = 1000;
  const height = 560;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = 205;
  const nonPersonCount = Math.max(1, graph.nodes.filter((node) => node.type !== 'person').length);
  let orbitIndex = 0;

  const nodes = graph.nodes.map((node) => {
    if (node.type === 'person') return { ...node, x: centerX, y: centerY };
    const angle = (orbitIndex++ / nonPersonCount) * Math.PI * 2;
    return { ...node, x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) };
  });

  const edges = (graph.edges || []).map((edge) => {
    const from = nodes.find((node) => node.id === edge.from);
    const to = nodes.find((node) => node.id === edge.to);
    if (!from || !to) return '';
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="graph-edge ${edge.dashed ? 'graph-edge-dashed' : ''}" />`;
  }).join('');

  const nodeMarkup = nodes.map((node) => {
    const label = String(node.label || '').split('\n')[0].slice(0, 28);
    const type = ['person', 'social', 'breach', 'domain'].includes(node.type) ? node.type : 'domain';
    return `<g class="graph-node graph-${type}"><circle cx="${node.x}" cy="${node.y}" r="28"></circle><text x="${node.x}" y="${node.y + 4}" class="graph-node-symbol">${type === 'person' ? 'P' : type === 'social' ? 'S' : type === 'breach' ? 'B' : 'D'}</text><text x="${node.x}" y="${node.y + 48}" class="graph-node-label">${escapeHtml(label)}</text></g>`;
  }).join('');

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="شبكة علاقات الحالة">${edges}${nodeMarkup}</svg>`;
}

function displayLogs(logs) {
  const container = document.getElementById('logs-content');
  if (!logs.length) {
    container.innerHTML = emptyPanel('لا توجد سجلات متاحة.');
    return;
  }
  container.innerHTML = `<div class="log-list">${logs.map((log) => `<div class="log-entry ${statusClass(log.status)}"><time>${escapeHtml(formatDate(log.created_at))}</time><strong>${escapeHtml(log.module_name || 'system')}</strong><span>${escapeHtml(log.message || '')}</span></div>`).join('')}</div>`;
}

function initializeTabs() {
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach((pane) => pane.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add('active');
    });
  });

  document.getElementById('back-to-investigations').addEventListener('click', () => {
    setActiveView('investigations');
    loadInvestigations();
  });
}

function initializeSettings() {
  document.getElementById('save-settings').addEventListener('click', async () => {
    const hibpApiKey = document.getElementById('hibp-api-key').value.trim();
    if (!hibpApiKey) {
      showNotification('أدخل مفتاحًا جديدًا أو استخدم زر حذف المفتاح.', 'warning');
      return;
    }
    const result = await api.settings.save({ hibpApiKey });
    if (!result.success) {
      showNotification(result.error, 'error');
      return;
    }
    document.getElementById('hibp-api-key').value = '';
    showNotification('تم حفظ المفتاح في التخزين الآمن للنظام.', 'success');
    refreshReadiness();
    refreshSettings();
  });

  document.getElementById('clear-hibp-key').addEventListener('click', async () => {
    const result = await api.settings.save({ clearHibpApiKey: true });
    if (!result.success) {
      showNotification(result.error, 'error');
      return;
    }
    document.getElementById('hibp-api-key').value = '';
    showNotification('تم حذف مفتاح HIBP المحفوظ.', 'success');
    refreshReadiness();
    refreshSettings();
  });
}

async function refreshSettings() {
  try {
    const result = await api.settings.get();
    if (!result.success) throw new Error(result.error);
    const state = result.settings || {};
    const keyState = document.getElementById('hibp-key-state');
    keyState.textContent = state.hasHibpApiKey ? 'مضبوط' : 'غير مضبوط';
    keyState.className = state.hasHibpApiKey ? 'status-ready' : 'status-muted';
    document.getElementById('secure-storage-note').textContent = state.secureStorageAvailable
      ? 'التخزين الآمن متاح على هذا النظام. لا يتم إعادة المفتاح إلى واجهة renderer بعد حفظه.'
      : 'التخزين الآمن غير متاح على هذا النظام؛ لن يتم حفظ الأسرار حتى يصبح متاحًا.';
  } catch (error) {
    showNotification(error.message, 'error');
  }
}

async function refreshReadiness() {
  try {
    const result = await api.settings.get();
    const ready = Boolean(result.success && result.settings?.hasHibpApiKey);
    const el = document.getElementById('hibp-readiness');
    el.textContent = ready ? 'جاهز' : 'غير مضبوط';
    el.className = ready ? 'status-ready' : 'status-muted';
  } catch {
    // Keep conservative default state.
  }
}

function initializeExternalLinks() {
  document.body.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-external-url]');
    if (!button) return;
    const result = await api.app.openExternal(button.dataset.externalUrl || '');
    if (!result.success) showNotification(result.error, 'error');
  });
}

function showLoading(message) {
  document.getElementById('loading-message').textContent = message;
  document.getElementById('progress-messages').innerHTML = '';
  document.getElementById('loading-overlay').classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

function updateLoadingMessage(message) {
  document.getElementById('loading-message').textContent = message;
}

function addProgressMessage(message, status = 'info') {
  const item = document.createElement('div');
  item.className = `progress-message progress-${statusClass(status)}`;
  item.textContent = message;
  const container = document.getElementById('progress-messages');
  container.appendChild(item);
  container.scrollTop = container.scrollHeight;
}

function showNotification(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${statusClass(type)}`;
  toast.textContent = message;
  document.getElementById('toast-region').appendChild(toast);
  window.setTimeout(() => toast.remove(), 4500);
}

function emptyPanel(message) {
  return `<div class="panel empty-state">${escapeHtml(message)}</div>`;
}

function stripTags(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDate(dateString) {
  if (!dateString) return 'غير محدد';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return String(dateString);
  return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatDateOnly(dateString) {
  if (!dateString) return 'غير متاح';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return String(dateString);
  return new Intl.DateTimeFormat('ar', { dateStyle: 'medium' }).format(date);
}

function confidenceClass(confidence) {
  if (confidence >= 75) return 'success';
  if (confidence >= 50) return 'info';
  if (confidence >= 25) return 'warning';
  return 'danger';
}

function statusClass(status) {
  const value = String(status || 'info').toLowerCase();
  if (['success', 'warning', 'error', 'danger', 'info'].includes(value)) return value === 'danger' ? 'error' : value;
  return 'info';
}
