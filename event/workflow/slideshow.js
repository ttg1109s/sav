/**
 * event/workflow/slideshow.js — Slideshow nền Visual (nguồn nền thứ 3, Batch 8, ver 12
 * "Multi Media", plan-v12-multimedia.md mục 4.b3 + plan-v12-multimedia-update-3.md mục 1.2/2.4).
 *
 * `workflowSlideshow` đóng 2 VAI TRÒ:
 *   1. Workflow bình thường cho cụm router "slideshowSettings" (Settings Drawer — mở/đóng, chọn
 *      album, đổi mode/interval/transitionType) — xem event/router/slideshow.js.
 *   2. "Router" cho TASK LẶP TỰ SINH (`_tick()`, chạy qua taskManager, KHÔNG qua eventBus) — cùng
 *      tinh thần core/auto-switch-visual.js (`scheduleNextAutoSwitchVisualTimer`/`exe`): timer nội
 *      bộ là 1 nguồn trigger đứng NGOÀI `/event/` (event-bus-flow.md mục 1, ngoại lệ browser-
 *      lifecycle/timer nội bộ), nên `_tick()` được phép tự `appState.get()` rồi gọi thẳng hàm
 *      THUẦN ở core/file-manager/slideshow.js — ĐÚNG vai trò Router (đọc state, chọn hàm core nào
 *      chạy), KHÔNG phải core nghiệp vụ nên KHÔNG bị ràng buộc core-function-conventions.md Rule
 *      1-4. Workflow nói chung được phép đọc appState trực tiếp (không như core) — xem tiền lệ
 *      event/workflow/file-manager-song.js, event/workflow/playlist.js.
 *
 * PAUSE/RESUME theo `vizConfig.videoBgEnabled` VÀ trạng thái phát nhạc — VIẾT LẠI (04/07/2026, mục
 * 2 phản hồi Giang, BỎ watchdog poll 3s/lần; MỞ RỘNG 18/07/2026, mục 1 phản hồi Giang — thêm điều
 * kiện nhạc đang phát): trước đây `_tick()` tự đọc `videoBgEnabled` MỖI LẦN CHẠY + có 1 task
 * "canh chừng" riêng (`_startWatchdog()`) đọc mỗi 3s để tự resume — Giang chỉ ra ĐÚNG: đã có sẵn
 * sự kiện click bật/tắt video (`event/workflow/visualizer-control-center.js`) để biết CHÍNH XÁC
 * lúc nào cần pause/resume, poll lại appState mỗi 3s là THỪA. Giờ `syncPlaybackGate()` (GỘP CHUNG
 * 2 hàm riêng `pauseForVideoBg()`/`resumeFromVideoBg()` đời trước — 18/07/2026) được GỌI TRỰC TIẾP
 * từ CẢ 2 nguồn (video bật/tắt THÀNH CÔNG — visualizer-control-center.js; VÀ audio play/pause —
 * core/player-controls.js), event-driven, KHÔNG còn polling nào cả — engine CHỈ "chạy" khi CẢ HAI
 * điều kiện đúng cùng lúc (xem `_shouldBeRunning()`). KHÔNG đụng `enableVideoBackground()`/
 * `disableVideoBackgroundState()`/`applyUploadedVideoBg()` (code DI SẢN đã có nợ Rule 3 sẵn — cùng
 * lý do đã ghi ở core/state-and-video-bg.js, KHÔNG thêm lời gọi void mới vào các hàm đó).
 *
 * PERSIST: `meta.slideshowConfig` + `meta.activeBackgroundAlbum` (service/db.js, getMeta/setMeta) —
 * đọc lại lúc boot qua `loadPersistedSettingsOnBoot()`, gọi từ core/visualizer/draw-visualizer.js
 * (DOMContentLoaded). KHÔNG dùng lớp localStorage như `vizConfig` (đổi hiếm — chỉ lúc mở Settings
 * Drawer, không cần đồng bộ nhanh kiểu kéo slider).
 *
 * CASCADE "xoá album đang dùng làm nguồn slideshow" — xem `clearActiveAlbum()`, gọi từ
 * event/workflow/file-manager-photo.js::deleteAlbumFromList() (đổi tên ở Giai đoạn 3b, rewrite Photo/Album) khi album vừa xoá trùng
 * `activeBackgroundAlbum` (mục 4 bước 2, plan-v12-multimedia-update-3.md).
 *
 * "PHOTO PER SONG" (MỚI 04/07/2026, mục 5 phản hồi Giang) — `slideshowConfig.photoPerSong=true`:
 * THAY task đếm giờ cố định (`SLIDESHOW_TASK`) bằng task poll `appState.get('currentKey')` mỗi 1s
 * (`SLIDESHOW_SONG_WATCH_TASK`, xem `_startSongWatcher()`) — đổi ảnh ĐÚNG LÚC bài hát đổi THẬT
 * (next/prev/hết bài tự next/chọn bài khác), so sánh KEY (không phải currentTime) nên seek trong
 * CÙNG bài không kích hoạt đổi ảnh ("bù trừ theo seek" theo đúng yêu cầu). `intervalSeconds` bị bỏ
 * qua hoàn toàn ở chế độ này.
 *
 * NẠP SAU: core/file-manager/slideshow.js (SLIDESHOW_TRANSITION_TYPES, SLIDESHOW_TRANSITION_TYPES_NO_OUT,
 * SLIDESHOW_TRANSITION_MIN/MAX_TIME_MS, SLIDESHOW_TRANSITION_EASINGS, transitionSupportsInOutRatio,
 * computeSlideshowTransitionInOutMs, capSlideshowTransitionDurationMs, setSlideshowTransitionTiming,
 * pickNextSlideshowIndex*, setSlideshow*, startSlideshowTransitionVisuals,
 * finishSlideshowTransitionVisuals, resetSlideshowLayerClasses, computeSlideshowKenBurnsSafeBounds,
 * resolveSlideshowKenBurnsDirection, pickSlideshowKenBurnsKeyframes, startSlideshowKenBurnsAnimation,
 * stopSlideshowKenBurnsAnimation),
 * core/file-manager/album.js (getAlbumRecord/listAlbums — qua service/db.js), core/file-manager/image.js
 * (getImageRecord), core/file-manager/photo-ui.js (renderSlideshowAlbumPickerGrid — GIỮ NGUYÊN, giờ
 * vẽ vào genericDrawerBody thay vì panel tĩnh cũ), service/db.js (getMeta/setMeta), core/dom-refs.js
 * (slideshowContainer/slideshowLayer1/slideshowLayer2/slideshowLayer1Pan/slideshowLayer2Pan,
 * genericDrawerOverlay/Panel/Header/Body — Generic Drawer dùng chung, Giai đoạn 4),
 * core/settings-panel-stack.js (pushSettingsPanel), core/generic-drawer.js (openGenericDrawer/
 * closeGenericDrawer/hideGenericDrawerImmediately — Giai đoạn 4), components/slideshow-settings-
 * drawer.js (renderSlideshowPanelBody), service/task-manager.js (taskManager — CHỈ Workflow này
 * dùng, core không còn dùng kể từ 04/07/2026), service/state.js (appState).
 * NẠP TRƯỚC: event/router/slideshow.js, event/workflow/file-manager-photo.js (gọi
 * `workflowSlideshow.clearActiveAlbum()` trong cascade xoá album).
 *
 * === Batch D4 (Settings restructure, 06/07/2026) ===
 * Panel Settings (6 input enable/mode/photoPerSong/interval/transition/kenBurns) giờ PUSH/POP
 * động (core/settings-panel-stack.js) — KHÔNG còn `drawerSlideshowSettings`/6 dom-refs tĩnh (xem
 * core/dom-refs.js). File này KHÔNG cần refactor Rule 0.5 (mọi hàm ở đây ĐÃ LÀ Workflow — được
 * phép appState.get()/taskManager sẵn, core/file-manager/slideshow.js vốn ĐÃ Rule 1-4 đầy đủ từ
 * trước — không có core-gọi-core nào cần dời). CHỈ cần đổi CÁCH lấy tham chiếu DOM: dùng
 * `slideshowSettingsPanelEl` (biến module bên dưới, gán lúc `openPanel()`) thay vì dom-refs tĩnh —
 * các method (`refreshDrawerUI`/`changeInterval`/`changePhotoPerSong`/`onEnableToggleChange`/
 * `cancelAlbumPicker`) tự `.querySelector()` bên trong biến này. KHÔNG chủ động null-hoá biến này
 * lúc đóng panel (Back dùng CHUNG `settingsStackNav.back.click`, không biết gì về Slideshow) —
 * biến trỏ vào DOM node đã `.remove()` là VÔ HẠI vì không listener nào còn bắn sự kiện tới các
 * method đọc biến này khi panel đã đóng (delegation chỉ khớp id khi phần tử thật sự tồn tại/đang
 * hiển thị) — `openPanel()` GÁN LẠI biến này mỗi lần mở, luôn trỏ đúng panel MỚI NHẤT.
 *
 * VIẾT LẠI (Giai đoạn 4, rewrite Photo/Album, mục 1) — `TPL_SLIDESHOW_ALBUM_PICKER`/
 * `slideshowAlbumPicker*` dom-refs ĐÃ XOÁ — panel chọn Album giờ là Generic Drawer ĐỘNG (core/
 * generic-drawer.js), dựng lại mỗi lần mở qua `openAlbumPicker()`/`_closeAlbumPickerDrawer()` ngay
 * dưới, cùng hạ tầng dùng chung với menu action ảnh/picker ảnh Photo & Album.
 *
 * === Ken Burns (18/07/2026, phản hồi Giang) — VIẾT LẠI HOÀN TOÀN, KHÔNG migrate config cũ ===
 * `transitionType === 'kenburns'` (lựa chọn gộp chung vào 13 kiểu transition, đời trước) ĐÃ XOÁ
 * SẠCH — Ken Burns giờ là toggle ĐỘC LẬP `slideshowConfig.kenBurnsEnabled` (mặc định `false`),
 * dùng ĐƯỢC cùng lúc với BẤT KỲ kiểu transition nào (khác trước: chọn Ken Burns là mất quyền chọn
 * transition, khoá cứng về fade). Cơ chế: `_showFirstImage()`/`_tick()` giờ check
 * `cfg.kenBurnsEnabled` (KHÔNG còn check `cfg.transitionType`) để quyết định có gọi
 * `_activateKenBurns()` hay không — ĐỘC LẬP hoàn toàn với việc chọn transitionType nào.
 * Bật/tắt toggle CHỈ ảnh hưởng từ ẢNH KẾ TIẾP trở đi (Giang chốt: không ép reset ảnh đang hiện
 * hoạt — đúng tiền lệ `changeMode()`/`changeTransitionType()`, không đặc cách riêng cho Ken Burns).
 * Config cũ đã lưu (`transitionType: 'kenburns'`) tự nhiên bị bỏ qua bởi validate
 * `SLIDESHOW_TRANSITION_TYPES.includes()` ở `loadPersistedSettingsOnBoot()` (mảng đó đã bỏ
 * 'kenburns') — rơi về default 'fade', KHÔNG tự bật `kenBurnsEnabled` thay thế (Giang yêu cầu
 * không migrate, không giữ tương thích ngược).
 *
 * "NHÓM 2" (VIẾT LẠI TIẾP, cùng ngày 18/07/2026, THAY HẲN "Nhóm 1" — 8 biến thể random tự động,
 * không ai chọn được) — THÊM field `slideshowConfig.kenBurnsMode` (13 giá trị, xem
 * SLIDESHOW_KENBURNS_MODES ở core/file-manager/slideshow.js), người dùng tự chọn qua <select>
 * MỚI trong Settings (ẩn/hiện theo toggle `kenBurnsEnabled`, cùng khuôn `intervalRow` ẩn/hiện theo
 * `photoPerSong`). 3 giá trị *Random (panRandom/zoomRandom/zoomPanRandom) là META — mỗi lần ảnh
 * mới thành "current", `resolveSlideshowKenBurnsDirection()` (core) tự chọn ngẫu nhiên 1 direction
 * CỤ THỂ trong ĐÚNG nhóm con của nó (không lẫn nhóm — panRandom KHÔNG BAO GIỜ ra kết quả có zoom).
 * VIẾT LẠI LẦN 2 (BẢN ĐÚNG kỹ thuật "Nhóm 2", cùng ngày, Giang chỉ ra bản đầu CHỈ đúng phần chia
 * tuỳ chọn, CHƯA đúng phần kỹ thuật) — TOÀN BỘ animation giờ chạy bằng Web Animations API
 * (`panEl.animate()`, xem `startSlideshowKenBurnsAnimation()` core), KHÔNG còn CSS @keyframes/
 * classList — vì biên pan an toàn giờ TÍNH TỪ TỈ LỆ ẢNH THẬT (record.width/height) so với tỉ lệ
 * khung, mỗi ảnh 1 biên khác nhau, CSS tĩnh không biểu diễn được. Xem docstring đầy đủ ngay trên
 * các hàm core liên quan (core/file-manager/slideshow.js).
 *
 * KIẾN TRÚC 2 LỚP/LAYER (thay vì 1) — mỗi `slideshowLayerN` (ngoài, lo animation chuyển cảnh) giờ
 * bọc 1 `slideshowLayerNPan` (con, lo background-image + animation pan/zoom Ken Burns) — xem
 * docstring đầu assets/css/slideshow.css để biết lý do TÁCH (CSS chỉ giữ 1 `animation-name` hiệu
 * lực/phần tử, gộp chung sẽ đè lẫn nhau lúc cả 2 animation cùng chạy). HỆ QUẢ: `setSlideshowLayerImage()`
 * giờ LUÔN nhận layer CON (`_currentPanLayer()`/`_idlePanLayer()`, method mới ngay dưới, cùng khuôn
 * `_currentLayer()`/`_idleLayer()`) làm tham số — KỂ CẢ khi Ken Burns đang tắt (background-image
 * SỐNG cố định ở layer con bất kể Ken Burns bật/tắt, chỉ animation pan/zoom là có/không). Ken
 * Burns giờ chạy bằng Web Animations API (`startSlideshowKenBurnsAnimation()`/
 * `stopSlideshowKenBurnsAnimation()`, core/file-manager/slideshow.js, VIẾT LẠI LẦN 2 18/07/2026 —
 * xem docstring riêng ngay trên `_activateKenBurns()`) — cũng nhận layer CON, KHÔNG đổi chữ ký
 * hàm core (core vẫn "thuần", chỉ tham số truyền vào đổi ý nghĩa — Rule 2 vẫn giữ).
 */
