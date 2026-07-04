# Cấu trúc thư mục

> Cập nhật lại ở ver 12 — bản trước (viết ở ver 11) đã thiếu 3 file mới của ver 12
> (`service/operation.js`, `event/block.js`, `event/virtual-machine-state.js`) và 3 tài liệu mới
> trong `readme/`. Cây bên dưới lấy trực tiếp từ `find` chạy trên source thật + đối chiếu
> `index.html`, không gõ tay lại từ trí nhớ.
>
> **Bỏ hệ thống đánh dấu ★/`[vXX]` gắn trực tiếp vào cây thư mục** (từng dùng tới ver 11) — cây
> dưới đây chỉ mô tả HIỆN TRẠNG (file này LÀ GÌ/LÀM GÌ ngay bây giờ), không lẫn lịch sử thay đổi
> vào tên/mô tả file nữa. Toàn bộ lịch sử "bản nào thêm/sửa/xoá file gì" chuyển hẳn sang **bảng
> version v1–v12** ở cuối file này — 1 nguồn duy nhất cho việc tra cứu lịch sử, tránh vừa phải đọc
> annotation trong cây vừa phải đọc changelog riêng như trước.

```
visual-master/
├── README.md                    ← file gốc (root)
├── readme/
│   ├── changelog-index.md
│   ├── folder-structure.md      ← file bạn đang đọc
│   ├── event-bus-flow.md        — sơ đồ đầy đủ luồng /event/ (listener→router→core/workflow/
│   │                              VirtualMachineState), quy tắc chọn nhánh nào trong 1 case
│   ├── core-function-conventions.md — 4 rule bắt buộc cho function Core/nghiệp vụ MỚI viết/sửa
│   │                              từ ver 12: đơn tuyến nghiệp vụ, không tự đọc appState, core-gọi-
│   │                              core chỉ hợp lệ khi dùng return value, log khi set/mutate state
│   ├── core-legacy-audit.md     — nợ kỹ thuật chính thức: 150/266 function core hiện có (đã loại
│   │                              hot-path) vi phạm ≥1 rule ở core-function-conventions.md
│   ├── script-load-order.md
│   ├── task-manager-conventions.md — MỚI 04/07/2026: mọi setInterval/setTimeout PHẢI qua
│   │                              `taskManager`, CHỈ Workflow được dùng (Core/Router/Listener cấm)
│   ├── usage.md
│   ├── visual-conventions.md
│   ├── where-to-edit.md
│   ├── why-no-es6-module.md
│   └── changelog/
│       ├── v1.md … v9.md
│       ├── v10.md, v10-mini-not-full-fix.md, v10-lang-test.md
│       ├── v11.md               — hoàn tất kiến trúc /event/ + State tập trung + 3 lỗi nhỏ
│       └── v12.md               — hạ tầng block/virtual-machine-state cho /event/, quy tắc Core
├── index.html                   ← Mở file này để chạy ứng dụng
├── favicon.png
├── main.js                      ← chèn toàn bộ TPL_* (components/) vào #app-root
│
├── assets/
│   └── css/
│       └── style.css            (toàn bộ CSS, 1 file duy nhất)
│
├── lang/                        (đa ngôn ngữ — i18n)
│   ├── lang.js                  — gộp 5 patch bằng Object.assign(), định nghĩa t()/tFormat()/
│   │                              validateLanguagePack()/saveLanguagePack()/applySavedLanguage()/
│   │                              listAvailableLanguages()/applyLanguageToDom(). Nạp NGAY ĐẦU
│   │                              <body>, TRƯỚC TOÀN BỘ components/*.js
│   ├── language-settings.js     — xử lý UI section "Ngôn ngữ": renderLanguageOptions(), logic gọi
│   │                              bởi event/router/settings-misc.js (không tự addEventListener)
│   └── patch/                   — 5 file default-key tiếng Anh, viết .js (không .json — file://
│       ├── patch-common.js         không fetch() được file tĩnh). Thứ tự nội bộ không quan trọng,
│       ├── patch-playlist.js       cả 5 PHẢI nạp TRƯỚC lang.js.
│       ├── patch-settings-misc.js
│       ├── patch-subtitle-settings.js
│       └── patch-visualizer.js
│
├── components/                  (chỉ định nghĩa biến TPL_* — chuỗi HTML, KHÔNG đụng DOM)
│   ├── loading-shield.js
│   ├── playlist-view.js         — logo "SAV" (hover JS toggle), 2 tab modal sửa bài (Thông tin/
│   │                              Ảnh bìa), menu "Chọn file/Chọn cả thư mục"
│   ├── visualizer-overlay.js    — Control Center 6 icon (Đổi hiệu ứng/Phụ đề/Cài đặt/Trộn bài/
│   │                              Lặp lại/Thống kê) + #btn-back-playlist tách riêng
│   ├── subtitle-modal.js
│   ├── subtitle-settings-drawer.js
│   ├── bottom-player.js
│   ├── settings/                — 6 section HTML tách rời (mỗi file 1 biến TPL_SETTINGS_*)
│   │   ├── playlist-background.js  (Video BG, ảnh nền, kiểu xem, sắp xếp)
│   │   ├── visualizer-geometry-color.js (chất lượng render, hình học, màu sắc, toggle Hiện Visual)
│   │   ├── audio-eq.js             (volume, preset EQ, dải tần số thủ công)
│   │   ├── subtitle-style.js       (style khung/chữ phụ đề)
│   │   ├── misc.js                 (giữ màn hình sáng, About Drawer, Khắc phục sự cố)
│   │   └── language.js             (chọn/upload/xóa ngôn ngữ — đặt SAU CÙNG)
│   ├── settings-drawer.js       — object điều phối SettingsDrawer.build() ghép 6 biến TPL_SETTINGS_*
│   ├── about-drawer.js
│   ├── storage-drawer.js
│   └── visualizer-settings-drawer.js  (Chất lượng/Hình học-Màu sắc/Tự động đổi hiệu ứng)
│
├── core/                        (hàm thuần + gọi document.getElementById ngay khi nạp — quy tắc
│   │                              viết function MỚI/SỬA từ ver 12 xem core-function-conventions.md)
│   ├── config.js                — EQ_FREQS/EQ_LABELS (2 hằng KHÔNG thuộc CONST, giữ local), global
│   │                              error handler, saveConfig()/loadConfig() (các hằng số khác đọc
│   │                              qua CONST.xxx ở service/state.js, không định nghĩa ở đây)
│   ├── dom-refs.js               — mọi document.getElementById(...), RUBIK_NOTE_TO_TURN
│   ├── sav-logo.js               — setSavLogoExpanded(), gọi bởi event/router/sav-logo.js
│   ├── resume-state-storage.js   — lưu/đọc state phát nhạc (localStorage) khi tab ẩn, gồm cả vị
│   │                              trí video nền (videoCurrentTime, khôi phục qua 'loadedmetadata')
│   ├── upload-validation.js      — validateAudioFile/ImageFile/VideoFile
│   ├── listen-stats.js           — số lần nghe/thời gian nghe riêng từng bài (debounce qua taskManager)
│   ├── loading-shield-util.js    — withLoadingShield() dùng chung, cờ isShieldBusy
│   ├── three-vortex.js           — HOT PATH — khởi tạo + cập nhật mỗi frame Three.js scene cho
│   │                              visual Vortex
│   ├── state-and-video-bg.js     — handleVideoBackground(), mở/đóng Control Center
│   ├── equalizer.js              — slider EQ dùng 1 listener DELEGATION trên eqSlidersWrapper
│   │                              (event/listener/equalizer-settings.js) thay 10 listener rời
│   ├── tab-hide-reload.js        — triggerHideAndReload(): lưu state + reload ngay khi ẩn tab thật
│   │                              (phân biệt F5/đóng tab qua debounce 50ms + beforeunload)
│   ├── wakelock.js               — requestWakeLock()/releaseWakeLock() (API thuần + NoSleep.js
│   │                              fallback) + 2 bootstrap listener xin quyền lần đầu tương tác
│   ├── color-utils.js
│   ├── canvas-scene-setup.js     — generateStreetScene(), getPlayerBarSafeHeight()
│   ├── playlist/                 (kiểu object-function)
│   │   ├── state.js                 — CHỈ CÒN 2 hàm tiện ích formatTime()/normalizeSongName()
│   │   │                              (state thật đã dời sang service/state.js)
│   │   ├── order.js                 — sort default/az/za, lọc tìm kiếm, pending-append
│   │   ├── render.js                — vẽ diff theo renderOrder, trạng thái rỗng
│   │   ├── loader.js                — đọc duration, nạp file mới, quét playlist từ IndexedDB
│   │   ├── actions.js               — playSong, xoá/sửa/info bài, menu thao tác
│   │   └── main.js                  — object PlaylistMain: initSortMenu + initSearch + initViewMode
│   ├── player-controls.js        — next/prev/shuffle/repeat, showResumeChoiceModal()
│   ├── audio-engine.js           — AudioContext, khởi tạo pitch worker
│   ├── app-cleanup.js            — executeAppCleanup(): dọn animation loop/AudioContext/object
│   │                              URL/flush listen-stats/wake lock khi tab ĐÓNG THẬT (F5/điều
│   │                              hướng) — gọi từ event/tab.js 'beforeunload'
│   ├── stats-panel-toggle.js     — toggle ẩn/hiện dải BPM/Pitch/Energy
│   ├── audio-analysis.js         — updateStatsDashboard() (BPM/Pitch/Energy) — HOT PATH (mỗi
│   │                              frame trong vòng vẽ, xem core-legacy-audit.md)
│   ├── rubik-math.js             — HOT PATH (mỗi frame, dùng bởi visualizer/types/rubik.js)
│   ├── about-stats.js            — computeStats() cho About Drawer
│   ├── app-recovery.js           — Khởi động lại app / Khôi phục cài đặt mặc định
│   ├── id3-export.js             — export/restore gắn tag ID3Writer, ảnh bìa vào APIC
│   ├── storage-manager.js        — clearAllStoredData(), cờ isDestructiveTaskInProgress
│   ├── modal-choice.js           — modalChoice(text, buttons, options?) dùng chung mọi modal hỏi
│   │                              quyết định; 2 listener click (nút/overlay) KHÔNG qua bus
│   ├── pitch-worker.js           — Web Worker thuần cho thuật toán YIN, KHÔNG nằm trong danh sách
│   │                              <script> (nạp bằng new Worker(...) trong audio-engine.js)
│   ├── subtitle/
│   │   ├── subtitles.js             — logic .srt: parse/import/export/auto-timing
│   │   ├── subtitle-style-settings.js — style khung/chữ
│   │   └── subtitle-display.js      — render active subtitle block theo currentTime
│   └── visualizer/
│       ├── visualizer-display.js    — cấu hình hiển thị (màu/EQ mode/bar style/vortex style/rain
│       │                              style/blur nền...)
│       ├── visualizer-misc-settings.js — mở/đóng drawer Visualizer/Subtitle, đổi kiểu hiệu ứng,
│       │                              giữ màn hình sáng
│       ├── draw-helpers.js          — HOT PATH — hàm vẽ dùng chung (giọt nước, khung kính, nốt
│       │                              nhạc bay)
│       ├── draw-visualizer.js       — HOT PATH — vòng lặp render chính (requestAnimationFrame),
│       │                              object VISUALIZER_DRAWERS, và dòng
│       │                              document.addEventListener('DOMContentLoaded', ...) — ĐIỂM
│       │                              KHỞI ĐỘNG THỰC SỰ của toàn app
│       └── types/                   — HOT PATH — mỗi visual 1 file riêng
│           ├── bar.js                  (Phản chiếu cánh bướm / Thác đổ)
│           ├── lightning.js
│           ├── rubik.js                (map nốt→trục/lớp ở RUBIK_NOTE_TO_TURN, dom-refs.js)
│           ├── vortex.js               (update mỗi khung hình; khởi tạo ở three-vortex.js)
│           ├── black-hole.js
│           └── rain.js                 (kiểu Trôi cửa kính / Mưa phố)
│
├── service/
│   ├── state.js                  — STATE_SCHEMA (96 key) + class AppState (get/set/mutate,
│   │                              validate kiểu, skipCheck cho hot path) + CONST (16 hằng)
│   ├── operation.js              — so sánh toán tử (===/!==/>/</>=/<=/in/notIn) DÙNG CHUNG cho
│   │                              event/block.js và event/virtual-machine-state.js
│   ├── task-manager.js           — class Loop/TaskManager, instance global taskManager (CHUYỂN từ
│   │                              core/ ngày 04/07/2026 — dịch vụ hạ tầng, không phải nghiệp vụ)
│   ├── db.js                     — IndexedDB (idb-keyval), store songs/meta/languages, cơ chế tự
│   │                              phát hiện + tự mở lại connection khi trình duyệt tự đóng (CHUYỂN
│   │                              từ core/ ngày 04/07/2026, cùng lý do trên)
│   ├── adapter/                  — scaffolding TƯƠNG LAI cho native adapter bridge, CHƯA có code
│   │   ├── android/                 thật, chỉ giữ chỗ thư mục
│   │   ├── ios/
│   │   └── windows/
│   └── contact/                  — scaffolding TƯƠNG LAI, chưa có code thật
│
└── event/                        (kiến trúc listener → bus → router → workflow/core/
    │                              VirtualMachineState — xem readme/event-bus-flow.md cho sơ đồ
    │                              đầy đủ + script-load-order.md cho thứ tự nạp bắt buộc)
    ├── bus.js                    — eventBus: register(name, router)/registerBlock(msgType,
    │                              groups)/send(msg); send() tra event/block.js TRƯỚC khi gọi
    │                              router.handle(msg), NO-OP + console.warn nếu router chưa đăng ký
    ├── block.js                  — DATA đăng ký chặn msg.type trước router (hiện RỖNG, chờ rà
    │                              soát phạm vi trước khi wire case thật — xem changelog/v12.md)
    ├── virtual-machine-state.js  — VirtualMachineState.run(rules): chạy NHIỀU callback độc lập
    │                              theo điều kiện, gọi TRONG 1 case router, không có registry
    ├── store.js                  — class EventStore: "state context" RIÊNG của từng router (khác
    │                              phạm vi với service/state.js)
    ├── tab.js                    — 3 lifecycle listener KHÔNG qua bus (visibilitychange/pagehide/
    │                              beforeunload) — nạp CUỐI CÙNG trong toàn bộ /event/
    ├── listener/                 — 14 file, chỉ eventBus.send(msg), không chứa logic (119 listener)
    ├── router/                   — 14 file, tự eventBus.register() lúc nạp, quyết định gọi thẳng
    │                              core, giao workflow, hay VirtualMachineState.run() trong case
    └── workflow/                 — 6 file (chỉ 6/14 cụm cần — ≥2 lời gọi side-effect nối tiếp có
                                   thứ tự phụ thuộc, xem core-function-conventions.md Rule 3):
                                   settings-misc, playlist, visualizer-display, language-settings,
                                   subtitle-modal, visualizer-control-center
```

