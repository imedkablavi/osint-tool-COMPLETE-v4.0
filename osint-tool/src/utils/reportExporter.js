function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function stripTags(value) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function portableAccount(account = {}) {
  return {
    id: numberValue(account.id, null),
    platform: account.platform || null,
    username: account.username || null,
    profileUrl: account.profile_url || account.profileUrl || null,
    displayName: account.display_name || account.displayName || null,
    confidenceScore: numberValue(account.confidence_score ?? account.confidenceScore),
    verified: Boolean(account.verified),
    evidence: parseJson(account.additional_data ?? account.additionalData, {})
  };
}

function portableBreach(breach = {}) {
  return {
    id: numberValue(breach.id, null),
    email: breach.email || null,
    breachName: breach.breach_name || breach.breachName || null,
    breachDate: breach.breach_date || breach.breachDate || null,
    description: stripTags(breach.description || ''),
    dataClasses: parseJson(breach.data_classes ?? breach.dataClasses, []),
    verified: Boolean(breach.verified),
    source: 'Have I Been Pwned'
  };
}

function portableDomain(domain = {}) {
  return {
    id: numberValue(domain.id, null),
    domainName: domain.domain_name || domain.domainName || null,
    registrar: domain.registrar || null,
    registrantName: domain.registrant_name || domain.registrantName || null,
    registrantEmail: domain.registrant_email || domain.registrantEmail || null,
    creationDate: domain.creation_date || domain.creationDate || null,
    expirationDate: domain.expiration_date || domain.expirationDate || null,
    nameservers: parseJson(domain.nameservers, []),
    source: 'RDAP',
    evidence: parseJson(domain.additional_data ?? domain.additionalData, {})
  };
}

function portableLog(log = {}) {
  return {
    timestamp: log.created_at || log.timestamp || null,
    module: log.module_name || log.module || null,
    status: log.status || null,
    message: log.message || null
  };
}

function toPortableReport(report = {}, options = {}) {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const person = report.person || {};
  const summary = report.summary || {};

  return {
    schemaVersion: '1.0',
    generatedAt,
    application: {
      name: 'OSINT Tool',
      version: '4.1.0'
    },
    sourceNotes: {
      socialProfiles: 'Possible public-profile URL evidence only; manual identity verification is required.',
      breaches: 'Breach records are sourced from Have I Been Pwned when an API key is configured. HIBP attribution and service terms apply.',
      domains: 'Domain registration records are sourced through RDAP.'
    },
    case: {
      id: numberValue(person.id, null),
      name: person.name || null,
      email: person.email || null,
      username: person.username || null,
      createdAt: person.created_at || null
    },
    summary: {
      totalSocialAccounts: numberValue(summary.totalSocialAccounts),
      totalBreaches: numberValue(summary.totalBreaches),
      totalDomains: numberValue(summary.totalDomains),
      overallConfidence: numberValue(summary.overallConfidence),
      confidenceLevel: summary.confidenceLevel || null
    },
    socialAccounts: (report.socialAccounts || []).map(portableAccount),
    breaches: (report.breaches || []).map(portableBreach),
    domains: (report.domains || []).map(portableDomain),
    graph: report.graph || { nodes: [], edges: [] },
    logs: (report.logs || []).map(portableLog)
  };
}

function toJson(report, options = {}) {
  return JSON.stringify(toPortableReport(report, options), null, 2);
}

function tableRows(items, columns) {
  if (!items.length) {
    return `<tr><td colspan="${columns.length}" class="empty">No records</td></tr>`;
  }

  return items.map((item) => `<tr>${columns.map((column) => `<td>${escapeHtml(column.value(item))}</td>`).join('')}</tr>`).join('');
}

