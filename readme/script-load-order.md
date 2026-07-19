# Thứ tự nạp script — QUAN TRỌNG, không thay đổi

> Viết lại toàn bộ ở ver 11 (bản trước còn nguyên bước đánh số 0–4 kiểu cũ, đường dẫn `js/...` lỗi
> thời). Thứ tự dưới đây lấy trực tiếp từ `<script src="...">` thật trong `index.html`, theo đúng
> khối — không gõ tay lại từ trí nhớ.

`index.html` nạp theo đúng **6 khối tuần tự**, mọi `<script>` đều KHÔNG `async`/`defer` nên chạy
đồng bộ đúng thứ tự xuất hiện (đây là điều kiện AN TOÀN cho toàn bộ thiết kế bên dưới):

## 0. CDN (`<head>`)

Tailwind, jsmediatags, NoSleep.js, Three.js, idb-keyval, browser-id3-writer, JSZip (mới từ tính
năng "Tải toàn bộ rồi xoá"). CSS: `assets/css/style.css`.

## 1. `lang/patch/*.js` rồi `lang/lang.js`

5 file patch (thứ tự nội bộ không quan trọng — key không trùng nhau giữa các patch), sau đó
`lang/lang.js` gộp lại bằng `Object.assign()` + định nghĩa `t()`/`tFormat()`. Đây là nhóm DUY NHẤT
nạp TRƯỚC `components/*.js` — lý do: mọi template `TPL_*` gọi `t()` NGAY LÚC PARSE (template
literal cấp module, chạy đồng bộ ngay khi file được nạp, sớm hơn cả `DOMContentLoaded`), nên `t()`
phải tồn tại sẵn trước khi bất kỳ file component nào chạy. `lang.js` tự đứng độc lập, không cần
`db.js`/DOM có mặt lúc định nghĩa — các hàm cần IndexedDB (`saveLanguagePack`/`applySavedLanguage`/
`listAvailableLanguages`) chỉ thực sự gọi tới khi người dùng tương tác (luôn sau khi `db.js` đã nạp
xong từ lâu).

## 2. `components/*.js` (kể cả `components/settings/*.js`)

Chỉ định nghĩa biến `TPL_...` (chuỗi HTML), chưa đụng vào DOM. `components/settings/*.js` (6 file)
PHẢI nạp TRƯỚC `components/settings-drawer.js` — file đó chỉ là object điều phối
`SettingsDrawer.build()` ghép 6 biến `TPL_SETTINGS_*` lại thành `TPL_SETTINGS_DRAWER`.

## 3. `main.js`

Chèn toàn bộ `TPL_...` vào `<div id="app-root">`. Sau bước này, mọi phần tử có `id="..."` mới thực
sự tồn tại trong DOM.

## 4. `core/*.js` (đường dẫn ĐÚNG theo `index.html` thật, thứ tự đầy đủ)

Các file này gọi `document.getElementById(...)` ngay khi được nạp, nên phải chạy sau bước 3. Thứ
tự trong nhóm này có phụ thuộc chặt giữa các file — **không đảo**:

