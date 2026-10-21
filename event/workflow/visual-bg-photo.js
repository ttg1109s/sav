/**
 * event/workflow/visual-bg-photo.js — Workflow domain "Visual Background", phần RIÊNG cho Photo: áp/chuyển ảnh trong
 * `source.list`, hẹn giờ (chuyển ảnh kế khi cycle slideshow / lặp Point Move khi ảnh đứng yên), Motion preset đang gắn,
 * picker Ảnh. `Object.assign()` thêm vào `workflowVisualBg` (event/workflow/visual-bg-common.js, nạp trước). Hiện ảnh /
 * Transition / Point Move: Image surface event/workflow/visual-bg-photo-motion.js — file này chỉ quyết KHI NÀO và VỚI GÌ.
 *
 * Thời lượng 1 ảnh (`_computePhotoAdvanceMs()`): đang cycle + 'fixtime' -> `durationSeconds`; còn lại (cycle 'duration',
 * 1 nguồn, perSong) -> `record.duration` của chính ảnh. Ảnh đứng yên (1 nguồn / perSong) chạy lại Point Move mỗi thời
 * lượng ảnh — cùng nhịp VBG Video tự lặp theo độ dài video.
 *
 * NẠP SAU: event/workflow/visual-bg-common.js, core/visual-bg-photo.js, event/workflow/visual-bg-photo-motion.js.
 */

/** Hẹn giờ của ảnh VBG — 1 task cho cả chuyển ảnh kế lẫn lặp Point Move (2 việc không bao giờ cùng lúc). */
const VISUAL_BG_PHOTO_ADVANCE_TASK = 'visualBgPhotoAdvance';

// Thời lượng 1 ảnh (resolveVisualBgItemDurationSource(), core/visual-bg-common.js).
const VISUAL_BG_PHOTO_ADVANCE_MS_BY_SOURCE = {
    fixtime: (cfg) => computeVisualBgFixtimeMs(cfg.durationSeconds), // core/visual-bg-common.js
    natural: (cfg, record) => computeVisualBgPhotoNaturalMs(record ? record.duration : 0), // core/visual-bg-photo.js
};
// Hẹn giờ theo resolveVisualBgPhotoTickRoute() (core/visual-bg-photo.js).
const VISUAL_BG_PHOTO_TICK_BY_ROUTE = {
    advance: (ms) => taskManager.once(() => workflowVisualBg._photoTick(), ms, VISUAL_BG_PHOTO_ADVANCE_TASK),
    replay: (ms) => taskManager.once(() => workflowVisualBg._replayPhotoPointMove(), ms, VISUAL_BG_PHOTO_ADVANCE_TASK),
    off: () => taskManager.kill(VISUAL_BG_PHOTO_ADVANCE_TASK),
};
const VISUAL_BG_PHOTO_SHOW_BY_HAS_KEY = {
    true: (key) => workflowVisualBg._loadAndShowPhoto(key),
    false: () => workflowVisualBgPhotoMotion.showImage(null), // list rỗng sau lọc -> gỡ hẳn ảnh
};
const VISUAL_BG_PHOTO_SHOW_BY_USABLE = {
    true: (record) => workflowVisualBg._handOverPhoto(record),
    false: () => workflowVisualBg._markCurrentPhotoMissing(),
};
const VISUAL_BG_PHOTO_TICK_BY_EMPTY = {
    true: () => workflowVisualBg.selfHealEmptySource(),
    false: (next, cfg) => workflowVisualBg._stepPhotoTo(next, cfg),
};

