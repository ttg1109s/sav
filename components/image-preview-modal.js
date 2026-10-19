/**
 * components/image-preview-modal.js — markup modal xem/sửa ảnh full-screen (core/file-manager/photo-ui.js::
 * openImagePreviewModal()). Ảnh nguồn (`src`/`alt`) do core gán vào slot `.photo-preview-image`.
 *
 * Cấu trúc: `mediaWrap` (Panzoom gắn ở đây) bọc `<img>` xem tạm + 4 canvas xếp chồng (base = pixel gốc sau thao tác
 * vĩnh viễn, render = kết quả Điều chỉnh, layer = Text/Shape/Image, interact = khung crop/nét nháp/khung biến đổi); các
 * popup công cụ ẩn sẵn; khung chữ nổi (tay nắm kéo + ô nhập nhiều dòng); header nổi (X | Layer, Lưu, Edit).
 *
 * NẠP SAU: core/ui-theme/icon-svg-ui.js (iconSvg). Lúc chạy: t() (lang/lang.js).
 */

const IMAGE_EDIT_SHAPE_TYPES = [
    { key: 'rect', icon: 'shape-rect' },
    { key: 'circle', icon: 'shape-circle' },
    { key: 'line', icon: 'shape-line' },
    { key: 'arrow', icon: 'shape-arrow' },
    { key: 'polygon', icon: 'shape-polygon' },
];

const IMAGE_EDIT_CROP_RATIOS = [
    { key: 'free', labelKey: 'fileManager.photo.image.cropRatioFree' },
    { key: '1:1', labelKey: 'fileManager.photo.image.cropRatioSquare' },
    { key: '4:3', label: '4:3' },
    { key: '3:4', label: '3:4' },
    { key: '16:9', label: '16:9' },
    { key: '9:16', label: '9:16' },
];

const IMAGE_EDIT_TRANSFORM_ACTIONS = [
    { key: 'flipX', icon: 'flip-horizontal', titleKey: 'fileManager.photo.image.transformFlipX' },
    { key: 'flipY', icon: 'flip-vertical', titleKey: 'fileManager.photo.image.transformFlipY' },
    { key: 'rotate90', icon: 'rotate', titleKey: 'fileManager.photo.image.transformRotate90' },
    { key: 'reset', icon: 'reset-transform', titleKey: 'fileManager.photo.image.transformReset' },
];

const IMAGE_PREVIEW_ROUND_BTN_CLASS = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';

