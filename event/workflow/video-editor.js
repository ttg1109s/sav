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
 * NẠP SAU: core/video-editor/compat-guard.js, service/db.js, service/song-key-cipher.js,
 * lang/lang.js, Cropper.js (CDN), DOM tĩnh của video-editor.html (event/listener/video-editor.js
 * khai const tham chiếu NGAY ĐẦU file đó — trang nhỏ, không cần dom-refs.js riêng).
 */
const workflowVideoEditor = {
    _videoKey: null,
    _record: null,
    _cropper: null,
    _cropFraction: null, // {x,y,w,h} tỉ lệ 0-1, null = không crop
    _rotateDeg: 0, // 0/90/180/270
    _hasUnsavedChanges: false,

    /** Chạy 1 LẦN lúc trang load xong (xem event/listener/video-editor.js). */
    async init() {
        const encoded = new URLSearchParams(window.location.search).get('video');
        const videoKey = encoded ? decodeSongKeyFromUrl(encoded) : null; // service/song-key-cipher.js
        if (!videoKey) { this._showFatalError(t('videoEdit.invalidLink')); return; }

        const record = await getVideoRecord(videoKey); // data layer (service/db.js)
        if (!record) { this._showFatalError(t('videoEdit.videoNotFound')); return; }

        const compat = await checkVideoEditorCompat(record.blob); // core/video-editor/compat-guard.js
        if (!compat.supported) { this._showFatalError(t(`videoEdit.compat.${compat.reason}`)); return; }

        this._videoKey = videoKey;
        this._record = record;
        videoEditorTitleEl.textContent = record.filename || videoKey;
        const objectUrl = URL.createObjectURL(record.blob);
        videoEditorSourceEl.src = objectUrl;
        videoEditorSourceEl.addEventListener('loadedmetadata', () => this._applyRotatePreview(), { once: true });
        this._updateCropBadge();
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

    // ===================== Reset toàn bộ + điều hướng =====================

    handleReset() {
        this._cropFraction = null;
        this._rotateDeg = 0;
        sliderVeBrightness.value = 100;
        sliderVeContrast.value = 100;
        sliderVeSaturation.value = 100;
        this._applyFilterPreview();
        this._applyRotatePreview();
        this._updateCropBadge();
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
