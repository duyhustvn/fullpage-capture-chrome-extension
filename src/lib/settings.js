export const DEFAULTS = {
  format: 'png',          // 'png' | 'pdf'
  pdfPageSize: 'fit',     // 'fit' | 'a4' | 'letter'
  captureDelay: 0,        // seconds (0-5)
  showPreview: false,     // open preview tab before saving
  captureMethod: 'auto',  // 'auto' | 'cdp' | 'scroll'
};

export function getSettings() {
  return new Promise(resolve => chrome.storage.sync.get(DEFAULTS, resolve));
}

export function saveSettings(patch) {
  return new Promise(resolve => chrome.storage.sync.set(patch, resolve));
}
