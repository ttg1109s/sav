/**
 * event/workflow/motion-presets.js — Workflow router "motionPresets" (Cấu hình Motion): các màn trong Settings điều hướng qua
 * `workflowAppSettings.navigateTo()`/`_render*()`. Chỉ chuẩn bị (đọc state/DB, tra phần tử) + điều phối — biến đổi preset ở
 * core thuần core/motion-presets.js, ghi DOM ở core/motion-presets-ui.js.
 *
 * Danh sách preset sống ở `appState.motionPresets` (nạp lúc boot từ `meta.motionPresets`, rỗng là hợp lệ). Nơi tiêu thụ (VBG
 * Photo, Player Video/Photo) gọi `openPicker()` — danh sách ở chế độ CHỌN, "Apply" gọi `onApply(id)` của nơi tiêu thụ rồi
 * back(). Sửa preset đang hiển thị: chỉ BROADCAST (`notifyMotionPointMoveEnabledChanged()`,
 * `notifyMotionBeatReactPresetsChanged()`), Runner tự lọc — Motion không biết nơi tiêu thụ nào.
 *
 * NẠP SAU: core/motion-presets.js, core/motion-presets-ui.js, core/motion-engine.js, core/point-move-timing-ui.js,
 * core/time-picker-modal.js, core/modal-choice-ui.js, components/motion-settings-drawer.js, service/db.js.
 * GỌI LÚC CHẠY: workflowAppSettings, workflowPagination, workflowVisualBg (gỡ `motionPresetId` khi xoá preset),
 * event/workflow/motion-point-move-runner.js, event/workflow/motion-beat-react-runner.js.
 */

/** Id ô nhập số / slider của 1 field Point Move theo `which` ('single' | 'min' | 'max'). */
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
/** Ghi giá trị ô nhập số (đã kẹp) vào preset theo `which`. */
const POINT_MOVE_NUMBER_COMMIT_BY_WHICH = {
    single: (fieldKey, value) => workflowMotionPresets.changePointMoveFieldSingle(fieldKey, value),
    min: (fieldKey, value) => workflowMotionPresets.changePointMoveFieldRange(fieldKey, 'min', value),
    max: (fieldKey, value) => workflowMotionPresets.changePointMoveFieldRange(fieldKey, 'max', value),
};
/** Ô nhập số hiển thị giá trị field theo mode. */
const POINT_MOVE_FIELD_INPUTS_SYNC_BY_MODE = {
    single: (fieldKey, field) => setMotionInputValues([workflowMotionPresets._drawerElById(POINT_MOVE_NUMBER_INPUT_ID_BY_WHICH.single(fieldKey))], field.single), // core/motion-presets-ui.js
    randomRange: (fieldKey, field) => {
        setMotionInputValues([workflowMotionPresets._drawerElById(POINT_MOVE_NUMBER_INPUT_ID_BY_WHICH.min(fieldKey))], field.rangeMin);
        setMotionInputValues([workflowMotionPresets._drawerElById(POINT_MOVE_NUMBER_INPUT_ID_BY_WHICH.max(fieldKey))], field.rangeMax);
    },
};

/** Field React Beat: cách kiểm giá trị (core/motion-presets.js) + có đồng bộ lại ô số/slider Max sau khi lưu không. */
const BEAT_REACT_FIELD_RULE_BY_KEY = {
    enabled: { isValid: (effectKey, value) => isBeatReactToggleValue(effectKey, value), syncsMaxInputs: false },
    reverse: { isValid: (effectKey, value) => isBeatReactToggleValue(effectKey, value), syncsMaxInputs: false },
    randomMax: { isValid: (effectKey, value) => isBeatReactToggleValue(effectKey, value), syncsMaxInputs: false },
    maxPct: { isValid: (effectKey, value) => isBeatReactMaxPctValue(effectKey, value), syncsMaxInputs: true },
    maxDeg: { isValid: (effectKey, value) => isBeatReactMaxDegValue(effectKey, value), syncsMaxInputs: true },
    direction: { isValid: (effectKey, value) => isBeatReactDirectionValue(effectKey, value), syncsMaxInputs: false },
};
/** Ghi field React Beat: cấp nhóm (`effectKey` null — `enabled`) hay của 1 hiệu ứng con. */
const BEAT_REACT_WRITE_BY_HAS_EFFECT = {
    true: (rb, effectKey, fieldKey, value) => setBeatReactEffectField(rb, effectKey, fieldKey, value), // core/motion-presets.js
    false: (rb, effectKey, fieldKey, value) => setBeatReactTopField(rb, fieldKey, value),
};

/** Phần tử màn Edit preset (components/motion-settings-drawer.js). */
const MOTION_EDIT_SELECTORS = {
    ratioRow: '#motion-transition-ratio-row',
    directionRow: '#motion-transition-direction-row',
    zoomDirectionRow: '#motion-transition-zoom-direction-row',
    spinDirectionRow: '#motion-transition-spin-direction-row',
    wipeDirectionRow: '#motion-transition-wipe-direction-row',
    curtainDirectionRow: '#motion-transition-curtain-direction-row',
    variantRow: '#motion-edge-flip-variant-row',
    staticOldRow: '#motion-edge-flip-static-old-row',
    durationBtn: '#setting-motion-transition-duration',
    ratioSlider: '#setting-motion-transition-ratio',
    orderRow: '#motion-pointmove-order-row',
};

