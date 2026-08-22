/**
 * event/workflow/file-manager-photo.js — "THẰNG THỰC THI CUỐI" cho panel Photo (quản lý thư viện
 * ảnh — upload/xem/xoá nhanh/đặt làm nền Playlist). Workflow không tự giữ state UI riêng (TRỪ
 * tham chiếu panel, xem Batch D6 dưới).
 *
 * NẠP SAU: core/file-manager/image.js, core/file-manager/photo-ui.js, core/settings-panel-stack.js
 * (pushSettingsPanel).
 *
 * XOÁ (loại bỏ Album khỏi Photo Panel) — toàn bộ quản lý Album (Album List sub-panel, add-to-album
 * picker, story slider cũ, "Dùng làm nền Slideshow", "Xoá khỏi album") bỏ hẳn cùng tính năng — Photo
 * giờ CHỈ còn 1 lưới ảnh phẳng, không còn khái niệm nhóm/lọc theo album. Sẽ thay bằng Folder Photo
 * trong File Browser ở đợt riêng (pending).
 *
 * === Batch D6 (Settings restructure, 06/07/2026) ===
 * Panel Photo giờ push/pop động (core/settings-panel-stack.js) — `fileManagerPhotoPanelEl` (biến
 * module bên dưới) lưu panel đang mở, cùng pattern đã dùng ở Slideshow/Song (event/workflow/
 * slideshow.js::slideshowSettingsPanelEl, event/workflow/file-manager-song.js::
 * fileManagerSongPanelEl) — KHÔNG chủ động null-hoá lúc đóng (vô hại, lý do y hệt 2 nơi kia). Modal
 * (openImagePreviewModal...) KHÔNG cần đổi gì — tự dựng overlay ĐỘC LẬP (document.body), không phụ
 * thuộc panel.
 *
 * Lưới ảnh dùng `setupPhotoGridWindow()` gọi thẳng `workflowPhotoGalleryWindow.mount()`
 * (event/workflow/photo-gallery-window.js): windowing cấp NHÓM NGÀY qua `IntersectionObserver`
 * (trình duyệt tự lo, không tự nghe 'scroll'/tự tính offset bằng tay nào nữa) + fjGallery (thư viện
 * thật, CDN) lo layout justified thật.
 *
 * Nút upload + nút "xoá nhanh" nằm trong `headerActionHtml` (core/settings-panel-stack-ui.js) —
 * `openPanel()` tự build, KHÔNG còn thanh riêng dưới header. Chế độ "xoá nhanh" ảnh — bấm ảnh để
 * ĐÁNH DẤU, bấm icon thùng rác để xoá batch 1 lần (xem `promptQuickDeleteMode`/
 * `toggleQuickDeleteMarkInSet`/`confirmQuickDeleteBatch`, docstring chi tiết ở từng hàm).
 * `openPanel()` bọc `withLoadingShield()` quanh lần `refresh()` ĐẦU TIÊN — DOM lưới ảnh (nặng —
 * nhiều object URL) KHÔNG được tải song song lúc panel còn đang trượt vào, phải tải SAU KHI đã vào
 * hẳn, che bằng shield, chỉ tắt khi xong.
 */
let fileManagerPhotoPanelEl = null; // SỬA (đợt tái cấu trúc bottom nav App Panel) — giờ luôn trỏ `settingsStackPanelMain` TĨNH (components/photo-panel.js) SAU lần openPanel() đầu tiên, KHÔNG còn null lúc đóng nữa (panel Photo không bị .remove() khi đóng, chỉ ẩn qua #photo-panel.hidden) — dùng photoPanel.classList.contains('hidden') để biết đang mở/đóng, xem các guard bên dưới.
let _imagePickerSession = null; // MỚI (Giai đoạn 4) — session picker ảnh Generic Drawer đang mở (null = đang đóng). Handle của UI, KHÔNG phải state nghiệp vụ ảnh hưởng rẽ nhánh Router — cùng loại với biến panel ngay trên.

