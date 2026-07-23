/**
 * event/listener/video-editor.js — TẤT CẢ listener của trang `video-editor.html` v3. Trang nhỏ,
 * KHÔNG tách `core/dom-refs.js` riêng — khai `const` tham chiếu DOM NGAY ĐẦU file này.
 *
 * LƯU Ý: các cụm DOM ĐỘNG (clip Video/Nhạc/Chữ trên timeline, nút trong toolbar, dòng trong danh
 * sách chọn nhạc) do CHÍNH `event/workflow/video-editor.js` dựng (`_renderVideoTrack()`,
 * `_renderFreeClipTrack()`, `_renderToolbar()`, `_renderSongList()`) — addEventListener của các cụm
 * đó nằm NGAY TRONG Workflow lúc dựng (Rule 5a: dựng cụm DOM MỚI, callback CHỈ gọi eventBus.send()),
 * KHÔNG lặp lại ở đây. File này CHỈ gắn listener cho DOM TĨNH có sẵn trong HTML.
 *
 * NẠP SAU: DOM tĩnh của video-editor.html đã render, event/bus.js, event/router/video-editor.js,
 * event/workflow/video-editor.js. Tự gọi workflowVideoEditor.init() ngay khi chạy (dòng cuối file).
 */
const videoEditorTitleEl = document.getElementById('video-editor-title');
const btnBackVideoEditor = document.getElementById('btn-back-video-editor');
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
const videoEditorPlayheadTimeEl = document.getElementById('video-editor-playhead-time');
const videoEditorDurationEndMarkerEl = document.getElementById('video-editor-duration-end-marker');
const videoEditorTrackTextEl = document.getElementById('video-editor-track-text');
const videoEditorTrackVideoEl = document.getElementById('video-editor-track-video');
const videoEditorTrackAudioEl = document.getElementById('video-editor-track-audio');

const videoEditorToolbarEl = document.getElementById('video-editor-toolbar');

const videoEditorCropOverlayEl = document.getElementById('video-editor-crop-overlay');
const videoEditorCropSourceEl = document.getElementById('video-editor-crop-source');
const videoEditorCropRatioRowEl = document.getElementById('video-editor-crop-ratio-row');
const btnVideoEditorCropCancel = document.getElementById('btn-video-editor-crop-cancel');
const btnVideoEditorCropConfirm = document.getElementById('btn-video-editor-crop-confirm');

const videoEditorPropsModalEl = document.getElementById('video-editor-props-modal');
const sliderVeVolVideo = document.getElementById('slider-ve-vol-video');
const videoEditorVolVideoValEl = document.getElementById('video-editor-vol-video-val');
const sliderVeBrightness = document.getElementById('slider-ve-brightness');
const videoEditorFilterBrightnessValEl = document.getElementById('video-editor-filter-brightness-val');
const sliderVeContrast = document.getElementById('slider-ve-contrast');
const videoEditorFilterContrastValEl = document.getElementById('video-editor-filter-contrast-val');
const sliderVeSaturation = document.getElementById('slider-ve-saturation');
const videoEditorFilterSaturationValEl = document.getElementById('video-editor-filter-saturation-val');
const btnVideoEditorPropsClose = document.getElementById('btn-video-editor-props-close');

const videoEditorTextEditModalEl = document.getElementById('video-editor-text-edit-modal');
const videoEditorTextValueEl = document.getElementById('video-editor-text-value');
const sliderVeTextSize = document.getElementById('slider-ve-text-size');
const videoEditorTextColorEl = document.getElementById('video-editor-text-color');
const sliderVeTextPosY = document.getElementById('slider-ve-text-posY');
const videoEditorTextPosYDisplayEl = document.getElementById('video-editor-text-posY-display');
const btnVideoEditorTextEditClose = document.getElementById('btn-video-editor-text-edit-close');

const videoEditorSongPickerModalEl = document.getElementById('video-editor-song-picker-modal');
const btnVideoEditorSongPickerClose = document.getElementById('btn-video-editor-song-picker-close');
const videoEditorSongSearchInputEl = document.getElementById('video-editor-song-search-input');
const btnVeSongSearchClear = document.getElementById('btn-ve-song-search-clear');
const videoEditorSongListEl = document.getElementById('video-editor-song-list');

const videoEditorSongShiftModalEl = document.getElementById('video-editor-song-shift-modal');
const videoEditorSongShiftTimeLabelEl = document.getElementById('video-editor-song-shift-time-label');
const videoEditorSongShiftBarWrapEl = document.getElementById('video-editor-song-shift-bar-wrap');
const videoEditorSongShiftWindowEl = document.getElementById('video-editor-song-shift-window');
const sliderVeClipVolume = document.getElementById('slider-ve-clip-volume');
const videoEditorClipVolumeValEl = document.getElementById('video-editor-clip-volume-val');
const btnVideoEditorSongShiftConfirm = document.getElementById('btn-video-editor-song-shift-confirm');

