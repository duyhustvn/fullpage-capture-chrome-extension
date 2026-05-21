import { getSettings, saveSettings } from '../lib/settings.js';

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await getSettings();

  // Populate form
  setRadio('format', settings.format);
  document.getElementById('pdf-page-size').value = settings.pdfPageSize;
  setRadio('showPreview', String(settings.showPreview));
  setRadio('captureMethod', settings.captureMethod);

  const delaySlider = document.getElementById('capture-delay');
  const delayVal    = document.getElementById('delay-val');
  delaySlider.value = settings.captureDelay;
  delayVal.textContent = `${settings.captureDelay}s`;

  delaySlider.addEventListener('input', () => {
    delayVal.textContent = `${delaySlider.value}s`;
  });

  // Save
  document.getElementById('btn-save').addEventListener('click', async () => {
    await saveSettings({
      format:        getRadio('format'),
      pdfPageSize:   document.getElementById('pdf-page-size').value,
      showPreview:   getRadio('showPreview') === 'true',
      captureMethod: getRadio('captureMethod'),
      captureDelay:  Number(delaySlider.value),
    });

    const status = document.getElementById('save-status');
    status.textContent = 'Saved!';
    setTimeout(() => { status.textContent = ''; }, 2000);
  });
});

function setRadio(name, value) {
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if (el) el.checked = true;
}

function getRadio(name) {
  const el = document.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : null;
}
