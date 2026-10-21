# Plan v14 — hàng đợi dọn nợ theo miền (lập 13/10/2026)

Nguồn số liệu: [core-legacy-audit.md](../core-legacy-audit.md). Lúc lập plan (sau đợt Folder): **1152 FAIL / 139 file**; hiện tại
(sau đợt 20b + adapter rVFC): **459 FAIL / 55 file** (từ 14/10/2026 `requestAnimationFrame` thô tính FAIL, không còn mục chờ chốt). Cột "Còn lại sau đợt" tính từ số hiện tại. Plan này chỉ sắp **thứ tự và cách gom**; không đổi rule nào
([core-function-conventions.md](../core-function-conventions.md), [event-bus-flow.md](../event-bus-flow.md),
[task-manager-conventions.md](../task-manager-conventions.md)).

Thay hẳn plan-debt-cleanup-02-10-2026.md (chia đợt theo file Workflow — đã xoá; bộ khuôn K1–K8 và ghi chú kỹ thuật
từng đợt của nó chuyển vào mục 3 và mục 4 dưới đây). Khuôn nối sự kiện W1–W8 của plan-event-bus-wiring-07-10-2026 (đã xong,
đã xoá) cũng ở mục 3.

## 1. Nguyên tắc

1. **Theo miền, trong miền làm Core trước rồi tới Workflow.** Sửa nợ core (Rule 2/3a/3b/5a) luôn đẩy việc lên Workflow gọi
   nó; làm core trước thì API core chốt 1 lần, Workflow dọn 1 lần trên API cuối (kèm gộp `get([…])`).
2. **Dễ trước, khó sau.** Thứ tự ưu tiên: ít dòng nợ → không đụng luồng phát / dữ liệu / iOS → không phải hot path.
3. **Mỗi đợt 1 patch**, Giang test máy xong mới sang đợt sau. Đợt > ~40 dòng chia lượt a/b/c.
4. **Mỗi đợt kèm:**
   - Method bị đụng dọn luôn nợ của nó; gặp bug thì sửa luôn theo rule; vi phạm chưa có trong sổ thì sửa hoặc ghi thêm.
   - Xoá comment lạc hậu/lịch sử (SỬA/MỚI/XOÁ kèm ngày, "trước đây…"), rút gọn comment trong file bị đụng.
   - Rà dead code (hàm/hằng/method/file không còn nơi gọi, CSS/lang key theo kèm) trong phạm vi đợt — có thì xoá, file chết
     ghi trong mô tả patch để Giang xoá tay. Quét theo tên sau khi bỏ comment, rồi grep lại từng tên trước khi xoá.
   - `node --check`; boot harness Chromium (stub CDN) chạy kịch bản của đợt, 0 lỗi JS; checklist phần cần test máy.
   - Nâng `?v=` mọi trang có nạp file đổi; cập nhật sổ (xoá dòng xong, ghi dòng mới), bảng tiến độ ở mục 6.
5. **Không đổi hành vi** ngoài bug được ghi rõ trong mô tả patch.

## 2. Thang độ khó

| Bậc | Tiêu chí |
|---|---|
| 1 — Rất dễ | ≤ 10 dòng/miền, UI thuần, không đụng phát/DB |
| 2 — Dễ | UI/cài đặt, không đụng luồng phát, ≤ 35 dòng |
| 3 — Vừa | Đụng media/iOS/dữ liệu/nền tảng (config, storage) hoặc hiển thị theo thời gian thực |
| 4 — Khó | Luồng phát chính (Playlist, Player, Video, VBG, Motion) |
| 5 — Riêng | Hot path visualizer (đo FPS), 2 trang riêng (Subtitle Editor, Video Editor) |
| Cuối | Hạ tầng UI dùng chung (Giang chốt để đợt cuối) |

## 3. Bộ khuôn sửa (dùng thống nhất mọi đợt)

| Mã | Dạng gặp | Sửa thành |
|---|---|---|
| **K1** | `if (typeof workflowX !== 'undefined') workflowX.y()` / `typeof fn === 'function'` | Kiểm thứ tự nạp ([script-load-order.md](../script-load-order.md) + index.html). Luôn nạp trước -> bỏ điều kiện. Có trang không nạp (subtitle-editor.html, video-editor.html) -> giữ, ghi lý do tại chỗ. |
| **K2** | Bước tuỳ chọn `if (x) doStep()` | PASS theo sổ (bật/tắt 1 bước). Bước dài -> method riêng mở đầu bằng guard. |
| **K3** | `if/else`, `else if`, 3 ngôi chọn 2 lời gọi hàm | Object map `X_BY_Y` cấp module, khoá boolean thật. Rẽ theo trạng thái app ngoài hot path -> có thể dùng `VirtualMachineState.run()` (event-bus-flow.md mục 7a). |
| **K4** | Điều kiện nhiều vế / phép tính quyết định nhánh | Core THUẦN trả 1 giá trị trạng thái, Workflow tra map. |
| **K5** | Chuỗi "kiểm hợp lệ rồi gán" (`if (LIST.includes(saved.x)) cfg.x = saved.x`) | Core THUẦN `sanitizeXConfig(saved, defaults)`, mỗi field là 1 phép chọn giá trị. |
| **K6** | `if (url) { try { URL.revokeObjectURL(url) } catch {} }` lặp lại | `revokeBlobUrl()` (service/blob-url.js); Workflow tạo URL qua `createBlobUrl()`. |
| **K7** | Core tự đọc DB / localStorage / appConfig | Workflow đọc rồi truyền vào; core chỉ GHI. Hàm core không còn nơi gọi -> xoá. |
| **K8** | Hot path 60fps | CHỈ object map + guard; không VMState, không log mỗi frame. |
| **giữ** | `if (el) el.x = …` kiểm DOM ref null | Giữ nguyên — phòng vệ, không phải rẽ tiến trình. |

Khuôn nối sự kiện (từ plan-event-bus-wiring-07-10-2026, đã xong và xoá 13/10/2026):

