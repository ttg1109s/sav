/**
 * event/workflow/custom-effect.js — "THẰNG THỰC THI CUỐI" cho hệ Custom Effect.
 *
 * #btn-cycle-mode — DUY NHẤT 1 nút cho 2 việc (CÙNG khuôn #btn-cycle-eq, event/workflow/
 * eq-presets.js):
 *   - BẤM NGẮN (thả tay TRƯỚC 1.5s) — [SỬA 05/09/2026, yêu cầu Giang, "cải tiến -> modal choice,
 *     2 dropdown + select"] mở modal chọn effect (group -> style, `openEffectPickerModal()`,
 *     core/visualizer/visualizer-display.js) THAY VÌ tự xoay 1 bước như trước (`cycleVisualizerType()`
 *     cũ) — chọn thẳng effect muốn thay vì phải bấm nhiều lần mới tới đúng cái cần trong 12 style.
 *   - GIỮ đủ 1.5s — KHÔNG đổi gì (Giang chốt "hold ko đụng vào") — vẫn mở thẳng Custom Effect
 *     Drawer, hiện custom của effect ĐANG CHẠY, y hệt bản gốc.
 * Đếm giờ qua taskManager.once(), cờ `_holdFired` chặn action click chạy thêm lúc thả tay sau khi
 * đã mở Drawer bằng hold.
 *
 * [SỬA — 28/09/2026, dọn vi phạm event bus] Nội dung Drawer KHÔNG còn tự `querySelector` + `addEventListener`
 * sau mỗi lần vẽ (21 listener gắn lại mỗi lần render, callback gọi thẳng core). Nay: listener ủy quyền
 * event/listener/custom-effect.js -> router 'customEffect' (event/router/custom-effect.js) -> các hàm public bên
 * dưới; sửa DOM tại chỗ qua core/custom-effect-drawer-ui.js. Effect của Drawer đang mở nhớ ở `_openType` (trước
 * đây là biến `type` bị closure giữ lúc gắn listener — cùng ngữ nghĩa: auto-switch đổi effect giữa chừng thì
 * Drawer vẫn sửa đúng effect đang hiện trên Drawer). Rẽ nhánh -> guard + object map (readme/event-bus-flow.md mục 7).
 *
 * NẠP SAU: core/custom-effect.js, core/generic-drawer.js, components/custom-effect-drawer.js,
 * core/dom-refs.js (btnCycleMode, genericDrawer*), service/task-manager.js, event/workflow/
 * generic-drawer-helpers.js, core/visualizer-control-center.js (closeControlCenter() — SỬA
 * 14/08/2026, xem _fireHold()), core/visualizer/visualizer-display.js (openEffectPickerModal()),
 * core/custom-effect-drawer-ui.js. Lúc chạy: event/workflow/visualizer-render.js (applyStyle, rebuildCanvasScenes,
 * callGroupAction — thay applyVisualizerStyleChoice()/resizeCanvas()/initThreeJS*() gọi thẳng trước đây).
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
    false: () => openEffectPickerModal((style) => workflowVisualizerRender.applyStyle(style)), // core/visualizer/visualizer-display.js
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

/** Giá trị thô của slider -> số (sliderFloat / slider nguyên). */
const CUSTOM_EFFECT_PARSE_BY_FLOAT = {
    true: (raw) => parseFloat(raw),
    false: (raw) => parseInt(raw, 10),
};

/** Số hiển thị cạnh slider field thường. */
const CUSTOM_EFFECT_FIELD_TEXT_BY_FLOAT = {
    true: (v, decimals) => v.toFixed(decimals),
    false: (v) => v,
};

/** Số hiển thị cạnh slider đèn (1 chữ số thập phân cho flare). */
const CUSTOM_EFFECT_LAMP_TEXT_BY_FLOAT = {
    true: (v, suffix) => `${v.toFixed(1)}${suffix}`,
    false: (v, suffix) => `${v}${suffix}`,
};

/** 3 slider mỗi đèn (khoá do listener gửi) -> field trong customLamps[i] + đơn vị hiển thị. */
const CUSTOM_EFFECT_LAMP_SLIDERS = {
    x: { field: 'xPercent', suffix: '%', isFloat: false },
    height: { field: 'heightPx', suffix: 'px', isFloat: false },
    flare: { field: 'flareScale', suffix: '', isFloat: true },
};

