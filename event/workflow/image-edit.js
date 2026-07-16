/**
 * event/workflow/image-edit.js — Workflow DUY NHẤT của trang `image-edit.html` (KHÔNG nạp ở
 * `index.html`, chạy như 1 trang độc lập — cùng kiến trúc `subtitle-editor.html`, xem docstring
 * `event/workflow/subtitle-modal.js::navigateToEditor()` cho luồng điều hướng gốc).
 *
 * GIAO TIẾP với trang chính: KHÔNG postMessage/BroadcastChannel — 2 trang cùng origin `file://`,
 * đọc/ghi CHUNG 1 IndexedDB qua `service/db.js`. Trang chính điều hướng sang đây bằng
 * `window.location.href = 'image-edit.html?image=<key mã hoá>'` (`event/workflow/
 * file-manager-photo.js::navigateToImageEdit()`, tái dùng `encodeSongKeyForUrl()` — cipher đó CHỈ
 * mã hoá 1 chuỗi key bất kỳ, không có gì "song" riêng). Trang này tự giải mã `?image=`, tự đọc
 * `getImageRecord()`, và lúc Lưu tự ghi thẳng `updateImageBlob()` (core/file-manager/image.js) —
 * KHÔNG cần báo ngược gì cho trang chính (Photo & Album tự đọc lại DB khi mở panel, không giữ cache
 * blob cũ nào cần đồng bộ).
 *
 * State RIÊNG sống trong object này (trang không dùng `appState`/`service/state.js`, cùng lý do
 * `subtitle-editor.html`).
 *
 * Thư viện: Cropper.js v1 (CDN, global `Cropper`) — crop/rotate/flip. Brightness/Contrast/
 * Saturation/Grayscale qua CSS `filter` (xem trực tiếp lúc chỉnh, "nướng" vào canvas lúc Lưu —
 * `_buildFinalBlob()`).
 *
 * NẠP SAU: core/file-manager/image.js, service/db.js, service/song-key-cipher.js, lang/lang.js,
 * Cropper.js (CDN), DOM tĩnh của image-edit.html (event/listener/image-edit.js khai const tham
 * chiếu NGAY ĐẦU file đó, trang nhỏ không cần dom-refs.js riêng — cùng quy ước subtitle-editor.js).
 */

// ĐÃ GỠ (Giang yêu cầu "resize theo tỉ lệ 20% width và 20% height") — PHOTO_ROW_HEIGHT_PX không còn
// dùng ở trang này (chỉ dùng cho chiều cao HIỂN THỊ trong lưới, KHÔNG liên quan resize thumbBlob
// thật nữa). THAY bằng THUMBNAIL_SCALE_RATIO — PHẢI khớp hằng số cùng tên ở event/workflow/
// file-manager-photo.js. KHÔNG dùng lại hằng số CHUNG được vì image-edit.html là trang ĐỘC LẬP
// (window.location.href toàn trang, KHÔNG nạp core/config.js hay bất kỳ file nào của index.html —
// xem docstring đầu file) — đổi 1 trong 2 chỗ PHẢI đổi luôn chỗ kia.
const THUMBNAIL_SCALE_RATIO = 0.2;

