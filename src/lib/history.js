import { blobToDataUrl } from './utils.js';

const HISTORY_KEY = 'captureHistory';
const MAX_ENTRIES = 50;
const THUMB_WIDTH  = 200;

export async function addHistoryEntry({ hostname, url, timestamp, dims, dataUrl, filename }) {
  const thumbnail = await makeThumbnail(dataUrl);
  const entry = { id: Date.now(), hostname, url, timestamp, dims, thumbnail, filename };

  const list = await getHistory();
  list.unshift(entry);
  if (list.length > MAX_ENTRIES) list.splice(MAX_ENTRIES);
  await chrome.storage.local.set({ [HISTORY_KEY]: list });
  return entry;
}

export async function getHistory() {
  const { captureHistory = [] } = await chrome.storage.local.get(HISTORY_KEY);
  return captureHistory;
}

export async function clearHistory() {
  await chrome.storage.local.remove(HISTORY_KEY);
}

async function makeThumbnail(dataUrl) {
  try {
    const blob  = await (await fetch(dataUrl)).blob();
    const bmp   = await createImageBitmap(blob);
    const scale = Math.min(1, THUMB_WIDTH / bmp.width);
    const w = Math.round(bmp.width  * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
    bmp.close();
    const thumbBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
    return blobToDataUrl(thumbBlob);
  } catch {
    return null;
  }
}
