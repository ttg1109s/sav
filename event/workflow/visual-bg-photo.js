/**
 * event/workflow/visual-bg-photo.js — Workflow domain "Visual Background", phần RIÊNG cho Photo:
 * áp/chuyển ảnh trong `source.list`, hẹn giờ tự chuyển ảnh kế, Motion preset đang gắn, picker
 * Ảnh. `Object.assign()` thêm vào `workflowVisualBg` (định nghĩa ở event/workflow/
 * visual-bg-common.js, PHẢI nạp trước file này) — cùng 1 object, chỉ tách file tổ chức.
 * Render/transition/Point Move của ảnh nền sống ở event/workflow/motion-engine.js (Motion Engine)
 * — file này chỉ quyết định KHI NÀO/CÓ chuyển ảnh hay không, gọi Motion Engine render.
 *
 * NẠP SAU: event/workflow/visual-bg-common.js, core/visual-bg-photo.js, event/workflow/motion-engine.js.
 */

/** Hẹn giờ tự chuyển ảnh kế — VBG tự sở hữu quyết định "khi nào chuyển item kế" cho cả 2 type,
 * Motion Engine chỉ còn là hàm render thuần được gọi tới. */
const VISUAL_BG_PHOTO_ADVANCE_TASK = 'visualBgPhotoAdvance';

