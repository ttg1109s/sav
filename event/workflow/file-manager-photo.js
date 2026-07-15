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
 * dưới), gọi `workflowVirtualList.mount()` (event/workflow/virtual-list.js) — file ĐÓ mới là nơi
 * thật sự đo/dựng/vẽ lại; `scroll` đi ĐÚNG luồng listener->bus->router->workflow (SỬA 14/07/2026,
 * Giang chỉ ra bản đầu Workflow này tự `addEventListener('scroll', ...)` là SAI).
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

// Chiều cao (px) CỐ ĐỊNH của 1 hàng header ngày — PHẢI khớp đúng class `h-10` ở
// components/items.js::itemTemplateImageGridRow() (đổi 1 trong 2 chỗ PHẢI đổi luôn chỗ kia).
const PHOTO_GRID_HEADER_HEIGHT_PX = 40;
// Khớp .photo-grid { gap: 2px } ở assets/css/style.css — đổi CSS gap thì phải đổi luôn hằng số này.
const PHOTO_GRID_GAP_PX = 2;
// Khớp minmax(110px, ...) trong .photo-grid (assets/css/style.css, auto-fill — KHÔNG còn breakpoint
// cố định) — đổi 1 trong 2 chỗ PHẢI đổi luôn chỗ kia (JS cần biết TRƯỚC số cột THẬT trình duyệt sẽ
// tự tính, để chia ảnh vào đúng hàng cho windowing).
// ĐÃ GỠ ở Giai đoạn 2 (`PHOTO_TILE_MIN_PX` không còn dùng — thay bằng `PHOTO_ROW_HEIGHT_PX` ngay
// dưới, đổi hẳn từ lưới NxN cố định sang hàng cao cố định/rộng theo tỉ lệ ảnh, mục 3b). CSS Grid
// `auto-fill`/`minmax` cũng đã bỏ (assets/css/style.css::.photo-grid).
// MỚI (Giai đoạn 1, rewrite Photo/Album, mục 3b/3c) — chiều cao CỐ ĐỊNH (px) của 1 hàng ảnh kiểu
// "justified row" (Google Photos thật — KHÔNG phải ô vuông NxN). Dùng ở 2 chỗ, BẮT BUỘC khớp nhau:
//   1. `_resizeImageForThumbnail()` (ngay dưới) — resize `thumbBlob` lúc upload đúng chiều cao này.
//   2. CSS hàng ảnh (Giai đoạn 2, thay `.photo-tile { aspect-ratio: 1/1 }`) + buildPhotoGridRows()
//      (core/file-manager/image.js, tham số `rowHeightPx`, GỌI Ở Giai đoạn 2 khi nối lại windowing).
// Giá trị 120 là mặc định hợp lý (gần bằng PHOTO_TILE_MIN_PX cũ) — đổi tuỳ ý, chỉ cần đổi ĐÚNG 1 chỗ
// (hằng số dùng chung, không lặp lại số ở nơi khác).
const PHOTO_ROW_HEIGHT_PX = 120;
// Khớp w-16 (64px) + gap-4 (16px) ở album story (components/file-manager.js) — đổi CSS thì phải đổi luôn.
// ĐÃ GỠ (Giai đoạn 3b) — ALBUM_STORY_TILE_WIDTH_PX/ALBUM_STORY_GAP_PX không còn dùng sau khi bỏ
// hẳn story slider ngang (thay bằng Album List sub-panel, xem openAlbumListPanel() ngay dưới).

