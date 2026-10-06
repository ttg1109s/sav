/**
 * event/workflow/file-manager-photo.js — "THẰNG THỰC THI CUỐI" cho phần còn lại của miền Photo sau
 * khi Photo Panel full-screen bị xoá (hợp nhất vào Playlist làm 1 Source, xem event/workflow/
 * playlist.js::switchSource()). Còn 2 nhóm việc:
 *   1. Modal xem ảnh full-screen — mở từ mục "Edit image" trong dropdown dòng Photo ở Playlist
 *      (event/workflow/playlist.js), KHÔNG còn mở từ tap ảnh trong lưới cũ. View/Zoom/Edit đã GỘP
 *      làm 1 THẬT SỰ, KHÔNG có khái niệm "mode" nào cần thoát HAY pause/resume (bỏ dropdown "..."
 *      cũ) — Panzoom gắn lên `mediaWrap` (bọc CHUNG `<img>` + canvasWrap, xem core/file-manager/
 *      photo-ui.js), KHÔNG gắn thẳng `<img>`, nên `_initZoom()` gọi ĐÚNG 1 LẦN lúc mở modal và chạy
 *      LIÊN TỤC cho tới khi đóng hẳn — Edit mode ẩn `<img>`/hiện canvasWrap bên TRONG `mediaWrap`
 *      không hề đụng tới session Panzoom đang chạy.
 *   2. Picker chọn 1 ảnh dùng chung qua Generic Drawer (cover bài hát/nền Theme) — gọi bởi
 *      playlist.js::pickCoverFromLibrary() và theme.js::pickNewBackgroundImage().
 * `resizeImageForThumbnail()`/`computePhotoDuration()` DÙNG CHUNG với playlist.js::uploadPhotos()
 * (upload ảnh giờ qua nút upload chung của Playlist) và image-edit.js::saveEditOverwrite().
 *
 * NẠP SAU: core/file-manager/image.js, core/file-manager/photo-ui.js, core/media-transform.js
 * (initPanzoomSession/destroyPanzoomSession), core/media-picker-drawer-ui.js,
 * core/generic-drawer.js.
 */
let _imagePickerSession = null; // session picker ảnh Generic Drawer đang mở (null = đang đóng) — handle UI, KHÔNG phải state nghiệp vụ ảnh hưởng rẽ nhánh Router.

// MỚI (Giai đoạn 1, rewrite Photo/Album, mục 3b/3c) — chiều cao CỐ ĐỊNH (px) của 1 hàng ảnh kiểu
// "justified row" (Google Photos thật). Dùng ở 2 chỗ, BẮT BUỘC khớp nhau:
//   1. `resizeImageForThumbnail()` (ngay dưới) — resize `thumbBlob` lúc upload đúng chiều cao này.
//   2. `rowHeight` truyền vào fjGallery (event/workflow/photo-gallery-window.js) — thư viện tự nong/
//      co MỖI HÀNG THẬT quanh giá trị này (đúng thuật toán Flickr/Google Photos).
const PHOTO_ROW_HEIGHT_PX = 120;
// Hệ số co CẢ 2 chiều lúc resize `thumbBlob` — TÁCH BIỆT hẳn khỏi PHOTO_ROW_HEIGHT_PX (chỉ còn ý
// nghĩa "chiều cao HIỂN THỊ trong lưới" truyền cho fjGallery).
const THUMBNAIL_SCALE_RATIO = 0.2;

