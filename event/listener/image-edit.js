/**
 * event/listener/image-edit.js — TẤT CẢ listener của trang `image-edit.html`. Trang nhỏ, KHÔNG
 * tách `core/dom-refs.js` riêng (cùng lý do `event/listener/subtitle-editor.js`) — khai `const`
 * tham chiếu DOM NGAY ĐẦU file này.
 *
 * NẠP SAU: DOM tĩnh của image-edit.html đã render, event/bus.js, event/router/image-edit.js,
 * event/workflow/image-edit.js. Tự gọi workflowImageEdit.init() ngay khi chạy (dòng cuối file).
 */
const imageEditTitleEl = document.getElementById('image-edit-title');
const imageEditSourceEl = document.getElementById('image-edit-source');
const imageEditCanvasWrap = document.getElementById('image-edit-canvas-wrap');
const imageEditFatalErrorEl = document.getElementById('image-edit-fatal-error');
const btnBackImageEdit = document.getElementById('btn-back-image-edit');
const btnSaveImageEdit = document.getElementById('btn-save-image-edit');
const btnIeCrop = document.getElementById('btn-ie-crop');
const btnIeRotateLeft = document.getElementById('btn-ie-rotate-left');
const btnIeRotateRight = document.getElementById('btn-ie-rotate-right');
const btnIeFlipH = document.getElementById('btn-ie-flip-h');
const btnIeFlipV = document.getElementById('btn-ie-flip-v');
const btnIeGrayscale = document.getElementById('btn-ie-grayscale');
const btnIeReset = document.getElementById('btn-ie-reset');
const sliderBrightness = document.getElementById('slider-brightness');
const sliderContrast = document.getElementById('slider-contrast');
const sliderSaturation = document.getElementById('slider-saturation');

btnBackImageEdit.addEventListener('click', () => {
    eventBus.send({ router: 'imageEdit', type: 'imageEdit.back.click', payload: {} });
});
btnSaveImageEdit.addEventListener('click', () => {
    eventBus.send({ router: 'imageEdit', type: 'imageEdit.save.click', payload: {} });
});
btnIeCrop.addEventListener('click', () => {
    eventBus.send({ router: 'imageEdit', type: 'imageEdit.crop.click', payload: {} });
});
btnIeRotateLeft.addEventListener('click', () => {
    eventBus.send({ router: 'imageEdit', type: 'imageEdit.rotateLeft.click', payload: {} });
});
btnIeRotateRight.addEventListener('click', () => {
    eventBus.send({ router: 'imageEdit', type: 'imageEdit.rotateRight.click', payload: {} });
});
btnIeFlipH.addEventListener('click', () => {
    eventBus.send({ router: 'imageEdit', type: 'imageEdit.flipH.click', payload: {} });
});
btnIeFlipV.addEventListener('click', () => {
    eventBus.send({ router: 'imageEdit', type: 'imageEdit.flipV.click', payload: {} });
});
btnIeGrayscale.addEventListener('click', () => {
    eventBus.send({ router: 'imageEdit', type: 'imageEdit.grayscale.click', payload: {} });
});
btnIeReset.addEventListener('click', () => {
    eventBus.send({ router: 'imageEdit', type: 'imageEdit.reset.click', payload: {} });
});
[sliderBrightness, sliderContrast, sliderSaturation].forEach((slider) => {
    slider.addEventListener('input', () => {
        eventBus.send({ router: 'imageEdit', type: 'imageEdit.filter.change', payload: {} });
    });
});

workflowImageEdit.init();
