(() => {
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function json(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function confidenceClass(value) {
    const score = num(value);
    if (score >= 75) return 'success';
    if (score >= 50) return 'info';
    if (score >= 25) return 'warning';
    return 'danger';
  }

  function detail(label, value) {
    if (value === null || value === undefined || value === '') return '';
    return `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  }

  function recordGroup(label, records) {
    if (!Array.isArray(records) || records.length === 0) return '';
    return `
      <div class="evidence-block">
        <strong>${esc(label)}</strong>
        <div class="evidence-values">${records.slice(0, 20).map((record) => `<code>${esc(record.value ?? record)}</code>`).join('')}</div>
      </div>`;
  }

  window.displaySocialAccounts = function displaySocialAccounts(accounts) {
    const container = document.getElementById('social-content');
    if (!accounts.length) {
      container.innerHTML = '<div class="panel empty-state">لم تُرجع المصادر النشطة حسابات عامة مطابقة لاسم المستخدم.</div>';
      return;
    }

    container.innerHTML = accounts.map((account) => {
      const metadata = json(account.additional_data, {});
      const score = num(account.confidence_score);
      const sourceKind = metadata.sourceKind === 'official_public_api' ? 'API مباشر' : 'فحص صفحة عامة';
      const metrics = [
        account.followers_count !== null && account.followers_count !== undefined ? `Followers: ${num(account.followers_count)}` : '',
        account.following_count !== null && account.following_count !== undefined ? `Following: ${num(account.following_count)}` : '',
        metadata.karma !== null && metadata.karma !== undefined ? `Karma: ${num(metadata.karma)}` : '',
        metadata.publicRepos !== null && metadata.publicRepos !== undefined ? `Repos: ${num(metadata.publicRepos)}` : ''
      ].filter(Boolean);

      return `
        <article class="panel source-card">
          <div class="card-topline">
            <span>${esc(metadata.source || account.platform || 'Public source')}</span>
            <span class="badge badge-${confidenceClass(score)}">جودة الدليل ${score.toFixed(0)}%</span>
          </div>
          <div class="source-heading">
            ${account.avatar_url ? `<img class="source-avatar" src="${esc(account.avatar_url)}" alt="">` : ''}
            <div>
              <h3>${esc(account.display_name || account.username || account.platform)}</h3>
              <p class="source-handle">${esc(account.platform)} · @${esc(account.username || '')} · ${esc(sourceKind)}</p>
            </div>
          </div>
          ${account.bio ? `<p class="source-bio">${esc(account.bio)}</p>` : ''}
          ${metrics.length ? `<div class="tag-row">${metrics.map((item) => `<span>${esc(item)}</span>`).join('')}</div>` : ''}
          <dl class="detail-list compact-details">
            ${detail('Location', metadata.location)}
            ${detail('Company', metadata.company || metadata.organization)}
            ${detail('Public email', metadata.publicEmail)}
            ${detail('Website', metadata.website)}
            ${detail('Created', metadata.createdAt)}
            ${detail('Checked', metadata.checkedAt)}
          </dl>
          <div class="source-actions">
            ${account.profile_url ? `<button type="button" class="link-button" data-external-url="${esc(account.profile_url)}">فتح المصدر العام</button>` : ''}
          </div>
          <p class="table-footnote">${esc(metadata.caveat || 'وجود الحساب لا يثبت ارتباطه بالشخص محل الحالة دون تحقق إضافي.')}</p>
        </article>`;
    }).join('');
  };

  window.displayDomains = function displayDomains(domains) {
    const container = document.getElementById('domains-content');
    if (!domains.length) {
      container.innerHTML = '<div class="panel empty-state">لا توجد بيانات Domain Intelligence لهذه الحالة. نطاقات البريد الاستهلاكية الشائعة يتم تخطيها لأنها لا تضيف دليلاً متعلقًا بالشخص.</div>';
      return;
    }

    container.innerHTML = domains.map((domain) => {
      const metadata = json(domain.additional_data, {});
      const dns = metadata.dns || {};
      const security = metadata.emailSecurity || {};
      const status = metadata.sourceStatus || {};
      const certificateNames = Array.isArray(metadata.certificateNames) ? metadata.certificateNames : [];
      const nameservers = json(domain.nameservers, []);

      return `
        <article class="panel domain-intel-card">
          <div class="card-topline">
            <span>LIVE DOMAIN INTELLIGENCE</span>
            <span>${esc(domain.domain_name || '')}</span>
          </div>
          <h3>${esc(domain.domain_name || '—')}</h3>
          <div class="source-status-grid">
            <span>RDAP <strong>${esc(status.rdap || 'unknown')}</strong></span>
            <span>DNS <strong>${esc(status.dns || 'unknown')}</strong></span>
            <span>CT <strong>${esc(status.certificateTransparency || 'unknown')}</strong></span>
          </div>
          <dl class="detail-list">
            ${detail('Registrar', domain.registrar || 'غير متاح/محجوب')}
            ${detail('Registrant', domain.registrant_name || 'غير متاح/محجوب')}
            ${detail('Creation', domain.creation_date)}
            ${detail('Expiration', domain.expiration_date)}
            ${detail('Name servers', Array.isArray(nameservers) ? nameservers.join(', ') : '')}
          </dl>

          <div class="evidence-section">
            <div class="panel-heading"><div><span class="section-kicker">DNS</span><h3>السجلات الحية</h3></div></div>
            ${recordGroup('A', dns.A)}
            ${recordGroup('AAAA', dns.AAAA)}
            ${recordGroup('MX', dns.MX)}
            ${recordGroup('NS', dns.NS)}
            ${recordGroup('TXT', dns.TXT)}
            ${recordGroup('CAA', dns.CAA)}
          </div>

          <div class="evidence-section">
            <div class="panel-heading"><div><span class="section-kicker">MAIL SECURITY</span><h3>SPF / DMARC</h3></div></div>
            <div class="tag-row">
              <span class="badge ${security.hasSpf ? 'badge-success' : 'badge-warning'}">SPF ${security.hasSpf ? 'found' : 'not found'}</span>
              <span class="badge ${security.hasDmarc ? 'badge-success' : 'badge-warning'}">DMARC ${security.hasDmarc ? 'found' : 'not found'}</span>
            </div>
            ${recordGroup('SPF', security.spf)}
            ${recordGroup('DMARC', security.dmarc)}
          </div>

          <div class="evidence-section">
            <div class="panel-heading"><div><span class="section-kicker">CERTIFICATE TRANSPARENCY</span><h3>أسماء ظهرت في الشهادات</h3></div><span>${num(metadata.certificateNameCount, certificateNames.length)} total</span></div>
            ${certificateNames.length
              ? `<div class="evidence-values certificate-values">${certificateNames.slice(0, 40).map((name) => `<code>${esc(name)}</code>`).join('')}</div>`
              : '<p class="panel-note">لم يرجع مصدر CT أسماء قابلة للاستخدام في هذه الجولة.</p>'}
          </div>

          <p class="table-footnote">هذه البيانات تخص نطاق البريد العام وبنيته التقنية، ولا تعني أن صاحب البريد يملك النطاق أو يديره.</p>
        </article>`;
    }).join('');
  };
})();
