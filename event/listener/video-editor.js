/**
 * event/listener/video-editor.js — TẤT CẢ listener của trang `video-editor.html`. Trang nhỏ, KHÔNG
 * tách `core/dom-refs.js` riêng (cùng lý do `event/listener/image-edit.js`) — khai `const` tham
 * chiếu DOM NGAY ĐẦU file này.
 *
 * NẠP SAU: DOM tĩnh của video-editor.html đã render, event/bus.js, event/router/video-editor.js,
 * event/workflow/video-editor.js. Tự gọi workflowVideoEditor.init() ngay khi chạy (dòng cuối file).
 */
const videoEditorTitleEl = document.getElementById('video-editor-title');
const videoEditorPreviewWrapEl = document.getElementById('video-editor-preview-wrap');
const videoEditorSourceEl = document.getElementById('video-editor-source');
const videoEditorFatalErrorEl = document.getElementById('video-editor-fatal-error');
const videoEditorCropOverlayEl = document.getElementById('video-editor-crop-overlay');
const videoEditorCropSourceEl = document.getElementById('video-editor-crop-source');
const videoEditorCropBadgeEl = document.getElementById('video-editor-crop-badge');
const btnBackVideoEditor = document.getElementById('btn-back-video-editor');
const btnVeCrop = document.getElementById('btn-ve-crop');
const btnVeCropReset = document.getElementById('btn-ve-crop-reset');
const btnVeRotateLeft = document.getElementById('btn-ve-rotate-left');
const btnVeRotateRight = document.getElementById('btn-ve-rotate-right');
const btnVeReset = document.getElementById('btn-ve-reset');
const btnVideoEditorCropCancel = document.getElementById('btn-video-editor-crop-cancel');
const btnVideoEditorCropConfirm = document.getElementById('btn-video-editor-crop-confirm');
// MỚI (Batch 2) — Cut (filmstrip + kéo thả 2 tay cầm).
const videoEditorCutOverlayEl = document.getElementById('video-editor-cut-overlay');
const videoEditorCutBadgeEl = document.getElementById('video-editor-cut-badge');
const videoEditorCutFilmstripWrapEl = document.getElementById('video-editor-cut-filmstrip-wrap');
const videoEditorCutFilmstripEl = document.getElementById('video-editor-cut-filmstrip');
const videoEditorCutDimLeftEl = document.getElementById('video-editor-cut-dim-left');
const videoEditorCutDimRightEl = document.getElementById('video-editor-cut-dim-right');
const videoEditorCutSelectionBorderEl = document.getElementById('video-editor-cut-selection-border');
const videoEditorCutHandleStartEl = document.getElementById('video-editor-cut-handle-start');
const videoEditorCutHandleEndEl = document.getElementById('video-editor-cut-handle-end');
const videoEditorCutRangeLabelEl = document.getElementById('video-editor-cut-range-label');
const btnVeCut = document.getElementById('btn-ve-cut');
const btnVeCutReset = document.getElementById('btn-ve-cut-reset');
const btnVideoEditorCutCancel = document.getElementById('btn-video-editor-cut-cancel');
const btnVideoEditorCutConfirm = document.getElementById('btn-video-editor-cut-confirm');
// MỚI (Batch 2) — Trích xuất ảnh.
const btnVeExtractFrame = document.getElementById('btn-ve-extract-frame');
const sliderVeBrightness = document.getElementById('slider-ve-brightness');
const sliderVeContrast = document.getElementById('slider-ve-contrast');
const sliderVeSaturation = document.getElementById('slider-ve-saturation');

btnBackVideoEditor.addEventListener('click', () => {
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.back.click', payload: {} });
});
btnVeCrop.addEventListener('click', () => {
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.crop.click', payload: {} });
});
btnVeCropReset.addEventListener('click', () => {
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.cropReset.click', payload: {} });
});
btnVideoEditorCropCancel.addEventListener('click', () => {
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.cropCancel.click', payload: {} });
});
btnVideoEditorCropConfirm.addEventListener('click', () => {
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.cropConfirm.click', payload: {} });
});
btnVeRotateLeft.addEventListener('click', () => {
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.rotateLeft.click', payload: {} });
});
btnVeRotateRight.addEventListener('click', () => {
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.rotateRight.click', payload: {} });
});
btnVeReset.addEventListener('click', () => {
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.reset.click', payload: {} });
});
[sliderVeBrightness, sliderVeContrast, sliderVeSaturation].forEach((slider) => {
    slider.addEventListener('input', () => {
        eventBus.send({ router: 'videoEdit', type: 'videoEdit.filter.change', payload: {} });
    });
});

// MỚI (Batch 2) — Cut.
btnVeCut.addEventListener('click', () => {
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.cut.click', payload: {} });
});
btnVeCutReset.addEventListener('click', () => {
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.cutReset.click', payload: {} });
});
btnVideoEditorCutCancel.addEventListener('click', () => {
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.cutCancel.click', payload: {} });
});
btnVideoEditorCutConfirm.addEventListener('click', () => {
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.cutConfirm.click', payload: {} });
});
// Kéo thả 2 tay cầm — Pointer Events (thống nhất chuột/chạm, cùng quy ước Pointer Events đã dùng
// ở Simple Farm). `setPointerCapture` để pointermove/pointerup vẫn nhận được dù ngón tay/chuột di
// chuyển RA NGOÀI phạm vi tay cầm trong lúc kéo — không cần lắng nghe trên `document`.
[
    { el: videoEditorCutHandleStartEl, handle: 'start' },
    { el: videoEditorCutHandleEndEl, handle: 'end' },
].forEach(({ el, handle }) => {
    el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        eventBus.send({ router: 'videoEdit', type: 'videoEdit.cutDrag.start', payload: { handle, clientX: e.clientX } });
    });
    el.addEventListener('pointermove', (e) => {
        if (!el.hasPointerCapture(e.pointerId)) return; // guard — không đang kéo tay cầm NÀY
        eventBus.send({ router: 'videoEdit', type: 'videoEdit.cutDrag.move', payload: { clientX: e.clientX } });
    });
    el.addEventListener('pointerup', (e) => {
        el.releasePointerCapture(e.pointerId);
        eventBus.send({ router: 'videoEdit', type: 'videoEdit.cutDrag.end', payload: {} });
    });
    el.addEventListener('pointercancel', () => {
        eventBus.send({ router: 'videoEdit', type: 'videoEdit.cutDrag.end', payload: {} });
    });
});

// MỚI (Batch 2) — Trích xuất ảnh.
btnVeExtractFrame.addEventListener('click', () => {
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.extractFrame.click', payload: {} });
});

workflowVideoEditor.init();
