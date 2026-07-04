/**
 * event/workflow/file-manager-photo.js — Batch 3 (03/07/2026), "THẰNG THỰC THI CUỐI" cho drawer
 * Photo & Album. Mọi method nhận `activeAlbumId` qua THAM SỐ (context sống ở Router, xem
 * event/router/file-manager-photo.js) — workflow không tự giữ state UI riêng.
 *
 * MỚI (batch tiếp theo 03/07/2026, mục 2.2/2.3 plan-v12-multimedia-update-2.md — nợ kỹ thuật đã
 * xác nhận từ Batch 3): renameAlbumById/deleteAlbumById (Đổi tên/Xoá album đang lọc, cùng khuôn
 * renameFolderById/deleteFolderById ở event/workflow/file-manager-song.js) +
 * toggleImageSelectionInSet/confirmAddSelectedImages (chọn nhiều ảnh có sẵn -> thêm vào album đang
 * lọc, core addImagesToAlbum() đã sẵn sàng nhận từ Batch 3).
 *
 * NẠP SAU: core/file-manager/image.js, core/file-manager/album.js, core/file-manager/photo-ui.js,
 * core/file-manager/nav.js.
 *
 * MỚI (Batch 8, 03/07/2026, slideshow nền Visual): `setAsSlideshowBackground()` (nút "Dùng làm nền
 * Slideshow" ở thanh quản lý album) + cascade dọn `activeBackgroundAlbum` trong `deleteAlbumById()`
 * khi album vừa xoá đang là nguồn nền active — cả 2 đều gọi `workflowSlideshow`
 * (event/workflow/slideshow.js) — NẠP SAU file đó.
 */
