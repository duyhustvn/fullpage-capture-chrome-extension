export const DEFAULTS = {
  format: 'png',              // 'png' | 'pdf'
  pdfPageSize: 'fit',         // 'fit' | 'a4' | 'letter'
  captureDelay: 0,            // seconds (0-5)
  showPreview: false,         // open preview tab before saving
  captureMethod: 'auto',      // 'auto' | 'cdp' | 'scroll'
  // Phase 3
  lazyLoadEnabled: false,     // pre-scroll to trigger lazy images
  lazyLoadTimeout: 5,         // seconds to wait for images after scroll
  infiniteScrollLimit: 30000, // max capture height in px (0 = no limit)
  saveHistory: true,          // save captures to history
};

export function getSettings() {
  return new Promise(resolve => chrome.storage.sync.get(DEFAULTS, resolve));
}

export function saveSettings(patch) {
  return new Promise(resolve => chrome.storage.sync.set(patch, resolve));
}
