/**
 * Component: panel body "Auto-Switch Effect" (components/settings/visualizer-geometry-color.js mở
 * qua #setting-open-visualizer-auto-switch, panel RIÊNG ngang hàng "Customize Visualizer").
 *
 * MỚI (12/08/2026, Giang yêu cầu tái cấu trúc Setting Main mục 4f) — TÁCH từ card "AUTO-SWITCH
 * EFFECT" cũ (từng là 1 trong 4 section bên trong panel "Customize Visualizer", components/
 * visualizer-settings-drawer.js) thành panel RIÊNG — ĐÚNG NGUYÊN markup/id/logic cũ (core/
 * auto-switch-visual.js, event/workflow/visualizer-display.js::openAutoSwitchPanel(), hàm MỚI TÁCH
 * từ openPanel() — xem docstring ở đó), KHÔNG đổi gì ngoài vị trí. Bỏ H3 tiêu đề card lặp lại tên
 * panel (panel header đã có sẵn "Auto-Switch Effect" — CÙNG khuôn panel Cử chỉ/EQ, không panel nào
 * lặp lại tên chính nó thành 1 section con bên trong).
 *
 * SỬA (09/09/2026, Giang yêu cầu "xử lý triệt để dark cũ") — viết LẠI TRỰC TIẾP bằng bảng màu sáng,
 * không còn phụ thuộc `.app-settings-scope` đè màu (assets/css/layout-nav.css).
 *
 * VIẾT LẠI (26/09/2026, Giang "cải tiến lại Auto-Switch Effect"): (1) mọi tuỳ chọn LUÔN hiện dù bật hay tắt;
 * (3a) dropdown danh sách theo Group/Style; (3b) danh sách item kéo thả (tay cầm ⋮⋮, CÙNG khuôn hàng Point Move —
 * components/motion-settings-drawer.js::renderPointMoveListBody()) + checkbox tham gia; (3c) group có thêm
 * dropdown style cụ thể / Random; (3d) thứ tự chạy theo sắp xếp / ngẫu nhiên; (4) thời gian Fixed (const |
 * random min-max, nút mở time picker 10s-1h) | Per media. Render THUẦN từ `model` (Workflow dựng —
 * workflowAutoSwitchVisual.buildPanelModel()), không đọc config trực tiếp. Wiring: event/listener/
 * auto-switch-visual.js (change/click delegated) + workflowVisualizerDisplay.openAutoSwitchPanel() (kéo thả).
 */

/** "1h 05m 30s" / "2m 05s" / "45s" — hiển thị giá trị giây trên nút mở time picker. */
function _formatAutoSwitchSeconds(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (h > 0) return `${h}h ${pad(m)}m ${pad(s)}s`;
    if (m > 0) return `${m}m ${pad(s)}s`;
    return `${s}s`;
}

function _renderAutoSwitchSelectRow(id, labelKey, options, value, withBorder) {
    return `
                    <div class="flex justify-between items-center p-4${withBorder ? ' border-b' : ''}" data-uitk="dividerBorder cardHoverBg">
                        <span class="text-sm font-medium" data-i18n="${labelKey}">${t(labelKey)}</span>
                        <select id="${id}" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText">
                            ${options.map((o) => `<option value="${o.value}" ${o.value === value ? 'selected' : ''} data-i18n="${o.labelKey}">${t(o.labelKey)}</option>`).join('')}
                        </select>
                    </div>`;
}

function _renderAutoSwitchSecondsRow(fieldName, labelKey, seconds, withBorder) {
    return `
                    <div class="flex justify-between items-center p-4${withBorder ? ' border-b' : ''}" data-uitk="dividerBorder cardHoverBg">
                        <span class="text-sm font-medium" data-i18n="${labelKey}">${t(labelKey)}</span>
                        <button type="button" data-as-seconds="${fieldName}" class="rounded-lg px-3 py-1.5 text-xs outline-none min-w-[60px] text-right shrink-0" data-uitk="cardHoverBg inputBg inputBorder inputText">${_formatAutoSwitchSeconds(seconds)}</button>
                    </div>`;
}

