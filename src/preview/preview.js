import { generatePdf, generatePdfFromChunks } from '../lib/pdf-export.js';
import { generateFilename } from '../lib/utils.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const { previewData } = await chrome.storage.local.get('previewData');

  if (!previewData) {
    showMsg('Error: no capture data found. Please try capturing again.');
    return;
  }

  const { dataUrl, chunks, hostname, format, pdfPageSize, autoSave } = previewData;
  const isChunked = Array.isArray(chunks) && chunks.length > 0;
  const primaryUrl = isChunked ? chunks[0] : dataUrl;

  // ── Auto-save mode (skip UI) ──────────────────────────────────────────────
  if (autoSave) {
    showMsg(`Saving ${format.toUpperCase()}…`);
    try {
      await doSave(primaryUrl, chunks, format, pdfPageSize || 'fit', hostname);
    } finally {
      await chrome.storage.local.remove('previewData');
      closeTab();
    }
    return;
  }

  // ── Load primary image ────────────────────────────────────────────────────
  const img = await loadImage(primaryUrl);
  const { naturalWidth: imgW, naturalHeight: imgH } = img;

  document.getElementById('info-dims').textContent = `${imgW} × ${imgH} px`;
  document.getElementById('info-size').textContent = formatBytes(Math.round(primaryUrl.length * 0.75));

  if (isChunked) {
    const ci = document.getElementById('info-chunks');
    ci.textContent = `${chunks.length} parts`;
    ci.classList.remove('hidden');
  }

  const wrapper = document.getElementById('img-wrapper');
  const imgEl   = document.getElementById('preview-img');
  imgEl.src = primaryUrl;
  wrapper.classList.remove('hidden');
  document.getElementById('loading').classList.add('hidden');

  if (pdfPageSize) document.getElementById('pdf-size').value = pdfPageSize;

  // ── Zoom ──────────────────────────────────────────────────────────────────
  const area = document.getElementById('preview-area');
  let zoom = 1;

  function applyZoom(z) {
    zoom = Math.max(0.1, Math.min(z, 8));
    imgEl.style.width = `${zoom * 100}%`;
    document.getElementById('zoom-label').textContent = `${Math.round(zoom * 100)}%`;
    annotator.syncCanvasSize();
  }

  const fitZoom = () => Math.min(1, (area.clientWidth - 40) / imgW);
  applyZoom(fitZoom());

  document.getElementById('btn-zoom-in').addEventListener('click',  () => applyZoom(zoom + 0.25));
  document.getElementById('btn-zoom-out').addEventListener('click', () => applyZoom(zoom - 0.25));
  document.getElementById('btn-zoom-fit').addEventListener('click', () => applyZoom(fitZoom()));
  imgEl.addEventListener('click', () => applyZoom(zoom < 2 ? 2 : fitZoom()));

  // ── Annotator ─────────────────────────────────────────────────────────────
  const canvasEl  = document.getElementById('anno-canvas');
  const annotator = new Annotator(canvasEl, imgEl, imgW, imgH);

  document.getElementById('annotate-toggle').addEventListener('change', e => {
    const on = e.target.checked;
    document.getElementById('anno-toolbar').classList.toggle('hidden', !on);
    canvasEl.classList.toggle('active', on);
    if (on) annotator.syncCanvasSize();
  });

  // Tool buttons
  document.querySelectorAll('.anno-btn[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.anno-btn[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      annotator.tool = btn.dataset.tool;
    });
  });

  document.getElementById('anno-color').addEventListener('input', e => { annotator.color = e.target.value; });
  document.getElementById('anno-size').addEventListener('change', e => { annotator.strokeWidth = +e.target.value; });
  document.getElementById('anno-undo').addEventListener('click', () => annotator.undo());
  document.getElementById('anno-redo').addEventListener('click', () => annotator.redo());
  document.getElementById('anno-clear').addEventListener('click', () => annotator.clear());

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'z') annotator.undo();
    if (e.ctrlKey && e.key === 'y') annotator.redo();
  });

  // ── Save buttons ──────────────────────────────────────────────────────────
  document.getElementById('btn-save-png').addEventListener('click', async () => {
    setBusy(true);
    try {
      const saveUrl = annotator.hasAnnotations()
        ? await annotator.mergeToDataUrl(primaryUrl)
        : primaryUrl;
      if (isChunked && !annotator.hasAnnotations()) {
        // Download each chunk as numbered PNG
        for (let i = 0; i < chunks.length; i++) {
          const fn = generateFilename(hostname, 'png').replace('.png', `-part${i + 1}.png`);
          await chrome.downloads.download({ url: chunks[i], filename: fn, saveAs: false });
        }
        toast(`Saved ${chunks.length} PNG parts`);
      } else {
        await chrome.downloads.download({ url: saveUrl, filename: generateFilename(hostname, 'png'), saveAs: false });
        toast('PNG saved!');
      }
    } finally { setBusy(false); }
  });

  document.getElementById('btn-save-pdf').addEventListener('click', async () => {
    const size = document.getElementById('pdf-size').value;
    setBusy(true);
    toast('Generating PDF…');
    try {
      const saveUrl = annotator.hasAnnotations()
        ? await annotator.mergeToDataUrl(primaryUrl)
        : null;
      await doSave(saveUrl || primaryUrl, saveUrl ? null : chunks, 'pdf', size, hostname);
      toast('PDF saved!');
    } catch (err) {
      toast('PDF error: ' + err.message, true);
    } finally { setBusy(false); }
  });

  // ── Copy ──────────────────────────────────────────────────────────────────
  document.getElementById('btn-copy').addEventListener('click', async () => {
    try {
      const copyUrl = annotator.hasAnnotations()
        ? await annotator.mergeToDataUrl(primaryUrl)
        : primaryUrl;
      const blob = dataUrlToBlob(copyUrl);
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Copied to clipboard!');
    } catch (err) {
      toast('Copy failed: ' + err.message, true);
    }
  });

  // ── Discard ───────────────────────────────────────────────────────────────
  document.getElementById('btn-discard').addEventListener('click', async () => {
    await chrome.storage.local.remove('previewData');
    closeTab();
  });
});