const workflowImageEdit = {
    _imageKey: null,
    _record: null, // record đầy đủ từ getImageRecord() (blob, filename, addedAt, caption)
    _cropper: null,
    _flipX: 1,
    _flipY: 1,
    _hasUnsavedChanges: false,

    /** Chạy 1 LẦN lúc trang load xong (xem event/listener/image-edit.js). */
    async init() {
        const encoded = new URLSearchParams(window.location.search).get('image');
        const imageKey = encoded ? decodeSongKeyFromUrl(encoded) : null; // service/song-key-cipher.js
        if (!imageKey) { this._showFatalError(t('imageEdit.invalidLink')); return; }

        const record = await getImageRecord(imageKey); // data layer (service/db.js)
        if (!record) { this._showFatalError(t('imageEdit.imageNotFound')); return; }

        this._imageKey = imageKey;
        this._record = record;
        imageEditTitleEl.textContent = record.filename || imageKey;

        const objectUrl = URL.createObjectURL(record.blob);
        imageEditSourceEl.src = objectUrl;
        imageEditSourceEl.addEventListener('load', () => this._initCropper(), { once: true });
    },

    _showFatalError(message) {
        imageEditTitleEl.textContent = t('imageEdit.errorTitle') || '';
        imageEditFatalErrorEl.textContent = message;
        imageEditFatalErrorEl.classList.remove('hidden');
        imageEditSourceEl.classList.add('hidden');
    },

    _initCropper() {
        if (this._cropper) this._cropper.destroy();
        this._cropper = new Cropper(imageEditSourceEl, { // CDN global
            viewMode: 1,
            autoCropArea: 1,
            background: false,
            responsive: true,
        });
        this._flipX = 1;
        this._flipY = 1;
        this._applyFilterPreview();
    },

    /** Đọc 3 slider + grayscale hiện tại -> chuỗi CSS `filter`, áp lên khung bọc Cropper (mọi lớp
     * <img>/canvas con của thư viện đều bị ảnh hưởng, không cần biết cấu trúc DOM nội bộ). */
    _applyFilterPreview() {
        const b = sliderBrightness.value;
        const c = sliderContrast.value;
        const s = sliderSaturation.value;
        const gray = imageEditCanvasWrap.dataset.grayscale === '1' ? ' grayscale(100%)' : '';
        imageEditCanvasWrap.style.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)${gray}`;
    },

    handleSliderChange() {
        this._applyFilterPreview();
        this._hasUnsavedChanges = true;
    },

    handleGrayscaleToggle() {
        const on = imageEditCanvasWrap.dataset.grayscale === '1';
        imageEditCanvasWrap.dataset.grayscale = on ? '0' : '1';
        btnIeGrayscale.classList.toggle('bg-white/10', !on);
        this._applyFilterPreview();
        this._hasUnsavedChanges = true;
    },

    /** "Crop" — chốt vùng chọn hiện tại: xuất canvas đã cắt, dựng lại Cropper trên ẢNH ĐÃ CẮT ĐÓ
     * (cho phép crop/rotate/flip tiếp trên kết quả vừa cắt). KHÔNG "nướng" filter vào đây — filter
     * vẫn chỉ là preview cho tới lúc Lưu (_buildFinalBlob()), giữ tách biệt hình học (crop/rotate/
     * flip) và màu sắc (filter), đúng 2 khái niệm khác nhau. */
    handleCrop() {
        if (!this._cropper) return; // guard — chưa init xong (ảnh chưa load)
        const canvas = this._cropper.getCroppedCanvas();
        if (!canvas) return; // guard — chưa có vùng chọn hợp lệ
        imageEditSourceEl.src = canvas.toDataURL();
        this._hasUnsavedChanges = true;
        // load lại -> init() đã đăng {once:true} cho lần đầu, giờ tự đăng lại 1 lần nữa cho ảnh mới
        imageEditSourceEl.addEventListener('load', () => this._initCropper(), { once: true });
    },

    handleRotate(deg) {
        if (!this._cropper) return;
        this._cropper.rotate(deg);
        this._hasUnsavedChanges = true;
    },

    handleFlipHorizontal() {
        if (!this._cropper) return;
        this._flipX = this._flipX === 1 ? -1 : 1;
        this._cropper.scaleX(this._flipX);
        this._hasUnsavedChanges = true;
    },

    handleFlipVertical() {
        if (!this._cropper) return;
        this._flipY = this._flipY === 1 ? -1 : 1;
        this._cropper.scaleY(this._flipY);
        this._hasUnsavedChanges = true;
    },

    handleReset() {
        if (!this._cropper) return;
        this._cropper.reset();
        this._flipX = 1;
        this._flipY = 1;
        sliderBrightness.value = 100;
        sliderContrast.value = 100;
        sliderSaturation.value = 100;
        imageEditCanvasWrap.dataset.grayscale = '0';
        btnIeGrayscale.classList.remove('bg-white/10');
        this._applyFilterPreview();
        this._hasUnsavedChanges = true; // vẫn coi là "có sửa" (KHÔNG chắc trùng khớp tuyệt đối ảnh gốc ban đầu nếu đã từng bấm Crop trước đó)
    },

    /** Vẽ canvas đã crop/rotate/flip (Cropper) RỒI "nướng" filter màu vào (canvas 2D `ctx.filter`,
     * CÙNG chuỗi CSS filter đang preview) -> `toBlob()`. Tách hàm riêng vì Lưu cần Blob THẬT (không
     * chỉ để xem), Crop (handleCrop()) chỉ cần canvas hình học, không cần filter.
     *
     * SỬA (Giai đoạn 5, rewrite Photo/Album — hoàn thiện thumbBlob sau khi edit) — trả thêm
     * `width`/`height` (kích thước THẬT sau crop — có thể khác hẳn ảnh gốc, fjGallery (thư viện,
     * event/workflow/photo-gallery-window.js) cần đúng số này để tính tỉ lệ hiển thị lưới) VÀ `sourceCanvas`
     * (chính `out`, TÁI DÙNG lại cho `_buildThumbnailBlob()` ngay dưới — tránh decode Blob lại lần 2
     * qua `<img>` như `_resizeImageForThumbnail()` bên index.html phải làm, vì ở ĐÂY canvas kết quả
     * đã có sẵn ngay trong bộ nhớ).
     * @returns {Promise<{blob: Blob, width: number, height: number, sourceCanvas: HTMLCanvasElement}|null>}
     */
    _buildFinalBlob() {
        if (!this._cropper) return Promise.resolve(null);
        const geoCanvas = this._cropper.getCroppedCanvas();
        if (!geoCanvas) return Promise.resolve(null);
        const out = document.createElement('canvas');
        out.width = geoCanvas.width;
        out.height = geoCanvas.height;
        const ctx = out.getContext('2d');
        ctx.filter = imageEditCanvasWrap.style.filter || 'none';
        ctx.drawImage(geoCanvas, 0, 0);
        const mime = (this._record && this._record.blob.type) || 'image/jpeg';
        return new Promise((resolve) => {
            out.toBlob((blob) => {
                resolve(blob ? { blob, width: out.width, height: out.height, sourceCanvas: out } : null);
            }, mime, 0.92);
        });
    },

    /** MỚI (Giai đoạn 5, rewrite Photo/Album — hoàn thiện thumbBlob sau khi edit) — resize thumbnail
     * TỪ canvas đã dựng sẵn (`sourceCanvas`, từ `_buildFinalBlob()`) — KHÔNG decode lại từ Blob qua
     * `<img>` như `_resizeImageForThumbnail()` (event/workflow/file-manager-photo.js) vì canvas
     * nguồn ĐÃ CÓ SẴN trong bộ nhớ ở đây, decode lại tốn kém vô ích.
     * SỬA (Giang yêu cầu — "resize theo tỉ lệ 20% width và 20% height") — CÙNG công thức
     * `THUMBNAIL_SCALE_RATIO` (event/workflow/file-manager-photo.js) — 2 nơi PHẢI ra kết quả tương
     * đương (đổi 1 trong 2 chỗ PHẢI đổi luôn chỗ kia — file NÀY là trang ĐỘC LẬP, không nạp chung
     * hằng số với index.html, xem docstring PHOTO_ROW_HEIGHT_PX đầu file).
     * @param {HTMLCanvasElement} sourceCanvas
     * @param {string} mime
     * @returns {Promise<Blob|null>}
     */
    _buildThumbnailBlob(sourceCanvas, mime) {
        const targetWidth = Math.max(1, Math.round(sourceCanvas.width * THUMBNAIL_SCALE_RATIO)); // guard: tối thiểu 1px
        const targetHeight = Math.max(1, Math.round(sourceCanvas.height * THUMBNAIL_SCALE_RATIO));
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = targetWidth;
        thumbCanvas.height = targetHeight;
        thumbCanvas.getContext('2d').drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
        return new Promise((resolve) => thumbCanvas.toBlob(resolve, mime, 0.82));
    },

    /** SỬA (Giai đoạn 5, rewrite Photo/Album — trả nợ kỹ thuật ghi ở Giai đoạn 1) — resize
     * `thumbBlob` NGAY TRƯỚC khi ghi, TRUYỀN kèm `width`/`height` thật sau crop vào
     * `updateImageBlob()` (core/file-manager/image.js — chữ ký MỚI) — lưới ảnh Photo & Album giờ
     * hiển thị ĐÚNG ảnh/tỉ lệ vừa sửa ngay lập tức, không cần đợi cơ chế backfill lười (mở full view
     * 1 lần) như trước. */
    async handleSave() {
        const finalResult = await this._buildFinalBlob();
        if (!finalResult) return; // guard — chưa có gì để lưu (ảnh chưa load xong)
        const { blob, width, height, sourceCanvas } = finalResult;
        const thumbBlob = await this._buildThumbnailBlob(sourceCanvas, blob.type || 'image/jpeg');
        await updateImageBlob(this._imageKey, blob, thumbBlob, width, height); // core/file-manager/image.js — chữ ký MỚI
        this._hasUnsavedChanges = false;
        await alertModal(t('imageEdit.saved')); // core/modal-choice.js
    },

    /** "←" quay lại — hỏi xác nhận trước nếu có sửa CHƯA lưu (modalChoice(), core/modal-choice.js,
     * cùng khuôn mọi xác nhận rời trang có rủi ro mất dữ liệu khác trong app). */
    handleBack() {
        if (!this._hasUnsavedChanges) { window.location.href = 'index.html'; return; }
        modalChoice(
            t('imageEdit.discardConfirm.desc'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('imageEdit.discardConfirm.title'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: () => { window.location.href = 'index.html'; } },
            ],
            { title: t('imageEdit.discardConfirm.title') }
        );
    },
};
