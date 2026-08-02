/**
 * core/file-manager/video-ui.js — MỚI (21/07/2026), File Manager -> Video.
 *
 * XOÁ (ver12 "Song/Video Unification", Batch 5, mục 6c, 27/07/2026) — `openVideoPreviewModal()`
 * (modal xem video full-screen cũ, ĐÃ CHẾT từ 21/07/2026 — bị thay bằng dropdown
 * `openVideoTileActionMenu()`) XOÁ HẲN, thay bằng `openVideoInfoModal()` (tab "Chi tiết" riêng).
 *
 * XOÁ TIẾP (phản hồi Giang 28/07/2026) — `openVideoInfoModal()` CŨNG xoá hẳn, KHÔNG viết lại: phát
 * hiện modal Details/Edit/Cover CÓ SẴN của Playlist (`core/playlist/actions.js::
 * openSongEditModal()`) đã tự mở được cho CẢ Video (Batch 1, Adapter khiến playlistCache của Video
 * dùng chung shape với Song) — chỉ là CHƯA video-aware. Sửa thẳng hàm đó video-aware (tab "Chi
 * tiết" đổi thành thông số kỹ thuật, tab "Sửa" chỉ còn 1 ô customName, tab "Ảnh bìa" ẩn hẳn) THAY
 * VÌ giữ 2 hệ thống "Chi tiết" song song (1 ở Playlist, 1 ở File Manager) — tránh lệch dữ liệu
 * (Play Count/Listened chỉ hoạt động đúng ở modal của Playlist). Lựa chọn "Chi tiết" trong dropdown
 * tile File Manager → Video (`openVideoTileActionMenu()`, event/workflow/file-manager-video.js)
 * cũng đã bỏ theo — panel File Manager → Video này SẼ BỊ XOÁ HẲN ở 6d (chờ Batch 6 "Upload theo
 * Nguồn tại Playlist"), không đáng xây/giữ 1 đường dùng tạm.
 *
 * VIẾT LẠI ("Song/Video Unification" v12, Giang yêu cầu "loại bỏ hoàn toàn edit video, chỉ giữ
 * lại một số core cụ thể") — `openVideoPreviewModal(video)` HỒI SINH đúng tên hàm/vị trí file ghi
 * ở docstring trên, nhưng KHÁC HẲN bản cũ (chỉ xem full-screen, không sửa gì) — bản MỚI này đúng
 * khuôn `core/file-manager/photo-ui.js::openImagePreviewModal()` (modal xem Ảnh) CỘNG THÊM, thay
 * hẳn Video Editor NLE (`video-editor.html`, ĐÃ XOÁ) đa track/đa đoạn:
 *   a. Dải phim (filmstrip, core/video-editor/filmstrip.js) + 2 tay cầm Start/End kéo chọn 1 đoạn
 *      cắt DUY NHẤT (KHÔNG còn nhiều đoạn nối tiếp như NLE cũ).
 *   b. Dải tỉ lệ Crop (core/crop-selector.js, TÁI DÙNG NGUYÊN — đã dùng chung Photo Edit) MỞ SẴN
 *      liên tục ngay trên preview — KHÔNG có bước "Xác nhận"/overlay riêng như bản cũ, kéo tới đâu
 *      là vùng crop hiện tại tới đó (`session.rect` là nguồn thật duy nhất, quy đổi tỉ lệ 0-1 CHỈ
 *      lúc Lưu — xem event/workflow/video-preview.js).
 *   c. Thanh kéo "current" (native `<input type="range">`) xem khung hình tại 1 thời điểm bất kỳ.
 *   d. Nút trích xuất ảnh (core/video-editor/frame-extract.js — TÁI DÙNG NGUYÊN).
 *   e. Nút Lưu mở dropdown (core/dropdown-menu.js — TÁI DÙNG NGUYÊN) Lưu đè/Lưu mới.
 * Rule 5a — mọi addEventListener wire ĐÚNG 1 LẦN, gom cuối hàm, callback CHỈ eventBus.send() (trừ
 * `videoEl` 'loadedmetadata' — thuần trình bày, không phải quyết định nghiệp vụ theo tương tác
 * người dùng, cùng ngoại lệ `img` 'load' ở openImagePreviewModal()). Router `videoPreview` đọc lại
 * `appState.get('videoPreviewActiveDrag')` để phân phối 2 luồng pointermove TĨNH (kéo tay cầm
 * Start/End VÀ kéo góc/tâm khung crop) — 2 luồng đó wire ở event/listener/video-preview.js (DOM
 * TĨNH thật sự — `document`, không tự mất theo modal), KHÔNG lặp lại ở đây.
 */

