# Muốn sửa gì thì sửa ở đâu?

> Viết lại toàn bộ ở ver 11 — mọi đường dẫn `js/...` của bản trước đã lỗi thời (xem
> [folder-structure.md](./folder-structure.md)). Từ ver 11, phần lớn LOGIC nghiệp vụ (không phải
> UI/hàm core thuần) chạy qua kiến trúc `/event/` — xem 2 hàng đầu tiên trước khi tìm các hàng còn
> lại, vì "sửa hành vi khi bấm 1 nút" giờ thường nằm ở **router**, không phải ở nơi gắn listener.

## Kiến trúc chung — đọc trước

| Muốn... | Vào... |
|---|---|
| Sửa hành vi khi 1 nút/input được bấm/đổi (nghiệp vụ, không phải browser lifecycle) | Tìm đúng `msg.type` trong `event/listener/<cụm>.js` → LOGIC THẬT nằm ở `event/router/<cụm>.js` (nếu chỉ 1 hàm core) hoặc `event/workflow/<cụm>.js` (nếu nhiều bước/có shield/modal) — xem bảng 14 cụm ở [changelog/v11.md](./changelog/v11.md) mục 2 để biết cụm nào có workflow |
| Thêm 1 listener DOM mới cho nghiệp vụ đã có cụm | Thêm vào ĐÚNG `event/listener/<cụm>.js` đã có sẵn, gửi `eventBus.send({ router: '<cụm>', type: '<cụm>.hànhĐộng.sựKiện', payload })`, thêm `case` tương ứng ở `event/router/<cụm>.js` — bắt buộc đối chiếu `msg.type` khớp nhau giữa 2 file + `node --check` cả 2 sau khi sửa |
| Thêm 1 cụm nghiệp vụ hoàn toàn mới | Tạo cả 3 file `event/router/<cụm>.js` (bắt buộc, tự `eventBus.register()`), `event/listener/<cụm>.js` (bắt buộc), `event/workflow/<cụm>.js` (chỉ nếu >1 hàm core hoặc cần shield/modal) — thêm đúng thứ tự 3 dòng `<script>` vào cuối `index.html` (workflow → router → listener), xem [script-load-order.md](./script-load-order.md) mục 5 |
| Đọc/ghi 1 biến state nghiệp vụ toàn app (không phải context riêng của 1 router) | `service/state.js` — thêm key vào `STATE_SCHEMA` (kèm kiểu dữ liệu) + giá trị khởi tạo trong `STATE`, đọc/ghi qua `appState.get('key')`/`appState.set('key', value)`/`appState.mutate('key', fn)` ở MỌI nơi, không khai `let` cục bộ mới |
| Đọc/ghi state chỉ dùng RIÊNG trong 1 router (context giữa 2 message liên tiếp) | `new EventStore('tênRouter')` ngay trong file router đó — xem comment đầu `event/store.js` |
| Thêm 1 hằng số cấu hình mới (không đổi trong lúc chạy) | `service/state.js` — thêm vào `CONST` (`Object.freeze`) theo đúng kiểu, đọc qua `CONST.xxx` ở nơi dùng. `core/config.js` chỉ còn giữ local `EQ_FREQS`/`EQ_LABELS` (2 hằng KHÔNG thuộc `CONST`) |

## Theo tính năng cụ thể

