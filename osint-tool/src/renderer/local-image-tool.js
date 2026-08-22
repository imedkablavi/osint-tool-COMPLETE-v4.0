(() => {
  try {
    viewTitles.tools = 'الأدوات المحلية';
  } catch {
    // Base renderer still works if the title map is unavailable.
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('analyze-local-image')?.addEventListener('click', () => analyzeLocalImage(false));
    document.getElementById('analyze-image-for-case')?.addEventListener('click', () => analyzeLocalImage(true));
    refreshImageToolState();
  });

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  }

  async function refreshImageToolState() {
    try {
      const result = await api.settings.get();
      if (!result.success) return;
      const exif = result.settings?.tools?.imageExif;
      const element = document.getElementById('image-tool-state');
      if (!element) return;
      element.textContent = exif?.available ? 'ExifTool جاهز' : 'Hash فقط';
      element.className = exif?.available ? 'status-ready' : 'status-muted';
      if (exif?.reason) element.title = exif.reason;
    } catch {
      // Hash analysis remains available even if readiness cannot be loaded.
    }
  }

  async function analyzeLocalImage(requireCase) {
    const personId = currentPersonId || null;
    if (requireCase && !personId) {
      showNotification('افتح حالة أولًا لإضافة الصورة إلى Evidence الخاص بها.', 'warning');
      return;
    }

    const button = requireCase
      ? document.getElementById('analyze-image-for-case')
      : document.getElementById('analyze-local-image');
    if (button) button.disabled = true;

    try {
      const response = await api.analysis.analyzeLocalImage(personId);
      if (!response.success) throw new Error(response.error || 'تعذر تحليل الصورة.');
      if (response.canceled) return;

      renderImageToolResult(response.result || {}, personId);
      showNotification(
        personId
          ? 'تم تحليل الصورة وحفظ hash/metadata داخل الحالة.'
          : 'تم تحليل الصورة محليًا بدون حفظها في حالة.',
        'success'
      );

      if (personId) {
        const reportResult = await api.cases.report(personId);
        if (reportResult.success) {
          currentReport = reportResult.report;
          showResults(currentReport);
        }
      }
    } catch (error) {
      showNotification(error.message || 'تعذر تحليل الصورة.', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  }

  function renderImageToolResult(result, personId) {
    const container = document.getElementById('image-analysis-result');
    if (!container) return;

    const file = result.file || {};
    const exif = result.exif || {};
    const camera = exif.camera || {};
    const gps = exif.gps || {};
    const hasGps = Number.isFinite(Number(gps.latitude)) && Number.isFinite(Number(gps.longitude));

    container.innerHTML = `
      <div class="tool-result-card">
        <div class="card-topline"><span>LOCAL ANALYSIS</span><span>${personId ? `CASE #${esc(personId)}` : 'EPHEMERAL'}</span></div>
        <h3>${esc(file.name || 'Local image')}</h3>
        <dl class="detail-list">
          <div><dt>SHA-256</dt><dd class="hash-value">${esc(file.sha256 || '—')}</dd></div>
          <div><dt>الحجم</dt><dd>${esc(formatBytes(file.sizeBytes))}</dd></div>
          <div><dt>الامتداد</dt><dd>${esc(file.extension || '—')}</dd></div>
          <div><dt>EXIF</dt><dd>${exif.available ? 'متاح' : esc(exif.error || 'غير متاح')}</dd></div>
          <div><dt>الكاميرا</dt><dd>${esc([camera.make, camera.model].filter(Boolean).join(' ') || '—')}</dd></div>
          <div><dt>GPS</dt><dd>${hasGps ? `${esc(gps.latitude)}, ${esc(gps.longitude)}` : 'غير متاح'}</dd></div>
        </dl>
        <p class="panel-note">لا يتم رفع الصورة ولا حفظ مسار الملف. عند ربطها بحالة، يحفظ التطبيق hash والـmetadata فقط.</p>
      </div>`;
  }
})();
