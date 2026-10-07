# Muốn sửa gì thì sửa ở đâu?

> Viết lại 07/10/2026 (chốt ver 13) theo đúng cây thư mục hiện tại. Mọi đường dẫn trong file này đều có thật trong
> source; bản cũ (viết ở ver 11–12) trỏ tới nhiều file đã gỡ nên bị thay toàn bộ.

## 1. Kiến trúc chung — đọc trước

Từ ver 11, nghiệp vụ đi theo chuỗi **Listener → Bus → Router → Workflow → Core**
([event-bus-flow.md](./event-bus-flow.md)). "Sửa hành vi khi bấm 1 nút" gần như luôn nằm ở **router/workflow**, không ở
nơi gắn listener. Tên cụm = tên file: `event/listener/<cụm>.js`, `event/router/<cụm>.js`, `event/workflow/<cụm>.js`.

| Muốn... | Vào... |
|---|---|
| Sửa hành vi khi 1 nút/input được bấm/đổi | Tìm `type` trong `event/listener/<cụm>.js` → `case` cùng tên ở `event/router/<cụm>.js` → hàm trong `event/workflow/<cụm>.js` |
| Thêm listener cho nghiệp vụ đã có cụm | Thêm vào đúng `event/listener/<cụm>.js`, gửi `eventBus.send({ router: '<cụm>', type: '<cụm>.hànhĐộng', payload })`, thêm `case` ở router. Đối chiếu `type` khớp giữa 2 file và `node --check` cả 2 |
| Thêm cụm nghiệp vụ mới | Tạo `event/router/<cụm>.js` (tự `eventBus.register()`), `event/listener/<cụm>.js`, `event/workflow/<cụm>.js`; thêm 3 thẻ `<script>` theo thứ tự workflow → router → listener vào trang dùng nó ([script-load-order.md](./script-load-order.md)) |
| Chặn/gom thông báo khi đang có việc dài (shield, block) | `event/block.js` (gate trong Bus) |
| Rẽ nhánh theo trạng thái máy trong Workflow | `event/virtual-machine-state.js` ([event-bus-flow.md](./event-bus-flow.md) mục 7a) |
| State nhớ giữa 2 message của cùng 1 router | `new EventStore('<tên>')` — `event/store.js` |
| Biến state nghiệp vụ toàn app | `service/state/<miền>.js` (`AppState.definePackage`) + khai package cho trang ở `service/state/record/index.js` (hoặc `subtitle-editor.js`/`video-editor.js`); đọc/ghi qua `appState.get/set/mutate` |
| Giá trị người dùng chỉnh trong Settings (có default/restore) | Default + `AppConfig.defineDomain(...)` ở `core/config.js` (domain `viz`, `visualBg`, `reader`, `playlist`, `player`, `uiTheme`, `playerDisplay`, `pagination`, `recorder`, `perfHud`); runtime ở class `AppConfig` trong `service/state.js` |
| Số liệu phân tích audio (beat, energy, BPM, phổ) | Kho đọc-only `audioAnalysis` — `service/audio-analysis.js`; tính ở `core/audio-analysis.js`, `core/audio-tempo.js`; điều phối `event/workflow/audio-analysis.js` |
| Mọi timer lặp / bắn một lần / vòng `raf` | `service/task-manager.js` ([task-manager-conventions.md](./task-manager-conventions.md)) |
| Lớp z-index | `service/z-index.js` |
| Đọc/ghi IndexedDB (DB v6) | `service/db.js` ([plan/plan-media-db-split.md](./plan/plan-media-db-split.md)) |
| Cấp/thu `blob:` URL | `service/blob-url.js` |
| Dựng component HTML động | `service/component-dynamic.js` |
| Thứ tự nạp file, giải thích từng `<script>` | [script-load-order.md](./script-load-order.md) — các trang HTML không còn comment |

## 2. Khung app, điều hướng, Settings