| Muốn sửa... | Vào file... |
|---|---|
| Giao diện danh sách bài hát | `components/playlist-view.js` |
| Logo "SAV" góc trái Playlist (wordmark) | `components/playlist-view.js` (khối `#sav-logo`); logic mở/thu ở `core/sav-logo.js` (`setSavLogoExpanded()`), gắn qua `event/listener,router/sav-logo.js` (cụm `savLogo`, patch 6) |
| Tab "Ảnh bìa" trong modal sửa thông tin bài hát | `components/playlist-view.js` (HTML 2 tab trong `#song-edit-modal`), `core/playlist/actions.js` (logic lưu); listener/router qua cụm `playlist` |
| Menu "Chọn file nhạc / Chọn cả thư mục" | `components/playlist-view.js` (HTML `#upload-action-menu`), `core/playlist/loader.js` (`handleAudioFiles()`); listener/router qua cụm `playlist` |
| Modal hỏi quyết định dùng chung | `core/modal-choice.js` (`modalChoice(text, buttons, options?)`) — hạ tầng dùng chung, KHÔNG qua bus (xem lý do ở [folder-structure.md](./folder-structure.md)) |
| Modal "Tiếp tục nghe?" sau khi tab bị ẩn | `core/player-controls.js` (`showResumeChoiceModal()`), `core/resume-state-storage.js` (lưu/đọc qua localStorage, `checkPendingResumeStateOnBoot()`), `core/tab-hide-reload.js` (phát hiện ẩn tab thật vs F5) |
| Mọi timer lặp/bắn-một-lần | `core/task-manager.js` (instance global `taskManager` — `addNew`/`once`/`pause`/`resume`/`kill`/`isTaskRunning`) |
| "Xoá hết dữ liệu" / tải nhạc về rồi xoá | `core/storage-manager.js` (`clearAllStoredData`); UI/listener/router qua cụm `settingsMisc` (patch 5, nhánh `storageDrawer`) |
| Khởi động lại app / Khôi phục cài đặt mặc định | `core/app-recovery.js`; UI ở `components/settings/misc.js`; listener/router qua cụm `settingsMisc` (patch 5, nhánh `appRecovery`) |
| Dọn tài nguyên khi tab đóng thật (F5/điều hướng) | `core/app-cleanup.js` (`executeAppCleanup()`), gọi từ `event/tab.js` |
| Toggle ẩn/hiện dải BPM/Pitch/Energy | `core/stats-panel-toggle.js`; UI nút ở `components/visualizer-overlay.js` (`#btn-toggle-stats-panel`); listener/router qua cụm `statsPanel` (patch 4) |
| Đa ngôn ngữ (i18n) — bộ điều phối, dịch text | `lang/lang.js` (`LANG_EN_KEYS` gộp từ `lang/patch/*.js`, English cứng RAM, gốc/fallback). Hàm `t(key, fallback?)`/`tFormat(key, vars)` |
| Đa ngôn ngữ — thêm/sửa 1 key dịch | `lang/patch/*.js` (đúng file patch theo namespace — xem comment đầu `lang/lang.js`) |
| Đa ngôn ngữ — UI chọn/upload/xóa ngôn ngữ | `components/settings/language.js` (HTML), `lang/language-settings.js` (`renderLanguageOptions()`); listener/router qua cụm `languageSettings` (patch 7) |
| Đa ngôn ngữ — lưu trữ IndexedDB | `core/db.js` (store `languages`, `DB_VERSION` 3, CRUD `getLanguagePack`/`setLanguagePack`/`deleteLanguagePack`/`getAllLanguageCodes`) |
| Kiểu xem (Danh sách/Lưới) + Sắp xếp Playlist | `components/settings/playlist-background.js` (HTML), `core/playlist/main.js` (`initViewMode()`/`initSortMenu()`); listener/router qua cụm `playlist` |
| Tự động đổi hiệu ứng Visualizer theo thời gian | `core/auto-switch-visual.js`; UI ở `components/visualizer-settings-drawer.js`; listener/router qua cụm `autoSwitchVisual` (patch 10) |
| Giao diện ngăn cài đặt — khung ngoài | `components/settings-drawer.js` (object `SettingsDrawer`) |
| Giao diện ngăn cài đặt — nội dung từng khối | `components/settings/*.js` (6 file — Playlist&Nền / Visualizer / Audio EQ / Phụ đề / Khác / Ngôn ngữ) |
| Drawer "Tùy chỉnh Visualizer" | `components/visualizer-settings-drawer.js` |
| Visual "Bar" | `core/visualizer/types/bar.js` |
| Visual "Rain" | `core/visualizer/types/rain.js` |
| Visual "Rubik" | `core/visualizer/types/rubik.js` (map nốt→trục ở `RUBIK_NOTE_TO_TURN` trong `core/dom-refs.js`) |
| Visual Lightning / Black Hole | `core/visualizer/types/lightning.js`, `black-hole.js` |
| Vòng lặp render chính, thêm visual mới | `core/visualizer/draw-visualizer.js` (object `VISUALIZER_DRAWERS`, và điểm khởi động app trong `DOMContentLoaded`) |
| Hàm vẽ dùng chung | `core/visualizer/draw-helpers.js` |
| Điều khiển hiển thị Visualizer (màu/EQ mode/bar style...) | `core/visualizer/visualizer-display.js`; listener/router qua cụm `visualizerDisplay` (có workflow) |
| Mở/đóng drawer Visualizer/Subtitle, đổi kiểu hiệu ứng, giữ màn hình sáng | `core/visualizer/visualizer-misc-settings.js`; listener/router qua cụm `visualizerMiscSettings` (patch 13) |
| Control Center (panel 6 icon trên Visualizer) | `components/visualizer-overlay.js` (HTML), `core/state-and-video-bg.js` (mở/đóng panel); listener/router/workflow qua cụm `visualizerControlCenter` (patch 11) |
| Logic phát nhạc, next/prev, shuffle | `core/playlist/actions.js` (`playSong`), `core/playlist/order.js` (hàng đợi/shuffle), `core/player-controls.js` (next/prev/toggleShuffle); listener/router qua cụm `playerControls` (patch 3) — 16/17 msg.type KHÔNG có workflow, RIÊNG `shuffle.click` có `event/workflow/player-controls.js` (MỚI 03/07/2026, trộn theo "hiện hành" — xem comment đầu file) |
| Lưu trữ IndexedDB (nhạc/tag/cover/sub/ảnh-video nền) | `core/db.js` |
| Lưu/đọc state phát nhạc qua localStorage khi tab bị ẩn | `core/resume-state-storage.js` (bao gồm vị trí video nền `videoCurrentTime`) |
| Validate định dạng file upload | `core/upload-validation.js` |
| Che màn hình khi xử lý | `core/loading-shield-util.js` (`withLoadingShield`) |
| Sửa tag/info/ảnh bìa/export | `core/playlist/actions.js` (modal sửa), `core/id3-export.js` (export APIC) |
| Thuật toán sort / ô tìm kiếm / tách hiển-thị khỏi hàng-đợi-phát | `core/playlist/order.js`, `core/playlist/render.js`, `core/playlist/main.js` |
| Số lần nghe / thời gian nghe riêng từng bài | `core/listen-stats.js`, cộng dồn ở `core/player-controls.js` |
| Giữ màn hình sáng (wake lock) | `core/wakelock.js` (`requestWakeLock`/`releaseWakeLock`, gate theo `appState.get('vizConfig').keepScreenOn`); UI ở `components/settings/misc.js` |
| Ẩn tab (reload + resume state) | `core/tab-hide-reload.js` (`triggerHideAndReload()`), `event/tab.js` (3 lifecycle listener), `core/app-cleanup.js` (dọn khi đóng tab thật) |
| Video nền (bật/tắt, gán src, chống chớp trắng) | `core/state-and-video-bg.js` (`handleVideoBackground`) |
| Thống kê "Về trình phát" (About Drawer) | `core/about-stats.js`, `components/about-drawer.js`; listener/router qua cụm `settingsMisc` (nhánh `aboutDrawer`) |
| Hiện/ẩn khối setting theo kiểu visualizer/bar đang chọn | `core/player-controls.js` (`updateTypeUI`, `updateBarStyleUI`) |
| Equalizer | `core/equalizer.js`; UI ở `components/settings/audio-eq.js`; listener/router qua cụm `equalizerSettings` (patch 14, 1 listener delegation) |
| Phụ đề (.srt) — logic | `core/subtitle/subtitles.js`, `core/subtitle/subtitle-display.js`; style khung/chữ — `core/subtitle/subtitle-style-settings.js`, UI ở `components/settings/subtitle-style.js`; listener/router qua cụm `subtitleModal` (modal, có workflow) và `subtitleStyleSettings` (style, patch 12) |
| Hiệu ứng Vortex (Three.js) | `core/three-vortex.js` (khởi tạo) + `core/visualizer/types/vortex.js` (mỗi khung hình) |
| Khởi tạo đèn đường/hàng rào/mưa phố | `core/canvas-scene-setup.js` (`generateStreetScene`, `getPlayerBarSafeHeight`) |
| Phát hiện pitch (YIN), nốt MIDI cho Rubik | `core/audio-analysis.js` (`updateStatsDashboard`), `core/audio-engine.js` + `core/pitch-worker.js` (Worker riêng) |
| Thêm trường cấu hình mới (lưu vào `vizConfig`) | `service/state.js` (giá trị mặc định trong `CONST.DEFAULT_VIZ_CONFIG`) + đọc/ghi qua `appState.get/set('vizConfig')` ở nơi dùng |
| Màu sắc, nền | `core/color-utils.js` |
| Toàn bộ CSS, theme kính mờ | `assets/css/style.css` |

← [Quay lại README](../README.md)
