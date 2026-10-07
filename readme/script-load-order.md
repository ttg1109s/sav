# Thứ tự nạp script

> **Nguồn chuẩn:** các thẻ `<script>`/`<link>` thật trong `index.html`, `subtitle-editor.html`, `video-editor.html`
> tại mốc 07/10/2026 (chốt v13). Ba trang **không còn comment nào** — mọi giải thích về thứ tự nạp, khung DOM tĩnh và
> khối `<script>` inline đều nằm ở tài liệu này. Sửa thứ tự nạp ở trang nào thì cập nhật file này cùng lượt.
>
> Danh sách bên dưới sinh từ thẻ thật của 3 trang, không gõ tay. Cột "cần" là **phụ thuộc lúc nạp** đo bằng phân tích
> mã: file đó dùng biến toàn cục của file kia ngay khi chạy (code cấp module hoặc IIFE), không tính lời gọi bên trong
> hàm. Tại mốc chốt, cả 3 trang có **0 vi phạm** (mọi file "cần" đều đứng trước).

## 1. Nguyên tắc chung

- **Script cổ điển, đồng bộ.** Không thẻ nào dùng `async`/`defer`/`type="module"` (lý do: [why-no-es6-module.md](./why-no-es6-module.md),
  app chạy được cả qua `file://`). Script chạy đúng thứ tự xuất hiện; biến cấp module của file trước là biến toàn cục
  cho file sau.
- **Hai loại phụ thuộc, hai mức ràng buộc.**
  - *Lúc nạp* (template `TPL_*` gọi `t()`/`iconSvg()`, router gọi `eventBus.register()`, listener đọc ref DOM và gắn sự
    kiện, `AppState` mở rộng domain…): file được dùng **bắt buộc** đứng trước. Đây là các mục ghi "cần" bên dưới.
  - *Lúc chạy* (lời gọi bên trong hàm): chỉ cần file đã có mặt trước khi hàm được gọi. Với `index.html`, mọi luồng
    nghiệp vụ bắt đầu từ `DOMContentLoaded` → `app.boot`, lúc đó toàn bộ script đã nạp xong, nên thứ tự giữa các file
    chỉ có phụ thuộc lúc chạy là tự do — đặt theo nhóm để dễ đọc.
- **Cache-bust `?v=`.** Mỗi file nội bộ mang `?v=<yyyymmdd><hậu tố>`. Đổi nội dung file thì nâng `?v=` ở **mọi trang
  có nạp file đó** — cùng 1 file phải cùng 1 `?v=` trên cả 3 trang (07/10/2026 đã đồng bộ lại 17 file lệch giữa các
  trang). Thư viện CDN tự mang version trong URL, không dùng `?v=`.
- **Thêm file mới — đặt ở đâu:**
  | Loại file | Vị trí |
  |---|---|
  | `lang/patch/*.js` mới | Trong khối i18n, trước `lang/lang.js`, và nạp ở **cả 3 trang** (`lang.js` gộp cứng mọi `LANG_PATCH_*`, thiếu 1 file là `lang.js` vỡ ngay khi nạp) |
  | `components/*.js` | Khối Components, trước `main.js`; component nội suy `TPL_*` của component khác thì đứng sau nó |
  | `service/state/<domain>.js` | Khối State, sau `service/state.js` |
  | `core/*.js` | Khối Core; nếu dùng biến cấp module của file khác lúc nạp thì đứng sau file đó |
  | Cụm `event/` | Khối Cụm sự kiện, đúng thứ tự `workflow → router → listener` (router cần `eventBus`, listener cần workflow/ref DOM lúc nạp) |
- **`core/workers/`** không nạp bằng thẻ `<script>`: workflow tạo Worker từ file khi cần. Worker nằm ngoài kiến trúc
  (Giang chốt 07/10/2026).

## 2. `index.html`

### 2.1 `<head>`

Chỉ có meta, tiêu đề và icon — không script/CSS nào, để không chờ mạng trước khi vẽ Preloader.

- `viewport`: `width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no`. **Không** dùng
  `viewport-fit=cover` — đã thử và bỏ: lệch layout khi bàn phím/thanh Safari trượt (chỉ hết sau Restart App ở chế độ
  Add to Home Screen). Trình duyệt tự chừa vùng notch.
- `theme-color` cố định `#000000`, khai 3 lần (không scope + scope `light` + scope `dark`) vì một số bản Safari chỉ
  áp thẻ có scope. Vùng này do trình duyệt vẽ, CSS không can thiệp; riêng Morphin, Preloader tô lại lúc boot (2.2).
- `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style=black`.
- `apple-mobile-web-app-title` và `<title>` đều là **"Audivis"** (đổi 06/10/2026). Tên phải ngắn: SpringBoard iOS thiếu
  chỗ sẽ tự xoá dấu cách rồi mới cắt "…" (gốc lỗi "tên dính liền" thời "Simple Audio Visualizer").
- `favicon.png` (nền trong suốt) và `apple-touch-icon.png` (180×180, **full-bleed nền đặc, không tự bo góc** — iOS tô
  pixel trong suốt thành đen rồi áp mask bo góc riêng). iOS bỏ qua `favicon.png` khi tạo icon màn hình chính, nên
  phải có thẻ `apple-touch-icon` riêng.

### 2.2 Preloader — đầu `<body>`, trước mọi script khác

- `<body>` mang `data-uitk="textPrimary appBaseBg themeVars"`: màu chữ, nền gốc và biến CSS theo UI Theme (gán bởi
  `applyUiThemeToDom()`). Dùng `appBaseBg` chứ không `panelBg` vì `panelBg` của Morphin là kính có `backdrop-filter`.
- `<style>` inline + khối `#app-preloader` (logo tĩnh, tên "Audivis", 8 chấm) vẽ ngay, không chờ file nào.
- `<script>` inline (IIFE):
  - Đọc **đồng bộ** `localStorage['uiThemeName']` (bản sao của theme thật trong IndexedDB, ghi bởi
    `event/workflow/ui-theme.js`): `dark`/`morphin` → class `app-preloader-dark`; `morphin` thêm `app-preloader-morphin`,
    lấy nền thật từ `localStorage['uiThemeBoot']` (`{preloaderBg, statusBar}`, ghi bởi
    `workflowUiTheme._mirrorBootBackdrop()`), tô `<body>` và 3 thẻ `theme-color` để status bar iOS khớp ngay. Preloader
    chạy trước mọi file JS nên không đợi được IndexedDB. Lỗi `localStorage` (Private Mode) → giữ Light.
  - Lộ `window.markPlaylistBootReady()` — `event/workflow/app-boot.js` gọi khi Playlist render xong (boot xong = tải
    xong, không đo %). Phải lộ qua `window` vì file nạp sau không gọi được closure của khối inline.
  - Lưới an toàn: 10 giây chưa nhận tín hiệu thì tự ẩn (tránh kẹt Preloader vĩnh viễn khi boot lỗi). Ẩn = thêm class
    fade rồi gỡ phần tử sau 400 ms.
  - Khối này dùng `setTimeout` thô: chạy trước `service/task-manager.js` nên không có `taskManager`.

3. [CSS] `(style inline #1)`
4. `(script inline #1)`

### 2.3 CSS và thư viện ngoài

- `assets/css/tailwind.css` (Tailwind v3 build sẵn, thay Play CDN từ 24/09/2026 — xem [tailwind-build.md](./tailwind-build.md);
  thêm class Tailwind chưa từng dùng thì phải build lại). Đứng **trước** mọi CSS của project để CSS project ghi đè được
  class tiện ích — giữ đúng thứ tự cascade của bản CDN cũ.
