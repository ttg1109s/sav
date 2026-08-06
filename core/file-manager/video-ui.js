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
 * @param {{videoUrl: string, posterUrl: string, filename: string, ratioPresets: Array<{labelKey: string, ratio: number}>}} data
 * @returns {object} handle — { close, overlayEl, mediaWrapEl, videoEl, posterEl, cropLayerEl,
 *   cropCanvasEl, toolsGroupEl, ratioGroupEl, ratioButtons, ratioFlipBtn, filmstripTrackEl,
 *   filmstripFramesEl, startHandleEl, endHandleEl, dimLeftEl, dimRightEl, rangeBorderEl, playheadEl,
 *   currentTimeLabelEl, saveBtn, closeBtn, cropToggleBtn, extractBtn, resetBtn, flipBtn, rotateBtn }
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
    const resetBtn = fragment.querySelector('#video-preview-reset-btn');
    const flipBtn = fragment.querySelector('#video-preview-flip-btn');
    const rotateBtn = fragment.querySelector('#video-preview-rotate-btn');

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
    resetBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.reset.click', payload: {} }));
    flipBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.flip.click', payload: {} }));
    rotateBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.rotate.click', payload: {} }));

    ratioButtons.forEach(({ btn, ratio }) => {
        btn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropRatio.select', payload: { ratio } }));
    });
    ratioFlipBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.flip.click', payload: {} })); // SỬA (05/08/2026, phản hồi Giang) — TRƯỚC ĐÓ 'videoPreview.cropRatio.flip.click' (chỉ đảo tỉ lệ khung Crop) — Giang chỉ ra "flip" phải lật CẢ ảnh/video, không phải riêng crop — giờ bắn CÙNG event với nút Flip toolbar (videoPreview.flip.click), 2 nút cùng 1 hành động thật, chỉ khác chỗ hiện ra (toolsGroupEl lúc thường / ratioGroupEl lúc đang Crop, 2 nhóm luôn loại trừ nhau)

    startHandleEl.addEventListener('pointerdown', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.trimDrag.start', payload: { handle: 'start' } }));
    endHandleEl.addEventListener('pointerdown', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.trimDrag.start', payload: { handle: 'end' } }));
    // Ấn/kéo bất kỳ đâu trong dải phim (kể cả trúng tay cầm — bubble lên từ 2 listener trên, Workflow
    // tự đọc videoPreviewActiveDrag đã bị chiếm chưa để bỏ qua) — tua tới đó ngay (mục 7, phản hồi Giang).
    filmstripTrackEl.addEventListener('pointerdown', (e) => eventBus.send({ router: 'videoPreview', type: 'videoPreview.trimTrack.pointerDown', payload: { clientX: e.clientX } }));

    // pointermove/pointerup KHÔNG còn ở đây — chuyển sang document (event/listener/video-preview.js,
    // SỬA 05/08/2026, mục "crop không kéo được") — canvas chỉ khớp vùng ảnh thật của video, ngón tay
    // trượt ra khỏi biên canvas giữa chừng sẽ mất dấu nếu chỉ lắng nghe trên chính nó.
    cropCanvasEl.addEventListener('pointerdown', (e) => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropCanvas.pointerDown', payload: { clientX: e.clientX, clientY: e.clientY } }));

    return {
        close: closeModal,
        overlayEl, mediaWrapEl, videoEl, posterEl, cropLayerEl, cropCanvasEl, toolsGroupEl, ratioGroupEl, ratioButtons, ratioFlipBtn,
        filmstripTrackEl, filmstripFramesEl, startHandleEl, endHandleEl, dimLeftEl, dimRightEl, rangeBorderEl, playheadEl,
        currentTimeLabelEl, closeBtn, saveBtn, cropToggleBtn, extractBtn, resetBtn, flipBtn, rotateBtn,
    };
}

/**
 * Mở Generic Drawer "chọn 1 video có sẵn trong thư viện" + wire toàn bộ tương tác của nó.
 *
 * VIẾT BÙ (v13 Batch B) — hàm này TỪNG tồn tại nhưng bị xoá nhầm trong đợt dissolve cụm
 * `fileManagerVideo`, trong khi CẢ HAI nơi gọi vẫn giữ nguyên lời gọi tới nó
 * (`openVideoPickerDrawerUi()` ở bản mồ côi event/workflow/file-manager-video.js — file đó KHÔNG
 * còn được nạp, đã xoá; và `openVideoBgPickerDrawerUi()` ở event/workflow/visualizer-control-
 * center.js — bản đang SỐNG) => picker "Use background video" ném ReferenceError từ đợt đó tới nay.
 * Viết lại ĐÚNG 1 bản DUY NHẤT, nhận `routerName`/`msgPrefix` làm THAM SỐ ngay từ đầu để mọi nơi
 * cần "chọn 1 video" đều dùng chung, KHÔNG đẻ thêm bản sao theo từng miền.
 *
 * Rule 5a — `addEventListener` gom CUỐI hàm, callback CHỈ `eventBus.send()`. Lưới video KHÔNG dựng
 * ở đây (workflowVideoGalleryWindow tự mount vào `#file-manager-video-picker-scroll` sau khi Drawer
 * mở xong) nên click tile phải đi qua DELEGATION trên `genericDrawerBody`.
 * `genericDrawerBody`/`genericDrawerOverlay` là DOM TĨNH DÙNG CHUNG nhiều feature — PHẢI trả về hàm
 * GỠ để Workflow gọi lúc đóng, nếu không sẽ dính sang lần mở Drawer tiếp theo của feature khác
 * (cùng lý do đã ghi ở `wireVisualBgAlbumPickerDrawerActions()`, core/file-manager/photo-ui.js).
 *
 * @param {string} routerName - router đích, vd 'visualBg'.
 * @param {string} msgPrefix - tiền tố msg.type, vd 'visualBg.videoPicker'.
 * @param {string} title - ĐÃ dịch sẵn qua t() (core không biết `lang/`).
 * @param {string} bodyHtml - khung rỗng chứa `#file-manager-video-picker-scroll`.
 * @returns {() => void} hàm GỠ listener delegation.
 */
function openVideoPickerDrawerUi(routerName, msgPrefix, title, bodyHtml) {
    openGenericDrawer({ // core/generic-drawer.js
        zIndex: Z_INDEX.GENERIC_DRAWER,
        headerHtml: `
            <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                <h3 class="text-base font-bold text-slate-900">${title}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `,
        bodyHtml,
        bodyClass: 'flex flex-col',
    });

    const onBodyClick = (e) => {
        const tileEl = e.target.closest('.video-tile');
        if (!tileEl) return; // guard: click vào khoảng trống/tiêu đề ngày, không phải 1 video
        eventBus.send({ router: routerName, type: `${msgPrefix}.tile.click`, payload: { videoKey: tileEl.dataset.videoKey } });
    };
    const onCancel = () => eventBus.send({ router: routerName, type: `${msgPrefix}.close.click`, payload: {} });

    // --- addEventListener: gom cuối hàm (Rule 5a) ---
    const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', onCancel); // header dựng lại mỗi lần mở -> không cần gỡ
    genericDrawerBody.addEventListener('click', onBodyClick);
    genericDrawerOverlay.addEventListener('click', onCancel);

    return () => {
        genericDrawerBody.removeEventListener('click', onBodyClick);
        genericDrawerOverlay.removeEventListener('click', onCancel);
    };
}
