# Ver 13 — Media, phát và lưu trữ

Phần tách riêng của [v13.md](./v13.md). Mốc 14/07/2026 → 07/10/2026.

## 1. Ba nguồn media dùng chung một playlist

- **Video (21/07)** — File Manager có thêm Video (store `videos`, DB lúc đó lên v5); lưới video có windowing riêng
  (CSS Grid). **Video Player mode**: `core/video-player.js` tính next/prev, phát trên `#bg-video`; video giải mã phần
  cứng trên iOS nằm ở layer riêng nên lớp dự phòng đa trình duyệt đặt ở `#visual-bg-image` bên dưới (31/07).
- **Photo Player mode** — Photo chạy như một bài: `duration` thật, play/pause, chế độ Player im lặng, có màn
  sửa. Đồng hồ Photo chỉ bắt đầu đếm khi transition vào xong.
- **Hợp nhất** — `activeMediaSource` có 3 giá trị `song`/`video`/`photo`, cùng một dạng `playlistCache` (Video/Photo
  qua adapter), Next/Prev dùng chung.
- **Chụp khung hình (10/08)** — chụp khung `#bg-video` đang phát, lưu vào Photo; nút ở Control Center.
- **Player Zoom (29/09)** — kính lúp ở Control Center tắt mọi cử chỉ app để pinch/pan; zoom tối thiểu bằng kích thước
  Resolution, 1x khoá tâm (chỉ pan khi >1x); giữ mức zoom qua Next/Prev, qua lần mở app, tách riêng Video và Photo.
  Màn Player > Video/Photo hiện mức zoom + pan X/Y và nút reset.

## 2. Folder ↔ Playlist (6 đợt)

Chạm folder là áp phạm vi ngay (không hỏi nạp lại); mỗi nguồn (Song/Video/Photo) có folder đang chọn riêng; badge ở ô
tìm kiếm thay UI khoá chọn cũ; menu nhấn giữ trên tile (đổi tên / xoá nếu không phải folder đang dùng / ẩn / thuộc
tính + tải zip). Mỗi folder có thể đè Filter riêng (`applyFilter`/`filterConfig`; thứ tự ưu tiên: cấu hình của folder >
folder tắt chặn > cấu hình chung).

## 3. Danh sách Playlist

- **Filter preset (09/09)** — Filter lưu thành preset có tên (cùng khuôn EQ/Motion): công tắc + danh sách quản lý, chỉ
  có hiệu lực khi bật công tắc **và** đã chọn preset.
- **Sort** theo cả trường thống kê; 07/10 chú thích Stats thành icon (i) cạnh Name/Date, chỉ hiện khi chọn trường Stats.
- **10 000 mục (02/10)** — vẫn dựng toàn bộ node lúc boot (không dựng nền/không huỷ node), dùng CSS
  `content-visibility: auto` + ảnh bìa lười. Đổi từ khoá tìm kiếm hay đổi Nguồn: media đang phát có trong danh sách thì
  nhảy thẳng tới, không thì về đầu. **Không còn animation cuộn** ở Playlist — mọi lần cuộn tới bài hiện tại gán
  `scrollTop` trực tiếp.
- Menu 3 chấm đang mở thì Next/Prev hoãn cuộn tới bài hiện tại, cuộn khi menu đóng (21/09).
- Về Playlist trên màn <1024px (05/10): chỉ tạm dừng 2 task `audioAnalysis` + `visualizerRender` và ẩn
  `#visualizer-stage` (VBG và Auto-switch không bị đụng; Video chỉ ẩn hình, tiếng vẫn phát); quay lại Visualizer thì
  effect chạy lại khi media hiện tại `canplaythrough`. `#visualizer-ui` nằm trong `#visualizer-stage`.

## 4. Phát và tua

- **Tốc độ (18/09)** — liên tục 0.5–2x (làm tròn 2 số lẻ); HUD có thanh kéo + 6 mốc chạm nhanh (0.5/0.75/1/1.25/1.5/2).
- **Prev / Restart (25/09)** — Prev luôn về bài trước (bỏ "sau 3 giây thì phát lại từ đầu"); phát lại bài hiện tại là
  icon riêng ở Control Center. Mở lại Next/Prev trên màn khoá (Media Session).
- **Khi ẩn tab/PWA (25/09)** — chỉ tiếng của Song tiếp tục (đăng ký audio session); mọi render Visualizer dừng khi
  không ở Game.