- Thư viện CDN, giữ nguyên thứ tự tương đối:
  | Thư viện | Dùng cho |
  |---|---|
  | jsmediatags 3.9.5 | Đọc tag ID3/cover lúc upload |
  | NoSleep 0.12 | Dự phòng giữ màn hình sáng khi không có Wake Lock API |
  | three.js r128 + OrbitControls, EffectComposer, RenderPass, ShaderPass, CopyShader, LuminosityHighPassShader, UnrealBloomPass | WebGL: vortex và connector (camera orbit + bloom) |
  | GSAP 3.12 | Tween camera connector |
  | idb-keyval 6 | Kho khoá–giá trị trên IndexedDB |
  | browser-id3-writer 4 | Ghi ID3 khi xuất file (jsmediatags chỉ đọc) |
  | zip.js 2.7.62 (no-worker) | Đường **duy nhất** tạo `.zip` (stream vào OPFS); JSZip đã bỏ 10/09/2026 |
  | flickr-justified-gallery 2.1 (CSS + JS) | Lưới ảnh justified |
  | Panzoom 4.6 | Pan/pinch-zoom modal xem ảnh |
- CSS project theo miền: `base`, `sliders`, `glass`, `animations`, `layout-nav`, `photo-gallery`, `video-gallery`,
  `misc`, `motion-engine`, `gameplay`, `recorder`, `perf-hud`, `game-panel`. `video-preview.css` chỉ nạp ở
  `video-editor.html`.

<details><summary>Thứ tự (31 mục)</summary>

5. [CSS] `assets/css/tailwind.css`
6. [CDN] `https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js`
7. [CDN] `https://cdnjs.cloudflare.com/ajax/libs/nosleep/0.12.0/NoSleep.min.js`
8. [CDN] `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`
9. [CDN] `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js`
10. [CDN] `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/EffectComposer.js`
11. [CDN] `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/RenderPass.js`
12. [CDN] `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/ShaderPass.js`
13. [CDN] `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/CopyShader.js`
14. [CDN] `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/shaders/LuminosityHighPassShader.js`
15. [CDN] `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/postprocessing/UnrealBloomPass.js`
16. [CDN] `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js`
17. [CDN] `https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js`
18. [CDN] `https://cdn.jsdelivr.net/npm/browser-id3-writer@4/dist/browser-id3-writer.js`
19. [CDN] `https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.62/dist/zip-no-worker.min.js`
20. [CSS] `https://cdn.jsdelivr.net/npm/flickr-justified-gallery@2.1/dist/fjGallery.css`
21. [CDN] `https://cdn.jsdelivr.net/npm/flickr-justified-gallery@2.1/dist/fjGallery.min.js`
22. [CDN] `https://cdn.jsdelivr.net/npm/@panzoom/panzoom@4.6.2/dist/panzoom.min.js`
23. [CSS] `assets/css/base.css`
24. [CSS] `assets/css/sliders.css`
25. [CSS] `assets/css/glass.css`
26. [CSS] `assets/css/animations.css`
27. [CSS] `assets/css/layout-nav.css`
28. [CSS] `assets/css/photo-gallery.css`
29. [CSS] `assets/css/video-gallery.css`
30. [CSS] `assets/css/misc.css`
31. [CSS] `assets/css/motion-engine.css`
32. [CSS] `assets/css/gameplay.css`
33. [CSS] `assets/css/recorder.css`
34. [CSS] `assets/css/perf-hud.css`
35. [CSS] `assets/css/game-panel.css`

</details>

### 2.4 Khung DOM tĩnh (nằm giữa CSS và script nội bộ)

```
#visualizer-stage                    lớp cha CHUNG của toàn bộ sân khấu Visualizer (div thường, không position/transform/z-index
│                                    -> không tạo containing block/stacking context mới). Về Playlist (<1024px) chỉ ẩn lớp này
│                                    và tạm dừng 2 task audioAnalysis + visualizerRender (05/10/2026).
├── #video-player-motion-pointmove   lớp Point Move của Video Player
│   └── video#bg-video               video nền / Video Player (loop muted playsinline). Video giải mã phần cứng trên iOS nằm ở
│                                    layer riêng, CSS không đè lên được -> lớp dự phòng đặt ở #visual-bg-image bên dưới.
├── #visualizer-solid-bg             nền màu Visualizer (bgColor) — tách khỏi <body> để màu không tràn vào status bar
├── #visual-bg-image                 ảnh nền tĩnh VBG (core/visual-bg-photo.js::applyVisualBgImageToDOM)
├── #player-zoom-layer               zoom/pan của người dùng (event/workflow/player-zoom.js), nằm NGOÀI Motion
│   └── #visual-motion-react         lớp React Beat dùng chung (.me-beat-react .me-transition-scope)
│       └── #visual-bg-photo-motion-container   Motion của VBG Photo: 2 lớp ảnh A/B (motion-layer + me-pointmove-pan)
├── canvas#webgl-canvas              canvas WebGL dùng chung (three.js)
└── canvas#visualizer                canvas 2D cho mọi effect còn lại
#app-root                            main.js lắp toàn bộ TPL_* vào đây
audio#audio-player                   phần tử phát Song (ẩn)
```

`.me-transition-scope` là điều kiện để transition CSS của Motion chạy: phần tử mang class này nhận `data-transition`
và hướng (`setMotionEngineTransitionType()`/`setMotionEngineTransitionDirections()`, `core/motion-engine.js`).

### 2.5 Bắt log sớm

`core/debug-console.js` là script nội bộ **đầu tiên**: bọc `console.log/warn/error` để Debug Console (Troubleshooting)
thu được log của mọi file nạp sau. Không phụ thuộc gì.

> `index.html` hiện **không** đăng ký `window.onerror`/`unhandledrejection` toàn cục. Khối bắt lỗi cũ đã gỡ;
> `core/fatal-error.js` vẫn được nạp ở khối 2.9 nhưng **không còn dòng code nào** (chỉ còn comment).

36. `core/debug-console.js`

### 2.6 i18n

9 file `lang/patch/*.js` (mỗi file khai 1 biến `LANG_PATCH_*`, thứ tự giữa chúng tự do) rồi `lang/lang.js` gộp bằng
`Object.assign()` và định nghĩa `t()`/`tFormat()`. Phải đứng trước mọi component vì template `TPL_*` gọi `t()` ngay lúc
nạp. Các hàm cần IndexedDB của `lang.js` chỉ chạy khi người dùng thao tác.

37. `lang/patch/patch-common.js`
38. `lang/patch/patch-playlist.js`
39. `lang/patch/patch-visualizer.js`
40. `lang/patch/patch-subtitle-settings.js`
41. `lang/patch/patch-settings-misc.js`
42. `lang/patch/patch-file-manager.js`
43. `lang/patch/patch-subtitle-editor.js`
44. `lang/patch/patch-video-preview.js`
45. `lang/patch/patch-app-panel-nav.js`
46. `lang/lang.js` — cần: mọi `lang/patch/*.js` (LANG_PATCH_*)

### 2.7 Icon

`components/icons.js` (chỉ dữ liệu `ICON_REGISTRY`) rồi `core/ui-theme/icon-svg-ui.js` (`iconSvg()`, ngoại lệ Rule 3e).
Đứng trước mọi component vì nhiều template gọi `iconSvg()` lúc nạp.

47. `components/icons.js`
48. `core/ui-theme/icon-svg-ui.js`

### 2.8 Components

