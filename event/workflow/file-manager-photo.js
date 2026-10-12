/**
 * event/workflow/file-manager-photo.js — Workflow phần còn lại của miền Photo (Photo là 1 Source của Playlist, xem
 * event/workflow/playlist.js::switchSource()). 2 nhóm việc:
 *   1. Modal xem ảnh full-screen — mở từ mục "Edit image" trong dropdown dòng Photo ở Playlist. Xem/Zoom/Edit là 1,
 *      không có "mode": Panzoom gắn lên `mediaWrap` (bọc CHUNG `<img>` + canvasWrap, core/file-manager/photo-ui.js),
 *      `_initZoom()` gọi ĐÚNG 1 LẦN lúc mở modal và chạy tới khi đóng hẳn; canvas Edit vẽ đè bên trong `mediaWrap`
 *      không đụng session Panzoom.
 *   2. Picker chọn 1 ảnh dùng chung qua Generic Drawer (bìa bài hát, nền mặt Clock của Custom Effect).
 * `resizeImageForThumbnail()`/`computePhotoDuration()` DÙNG CHUNG với playlist.js::uploadPhotos() và
 * image-edit.js (Lưu đè/Lưu mới).
 *
 * NẠP SAU: core/file-manager/image.js, core/file-manager/photo-ui.js, core/image-load-ui.js, core/media-transform.js
 * (initPanzoomSession/destroyPanzoomSession), core/media-picker-drawer-ui.js,
 * core/generic-drawer.js.
 */
let _imagePickerSession = null; // session picker ảnh Generic Drawer đang mở (null = đang đóng) — handle UI, KHÔNG phải state nghiệp vụ ảnh hưởng rẽ nhánh Router.

// Chiều cao HIỂN THỊ (px) của 1 hàng ảnh "justified row" — `rowHeight` truyền vào fjGallery
// (event/workflow/photo-gallery-window.js), thư viện tự nong/co mỗi hàng quanh giá trị này.
const PHOTO_ROW_HEIGHT_PX = 120;
// Hệ số co CẢ 2 chiều lúc resize `thumbBlob` (giữ nguyên tỉ lệ ảnh) — độc lập với PHOTO_ROW_HEIGHT_PX.
const THUMBNAIL_SCALE_RATIO = 0.2;

/** Dọn picker ảnh xong: picker mở ĐÈ (drawer riêng) -> đóng hẳn drawer; picker mở TẠI CHỖ trong drawer
 * của nơi gọi (Custom Effect) -> giữ drawer, nơi gọi tự vẽ lại màn của mình trong callback. */
const IMAGE_PICKER_DRAWER_TEARDOWN_BY_IN_PLACE = {
    true: () => {},
    false: () => workflowGenericDrawerHelpers.closeFully(), // event/workflow/generic-drawer-helpers.js
};

