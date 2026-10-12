/**
 * event/workflow/motion-presets.js — Workflow của router "motionPresets" — hệ "Cấu hình Motion" độc lập, điều hướng
 * qua `workflowAppSettings.navigateTo()`/`_render()` (màn hình trong Settings), KHÔNG phải Generic Drawer
 * List<->Edit riêng như EQ.
 *
 * Danh sách preset SỐNG ở `appState.motionPresets` (nạp lúc boot từ `meta.motionPresets`, xem loadPresetsOnBoot() —
 * rỗng là HỢP LỆ, KHÔNG seed gì cả). Nơi tiêu thụ (VBG Photo, Player Video/Photo, bất kỳ ai sau này) gọi
 * `openPicker()` — vào THẲNG danh sách ở chế độ CHỌN (tap dòng = chọn, "Apply" ở header = xác nhận -> `onApply(id)`
 * của nơi tiêu thụ tự ghi field riêng của nó -> tự back()), xem nhóm "Chế độ CHỌN" cuối file.
 *
 * Sửa preset áp SỐNG ngay lúc đang hiển thị mà Motion KHÔNG biết nơi tiêu thụ nào: chỉ BROADCAST
 * (`notifyMotionPointMoveEnabledChanged()`, `notifyMotionBeatReactPresetsChanged()`), Runner tự lọc (nguyên tắc tua vít).
 *
 * NẠP SAU: core/motion-presets.js, core/motion-engine.js, core/point-move-timing-ui.js, core/time-picker-modal.js,
 * components/motion-settings-drawer.js, service/db.js (getMeta/setMeta/delMeta).
 * GỌI LÚC CHẠY (liên tuyến domain): workflowAppSettings, workflowPagination (nơi 'motionPresets', dùng CHUNG cho màn
 * Chọn), workflowVisualBg (đọc/ghi `motionPresetId`), event/workflow/motion-point-move-runner.js,
 * event/workflow/motion-beat-react-runner.js.
 */

// ---- Bảng tra UI tương tác của các màn Motion trong Settings ----
// Id ô nhập số / slider của 1 field Point Move theo `which` ('single' | 'min' | 'max').
const POINT_MOVE_NUMBER_INPUT_ID_BY_WHICH = {
    single: (fieldKey) => `ptmove-${fieldKey}-single-input`,
    min: (fieldKey) => `ptmove-${fieldKey}-rangemin-input`,
    max: (fieldKey) => `ptmove-${fieldKey}-rangemax-input`,
};
const POINT_MOVE_SLIDER_ID_BY_WHICH = {
    single: (fieldKey) => `setting-ptmove-${fieldKey}-single`,
    min: (fieldKey) => `setting-ptmove-${fieldKey}-rangemin`,
    max: (fieldKey) => `setting-ptmove-${fieldKey}-rangemax`,
};
// Ghi giá trị ô nhập số (đã kẹp) vào preset theo `which`.
const POINT_MOVE_NUMBER_COMMIT_BY_WHICH = {
    single: (fieldKey, value) => workflowMotionPresets.changePointMoveFieldSingle(fieldKey, value),
    min: (fieldKey, value) => workflowMotionPresets.changePointMoveFieldRange(fieldKey, 'min', value),
    max: (fieldKey, value) => workflowMotionPresets.changePointMoveFieldRange(fieldKey, 'max', value),
};
// Ô nhập số hiển thị giá trị field theo mode.
const POINT_MOVE_FIELD_INPUTS_SYNC_BY_IS_SINGLE = {
    true: (fieldKey, field) => workflowMotionPresets._setInputValueById(POINT_MOVE_NUMBER_INPUT_ID_BY_WHICH.single(fieldKey), field.single),
    false: (fieldKey, field) => {
        workflowMotionPresets._setInputValueById(POINT_MOVE_NUMBER_INPUT_ID_BY_WHICH.min(fieldKey), field.rangeMin);
        workflowMotionPresets._setInputValueById(POINT_MOVE_NUMBER_INPUT_ID_BY_WHICH.max(fieldKey), field.rangeMax);
    },
};
// Hàng Point Move đang kéo: nổi lên (z-index/shadow) + khoá bôi đen chữ; thả ra thì trả về.
const POINT_MOVE_ROW_STYLE_BY_LIFTED = {
    true: { position: 'relative', zIndex: '30', boxShadow: '0 10px 24px rgba(0,0,0,0.25)', userSelect: 'none' },
    false: { position: '', zIndex: '', boxShadow: '', userSelect: '', transform: '' },
};
// Đích thả đang hover: đổi bộ theme key của chính hàng (nền "đang chọn" / nền card).
const POINT_MOVE_ROW_THEME_KEYS_BY_DROP_TARGET = { true: 'rowActiveBg cardBorder', false: 'cardBg cardBorder' };
// Zoom màn Timing — "mức giãn thêm" trục thời gian (0 = không giãn), chỉ view, không persist.
const POINT_MOVE_TIMING_ZOOM_STEPS_PCT = [0, 25, 50, 75, 100];
const POINT_MOVE_TIMING_ZOOM_MAX_EXTRA_SCALE_X = 1; // 100% -> scaleX 2