function toHtml(report, options = {}) {
  const portable = toPortableReport(report, options);
  const generated = escapeHtml(portable.generatedAt);
  const caseTitle = portable.case.name || portable.case.username || portable.case.email || `Case ${portable.case.id ?? ''}`;

  const socialRows = tableRows(portable.socialAccounts, [
    { value: (item) => item.platform || '—' },
    { value: (item) => item.username ? `@${item.username}` : '—' },
    { value: (item) => item.profileUrl || '—' },
    { value: (item) => `${numberValue(item.confidenceScore).toFixed(0)}%` }
  ]);

  const breachRows = tableRows(portable.breaches, [
    { value: (item) => item.breachName || '—' },
    { value: (item) => item.breachDate || '—' },
    { value: (item) => item.dataClasses.join(', ') || '—' },
    { value: (item) => item.verified ? 'Verified at source' : 'Unverified' }
  ]);

  const domainRows = tableRows(portable.domains, [
    { value: (item) => item.domainName || '—' },
    { value: (item) => item.registrar || '—' },
    { value: (item) => item.creationDate || '—' },
    { value: (item) => item.expirationDate || '—' }
  ]);

  const logRows = tableRows(portable.logs, [
    { value: (item) => item.timestamp || '—' },
    { value: (item) => item.module || '—' },
    { value: (item) => item.status || '—' },
    { value: (item) => item.message || '—' }
  ]);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
<title>${escapeHtml(caseTitle)} — OSINT Tool report</title>
<style>
:root{color-scheme:light;--ink:#172033;--muted:#667085;--line:#d9e0ea;--panel:#f7f9fc;--accent:#2557d6}
*{box-sizing:border-box}body{margin:0;font:14px/1.55 Inter,Segoe UI,Arial,sans-serif;color:var(--ink);background:white}
main{max-width:1100px;margin:0 auto;padding:42px 34px 64px}header{border-bottom:2px solid var(--ink);padding-bottom:20px;margin-bottom:26px}
h1{font-size:28px;margin:4px 0 6px}h2{font-size:18px;margin:30px 0 12px}.eyebrow{font-size:11px;letter-spacing:.12em;color:var(--accent);font-weight:700}
.meta,.note{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.metric{border:1px solid var(--line);border-radius:9px;padding:13px;background:var(--panel)}
.metric span{display:block;color:var(--muted);font-size:11px}.metric strong{display:block;font-size:22px;margin-top:4px}dl{display:grid;grid-template-columns:150px 1fr;gap:8px 14px;margin:14px 0}dt{color:var(--muted)}dd{margin:0;word-break:break-word}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid var(--line);padding:9px 10px;text-align:left;vertical-align:top;word-break:break-word}th{background:var(--panel);font-size:11px}.empty{text-align:center;color:var(--muted)}
.notice{border:1px solid var(--line);border-left:4px solid var(--accent);padding:12px 14px;margin:12px 0;background:var(--panel)}footer{margin-top:34px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:11px}
@media print{main{max-width:none;padding:20px}.grid{break-inside:avoid}table{break-inside:auto}tr{break-inside:avoid}}
</style>
</head>
<body>
<main>
<header>
<div class="eyebrow">OSINT TOOL · CASE REPORT</div>
<h1>${escapeHtml(caseTitle)}</h1>
<div class="meta">Generated ${generated} · Schema ${escapeHtml(portable.schemaVersion)}</div>
</header>

<section>
<h2>Case</h2>
<dl>
<dt>Case ID</dt><dd>${escapeHtml(portable.case.id ?? '—')}</dd>
<dt>Name</dt><dd>${escapeHtml(portable.case.name || '—')}</dd>
<dt>Email</dt><dd>${escapeHtml(portable.case.email || '—')}</dd>
<dt>Username</dt><dd>${escapeHtml(portable.case.username || '—')}</dd>
<dt>Created</dt><dd>${escapeHtml(portable.case.createdAt || '—')}</dd>
</dl>
<div class="grid">
<div class="metric"><span>Possible profiles</span><strong>${escapeHtml(portable.summary.totalSocialAccounts)}</strong></div>
<div class="metric"><span>HIBP records</span><strong>${escapeHtml(portable.summary.totalBreaches)}</strong></div>
<div class="metric"><span>RDAP records</span><strong>${escapeHtml(portable.summary.totalDomains)}</strong></div>
<div class="metric"><span>Aggregate confidence</span><strong>${escapeHtml(portable.summary.overallConfidence.toFixed(1))}%</strong></div>
</div>
<div class="notice"><strong>Interpretation limit:</strong> ${escapeHtml(portable.sourceNotes.socialProfiles)}</div>
</section>

<section>
<h2>Possible public profiles</h2>
<table><thead><tr><th>Platform</th><th>Username</th><th>Profile URL</th><th>Confidence</th></tr></thead><tbody>${socialRows}</tbody></table>
</section>

<section>
<h2>Breach records</h2>
<div class="notice">Source: Have I Been Pwned. Attribution and HIBP service terms apply.</div>
<table><thead><tr><th>Breach</th><th>Date</th><th>Data classes</th><th>Source status</th></tr></thead><tbody>${breachRows}</tbody></table>
</section>

<section>
<h2>Domain registration</h2>
<div class="notice">Source: RDAP.</div>
<table><thead><tr><th>Domain</th><th>Registrar</th><th>Created</th><th>Expires</th></tr></thead><tbody>${domainRows}</tbody></table>
</section>

<section>
<h2>Activity log</h2>
<table><thead><tr><th>Timestamp</th><th>Module</th><th>Status</th><th>Message</th></tr></thead><tbody>${logRows}</tbody></table>
</section>

<footer>OSINT Tool v4.1.0 · Local case export · Public-source evidence must be verified before use in decisions or formal conclusions.</footer>
</main>
</body>
</html>`;
}

module.exports = {
  escapeHtml,
  stripTags,
  toPortableReport,
  toJson,
  toHtml
};
