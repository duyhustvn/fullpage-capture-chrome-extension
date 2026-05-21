import { cdpCapture }         from '../lib/cdp-capture.js';
import { scrollStitchCapture } from '../lib/scroll-stitch.js';
import { stitchFrames }        from '../lib/stitcher.js';
import { blobToDataUrl, generateFilename, sleep } from '../lib/utils.js';
import { getSettings }         from '../lib/settings.js';
import { addHistoryEntry }     from '../lib/history.js';

// ── Message handler ───────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { action } = message;
  if (action === 'captureFullPage') {
    captureFullPage({ format: message.format })
      .then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (action === 'captureVisible') {
    captureVisible({ format: message.format })
      .then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (action === 'captureArea') {
    captureArea({ format: message.format })
      .then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (action === 'captureForClipboard') {
    captureForClipboard()
      .then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
});

// ── Keyboard shortcut ─────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener(cmd => {
  if (cmd === 'capture-fullpage') {
    captureFullPage({}).catch(e => console.error('[fullpage-capture]', e));
  }
});

// ── Full-page capture ─────────────────────────────────────────────────────────
async function captureFullPage(opts = {}) {
  const settings = await getSettings();
  const format   = opts.format ?? settings.format;
  const [tab]    = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || isRestricted(tab.url)) {
    broadcast('error', 'Cannot capture this page (restricted URL)');
    return { success: false, error: 'Restricted page' };
  }

  try {
    if (settings.captureDelay > 0) {
      broadcast('capturing', `Waiting ${settings.captureDelay}s…`);
      await sleep(settings.captureDelay * 1000);
    }

    // Lazy-load pre-scroll
    if (settings.lazyLoadEnabled) {
      broadcast('capturing', 'Triggering lazy images…');
      await injectAndRun(tab.id, 'waitForLazyLoad', { timeout: settings.lazyLoadTimeout });
    }

    // Infinite scroll guard
    if (settings.infiniteScrollLimit > 0) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] });
      const info = await sendTabMsg(tab.id, {
        action: 'detectInfiniteScroll', maxHeight: settings.infiniteScrollLimit,
      });
      if (info.detected && info.exceedsLimit) {
        broadcast('error',
          `Infinite scroll detected — page exceeds ${settings.infiniteScrollLimit}px limit. ` +
          'Increase the limit in Settings or switch to Visible Only capture.');
        return { success: false, error: 'Infinite scroll limit exceeded' };
      }
    }

    broadcast('capturing', 'Capturing…');

    let result; // { chunked, blob } or { chunked, blobs }

    if (settings.captureMethod === 'scroll') {
      result = await doScrollStitch(tab, settings);
    } else {
      try {
        const base64 = await cdpCapture(tab);
        broadcast('processing', 'Processing…');
        result = { chunked: false, blob: await (await fetch(`data:image/png;base64,${base64}`)).blob() };
        // Reconstruct dataUrl from base64 directly
        result = { chunked: false, dataUrl: `data:image/png;base64,${base64}` };
      } catch (cdpErr) {
        if (settings.captureMethod === 'cdp') throw cdpErr;
        console.warn('[fullpage-capture] CDP failed, falling back:', cdpErr.message);
        broadcast('capturing', 'Capturing (scroll mode)…');
        result = await doScrollStitch(tab, settings);
      }
    }

    return await routeOutput(result, tab, format, settings);
  } catch (err) {
    broadcast('error', err.message);
    return { success: false, error: err.message };
  }
}

// ── Visible-only capture ──────────────────────────────────────────────────────
async function captureVisible(opts = {}) {
  const settings = await getSettings();
  const format   = opts.format ?? settings.format;
  const [tab]    = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || isRestricted(tab.url)) {
    broadcast('error', 'Cannot capture this page (restricted URL)');
    return { success: false, error: 'Restricted page' };
  }

  try {
    broadcast('capturing', 'Capturing…');
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    return await routeOutput({ chunked: false, dataUrl }, tab, format, settings);
  } catch (err) {
    broadcast('error', err.message);
    return { success: false, error: err.message };
  }
}

