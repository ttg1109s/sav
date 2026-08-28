/**
 * Component: nội dung Generic Drawer cho "Custom Effect" (mở qua GIỮ 1.5s #btn-cycle-mode, xem
 * event/workflow/custom-effect.js). 1 tầng duy nhất (không List/Edit như EQ — luôn hiện đúng
 * effect ĐANG CHẠY). Bảng màu SÁNG cố định (Generic Drawer loại trừ theme, xem components/
 * eq-presets-drawer.js). Nội dung DATA-DRIVEN theo CUSTOM_EFFECT_STYLE/CUSTOM_EFFECT_FIELDS
 * (core/custom-effect.js) — Workflow tự querySelector + addEventListener sau mỗi lần render.
 */

const CE_TOGGLE_MARKUP = (checked) => `
    <div class="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>`;

function renderCustomEffectHeader(type) {
    return `
        <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
            <h3 class="text-base font-bold text-slate-900">${t(VISUALIZER_TYPE_LABEL_KEYS[type] || type)}</h3>
            <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
    `;
}

function _renderCeStyleRow(type, cfg) {
    const style = CUSTOM_EFFECT_STYLE[type]; // core/custom-effect.js
    if (!style) return '';
    const labelKeys = CUSTOM_EFFECT_STYLE_LABEL_KEYS[type];
    const options = style.options.map((opt) => `<option value="${opt}" ${cfg[style.field] === opt ? 'selected' : ''}>${t(labelKeys[opt])}</option>`).join('');
    return `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <span class="text-sm text-slate-700" data-i18n="customEffectDrawer.styleLabel">${t('customEffectDrawer.styleLabel')}</span>
            <select id="ce-style" class="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 outline-none">${options}</select>
        </div>
    `;
}

function _renderCeColorSection(cfg) {
    return `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
            <div class="flex justify-between items-center px-4 py-3 border-b border-slate-200">
                <span class="text-sm text-slate-700" data-i18n="visualizerSettingsDrawer.colorMode.label">${t('visualizerSettingsDrawer.colorMode.label')}</span>
                <select id="ce-color-mode" class="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 outline-none">
                    <option value="solid" ${cfg.mode === 'solid' ? 'selected' : ''} data-i18n="visualizerSettingsDrawer.colorMode.solid">${t('visualizerSettingsDrawer.colorMode.solid')}</option>
                    <option value="dynamic" ${cfg.mode === 'dynamic' ? 'selected' : ''} data-i18n="visualizerSettingsDrawer.colorMode.dynamic">${t('visualizerSettingsDrawer.colorMode.dynamic')}</option>
                    <option value="gradient" ${cfg.mode === 'gradient' ? 'selected' : ''} data-i18n="visualizerSettingsDrawer.colorMode.gradient">${t('visualizerSettingsDrawer.colorMode.gradient')}</option>
                </select>
            </div>
            <div id="ce-solid-color-row" class="${cfg.mode === 'solid' ? 'flex' : 'hidden'} justify-between items-center px-4 py-3">
                <span class="text-sm text-slate-500" data-i18n="visualizerSettingsDrawer.solidColor.label">${t('visualizerSettingsDrawer.solidColor.label')}</span>
                <div class="flex items-center gap-2">
                    <input type="text" id="ce-solid-color-text" data-cross-target="ce-solid-color-picker" value="${cfg.solidColor}" class="w-20 bg-transparent border-b border-slate-300 px-1 py-0.5 text-xs text-slate-900 outline-none font-mono text-right uppercase">
                    <div class="w-8 h-8 rounded-full border border-slate-300 overflow-hidden shrink-0"><input type="color" id="ce-solid-color-picker" data-cross-target="ce-solid-color-text" value="${cfg.solidColor}" class="w-10 h-10 -m-1 cursor-pointer"></div>
                </div>
            </div>
            <div id="ce-dynamic-color-row" class="${cfg.mode === 'dynamic' ? 'flex' : 'hidden'} justify-between items-center px-4 py-3">
                <span class="text-sm text-slate-500" data-i18n="visualizerSettingsDrawer.dynamicColor.label">${t('visualizerSettingsDrawer.dynamicColor.label')}</span>
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full border border-slate-300 overflow-hidden shrink-0"><input type="color" id="ce-dyn-color-a" value="${cfg.dynA}" class="w-10 h-10 -m-1 cursor-pointer"></div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    <div class="w-8 h-8 rounded-full border border-slate-300 overflow-hidden shrink-0"><input type="color" id="ce-dyn-color-b" value="${cfg.dynB}" class="w-10 h-10 -m-1 cursor-pointer"></div>
                </div>
            </div>
        </div>
    `;
}