Mỗi file chỉ định nghĩa `TPL_*` (chuỗi HTML tĩnh) hoặc hàm `render*()` trả chuỗi — chưa đụng DOM. Ràng buộc nội bộ:
`gameplay-overlay.js` và `recorder-overlay.js` trước `visualizer-overlay.js` (nội suy `TPL_GAMEPLAY_OVERLAY`,
`TPL_RECORDER_OVERLAY`); `core/google-fonts-list.js` trước `element-style-editor-drawer.js` (đọc `listGoogleFont`).

<details><summary>Thứ tự (37 mục)</summary>

49. `components/loading-shield.js` — cần: `lang/lang.js` (t)
50. `components/app-view-stack.js`
51. `components/playlist-view.js` — cần: `lang/lang.js` (t); `core/ui-theme/icon-svg-ui.js` (iconSvg)
52. `components/gameplay-overlay.js` — cần: `core/ui-theme/icon-svg-ui.js` (iconSvg)
53. `components/recorder-overlay.js` — cần: `lang/lang.js` (t); `core/ui-theme/icon-svg-ui.js` (iconSvg)
54. `components/zip-download-parts.js`
55. `components/visualizer-overlay.js` — cần: `lang/lang.js` (t); `core/ui-theme/icon-svg-ui.js` (iconSvg); `components/gameplay-overlay.js` (TPL_GAMEPLAY_OVERLAY); `components/recorder-overlay.js` (TPL_RECORDER_OVERLAY)
56. `components/bottom-player.js` — cần: `lang/lang.js` (t); `core/ui-theme/icon-svg-ui.js` (iconSvg)
57. `components/playlist-sort-drawer.js`
58. `components/playlist-filter-drawer.js`
59. `components/app-bottom-nav.js` — cần: `core/ui-theme/icon-svg-ui.js` (iconSvg); `lang/lang.js` (t)
60. `components/settings/playlist-view.js` — cần: `lang/lang.js` (t); `core/ui-theme/icon-svg-ui.js` (iconSvg)
61. `components/settings/language.js` — cần: `lang/lang.js` (t); `core/ui-theme/icon-svg-ui.js` (iconSvg)
62. `components/settings/app-settings-main.js`
63. `components/settings/troubleshooting.js`
64. `components/perf-hud.js`
65. `components/game-panel.js` — cần: `lang/lang.js` (t); `core/ui-theme/icon-svg-ui.js` (iconSvg)
66. `components/statis-panel.js` — cần: `lang/lang.js` (t); `core/ui-theme/icon-svg-ui.js` (iconSvg)
67. `components/debug-console-drawer.js`
68. `components/file-manager-storage.js`
69. `components/generic-drawer.js`
70. `components/eq-presets-drawer.js`
71. `components/custom-effect-drawer.js`
72. `core/google-fonts-list.js`
73. `components/element-style-editor-drawer.js`
74. `components/items.js`
75. `components/settings/visualizer-display-panel.js`
76. `components/settings/visualizer-auto-switch-drawer.js`
77. `components/subtitle-settings-drawer.js`
78. `components/motion-settings-drawer.js`
79. `components/visual-bg-settings-drawer.js`
80. `components/visual-bg-gradient-drawer.js`
81. `components/visual-bg-video-audio-drawer.js`
82. `components/settings/player-display-settings.js`
83. `components/settings/recorder-settings.js`
84. `components/settings/pagination.js`
85. `components/gesture-settings-drawer.js`

</details>

### 2.9 `main.js`

Lắp các `TPL_*` vào `#app-root`. Từ đây mọi phần tử có `id` mới tồn tại thật, nên `core/dom-refs.js` và listener
(đọc ref DOM lúc nạp) phải đứng sau.

86. `main.js` — cần: `components/loading-shield.js` (TPL_LOADING_SHIELD); `components/app-view-stack.js` (TPL_APP_VIEW_STACK_OPEN, TPL_APP_VIEW_STACK_CLOSE_SIDE, TPL_APP_VIEW_STACK_CLOSE_OUTER); `components/playlist-view.js` (TPL_PLAYLIST_VIEW); `components/app-bottom-nav.js` (TPL_APP_BOTTOM_NAV); `components/game-panel.js` (TPL_GAME_PANEL); `components/statis-panel.js` (TPL_STATIS_PANEL); `components/bottom-player.js` (TPL_BOTTOM_PLAYER); `components/generic-drawer.js` (TPL_GENERIC_DRAWER); `components/visualizer-overlay.js` (TPL_VISUALIZER_OVERLAY)

### 2.10 Nền dùng chung

`service/z-index.js` (bảng z-index tập trung) trước mọi core dùng `Z_INDEX`; các modal dùng chung tự dựng DOM
(`modal-choice-ui`, `info-icon-ui`, `time-picker-modal`, `slider-input-modal`) nạp sớm vì nhiều nơi gọi;
`event/listener/app-boot.js` đăng ký `DOMContentLoaded` → `app.boot` (gửi qua bus khi sự kiện xảy ra, lúc đó mọi file
đã nạp).

87. `service/z-index.js`
88. `core/modal-choice-ui.js`
89. `core/info-icon-ui.js`
90. `core/time-picker-modal.js`
91. `core/slider-input-modal.js`
92. `core/fatal-error.js`
93. `event/listener/app-boot.js`

### 2.11 State và cấu hình

`service/operation.js` (toán tử dùng chung cho Block/VMState), `service/state.js` (lõi `AppState`/`appState`,
`AppConfig`) rồi các package `service/state/*.js` (mỗi file mở rộng `AppState` lúc nạp), `service/audio-analysis.js`
(kho `audioAnalysis`), cuối cùng `core/config.js` (khởi tạo `appConfig` các domain lúc nạp).

<details><summary>Thứ tự (29 mục)</summary>

94. `service/operation.js`
95. `service/state.js`
96. `service/state/playlist.js` — cần: `service/state.js` (AppState)
97. `service/state/player.js` — cần: `service/state.js` (AppState)
98. `service/state/visualizer-runtime.js` — cần: `service/state.js` (AppState)
99. `service/state/visualizer-scenes.js` — cần: `service/state.js` (AppState)
100. `service/state/three-vortex.js` — cần: `service/state.js` (AppState)
101. `service/state/three-connector.js` — cần: `service/state.js` (AppState)
102. `service/state/audio-engine.js` — cần: `service/state.js` (AppState)
103. `service/audio-analysis.js`
104. `service/state/subtitle.js` — cần: `service/state.js` (AppState)
105. `service/state/shuffle-repeat.js` — cần: `service/state.js` (AppState)
106. `service/state/visual-bg.js` — cần: `service/state.js` (AppState)
107. `service/state/video-player-mode.js` — cần: `service/state.js` (AppState)
108. `service/state/photo-player-mode.js` — cần: `service/state.js` (AppState)
109. `service/state/player-zoom.js` — cần: `service/state.js` (AppState)
110. `service/state/wakelock-tab.js` — cần: `service/state.js` (AppState)
111. `service/state/auto-switch.js` — cần: `service/state.js` (AppState)
112. `service/state/listen-stats.js` — cần: `service/state.js` (AppState)
113. `service/state/app-misc.js` — cần: `service/state.js` (AppState)
114. `service/state/file-manager.js` — cần: `service/state.js` (AppState)
115. `service/state/generic-drawer.js` — cần: `service/state.js` (AppState)
116. `service/state/app-panel-nav.js` — cần: `service/state.js` (AppState)
117. `service/state/element-style-editor.js` — cần: `service/state.js` (AppState)
118. `service/state/gameplay-runtime.js` — cần: `service/state.js` (AppState)
119. `service/state/recorder.js` — cần: `service/state.js` (AppState)
120. `service/state/motion-presets.js` — cần: `service/state.js` (AppState)
121. `service/state/record/index.js` — cần: `service/state.js` (appState)
122. `core/config.js` — cần: `service/state.js` (AppConfig, appConfig)