## Bảng 14 cụm `/event/` (ver 11)

Xem đầy đủ số liệu (số listener/cụm, có workflow hay không, đối chiếu `msg.type`) ở
[changelog/v11.md](./changelog/v11.md) mục 2 — không nhắc lại ở đây để tránh 2 nguồn dễ lệch nhau.

## Lịch sử thay đổi theo version (v1 → v12)

Thay cho đánh dấu ★/`[vXX]` gắn trực tiếp vào cây thư mục (cách cũ, dừng dùng từ ver 12) — bảng
dưới đây là nguồn DUY NHẤT tra cứu "bản nào thêm/sửa/xoá file gì". Đường dẫn `js/...` ở các bản cũ
(v1–v10 + batch fix/i18n) là đường dẫn LỊCH SỬ ĐÚNG TẠI THỜI ĐIỂM ĐÓ — thư mục `js/` không còn tồn
tại từ ver 11 (xem [why-no-es6-module.md](./why-no-es6-module.md)), đường dẫn HIỆN TẠI lấy từ cây
ở trên.

| Bản | Thêm | Sửa | Xoá | Ghi chú |
|---|---|---|---|---|
| [v1](./changelog/v1.md) | — | `js/components/settings-drawer.js`; `js/core/canvas-scene-setup.js`; `js/core/config.js`; `js/core/dom-refs.js`; `js/core/equalizer-settings.js`; `js/core/three-vortex.js`; `js/visualizers/draw-visualizer.js` | — | — |
| [v2](./changelog/v2.md) | — | `index.html`; `js/core/canvas-scene-setup.js`; `js/core/three-vortex.js`; `js/visualizers/draw-visualizer.js` | — | — |
| [v3](./changelog/v3.md) | — | `js/components/settings-drawer.js`; `js/core/canvas-scene-setup.js`; `js/core/config.js`; `js/core/dom-refs.js`; `js/core/equalizer-settings.js`; `js/core/player-controls.js`; `js/visualizers/draw-helpers.js`; `js/visualizers/draw-visualizer.js` | — | — |
| [v4](./changelog/v4.md) | `js/visualizers/types/bar.js`; `wave.js`; `lightning.js`; `rubik.js`; `vortex.js`; `black-hole.js`; `rain.js` | `js/core/config.js`; `js/core/dom-refs.js`; `js/core/canvas-scene-setup.js`; `js/core/player-controls.js`; `js/core/equalizer-settings.js`; `js/components/settings-drawer.js`; `js/visualizers/draw-helpers.js`; `js/visualizers/draw-visualizer.js (viết lại hoàn toàn)`; `index.html`; `README.md` | — | — |
| [v5](./changelog/v5.md) | `js/core/db.js`; `js/core/id3-export.js`; `js/core/loading-shield-util.js` | `js/core/playlist.js (viết lại hoàn toàn, chưa tách thư mục playlist/)`; `js/components/loading-shield.js`; `index.html (thêm CDN idb-keyval/browser-id3-writer)`; `README.md` | — | **Không có dòng "Tổng kết file" tường minh trong changelog gốc** — danh sách này tự tổng hợp từ nội dung mục 1–8, có thể sót file phụ nhỏ. |
| [v6](./changelog/v6.md) | `js/core/listen-stats.js`; `js/playlist/state.js`; `order.js`; `render.js`; `loader.js`; `actions.js`; `main.js`; `CHANGELOG_v6.md` | `index.html`; `js/components/playlist-view.js`; `js/components/settings-drawer.js`; `js/components/storage-drawer.js`; `js/core/config.js`; `js/core/dom-refs.js`; `js/core/equalizer-settings.js`; `js/core/color-utils.js`; `js/core/state-and-video-bg.js`; `js/core/player-controls.js`; `js/core/wakelock.js`; `js/core/storage-manager.js`; `js/visualizers/draw-visualizer.js`; `js/visualizers/types/rain.js`; `README.md` | `js/core/playlist.js (đã tách hết sang js/playlist/)` | — |
| [v7](./changelog/v7.md) | `js/core/pitch-worker.js`; `js/core/upload-validation.js`; `CHANGELOG_v7.md` | `js/core/audio-engine.js`; `js/core/audio-analysis.js`; `js/playlist/actions.js`; `js/playlist/order.js`; `js/playlist/loader.js`; `js/core/player-controls.js`; `js/core/state-and-video-bg.js`; `js/core/equalizer-settings.js`; `js/components/settings-drawer.js`; `index.html`; `README.md` | — | — |
| [v8](./changelog/v8.md) | `js/components/settings/playlist-background.js`; `visualizer-geometry-color.js`; `audio-eq.js`; `subtitle-style.js`; `misc.js`; `js/components/visualizer-settings-drawer.js`; `js/components/subtitle-settings-drawer.js`; `changelog/v8.md` | `js/components/playlist-view.js`; `js/components/visualizer-overlay.js`; `js/components/subtitle-modal.js`; `js/components/settings-drawer.js (viết lại hoàn toàn)`; `js/main.js`; `js/core/dom-refs.js`; `js/core/equalizer-settings.js`; `js/core/player-controls.js`; `js/core/wakelock.js`; `js/core/state-and-video-bg.js`; `js/core/subtitle-display.js`; `js/core/subtitles.js`; `js/core/config.js`; `js/visualizers/draw-visualizer.js`; `js/playlist/actions.js`; `js/playlist/loader.js`; `js/playlist/order.js`; `js/playlist/render.js`; `css/styles.css`; `index.html`; `README.md` | — | Di chuyển + đổi tên: `CHANGELOG_v1.md`…`CHANGELOG_v7.md` → `changelog/v1.md`…`v7.md`. |
| [v9](./changelog/v9.md) | `js/core/modal-choice.js`; `changelog/v9.md` | `js/playlist/loader.js`; `js/core/loading-shield-util.js`; `js/core/player-controls.js`; `js/core/wakelock.js`; `js/core/audio-engine.js`; `js/core/db.js`; `js/playlist/actions.js`; `index.html`; `README.md` | — | — |
| [v10](./changelog/v10.md) | `js/core/task-manager.js`; `js/core/auto-switch-visual.js`; `changelog/v10.md` | `index.html`; `js/core/player-controls.js`; `js/core/storage-manager.js`; `js/playlist/loader.js`; `js/core/config.js`; `js/core/equalizer-settings.js`; `js/core/listen-stats.js`; `js/core/loading-shield-util.js`; `js/core/subtitles.js`; `js/core/subtitle-display.js`; `js/core/state-and-video-bg.js`; `js/core/dom-refs.js`; `js/visualizers/draw-helpers.js`; `js/playlist/main.js`; `js/playlist/render.js`; `js/components/playlist-view.js`; `js/components/settings/playlist-background.js`; `js/components/settings/visualizer-geometry-color.js` | — | — |
| [v10-mini](./changelog/v10-mini-not-full-fix.md) | `js/core/app-recovery.js`; `js/core/stats-panel-toggle.js` | `js/components/playlist-view.js`; `js/core/dom-refs.js`; `js/components/settings/visualizer-geometry-color.js`; `js/components/visualizer-settings-drawer.js`; `js/core/auto-switch-visual.js`; `js/core/player-controls.js`; `js/core/resume-state-storage.js (viết lại hoàn toàn)`; `js/core/wakelock.js (viết lại hoàn toàn)`; `js/core/modal-choice.js`; `js/visualizers/draw-visualizer.js`; `js/components/settings/misc.js` | — | Batch fix lẻ, KHÔNG phải bản đánh số riêng — sau này ver 11 chốt chính thức. |
| [i18n](./changelog/v10-lang-test.md) | `js/core/lang.js`; `js/core/language-settings.js`; `js/components/settings/language.js`; `lang/vi.json (file mẫu test)`; `changelog/v10-lang-test.md` | `index.html`; `js/core/db.js (DB_VERSION 2→3, store languages)`; `js/components/settings-drawer.js`; `16 file components/*.js khác (toàn bộ text tĩnh → t()/data-i18n)`; `js/core/player-controls.js`; `js/core/app-recovery.js`; `js/core/config.js`; `js/core/subtitles.js`; `js/core/storage-manager.js`; `js/core/upload-validation.js`; `js/core/id3-export.js`; `js/core/listen-stats.js`; `js/core/about-stats.js`; `js/core/state-and-video-bg.js`; `js/playlist/loader.js`; `js/playlist/actions.js`; `js/playlist/render.js` | — | Batch i18n, KHÔNG phải bản đánh số riêng — sau này ver 11 chốt chính thức. `lang/vi.json` sau đó (ver 11) đổi cơ chế sang `lang/patch/*.js` (5 file) — xem hàng v11. |
| [v11](./changelog/v11.md) | `event/bus.js, event/store.js, event/tab.js`; `event/{listener,router,workflow}/*.js — 14 cụm (119 listener), 6/14 có workflow`; `service/state.js (STATE_SCHEMA 96 key + CONST 16 hằng + class AppState)`; `lang/patch/*.js (5 file, thay lang/vi.json cũ)`; `core/wakelock.js/tab-hide-reload.js/app-cleanup.js (tách từ wakelock.js cũ)`; `core/equalizer.js, subtitle/subtitle-style-settings.js, visualizer/visualizer-misc-settings.js (tách từ equalizer-settings.js cũ)`; `service/adapter/{android,ios,windows}/, service/contact/ (scaffolding, chưa có code thật)`; `changelog/v11.md` | `TOÀN BỘ core/*.js còn lại — đổi truy cập STATE.xxx trần → appState.get/set/mutate() (96 key), CONST.xxx (16 hằng)`; `index.html — thứ tự nạp lại hoàn toàn theo kiến trúc /event/`; `README.md, toàn bộ readme/*.md — viết lại theo cấu trúc mới` | `js/ (toàn bộ thư mục cũ — nội dung đã dời vào core/, đổi cấu trúc)`; `core/playlist.js, core/equalizer-settings.js (gốc — đã tách hết)`; `core/visualizer-overlay.js (file mồ côi, bản HTML cũ không còn nạp)` | **Không itemize đầy đủ tuyệt đối** — v11 là bản CHỐT chính thức cho khối lượng làm dần qua NHIỀU phiên trước (không phải 1 đợt code mới), bản chất gần như 100% file trong `core/`/`event/` đều bị đụng tới ở mức nào đó. Xem `changelog/v11.md` + `folder-structure.md` (cây thư mục hiện tại) thay vì tìm itemize đầy đủ ở đây. |
| [v12](./changelog/v12.md) | `service/operation.js`; `event/block.js`; `event/virtual-machine-state.js`; `readme/event-bus-flow.md`; `readme/core-function-conventions.md`; `readme/core-legacy-audit.md`; `readme/changelog/v12.md` | `event/bus.js (thêm blocks Map, registerBlock(), evalCondition())`; `index.html`; `readme/script-load-order.md`; `readme/changelog-index.md`; `README.md` | — | — |

← [Quay lại README](../README.md)
