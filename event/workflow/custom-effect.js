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
 * generic-drawer-helpers.js, core/visualizer-control-center.js (closeControlCenter() — SỬA
 * 14/08/2026, xem _fireHold()).
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
    /** SỬA (14/08/2026, Giang báo "giữ hold effect/eq không thu gọn icon center cùng lúc") — CÙNG
     * bug/fix với `workflowEqPresets._fireCycleHold()` (event/workflow/eq-presets.js): #btn-cycle-mode
     * nằm trong Control Center (core/visualizer-control-center.js), panel đó trước đây chỉ tự đóng
     * lúc `click` DOM thật bắn ra (SAU `pointerup`) — giữ đủ 1.5s thì Drawer mở nhưng Control Center
     * vẫn còn mở, chỉ thu gọn khi thả tay sau đó. Gọi thẳng `closeControlCenter()` (liên tuyến
     * domain, CÙNG tiền lệ `core/player-controls.js`) NGAY TRƯỚC khi mở Drawer để đồng thời. */
    _fireHold() {
        this._holdFired = true;
        if (typeof closeControlCenter === 'function') closeControlCenter(); // core/visualizer-control-center.js
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
        // SỬA (phản hồi Giang mục 1 — CÙNG lý do event/workflow/eq-presets.js::openListView(), xem
        // comment đầy đủ ở đó) — config này TRƯỚC ĐÂY không có height/maxHeight, rơi về mặc định fix
        // cứng 70vh của core/generic-drawer.js — nội dung thay đổi theo TỪNG loại effect (số field
        // khác nhau) nhưng panel luôn 1 kích thước, không co theo thật. GIỮ NGUYÊN 70vh làm trần —
        // hành vi KHÔNG đổi với effect có nhiều field (vượt trần vẫn y hệt trước), chỉ MỚI co nhỏ lại
        // được với effect ít field.
        const config = {
            height: 'auto',
            maxHeight: '70vh',
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
        // SỬA (phản hồi Giang mục 1) — CÙNG lý do open() ngay trên (vẽ lại đúng nội dung TƯƠNG TỰ,
        // config phải khớp nhau).
        updateGenericDrawer({
            height: 'auto',
            maxHeight: '70vh',
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
                if (valEl) valEl.textContent = isFloat ? v.toFixed((meta && meta.decimals) || 1) : v;
            });
            el.addEventListener('change', () => {
                saveConfig();
                if (meta && meta.refresh) this._runRefresh(meta.refresh);
            });
        });

        if (type === 'rain') this._wireLamps(type);
        if (type === 'lighting') { this._wireFireworksStyles(type); this._wireFireworksTexts(type); }
    },

    /** Checkbox 14 kiểu nổ (customEffect.lighting.enabledStyles, style con "fireworks") — mỗi
     * checkbox ghi thẳng field, không re-render. No-op khi style hiện tại là "thunder" (section
     * không render nên querySelectorAll rỗng), cùng khuôn if (type==='rain') this._wireLamps(). */
    _wireFireworksStyles(type) {
        genericDrawerBody.querySelectorAll('.ce-fw-style-check').forEach((el) => {
            el.addEventListener('change', (e) => {
                const cfg = getEffectConfig(type);
                const key = e.target.dataset.style;
                const next = e.target.checked
                    ? [...cfg.enabledStyles, key]
                    : cfg.enabledStyles.filter((s) => s !== key);
                setCustomEffectField(type, 'enabledStyles', next); // core
                saveConfig();
            });
        });
    },

    /** Chữ bắn pháo hoa (customEffect.lighting.customTexts) — thêm/xoá đổi độ dài mảng -> re-
     * render toàn body, cùng khuôn _wireLamps(). */
    _wireFireworksTexts(type) {
        const addBtn = genericDrawerBody.querySelector('#ce-fw-text-add');
        const input = genericDrawerBody.querySelector('#ce-fw-text-input');
        if (addBtn && input) {
            addBtn.addEventListener('click', () => {
                const cfg = getEffectConfig(type);
                const text = input.value.trim().toUpperCase();
                if (!text || cfg.customTexts.length >= CUSTOM_EFFECT_MAX_TEXTS) return; // core
                setCustomEffectField(type, 'customTexts', [...cfg.customTexts, text]); // core
                saveConfig();
                this._rerenderBody(type);
            });
        }
        genericDrawerBody.querySelectorAll('.ce-fw-text-remove').forEach((el) => {
            el.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.textIndex, 10);
                const cfg = getEffectConfig(type);
                setCustomEffectField(type, 'customTexts', cfg.customTexts.filter((_, i) => i !== idx)); // core
                saveConfig();
                this._rerenderBody(type);
            });
        });
    },

    /** Đèn tuỳ chỉnh (Rain, style street) — customEffect.rain.customLamps (mảng, core/custom-
     * effect.js). Thêm/xoá đổi ĐỘ DÀI mảng -> re-render toàn body. 3 slider/đèn chỉ đổi 1 field
     * -> ghi thẳng, không re-render (chỉ cập nhật số hiển thị tại chỗ, giống field thường). */
    _wireLamps(type) {
        const addBtn = genericDrawerBody.querySelector('#ce-lamp-add');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const cfg = getEffectConfig(type);
                if (cfg.customLamps.length >= CUSTOM_EFFECT_MAX_LAMPS) return;
                const next = [...cfg.customLamps, { ...CUSTOM_EFFECT_DEFAULT_LAMP }];
                setCustomEffectField(type, 'customLamps', next);
                saveConfig(); this._runRefresh('resizeCanvas');
                this._rerenderBody(type);
            });
        }
        genericDrawerBody.querySelectorAll('.ce-lamp-remove').forEach((el) => {
            el.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.lampIndex, 10);
                const cfg = getEffectConfig(type);
                const next = cfg.customLamps.filter((_, i) => i !== idx);
                setCustomEffectField(type, 'customLamps', next);
                saveConfig(); this._runRefresh('resizeCanvas');
                this._rerenderBody(type);
            });
        });
        const wireLampSlider = (selector, field, unit, isFloat) => {
            genericDrawerBody.querySelectorAll(selector).forEach((el) => {
                const idx = parseInt(el.dataset.lampIndex, 10);
                // FIX (14/08/2026, Giang báo "kéo slider lamp N, số không chạy theo trên UI") —
                // TRƯỚC `.closest('[data-lamp-index]')` khớp NGAY chính `el` (slider tự mang
                // data-lamp-index để đọc idx ở dòng trên) thay vì leo lên div cha -> valEl luôn
                // null. Đổi sang class riêng `ce-lamp-row` (components/custom-effect-drawer.js,
                // KHÔNG trùng bất kỳ phần tử con nào) để chắc chắn lấy đúng div cha.
                const row = el.closest('.ce-lamp-row');
                const valEl = row ? row.querySelector(`.ce-lamp-val[data-lamp-val="${unit.key}"]`) : null;
                el.addEventListener('input', (e) => {
                    const v = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
                    const cfg = getEffectConfig(type);
                    const next = cfg.customLamps.map((l, i) => (i === idx ? { ...l, [field]: v } : l));
                    setCustomEffectField(type, 'customLamps', next);
                    if (valEl) valEl.textContent = isFloat ? `${v.toFixed(1)}${unit.suffix}` : `${v}${unit.suffix}`;
                });
                el.addEventListener('change', () => { saveConfig(); this._runRefresh('resizeCanvas'); });
            });
        };
        wireLampSlider('.ce-lamp-x', 'xPercent', { key: 'x', suffix: '%' }, false);
        wireLampSlider('.ce-lamp-height', 'heightPx', { key: 'height', suffix: 'px' }, false);
        wireLampSlider('.ce-lamp-flare', 'flareScale', { key: 'flare', suffix: '' }, true);
    },
};
