# Phase 1 — MVP: Full Page Capture + PNG Export

## Goal
Extension hoạt động end-to-end: click button → chụp full page → download PNG.

## Tasks

### 1.1 Project Scaffold
- `manifest.json` (Manifest V3) với permissions: `activeTab`, `scripting`, `downloads`, `debugger`
- Popup HTML/CSS/JS cơ bản
- Service worker skeleton
- Extension icons (placeholder)

### 1.2 CDP Capture (`lib/cdp-capture.js`)
- `chrome.debugger.attach` / `detach` wrapper với error handling
- `Page.getLayoutMetrics` → lấy full page dimensions
- `Emulation.setDeviceMetricsOverride` → resize viewport to full page
- `Page.captureScreenshot` → base64 PNG
- `Emulation.clearDeviceMetricsOverride` → restore
- Timeout protection: auto-detach sau 30s

### 1.3 Content Script (`content/content.js`)
- `getPageDimensions()`: return `{ scrollHeight, clientHeight, scrollWidth, clientWidth, devicePixelRatio }`
- `hideFixedElements()`: scan & ẩn position fixed/sticky, return restore function
- `restoreFixedElements()`: khôi phục original styles
- `scrollToPosition(y)`: scroll và wait settle

### 1.4 Scroll & Stitch Fallback (`lib/scroll-stitch.js`)
- Orchestrate: inject content script → hide fixed → scroll loop → capture frames → restore
- Mỗi frame: scroll → wait 150ms → `captureVisibleTab`
- Handle frame cuối: tính chính xác pixels cần crop

### 1.5 Image Stitcher (`lib/stitcher.js`)
- Dùng OffscreenCanvas trong service worker
- Load tất cả frame images
- Draw theo đúng offset, crop frame cuối
- Export PNG blob

### 1.6 Download
- `chrome.downloads.download({ url: blobUrl, filename, saveAs: true })`
- Filename format: `fullpage-{hostname}-{timestamp}.png`

### 1.7 Popup UI
- 2 buttons: "📸 Full Page" và "📷 Visible Only"
- Progress bar / spinner khi đang capture
- Status text: "Capturing...", "Processing...", "Done!"
- Error display

### 1.8 Visible-Only Capture
- Đơn giản: `captureVisibleTab()` → download
- Không cần CDP hay scroll

## Acceptance Criteria
- [ ] Click "Full Page" → download PNG đầy đủ nội dung trang
- [ ] CDP capture hoạt động trên trang bình thường (Wikipedia, docs)
- [ ] Fallback scroll-stitch khi CDP fail (test bằng cách block debugger permission)
- [ ] Fixed header/navbar không bị lặp lại trong ảnh
- [ ] Visible-only capture hoạt động
- [ ] Error message cho restricted pages (`chrome://`, `about:`)
- [ ] Progress indicator hiển thị trong lúc capture

## Test Pages
| Page | Test aspect |
|------|-------------|
| Long Wikipedia article | Basic full page, text-heavy |
| GitHub repo page | Fixed header, lazy images |
| MDN docs | Sticky sidebar + header |
| News article (VnExpress) | Ads, fixed elements, dynamic content |
| Simple static HTML | Baseline sanity check |
