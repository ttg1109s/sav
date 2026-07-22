/**
 * event/workflow/video-editor.js — Workflow DUY NHẤT của trang `video-editor.html` (KHÔNG nạp ở
 * `index.html`, chạy như 1 trang độc lập — cùng kiến trúc `image-edit.html`/`subtitle-editor.html`,
 * xem docstring `event/workflow/image-edit.js` cho chi tiết luồng điều hướng gốc).
 *
 * GIAO TIẾP với trang chính: KHÔNG postMessage — cùng origin `file://`, đọc/ghi CHUNG 1 IndexedDB
 * qua `service/db.js`. Trang chính điều hướng sang đây bằng `window.location.href =
 * 'video-editor.html?video=<key mã hoá>'` (`event/workflow/file-manager-video.js::
 * navigateToVideoEdit()`, tái dùng `encodeSongKeyForUrl()`).
 *
 * State RIÊNG sống trong object này (trang KHÔNG dùng `appState`/`service/state.js`, cùng lý do
 * `image-edit.html`).
 *
 * PHẠM VI BATCH 1: Crop + Rotate (90°) + Filter màu (brightness/contrast/saturation). CHƯA có nút
 * Lưu (Batch 4) — mọi chỉnh sửa ở đây chỉ là STATE + PREVIEW (CSS transform/filter trên thẻ
 * `<video>`), CHƯA "nướng" thành file thật. `core/video-editor/webcodecs-engine.js::processVideo()`
 * đã viết sẵn đầy đủ (sẽ được gọi ở Batch 4 lúc bấm Lưu) — Batch này CHƯA gọi tới nó.
 *
 * LỆCH NHỎ so với kế hoạch đã báo Giang: filter/crop UI KHÔNG tách riêng thành `core/video-editor/
 * video-filter-ui.js`/`crop-ui.js` — gộp thẳng vào Workflow này, ĐÚNG theo tiền lệ thật của
 * `image-edit.js` (trang độc lập nhỏ, mọi thao tác UI sống trong Workflow, Rule 5 (core-function-
 * conventions.md) chỉ áp cho file trong `core/`, không áp cho Workflow) — không mất tính "riêng,
 * không dùng chung với ảnh" vì code viết hoàn toàn mới, không gọi bất kỳ gì từ
 * `core/file-manager/image.js`/`event/workflow/image-edit.js`.
 *
 * Crop dùng lại THƯ VIỆN Cropper.js (CDN đã có sẵn cho image-edit.html) trên 1 khung hình TĨNH chụp
 * từ video tại `currentTime` — Cropper.js không chạy trực tiếp trên `<video>`. Kết quả lưu dạng TỈ
 * LỆ (0-1, không phải px) để không phụ thuộc kích thước hiển thị.
 *
 * PHẠM VI BATCH 2 (MỚI): Cut (kéo thả 2 tay cầm hình chữ nhật đứng trên dải filmstrip — GIỐNG
 * phần mềm biên tập video mobile, phản hồi Giang "cần gì dùng audio, dùng chính video/kéo hình chữ
 * nhật đứng" — THAY HẲN bản đầu dùng `core/time-picker-modal.js`/WaveSurfer, cả 2 đều bị bác vì
 * không cho thấy NỘI DUNG hình ảnh tại điểm cắt) + Trích xuất ảnh (chụp khung hình hiện tại, lưu
 * THẲNG vào IndexedDB store 'images' qua `core/file-manager/image.js::saveImage()` — KHÔNG qua
 * Save/engine, xuất tức thì, không chờ Batch 4). `core/video-editor/webcodecs-engine.js::
 * processVideo()` đã nhận thêm tham số `cutRange` (sẽ dùng ở Batch 4 lúc bấm Lưu, giống crop/
 * rotate/filter — CHƯA gọi ở batch này).
 *
 * NẠP SAU: core/video-editor/compat-guard.js, core/video-editor/frame-extract.js,
 * core/video-editor/filmstrip.js, core/file-manager/image.js, service/db.js,
 * service/song-key-cipher.js, lang/lang.js, Cropper.js (CDN), DOM tĩnh của video-editor.html
 * (event/listener/video-editor.js khai const tham chiếu NGAY ĐẦU file đó — trang nhỏ, không cần
 * dom-refs.js riêng).
 */
