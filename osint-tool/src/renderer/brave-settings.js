document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('save-brave-key')?.addEventListener('click', saveBraveKey);
  document.getElementById('clear-brave-key')?.addEventListener('click', clearBraveKey);
  refreshBraveState();
});

async function saveBraveKey() {
  const input = document.getElementById('brave-api-key');
  const braveApiKey = input?.value.trim() || '';
  if (!braveApiKey) {
    showNotification('أدخل Brave Search API key أو استخدم زر حذف المفتاح.', 'warning');
    return;
  }

  const result = await api.settings.save({ braveApiKey });
  if (!result.success) {
    showNotification(result.error || 'تعذر حفظ مفتاح Brave.', 'error');
    return;
  }

  input.value = '';
  showNotification('تم حفظ Brave Search API key في التخزين الآمن للنظام.', 'success');
  await refreshBraveState();
}

async function clearBraveKey() {
  const result = await api.settings.save({ clearBraveApiKey: true });
  if (!result.success) {
    showNotification(result.error || 'تعذر حذف مفتاح Brave.', 'error');
    return;
  }

  const input = document.getElementById('brave-api-key');
  if (input) input.value = '';
  showNotification('تم حذف Brave Search API key المحفوظ.', 'success');
  await refreshBraveState();
}

async function refreshBraveState() {
  try {
    const result = await api.settings.get();
    if (!result.success) return;
    const settings = result.settings || {};
    const ready = Boolean(settings.hasBraveApiKey);

    for (const elementId of ['brave-key-state', 'brave-readiness', 'tools-brave-state']) {
      const element = document.getElementById(elementId);
      if (!element) continue;
      element.textContent = ready ? 'جاهز' : 'غير مضبوط';
      element.className = ready ? 'status-ready' : 'status-muted';
    }
  } catch {
    // Keep conservative default state when settings cannot be read.
  }
}
