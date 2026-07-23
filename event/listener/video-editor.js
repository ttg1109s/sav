/**
 * event/listener/video-editor.js — TẤT CẢ listener của trang `video-editor.html` v2. Trang nhỏ,
 * KHÔNG tách `core/dom-refs.js` riêng — khai `const` tham chiếu DOM NGAY ĐẦU file này.
 *
 * NẠP SAU: DOM tĩnh của video-editor.html đã render, event/bus.js, event/router/video-editor.js,
 * event/workflow/video-editor.js. Tự gọi workflowVideoEditor.init() ngay khi chạy (dòng cuối file).
 */
const videoEditorTitleEl = document.getElementById('video-editor-title');
const btnBackVideoEditor = document.getElementById('btn-back-video-editor');
const btnVeSplit = document.getElementById('btn-ve-split');
const btnVeSave = document.getElementById('btn-ve-save');

const videoEditorPreviewCanvasEl = document.getElementById('video-editor-preview-canvas');
const videoEditorEmptyStateEl = document.getElementById('video-editor-empty-state');
const videoEditorFatalErrorEl = document.getElementById('video-editor-fatal-error');

const videoEditorCurrentTimeEl = document.getElementById('video-editor-current-time');
const videoEditorTotalTimeEl = document.getElementById('video-editor-total-time');
const btnVeSkipStart = document.getElementById('btn-ve-skip-start');
const btnVePlay = document.getElementById('btn-ve-play');
const videoEditorPlayIconEl = document.getElementById('video-editor-play-icon');
const btnVeSkipEnd = document.getElementById('btn-ve-skip-end');

const videoEditorTimelineContainerEl = document.getElementById('video-editor-timeline-container');
const videoEditorTimelineContentEl = document.getElementById('video-editor-timeline-content');
const videoEditorPlayheadEl = document.getElementById('video-editor-playhead');
const videoEditorClipTextEl = document.getElementById('video-editor-clip-text');
const videoEditorClipTextLabelEl = document.getElementById('video-editor-clip-text-label');
const videoEditorClipVideoEl = document.getElementById('video-editor-clip-video');
const videoEditorClipVideoFilmstripEl = document.getElementById('video-editor-clip-video-filmstrip');
const videoEditorClipAudioEl = document.getElementById('video-editor-clip-audio');
const videoEditorClipAudioLabelEl = document.getElementById('video-editor-clip-audio-label');

const videoEditorToolPanelEl = document.getElementById('video-editor-tool-panel');
const videoEditorPanelTitleEl = document.getElementById('video-editor-panel-title');
const btnVePanelClose = document.getElementById('btn-ve-panel-close');
const videoEditorToolTabs = document.querySelectorAll('.video-editor-tool-tab');
const videoEditorPanelContents = document.querySelectorAll('.video-editor-panel-content');

const btnVeCrop = document.getElementById('btn-ve-crop');
const videoEditorCropBadgeEl = document.getElementById('video-editor-crop-badge');
const btnVeCropReset = document.getElementById('btn-ve-crop-reset');
const btnVeRotateLeft = document.getElementById('btn-ve-rotate-left');
const btnVeRotateRight = document.getElementById('btn-ve-rotate-right');
const btnVeReset = document.getElementById('btn-ve-reset');
const videoEditorCropOverlayEl = document.getElementById('video-editor-crop-overlay');
const videoEditorCropSourceEl = document.getElementById('video-editor-crop-source');
const btnVideoEditorCropCancel = document.getElementById('btn-video-editor-crop-cancel');
const btnVideoEditorCropConfirm = document.getElementById('btn-video-editor-crop-confirm');

const videoEditorSongSearchInputEl = document.getElementById('video-editor-song-search-input');
const btnVeSongSearchClear = document.getElementById('btn-ve-song-search-clear');
const videoEditorSongListEl = document.getElementById('video-editor-song-list');
const btnVeRemoveSong = document.getElementById('btn-ve-remove-song');