const workflowVideoEditor = {
    _videoKey: null,
    _record: null,
    _cropper: null,
    _cropFraction: null, // {x,y,w,h} tỉ lệ 0-1, null = không crop
    _rotateDeg: 0, // 0/90/180/270
    _cutRange: null, // {start,end} giây, null = giữ nguyên toàn bộ — MỚI (Batch 2)
    _cutDraftStart: 0, // MỚI (Batch 2) — giá trị ĐANG chỉnh trong overlay Cut, chỉ ghi vào _cutRange lúc bấm "Xong"
    _cutDraftEnd: 0,
    _hasUnsavedChanges: false,

    /** Chạy 1 LẦN lúc trang load xong (xem event/listener/video-editor.js). */
    async init() {
        const encoded = new URLSearchParams(window.location.search).get('video');
        const videoKey = encoded ? decodeSongKeyFromUrl(encoded) : null; // service/song-key-cipher.js
        if (!videoKey) { this._showFatalError(t('videoEdit.invalidLink')); return; }

        const record = await getVideoRecord(videoKey); // data layer (service/db.js)
        if (!record) { this._showFatalError(t('videoEdit.videoNotFound')); return; }

        await window._mediabunnyLoadPromise; // MỚI — chờ loader thử xong toàn bộ URL CDN (xem video-editor.html) TRƯỚC khi kiểm tra compat, tránh nhầm "chưa tải xong" thành "không tải được"
        const compat = await checkVideoEditorCompat(record.blob); // core/video-editor/compat-guard.js
        if (!compat.supported) { this._showFatalError(t(`videoEdit.compat.${compat.reason}`)); return; }

        this._videoKey = videoKey;
        this._record = record;
        videoEditorTitleEl.textContent = record.filename || videoKey;
        const objectUrl = URL.createObjectURL(record.blob);
        videoEditorSourceEl.src = objectUrl;
        videoEditorSourceEl.addEventListener('loadedmetadata', () => this._applyRotatePreview(), { once: true });
        this._updateCropBadge();
        this._updateCutBadge();
    },

    _showFatalError(message) {
        videoEditorTitleEl.textContent = t('videoEdit.errorTitle') || '';
        videoEditorFatalErrorEl.textContent = message;
        videoEditorFatalErrorEl.classList.remove('hidden');
        videoEditorSourceEl.classList.add('hidden');
    },

    // ===================== Filter màu (brightness/contrast/saturation) =====================

    _currentFilterCss() {
        return `brightness(${sliderVeBrightness.value}%) contrast(${sliderVeContrast.value}%) saturate(${sliderVeSaturation.value}%)`;
    },

    _applyFilterPreview() {
        videoEditorSourceEl.style.filter = this._currentFilterCss();
    },

    handleSliderChange() {
        this._applyFilterPreview();
        this._hasUnsavedChanges = true;
    },

    // ===================== Rotate (90° trái/phải) =====================

    /** Tính scale để khung hình ĐÃ XOAY vừa khít vùng preview (đổi chiều rộng/cao khi 90°/270°) rồi
     * áp `transform` lên thẻ `<video>` — CHỈ preview, kích thước THẬT sau xoay được tính lại đúng ở
     * `core/video-editor/webcodecs-engine.js` lúc xuất file (Batch 4), không phụ thuộc hàm này. */
    _applyRotatePreview() {
        const v = videoEditorSourceEl;
        const vw = v.videoWidth || 16;
        const vh = v.videoHeight || 9;
        const isSideways = this._rotateDeg === 90 || this._rotateDeg === 270;
        const dispW = isSideways ? vh : vw;
        const dispH = isSideways ? vw : vh;
        const wrapRect = videoEditorPreviewWrapEl.getBoundingClientRect();
        const scale = Math.min(wrapRect.width / dispW, wrapRect.height / dispH) || 1;
        v.style.position = 'absolute';
        v.style.top = '50%';
        v.style.left = '50%';
        v.style.width = `${vw}px`;
        v.style.height = `${vh}px`;
        v.style.transformOrigin = 'center center';
        v.style.transform = `translate(-50%, -50%) rotate(${this._rotateDeg}deg) scale(${scale})`;
    },

    handleRotateLeft() {
        this._rotateDeg = ((this._rotateDeg - 90) % 360 + 360) % 360;
        this._hasUnsavedChanges = true;
        this._applyRotatePreview();
    },

    handleRotateRight() {
        this._rotateDeg = (this._rotateDeg + 90) % 360;
        this._hasUnsavedChanges = true;
        this._applyRotatePreview();
    },

    // ===================== Crop (chụp khung hình tĩnh + Cropper.js) =====================

    /** Bấm nút "Crop" — tạm dừng video, chụp khung hình HIỆN TẠI ra canvas (đúng độ phân giải gốc,
     * KHÔNG resize) rồi mở overlay chỉnh crop trên ảnh tĩnh đó (Cropper.js không chạy trực tiếp
     * trên `<video>`). */
    handleCropOpen() {
        if (!videoEditorSourceEl.videoWidth) return; // guard — video chưa load xong metadata
        videoEditorSourceEl.pause();
        const canvas = document.createElement('canvas');
        canvas.width = videoEditorSourceEl.videoWidth;
        canvas.height = videoEditorSourceEl.videoHeight;
        canvas.getContext('2d').drawImage(videoEditorSourceEl, 0, 0, canvas.width, canvas.height);
        videoEditorCropSourceEl.src = canvas.toDataURL('image/jpeg', 0.92);
        videoEditorCropOverlayEl.classList.remove('hidden');
        videoEditorCropSourceEl.addEventListener('load', () => this._initCropper(), { once: true });
    },

    _initCropper() {
        if (this._cropper) this._cropper.destroy();
        const cropFraction = this._cropFraction; // đóng gói vào closure cho callback `ready` dưới đây
        this._cropper = new Cropper(videoEditorCropSourceEl, { // CDN global
            viewMode: 1,
            autoCropArea: 1,
            background: false,
            responsive: true,
            ready() {
                if (!cropFraction) return; // guard — chưa từng crop trước đó, giữ vùng chọn mặc định (toàn khung)
                const w = videoEditorCropSourceEl.naturalWidth;
                const h = videoEditorCropSourceEl.naturalHeight;
                this.cropper.setData({ x: cropFraction.x * w, y: cropFraction.y * h, width: cropFraction.w * w, height: cropFraction.h * h });
            },
        });
    },

    handleCropConfirm() {
        if (!this._cropper) return; // guard — overlay chưa init xong
        const data = this._cropper.getData(true); // rounded
        const w = videoEditorCropSourceEl.naturalWidth;
        const h = videoEditorCropSourceEl.naturalHeight;
        this._cropFraction = { x: data.x / w, y: data.y / h, w: data.width / w, h: data.height / h };
        this._hasUnsavedChanges = true;
        this._closeCropOverlay();
        this._updateCropBadge();
    },

    handleCropCancel() {
        this._closeCropOverlay();
    },

    _closeCropOverlay() {
        if (this._cropper) { this._cropper.destroy(); this._cropper = null; }
        videoEditorCropOverlayEl.classList.add('hidden');
        videoEditorSourceEl.play().catch(() => {}); // best-effort — 1 số trình duyệt chặn autoplay có âm thanh, KHÔNG phải lỗi cần xử lý
    },

    handleCropReset() {
        this._cropFraction = null;
        this._hasUnsavedChanges = true;
        this._updateCropBadge();
    },

    _updateCropBadge() {
        if (this._cropFraction) {
            videoEditorCropBadgeEl.textContent = tFormat('videoEdit.cropBadge.active', { w: Math.round(this._cropFraction.w * 100), h: Math.round(this._cropFraction.h * 100) });
            btnVeCropReset.classList.remove('hidden');
        } else {
            videoEditorCropBadgeEl.textContent = t('videoEdit.cropBadge.none');
            btnVeCropReset.classList.add('hidden');
        }
    },

    // ===================== Cut (filmstrip + kéo thả 2 tay cầm, MỚI — thay hẳn time-picker cũ) =====================

    _filmstripBuilt: false, // chỉ build filmstrip 1 LẦN mỗi phiên mở trang (ảnh không đổi giữa các lần mở overlay)
    _cutDragHandle: null, // 'start'|'end'|null — tay cầm ĐANG kéo
    _cutBarLeft: 0,
    _cutBarWidth: 0,

    /** Bấm nút "Cut" — tạm dừng video, mở overlay, build filmstrip (nếu chưa build) rồi vẽ thanh
     * kéo theo trạng thái nháp hiện tại. */
    async handleCutOpen() {
        if (!videoEditorSourceEl.duration) return; // guard — video chưa load xong metadata
        videoEditorSourceEl.pause();
        this._cutDraftStart = this._cutRange ? this._cutRange.start : 0;
        this._cutDraftEnd = this._cutRange ? this._cutRange.end : videoEditorSourceEl.duration;
        videoEditorCutOverlayEl.classList.remove('hidden');
        await this._buildFilmstripIfNeeded();
        this._renderCutTrimBar();
    },

    /** Trích khung hình rải đều dựng dải filmstrip nền cho thanh kéo — core/video-editor/
     * filmstrip.js. Khung nào lỗi (blob null) bị bỏ qua, KHÔNG chặn cả dải. */
    async _buildFilmstripIfNeeded() {
        if (this._filmstripBuilt) return;
        this._filmstripBuilt = true;
        videoEditorCutFilmstripEl.innerHTML = '';
        const frames = await buildCutFilmstripFrames(this._record.blob, 12, 80, 64); // core/video-editor/filmstrip.js
        frames.forEach((frame) => {
            if (!frame.blob) return; // guard — khung này lỗi, bỏ qua
            const img = document.createElement('img');
            img.className = 'h-full flex-1 object-cover';
            img.src = URL.createObjectURL(frame.blob);
            videoEditorCutFilmstripEl.appendChild(img);
        });
    },

    /** Bắt đầu kéo 1 tay cầm — ghi nhớ kích thước thanh (đo 1 lần lúc bắt đầu kéo, không đo lại
     * mỗi lần di chuyển) rồi áp NGAY vị trí chạm đầu tiên (không cần đợi lần `pointermove` đầu). */
    handleCutDragStart(handle, clientX) {
        this._cutDragHandle = handle;
        const rect = videoEditorCutFilmstripWrapEl.getBoundingClientRect();
        this._cutBarLeft = rect.left;
        this._cutBarWidth = rect.width;
        this.handleCutDragMove(clientX);
    },

    /** Kéo tay cầm — kẹp trong biên hợp lệ (không vượt quá tay cầm còn lại trừ khoảng cách tối
     * thiểu 1s, không vượt [0, duration]), preview NGAY khung hình tương ứng lên video. */
    handleCutDragMove(clientX) {
        if (!this._cutDragHandle) return; // guard — không đang kéo tay cầm nào
        const MIN_GAP_SECONDS = 1;
        const duration = videoEditorSourceEl.duration || 0;
        const px = Math.min(this._cutBarWidth, Math.max(0, clientX - this._cutBarLeft));
        const seconds = this._cutBarWidth > 0 ? (px / this._cutBarWidth) * duration : 0;

        if (this._cutDragHandle === 'start') {
            this._cutDraftStart = Math.max(0, Math.min(seconds, this._cutDraftEnd - MIN_GAP_SECONDS));
        } else {
            this._cutDraftEnd = Math.min(duration, Math.max(seconds, this._cutDraftStart + MIN_GAP_SECONDS));
        }
        videoEditorSourceEl.currentTime = this._cutDragHandle === 'start' ? this._cutDraftStart : this._cutDraftEnd;
        this._renderCutTrimBar();
    },

    handleCutDragEnd() {
        this._cutDragHandle = null;
    },

    /** Vẽ lại vị trí 2 tay cầm + vùng tô mờ ngoài đoạn chọn + nhãn thời gian, theo
     * `_cutDraftStart`/`_cutDraftEnd` hiện tại. */
    _renderCutTrimBar() {
        const rect = videoEditorCutFilmstripWrapEl.getBoundingClientRect();
        const barWidth = rect.width;
        const duration = videoEditorSourceEl.duration || 1;
        const HANDLE_W = 16; // PHẢI khớp w-4 (16px, Tailwind) của tay cầm trong video-editor.html
        const startPx = (this._cutDraftStart / duration) * barWidth;
        const endPx = (this._cutDraftEnd / duration) * barWidth;

        videoEditorCutHandleStartEl.style.left = `${Math.max(0, startPx - HANDLE_W / 2)}px`;
        videoEditorCutHandleEndEl.style.left = `${Math.min(barWidth - HANDLE_W, endPx - HANDLE_W / 2)}px`;
        videoEditorCutDimLeftEl.style.width = `${startPx}px`;
        videoEditorCutDimRightEl.style.left = `${endPx}px`;
        videoEditorCutDimRightEl.style.width = `${Math.max(0, barWidth - endPx)}px`;
        videoEditorCutSelectionBorderEl.style.left = `${startPx}px`;
        videoEditorCutSelectionBorderEl.style.width = `${Math.max(0, endPx - startPx)}px`;
        videoEditorCutRangeLabelEl.textContent = `${this._formatSeconds(this._cutDraftStart)} – ${this._formatSeconds(this._cutDraftEnd)}`;
    },

    /** "m:ss" — hàm hiển thị riêng của trang này (KHÔNG gọi core nào khác, Rule 3 — mỗi trang độc
     * lập tự chứa hàm format của mình, cùng tiền lệ `formatVideoDuration()` core/file-manager/
     * video.js viết riêng thay vì gọi lại `formatTime()` của Playlist). */
    _formatSeconds(totalSeconds) {
        const s = Math.max(0, Math.round(totalSeconds));
        const m = Math.floor(s / 60);
        const rem = s % 60;
        return `${m}:${rem < 10 ? '0' : ''}${rem}`;
    },

    handleCutConfirm() {
        this._cutRange = { start: this._cutDraftStart, end: this._cutDraftEnd };
        this._hasUnsavedChanges = true;
        this._closeCutOverlay();
        this._updateCutBadge();
    },

    handleCutCancel() {
        this._closeCutOverlay();
    },

    _closeCutOverlay() {
        videoEditorCutOverlayEl.classList.add('hidden');
        videoEditorSourceEl.play().catch(() => {}); // best-effort — cùng lý do _closeCropOverlay()
    },

    handleCutReset() {
        this._cutRange = null;
        this._hasUnsavedChanges = true;
        this._updateCutBadge();
    },

    _updateCutBadge() {
        if (this._cutRange) {
            videoEditorCutBadgeEl.textContent = tFormat('videoEdit.cutBadge.active', { start: this._formatSeconds(this._cutRange.start), end: this._formatSeconds(this._cutRange.end) });
            btnVeCutReset.classList.remove('hidden');
        } else {
            videoEditorCutBadgeEl.textContent = t('videoEdit.cutBadge.none');
            btnVeCutReset.classList.add('hidden');
        }
    },

    // ===================== Trích xuất ảnh (MỚI Batch 2 — lưu THẲNG vào DB, không qua Save) =====================

    /** Chụp khung hình hiện tại, lưu THẲNG vào IndexedDB store 'images' (KHÔNG qua engine/Save —
     * đây là thao tác ĐỘC LẬP, xuất tức thì, không phụ thuộc trạng thái crop/rotate/filter/cut
     * đang chỉnh dở). "Chất lượng gốc" = giữ nguyên độ phân giải video, KHÔNG resize (chỉ
     * thumbnail mới resize, phục vụ lưới hiển thị — cùng quy ước Photo & Album có sẵn). */
    async handleExtractFrame() {
        if (!videoEditorSourceEl.videoWidth) return; // guard — video chưa load xong metadata
        const sourceCanvas = captureVideoFrameToCanvas(videoEditorSourceEl); // core/video-editor/frame-extract.js
        const blob = await new Promise((resolve) => sourceCanvas.toBlob(resolve, 'image/jpeg', 0.95));
        if (!blob) { await alertModal(t('videoEdit.extractFrame.failed')); return; }
        const thumbBlob = await buildExtractedPhotoThumbnail(sourceCanvas, 0.2); // core/video-editor/frame-extract.js
        const filename = `${buildExtractedPhotoFilename()}.jpg`; // core/video-editor/frame-extract.js
        await saveImage(blob, filename, thumbBlob, sourceCanvas.width, sourceCanvas.height); // core/file-manager/image.js
        await alertModal(t('videoEdit.extractFrame.success'));
    },

    // ===================== Reset toàn bộ + điều hướng =====================

    handleReset() {
        this._cropFraction = null;
        this._rotateDeg = 0;
        this._cutRange = null;
        sliderVeBrightness.value = 100;
        sliderVeContrast.value = 100;
        sliderVeSaturation.value = 100;
        this._applyFilterPreview();
        this._applyRotatePreview();
        this._updateCropBadge();
        this._updateCutBadge();
        this._hasUnsavedChanges = true; // vẫn coi là "có sửa" — KHÔNG chắc trùng khớp tuyệt đối trạng thái ban đầu nếu trang vừa mở đã có sẵn giá trị khác mặc định
    },

    /** "←" quay lại — hỏi xác nhận trước nếu có sửa CHƯA lưu, cùng khuôn `image-edit.js::
     * handleBack()`. Batch 1 CHƯA có Lưu — mọi crop/rotate/filter đang chỉnh SẼ MẤT nếu rời trang,
     * modal này vẫn cần thiết để cảnh báo đúng thực tế đó. */
    handleBack() {
        if (!this._hasUnsavedChanges) { window.location.href = 'index.html'; return; }
        modalChoice(
            t('videoEdit.discardConfirm.desc'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('videoEdit.discardConfirm.title'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: () => { window.location.href = 'index.html'; } },
            ],
            { title: t('videoEdit.discardConfirm.title') }
        );
    },
};