// ── Area selection capture ────────────────────────────────────────────────────
async function captureArea(opts = {}) {
  const settings = await getSettings();
  const format   = opts.format ?? settings.format;
  const [tab]    = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || isRestricted(tab.url)) {
    broadcast('error', 'Cannot capture this page (restricted URL)');
    return { success: false, error: 'Restricted page' };
  }

  try {
    // Inject content script then show overlay
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] });
    broadcast('capturing', 'Draw selection on the page…');

    const rect = await sendTabMsg(tab.id, { action: 'startAreaSelect' });
    if (!rect) return { success: false, error: 'Selection cancelled' };

    // Capture visible tab then crop
    const raw  = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const blob = await cropDataUrl(raw, rect);
    const dataUrl = await blobToDataUrl(blob);
    broadcast('processing', 'Processing…');

    return await routeOutput({ chunked: false, dataUrl }, tab, format, settings);
  } catch (err) {
    broadcast('error', err.message);
    return { success: false, error: err.message };
  }
}

// ── Clipboard capture (returns dataUrl to popup for writing) ──────────────────
async function captureForClipboard() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || isRestricted(tab.url)) {
    return { success: false, error: 'Restricted page' };
  }

  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    return { success: true, dataUrl };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function doScrollStitch(tab, settings) {
  const { frames, dimensions } = await scrollStitchCapture(tab, p => {
    broadcast('capturing', `Frame ${p.current} / ${p.total}…`);
  });
  broadcast('processing', 'Stitching image…');
  const result = await stitchFrames(frames, dimensions);

  if (!result.chunked) {
    result.dataUrl = await blobToDataUrl(result.blob);
  } else {
    result.dataUrls = await Promise.all(result.blobs.map(b => blobToDataUrl(b)));
  }
  return result;
}

async function routeOutput(result, tab, format, settings) {
  const hostname = new URL(tab.url).hostname;
  const url      = tab.url;
  const ts       = new Date().toISOString();

  if (result.chunked) {
    // Oversized page — must go through preview tab
    const chunkCount = result.dataUrls.length;
    broadcast('processing', `Page chunked into ${chunkCount} parts…`);

    await chrome.storage.local.set({
      previewData: {
        chunks: result.dataUrls,
        hostname, format,
        pdfPageSize: settings.pdfPageSize,
        autoSave: !settings.showPreview,
      },
    });
    await chrome.tabs.create({ url: chrome.runtime.getURL('preview/preview.html') });
    broadcast('done', `Chunked page → ${format === 'pdf' ? 'PDF' : 'Preview'} ready`);

    if (settings.saveHistory) {
      await addHistoryEntry({
        hostname, url, timestamp: ts,
        dims: { width: '?', height: `${chunkCount} chunks` },
        dataUrl: result.dataUrls[0],
        filename: generateFilename(hostname, format === 'pdf' ? 'pdf' : 'png'),
      });
    }
    return { success: true };
  }

  const dataUrl = result.dataUrl;

  // Infer dims from dataUrl (we don't have dims here; history uses 0,0 as placeholder)
  if (settings.saveHistory) {
    addHistoryEntry({
      hostname, url, timestamp: ts,
      dims: { width: 0, height: 0 },
      dataUrl,
      filename: generateFilename(hostname, format === 'pdf' ? 'pdf' : 'png'),
    }).catch(() => {});
  }

  if (settings.showPreview || format === 'pdf') {
    await chrome.storage.local.set({
      previewData: {
        dataUrl, hostname, format,
        pdfPageSize: settings.pdfPageSize,
        autoSave: !settings.showPreview,
      },
    });
    await chrome.tabs.create({ url: chrome.runtime.getURL('preview/preview.html') });
    broadcast('done', format === 'pdf' && !settings.showPreview ? 'Generating PDF…' : 'Preview ready!');
    return { success: true };
  }

  const filename = generateFilename(hostname, 'png');
  await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
  broadcast('done', 'Saved!');
  return { success: true };
}

// Crop a full-viewport dataUrl to the selection rect using OffscreenCanvas
async function cropDataUrl(dataUrl, rect) {
  const { x, y, w, h, dpr } = rect;
  const blob   = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);
  const sx = Math.round(x * dpr), sy = Math.round(y * dpr);
  const sw = Math.round(w * dpr), sh = Math.round(h * dpr);
  const canvas = new OffscreenCanvas(sw, sh);
  canvas.getContext('2d').drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/png' });
}

async function injectAndRun(tabId, action, params) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content/content.js'] });
  return sendTabMsg(tabId, { action, ...params });
}

function sendTabMsg(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, r => {
      chrome.runtime.lastError
        ? reject(new Error(chrome.runtime.lastError.message))
        : resolve(r);
    });
  });
}

function isRestricted(url) {
  return (
    url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
    url.startsWith('edge://')   || url.startsWith('about:') || url.startsWith('data:')
  );
}

function broadcast(type, text) {
  chrome.runtime.sendMessage({ action: 'progress', type, text }).catch(() => {});
}
