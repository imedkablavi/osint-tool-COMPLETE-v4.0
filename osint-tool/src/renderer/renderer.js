const { ipcRenderer } = require('electron');

// المتغيرات العامة
let currentPersonId = null;
let currentReport = null;

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    initializeInvestigationForm();
    loadInvestigations();
    initializeTabs();
    initializeSettings();
});

// التنقل بين الصفحات
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const viewName = item.dataset.view;
            
            // تحديث القائمة
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            // تحديث العرض
            document.querySelectorAll('.view').forEach(view => {
                view.classList.remove('active');
            });
            document.getElementById(`${viewName}-view`).classList.add('active');
            
            // تحميل البيانات حسب العرض
            if (viewName === 'investigations') {
                loadInvestigations();
            }
        });
    });
}

// نموذج البحث الجديد
function initializeInvestigationForm() {
    const form = document.getElementById('investigation-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('target-name').value.trim();
        const email = document.getElementById('target-email').value.trim();
        const username = document.getElementById('target-username').value.trim();
        
        if (!email && !username) {
            showNotification('يجب إدخال بريد إلكتروني أو اسم مستخدم على الأقل', 'warning');
            return;
        }
        
        await startInvestigation({ name, email, username });
    });
}

// بدء التحقيق
async function startInvestigation(data) {
    try {
        showLoading('جارٍ إنشاء التحقيق...');
        
        // إضافة الشخص إلى قاعدة البيانات
        const result = await ipcRenderer.invoke('add-person', data);
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        currentPersonId = result.personId;
        
        // بدء عملية البحث
        updateLoadingMessage('بدء عملية البحث الشامل...');
        
        // الاستماع لتحديثات التقدم
        ipcRenderer.on('investigation-update', (event, update) => {
            addProgressMessage(update.message, update.status);
        });
        
        const investigationResult = await ipcRenderer.invoke('start-investigation', currentPersonId);
        
        // إزالة المستمع
        ipcRenderer.removeAllListeners('investigation-update');
        
        hideLoading();
        
        if (!investigationResult.success) {
            throw new Error(investigationResult.error);
        }
        
        // عرض النتائج
        currentReport = investigationResult.report;
        showResults(currentReport);
        
        showNotification('تم الانتهاء من التحقيق بنجاح!', 'success');
        
    } catch (error) {
        hideLoading();
        showNotification(`خطأ: ${error.message}`, 'error');
        console.error('Investigation error:', error);
    }
}