function _renderCeBlurSection(cfg) {
    return `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
            <div class="flex justify-between items-center px-4 py-3 ${cfg.blurEnabled ? 'border-b border-slate-200' : ''}">
                <span class="text-sm text-slate-700" data-i18n="customEffectDrawer.blurEnable">${t('customEffectDrawer.blurEnable')}</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="ce-blur-enable" class="sr-only peer" ${cfg.blurEnabled ? 'checked' : ''}>
                    ${CE_TOGGLE_MARKUP()}
                </label>
            </div>
            <div id="ce-blur-intensity-row" class="${cfg.blurEnabled ? 'flex' : 'hidden'} flex-col px-4 py-3">
                <div class="flex justify-between items-center mb-2"><span class="text-sm text-slate-500" data-i18n="customEffectDrawer.blurIntensity">${t('customEffectDrawer.blurIntensity')}</span><span id="ce-val-blur-intensity" class="text-xs text-sky-600 font-mono">${cfg.blurIntensity}%</span></div>
                <input type="range" id="ce-blur-intensity" min="0" max="100" step="5" value="${cfg.blurIntensity}" class="ce-slider">
            </div>
        </div>
    `;
}

function _renderCeFieldRow(field, cfg) {
    if (field.showIf && !field.showIf(cfg)) return '';
    if (field.type === 'toggle') {
        return `
            <div class="flex justify-between items-center px-4 py-3 border-b border-slate-200 last:border-b-0">
                <span class="text-sm text-slate-700" data-i18n="${field.labelKey}">${t(field.labelKey)}</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer ce-field-toggle" data-field="${field.id}" ${cfg[field.id] !== false ? 'checked' : ''}>
                    ${CE_TOGGLE_MARKUP()}
                </label>
            </div>
        `;
    }
    const value = cfg[field.id];
    const displayValue = field.type === 'sliderFloat' ? value.toFixed(field.decimals || 1) : value;
    return `
        <div class="flex flex-col px-4 py-3 border-b border-slate-200 last:border-b-0">
            <div class="flex justify-between items-center mb-2"><span class="text-sm text-slate-700" data-i18n="${field.labelKey}">${t(field.labelKey)}</span><span class="text-xs text-sky-600 font-mono ce-field-val" data-field-val="${field.id}">${displayValue}</span></div>
            <input type="range" class="ce-slider ce-field-slider" data-field="${field.id}" data-float="${field.type === 'sliderFloat' ? '1' : ''}" min="${field.min}" max="${field.max}" step="${field.step}" value="${value}">
        </div>
    `;
}

/** Đèn tuỳ chỉnh (Rain, style street) — customEffect.rain.customLamps, tối đa
 * CUSTOM_EFFECT_MAX_LAMPS (core/custom-effect.js). Mỗi đèn: X (%) + Chiều cao (px) + Flare.
 * FIX (14/08/2026, Giang báo "kéo slider lamp N, số không chạy theo trên UI") — div bọc mỗi hàng
 * CÓ class riêng `ce-lamp-row` (THÊM MỚI, cùng `data-lamp-index` như trước) — 3 slider bên trong
 * (`.ce-lamp-x/height/flare`) CŨNG tự mang `data-lamp-index` (để đọc index), nên
 * `el.closest('[data-lamp-index]')` phía Workflow (event/workflow/custom-effect.js::
 * wireLampSlider()) khớp NGAY CHÍNH slider đó (`.closest()` tính cả chính phần tử gọi), không leo
 * lên tới div cha — `querySelector('.ce-lamp-val...')` sau đó luôn `null`. Có `ce-lamp-row` làm
 * class riêng KHÔNG trùng bất kỳ phần tử con nào, Workflow đổi sang `.closest('.ce-lamp-row')` để
 * chắc chắn lấy đúng div cha. */
