/**
 * event/workflow/custom-effect.js — Workflow của hệ Custom Effect.
 *
 * #btn-cycle-mode — 1 nút 2 việc (cùng khuôn #btn-cycle-eq): bấm ngắn mở modal chọn effect (group -> style,
 * workflowVisualizerDisplay.openEffectPicker(), event/workflow/visualizer-display.js); giữ đủ 1.5s mở Custom Effect Drawer của effect đang
 * chạy. Auto-switch đang bật thì cả 2 chỉ báo lý do. Đếm giờ qua taskManager.once(), cờ `_holdFired` chặn cú click sau
 * khi đã mở bằng giữ.
 *
 * Nội dung Drawer: event/listener/custom-effect.js (ủy quyền) -> router 'customEffect' -> các method dưới; sửa DOM tại
 * chỗ qua core/custom-effect-drawer-ui.js. Effect của Drawer đang mở nhớ ở `_openType` (auto-switch đổi effect giữa chừng
 * thì Drawer vẫn sửa đúng effect đang hiện).
 *
 * NẠP SAU: core/custom-effect.js, core/custom-effect-drawer-ui.js, components/custom-effect-drawer.js, core/dom-refs.js,
 * service/task-manager.js, event/workflow/generic-drawer-helpers.js, core/visualizer-control-center.js,
 * core/visualizer/visualizer-display.js. Lúc chạy: event/workflow/visualizer-render.js.
 */

const CUSTOM_EFFECT_HOLD_MS = 1500;
const CUSTOM_EFFECT_HOLD_TASK = 'customEffectCycleHoldPending';

/** `field.refresh` (core/custom-effect.js::CUSTOM_EFFECT_FIELDS — tên lịch sử giữ nguyên) -> hành động dựng lại cho
 * field chỉ được đọc lúc khởi tạo scene. */
const CUSTOM_EFFECT_REFRESH_BY_NAME = {
    resizeCanvas: () => workflowVisualizerRender.rebuildCanvasScenes(), // event/workflow/visualizer-render.js
    initThreeJS: () => workflowVisualizerRender.callGroupAction('vortex', 'rebuild'),
    initThreeJSConnector: () => workflowVisualizerRender.callGroupAction('connector', 'rebuild'),
};

/** CLICK #btn-cycle-mode: auto-switch đang bật -> chỉ báo lý do; không -> mở modal chọn effect (group -> style). */
const CUSTOM_EFFECT_CYCLE_CLICK_BY_LOCKED = {
    true: () => alertModal(t('effectPicker.autoSwitchLocked'), { title: t('effectPicker.title') }), // core/modal-choice-ui.js
    false: () => workflowVisualizerDisplay.openEffectPicker(), // event/workflow/visualizer-display.js
};

/** GIỮ #btn-cycle-mode đủ 1.5s — SỬA (07/10/2026, Giang: "khi auto switch bật cũng chặn luôn việc chỉnh custom
 * effect"): auto-switch đang bật -> chỉ báo lý do (cùng thông báo bấm ngắn), KHÔNG mở Drawer; tắt -> mở như cũ. */
const CUSTOM_EFFECT_HOLD_BY_LOCKED = {
    true: () => alertModal(t('effectPicker.autoSwitchLocked'), { title: t('effectPicker.title') }), // core/modal-choice-ui.js
    false: () => workflowCustomEffect.open(),
};

/** Drawer đang đóng -> mở mới (cuộn từ đầu); đang mở (nội dung khác) -> thay nội dung. */
const CUSTOM_EFFECT_DRAWER_BY_CLOSED = {
    true: (config) => workflowGenericDrawerHelpers.open(config), // event/workflow/generic-drawer-helpers.js
    false: (config) => workflowGenericDrawerHelpers.update(config),
};

/** Ghi 1 field: lưu riêng theo style đang chọn hay chung cả group (core/custom-effect.js). */
const CUSTOM_EFFECT_WRITE_BY_PER_STYLE = {
    true: (type, field, value) => setCustomEffectStyleField(type, field, value),
    false: (type, field, value) => setCustomEffectGroupField(type, field, value),
};

