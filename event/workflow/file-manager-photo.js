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
        renderImageMasonry(displayedImages, imageSelectionMode, selectedImageKeys); // core/file-manager/photo-ui.js
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
     * @param {string} imageKey
     * @param {Set<string>} selectedImageKeys
     * @param {string|null} activeAlbumId
     */
    toggleImageSelectionInSet(imageKey, selectedImageKeys, activeAlbumId) {
        if (selectedImageKeys.has(imageKey)) selectedImageKeys.delete(imageKey);
        else selectedImageKeys.add(imageKey);
        this.refresh(activeAlbumId, true, selectedImageKeys);
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
        const record = await getImageRecord(imageKey); // data layer (core/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác

        openImagePreviewModal({ key: imageKey, ...record }, { // core/file-manager/photo-ui.js
            onDelete: async () => {
                await deleteImage(imageKey); // core/file-manager/image.js — cascade dọn album (Batch 3)
                // MỚI (batch 03/07/2026) — dọn cascade cover/nền mồ côi (mục 3.1
                // readme/song-cover-background-relations.md). deleteImage() (core/file-manager/image.js)
                // KHÔNG tự làm việc này (giữ hàm đó THUẦN DB-layer, không appState — Rule 2) — đặt Ở
                // ĐÂY (workflow, được tự do appState.get()/mutate()).
                const cfg = appState.get('vizConfig');
                if (cfg.bgImageKey === imageKey) {
                    appState.mutate('vizConfig', c => {
                        if (c.bgImage && c.bgImage.startsWith('blob:')) URL.revokeObjectURL(c.bgImage);
                        c.bgImage = ''; c.bgImageKey = null; c.bgImageEnabled = false;
                    });
                    console.log(`writer: "openImagePreview.onDelete", page: "vizConfig", content: "dọn bgImageKey mồ côi (ảnh ${imageKey} đã xoá)"`);
                    updatePlaylistBg(); // core có sẵn (color-utils.js)
                    if (typeof bgImageEnableToggle !== 'undefined' && bgImageEnableToggle) bgImageEnableToggle.checked = false;
                    saveConfig(); // core có sẵn (config.js)
                }
                if (cfg.visualBgImageKey === imageKey) {
                    appState.mutate('vizConfig', c => {
                        if (c.visualBgImage && c.visualBgImage.startsWith('blob:')) URL.revokeObjectURL(c.visualBgImage);
                        c.visualBgImage = ''; c.visualBgImageKey = null; c.visualBgImageEnabled = false;
                    });
                    console.log(`writer: "openImagePreview.onDelete", page: "vizConfig", content: "dọn visualBgImageKey mồ côi (ảnh ${imageKey} đã xoá)"`);
                    applyVisualBgImageToDOM(false, ''); // core có sẵn (state-and-video-bg.js)
                    saveConfig();
                }
                await this.refresh(activeAlbumId);
            },
            // MỚI (batch 03/07/2026, hạ tầng z-index nền Visual — nối nốt phần đã hoãn ở Batch 3).
            onSetPlaylistBg: async () => { await this.setAsPlaylistBackground(imageKey); },
            onSetVisualBg: async () => { await this.setAsVisualBackground(imageKey); },
        });
    },

    /** Ứng với nút "Đặt làm nền Playlist" trong modal xem ảnh — ghi `vizConfig.bgImageKey` (CƠ CHẾ
     * MỚI, song song `bgImage` Blob cũ để tương thích ngược, xem
     * readme/song-cover-background-relations.md mục 3.2).
     * @param {string} imageKey
     */
    async setAsPlaylistBackground(imageKey) {
        const record = await getImageRecord(imageKey); // data layer (core/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác

        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            appState.mutate('vizConfig', cfg => {
                if (cfg.bgImage && cfg.bgImage.startsWith('blob:')) URL.revokeObjectURL(cfg.bgImage);
                cfg.bgImage = URL.createObjectURL(record.blob);
                cfg.bgImageKey = imageKey;
                cfg.bgImageEnabled = true;
            });
            console.log(`writer: "setAsPlaylistBackground", page: "vizConfig", content: "bgImageKey=${imageKey}"`);
            updatePlaylistBg(); // core có sẵn (color-utils.js)
            if (typeof bgImageEnableToggle !== 'undefined' && bgImageEnableToggle) bgImageEnableToggle.checked = true;
            saveConfig(); // core có sẵn (config.js)
        });
        await alertModal(t('fileManager.photo.image.setPlaylistBgSuccess'));
    },

    /** Ứng với nút "Đặt làm nền Visual" trong modal xem ảnh — ghi `vizConfig.visualBgImageKey`
     * (tính năng MỚI HOÀN TOÀN, không có field cũ cần tương thích ngược).
     *
     * SỬA (03/07/2026, Giang chốt lại) — bản đầu batch này từng CHỦ ĐỘNG tắt video nền lúc đặt ảnh
     * nền Visual (giả định 2 nguồn loại trừ nhau) — SAI, đã bỏ. CHỐT ĐÚNG: cả 4 lớp nền màn
     * Visualizer (màu/ảnh/slideshow/video) ĐỀU BẬT SONG SONG được, xếp lớp thuần qua CSS z-index —
     * xem comment đầy đủ ngay trước applyVisualBgImageToDOM() ở core/state-and-video-bg.js.
     * @param {string} imageKey
     */
    async setAsVisualBackground(imageKey) {
        const record = await getImageRecord(imageKey); // data layer (core/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác

        await withLoadingShield(t('common.loading.savingInfo'), async () => {
            let objectUrl;
            appState.mutate('vizConfig', cfg => {
                if (cfg.visualBgImage && cfg.visualBgImage.startsWith('blob:')) URL.revokeObjectURL(cfg.visualBgImage);
                objectUrl = URL.createObjectURL(record.blob);
                cfg.visualBgImage = objectUrl;
                cfg.visualBgImageKey = imageKey;
                cfg.visualBgImageEnabled = true;
            });
            console.log(`writer: "setAsVisualBackground", page: "vizConfig", content: "visualBgImageKey=${imageKey}"`);
            applyVisualBgImageToDOM(true, objectUrl); // core có sẵn (state-and-video-bg.js)
            saveConfig(); // core có sẵn (config.js)
        });
        await alertModal(t('fileManager.photo.image.setVisualBgSuccess'));
    }
};