```
core/modal-choice.js            ← ngay sau main.js, không cần ref DOM đặc biệt (tự dựng DOM riêng)
service/operation.js            ← [ver 12] so sánh toán tử dùng chung cho event/block.js +
                                   event/virtual-machine-state.js — không phụ thuộc gì, an toàn ở
                                   bất kỳ đâu TRƯỚC event/bus.js, đặt cạnh service/state.js cho
                                   cùng nhóm "service/"
service/state.js                ← [v11] PHẢI nạp SAU modal-choice.js (options.notifyUI dùng alertModal),
                                   TRƯỚC core/config.js (bootstrap vizConfig) và TRƯỚC toàn bộ core/ còn lại
core/config.js
event/store.js                  ← EventStore, nạp SỚM vì core/playlist/actions.js cần `new EventStore(...)`
core/dom-refs.js
core/sav-logo.js
service/task-manager.js            ← taskManager PHẢI có mặt sớm — hầu hết core/* gọi taskManager.once()/
                                   addNew() ngay khi gắn listener lúc parse
service/db.js
core/resume-state-storage.js
core/upload-validation.js
core/listen-stats.js
core/loading-shield-util.js
core/webgl/three-vortex.js
core/webgl/three-space.js
core/state-and-video-bg.js
core/subtitle/subtitles.js
core/equalizer.js
core/subtitle/subtitle-style-settings.js
core/visualizer/visualizer-misc-settings.js
core/subtitle/subtitle-display.js
core/tab-hide-reload.js         ← [v11] PHẢI nạp SAU resume-state-storage.js/dom-refs.js
core/wakelock.js                ← [v11] PHẢI nạp SAU tab-hide-reload.js (đọc _isRealUnloadHappening
                                   qua STATE) và SAU config.js/dom-refs.js (vizConfig, audioPlayer)
core/color-utils.js
core/canvas-scene-setup.js
core/playlist/state.js          ← rồi order.js → render.js → loader.js → actions.js → main.js
core/playlist/order.js            (thứ tự nội bộ CỐ ĐỊNH — file sau dùng hàm/biến của file trước;
core/playlist/render.js            playlist/main.js tự gọi PlaylistMain.init() ở cuối)
core/playlist/loader.js
core/playlist/actions.js
core/playlist/main.js
core/player-controls.js
core/audio-engine.js
core/app-cleanup.js             ← [v11] PHẢI nạp SAU dom-refs.js/listen-stats.js/player-controls.js/
                                   db.js/wakelock.js (executeAppCleanup() cần cả 5)
core/stats-panel-toggle.js      ← PHẢI nạp TRƯỚC audio-analysis.js (đọc isStatsPanelVisible)
core/audio-analysis.js
core/rubik-math.js
core/about-stats.js
core/app-recovery.js
lang/language-settings.js       ← nạp SAU app-recovery.js (cần ref DOM của nút mới + HTML thật)
core/id3-export.js
core/storage-manager.js
core/visualizer/visualizer-display.js
core/auto-switch-visual.js      ← cần MODES/currentModeIndex/updateTypeUI/saveConfig/audioPlayer
                                   đã có ref, và taskManager đã tồn tại
core/visualizer/draw/*.js       ← 5 file (MỚI 19/07/2026, tách từ draw-helpers.js cũ — mỗi hàm 1
                                   file: water-drop.js/window-frame.js/spaceship-frame.js/
                                   space-collision-flash.js/flying-note.js), không phụ thuộc thứ
                                   tự lẫn nhau
core/visualizer/types/*.js      ← 7 file (MỚI 19/07/2026: +space.js), không phụ thuộc thứ tự lẫn nhau
core/visualizer/draw-visualizer.js  ← nạp SAU CÙNG trong khối core/ — gọi tới các hàm draw* ở
                                   types/, và chứa document.addEventListener('DOMContentLoaded', ...)
                                   — ĐIỂM KHỞI ĐỘNG THỰC SỰ của app (await loadConfig();
                                   updateSubToggleUI(); await loadSongStats(); checkPendingResume-
                                   StateOnBoot(); await initPlaylistFromDB(); enableResumeModal-
                                   ButtonsWhenPlaylistReady())
```

> **Lưu ý riêng `core/pitch-worker.js`:** KHÔNG nằm trong danh sách `<script src="...">` — được nạp
> bằng `new Worker('core/pitch-worker.js')` ngay trong `audio-engine.js`, chạy trên thread hoàn
> toàn riêng biệt, không chia sẻ global scope (không dùng `appState`/`eventBus`/bất kỳ global nào
> khác của app).

## 5. `event/*` — kiến trúc bus, [v11] NẠP CUỐI CÙNG TUYỆT ĐỐI

