/**
 * event/workflow/file-manager-photo.js — Batch 3 (03/07/2026), "THẰNG THỰC THI CUỐI" cho panel
 * Photo & Album. Mọi method nhận `activeAlbumId` qua THAM SỐ (context sống ở Router, xem
 * event/router/file-manager-photo.js) — workflow không tự giữ state UI riêng (TRỪ tham chiếu
 * panel, xem Batch D6 dưới).
 *
 * MỚI (batch tiếp theo 03/07/2026, mục 2.2/2.3 plan-v12-multimedia-update-2.md — nợ kỹ thuật đã
 * xác nhận từ Batch 3): renameAlbumById/deleteAlbumById (Đổi tên/Xoá album đang lọc, cùng khuôn
 * renameFolderById/deleteFolderById ở event/workflow/file-manager-song.js) +
 * toggleImageSelectionInSet/confirmAddSelectedImages (chọn nhiều ảnh có sẵn -> thêm vào album đang
 * lọc, core addImagesToAlbum() đã sẵn sàng nhận từ Batch 3).
 *
 * NẠP SAU: core/file-manager/image.js, core/file-manager/album.js, core/file-manager/photo-ui.js,
 * core/settings-panel-stack.js (pushSettingsPanel).
 *
 * MỚI (Batch 8, 03/07/2026, slideshow nền Visual): `setAsSlideshowBackground()` (nút "Dùng làm nền
 * Slideshow" ở thanh quản lý album) + cascade dọn `activeBackgroundAlbum` trong `deleteAlbumById()`
 * khi album vừa xoá đang là nguồn nền active — cả 2 đều gọi `workflowSlideshow`
 * (event/workflow/slideshow.js) — NẠP SAU file đó.
 *
 * === Batch D6 (Settings restructure, 06/07/2026) ===
 * Panel Photo giờ push/pop động (core/settings-panel-stack.js) — `fileManagerPhotoPanelEl` (biến
 * module bên dưới) lưu panel đang mở, cùng pattern đã dùng ở Slideshow/Song (event/workflow/
 * slideshow.js::slideshowSettingsPanelEl, event/workflow/file-manager-song.js::
 * fileManagerSongPanelEl) — KHÔNG chủ động null-hoá lúc đóng (vô hại, lý do y hệt 2 nơi kia).
 * `renderAlbumStory`/`updateImageSelectionCount` (core/file-manager/photo-ui.js) nhận phần tử qua
 * tham số — mọi method dưới đây tự `querySelector` bên trong `fileManagerPhotoPanelEl` rồi truyền
 * vào. Modal (openCreateAlbumModal/openRenameAlbumModal/openImagePreviewModal...) KHÔNG cần đổi gì
 * — tự dựng overlay ĐỘC LẬP (document.body), không phụ thuộc panel.
 *
 * PATCH mục 2 (14/07/2026, "bỏ cách cũ, áp dụng Item + window ảo") — `renderImageMasonry()` (core/
 * file-manager/photo-ui.js) ĐÃ XOÁ. Lưới ảnh giờ qua `setupPhotoGridWindow()` (method MỚI, ngay
 * dưới).
 * ĐẬP ĐI LÀM LẠI (rewrite Photo/Album, Giang yêu cầu "không dùng window virtual tự tạo nữa, dùng
 * thư viện") — `workflowVirtualList.mount()` (event/workflow/virtual-list.js, tự viết, nguồn gốc
 * hàng loạt bug layout/lệch cuộn) XOÁ HẲN — `setupPhotoGridWindow()` giờ gọi
 * `workflowPhotoGalleryWindow.mount()` (event/workflow/photo-gallery-window.js): windowing cấp NHÓM
 * NGÀY qua `IntersectionObserver` (trình duyệt tự lo, không tự nghe 'scroll'/tự tính offset bằng
 * tay nào nữa) + fjGallery (thư viện thật, CDN) lo layout justified thật.
 *
 * TIẾP (14/07/2026, cùng ngày, phản hồi tiếp theo):
 *   1. Nút upload + nút "xoá nhanh" (MỚI, mục 2.2) dời vào `headerActionHtml` (core/settings-panel-
 *      stack-ui.js — MỚI thêm slot này) — `openPanel()` tự build, KHÔNG còn thanh riêng dưới header.
 *   2. Album story — pagination CHỈ toggle CSS `hidden` (Giang đơn giản hoá, KHÔNG cắt mảng/re-
 *      render mỗi lần bấm ‹/› — xem `renderAlbumStory()`/`setAlbumStoryPageVisibility()` core/
 *      file-manager/photo-ui.js). Tile "+" tạo mới ĐÃ tĩnh (components/file-manager.js).
 *   3. Chế độ "xoá nhanh" ảnh — bấm ảnh để ĐÁNH DẤU, bấm icon thùng rác để xoá batch 1 lần (SỬA
 *      Giai đoạn 3, redesign — xem `promptQuickDeleteMode`/`toggleQuickDeleteMarkInSet`/
 *      `confirmQuickDeleteBatch`, docstring chi tiết ở từng hàm).
 *   4. `openPanel()` bọc `withLoadingShield()` quanh lần `refresh()` ĐẦU TIÊN — Giang chỉ ra: DOM
 *      lưới ảnh (nặng — nhiều object URL) KHÔNG được tải song song lúc panel còn đang trượt vào,
 *      phải tải SAU KHI đã vào hẳn, che bằng shield, chỉ tắt khi xong.
 */
let fileManagerPhotoPanelEl = null; // panel Photo đang mở — null nếu đang đóng (Batch D6)
let albumListPanelEl = null; // MỚI (Giai đoạn 3b) — Album List sub-panel đang mở — null nếu đang đóng, cùng pattern fileManagerPhotoPanelEl
let _imagePickerSession = null; // MỚI (Giai đoạn 4) — session picker ảnh Generic Drawer đang mở (null = đang đóng). Handle của UI, KHÔNG phải state nghiệp vụ ảnh hưởng rẽ nhánh Router — cùng loại với 2 biến panel ngay trên, xem docstring openAlbumImagePicker()/openCoverImagePicker() (17/07/2026: từng xoá multiSelectAlbum, 18/07/2026: RESTORE lại, xem lịch sử ở đó)

// ĐÃ GỠ (rewrite Photo/Album, dùng fjGallery) — PHOTO_GRID_HEADER_HEIGHT_PX/PHOTO_GRID_GAP_PX không
// còn dùng: chiều cao header ngày giờ THUẦN CSS (assets/css/style.css::.photo-day-header { height:
// 40px }, không cần JS biết trước nữa — windowing cấp NHÓM NGÀY, không cần cộng dồn chiều cao TỪNG
// HÀNG như bản cũ); khoảng cách giữa ảnh giờ truyền thẳng `gutter: 2` vào config fjGallery (xem
// event/workflow/photo-gallery-window.js::_loadGroup()), không cần hằng số riêng ở đây.
// MỚI (Giai đoạn 1, rewrite Photo/Album, mục 3b/3c) — chiều cao CỐ ĐỊNH (px) của 1 hàng ảnh kiểu
// "justified row" (Google Photos thật). Dùng ở 2 chỗ, BẮT BUỘC khớp nhau:
//   1. `_resizeImageForThumbnail()` (ngay dưới) — resize `thumbBlob` lúc upload đúng chiều cao này.
//   2. `rowHeight` truyền vào fjGallery (event/workflow/photo-gallery-window.js) — thư viện tự nong/
//      co MỖI HÀNG THẬT quanh giá trị này (KHÔNG cố định tuyệt đối như bản windowing tự viết cũ —
//      đây chính là đúng thuật toán Flickr/Google Photos, khác hẳn "mọi hàng cao ĐÚNG N px").
// Giá trị 120 là mặc định hợp lý — đổi tuỳ ý, chỉ cần đổi ĐÚNG 1 chỗ (hằng số dùng chung).
const PHOTO_ROW_HEIGHT_PX = 120;
// MỚI (Giang yêu cầu — "resize thumb theo tỉ lệ 20% width và 20% height") — hệ số co CẢ 2 chiều lúc
// resize `thumbBlob` (_resizeImageForThumbnail() ngay dưới/event/workflow/image-edit.js::
// _buildThumbnailBlob() — PHẢI khớp nhau, đổi 1 trong 2 chỗ PHẢI đổi luôn chỗ kia). TÁCH BIỆT hẳn
// khỏi PHOTO_ROW_HEIGHT_PX (chỉ còn ý nghĩa "chiều cao HIỂN THỊ trong lưới" truyền cho fjGallery,
// KHÔNG còn liên quan gì tới kích thước THẬT của file thumbBlob lưu trong DB nữa).
const THUMBNAIL_SCALE_RATIO = 0.2;
// Khớp w-16 (64px) + gap-4 (16px) ở album story (components/file-manager.js) — đổi CSS thì phải đổi luôn.
// ĐÃ GỠ (Giai đoạn 3b) — ALBUM_STORY_TILE_WIDTH_PX/ALBUM_STORY_GAP_PX không còn dùng sau khi bỏ
// hẳn story slider ngang (thay bằng Album List sub-panel, xem openAlbumListPanel() ngay dưới).

