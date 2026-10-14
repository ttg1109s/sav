/**
 * event/workflow/file-manager-photo.js — phần còn lại của miền Photo (Photo là 1 Nguồn của Playlist):
 *   1. Modal xem ảnh full-screen — mở từ mục "Edit image" của dòng Photo. Xem/zoom/sửa là 1 mặt: Panzoom gắn lên
 *      `mediaWrap` (core/file-manager/photo-ui.js) suốt vòng đời modal; canvas Edit vẽ đè bên trong, không đụng Panzoom.
 *   2. Picker chọn 1 ảnh qua Generic Drawer (bìa bài hát, nền mặt Clock của Custom Effect).
 * `resizeImageForThumbnail()` dùng chung với playlist.js::uploadPhotos() và image-edit.js.
 *
 * NẠP SAU: core/file-manager/image.js, core/file-manager/photo-ui.js, core/file-manager/gallery-window-ui.js,
 * core/image-load-ui.js, core/media-transform.js, components/media-gallery.js, components/image-preview-modal.js,
 * service/blob-url.js.
 */
let _imagePickerSession = null; // session picker ảnh Generic Drawer đang mở (null = đang đóng) — handle UI, KHÔNG phải state nghiệp vụ ảnh hưởng rẽ nhánh Router.

// Chiều cao hiển thị (px) mỗi hàng ảnh justified — fjGallery nong/co quanh giá trị này.
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

    _activeImageModalHandle: null, // handle modal xem ảnh đang mở (openImagePreviewModal()) — null khi đóng
    _activeImageUrl: null,         // object URL ảnh gốc của modal đang mở — thu hồi lúc đóng
    _activePanzoomSession: null,   // session Panzoom trên mediaWrap, sống suốt vòng đời modal
    _activeImageKey: null,         // key ảnh đang mở — workflowImageEdit đọc qua getActiveImageKey()

    /** Khe đọc cho workflowImageEdit (event/workflow/image-edit.js) lúc `ensureEditSessionReady()`. */
    getActiveImageModalHandle() { return this._activeImageModalHandle; },
    getActiveImageKey() { return this._activeImageKey; },

    /** Lưới ảnh có windowing cho picker Generic Drawer (event/workflow/photo-gallery-window.js).
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
        const bodyHtml = renderMediaPickerBodyHtml('file-manager-image-picker-scroll', 'file-manager-image-picker-empty', t('fileManager.photo.image.empty'), 'textMutedIcon'); // components/media-gallery.js
        workflowGenericDrawerHelpers.mountMediaPicker({ routerName: 'fileManagerPhoto', msgPrefix: 'fileManagerPhoto.imagePicker', title, bodyHtml, tileSelector: '[data-image-key]', tileDataKey: 'imageKey', updateInPlace: !!inPlace });

        await new Promise((resolve) => { taskManager.once(resolve, GENERIC_DRAWER_ANIM_MS, 'fileManagerPhotoPickerOpenSettle'); }); // core/generic-drawer.js

        const images = await workflowPlaylistScope.listPickableMedia('photo'); // event/workflow/playlist-scope.js — bỏ item thuộc folder Hidden
        if (!_imagePickerSession) return; // guard — picker bị đóng trong lúc đang đọc DB

        const scrollEl = genericDrawerBody.querySelector('#file-manager-image-picker-scroll');
        const emptyEl = genericDrawerBody.querySelector('#file-manager-image-picker-empty');
        setMediaPickerEmptyUi(emptyEl, images.length === 0); // core/file-manager/gallery-window-ui.js
        this.setupPhotoGridWindow(scrollEl, images);
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

    /** Dọn session + gỡ lưới (thu hồi object URL ngay) + đóng drawer — mọi lối thoát picker (chọn xong/huỷ). */
    _teardownImagePicker() {
        const inPlace = !!(_imagePickerSession && _imagePickerSession.inPlace);
        workflowPhotoGalleryWindow.unmount('genericDrawer'); // event/workflow/photo-gallery-window.js
        IMAGE_PICKER_DRAWER_TEARDOWN_BY_IN_PLACE[inPlace](); // tại chỗ: giữ drawer, nơi gọi tự vẽ lại màn của mình
        _imagePickerSession = null;
    },

    /** Resize 1 ảnh làm `thumbBlob` (2 chiều co theo `THUMBNAIL_SCALE_RATIO`), trả kèm `width`/`height` gốc để fjGallery
     * tính tỉ lệ khi dựng lưới mà không cần decode lại. Dùng bởi playlist.js::uploadPhotos() và image-edit.js.
     * @param {File} file
     * @returns {Promise<{thumbBlob: Blob, width: number, height: number}>}
     */
    async resizeImageForThumbnail(file) {
        const objectUrl = createBlobUrl(file); // service/blob-url.js
        const img = await decodeImageFromUrl(objectUrl); // core/image-load-ui.js
        revokeBlobUrl(objectUrl); // ảnh đã giải mã vẫn vẽ được sau khi thu hồi URL
        if (!img) throw new Error('[resizeImageForThumbnail] không đọc được ảnh để resize');
        const thumbBlob = await renderImageScaledToJpegBlob(img, THUMBNAIL_SCALE_RATIO, 0.82); // core/image-load-ui.js
        if (!thumbBlob) throw new Error('[resizeImageForThumbnail] canvas.toBlob trả về null');
        return { thumbBlob, width: img.naturalWidth, height: img.naturalHeight };
    },

    /** Ứng với mục "Edit image" trong menu dòng Photo ở Playlist. Mở modal, bật Panzoom, decode ảnh vào canvas ngay
     * (không đợi bấm Edit). Mỗi lần mở tăng lượt xem (`mediaStatsMap` — Sort theo thống kê đọc field này).
     * @param {string} imageKey
     */
    async openImagePreview(imageKey) {
        const record = await getImageRecord(imageKey); // data layer (service/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác
        const image = { key: imageKey, ...record };

        this._activeImageKey = imageKey; // workflowImageEdit cần lại lúc decode canvas
        workflowListenStats.bumpPlayCount('photo', imageKey); // event/workflow/listen-stats.js — Photo dùng làm "lượt click xem"

        this._activeImageUrl = createBlobUrl(image.blob); // service/blob-url.js
        this._activeImageModalHandle = openImagePreviewModal(renderImagePreviewModalHtml(), this._activeImageUrl, image.filename); // core/file-manager/photo-ui.js + components/image-preview-modal.js
        this._initZoom();
        this._fitPreviewImage(this._activeImageModalHandle); // không await — ảnh hiện ngay, chỉnh object-fit khi decode xong
        workflowImageEdit.ensureEditSessionReady(); // event/workflow/image-edit.js — không await, canvas tự vẽ đè lên khi decode xong
    },

    /** Chỉnh `object-fit` của `<img>` xem tạm theo hướng ảnh so với màn hình, sau khi ảnh decode xong.
     * @param {object} handle */
    async _fitPreviewImage(handle) {
        const decoded = await handle.imgEl.decode().then(() => true, () => false);
        if (!decoded) return; // ảnh hỏng — giữ mặc định
        const size = measureImageNaturalSize(handle.imgEl); // core/file-manager/photo-ui.js
        setImagePreviewImgFit(handle.imgEl, computeCoverOrContain(size.width, size.height, window.innerWidth, window.innerHeight)); // core/file-manager/photo-ui.js + core/file-manager/image.js
    },

    /** Bật Panzoom trên `mediaWrap` (bọc `<img>` + canvas), 1 lần lúc mở modal tới khi đóng. `exclude: [interactCanvas]`
     * để Panzoom không giành cử chỉ kéo Crop/Vẽ/layer thành pan. */
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

    /** Đóng modal xem ảnh (Router gọi khi bấm X): dọn Panzoom, Edit, DOM, object URL. */
    closeImagePreview() {
        if (this._activePanzoomSession) { destroyPanzoomSession(this._activePanzoomSession); this._activePanzoomSession = null; } // core/media-transform.js
        workflowImageEdit.exitEditMode();
        if (this._activeImageModalHandle) { this._activeImageModalHandle.close(); this._activeImageModalHandle = null; }
        if (this._activeImageUrl) { revokeBlobUrl(this._activeImageUrl); this._activeImageUrl = null; } // service/blob-url.js
    },
};
