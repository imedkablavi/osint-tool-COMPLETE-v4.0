(() => {
  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function parseJson(value, fallback = {}) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 ** 2)).toFixed(1)} MB`;
  }

  function evidenceFor(report, entityType, entityId) {
    return (report?.evidence || []).find((row) =>
      (row.entity_type || row.entityType) === entityType &&
      Number(row.entity_id ?? row.entityId) === Number(entityId)
    );
  }

  function renderSearch(report) {
    const container = document.getElementById('search-content');
    if (!container) return;
    const rows = Array.isArray(report?.searchResults) ? report.searchResults : [];

    if (!rows.length) {
      container.innerHTML = '<div class="panel empty-state">لا توجد نتائج Web Search محفوظة. اضبط Brave Search API key من الإعدادات لتفعيل البحث الرسمي.</div>';
      return;
    }

    container.innerHTML = `
      <div class="panel evidence-intro">
        <span class="section-kicker">WEB SEARCH</span>
        <h3>نتائج بحث منظمة</h3>
        <p class="panel-note">النتيجة تعني أن محرك البحث أعاد الصفحة للاستعلام، وليست إثباتًا أن الصفحة تعود للشخص نفسه.</p>
      </div>
      <div class="search-result-list">
        ${rows.map((row) => {
          const evidence = evidenceFor(report, 'search_result', row.id);
          const metadata = parseJson(evidence?.metadata, {});
          return `<article class="panel search-result-card">
            <div class="card-topline"><span>${esc(row.source || 'Search API')}</span><span>${metadata.rank ? `#${esc(metadata.rank)}` : ''}</span></div>
            <h3>${esc(row.title || row.url || 'نتيجة بحث')}</h3>
            <p>${esc(row.snippet || 'لا يوجد وصف متاح.')}</p>
            <div class="tag-row">
              ${metadata.queryCategory ? `<span>${esc(metadata.queryCategory)}</span>` : ''}
              ${metadata.query ? `<span class="query-tag">${esc(metadata.query)}</span>` : ''}
            </div>
            ${row.url ? `<button class="link-button" type="button" data-external-url="${esc(row.url)}">فتح النتيجة</button>` : ''}
          </article>`;
        }).join('')}
      </div>`;
  }

  function renderMedia(report) {
    const container = document.getElementById('media-content');
    if (!container) return;
    const rows = Array.isArray(report?.media) ? report.media : [];

    if (!rows.length) {
      container.innerHTML = '<div class="panel empty-state">لا يوجد Image Evidence محلي في هذه الحالة. استخدم زر «تحليل صورة محلية» لإضافة hash وEXIF بدون رفع الصورة.</div>';
      return;
    }

    container.innerHTML = rows.map((row) => {
      const metadata = parseJson(row.exif_data, {});
      const file = metadata.file || {};
      const exif = metadata.exif || {};
      const camera = exif.camera || {};
      const gps = exif.gps || {};
      const hasGps = Number.isFinite(Number(gps.latitude)) && Number.isFinite(Number(gps.longitude));
      const sha = file.sha256 || String(row.url || '').replace(/^urn:sha256:/, '') || '—';

      return `<article class="panel media-evidence-card">
        <div class="card-topline"><span>LOCAL FILE</span><span>${esc(file.extension || row.media_type || '')}</span></div>
        <h3>${esc(row.caption || file.name || 'Local image')}</h3>
        <dl class="detail-list">
          <div><dt>SHA-256</dt><dd class="hash-value">${esc(sha)}</dd></div>
          <div><dt>الحجم</dt><dd>${esc(formatBytes(file.sizeBytes))}</dd></div>
          <div><dt>الكاميرا</dt><dd>${esc([camera.make, camera.model].filter(Boolean).join(' ') || 'غير متاح')}</dd></div>
          <div><dt>Lens</dt><dd>${esc(camera.lens || '—')}</dd></div>
          <div><dt>Capture time</dt><dd>${esc(exif.capture?.dateTimeOriginal || exif.capture?.createDate || '—')}</dd></div>
          <div><dt>GPS</dt><dd>${hasGps ? `${esc(gps.latitude)}, ${esc(gps.longitude)}` : 'غير متاح'}</dd></div>
        </dl>
        <p class="panel-note">تم حفظ metadata والـhash فقط؛ مسار الملف والصورة نفسها غير محفوظين في الحالة.</p>
      </article>`;
    }).join('');
  }

  function enhanceSummary(report) {
    const container = document.getElementById('results-summary');
    if (!container) return;
    const summary = report?.summary || {};
    const extra = [
      ['Web Search', Number(summary.totalSearchResults) || 0],
      ['صور محلية', Number(summary.totalMediaEvidence) || 0],
      ['Evidence', Number(summary.totalEvidenceRecords) || 0]
    ];
    for (const [label, value] of extra) {
      const card = document.createElement('div');
      card.className = 'metric-card';
      card.innerHTML = `<span>${esc(label)}</span><strong>${esc(value)}</strong>`;
      container.appendChild(card);
    }
  }

  const baseShowResults = window.showResults || showResults;
  window.showResults = function showResultsWithSearchAndMedia(report) {
    baseShowResults(report);
    renderSearch(report);
    renderMedia(report);
    enhanceSummary(report);
  };
})();