let slideshowSettingsPanelEl = null; // panel Settings Slideshow đang mở — null nếu đang đóng (Batch D4)
let _albumPickerOverlayClickHandler = null; // MỚI (Giai đoạn 4) — tham chiếu handler đang gắn trên genericDrawerOverlay (element DÙNG CHUNG nhiều feature) để tự gỡ đúng lúc đóng picker Album, xem openAlbumPicker()/_closeAlbumPickerDrawer()

const SLIDESHOW_TASK = 'slideshowTimer';
// MỚI (04/07/2026, mục 5 phản hồi Giang) — task "canh chừng" đổi bài hát cho chế độ "Photo per
// song": poll appState.get('currentKey') (đúng field lưu songKey đang phát, xem
// core/player-controls.js) mỗi 1s, phát hiện ĐỔI THẬT (next/prev/tự next hết bài/chọn bài khác)
// thì mới đổi ảnh — so sánh KEY (không phải currentTime) nên seek trong CÙNG bài KHÔNG kích hoạt
// đổi ảnh (đúng yêu cầu "bù trừ theo seek").
const SLIDESHOW_SONG_WATCH_TASK = 'slideshowSongWatch';

const workflowSlideshow = {
    // Context RUNTIME của riêng engine (KHÔNG phải appState nghiệp vụ — chỉ bookkeeping của chính
    // task lặp, giống cách event/router/*.js giữ context bằng closure `let`; ở đây workflow đóng
    // vai trò Router cho task nên giữ luôn tại đây thay vì 1 router riêng không cần thiết).
    _images: [],           // Array<{key, blob, filename}> của album đang active, nạp lại mỗi start()
    _currentIndex: -1,     // index trong _images đang hiển thị ("current"), -1 = chưa có gì
    _currentObjectUrl: null,
    _layerToggle: false,   // false = layer1 đang 'current', true = layer2 đang 'current'
    _lastSeenSongKey: null, // MỚI (mục 5) — bookkeeping riêng của _startSongWatcher(), xem hàm đó
    // MỚI (18/07/2026, mục 1 phản hồi Giang — "chưa phát nhạc slideshow đã tự chạy") — có đang
    // THẬT SỰ hiện container + chạy task hay không (KHÁC `activeBackgroundAlbum` — cái đó chỉ nói
    // "có album được CHỌN", không nói "đang CHIẾU"). false = đã start() xong phần chuẩn bị (_images
    // nạp sẵn) nhưng ĐANG CHỜ nhạc phát lần đầu mới thật sự hiện — xem _reveal()/syncPlaybackGate().
    _isRevealed: false,
    // MỚI (18/07/2026, mục 2 phản hồi Giang — "mỗi lượt kế tiếp dù giống ảnh trước đó đều phải
    // ngẫu nhiên chứ không dùng vị trí cũ") — direction Ken Burns CỤ THỂ vừa dùng ở lượt kích hoạt
    // gần nhất (bất kể layer nào) — truyền vào resolveSlideshowKenBurnsDirection() làm excludeDirection.
    _lastKenBurnsDirection: null,

    _currentLayer() { return this._layerToggle ? slideshowLayer2 : slideshowLayer1; },
    _idleLayer() { return this._layerToggle ? slideshowLayer1 : slideshowLayer2; },
    // MỚI (Ken Burns, 18/07/2026) — layer CON tương ứng (mang background-image + animation pan/zoom
    // Ken Burns, xem docstring đầu file/assets/css/slideshow.css). CÙNG logic _layerToggle, chỉ đổi
    // đích đến (Pan thay vì layer ngoài).
    _currentPanLayer() { return this._layerToggle ? slideshowLayer2Pan : slideshowLayer1Pan; },
    _idlePanLayer() { return this._layerToggle ? slideshowLayer1Pan : slideshowLayer2Pan; },

    // MỚI (Ken Burns WAAPI, 18/07/2026) — Animation object (Web Animations API) đang chạy trên mỗi
    // layer con (null nếu layer đó chưa từng kích hoạt Ken Burns/đã dừng) — Workflow tự giữ để
    // `.cancel()` đúng lúc (đổi ảnh mới/tắt Ken Burns), xem stopSlideshowKenBurnsAnimation() core.
    _kenBurnsAnim1: null, // Animation trên slideshowLayer1Pan
    _kenBurnsAnim2: null, // Animation trên slideshowLayer2Pan

    _getKenBurnsAnim(panEl) { return panEl === slideshowLayer1Pan ? this._kenBurnsAnim1 : this._kenBurnsAnim2; },
    _setKenBurnsAnim(panEl, anim) {
        if (panEl === slideshowLayer1Pan) this._kenBurnsAnim1 = anim; else this._kenBurnsAnim2 = anim;
    },

    _computeIntervalMs() {
        return Math.max(5, appConfigSlideshow.getAll().intervalSeconds) * 1000;
    },

    /** MỚI (18/07/2026, phản hồi Giang — fix "Photo per song" dùng SAI thời gian cho Ken Burns) —
     * `_computeIntervalMs()` LUÔN đọc `intervalSeconds` (5-60s), kể cả lúc `photoPerSong` đang
     * BẬT — nhưng lúc đó `intervalSeconds` bị ẨN đi/không dùng để đổi ảnh nữa (ảnh đổi theo BÀI
     * HÁT, có thể dài vài phút) — dùng nhầm `intervalSeconds` (thường 5s mặc định) làm duration
     * Ken Burns khiến nó chạy hết + ĐÓNG BĂNG chỉ sau vài giây đầu, "chết đứng" suốt phần còn lại
     * của bài hát.
     * SỬA: `photoPerSong` bật -> ước lượng THỜI GIAN CÒN LẠI của bài hát THẬT
     * (`audioPlayer.duration - audioPlayer.currentTime`) làm duration — core
     * `capSlideshowKenBurnsDurationMs()` sẽ tự kẹp về tối đa 60s ngay sau đó (bài hát dài vài phút
     * -> Ken Burns hoàn thành chuyển động trong 60s đầu rồi đóng băng, ĐÚNG cách Ken Burns thật —
     * không lia liên tục suốt cả bài). Fallback về `_computeIntervalMs()` nếu `duration`/
     * `currentTime` chưa sẵn sàng (metadata chưa load xong, hiếm).
     * ĐỔI TÊN (18/07/2026, mục "thêm thời gian transition") — từ `_computeKenBurnsDurationMs()`
     * thành tên TỔNG QUÁT hơn: hàm này TRẢ VỀ "ảnh sắp hiện sẽ hiển thị trong bao lâu" — ước lượng
     * này ĐÚNG cho CẢ Ken Burns LẪN việc kẹp thời gian transition (mục mới — xem
     * `capSlideshowTransitionDurationMs()`, core) — dùng CHUNG 1 hàm, không viết lại logic
     * photoPerSong-aware 2 lần.
     * @returns {number}
     */
    _computeImageDisplayDurationMs() {
        const cfg = appConfigSlideshow.getAll();
        if (cfg.photoPerSong && audioPlayer && Number.isFinite(audioPlayer.duration) && audioPlayer.duration > 0) {
            const remainingMs = (audioPlayer.duration - audioPlayer.currentTime) * 1000;
            if (remainingMs > 0) return remainingMs;
        }
        return this._computeIntervalMs();
    },

    /** MỚI (04/07/2026, mục 5 phản hồi Giang) — chế độ "Photo per song": THAY task đếm giờ cố định
     * bằng task poll `currentKey` mỗi 1s — CHỈ gọi `_tick()` (đổi ảnh) khi key ĐỔI THẬT so với lần
     * đọc trước (next/prev/hết bài tự next/chọn bài khác đều đổi `currentKey` — xem
     * core/player-controls.js), seek trong CÙNG bài KHÔNG đổi key nên KHÔNG kích hoạt đổi ảnh (đúng
     * yêu cầu "bù trừ theo seek"). Baseline lúc bắt đầu = key hiện tại, KHÔNG tính là "vừa đổi bài"
     * ngay lượt đọc đầu tiên. */
    _startSongWatcher() {
        this._lastSeenSongKey = appState.get('currentKey');
        taskManager.kill(SLIDESHOW_SONG_WATCH_TASK);
        taskManager.addNew(SLIDESHOW_SONG_WATCH_TASK, {
            time: 1000,
            exe: () => {
                const key = appState.get('currentKey');
                if (key === this._lastSeenSongKey) return; // chưa đổi bài (kể cả đang seek) -> bỏ qua
                this._lastSeenSongKey = key;
                this._tick(); // TÁI DÙNG NGUYÊN cơ chế đổi ảnh — không quan tâm lý do được gọi
            },
            mode: 'timeout', count: 0,
        });
        taskManager.operator(SLIDESHOW_SONG_WATCH_TASK, 'enabled');
    },

    // ===================== Boot / persist =====================

    /** Đọc lại slideshowConfig/activeBackgroundAlbum đã lưu (meta) lúc boot — gọi 1 LẦN từ
     * DOMContentLoaded (core/visualizer/draw-visualizer.js), SAU loadConfig().
     * Ken Burns (18/07/2026) — đọc `kenBurnsEnabled`/`kenBurnsMode` như field bình thường, KHÔNG
     * migrate config cũ (`transitionType: 'kenburns'` đời trước tự bị validate `SLIDESHOW_TRANSITION_TYPES.includes()`
     * loại bỏ ở dòng dưới — rơi về default 'fade', KHÔNG tự bật `kenBurnsEnabled` thay thế, đúng
     * yêu cầu Giang "xoá sạch, không migrate"). */
    async loadPersistedSettingsOnBoot() {
        const [savedConfig, savedAlbumId] = await Promise.all([
            getMeta('slideshowConfig'),
            getMeta('activeBackgroundAlbum'),
        ]);
        if (savedConfig && typeof savedConfig === 'object') {
            appConfigSlideshow.mutateAll((cfg) => {
                if (savedConfig.mode === 'sequential' || savedConfig.mode === 'random') cfg.mode = savedConfig.mode;
                if (typeof savedConfig.intervalSeconds === 'number' && savedConfig.intervalSeconds >= 5) cfg.intervalSeconds = savedConfig.intervalSeconds;
                if (SLIDESHOW_TRANSITION_TYPES.includes(savedConfig.transitionType)) cfg.transitionType = savedConfig.transitionType;
                if (typeof savedConfig.photoPerSong === 'boolean') cfg.photoPerSong = savedConfig.photoPerSong;
                if (typeof savedConfig.kenBurnsEnabled === 'boolean') cfg.kenBurnsEnabled = savedConfig.kenBurnsEnabled;
                if (SLIDESHOW_KENBURNS_MODES.includes(savedConfig.kenBurnsMode)) cfg.kenBurnsMode = savedConfig.kenBurnsMode;
                // MỚI (18/07/2026, phản hồi Giang — tuỳ chỉnh thời gian/tỉ lệ/easing transition).
                if (typeof savedConfig.transitionDurationMs === 'number' && savedConfig.transitionDurationMs >= SLIDESHOW_TRANSITION_MIN_TIME_MS && savedConfig.transitionDurationMs <= SLIDESHOW_TRANSITION_MAX_TIME_MS) cfg.transitionDurationMs = savedConfig.transitionDurationMs;
                if (typeof savedConfig.transitionInOutRatio === 'number' && savedConfig.transitionInOutRatio >= 0 && savedConfig.transitionInOutRatio <= 100) cfg.transitionInOutRatio = savedConfig.transitionInOutRatio;
                if (SLIDESHOW_TRANSITION_EASINGS.includes(savedConfig.transitionEasing)) cfg.transitionEasing = savedConfig.transitionEasing;
            });
        }
        if (!savedAlbumId) return;
        const record = await getAlbumRecord(savedAlbumId); // data layer — phòng album đã bị xoá thủ công/lỗi đồng bộ
        if (!record) { await setMeta('activeBackgroundAlbum', null); return; } // tham chiếu mồ côi -> tự dọn, không bật engine
        appState.set('activeBackgroundAlbum', savedAlbumId);
        await this.start(savedAlbumId);
    },

    // ===================== Điều khiển album nền =====================

    /** Ứng với chọn 1 album làm nền Slideshow — 2 entry point cùng gọi vào đây: Slideshow Settings
     * Drawer ("Chọn Album") VÀ thanh quản lý album trong Photo & Album ("Dùng làm nền Slideshow").
     * @param {string} albumId
     */
    async setActiveAlbum(albumId) {
        appState.set('activeBackgroundAlbum', albumId);
        console.log(`writer: "workflowSlideshow.setActiveAlbum", page: "activeBackgroundAlbum", content: "${albumId}"`);
        await setMeta('activeBackgroundAlbum', albumId); // data layer, persist
        await this.start(albumId);
    },

    /** Tắt nền Slideshow — dọn tham chiếu + dừng engine. Dùng cho CẢ 2 ngữ cảnh: người dùng chủ
     * động bấm "Tắt" ở Settings Drawer, VÀ cascade khi album đang active bị xoá (gọi từ
     * event/workflow/file-manager-photo.js::deleteAlbumFromList() (đổi tên ở Giai đoạn 3b, rewrite Photo/Album)). */
    async clearActiveAlbum() {
        appState.set('activeBackgroundAlbum', null);
        console.log(`writer: "workflowSlideshow.clearActiveAlbum", page: "activeBackgroundAlbum", content: "null"`);
        await setMeta('activeBackgroundAlbum', null);
        this.stop();
    },

    /** Đọc lại danh sách ảnh của 1 album (gọi lúc start(), phòng album vừa được thêm/gỡ ảnh ở
     * Photo & Album trong lúc slideshow đang chạy nền).
     * @param {string} albumId
     */
    async refreshImages(albumId) {
        const albumRecord = await getAlbumRecord(albumId); // data layer
        if (!albumRecord || !Array.isArray(albumRecord.imageKeys) || albumRecord.imageKeys.length === 0) {
            this._images = [];
            return;
        }
        const records = await Promise.all(albumRecord.imageKeys.map(async (key) => {
            const record = await getImageRecord(key); // data layer
            return record ? { key, ...record } : null;
        }));
        this._images = records.filter(Boolean);
    },

    /** Bắt đầu (hoặc khởi động lại) engine cho 1 albumId.
     * VIẾT LẠI (04/07/2026, mục 5 phản hồi Giang) — rẽ nhánh theo `slideshowConfig.photoPerSong`:
     * true -> `_startSongWatcher()` (đổi ảnh theo bài hát); false -> task đếm giờ cố định như cũ.
     * VIẾT LẠI LẦN 2 (18/07/2026, mục 1 phản hồi Giang — "chưa phát nhạc slideshow đã tự chạy và
     * hiển thị ảnh rồi") — TÁCH phần "chuẩn bị" (nạp _images, reset index — LUÔN làm ngay) khỏi
     * phần "hiện + chạy" (`_reveal()`, CHỈ làm khi `_shouldBeRunning()` — nhạc đang phát THẬT +
     * video nền tắt). Nếu gọi start() lúc nhạc CHƯA phát (vd boot xong tự restore album đã lưu,
     * hoặc vừa chọn album trong Settings lúc nhạc đang pause) -> _images đã sẵn sàng nhưng
     * container VẪN ẨN, KHÔNG task nào chạy — chờ `syncPlaybackGate()` gọi `_reveal()` đúng lúc
     * nhạc bắt đầu phát lần đầu (xem handleAudioPlay(), core/player-controls.js).
     * @param {string} albumId
     */
    async start(albumId) {
        this.stop(); // dọn sạch task/DOM cũ trước khi bắt đầu lại (đổi album giữa lúc đang chạy)
        await this.refreshImages(albumId);
        if (this._images.length === 0) {
            setSlideshowContainerVisible(slideshowContainer, false); // core
            return; // album rỗng -> chưa có gì để chiếu; mở lại Settings Drawer / thêm ảnh xong sẽ tự refresh khi start() được gọi lại
        }
        this._currentIndex = -1;
        this._layerToggle = false;
        if (this._shouldBeRunning()) this._reveal();
        // Chưa đủ điều kiện (nhạc chưa phát/đang pause, hoặc video nền đang bật) -> để yên, container
        // ẩn, KHÔNG hiện ảnh nào — chờ syncPlaybackGate() gọi lại đúng lúc đủ điều kiện.
    },

    /** MỚI (18/07/2026, mục 1 phản hồi Giang) — tính xem engine CÓ NÊN đang "chạy" hay không, dựa
     * trên 2 điều kiện ĐỘC LẬP PHẢI ĐÚNG CÙNG LÚC: (1) audio đang phát THẬT (không chỉ có
     * currentKey — phải đọc thẳng `audioPlayer.paused`, tin cậy hơn appState có thể lệch nhịp) VÀ
     * (2) video nền KHÔNG đang bật (video luôn che kín, chạy slideshow phía dưới vô nghĩa — lý do
     * cũ của pauseForVideoBg()/resumeFromVideoBg(), giờ GỘP CHUNG vào đây thay vì 2 hàm riêng).
     * @returns {boolean}
     */
    _shouldBeRunning() {
        return !audioPlayer.paused && !appConfigViz.getAll().videoBgEnabled;
    },

    /** MỚI (18/07/2026, mục 1 phản hồi Giang) — hiện container + ảnh đầu tiên + bắt đầu task lặp
     * (hoặc song-watcher) — gọi LẦN ĐẦU đúng lúc `_shouldBeRunning()` chuyển từ false -> true (từ
     * `start()` nếu nhạc ĐÃ phát sẵn, hoặc từ `syncPlaybackGate()` lúc nhạc BẮT ĐẦU phát). KHÔNG
     * gọi lại nếu ĐÃ revealed rồi (dùng `_resumeTicking()` thay — xem `syncPlaybackGate()`).
     * MỚI (mục 4 phản hồi Giang — "khi áp dụng slideshow thì phải ẩn background image, không tắt")
     * — ẨN `#visual-bg-image` (opacity 0, KHÔNG đụng `vizConfig.visualBgImageEnabled`/`visualBgImage`
     * trong state) — slideshow ĐÃ che nó bằng z-index rồi (xem core/state-and-video-bg.js), nhưng
     * ẩn tường minh để tránh lớp đó vẫn "sống" ngầm dưới lúc slideshow hiện. `stop()` tự khôi phục
     * lại ĐÚNG theo trạng thái `visualBgImageEnabled` của chính nó (KHÔNG tự ép bật lại nếu người
     * dùng vốn dĩ đã tắt nó từ trước). */
    _reveal() {
        if (this._isRevealed) return;
        this._isRevealed = true;
        if (visualBgImageElement && appConfigViz.getAll().visualBgImageEnabled) {
            visualBgImageElement.style.opacity = '0'; // core dom-ref trực tiếp — CHỈ ẩn, KHÔNG tắt state
        }
        setSlideshowContainerVisible(slideshowContainer, true); // core
        this._showFirstImage();
        if (appConfigSlideshow.getAll().photoPerSong) {
            this._startSongWatcher();
        } else {
            taskManager.kill(SLIDESHOW_TASK);
            taskManager.addNew(SLIDESHOW_TASK, { time: this._computeIntervalMs(), exe: () => this._tick(), mode: 'timeout', count: 0 });
            taskManager.operator(SLIDESHOW_TASK, 'enabled');
        }
    },

    /** MỚI (18/07/2026, mục 1 phản hồi Giang) — điểm ĐỒNG BỘ DUY NHẤT cho trạng thái "chạy" của
     * engine, gọi từ MỌI nguồn có thể ảnh hưởng (audio play/pause — core/player-controls.js;
     * video nền bật/tắt — event/workflow/visualizer-control-center.js). THAY HẲN 2 hàm riêng lẻ
     * cũ `pauseForVideoBg()`/`resumeFromVideoBg()` — gộp chung vào đây để 2 nguồn KHÔNG dẫm chân
     * nhau (vd nhạc resume nhưng video nền vẫn đang bật -> KHÔNG được chạy, chỉ 1 hàm duy nhất
     * kiểm tra CẢ HAI điều kiện mới quyết định đúng). Tự idempotent — gọi lại nhiều lần dù trạng
     * thái không đổi cũng không sao. */
    syncPlaybackGate() {
        if (!appState.get('activeBackgroundAlbum')) return; // không có slideshow nào được chọn -> không có gì để sync
        const shouldRun = this._shouldBeRunning();
        if (shouldRun && !this._isRevealed) this._reveal();
        else if (shouldRun && this._isRevealed) this._resumeTicking();
        else if (!shouldRun && this._isRevealed) this._pauseTicking();
    },

    /** MỚI (18/07/2026, mục 1 phản hồi Giang) — tạm dừng task lặp + ĐÓNG BĂNG Ken Burns TẠI ĐÚNG
     * vị trí hiện tại (không cancel/reset — xem pauseSlideshowKenBurnsAnimation(), core). */
    _pauseTicking() {
        taskManager.pause(SLIDESHOW_TASK);
        taskManager.pause(SLIDESHOW_SONG_WATCH_TASK);
        pauseSlideshowKenBurnsAnimation(this._kenBurnsAnim1); // core
        pauseSlideshowKenBurnsAnimation(this._kenBurnsAnim2); // core
    },

    /** MỚI (18/07/2026, mục 1 phản hồi Giang) — chạy tiếp task lặp + Ken Burns từ ĐÚNG vị trí đã
     * đóng băng (không restart). */
    _resumeTicking() {
        if (taskManager.plan[SLIDESHOW_TASK]) taskManager.resume(SLIDESHOW_TASK);
        if (taskManager.plan[SLIDESHOW_SONG_WATCH_TASK]) taskManager.resume(SLIDESHOW_SONG_WATCH_TASK);
        resumeSlideshowKenBurnsAnimation(this._kenBurnsAnim1); // core
        resumeSlideshowKenBurnsAnimation(this._kenBurnsAnim2); // core
    },

    /** Dừng hẳn engine — dọn task + ẩn container + revoke object URL.
     * VIẾT LẠI (04/07/2026, mục 3 — Rule 3 siết chặt): core không còn hàm gộp
     * `resetSlideshowLayers()` (từng tự gọi 2 hàm core khác bên trong, nay cấm) — Workflow tự lặp
     * qua 2 layer, tự gọi TỪNG hàm core cần thiết theo đúng thứ tự.
     * SỬA (Ken Burns WAAPI, 18/07/2026) — `setSlideshowLayerImage()`/`stopSlideshowKenBurnsAnimation()`
     * giờ nhận layer CON (Pan), `resetSlideshowLayerClasses()` vẫn nhận layer NGOÀI như cũ (2 việc
     * khác phần tử — xem docstring đầu file). Task `slideshowKenBurnsFreeze1`/`2` KHÔNG CÒN TỒN TẠI
     * (kỹ thuật CSS cũ cần tự "đóng băng" bằng tay — WAAPI `fill:'forwards'` tự làm việc đó, xem
     * docstring `startSlideshowKenBurnsAnimation()` core) — bỏ luôn 2 dòng `taskManager.kill()` đó.
     * SỬA LẦN 2 (18/07/2026, mục 1+4 phản hồi Giang) — reset `_isRevealed`/`_lastKenBurnsDirection`
     * (engine tắt hẳn = phải "chưa revealed" nếu start() lại) + KHÔI PHỤC Visual bg image (`#visual-
     * bg-image`) về ĐÚNG trạng thái `visualBgImageEnabled` của chính nó (mục 4 — chỉ ẨN lúc slideshow
     * chạy, KHÔNG tắt state, nên lúc dừng phải trả lại y như trước nếu nó vốn đang bật). */
    stop() {
        taskManager.kill(SLIDESHOW_TASK);
        taskManager.kill(SLIDESHOW_SONG_WATCH_TASK);
        setSlideshowContainerVisible(slideshowContainer, false); // core
        [[slideshowLayer1, slideshowLayer1Pan], [slideshowLayer2, slideshowLayer2Pan]].forEach(([layerEl, panEl]) => {
            setSlideshowLayerImage(panEl, ''); // core — layer CON
            stopSlideshowKenBurnsAnimation(panEl, this._getKenBurnsAnim(panEl)); // core — layer CON
            this._setKenBurnsAnim(panEl, null);
            resetSlideshowLayerClasses(layerEl); // core — layer NGOÀI
        });
        if (this._currentObjectUrl) { try { URL.revokeObjectURL(this._currentObjectUrl); } catch (e) {} this._currentObjectUrl = null; }
        this._currentIndex = -1;
        this._isRevealed = false;
        this._lastKenBurnsDirection = null;
        if (visualBgImageElement && appConfigViz.getAll().visualBgImageEnabled) {
            visualBgImageElement.style.opacity = '1'; // core dom-ref trực tiếp — khôi phục ĐÚNG trạng thái riêng của nó
        }
    },

    /** Hiện ảnh ĐẦU TIÊN ngay lập tức lúc start() (KHÔNG chuyển cảnh — chỉ set thẳng lên layer
     * "current"), thay vì để màn hình trống chờ hết interval đầu tiên mới thấy gì.
     * SỬA (Ken Burns, 18/07/2026) — background-image set lên layer CON (`_currentPanLayer()`),
     * class `ss-current` vẫn gán lên layer NGOÀI (`_currentLayer()`) như cũ. Điều kiện kích hoạt
     * Ken Burns đổi từ `cfg.transitionType === 'kenburns'` sang `cfg.kenBurnsEnabled` — ĐỘC LẬP
     * với transitionType đang chọn. */
    _showFirstImage() {
        const image = this._images[0];
        if (!image) return;
        const objectUrl = URL.createObjectURL(image.blob);
        this._currentObjectUrl = objectUrl;
        this._currentIndex = 0;
        const layerEl = this._currentLayer();
        const panEl = this._currentPanLayer();
        setSlideshowLayerImage(panEl, objectUrl); // core — layer CON
        if (layerEl) layerEl.classList.add('ss-current');
        const cfg = appConfigSlideshow.getAll();
        setSlideshowTransitionType(slideshowContainer, cfg.transitionType); // core
        if (cfg.kenBurnsEnabled) this._activateKenBurns(panEl, cfg.kenBurnsMode, image);
    },

    /**
     * MỚI (04/07/2026, mục 3 phản hồi Giang — Rule 3 siết chặt): Workflow (KHÔNG phải core) tự
     * chọn direction/tính bounds rồi gọi core tạo Animation — giữ đúng Rule 2 (core nhận mọi thứ
     * qua tham số, không tự đọc appState/window).
     * SỬA (Ken Burns, 18/07/2026) — nhận layer CON (Pan), KHÔNG phải layer ngoài.
     * VIẾT LẠI LẦN 2 ("Nhóm 2" WAAPI, 18/07/2026) — resolve direction + tính bounds từ ảnh thật.
     * VIẾT LẠI LẦN 3 (18/07/2026, "time-scaled magnitude" + fix "Photo per song" phản hồi Giang) —
     * `durationMs` giờ đọc qua `_computeImageDisplayDurationMs()` (ĐÚNG cho cả 2 chế độ, xem hàm đó)
     * THAY vì luôn `_computeIntervalMs()` — rồi CAP 1 LẦN DUY NHẤT qua `capSlideshowKenBurnsDurationMs()`
     * (core) NGAY TẠI ĐÂY, dùng CHUNG kết quả đã cap cho CẢ `pickSlideshowKenBurnsKeyframes()` LẪN
     * `startSlideshowKenBurnsAnimation()` — 2 nơi PHẢI khớp nhau tuyệt đối (biên độ tính theo 1 con
     * số, animation chạy theo con số khác = lệch tốc độ, đúng bug gốc Giang phát hiện).
     * @param {HTMLElement} panEl - layer CON `.ss-kenburns-pan`.
     * @param {string} mode - 1 trong SLIDESHOW_KENBURNS_MODES (cfg.kenBurnsMode).
     * @param {{width?: number, height?: number}} image - ẢNH SẮP chiếu lên panEl (record đầy đủ,
     *   `width`/`height` là kích thước ẢNH GỐC — có thể thiếu ở record cũ, core tự fallback an toàn).
     */
    _activateKenBurns(panEl, mode, image) {
        const direction = resolveSlideshowKenBurnsDirection(mode, this._lastKenBurnsDirection); // core
        this._lastKenBurnsDirection = direction; // MỚI (mục 2) — nhớ lại cho lượt kế tiếp loại trừ
        const bounds = computeSlideshowKenBurnsSafeBounds(image ? image.width : 0, image ? image.height : 0, window.innerWidth, window.innerHeight); // core
        const durationMs = capSlideshowKenBurnsDurationMs(this._computeImageDisplayDurationMs()); // core — cap 1 LẦN, dùng chung 2 nơi dưới
        const keyframes = pickSlideshowKenBurnsKeyframes(direction, bounds, durationMs); // core
        const anim = startSlideshowKenBurnsAnimation(panEl, keyframes, durationMs); // core
        this._setKenBurnsAnim(panEl, anim);
    },

    /** taskManager exe — đóng vai trò "Router" cho tick tự sinh (xem comment đầu file): tự đọc
     * appState rồi gọi hàm THUẦN ở core/file-manager/slideshow.js.
     * ĐƠN GIẢN HOÁ (04/07/2026, mục 2 phản hồi Giang) — bỏ hẳn check `videoBgEnabled` + pause() ở
     * đây: watchdog poll 3s/lần đã XOÁ (xem lý do ở `syncPlaybackGate()` phía trên) — task này giờ
     * CHỈ chạy khi thật sự KHÔNG bị pause từ bên ngoài, không cần tự kiểm tra lại nữa.
     * SỬA (Ken Burns, 18/07/2026) — background-image/Ken Burns thao tác lên layer CON
     * (`outgoingPan`/`incomingPan`), transition chuyển cảnh (class ss-layer-enter/exit) vẫn thao
     * tác lên layer NGOÀI (`outgoingLayer`/`incomingLayer`) như cũ. Điều kiện Ken Burns đổi sang
     * `cfg.kenBurnsEnabled` — ĐỘC LẬP với `cfg.transitionType`, nên chạy được cùng lúc với BẤT KỲ
     * kiểu transition nào (khác trước: 'kenburns' khoá cứng transition về fade).
     * VIẾT LẠI LẦN 2 (18/07/2026, phản hồi Giang — "thêm thời gian transition giữa 2 ảnh") —
     * TÍNH thời gian transition THẬT (kẹp theo `_computeImageDisplayDurationMs()` — tránh xung đột
     * với lượt `_tick()` kế tiếp) + tách "in"/"out" theo tỉ lệ đã cấu hình (bỏ qua tỉ lệ, dùng
     * TOÀN BỘ `totalMs` làm "in" nếu kiểu transition hiện tại KHÔNG hỗ trợ pha "out" — xem
     * `transitionSupportsInOutRatio()`) — set ĐỘNG lên từng layer TRƯỚC khi
     * `startSlideshowTransitionVisuals()` thêm class (thứ tự BẮT BUỘC, xem docstring
     * `setSlideshowTransitionTiming()` core). Task cleanup giờ đợi `Math.max(inMs, outMs)`. */
    _tick() {
        if (this._images.length === 0) return; // album rỗng (ảnh vừa bị xoá hết) -> chờ, không lỗi

        const cfg = appConfigSlideshow.getAll();
        const nextIndex = cfg.mode === 'random'
            ? pickNextSlideshowIndexRandom(this._currentIndex, this._images.length)      // core
            : pickNextSlideshowIndexSequential(this._currentIndex, this._images.length); // core
        if (nextIndex === -1) return;

        const image = this._images[nextIndex];
        const objectUrl = URL.createObjectURL(image.blob);
        const outgoingLayer = this._currentLayer();
        const incomingLayer = this._idleLayer();
        const outgoingPan = this._currentPanLayer();
        const incomingPan = this._idlePanLayer();

        setSlideshowTransitionType(slideshowContainer, cfg.transitionType); // core
        setSlideshowLayerImage(incomingPan, objectUrl); // core — layer CON
        if (cfg.kenBurnsEnabled) this._activateKenBurns(incomingPan, cfg.kenBurnsMode, image);

        // MỚI (18/07/2026, mục "thêm thời gian transition") — tính in/out THẬT từ config, kẹp
        // theo thời gian ảnh sẽ hiển thị (tránh xung đột lượt _tick() kế tiếp).
        const totalMs = capSlideshowTransitionDurationMs(cfg.transitionDurationMs, this._computeImageDisplayDurationMs()); // core
        const { inMs, outMs } = transitionSupportsInOutRatio(cfg.transitionType) // core
            ? computeSlideshowTransitionInOutMs(totalMs, cfg.transitionInOutRatio) // core
            : { inMs: totalMs, outMs: totalMs }; // 3 kiểu không có pha "out" -> bỏ qua tỉ lệ, dùng trọn totalMs cho "in"
        setSlideshowTransitionTiming(incomingLayer, inMs, cfg.transitionEasing); // core — PHẢI set TRƯỚC khi thêm class
        setSlideshowTransitionTiming(outgoingLayer, outMs, cfg.transitionEasing); // core

        // VIẾT LẠI (04/07/2026, mục 3 — Rule 3 siết chặt): trước đây gọi 1 hàm core duy nhất
        // (beginSlideshowTransition) TỰ taskManager.once() + TỰ gọi core khác bên trong — giờ CẤM.
        // Workflow tự làm cả 2 việc đó: gọi core "bắt đầu" NGAY, rồi TỰ taskManager.once() lịch
        // đúng lúc hết thời lượng THẬT (Math.max(inMs, outMs)) để tự gọi TỪNG hàm core "kết thúc".
        startSlideshowTransitionVisuals(outgoingLayer, incomingLayer); // core — layer NGOÀI
        const cleanupDelayMs = Math.max(inMs, outMs);
        taskManager.once(() => {
            setSlideshowLayerImage(outgoingPan, ''); // core — layer CON
            stopSlideshowKenBurnsAnimation(outgoingPan, this._getKenBurnsAnim(outgoingPan)); // core — layer CON (Ken Burns WAAPI)
            this._setKenBurnsAnim(outgoingPan, null);
            finishSlideshowTransitionVisuals(outgoingLayer, incomingLayer); // core — layer NGOÀI
        }, cleanupDelayMs, 'slideshowTransitionCleanup');

        if (this._currentObjectUrl) {
            const staleUrl = this._currentObjectUrl;
            taskManager.once(() => { try { URL.revokeObjectURL(staleUrl); } catch (e) {} }, cleanupDelayMs + 100, 'slideshowRevokeStale');
        }
        this._currentObjectUrl = objectUrl;
        this._currentIndex = nextIndex;
        this._layerToggle = !this._layerToggle;
    },

    // ===================== Settings Drawer (cụm router "slideshowSettings") =====================

    /** Ứng với 'slideshowSettings.openPanel.click' — push panel + vẽ lại UI. */
    async openPanel() {
        slideshowSettingsPanelEl = pushSettingsPanel({ title: t('slideshowSettingsDrawer.title'), bodyHtml: renderSlideshowPanelBody() });
        await this.refreshDrawerUI();
    },

    /** Vẽ lại toàn bộ UI Settings Drawer theo state hiện tại — gọi lúc mở drawer + sau mỗi lần
     * đổi album/mode/interval/transitionType.
     * VIẾT LẠI (Batch 9, 04/07/2026, mục 4; ĐƠN GIẢN HOÁ THÊM 04/07/2026 đợt 2 — bỏ hẳn hàng "album
     * đang chạy" theo phản hồi Giang) — 2 nút "Chọn Album"/"Tắt" cũ giờ CHỈ còn 1 toggle
     * (`setting-slideshow-enable`), phản ánh ĐÚNG BẰNG việc CÓ/KHÔNG có `activeBackgroundAlbum`.
     * Đổi album khi đang bật: gạt Off (xoá album) rồi gạt lại On (mở lại panel từ đầu). */
    async refreshDrawerUI() {
        if (!slideshowSettingsPanelEl) return; // panel đã đóng — an toàn bỏ qua (Batch D4)
        const albumId = appState.get('activeBackgroundAlbum');
        const cfg = appConfigSlideshow.getAll();

        const enableToggle = slideshowSettingsPanelEl.querySelector('#setting-slideshow-enable');
        const modeSelect = slideshowSettingsPanelEl.querySelector('#setting-slideshow-mode');
        const photoPerSongToggle = slideshowSettingsPanelEl.querySelector('#setting-slideshow-photo-per-song');
        const intervalRow = slideshowSettingsPanelEl.querySelector('#slideshow-interval-row');
        const intervalBtn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-interval');
        const transitionSelect = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition');
        const kenBurnsToggle = slideshowSettingsPanelEl.querySelector('#setting-slideshow-kenburns');
        const kenBurnsModeRow = slideshowSettingsPanelEl.querySelector('#slideshow-kenburns-mode-row');
        const kenBurnsModeSelect = slideshowSettingsPanelEl.querySelector('#setting-slideshow-kenburns-mode');
        const transitionDurationBtn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-duration');
        const transitionRatioRow = slideshowSettingsPanelEl.querySelector('#slideshow-transition-ratio-row');
        const transitionRatioSlider = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-ratio');
        const transitionEasingSelect = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-easing');

        if (enableToggle) enableToggle.checked = !!albumId;
        if (modeSelect) modeSelect.value = cfg.mode;
        // MỚI (04/07/2026, mục 5) — đồng bộ toggle "Photo per song" + ẩn hàng "Thời gian mỗi ảnh"
        // khi đang bật (không còn ý nghĩa gì lúc đó).
        if (photoPerSongToggle) photoPerSongToggle.checked = !!cfg.photoPerSong;
        if (intervalRow) intervalRow.classList.toggle('hidden', !!cfg.photoPerSong);
        if (intervalBtn) intervalBtn.textContent = `${cfg.intervalSeconds}s`; // SỬA (18/07/2026) — nút bấm (textContent), không còn <input>.value
        if (transitionSelect) transitionSelect.value = cfg.transitionType;
        // MỚI (Ken Burns, 18/07/2026) — đồng bộ toggle độc lập, KHÔNG còn nằm trong transitionSelect.
        if (kenBurnsToggle) kenBurnsToggle.checked = !!cfg.kenBurnsEnabled;
        // MỚI ("Nhóm 2", 18/07/2026) — đồng bộ <select> 13 chế độ + ẩn hàng khi Ken Burns đang tắt
        // (không còn ý nghĩa gì lúc đó — cùng khuôn intervalRow ẩn/hiện theo photoPerSong).
        if (kenBurnsModeRow) kenBurnsModeRow.classList.toggle('hidden', !cfg.kenBurnsEnabled);
        if (kenBurnsModeSelect) kenBurnsModeSelect.value = cfg.kenBurnsMode;
        // MỚI (18/07/2026, mục "thêm thời gian transition") — đồng bộ nút thời gian + ẩn/hiện hàng
        // tỉ lệ theo ĐÚNG transitionType hiện tại (transitionSupportsInOutRatio(), core) + đồng bộ
        // slider + nhãn "In Xs / Out Ys" + easing.
        if (transitionDurationBtn) transitionDurationBtn.textContent = `${(cfg.transitionDurationMs / 1000).toFixed(1)}s`;
        if (transitionRatioRow) transitionRatioRow.classList.toggle('hidden', !transitionSupportsInOutRatio(cfg.transitionType)); // core
        if (transitionRatioSlider) transitionRatioSlider.value = cfg.transitionInOutRatio;
        this._updateTransitionRatioLabel(slideshowSettingsPanelEl, cfg.transitionInOutRatio);
        if (transitionEasingSelect) transitionEasingSelect.value = cfg.transitionEasing;
    },

    /** MỚI (04/07/2026, mục 5) — ứng với gạt "Photo per song". Persist + nếu engine đang chạy, khởi
     * động lại NGAY với cơ chế tick tương ứng (start() tự đọc lại `slideshowConfig.photoPerSong`
     * để quyết định dùng task đếm giờ hay task theo dõi bài hát — xem start()).
     * @param {boolean} checked
     */
    async changePhotoPerSong(checked) {
        appConfigSlideshow.mutateAll((cfg) => { cfg.photoPerSong = checked; });
        console.log(`writer: "workflowSlideshow.changePhotoPerSong", page: "slideshowConfig", content: "photoPerSong=${checked}"`);
        await setMeta('slideshowConfig', appConfigSlideshow.getAll());
        if (slideshowSettingsPanelEl) {
            const intervalRow = slideshowSettingsPanelEl.querySelector('#slideshow-interval-row');
            if (intervalRow) intervalRow.classList.toggle('hidden', checked);
        }
        const albumId = appState.get('activeBackgroundAlbum');
        if (albumId) await this.start(albumId); // khởi động lại engine với cơ chế tick mới ngay lập tức
    },

    /** MỚI (Batch 9, mục 4) — ứng với gạt "#setting-slideshow-enable": On -> mở panel chọn Album
     * NGAY; Off -> tắt hẳn (clearActiveAlbum, xem cơ chế thống nhất đã áp dụng cho Video/Ảnh nền ở
     * mục 1, cùng ngày).
     * @param {boolean} checked
     */
    async onEnableToggleChange(checked) {
        if (checked) {
            await this.openAlbumPicker();
        } else {
            await this.clearActiveAlbum();
            await this.refreshDrawerUI();
        }
    },

    /** MỚI (Batch 9, mục 4) — mở panel chọn Album.
     * VIẾT LẠI (Giai đoạn 4, rewrite Photo/Album, mục 1, Giang yêu cầu "bỏ modal đi mà áp dụng
     * gentic drawer") — THAY HẲN panel "notify center" tĩnh (mount sẵn lúc boot) bằng Generic Drawer
     * ĐỘNG (core/generic-drawer.js) — cùng hạ tầng đã dùng cho menu action ảnh/picker ảnh Photo &
     * Album. `genericDrawerOverlay` là element DÙNG CHUNG nhiều feature (KHÔNG riêng gì Slideshow) —
     * PHẢI tự wire/gỡ listener ĐÚNG lúc mở/đóng (không thể wire tĩnh 1 lần, xem
     * `_closeAlbumPickerDrawer()` ngay dưới), khác `renderSlideshowAlbumPickerGrid()` (core/
     * file-manager/photo-ui.js) — hàm đó GIỮ NGUYÊN, chỉ đổi NƠI nó vẽ vào (genericDrawerBody thay
     * vì panel tĩnh cũ).
     * Dùng CHUNG cho 2 ngữ cảnh: (a) vừa gạt "On" lần đầu (chưa có album), (b) bấm hàng "album đang
     * chạy" để ĐỔI sang album khác (đã có album từ trước). */
    async openAlbumPicker() {
        const [albums, images] = await Promise.all([listAlbums(), listImages()]); // core có sẵn, CÓ return, DÙNG ngay dưới
        const imageRecordsByKey = new Map(images.map((img) => [img.key, img]));
        const activeAlbumId = appState.get('activeBackgroundAlbum');

        openGenericDrawer({ // core/generic-drawer.js
            zIndex: Z_INDEX.GENERIC_DRAWER, // core/config.js — mặc định, không có overlay ảnh nào mở đồng thời
            headerHtml: `
                <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                    <h3 class="text-base font-bold text-slate-900">${t('slideshowSettingsDrawer.albumPicker.title')}</h3>
                    <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            `, // cùng khuôn header Generic Drawer ảnh (event/workflow/file-manager-photo.js::_buildImageMenuHeaderHtml()) — viết riêng thay vì gọi cross-domain vì chỉ 8 dòng, không đáng ghép phụ thuộc 2 workflow cho 1 đoạn HTML nhỏ (cùng tinh thần core/pagination.js chấp nhận lặp code nhỏ đổi lấy ranh giới rõ ràng)
            bodyHtml: `
                <div id="slideshow-album-picker-grid" class="grid grid-cols-3 gap-x-2 gap-y-5"></div>
                <p id="slideshow-album-picker-empty" class="hidden text-sm text-slate-300 text-center py-8">${t('slideshowSettingsDrawer.albumPicker.empty')}</p>
            `,
            bodyClass: 'overflow-y-auto px-4 pb-6 pt-2',
        });

        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            eventBus.send({ router: 'slideshowSettings', type: 'slideshowSettings.albumPicker.overlay.click', payload: {} }); // dùng CHUNG message với bấm ra ngoài — cùng ý nghĩa "huỷ"
        });
        _albumPickerOverlayClickHandler = () => {
            eventBus.send({ router: 'slideshowSettings', type: 'slideshowSettings.albumPicker.overlay.click', payload: {} });
        };
        genericDrawerOverlay.addEventListener('click', _albumPickerOverlayClickHandler);

        const gridEl = genericDrawerBody.querySelector('#slideshow-album-picker-grid');
        const emptyEl = genericDrawerBody.querySelector('#slideshow-album-picker-empty');
        renderSlideshowAlbumPickerGrid(gridEl, albums, activeAlbumId, imageRecordsByKey, async (albumId) => { // core/file-manager/photo-ui.js — GIỮ NGUYÊN, chỉ đổi nơi vẽ vào
            this._closeAlbumPickerDrawer();
            await this.setActiveAlbum(albumId);
            await this.refreshDrawerUI();
        });
        if (emptyEl) emptyEl.classList.toggle('hidden', albums.length > 0);
    },

    /** MỚI (Batch 9, mục 4) — ứng với bấm ra ngoài panel (overlay) mà KHÔNG chọn album nào. Nếu
     * lúc mở panel CHƯA có album active (vừa gạt "On" lần đầu) -> tự trả toggle về "off" (đúng cơ
     * chế đã thống nhất ở mục 1: huỷ picker = huỷ luôn hành động "bật"). Nếu ĐÃ có album từ trước
     * (đang đổi album, không phải bật mới) -> giữ nguyên mọi thứ, chỉ đóng panel. */
    /** Ứng với bấm ra ngoài Generic Drawer HOẶC nút X — huỷ, không chọn gì. Nếu vẫn chưa có album
     * active (lần đầu gạt "On" rồi huỷ ngang, hoặc đổi album nhưng huỷ) — tự gạt toggle về "off",
     * cùng hành vi cũ. */
    cancelAlbumPicker() {
        this._closeAlbumPickerDrawer();
        const enableToggle = slideshowSettingsPanelEl ? slideshowSettingsPanelEl.querySelector('#setting-slideshow-enable') : null;
        if (!appState.get('activeBackgroundAlbum') && enableToggle) {
            enableToggle.checked = false;
        }
    },

    /** MỚI (Giai đoạn 4, rewrite Photo/Album, mục 1) — đóng Generic Drawer picker Album, DÙNG CHUNG
     * cho mọi lối thoát (chọn xong/huỷ nút X/bấm ra ngoài). Gỡ `_albumPickerOverlayClickHandler` khỏi
     * `genericDrawerOverlay` TRƯỚC KHI đóng — element đó DÙNG CHUNG nhiều feature khác (menu action
     * ảnh, picker ảnh Photo & Album...), KHÔNG gỡ sẽ dính sang lần mở drawer TIẾP THEO của feature
     * khác, bắn nhầm `slideshowSettings.albumPicker.overlay.click` không liên quan gì. */
    _closeAlbumPickerDrawer() {
        if (_albumPickerOverlayClickHandler) {
            genericDrawerOverlay.removeEventListener('click', _albumPickerOverlayClickHandler);
            _albumPickerOverlayClickHandler = null;
        }
        closeGenericDrawer(); // core/generic-drawer.js
        genericDrawerPanel.addEventListener('transitionend', function onTransitionEnd() {
            genericDrawerPanel.removeEventListener('transitionend', onTransitionEnd);
            hideGenericDrawerImmediately(); // core/generic-drawer.js
        }, { once: true });
    },

    /** Ứng với select "Cách chọn ảnh kế tiếp" (sequential/random).
     * @param {string} mode
     */
    async changeMode(mode) {
        if (mode !== 'sequential' && mode !== 'random') return; // guard: giá trị lạ (không phải từ chính <select>) -> bỏ qua
        appConfigSlideshow.mutateAll((cfg) => { cfg.mode = mode; });
        console.log(`writer: "workflowSlideshow.changeMode", page: "slideshowConfig", content: "mode=${mode}"`);
        await setMeta('slideshowConfig', appConfigSlideshow.getAll());
    },

    /** SỬA (18/07/2026, phản hồi Giang — "setting chọn thời gian mở modal picker y như cách
     * subtitles làm") — THAY HẲN input số cũ (<input type="number">, đọc .value trực tiếp qua
     * changeInterval()) bằng modal "bánh xe cuộn số" DÙNG CHUNG (core/time-picker-modal.js).
     * `format: 's'` — CHỈ 1 cột giây, KHÔNG giới hạn modulo 60 (đơn vị THÔ NHẤT/DUY NHẤT trong
     * format), hiển thị thẳng giá trị thật 5-60 (đúng yêu cầu Giang: "hiển thị chỉ có mỗi s ví dụ
     * 5, 60, 120"). `minMs`/`maxMs` = 5000/60000 — KHỚP ĐÚNG SLIDESHOW_KENBURNS_MIN_TIME_MS/
     * MAX_TIME_MS (core/file-manager/slideshow.js) — 2 nơi PHẢI khớp nhau (Ken Burns time-scaling
     * tính theo ĐÚNG biên interval này).
     * Xác nhận -> persist + reschedule task (GIỮ NGUYÊN logic cũ của changeInterval(), chỉ đổi
     * NƠI giá trị `seconds` đến từ đâu — trước đọc thẳng input.value, giờ từ callback modal). */
    /** Ứng với nút "Thời gian mỗi ảnh" — mở modal chọn thời gian DÙNG CHUNG (core/time-picker-
     * modal.js), format 's', min 5s/max 60s.
     * SỬA (18/07/2026, phản hồi Giang — phát hiện bug: "chỉnh Seconds per photo xuống THẤP HƠN
     * transition đã đặt trước đó -> ô transition vẫn hiện giá trị CŨ, không tự hạ theo") — sau khi
     * persist `intervalSeconds` mới, TỰ KIỂM TRA + KẸP `transitionDurationMs` XUỐNG nếu đang VƯỢT
     * interval mới — tái dùng NGUYÊN `capSlideshowTransitionDurationMs()` (core, Math.min thuần) đã
     * có sẵn cho runtime, KHÔNG viết lại logic (Rule 3c — không trùng lặp core đã tồn tại). CHỈ
     * kẹp XUỐNG (không bao giờ đẩy LÊN) — tăng interval lại KHÔNG tự phục hồi transition về giá
     * trị cũ (không có "giá trị đúng" nào để phục hồi về, người dùng tự chỉnh lại nếu muốn dài hơn).
     * KHÔNG cần `event/virtual-machine-state.js` — đây là 1 luồng ĐƠN TUYẾN (interval đổi -> LUÔN
     * kiểm tra transition), không phải rẽ nhánh chọn giữa ≥2 workflow khác nhau tuỳ state (đúng
     * phạm vi VirtualMachineState) — nằm gọn trong 1 callback Workflow, đủ đơn giản không cần thêm
     * tầng nào khác. */
    openIntervalPicker() {
        if (!slideshowSettingsPanelEl) return;
        const cfg = appConfigSlideshow.getAll();
        openTimePickerModal({ // core/time-picker-modal.js
            title: t('slideshowSettingsDrawer.interval.pickerTitle'),
            format: 's',
            valueMs: cfg.intervalSeconds * 1000,
            minMs: 5000,
            maxMs: 60000,
            onConfirm: async (resultMs) => {
                const v = Math.max(5, Math.round(resultMs / 1000));
                const newIntervalMs = v * 1000;
                let correctedTransitionMs = null; // MỚI — null = không cần sửa gì, có giá trị = ĐÃ bị kẹp xuống
                appConfigSlideshow.mutateAll((c) => {
                    c.intervalSeconds = v;
                    const cappedMs = capSlideshowTransitionDurationMs(c.transitionDurationMs, newIntervalMs); // core — tái dùng NGUYÊN hàm đã có
                    if (cappedMs !== c.transitionDurationMs) { c.transitionDurationMs = cappedMs; correctedTransitionMs = cappedMs; }
                });
                console.log(`writer: "workflowSlideshow.openIntervalPicker", page: "slideshowConfig", content: "intervalSeconds=${v}${correctedTransitionMs !== null ? `, transitionDurationMs tự kẹp xuống ${correctedTransitionMs}` : ''}"`);
                await setMeta('slideshowConfig', appConfigSlideshow.getAll());
                if (!slideshowSettingsPanelEl) return;
                const intervalBtn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-interval');
                if (intervalBtn) intervalBtn.textContent = `${v}s`; // đồng bộ lại chữ trên nút
                // MỚI — nếu transitionDurationMs vừa bị kẹp xuống, đồng bộ LẠI nút + nhãn tỉ lệ
                // (phụ thuộc transitionDurationMs) — KHÔNG thì 2 chỗ này hiện SAI (giá trị cũ đã
                // không còn đúng nữa, đúng bug Giang phát hiện).
                if (correctedTransitionMs !== null) {
                    const transitionBtn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-duration');
                    if (transitionBtn) transitionBtn.textContent = `${(correctedTransitionMs / 1000).toFixed(1)}s`;
                    const ratioSlider = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-ratio');
                    this._updateTransitionRatioLabel(slideshowSettingsPanelEl, ratioSlider ? Number(ratioSlider.value) : appConfigSlideshow.getAll().transitionInOutRatio);
                }
                // Loop (task-manager.js) KHÔNG hỗ trợ đổi `time` giữa chừng của task count vô hạn —
                // tự kill + addNew lại với time mới, CÙNG lý do scheduleNextAutoSwitchVisualTimer()
                // làm ở core/auto-switch-visual.js.
                if (appState.get('activeBackgroundAlbum') && taskManager.plan[SLIDESHOW_TASK]) {
                    taskManager.kill(SLIDESHOW_TASK);
                    taskManager.addNew(SLIDESHOW_TASK, { time: this._computeIntervalMs(), exe: () => this._tick(), mode: 'timeout', count: 0 });
                    taskManager.operator(SLIDESHOW_TASK, 'enabled');
                }
            },
        });
    },

    /** Ứng với select "Hiệu ứng chuyển cảnh" (12 kiểu — Ken Burns ĐÃ TÁCH khỏi danh sách này, xem
     * changeKenBurnsEnabled() ngay dưới).
     * @param {string} type
     */
    /** Ứng với select "Hiệu ứng chuyển cảnh" (12 kiểu — Ken Burns ĐÃ TÁCH khỏi danh sách này, xem
     * changeKenBurnsEnabled() ngay dưới).
     * SỬA (18/07/2026, phản hồi Giang — mục "thêm thời gian transition") — thêm ẩn/hiện hàng
     * "Tỉ lệ In/Out" NGAY khi đổi kiểu (KHÔNG chờ mở lại panel) — CÙNG KHUÔN
     * `changeKenBurnsEnabled()` tự toggle `#slideshow-kenburns-mode-row` ngay trong hàm, không gọi
     * cả `refreshDrawerUI()` cho 1 thay đổi nhỏ.
     * @param {string} type
     */
    async changeTransitionType(type) {
        if (!SLIDESHOW_TRANSITION_TYPES.includes(type)) return; // guard: giá trị lạ -> bỏ qua
        appConfigSlideshow.mutateAll((cfg) => { cfg.transitionType = type; });
        console.log(`writer: "workflowSlideshow.changeTransitionType", page: "slideshowConfig", content: "transitionType=${type}"`);
        await setMeta('slideshowConfig', appConfigSlideshow.getAll());
        setSlideshowTransitionType(slideshowContainer, type); // core — áp ngay cho lần chuyển cảnh kế tiếp
        if (slideshowSettingsPanelEl) {
            const ratioRow = slideshowSettingsPanelEl.querySelector('#slideshow-transition-ratio-row');
            if (ratioRow) ratioRow.classList.toggle('hidden', !transitionSupportsInOutRatio(type)); // core
        }
    },

    /** MỚI (18/07/2026, phản hồi Giang — "thêm thời gian transition giữa 2 ảnh") — ứng với nút
     * "Thời gian chuyển cảnh" — mở modal chọn thời gian DÙNG CHUNG (core/time-picker-modal.js).
     * `format: 's-ms'` (giây + phần mười giây — giữ độ chính xác dưới giây). Min 1s (Giang chốt,
     * SLIDESHOW_TRANSITION_MIN_TIME_MS, core).
     * SỬA (18/07/2026, phản hồi Giang — phát hiện bug: "phải bị max theo seconds chứ, không thể
     * quay hơn, nhưng hiện tại có thể chọn lớn hơn") — Max KHÔNG còn cố định 60s nữa: transition
     * KHÔNG BAO GIỜ nên dài hơn chính thời gian ảnh sẽ hiển thị (nếu không, y hệt bug "chuyển cảnh
     * bị cắt ngang lượt kế tiếp" đã lường trước — capSlideshowTransitionDurationMs() ở `_tick()`
     * VẪN giữ làm lưới an toàn RUNTIME, nhưng để tránh cho phép CHỌN 1 giá trị vô nghĩa ngay từ đầu,
     * modal picker giờ tự kẹp Max = MIN(60s, thời gian ảnh hiển thị hiện tại —
     * `_computeImageDisplayDurationMs()`, ĐÚNG cho cả 2 chế độ thường/photoPerSong).
     * SỬA LẦN 2 (21/07/2026, Giang chốt: "max input transition phải LUÔN nhỏ hơn seconds per photo
     * tối thiểu 1 đơn vị giây" — vd interval=5s thì max=4s, KHÔNG được bằng nhau) — trừ thêm 1000ms
     * khỏi `_computeImageDisplayDurationMs()` TRƯỚC khi kẹp [MIN,MAX] — CÙNG công thức
     * `capSlideshowTransitionDurationMs()` (core, dùng lại y hệt logic, không viết trùng — Rule 3c).
     * Kẹp thêm 1 lớp an toàn `Math.max(MIN_TIME_MS, ...)` phòng trường hợp hiếm ảnh hiển thị CÒN LẠI
     * dưới 2s (photoPerSong, bài hát sắp hết) khiến max tính ra nhỏ hơn cả min — tránh modal nhận
     * biên [min,max] đảo ngược.
     * Xác nhận -> persist + đồng bộ nhãn nút + đồng bộ LẠI nhãn "Tỉ lệ In/Out" (phụ thuộc TỔNG
     * thời gian vừa đổi, xem `_updateTransitionRatioLabel()`). */
    openTransitionDurationPicker() {
        if (!slideshowSettingsPanelEl) return;
        const cfg = appConfigSlideshow.getAll();
        const maxMs = Math.max(SLIDESHOW_TRANSITION_MIN_TIME_MS, Math.min(SLIDESHOW_TRANSITION_MAX_TIME_MS, this._computeImageDisplayDurationMs() - 1000));
        openTimePickerModal({ // core/time-picker-modal.js
            title: t('slideshowSettingsDrawer.transitionDuration.pickerTitle'),
            format: 's-ms',
            valueMs: Math.min(cfg.transitionDurationMs, maxMs), // kẹp vị trí cuộn ban đầu luôn, tránh mở lên vượt max mới
            minMs: SLIDESHOW_TRANSITION_MIN_TIME_MS, // core
            maxMs, // ĐỘNG theo thời gian ảnh hiển thị hiện tại — KHÔNG còn cố định 60s
            onConfirm: async (resultMs) => {
                const v = Math.max(SLIDESHOW_TRANSITION_MIN_TIME_MS, Math.min(maxMs, resultMs));
                appConfigSlideshow.mutateAll((c) => { c.transitionDurationMs = v; });
                console.log(`writer: "workflowSlideshow.openTransitionDurationPicker", page: "slideshowConfig", content: "transitionDurationMs=${v}"`);
                await setMeta('slideshowConfig', appConfigSlideshow.getAll());
                if (!slideshowSettingsPanelEl) return;
                const btn = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-duration');
                if (btn) btn.textContent = `${(v / 1000).toFixed(1)}s`;
                const ratioSlider = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition-ratio');
                this._updateTransitionRatioLabel(slideshowSettingsPanelEl, ratioSlider ? Number(ratioSlider.value) : v);
            },
        });
    },

    /** Cập nhật nhãn "In Xs / Out Ys" hiển thị cạnh slider Tỉ lệ In/Out — đọc `transitionDurationMs`
     * hiện tại từ appState + `ratioPercent` truyền vào (KHÔNG đọc lại từ DOM slider — nơi gọi tự
     * quyết định dùng giá trị nào, xem 2 nơi gọi hàm này).
     * @param {HTMLElement} panelEl
     * @param {number} ratioPercent
     */
    _updateTransitionRatioLabel(panelEl, ratioPercent) {
        const labelEl = panelEl ? panelEl.querySelector('#slideshow-transition-ratio-label') : null;
        if (!labelEl) return;
        const cfg = appConfigSlideshow.getAll();
        const { inMs, outMs } = computeSlideshowTransitionInOutMs(cfg.transitionDurationMs, ratioPercent); // core
        labelEl.textContent = tFormat('slideshowSettingsDrawer.transitionRatio.previewFormat', { in: (inMs / 1000).toFixed(1), out: (outMs / 1000).toFixed(1) });
    },

    /** Ứng với sự kiện 'input' (LIVE, đang kéo thả) trên slider Tỉ lệ In/Out — CHỈ cập nhật nhãn
     * hiển thị ngay lúc kéo, KHÔNG persist (persist thật ở `changeTransitionRatio()`, bắn lúc
     * 'change' — thả tay ra mới lưu, tránh ghi IndexedDB liên tục mỗi pixel kéo).
     * @param {number} ratioPercent
     */
    previewTransitionRatio(ratioPercent) {
        if (!slideshowSettingsPanelEl) return;
        this._updateTransitionRatioLabel(slideshowSettingsPanelEl, ratioPercent);
    },

    /** Ứng với sự kiện 'change' (thả tay) trên slider Tỉ lệ In/Out — persist + đồng bộ nhãn (khớp
     * giá trị đã kẹp, nếu có).
     * @param {number} ratioPercent
     */
    async changeTransitionRatio(ratioPercent) {
        const v = Math.max(0, Math.min(100, ratioPercent));
        appConfigSlideshow.mutateAll((cfg) => { cfg.transitionInOutRatio = v; });
        console.log(`writer: "workflowSlideshow.changeTransitionRatio", page: "slideshowConfig", content: "transitionInOutRatio=${v}"`);
        await setMeta('slideshowConfig', appConfigSlideshow.getAll());
        if (slideshowSettingsPanelEl) this._updateTransitionRatioLabel(slideshowSettingsPanelEl, v);
    },

    /** Ứng với select "Easing" — 5 giá trị hợp lệ (SLIDESHOW_TRANSITION_EASINGS, core) — 'linear'
     * = Giang gọi "không easing" (tốc độ đều tăm tắp).
     * @param {string} easing
     */
    async changeTransitionEasing(easing) {
        if (!SLIDESHOW_TRANSITION_EASINGS.includes(easing)) return; // guard: giá trị lạ -> bỏ qua
        appConfigSlideshow.mutateAll((cfg) => { cfg.transitionEasing = easing; });
        console.log(`writer: "workflowSlideshow.changeTransitionEasing", page: "slideshowConfig", content: "transitionEasing=${easing}"`);
        await setMeta('slideshowConfig', appConfigSlideshow.getAll());
    },

    /** MỚI (Ken Burns, 18/07/2026, phản hồi Giang) — ứng với toggle "Ken Burns" (ĐỘC LẬP với
     * transitionType, dùng ĐƯỢC cùng lúc với BẤT KỲ kiểu transition nào). CHỈ persist + đồng bộ
     * state — KHÔNG ép reset/dừng ảnh đang hiện hoạt (Giang chốt: bật/tắt áp dụng từ ẢNH KẾ TIẾP,
     * đúng tiền lệ `changeMode()`/`changeTransitionType()` — không đặc cách riêng cho Ken Burns).
     * Cơ chế tick tự nhiên (`_showFirstImage()`/`_tick()`) tự đọc lại field này mỗi lượt đổi ảnh —
     * TẮT giữa chừng: ảnh đang chạy cứ hiện hết BÌNH THƯỜNG (WAAPI tự giữ trạng thái cuối qua
     * `fill:'forwards'`, không cần task freeze nào cả — xem docstring core), layer outgoing ở lượt
     * `_tick()` kế tiếp tự gọi `stopSlideshowKenBurnsAnimation(outgoingPan, ...)` (code cleanup có
     * sẵn) → tự về gốc, không cần xử lý gì thêm ở đây.
     * SỬA ("Nhóm 2", 18/07/2026) — thêm ẩn/hiện hàng <select> chế độ, CÙNG KHUÔN
     * `changePhotoPerSong()` tự toggle `#slideshow-interval-row` ngay trong hàm (không gọi cả
     * `refreshDrawerUI()` cho 1 thay đổi nhỏ).
     * @param {boolean} checked
     */
    async changeKenBurnsEnabled(checked) {
        appConfigSlideshow.mutateAll((cfg) => { cfg.kenBurnsEnabled = checked; });
        console.log(`writer: "workflowSlideshow.changeKenBurnsEnabled", page: "slideshowConfig", content: "kenBurnsEnabled=${checked}"`);
        await setMeta('slideshowConfig', appConfigSlideshow.getAll());
        if (slideshowSettingsPanelEl) {
            const kenBurnsModeRow = slideshowSettingsPanelEl.querySelector('#slideshow-kenburns-mode-row');
            if (kenBurnsModeRow) kenBurnsModeRow.classList.toggle('hidden', !checked);
        }
    },

    /** MỚI ("Nhóm 2", 18/07/2026, phản hồi Giang) — ứng với <select> "Kiểu Ken Burns" (13 chế độ,
     * THAY HẲN "Nhóm 1" — 8 biến thể random tự động, không chọn được). CHỈ persist — cơ chế tick
     * tự nhiên tự đọc lại field này mỗi lượt kích hoạt Ken Burns (`_activateKenBurns()`), áp dụng
     * từ ẢNH KẾ TIẾP như mọi field khác trong slideshowConfig.
     * @param {string} mode - 1 trong SLIDESHOW_KENBURNS_MODES.
     */
    async changeKenBurnsMode(mode) {
        if (!SLIDESHOW_KENBURNS_MODES.includes(mode)) return; // guard: giá trị lạ -> bỏ qua
        appConfigSlideshow.mutateAll((cfg) => { cfg.kenBurnsMode = mode; });
        console.log(`writer: "workflowSlideshow.changeKenBurnsMode", page: "slideshowConfig", content: "kenBurnsMode=${mode}"`);
        await setMeta('slideshowConfig', appConfigSlideshow.getAll());
    },
};
