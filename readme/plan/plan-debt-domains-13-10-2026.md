# Plan v14 — hàng đợi dọn nợ theo miền (lập 13/10/2026)

Nguồn số liệu: [core-legacy-audit.md](../core-legacy-audit.md) sau đợt Folder — **1152 FAIL / 139 file**, 10 chờ chốt
(`requestAnimationFrame` thô). Plan này chỉ sắp **thứ tự và cách gom**; không đổi rule nào
([core-function-conventions.md](../core-function-conventions.md), [event-bus-flow.md](../event-bus-flow.md),
[task-manager-conventions.md](../task-manager-conventions.md)).

Thay phần thứ tự của [plan-debt-cleanup-02-10-2026.md](./plan-debt-cleanup-02-10-2026.md) (chia đợt theo file Workflow).
Bộ khuôn sửa K1–K8 ở plan đó vẫn dùng nguyên.

## 1. Nguyên tắc

1. **Theo miền, trong miền làm Core trước rồi tới Workflow.** Sửa nợ core (Rule 2/3a/3b/5a) luôn đẩy việc lên Workflow gọi
   nó; làm core trước thì API core chốt 1 lần, Workflow dọn 1 lần trên API cuối (kèm gộp `get([…])`).
2. **Dễ trước, khó sau.** Thứ tự ưu tiên: ít dòng nợ → không đụng luồng phát / dữ liệu / iOS → không phải hot path.
3. **Mỗi đợt 1 patch**, Giang test máy xong mới sang đợt sau. Đợt > ~40 dòng chia lượt a/b/c.
4. **Mỗi đợt kèm:**
   - Method bị đụng dọn luôn nợ của nó; gặp bug thì sửa luôn theo rule; vi phạm chưa có trong sổ thì sửa hoặc ghi thêm.
   - Xoá comment lạc hậu/lịch sử (SỬA/MỚI/XOÁ kèm ngày, "trước đây…"), rút gọn comment trong file bị đụng.
   - `node --check`; boot harness Chromium (stub CDN) chạy kịch bản của đợt, 0 lỗi JS; checklist phần cần test máy.
   - Nâng `?v=` mọi trang có nạp file đổi; cập nhật sổ (xoá dòng xong, ghi dòng mới), bảng tiến độ ở mục 4.
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

## 3. Hàng đợi

Ký hiệu loại nợ: R1/R2/R3a/R3b/R4/R5a/R5c/R5d = Rule core; WF-DOM / WF-tính / WF-canvas / WF-media / WF-template =
Workflow tự thi hành; WF-§7 = rẽ nhánh không object map; WF-get = chưa gộp `get([…])`; TM-core = `taskManager` trong
core; Timer = timer thô; L-* = Listener; rAF = `requestAnimationFrame` thô (chờ chốt, không tính FAIL).