// ĐÃ GỠ (rewrite Photo/Album, dùng fjGallery) — PHOTO_GRID_HEADER_HEIGHT_PX/PHOTO_GRID_GAP_PX không
// còn dùng: chiều cao header ngày giờ THUẦN CSS (assets/css/style.css::.photo-day-header { height:
// 40px }, không cần JS biết trước nữa — windowing cấp NHÓM NGÀY, không cần cộng dồn chiều cao TỪNG
// HÀNG như bản cũ); khoảng cách giữa ảnh giờ truyền thẳng `gutter: 2` vào config fjGallery (xem
// event/workflow/photo-gallery-window.js::_loadGroup()), không cần hằng số riêng ở đây.
// MỚI (Giai đoạn 1, rewrite Photo/Album, mục 3b/3c) — chiều cao CỐ ĐỊNH (px) của 1 hàng ảnh kiểu
// "justified row" (Google Photos thật). Dùng ở 2 chỗ, BẮT BUỘC khớp nhau:
//   1. `resizeImageForThumbnail()` (ngay dưới) — resize `thumbBlob` lúc upload đúng chiều cao này.
//   2. `rowHeight` truyền vào fjGallery (event/workflow/photo-gallery-window.js) — thư viện tự nong/
//      co MỖI HÀNG THẬT quanh giá trị này (KHÔNG cố định tuyệt đối như bản windowing tự viết cũ —
//      đây chính là đúng thuật toán Flickr/Google Photos, khác hẳn "mọi hàng cao ĐÚNG N px").
// Giá trị 120 là mặc định hợp lý — đổi tuỳ ý, chỉ cần đổi ĐÚNG 1 chỗ (hằng số dùng chung).
const PHOTO_ROW_HEIGHT_PX = 120;
// MỚI (Giang yêu cầu — "resize thumb theo tỉ lệ 20% width và 20% height") — hệ số co CẢ 2 chiều lúc
// resize `thumbBlob` (`resizeImageForThumbnail()` ngay dưới). TÁCH BIỆT hẳn khỏi
// PHOTO_ROW_HEIGHT_PX (chỉ còn ý nghĩa "chiều cao HIỂN THỊ trong lưới" truyền cho fjGallery, KHÔNG
// còn liên quan gì tới kích thước THẬT của file thumbBlob lưu trong DB nữa).
const THUMBNAIL_SCALE_RATIO = 0.2;

