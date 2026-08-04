/**
 * core/file-manager/video-ui.js — Modal xem/sửa Video (Rule 5d, readme/core-function-
 * conventions.md). Khung tĩnh ở components/video-preview.js (TPL_VIDEO_PREVIEW) — hàm dưới đây CHỈ
 * soạn `slotMap` (Core biết cấu trúc DOM của chính nó) rồi gọi `service/component-dynamic.js::
 * instantiateComponent()` để clone+điền, sau đó append + wire addEventListener (Rule 5a, gom cuối
 * hàm, callback CHỈ eventBus.send()) + trả `handle`.
 *
 * Toàn bộ dữ liệu động (videoUrl/posterUrl/filename/ratioPresets) PHẢI đã được Workflow chuẩn bị
 * sẵn (Rule 3b — Core là tầng thi hành, không tự đọc/tạo gì) — hàm này CHỈ nhận qua tham số.
 *
 * `mediaWrapEl` trả về trong handle để Workflow tự đo hộp video thật (`_syncCropCanvasBox()`) rồi
 * đặt CSS `cropCanvasEl` khớp — SỬA (04/08/2026) lỗi `<video>`/`<canvas>` lệch nhau do `absolute` +
 * flex cha không tương thích (xem docstring components/video-preview.js).
 *
 * NẠP SAU: components/video-preview.js, service/component-dynamic.js, service/z-index.js,
 * lang/lang.js.
 */

/**
 * @param {{videoUrl: string, posterUrl: string, filename: string, ratioPresets: Array<{labelKey: string, ratio: number}>}} data
 * @returns {object} handle — { close, overlayEl, videoEl, posterEl, cropLayerEl, cropCanvasEl,
 *   ratioButtons, ratioFlipBtn, filmstripTrackEl, startHandleEl, endHandleEl, dimLeftEl, dimRightEl,
 *   rangeBorderEl, playheadEl, currentTimeLabelEl, saveBtn, closeBtn, cropToggleBtn, extractBtn,
 *   undoBtn, redoBtn, resetBtn, rotateLeftBtn, rotateRightBtn }
 */