- **Seek gate** — tua xong vẫn nghe tiếng cũ: 25/09 dùng cổng "pause, chờ đuôi audio cũ cạn rồi mới tua", dùng chung
  cho Video, không thêm node vào audio graph. 29/09: repeat-one của Song cũng qua cổng (trước đây gán
  `currentTime = 0`, rò đuôi audio và làm phụ đề trôi dần); pause của Song xả hàng đợi audio iOS ngay lúc pause (nạp lại
  + tua về). 07/10 **gate v3** (nạp lại nguồn) áp cho cả Player Video: giữ khung hình hiện tại (không dùng poster) tới
  khi có sự kiện `playing` thật; gồm cả repeat-one và xả hàng đợi lúc pause của Video. Chờ test trên máy.
- **Seek-hold (07/10)** — cử chỉ giữ để tua làm lại thành "ngón tay ảo" trên thanh tiến trình: trong lúc giữ chỉ gửi
  `seeking` (Song vẫn phát, Video xem trước khung), thả tay mới gửi một `seekCommit`; tự thả ở biên 0/cuối.

## 5. Lưu trữ

- **Quản lý lưu trữ (29/07)** — panel gộp đủ 3 miền Song/Video/Photo: thanh dung lượng theo loại (chạm vào đoạn để xem
  số byte), chọn mục xoá, tải zip. 06/10 hiện thêm quota/dung lượng trống của origin (`navigator.storage.estimate()`),
  số liệu có đếm tăng.
- **Quét file hỏng (18/09)** — lúc upload, video bị từ chối nếu không chụp được cả thumbnail full-res; báo tên file bị
  bỏ qua. Quét có tầng "sửa được" cho video thiếu thumbnail (blob chính còn tốt): tạo lại thumbnail thay vì xoá. Từ
  20/09 phần quét/sửa thumbnail video nằm ở Troubleshooting; Storage giữ "Quét & dọn file lỗi" chỉ xoá file hỏng thật.
- **Zip (10/09)** — zip.js ghi stream vào OPFS là đường duy nhất (bỏ JSZip — gốc lỗi zip video >1 GB làm PWA crash);
  tải về qua `navigator.share()` từ một lần chạm mới. File lớn (>500 MB) né lỗi tải blob của WebKit bằng Service Worker
  tối giản + Cache Storage (URL cùng origin; chỉ HTTPS — `file://` vẫn dùng `blob:`).
- **06/10 (Giang chốt)** — mục đích tải trong PWA cài đặt là sao lưu/khôi phục vào chính app. Mỗi file media tối đa
  **500 MB**; zip lớn hơn 500 MB chia nhóm, có modal tải nhiều phần.

## 6. DB v6 (06/10)

- Giữ IndexedDB (OPFS bị loại). Mỗi loại media có 3 store — meta / blob media / blob thumb — dùng chung khoá media
  thuần (không tiền tố loại trong DB; chỉ map thống kê trong RAM dùng `type:key`). Thống kê nghe và điểm game nằm trong
  meta của từng media.
- **Không chuyển dữ liệu**: DB v1–v5 lên v6 xoá store media cũ (cài lại thư viện). Các hàm `set*Record`/
  `delete*Record` cũ bị xoá hẳn; API mới: `createMediaRecord`, `updateMediaMeta(Batch)`, `setMediaBlob`,
  `setMediaThumbs`, `deleteMediaRecord`, `clearAllMediaOfType` (ghi) và `getMediaRecord`, `getMediaMeta`,
  `getAllMediaMeta`, `getMediaBlob`, `getMediaThumbs` (đọc).
- **`mediaInUse`** — thay nội dung một media thì gửi `{type, key}` tới yêu cầu trung tâm; nó tự kiểm state (node
  playlist / player chính / VBG) và nạp lại nơi đang dùng.
- Thiết kế đầy đủ: `readme/plan/plan-media-db-split.md`. Chờ test trên máy.

## 7. Ảnh

- **Lưới ảnh (29/08)** — viết lại bằng flickr-justified-gallery (layout justified chuẩn), có windowing; chọn nhiều ảnh
  hiện số thứ tự.
- **Modal xem ảnh (31/07)** — Zoom mode (Panzoom; dùng chung `core/media-transform.js` với crop), Edit mode: chỉnh
  ảnh (decode/adjust/sharpen trong core thuần `core/photo-editor-engine.js`), crop, vẽ, layer chữ và hình (kiểu qua
  Element Style Editor).

← [v13.md](./v13.md)