| Muốn sửa... | Vào file... |
|---|---|
| Khởi động app (seed config, nạp DB, dựng playlist) | `event/workflow/app-boot.js` (cụm `appBoot`); dọn khi thoát `event/workflow/app-cleanup.js`; khôi phục `core/app-recovery.js` |
| Ẩn/hiện tab, PWA quay lại, AudioContext bị treo | `event/listener/app-visibility.js` → `event/router/app-visibility.js` → `event/workflow/app-visibility.js`; theo dõi tab `event/tab.js`; wakelock `core/wakelock.js` (state `service/state/wakelock-tab.js`) |
| Thanh điều hướng dưới, chồng view | `components/app-bottom-nav.js`, `components/app-view-stack.js`; logic cụm `appPanelNav` (`core/app-panel-nav.js`, `event/workflow/app-panel-nav.js`, state `service/state/app-panel-nav.js`) |
| Cuộn ngang giữa các panel | `core/slider-panel-scroll.js` |
| Màn Settings chính, carousel | `components/settings/app-settings-main.js`, `core/app-settings-ui.js`, `core/settings-carousel-ui.js`; cụm `appSettings` |
| Mục lặt vặt trong Settings (About, Troubleshooting…) | `components/settings/troubleshooting.js`, `core/settings-misc-ui.js`, `core/about-stats.js`; cụm `settingsMisc` |
| Ngôn ngữ | `lang/lang.js`, `lang/patch/patch-*.js`; UI `components/settings/language.js`; cụm `languageSettings` |
| Theme (Sáng/Tối/Morphin) | Bảng màu `core/ui-theme/light.js`, `dark.js`, `morphin.js`; đăng ký `core/ui-theme/registry.js`; áp `core/ui-theme/apply-ui.js`, `event/workflow/ui-theme.js`; màu thanh trạng thái `core/ui-theme/status-bar-color.js`; nền theme `core/theme-background-ui.js`; cụm `theme` |
| Icon SVG dùng chung | Bộ path `components/icons.js`; dựng thẻ `core/ui-theme/icon-svg-ui.js` |
| Phân trang (Settings > Pagination) | `components/settings/pagination.js`, `core/pagination.js`, `core/pagination-ui.js`, `event/workflow/pagination.js` |
| Drawer dùng chung (Generic Drawer) | `components/generic-drawer.js`, `core/generic-drawer.js`, `event/workflow/generic-drawer-helpers.js`; cụm `genericDrawer` |
| Modal hỏi quyết định | `core/modal-choice-ui.js` (`modalChoice(text, buttons, options?)`) — ngoại lệ không qua bus ([event-bus-flow.md](./event-bus-flow.md)) |
| Modal nhập số bằng slider / chọn giờ | `core/slider-input-modal.js`, `core/time-picker-modal.js` |
| Icon (i) giải thích | `core/info-icon-ui.js`; cụm `infoIcon` |
| Dropdown menu | `core/dropdown-menu.js` |
| Màn chờ (loading shield) | `components/loading-shield.js`, `core/loading-shield-util.js` |
| Panel "đang làm" (placeholder) | `core/placeholder-panel.js`; cụm `placeholderPanels` |
| Debug console, Perf HUD | `components/debug-console-drawer.js`, `core/debug-console.js`; `components/perf-hud.js`, `core/perf-hud.js`, `core/perf-hud-ui.js`, cụm `perfHud` |
| Lỗi khởi động | `core/fatal-error.js` — chỉ còn comment; `index.html` chưa có handler `error`/`unhandledrejection` toàn cục ([changelog/v13.md](./changelog/v13.md) mục 7) |

## 3. Playlist và File Manager

