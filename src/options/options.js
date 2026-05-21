import { getSettings, saveSettings } from '../lib/settings.js';

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await getSettings();

  // ── Phase 1 / 2 settings ──
  setRadio('format',        settings.format);
  setRadio('showPreview',   String(settings.showPreview));
  setRadio('captureMethod', settings.captureMethod);
  document.getElementById('pdf-page-size').value = settings.pdfPageSize;

  bindSlider('capture-delay', 'delay-val', settings.captureDelay, v => `${v}s`);

  // ── Phase 3 settings ──
  setRadio('lazyLoadEnabled', String(settings.lazyLoadEnabled));
  setRadio('saveHistory',     String(settings.saveHistory));

  bindSlider('lazy-timeout',  'lazy-timeout-val',  settings.lazyLoadTimeout,      v => `${v}s`);
  bindSlider('scroll-limit',  'scroll-limit-val',  settings.infiniteScrollLimit,
    v => v === '0' ? 'No limit' : `${Number(v).toLocaleString()}px`);

  // ── Save ──
  document.getElementById('btn-save').addEventListener('click', async () => {
    await saveSettings({
      format:               getRadio('format'),
      pdfPageSize:          document.getElementById('pdf-page-size').value,
      showPreview:          getRadio('showPreview') === 'true',
      captureMethod:        getRadio('captureMethod'),
      captureDelay:         sliderVal('capture-delay'),
      lazyLoadEnabled:      getRadio('lazyLoadEnabled') === 'true',
      lazyLoadTimeout:      sliderVal('lazy-timeout'),
      infiniteScrollLimit:  sliderVal('scroll-limit'),
      saveHistory:          getRadio('saveHistory') === 'true',
    });

    const st = document.getElementById('save-status');
    st.textContent = 'Saved!';
    setTimeout(() => { st.textContent = ''; }, 2000);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function setRadio(name, value) {
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}

function getRadio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}

function bindSlider(sliderId, valId, initial, fmt) {
  const slider = document.getElementById(sliderId);
  const label  = document.getElementById(valId);
  if (!slider || !label) return;
  slider.value    = initial;
  label.textContent = fmt(String(initial));
  slider.addEventListener('input', () => { label.textContent = fmt(slider.value); });
}

function sliderVal(id) {
  return Number(document.getElementById(id).value);
}
