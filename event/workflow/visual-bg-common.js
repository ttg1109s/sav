/**
 * event/workflow/visual-bg-common.js — Workflow domain "Visual Background", phần CHUNG cho Photo lẫn Video: boot/persist,
 * áp nền, `source.list`/chọn nguồn/picker, nền màu (solid/gradient + Movement), các màn Settings. Phần riêng:
 * event/workflow/visual-bg-video.js, event/workflow/visual-bg-photo.js — cả 3 file ghép vào 1 object `workflowVisualBg`
 * (2 file kia `Object.assign()` thêm method/field riêng).
 * Video/Photo Player mode nhường nền qua `clearMediaLayers()` lúc vào và `restoreAfterPlayerMode()` lúc thoát.
 * Tính toán: core/visual-bg-common.js; ghi DOM panel: core/visual-bg-panel-ui.js.
 *
 * NẠP SAU: core/config.js, core/visual-bg-common.js, core/visual-bg-panel-ui.js, core/color-utils.js, service/db.js,
 * service/state.js. NẠP TRƯỚC: event/workflow/visual-bg-video.js, event/workflow/visual-bg-photo.js, event/router/visual-bg.js.
 */
// Chuỗi owner của VBG khi giữ Image surface (event/workflow/visual-bg-photo-motion.js — dùng chung với Player Photo).
const VISUAL_BG_IMAGE_SURFACE_OWNER = 'visualBg';
// Chuỗi owner của VBG khi giữ Video surface (event/workflow/video-motion-surface.js — dùng chung với Player Video).
const VISUAL_BG_VIDEO_SURFACE_OWNER = 'visualBg';
const VISUAL_BG_COLOR_PERSIST_TASK = 'visualBgColorPersist'; // debounce lưu DB khi kéo màu/slider
const VISUAL_BG_COLOR_PERSIST_DELAY_MS = 300;
let visualBgSettingsPanelEl = null;
let visualBgGradientPanelEl = null;

// type -> đọc nhiều record theo key trong 1 transaction. Loại không có trong bảng -> 'photo'.
const VISUAL_BG_RECORDS_BY_TYPE = {
    video: (keys) => getVideoRecordsByKeys(keys), // service/db.js
    photo: (keys) => getImageRecordsByKeys(keys),
};
const VISUAL_BG_RECORD_BY_TYPE = {
    video: (key) => getVideoRecord(key), // service/db.js
    photo: (key) => getImageRecord(key),
};
const VISUAL_BG_ITEM_NAME_BY_TYPE = {
    video: (record) => record.customName || stripFileExtension(record.filename), // core/file-manager/video.js
    photo: (record) => record.filename,
};
// Mode lạ -> A-Z (mọi mode khác newest/oldest sắp theo tên, chỉ 'za' đảo chiều).
const VISUAL_BG_SORT_BY_MODE = {
    newest: (items) => sortVisualBgKeysByAddedAt(items, true), // core/visual-bg-common.js
    oldest: (items) => sortVisualBgKeysByAddedAt(items, false),
    za: (items) => sortVisualBgKeysByName(items, true),
    az: (items) => sortVisualBgKeysByName(items, false),
};
// originKind lạ -> 'group'.
const VISUAL_BG_ORIGIN_KEYS_BY_KIND = {
    single: (type, originId) => (originId ? [originId] : []),
    multi: (type, originId) => workflowVisualBg._readMultiOriginKeys(type, originId),
    groupMulti: (type, originId) => workflowVisualBg._readGroupMultiOriginKeys(type, originId),
    group: (type, originId) => workflowVisualBg._readGroupOriginKeys(type, originId),
};
// Tên nguồn ở Settings; originKind lạ -> tên item đơn theo type.
const VISUAL_BG_SOURCE_NAME_BY_KIND = {
    multi: (type, originId) => tFormat(VISUAL_BG_MULTI_SOURCE_LABEL_KEY_BY_TYPE[type] || VISUAL_BG_MULTI_SOURCE_LABEL_KEY_BY_TYPE.photo, { count: decodeVisualBgMultiOriginId(originId).length }),
    groupMulti: (type, originId) => tFormat('visualBgSettingsDrawer.sourceLabel.groupMulti', { count: decodeVisualBgMultiOriginId(originId).length }),
    group: (type, originId) => workflowVisualBg._readFolderName(originId),
    single: (type, originId) => workflowVisualBg._readItemName(type, originId),
};
const VISUAL_BG_MULTI_SOURCE_LABEL_KEY_BY_TYPE = {
    video: 'visualBgSettingsDrawer.sourceLabel.multiVideo',
    photo: 'visualBgSettingsDrawer.sourceLabel.multiPhoto',
};
const VISUAL_BG_SOURCE_LABEL_BY_HAS_ORIGIN = {
    true: (type, shown) => workflowVisualBg._readSourceDisplayName(type, shown.originKind, shown.originId),
    false: () => t('visualBgSettingsDrawer.pickSource.none'),
};
const VISUAL_BG_PENDING_NOTICE_KEY_BY_TYPE = {
    video: 'visualBgSettingsDrawer.pendingSource.video',
    photo: 'visualBgSettingsDrawer.pendingSource.photo',
};
const VISUAL_BG_FOLDER_EMPTY_KEY_BY_TYPE = {
    video: 'visualBgSettingsDrawer.folderPicker.emptyNoFolder.video',
    photo: 'visualBgSettingsDrawer.folderPicker.emptyNoFolder.photo',
};
const VISUAL_BG_FOLDER_EMPTY_MSG_BY_NO_FOLDER = {
    true: (type) => t(VISUAL_BG_FOLDER_EMPTY_KEY_BY_TYPE[type] || VISUAL_BG_FOLDER_EMPTY_KEY_BY_TYPE.photo),
    false: () => '',
};
const VISUAL_BG_PICKER_CONFIRM_LABEL_BY_EMPTY = {
    true: () => t('visualBgSettingsDrawer.picker.confirmEmpty'),
    false: (count) => tFormat('visualBgSettingsDrawer.picker.confirm', { count }),
};