| Đợt | Bậc | Miền | File chính | FAIL | Còn lại sau đợt | Loại nợ chính |
|---|---|---|---|---|---|---|
| 0 | — | Dọn comment các file đợt Folder | `event/workflow/{playlist,playlist-scope,visual-bg-common,app-boot}.js`, `event/router/playlist.js`, `core/{storage-manager,playlist/main,playlist/actions,file-manager/video}.js`… | 0 | 1152 | Comment lịch sử |
| 1 | 1 | Element Style Editor · Info icon · App Panel nav + Gesture settings | `core/element-style-editor.js`, `core/info-icon-ui.js`, `core/app-panel-nav.js`, `core/sav-logo.js`, `event/workflow/{element-style-editor,gesture-settings}.js` | 13 | 1139 | R3a 5 · R5a 2 · WF-DOM 2 |
| 2 | 1 | Playlist Empty State · Auto-switch visual · EQ | `event/{workflow,router}/playlist-empty-state.js`, `core/auto-switch-visual.js`, `event/workflow/{auto-switch-visual,eq-presets}.js` | 19 | 1120 | WF-get 8 · WF-§7 4 · R3b 2 · Router 1 |
| 3 | 1 | Custom Effect · HUD · Pagination | `core/custom-effect.js`, `core/hud.js`, `core/pagination-ui.js`, `event/workflow/{custom-effect,hud,pagination}.js` | 26 | 1094 | R3a 7 · R5d 7 · WF-tính 4 |
| 4 | 2 | Player display settings · Playlist Filter | `core/player-display-apply.js`, `core/playlist/{filter,filter-presets}.js`, `event/workflow/{player-display-settings,playlist-filter-presets,filter-rule-edit}.js` | 27 | 1067 | R3a 11 · WF-get 8 · WF-DOM 6 |
| 5 | 2 | Folder (phần còn lại) + dọn mồ côi | `core/file-manager/{folder-picker-ui,cleanup}.js` | 21 | 1046 | R5a 12 · TM-core 4 · R3a 3 · R3b 2 |
| 6 | 2 | Statistics + listen stats | `core/statis-panel-ui.js`, `event/workflow/{statis-panel,listen-stats}.js` | 28 | 1018 | R5d 15 · R3a 5 |
| 7 | 2 | Photo/Video gallery (File Manager) | `core/file-manager/photo-ui.js`, `event/workflow/{photo,video}-gallery-window.js`, `file-manager-photo.js` | 32 | 986 | WF-DOM 13 · R5a 11 · R5d 5 |
| 8 | 2 | Theme / UI theme | `core/theme-background-ui.js`, `core/color-utils.js`, `core/ui-theme/{status-bar-color,apply-ui}.js`, `event/workflow/{theme,ui-theme}.js` | 32 (+1 rAF) | 954 | R3a 12 · R5d 7 |
| 9 | 2 | Settings shell | `core/settings-carousel-ui.js`, `core/app-settings-ui.js`, `event/workflow/{app-settings,settings-misc,subtitle-style-settings}.js` | 35 | 919 | R3a 10 · WF-§7 9 · WF-DOM 8 |
| 10 | 2 | Game | `core/gameplay/{game-panel-ui,engine-ui,engine,circle-mode}.js`, `event/workflow/{gameplay,gameplay-engine,game-catalog}.js` | 33 | 886 | R5d 12 · WF-get 6 · WF-media 3 |
| 11 | 3 | Photo Player | `core/photo-player.js`, `event/workflow/{photo-player,photo-duration}.js` | 25 | 861 | R4 6 · WF-get 6 · R2 3 · R3a 3 |
| 12 | 3 | Phụ đề hiển thị · Visualizer UI | `event/workflow/subtitle-display.js`, `core/subtitle/subtitle-karaoke-display-ui.js`, `core/visualizer/visualizer-display.js`, `core/visualizer-control-center.js`, `core/visualizer-gesture.js`, `event/workflow/{visualizer-display,visualizer-gesture}.js` | 36 | 825 | WF-get 8 · WF-tính 7 · R3a 6 |
| 13 | 3 | Vòng đời app (wakelock, ẩn/hiện, boot) | `core/wakelock.js`, `event/workflow/{app-visibility,app-boot,app-cleanup}.js` | 19 | 806 | WF-get 7 · R2 3 · WF-media 2 |
| 14 | 3 | Ghi âm | `event/workflow/recorder.js` | 17 | 789 | WF-media 8 · WF-DOM 3 |
| 15 | 3 | Sửa ảnh | `event/workflow/image-edit.js`, `core/photo-editor-engine.js` | 39 | 750 | WF-DOM 17 · WF-§7 8 · WF-canvas 4 |
| 16 | 3 | Config | `core/config.js` | 37 | 713 | R3a 16 · R3b 16 · TM-core 2 |
| 17a/17b | 3 | Storage + Zip | 17a: `core/storage-manager.js`, `event/workflow/file-manager-storage.js` · 17b: `core/streaming-zip.js`, `event/workflow/zip-download.js`, `core/video-editor/opfs-temp.js` | 60 | 653 | R3a 19 · R5a 10 · Timer 8 · R3b 6 |
| 18a/b/c | 4 | Playlist | 18a core: `core/playlist/{actions,main,loader,render,selection}.js`, `core/{song-search,upload-validation}.js` · 18b: `event/workflow/{playlist-render,playlist-order,playlist-scope}.js` · 18c: `event/workflow/playlist.js` (upload / xoá-xuất / còn lại) | 99 (+1 rAF) | 554 | WF-get 27 · R3a 19 · WF-DOM 15 · R2 7 · R3b 7 |
| 19a/19b | 4 | Player / điều khiển phát | 19a: `core/player-controls.js`, `event/listener/video-player.js` · 19b: `event/workflow/{player,player-controls,media-in-use}.js` | 63 | 491 | R3a 13 · WF-§7 12 · R2 9 · WF-get 9 · L-đọcState 5 |
| 20 | 4 | Video Player | `core/video-player.js`, `event/workflow/{video-player,video-motion-surface,video-frame-capture,video-thumb-extract}.js` | 48 (+4 rAF) | 443 | WF-DOM 16 · WF-media 10 · WF-§7 7 |
| 21a/21b | 4 | Visual Background | 21a: `core/visual-bg-common.js`, `event/workflow/visual-bg-common.js`, `event/listener/visual-bg.js` · 21b: `event/workflow/visual-bg-{video,photo,photo-motion}.js` | 66 | 377 | WF-DOM 24 · WF-§7 20 · WF-tính 6 |
| 22a/22b | 4 | Motion | 22a: `core/motion-presets.js`, `event/workflow/motion-presets.js` · 22b: 3 runner `event/workflow/motion-*-runner.js` | 56 | 321 | WF-DOM 22 · R3a 21 · WF-tính 11 |
| 23a/23b | 5 | Visualizer render (hot path) | 23a core: `core/visualizer/{draw/window-frame,effect-paint}.js`, `core/rubik-math.js`, core group (`clock`, `dot`, `black-hole`, `bar/common`, `rain/street`, `fireworks`), `core/webgl/three-connector.js` · 23b: `event/workflow/visualizer/*.js`, `visualizer-render.js`, `audio-analysis.js`, `audio-engine.js`, `perf-hud.js` | 75 | 246 | WF-tính 30 · R2 11 · R1 11 · WF-canvas 8 |
| 24a/b/c | 5 | Trang Subtitle Editor | `core/subtitle/{subtitles-ui,subtitles}.js`, `event/listener/subtitle-editor.js`, `event/workflow/subtitle-editor.js` | 126 (+1 rAF) | 120 | WF-get 44 · WF-DOM 32 · WF-tính 16 · R3a 13 · R5a 10 |
| 25a/25b | 5 | Trang Video Editor | `core/video-editor/{webcodecs-engine,filmstrip}.js`, `event/workflow/video-preview.js` | 71 | 49 | WF-get 21 · WF-DOM 14 · WF-tính 12 · WF-§7 10 |
| 26a/26b | Cuối | Hạ tầng UI dùng chung | 26a: `core/dropdown-menu.js`, `core/loading-shield-util.js`, `event/workflow/generic-drawer-helpers.js`, `core/modal-choice-ui.js` · 26b: `core/slider-input-modal.js`, `core/time-picker-modal.js`, `core/point-move-timing-ui.js` | 49 (+3 rAF) | 0 | R5a 17 · R3a 13 · R5c 3 · Timer 2 |