| Mã | Dạng gặp | Sửa thành |
|---|---|---|
| **W1** | Workflow `querySelector(...).addEventListener(..., () => this.x())` trên nội dung Generic Drawer | `event/listener/<cụm>.js` ủy quyền 1 lần trên `genericDrawerBody`/`genericDrawerHeader`, bảng tuyến `{ match, send }` (khuôn `custom-effect.js`); Router thêm case; Workflow xoá `_wire*()`. |
| **W2** | Nút header dùng id chung (`#btn-generic-drawer-close`/`-back`…) | Thêm attribute riêng của cụm (`data-eq-close`, `data-ce-close`…) để Listener không bắt nhầm drawer khác. |
| **W3** | Phần tử lặp (hàng preset, slider từng kênh) | `data-*` mang khoá, Listener đọc dataset làm payload. |
| **W4** | Kéo-thả pointer trong Workflow | Khuôn Point Move / Auto-Switch: Listener `pointerdown` (delegate) + `setPointerCapture`, mỗi pha 1 `msg.type`; Workflow giữ phiên kéo, core -ui tô DOM. |
| **W5** | `window.resize` / `ResizeObserver` trong Workflow | Đi chung luồng `visualizer-viewport` hoặc đăng ký ở Listener của cụm. |
| **W6** | Callback đã chỉ `eventBus.send()` nhưng đăng ký trong Workflow | Dời đăng ký sang Listener của cụm. |
| **W7** | Ô nhập trong modal động | `modalChoice()` + thân ở `components/`, đọc `.value` trong `onClick` (không listener `input`). |
| **W8** | Chờ sự kiện 1 lần của media/đối tượng tạo động | Phần tử TĨNH: `workflowMediaWait.once()/wait()`; đối tượng tạo động: adapter `core/dynamic-object-ui.js` (event-bus-flow.md mục 1). |

Listener không đọc `appState`, không rẽ nhánh nghiệp vụ; selector phải đủ riêng để không bắt nhầm drawer khác.

## 4. Hàng đợi

Ký hiệu loại nợ: R1/R2/R3a/R3b/R4/R5a/R5c/R5d = Rule core; WF-DOM / WF-tính / WF-canvas / WF-media / WF-template =
Workflow tự thi hành; WF-§7 = rẽ nhánh không object map; WF-get = chưa gộp `get([…])`; TM-core = `taskManager` trong
core; Timer = timer thô; L-* = Listener; rAF = `requestAnimationFrame` thô (FAIL từ 14/10/2026 — thay bằng `taskManager.onceFrame()`; chỗ trong core phải tách hàm, Workflow hẹn khung).

