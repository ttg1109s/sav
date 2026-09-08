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

    /** Thời lượng hiển thị 1 ảnh (ms) — CHỈ có ý nghĩa ở mode 'slideshow' (nơi VBG THẬT SỰ hẹn giờ
     * chuyển ảnh theo 1 khoảng cụ thể) — dùng cho hẹn giờ tự chuyển ảnh (`_syncPhotoTicking()`) và
     * tham số `advanceMs` truyền cho `workflowMotionEngine` (Point Move dựng đường cong dựa trên
     * đây). Mode 'perSong' KHÔNG có khái niệm "hiển thị bao lâu" (ảnh đổi theo lúc bài hát đổi —
     * thời lượng đó VBG không biết trước, `durationMode`/`durationSeconds` là tuỳ chọn RIÊNG của
     * slideshow, không được đem vào ca này) -> trả THẲNG 0, KHÔNG fallback `record.duration`/5s
     * (Motion Engine tự hiểu `advanceMs<=0` = bỏ qua Point Move hoàn toàn, xem `_activatePointMove()`,
     * event/workflow/motion-engine.js).
     * @param {object|null} record - record ảnh đang/sắp hiện (mode 'duration' cần `record.duration`).
     * @returns {number}
     */
    _computePhotoAdvanceMs(record) {
        const cfg = appConfigVisualBg.getAll();
        if (cfg.listPlaybackMode === 'perSong') return 0;
        if (cfg.durationMode === 'fixtime') return Math.max(0.5, cfg.durationSeconds) * 1000;
        const durationSec = (record && record.duration) || 5;
        return Math.max(1000, durationSec * 1000);
    },

    /** Bắt đầu áp ảnh MỚI cho toàn bộ `source.list` (boot/đổi nguồn/đổi scope) — chọn item đầu
     * (`firstIndex()`, DÙNG CHUNG với video, tự đúng cho cả list rỗng/1 phần tử/nhiều phần tử —
     * KHÔNG còn cần rẽ nhánh riêng theo độ dài list, xem `_showCurrentPhoto()`), rồi tự đặt/không
     * đặt hẹn giờ tuỳ điều kiện HIỆN TẠI (`_syncPhotoTicking()`).
     * SỬA (Giang chỉ ra tách trách nhiệm VBG/Motion Engine) — trước đây rẽ nhánh `list.length<=1`
     * gọi thẳng `applyVisualBgImageToDOM()` (bypass hẳn Motion Engine, #visual-bg-image), khiến
     * Point Move/React Beat không chạy được cho nguồn 1 ảnh. Giờ MỌI trường hợp đều qua
     * `workflowMotionEngine.showImage()` — Engine tự quyết hiện tĩnh hay transition dựa trên
     * `_hasCurrentResource` CỦA NÓ, VBG không cần biết/không còn phân biệt 1 ảnh hay nhiều ảnh. */
    async _applyPhoto(cfg) {
        const { list: startList, index } = this.firstIndex(cfg.source.list, cfg.nextOrder === 'random');
        if (startList !== cfg.source.list) await this.persistSourceListMutation(startList);
        this._listIndex = index;
        await this._showCurrentPhoto(startList[index]);
        this._syncPhotoTicking();
    },

    /** Đọc record + tạo blob URL + giao cho Motion Engine hiện — DÙNG CHUNG cho `_applyPhoto()`
     * (ảnh đầu) VÀ `_photoTick()` (ảnh kế) — cả 2 nơi đều chỉ khác nhau ở cách CHỌN `key`, còn cách
     * HIỆN nó thì giống hệt nhau, không còn lý do tách riêng. `key` rỗng/null (list rỗng sau lọc) ->
     * báo Engine gỡ hẳn resource (`showImage(null, ...)`, tương đương `stop()`). Record mất -> tự
     * đánh dấu null trong list, KHÔNG tự thử ảnh khác (nơi gọi rearm hẹn giờ/advance lượt sau tự lo).
     * SỬA (đối chiếu đánh giá — không được khẳng định "không có đường fail sau createBlobUrl()")
     * — bọc try/catch quanh bước giao ownership: `workflowMotionEngine` không tồn tại (load-order
     * hỏng) hoặc `showImage()` throw giữa chừng -> Engine CHƯA NHẬN ownership, VBG tự revoke ngay,
     * không để URL treo lại không ai dọn. Lỗi thật (nếu có) vẫn ném tiếp ra ngoài, không nuốt.
     * @param {string|null} key */
    async _showCurrentPhoto(key) {
        if (!key) { if (typeof workflowMotionEngine !== 'undefined') await workflowMotionEngine.showImage(null); return; }
        const record = await getImageRecord(key);
        if (!record || !record.blob) {
            const newList = markVisualBgListItemMissing(appConfigVisualBg.getAll().source.list, this._listIndex);
            await this.persistSourceListMutation(newList);
            return;
        }
        this._photoRecord = record;
        const objectUrl = createBlobUrl(record.blob); // service/blob-url.js
        const advanceMs = this._computePhotoAdvanceMs(record);
        if (typeof workflowMotionEngine === 'undefined') { revokeBlobUrl(objectUrl); return; } // Engine chưa nạp -> chưa ai nhận ownership, tự dọn
        try {
            await workflowMotionEngine.showImage(objectUrl, this._currentMotionPreset(), advanceMs); // thành công -> Engine nhận ownership NGAY, VBG không revoke lại
        } catch (e) {
            revokeBlobUrl(objectUrl); // giao thất bại giữa chừng -> Engine chưa kịp giữ URL, VBG tự thu hồi
            throw e;
        }
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
     * nếu vừa hết 1 vòng, random tự xáo lại nếu vừa chạm vị trí cuối), giao `_showCurrentPhoto()`
     * hiện ảnh kế (Engine tự vào nhánh transition vì đã có resource từ lượt trước). Null/record mất
     * -> giữ nguyên ảnh cũ (KHÔNG tự thử tiếp), vẫn rearm hẹn giờ cho vòng SAU (hẹn giờ KHÔNG BAO GIỜ
     * đứng hình, kể cả gặp item hỏng liên tiếp, vì rearm nằm ở `_syncPhotoTicking()` gọi CUỐI). */
    async _photoTick() {
        if (await this._checkAndApplyPendingSource()) return;
        const cfg = appConfigVisualBg.getAll();
        if (cfg.type !== 'photo') return;
        const isRandom = cfg.nextOrder === 'random';
        const { list, index } = this.advanceList(cfg.source.list, this._listIndex, isRandom);
        if (index === -1) { await this.selfHealEmptySource(); return; }
        if (list !== cfg.source.list) await this.persistSourceListMutation(list);
        this._listIndex = index;
        await this._showCurrentPhoto(list[index]);
        this._syncPhotoTicking();
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
