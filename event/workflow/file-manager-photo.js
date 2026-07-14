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
 *   3. Chế độ "xoá nhanh" ảnh — bấm ảnh nào xoá luôn ảnh đó, không hỏi lại (`promptQuickDeleteMode`/
 *      `quickDeleteImage`).
 *   4. `openPanel()` bọc `withLoadingShield()` quanh lần `refresh()` ĐẦU TIÊN — Giang chỉ ra: DOM
 *      lưới ảnh (nặng — nhiều object URL) KHÔNG được tải song song lúc panel còn đang trượt vào,
 *      phải tải SAU KHI đã vào hẳn, che bằng shield, chỉ tắt khi xong.
 */
let fileManagerPhotoPanelEl = null; // panel Photo đang mở — null nếu đang đóng (Batch D6)

// Chiều cao (px) CỐ ĐỊNH của 1 hàng header ngày — PHẢI khớp đúng class `h-10` ở
// components/items.js::itemTemplateImageGridRow() (đổi 1 trong 2 chỗ PHẢI đổi luôn chỗ kia).
const PHOTO_GRID_HEADER_HEIGHT_PX = 40;
// Khớp .photo-grid { gap: 2px } ở assets/css/style.css — đổi CSS gap thì phải đổi luôn hằng số này.
const PHOTO_GRID_GAP_PX = 2;
// Khớp w-16 (64px) + gap-4 (16px) ở album story (components/file-manager.js) — đổi CSS thì phải đổi luôn.
const ALBUM_STORY_TILE_WIDTH_PX = 64;
const ALBUM_STORY_GAP_PX = 16;