// ── Save dispatcher ───────────────────────────────────────────────────────────
async function doSave(primaryUrl, chunks, format, pdfPageSize, hostname) {
  if (format === 'pdf') {
    const isChunked = Array.isArray(chunks) && chunks.length > 0;
    const blob = isChunked
      ? await generatePdfFromChunks(chunks, pdfPageSize || 'a4')
      : await (async () => {
          const img = await loadImage(primaryUrl);
          return generatePdf(primaryUrl, pdfPageSize || 'fit', img.naturalWidth, img.naturalHeight);
        })();
    const url = URL.createObjectURL(blob);
    await chrome.downloads.download({ url, filename: generateFilename(hostname, 'pdf'), saveAs: false });
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  } else {
    await chrome.downloads.download({ url: primaryUrl, filename: generateFilename(hostname, 'png'), saveAs: false });
  }
}

// ── Annotator class ───────────────────────────────────────────────────────────
class Annotator {
  constructor(canvas, imgEl, naturalW, naturalH) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.imgEl    = imgEl;
    this.naturalW = naturalW;
    this.naturalH = naturalH;
    this.tool        = 'freehand';
    this.color       = '#e8212a';
    this.strokeWidth = 4;

    this._history  = [];   // ImageData snapshots
    this._hIdx     = -1;
    this._drawing  = false;
    this._snapshot = null; // canvas state before current stroke
    this._sx = 0; this._sy = 0;

