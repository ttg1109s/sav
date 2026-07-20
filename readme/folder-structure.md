# Cấu trúc thư mục

> **[CẬP NHẬT 12/07/2026]** Bản trước (viết cùng lúc với `service/operation.js`/`event/block.js`/
> `event/virtual-machine-state.js`, đầu ver 12) đã TỤT HẬU nặng sau khối lượng việc Nhóm B/C/D/A
> (Đa phương tiện, tái cấu trúc Settings + Theme, Subtitle Editor trang riêng, Documents viết lại —
> xem `changelog/v12.md`) — thiếu nguyên `core/file-manager/` (13 file), `core/generic-drawer.js`,
> `core/settings-panel-stack.js`, `core/slider-panel-scroll.js`, 10 cụm `/event/` mới, và hàng loạt
> `components/*.js` mới. Cây dưới đây lấy lại TRỰC TIẾP từ `find` chạy trên source thật (66 file
> `core/`, 66 file `event/`, đối chiếu `index.html`/`subtitle-editor.html`) — không gõ tay lại từ
> trí nhớ, không phải bản vá thêm mà là đối chiếu lại toàn bộ.
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
│   ├── core-function-conventions.md — 5 rule bắt buộc cho function Core/nghiệp vụ MỚI viết/sửa
│   │                              từ ver 12: đơn tuyến nghiệp vụ, không tự đọc appState, core-gọi-
│   │                              core CẤM TUYỆT ĐỐI (chỉ trừ service/db.js + appState.set/mutate),
│   │                              log khi set/mutate state, Rule 5 (10/07) cho hàm dựng UI
│   │                              (addEventListener gom cuối hàm, không dùng DOM rẽ nhánh, hậu tố
│   │                              `-ui.js`)
│   ├── core-legacy-audit.md     — nợ kỹ thuật chính thức, QUÉT LẠI 12/07/2026: 133/366 function
│   │                              core hiện có (đã loại hot-path, 56 file) vi phạm ≥1 rule — kèm
│   │                              mục Rule 5 sơ bộ (addEventListener/classList) mới thêm
│   ├── script-load-order.md
│   ├── task-manager-conventions.md — MỚI 04/07/2026: mọi setInterval/setTimeout PHẢI qua
│   │                              `taskManager`, CHỈ Workflow được dùng (Core/Router/Listener cấm)
│   ├── song-cover-background-relations.md — quan hệ giữa ảnh bìa bài hát / ảnh nền Playlist / ảnh
│   │                              nền Slideshow (3 khái niệm ảnh khác nhau, dễ nhầm)
│   ├── usage.md
│   ├── visual-conventions.md
│   ├── where-to-edit.md
│   ├── why-no-es6-module.md
│   └── changelog/
│       ├── v1.md … v9.md
│       ├── v10.md, v10-mini-not-full-fix.md, v10-lang-test.md
│       ├── v11.md               — hoàn tất kiến trúc /event/ + State tập trung + 3 lỗi nhỏ
│       └── v12.md               — hạ tầng block/VM-state (nay đã wire), Đa phương tiện, Settings/
│                                   Theme, Subtitle Editor trang riêng, Documents Nhóm A, Rule 5
├── index.html                   ← Mở file này để chạy ứng dụng (Playlist/Visualizer/Settings)
├── subtitle-editor.html         ← Trang RIÊNG cho Subtitle Editor (MỚI 10/07/2026) — mở qua
│                                   `?song=<key đã mã hoá>`, KHÔNG nạp index.html/main.js, tự khai
│                                   script riêng (Tailwind CDN, WaveSurfer.js + plugin Timeline,
│                                   lamejs cho Cut MP3, service/db.js, service/song-key-cipher.js)
├── favicon.png
├── main.js                      ← chèn toàn bộ TPL_* (components/) vào #app-root (CHỈ index.html —
│                                   subtitle-editor.html KHÔNG dùng file này)
│
├── assets/
│   └── css/
│       ├── style.css            (toàn bộ CSS chính, dùng chung index.html + subtitle-editor.html)
│       └── slideshow.css        (13 CSS transition + 4 biến thể Ken Burns cho Slideshow nền)
│
├── lang/                        (đa ngôn ngữ — i18n)
│   ├── lang.js                  — gộp patch bằng Object.assign(), định nghĩa t()/tFormat()/
│   │                              validateLanguagePack()/saveLanguagePack()/applySavedLanguage()/
│   │                              listAvailableLanguages()/applyLanguageToDom(). Nạp NGAY ĐẦU
│   │                              <body>, TRƯỚC TOÀN BỘ components/*.js
│   ├── language-settings.js     — xử lý UI section "Ngôn ngữ": renderLanguageOptions(), logic gọi
│   │                              bởi event/router/settings-misc.js (không tự addEventListener)
│   └── patch/                   — 7 file default-key tiếng Anh, viết .js (không .json — file://
│       ├── patch-common.js         không fetch() được file tĩnh). Thứ tự nội bộ không quan trọng,
│       ├── patch-playlist.js       cả 7 PHẢI nạp TRƯỚC lang.js.
│       ├── patch-settings-misc.js
│       ├── patch-subtitle-settings.js
│       ├── patch-visualizer.js
│       ├── patch-file-manager.js   — MỚI (03/07/2026) — key cho Song/Photo/Document/Folder Detail
│       └── patch-subtitle-editor.js — MỚI (10/07/2026) — key riêng cho subtitle-editor.html, dùng
│                                       ở CẢ 2 trang (index.html lẫn subtitle-editor.html)
│
├── components/                  (chỉ định nghĩa biến TPL_* — chuỗi HTML, KHÔNG đụng DOM)
│   ├── loading-shield.js
│   ├── app-view-stack.js
│   ├── playlist-view.js         — logo "SAV" (hover JS toggle), 2 tab modal sửa bài (Thông tin/
│   │                              Ảnh bìa), menu "Chọn file/Chọn cả thư mục"
│   ├── visualizer-overlay.js    — Control Center 6 icon (Đổi hiệu ứng/Phụ đề/Cài đặt/Trộn bài/
│   │                              Lặp lại/Thống kê) + #btn-back-playlist tách riêng
│   ├── bottom-player.js
│   ├── generic-drawer.js        — MỚI (Nhóm A) — khung trắng dùng chung List↔Read cho Document
│   │                              Picker/Reader, KHÔNG có overlay (đã bỏ hẳn, xem changelog/v12.md)
│   ├── items.js                 — MỚI (Nhóm A) — itemTemplateDocumentRow()/itemTemplateFolderTile()/
│   │                              renderItemList()/computeVirtualWindowRange() (Document Picker,
│   │                              chưa windowing thật). Patch mục 1/2 (14/07/2026) thêm
│   │                              itemTemplateImageGridRow()/computeVariableVirtualWindowRange() —
│   │                              consumer windowing THẬT đầu tiên (lưới ảnh Photo & Album, xem
│   │                              event/workflow/file-manager-photo.js::setupPhotoGridWindow())
│   ├── file-manager.js          — 3 drawer con (Song/Photo & Album/Document), mỗi drawer tự quản
│   │                              lý mở/đóng bằng class thuần, KHÔNG có màn "File Manager" cấp cao
│   ├── slideshow-settings-drawer.js — cấu hình Slideshow nền (transition, Ken Burns hiện vẫn còn
│   │                              độc quyền với transition khác — CHƯA tách riêng, xem changelog)
│   ├── subtitle-settings-drawer.js — CẤU HÌNH style Phụ đề (bgOpacity/borderOpacity/fontSize) —
│   │                              KHÁC hẳn subtitle-editor.html (trang sửa NỘI DUNG phụ đề)
│   ├── settings/                — section HTML tách rời (mỗi file 1 biến TPL_SETTINGS_*)
│   │   ├── playlist-view.js        (Kiểu xem/Sắp xếp — TÁCH khỏi playlist-background.js cũ, 07/07)
│   │   ├── playlist-background.js  — KHÔNG CÒN MOUNT (07/07/2026, thay bằng theme.js) — vẫn giữ
│   │   │                              file trên đĩa (chưa xoá), CHỈ để tham khảo/không tải
│   │   ├── theme.js                — MỚI (07/07/2026) — 4 card Sáng/Tối/Background/Gradient, THAY
│   │   │                              hẳn section "Background" cũ — "Sáng" mới chỉ lưu lựa chọn,
│   │   │                              CHƯA áp lại màu app thật (xem changelog/v12.md mục 6)
│   │   ├── file-manager-section.js — MỚI (03/07/2026) — File Manager giờ là section BÌNH THƯỜNG
│   │   │                              trong Settings (không còn overlay cấp cao riêng)
│   │   ├── visualizer-geometry-color.js (chất lượng render, hình học, màu sắc, toggle Hiện Visual)
│   │   ├── audio-eq.js             (volume, preset EQ, dải tần số thủ công)
│   │   ├── subtitle-style.js       (style khung/chữ phụ đề)
│   │   ├── misc.js                 (giữ màn hình sáng, About Drawer, Khắc phục sự cố)
│   │   └── language.js             (chọn/upload/xóa ngôn ngữ — đặt SAU CÙNG)
│   ├── settings-drawer.js       — điều phối ghép các biến TPL_SETTINGS_* — điều hướng giờ qua
│   │                              `core/settings-panel-stack.js` (cuộn ngang, KHÔNG còn trượt dọc)
│   ├── about-drawer.js
│   ├── storage-drawer.js
│   └── visualizer-settings-drawer.js  (Chất lượng/Hình học-Màu sắc/Tự động đổi hiệu ứng)
│
├── core/                        (hàm thuần + gọi document.getElementById ngay khi nạp — quy tắc
│   │                              viết function MỚI/SỬA từ ver 12 xem core-function-conventions.md,
│   │                              66 file — xem core-legacy-audit.md cho danh sách nợ kỹ thuật)
│   ├── config.js                — EQ_FREQS/EQ_LABELS (2 hằng KHÔNG thuộc CONST, giữ local), global
│   │                              error handler, saveConfig()/loadConfig(), DEFAULT_VIZ_CONFIG
│   │                              (PHẢI khai đồng bộ với service/state.js — xem bài học 2 bản)
│   ├── dom-refs.js               — mọi document.getElementById(...), RUBIK_NOTE_TO_TURN
│   ├── generic-drawer.js         — MỚI (Nhóm A) — core UI thuần, chỉ gán innerHTML/style lên
│   │                              genericDrawerPanel TĨNH có sẵn (KHÔNG cần hậu tố -ui.js)
│   ├── settings-panel-stack.js   — MỚI — ngăn xếp panel Settings, cuộn ngang THẬT (overflow-x +
│   │                              scrollTo(), KHÔNG animate `left` thủ công — xem lịch sử 3 lần
│   │                              viết lại trong chính file, HOTFIX 17 08/07)
│   ├── slider-panel-scroll.js    — MỚI (09/07) — getPositionStart()/scrollSliderTo() dùng CHUNG
│   │                              bởi settings-panel-stack.js VÀ player-controls.js
│   ├── sav-logo.js               — setSavLogoExpanded(), gọi bởi event/router/sav-logo.js
│   ├── resume-state-storage.js   — lưu/đọc state phát nhạc (localStorage) khi tab ẩn, gồm cả vị
│   │                              trí video nền (videoCurrentTime, khôi phục qua 'loadedmetadata')
│   ├── upload-validation.js      — validateAudioFile/ImageFile/VideoFile
│   ├── listen-stats.js           — số lần nghe/thời gian nghe riêng từng bài (debounce qua taskManager)
│   ├── loading-shield-util.js    — withLoadingShield() dùng chung, cờ isShieldBusy
│   ├── webgl/                     — MỚI (dời 19/07/2026, gom nhóm "2 file three") — mọi engine
│   │                                khởi tạo Three.js đứng riêng thư mục con này (KHÔNG đụng
│   │                                core/visualizer/types/*.js — file update mỗi khung hình vẫn ở
│   │                                nguyên chỗ cũ, chỉ phần INIT dời vào đây)
│   │   ├── three-vortex.js        — HOT PATH — khởi tạo + cập nhật mỗi frame Three.js scene cho
│   │   │                            visual Vortex (DỜI từ core/three-vortex.js, 19/07/2026)
│   │   └── three-space.js         — Engine "Galaxy Journey" (VIẾT LẠI HOÀN TOÀN 20/07/2026,
│   │                                plan-space-galaxy.md Phần B — class GalaxyCluster, 10 hàm
│   │                                generate*Positions, shader, texture, SpaceDust; init dùng
│   │                                CHUNG canvas/renderer với three-vortex.js ở trên)
│   ├── state-and-video-bg.js     — handleVideoBackground(), mở/đóng Control Center
│   ├── equalizer.js              — slider EQ dùng 1 listener DELEGATION trên eqSlidersWrapper
│   │                              (event/listener/equalizer-settings.js) thay 10 listener rời
│   ├── tab-hide-reload.js        — triggerHideAndReload(): lưu state + reload ngay khi ẩn tab thật
│   │                              (phân biệt F5/đóng tab qua debounce 50ms + beforeunload)
│   ├── wakelock.js               — requestWakeLock()/releaseWakeLock() (API thuần + NoSleep.js
│   │                              fallback) + 2 bootstrap listener xin quyền lần đầu tương tác
│   ├── color-utils.js            — forceGlassRepaint() MỚI (fix backdrop-filter stale WebKit)
│   ├── canvas-scene-setup.js     — generateStreetScene(), getPlayerBarSafeHeight()
│   ├── playlist/                 (kiểu object-function)
│   │   ├── state.js                 — CHỈ CÒN 2 hàm tiện ích formatTime()/normalizeSongName()
│   │   │                              (state thật đã dời sang service/state.js)
│   │   ├── scope.js                 — MỚI — scoping playlist theo folder (activePlayListFolder)
│   │   ├── selection.js             — MỚI — chế độ chọn nhiều (checkbox), dropup action menu
│   │   ├── bulk-actions.js          — MỚI — hành động hàng loạt trên các bài đã chọn
│   │   ├── order.js                 — sort default/az/za, lọc tìm kiếm, pending-append, shuffle
│   │   │                              (nợ kỹ thuật MỞ: biên shuffle vẫn dùng playlistOrder.length,
│   │   │                              chưa đổi sang shuffleIndices.length — xem changelog/v12.md)
│   │   ├── render.js                — vẽ diff theo renderOrder, trạng thái rỗng
│   │   ├── loader.js                — đọc duration, nạp file mới, quét playlist từ IndexedDB
│   │   ├── actions.js               — playSong, xoá/sửa/info bài, menu thao tác
│   │   └── main.js                  — object PlaylistMain: initSortMenu + initSearch + initViewMode
│   ├── player-controls.js        — next/prev/shuffle/repeat, showResumeChoiceModal() — nợ kỹ
│   │                              thuật MỚI: seek-trước-rồi-phát trong Subtitle Editor có gốc rễ
│   │                              tương tự (xem event/workflow/subtitle-editor.js, changelog/v12.md)
│   ├── audio-engine.js           — AudioContext, khởi tạo pitch worker
│   ├── app-cleanup.js            — executeAppCleanup(): dọn animation loop/AudioContext/object
│   │                              URL/flush listen-stats/wake lock khi tab ĐÓNG THẬT (F5/điều
│   │                              hướng) — gọi từ event/tab.js 'beforeunload'
│   ├── stats-panel-toggle.js     — toggle ẩn/hiện dải BPM/Pitch/Energy — VẪN CHƯA lưu vào vizConfig
│   │                              (nợ kỹ thuật mở, xem changelog/v12.md Nhóm B mục 11)
│   ├── audio-analysis.js         — updateStatsDashboard() (BPM/Pitch/Energy) — HOT PATH (mỗi
│   │                              frame trong vòng vẽ, xem core-legacy-audit.md)
│   ├── rubik-math.js             — HOT PATH (mỗi frame, dùng bởi visualizer/types/rubik.js)
│   ├── about-stats.js            — computeStats() cho About Drawer
│   ├── app-recovery.js           — Khởi động lại app / Khôi phục cài đặt mặc định
│   ├── id3-export.js             — export/restore gắn tag ID3Writer, ảnh bìa vào APIC
│   ├── storage-manager.js        — clearAllStoredData(), cờ isDestructiveTaskInProgress
│   ├── modal-choice.js           — modalChoice(text, buttons, options?) dùng chung mọi modal hỏi
│   │                              quyết định; 2 listener click (nút/overlay) KHÔNG qua bus. VI
│   │                              PHẠM Rule 5c (thiếu hậu tố -ui.js) — nợ kỹ thuật đã ghi nhận
│   ├── pitch-worker.js           — Web Worker thuần cho thuật toán YIN, KHÔNG nằm trong danh sách
│   │                              <script> (nạp bằng new Worker(...) trong audio-engine.js)
│   ├── file-manager/             — MỚI (Nhóm B/C/A, 02-11/07) — 13 file
│   │   ├── nav.js                   — điều hướng chung File Manager (mở/đóng 3 drawer con)
│   │   ├── folder.js                — CRUD folder nhạc, addSongsToFolder() (qua VirtualMachineState)
│   │   ├── folder-list-ui.js        — danh sách folder — hậu tố -ui.js (Rule 5c)
│   │   ├── folder-detail-ui.js      — chi tiết 1 folder (danh sách bài trong đó) — hậu tố -ui.js
│   │   ├── folder-picker-ui.js      — modal chọn folder khi thêm bài — hậu tố -ui.js
│   │   ├── image.js                 — CRUD ảnh + sortImagesByAddedDateDesc()/buildPhotoGridRows()
│   │   │                              (chuẩn bị hàng lưới group-theo-ngày cho window ảo, Patch mục
│   │   │                              1/2, 14/07/2026 — xem event/workflow/file-manager-photo.js)
│   │   ├── photo-ui.js              — carousel picker, album, modal xem ảnh — hậu tố -ui.js. Lưới
│   │   │                              ảnh (masonry chunk-based cũ, từng là nợ kỹ thuật Rule 3 — xem
│   │   │                              audit) ĐÃ XOÁ HẲN 14/07/2026, thay bằng components/items.js +
│   │   │                              event/workflow/file-manager-photo.js::setupPhotoGridWindow()
│   │   ├── album.js                 — CRUD album ảnh dùng cho Slideshow nền
│   │   ├── slideshow.js             — engine 13 CSS transition + Ken Burns (Ken Burns CHƯA tách
│   │   │                              riêng khỏi transitionType — nợ kỹ thuật mở)
│   │   ├── document.js              — sanitizeDocumentHtml()/resolveDocumentHtml()/
│   │   │                              convertDocumentHtmlToPlainText() — content model: .txt =
│   │   │                              string[] lưu thẳng, .docx/user-edited = HTML đã lọc whitelist
│   │   ├── document-ui.js           — modal/drawer Document (title/detail/editor) — hậu tố -ui.js
│   │   ├── document-pagination.js   — computeNextDocumentReaderSlot(), core NGHIỆP VỤ thuần (khác
│   │   │                              document-ui.js), cắt HTML theo khối, đo bằng DOM tạm
│   │   └── cleanup.js               — registry registerCleanupCheck(), dọn reference orphan
│   ├── subtitle/
│   │   ├── subtitles.js             — logic .srt: parse/import/export/auto-timing
│   │   ├── subtitles-ui.js          — MỚI (Nhóm A/Subtitle Editor) — buildLineCard(), hậu tố -ui.js,
│   │   │                              addEventListener gom cuối hàm, callback chỉ gọi tham số
│   │   ├── subtitle-style-settings.js — style khung/chữ
│   │   └── subtitle-display.js      — render active subtitle block theo currentTime
│   └── visualizer/
│       ├── visualizer-display.js    — cấu hình hiển thị (màu/EQ mode/bar style/vortex style/rain
│       │                              style/blur nền/gradientFrom/gradientTo cho Theme...)
│       ├── visualizer-misc-settings.js — mở/đóng drawer Visualizer/Subtitle, đổi kiểu hiệu ứng,
│       │                              giữ màn hình sáng
│       ├── draw/                    — HOT PATH — MỚI (19/07/2026, tách từ draw-helpers.js cũ,
│       │                              mỗi hàm 1 file) — hàm vẽ dùng chung
│       │   ├── water-drop.js           (giọt nước — Rain)
│       │   ├── window-frame.js         (khung cửa sổ NHÀ — Rain kiểu "glass")
│       │   ├── spaceship-frame.js      — RỖNG (0 byte, đã orphan trước 20/07/2026)
│       │   ├── space-collision-flash.js — RỖNG (0 byte, 20/07/2026 — xoá visual Space, giữ file)
│       │   └── flying-note.js          (nốt nhạc bay lên, DOM — mọi kiểu hiệu ứng)
│       ├── draw-visualizer.js       — GIẢI THỂ HOÀN TOÀN (0 byte, 20/07/2026, plan-space-galaxy.md
│       │                              Phần A) — object VISUALIZER_DRAWERS + vòng lặp render dời
│       │                              sang event/workflow/visualizer-render.js (taskManager mode
│       │                              `raf`, MỚI); đoạn DOMContentLoaded (ĐIỂM KHỞI ĐỘNG THỰC SỰ
│       │                              của app) dời sang event/router/app-boot.js
│       └── types/                   — HOT PATH — mỗi visual 1 file riêng
│           ├── bar.js                  (Phản chiếu cánh bướm / Thác đổ)
│           ├── lightning.js
│           ├── rubik.js                (map nốt→trục/lớp ở RUBIK_NOTE_TO_TURN, dom-refs.js)
│           ├── vortex.js               (update mỗi khung hình; khởi tạo ở core/webgl/three-vortex.js)
│           ├── black-hole.js           — hiệu năng khi cuộn ĐANG TREO (bar tần số + shadowBlur là
│           │                              thủ phạm chính, không phải sao — xem changelog/v12.md)
│           ├── rain.js                 (kiểu Trôi cửa kính / Mưa phố)
│           └── space.js                — VIẾT LẠI HOÀN TOÀN (20/07/2026, plan-space-galaxy.md
│                                          Phần B) — vài hàm Core nhỏ chạy mỗi frame (camera/chain/
│                                          render/dust), khởi tạo ở core/webgl/three-space.js
│
├── service/
│   ├── state.js                  — STATE_SCHEMA + class AppState (get/set/mutate, validate kiểu,
│   │                              skipCheck cho hot path) + CONST + DEFAULT_VIZ_CONFIG (bản 2, xem
│   │                              core/config.js — PHẢI đồng bộ field khi thêm mới)
│   ├── operation.js               — so sánh toán tử (===/!==/>/</>=/<=/in/notIn) DÙNG CHUNG cho
│   │                              event/block.js và event/virtual-machine-state.js
│   ├── song-key-cipher.js         — MỚI (10/07) — encodeSongKeyForUrl()/decodeSongKeyFromUrl(),
│   │                              dùng bởi subtitle-editor.html (?song=<key đã mã hoá>)
│   ├── task-manager.js           — class Loop/TaskManager, instance global taskManager
│   ├── db.js                     — IndexedDB (idb-keyval), DB_VERSION 4: songs/meta/languages +
│   │                              5 store MỚI (folders/folder_song/images/albums/documents)
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
    ├── block.js                  — DATA đăng ký chặn msg.type trước router — CÓ 1 ENTRY THẬT
    │                              (fileManagerSong.folder.applyToPlaylist.click, 03/07) — comment
    │                              đầu file "CHƯA có entry nào" đã LỖI THỜI, xem changelog/v12.md
    ├── virtual-machine-state.js  — VirtualMachineState.run(rules): chạy NHIỀU callback độc lập
    │                              theo điều kiện — ĐÃ DÙNG THẬT ≥15 điểm (playlist, file-manager-
    │                              photo/song, app-boot (DỜI từ draw-visualizer.js, 20/07/2026),
    │                              folder.js...)
    ├── store.js                  — class EventStore: "state context" RIÊNG của từng router (khác
    │                              phạm vi với service/state.js)
    ├── tab.js                    — 3 lifecycle listener KHÔNG qua bus (visibilitychange/pagehide/
    │                              beforeunload) — nạp CUỐI CÙNG trong toàn bộ /event/ (TRỪ
    │                              router/app-boot.js, xem ngay dưới — nạp SAU CẢ tab.js)
    ├── listener/                 — 24 file (14 cụm gốc ver 11 + 10 cụm mới Nhóm A/B/C/D)
    ├── router/                   — 25 file (24 cụm cũ + app-boot.js, MỚI 20/07/2026 — dời
    │                              document.addEventListener('DOMContentLoaded', ...) từ
    │                              core/visualizer/draw-visualizer.js, KHÔNG tự eventBus.register()
    │                              như 24 file kia — đây là ngoại lệ đặt tên "router" vì cùng dùng
    │                              VirtualMachineState cho 1 quyết định lúc boot, xem
    │                              plan-space-galaxy.md Phần A + comment đầu file đó)
    └── workflow/                 — 22 file (21 cụm cũ + visualizer-render.js, MỚI 20/07/2026 —
                                   vòng lặp render chính, taskManager mode `raf`, KHÔNG qua
                                   eventBus/Router, xem readme/event-bus-flow.md mục 1):
                                   settings-misc, playlist, visualizer-display, language-settings,
                                   visualizer-control-center, playlist-empty-state, playlist-scope,
                                   auto-switch-visual, stats-panel (đã có từ trước) — MỚI thêm:
                                   file-manager, file-manager-song, file-manager-photo,
                                   file-manager-document, file-manager-cleanup, document-reader
                                   (gộp cả document-picker cũ — file cũ document-picker.js CÒN TRÊN
                                   ĐĨA, KHÔNG còn nạp, xem "2 file mồ côi" ở changelog/v12.md),
                                   settings-stack-nav, slideshow, subtitle-editor, theme,
                                   visualizer-render (MỚI, xem trên)
```

> **Lưu ý đặt tên:** cụm `event/{router,listener,workflow}/subtitle-modal.js` vẫn còn TÊN CŨ dù
> modal thật đã xoá (10/07) — cụm này KHÔNG chết, vẫn xử lý nút "Sub" ở Control Center (bật/tắt
> nhanh phụ đề qua `setSubtitlesEnabled()`), chỉ là TÊN gây hiểu nhầm (dễ tưởng nhầm là mở modal cũ)
> — cân nhắc đổi tên cụm thành `subtitleToggle` nếu bị đụng tới lần sau, không bắt buộc ngay.

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
| [v12](./changelog/v12.md) | `service/operation.js`; `event/block.js`; `event/virtual-machine-state.js`; `core/generic-drawer.js`; `core/settings-panel-stack.js`; `core/slider-panel-scroll.js`; `core/file-manager/` (13 file); `core/subtitle/subtitles-ui.js`; `components/generic-drawer.js`; `components/items.js`; `components/file-manager.js`; `components/settings/theme.js`; `components/settings/file-manager-section.js`; `components/settings/playlist-view.js`; `components/slideshow-settings-drawer.js`; `subtitle-editor.html`; `service/song-key-cipher.js`; `assets/css/slideshow.css`; 10 cụm `/event/` mới (file-manager, file-manager-song/photo/document/cleanup, document-reader, settings-stack-nav, slideshow, subtitle-editor, theme); `lang/patch/patch-file-manager.js`, `patch-subtitle-editor.js`; `service/db.js` (DB_VERSION 3→4, +5 store); `readme/event-bus-flow.md`; `readme/core-function-conventions.md` (+ Rule 5, 10/07); `readme/core-legacy-audit.md`; `readme/changelog/v12.md` | `event/bus.js` (thêm blocks Map, registerBlock(), evalCondition()); `index.html` (nhiều đợt — gỡ Toast UI Editor/Turndown, thêm script mới); `core/config.js`/`service/state.js` (DEFAULT_VIZ_CONFIG +gradientFrom/gradientTo); hầu hết `core/playlist/*.js`, `core/player-controls.js`, `core/state-and-video-bg.js` (đụng tới ở mức nào đó qua nhiều đợt B/C/D); `readme/script-load-order.md`; `readme/changelog-index.md`; `README.md` | `components/subtitle-modal.js`; `components/document-picker-drawer.js`; `components/document-reader.js` | **Không itemize đầy đủ tuyệt đối** — cùng lý do v11: ver 12 là nhiều phiên rải từ đầu 07 tới 12/07/2026 (hạ tầng block/VM-state → Đa phương tiện B/C → Settings/Theme D → Subtitle Editor trang riêng → Documents Nhóm A), không phải 1 đợt code. 2 file mồ côi CHƯA xoá dù không còn nạp: `event/workflow/document-picker.js`, `lang/patch/subtitle-editor.html` (lạc chỗ) — xem `changelog/v12.md` mục 11. |

← [Quay lại README](../README.md)