function _renderCeLampsSection(cfg) {
    const lamps = cfg.customLamps || [];
    const rows = lamps.map((lamp, i) => `
        <div class="ce-lamp-row flex flex-col gap-2 px-4 py-3 border-b border-slate-200" data-lamp-index="${i}">
            <div class="flex justify-between items-center">
                <span class="text-xs font-semibold text-slate-500">${t('customEffectDrawer.lamps.itemLabel')} ${i + 1}</span>
                <button class="ce-lamp-remove text-rose-500 text-xs font-medium" data-lamp-index="${i}">${t('customEffectDrawer.lamps.remove')}</button>
            </div>
            <div class="flex flex-col gap-1">
                <div class="flex justify-between items-center"><span class="text-xs text-slate-500">${t('customEffectDrawer.lamps.x')}</span><span class="text-xs text-sky-600 font-mono ce-lamp-val" data-lamp-val="x">${lamp.xPercent}%</span></div>
                <input type="range" class="ce-slider ce-lamp-x" data-lamp-index="${i}" min="0" max="100" step="1" value="${lamp.xPercent}">
            </div>
            <div class="flex flex-col gap-1">
                <div class="flex justify-between items-center"><span class="text-xs text-slate-500">${t('customEffectDrawer.lamps.height')}</span><span class="text-xs text-sky-600 font-mono ce-lamp-val" data-lamp-val="height">${lamp.heightPx}px</span></div>
                <input type="range" class="ce-slider ce-lamp-height" data-lamp-index="${i}" min="40" max="500" step="10" value="${lamp.heightPx}">
            </div>
            <div class="flex flex-col gap-1">
                <div class="flex justify-between items-center"><span class="text-xs text-slate-500">${t('customEffectDrawer.lamps.flare')}</span><span class="text-xs text-sky-600 font-mono ce-lamp-val" data-lamp-val="flare">${lamp.flareScale.toFixed(1)}</span></div>
                <input type="range" class="ce-slider ce-lamp-flare" data-lamp-index="${i}" min="0.3" max="3" step="0.1" value="${lamp.flareScale}">
            </div>
        </div>
    `).join('');
    const atMax = lamps.length >= CUSTOM_EFFECT_MAX_LAMPS; // core/custom-effect.js
    return `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
            <div class="flex justify-between items-center px-4 py-3 border-b border-slate-200">
                <span class="text-sm text-slate-700" data-i18n="customEffectDrawer.lamps.title">${t('customEffectDrawer.lamps.title')}</span>
                <span class="text-xs text-slate-400">${lamps.length}/${CUSTOM_EFFECT_MAX_LAMPS}</span>
            </div>
            ${rows}
            <button id="ce-lamp-add" class="w-full py-3 text-sm font-medium text-sky-600 ${atMax ? 'opacity-40 pointer-events-none' : ''}" data-i18n="customEffectDrawer.lamps.add">${t('customEffectDrawer.lamps.add')}</button>
        </div>
    `;
}

/** Style "fireworks" (nhóm Lighting) — checkbox nhiều chọn cho 14 kiểu nổ
 * (customEffect.lighting.enabledStyles, FIREWORKS_STYLE_KEYS ở core/config.js). Bỏ check hết vẫn
 * lưu được (không chặn ở UI) — Workflow tự fallback về đủ 14 kiểu, xem core/visualizer/types/
 * lighting.js::resolveEnabledFireworksStyles(). */
