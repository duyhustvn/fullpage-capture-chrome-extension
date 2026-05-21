# CLAUDE.md — Full Page Capture (Chrome Extension)

## Project Overview

Chrome Extension (Manifest V3) để chụp ảnh full-page screenshot và xuất ra PNG/PDF.
Giải quyết vấn đề trang web dài hơn viewport không thể chụp bằng 1 lần.

**Strategy:** CDP-first (Chrome DevTools Protocol) với fallback Scroll & Stitch.

## Architecture

```
fullpage-capture/
├── CLAUDE.md                    # File này
├── docs/
│   ├── ARCHITECTURE.md          # Kiến trúc chi tiết, data flow
│   ├── PHASE-1.md               # MVP: capture + PNG export
│   ├── PHASE-2.md               # PDF export + settings
│   └── PHASE-3.md               # Advanced features
├── src/
│   ├── manifest.json            # Manifest V3
│   ├── popup/
│   │   ├── popup.html           # UI chính
│   │   ├── popup.css            # Styling
│   │   └── popup.js             # Popup logic, gửi message tới background
│   ├── background/
│   │   └── service-worker.js    # Điều phối capture, CDP, download
│   ├── content/
│   │   └── content.js           # Inject vào tab: scroll, ẩn fixed elements
│   ├── lib/
│   │   ├── cdp-capture.js       # CDP approach: chrome.debugger API
│   │   ├── scroll-stitch.js     # Fallback: scroll + captureVisibleTab + stitch
│   │   ├── stitcher.js          # Ghép ảnh bằng OffscreenCanvas
│   │   ├── pdf-export.js        # Canvas → PDF (jsPDF)
│   │   └── utils.js             # Shared utilities
│   └── assets/
│       └── icons/               # Extension icons 16/32/48/128
├── lib/
│   └── jspdf.umd.min.js        # jsPDF vendored (no build step)
└── README.md
```

## Tech Stack

- **Platform:** Chrome Extension, Manifest V3
- **APIs:** `chrome.debugger` (CDP), `chrome.tabs.captureVisibleTab`, `chrome.scripting`, `chrome.downloads`
- **PDF:** jsPDF (vendored, không cần bundler)
- **Canvas:** OffscreenCanvas cho ghép ảnh trong service worker
- **No build step:** Vanilla JS, không cần webpack/vite — load trực tiếp

## Phased Development

### Phase 1 — MVP: Full Page Capture + PNG Export ✅
- [x] Project scaffold: manifest.json, popup, background, content script
- [x] CDP capture: `chrome.debugger` → `Emulation.setDeviceMetricsOverride` + `Page.captureScreenshot` với `captureBeyondViewport: true`
- [x] Scroll & Stitch fallback khi CDP fail
- [x] Content script: phát hiện & ẩn `position: fixed/sticky` elements trước khi capture
- [x] Ghép ảnh bằng OffscreenCanvas, crop frame cuối chính xác
- [x] Xuất PNG + auto download
- [x] Visible-only capture (quick screenshot)
- [x] Basic popup UI với 2 button: "Full Page" và "Visible Only"
- [x] Progress indicator trong popup

### Phase 2 — PDF Export + Settings ✅
- [x] PDF export từ captured image (jsPDF)
- [x] Page size options: A4, Letter, Fit-to-image
- [x] Settings page: default format (PNG/PDF), quality, delay before capture
- [x] Preview trong new tab trước khi save
- [x] Keyboard shortcut (Ctrl+Shift+S hoặc configurable)

### Phase 3 — Advanced Features
- [ ] Capture selection (chọn vùng trên trang)
- [ ] Auto-detect và chờ lazy-loaded images
- [ ] Infinite scroll detection + giới hạn capture
- [ ] Annotation tools trên preview (text, arrow, highlight)
- [ ] Copy to clipboard thay vì download
- [ ] History: lưu recent captures (thumbnail + metadata)

## Capture Flow

### CDP Approach (Primary)
```
popup → message → service-worker
  → chrome.debugger.attach(tabId)
  → CDP: Page.getLayoutMetrics → lấy full contentSize
  → CDP: Emulation.setDeviceMetricsOverride(fullWidth, fullHeight)
  → CDP: Page.captureScreenshot(format: png, captureBeyondViewport: true)
  → chrome.debugger.detach(tabId)
  → base64 → blob → chrome.downloads.download()
```

