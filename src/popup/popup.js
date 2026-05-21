document.addEventListener('DOMContentLoaded', async () => {
  const btnFull      = document.getElementById('btn-full-page');
  const btnVisible   = document.getElementById('btn-visible');
  const btnArea      = document.getElementById('btn-area');
  const btnClipboard = document.getElementById('btn-clipboard');
  const btnSettings  = document.getElementById('btn-settings');
  const statusEl     = document.getElementById('status');
  const progressEl   = document.getElementById('progress-wrap');
  const pdfOpts      = document.getElementById('pdf-opts');
  const pdfSizeEl    = document.getElementById('pdf-size');
  const fmtBtns      = document.querySelectorAll('.fmt-btn');

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

  pdfSizeEl.addEventListener('change', () => {
    chrome.storage.sync.set({ pdfPageSize: pdfSizeEl.value });
  });

  // ── Capture buttons ──
  btnFull.addEventListener('click', async () => {
    setBusy(true);
    setStatus('capturing', 'Starting…');
    const res = await chrome.runtime.sendMessage({ action: 'captureFullPage', format: selectedFormat }).catch(toErr);
    handleResult(res);
  });

  btnVisible.addEventListener('click', async () => {
    setBusy(true);
    setStatus('capturing', 'Capturing…');
    const res = await chrome.runtime.sendMessage({ action: 'captureVisible', format: selectedFormat }).catch(toErr);
    handleResult(res);
  });

  btnArea.addEventListener('click', async () => {
    setBusy(true);
    setStatus('capturing', 'Click and drag on the page to select an area…');
    const res = await chrome.runtime.sendMessage({ action: 'captureArea', format: selectedFormat }).catch(toErr);
    if (res?.error === 'Selection cancelled') {
      setStatus('', '');
      setBusy(false);
      return;
    }
    handleResult(res);
  });

  // ── Copy to Clipboard ──
  btnClipboard.addEventListener('click', async () => {
    setBusy(true);
    setStatus('capturing', 'Capturing…');
    const res = await chrome.runtime.sendMessage({ action: 'captureForClipboard' }).catch(toErr);
    if (!res?.success) {
      setStatus('error', res?.error || 'Capture failed');
      setBusy(false);
      return;
    }
    try {
      const blob = dataUrlToBlob(res.dataUrl);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setStatus('done', 'Copied to clipboard!');
    } catch (err) {
      setStatus('error', 'Clipboard write failed: ' + err.message);
    }
    setTimeout(() => setBusy(false), 1800);
  });

  // ── Settings ──
  btnSettings.addEventListener('click', () => chrome.runtime.openOptionsPage());

  // ── History ──
  await loadHistory();

  document.getElementById('btn-history').addEventListener('click', () => {
    const panel  = document.getElementById('history-panel');
    const toggle = document.getElementById('btn-history');
    const open   = panel.classList.toggle('hidden') === false;
    toggle.classList.toggle('open', open);
  });

  document.getElementById('btn-clear-history').addEventListener('click', async () => {
    await chrome.storage.local.remove('captureHistory');
    renderHistory([]);
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
    [btnFull, btnVisible, btnArea, btnClipboard].forEach(b => b.disabled = busy);
    progressEl.classList.toggle('hidden', !busy);
    if (!busy) setStatus('', '');
  }

  function setStatus(type, text) {
    statusEl.textContent = text;
    statusEl.className   = `status ${type}`;
  }

  function toErr(err) { return { success: false, error: err.message }; }
});

// ── History ───────────────────────────────────────────────────────────────────
async function loadHistory() {
  const { captureHistory = [] } = await chrome.storage.local.get('captureHistory');
  renderHistory(captureHistory);
}

function renderHistory(list) {
  const count = document.getElementById('history-count');
  const el    = document.getElementById('history-list');

  if (list.length === 0) {
    count.classList.add('hidden');
    el.innerHTML = '<p class="history-empty">No captures yet</p>';
    return;
  }

  count.textContent = list.length;
  count.classList.remove('hidden');

  el.innerHTML = '';
  const recent = list.slice(0, 10);
  for (const entry of recent) {
    const item = document.createElement('div');
    item.className = 'history-item';

    const thumb = document.createElement('img');
    thumb.className = 'history-thumb';
    thumb.src       = entry.thumbnail || '';
    thumb.alt       = '';

    const meta = document.createElement('div');
    meta.className = 'history-meta';

    const host = document.createElement('div');
    host.className   = 'history-host';
    host.textContent = entry.hostname || '(unknown)';

    const time = document.createElement('div');
    time.className   = 'history-time';
    time.textContent = formatRelTime(entry.timestamp);

    meta.appendChild(host);
    meta.appendChild(time);
    item.appendChild(thumb);
    item.appendChild(meta);
    el.appendChild(item);
  }
}

function formatRelTime(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function dataUrlToBlob(dataUrl) {
  const [hdr, b64] = dataUrl.split(',');
  const mime = hdr.match(/:(.*?);/)[1];
  const raw  = atob(b64);
  const buf  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return new Blob([buf], { type: mime });
}