Object.assign(workflowVisualBg, {
    _photoRecord: null, // record ảnh ĐANG hiện — tính thời lượng mà không đọc DB lại
    _photoPickerRowHeightPx: 120, // = PHOTO_ROW_HEIGHT_PX (event/workflow/file-manager-photo.js), tách riêng để không phụ thuộc thứ tự nạp

    /** Preset Motion đang gắn cho VBG — nơi duy nhất tra `appState.motionPresets`; chưa gắn / đã xoá ->
     * `MOTION_ENGINE_NO_OP_PRESET` (core/motion-presets.js). @returns {object} */
    _currentMotionPreset() {
        const presetId = appConfigVisualBg.getAll().motionPresetId;
        const preset = presetId ? findMotionPresetById(appState.get('motionPresets'), presetId) : null; // core/motion-presets.js
        return preset || MOTION_ENGINE_NO_OP_PRESET;
    },

    /** Preset React Beat của VBG (getter cho Image/Video surface) — tra tươi theo `motionPresetId` mỗi lần gọi.
     * @returns {object|null} */
    _getMotionBeatPreset() {
        const preset = this._currentMotionPreset();
        return isReactBeatPresetActive(preset) ? preset : null; // core/motion-presets.js
    },

    /** Thời lượng hiển thị 1 ảnh (ms) — hẹn giờ chuyển/lặp và hành trình Point Move. @param {object|null} record @returns {number} */
    _computePhotoAdvanceMs(record) {
        const cfg = appConfigVisualBg.getAll();
        return VISUAL_BG_PHOTO_ADVANCE_MS_BY_SOURCE[this._itemDurationSource(cfg)](cfg, record);
    },

    /** Áp ảnh cho toàn bộ `source.list` (boot/đổi nguồn): chọn item đầu, hiện, rồi đặt hẹn giờ theo điều kiện hiện tại. */
    async _applyPhoto(cfg) {
        const { list: startList, index } = this.firstIndex(cfg.source.list, cfg.nextOrder === 'random');
        if (startList !== cfg.source.list) await this.persistSourceListMutation(startList);
        this._listIndex = index;
        await this._showCurrentPhoto(startList[index]);
        this._syncPhotoTicking();
    },

    /** Key ảnh VBG đang hiện — đọc bởi `workflowMediaInUse` (nơi đó tự kiểm VBG đang là type 'photo'). */
    getCurrentPhotoKey() {
        const list = appConfigVisualBg.getAll().source.list;
        return list[this._listIndex] || null;
    },

    /** Hiện lại ảnh VBG đang chạy sau khi file của nó vừa bị thay. CHỈ gọi từ `workflowMediaInUse` (đã kiểm state). */
    async reloadCurrentPhoto() {
        const key = this.getCurrentPhotoKey();
        if (!key) return;
        await this._showCurrentPhoto(key);
        console.log(`[workflowVisualBg.reloadCurrentPhoto] hiện lại ảnh nền "${key}"`);
    },

    /** Hiện 1 ảnh của list (dùng chung ảnh đầu / ảnh kế). `key` rỗng -> gỡ ảnh. @param {string|null} key */
    async _showCurrentPhoto(key) {
        await VISUAL_BG_PHOTO_SHOW_BY_HAS_KEY[!!key](key);
    },

    async _loadAndShowPhoto(key) {
        const record = await getImageRecord(key); // service/db.js
        await VISUAL_BG_PHOTO_SHOW_BY_USABLE[isVisualBgPhotoRecordUsable(record)](record); // core/visual-bg-photo.js
    },

    /** Record mất -> đánh dấu null trong list, không tự thử ảnh khác (lượt sau tự bước tiếp). */
    async _markCurrentPhotoMissing() {
        await this.persistSourceListMutation(markVisualBgListItemMissing(appConfigVisualBg.getAll().source.list, this._listIndex)); // core/visual-bg-common.js
    },

    /** Giao ảnh cho Image surface — thành công thì surface giữ + tự revoke object URL; ném lỗi giữa chừng thì VBG thu hồi
     * ngay (lỗi vẫn ném tiếp). 1 preset lái cả Transition lẫn Point Move; Transition kẹp theo thời lượng ảnh. */
    async _handOverPhoto(record) {
        this._photoRecord = record;
        const objectUrl = createBlobUrl(record.blob); // service/blob-url.js
        const motionPreset = this._currentMotionPreset();
        try {
            await workflowVisualBgPhotoMotion.showImage(objectUrl, { // event/workflow/visual-bg-photo-motion.js
                owner: VISUAL_BG_IMAGE_SURFACE_OWNER, // event/workflow/visual-bg-common.js
                transitionPreset: motionPreset,
                pointMovePreset: motionPreset,
                advanceMs: this._computePhotoAdvanceMs(record),
                backgroundSize: this._computePhotoResolutionCss(record),
                getBeatPresetFn: () => this._getMotionBeatPreset(),
            });
        } catch (e) {
            revokeBlobUrl(objectUrl);
            throw e;
        }
    },

    /** `background-size` ảnh VBG theo `photoResolutionMode` của VBG — cùng phép tính Player Photo ('trueMax' cần
     * `record.width/height`, record cũ thiếu -> 'contain'). @param {object|null} record @returns {string} */
    _computePhotoResolutionCss(record) {
        return workflowPlayerDisplaySettings.resolvePhotoBackgroundSizeCss(this._resolutionModeFor('photo'), record); // event/workflow/player-display-settings.js
    },

    /** Đổi Resolution sống lúc VBG Photo đang hiện ảnh (surface tự chặn sai owner). */
    _refreshPhotoResolution() {
        if (!this._photoRecord) return;
        workflowVisualBgPhotoMotion.updateBackgroundSize(VISUAL_BG_IMAGE_SURFACE_OWNER, this._computePhotoResolutionCss(this._photoRecord));
    },

    /** Đặt lại hẹn giờ theo điều kiện HIỆN TẠI — sau khi áp ảnh, mỗi nhịp xong, Song play/pause (`syncPlaybackToAudio()`). */
    _syncPhotoTicking() {
        const cfg = appConfigVisualBg.getAll();
        const route = resolveVisualBgPhotoTickRoute({ // core/visual-bg-photo.js
            isMediaEnabled: isVisualBgMediaEnabled(cfg),
            isPhotoType: cfg.type === 'photo',
            isSongActive: this._isSongActiveForVbg(),
            isCycling: this._isSlideshowCycling(cfg),
            hasPhoto: !!this._photoRecord,
        });
        VISUAL_BG_PHOTO_TICK_BY_ROUTE[route](this._computePhotoAdvanceMs(this._photoRecord));
    },

    /** Ảnh đứng yên (1 nguồn / perSong) — hết 1 thời lượng ảnh thì chạy lại Point Move từ đầu rồi hẹn lượt kế. */
    _replayPhotoPointMove() {
        if (!this._photoRecord) return;
        workflowVisualBgPhotoMotion.restartPointMove(VISUAL_BG_IMAGE_SURFACE_OWNER, this._currentMotionPreset(), this._computePhotoAdvanceMs(this._photoRecord)); // event/workflow/visual-bg-photo-motion.js
        this._syncPhotoTicking();
    },

    /** 1 nhịp chuyển ảnh: pending trước (điểm "lượt kế tiếp"), rồi bước index qua `advanceList()`; list rỗng sau dọn -> gỡ
     * nguồn. Ảnh mất -> giữ ảnh cũ, vẫn hẹn lại cho vòng sau (rearm ở cuối `_stepPhotoTo()`). */
    async _photoTick() {
        if (!this._isMediaEnabled()) return;
        if (await this._checkAndApplyPendingSource()) return;
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type !== 'photo') return;
        const next = this.advanceList(cfg.source.list, this._listIndex, cfg.nextOrder === 'random');
        await VISUAL_BG_PHOTO_TICK_BY_EMPTY[next.index === -1](next, cfg);
    },

    async _stepPhotoTo(next, cfg) {
        if (next.list !== cfg.source.list) await this.persistSourceListMutation(next.list);
        this._listIndex = next.index;
        await this._showCurrentPhoto(next.list[next.index]);
        this._syncPhotoTicking();
    },

    /** Mở picker Ảnh multi-select — cùng khuôn `openPickVideo()`; danh sách bỏ ảnh thuộc folder Hidden. */
    async openPickPhoto() {
        this._pickerSelectedKeys = [];
        workflowGenericDrawerHelpers.mountMediaPicker({
            routerName: 'visualBg', msgPrefix: 'visualBg.photoPicker', title: t('visualBgSettingsDrawer.pickPhoto.label'),
            bodyHtml: renderVisualBgMultiPickerBodyHtml('visual-bg-photo-picker-scroll', 'visual-bg-photo-picker-empty', t('fileManager.photo.image.empty')), // components/visual-bg-settings-drawer.js
            tileSelector: '[data-image-key]', tileDataKey: 'imageKey', showConfirmButton: true, updateInPlace: true,
        });
        this._pickerOpen = true;

        const images = await workflowPlaylistScope.listPickableMedia('photo'); // event/workflow/playlist-scope.js
        if (!this._pickerOpen) return;
        const scrollEl = fillVisualBgPickerList(genericDrawerBody, 'visual-bg-photo-picker-scroll', 'visual-bg-photo-picker-empty', images.length); // core/visual-bg-panel-ui.js
        workflowPhotoGalleryWindow.mount('genericDrawer', { scrollEl, images, rowHeightPx: this._photoPickerRowHeightPx, badgeMode: 'multiSelect', selectedKeys: new Map() });
    },

    /** 'visualBg.photoPicker.tile.click'. */
    togglePhotoPickerTile(imageKey) {
        this._togglePickerKey(imageKey);
        workflowPhotoGalleryWindow.setBadgeMode('genericDrawer', 'multiSelect', this._pickerKeyOrderMap());
        this._syncPickerConfirmButton();
    },

    /** 'visualBg.photoPicker.confirm.click'. */
    async confirmPhotoPickerSelection() {
        if (this._pickerSelectedKeys.length === 0) return;
        const keys = this._pickerSelectedKeys.slice();
        workflowPhotoGalleryWindow.unmount('genericDrawer');
        this._closePickerDrawer();
        await this._commitPickedKeys('photo', keys);
    },

    cancelPhotoPicker() {
        workflowPhotoGalleryWindow.unmount('genericDrawer');
        this._closePickerDrawer();
    },
});
