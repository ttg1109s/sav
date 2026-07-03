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
 * PAUSE/RESUME theo `vizConfig.videoBgEnabled` — THIẾT KẾ ĐÃ GHI ở core/state-and-video-bg.js
 * (mục "Nền tĩnh Visual (ảnh)", đoạn "VẤN ĐỀ HIỆU NĂNG"): mỗi tick TỰ đọc `videoBgEnabled` — true
 * thì tự `taskManager.pause()` và KHÔNG tick tiếp (tránh chạy ngầm vô ích lúc bị video che kín);
 * 1 task "canh chừng" riêng (`_startWatchdog()`, đọc mỗi 3s) tự `resume()` khi phát hiện
 * `videoBgEnabled` đã về `false`. KHÔNG đụng `enableVideoBackground()`/
 * `disableVideoBackgroundState()`/`applyUploadedVideoBg()` (code DI SẢN đã có nợ Rule 3 sẵn — cùng
 * lý do đã ghi ở core/state-and-video-bg.js, KHÔNG thêm lời gọi void mới vào các hàm đó).
 *
 * PERSIST: `meta.slideshowConfig` + `meta.activeBackgroundAlbum` (core/db.js, getMeta/setMeta) —
 * đọc lại lúc boot qua `loadPersistedSettingsOnBoot()`, gọi từ core/visualizer/draw-visualizer.js
 * (DOMContentLoaded). KHÔNG dùng lớp localStorage như `vizConfig` (đổi hiếm — chỉ lúc mở Settings
 * Drawer, không cần đồng bộ nhanh kiểu kéo slider).
 *
 * CASCADE "xoá album đang dùng làm nguồn slideshow" — xem `clearActiveAlbum()`, gọi từ
 * event/workflow/file-manager-photo.js::deleteAlbumById() khi album vừa xoá trùng
 * `activeBackgroundAlbum` (mục 4 bước 2, plan-v12-multimedia-update-3.md).
 *
 * NẠP SAU: core/file-manager/slideshow.js (SLIDESHOW_TRANSITION_TYPES, SLIDESHOW_TRANSITION_DURATION_MS,
 * pickNextSlideshowIndex*, setSlideshow*, beginSlideshowTransition, resetSlideshowLayers),
 * core/file-manager/album.js (getAlbumRecord/listAlbums — qua core/db.js), core/file-manager/image.js
 * (getImageRecord), core/file-manager/photo-ui.js (openAlbumPickerModal), core/db.js
 * (getMeta/setMeta), core/dom-refs.js (slideshowContainer/slideshowLayer1/slideshowLayer2/
 * drawerSlideshowSettings/...), core/task-manager.js (taskManager), service/state.js (appState).
 * NẠP TRƯỚC: event/router/slideshow.js, event/workflow/file-manager-photo.js (gọi
 * `workflowSlideshow.clearActiveAlbum()` trong cascade xoá album).
 */
const SLIDESHOW_TASK = 'slideshowTimer';
const SLIDESHOW_WATCHDOG_TASK = 'slideshowWatchdog';