function openVideoPreviewModal(data) {
    const stale = document.getElementById('video-preview-overlay');
    if (stale) stale.remove();

    const ratioButtonSlots = {};
    data.ratioPresets.forEach((preset, i) => {
        ratioButtonSlots[`ratio${i}`] = { selector: `[data-ratio-idx="${i}"]`, prop: 'textContent', value: t(preset.labelKey) };
    });

    const fragment = instantiateComponent(TPL_VIDEO_PREVIEW, { // service/component-dynamic.js
        poster: { selector: '#video-preview-poster', prop: 'src', value: data.posterUrl },
        video: { selector: '#video-preview-video', prop: 'src', value: data.videoUrl },
        saveBtn: { selector: '#video-preview-save-btn', prop: 'textContent', value: t('videoPreview.btnSave.title') },
        ...ratioButtonSlots,
    });

    const overlayEl = fragment.querySelector('#video-preview-overlay');
    overlayEl.style.zIndex = String(Z_INDEX.VIDEO_PREVIEW); // service/z-index.js

    const mediaWrapEl = fragment.querySelector('#video-preview-media-wrap');
    const videoEl = fragment.querySelector('#video-preview-video');
    const posterEl = fragment.querySelector('#video-preview-poster');
    const cropLayerEl = fragment.querySelector('#video-preview-crop-layer');
    const cropCanvasEl = fragment.querySelector('#video-preview-crop-canvas');
    const toolsGroupEl = fragment.querySelector('#video-preview-tools-group');
    const ratioGroupEl = fragment.querySelector('#video-preview-ratio-group');
    const ratioButtons = data.ratioPresets.map((preset, i) => ({ btn: fragment.querySelector(`[data-ratio-idx="${i}"]`), ratio: preset.ratio }));
    const ratioFlipBtn = fragment.querySelector('#video-preview-ratio-flip');
    const filmstripTrackEl = fragment.querySelector('#video-preview-filmstrip-track');
    const filmstripFramesEl = fragment.querySelector('#video-preview-filmstrip-frames');
    const startHandleEl = fragment.querySelector('#video-preview-start-handle');
    const endHandleEl = fragment.querySelector('#video-preview-end-handle');
    const dimLeftEl = fragment.querySelector('#video-preview-dim-left');
    const dimRightEl = fragment.querySelector('#video-preview-dim-right');
    const rangeBorderEl = fragment.querySelector('#video-preview-range-border');
    const playheadEl = fragment.querySelector('#video-preview-playhead');
    const currentTimeLabelEl = fragment.querySelector('#video-preview-current-time-label');
    const closeBtn = fragment.querySelector('#video-preview-close-btn');
    const saveBtn = fragment.querySelector('#video-preview-save-btn');
    const cropToggleBtn = fragment.querySelector('#video-preview-crop-toggle-btn');
    const extractBtn = fragment.querySelector('#video-preview-extract-btn');
    const undoBtn = fragment.querySelector('#video-preview-undo-btn');
    const redoBtn = fragment.querySelector('#video-preview-redo-btn');
    const resetBtn = fragment.querySelector('#video-preview-reset-btn');
    const rotateLeftBtn = fragment.querySelector('#video-preview-rotate-left-btn');
    const rotateRightBtn = fragment.querySelector('#video-preview-rotate-right-btn');

    document.body.appendChild(fragment);
    overlayEl.classList.remove('hidden');

    function closeModal() {
        revokeBlobUrl(data.videoUrl); // service/blob-url.js
        revokeBlobUrl(data.posterUrl); // service/blob-url.js
        overlayEl.remove();
    }

    // --- addEventListener: gom cuối hàm, callback CHỈ eventBus.send() (Rule 5a) ---
    videoEl.addEventListener('loadedmetadata', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.metadata.loaded', payload: {} }), { once: true });
    videoEl.addEventListener('timeupdate', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.video.timeUpdate', payload: { currentTime: videoEl.currentTime } }));
    videoEl.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.mediaTap.click', payload: {} }));

    closeBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.close.click', payload: {} }));
    saveBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.save.click', payload: { anchorEl: saveBtn } }));

    cropToggleBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropToggle.click', payload: {} }));
    extractBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.extractFrame.click', payload: {} }));
    undoBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.undo.click', payload: {} }));
    redoBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.redo.click', payload: {} }));
    resetBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.reset.click', payload: {} }));
    rotateLeftBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.rotateLeft.click', payload: {} }));
    rotateRightBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.rotateRight.click', payload: {} }));

    ratioButtons.forEach(({ btn, ratio }) => {
        btn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropRatio.select', payload: { ratio } }));
    });
    ratioFlipBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropRatio.flip.click', payload: {} }));

    startHandleEl.addEventListener('pointerdown', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.trimDrag.start', payload: { handle: 'start' } }));
    endHandleEl.addEventListener('pointerdown', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.trimDrag.start', payload: { handle: 'end' } }));

    cropCanvasEl.addEventListener('pointerdown', (e) => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropCanvas.pointerDown', payload: { clientX: e.clientX, clientY: e.clientY } }));
    cropCanvasEl.addEventListener('pointermove', (e) => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropCanvas.pointerMove', payload: { clientX: e.clientX, clientY: e.clientY } }));
    cropCanvasEl.addEventListener('pointerup', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropCanvas.pointerUp', payload: {} }));
    cropCanvasEl.addEventListener('pointerleave', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropCanvas.pointerUp', payload: {} }));

    return {
        close: closeModal,
        overlayEl, mediaWrapEl, videoEl, posterEl, cropLayerEl, cropCanvasEl, toolsGroupEl, ratioGroupEl, ratioButtons, ratioFlipBtn,
        filmstripTrackEl, filmstripFramesEl, startHandleEl, endHandleEl, dimLeftEl, dimRightEl, rangeBorderEl, playheadEl,
        currentTimeLabelEl, closeBtn, saveBtn, cropToggleBtn, extractBtn, undoBtn, redoBtn, resetBtn,
        rotateLeftBtn, rotateRightBtn,
    };
}
