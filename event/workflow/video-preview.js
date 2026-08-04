/**
 * event/workflow/video-preview.js — Router "videoPreview". Modal xem/sửa Video: Cut (dải phim + 2
 * tay cầm + playhead) LUÔN hiện, mặc định; Crop là TOGGLE độc lập chạy song song (không loại trừ
 * Cut); Zoom-pan (Panzoom trên chính videoEl) luôn sống, không thuộc mode nào.
 *
 * `open()` bọc TOÀN BỘ trong `withLoadingShield()` (core/loading-shield-util.js) — chỉ tắt shield
 * SAU KHI modal đã dựng xong VÀ đã có metadata thật (crop/trim/zoom-pan/history sẵn sàng tương tác),
 * không chỉ sau khi DOM append xong.
 *
 * `this._modalHandle`/`this._beforeCropSnapshot`/`this._resolveMetadataReady` giữ TRỰC TIẾP trên
 * object Workflow (KHÔNG qua appState — không phải dữ liệu nghiệp vụ tuần tự hoá được).
 *
 * NẠP SAU: core/file-manager/video-ui.js, core/media-transform.js (gộp crop-selector.js +
 * image-zoom.js + cycleRotation(), 04/08/2026), core/edit-history.js, core/video-editor/
 * compat-guard.js/filmstrip.js/frame-extract.js/webcodecs-engine.js, core/file-manager/video.js/
 * image.js, service/state/video-preview.js, service/blob-url.js,
 * event/workflow/media-transform-helpers.js (đổi tên từ crop-ratio-helpers.js).
 */
const FILMSTRIP_FRAME_COUNT = 14;
const MIN_TRIM_DURATION = 0.3; // giây — khoảng cách tối thiểu giữa Start/End

function _ensureMediabunnyLoaded() {
    if (window.Mediabunny) return Promise.resolve(true);
    if (window._mediabunnyLoadPromise) return window._mediabunnyLoadPromise;
    window._mediabunnyLoadPromise = new Promise((resolve) => {
        const candidates = [
            'https://cdn.jsdelivr.net/npm/mediabunny@1.46.0/dist/bundles/mediabunny.cjs',
            'https://cdn.jsdelivr.net/npm/mediabunny/dist/bundles/mediabunny.cjs',
            'https://unpkg.com/mediabunny@1.46.0/dist/bundles/mediabunny.cjs',
            'https://unpkg.com/mediabunny/dist/bundles/mediabunny.cjs',
            'https://cdn.jsdelivr.net/npm/mediabunny@1.46.0/dist/mediabunny.cjs',
        ];
        let i = 0;
        function tryNext() {
            if (i >= candidates.length) { console.error('[_ensureMediabunnyLoaded] Đã thử hết URL, không tải được Mediabunny.'); resolve(false); return; }
            const url = candidates[i++];
            const el = document.createElement('script');
            el.src = url;
            el.onload = () => resolve(true);
            el.onerror = () => tryNext();
            document.head.appendChild(el);
        }
        tryNext();
    });
    return window._mediabunnyLoadPromise;
}

