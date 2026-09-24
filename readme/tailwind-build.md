# Tailwind — build CSS (thay Play CDN)

MỚI (24/09/2026, Giang chọn "dùng file Tailwind build sẵn"). App KHÔNG còn nạp `https://cdn.tailwindcss.com`
(~400 KB JS, tự biên dịch CSS ngay trên máy mỗi khi DOM có class mới — CSS của class lần đầu xuất hiện về trễ,
làm Generic Drawer thụt chiều cao lần đầu mở màn con; kèm cần mạng). Thay bằng file build sẵn:

| File | Vai trò |
|---|---|
| `tailwind.config.js` | Cấu hình: file được quét tìm class (`content`), `hoverOnlyWhenSupported`, `safelist` |
| `assets/css/tailwind.input.css` | Nguồn build (3 dòng `@tailwind`) — KHÔNG nạp trong trang |
| `assets/css/tailwind.css` | Kết quả (minify) — `index.html` + `subtitle-editor.html` nạp file này |

Kích thước lúc tạo: ~57 KB minify, ~10 KB khi nén gzip.

## Khi nào PHẢI build lại

Mỗi khi code dùng **1 class Tailwind chưa từng xuất hiện** trong project (vd lần đầu dùng `gap-7`). Quên build thì
class đó **không có style** (Play CDN cũ tự sinh lúc chạy, bản build thì không). Sửa code chỉ dùng lại class đã có
thì không cần build.

Class phải xuất hiện **nguyên vẹn** trong code để Tailwind quét thấy: viết `'bg-sky-500'`, KHÔNG ghép
`` `bg-${color}-500` ``. Bắt buộc phải ghép động thì thêm tên đầy đủ vào `safelist` trong `tailwind.config.js`.

## Cách build

Dùng Tailwind **v3.4.x** (KHÔNG dùng v4 — định dạng config khác hẳn). Chạy ở thư mục gốc project:

**Cách 1 — CLI standalone (không cần cài Node):** tải 1 file chạy đúng hệ điều hành từ trang Releases của
`tailwindlabs/tailwindcss` trên GitHub, tag `v3.4.x` (vd `tailwindcss-windows-x64.exe`, `tailwindcss-macos-arm64`,
`tailwindcss-linux-x64`), đặt vào thư mục gốc rồi:

```
./tailwindcss -c tailwind.config.js -i assets/css/tailwind.input.css -o assets/css/tailwind.css --minify
```

(Windows: `tailwindcss-windows-x64.exe -c tailwind.config.js -i assets/css/tailwind.input.css -o assets/css/tailwind.css --minify`)

**Cách 2 — có sẵn Node:**

```
npx tailwindcss@3 -c tailwind.config.js -i assets/css/tailwind.input.css -o assets/css/tailwind.css --minify
```

Build xong: tăng `?v=` của `assets/css/tailwind.css` trong `index.html` và `subtitle-editor.html` để máy lấy bản mới.

## Nén gzip

KHÔNG commit file `.gz`. Trình duyệt chỉ tự giải nén khi SERVER trả header `Content-Encoding: gzip`; GitHub Pages
tự nén gzip các file văn bản (CSS/JS/HTML) lúc gửi, nên chỉ cần commit `tailwind.css` (đã minify). Kiểm tra:
DevTools > Network > `tailwind.css` > Response Headers có `content-encoding: gzip`. Chạy qua `file://` thì không có
nén nhưng đọc từ đĩa nên không ảnh hưởng.