</details>

### 2.12 Core

Phần lớn chỉ khai báo hàm. Xen giữa có vài file không thuộc `core/`, đặt cạnh nơi dùng:
`event/store.js` (`EventStore` — `core/playlist/actions.js` tạo store lúc nạp), `core/dom-refs.js` (ref DOM + biến
runtime, cần `main.js`), `service/task-manager.js`, `service/db.js`, `service/component-dynamic.js`,
`service/blob-url.js`, `service/song-key-cipher.js`, `event/workflow/generic-drawer-helpers.js`,
`event/workflow/media-transform-helpers.js`, `lang/language-settings.js` — các file này không có ràng buộc lúc nạp với
core xung quanh. Nhóm visualizer: `core/visualizer/*` rồi `core/visualizer/groups/<group>/common.js` trước style của
group.

<details><summary>Thứ tự (138 mục)</summary>

123. `core/custom-effect.js`
124. `core/custom-effect-drawer-ui.js`
125. `core/element-style-editor.js`
126. `event/store.js`
127. `core/dom-refs.js`
128. `core/slider-panel-scroll.js`
129. `core/sav-logo.js`
130. `service/task-manager.js`
131. `service/db.js`
132. `service/component-dynamic.js`
133. `service/blob-url.js`
134. `service/song-key-cipher.js`
135. `core/file-manager/folder.js`
136. `core/file-manager/folder-picker-ui.js`
137. `core/pagination.js`
138. `core/pagination-ui.js`
139. `core/file-manager/image.js`
140. `core/file-manager/photo-ui.js`
141. `core/media-picker-drawer-ui.js`
142. `core/photo-editor-engine.js`
143. `core/media-transform.js`
144. `core/file-manager/video.js`
145. `core/ui-theme/light.js`
146. `core/ui-theme/dark.js`
147. `core/ui-theme/morphin.js`
148. `core/ui-theme/registry.js` — cần: `core/ui-theme/light.js` (UI_THEME_LIGHT); `core/ui-theme/dark.js` (UI_THEME_DARK); `core/ui-theme/morphin.js` (UI_THEME_MORPHIN)
149. `core/ui-theme/apply-ui.js` — cần: `core/ui-theme/light.js` (UI_THEME_LIGHT)
150. `core/ui-theme/status-bar-color.js`
151. `core/generic-drawer.js` — cần: `service/z-index.js` (Z_INDEX)
152. `event/workflow/generic-drawer-helpers.js`
153. `core/app-panel-nav.js`
154. `core/placeholder-panel.js`
155. `core/app-settings-ui.js`
156. `core/settings-carousel-ui.js`
157. `event/workflow/media-transform-helpers.js`
158. `core/dropdown-menu.js`
159. `core/file-manager/cleanup.js`
160. `core/motion-engine.js`
161. `core/motion-presets.js`
162. `core/player-display-settings.js`
163. `core/player-display-apply.js`
164. `core/point-move-timing-ui.js`
165. `core/upload-validation.js`
166. `core/listen-stats.js`
167. `core/loading-shield-util.js`
168. `core/webgl/three-vortex.js`
169. `core/webgl/three-connector.js`
170. `core/webgl/three-common.js`
171. `core/visualizer-control-center.js`
172. `core/visualizer-gesture.js`
173. `core/player-zoom.js`
174. `core/number-countup.js`
175. `core/gameplay/engine.js`
176. `core/gameplay/engine-ui.js`
177. `core/gameplay/circle-mode.js`
178. `core/gameplay/circle-mode-ui.js`
179. `core/gameplay/catalog.js`
180. `core/gameplay/game-panel-ui.js`
181. `core/statis-panel-ui.js`
182. `core/hud.js`
183. `core/visual-bg-common.js`
184. `core/visual-bg-video.js`
185. `core/visual-bg-photo.js`
186. `core/subtitle/subtitle-transition.js`
187. `core/subtitle/subtitle-style-settings.js`
188. `core/subtitle/subtitle-display-ui.js`
189. `core/subtitle/subtitle-karaoke.js`
190. `core/subtitle/subtitle-karaoke-display.js`
191. `core/subtitle/subtitle-karaoke-display-ui.js`
192. `core/wakelock.js`
193. `core/color-utils.js`
194. `core/canvas-scene-setup.js`
195. `core/song-search.js`
196. `core/playlist/state.js`
197. `core/playlist/order.js`
198. `core/playlist/render.js`
199. `core/playlist/loader.js`
200. `core/playlist/actions.js` — cần: `event/store.js` (EventStore); `core/playlist/render.js` (attachCoverFallback); `core/dom-refs.js` (songEditCoverPreview)
201. `core/playlist/main.js` — cần: `service/state.js` (appState); `core/dom-refs.js` (genericDrawerBody)
202. `core/playlist/filter.js`
203. `core/playlist/filter-presets.js`
204. `core/playlist/scope.js`
205. `core/playlist/selection.js`
206. `core/playlist/bulk-actions.js`
207. `core/player-controls.js`
208. `core/video-player.js`
209. `core/photo-player.js`
210. `core/video-player-capture.js`
211. `core/eq-presets.js`
212. `core/audio-engine.js`
213. `core/recorder.js`
214. `core/recorder-ui.js`
215. `core/perf-hud.js`
216. `core/perf-hud-ui.js`
217. `core/visualizer-ui-visibility.js`
218. `core/audio-analysis.js`
219. `core/visualizer/effect-paint.js`
220. `core/visualizer/stats-bar.js`
221. `core/audio-tempo.js`
222. `core/rubik-math.js`
223. `core/about-stats.js`
224. `core/app-recovery.js`
225. `lang/language-settings.js`
226. `core/large-file-download.js`
227. `core/id3-export.js`
228. `core/streaming-zip.js`
229. `core/storage-manager.js`
230. `core/zip-download-ui.js`
231. `core/visualizer/visualizer-display.js`
232. `core/auto-switch-visual.js`
233. `core/visualizer/draw/water-drop.js`
234. `core/visualizer/draw/window-frame.js`
235. `core/visualizer/draw/flying-note-ui.js`
236. `core/visualizer/beat-window.js`
237. `core/visualizer/frame-clock.js`
238. `core/visualizer/tonotopic.js`
239. `core/visualizer/draw/screen-flash.js`
240. `core/visualizer/draw/screen-flash-alpha.js`
241. `core/visualizer/groups/bar/common.js`
242. `core/visualizer/groups/bar/mirror.js`
243. `core/visualizer/groups/bar/cascade.js`
244. `core/visualizer/groups/bar/dot.js`
245. `core/visualizer/groups/bar/black-hole.js`
246. `core/visualizer/groups/shape/common.js`
247. `core/visualizer/groups/shape/rubik.js`
248. `core/visualizer/groups/shape/clock.js`
249. `core/visualizer/groups/vortex/common.js`
250. `core/visualizer/groups/vortex/rings.js`
251. `core/visualizer/groups/vortex/bars.js`
252. `core/visualizer/groups/vortex/wave.js`
253. `core/visualizer/groups/rain/common.js`
254. `core/visualizer/groups/rain/glass.js`
255. `core/visualizer/groups/rain/street.js`
256. `core/visualizer/groups/lighting/common.js`
257. `core/visualizer/groups/lighting/thunder.js`
258. `core/visualizer/groups/lighting/fireworks.js`
259. `core/visualizer/groups/connector/common.js`
260. `core/visualizer/groups/connector/circuit.js`

</details>

### 2.13 Workflow vòng render và phân tích audio