const workflowFileManagerPhoto = {

    _activeImageModalHandle: null, // { close, imgEl, canvasWrap, baseCanvas, renderCanvas, interactCanvas, toolsBtn, adjustPopup, ... } của modal xem ảnh đang mở — null khi không mở modal nào
    _activePanzoomSession: null,   // session Panzoom (core/media-transform.js) — LUÔN chạy suốt vòng đời modal (gắn trên mediaWrap, không phải imgEl) — null chỉ khi modal đã đóng
    _activeImageKey: null,         // key ảnh đang mở modal — workflowImageEdit đọc lại qua getActiveImageKey()

    /** 2 khe ĐỌC hẹp cho workflowImageEdit (miền khác — event/workflow/image-edit.js) tự lấy
     * lại handle/imageKey của modal đang mở lúc `ensureEditSessionReady()`, KHÔNG cần workflow đó
     * tự giữ tham chiếu riêng đến vòng đời modal (GHI vẫn CHỈ qua các hàm ở file này). */
    getActiveImageModalHandle() { return this._activeImageModalHandle; },
    getActiveImageKey() { return this._activeImageKey; },

    /** Windowing lưới ảnh cho picker Generic Drawer (chọn 1 ảnh) — gọi
     * `workflowPhotoGalleryWindow.mount()` (event/workflow/photo-gallery-window.js): windowing cấp
     * NHÓM NGÀY qua `IntersectionObserver` + fjGallery (thư viện thật) lo layout justified bên
     * trong mỗi nhóm còn tải — không tự đo `scrollTop`/`clientWidth` bằng tay.
     * @param {HTMLElement} scrollEl - container CUỘN, ĐÃ có trong DOM thật.
     * @param {Array<{key:string, blob:Blob, thumbBlob?:Blob, width?:number, height?:number, filename:string, addedAt:number}>} images
     */
    setupPhotoGridWindow(scrollEl, images) {
        if (!scrollEl) return;
        workflowPhotoGalleryWindow.mount('genericDrawer', { // event/workflow/photo-gallery-window.js
            scrollEl,
            images,
            rowHeightPx: PHOTO_ROW_HEIGHT_PX,
        });
    },

    // ===================== Picker ảnh dùng chung (Generic Drawer) — single-select =====================

    /** Chọn 1 ảnh (bìa bài hát — event/workflow/playlist.js; nền mặt Clock — event/workflow/custom-effect.js):
     * bấm ảnh nào chọn NGAY ảnh đó + đóng drawer, không nút xác nhận.
     * `opts.inPlace`: nơi gọi ĐANG đứng trong chính Generic Drawer (Custom Effect) -> picker THAY nội dung tại chỗ
     * (`updateInPlace`, cùng cách picker Theme/VBG) và lúc chọn/X KHÔNG đóng drawer — nơi gọi tự vẽ lại màn của mình
     * trong callback. (Đóng hẳn bằng `closeFully()` rồi nơi gọi mở lại ngay thì hẹn giờ ẩn của closeFully() vẫn chạy
     * -> ẩn mất màn vừa mở.)
     * @param {(imageKey: string) => void} onSelect
     * @param {() => void} [onCancel] - gọi khi đóng bằng nút X mà chưa chọn gì.
     * @param {{inPlace?: boolean}} [opts]
     */
    async openCoverImagePicker(onSelect, onCancel, opts) {
        const inPlace = !!(opts && opts.inPlace);
        _imagePickerSession = { onSelect, onCancel, hasSelected: false, inPlace };
        await this._openImagePickerDrawer(t('playlistView.songEdit.coverPickLibrary'), inPlace);
    },

    /** Mở khung picker (`workflowGenericDrawerHelpers.mountMediaPicker()`, 90vh), đợi drawer trượt xong rồi
     * mới đọc DB + dựng lưới. Danh sách qua `listPickableMedia()` — bỏ ảnh thuộc folder Hidden.
     * @param {string} title
     * @param {boolean} [inPlace] - true = thay nội dung drawer đang mở (xem openCoverImagePicker()).
     */
    async _openImagePickerDrawer(title, inPlace) {
        workflowGenericDrawerHelpers.mountMediaPicker({ routerName: 'fileManagerPhoto', msgPrefix: 'fileManagerPhoto.imagePicker', title, bodyHtml: this._buildImagePickerBodyHtml(), tileSelector: '[data-image-key]', tileDataKey: 'imageKey', updateInPlace: !!inPlace });

        await new Promise((resolve) => { taskManager.once(resolve, GENERIC_DRAWER_ANIM_MS, 'fileManagerPhotoPickerOpenSettle'); }); // core/generic-drawer.js

        const images = await workflowPlaylistScope.listPickableMedia('photo'); // event/workflow/playlist-scope.js — bỏ item thuộc folder Hidden
        if (!_imagePickerSession) return; // guard — picker bị đóng trong lúc đang đọc DB

        const scrollEl = genericDrawerBody.querySelector('#file-manager-image-picker-scroll');
        const emptyEl = genericDrawerBody.querySelector('#file-manager-image-picker-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', images.length > 0);
        this.setupPhotoGridWindow(scrollEl, images);
    },

    /** Khung picker: scroll container (lưới windowing chèn vào trong). Chuỗi thuần.
     * @returns {string}
     */
    _buildImagePickerBodyHtml() {
        return `
            <div class="flex-1 min-h-0 overflow-y-auto relative" id="file-manager-image-picker-scroll">
                <p id="file-manager-image-picker-empty" class="hidden text-sm text-center py-10 px-6" data-uitk="textMutedIcon">${t('fileManager.photo.image.empty')}</p>
            </div>
        `;
    },

    /** Ứng với 'fileManagerPhoto.imagePicker.tile.click' — bấm là chọn NGAY, đóng drawer luôn,
     * KHÔNG cần nút xác nhận riêng.
     * @param {string} imageKey
     */
    handleImagePickerTileClick(imageKey) {
        if (!_imagePickerSession) return; // guard: picker đã đóng (race hiếm, vd đóng đúng lúc tap)
        _imagePickerSession.hasSelected = true;
        const onSelect = _imagePickerSession.onSelect;
        this._teardownImagePicker();
        onSelect(imageKey);
    },

    /** Ứng với 'fileManagerPhoto.imagePicker.close.click' — đóng picker qua nút X (Huỷ, chưa chọn
     * gì — đã chọn xong trước đó thì không còn `_imagePickerSession` để mà đóng qua đường này nữa,
     * guard tự an toàn). */
    handleImagePickerCloseClick() {
        if (!_imagePickerSession) return;
        const { onCancel, hasSelected } = _imagePickerSession;
        this._teardownImagePicker();
        if (!hasSelected && typeof onCancel === 'function') onCancel();
    },

    /** Dọn session + unmount windowing (revoke object URL NGAY, không đợi lần mount() kế tiếp mới
     * tự dọn) + đóng drawer — DÙNG CHUNG cho MỌI lối thoát picker (chọn xong/huỷ). */
    _teardownImagePicker() {
        const inPlace = !!(_imagePickerSession && _imagePickerSession.inPlace);
        workflowPhotoGalleryWindow.unmount('genericDrawer'); // event/workflow/photo-gallery-window.js
        IMAGE_PICKER_DRAWER_TEARDOWN_BY_IN_PLACE[inPlace](); // tại chỗ: giữ drawer, nơi gọi tự vẽ lại màn của mình
        _imagePickerSession = null;
    },

    /** Resize 1 ảnh làm `thumbBlob`: CẢ 2 chiều co theo `THUMBNAIL_SCALE_RATIO` (giữ nguyên tỉ lệ ảnh) — giải mã + vẽ
     * ở core/image-load-ui.js.
     * Trả thêm `width`/`height` GỐC (trước resize) để fjGallery (thư viện, xem event/workflow/
     * photo-gallery-window.js) tính tỉ lệ hiển thị MÀ KHÔNG cần decode ảnh lại lúc dựng lưới.
     * Dùng CHUNG bởi `playlist.js::uploadPhotos()` VÀ `workflowImageEdit` (event/workflow/image-edit.js — Lưu đè/Lưu
     * mới cũng cần resize thumbnail).
     * @param {File} file
     * @returns {Promise<{thumbBlob: Blob, width: number, height: number}>}
     */
    async resizeImageForThumbnail(file) {
        const objectUrl = URL.createObjectURL(file);
        const img = await decodeImageFromUrl(objectUrl); // core/image-load-ui.js
        URL.revokeObjectURL(objectUrl); // ảnh đã giải mã vẫn vẽ được sau khi thu hồi URL
        if (!img) throw new Error('[resizeImageForThumbnail] không đọc được ảnh để resize');
        const thumbBlob = await renderImageScaledToJpegBlob(img, THUMBNAIL_SCALE_RATIO, 0.82); // core/image-load-ui.js
        if (!thumbBlob) throw new Error('[resizeImageForThumbnail] canvas.toBlob trả về null');
        return { thumbBlob, width: img.naturalWidth, height: img.naturalHeight };
    },

    /** Cửa ngõ tới workflowPhotoDuration.compute() (event/workflow/photo-duration.js, dùng chung với trang
     * video-editor.html) cho các nơi gọi trong app (uploadPhotos(), image-edit.js).
     * @param {File|Blob} file @param {number} width @param {number} height @returns {Promise<number>} */
    computePhotoDuration(file, width, height) {
        return workflowPhotoDuration.compute(file, width, height); // event/workflow/photo-duration.js
    },

    /** Ứng với mục "Edit image" trong dropdown action-menu dòng Photo ở Playlist (event/workflow/
     * playlist.js); tap ảnh trong list item là PHÁT ảnh (event/router/playlist.js case 'playlist.item.playClick').
     * DUY NHẤT 1 mặt canvas dùng chung xem/zoom/pan/edit (KHÔNG có khái niệm "mode") —
     * decode ảnh vào canvas NGAY LÚC MỞ MODAL (`workflowImageEdit.ensureEditSessionReady()`,
     * Workflow-gọi-Workflow tự do), KHÔNG đợi bấm icon Edit. Zoom (Panzoom) bật NGAY qua
     * `_initZoom()`, chạy LIÊN TỤC suốt vòng đời modal.
     * Tăng `count` trong `mediaStatsMap` (dùng CHUNG với Song/Video, Sort trục thống kê đọc field
     * này — với Photo là "lượt click xem") mỗi lần mở xem.
     * @param {string} imageKey
     */
    async openImagePreview(imageKey) {
        const record = await getImageRecord(imageKey); // data layer (service/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác
        const image = { key: imageKey, ...record };

        this._activeImageKey = imageKey; // workflowImageEdit cần lại lúc decode canvas
        workflowListenStats.bumpPlayCount('photo', imageKey); // event/workflow/listen-stats.js — Photo dùng làm "lượt click xem"

        this._activeImageModalHandle = openImagePreviewModal(image); // core/file-manager/photo-ui.js — Core tự bắn eventBus cố định (Rule 5a), Router gọi lại các hàm dưới đây
        this._initZoom();
        workflowImageEdit.ensureEditSessionReady(); // event/workflow/image-edit.js — decode canvas NGAY, không đợi bấm Edit (không await — modal đã hiện `<img>` tức thời, canvas tự vẽ đè lên khi decode xong)
    },

    /** Bật Panzoom trên `mediaWrap` (bọc CHUNG `<img>` + canvasWrap, core/file-manager/photo-ui.js)
     * — KHÔNG gắn thẳng `<img>` (canvas vẽ ĐÈ lên `<img>` ngay khi decode xong, không phải toggle
     * ẩn/hiện qua lại — gắn Panzoom lên `mediaWrap` thì việc đó không hề ảnh hưởng session). Gọi
     * hàm này ĐÚNG 1 LẦN lúc mở modal (`openImagePreview()`), chạy tới khi đóng hẳn modal
     * (`closeImagePreview()`).
     * `exclude: [interactCanvas]` — interactCanvas tự có pointer handler riêng (kéo khung Crop/nét
     * Vẽ/layer, wire ở core/file-manager/photo-ui.js), KHÔNG để Panzoom giành mất cử chỉ đó
     * thành pan (2 hệ thống cùng nghe pointerdown trên cùng 1 vùng nếu không loại trừ tường minh).
     */
    _initZoom() {
        if (!this._activeImageModalHandle) return; // guard: hiếm, modal đã đóng ở đâu đó trước khi tới đây
        if (this._activePanzoomSession) { destroyPanzoomSession(this._activePanzoomSession); this._activePanzoomSession = null; } // core/media-transform.js — an toàn nếu lỡ gọi 2 lần liên tiếp
        this._activePanzoomSession = initPanzoomSession(this._activeImageModalHandle.mediaWrap, { // core/media-transform.js
            maxScale: 4,
            minScale: 1,
            contain: 'outside',
            exclude: [this._activeImageModalHandle.interactCanvas],
        });
    },

    /** Đóng THẬT modal xem ảnh — dọn phiên Panzoom nếu còn + dọn Edit mode nếu còn + đóng handle.
     * Router gọi khi bấm X.
     */
    closeImagePreview() {
        if (this._activePanzoomSession) { destroyPanzoomSession(this._activePanzoomSession); this._activePanzoomSession = null; } // core/media-transform.js
        workflowImageEdit.exitEditMode();
        if (this._activeImageModalHandle) { this._activeImageModalHandle.close(); this._activeImageModalHandle = null; }
    },
};