| Muốn sửa... | Vào file... |
|---|---|
| Giao diện danh sách, modal sửa bài, menu upload | `components/playlist-view.js`; cụm `playlist` |
| Nạp file nhạc / thư mục | `core/playlist/loader.js` (`handleAudioFiles()`), kiểm file `core/upload-validation.js` |
| Dựng node danh sách, cuộn tới bài hiện tại | `core/playlist/render.js`, `event/workflow/playlist-render.js` |
| Thứ tự, xáo trộn, lặp | `core/playlist/order.js`, `event/workflow/playlist-order.js`; state `service/state/shuffle-repeat.js` |
| Phạm vi folder ↔ playlist | `core/playlist/scope.js`, `event/workflow/playlist-scope.js` |
| Chọn nhiều, thao tác hàng loạt | `core/playlist/selection.js`, `core/playlist/bulk-actions.js`, `core/playlist/actions.js` |
| Filter, preset Filter | `components/playlist-filter-drawer.js`, `core/playlist/filter.js`, `core/playlist/filter-presets.js`, `event/workflow/filter-rule-edit.js`; cụm `playlistFilterPresets` |
| Sort | `components/playlist-sort-drawer.js`; cài đặt hiển thị `components/settings/playlist-view.js` |
| Tìm kiếm | `core/song-search.js` |
| Màn trống khi chưa có bài | cụm `playlistEmptyState` |
| Logo SAV góc Playlist | `core/sav-logo.js` (`setSavLogoExpanded()`); cụm `savLogo` |
| Media đang dùng bị thay nội dung | cụm `mediaInUse` (`event/router/media-in-use.js`, `event/workflow/media-in-use.js`) |
| File Manager — Video | `core/file-manager/video.js`, `video-ui.js`; lưới `event/workflow/video-gallery-window.js`; thumbnail `event/workflow/video-thumb-extract.js` |
| File Manager — Photo | `core/file-manager/image.js`, `photo-ui.js`; lưới `event/workflow/photo-gallery-window.js`; cụm `fileManagerPhoto` |
| Folder | `core/file-manager/folder.js`, `folder-picker-ui.js`; cụm `fileManagerFolderBrowser` |
| Quét/dọn file hỏng | `core/file-manager/cleanup.js`; cụm `fileManagerCleanup` |
| Quản lý lưu trữ | `components/file-manager-storage.js`, `core/storage-manager.js`; cụm `fileManagerStorage` |
| Tải zip | `core/streaming-zip.js`, worker `core/workers/opfs-zip-worker.js`, UI `core/zip-download-ui.js`, nhiều phần `components/zip-download-parts.js`, file lớn `core/large-file-download.js` + `sw.js`; cụm `zipDownload` |
| Xuất ID3 | `core/id3-export.js` |
| Thống kê nghe | `core/listen-stats.js`, `event/workflow/listen-stats.js`, state `service/state/listen-stats.js`; panel `components/statis-panel.js`, `core/statis-panel-ui.js`, cụm `statisPanel` |

## 4. Phát media

| Muốn sửa... | Vào file... |
|---|---|
| Nút phát, Next/Prev, tua, tốc độ, Media Session | `components/bottom-player.js`, `core/player-controls.js`, `event/workflow/player-controls.js`, `event/workflow/player.js`; cụm `playerControls` |
| Audio graph, EQ | `core/audio-engine.js`, `event/workflow/audio-engine.js`, state `service/state/audio-engine.js`; preset EQ `components/eq-presets-drawer.js`, `core/eq-presets.js`, cụm `eqPresets` |
| Video Player mode | `core/video-player.js`, `event/workflow/video-player.js`, `event/workflow/video-motion-surface.js`, state `service/state/video-player-mode.js`; cụm `videoPlayer` |
| Chụp khung hình | `core/video-player-capture.js`, `event/workflow/video-frame-capture.js` |
| Photo Player mode | `core/photo-player.js`, `event/workflow/photo-player.js`, `event/workflow/photo-duration.js`, state `service/state/photo-player-mode.js` |
| Player Zoom | `core/player-zoom.js`, `event/workflow/player-zoom.js`, state `service/state/player-zoom.js`; cụm `playerZoom` |
| Player Display (Resolution, ô preset Motion) | `components/settings/player-display-settings.js`, `core/player-display-settings.js`, `core/player-display-apply.js`, `event/workflow/player-display-settings.js` |
| Phụ đề trên Player | `core/subtitle/subtitles.js`, `subtitle-display-ui.js`, `subtitle-transition.js`; karaoke `subtitle-karaoke*.js`; `event/workflow/subtitle-display.js`, `event/workflow/subtitle-modal.js`; cài đặt `components/subtitle-settings-drawer.js`, `components/subtitle-karaoke-drawer.js`, `core/subtitle/subtitle-style-settings.js`, cụm `subtitleStyleSettings` |
| Ghi âm | `components/recorder-overlay.js`, `core/recorder.js`, `core/recorder-ui.js`, `event/workflow/recorder.js`, state `service/state/recorder.js`, cài đặt `components/settings/recorder-settings.js`; cụm `recorder` |
| Sửa ảnh, crop, vẽ | `core/photo-editor-engine.js`, `core/media-transform.js`, `event/workflow/image-edit.js`, `event/workflow/media-transform-helpers.js`; cụm `imageEdit` |
| Element Style Editor | `components/element-style-editor-drawer.js`, `core/element-style-editor.js`, `event/workflow/element-style-editor.js`; font `core/google-fonts-list.js` |
| Đếm số tăng dần | `core/number-countup.js`, `event/workflow/number-countup.js` |