const workflowMotionPresets = {
    _pointMoveDrag: null, // phiên kéo-sắp-xếp danh sách Point Move: {id, rowEl, startY, rows, blocked, hoverRowEl} — null = không kéo
    _timingZoomIdx: 0,    // bậc zoom màn Timing (POINT_MOVE_TIMING_ZOOM_STEPS_PCT, core/motion-presets.js)
    _editingId: null,   // preset đang sửa (màn Edit) — null nếu không ở màn Edit
    _picker: null, // phiên Chọn đang mở: {title, draftId, onApply, pageIndex} — null nếu không ở màn Chọn, xem openPicker()
    _editingPointMoveId: null, // point move đang sửa (màn Point Move Edit) — null nếu không ở màn đó
    _dragPreviewPointMoveId: null, // point move ĐANG kéo trên thanh Timing — null nếu không kéo
    _dragPreviewTimingX: 0,

    /** Gọi từ event/workflow/app-boot.js — đọc + làm sạch `meta.motionPresets`; di trú cấu hình Motion cũ trong
     * `meta.visualBgConfig.motion` thành preset (1 lần); dọn key `motionApply` còn sót của bản cũ. */
    async loadPresetsOnBoot() {
        const [raw, visualBgRaw] = await Promise.all([getMeta('motionPresets'), getMeta('visualBgConfig')]); // service/db.js
        const presets = await this._migrateLegacyVisualBgMotion(this._sanitizePresetList(raw), visualBgRaw);
        appState.set('motionPresets', presets);
        await setMeta('motionPresets', presets); // service/db.js
        await delMeta('motionApply');
        console.log(`writer: "workflowMotionPresets.loadPresetsOnBoot", page: "motionPresets", content: "${presets.length} preset"`);
    },

    /** @param {*} raw - `meta.motionPresets` @returns {object[]} */
    _sanitizePresetList(raw) {
        if (!Array.isArray(raw)) return [];
        return raw.map((p) => sanitizeMotionPreset(p, this._newBlankPreset(MOTION_PRESET_FALLBACK_NAME))); // core/motion-presets.js
    },

    /** Bản cũ (trước khi Motion tách khỏi Visual Background) — dựng preset từ `visualBgRaw.motion`, gắn `motionPresetId`,
     * bỏ field cũ. Ghi thẳng `meta.visualBgConfig` (domain VBG chưa nạp lúc này). @returns {Promise<object[]>} */
    async _migrateLegacyVisualBgMotion(presets, visualBgRaw) {
        if (!shouldMigrateLegacyVisualBgMotion(visualBgRaw)) return presets; // core/motion-presets.js
        const migrated = sanitizeMotionPreset(buildLegacyMotionPresetRaw(visualBgRaw.motion, t('motionPresetsDrawer.migratedName')), this._newBlankPreset(MOTION_PRESET_FALLBACK_NAME));
        await setMeta('visualBgConfig', buildMigratedVisualBgMeta(visualBgRaw, migrated.id)); // service/db.js
        console.log(`writer: "workflowMotionPresets.loadPresetsOnBoot", page: "motionPresets", content: "migrated legacy motion -> preset ${migrated.id}, gán motionPresetId"`);
        return appendMotionPreset(presets, migrated);
    },

    /** Point move trắng với id mới. */
    _newBlankPointMove() {
        return buildBlankPointMove(generatePointMoveId(), buildBlankPointMoveField('%'), buildBlankPointMoveField(null)); // core/motion-presets.js
    },

    /** Preset trắng với id mới. @param {string} name */
    _newBlankPreset(name) {
        return buildBlankMotionPreset(generateMotionPresetId(), name, this._newBlankPointMove()); // core/motion-presets.js
    },

    /** Ghi danh sách preset vào state + DB. @param {object[]} presets */
    async _savePresets(presets) {
        appState.set('motionPresets', presets);
        await setMeta('motionPresets', presets); // service/db.js
    },

    /** Ghi đè vài field của preset đang sửa, lưu, rồi broadcast tới mọi runner React Beat (runner tự lọc preset của mình).
     * @param {object} patch @param {object[]} [presets] - danh sách nơi gọi đã đọc @returns {Promise<object[]>} danh sách MỚI */
    async _patchEditing(patch, presets = appState.get('motionPresets')) {
        const next = replaceMotionPresetFields(presets, this._editingId, patch); // core/motion-presets.js
        await this._savePresets(next);
        notifyMotionBeatReactPresetsChanged(); // event/workflow/motion-beat-react-runner.js
        return next;
    },

    /** Preset đang sửa (null nếu đã bị xoá) kèm danh sách (nơi gọi đã đọc, hoặc đọc mới). @returns {{presets: object[], preset: object|null}} */
    _editingContext(presets = appState.get('motionPresets')) {
        return { presets, preset: findMotionPresetById(presets, this._editingId) }; // core/motion-presets.js
    },

    /** + point move đang sửa (null nếu preset/point move đã bị xoá). */
    _editingPointMoveContext(presets) {
        const context = this._editingContext(presets);
        return { ...context, pointMove: context.preset ? findPointMoveById(context.preset.pointMoves, this._editingPointMoveId) : null }; // core/motion-presets.js
    },

    /** Lấy phần tử trong body Drawer theo bảng selector. @returns {Object<string, HTMLElement|null>} */
    _queryDrawerEls(selectors) {
        return Object.fromEntries(Object.entries(selectors).map(([name, selector]) => [name, genericDrawerBody.querySelector(selector)])); // core/dom-refs.js
    },

    /** @param {string} id @returns {HTMLElement|null} */
    _drawerElById(id) {
        return genericDrawerBody.querySelector(`#${id}`); // core/dom-refs.js
    },

    // ===================== Quản lý cấu hình (danh sách) =====================

    /** Tạo preset trắng, mở NGAY màn Edit của nó. */
    async addPreset() {
        const presets = appState.get('motionPresets');
        const preset = this._newBlankPreset(tFormat('motionPresetsDrawer.defaultName', { n: computeNextMotionPresetOrdinal(presets) })); // core/motion-presets.js
        await this._savePresets(appendMotionPreset(presets, preset));
        this._editingId = preset.id;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderMotionEdit()); // liên tuyến domain
    },

    /** Tap 1 dòng preset — mở màn Edit. @param {string} id */
    tileClick(id) {
        this._editingId = id;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderMotionEdit()); // liên tuyến domain
    },

    /** Nút xoá nhanh trên 1 dòng — xoá thẳng, vẽ lại danh sách tại chỗ. @param {string} id */
    async quickDelete(id) {
        await this._deletePresetById(id);
        workflowAppSettings._renderMotionList(); // liên tuyến domain
    },

    // ===================== Sửa 1 preset (màn Edit) =====================

    /** Đồng bộ UI màn Edit theo preset đang sửa (ẩn/hiện dòng theo kiểu Transition, thời lượng, tỉ lệ). */
    _syncEditUI() {
        const { isGenericDrawerOpen, motionPresets } = appState.get(['isGenericDrawerOpen', 'motionPresets']);
        if (!isGenericDrawerOpen) return;
        const preset = findMotionPresetById(motionPresets, this._editingId); // core/motion-presets.js
        if (!preset) return;
        const type = preset.transitionType;
        syncMotionEditUi(this._queryDrawerEls(MOTION_EDIT_SELECTORS), preset, { // core/motion-presets-ui.js
            ratio: transitionSupportsInOutRatio(type), // core/motion-engine.js
            direction: transitionSupportsDirection(type),
            zoomDirection: transitionSupportsZoomDirection(type),
            spinDirection: transitionSupportsSpinDirection(type),
            wipeDirection: transitionSupportsWipeDirection(type),
            curtainDirection: transitionSupportsCurtainDirection(type),
            edgeFlip: transitionIsEdgeFlip(type),
        });
        this._updateTransitionRatioLabel(preset.transitionDurationMs, preset.transitionInOutRatio);
    },

    /** Nhãn "In x s · Out y s" (cả lúc mở màn Edit — event/workflow/app-settings.js). */
    _updateTransitionRatioLabel(transitionDurationMs, ratioPercent) {
        setMotionTransitionRatioLabel(genericDrawerBody.querySelector('#motion-transition-ratio-label'), computeMotionEngineTransitionInOutMs(transitionDurationMs, ratioPercent)); // core/motion-presets-ui.js + core/motion-engine.js
    },

    async changeName(name) {
        const rename = resolveMotionPresetRename(name); // core/motion-presets.js
        if (rename.isBlank) return; // guard: tên rỗng -> giữ tên cũ
        await this._patchEditing({ name: rename.name });
    },

    async changeTransitionEnabled(checked) {
        await this._patchEditing({ transitionEnabled: checked });
    },

    async changeTransitionType(value) {
        if (!MOTION_ENGINE_TRANSITION_TYPES.includes(value)) return; // core/motion-engine.js
        await this._patchEditing({ transitionType: value });
        this._syncEditUI();
    },

    async changeTransitionDirection(value) {
        if (!MOTION_ENGINE_TRANSITION_DIRECTIONS_WITH_RANDOM.includes(value)) return; // core/motion-presets.js
        await this._patchEditing({ transitionDirection: value });
    },

    async changeTransitionZoomDirection(value) {
        if (!MOTION_ENGINE_ZOOM_DIRECTIONS_WITH_RANDOM.includes(value)) return;
        await this._patchEditing({ transitionZoomDirection: value });
    },

    async changeTransitionSpinDirection(value) {
        if (!MOTION_ENGINE_SPIN_DIRECTIONS_WITH_RANDOM.includes(value)) return;
        await this._patchEditing({ transitionSpinDirection: value });
    },

    async changeTransitionWipeDirection(value) {
        if (!MOTION_ENGINE_WIPE_DIRECTIONS_WITH_RANDOM.includes(value)) return;
        await this._patchEditing({ transitionWipeDirection: value });
    },

    async changeTransitionCurtainDirection(value) {
        if (!MOTION_ENGINE_CURTAIN_DIRECTIONS_WITH_RANDOM.includes(value)) return;
        await this._patchEditing({ transitionCurtainDirection: value });
    },

    async changeEdgeFlipVariant(value) {
        if (!MOTION_ENGINE_EDGE_FLIP_VARIANTS.includes(value)) return;
        await this._patchEditing({ edgeFlipVariant: value });
        this._syncEditUI(); // dòng "ảnh trước đứng yên" ẩn/hiện theo variant
    },

    async changeEdgeFlipStaticOld(checked) {
        await this._patchEditing({ edgeFlipStaticOld: checked });
    },

    /** Mở time picker "Thời gian chuyển cảnh" — trần 300ms – 60s; kẹp theo thời lượng hiển thị thật chỉ ở runtime
     * (`capMotionEngineTransitionDurationMs()`, core/motion-engine.js). */
    openTransitionDurationPicker() {
        const { isGenericDrawerOpen, motionPresets } = appState.get(['isGenericDrawerOpen', 'motionPresets']);
        if (!isGenericDrawerOpen) return;
        const preset = findMotionPresetById(motionPresets, this._editingId); // core/motion-presets.js
        if (!preset) return;
        openTimePickerModal({ // core/time-picker-modal.js
            title: t('motionSettingsDrawer.transitionDuration.pickerTitle'),
            format: 's-ms',
            valueMs: clampMotionTransitionDurationMs(preset.transitionDurationMs), // core/motion-presets.js
            minMs: MOTION_ENGINE_TRANSITION_MIN_TIME_MS, // core/motion-engine.js
            maxMs: MOTION_ENGINE_TRANSITION_MAX_TIME_MS,
            onConfirm: (resultMs) => this._commitTransitionDuration(resultMs),
        });
    },

    async _commitTransitionDuration(resultMs) {
        const durationMs = clampMotionTransitionDurationMs(resultMs); // core/motion-presets.js
        const next = await this._patchEditing({ transitionDurationMs: durationMs });
        if (!appState.get('isGenericDrawerOpen')) return;
        setMotionTransitionDurationText(genericDrawerBody.querySelector('#setting-motion-transition-duration'), durationMs); // core/motion-presets-ui.js
        const preset = findMotionPresetById(next, this._editingId);
        if (preset) this._updateTransitionRatioLabel(durationMs, preset.transitionInOutRatio);
    },

    previewTransitionRatio(ratioPercent) {
        const { isGenericDrawerOpen, motionPresets } = appState.get(['isGenericDrawerOpen', 'motionPresets']);
        if (!isGenericDrawerOpen) return;
        const preset = findMotionPresetById(motionPresets, this._editingId); // core/motion-presets.js
        if (preset) this._updateTransitionRatioLabel(preset.transitionDurationMs, ratioPercent);
    },

    async changeTransitionRatio(ratioPercent) {
        const { presets, preset } = this._editingContext();
        if (!preset) return;
        const ratio = clampMotionTransitionRatio(ratioPercent); // core/motion-presets.js
        await this._patchEditing({ transitionInOutRatio: ratio }, presets);
        this._updateTransitionRatioLabel(preset.transitionDurationMs, ratio);
    },

    async changeTransitionEasing(easing) {
        if (!MOTION_ENGINE_TRANSITION_EASINGS.includes(easing)) return; // core/motion-engine.js
        await this._patchEditing({ transitionEasing: easing });
    },

    // ===================== Point Move =====================

    /** Công tắc tổng Point Move — áp ngay lúc nội dung đang hiện: broadcast, Runner chạy đúng preset này tự áp. */
    async changePointMoveEnabled(checked) {
        const next = await this._patchEditing({ pointMoveEnabled: checked });
        const preset = findMotionPresetById(next, this._editingId); // core/motion-presets.js
        if (preset) notifyMotionPointMoveEnabledChanged(preset, checked); // event/workflow/motion-point-move-runner.js
    },

    /** Dòng "Point move" trong màn Edit — mở danh sách point move. */
    openPointMoveList() {
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPointMoveList()); // liên tuyến domain
    },

    async changePointMoveRunMode(mode) {
        if (!MOTION_POINT_MOVE_RUN_MODES.includes(mode)) return; // core/motion-presets.js
        await this._patchEditing({ pointMoveRunMode: mode });
        this._syncEditUI();
    },

    async changePointMoveOneOrder(order) {
        if (!MOTION_POINT_MOVE_ONE_ORDERS.includes(order)) return; // core/motion-presets.js
        await this._patchEditing({ pointMoveOneOrder: order });
    },

    /** Checkbox "Return baseline" (màn danh sách point move, chỉ có ý nghĩa với run mode 'all'). @param {boolean} checked */
    async changePointMoveEndForceBaseline(checked) {
        const { presets, preset } = this._editingContext();
        if (!preset) return;
        await this._patchEditing(buildPointMoveEndForceBaselinePatch(preset.pointMoves, checked), presets); // core/motion-presets.js
    },

    /** Checkbox 1 dòng point move (Point 0 luôn tick — core bỏ qua). @param {string} id @param {boolean} checked */
    async togglePointMoveChecked(id, checked) {
        const { presets, preset } = this._editingContext();
        if (!preset) return;
        await this._patchEditing({ pointMoves: setPointMoveChecked(preset.pointMoves, id, checked) }, presets); // core/motion-presets.js
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain
    },

    /** `timingX` cho point move mới nối cuối (+0.2% sau mốc muộn nhất, kẹp biên + tránh trùng). @param {object} preset */
    _appendedTimingX(preset) {
        return resolvePointMoveTimingX(preset.pointMoves, null, computeAppendedPointMoveTimingSeed(preset.pointMoves), resolvePointMoveTimingBounds(preset)); // core/motion-presets.js
    },

    /** Thêm 1 point move trắng vào cuối danh sách. */
    async addPointMove() {
        const { presets, preset } = this._editingContext();
        if (!preset) return;
        await this._patchEditing({ pointMoves: appendPointMove(preset.pointMoves, this._newBlankPointMove(), this._appendedTimingX(preset)) }, presets); // core/motion-presets.js
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain
    },

    /** Nhân bản 1 point move (giữ mọi thông số, id mới, luôn tick), nối cuối. @param {string} id */
    async duplicatePointMove(id) {
        const { presets, preset } = this._editingContext();
        const original = preset ? findPointMoveById(preset.pointMoves, id) : null; // core/motion-presets.js
        if (!original) return;
        const copy = buildPointMoveCopy(original, generatePointMoveId());
        await this._patchEditing({ pointMoves: appendPointMove(preset.pointMoves, copy, this._appendedTimingX(preset)) }, presets);
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain
    },

    /** Kéo-thả trong màn Danh sách — hoán đổi toàn bộ 2 point move (Point 0 cố định — core bỏ qua). @param {string} idA @param {string} idB */
    async swapPointMoveOrder(idA, idB) {
        if (idA === idB) return;
        const { presets, preset } = this._editingContext();
        if (!preset) return;
        await this._patchEditing({ pointMoves: swapPointMoves(preset.pointMoves, idA, idB) }, presets); // core/motion-presets.js
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain
    },

    /** Xoá 1 point move — luôn còn ít nhất 1, Point 0 không xoá được (core bỏ qua). @param {string} id */
    async deletePointMove(id) {
        const { presets, preset } = this._editingContext();
        if (!preset) return;
        await this._patchEditing({ pointMoves: removePointMove(preset.pointMoves, id) }, presets); // core/motion-presets.js
        workflowAppSettings._renderPointMoveList(); // liên tuyến domain
    },

    /** Icon sửa 1 dòng — mở màn Point Move Edit. @param {string} id */
    openPointMoveEdit(id) {
        this._editingPointMoveId = id;
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPointMoveEdit()); // liên tuyến domain
    },

    /** Ghi đè vài khoá của 1 field của point move đang sửa. @param {string} fieldKey @param {object} fieldPatch */
    async _patchEditingPointMoveField(fieldKey, fieldPatch) {
        const { presets, preset } = this._editingContext();
        if (!preset) return;
        await this._patchEditing({ pointMoves: replacePointMoveField(preset.pointMoves, this._editingPointMoveId, fieldKey, fieldPatch) }, presets); // core/motion-presets.js
    },

    /** Đổi đơn vị Linear X/Y (%/px) — reset về field trắng (2 đơn vị khác thang đo, giữ số cũ sẽ sai ý).
     * @param {'linearX'|'linearY'} fieldKey @param {string} unit - '%'|'px'. */
    async changePointMoveUnit(fieldKey, unit) {
        if (!MOTION_POINT_MOVE_LINEAR_UNITS.includes(unit)) return; // core/motion-presets.js
        await this._patchEditingPointMoveField(fieldKey, buildBlankPointMoveField(unit));
        workflowAppSettings._renderPointMoveEdit(); // liên tuyến domain — biên slider đổi theo đơn vị
    },

    /** Đổi chế độ 1 field (single/randomRange). */
    async changePointMoveFieldMode(fieldKey, mode) {
        if (!MOTION_POINT_MOVE_FIELD_MODES.includes(mode)) return; // core/motion-presets.js
        await this._patchEditingPointMoveField(fieldKey, { mode });
        this._syncPointMoveEditUI(fieldKey);
    },

    /** Slider "single" đang kéo (`input`) — chỉ cập nhật ô số, lưu lúc thả tay (`changePointMoveFieldSingle()`). */
    previewPointMoveFieldSingle(fieldKey, value) {
        if (!appState.get('isGenericDrawerOpen')) return;
        setMotionInputValues([this._drawerElById(POINT_MOVE_NUMBER_INPUT_ID_BY_WHICH.single(fieldKey))], value); // core/motion-presets-ui.js
    },

    /** Slider "single" thả tay (`change`) — lưu. */
    async changePointMoveFieldSingle(fieldKey, value) {
        if (typeof value !== 'number') return;
        await this._patchEditingPointMoveField(fieldKey, { single: value });
        this._updatePointMoveFieldLabel(fieldKey);
    },

    /** 1 trong 2 tay kéo dual-range (randomRange) — tay kia bị đẩy theo khi vượt qua.
     * @param {string} fieldKey @param {'min'|'max'} which @param {number} value */
    async changePointMoveFieldRange(fieldKey, which, value) {
        if (typeof value !== 'number') return;
        const { presets, preset, pointMove } = this._editingPointMoveContext();
        if (!pointMove) return;
        const fieldPatch = buildPointMoveFieldRangePatch(pointMove[fieldKey], which, value); // core/motion-presets.js
        await this._patchEditing({ pointMoves: replacePointMoveField(preset.pointMoves, pointMove.id, fieldKey, fieldPatch) }, presets);
        workflowAppSettings._renderPointMoveEdit(); // liên tuyến domain — 2 tay kéo có thể cùng đổi vị trí
    },

    /** Sau khi đổi mode: hiện đúng cụm slider + ô số (không vẽ lại cả màn — giữ vị trí cuộn). */
    _syncPointMoveEditUI(fieldKey) {
        const { isGenericDrawerOpen, motionPresets } = appState.get(['isGenericDrawerOpen', 'motionPresets']);
        if (!isGenericDrawerOpen) return;
        const { pointMove } = this._editingPointMoveContext(motionPresets);
        if (!pointMove) return;
        showPointMoveFieldMode(this._queryDrawerEls({ // core/motion-presets-ui.js
            singleWrap: `#ptmove-${fieldKey}-single-wrap`,
            rangeWrap: `#ptmove-${fieldKey}-range-wrap`,
            singleInputWrap: `#ptmove-${fieldKey}-single-input-wrap`,
            rangeInputWrap: `#ptmove-${fieldKey}-range-input-wrap`,
        }), pointMove[fieldKey].mode);
        this._updatePointMoveFieldLabel(fieldKey);
    },

    /** Đổ giá trị field lên ô nhập số + dải tô màu dual-range (cả lúc mở màn — event/workflow/app-settings.js). */
    _updatePointMoveFieldLabel(fieldKey) {
        const { isGenericDrawerOpen, motionPresets } = appState.get(['isGenericDrawerOpen', 'motionPresets']);
        if (!isGenericDrawerOpen) return;
        const { pointMove } = this._editingPointMoveContext(motionPresets);
        if (!pointMove) return;
        const field = pointMove[fieldKey];
        POINT_MOVE_FIELD_INPUTS_SYNC_BY_MODE[field.mode](fieldKey, field);
        this._paintPointMoveRangeFill(fieldKey);
    },

    /** Dải tô màu giữa 2 tay kéo dual-range theo vị trí hiện tại của 2 slider. */
    _paintPointMoveRangeFill(fieldKey) {
        const fillEl = this._drawerElById(`ptmove-${fieldKey}-range-fill`);
        const minInput = this._drawerElById(POINT_MOVE_SLIDER_ID_BY_WHICH.min(fieldKey));
        const maxInput = this._drawerElById(POINT_MOVE_SLIDER_ID_BY_WHICH.max(fieldKey));
        if (!fillEl || !minInput || !maxInput) return;
        paintPointMoveRangeFill(fillEl, computePointMoveRangeFill(minInput, maxInput)); // core/motion-presets-ui.js + core/motion-presets.js
    },

    /** 'motionPresets.pointMove.fieldRange.preview' — đang kéo 1 tay dual-range: tô lại dải + 2 ô số theo slider (chưa lưu). */
    previewPointMoveFieldRange(fieldKey) {
        if (!appState.get('isGenericDrawerOpen')) return;
        this._paintPointMoveRangeFill(fieldKey);
        this._copySliderValueToInput(fieldKey, 'min');
        this._copySliderValueToInput(fieldKey, 'max');
    },

    _copySliderValueToInput(fieldKey, which) {
        copyMotionInputValue(this._drawerElById(POINT_MOVE_SLIDER_ID_BY_WHICH[which](fieldKey)), this._drawerElById(POINT_MOVE_NUMBER_INPUT_ID_BY_WHICH[which](fieldKey))); // core/motion-presets-ui.js
    },

    /** 'motionPresets.pointMove.numberInput.change' — gõ tay xong (blur/Enter): kẹp theo biên ô, đồng bộ slider, lưu.
     * @param {string} fieldKey @param {'single'|'min'|'max'} which @param {string|number} raw */
    async commitPointMoveNumberInput(fieldKey, which, raw) {
        const commit = POINT_MOVE_NUMBER_COMMIT_BY_WHICH[which];
        if (!commit) return;
        const inputEl = this._drawerElById(POINT_MOVE_NUMBER_INPUT_ID_BY_WHICH[which](fieldKey));
        if (!inputEl) return;
        const value = clampMotionNumberInput(raw, inputEl); // core/motion-presets.js
        setMotionInputValues([inputEl, this._drawerElById(POINT_MOVE_SLIDER_ID_BY_WHICH[which](fieldKey))], value); // core/motion-presets-ui.js
        this._paintPointMoveRangeFill(fieldKey);
        await commit(fieldKey, value);
    },

    /** 'motionPresets.pointMove.signToggle.click' — nút "±": đảo dấu rồi đi đúng luồng ô nhập số.
     * @param {string} fieldKey @param {'single'|'min'|'max'} which */
    async togglePointMoveInputSign(fieldKey, which) {
        const idFn = POINT_MOVE_NUMBER_INPUT_ID_BY_WHICH[which];
        if (!idFn) return;
        const inputEl = this._drawerElById(idFn(fieldKey));
        if (!inputEl) return;
        await this.commitPointMoveNumberInput(fieldKey, which, negateMotionInputValue(inputEl)); // core/motion-presets.js
    },

    // ===================== Point Move — kéo-thả sắp xếp danh sách =====================
    // pointerdown trên tay cầm -> setPointerCapture: pointermove/pointerup về đúng tay cầm đó (delegate
    // event/listener/motion-presets.js), không gắn listener lên `document`.

    /** 'motionPresets.pointMove.drag.start' — nhấc hàng lên, ghi phiên kéo. Point 0 không bao giờ là đích.
     * @param {{id:string, clientY:number, handleEl:HTMLElement, pointerId:number}} payload */
    startPointMoveDrag({ id, clientY, handleEl, pointerId }) {
        const { preset } = this._editingContext();
        if (!preset) return;
        const rows = Array.from(genericDrawerBody.querySelectorAll('[data-ptmove-row]'));
        const plan = planPointMoveDrag(rows.map((row) => row.dataset.ptmoveRow), id, preset.pointMoves); // core/motion-presets.js
        const rowEl = rows[plan.dragIndex];
        if (!rowEl) return;
        this._pointMoveDrag = { id, rowEl, startY: clientY, rows, blocked: plan.blocked, hoverRowEl: null };
        liftPointMoveDragRow(rowEl, handleEl, pointerId); // core/motion-presets-ui.js
    },

    /** 'motionPresets.pointMove.drag.move' — hàng bám theo con trỏ, tô sáng đích thả. @param {number} clientY */
    movePointMoveDrag(clientY) {
        const drag = this._pointMoveDrag;
        if (!drag) return; // guard: rê chuột qua tay cầm mà không kéo
        setPointMoveDragRowTransform(drag.rowEl, computePointMoveDragTransform(drag.startY, clientY)); // core/motion-presets-ui.js + core/motion-presets.js
        const index = findPointMoveDropRowIndex(drag.rows.map((row) => row.getBoundingClientRect()), clientY, drag.blocked);
        this._setDropTarget(drag, drag.rows[index] || null);
    },

    /** 'motionPresets.pointMove.drag.end' — thả: trả hàng về, hoán đổi nếu có đích khác chính nó. */
    async endPointMoveDrag() {
        const drag = this._pointMoveDrag;
        if (!drag) return;
        this._pointMoveDrag = null;
        dropPointMoveDragRow(drag.rowEl); // core/motion-presets-ui.js
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

    /** Đổi bộ theme key của hàng (đích thả / bình thường) rồi áp theme hiện tại. */
    _paintDropTarget(rowEl, isTarget) {
        if (!rowEl) return;
        setPointMoveDropTargetThemeKeys(rowEl, isTarget); // core/motion-presets-ui.js
        applyUiThemeToDom(rowEl, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js
    },

    async _swapIfDropped(fromId, toId) {
        if (!toId || toId === fromId) return;
        await this.swapPointMoveOrder(fromId, toId);
    },

    // ===================== Point Move — Timing (chỉ dùng khi pointMoveRunMode==='all') =====================

    /** Nút "Timing" — mở màn thanh Timing. */
    openPointMoveTiming() {
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderPointMoveTiming()); // liên tuyến domain
    },

    /** Dựng lại TOÀN BỘ SVG — chỉ lúc mở màn hoặc sau khi đã lưu 1 lượt sửa; lúc đang kéo dùng `_patchTimingPreview()` (gỡ SVG
     * giữa chừng làm phần tử core-ui đang giữ rời DOM, toạ độ thành NaN). @param {HTMLElement} containerEl - `#ptmove-timing-container` */
    _renderTimingCurve(containerEl) {
        if (!containerEl) return;
        const { preset } = this._editingContext();
        if (!preset) return;
        const nodes = computePointMoveTimingNodes(preset, this._dragPreviewPointMoveId, this._dragPreviewTimingX); // core/motion-presets.js
        const { minX, maxX } = resolvePointMoveTimingBounds(preset);
        mountPointMoveTimingCurve(containerEl, buildPointMoveTimingCurveEl(nodes, minX, maxX)); // core/motion-presets-ui.js + core/point-move-timing-ui.js
    },

    /** Vá vị trí 1 node ngay trong SVG đang có (đang kéo). @param {string} id @param {number} timingX */
    _patchTimingPreview(id, timingX) {
        if (!appState.get('isGenericDrawerOpen')) return;
        const container = genericDrawerBody.querySelector('#ptmove-timing-container'); // core/dom-refs.js
        const svgEl = container ? container.querySelector('.ptmove-timing-svg') : null;
        const nodeEl = svgEl ? svgEl.querySelector(`circle[data-point-move-id="${id}"]`) : null;
        if (!nodeEl) return;
        setPointMoveTimingNodeCx(nodeEl, computePointMoveTimingNodeCx(timingX)); // core/motion-presets-ui.js + core/motion-presets.js
    },

    /** Preview khi đang kéo 1 node (mỗi `pointermove`, chưa lưu). @param {string} id @param {number} timingX */
    previewPointMoveTimingDrag(id, timingX) {
        this._dragPreviewPointMoveId = id;
        this._dragPreviewTimingX = timingX;
        this._patchTimingPreview(id, timingX);
    },

    /** `pointerup` sau khi đã kéo đủ xa (core-ui tự phân biệt tap/kéo) — chốt giá trị đang preview, dựng lại màn. */
    async commitPointMoveTimingDrag() {
        const id = this._dragPreviewPointMoveId;
        if (!id) return;
        this._dragPreviewPointMoveId = null;
        await this._commitPointMoveTimingX(id, this._dragPreviewTimingX);
    },

    /** Chốt `timingX` (làm tròn, kẹp biên, tránh trùng mốc — Point 0 bỏ qua), lưu, dựng lại màn Timing nếu Drawer còn mở. */
    async _commitPointMoveTimingX(id, rawX) {
        const { presets, preset } = this._editingContext();
        if (!preset) return;
        const timingX = resolvePointMoveTimingX(preset.pointMoves, id, rawX, resolvePointMoveTimingBounds(preset)); // core/motion-presets.js
        await this._patchEditing({ pointMoves: setPointMoveTimingX(preset.pointMoves, id, timingX) }, presets);
        if (!appState.get('isGenericDrawerOpen')) return;
        workflowAppSettings._renderPointMoveTiming(); // liên tuyến domain — dựng lại toàn màn (chỉ 1 lần lúc thả tay)
    },

    /** onMount màn Timing — zoom luôn bắt đầu từ 0. */
    resetPointMoveTimingZoom() {
        this._timingZoomIdx = 0;
    },

    /** 'motionPresets.pointMove.timingZoom.click' — +1/-1 bậc giãn trục thời gian (chỉ view). @param {number} delta */
    stepPointMoveTimingZoom(delta) {
        const view = computePointMoveTimingZoomView(this._timingZoomIdx, delta); // core/motion-presets.js
        this._timingZoomIdx = view.zoomIdx;
        applyPointMoveTimingZoomUi(genericDrawerBody.querySelector('#ptmove-timing-container'), genericDrawerBody.querySelector('#ptmove-timing-zoom-label'), view); // core/motion-presets-ui.js
    },

    /** TAP (không kéo) 1 node — modal nhập số chính xác. @param {string} id */
    openPointMoveTimingNodeModal(id) {
        const { preset } = this._editingContext();
        if (!preset) return;
        const idx = findPointMoveIndexById(preset.pointMoves, id); // core/motion-presets.js
        if (idx <= 0) return; // guard: không có / Point 0 (không phải node trên đồ thị)
        const { minX, maxX } = resolvePointMoveTimingBounds(preset);
        // Giữ tham chiếu ô số ngay sau khi mở, đọc `.value` trong onClick (modalChoice() gỡ overlay trước khi gọi onClick,
        // phần tử đã tách vẫn đọc được).
        modalChoice( // core/modal-choice-ui.js
            tFormat('motionSettingsDrawer.pointMove.itemName', { n: idx }),
            [{
                label: t('common.save'),
                className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnPrimaryBg btnPrimaryHoverBg textOnAccent',
                onClick: () => this._commitPointMoveTimingModal(id, Number(xInput.value)),
            }],
            { bodyHtml: renderPointMoveTimingModalBody(minX, maxX, preset.pointMoves[idx].timingX) }, // components/motion-settings-drawer.js
        );
        const xInput = document.getElementById('ptmove-modal-x-input');
    },

    /** Nút "Lưu" của modal — số không hợp lệ bỏ qua; kẹp biên + tránh trùng ở `_commitPointMoveTimingX()`.
     * @param {string} id @param {number} timingX */
    async _commitPointMoveTimingModal(id, timingX) {
        if (typeof timingX !== 'number' || Number.isNaN(timingX)) return;
        await this._commitPointMoveTimingX(id, timingX);
    },

    // ===================== React Beat Audio =====================

    /** Mọi field nhóm "React Beat Audio" — `effectKey` null = field cấp nhóm (`enabled`), còn lại zoom/panX/panY/rotate.
     * Giá trị sai / field lạ bỏ qua. `maxPct`/`maxDeg`: đồng bộ lại ô số + slider về giá trị vừa lưu.
     * @param {'zoom'|'panX'|'panY'|'rotate'|null} effectKey
     * @param {string} fieldKey - 'enabled' | 'maxPct' | 'maxDeg' | 'direction' | 'reverse' | 'randomMax'
     * @param {boolean|number|string} value */
    async changeBeatReactField(effectKey, fieldKey, value) {
        const rule = BEAT_REACT_FIELD_RULE_BY_KEY[fieldKey];
        if (!rule || !rule.isValid(effectKey, value)) return; // guard: không ghi mù
        const { presets, preset } = this._editingContext();
        if (!preset) return;
        const hasEffect = Boolean(effectKey);
        await this._patchEditing({ reactBeatAudio: BEAT_REACT_WRITE_BY_HAS_EFFECT[hasEffect](preset.reactBeatAudio, effectKey, fieldKey, value) }, presets);
        if (!rule.syncsMaxInputs || !hasEffect || !appState.get('isGenericDrawerOpen')) return;
        setMotionInputValues(this._beatReactMaxInputEls(effectKey), value); // core/motion-presets-ui.js
    },

    /** Ô số + slider Max của 1 hiệu ứng React Beat. @returns {Array<HTMLInputElement|null>} */
    _beatReactMaxInputEls(effectKey) {
        return [this._drawerElById(`motion-beatreact-${effectKey}-max-input`), this._drawerElById(`setting-motion-beatreact-${effectKey}-max`)];
    },

    /** 'motionPresets.beatReact.maxSlider.input' — đang kéo slider Max: chỉ cập nhật ô số (lưu lúc thả tay). */
    previewBeatReactMax(effectKey, value) {
        setMotionInputValues([this._drawerElById(`motion-beatreact-${effectKey}-max-input`)], value); // core/motion-presets-ui.js
    },

    /** 'motionPresets.beatReact.maxInput.change' — gõ tay ô Max: kẹp theo biên ô, đồng bộ slider, rồi lưu. */
    async commitBeatReactMaxInput(effectKey, fieldKey, raw) {
        const [inputEl, sliderEl] = this._beatReactMaxInputEls(effectKey);
        if (!inputEl) return;
        const value = clampMotionNumberInput(raw, inputEl); // core/motion-presets.js
        setMotionInputValues([inputEl, sliderEl], value); // core/motion-presets-ui.js
        await this.changeBeatReactField(effectKey, fieldKey, value);
    },

    // ===================== Random giá trị slider theo nhóm =====================

    /** 'motionPresets.beatReact.random.click' — sinh lại Max của cả 4 slider React Beat (bật/tắt, hướng, Reverse, Random Max
     * giữ nguyên), lưu + broadcast, đồng bộ slider + ô số tại chỗ (giữ vị trí cuộn). */
    async randomizeBeatReactValues() {
        const { presets, preset } = this._editingContext();
        if (!preset) return;
        const values = buildRandomBeatReactMaxValues(); // core/motion-presets.js
        const applied = applyBeatReactMaxValues(preset.reactBeatAudio, values);
        await this._patchEditing({ reactBeatAudio: applied.reactBeatAudio }, presets);
        console.log(`writer: "workflowMotionPresets.randomizeBeatReactValues", page: "motionPresets", content: "${this._editingId} — ${applied.summary}"`);
        if (!appState.get('isGenericDrawerOpen')) return;
        values.forEach(({ effectKey, value }) => setMotionInputValues(this._beatReactMaxInputEls(effectKey), value)); // core/motion-presets-ui.js
    },

    /** 'motionPresets.pointMove.random.click' — sinh lại giá trị 6 slider của point move đang sửa (giữ mode/đơn vị), vẽ lại
     * tại chỗ (dual-range cần dựng lại vị trí 2 tay kéo). */
    async randomizePointMoveValues() {
        const { presets, preset, pointMove } = this._editingPointMoveContext();
        if (!pointMove) return; // guard: point move vừa bị xoá
        const fields = buildRandomPointMoveFieldValues(pointMove); // core/motion-presets.js
        await this._patchEditing({ pointMoves: replacePointMoveFields(preset.pointMoves, pointMove.id, fields) }, presets);
        console.log(`writer: "workflowMotionPresets.randomizePointMoveValues", page: "motionPresets", content: "${this._editingId}/${this._editingPointMoveId} — 6 field random"`);
        workflowAppSettings._renderPointMoveEdit(); // liên tuyến domain
    },

    // ===================== Quản lý preset =====================

    /** Header "Reset" — mọi field cấu hình về mặc định (giữ id/name), vẽ lại tại chỗ. */
    async resetEditing() {
        const { presets, preset } = this._editingContext();
        if (!preset) return;
        await this._patchEditing(buildMotionPresetResetFields(this._newBlankPreset(preset.name)), presets); // core/motion-presets.js
        workflowAppSettings._renderMotionEdit(); // liên tuyến domain
    },

    /** Header "Xoá" — xoá preset đang sửa, quay về danh sách. */
    async deleteEditing() {
        await this._deletePresetById(this._editingId);
        this._editingId = null;
        workflowAppSettings.back(); // liên tuyến domain
    },

    /** Xoá khỏi danh sách; gỡ `motionPresetId` của VBG Photo nếu đang gắn đúng preset này (`*PresetId` của Player không cần
     * gỡ — runtime coi id không còn tồn tại là "chưa gắn", event/workflow/player-display-settings.js). @param {string} id */
    async _deletePresetById(id) {
        await this._savePresets(removeMotionPresetById(appState.get('motionPresets'), id)); // core/motion-presets.js
        if (appConfigVisualBg.getAll().motionPresetId !== id) return;
        appConfigVisualBg.mutateAll((c) => { c.motionPresetId = null; });
        await workflowVisualBg._persist(); // liên tuyến domain
    },

    // ===================== Chế độ CHỌN (picker) =====================
    // Nơi tiêu thụ gọi `openPicker()` -> danh sách Motion (dùng chung pagination nơi 'motionPresets' với màn Quản lý), tap 1
    // dòng = chọn nháp, "Apply" = gọi `onApply(id)` (tham số mờ do nơi tiêu thụ truyền, cùng khuôn `onConfirm` của
    // openTimePickerModal()) rồi back(). Back/Close khi chưa Apply = huỷ.

    /** Mở màn Chọn ở đúng trang có preset đang gắn (`currentId` trỏ preset đã xoá -> "None").
     * @param {{title:string, currentId:(string|null), onApply:(id:(string|null)) => (void|Promise<void>)}} config */
    openPicker(config) {
        if (!config || typeof config.onApply !== 'function') return; // guard: thiếu đích nhận kết quả
        const presets = appState.get('motionPresets');
        const current = findMotionPresetById(presets, config.currentId); // core/motion-presets.js
        const draftId = current ? current.id : null;
        this._picker = {
            title: config.title,
            draftId,
            onApply: config.onApply,
            pageIndex: workflowPagination.pageIndexOfItem('motionPresets', findMotionPresetIndexById(presets, draftId)), // event/workflow/pagination.js — -1 (None) -> trang 0
        };
        workflowAppSettings.navigateTo(() => workflowAppSettings._renderMotionPicker()); // liên tuyến domain
    },

    /** Dữ liệu vẽ màn Chọn (mỗi lần vẽ, `workflowAppSettings._renderMotionPicker()`), tự kẹp `pageIndex`. null = không có phiên Chọn.
     * @returns {{title:string, draftId:(string|null), view:object}|null} */
    getPickerRenderData() {
        if (!this._picker) return null;
        const view = workflowPagination.computePlaceView('motionPresets', appState.get('motionPresets'), this._picker.pageIndex); // event/workflow/pagination.js
        this._picker.pageIndex = view.pageIndex;
        return { title: this._picker.title, draftId: this._picker.draftId, view };
    },

    /** Tap 1 dòng — chỉ đổi nháp + vẽ lại tại chỗ. '' = dòng "None". @param {string} id */
    selectPickerDraft(id) {
        if (!this._picker) return;
        if (id && !findMotionPresetById(appState.get('motionPresets'), id)) return; // guard: id lạ
        this._picker.draftId = id || null;
        workflowAppSettings._renderMotionPicker(); // liên tuyến domain
    },

    /** Thanh phân trang màn Chọn — vẽ lại, cuộn về đầu; nháp giữ nguyên qua các trang. @param {number} pageIndex */
    setPickerPage(pageIndex) {
        if (!this._picker) return;
        this._picker.pageIndex = pageIndex;
        workflowAppSettings._renderMotionPicker(); // liên tuyến domain
        resetMotionDrawerScroll(genericDrawerBody); // core/motion-presets-ui.js
    },

    /** "Apply" — kết thúc phiên TRƯỚC (bấm đúp không ghi 2 lần), đợi nơi tiêu thụ ghi xong, rồi back(). */
    async applyPicker() {
        const picker = this._picker;
        if (!picker) return;
        this._picker = null;
        await picker.onApply(picker.draftId);
        workflowAppSettings.back(); // liên tuyến domain
    },
};
