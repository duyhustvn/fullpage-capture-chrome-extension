import { cdpCapture } from '../lib/cdp-capture.js';
import { scrollStitchCapture } from '../lib/scroll-stitch.js';
import { stitchFrames } from '../lib/stitcher.js';
import { blobToDataUrl, generateFilename } from '../lib/utils.js';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'captureFullPage') {
    captureFullPage()
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (message.action === 'captureVisible') {
    captureVisible()
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function captureFullPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || isRestricted(tab.url)) {
    broadcast('error', 'Cannot capture this page (restricted URL)');
    return { success: false, error: 'Restricted page' };
  }

  try {
    broadcast('capturing', 'Capturing...');

    let dataUrl;
    try {
      const base64 = await cdpCapture(tab);
      dataUrl = `data:image/png;base64,${base64}`;
      broadcast('processing', 'Processing...');
    } catch (cdpErr) {
      console.warn('[fullpage-capture] CDP failed, falling back to scroll-stitch:', cdpErr.message);
      broadcast('capturing', 'Capturing (scroll mode)...');

      const { frames, dimensions } = await scrollStitchCapture(tab, p => {
        broadcast('capturing', `Capturing frame ${p.current} / ${p.total}...`);
      });

      broadcast('processing', 'Stitching image...');
      const blob = await stitchFrames(frames, dimensions);
      dataUrl = await blobToDataUrl(blob);
    }

    const filename = generateFilename(new URL(tab.url).hostname, 'png');
    await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });

    broadcast('done', 'Saved!');
    return { success: true };
  } catch (err) {
    broadcast('error', err.message);
    return { success: false, error: err.message };
  }
}

async function captureVisible() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url || isRestricted(tab.url)) {
    broadcast('error', 'Cannot capture this page (restricted URL)');
    return { success: false, error: 'Restricted page' };
  }

  try {
    broadcast('capturing', 'Capturing...');
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    const filename = generateFilename(new URL(tab.url).hostname, 'png');
    await chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
    broadcast('done', 'Saved!');
    return { success: true };
  } catch (err) {
    broadcast('error', err.message);
    return { success: false, error: err.message };
  }
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
