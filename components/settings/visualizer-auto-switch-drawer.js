/**
 * Component: Settings > Visualizer Screen > Auto-Switch Effect — panel chính + sub panel "Effect list".
 *   - Panel chính: bật/tắt, thứ tự chạy (theo sắp xếp / ngẫu nhiên), thời gian Fixed (const | random min-max, nút mở
 *     time picker 10s-1h) | Per media, hàng mở sub panel "Effect list". Mọi tuỳ chọn LUÔN hiện dù bật hay tắt.
 *   - Sub panel "Effect list": dropdown danh sách theo Group/Style + danh sách item kéo thả (tay cầm ⋮⋮, cùng khuôn hàng
 *     Point Move — components/motion-settings-drawer.js::renderPointMoveListBody()) + checkbox tham gia; group có thêm
 *     dropdown style cụ thể / Random.
 * Render THUẦN từ `model` (workflowAutoSwitchVisual.buildPanelModel()), không đọc config trực tiếp. Sự kiện:
 * event/listener/auto-switch-visual.js (change/click/pointer delegate trên genericDrawerBody).
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
                ${iconSvg('drag-handle', 'h-4 w-4')}
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
                            ${iconSvg('chevron-right', 'h-4 w-4 shrink-0', 'data-uitk="textMutedIcon"')}
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

/** SUB PANEL "Effect list" (danh sách tách khỏi panel chính cho gọn) — dropdown Group/Style + gợi ý kéo thả + danh sách
 * item. Mở từ hàng #btn-auto-switch-open-list của panel chính (event/workflow/app-settings.js::_renderAutoSwitchList()).
 * Kéo thả: event/listener/auto-switch-visual.js -> workflowAutoSwitchVisual.startItemDrag()...
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
