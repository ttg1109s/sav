# Audivis

(Tên cũ: Simple Audio Visualizer → Audio Visualizer — đổi thành Audivis 06/10/2026.)

Bản chia nhỏ và phát triển từ tệp `VM_4.html` gốc (2032 dòng, 1 file duy nhất)
thành các file CSS / JS / "component" HTML riêng biệt, **không dùng ES6
module** (`import`/`export`) — toàn bộ vẫn dùng `<script src="...">` thông
thường để chạy được trực tiếp khi mở `index.html` bằng cách double-click
(`file://`), không cần server, không cần build step. Xem
[readme/why-no-es6-module.md](./readme/why-no-es6-module.md) để biết lý do.

## Bản hiện tại: ver 13 (14/07/2026 → 07/10/2026)

Ver 13 là bản tính năng lớn nhất từ trước tới nay — chi tiết ở
**[readme/changelog/v13.md](./readme/changelog/v13.md)** (kèm 3 phần tách riêng: Media & lưu trữ, Motion & Visual
Background, Visualizer):

- **3 nguồn phát chung 1 playlist** — Song / Video / Photo (Video Player, Photo Player, Player Zoom, chụp khung hình).
- **Motion** (preset độc lập, Transition, Point Move, React Beat) và **Visual Background** hợp nhất.
- **Tính năng mới:** Game, Statistics, Ghi âm, Video Editor, Phụ đề Karaoke, Theme Sáng/Tối/Morphin.
- **Lưu trữ:** DB v6 (meta/blob/thumb tách riêng — **không chuyển dữ liệu cũ, phải nạp lại thư viện**), giới hạn
  500 MB mỗi file, zip stream qua OPFS.
- **Kiến trúc:** kho `audioAnalysis`, Workflow rẽ nhánh bằng object map / `VirtualMachineState`, dọn visualizer
  Phase 1–5, đổi tên app thành Audivis.

## Sổ vi phạm kiến trúc

Toàn bộ code được chấm theo [event-bus-flow.md](./readme/event-bus-flow.md),
[core-function-conventions.md](./readme/core-function-conventions.md) và
[task-manager-conventions.md](./readme/task-manager-conventions.md). Kết quả 07/10/2026: **1312 vi phạm ở 142 file**
(10 mục chờ chốt) — 27,6% dòng code nằm trong hàm có vi phạm. **Nợ cũ vẫn là vi phạm**; sửa xong dòng nào thì xoá
dòng đó khỏi sổ: **[readme/core-legacy-audit.md](./readme/core-legacy-audit.md)**.

## Đọc tiếp ở đâu

| Muốn biết... | Đọc... |
|---|---|
| Toàn bộ lịch sử thay đổi (ver 1 → ver 13) | [readme/changelog-index.md](./readme/changelog-index.md) |
| Sơ đồ đầy đủ luồng `/event/` (listener → bus/block → router → workflow → core) và việc của Workflow | [readme/event-bus-flow.md](./readme/event-bus-flow.md) |
| Quy tắc viết function Core (Rule 1–5) | [readme/core-function-conventions.md](./readme/core-function-conventions.md) |
| Quy ước timer — mọi hẹn giờ qua `taskManager` | [readme/task-manager-conventions.md](./readme/task-manager-conventions.md) |
| Sổ vi phạm kiến trúc hiện tại | [readme/core-legacy-audit.md](./readme/core-legacy-audit.md) |
| Thứ tự nạp `<script>` của 3 trang + giải thích từng khối (các trang HTML không còn comment) | [readme/script-load-order.md](./readme/script-load-order.md) |
| Muốn sửa 1 tính năng cụ thể thì vào file nào | [readme/where-to-edit.md](./readme/where-to-edit.md) |
| Quy ước bắt buộc khi viết/sửa 1 effect Visualizer | [readme/visual-conventions.md](./readme/visual-conventions.md) |
| Build CSS Tailwind | [readme/tailwind-build.md](./readme/tailwind-build.md) |
| Cách chạy / deploy ứng dụng + các lưu ý theo từng bản | [readme/usage.md](./readme/usage.md) |
| Kế hoạch đang mở (DB v6, nối event bus, dọn nợ) | [readme/plan/](./readme/plan/) |
| Điều tra cũ: Ảnh bìa ↔ ảnh nền (lưu trữ ver 12) | [readme/song-cover-background-relations.md](./readme/song-cover-background-relations.md) |
| Vì sao không dùng ES6 module | [readme/why-no-es6-module.md](./readme/why-no-es6-module.md) |

## Cách dùng nhanh

Mở `index.html` bằng double-click, hoặc deploy lên GitHub Pages / static host (khuyến nghị — IndexedDB, Service
Worker và tải file lớn ổn định hơn trên `https://`). Cần Internet ở lần mở đầu để tải thư viện qua CDN. Chi tiết và
lưu ý theo từng bản ở [readme/usage.md](./readme/usage.md).