const workflowFileManagerPhoto = {

    _activeImageModalHandle: null, // { close, imgEl, canvasWrap, baseCanvas, renderCanvas, interactCanvas, editBtn, adjustPopup, ... } của modal xem ảnh đang mở — null khi không mở modal nào (openImagePreview()/closeImagePreview())
    _activePanzoomSession: null,   // session Panzoom đang chạy khi ở Zoom mode — null khi không ở Zoom mode (core/image-zoom.js)
    _activeImageKey: null,         // key ảnh đang mở modal — Edit mode cần lại (enterEditMode()) để decode từ record thật
    _activeAlbumId: null,          // albumId đang lọc lúc mở modal (có thể null) — Lưu đè/Lưu mới cần lại để refresh() đúng lưới + thêm ảnh mới vào ĐÚNG album
    _activeEditParams: null,       // {brightness,contrast,saturation,temperature,tint,sharpen} đang chỉnh khi ở Edit mode — null khi không ở Edit mode
    _activeAdjustParam: null,      // key param đang mở slider ('brightness'/'contrast'/...) — null khi popup adjust đang ẩn

    /** Ứng với 'fileManagerPhoto.openPanel.click'. `fullBleed: true` — masonry/story slider vốn
     * thiết kế tràn viền (edge-to-edge), KHÔNG dùng khung "max-w-2xl mx-auto" mặc định của mọi
     * panel khác (xem core/settings-panel-stack.js::pushSettingsPanel(), Batch D6).
     * SỬA (14/07/2026, Giang chỉnh lại thứ tự) — ĐÚNG trình tự: trượt xong HẲN (chờ THẬT
     * `SLIDER_PANEL_SCROLL_ESTIMATED_MS`, core/slider-panel-scroll.js — taskManager, Rule 3 CHỈ
     * Workflow được dùng, cùng khuôn `workflowSettingsStackNav.back()`) -> RỒI MỚI bật shield -> tải
     * DOM lưới ảnh -> tắt shield. Bản trước bật shield + đo DOM NGAY SAU `pushSettingsPanel()` —
     * lúc đó panel CHỈ VỪA bắt đầu trượt vào, `scrollEl.clientWidth`/`clientHeight` đo lúc này KHÔNG
     * đáng tin (panel chưa vào đúng vị trí cuối) — nghi vấn nguyên nhân góp phần gây bug windowing
     * (chỉ hoạt động đúng SAU khi có 1 `refresh()` khác chạy lúc panel đã ổn định, vd sau khi xoá
     * ảnh ở chế độ xoá nhanh). */
    async openPanel() {
        fileManagerPhotoPanelEl = pushSettingsPanel({
            title: t('fileManager.photo.title'),
            bodyHtml: renderFileManagerPhotoPanelBody(),
            fullBleed: true,
            headerActionHtml: this._buildHeaderActionHtml(),
        });
        this._wireHeaderActionEvents();

        await new Promise((resolve) => taskManager.once(resolve, SLIDER_PANEL_SCROLL_ESTIMATED_MS, 'fileManagerPhotoOpenPanel')); // core/slider-panel-scroll.js — đợi trượt xong HẲN

        await withLoadingShield(t('fileManager.photo.loadingTitle'), async () => { // core/loading-shield-util.js
            await this.refresh(null);
        });
    },

    _buildHeaderActionHtml() {
        return `
            <button id="btn-file-manager-image-upload-trigger" class="w-8 h-8 flex items-center justify-center rounded-full bg-sky-500 hover:bg-sky-400 transition-colors text-white shrink-0" title="${t('fileManager.photo.uploadTitle')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            </button>
            <button id="btn-file-manager-image-delete-mode" class="hidden w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0" title="${t('fileManager.photo.image.quickDeleteTitle')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
            <input type="file" id="file-manager-image-upload-input" accept="image/png,image/jpeg,image/webp" multiple class="hidden">
        `;
    },

    /** Wire 2 nút vừa dựng trong header (`headerActionHtml`) — panel push CHỈ 1 LẦN/lần mở (khác
     * `refresh()` gọi lại nhiều lần), nên wire Ở ĐÂY, KHÔNG phải trong `refresh()` (tránh gắn listener
     * trùng nhiều lần lên CÙNG 1 nút tĩnh).
     * SỬA (18/07/2026, Giang yêu cầu "khôi phục add photo vào album, bấm + ra 2 lựa chọn") — nút
     * "+" KHÔNG còn gọi thẳng `uploadInput.click()` nữa (hành vi đó CỐ ĐỊNH, không biết `activeAlbumId`
     * đang là gì) — giờ dispatch qua eventBus (`uploadTrigger.click`), để Router tự đọc `activeAlbumId`
     * (state RIÊNG của nó) rồi quyết định: đang lọc album -> mở dropdown 2 lựa chọn; không lọc -> mở
     * thẳng hộp thoại chọn file (giữ NGUYÊN hành vi cũ) — xem event/router/file-manager-photo.js. */
    _wireHeaderActionEvents() {
        const uploadBtn = fileManagerPhotoPanelEl.querySelector('#btn-file-manager-image-upload-trigger');
        if (uploadBtn) uploadBtn.addEventListener('click', () => {
            eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.uploadTrigger.click', payload: {} });
        });
        // (change của uploadInput đã wire ở event/listener/file-manager-photo.js — delegated qua settingsStackBody)
        const deleteModeBtn = fileManagerPhotoPanelEl.querySelector('#btn-file-manager-image-delete-mode');
        if (deleteModeBtn) deleteModeBtn.addEventListener('click', () => {
            eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.image.deleteMode.click', payload: {} });
        });
    },

    /** Ứng với 'fileManagerPhoto.uploadTrigger.click' khi KHÔNG đang lọc theo album (activeAlbumId
     * null, Router tự đọc rồi quyết định gọi hàm này — xem event/router/file-manager-photo.js) —
     * mở thẳng hộp thoại chọn file, giữ NGUYÊN hành vi cũ (trước 18/07/2026, lúc nút "+" còn gọi
     * thẳng `uploadInput.click()` ngay trong `_wireHeaderActionEvents()`). CŨNG là đích dispatch khi
     * chọn "Tải ảnh lên" trong dropdown 2 lựa chọn (`openAddToAlbumChoiceMenu()` ngay dưới) — DÙNG
     * CHUNG, không viết 2 lần. */
    triggerUploadInput() {
        if (!fileManagerPhotoPanelEl) return;
        const uploadInput = fileManagerPhotoPanelEl.querySelector('#file-manager-image-upload-input');
        if (uploadInput) uploadInput.click();
    },

    /** Ứng với 'fileManagerPhoto.uploadTrigger.click' khi ĐANG lọc theo 1 album (activeAlbumId khác
     * null). MỚI (18/07/2026, Giang yêu cầu "khôi phục add photo vào album, bấm + ra 2 lựa chọn") —
     * mở dropdown 2 lựa chọn (Tải ảnh lên / Chọn ảnh có sẵn), neo vào nút "+" — TÁI DÙNG NGUYÊN
     * `openDropdownMenu()` (core/dropdown-menu.js, cùng khuôn `openAlbumActionMenu()` ngay dưới).
     * Mỗi `callback` tự `eventBus.send()` (Rule 5a) — Router quyết định gọi tiếp hàm nào (xem case
     * 'fileManagerPhoto.addPhotoChoice.click', event/router/file-manager-photo.js): "Tải ảnh lên" ->
     * `triggerUploadInput()` ở trên (upload thường, TỰ gắn ảnh mới vào album đang lọc — xem
     * `uploadImages()`); "Chọn ảnh có sẵn" -> `openAlbumImagePicker()` ngay dưới (Generic Drawer
     * multi-select, khôi phục lại — đã từng xoá 17/07/2026, xem lịch sử ở đó).
     * @param {string} albumId
     */
    openAddToAlbumChoiceMenu(albumId) {
        const anchorBtn = fileManagerPhotoPanelEl.querySelector('#btn-file-manager-image-upload-trigger');
        const dispatch = (choice) => eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.addPhotoChoice.click', payload: { choice, albumId } });
        openDropdownMenu(anchorBtn, [ // core/dropdown-menu.js
            {
                icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>',
                name: t('fileManager.photo.album.addChoiceUploadTitle'),
                callback: () => dispatch('upload'),
            },
            {
                icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v4m-2-2h4" /></svg>',
                name: t('fileManager.photo.album.addChoiceExistingTitle'),
                callback: () => dispatch('existing'),
            },
        ]);
    },

    /** Đọc lại toàn bộ ảnh (lọc theo `activeAlbumId` nếu có), vẽ lại lưới ảnh chính + chip lọc + nút
     * xoá nhanh. Dùng lại ở MỌI nơi cần vẽ lại lưới ảnh chính (mở panel, chọn/bỏ lọc album, upload
     * xong, xoá ảnh xong, bật/tắt/xác nhận xoá nhanh).
     *
     * ĐẬP ĐI LÀM LẠI (Giai đoạn 3b, rewrite Photo/Album, mục 3a) — XOÁ HẲN phần vẽ story slider
     * (`renderAlbumStory`/`setAlbumStoryPageVisibility`/`_renderAlbumStoryPagination`) và thanh quản
     * lý album inline (`#file-manager-album-manage-bar`) — album giờ quản lý HOÀN TOÀN trong Album
     * List sub-panel riêng (`openAlbumListPanel()`/`refreshAlbumListPanel()` ngay dưới). Hàm NÀY chỉ
     * còn lo lưới ảnh chính + 1 chip lọc đơn giản (tên album đang lọc + nút bỏ lọc, KHÔNG còn hành
     * động rename/delete/addImages/slideshow ở đây nữa).
     * ĐÃ XOÁ tham số `imageSelectionMode`/`selectedImageKeys`/`albumStoryPageIndex`/`focusAlbumId` —
     * "thêm ảnh vào album" giờ là picker Generic Drawer riêng (KHÔNG đụng lưới ảnh chính nữa, mở từ
     * nút "+" ở header khi đang lọc theo album — `openAddToAlbumChoiceMenu()`/`openAlbumImagePicker()`
     * — 17/07/2026 từng xoá hẳn, 18/07/2026 RESTORE lại, xem lịch sử ở đó), nút "Tải ảnh lên" (lựa
     * chọn "Upload" trong cùng menu đó) tự gắn ảnh mới vào album đang lọc (xem `uploadImages()`),
     * "focus đúng trang vừa tạo album" giờ thuộc
     * `promptCreateAlbumFromList()` (Album List sub-panel tự lo trang của NÓ, không liên quan lưới
     * ảnh chính này nữa).
     * @param {string|null} activeAlbumId
     * @param {boolean} [imageQuickDeleteMode]
     * @param {Set<string>} [quickDeleteSelectedKeys]
     */
    async refresh(activeAlbumId, imageQuickDeleteMode = false, quickDeleteSelectedKeys = new Set()) {
        if (!fileManagerPhotoPanelEl) return; // guard: panel đã đóng
        const images = await listImages(); // core/file-manager/image.js
        const albums = await listAlbums(); // core/file-manager/album.js — MỚI (fix bug 1) luôn đọc, không chỉ khi có activeAlbumId, để cập nhật số lượng trên nút vào Album List
        const activeAlbum = activeAlbumId ? (albums.find((a) => a.id === activeAlbumId) || null) : null;

        // ---- SỬA (fix bug 1) — nút vào Album List hiện thêm số lượng album, vd "Albums (5)" ----
        const entryLabelEl = fileManagerPhotoPanelEl.querySelector('#file-manager-album-list-entry-label');
        if (entryLabelEl) entryLabelEl.textContent = `${t('fileManager.photo.albumList.entryButton')} (${albums.length})`;

        // ---- Chip lọc album đang xem (THAY thanh quản lý album đầy đủ cũ) ----
        const filterChip = fileManagerPhotoPanelEl.querySelector('#file-manager-album-filter-chip');
        if (filterChip) {
            filterChip.classList.toggle('hidden', !activeAlbum);
            filterChip.classList.toggle('flex', !!activeAlbum);
            const nameEl = fileManagerPhotoPanelEl.querySelector('#file-manager-album-filter-name');
            if (nameEl) nameEl.textContent = activeAlbum ? activeAlbum.name : '';
        }

        // ---- Nút "xoá nhanh" trong header: chỉ hiện khi có ảnh, đổi màu khi đang bật ----
        // Title hiện thêm số lượng đã đánh dấu (vd "Xoá nhanh (3)") khi đang bật VÀ có ≥1 ảnh đã
        // đánh dấu — phản hồi trực quan, không cần đếm lại bằng mắt từng badge đỏ trên lưới.
        const deleteModeBtn = fileManagerPhotoPanelEl.querySelector('#btn-file-manager-image-delete-mode');
        if (deleteModeBtn) {
            deleteModeBtn.classList.toggle('hidden', images.length === 0);
            deleteModeBtn.classList.toggle('bg-rose-500', imageQuickDeleteMode);
            deleteModeBtn.classList.toggle('bg-white/10', !imageQuickDeleteMode);
            const baseTitle = t('fileManager.photo.image.quickDeleteTitle');
            deleteModeBtn.title = (imageQuickDeleteMode && quickDeleteSelectedKeys.size > 0) ? `${baseTitle} (${quickDeleteSelectedKeys.size})` : baseTitle;
        }

        const displayedImages = activeAlbum ? images.filter((img) => activeAlbum.imageKeys.includes(img.key)) : images;
        const emptyEl = fileManagerPhotoPanelEl.querySelector('#file-manager-image-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', displayedImages.length > 0);
        this.setupPhotoGridWindow(
            fileManagerPhotoPanelEl.querySelector('#file-manager-image-scroll'),
            displayedImages,
            { quickDeleteMode: imageQuickDeleteMode, quickDeleteSelectedKeys }
        );
    },

    /** MỚI (14/07/2026, mục 2.2) — hỏi xác nhận TRƯỚC KHI bật chế độ xoá nhanh (modalChoice()) —
     * chỉ BẬT mới cần hỏi, TẮT thì không (xem event/router/file-manager-photo.js). */
    promptQuickDeleteMode(onConfirm) {
        modalChoice( // core/modal-choice.js
            t('fileManager.photo.image.quickDeleteConfirm.desc'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.photo.image.quickDeleteConfirm.confirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: onConfirm },
            ],
            { title: t('fileManager.photo.image.quickDeleteConfirm.title') }
        );
    },

    /** SỬA (Giai đoạn 3, rewrite Photo/Album — redesign chế độ xoá nhanh) — THAY hẳn
     * `quickDeleteImage()` cũ (xoá NGAY từng ảnh, mỗi lần round-trip DB riêng — đúng cái Giang chỉ ra
     * "tốn kém" ở phần audit trước rewrite này). Giờ bấm ảnh chỉ TOGGLE vào/ra
     * `quickDeleteSelectedKeys` (Set closure ở Router) — patch DOM TRỰC TIẾP đúng 1 tile qua
     * `workflowPhotoGalleryWindow.setTileBadge()` (event/workflow/photo-gallery-window.js), KHÔNG
     * `refresh()`/KHÔNG dựng lại cả nhóm ngày, KHÔNG đọc/ghi DB gì cả. Title nút tự cập nhật số
     * lượng NGAY tại đây (không đợi `refresh()` nào khác) — patch chuỗi text, rẻ.
     * @param {string} imageKey
     * @param {Set<string>} quickDeleteSelectedKeys
     */
    toggleQuickDeleteMarkInSet(imageKey, quickDeleteSelectedKeys) {
        const isNowMarked = !quickDeleteSelectedKeys.has(imageKey);
        if (isNowMarked) quickDeleteSelectedKeys.add(imageKey);
        else quickDeleteSelectedKeys.delete(imageKey);
        workflowPhotoGalleryWindow.setTileBadge('photoGrid', imageKey, isNowMarked); // event/workflow/photo-gallery-window.js
        this._updateQuickDeleteButtonTitle(quickDeleteSelectedKeys);
    },

    /** MỚI (Giang chỉ ra "tại sao phải có refresh?" — bật/tắt chế độ xoá nhanh KHÔNG cần đọc lại DB/
     * dựng lại lưới, dữ liệu ảnh không hề đổi lúc này) — THAY thế lời gọi `refresh()` đầy đủ trước
     * đây ở case bật mode (Set rỗng)/tắt mode (Set rỗng) của router — CHỈ 2 việc: đổi màu/tiêu đề nút
     * + đổi badge trên tile ĐANG hiển thị qua `workflowPhotoGalleryWindow.setBadgeMode()` (KHÔNG
     * revoke/tạo lại object URL, KHÔNG gọi fjGallery() lại). `refresh()` đầy đủ CHỈ còn cần cho
     * `confirmQuickDeleteBatch()` (ảnh THẬT SỰ bị xoá khỏi DB, lưới bắt buộc phải dựng lại).
     * @param {boolean} imageQuickDeleteMode
     * @param {Set<string>} quickDeleteSelectedKeys
     */
    updateQuickDeleteModeUI(imageQuickDeleteMode, quickDeleteSelectedKeys) {
        if (!fileManagerPhotoPanelEl) return;
        const deleteModeBtn = fileManagerPhotoPanelEl.querySelector('#btn-file-manager-image-delete-mode');
        if (deleteModeBtn) {
            deleteModeBtn.classList.toggle('bg-rose-500', imageQuickDeleteMode);
            deleteModeBtn.classList.toggle('bg-white/10', !imageQuickDeleteMode);
        }
        this._updateQuickDeleteButtonTitle(quickDeleteSelectedKeys, imageQuickDeleteMode);
        workflowPhotoGalleryWindow.setBadgeMode('photoGrid', imageQuickDeleteMode ? 'quickDelete' : null, quickDeleteSelectedKeys); // event/workflow/photo-gallery-window.js
    },

    /** Patch chuỗi text title nút xoá nhanh — DÙNG CHUNG cho `toggleQuickDeleteMarkInSet()` (đánh
     * dấu từng ảnh) VÀ `updateQuickDeleteModeUI()` (bật/tắt mode), tránh lặp logic 2 nơi.
     * @param {Set<string>} quickDeleteSelectedKeys
     * @param {boolean} [imageQuickDeleteMode] - mặc định true (gọi từ toggleQuickDeleteMarkInSet chỉ khi ĐANG bật mode).
     */
    _updateQuickDeleteButtonTitle(quickDeleteSelectedKeys, imageQuickDeleteMode = true) {
        if (!fileManagerPhotoPanelEl) return;
        const deleteModeBtn = fileManagerPhotoPanelEl.querySelector('#btn-file-manager-image-delete-mode');
        if (!deleteModeBtn) return;
        const baseTitle = t('fileManager.photo.image.quickDeleteTitle');
        deleteModeBtn.title = (imageQuickDeleteMode && quickDeleteSelectedKeys.size > 0) ? `${baseTitle} (${quickDeleteSelectedKeys.size})` : baseTitle;
    },

    /** MỚI (Giai đoạn 3, rewrite Photo/Album — redesign chế độ xoá nhanh) — xoá TOÀN BỘ ảnh đã đánh
     * dấu 1 LẦN (gộp N lần xoá thành đúng 1 round-trip DB + 1 `refresh()` duy nhất, KHÔNG phải N lần
     * như bản cũ). Chỉ gọi khi `quickDeleteSelectedKeys.size > 0` (Router tự đảm bảo qua
     * `VirtualMachineState`, xem event/router/file-manager-photo.js — case `size === 0` xử lý RIÊNG,
     * không gọi hàm này).
     * `onConfirmed` — callback Router truyền vào (KHÔNG tự set `imageQuickDeleteMode=false` ở đây,
     * cùng khuôn `onDeleted` của `deleteAlbumById()` — Workflow không tự mutate được biến closure
     * primitive của Router). Gọi ĐÚNG lúc xoá xong THẬT (bên trong `onClick` nút xác nhận, SAU khi
     * `deleteImage()` đã chạy xong) — KHÔNG gọi sớm hơn, vì user có thể bấm Huỷ ở modal, lúc đó mode
     * PHẢI vẫn đang bật (UI vẫn đúng thực tế, không lệch với Router).
     * @param {Set<string>} quickDeleteSelectedKeys
     * @param {string|null} activeAlbumId
     * @param {() => void} onConfirmed
     */
    async confirmQuickDeleteBatch(quickDeleteSelectedKeys, activeAlbumId, onConfirmed) {
        const keys = Array.from(quickDeleteSelectedKeys);
        modalChoice( // core/modal-choice.js
            tFormat('fileManager.photo.image.quickDeleteBatchConfirm.confirm', { count: keys.length }),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.photo.image.quickDeleteBatchConfirm.confirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    await withLoadingShield(t('common.loading.savingInfo'), async () => {
                        for (const key of keys) await deleteImage(key); // core/file-manager/image.js — cascade dọn album, TỪNG ảnh vẫn phải gọi riêng (deleteImage() không có bản batch) nhưng CHỈ 1 refresh() sau CÙNG, không phải N lần
                    });
                    quickDeleteSelectedKeys.clear();
                    onConfirmed(); // Router tự đồng bộ imageQuickDeleteMode=false — ĐÚNG lúc này, không sớm hơn
                    await this.refresh(activeAlbumId, false, quickDeleteSelectedKeys);
                } },
            ],
            { title: t('fileManager.photo.image.quickDeleteBatchConfirm.title') }
        );
    },

    /** ĐẬP ĐI LÀM LẠI (rewrite Photo/Album, Giang yêu cầu "không dùng window virtual tự tạo nữa,
     * dùng thư viện") — THAY HẲN `workflowVirtualList.mount()` (event/workflow/virtual-list.js, đã
     * xoá — nguồn gốc hàng loạt bug layout/lệch cuộn) bằng `workflowPhotoGalleryWindow.mount()`
     * (event/workflow/photo-gallery-window.js) — windowing cấp NHÓM NGÀY qua `IntersectionObserver`
     * (trình duyệt tự lo, không tự đo `scrollTop`/`clientWidth`/tự tính `offsetTop` bằng tay nào
     * nữa) + fjGallery (thư viện thật) lo layout justified thật bên trong mỗi nhóm còn tải.
     * KHÔNG còn cần đo `clientWidth` TRƯỚC ở đây (bản cũ phải đoán TRƯỚC số cột/gộp hàng bằng tay —
     * đúng nguồn gốc bug "chỉ hiển thị đầy đủ SAU 1 thay đổi DOM khác") — `fjGallery()` tự đo lúc
     * NÓ thật sự chạy (bên trong `_loadGroup()`, event/workflow/photo-gallery-window.js), ĐÚNG lúc
     * nhóm đó đã ở trong DOM thật với kích thước thật (IntersectionObserver chỉ bắn callback SAU
     * khi trình duyệt đã layout xong, tự loại bỏ hẳn lớp fragility "đo quá sớm" cũ).
     * Dùng CHUNG cho Photo & Album (gọi từ `refresh()`) LẪN picker ảnh Generic Drawer
     * (`_openImagePickerDrawer()` ngay dưới — Workflow gọi Workflow miền khác, TỰ DO theo
     * event-bus-flow.md mục 4B).
     * @param {HTMLElement} scrollEl - container CUỘN, ĐÃ có trong DOM thật.
     * @param {Array<{key:string, blob:Blob, thumbBlob?:Blob, width?:number, height?:number, filename:string, addedAt:number}>} images
     * @param {{selectionMode?: boolean, selectedImageKeys?: Set<string>, quickDeleteMode?: boolean, quickDeleteSelectedKeys?: Set<string>}} [ctx]
     *        `selectionMode`/`selectedImageKeys` — picker "thêm ảnh vào album" (mountKey 'genericDrawer',
     *        mode multiSelectAlbum — xem `_openImagePickerDrawer()`). `quickDeleteMode`/
     *        `quickDeleteSelectedKeys` — lưới ảnh chính (mountKey 'photoGrid'). 2 cặp field LOẠI TRỪ
     *        NHAU tuỳ mountKey/mode, KHÔNG BAO GIỜ cả 4 field cùng có nghĩa 1 lúc.
     * @param {string} [mountKey] - phân biệt Photo & Album (mặc định 'photoGrid') với picker ảnh
     *        Generic Drawer ('genericDrawer', event/workflow/file-manager-photo.js::
     *        _openImagePickerDrawer()).
     */
    setupPhotoGridWindow(scrollEl, images, ctx, mountKey = 'photoGrid') {
        if (!scrollEl) return;
        const quickDeleteMode = !!(ctx && ctx.quickDeleteMode);
        const selectionMode = !!(ctx && ctx.selectionMode);
        workflowPhotoGalleryWindow.mount(mountKey, { // event/workflow/photo-gallery-window.js
            scrollEl,
            images,
            rowHeightPx: PHOTO_ROW_HEIGHT_PX,
            badgeMode: quickDeleteMode ? 'quickDelete' : (selectionMode ? 'multiSelect' : null),
            selectedKeys: quickDeleteMode ? ctx.quickDeleteSelectedKeys : (selectionMode ? ctx.selectedImageKeys : undefined),
        });
    },

    // ===================== MỚI (Giai đoạn 3b, rewrite Photo/Album, mục 3a) — Album List sub-panel
    // (THAY HẲN story slider + thanh quản lý album inline cũ — promptCreateAlbum/renameAlbumById/
    // deleteAlbumById ĐÃ XOÁ, xem lịch sử git nếu cần đối chiếu). Push TỪ TRONG panel Photo — ĐÚNG
    // khuôn Folder List -> Folder Detail (event/workflow/file-manager-song.js::openFolderDetail()),
    // KHÔNG cần xử lý gì đặc biệt cho "back" — popSettingsPanel() tự quay đúng panel Photo bên dưới.
    // ==========================================================================================

    /** Ứng với 'fileManagerPhoto.albumList.open.click'.
     * SỬA (fix bug 4, Giang chỉ ra "list dùng pagination nhẹ, không đáng kể") — BỎ `withLoadingShield()`
     * (khác panel Photo chính — lưới ảnh nặng, nhiều object URL, thật sự cần che) — Album List KHÔNG
     * windowing, tối đa 10 hàng/trang, `refreshAlbumListPanel()` chỉ 1 lượt đọc DB nhỏ (số album
     * thực tế luôn ít) — che chỉ gây nhấp nháy thừa, không có gì đáng che cả. VẪN giữ đợi trượt xong
     * HẲN trước khi vẽ (SLIDER_PANEL_SCROLL_ESTIMATED_MS) — không liên quan tới shield, tránh vẽ lúc
     * panel còn đang animation dở dang. */
    /** Ứng với 'fileManagerPhoto.albumList.open.click'.
     * SỬA (fix bug 4, Giang chỉ ra "list dùng pagination nhẹ, không đáng kể") — BỎ `withLoadingShield()`
     * (khác panel Photo chính — lưới ảnh nặng, nhiều object URL, thật sự cần che) — Album List KHÔNG
     * windowing, tối đa 10 hàng/trang, `refreshAlbumListPanel()` chỉ 1 lượt đọc DB nhỏ (số album
     * thực tế luôn ít) — che chỉ gây nhấp nháy thừa, không có gì đáng che cả. VẪN giữ đợi trượt xong
     * HẲN trước khi vẽ (SLIDER_PANEL_SCROLL_ESTIMATED_MS) — không liên quan tới shield, tránh vẽ lúc
     * panel còn đang animation dở dang.
     * SỬA (Giang yêu cầu "bỏ khung viền, làm giống y hệt Playlist UI") — `fullBleed: true` MỚI (list
     * tràn viền edge-to-edge, xem components/file-manager.js::renderFileManagerAlbumListPanelBody())
     * + nút "+" tạo album dời vào `headerActionHtml` (đối xứng nút Back, đúng khuôn panel Photo
     * chính) — bỏ hẳn việc tự dựng `<h2>` tiêu đề trùng lặp trong bodyHtml (title CHUẨN của
     * `pushSettingsPanel()` đã đủ). */
    async openAlbumListPanel() {
        albumListPanelEl = pushSettingsPanel({
            title: t('fileManager.photo.albumList.title'),
            bodyHtml: renderFileManagerAlbumListPanelBody(), // components/file-manager.js
            fullBleed: true,
            headerActionHtml: this._buildAlbumListHeaderActionHtml(),
        });
        const createBtn = albumListPanelEl.querySelector('#btn-file-manager-album-list-create');
        if (createBtn) createBtn.addEventListener('click', () => {
            eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.albumList.create.click', payload: {} });
        });

        await new Promise((resolve) => taskManager.once(resolve, SLIDER_PANEL_SCROLL_ESTIMATED_MS, 'fileManagerAlbumListOpenPanel')); // core/slider-panel-scroll.js — đợi trượt xong HẲN, cùng lý do openPanel()
        await this.refreshAlbumListPanel(0); // KHÔNG shield (fix bug 4) — list nhẹ, không windowing
    },

    /** Nút "+" tạo album mới — dời vào header (đối xứng nút Back), THAY vì tự dựng trong bodyHtml
     * (cũ, trùng lặp với title CHUẨN của pushSettingsPanel() — xem docstring openAlbumListPanel()).
     * Cùng khuôn `_buildHeaderActionHtml()` của panel Photo chính (nút upload). */
    _buildAlbumListHeaderActionHtml() {
        return `
            <button id="btn-file-manager-album-list-create" class="w-8 h-8 flex items-center justify-center rounded-full bg-sky-500 hover:bg-sky-400 transition-colors text-white shrink-0" title="${t('fileManager.photo.albumList.createNew')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            </button>`;
    },

    /** Đọc lại album, phân trang mode 'list' (core/pagination.js, ~10 album/trang — ĐÚNG chữ Giang
     * dùng "pagination dạng list page"), vẽ lại từng hàng qua itemTemplateAlbumListRow()
     * (components/items.js). KHÔNG windowing (workflowPhotoGalleryWindow) — số album thực tế luôn nhỏ,
     * render thẳng 1 trang là đủ mượt, cùng tinh thần refreshSongTab() (Folder List) không windowing.
     * SỬA (Giang yêu cầu layout "ảnh album | tên album | số lượng ảnh + ...") — đọc thêm
     * `listImages()` để lấy ảnh đại diện đầu tiên mỗi album (`imageRecordsByKey`, TÁI DÙNG đúng cách
     * `renderSlideshowAlbumPickerGrid()` đang làm) — revoke TOÀN BỘ object URL cũ TRƯỚC khi vẽ lại
     * (danh sách này KHÔNG windowing, tự vẽ lại hết mỗi lần refresh, phải tự dọn tay).
     * @param {number} pageIndex
     */
    async refreshAlbumListPanel(pageIndex) {
        if (!albumListPanelEl) return; // guard: panel đã đóng
        const albums = await listAlbums(); // core/file-manager/album.js
        const images = await listImages(); // core/file-manager/image.js — MỚI, lấy ảnh đại diện
        const imageRecordsByKey = new Map(images.map((img) => [img.key, img]));
        const pageResult = computePage(albums, pageIndex, 10); // core/pagination.js

        const listEl = albumListPanelEl.querySelector('#file-manager-album-list');
        if (listEl) {
            listEl.querySelectorAll('[data-has-object-url]').forEach((img) => { try { URL.revokeObjectURL(img.src); } catch (e) {} }); // dọn object URL cũ TRƯỚC khi ghi đè — KHÔNG windowing, tự vẽ lại toàn bộ
            listEl.innerHTML = pageResult.pageItems.map((album) => itemTemplateAlbumListRow(album, imageRecordsByKey)).join(''); // components/items.js
        }
        const emptyEl = albumListPanelEl.querySelector('#file-manager-album-list-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', albums.length > 0);
        const paginationEl = albumListPanelEl.querySelector('#file-manager-album-list-pagination');
        if (paginationEl) paginationEl.innerHTML = buildPaginationListHtml(pageResult.pageIndex, pageResult.totalPages); // core/pagination.js, KHÔNG sửa
    },

    /** MỚI (Giang yêu cầu "action ba chấm dropdown, tái dùng như action song, truyền vào dạng
     * [{icon, name, callback}]") — THAY HẲN 4 icon rời cũ. Ứng với 'fileManagerPhoto.albumList.
     * menu.click'. Mỗi `callback` tự gọi `eventBus.send()` (Rule 5a — core/dropdown-menu.js CHỈ gọi
     * lại đúng callback được truyền vào, KHÔNG tự quyết định nghiệp vụ) — TÁI DÙNG NGUYÊN case
     * 'fileManagerPhoto.albumList.action.click' đã có sẵn ở router (KHÔNG đổi gì phía dispatch, chỉ
     * đổi NƠI TRIGGER từ 4 nút rời sang 1 dropdown).
     *
     * SỬA (17/07/2026, phản hồi Giang) — CHỈ CÒN 2 mục (Đổi tên/Xoá):
     *   - "Xem" (action 'view') XOÁ — bấm THẲNG vào hàng album giờ làm việc này rồi (event/listener/
     *     file-manager-photo.js -> 'fileManagerPhoto.albumList.row.click' -> event/router/file-
     *     manager-photo.js -> `viewAlbumImages()`), giữ 2 đường vào cho CÙNG 1 hành động là dư thừa.
     *   - "Thêm ảnh có sẵn" (action 'addImages') XOÁ HẲN — nút "Tải ảnh lên" ở header panel Photo
     *     giờ TỰ thêm ảnh vừa tải vào album đang lọc (nếu có, xem `uploadImages()` bên dưới), picker
     *     Generic Drawer multi-select riêng cho việc này không còn cần thiết — ĐÃ XOÁ HẲN
     *     `openAlbumImagePicker()`/nhánh `multiSelectAlbum` (xem lịch sử ở đầu file).
     * @param {string} albumId
     * @param {HTMLElement} anchorBtn - nút "..." vừa bấm, dùng để định vị dropdown.
     * @param {number} albumListPageIndex
     */
    openAlbumActionMenu(albumId, anchorBtn, albumListPageIndex) {
        const dispatch = (action) => eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.albumList.action.click', payload: { action, albumId } });
        openDropdownMenu(anchorBtn, [ // core/dropdown-menu.js
            {
                icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>',
                name: t('fileManager.photo.album.renameTitle'),
                callback: () => dispatch('rename'),
            },
            {
                icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>',
                name: t('fileManager.photo.album.deleteTitle'),
                callback: () => dispatch('delete'),
                destructive: true,
            },
        ]);
    },

    /** Ứng với 'fileManagerPhoto.albumList.create.click'. Cùng khuôn `promptCreateAlbum()` cũ, chỉ
     * khác: focus đúng TRANG của Album List sub-panel (KHÔNG còn liên quan lưới ảnh chính/story nữa).
     * @param {number} currentPageIndex
     */
    async promptCreateAlbumFromList(currentPageIndex) {
        openCreateAlbumModal(async (name) => { // core/file-manager/photo-ui.js
            const result = await createAlbum(name); // core/file-manager/album.js
            if (result.status === 'duplicateName') {
                await alertModal(tFormat('fileManager.folderPicker.duplicateName', { name: escapeHtml(name) }));
                return;
            }
            // Album mới có thể KHÔNG rơi đúng trang đang xem (listAlbums() trả theo thứ tự key
            // IndexedDB, không phải thứ tự tạo) — tìm ĐÚNG trang chứa nó, cùng lý do BUG FIX
            // "Add new album chưa hoạt động" đã từng vá ở bản story cũ (không lặp lại bug đó).
            const albums = await listAlbums();
            const focusIndex = albums.findIndex((a) => a.id === result.albumId);
            const targetPage = focusIndex >= 0 ? Math.floor(focusIndex / 10) : currentPageIndex;
            await this.refreshAlbumListPanel(targetPage);
        });
    },

    /** Ứng với 'fileManagerPhoto.albumList.action.click' action='rename'. Đọc tên hiện tại từ core
     * (KHÔNG có sẵn trong DOM gọn như thanh quản lý cũ — hàng list không giữ tên riêng ngoài text
     * đang hiển thị, đọc lại DB rẻ, số album nhỏ).
     * @param {string} albumId
     * @param {number} pageIndex
     */
    async renameAlbumFromList(albumId, pageIndex) {
        const albums = await listAlbums();
        const album = albums.find((a) => a.id === albumId);
        if (!album) return; // guard: album vừa bị xoá ở thao tác khác
        openRenameAlbumModal(album.name, async (newName) => { // core/file-manager/photo-ui.js
            const result = await renameAlbum(albumId, newName); // core/file-manager/album.js
            if (result.status === 'duplicateName') {
                await alertModal(tFormat('fileManager.folderPicker.duplicateName', { name: escapeHtml(newName) }));
                return;
            }
            await this.refreshAlbumListPanel(pageIndex);
        });
    },

    /** Ứng với 'fileManagerPhoto.albumList.action.click' action='delete'.
     * @param {string} albumId
     * @param {number} pageIndex
     * @param {() => void} onDeleted - reset `activeAlbumId` Ở TẦNG ROUTER nếu album vừa xoá đang là
     *        album lọc lưới ảnh chính.
     */
    async deleteAlbumFromList(albumId, pageIndex, onDeleted) {
        const albums = await listAlbums();
        const album = albums.find((a) => a.id === albumId);
        const albumName = album ? album.name : '';
        modalChoice(
            tFormat('fileManager.photo.album.deleteConfirm', { name: escapeHtml(albumName) }),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.photo.album.btnDelete'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    await deleteAlbum(albumId); // core/file-manager/album.js — KHÔNG đụng ảnh bên trong, chỉ mất liên kết
                    if (appState.get('activeBackgroundAlbum') === albumId && typeof workflowSlideshow !== 'undefined') {
                        await workflowSlideshow.clearActiveAlbum(); // cascade "xoá album đang dùng làm nguồn slideshow" (Batch 8, giữ nguyên hành vi cũ)
                    }
                    onDeleted();
                    await this.refreshAlbumListPanel(pageIndex);
                } }
            ],
            { title: t('fileManager.photo.album.deleteTitle') }
        );
    },

    // ĐÃ GỠ (fix bug 2, Giang yêu cầu "ấn vào album lại ra sub panel -> bỏ") — selectAlbumAndReturnToPhotoGrid()
    // (bấm tên/số lượng album -> lọc lưới ảnh chính + pop về panel Photo) XOÁ HẲN — vùng tên/số
    // lượng KHÔNG còn bấm được nữa, xem itemTemplateAlbumListRow() (components/items.js).

    /** Ứng với 'fileManagerPhoto.albumList.action.click' action='view'.
     * SỬA (17/07/2026, Giang yêu cầu "bỏ carousel, đổi sang view xem giống File Manager -> Photo
     * nhưng chỉ ảnh trong album") — THAY HẲN carousel xem+xoá cũ (`openImageCarouselViewModal()`,
     * core/file-manager/photo-ui.js — HÀM VẪN GIỮ NGUYÊN trên đĩa, KHÔNG xoá, chỉ không còn gọi ở
     * đây) bằng cách TÁI DÙNG chính lưới ảnh panel Photo chính (`fileManagerPhotoPanelEl`) — panel
     * đó ĐÃ CÓ SẴN cơ chế lọc theo `activeAlbumId` (chip lọc + nút "bỏ lọc", xem `refresh()`) và
     * đang NẰM SẴN ngay phía dưới Album List sub-panel trong ngăn xếp (chỉ đang bị cuộn khuất, xem
     * core/settings-panel-stack-ui.js — Album List PUSH lên TRÊN nó, không hề xoá) — KHÔNG cần mở
     * panel MỚI nào cả.
     *
     * Router đã set `activeAlbumId = albumId` NGAY TRƯỚC khi gọi hàm này (xem
     * event/router/file-manager-photo.js — Router tự mutate biến closure của chính nó, không phải
     * việc của Workflow). Hàm NÀY chỉ còn 2 việc, ĐÚNG THỨ TỰ: (1) vẽ lại lưới chính theo đúng lọc
     * đó TRƯỚC (`refresh()`, await cho xong hẳn — bao gồm cả windowing) — panel đang ẩn nên vẽ
     * trước không gây "flash" nội dung CŨ (toàn bộ ảnh, chưa lọc); (2) RỒI MỚI lùi
     * (`workflowSettingsStackNav.back()`, Workflow gọi Workflow khác miền — tự do, xem
     * event-bus-flow.md mục 4B) về ĐÚNG panel đó — người dùng thấy NGAY lưới đã lọc, không thấy
     * bước trung gian nào.
     * @param {string} albumId
     */
    async viewAlbumImages(albumId) {
        await this.refresh(albumId);
        workflowSettingsStackNav.back(); // event/workflow/settings-stack-nav.js
    },

    // ===================== Picker ảnh dùng chung (Generic Drawer) — 2 CHẾ ĐỘ: multi-select (thêm
    // ảnh có sẵn vào album) / single-select (chọn 1 ảnh, vd bìa bài hát/Theme Background). SỬA
    // (17/07/2026) từng XOÁ HẲN chế độ multi-select — RESTORE (18/07/2026, Giang yêu cầu "khôi phục
    // add photo vào album, bấm + ra 2 lựa chọn") — điểm vào ĐỔI so với bản CŨ trước khi xoá: KHÔNG
    // còn từ dropdown "..." của Album List sub-panel nữa, giờ từ nút "+" ở HEADER panel Photo chính
    // (khi đang lọc theo album — `openAddToAlbumChoiceMenu()` ở trên, chọn "Chọn ảnh có sẵn") —
    // đúng NGỮ CẢNH đang xem đúng album đó, KHÔNG cần chọn lại albumId. Session giữ ở ĐÂY
    // (`_imagePickerSession`, biến module) — KHÔNG phải Router: đây là "handle của UI đang mở" (cùng
    // loại state với `fileManagerPhotoPanelEl`/`albumListPanelEl`), không phải "state nghiệp vụ ảnh
    // hưởng rẽ nhánh Router". Click grid ĐI ĐÚNG luồng eventBus (listener trên `genericDrawerBody` ->
    // Router -> Workflow tự branch theo `_imagePickerSession.mode`) — KHÔNG raw callback như modal
    // picker cover CŨ (tiền lệ TRƯỚC Rule 5a, không hồi tố, KHÔNG lặp lại cho code MỚI). ==========

    /** Ứng với 'fileManagerPhoto.addPhotoChoice.click' choice='existing' — multi-select, xác nhận
     * bằng nút đáy cố định, gọi `addImagesToAlbum()`. RESTORE (18/07/2026) — KHÁC bản TRƯỚC lúc bị
     * xoá (17/07/2026): không còn nhận `albumListPageIndex` (điểm vào ĐỔI, xem đầu khối này) —
     * `handleImagePickerConfirmClick()` giờ refresh lưới ảnh CHÍNH (`refresh(albumId)`), không phải
     * Album List.
     * @param {string} albumId
     */
    async openAlbumImagePicker(albumId) {
        _imagePickerSession = { mode: 'multiSelectAlbum', albumId, selectedKeys: new Set() };
        await this._openImagePickerDrawer(t('fileManager.photo.album.addImagesTitle'), true);
    },

    /** MỚI (Giai đoạn 4, rewrite Photo/Album, mục 4) — chọn 1 ảnh làm bìa bài hát HOẶC ảnh nền
     * Theme, THAY HẲN `openPhotoUiImagePickerModal()` cũ (core/file-manager/photo-ui.js — ĐÃ XOÁ,
     * modal riêng ngoài luồng eventBus). Gọi TỪ event/workflow/playlist.js::pickCoverFromLibrary()
     * VÀ event/workflow/theme.js::pickNewBackgroundImage() (Workflow gọi Workflow miền khác, TỰ DO
     * theo event-bus-flow.md mục 4B) — single-select: bấm ẢNH NÀO là chọn NGAY ảnh đó + đóng drawer,
     * KHÔNG có nút xác nhận riêng (khác hẳn ca multi-select album — cùng khác biệt
     * `openImageCarouselPickerModal()`/`openImageLibraryPickerModal()` cũ đã có: chọn 1 = chọn xong
     * luôn, không cần bước xác nhận thứ 2).
     * @param {(imageKey: string) => void} onSelect
     * @param {() => void} [onCancel] - gọi khi đóng picker MÀ CHƯA chọn gì (nút X) — cùng ngữ nghĩa
     *        `onCancel` các picker chọn-1-ảnh cũ (nơi gọi tự trả toggle "On" về "off" nếu có).
     */
    async openCoverImagePicker(onSelect, onCancel) {
        _imagePickerSession = { mode: 'singleSelectCover', onSelect, onCancel, hasSelected: false };
        await this._openImagePickerDrawer(t('playlistView.songEdit.coverPickLibrary'), false);
    },

    /** Dựng khung Generic Drawer DÙNG CHUNG cho cả 2 chế độ — CHỈ khác `showConfirmButton` (multi-
     * select cần nút xác nhận cố định đáy, single-select KHÔNG — tap là chọn ngay). Nghiệp vụ THẬT
     * (thêm vào album / set bìa) tách hẳn ở `handleImagePickerConfirmClick()`/
     * `handleImagePickerTileClick()` bên dưới, branch theo `_imagePickerSession.mode`, KHÔNG lẫn vào
     * hàm dựng khung này.
     * Height `90vh` (Giang yêu cầu — mặc định `70vh` của Generic Drawer không đủ chỗ cho lưới ảnh
     * cuộn thoải mái, khác hẳn menu action chỉ vài dòng chữ). Trình tự ĐÃ CHỐT: drawer trượt lên xong
     * HẲN (nghe `transitionend` THẬT, core/generic-drawer.js) -> đọc DB + windowing (KHÔNG còn icon
     * loading, xem SỬA 17/07/2026 ngay dưới).
     * @param {string} title
     * @param {boolean} showConfirmButton
     */
    async _openImagePickerDrawer(title, showConfirmButton) {
        openGenericDrawer({ // core/generic-drawer.js
            height: '90vh',
            zIndex: Z_INDEX.GENERIC_DRAWER, // core/config.js — mặc định, KHÔNG có modal xem ảnh nào mở đồng thời với picker này (khác action-menu cần z=131)
            headerHtml: this._buildImageMenuHeaderHtml(title),
            bodyHtml: this._buildImagePickerBodyHtml(showConfirmButton),
            bodyClass: 'flex flex-col',
        });

        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imagePicker.close.click', payload: {} });
        });
        if (showConfirmButton) {
            const confirmBtn = genericDrawerBody.querySelector('#btn-file-manager-image-picker-confirm');
            if (confirmBtn) confirmBtn.addEventListener('click', () => {
                eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imagePicker.confirm.click', payload: {} });
            });
        }
        // Click tile — delegated NGAY TRÊN genericDrawerBody (KHÔNG đi qua settingsStackBody, Generic
        // Drawer là ANH EM của #app-stack trong #app-root — cấu trúc DOM tách biệt hẳn, xem docstring
        // core/generic-drawer.js — nên PHẢI tự wire riêng ở đây). Callback gọi eventBus.send() — ĐÚNG
        // yêu cầu Giang, KHÔNG gọi thẳng workflow method như `_wireImageMenuEvents()` đang làm (đó là
        // tiền lệ CŨ, chấp nhận được vì Workflow-gọi-Workflow-của-chính-mình không bị Rule 5a chi
        // phối, nhưng ở ĐÂY đi qua eventBus cho nhất quán với toàn bộ luồng ảnh còn lại).
        // SỬA (rewrite Photo/Album, dùng fjGallery) — tile giờ là `<div class="fj-gallery-item">`,
        // KHÔNG còn `<button>` — selector đổi theo, bỏ ràng buộc tag.
        genericDrawerBody.addEventListener('click', (e) => {
            const tile = e.target.closest('[data-image-key]');
            if (!tile) return;
            eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imagePicker.tile.click', payload: { imageKey: tile.dataset.imageKey } });
        });

        await new Promise((resolve) => {
            genericDrawerPanel.addEventListener('transitionend', function onOpenTransitionEnd() {
                genericDrawerPanel.removeEventListener('transitionend', onOpenTransitionEnd);
                resolve();
            }, { once: true });
        });

        // BỎ icon loading khi đọc DB (17/07/2026, Giang yêu cầu "bỏ loading đi") — trước đây có 1
        // icon spin đơn giản phủ lên #file-manager-image-picker-scroll trong lúc listImages() chạy
        // (`#file-manager-image-picker-loading`, xem lịch sử ở `_buildImagePickerBodyHtml()`) — ĐÃ
        // XOÁ HẲN khối HTML đó luôn (không chỉ ẩn/hiện) — listImages() vẫn await bình thường ngay
        // dưới, chỉ không còn gì che màn hình trong lúc đợi.
        const images = await listImages(); // core/file-manager/image.js
        if (!_imagePickerSession) return; // guard — user đóng picker RẤT NHANH trong lúc đang đọc DB (hiếm, nhưng an toàn — tránh vẽ vào drawer đã đóng)

        const scrollEl = genericDrawerBody.querySelector('#file-manager-image-picker-scroll');
        const emptyEl = genericDrawerBody.querySelector('#file-manager-image-picker-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', images.length > 0);
        const ctx = showConfirmButton ? { selectionMode: true, selectedImageKeys: _imagePickerSession.selectedKeys } : {}; // singleSelectCover — KHÔNG badge, tap = chọn ngay
        this.setupPhotoGridWindow(scrollEl, images, ctx, 'genericDrawer');
    },

    /** HTML khung picker: scroll container (grid windowing sẽ chèn vào TRONG đây) + nút xác nhận cố
     * định đáy CHỈ khi `showConfirmButton` (mode multiSelectAlbum). Đặt ở Workflow (không phải
     * core) — cùng khuôn `_buildImageMenuHeaderHtml()` bên dưới, glue riêng cho feature này, không
     * đủ "substantial" để tách core.
     * SỬA (17/07/2026, Giang yêu cầu "bỏ loading đi") — XOÁ HẲN khối icon loading
     * (`#file-manager-image-picker-loading`, spinner phủ lên trong lúc đọc DB) — xem
     * `_openImagePickerDrawer()`. Nút xác nhận cố định đáy RESTORE lại 18/07/2026 (xem đầu khối này).
     * @param {boolean} showConfirmButton
     */
    _buildImagePickerBodyHtml(showConfirmButton) {
        return `
            <div class="flex-1 min-h-0 overflow-y-auto relative" id="file-manager-image-picker-scroll">
                <p id="file-manager-image-picker-empty" class="hidden text-sm text-slate-400 text-center py-10 px-6">${t('fileManager.photo.image.empty')}</p>
            </div>
            ${showConfirmButton ? `
            <div class="p-4 border-t border-white/10 shrink-0">
                <button type="button" id="btn-file-manager-image-picker-confirm" class="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors">${t('fileManager.photo.album.btnAddSelected')}</button>
            </div>` : ''}
        `;
    },

    /** Ứng với 'fileManagerPhoto.imagePicker.tile.click' — branch theo `_imagePickerSession.mode`
     * (2 NGHIỆP VỤ khác nhau thật sự, tách rõ ở ĐÂY chứ không phải ở `_openImagePickerDrawer()`).
     * @param {string} imageKey
     */
    handleImagePickerTileClick(imageKey) {
        if (!_imagePickerSession) return; // guard: picker đã đóng (race hiếm, vd đóng đúng lúc tap)
        if (_imagePickerSession.mode === 'multiSelectAlbum') {
            const selectedKeys = _imagePickerSession.selectedKeys;
            const isNowMarked = !selectedKeys.has(imageKey);
            if (isNowMarked) selectedKeys.add(imageKey);
            else selectedKeys.delete(imageKey);
            workflowPhotoGalleryWindow.setTileBadge('genericDrawer', imageKey, isNowMarked); // event/workflow/photo-gallery-window.js
            return;
        }
        // singleSelectCover — bấm là chọn NGAY, đóng drawer luôn, KHÔNG cần nút xác nhận riêng.
        _imagePickerSession.hasSelected = true;
        const onSelect = _imagePickerSession.onSelect;
        this._teardownImagePicker();
        onSelect(imageKey);
    },

    /** Ứng với 'fileManagerPhoto.imagePicker.confirm.click' — CHỈ có nghĩa ở mode multiSelectAlbum
     * (nút xác nhận không tồn tại ở mode singleSelectCover, guard tự bỏ qua an toàn nếu lệch).
     * `addImagesToAlbum()` tự bỏ qua ảnh đã có sẵn trong album (không thêm trùng) — xem
     * core/file-manager/album.js. RESTORE (18/07/2026) — refresh lưới ảnh CHÍNH (`refresh(albumId)`),
     * KHÔNG còn `refreshAlbumListPanel()` như bản TRƯỚC lúc bị xoá (điểm vào đổi, xem
     * `openAlbumImagePicker()`). */
    async handleImagePickerConfirmClick() {
        if (!_imagePickerSession || _imagePickerSession.mode !== 'multiSelectAlbum') return; // guard
        const { albumId, selectedKeys } = _imagePickerSession;
        const keys = Array.from(selectedKeys);
        this._teardownImagePicker();
        if (keys.length === 0) return; // guard — chưa chọn gì thì không gọi DB, không thông báo gì

        let addedCount = 0;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            const result = await addImagesToAlbum(keys, albumId); // core/file-manager/album.js
            addedCount = result.addedCount;
        });
        await this.refresh(albumId);
        await alertModal(tFormat('fileManager.photo.album.addImagesSuccess', { count: addedCount }));
    },

    /** Ứng với 'fileManagerPhoto.imagePicker.close.click' — đóng picker qua nút X (Huỷ, chưa chọn
     * gì THÊM — mode singleSelectCover có thể ĐÃ chọn xong trước đó, khi đó không còn `_imagePickerSession`
     * để mà đóng qua đường này nữa, guard tự an toàn). `onCancel` CHỈ gọi ở mode singleSelectCover
     * (cùng ngữ nghĩa modal cũ) — mode multiSelectAlbum không có khái niệm "cancel toggle", đóng
     * ngang bằng bỏ dở, không cần báo ai. */
    handleImagePickerCloseClick() {
        if (!_imagePickerSession) return;
        const { mode, onCancel, hasSelected } = _imagePickerSession;
        this._teardownImagePicker();
        if (mode === 'singleSelectCover' && !hasSelected && typeof onCancel === 'function') onCancel();
    },

    /** Dọn session + unmount windowing (revoke object URL NGAY, không đợi lần mount() kế tiếp mới
     * tự dọn) + đóng drawer — DÙNG CHUNG cho MỌI lối thoát picker (chọn xong/xác nhận/huỷ). */
    _teardownImagePicker() {
        workflowPhotoGalleryWindow.unmount('genericDrawer'); // event/workflow/photo-gallery-window.js
        this._closeGenericDrawerFully();
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
     * không được đụng theo Rule 1-4 — đúng tiền lệ `event/workflow/image-edit.js` đang xử lý canvas
     * riêng ở Workflow, core chỉ nhận `Blob` đã xong việc.
     * @param {File} file
     * @returns {Promise<{thumbBlob: Blob, width: number, height: number}>}
     */
    _resizeImageForThumbnail(file) {
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
                    if (!thumbBlob) { reject(new Error('[_resizeImageForThumbnail] canvas.toBlob trả về null')); return; }
                    resolve({ thumbBlob, width, height });
                }, 'image/jpeg', 0.82);
            };
            img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('[_resizeImageForThumbnail] không đọc được ảnh để resize')); };
            img.src = objectUrl;
        });
    },

    /** Ứng với 'fileManagerPhoto.upload.change'.
     * SỬA (Giai đoạn 1, rewrite Photo/Album, mục 3c/3d) — resize `thumbBlob` (`_resizeImageForThumbnail()`
     * ngay trên) TRƯỚC khi gọi `saveImage()` (core/file-manager/image.js — đổi chữ ký, nhận thêm
     * `thumbBlob`/`width`/`height`). Lỗi resize 1 ảnh (vd file hỏng) KHÔNG được chặn cả lô upload —
     * bắt riêng, bỏ qua đúng ảnh đó, tiếp tục ảnh sau (Rule 1: vẫn 1 tiến trình "upload cả lô", guard
     * lỗi từng phần tử không tính là rẽ nhánh nghiệp vụ).
     *
     * SỬA (17/07/2026, Giang yêu cầu "đang xem 1 album -> upload tự add luôn vào album đó") — THAY
     * HẲN picker "Thêm ảnh có sẵn" (Generic Drawer multi-select, ĐÃ XOÁ, xem lịch sử đầu file): khi
     * `activeAlbumId` khác `null` (đang lọc lưới ảnh chính theo 1 album), MỌI ảnh upload thành công
     * lô này TỰ ĐỘNG gắn luôn vào album đó (`addImagesToAlbum()`, core/file-manager/album.js) —
     * KHÔNG cần bước chọn ảnh có sẵn riêng nữa, vì ảnh MỚI vốn đã đang xem ĐÚNG NGỮ CẢNH album này.
     * Ảnh resize/lưu THẤT BẠI (bắt riêng ở `catch` ngay dưới) KHÔNG được thêm vào album — chỉ gom
     * đúng key ảnh ĐÃ lưu thành công.
     * @param {FileList} files
     * @param {string|null} activeAlbumId
     */
    async uploadImages(files, activeAlbumId) {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        let failedCount = 0;
        const uploadedKeys = []; // MỚI (17/07/2026) — key ảnh upload THÀNH CÔNG, dùng để auto add vào album đang lọc (nếu có)
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            for (const file of fileArray) {
                try {
                    const { thumbBlob, width, height } = await this._resizeImageForThumbnail(file);
                    const imageKey = await saveImage(file, file.name, thumbBlob, width, height); // core/file-manager/image.js — chữ ký MỚI, CÓ return (imageKey)
                    uploadedKeys.push(imageKey);
                } catch (err) {
                    console.error(`[uploadImages] resize/lưu thất bại cho file "${file.name}":`, err);
                    failedCount++;
                }
            }
            if (activeAlbumId && uploadedKeys.length > 0) {
                await addImagesToAlbum(uploadedKeys, activeAlbumId); // core/file-manager/album.js
            }
        });
        if (fileManagerPhotoPanelEl) {
            const uploadInput = fileManagerPhotoPanelEl.querySelector('#file-manager-image-upload-input');
            if (uploadInput) uploadInput.value = ''; // cho phép chọn lại đúng file cũ ở lần sau
        }
        await this.refresh(activeAlbumId);
        const successCount = fileArray.length - failedCount;
        await alertModal(tFormat('fileManager.photo.image.uploadSuccess', { count: successCount }));
    },

    /** Ứng với 'fileManagerPhoto.image.click' khi imageQuickDeleteMode=false (xem router).
     * SỬA (21/07/2026, Giang yêu cầu "menu action ảnh chuyển từ Generic Drawer sang dropdown") —
     * `callbacks.onOpenMenu` giờ NHẬN `menuBtn` (nút "..." vừa bấm, xem core/file-manager/photo-
     * ui.js::openImagePreviewModal()) — dùng làm `anchorEl` cho `openDropdownMenu()`.
     * MỚI (31/07/2026, Zoom mode) — giữ `modalHandle` ở `this._activeImageModalHandle` (Router cần
     * lại lúc xử lý toggle Zoom/nút X đóng — xem enterZoomMode()/exitImagePreviewMode()/
     * closeImagePreview()). `imagePreviewMode` reset về 'view' mỗi lần mở modal MỚI.
     * @param {string} imageKey
     * @param {string|null} activeAlbumId
     */
    async openImagePreview(imageKey, activeAlbumId) {
        const record = await getImageRecord(imageKey); // data layer (service/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác
        const image = { key: imageKey, ...record };

        this._activeImageKey = imageKey; // MỚI (31/07/2026) — Edit mode cần lại lúc decode canvas (enterEditMode())
        this._activeAlbumId = activeAlbumId; // MỚI (31/07/2026) — Lưu đè/Lưu mới cần lại (saveEditOverwrite()/saveEditAsNew())
        appState.set('imagePreviewMode', 'view');
        console.log(`writer: "openImagePreview", page: "imagePreviewMode", content: "view"`);

        this._activeImageModalHandle = openImagePreviewModal(image, { // core/file-manager/photo-ui.js
            onOpenMenu: (menuBtn) => this._openImageActionMenu(image, activeAlbumId, menuBtn),
            onCloseClick: () => eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imagePreview.close.click' }),
            onEditClick: () => eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imagePreview.editToggle.click' }),
        });
    },

    /** SỬA (21/07/2026, Giang yêu cầu) — menu action giờ là dropdown (core/dropdown-menu.js), THAY
     * Generic Drawer icon hoá cũ (đơn giản hoá, cùng khuôn `openAlbumActionMenu()` đã có sẵn trong
     * chính file này). `zIndex: 132` — TRÊN modal xem ảnh full-screen (`#image-preview-overlay`,
     * z-130) — dropdown MẶC ĐỊNH (126/127) chỉ đủ nổi trên nội dung panel thường, KHÔNG đủ nổi trên
     * 1 modal full-screen khác (xem docstring openDropdownMenu(), core/dropdown-menu.js).
     * MỚI (31/07/2026, Zoom mode, xoá item "Đặt làm nền Visual") — `dispatch()` giờ nhận thêm
     * `closePreview` (mặc định `true`, GIỮ NGUYÊN hành vi cũ cho setPlaylistBg/removeFromAlbum/
     * delete — đóng modal xem ảnh NGAY, KHÔNG qua eventBus/Block gate, đây là dọn UI của CHÍNH lần
     * mở menu này chứ không phải nghiệp vụ, xem `closeImagePreview()`). Riêng "Zoom" truyền
     * `closePreview: false` — đây là TOGGLE (bấm lại khi đang ở Zoom mode -> về 'view'), modal PHẢI
     * ở nguyên, không đóng — Router xử lý toggle qua VirtualMachineState đọc `imagePreviewMode`
     * (event/router/file-manager-photo.js). Nhãn item đổi theo mode hiện tại (đang Zoom -> "Thoát
     * Zoom") — KHÔNG tạo nút/DOM riêng nào để thoát (đúng chốt Giang: dùng lại chính item đó).
     * @param {{key: string, blob: Blob, filename: string}} image
     * @param {string|null} activeAlbumId
     * @param {HTMLElement} anchorEl - nút "..." vừa bấm.
     */
    _openImageActionMenu(image, activeAlbumId, anchorEl) {
        const dispatch = (action, closePreview = true) => {
            if (closePreview) this.closeImagePreview();
            eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imageMenu.action.click', payload: { action, imageKey: image.key } });
        };
        const isZooming = appState.get('imagePreviewMode') === 'zoom';
        const isEditing = appState.get('imagePreviewMode') === 'edit';
        const items = [
            { icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>', name: t('fileManager.photo.image.btnSetPlaylistBg'), callback: () => dispatch('setPlaylistBg') },
            { icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"/></svg>', name: t(isZooming ? 'fileManager.photo.image.btnExitZoom' : 'fileManager.photo.image.btnZoom'), callback: () => dispatch('zoom', false) },
            { icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 3v3m0 0v12a1 1 0 001 1h12M6 6h12a1 1 0 011 1v12m0 0h-3m3 0v-3"/></svg>', name: t('fileManager.photo.image.btnEditImage'), callback: () => dispatch('editImage') },
        ];
        // MỚI (31/07/2026) — CHỈ hiện khi đang ở Edit mode (đúng chốt Giang: "thêm dropdown action
        // cho lưu đè, lưu mới" — ĐÚNG 2 action MỚI duy nhất, còn lại các item khác giữ nguyên bất kể
        // mode). `closePreview: false` — saveEditOverwrite()/saveEditAsNew() tự đóng modal SAU KHI
        // lưu xong (cần handle.renderCanvas còn sống lúc chạy), không đóng NGAY như setPlaylistBg.
        if (isEditing) {
            items.push({ icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1-4l-4 4m0 0L7 3m4 4V1"/></svg>', name: t('fileManager.photo.image.btnSaveOverwrite'), callback: () => dispatch('saveOverwrite', false) });
            items.push({ icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.5v15m7.5-7.5h-15"/></svg>', name: t('fileManager.photo.image.btnSaveNew'), callback: () => dispatch('saveNew', false) });
        }
        if (activeAlbumId) items.push({ icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6"/></svg>', name: t('fileManager.photo.image.btnRemoveFromAlbum'), callback: () => dispatch('removeFromAlbum') });
        items.push({ icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>', name: t('fileManager.photo.image.btnDelete'), callback: () => dispatch('delete'), destructive: true });

        openDropdownMenu(anchorEl, items, { zIndex: 132 }); // core/dropdown-menu.js
    },

    /** Vào Zoom mode (bấm "Zoom" trong dropdown lúc `imagePreviewMode==='view'`) — init Panzoom
     * (core/image-zoom.js) thẳng trên `<img>` của modal đang mở. Ứng với 1 nhánh
     * VirtualMachineState ở Router (event/router/file-manager-photo.js, case
     * 'fileManagerPhoto.imageMenu.action.click', action==='zoom').
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

    /** Vào Edit mode (bấm icon Edit RIÊNG ở header modal — KHÁC "Sửa ảnh" trong dropdown, cái đó
     * TẠM THỜI vẫn giữ nguyên, điều hướng sang image-edit.html, xem `navigateToImageEdit()` — 2
     * đường vào cùng tồn tại vì bản Edit mode MỚI này (31/07/2026) mới chỉ làm xong nhóm "Điều
     * chỉnh", Crop/Vẽ/Text/Tách nền chưa port — xoá "Sửa ảnh" ngay bây giờ sẽ mất khả năng crop/xoay
     * thật cho tới khi port xong các nhóm còn lại).
     * decode ảnh vào canvas (core/photo-editor-engine.js::decodeImageToCanvas()) — ẩn `<img>`, hiện
     * `canvasWrap`, mở Generic Drawer hiện lưới tool theo nhóm (đúng chốt Giang: "generic tool grid,
     * nhóm theo Xxx header / list tool for xxx, thay vì vào từng sub menu").
     */
    async enterEditMode() {
        const handle = this._activeImageModalHandle;
        if (!handle) return; // guard: hiếm, modal đã đóng ở đâu đó trước khi tới đây

        appState.set('imagePreviewMode', 'edit');
        console.log(`writer: "enterEditMode", page: "imagePreviewMode", content: "edit"`);
        handle.editBtn.classList.remove('bg-white/10'); handle.editBtn.classList.add('bg-primary'); // đổi màu icon — "trạng thái sửa" (Giang chốt)

        const record = await getImageRecord(this._activeImageKey); // data layer (service/db.js) — đọc lại BLOB gốc thật, không dùng lại objectUrl <img> (tránh phụ thuộc trạng thái DOM của img)
        if (!record) { this.exitImagePreviewMode(); return; } // guard hiếm: ảnh vừa bị xoá ở tab khác giữa lúc bấm Edit

        const decoded = await decodeImageToCanvas(record.blob); // core/photo-editor-engine.js
        [handle.baseCanvas, handle.renderCanvas, handle.interactCanvas].forEach(c => {
            c.width = decoded.width; c.height = decoded.height;
        });
        handle.baseCanvas.getContext('2d').drawImage(decoded, 0, 0);
        handle.renderCanvas.getContext('2d').drawImage(decoded, 0, 0);

        handle.imgEl.classList.add('hidden');
        handle.canvasWrap.classList.remove('hidden');

        this._activeEditParams = { brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, sharpen: 0 };
        this._openEditToolGrid();
    },

    /** Mở Generic Drawer hiện lưới tool Edit mode, nhóm theo header + grid — nhóm "Điều chỉnh" bấm
     * được thật (mở `openAdjustTool()`), các nhóm còn lại (Công cụ/Vẽ/Tách nền) hiện mờ + bấm ra
     * thông báo "chưa khả dụng" (CHƯA port từ Lumina Pro — xem docstring đầu core/photo-editor-
     * engine.js).
     */
    _openEditToolGrid() {
        openGenericDrawer({ // core/generic-drawer.js
            height: 'auto', maxHeight: '70vh',
            zIndex: Z_INDEX.GENERIC_DRAWER, // core/config.js — không có modal nào khác mở đồng thời (chính modal xem ảnh KHÔNG tính, Drawer luôn nổi trên nó, xem Z_INDEX)
            headerHtml: this._buildImageMenuHeaderHtml(t('fileManager.photo.image.editGridTitle')),
            bodyHtml: this._buildEditToolGridHtml(),
            bodyClass: 'overflow-y-auto',
        });
        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this._closeGenericDrawerFully());

        genericDrawerBody.addEventListener('click', (e) => {
            const tile = e.target.closest('[data-edit-tool]');
            if (!tile) return;
            eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.editToolGrid.tile.click', payload: { tool: tile.dataset.editTool, available: tile.dataset.editToolAvailable === '1' } });
        });
    },

    /** @returns {string} bodyHtml lưới tool, nhóm theo header — đúng cấu trúc Giang yêu cầu: "Xxx
     * header / list tool for xxx", KHÔNG có bước drill-down vào sub-menu riêng như Lumina Pro gốc. */
    _buildEditToolGridHtml() {
        const buildGroup = (titleKey, tools, available) => `
            <h4 class="text-xs font-semibold text-slate-400 uppercase tracking-wide px-5 mt-5 mb-2.5 first:mt-0">${t(titleKey)}</h4>
            <div class="grid grid-cols-4 gap-2 px-5">
                ${tools.map(tool => `
                    <button type="button" data-edit-tool="${tool.key}" data-edit-tool-available="${available ? '1' : '0'}" class="flex flex-col items-center gap-1.5 py-3 rounded-xl ${available ? 'hover:bg-slate-100 active:bg-slate-200' : 'opacity-40'} transition-colors">
                        <span class="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 text-slate-700">${tool.icon}</span>
                        <span class="text-[11px] font-medium text-slate-600 text-center leading-tight">${t(tool.labelKey)}</span>
                    </button>
                `).join('')}
            </div>
        `;
        const svg = (path) => `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}"/></svg>`;
        return [
            buildGroup('fileManager.photo.image.editGroupAdjust', [
                { key: 'brightness', icon: svg('M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M7.05 16.95l-1.414 1.414m12.728 0l-1.414-1.414M7.05 7.05L5.636 5.636M16 12a4 4 0 11-8 0 4 4 0 018 0z'), labelKey: 'fileManager.photo.image.editToolBrightness' },
                { key: 'contrast', icon: svg('M12 21a9 9 0 100-18 9 9 0 000 18zM12 3v18'), labelKey: 'fileManager.photo.image.editToolContrast' },
                { key: 'saturation', icon: svg('M12 2.69l5.66 5.66a8 8 0 11-11.31 0z'), labelKey: 'fileManager.photo.image.editToolSaturation' },
                { key: 'temperature', icon: svg('M10 2a2 2 0 00-2 2v9.17a4 4 0 104 0V4a2 2 0 00-2-2z'), labelKey: 'fileManager.photo.image.editToolTemperature' },
                { key: 'tint', icon: svg('M7 21a4 4 0 01-4-4V5a2 2 0 012-2h10a2 2 0 012 2v3M7 21h10a2 2 0 002-2v-3a4 4 0 00-4-4H9'), labelKey: 'fileManager.photo.image.editToolTint' },
                { key: 'sharpen', icon: svg('M3 20h18L12 4 3 20z'), labelKey: 'fileManager.photo.image.editToolSharpen' },
            ], true),
            buildGroup('fileManager.photo.image.editGroupTools', [
                { key: 'crop', icon: svg('M6 3v3m0 0v12a1 1 0 001 1h12M6 6h12a1 1 0 011 1v12m0 0h-3m3 0v-3'), labelKey: 'fileManager.photo.image.editToolCrop' },
                { key: 'text', icon: svg('M4 7V4h16v3M9 20h6M12 4v16'), labelKey: 'fileManager.photo.image.editToolText' },
            ], false),
            buildGroup('fileManager.photo.image.editGroupDraw', [
                { key: 'draw', icon: svg('M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'), labelKey: 'fileManager.photo.image.editToolDraw' },
                { key: 'magic', icon: svg('M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z'), labelKey: 'fileManager.photo.image.editToolMagic' },
            ], false),
        ].join('');
    },

    /** Cấu hình min/max mỗi param điều chỉnh — sharpen bắt đầu từ 0 (không có "âm"), còn lại
     * -100..100 (0 = không đổi) — đúng khuôn Lumina Pro. */
    _adjustParamConfig: {
        brightness: { min: -100, max: 100 }, contrast: { min: -100, max: 100 }, saturation: { min: -100, max: 100 },
        temperature: { min: -100, max: 100 }, tint: { min: -100, max: 100 }, sharpen: { min: 0, max: 100 },
    },

    /** Ứng với 1 tile "Điều chỉnh" trong lưới Edit mode được bấm (`available: true`) — đóng Generic
     * Drawer, hiện popup slider tương ứng, gắn `oninput` trực tiếp (KHÔNG qua eventBus mỗi lần kéo
     * — tần suất quá cao cho mỗi lần kéo tay, cùng ngoại lệ "hot path" Rule 4 đã chốt cho vòng vẽ
     * visualizer 60fps — Workflow tự gắn thẳng, chỉ nghiệp vụ THẬT (mở tool/đóng modal...) mới qua
     * Router). Debounce qua `taskManager.once(fn, ms, name)` — CÙNG name mỗi lần gọi lại = tự huỷ
     * bản cũ + đặt lại (đúng hành vi debounce, xem docstring service/task-manager.js).
     * @param {string} paramKey - 'brightness'|'contrast'|'saturation'|'temperature'|'tint'|'sharpen'
     */
    openAdjustTool(paramKey) {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeEditParams) return; // guard: hiếm, thoát Edit mode ngay giữa lúc tap tile

        this._closeGenericDrawerFully();
        this._activeAdjustParam = paramKey;

        const config = this._adjustParamConfig[paramKey];
        handle.adjustLabelEl.textContent = t(`fileManager.photo.image.editTool${paramKey.charAt(0).toUpperCase()}${paramKey.slice(1)}`);
        handle.adjustSliderEl.min = config.min; handle.adjustSliderEl.max = config.max;
        handle.adjustSliderEl.value = this._activeEditParams[paramKey];
        handle.adjustValueEl.textContent = this._activeEditParams[paramKey];
        handle.adjustPopup.classList.remove('hidden');

        handle.adjustSliderEl.oninput = (e) => {
            const val = parseInt(e.target.value, 10);
            this._activeEditParams[paramKey] = val;
            handle.adjustValueEl.textContent = val;
            taskManager.once(() => this._renderEditPreview(), 60, 'photoEditAdjustPreview'); // service/task-manager.js — debounce, tránh tính lại pixel mỗi tick kéo tay
        };
    },

    /** Tính lại `renderCanvas` từ `baseCanvas` + `_activeEditParams` hiện tại (core/photo-editor-
     * engine.js) — KHÔNG đụng `baseCanvas` (giữ nguyên pixel gốc, cho phép chỉnh đi chỉnh lại tự
     * do trước khi Lưu đè/Lưu mới — tính năng Lưu CHƯA làm ở bản đầu này). */
    _renderEditPreview() {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeEditParams) return;
        let imageData = applyColorAdjustments(handle.baseCanvas, this._activeEditParams); // core/photo-editor-engine.js
        if (this._activeEditParams.sharpen > 0) imageData = applySharpenFilter(imageData, this._activeEditParams.sharpen); // core/photo-editor-engine.js
        handle.renderCanvas.getContext('2d').putImageData(imageData, 0, 0);
    },

    /** Xuất `renderCanvas` (kết quả đã áp Điều chỉnh) ra 1 Blob JPEG chất lượng cao — dùng chung
     * bởi cả `saveEditOverwrite()`/`saveEditAsNew()`. @returns {Promise<Blob>} */
    _exportEditedBlob() {
        return new Promise((resolve, reject) => {
            this._activeImageModalHandle.renderCanvas.toBlob((blob) => {
                if (!blob) { reject(new Error('[_exportEditedBlob] canvas.toBlob trả về null')); return; }
                resolve(blob);
            }, 'image/jpeg', 0.92);
        });
    },

    /** Sinh tên file MỚI cho "Lưu mới" — BẮT BUỘC khác tên gốc: `resolveImageKey()` (core/file-
     * manager/image.js) coi TRÙNG tên là "cùng ảnh, ghi đè đúng key cũ" — dùng nguyên tên gốc ở đây
     * sẽ vô tình ghi đè thay vì tạo ảnh mới, PHÁ hẳn ý nghĩa "Lưu mới" khác "Lưu đè".
     * @param {string} originalFilename @returns {string} */
    _buildEditedNewFilename(originalFilename) {
        const dotIndex = originalFilename.lastIndexOf('.');
        const base = dotIndex > 0 ? originalFilename.slice(0, dotIndex) : originalFilename;
        const ext = dotIndex > 0 ? originalFilename.slice(dotIndex) : '.jpg';
        return `${base}_edited_${Date.now()}${ext}`;
    },

    /** Ứng với item "Lưu đè" trong dropdown (CHỈ hiện khi `imagePreviewMode==='edit'`) — xuất
     * `renderCanvas` -> resize thumbnail (`_resizeImageForThumbnail()`, đã có sẵn, dùng chung upload)
     * -> `updateImageBlob()` (core/file-manager/image.js, ĐÃ CÓ SẴN, vốn viết cho image-edit.html —
     * TÁI DÙNG NGUYÊN, không viết lại) ghi đè ĐÚNG key đang mở, giữ nguyên vị trí/album. Đóng modal
     * + refresh lưới SAU KHI lưu xong.
     */
    async saveEditOverwrite() {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeEditParams) return; // guard: hiếm, không ở Edit mode nữa
        const imageKey = this._activeImageKey, activeAlbumId = this._activeAlbumId;

        await withLoadingShield(t('common.loading.savingImageEdit'), async () => {
            const finalBlob = await this._exportEditedBlob();
            const { thumbBlob, width, height } = await this._resizeImageForThumbnail(finalBlob);
            await updateImageBlob(imageKey, finalBlob, thumbBlob, width, height); // core/file-manager/image.js
        });
        this.closeImagePreview();
        await this.refresh(activeAlbumId);
        await alertModal(t('fileManager.photo.image.editSaveOverwriteSuccess'));
    },

    /** Ứng với item "Lưu mới" trong dropdown (CHỈ hiện khi `imagePreviewMode==='edit'`) — xuất
     * `renderCanvas` -> resize thumbnail -> `saveImage()` (core/file-manager/image.js, ĐÃ CÓ SẴN,
     * dùng CHUNG hàm upload) với tên file MỚI (`_buildEditedNewFilename()`, tránh vô tình ghi đè
     * bản gốc) -> nếu đang lọc theo 1 album, thêm luôn ảnh mới vào ĐÚNG album đó (đúng kỳ vọng "sửa
     * từ trong album thì ảnh mới cũng nằm trong album", không rơi ra thư viện chung). Đóng modal +
     * refresh lưới SAU KHI lưu xong.
     */
    async saveEditAsNew() {
        const handle = this._activeImageModalHandle;
        if (!handle || !this._activeEditParams) return; // guard: hiếm, không ở Edit mode nữa
        const activeAlbumId = this._activeAlbumId;

        await withLoadingShield(t('common.loading.savingImageEdit'), async () => {
            const originalRecord = await getImageRecord(this._activeImageKey); // data layer (service/db.js)
            const finalBlob = await this._exportEditedBlob();
            const { thumbBlob, width, height } = await this._resizeImageForThumbnail(finalBlob);
            const newFilename = this._buildEditedNewFilename(originalRecord ? originalRecord.filename : 'photo.jpg');
            const newKey = await saveImage(finalBlob, newFilename, thumbBlob, width, height); // core/file-manager/image.js
            if (activeAlbumId) await addImagesToAlbum([newKey], activeAlbumId); // core/file-manager/album.js
        });
        this.closeImagePreview();
        await this.refresh(activeAlbumId);
        await alertModal(t('fileManager.photo.image.editSaveNewSuccess'));
    },

    /** Thoát Zoom mode về 'view' (bấm lại "Zoom" lúc đang ở 'zoom') — huỷ phiên Panzoom, KHÔNG đóng
     * modal. An toàn gọi khi không có phiên nào đang chạy (guard `_activePanzoomSession`). Cũng
     * dùng cho Edit mode (bấm lại icon Edit lúc đang ở 'edit') — xem `_exitEditMode()`.
     */
    exitImagePreviewMode() {
        if (this._activePanzoomSession) { destroyPanzoomSession(this._activePanzoomSession); this._activePanzoomSession = null; } // core/image-zoom.js
        this._exitEditMode();
        appState.set('imagePreviewMode', 'view');
        console.log(`writer: "exitImagePreviewMode", page: "imagePreviewMode", content: "view"`);
    },

    /** Dọn Edit mode (nếu đang ở đó) — ẩn canvasWrap, hiện lại `<img>`, đóng popup Điều chỉnh +
     * Generic Drawer (nếu đang mở), gỡ class active khỏi `editBtn`, xoá params đang chỉnh. An toàn
     * gọi khi KHÔNG đang ở Edit mode (guard `_activeEditParams`) — dùng chung bởi
     * `exitImagePreviewMode()`/`closeImagePreview()`, KHÔNG tự đổi `imagePreviewMode` (2 hàm gọi nó
     * tự set 'view' sau).
     */
    _exitEditMode() {
        if (!this._activeEditParams) return;
        const handle = this._activeImageModalHandle;
        if (handle) {
            handle.canvasWrap.classList.add('hidden');
            handle.imgEl.classList.remove('hidden');
            handle.adjustPopup.classList.add('hidden');
            handle.editBtn.classList.remove('bg-primary'); handle.editBtn.classList.add('bg-white/10');
        }
        if (appState.get('isGenericDrawerOpen')) this._closeGenericDrawerFully();
        this._activeEditParams = null;
        this._activeAdjustParam = null;
    },

    /** Đóng THẬT modal xem ảnh — dọn phiên Panzoom nếu còn (Zoom mode) + dọn Edit mode nếu còn +
     * đóng handle + reset `imagePreviewMode` về 'view'. Dùng ở 2 nơi: (1) Router gọi khi bấm X
     * KHÔNG bị Block gate chặn (`imagePreviewMode==='view'` lúc đó, xem event/block.js), (2)
     * `_openImageActionMenu()` cho 3 action "quyết định" (setPlaylistBg/removeFromAlbum/delete) —
     * LUÔN đóng bất kể mode hiện tại, không cần thoát Zoom/Edit trước (khác nút X — 3 action này
     * chủ động, không phải bấm nhầm).
     */
    closeImagePreview() {
        if (this._activePanzoomSession) { destroyPanzoomSession(this._activePanzoomSession); this._activePanzoomSession = null; } // core/image-zoom.js
        this._exitEditMode();
        if (this._activeImageModalHandle) { this._activeImageModalHandle.close(); this._activeImageModalHandle = null; }
        appState.set('imagePreviewMode', 'view');
        console.log(`writer: "closeImagePreview", page: "imagePreviewMode", content: "view"`);
    },

    _buildImageMenuHeaderHtml(title) {
        return `
            <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200">
                <h3 class="text-base font-bold text-slate-900">${title}</h3>
                <button id="btn-generic-drawer-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500" title="${t('common.close')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
        `;
    },

    /** Trượt Generic Drawer xuống RỒI ẩn hẳn sau `transitionend` — cùng khuôn `_closeGenericDrawerFully()`
     * ở event/workflow/document-reader.js (Core `core/generic-drawer.js` KHÔNG được tự
     * `addEventListener` cho DOM tĩnh, Rule 5a — chỉ Workflow được làm). */
    _closeGenericDrawerFully() {
        closeGenericDrawer(); // core/generic-drawer.js
        genericDrawerPanel.addEventListener('transitionend', function onTransitionEnd() {
            genericDrawerPanel.removeEventListener('transitionend', onTransitionEnd);
            hideGenericDrawerImmediately(); // core/generic-drawer.js
        }, { once: true });
    },

    /** MỚI (14/07/2026, mục cuối) — điều hướng sang trang `image-edit.html` cho 1 ảnh, cùng khuôn
     * `workflowSubtitleModal.navigateToEditor()` (`window.location.href` toàn trang, KHÔNG
     * iframe/popup — 2 trang cùng origin `file://`, dùng chung IndexedDB, không cần postMessage).
     * TÁI DÙNG NGUYÊN `encodeSongKeyForUrl()` (service/song-key-cipher.js) — hàm đó CHỈ mã hoá 1
     * chuỗi key bất kỳ, không có gì "song" riêng trong thuật toán, không cần viết cipher thứ 2.
     * @param {string} imageKey
     */
    navigateToImageEdit(imageKey) {
        window.location.href = `image-edit.html?image=${encodeSongKeyForUrl(imageKey)}`; // service/song-key-cipher.js
    },

    /** Ứng với nút "Đặt làm nền Playlist" trong modal xem ảnh — TÁI DÙNG NGUYÊN applyBgImage().
     * Batch "nền chung" (07/07/2026) — applyBgImage() nay Rule 1-4 đầy đủ (không tự
     * updatePlaylistBg/saveConfig nội bộ nữa) — nơi gọi (ở đây) tự lo, giống hệt event/workflow/
     * visualizer-display.js::toggleBgImage().
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

    /** Ứng với nút "Dùng làm nền Slideshow" ở thanh quản lý album (MỚI, Batch 8).
     * @param {string} albumId
     */
    async setAsSlideshowBackground(albumId) {
        await workflowSlideshow.setActiveAlbum(albumId);
        await alertModal(t('fileManager.photo.album.setSlideshowBgSuccess'));
    },
};