/** 1 hàng item: tay cầm kéo | checkbox | tên (+ tên group mờ khi liệt kê style) | [dropdown style khi là group]. */
function _renderAutoSwitchItemRow(listBy, item) {
    const isGroup = listBy === 'group';
    const name = isGroup ? t(VISUALIZER_GROUP_LABEL_KEYS[item.key] || item.key) : t(VISUALIZER_STYLE_LABEL_KEYS[item.key] || item.key); // core/visualizer/visualizer-display.js
    const sub = isGroup ? '' : `<span class="text-xs truncate" data-uitk="textSecondary">${t(VISUALIZER_GROUP_LABEL_KEYS[STYLE_TO_GROUP[item.key]] || '')}</span>`;
    const styleSelect = isGroup ? `
            <select data-as-group-style="${item.key}" class="rounded-lg px-2 py-1.5 text-xs outline-none w-28 shrink-0" data-uitk="inputBg inputBorder inputText">
                <option value="random" ${item.style === 'random' ? 'selected' : ''}>${t('visualizerSettingsDrawer.autoSwitchGroupStyle.random')}</option>
                ${(EFFECT_GROUPS[item.key] || []).map((st) => `<option value="${st}" ${item.style === st ? 'selected' : ''}>${t(VISUALIZER_STYLE_LABEL_KEYS[st] || st)}</option>`).join('')}
            </select>` : '';
    return `
        <div class="w-full px-2 py-2 rounded-2xl mb-2 flex items-center gap-1.5" data-uitk="cardBg cardBorder" data-as-row="${item.key}">
            <span class="w-5 h-8 flex items-center justify-center shrink-0 cursor-grab touch-none" data-uitk="textMutedIcon" data-as-drag="${item.key}" title="${t('motionSettingsDrawer.pointMove.dragHandle.title')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><circle cx="6" cy="5" r="1.4"/><circle cx="14" cy="5" r="1.4"/><circle cx="6" cy="10" r="1.4"/><circle cx="14" cy="10" r="1.4"/><circle cx="6" cy="15" r="1.4"/><circle cx="14" cy="15" r="1.4"/></svg>
            </span>
            <input type="checkbox" data-as-check="${item.key}" class="w-4 h-4 rounded shrink-0" data-uitk="accentControl" ${item.enabled ? 'checked' : ''}>
            <span class="flex-1 min-w-0 flex flex-col">
                <span class="text-sm font-semibold truncate" data-uitk="textSecondaryStrong">${name}</span>
                ${sub}
            </span>
            ${styleSelect}
        </div>`;
}

