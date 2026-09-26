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
 * `mediaWrapEl` trả về trong handle để Workflow tự đo (`_syncCropCanvasBox()`) rồi đặt CSS
 * `cropCanvasEl` khớp vùng ảnh THẬT của video (công thức `object-contain` chuẩn, KHÔNG còn dựa
 * `videoEl.getBoundingClientRect()` — xem lý do ở event/workflow/video-preview.js). SỬA (05/08/2026,
 * đợt 4) — `#video-preview-crop-layer` giờ nằm BÊN TRONG `#video-preview-media-wrap` trong template
 * (trước là sibling đứng ngoài), layout đổi từ model đè lớp sang 3 vùng flex-col không chồng nhau —
 * xem docstring components/video-preview.js.
 *
 * NẠP SAU: components/video-preview.js, service/component-dynamic.js, service/blob-url.js,
 * service/z-index.js, lang/lang.js.
 */

/**
 * SỬA (26/09/2026, "khung UI kiểu Story Facebook") — bố cục mới 2 trạng thái (`data-tool` trên
 * overlay, xem docstring components/video-preview.js): bỏ `toolsGroupEl`/`ratioGroupEl`/
 * `cropToggleBtn` (Crop không còn là toggle trên toolbar, giờ là 1 CÔNG CỤ mở từ rail), thêm rail
 * dọc (trimToolBtn/cropToolBtn/muteBtn/railExpandBtn + nhãn), topbar công cụ (Huỷ/Xong/tên), và
 * 2 listener 'play'/'pause' của `<video>` (chỉ để Workflow vẽ biểu tượng Play giữa màn hình).
 * @param {{videoUrl: string, posterUrl: string, filename: string, ratioPresets: Array<{labelKey: string, ratio: number}>}} data
 * @returns {object} handle — { close, overlayEl, mediaWrapEl, videoEl, posterEl, cropCanvasEl,
 *   ratioButtons, ratioFlipBtn, filmstripTrackEl, filmstripFramesEl, startHandleEl, endHandleEl,
 *   dimLeftEl, dimRightEl, rangeBorderEl, playheadEl, currentTimeLabelEl, trimLengthLabelEl,
 *   toolTitleEl, railEl, flipBtn, muteBtn, muteLabelEl, saveBtn }
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
        toolCancel: { selector: '#video-preview-tool-cancel-btn', prop: 'textContent', value: t('videoPreview.tool.cancel') },
        toolDone: { selector: '#video-preview-tool-done-btn', prop: 'textContent', value: t('videoPreview.tool.done') },
        trimLabel: { selector: '#video-preview-trim-tool-label', prop: 'textContent', value: t('videoPreview.rail.trim') },
        cropLabel: { selector: '#video-preview-crop-tool-label', prop: 'textContent', value: t('videoPreview.rail.crop') },
        rotateLabel: { selector: '#video-preview-rotate-label', prop: 'textContent', value: t('videoPreview.rail.rotate') },
        flipLabel: { selector: '#video-preview-flip-label', prop: 'textContent', value: t('videoPreview.rail.flip') },
        muteLabel: { selector: '#video-preview-mute-label', prop: 'textContent', value: t('videoPreview.rail.mute') },
        resetLabel: { selector: '#video-preview-reset-label', prop: 'textContent', value: t('videoPreview.rail.reset') },
        ...ratioButtonSlots,
    });

    const overlayEl = fragment.querySelector('#video-preview-overlay');
    overlayEl.style.zIndex = String(Z_INDEX.VIDEO_PREVIEW); // service/z-index.js

    const mediaWrapEl = fragment.querySelector('#video-preview-media-wrap');
    const videoEl = fragment.querySelector('#video-preview-video');
    const posterEl = fragment.querySelector('#video-preview-poster');
    const cropCanvasEl = fragment.querySelector('#video-preview-crop-canvas');
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
    const trimLengthLabelEl = fragment.querySelector('#video-preview-trim-length-label');
    const toolTitleEl = fragment.querySelector('#video-preview-tool-title');
    const toolCancelBtn = fragment.querySelector('#video-preview-tool-cancel-btn');
    const toolDoneBtn = fragment.querySelector('#video-preview-tool-done-btn');
    const railEl = fragment.querySelector('#video-preview-rail');
    const railExpandBtn = fragment.querySelector('#video-preview-rail-expand-btn');
    const trimToolBtn = fragment.querySelector('#video-preview-trim-tool-btn');
    const cropToolBtn = fragment.querySelector('#video-preview-crop-tool-btn');
    const rotateBtn = fragment.querySelector('#video-preview-rotate-btn');
    const flipBtn = fragment.querySelector('#video-preview-flip-btn');
    const muteBtn = fragment.querySelector('#video-preview-mute-btn');
    const muteLabelEl = fragment.querySelector('#video-preview-mute-label');
    const resetBtn = fragment.querySelector('#video-preview-reset-btn');
    const closeBtn = fragment.querySelector('#video-preview-close-btn');
    const saveBtn = fragment.querySelector('#video-preview-save-btn');

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
    videoEl.addEventListener('play', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.video.playState', payload: { playing: true } }));
    videoEl.addEventListener('pause', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.video.playState', payload: { playing: false } }));

    closeBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.close.click', payload: {} }));
    saveBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.save.click', payload: { anchorEl: saveBtn } }));

    // Rail dọc (trạng thái xem)
    railExpandBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.railExpand.click', payload: {} }));
    trimToolBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.tool.open', payload: { tool: 'trim' } }));
    cropToolBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.tool.open', payload: { tool: 'crop' } }));
    rotateBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.rotate.click', payload: {} }));
    flipBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.flip.click', payload: {} }));
    muteBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.mute.click', payload: {} }));
    resetBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.reset.click', payload: {} }));

    // Topbar công cụ (trạng thái Cắt/Cắt khung)
    toolCancelBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.tool.cancel', payload: {} }));
    toolDoneBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.tool.done', payload: {} }));

    ratioButtons.forEach(({ btn, ratio }) => {
        btn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropRatio.select', payload: { ratio } }));
    });
    // Nút Lật trong panel Cắt khung — CÙNG hành động với nút Lật trên rail (lật CẢ nội dung video,
    // phản hồi Giang 05/08/2026), chỉ khác chỗ hiện ra (rail ẩn khi đang Cắt khung).
    ratioFlipBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.flip.click', payload: {} }));

    startHandleEl.addEventListener('pointerdown', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.trimDrag.start', payload: { handle: 'start' } }));
    endHandleEl.addEventListener('pointerdown', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.trimDrag.start', payload: { handle: 'end' } }));
    // Ấn/kéo bất kỳ đâu trong dải phim (kể cả trúng tay cầm — bubble lên từ 2 listener trên, Workflow
    // tự đọc videoPreviewActiveDrag đã bị chiếm chưa để bỏ qua) — tua tới đó ngay (mục 7, phản hồi Giang).
    filmstripTrackEl.addEventListener('pointerdown', (e) => eventBus.send({ router: 'videoPreview', type: 'videoPreview.trimTrack.pointerDown', payload: { clientX: e.clientX } }));

    // pointermove/pointerup theo dõi trên document (event/listener/video-preview.js) — ngón tay trượt
    // ra khỏi biên canvas/dải phim giữa chừng vẫn không mất dấu.
    cropCanvasEl.addEventListener('pointerdown', (e) => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropCanvas.pointerDown', payload: { clientX: e.clientX, clientY: e.clientY } }));

    return {
        close: closeModal,
        overlayEl, mediaWrapEl, videoEl, posterEl, cropCanvasEl, ratioButtons, ratioFlipBtn,
        filmstripTrackEl, filmstripFramesEl, startHandleEl, endHandleEl, dimLeftEl, dimRightEl, rangeBorderEl, playheadEl,
        currentTimeLabelEl, trimLengthLabelEl, toolTitleEl, railEl, flipBtn, muteBtn, muteLabelEl, saveBtn,
    };
}

// (v13) — KHÔNG có hàm mở picker video ở file này. Picker "chọn 1 video" dùng CHUNG khung Generic
// Drawer của picker ảnh: `openMediaPickerDrawerUi(routerName, msgPrefix, title, bodyHtml,
// tileSelector, tileDataKey, showConfirmButton)` (core/media-picker-drawer-ui.js) — cùng
// header, cùng closeBtn, cùng delegated click, chỉ khác selector tile.
