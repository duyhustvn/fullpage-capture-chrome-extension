# Phase 2 — PDF Export + Settings

## Goal
Thêm PDF export, preview trước khi save, và settings cơ bản.

## Tasks

### 2.1 PDF Export (`lib/pdf-export.js`)
- Integrate jsPDF (vendored UMD build)
- Image → PDF conversion
- Page size options: A4 (portrait/landscape), Letter, Fit-to-image
- Fit-to-image: 1 page PDF, kích thước = kích thước ảnh
- A4/Letter: split ảnh thành nhiều pages nếu cần, tự tính pagination

### 2.2 Preview Tab
- Mở new tab với captured image trước khi save
- Buttons: "Save PNG", "Save PDF", "Copy to Clipboard", "Discard"
- Zoom in/out trên preview
- Show image dimensions & file size estimate

### 2.3 Settings Page
- `chrome.storage.sync` cho persistent settings
- Options:
  - Default format: PNG / PDF
  - PNG quality (lossless hoặc compressed via canvas quality param)
  - PDF page size default
  - Capture delay (0-5s, cho trang cần thời gian render)
  - Auto-download vs show preview
  - Preferred method: CDP-first / Scroll-only / Auto

### 2.4 Keyboard Shortcut
- `chrome.commands` API
- Default: `Ctrl+Shift+S` (configurable trong `chrome://extensions/shortcuts`)
- Trigger full-page capture với default settings

### 2.5 Popup UI Enhancements
- Format selector (PNG/PDF) trong popup
- Quick settings access
- Last capture thumbnail

## Acceptance Criteria
- [ ] PDF export hoạt động với cả 3 page size options
- [ ] Preview tab hiển thị đúng captured image
- [ ] Settings persist qua browser restart
- [ ] Keyboard shortcut trigger capture thành công
- [ ] Long page → A4 PDF tự chia thành nhiều pages hợp lý
