import { generatePdf } from '../lib/pdf-export.js';
import { generateFilename } from '../lib/utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  const { previewData } = await chrome.storage.local.get('previewData');

  if (!previewData) {
    showMsg('Error: no capture data found. Please try capturing again.');
    return;
  }

  const { dataUrl, hostname, format, pdfPageSize, autoSave } = previewData;

  // Auto-save mode: skip UI, save and close
  if (autoSave) {
    showMsg(`Saving ${format.toUpperCase()}…`);
    try {
      await doSave(dataUrl, format, pdfPageSize || 'fit', hostname);
    } finally {
      await chrome.storage.local.remove('previewData');
      closeTab();
    }
    return;
  }

  // Normal preview mode
  const img = await loadImage(dataUrl);
  const { naturalWidth: imgW, naturalHeight: imgH } = img;

  document.getElementById('info-dims').textContent = `${imgW} × ${imgH} px`;
  document.getElementById('info-size').textContent = formatBytes(Math.round(dataUrl.length * 0.75));

  const imgEl = document.getElementById('preview-img');
  imgEl.src = dataUrl;
  imgEl.classList.remove('hidden');
  document.getElementById('loading').classList.add('hidden');

  // Set PDF page size from captured setting
  if (pdfPageSize) document.getElementById('pdf-size').value = pdfPageSize;

  // ── Zoom ──
  const area = document.getElementById('preview-area');
  let zoom = 1;

  function applyZoom(z) {
    zoom = Math.max(0.1, Math.min(z, 8));
    imgEl.style.width = `${zoom * 100}%`;
    imgEl.style.cursor = zoom >= 4 ? 'zoom-out' : 'zoom-in';
    document.getElementById('zoom-label').textContent = `${Math.round(zoom * 100)}%`;
  }

  function fitZoom() {
    return Math.min(1, (area.clientWidth - 40) / imgW);
  }

  applyZoom(fitZoom());

  document.getElementById('btn-zoom-in').addEventListener('click', () => applyZoom(zoom + 0.25));
  document.getElementById('btn-zoom-out').addEventListener('click', () => applyZoom(zoom - 0.25));
  document.getElementById('btn-zoom-fit').addEventListener('click', () => applyZoom(fitZoom()));
  imgEl.addEventListener('click', () => applyZoom(zoom < 2 ? 2 : fitZoom()));

  // ── Save buttons ──
  document.getElementById('btn-save-png').addEventListener('click', async () => {
    setBusy(true);
    await doSave(dataUrl, 'png', null, hostname);
    setBusy(false);
    toast('PNG saved!');
  });

  document.getElementById('btn-save-pdf').addEventListener('click', async () => {
    const size = document.getElementById('pdf-size').value;
    setBusy(true);
    toast('Generating PDF…');
    try {
      await doSave(dataUrl, 'pdf', size, hostname);
      toast('PDF saved!');
    } catch (err) {
      toast('PDF error: ' + err.message, true);
    }
    setBusy(false);
  });

  // ── Copy ──
  document.getElementById('btn-copy').addEventListener('click', async () => {
    try {
      const blob = dataUrlToBlob(dataUrl);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Copied to clipboard!');
    } catch (err) {
      toast('Copy failed: ' + err.message, true);
    }
  });

  // ── Discard ──
  document.getElementById('btn-discard').addEventListener('click', async () => {
    await chrome.storage.local.remove('previewData');
    closeTab();
  });
});

async function doSave(dataUrl, format, pdfPageSize, hostname) {
  if (format === 'pdf') {
    const img = await loadImage(dataUrl);
    const blob = await generatePdf(dataUrl, pdfPageSize || 'fit', img.naturalWidth, img.naturalHeight);
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({ url, filename: generateFilename(hostname, 'pdf'), saveAs: false });
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } else {
    await chrome.downloads.download({
      url: dataUrl,
      filename: generateFilename(hostname, 'png'),
      saveAs: false,
    });
  }
}

function closeTab() {
  chrome.tabs.getCurrent(tab => { if (tab) chrome.tabs.remove(tab.id); });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function dataUrlToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(2)} MB`;
}

function setBusy(on) {
  document.querySelectorAll('.save-btn, .action-btn').forEach(b => b.disabled = on);
}

let toastTimer;
function toast(msg, isError = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

function showMsg(text) {
  document.getElementById('loading').textContent = text;
}