/** @returns {string} cả overlay (`#image-preview-overlay`) */
function renderImagePreviewModalHtml() {
    // interactCanvas: `pointer-events-auto` thắng rule `canvas { pointer-events: none }` (assets/css/base.css) — đây là
    // canvas duy nhất nhận thao tác; `touch-none` để trình duyệt không giành cử chỉ kéo thành cuộn/pan.
    const mediaWrapHtml = '<div id="image-preview-media-wrap" class="absolute inset-0">'
        + '<img class="photo-preview-image">'
        + '<div id="image-edit-canvas-wrap" class="absolute inset-0 flex items-center justify-center">'
        + '<canvas id="image-edit-base-canvas" class="absolute w-full h-full"></canvas>'
        + '<canvas id="image-edit-render-canvas" class="absolute w-full h-full"></canvas>'
        + '<canvas id="image-edit-layer-canvas" class="absolute w-full h-full"></canvas>'
        + '<canvas id="image-edit-interact-canvas" class="absolute w-full h-full touch-none pointer-events-auto"></canvas>'
        + '</div></div>';

    // Popup chọn loại Shape — hiện lúc bấm tile "Shape", chọn xong mới tạo layer.
    const shapeTypePopupHtml = `<div id="image-edit-shape-type-popup" class="hidden absolute bottom-0 left-0 w-full photo-preview-scrim-bottom p-5 pb-8">
        <div class="flex justify-center gap-3">
            ${IMAGE_EDIT_SHAPE_TYPES.map((s) => `
                <button type="button" data-shape-type="${s.key}" class="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white">
                    ${iconSvg(s.icon, 'h-6 w-6')}
                </button>
            `).join('')}
        </div>
    </div>`;

    // Slider nhóm "Điều chỉnh" — kéo tới đâu áp tới đó, đóng popup không hoàn tác.
    const adjustPopupHtml = `<div id="image-edit-adjust-popup" class="hidden absolute bottom-0 left-0 w-full photo-preview-scrim-bottom p-5 pb-8">
        <div class="flex justify-between items-center mb-3 text-sm">
            <span id="image-edit-adjust-label" class="text-white/90 font-medium"></span>
            <div class="flex items-center gap-2">
                <span id="image-edit-adjust-value" class="text-sky-400 font-mono bg-white/10 px-2 py-0.5 rounded"></span>
                <button id="image-edit-adjust-done" type="button" class="w-7 h-7 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0">
                    ${iconSvg('check', 'h-4 w-4')}
                </button>
            </div>
        </div>
        <input type="range" id="image-edit-adjust-slider" min="-100" max="100" value="0" class="w-full">
    </div>`;

    // Thanh Huỷ / tiêu đề / Áp dụng — thay header lúc ở Crop/Vẽ/Text/Shape/Biến đổi.
    const contextBarHtml = `<div id="image-edit-context-bar" class="hidden photo-preview-scrim-top flex justify-between items-center px-4 pt-4 pb-3">
        <button id="image-edit-context-cancel" type="button" class="${IMAGE_PREVIEW_ROUND_BTN_CLASS}">
            ${iconSvg('x', 'h-5 w-5')}
        </button>
        <span id="image-edit-context-title" class="text-white text-sm font-semibold tracking-wide"></span>
        <button id="image-edit-context-apply" type="button" class="w-9 h-9 flex items-center justify-center rounded-full bg-sky-500 hover:bg-sky-400 transition-colors text-white shrink-0">
            ${iconSvg('check', 'h-5 w-5')}
        </button>
    </div>`;

    // Tỉ lệ Crop — hiện cùng lúc với contextBar, nằm ngay dưới nó.
    const cropRatioPopupHtml = '<div id="image-edit-crop-ratio-popup" class="hidden absolute top-16 left-0 w-full flex justify-center gap-2 px-4 overflow-x-auto">'
        + IMAGE_EDIT_CROP_RATIOS.map((r) => `
        <button type="button" data-crop-ratio="${r.key}" class="shrink-0 px-3 py-1.5 rounded-full bg-black/50 hover:bg-black/70 text-white text-xs font-medium border border-white/20 transition-colors">${r.label || t(r.labelKey)}</button>
    `).join('')
        + '</div>';

    // Khung gõ chữ nổi (tool Text): kéo bằng tay nắm, gõ trong ô nhập nhiều dòng (Enter xuống dòng).
    const floatingTextHtml = '<div id="image-edit-floating-text" class="hidden absolute z-20 flex items-start gap-1 bg-black/40 border border-dashed border-white rounded-lg shadow-lg px-2 py-2">'
        + `<button type="button" data-floating-text-grip class="image-edit-floating-grip" title="${escapeHtml(t('fileManager.photo.image.layerDragHint'))}">${iconSvg('drag-handle', 'h-5 w-5')}</button>`
        + '<textarea id="image-edit-floating-textarea" class="image-edit-floating-textarea" rows="1" spellcheck="false"></textarea>'
        + '</div>';

    // Biến đổi layer (kéo khung trên ảnh) — lật ngang/dọc, xoay 90°, đặt lại.
    const transformPopupHtml = `<div id="image-edit-transform-popup" class="hidden absolute bottom-0 left-0 w-full photo-preview-scrim-bottom p-5 pb-8">
        <div class="flex justify-center gap-3">
            ${IMAGE_EDIT_TRANSFORM_ACTIONS.map((a) => `
                <button type="button" data-transform-action="${a.key}" class="w-12 h-12 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white" title="${escapeHtml(t(a.titleKey))}">
                    ${iconSvg(a.icon, 'h-6 w-6')}
                </button>
            `).join('')}
        </div>
    </div>`;

    // Điều khiển Vẽ: Cọ/Tẩy + màu + cỡ nét.
    const drawPopupHtml = `<div id="image-edit-draw-popup" class="hidden absolute bottom-0 left-0 w-full photo-preview-scrim-bottom p-5 pb-8">
        <div class="flex justify-between items-center w-full mb-3">
            <div class="flex gap-4">
                <button id="image-edit-draw-brush" type="button" class="text-sky-400 text-sm font-medium">${t('fileManager.photo.image.editDrawBrush')}</button>
                <button id="image-edit-draw-eraser" type="button" class="text-white/60 text-sm font-medium">${t('fileManager.photo.image.editDrawEraser')}</button>
            </div>
            <input type="color" id="image-edit-draw-color" value="#0A84FF" class="w-7 h-7 rounded-full p-0 border-0 bg-transparent overflow-hidden">
        </div>
        <input type="range" id="image-edit-draw-size" min="1" max="100" value="10" class="w-full">
    </div>`;

    // Header nổi: X (trái) | Layer (danh sách layer), Lưu (menu Ghi đè/Lưu mới), Edit (lưới công cụ) (phải).
    const headerHtml = '<div data-image-preview-header class="photo-preview-scrim-top flex justify-between items-center px-4 pt-4 pb-3 gap-2">'
        + `<button data-image-preview-close class="${IMAGE_PREVIEW_ROUND_BTN_CLASS}">${iconSvg('x', 'h-5 w-5')}</button>`
        + '<div class="flex items-center gap-2">'
        + `<button data-image-preview-layers class="${IMAGE_PREVIEW_ROUND_BTN_CLASS}" title="${escapeHtml(t('fileManager.photo.image.layersTitle'))}">${iconSvg('layers', 'h-5 w-5')}</button>`
        + `<button data-image-preview-save class="${IMAGE_PREVIEW_ROUND_BTN_CLASS}" title="${escapeHtml(t('fileManager.photo.image.saveMenuTitle'))}">${iconSvg('save-image', 'h-5 w-5')}</button>`
        + `<button data-image-preview-tools class="${IMAGE_PREVIEW_ROUND_BTN_CLASS}" title="${escapeHtml(t('fileManager.photo.image.editGridTitle'))}">${iconSvg('pencil-alt', 'h-5 w-5')}</button>`
        + '</div></div>';

    return '<div id="image-preview-overlay" class="fixed inset-0 bg-black overflow-hidden">'
        + mediaWrapHtml + shapeTypePopupHtml + adjustPopupHtml + contextBarHtml + cropRatioPopupHtml + floatingTextHtml
        + drawPopupHtml + transformPopupHtml + headerHtml
        + '</div>';
}