function _formatVideoPreviewTime(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/** Icon dùng riêng cho dropdown Lưu (core/dropdown-menu.js — nhận sẵn chuỗi SVG, không tự build). */
function _svgIcon(d) {
    return `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${d}"/></svg>`;
}

const workflowVideoPreview = {
    _modalHandle: null,
    _beforeCropSnapshot: null, // snapshot lúc bật Crop — khôi phục nếu bấm Huỷ (KHÁC lịch sử Undo/Redo)
    _resolveMetadataReady: null,

    /** @param {string} videoKey */
    async open(videoKey) {
        await withLoadingShield(t('videoPreview.loading'), async () => { // core/loading-shield-util.js
            const record = await getVideoRecord(videoKey); // service/db.js — Workflow đọc (Rule 3b)
            if (!record) { await alertModal(t('videoPreview.videoNotFound')); return; }

            const mediabunnyOk = await _ensureMediabunnyLoaded();
            if (!mediabunnyOk) { await alertModal(t('videoPreview.compat.mediabunnyNotLoaded')); return; }

            const compat = await checkVideoEditorCompat(record.blob); // core/video-editor/compat-guard.js
            if (!compat.supported) { await alertModal(t(`videoPreview.compat.${compat.reason}`)); return; }

            const videoUrl = createBlobUrl(record.blob); // service/blob-url.js — Workflow tạo (Rule 3b)
            const posterUrl = createBlobUrl(record.thumbBlob); // service/blob-url.js
            const ratioPresets = workflowMediaTransformHelpers.getPresets(); // event/workflow/media-transform-helpers.js

            appState.set('videoPreviewVideoKey', videoKey);
            appState.set('videoPreviewRecord', record);
            appState.set('videoPreviewRotateDeg', 0);
            appState.set('videoPreviewHasUnsavedChanges', false);
            appState.set('videoPreviewFilmstripFrames', []);
            appState.set('videoPreviewCropSession', null);
            appState.set('videoPreviewActiveDrag', null);
            appState.set('videoPreviewCropVisible', false);
            appState.set('videoPreviewZoomPanSession', null);
            appState.set('videoPreviewHistorySession', null);
            appState.set('videoPreviewIsPlaying', false);

            const metadataReadyPromise = new Promise((resolve) => { this._resolveMetadataReady = resolve; });
            this._modalHandle = openVideoPreviewModal({ videoUrl, posterUrl, filename: record.filename, ratioPresets }); // core/file-manager/video-ui.js

            await metadataReadyPromise; // shield chỉ tắt sau khi crop/trim/zoom-pan/history đã dựng xong
        });
    },

    /** Ứng với 'videoPreview.metadata.loaded' — `<video>` vừa biết xong kích thước/thời lượng thật. */
    async handleMetadataLoaded() {
        const videoEl = this._modalHandle.videoEl;
        const w = videoEl.videoWidth, h = videoEl.videoHeight, duration = videoEl.duration || 0;
        appState.set('videoPreviewNativeW', w);
        appState.set('videoPreviewNativeH', h);
        appState.set('videoPreviewSourceDuration', duration);
        appState.set('videoPreviewCutStart', 0);
        appState.set('videoPreviewCutEnd', duration);

        this._modalHandle.cropCanvasEl.width = w;
        this._modalHandle.cropCanvasEl.height = h;
        const cropSession = initCropSession(w, h, { padRatio: 0 }); // core/media-transform.js — full-frame, không crop cho tới khi tự kéo
        appState.set('videoPreviewCropSession', cropSession);

        const zoomPanSession = initPanzoomSession(videoEl, { maxScale: 4, minScale: 1, contain: 'outside', cursor: 'default' }); // core/media-transform.js — luôn sống, không thuộc mode nào
        appState.set('videoPreviewZoomPanSession', zoomPanSession);

        const initialSnapshot = {
            cropRect: getCropSessionRect(cropSession), aspectRatio: cropSession.aspectRatio, // core/media-transform.js
            rotateDeg: 0, cutStart: 0, cutEnd: duration, zoomPan: { scale: 1, x: 0, y: 0 },
        };
        appState.set('videoPreviewHistorySession', initHistorySession(initialSnapshot)); // core/edit-history.js

        // Chuyển từ poster tĩnh sang video thật (đứng yên tại khung hình 0 — KHÔNG auto-play).
        this._modalHandle.posterEl.classList.add('hidden');
        this._modalHandle.videoEl.classList.remove('hidden');

        this._renderTrimPositions();
        this._renderFilmstripFrames(); // async, chạy nền — KHÔNG chặn thao tác/tắt shield

        if (this._resolveMetadataReady) { this._resolveMetadataReady(); this._resolveMetadataReady = null; }
    },

    /** Trích N khung hình nền dải phim — chạy NGẦM sau khi shield đã tắt. */
    async _renderFilmstripFrames() {
        const record = appState.get('videoPreviewRecord');
        const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
        const thumbH = 56;
        const thumbW = Math.max(30, Math.round(thumbH * (w / (h || 1))));
        const frames = await buildCutFilmstripFrames(record.blob, FILMSTRIP_FRAME_COUNT, thumbW, thumbH); // core/video-editor/filmstrip.js
        if (!this._modalHandle) return; // guard: modal đã đóng trước khi trích xong
        appState.set('videoPreviewFilmstripFrames', frames);

        // #video-preview-filmstrip-frames TÁCH RIÊNG khỏi #video-preview-filmstrip-track (SỬA
        // 04/08/2026) — track không còn overflow:hidden nên 2 tay cầm ở 0%/100% không bị cắt mất
        // nửa; container riêng này mới overflow:hidden để bo góc ảnh nền.
        const framesEl = this._modalHandle.filmstripFramesEl;
        framesEl.innerHTML = '';
        frames.forEach(({ blob }) => {
            const cell = document.createElement('div');
            cell.className = 'video-preview-filmstrip-frame';
            if (blob) cell.style.backgroundImage = `url(${createBlobUrl(blob)})`; // service/blob-url.js — KHÔNG revoke, sống cùng vòng đời modal
            framesEl.appendChild(cell);
        });
    },

    /** Vị trí 2 tay cầm Start/End + 2 dim + viền — tính lại mỗi lần cutStart/cutEnd đổi. */
    _renderTrimPositions() {
        const duration = appState.get('videoPreviewSourceDuration');
        if (duration <= 0) return;
        const cutStart = appState.get('videoPreviewCutStart'), cutEnd = appState.get('videoPreviewCutEnd');
        const trackWidth = this._modalHandle.filmstripTrackEl.getBoundingClientRect().width || 1;
        const leftPx = (cutStart / duration) * trackWidth;
        const rightPx = (1 - cutEnd / duration) * trackWidth;

        this._modalHandle.dimLeftEl.style.width = `${leftPx}px`;
        this._modalHandle.dimRightEl.style.width = `${rightPx}px`;
        this._modalHandle.rangeBorderEl.style.left = `${leftPx}px`;
        this._modalHandle.rangeBorderEl.style.right = `${rightPx}px`;
        this._modalHandle.startHandleEl.style.left = `${leftPx}px`;
        this._modalHandle.endHandleEl.style.left = `${trackWidth - rightPx}px`;
    },

    // ===================== Cut: tay cầm Start/End =====================

    handleTrimDragStart(handle) {
        appState.set('videoPreviewActiveDrag', handle);
        this._modalHandle.videoEl.pause();
        appState.set('videoPreviewIsPlaying', false);
    },

    /** @param {number} clientX */
    handleTrimDragMove(clientX) {
        const activeDrag = appState.get('videoPreviewActiveDrag');
        if (!activeDrag) return; // bắn liên tục từ document, guard bình thường
        const duration = appState.get('videoPreviewSourceDuration');
        const rect = this._modalHandle.filmstripTrackEl.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / (rect.width || 1)));
        const time = fraction * duration;
        const cutStart = appState.get('videoPreviewCutStart'), cutEnd = appState.get('videoPreviewCutEnd');

        if (activeDrag === 'start') {
            const newStart = Math.min(time, cutEnd - MIN_TRIM_DURATION);
            appState.set('videoPreviewCutStart', newStart);
            this._modalHandle.videoEl.currentTime = newStart; // seek thật — hiện khung hình thật, không phải ảnh tĩnh
        } else {
            const newEnd = Math.max(time, cutStart + MIN_TRIM_DURATION);
            appState.set('videoPreviewCutEnd', newEnd);
            this._modalHandle.videoEl.currentTime = newEnd;
        }
        this._renderTrimPositions();
    },

    handleTrimDragEnd() {
        const wasDragging = !!appState.get('videoPreviewActiveDrag');
        appState.set('videoPreviewActiveDrag', null);
        if (!wasDragging) return;
        this._commitHistory();
        this._modalHandle.videoEl.play().catch(() => {});
        appState.set('videoPreviewIsPlaying', true);
    },

    // ===================== Cut: phát/tạm dừng =====================

    /** @param {number} currentTime */
    handleVideoTimeUpdate(currentTime) {
        const cutEnd = appState.get('videoPreviewCutEnd');
        const cutStart = appState.get('videoPreviewCutStart');
        if (currentTime >= cutEnd) this._modalHandle.videoEl.currentTime = cutStart; // lặp trong đoạn cắt
        this._renderPlayheadPosition(currentTime);
    },

    /** @param {number} currentTime */
    _renderPlayheadPosition(currentTime) {
        const duration = appState.get('videoPreviewSourceDuration');
        if (duration <= 0) return;
        const trackWidth = this._modalHandle.filmstripTrackEl.getBoundingClientRect().width || 1;
        this._modalHandle.playheadEl.style.left = `${(currentTime / duration) * trackWidth}px`;
        this._modalHandle.currentTimeLabelEl.textContent = _formatVideoPreviewTime(currentTime);
    },

    /** Tap màn hình — đảo phát/dừng (mục 1, phản hồi Giang). */
    handleMediaTapClick() {
        const videoEl = this._modalHandle.videoEl;
        if (videoEl.paused) { videoEl.play().catch(() => {}); appState.set('videoPreviewIsPlaying', true); }
        else { videoEl.pause(); appState.set('videoPreviewIsPlaying', false); }
    },

    // ===================== Crop: toggle độc lập =====================

    handleCropToggleClick() {
        const visible = appState.get('videoPreviewCropVisible');
        if (!visible) { this._enterCropVisible(); return; }
        this._promptExitCropVisible();
    },

    _enterCropVisible() {
        this._beforeCropSnapshot = this._buildSnapshot();
        appState.set('videoPreviewCropVisible', true);
        this._modalHandle.videoEl.pause();
        appState.set('videoPreviewIsPlaying', false);
        this._modalHandle.cropLayerEl.classList.add('is-visible');
        this._modalHandle.cropToggleBtn.classList.add('is-active');
        this._modalHandle.toolsGroupEl.classList.add('is-hidden'); // hoán đổi trong CÙNG hàng toolbar (mục 4, phản hồi Giang)
        this._modalHandle.ratioGroupEl.classList.add('is-visible');
        this._syncCropCanvasBox();
        this._drawCropOverlay();
        this._renderRatioButtonsActiveState();
    },

    /** Đo hộp `<video>` THẬT (đã canh giữa bằng `object-contain`) rồi đặt CSS `cropCanvasEl` khớp
     * TUYỆT ĐỐI theo đúng hộp đó — SỬA (04/08/2026) lỗi `absolute` + flex cha không tương thích
     * khiến canvas lệch khỏi video (xem docstring components/video-preview.js). Gọi lại mỗi lần
     * vào Crop — CHƯA xử lý resize/xoay màn hình giữa chừng (nợ kỹ thuật nhỏ, ít gặp trên mobile
     * PWA đang mở modal). */
    _syncCropCanvasBox() {
        const videoEl = this._modalHandle.videoEl;
        const wrapEl = this._modalHandle.mediaWrapEl;
        const canvas = this._modalHandle.cropCanvasEl;
        const videoRect = videoEl.getBoundingClientRect();
        const wrapRect = wrapEl.getBoundingClientRect();
        canvas.style.position = 'absolute';
        canvas.style.left = `${videoRect.left - wrapRect.left}px`;
        canvas.style.top = `${videoRect.top - wrapRect.top}px`;
        canvas.style.width = `${videoRect.width}px`;
        canvas.style.height = `${videoRect.height}px`;
    },

    _promptExitCropVisible() {
        modalChoice( // core/modal-choice.js
            t('videoPreview.cropExit.desc'),
            [
                { label: t('videoPreview.cropExit.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('videoPreview.cropExit.discard'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: () => this._exitCropVisible(false) },
                { label: t('videoPreview.cropExit.apply'), className: 'flex-1 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-sm font-semibold transition-colors', onClick: () => this._exitCropVisible(true) },
            ],
            { title: t('videoPreview.cropExit.title') }
        );
    },

    /** @param {boolean} apply */
    _exitCropVisible(apply) {
        if (apply) { this._commitHistory(); } else { this._applySnapshot(this._beforeCropSnapshot); }
        this._beforeCropSnapshot = null;
        appState.set('videoPreviewCropVisible', false);
        this._modalHandle.cropLayerEl.classList.remove('is-visible');
        this._modalHandle.cropToggleBtn.classList.remove('is-active');
        this._modalHandle.toolsGroupEl.classList.remove('is-hidden');
        this._modalHandle.ratioGroupEl.classList.remove('is-visible');
    },

    // ===================== Crop: tỉ lệ + kéo khung =====================

    /** @param {number} ratio */
    handleCropRatioSelect(ratio) {
        const session = appState.get('videoPreviewCropSession');
        setCropSessionAspectRatio(session, ratio); // core/media-transform.js
        this._drawCropOverlay();
        this._renderRatioButtonsActiveState();
    },

    handleCropRatioFlip() {
        const session = appState.get('videoPreviewCropSession');
        workflowMediaTransformHelpers.applyFlip(session); // event/workflow/media-transform-helpers.js
        this._drawCropOverlay();
        this._renderRatioButtonsActiveState();
    },

    _renderRatioButtonsActiveState() {
        const session = appState.get('videoPreviewCropSession');
        this._modalHandle.ratioButtons.forEach(({ btn, ratio }) => {
            const matches = Number.isNaN(ratio) ? Number.isNaN(session.aspectRatio) : ratio === session.aspectRatio;
            btn.classList.toggle('is-active', matches);
        });
    },

    /** Quy đổi toạ độ màn hình -> toạ độ canvas (px nguồn) — dùng chung cho pointerDown/Move VÀ
     * `_moveOrResizeCropSession()` (tránh lặp lại phép tính `scale` ở nhiều chỗ).
     * @param {number} clientX @param {number} clientY @returns {{x:number,y:number}} */
    _toCropCanvasCoords(clientX, clientY) {
        const canvas = this._modalHandle.cropCanvasEl;
        const rect = canvas.getBoundingClientRect();
        const scale = canvas.width / (rect.width || canvas.width || 1);
        return { x: (clientX - rect.left) * scale, y: (clientY - rect.top) * scale };
    },

    /** @param {number} clientX @param {number} clientY */
    handleCropCanvasPointerDown(clientX, clientY) {
        const session = appState.get('videoPreviewCropSession');
        const canvas = this._modalHandle.cropCanvasEl;
        const scale = canvas.width / (canvas.getBoundingClientRect().width || 1);
        cropSessionPointerDown(session, this._toCropCanvasCoords(clientX, clientY), 30 * scale); // core/media-transform.js
    },

    /** @param {number} clientX @param {number} clientY */
    handleCropCanvasPointerMove(clientX, clientY) {
        const session = appState.get('videoPreviewCropSession');
        if (!session.activeHandle) return;
        this._moveOrResizeCropSession(this._toCropCanvasCoords(clientX, clientY));
        this._drawCropOverlay();
    },

    handleCropCanvasPointerUp() {
        const session = appState.get('videoPreviewCropSession');
        const wasDragging = !!session.activeHandle;
        cropSessionPointerUp(session); // core/media-transform.js
        if (wasDragging) this._commitHistory();
    },

    /** @param {{x:number,y:number}} pos */
    _moveOrResizeCropSession(pos) {
        const session = appState.get('videoPreviewCropSession');
        const s = session.dragStart;
        const dx = pos.x - s.x, dy = pos.y - s.y;
        const rect = this._modalHandle.cropCanvasEl.getBoundingClientRect();
        const scale = this._modalHandle.cropCanvasEl.width / (rect.width || 1);
        const minSize = 50 * scale;

        if (session.activeHandle === 'center') {
            session.rect = moveCropRect({ x: s.rx, y: s.ry, w: s.rw, h: s.rh }, dx, dy, session.sourceWidth, session.sourceHeight); // core/media-transform.js
            return;
        }
        const flipX = session.activeHandle === 'tl' || session.activeHandle === 'bl';
        const flipY = session.activeHandle === 'tl' || session.activeHandle === 'tr';
        const startRect = { x: s.rx, y: s.ry, w: s.rw, h: s.rh };
        session.rect = Number.isNaN(session.aspectRatio)
            ? computeFreeResizedRect(startRect, flipX, flipY, dx, dy, minSize, session.sourceWidth, session.sourceHeight) // core/media-transform.js
            : computeRatioLockedResizedRect(startRect, flipX, flipY, dx, session.aspectRatio, minSize, session.sourceWidth, session.sourceHeight); // core/media-transform.js
    },

    _drawCropOverlay() {
        const session = appState.get('videoPreviewCropSession');
        const canvas = this._modalHandle.cropCanvasEl;
        const scale = canvas.width / (canvas.getBoundingClientRect().width || 1);
        drawCropSessionOverlay(canvas.getContext('2d'), session, canvas.width, canvas.height, scale); // core/media-transform.js
    },

    // ===================== Rotate / Reset =====================

    /** Xoay tới góc kế tiếp (0→90→180→270→0...) — nút DUY NHẤT, không còn tách trái/phải. */
    handleRotateClick() {
        appState.set('videoPreviewRotateDeg', cycleRotation(appState.get('videoPreviewRotateDeg'))); // core/media-transform.js
        this._commitHistory();
    },

    handleReset() {
        const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
        const cropSession = appState.get('videoPreviewCropSession');
        setCropSessionRect(cropSession, { x: 0, y: 0, w, h }); // core/media-transform.js
        cropSession.aspectRatio = NaN;
        appState.set('videoPreviewRotateDeg', 0);
        appState.set('videoPreviewCutStart', 0);
        appState.set('videoPreviewCutEnd', appState.get('videoPreviewSourceDuration'));
        const zoomPanSession = appState.get('videoPreviewZoomPanSession');
        resetPanzoomSession(zoomPanSession); // core/media-transform.js
        this._drawCropOverlay();
        this._renderTrimPositions();
        this._renderRatioButtonsActiveState();
        this._commitHistory();
    },

    // ===================== Undo/Redo (core/edit-history.js) =====================

    /** @returns {object} snapshot — crop rect/tỉ lệ + rotate + cut + zoom-pan hiện tại. */
    _buildSnapshot() {
        const cropSession = appState.get('videoPreviewCropSession');
        const zoomPanSession = appState.get('videoPreviewZoomPanSession');
        return {
            cropRect: getCropSessionRect(cropSession), aspectRatio: cropSession.aspectRatio, // core/media-transform.js
            rotateDeg: appState.get('videoPreviewRotateDeg'),
            cutStart: appState.get('videoPreviewCutStart'), cutEnd: appState.get('videoPreviewCutEnd'),
            zoomPan: getPanzoomState(zoomPanSession), // core/media-transform.js
        };
    },

    /** @param {object} snapshot */
    _applySnapshot(snapshot) {
        const cropSession = appState.get('videoPreviewCropSession');
        setCropSessionRect(cropSession, snapshot.cropRect); // core/media-transform.js
        cropSession.aspectRatio = snapshot.aspectRatio;
        appState.set('videoPreviewRotateDeg', snapshot.rotateDeg);
        appState.set('videoPreviewCutStart', snapshot.cutStart);
        appState.set('videoPreviewCutEnd', snapshot.cutEnd);
        const zoomPanSession = appState.get('videoPreviewZoomPanSession');
        zoomPanSession.zoom(snapshot.zoomPan.scale, { animate: false });
        zoomPanSession.pan(snapshot.zoomPan.x, snapshot.zoomPan.y, { animate: false });
        this._drawCropOverlay();
        this._renderTrimPositions();
        this._renderRatioButtonsActiveState();
        appState.set('videoPreviewHasUnsavedChanges', true);
    },

    /** Đẩy 1 mốc lịch sử — gọi SAU MỖI thao tác đã "chốt" (Áp dụng Crop/Rotate/thả tay cầm/Reset). */
    _commitHistory() {
        const session = appState.get('videoPreviewHistorySession');
        appState.set('videoPreviewHistorySession', pushHistoryEntry(session, this._buildSnapshot())); // core/edit-history.js
        appState.set('videoPreviewHasUnsavedChanges', true);
    },

    handleUndoClick() {
        const session = appState.get('videoPreviewHistorySession');
        if (!canUndoHistory(session)) return; // core/edit-history.js
        const updated = undoHistory(session); // core/edit-history.js
        appState.set('videoPreviewHistorySession', updated);
        this._applySnapshot(getCurrentHistorySnapshot(updated)); // core/edit-history.js
    },

    handleRedoClick() {
        const session = appState.get('videoPreviewHistorySession');
        if (!canRedoHistory(session)) return; // core/edit-history.js
        const updated = redoHistory(session); // core/edit-history.js
        appState.set('videoPreviewHistorySession', updated);
        this._applySnapshot(getCurrentHistorySnapshot(updated)); // core/edit-history.js
    },

    // ===================== Trích xuất ảnh =====================

    async handleExtractFrame() {
        const sourceCanvas = captureVideoFrameToCanvas(this._modalHandle.videoEl); // core/video-editor/frame-extract.js
        const blob = await new Promise((resolve) => sourceCanvas.toBlob(resolve, 'image/jpeg', 0.95));
        if (!blob) { await alertModal(t('videoPreview.extractFrame.failed')); return; }
        const thumbBlob = await buildExtractedPhotoThumbnail(sourceCanvas, 0.2); // core/video-editor/frame-extract.js
        const filename = `${buildExtractedPhotoFilename()}.jpg`; // core/video-editor/frame-extract.js
        saveImage(blob, filename, thumbBlob, sourceCanvas.width, sourceCanvas.height); // core/file-manager/image.js
        await alertModal(t('videoPreview.extractFrame.success'));
    },

    // ===================== Lưu =====================

    /** @param {HTMLElement} anchorEl */
    handleSaveClick(anchorEl) {
        openDropdownMenu(anchorEl, [ // core/dropdown-menu.js
            { icon: _svgIcon('M4 7h16M9 7V4h6v3m-7 0v13a1 1 0 001 1h8a1 1 0 001-1V7H7z'), name: t('videoPreview.save.overwrite'), callback: () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.saveOverwrite.click', payload: {} }) },
            { icon: _svgIcon('M8 16V5a1 1 0 011-1h9a1 1 0 011 1v9a1 1 0 01-1 1H9M8 16H5a1 1 0 01-1-1V6a1 1 0 011-1h3m0 11v3a1 1 0 001 1h9a1 1 0 001-1v-9a1 1 0 00-1-1h-3'), name: t('videoPreview.save.asNew'), callback: () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.saveAsNew.click', payload: {} }) },
        ], { zIndex: Z_INDEX.VIDEO_PREVIEW_MENU }); // service/z-index.js
    },

    /** Quy đổi crop rect + zoom/pan hiện tại ra 1 rect nguồn DUY NHẤT (fraction 0-1) — GIẢ ĐỊNH cần
     * kiểm chứng thật trên thiết bị (dấu/hệ quy chiếu `pan()` của Panzoom): rect (toạ độ px nguồn,
     * TRƯỚC zoom) hợp với nghịch đảo scale/pan để ra vùng nguồn thật đang hiển thị.
     * @returns {{x:number,y:number,w:number,h:number}|null} null nếu không crop/zoom gì (full-frame). */
    _computeCropFraction() {
        const cropSession = appState.get('videoPreviewCropSession');
        const zoomPanSession = appState.get('videoPreviewZoomPanSession');
        const rect = getCropSessionRect(cropSession); // core/media-transform.js
        const { scale, x, y } = getPanzoomState(zoomPanSession); // core/media-transform.js
        const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');

        const isFullFrame = rect.x <= 0 && rect.y <= 0 && rect.w >= w && rect.h >= h;
        if (isFullFrame && scale === 1 && x === 0 && y === 0) return null;

        const finalW = rect.w / scale, finalH = rect.h / scale;
        const finalX = rect.x - x / scale, finalY = rect.y - y / scale;
        return { x: finalX / w, y: finalY / h, w: finalW / w, h: finalH / h };
    },

    _buildProcessParams() {
        return {
            sourceBlob: appState.get('videoPreviewRecord').blob,
            cutStart: appState.get('videoPreviewCutStart'),
            cutEnd: appState.get('videoPreviewCutEnd'),
            cropFraction: this._computeCropFraction(),
            rotateDeg: appState.get('videoPreviewRotateDeg'),
        };
    },

    _buildNewFilename() {
        const original = appState.get('videoPreviewRecord').filename || 'video';
        const base = original.replace(/\.[^/.]+$/, '');
        const stamp = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        return `${base}-edit-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.mp4`;
    },

    /** @param {Blob} blob */
    async _buildThumbForBlob(blob) {
        const tmp = document.createElement('video');
        tmp.muted = true;
        tmp.src = createBlobUrl(blob); // service/blob-url.js
        await new Promise((resolve) => { tmp.addEventListener('loadeddata', resolve, { once: true }); });
        const canvas = document.createElement('canvas');
        canvas.width = tmp.videoWidth; canvas.height = tmp.videoHeight;
        canvas.getContext('2d').drawImage(tmp, 0, 0, canvas.width, canvas.height);
        const thumbBlob = await buildExtractedPhotoThumbnail(canvas, 0.2); // core/video-editor/frame-extract.js
        return { thumbBlob, width: tmp.videoWidth, height: tmp.videoHeight, duration: tmp.duration };
    },

    async handleSaveOverwrite() {
        this._modalHandle.videoEl.pause();
        try {
            const blob = await processVideo(this._buildProcessParams()); // core/video-editor/webcodecs-engine.js
            const { thumbBlob, width, height, duration } = await this._buildThumbForBlob(blob);
            const record = appState.get('videoPreviewRecord');
            setVideoRecord(appState.get('videoPreviewVideoKey'), { blob, thumbBlob, width, height, duration, filename: record.filename, addedAt: record.addedAt }); // service/db.js
            appState.set('videoPreviewHasUnsavedChanges', false);
            await alertModal(t('videoPreview.save.success'));
        } catch (err) {
            console.error('[workflowVideoPreview.handleSaveOverwrite] Lỗi xử lý/lưu video:', err);
            await alertModal(t('videoPreview.save.failed'));
        }
    },

    async handleSaveAsNew() {
        this._modalHandle.videoEl.pause();
        try {
            const blob = await processVideo(this._buildProcessParams()); // core/video-editor/webcodecs-engine.js
            const filename = this._buildNewFilename();
            const { thumbBlob, width, height, duration } = await this._buildThumbForBlob(blob);
            saveVideo(blob, filename, thumbBlob, width, height, duration); // core/file-manager/video.js
            appState.set('videoPreviewHasUnsavedChanges', false);
            await alertModal(t('videoPreview.save.success'));
        } catch (err) {
            console.error('[workflowVideoPreview.handleSaveAsNew] Lỗi xử lý/lưu video mới:', err);
            await alertModal(t('videoPreview.save.failed'));
        }
    },

    // ===================== Đóng modal =====================

    handleClose() {
        if (!appState.get('videoPreviewHasUnsavedChanges')) { this._reallyClose(); return; }
        modalChoice( // core/modal-choice.js
            t('videoPreview.discardConfirm.desc'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('videoPreview.discardConfirm.title'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: () => this._reallyClose() },
            ],
            { title: t('videoPreview.discardConfirm.title') }
        );
    },

    _reallyClose() {
        const zoomPanSession = appState.get('videoPreviewZoomPanSession');
        if (zoomPanSession) destroyPanzoomSession(zoomPanSession); // core/media-transform.js
        if (this._modalHandle) { this._modalHandle.close(); this._modalHandle = null; }
        appState.set('videoPreviewVideoKey', null);
        appState.set('videoPreviewRecord', null);
        appState.set('videoPreviewCropSession', null);
        appState.set('videoPreviewActiveDrag', null);
        appState.set('videoPreviewFilmstripFrames', []);
        appState.set('videoPreviewCropVisible', false);
        appState.set('videoPreviewZoomPanSession', null);
        appState.set('videoPreviewHistorySession', null);
        appState.set('videoPreviewIsPlaying', false);
    },
};
