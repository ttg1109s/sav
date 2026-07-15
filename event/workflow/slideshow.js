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
 * finishSlideshowTransitionVisuals, resetSlideshowLayerClasses, applySlideshowKenBurns,
 * freezeSlideshowKenBurnsEndState, pickRandomSlideshowKenBurnsVariant),
 * core/file-manager/album.js (getAlbumRecord/listAlbums — qua service/db.js), core/file-manager/image.js
 * (getImageRecord), core/file-manager/photo-ui.js (renderSlideshowAlbumPickerGrid), service/db.js
 * (getMeta/setMeta), core/dom-refs.js (slideshowContainer/slideshowLayer1/slideshowLayer2/
 * slideshowAlbumPicker.../bgCaptionFrame — panel chọn Album + caption VẪN tĩnh, xem Batch D4 dưới),
 * core/settings-panel-stack.js (pushSettingsPanel), components/slideshow-settings-drawer.js
 * (renderSlideshowPanelBody), service/task-manager.js (taskManager — CHỈ Workflow này dùng, core
 * không còn dùng kể từ 04/07/2026), service/state.js (appState).
 * NẠP TRƯỚC: event/router/slideshow.js, event/workflow/file-manager-photo.js (gọi
 * `workflowSlideshow.clearActiveAlbum()` trong cascade xoá album).
 *
 * === Batch D4 (Settings restructure, 06/07/2026) ===
 * Panel Settings (6 input enable/mode/photoPerSong/interval/transition/showCaption) giờ PUSH/POP
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
 * `TPL_SLIDESHOW_ALBUM_PICKER` (panel chọn Album kiểu "notify center") VẪN TĨNH, KHÔNG di chuyển
 * — đây là 1 overlay ĐỘC LẬP với Settings Stack (ngang hàng kiến trúc, giống Modal Subtitle Giang
 * đã chỉ ra), không phải 1 tầng lồng trong ngăn xếp — `slideshowAlbumPicker*` dom-refs GIỮ NGUYÊN.
 */