| Đợt | Bậc | Miền | File chính | FAIL | Còn lại sau đợt | Loại nợ chính |
|---|---|---|---|---|---|---|
| 0 ✓ | — | Dọn comment các file đợt Folder | `event/workflow/{playlist,playlist-scope,visual-bg-common,app-boot}.js`, `event/router/playlist.js`, `core/{storage-manager,playlist/main,playlist/actions,file-manager/video}.js`… | 0 | đã xong | Comment lịch sử |
| 1 ✓ | 1 | Element Style Editor · Info icon · App Panel nav + Gesture settings | `core/element-style-editor.js`, `core/info-icon-ui.js`, `core/app-panel-nav.js`, `core/sav-logo.js`, `event/workflow/{element-style-editor,gesture-settings}.js` | 13 | đã xong | R3a 5 · R5a 2 · WF-DOM 2 |
| 2 ✓ | 1 | Playlist Empty State · Auto-switch visual · EQ | `event/{workflow,router}/playlist-empty-state.js`, `core/auto-switch-visual.js`, `event/workflow/{auto-switch-visual,eq-presets}.js` | 19 | đã xong | WF-get 8 · WF-§7 4 · R3b 2 · Router 1 |
| 3 ✓ | 1 | Custom Effect · HUD · Pagination | `core/custom-effect.js`, `core/hud.js`, `core/pagination-ui.js`, `event/workflow/{custom-effect,hud,pagination}.js` | 26 | đã xong | R3a 7 · R5d 7 · WF-tính 4 |
| 4 ✓ | 2 | Player display settings · Playlist Filter | `core/player-display-apply.js`, `core/playlist/{filter,filter-presets}.js`, `event/workflow/{player-display-settings,playlist-filter-presets,filter-rule-edit}.js` | 27 | đã xong | R3a 11 · WF-get 8 · WF-DOM 6 |
| 5 ✓ | 2 | Folder (phần còn lại) + dọn mồ côi | `core/file-manager/{folder-picker-ui,cleanup}.js` | 21 | đã xong | R5a 12 · TM-core 4 · R3a 3 · R3b 2 |
| 6 ✓ | 2 | Statistics + listen stats | `core/statis-panel-ui.js`, `event/workflow/{statis-panel,listen-stats}.js` | 28 | đã xong | R5d 15 · R3a 5 |
| 7 ✓ | 2 | Photo/Video gallery (File Manager) | `core/file-manager/photo-ui.js`, `event/workflow/{photo,video}-gallery-window.js`, `file-manager-photo.js` | 32 | đã xong | WF-DOM 13 · R5a 11 · R5d 5 |
| 8 ✓ | 2 | Theme / UI theme | `core/theme-background-ui.js`, `core/color-utils.js`, `core/ui-theme/{status-bar-color,apply-ui}.js`, `event/workflow/{theme,ui-theme}.js` | 32 (+1 rAF, dọn 14/10) | đã xong | R3a 12 · R5d 7 |
| 9 ✓ | 2 | Settings shell | `core/settings-carousel-ui.js`, `core/app-settings-ui.js`, `event/workflow/{app-settings,settings-misc,subtitle-style-settings}.js` | 33 | đã xong | R3a 10 · WF-§7 9 · WF-DOM 7 |
| 10 ✓ | 2 | Game | `core/gameplay/{game-panel-ui,engine-ui,engine,circle-mode}.js`, `event/workflow/{gameplay,gameplay-engine,game-catalog}.js` | 33 | đã xong | R5d 12 · WF-get 6 · WF-media 3 |
| 11 ✓ | 3 | Photo Player (+ bỏ Game cho Photo) | `core/photo-player.js`, `event/workflow/{photo-player,photo-duration}.js` | 25 | đã xong | R4 6 · WF-get 6 · R2 3 · R3a 3 |
| 12 ✓ | 3 | Phụ đề hiển thị · Visualizer UI (+ 3 bug phụ đề) | `event/workflow/subtitle-display.js`, `core/subtitle/subtitle-karaoke-display-ui.js`, `core/visualizer/visualizer-display.js`, `core/visualizer-control-center.js`, `core/visualizer-gesture.js`, `event/workflow/{visualizer-display,visualizer-gesture}.js` | 36 | đã xong | WF-get 8 · WF-tính 7 · R3a 6 |
| 13 ✓ | 3 | Vòng đời app (wakelock, ẩn/hiện, boot) | `core/wakelock.js`, `event/workflow/{app-visibility,app-boot,app-cleanup}.js` | 19 | đã xong | WF-get 7 · R2 3 · WF-media 2 |
| 14 ✓ | 3 | Ghi âm | `event/workflow/recorder.js` | 17 | đã xong | WF-media 8 · WF-DOM 3 |
| 15 ✓ | 3 | Sửa ảnh | `event/workflow/image-edit.js`, `core/photo-editor-engine.js` | 39 | đã xong | WF-DOM 17 · WF-§7 8 · WF-canvas 4 |
| 16 ✓ | 3 | Config | `core/config.js` | 32 | đã xong | R3a 11 · R3b 16 · TM-core 2 |
| 17a/17b ✓ | 3 | Storage + Zip | 17a: `core/storage-manager.js`, `event/workflow/file-manager-storage.js` · 17b: `core/streaming-zip.js`, `event/workflow/zip-download.js`, `core/video-editor/opfs-temp.js` | 60 | đã xong | R3a 19 · R5a 10 · Timer 8 · R3b 6 |
| 18a ✓ /b ✓ /c ✓ | 4 | Playlist | 18a ✓ core: `core/playlist/{actions,main,loader,render,selection}.js`, `core/{song-search,upload-validation}.js` · 18b ✓: `event/workflow/{playlist-render,playlist-order,playlist-scope}.js` · 18c ✓: `event/workflow/playlist.js` (upload / xoá-xuất / còn lại) | 96 (+1 rAF) — 18a xong 39, 1 dời 19a; 18b xong 22; 18c xong 34 | 565 | WF-get 27 · R3a 19 · WF-DOM 15 · R2 7 · R3b 7 |
| 19a ✓ /19b ✓ | 4 | Player / điều khiển phát | 19a ✓: `core/player-controls.js`, `event/listener/video-player.js` · 19b ✓: `event/workflow/{player,player-controls,media-in-use}.js` | 62 (+1 từ 18a) — 19a xong 31, 19b xong 29 | 503 | R3a 13 · WF-§7 12 · R2 9 · WF-get 9 · L-đọcState 5 |
| 20a ✓ /20b ✓ | 4 | Video Player | 20a ✓: `core/video-player.js`, `event/workflow/{video-motion-surface,video-frame-capture,video-thumb-extract}.js` · 20b ✓: `event/workflow/video-player.js` | 52 (+4 rAF) — 20a xong 21, 20b xong 29; +2 ghi mới rVFC — dọn 21/10 (adapter) | 451 | WF-DOM 16 · WF-media 10 · WF-§7 7 |
| 21a/21b | 4 | Visual Background | 21a: `core/visual-bg-common.js`, `event/workflow/visual-bg-common.js`, `event/listener/visual-bg.js` · 21b: `event/workflow/visual-bg-{video,photo,photo-motion}.js` | 67 | 384 | WF-DOM 24 · WF-§7 20 · WF-tính 7 |
| 22a/22b | 4 | Motion | 22a: `core/motion-presets.js`, `event/workflow/motion-presets.js` · 22b: 3 runner `event/workflow/motion-*-runner.js` | 56 | 328 | WF-DOM 22 · R3a 21 · WF-tính 11 |
| 23a/23b | 5 | Visualizer render (hot path) | 23a core: `core/visualizer/{draw/window-frame,effect-paint}.js`, `core/rubik-math.js`, core group (`clock`, `dot`, `black-hole`, `bar/common`, `rain/street`, `fireworks`), `core/webgl/three-connector.js` · 23b: `event/workflow/visualizer/*.js`, `visualizer-render.js`, `audio-analysis.js`, `audio-engine.js`, `perf-hud.js` | 77 | 251 | WF-tính 30 · R2 11 · R1 11 · WF-canvas 8 |
| 24a/b/c | 5 | Trang Subtitle Editor | `core/subtitle/{subtitles-ui,subtitles}.js`, `event/listener/subtitle-editor.js`, `event/workflow/subtitle-editor.js` | 127 (+1 rAF) | 124 | WF-get 44 · WF-DOM 32 · WF-tính 16 · R3a 13 · R5a 10 |
| 25a/25b | 5 | Trang Video Editor | `core/video-editor/{webcodecs-engine,filmstrip}.js`, `event/workflow/video-preview.js` | 71 | 53 | WF-get 21 · WF-DOM 14 · WF-tính 12 · WF-§7 10 |
| 26a/26b | Cuối | Hạ tầng UI dùng chung | 26a: `core/dropdown-menu.js`, `core/loading-shield-util.js`, `event/workflow/generic-drawer-helpers.js`, `core/modal-choice-ui.js`, `event/workflow/number-countup.js` · 26b: `core/slider-input-modal.js`, `core/time-picker-modal.js`, `core/point-move-timing-ui.js` | 53 (+3 rAF) | 0 | R5a 17 · R3a 13 · R5c 3 · Timer 2 |

Còn 565 FAIL (đã trừ đợt 5, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18a, 18b, 18c; +10 dòng rAF thành FAIL 14/10 — 1 dọn cùng đợt 8, 9 dòng tính vào đợt 18/20/24/26; đợt 9 −2 dòng `_renderTheme` / đợt 16 −3 dòng `loadConfig` dọn cùng đợt 8; đợt 18a −4 / 19a −2 dòng thuộc hàm chết xoá ở đợt 7; đợt 21a +1 dòng phát hiện ở đợt 1; đợt 16 −2 dòng `loadConfig` gỡ cùng đợt 2 và 3; đợt 23a +2 dòng `getActiveEffectConfig` dời từ đợt 3; đợt 26 +1 dòng `number-countup.js` mode `'interval'` phát hiện ở đợt 14; đợt 19a +1 dòng `handlePlaybackError` dời từ 18a). Dòng `requestAnimationFrame` thô (cột FAIL ghi "+N rAF") dọn theo miền chứa nó bằng `taskManager.onceFrame()`.

