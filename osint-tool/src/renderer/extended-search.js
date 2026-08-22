document.addEventListener('DOMContentLoaded', () => {
  refreshExtendedToolReadiness();
});

async function refreshExtendedToolReadiness() {
  try {
    const result = await api.settings.get();
    if (!result.success) return;

    const tools = result.settings?.tools || {};
    updateToolReadiness('sherlock-readiness', tools.sherlock);
    updateToolReadiness('maigret-readiness', tools.maigret);
    updateToolReadiness('exif-readiness', tools.imageExif);

    const extendedToggle = document.getElementById('extended-username-search');
    if (extendedToggle) {
      const hasExtendedTool = Boolean(tools.sherlock?.available || tools.maigret?.available);
      extendedToggle.disabled = !hasExtendedTool;
      const label = extendedToggle.closest('.tool-toggle');
      label?.classList.toggle('tool-toggle-unavailable', !hasExtendedTool);
      if (!hasExtendedTool) {
        extendedToggle.checked = false;
        label?.setAttribute('title', 'ثبّت Sherlock أو Maigret محليًا ثم أعد تشغيل التطبيق لتفعيل البحث الموسع.');
      } else {
        label?.removeAttribute('title');
      }
    }
  } catch {
    // Readiness stays conservative when the main process cannot report status.
  }
}

function updateToolReadiness(elementId, status) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const ready = Boolean(status?.available);
  element.textContent = ready ? 'جاهز' : 'غير متوفر';
  element.className = ready ? 'status-ready' : 'status-muted';
  if (status?.reason) element.title = status.reason;
}

// Overrides the base renderer function. The original form handler resolves this
// global function at submit time, so the rest of the renderer remains isolated
// and unchanged while the optional search flag is added to the IPC payload.
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

    const extendedUsernameSearch = Boolean(
      data.username && document.getElementById('extended-username-search')?.checked
    );

    updateLoadingMessage(extendedUsernameSearch
      ? 'جمع البيانات وتشغيل البحث الموسع…'
      : 'جمع البيانات من المصادر المفعلة…');

    const result = await api.cases.start({
      personId: currentPersonId,
      authorizedUse,
      extendedUsernameSearch
    });
    if (!result.success) throw new Error(result.error);

    currentReport = result.report;
    showResults(currentReport);
    showNotification(
      extendedUsernameSearch
        ? 'اكتملت الحالة مع البحث الموسع. تحقق يدويًا من نتائج Sherlock/Maigret.'
        : 'اكتملت الحالة. راجع جودة الدليل ومصدر كل نتيجة.',
      'success'
    );
    document.getElementById('investigation-form').reset();
  } catch (error) {
    showNotification(error.message || 'تعذر إكمال الحالة.', 'error');
  } finally {
    stopProgress();
    hideLoading();
  }
}
