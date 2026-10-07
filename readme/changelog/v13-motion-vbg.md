# Ver 13 — Motion, Visual Background, Player Display

Phần tách riêng của [v13.md](./v13.md). Mốc 14/07/2026 → 07/10/2026.

## 1. Nguyên tắc (Giang chốt)

- **"Nguyên tắc tua vít"** — Motion (engine, runner, host dùng chung) chỉ cung cấp cơ chế thuần, không biết ai dùng và
  dùng để làm gì. Nơi tiêu thụ tự quyết nội dung, thời điểm, preset và gắn cơ chế vào đâu. Áp cho **mọi** việc liên quan
  Motion.
- **Tách tên 3 phía** — chế độ phát của VBG giữ giá trị `'slideshow'`; hệ preset ở Settings là **Motion** (Settings >
  System > Motion, CRUD); bộ render là **Motion Engine** (`core/motion-engine.js`). VBG chỉ tham chiếu preset theo id,
  không sở hữu preset.

## 2. Motion

- **Hệ preset độc lập (29/08)** — `service/state/motion-presets.js`.
- **Transition (30/08)** — 13 kiểu gom chung các field `direction`/`zoomDirection`/`spinDirection` (mỗi field có
  "ngẫu nhiên" không lặp lại): slide, wipe, fade, zoom, spin, flipCard (lật 2 mặt thật), flipEdge (Open/Close, tuỳ chọn
  giữ yên mặt kia)…
- **Point Move** (thay hẳn Ken Burns) — danh sách bước do người dùng tạo: Linear X/Y, Rotate, Zoom, Flip X/Y (Flip giới
  hạn ±360° như Rotate). 2 chế độ chạy: `all` (lấy mẫu theo trục thời gian Timing/X) và `one` (chọn 1 bước mỗi lần kích
  hoạt). Nhân bản, kéo thả đổi thứ tự (đổi cả `order` và `timingX`), checkbox "ép baseline ở đầu/cuối" (loại trừ nhau)
  để lặp liền mạch.
- **React Beat Audio** — bám audio liên tục (đọc `beatScale` mỗi khung) với envelope attack/decay; zoom/pan/rotate có
  mức tối thiểu cố định (100% / 100% / 0°), chỉ chỉnh mức tối đa (trần 200 / 150 / 360); hướng pan/rotate có checkbox
  "đảo". Luôn chạy cùng Point Move.
- **17/09** — `event/workflow/motion-engine.js` đổi tên `visual-bg-photo-motion.js` (`workflowVisualBgPhotoMotion`) vì
  thật ra là phần render riêng của VBG Photo; `core/motion-engine.js`, 3 runner và `#visual-motion-react` giữ tên (đúng
  là hạ tầng dùng chung). `isReactBeatPresetActive(preset)` gộp 2 phép kiểm "preset React Beat có hiệu lực" đã lệch nhau.
- **24/09** — bỏ cơ chế đăng ký "Apply to" ở màn sửa Motion: nơi tiêu thụ mở danh sách preset ở chế độ chọn (chạm hàng
  = chọn, nút Apply ở header xác nhận và tự quay lại, ghi id preset vào cấu hình của chính nơi tiêu thụ).
- **25/09 — mô hình 3 tầng** (Giang duyệt): cơ chế Motion (runner + `workflowMotionStage` dùng chung, host kiểu
  lease/token) → "surface" media theo loại nội dung (ảnh A/B, video A/B; nằm ngoài miền Motion) → nơi tiêu thụ chỉ giữ
  quyết định. Áp cho cả 4 nơi: VBG Photo, VBG Video, Player Photo, Player Video (5 phase, đã giao hết). Giang chốt:
  không đổi tên id DOM/hàm có sẵn; Point Move của VBG Video chạy lại mỗi vòng lặp video gốc; transition của VBG Video
  giới hạn theo fixtime; chỉnh trực tiếp chỉ gồm công tắc Point Move (qua broadcast). Chờ test trên máy.
- **29/09 (quy tắc)** — ở Player Video, React Beat trượt về baseline **trong** lúc transition Next/Prev, đúng bằng
  thời lượng transition. Thứ tự lớp: wrapper React > wrapper Point Move > lớp A/B (2 lớp luôn di chuyển như một khối).
- **07/10** — bỏ nút "tạo preset ngẫu nhiên"; thay bằng nút ngẫu nhiên (sinh lại mỗi lần bấm) cho giá trị slider trong
  React Beat và Point Move.

## 3. Visual Background (VBG)

- Lược đồ hợp nhất `vbg.type`/`vbg.source`; chọn nguồn bằng 3 nút Video / Photo / Folder (chọn nhiều, có số thứ tự —
  29/08). Chỉ thao tác được khi Nguồn Playlist đúng là Song.
- **08–09/08** — sub-panel "Âm thanh Video" (âm thanh riêng từng video trong danh sách nguồn: icon bật/tắt ngay, % mở
  modal chỉnh); video nền gate theo Song (chỉ nạp/phát khi Song chạy, hiện thumbnail full-res tĩnh lúc chờ).
- **12/08** — drawer Gradient riêng cho nền màu.
- **25/09** — Giang duyệt: VBG không áp/ghi đè nội dung khi đang ở Video/Photo Player mode.
- **29/09** — công tắc tổng (`visualBg.enabled`) đầu panel: tắt chỉ gỡ media ảnh/video, lớp màu đặc/gradient vẫn giữ;
  bật lại nạp media từ đầu (không resume).
- **30/09** — dropdown Resolution (fill/stretch/trueMax) cho Media, giá trị riêng cho VBG Video và VBG Photo (độc lập
  với Player), luôn hiện. Sửa: `videoSyncPlaybackSpeed` của VBG không khôi phục lúc boot.
- **05/10** — công tắc + Media + Playback dời vào Visualizer Screen > Player > Song > Background Media; màn cũ đổi tên
  "Background Color" (chỉ còn thẻ màu).

## 4. Player Display Settings (24/09 → 29/09)

Settings > Visualizer Screen > Player > Video / Photo (Cử chỉ cũng dời về đây từ System).

- **Resolution** — từ 29/09 chỉ còn `fill` (mặc định) / `stretch` / `trueMax`; bỏ `cover`/`fit` (giá trị cũ chuẩn hoá về
  `fill`). `fill` = phóng từ tâm phủ kín màn Visualizer, giữ tỉ lệ, cắt phần tràn.
- **Ô chọn preset Motion** — Video có 4 ô (Next Transition, Previous Transition, Showing = Point Move + React Beat);
  Photo có 3 (Next/Previous Transition, Point Move — không có audio để React). Icon (i) cạnh tiêu đề nhóm Motion giải
  thích các ô.
- Đã áp lúc chạy: Resolution và React Beat của Video; Transition Next/Prev và Point Move của Player còn chờ.
- Sửa: lớp B của Player Video ở `trueMax` bị tính theo kích thước video cũ trong lúc đổi video (30/09).

← [v13.md](./v13.md)