/** @param {{cfg:object, listBy:'group'|'style', items:object[]}} model - workflowAutoSwitchVisual.buildPanelModel() */
function renderVisualizerAutoSwitchPanelBody(model) {
    const cfg = model.cfg;
    const isFixed = cfg.autoSwitchVisualTimeMode === 'fixed';
    const isRandomKind = cfg.autoSwitchVisualFixedKind === 'random';
    let timingRows = _renderAutoSwitchSelectRow('setting-auto-switch-time-mode', 'visualizerSettingsDrawer.autoSwitchTimeMode.label', [
        { value: 'fixed', labelKey: 'visualizerSettingsDrawer.autoSwitchTimeMode.fixed' },
        { value: 'perMedia', labelKey: 'visualizerSettingsDrawer.autoSwitchTimeMode.perMedia' },
    ], cfg.autoSwitchVisualTimeMode, true);
    if (isFixed) {
        timingRows += _renderAutoSwitchSelectRow('setting-auto-switch-fixed-kind', 'visualizerSettingsDrawer.autoSwitchFixedKind.label', [
            { value: 'const', labelKey: 'visualizerSettingsDrawer.autoSwitchFixedKind.const' },
            { value: 'random', labelKey: 'visualizerSettingsDrawer.autoSwitchFixedKind.random' },
        ], cfg.autoSwitchVisualFixedKind, true);
        timingRows += isRandomKind
            ? _renderAutoSwitchSecondsRow('autoSwitchVisualSecondsRandomMin', 'visualizerSettingsDrawer.autoSwitchRandomMin.label', cfg.autoSwitchVisualSecondsRandomMin, true)
              + _renderAutoSwitchSecondsRow('autoSwitchVisualSecondsRandom', 'visualizerSettingsDrawer.autoSwitchRandomMax.label', cfg.autoSwitchVisualSecondsRandom, false)
            : _renderAutoSwitchSecondsRow('autoSwitchVisualSecondsFixed', 'visualizerSettingsDrawer.autoSwitchFixed.label', cfg.autoSwitchVisualSecondsFixed, false);
    } else {
        timingRows += `
                    <p class="text-xs leading-relaxed p-4" data-uitk="textSecondary" data-i18n="visualizerSettingsDrawer.autoSwitchPerMedia.hint">${t('visualizerSettingsDrawer.autoSwitchPerMedia.hint')}</p>`;
    }

    return `
                <div class="rounded-2xl flex flex-col overflow-hidden mb-3" data-uitk="cardBg cardBorder">
                    <div class="flex justify-between items-center p-4">
                        <div class="pr-3">
                            <div class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.autoSwitchEnable.label">${t('visualizerSettingsDrawer.autoSwitchEnable.label')}</div>
                            <div class="text-xs mt-0.5" data-uitk="textSecondary" data-i18n="visualizerSettingsDrawer.autoSwitchEnable.hint">${t('visualizerSettingsDrawer.autoSwitchEnable.hint')}</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" id="setting-auto-switch-enable" class="sr-only peer" ${cfg.autoSwitchVisualEnabled ? 'checked' : ''}>
                            <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner" data-uitk="toggleTrackOff toggleTrackOn"></div>
                        </label>
                    </div>
                </div>

                <div class="rounded-2xl flex flex-col overflow-hidden mb-3" data-uitk="cardBg cardBorder">
                    <button type="button" id="btn-auto-switch-open-list" class="flex justify-between items-center p-4 w-full text-left border-b" data-uitk="dividerBorder cardHoverBg">
                        <span class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.autoSwitchList.label">${t('visualizerSettingsDrawer.autoSwitchList.label')}</span>
                        <span class="flex items-center gap-1 shrink-0">
                            <span class="text-xs" data-uitk="textSecondary">${t(model.listBy === 'group' ? 'visualizerSettingsDrawer.autoSwitchListBy.group' : 'visualizerSettingsDrawer.autoSwitchListBy.style')} &middot; ${model.items.filter((item) => item.enabled).length}/${model.items.length}</span>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" data-uitk="textMutedIcon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </span>
                    </button>
                    ${_renderAutoSwitchSelectRow('setting-auto-switch-mode', 'visualizerSettingsDrawer.autoSwitchMode.label', [
                        { value: 'sequential', labelKey: 'visualizerSettingsDrawer.autoSwitchMode.sequential' },
                        { value: 'random', labelKey: 'visualizerSettingsDrawer.autoSwitchMode.random' },
                    ], cfg.autoSwitchVisualMode, false)}
                </div>
                <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                    ${timingRows}
                </div>
`;
}

/** SUB PANEL "Effect list" (MỚI 26/09/2026, Giang "cho danh sách style/group vào sub panel riêng, tránh dài quá") —
 * dropdown Group/Style + gợi ý kéo thả + danh sách item. Mở từ hàng #btn-auto-switch-open-list của panel chính
 * (event/workflow/app-settings.js::_renderAutoSwitchList()). Kéo thả gắn ở workflowVisualizerDisplay.openAutoSwitchPanel().
 * @param {{cfg:object, listBy:'group'|'style', items:object[]}} model */
function renderVisualizerAutoSwitchListBody(model) {
    return `
                <div class="rounded-2xl flex flex-col overflow-hidden mb-3" data-uitk="cardBg cardBorder">
                    ${_renderAutoSwitchSelectRow('setting-auto-switch-list-by', 'visualizerSettingsDrawer.autoSwitchListBy.label', [
                        { value: 'group', labelKey: 'visualizerSettingsDrawer.autoSwitchListBy.group' },
                        { value: 'style', labelKey: 'visualizerSettingsDrawer.autoSwitchListBy.style' },
                    ], model.listBy, false)}
                </div>
                <p class="text-xs mb-3 px-1" data-uitk="textSecondary" data-i18n="visualizerSettingsDrawer.autoSwitchList.dragHint">${t('visualizerSettingsDrawer.autoSwitchList.dragHint')}</p>
                <div id="auto-switch-item-list">
                    ${model.items.map((item) => _renderAutoSwitchItemRow(model.listBy, item)).join('')}
                </div>
`;
}
