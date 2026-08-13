/**
 * event/workflow/custom-effect.js — "THẰNG THỰC THI CUỐI" cho hệ Custom Effect.
 *
 * #btn-cycle-mode — DUY NHẤT 1 nút cho 2 việc (CÙNG khuôn #btn-cycle-eq, event/workflow/
 * eq-presets.js):
 *   - BẤM NGẮN (thả tay TRƯỚC 1.5s) — xoay effect kế tiếp (cycleVisualizerType(), core).
 *   - GIỮ đủ 1.5s — mở Generic Drawer, hiện custom của effect ĐANG CHẠY.
 * Đếm giờ qua taskManager.once(), cờ `_holdFired` chặn cycle chạy thêm lúc thả tay sau khi đã mở
 * drawer. Workflow tự querySelector + addEventListener trực tiếp lên genericDrawerBody/Header sau
 * mỗi lần render (KHÔNG qua eventBus cho nội dung động bên trong Drawer).
 *
 * NẠP SAU: core/custom-effect.js, core/generic-drawer.js, components/custom-effect-drawer.js,
 * core/dom-refs.js (btnCycleMode, genericDrawer*), service/task-manager.js, event/workflow/
 * generic-drawer-helpers.js.
 */

const CUSTOM_EFFECT_HOLD_MS = 1500;
const CUSTOM_EFFECT_HOLD_TASK = 'customEffectCycleHoldPending';

