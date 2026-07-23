/**
 * event/listener/video-editor.js — TẤT CẢ listener của trang `video-editor.html` v3. Trang nhỏ,
 * KHÔNG tách `core/dom-refs.js` riêng — khai `const` tham chiếu DOM NGAY ĐẦU file này.
 *
 * LƯU Ý: các cụm DOM ĐỘNG (clip Video/Nhạc/Chữ trên timeline, nút trong toolbar, dòng trong danh
 * sách chọn nhạc, nội dung Generic Drawer) do CHÍNH `event/workflow/video-editor.js` dựng —
 * addEventListener của các cụm đó nằm NGAY TRONG Workflow lúc dựng, KHÔNG lặp lại ở đây. File này
 * CHỈ gắn listener cho DOM TĨNH có sẵn trong HTML.
 *
 * [23/07/2026] — Thêm ref `generic-drawer-*` (core/generic-drawer.js, TÁI SỬ DỤNG THẬT — Giang yêu
 * cầu cấm dựng modal mới lặp lại) THAY 4 modal viết tay cũ (đã xoá khỏi HTML). Bỏ toàn bộ wiring
 * của 4 modal đó (nay Workflow tự querySelector+wire ngay khi mở, xem
 * event/workflow/video-editor.js::handlePropsOpen()/...). Kéo Text trên preview đổi sang 2 CHIỀU
 * (posX+posY, trước chỉ Y) + THÊM cử chỉ 2 ngón (pinch) co giãn/xoay.
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

// Generic Drawer — TÁI SỬ DỤNG component dùng chung toàn app (core/generic-drawer.js), thay 4
// modal viết tay cũ (Chỉnh/Sửa chữ/Chọn nhạc/Dịch chuyển đoạn). Nội dung header/body do Workflow tự
// gán + wire mỗi lần mở (xem handlePropsOpen()/handleTextEditOpen()/handleAddMusicOpen()/
// handleSongShiftOpen()) — ở đây CHỈ khai ref, không wire gì thêm.
const genericDrawerOverlay = document.getElementById('generic-drawer-overlay');
const genericDrawerPanel = document.getElementById('generic-drawer-panel');
const genericDrawerHeader = document.getElementById('generic-drawer-header');
const genericDrawerBody = document.getElementById('generic-drawer-body');

const videoEditorSourceEl = document.getElementById('video-editor-source');
const videoEditorSongAudioEl = document.getElementById('video-editor-song-audio');

// ===================== Header / Transport =====================
btnBackVideoEditor.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.back.click', payload: {} }));
btnVeSave.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.save.click', payload: { anchorEl: btnVeSave } }));
btnVePlay.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.togglePlay.click', payload: {} }));
btnVeSkipStart.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.skipStart.click', payload: {} }));
btnVeSkipEnd.addEventListener('click', () => eventBus.send({ router: 'videoEdit', type: 'videoEdit.skipEnd.click', payload: {} }));

// ===================== Kéo/Pinch Text trực tiếp trên preview (canvas) =====================
// 1 ngón = di chuyển (posX/posY), 2 ngón = co giãn kích cỡ + xoay (pinch). Theo dõi TỐI ĐA 2
// pointer đang nhấn trên canvas — chuyển thẳng từ "1 ngón di chuyển" sang "2 ngón pinch" giữa
// chừng nếu ngón thứ 2 chạm xuống (dừng hẳn drag, bắt đầu pinch); nhấc bớt 1 ngón (còn <2) thì kết
// thúc pinch luôn (không quay lại drag — đơn giản hoá, chạm lại để kéo tiếp).
const _veActivePointers = new Map(); // pointerId -> {x,y}
let _veGestureMode = null; // 'drag' | 'pinch' | null
let _vePinchStartDist = 0;
let _vePinchStartAngle = 0;

function _veCanvasPointFromEvent(e) {
    const rect = videoEditorPreviewCanvasEl.getBoundingClientRect();
    return {
        x: computeCanvasXFromClientX(e.clientX, rect.left, rect.width, videoEditorPreviewCanvasEl.width), // core/video-editor/preview-draw.js
        y: computeCanvasYFromClientY(e.clientY, rect.top, rect.height, videoEditorPreviewCanvasEl.height),
    };
}

videoEditorPreviewCanvasEl.addEventListener('pointerdown', (e) => {
    try { videoEditorPreviewCanvasEl.setPointerCapture(e.pointerId); } catch (err) { /* không sao */ }
    _veActivePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (_veActivePointers.size === 1) {
        _veGestureMode = 'drag';
        const p = _veCanvasPointFromEvent(e);
        eventBus.send({ router: 'videoEdit', type: 'videoEdit.previewTextDrag.start', payload: { canvasX: p.x, canvasY: p.y } });
    } else if (_veActivePointers.size === 2) {
        if (_veGestureMode === 'drag') eventBus.send({ router: 'videoEdit', type: 'videoEdit.previewTextDrag.end', payload: {} }); // dừng drag 1 ngón, chuyển sang pinch
        _veGestureMode = 'pinch';
        const pts = [..._veActivePointers.values()];
        _vePinchStartDist = computeDistanceBetweenPoints(pts[0].x, pts[0].y, pts[1].x, pts[1].y); // core/video-editor/preview-draw.js
        _vePinchStartAngle = computeAngleBetweenPoints(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
        eventBus.send({ router: 'videoEdit', type: 'videoEdit.previewTextPinch.start', payload: {} });
    }
});
videoEditorPreviewCanvasEl.addEventListener('pointermove', (e) => {
    if (!_veActivePointers.has(e.pointerId)) return;
    _veActivePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (_veGestureMode === 'pinch' && _veActivePointers.size === 2) {
        const pts = [..._veActivePointers.values()];
        const currentDist = computeDistanceBetweenPoints(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
        const currentAngle = computeAngleBetweenPoints(pts[0].x, pts[0].y, pts[1].x, pts[1].y);
        eventBus.send({ router: 'videoEdit', type: 'videoEdit.previewTextPinch.move', payload: { startDist: _vePinchStartDist, startAngleDeg: _vePinchStartAngle, currentDist, currentAngleDeg: currentAngle } });
    } else if (_veGestureMode === 'drag' && _veActivePointers.size === 1) {
        const p = _veCanvasPointFromEvent(e);
        eventBus.send({ router: 'videoEdit', type: 'videoEdit.previewTextDrag.move', payload: { canvasX: p.x, canvasY: p.y } });
    }
});
function _veEndPointer(e) {
    try { videoEditorPreviewCanvasEl.releasePointerCapture(e.pointerId); } catch (err) { /* không sao */ }
    _veActivePointers.delete(e.pointerId);
    if (_veGestureMode === 'pinch' && _veActivePointers.size < 2) {
        _veGestureMode = null;
        eventBus.send({ router: 'videoEdit', type: 'videoEdit.previewTextPinch.end', payload: {} });
    } else if (_veGestureMode === 'drag' && _veActivePointers.size < 1) {
        _veGestureMode = null;
        eventBus.send({ router: 'videoEdit', type: 'videoEdit.previewTextDrag.end', payload: {} });
    }
}
videoEditorPreviewCanvasEl.addEventListener('pointerup', _veEndPointer);
videoEditorPreviewCanvasEl.addEventListener('pointercancel', _veEndPointer);

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

workflowVideoEditor.init();