const workflowSlideshow = {
    // Context RUNTIME của riêng engine (KHÔNG phải appState nghiệp vụ — chỉ bookkeeping của chính
    // task lặp, giống cách event/router/*.js giữ context bằng closure `let`; ở đây workflow đóng
    // vai trò Router cho task nên giữ luôn tại đây thay vì 1 router riêng không cần thiết).
    _images: [],           // Array<{key, blob, filename}> của album đang active, nạp lại mỗi start()
    _currentIndex: -1,     // index trong _images đang hiển thị ("current"), -1 = chưa có gì
    _currentObjectUrl: null,
    _layerToggle: false,   // false = layer1 đang 'current', true = layer2 đang 'current'

    _currentLayer() { return this._layerToggle ? slideshowLayer2 : slideshowLayer1; },
    _idleLayer() { return this._layerToggle ? slideshowLayer1 : slideshowLayer2; },

    _computeIntervalMs() {
        return Math.max(5, appState.get('slideshowConfig').intervalSeconds) * 1000;
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
     * event/workflow/file-manager-photo.js::deleteAlbumById()). */
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
        taskManager.kill(SLIDESHOW_TASK);
        taskManager.addNew(SLIDESHOW_TASK, { time: this._computeIntervalMs(), exe: () => this._tick(), mode: 'timeout', count: 0 });
        taskManager.operator(SLIDESHOW_TASK, 'enabled');
        this._startWatchdog(); // canh chừng videoBgEnabled để tự resume (mục 2.4 update-3)
    },

    /** Dừng hẳn engine — dọn task + ẩn container + revoke object URL. */
    stop() {
        taskManager.kill(SLIDESHOW_TASK);
        taskManager.kill(SLIDESHOW_WATCHDOG_TASK);
        setSlideshowContainerVisible(slideshowContainer, false); // core
        resetSlideshowLayers([slideshowLayer1, slideshowLayer2]); // core
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
        if (cfg.transitionType === 'kenburns') applySlideshowKenBurns(layerEl, true, this._computeIntervalMs()); // core
    },

    /** taskManager exe — đóng vai trò "Router" cho tick tự sinh (xem comment đầu file): tự đọc
     * appState rồi gọi hàm THUẦN ở core/file-manager/slideshow.js. */
    _tick() {
        if (appState.get('vizConfig').videoBgEnabled) { taskManager.pause(SLIDESHOW_TASK); return; } // watchdog sẽ resume khi video tắt lại
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
        if (cfg.transitionType === 'kenburns') applySlideshowKenBurns(incomingLayer, true, this._computeIntervalMs()); // core
        beginSlideshowTransition(outgoingLayer, incomingLayer, SLIDESHOW_TRANSITION_DURATION_MS); // core, fire-and-forget taskManager.once bên trong

        if (this._currentObjectUrl) {
            const staleUrl = this._currentObjectUrl;
            taskManager.once(() => { try { URL.revokeObjectURL(staleUrl); } catch (e) {} }, SLIDESHOW_TRANSITION_DURATION_MS + 100, 'slideshowRevokeStale');
        }
        this._currentObjectUrl = objectUrl;
        this._currentIndex = nextIndex;
        this._layerToggle = !this._layerToggle;
    },

    /** Canh chừng nhẹ (3s/lần) — tự resume task chính khi phát hiện `videoBgEnabled` đã về false
     * (mục 2.4 plan-v12-multimedia-update-3.md — KHÔNG đụng code video-toggle di sản).
     *
     * LƯU Ý (core/task-manager.js): `taskManager.isTaskRunning()` vẫn trả `true` NGAY CẢ KHI task
     * đang `pause()` (chỉ đổi `Loop.isPaused`, KHÔNG đổi `Loop.isRunning`) — dùng nó để "phát hiện
     * đang pause" là SAI. Thay vào đó gọi thẳng `taskManager.resume()` mỗi tick — hàm này tự guard
     * nội bộ (`Loop.resume()`: `if (!this.isPaused) return;`), gọi khi KHÔNG paused là no-op an
     * toàn tuyệt đối, không cần tự kiểm tra trạng thái paused ở đây. */
    _startWatchdog() {
        taskManager.kill(SLIDESHOW_WATCHDOG_TASK);
        taskManager.addNew(SLIDESHOW_WATCHDOG_TASK, {
            time: 3000,
            exe: () => {
                if (appState.get('activeBackgroundAlbum')
                    && !appState.get('vizConfig').videoBgEnabled
                    && taskManager.plan[SLIDESHOW_TASK]) {
                    taskManager.resume(SLIDESHOW_TASK); // no-op an toàn nếu task không hề đang paused
                }
            },
            mode: 'timeout', count: 0,
        });
        taskManager.operator(SLIDESHOW_WATCHDOG_TASK, 'enabled');
    },

    // ===================== Settings Drawer (cụm router "slideshowSettings") =====================

    /** Ứng với 'slideshowSettings.open'. */
    async openDrawer() {
        drawerSlideshowSettings.classList.remove('translate-y-full');
        await this.refreshDrawerUI();
    },

    /** Vẽ lại toàn bộ UI Settings Drawer theo state hiện tại — gọi lúc mở drawer + sau mỗi lần
     * đổi album/mode/interval/transitionType. */
    async refreshDrawerUI() {
        const albumId = appState.get('activeBackgroundAlbum');
        const cfg = appState.get('slideshowConfig');
        let albumName = '';
        if (albumId) {
            const record = await getAlbumRecord(albumId); // data layer
            albumName = record ? record.name : '';
        }
        if (slideshowSettingsAlbumName) slideshowSettingsAlbumName.textContent = albumName || t('slideshowSettingsDrawer.album.none');
        if (btnSlideshowClearAlbum) btnSlideshowClearAlbum.classList.toggle('hidden', !albumId);
        if (slideshowModeSelect) slideshowModeSelect.value = cfg.mode;
        if (slideshowIntervalInput) slideshowIntervalInput.value = cfg.intervalSeconds;
        if (slideshowTransitionSelect) slideshowTransitionSelect.value = cfg.transitionType;
    },

    /** Ứng với "Tắt" nền Slideshow trong Settings Drawer. */
    async disableFromDrawer() {
        await this.clearActiveAlbum();
        await this.refreshDrawerUI();
    },

    /** Ứng với "Chọn Album" trong Settings Drawer — mở picker (danh sách album). */
    async promptPickAlbum() {
        const albums = await listAlbums(); // core/file-manager/album.js
        openAlbumPickerModal(albums, async (albumId) => { // core/file-manager/photo-ui.js
            await this.setActiveAlbum(albumId);
            await this.refreshDrawerUI();
        });
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
        if (slideshowIntervalInput) slideshowIntervalInput.value = v; // đồng bộ lại nếu giá trị bị kẹp
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
};