const workflowFileManagerPhoto = {

    /** Ứng với 'fileManagerPhoto.openPanel.click'. `fullBleed: true` — masonry/story slider vốn
     * thiết kế tràn viền (edge-to-edge), KHÔNG dùng khung "max-w-2xl mx-auto" mặc định của mọi
     * panel khác (xem core/settings-panel-stack.js::pushSettingsPanel(), Batch D6).
     * SỬA (14/07/2026) — `withLoadingShield()` bọc quanh lần `refresh()` ĐẦU TIÊN: panel push +
     * trượt vào là animation NHẸ (chỉ CSS), tách biệt hẳn khỏi việc tải DOM lưới ảnh NẶNG (nhiều
     * object URL) — che bằng shield, tắt NGAY khi DOM lần đầu xong, không phải đợi hết animation. */
    async openPanel() {
        fileManagerPhotoPanelEl = pushSettingsPanel({
            title: t('fileManager.photo.title'),
            bodyHtml: renderFileManagerPhotoPanelBody(),
            fullBleed: true,
            headerActionHtml: this._buildHeaderActionHtml(),
        });
        this._wireHeaderActionEvents();
        await withLoadingShield(t('fileManager.photo.loadingTitle'), async () => { // core/loading-shield-util.js
            await this.refresh(null, false, new Set(), 0, false);
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

    /** Đọc lại toàn bộ album + ảnh, vẽ lại story slider + masonry + thanh quản lý album + thanh
     * chọn nhiều (lọc theo activeAlbumId nếu có). Dùng lại ở MỌI nơi cần vẽ lại (mở panel, chọn
     * album, đổi tên/xoá album, tạo album, upload xong, xoá ảnh xong, bật/tắt/xác nhận chọn nhiều).
     * KHÔNG dùng cho pagination story album nữa (bấm ‹/› giờ đi `navigateAlbumStoryPage()`, CHỈ
     * toggle CSS, không gọi lại hàm này — xem đó).
     * @param {string|null} activeAlbumId
     * @param {boolean} [imageSelectionMode]
     * @param {Set<string>} [selectedImageKeys]
     * @param {number} [albumStoryPageIndex]
     * @param {boolean} [imageQuickDeleteMode]
     */
    async refresh(activeAlbumId, imageSelectionMode = false, selectedImageKeys = new Set(), albumStoryPageIndex = 0, imageQuickDeleteMode = false) {
        if (!fileManagerPhotoPanelEl) return; // guard: panel đã đóng
        const albums = await listAlbums(); // core/file-manager/album.js
        const images = await listImages(); // core/file-manager/image.js
        const imageRecordsByKey = new Map(images.map((img) => [img.key, img]));

        // ---- Album story: render TOÀN BỘ 1 lần, gắn trang, hiện đúng trang hiện tại bằng CSS ----
        const storyListEl = fileManagerPhotoPanelEl.querySelector('#file-manager-album-story');
        if (storyListEl) {
            const itemsPerPage = Math.max(1, Math.floor((storyListEl.clientWidth + ALBUM_STORY_GAP_PX) / (ALBUM_STORY_TILE_WIDTH_PX + ALBUM_STORY_GAP_PX)));
            const totalPages = renderAlbumStory(['__all__', ...albums], itemsPerPage, activeAlbumId, imageRecordsByKey, storyListEl); // core/file-manager/photo-ui.js
            const clampedPage = Math.max(0, Math.min(albumStoryPageIndex, totalPages - 1));
            setAlbumStoryPageVisibility(storyListEl, clampedPage); // core/file-manager/photo-ui.js
            storyListEl.dataset.totalPages = String(totalPages); // navigateAlbumStoryPage() đọc lại — KHÔNG cần đo/render lại mỗi lần bấm ‹/›
            this._renderAlbumStoryPagination(clampedPage, totalPages);
        }

        const activeAlbum = activeAlbumId ? albums.find((a) => a.id === activeAlbumId) : null;

        const manageBar = fileManagerPhotoPanelEl.querySelector('#file-manager-album-manage-bar');
        if (manageBar) {
            const showManageBar = !!activeAlbum && !imageSelectionMode;
            manageBar.classList.toggle('hidden', !showManageBar);
            manageBar.classList.toggle('flex', showManageBar);
            const manageNameEl = fileManagerPhotoPanelEl.querySelector('#file-manager-album-manage-name');
            if (manageNameEl) manageNameEl.textContent = activeAlbum ? activeAlbum.name : '';
        }
        const selectionBar = fileManagerPhotoPanelEl.querySelector('#file-manager-image-selection-bar');
        if (selectionBar) {
            selectionBar.classList.toggle('hidden', !imageSelectionMode);
            updateImageSelectionCount(selectedImageKeys.size, fileManagerPhotoPanelEl.querySelector('#file-manager-image-selection-count'));
        }

        // ---- Nút "xoá nhanh" trong header: chỉ hiện khi có ảnh, đổi màu khi đang bật ----
        const deleteModeBtn = fileManagerPhotoPanelEl.querySelector('#btn-file-manager-image-delete-mode');
        if (deleteModeBtn) {
            deleteModeBtn.classList.toggle('hidden', images.length === 0);
            deleteModeBtn.classList.toggle('bg-rose-500', imageQuickDeleteMode);
            deleteModeBtn.classList.toggle('bg-white/10', !imageQuickDeleteMode);
        }

        const displayedImages = imageSelectionMode
            ? images
            : (activeAlbum ? images.filter((img) => activeAlbum.imageKeys.includes(img.key)) : images);
        const emptyEl = fileManagerPhotoPanelEl.querySelector('#file-manager-image-empty');
        if (emptyEl) emptyEl.classList.toggle('hidden', displayedImages.length > 0);
        this.setupPhotoGridWindow(
            fileManagerPhotoPanelEl.querySelector('#file-manager-image-scroll'),
            displayedImages,
            { selectionMode: imageSelectionMode, selectedImageKeys }
        );
    },

    /** MỚI (14/07/2026) — chuyển trang story album CHỈ bằng CSS (Giang đơn giản hoá) — KHÔNG gọi
     * lại `refresh()` (không đọc DB, không dựng lại DOM ảnh/album). `totalPages` đọc từ `dataset`
     * gắn sẵn lúc `refresh()` gần nhất (KHÔNG tính lại — số album không đổi giữa 2 lần bấm ‹/›) —
     * O(1) THẬT SỰ: không I/O, chỉ patch DOM surgical (toggle class + đổ lại ĐÚNG 1 khối HTML nhỏ
     * — 2 nút + số trang, KHÔNG đụng gì tới các tile ảnh/album đã render sẵn).
     * @param {number} requestedIndex
     * @returns {number} chỉ số trang THẬT SỰ áp dụng (đã kẹp) — Router tự đồng bộ lại state của nó.
     */
    navigateAlbumStoryPage(requestedIndex) {
        if (!fileManagerPhotoPanelEl) return 0;
        const storyListEl = fileManagerPhotoPanelEl.querySelector('#file-manager-album-story');
        if (!storyListEl) return 0;
        const totalPages = Number(storyListEl.dataset.totalPages || 1);
        const clamped = Math.max(0, Math.min(requestedIndex, totalPages - 1));
        setAlbumStoryPageVisibility(storyListEl, clamped); // core/file-manager/photo-ui.js
        this._renderAlbumStoryPagination(clamped, totalPages);
        return clamped;
    },

    /** SỬA (14/07/2026, Giang chỉnh lại — dùng THẲNG `buildPaginationArrowsHtml()` core/pagination.js,
     * KHÔNG tự viết 2 nút ‹/› riêng nữa) — đổ NGUYÊN chuỗi hàm đó vào
     * `#file-manager-album-story-pagination-wrap` (`display:contents`, assets/css/style.css — "tháo"
     * div bọc ngoài, ẩn số trang bằng CSS, xem file đó). Click 2 nút wire delegated qua
     * `event/listener/file-manager-photo.js` (chọn theo `data-pagination-action`, thuộc tính core
     * TỰ gắn sẵn) — KHÔNG cần wire lại ở đây mỗi lần gọi hàm này. */
    _renderAlbumStoryPagination(pageIndex, totalPages) {
        const wrapEl = fileManagerPhotoPanelEl.querySelector('#file-manager-album-story-pagination-wrap');
        if (wrapEl) wrapEl.innerHTML = buildPaginationArrowsHtml(pageIndex, totalPages); // core/pagination.js, KHÔNG sửa
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

    /** MỚI (14/07/2026, mục 2.2) — xoá NGAY 1 ảnh, không hỏi lại (đã hỏi 1 lần lúc BẬT chế độ này).
     * Giữ nguyên `albumStoryPageIndex`/chế độ xoá nhanh sau khi refresh (đang xoá dở, KHÔNG nên nhảy
     * về trang 1 story album hay tự thoát chế độ). */
    async quickDeleteImage(imageKey, activeAlbumId, albumStoryPageIndex) {
        await deleteImage(imageKey); // core/file-manager/image.js — cascade dọn album
        await this.refresh(activeAlbumId, false, new Set(), albumStoryPageIndex, true);
    },

    /** MỚI (Patch mục 2, 14/07/2026) — chuẩn bị "hàng lưới" (buildPhotoGridRows(), core) rồi giao
     * cho `workflowVirtualList.mount()` (event/workflow/virtual-list.js) đo/dựng/vẽ — file NÀY
     * KHÔNG tự đụng DOM cuộn/scroll listener nữa (SỬA 14/07/2026, xem docstring đầu file). Dùng
     * CHUNG cho Photo & Album (gọi từ refresh()) LẪN picker cover bài hát (event/workflow/
     * playlist.js — Workflow gọi Workflow miền khác, TỰ DO theo event-bus-flow.md mục 4B).
     * @param {HTMLElement} scrollEl - container CUỘN, ĐÃ có trong DOM thật.
     * @param {Array<{key:string, blob:Blob, filename:string, addedAt:number}>} images
     * @param {{selectionMode?: boolean, selectedImageKeys?: Set<string>}} [ctx]
     * @param {string} [mountKey] - phân biệt Photo & Album (mặc định 'photoGrid') với picker cover
     *        bài hát ('photoGridPicker', truyền tường minh từ playlist.js) — 2 container ĐỘC LẬP.
     */
    setupPhotoGridWindow(scrollEl, images, ctx, mountKey = 'photoGrid') {
        if (!scrollEl) return;
        const columns = window.matchMedia('(min-width: 640px)').matches ? 4 : 3; // khớp @media (min-width: 640px) trong .photo-grid (assets/css/style.css, CSS thuần — KHÔNG còn Tailwind sm:)
        const rows = buildPhotoGridRows(sortImagesByAddedDateDesc(images), columns); // core/file-manager/image.js

        workflowVirtualList.mount(mountKey, { // event/workflow/virtual-list.js
            scrollEl, rows, ctx,
            templateFn: itemTemplateImageGridRow, // components/items.js
            windowId: 'file-manager-image-masonry', // GIỮ NGUYÊN id cũ — listener click delegated (event/listener/file-manager-photo.js) lọc theo id này
            windowClassName: 'photo-grid',
            computeRowHeights: (sizerEl) => {
                const tileWidth = (sizerEl.clientWidth - (columns - 1) * PHOTO_GRID_GAP_PX) / columns;
                const imageRowHeight = tileWidth + PHOTO_GRID_GAP_PX;
                return rows.map((row) => row.type === 'header' ? PHOTO_GRID_HEADER_HEIGHT_PX + PHOTO_GRID_GAP_PX : imageRowHeight);
            },
        });
    },

    /** Ứng với storyClick action='create'. */
    async promptCreateAlbum(activeAlbumId) {
        openCreateAlbumModal(async (name) => { // core/file-manager/photo-ui.js
            const result = await createAlbum(name); // core/file-manager/album.js
            if (result.status === 'duplicateName') {
                await alertModal(tFormat('fileManager.folderPicker.duplicateName', { name: escapeHtml(name) }));
                return;
            }
            await this.refresh(activeAlbumId);
        });
    },

    // ===================== MỚI (batch tiếp theo, mục 2.2) — quản lý album đang lọc =============

    /** Ứng với 'fileManagerPhoto.album.manageClick' action='rename'. Đọc tên hiện tại THẲNG từ DOM
     * đã render sẵn (tránh round-trip đọc lại DB chỉ để lấy tên đang hiển thị).
     * @param {string} albumId
     */
    renameAlbumById(albumId) {
        if (!fileManagerPhotoPanelEl) return;
        const nameEl = fileManagerPhotoPanelEl.querySelector('#file-manager-album-manage-name');
        const currentName = nameEl ? nameEl.textContent : '';
        openRenameAlbumModal(currentName, async (newName) => { // core/file-manager/photo-ui.js
            const result = await renameAlbum(albumId, newName); // core có sẵn (core/file-manager/album.js)
            if (result.status === 'duplicateName') {
                await alertModal(tFormat('fileManager.folderPicker.duplicateName', { name: escapeHtml(newName) }));
                return;
            }
            await this.refresh(albumId); // albumId KHÔNG đổi sau khi rename -> vẫn đang lọc đúng album này
        });
    },

    /** Ứng với 'fileManagerPhoto.album.manageClick' action='delete'.
     * @param {string} albumId
     * @param {() => void} onDeleted - reset `activeAlbumId` về null Ở TẦNG ROUTER.
     */
    deleteAlbumById(albumId, onDeleted) {
        const nameEl = fileManagerPhotoPanelEl ? fileManagerPhotoPanelEl.querySelector('#file-manager-album-manage-name') : null;
        const albumName = nameEl ? nameEl.textContent : '';
        modalChoice(
            tFormat('fileManager.photo.album.deleteConfirm', { name: escapeHtml(albumName) }),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.photo.album.btnDelete'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    await deleteAlbum(albumId); // core có sẵn (core/file-manager/album.js) — KHÔNG đụng ảnh bên trong, chỉ mất liên kết
                    // MỚI (Batch 8, slideshow) — cascade "xoá album đang dùng làm nguồn slideshow".
                    if (appState.get('activeBackgroundAlbum') === albumId && typeof workflowSlideshow !== 'undefined') {
                        await workflowSlideshow.clearActiveAlbum();
                    }
                    onDeleted();
                    await this.refresh(null, false, new Set());
                } }
            ],
            { title: t('fileManager.photo.album.deleteTitle') }
        );
    },

    // ===================== MỚI (batch tiếp theo, mục 2.3) — chọn nhiều ảnh có sẵn để thêm vào
    // album đang lọc =============================================================================

    /** Ứng với 'fileManagerPhoto.image.click' khi imageSelectionMode=true (xem router). Mutate
     * TRỰC TIẾP `selectedImageKeys` (Set) qua tham chiếu — router giữ nguyên object đó.
     * @param {string} imageKey
     * @param {Set<string>} selectedImageKeys
     */
    toggleImageSelectionInSet(imageKey, selectedImageKeys) {
        if (selectedImageKeys.has(imageKey)) selectedImageKeys.delete(imageKey);
        else selectedImageKeys.add(imageKey);
        // ctx.selectedImageKeys truyền vào mount() lúc refresh() là CHÍNH selectedImageKeys này
        // (cùng tham chiếu, Router giữ nguyên object) — redraw() là ĐỦ, không cần mount() lại.
        workflowVirtualList.redraw('photoGrid'); // event/workflow/virtual-list.js
        if (fileManagerPhotoPanelEl) {
            updateImageSelectionCount(selectedImageKeys.size, fileManagerPhotoPanelEl.querySelector('#file-manager-image-selection-count')); // core, patch DOM surgical
        }
    },

    /** Ứng với 'fileManagerPhoto.imageSelection.confirm'. addImagesToAlbum() tự bỏ qua ảnh đã có
     * sẵn trong album (không thêm trùng) — xem core/file-manager/album.js.
     * @param {string} albumId
     * @param {Set<string>} selectedImageKeys
     * @param {string|null} activeAlbumId
     */
    async confirmAddSelectedImages(albumId, selectedImageKeys, activeAlbumId) {
        const keys = Array.from(selectedImageKeys);
        if (keys.length === 0) return; // guard — chưa chọn gì thì không làm gì

        let addedCount = 0;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            const result = await addImagesToAlbum(keys, albumId);
            addedCount = result.addedCount;
        });
        await this.refresh(activeAlbumId, false, new Set());
        await alertModal(tFormat('fileManager.photo.album.addImagesSuccess', { count: addedCount }));
    },

    /** Ứng với 'fileManagerPhoto.upload.change'.
     * @param {FileList} files
     * @param {string|null} activeAlbumId
     */
    async uploadImages(files, activeAlbumId) {
        const fileArray = Array.from(files);
        if (fileArray.length === 0) return;

        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            for (const file of fileArray) {
                await saveImage(file, file.name); // core/file-manager/image.js
            }
        });
        if (fileManagerPhotoPanelEl) {
            const uploadInput = fileManagerPhotoPanelEl.querySelector('#file-manager-image-upload-input');
            if (uploadInput) uploadInput.value = ''; // cho phép chọn lại đúng file cũ ở lần sau
        }
        await this.refresh(activeAlbumId);
        await alertModal(tFormat('fileManager.photo.image.uploadSuccess', { count: fileArray.length }));
    },

    /** Ứng với 'fileManagerPhoto.image.click' khi imageSelectionMode=false (xem router).
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
