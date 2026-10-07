# Cách dùng

Mở `index.html` bằng double-click (hoặc kéo vào trình duyệt), hoặc deploy
lên GitHub Pages / bất kỳ static host nào (khuyến nghị từ ver 5 vì IndexedDB
hoạt động ổn định hơn theo origin `https://` so với `file://`). Ứng dụng cần
kết nối Internet ở lần mở đầu để tải các thư viện qua CDN (jsmediatags, NoSleep.js, Three.js
+ các module postprocessing, GSAP, idb-keyval, browser-id3-writer, Panzoom, zip.js,
flickr-justified-gallery; trang Subtitle Editor thêm wavesurfer.js và lamejs). CSS Tailwind đã build sẵn
ở `assets/css/tailwind.css` ([tailwind-build.md](./tailwind-build.md)).

**Lưu ý quan trọng (ver 5):** nhạc/tag/cover/phụ đề/ảnh-video nền giờ lưu
trong IndexedDB của trình duyệt — gắn theo từng trình duyệt + thiết bị cụ
thể, không tự đồng bộ qua thiết bị khác, và có thể bị hệ điều hành tự dọn
khi thiết bị thiếu dung lượng. Xem mục "Cảnh báo" trong About Drawer
(Cài đặt → Về trình phát) để biết chi tiết.

**Lưu ý mới (ver 6):** "Xoá hết dữ liệu" trong Quản lý dung lượng giờ **chỉ
xoá bài hát** — ảnh/video nền KHÔNG còn bị xoá theo. Xem
[changelog/v6.md](./changelog/v6.md) (mục 7) để biết lý do.

**Lưu ý mới (ver 8):** ảnh bìa chỉnh trong tab "Ảnh bìa" của modal "Sửa
thông tin bài hát" được lưu CÙNG record bài hát trong IndexedDB (field
`cover`, đã tồn tại từ ver 5) — không phải lưu riêng. Đổi ảnh bìa ở đây
hoàn toàn tương đương với việc bài hát có ảnh bìa mới ngay từ lúc nạp file;
"Xuất tệp" (mục Sửa/Thông tin → Xuất tệp) sẽ ghi đúng ảnh đó vào tag APIC.

**Lưu ý mới (ver 9):** quay lại tab/app sau khi đã rời đi (chuyển app
khác, khoá màn hình...) trong lúc đang nghe nhạc, app sẽ hỏi lại "Bạn có
muốn tiếp tục nghe bài [tên bài] không?" với 3 lựa chọn — **Không** (ở lại
màn Playlist, không phát gì), **Tiếp tục phát** (phát lại đúng bài đó, đúng
vị trí lúc bị dừng), **Nghe lại** (phát lại bài đó từ đầu). Đây THAY THẾ
hành vi "không tự làm gì cả" của ver 8 (mục 13) — nhạc vẫn DỪNG HẲN ngay
khi tab bị ẩn như cũ, chỉ thêm bước hỏi lại lúc quay về, không tự resume
ngầm. Xem [changelog/v9.md](./changelog/v9.md) (mục cuối) để biết toàn bộ
diễn biến điều tra dẫn tới các fix liên quan (AudioContext bị chuyển trạng
thái `'interrupted'` trên iOS, IndexedDB connection bị trình duyệt tự đóng
mà không tự kết nối lại).