const videoEditorSourceEl = document.getElementById('video-editor-source');
const videoEditorSongAudioEl = document.getElementById('video-editor-song-audio');

// ===================== Header / Transport =====================
btnBackVideoEditor.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.back.click', payload: {} }));
btnVeSave.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.save.click', payload: { anchorEl: btnVeSave } }));
btnVePlay.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.togglePlay.click', payload: {} }));
btnVeSkipStart.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.skipStart.click', payload: {} }));
btnVeSkipEnd.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.skipEnd.click', payload: {} }));

// ===================== Kéo Text trực tiếp trên preview (canvas) =====================
let _veTextDragging = false;
function _veCanvasYFromEvent(e) {
    const rect = videoEditorPreviewCanvasEl.getBoundingClientRect();
    const scaleY = videoEditorPreviewCanvasEl.height / rect.height;
    return (e.clientY - rect.top) * scaleY;
}
videoEditorPreviewCanvasEl.addEventListener('pointerdown', (e) => {
    _veTextDragging = true;
    try { videoEditorPreviewCanvasEl.setPointerCapture(e.pointerId); } catch (err) { /* không sao */ }
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.previewTextDrag.start', payload: { canvasY: _veCanvasYFromEvent(e) } });
});
videoEditorPreviewCanvasEl.addEventListener('pointermove', (e) => {
    if (!_veTextDragging) return;
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.previewTextDrag.move', payload: { canvasY: _veCanvasYFromEvent(e) } });
});
videoEditorPreviewCanvasEl.addEventListener('pointerup', (e) => {
    _veTextDragging = false;
    try { videoEditorPreviewCanvasEl.releasePointerCapture(e.pointerId); } catch (err) { /* không sao */ }
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.previewTextDrag.end', payload: {} });
});
videoEditorPreviewCanvasEl.addEventListener('pointercancel', () => { _veTextDragging = false; eventBus.send({ router: 'videoEdit', type: 'videoEdit.previewTextDrag.end', payload: {} }); });

// ===================== Chạm nền timeline (ngoài mọi clip) — bỏ chọn HOẶC tua con trỏ =====================
// PHÂN BIỆT: e.target === chính videoEditorTimelineContentEl (nền trống, không phải 1 clip cụ thể)
// mới xử lý ở đây — chạm vào 1 clip đã có listener RIÊNG của chính clip đó (Workflow dựng động).
let _veScrubbing = false;
videoEditorTimelineContentEl.addEventListener('pointerdown', (e) => {
    if (e.target !== videoEditorTimelineContentEl) return;
    _veScrubbing = true;
    try { videoEditorTimelineContentEl.setPointerCapture(e.pointerId); } catch (err) { /* không sao — vẫn tua qua cờ _veScrubbing */ }
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.scrub.move', payload: { clientX: e.clientX } });
});
videoEditorTimelineContentEl.addEventListener('pointermove', (e) => {
    if (!_veScrubbing) return;
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.scrub.move', payload: { clientX: e.clientX } });
});
videoEditorTimelineContentEl.addEventListener('pointerup', (e) => {
    if (!_veScrubbing) return;
    _veScrubbing = false;
    try { videoEditorTimelineContentEl.releasePointerCapture(e.pointerId); } catch (err) { /* không sao */ }
});
videoEditorTimelineContentEl.addEventListener('pointercancel', () => { _veScrubbing = false; });
videoEditorTimelineContentEl.addEventListener('click', (e) => {
    if (e.target === videoEditorTimelineContentEl) eventBus.send({ router: 'videoEdit', type: 'videoEdit.deselect.click', payload: {} });
});

// Kéo trực tiếp thanh playhead (trước đây `pointer-events-none`, không kéo được) — dùng CHUNG cờ
// _veScrubbing + message 'videoEdit.scrub.move' với chạm nền timeline, cùng 1 hành vi tua.
videoEditorPlayheadEl.addEventListener('pointerdown', (e) => {
    _veScrubbing = true;
    try { videoEditorPlayheadEl.setPointerCapture(e.pointerId); } catch (err) { /* không sao — vẫn tua qua cờ _veScrubbing */ }
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.scrub.move', payload: { clientX: e.clientX } });
});
videoEditorPlayheadEl.addEventListener('pointermove', (e) => {
    if (!_veScrubbing) return;
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.scrub.move', payload: { clientX: e.clientX } });
});
videoEditorPlayheadEl.addEventListener('pointerup', (e) => {
    _veScrubbing = false;
    try { videoEditorPlayheadEl.releasePointerCapture(e.pointerId); } catch (err) { /* không sao */ }
});
videoEditorPlayheadEl.addEventListener('pointercancel', () => { _veScrubbing = false; });