20/10/2026 (ngoài đợt — Cut MP3 · Bottom Player · bảng 7 màu): −17 dòng → **548 FAIL**; phần màu effect của 23a đã làm (xoá `getActiveEffectConfig()`, `effect-paint.js` sạch) — xem sổ, mục Tổng quan. Cùng ngày rà lại mục 5 theo phán quyết "khác thuật toán = khác tiến trình" + ghi lamejs: +21 → 569. Đợt 19a: −31 → 538; đợt 19b: −29 → 509; đợt 20a: −21 +1 → 489; đợt 20b: −29 +1 → 461; adapter rVFC: −2 → **459 FAIL**.

### Ghi chú theo đợt

- **18b ✓** — Xong 20/10/2026: 3 Workflow Playlist chỉ còn chuẩn bị + điều phối — node dựng từ HTML hoàn chỉnh của components + core -ui MỚI `core/playlist/node-ui.js`; kế hoạch diff, view node, cuộn, Search, Filter folder ở core thuần. Kèm sửa `sortKeysByMode()` (Rule 1, sổ chưa ghi) thành xếp hạng + `workflowPlaylistOrder.sortKeys()`. Bug sửa kèm: tên có ký tự HTML chèn thô vào node. Chi tiết: sổ, mục 1.
- **18a ✓** — Xong 20/10/2026: core Playlist chỉ còn ghi DOM/state + tính thuần; đọc state/playlistStore, blob URL, kiểm định dạng ảnh bìa ở Workflow (`workflowPlaylist.openActionMenu`/`_changePendingCover`/`_setPendingCover`/`removePendingCover`/`closeEditModal`/`closeUploadMenuAfterLabelClick`, `workflowPlaylistScope._buildSongCache`/`_buildAdaptedCache`); đọc thời lượng file nhạc → Workflow MỚI `workflowAudioDuration` (event/workflow/audio-duration.js); markup node + vòng tick chọn → components/playlist-view.js; `validateFileType(file, rule)` thay 2 wrapper. Bug sửa kèm: ảnh preview tab Ảnh bìa lỗi lần thứ 2 trong phiên không về đĩa than. Nơi gọi ở 18b/18c chỉ đổi theo API, chưa dọn nợ khác của các method đó. `handlePlaybackError()` (Rule 2) để lại cho 19a. Chi tiết: sổ, mục 1.
- **19a ✓** — Xong 20/10/2026: `core/player-controls.js` sạch nợ — core chỉ ghi DOM/state + tính thuần; nhãn giờ `formatTime()`, `updateProgressBarCSS()`, chọn media cho tốc độ (`workflowPlayerControls.applySpeedToActiveMedia()`), nhịp Media Session 5 s ở Workflow; `handleAudioError` → `workflowPlayerControls.handleAudioErrorEvent()` + `handlePlaybackError(key, filename)`; chờ media nạp đủ qua `workflowMediaWait.waitFirst()`. Listener Video Player chỉ gửi — guard thành 5 entry Block gate. Nơi gọi ở 19b/20 (`workflowPlayerControls`, `workflowVideoPlayer.handleVideoLoadedMetadata`, `workflowHud`) chỉ đổi theo API, chưa dọn nợ khác của các method đó. Đợt 20: `handleVideoLoadedMetadata`/`handleVideoTimeUpdate`/`handleVideoSeeking` tự ghi `progressBar`/nhãn giờ — chuyển sang `setPlayerDurationUi`/`setPlayerProgressUi`/`setSeekingPositionUi`. Chi tiết: sổ, mục 1.
- **16 ✓** — Xong 19/10/2026: Workflow MỚI `workflowConfig` (event/workflow/config.js) lưu/nạp vizConfig + resolve nền media; `core/config.js` chỉ còn default/domain + hàm thuần (di trú giữ nguyên token). 52 nơi `saveConfig()` → `workflowConfig.save()`. Boot so với bản gốc (config mới/cũ/hỏng/rỗng + backup/nền media) cho kết quả giống hệt. Chi tiết: sổ, mục 1.
- **17a/17b ✓** — Xong 19/10/2026: quét file lỗi đọc DB + thử giải mã ở Workflow, core chỉ phán định; chọn hàm theo nguồn → map; điều phối zip OPFS (Path A/B, chống treo, heartbeat) dời sang Workflow MỚI `workflowStreamingZip` + tiện ích hạn giờ MỚI `workflowTimeout` (event/workflow/timeout.js, cũng nạp ở video-editor.html). Đợt 25a: `video-preview.js` đã có `_openTempTarget()` (hạn giờ createWritable). Chi tiết: sổ, mục 1.
- **15 ✓** — Xong 19/10/2026, kèm tính năng Giang yêu cầu: danh sách Layer (icon trên header modal ảnh — ẩn/hiện, xoá, độ mờ, kéo-thả sắp xếp), công cụ Biến đổi layer (kéo trực tiếp: di chuyển/co/xoay + lật ngang/dọc, xoay 90°, đặt lại), công cụ Image chèn ảnh thư viện làm layer, ô gõ chữ textarea. Bug: Sharpen gần như không thấy (-> unsharp mask), Google Font không áp vào chữ trên ảnh, xuống dòng bị mất, Áp dụng Vẽ sau khi chọn Tẩy làm thủng ảnh, Huỷ đặt Shape vẫn giữ Shape. Kéo khung Crop dùng `computeCropDragStep()` (core/media-transform.js) — `video-preview.js::_moveOrResizeCropSession` (đợt 25) chuyển sang hàm này khi tới đợt đó. Chi tiết: sổ, mục 1.
- **14 ✓** — Xong 16/10/2026: Workflow Ghi âm chỉ còn chuẩn bị + điều phối — media qua core/media-element-ui.js, `<audio>` nghe thử tạo/giải phóng qua core -ui, mọi phép tính (mức mic + Clip, đồng hồ, Count-in, MIME, tiến độ/tua nghe lại, nối mẫu đo trễ) ở core/recorder.js; `start()`/`save()` rẽ bằng map theo kết quả; 2 task lặp đổi mode `'timeout'`. Không đổi hành vi (harness 10 kịch bản khớp bản trước). Phát hiện `number-countup.js` cùng lỗi mode `'interval'` — ghi sổ, đợt 26. Chi tiết: sổ, mục 1.
- **0** — Không đổi code; đối chiếu chuỗi token trước/sau để chứng minh chỉ đổi comment (khuôn đợt dọn comment 12/10).
- **Mọi đợt (comment)** — Comment trong code còn trỏ tới 2 plan đã xoá (`plan-media-db-split.md` — ~40 chỗ trong ~20 file, thay bằng
  `readme/db-schema.md` nếu còn cần; `plan-debt-cleanup-02-10-2026.md`) — sửa dần ở đợt chạm tới file đó.