`event/workflow/audio-engine.js` (dựng audio graph, khởi động vòng lặp), `audio-analysis.js`, `visualizer-render.js`
(host 2 task `raf`), rồi workflow theo group `event/workflow/visualizer/*.js` — mỗi file tự đăng ký vào
`workflowVisualizerRender` lúc nạp nên phải đứng sau host. Các file này chạy ngoài Listener→Router (vòng `raf` tự nuôi,
xem [event-bus-flow.md](./event-bus-flow.md) mục 1).

261. `event/workflow/audio-engine.js`
262. `event/workflow/audio-analysis.js` — cần: `core/audio-tempo.js` (createOnsetEnvelope, TEMPO_ENVELOPE_CAPACITY, TEMPO_WINDOW_MS…); `core/audio-analysis.js` (AUDIO_FEATURE_BANDS, AUDIO_FEATURE_RING_CAPACITY)
263. `event/workflow/visualizer-render.js`
264. `event/workflow/visualizer/beat-window.js`
265. `event/workflow/visualizer/bar.js` — cần: `core/visualizer/groups/bar/dot.js` (DOT_VIB_SLOTS); `core/visualizer/beat-window.js` (createBeatFluxWindow); `event/workflow/visualizer-render.js` (workflowVisualizerRender)
266. `event/workflow/visualizer/rain.js` — cần: `event/workflow/visualizer-render.js` (workflowVisualizerRender)
267. `event/workflow/visualizer/lighting.js` — cần: `core/visualizer/beat-window.js` (createBeatFluxWindow); `event/workflow/visualizer-render.js` (workflowVisualizerRender)
268. `event/workflow/visualizer/shape.js` — cần: `event/workflow/visualizer-render.js` (workflowVisualizerRender)
269. `event/workflow/visualizer/vortex.js` — cần: `core/visualizer/beat-window.js` (createBeatFluxWindow); `event/workflow/visualizer-render.js` (workflowVisualizerRender)
270. `event/workflow/visualizer/connector.js` — cần: `core/visualizer/beat-window.js` (createBeatFluxWindow); `event/workflow/visualizer-render.js` (workflowVisualizerRender)

### 2.14 Hạ tầng sự kiện

`event/bus.js` (`eventBus`), `event/block.js` (đăng ký Block gate lúc nạp), `event/virtual-machine-state.js`.
Phải đứng trước mọi router.

271. `event/bus.js`
272. `event/block.js` — cần: `event/bus.js` (eventBus); `lang/lang.js` (t)
273. `event/virtual-machine-state.js`

### 2.15 Cụm sự kiện

Mỗi cụm theo đúng `workflow → router → listener`: router gọi `eventBus.register()` lúc nạp; listener đọc ref DOM và gắn
sự kiện lúc nạp (cần `core/dom-refs.js`, đôi khi cần workflow của cụm). Workflow dùng chung nhiều cụm (vd
`playlist-order`, `playlist-render`, `playlist-scope`, `motion-*-runner`, `motion-stage`, `video-motion-surface`,
`number-countup`) đứng trước cụm đầu tiên dùng tới; `visual-bg-common.js` trước `visual-bg-video.js`/`visual-bg-photo.js`
(2 file này mở rộng `workflowVisualBg` lúc nạp).

<details><summary>Thứ tự (140 mục)</summary>

