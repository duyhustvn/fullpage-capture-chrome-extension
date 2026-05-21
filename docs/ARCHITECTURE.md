# Architecture — Full Page Capture

## System Overview

```
┌─────────────────────────────────────────────────────┐
│                    Chrome Browser                     │
│                                                       │
│  ┌──────────┐    message     ┌───────────────────┐   │
│  │  Popup   │ ─────────────→ │  Service Worker   │   │
│  │  (UI)    │ ←───────────── │  (Background)     │   │
│  └──────────┘    response    │                   │   │
│                              │  ┌──────────────┐ │   │
│                              │  │ CDP Capture  │ │   │
│                              │  │ (primary)    │ │   │
│                              │  └──────┬───────┘ │   │
│                              │         │ fail?   │   │
│                              │  ┌──────▼───────┐ │   │
│  ┌──────────┐    message     │  │ Scroll+Stitch│ │   │
│  │ Content  │ ←───────────── │  │ (fallback)   │ │   │
│  │ Script   │ ─────────────→ │  └──────────────┘ │   │
│  │ (in tab) │   scroll data  │                   │   │
│  └──────────┘                │  ┌──────────────┐ │   │
│                              │  │ Stitcher     │ │   │
│                              │  │ (Canvas)     │ │   │
│                              │  └──────┬───────┘ │   │
│                              │  ┌──────▼───────┐ │   │
│                              │  │ PDF Export   │ │   │
│                              │  │ (jsPDF)      │ │   │
│                              │  └──────┬───────┘ │   │
│                              └─────────┼─────────┘   │
│                                        ▼             │
│                              chrome.downloads API    │
└─────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Popup (`popup/`)
- Hiển thị UI: buttons, progress, status
- Gửi capture request tới service worker
- Nhận progress updates via `chrome.runtime.onMessage`
- Không chứa business logic

### Service Worker (`background/service-worker.js`)
- Điều phối toàn bộ capture flow
- Quản lý CDP connection (`chrome.debugger`)
- Gọi `chrome.tabs.captureVisibleTab()` cho scroll-stitch
- Ghép ảnh (OffscreenCanvas)
- Trigger download

### Content Script (`content/content.js`)
- Inject vào active tab khi cần
- Phát hiện & ẩn fixed/sticky elements
- Scroll trang theo lệnh từ service worker
- Tính toán page dimensions (`scrollHeight`, `clientHeight`, `scrollWidth`)
- Restore trạng thái trang sau capture

### Lib modules (`lib/`)
- `cdp-capture.js`: Wrap chrome.debugger API, CDP commands
- `scroll-stitch.js`: Orchestrate scroll loop + capture
- `stitcher.js`: OffscreenCanvas image composition
- `pdf-export.js`: Image → PDF conversion
- `utils.js`: Base64 helpers, dimension calculations

## Data Flow: CDP Capture

```
1. popup.js:  sendMessage({ action: 'captureFullPage', format: 'png' })
2. service-worker.js:  receives message
3. cdp-capture.js:
   a. chrome.debugger.attach({ tabId }, '1.3')
   b. sendCommand('Page.getLayoutMetrics')
      → { contentSize: { width, height } }
   c. sendCommand('Emulation.setDeviceMetricsOverride', {
        width: contentSize.width,
        height: contentSize.height,
        deviceScaleFactor: 1,
        mobile: false
      })
   d. sendCommand('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: true
      })
      → { data: base64EncodedPNG }
   e. sendCommand('Emulation.clearDeviceMetricsOverride')
   f. chrome.debugger.detach({ tabId })
4. service-worker.js:  base64 → blob → download or convert to PDF
```

## Data Flow: Scroll & Stitch Capture

```
1. service-worker → inject content.js
2. content.js:
   a. Scan DOM: querySelectorAll('*'), filter getComputedStyle position=fixed|sticky
   b. Store original styles, set display:none hoặc position:absolute
   c. Return { scrollHeight, clientHeight, scrollWidth, clientWidth }
3. service-worker:
   a. totalFrames = Math.ceil(scrollHeight / clientHeight)
   b. for i in 0..totalFrames-1:
      - sendMessage to content.js: scrollTo(0, i * clientHeight)
      - wait 150ms
      - captureVisibleTab({ format: 'png' }) → dataUrl
      - frames.push(dataUrl)
4. content.js: restore original styles
5. stitcher.js:
   a. Create OffscreenCanvas(scrollWidth, scrollHeight)
   b. For each frame, drawImage at (0, i * clientHeight)
   c. Last frame: chỉ draw phần = scrollHeight - (totalFrames-1) * clientHeight
   d. canvas.convertToBlob({ type: 'image/png' })
6. Download hoặc convert PDF
```

## Canvas Size Limits

Chrome giới hạn canvas dimension (~32767px per side, ~268 megapixels total).
Với trang rất dài vượt limit:
- Phase 1: Show error "Page too long"
- Phase 3: Chunk thành nhiều canvas, xuất multi-page PDF

## Fixed/Sticky Element Detection

```javascript
// Strategy: scan tất cả elements, check computed style
function getFixedElements() {
  const all = document.querySelectorAll('*');
  const fixed = [];
  for (const el of all) {
    const style = getComputedStyle(el);
    if (style.position === 'fixed' || style.position === 'sticky') {
      fixed.push({
        element: el,
        originalPosition: style.position,
        originalDisplay: el.style.display
      });
    }
  }
  return fixed;
}
```

## Error Handling Strategy

| Error | Handling |
|-------|----------|
| CDP attach failed (permission) | Fallback to scroll-stitch |
| CDP capture failed | Fallback to scroll-stitch |
| `chrome://` or `about:` page | Show user-friendly error |
| Canvas size exceeded | Show error (Phase 1), multi-page (Phase 3) |
| Service worker timeout | Use `chrome.runtime.getContexts` keepalive |
| Content script injection failed | Show error for restricted pages |

## Security & Permissions Model

- `activeTab`: chỉ capture tab user đang xem, khi user click extension
- `debugger`: hiện warning bar, auto-detach khi xong
- Không lưu data lên server, mọi thứ local
- Không request `<all_urls>` cho content script — dùng `chrome.scripting.executeScript` on-demand