Tổng 1152 FAIL. 10 dòng `requestAnimationFrame` thô dọn theo miền chứa nó khi Giang chốt cách xử lý (taskManager mode
`raf` hay giữ).

### Ghi chú theo đợt

- **0** — Không đổi code; đối chiếu chuỗi token trước/sau để chứng minh chỉ đổi comment (khuôn đợt dọn comment 12/10).
- **5** — `folder-picker-ui.js` còn hẹn giờ giữ tay bằng `taskManager` trong core (TM-core 4) → dời phiên giữ tay về Workflow.
- **11** — Đợt 2 của plan 02/10 (`photo-player.js`), giờ kèm `core/photo-player.js`; `app-boot.js` dời sang đợt 13.
- **13** — Kèm xoá `retireLegacyDownloadServiceWorker()` (core/file-manager/cleanup.js) + `workflowAppBoot._retireLegacyDownloadServiceWorker()` — Giang hẹn xoá ở ver 14; để tới đợt này vì phải đụng `boot()`.
- **13, 14, 19, 20** — Có iOS (phát nền, Media Session, khoá màn hình, mic): checklist máy bắt buộc.
- **16** — `core/config.js` đọc `localStorage`/DB trong core và hẹn giờ ghi backup → Workflow config mới hoặc
  `workflowSettingsMisc`; boot phải chạy với config cũ, hỏng, thiếu field.
- **18–22** — Tương ứng đợt 3–7 của plan 02/10 (giữ yêu cầu "thứ tự các bước giữ nguyên tuyệt đối" của `playMedia()`).
- **23** — Chỉ object map + guard; đo FPS trước/sau (Perf HUD) trên máy; giữ thứ tự tiêu thụ `Math.random()`.
- **26 (cuối, Giang chốt)** — `dropdown-menu`, `slider-input-modal`, `time-picker-modal` còn gắn sự kiện gọi callback (R5a) và
  thiếu hậu tố `-ui` (R5c, đổi tên file kéo theo `index.html` + 2 trang + script-load-order.md). `modalChoice()` giữ ngoại lệ
  đã audit, chỉ dọn phần R1/R3a. Đổi API ở đây kéo theo sửa lại nơi gọi ở các miền đã dọn — chấp nhận, gom vào cùng đợt.

## 4. Tiến độ

| Đợt | Trạng thái |
|---|---|
| Folder (trước plan này) | Xong 13/10/2026 (`sav-14-debt-folder-patch.zip`), chờ test máy — 1194 → 1152 |
| 0 | Chưa làm |
| 5 — Folder phần còn lại | Xong 13/10/2026 (`sav-14-debt-wave5-folder-patch.zip`), chờ test máy — 1152 → 1131 |
| Còn lại 1–4, 6–26 | Chưa làm |

← [Quay lại README](../../README.md)