274. `event/workflow/info-icon.js`
275. `event/router/info-icon.js` — cần: `event/bus.js` (eventBus)
276. `event/listener/info-icon.js`
277. `event/router/generic-drawer.js` — cần: `event/bus.js` (eventBus)
278. `event/listener/generic-drawer.js` — cần: `core/dom-refs.js` (genericDrawerBody)
279. `core/settings-misc-ui.js`
280. `event/workflow/settings-misc.js`
281. `event/router/settings-misc.js` — cần: `event/bus.js` (eventBus)
282. `event/listener/settings-misc.js` — cần: `core/dom-refs.js` (btnLoadingShieldDebug, btnRestartApp)
283. `event/workflow/playlist-order.js`
284. `event/workflow/playlist-render.js`
285. `event/workflow/playlist-scope.js` — cần: `service/db.js` (getAllSongRecords, getSongRecordsByKeys, getAllVideoRecords…)
286. `event/workflow/filter-rule-edit.js`
287. `event/workflow/playlist-filter-presets.js`
288. `event/router/playlist-filter-presets.js` — cần: `event/bus.js` (eventBus)
289. `event/listener/playlist-filter-presets.js` — cần: `core/dom-refs.js` (genericDrawerBody)
290. `event/workflow/zip-download.js` — cần: `core/upload-validation.js` (MEDIA_FILE_MAX_BYTES)
291. `event/router/zip-download.js` — cần: `event/bus.js` (eventBus)
292. `event/workflow/media-in-use.js`
293. `event/router/media-in-use.js` — cần: `event/bus.js` (eventBus)
294. `event/workflow/file-manager-storage.js`
295. `event/router/file-manager-storage.js` — cần: `event/bus.js` (eventBus)
296. `event/workflow/file-manager-folder-browser.js` — cần: `core/ui-theme/icon-svg-ui.js` (iconSvg)
297. `event/router/file-manager-folder-browser.js` — cần: `event/bus.js` (eventBus)
298. `event/listener/file-manager-storage.js` — cần: `core/dom-refs.js` (genericDrawerBody)
299. `event/workflow/visual-bg-photo-motion.js`
300. `event/workflow/motion-presets.js`
301. `event/router/motion-presets.js` — cần: `event/bus.js` (eventBus)
302. `event/listener/motion-presets.js` — cần: `core/dom-refs.js` (genericDrawerBody, genericDrawerHeader)
303. `event/workflow/motion-transition-runner.js`
304. `event/workflow/motion-point-move-runner.js`
305. `event/workflow/motion-beat-react-runner.js`
306. `event/workflow/motion-stage.js`
307. `event/workflow/video-motion-surface.js`
308. `event/workflow/player-display-settings.js`
309. `event/workflow/pagination.js`
310. `event/workflow/visual-bg-common.js`
311. `event/workflow/visual-bg-video.js` — cần: `event/workflow/visual-bg-common.js` (workflowVisualBg)
312. `event/workflow/visual-bg-photo.js` — cần: `event/workflow/visual-bg-common.js` (workflowVisualBg)
313. `event/router/visual-bg.js` — cần: `event/bus.js` (eventBus)
314. `event/listener/visual-bg.js` — cần: `core/dom-refs.js` (genericDrawerBody, bgVideoElement)
315. `event/workflow/gesture-settings.js`
316. `event/router/gesture-settings.js` — cần: `event/bus.js` (eventBus)
317. `event/listener/gesture-settings.js` — cần: `core/dom-refs.js` (genericDrawerBody)
318. `event/workflow/video-thumb-extract.js`
319. `event/workflow/photo-duration.js`
320. `event/workflow/video-frame-capture.js`
321. `event/workflow/file-manager-photo.js`
322. `event/router/file-manager-photo.js` — cần: `event/bus.js` (eventBus)
323. `event/workflow/image-edit.js`
324. `event/router/image-edit.js` — cần: `event/bus.js` (eventBus)
325. `event/listener/image-edit.js`
326. `event/workflow/file-manager-cleanup.js`
327. `event/router/file-manager-cleanup.js` — cần: `event/bus.js` (eventBus)
328. `event/workflow/photo-gallery-window.js`
329. `event/workflow/video-gallery-window.js`
330. `event/workflow/player.js`
331. `event/workflow/playlist.js` — cần: `core/ui-theme/icon-svg-ui.js` (iconSvg)
332. `event/router/playlist.js` — cần: `event/bus.js` (eventBus)
333. `event/listener/playlist.js` — cần: `core/dom-refs.js` (25 biến DOM)
334. `event/workflow/app-settings.js`
335. `event/router/app-settings.js` — cần: `event/bus.js` (eventBus)
336. `event/workflow/placeholder-panels.js`
337. `event/router/placeholder-panels.js` — cần: `event/bus.js` (eventBus)
338. `event/listener/placeholder-panels.js` — cần: `core/dom-refs.js` (btnGamePanelClose, btnStatisPanelClose)
339. `event/workflow/app-panel-nav.js`
340. `event/router/app-panel-nav.js` — cần: `event/bus.js` (eventBus)
341. `event/listener/app-panel-nav.js` — cần: `core/dom-refs.js` (appBottomNav)
342. `event/workflow/video-player.js`
343. `event/router/video-player.js` — cần: `event/bus.js` (eventBus)
344. `event/listener/video-player.js` — cần: `core/dom-refs.js` (bgVideoElement, btnCaptureVideoFrame)
345. `event/workflow/photo-player.js`
346. `event/workflow/number-countup.js`
347. `event/workflow/gameplay-engine.js`
348. `event/workflow/gameplay.js` — cần: `core/dom-refs.js` (gameplayLayer)
349. `event/router/gameplay.js` — cần: `event/bus.js` (eventBus)
350. `event/listener/gameplay.js` — cần: `core/dom-refs.js` (gameplayTapSurface, btnGameplayExit)
351. `event/workflow/game-catalog.js`
352. `event/router/game-catalog.js` — cần: `event/bus.js` (eventBus)
353. `event/listener/game-catalog.js` — cần: `core/dom-refs.js` (gamePanelList)
354. `event/workflow/statis-panel.js`
355. `event/router/statis-panel.js` — cần: `event/bus.js` (eventBus)
356. `event/listener/statis-panel.js` — cần: `core/dom-refs.js` (statisPanelBody)
357. `event/workflow/listen-stats.js`
358. `event/workflow/player-controls.js`
359. `event/router/player-controls.js` — cần: `event/bus.js` (eventBus)
360. `event/listener/player-controls.js` — cần: `core/player-controls.js` (STACKED_SCREEN_LAYOUT_QUERY); `core/dom-refs.js` (10 biến DOM)
361. `event/workflow/custom-effect.js`
362. `event/workflow/element-style-editor.js`
363. `event/workflow/visualizer-display.js`
364. `event/router/visualizer-display.js` — cần: `event/bus.js` (eventBus)
365. `event/listener/visualizer-display.js` — cần: `core/dom-refs.js` (btnCycleMode, genericDrawerBody)
366. `event/router/custom-effect.js` — cần: `event/bus.js` (eventBus)
367. `event/listener/custom-effect.js` — cần: `core/dom-refs.js` (genericDrawerBody, genericDrawerHeader)
368. `event/router/visualizer-viewport.js` — cần: `event/bus.js` (eventBus)
369. `event/listener/visualizer-viewport.js`
370. `core/theme-background-ui.js`
371. `event/workflow/theme.js`
372. `event/router/theme.js` — cần: `event/bus.js` (eventBus)
373. `event/listener/theme.js` — cần: `core/dom-refs.js` (appStack)
374. `event/workflow/app-visibility.js`
375. `event/router/app-visibility.js` — cần: `event/bus.js` (eventBus)
376. `event/listener/app-visibility.js`
377. `event/workflow/recorder.js`
378. `event/router/recorder.js` — cần: `event/bus.js` (eventBus)
379. `event/listener/recorder.js` — cần: `core/dom-refs.js` (btnRecordStart, btnRecorderStop)
380. `event/workflow/perf-hud.js`
381. `event/router/perf-hud.js` — cần: `event/bus.js` (eventBus)
382. `event/listener/perf-hud.js`
383. `event/workflow/sav-logo.js`
384. `event/router/sav-logo.js` — cần: `event/bus.js` (eventBus)
385. `event/listener/sav-logo.js` — cần: `core/dom-refs.js` (savLogo); `core/sav-logo.js` (hasRealHoverDevice)
386. `event/workflow/language-settings.js`
387. `event/router/language-settings.js` — cần: `event/bus.js` (eventBus)
388. `event/listener/language-settings.js` — cần: `core/dom-refs.js` (3 biến DOM)
389. `event/workflow/playlist-empty-state.js`
390. `event/router/playlist-empty-state.js` — cần: `event/bus.js` (eventBus)
391. `event/listener/playlist-empty-state.js` — cần: `core/dom-refs.js` (btnPlaylistEmptyPlay, btnPlaylistEmptyShuffle)
392. `event/workflow/subtitle-modal.js`
393. `event/workflow/auto-switch-visual.js`
394. `event/router/auto-switch-visual.js` — cần: `event/bus.js` (eventBus)
395. `event/listener/auto-switch-visual.js` — cần: `core/dom-refs.js` (genericDrawerBody)
396. `event/router/visualizer-control-center.js` — cần: `event/bus.js` (eventBus)
397. `event/listener/visualizer-control-center.js` — cần: `core/dom-refs.js` (3 biến DOM)
398. `event/workflow/hud.js`
399. `event/router/hud.js` — cần: `event/bus.js` (eventBus)
400. `event/listener/hud.js` — cần: `core/dom-refs.js` (5 biến DOM)
401. `event/workflow/visualizer-gesture.js` — cần: `core/dom-refs.js` (6 biến DOM)
402. `event/router/visualizer-gesture.js` — cần: `event/bus.js` (eventBus)
403. `event/listener/visualizer-gesture.js` — cần: `core/dom-refs.js` (visualizerGestureSurface)
404. `event/workflow/player-zoom.js` — cần: `core/player-zoom.js` (PLAYER_ZOOM_DEFAULT)
405. `event/router/player-zoom.js` — cần: `event/bus.js` (eventBus)
406. `event/listener/player-zoom.js` — cần: `core/dom-refs.js` (btnPlayerZoom, playerZoomSurface)
407. `event/workflow/subtitle-display.js`
408. `event/workflow/subtitle-style-settings.js`
409. `event/router/subtitle-style-settings.js` — cần: `event/bus.js` (eventBus)
410. `event/listener/subtitle-style-settings.js` — cần: `core/dom-refs.js` (genericDrawerBody)
411. `event/workflow/eq-presets.js`
412. `event/router/eq-presets.js` — cần: `event/bus.js` (eventBus)
413. `event/listener/eq-presets.js` — cần: `core/dom-refs.js` (btnCycleEq)

</details>

### 2.16 Đuôi

`event/workflow/app-cleanup.js`, `event/tab.js` (sự kiện vòng đời tab), `event/workflow/ui-theme.js`, rồi
`event/workflow/app-boot.js` + `event/router/app-boot.js` **cuối cùng**: router `appBoot` phải đăng ký trước khi
`DOMContentLoaded` bắn (sau khi toàn bộ script đồng bộ chạy xong).

414. `event/workflow/app-cleanup.js`
415. `event/tab.js`
416. `event/workflow/ui-theme.js`
417. `event/workflow/app-boot.js`
418. `event/router/app-boot.js` — cần: `event/bus.js` (eventBus)

## 3. `subtitle-editor.html`

Trang riêng, mở qua `subtitle-editor.html?song=<key mã hoá>` (`service/song-key-cipher.js`). Không nạp `main.js`/
`core/dom-refs.js`: khung trang viết thẳng trong HTML, Generic Drawer và ref DOM của nó mount tay.

