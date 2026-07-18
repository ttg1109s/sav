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
 * PAUSE/RESUME theo `vizConfig.videoBgEnabled` — VIẾT LẠI (04/07/2026, mục 2 phản hồi Giang, BỎ
 * watchdog poll 3s/lần): trước đây `_tick()` tự đọc `videoBgEnabled` MỖI LẦN CHẠY + có 1 task
 * "canh chừng" riêng (`_startWatchdog()`) đọc mỗi 3s để tự resume — Giang chỉ ra ĐÚNG: đã có sẵn
 * sự kiện click bật/tắt video (`event/workflow/visualizer-control-center.js`) để biết CHÍNH XÁC
 * lúc nào cần pause/resume, poll lại appState mỗi 3s là THỪA. Giờ `pauseForVideoBg()`/
 * `resumeFromVideoBg()` được GỌI TRỰC TIẾP từ đúng lúc video bật/tắt thành công (event-driven,
 * KHÔNG còn polling nào cả). KHÔNG đụng `enableVideoBackground()`/`disableVideoBackgroundState()`/
 * `applyUploadedVideoBg()` (code DI SẢN đã có nợ Rule 3 sẵn — cùng lý do đã ghi ở
 * core/state-and-video-bg.js, KHÔNG thêm lời gọi void mới vào các hàm đó).
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
 * NẠP SAU: core/file-manager/slideshow.js (SLIDESHOW_TRANSITION_TYPES, SLIDESHOW_TRANSITION_DURATION_MS,
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
        return Math.max(5, appState.get('slideshowConfig').intervalSeconds) * 1000;
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
            appState.mutate('slideshowConfig', (cfg) => {
                if (savedConfig.mode === 'sequential' || savedConfig.mode === 'random') cfg.mode = savedConfig.mode;
                if (typeof savedConfig.intervalSeconds === 'number' && savedConfig.intervalSeconds >= 5) cfg.intervalSeconds = savedConfig.intervalSeconds;
                if (SLIDESHOW_TRANSITION_TYPES.includes(savedConfig.transitionType)) cfg.transitionType = savedConfig.transitionType;
                if (typeof savedConfig.photoPerSong === 'boolean') cfg.photoPerSong = savedConfig.photoPerSong;
                if (typeof savedConfig.kenBurnsEnabled === 'boolean') cfg.kenBurnsEnabled = savedConfig.kenBurnsEnabled;
                if (SLIDESHOW_KENBURNS_MODES.includes(savedConfig.kenBurnsMode)) cfg.kenBurnsMode = savedConfig.kenBurnsMode;
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
        setSlideshowContainerVisible(slideshowContainer, true); // core
        this._showFirstImage();
        if (appState.get('slideshowConfig').photoPerSong) {
            this._startSongWatcher();
        } else {
            taskManager.kill(SLIDESHOW_TASK);
            taskManager.addNew(SLIDESHOW_TASK, { time: this._computeIntervalMs(), exe: () => this._tick(), mode: 'timeout', count: 0 });
            taskManager.operator(SLIDESHOW_TASK, 'enabled');
        }
    },

    /** Dừng hẳn engine — dọn task + ẩn container + revoke object URL.
     * VIẾT LẠI (04/07/2026, mục 3 — Rule 3 siết chặt): core không còn hàm gộp
     * `resetSlideshowLayers()` (từng tự gọi 2 hàm core khác bên trong, nay cấm) — Workflow tự lặp
     * qua 2 layer, tự gọi TỪNG hàm core cần thiết theo đúng thứ tự.
     * SỬA (Ken Burns WAAPI, 18/07/2026) — `setSlideshowLayerImage()`/`stopSlideshowKenBurnsAnimation()`
     * giờ nhận layer CON (Pan), `resetSlideshowLayerClasses()` vẫn nhận layer NGOÀI như cũ (2 việc
     * khác phần tử — xem docstring đầu file). Task `slideshowKenBurnsFreeze1`/`2` KHÔNG CÒN TỒN TẠI
     * (kỹ thuật CSS cũ cần tự "đóng băng" bằng tay — WAAPI `fill:'forwards'` tự làm việc đó, xem
     * docstring `startSlideshowKenBurnsAnimation()` core) — bỏ luôn 2 dòng `taskManager.kill()` đó. */
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
        const cfg = appState.get('slideshowConfig');
        setSlideshowTransitionType(slideshowContainer, cfg.transitionType); // core
        if (cfg.kenBurnsEnabled) this._activateKenBurns(panEl, cfg.kenBurnsMode, image);
    },

    /**
     * MỚI (04/07/2026, mục 3 phản hồi Giang — Rule 3 siết chặt): Workflow (KHÔNG phải core) tự
     * chọn direction/tính bounds rồi gọi core tạo Animation — giữ đúng Rule 2 (core nhận mọi thứ
     * qua tham số, không tự đọc appState/window).
     * SỬA (Ken Burns, 18/07/2026) — nhận layer CON (Pan), KHÔNG phải layer ngoài (xem docstring
     * đầu file) — so sánh nhận diện layer 1/2 cũng đổi theo (`slideshowLayer1Pan` thay vì
     * `slideshowLayer1`).
     * VIẾT LẠI LẦN 2 ("Nhóm 2" — BẢN ĐÚNG, Web Animations API, 18/07/2026, phản hồi Giang) —
     * KHÔNG còn chọn class CSS nữa. Giờ: (1) resolve `mode` -> direction cụ thể (core), (2) tính
     * biên an toàn TỪ WIDTH/HEIGHT THẬT của ĐÚNG ảnh sắp chiếu (`image.width`/`image.height`, core)
     * — PHẢI nhận `image` qua tham số (KHÔNG đọc `this._images[this._currentIndex]` ở đây — lúc
     * gọi hàm này trong `_tick()`, `this._currentIndex` VẪN LÀ ảnh CŨ, chưa kịp cập nhật thành
     * `nextIndex` — đọc nhầm ảnh sẽ tính sai biên), (3) tính keyframe ngẫu nhiên (core), (4) tạo
     * Animation qua `panEl.animate()` (core) + TỰ GIỮ lại animation đó (`_setKenBurnsAnim()`) để
     * `.cancel()` đúng lúc sau này — KHÔNG còn `taskManager.once()` lịch "đóng băng" thủ công nữa
     * (WAAPI `fill:'forwards'` tự làm việc đó, xem docstring `startSlideshowKenBurnsAnimation()`
     * core — đơn giản hoá được đáng kể so với bản CSS cũ).
     * @param {HTMLElement} panEl - layer CON `.ss-kenburns-pan`.
     * @param {string} mode - 1 trong SLIDESHOW_KENBURNS_MODES (cfg.kenBurnsMode).
     * @param {{width?: number, height?: number}} image - ẢNH SẮP chiếu lên panEl (record đầy đủ,
     *   `width`/`height` là kích thước ẢNH GỐC — có thể thiếu ở record cũ, core tự fallback an toàn).
     */
    _activateKenBurns(panEl, mode, image) {
        const direction = resolveSlideshowKenBurnsDirection(mode); // core
        const bounds = computeSlideshowKenBurnsSafeBounds(image ? image.width : 0, image ? image.height : 0, window.innerWidth, window.innerHeight); // core
        const keyframes = pickSlideshowKenBurnsKeyframes(direction, bounds); // core
        const durationMs = this._computeIntervalMs();
        const anim = startSlideshowKenBurnsAnimation(panEl, keyframes, durationMs); // core
        this._setKenBurnsAnim(panEl, anim);
    },

    /** taskManager exe — đóng vai trò "Router" cho tick tự sinh (xem comment đầu file): tự đọc
     * appState rồi gọi hàm THUẦN ở core/file-manager/slideshow.js.
     * ĐƠN GIẢN HOÁ (04/07/2026, mục 2 phản hồi Giang) — bỏ hẳn check `videoBgEnabled` + pause() ở
     * đây: watchdog poll 3s/lần đã XOÁ (xem lý do ở `pauseForVideoBg()`/`resumeFromVideoBg()`
     * dưới) — task này giờ CHỈ chạy khi thật sự KHÔNG bị pause từ bên ngoài, không cần tự kiểm tra
     * lại nữa.
     * SỬA (Ken Burns, 18/07/2026) — background-image/Ken Burns thao tác lên layer CON
     * (`outgoingPan`/`incomingPan`), transition chuyển cảnh (class ss-layer-enter/exit) vẫn thao
     * tác lên layer NGOÀI (`outgoingLayer`/`incomingLayer`) như cũ. Điều kiện Ken Burns đổi sang
     * `cfg.kenBurnsEnabled` — ĐỘC LẬP với `cfg.transitionType`, nên chạy được cùng lúc với BẤT KỲ
     * kiểu transition nào (khác trước: 'kenburns' khoá cứng transition về fade). */
    _tick() {
        if (this._images.length === 0) return; // album rỗng (ảnh vừa bị xoá hết) -> chờ, không lỗi

        const cfg = appState.get('slideshowConfig');
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

        // VIẾT LẠI (04/07/2026, mục 3 — Rule 3 siết chặt): trước đây gọi 1 hàm core duy nhất
        // (beginSlideshowTransition) TỰ taskManager.once() + TỰ gọi core khác bên trong — giờ CẤM.
        // Workflow tự làm cả 2 việc đó: gọi core "bắt đầu" NGAY, rồi TỰ taskManager.once() lịch
        // đúng lúc hết SLIDESHOW_TRANSITION_DURATION_MS để tự gọi TỪNG hàm core "kết thúc".
        startSlideshowTransitionVisuals(outgoingLayer, incomingLayer); // core — layer NGOÀI
        taskManager.once(() => {
            setSlideshowLayerImage(outgoingPan, ''); // core — layer CON
            stopSlideshowKenBurnsAnimation(outgoingPan, this._getKenBurnsAnim(outgoingPan)); // core — layer CON (Ken Burns WAAPI)
            this._setKenBurnsAnim(outgoingPan, null);
            finishSlideshowTransitionVisuals(outgoingLayer, incomingLayer); // core — layer NGOÀI
        }, SLIDESHOW_TRANSITION_DURATION_MS, 'slideshowTransitionCleanup');

        if (this._currentObjectUrl) {
            const staleUrl = this._currentObjectUrl;
            taskManager.once(() => { try { URL.revokeObjectURL(staleUrl); } catch (e) {} }, SLIDESHOW_TRANSITION_DURATION_MS + 100, 'slideshowRevokeStale');
        }
        this._currentObjectUrl = objectUrl;
        this._currentIndex = nextIndex;
        this._layerToggle = !this._layerToggle;
    },

    /**
     * MỚI (04/07/2026, mục 2 phản hồi Giang) — GỌI TRỰC TIẾP từ
     * `workflowVisualizerControlCenter` NGAY LÚC video nền BẬT thành công (KHÔNG còn watchdog
     * poll 3s/lần — Giang chỉ ra ĐÚNG: đã có sẵn sự kiện click bật/tắt video để biết, poll lại
     * appState mỗi 3s là thừa).
     */
    pauseForVideoBg() {
        taskManager.pause(SLIDESHOW_TASK);
        taskManager.pause(SLIDESHOW_SONG_WATCH_TASK);
    },

    /** MỚI (04/07/2026, mục 2) — GỌI TRỰC TIẾP từ `workflowVisualizerControlCenter` NGAY LÚC
     * video nền TẮT thành công. */
    resumeFromVideoBg() {
        if (!appState.get('activeBackgroundAlbum')) return; // không có slideshow nào đang chạy -> không có gì để resume
        if (taskManager.plan[SLIDESHOW_TASK]) taskManager.resume(SLIDESHOW_TASK); // no-op an toàn nếu không tồn tại/không paused
        if (taskManager.plan[SLIDESHOW_SONG_WATCH_TASK]) taskManager.resume(SLIDESHOW_SONG_WATCH_TASK);
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
        const cfg = appState.get('slideshowConfig');

        const enableToggle = slideshowSettingsPanelEl.querySelector('#setting-slideshow-enable');
        const modeSelect = slideshowSettingsPanelEl.querySelector('#setting-slideshow-mode');
        const photoPerSongToggle = slideshowSettingsPanelEl.querySelector('#setting-slideshow-photo-per-song');
        const intervalRow = slideshowSettingsPanelEl.querySelector('#slideshow-interval-row');
        const intervalInput = slideshowSettingsPanelEl.querySelector('#setting-slideshow-interval');
        const transitionSelect = slideshowSettingsPanelEl.querySelector('#setting-slideshow-transition');
        const kenBurnsToggle = slideshowSettingsPanelEl.querySelector('#setting-slideshow-kenburns');
        const kenBurnsModeRow = slideshowSettingsPanelEl.querySelector('#slideshow-kenburns-mode-row');
        const kenBurnsModeSelect = slideshowSettingsPanelEl.querySelector('#setting-slideshow-kenburns-mode');

        if (enableToggle) enableToggle.checked = !!albumId;
        if (modeSelect) modeSelect.value = cfg.mode;
        // MỚI (04/07/2026, mục 5) — đồng bộ toggle "Photo per song" + ẩn hàng "Thời gian mỗi ảnh"
        // khi đang bật (không còn ý nghĩa gì lúc đó).
        if (photoPerSongToggle) photoPerSongToggle.checked = !!cfg.photoPerSong;
        if (intervalRow) intervalRow.classList.toggle('hidden', !!cfg.photoPerSong);
        if (intervalInput) intervalInput.value = cfg.intervalSeconds;
        if (transitionSelect) transitionSelect.value = cfg.transitionType;
        // MỚI (Ken Burns, 18/07/2026) — đồng bộ toggle độc lập, KHÔNG còn nằm trong transitionSelect.
        if (kenBurnsToggle) kenBurnsToggle.checked = !!cfg.kenBurnsEnabled;
        // MỚI ("Nhóm 2", 18/07/2026) — đồng bộ <select> 13 chế độ + ẩn hàng khi Ken Burns đang tắt
        // (không còn ý nghĩa gì lúc đó — cùng khuôn intervalRow ẩn/hiện theo photoPerSong).
        if (kenBurnsModeRow) kenBurnsModeRow.classList.toggle('hidden', !cfg.kenBurnsEnabled);
        if (kenBurnsModeSelect) kenBurnsModeSelect.value = cfg.kenBurnsMode;
    },

    /** MỚI (04/07/2026, mục 5) — ứng với gạt "Photo per song". Persist + nếu engine đang chạy, khởi
     * động lại NGAY với cơ chế tick tương ứng (start() tự đọc lại `slideshowConfig.photoPerSong`
     * để quyết định dùng task đếm giờ hay task theo dõi bài hát — xem start()).
     * @param {boolean} checked
     */
    async changePhotoPerSong(checked) {
        appState.mutate('slideshowConfig', (cfg) => { cfg.photoPerSong = checked; });
        console.log(`writer: "workflowSlideshow.changePhotoPerSong", page: "slideshowConfig", content: "photoPerSong=${checked}"`);
        await setMeta('slideshowConfig', appState.get('slideshowConfig'));
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
        appState.mutate('slideshowConfig', (cfg) => { cfg.mode = mode; });
        console.log(`writer: "workflowSlideshow.changeMode", page: "slideshowConfig", content: "mode=${mode}"`);
        await setMeta('slideshowConfig', appState.get('slideshowConfig'));
    },

    /** Ứng với input "Thời gian mỗi ảnh (giây)" — kẹp tối thiểu 5s (đúng plan mục 4.b3).
     * @param {string|number} seconds
     */
    async changeInterval(seconds) {
        const v = Math.max(5, parseInt(seconds, 10) || 5);
        appState.mutate('slideshowConfig', (cfg) => { cfg.intervalSeconds = v; });
        console.log(`writer: "workflowSlideshow.changeInterval", page: "slideshowConfig", content: "intervalSeconds=${v}"`);
        await setMeta('slideshowConfig', appState.get('slideshowConfig'));
        if (slideshowSettingsPanelEl) {
            const intervalInput = slideshowSettingsPanelEl.querySelector('#setting-slideshow-interval');
            if (intervalInput) intervalInput.value = v; // đồng bộ lại nếu giá trị bị kẹp
        }
        // Loop (task-manager.js) KHÔNG hỗ trợ đổi `time` giữa chừng của task count vô hạn — tự
        // kill + addNew lại với time mới, CÙNG lý do scheduleNextAutoSwitchVisualTimer() làm ở
        // core/auto-switch-visual.js.
        if (appState.get('activeBackgroundAlbum') && taskManager.plan[SLIDESHOW_TASK]) {
            taskManager.kill(SLIDESHOW_TASK);
            taskManager.addNew(SLIDESHOW_TASK, { time: this._computeIntervalMs(), exe: () => this._tick(), mode: 'timeout', count: 0 });
            taskManager.operator(SLIDESHOW_TASK, 'enabled');
        }
    },

    /** Ứng với select "Hiệu ứng chuyển cảnh" (12 kiểu — Ken Burns ĐÃ TÁCH khỏi danh sách này, xem
     * changeKenBurnsEnabled() ngay dưới).
     * @param {string} type
     */
    async changeTransitionType(type) {
        if (!SLIDESHOW_TRANSITION_TYPES.includes(type)) return; // guard: giá trị lạ -> bỏ qua
        appState.mutate('slideshowConfig', (cfg) => { cfg.transitionType = type; });
        console.log(`writer: "workflowSlideshow.changeTransitionType", page: "slideshowConfig", content: "transitionType=${type}"`);
        await setMeta('slideshowConfig', appState.get('slideshowConfig'));
        setSlideshowTransitionType(slideshowContainer, type); // core — áp ngay cho lần chuyển cảnh kế tiếp
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
        appState.mutate('slideshowConfig', (cfg) => { cfg.kenBurnsEnabled = checked; });
        console.log(`writer: "workflowSlideshow.changeKenBurnsEnabled", page: "slideshowConfig", content: "kenBurnsEnabled=${checked}"`);
        await setMeta('slideshowConfig', appState.get('slideshowConfig'));
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
        appState.mutate('slideshowConfig', (cfg) => { cfg.kenBurnsMode = mode; });
        console.log(`writer: "workflowSlideshow.changeKenBurnsMode", page: "slideshowConfig", content: "kenBurnsMode=${mode}"`);
        await setMeta('slideshowConfig', appState.get('slideshowConfig'));
    },
};