let slideshowSettingsPanelEl = null; // panel Settings Slideshow đang mở — null nếu đang đóng (Batch D4)

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
     * DOMContentLoaded (core/visualizer/draw-visualizer.js), SAU loadConfig(). */
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
                if (typeof savedConfig.showCaption === 'boolean') cfg.showCaption = savedConfig.showCaption;
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
        this._refreshCaptionVisibility(); // core/UI — mục 2: hiện khung caption ngay nếu đang bật + có caption
    },

    /** Dừng hẳn engine — dọn task + ẩn container + revoke object URL.
     * VIẾT LẠI (04/07/2026, mục 3 — Rule 3 siết chặt): core không còn hàm gộp
     * `resetSlideshowLayers()` (từng tự gọi 2 hàm core khác bên trong, nay cấm) — Workflow tự lặp
     * qua 2 layer, tự gọi TỪNG hàm core cần thiết theo đúng thứ tự. */
    stop() {
        taskManager.kill(SLIDESHOW_TASK);
        taskManager.kill(SLIDESHOW_SONG_WATCH_TASK);
        taskManager.kill('slideshowKenBurnsFreeze1');
        taskManager.kill('slideshowKenBurnsFreeze2');
        setSlideshowContainerVisible(slideshowContainer, false); // core
        setBgCaptionVisible(bgCaptionFrame, false); // core — mục 2
        [slideshowLayer1, slideshowLayer2].forEach((layerEl) => {
            setSlideshowLayerImage(layerEl, ''); // core
            applySlideshowKenBurns(layerEl, false, 0); // core
            resetSlideshowLayerClasses(layerEl); // core
        });
        if (this._currentObjectUrl) { try { URL.revokeObjectURL(this._currentObjectUrl); } catch (e) {} this._currentObjectUrl = null; }
        this._currentIndex = -1;
    },

    /** Hiện ảnh ĐẦU TIÊN ngay lập tức lúc start() (KHÔNG chuyển cảnh — chỉ set thẳng lên layer
     * "current"), thay vì để màn hình trống chờ hết interval đầu tiên mới thấy gì. */
    _showFirstImage() {
        const image = this._images[0];
        if (!image) return;
        const objectUrl = URL.createObjectURL(image.blob);
        this._currentObjectUrl = objectUrl;
        this._currentIndex = 0;
        const layerEl = this._currentLayer();
        setSlideshowLayerImage(layerEl, objectUrl); // core
        if (layerEl) layerEl.classList.add('ss-current');
        const cfg = appState.get('slideshowConfig');
        setSlideshowTransitionType(slideshowContainer, cfg.transitionType); // core
        if (cfg.transitionType === 'kenburns') this._activateKenBurns(layerEl);
    },

    /**
     * MỚI (04/07/2026, mục 3 phản hồi Giang — Rule 3 siết chặt) + fix mục 6 (Ken Burns "nhảy về xy
     * gốc" lúc kết thúc animation): Workflow (KHÔNG phải core) tự chọn variant + tự
     * `taskManager.once()` lịch đúng lúc hết `durationMs` để "đóng băng" trạng thái cuối bằng
     * inline style (freezeSlideshowKenBurnsEndState(), core/file-manager/slideshow.js) — KHÔNG
     * còn phó mặc hoàn toàn cho CSS `animation-fill-mode: forwards` (không đáng tin cậy 100% qua
     * mọi trình duyệt, xem comment hàm đó).
     * @param {HTMLElement} layerEl
     */
    _activateKenBurns(layerEl) {
        const variant = pickRandomSlideshowKenBurnsVariant(); // core
        const durationMs = this._computeIntervalMs();
        applySlideshowKenBurns(layerEl, true, durationMs, variant); // core
        taskManager.once(() => {
            freezeSlideshowKenBurnsEndState(layerEl, variant); // core
        }, durationMs, layerEl === slideshowLayer1 ? 'slideshowKenBurnsFreeze1' : 'slideshowKenBurnsFreeze2');
    },

    /** taskManager exe — đóng vai trò "Router" cho tick tự sinh (xem comment đầu file): tự đọc
     * appState rồi gọi hàm THUẦN ở core/file-manager/slideshow.js.
     * ĐƠN GIẢN HOÁ (04/07/2026, mục 2 phản hồi Giang) — bỏ hẳn check `videoBgEnabled` + pause() ở
     * đây: watchdog poll 3s/lần đã XOÁ (xem lý do ở `pauseForVideoBg()`/`resumeFromVideoBg()`
     * dưới) — task này giờ CHỈ chạy khi thật sự KHÔNG bị pause từ bên ngoài, không cần tự kiểm tra
     * lại nữa. */
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

        setSlideshowTransitionType(slideshowContainer, cfg.transitionType); // core
        setSlideshowLayerImage(incomingLayer, objectUrl); // core
        if (cfg.transitionType === 'kenburns') this._activateKenBurns(incomingLayer);

        // VIẾT LẠI (04/07/2026, mục 3 — Rule 3 siết chặt): trước đây gọi 1 hàm core duy nhất
        // (beginSlideshowTransition) TỰ taskManager.once() + TỰ gọi core khác bên trong — giờ CẤM.
        // Workflow tự làm cả 2 việc đó: gọi core "bắt đầu" NGAY, rồi TỰ taskManager.once() lịch
        // đúng lúc hết SLIDESHOW_TRANSITION_DURATION_MS để tự gọi TỪNG hàm core "kết thúc".
        startSlideshowTransitionVisuals(outgoingLayer, incomingLayer); // core
        taskManager.once(() => {
            setSlideshowLayerImage(outgoingLayer, ''); // core
            applySlideshowKenBurns(outgoingLayer, false, 0); // core
            finishSlideshowTransitionVisuals(outgoingLayer, incomingLayer); // core
        }, SLIDESHOW_TRANSITION_DURATION_MS, 'slideshowTransitionCleanup');

        if (this._currentObjectUrl) {
            const staleUrl = this._currentObjectUrl;
            taskManager.once(() => { try { URL.revokeObjectURL(staleUrl); } catch (e) {} }, SLIDESHOW_TRANSITION_DURATION_MS + 100, 'slideshowRevokeStale');
        }
        this._currentObjectUrl = objectUrl;
        this._currentIndex = nextIndex;
        this._layerToggle = !this._layerToggle;
        this._refreshCaptionVisibility(); // core/UI — mục 2: đổi ảnh -> đổi luôn caption tương ứng (nếu bật)
    },

    /** MỚI (04/07/2026, mục 2 phản hồi Giang) — hiện/ẩn + đổi nội dung khung caption theo ẢNH ĐANG
     * CHIẾU hiện tại, CHỈ khi `slideshowConfig.showCaption` bật + ảnh đó CÓ caption + video nền
     * KHÔNG bật (video luôn che kín, hiện caption lúc đó vô nghĩa — cùng lý do
     * `pauseForVideoBg()` chủ động ẩn hẳn). Gọi mỗi lần đổi ảnh (`_tick()`) + lúc bắt đầu
     * (`start()`) + lúc video nền tắt lại (`resumeFromVideoBg()`). */
    _refreshCaptionVisibility() {
        const cfg = appState.get('slideshowConfig');
        const image = this._images[this._currentIndex];
        const shouldShow = !!cfg.showCaption && !!image && !!image.caption && !appState.get('vizConfig').videoBgEnabled;
        setBgCaptionVisible(bgCaptionFrame, shouldShow); // core
        if (shouldShow) setBgCaptionText(bgCaptionText, image.caption); // core
    },

    /** MỚI (04/07/2026, mục 2) — gọi từ event/workflow/file-manager-photo.js ngay lúc người dùng
     * sửa caption 1 ảnh ở Photo UI: cập nhật CACHE RAM (`_images`, để lần hiện lại sau — vòng lặp
     * quay lại — vẫn đúng, KHÔNG cần đọc lại DB) + đổi hiển thị NGAY nếu ảnh đó ĐANG là ảnh hiện
     * tại của slideshow.
     * @param {string} imageKey
     * @param {string} caption
     */
    refreshCaptionIfCurrentImage(imageKey, caption) {
        const idx = this._images.findIndex((img) => img.key === imageKey);
        if (idx === -1) return;
        this._images[idx].caption = caption;
        if (idx === this._currentIndex) this._refreshCaptionVisibility();
    },

    /**
     * MỚI (04/07/2026, mục 2 phản hồi Giang) — GỌI TRỰC TIẾP từ
     * `workflowVisualizerControlCenter` NGAY LÚC video nền BẬT thành công (KHÔNG còn watchdog
     * poll 3s/lần — Giang chỉ ra ĐÚNG: đã có sẵn sự kiện click bật/tắt video để biết, poll lại
     * appState mỗi 3s là thừa). Ẩn luôn khung caption (nếu đang bật) — video nền có z-index CAO
     * HƠN caption (xem assets/css/slideshow.css) nên video che mất caption dù có hiện cũng vô ích.
     */
    pauseForVideoBg() {
        taskManager.pause(SLIDESHOW_TASK);
        taskManager.pause(SLIDESHOW_SONG_WATCH_TASK);
        setBgCaptionVisible(bgCaptionFrame, false); // core
    },

    /** MỚI (04/07/2026, mục 2) — GỌI TRỰC TIẾP từ `workflowVisualizerControlCenter` NGAY LÚC
     * video nền TẮT thành công. */
    resumeFromVideoBg() {
        if (!appState.get('activeBackgroundAlbum')) return; // không có slideshow nào đang chạy -> không có gì để resume
        if (taskManager.plan[SLIDESHOW_TASK]) taskManager.resume(SLIDESHOW_TASK); // no-op an toàn nếu không tồn tại/không paused
        if (taskManager.plan[SLIDESHOW_SONG_WATCH_TASK]) taskManager.resume(SLIDESHOW_SONG_WATCH_TASK);
        this._refreshCaptionVisibility(); // core/UI — hiện lại khung caption nếu đang bật + có ảnh đang chiếu
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
        const showCaptionToggle = slideshowSettingsPanelEl.querySelector('#setting-slideshow-show-caption');

        if (enableToggle) enableToggle.checked = !!albumId;
        if (modeSelect) modeSelect.value = cfg.mode;
        // MỚI (04/07/2026, mục 5) — đồng bộ toggle "Photo per song" + ẩn hàng "Thời gian mỗi ảnh"
        // khi đang bật (không còn ý nghĩa gì lúc đó).
        if (photoPerSongToggle) photoPerSongToggle.checked = !!cfg.photoPerSong;
        if (intervalRow) intervalRow.classList.toggle('hidden', !!cfg.photoPerSong);
        if (intervalInput) intervalInput.value = cfg.intervalSeconds;
        if (transitionSelect) transitionSelect.value = cfg.transitionType;
        // MỚI (04/07/2026, mục 2) — đồng bộ toggle "Show caption".
        if (showCaptionToggle) showCaptionToggle.checked = !!cfg.showCaption;
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

    /** MỚI (Batch 9, mục 4) — mở panel chọn Album kiểu "notify center" (vẽ lại GRID mỗi lần mở,
     * panel TĨNH đã mount sẵn — components/slideshow-settings-drawer.js). Dùng CHUNG cho 2 ngữ
     * cảnh: (a) vừa gạt "On" lần đầu (chưa có album), (b) bấm hàng "album đang chạy" để ĐỔI sang
     * album khác (đã có album từ trước). */
    async openAlbumPicker() {
        const [albums, images] = await Promise.all([listAlbums(), listImages()]); // core có sẵn, CÓ return, DÙNG ngay dưới
        const imageRecordsByKey = new Map(images.map((img) => [img.key, img]));
        const activeAlbumId = appState.get('activeBackgroundAlbum');

        renderSlideshowAlbumPickerGrid(slideshowAlbumPickerGrid, albums, activeAlbumId, imageRecordsByKey, async (albumId) => { // core/file-manager/photo-ui.js
            setSlideshowAlbumPickerVisible(slideshowAlbumPickerOverlay, slideshowAlbumPickerPanel, false); // core
            await this.setActiveAlbum(albumId);
            await this.refreshDrawerUI();
        });
        if (slideshowAlbumPickerEmpty) slideshowAlbumPickerEmpty.classList.toggle('hidden', albums.length > 0);
        setSlideshowAlbumPickerVisible(slideshowAlbumPickerOverlay, slideshowAlbumPickerPanel, true); // core
    },

    /** MỚI (Batch 9, mục 4) — ứng với bấm ra ngoài panel (overlay) mà KHÔNG chọn album nào. Nếu
     * lúc mở panel CHƯA có album active (vừa gạt "On" lần đầu) -> tự trả toggle về "off" (đúng cơ
     * chế đã thống nhất ở mục 1: huỷ picker = huỷ luôn hành động "bật"). Nếu ĐÃ có album từ trước
     * (đang đổi album, không phải bật mới) -> giữ nguyên mọi thứ, chỉ đóng panel. */
    cancelAlbumPicker() {
        setSlideshowAlbumPickerVisible(slideshowAlbumPickerOverlay, slideshowAlbumPickerPanel, false); // core
        const enableToggle = slideshowSettingsPanelEl ? slideshowSettingsPanelEl.querySelector('#setting-slideshow-enable') : null;
        if (!appState.get('activeBackgroundAlbum') && enableToggle) {
            enableToggle.checked = false;
        }
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

    /** Ứng với select "Hiệu ứng chuyển cảnh" (13 kiểu).
     * @param {string} type
     */
    async changeTransitionType(type) {
        if (!SLIDESHOW_TRANSITION_TYPES.includes(type)) return; // guard: giá trị lạ -> bỏ qua
        appState.mutate('slideshowConfig', (cfg) => { cfg.transitionType = type; });
        console.log(`writer: "workflowSlideshow.changeTransitionType", page: "slideshowConfig", content: "transitionType=${type}"`);
        await setMeta('slideshowConfig', appState.get('slideshowConfig'));
        setSlideshowTransitionType(slideshowContainer, type); // core — áp ngay cho lần chuyển cảnh kế tiếp
    },

    /** MỚI (04/07/2026, mục 2 phản hồi Giang) — ứng với toggle "Show caption".
     * @param {boolean} checked
     */
    async changeShowCaption(checked) {
        appState.mutate('slideshowConfig', (cfg) => { cfg.showCaption = checked; });
        console.log(`writer: "workflowSlideshow.changeShowCaption", page: "slideshowConfig", content: "showCaption=${checked}"`);
        await setMeta('slideshowConfig', appState.get('slideshowConfig'));
        this._refreshCaptionVisibility(); // core/UI — áp ngay, không cần đợi lượt đổi ảnh kế tiếp
    },
};