Lý do: mọi router/workflow ở đây CHỈ GỌI LẠI các hàm core đã định nghĩa từ toàn bộ khối 4 phía
trên — không có lý do gì để bất kỳ file `core/`/`components/` phải biết `/event/` tồn tại. An toàn
về thứ tự: `draw-visualizer.js` (cuối khối 4) chỉ ĐĂNG KÝ `'DOMContentLoaded'` (chưa CHẠY logic bên
trong), nên toàn bộ `eventBus.register(...)` dưới đây luôn hoàn tất TRƯỚC KHI `DOMContentLoaded`
thực sự bắn ra.

**Thứ tự NỘI BỘ trong khối này** — "workflow nạp trước → router đăng ký tiếp → listener cuối cùng":

```
event/bus.js                        ← TỔNG ĐÀI, phải có trước để router register() được
                                       (event/store.js KHÔNG nằm ở đây — đã nạp sớm hơn nhiều, xem
                                       khối 4 phía trên)

event/block.js                      ← [ver 12] DATA đăng ký chặn msg.type (eventBus.registerBlock),
                                       hiện ĐANG RỖNG — chưa có entry, chờ rà soát phạm vi migrate
event/virtual-machine-state.js      ← [ver 12] object VirtualMachineState.run(), không tự chạy gì
                                       lúc nạp, chờ router gọi tới
  (cả 2 file trên: nạp ngay sau bus.js, TRƯỚC toàn bộ workflow/router/listener theo cụm vì có thể
  bị dùng xuyên nhiều cụm khác nhau — không phụ thuộc appState/msg/core/workflow nên vô hại tuyệt
  đối dù có nạp mà chưa router nào gọi tới)

<mỗi cụm, theo đúng thứ tự trong index.html — xem bảng patch ở changelog/v11.md mục 2>
  event/workflow/settings-misc.js → event/router/settings-misc.js → event/listener/settings-misc.js
  event/workflow/playlist.js → event/router/playlist.js → event/listener/playlist.js
  event/workflow/player-controls.js → event/router/player-controls.js → event/listener/player-controls.js
                                       (MỚI 03/07/2026, fix mục 3b — trước đây "không có workflow")
  event/workflow/visualizer-display.js → event/router/visualizer-display.js → event/listener/visualizer-display.js
  event/router/stats-panel.js → event/listener/stats-panel.js                 (không có workflow)
  event/router/sav-logo.js → event/listener/sav-logo.js                       (không có workflow)
  event/workflow/language-settings.js → event/router/language-settings.js → event/listener/language-settings.js
  event/workflow/playlist-empty-state.js → event/router/playlist-empty-state.js → event/listener/playlist-empty-state.js
                                       (MỚI 03/07/2026, fix mục 3a — trước đây "không có workflow")
  event/workflow/subtitle-modal.js → event/router/subtitle-modal.js → event/listener/subtitle-modal.js
  event/router/auto-switch-visual.js → event/listener/auto-switch-visual.js   (không có workflow)
  event/workflow/visualizer-control-center.js → event/router/visualizer-control-center.js → event/listener/visualizer-control-center.js
  event/router/subtitle-style-settings.js → event/listener/subtitle-style-settings.js (không có workflow)
  event/router/visualizer-misc-settings.js → event/listener/visualizer-misc-settings.js (không có workflow)
  event/router/equalizer-settings.js → event/listener/equalizer-settings.js   (không có workflow)

event/tab.js                        ← CUỐI CÙNG trong toàn bộ /event/ — phụ thuộc core/tab-hide-
                                       reload.js + core/app-cleanup.js đã nạp từ khối 4
```

Trong 1 cụm: **workflow trước** (router gọi vào đó) → **router** (đăng ký với bus NGAY lúc nạp) →
**listener cuối** (cần `eventBus.send()` tồn tại và router đã đăng ký xong để nhận message).

← [Quay lại README](../README.md)