- **10 ✓** — Xong 14/10/2026: markup modal Kết quả + card Game Panel sang `components/`; trạng thái card ở
  `computeGamePanelView()` (core/gameplay/catalog.js); popup tier / vỡ vụn tự gỡ bằng Promise `finished` của animation (không
  listener); `workflowGameplay.tick()` qua bộ theo dõi beat + các cổng spawn/refresh/chuỗi Hard ở core; mọi `Math.random()` vẫn
  ở Workflow, đúng thứ tự tiêu thụ cũ (harness: vết 900 frame Circle trùng khít trước/sau). Nhãn modal Kết quả dùng chung
  Circle/Arrow (`workflowGameplayEngine.resolveEndModalLabels()`). Chi tiết: sổ, mục 1.
- **rAF ✓ + 9 ✓** — Xong 14/10/2026 (cùng patch, áp sau patch đợt 8): `taskManager.onceFrame(fn, frames, name?)` (service/task-manager.js) thay `requestAnimationFrame` thô — Giang chốt tính FAIL; `forceGlassRepaint` tách 2 core + Workflow hẹn khung. Settings shell: carousel đo 1 lần rồi Workflow chuyển số đo sang hàm ghi; `back()`/các màn "bản ghi mất thì lùi" rẽ bằng map; Debug console + panel Subtitles qua core. Chi tiết: sổ, mục 1.
- **8 ✓** — Xong 14/10/2026: phép tính nền App Panel gom ở core thuần MỚI `core/theme-background.js` (`computeThemeBackgroundView()` trả 1 lần lớp nền + 3 card); markup màn Theme sang `components/settings/theme.js`; `workflowTheme.commitThemeMode()` là cửa chốt mode duy nhất; vẽ nền lúc boot dời từ `loadConfig()` sang app-boot (`repaintAppBackground()` + `workflowVisualBg.paintSolidBg()` — `updateDOMBackground(cfg, gradientCss)` đổi API, 6 nơi gọi Workflow đổi theo, chưa dọn nợ khác của các method đó). Kèm dọn 2 dòng đợt 9 (`_renderTheme`) + 3 dòng đợt 16 (`loadConfig`); xoá lớp chết `#app-bg-blur-layer`. `forceGlassRepaint` dọn ngay sau đó (`onceFrame`, xem ghi chú rAF). Chi tiết: sổ, mục 1.
- **7 ✓** — Xong 13/10/2026 (gộp đợt 0 + rà dead code): modal xem/sửa ảnh dựng từ `components/image-preview-modal.js`, lưới nhóm ngày ghi DOM qua `core/file-manager/gallery-window-ui.js` + markup `components/media-gallery.js`. Khung picker `renderMediaPickerBodyHtml()` mới dùng ở picker ảnh — playlist.js (18c), visual-bg-{photo,video}.js (21b) còn tự dựng chuỗi y hệt (theme.js đã chuyển ở đợt 8), chuyển sang hàm này khi tới đợt đó. Chi tiết: sổ, mục 1.
- **0 ✓** — Xong 13/10/2026 (cùng patch đợt 7): comment lịch sử ở 9 file đợt Folder + `core/file-manager/image.js`; chứng minh chỉ đổi comment bằng so chuỗi token JS trước/sau.
- **Dead code chờ Giang** — nhóm Subtitle Editor còn hàm không nơi gọi (`components/subtitle-editor-modals.js`, `core/subtitle/subtitle-karaoke-drawer-ui.js`, vài hàm ở `core/subtitle/{subtitle-karaoke,subtitles,subtitles-ui}.js`, `components/subtitle-karaoke-drawer.js`) — liên quan bản 6b-2 của `event/{workflow,router,listener}/subtitle-editor.js`; xử lý ở đợt 24 sau khi Giang xác nhận bản nào đang dùng.
- **6 ✓** — Xong 13/10/2026: template panel Statistics về `components/statis-panel.js`, phép tính về core MỚI `core/statis-panel.js`, đồng hồ nghe tính ở `computeListenTick()`. Chi tiết: sổ, mục 1.
- **4 ✓** — Xong 13/10/2026: Resolution Player nhận CSS đã tính, `background-size` ảnh dùng chung Player/VBG qua `workflowPlayerDisplaySettings.resolvePhotoBackgroundSizeCss()`; DOM hàng rule filter vào `core/playlist/filter-rule-ui.js`; sửa kèm khoảng cách màn "Cài đặt filter" của folder. Chi tiết: sổ, mục 1.
- **3 ✓** — Xong 13/10/2026: `resolveEffectConfig(customEffect, type)` thay `getEffectConfig(type)`; ghi field tách theo style/group; HUD + Pagination dọn hết. `getActiveEffectConfig()` (2 dòng) dời sang 23a vì nơi gọi còn là core vẽ. Chi tiết: sổ, mục 1.
- **2 ✓** — Xong 13/10/2026: nút "Phát" giao hẳn Workflow (core `resolvePlaylistEmptyPlayAction()`); "Trộn bài" gọi thẳng `toggleShuffleAndReshuffle()` thay bấm hộ nút; khoá đổi hiệu ứng tay đồng bộ lúc boot qua `workflowAutoSwitchVisual.syncLockedControls()` (bỏ lời gọi trong `loadConfig()`); EQ dọn cả phép tính chưa có trong sổ. Chi tiết: sổ, mục 1.
- **1 ✓** — Xong 13/10/2026: Info icon tách template sang `components/info-icon.js` (thêm `renderInfoPopoverHtml()` thay phần dựng tay), popover đóng qua bus; nav nhận class màu từ `workflowAppPanelNav.paintActiveTab()`; Gesture settings ghi panel qua `core/gesture-settings-ui.js`. Chi tiết: sổ, mục 1.
- **5 ✓** — Xong 13/10/2026: modal đổi tên sang `modalChoice()`; phiên giữ tay tile dời về `workflowFolder`; registry dọn rác bỏ, bảng bước dọn ở Workflow. Chi tiết: mục 5.
- **12 ✓** — Xong 14/10/2026 (kèm 3 bug phụ đề Giang báo + chống lệch timing): hiệu ứng Comming/Outing là Web Animation
  ghim theo thời gian media (seek/pause/tốc độ/ẩn tab lâu đều về đúng), FLIP khi dòng thêm/bớt, Outing tách keyframe ra
  (hết chạy ngược hướng), khung hiện trước khi ghim (dòng đầu / sau quãng trống có hiệu ứng). `updateProgressBarCSS()` lấy
  màu từ biến CSS — 3 nơi gọi trong core (config.js đợt 16, player-controls.js đợt 19a) giữ nguyên nợ "core gọi core" của
  chúng. `handleSongSeeking`/`handleAudioPlayEvent` (19b) và `exitBackground` (13) chỉ thêm 1 lời gọi phụ đề. Chi tiết: sổ, mục 1.