// تحميل قائمة التحقيقات
async function loadInvestigations() {
    try {
        const result = await ipcRenderer.invoke('get-all-persons');
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        const container = document.getElementById('investigations-list');
        
        if (result.persons.length === 0) {
            container.innerHTML = `
                <div class="card">
                    <p style="text-align: center; color: var(--text-secondary);">
                        لا توجد تحقيقات بعد. ابدأ تحقيقاً جديداً من القائمة الجانبية.
                    </p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = result.persons.map(person => `
            <div class="investigation-card" onclick="loadInvestigation(${person.id})">
                <h3>${person.name || person.username || 'غير محدد'}</h3>
                <p>📧 ${person.email || 'غير محدد'}</p>
                <p>👤 ${person.username || 'غير محدد'}</p>
                <p class="date">📅 ${formatDate(person.created_at)}</p>
            </div>
        `).join('');
        
    } catch (error) {
        showNotification(`خطأ في تحميل التحقيقات: ${error.message}`, 'error');
    }
}

// تحميل تحقيق محدد
async function loadInvestigation(personId) {
    try {
        showLoading('جارٍ تحميل التحقيق...');
        
        currentPersonId = personId;
        const result = await ipcRenderer.invoke('get-report', personId);
        
        hideLoading();
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        currentReport = result.report;
        showResults(currentReport);
        
    } catch (error) {
        hideLoading();
        showNotification(`خطأ: ${error.message}`, 'error');
    }
}

// عرض النتائج
function showResults(report) {
    // التبديل إلى عرض النتائج
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById('results-view').classList.add('active');
    
    // عرض الملخص
    displaySummary(report);
    
    // عرض نظرة عامة
    displayOverview(report);
    
    // عرض الحسابات الاجتماعية
    displaySocialAccounts(report.socialAccounts);
    
    // عرض التسريبات
    displayBreaches(report.breaches);
    
    // عرض النطاقات
    displayDomains(report.domains);
    
    // عرض شبكة العلاقات
    displayGraph(report.graph);
    
    // عرض السجلات
    displayLogs(report.logs);
}

// عرض الملخص
function displaySummary(report) {
    const container = document.getElementById('results-summary');
    
    container.innerHTML = `
        <div class="summary-card">
            <div class="icon">👤</div>
            <div class="value">${report.summary.totalSocialAccounts}</div>
            <div class="label">حسابات اجتماعية</div>
        </div>
        <div class="summary-card">
            <div class="icon">⚠️</div>
            <div class="value">${report.summary.totalBreaches}</div>
            <div class="label">تسريبات</div>
        </div>
        <div class="summary-card">
            <div class="icon">🌐</div>
            <div class="value">${report.summary.totalDomains}</div>
            <div class="label">نطاقات</div>
        </div>
        <div class="summary-card">
            <div class="icon">📊</div>
            <div class="value">${report.summary.overallConfidence.toFixed(1)}%</div>
            <div class="label">مستوى الثقة: ${report.summary.confidenceLevel}</div>
        </div>
    `;
}

// عرض نظرة عامة
function displayOverview(report) {
    const container = document.getElementById('overview-content');
    
    container.innerHTML = `
        <div class="card">
            <h3>📋 معلومات الهدف</h3>
            <p><strong>الاسم:</strong> ${report.person.name || 'غير محدد'}</p>
            <p><strong>البريد الإلكتروني:</strong> ${report.person.email || 'غير محدد'}</p>
            <p><strong>اسم المستخدم:</strong> ${report.person.username || 'غير محدد'}</p>
            <p><strong>تاريخ الإنشاء:</strong> ${formatDate(report.person.created_at)}</p>
        </div>
        
        <div class="card">
            <h3>📊 ملخص النتائج</h3>
            <p>تم العثور على <strong>${report.summary.totalSocialAccounts}</strong> حساب اجتماعي عبر منصات مختلفة.</p>
            <p>تم اكتشاف <strong>${report.summary.totalBreaches}</strong> تسريب أمني يحتوي على بيانات الهدف.</p>
            <p>تم تحليل <strong>${report.summary.totalDomains}</strong> نطاق مرتبط بالهدف.</p>
            <p>مستوى الثقة الإجمالي: <span class="badge badge-${getConfidenceBadgeClass(report.summary.overallConfidence)}">${report.summary.confidenceLevel} (${report.summary.overallConfidence.toFixed(1)}%)</span></p>
        </div>
        
        <div class="card">
            <h3>💡 توصيات</h3>
            <p>• راجع جميع الحسابات الاجتماعية المكتشفة للتأكد من ارتباطها بالهدف</p>
            <p>• انتبه للتسريبات الأمنية وقم بتغيير كلمات المرور المتأثرة</p>
            <p>• استخدم شبكة العلاقات لفهم الروابط بين البيانات المختلفة</p>
            <p>• راجع السجلات لمعرفة تفاصيل عملية البحث</p>
        </div>
    `;
}

// عرض الحسابات الاجتماعية
function displaySocialAccounts(accounts) {
    const container = document.getElementById('social-content');
    
    if (accounts.length === 0) {
        container.innerHTML = '<div class="card"><p>لم يتم العثور على حسابات اجتماعية.</p></div>';
        return;
    }
    
    container.innerHTML = `
        <div class="data-table">
            <table>
                <thead>
                    <tr>
                        <th>المنصة</th>
                        <th>اسم المستخدم</th>
                        <th>الرابط</th>
                        <th>مستوى الثقة</th>
                    </tr>
                </thead>
                <tbody>
                    ${accounts.map(account => {
                        const additionalData = account.additional_data ? JSON.parse(account.additional_data) : {};
                        return `
                            <tr>
                                <td>${additionalData.icon || '👤'} ${account.platform}</td>
                                <td>@${account.username}</td>
                                <td><a href="${account.profile_url}" target="_blank" style="color: var(--primary-color);">فتح الحساب</a></td>
                                <td><span class="badge badge-${getConfidenceBadgeClass(account.confidence_score)}">${account.confidence_score.toFixed(1)}%</span></td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// عرض التسريبات
function displayBreaches(breaches) {
    const container = document.getElementById('breaches-content');
    
    if (breaches.length === 0) {
        container.innerHTML = '<div class="card"><p style="color: var(--success-color);">✅ لم يتم العثور على تسريبات أمنية. هذا جيد!</p></div>';
        return;
    }
    
    container.innerHTML = breaches.map(breach => {
        const dataClasses = breach.data_classes ? JSON.parse(breach.data_classes) : [];
        return `
            <div class="card">
                <h3>⚠️ ${breach.breach_name}</h3>
                <p><strong>البريد المتأثر:</strong> ${breach.email}</p>
                <p><strong>تاريخ التسريب:</strong> ${breach.breach_date || 'غير محدد'}</p>
                <p><strong>الوصف:</strong> ${breach.description || 'غير متوفر'}</p>
                <p><strong>البيانات المسربة:</strong> ${dataClasses.join(', ') || 'غير محدد'}</p>
                <p><strong>التحقق:</strong> ${breach.verified ? '<span class="badge badge-success">موثق</span>' : '<span class="badge badge-warning">غير موثق</span>'}</p>
            </div>
        `;
    }).join('');
}

// عرض النطاقات
function displayDomains(domains) {
    const container = document.getElementById('domains-content');
    
    if (domains.length === 0) {
        container.innerHTML = '<div class="card"><p>لم يتم العثور على نطاقات مرتبطة.</p></div>';
        return;
    }
    
    container.innerHTML = domains.map(domain => {
        const nameservers = domain.nameservers ? JSON.parse(domain.nameservers) : [];
        return `
            <div class="card">
                <h3>🌐 ${domain.domain_name}</h3>
                <p><strong>المسجل:</strong> ${domain.registrar || 'غير محدد'}</p>
                <p><strong>اسم المالك:</strong> ${domain.registrant_name || 'غير محدد'}</p>
                <p><strong>بريد المالك:</strong> ${domain.registrant_email || 'غير محدد'}</p>
                <p><strong>تاريخ الإنشاء:</strong> ${domain.creation_date || 'غير محدد'}</p>
                <p><strong>تاريخ الانتهاء:</strong> ${domain.expiration_date || 'غير محدد'}</p>
                <p><strong>خوادم الأسماء:</strong> ${nameservers.join(', ') || 'غير محدد'}</p>
            </div>
        `;
    }).join('');
}

// عرض شبكة العلاقات
function displayGraph(graph) {
    const container = document.getElementById('graph-container');
    
    if (!graph || !graph.nodes || graph.nodes.length === 0) {
        container.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">لا توجد بيانات كافية لعرض شبكة العلاقات</div>';
        return;
    }
    
    // رسم بسيط باستخدام SVG
    container.innerHTML = renderSimpleGraph(graph);
}

// رسم شبكة بسيطة
function renderSimpleGraph(graph) {
    const width = 1000;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = 200;
    
    // حساب مواقع العقد في دائرة
    const nodes = graph.nodes.map((node, index) => {
        const angle = (index / (graph.nodes.length - 1)) * 2 * Math.PI;
        return {
            ...node,
            x: node.type === 'person' ? centerX : centerX + radius * Math.cos(angle),
            y: node.type === 'person' ? centerY : centerY + radius * Math.sin(angle)
        };
    });
    
    // رسم SVG
    let svg = `<svg width="100%" height="100%" viewBox="0 0 ${width} ${height}">`;
    
    // رسم الروابط
    graph.edges.forEach(edge => {
        const fromNode = nodes.find(n => n.id === edge.from);
        const toNode = nodes.find(n => n.id === edge.to);
        
        if (fromNode && toNode) {
            svg += `
                <line x1="${fromNode.x}" y1="${fromNode.y}" 
                      x2="${toNode.x}" y2="${toNode.y}" 
                      stroke="${edge.dashed ? '#64748b' : '#475569'}" 
                      stroke-width="2" 
                      stroke-dasharray="${edge.dashed ? '5,5' : '0'}"
                      opacity="0.6"/>
                <text x="${(fromNode.x + toNode.x) / 2}" 
                      y="${(fromNode.y + toNode.y) / 2}" 
                      fill="#94a3b8" 
                      font-size="10" 
                      text-anchor="middle">${edge.label}</text>
            `;
        }
    });
    
    // رسم العقد
    nodes.forEach(node => {
        const color = node.type === 'person' ? '#2563eb' : 
                     node.type === 'social' ? '#10b981' : 
                     node.type === 'breach' ? '#ef4444' : '#f59e0b';
        
        svg += `
            <circle cx="${node.x}" cy="${node.y}" r="30" 
                    fill="${color}" opacity="0.8"/>
            <text x="${node.x}" y="${node.y + 5}" 
                  fill="white" 
                  font-size="20" 
                  text-anchor="middle">${node.icon || '●'}</text>
            <text x="${node.x}" y="${node.y + 50}" 
                  fill="#f1f5f9" 
                  font-size="12" 
                  text-anchor="middle">${node.label.split('\n')[0]}</text>
        `;
    });
    
    svg += '</svg>';
    
    return svg;
}

// عرض السجلات
function displayLogs(logs) {
    const container = document.getElementById('logs-content');
    
    if (logs.length === 0) {
        container.innerHTML = '<div class="card"><p>لا توجد سجلات متاحة.</p></div>';
        return;
    }
    
    container.innerHTML = logs.map(log => `
        <div class="log-entry ${log.status.toLowerCase()}">
            <div class="timestamp">${formatDate(log.created_at)}</div>
            <div><strong>[${log.module_name}]</strong> ${log.message}</div>
        </div>
    `).join('');
}

// التبويبات
function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            
            // تحديث التبويبات
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // تحديث المحتوى
            document.querySelectorAll('.tab-pane').forEach(pane => {
                pane.classList.remove('active');
            });
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    });
    
    // زر العودة
    document.getElementById('back-to-investigations').addEventListener('click', () => {
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.getElementById('investigations-view').classList.add('active');
        
        // تحديث القائمة
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.querySelector('[data-view="investigations"]').classList.add('active');
    });
}

// الإعدادات
function initializeSettings() {
    document.getElementById('save-settings').addEventListener('click', () => {
        // حفظ الإعدادات في localStorage
        const settings = {
            hibpApiKey: document.getElementById('hibp-api-key').value,
            useProxy: document.getElementById('use-proxy').checked,
            verboseLogging: document.getElementById('verbose-logging').checked
        };
        
        localStorage.setItem('osint-settings', JSON.stringify(settings));
        showNotification('تم حفظ الإعدادات بنجاح', 'success');
    });
    
    // تحميل الإعدادات المحفوظة
    const savedSettings = localStorage.getItem('osint-settings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        document.getElementById('hibp-api-key').value = settings.hibpApiKey || '';
        document.getElementById('use-proxy').checked = settings.useProxy || false;
        document.getElementById('verbose-logging').checked = settings.verboseLogging || false;
    }
}

// دوال مساعدة
function showLoading(message) {
    const overlay = document.getElementById('loading-overlay');
    const messageEl = document.getElementById('loading-message');
    const progressContainer = document.getElementById('progress-messages');
    
    messageEl.textContent = message;
    progressContainer.innerHTML = '';
    overlay.classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

function updateLoadingMessage(message) {
    document.getElementById('loading-message').textContent = message;
}

function addProgressMessage(message, status = 'info') {
    const container = document.getElementById('progress-messages');
    const messageEl = document.createElement('div');
    messageEl.className = 'progress-message';
    messageEl.textContent = message;
    
    const icon = status === 'success' ? '✅' : 
                 status === 'warning' ? '⚠️' : 
                 status === 'error' ? '❌' : 'ℹ️';
    
    messageEl.textContent = `${icon} ${message}`;
    container.appendChild(messageEl);
    container.scrollTop = container.scrollHeight;
}

function showNotification(message, type = 'info') {
    // يمكن استخدام مكتبة إشعارات أو إنشاء نظام إشعارات مخصص
    console.log(`[${type.toUpperCase()}] ${message}`);
    alert(message);
}

function formatDate(dateString) {
    if (!dateString) return 'غير محدد';
    const date = new Date(dateString);
    return date.toLocaleString('ar-SA', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getConfidenceBadgeClass(confidence) {
    if (confidence >= 75) return 'success';
    if (confidence >= 50) return 'info';
    if (confidence >= 25) return 'warning';
    return 'danger';
}
