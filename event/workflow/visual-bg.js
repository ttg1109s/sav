/**
 * event/workflow/visual-bg.js — Workflow của cụm router "visualBg" (v13, plan-v13-visual-
 * background-unification.md). Điều phối TOÀN BỘ "Visual Background" — gộp 3 tính năng nền màn
 * Visualizer từng rời rạc (video nền loop / ảnh nền tĩnh / slideshow album).
 *
 * PHÂN VAI (đúng readme/event-bus-flow.md + core-function-conventions.md):
 *   - Core THUẦN (`core/visual-bg.js`) — chỉ áp DOM/tính toán, nhận mọi thứ qua tham số.
 *   - Workflow (file NÀY) — đọc `appConfigVisualBg`/`appState`, đọc `service/db.js`, tạo/huỷ
 *     object URL (Rule 3b: `createObjectURL` là CHUẨN BỊ, cấm Core), rồi gọi TỪNG hàm Core.
 *
 * PERSIST: `meta.visualBgConfig` (IndexedDB) — cùng khuôn domain `slideshow` cũ, KHÔNG dùng lớp
 * localStorage debounce như domain `viz` (tần suất đổi thấp, chỉ thao tác Settings thủ công).
 * Đọc lại lúc boot qua `loadPersistedSettingsOnBoot()` (gọi từ event/workflow/app-boot.js).
 *
 * KHÔNG MIGRATE dữ liệu cũ (Giang chốt) — xem lý do đầy đủ ở docstring
 * `DEFAULT_VISUAL_BG_CONFIG` (core/config.js).
 *
 * NẠP SAU: core/config.js (appConfigVisualBg), core/visual-bg.js (reconcileVisualBgConfigOnClose,
 * readVisualBgActiveSourceRef, applyVisualBgImageToDOM, showVisualBgVideoElement,
 * hideVisualBgVideoElement, syncVisualBgVideoPlayback, 4 hằng số VISUAL_BG_*),
 * core/color-utils.js (updateDOMBackground), core/settings-panel-stack-ui.js (pushSettingsPanel), components/visual-bg-settings-
 * drawer.js (renderVisualBgPanelBody), service/db.js (getMeta/setMeta/getImageRecord/getVideoRecord),
 * service/state.js (appState).
 * NẠP TRƯỚC: event/router/visual-bg.js.
 */
let visualBgSettingsPanelEl = null; // panel Settings đang mở — null nếu đang đóng (cùng khuôn slideshowSettingsPanelEl)

/** Task đếm giờ của nhánh "danh sách VIDEO" ở chế độ 'slideshow' (đổi video theo chu kỳ giây).
 * Chế độ 'perSong' KHÔNG dùng task nào — nhịp do sự kiện đổi bài đẩy tới, video tự loop giữa chừng. */
const VISUAL_BG_VIDEO_TASK = 'visualBgVideoRotate';