- **11 ✓** — Xong 14/10/2026: "media giả" của Photo dời sang Workflow (`PHOTO_PLAYER_CLOCK_MEDIA`, lấy qua
  `workflowPhotoPlayer.resolveActiveMedia()`), `getActiveMediaElement()` chỉ còn audio/video; core Photo chỉ tính thuần + ghi
  UI; state MỚI `photoPlayerEnded`. Giang chốt **bỏ Game mode cho Photo** (ảnh không có audio): arm game lúc đang phát ảnh chỉ
  arm, chờ Song/Video kế. #record-art dựng qua `renderRecordArtHtml()` + `core/record-art-ui.js` — player.js (19b),
  video-player.js (20) còn tự dựng chuỗi y hệt, chuyển sang khi tới đợt đó. Bug sửa kèm: tên ảnh có `"`/`<` phá #record-art;
  ảnh cuối hết (Repeat tắt) icon vẫn "đang phát". Chi tiết: sổ, mục 1.
- **13 ✓** — Xong 16/10/2026 (kèm 3 bug: seek-hold Song, Video ra/vào Playlist kích cổng seek, Chơi lại Game dư tiếng): Wake Lock thành cụm `wakeLock` (Workflow/Router/Listener MỚI, core chỉ thi hành); điều kiện phát nền ở core thuần MỚI `core/app-visibility.js`; boot bỏ 14 guard `typeof`, Scope dùng chung `workflowPlaylistScope.applyRememberedScope()`; xoá `retireLegacyDownloadServiceWorker()`. Game về đầu qua `workflowGameplayEngine.rewindActiveMedia()` (cổng seek khi media đã dừng giữa chừng/hết bài). Kéo seek Song (tay + cử chỉ) giờ dừng bài lúc kéo như Video; Video Player về Playlist giữ `<video>` trong cây render (ẩn bằng `visibility`). Còn để ngỏ: bắt đầu Game lúc **Video** đang phát — 'pause' tới lúc `readyState` < 2 (vừa gán `currentTime = 0`) nên không xả hàng đợi; chưa ai báo, xử lý ở đợt 20 nếu cần. Chi tiết: sổ, mục 1.
- **13, 14, 19, 20** — Có iOS (phát nền, Media Session, khoá màn hình, mic): checklist máy bắt buộc.
- **16** — `core/config.js` đọc `localStorage`/DB trong core và hẹn giờ ghi backup → Workflow config mới hoặc
  `workflowSettingsMisc`; boot phải chạy với config cũ, hỏng, thiếu field.