/** 3 slider mỗi đèn (khoá do listener gửi) -> field trong customLamps[i] + đơn vị hiển thị. */
const CUSTOM_EFFECT_LAMP_SLIDERS = {
    x: { field: 'xPercent', suffix: '%', isFloat: false },
    height: { field: 'heightPx', suffix: 'px', isFloat: false },
    flare: { field: 'flareScale', suffix: '', isFloat: true },
};

const workflowCustomEffect = {
    _holdFired: false,
    /** Effect (group) của Drawer đang mở — ghi ở open(). */
    _openType: null,

    startHold() {
        this._holdFired = false;
        taskManager.once(() => this._fireHold(), CUSTOM_EFFECT_HOLD_MS, CUSTOM_EFFECT_HOLD_TASK);
    },
    endHold() {
        taskManager.kill(CUSTOM_EFFECT_HOLD_TASK);
    },
    cancelHold() {
        taskManager.kill(CUSTOM_EFFECT_HOLD_TASK);
        this._holdFired = false;
    },
    /** Giữ đủ 1.5s — đóng Control Center ngay trước khi mở Drawer (cùng khuôn workflowEqPresets._fireCycleHold()). */
    _fireHold() {
        this._holdFired = true;
        this._closeControlCenterIfLoaded();
        CUSTOM_EFFECT_HOLD_BY_LOCKED[appConfigViz.getAll().autoSwitchVisualEnabled === true]();
    },

    _closeControlCenterIfLoaded() {
        if (typeof closeControlCenter !== 'function') return;
        closeControlCenter(); // core/visualizer-control-center.js
    },

    /** `click` DOM thật trên #btn-cycle-mode (kể cả .click() của tap 3 lần). Click ngay sau khi giữ vừa mở Drawer -> bỏ
     * qua. Nút không `disabled` khi auto-switch bật để bấm/giữ còn hiện được lý do. */
    onCycleModeClick() {
        if (this._consumeHoldFired()) return;
        CUSTOM_EFFECT_CYCLE_CLICK_BY_LOCKED[appConfigViz.getAll().autoSwitchVisualEnabled === true]();
    },

    /** true (và xoá cờ) nếu Drawer vừa được mở bằng hold. */
    _consumeHoldFired() {
        const fired = this._holdFired;
        this._holdFired = false;
        return fired;
    },

    /** Mở Drawer cho effect ĐANG CHẠY. Chiều cao co theo nội dung, trần 70vh (field khác nhau theo effect). */
    open() {
        const vizCfg = appConfigViz.getAll();
        const type = vizCfg.type;
        this._openType = type;
        const cfg = resolveEffectConfig(vizCfg.customEffect, type); // core/custom-effect.js
        const config = {
            scrollKey: `customEffect:${type}`, // mở mới: từ đầu; `_rerenderBody()` cùng key -> giữ vị trí
            scrollReset: true,
            height: 'auto',
            maxHeight: '70vh',
            headerHtml: renderCustomEffectHeader(type, cfg), // components/custom-effect-drawer.js
            bodyHtml: renderCustomEffectBody(type, cfg),
            bodyClass: 'overflow-y-auto px-4 py-3',
        };
        CUSTOM_EFFECT_DRAWER_BY_CLOSED[genericDrawerPanel.classList.contains('hidden')](config);
    },

    /** Vẽ lại TOÀN BỘ body (đổi độ dài mảng đèn/chữ, field `rerender` làm field khác ẩn/hiện) — giữ vị trí cuộn. */
    _rerenderBody() {
        const type = this._openType;
        const cfg = this._openConfig();
        workflowGenericDrawerHelpers.update({
            scrollKey: `customEffect:${type}`,
            height: 'auto',
            maxHeight: '70vh',
            headerHtml: renderCustomEffectHeader(type, cfg),
            bodyHtml: renderCustomEffectBody(type, cfg),
            bodyClass: 'overflow-y-auto px-4 py-3',
        });
        workflowGenericDrawerHelpers.restoreScroll(); // event/workflow/generic-drawer-helpers.js
    },

    close() {
        workflowGenericDrawerHelpers.closeFully();
    },

    /** Config đầy đủ của effect đang mở trên Drawer. */
    _openConfig() {
        return resolveEffectConfig(appConfigViz.getAll().customEffect, this._openType); // core/custom-effect.js
    },

    /** Ghi 1 field của effect `type` — chọn ô lưu theo style hay theo group. */
    _writeField(type, field, value) {
        CUSTOM_EFFECT_WRITE_BY_PER_STYLE[isCustomEffectPerStyleField(type, field)](type, field, value); // core/custom-effect.js
    },

    /** Lưu config (thả tay slider blur). */
    commit() {
        saveConfig(); // core/config.js
    },

    // ===================== Màu =====================

    setColorMode(value) {
        this._writeField(this._openType, 'mode', value); // core/custom-effect.js
        saveConfig();
        syncCustomEffectColorModeRows(genericDrawerBody, value); // core/custom-effect-drawer-ui.js
        workflowVisualizerDisplay.syncProgressBarColor(); // event/workflow/visualizer-display.js
    },

    /** Ô màu solid (picker hoặc ô chữ hex) — ô chữ gõ dở (chưa đủ #RRGGBB) thì chưa áp. Đồng bộ ô đối ứng. */
    setSolidColor(value, crossTargetId) {
        if (!isCustomEffectHexColor(value)) return; // core/custom-effect.js
        this._writeField(this._openType, 'solidColor', value); // core
        setCustomEffectInputValueById(genericDrawerBody, crossTargetId, value); // core/custom-effect-drawer-ui.js
        saveConfig();
        workflowVisualizerDisplay.syncProgressBarColor();
    },

    setDynColor(field, value) {
        this._writeField(this._openType, field, value); // core
        saveConfig();
        this._syncProgressBarForDynB(field);
    },

    /** Thanh tiến trình mode dynamic chỉ dùng dynB (computeProgressBarFillColor(), core/visualizer/visualizer-display.js). */
    _syncProgressBarForDynB(field) {
        if (field !== 'dynB') return;
        workflowVisualizerDisplay.syncProgressBarColor();
    },

    // ===================== Blur =====================

    setBlurEnabled(checked) {
        this._writeField(this._openType, 'blurEnabled', checked); // core
        saveConfig();
        syncCustomEffectBlurRow(genericDrawerBody, checked); // core/custom-effect-drawer-ui.js
    },

    /** Kéo slider blur: áp ngay (vẽ frame kế tiếp thấy luôn), CHƯA lưu — lưu lúc thả tay (`commit()`). */
    previewBlurIntensity(raw) {
        const input = resolveCustomEffectSliderInput(raw, false, 0, '%'); // core
        this._writeField(this._openType, 'blurIntensity', input.value);
        setCustomEffectTextById(genericDrawerBody, 'ce-val-blur-intensity', input.text); // core/custom-effect-drawer-ui.js
    },

    // ===================== Field chung (toggle / select / slider) =====================

    /** Toggle hoặc select: ghi + lưu, rồi dựng lại scene (field.refresh) / vẽ lại Drawer (field.rerender) nếu cần. */
    setFieldValue(field, value) {
        this._writeField(this._openType, field, value); // core
        saveConfig();
        const meta = this._fieldMeta(field);
        this._refreshForField(meta);
        this._rerenderForField(meta);
    },

    /** Kéo slider: áp ngay + cập nhật số hiển thị, CHƯA lưu. */
    previewFieldSlider(field, raw, isFloat) {
        const meta = this._fieldMeta(field);
        const input = resolveCustomEffectSliderInput(raw, isFloat, (meta && meta.decimals) || 1, ''); // core
        this._writeField(this._openType, field, input.value);
        setCustomEffectFieldValueText(genericDrawerBody, field, input.text); // core/custom-effect-drawer-ui.js
    },

    /** Thả tay slider: lưu + dựng lại scene nếu field cần. */
    commitFieldSlider(field) {
        saveConfig();
        this._refreshForField(this._fieldMeta(field));
    },

    _fieldMeta(field) {
        return findCustomEffectFieldMeta(this._openType, field); // core/custom-effect.js
    },

    /** Field chỉ đọc lúc khởi tạo scene (`refresh`) -> ép dựng lại để thấy ngay. */
    _refreshForField(meta) {
        if (!meta || !meta.refresh) return;
        this._runRefresh(meta.refresh);
    },

    _runRefresh(name) {
        (CUSTOM_EFFECT_REFRESH_BY_NAME[name] || VIZ_NOOP)(); // VIZ_NOOP: event/workflow/visualizer-render.js
    },

    /** Field có `rerender` (vd burstEnabled của brain): field khác có showIf phụ thuộc nó -> vẽ lại body. */
    _rerenderForField(meta) {
        if (!meta || !meta.rerender) return;
        this._rerenderBody();
    },

    // ===================== Field ảnh (imagePick) — MỚI 28/09/2026 (nền mặt số clock) =====================

    /** Mở picker ảnh thư viện TẠI CHỖ trong Generic Drawer đang mở; chọn xong hoặc X (huỷ) đều quay lại màn Custom Effect
     * (vẽ lại body, giữ vị trí cuộn cũ). SỬA (07/10/2026, Giang báo "X của picker thoát luôn cả nó và custom effect") —
     * trước đây picker mở như 1 drawer riêng rồi `closeFully()` lúc chọn/huỷ, hẹn giờ ẩn của nó ẩn mất luôn Custom
     * Effect vừa mở lại — giờ `inPlace` (xem event/workflow/file-manager-photo.js::openCoverImagePicker()). */
    pickImageField(field) {
        const type = this._openType;
        workflowFileManagerPhoto.openCoverImagePicker((imageKey) => { // event/workflow/file-manager-photo.js
            this._writeField(type, field, imageKey);
            saveConfig();
            this._rerenderBody();
        }, () => this._rerenderBody(), { inPlace: true });
    },

    /** Bỏ ảnh đã chọn — effect quay về nguồn mặc định (clock: bìa bài đang phát). */
    clearImageField(field) {
        this._writeField(this._openType, field, null); // core
        saveConfig();
        this._rerenderBody();
    },

    // ===================== Lighting fireworks =====================

    /** Checkbox 14 kiểu nổ (customEffect.lighting.enabledStyles) — ghi thẳng, không vẽ lại. */
    setFireworksStyleEnabled(style, checked) {
        const cfg = this._openConfig();
        this._writeField(this._openType, 'enabledStyles', toggleFireworksStyleList(cfg.enabledStyles, style, checked)); // core
        saveConfig();
    },

    /** Chữ bắn pháo hoa (customEffect.lighting.customTexts) — thêm/xoá đổi độ dài mảng -> vẽ lại body. */
    addFireworksText(rawText) {
        const next = appendFireworksText(this._openConfig().customTexts, rawText); // core
        if (!next.isValid) return;
        this._writeField(this._openType, 'customTexts', next.list);
        saveConfig();
        this._rerenderBody();
    },

    removeFireworksText(index) {
        this._writeField(this._openType, 'customTexts', removeCustomEffectListItem(this._openConfig().customTexts, index)); // core
        saveConfig();
        this._rerenderBody();
    },

    // ===================== Rain street — đèn tuỳ chỉnh =====================

    /** Thêm/xoá đèn đổi ĐỘ DÀI mảng -> dựng lại cảnh phố + vẽ lại body. */
    addLamp() {
        const next = appendCustomLamp(this._openConfig().customLamps); // core
        if (!next.isValid) return;
        this._writeField(this._openType, 'customLamps', next.list);
        saveConfig();
        this._runRefresh('resizeCanvas');
        this._rerenderBody();
    },

    removeLamp(index) {
        this._writeField(this._openType, 'customLamps', removeCustomEffectListItem(this._openConfig().customLamps, index)); // core
        saveConfig();
        this._runRefresh('resizeCanvas');
        this._rerenderBody();
    },

    /** Kéo 1 slider của đèn thứ `index`: ghi đúng 1 field của đèn đó + số hiển thị, CHƯA lưu (không vẽ lại body). */
    previewLampSlider(index, key, raw) {
        const slider = CUSTOM_EFFECT_LAMP_SLIDERS[key];
        const input = resolveCustomEffectSliderInput(raw, slider.isFloat, 1, slider.suffix); // core
        this._writeField(this._openType, 'customLamps', replaceCustomLampField(this._openConfig().customLamps, index, slider.field, input.value)); // core
        setCustomEffectLampValueText(genericDrawerBody, index, key, input.text); // core/custom-effect-drawer-ui.js
    },

    /** Thả tay slider đèn: lưu + dựng lại cảnh phố. */
    commitLampSlider() {
        saveConfig();
        this._runRefresh('resizeCanvas');
    },
};
