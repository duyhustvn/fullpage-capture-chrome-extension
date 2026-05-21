document.addEventListener('DOMContentLoaded', async () => {
  const btnFull     = document.getElementById('btn-full-page');
  const btnVisible  = document.getElementById('btn-visible');
  const btnSettings = document.getElementById('btn-settings');
  const statusEl    = document.getElementById('status');
  const progressEl  = document.getElementById('progress-wrap');
  const pdfOpts     = document.getElementById('pdf-opts');
  const pdfSizeEl   = document.getElementById('pdf-size');
  const fmtBtns     = document.querySelectorAll('.fmt-btn');

  let selectedFormat = 'png';

  // ── Load saved preferences ──
  chrome.storage.sync.get({ format: 'png', pdfPageSize: 'fit' }, prefs => {
    setFormat(prefs.format);
    pdfSizeEl.value = prefs.pdfPageSize;
  });

  // ── Progress updates from service worker ──
  chrome.runtime.onMessage.addListener(msg => {
    if (msg.action === 'progress') setStatus(msg.type, msg.text);
  });

  // ── Format toggle ──
  fmtBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      setFormat(btn.dataset.fmt);
      chrome.storage.sync.set({ format: btn.dataset.fmt });
    });
  });

  // ── PDF page size change persists ──
  pdfSizeEl.addEventListener('change', () => {
    chrome.storage.sync.set({ pdfPageSize: pdfSizeEl.value });
  });

  // ── Capture buttons ──
  btnFull.addEventListener('click', async () => {
    setBusy(true);
    setStatus('capturing', 'Starting…');
    const res = await chrome.runtime.sendMessage({
      action: 'captureFullPage',
      format: selectedFormat,
    }).catch(toErr);
    handleResult(res);
  });

  btnVisible.addEventListener('click', async () => {
    setBusy(true);
    setStatus('capturing', 'Capturing…');
    const res = await chrome.runtime.sendMessage({
      action: 'captureVisible',
      format: selectedFormat,
    }).catch(toErr);
    handleResult(res);
  });

  // ── Settings ──
  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // ── Helpers ──
  function setFormat(fmt) {
    selectedFormat = fmt;
    fmtBtns.forEach(b => b.classList.toggle('active', b.dataset.fmt === fmt));
    pdfOpts.classList.toggle('hidden', fmt !== 'pdf');
  }

  function handleResult(res) {
    if (res?.success) {
      setTimeout(() => setBusy(false), 1800);
    } else {
      setStatus('error', res?.error || 'Something went wrong');
      setBusy(false);
    }
  }

  function setBusy(busy) {
    btnFull.disabled    = busy;
    btnVisible.disabled = busy;
    progressEl.classList.toggle('hidden', !busy);
    if (!busy) setStatus('', '');
  }

  function setStatus(type, text) {
    statusEl.textContent = text;
    statusEl.className   = `status ${type}`;
  }

  function toErr(err) {
    return { success: false, error: err.message };
  }
});
