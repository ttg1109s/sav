# Quy ước BẮT BUỘC khi viết / sửa một effect Visualizer (ver 13)

> Viết lại 07/10/2026 theo cấu trúc hiện tại. Bản cũ (ver 6–11) mô tả `core/visualizer/types/*.js`,
> `VISUALIZER_DRAWERS`, `CONST.PERFORMANCE_PROFILES` và group Space/Galaxy — đều đã gỡ.

## 1. Cấu trúc: host + group + core vẽ

- **Host** — `event/workflow/visualizer-render.js` (`workflowVisualizerRender`): vòng đời task `visualizerRender`
  (mode `raf`), Show Visual, seek, resize, `applyStyle()`/`activateCurrentStyle()`. Mỗi frame dựng **frame context**
  1 lần rồi `clearRect` canvas 2D và gọi style của group:

  ```js
  const frame = { ctx, canvas, cfg, group, style, perf: { blurMult }, isPlaying, audio: audioAnalysis, dpr };
  ```

- **Group** — `event/workflow/visualizer/<group>.js`, 1 file/group (`bar`, `connector`, `lighting`, `rain`, `shape`,
  `vortex`): trạng thái riêng của group + `styles` + `defaultStyle` (style lạ → mặc định) + `spectrumSize(style)` + hook
  vòng đời tuỳ chọn `activate(style)`, `onResize(viewport)`, `onStyleApplied(viewport)`, `onSeek()`, `onNewMedia()`,
  `rebuild()`; `usesWebgl: true` nếu vẽ lên `#webgl-canvas`. Cuối file:
  `workflowVisualizerRender.registerGroup('<group>', ...)`.
- **Core vẽ** — `core/visualizer/groups/<group>/<style>.js` (+ `common.js` của group): core thuần, không gọi core
  khác, không `appState.get()`, không đọc kho `audioAnalysis` — group workflow đọc rồi truyền tham số.
- **Dùng chung** — `core/visualizer/effect-paint.js` (màu, blur), `core/visualizer/beat-window.js` +
  `event/workflow/visualizer/beat-window.js` (cửa sổ beat flux, mỗi effect giữ 1 object riêng từ
  `createBeatFluxWindow()`), `core/visualizer/tonotopic.js` (ánh xạ tần số), `core/visualizer/frame-clock.js`,
  `core/visualizer/draw/*.js` (nốt bay, giọt nước, khung cửa sổ, chớp màn).
- **WebGL** — `core/webgl/three-common.js` (camera/renderer/composer/dispose), `three-vortex.js`,
  `three-connector.js`. Renderer dùng chung tạo qua `workflowVisualizerRender.ensureSharedRenderer(pixelRatio)`.

**Thêm STYLE vào group có sẵn:** hàm vẽ vào `styles` của file group + core vẽ trong `core/visualizer/groups/<group>/`
+ tên style vào `EFFECT_GROUPS` (`service/state/visualizer-runtime.js`) + field Custom Effect nếu có.

**Thêm GROUP mới:** tạo `event/workflow/visualizer/<group>.js` theo khuôn trên, thêm thẻ `<script>` SAU
`event/workflow/visualizer-render.js` ([script-load-order.md](./script-load-order.md)), khai group trong `EFFECT_GROUPS`,
có `spectrumSize(style)` (thiếu thì host không xin được phổ, effect không vẽ). Cảnh phụ thuộc kích thước canvas dựng lại
ở `onResize`, KHÔNG gắn listener resize riêng.

Quy tắc rẽ nhánh và "Workflow không tự thi hành" áp cho cả group workflow — [event-bus-flow.md](./event-bus-flow.md)
mục 7 và 7b. Lệnh vẽ canvas và phép tính còn nằm trong group workflow là vi phạm, có trong
[sổ vi phạm](./core-legacy-audit.md).

## 2. Hợp đồng chung mọi effect