/** Checkbox kiểu nổ pháo hoa: tick -> thêm vào danh sách; bỏ tick -> lọc ra. */
const CUSTOM_EFFECT_FW_STYLES_BY_CHECKED = {
    true: (list, key) => [...list, key],
    false: (list, key) => list.filter((s) => s !== key),
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
    /** SỬA (14/08/2026, Giang báo "giữ hold effect/eq không thu gọn icon center cùng lúc") — #btn-cycle-mode nằm
     * trong Control Center (core/visualizer-control-center.js): đóng nó NGAY TRƯỚC khi mở Drawer để đồng thời
     * (CÙNG bug/fix với `workflowEqPresets._fireCycleHold()`). GIỮ (hold) mở thẳng Custom Effect Drawer như bản gốc
     * (Giang chốt 05/09/2026 "hold ko đụng vào"). */
    _fireHold() {
        this._holdFired = true;
        this._closeControlCenterIfLoaded();
        CUSTOM_EFFECT_HOLD_BY_LOCKED[appConfigViz.getAll().autoSwitchVisualEnabled === true]();
    },

    _closeControlCenterIfLoaded() {
        if (typeof closeControlCenter !== 'function') return;
        closeControlCenter(); // core/visualizer-control-center.js
    },

    /** Ứng với `click` DOM thật trên #btn-cycle-mode (tap 3 lần gán cycleMode — event/workflow/visualizer-gesture.js,
     * gọi .click() — cũng đi qua đây). Click ngay sau khi hold vừa mở Drawer -> bỏ qua. [05/09/2026] mở modal chọn
     * effect thay vì tự xoay 1 bước; [26/09/2026] auto-switch đang bật thì chỉ báo lý do. [07/10/2026] GIỮ cũng bị chặn
     * khi auto-switch bật (xem CUSTOM_EFFECT_HOLD_BY_LOCKED) — nút vẫn không `disabled` để bấm/giữ còn hiện được lý do. */
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
        const type = appConfigViz.getAll().type;
        this._openType = type;
        const cfg = getEffectConfig(type); // core/custom-effect.js
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
        const cfg = getEffectConfig(type);
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

    /** Lưu config (thả tay slider blur). */
    commit() {
        saveConfig(); // core/config.js
    },

    // ===================== Màu =====================

    setColorMode(value) {
        setCustomEffectField(this._openType, 'mode', value); // core/custom-effect.js
        saveConfig();
        syncCustomEffectColorModeRows(genericDrawerBody, value); // core/custom-effect-drawer-ui.js
        updateProgressBarCSS(); // core/visualizer/visualizer-display.js
    },

    /** Ô màu solid (picker hoặc ô chữ hex) — ô chữ gõ dở (chưa đủ #RRGGBB) thì chưa áp. Đồng bộ ô đối ứng. */
    setSolidColor(value, crossTargetId) {
        if (!/^#[0-9A-F]{6}$/i.test(value)) return;
        setCustomEffectField(this._openType, 'solidColor', value); // core
        setCustomEffectInputValueById(genericDrawerBody, crossTargetId, value); // core/custom-effect-drawer-ui.js
        saveConfig();
        updateProgressBarCSS(); // core
    },

    setDynColor(field, value) {
        setCustomEffectField(this._openType, field, value); // core
        saveConfig();
        this._syncProgressBarForDynB(field);
    },

    /** Progress bar mode dynamic chỉ dùng dynB (core/visualizer/visualizer-display.js::updateProgressBarCSS). */
    _syncProgressBarForDynB(field) {
        if (field !== 'dynB') return;
        updateProgressBarCSS(); // core
    },

    // ===================== Blur =====================

    setBlurEnabled(checked) {
        setCustomEffectField(this._openType, 'blurEnabled', checked); // core
        saveConfig();
        syncCustomEffectBlurRow(genericDrawerBody, checked); // core/custom-effect-drawer-ui.js
    },

    /** Kéo slider blur: áp ngay (vẽ frame kế tiếp thấy luôn), CHƯA lưu — lưu lúc thả tay (`commit()`). */
    previewBlurIntensity(raw) {
        const v = parseInt(raw, 10);
        setCustomEffectField(this._openType, 'blurIntensity', v); // core
        setCustomEffectTextById(genericDrawerBody, 'ce-val-blur-intensity', `${v}%`); // core/custom-effect-drawer-ui.js
    },

    // ===================== Field chung (toggle / select / slider) =====================

    /** Toggle hoặc select: ghi + lưu, rồi dựng lại scene (field.refresh) / vẽ lại Drawer (field.rerender) nếu cần. */
    setFieldValue(field, value) {
        setCustomEffectField(this._openType, field, value); // core
        saveConfig();
        const meta = this._fieldMeta(field);
        this._refreshForField(meta);
        this._rerenderForField(meta);
    },

    /** Kéo slider: áp ngay + cập nhật số hiển thị, CHƯA lưu. */
    previewFieldSlider(field, raw, isFloat) {
        const v = CUSTOM_EFFECT_PARSE_BY_FLOAT[isFloat](raw);
        setCustomEffectField(this._openType, field, v); // core
        const meta = this._fieldMeta(field);
        const text = CUSTOM_EFFECT_FIELD_TEXT_BY_FLOAT[isFloat](v, (meta && meta.decimals) || 1);
        setCustomEffectFieldValueText(genericDrawerBody, field, text); // core/custom-effect-drawer-ui.js
    },

    /** Thả tay slider: lưu + dựng lại scene nếu field cần. */
    commitFieldSlider(field) {
        saveConfig();
        this._refreshForField(this._fieldMeta(field));
    },

    _fieldMeta(field) {
        return (CUSTOM_EFFECT_FIELDS[this._openType] || []).find((f) => f.id === field); // core/custom-effect.js
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
            setCustomEffectField(type, field, imageKey); // core/custom-effect.js
            saveConfig();
            this._rerenderBody();
        }, () => this._rerenderBody(), { inPlace: true });
    },

    /** Bỏ ảnh đã chọn — effect quay về nguồn mặc định (clock: bìa bài đang phát). */
    clearImageField(field) {
        setCustomEffectField(this._openType, field, null); // core
        saveConfig();
        this._rerenderBody();
    },

    // ===================== Lighting fireworks =====================

    /** Checkbox 14 kiểu nổ (customEffect.lighting.enabledStyles) — ghi thẳng, không vẽ lại. */
    setFireworksStyleEnabled(style, checked) {
        const cfg = getEffectConfig(this._openType); // core
        setCustomEffectField(this._openType, 'enabledStyles', CUSTOM_EFFECT_FW_STYLES_BY_CHECKED[checked](cfg.enabledStyles, style)); // core
        saveConfig();
    },

    /** Chữ bắn pháo hoa (customEffect.lighting.customTexts) — thêm/xoá đổi độ dài mảng -> vẽ lại body. */
    addFireworksText(rawText) {
        const cfg = getEffectConfig(this._openType); // core
        const text = rawText.trim().toUpperCase();
        if (!text || cfg.customTexts.length >= CUSTOM_EFFECT_MAX_TEXTS) return; // core
        setCustomEffectField(this._openType, 'customTexts', [...cfg.customTexts, text]); // core
        saveConfig();
        this._rerenderBody();
    },

    removeFireworksText(index) {
        const cfg = getEffectConfig(this._openType); // core
        setCustomEffectField(this._openType, 'customTexts', cfg.customTexts.filter((_, i) => i !== index)); // core
        saveConfig();
        this._rerenderBody();
    },

    // ===================== Rain street — đèn tuỳ chỉnh =====================

    /** Thêm/xoá đèn đổi ĐỘ DÀI mảng -> dựng lại cảnh phố + vẽ lại body. */
    addLamp() {
        const cfg = getEffectConfig(this._openType); // core
        if (cfg.customLamps.length >= CUSTOM_EFFECT_MAX_LAMPS) return; // core
        setCustomEffectField(this._openType, 'customLamps', [...cfg.customLamps, { ...CUSTOM_EFFECT_DEFAULT_LAMP }]); // core
        saveConfig();
        this._runRefresh('resizeCanvas');
        this._rerenderBody();
    },

    removeLamp(index) {
        const cfg = getEffectConfig(this._openType); // core
        setCustomEffectField(this._openType, 'customLamps', cfg.customLamps.filter((_, i) => i !== index)); // core
        saveConfig();
        this._runRefresh('resizeCanvas');
        this._rerenderBody();
    },

    /** Kéo 1 slider của đèn thứ `index`: ghi đúng 1 field của đèn đó + số hiển thị, CHƯA lưu (không vẽ lại body). */
    previewLampSlider(index, key, raw) {
        const slider = CUSTOM_EFFECT_LAMP_SLIDERS[key];
        const v = CUSTOM_EFFECT_PARSE_BY_FLOAT[slider.isFloat](raw);
        const cfg = getEffectConfig(this._openType); // core
        const next = cfg.customLamps.map((l, i) => (i === index ? { ...l, [slider.field]: v } : l));
        setCustomEffectField(this._openType, 'customLamps', next); // core
        setCustomEffectLampValueText(genericDrawerBody, index, key, CUSTOM_EFFECT_LAMP_TEXT_BY_FLOAT[slider.isFloat](v, slider.suffix)); // core/custom-effect-drawer-ui.js
    },

    /** Thả tay slider đèn: lưu + dựng lại cảnh phố. */
    commitLampSlider() {
        saveConfig();
        this._runRefresh('resizeCanvas');
    },
};