const workflowFileManagerPhoto = {

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
     * trùng nhiều lần lên CÙNG 1 nút tĩnh). */
    _wireHeaderActionEvents() {
        const uploadBtn = fileManagerPhotoPanelEl.querySelector('#btn-file-manager-image-upload-trigger');
        const uploadInput = fileManagerPhotoPanelEl.querySelector('#file-manager-image-upload-input');
        if (uploadBtn && uploadInput) uploadBtn.addEventListener('click', () => uploadInput.click());
        // (change của uploadInput đã wire ở event/listener/file-manager-photo.js — delegated qua settingsStackBody)
        const deleteModeBtn = fileManagerPhotoPanelEl.querySelector('#btn-file-manager-image-delete-mode');
        if (deleteModeBtn) deleteModeBtn.addEventListener('click', () => {
            eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.image.deleteMode.click', payload: {} });
        });
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
     * "thêm ảnh vào album" giờ là picker Generic Drawer riêng (KHÔNG đụng lưới ảnh chính nữa, xem
     * `openAlbumImagePicker()`), "focus đúng trang vừa tạo album" giờ thuộc
     * `promptCreateAlbumFromList()` (Album List sub-panel tự lo trang của NÓ, không liên quan lưới
     * ảnh chính này nữa).
     * @param {string|null} activeAlbumId
     * @param {boolean} [imageQuickDeleteMode]
     * @param {Set<string>} [quickDeleteSelectedKeys]
     */
    async refresh(activeAlbumId, imageQuickDeleteMode = false, quickDeleteSelectedKeys = new Set()) {
        if (!fileManagerPhotoPanelEl) return; // guard: panel đã đóng
        const images = await listImages(); // core/file-manager/image.js

        let activeAlbum = null;
        if (activeAlbumId) {
            const albums = await listAlbums(); // core/file-manager/album.js
            activeAlbum = albums.find((a) => a.id === activeAlbumId) || null;
        }

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
     * `quickDeleteSelectedKeys` (Set closure ở Router) — patch DOM surgical qua `redraw()`, KHÔNG
     * `refresh()`, KHÔNG đọc/ghi DB gì cả — cùng khuôn `toggleImageSelectionInSet()` ngay trên (chỉ
     * khác Set đích + mountKey ctx field).
     * @param {string} imageKey
     * @param {Set<string>} quickDeleteSelectedKeys
     */
    toggleQuickDeleteMarkInSet(imageKey, quickDeleteSelectedKeys) {
        if (quickDeleteSelectedKeys.has(imageKey)) quickDeleteSelectedKeys.delete(imageKey);
        else quickDeleteSelectedKeys.add(imageKey);
        workflowVirtualList.redraw('photoGrid'); // event/workflow/virtual-list.js — ctx.quickDeleteSelectedKeys truyền vào mount() lúc refresh() là CHÍNH Set này (cùng tham chiếu, Router giữ nguyên object)
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

    /** MỚI (Patch mục 2, 14/07/2026) — chuẩn bị "hàng lưới" (buildPhotoGridRows(), core) rồi giao
     * cho `workflowVirtualList.mount()` (event/workflow/virtual-list.js) đo/dựng/vẽ — file NÀY
     * KHÔNG tự đụng DOM cuộn/scroll listener nữa (SỬA 14/07/2026, xem docstring đầu file). Dùng
     * CHUNG cho Photo & Album (gọi từ refresh()) LẪN picker cover bài hát (event/workflow/
     * playlist.js — Workflow gọi Workflow miền khác, TỰ DO theo event-bus-flow.md mục 4B).
     *
     * GIẢI THÍCH BUG CŨ (14/07/2026, Giang báo "chỉ hiển thị đầy đủ SAU 1 thay đổi DOM khác", "layout
     * vẫn sai") — NGUYÊN NHÂN GỐC lúc đó: `columns` tính từ `scrollEl.clientWidth` NGAY tại đây,
     * TRƯỚC CẢ khi gọi `mount()`, dựa trên việc "đoán" số cột CSS `auto-fill` SẼ tự vẽ ra — sai 1 ly
     * (đo `clientWidth` lúc panel chưa settle layout xong, ra `0`) là `buildPhotoGridRows()` gộp SAI
     * số ảnh/hàng, KHÔNG khớp layout CSS thật vẽ ra sau đó.
     * SỬA (Giai đoạn 2, rewrite Photo/Album, mục 3b) — bỏ HẲN khái niệm `columns`/CSS Grid auto-fill.
     * Giờ mỗi hàng là 1 `.photo-row` FLEX tường minh (components/items.js::itemTemplateImageGridRow()),
     * cao CỐ ĐỊNH `PHOTO_ROW_HEIGHT_PX`, tile rộng theo `aspect-ratio` CSS thật (không cần trình
     * duyệt "đoán" cột nữa) — `buildPhotoGridRows()` chỉ cần `containerWidthPx` (đo 1 LẦN DUY NHẤT,
     * TRƯỚC khi build rows) để biết dừng hàng ở đâu, KHÔNG cần khớp lại với bất kỳ phép đo DOM nào
     * SAU đó nữa. `computeRowHeights()` (bên trong `mount()`) giờ trả về HẰNG SỐ thuần (không đo
     * `sizerEl.clientWidth` như bản cũ) — loại bỏ hẳn lớp fragility THỨ 2 (2 lần đo DOM ở 2 thời điểm
     * khác nhau phải khớp nhau) từng gây ra đúng bug này.
     * Guard `clientWidth === 0` NGAY DƯỚI đây VẪN GIỮ NGUYÊN — vẫn cần đo `containerWidthPx` ĐÚNG lúc
     * container đã có kích thước thật (panel/khung cha có thể chưa settle layout xong), chỉ khác là
     * giờ CHỈ đo 1 LẦN cho mục đích packing hàng, không còn ai đo lại lần 2 cho chiều cao nữa.
     * @param {HTMLElement} scrollEl - container CUỘN, ĐÃ có trong DOM thật.
     * @param {Array<{key:string, blob:Blob, thumbBlob?:Blob, width?:number, height?:number, filename:string, addedAt:number}>} images
     * @param {{selectionMode?: boolean, selectedImageKeys?: Set<string>, quickDeleteMode?: boolean, quickDeleteSelectedKeys?: Set<string>}} [ctx]
     *        `selectionMode`/`selectedImageKeys` — picker "thêm ảnh vào album" (mountKey 'genericDrawer').
     *        `quickDeleteMode`/`quickDeleteSelectedKeys` — lưới ảnh chính (mountKey 'photoGrid'). 2
     *        cặp field LOẠI TRỪ NHAU tuỳ mountKey, KHÔNG BAO GIỜ cả 4 field cùng có nghĩa 1 lúc.
     * @param {string} [mountKey] - phân biệt Photo & Album (mặc định 'photoGrid') với picker cover
     *        bài hát ('photoGridPicker', truyền tường minh từ playlist.js) — 2 container ĐỘC LẬP.
     */
    setupPhotoGridWindow(scrollEl, images, ctx, mountKey = 'photoGrid') {
        if (!scrollEl) return;
        if (scrollEl.clientWidth === 0 || scrollEl.clientHeight === 0) {
            // Container CHƯA có kích thước thật (panel/khung cha còn đang settle layout) — thử lại
            // NGAY khung hình kế tiếp, KHÔNG vẽ gì với số liệu sai lúc này.
            requestAnimationFrame(() => this.setupPhotoGridWindow(scrollEl, images, ctx, mountKey));
            return;
        }
        const scrollElStyle = window.getComputedStyle(scrollEl);
        const availableWidth = scrollEl.clientWidth - parseFloat(scrollElStyle.paddingLeft || '0') - parseFloat(scrollElStyle.paddingRight || '0');
        const rows = buildPhotoGridRows(sortImagesByAddedDateDesc(images), availableWidth, PHOTO_ROW_HEIGHT_PX); // core/file-manager/image.js — chữ ký MỚI (Giai đoạn 1+2)

        workflowVirtualList.mount(mountKey, { // event/workflow/virtual-list.js
            scrollEl, rows, ctx,
            templateFn: itemTemplateImageGridRow, // components/items.js
            windowId: 'file-manager-image-masonry', // GIỮ NGUYÊN id cũ — listener click delegated (event/listener/file-manager-photo.js) lọc theo id này
            windowClassName: 'photo-grid',
            computeRowHeights: () => { // KHÔNG còn cần đo sizerEl — chiều cao mỗi loại hàng giờ là HẰNG SỐ (Giai đoạn 2)
                return rows.map((row) => row.type === 'header' ? PHOTO_GRID_HEADER_HEIGHT_PX + PHOTO_GRID_GAP_PX : PHOTO_ROW_HEIGHT_PX + PHOTO_GRID_GAP_PX);
            },
        });
    },

    // ===================== MỚI (Giai đoạn 3b, rewrite Photo/Album, mục 3a) — Album List sub-panel
    // (THAY HẲN story slider + thanh quản lý album inline cũ — promptCreateAlbum/renameAlbumById/
    // deleteAlbumById ĐÃ XOÁ, xem lịch sử git nếu cần đối chiếu). Push TỪ TRONG panel Photo — ĐÚNG
    // khuôn Folder List -> Folder Detail (event/workflow/file-manager-song.js::openFolderDetail()),
    // KHÔNG cần xử lý gì đặc biệt cho "back" — popSettingsPanel() tự quay đúng panel Photo bên dưới.
    // ==========================================================================================

    /** Ứng với 'fileManagerPhoto.albumList.open.click'. Cùng trình tự đã chốt với panel Photo
     * chính: trượt xong HẲN -> shield -> đọc DB -> vẽ -> tắt shield. */
    async openAlbumListPanel() {
        albumListPanelEl = pushSettingsPanel({
            title: t('fileManager.photo.albumList.title'),
            bodyHtml: renderFileManagerAlbumListPanelBody(), // components/file-manager.js
        });
        const createBtn = albumListPanelEl.querySelector('#btn-file-manager-album-list-create');
        if (createBtn) createBtn.addEventListener('click', () => {
            eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.albumList.create.click', payload: {} });
        });

        await new Promise((resolve) => taskManager.once(resolve, SLIDER_PANEL_SCROLL_ESTIMATED_MS, 'fileManagerAlbumListOpenPanel')); // core/slider-panel-scroll.js — đợi trượt xong HẲN, cùng lý do openPanel()

        await withLoadingShield(t('fileManager.photo.loadingTitle'), async () => {
            await this.refreshAlbumListPanel(0);
        });
    },

    /** Đọc lại album, phân trang mode 'list' (core/pagination.js, ~10 album/trang — ĐÚNG chữ Giang
     * dùng "pagination dạng list page"), vẽ lại từng hàng qua itemTemplateAlbumListRow()
     * (components/items.js). KHÔNG windowing (workflowVirtualList) — số album thực tế luôn nhỏ,
     * render thẳng 1 trang là đủ mượt, cùng tinh thần refreshSongTab() (Folder List) không windowing.
     * @param {number} pageIndex
     */
    async refreshAlbumListPanel(pageIndex) {
        if (!albumListPanelEl) return; // guard: panel đã đóng
        const albums = await listAlbums(); // core/file-manager/album.js
        const pageResult = computePage(albums, pageIndex, 10); // core/pagination.js

        const listEl = albumListPanelEl.querySelector('#file-manager-album-list');
        if (listEl) listEl.innerHTML = pageResult.pageItems.map((album) => itemTemplateAlbumListRow(album)).join(''); // components/items.js
        const emptyEl = albumListPanelEl.querySelector('#file-manager-album-list-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', albums.length > 0);
        const paginationEl = albumListPanelEl.querySelector('#file-manager-album-list-pagination');
        if (paginationEl) paginationEl.innerHTML = buildPaginationListHtml(pageResult.pageIndex, pageResult.totalPages); // core/pagination.js, KHÔNG sửa
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

    /** Ứng với 'fileManagerPhoto.albumList.rowClick' — bấm tên/số lượng (KHÔNG phải icon) -> lọc
     * lưới ảnh chính theo `activeAlbumId` (Router đã tính toggle) + pop về panel Photo. MỚI dùng
     * `popSettingsPanel()` TRỰC TIẾP từ 1 feature workflow (khác `workflowSettingsStackNav.back()`
     * — nơi DUY NHẤT làm việc này trước giờ, cho nút Back dùng chung) — biện minh: "chọn xong tự
     * quay lại" là hành vi CHỦ Ý của tính năng này (không phải Back thường), CÙNG 2 dòng
     * `popSettingsPanel()` + `taskManager.once(...).remove()` Y HỆT `workflowSettingsStackNav.back()`
     * đang làm — không phát minh cơ chế mới, chỉ tái dùng đúng 2 hàm core đã có.
     * @param {string|null} activeAlbumId
     */
    async selectAlbumAndReturnToPhotoGrid(activeAlbumId) {
        const removedPanelEl = popSettingsPanel(); // core/settings-panel-stack.js
        if (removedPanelEl) taskManager.once(() => { removedPanelEl.remove(); }, SLIDER_PANEL_SCROLL_ESTIMATED_MS, 'albumListSelectPop');
        albumListPanelEl = null;
        await this.refresh(activeAlbumId);
    },

    /** Ứng với 'fileManagerPhoto.albumList.action.click' action='view'. Carousel xem+xoá khỏi album
     * (core/file-manager/photo-ui.js::openImageCarouselViewModal() — MỚI Giai đoạn 3b, hàm RIÊNG
     * với carousel chọn nền, xem docstring ở đó).
     * @param {string} albumId
     */
    async openAlbumCarouselView(albumId) {
        const albums = await listAlbums();
        const album = albums.find((a) => a.id === albumId);
        if (!album) return;
        const allImages = await listImages(); // core/file-manager/image.js
        const albumImages = allImages.filter((img) => album.imageKeys.includes(img.key));

        openImageCarouselViewModal( // core/file-manager/photo-ui.js
            albumImages,
            (imageKey) => { removeImageFromAlbum(imageKey, albumId); }, // fire-and-forget, core/file-manager/album.js — KHÔNG await ở core, đúng docstring hàm đó
            () => { this.refreshAlbumListPanel(0); } // đóng modal (dù có xoá hay không) -> số lượng ảnh trong album có thể đã đổi, vẽ lại danh sách. Trang 0 đơn giản hoá — album có thể đã đổi vị trí sau xoá, không cố focus lại
        );
    },

    // ===================== MỚI (Giai đoạn 3b, rewrite Photo/Album, mục 3a/4) — Picker "thêm ảnh
    // vào album" (Generic Drawer, multi-select). Click grid ĐI ĐÚNG luồng eventBus (listener -> đây
    // -> workflow), KHÔNG raw callback như modal picker cover bài hát cũ (core/file-manager/
    // photo-ui.js::openPhotoUiImagePickerModal() — tiền lệ CŨ trước Rule 5a, không hồi tố, nhưng
    // KHÔNG lặp lại cho code MỚI — đúng yêu cầu Giang "đảm bảo event bus"). ============================

    /** Ứng với 'fileManagerPhoto.albumList.action.click' action='addImages'. Generic Drawer height
     * TĂNG lên '90vh' (Giang yêu cầu — mặc định '70vh' của Generic Drawer không đủ chỗ cho lưới ảnh
     * cuộn thoải mái, khác hẳn menu action chỉ vài dòng chữ). Trình tự ĐÚNG đã chốt trước đó: drawer
     * trượt lên xong HẲN (nghe `transitionend` THẬT — core/generic-drawer.js, KHÔNG đoán mốc thời
     * gian, khác panel chính dùng `SLIDER_PANEL_SCROLL_ESTIMATED_MS` ước lượng vì Generic Drawer đã
     * có sẵn cơ chế transitionend chính xác hơn) -> icon loading ĐƠN GIẢN (không phải shield đầy màn
     * hình như panel chính) -> đọc DB + windowing -> tắt icon.
     * @param {string} albumId
     */
    async openAlbumImagePicker(albumId) {
        openGenericDrawer({ // core/generic-drawer.js
            height: '90vh', // MỚI (Giang yêu cầu, Giai đoạn 3b) — tăng từ mặc định 70vh, cần chỗ cho lưới ảnh
            zIndex: Z_INDEX.GENERIC_DRAWER, // core/config.js — mặc định, KHÔNG có modal xem ảnh nào mở đồng thời với picker này (khác action-menu cần z=131)
            headerHtml: this._buildImageMenuHeaderHtml(t('fileManager.photo.album.addImagesTitle')),
            bodyHtml: this._buildImagePickerBodyHtml(),
            bodyClass: 'flex flex-col',
            isWindowVirtual: true, // MỚI — kích hoạt gate router cho scroll event (mountKey 'genericDrawer', event/router/virtual-list.js) — lần đầu tiên có nơi dùng path này (trước đó có hạ tầng sẵn nhưng chưa ai gọi)
        });

        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => {
            eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imagePicker.close.click', payload: {} });
        });
        const confirmBtn = genericDrawerBody.querySelector('#btn-file-manager-image-picker-confirm');
        if (confirmBtn) confirmBtn.addEventListener('click', () => {
            eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imagePicker.confirm.click', payload: {} });
        });
        // Click tile — delegated NGAY TRÊN genericDrawerBody (KHÔNG đi qua settingsStackBody, Generic
        // Drawer là ANH EM của #app-stack trong #app-root — cấu trúc DOM tách biệt hẳn, xem docstring
        // core/generic-drawer.js — nên PHẢI tự wire riêng ở đây, không dựa được vào delegation chung
        // của event/listener/file-manager-photo.js). Callback gọi eventBus.send() — ĐÚNG yêu cầu
        // Giang, KHÔNG gọi thẳng workflow method như _wireImageMenuEvents() đang làm (đó là tiền lệ
        // CŨ, chấp nhận được vì Workflow-gọi-Workflow-của-chính-mình không bị Rule 5a chi phối, nhưng
        // ở ĐÂY đi qua eventBus cho nhất quán với toàn bộ luồng ảnh còn lại).
        genericDrawerBody.addEventListener('click', (e) => {
            const tile = e.target.closest('button[data-image-key]');
            if (!tile) return;
            eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imagePicker.tile.click', payload: { imageKey: tile.dataset.imageKey } });
        });

        await new Promise((resolve) => {
            genericDrawerPanel.addEventListener('transitionend', function onOpenTransitionEnd() {
                genericDrawerPanel.removeEventListener('transitionend', onOpenTransitionEnd);
                resolve();
            }, { once: true });
        });

        const loadingIconEl = genericDrawerBody.querySelector('#file-manager-image-picker-loading');
        if (loadingIconEl) loadingIconEl.classList.remove('hidden');
        const images = await listImages(); // core/file-manager/image.js
        if (loadingIconEl) loadingIconEl.classList.add('hidden');

        const scrollEl = genericDrawerBody.querySelector('#file-manager-image-picker-scroll');
        const emptyEl = genericDrawerBody.querySelector('#file-manager-image-picker-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', images.length > 0);
        this.setupPhotoGridWindow(scrollEl, images, { selectionMode: true, selectedImageKeys: new Set() }, 'genericDrawer');
        // Set rỗng ban đầu — Router giữ Set THẬT (imagePickerSelectedKeys), truyền lại đúng tham
        // chiếu đó qua toggleImagePickerSelectionInSet()/redraw() ngay khi tile đầu tiên được bấm,
        // cùng cơ chế "Set truyền vào ctx lúc mount() là chính Set Router giữ" đã dùng cho lưới chính.
    },

    /** HTML khung picker: scroll container (grid windowing sẽ chèn vào TRONG đây) + icon loading đơn
     * giản (KHÔNG phải shield đầy màn hình — Giang chốt trình tự "drawer lên xong -> icon đơn giản ->
     * load -> tắt") + nút xác nhận cố định đáy. Đặt ở Workflow (không phải core) — cùng khuôn
     * `_buildImageMenuHeaderHtml()` bên dưới, glue 1-nơi-dùng, không đủ "substantial" để tách core.
     */
    _buildImagePickerBodyHtml() {
        return `
            <div class="flex-1 min-h-0 overflow-y-auto relative" id="file-manager-image-picker-scroll">
                <p id="file-manager-image-picker-empty" class="hidden text-sm text-slate-400 text-center py-10 px-6">${t('fileManager.photo.image.empty')}</p>
            </div>
            <div id="file-manager-image-picker-loading" class="hidden absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 animate-spin text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
            </div>
            <div class="p-4 border-t border-white/10 shrink-0">
                <button type="button" id="btn-file-manager-image-picker-confirm" class="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors">${t('fileManager.photo.album.btnAddSelected')}</button>
            </div>
        `;
    },

    /** Ứng với 'fileManagerPhoto.imagePicker.tile.click'. Cùng khuôn `toggleQuickDeleteMarkInSet()`
     * — mutate Set qua tham chiếu + patch DOM surgical, KHÔNG đọc/ghi DB.
     * @param {string} imageKey
     * @param {Set<string>} selectedKeys
     */
    toggleImagePickerSelectionInSet(imageKey, selectedKeys) {
        if (selectedKeys.has(imageKey)) selectedKeys.delete(imageKey);
        else selectedKeys.add(imageKey);
        workflowVirtualList.redraw('genericDrawer'); // event/workflow/virtual-list.js
    },

    /** Ứng với 'fileManagerPhoto.imagePicker.confirm.click'. addImagesToAlbum() tự bỏ qua ảnh đã có
     * sẵn trong album (không thêm trùng) — xem core/file-manager/album.js.
     * @param {string} albumId
     * @param {Set<string>} selectedKeys
     * @param {number} albumListPageIndex - để vẽ lại ĐÚNG trang đang xem sau khi đóng picker.
     */
    async confirmAlbumImagePicker(albumId, selectedKeys, albumListPageIndex) {
        const keys = Array.from(selectedKeys);
        workflowVirtualList.unmount('genericDrawer'); // event/workflow/virtual-list.js — dọn object URL NGAY, không đợi lần mount() kế tiếp mới tự dọn
        this._closeGenericDrawerFully();
        if (keys.length === 0) return; // guard — chưa chọn gì thì không gọi DB, không thông báo gì

        let addedCount = 0;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            const result = await addImagesToAlbum(keys, albumId); // core/file-manager/album.js
            addedCount = result.addedCount;
        });
        await this.refreshAlbumListPanel(albumListPageIndex);
        await alertModal(tFormat('fileManager.photo.album.addImagesSuccess', { count: addedCount }));
    },

    /** Ứng với 'fileManagerPhoto.imagePicker.close.click' — đóng picker, KHÔNG addImagesToAlbum gì
     * cả (Huỷ). */
    closeAlbumImagePicker() {
        workflowVirtualList.unmount('genericDrawer'); // event/workflow/virtual-list.js — dọn object URL NGAY
        this._closeGenericDrawerFully();
    },

    /** MỚI (Giai đoạn 1, rewrite Photo/Album, mục 3c/3d) — resize 1 ảnh lúc upload: `height` = ĐÚNG
     * `PHOTO_ROW_HEIGHT_PX` (khớp CSS hàng ảnh, nối ở Giai đoạn 2), `width` theo tỉ lệ ẢNH GỐC (ngang
     * hay dọc tự quy đổi qua `naturalWidth/naturalHeight`, KHÔNG ép cứng). Trả thêm `width`/`height`
     * GỐC (trước resize) để `buildPhotoGridRows()` (core) tính tỉ lệ hiển thị MÀ KHÔNG cần decode ảnh
     * lại lúc dựng lưới.
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
                const targetHeight = PHOTO_ROW_HEIGHT_PX;
                const targetWidth = Math.max(1, Math.round(targetHeight * (width / height))); // guard: tối thiểu 1px, tránh canvas rộng 0 nếu ảnh hỏng tỉ lệ
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
     * @param {FileList} files
     * @param {string|null} activeAlbumId
     */
    async uploadImages(files, activeAlbumId) {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        let failedCount = 0;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            for (const file of fileArray) {
                try {
                    const { thumbBlob, width, height } = await this._resizeImageForThumbnail(file);
                    await saveImage(file, file.name, thumbBlob, width, height); // core/file-manager/image.js — chữ ký MỚI
                } catch (err) {
                    console.error(`[uploadImages] resize/lưu thất bại cho file "${file.name}":`, err);
                    failedCount++;
                }
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
     * SỬA (14/07/2026, mục cuối) — menu action giờ là Generic Drawer (icon hoá) thay dropdown cũ,
     * mở qua `callbacks.onOpenMenu` (modal xem ảnh — Core — KHÔNG được tự đụng Generic Drawer, DOM
     * tĩnh, Rule 5a). `modalHandle.close()` gọi TỪ ĐÂY sau khi 1 action (trừ "Sửa caption") được
     * chọn — modal Core trả `{ close }` đúng lúc `openImagePreviewModal()` return.
     * @param {string} imageKey
     * @param {string|null} activeAlbumId
     */
    async openImagePreview(imageKey, activeAlbumId) {
        const record = await getImageRecord(imageKey); // data layer (service/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác
        const image = { key: imageKey, ...record };

        const modalHandle = openImagePreviewModal(image, { // core/file-manager/photo-ui.js
            onOpenMenu: () => this._openImageActionMenu(image, activeAlbumId, modalHandle),
        });
    },

    /** MỚI (14/07/2026, mục cuối) — mở menu action (Generic Drawer, icon hoá) cho 1 ảnh đang xem.
     * `zIndex: 131` — TRÊN overlay modal xem ảnh (z-130, core/file-manager/photo-ui.js), dưới
     * modalChoice() (z-130... doc cũ ghi 130, thực tế 130 = cùng tầng preview — 131 đủ nổi trên cả
     * 2, xem docstring core/generic-drawer.js). `height: 'auto' + maxHeight` — tự co theo số icon
     * (4-6 tuỳ có album hay không), không chừa khoảng trống thừa.
     * @param {{key: string, blob: Blob, filename: string, caption?: string}} image
     * @param {string|null} activeAlbumId
     * @param {{close: () => void}} modalHandle
     */
    _openImageActionMenu(image, activeAlbumId, modalHandle) {
        openGenericDrawer({ // core/generic-drawer.js
            zIndex: 131,
            height: 'auto',
            maxHeight: '60vh',
            headerHtml: this._buildImageMenuHeaderHtml(t('fileManager.photo.image.menuTitle')),
            bodyHtml: buildPhotoActionMenuHtml({ hasAlbum: !!activeAlbumId }), // core/file-manager/photo-ui.js
            bodyClass: 'overflow-y-auto px-4 pb-6 pt-2',
        });
        this._wireImageMenuEvents(image, activeAlbumId, modalHandle);
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

    /** Wire click cho menu vừa mở — mọi action (trừ "editCaption") đóng CẢ drawer LẪN modal xem ảnh
     * trước khi chạy; "editCaption" KHÔNG đóng drawer — chuyển MƯỢT sang form sửa caption NGAY
     * TRONG CÙNG drawer đó (`updateGenericDrawer()`, cùng cơ chế List<->Read của `document-
     * reader.js`, Giang yêu cầu 14/07/2026 — bỏ hẳn modal riêng trước đó). */
    _wireImageMenuEvents(image, activeAlbumId, modalHandle) {
        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this._closeGenericDrawerFully());

        genericDrawerBody.querySelectorAll('button[data-photo-menu-action]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.photoMenuAction;

                if (action === 'editCaption') {
                    this._openEditCaptionForm(image);
                    return;
                }

                this._closeGenericDrawerFully();
                modalHandle.close();
                if (action === 'setPlaylistBg') this.setAsPlaylistBackground(image.key);
                else if (action === 'setVisualBg') this.setAsVisualBackground(image.key);
                else if (action === 'editImage') this.navigateToImageEdit(image.key);
                else if (action === 'removeFromAlbum') removeImageFromAlbum(image.key, activeAlbumId).then(() => this.refresh(activeAlbumId)); // core có sẵn (core/file-manager/album.js)
                else if (action === 'delete') deleteImage(image.key).then(() => this.refresh(activeAlbumId)); // core/file-manager/image.js — cascade dọn album
            });
        });
    },

    /** MỚI (14/07/2026, mục cuối, Giang yêu cầu — caption dùng Generic Drawer, KHÔNG modal) —
     * chuyển MƯỢT nội dung drawer ĐANG MỞ (menu action) sang form sửa caption, KHÔNG đóng/mở lại từ
     * đầu (`updateGenericDrawer()`, tham khảo `document-reader.js::_switchToRead()` cùng cơ chế). */
    _openEditCaptionForm(image) {
        updateGenericDrawer({ // core/generic-drawer.js
            zIndex: 131,
            height: 'auto',
            maxHeight: '50vh',
            headerHtml: this._buildImageMenuHeaderHtml(t('fileManager.photo.image.btnEditCaption')),
            bodyHtml: buildEditCaptionFormHtml(image.caption || ''), // core/file-manager/photo-ui.js
            bodyClass: 'px-4 pb-5 pt-2',
        });

        const closeBtn = genericDrawerHeader.querySelector('#btn-generic-drawer-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this._closeGenericDrawerFully());
        const textarea = genericDrawerBody.querySelector('#caption-form-textarea');
        const cancelBtn = genericDrawerBody.querySelector('#btn-caption-form-cancel');
        const saveBtn = genericDrawerBody.querySelector('#btn-caption-form-save');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this._closeGenericDrawerFully());
        if (saveBtn) saveBtn.addEventListener('click', async () => {
            const caption = textarea ? textarea.value.trim() : '';
            this._closeGenericDrawerFully();
            await setImageCaption(image.key, caption); // core/file-manager/image.js
            if (typeof workflowSlideshow !== 'undefined') workflowSlideshow.refreshCaptionIfCurrentImage(image.key, caption);
            if (typeof workflowVisualizerControlCenter !== 'undefined') workflowVisualizerControlCenter.refreshCaptionIfVisualBgImage(image.key, caption);
        });
        if (textarea) textarea.focus();
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

    /** Ứng với nút "Đặt làm nền Visual" trong modal xem ảnh — TÁI DÙNG NGUYÊN applyVisualBgImage().
     * @param {string} imageKey
     */
    async setAsVisualBackground(imageKey) {
        const record = await getImageRecord(imageKey); // data layer (service/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác

        await withLoadingShield(t('common.loading.savingImageBg'), async () => {
            await applyVisualBgImage(record.blob); // core có sẵn (core/state-and-video-bg.js)
        });
        await alertModal(t('fileManager.photo.image.setVisualBgSuccess'));
    },

    /** Ứng với nút "Dùng làm nền Slideshow" ở thanh quản lý album (MỚI, Batch 8).
     * @param {string} albumId
     */
    async setAsSlideshowBackground(albumId) {
        await workflowSlideshow.setActiveAlbum(albumId);
        await alertModal(t('fileManager.photo.album.setSlideshowBgSuccess'));
    },
};