### Scroll & Stitch Approach (Fallback)
```
popup → message → service-worker
  → chrome.scripting.executeScript(content.js)
  → content.js: ẩn fixed/sticky elements
  → content.js: tính scrollHeight, viewportHeight, totalFrames
  → loop i = 0..totalFrames:
      content.js: window.scrollTo(0, i * viewportHeight)
      wait 150ms (render settle)
      service-worker: chrome.tabs.captureVisibleTab() → dataUrl
      store frame[i]
  → content.js: restore fixed/sticky elements
  → service-worker: OffscreenCanvas ghép frames
  → crop frame cuối (scrollHeight % viewportHeight)
  → blob → download
```

## Key Technical Decisions

| Decision | Choice | Lý do |
|----------|--------|-------|
| CDP vs Scroll-only | CDP-first + fallback | CDP chất lượng tốt hơn, 1 shot, không lỗi fixed elements |
| Build tool | Không dùng | Extension nhỏ, vanilla JS đủ, giảm complexity |
| PDF library | jsPDF vendored | Nhẹ, không cần npm, load trực tiếp từ extension |
| Image stitching | OffscreenCanvas | Chạy trong service worker, không block UI |
| Fixed element handling | Inject CSS override | `position: fixed → absolute` trước capture, restore sau |

## Permissions (manifest.json)

```json
{
  "permissions": ["activeTab", "scripting", "downloads", "debugger"],
  "host_permissions": ["<all_urls>"]
}
```

- `activeTab`: capture tab hiện tại
- `scripting`: inject content script
- `downloads`: auto-save file
- `debugger`: CDP access (hiện warning bar, nhưng chất lượng tốt hơn)

## Edge Cases & Gotchas

1. **Fixed/Sticky elements lặp lại:** Content script phải ẩn TRƯỚC khi bắt đầu capture, restore SAU khi xong
2. **Frame cuối không đầy viewport:** Crop chính xác = `scrollHeight % viewportHeight` pixels từ dưới lên
3. **Lazy-loaded images:** Scroll chậm + chờ image load (Phase 3), Phase 1 chấp nhận blank
4. **`about:`, `chrome://` pages:** Không thể inject/capture — show error message
5. **Cross-origin iframes:** Không capture được nội dung iframe khác origin
6. **Retina/HiDPI:** `devicePixelRatio` ảnh hưởng kích thước ảnh, cần handle scale
7. **CDP warning bar:** `chrome.debugger.attach` hiện thanh vàng — tự mất khi detach
8. **Service worker idle timeout:** MV3 service worker bị kill sau 30s idle — capture phải nhanh hoặc dùng keepalive
9. **Memory với trang rất dài:** Canvas có size limit (~16384px hoặc ~32767px tuỳ browser) — cần chunk nếu vượt

## Code Patterns

### Message passing
```javascript
// popup → service-worker
chrome.runtime.sendMessage({ action: 'captureFullPage', format: 'png' });

// service-worker → content script
chrome.tabs.sendMessage(tabId, { action: 'prepareCapture' });

// Response pattern: dùng Promise wrapper
function sendMessage(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, resolve);
  });
}
```

### Error handling pattern
```javascript
async function captureFullPage(tab) {
  try {
    return await cdpCapture(tab);
  } catch (cdpError) {
    console.warn('CDP failed, falling back to scroll-stitch:', cdpError);
    return await scrollStitchCapture(tab);
  }
}
```

## Claude Code Session Prompt Template

Khi bắt đầu session mới trong Claude Code, luôn include:

```
Read these files trước khi làm bất kỳ thay đổi nào:
- CLAUDE.md
- docs/ARCHITECTURE.md
- docs/PHASE-{current}.md
- src/manifest.json

Đang làm Phase {X}. Task: {mô tả task cụ thể}.
```

## Development & Testing

- Load extension: `chrome://extensions` → Developer mode → Load unpacked → chọn `src/`
- Test pages: trang dài (Wikipedia article), trang có fixed header (GitHub), trang lazy-load (Medium)
- Debug service worker: `chrome://extensions` → click "service worker" link
- Debug content script: DevTools của tab → Console (chọn context content script)