- **17a** — `file-manager-storage.js`: `clearAllStoredData`, `executeScanBroken`, 3 hàm `execute*Broken`, `_runStorageActionForSource` (K2/K3, chọn hàm theo Nguồn -> map theo `mediaType`); core `video.js`/`image.js` còn tự đọc DB (`computeVideoStats`/`computeImageStats` -> Workflow đọc cả lô bằng `getAll*Records()`, core chỉ cộng).
- **18c ✓** — Xong 20/10/2026: `event/workflow/playlist.js` chỉ còn chuẩn bị + điều phối (xoá/sửa/upload/xuất/Nguồn/cấu hình); tính toán ở core thuần (`core/playlist/{actions,loader,main,order,bulk-actions}.js`, `core/file-manager/folder.js`), markup tab Chi tiết + danh sách lỗi upload ở components/playlist-view.js. Kèm **sửa XSS** (HTML trong tag mp3/tên file/lý do lỗi/tên gói ngôn ngữ/phụ đề chạy trong modal hoặc DOM). Core MỚI `setMediaSessionMetadata()` (core/player-controls.js) — `workflowPlayer`/`workflowVideoPlayer`/`core/photo-player.js` còn tự ghi `navigator.mediaSession.metadata`, chuyển sang hàm này khi dọn miền chứa nó (19b, 20; `photo-player.js` khi đụng tới). Chi tiết: sổ, mục 1.
- **19b ✓** — Xong 20/10/2026: 3 Workflow chỉ còn chuẩn bị + điều phối. Next/Prev/Phát lại/Play rẽ bằng map theo core thuần (`resolveNextTrackAction`/`resolveWrapQueueMode`/`resolveWrapKey`, core/playlist/order.js); Photo đi thẳng `seekClock()/setPaused()`, xoá media giả + `resolveActiveMedia()`. Cổng seek: lối huỷ giữa chừng qua `_isSeekGateInterrupted()` + `resolveSeekGateStatus()`, play() cuối cổng tách `_resumePlaybackAfterGate()`, media/gain qua core. `playMedia()`: map theo loại item, luồng Song tách 6 method, thứ tự bước giữ nguyên; K6; Media Session qua `setMediaSessionMetadata()`. `workflowMediaInUse`: `computeMediaInUse()` + ghi `cover` qua `mutate`. Nơi gọi khác chỉ đổi theo API (`recomputeDisplayOrder()` trả displayOrder, `mountRecordArt()` trả phần tử). Chi tiết: sổ, mục 1.
- **20b ✓** — Xong 21/10/2026: `event/workflow/video-player.js` chỉ còn chuẩn bị + điều phối — đổi nguồn tách theo kế hoạch core thuần `resolveVideoSwapPlan()`, DOM `#bg-video` qua core/video-player.js, UI phát/dừng dùng chung `setPlayerPlayingUi()` với Song, rAF → `onceFrame`, K1/K6. 2 chỗ `requestVideoFrameCallback` trong Workflow dọn ngay sau (Giang chốt mở rộng adapter: `requestVideoFrameOnce()`, core/dynamic-object-ui.js). Chi tiết: sổ, mục 1.
- **20a ✓** — Xong 21/10/2026: `core/video-player.js` sạch (log state, `connectVideoElementToAnalyser(audioContext, eqEntryNode)` + `workflowAudioEngine.connectVideoElement()`, `setVideoBgGain()` Workflow gọi riêng, `decodeForcedBgThumb()` → `workflowVideoPlayer._decodeForcedBgThumb()` dùng `onceFrame`); thumb lúc nạp video vẽ/đo ở core/video-player-capture.js, `<video>` tạm qua core/media-element-ui.js (thêm vào video-editor.html). Còn 1 dòng mới chờ Giang chốt: `requestVideoFrameCallback` trong `workflowVideoThumbExtract._captureViaFrameCallback` (adapter core/dynamic-object-ui.js?). 20b: `event/workflow/video-player.js` (29 dòng + nợ ghi ở các mục dưới) — `handleVideoLoadedMetadata`/`handleVideoTimeUpdate`/`handleVideoSeeking` chuyển sang `setPlayerDurationUi`/`setPlayerProgressUi`/`setSeekingPositionUi` (19a); `_captureAndFreezeSeekFrame` còn rAF thô.
- **20** — `swapBgVideoSource`: K6 cho 3 URL; mỗi hook/cờ (`onLayerBFilled`/`runTransition`, `isTransition`/`isSurfaceEntry`/`hideVideoUntilReady`/`skipAutoplay`) 1 method có guard, gọi đúng thứ tự cũ; "transition hook có / không" -> K3. `playVideoByKey`, `showStaticBgThumb`, `clearBgVideoSource`, `startFromPlaylist`: K2/K3.
- **21a** — Dead code ghi từ đợt 19a: 4 key lang `visualBgSettingsDrawer.{blockedDeleteInUse,blockedByVideoPlaying,blockedByVisualBgOn,keptDeleteInUse}` (lang/patch/patch-subtitle-settings.js, block VBG đã gỡ) — xoá cùng đợt. `visual-bg-common.js::loadPersistedSettingsOnBoot` gần như toàn K5 -> core thuần `sanitizeVisualBgConfig(saved, defaults)`; `_tickGradientMovement` là hot path (K8). Test boot với config VBG cũ/hỏng/thiếu field.
- **18–22** — Giữ yêu cầu "không đổi hành vi"; mỗi lượt test máy đủ Next/Prev/auto-next cả 3 loại media, seek khi đang phát/dừng, khoá màn hình + Media Session.
- **23** — (20/10/2026: `getActiveEffectConfig()` đã xoá, `effect-paint.js` sạch — luật màu chọn ở Workflow, `colorAt()`.) Chỉ object map + guard; đo FPS trước/sau (Perf HUD) trên máy; giữ thứ tự tiêu thụ `Math.random()`.
- **26 (cuối, Giang chốt)** — `dropdown-menu`, `slider-input-modal`, `time-picker-modal` còn gắn sự kiện gọi callback (R5a) và
  thiếu hậu tố `-ui` (R5c, đổi tên file kéo theo `index.html` + 2 trang + script-load-order.md). `modalChoice()` giữ ngoại lệ
  đã audit, chỉ dọn phần R1/R3a. Đổi API ở đây kéo theo sửa lại nơi gọi ở các miền đã dọn — chấp nhận, gom vào cùng đợt.

## 5. Miền Folder — trạng thái (13/10/2026)

**Đã sạch nợ** (0 dòng trong sổ), qua 2 đợt — đợt Folder (`sav-14-debt-folder-patch.zip`, 1194 → 1152) và đợt 5
(`sav-14-debt-wave5-folder-patch.zip`, 1152 → 1131):

| File | Vai trò |
|---|---|
| `core/file-manager/folder.js` | Core thuần + ghi DB |
| `core/file-manager/folder-picker-ui.js` | Core -ui: ô nhập modal đổi tên, wiring lưới (callback chỉ `eventBus.send`) |
| `core/file-manager/cleanup.js` | Core dọn mồ côi (không còn registry) |
| `event/workflow/folder.js` | `workflowFolder` — mọi đọc DB của miền + điều phối + phiên chạm/giữ tay tile |
| `event/workflow/file-manager-folder-browser.js` | Folder Browser |
| `event/workflow/file-manager-cleanup.js` | Bảng bước "Dọn dẹp dữ liệu" |
| `event/workflow/playlist.js` (phần picker "Thêm vào thư mục" + 2 lối "Gỡ khỏi thư mục") | Picker dùng chung Playlist / Visual Background |

Bug sửa kèm: badge tên folder không đổi sau khi đổi tên folder đang Scope; "xoá file lỗi" không gỡ item khỏi folder.

**Dòng nợ còn nhắc tới folder nhưng thuộc method của miền khác** — dọn ở đợt của miền đó:

| Dòng nợ | Đợt |
|---|---|
| `event/workflow/playlist-scope.js` — `applyFolderScope` (gộp `get`) | 18b |
| `event/workflow/playlist.js` — `uploadPhotos` (if-else chọn Scope, gộp `get`) | 18c ✓ |
| `event/workflow/video-player.js` — `refreshVideoPlaylistIfActive` | 20 |
| `event/workflow/video-preview.js` — lưu video mới vào folder (if-else) | 25 |

