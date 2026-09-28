# Quy ước BẮT BUỘC khi viết / sửa một Visual (từ ver 6, đường dẫn cập nhật ver 11)

Mọi visual trong `core/visualizer/types/*.js` PHẢI hỗ trợ đầy đủ 4 nhóm cấu hình chung dưới đây.
Đây là hợp đồng chung — visual nào bỏ sót sẽ bị coi là lỗi:

1. **Video nền (`vizConfig.videoBgEnabled`)** — khi BẬT, visual KHÔNG được tô một lớp nền đục phủ
   kín canvas (sky/background fill) đè lên video. Hãy bọc mọi lệnh
   `fillRect(0,0,canvas.width,canvas.height)` mang tính "nền" trong
   `if (!appState.get('vizConfig').videoBgEnabled) { ... }` để video hiện xuyên qua (mẫu: cả
   `drawRainGlass` lẫn `drawRainStreet` trong `rain.js`). Các phần tử tiền cảnh (thanh, hạt, đèn,
   mặt đất...) vẫn vẽ đè bình thường lên trên video.
2. **Màu nền (`vizConfig.bgColor`)** — khi KHÔNG dùng video, nền phải theo `bgColor` người dùng
   chọn (qua `updateDOMBackground()` cho body, và/hoặc lệnh fill nền trong chính visual).
3. **Chế độ màu (`vizConfig.mode` = `solid` | `dynamic` | `rainbow/auto`)** — màu của các phần tử
   vẽ phải lấy từ helper màu chung (`getComputedColor()` / `interpolateColor()` /
   `vizConfig.solidColor` / `dynA`-`dynB`) thay vì hard-code, để nhất quán với lựa chọn người dùng.
4. **Hiệu năng (`vizConfig.quality` + `PERFORMANCE_PROFILES`)** — số lượng phần tử (hạt, thanh,
   tia...) phải co giãn theo `perf` được truyền vào hàm vẽ, để máy yếu vẫn chạy mượt.

**[v11] Cách đọc `vizConfig` — BẮT BUỘC qua `appState.get('vizConfig')`, không còn biến `vizConfig`
trần nào để đọc trực tiếp** (đã migrate 100% qua `service/state.js`, xem
[changelog/v11.md](./changelog/v11.md) mục 3). Trong 1 hàm vẽ gọi nhiều lần/khung hình, đọc 1 lần
ra biến cục bộ đầu hàm (`const cfg = appState.get('vizConfig');`) rồi dùng `cfg.xxx` trong toàn hàm
— KHÔNG gọi `appState.get('vizConfig')` lặp lại nhiều lần trong cùng 1 vòng lặp vẽ (đúng khuyến
nghị hiệu năng hot path 60fps của `service/state.js`). `PERFORMANCE_PROFILES`/`MODES` [v11] đã
migrate sang `CONST` (`service/state.js`) — đọc qua `CONST.PERFORMANCE_PROFILES`/`CONST.MODES`,
không còn bản local trong `core/config.js` nữa. Property LỒNG BÊN TRONG (`CONST.PERFORMANCE_PROFILES[quality].stars`/`.streetRain`/`.tunnelRings`...)
giữ nguyên như cũ, chỉ tên hằng số ngoài cùng đổi.

(LỊCH SỬ — từ 28/09/2026 xem mục "Cấu trúc Workflow vẽ" ngay dưới; trạng thái điều phối riêng của 1 group
— cửa sổ beat, bộ đệm dot/clock — là thuộc tính của object workflow group đó, như các biến `_fw*`/`_dot*` cấp module
trước đây; dữ liệu cảnh dùng chung nhiều nơi vẫn ở appState.)
Khi thêm visual mới: đăng ký hàm vẽ vào `VISUALIZER_DRAWERS` trong
`core/visualizer/draw-visualizer.js`, thêm tên `type` vào `MODES` (`core/config.js`), và tự kiểm 4
mục trên trước khi coi là hoàn tất. Nếu visual mới cần đọc/ghi biến runtime riêng (kiểu
`beatTimes`/`stars`/`rubikCubes`...), khai thêm key vào `STATE_SCHEMA` (`service/state.js`) thay vì
tự khai `let` cục bộ mới trong file visual — xem quy ước STATE ở
[changelog/v11.md](./changelog/v11.md) mục 3.

## Cấu trúc Workflow vẽ từ 28/09/2026 (Phase 3-4 dọn visualizer) — THAY `VISUALIZER_DRAWERS`

`VISUALIZER_DRAWERS` và chuỗi `if/else` theo type/style trong `_drawFrame()` ĐÃ BỎ. Nay:

- `event/workflow/visualizer-render.js` = HOST: vòng đời task, Show Visual, seek, resize, `applyStyle()` /
  `activateCurrentStyle()`, dựng **frame context** 1 lần/frame
  (`{ ctx, canvas, cfg, group, style, perf, isPlaying, beatScale, smoothedEnergy, hue, vizDataArray, analyser,
  bufferLength, dpr, lastBeatTime, midiNote }`), `clearRect` canvas 2D rồi gọi `styles[style](frame)` của group.
