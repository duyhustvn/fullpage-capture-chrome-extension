import { cdpCapture } from '../lib/cdp-capture.js';
import { scrollStitchCapture } from '../lib/scroll-stitch.js';
import { stitchFrames } from '../lib/stitcher.js';
import { blobToDataUrl, generateFilename, sleep } from '../lib/utils.js';
import { getSettings } from '../lib/settings.js';

// ── Message handler (from popup) ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'captureFullPage') {
    captureFullPage({ format: message.format })
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.action === 'captureVisible') {
    captureVisible({ format: message.format })
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// ── Keyboard shortcut ─────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener(cmd => {
  if (cmd === 'capture-fullpage') {
    captureFullPage({}).catch(err => console.error('[fullpage-capture]', err));
  }
});

// ── Full page capture ─────────────────────────────────────────────────────────
async function captureFullPage(opts = {}) {
  const settings = await getSettings();
  const format = opts.format ?? settings.format;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || isRestricted(tab.url)) {
    broadcast('error', 'Cannot capture this page (restricted URL)');
    return { success: false, error: 'Restricted page' };
  }

  try {
    if (settings.captureDelay > 0) {
      broadcast('capturing', `Waiting ${settings.captureDelay}s…`);
      await sleep(settings.captureDelay * 1000);
    }

    broadcast('capturing', 'Capturing…');

    let dataUrl;

    if (settings.captureMethod === 'scroll') {
      dataUrl = await doScrollStitch(tab);
    } else {
      try {
        const base64 = await cdpCapture(tab);
        dataUrl = `data:image/png;base64,${base64}`;
        broadcast('processing', 'Processing…');
      } catch (cdpErr) {
        if (settings.captureMethod === 'cdp') throw cdpErr;
        console.warn('[fullpage-capture] CDP failed, falling back:', cdpErr.message);
        broadcast('capturing', 'Capturing (scroll mode)…');
        dataUrl = await doScrollStitch(tab);
      }
    }

    return await routeOutput(dataUrl, tab, format, settings);
  } catch (err) {
    broadcast('error', err.message);
    return { success: false, error: err.message };
  }
}

// ── Visible-only capture ──────────────────────────────────────────────────────
async function captureVisible(opts = {}) {
  const settings = await getSettings();
  const format = opts.format ?? settings.format;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || isRestricted(tab.url)) {
    broadcast('error', 'Cannot capture this page (restricted URL)');
    return { success: false, error: 'Restricted page' };
  }

  try {
    broadcast('capturing', 'Capturing…');
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    return await routeOutput(dataUrl, tab, format, settings);
  } catch (err) {
    broadcast('error', err.message);
    return { success: false, error: err.message };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function doScrollStitch(tab) {
  const { frames, dimensions } = await scrollStitchCapture(tab, p => {
    broadcast('capturing', `Frame ${p.current} / ${p.total}…`);
  });
  broadcast('processing', 'Stitching image…');
  const blob = await stitchFrames(frames, dimensions);
  return blobToDataUrl(blob);
}

async function routeOutput(dataUrl, tab, format, settings) {
  const hostname = new URL(tab.url).hostname;

  if (settings.showPreview || format === 'pdf') {
    // PDF generation requires DOM (jsPDF) — must happen in the preview tab
    await chrome.storage.local.set({
      previewData: {
        dataUrl,
        hostname,
        format,
        pdfPageSize: settings.pdfPageSize,
        autoSave: !settings.showPreview,  // auto-save when preview is disabled
      },
    });
    await chrome.tabs.create({ url: chrome.runtime.getURL('preview/preview.html') });
    broadcast('done', format === 'pdf' && !settings.showPreview ? 'Generating PDF…' : 'Preview ready!');
    return { success: true };
  }

  // Auto-download PNG
  const filename = generateFilename(hostname, 'png');
  await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
  broadcast('done', 'Saved!');
  return { success: true };
}

function isRestricted(url) {
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('data:')
  );
}

function broadcast(type, text) {
  chrome.runtime.sendMessage({ action: 'progress', type, text }).catch(() => {});
}