**Còn chờ:**
- Giang test máy 2 patch (checklist trong mô tả từng patch).

## 6. Tiến độ

| Đợt | Trạng thái |
|---|---|
| Folder ✓ (trước plan này) | Xong 13/10/2026 (`sav-14-debt-folder-patch.zip`), chờ test máy — 1194 → 1152 |
| 0 ✓ | Xong 13/10/2026 (gộp vào `sav-14-debt-wave7-patch.zip`) — chỉ comment |
| 5 ✓ — Folder phần còn lại | Xong 13/10/2026 (`sav-14-debt-wave5-folder-patch.zip`), chờ test máy — 1152 → 1131 |
| 1 ✓ — ESE · Info icon · App Panel nav + Gesture | Xong 13/10/2026 (`sav-14-debt-wave1-patch.zip`), chờ test máy — 1131 → 1119 (+1 dòng phát hiện mới ghi vào đợt 21a) |
| 2 ✓ — Empty State · Auto-switch · EQ | Xong 13/10/2026 (`sav-14-debt-wave2-patch.zip`), chờ test máy — 1119 → 1099 (kèm 1 dòng đợt 16) |
| 3 ✓ — Custom Effect · HUD · Pagination | Xong 13/10/2026 (`sav-14-debt-wave3-patch.zip`), chờ test máy — 1099 → 1074 (kèm 1 dòng đợt 16; 2 dòng dời sang 23a) |
| 4 ✓ — Player display · Playlist Filter | Xong 13/10/2026 (`sav-14-debt-wave4-patch.zip`), chờ test máy — 1074 → 1047 |
| 6 ✓ — Statistics + listen stats | Xong 13/10/2026 (`sav-14-debt-wave6-patch.zip`), chờ test máy — 1047 → 1019 |
| 7 ✓ — Photo/Video gallery (+ đợt 0 + dead code) | Xong 13/10/2026 (`sav-14-debt-wave7-patch.zip`), chờ test máy — 1019 → 981 |
| 8 ✓ — Theme / UI theme | Xong 14/10/2026 (`sav-14-debt-wave8-patch.zip`), chờ test máy — 981 → 944 |
| rAF + 9 ✓ — `taskManager.onceFrame()` + Settings shell | Xong 14/10/2026 (`sav-14-debt-wave9-patch.zip`, áp SAU patch đợt 8), chờ test máy — 944 (+10 rAF thành FAIL) → 920 |
| 10 ✓ — Game | Xong 14/10/2026 (`sav-14-debt-wave10-patch.zip`, áp SAU patch đợt 9), chờ test máy — 920 → 887 |
| 11 ✓ — Photo Player (+ bỏ Game cho Photo) | Xong 14/10/2026 (`sav-14-debt-wave11-patch.zip`, áp SAU patch đợt 10), chờ test máy — 887 → 862 |
| 12 ✓ — Phụ đề hiển thị · Visualizer UI (+ 3 bug phụ đề) | Xong 14/10/2026 (`sav-14-debt-wave12-patch.zip`, áp SAU patch đợt 11), chờ test máy — 862 → 826 |
| 13 ✓ — Vòng đời app (+ 3 bug) | Xong 16/10/2026 (`sav-14-debt-wave13-patch.zip`, áp SAU patch đợt 12), chờ test máy — 826 → 807 |
| 14 ✓ — Ghi âm | Xong 16/10/2026 (`sav-14-debt-wave14-patch.zip`, áp SAU patch đợt 13), chờ test máy — 807 → 791 (+1 dòng mới ghi vào đợt 26) |
| 15 ✓ — Sửa ảnh (+ Layer, Biến đổi, chèn ảnh, 5 bug) | Xong 19/10/2026 (`sav-14-debt-wave15-patch.zip`, áp SAU patch đợt 14), chờ test máy — 791 → 752 |
| 16 + 17 ✓ — Config · Storage + Zip | Xong 19/10/2026 (`sav-14-debt-wave16-17-patch.zip`, áp SAU patch đợt 15), chờ test máy — 752 → 660 |
| 18a ✓ — core Playlist (+ 1 bug ảnh preview) | Xong 20/10/2026 (`sav-14-debt-wave18a-patch.zip`, áp SAU patch đợt 16+17), chờ test máy — 660 → 621 (1 dòng dời sang 19a) |
| 18b ✓ — Playlist render / order / scope (+ sortKeysByMode, 1 bug escape tên) | Xong 20/10/2026 (`sav-14-debt-wave18b-patch.zip`, áp SAU patch đợt 18a), chờ test máy — 621 → 599 |
| 18c ✓ — `event/workflow/playlist.js` (+ XSS tag mp3 / tên file / phụ đề) | Xong 20/10/2026 (`sav-14-debt-wave18c-patch.zip`, áp SAU patch đợt 18b), chờ test máy — 599 → 565 |
| 19a ✓ — `core/player-controls.js` · Listener Video Player | Xong 20/10/2026 (`sav-14-debt-wave19a-patch.zip`, áp lên bản sav-14-clear-debt hiện tại), chờ test máy — 569 → 538 |
| 19b ✓ — `event/workflow/{player,player-controls,media-in-use}.js` (+ xoá media giả Photo) | Xong 20/10/2026 (`sav-14-debt-wave19b-patch.zip`, áp SAU patch đợt 19a), chờ test máy — 538 → 509 |
| 20a ✓ — `core/video-player.js` · thumb/chụp khung video · Video surface | Xong 21/10/2026 (`sav-14-debt-wave20a-patch.zip`, áp SAU patch đợt 19b), chờ test máy — 509 → 489 |
| 20b ✓ — `event/workflow/video-player.js` | Xong 21/10/2026 (`sav-14-debt-wave20b-patch.zip`, áp SAU patch đợt 20a), chờ test máy — 489 → 461 |
| Adapter rVFC ✓ — `requestVideoFrameOnce()` (core/dynamic-object-ui.js) | Xong 21/10/2026 (`sav-14-debt-wave20c-rvfc-patch.zip`, áp SAU patch đợt 20b), chờ test máy — 461 → 459 |
| Còn lại 21–26 | Chưa làm |

← [Quay lại README](../../README.md)