const workflowFileManagerPhoto = {

    /** Ứng với 'fileManagerPhoto.open'. */
    async openDrawer() {
        showFileManagerPhotoDrawer(); // core/file-manager/nav.js
        await this.refresh(null, false, new Set());
    },

    /** Đọc lại toàn bộ album + ảnh, vẽ lại story slider + masonry + thanh quản lý album + thanh
     * chọn nhiều (lọc theo activeAlbumId nếu có). Dùng lại ở MỌI nơi cần vẽ lại (mở drawer, chọn
     * album, đổi tên/xoá album, tạo album, upload xong, xoá ảnh xong, bật/tắt/xác nhận chọn nhiều).
     *
     * MỚI (batch tiếp theo) — thêm 2 tham số imageSelectionMode/selectedImageKeys:
     *   - Thanh quản lý album (#file-manager-album-manage-bar) CHỈ hiện khi có activeAlbum VÀ
     *     KHÔNG đang chọn nhiều (2 thanh dưới masonry không bao giờ cùng hiện 1 lúc).
     *   - Khi đang chọn nhiều: masonry hiện TOÀN BỘ thư viện (bỏ qua lọc activeAlbumId) — vì mục
     *     đích lúc này là CHỌN ẢNH MỚI để thêm vào, không phải xem ảnh đã có sẵn trong album.
     * @param {string|null} activeAlbumId
     * @param {boolean} [imageSelectionMode]
     * @param {Set<string>} [selectedImageKeys]
     */
    async refresh(activeAlbumId, imageSelectionMode = false, selectedImageKeys = new Set()) {
        const albums = await listAlbums(); // core/file-manager/album.js
        const images = await listImages(); // core/file-manager/image.js
        const imageRecordsByKey = new Map(images.map((img) => [img.key, img]));

        renderAlbumStory(albums, activeAlbumId, imageRecordsByKey); // core/file-manager/photo-ui.js

        const activeAlbum = activeAlbumId ? albums.find((a) => a.id === activeAlbumId) : null;

        if (fileManagerAlbumManageBar) {
            const showManageBar = !!activeAlbum && !imageSelectionMode;
            fileManagerAlbumManageBar.classList.toggle('hidden', !showManageBar);
            fileManagerAlbumManageBar.classList.toggle('flex', showManageBar);
            if (fileManagerAlbumManageName) fileManagerAlbumManageName.textContent = activeAlbum ? activeAlbum.name : '';
        }
        if (fileManagerImageSelectionBar) {
            fileManagerImageSelectionBar.classList.toggle('hidden', !imageSelectionMode);
            if (fileManagerImageSelectionCount) fileManagerImageSelectionCount.textContent = tFormat('fileManager.photo.album.selectedCount', { count: selectedImageKeys.size });
        }

        const displayedImages = imageSelectionMode
            ? images
            : (activeAlbum ? images.filter((img) => activeAlbum.imageKeys.includes(img.key)) : images);
        renderImageMasonry(fileManagerImageMasonry, displayedImages, imageSelectionMode, selectedImageKeys); // core/file-manager/photo-ui.js
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
     * đã render sẵn (tránh round-trip đọc lại DB chỉ để lấy tên đang hiển thị) — cùng idiom
     * renameFolderById() ở event/workflow/file-manager-song.js.
     * @param {string} albumId
     */
    renameAlbumById(albumId) {
        const currentName = fileManagerAlbumManageName ? fileManagerAlbumManageName.textContent : '';
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
     * @param {() => void} onDeleted - reset `activeAlbumId` về null Ở TẦNG ROUTER — workflow không
     *        tự mutate được biến closure primitive của router (xem comment đầu event/router/file-
     *        manager-photo.js), cùng idiom callback đã dùng ở openCreateAlbumModal/openFolderPickerModal.
     */
    deleteAlbumById(albumId, onDeleted) {
        const albumName = fileManagerAlbumManageName ? fileManagerAlbumManageName.textContent : '';
        modalChoice(
            tFormat('fileManager.photo.album.deleteConfirm', { name: escapeHtml(albumName) }),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => {} },
                { label: t('fileManager.photo.album.btnDelete'), className: 'flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors', onClick: async () => {
                    await deleteAlbum(albumId); // core có sẵn (core/file-manager/album.js) — KHÔNG đụng ảnh bên trong, chỉ mất liên kết
                    // MỚI (Batch 8, slideshow) — cascade "xoá album đang dùng làm nguồn slideshow"
                    // (mục 4 bước 2, plan-v12-multimedia-update-3.md): album vừa xoá đang là
                    // activeBackgroundAlbum -> tắt engine + dọn tham chiếu. appState.get() trực
                    // tiếp hợp lệ ở đây (WORKFLOW, không phải core function — Rule 2 không áp dụng).
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
     * TRỰC TIẾP `selectedImageKeys` (Set) qua tham chiếu — router giữ nguyên object đó, KHÔNG cần
     * callback reset như `activeAlbumId` (primitive, xem deleteAlbumById() ở trên).
     *
     * FIX (03/07/2026, mục 3 — nhấp nháy toàn bộ lưới mỗi lần chạm 1 ảnh): bản trước gọi
     * `this.refresh(...)` ở đây -> xây lại TOÀN BỘ masonry (revoke + tạo lại object URL mọi ảnh)
     * chỉ vì 1 ô đổi trạng thái. Đổi sang patch DOM SURGICAL — chỉ đổi badge của ĐÚNG ô vừa chạm
     * (`toggleImageSelectionBadge`) + text số lượng đã chọn (`updateImageSelectionCount`), KHÔNG
     * đụng DOM node nào khác, KHÔNG đọc lại DB.
     * @param {string} imageKey
     * @param {Set<string>} selectedImageKeys
     */
    toggleImageSelectionInSet(imageKey, selectedImageKeys) {
        if (selectedImageKeys.has(imageKey)) selectedImageKeys.delete(imageKey);
        else selectedImageKeys.add(imageKey);
        toggleImageSelectionBadge(imageKey, selectedImageKeys.has(imageKey)); // core, patch DOM surgical (core/file-manager/photo-ui.js)
        updateImageSelectionCount(selectedImageKeys.size); // core, patch DOM surgical
    },

    /** Ứng với 'fileManagerPhoto.imageSelection.confirm'. addImagesToAlbum() tự bỏ qua ảnh đã có
     * sẵn trong album (không thêm trùng) — xem core/file-manager/album.js.
     * @param {string} albumId
     * @param {Set<string>} selectedImageKeys
     * @param {string|null} activeAlbumId - dùng để refresh lại ĐÚNG lọc sau khi xong (luôn = albumId ở đây, nhưng nhận riêng cho rõ nghĩa tham số của refresh())
     */
    async confirmAddSelectedImages(albumId, selectedImageKeys, activeAlbumId) {
        const keys = Array.from(selectedImageKeys);
        if (keys.length === 0) return; // guard — chưa chọn gì thì không làm gì

        let addedCount = 0;
        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            const result = await addImagesToAlbum(keys, albumId); // core có sẵn, CÓ return, DÙNG ngay dưới -> hợp lệ Rule 3 (nếu đây là core — đây là workflow, không bị ràng buộc, nhưng vẫn đúng tinh thần dùng giá trị trả về)
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
        fileManagerImageUploadInput.value = ''; // cho phép chọn lại đúng file cũ ở lần sau (input change không bắn lại nếu value không đổi)
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
                // LƯU Ý (03/07/2026, Giang chỉnh lại): "Đặt làm nền Playlist/Visual" giờ COPY thẳng
                // Blob (giống hệt cơ chế upload trực tiếp cũ) chứ KHÔNG giữ tham chiếu imageKey nào
                // — xoá ảnh này khỏi File Manager KHÔNG ảnh hưởng gì tới nền đã đặt trước đó (nền
                // đang dùng là 1 bản copy độc lập). KHÔNG còn cascade nào cần dọn ở đây nữa.
                await this.refresh(activeAlbumId);
            },
            // MỚI (batch 03/07/2026, hạ tầng z-index nền Visual — nối nốt phần đã hoãn ở Batch 3).
            onSetPlaylistBg: async () => { await this.setAsPlaylistBackground(imageKey); },
            onSetVisualBg: async () => { await this.setAsVisualBackground(imageKey); },
            // MỚI (03/07/2026, mục 4) — "Gỡ khỏi album" (KHÁC "Xoá khỏi thư viện" — ảnh vẫn còn
            // nguyên trong File Manager, chỉ mất liên kết với album NÀY). CHỈ truyền callback khi
            // đang thật sự lọc theo 1 album cụ thể (activeAlbumId != null) — photo-ui.js chỉ TẠO
            // nút khi có callback này, không phải ẩn/hiện bằng CSS.
            onRemoveFromAlbum: activeAlbumId ? async () => {
                await removeImageFromAlbum(imageKey, activeAlbumId); // core có sẵn (core/file-manager/album.js, Batch 3)
                await this.refresh(activeAlbumId);
            } : undefined,
            // MỚI (04/07/2026, mục 2 phản hồi Giang) — lưu caption. Nếu ảnh này ĐANG là ảnh hiện
            // tại của Slideshow/Visual bg image, tự cập nhật luôn khung caption trên Visualizer
            // (không cần đợi vòng đổi ảnh kế tiếp mới thấy caption mới).
            onSaveCaption: async (caption) => {
                await setImageCaption(imageKey, caption); // core/file-manager/image.js
                if (typeof workflowSlideshow !== 'undefined') workflowSlideshow.refreshCaptionIfCurrentImage(imageKey, caption);
                if (typeof workflowVisualizerControlCenter !== 'undefined') workflowVisualizerControlCenter.refreshCaptionIfVisualBgImage(imageKey, caption);
            },
        });
    },

    /** Ứng với nút "Đặt làm nền Playlist" trong modal xem ảnh — TÁI DÙNG NGUYÊN applyBgImage()
     * (core/visualizer/visualizer-display.js, cùng hàm mà nút "Chọn ảnh" ở Settings dùng — xem
     * event/workflow/visualizer-display.js::pickBgImageFromLibrary) — không lặp lại logic.
     * @param {string} imageKey
     */
    async setAsPlaylistBackground(imageKey) {
        const record = await getImageRecord(imageKey); // data layer (service/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác

        await withLoadingShield(t('common.loading.savingImageBg'), async () => {
            await applyBgImage(record.blob); // core có sẵn (core/visualizer/visualizer-display.js)
        });
        await alertModal(t('fileManager.photo.image.setPlaylistBgSuccess'));
    },

    /** Ứng với nút "Đặt làm nền Visual" trong modal xem ảnh — TÁI DÙNG NGUYÊN applyVisualBgImage()
     * (core/state-and-video-bg.js, cùng hàm mà nút "Chọn ảnh" ở Settings dùng — xem
     * event/workflow/visualizer-control-center.js::pickVisualBgImageFromLibrary).
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

    /** Ứng với nút "Dùng làm nền Slideshow" ở thanh quản lý album (MỚI, Batch 8) — KHÁC 2 hàm
     * setAs*Background() ở trên (copy-blob): Album là quan hệ NHIỀU-NHIỀU thật (imageKeys: []), nên
     * slideshow giữ THAM CHIẾU SỐNG (albumId), KHÔNG copy-blob — đúng nguyên tắc đã chốt ở mục 1.1
     * plan-v12-multimedia-update-3.md ("mặc định copy-blob, CHỈ dùng tham chiếu thật khi bản chất
     * đúng là quan hệ nhiều-nhiều như Album"). Giao hẳn cho workflowSlideshow (đã tự
     * getAlbumRecord/persist/khởi động engine) — không lặp lại logic ở đây.
     * @param {string} albumId
     */
    async setAsSlideshowBackground(albumId) {
        await workflowSlideshow.setActiveAlbum(albumId);
        await alertModal(t('fileManager.photo.album.setSlideshowBgSuccess'));
    },
};
