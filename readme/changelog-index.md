# Mục lục Changelog

Bản hiện tại: **ver 12** — hạ tầng rẽ nhánh theo `appState` cho `/event/` (`service/operation.js`,
`event/block.js`, `event/virtual-machine-state.js` — **nay đã wire thật**, ≥15 điểm gọi), Đa
phương tiện (Slideshow/Ảnh/Documents v1, IndexedDB v4), tái cấu trúc Settings + Theme 4 mode
(Sáng/Tối/Background/Gradient — riêng "Sáng" mới chỉ lưu lựa chọn, CHƯA áp màu thật), Subtitle
Editor tách từ modal sang trang riêng `subtitle-editor.html`, Documents viết lại hoàn chỉnh lần 2
(Nhóm A), Rule 5 cho hàm dựng UI (`readme/core-function-conventions.md`). Xem đầy đủ ở
[v12.md](./changelog/v12.md) — file này gộp nhiều phiên rải từ đầu tháng 7 tới 12/07/2026, trước
đó chỉ tài liệu hoá trong các bản `sav12-handoff-plan*.md` tạm, chưa gộp vào changelog chính thức.

- [v12.md](./changelog/v12.md) — hạ tầng block/VM-state (nay đã wire), Đa phương tiện, Settings/
  Theme, Subtitle Editor trang riêng, Documents Nhóm A, Rule 5 — nợ kỹ thuật mới: seek-trước-rồi-
  phát Subtitle Editor, 2 file mồ côi, Rule 3 mới ở `photo-ui.js`/`settings-panel-stack.js`. Kèm
  re-sync đầy đủ `folder-structure.md`/`where-to-edit.md`/`core-legacy-audit.md` (đã tụt hậu, giờ
  quét lại bằng script, khớp code thật)
- [v11.md](./changelog/v11.md) — event bus hoàn tất, State tập trung (đã audit từng key), 3 lỗi nhỏ
- [v10-lang-test.md](./changelog/v10-lang-test.md) — khung đa ngôn ngữ (i18n), English gốc cứng
  RAM, ngôn ngữ khác qua IndexedDB tự upload — ⚠️ vẫn CHƯA test trên browser thật (không đổi ở v11)
- [v10-mini-not-full-fix.md](./changelog/v10-mini-not-full-fix.md) — các fix lẻ (logo mobile, vị
  trí UI auto-switch, viết lại cơ chế ẩn tab, Khắc phục sự cố, toggle BPM/Pitch/Energy) — nợ kỹ
  thuật video nền `currentTime` ghi trong log này đã được xử lý ở phiên ngay trước v11 (xem
  v11.md mục "Nợ kỹ thuật còn lại")
- [v10.md](./changelog/v10.md) — TaskManager tập trung, fix "Xoá hết dữ liệu", dọn icon Sort/Grid,
  Tự động đổi hiệu ứng Visualizer
- [v9.md](./changelog/v9.md) — fix loạt lỗi iOS (upload im lặng, reset không hoàn chỉnh, AudioContext
  'interrupted', IndexedDB connection tự đóng), modal "Tiếp tục nghe?"
- [v8.md](./changelog/v8.md) — modal sửa bài thêm tab Ảnh bìa, logo SAV, tách settings-drawer.js
- [v7.md](./changelog/v7.md) — YIN sang Web Worker, sửa O(n²), khoá định dạng file, tự phục hồi config
- [v6.md](./changelog/v6.md) — dọn lỗi vặt ver 5, tách playlist.js, ô tìm kiếm + thống kê nghe
- [v5.md](./changelog/v5.md) — playlist persist qua IndexedDB (thay đổi lớn nhất lịch sử project)
- [v4.md](./changelog/v4.md)
- [v3.md](./changelog/v3.md)
- [v2.md](./changelog/v2.md)
- [v1.md](./changelog/v1.md)

## Tóm tắt từng bản (cũ → mới)

Ver 12 mở đầu bằng hạ tầng rẽ nhánh theo `appState` cho kiến trúc `/event/` — `service/operation.js`
(so sánh toán tử dùng chung), `event/block.js` (chặn 1 `msg.type` TRƯỚC khi vào router, đăng ký qua
`eventBus.registerBlock()`), `event/virtual-machine-state.js` (`VirtualMachineState.run()`, chạy
nhiều workflow độc lập NGAY TRONG 1 case của router) — cả 3 nay **đã wire thật** (≥15 điểm gọi, xem
[v12.md](./changelog/v12.md) mục 3). Sau đó ver 12 còn gồm 1 khối lượng lớn việc khác trải dài tới
12/07/2026, trước đây chỉ nằm trong các bản `sav12-handoff-plan*.md` tạm chưa gộp chính thức: Đa
phương tiện (Slideshow/Ảnh/Documents bản v1, IndexedDB nâng lên `DB_VERSION` 4 với 5 store mới),
File Manager chuyển hẳn vào Settings, tái cấu trúc toàn bộ Settings (điều hướng cuộn ngang thay
trượt dọc) + hạ tầng Theme 4 mode, Subtitle Editor tách từ modal sang trang riêng
`subtitle-editor.html` (WaveSurfer.js, Cut MP3/lamejs), Documents viết lại hoàn chỉnh lần 2 (Nhóm A
— content model `.txt` = `string[]`, `.docx`/user-edited = HTML đã lọc whitelist), và Rule 5 mới
cho hàm dựng UI ở `core-function-conventions.md`. Chi tiết đầy đủ + nợ kỹ thuật (kể cả 1 chỗ đính
chính "Fix B" shuffle từng bị ghi nhầm là đã xong) ở [v12.md](./changelog/v12.md).

