/**
 * event/workflow/video-preview.js — Router "videoPreview". THAY `event/workflow/video-editor.js`
 * (Video Editor NLE đa track/đa đoạn, ĐÃ XOÁ HẲN, "Song/Video Unification" v12, gộp vào modal xem
 * Video đúng khuôn modal xem Ảnh — xem plan-v12-song-video-unification.md).
 *
 * Vòng đời: `open(videoKey)` (gọi từ `event/workflow/file-manager-video.js::navigateToVideoEdit()`,
 * ĐỔI từ điều hướng sang `video-editor.html` sang mở modal tại chỗ) -> load record + compat-guard
 * (core/video-editor/compat-guard.js, GIỮ NGUYÊN) -> `openVideoPreviewModal()` (core/file-manager/
 * video-ui.js) -> đợi `loadedmetadata` mới biết kích thước/thời lượng thật -> khởi crop session
 * (core/crop-selector.js, TÁI DÙNG NGUYÊN — dùng chung Photo Edit) full-frame (padRatio:0, KHÁC
 * mặc định 10% của `initCropSession()` — mục 2b "mở sẵn, chỉ cần kéo thả" nghĩa là KHÔNG crop gì
 * cho tới khi người dùng tự kéo, xem `_computeCropFraction()`) + dải phim (core/video-editor/
 * filmstrip.js, TÁI DÙNG NGUYÊN).
 *
 * `this._modalHandle` — DOM refs/hàm đóng của modal đang mở, giữ TRỰC TIẾP trên object Workflow
 * (KHÔNG qua appState — cùng lý do `_activeImageModalHandle` ở event/workflow/file-manager-
 * photo.js: DOM handle không phải dữ liệu nghiệp vụ tuần tự hoá được).
 *
 * NẠP SAU: core/file-manager/video-ui.js, core/crop-selector.js, core/video-editor/compat-guard.js/
 * filmstrip.js/frame-extract.js/webcodecs-engine.js, core/file-manager/video.js, core/file-manager/
 * image.js, service/state/video-preview.js.
 */
const FILMSTRIP_FRAME_COUNT = 14; // số khung hình nền dải phim — không phải yêu cầu chính xác của Giang, chọn đủ dày cho 1 màn hình điện thoại
const MIN_TRIM_DURATION = 0.3; // giây — khoảng cách tối thiểu giữa Start/End, tránh đoạn cắt rỗng

/** Tải Mediabunny NGẦM, CHỈ 1 LẦN — KHÁC `video-editor.html` cũ (tải sẵn ngay lúc trang load, vì
 * trang đó CHỈ mở khi thật sự sửa video). Modal xem Video giờ sống trong `index.html` (luôn mở dù
 * người dùng không đụng tới Video) — tải lười ĐÚNG lúc `open()` gọi mới hợp lý, tránh nặng tải
 * trang chính cho người không dùng tính năng này. Danh sách URL fallback GIỮ NGUYÊN từ
 * `video-editor.html` cũ (đã xoá). @returns {Promise<boolean>} */
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
            if (i >= candidates.length) { console.error('[_ensureMediabunnyLoaded] Đã thử hết ' + candidates.length + ' URL, KHÔNG url nào tải được Mediabunny.'); resolve(false); return; }
            const url = candidates[i++];
            const el = document.createElement('script');
            el.src = url;
            el.onload = () => { console.log(`[_ensureMediabunnyLoaded] Tải được Mediabunny từ: ${url}`); resolve(true); };
            el.onerror = () => { console.warn(`[_ensureMediabunnyLoaded] Fail: ${url} — thử URL kế tiếp.`); tryNext(); };
            document.head.appendChild(el);
        }
        tryNext();
    });
    return window._mediabunnyLoadPromise;
}

/** Định dạng giây -> "mm:ss" — mỗi trang tự viết riêng (cùng tiền lệ `_formatSeconds` ở
 * webcodecs-engine.js — Rule 3, Workflow không bị ràng buộc nhưng giữ nhất quán không tạo hằng số
 * dùng chung cho 1 hàm bé). */
