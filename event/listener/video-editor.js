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

workflowVideoEditor.init();
