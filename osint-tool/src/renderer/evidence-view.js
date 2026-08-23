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

  function qualityClass(value) {
    const score = Number(value) || 0;
    if (score >= 75) return 'success';
    if (score >= 50) return 'info';
    if (score >= 25) return 'warning';
    return 'danger';
  }

  function formatObserved(value) {
    if (!value) return 'غير محدد';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  window.displayEvidence = function displayEvidence(records) {
    const container = document.getElementById('evidence-content');
    if (!container) return;

    if (!Array.isArray(records) || records.length === 0) {
      container.innerHTML = '<div class="panel empty-state">لا توجد سجلات provenance بعد. عند فتح تقرير قديم، يحاول التطبيق إنشاء سجلات evidence من البيانات المحفوظة بدون اختلاق مصدر غير معروف.</div>';
      return;
    }

    container.innerHTML = `
      <div class="panel evidence-intro">
        <span class="section-kicker">PROVENANCE</span>
        <h3>سجل مصدر كل دليل</h3>
        <p class="panel-note">الـQuality هنا يقيس جودة المصدر وطريقة الملاحظة، وليس احتمال أن الهوية مؤكدة.</p>
      </div>
      <div class="data-table evidence-table">
        <table>
          <thead><tr><th>المصدر</th><th>الكيان</th><th>نوع الدليل</th><th>الجودة</th><th>وقت الجمع</th><th>الرابط</th></tr></thead>
          <tbody>${records.map((row) => {
            const metadata = parseJson(row.metadata, {});
            const score = Number(row.quality_score ?? row.qualityScore) || 0;
            const sourceUrl = row.source_url || row.sourceUrl || '';
            const entityType = row.entity_type || row.entityType || '—';
            const entityId = row.entity_id ?? row.entityId;
            return `
              <tr>
                <td><strong>${esc(row.source_name || row.sourceName || 'Unknown')}</strong><small class="source-note">${esc(row.source_type || row.sourceType || '')}</small></td>
                <td>${esc(entityType)}${entityId !== null && entityId !== undefined ? ` #${esc(entityId)}` : ''}</td>
                <td>${esc(row.evidence_type || row.evidenceType || 'observation')}<small class="source-note">${esc(metadata.checkMethod || metadata.caveat || '')}</small></td>
                <td><span class="badge badge-${qualityClass(score)}">${score.toFixed(0)}%</span></td>
                <td>${esc(formatObserved(row.observed_at || row.observedAt))}</td>
                <td>${sourceUrl ? `<button class="link-button" type="button" data-external-url="${esc(sourceUrl)}">فتح المصدر</button>` : '—'}</td>
              </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;
  };

  const baseShowResults = window.showResults || showResults;
  window.showResults = function showResultsWithEvidence(report) {
    baseShowResults(report);
    window.displayEvidence(report?.evidence || []);
  };
})();