const workflowFileManagerPhoto = {

    _activeImageModalHandle: null, // { close, imgEl, canvasWrap, baseCanvas, renderCanvas, interactCanvas, toolsBtn, adjustPopup, ... } của modal xem ảnh đang mở — null khi không mở modal nào
    _activePanzoomSession: null,   // session Panzoom đang chạy khi ở Zoom mode — null khi không ở Zoom mode (core/image-zoom.js)
    _activeImageKey: null,         // key ảnh đang mở modal — workflowImageEdit đọc lại qua getActiveImageKey()

    /** 2 khe ĐỌC hẹp cho workflowImageEdit (miền khác — event/workflow/image-edit.js) tự lấy
     * lại handle/imageKey của modal đang mở lúc `enterEditMode()`, KHÔNG cần workflow đó
     * tự giữ tham chiếu riêng đến vòng đời modal (GHI vẫn CHỈ qua các hàm ở file này). */
    getActiveImageModalHandle() { return this._activeImageModalHandle; },
    getActiveImageKey() { return this._activeImageKey; },

    /** Ứng với 'fileManagerPhoto.openPanel.click'. `fullBleed: true` — masonry/story slider vốn
     * thiết kế tràn viền (edge-to-edge), KHÔNG dùng khung "max-w-2xl mx-auto" mặc định.
     *
     * SỬA (đợt tái cấu trúc bottom nav App Panel, phản hồi Giang — "Photo là khung full-screen
     * riêng, ngang hàng Setting") — Photo KHÔNG còn là panel con PUSH vào `#drawer-settings` cũ
     * (đã xoá hẳn) — giờ là Main (đáy ngăn xếp) của khung `#photo-panel` riêng (components/
     * photo-panel.js). `pushSettingsPanel()` (tạo panel MỚI, đẩy chồng lên) đổi thành ghi THẲNG
     * vào `settingsStackPanelMain` TĨNH có sẵn (dom-refs.js) — panel này KHÔNG BAO GIỜ bị pop
     * (đáy ngăn xếp, đúng bản chất Main, xem core/settings-panel-stack-ui.js). Header dựng THỦ
     * CÔNG (không qua `_buildPanelInnerHtml()`, hàm đó LUÔN kèm nút Back — sai ngữ nghĩa cho Main,
     * Main phải đóng HẲN Photo, không phải lùi 1 cấp) — nút Close (`#btn-photo-panel-close`) đứng
     * CHUNG khối `absolute right-4` với `headerActionHtml` (upload/xoá nhanh), đúng khuôn layout
     * `_buildPanelInnerHtml()` (chỉ khác nội dung).
     *
     * XOÁ (cùng đợt) — bước chờ `taskManager.once(..., SLIDER_PANEL_SCROLL_ESTIMATED_MS, ...)`
     * trước khi tải ảnh: bước đó tồn tại để đợi ANIMATION TRƯỢT của `pushSettingsPanel()` chạy
     * xong trước khi đo `clientWidth/clientHeight` cho windowing — Main giờ KHÔNG trượt vào (ghi
     * `innerHTML` tức thời, `#photo-panel` chỉ toggle `.hidden`, không có transition trượt), nên
     * bước chờ không còn ý nghĩa, bỏ hẳn.
     */
    async openPanel() {
        settingsStackPanelMain.innerHTML = `
            <div class="relative flex items-center justify-center px-14 py-3 sm:px-16 h-14 shrink-0">
                <h2 class="text-base sm:text-lg font-semibold text-white truncate text-center">${t('fileManager.photo.title')}</h2>
                <div class="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 shrink-0">
                    ${this._buildHeaderActionHtml()}
                    <button id="btn-photo-panel-close" class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-rose-500 transition-colors text-white shrink-0"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
                </div>
            </div>
            <div class="flex-grow overflow-y-auto flex flex-col">${renderFileManagerPhotoPanelBody()}</div>
        `;
        fileManagerPhotoPanelEl = settingsStackPanelMain;
        wirePhotoPanelHeaderActions(fileManagerPhotoPanelEl); // core/file-manager/photo-ui.js

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

    /** Ứng với 'fileManagerPhoto.uploadTrigger.click' — mở thẳng hộp thoại chọn file. */
    triggerUploadInput() {
        if (photoPanel.classList.contains('hidden')) return; // SỬA đợt tái cấu trúc bottom nav — xem ghi chú refresh()
        const uploadInput = fileManagerPhotoPanelEl.querySelector('#file-manager-image-upload-input');
        if (uploadInput) uploadInput.click();
    },

    /** Đọc lại toàn bộ ảnh, vẽ lại lưới ảnh chính + nút xoá nhanh. Dùng lại ở MỌI nơi cần vẽ lại
     * lưới ảnh chính (mở panel, upload xong, xoá ảnh xong, bật/tắt/xác nhận xoá nhanh).
     *
     * XOÁ (loại bỏ Album khỏi Photo Panel) — chip lọc album (`activeAlbumId`/`activeAlbum`/
     * `displayedImages` lọc theo album/nút vào Album List) bỏ hẳn cùng tính năng — lưới LUÔN hiện
     * TOÀN BỘ ảnh, không còn khái niệm "đang lọc theo 1 album".
     * @param {boolean} [imageQuickDeleteMode]
     * @param {Set<string>} [quickDeleteSelectedKeys]
     */
    async refresh(imageQuickDeleteMode = false, quickDeleteSelectedKeys = new Set()) {
        if (photoPanel.classList.contains('hidden')) return; // guard: panel đã đóng (SỬA đợt tái cấu trúc bottom nav — fileManagerPhotoPanelEl giờ trỏ settingsStackPanelMain TĨNH, luôn truthy, không còn dùng được làm cờ mở/đóng)
        const images = await listImages(); // core/file-manager/image.js

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

        const emptyEl = fileManagerPhotoPanelEl.querySelector('#file-manager-image-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', images.length > 0);
        this.setupPhotoGridWindow(
            fileManagerPhotoPanelEl.querySelector('#file-manager-image-scroll'),
            images,
            { quickDeleteMode: imageQuickDeleteMode, quickDeleteSelectedKeys }
        );
    },

    /** MỚI (14/07/2026, mục 2.2) — hỏi xác nhận TRƯỚC KHI bật chế độ xoá nhanh (modalChoice()) —
     * chỉ BẬT mới cần hỏi, TẮT thì không (xem event/router/file-manager-photo.js). */
    promptQuickDeleteMode(onConfirm) {
        modalChoice( // core/modal-choice-ui.js
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
        if (photoPanel.classList.contains('hidden')) return; // SỬA đợt tái cấu trúc bottom nav — xem ghi chú refresh()
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
        if (photoPanel.classList.contains('hidden')) return; // SỬA đợt tái cấu trúc bottom nav — xem ghi chú refresh()
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
     * `onConfirmed` — callback Router truyền vào (KHÔNG tự set `imageQuickDeleteMode=false` ở đây —
     * Workflow không tự mutate được biến closure primitive của Router). Gọi ĐÚNG lúc xoá xong THẬT (bên trong `onClick` nút xác nhận, SAU khi
     * `deleteImage()` đã chạy xong) — KHÔNG gọi sớm hơn, vì user có thể bấm Huỷ ở modal, lúc đó mode
     * PHẢI vẫn đang bật (UI vẫn đúng thực tế, không lệch với Router).
     * @param {Set<string>} quickDeleteSelectedKeys
     * @param {() => void} onConfirmed
     */
    async confirmQuickDeleteBatch(quickDeleteSelectedKeys, onConfirmed) {
        const keys = Array.from(quickDeleteSelectedKeys);
        modalChoice( // core/modal-choice-ui.js
            tFormat('fileManager.photo.image.quickDeleteBatchConfirm.confirm', { count: keys.length }),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.photo.image.quickDeleteBatchConfirm.confirmBtn'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    // SỬA (v14) — bỏ hẳn `splitVisualBgProtectedKeys()`/chặn ảnh đang làm Visual
                    // Background: nguồn giờ là 1 mảng key riêng của workflowVisualBg, xoá ảnh gốc ở
                    // đây không cần biết gì tới nó — lần advance()/apply() kế tiếp bên đó tự phát
                    // hiện record mất + tự chữa lành (xem core/visual-bg.js::advanceVisualBgList()).
                    await withLoadingShield(t('common.loading.savingInfo'), async () => {
                        for (const key of keys) await deleteImage(key); // core/file-manager/image.js
                    });
                    quickDeleteSelectedKeys.clear();
                    onConfirmed(); // Router tự đồng bộ imageQuickDeleteMode=false — ĐÚNG lúc này, không sớm hơn
                    await this.refresh(false, quickDeleteSelectedKeys);
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
     * Dùng CHUNG cho lưới ảnh chính (`refresh()`) LẪN picker ảnh Generic Drawer
     * (`_openImagePickerDrawer()` ngay dưới — Workflow gọi Workflow miền khác, TỰ DO theo
     * event-bus-flow.md mục 4B).
     * @param {HTMLElement} scrollEl - container CUỘN, ĐÃ có trong DOM thật.
     * @param {Array<{key:string, blob:Blob, thumbBlob?:Blob, width?:number, height?:number, filename:string, addedAt:number}>} images
     * @param {{selectionMode?: boolean, selectedImageKeys?: Set<string>, quickDeleteMode?: boolean, quickDeleteSelectedKeys?: Set<string>}} [ctx]
     *        `selectionMode`/`selectedImageKeys` — picker chọn 1 ảnh (mountKey 'genericDrawer' —
     *        xem `_openImagePickerDrawer()`). `quickDeleteMode`/`quickDeleteSelectedKeys` — lưới
     *        ảnh chính (mountKey 'photoGrid'). 2 cặp field LOẠI TRỪ NHAU tuỳ mountKey/mode.
     * @param {string} [mountKey] - phân biệt lưới ảnh chính (mặc định 'photoGrid') với picker ảnh
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

    // ===================== XOÁ (loại bỏ Album khỏi Photo Panel) — Album List sub-panel
    // (openAlbumListPanel/_buildAlbumListHeaderActionHtml/refreshAlbumListPanel/openAlbumActionMenu/
    // promptCreateAlbumFromList/renameAlbumFromList/deleteAlbumFromList/viewAlbumImages) bỏ hẳn
    // cùng tính năng — sẽ thay bằng Folder Photo trong File Browser (đợt riêng, pending). =========

    // ===================== Picker ảnh dùng chung (Generic Drawer) — 1 CHẾ ĐỘ DUY NHẤT: single-
    // select (chọn 1 ảnh, vd bìa bài hát/Theme Background). XOÁ (loại bỏ Album khỏi Photo Panel) —
    // chế độ multi-select (thêm ảnh có sẵn vào album) bỏ hẳn cùng tính năng — picker giờ CHỈ còn
    // đúng 1 mode, `_imagePickerSession.mode` luôn là 'singleSelectCover', KHÔNG còn nút xác nhận
    // cố định đáy (nút đó CHỈ tồn tại cho mode multiSelectAlbum đã xoá) — tap ẢNH NÀO là chọn NGAY
    // ảnh đó + đóng drawer. =====================================================================

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
     * Height `90vh` (Giang yêu cầu — mặc định `70vh` của Generic Drawer không đủ chỗ cho lưới ảnh
     * cuộn thoải mái, khác hẳn menu action chỉ vài dòng chữ). Trình tự ĐÃ CHỐT: drawer trượt lên xong
     * HẲN (nghe `transitionend` THẬT, core/generic-drawer.js) -> đọc DB + windowing.
     * @param {string} title
     */
    async _openImagePickerDrawer(title) {
        // SỬA (31/07/2026, Giang chỉ ra "core tạo ra addEventListener chứ không phải workflow") —
        // TOÀN BỘ phần dựng Generic Drawer + wire closeBtn/delegated click lưới ảnh ĐÃ DỜI sang
        // core/file-manager/photo-ui.js::openPhotoImagePickerDrawerUi() — Rule 5a cấp quyền
        // addEventListener cho DOM động là quyền CỦA CORE, Workflow chỉ gọi Core với data đã
        // chuẩn bị sẵn (title/bodyHtml), không tự cầm DOM API nữa.
        openMediaPickerDrawerUi('fileManagerPhoto', 'fileManagerPhoto.imagePicker', title, this._buildImagePickerBodyHtml(), '[data-image-key]', 'imageKey', false); // core/file-manager/photo-ui.js

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
        this.setupPhotoGridWindow(scrollEl, images, {}, 'genericDrawer'); // KHÔNG badge, tap = chọn ngay
    },

    /** HTML khung picker: scroll container (grid windowing sẽ chèn vào TRONG đây). Đặt ở Workflow —
     * hàm THUẦN chỉ trả string (không `createElement`/`addEventListener`), KHÔNG thuộc phạm vi
     * Rule 5a/5c, khác hẳn phần dựng+wire Generic Drawer thật (đã dời sang core/file-manager/
     * photo-ui.js::openPhotoImagePickerDrawerUi()).
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
     * không được đụng theo Rule 1-4 (`Image`/`canvas` scratch ở đây phục vụ TÍNH TOÁN dựng lưới,
     * KHÔNG có underscore — dùng CHUNG bởi `uploadImages()` (dưới) VÀ `workflowImageEdit` (miền
     * khác, event/workflow/image-edit.js — Lưu đè/Lưu mới cũng cần resize thumbnail).
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

    /** Ứng với 'fileManagerPhoto.upload.change'.
     * SỬA (Giai đoạn 1, rewrite Photo/Album, mục 3c/3d) — resize `thumbBlob` (`resizeImageForThumbnail()`
     * ngay trên) TRƯỚC khi gọi `saveImage()` (core/file-manager/image.js — đổi chữ ký, nhận thêm
     * `thumbBlob`/`width`/`height`). Lỗi resize 1 ảnh (vd file hỏng) KHÔNG được chặn cả lô upload —
     * bắt riêng, bỏ qua đúng ảnh đó, tiếp tục ảnh sau (Rule 1: vẫn 1 tiến trình "upload cả lô", guard
     * lỗi từng phần tử không tính là rẽ nhánh nghiệp vụ).
     * XOÁ (loại bỏ Album khỏi Photo Panel) — auto-add vào album đang lọc bỏ hẳn cùng tính năng.
     * @param {FileList} files
     */
    async uploadImages(files) {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        let failedCount = 0;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            for (const file of fileArray) {
                try {
                    const { thumbBlob, width, height } = await this.resizeImageForThumbnail(file);
                    await saveImage(file, file.name, thumbBlob, width, height); // core/file-manager/image.js — chữ ký MỚI, CÓ return (imageKey), không cần dùng ở đây nữa
                } catch (err) {
                    console.error(`[uploadImages] resize/lưu thất bại cho file "${file.name}":`, err);
                    failedCount++;
                }
            }
        });
        if (!photoPanel.classList.contains('hidden')) { // SỬA đợt tái cấu trúc bottom nav — xem ghi chú refresh()
            const uploadInput = fileManagerPhotoPanelEl.querySelector('#file-manager-image-upload-input');
            if (uploadInput) uploadInput.value = ''; // cho phép chọn lại đúng file cũ ở lần sau
        }
        await this.refresh();
        const successCount = fileArray.length - failedCount;
        await alertModal(tFormat('fileManager.photo.image.uploadSuccess', { count: successCount }));
    },

    /** Ứng với 'fileManagerPhoto.image.click' khi imageQuickDeleteMode=false (xem router) — CŨNG là
     * đích gọi khi tap ảnh trong list item Playlist (activeMediaSource='photo', xem event/router/
     * playlist.js case 'playlist.item.playClick') — tap ảnh ở CẢ 2 nơi đều mở XEM,
     * KHÔNG bao giờ vào visualizer/playMedia() (hợp nhất Photo vào Playlist, CHỐT Giang).
     * MỚI (31/07/2026, Zoom mode) — giữ `modalHandle` ở `this._activeImageModalHandle` (Router cần
     * lại lúc xử lý toggle Zoom/nút X đóng — xem enterZoomMode()/exitImagePreviewMode()/
     * closeImagePreview()). `imagePreviewMode` reset về 'view' mỗi lần mở modal MỚI.
     * MỚI (hợp nhất Photo vào Playlist) — tăng `count` trong `mediaStatsMap` (dùng CHUNG với Song/
     * Video, Sort trục thống kê đọc field này — ý nghĩa đổi thành "lượt click xem" cho Photo, CHỐT
     * Giang) mỗi lần mở xem, bất kể mở từ Photo Panel hay từ Playlist — 1 hành vi "xem ảnh" duy
     * nhất, không phân biệt điểm vào.
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
        items.push({ icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>', name: t('fileManager.photo.image.btnDelete'), callback: () => dispatch('fileManagerPhoto.imageMenu.delete.click'), destructive: true });

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

    // XOÁ (loại bỏ Album khỏi Photo Panel) — setAsSlideshowBackground() (nút "Dùng làm nền
    // Slideshow" ở thanh quản lý album) bỏ hẳn — Visual Background mất tuỳ chọn "Nhóm ảnh" tạm
    // thời, sẽ thay bằng Folder Photo (File Browser overhaul, đợt riêng, pending).
};