// ===================== Crop overlay (Cropper.js) =====================
btnVideoEditorCropCancel.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.cropCancel.click', payload: {} }));
btnVideoEditorCropConfirm.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.cropConfirm.click', payload: {} }));

// ===================== Modal "Chỉnh" (Filter + Volume gốc) =====================
sliderVeVolVideo.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.volVideo.change', payload: { value: sliderVeVolVideo.value } }));
[sliderVeBrightness, sliderVeContrast, sliderVeSaturation].forEach((slider) => {
    slider.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.filter.change', payload: {} }));
});
sliderVeBrightness.addEventListener('input', () => { videoEditorFilterBrightnessValEl.textContent = `${sliderVeBrightness.value}%`; });
sliderVeContrast.addEventListener('input', () => { videoEditorFilterContrastValEl.textContent = `${sliderVeContrast.value}%`; });
sliderVeSaturation.addEventListener('input', () => { videoEditorFilterSaturationValEl.textContent = `${sliderVeSaturation.value}%`; });
btnVideoEditorPropsClose.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.props.close', payload: {} }));

// ===================== Modal Sửa chữ =====================
videoEditorTextValueEl.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.textValue.input', payload: { value: videoEditorTextValueEl.value } }));
sliderVeTextSize.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.textSize.change', payload: { value: sliderVeTextSize.value } }));
videoEditorTextColorEl.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.textColor.change', payload: { value: videoEditorTextColorEl.value } }));
sliderVeTextPosY.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.textPosY.change', payload: { value: sliderVeTextPosY.value } }));
btnVideoEditorTextEditClose.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.textEdit.close', payload: {} }));

// ===================== Modal chọn Nhạc =====================
btnVideoEditorSongPickerClose.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.songPicker.close', payload: {} }));
videoEditorSongSearchInputEl.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.songSearch.input', payload: { value: videoEditorSongSearchInputEl.value } }));
btnVeSongSearchClear.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.songSearchClear.click', payload: {} }));
// Danh sách bài hát (#video-editor-song-list) dựng ĐỘNG mỗi lần tìm kiếm — listener từng dòng gắn
// ngay trong Workflow lúc dựng DOM (_renderSongList()), đúng Rule 5a.

// ===================== Modal "Dịch chuyển tới đoạn" (kéo chọn đoạn trong bài + âm lượng clip) =====================
// Dùng cờ tự quản lý (KHÔNG dựa hasPointerCapture() — có thể fail âm thầm tuỳ trình duyệt/thiết bị,
// xem docstring _attachDragHandlers() ở event/workflow/video-editor.js, cùng gốc bug với 3 track).
videoEditorSongShiftWindowEl.addEventListener('pointerdown', (e) => {
    videoEditorSongShiftWindowEl._veDragging = true;
    try { videoEditorSongShiftWindowEl.setPointerCapture(e.pointerId); } catch (err) { console.warn('[songShiftDrag] setPointerCapture lỗi (bỏ qua):', err); }
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.songShiftDrag.start', payload: { clientX: e.clientX } });
});
videoEditorSongShiftWindowEl.addEventListener('pointermove', (e) => {
    if (!videoEditorSongShiftWindowEl._veDragging) return;
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.songShiftDrag.move', payload: { clientX: e.clientX } });
});
videoEditorSongShiftWindowEl.addEventListener('pointerup', (e) => {
    videoEditorSongShiftWindowEl._veDragging = false;
    try { videoEditorSongShiftWindowEl.releasePointerCapture(e.pointerId); } catch (err) { /* không sao */ }
    eventBus.send({ router: 'videoEdit', type: 'videoEdit.songShiftDrag.end', payload: {} });
});
videoEditorSongShiftWindowEl.addEventListener('pointercancel', () => { videoEditorSongShiftWindowEl._veDragging = false; eventBus.send({ router: 'videoEdit', type: 'videoEdit.songShiftDrag.end', payload: {} }); });
sliderVeClipVolume.addEventListener('input', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.clipVolume.change', payload: { value: sliderVeClipVolume.value } }));
btnVideoEditorSongShiftConfirm.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.songShift.close', payload: {} }));

workflowVideoEditor.init();