1. **Nền trong suốt.** Canvas Visualizer chỉ vẽ tiền cảnh; nền (màu đặc/gradient, ảnh, video của Visual Background)
   nằm ở các lớp DOM bên dưới (`#visual-bg-image`, `#bg-video`…). Effect không tô lớp nền đục phủ kín canvas — trừ khi
   chính lớp đó là một phần của hình (kính mưa, chớp màn, lõi hố đen) và có chủ đích.
2. **Màu theo Custom Effect của chính style.** Lấy màu qua `getComputedColor(i, total, value)`
   (`core/visualizer/effect-paint.js`) — trả `{ fill, fillNoAlpha, glow }` theo color mode `solid`/`dynamic`/`gradient`
   của effect đang chạy. Không hard-code màu. Đưa màu vào `THREE.Color` dùng `fillNoAlpha`.
3. **Blur/glow theo `frame.perf.blurMult`** (`getActiveBlurMult()`). Style không có khối Blur khai trong
   `CUSTOM_EFFECT_NO_BLUR_STYLES` (`core/custom-effect.js`).
4. **Giá trị Custom Effect không dùng chung giữa các style cùng group** (Giang chốt 25/09/2026) — chỉnh `maxH` ở
   mirror không được đổi ở cascade. Drawer chia thẻ theo loại cài đặt; trong thẻ thứ tự công tắc > dropdown > input >
   slider. Field đổi xong cần dựng lại scene khai trong `CUSTOM_EFFECT_REFRESH_BY_NAME`
   (`event/workflow/custom-effect.js`).
5. **Tính theo `dt`**, không theo số frame (`computeFrameDeltaMs()`, `core/visualizer/frame-clock.js`) — tốc độ không
   đổi theo tần số màn hình.

## 3. Đọc dữ liệu audio trong effect (chuẩn từ 01/10/2026)

- **Một cách đọc duy nhất:** `frame.audio.xxx()` — `frame.audio` là kho `audioAnalysis` (`service/audio-analysis.js`).
  Ví dụ: `frame.audio.beatScale()`, `frame.audio.smoothedEnergy()`, `frame.audio.hueOffset()`,
  `frame.audio.lastBeatTime()`, `frame.audio.pitchMidi()`, `frame.audio.isPitchFresh(ms)`, `frame.audio.bpmOr(fallback)`,
  `frame.audio.fluxHistory()`, `frame.audio.band('bass')`, `frame.audio.isBandOnset('bass', ms)`… (danh sách đầy đủ ở
  đầu `service/audio-analysis.js`).
- **Phổ để vẽ — group tự khai cỡ:** hằng số cạnh code group (`BAR_FFT_SIZE`/`BAR_MIRROR_FFT_SIZE`, `LIGHTING_FFT_SIZE`,
  `RAIN_FFT_SIZE`, `SHAPE_FFT_SIZE`, `VORTEX_FFT_SIZE`, `CONNECTOR_FFT_SIZE`) + `spectrumSize(style)`. Host xin đúng cỡ khi
  kích hoạt style (và tự khớp lại mỗi frame). Trong effect: `const spectrum = frame.audio.spectrum(VORTEX_FFT_SIZE);` —
  số bin = `spectrum.length`; cần minDecibels/maxDecibels/sampleRate thì `frame.audio.spectrumAnalyser(SIZE)`. Chỉ đọc
  cỡ style của mình đã khai (cỡ khác có thể `null`).
- Âm lượng người dùng không ảnh hưởng phân tích; EQ có ảnh hưởng (có chủ đích). Beat/energy/BPM dùng chung, không đổi
  theo FFT size của effect.

## 4. WebGL

- `#webgl-canvas` dùng chung 1 renderer (`alpha: true`, scene không set `scene.background`) — nền tự trong suốt, video/ảnh
  nền hiện xuyên qua.
- Resize CHỈ đổi camera/renderer/composer (`core/webgl/three-common.js`); dựng lại scene (Custom Effect đổi số vòng,
  số chip…) PHẢI dispose scene cũ trước (`disposeThreeObjectTree`, composer, OrbitControls, texture).
- Color mode phải tự áp trong code sinh màu của scene (không tự động như nền).

← [Quay lại README](../README.md)