const btnVeAddText = document.getElementById('btn-ve-add-text');
const videoEditorTextControlsEl = document.getElementById('video-editor-text-controls');
const videoEditorTextValueEl = document.getElementById('video-editor-text-value');
const sliderVeTextSize = document.getElementById('slider-ve-text-size');
const videoEditorTextColorEl = document.getElementById('video-editor-text-color');
const sliderVeTextPosY = document.getElementById('slider-ve-text-posY');
const videoEditorTextPosYDisplayEl = document.getElementById('video-editor-text-posY-display');
const btnVeRemoveText = document.getElementById('btn-ve-remove-text');

const sliderVeVolVideo = document.getElementById('slider-ve-vol-video');
const videoEditorVolVideoValEl = document.getElementById('video-editor-vol-video-val');
const videoEditorVolSongGroupEl = document.getElementById('video-editor-vol-song-group');
const sliderVeVolSong = document.getElementById('slider-ve-vol-song');
const videoEditorVolSongValEl = document.getElementById('video-editor-vol-song-val');
const sliderVeBrightness = document.getElementById('slider-ve-brightness');
const videoEditorFilterBrightnessValEl = document.getElementById('video-editor-filter-brightness-val');
const sliderVeContrast = document.getElementById('slider-ve-contrast');
const videoEditorFilterContrastValEl = document.getElementById('video-editor-filter-contrast-val');
const sliderVeSaturation = document.getElementById('slider-ve-saturation');
const videoEditorFilterSaturationValEl = document.getElementById('video-editor-filter-saturation-val');
const btnVeExtractFrame = document.getElementById('btn-ve-extract-frame');

const videoEditorSplitModalEl = document.getElementById('video-editor-split-modal');
const videoEditorSplitSetupBoxEl = document.getElementById('video-editor-split-setup-box');
const videoEditorSplitInputLabelEl = document.getElementById('video-editor-split-input-label');
const videoEditorSplitSecondsInputEl = document.getElementById('video-editor-split-seconds-input');
const btnVideoEditorSplitStart = document.getElementById('btn-video-editor-split-start');
const btnVideoEditorSplitCancel = document.getElementById('btn-video-editor-split-cancel');
const videoEditorSplitProgressBoxEl = document.getElementById('video-editor-split-progress-box');
const videoEditorSplitProgressTextEl = document.getElementById('video-editor-split-progress-text');

const videoEditorSourceEl = document.getElementById('video-editor-source');
const videoEditorSongAudioEl = document.getElementById('video-editor-song-audio');

// ===================== Header / Transport =====================
btnBackVideoEditor.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.back.click', payload: {} }));
btnVeSplit.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.split.click', payload: {} }));
btnVeSave.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.save.click', payload: { anchorEl: btnVeSave } }));
btnVePlay.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.togglePlay.click', payload: {} }));
btnVeSkipStart.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.skipStart.click', payload: {} }));
btnVeSkipEnd.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.skipEnd.click', payload: {} }));

// ===================== Bottom-sheet panel (tab) =====================
videoEditorToolTabs.forEach((tabEl) => {
    tabEl.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.tab.click', payload: { targetId: tabEl.dataset.target } }));
});
btnVePanelClose.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.panelClose.click', payload: {} }));