const workflowMotionPresets = {
    _pointMoveDrag: null, // phiên kéo-sắp-xếp danh sách Point Move: {id, rowEl, startY, rows, blocked, hoverRowEl} — null = không kéo
    _timingZoomIdx: 0,    // bậc zoom màn Timing (POINT_MOVE_TIMING_ZOOM_STEPS_PCT)
    _editingId: null,   // preset đang sửa (màn Edit) — null nếu không ở màn Edit
    _picker: null, // phiên Chọn đang mở: {title, draftId, onApply, pageIndex} — null nếu không ở màn Chọn, xem openPicker()
    _editingPointMoveId: null, // point move đang sửa (màn Point Move Edit) — null nếu không ở màn đó
    _dragPreviewPointMoveId: null, // point move ĐANG kéo trên thanh Timing — null nếu không kéo
    _dragPreviewTimingX: 0,

    /** Gọi từ event/workflow/app-boot.js — đọc `meta.motionPresets`, sanitize.
     * Danh sách preset RỖNG là hợp lệ — KHÔNG seed gì (khác EQ).
     * MIGRATE — bản cũ (trước khi Motion tách khỏi Visual Background) lưu CẢ cấu hình Transition/
     * Ken Burns NGAY TRONG `meta.visualBgConfig.motion` — đọc thẳng RAW meta đó để dựng preset ĐẦU
     * TIÊN + gán `motionPresetId`. CHỈ chạy 1 LẦN DUY NHẤT (guard: `visualBgRaw.motionPresetId` CHƯA
     * từng có). Dọn thêm key meta `motionApply` còn sót của bản cũ (`delMeta`, vô hại nếu không tồn tại). */
    async loadPresetsOnBoot() {
        const raw = await getMeta('motionPresets'); // service/db.js
        let presets = Array.isArray(raw) ? raw.map((p) => sanitizeMotionPreset(p)) : []; // core/motion-presets.js

        const visualBgRaw = await getMeta('visualBgConfig'); // service/db.js — RAW
        if (visualBgRaw && typeof visualBgRaw === 'object' && visualBgRaw.motion && typeof visualBgRaw.motion === 'object' && !('motionPresetId' in visualBgRaw)) {
            const migrated = sanitizeMotionPreset({ ...visualBgRaw.motion, name: t('motionPresetsDrawer.migratedName'), transitionEnabled: true }); // core/motion-presets.js — bản cũ luôn "bật" Transition (chưa có khái niệm tắt)
            presets = [...presets, migrated];
            visualBgRaw.motionPresetId = migrated.id;
            delete visualBgRaw.motion; // dọn field cũ — schema hiện tại không còn định nghĩa
            await setMeta('visualBgConfig', visualBgRaw); // service/db.js — GHI THẲNG (VBG chưa nạp domain lúc này)
            console.log(`writer: "workflowMotionPresets.loadPresetsOnBoot", page: "motionPresets", content: "migrated legacy motion -> preset ${migrated.id}, gán motionPresetId"`);
        }

        appState.set('motionPresets', presets);
        await setMeta('motionPresets', presets); // service/db.js
        await delMeta('motionApply'); // service/db.js — dọn key còn sót của bản cũ
        console.log(`writer: "workflowMotionPresets.loadPresetsOnBoot", page: "motionPresets", content: "${presets.length} preset"`);
    },

    async _persist() {
        await setMeta('motionPresets', appState.get('motionPresets')); // service/db.js
    },

    // ===================== Quản lý cấu hình (danh sách) =====================

    /** Tạo preset trắng, mở NGAY màn Edit của nó. */
    async addPreset() {
        const presets = appState.get('motionPresets');
        const preset = buildBlankMotionPreset(tFormat('motionPresetsDrawer.defaultName', { n: presets.length + 1 })); // core/motion-presets.js
        appState.set('motionPresets', [...presets, preset]);
        await this._persist();
        this._editingId = preset.id;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderMotionEdit()); // liên tuyến domain
    },

    /** Ứng tap 1 dòng preset trong danh sách — mở màn Edit.
     * @param {string} id */
    async tileClick(id) {
        this._editingId = id;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderMotionEdit()); // liên tuyến domain
    },

    /** Ứng nút xoá nhanh trên 1 dòng — xoá thẳng, KHÔNG mở Edit trước.
     * @param {string} id */
    async quickDelete(id) {
        await this._deletePresetById(id);
        workflowAppSettings._renderMotionList(); // liên tuyến domain — vẽ lại TẠI CHỖ
    },

    // ===================== Sửa 1 preset (màn Edit) =====================

    /** Đồng bộ UI màn Edit theo preset đang sửa — gọi sau MỌI field change (Rule 5d). */
    _syncEditUI() {
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (!preset) return;
        const q = (sel) => genericDrawerBody.querySelector(sel); // core/dom-refs.js
        const ratioRow = q('#motion-transition-ratio-row');
        if (ratioRow) ratioRow.classList.toggle('hidden', !transitionSupportsInOutRatio(preset.transitionType)); // core/motion-engine.js
        const directionRow = q('#motion-transition-direction-row');
        if (directionRow) directionRow.classList.toggle('hidden', !transitionSupportsDirection(preset.transitionType));
        const zoomDirectionRow = q('#motion-transition-zoom-direction-row');
        if (zoomDirectionRow) zoomDirectionRow.classList.toggle('hidden', !transitionSupportsZoomDirection(preset.transitionType));
        const spinDirectionRow = q('#motion-transition-spin-direction-row');
        if (spinDirectionRow) spinDirectionRow.classList.toggle('hidden', !transitionSupportsSpinDirection(preset.transitionType));
        const wipeDirectionRow = q('#motion-transition-wipe-direction-row');
        if (wipeDirectionRow) wipeDirectionRow.classList.toggle('hidden', !transitionSupportsWipeDirection(preset.transitionType));
        const curtainDirectionRow = q('#motion-transition-curtain-direction-row');
        if (curtainDirectionRow) curtainDirectionRow.classList.toggle('hidden', !transitionSupportsCurtainDirection(preset.transitionType));
        // 2 dòng phụ CHỈ hiện khi transitionType là 'flipEdge'; dòng checkbox "ảnh trước đứng yên"
        // hiện HẸP HƠN NỮA — CHỈ khi ĐỒNG THỜI edgeFlipVariant==='close'.
        const isEdgeFlip = transitionIsEdgeFlip(preset.transitionType); // core/motion-engine.js
        const variantRow = q('#motion-edge-flip-variant-row');
        if (variantRow) variantRow.classList.toggle('hidden', !isEdgeFlip);
        const staticOldRow = q('#motion-edge-flip-static-old-row');
        if (staticOldRow) staticOldRow.classList.toggle('hidden', !(isEdgeFlip && preset.edgeFlipVariant === 'close'));
        const durationBtn = q('#setting-motion-transition-duration');
        if (durationBtn) durationBtn.textContent = `${(preset.transitionDurationMs / 1000).toFixed(1)}s`;
        const ratioSlider = q('#setting-motion-transition-ratio');
        if (ratioSlider) ratioSlider.value = preset.transitionInOutRatio;
        this._updateTransitionRatioLabel(preset.transitionDurationMs, preset.transitionInOutRatio);
        // Point Move — dòng "Thứ tự chọn" CHỈ hiện khi runMode==='one' ("Return baseline" + "Timing" nằm ở
        // màn danh sách point move, workflowAppSettings._renderPointMoveList()).
        const orderRow = q('#motion-pointmove-order-row');
        if (orderRow) orderRow.classList.toggle('hidden', preset.pointMoveRunMode !== 'one');
    },

    _updateTransitionRatioLabel(transitionDurationMs, ratioPercent) {
        const labelEl = genericDrawerBody ? genericDrawerBody.querySelector('#motion-transition-ratio-label') : null; // core/dom-refs.js
        if (!labelEl) return;
        const { inMs, outMs } = computeMotionEngineTransitionInOutMs(transitionDurationMs, ratioPercent); // core/motion-engine.js
        labelEl.textContent = tFormat('motionSettingsDrawer.transitionRatio.previewFormat', { in: (inMs / 1000).toFixed(1), out: (outMs / 1000).toFixed(1) });
    },

    /** Ghi đè 1 (vài) field của preset ĐANG SỬA (`_editingId`), persist, rồi GỌI
     * `notifyMotionBeatReactPresetsChanged()` (event/workflow/motion-beat-react-runner.js) bất kể field nào — broadcast
     * tới MỌI runner React Beat đang tồn tại (VBG lẫn Player...), mỗi runner tự biết có liên quan tới mình hay không.
     * @param {(preset: object) => void} mutatorFn */
    async _mutateEditing(mutatorFn) {
        const presets = appState.get('motionPresets').map((p) => {
            if (p.id !== this._editingId) return p;
            const copy = { ...p };
            mutatorFn(copy);
            return copy;
        });
        appState.set('motionPresets', presets);
        await this._persist();
        if (typeof notifyMotionBeatReactPresetsChanged !== 'undefined') notifyMotionBeatReactPresetsChanged(); // event/workflow/motion-beat-react-runner.js — liên tuyến domain
    },

    async changeName(name) {
        const trimmed = name.trim();
        if (!trimmed) return; // guard: tên rỗng -> bỏ qua, giữ tên cũ
        await this._mutateEditing((p) => { p.name = trimmed; });
    },

    async changeTransitionEnabled(checked) {
        await this._mutateEditing((p) => { p.transitionEnabled = checked; });
    },

    async changeTransitionType(value) {
        if (!MOTION_ENGINE_TRANSITION_TYPES.includes(value)) return; // core/motion-engine.js
        await this._mutateEditing((p) => { p.transitionType = value; });
        this._syncEditUI();
    },

    async changeTransitionDirection(value) {
        if (!MOTION_ENGINE_TRANSITION_DIRECTIONS_WITH_RANDOM.includes(value)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.transitionDirection = value; });
    },

    async changeTransitionZoomDirection(value) {
        if (!MOTION_ENGINE_ZOOM_DIRECTIONS_WITH_RANDOM.includes(value)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.transitionZoomDirection = value; });
    },

    async changeTransitionSpinDirection(value) {
        if (!MOTION_ENGINE_SPIN_DIRECTIONS_WITH_RANDOM.includes(value)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.transitionSpinDirection = value; });
    },

    async changeTransitionWipeDirection(value) {
        if (!MOTION_ENGINE_WIPE_DIRECTIONS_WITH_RANDOM.includes(value)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.transitionWipeDirection = value; });
    },

    async changeTransitionCurtainDirection(value) {
        if (!MOTION_ENGINE_CURTAIN_DIRECTIONS_WITH_RANDOM.includes(value)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.transitionCurtainDirection = value; });
    },

    async changeEdgeFlipVariant(value) {
        if (!MOTION_ENGINE_EDGE_FLIP_VARIANTS.includes(value)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.edgeFlipVariant = value; });
        this._syncEditUI(); // "close"/"open" đổi -> hàng checkbox edgeFlipStaticOld có thể cần ẩn/hiện lại
    },

    async changeEdgeFlipStaticOld(checked) {
        await this._mutateEditing((p) => { p.edgeFlipStaticOld = checked; });
    },

    /** Ứng nút mở modal chọn "Thời gian chuyển cảnh" — picker CHỈ còn trần cứng
     * `MOTION_ENGINE_TRANSITION_MAX_TIME_MS` (60s)/`MOTION_ENGINE_TRANSITION_MIN_TIME_MS` (300ms).
     * Kẹp THẬT (< thời lượng hiển thị thật) chỉ xảy ra ở RUNTIME qua
     * `capMotionEngineTransitionDurationMs()` (core/motion-engine.js). */
    openTransitionDurationPicker() {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (!preset) return;
        const maxMs = MOTION_ENGINE_TRANSITION_MAX_TIME_MS; // core/motion-engine.js
        openTimePickerModal({ // core/time-picker-modal.js
            title: t('motionSettingsDrawer.transitionDuration.pickerTitle'),
            format: 's-ms',
            valueMs: Math.min(preset.transitionDurationMs, maxMs),
            minMs: MOTION_ENGINE_TRANSITION_MIN_TIME_MS, // core/motion-engine.js
            maxMs,
            onConfirm: async (resultMs) => {
                const v = Math.max(MOTION_ENGINE_TRANSITION_MIN_TIME_MS, Math.min(maxMs, resultMs));
                await this._mutateEditing((p) => { p.transitionDurationMs = v; });
                if (genericDrawerPanel.classList.contains('hidden')) return;
                const btn = genericDrawerBody.querySelector('#setting-motion-transition-duration');
                if (btn) btn.textContent = `${(v / 1000).toFixed(1)}s`;
                const ratioSlider = genericDrawerBody.querySelector('#setting-motion-transition-ratio');
                this._updateTransitionRatioLabel(v, ratioSlider ? Number(ratioSlider.value) : 50);
            },
        });
    },

    previewTransitionRatio(ratioPercent) {
        if (genericDrawerPanel.classList.contains('hidden')) return;
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (preset) this._updateTransitionRatioLabel(preset.transitionDurationMs, ratioPercent);
    },

    async changeTransitionRatio(ratioPercent) {
        const v = Math.max(0, Math.min(100, ratioPercent));
        await this._mutateEditing((p) => { p.transitionInOutRatio = v; });
        this._updateTransitionRatioLabel(findMotionPresetById(appState.get('motionPresets'), this._editingId).transitionDurationMs, v); // core/motion-presets.js
    },

    async changeTransitionEasing(easing) {
        if (!MOTION_ENGINE_TRANSITION_EASINGS.includes(easing)) return; // core/motion-engine.js
        await this._mutateEditing((p) => { p.transitionEasing = easing; });
    },

    // ===================== Point Move (thay Ken Burns) =====================

    /** Công tắc TỔNG (CÙNG khuôn `transitionEnabled`/`reactBeatAudio.enabled`) — Point Move có được
     * ÁP DỤNG lúc phát hay không, ĐỘC LẬP với việc list/run mode/timing đã cấu hình gì (LUÔN hiển
     * thị/chỉnh được bất kể bật/tắt — xem event/workflow/visual-bg-photo-motion.js::_activatePointMove()).
     * Off/on giữa lúc nội dung đang hiện phải áp NGAY: chỉ BROADCAST — Runner nào đang chạy đúng preset này tự áp
     * (mọi nơi tiêu thụ, nguyên tắc tua vít). */
    async changePointMoveEnabled(checked) {
        await this._mutateEditing((p) => { p.pointMoveEnabled = checked; });
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js — bản MỚI NHẤT vừa lưu
        if (preset) notifyMotionPointMoveEnabledChanged(preset, checked); // event/workflow/motion-point-move-runner.js
    },

    /** Ứng dòng "Point move" trong màn Edit — mở danh sách point move. */
    openPointMoveList() {
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPointMoveList()); // liên tuyến domain
    },

    async changePointMoveRunMode(mode) {
        if (!MOTION_POINT_MOVE_RUN_MODES.includes(mode)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.pointMoveRunMode = mode; });
        this._syncEditUI();
    },

    async changePointMoveOneOrder(order) {
        if (!MOTION_POINT_MOVE_ONE_ORDERS.includes(order)) return; // core/motion-presets.js
        await this._mutateEditing((p) => { p.pointMoveOneOrder = order; });
    },

    /** Checkbox "Return baseline" (màn danh sách point move) — CHỈ có ý nghĩa khi `pointMoveRunMode==='all'`.
     * Bật -> chèn mốc ảo x=100=baseline vào đuôi MỌI vòng (xem
     * docstring đầu core/motion-presets.js) — nudge point move đang đứng đúng mốc x=100 bị khoá
     * (+0.2%, CÙNG quy ước addPointMove()). Không checkbox nào khác phụ thuộc -> không cần `_syncEditUI()`.
     * @param {boolean} checked */
    async changePointMoveEndForceBaseline(checked) {
        await this._mutateEditing((p) => {
            p.pointMoveEndForceBaseline = checked;
            if (checked) p.pointMoves = p.pointMoves.map((pm) => (pm.timingX === 100 ? { ...pm, timingX: 99.9 } : pm));
        });
    },

    /** Biên [minX,maxX] kéo/nhập `timingX` HIỆN TẠI của preset đang sửa — `maxX` hẹp lại (99.9) khi
     * `pointMoveEndForceBaseline` đang bật (mốc x=100 đó do baseline chiếm, xem docstring hàm trên)
     * — `minX` LUÔN 0. DÙNG CHUNG cho thanh Timing (`_renderTimingCurve()`) LẪN modal nhập số
     * (`_commitPointMoveTimingModal()`) — tránh lệch biên giữa 2 nơi.
     * @param {object} preset @returns {{minX:number, maxX:number}} */
    _pointMoveTimingBounds(preset) {
        return {
            minX: 0,
            maxX: preset.pointMoveEndForceBaseline ? 99.9 : 100,
        };
    },

    /** Ứng checkbox 1 dòng trong danh sách point move — VỊ TRÍ ĐẦU (index 0) khoá `checked:true`,
     * UI đã disable checkbox đó nên message này thực tế KHÔNG bao giờ gửi cho id ở vị trí 0 (phòng
     * hờ vẫn guard lại ở đây — không tin payload mù).
     * @param {string} id @param {boolean} checked */
    async togglePointMoveChecked(id, checked) {
        await this._mutateEditing((p) => {
            const idx = p.pointMoves.findIndex((pm) => pm.id === id);
            if (idx <= 0) return; // guard: không tìm thấy HOẶC đúng vị trí đầu -> bỏ qua, giữ nguyên khoá
            p.pointMoves[idx] = { ...p.pointMoves[idx], checked };
        });
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain — vẽ lại TẠI CHỖ
    },

    /** `timingX` cho point move MỚI nối vào cuối: +0.2% so với mốc thời gian MUỘN NHẤT đang có (KHÔNG lấy theo phần
     * tử cuối mảng — thứ tự mảng không đảm bảo khớp thứ tự thời gian sau khi kéo node / nhập số / đổi chỗ). Kẹp biên động + tránh trùng mốc (`resolvePointMoveTimingX()`, core/motion-presets.js). Mốc muộn nhất
     * đã chạm biên phải thì không thể "sau" nữa — lùi sát dưới biên (giới hạn tự nhiên của trục 0-100%).
     * @param {object} preset @returns {number} */
    _nextAppendedTimingX(preset) {
        const { minX, maxX } = this._pointMoveTimingBounds(preset);
        const timingXs = preset.pointMoves.map((pm) => pm.timingX);
        const latest = timingXs.length > 0 ? Math.max(...timingXs) : 0;
        return resolvePointMoveTimingX(latest + 0.2, timingXs, minX, maxX); // core/motion-presets.js
    },

    /** Thêm 1 point move trắng vào CUỐI danh sách — `timingX` theo `_nextAppendedTimingX()` (tránh chồng khít
     * lên nhau mỗi lần thêm), vẽ lại TẠI CHỖ. */
    async addPointMove() {
        await this._mutateEditing((p) => {
            const blank = buildBlankPointMove(); // core/motion-presets.js
            blank.timingX = this._nextAppendedTimingX(p);
            p.pointMoves = [...p.pointMoves, blank];
        });
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain
    },

    /** Nhân bản 1 point move — bản sao GIỮ NGUYÊN mọi thông số (deep-copy 6 field con, tránh 2 point
     * move cùng trỏ chung 1 object field gây sửa 1 bên ảnh hưởng bên kia), `id` MỚI, LUÔN `checked:
     * true` mặc định, `timingX` tự tịnh tiến +0.2% (CÙNG quy tắc `addPointMove()` — tránh chồng khít
     * lên bản gốc), chèn vào CUỐI danh sách. Vẽ lại TẠI CHỖ.
     * @param {string} id */
    async duplicatePointMove(id) {
        await this._mutateEditing((p) => {
            const original = p.pointMoves.find((pm) => pm.id === id);
            if (!original) return;
            const clone = {
                ...original,
                id: generatePointMoveId(), // core/motion-presets.js
                checked: true,
                timingX: this._nextAppendedTimingX(p), // CÙNG quy tắc addPointMove()
                linearX: { ...original.linearX }, linearY: { ...original.linearY },
                rotate: { ...original.rotate }, zoom: { ...original.zoom },
                flipX: { ...original.flipX }, flipY: { ...original.flipY },
            };
            p.pointMoves = [...p.pointMoves, clone];
        });
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain
    },

    /** Ứng kéo-thả đổi vị trí TRONG màn Danh sách — HOÁN ĐỔI TOÀN BỘ 2 phần tử mảng (order N VÀ mọi
     * field khác, bao gồm `timingX`) trong 1 thao tác. Point 0 = start point CỐ ĐỊNH (`timingX` khoá cứng = 0,
     * core/motion-presets.js) -> CHẶN nếu 1 trong 2 index là 0 (UI không có tay cầm kéo ở hàng đó; guard phòng hờ).
     * @param {string} idA @param {string} idB */
    async swapPointMoveOrder(idA, idB) {
        if (idA === idB) return;
        await this._mutateEditing((p) => {
            const idxA = p.pointMoves.findIndex((pm) => pm.id === idA);
            const idxB = p.pointMoves.findIndex((pm) => pm.id === idB);
            if (idxA === -1 || idxB === -1 || idxA === 0 || idxB === 0) return;
            const newList = [...p.pointMoves];
            [newList[idxA], newList[idxB]] = [newList[idxB], newList[idxA]];
            p.pointMoves = sanitizeMotionPointMoves(newList); // core/motion-presets.js
        });
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain
    },

    /** Xoá 1 point move — LUÔN giữ ít nhất 1 phần tử (guard, UI đã disable nút xoá khi chỉ còn 1,
     * phòng hờ vẫn chặn lại ở đây). Point 0 (start point) KHÔNG BAO GIỜ xoá được (UI disable nút xoá, guard phòng hờ).
     * @param {string} id */
    async deletePointMove(id) {
        await this._mutateEditing((p) => {
            if (p.pointMoves.length <= 1) return; // guard: không xoá xuống dưới 1
            const idx = p.pointMoves.findIndex((pm) => pm.id === id);
            if (idx === 0) return; // guard: Point 0 (start point) không xoá được
            const filtered = p.pointMoves.filter((pm) => pm.id !== id);
            p.pointMoves = sanitizeMotionPointMoves(filtered); // core/motion-presets.js — ép lại khoá checked+timingX vị trí đầu ngay (không đợi lượt sanitize kế tiếp)
        });
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain
    },

    /** Ứng icon sửa 1 dòng — mở màn Point Move Edit.
     * @param {string} id */
    openPointMoveEdit(id) {
        this._editingPointMoveId = id;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPointMoveEdit()); // liên tuyến domain
    },

    /** Ghi đè 1 (vài) field của point move ĐANG SỬA (`_editingPointMoveId`, thuộc preset `_editingId`).
     * @param {(pointMove: object) => void} mutatorFn */
    async _mutateEditingPointMove(mutatorFn) {
        await this._mutateEditing((p) => {
            const idx = p.pointMoves.findIndex((pm) => pm.id === this._editingPointMoveId);
            if (idx === -1) return;
            const copy = { ...p.pointMoves[idx] };
            mutatorFn(copy);
            p.pointMoves = p.pointMoves.map((pm, i) => (i === idx ? copy : pm));
        });
    },

    /** Đổi đơn vị Linear X/Y (%/px) — RESET single/rangeMin/rangeMax về 0 (2 đơn vị không cùng
     * thang đo, giữ nguyên con số trước đó sẽ vô nghĩa/gây hiểu lầm — vd 150% giữ nguyên số nhưng đổi
     * sang 150px là 1 giá trị HOÀN TOÀN khác ý người dùng đang có).
     * @param {'linearX'|'linearY'} fieldKey @param {string} unit - '%'|'px'. */
    async changePointMoveUnit(fieldKey, unit) {
        if (!MOTION_POINT_MOVE_LINEAR_UNITS.includes(unit)) return; // core/motion-presets.js
        await this._mutateEditingPointMove((pm) => { pm[fieldKey] = { mode: 'single', unit, single: 0, rangeMin: 0, rangeMax: 0 }; });
        workflowAppSettings._renderPointMoveEdit(); // liên tuyến domain — vẽ lại TẠI CHỖ (biên số học đổi theo unit mới)
    },

    /** Đổi chế độ 1 field (single/randomRange).
     * @param {string} fieldKey - 'linearX'|'linearY'|'rotate'|'zoom'|'flipX'|'flipY'.
     * @param {string} mode - 'single'|'randomRange'. */
    async changePointMoveFieldMode(fieldKey, mode) {
        if (!MOTION_POINT_MOVE_FIELD_MODES.includes(mode)) return; // core/motion-presets.js
        await this._mutateEditingPointMove((pm) => { pm[fieldKey] = { ...pm[fieldKey], mode }; });
        this._syncPointMoveEditUI(fieldKey);
    },

    /** Ứng slider "single" (mode==='single') — LIVE preview lúc kéo (`input`), KHÔNG persist mỗi
     * pixel (cùng convention `previewTransitionRatio()`/`transitionRatio.preview`) — chỉ cập nhật `.value` của ô
     * input số, persist THẬT diễn ra ở `changePointMoveFieldSingle()` lúc
     * thả tay (`change`). */
    previewPointMoveFieldSingle(fieldKey, value) {
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        const inputEl = genericDrawerBody.querySelector(`#ptmove-${fieldKey}-single-input`);
        if (inputEl) inputEl.value = value;
    },

    /** Ứng slider "single" (mode==='single') — persist THẬT lúc thả tay (`change`). */
    async changePointMoveFieldSingle(fieldKey, value) {
        if (typeof value !== 'number') return;
        await this._mutateEditingPointMove((pm) => { pm[fieldKey] = { ...pm[fieldKey], single: value }; });
        this._updatePointMoveFieldLabel(fieldKey);
    },

    /** Ứng 1 trong 2 tay kéo dual-range (mode==='randomRange') — `which` phân biệt tay TRÁI/PHẢI.
     * TỰ kẹp min<=max (tay trái vượt tay phải -> đẩy tay phải theo, và ngược lại) — tránh khoảng
     * random rỗng/đảo ngược.
     * @param {string} fieldKey @param {'min'|'max'} which @param {number} value */
    async changePointMoveFieldRange(fieldKey, which, value) {
        if (typeof value !== 'number') return;
        await this._mutateEditingPointMove((pm) => {
            const field = { ...pm[fieldKey] };
            if (which === 'min') { field.rangeMin = value; if (field.rangeMax < value) field.rangeMax = value; }
            else { field.rangeMax = value; if (field.rangeMin > value) field.rangeMin = value; }
            pm[fieldKey] = field;
        });
        workflowAppSettings._renderPointMoveEdit(); // liên tuyến domain — vẽ lại TẠI CHỖ (2 tay kéo có thể cùng đổi vị trí)
    },

    /** Đồng bộ UI 1 field sau khi đổi mode (single<->randomRange) — ẨN/HIỆN đúng cụm slider LẪN cụm
     * ô input số tương ứng, KHÔNG full re-render (giữ nguyên vị trí cuộn màn
     * hình). */
    _syncPointMoveEditUI(fieldKey) {
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        const pointMove = preset ? findPointMoveById(preset.pointMoves, this._editingPointMoveId) : null;
        if (!pointMove) return;
        const field = pointMove[fieldKey];
        const isSingle = field.mode === 'single';
        const singleWrap = genericDrawerBody.querySelector(`#ptmove-${fieldKey}-single-wrap`);
        const rangeWrap = genericDrawerBody.querySelector(`#ptmove-${fieldKey}-range-wrap`);
        if (singleWrap) singleWrap.style.display = isSingle ? '' : 'none';
        if (rangeWrap) rangeWrap.style.display = isSingle ? 'none' : '';
        // Ô input nằm TRONG wrapper (cùng nút "±", components/motion-settings-drawer.js) — toggle hidden ở WRAPPER.
        const singleInputWrap = genericDrawerBody.querySelector(`#ptmove-${fieldKey}-single-input-wrap`);
        const rangeInputWrap = genericDrawerBody.querySelector(`#ptmove-${fieldKey}-range-input-wrap`);
        if (singleInputWrap) singleInputWrap.classList.toggle('hidden', !isSingle);
        if (rangeInputWrap) rangeInputWrap.classList.toggle('hidden', isSingle);
        this._updatePointMoveFieldLabel(fieldKey);
    },

    /** Đổ giá trị field (theo state) lên ô nhập số + dải tô màu dual-range. */
    _updatePointMoveFieldLabel(fieldKey) {
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        const pointMove = preset ? findPointMoveById(preset.pointMoves, this._editingPointMoveId) : null;
        if (!pointMove) return;
        const field = pointMove[fieldKey];
        POINT_MOVE_FIELD_INPUTS_SYNC_BY_IS_SINGLE[field.mode === 'single'](fieldKey, field);
        this._paintPointMoveRangeFill(fieldKey);
    },

    /** Dải tô màu giữa 2 tay kéo dual-range, theo vị trí hiện tại của 2 slider. */
    _paintPointMoveRangeFill(fieldKey) {
        const fillEl = genericDrawerBody.querySelector(`#ptmove-${fieldKey}-range-fill`);
        const minInput = genericDrawerBody.querySelector(`#${POINT_MOVE_SLIDER_ID_BY_WHICH.min(fieldKey)}`);
        const maxInput = genericDrawerBody.querySelector(`#${POINT_MOVE_SLIDER_ID_BY_WHICH.max(fieldKey)}`);
        if (!fillEl || !minInput || !maxInput) return;
        const fill = computePointMoveRangeFill(Number(minInput.min), Number(minInput.max), Number(minInput.value), Number(maxInput.value)); // core/motion-presets.js
        fillEl.style.left = fill.left;
        fillEl.style.width = fill.width;
    },

    _setInputValueById(id, value) {
        const el = genericDrawerBody.querySelector(`#${id}`);
        if (!el) return;
        el.value = value;
    },

    /** 'motionPresets.pointMove.fieldRange.preview' — đang kéo 1 tay dual-range: tô lại dải + 2 ô số theo slider (chưa persist). */
    previewPointMoveFieldRange(fieldKey) {
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        this._paintPointMoveRangeFill(fieldKey);
        this._copySliderValueToInput(fieldKey, 'min');
        this._copySliderValueToInput(fieldKey, 'max');
    },

    _copySliderValueToInput(fieldKey, which) {
        const sliderEl = genericDrawerBody.querySelector(`#${POINT_MOVE_SLIDER_ID_BY_WHICH[which](fieldKey)}`);
        if (!sliderEl) return;
        this._setInputValueById(POINT_MOVE_NUMBER_INPUT_ID_BY_WHICH[which](fieldKey), sliderEl.value);
    },

    /** 'motionPresets.pointMove.numberInput.change' — gõ tay xong (blur/Enter): kẹp theo biên ô, đồng bộ slider, persist.
     * @param {string} fieldKey @param {'single'|'min'|'max'} which @param {string|number} raw */
    async commitPointMoveNumberInput(fieldKey, which, raw) {
        const commit = POINT_MOVE_NUMBER_COMMIT_BY_WHICH[which];
        if (!commit) return;
        const inputEl = genericDrawerBody.querySelector(`#${POINT_MOVE_NUMBER_INPUT_ID_BY_WHICH[which](fieldKey)}`);
        if (!inputEl) return;
        const value = clampMotionNumberInput(raw, Number(inputEl.min), Number(inputEl.max)); // core/motion-presets.js
        inputEl.value = value;
        this._setInputValueById(POINT_MOVE_SLIDER_ID_BY_WHICH[which](fieldKey), value);
        this._paintPointMoveRangeFill(fieldKey);
        await commit(fieldKey, value);
    },

    /** 'motionPresets.pointMove.signToggle.click' — nút "±" (bàn phím decimal iOS không có phím trừ): đảo dấu rồi đi
     * đúng luồng ô nhập số. @param {string} fieldKey @param {'single'|'min'|'max'} which */
    async togglePointMoveInputSign(fieldKey, which) {
        const idFn = POINT_MOVE_NUMBER_INPUT_ID_BY_WHICH[which];
        if (!idFn) return;
        const inputEl = genericDrawerBody.querySelector(`#${idFn(fieldKey)}`);
        if (!inputEl) return;
        await this.commitPointMoveNumberInput(fieldKey, which, -(Number(inputEl.value) || 0));
    },

    // ===================== Point Move — kéo-thả sắp xếp danh sách =====================
    // pointerdown trên tay cầm -> setPointerCapture: pointermove/pointerup về đúng tay cầm đó (delegate
    // event/listener/motion-presets.js), không gắn listener lên `document`.

    /** 'motionPresets.pointMove.drag.start' — nhấc hàng lên, ghi phiên kéo. Point 0 (start point) không bao giờ là đích.
     * @param {{id:string, clientY:number, handleEl:HTMLElement, pointerId:number}} payload */
    startPointMoveDrag({ id, clientY, handleEl, pointerId }) {
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (!preset) return;
        const rows = Array.from(genericDrawerBody.querySelectorAll('[data-ptmove-row]'));
        const rowEl = rows.find((row) => row.dataset.ptmoveRow === id);
        if (!rowEl) return;
        const point0Id = preset.pointMoves[0] ? preset.pointMoves[0].id : null;
        handleEl.setPointerCapture(pointerId);
        this._pointMoveDrag = { id, rowEl, startY: clientY, rows, blocked: rows.map((row) => row === rowEl || row.dataset.ptmoveRow === point0Id), hoverRowEl: null };
        Object.assign(rowEl.style, POINT_MOVE_ROW_STYLE_BY_LIFTED.true);
        document.body.style.userSelect = 'none';
    },

    /** 'motionPresets.pointMove.drag.move' — hàng bám theo con trỏ, tô sáng đích thả. @param {number} clientY */
    movePointMoveDrag(clientY) {
        const drag = this._pointMoveDrag;
        if (!drag) return; // guard: rê chuột qua tay cầm mà không kéo
        drag.rowEl.style.transform = `translateY(${clientY - drag.startY}px) scale(1.02)`;
        const index = findPointMoveDropRowIndex(drag.rows.map((row) => row.getBoundingClientRect()), clientY, drag.blocked); // core/motion-presets.js
        this._setDropTarget(drag, drag.rows[index] || null);
    },

    /** 'motionPresets.pointMove.drag.end' — thả: trả hàng về, hoán đổi nếu có đích khác chính nó. */
    async endPointMoveDrag() {
        const drag = this._pointMoveDrag;
        if (!drag) return;
        this._pointMoveDrag = null;
        Object.assign(drag.rowEl.style, POINT_MOVE_ROW_STYLE_BY_LIFTED.false);
        document.body.style.userSelect = '';
        const targetId = drag.hoverRowEl ? drag.hoverRowEl.dataset.ptmoveRow : null;
        this._setDropTarget(drag, null);
        await this._swapIfDropped(drag.id, targetId);
    },

    _setDropTarget(drag, rowEl) {
        if (drag.hoverRowEl === rowEl) return;
        this._paintDropTarget(drag.hoverRowEl, false);
        this._paintDropTarget(rowEl, true);
        drag.hoverRowEl = rowEl;
    },

    _paintDropTarget(rowEl, isTarget) {
        if (!rowEl) return;
        rowEl.dataset.uitk = POINT_MOVE_ROW_THEME_KEYS_BY_DROP_TARGET[isTarget];
        applyUiThemeToDom(rowEl, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
    },

    async _swapIfDropped(fromId, toId) {
        if (!toId || toId === fromId) return;
        await this.swapPointMoveOrder(fromId, toId);
    },

    // ===================== Point Move — Timing (chỉ dùng khi pointMoveRunMode==='all') =====================

    /** Ứng nút "Timing" trong màn Edit — mở màn thanh Timing. */
    openPointMoveTiming() {
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPointMoveTiming()); // liên tuyến domain
    },

    /** Tính danh sách node (CHỈ point move đã tick, sort theo `timingX`) — DÙNG CHUNG cho
     * `_renderTimingCurve()` (dựng lại TOÀN BỘ SVG) LẪN `_patchTimingPreview()` (chỉ vá lại phần tử
     * ĐANG có, xem 2 hàm dưới). `overrideId` khác null -> point move ĐÓ dùng `overrideTimingX` thay
     * vì giá trị đã lưu (preview LIVE, chưa persist).
     * @param {object} preset @param {string|null} overrideId @param {number} [overrideTimingX]
     * @returns {object[]} */
    _computeTimingPoints(preset, overrideId, overrideTimingX) {
        return preset.pointMoves
            .filter((p, i) => i !== 0 && p.checked) // Point 0 (start point, timingX khoá cứng = 0) không hiện trên đồ thị
            .map((p) => (p.id === overrideId ? { ...p, timingX: overrideTimingX } : p))
            .map((p) => ({ id: p.id, timingX: p.timingX, locked: false, n: preset.pointMoves.findIndex((pm) => pm.id === p.id) })) // `n` = ĐÚNG index trong MẢNG GỐC (khớp tên "Point move N" ở màn Danh sách), không phải vị trí sau khi lọc/sort ở đây
            .sort((a, b) => a.timingX - b.timingX);
    },

    /** Dựng lại TOÀN BỘ SVG (xoá sạch + `buildPointMoveTimingCurveEl()` mới) — CHỈ gọi lúc mở màn
     * lần đầu hoặc SAU KHI đã persist xong 1 lượt sửa (commit) — KHÔNG gọi liên tục lúc đang kéo
     * (xem `_patchTimingPreview()`, tách riêng đúng vì lý do đó: xoá/dựng lại SVG giữa chừng lúc
     * đang kéo sẽ làm `draggingEl`/toạ độ core-ui đang giữ bị "treo" — phần tử đang giữ đã bị gỡ khỏi DOM,
     * `getBoundingClientRect()` trả về rỗng, toạ độ tính tiếp sẽ sai/NaN).
     * @param {HTMLElement} containerEl - `#ptmove-timing-container`. */
    _renderTimingCurve(containerEl) {
        if (!containerEl) return;
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (!preset) return;
        const points = this._computeTimingPoints(preset, this._dragPreviewPointMoveId, this._dragPreviewTimingX);
        const { minX, maxX } = this._pointMoveTimingBounds(preset);
        containerEl.innerHTML = '';
        containerEl.appendChild(buildPointMoveTimingCurveEl(points, minX, maxX)); // core/point-move-timing-ui.js
    },

    /** Vá LIVE vị trí 1 node NGAY TRONG SVG đang có (KHÔNG xoá/dựng lại — xem lý do ở
     * `_renderTimingCurve()`).
     * @param {string} id @param {number} timingX */
    _patchTimingPreview(id, timingX) {
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        const container = genericDrawerBody.querySelector('#ptmove-timing-container'); // core/dom-refs.js
        const svgEl = container ? container.querySelector('.ptmove-timing-svg') : null;
        const nodeEl = svgEl ? svgEl.querySelector(`circle[data-point-move-id="${id}"]`) : null;
        if (!nodeEl) return;
        const usableW = POINT_MOVE_TIMING_SVG_W - POINT_MOVE_TIMING_PAD_X * 2; // core/point-move-timing-ui.js (consts)
        nodeEl.setAttribute('cx', POINT_MOVE_TIMING_PAD_X + (timingX / 100) * usableW);
    },

    /** Preview LIVE khi đang kéo 1 node (mỗi `pointermove`, KHÔNG persist) — vá tại chỗ.
     * @param {string} id @param {number} timingX */
    previewPointMoveTimingDrag(id, timingX) {
        this._dragPreviewPointMoveId = id;
        this._dragPreviewTimingX = timingX;
        this._patchTimingPreview(id, timingX);
    },

    /** `pointerup` sau khi ĐÃ kéo đủ xa (core-ui tự phân biệt tap/kéo) — CHỐT giá trị đang preview
     * vào preset thật (persist), dựng lại TOÀN MÀN cho chắc ăn đồng bộ tuyệt đối sau khi ghi.
     * `resolvePointMoveTimingX()` tự làm tròn 2
     * chữ số thập phân + đẩy nhẹ nếu trùng 1 point move khác trước khi ghi. */
    async commitPointMoveTimingDrag() {
        const id = this._dragPreviewPointMoveId;
        if (!id) return;
        const timingX = this._dragPreviewTimingX;
        this._dragPreviewPointMoveId = null;
        await this._mutateEditing((p) => {
            const idx = p.pointMoves.findIndex((pm) => pm.id === id);
            if (idx <= 0) return; // guard: không tìm thấy HOẶC đúng Point 0 (start point, timingX khoá cứng) — phòng hờ, không tin payload mù
            const { minX, maxX } = this._pointMoveTimingBounds(p);
            const others = p.pointMoves.filter((pm) => pm.id !== id).map((pm) => pm.timingX);
            const resolved = resolvePointMoveTimingX(timingX, others, minX, maxX); // core/motion-presets.js
            p.pointMoves[idx] = { ...p.pointMoves[idx], timingX: resolved };
        });
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        workflowAppSettings._renderPointMoveTiming(); // liên tuyến domain — dựng lại TOÀN màn (an toàn, commit chỉ xảy ra 1 lần lúc thả tay, không phải mỗi pixel)
    },

    /** onMount màn Timing — zoom luôn bắt đầu từ 0 (view mới dựng). */
    resetPointMoveTimingZoom() {
        this._timingZoomIdx = 0;
    },

    /** 'motionPresets.pointMove.timingZoom.click' — +1/-1 bậc giãn trục thời gian (chỉ view). @param {number} delta */
    stepPointMoveTimingZoom(delta) {
        this._timingZoomIdx = Math.max(0, Math.min(POINT_MOVE_TIMING_ZOOM_STEPS_PCT.length - 1, this._timingZoomIdx + delta));
        const extraPct = POINT_MOVE_TIMING_ZOOM_STEPS_PCT[this._timingZoomIdx];
        const zoomableEl = genericDrawerBody.querySelector('#ptmove-timing-container');
        const labelEl = genericDrawerBody.querySelector('#ptmove-timing-zoom-label');
        if (zoomableEl) zoomableEl.style.transform = computePointMoveTimingZoomTransform(extraPct, POINT_MOVE_TIMING_ZOOM_MAX_EXTRA_SCALE_X); // core/motion-presets.js
        if (labelEl) labelEl.textContent = `${extraPct}%`;
    },

    /** Ứng TAP (không kéo) 1 node trên thanh — mở modal nhập số CHÍNH XÁC thay vì kéo tay.
     * @param {string} id */
    openPointMoveTimingNodeModal(id) {
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        if (!preset) return;
        const idx = preset.pointMoves.findIndex((p) => p.id === id);
        if (idx <= 0) return; // guard: không tìm thấy HOẶC đúng Point 0 (không còn là node trên đồ thị nữa) — phòng hờ
        const pm = preset.pointMoves[idx];
        const { minX, maxX } = this._pointMoveTimingBounds(preset); // biên ĐỘNG
        // Giữ THAM CHIẾU ô số ngay sau khi mở, đọc `.value` trong onClick — modalChoice() gỡ overlay khỏi DOM TRƯỚC khi
        // gọi onClick nhưng phần tử đã tách vẫn đọc được.
        modalChoice( // core/modal-choice-ui.js
            tFormat('motionSettingsDrawer.pointMove.itemName', { n: idx }),
            [{
                label: t('common.save'),
                className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnPrimaryBg btnPrimaryHoverBg textOnAccent',
                onClick: () => this._commitPointMoveTimingModal(id, Number(xInput.value)),
            }],
            { bodyHtml: renderPointMoveTimingModalBody(minX, maxX, pm.timingX) }, // components/motion-settings-drawer.js
        );
        const xInput = document.getElementById('ptmove-modal-x-input');
    },

    /** Ứng nút "Lưu" trong modal (`openPointMoveTimingNodeModal()`) — commit số ĐÃ gõ, tự kẹp biên
     * (phòng số ngoài min/max input, dù browser thường tự chặn — vẫn không tin mù).
     * `resolvePointMoveTimingX()` tự làm tròn 2
     * chữ số thập phân + đẩy nhẹ nếu trùng 1 point move khác trước khi ghi.
     * @param {string} id @param {number} timingX */
    async _commitPointMoveTimingModal(id, timingX) {
        if (typeof timingX !== 'number' || Number.isNaN(timingX)) return;
        await this._mutateEditing((p) => {
            const idx = p.pointMoves.findIndex((pm) => pm.id === id);
            if (idx <= 0) return; // guard: không tìm thấy HOẶC đúng Point 0 — phòng hờ, không tin payload mù
            const { minX, maxX } = this._pointMoveTimingBounds(p);
            const clampedX = Math.max(minX, Math.min(maxX, timingX));
            const others = p.pointMoves.filter((pm) => pm.id !== id).map((pm) => pm.timingX);
            const resolved = resolvePointMoveTimingX(clampedX, others, minX, maxX); // core/motion-presets.js
            p.pointMoves[idx] = { ...p.pointMoves[idx], timingX: resolved };
        });
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        workflowAppSettings._renderPointMoveTiming(); // liên tuyến domain
    },

    // ===================== React Beat Audio =====================

    /** Ứng MỌI thay đổi field trong nhóm "React Beat Audio" — GENERIC 1 hàm DUY NHẤT cho cả field
     * top-level (`enabled`, `effectKey=null`) LẪN 4 cụm con zoom/panX/panY/rotate (`effectKey` tương
     * ứng). Áp sống: `_mutateEditing()` tự broadcast `notifyMotionBeatReactPresetsChanged()` sau MỌI field.
     * `randomMax` — boolean, CÙNG khuôn `enabled`/`reverse`.
     * @param {'zoom'|'panX'|'panY'|'rotate'|null} effectKey - null = field top-level.
     * @param {string} fieldKey - 'enabled' | 'maxPct' | 'maxDeg' | 'direction' | 'reverse' | 'randomMax'.
     * @param {boolean|number|string} value
     */
    async changeBeatReactField(effectKey, fieldKey, value) {
        if (fieldKey === 'enabled' || fieldKey === 'reverse' || fieldKey === 'randomMax') {
            if (typeof value !== 'boolean') return;
        } else if (fieldKey === 'maxPct') {
            const [min, max] = (effectKey === 'panX' || effectKey === 'panY') ? [100, 150] : [100, 200]; // zoom
            if (typeof value !== 'number' || value < min || value > max) return;
        } else if (fieldKey === 'maxDeg') {
            if (typeof value !== 'number' || value < 0 || value > 360) return;
        } else if (fieldKey === 'direction') {
            const validDirections = effectKey === 'panY' ? MOTION_BEAT_REACT_DIRECTIONS_Y : MOTION_BEAT_REACT_DIRECTIONS; // core/motion-presets.js
            if (!validDirections.includes(value)) return;
        } else {
            return; // fieldKey lạ -> bỏ qua, không ghi mù
        }
        await this._mutateEditing((p) => {
            const target = effectKey ? p.reactBeatAudio[effectKey] : p.reactBeatAudio;
            target[fieldKey] = value;
        });
        if (genericDrawerPanel.classList.contains('hidden') || !effectKey) return;
        if (fieldKey === 'maxPct' || fieldKey === 'maxDeg') {
            // Ô số sync 2 chiều với slider — đồng bộ cả 2 VỀ giá trị vừa persist (phòng trường hợp value đến từ chính input đó,
            // gõ tay đã đúng rồi thì set lại vô hại; đến từ slider thì input cần cập nhật theo).
            const inputEl = genericDrawerBody.querySelector(`#motion-beatreact-${effectKey}-max-input`);
            if (inputEl) inputEl.value = value;
            const sliderEl = genericDrawerBody.querySelector(`#setting-motion-beatreact-${effectKey}-max`);
            if (sliderEl) sliderEl.value = value;
        }
    },

    /** 'motionPresets.beatReact.maxSlider.input' — đang kéo slider Max: chỉ cập nhật ô số (persist lúc thả tay). */
    previewBeatReactMax(effectKey, value) {
        this._setInputValueById(`motion-beatreact-${effectKey}-max-input`, value);
    },

    /** 'motionPresets.beatReact.maxInput.change' — gõ tay ô Max: kẹp theo biên ô, rồi đi luồng changeBeatReactField()
     * (tự đồng bộ lại slider). */
    async commitBeatReactMaxInput(effectKey, fieldKey, raw) {
        const inputEl = genericDrawerBody.querySelector(`#motion-beatreact-${effectKey}-max-input`);
        if (!inputEl) return;
        const value = clampMotionNumberInput(raw, Number(inputEl.min), Number(inputEl.max)); // core/motion-presets.js
        inputEl.value = value;
        this._setInputValueById(`setting-motion-beatreact-${effectKey}-max`, value);
        await this.changeBeatReactField(effectKey, fieldKey, value);
    },

    // ===================== Random giá trị slider theo nhóm =====================

    /** 'motionPresets.beatReact.random.click' — nút xúc xắc nhóm React Beat: mỗi lần bấm sinh lại Max của cả 4 slider
     * (zoom/panX/panY/rotate — core/motion-presets.js::buildRandomBeatReactMaxValues()); bật/tắt, hướng, Reverse,
     * Random Max giữ nguyên. Ghi qua `_mutateEditing()` (persist + broadcast live cho runner đang chạy), đồng bộ
     * slider + ô số tại chỗ (không vẽ lại cả màn, giữ vị trí cuộn). */
    async randomizeBeatReactValues() {
        const values = buildRandomBeatReactMaxValues(); // core/motion-presets.js
        await this._mutateEditing((p) => {
            const rb = { ...p.reactBeatAudio };
            values.forEach(({ effectKey, fieldKey, value }) => { rb[effectKey] = { ...rb[effectKey], [fieldKey]: value }; });
            p.reactBeatAudio = rb;
        });
        console.log(`writer: "workflowMotionPresets.randomizeBeatReactValues", page: "motionPresets", content: "${this._editingId} — ${values.map((v) => `${v.effectKey}=${v.value}`).join(', ')}"`);
        if (genericDrawerPanel.classList.contains('hidden')) return; // core/dom-refs.js
        values.forEach(({ effectKey, value }) => {
            this._setInputValueById(`motion-beatreact-${effectKey}-max-input`, value);
            this._setInputValueById(`setting-motion-beatreact-${effectKey}-max`, value);
        });
    },

    /** 'motionPresets.pointMove.random.click' — nút xúc xắc màn Point Move Edit: mỗi lần bấm sinh lại giá trị cả 6
     * slider của point move đang sửa (core/motion-presets.js::buildRandomPointMoveFieldValues() — giữ mode/đơn vị),
     * rồi vẽ lại TẠI CHỖ (dual-range cần dựng lại vị trí 2 tay kéo, cùng cách `changePointMoveFieldRange()`). */
    async randomizePointMoveValues() {
        const preset = findMotionPresetById(appState.get('motionPresets'), this._editingId); // core/motion-presets.js
        const pointMove = preset ? findPointMoveById(preset.pointMoves, this._editingPointMoveId) : null; // core/motion-presets.js
        if (!pointMove) return; // guard: point move vừa bị xoá
        const fields = buildRandomPointMoveFieldValues(pointMove); // core/motion-presets.js
        await this._mutateEditingPointMove((pm) => { Object.assign(pm, fields); });
        console.log(`writer: "workflowMotionPresets.randomizePointMoveValues", page: "motionPresets", content: "${this._editingId}/${this._editingPointMoveId} — 6 field random"`);
        workflowAppSettings._renderPointMoveEdit(); // liên tuyến domain — vẽ lại TẠI CHỖ
    },

    // ===================== Quản lý preset =====================

    /** Header "Reset" — về ĐÚNG mặc định `buildBlankMotionPreset()` (GIỮ id/name, chỉ reset các
     * field cấu hình). Vẽ lại TẠI CHỖ. */
    async resetEditing() {
        const presets = appState.get('motionPresets');
        const current = findMotionPresetById(presets, this._editingId); // core/motion-presets.js
        if (!current) return;
        const blank = buildBlankMotionPreset(current.name); // core/motion-presets.js — id mới sinh ra ở đây KHÔNG dùng, chỉ lấy field cấu hình
        await this._mutateEditing((p) => {
            p.transitionEnabled = blank.transitionEnabled;
            p.transitionType = blank.transitionType;
            p.transitionDurationMs = blank.transitionDurationMs;
            p.transitionInOutRatio = blank.transitionInOutRatio;
            p.transitionEasing = blank.transitionEasing;
            p.transitionDirection = blank.transitionDirection;
            p.transitionZoomDirection = blank.transitionZoomDirection;
            p.transitionSpinDirection = blank.transitionSpinDirection;
            p.transitionWipeDirection = blank.transitionWipeDirection;
            p.transitionCurtainDirection = blank.transitionCurtainDirection;
            p.edgeFlipVariant = blank.edgeFlipVariant;
            p.edgeFlipStaticOld = blank.edgeFlipStaticOld;
            p.pointMoves = blank.pointMoves;
            p.pointMoveEnabled = blank.pointMoveEnabled;
            p.pointMoveRunMode = blank.pointMoveRunMode;
            p.pointMoveOneOrder = blank.pointMoveOneOrder;
            p.reactBeatAudio = blank.reactBeatAudio;
        });
        workflowAppSettings._renderMotionEdit(); // liên tuyến domain — vẽ lại TẠI CHỖ, đúng field mới
    },

    /** Header "Xoá" — xoá hẳn preset đang sửa, quay về danh sách Quản lý. */
    async deleteEditing() {
        await this._deletePresetById(this._editingId);
        this._editingId = null;
        workflowAppSettings.back(); // liên tuyến domain — quay về đúng màn Danh sách vừa đến từ đó
    },

    /** Dùng CHUNG cho `quickDelete()` (danh sách) VÀ `deleteEditing()` (header Edit) — xoá khỏi
     * `appState.motionPresets`, gỡ tham chiếu bên Photo VBG NẾU đang gắn đúng preset này (field
     * `*PresetId` của Player KHÔNG cần gỡ — runtime tự coi id không còn tồn tại là "chưa gắn", xem
     * event/workflow/player-display-settings.js).
     * @param {string} id */
    async _deletePresetById(id) {
        const presets = appState.get('motionPresets').filter((p) => p.id !== id);
        appState.set('motionPresets', presets);
        await this._persist();
        if (typeof workflowVisualBg !== 'undefined' && appConfigVisualBg.getAll().motionPresetId === id) { // liên tuyến domain
            appConfigVisualBg.mutateAll((c) => { c.motionPresetId = null; });
            await workflowVisualBg._persist(); // liên tuyến domain
        }
    },

    // ===================== Chế độ CHỌN (picker) — nơi tiêu thụ mở THẲNG danh sách Motion =====================
    // Nơi tiêu thụ (VBG Photo,
    // Player Video/Photo — và bất kỳ ai sau này) gọi `openPicker()` -> vào THẲNG danh sách Motion (DÙNG
    // CHUNG hạ tầng pagination nơi 'motionPresets' với màn Quản lý), tap 1 dòng = CHỌN (nháp, CHƯA ghi gì),
    // nút "Apply" ở header = xác nhận -> gọi `onApply(id)` (nơi tiêu thụ tự ghi field RIÊNG của nó) rồi tự
    // back() về màn trước. Back/Close mà chưa bấm Apply = huỷ, không ghi gì.
    // `onApply` là tham số MỜ (opaque) do Workflow nơi tiêu thụ truyền vào — CÙNG khuôn `onConfirm` của
    // openTimePickerModal() — Motion KHÔNG biết nơi tiêu thụ là ai, không gọi tên Workflow nào của họ.

    /** Mở màn Chọn — đi TỚI (navigateTo), mở đúng trang có preset đang gắn. `currentId` trỏ tới preset
     * đã bị xoá -> coi như "None".
     * @param {{title:string, currentId:(string|null), onApply:(id:(string|null)) => (void|Promise<void>)}} config */
    openPicker(config) {
        if (!config || typeof config.onApply !== 'function') return; // guard: thiếu đích nhận kết quả -> không mở
        const presets = appState.get('motionPresets');
        const current = findMotionPresetById(presets, config.currentId); // core/motion-presets.js
        const draftId = current ? current.id : null;
        this._picker = {
            title: config.title,
            draftId,
            onApply: config.onApply,
            pageIndex: workflowPagination.pageIndexOfItem('motionPresets', presets.findIndex((p) => p.id === draftId)), // event/workflow/pagination.js — -1 (None) -> trang 0
        };
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderMotionPicker()); // liên tuyến domain
    },

    /** Dữ liệu vẽ màn Chọn — gọi bởi `workflowAppSettings._renderMotionPicker()` (mỗi lần vẽ). Tự kẹp
     * `pageIndex` (vd số item/trang vừa đổi). null = không có phiên Chọn nào đang mở.
     * @returns {{title:string, draftId:(string|null), view:object}|null} */
    getPickerRenderData() {
        if (!this._picker) return null;
        const view = workflowPagination.computePlaceView('motionPresets', appState.get('motionPresets'), this._picker.pageIndex); // event/workflow/pagination.js
        this._picker.pageIndex = view.pageIndex;
        return { title: this._picker.title, draftId: this._picker.draftId, view };
    },

    /** Ứng tap 1 dòng — CHỈ đổi nháp + vẽ lại TẠI CHỖ (giữ vị trí cuộn), KHÔNG ghi gì. '' = dòng "None".
     * @param {string} id */
    selectPickerDraft(id) {
        if (!this._picker) return;
        if (id && !findMotionPresetById(appState.get('motionPresets'), id)) return; // guard: id lạ -> bỏ qua, không tin payload mù
        this._picker.draftId = id || null;
        workflowAppSettings._renderMotionPicker(); // liên tuyến domain
    },

    /** Ứng thanh phân trang màn Chọn — vẽ lại tại chỗ, cuộn về đầu (cùng khuôn setMotionListPage()).
     * Nháp đang chọn GIỮ NGUYÊN qua các trang.
     * @param {number} pageIndex */
    setPickerPage(pageIndex) {
        if (!this._picker) return;
        this._picker.pageIndex = pageIndex;
        workflowAppSettings._renderMotionPicker(); // liên tuyến domain
        genericDrawerBody.scrollTop = 0; // core/dom-refs.js
    },

    /** Ứng nút "Apply" ở header — kết thúc phiên TRƯỚC (tránh bấm đúp ghi 2 lần), đợi nơi tiêu thụ ghi
     * xong lựa chọn, rồi back() về màn nơi tiêu thụ (màn đó tự vẽ lại theo giá trị mới). */
    async applyPicker() {
        const picker = this._picker;
        if (!picker) return;
        this._picker = null;
        await picker.onApply(picker.draftId);
        workflowAppSettings.back(); // liên tuyến domain
    },
};
