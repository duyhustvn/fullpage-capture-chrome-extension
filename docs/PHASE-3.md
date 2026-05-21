# Phase 3 — Advanced Features

## Goal
Polish UX, handle edge cases, thêm power-user features.

## Tasks

### 3.1 Area Selection Capture
- Click "Select Area" → overlay trên trang
- User kéo chọn vùng cần capture
- Crop chỉ vùng đã chọn → export

### 3.2 Lazy-Load Awareness
- Trước khi capture, scroll toàn bộ trang 1 lần để trigger lazy load
- Chờ tất cả images loaded (`img.complete` hoặc `load` event)
- Network idle detection: chờ không còn pending requests
- Configurable timeout

### 3.3 Infinite Scroll Guard
- Detect infinite scroll patterns (scroll height tăng liên tục)
- Đặt max capture height limit (configurable, default 30000px)
- Warning prompt khi phát hiện infinite scroll

### 3.4 Annotation Tools (Preview Tab)
- Canvas-based annotation overlay
- Tools: text box, arrow, rectangle, freehand draw, highlight (semi-transparent)
- Color picker
- Undo/redo
- Export annotated image

### 3.5 Copy to Clipboard
- `navigator.clipboard.write()` với ClipboardItem PNG blob
- Fallback: tạo temporary img element + execCommand('copy')

### 3.6 Capture History
- `chrome.storage.local` lưu recent captures
- Thumbnail (resized), URL, timestamp, dimensions
- Max 50 entries, auto-cleanup cũ nhất
- History panel trong popup

### 3.7 Multi-Canvas Chunking
- Khi page height > canvas limit (~32767px)
- Chia thành multiple canvas chunks
- Ghép thành multi-page PDF tự động
- PNG: option xuất multiple files hoặc show warning

### 3.8 Tab-specific Tweaks
- Detect và handle iframe-heavy pages
- Handle pages với `overflow: hidden` trên body
- Shadow DOM element detection cho fixed/sticky

## Acceptance Criteria
- [ ] Area selection capture hoạt động chính xác
- [ ] Lazy-loaded images xuất hiện trong screenshot
- [ ] Infinite scroll pages không crash extension
- [ ] Annotation tools cơ bản hoạt động
- [ ] Copy to clipboard thành công
- [ ] History hiển thị recent captures
- [ ] Trang > 32767px height xuất PDF thành công