// ===================== Timeline — kéo-thả (Pointer Events, cùng quy ước Cut cũ) =====================
// setPointerCapture để pointermove/pointerup vẫn nhận được dù ngón tay/chuột di chuyển RA NGOÀI
// phạm vi tay cầm trong lúc kéo — không cần lắng nghe trên `document`.
[
    { el: videoEditorClipVideoEl.querySelector('[data-handle="videoStart"]'), handle: 'videoStart' },
    { el: videoEditorClipVideoEl.querySelector('[data-handle="videoEnd"]'), handle: 'videoEnd' },
    { el: videoEditorClipTextEl.querySelector('[data-handle="textStart"]'), handle: 'textStart' },
    { el: videoEditorClipTextEl.querySelector('[data-handle="textMove"]'), handle: 'textMove' },
    { el: videoEditorClipTextEl.querySelector('[data-handle="textEnd"]'), handle: 'textEnd' },
    { el: videoEditorClipAudioEl.querySelector('[data-handle="audioOffsetDrag"]'), handle: 'audioOffsetDrag' },
].forEach(({ el, handle }) => {
    el.addEventListener('pointerdown', (e) => {
        el.setPointerCapture(e.pointerId);
        eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.start', payload: { handle, clientX: e.clientX } });
    });
    el.addEventListener('pointermove', (e) => {
        if (!el.hasPointerCapture(e.pointerId)) return;
        eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.move', payload: { clientX: e.clientX } });
    });
    el.addEventListener('pointerup', (e) => {
        el.releasePointerCapture(e.pointerId);
        eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.end', payload: {} });
    });
    el.addEventListener('pointercancel', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.timelineDrag.end', payload: {} }));
});

// ===================== Crop / Rotate / Filter / Reset =====================
btnVeCrop.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.crop.click', payload: {} }));
btnVeCropReset.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.cropReset.click', payload: {} }));
btnVideoEditorCropCancel.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.cropCancel.click', payload: {} }));
btnVideoEditorCropConfirm.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.cropConfirm.click', payload: {} }));
btnVeRotateLeft.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.rotateLeft.click', payload: {} }));
btnVeRotateRight.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.rotateRight.click', payload: {} }));
btnVeReset.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.reset.click', payload: {} }));
btnVeExtractFrame.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.extractFrame.click', payload: {} }));

[sliderVeBrightness, sliderVeContrast, sliderVeSaturation].forEach((slider) => {
    slider.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.filter.change', payload: {} }));
});
sliderVeBrightness.addEventListener('input', () => { videoEditorFilterBrightnessValEl.textContent = `${sliderVeBrightness.value}%`; });
sliderVeContrast.addEventListener('input', () => { videoEditorFilterContrastValEl.textContent = `${sliderVeContrast.value}%`; });
sliderVeSaturation.addEventListener('input', () => { videoEditorFilterSaturationValEl.textContent = `${sliderVeSaturation.value}%`; });

// ===================== Volume =====================
sliderVeVolVideo.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.volVideo.change', payload: { value: sliderVeVolVideo.value } }));
sliderVeVolSong.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.volSong.change', payload: { value: sliderVeVolSong.value } }));

// ===================== Nhạc chèn =====================
videoEditorSongSearchInputEl.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.songSearch.input', payload: { value: videoEditorSongSearchInputEl.value } }));
btnVeSongSearchClear.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.songSearchClear.click', payload: {} }));
btnVeRemoveSong.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.removeSong.click', payload: {} }));
// Danh sách bài hát (#video-editor-song-list) dựng ĐỘNG mỗi lần tìm kiếm — listener của từng dòng
// gắn ngay trong Workflow lúc dựng DOM (_renderSongList()), đúng Rule 5a (dựng cụm DOM MỚI).

// ===================== Text overlay =====================
btnVeAddText.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.addText.click', payload: {} }));
btnVeRemoveText.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.removeText.click', payload: {} }));
videoEditorTextValueEl.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.textValue.input', payload: { value: videoEditorTextValueEl.value } }));
sliderVeTextSize.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.textSize.change', payload: { value: sliderVeTextSize.value } }));
videoEditorTextColorEl.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.textColor.change', payload: { value: videoEditorTextColorEl.value } }));
sliderVeTextPosY.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.textPosY.change', payload: { value: sliderVeTextPosY.value } }));

// ===================== Split (Batch 4) =====================
btnVideoEditorSplitCancel.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.splitCancel.click', payload: {} }));
btnVideoEditorSplitStart.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.splitStart.click', payload: {} }));

workflowVideoEditor.init();