    canvas.addEventListener('mousedown', e => this._onDown(e));
    canvas.addEventListener('mousemove', e => this._onMove(e));
    canvas.addEventListener('mouseup',   e => this._onUp(e));
    canvas.addEventListener('mouseleave',() => { if (this._drawing) { this._drawing = false; this._saveState(); } });
  }

  syncCanvasSize() {
    // Canvas resolution = natural image size; CSS scales it to displayed size
    if (this.canvas.width !== this.naturalW || this.canvas.height !== this.naturalH) {
      const saved = this._hIdx >= 0 ? this._history[this._hIdx] : null;
      this.canvas.width  = this.naturalW;
      this.canvas.height = this.naturalH;
      if (saved) this.ctx.putImageData(saved, 0, 0);
    }
  }

  hasAnnotations() { return this._hIdx >= 0; }

  // Scale mouse event to canvas (natural image) coords
  _pos(e) {
    const r  = this.canvas.getBoundingClientRect();
    const sx = this.naturalW / r.width;
    const sy = this.naturalH / r.height;
    return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
  }

  _onDown(e) {
    e.preventDefault();
    this._drawing  = true;
    const p        = this._pos(e);
    this._sx = p.x; this._sy = p.y;
    this._snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    if (this.tool === 'freehand') {
      this.ctx.beginPath();
      this.ctx.moveTo(p.x, p.y);
    } else if (this.tool === 'text') {
      this._drawing = false;
      const text = window.prompt('Enter text:');
      if (text) {
        this.ctx.font      = `bold ${this.strokeWidth * 5}px system-ui, sans-serif`;
        this.ctx.fillStyle = this.color;
        this.ctx.fillText(text, p.x, p.y);
        this._saveState();
      }
    }
  }

  _onMove(e) {
    if (!this._drawing) return;
    e.preventDefault();
    const p = this._pos(e);
    if (this.tool === 'freehand') {
      this.ctx.strokeStyle = this.color;
      this.ctx.lineWidth   = this.strokeWidth;
      this.ctx.lineCap     = 'round';
      this.ctx.lineJoin    = 'round';
      this.ctx.lineTo(p.x, p.y);
      this.ctx.stroke();
    } else {
      this.ctx.putImageData(this._snapshot, 0, 0);
      this._drawShape(this._sx, this._sy, p.x, p.y);
    }
  }

  _onUp(e) {
    if (!this._drawing) return;
    this._drawing = false;
    e.preventDefault();
    if (this.tool !== 'freehand') {
      const p = this._pos(e);
      this.ctx.putImageData(this._snapshot, 0, 0);
      this._drawShape(this._sx, this._sy, p.x, p.y);
    }
    this._saveState();
  }

  _drawShape(x1, y1, x2, y2) {
    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth   = this.strokeWidth;
    this.ctx.fillStyle   = this.color;

    if (this.tool === 'arrow') {
      const hl    = Math.max(14, this.strokeWidth * 4);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      this.ctx.beginPath();
      this.ctx.moveTo(x1, y1);
      this.ctx.lineTo(x2, y2);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(x2, y2);
      this.ctx.lineTo(x2 - hl * Math.cos(angle - Math.PI / 6), y2 - hl * Math.sin(angle - Math.PI / 6));
      this.ctx.lineTo(x2 - hl * Math.cos(angle + Math.PI / 6), y2 - hl * Math.sin(angle + Math.PI / 6));
      this.ctx.closePath();
      this.ctx.fill();
    } else if (this.tool === 'rect') {
      this.ctx.beginPath();
      this.ctx.rect(x1, y1, x2 - x1, y2 - y1);
      this.ctx.stroke();
    } else if (this.tool === 'highlight') {
      this.ctx.save();
      this.ctx.globalAlpha = 0.35;
      this.ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      this.ctx.restore();
    }
  }

  _saveState() {
    this._history = this._history.slice(0, this._hIdx + 1);
    this._history.push(this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height));
    this._hIdx++;
    if (this._history.length > 30) { this._history.shift(); this._hIdx--; }
  }

  undo() {
    if (this._hIdx > 0) {
      this._hIdx--;
      this.ctx.putImageData(this._history[this._hIdx], 0, 0);
    } else if (this._hIdx === 0) {
      this._hIdx = -1;
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  redo() {
    if (this._hIdx < this._history.length - 1) {
      this._hIdx++;
      this.ctx.putImageData(this._history[this._hIdx], 0, 0);
    }
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this._history = [];
    this._hIdx    = -1;
  }

  async mergeToDataUrl(originalDataUrl) {
    const origImg = await loadImage(originalDataUrl);
    const merge   = document.createElement('canvas');
    merge.width   = this.naturalW;
    merge.height  = this.naturalH;
    const ctx = merge.getContext('2d');
    ctx.drawImage(origImg, 0, 0, this.naturalW, this.naturalH);
    ctx.drawImage(this.canvas, 0, 0);
    return merge.toDataURL('image/png');
  }
}

// ── Shared helpers ────────────────────────────────────────────────────────────
function closeTab() {
  chrome.tabs.getCurrent(tab => { if (tab) chrome.tabs.remove(tab.id); });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function dataUrlToBlob(dataUrl) {
  const [hdr, b64] = dataUrl.split(',');
  const mime = hdr.match(/:(.*?);/)[1];
  const raw  = atob(b64);
  const buf  = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return new Blob([buf], { type: mime });
}

function formatBytes(n) {
  if (n < 1024)    return `${n} B`;
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
  el.className   = 'toast' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

function showMsg(text) {
  document.getElementById('loading').textContent = text;
}