function _formatVideoPreviewTime(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

const workflowVideoPreview = {
    _modalHandle: null,

    /** Ứng với `workflowPlaylist.navigateToActiveMenuVideoEdit()` (menu 3 chấm Playlist) — gọi
     * THẲNG, không qua tầng trung gian nào (file-manager-video.js đã xoá hẳn, phản hồi Giang).
     * @param {string} videoKey */
    async open(videoKey) {
        const record = await getVideoRecord(videoKey); // service/db.js
        if (!record) { await alertModal(t('videoPreview.videoNotFound')); return; } // guard: video vừa bị xoá ở tab/thao tác khác

        const mediabunnyOk = await _ensureMediabunnyLoaded();
        if (!mediabunnyOk) { await alertModal(t('videoPreview.compat.mediabunnyNotLoaded')); return; }

        const compat = await checkVideoEditorCompat(record.blob); // core/video-editor/compat-guard.js
        if (!compat.supported) { await alertModal(t(`videoPreview.compat.${compat.reason}`)); return; }

        appState.set('videoPreviewVideoKey', videoKey);
        appState.set('videoPreviewRecord', record);
        appState.set('videoPreviewRotateDeg', 0);
        appState.set('videoPreviewHasUnsavedChanges', false);
        appState.set('videoPreviewFilmstripFrames', []);
        appState.set('videoPreviewCropSession', null);
        appState.set('videoPreviewActiveDrag', null);

        this._modalHandle = openVideoPreviewModal({ key: videoKey, blob: record.blob, filename: record.filename }); // core/file-manager/video-ui.js
    },

    /** Ứng với 'videoPreview.metadata.loaded' — `<video>` vừa biết xong kích thước/thời lượng
     * thật. Nudge play()/pause() ngay (iOS Safari cần user-gesture + bước này mới chắc chắn vẽ
     * được khung hình đầu, cùng kỹ thuật `_extractVideoThumbAndMeta()` — event/workflow/file-
     * manager-video.js). */
    async handleMetadataLoaded() {
        const videoEl = this._modalHandle.videoEl;
        const w = videoEl.videoWidth, h = videoEl.videoHeight, duration = videoEl.duration || 0;
        appState.set('videoPreviewNativeW', w);
        appState.set('videoPreviewNativeH', h);
        appState.set('videoPreviewSourceDuration', duration);
        appState.set('videoPreviewCutStart', 0);
        appState.set('videoPreviewCutEnd', duration);
        appState.set('videoPreviewScrubTime', 0);

        try { await videoEl.play(); videoEl.pause(); } catch (err) { /* im lặng — chỉ là nudge trình bày, không chặn luồng chính */ }
        videoEl.currentTime = 0;

        this._modalHandle.cropCanvasEl.width = w;
        this._modalHandle.cropCanvasEl.height = h;
        const session = initCropSession(w, h, { padRatio: 0 }); // core/crop-selector.js — full-frame mặc định (KHÁC 10% mặc định của hàm, xem docstring đầu file)
        appState.set('videoPreviewCropSession', session);
        this._drawCropOverlay();

        this._modalHandle.scrubInputEl.max = String(duration);
        this._renderTrimPositions();
        this._renderFilmstripFrames(); // async, không await — chạy nền, tự cập nhật DOM khi xong
    },

    /** Trích N khung hình rải đều làm nền dải phim (core/video-editor/filmstrip.js, TÁI DÙNG
     * NGUYÊN) — chạy NGẦM sau khi modal đã mở, không chặn thao tác Cắt/Crop/Xoay/Lưu (những việc
     * đó không cần dải phim đã tải xong). */
    async _renderFilmstripFrames() {
        const record = appState.get('videoPreviewRecord');
        const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
        const thumbH = 112;
        const thumbW = Math.max(60, Math.round(thumbH * (w / (h || 1))));
        const frames = await buildCutFilmstripFrames(record.blob, FILMSTRIP_FRAME_COUNT, thumbW, thumbH); // core/video-editor/filmstrip.js
        if (!this._modalHandle) return; // guard: modal đã đóng trước khi trích xong
        appState.set('videoPreviewFilmstripFrames', frames);

        const trackEl = this._modalHandle.filmstripTrackEl;
        // Xoá 5 phần tử tĩnh (2 dim/1 border/2 handle) tạm thời để chèn khung hình nền VÀO GIỮA
        // (trước 5 phần tử đó, đúng thứ tự z DOM — 5 phần tử kia absolute nên không ảnh hưởng layout).
        const staticChildren = [this._modalHandle.dimLeftEl, this._modalHandle.dimRightEl, this._modalHandle.rangeBorderEl, this._modalHandle.startHandleEl, this._modalHandle.endHandleEl];
        frames.forEach(({ blob }) => {
            const cell = document.createElement('div');
            if (blob) cell.style.backgroundImage = `url(${URL.createObjectURL(blob)})`; // KHÔNG revoke — sống cùng vòng đời modal, tự mất theo GC khi overlay.remove()
            trackEl.insertBefore(cell, staticChildren[0]);
        });
    },

    /** Vị trí 2 tay cầm Start/End + 2 dim + viền — tính lại mỗi lần cutStart/cutEnd đổi. */
    _renderTrimPositions() {
        const duration = appState.get('videoPreviewSourceDuration');
        if (duration <= 0) return; // guard — chưa có metadata
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

    /** Ứng với tay cầm Start/End 'pointerdown' (core/file-manager/video-ui.js). Theo dõi TIẾP
     * ở `videoPreview.trimDrag.move`/`.end` — 2 msg.type đó bắn LIÊN TỤC từ `document` (event/
     * listener/video-preview.js, DOM TĨNH thật sự), guard bằng chính field này. */
    handleTrimDragStart(handle) { appState.set('videoPreviewActiveDrag', handle); },

    /** Ứng với 'videoPreview.trimDrag.move' — bắn LIÊN TỤC bất kể có đang kéo hay không (Rule 5a
     * không có ngoại lệ theo tần suất). @param {number} clientX */
    handleTrimDragMove(clientX) {
        const activeDrag = appState.get('videoPreviewActiveDrag');
        if (!activeDrag) return; // guard clause — không đang kéo gì cả
        const duration = appState.get('videoPreviewSourceDuration');
        const rect = this._modalHandle.filmstripTrackEl.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / (rect.width || 1)));
        const time = fraction * duration;

        const cutStart = appState.get('videoPreviewCutStart'), cutEnd = appState.get('videoPreviewCutEnd');
        if (activeDrag === 'start') {
            appState.set('videoPreviewCutStart', Math.min(time, cutEnd - MIN_TRIM_DURATION));
        } else {
            appState.set('videoPreviewCutEnd', Math.max(time, cutStart + MIN_TRIM_DURATION));
        }
        appState.set('videoPreviewHasUnsavedChanges', true);
        this._renderTrimPositions();
    },

    /** Ứng với 'videoPreview.trimDrag.end' — bắn LIÊN TỤC (cùng lý do `handleTrimDragMove()`). */
    handleTrimDragEnd() { appState.set('videoPreviewActiveDrag', null); },

    /** Ứng với thanh kéo "current" (mục 2c) — chỉ xem khung hình tại thời điểm đó, KHÔNG phát.
     * @param {number} value */
    handleScrubInput(value) {
        appState.set('videoPreviewScrubTime', value);
        this._modalHandle.videoEl.currentTime = value;
        this._modalHandle.currentTimeLabelEl.textContent = _formatVideoPreviewTime(value);
    },

    // ===================== Crop (core/crop-selector.js, TÁI DÙNG NGUYÊN — dùng chung Photo Edit) =====================

    /** Preset tỉ lệ (1:1/9:19/2:3/3:4/Tự do). @param {number} ratio */
    handleCropRatioSelect(ratio) {
        const session = appState.get('videoPreviewCropSession');
        if (!session) return;
        setCropSessionAspectRatio(session, ratio); // core/crop-selector.js
        appState.set('videoPreviewHasUnsavedChanges', true);
        this._drawCropOverlay();
        this._renderRatioButtonsActiveState();
    },

    /** Nút đổi hướng ngang/dọc — đảo NGHỊCH ĐẢO tỉ lệ hiện tại (3:4 <-> 4:3). Vô nghĩa với Tự do
     * (NaN) hay 1:1 — guard clause thuần, không phải rẽ nhánh tiến trình khác (đổi hay không đổi
     * vẫn cùng 1 việc: gọi lại `setCropSessionAspectRatio()`). */
    handleCropRatioFlip() {
        const session = appState.get('videoPreviewCropSession');
        if (!session || Number.isNaN(session.aspectRatio) || session.aspectRatio === 1) return;
        setCropSessionAspectRatio(session, 1 / session.aspectRatio); // core/crop-selector.js
        appState.set('videoPreviewHasUnsavedChanges', true);
        this._drawCropOverlay();
        this._renderRatioButtonsActiveState();
    },

    /** Tô sáng nút preset khớp `session.aspectRatio` hiện tại (so `NaN` bằng `Number.isNaN()`). */
    _renderRatioButtonsActiveState() {
        const session = appState.get('videoPreviewCropSession');
        if (!session) return;
        this._modalHandle.ratioButtons.forEach(({ btn, ratio }) => {
            const matches = Number.isNaN(ratio) ? Number.isNaN(session.aspectRatio) : ratio === session.aspectRatio;
            btn.classList.toggle('is-active', matches);
        });
    },

    /** @param {{x:number,y:number}} pos */
    handleCropCanvasPointerDown(pos) {
        const session = appState.get('videoPreviewCropSession');
        if (!session) return;
        const scale = this._modalHandle.cropCanvasEl.width / (this._modalHandle.cropCanvasEl.getBoundingClientRect().width || 1);
        cropSessionPointerDown(session, pos, 30 * scale); // core/crop-selector.js
    },

    /** @param {{x:number,y:number}} pos */
    handleCropCanvasPointerMove(pos) {
        const session = appState.get('videoPreviewCropSession');
        if (!session || !session.activeHandle) return; // guard clause — không đang kéo handle nào
        this._moveOrResizeCropSession(pos);
        appState.set('videoPreviewHasUnsavedChanges', true);
        this._drawCropOverlay();
    },

    handleCropCanvasPointerUp() {
        const session = appState.get('videoPreviewCropSession');
        if (session) cropSessionPointerUp(session); // core/crop-selector.js
    },

    /** Đọc `session.activeHandle` rồi CHỌN gọi ĐÚNG 1 trong 3 hàm tính rect thuần của core/crop-
     * selector.js — việc CHỌN thuộc Workflow (Rule 1, đúng khuôn `_moveOrResizeCropSession()` cũ ở
     * event/workflow/video-editor.js/file-manager-photo.js). @param {{x:number,y:number}} pos */
    _moveOrResizeCropSession(pos) {
        const session = appState.get('videoPreviewCropSession');
        const s = session.dragStart;
        const dx = pos.x - s.x, dy = pos.y - s.y;
        const rect = this._modalHandle.cropCanvasEl.getBoundingClientRect();
        const scale = this._modalHandle.cropCanvasEl.width / (rect.width || 1);
        const minSize = 50 * scale;

        if (session.activeHandle === 'center') {
            session.rect = moveCropRect({ x: s.rx, y: s.ry, w: s.rw, h: s.rh }, dx, dy, session.sourceWidth, session.sourceHeight); // core/crop-selector.js
            return;
        }
        const flipX = session.activeHandle === 'tl' || session.activeHandle === 'bl';
        const flipY = session.activeHandle === 'tl' || session.activeHandle === 'tr';
        const startRect = { x: s.rx, y: s.ry, w: s.rw, h: s.rh };
        session.rect = Number.isNaN(session.aspectRatio)
            ? computeFreeResizedRect(startRect, flipX, flipY, dx, dy, minSize, session.sourceWidth, session.sourceHeight) // core/crop-selector.js
            : computeRatioLockedResizedRect(startRect, flipX, flipY, dx, session.aspectRatio, minSize, session.sourceWidth, session.sourceHeight); // core/crop-selector.js
    },

    _drawCropOverlay() {
        const session = appState.get('videoPreviewCropSession');
        if (!session) return;
        const canvas = this._modalHandle.cropCanvasEl;
        const scale = canvas.width / (canvas.getBoundingClientRect().width || 1);
        drawCropSessionOverlay(canvas.getContext('2d'), session, canvas.width, canvas.height, scale); // core/crop-selector.js
    },

    // ===================== Xoay / Reset =====================

    handleRotateLeft() { appState.set('videoPreviewRotateDeg', ((appState.get('videoPreviewRotateDeg') - 90) % 360 + 360) % 360); appState.set('videoPreviewHasUnsavedChanges', true); },
    handleRotateRight() { appState.set('videoPreviewRotateDeg', (appState.get('videoPreviewRotateDeg') + 90) % 360); appState.set('videoPreviewHasUnsavedChanges', true); },

    /** Về mặc định: Crop full-frame (KHÔNG crop) + Rotate 0 + Cắt = toàn bộ video. */
    handleReset() {
        const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
        appState.set('videoPreviewCropSession', initCropSession(w, h, { padRatio: 0 })); // core/crop-selector.js
        appState.set('videoPreviewRotateDeg', 0);
        appState.set('videoPreviewCutStart', 0);
        appState.set('videoPreviewCutEnd', appState.get('videoPreviewSourceDuration'));
        appState.set('videoPreviewHasUnsavedChanges', true);
        this._drawCropOverlay();
        this._renderRatioButtonsActiveState();
        this._renderTrimPositions();
    },

    // ===================== Trích xuất ảnh (core/video-editor/frame-extract.js, TÁI DÙNG NGUYÊN) =====================

    async handleExtractFrame() {
        const sourceCanvas = captureVideoFrameToCanvas(this._modalHandle.videoEl); // core/video-editor/frame-extract.js
        const blob = await new Promise((resolve) => sourceCanvas.toBlob(resolve, 'image/jpeg', 0.95));
        if (!blob) { await alertModal(t('videoPreview.extractFrame.failed')); return; }
        const thumbBlob = await buildExtractedPhotoThumbnail(sourceCanvas, 0.2); // core/video-editor/frame-extract.js
        const filename = `${buildExtractedPhotoFilename()}.jpg`; // core/video-editor/frame-extract.js
        await saveImage(blob, filename, thumbBlob, sourceCanvas.width, sourceCanvas.height); // core/file-manager/image.js
        await alertModal(t('videoPreview.extractFrame.success'));
    },

    // ===================== Lưu (dropdown Lưu đè/Lưu mới) =====================

    /** @param {HTMLElement} anchorEl */
    handleSaveClick(anchorEl) {
        openDropdownMenu(anchorEl, [ // core/dropdown-menu.js
            { icon: _videoPreviewIcon('overwrite'), name: t('videoPreview.save.overwrite'), callback: () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.saveOverwrite.click', payload: {} }) },
            { icon: _videoPreviewIcon('saveAsNew'), name: t('videoPreview.save.asNew'), callback: () => eventBus.send({ router: 'videoPreview', type: 'videoPreview.saveAsNew.click', payload: {} }) },
        ], { zIndex: Z_INDEX.VIDEO_PREVIEW_MENU }); // service/z-index.js
    },

    /** Quy đổi `session.rect` hiện tại ra tỉ lệ 0-1 — trả `null` nếu ĐÚNG bằng full-frame (chưa
     * chỉnh gì, kể cả trường hợp mặc định `padRatio:0` lúc mở modal) để `processVideo()` nhận biết
     * "không crop" (guard clause bỏ qua bước decode/re-encode nếu mọi thứ khác cũng không đổi). */
    _computeCropFraction() {
        const session = appState.get('videoPreviewCropSession');
        if (!session) return null;
        const rect = getCropSessionRect(session); // core/crop-selector.js
        const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
        const isFullFrame = rect.x <= 0 && rect.y <= 0 && rect.w >= w && rect.h >= h;
        if (isFullFrame) return null;
        return { x: rect.x / w, y: rect.y / h, w: rect.w / w, h: rect.h / h };
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
        tmp.src = URL.createObjectURL(blob);
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
            await setVideoRecord(appState.get('videoPreviewVideoKey'), { blob, thumbBlob, width, height, duration, filename: record.filename, addedAt: record.addedAt }); // service/db.js
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
            await saveVideo(blob, filename, thumbBlob, width, height, duration); // core/file-manager/video.js
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
        if (this._modalHandle) { this._modalHandle.close(); this._modalHandle = null; }
        appState.set('videoPreviewVideoKey', null);
        appState.set('videoPreviewRecord', null);
        appState.set('videoPreviewCropSession', null);
        appState.set('videoPreviewActiveDrag', null);
        appState.set('videoPreviewFilmstripFrames', []);
    },
};
