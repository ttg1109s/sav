/**
 * Component: nội dung Generic Drawer cho "Custom Effect" (mở qua GIỮ 1.5s #btn-cycle-mode, xem
 * event/workflow/custom-effect.js). 1 tầng duy nhất (không List/Edit như EQ — luôn hiện đúng
 * effect ĐANG CHẠY). Bảng màu SÁNG cố định (Generic Drawer loại trừ theme, xem components/
 * eq-presets-drawer.js). Nội dung DATA-DRIVEN theo CUSTOM_EFFECT_STYLE/CUSTOM_EFFECT_FIELDS
 * (core/custom-effect.js) — Workflow tự querySelector + addEventListener sau mỗi lần render.
 *
 * SỬA (27/08/2026, phản hồi Giang mục 2 — "thu nhỏ gap cho generic drawer custom effect như eq
 * edit") — mọi khoảng cách dọc (gap section/py mỗi field) THU NHỎ 1 nấc so với bản trước (gap-4 ->
 * gap-2.5, py-3 -> py-2/py-2.5), khớp cảm giác nén chặt của components/eq-presets-drawer.js (band
 * slider `gap-1.5`) — KHÔNG đổi bố cục/thứ tự, chỉ đổi con số khoảng cách.
 *
 * THÊM (27/08/2026, phản hồi Giang mục 3 — "nút reset ở header, cho về thông số custom effect
 * (all effect)") — icon "khôi phục mặc định" trong header (CÙNG icon SVG với
 * components/eq-presets-drawer.js::resetBtn), reset TOÀN BỘ customEffect (mọi effect, không riêng
 * effect đang mở) — xem event/workflow/custom-effect.js::_resetAllCustomEffects().
 */

const CE_TOGGLE_MARKUP = (checked) => `
    <div class="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>`;

function renderCustomEffectHeader(type) {
    return `
        <div class="flex justify-between items-center px-5 pb-2.5 border-b border-slate-200">
            <h3 class="text-base font-bold text-slate-900">${t(VISUALIZER_TYPE_LABEL_KEYS[type] || type)}</h3>
            <div class="flex items-center gap-1 shrink-0">
                <button id="btn-ce-reset-all" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('customEffectDrawer.resetAll.title')}"><svg xmlns="http://www.w3.org/2000/svg" class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h5M4 9a8 8 0 1 1 2.34 5.66" /></svg></button>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
        </div>
    `;
}

function _renderCeStyleRow(type, cfg) {
    const style = CUSTOM_EFFECT_STYLE[type]; // core/custom-effect.js
    if (!style) return '';
    const labelKeys = CUSTOM_EFFECT_STYLE_LABEL_KEYS[type];
    const options = style.options.map((opt) => `<option value="${opt}" ${cfg[style.field] === opt ? 'selected' : ''}>${t(labelKeys[opt])}</option>`).join('');
    return `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 flex items-center justify-between gap-3">
            <span class="text-sm text-slate-700" data-i18n="customEffectDrawer.styleLabel">${t('customEffectDrawer.styleLabel')}</span>
            <select id="ce-style" class="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 outline-none">${options}</select>
        </div>
    `;
}

function _renderCeColorSection(cfg) {
    return `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
            <div class="flex justify-between items-center px-4 py-2.5 border-b border-slate-200">
                <span class="text-sm text-slate-700" data-i18n="visualizerSettingsDrawer.colorMode.label">${t('visualizerSettingsDrawer.colorMode.label')}</span>
                <select id="ce-color-mode" class="bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-xs text-slate-900 outline-none">
                    <option value="solid" ${cfg.mode === 'solid' ? 'selected' : ''} data-i18n="visualizerSettingsDrawer.colorMode.solid">${t('visualizerSettingsDrawer.colorMode.solid')}</option>
                    <option value="dynamic" ${cfg.mode === 'dynamic' ? 'selected' : ''} data-i18n="visualizerSettingsDrawer.colorMode.dynamic">${t('visualizerSettingsDrawer.colorMode.dynamic')}</option>
                    <option value="gradient" ${cfg.mode === 'gradient' ? 'selected' : ''} data-i18n="visualizerSettingsDrawer.colorMode.gradient">${t('visualizerSettingsDrawer.colorMode.gradient')}</option>
                </select>
            </div>
            <div id="ce-solid-color-row" class="${cfg.mode === 'solid' ? 'flex' : 'hidden'} justify-between items-center px-4 py-2.5">
                <span class="text-sm text-slate-500" data-i18n="visualizerSettingsDrawer.solidColor.label">${t('visualizerSettingsDrawer.solidColor.label')}</span>
                <div class="flex items-center gap-2">
                    <input type="text" id="ce-solid-color-text" data-cross-target="ce-solid-color-picker" value="${cfg.solidColor}" class="w-20 bg-transparent border-b border-slate-300 px-1 py-0.5 text-xs text-slate-900 outline-none font-mono text-right uppercase">
                    <div class="w-8 h-8 rounded-full border border-slate-300 overflow-hidden shrink-0"><input type="color" id="ce-solid-color-picker" data-cross-target="ce-solid-color-text" value="${cfg.solidColor}" class="w-10 h-10 -m-1 cursor-pointer"></div>
                </div>
            </div>
            <div id="ce-dynamic-color-row" class="${cfg.mode === 'dynamic' ? 'flex' : 'hidden'} justify-between items-center px-4 py-2.5">
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
            <div class="flex justify-between items-center px-4 py-2.5 ${cfg.blurEnabled ? 'border-b border-slate-200' : ''}">
                <span class="text-sm text-slate-700" data-i18n="customEffectDrawer.blurEnable">${t('customEffectDrawer.blurEnable')}</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="ce-blur-enable" class="sr-only peer" ${cfg.blurEnabled ? 'checked' : ''}>
                    ${CE_TOGGLE_MARKUP()}
                </label>
            </div>
            <div id="ce-blur-intensity-row" class="${cfg.blurEnabled ? 'flex' : 'hidden'} flex-col px-4 py-2.5">
                <div class="flex justify-between items-center mb-1.5"><span class="text-sm text-slate-500" data-i18n="customEffectDrawer.blurIntensity">${t('customEffectDrawer.blurIntensity')}</span><span id="ce-val-blur-intensity" class="text-xs text-sky-600 font-mono">${cfg.blurIntensity}%</span></div>
                <input type="range" id="ce-blur-intensity" min="0" max="100" step="5" value="${cfg.blurIntensity}" class="ce-slider">
            </div>
        </div>
    `;
}