## 5. Motion và Visual Background

| Muốn sửa... | Vào file... |
|---|---|
| Preset Motion (CRUD) | `components/motion-settings-drawer.js`, `core/motion-presets.js`, `event/workflow/motion-presets.js`, state `service/state/motion-presets.js`; cụm `motionPresets`; trục Timing `core/point-move-timing-ui.js` |
| Cơ chế Motion (engine, runner, host) | `core/motion-engine.js`; `event/workflow/motion-stage.js`, `motion-transition-runner.js`, `motion-point-move-runner.js`, `motion-beat-react-runner.js` |
| VBG chung | `components/visual-bg-settings-drawer.js`, `core/visual-bg-common.js`, `event/workflow/visual-bg-common.js`, state `service/state/visual-bg.js`; cụm `visualBg` |
| VBG Photo | `core/visual-bg-photo.js`, `event/workflow/visual-bg-photo.js`, `event/workflow/visual-bg-photo-motion.js` |
| VBG Video, âm thanh từng video | `core/visual-bg-video.js`, `event/workflow/visual-bg-video.js`, `components/visual-bg-video-audio-drawer.js` |
| Nền gradient | `components/visual-bg-gradient-drawer.js` |
| Chọn media từ thư viện | `core/media-picker-drawer-ui.js` |

## 6. Visualizer

