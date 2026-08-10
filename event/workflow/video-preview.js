/**
 * event/workflow/video-preview.js — Router "videoPreview". Modal xem/sửa Video: Cut (dải phim + 2
 * tay cầm + playhead) LUÔN hiện, mặc định; Crop là TOGGLE độc lập chạy song song (không loại trừ
 * Cut); Zoom-pan (Panzoom trên chính videoEl) luôn sống, không thuộc mode nào.
 *
 * `open()` bọc TOÀN BỘ trong `withLoadingShield()` (core/loading-shield-util.js) — chỉ tắt shield
 * SAU KHI modal đã dựng xong VÀ đã có metadata thật (crop/trim/zoom-pan sẵn sàng tương tác), không
 * chỉ sau khi DOM append xong.
 *
 * `this._modalHandle`/`this._beforeCropSnapshot`/`this._resolveMetadataReady` giữ TRỰC TIẾP trên
 * object Workflow (KHÔNG qua appState — không phải dữ liệu nghiệp vụ tuần tự hoá được).
 *
 * SỬA (05/08/2026, đợt 5, phản hồi Giang):
 * - MỤC 1 — "loại bỏ toàn bộ tính năng undo/redo, giữ nút reset [+ cảnh báo]": bỏ hẳn
 *   `videoPreviewHistorySession`/`core/edit-history.js` (KHÔNG còn Workflow nào dùng file đó nữa —
 *   RÁC, đề nghị Giang tự xoá `core/edit-history.js` + dòng `<script>` tương ứng trong index.html đã
 *   gỡ sẵn ở patch này). `_buildSnapshot()`/`_applySnapshot()` VẪN GIỮ — phục vụ RIÊNG cơ chế khôi
 *   phục lúc Huỷ Crop (`_beforeCropSnapshot`, KHÔNG phải Undo/Redo, xem comment tại đó). Reset giờ
 *   bắt buộc qua `modalChoice()` xác nhận trước khi chạy — trước đó KHÔNG hề có bước xác nhận nào.
 * - MỤC 2 — "zoom-pan kéo ra bị 'phóng to/thu nhỏ kích thước' chứ không 'zoom' như ảnh": so với
 *   Photo Edit (nơi Panzoom chạy ĐÚNG, xem `core/file-manager/photo-ui.js::openImagePreviewModal()`
 *   → `.photo-preview-image`, `position:absolute; inset:0`), tìm ra 2 khác biệt CỤ THỂ, đã sửa cả 2
 *   (CHƯA có cách tự kiểm chứng lại trên máy thật — cần Giang xác nhận):
 *   (a) `initPanzoomSession(videoEl, ...)` TRƯỚC ĐÂY gọi trong lúc `videoEl` VẪN CÒN class `hidden`
 *       (`display:none`) — `getBoundingClientRect()` của phần tử `display:none` LUÔN trả về
 *       `{0,0,0,0}`, khiến Panzoom đo kích thước SAI ngay lúc khởi tạo (`contain:'outside'` cần đo
 *       đúng để tính giới hạn pan/zoom) — giờ dời xuống SAU dòng gỡ `hidden`.
 *   (b) `videoEl`/`posterEl` TRƯỚC ĐÂY là block tĩnh thường (`w-full h-full`, KHÔNG `position:
 *       absolute`) — khác `.photo-preview-image` (`position:absolute; inset:0`, pin cứng theo khung
 *       chứa). Đã thêm `absolute inset-0` cho cả 2 (xem components/video-preview.js) — khớp tuyệt
 *       đối cách Photo Edit đang chạy đúng.
 *
 * NẠP SAU: core/file-manager/video-ui.js, core/media-transform.js (gộp crop-selector.js +
 * image-zoom.js + cycleRotation(), 04/08/2026), core/video-editor/compat-guard.js/filmstrip.js/
 * webcodecs-engine.js, core/video-player-capture.js, core/file-manager/video.js/image.js, service/state/
 * video-preview.js, service/blob-url.js, event/workflow/media-transform-helpers.js (đổi tên từ
 * crop-ratio-helpers.js).
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
    _beforeCropSnapshot: null, // snapshot lúc bật Crop — khôi phục nếu bấm Huỷ (RIÊNG, không phải Undo/Redo — mục đó đã bỏ hẳn 05/08/2026)
    _resolveMetadataReady: null,
    _dragResumePlay: false, // SỬA (05/08/2026, mục 6) — nhớ lại video đang play hay pause TRƯỚC khi kéo tay cầm/tua, để nhả tay cầm KHÔNG tự auto-play nếu trước đó đang pause

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
            appState.set('videoPreviewFlipH', false);
            appState.set('videoPreviewHasUnsavedChanges', false);
            appState.set('videoPreviewFilmstripFrames', []);
            appState.set('videoPreviewCropSession', null);
            appState.set('videoPreviewActiveDrag', null);
            appState.set('videoPreviewCropVisible', false);
            appState.set('videoPreviewZoomPanSession', null);
            appState.set('videoPreviewIsPlaying', false);

            const metadataReadyPromise = new Promise((resolve) => { this._resolveMetadataReady = resolve; });
            this._modalHandle = openVideoPreviewModal({ videoUrl, posterUrl, filename: record.filename, ratioPresets }); // core/file-manager/video-ui.js

            await metadataReadyPromise; // shield chỉ tắt sau khi crop/trim/zoom-pan đã dựng xong
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

        // Chuyển từ poster tĩnh sang video thật (đứng yên tại khung hình 0 — KHÔNG auto-play) TRƯỚC
        // khi init Panzoom (mục 2, phản hồi Giang — BUG THẬT: init lúc `videoEl` còn `display:none`
        // khiến `getBoundingClientRect()` đo ra {0,0,0,0}, Panzoom tính sai giới hạn zoom/pan ngay từ
        // đầu — xem docstring đầu file).
        this._modalHandle.posterEl.classList.add('hidden');
        this._modalHandle.videoEl.classList.remove('hidden');

        const zoomPanSession = initPanzoomSession(videoEl, { maxScale: 4, minScale: 1, contain: 'outside', cursor: 'default' }); // core/media-transform.js — luôn sống, không thuộc mode nào
        appState.set('videoPreviewZoomPanSession', zoomPanSession);

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

    /** @param {string} handle - 'start' | 'end' */
    handleTrimDragStart(handle) {
        this._dragResumePlay = appState.get('videoPreviewIsPlaying'); // nhớ lại TRƯỚC khi pause (mục 6)
        appState.set('videoPreviewActiveDrag', handle);
        this._modalHandle.videoEl.pause();
        appState.set('videoPreviewIsPlaying', false);
    },

    /** Ấn/tua trong dải phim (NGOÀI 2 tay cầm Start/End) — nhảy playhead tới đó ngay, kéo tiếp thì
     * tua tiếp (mục 7, phản hồi Giang). Bắn TỪ `filmstripTrackEl` nên bubbling qua CẢ click trên tay
     * cầm Start/End (do 2 tay cầm là con của track) — Workflow tự đọc `videoPreviewActiveDrag` đã bị
     * handler của tay cầm (chạy TRƯỚC, cùng sự kiện pointerdown) chiếm chưa để bỏ qua, KHÔNG tua đè.
     * @param {number} clientX */
    handleTrimTrackPointerDown(clientX) {
        if (appState.get('videoPreviewActiveDrag')) return; // tay cầm Start/End đã xử lý trước đó rồi
        this._dragResumePlay = appState.get('videoPreviewIsPlaying');
        appState.set('videoPreviewActiveDrag', 'seek');
        this._modalHandle.videoEl.pause();
        appState.set('videoPreviewIsPlaying', false);
        this._seekToClientX(clientX);
    },

    /** @param {number} clientX */
    _seekToClientX(clientX) {
        const duration = appState.get('videoPreviewSourceDuration');
        const cutStart = appState.get('videoPreviewCutStart'), cutEnd = appState.get('videoPreviewCutEnd');
        const rect = this._modalHandle.filmstripTrackEl.getBoundingClientRect();
        const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / (rect.width || 1)));
        const time = Math.max(cutStart, Math.min(cutEnd, fraction * duration)); // giới hạn trong đoạn đang cắt, khớp hành vi lặp ở handleVideoTimeUpdate
        this._modalHandle.videoEl.currentTime = time;
        this._renderPlayheadPosition(time);
    },

    /** @param {number} clientX */
    handleTrimDragMove(clientX) {
        const activeDrag = appState.get('videoPreviewActiveDrag');
        if (!activeDrag) return; // bắn liên tục từ document, guard bình thường
        if (activeDrag === 'seek') { this._seekToClientX(clientX); return; }

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
        const activeDrag = appState.get('videoPreviewActiveDrag');
        appState.set('videoPreviewActiveDrag', null);
        if (!activeDrag) return;
        if (activeDrag !== 'seek') appState.set('videoPreviewHasUnsavedChanges', true); // tua thuần không phải thao tác sửa
        if (this._dragResumePlay) { // CHỈ tự play lại nếu TRƯỚC đó đang play (mục 6 — không còn auto-play mặc định)
            this._modalHandle.videoEl.play().catch(() => {});
            appState.set('videoPreviewIsPlaying', true);
        }
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

    /** Chuỗi CSS transform xoay + lật ngang hiện tại + hệ số scale bù (90°/270°) — DÙNG CHUNG cho
     * `<video>` (`_renderTransformPreview()`) VÀ `cropCanvasEl` (`_syncCropCanvasBox()`) khi Crop
     * đang mở, để 2 phần tử biến đổi Y HỆT nhau quanh CÙNG 1 tâm (mục "xoay + crop", phản hồi Giang
     * 05/08/2026, đợt 5). Rotate/Flip/Reset đều nằm trong `toolsGroupEl` — bị ẨN suốt lúc Crop đang
     * mở (đổi chỗ cho `ratioGroupEl`, xem `_enterCropVisible()`), nên `videoPreviewRotateDeg`/
     * `videoPreviewFlipH` LUÔN cố định suốt 1 phiên Crop, không cần tính lại giữa chừng khi đang kéo.
     *
     * THỨ TỰ ghép chuỗi CỐ Ý: `rotate(deg) scale(fit) scaleX(-1)` — CSS áp phần tử BÊN PHẢI trước
     * (flip áp lên nội dung GỐC trước), rồi mới xoay cả kết quả đó — tức Flip định nghĩa theo hướng
     * GỐC video, xoay xảy ra SAU, khớp cách các app ảnh/video khác vẫn làm. `_toCropCanvasCoords()`
     * quy đổi NGƯỢC phải lột đúng thứ tự này (xoay trước, flip sau).
     * @returns {{transform: string, deg: number, scale: number, flipH: boolean}} */
    _getRotateTransform() {
        const deg = appState.get('videoPreviewRotateDeg');
        const flipH = appState.get('videoPreviewFlipH');
        const flipPart = flipH ? ' scaleX(-1)' : '';
        if (deg === 90 || deg === 270) {
            const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
            const wrapRect = this._modalHandle.mediaWrapEl.getBoundingClientRect();
            const fitBefore = Math.min(wrapRect.width / w, wrapRect.height / h);
            const fitAfter = Math.min(wrapRect.width / h, wrapRect.height / w);
            const scale = fitAfter / fitBefore;
            return { transform: `rotate(${deg}deg) scale(${scale})${flipPart}`, deg, scale, flipH };
        }
        return { transform: (deg === 180 ? 'rotate(180deg)' : '') + flipPart, deg, scale: 1, flipH };
    },

    /** Tính lại + đặt CSS `cropCanvasEl` khớp TUYỆT ĐỐI vùng ảnh THẬT đang hiển thị của `<video
     * object-contain>` (không phải khung layout của nó), CỘNG áp CÙNG 1 transform xoay/scale với
     * `<video>` (mục "xoay + crop") — canvas được đặt/tính TRƯỚC khi xoay (khớp hướng gốc video),
     * transform lo phần xoay/co dãn giống hệt video nên 2 bên luôn khớp nhau ở BẤT KỲ góc nào, không
     * cần tính lại `session.rect` theo hướng đã xoay (vẫn nguyên hệ toạ độ pixel gốc, xem
     * `_toCropCanvasCoords()` lo phần quy đổi ngược).
     *
     * SỬA (05/08/2026, phản hồi Giang đợt 4) — BUG THẬT #2 trong 2 bug độc lập với layout (Giang chỉ
     * ra: chọn tỉ lệ co nhỏ nằm giữa màn hình, cách xa header/dải cắt, vẫn không kéo được — tức
     * KHÔNG PHẢI do chồng lấn). Bản CŨ dùng thẳng `videoEl.getBoundingClientRect()` — SAI, vì
     * `object-contain` KHÔNG đổi kích thước layout của phần tử, chỉ đổi cách ảnh VẼ BÊN TRONG khung
     * đó — `getBoundingClientRect()` trả về khung LAYOUT (ở đây luôn bằng `mediaWrapEl` do class
     * `w-full h-full`), KHÔNG trừ phần letterbox đen 2 bên/trên-dưới khi tỉ lệ video khác tỉ lệ
     * container. Canvas vì vậy có thể bị đặt to/lệch hơn vùng pixel video thật đang hiển thị, khiến
     * phép quy đổi toạ độ ở `_toCropCanvasCoords()` (dựa 1 hệ số `scale` DUY NHẤT theo bề rộng) sai
     * theo trục còn lại — tự tính lại bằng công thức `object-contain` chuẩn (so khung chứa với tỉ lệ
     * native W/H) thay vì tin `getBoundingClientRect()` của chính `<video>`.
     *
     * Gọi lại mỗi lần vào Crop — CHƯA xử lý resize/xoay MÀN HÌNH giữa chừng (nợ kỹ thuật nhỏ, ít gặp
     * trên mobile PWA đang mở modal). */
    _syncCropCanvasBox() {
        const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
        const canvas = this._modalHandle.cropCanvasEl;
        const wrapRect = this._modalHandle.mediaWrapEl.getBoundingClientRect();
        const containerRatio = wrapRect.width / (wrapRect.height || 1);
        const videoRatio = w / (h || 1);
        let boxW, boxH;
        if (videoRatio > containerRatio) { boxW = wrapRect.width; boxH = boxW / videoRatio; } // video "nằm ngang" hơn container — khít theo bề rộng, letterbox trên/dưới
        else { boxH = wrapRect.height; boxW = boxH * videoRatio; } // video "đứng" hơn container — khít theo chiều cao, letterbox 2 bên
        canvas.style.position = 'absolute';
        canvas.style.left = `${(wrapRect.width - boxW) / 2}px`;
        canvas.style.top = `${(wrapRect.height - boxH) / 2}px`;
        canvas.style.width = `${boxW}px`;
        canvas.style.height = `${boxH}px`;
        canvas.style.transform = this._getRotateTransform().transform; // đồng bộ y hệt video đang xoay (nếu có)
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
        if (apply) { appState.set('videoPreviewHasUnsavedChanges', true); } else { this._applySnapshot(this._beforeCropSnapshot); }
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

    _renderRatioButtonsActiveState() {
        const session = appState.get('videoPreviewCropSession');
        this._modalHandle.ratioButtons.forEach(({ btn, ratio }) => {
            const matches = Number.isNaN(ratio) ? Number.isNaN(session.aspectRatio) : ratio === session.aspectRatio;
            btn.classList.toggle('is-active', matches);
        });
        this._renderFlipButtonState();
    },

    /** Đồng bộ trạng thái "đang bật" (viền/nền sáng) cho CẢ 2 nút Flip — `toolsGroupEl.flipBtn` (hiện
     * lúc thường) VÀ `ratioGroupEl.ratioFlipBtn` (hiện lúc đang Crop) — cùng phản ánh 1 state DUY
     * NHẤT `videoPreviewFlipH` (mục "flip lật cả ảnh/video", phản hồi Giang 05/08/2026, đợt 6 —
     * TRƯỚC ĐÓ `ratioFlipBtn` làm việc KHÁC hẳn — đảo tỉ lệ khung Crop (`applyFlip()`,
     * event/workflow/media-transform-helpers.js — giờ KHÔNG còn nơi nào gọi, RÁC, đề nghị Giang tự
     * xoá hàm đó) — Giang chỉ ra "flip" phải lật CẢ ảnh/video, không phải riêng crop, nên 2 nút giờ
     * bắn CHUNG 1 event `videoPreview.flip.click` → `handleFlipClick()`, xem core/file-manager/
     * video-ui.js). */
    _renderFlipButtonState() {
        const active = appState.get('videoPreviewFlipH');
        this._modalHandle.flipBtn.classList.toggle('is-active', active);
        this._modalHandle.ratioFlipBtn.classList.toggle('is-active', active);
    },

    /** Quy đổi toạ độ màn hình -> toạ độ canvas (px nguồn, CHƯA xoay/lật) — dùng chung cho pointerDown/
     * Move VÀ `_moveOrResizeCropSession()` (tránh lặp lại phép tính `scale` ở nhiều chỗ).
     *
     * SỬA (05/08/2026, đợt 5) — thêm bù NGƯỢC Flip ngang (mục 4, phản hồi Giang). Thứ tự lột NGƯỢC
     * đúng thứ tự đã áp ở `_getRotateTransform()` (rotate(deg) scale(fit) scaleX(-1) — flip áp
     * TRƯỚC/trong cùng, rotate áp SAU/ngoài cùng): lột rotate/scale trước (như cũ), lột flip SAU
     * CÙNG (đối xứng X quanh tâm — tự nghịch đảo, chỉ cần đảo dấu `dx` 1 lần).
     * @param {number} clientX @param {number} clientY @returns {{x:number,y:number}} */
    _toCropCanvasCoords(clientX, clientY) {
        const canvas = this._modalHandle.cropCanvasEl;
        const rect = canvas.getBoundingClientRect(); // bbox SAU transform — chỉ dùng để lấy TÂM
        const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
        let dx = clientX - centerX, dy = clientY - centerY;

        const { deg, scale, flipH } = this._getRotateTransform();
        if (deg) {
            const rad = (-deg * Math.PI) / 180; // xoay NGƯỢC lại góc đã áp cho canvas
            const cos = Math.cos(rad), sin = Math.sin(rad);
            const rx = dx * cos - dy * sin, ry = dx * sin + dy * cos;
            dx = rx / scale; dy = ry / scale; // co dãn NGƯỢC lại
        }
        if (flipH) dx = -dx; // lột Flip SAU CÙNG (đối xứng quanh tâm, tự nghịch đảo)

        const boxW = canvas.offsetWidth || 1, boxH = canvas.offsetHeight || 1; // kích thước CSS GỐC, transform không đổi
        const pxScale = canvas.width / boxW; // canvas.width/height vuông tỉ lệ với offsetWidth/Height (cùng đặt trong _syncCropCanvasBox)
        return { x: (dx + boxW / 2) * pxScale, y: (dy + boxH / 2) * pxScale };
    },

    /** @param {number} clientX @param {number} clientY */
    handleCropCanvasPointerDown(clientX, clientY) {
        const session = appState.get('videoPreviewCropSession');
        const canvas = this._modalHandle.cropCanvasEl;
        const scale = canvas.width / (canvas.offsetWidth || 1); // offsetWidth — KHÔNG dùng getBoundingClientRect() (bbox bị tráo cạnh khi xoay 90°/270°)
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
        if (wasDragging) appState.set('videoPreviewHasUnsavedChanges', true);
    },

    /** @param {{x:number,y:number}} pos */
    _moveOrResizeCropSession(pos) {
        const session = appState.get('videoPreviewCropSession');
        const s = session.dragStart;
        const dx = pos.x - s.x, dy = pos.y - s.y;
        const scale = this._modalHandle.cropCanvasEl.width / (this._modalHandle.cropCanvasEl.offsetWidth || 1); // offsetWidth — KHÔNG dùng getBoundingClientRect() (bbox bị tráo cạnh khi xoay 90°/270°)
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
        const scale = canvas.width / (canvas.offsetWidth || 1); // offsetWidth — KHÔNG dùng getBoundingClientRect() (bbox bị tráo cạnh khi xoay 90°/270°)
        drawCropSessionOverlay(canvas.getContext('2d'), session, canvas.width, canvas.height, scale); // core/media-transform.js
    },

    // ===================== Rotate / Flip / Reset =====================

    /** Xoay tới góc kế tiếp (0→90→180→270→0...) — nút DUY NHẤT, không còn tách trái/phải. */
    handleRotateClick() {
        appState.set('videoPreviewRotateDeg', cycleRotation(appState.get('videoPreviewRotateDeg'))); // core/media-transform.js
        this._renderTransformPreview();
        appState.set('videoPreviewHasUnsavedChanges', true);
    },

    /** Lật ngang (mục 4, phản hồi Giang — "không có nút lật trái phải trên toolbar", KHÁC nút Flip
     * trong `ratioGroupEl` chỉ đảo CHIỀU khung Crop chứ không lật NỘI DUNG video). */
    handleFlipClick() {
        appState.set('videoPreviewFlipH', !appState.get('videoPreviewFlipH'));
        this._renderTransformPreview();
        this._renderFlipButtonState();
        appState.set('videoPreviewHasUnsavedChanges', true);
    },

    /** Áp CSS xoay + lật LIVE lên `<video>` ngay trong modal (mục 3 cũ — trước đây bấm Xoay không
     * thấy gì đổi cho tới khi Lưu/mở lại). Dùng chung `_getRotateTransform()` với
     * `_syncCropCanvasBox()` — CHỈ gọi được khi Crop đang ĐÓNG trên thực tế (nút Rotate/Flip nằm
     * trong `toolsGroupEl`, bị ẩn suốt lúc Crop mở), nên không cần tự đồng bộ lại canvas ở đây. */
    _renderTransformPreview() {
        this._modalHandle.videoEl.style.transform = this._getRotateTransform().transform;
    },

    /** Bấm Reset — PHẢI xác nhận trước khi chạy (mục 1, phản hồi Giang: "loại bỏ toàn bộ Undo/Redo,
     * giữ nút reset và cảnh báo modal") — TRƯỚC ĐÂY reset chạy NGAY không hỏi gì, chấp nhận được vì
     * còn Undo cứu lại; giờ không còn đường lùi nào khác nên bắt buộc hỏi trước. */
    handleReset() {
        modalChoice( // core/modal-choice.js
            t('videoPreview.resetConfirm.desc'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('videoPreview.resetConfirm.confirm'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: () => this._reallyReset() },
            ],
            { title: t('videoPreview.resetConfirm.title') }
        );
    },

    _reallyReset() {
        const w = appState.get('videoPreviewNativeW'), h = appState.get('videoPreviewNativeH');
        const cropSession = appState.get('videoPreviewCropSession');
        setCropSessionRect(cropSession, { x: 0, y: 0, w, h }); // core/media-transform.js
        cropSession.aspectRatio = NaN;
        appState.set('videoPreviewRotateDeg', 0);
        appState.set('videoPreviewFlipH', false);
        appState.set('videoPreviewCutStart', 0);
        appState.set('videoPreviewCutEnd', appState.get('videoPreviewSourceDuration'));
        const zoomPanSession = appState.get('videoPreviewZoomPanSession');
        resetPanzoomSession(zoomPanSession); // core/media-transform.js
        this._renderTransformPreview();
        this._drawCropOverlay();
        this._renderTrimPositions();
        this._renderRatioButtonsActiveState();
        appState.set('videoPreviewHasUnsavedChanges', true);
    },

    /** @returns {object} snapshot — crop rect/tỉ lệ + rotate + flip + cut + zoom-pan hiện tại. DÙNG
     * RIÊNG cho khôi phục lúc Huỷ Crop (`_beforeCropSnapshot`, xem `_enterCropVisible()`/
     * `_exitCropVisible()`) — KHÔNG còn liên quan Undo/Redo (đã bỏ hẳn, mục 1 phản hồi Giang). */
    _buildSnapshot() {
        const cropSession = appState.get('videoPreviewCropSession');
        const zoomPanSession = appState.get('videoPreviewZoomPanSession');
        return {
            cropRect: getCropSessionRect(cropSession), aspectRatio: cropSession.aspectRatio, // core/media-transform.js
            rotateDeg: appState.get('videoPreviewRotateDeg'),
            flipH: appState.get('videoPreviewFlipH'),
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
        appState.set('videoPreviewFlipH', snapshot.flipH);
        appState.set('videoPreviewCutStart', snapshot.cutStart);
        appState.set('videoPreviewCutEnd', snapshot.cutEnd);
        const zoomPanSession = appState.get('videoPreviewZoomPanSession');
        zoomPanSession.zoom(snapshot.zoomPan.scale, { animate: false });
        zoomPanSession.pan(snapshot.zoomPan.x, snapshot.zoomPan.y, { animate: false });
        this._renderTransformPreview();
        this._drawCropOverlay();
        this._renderTrimPositions();
        this._renderRatioButtonsActiveState();
        appState.set('videoPreviewHasUnsavedChanges', true);
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
            flipH: appState.get('videoPreviewFlipH'), // mục 4, phản hồi Giang — core/video-editor/webcodecs-engine.js áp lúc XUẤT file
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
        const thumbBlob = await buildExtractedPhotoThumbnail(canvas, 0.2); // core/video-player-capture.js
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
        appState.set('videoPreviewIsPlaying', false);
    },
};