Ver 11 KHÔNG có tính năng mới cho người dùng cuối — thuần tái cấu trúc nội bộ. Kiến trúc `/event/`
(`listener → router → workflow → core`) hoàn tất cho 14 cụm (119 listener nghiệp vụ), cả State
(96 biến mutable) lẫn CONST (16 hằng số) đều migrate 100% qua `service/state.js` (93 chỗ dùng
`CONST.xxx` thật trên 18 file). 3 lỗi nhỏ phát hiện qua audit: 1 file mồ côi, 1 biến khai báo lạc
chỗ, 1 comment sai đường dẫn. Chốt chính thức 2 batch trước từng để "chưa final" (mini-fix + i18n)
— chi tiết đầy đủ, kèm số liệu đối chiếu qua script, ở [v11.md](./changelog/v11.md).

Ver 10 tập trung sửa lỗi thực tế phát hiện khi dùng trên iOS (đặc biệt khi
chuyển tab/ẩn trình duyệt): dồn toàn bộ `setInterval`/`setTimeout` qua 1
`TaskManager` tập trung duy nhất, sửa lỗi "Xoá hết dữ liệu" không cập nhật
UI + thêm phòng thủ khi bị gián đoạn, dọn 2 icon Sort/Grid khỏi header
Playlist vào Settings, và tính năng mới Tự động đổi hiệu ứng Visualizer
theo thời gian. Sau đó có 2 batch riêng (mini-fix + i18n) — cả 2 nay đã
được ver 11 chốt chính thức.

Ver 9 tập trung sửa lỗi thực tế phát hiện khi dùng trên iOS (đặc biệt khi
chuyển tab/ẩn trình duyệt): sửa lỗi upload im lặng, lỗi reset không hoàn
chỉnh khi chuyển tab, nguyên nhân gốc rễ của "không ra tiếng" sau khi quay
lại tab (AudioContext chuyển `'interrupted'` + IndexedDB connection bị
trình duyệt tự đóng không tự mở lại), và modal "Tiếp tục nghe?" khi quay
lại tab.

Ver 8 tập trung vào chỉnh sửa metadata bài hát và dọn kiến trúc file: modal
"Sửa thông tin bài hát" có thêm tab "Ảnh bìa" (upload/xem trước/xóa cover
ngay trong app, tự ghi vào tag APIC lúc Xuất tệp), 2 modal liên quan thông
tin/ảnh bài hát thiết kế lại theo theme kính mờ "nét" (`glass-modal`,
layout dạng card/icon), thêm logo wordmark "SAV" (không khung/viền, kiểu
Facebook) hover trượt chữ theo chiều ngang ở góc Playlist, nút "Thêm nhạc"
hỗ trợ chọn cả 1 thư mục nhạc, ô tìm kiếm lọc thêm theo album, và
`settings-drawer.js` (từng dồn ~28KB HTML vào 1 file) được tách thành 5
file con theo từng khối cài đặt.

Ver 7 tách thuật toán nhận diện cao độ (YIN) sang Web Worker riêng để
không tranh CPU với canvas mỗi khung hình, sửa 2 điểm O(n²) khi playlist
lớn, khoá định dạng file ở cả 3 nơi nhận upload (nhạc/ảnh nền/video nền),
và cấu hình tự phục hồi từ IndexedDB nếu `localStorage` bị trình duyệt xoá
mất.

Ver 6 dọn lỗi vặt còn sót từ ver 5 (sort, trạng thái rỗng, video nền
chớp/khựng), tách lại file `playlist.js` quá khổ, thêm ô tìm kiếm + thống
kê nghe theo từng bài.

Ver 5 là thay đổi lớn nhất trong lịch sử project — toàn bộ playlist (nhạc,
tag, cover, phụ đề, ảnh/video nền) persist qua **IndexedDB**.

Lịch sử các bản cũ hơn (ver 1–4) nằm ở changelog riêng từng bản trong thư
mục [changelog/](./changelog/).

← [Quay lại README](../README.md)