/** Icon SVG dùng cho toolbar modal xem Video (Core, path THUẦN — không đọc appState/gọi core khác,
 * Rule 3/5 không áp dụng cho hằng số tĩnh này). */
const VIDEO_PREVIEW_ICONS = {
    close: 'M6 18L18 6M6 6l12 12',
    rotateLeft: 'M9 15L3 9m0 0l6-6M3 9h11a6 6 0 010 12h-2',
    rotateRight: 'M15 15l6-6m0 0l-6-6m6 6H10a6 6 0 000 12h2',
    reset: 'M4 4v5h.6M20 20v-5h-.6M19.4 9A8 8 0 006 6.6M4.6 15a8 8 0 0013.4 2.4',
    extractFrame: 'M4 7h3l1.5-2h7L17 7h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1zM12 17a4 4 0 100-8 4 4 0 000 8z',
    flip: 'M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4',
    overwrite: 'M4 7h16M9 7V4h6v3m-7 0v13a1 1 0 001 1h8a1 1 0 001-1V7H7z',
    saveAsNew: 'M8 16V5a1 1 0 011-1h9a1 1 0 011 1v9a1 1 0 01-1 1H9M8 16H5a1 1 0 01-1-1V6a1 1 0 011-1h3m0 11v3a1 1 0 001 1h9a1 1 0 001-1v-9a1 1 0 00-1-1h-3',
};