function _renderCeFireworksStylesSection(cfg) {
    const enabled = cfg.enabledStyles || [];
    const items = FIREWORKS_STYLE_KEYS.map((key) => `
        <label class="flex items-center gap-2 px-3 py-2 text-xs text-slate-700">
            <input type="checkbox" class="ce-fw-style-check" data-style="${key}" ${enabled.includes(key) ? 'checked' : ''}>
            <span data-i18n="customEffectDrawer.fireworks.style.${key}">${t(`customEffectDrawer.fireworks.style.${key}`)}</span>
        </label>
    `).join('');
    return `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
            <div class="px-4 py-3 border-b border-slate-200">
                <span class="text-sm text-slate-700" data-i18n="customEffectDrawer.fireworks.stylesTitle">${t('customEffectDrawer.fireworks.stylesTitle')}</span>
            </div>
            <div class="grid grid-cols-2">${items}</div>
        </div>
    `;
}

/** Style "fireworks" (nhóm Lighting) — chữ bắn pháo hoa (customEffect.lighting.customTexts), tối đa
 * CUSTOM_EFFECT_MAX_TEXTS (core/custom-effect.js) — bắn round-robin khi nhạc chuyển đoạn. */
function _renderCeFireworksTextsSection(cfg) {
    const texts = cfg.customTexts || [];
    const rows = texts.map((text, i) => `
        <div class="flex items-center justify-between gap-2 px-4 py-2 border-b border-slate-200">
            <span class="text-sm text-slate-800 font-mono truncate">${text}</span>
            <button class="ce-fw-text-remove text-rose-500 text-xs font-medium shrink-0" data-text-index="${i}">${t('customEffectDrawer.lamps.remove')}</button>
        </div>
    `).join('');
    const atMax = texts.length >= CUSTOM_EFFECT_MAX_TEXTS; // core/custom-effect.js
    return `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
            <div class="flex justify-between items-center px-4 py-3 border-b border-slate-200">
                <span class="text-sm text-slate-700" data-i18n="customEffectDrawer.fireworks.textsTitle">${t('customEffectDrawer.fireworks.textsTitle')}</span>
                <span class="text-xs text-slate-400">${texts.length}/${CUSTOM_EFFECT_MAX_TEXTS}</span>
            </div>
            ${rows}
            <div class="flex items-center gap-2 px-4 py-3 ${atMax ? 'opacity-40 pointer-events-none' : ''}">
                <input type="text" id="ce-fw-text-input" maxlength="10" placeholder="${t('customEffectDrawer.fireworks.textPlaceholder')}" class="flex-1 bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 outline-none uppercase font-mono">
                <button id="ce-fw-text-add" class="text-sm font-medium text-sky-600 shrink-0" data-i18n="customEffectDrawer.lamps.add">${t('customEffectDrawer.lamps.add')}</button>
            </div>
        </div>
    `;
}

/** @param {string} type @param {object} cfg - getEffectConfig(type), core/custom-effect.js */
function renderCustomEffectBody(type, cfg) {
    const fields = (CUSTOM_EFFECT_FIELDS[type] || []).map((f) => _renderCeFieldRow(f, cfg)).join('');
    const lampsSection = (type === 'rain' && cfg.rainStyle === 'street') ? _renderCeLampsSection(cfg) : '';
    const fireworksStylesSection = (type === 'lighting' && cfg.lightingStyle === 'fireworks') ? _renderCeFireworksStylesSection(cfg) : '';
    const fireworksTextsSection = (type === 'lighting' && cfg.lightingStyle === 'fireworks') ? _renderCeFireworksTextsSection(cfg) : '';
    const showBlur = !CUSTOM_EFFECT_NO_BLUR.includes(type); // core/custom-effect.js
    return `
        <div class="flex flex-col gap-4 px-4 py-3">
            ${_renderCeStyleRow(type, cfg)}
            ${_renderCeColorSection(cfg)}
            ${showBlur ? _renderCeBlurSection(cfg) : ''}
            ${fields ? `<div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">${fields}</div>` : ''}
            ${lampsSection}
            ${fireworksStylesSection}
            ${fireworksTextsSection}
        </div>
    `;
}
