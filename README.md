# Simple Audio Visualizer

Bản chia nhỏ và phát triển từ tệp `VM_4.html` gốc (2032 dòng, 1 file duy nhất)
thành các file CSS / JS / "component" HTML riêng biệt, **không dùng ES6
module** (`import`/`export`) — toàn bộ vẫn dùng `<script src="...">` thông
thường để chạy được trực tiếp khi mở `index.html` bằng cách double-click
(`file://`), không cần server, không cần build step. Xem
[readme/why-no-es6-module.md](./readme/why-no-es6-module.md) để biết lý do.

## Bản hiện tại: ver 11

Ver 11 CHỐT CHÍNH THỨC 3 việc đã làm dần qua nhiều phiên trước (không phải tính năng mới cho người
dùng cuối — thuần kiến trúc nội bộ):

1. **Kiến trúc event-driven `/event/` — HOÀN TẤT 100%.** Toàn bộ 14 cụm nghiệp vụ (119
   `addEventListener`) đã qua đúng pipeline **listener** (chỉ gửi message) → **bus**
   (`event/bus.js`, tổng đài) → **router** (quyết định gọi thẳng core hay giao workflow) →
   **workflow** (chuỗi gọi nhiều hàm core, có `withLoadingShield`/`alertModal`, 6/14 cụm cần) →
   **core** (hàm thuần, không biết gì về DOM/event/modal). Không còn cụm nào dở dang.
2. **State quản lý tập trung qua `service/state.js` — đã audit xác nhận từng key, cả STATE lẫn
   CONST đều xong 100%.** `STATE_SCHEMA` (96 key mutable, class `AppState` với `get`/`set`/
   `mutate` + validate kiểu) đã migrate **100%**, và `CONST` (16 hằng số readonly) **cũng đã
   migrate 100%** — cả 16 hằng số đều đã xoá khai báo local ở 6 file gốc, chuyển hẳn sang đọc
   `CONST.xxx` (93 chỗ dùng thật, rải trên 18 file) — đối chiếu bằng script trên toàn bộ source,
   không còn biến global rời rạc nào sót lại cho cả 2 nhóm.
3. **3 lỗi nhỏ** phát hiện trong lúc audit: 1 file mồ côi (`core/visualizer-overlay.js`, bản HTML
   cũ không còn được nạp), 1 biến `noSleep` khai báo lạc trong file phụ đề (đã chuyển về
   `core/wakelock.js`), 1 comment sai tên file.

Ver 11 cũng chốt luôn 2 batch trước từng đánh dấu "chưa final" (mini-fix + i18n) — xem đầy đủ, kèm
số liệu đối chiếu qua script, ở **[readme/changelog/v11.md](./readme/changelog/v11.md)**.

## Nợ kỹ thuật (ver 12 trở đi)

Từ ver 12, mọi function Core/nghiệp vụ **mới viết hoặc bị sửa thật** — dù trong `core/` hay bất kỳ
thư mục nào khác — bắt buộc tuân theo 4 rule ở
**[readme/core-function-conventions.md](./readme/core-function-conventions.md)** (đơn tuyến
nghiệp vụ, không tự đọc `appState`, core-gọi-core chỉ hợp lệ khi dùng return value, log
`writer/page/content` khi set/mutate state).

**150/266 function core hiện có** (đã loại trừ hot-path) vi phạm ít nhất 1 trong các rule trên —
được ghi nhận CHÍNH THỨC là nợ kỹ thuật, danh sách đầy đủ theo từng file/dòng ở
**[readme/core-legacy-audit.md](./readme/core-legacy-audit.md)**. KHÔNG bắt buộc sửa ngay — chỉ
bắt buộc khi 1 function trong danh sách đó bị đụng tới thật trong tương lai.

## Đọc tiếp ở đâu

| Muốn biết... | Đọc... |
|---|---|
| Toàn bộ lịch sử thay đổi (ver 1 → ver 12) | [readme/changelog-index.md](./readme/changelog-index.md) |
| Cấu trúc thư mục hiện tại + bảng lịch sử file thêm/sửa/xoá từng version (v1→v12) | [readme/folder-structure.md](./readme/folder-structure.md) |
| Sơ đồ đầy đủ luồng `/event/` (listener→router→core/workflow/virtual-machine-state) | [readme/event-bus-flow.md](./readme/event-bus-flow.md) |
| Quy tắc viết function Core/nghiệp vụ (đơn tuyến, không tự đọc appState, log khi gọi core khác) | [readme/core-function-conventions.md](./readme/core-function-conventions.md) |
| Nợ kỹ thuật: function core di sản vi phạm quy tắc trên (chính thức, sửa khi đụng tới) | [readme/core-legacy-audit.md](./readme/core-legacy-audit.md) |
| Thứ tự nạp script trong `index.html` (quan trọng, đừng đảo) | [readme/script-load-order.md](./readme/script-load-order.md) |
| Cách chạy / deploy ứng dụng + các lưu ý theo từng bản | [readme/usage.md](./readme/usage.md) |
| Muốn sửa 1 tính năng cụ thể thì vào file nào (kể cả sửa qua kiến trúc `/event/`) | [readme/where-to-edit.md](./readme/where-to-edit.md) |
| Quy ước bắt buộc khi viết/sửa 1 Visual mới | [readme/visual-conventions.md](./readme/visual-conventions.md) |
| Quan hệ tham chiếu Ảnh bìa bài hát ↔ Ảnh nền Playlist ↔ Ảnh nền Visual (điều tra trước batch picker chung, mục 4.c/4.d) | [readme/song-cover-background-relations.md](./readme/song-cover-background-relations.md) |
| Vì sao không dùng ES6 module | [readme/why-no-es6-module.md](./readme/why-no-es6-module.md) |

## Cách dùng nhanh

Mở `index.html` bằng double-click, hoặc deploy lên GitHub Pages / static
host. Cần Internet ở lần mở đầu để tải thư viện qua CDN. Chi tiết đầy đủ +
các lưu ý quan trọng theo từng bản (đặc biệt về IndexedDB và modal "Tiếp
tục nghe?") ở [readme/usage.md](./readme/usage.md).