const workflowCustomEffect = {
    _holdFired: false,

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
    _fireHold() {
        this._holdFired = true;
        this.open();
    },

    /** Ứng với `click` DOM thật trên #btn-cycle-mode. */
    onCycleModeClick() {
        if (this._holdFired) { this._holdFired = false; return; }
        cycleVisualizerType(); // core
    },

    /** Mở Drawer cho effect ĐANG CHẠY. */
    open() {
        const type = appConfigViz.getAll().type;
        const cfg = getEffectConfig(type); // core/custom-effect.js
        const config = {
            headerHtml: renderCustomEffectHeader(type), // components/custom-effect-drawer.js
            bodyHtml: renderCustomEffectBody(type, cfg),
            bodyClass: 'overflow-y-auto px-4 py-3',
        };
        if (genericDrawerPanel.classList.contains('hidden')) openGenericDrawer(config); // core/generic-drawer.js
        else updateGenericDrawer(config);
        this._wire(type);
    },

    /** Vẽ lại TOÀN BỘ body — dùng khi đổi style con (field showIf phụ thuộc style có thể ẩn/hiện). */
    _rerenderBody(type) {
        const cfg = getEffectConfig(type);
        updateGenericDrawer({
            headerHtml: renderCustomEffectHeader(type),
            bodyHtml: renderCustomEffectBody(type, cfg),
            bodyClass: 'overflow-y-auto px-4 py-3',
        });
        this._wire(type);
    },

    /** Gọi 1 hàm core refresh theo tên (field.refresh, core/custom-effect.js::CUSTOM_EFFECT_FIELDS)
     * — field chỉ đọc lúc khởi tạo scene, cần ép chạy lại để thấy hiệu quả ngay. */
    _runRefresh(name) {
        if (name === 'resizeCanvas') resizeCanvas(); // core
        else if (name === 'initThreeJS') initThreeJS(); // core/webgl
    },

    _wire(type) {
        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => workflowGenericDrawerHelpers.closeFully());

        const styleSelect = genericDrawerBody.querySelector('#ce-style');
        if (styleSelect) {
            styleSelect.addEventListener('change', (e) => {
                const styleField = CUSTOM_EFFECT_STYLE[type].field; // core/custom-effect.js
                setCustomEffectField(type, styleField, e.target.value); // core
                saveConfig();
                if (type === 'rain') resizeCanvas();
                else if (type === 'vortex') updateVortexVisibility();
                this._rerenderBody(type);
            });
        }

        const colorModeSelect = genericDrawerBody.querySelector('#ce-color-mode');
        const solidRow = genericDrawerBody.querySelector('#ce-solid-color-row');
        const dynamicRow = genericDrawerBody.querySelector('#ce-dynamic-color-row');
        if (colorModeSelect) {
            colorModeSelect.addEventListener('change', (e) => {
                setCustomEffectField(type, 'mode', e.target.value); // core
                saveConfig();
                solidRow.classList.toggle('hidden', e.target.value !== 'solid');
                solidRow.classList.toggle('flex', e.target.value === 'solid');
                dynamicRow.classList.toggle('hidden', e.target.value !== 'dynamic');
                dynamicRow.classList.toggle('flex', e.target.value === 'dynamic');
                updateProgressBarCSS(); // core
            });
        }

        const solidText = genericDrawerBody.querySelector('#ce-solid-color-text');
        const solidPicker = genericDrawerBody.querySelector('#ce-solid-color-picker');
        if (solidPicker) {
            solidPicker.addEventListener('input', (e) => {
                setCustomEffectField(type, 'solidColor', e.target.value); // core
                if (solidText) solidText.value = e.target.value;
                saveConfig();
                updateProgressBarCSS(); // core
            });
        }
        if (solidText) {
            solidText.addEventListener('input', (e) => {
                if (!/^#[0-9A-F]{6}$/i.test(e.target.value)) return;
                setCustomEffectField(type, 'solidColor', e.target.value); // core
                if (solidPicker) solidPicker.value = e.target.value;
                saveConfig();
                updateProgressBarCSS(); // core
            });
        }

        const dynA = genericDrawerBody.querySelector('#ce-dyn-color-a');
        const dynB = genericDrawerBody.querySelector('#ce-dyn-color-b');
        if (dynA) dynA.addEventListener('input', (e) => { setCustomEffectField(type, 'dynA', e.target.value); saveConfig(); });
        if (dynB) dynB.addEventListener('input', (e) => { setCustomEffectField(type, 'dynB', e.target.value); saveConfig(); updateProgressBarCSS(); });

        const blurToggle = genericDrawerBody.querySelector('#ce-blur-enable');
        const blurIntensityRow = genericDrawerBody.querySelector('#ce-blur-intensity-row');
        if (blurToggle) {
            blurToggle.addEventListener('change', (e) => {
                setCustomEffectField(type, 'blurEnabled', e.target.checked); // core
                saveConfig();
                blurIntensityRow.classList.toggle('hidden', !e.target.checked);
                blurIntensityRow.classList.toggle('flex', e.target.checked);
            });
        }
        const blurIntensity = genericDrawerBody.querySelector('#ce-blur-intensity');
        const blurIntensityVal = genericDrawerBody.querySelector('#ce-val-blur-intensity');
        if (blurIntensity) {
            blurIntensity.addEventListener('input', (e) => {
                const v = parseInt(e.target.value, 10);
                setCustomEffectField(type, 'blurIntensity', v); // core
                if (blurIntensityVal) blurIntensityVal.textContent = `${v}%`;
            });
            blurIntensity.addEventListener('change', () => saveConfig());
        }

        genericDrawerBody.querySelectorAll('.ce-field-toggle').forEach((el) => {
            el.addEventListener('change', (e) => {
                const field = e.target.dataset.field;
                setCustomEffectField(type, field, e.target.checked); // core
                saveConfig();
                const meta = (CUSTOM_EFFECT_FIELDS[type] || []).find((f) => f.id === field); // core
                if (meta && meta.refresh) this._runRefresh(meta.refresh);
            });
        });

        genericDrawerBody.querySelectorAll('.ce-field-slider').forEach((el) => {
            const field = el.dataset.field;
            const isFloat = el.dataset.float === '1';
            const meta = (CUSTOM_EFFECT_FIELDS[type] || []).find((f) => f.id === field); // core
            const valEl = genericDrawerBody.querySelector(`.ce-field-val[data-field-val="${field}"]`);
            el.addEventListener('input', (e) => {
                const v = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                setCustomEffectField(type, field, v); // core
                if (valEl) valEl.textContent = isFloat ? `${v.toFixed(1)}x` : v;
            });
            el.addEventListener('change', () => {
                saveConfig();
                if (meta && meta.refresh) this._runRefresh(meta.refresh);
            });
        });
    },
};