// DỜI (06/10/2026) — 5 hằng số DURATION_* của computePhotoDuration() sang event/workflow/photo-duration.js.


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
     * @param {(imageKey: string) => void} onSelect
     * @param {() => void} [onCancel] - gọi khi đóng bằng nút X mà chưa chọn gì.
     */
    async openCoverImagePicker(onSelect, onCancel) {
        _imagePickerSession = { onSelect, onCancel, hasSelected: false };
        await this._openImagePickerDrawer(t('playlistView.songEdit.coverPickLibrary'));
    },

    /** Mở khung picker (`workflowGenericDrawerHelpers.mountMediaPicker()`, 90vh), đợi drawer trượt xong rồi
     * mới đọc DB + dựng lưới. Danh sách qua `listPickableMedia()` — bỏ ảnh thuộc folder Hidden.
     * @param {string} title
     */
    async _openImagePickerDrawer(title) {
        workflowGenericDrawerHelpers.mountMediaPicker({ routerName: 'fileManagerPhoto', msgPrefix: 'fileManagerPhoto.imagePicker', title, bodyHtml: this._buildImagePickerBodyHtml(), tileSelector: '[data-image-key]', tileDataKey: 'imageKey' });

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
        workflowPhotoGalleryWindow.unmount('genericDrawer'); // event/workflow/photo-gallery-window.js
        workflowGenericDrawerHelpers.closeFully();
        _imagePickerSession = null;
    },

    /** MỚI (Giai đoạn 1, rewrite Photo/Album, mục 3c/3d) — resize 1 ảnh lúc upload.
     * SỬA (Giang yêu cầu — "resize theo tỉ lệ 20% width và 20% height") — THAY hẳn cách tính cũ
     * (height CỐ ĐỊNH = PHOTO_ROW_HEIGHT_PX, width suy theo tỉ lệ ảnh gốc). Giờ CẢ 2 chiều đều co
     * theo ĐÚNG 1 hệ số 20% trên chính kích thước ảnh gốc — tỉ lệ ảnh (aspect ratio) TỰ giữ nguyên
     * (co đều 2 chiều cùng hệ số), KHÔNG còn phụ thuộc `PHOTO_ROW_HEIGHT_PX` nữa (hằng số đó giờ
     * CHỈ còn dùng cho `rowHeight` truyền vào fjGallery — chiều cao HIỂN THỊ trong lưới, KHÁC hẳn
     * kích thước THẬT của file `thumbBlob` lưu trong DB).
     * Trả thêm `width`/`height` GỐC (trước resize) để fjGallery (thư viện, xem event/workflow/
     * photo-gallery-window.js) tính tỉ lệ hiển thị MÀ KHÔNG cần decode ảnh lại lúc dựng lưới.
     * Đặt ở Workflow (KHÔNG phải core/file-manager/image.js) vì cần `Image`/`canvas` — DOM API, core
     * không được đụng theo Rule 1-4. Dùng CHUNG bởi `playlist.js::uploadPhotos()` VÀ
     * `workflowImageEdit` (event/workflow/image-edit.js — Lưu đè/Lưu mới cũng cần resize thumbnail).
     * @param {File} file
     * @returns {Promise<{thumbBlob: Blob, width: number, height: number}>}
     */
    resizeImageForThumbnail(file) {
        return new Promise((resolve, reject) => {
            const objectUrl = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const width = img.naturalWidth;
                const height = img.naturalHeight;
                const targetWidth = Math.max(1, Math.round(width * THUMBNAIL_SCALE_RATIO)); // guard: tối thiểu 1px, tránh canvas rộng 0 nếu ảnh hỏng tỉ lệ
                const targetHeight = Math.max(1, Math.round(height * THUMBNAIL_SCALE_RATIO));
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                URL.revokeObjectURL(objectUrl);
                canvas.toBlob((thumbBlob) => {
                    if (!thumbBlob) { reject(new Error('[resizeImageForThumbnail] canvas.toBlob trả về null')); return; }
                    resolve({ thumbBlob, width, height });
                }, 'image/jpeg', 0.82);
            };
            img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('[resizeImageForThumbnail] không đọc được ảnh để resize')); };
            img.src = objectUrl;
        });
    },

    /** DỜI (06/10/2026) — thân hàm sang event/workflow/photo-duration.js (workflowPhotoDuration.compute(), dùng chung với
     * trang video-editor.html — nút Chụp lưu ảnh mới). Tên cũ giữ làm cửa ngõ cho mọi nơi gọi (uploadPhotos(),
     * saveEditOverwrite()). @param {File|Blob} file @param {number} width @param {number} height @returns {Promise<number>} */
    computePhotoDuration(file, width, height) {
        return workflowPhotoDuration.compute(file, width, height); // event/workflow/photo-duration.js
    },

    /** Ứng với mục "Edit image" trong dropdown action-menu dòng Photo ở Playlist (event/workflow/
     * playlist.js) — KHÔNG còn mở từ tap ảnh trong list item (tap ảnh giờ PHÁT ảnh làm track như
     * Song/Video, xem event/router/playlist.js case 'playlist.item.playClick').
     * DUY NHẤT 1 mặt canvas dùng chung xem/zoom/pan/edit (Giang chốt, KHÔNG có khái niệm "mode") —
     * decode ảnh vào canvas NGAY LÚC MỞ MODAL (`workflowImageEdit.ensureEditSessionReady()`,
     * Workflow-gọi-Workflow tự do), KHÔNG đợi bấm icon Edit. Zoom (Panzoom) bật NGAY qua
     * `_initZoom()`, chạy LIÊN TỤC suốt vòng đời modal.
     * Tăng `count` trong `mediaStatsMap` (dùng CHUNG với Song/Video, Sort trục thống kê đọc field
     * này — ý nghĩa đổi thành "lượt click xem" cho Photo) mỗi lần mở xem.
     * XOÁ (06/10/2026, Giang xoá action "View full thumbnail" của Video) — tham số 2 `viewOnlyImage` (chế độ CHỈ XEM
     * 1 ảnh ngoài bảng ảnh, sinh ra RIÊNG cho action đó) bỏ hẳn; hàm về đúng hành vi trước 19/09/2026.
     * @param {string} imageKey
     */
    async openImagePreview(imageKey) {
        const record = await getImageRecord(imageKey); // data layer (service/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác
        const image = { key: imageKey, ...record };

        this._activeImageKey = imageKey; // workflowImageEdit cần lại lúc decode canvas
        workflowListenStats.bumpPlayCount('photo', imageKey); // event/workflow/listen-stats.js — Photo dùng làm "lượt click xem" (SỬA 06/10/2026: thêm loại media)

        this._activeImageModalHandle = openImagePreviewModal(image); // core/file-manager/photo-ui.js — KHÔNG còn callbacks (Rule 5a, Core tự bắn eventBus cố định), Router gọi lại các hàm dưới đây, đọc _activeImageKey thay vì closure
        this._initZoom();
        workflowImageEdit.ensureEditSessionReady(); // event/workflow/image-edit.js — decode canvas NGAY, không đợi bấm Edit (không await — modal đã hiện `<img>` tức thời, canvas tự vẽ đè lên khi decode xong)
    },

    /** Bật Panzoom trên `mediaWrap` (bọc CHUNG `<img>` + canvasWrap, core/file-manager/photo-ui.js)
     * — KHÔNG gắn thẳng `<img>` (canvas vẽ ĐÈ lên `<img>` ngay khi decode xong, không phải toggle
     * ẩn/hiện qua lại — gắn Panzoom lên `mediaWrap` thì việc đó không hề ảnh hưởng session). Gọi
     * hàm này ĐÚNG 1 LẦN lúc mở modal (`openImagePreview()`), chạy tới khi đóng hẳn modal
     * (`closeImagePreview()`).
     * `exclude: [interactCanvas]` — interactCanvas tự có pointer handler riêng (kéo khung Crop/nét
     * Vẽ/chạm Tách nền, wire ở core/file-manager/photo-ui.js), KHÔNG để Panzoom giành mất cử chỉ đó
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
     * Router gọi khi bấm X (không còn Block gate nào chặn — GỘP View/Zoom/Edit làm 1, xem
     * event/block.js).
     */
    closeImagePreview() {
        if (this._activePanzoomSession) { destroyPanzoomSession(this._activePanzoomSession); this._activePanzoomSession = null; } // core/media-transform.js
        workflowImageEdit.exitEditMode();
        if (this._activeImageModalHandle) { this._activeImageModalHandle.close(); this._activeImageModalHandle = null; }
    },

    // XOÁ (Giang yêu cầu bỏ "Đặt làm nền Playlist") — setAsPlaylistBackground() (nút header modal
    // xem ảnh) bỏ hẳn cùng tính năng, không còn entry point nào gọi tới applyBgImage() từ Photo (hàm này cũng đã xoá 21/09/2026).
    // XOÁ (loại bỏ Album khỏi Photo Panel) — setAsSlideshowBackground() (nút "Dùng làm nền
    // Slideshow" ở thanh quản lý album) bỏ hẳn — Visual Background mất tuỳ chọn "Nhóm ảnh" tạm
    // thời, sẽ thay bằng Folder Photo (File Browser overhaul, đợt riêng, pending).
};
