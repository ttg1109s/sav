/**
 * event/workflow/file-manager-photo.js — "THẰNG THỰC THI CUỐI" cho phần còn lại của miền Photo sau
 * khi Photo Panel full-screen bị xoá (hợp nhất vào Playlist làm 1 Source, xem event/workflow/
 * playlist.js::switchToPhotoSource()). Còn 2 nhóm việc:
 *   1. Modal xem ảnh full-screen (Zoom/Edit mode, dropdown action "...") — mở từ mục "Edit image"
 *      trong dropdown dòng Photo ở Playlist (event/workflow/playlist.js), KHÔNG còn mở từ tap ảnh
 *      trong lưới cũ.
 *   2. Picker chọn 1 ảnh dùng chung qua Generic Drawer (cover bài hát/nền Theme) — gọi bởi
 *      playlist.js::pickCoverFromLibrary() và theme.js::pickNewBackgroundImage().
 * `resizeImageForThumbnail()`/`computePhotoDuration()` DÙNG CHUNG với playlist.js::uploadPhotos()
 * (upload ảnh giờ qua nút upload chung của Playlist) và image-edit.js::saveEditOverwrite().
 *
 * NẠP SAU: core/file-manager/image.js, core/file-manager/photo-ui.js, core/media-picker-drawer-
 * helper.js, core/generic-drawer.js.
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
    _activePanzoomSession: null,   // session Panzoom đang chạy khi ở Zoom mode — null khi không ở Zoom mode (core/image-zoom.js)
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
     * MỚI (31/07/2026, Zoom mode) — giữ `modalHandle` ở `this._activeImageModalHandle` (Router cần
     * lại lúc xử lý toggle Zoom/nút X đóng — xem enterZoomMode()/exitImagePreviewMode()/
     * closeImagePreview()). `imagePreviewMode` reset về 'view' mỗi lần mở modal MỚI.
     * Tăng `count` trong `mediaStatsMap` (dùng CHUNG với Song/Video, Sort trục thống kê đọc field
     * này — ý nghĩa đổi thành "lượt click xem" cho Photo) mỗi lần mở xem.
     * @param {string} imageKey
     */
    async openImagePreview(imageKey) {
        const record = await getImageRecord(imageKey); // data layer (service/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác
        const image = { key: imageKey, ...record };

        this._activeImageKey = imageKey; // MỚI (31/07/2026) — Edit mode cần lại lúc decode canvas (enterEditMode())
        appState.set('imagePreviewMode', 'view');
        console.log(`writer: "openImagePreview", page: "imagePreviewMode", content: "view"`);
        bumpSongPlayCount(imageKey); // core/listen-stats.js — tên hàm giữ nguyên (dùng CHUNG cho mọi mediaType), Photo dùng làm "lượt click xem"

        this._activeImageModalHandle = openImagePreviewModal(image); // core/file-manager/photo-ui.js — KHÔNG còn callbacks (Rule 5a, Core tự bắn eventBus cố định), Router gọi lại các hàm dưới đây, đọc _activeImageKey thay vì closure
    },

    /** Ứng với 'fileManagerPhoto.imagePreview.menu.click' — dropdown "..." của modal xem ảnh
     * (core/dropdown-menu.js), `zIndex: 132` — TRÊN modal xem ảnh (`Z_INDEX.IMAGE_PREVIEW`, 130).
     * `dispatch(action)` bắn `imageMenu.action.click` (Router file này xử lý — CHỈ 2 action còn lại
     * là trách nhiệm THẬT của miền Photo: setPlaylistBg/delete, đóng modal NGAY).
     * "Zoom view" (miền Photo)/"Edit" (miền `imageEdit`)/"Lưu đè"/"Lưu mới" (miền `imageEdit`) đều
     * bắn eventBus TRỰC TIẾP theo ĐÚNG router chịu trách nhiệm — KHÔNG qua `dispatch()`, KHÔNG đóng
     * modal (đều tự đóng/tự toggle ở nơi xử lý thật). Nhãn "Zoom view"/"Edit" đổi theo mode hiện tại
     * (đang Zoom -> "Thoát Zoom view", đang Edit -> "Thoát Edit").
     * XOÁ (loại bỏ Album khỏi Photo Panel) — item "Xoá khỏi album" bỏ hẳn cùng tính năng.
     * @param {HTMLElement} anchorEl - nút "..." vừa bấm.
     */
    openImageActionMenu(anchorEl) {
        const imageKey = this._activeImageKey;
        // SỬA (v13 Batch F) — TÁCH msg.type riêng cho từng hành động ("quyết định") thay vì 1
        // msg.type chung kèm `payload.action` — mỗi msg.type mô tả ĐÚNG 1 hành động, Block gate
        // (event/block.js) đăng ký được thẳng vào hành động xoá không cần điều kiện `payload.action`.
        const dispatch = (type) => {
            this.closeImagePreview();
            eventBus.send({ router: 'fileManagerPhoto', type, payload: { imageKey } });
        };
        const isZooming = appState.get('imagePreviewMode') === 'zoom';
        const isEditing = appState.get('imagePreviewMode') === 'edit';
        const items = [
            { icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>', name: t('fileManager.photo.image.btnSetPlaylistBg'), callback: () => dispatch('fileManagerPhoto.imageMenu.setPlaylistBg.click') },
            { icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"/></svg>', name: t(isZooming ? 'fileManager.photo.image.btnExitZoom' : 'fileManager.photo.image.btnZoom'), callback: () => eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imagePreview.zoomToggle.click', payload: {} }) },
            { icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>', name: t(isEditing ? 'fileManager.photo.image.btnExitEdit' : 'fileManager.photo.image.btnEditImage'), callback: () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.toggle.click', payload: {} }) },
        ];
        // MỚI (31/07/2026) — CHỈ hiện khi đang ở Edit mode (đúng chốt Giang: "thêm dropdown action
        // cho lưu đè, lưu mới" — ĐÚNG 2 action MỚI duy nhất, còn lại các item khác giữ nguyên bất kể
        // mode).
        // SỬA (31/07/2026, Giang chỉ ra "đừng viện dẫn workflow xuyên miền để biện minh giữ routing
        // sai chỗ") — 2 item này KHÔNG còn qua `dispatch()` (msg.type dùng chung 'imageMenu.action.
        // click', router `fileManagerPhoto`) nữa — bắn THẲNG sang router `imageEdit` (đúng miền
        // trách nhiệm của "Lưu đè"/"Lưu mới", xem event/router/image-edit.js), KHÔNG đóng modal
        // (saveEditOverwrite()/saveEditAsNew() tự đóng SAU KHI lưu xong — cần handle.renderCanvas
        // còn sống lúc chạy).
        if (isEditing) {
            items.push({ icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1-4l-4 4m0 0L7 3m4 4V1"/></svg>', name: t('fileManager.photo.image.btnSaveOverwrite'), callback: () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.saveOverwrite.click', payload: {} }) });
            items.push({ icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15"/></svg>', name: t('fileManager.photo.image.btnSaveNew'), callback: () => eventBus.send({ router: 'imageEdit', type: 'imageEdit.saveAsNew.click', payload: {} }) });
        }
        // XOÁ (Giang yêu cầu bỏ nút xoá ảnh khỏi dropdown — sau khi xoá Photo Panel, dropdown này
        // không có cách nào refresh lại danh sách Playlist đứng sau modal, xoá ảnh xong list vẫn
        // hiện ảnh cũ tới khi reload/chuyển source) — btnDelete/`fileManagerPhoto.imageMenu.
        // delete.click` bỏ hẳn. Muốn xoá ảnh, dùng action-menu của dòng Photo trong Playlist
        // (core/playlist/actions.js), nơi đã có sẵn refresh đúng.

        openDropdownMenu(anchorEl, items, { zIndex: 132 }); // core/dropdown-menu.js
    },

    /** Vào Zoom mode (bấm "Zoom view" trong dropdown lúc `imagePreviewMode==='view'`) — init Panzoom
     * (core/image-zoom.js) thẳng trên `<img>` của modal đang mở. Ứng với 1 nhánh
     * VirtualMachineState ở Router (event/router/file-manager-photo.js, case
     * 'fileManagerPhoto.imagePreview.zoomToggle.click').
     * SỬA (31/07/2026, mục 1/3 phản hồi Giang) — trước đây case là 'imageMenu.action.click',
     * action==='zoom' (msg.type dùng chung) — đã tách ra msg.type RIÊNG (xem docstring
     * `openImageActionMenu()`), cập nhật lại tham chiếu ở đây cho khớp.
     */
    enterZoomMode() {
        if (!this._activeImageModalHandle) return; // guard: hiếm, modal đã đóng ở đâu đó trước khi tới đây
        appState.set('imagePreviewMode', 'zoom');
        console.log(`writer: "enterZoomMode", page: "imagePreviewMode", content: "zoom"`);
        this._activePanzoomSession = initPanzoomSession(this._activeImageModalHandle.imgEl, { // core/image-zoom.js
            maxScale: 4,
            minScale: 1,
            contain: 'outside',
        });
    },

    /** Thoát Zoom/Edit mode về 'view' (bấm lại item TOGGLE tương ứng trong dropdown lúc đang ở mode
     * đó) — huỷ phiên Panzoom nếu còn, dọn Edit mode qua `workflowImageEdit.exitEditMode()` (miền
     * khác, event/workflow/image-edit.js — Workflow-gọi-Workflow tự do, không qua Router lại). Cả 2
     * hàm dọn đều tự guard AN TOÀN gọi khi không ở mode tương ứng.
     */
    exitImagePreviewMode() {
        if (this._activePanzoomSession) { destroyPanzoomSession(this._activePanzoomSession); this._activePanzoomSession = null; } // core/image-zoom.js
        workflowImageEdit.exitEditMode();
        appState.set('imagePreviewMode', 'view');
        console.log(`writer: "exitImagePreviewMode", page: "imagePreviewMode", content: "view"`);
    },

    /** Đóng THẬT modal xem ảnh — dọn phiên Panzoom nếu còn + dọn Edit mode nếu còn + đóng handle +
     * reset `imagePreviewMode` về 'view'. Dùng ở 2 nơi: (1) Router gọi khi bấm X KHÔNG bị Block gate
     * chặn (`imagePreviewMode==='view'` lúc đó, xem event/block.js), (2) `openImageActionMenu()` cho
     * 2 action "quyết định" (setPlaylistBg/delete) — LUÔN đóng bất kể mode hiện tại.
     */
    closeImagePreview() {
        if (this._activePanzoomSession) { destroyPanzoomSession(this._activePanzoomSession); this._activePanzoomSession = null; } // core/image-zoom.js
        workflowImageEdit.exitEditMode();
        if (this._activeImageModalHandle) { this._activeImageModalHandle.close(); this._activeImageModalHandle = null; }
        appState.set('imagePreviewMode', 'view');
        console.log(`writer: "closeImagePreview", page: "imagePreviewMode", content: "view"`);
    },

    /** Ứng với nút "Đặt làm nền Playlist" trong modal xem ảnh — TÁI DÙNG NGUYÊN applyBgImage().
     * Batch "nền chung" (07/07/2026) — applyBgImage() Rule 1-4 đầy đủ (không tự updatePlaylistBg/
     * saveConfig nội bộ), nơi gọi (ở đây) tự lo.
     * @param {string} imageKey
     */
    async setAsPlaylistBackground(imageKey) {
        const record = await getImageRecord(imageKey); // data layer (service/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác

        await withLoadingShield(t('common.loading.savingImageBg'), async () => {
            await applyBgImage(record.blob); // core có sẵn (core/visualizer/visualizer-display.js)
        });
        updatePlaylistBg();
        forceGlassRepaint(); // fix bug 09/07/2026 (mục 3, xem docstring core/color-utils.js)
        saveConfig();
        await alertModal(t('fileManager.photo.image.setPlaylistBgSuccess'));
    },

    // XOÁ (loại bỏ Album khỏi Photo Panel) — setAsSlideshowBackground() (nút "Dùng làm nền
    // Slideshow" ở thanh quản lý album) bỏ hẳn — Visual Background mất tuỳ chọn "Nhóm ảnh" tạm
    // thời, sẽ thay bằng Folder Photo (File Browser overhaul, đợt riêng, pending).
};
