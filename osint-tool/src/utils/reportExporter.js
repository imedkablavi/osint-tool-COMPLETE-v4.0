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
    bio: account.bio || null,
    avatarUrl: account.avatar_url || account.avatarUrl || null,
    followersCount: numberValue(account.followers_count ?? account.followersCount, null),
    followingCount: numberValue(account.following_count ?? account.followingCount, null),
    lastObservedActivity: account.last_post_date || account.lastPostDate || null,
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
    source: 'RDAP / DNS / Certificate Transparency',
    evidence: parseJson(domain.additional_data ?? domain.additionalData, {})
  };
}

function portableSearchResult(result = {}) {
  return {
    id: numberValue(result.id, null),
    source: result.source || null,
    title: result.title || null,
    url: result.url || null,
    snippet: stripTags(result.snippet || ''),
    observedAt: result.date_found || result.dateFound || result.created_at || null
  };
}

function portableMedia(media = {}) {
  const metadata = parseJson(media.exif_data ?? media.exifData, {});
  return {
    id: numberValue(media.id, null),
    mediaType: media.media_type || media.mediaType || null,
    reference: media.url || null,
    caption: media.caption || null,
    location: media.location || null,
    observedAt: media.created_at || null,
    metadata
  };
}

function portableEvidence(row = {}) {
  return {
    id: numberValue(row.id, null),
    sourceName: row.source_name || row.sourceName || null,
    sourceType: row.source_type || row.sourceType || null,
    entityType: row.entity_type || row.entityType || null,
    entityId: numberValue(row.entity_id ?? row.entityId, null),
    evidenceType: row.evidence_type || row.evidenceType || null,
    sourceUrl: row.source_url || row.sourceUrl || null,
    status: row.status || null,
    qualityScore: numberValue(row.quality_score ?? row.qualityScore),
    observedAt: row.observed_at || row.observedAt || null,
    metadata: parseJson(row.metadata, {})
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
  const evidence = (report.evidence || []).map(portableEvidence);

  return {
    schemaVersion: '1.2',
    generatedAt,
    application: {
      name: 'OSINT Tool',
      version: '4.1.0'
    },
    sourceNotes: {
      socialProfiles: 'Exact username records from public APIs and lower-confidence public-page or local username-engine observations. Manual identity verification is required.',
      breaches: 'Breach records are sourced from Have I Been Pwned when an API key is configured. HIBP attribution and service terms apply.',
      domains: 'Domain infrastructure evidence is collected from RDAP, Google Public DNS DoH, and best-effort certificate-transparency observations.',
      webSearch: 'Web results are retrieved through the Brave Search API when configured. Search retrieval is not identity proof and is excluded from aggregate evidence scoring.',
      localImages: 'Local image hashes and EXIF metadata describe the selected file only. They do not establish creator, owner, or subject identity.',
      scores: 'Evidence quality scores describe the source and observation quality; they are not identity probabilities.'
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
      totalSearchResults: numberValue(summary.totalSearchResults),
      totalMediaEvidence: numberValue(summary.totalMediaEvidence),
      totalEvidenceRecords: numberValue(summary.totalEvidenceRecords, evidence.length),
      overallConfidence: numberValue(summary.overallConfidence),
      confidenceLevel: summary.confidenceLevel || null,
      scoreMeaning: summary.scoreMeaning || 'source_evidence_quality_not_identity_probability'
    },
    socialAccounts: (report.socialAccounts || []).map(portableAccount),
    breaches: (report.breaches || []).map(portableBreach),
    domains: (report.domains || []).map(portableDomain),
    searchResults: (report.searchResults || []).map(portableSearchResult),
    media: (report.media || []).map(portableMedia),
    evidence,
    provenance: report.provenance || null,
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
    { value: (item) => item.displayName || '—' },
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
    { value: (item) => item.nameservers.join(', ') || '—' },
    { value: (item) => item.creationDate || '—' },
    { value: (item) => item.expirationDate || '—' }
  ]);

  const searchRows = tableRows(portable.searchResults, [
    { value: (item) => item.source || '—' },
    { value: (item) => item.title || '—' },
    { value: (item) => item.url || '—' },
    { value: (item) => item.snippet || '—' },
    { value: (item) => item.observedAt || '—' }
  ]);

  const mediaRows = tableRows(portable.media, [
    { value: (item) => item.caption || '—' },
    { value: (item) => item.mediaType || '—' },
    { value: (item) => item.metadata?.file?.sha256 || item.reference || '—' },
    { value: (item) => item.metadata?.exif?.available ? 'EXIF available' : 'No EXIF' },
    { value: (item) => item.location || '—' }
  ]);

  const evidenceRows = tableRows(portable.evidence, [
    { value: (item) => item.sourceName || '—' },
    { value: (item) => `${item.entityType || '—'}${item.entityId !== null ? ` #${item.entityId}` : ''}` },
    { value: (item) => item.evidenceType || '—' },
    { value: (item) => `${numberValue(item.qualityScore).toFixed(0)}%` },
    { value: (item) => item.observedAt || '—' },
    { value: (item) => item.sourceUrl || '—' }
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
main{max-width:1180px;margin:0 auto;padding:42px 34px 64px}header{border-bottom:2px solid var(--ink);padding-bottom:20px;margin-bottom:26px}
h1{font-size:28px;margin:4px 0 6px}h2{font-size:18px;margin:30px 0 12px}.eyebrow{font-size:11px;letter-spacing:.12em;color:var(--accent);font-weight:700}
.meta,.note{color:var(--muted)}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:18px 0}.metric{border:1px solid var(--line);border-radius:9px;padding:13px;background:var(--panel)}
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
<div class="metric"><span>Public profile records</span><strong>${escapeHtml(portable.summary.totalSocialAccounts)}</strong></div>
<div class="metric"><span>HIBP records</span><strong>${escapeHtml(portable.summary.totalBreaches)}</strong></div>
<div class="metric"><span>Domain records</span><strong>${escapeHtml(portable.summary.totalDomains)}</strong></div>
<div class="metric"><span>Web results</span><strong>${escapeHtml(portable.summary.totalSearchResults)}</strong></div>
<div class="metric"><span>Local media</span><strong>${escapeHtml(portable.summary.totalMediaEvidence)}</strong></div>
<div class="metric"><span>Evidence records</span><strong>${escapeHtml(portable.summary.totalEvidenceRecords)}</strong></div>
<div class="metric"><span>Aggregate evidence quality</span><strong>${escapeHtml(portable.summary.overallConfidence.toFixed(1))}%</strong></div>
</div>
<div class="notice"><strong>Interpretation limit:</strong> ${escapeHtml(portable.sourceNotes.scores)}</div>
</section>

<section>
<h2>Public profile observations</h2>
<table><thead><tr><th>Platform</th><th>Username</th><th>Display name</th><th>Profile URL</th><th>Evidence quality</th></tr></thead><tbody>${socialRows}</tbody></table>
</section>

<section>
<h2>Web search results</h2>
<div class="notice">Source when configured: Brave Search API. Retrieval does not establish identity.</div>
<table><thead><tr><th>Source</th><th>Title</th><th>URL</th><th>Snippet</th><th>Observed</th></tr></thead><tbody>${searchRows}</tbody></table>
</section>

<section>
<h2>Breach records</h2>
<div class="notice">Source: Have I Been Pwned. Attribution and HIBP service terms apply.</div>
<table><thead><tr><th>Breach</th><th>Date</th><th>Data classes</th><th>Source status</th></tr></thead><tbody>${breachRows}</tbody></table>
</section>

<section>
<h2>Domain infrastructure</h2>
<div class="notice">Sources: RDAP, Google Public DNS DoH, and certificate-transparency observations where available.</div>
<table><thead><tr><th>Domain</th><th>Registrar</th><th>Name servers</th><th>Created</th><th>Expires</th></tr></thead><tbody>${domainRows}</tbody></table>
</section>

<section>
<h2>Local image evidence</h2>
<div class="notice">Images are analyzed locally. The exported case contains hashes and metadata, not the image bytes.</div>
<table><thead><tr><th>File</th><th>Type</th><th>SHA-256 / reference</th><th>EXIF</th><th>GPS</th></tr></thead><tbody>${mediaRows}</tbody></table>
</section>

<section>
<h2>Evidence provenance</h2>
<table><thead><tr><th>Source</th><th>Entity</th><th>Evidence type</th><th>Quality</th><th>Observed</th><th>Source URL</th></tr></thead><tbody>${evidenceRows}</tbody></table>
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
  portableEvidence,
  toPortableReport,
  toJson,
  toHtml
};