// Boot / bật toggle: có pending -> áp pending (tự áp nền sau đó), không -> áp nền hiện tại.
const VISUAL_BG_APPLY_BY_PENDING = {
    true: () => workflowVisualBg._checkAndApplyPendingSource(),
    false: () => workflowVisualBg.applyCurrentVisualBg(),
};
// type lạ -> 'photo'.
const VISUAL_BG_APPLY_BY_TYPE = {
    video: (cfg) => workflowVisualBg._applyVideo(cfg), // event/workflow/visual-bg-video.js
    photo: (cfg) => workflowVisualBg._applyPhoto(cfg), // event/workflow/visual-bg-photo.js
};
const VISUAL_BG_SONG_ADVANCE_BY_TYPE = {
    video: () => workflowVisualBg._advanceVideo(),
    photo: () => workflowVisualBg._photoTick(),
};
const VISUAL_BG_PLAYBACK_SYNC_BY_TYPE = {
    video: (songActive, stoppedAtEnd, cfg) => VISUAL_BG_VIDEO_SYNC_BY_SONG_ACTIVE[songActive](cfg, stoppedAtEnd),
    photo: (songActive) => workflowVisualBg._syncPhotoToSong(songActive),
};
const VISUAL_BG_VIDEO_SYNC_BY_SONG_ACTIVE = {
    true: (cfg) => VISUAL_BG_VIDEO_RESUME_BY_LOADED[workflowVisualBg._currentVideoKey !== null](cfg),
    false: (cfg, stoppedAtEnd) => VISUAL_BG_VIDEO_PAUSE_BY_STOPPED_AT_END[stoppedAtEnd](),
};
// Song phát: video chưa từng nạp -> nạp lần đầu; đã nạp (đứng vì pause tạm) -> resume câm rồi mới bật tiếng.
const VISUAL_BG_VIDEO_RESUME_BY_LOADED = {
    false: (cfg) => workflowVisualBg._playVideoKey(cfg.source.list[workflowVisualBg._listIndex]),
    true: () => workflowVisualBg._resumeVideoWithDelayedAudio(workflowVisualBg._currentVideoKey),
};
// Song dừng: hết playlist thật -> về placeholder tĩnh; pause tạm -> dừng video + Motion, giữ khung đang đứng.
const VISUAL_BG_VIDEO_PAUSE_BY_STOPPED_AT_END = {
    true: () => workflowVisualBg._revertToPlaceholder(),
    false: () => workflowVisualBg._pauseVideoInPlace(),
};
// Đổi nextOrder: origin đọc theo thứ tự (group/groupMulti) dựng lại list ngay; còn lại chỉ áp lại.
const VISUAL_BG_NEXT_ORDER_REAPPLY_BY_KIND = {
    group: (source) => workflowVisualBg._resolveAndCommitSource(source.originKind, source.originId),
    groupMulti: (source) => workflowVisualBg._resolveAndCommitSource(source.originKind, source.originId),
    other: () => workflowVisualBg.applyCurrentVisualBg(),
};
// Kết quả 1 lượt đọc lại origin (resolveVisualBgCommitRoute(), core/visual-bg-common.js).
const VISUAL_BG_COMMIT_BY_ROUTE = {
    clear: () => workflowVisualBg._clearForEmptyOrigin(),
    unchanged: (job) => ({ queued: false, added: 0, removed: 0, total: job.diff.total }),
    queue: (job) => workflowVisualBg._queuePendingSource(job),
    commit: (job) => workflowVisualBg._commitSourceNow(job.originKind, job.originId, job.keys, job.diff),
};
const VISUAL_BG_RESOLUTION_REFRESH_BY_TYPE = {
    video: () => workflowVisualBg._refreshVideoResolution(), // event/workflow/visual-bg-video.js
    photo: () => workflowVisualBg._refreshPhotoResolution(), // event/workflow/visual-bg-photo.js
};
const VISUAL_BG_FIRST_INDEX_BY_RANDOM = {
    true: (list) => ({ list: shuffleVisualBgList(list), index: 0 }), // core/visual-bg-common.js
    false: (list) => ({ list, index: pickNextMotionEngineIndexSequential(-1, list.length) }), // core/motion-engine.js
};
const VISUAL_BG_ADVANCE_BY_NEW_ROUND = {
    true: (list, currentIndex, nextIndex) => advanceVisualBgList(workflowVisualBg._reshuffleRound(list, currentIndex), nextIndex),
    false: (list, currentIndex, nextIndex) => advanceVisualBgList(list, nextIndex),
};
// Canvas 2D tô nền theo màu VBG (vd event/workflow/visualizer/rain.js). colorMode lạ -> solid.
const VISUAL_BG_CANVAS_FILL_BY_COLOR_MODE = {
    solid: (vb) => vb.solidColor,
    gradient: (vb, ctx, width, height) => workflowVisualBg._canvasGradientFill(vb, ctx, width, height),
};
// Khung Movement theo mode; mode lạ -> 'time'.
const VISUAL_BG_MOVEMENT_FRAME_BY_MODE = {
    time: (gm, now) => workflowVisualBg._timeMovementFrame(gm, now),
    audio: (gm, now) => workflowVisualBg._audioMovementFrame(gm, now),
};