const workflowVisualBg = {

    // ===================== Context RUNTIME của nhánh "danh sách VIDEO" (v13 Batch E) =============
    // Bookkeeping của riêng engine, KHÔNG phải state nghiệp vụ (lựa chọn của người dùng nằm ở
    // `visualBgConfig`) — cùng cách `workflowSlideshow` giữ `_images`/`_currentIndex`.
    _listVideoKeys: [],        // thứ tự videoKey ĐÃ DỰNG theo `nextOrder`, nạp lại mỗi lần áp nguồn
    _listVideoIndex: -1,       // vị trí đang phát trong `_listVideoKeys`, -1 = chưa phát gì
    _forcedBgThumbUrl: null,   // object URL thumb đang chèn ở lớp dự phòng `#visual-bg-image` lúc chuyển video

    // ===================== Boot / persist =====================

    /** Đọc lại `meta.visualBgConfig` đã lưu + áp dụng nền ngay — gọi 1 LẦN lúc boot
     * (event/workflow/app-boot.js), SAU `loadConfig()`. Validate TỪNG field theo đúng khuôn
     * `workflowSlideshow.loadPersistedSettingsOnBoot()`: giá trị lạ/sai kiểu -> giữ default, KHÔNG
     * ghi đè bừa. */
    async loadPersistedSettingsOnBoot() {
        const saved = await getMeta('visualBgConfig'); // service/db.js
        if (saved && typeof saved === 'object') {
            appConfigVisualBg.mutateAll((cfg) => {
                if (typeof saved.enabled === 'boolean') cfg.enabled = saved.enabled;
                if (VISUAL_BG_MEDIA_TYPES.includes(saved.mediaType)) cfg.mediaType = saved.mediaType;
                if (VISUAL_BG_SOURCE_MODES.includes(saved.sourceMode)) cfg.sourceMode = saved.sourceMode;
                if (typeof saved.singleImageKey === 'string') cfg.singleImageKey = saved.singleImageKey;
                if (typeof saved.singleVideoKey === 'string') cfg.singleVideoKey = saved.singleVideoKey;
                if (saved.listAlbumId === null || typeof saved.listAlbumId === 'string') cfg.listAlbumId = saved.listAlbumId;
                if (saved.listFolderId === null || typeof saved.listFolderId === 'string') cfg.listFolderId = saved.listFolderId;
                if (VISUAL_BG_LIST_PLAYBACK_MODES.includes(saved.listPlaybackMode)) cfg.listPlaybackMode = saved.listPlaybackMode;
                if (VISUAL_BG_NEXT_ORDERS.includes(saved.nextOrder)) cfg.nextOrder = saved.nextOrder;
                if (VISUAL_BG_COLOR_MODES.includes(saved.colorMode)) cfg.colorMode = saved.colorMode;
                if (typeof saved.solidColor === 'string') cfg.solidColor = saved.solidColor;
                if (typeof saved.gradientAngleDeg === 'number') cfg.gradientAngleDeg = saved.gradientAngleDeg;
                if (Array.isArray(saved.gradientStops) && saved.gradientStops.length >= VISUAL_BG_GRADIENT_MIN_STOPS && saved.gradientStops.length <= VISUAL_BG_GRADIENT_MAX_STOPS) cfg.gradientStops = saved.gradientStops;
                if (saved.slideshow && typeof saved.slideshow === 'object') {
                    // Validate TỪNG field (khuôn cũ workflowSlideshow.loadPersistedSettingsOnBoot()
                    // — hàm đó đã xoá ở Batch C, domain `slideshow` gộp vào đây).
                    const ss = saved.slideshow;
                    if (typeof ss.intervalSeconds === 'number' && ss.intervalSeconds >= 5) cfg.slideshow.intervalSeconds = ss.intervalSeconds;
                    if (SLIDESHOW_TRANSITION_TYPES.includes(ss.transitionType)) cfg.slideshow.transitionType = ss.transitionType;
                    if (typeof ss.transitionDurationMs === 'number' && ss.transitionDurationMs >= SLIDESHOW_TRANSITION_MIN_TIME_MS && ss.transitionDurationMs <= SLIDESHOW_TRANSITION_MAX_TIME_MS) cfg.slideshow.transitionDurationMs = ss.transitionDurationMs;
                    if (typeof ss.transitionInOutRatio === 'number' && ss.transitionInOutRatio >= 0 && ss.transitionInOutRatio <= 100) cfg.slideshow.transitionInOutRatio = ss.transitionInOutRatio;
                    if (SLIDESHOW_TRANSITION_EASINGS.includes(ss.transitionEasing)) cfg.slideshow.transitionEasing = ss.transitionEasing;
                    if (typeof ss.kenBurnsEnabled === 'boolean') cfg.slideshow.kenBurnsEnabled = ss.kenBurnsEnabled;
                    if (SLIDESHOW_KENBURNS_MODES.includes(ss.kenBurnsMode)) cfg.slideshow.kenBurnsMode = ss.kenBurnsMode;
                }
            });
            console.log(`writer: "workflowVisualBg.loadPersistedSettingsOnBoot", page: "visualBgConfig", content: "nạp lại bản đã lưu từ meta.visualBgConfig"`);
        }
        await this.applyCurrentVisualBg();
    },

    /** Ghi cấu hình hiện tại xuống IndexedDB — DÙNG CHUNG cho MỌI method đổi field bên dưới. */
    async _persist() {
        await setMeta('visualBgConfig', appConfigVisualBg.getAll()); // service/db.js
    },

    /** MỚI (v13 Batch C) — sửa 1/nhiều field trong nhóm con `slideshow` + persist, DÙNG CHUNG cho
     * mọi method của `workflowSlideshow` (panel "Tuỳ chỉnh Trình chiếu" nằm ở miền đó nhưng CONFIG
     * thì thuộc miền này — 1 nguồn sự thật duy nhất `visualBgConfig`, không còn domain `slideshow`
     * + `meta.slideshowConfig` song song). Gọi CHÉO domain Workflow->Workflow (event-bus-flow.md
     * mục 3a, TH2).
     * @param {(slideshow: object) => void} mutatorFn
     * @param {string} logContent - mô tả ngắn cho console.log Rule 4 (nơi gọi biết rõ vừa sửa gì).
     */
    async mutateSlideshowSetting(mutatorFn, logContent) {
        appConfigVisualBg.mutateAll((cfg) => { mutatorFn(cfg.slideshow); });
        console.log(`writer: "workflowVisualBg.mutateSlideshowSetting", page: "visualBgConfig", content: "slideshow.${logContent}"`);
        await this._persist();
    },

    // ===================== Áp dụng nền thật =====================

    /** Dọn SẠCH mọi lớp nền Visual Background đang hiện + revoke 2 object URL runtime. DÙNG CHUNG
     * cho mọi lối thoát (tắt toggle, đổi nguồn, config không hợp lệ lúc boot). */
    _clearVisualBgLayers() {
        const { visualBgVideoObjectUrl, visualBgImageObjectUrl } = appState.get(['visualBgVideoObjectUrl', 'visualBgImageObjectUrl']);
        workflowSlideshow.stop(); // event/workflow/slideshow.js — dừng engine trình chiếu (nếu đang chạy)
        taskManager.kill(VISUAL_BG_VIDEO_TASK); // service/task-manager.js
        this._listVideoKeys = [];
        this._listVideoIndex = -1;
        if (this._forcedBgThumbUrl) { revokeBlobUrl(this._forcedBgThumbUrl); this._forcedBgThumbUrl = null; } // service/blob-url.js
        hideVisualBgVideoElement(); // core/visual-bg.js
        applyVisualBgImageToDOM(false, ''); // core/visual-bg.js
        updateDOMBackground(); // core/color-utils.js — trả nền về màu cấu hình (chủ sở hữu duy nhất)
        if (visualBgVideoObjectUrl) revokeBlobUrl(visualBgVideoObjectUrl); // service/blob-url.js
        if (visualBgImageObjectUrl) revokeBlobUrl(visualBgImageObjectUrl); // service/blob-url.js
        appState.set('visualBgVideoObjectUrl', '');
        appState.set('visualBgImageObjectUrl', '');
    },

    /** Áp dụng nền theo `visualBgConfig` hiện tại — điểm ĐỒNG BỘ DUY NHẤT giữa config và DOM. Gọi
     * lúc boot + sau MỌI thay đổi (bật/tắt, đổi mediaType/sourceMode, chọn nguồn mới).
     * Luôn dọn sạch lớp cũ TRƯỚC (tránh 2 lớp cùng hiện khi đổi ảnh <-> video). */
    async applyCurrentVisualBg() {
        this._clearVisualBgLayers();
        const cfg = appConfigVisualBg.getAll();
        // Nền MÀU luôn được sơn (kể cả khi toggle tổng đang tắt) — nó là lớp dưới cùng, thay chỗ
        // của `vizConfig.bgColor` cũ vốn cũng luôn có hiệu lực.
        updateDOMBackground(); // core/color-utils.js
        if (!cfg.enabled || cfg.mediaType === 'color') return; // guard: không có ảnh/video nào để áp
        if (cfg.sourceMode === 'single' && cfg.mediaType === 'image') return this._applySingleImage(cfg.singleImageKey);
        if (cfg.sourceMode === 'single' && cfg.mediaType === 'video') return this._applySingleVideo(cfg.singleVideoKey);
        if (cfg.sourceMode === 'list' && cfg.mediaType === 'image') return this._applyListAlbum(cfg.listAlbumId);
        if (cfg.sourceMode === 'list' && cfg.mediaType === 'video') return this._applyListVideo(cfg.listFolderId);
    },

    /** Nhánh "danh sách ảnh" — giao NGUYÊN cho engine trình chiếu đã có sẵn
     * (`workflowSlideshow`, liên tuyến domain TH2): file này sở hữu "album nào làm nền", file kia
     * sở hữu "chiếu ra sao". KHÔNG viết lại engine. */
    async _applyListAlbum(albumId) {
        if (!albumId) return; // guard: chưa chọn nguồn
        await workflowSlideshow.start(albumId); // event/workflow/slideshow.js
    },

    /** Lối tắt "Dùng làm nền Slideshow" từ thanh quản lý Album (Photo & Album) — đặt ĐỦ tổ hợp
     * tương ứng trong 1 lần ghi, thay vì bắt người dùng vào Settings gạt 3 thứ. Gọi chéo domain từ
     * event/workflow/file-manager-photo.js.
     * @param {string} albumId
     */
    async applyAlbumAsBackground(albumId) {
        appConfigVisualBg.mutateAll((cfg) => {
            cfg.enabled = true;
            cfg.mediaType = 'image';
            cfg.sourceMode = 'list';
            cfg.listAlbumId = albumId;
        });
        console.log(`writer: "workflowVisualBg.applyAlbumAsBackground", page: "visualBgConfig", content: "enabled=true, image/list, listAlbumId=${albumId}"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    /** Cascade "album đang dùng làm nền vừa bị xoá" — gọi từ event/workflow/file-manager-photo.js.
     * THAY `workflowSlideshow.clearActiveAlbum()` cũ (state `activeBackgroundAlbum` đã bỏ).
     * @param {string} albumId - album vừa bị xoá.
     */
    async clearListAlbumIfMatches(albumId) {
        if (appConfigVisualBg.getAll().listAlbumId !== albumId) return; // guard: không phải album đang dùng
        appConfigVisualBg.mutateAll((cfg) => { cfg.listAlbumId = null; });
        console.log(`writer: "workflowVisualBg.clearListAlbumIfMatches", page: "visualBgConfig", content: "listAlbumId=null"`);
        await this._persist();
        await this.applyCurrentVisualBg();
        await this.refreshPanelUI();
    },

    /** Nhánh "1 ảnh tĩnh" — resolve Blob từ imageKey rồi áp lên `#visual-bg-image`. */
    async _applySingleImage(imageKey) {
        if (!imageKey) return; // guard: chưa chọn nguồn
        const record = await getImageRecord(imageKey); // service/db.js
        if (!record || !record.blob) return; // guard: ảnh đã bị xoá ở nơi khác -> để nền trống, reconcile lúc đóng Settings sẽ tự dọn
        const objectUrl = createBlobUrl(record.blob); // service/blob-url.js — Workflow tạo (Rule 3b)
        appState.set('visualBgImageObjectUrl', objectUrl);
        console.log(`writer: "workflowVisualBg._applySingleImage", page: "visualBgImageObjectUrl", content: "${objectUrl}"`);
        applyVisualBgImageToDOM(true, objectUrl); // core/visual-bg.js
    },

    /** Nhánh "1 video loop" — resolve Blob từ videoKey rồi áp lên `#bg-video` (LOOP liên tục). */
    async _applySingleVideo(videoKey) {
        if (!videoKey) return; // guard: chưa chọn nguồn
        const record = await getVideoRecord(videoKey); // service/db.js
        if (!record || !record.blob) return; // guard: video đã bị xoá ở nơi khác
        const objectUrl = createBlobUrl(record.blob); // service/blob-url.js
        appState.set('visualBgVideoObjectUrl', objectUrl);
        console.log(`writer: "workflowVisualBg._applySingleVideo", page: "visualBgVideoObjectUrl", content: "${objectUrl}"`);
        updateDOMBackground(); // core/color-utils.js — tự ép đen vì visualBgConfig đang là video
        showVisualBgVideoElement(objectUrl, appState.get('visualBgVideoLoadedUrl')); // core
        syncVisualBgVideoPlayback(audioPlayer.paused); // core
    },

    // ===================== Nhánh "danh sách VIDEO" (v13 Batch E, plan mục 3) =====================
    // 1 KIỂU PHÁT DUY NHẤT: video hiện tại LOOP liên tục, CHỈ đổi sang video kế khi BÀI HÁT đổi
    // (next/prev/hết bài) — KHÔNG theo sự kiện 'ended' của chính video nền, KHÔNG có timer nào.
    // Vì vậy nhánh này KHÔNG dùng `listPlaybackMode` (đã ẩn khỏi UI khi mediaType='video'), chỉ dùng
    // `nextOrder` làm quy tắc chọn video kế.
    // KHÔNG kích hoạt Ken Burns (yêu cầu Giang) — mọi hàm Ken Burns thuộc core/file-manager/
    // slideshow.js, nhánh này không gọi tới hàm nào trong đó.
    // KHÔNG viết core "advance list video" riêng: 4 core đã có sẵn ở core/visual-bg.js
    // (`showVisualBgVideoElement`/`syncVisualBgVideoPlayback`/`applyVisualBgImageToDOM`) +
    // `decodeForcedBgThumb()` (core/video-player.js) + 2 hàm chọn index đã tách sẵn theo Rule 1
    // (`pickNextSlideshowIndexSequential/Random`, core/file-manager/slideshow.js) phủ đủ — thêm hàm
    // mới chỉ là bản sao. `event/workflow/video-player.js` KHÔNG bị sửa dòng nào.

    /** Áp nguồn "danh sách video": dựng thứ tự theo `nextOrder` rồi phát video ĐẦU TIÊN. */
    async _applyListVideo(folderId) {
        if (!folderId) return; // guard: chưa chọn nguồn
        this._listVideoKeys = await this._buildListVideoOrder(folderId);
        this._listVideoIndex = -1;
        if (this._listVideoKeys.length === 0) return; // guard: folder rỗng/đã bị xoá hết video
        const firstIndex = appConfigVisualBg.getAll().nextOrder === 'random'
            ? pickNextSlideshowIndexRandom(-1, this._listVideoKeys.length)      // core/file-manager/slideshow.js
            : pickNextSlideshowIndexSequential(-1, this._listVideoKeys.length); // core/file-manager/slideshow.js
        this._listVideoIndex = firstIndex;
        await this._playListVideo(this._listVideoKeys[firstIndex]);

        // Chế độ 'slideshow' cho VIDEO: đổi video theo CHU KỲ GIÂY, dùng chung
        // `visualBgConfig.slideshow.intervalSeconds` với nhánh ảnh (KHÔNG thêm field mới).
        // CÙNG khuôn task của `workflowSlideshow._reveal()` (mode 'timeout', count 0 = lặp vô hạn).
        if (appConfigVisualBg.getAll().listPlaybackMode === 'slideshow') {
            taskManager.addNew(VISUAL_BG_VIDEO_TASK, { time: appConfigVisualBg.getAll().slideshow.intervalSeconds * 1000, exe: () => this._tickListVideo(), mode: 'timeout', count: 0 }); // service/task-manager.js
            taskManager.operator(VISUAL_BG_VIDEO_TASK, 'enabled');
        }
    },

    /** 1 nhịp của chế độ 'slideshow' cho video — đổi sang video kế theo `nextOrder`. Tách khỏi
     * `advanceListVideo()` để guard `listPlaybackMode` của hàm kia không chặn nhầm chính nó. */
    async _tickListVideo() {
        if (this._listVideoKeys.length === 0) return; // guard
        const nextIndex = appConfigVisualBg.getAll().nextOrder === 'random'
            ? pickNextSlideshowIndexRandom(this._listVideoIndex, this._listVideoKeys.length)      // core
            : pickNextSlideshowIndexSequential(this._listVideoIndex, this._listVideoKeys.length); // core
        if (nextIndex < 0) return; // guard
        this._listVideoIndex = nextIndex;
        await this._playListVideo(this._listVideoKeys[nextIndex]);
    },

    /** Dựng THỨ TỰ videoKey trong Folder theo `visualBgConfig.nextOrder` — CÙNG quy tắc và CÙNG 2
     * core sort với nhánh ảnh (`workflowSlideshow._applyNextOrder()`), không viết lại tiêu chí:
     *   'sequential' -> giữ nguyên thứ tự thêm vào Folder (`getFolderSongKeys()`)
     *   'playlist'   -> theo `appConfigPlaylist.displaySortMode`
     *   'random'     -> thứ tự mảng không quan trọng
     * @param {string} folderId
     * @returns {Promise<string[]>}
     */
    async _buildListVideoOrder(folderId) {
        const map = await getFolderSongMap(folderId); // service/db.js
        const keys = map ? getFolderSongKeys(map) : []; // core/file-manager/folder.js — hàm thuần
        if (appConfigVisualBg.getAll().nextOrder !== 'playlist') return keys; // guard: 2 chế độ kia dùng nguyên thứ tự Folder

        const records = await Promise.all(keys.map((key) => getVideoRecord(key))); // service/db.js
        const items = keys.map((key, i) => ({
            key,
            name: records[i] ? (records[i].customName || stripFileExtension(records[i].filename)) : key, // core/file-manager/video.js
            addedAt: records[i] ? records[i].addedAt : 0,
        }));
        const mode = appConfigPlaylist.getAll().displaySortMode;
        const sorted = (mode === 'newest' || mode === 'oldest')
            ? sortVisualBgItemsByAddedAt(items, mode === 'newest') // core/visual-bg.js
            : sortVisualBgItemsByName(items, mode === 'za');       // core/visual-bg.js
        return sorted.map((item) => item.key);
    },

    /** Đổi sang video kế tiếp trong danh sách — gọi từ Router lúc BÀI HÁT đổi thật
     * ('visualBg.songChanged', event/router/visual-bg.js). */
    async advanceListVideo() {
        if (appConfigVisualBg.getAll().listPlaybackMode !== 'perSong') return; // guard: chế độ đếm giờ -> đổi theo task, không theo bài
        if (this._listVideoKeys.length === 0) return; // guard: chưa có danh sách (chưa áp nguồn/folder rỗng)
        const nextIndex = appConfigVisualBg.getAll().nextOrder === 'random'
            ? pickNextSlideshowIndexRandom(this._listVideoIndex, this._listVideoKeys.length)      // core
            : pickNextSlideshowIndexSequential(this._listVideoIndex, this._listVideoKeys.length); // core
        if (nextIndex < 0) return; // guard: core báo không có gì để chọn
        this._listVideoIndex = nextIndex;
        await this._playListVideo(this._listVideoKeys[nextIndex]);
    },

    /** Nạp + phát 1 video nền LOOP, che khoảng hở đổi `src` bằng thumb ở lớp nền tĩnh phía dưới.
     * TÁI DÙNG CHÍNH XÁC khuôn `playVideoByKey(..., isTransition=true)` (event/workflow/
     * video-player.js) — cùng thứ tự, cùng lý do từng bước, cùng cặp `decodeForcedBgThumb()` +
     * `applyVisualBgImageToDOM()` + `Promise.race([...'playing'..., timeout 2s])`. KHÔNG sửa file
     * gốc đó và KHÔNG gọi vào nó (2 tính năng khác nhau dùng chung 1 thẻ `<video>`, gộp lời gọi sẽ
     * kéo theo cả `currentKey`/mediaSession/play count của Video Player mode — sai hoàn toàn ở đây).
     * @param {string} videoKey
     */
    async _playListVideo(videoKey) {
        const record = await getVideoRecord(videoKey); // service/db.js
        if (!record || !record.blob) return; // guard: video đã bị xoá ở nơi khác

        bgVideoElement.pause();

        // (1) Chèn thumb full-size của video SẮP tới xuống lớp `#visual-bg-image` NẰM DƯỚI — che
        // khoảng hở lúc đổi `src` trên thiết bị nào đó lộ khung trắng/đen (cùng lý do đã ghi ở
        // core/video-player.js::setBgVideoElementForPlayerMode()).
        if (record.thumbFullBlob) {
            const thumbUrl = await decodeForcedBgThumb(record.thumbFullBlob); // core/video-player.js
            if (this._forcedBgThumbUrl) revokeBlobUrl(this._forcedBgThumbUrl); // service/blob-url.js
            this._forcedBgThumbUrl = thumbUrl;
            applyVisualBgImageToDOM(true, thumbUrl); // core/visual-bg.js
        }

        // (2) Đổi nguồn video. Object URL cũ revoke SAU khi đã có URL mới -> không có khoảnh khắc
        // nào thẻ <video> trỏ vào URL đã chết.
        const previousObjectUrl = appState.get('visualBgVideoObjectUrl');
        const objectUrl = createBlobUrl(record.blob); // service/blob-url.js — Workflow tạo (Rule 3b)
        appState.set('visualBgVideoObjectUrl', objectUrl);
        console.log(`writer: "workflowVisualBg._playListVideo", page: "visualBgVideoObjectUrl", content: "${objectUrl}"`);
        updateDOMBackground(); // core/color-utils.js — ép nền đen phía sau video
        showVisualBgVideoElement(objectUrl, appState.get('visualBgVideoLoadedUrl')); // core/visual-bg.js — kèm loop=true
        syncVisualBgVideoPlayback(audioPlayer.paused); // core/visual-bg.js

        // (3) Đợi ĐÚNG lúc video mới thật sự có khung hình, kèm timeout an toàn 2s phòng 'playing'
        // không bao giờ bắn (autoplay bị chặn/định dạng lạ) để không kẹt vĩnh viễn.
        await Promise.race([
            new Promise((resolve) => bgVideoElement.addEventListener('playing', resolve, { once: true })),
            new Promise((resolve) => taskManager.once(resolve, 2000, 'visualBgVideoPlayingFallback')), // service/task-manager.js
        ]);

        if (previousObjectUrl) revokeBlobUrl(previousObjectUrl); // service/blob-url.js

        // (4) Video đã hiện -> gỡ lớp thumb dự phòng, trả `#visual-bg-image` về đúng trạng thái của
        // chính nó (nhánh này KHÔNG dùng ảnh nền tĩnh nên = ẩn).
        if (this._forcedBgThumbUrl) {
            applyVisualBgImageToDOM(false, ''); // core/visual-bg.js
            revokeBlobUrl(this._forcedBgThumbUrl); // service/blob-url.js
            this._forcedBgThumbUrl = null;
        }
    },

    /** Đồng bộ play/pause video nền theo nhạc — gọi từ core/player-controls.js (audio play/pause)
     * và mỗi lần Next/Prev. THAY `syncVideoBgToAudio()` (core cũ tự đọc config — vi phạm Rule 2). */
    syncPlaybackToAudio() {
        syncVisualBgVideoPlayback(audioPlayer.paused); // core/visual-bg.js
    },

    // ===================== Validate lúc đóng Settings (plan mục 8) =====================

    /** Ứng với `playerControls.settingsDrawer.close` — THAY HẲN `validateVideoBgOnClose()` (core
     * cũ, ĐÃ XOÁ: vi phạm Rule 2 tự đọc config + Rule 3a gọi 2 core khác). Gọi CHÉO DOMAIN từ
     * `workflowPlayerControls.closeSettingsDrawer()` — tái dùng hook "lúc đóng Settings" đã có sẵn,
     * nhưng logic Visual Background vẫn SỐNG trong domain của chính nó (plan nguyên tắc #2).
     * Workflow tự đọc -> gọi core THUẦN tính toán -> tự ghi lại + tự đồng bộ hiển thị. */
    async validateOnClose() {
        const before = appConfigVisualBg.getAll();
        // Workflow ĐẾM (đọc DB = CHUẨN BỊ, Rule 3b) rồi đưa con số cho core THUẦN tự quyết định.
        const after = reconcileVisualBgConfigOnClose(before, await this._countListSourceItems(before)); // core/visual-bg.js
        if (after.enabled === before.enabled && after.sourceMode === before.sourceMode) return; // guard: không có gì đổi
        appConfigVisualBg.setAll(after);
        console.log(`writer: "workflowVisualBg.validateOnClose", page: "visualBgConfig", content: "enabled=${after.enabled}, sourceMode=${after.sourceMode}"`);
        await this._persist();
        await this.applyCurrentVisualBg();
    },

    // ===================== Panel Settings (cụm router "visualBg") =====================

    /** Ứng với 'visualBg.openPanel.click' — push panel + vẽ lại UI theo config hiện tại. */
    async openPanel() {
        visualBgSettingsPanelEl = pushSettingsPanel({ title: t('visualBgSettingsDrawer.title'), bodyHtml: renderVisualBgPanelBody() });
        await this.refreshPanelUI();
    },

    /** Đồng bộ TOÀN BỘ UI panel theo config hiện tại — gọi lúc mở panel + sau mỗi lần đổi field
     * làm thay đổi phần UI con nào hiện/ẩn. Nhãn nguồn đang chọn đọc DB thật (tên album/folder/
     * file), rơi về "Chưa chọn" nếu chưa có hoặc tham chiếu mồ côi. */
    async refreshPanelUI() {
        if (!visualBgSettingsPanelEl) return; // panel đã đóng — an toàn bỏ qua
        const cfg = appConfigVisualBg.getAll();
        const q = (sel) => visualBgSettingsPanelEl.querySelector(sel);

        const enableToggle = q('#setting-visual-bg-enable');
        const bodyEl = q('#visual-bg-body');
        const mediaTypeSelect = q('#setting-visual-bg-media-type');
        const sourceModeToggle = q('#setting-visual-bg-source-mode');
        const listPlaybackRow = q('#visual-bg-list-playback-row');
        const listPlaybackSelect = q('#setting-visual-bg-list-playback-mode');
        const nextOrderRow = q('#visual-bg-next-order-row');
        const nextOrderSelect = q('#setting-visual-bg-next-order');
        const slideshowRow = q('#setting-visual-bg-open-slideshow');

        if (enableToggle) enableToggle.checked = !!cfg.enabled;
        if (bodyEl) bodyEl.classList.toggle('hidden', !cfg.enabled);
        if (mediaTypeSelect) mediaTypeSelect.value = cfg.mediaType;
        if (sourceModeToggle) sourceModeToggle.checked = cfg.sourceMode === 'list';
        if (sourceModeToggle) sourceModeToggle.closest('div').classList.toggle('hidden', cfg.mediaType === 'color');
        if (listPlaybackSelect) listPlaybackSelect.value = cfg.listPlaybackMode;
        if (nextOrderSelect) nextOrderSelect.value = cfg.nextOrder;

        // SỬA (v13 Batch G, Giang chỉ ra) — `listPlaybackMode` hiện cho CẢ mediaType='video'. Với
        // video, "1 mỗi bài" có nghĩa RIÊNG và cần thiết: video nền LOOP suốt bài hát (video thường
        // ngắn hơn bài), chỉ đổi sang video khác khi SANG BÀI MỚI. Bản trước tôi biến đó thành kiểu
        // phát DUY NHẤT rồi ẩn luôn lựa chọn — sai.
        // Nút "Tuỳ chỉnh Trình chiếu" (transition + Ken Burns) VẪN chỉ cho ảnh — 2 thứ đó không áp
        // dụng được cho video.
        // Nhánh MÀU không có "nguồn" để chọn -> ẩn toàn bộ cụm nguồn/danh sách, hiện cụm màu.
        const isColor = cfg.mediaType === 'color';
        const isGradient = isColor && cfg.colorMode === 'gradient';
        const q2 = (sel) => visualBgSettingsPanelEl.querySelector(sel);
        if (q2('#setting-visual-bg-pick-source')) q2('#setting-visual-bg-pick-source').closest('div').classList.toggle('hidden', isColor);
        if (q2('#visual-bg-color-mode-row')) q2('#visual-bg-color-mode-row').classList.toggle('hidden', !isColor);
        if (q2('#visual-bg-solid-color-row')) q2('#visual-bg-solid-color-row').classList.toggle('hidden', !(isColor && !isGradient));
        if (q2('#visual-bg-gradient-angle-row')) q2('#visual-bg-gradient-angle-row').classList.toggle('hidden', !isGradient);
        if (q2('#visual-bg-gradient-stops-row')) q2('#visual-bg-gradient-stops-row').classList.toggle('hidden', !isGradient);
        if (q2('#setting-visual-bg-color-mode')) q2('#setting-visual-bg-color-mode').value = cfg.colorMode;
        if (q2('#setting-visual-bg-solid-color')) q2('#setting-visual-bg-solid-color').value = cfg.solidColor;
        if (q2('#setting-visual-bg-gradient-angle')) q2('#setting-visual-bg-gradient-angle').value = cfg.gradientAngleDeg;
        if (q2('#visual-bg-gradient-angle-value')) q2('#visual-bg-gradient-angle-value').textContent = `${cfg.gradientAngleDeg}°`;
        if (isGradient) this._refreshGradientStopRows(cfg);

        const isList = !isColor && cfg.sourceMode === 'list';
        const isListImage = isList && cfg.mediaType === 'image';
        if (listPlaybackRow) listPlaybackRow.classList.toggle('hidden', !isList);
        if (nextOrderRow) nextOrderRow.classList.toggle('hidden', !isList);
        if (slideshowRow) slideshowRow.classList.toggle('hidden', !(isListImage && cfg.listPlaybackMode === 'slideshow'));

        await this._refreshSourceNameLabel(cfg);
    },

    /** Vẽ lại danh sách chặng màu gradient (2-7 hàng) + ô xem trước. DOM ĐỘNG nên dựng ở Workflow
     * rồi giao Core gắn sự kiện? — KHÔNG: 3 control mỗi hàng đều là input tĩnh về bản chất, listener
     * đã DELEGATE sẵn trên `settingsStackBody` (event/listener/visual-bg.js) theo `data-*`, nên ở
     * đây chỉ dựng HTML, không `addEventListener` dòng nào (Rule 5a).
     * @param {object} cfg
     */
    _refreshGradientStopRows(cfg) {
        const listEl = visualBgSettingsPanelEl.querySelector('#visual-bg-gradient-stop-list');
        const previewEl = visualBgSettingsPanelEl.querySelector('#visual-bg-gradient-preview');
        if (!listEl) return;
        const canRemove = cfg.gradientStops.length > VISUAL_BG_GRADIENT_MIN_STOPS; // core/visual-bg.js
        listEl.innerHTML = cfg.gradientStops.map((stop, i) => `
            <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" data-visual-bg-stop-color="${i}" value="${stop.color}" class="w-11 h-11 -m-2 cursor-pointer bg-transparent border-0"></div>
                <input type="range" data-visual-bg-stop-position="${i}" min="0" max="100" step="1" value="${stop.position}" class="flex-1 accent-fuchsia-500">
                <span class="text-xs text-slate-400 w-10 text-right tabular-nums">${stop.position}%</span>
                <button type="button" data-visual-bg-stop-remove="${i}" class="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors shrink-0 ${canRemove ? '' : 'opacity-30 pointer-events-none'}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `).join('');
        if (previewEl) previewEl.style.backgroundImage = buildVisualBgGradientCss(cfg.gradientStops, cfg.gradientAngleDeg); // core/visual-bg.js

        const addBtn = visualBgSettingsPanelEl.querySelector('#setting-visual-bg-gradient-add');
        if (addBtn) addBtn.classList.toggle('opacity-30', cfg.gradientStops.length >= VISUAL_BG_GRADIENT_MAX_STOPS);
    },

    /** Ghi 1 thay đổi thuộc nhóm MÀU + persist + vẽ lại nền. DÙNG CHUNG cho 5 method bên dưới —
     * chúng chỉ khác đúng phép gán, phần còn lại (persist + sơn lại nền + đồng bộ panel) y hệt. */
    async _commitColorChange(mutatorFn, logContent) {
        appConfigVisualBg.mutateAll(mutatorFn);
        console.log(`writer: "workflowVisualBg._commitColorChange", page: "visualBgConfig", content: "${logContent}"`);
        await this._persist();
        updateDOMBackground(); // core/color-utils.js — chủ sở hữu duy nhất của nền `#visualizer-solid-bg`
        await this.refreshPanelUI();
    },

    /** Ứng với select "Chế độ màu" (Đơn sắc / Chuyển sắc). */
    async changeColorMode(value) {
        if (!VISUAL_BG_COLOR_MODES.includes(value)) return; // guard: giá trị lạ
        await this._commitColorChange((cfg) => { cfg.colorMode = value; }, `colorMode=${value}`);
    },

    /** Ứng với ô chọn màu nền đơn sắc. */
    async changeSolidColor(value) {
        await this._commitColorChange((cfg) => { cfg.solidColor = value; }, `solidColor=${value}`);
    },

    /** Ứng với thanh trượt góc xoay gradient. */
    async changeGradientAngle(value) {
        const deg = Number(value);
        if (!Number.isFinite(deg)) return; // guard
        await this._commitColorChange((cfg) => { cfg.gradientAngleDeg = deg; }, `gradientAngleDeg=${deg}`);
    },

    /** Ứng với ô màu / thanh trượt vị trí của 1 chặng. */
    async changeGradientStop(index, field, value) {
        const parsed = field === 'position' ? Number(value) : value;
        if (field === 'position' && !Number.isFinite(parsed)) return; // guard
        await this._commitColorChange((cfg) => {
            if (!cfg.gradientStops[index]) return; // guard: hàng vừa bị xoá ở thao tác khác
            cfg.gradientStops[index] = { ...cfg.gradientStops[index], [field]: parsed };
        }, `gradientStops[${index}].${field}=${parsed}`);
    },

    /** Ứng với nút "Thêm chặng màu" — Core tự chặn khi đã đủ 7. */
    async addGradientStop() {
        await this._commitColorChange((cfg) => { cfg.gradientStops = addVisualBgGradientStop(cfg.gradientStops); }, 'gradientStops +1'); // core/visual-bg.js
    },

    /** Ứng với nút X của 1 chặng — Core tự chặn khi chỉ còn 2. */
    async removeGradientStop(index) {
        await this._commitColorChange((cfg) => { cfg.gradientStops = removeVisualBgGradientStop(cfg.gradientStops, index); }, `gradientStops -1 (index ${index})`); // core/visual-bg.js
    },

    /** Ứng với 'visualBg.clearSource.click' — GỠ nguồn của ĐÚNG tổ hợp hiện tại (3 field còn lại
     * giữ nguyên, đúng thiết kế "đổi qua đổi lại không mất lựa chọn trước"). Đây là đường DUY NHẤT
     * để người dùng thả 1 ảnh/video/album/folder ra khỏi Visual Background — Block gate chặn xoá
     * mọi thứ đang được tham chiếu, không có nút này là kẹt (xem event/block.js). */
    async clearCurrentSource() {
        const { mediaType, sourceMode } = appConfigVisualBg.getAll();
        const field = sourceMode === 'list'
            ? (mediaType === 'video' ? 'listFolderId' : 'listAlbumId')
            : (mediaType === 'video' ? 'singleVideoKey' : 'singleImageKey');
        const emptyValue = sourceMode === 'list' ? null : '';
        appConfigVisualBg.mutateAll((cfg) => { cfg[field] = emptyValue; });
        console.log(`writer: "workflowVisualBg.clearCurrentSource", page: "visualBgConfig", content: "${field}=null"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    /** Ghi tên nguồn đang chọn vào slot `#visual-bg-source-name` — tách riêng vì phải đọc DB
     * (async) trong khi phần còn lại của `refreshPanelUI()` là DOM đồng bộ. */
    async _refreshSourceNameLabel(cfg) {
        const labelEl = visualBgSettingsPanelEl ? visualBgSettingsPanelEl.querySelector('#visual-bg-source-name') : null;
        if (!labelEl) return;
        const ref = readVisualBgActiveSourceRef(cfg); // core/visual-bg.js
        const clearBtn = visualBgSettingsPanelEl.querySelector('#setting-visual-bg-clear-source');
        if (clearBtn) clearBtn.classList.toggle('hidden', !ref); // chỉ có nguồn mới gỡ được
        if (!ref) { labelEl.textContent = t('visualBgSettingsDrawer.pickSource.none'); return; }
        labelEl.textContent = await this._readSourceDisplayName(cfg.mediaType, cfg.sourceMode, ref);
    },

    /** Đọc TÊN hiển thị thật của 1 tham chiếu nguồn (imageKey/videoKey/albumId/folderId).
     * @returns {Promise<string>} tên hiển thị, hoặc nhãn "Chưa chọn" nếu tham chiếu mồ côi. */
    async _readSourceDisplayName(mediaType, sourceMode, ref) {
        const none = t('visualBgSettingsDrawer.pickSource.none');
        if (sourceMode === 'list' && mediaType === 'image') {
            const album = await getAlbumRecord(ref); // service/db.js
            return album ? album.name : none;
        }
        if (sourceMode === 'list' && mediaType === 'video') {
            const folder = await getFolderRecord(ref); // service/db.js
            return folder ? folder.name : none;
        }
        if (mediaType === 'video') {
            const record = await getVideoRecord(ref); // service/db.js
            return record ? (record.customName || stripFileExtension(record.filename)) : none; // core/file-manager/video.js
        }
        const record = await getImageRecord(ref); // service/db.js
        return record ? record.filename : none;
    },

    // ===================== Đếm item của nguồn LIST =====================

    /** Đếm số item THẬT của nguồn list đang chọn — 0 nếu chưa chọn/tham chiếu mồ côi. Workflow làm
     * (đọc DB), core chỉ nhận con số (Rule 2/3b). Dùng bởi `validateOnClose()`.
     * @param {object} cfg
     * @returns {Promise<number>}
     */
    async _countListSourceItems(cfg) {
        if (cfg.mediaType === 'video') {
            if (!cfg.listFolderId) return 0;
            const map = await getFolderSongMap(cfg.listFolderId); // service/db.js
            return map ? getFolderSongKeys(map).length : 0; // core/file-manager/folder.js — hàm thuần
        }
        if (!cfg.listAlbumId) return 0;
        const album = await getAlbumRecord(cfg.listAlbumId); // service/db.js
        return album && Array.isArray(album.imageKeys) ? album.imageKeys.length : 0;
    },

    // ===================== "Chọn nguồn" — 4 tổ hợp, 4 picker CÓ SẴN =====================
    // KHÔNG viết picker mới nào cho đợt này (phản hồi Giang) — cả 4 nhánh đều tái dùng hạ tầng đã
    // tồn tại, chỉ truyền THAM SỐ router/msgPrefix để chúng bắn message về đúng cụm này:
    //   image+single -> workflowFileManagerPhoto.openCoverImagePicker()   (picker ảnh bìa bài hát)
    //   video+single -> openPhotoImagePickerDrawerUi()                    (CÙNG khung drawer, khác selector tile)
    //   image+list   -> renderAlbumPickerGrid()/wireAlbumPickerDrawerActions()
    //   video+list   -> workflowPlaylist._openFolderPickerDrawer(onPick, 'video')
    // KHÔNG hàm picker nào được viết mới trong đợt này — 4 nhánh đều gọi thứ đã tồn tại, chỗ nào
    // chưa vừa thì THÊM THAM SỐ vào hàm cũ (router/msgPrefix/selector tile/typeFilter).
    // Router chọn nhánh nào bằng VirtualMachineState (rẽ theo state) — xem event/router/visual-bg.js.

    /** Hàm GỠ listener của picker Generic Drawer đang mở (null khi không có picker nào). */
    _pickerCleanup: null,

    /** Đóng picker Generic Drawer đang mở — DÙNG CHUNG cho mọi lối thoát (chọn xong/huỷ/bấm ngoài).
     * Gọi hàm GỠ TRƯỚC khi đóng: `genericDrawerOverlay`/`genericDrawerBody` là DOM TĨNH dùng chung
     * nhiều feature, không gỡ sẽ dính sang lần mở Drawer tiếp theo của feature khác. */
    _closePickerDrawer() {
        if (this._pickerCleanup) { this._pickerCleanup(); this._pickerCleanup = null; }
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
    },

    /** Ghi 1 field nguồn vừa chọn + persist + đồng bộ panel + áp lại nền — DÙNG CHUNG cho cả 4 nhánh.
     * @param {'singleImageKey'|'singleVideoKey'|'listAlbumId'|'listFolderId'} field
     * @param {string} value
     */
    async _commitPickedSource(field, value) {
        appConfigVisualBg.mutateAll((cfg) => { cfg[field] = value; });
        console.log(`writer: "workflowVisualBg._commitPickedSource", page: "visualBgConfig", content: "${field}=${value}"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    // ---- image + single ----

    /** TÁI DÙNG NGUYÊN picker "chọn ảnh bìa bài hát" — `workflowFileManagerPhoto.openCoverImagePicker()`
     * (event/workflow/file-manager-photo.js), đúng nghiệp vụ "chọn ĐÚNG 1 ảnh từ thư viện", đã có
     * sẵn session + Generic Drawer + windowing. Gọi chéo domain Workflow->Workflow, KHÔNG tự dựng
     * picker riêng. */
    openSingleImagePicker() {
        workflowFileManagerPhoto.openCoverImagePicker(
            (imageKey) => this._commitPickedSource('singleImageKey', imageKey),
            () => {}, // huỷ -> không đổi gì
        );
    },

    /** Picker "chọn 1 video": TÁI DÙNG khung Generic Drawer của picker ảnh
     * (`openPhotoImagePickerDrawerUi()`, core/file-manager/photo-ui.js) — cùng header/closeBtn/
     * delegated click, chỉ khác selector tile. Lưới video do `workflowVideoGalleryWindow` mount
     * (windowing theo ngày + revoke object URL đúng lúc). */
    async openSingleVideoPicker() {
        this._pickerCleanup = openMediaPickerDrawerUi('visualBg', 'visualBg.videoPicker', t('fileManager.video.pickerTitle'), `
            <div class="flex-1 min-h-0 overflow-y-auto relative" id="file-manager-video-picker-scroll">
                <p id="file-manager-video-picker-empty" class="hidden text-sm text-slate-400 text-center py-10 px-6">${t('fileManager.video.empty')}</p>
            </div>
        `, '.video-tile', 'videoKey', false); // core/file-manager/photo-ui.js

        await new Promise((resolve) => {
            genericDrawerPanel.addEventListener('transitionend', function onOpenTransitionEnd() {
                genericDrawerPanel.removeEventListener('transitionend', onOpenTransitionEnd);
                resolve();
            }, { once: true });
        });

        const videos = await listVideos(); // core/file-manager/video.js
        if (!this._pickerCleanup) return; // guard: người dùng đóng picker rất nhanh trong lúc đang đọc DB

        const scrollEl = genericDrawerBody.querySelector('#file-manager-video-picker-scroll');
        const emptyEl = genericDrawerBody.querySelector('#file-manager-video-picker-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', videos.length > 0);
        workflowVideoGalleryWindow.mount('genericDrawer', { scrollEl, videos, badgeMode: null, selectedKeys: new Set() }); // event/workflow/video-gallery-window.js
    },

    /** Ứng với 'visualBg.videoPicker.tile.click'. */
    async selectVideoFromPicker(videoKey) {
        workflowVideoGalleryWindow.unmount('genericDrawer'); // revoke object URL NGAY
        this._closePickerDrawer();
        await this._commitPickedSource('singleVideoKey', videoKey);
    },

    /** Ứng với 'visualBg.videoPicker.close.click' (nút X hoặc bấm ra ngoài) — huỷ, không đổi gì. */
    cancelVideoPicker() {
        workflowVideoGalleryWindow.unmount('genericDrawer');
        this._closePickerDrawer();
    },

    // ---- image + list (Album) ----

    /** TÁI DÙNG `renderAlbumPickerGrid()`/`wireAlbumPickerDrawerActions()` (core/file-manager/
     * photo-ui.js) — 2 hàm đó vừa được tham số hoá `routerName`/`msgPrefix` thay vì hardcode cụm
     * `slideshowSettings` cũ. LỌC `imageKeys.length >= VISUAL_BG_MIN_LIST_ITEMS` NGAY TẠI ĐÂY
     * (Giang chốt: album phải > 1 ảnh mới là 1 nguồn "danh sách" hợp lệ) — core lưới KHÔNG nhận
     * tham số lọc nào, Workflow đưa gì thì vẽ nấy (Rule 3b). */
    async openListAlbumPicker() {
        const [albums, images] = await Promise.all([listAlbums(), listImages()]); // core/file-manager/album.js + image.js
        const eligibleAlbums = albums.filter((a) => Array.isArray(a.imageKeys) && a.imageKeys.length >= VISUAL_BG_MIN_LIST_ITEMS); // core/visual-bg.js (hằng số)
        const imageRecordsByKey = new Map(images.map((img) => [img.key, img]));

        openGenericDrawer({ // core/generic-drawer.js
            zIndex: Z_INDEX.GENERIC_DRAWER,
            headerHtml: this._buildPickerHeaderHtml(t('visualBgSettingsDrawer.albumPicker.title')),
            bodyHtml: `
                <div id="visual-bg-album-picker-grid" class="grid grid-cols-3 gap-x-2 gap-y-5"></div>
                <p id="visual-bg-album-picker-empty" class="hidden text-sm text-slate-300 text-center py-8">${t('visualBgSettingsDrawer.albumPicker.empty')}</p>
            `,
            bodyClass: 'overflow-y-auto px-4 pb-6 pt-2',
        });
        this._pickerCleanup = wireAlbumPickerDrawerActions('visualBg', 'visualBg.albumPicker'); // core/file-manager/photo-ui.js

        const gridEl = genericDrawerBody.querySelector('#visual-bg-album-picker-grid');
        const emptyEl = genericDrawerBody.querySelector('#visual-bg-album-picker-empty');
        renderAlbumPickerGrid(gridEl, eligibleAlbums, appConfigVisualBg.getAll().listAlbumId, imageRecordsByKey, 'visualBg', 'visualBg.albumPicker'); // core/file-manager/photo-ui.js
        if (emptyEl) emptyEl.classList.toggle('hidden', eligibleAlbums.length > 0);
    },

    /** Ứng với 'visualBg.albumPicker.tile.click'. */
    async selectAlbumFromPicker(albumId) {
        this._closePickerDrawer();
        await this._commitPickedSource('listAlbumId', albumId);
    },

    /** Ứng với 'visualBg.albumPicker.cancel.click' (nút X hoặc bấm ra ngoài). */
    cancelAlbumPicker() {
        this._closePickerDrawer();
    },

    // ---- video + list (Folder type='video') ----

    /** TÁI DÙNG NGUYÊN `workflowPlaylist._openFolderPickerDrawer(onPick, typeFilter)` — grid folder
     * Generic Drawer đã có sẵn, 2 luồng "Thêm vào thư mục" của Playlist đang dùng chung, "chỉ khác
     * onPick callback". Truyền thêm `typeFilter='video'` (tham số MỚI, mặc định giữ hành vi cũ).
     * KHÔNG tự dựng Drawer/grid/wire nào ở đây. */
    async openListFolderPicker() {
        const folders = await listFolders(); // core/file-manager/folder.js
        const videoFolders = folders.filter((f) => f.type === 'video');
        // Đếm item THẬT của từng folder rồi CHỈ giữ folder đủ số tối thiểu — 1 folder có <=1 video
        // không phải nguồn "danh sách" hợp lệ (không có gì để chuyển sang), nên KHÔNG được bày ra
        // cho chọn. Lọc ở đây vì đây là tiêu chí riêng của miền này (Rule 3b).
        const counts = await Promise.all(videoFolders.map(async (f) => {
            const map = await getFolderSongMap(f.id); // service/db.js
            return map ? getFolderSongKeys(map).length : 0; // core/file-manager/folder.js — hàm thuần
        }));
        const eligible = videoFolders.filter((_, i) => counts[i] >= VISUAL_BG_MIN_LIST_ITEMS);

        await workflowPlaylist._openFolderPickerDrawer(
            (folderId) => this._commitPickedSource('listFolderId', folderId),
            {
                folders: eligible,
                showAddTile: false, // folder mới luôn rỗng -> không bao giờ hợp lệ ở đây
                emptyMsg: videoFolders.length === 0
                    ? t('visualBgSettingsDrawer.folderPicker.emptyNoFolder')
                    : tFormat('visualBgSettingsDrawer.folderPicker.emptyTooFew', { count: VISUAL_BG_MIN_LIST_ITEMS }),
            },
        );
    },

    // XOÁ (v13) — `selectFolderFromPicker()`/`cancelFolderPicker()` KHÔNG còn: picker folder giờ là
    // `workflowPlaylist._openFolderPickerDrawer()`, nó TỰ đóng Drawer và gọi `onPick(folderId)`,
    // không đi qua msg.type riêng của miền này (2 case tương ứng ở event/router/visual-bg.js cũng
    // đã xoá).

    /** Header Generic Drawer của picker Album — picker này tự `openGenericDrawer()` (khác 2 picker
     * kia: chúng dùng `openPhotoImagePickerDrawerUi()`/`_openFolderPickerDrawer()` đã tự dựng header
     * bên trong) nên vẫn cần khối header riêng ở đây.
     * @param {string} title
     */
    _buildPickerHeaderHtml(title) {
        return `
            <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                <h3 class="text-base font-bold text-slate-900">${title}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `;
    },

    // ===================== Đổi từng field =====================

    /** Ứng với toggle tổng "Bật Visual Background". */
    async changeEnabled(checked) {
        appConfigVisualBg.mutateAll((cfg) => { cfg.enabled = checked; });
        console.log(`writer: "workflowVisualBg.changeEnabled", page: "visualBgConfig", content: "enabled=${checked}"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
        if (typeof PlaylistMain !== 'undefined') await PlaylistMain.updateActiveFolderUI(); // core/playlist/main.js — khoá/mở select "Nguồn" NGAY, không đợi mở lại Settings
    },

    /** Ứng với select "Kiểu: Ảnh/Video". Nguồn của kiểu KIA giữ nguyên (không xoá) để đổi qua đổi
     * lại không mất lựa chọn trước đó — đúng thiết kế 4 field nguồn song song. */
    async changeMediaType(value) {
        if (!VISUAL_BG_MEDIA_TYPES.includes(value)) return; // guard: giá trị lạ
        appConfigVisualBg.mutateAll((cfg) => { cfg.mediaType = value; });
        console.log(`writer: "workflowVisualBg.changeMediaType", page: "visualBgConfig", content: "mediaType=${value}"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    /** Ứng với toggle "Danh sách" (off = 1 ảnh/video, on = danh sách). */
    async changeSourceMode(isList) {
        appConfigVisualBg.mutateAll((cfg) => { cfg.sourceMode = isList ? 'list' : 'single'; });
        console.log(`writer: "workflowVisualBg.changeSourceMode", page: "visualBgConfig", content: "sourceMode=${isList ? 'list' : 'single'}"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    /** Ứng với select "Cách phát" (chỉ hiện khi list + image). */
    async changeListPlaybackMode(value) {
        if (!VISUAL_BG_LIST_PLAYBACK_MODES.includes(value)) return; // guard: giá trị lạ
        appConfigVisualBg.mutateAll((cfg) => { cfg.listPlaybackMode = value; });
        console.log(`writer: "workflowVisualBg.changeListPlaybackMode", page: "visualBgConfig", content: "listPlaybackMode=${value}"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    /** Ứng với select "Thứ tự kế tiếp" (chỉ hiện khi sourceMode='list').
     * SỬA (v13 Batch C) — phải ÁP LẠI nền sau khi đổi: `nextOrder` quyết định THỨ TỰ danh sách được
     * dựng (xem workflowSlideshow.refreshImages()), không phải chỉ 1 tham số đọc lúc chạy — đổi mà
     * không dựng lại thì lượt kế tiếp vẫn đi theo thứ tự cũ. */
    async changeNextOrder(value) {
        if (!VISUAL_BG_NEXT_ORDERS.includes(value)) return; // guard: giá trị lạ
        appConfigVisualBg.mutateAll((cfg) => { cfg.nextOrder = value; });
        console.log(`writer: "workflowVisualBg.changeNextOrder", page: "visualBgConfig", content: "nextOrder=${value}"`);
        await this._persist();
        await this.applyCurrentVisualBg();
    },
};
