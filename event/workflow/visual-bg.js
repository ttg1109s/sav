/**
 * event/workflow/visual-bg.js — Workflow domain "Visual Background" (v14, source hợp nhất 1 mảng).
 * Xung đột Video Player mode <-> Visual Background giải quyết bằng `clearMediaLayers()` (PUBLIC,
 * gọi chéo domain từ event/workflow/video-player.js lúc vào mode) + `applyCurrentVisualBg()` (gọi
 * lại lúc thoát) — KHÔNG còn Block gate chặn 2 chiều nào cho cặp này (Giang chốt).
 *
 * NẠP SAU: core/config.js, core/visual-bg.js, core/color-utils.js, service/db.js, service/state.js.
 * NẠP TRƯỚC: event/router/visual-bg.js.
 */
let visualBgSettingsPanelEl = null;
let visualBgGradientPanelEl = null;

/** Task của nhánh video khi `listPlaybackMode='slideshow'` (đổi video theo chu kỳ giây). */
const VISUAL_BG_VIDEO_TASK = 'visualBgVideoRotate';

const workflowVisualBg = {
    _listIndex: -1,            // vị trí hiện tại trong `source.list` — CHỈ dùng cho nhánh video ở đây
    _colorPersistTimer: null,
    _forcedBgThumbUrl: null,   // object URL thumb che tạm lúc đổi/nạp video

    // ===================== Boot / persist =====================

    /** Đọc lại `meta.visualBgConfig` + áp nền — gọi 1 lần lúc boot, SAU loadConfig(). */
    async loadPersistedSettingsOnBoot() {
        const saved = await getMeta('visualBgConfig'); // service/db.js
        if (saved && typeof saved === 'object') {
            appConfigVisualBg.mutateAll((cfg) => {
                if (VISUAL_BG_TYPES.includes(saved.type)) cfg.type = saved.type;
                if (saved.source && typeof saved.source === 'object') {
                    if (saved.source.originKind === null || ['single', 'group'].includes(saved.source.originKind)) cfg.source.originKind = saved.source.originKind;
                    if (saved.source.originId === null || typeof saved.source.originId === 'string') cfg.source.originId = saved.source.originId;
                    if (Array.isArray(saved.source.list)) cfg.source.list = saved.source.list.filter((k) => k === null || typeof k === 'string');
                }
                if (VISUAL_BG_LIST_PLAYBACK_MODES.includes(saved.listPlaybackMode)) cfg.listPlaybackMode = saved.listPlaybackMode;
                if (VISUAL_BG_NEXT_ORDERS.includes(saved.nextOrder)) cfg.nextOrder = saved.nextOrder;
                if (VISUAL_BG_COLOR_MODES.includes(saved.colorMode)) cfg.colorMode = saved.colorMode;
                if (typeof saved.solidColor === 'string') cfg.solidColor = saved.solidColor;
                if (typeof saved.gradientAngleDeg === 'number') cfg.gradientAngleDeg = saved.gradientAngleDeg;
                if (Array.isArray(saved.gradientStops) && saved.gradientStops.length >= VISUAL_BG_GRADIENT_MIN_STOPS && saved.gradientStops.length <= VISUAL_BG_GRADIENT_MAX_STOPS) cfg.gradientStops = saved.gradientStops;
                if (saved.slideshow && typeof saved.slideshow === 'object') {
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
            console.log(`writer: "workflowVisualBg.loadPersistedSettingsOnBoot", page: "visualBgConfig", content: "nạp lại từ meta"`);
        }
        // KHÔNG await ở đây (fix bug boot chặn playlist, mục 4) — applyCurrentVisualBg() cho nhánh
        // video tự nạp/phát nền ngầm, không giữ chuỗi boot() phía app-boot.js chờ nó.
        this.applyCurrentVisualBg();
    },

    async _persist() {
        await setMeta('visualBgConfig', appConfigVisualBg.getAll()); // service/db.js
    },

    /** Sửa 1 field con `slideshow` + persist — dùng bởi workflowSlideshow (panel "Tuỳ chỉnh Trình
     * chiếu", config sống ở domain này, liên tuyến domain Workflow->Workflow). */
    async mutateSlideshowSetting(mutatorFn, logContent) {
        appConfigVisualBg.mutateAll((cfg) => { mutatorFn(cfg.slideshow); });
        console.log(`writer: "workflowVisualBg.mutateSlideshowSetting", page: "visualBgConfig", content: "slideshow.${logContent}"`);
        await this._persist();
    },

    // ===================== Áp dụng nền =====================

    /** Số item CÒN SỐNG trong `source.list` (loại null) — 3 trạng thái suy ra từ số này: 0 = ẩn
     * media, 1 = phát tĩnh, >1 = cycle. */
    _effectiveCount(cfg) {
        return cfg.source.list.filter((k) => k !== null).length;
    },

    /** Điểm đồng bộ DUY NHẤT giữa config và DOM — gọi lúc boot + sau mọi thay đổi. Màu LUÔN sơn
     * (kể cả media rỗng); media chỉ áp khi `source.list` còn ít nhất 1 item sống. */
    async applyCurrentVisualBg() {
        this.clearMediaLayers();
        updateDOMBackground(); // core/color-utils.js — độc lập, luôn vẽ
        const cfg = appConfigVisualBg.getAll();
        const count = this._effectiveCount(cfg);
        if (count === 0) return; // guard: chưa có nguồn/nguồn rỗng -> chỉ còn màu
        if (cfg.type === 'video') return this._applyVideo(cfg);
        return this._applyPhoto(cfg);
    },

    /** Dọn sạch lớp media đang hiện (video + ảnh dự phòng) — gọi TRƯỚC mọi lần áp lại. PUBLIC
     * (không dấu `_`) — `workflowVideoPlayer` cũng gọi được lúc vào Video Player mode, để nhường
     * `bgVideoElement` (liên tuyến domain, KHÔNG đụng `visualBgConfig` đã lưu — chỉ dọn DOM/task/
     * object URL runtime, resume lại nguyên vẹn lúc thoát Video Player mode qua
     * `applyCurrentVisualBg()`). */
    clearMediaLayers() {
        const { visualBgVideoObjectUrl, visualBgImageObjectUrl } = appState.get(['visualBgVideoObjectUrl', 'visualBgImageObjectUrl']);
        if (typeof workflowSlideshow !== 'undefined') workflowSlideshow.stop();
        taskManager.kill(VISUAL_BG_VIDEO_TASK);
        this._listIndex = -1;
        if (this._forcedBgThumbUrl) { revokeBlobUrl(this._forcedBgThumbUrl); this._forcedBgThumbUrl = null; }
        hideVisualBgVideoElement(); // core/visual-bg.js
        applyVisualBgImageToDOM(false, ''); // core/visual-bg.js
        if (visualBgVideoObjectUrl) revokeBlobUrl(visualBgVideoObjectUrl);
        if (visualBgImageObjectUrl) revokeBlobUrl(visualBgImageObjectUrl);
        appState.set('visualBgVideoObjectUrl', '');
        appState.set('visualBgImageObjectUrl', '');
    },

    /** list.length<=1 -> áp tĩnh trực tiếp (không qua engine ảnh); >1 -> giao cho
     * `workflowSlideshow` (transition/Ken Burns, đọc DB theo key khi cần). */
    async _applyPhoto(cfg) {
        const list = cfg.source.list;
        if (list.length <= 1) {
            if (list[0]) await this._playSinglePhotoKey(list[0]);
            return;
        }
        if (typeof workflowSlideshow !== 'undefined') await workflowSlideshow.startFromList(list, cfg.nextOrder);
    },

    /** Nguồn duy nhất mất (record không đọc được) -> không có gì để chờ advance() tiếp, tự chữa
     * lành hẳn (gỡ source) luôn thay vì đánh dấu null. */
    async _playSinglePhotoKey(imageKey) {
        const record = await getImageRecord(imageKey); // service/db.js
        if (!record || !record.blob) { await this.clearSource(); return; }
        const objectUrl = createBlobUrl(record.blob); // service/blob-url.js
        appState.set('visualBgImageObjectUrl', objectUrl);
        applyVisualBgImageToDOM(true, objectUrl); // core/visual-bg.js
    },

    async _applyVideo(cfg) {
        const list = cfg.source.list;
        if (list.length <= 1) {
            if (list[0]) { this._listIndex = 0; await this._playVideoKey(list[0]); }
            return;
        }
        this._listIndex = cfg.nextOrder === 'random'
            ? pickNextSlideshowIndexRandom(-1, list.length)      // core/file-manager/slideshow.js
            : pickNextSlideshowIndexSequential(-1, list.length); // core/file-manager/slideshow.js
        await this._playVideoKey(list[this._listIndex]);
        if (cfg.listPlaybackMode === 'slideshow') {
            taskManager.addNew(VISUAL_BG_VIDEO_TASK, { time: cfg.slideshow.intervalSeconds * 1000, exe: () => this._advanceVideo(), mode: 'timeout', count: 0 }); // service/task-manager.js
            taskManager.operator(VISUAL_BG_VIDEO_TASK, 'enabled');
        }
    },

    /** Ứng với bài hát đổi thật ('visualBg.songChanged', router) khi type='video' + perSong. */
    async advanceForSongChange() {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type !== 'video' || cfg.listPlaybackMode !== 'perSong') return;
        await this._advanceVideo();
    },

    /** 1 nhịp cycle nhánh video: bước index (dọn null nếu vừa hết 1 vòng) rồi phát/ẩn theo kết quả.
     * list.length<=1 -> không cycle (phát tĩnh, xem `_applyVideo`). */
    async _advanceVideo() {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.source.list.length <= 1) return;
        const { list, index } = advanceVisualBgList(cfg.source.list, this._listIndex, cfg.nextOrder === 'random'); // core/visual-bg.js
        if (index === -1) { await this.selfHealEmptySource(); return; }
        if (list !== cfg.source.list) {
            appConfigVisualBg.mutateAll((c) => { c.source.list = list; });
            await this._persist();
        }
        this._listIndex = index;
        const key = list[index];
        if (!key) { this._hideVideoOnly(); return; } // null -> ẩn, chờ advance() lần sau
        await this._playVideoKey(key);
        if (list.length === 1) taskManager.kill(VISUAL_BG_VIDEO_TASK); // sweep vừa đưa về 1 item -> dừng cycle
    },

    /** Chỉ ẩn video (KHÔNG đụng task/index) — dùng khi item hiện tại là null giữa lúc đang cycle. */
    _hideVideoOnly() {
        hideVisualBgVideoElement(); // core/visual-bg.js
        if (this._forcedBgThumbUrl) { revokeBlobUrl(this._forcedBgThumbUrl); this._forcedBgThumbUrl = null; }
    },

    /**
     * Nạp/đổi video nền: che bằng thumb full-res TRƯỚC, đổi src, đợi 'playing' để gỡ thumb —
     * KHÔNG AWAIT đoạn đợi này (fix bug boot chặn playlist, mục 4: thumb đứng yên tới khi video
     * thật sự sẵn sàng, không chặn gì phía gọi). Dùng CHUNG cho áp lần đầu (boot/chọn nguồn) LẪN
     * đổi giữa phiên — trước đây tách 2 hàm vì chỉ lúc đổi giữa phiên mới cần che thumb, giờ boot
     * cũng cần nên gộp làm 1.
     * @param {string} videoKey
     */
    async _playVideoKey(videoKey) {
        const record = await getVideoRecord(videoKey); // service/db.js
        if (!record || !record.blob) { await this._markCurrentMissing(); return; }

        bgVideoElement.pause();
        if (record.thumbFullBlob) {
            const thumbUrl = await decodeForcedBgThumb(record.thumbFullBlob); // core/video-player.js
            if (this._forcedBgThumbUrl) revokeBlobUrl(this._forcedBgThumbUrl);
            this._forcedBgThumbUrl = thumbUrl;
            applyVisualBgImageToDOM(true, thumbUrl); // core/visual-bg.js
        }

        const previousObjectUrl = appState.get('visualBgVideoObjectUrl');
        const objectUrl = createBlobUrl(record.blob); // service/blob-url.js
        appState.set('visualBgVideoObjectUrl', objectUrl);
        updateDOMBackground(); // core/color-utils.js
        showVisualBgVideoElement(objectUrl, appState.get('visualBgVideoLoadedUrl')); // core/visual-bg.js
        syncVisualBgVideoPlayback(audioPlayer.paused); // core/visual-bg.js

        let swapped = false;
        const finishSwap = () => {
            if (swapped) return;
            swapped = true;
            if (previousObjectUrl) revokeBlobUrl(previousObjectUrl);
            if (this._forcedBgThumbUrl) { applyVisualBgImageToDOM(false, ''); revokeBlobUrl(this._forcedBgThumbUrl); this._forcedBgThumbUrl = null; }
        };
        bgVideoElement.addEventListener('playing', finishSwap, { once: true });
        // Backstop KHÔNG chặn (không await) — chỉ để tránh rò object URL/thumb kẹt mãi nếu 'playing'
        // không bao giờ bắn (autoplay bị chặn/định dạng lạ).
        taskManager.once(finishSwap, 2000, 'visualBgVideoPlayingFallback'); // service/task-manager.js
    },

    /** Đánh dấu vị trí hiện tại là mất + ẩn — KHÔNG reset index/task, chờ advance() lần sau tự bước
     * tiếp (Giang chốt, cơ chế null-sweep). Dọn xong mà KHÔNG còn item sống nào -> tự chữa lành hẳn
     * (gỡ source) luôn, không đợi advance() phát hiện ra ở lượt sau. */
    async _markCurrentMissing() {
        const newList = markVisualBgListItemMissing(appConfigVisualBg.getAll().source.list, this._listIndex); // core/visual-bg.js
        if (newList.filter((k) => k !== null).length === 0) { await this.clearSource(); return; }
        appConfigVisualBg.mutateAll((cfg) => { cfg.source.list = newList; });
        console.log(`writer: "workflowVisualBg._markCurrentMissing", page: "visualBgConfig", content: "source.list[${this._listIndex}]=null"`);
        await this._persist();
        this._hideVideoOnly();
    },

    /** `source.list` rỗng sau sweep -> tự gỡ hẳn nguồn (cùng hành vi nút "Gỡ nguồn" thủ công). PUBLIC
     * (không dấu `_`) — `workflowSlideshow` cũng gọi được (liên tuyến domain, nguồn sự thật vẫn ở
     * domain này). */
    async selfHealEmptySource() {
        console.log(`writer: "workflowVisualBg.selfHealEmptySource", page: "visualBgConfig", content: "source rỗng sau sweep -> tự gỡ"`);
        await this.clearSource();
    },

    /** `workflowSlideshow` gọi khi tự sweep/mark-null mảng ảnh lúc cycle — nguồn sự thật `source.list`
     * vẫn thuộc domain này (Rule ownership), nơi kia chỉ BÁO thay đổi lại. */
    async persistSourceListMutation(list) {
        appConfigVisualBg.mutateAll((cfg) => { cfg.source.list = list; });
        await this._persist();
    },

    /** Đồng bộ play/pause video nền theo nhạc — gọi từ core/player-controls.js + mỗi lần Next/Prev. */
    syncPlaybackToAudio() {
        syncVisualBgVideoPlayback(audioPlayer.paused); // core/visual-bg.js
    },

    // ===================== Chọn / Làm tươi / Gỡ nguồn =====================

    /** Đọc key THẬT của 1 origin tại thời điểm gọi — 1 key (single) hay N key (group), đã sắp theo
     * `nextOrder`. Không cache.
     * @param {'photo'|'video'} type
     * @param {'single'|'group'} originKind
     * @param {string} originId
     * @returns {Promise<string[]>}
     */
    async _readOriginKeys(type, originKind, originId) {
        if (originKind === 'single') return originId ? [originId] : [];
        if (type === 'video') {
            const map = await getFolderSongMap(originId); // service/db.js
            return this._applyNextOrderToKeys(type, map ? getFolderSongKeys(map) : []); // core/file-manager/folder.js
        }
        const album = await getAlbumRecord(originId); // service/db.js
        return this._applyNextOrderToKeys(type, album && Array.isArray(album.imageKeys) ? album.imageKeys.slice() : []);
    },

    /** Sắp `keys` theo `nextOrder` hiện tại — 'sequential'/'random' giữ nguyên thứ tự gốc (random tự
     * bốc mỗi lượt advance, không cần sắp trước); 'playlist' đọc thêm record để áp
     * `appConfigPlaylist.displaySortMode`. */
    async _applyNextOrderToKeys(type, keys) {
        if (appConfigVisualBg.getAll().nextOrder !== 'playlist' || keys.length === 0) return keys;
        const records = await Promise.all(keys.map((k) => (type === 'video' ? getVideoRecord(k) : getImageRecord(k)))); // service/db.js
        const items = keys.map((k, i) => ({
            key: k,
            name: records[i] ? (type === 'video' ? (records[i].customName || stripFileExtension(records[i].filename)) : records[i].filename) : k, // core/file-manager/video.js
            addedAt: records[i] ? records[i].addedAt : 0,
        }));
        const mode = appConfigPlaylist.getAll().displaySortMode;
        const sorted = (mode === 'newest' || mode === 'oldest') ? sortVisualBgItemsByAddedAt(items, mode === 'newest') : sortVisualBgItemsByName(items, mode === 'za'); // core/visual-bg.js
        return sorted.map((it) => it.key);
    },

    /** Lối tắt "Dùng làm nền Slideshow" từ thanh quản lý Album — đặt `type='photo'` + nguồn = album
     * vừa chọn trong 1 lần gọi. Gọi chéo domain từ event/workflow/file-manager-photo.js.
     * @param {string} albumId
     */
    async applyAlbumAsBackground(albumId) {
        appConfigVisualBg.mutateAll((cfg) => { cfg.type = 'photo'; });
        await this._resolveAndCommitSource('group', albumId);
    },

    /** Đọc lại origin + ghi đè `source.list` — dùng CHUNG cho lúc CHỌN nguồn lẫn bấm "Làm tươi".
     * Origin đọc ra rỗng (album/folder/ảnh/video không còn tồn tại) -> gỡ hẳn (Giang chốt mục 2).
     * @param {'single'|'group'} originKind
     * @param {string} originId
     */
    async _resolveAndCommitSource(originKind, originId) {
        const cfg = appConfigVisualBg.getAll();
        const keys = await this._readOriginKeys(cfg.type, originKind, originId);
        if (keys.length === 0) { await this.clearSource(); return; }
        appConfigVisualBg.mutateAll((c) => {
            c.source.originKind = originKind;
            c.source.originId = originId;
            c.source.list = keys;
        });
        console.log(`writer: "workflowVisualBg._resolveAndCommitSource", page: "visualBgConfig", content: "source=${originKind}:${originId}, count=${keys.length}"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    /** Ứng nút "Làm tươi" — đọc lại ĐÚNG origin đã lưu, ghi đè `source.list`. */
    async refreshSource() {
        const { originKind, originId } = appConfigVisualBg.getAll().source;
        if (!originKind || !originId) return; // guard: chưa có nguồn
        await this._resolveAndCommitSource(originKind, originId);
    },

    /** Gỡ hẳn nguồn hiện tại — về "chưa chọn" (đường DUY NHẤT, không còn Block gate chặn xoá ảnh/
     * video/album/folder — Batch 3). */
    async clearSource() {
        appConfigVisualBg.mutateAll((cfg) => { cfg.source = { originKind: null, originId: null, list: [] }; });
        console.log(`writer: "workflowVisualBg.clearSource", page: "visualBgConfig", content: "source=cleared"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    /** Ứng select "Kiểu: Ảnh/Video" — chỉ 1 đường source (Giang chốt), đổi type = gỡ hẳn source cũ
     * (key khác kiểu vô nghĩa ở type mới), chọn lại từ đầu. */
    async changeType(value) {
        if (!VISUAL_BG_TYPES.includes(value)) return;
        appConfigVisualBg.mutateAll((cfg) => { cfg.type = value; cfg.source = { originKind: null, originId: null, list: [] }; });
        console.log(`writer: "workflowVisualBg.changeType", page: "visualBgConfig", content: "type=${value} (gỡ source cũ)"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    /** Ứng select "Cách phát" (chỉ có ý nghĩa khi list.length > 1). */
    async changeListPlaybackMode(value) {
        if (!VISUAL_BG_LIST_PLAYBACK_MODES.includes(value)) return;
        appConfigVisualBg.mutateAll((cfg) => { cfg.listPlaybackMode = value; });
        console.log(`writer: "workflowVisualBg.changeListPlaybackMode", page: "visualBgConfig", content: "listPlaybackMode=${value}"`);
        await this._persist();
        await this.applyCurrentVisualBg();
    },

    /** Ứng select "Thứ tự kế tiếp" — origin là group thì dựng lại `source.list` theo thứ tự mới
     * ngay (đọc lại origin, như 1 lượt Làm tươi); origin single thì thứ tự không có ý nghĩa. */
    async changeNextOrder(value) {
        if (!VISUAL_BG_NEXT_ORDERS.includes(value)) return;
        appConfigVisualBg.mutateAll((cfg) => { cfg.nextOrder = value; });
        console.log(`writer: "workflowVisualBg.changeNextOrder", page: "visualBgConfig", content: "nextOrder=${value}"`);
        await this._persist();
        const { originKind, originId } = appConfigVisualBg.getAll().source;
        if (originKind === 'group') await this._resolveAndCommitSource(originKind, originId);
        else await this.applyCurrentVisualBg();
    },

    // ===================== Panel màu (độc lập, luôn active) =====================

    _commitColorChange(mutatorFn, logContent) {
        appConfigVisualBg.mutateAll(mutatorFn);
        console.log(`writer: "workflowVisualBg._commitColorChange", page: "visualBgConfig", content: "${logContent}"`);
        updateDOMBackground(); // core/color-utils.js
        clearTimeout(this._colorPersistTimer);
        this._colorPersistTimer = setTimeout(() => this._persist(), 300);
    },

    async changeColorMode(value) {
        if (!VISUAL_BG_COLOR_MODES.includes(value)) return;
        appConfigVisualBg.mutateAll((cfg) => { cfg.colorMode = value; });
        console.log(`writer: "workflowVisualBg.changeColorMode", page: "visualBgConfig", content: "colorMode=${value}"`);
        updateDOMBackground();
        await this._persist();
        await this.refreshPanelUI();
    },

    changeSolidColor(value) {
        this._commitColorChange((cfg) => { cfg.solidColor = value; }, `solidColor=${value}`);
    },

    changeGradientAngle(value) {
        const deg = Number(value);
        if (!Number.isFinite(deg)) return;
        this._commitColorChange((cfg) => { cfg.gradientAngleDeg = deg; }, `gradientAngleDeg=${deg}`);
        if (!visualBgGradientPanelEl) return;
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-angle-value').textContent = `${deg}°`;
        this._paintGradientPreview(appConfigVisualBg.getAll());
    },

    changeGradientStop(index, field, value) {
        const parsed = field === 'position' ? Number(value) : value;
        if (field === 'position' && !Number.isFinite(parsed)) return;
        this._commitColorChange((cfg) => {
            if (!cfg.gradientStops[index]) return; // guard: hàng vừa bị xoá ở thao tác khác
            cfg.gradientStops[index] = { ...cfg.gradientStops[index], [field]: parsed };
        }, `gradientStops[${index}].${field}=${parsed}`);
        if (!visualBgGradientPanelEl) return;
        if (field === 'position') visualBgGradientPanelEl.querySelector(`[data-visual-bg-stop-label="${index}"]`).textContent = `${parsed}%`;
        this._paintGradientPreview(appConfigVisualBg.getAll());
    },

    addGradientStop() {
        this._commitColorChange((cfg) => { cfg.gradientStops = addVisualBgGradientStop(cfg.gradientStops); }, 'gradientStops +1'); // core/visual-bg.js
        if (!visualBgGradientPanelEl) return;
        const cfg = appConfigVisualBg.getAll();
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);
    },

    removeGradientStop(index) {
        this._commitColorChange((cfg) => { cfg.gradientStops = removeVisualBgGradientStop(cfg.gradientStops, index); }, `gradientStops -1 (index ${index})`); // core/visual-bg.js
        if (!visualBgGradientPanelEl) return;
        const cfg = appConfigVisualBg.getAll();
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);
    },

    openGradientPanel() {
        visualBgGradientPanelEl = pushSettingsPanel({ title: t('visualBgSettingsDrawer.openGradient.label'), bodyHtml: renderVisualBgGradientPanelBody() }); // core/settings-panel-stack-ui.js
        const cfg = appConfigVisualBg.getAll();
        visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-angle').value = cfg.gradientAngleDeg;
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-angle-value').textContent = `${cfg.gradientAngleDeg}°`;
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);
    },

    _renderGradientStopRows(stops) {
        const listEl = visualBgGradientPanelEl.querySelector('#visual-bg-gradient-stop-list');
        const canRemove = stops.length > VISUAL_BG_GRADIENT_MIN_STOPS; // core/visual-bg.js
        listEl.innerHTML = stops.map((stop, i) => `
            <div class="flex items-center gap-2">
                <div class="w-7 h-7 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" data-visual-bg-stop-color="${i}" value="${stop.color}" class="w-11 h-11 -m-2 cursor-pointer bg-transparent border-0"></div>
                <input type="range" data-visual-bg-stop-position="${i}" min="0" max="100" step="1" value="${stop.position}" class="flex-1 accent-sky-500">
                <span data-visual-bg-stop-label="${i}" class="text-xs text-slate-400 w-10 text-right tabular-nums">${stop.position}%</span>
                <button type="button" data-visual-bg-stop-remove="${i}" class="w-7 h-7 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors shrink-0 ${canRemove ? '' : 'opacity-30 pointer-events-none'}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `).join('');
        visualBgGradientPanelEl.querySelector('#setting-visual-bg-gradient-add').classList.toggle('opacity-30', stops.length >= VISUAL_BG_GRADIENT_MAX_STOPS); // core/visual-bg.js
    },

    _paintGradientPreview(cfg) {
        visualBgGradientPanelEl.querySelector('#visual-bg-gradient-preview').style.backgroundImage = buildVisualBgGradientCss(cfg.gradientStops, cfg.gradientAngleDeg); // core/visual-bg.js
    },

    // ===================== Panel Settings =====================

    async openPanel() {
        visualBgSettingsPanelEl = pushSettingsPanel({ title: t('visualBgSettingsDrawer.title'), bodyHtml: renderVisualBgPanelBody() }); // core/settings-panel-stack-ui.js
        await this.refreshPanelUI();
    },

    /** Đồng bộ UI panel theo config hiện tại — gọi lúc mở panel + sau mọi thay đổi field. */
    async refreshPanelUI() {
        if (!visualBgSettingsPanelEl) return;
        const cfg = appConfigVisualBg.getAll();
        const q = (sel) => visualBgSettingsPanelEl.querySelector(sel);

        const typeSelect = q('#setting-visual-bg-type');
        if (typeSelect) typeSelect.value = cfg.type;

        // Nhãn 2 nút Chọn phải đúng ngữ cảnh Ảnh/Video (Giang chốt) — gán qua DOM API (Rule 5d),
        // không phải data-i18n tĩnh vì phụ thuộc `cfg.type`.
        const pickSingleBtn = q('#setting-visual-bg-pick-single');
        const pickGroupBtn = q('#setting-visual-bg-pick-group');
        if (pickSingleBtn) pickSingleBtn.textContent = t(cfg.type === 'video' ? 'visualBgSettingsDrawer.pickSingle.video' : 'visualBgSettingsDrawer.pickSingle.photo');
        if (pickGroupBtn) pickGroupBtn.textContent = t(cfg.type === 'video' ? 'visualBgSettingsDrawer.pickGroup.video' : 'visualBgSettingsDrawer.pickGroup.photo');

        const listPlaybackSelect = q('#setting-visual-bg-list-playback-mode');
        const listPlaybackRow = q('#visual-bg-list-playback-row');
        const nextOrderRow = q('#visual-bg-next-order-row');
        const nextOrderSelect = q('#setting-visual-bg-next-order');
        const slideshowRow = q('#setting-visual-bg-open-slideshow');
        if (listPlaybackSelect) listPlaybackSelect.value = cfg.listPlaybackMode;
        if (nextOrderSelect) nextOrderSelect.value = cfg.nextOrder;

        const count = this._effectiveCount(cfg);
        const isList = count > 1;
        const isListPhoto = isList && cfg.type === 'photo';
        if (listPlaybackRow) listPlaybackRow.classList.toggle('hidden', !isList);
        if (nextOrderRow) nextOrderRow.classList.toggle('hidden', !isList);
        if (slideshowRow) slideshowRow.classList.toggle('hidden', !(isListPhoto && cfg.listPlaybackMode === 'slideshow'));

        const colorModeSelect = q('#setting-visual-bg-color-mode');
        const openGradientBtn = q('#setting-visual-bg-open-gradient');
        const solidColorRow = q('#visual-bg-solid-color-row');
        const solidColorInput = q('#setting-visual-bg-solid-color');
        const gradientSwatch = q('#visual-bg-gradient-swatch');
        const isGradient = cfg.colorMode === 'gradient';
        if (colorModeSelect) colorModeSelect.value = cfg.colorMode;
        if (solidColorRow) solidColorRow.classList.toggle('hidden', isGradient);
        if (openGradientBtn) openGradientBtn.classList.toggle('hidden', !isGradient);
        if (solidColorInput) solidColorInput.value = cfg.solidColor;
        if (gradientSwatch) gradientSwatch.style.backgroundImage = buildVisualBgGradientCss(cfg.gradientStops, cfg.gradientAngleDeg); // core/visual-bg.js

        await this._refreshSourceNameLabel(cfg);
    },

    /** Ghi tên nguồn đang chọn vào `#visual-bg-source-name` + hiện/ẩn nút Làm tươi/Gỡ nguồn theo
     * có origin hay không. */
    async _refreshSourceNameLabel(cfg) {
        const labelEl = visualBgSettingsPanelEl ? visualBgSettingsPanelEl.querySelector('#visual-bg-source-name') : null;
        const refreshBtn = visualBgSettingsPanelEl ? visualBgSettingsPanelEl.querySelector('#setting-visual-bg-refresh-source') : null;
        const clearBtn = visualBgSettingsPanelEl ? visualBgSettingsPanelEl.querySelector('#setting-visual-bg-clear-source') : null;
        const { originKind, originId } = cfg.source;
        if (refreshBtn) refreshBtn.classList.toggle('hidden', !originId);
        if (clearBtn) clearBtn.classList.toggle('hidden', !originId);
        if (!labelEl) return;
        if (!originId) { labelEl.textContent = t('visualBgSettingsDrawer.pickSource.none'); return; }
        labelEl.textContent = await this._readSourceDisplayName(cfg.type, originKind, originId);
    },

    /** Đọc tên hiển thị thật của 1 origin (imageKey/videoKey/albumId/folderId). */
    async _readSourceDisplayName(type, originKind, originId) {
        const none = t('visualBgSettingsDrawer.pickSource.none');
        if (originKind === 'group' && type === 'photo') {
            const album = await getAlbumRecord(originId); // service/db.js
            return album ? album.name : none;
        }
        if (originKind === 'group' && type === 'video') {
            const folder = await getFolderRecord(originId); // service/db.js
            return folder ? folder.name : none;
        }
        if (type === 'video') {
            const record = await getVideoRecord(originId); // service/db.js
            return record ? (record.customName || stripFileExtension(record.filename)) : none; // core/file-manager/video.js
        }
        const record = await getImageRecord(originId); // service/db.js
        return record ? record.filename : none;
    },

    // ===================== "Chọn nguồn" — 4 tổ hợp, picker CÓ SẴN =====================
    // Giữ NGUYÊN 4 picker đã có (Batch 2 sẽ nối lại router/msg.type gọi vào) — chỉ đổi hàm COMMIT
    // cuối cùng sang `_resolveAndCommitSource(originKind, originId)`.

    _pickerCleanup: null,

    _closePickerDrawer() {
        if (this._pickerCleanup) { this._pickerCleanup(); this._pickerCleanup = null; }
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
    },

    /** photo + single — tái dùng picker "chọn ảnh bìa bài hát" đã có sẵn. */
    openSingleImagePicker() {
        workflowFileManagerPhoto.openCoverImagePicker(
            (imageKey) => this._resolveAndCommitSource('single', imageKey),
            () => {},
        );
    },

    /** video + single. */
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
        if (!this._pickerCleanup) return; // guard: đóng picker rất nhanh trong lúc đang đọc DB

        const scrollEl = genericDrawerBody.querySelector('#file-manager-video-picker-scroll');
        const emptyEl = genericDrawerBody.querySelector('#file-manager-video-picker-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', videos.length > 0);
        workflowVideoGalleryWindow.mount('genericDrawer', { scrollEl, videos, badgeMode: null, selectedKeys: new Set() }); // event/workflow/video-gallery-window.js
    },

    async selectVideoFromPicker(videoKey) {
        workflowVideoGalleryWindow.unmount('genericDrawer');
        this._closePickerDrawer();
        await this._resolveAndCommitSource('single', videoKey);
    },

    cancelVideoPicker() {
        workflowVideoGalleryWindow.unmount('genericDrawer');
        this._closePickerDrawer();
    },

    /** photo + group (Album). */
    async openListAlbumPicker() {
        const [albums, images] = await Promise.all([listAlbums(), listImages()]); // core/file-manager/album.js + image.js
        const eligibleAlbums = albums.filter((a) => Array.isArray(a.imageKeys) && a.imageKeys.length >= VISUAL_BG_MIN_LIST_ITEMS); // core/visual-bg.js
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
        renderAlbumPickerGrid(gridEl, eligibleAlbums, appConfigVisualBg.getAll().source.originId, imageRecordsByKey, 'visualBg', 'visualBg.albumPicker'); // core/file-manager/photo-ui.js
        if (emptyEl) emptyEl.classList.toggle('hidden', eligibleAlbums.length > 0);
    },

    async selectAlbumFromPicker(albumId) {
        this._closePickerDrawer();
        await this._resolveAndCommitSource('group', albumId);
    },

    cancelAlbumPicker() {
        this._closePickerDrawer();
    },

    /** video + group (Folder type='video'). */
    async openListFolderPicker() {
        const folders = await listFolders(); // core/file-manager/folder.js
        const videoFolders = folders.filter((f) => f.type === 'video');
        const counts = await Promise.all(videoFolders.map(async (f) => {
            const map = await getFolderSongMap(f.id); // service/db.js
            return map ? getFolderSongKeys(map).length : 0; // core/file-manager/folder.js
        }));
        const eligible = videoFolders.filter((_, i) => counts[i] >= VISUAL_BG_MIN_LIST_ITEMS);

        await workflowPlaylist._openFolderPickerDrawer(
            (folderId) => this._resolveAndCommitSource('group', folderId),
            {
                folders: eligible,
                showAddTile: false,
                emptyMsg: videoFolders.length === 0
                    ? t('visualBgSettingsDrawer.folderPicker.emptyNoFolder')
                    : tFormat('visualBgSettingsDrawer.folderPicker.emptyTooFew', { count: VISUAL_BG_MIN_LIST_ITEMS }),
            },
        );
    },

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
};