const workflowVisualBg = {
    _listIndex: -1, // vị trí hiện tại trong `source.list` — dùng chung video lẫn ảnh

    /** State riêng animation Movement (`_tickGradientMovement()`), không lưu DB. */
    _gradientMovementStartTime: null,
    _gradientMovementBaseStops: null,
    _gradientMovementSwapStartTime: null,
    _gradientMovementSwapFromColors: null,
    _gradientMovementSwapToColors: null,
    _gradientMovementLastSwapTime: null,

    /** Mode 'audio' — 1 pha xoay/giãn mượt từ *From -> *To trong `_gradientMovementPhaseDurationMs`, hết pha mới lấy mẫu
     * BPM/energy chốt pha kế (`_commitNextGradientPhase()`). */
    _gradientMovementPhaseStartTime: null,
    _gradientMovementPhaseDurationMs: null,
    _gradientMovementPhaseFromAngle: null,
    _gradientMovementPhaseToAngle: null,
    _gradientMovementPhaseFromSpread: null,
    _gradientMovementPhaseToSpread: null,

    /** Picker Generic Drawer multi-select dùng chung Video/Ảnh (không bao giờ mở đồng thời). */
    _pickerOpen: false,
    _pickerSelectedKeys: [], // thứ tự chọn

    // ===================== Boot / persist =====================

    /** Đọc lại `meta.visualBgConfig` + áp nền — gọi 1 lần lúc boot, SAU workflowConfig.loadOnBoot(). */
    async loadPersistedSettingsOnBoot() {
        this._restoreSavedConfig(await getMeta('visualBgConfig'));
        VISUAL_BG_APPLY_BY_PENDING[shouldApplyVisualBgPending(true, appConfigVisualBg.getAll().pending.originKind)](); // core/visual-bg-common.js
        this._syncGradientMovementTaskState();
    },

    /** Khôi phục cấu hình đã lưu: field lạ/hỏng giữ mặc định (core thuần), tiếng từng video + Resolution chuẩn hoá ở đây. */
    _restoreSavedConfig(saved) {
        if (!saved || typeof saved !== 'object') return;
        const restored = sanitizeVisualBgConfig(saved, appConfigVisualBg.getAll()); // core/visual-bg-common.js
        const config = restored.config;
        if (restored.videoAudioRaw) config.source.videoAudio = this._cleanVideoAudioMap(restored.videoAudioRaw);
        config.videoResolutionMode = normalizePlayerResolutionMode(restored.videoResolutionRaw); // core/player-display-settings.js
        config.photoResolutionMode = normalizePlayerResolutionMode(restored.photoResolutionRaw);
        appConfigVisualBg.mutateAll((cfg) => { Object.assign(cfg, config); });
        console.log(`writer: "workflowVisualBg._restoreSavedConfig", page: "visualBgConfig", content: "nạp lại từ meta"`);
    },

    /** Kiểm từng entry tiếng video (mặc định nếu hỏng). @param {object} rawMap @returns {object} */
    _cleanVideoAudioMap(rawMap) {
        const cleaned = {};
        Object.keys(rawMap).forEach((k) => { cleaned[k] = getVisualBgVideoAudioSetting(rawMap, k); }); // core/visual-bg-video.js
        return cleaned;
    },

    async _persist() {
        await setMeta('visualBgConfig', appConfigVisualBg.getAll());
    },

    // ===================== source.list =====================

    /** Index LƯỢT ĐẦU (`currentIndex=-1`). 'sequential': index 0, giữ thứ tự gốc; 'random': xáo cả mảng 1 lần rồi từ 0.
     * @param {Array<string|null>} list @param {boolean} isRandom @returns {{ list: Array<string|null>, index: number }} */
    firstIndex(list, isRandom) {
        return VISUAL_BG_FIRST_INDEX_BY_RANDOM[isRandom](list);
    },

    /** Index MỖI LƯỢT SAU — bước tuần tự; 'random' xáo lại TOÀN mảng đúng lúc hết 1 vòng (item vừa phát không đứng đầu
     * vòng mới), rồi dọn null qua `advanceVisualBgList()`.
     * @param {Array<string|null>} list @param {number} currentIndex @param {boolean} isRandom
     * @returns {{ list: Array<string|null>, index: number }} `index=-1` nếu mảng rỗng sau dọn. */
    advanceList(list, currentIndex, isRandom) {
        const nextIndex = pickNextMotionEngineIndexSequential(currentIndex, list.length); // core/motion-engine.js
        return VISUAL_BG_ADVANCE_BY_NEW_ROUND[isVisualBgNewRandomRound(isRandom, nextIndex, list.length)](list, currentIndex, nextIndex);
    },

    /** Xáo vòng mới; item vừa phát rơi lên đầu thì đổi chỗ với 1 vị trí ngẫu nhiên. */
    _reshuffleRound(list, currentIndex) {
        let reshuffled = shuffleVisualBgList(list); // core/visual-bg-common.js
        if (isVisualBgRoundFrontRepeat(reshuffled, list, currentIndex)) reshuffled = swapVisualBgListFront(reshuffled, Math.random());
        return reshuffled;
    },

    /** Đang cycle nhiều item kiểu slideshow (dùng chung Photo/Video). @param {object} cfg @returns {boolean} */
    _isSlideshowCycling(cfg) {
        return isVisualBgSlideshowCycling(cfg.listPlaybackMode, countVisualBgLiveItems(cfg.source.list)); // core/visual-bg-common.js
    },

    /** Thời lượng 1 item theo 'fixtime' hay theo chính media ('natural') — Point Move, Transition, hẹn giờ ảnh/video.
     * @param {object} cfg @returns {'fixtime'|'natural'} */
    _itemDurationSource(cfg) {
        return resolveVisualBgItemDurationSource(this._isSlideshowCycling(cfg), cfg.durationMode); // core/visual-bg-common.js
    },

    // ===================== Áp nền =====================

    /** Điểm đồng bộ DUY NHẤT giữa config và DOM — boot + sau mọi thay đổi. Màu LUÔN sơn; media chỉ áp khi còn item sống.
     * Đang ở Video/Photo Player mode thì bỏ qua (áp đè sẽ phá nội dung Player) — thoát mode áp lại qua
     * `restoreAfterPlayerMode()`. */
    async applyCurrentVisualBg() {
        const { isVideoPlayerMode, isPhotoPlayerMode } = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode']);
        if (isVideoPlayerMode || isPhotoPlayerMode) {
            console.log('[workflowVisualBg] applyCurrentVisualBg() bỏ qua — đang ở Player mode, áp lại lúc thoát mode');
            return;
        }
        return this._applyCurrentVisualBgNow();
    },

    /** Khôi phục VBG lúc thoát Video/Photo Player mode (gọi TRƯỚC khi hạ cờ mode) — bỏ qua chặn của `applyCurrentVisualBg()`. */
    async restoreAfterPlayerMode() {
        return this._applyCurrentVisualBgNow();
    },

    /** Sơn `#visualizer-solid-bg` theo cấu hình màu VBG — boot (app-boot.js) và sau mọi thay đổi ảnh hưởng nền màu. */
    paintSolidBg() {
        const cfg = appConfigVisualBg.getAll();
        updateDOMBackground(cfg, buildVisualBgGradientCss(cfg.gradientStops, cfg.gradientAngleDeg)); // core/color-utils.js + core/visual-bg-common.js
    },

    /** Thân của `applyCurrentVisualBg()` (không chặn): dỡ media, sơn màu, toggle tổng bật thì nạp media theo type. */
    async _applyCurrentVisualBgNow() {
        this.clearMediaLayers();
        this.paintSolidBg();
        const cfg = appConfigVisualBg.getAll();
        if (!isVisualBgMediaEnabled(cfg)) return;
        return (VISUAL_BG_APPLY_BY_TYPE[cfg.type] || VISUAL_BG_APPLY_BY_TYPE.photo)(cfg);
    },

    /**
     * Áp `cfg.pending` nếu có — mọi điểm "lượt kế tiếp" (video hết/đổi bài, nhịp ảnh, boot). Áp xong giao
     * `applyCurrentVisualBg()` phát item đầu.
     * @returns {Promise<boolean>} true nếu vừa áp pending — nơi gọi return ngay (index/task cũ hết ý nghĩa).
     */
    async _checkAndApplyPendingSource() {
        const cfg = appConfigVisualBg.getAll();
        if (!cfg.pending.originKind) return false;
        const { originKind, originId, list } = cfg.pending;
        appConfigVisualBg.mutateAll((c) => {
            c.source.originKind = originKind;
            c.source.originId = originId;
            c.source.list = list;
            c.source.videoAudio = {};
            c.pending = { originKind: null, originId: null, list: [] };
        });
        console.log(`writer: "workflowVisualBg._checkAndApplyPendingSource", page: "visualBgConfig", content: "áp pending source=${originKind}:${originId}, count=${list.length}"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
        return true;
    },

    /** Dọn lớp media đang hiện (video + ảnh) — trước mọi lần áp lại, và lúc vào Player mode để nhường `bgVideoElement`
     * (không đụng cấu hình đã lưu, chỉ dọn DOM/task/object URL runtime). */
    clearMediaLayers() {
        const imageObjectUrl = appState.get('visualBgImageObjectUrl');
        workflowVisualBgPhotoMotion.stop(); // event/workflow/visual-bg-photo-motion.js
        taskManager.kill(VISUAL_BG_PHOTO_ADVANCE_TASK);
        this._listIndex = -1;
        this._photoRecord = null;
        this._currentVideoKey = null;
        this._videoLoopLastTimeSec = 0;
        this._killStuckRecoveryTimer();
        this._killVideoFixTimeTimer();
        // Trả Video surface nếu VBG đang giữ (dừng Motion, DOM A/B về chỗ cũ) trước khi dọn nguồn — no-op nếu Player giữ.
        workflowVideoMotionSurface.release(VISUAL_BG_VIDEO_SURFACE_OWNER); // event/workflow/video-motion-surface.js
        workflowVideoPlayer.clearBgVideoSource(); // event/workflow/video-player.js
        // Gỡ override Resolution VBG khỏi layer A/B — Player nhận 2 element sạch; VBG áp lại ở lượt hiện media sau.
        this._videoNaturalSize = null;
        applyVisualBgVideoResolutionToDOM(''); // core/visual-bg-video.js
        applyVisualBgVideoBridgeSizeToDOM('');
        applyVisualBgImageToDOM(false, ''); // core/visual-bg-photo.js
        if (imageObjectUrl) revokeBlobUrl(imageObjectUrl);
        appState.set('visualBgImageObjectUrl', '');
    },

    /** Bài hát đổi thật ('visualBg.songChanged'). Kiểm pending trước guard 'perSong' — điểm "lượt kế tiếp" duy nhất cho
     * ca `source.list` ≤ 1 item; dùng chung ảnh lẫn video. */
    async advanceForSongChange() {
        if (!this._isMediaEnabled()) return; // tắt: pending (nếu có) giữ nguyên chờ bật lại
        const cfg = appConfigVisualBg.getAll();
        if (await this._checkAndApplyPendingSource()) return;
        if (cfg.listPlaybackMode !== 'perSong') return;
        await (VISUAL_BG_SONG_ADVANCE_BY_TYPE[cfg.type] || VISUAL_BG_SONG_ADVANCE_BY_TYPE.photo)();
    },

    /** `source.list` rỗng sau sweep -> tự gỡ hẳn nguồn (như nút "Gỡ nguồn"). Public — Photo Motion cũng gọi. */
    async selfHealEmptySource() {
        console.log(`writer: "workflowVisualBg.selfHealEmptySource", page: "visualBgConfig", content: "source rỗng sau sweep -> tự gỡ"`);
        await this.clearSource();
    },

    /** Photo/Video báo `source.list` vừa đổi lúc cycle (sweep/mark-null) — nguồn sự thật vẫn thuộc domain này. */
    async persistSourceListMutation(list) {
        appConfigVisualBg.mutateAll((cfg) => { cfg.source.list = list; });
        await this._persist();
    },

    /** Đồng bộ play/pause nền theo Song — gọi từ event/workflow/player-controls.js + mỗi lần Next/Prev. Ở Player mode bỏ
     * qua (không đụng `bgVideoElement`/surface của Player; thoát mode `restoreAfterPlayerMode()` đồng bộ lại). */
    syncPlaybackToAudio() {
        if (this._isSwappingVideo) return;
        const state = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode', 'isBackgroundSuspended', 'playbackStoppedAtPlaylistEnd']);
        if (state.isVideoPlayerMode || state.isPhotoPlayerMode) return;
        const cfg = appConfigVisualBg.getAll();
        if (!isVisualBgMediaEnabled(cfg)) return; // tắt: không tự nạp video hay hẹn giờ ảnh
        const songActive = isVisualBgSongActive(audioPlayer.paused, state.isBackgroundSuspended); // app ẩn = coi như Song dừng
        (VISUAL_BG_PLAYBACK_SYNC_BY_TYPE[cfg.type] || VISUAL_BG_PLAYBACK_SYNC_BY_TYPE.photo)(songActive, !!state.playbackStoppedAtPlaylistEnd, cfg);
    },

    /** Ảnh: video nền (nếu có) + Motion theo Song (kèm owner — surface dùng chung Player Photo), rồi hẹn lại nhịp ảnh. */
    _syncPhotoToSong(songActive) {
        syncVisualBgVideoPlayback(!songActive); // core/visual-bg-video.js
        if (songActive) workflowVisualBgPhotoMotion.resume(VISUAL_BG_IMAGE_SURFACE_OWNER);
        else workflowVisualBgPhotoMotion.pause(VISUAL_BG_IMAGE_SURFACE_OWNER);
        this._syncPhotoTicking(); // event/workflow/visual-bg-photo.js
    },

    /** Video: Song pause tạm -> dừng video + Motion, giữ khung đang đứng. */
    _pauseVideoInPlace() {
        syncVisualBgVideoPlayback(true); // core/visual-bg-video.js
        workflowVideoMotionSurface.pause(VISUAL_BG_VIDEO_SURFACE_OWNER); // event/workflow/video-motion-surface.js
    },

    /** Toggle tổng (`enabled`) có bật không. @returns {boolean} */
    _isMediaEnabled() {
        return isVisualBgMediaEnabled(appConfigVisualBg.getAll()); // core/visual-bg-common.js
    },

    /** Toggle tổng ('visualBg.enabled.change'). Tắt: dỡ media qua đường áp chung (màu vẫn sơn). Bật: nạp lại từ đầu, có
     * pending thì áp pending trước (cùng thứ tự boot). Cấu hình nguồn/màu/Motion giữ nguyên. @param {boolean} checked */
    async toggleEnabled(checked) {
        appConfigVisualBg.mutateAll((cfg) => { cfg.enabled = !!checked; });
        console.log(`writer: "workflowVisualBg.toggleEnabled", page: "visualBgConfig", content: "enabled=${!!checked}"`);
        await this._persist();
        await this.refreshPanelUI();
        await VISUAL_BG_APPLY_BY_PENDING[shouldApplyVisualBgPending(!!checked, appConfigVisualBg.getAll().pending.originKind)]();
    },

    /** "Song đang chạy" theo góc nhìn VBG (app ẩn = Song dừng) — mọi quyết định phát video nền/Motion/nhịp ảnh đọc hàm
     * này. @returns {boolean} */
    _isSongActiveForVbg() {
        return isVisualBgSongActive(audioPlayer.paused, appState.get('isBackgroundSuspended')); // core/visual-bg-common.js
    },

    /** App vừa vào/ra chế độ nền (event/workflow/app-visibility.js, SAU khi ghi `isBackgroundSuspended`): tạm dừng/chạy
     * lại Movement rồi đồng bộ media qua `syncPlaybackToAudio()`. */
    onBackgroundSuspendChange() {
        if (appState.get('isBackgroundSuspended')) taskManager.pause(VISUAL_BG_GRADIENT_MOVEMENT_TASK);
        else taskManager.resume(VISUAL_BG_GRADIENT_MOVEMENT_TASK);
        this.syncPlaybackToAudio();
    },

    // ===================== Origin -> key =====================

    /** Key THẬT của 1 origin lúc gọi (không cache), đã sắp theo `nextOrder`.
     * @param {'photo'|'video'} type @param {string} originKind @param {string} originId @returns {Promise<string[]>} */
    async _readOriginKeys(type, originKind, originId) {
        return (VISUAL_BG_ORIGIN_KEYS_BY_KIND[originKind] || VISUAL_BG_ORIGIN_KEYS_BY_KIND.group)(type, originId);
    },

    /** 'multi' — các key đã chọn, bỏ key không còn record. */
    async _readMultiOriginKeys(type, originId) {
        const keys = decodeVisualBgMultiOriginId(originId); // core/visual-bg-common.js
        const records = await (VISUAL_BG_RECORDS_BY_TYPE[type] || VISUAL_BG_RECORDS_BY_TYPE.photo)(keys);
        return keepVisualBgKeysWithRecords(keys, records);
    },

    /** 'groupMulti' — gộp key của nhiều folder theo đúng thứ tự chọn. */
    async _readGroupMultiOriginKeys(type, originId) {
        const merged = [];
        for (const folderId of decodeVisualBgMultiOriginId(originId)) {
            const map = await getFolderSongMap(folderId); // service/db.js
            merged.push(...(await this._applyNextOrderToKeys(type, map ? getFolderSongKeys(map) : []))); // core/file-manager/folder.js
        }
        return merged;
    },

    /** 'group' — key của 1 folder. */
    async _readGroupOriginKeys(type, originId) {
        const map = await getFolderSongMap(originId);
        return this._applyNextOrderToKeys(type, map ? getFolderSongKeys(map) : []);
    },

    /** Sắp `keys` theo `nextOrder`: 'sequential'/'random' giữ thứ tự gốc; 'playlist' áp `displaySortMode` của Playlist. */
    async _applyNextOrderToKeys(type, keys) {
        if (appConfigVisualBg.getAll().nextOrder !== 'playlist' || keys.length === 0) return keys;
        const records = await (VISUAL_BG_RECORDS_BY_TYPE[type] || VISUAL_BG_RECORDS_BY_TYPE.photo)(keys);
        const nameOf = VISUAL_BG_ITEM_NAME_BY_TYPE[type] || VISUAL_BG_ITEM_NAME_BY_TYPE.photo;
        const items = buildVisualBgSortItems(keys, records, records.map((r) => (r ? nameOf(r) : null))); // core/visual-bg-common.js
        return (VISUAL_BG_SORT_BY_MODE[appConfigPlaylist.getAll().displaySortMode] || VISUAL_BG_SORT_BY_MODE.az)(items);
    },

    // ===================== Chọn / làm tươi / gỡ nguồn =====================

    /** Modal kết quả `_resolveAndCommitSource()` — nút "Làm tươi" và 3 nút Chọn nguồn. `queued` đã tự báo bên trong.
     * @param {{queued: boolean, added?: number, removed?: number, total: number}|null} result */
    async _showCommitResultModal(result) {
        if (!result) { await alertModal(t('visualBgSettingsDrawer.commitResult.cleared')); return; }
        if (result.queued) return;
        if (result.added === 0 && result.removed === 0) { await alertModal(tFormat('visualBgSettingsDrawer.commitResult.unchanged', { total: result.total })); return; }
        await alertModal(tFormat('visualBgSettingsDrawer.commitResult.changed', { added: result.added, removed: result.removed, total: result.total }));
    },

    /**
     * Đọc lại origin rồi: rỗng -> gỡ hẳn; không đổi -> giữ; đang có media sống -> xếp `pending` (áp ở lượt kế); còn lại ghi
     * đè `source` ngay. So sánh với nội dung ĐANG HIỂN THỊ (pending nếu có). `source.videoAudio` xoá mỗi lần ghi đè.
     * @returns {Promise<{queued: false, added: number, removed: number, total: number}|{queued: true, total: number}|null>}
     *   `null` = đã gỡ hẳn.
     */
    async _resolveAndCommitSource(originKind, originId) {
        const cfg = appConfigVisualBg.getAll();
        const keys = await this._readOriginKeys(cfg.type, originKind, originId);
        const diff = diffVisualBgKeyLists(resolveVisualBgDisplayedSource(cfg).list, keys); // core/visual-bg-common.js
        const route = resolveVisualBgCommitRoute(keys.length, diff, countVisualBgLiveItems(cfg.source.list));
        return VISUAL_BG_COMMIT_BY_ROUTE[route]({ type: cfg.type, originKind, originId, keys, diff });
    },

    /** Origin đọc ra rỗng (folder/ảnh/video không còn) -> gỡ hẳn nguồn lẫn pending. @returns {Promise<null>} */
    async _clearForEmptyOrigin() {
        appConfigVisualBg.mutateAll((c) => { c.pending = { originKind: null, originId: null, list: [] }; });
        await this.clearSource();
        return null;
    },

    /** Đang có media sống -> nguồn mới chờ "lượt kế tiếp" (chỉ giữ 1 pending, chọn tiếp thì đè) + báo người dùng. */
    async _queuePendingSource(job) {
        appConfigVisualBg.mutateAll((c) => { c.pending = { originKind: job.originKind, originId: job.originId, list: job.keys }; });
        console.log(`writer: "workflowVisualBg._queuePendingSource", page: "visualBgConfig", content: "queued pending=${job.originKind}:${job.originId}, count=${job.keys.length}"`);
        await this._persist();
        await this.refreshPanelUI();
        await alertModal(t(VISUAL_BG_PENDING_NOTICE_KEY_BY_TYPE[job.type] || VISUAL_BG_PENDING_NOTICE_KEY_BY_TYPE.photo));
        return { queued: true, total: job.keys.length };
    },

    /** Ghi đè `source` NGAY (không qua pending). @param {{added: number, removed: number}} diff - đã tính sẵn
     * @returns {Promise<{queued: false, added: number, removed: number, total: number}>} */
    async _commitSourceNow(originKind, originId, keys, diff) {
        appConfigVisualBg.mutateAll((c) => {
            c.source.originKind = originKind;
            c.source.originId = originId;
            c.source.list = keys;
            c.source.videoAudio = {};
            c.pending = { originKind: null, originId: null, list: [] };
        });
        console.log(`writer: "workflowVisualBg._commitSourceNow", page: "visualBgConfig", content: "source=${originKind}:${originId}, count=${keys.length}, +${diff.added}/-${diff.removed}, videoAudio=cleared"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
        return { queued: false, added: diff.added, removed: diff.removed, total: keys.length };
    },

    /** Nút "Làm tươi" — đọc lại origin đang hiển thị (pending nếu có); nút xoay trong lúc đọc DB, xong báo thay đổi. */
    async refreshSource() {
        const { originKind, originId } = resolveVisualBgDisplayedSource(appConfigVisualBg.getAll()); // core/visual-bg-common.js
        if (!originKind || !originId) return;
        setVisualBgRefreshSourceBusy(visualBgSettingsPanelEl, true); // core/visual-bg-panel-ui.js
        try {
            const result = await this._resolveAndCommitSource(originKind, originId);
            await this._showCommitResultModal(result);
        } finally {
            setVisualBgRefreshSourceBusy(visualBgSettingsPanelEl, false);
        }
    },

    /** Gỡ hẳn nguồn hiện tại — về "chưa chọn". */
    async clearSource() {
        appConfigVisualBg.mutateAll((cfg) => { cfg.source = { originKind: null, originId: null, list: [], videoAudio: {} }; cfg.pending = { originKind: null, originId: null, list: [] }; });
        console.log(`writer: "workflowVisualBg.clearSource", page: "visualBgConfig", content: "source=cleared, pending=cleared"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    // ===================== Cách phát =====================

    /** Select "Cách phát" (chỉ có nghĩa khi list > 1 item). */
    async changeListPlaybackMode(value) {
        if (!VISUAL_BG_LIST_PLAYBACK_MODES.includes(value)) return;
        appConfigVisualBg.mutateAll((cfg) => { cfg.listPlaybackMode = value; });
        console.log(`writer: "workflowVisualBg.changeListPlaybackMode", page: "visualBgConfig", content: "listPlaybackMode=${value}"`);
        await this._persist();
        await this.refreshPanelUI();
        await this.applyCurrentVisualBg();
    },

    /** Select "Duration mode" — dùng chung video/ảnh, không áp ngược lên item đang hiện (item kế theo mode mới). */
    async changeDurationMode(value) {
        if (!VISUAL_BG_DURATION_MODES.includes(value)) return;
        appConfigVisualBg.mutateAll((cfg) => { cfg.durationMode = value; });
        console.log(`writer: "workflowVisualBg.changeDurationMode", page: "visualBgConfig", content: "durationMode=${value}"`);
        await this._persist();
        await this.refreshPanelUI();
    },

    /** Nút "Seconds per video/photo" (video lẫn ảnh, `durationMode='fixtime'`) — picker 's-ms' chọn tới 0.1s. */
    openDurationSecondsPicker() {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        openTimePickerModal({
            title: t('visualBgSettingsDrawer.durationSeconds.pickerTitle'),
            format: 's-ms',
            ...buildVisualBgDurationPickerRange(appConfigVisualBg.getAll().durationSeconds), // core/visual-bg-common.js
            onConfirm: (resultMs) => this._commitDurationSeconds(resultMs),
        });
    },

    async _commitDurationSeconds(resultMs) {
        const seconds = computeVisualBgDurationSeconds(resultMs); // core/visual-bg-common.js
        appConfigVisualBg.mutateAll((c) => { c.durationSeconds = seconds; });
        console.log(`writer: "workflowVisualBg._commitDurationSeconds", page: "visualBgConfig", content: "durationSeconds=${seconds}"`);
        await this._persist();
        if (!this._isPanelMounted()) return;
        setVisualBgDurationSecondsLabel(visualBgSettingsPanelEl, seconds); // core/visual-bg-panel-ui.js
    },

    /** Select "Thứ tự kế tiếp" — origin đọc theo thứ tự (group/groupMulti) dựng lại list ngay như 1 lượt Làm tươi; còn
     * lại (single/multi giữ thứ tự chọn) chỉ áp lại. */
    async changeNextOrder(value) {
        if (!VISUAL_BG_NEXT_ORDERS.includes(value)) return;
        appConfigVisualBg.mutateAll((cfg) => { cfg.nextOrder = value; });
        console.log(`writer: "workflowVisualBg.changeNextOrder", page: "visualBgConfig", content: "nextOrder=${value}"`);
        await this._persist();
        const source = appConfigVisualBg.getAll().source;
        await (VISUAL_BG_NEXT_ORDER_REAPPLY_BY_KIND[source.originKind] || VISUAL_BG_NEXT_ORDER_REAPPLY_BY_KIND.other)(source);
    },

    // ===================== Nền màu =====================

    /** Ghi 1 thay đổi màu: sơn lại, Movement đang chạy lấy bộ stop mới làm gốc, lưu DB sau 300 ms (debounce khi kéo). */
    _commitColorChange(mutatorFn, logContent) {
        appConfigVisualBg.mutateAll(mutatorFn);
        console.log(`writer: "workflowVisualBg._commitColorChange", page: "visualBgConfig", content: "${logContent}"`);
        this.paintSolidBg();
        if (taskManager.isTaskRunning(VISUAL_BG_GRADIENT_MOVEMENT_TASK)) this._gradientMovementBaseStops = appConfigVisualBg.getAll().gradientStops.slice();
        taskManager.once(() => this._persist(), VISUAL_BG_COLOR_PERSIST_DELAY_MS, VISUAL_BG_COLOR_PERSIST_TASK);
    },

    async changeColorMode(value) {
        if (!VISUAL_BG_COLOR_MODES.includes(value)) return;
        appConfigVisualBg.mutateAll((cfg) => { cfg.colorMode = value; });
        console.log(`writer: "workflowVisualBg.changeColorMode", page: "visualBgConfig", content: "colorMode=${value}"`);
        this.paintSolidBg();
        this._syncGradientMovementTaskState();
        await this._persist();
        await this.refreshPanelUI();
    },

    changeSolidColor(value) {
        this._commitColorChange((cfg) => { cfg.solidColor = value; }, `solidColor=${value}`);
    },

    /** Sub panel Gradient đang hiện (Drawer mở và đã từng gắn panel) — điều kiện ghi DOM sau mỗi thay đổi. */
    _isGradientPanelShown() {
        return !!visualBgGradientPanelEl && !genericDrawerPanel.classList.contains('hidden');
    },

    changeGradientAngle(value) {
        const deg = parseVisualBgFiniteNumber(value); // core/visual-bg-common.js
        if (deg === null) return;
        this._commitColorChange((cfg) => { cfg.gradientAngleDeg = deg; }, `gradientAngleDeg=${deg}`);
        if (!this._isGradientPanelShown()) return;
        setVisualBgGradientAngleLabel(visualBgGradientPanelEl, deg); // core/visual-bg-panel-ui.js
        this._paintGradientPreview(appConfigVisualBg.getAll());
    },

    changeGradientStop(index, field, value) {
        const parsed = parseVisualBgGradientStopValue(field, value); // core/visual-bg-common.js
        if (parsed === null) return;
        this._commitColorChange((cfg) => { cfg.gradientStops = setVisualBgGradientStopField(cfg.gradientStops, index, field, parsed); }, `gradientStops[${index}].${field}=${parsed}`);
        if (!this._isGradientPanelShown()) return;
        if (field === 'position') setVisualBgGradientStopLabel(visualBgGradientPanelEl, index, parsed); // core/visual-bg-panel-ui.js
        this._paintGradientPreview(appConfigVisualBg.getAll());
    },

    addGradientStop() {
        this._commitColorChange((cfg) => { cfg.gradientStops = addVisualBgGradientStop(cfg.gradientStops); }, 'gradientStops +1');
        if (!this._isGradientPanelShown()) return;
        const cfg = appConfigVisualBg.getAll();
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);
    },

    removeGradientStop(index) {
        this._commitColorChange((cfg) => { cfg.gradientStops = removeVisualBgGradientStop(cfg.gradientStops, index); }, `gradientStops -1 (index ${index})`);
        if (!this._isGradientPanelShown()) return;
        const cfg = appConfigVisualBg.getAll();
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);
    },

    /** Sub panel Gradient vừa gắn (event/workflow/app-settings.js::_renderVisualBgGradient()) — đồng bộ mọi control. */
    openGradientPanel() {
        visualBgGradientPanelEl = genericDrawerBody;
        const cfg = appConfigVisualBg.getAll();
        fillVisualBgGradientPanel(visualBgGradientPanelEl, cfg); // core/visual-bg-panel-ui.js
        this._renderGradientStopRows(cfg.gradientStops);
        this._paintGradientPreview(cfg);
    },

    _renderGradientStopRows(stops) {
        const limits = computeVisualBgGradientStopLimits(stops.length); // core/visual-bg-common.js
        const listEl = fillVisualBgGradientStopList(visualBgGradientPanelEl, renderVisualBgGradientStopRowsHtml(stops, limits.canRemove), limits.canAdd); // core/visual-bg-panel-ui.js + components/visual-bg-gradient-drawer.js
        if (!listEl) return;
        applyUiThemeToDom(listEl, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js — hàng vẽ lại sau lúc mở drawer -> áp theme lại
    },

    _paintGradientPreview(cfg) {
        setVisualBgGradientPreview(visualBgGradientPanelEl, buildVisualBgGradientCss(cfg.gradientStops, cfg.gradientAngleDeg)); // core/visual-bg-panel-ui.js
    },

    /** Fill style nền VBG hiện tại cho canvas 2D (vd event/workflow/visualizer/rain.js): solid -> chuỗi màu; gradient ->
     * CanvasGradient khớp khung đang hiển thị (khung Movement LIVE nếu đang chạy, tĩnh nếu tắt). Hot path — chỉ map + đọc.
     * @param {CanvasRenderingContext2D} ctx @param {number} width @param {number} height */
    canvasFillStyle(ctx, width, height) {
        const vb = appConfigVisualBg.getAll();
        return (VISUAL_BG_CANVAS_FILL_BY_COLOR_MODE[vb.colorMode] || VISUAL_BG_CANVAS_FILL_BY_COLOR_MODE.solid)(vb, ctx, width, height);
    },

    _canvasGradientFill(vb, ctx, width, height) {
        const live = appState.get(['visualBgGradientLiveAngle', 'visualBgGradientLiveStops']);
        const angle = live.visualBgGradientLiveAngle !== null ? live.visualBgGradientLiveAngle : vb.gradientAngleDeg;
        return buildCanvasLinearGradient(ctx, angle, width, height, live.visualBgGradientLiveStops || vb.gradientStops); // core/color-utils.js
    },

    // ===================== Movement =====================

    /** Đăng ký + bật task tick. Task đang chạy -> no-op (không reset pha giữa chừng, tránh giật hình). */
    _startGradientMovementTask() {
        if (taskManager.isTaskRunning(VISUAL_BG_GRADIENT_MOVEMENT_TASK)) return;
        this._gradientMovementStartTime = Date.now();
        this._gradientMovementBaseStops = appConfigVisualBg.getAll().gradientStops.slice();
        this._gradientMovementSwapStartTime = null;
        this._gradientMovementLastSwapTime = Date.now();
        this._gradientMovementPhaseStartTime = null;
        this._gradientMovementPhaseDurationMs = null;
        this._gradientMovementPhaseFromAngle = null;
        this._gradientMovementPhaseToAngle = null;
        this._gradientMovementPhaseFromSpread = null;
        this._gradientMovementPhaseToSpread = null;
        taskManager.addNew(VISUAL_BG_GRADIENT_MOVEMENT_TASK, { time: VISUAL_BG_GRADIENT_MOVEMENT_TICK_MS, exe: () => this._tickGradientMovement(), mode: 'timeout', count: 0 });
        taskManager.operator(VISUAL_BG_GRADIENT_MOVEMENT_TASK, 'enabled');
    },

    /** Dừng hẳn + dọn lượt tráo màu dở — nền gradient tĩnh quay lại qua `paintSolidBg()` ở nơi gọi. */
    _stopGradientMovementTask() {
        taskManager.kill(VISUAL_BG_GRADIENT_MOVEMENT_TASK);
        this._gradientMovementSwapStartTime = null;
        appState.set('visualBgGradientLiveAngle', null, { skipCheck: true });
        appState.set('visualBgGradientLiveStops', null, { skipCheck: true });
    },

    /** Bật/tắt task theo cấu hình hiện tại — sau mỗi lần đổi colorMode/Movement và lúc boot. */
    _syncGradientMovementTaskState() {
        if (shouldRunVisualBgGradientMovement(appConfigVisualBg.getAll())) this._startGradientMovementTask(); // core/visual-bg-common.js
        else this._stopGradientMovementTask();
    },

    /** 1 khung Movement (10fps): đọc cfg mới nhất (đổi setting không cần restart), tính góc + stop theo mode, chồng "Tráo
     * màu" nếu bật, vẽ rồi ghi khung LIVE vào appState (canvas 2D đọc lại qua `canvasFillStyle()`). */
    _tickGradientMovement() {
        const gm = appConfigVisualBg.getAll().gradientMovement;
        const now = Date.now();
        const frame = (VISUAL_BG_MOVEMENT_FRAME_BY_MODE[gm.mode] || VISUAL_BG_MOVEMENT_FRAME_BY_MODE.time)(gm, now);
        const stops = this._colorSwapStops(gm, now, frame.stops);
        applyGradientCssFrame(buildVisualBgGradientCss(stops, frame.angle)); // core/visual-bg-common.js
        appState.set('visualBgGradientLiveAngle', frame.angle, { skipCheck: true });
        appState.set('visualBgGradientLiveStops', stops, { skipCheck: true });
    },

    /** Mode 'time' — xoay đều, stop giữ nguyên. */
    _timeMovementFrame(gm, now) {
        return { angle: computeGradientTimeRotateAngle(now, this._gradientMovementStartTime, gm.rotateDurationMs), stops: this._gradientMovementBaseStops };
    },

    /** Mode 'audio' — xoay/giãn THEO PHA: 1 pha chạy trọn tới đích rồi mới chốt pha kế (map thẳng energy->góc mỗi tick
     * làm góc giật, đảo chiều liên tục). */
    _audioMovementFrame(gm, now) {
        if (this._gradientMovementPhaseStartTime === null) this._commitNextGradientPhase(gm);
        const phase = computeGradientProgress(now, this._gradientMovementPhaseStartTime, this._gradientMovementPhaseDurationMs); // core/visual-bg-common.js
        const eased = easeInOutSine(phase.progress);
        const angle = lerpGradientMovementValue(this._gradientMovementPhaseFromAngle, this._gradientMovementPhaseToAngle, eased);
        const spread = lerpGradientMovementValue(this._gradientMovementPhaseFromSpread, this._gradientMovementPhaseToSpread, eased);
        const stops = computeGradientStopSpread(this._gradientMovementBaseStops, spread);
        if (phase.done) this._commitNextGradientPhase(gm);
        return { angle, stops };
    },

    /** Chốt 1 pha mới mode 'audio' — mẫu BPM/energy lúc gọi; pha mới bắt đầu đúng giá trị pha cũ vừa dừng (không nhảy góc). */
    _commitNextGradientPhase(gm) {
        const bpm = audioAnalysis.bpmOr(120); // service/audio-analysis.js
        const energy = audioAnalysis.smoothedEnergy();
        const musicSpeedFactor = computeMusicSpeedFactor(bpm, energy, VISUAL_BG_GRADIENT_MUSIC_FACTOR_MIN, VISUAL_BG_GRADIENT_MUSIC_FACTOR_MAX);
        const duration = computeGradientPhaseDuration(VISUAL_BG_GRADIENT_PHASE_BASE_MS, musicSpeedFactor);
        this._gradientMovementPhaseFromAngle = this._gradientMovementPhaseToAngle !== null ? this._gradientMovementPhaseToAngle : gm.audioRotateFrom;
        this._gradientMovementPhaseToAngle = lerpGradientMovementValue(gm.audioRotateFrom, gm.audioRotateTo, energy);
        this._gradientMovementPhaseFromSpread = this._gradientMovementPhaseToSpread !== null ? this._gradientMovementPhaseToSpread : gm.audioStopSpreadFrom;
        this._gradientMovementPhaseToSpread = lerpGradientMovementValue(gm.audioStopSpreadFrom, gm.audioStopSpreadTo, energy);
        this._gradientMovementPhaseStartTime = Date.now();
        this._gradientMovementPhaseDurationMs = duration;
    },

    /** "Tráo màu" chồng lên khung hiện tại: tới lượt thì mở lượt mới, đang chuyển thì trộn màu. */
    _colorSwapStops(gm, now, stops) {
        if (!gm.colorSwapEnabled) return stops;
        if (isGradientColorSwapDue(this._gradientMovementSwapStartTime, this._gradientMovementLastSwapTime, gm.colorSwapIntervalMs, now)) this._beginColorSwap(now, stops.length); // core/visual-bg-common.js
        if (this._gradientMovementSwapStartTime === null) return stops;
        return this._colorSwapTransitionStops(gm, now, stops);
    },

    _beginColorSwap(now, stopCount) {
        const randomFactors = Array.from({ length: stopCount }, () => Math.random());
        const swap = planGradientColorSwap(this._gradientMovementBaseStops, randomFactors); // core/visual-bg-common.js
        this._gradientMovementSwapFromColors = swap.fromColors;
        this._gradientMovementSwapToColors = swap.toColors;
        this._gradientMovementSwapStartTime = now;
        this._gradientMovementLastSwapTime = now;
    },

    _colorSwapTransitionStops(gm, now, stops) {
        const phase = computeGradientProgress(now, this._gradientMovementSwapStartTime, gm.colorSwapTransitionMs);
        const toColors = this._gradientMovementSwapToColors;
        const colors = this._gradientMovementSwapFromColors.map((c, i) => interpolateColor(c, toColors[i], phase.progress)); // core/color-utils.js
        const blended = applyGradientStopColors(stops, colors);
        if (phase.done) this._finishColorSwap();
        return blended;
    },

    /** Hết lượt chuyển màu: bộ màu mới thành gốc. */
    _finishColorSwap() {
        this._gradientMovementBaseStops = applyGradientStopColors(this._gradientMovementBaseStops, this._gradientMovementSwapToColors);
        this._gradientMovementSwapStartTime = null;
    },

    /** Toggle Movement. */
    async toggleGradientMovement(checked) {
        this._commitColorChange((cfg) => { cfg.gradientMovement.enabled = checked; }, `gradientMovement.enabled=${checked}`);
        this._syncGradientMovementTaskState();
        if (!this._isGradientPanelShown()) return;
        setVisualBgGradientMovementOptionsVisible(visualBgGradientPanelEl, checked); // core/visual-bg-panel-ui.js
    },

    /** Select mode Movement ('time'/'audio') — chạy lại từ đầu pha. */
    changeGradientMovementMode(value) {
        if (!VISUAL_BG_GRADIENT_MOVEMENT_MODES.includes(value)) return;
        this._commitColorChange((cfg) => { cfg.gradientMovement.mode = value; }, `gradientMovement.mode=${value}`);
        this._gradientMovementStartTime = Date.now();
        this._gradientMovementPhaseStartTime = null;
        if (!this._isGradientPanelShown()) return;
        setVisualBgGradientMovementModeBlocks(visualBgGradientPanelEl, value); // core/visual-bg-panel-ui.js
    },

    /** Picker "Hết 1 vòng sau" (mode 'time'). */
    openGradientMovementDurationPicker() {
        openTimePickerModal({
            title: t('visualBgSettingsDrawer.gradientMovement.duration.pickerTitle'),
            format: 's-ms',
            valueMs: appConfigVisualBg.getAll().gradientMovement.rotateDurationMs,
            minMs: VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MIN_MS,
            maxMs: VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MAX_MS,
            onConfirm: (resultMs) => {
                this._commitGradientMs('rotateDurationMs', resultMs);
                this._gradientMovementStartTime = Date.now();
            },
        });
    },

    /** 4 ô "From/To" mode 'audio' — góc xoay (0-360) + độ giãn stop (0-50%); cùng 1 việc (ghi 1 số vào field). */
    changeGradientMovementAudioRange(field, value) {
        const num = parseVisualBgFiniteNumber(value); // core/visual-bg-common.js
        if (num === null) return;
        this._commitColorChange((cfg) => { cfg.gradientMovement[field] = num; }, `gradientMovement.${field}=${num}`);
    },

    /** Toggle "Tráo màu". */
    toggleGradientColorSwap(checked) {
        this._commitColorChange((cfg) => { cfg.gradientMovement.colorSwapEnabled = checked; }, `gradientMovement.colorSwapEnabled=${checked}`);
        this._gradientMovementLastSwapTime = Date.now();
        if (!this._isGradientPanelShown()) return;
        setVisualBgGradientColorSwapOptionsVisible(visualBgGradientPanelEl, checked); // core/visual-bg-panel-ui.js
    },

    /** Picker "Tráo mỗi". */
    openGradientColorSwapIntervalPicker() {
        openTimePickerModal({
            title: t('visualBgSettingsDrawer.gradientMovement.colorSwapInterval.pickerTitle'),
            format: 's-ms',
            valueMs: appConfigVisualBg.getAll().gradientMovement.colorSwapIntervalMs,
            minMs: VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MIN_MS,
            maxMs: VISUAL_BG_GRADIENT_MOVEMENT_ROTATE_MAX_MS,
            onConfirm: (resultMs) => this._commitGradientMs('colorSwapIntervalMs', resultMs),
        });
    },

    /** Picker "Thời gian chuyển cảnh". */
    openGradientColorSwapTransitionPicker() {
        openTimePickerModal({
            title: t('visualBgSettingsDrawer.gradientMovement.colorSwapTransition.pickerTitle'),
            format: 's-ms',
            valueMs: appConfigVisualBg.getAll().gradientMovement.colorSwapTransitionMs,
            minMs: VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MIN_MS,
            maxMs: VISUAL_BG_GRADIENT_MOVEMENT_TRANSITION_MAX_MS,
            onConfirm: (resultMs) => this._commitGradientMs('colorSwapTransitionMs', resultMs),
        });
    },

    /** Ghi 1 thời lượng Movement (ms) từ picker + nhãn "2.0s" nếu sub panel đã gắn. */
    _commitGradientMs(field, ms) {
        this._commitColorChange((c) => { c.gradientMovement[field] = ms; }, `gradientMovement.${field}=${ms}`);
        if (!visualBgGradientPanelEl) return;
        setVisualBgGradientMsLabel(visualBgGradientPanelEl, field, ms); // core/visual-bg-panel-ui.js
    },

    // ===================== Màn Settings =====================

    /** Màn Background Media / Background Color vừa gắn (bodyHtml do event/workflow/app-settings.js dựng). */
    async openPanel() {
        visualBgSettingsPanelEl = genericDrawerBody;
        await this.refreshPanelUI();
    },

    /** Màn VBG (bất kỳ) đang gắn trong Generic Drawer — Drawer dùng chung 1 body cho mọi màn, chỉ hỏi "Drawer mở" là
     * không đủ. @returns {boolean} */
    _isPanelMounted() {
        if (genericDrawerPanel.classList.contains('hidden')) return false;
        return hasVisualBgPanelRoot(visualBgSettingsPanelEl); // core/visual-bg-panel-ui.js
    },

    /** Đồng bộ màn VBG đang gắn theo config — lúc mở + sau mọi thay đổi; màn chưa gắn thì bỏ qua. */
    async refreshPanelUI() {
        if (!this._isPanelMounted()) return;
        const cfg = appConfigVisualBg.getAll();
        const preset = findMotionPresetById(appState.get('motionPresets'), cfg.motionPresetId); // core/motion-presets.js
        fillVisualBgSettingsPanel(visualBgSettingsPanelEl, cfg, { // core/visual-bg-panel-ui.js
            liveCount: countVisualBgLiveItems(resolveVisualBgDisplayedSource(cfg).list), // core/visual-bg-common.js
            resolutionMode: this._resolutionModeFor(cfg.type),
            motionName: preset ? preset.name : t('visualBgSettingsDrawer.motion.none'),
            gradientCss: buildVisualBgGradientCss(cfg.gradientStops, cfg.gradientAngleDeg),
        });
        await this._refreshSourceNameLabel(cfg);
    },

    /** Hàng Motion: mở danh sách Motion ở chế độ CHỌN; Apply -> `changeMotionPresetId()`, màn Chọn tự back() về đây. */
    openMotionPicker() {
        workflowMotionPresets.openPicker({ // event/workflow/motion-presets.js
            title: t('visualBgSettingsDrawer.motion.label'),
            currentId: appConfigVisualBg.getAll().motionPresetId,
            onApply: (id) => this.changeMotionPresetId(id),
        });
    },

    /** Ghi `motionPresetId` (''/null = gỡ) rồi áp sống lên ảnh/video VBG đang hiện (tự no-op nếu chưa có media hoặc surface
     * đang thuộc Player). @param {string|null} value */
    async changeMotionPresetId(value) {
        const presetId = value || null;
        appConfigVisualBg.mutateAll((cfg) => { cfg.motionPresetId = presetId; });
        console.log(`writer: "workflowVisualBg.changeMotionPresetId", page: "visualBgConfig", content: "motionPresetId=${presetId}"`);
        await this._persist();
        workflowVisualBgPhotoMotion.updatePreset(VISUAL_BG_IMAGE_SURFACE_OWNER, this._currentMotionPreset(), this._photoRecord ? this._computePhotoAdvanceMs(this._photoRecord) : 0); // event/workflow/visual-bg-photo-motion.js
        this._refreshVideoMotion(); // event/workflow/visual-bg-video.js
    },

    /** Toggle "Đồng bộ tốc độ phát" (type 'video'). Áp ngay lên `bgVideoElement` khi VBG Video đang giữ nó (Video Player
     * mode tự áp riêng). @param {boolean} checked */
    async changeSyncPlaybackSpeed(checked) {
        appConfigVisualBg.mutateAll((cfg) => { cfg.videoSyncPlaybackSpeed = checked; });
        console.log(`writer: "workflowVisualBg.changeSyncPlaybackSpeed", page: "visualBgConfig", content: "videoSyncPlaybackSpeed=${checked}"`);
        await this._persist();
        if (!shouldApplyVisualBgVideoSpeedLive(appConfigVisualBg.getAll().type, appState.get('isVideoPlayerMode'))) return; // core/visual-bg-common.js
        this._applyVideoPlaybackSpeedSetting(); // event/workflow/visual-bg-video.js
        this._refreshVideoMotion(); // Point Move tính lại theo playbackRate mới
    },

    /** Resolution VBG đã chuẩn hoá của 1 kind (dùng chung visual-bg-video.js, visual-bg-photo.js, refreshPanelUI()).
     * @param {'video'|'photo'} kind @returns {string} */
    _resolutionModeFor(kind) {
        return normalizePlayerResolutionMode(appConfigVisualBg.getAll()[resolvePlayerResolutionField(kind)]); // core/player-display-settings.js
    },

    /** Select Resolution (card Media) — ghi vào field của `type` đang chọn rồi áp sống lên media đang hiện. Player mode
     * hoặc toggle tổng tắt -> chỉ lưu. @param {string} value - PLAYER_RESOLUTION_MODES[].value */
    async changeResolutionMode(value) {
        const kind = appConfigVisualBg.getAll().type;
        const field = resolvePlayerResolutionField(kind); // core/player-display-settings.js
        const mode = normalizePlayerResolutionMode(value);
        appConfigVisualBg.mutateAll((cfg) => { cfg[field] = mode; });
        console.log(`writer: "workflowVisualBg.changeResolutionMode", page: "visualBgConfig", content: "${field}=${mode}"`);
        await this._persist();
        const { isVideoPlayerMode, isPhotoPlayerMode } = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode']);
        if (isVideoPlayerMode || isPhotoPlayerMode || !this._isMediaEnabled()) return;
        const refresh = VISUAL_BG_RESOLUTION_REFRESH_BY_TYPE[kind];
        if (!refresh) return;
        refresh();
    },

    /** Tên nguồn + 2 nút Làm tươi/Gỡ theo origin đang hiển thị (pending nếu có — panel phản ánh lựa chọn ngay, media
     * hiện tại vẫn phát). */
    async _refreshSourceNameLabel(cfg) {
        const shown = resolveVisualBgDisplayedSource(cfg); // core/visual-bg-common.js
        const hasOrigin = !!shown.originId;
        setVisualBgSourceButtonsVisible(visualBgSettingsPanelEl, hasOrigin); // core/visual-bg-panel-ui.js
        setVisualBgSourceName(visualBgSettingsPanelEl, await VISUAL_BG_SOURCE_LABEL_BY_HAS_ORIGIN[hasOrigin](cfg.type, shown));
    },

    /** Tên hiển thị của 1 origin: 'multi'/'groupMulti' đếm số lượng, 'group' tên folder, còn lại tên item theo type. */
    async _readSourceDisplayName(type, originKind, originId) {
        return (VISUAL_BG_SOURCE_NAME_BY_KIND[originKind] || VISUAL_BG_SOURCE_NAME_BY_KIND.single)(type, originId);
    },

    async _readFolderName(folderId) {
        const folder = await getFolderRecord(folderId); // service/db.js
        return folder ? folder.name : t('visualBgSettingsDrawer.pickSource.none');
    },

    async _readItemName(type, key) {
        const record = await (VISUAL_BG_RECORD_BY_TYPE[type] || VISUAL_BG_RECORD_BY_TYPE.photo)(key);
        return record ? (VISUAL_BG_ITEM_NAME_BY_TYPE[type] || VISUAL_BG_ITEM_NAME_BY_TYPE.photo)(record) : t('visualBgSettingsDrawer.pickSource.none');
    },

    // ===================== Picker Video/Ảnh/Thư mục =====================

    /** Picker mượn chính Generic Drawer của VBG — đóng thì mở lại màn chọn nguồn (Player > Song > Background Media). */
    _closePickerDrawer() {
        this._pickerOpen = false;
        workflowAppSettings._renderPlayerSongBgMedia(); // event/workflow/app-settings.js
    },

    /** Nút "Chọn" theo SỐ LƯỢNG đang chọn — gọi lại sau mỗi lần bấm tile (nút đã wire 1 lần lúc mở picker). */
    _syncPickerConfirmButton() {
        const count = this._pickerSelectedKeys.length;
        setVisualBgPickerConfirmButton(genericDrawerBody, count, VISUAL_BG_PICKER_CONFIRM_LABEL_BY_EMPTY[count === 0](count)); // core/visual-bg-panel-ui.js
    },

    /** Bấm tile: đang chọn thì bỏ, chưa có thì thêm cuối (thứ tự chọn = thứ tự phát). */
    _togglePickerKey(key) {
        this._pickerSelectedKeys = toggleVisualBgPickerKey(this._pickerSelectedKeys, key); // core/visual-bg-common.js
    },

    /** `Map<key, số thứ tự>` cho `setBadgeMode()` — vẽ lại số của MỌI tile (bỏ chọn 1 item giữa làm lệch số các item sau). */
    _pickerKeyOrderMap() {
        return buildVisualBgPickerOrderMap(this._pickerSelectedKeys); // core/visual-bg-common.js
    },

    /** Chọn sang type khác -> gỡ hẳn source/pending cũ (khác kiểu key). */
    _resetSourceForType(type) {
        if (appConfigVisualBg.getAll().type === type) return;
        appConfigVisualBg.mutateAll((c) => { c.type = type; c.source = { originKind: null, originId: null, list: [], videoAudio: {} }; c.pending = { originKind: null, originId: null, list: [] }; });
        console.log(`writer: "workflowVisualBg._resetSourceForType", page: "visualBgConfig", content: "type=${type}, source/pending cleared"`);
    },

    /** Commit picker Video/Ảnh ('multi', giữ thứ tự chọn) rồi báo kết quả. @param {'video'|'photo'} type @param {string[]} keys */
    async _commitPickedKeys(type, keys) {
        if (keys.length === 0) return;
        this._resetSourceForType(type);
        const result = await this._resolveAndCommitSource('multi', encodeVisualBgMultiOriginId(keys)); // core/visual-bg-common.js
        await this._showCommitResultModal(result);
    },

    /** Thư mục — chọn nhiều folder gộp lại ('groupMulti'), dropdown Video/Ảnh trong header picker. Mở đúng `type` hiện
     * tại, chưa từng chọn -> 'video'. */
    async openPickFolder() {
        const currentType = appConfigVisualBg.getAll().type;
        await this._openFolderPickerForType(VISUAL_BG_TYPES.includes(currentType) ? currentType : 'video');
    },

    /** Mở/vẽ lại picker Thư mục dùng chung Playlist (`workflowPlaylist._openFolderPickerDrawer()`) với folder không rỗng
     * của `type`. @param {'photo'|'video'} type @param {boolean} [isUpdate] - true: đổi loại khi picker đang mở */
    async _openFolderPickerForType(type, isUpdate) {
        const eligible = await workflowFolder.listNonEmpty(type); // event/workflow/folder.js
        await workflowPlaylist._openFolderPickerDrawer( // event/workflow/playlist.js
            (folderIds, pickedType) => this._commitFolderMultiSelection(folderIds, pickedType),
            {
                folders: eligible,
                showAddTile: false,
                emptyMsg: VISUAL_BG_FOLDER_EMPTY_MSG_BY_NO_FOLDER[eligible.length === 0](type),
                onClose: () => workflowAppSettings._renderPlayerSongBgMedia(),
                multiSelect: true,
                typeOptions: { current: type },
                onTypeChange: (newType) => this._openFolderPickerForType(newType, true),
            },
            isUpdate,
        );
    },

    /** Commit picker Thư mục — `folderIds` theo đúng thứ tự chọn thành 1 nguồn 'groupMulti'. */
    async _commitFolderMultiSelection(folderIds, type) {
        if (!folderIds || folderIds.length === 0) return;
        this._resetSourceForType(type);
        const result = await this._resolveAndCommitSource('groupMulti', encodeVisualBgMultiOriginId(folderIds));
        await this._showCommitResultModal(result);
    },
};