**Lưu ý mới (ver 10):** "Xoá hết dữ liệu" (Quản lý dung lượng) giờ đưa UI về
đúng màn Playlist ngay sau khi xoá xong, bất kể đang đứng ở màn Visualizer
hay Playlist lúc bấm — trước đây có thể thấy current/next/prev cũ còn sót
trên màn Visualizer dù đã xoá hết. Việc xoá cũng AN TOÀN hơn nếu bị gián
đoạn: đóng tab/crash giữa lúc đang xoá sẽ tự dọn tiếp phần còn sót ở lần mở
app kế tiếp (hiện loading shield riêng báo "Đang dọn dữ liệu dở từ lần
trước..."), không để sót dữ liệu nửa vời. 2 icon Sort/Grid trước nằm ở
header Playlist giờ chuyển vào Settings (section "Danh sách phát & Nền").
Có thêm tính năng **Tự động đổi hiệu ứng Visualizer** (Settings → mục
Visualizer → "Tùy chỉnh Visualizer") — bật lên sẽ tự đổi sang hiệu ứng khác
sau mỗi khoảng thời gian, 3 cách tính khoảng thời gian khác nhau (Cố định /
Ngẫu nhiên trong khoảng / Theo độ dài bài hát — xem mục 4 trong
[changelog/v10.md](./changelog/v10.md) để biết sự khác biệt quan trọng
giữa 2 nhóm cách tính này, đặc biệt liên quan tới việc tua bài).

**Lưu ý mới (ver 10 mini-fix):** xem
[changelog/v10-mini-not-full-fix.md](./changelog/v10-mini-not-full-fix.md)
để biết đầy đủ — gồm: sửa logo "SAV" không bấm được trên mobile; nút "Đổi
hiệu ứng" tự khoá khi Tự động đổi hiệu ứng đang bật; cơ chế "ẩn tab" viết
lại hoàn toàn (reload ngay lúc ẩn, phân biệt F5 thủ công với ẩn tab thật,
hỏi "Tiếp tục nghe?" ngay từ đầu lúc khởi động lại); thêm Settings →
"Khắc phục sự cố" (Khởi động lại app / Khôi phục cài đặt mặc định); thêm
toggle ẩn/hiện dải BPM/Pitch/Energy trong Control Center. **Log này CHƯA
test đủ kỹ để coi là final** — đặc biệt video nền vẫn chưa khôi phục đúng
vị trí (`currentTime`) sau khi quay lại tab, xem mục "Nợ kỹ thuật" trong
log đó.

**Lưu ý mới (batch i18n — đa ngôn ngữ):** app giờ mặc định hiển thị
**English** (đổi từ tiếng Việt) — đây là lựa chọn tạm thời cho bản test này,
để xác nhận cơ chế dịch đã chạy đúng (không nhầm với cache file cũ). Vào
Settings → mục "Ngôn ngữ" để: chọn lại ngôn ngữ đang hiển thị, tải lên 1 file
ngôn ngữ mới (`.json`), hoặc xóa 1 ngôn ngữ đã tải lên (không xóa được English — luôn có
sẵn). *(Cập nhật ver 13: project không còn kèm file `lang/vi.json`; bộ khoá English nằm trong
`lang/patch/*.js`, file `.json` tải lên phải theo đúng bộ khoá đó. Màn Ngôn ngữ nay ở Settings > System.)*
**Batch này CHƯA test trên browser thật** — chỉ qua test harness Node, xem
mục "Nợ kỹ thuật" trong [changelog/v10-lang-test.md](./changelog/v10-lang-test.md).

**Lưu ý mới (ver 11):** ver này KHÔNG có tính năng mới cho người dùng cuối — toàn bộ thay đổi nằm
ở kiến trúc nội bộ (kiến trúc `/event/` hoàn tất, State quản lý tập trung qua `service/state.js`)
và 3 lỗi nhỏ (dọn 1 file mồ côi + 1 biến khai báo lạc chỗ + 1 comment sai đường dẫn — không ảnh
hưởng hành vi đã thấy). Ver 11 CHÍNH THỨC CHỐT 2 batch trước từng đánh dấu "chưa final": mini-fix
(nợ kỹ thuật video nền chưa khôi phục đúng `currentTime` — đọc lại code xác nhận đã có cơ chế lưu/
khôi phục đầy đủ, dù chưa test trên trình duyệt thật) và batch i18n (vẫn CHƯA có xác nhận chạy
thật trên trình duyệt, không đổi gì thêm). Xem đầy đủ ở [changelog/v11.md](./changelog/v11.md).

**Lưu ý mới (ver 13):** **DB lên v6 — dữ liệu media cũ (bài hát, video, ảnh) bị xoá khi mở bản này lần đầu**,
cần nạp lại thư viện (không có bước chuyển dữ liệu). Mỗi file media tối đa 500 MB. Ver 13 thêm 3 nguồn phát chung
1 playlist (Song/Video/Photo), Motion, Visual Background hợp nhất, Game, Statistics, Ghi âm, Video Editor, Karaoke —
xem [changelog/v13.md](./changelog/v13.md). Nhiều mục còn ghi "chờ test trên máy" (seek gate v3 của Video, DB v6,
mô hình 3 tầng Motion).

← [Quay lại README](../README.md)