| Muốn sửa... | Vào file... |
|---|---|
| Vòng render (2 task `raf`), host các group | `event/workflow/visualizer-render.js`; mỗi group `event/workflow/visualizer/<group>.js` |
| Code vẽ từng style | `core/visualizer/groups/<group>/<style>.js` (bar, connector, lighting, rain, shape, vortex) |
| Màu / blur của effect | `core/visualizer/effect-paint.js` (`getComputedColor`, `getActiveBlurMult`) |
| Thanh BPM/Pitch/Energy | `core/visualizer/stats-bar.js` |
| Ánh xạ tần số dùng chung | `core/visualizer/tonotopic.js` |
| Đồng hồ khung hình | `core/visualizer/frame-clock.js` |
| Hiệu ứng phụ (nốt bay, giọt nước, khung cửa sổ, chớp màn) | `core/visualizer/draw/*.js` |
| Resize → dựng lại cảnh | `event/listener/visualizer-viewport.js` → `event/router/visualizer-viewport.js` → `workflowVisualizerRender.onViewportResize()` → hook `onResize` từng group |
| WebGL (camera, renderer, composer, OrbitControls) | `core/webgl/three-common.js`, `three-vortex.js`, `three-connector.js`; điều phối `event/workflow/visualizer/vortex.js`, `connector.js`; state `service/state/three-*.js` |
| Cửa sổ beat flux (rẽ ống Vortex, camera circuit, finale pháo hoa) | `core/visualizer/beat-window.js` + `event/workflow/visualizer/beat-window.js` |
| Custom Effect drawer | `components/custom-effect-drawer.js`, `core/custom-effect.js`, `core/custom-effect-drawer-ui.js`; `event/listener/custom-effect.js` → router → `event/workflow/custom-effect.js` |
| Field cần dựng lại scene khi đổi | `CUSTOM_EFFECT_REFRESH_BY_NAME` (`event/workflow/custom-effect.js`) |
| Style không có khối Blur (vd fireworks) | `CUSTOM_EFFECT_NO_BLUR_STYLES` (`core/custom-effect.js`) |
| Bar black hole: số cột theo chu vi, độ rộng, bo góc | `computeBlackHoleBarLayout` (`core/visualizer/groups/bar/black-hole.js`) |
| Bar dot: dải màu ở mode gradient | `BAR_DOT_COLORS_BY_GRADIENT` (`event/workflow/visualizer/bar.js`) |
| Shape clock: vạch phút sáng, nền mặt số, quả lắc | `stepClockTickGlow`, `paintClockBackground` (`core/visualizer/groups/shape/clock.js`) + `_syncClockBackground` (`event/workflow/visualizer/shape.js`); chọn ảnh `pickImageField()` (`event/workflow/custom-effect.js`) |
| Auto-switch | `core/auto-switch-visual.js` (`resolveAutoSwitchSyncPhase()`), `event/workflow/auto-switch-visual.js` (`syncPlayState()` dùng VMState), state `service/state/auto-switch.js`, drawer `components/settings/visualizer-auto-switch-drawer.js`; cụm `autoSwitchVisual` |
| Visualizer Screen (hiển thị, ẩn UI) | `components/settings/visualizer-display-panel.js`, `core/visualizer/visualizer-display.js`, `core/visualizer-ui-visibility.js`, `event/workflow/visualizer-display.js`; cụm `visualizerDisplay` |
| Overlay, Control Center | `components/visualizer-overlay.js`, `core/visualizer-control-center.js`; cụm `visualizerControlCenter` |
| Cử chỉ trên màn Visualizer | `core/visualizer-gesture.js`, `event/workflow/visualizer-gesture.js`; cài đặt `components/gesture-settings-drawer.js`, cụm `gestureSettings`, `visualizerGesture` |
| HUD (tốc độ, âm lượng…) | `core/hud.js`; cụm `hud` |
| Dựng canvas | `core/canvas-scene-setup.js`; màu `core/color-utils.js` |
| Cao độ (pitch) | worker `core/workers/pitch-worker.js` (ngoài kiến trúc Bus) |

## 7. Game

| Muốn sửa... | Vào file... |
|---|---|
| Danh mục game | `components/game-panel.js`, `core/gameplay/catalog.js`, `core/gameplay/game-panel-ui.js`; cụm `gameCatalog` |
| Lối chơi, chấm điểm | `core/gameplay/engine.js`, `engine-ui.js`, `circle-mode.js`, `circle-mode-ui.js`; `event/workflow/gameplay.js`, `event/workflow/gameplay-engine.js`; overlay `components/gameplay-overlay.js`; state `service/state/gameplay-runtime.js`; cụm `gameplay` |
| Phép toán Rubik | `core/rubik-math.js` |

## 8. Trang riêng

| Muốn sửa... | Vào file... |
|---|---|
| Trang Subtitle Editor (`subtitle-editor.html`) | `event/listener/subtitle-editor.js` → `event/router/subtitle-editor.js` → `event/workflow/subtitle-editor.js`; core `core/subtitle/subtitles*.js`, `subtitle-karaoke.js`, `core/audio-segment.js`; state `service/state/subtitle-editor.js`, `service/state/record/subtitle-editor.js` |
| Trang Video Editor (`video-editor.html`) | Cụm `videoPreview` (`event/*/video-preview.js`), `components/video-preview.js`; core `core/video-editor/*.js` (WebCodecs, filmstrip, OPFS tạm, kiểm tương thích); state `service/state/video-preview.js`, `service/state/record/video-editor.js` |
| Build CSS Tailwind | `tailwind.config.js` ([tailwind-build.md](./tailwind-build.md)) |
| Service Worker (tải file lớn) | `sw.js` |

← [Quay lại README](../README.md)