- **`<head>`, script inline #1 (trước mọi thứ):** bộ thu log trên màn hình `window.__sedLog` (tối đa 200 dòng), bọc
  `console.log/warn/error` và bắt `error` + `unhandledrejection` — trang này dùng trên di động, không có devtools;
  WaveSurfer v7 có lỗi giải mã đi thẳng ra `unhandledrejection` (issue #3126).
- **CDN:** WaveSurfer 7 + plugin Regions, Timeline; lamejs 1.2 (encoder MP3 thuần JS cho "Cut"). Tailwind build sẵn
  đặt cuối `<head>`.
- **Khung trang (HTML tĩnh):** header (Back, tải lại không cache, Lưu); khung waveform có chiều cao cố định (để lỗi
  CDN/giải mã vẫn thấy khung + thông báo lỗi); nút debug log luôn hiện; khung điều khiển nằm **dưới** waveform (không
  đè sóng); danh sách dòng `#sub-list-container` với `#sub-empty-state` đặt ngoài container (renderer thay toàn bộ con
  của container); thanh Shift; dải công cụ cuộn ngang (Upload, Auto timing, Thêm dòng, Tạo từ vùng chọn, Split, Cut,
  Shift, Phát vùng chọn, Xuất SRT). `<body>` cố định chiều cao viewport để vùng danh sách cuộn đúng.
- **Script:** i18n nạp **đủ 9** patch dù trang chỉ dùng 2 (`lang.js` gộp cứng cả 9). UI Theme chỉ nạp 5 file thuần
  (`light/dark/morphin/registry/apply-ui`) — không nạp `core/config.js`. Script inline #2 mount `TPL_GENERIC_DRAWER`
  vào `<body>` và khai 4 ref (`genericDrawerOverlay/Panel/Header/Body`). `service/state.js` + 3 package
  (`subtitle-editor`, `app-misc`, `generic-drawer`) + bản ghi `service/state/record/subtitle-editor.js`.
  `service/task-manager.js` có mặt (không dùng timer thô). Listener nạp cuối và gọi `workflowSubtitleEditor.init()`
  ngay khi chạy. Script inline #3 (cuối trang) gán nhãn i18n vào khung tĩnh.

**Script inline đầu trang**

1. `(script inline #1)`

**CDN và CSS**

2. [CDN] `https://unpkg.com/wavesurfer.js@7`
3. [CDN] `https://unpkg.com/wavesurfer.js@7/dist/plugins/regions.min.js`
4. [CDN] `https://unpkg.com/wavesurfer.js@7/dist/plugins/timeline.min.js`
5. [CDN] `https://cdn.jsdelivr.net/npm/lamejs@1.2.0/lame.min.js`
6. [CSS] `assets/css/tailwind.css`
7. [CDN] `https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js`

**i18n**

8. `lang/patch/patch-common.js`
9. `lang/patch/patch-playlist.js`
10. `lang/patch/patch-visualizer.js`
11. `lang/patch/patch-subtitle-settings.js`
12. `lang/patch/patch-settings-misc.js`
13. `lang/patch/patch-file-manager.js`
14. `lang/patch/patch-subtitle-editor.js`
15. `lang/patch/patch-video-preview.js`
16. `lang/patch/patch-app-panel-nav.js`
17. `lang/lang.js` — cần: mọi `lang/patch/*.js` (LANG_PATCH_*)

**Icon**

18. `components/icons.js`
19. `core/ui-theme/icon-svg-ui.js`

**z-index và UI Theme**

20. `service/z-index.js`
21. `core/ui-theme/light.js`
22. `core/ui-theme/dark.js`
23. `core/ui-theme/morphin.js`
24. `core/ui-theme/registry.js` — cần: `core/ui-theme/light.js` (UI_THEME_LIGHT); `core/ui-theme/dark.js` (UI_THEME_DARK); `core/ui-theme/morphin.js` (UI_THEME_MORPHIN)
25. `core/ui-theme/apply-ui.js` — cần: `core/ui-theme/light.js` (UI_THEME_LIGHT)

**Generic Drawer (mount tay)**

26. `components/generic-drawer.js`
27. `(script inline #2)` — cần: `components/generic-drawer.js` (TPL_GENERIC_DRAWER)
28. `core/generic-drawer.js` — cần: `service/z-index.js` (Z_INDEX)
29. `core/modal-choice-ui.js`

**State**

30. `service/state.js`
31. `service/state/subtitle-editor.js` — cần: `service/state.js` (AppState)
32. `service/state/app-misc.js` — cần: `service/state.js` (AppState)
33. `service/state/generic-drawer.js` — cần: `service/state.js` (AppState)
34. `service/state/record/subtitle-editor.js` — cần: `service/state.js` (appState)

**Service**

35. `core/time-picker-modal.js`
36. `event/bus.js`
37. `service/db.js`
38. `service/song-key-cipher.js`
39. `service/task-manager.js`

**Core**

40. `core/upload-validation.js`
41. `core/subtitle/subtitles.js`
42. `core/subtitle/subtitles-ui.js` — cần: `core/ui-theme/icon-svg-ui.js` (iconSvg)
43. `core/subtitle/subtitle-karaoke.js`
44. `components/subtitle-karaoke-drawer.js`
45. `core/audio-segment.js`
46. `core/slider-panel-scroll.js`

**Cụm subtitleEditor**

47. `event/workflow/generic-drawer-helpers.js`
48. `event/workflow/subtitle-editor.js`
49. `event/router/subtitle-editor.js` — cần: `event/bus.js` (eventBus)
50. `event/listener/subtitle-editor.js` — cần: `event/workflow/subtitle-editor.js` (workflowSubtitleEditor)

**Gán nhãn i18n**

51. `(script inline #3)` — cần: `lang/lang.js` (t)


## 4. `video-editor.html`

Trang riêng (từ 06/10/2026), mở qua `video-editor.html?video=<key>` từ menu 3 chấm của video; Back/Lưu quay về
`index.html` và cuộn tới mục. Một video, một đoạn cắt.

- **CSS:** Tailwind trước, `assets/css/video-preview.css` sau (ghi đè class tiện ích).
- **Script:** đủ 9 patch i18n; UI Theme 5 file thuần + `modal-choice-ui` (cho `modalChoice`/`alertModal`/dropdown);
  `components/loading-shield.js` + script inline mount `TPL_LOADING_SHIELD` và khai ref `loadingShield`/`loadingText`
  (ở `index.html` 2 ref này đến từ `core/dom-refs.js`); state `video-preview` + `app-misc`; service; core editor
  (`core/video-editor/*`, capture, file-manager); `components/video-preview.js` trước `core/file-manager/video-ui.js`;
  workflow dùng chung (`media-transform-helpers`, `video-thumb-extract`, `photo-duration`, `video-frame-capture`) rồi
  cụm `videoPreview`. Listener nạp cuối, gửi `videoPreview.page.boot` ngay khi chạy (đọc `?video=` rồi mở editor).
- **Mediabunny** (`assets/vendor/mediabunny.js`, bản offline) **không** có thẻ `<script>`: `event/workflow/video-preview.js`
  tự chèn script khi cần (`_ensureMediabunnyLoaded()`).

**CSS**

1. [CSS] `assets/css/tailwind.css`
2. [CSS] `assets/css/video-preview.css`

**idb-keyval và i18n**

3. [CDN] `https://cdn.jsdelivr.net/npm/idb-keyval@6/dist/umd.js`
4. `lang/patch/patch-common.js`
5. `lang/patch/patch-playlist.js`
6. `lang/patch/patch-visualizer.js`
7. `lang/patch/patch-subtitle-settings.js`
8. `lang/patch/patch-settings-misc.js`
9. `lang/patch/patch-file-manager.js`
10. `lang/patch/patch-subtitle-editor.js`
11. `lang/patch/patch-video-preview.js`
12. `lang/patch/patch-app-panel-nav.js`
13. `lang/lang.js` — cần: mọi `lang/patch/*.js` (LANG_PATCH_*)

**Icon**

14. `components/icons.js`
15. `core/ui-theme/icon-svg-ui.js`

**z-index, UI Theme, modal**

16. `service/z-index.js`
17. `core/ui-theme/light.js`
18. `core/ui-theme/dark.js`
19. `core/ui-theme/morphin.js`
20. `core/ui-theme/registry.js` — cần: `core/ui-theme/light.js` (UI_THEME_LIGHT); `core/ui-theme/dark.js` (UI_THEME_DARK); `core/ui-theme/morphin.js` (UI_THEME_MORPHIN)
21. `core/ui-theme/apply-ui.js` — cần: `core/ui-theme/light.js` (UI_THEME_LIGHT)
22. `core/modal-choice-ui.js`

**Loading shield (mount tay)**

23. `components/loading-shield.js` — cần: `lang/lang.js` (t)
24. `(script inline #1)` — cần: `components/loading-shield.js` (TPL_LOADING_SHIELD)

**State và service**

25. `service/state.js`
26. `service/state/video-preview.js` — cần: `service/state.js` (AppState)
27. `service/state/app-misc.js` — cần: `service/state.js` (AppState)
28. `service/state/record/video-editor.js` — cần: `service/state.js` (appState)
29. `service/operation.js`
30. `event/bus.js`
31. `event/virtual-machine-state.js`
32. `service/task-manager.js`
33. `service/db.js`
34. `service/song-key-cipher.js`
35. `service/component-dynamic.js`
36. `service/blob-url.js`

**Core**

37. `core/loading-shield-util.js`
38. `core/dropdown-menu.js`
39. `core/upload-validation.js`
40. `core/media-transform.js`
41. `core/video-editor/compat-guard.js`
42. `core/video-editor/webcodecs-engine.js`
43. `core/video-editor/filmstrip.js`
44. `core/video-editor/opfs-temp.js`
45. `core/video-player-capture.js`
46. `core/file-manager/folder.js`
47. `core/file-manager/image.js`
48. `core/file-manager/video.js`
49. `components/video-preview.js` — cần: `core/ui-theme/icon-svg-ui.js` (iconSvg)
50. `core/file-manager/video-ui.js`

**Workflow dùng chung và cụm videoPreview**

51. `event/workflow/media-transform-helpers.js`
52. `event/workflow/video-thumb-extract.js`
53. `event/workflow/photo-duration.js`
54. `event/workflow/video-frame-capture.js`
55. `event/workflow/video-preview.js`
56. `event/router/video-preview.js` — cần: `event/bus.js` (eventBus)
57. `event/listener/video-preview.js` — cần: `event/bus.js` (eventBus)


## 5. File dùng chung giữa các trang

Các file sau được nạp ở hơn 1 trang — sửa file thì nâng `?v=` ở **mọi** trang trong cột "Trang":

| File | Trang | `?v=` |
|---|---|---|
| `assets/css/tailwind.css` | index, subtitle-editor, video-editor | `20260924r1` |
| `components/generic-drawer.js` | index, subtitle-editor | `20261007svg1` |
| `components/icons.js` | index, subtitle-editor, video-editor | `20261007svg1` |
| `components/loading-shield.js` | index, video-editor | `20260910v1` |
| `core/dropdown-menu.js` | index, video-editor | `20260921v7` |
| `core/file-manager/folder.js` | index, video-editor | `20261006db2` |
| `core/file-manager/image.js` | index, video-editor | `20261006db5` |
| `core/file-manager/video.js` | index, video-editor | `20261006db5` |
| `core/generic-drawer.js` | index, subtitle-editor | `20260924r8` |
| `core/loading-shield-util.js` | index, video-editor | `20260625v10` |
| `core/media-transform.js` | index, video-editor | `20260804v1` |
| `core/modal-choice-ui.js` | index, subtitle-editor, video-editor | `20261006r1` |
| `core/slider-panel-scroll.js` | index, subtitle-editor | `20260712v1` |
| `core/subtitle/subtitle-karaoke.js` | index, subtitle-editor | `20261001kr1` |
| `core/time-picker-modal.js` | index, subtitle-editor | `20261006r1` |
| `core/ui-theme/apply-ui.js` | index, subtitle-editor, video-editor | `20260909v1` |
| `core/ui-theme/dark.js` | index, subtitle-editor, video-editor | `20260923v5` |
| `core/ui-theme/icon-svg-ui.js` | index, subtitle-editor, video-editor | `20261007svg1` |
| `core/ui-theme/light.js` | index, subtitle-editor, video-editor | `20260923v5` |
| `core/ui-theme/morphin.js` | index, subtitle-editor, video-editor | `20260923v5` |
| `core/ui-theme/registry.js` | index, subtitle-editor, video-editor | `20260921v6` |
| `core/upload-validation.js` | index, subtitle-editor, video-editor | `20261006z1` |
| `core/video-player-capture.js` | index, video-editor | `20261007sg1` |
| `event/bus.js` | index, subtitle-editor, video-editor | `20260703v1` |
| `event/virtual-machine-state.js` | index, video-editor | `20260701v1` |
| `event/workflow/generic-drawer-helpers.js` | index, subtitle-editor | `20261007svg1` |
| `event/workflow/media-transform-helpers.js` | index, video-editor | `20260804v1` |
| `event/workflow/photo-duration.js` | index, video-editor | `20261006r6` |
| `event/workflow/video-frame-capture.js` | index, video-editor | `20261006r6` |
| `event/workflow/video-thumb-extract.js` | index, video-editor | `20261006r6` |
| `lang/lang.js` | index, subtitle-editor, video-editor | `20260731v1` |
| `lang/patch/patch-app-panel-nav.js` | index, subtitle-editor, video-editor | `20261005set3` |
| `lang/patch/patch-common.js` | index, subtitle-editor, video-editor | `20261006z2` |
| `lang/patch/patch-file-manager.js` | index, subtitle-editor, video-editor | `20261007fi2` |
| `lang/patch/patch-playlist.js` | index, subtitle-editor, video-editor | `20261006audivis1` |
| `lang/patch/patch-settings-misc.js` | index, subtitle-editor, video-editor | `20261006r4` |
| `lang/patch/patch-subtitle-editor.js` | index, subtitle-editor, video-editor | `20260930kr4` |
| `lang/patch/patch-subtitle-settings.js` | index, subtitle-editor, video-editor | `20261007ui2` |
| `lang/patch/patch-video-preview.js` | index, subtitle-editor, video-editor | `20260929cap1` |
| `lang/patch/patch-visualizer.js` | index, subtitle-editor, video-editor | `20261007ui2` |
| `service/blob-url.js` | index, video-editor | `20260803v1` |
| `service/component-dynamic.js` | index, video-editor | `20260803v1` |
| `service/db.js` | index, subtitle-editor, video-editor | `20261006dbg1` |
| `service/operation.js` | index, video-editor | `20260701v1` |
| `service/song-key-cipher.js` | index, subtitle-editor, video-editor | `20260710v1` |
| `service/state.js` | index, subtitle-editor, video-editor | `20261001aa1` |
| `service/state/app-misc.js` | index, subtitle-editor, video-editor | `20260725v1` |
| `service/state/generic-drawer.js` | index, subtitle-editor | `20260917v1` |
| `service/task-manager.js` | index, subtitle-editor, video-editor | `20260720v1` |
| `service/z-index.js` | index, subtitle-editor, video-editor | `20261006r1` |

← [Quay lại README](../README.md)
