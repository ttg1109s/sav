/**
 * components/image-edit-drawers.js — markup 2 màn Generic Drawer của trình sửa ảnh Photo (event/workflow/image-edit.js):
 *   - Lưới công cụ (icon Edit trên header modal ảnh): tile `[data-edit-tool]`, wire ở core/file-manager/photo-ui.js.
 *   - Danh sách Layer (icon Layer trên header modal ảnh): layer trên cùng đứng đầu; mỗi dòng có tay nắm kéo-thả sắp xếp,
 *     ẩn/hiện, biến đổi, xoá, độ mờ. Sự kiện: event/listener/image-edit.js ủy quyền trên genericDrawerBody/Header qua
 *     `data-image-layer-*` (nút X mang `data-image-layers-close`).
 *
 * NẠP SAU: lang/lang.js (t), core/ui-theme/icon-svg-ui.js (iconSvg), components/generic-drawer.js (buildDrawerHeaderHtml).
 * Lúc chạy: core/modal-choice-ui.js (escapeHtml).
 */

/** Lưới công cụ — `key` là khoá Workflow tra (EDIT_TOOL_OPEN_BY_KEY). */
const IMAGE_EDIT_TOOLS = [
    { key: 'brightness', icon: 'brightness', labelKey: 'fileManager.photo.image.editToolBrightness' },
    { key: 'contrast', icon: 'contrast', labelKey: 'fileManager.photo.image.editToolContrast' },
    { key: 'saturation', icon: 'saturation', labelKey: 'fileManager.photo.image.editToolSaturation' },
    { key: 'temperature', icon: 'thermometer', labelKey: 'fileManager.photo.image.editToolTemperature' },
    { key: 'tint', icon: 'tint', labelKey: 'fileManager.photo.image.editToolTint' },
    { key: 'sharpen', icon: 'sharpen', labelKey: 'fileManager.photo.image.editToolSharpen' },
    { key: 'crop', icon: 'crop', labelKey: 'fileManager.photo.image.editToolCrop' },
    { key: 'text', icon: 'text', labelKey: 'fileManager.photo.image.editToolText' },
    { key: 'draw', icon: 'pencil-alt', labelKey: 'fileManager.photo.image.editToolDraw' },
    { key: 'shape', icon: 'shape-polygon', labelKey: 'fileManager.photo.image.editToolShape' },
    { key: 'image', icon: 'photograph', labelKey: 'fileManager.photo.image.editToolImage' },
];

/** Icon theo loại layer trong danh sách. */
const IMAGE_EDIT_LAYER_ICON_BY_TYPE = { text: 'text', shape: 'shape-polygon', image: 'photograph' };

/** @returns {string} header lưới công cụ */
function renderImageEditToolGridHeaderHtml() {
    return buildDrawerHeaderHtml({ title: t('fileManager.photo.image.editGridTitle') });
}

/** @returns {string} body lưới công cụ (4 cột) */
function renderImageEditToolGridHtml() {
    return `
        <div class="grid grid-cols-4 gap-2 px-5 py-1">
            ${IMAGE_EDIT_TOOLS.map((tool) => `
                <button type="button" data-edit-tool="${tool.key}" class="flex flex-col items-center gap-1.5 py-3 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors">
                    <span class="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-700">${iconSvg(tool.icon, 'w-5 h-5')}</span>
                    <span class="text-[11px] font-medium text-slate-600 text-center leading-tight">${t(tool.labelKey)}</span>
                </button>
            `).join('')}
        </div>
    `;
}

/** @returns {string} header danh sách Layer (nút X riêng `data-image-layers-close`) */
function renderImageEditLayerPanelHeaderHtml() {
    return buildDrawerHeaderHtml({ title: t('fileManager.photo.image.layersTitle'), closeAttrs: 'data-image-layers-close="1"' });
}

/**
 * Body danh sách Layer. Nhãn layer Text là chữ người dùng gõ -> escape.
 * @param {Array<{id:number, type:string, label:string, visible:boolean, opacityPct:number}>} rows - computeImageEditLayerRows()
 * @returns {string}
 */
function renderImageEditLayerPanelHtml(rows) {
    if (!rows.length) {
        return `<p class="px-5 py-6 text-sm text-center" data-uitk="textSecondary">${t('fileManager.photo.image.layersEmpty')}</p>`;
    }
    const iconBtn = 'w-8 h-8 flex items-center justify-center rounded-full shrink-0 transition-colors';
    return `<div class="flex flex-col gap-1.5 px-4 pb-4">${rows.map((row) => `
        <div data-image-layer-row="${row.id}" class="image-edit-layer-row rounded-xl px-2 py-2 transition-colors" data-uitk="cardBg cardBorder">
            <div class="flex items-center gap-2">
                <button type="button" data-image-layer-drag="${row.id}" class="image-edit-layer-drag ${iconBtn}" data-uitk="textMutedIcon" title="${t('fileManager.photo.image.layerDragHint')}">${iconSvg('drag-handle', 'h-4 w-4')}</button>
                ${iconSvg(IMAGE_EDIT_LAYER_ICON_BY_TYPE[row.type] || 'photograph', 'h-4 w-4 shrink-0', 'data-uitk="textSecondary"')}
                <span class="flex-1 min-w-0 text-sm font-medium truncate${row.visible ? '' : ' opacity-50'}" data-uitk="textPrimary">${escapeHtml(row.label)}</span>
                <button type="button" data-image-layer-visible="${row.id}" class="${iconBtn}" data-uitk="cardHoverBg textSecondaryStrong" title="${t('fileManager.photo.image.layerShow')}">${iconSvg(row.visible ? 'eye' : 'eye-off', 'h-4 w-4')}</button>
                <button type="button" data-image-layer-transform="${row.id}" class="${iconBtn}" data-uitk="cardHoverBg textSecondaryStrong" title="${t('fileManager.photo.image.layerMenuTransform')}">${iconSvg('arrows-expand', 'h-4 w-4')}</button>
                <button type="button" data-image-layer-delete="${row.id}" class="${iconBtn}" data-uitk="cardHoverBg textSecondaryStrong" title="${t('fileManager.photo.image.layerMenuDelete')}">${iconSvg('trash', 'h-4 w-4')}</button>
            </div>
            <div class="flex items-center gap-3 pl-9 pr-2 pt-1">
                <span class="text-xs shrink-0" data-uitk="textSecondary">${t('fileManager.photo.image.layerOpacity')}</span>
                <input type="range" min="0" max="100" step="1" value="${row.opacityPct}" data-image-layer-opacity="${row.id}" class="flex-1 min-w-0" data-uitk="accentControl">
                <span class="w-10 shrink-0 text-right text-xs font-semibold tabular-nums" data-image-layer-opacity-label="${row.id}" data-uitk="textPrimary">${row.opacityPct}%</span>
            </div>
        </div>`).join('')}</div>`;
}