- `event/workflow/visualizer/<group>.js` = 1 file / group (bar, rain, lighting, shape, vortex, connector): trạng thái
  RIÊNG của group + `styles` + `defaultStyle` (style lạ -> mặc định) + hook vòng đời tuỳ chọn:
  `activate(style)`, `onResize(viewport)`, `onStyleApplied(viewport)`, `onSeek()`, `onNewMedia()`, `rebuild()`;
  `usesWebgl: true` nếu vẽ lên `#webgl-canvas`. Cuối file: `workflowVisualizerRender.registerGroup('<group>', ...)`.
- `event/workflow/visualizer/beat-window.js` + `core/visualizer/beat-window.js` = cửa sổ beat flux dùng chung (mỗi
  effect giữ 1 object riêng từ `createBeatFluxWindow()`).

**Khi thêm STYLE mới vào group có sẵn:** thêm hàm vẽ vào `styles` của file group + core vẽ trong
`core/visualizer/groups/<group>/`. **Khi thêm GROUP mới:** tạo file `event/workflow/visualizer/<group>.js` theo khuôn trên,
thêm thẻ `<script>` SAU `visualizer-render.js` (index.html), đăng ký group trong `EFFECT_GROUPS`/`MODES`
(service/state/visualizer-runtime.js). Cảnh phụ thuộc kích thước canvas dựng lại ở `onResize`, KHÔNG gắn listener resize riêng.

Phase 5 (28/09/2026): mọi core trong `core/visualizer/groups/**` + `core/webgl/*` là core thuần (không gọi core khác,
không `appState.get()`); builder scene (WebGL + cảnh 2D) trả dữ liệu, group workflow ghi appState. Renderer WebGL dùng chung
tạo qua `workflowVisualizerRender.ensureSharedRenderer(pixelRatio)`. Field Custom Effect kiểu `imagePick` (chọn ảnh thư viện,
null = nguồn mặc định) có sẵn cho effect khác dùng.

Vòng đời WebGL: resize CHỈ đổi camera/renderer/composer (`core/webgl/three-common.js`); dựng lại scene (Custom Effect
đổi số vòng/neuron...) PHẢI dispose scene cũ trước (`disposeThreeObjectTree`, composer, OrbitControls, texture).

## Ghi chú cho visual WebGL (Vortex, Space "Galaxy Journey") — bổ sung 21/07/2026

> (Đoạn dưới là ghi chú LỊCH SỬ trước 28/09/2026 — `VISUALIZER_DRAWERS`/`_tick()` nay đã thay bằng cấu trúc ở mục ngay trên; 4 nguyên tắc nền/màu/video vẫn giữ nguyên.)

`VISUALIZER_DRAWERS` (mục "Khi thêm visual mới" ở trên) ĐÃ DỜI sang
`event/workflow/visualizer-render.js` từ 20/07/2026 (plan-space-galaxy.md Phần A,
`core/visualizer/draw-visualizer.js` nay RỖNG) — đăng ký hàm vẽ 2D mới ở object đó thay vì file cũ.
2 visual dùng canvas WebGL riêng (`#webgl-canvas`, dùng CHUNG 1 `tRenderer`) KHÔNG nằm trong bảng
`VISUALIZER_DRAWERS` (xử lý riêng bằng `if/else` ngay trong `_tick()`), nhưng VẪN PHẢI tuân đủ 4
mục ở trên — cách áp dụng có khác biệt so với visual canvas 2D thường:

1. **Video nền** — TỰ ĐỘNG thoả mãn: `tRenderer` khởi tạo với `alpha: true`
   (`core/webgl/three-vortex.js`), scene KHÔNG set `scene.background`, nên phần khung hình không
   có mesh nào che phủ luôn trong suốt, video nền hiện xuyên qua bình thường — KHÔNG cần thêm
   `if (!videoBgEnabled)` như visual 2D.
2. **Màu nền** — TỰ ĐỘNG thoả mãn cùng lý do trên: nền THẬT SỰ là CSS/body (`updateDOMBackground()`
   theo `bgColor`), canvas WebGL trong suốt để lộ ra.
3. **Chế độ màu (`mode`)** — PHẢI tự áp dụng trong code sinh màu của visual, KHÔNG tự động như 2
   mục trên. FIX (21/07/2026, phản hồi Giang mục 4 — Space từng bỏ sót mục này, luôn dùng
   `dynA`/`dynB` bất kể `mode`): xem `pickGalaxyPalette()` (`core/webgl/three-space.js`) —
   `mode === 'solid'` dùng `solidColor` cho cả colorIn/colorOut, `dynamic`/`gradient` dùng
   `dynA`/`dynB` (gradient còn hue-shift theo `globalHueOffset` mỗi frame, xem
   `GalaxyCluster.update()`). Vortex hiện KHÔNG đổi màu theo `mode` (nợ kỹ thuật cũ, chưa đụng tới).
4. **Hiệu năng** — `PERFORMANCE_PROFILES` áp dụng bình thường (`galaxyStarsMin/Max`,
   `galaxyNebulaCount`, `galaxyDustCount` cho Space; `stars`/`tunnelRings` cho Vortex).

← [Quay lại README](../README.md)
