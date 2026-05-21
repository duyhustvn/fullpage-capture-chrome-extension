# Full Page Capture — Chrome Extension

Chụp ảnh toàn trang web (full-page screenshot) và xuất ra PNG hoặc PDF, ngay trong Chrome — không cần cài phần mềm, không cần tài khoản.

---

## Tính năng

### Chụp ảnh
| Tính năng | Mô tả |
|-----------|-------|
| **Full Page** | Chụp toàn bộ trang dù dài hơn viewport |
| **Visible Only** | Chụp đúng vùng nhìn thấy hiện tại |
| **Select Area** | Kéo chọn vùng tuỳ ý trên trang |
| **Copy to Clipboard** | Chụp và copy thẳng vào clipboard (dán vào Figma, Slack…) |

### Xuất file
| Tính năng | Mô tả |
|-----------|-------|
| **Xuất PNG** | Ảnh chất lượng cao, nền trong suốt giữ nguyên |
| **Xuất PDF** | Hỗ trợ A4 / Letter / Fit-to-image (single page) |
| **Preview tab** | Xem trước trong tab mới trước khi lưu |
| **Auto-download** | Tải xuống ngay, đặt tên theo hostname + timestamp |

### Annotation (chú thích trên ảnh)
| Công cụ | Mô tả |
|---------|-------|
| Freehand | Vẽ tự do |
| Arrow | Mũi tên |
| Rectangle | Hình chữ nhật |
| Highlight | Highlight màu vàng |
| Text | Thêm chữ |
| Undo / Redo | 30 bước lịch sử |
| Clear | Xoá toàn bộ annotation |
| Tải xuống | Merge annotation vào ảnh trước khi export |

### Chất lượng & hiệu năng
| Tính năng | Mô tả |
|-----------|-------|
| **CDP capture** | Dùng Chrome DevTools Protocol — 1 shot, không bị fixed header lặp |
| **Scroll & Stitch fallback** | Tự động chuyển sang nếu CDP thất bại |
| **Lazy-load awareness** | Pre-scroll trang để trigger ảnh lazy-load trước khi chụp |
| **Infinite scroll guard** | Giới hạn chiều cao trang để tránh loop vô tận |
| **Chunked stitching** | Xử lý trang > 32 767 px (giới hạn canvas) bằng cách ghép từng chunk 30 000 px |
| **Multi-page PDF** | Trang rất dài tự động chia thành nhiều trang PDF |

### Lịch sử & cài đặt
| Tính năng | Mô tả |
|-----------|-------|
| **Capture history** | Lưu 50 lần chụp gần nhất (thumbnail + hostname + thời gian) |
| **Settings page** | Cấu hình định dạng mặc định, delay, phương thức chụp, lazy-load… |
| **Keyboard shortcut** | `Ctrl+Shift+S` (Mac: `⌘+Shift+S`) để chụp full page ngay lập tức |

---

## Cài đặt (Load Unpacked)

> Yêu cầu: **Google Chrome** (hoặc Chromium-based browser như Edge, Brave).

### Bước 1 — Mở trang Extensions

Gõ vào thanh địa chỉ:
```
chrome://extensions
```

### Bước 2 — Bật Developer Mode

Bật công tắc **Developer mode** ở góc trên bên phải.

### Bước 3 — Load Unpacked

1. Nhấn nút **Load unpacked**
2. Chọn thư mục **`src/`** bên trong repo này (ví dụ: `~/Projects/fullpage-capture/src`)
3. Nhấn **Select Folder**

Extension sẽ xuất hiện trong danh sách với tên **Full Page Capture**.

### Bước 4 — Ghim extension (tuỳ chọn)

Nhấn icon puzzle 🧩 trên thanh toolbar → ghim **Full Page Capture** để truy cập nhanh.

---

## Cách dùng

1. Mở trang web bất kỳ bạn muốn chụp.
2. Nhấn icon extension trên toolbar.
3. Chọn format **PNG** hoặc **PDF**.
4. Nhấn một trong các nút:
   - **Full Page** — chụp toàn trang
   - **Visible Only** — chụp vùng hiện tại
   - **Select Area** — kéo chọn vùng
   - **Copy** — copy vào clipboard
5. Nếu bật **Show preview tab**, ảnh mở ra trong tab mới để xem, chú thích, rồi mới tải xuống.

### Keyboard shortcut

| Shortcut | Hành động |
|----------|-----------|
| `Ctrl+Shift+S` | Chụp full page (dùng cài đặt mặc định) |

---

## Cấu trúc thư mục

```
fullpage-capture/
├── src/                        ← Load thư mục này vào Chrome
│   ├── manifest.json
│   ├── popup/                  ← UI chính của extension
│   ├── background/             ← Service worker điều phối capture
│   ├── content/                ← Script inject vào trang
│   ├── preview/                ← Tab xem trước + annotation
│   ├── options/                ← Trang cài đặt
│   ├── lib/                    ← Logic: CDP, stitch, PDF, history…
│   └── assets/icons/
├── docs/                       ← Tài liệu kiến trúc & phase
└── README.md                   ← File này
```

---

## Debug & phát triển

| Việc cần làm | Cách thực hiện |
|--------------|----------------|
| Reload sau khi sửa code | `chrome://extensions` → nhấn icon reload ↺ |
| Debug service worker | `chrome://extensions` → click link **service worker** |
| Debug content script | DevTools của tab → Console → chọn context **content script** |
| Xem log popup | Chuột phải vào icon extension → **Inspect popup** |

**Trang test đề xuất:**
- Trang dài: Wikipedia bài viết bất kỳ
- Trang có fixed header: GitHub repo
- Trang lazy-load: Medium article
- Trang có infinite scroll: Twitter / X

---

## Lưu ý

- **Thanh vàng CDP:** Khi chụp bằng CDP, Chrome hiển thị thanh "DevTools connected" — tự mất sau khi capture xong.
- **`chrome://` và `about:` pages:** Không thể chụp — extension sẽ báo lỗi.
- **Cross-origin iframes:** Nội dung iframe khác origin không được capture.
- **Retina/HiDPI:** Ảnh có thể lớn gấp đôi kích thước thực do `devicePixelRatio = 2`.
