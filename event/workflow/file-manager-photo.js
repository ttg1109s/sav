/**
 * event/workflow/file-manager-photo.js — "THẰNG THỰC THI CUỐI" cho phần còn lại của miền Photo sau
 * khi Photo Panel full-screen bị xoá (hợp nhất vào Playlist làm 1 Source, xem event/workflow/
 * playlist.js::switchToPhotoSource()). Còn 2 nhóm việc:
 *   1. Modal xem ảnh full-screen — mở từ mục "Edit image" trong dropdown dòng Photo ở Playlist
 *      (event/workflow/playlist.js), KHÔNG còn mở từ tap ảnh trong lưới cũ. View/Zoom/Edit đã GỘP
 *      làm 1, KHÔNG có khái niệm "mode" nào cần thoát (bỏ dropdown "..." cũ) — Zoom (Panzoom) LUÔN
 *      bật ngay lúc mở modal (`_initZoom()`), Edit mở qua icon cố định trên header (xem
 *      event/workflow/image-edit.js), chỉ tạm dừng Zoom lúc Edit đang hiện canvas thay `<img>`
 *      (`pauseZoomForEdit()` dưới đây, gọi chéo từ image-edit.js — KHÔNG có chiều ngược lại "khôi
 *      phục Zoom", đóng Generic Drawer chỉ đóng Drawer, canvas vẫn hiện nguyên).
 *   2. Picker chọn 1 ảnh dùng chung qua Generic Drawer (cover bài hát/nền Theme) — gọi bởi
 *      playlist.js::pickCoverFromLibrary() và theme.js::pickNewBackgroundImage().
 * `resizeImageForThumbnail()`/`computePhotoDuration()` DÙNG CHUNG với playlist.js::uploadPhotos()
 * (upload ảnh giờ qua nút upload chung của Playlist) và image-edit.js::saveEditOverwrite().
 *
 * NẠP SAU: core/file-manager/image.js, core/file-manager/photo-ui.js, core/media-transform.js
 * (initPanzoomSession/destroyPanzoomSession), core/media-picker-drawer-helper.js,
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

// 4 hằng số cho `computePhotoDuration()` ngay dưới (Photo tích hợp `duration` như Song/Video, thừa
// hưởng Play/Next-Prev/Shuffle của Playlist). Công thức TUYẾN TÍNH THẲNG theo weight, KHÔNG trần
// trên (Giang chốt "không kẹp max") — file càng lớn/độ phân giải càng cao, duration càng tăng.
const DURATION_MIN_SEC = 5;          // sàn — tránh ảnh siêu nhỏ ra duration gần 0 vô nghĩa (KHÔNG phải trần).
const DURATION_PIXEL_WEIGHT = 2;     // 1 pixel ảnh gốc "nặng" tương đương bao nhiêu byte trong công thức.
const DURATION_PER_WEIGHT_SEC = 0.00000125; // giây CỘNG THÊM cho mỗi 1 byte-tương-đương weight.
const DURATION_JITTER_SEC = 0.4;     // biên độ jitter TỐI ĐA từ SHA-256 — chỉ phá trùng số tuyệt đối
                                      // giữa 2 ảnh CÙNG weight, không đủ lớn để đảo thứ tự.

const workflowFileManagerPhoto = {

    _activeImageModalHandle: null, // { close, imgEl, canvasWrap, baseCanvas, renderCanvas, interactCanvas, toolsBtn, adjustPopup, ... } của modal xem ảnh đang mở — null khi không mở modal nào
    _activePanzoomSession: null,   // session Panzoom (core/media-transform.js) — LUÔN chạy trong lúc xem ảnh thường; null trong lúc đang Edit mode (canvas thay img) hoặc modal đã đóng
    _activeImageKey: null,         // key ảnh đang mở modal — workflowImageEdit đọc lại qua getActiveImageKey()

    /** 2 khe ĐỌC hẹp cho workflowImageEdit (miền khác — event/workflow/image-edit.js) tự lấy
     * lại handle/imageKey của modal đang mở lúc `enterEditMode()`, KHÔNG cần workflow đó
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

    // ===================== Picker ảnh dùng chung (Generic Drawer) — single-select (chọn 1 ảnh, vd
    // bìa bài hát/Theme Background) — tap ẢNH NÀO là chọn NGAY ảnh đó + đóng drawer. ==============

    /** Chọn 1 ảnh làm bìa bài hát HOẶC ảnh nền Theme — single-select: bấm ẢNH NÀO là chọn NGAY ảnh
     * đó + đóng drawer, KHÔNG có nút xác nhận riêng. Gọi TỪ event/workflow/playlist.js::
     * pickCoverFromLibrary() VÀ event/workflow/theme.js::pickNewBackgroundImage() (Workflow gọi
     * Workflow miền khác, TỰ DO theo event-bus-flow.md mục 4B).
     * @param {(imageKey: string) => void} onSelect
     * @param {() => void} [onCancel] - gọi khi đóng picker MÀ CHƯA chọn gì (nút X) — nơi gọi tự trả
     *        toggle "On" về "off" nếu có.
     */
    async openCoverImagePicker(onSelect, onCancel) {
        _imagePickerSession = { onSelect, onCancel, hasSelected: false };
        await this._openImagePickerDrawer(t('playlistView.songEdit.coverPickLibrary'));
    },

    /** Dựng khung Generic Drawer cho picker ảnh. Nghiệp vụ THẬT (chọn 1 ảnh) tách hẳn ở
     * `handleImagePickerTileClick()` bên dưới, KHÔNG lẫn vào hàm dựng khung này.
     * Height `90vh` (mặc định `70vh` của Generic Drawer không đủ chỗ cho lưới ảnh cuộn thoải mái).
     * Trình tự ĐÃ CHỐT: drawer trượt lên xong HẲN (nghe `transitionend` THẬT, core/generic-
     * drawer.js) -> đọc DB + windowing.
     * @param {string} title
     */
    async _openImagePickerDrawer(title) {
        // Rule 5a — dựng Generic Drawer + wire closeBtn/delegated click lưới ảnh nằm ở CORE
        // (core/media-picker-drawer-helper.js::openMediaPickerDrawerUi(), dùng chung picker ảnh/
        // video), Workflow chỉ gọi Core với data đã chuẩn bị sẵn (title/bodyHtml).
        openMediaPickerDrawerUi('fileManagerPhoto', 'fileManagerPhoto.imagePicker', title, this._buildImagePickerBodyHtml(), '[data-image-key]', 'imageKey', false); // core/media-picker-drawer-helper.js

        await new Promise((resolve) => {
            genericDrawerPanel.addEventListener('transitionend', function onOpenTransitionEnd() {
                genericDrawerPanel.removeEventListener('transitionend', onOpenTransitionEnd);
                resolve();
            }, { once: true });
        });

        const images = await listImages(); // core/file-manager/image.js
        if (!_imagePickerSession) return; // guard — user đóng picker RẤT NHANH trong lúc đang đọc DB (hiếm, nhưng an toàn — tránh vẽ vào drawer đã đóng)

        const scrollEl = genericDrawerBody.querySelector('#file-manager-image-picker-scroll');
        const emptyEl = genericDrawerBody.querySelector('#file-manager-image-picker-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', images.length > 0);
        this.setupPhotoGridWindow(scrollEl, images);
    },

    /** HTML khung picker: scroll container (grid windowing sẽ chèn vào TRONG đây). Đặt ở Workflow —
     * hàm THUẦN chỉ trả string (không `createElement`/`addEventListener`), KHÔNG thuộc phạm vi
     * Rule 5a/5c, khác hẳn phần dựng+wire Generic Drawer thật (đã dời sang core/media-picker-
     * drawer-helper.js::openMediaPickerDrawerUi()).
     * @returns {string}
     */
    _buildImagePickerBodyHtml() {
        return `
            <div class="flex-1 min-h-0 overflow-y-auto relative" id="file-manager-image-picker-scroll">
                <p id="file-manager-image-picker-empty" class="hidden text-sm text-slate-400 text-center py-10 px-6">${t('fileManager.photo.image.empty')}</p>
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

    /** MỚI (Giang yêu cầu — Photo tích hợp `duration` như Song/Video, thừa hưởng đúng cơ chế Play/
     * Next-Prev/Shuffle của Playlist, im lặng hoàn toàn lúc hiển thị — xác nhận qua trao đổi trực
     * tiếp, KHÔNG phải "thời gian hiển thị cố định" kiểu Slideshow VBG cũ) — tính `duration` (giây,
     * số thực) HOÀN TOÀN deterministic từ CHÍNH nội dung file (cùng file luôn ra cùng số — không lưu
     * seed random rời rạc nào).
     *
     * CÔNG THỨC (2 bước, hằng số DURATION_* khai báo đầu file — GIÁ TRỊ TẠM, xem comment ở đó):
     *   1. weight   = fileSize (byte) + DURATION_PIXEL_WEIGHT × (width × height)
     *   2. duration = DURATION_MIN_SEC + weight × DURATION_PER_WEIGHT_SEC + jitter
     * TUYẾN TÍNH THẲNG, KHÔNG TRẦN (Giang chốt "không kẹp max") — file càng lớn/độ phân giải càng
     * cao, duration cứ thế tăng theo, không có ngưỡng tiệm cận hay min()/clamp() nào chặn trên.
     * `DURATION_MIN_SEC` là SÀN (không phải trần) — chỉ để ảnh siêu nhỏ không ra duration gần 0.
     * `jitter` (0 → DURATION_JITTER_SEC giây) lấy từ 4 byte đầu SHA-256 của CHÍNH file — CHỈ để 2
     * ảnh CÙNG weight (size + resolution giống hệt) không trùng số tuyệt đối, biên độ nhỏ hơn NHIỀU
     * bước nhảy thật của phần tuyến tính nên KHÔNG đảo thứ tự "ảnh nặng hơn -> duration dài hơn".
     *
     * SHA-256 qua Web Crypto (`crypto.subtle.digest`, native, không cần thư viện) — CẦN secure
     * context (`https:`/`localhost` chắc chắn có; `file:` đã xác nhận hoạt động trên Chromium, CHƯA
     * test Safari/WebKit). Guard `crypto.subtle` không tồn tại -> `duration` vẫn tính bình thường,
     * chỉ `jitter = 0` (KHÔNG chặn cả tiến trình upload chỉ vì thiếu 1 phần jitter).
     *
     * Đặt ở Workflow (không phải core/file-manager/image.js) vì cần `File.arrayBuffer()` — cùng lý
     * do `resizeImageForThumbnail()` ở Workflow (Rule 1-4). Dùng CHUNG bởi `playlist.js::
     * uploadPhotos()` VÀ `image-edit.js::saveEditOverwrite()` (ảnh sửa xong đổi kích thước/dung
     * lượng -> tính lại cho nhất quán).
     * @param {File|Blob} file - blob ẢNH GỐC (không phải thumbBlob).
     * @param {number} width - chiều rộng ảnh gốc (px).
     * @param {number} height - chiều cao ảnh gốc (px).
     * @returns {Promise<number>} duration (giây, số thực, làm tròn 2 chữ số thập phân, KHÔNG có trần trên)
     */
    async computePhotoDuration(file, width, height) {
        const weight = file.size + DURATION_PIXEL_WEIGHT * (width * height);
        let jitter = 0;
        if (window.crypto && window.crypto.subtle) {
            try {
                const digestBuffer = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
                const first4Bytes = new DataView(digestBuffer).getUint32(0); // 0 .. 4294967295
                jitter = (first4Bytes / 4294967295) * DURATION_JITTER_SEC;
            } catch (err) {
                console.error('[computePhotoDuration] crypto.subtle.digest lỗi, bỏ qua jitter:', err);
            }
        }
        const duration = DURATION_MIN_SEC + weight * DURATION_PER_WEIGHT_SEC + jitter;
        return Math.round(duration * 100) / 100;
    },

    /** Ứng với mục "Edit image" trong dropdown action-menu dòng Photo ở Playlist (event/workflow/
     * playlist.js) — KHÔNG còn mở từ tap ảnh trong list item (tap ảnh giờ PHÁT ảnh làm track như
     * Song/Video, xem event/router/playlist.js case 'playlist.item.playClick').
     * GỘP View/Zoom/Edit làm 1 — Zoom (Panzoom) tự bật NGAY qua `_initZoom()`, không còn chờ người
     * dùng bật tay. Tăng `count` trong `mediaStatsMap` (dùng CHUNG với Song/Video, Sort trục thống
     * kê đọc field này — ý nghĩa đổi thành "lượt click xem" cho Photo) mỗi lần mở xem.
     * @param {string} imageKey
     */
    async openImagePreview(imageKey) {
        const record = await getImageRecord(imageKey); // data layer (service/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác
        const image = { key: imageKey, ...record };

        this._activeImageKey = imageKey; // Edit mode cần lại lúc decode canvas (enterEditMode())
        bumpSongPlayCount(imageKey); // core/listen-stats.js — tên hàm giữ nguyên (dùng CHUNG cho mọi mediaType), Photo dùng làm "lượt click xem"

        this._activeImageModalHandle = openImagePreviewModal(image); // core/file-manager/photo-ui.js — KHÔNG còn callbacks (Rule 5a, Core tự bắn eventBus cố định), Router gọi lại các hàm dưới đây, đọc _activeImageKey thay vì closure
        this._initZoom();
    },

    /** Bật Panzoom trên `<img>` của modal đang mở — LUÔN gọi ngay khi mở modal
     * (`openImagePreview()`). Tự huỷ session cũ trước nếu lỡ còn (an toàn khi lỡ gọi 2 lần liên
     * tiếp).
     */
    _initZoom() {
        if (!this._activeImageModalHandle) return; // guard: hiếm, modal đã đóng ở đâu đó trước khi tới đây
        if (this._activePanzoomSession) { destroyPanzoomSession(this._activePanzoomSession); this._activePanzoomSession = null; } // core/media-transform.js
        this._activePanzoomSession = initPanzoomSession(this._activeImageModalHandle.imgEl, { // core/media-transform.js
            maxScale: 4,
            minScale: 1,
            contain: 'outside',
        });
    },

    /** Tạm dừng Zoom TRƯỚC khi vào Edit mode — Edit ẩn hẳn `<img>` (thay bằng canvasWrap), Panzoom
     * đang gắn trên `<img>` phải huỷ trước, không thì thao tác pan/zoom cũ còn treo trên 1 phần tử
     * đã ẩn. Workflow-gọi-Workflow tự do (event/workflow/image-edit.js::enterEditMode() gọi hàm
     * này). KHÔNG có chiều ngược lại "khôi phục Zoom" — không có khái niệm thoát Edit về xem ảnh
     * thường (đóng Generic Drawer chỉ đóng Drawer, canvas vẫn hiện nguyên); Zoom chỉ thật sự bật
     * lại nếu mở 1 ảnh MỚI khác (`openImagePreview()` gọi `_initZoom()` lại từ đầu).
     */
    pauseZoomForEdit() {
        if (this._activePanzoomSession) { destroyPanzoomSession(this._activePanzoomSession); this._activePanzoomSession = null; } // core/media-transform.js
    },

    /** Đóng THẬT modal xem ảnh — dọn phiên Panzoom nếu còn + dọn Edit mode nếu còn + đóng handle.
     * Router gọi khi bấm X (không còn Block gate nào chặn — GỘP View/Zoom/Edit làm 1, xem
     * event/block.js) và bởi Router khi bấm "Đặt làm nền Playlist" (đóng modal NGAY sau khi bắn
     * hành động, xem event/router/file-manager-photo.js).
     */
    closeImagePreview() {
        if (this._activePanzoomSession) { destroyPanzoomSession(this._activePanzoomSession); this._activePanzoomSession = null; } // core/media-transform.js
        workflowImageEdit.exitEditMode();
        if (this._activeImageModalHandle) { this._activeImageModalHandle.close(); this._activeImageModalHandle = null; }
    },

    // XOÁ (Giang yêu cầu bỏ "Đặt làm nền Playlist") — setAsPlaylistBackground() (nút header modal
    // xem ảnh) bỏ hẳn cùng tính năng, không còn entry point nào gọi tới applyBgImage() từ Photo.
    // XOÁ (loại bỏ Album khỏi Photo Panel) — setAsSlideshowBackground() (nút "Dùng làm nền
    // Slideshow" ở thanh quản lý album) bỏ hẳn — Visual Background mất tuỳ chọn "Nhóm ảnh" tạm
    // thời, sẽ thay bằng Folder Photo (File Browser overhaul, đợt riêng, pending).
};