Object.assign(workflowVisualBg, {
    _photoRecord: null, // record ảnh ĐANG hiện — dùng tính _computePhotoAdvanceMs() mode 'duration' mà không đọc DB lại mỗi lần
    _photoPickerRowHeightPx: 120, // cùng giá trị PHOTO_ROW_HEIGHT_PX (event/workflow/file-manager-photo.js), tách riêng để không phụ thuộc thứ tự nạp file

    /** Đọc preset Motion đang gắn cho Photo VBG — nơi duy nhất tra `appState.motionPresets`
     * (`workflowMotionEngine` nhận preset đã resolve qua tham số, không tự đọc). Chưa gắn/preset
     * không còn tồn tại -> `MOTION_ENGINE_NO_OP_PRESET` (core/motion-engine.js).
     * @returns {object}
     */
    _currentMotionPreset() {
        const presetId = appConfigVisualBg.getAll().motionPresetId;
        const preset = presetId ? findMotionPresetById(appState.get('motionPresets'), presetId) : null;
        return preset || (typeof MOTION_ENGINE_NO_OP_PRESET !== 'undefined' ? MOTION_ENGINE_NO_OP_PRESET : null);
    },

    /** Thời lượng hiển thị 1 ảnh (ms) — dùng cho hẹn giờ tự chuyển ảnh (`_syncPhotoTicking()`) và
     * tham số duration truyền cho `workflowMotionEngine`.
     * @param {object|null} record - record ảnh đang/sắp hiện (mode 'duration' cần `record.duration`).
     * @returns {number}
     */
    _computePhotoAdvanceMs(record) {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.durationMode === 'fixtime') return Math.max(0.5, cfg.durationSeconds) * 1000;
        const durationSec = (record && record.duration) || 5;
        return Math.max(1000, durationSec * 1000);
    },

    /** list.length<=1 -> áp tĩnh trực tiếp (không qua Motion Engine, không hẹn giờ chuyển ảnh — chỉ
     * 1 ảnh thì không có gì để chuyển sang); >1 -> bắt đầu cycle (VBG tự sở hữu hẹn giờ, xem
     * `_startPhotoCycle()`). */
    async _applyPhoto(cfg) {
        const list = cfg.source.list;
        if (list.length <= 1) {
            if (list[0]) await this._playSinglePhotoKey(list[0]);
            return;
        }
        await this._startPhotoCycle(cfg);
    },

    /** Bắt đầu 1 vòng cycle ảnh MỚI — chọn item đầu (`firstIndex()`, DÙNG CHUNG với video), hiện nó
     * TĨNH qua `workflowMotionEngine.reveal()` (đã resolve preset + advanceMs sẵn), rồi tự đặt/không
     * đặt hẹn giờ tuỳ điều kiện HIỆN TẠI (`_syncPhotoTicking()`). */
    async _startPhotoCycle(cfg) {
        const { list: startList, index } = this.firstIndex(cfg.source.list, cfg.nextOrder === 'random');
        if (startList !== cfg.source.list) await this.persistSourceListMutation(startList);
        this._listIndex = index;
        const key = startList[index];
        if (!key) { this._syncPhotoTicking(); return; }
        const record = await getImageRecord(key);
        if (!record || !record.blob) {
            const newList = markVisualBgListItemMissing(startList, index);
            await this.persistSourceListMutation(newList);
            this._syncPhotoTicking();
            return;
        }
        this._photoRecord = record;
        const advanceMs = this._computePhotoAdvanceMs(record);
        if (typeof workflowMotionEngine !== 'undefined') await workflowMotionEngine.reveal(key, this._currentMotionPreset(), advanceMs);
        this._syncPhotoTicking();
    },

    /** Bật/tắt hẹn giờ tự chuyển ảnh kế theo đúng điều kiện HIỆN TẠI — gọi lại MỖI LẦN điều kiện CÓ
     * THỂ vừa đổi: bắt đầu cycle, mỗi tick xong (rearm cho vòng kế), Song play/pause
     * (`syncPlaybackToAudio()`). Điều kiện CHẠY: type='photo' + Song đang phát thật + KHÔNG phải
     * `perSong` (mode đó chuyển ảnh do ĐỔI BÀI quyết định, không phải hẹn giờ) + còn >1 item sống. */
    _syncPhotoTicking() {
        const cfg = appConfigVisualBg.getAll();
        const shouldRun = cfg.type === 'photo' && !audioPlayer.paused && cfg.listPlaybackMode !== 'perSong' && this._effectiveCount(cfg.source.list) > 1;
        if (shouldRun) {
            taskManager.once(() => this._photoTick(), this._computePhotoAdvanceMs(this._photoRecord), VISUAL_BG_PHOTO_ADVANCE_TASK);
        } else {
            taskManager.kill(VISUAL_BG_PHOTO_ADVANCE_TASK);
        }
    },

    /** 1 nhịp cycle: check pending TRƯỚC (cùng nguyên tắc `_checkAndApplyPendingSource()` dùng
     * chung mọi điểm "lượt kế tiếp"), rồi bước index qua `advanceList()` (DÙNG CHUNG video, dọn null
     * nếu vừa hết 1 vòng, random tự xáo lại nếu vừa chạm vị trí cuối), đọc DB, gọi
     * `workflowMotionEngine.transitionTo()`. Null/record mất -> đánh dấu/giữ nguyên ảnh cũ (KHÔNG tự
     * thử tiếp), vẫn rearm hẹn giờ cho vòng SAU (khác bug cũ — hẹn giờ giờ KHÔNG BAO GIỜ đứng hình,
     * kể cả gặp item hỏng liên tiếp, vì rearm nằm ở `_syncPhotoTicking()` gọi CUỐI MỌI nhánh). */
    async _photoTick() {
        if (await this._checkAndApplyPendingSource()) return;
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type !== 'photo') return;
        const isRandom = cfg.nextOrder === 'random';
        const { list, index } = this.advanceList(cfg.source.list, this._listIndex, isRandom);
        if (index === -1) { await this.selfHealEmptySource(); return; }
        if (list !== cfg.source.list) await this.persistSourceListMutation(list);
        this._listIndex = index;
        const key = list[index];
        if (!key) { this._syncPhotoTicking(); return; }

        const record = await getImageRecord(key);
        if (!record || !record.blob) {
            const newList = markVisualBgListItemMissing(list, index);
            await this.persistSourceListMutation(newList);
            this._syncPhotoTicking();
            return;
        }
        this._photoRecord = record;
        const advanceMs = this._computePhotoAdvanceMs(record);
        if (typeof workflowMotionEngine !== 'undefined') await workflowMotionEngine.transitionTo(key, this._currentMotionPreset(), advanceMs);
        this._syncPhotoTicking();
    },

    /** Nguồn duy nhất mất (record không đọc được) -> không có gì để chờ advance() tiếp, tự chữa
     * lành hẳn (gỡ source) luôn thay vì đánh dấu null. */
    async _playSinglePhotoKey(imageKey) {
        const record = await getImageRecord(imageKey);
        if (!record || !record.blob) { await this.clearSource(); return; }
        const objectUrl = createBlobUrl(record.blob);
        appState.set('visualBgImageObjectUrl', objectUrl);
        applyVisualBgImageToDOM(true, objectUrl);
    },

    /** Mở picker Ảnh multi-select — cùng khuôn `openPickVideo()`. */
    async openPickPhoto() {
        this._pickerSelectedKeys = [];
        this._pickerCleanup = openMediaPickerDrawerUi(
            'visualBg', 'visualBg.photoPicker', t('visualBgSettingsDrawer.pickPhoto.label'),
            this._buildMultiPickerBodyHtml('visual-bg-photo-picker-scroll', 'visual-bg-photo-picker-empty', t('fileManager.photo.image.empty')),
            '[data-image-key]', 'imageKey', true, true,
        );

        const images = await listImages();
        if (!this._pickerCleanup) return;

        const scrollEl = genericDrawerBody.querySelector('#visual-bg-photo-picker-scroll');
        const emptyEl = genericDrawerBody.querySelector('#visual-bg-photo-picker-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', images.length > 0);
        workflowPhotoGalleryWindow.mount('genericDrawer', { scrollEl, images, rowHeightPx: this._photoPickerRowHeightPx, badgeMode: 'multiSelect', selectedKeys: new Map() });
    },

    /** Ứng 'visualBg.photoPicker.tile.click' — cùng khuôn `toggleVideoPickerTile()`. */
    togglePhotoPickerTile(imageKey) {
        this._togglePickerKey(imageKey);
        workflowPhotoGalleryWindow.setBadgeMode('genericDrawer', 'multiSelect', this._pickerKeyOrderMap());
        this._syncPickerConfirmButton();
    },

    /** Ứng 'visualBg.photoPicker.confirm.click'. */
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
