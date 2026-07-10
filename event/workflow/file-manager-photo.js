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
 * `renderAlbumStory`/`renderImageMasonry`/`updateImageSelectionCount` (core/file-manager/
 * photo-ui.js) ĐÃ đổi sang nhận phần tử qua tham số — mọi method dưới đây tự `querySelector` bên
 * trong `fileManagerPhotoPanelEl` rồi truyền vào. Modal (openCreateAlbumModal/openRenameAlbumModal/
 * openImagePreviewModal...) KHÔNG cần đổi gì — tự dựng overlay ĐỘC LẬP (document.body), không phụ
 * thuộc panel.
 */
let fileManagerPhotoPanelEl = null; // panel Photo đang mở — null nếu đang đóng (Batch D6)

const workflowFileManagerPhoto = {

    /** Ứng với 'fileManagerPhoto.openPanel.click'. `fullBleed: true` — masonry/story slider vốn
     * thiết kế tràn viền (edge-to-edge), KHÔNG dùng khung "max-w-2xl mx-auto" mặc định của mọi
     * panel khác (xem core/settings-panel-stack.js::pushSettingsPanel(), Batch D6). */
    async openPanel() {
        fileManagerPhotoPanelEl = pushSettingsPanel({ title: t('fileManager.photo.title'), bodyHtml: renderFileManagerPhotoPanelBody(), fullBleed: true });
        await this.refresh(null, false, new Set());
    },

    /** Đọc lại toàn bộ album + ảnh, vẽ lại story slider + masonry + thanh quản lý album + thanh
     * chọn nhiều (lọc theo activeAlbumId nếu có). Dùng lại ở MỌI nơi cần vẽ lại (mở panel, chọn
     * album, đổi tên/xoá album, tạo album, upload xong, xoá ảnh xong, bật/tắt/xác nhận chọn nhiều).
     * @param {string|null} activeAlbumId
     * @param {boolean} [imageSelectionMode]
     * @param {Set<string>} [selectedImageKeys]
     */
    async refresh(activeAlbumId, imageSelectionMode = false, selectedImageKeys = new Set()) {
        if (!fileManagerPhotoPanelEl) return; // guard: panel đã đóng
        const albums = await listAlbums(); // core/file-manager/album.js
        const images = await listImages(); // core/file-manager/image.js
        const imageRecordsByKey = new Map(images.map((img) => [img.key, img]));

        renderAlbumStory(albums, activeAlbumId, imageRecordsByKey, fileManagerPhotoPanelEl.querySelector('#file-manager-album-story')); // core/file-manager/photo-ui.js

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

        const displayedImages = imageSelectionMode
            ? images
            : (activeAlbum ? images.filter((img) => activeAlbum.imageKeys.includes(img.key)) : images);
        renderImageMasonry( // core/file-manager/photo-ui.js
            fileManagerPhotoPanelEl.querySelector('#file-manager-image-masonry'),
            displayedImages, imageSelectionMode, selectedImageKeys,
            fileManagerPhotoPanelEl.querySelector('#file-manager-image-empty')
        );
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
        toggleImageSelectionBadge(imageKey, selectedImageKeys.has(imageKey)); // core, patch DOM surgical (dùng _masonryContainerEl nội bộ)
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
     * @param {string} imageKey
     * @param {string|null} activeAlbumId
     */
    async openImagePreview(imageKey, activeAlbumId) {
        const record = await getImageRecord(imageKey); // data layer (service/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác

        openImagePreviewModal({ key: imageKey, ...record }, { // core/file-manager/photo-ui.js
            onDelete: async () => {
                await deleteImage(imageKey); // core/file-manager/image.js — cascade dọn album (Batch 3)
                await this.refresh(activeAlbumId);
            },
            onSetPlaylistBg: async () => { await this.setAsPlaylistBackground(imageKey); },
            onSetVisualBg: async () => { await this.setAsVisualBackground(imageKey); },
            onRemoveFromAlbum: activeAlbumId ? async () => {
                await removeImageFromAlbum(imageKey, activeAlbumId); // core có sẵn (core/file-manager/album.js, Batch 3)
                await this.refresh(activeAlbumId);
            } : undefined,
            onSaveCaption: async (caption) => {
                await setImageCaption(imageKey, caption); // core/file-manager/image.js
                if (typeof workflowSlideshow !== 'undefined') workflowSlideshow.refreshCaptionIfCurrentImage(imageKey, caption);
                if (typeof workflowVisualizerControlCenter !== 'undefined') workflowVisualizerControlCenter.refreshCaptionIfVisualBgImage(imageKey, caption);
            },
        });
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