/** MỚI (27/08/2026, phản hồi Giang mục 1d) — checklist bật/tắt TỪNG phần tử trong 1 field mảng
 * string (field.type === 'multiToggle'). `field.options` là mảng HOẶC hàm trả về mảng (dùng hàm
 * khi danh sách gốc định nghĩa ở file nạp SAU, xem core/custom-effect.js). Giá trị hiện tại rỗng/
 * chưa set -> coi như TẤT CẢ đang bật (khớp fallback của `pickGalaxyTypeFromBag()`,
 * core/webgl/three-space.js — hiển thị đúng thực tế engine đang dùng). */
function _renderCeMultiToggleField(field, cfg) {
    const options = typeof field.options === 'function' ? field.options() : field.options;
    const enabled = (cfg[field.id] && cfg[field.id].length > 0) ? cfg[field.id] : options;
    const rows = options.map((opt) => {
        const checked = enabled.includes(opt);
        const labelKey = field.optionLabelKeys && field.optionLabelKeys[opt];
        const label = labelKey ? t(labelKey) : opt;
        return `
            <div class="flex justify-between items-center px-4 py-2 border-b border-slate-200 last:border-b-0">
                <span class="text-sm text-slate-700">${label}</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer ce-field-multitoggle" data-field="${field.id}" data-option="${opt}" ${checked ? 'checked' : ''}>
                    ${CE_TOGGLE_MARKUP()}
                </label>
            </div>
        `;
    }).join('');
    return `
        <div class="flex flex-col px-4 py-2.5 border-b border-slate-200 last:border-b-0">
            <span class="text-sm text-slate-700 mb-1.5" data-i18n="${field.labelKey}">${t(field.labelKey)}</span>
            <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">${rows}</div>
        </div>
    `;
}

function _renderCeFieldRow(field, cfg) {
    if (field.showIf && !field.showIf(cfg)) return '';
    if (field.type === 'multiToggle') return _renderCeMultiToggleField(field, cfg);
    if (field.type === 'toggle') {
        return `
            <div class="flex justify-between items-center px-4 py-2 border-b border-slate-200 last:border-b-0">
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
        <div class="flex flex-col px-4 py-2 border-b border-slate-200 last:border-b-0">
            <div class="flex justify-between items-center mb-1.5"><span class="text-sm text-slate-700" data-i18n="${field.labelKey}">${t(field.labelKey)}</span><span class="text-xs text-sky-600 font-mono ce-field-val" data-field-val="${field.id}">${displayValue}</span></div>
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
        <div class="ce-lamp-row flex flex-col gap-2 px-4 py-2.5 border-b border-slate-200" data-lamp-index="${i}">
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
            <div class="flex justify-between items-center px-4 py-2.5 border-b border-slate-200">
                <span class="text-sm text-slate-700" data-i18n="customEffectDrawer.lamps.title">${t('customEffectDrawer.lamps.title')}</span>
                <span class="text-xs text-slate-400">${lamps.length}/${CUSTOM_EFFECT_MAX_LAMPS}</span>
            </div>
            ${rows}
            <button id="ce-lamp-add" class="w-full py-2.5 text-sm font-medium text-sky-600 ${atMax ? 'opacity-40 pointer-events-none' : ''}" data-i18n="customEffectDrawer.lamps.add">${t('customEffectDrawer.lamps.add')}</button>
        </div>
    `;
}

/** @param {string} type @param {object} cfg - getEffectConfig(type), core/custom-effect.js */
function renderCustomEffectBody(type, cfg) {
    const fields = (CUSTOM_EFFECT_FIELDS[type] || []).map((f) => _renderCeFieldRow(f, cfg)).join('');
    const lampsSection = (type === 'rain' && cfg.rainStyle === 'street') ? _renderCeLampsSection(cfg) : '';
    const showBlur = !CUSTOM_EFFECT_NO_BLUR.includes(type); // core/custom-effect.js
    return `
        <div class="flex flex-col gap-2.5 px-4 py-2.5">
            ${_renderCeStyleRow(type, cfg)}
            ${_renderCeColorSection(cfg)}
            ${showBlur ? _renderCeBlurSection(cfg) : ''}
            ${fields ? `<div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">${fields}</div>` : ''}
            ${lampsSection}
        </div>
    `;
}