function _videoPreviewIcon(name, extraClass) {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="${extraClass || 'h-5 w-5'}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${VIDEO_PREVIEW_ICONS[name] || ''}"/></svg>`;
}

/** Preset tỉ lệ khung Crop (mục 2b — 1:1/9:19/2:3/3:4/Tự do + nút đổi hướng ngang-dọc). Đúng khuôn
 * `_renderCropRatioButtons()` (event/workflow/video-editor.js cũ, đã xoá) nhưng dựng 1 LẦN (không
 * cần dựng lại mỗi lần đổi lựa chọn — chỉ cần toggle `.is-active`, workflow tự làm sau khi đọc
 * `session.aspectRatio`).
 * @param {(ratio:number)=>void} onSelect @param {()=>void} onFlip
 * @returns {{rowEl: HTMLElement, buttons: Array<{btn:HTMLElement, ratio:number}>}}
 */
function _buildVideoPreviewRatioRow(onSelect, onFlip) {
    const rowEl = document.createElement('div');
    rowEl.className = 'relative z-10 flex items-center gap-2 px-3 py-2 overflow-x-auto shrink-0 bg-black/60';
    const presets = [
        { label: t('videoPreview.ratio.free'), ratio: NaN },
        { label: '1:1', ratio: 1 },
        { label: '9:19', ratio: 9 / 19 },
        { label: '2:3', ratio: 2 / 3 },
        { label: '3:4', ratio: 3 / 4 },
    ];
    const buttons = presets.map(({ label, ratio }) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'video-preview-ratio-btn';
        btn.textContent = label;
        btn.addEventListener('click', () => onSelect(ratio));
        rowEl.appendChild(btn);
        return { btn, ratio };
    });
    const flipBtn = document.createElement('button');
    flipBtn.type = 'button';
    flipBtn.className = 'video-preview-ratio-btn shrink-0 w-8 h-8 flex items-center justify-center p-0';
    flipBtn.title = t('videoPreview.ratio.flip.title');
    flipBtn.innerHTML = _videoPreviewIcon('flip', 'h-4 w-4');
    flipBtn.addEventListener('click', onFlip);
    rowEl.appendChild(flipBtn);
    return { rowEl, buttons };
}

/**
 * Modal xem/sửa 1 video — full-screen, đúng khuôn `openImagePreviewModal()` (core/file-manager/
 * photo-ui.js) CỘNG dải phim Cắt + dải tỉ lệ Crop + thanh kéo current + toolbar Xoay/Reset/Trích
 * xuất ảnh + nút Lưu. Chỉ DỰNG DOM + wire eventBus — KHÔNG tự tính toán vị trí tay cầm/vẽ overlay
 * crop ban đầu (Workflow tự làm NGAY sau khi hàm này trả về handle, cần đợi `loadedmetadata` để
 * biết kích thước thật của video trước).
 * @param {{key:string, blob:Blob, filename:string}} video
 * @returns {object} handle — { close, videoEl, cropCanvasEl, ratioButtons, flipRatio, filmstripTrackEl,
 *   startHandleEl, endHandleEl, dimLeftEl, dimRightEl, rangeBorderEl, scrubInputEl, saveBtn, titleEl,
 *   emptyStateEl, currentTimeLabelEl }
 */
function openVideoPreviewModal(video) {
    const stale = document.getElementById('video-preview-overlay');
    if (stale) stale.remove();

    const objectUrl = URL.createObjectURL(video.blob);

    const overlay = document.createElement('div');
    overlay.id = 'video-preview-overlay';
    overlay.className = 'fixed inset-0 bg-black overflow-hidden flex flex-col';
    overlay.style.zIndex = String(Z_INDEX.VIDEO_PREVIEW); // service/z-index.js

    function closeModal() {
        try { URL.revokeObjectURL(objectUrl); } catch (e) {}
        overlay.remove();
    }

    // ---- Header: X đóng (trái) + tên file (giữa) + Lưu (phải) ----
    const header = document.createElement('div');
    header.className = 'photo-preview-scrim-top flex justify-between items-center px-4 pt-4 pb-3 gap-2 relative z-10 shrink-0';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0';
    closeBtn.innerHTML = _videoPreviewIcon('close');
    const titleEl = document.createElement('span');
    titleEl.className = 'text-white text-xs font-semibold truncate px-2 flex-1 text-center';
    titleEl.textContent = video.filename || '';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'px-4 py-1.5 bg-white text-black rounded-full text-xs font-bold shadow active:scale-95 transition shrink-0';
    saveBtn.textContent = t('videoPreview.btnSave.title');
    header.append(closeBtn, titleEl, saveBtn);
    overlay.appendChild(header);

    // ---- Dải tỉ lệ Crop — MỞ SẴN liên tục (mục 2b) ----
    const { rowEl: ratioRowEl, buttons: ratioButtons } = _buildVideoPreviewRatioRow(
        (ratio) => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropRatio.select', payload: { ratio } }),
        () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropRatio.flip', payload: {} }),
    );
    overlay.appendChild(ratioRowEl);

    // ---- Preview: <video> + canvas overlay khung Crop (Rule 5 không áp dụng cho canvas — bộ đệm
    // tương tác, không phải nội dung tĩnh) ----
    const previewWrap = document.createElement('div');
    previewWrap.className = 'relative flex-1 min-h-0 flex items-center justify-center bg-black overflow-hidden';
    const videoEl = document.createElement('video');
    // SỬA — KHÔNG dùng class `.video-preview-player` (assets/css/style.css, `position:absolute;
    // inset:0;width:100%;height:100%;object-fit:contain` — phủ KÍN khung, để trình duyệt tự
    // letterbox bên trong) — nếu dùng, hộp CSS của `videoEl` sẽ LUÔN bằng đúng kích thước
    // `previewWrap` (không co theo tỉ lệ khung hình thật), trong khi `cropCanvasEl` (bên dưới) co
    // theo kích thước THẬT (thuộc tính width/height = nativeW/H) qua `max-w-full max-h-full` — 2
    // hộp lệch nhau nếu tỉ lệ khung hình khác tỉ lệ `previewWrap`, khiến khung Crop vẽ SAI vị trí
    // so với video thật thấy trên màn. SỬA: `videoEl` dùng CHUNG đúng 1 chiến lược co kích thước
    // với `cropCanvasEl` (`max-w-full max-h-full`, co theo kích thước THẬT của `<video>` — trình
    // duyệt tự tính như `<img>`) — đúng khuôn 2 canvas (source+interact) của crop overlay cũ
    // (video-editor.html, ĐÃ XOÁ) — 2 hộp LUÔN khớp nhau tuyệt đối.
    videoEl.className = 'absolute max-w-full max-h-full';
    videoEl.src = objectUrl;
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.preload = 'auto';
    const cropCanvasEl = document.createElement('canvas');
    cropCanvasEl.className = 'absolute max-w-full max-h-full touch-none';
    const emptyStateEl = document.createElement('p');
    emptyStateEl.className = 'hidden absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-slate-400 text-center px-8';
    previewWrap.append(videoEl, cropCanvasEl, emptyStateEl);
    overlay.appendChild(previewWrap);

    // ---- Thanh kéo "current" (mục 2c) ----
    const scrubWrap = document.createElement('div');
    scrubWrap.className = 'relative z-10 px-4 pt-3 pb-1 shrink-0 bg-black flex items-center gap-3';
    const currentTimeLabelEl = document.createElement('span');
    currentTimeLabelEl.className = 'text-[11px] font-mono text-slate-400 w-10 shrink-0';
    currentTimeLabelEl.textContent = '00:00';
    const scrubInputEl = document.createElement('input');
    scrubInputEl.type = 'range';
    scrubInputEl.min = '0'; scrubInputEl.max = '0'; scrubInputEl.step = '0.01'; scrubInputEl.value = '0';
    scrubInputEl.className = 'w-full';
    scrubWrap.append(currentTimeLabelEl, scrubInputEl);
    overlay.appendChild(scrubWrap);

    // ---- Dải phim (filmstrip) + 2 tay cầm Start/End (mục 2a) — chiều rộng track + padding ngang
    // (px-4 của filmstripWrap) = chiều rộng màn hình, đúng yêu cầu Giang. ----
    const filmstripWrap = document.createElement('div');
    filmstripWrap.className = 'relative z-10 px-4 pt-3 pb-2 shrink-0 bg-black';
    const filmstripTrackEl = document.createElement('div');
    filmstripTrackEl.className = 'video-preview-filmstrip-track';
    const dimLeftEl = document.createElement('div');
    dimLeftEl.className = 'video-preview-filmstrip-dim';
    dimLeftEl.style.left = '0';
    const dimRightEl = document.createElement('div');
    dimRightEl.className = 'video-preview-filmstrip-dim';
    dimRightEl.style.right = '0';
    const rangeBorderEl = document.createElement('div');
    rangeBorderEl.className = 'video-preview-filmstrip-range-border';
    const startHandleEl = document.createElement('div');
    startHandleEl.className = 'video-preview-trim-handle';
    startHandleEl.style.touchAction = 'none';
    const endHandleEl = document.createElement('div');
    endHandleEl.className = 'video-preview-trim-handle';
    endHandleEl.style.touchAction = 'none';
    filmstripTrackEl.append(dimLeftEl, dimRightEl, rangeBorderEl, startHandleEl, endHandleEl);
    filmstripWrap.appendChild(filmstripTrackEl);
    overlay.appendChild(filmstripWrap);

    // ---- Toolbar dưới cùng: Xoay trái/phải, Reset, Trích xuất ảnh (mục 2d) ----
    const toolbar = document.createElement('div');
    toolbar.className = 'relative z-10 flex items-center justify-center gap-6 px-4 py-3 shrink-0 bg-black border-t border-white/10';
    function _mkToolBtn(iconName, title) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:scale-90 transition text-white';
        b.title = title;
        b.innerHTML = _videoPreviewIcon(iconName);
        return b;
    }
    const rotateLeftBtn = _mkToolBtn('rotateLeft', t('videoPreview.btnRotateLeft.title'));
    const rotateRightBtn = _mkToolBtn('rotateRight', t('videoPreview.btnRotateRight.title'));
    const resetBtn = _mkToolBtn('reset', t('videoPreview.btnReset.title'));
    const extractBtn = _mkToolBtn('extractFrame', t('videoPreview.btnExtractFrame.title'));
    toolbar.append(rotateLeftBtn, rotateRightBtn, resetBtn, extractBtn);
    overlay.appendChild(toolbar);

    document.body.appendChild(overlay);

    // --- addEventListener: gom cuối hàm, sau khi cây DOM đã dựng xong hoàn toàn (Rule 5a) ---
    videoEl.addEventListener('loadedmetadata', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.metadata.loaded', payload: {} }), { once: true });
    closeBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.close.click', payload: {} }));
    saveBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.save.click', payload: { anchorEl: saveBtn } }));
    scrubInputEl.addEventListener('input', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.scrub.input', payload: { value: parseFloat(scrubInputEl.value) || 0 } }));
    rotateLeftBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.rotateLeft.click', payload: {} }));
    rotateRightBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.rotateRight.click', payload: {} }));
    resetBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.reset.click', payload: {} }));
    extractBtn.addEventListener('click', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.extractFrame.click', payload: {} }));

    startHandleEl.addEventListener('pointerdown', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.trimDrag.start', payload: { handle: 'start' } }));
    endHandleEl.addEventListener('pointerdown', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.trimDrag.start', payload: { handle: 'end' } }));

    function _cropCanvasPos(clientX, clientY) {
        const rect = cropCanvasEl.getBoundingClientRect();
        const scale = cropCanvasEl.width / (rect.width || cropCanvasEl.width || 1);
        return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale };
    }
    cropCanvasEl.addEventListener('pointerdown', (e) => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropCanvas.pointerDown', payload: _cropCanvasPos(e.clientX, e.clientY) }));
    cropCanvasEl.addEventListener('pointermove', (e) => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropCanvas.pointerMove', payload: _cropCanvasPos(e.clientX, e.clientY) }));
    cropCanvasEl.addEventListener('pointerup', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropCanvas.pointerUp', payload: {} }));
    cropCanvasEl.addEventListener('pointerleave', () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropCanvas.pointerUp', payload: {} }));

    return {
        close: closeModal,
        videoEl, cropCanvasEl, ratioButtons,
        filmstripTrackEl, startHandleEl, endHandleEl, dimLeftEl, dimRightEl, rangeBorderEl,
        scrubInputEl, currentTimeLabelEl, saveBtn, titleEl, emptyStateEl,
    };
}

/** MỚI (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow" — rà rộng
 * ra ngoài Photo/Edit) — TÁCH RA từ event/workflow/file-manager-video.js::openVideoBgPicker(),
 * cùng khuôn `openPhotoImagePickerDrawerUi()` (core/file-manager/photo-ui.js) — dựng headerHtml +
 * gọi `openGenericDrawer()` + wire NGAY closeBtn/delegated click tile, TẤT CẢ Ở ĐÂY (Rule 5a — DOM
 * động, callback CHỈ `eventBus.send()`, gom cuối hàm). `bodyHtml` nhận SẴN từ Workflow (Rule 2).
 *
 * ĐỔI TÊN + đổi router (phản hồi Giang — dẹp file-manager-video.js) — `openVideoPickerDrawerUi()`
 * -> `openVideoBgPickerDrawerUi()`, router đích đổi từ 'fileManagerVideo' (file đã xoá) sang
 * 'visualizerControlCenter' (đúng domain gọi picker này — "Use background video", Settings/
 * Visualizer Control Center), msg.type đổi 'fileManagerVideo.videoPicker.*' -> 'visualizerControlCenter.videoBgPicker.*'.
 * @param {string} title @param {string} bodyHtml
 */
function openVideoBgPickerDrawerUi(title, bodyHtml) {
    openGenericDrawer({ // core/generic-drawer.js
        height: '90vh',
        zIndex: Z_INDEX.GENERIC_DRAWER, // service/z-index.js — mặc định, không có modal nào khác mở đồng thời picker này
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
    const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
    if (closeBtn) closeBtn.addEventListener('click', () => eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.videoBgPicker.close.click', payload: {} }));

    // Click tile — delegated NGAY TRÊN genericDrawerBody (phần tử TĨNH DÙNG CHUNG nhiều feature,
    // dom-refs.js — cùng lý do PHẢI tự wire ở đây thay vì Listener tĩnh, xem docstring
    // core/file-manager/photo-ui.js::openPhotoImagePickerDrawerUi()).
    genericDrawerBody.addEventListener('click', (e) => {
        const tile = e.target.closest('[data-video-key]');
        if (!tile) return;
        eventBus.send({ router: 'visualizerControlCenter', type: 'visualizerControlCenter.videoBgPicker.tile.click', payload: { videoKey: tile.dataset.videoKey } });
    });
}

