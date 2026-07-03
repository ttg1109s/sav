/**
 * event/workflow/file-manager-photo.js — Batch 3 (03/07/2026), "THẰNG THỰC THI CUỐI" cho drawer
 * Photo & Album. Mọi method nhận `activeAlbumId` qua THAM SỐ (context sống ở Router, xem
 * event/router/file-manager-photo.js) — workflow không tự giữ state UI riêng.
 *
 * NẠP SAU: core/file-manager/image.js, core/file-manager/album.js, core/file-manager/photo-ui.js,
 * core/file-manager/nav.js.
 */
const workflowFileManagerPhoto = {

    /** Ứng với 'fileManagerPhoto.open'. */
    async openDrawer() {
        showFileManagerPhotoDrawer(); // core/file-manager/nav.js
        await this.refresh(null);
    },

    /** Đọc lại toàn bộ album + ảnh, vẽ lại story slider + masonry (lọc theo activeAlbumId nếu có).
     * Dùng lại ở MỌI nơi cần vẽ lại (mở drawer, chọn album, tạo album, upload xong, xoá ảnh xong).
     * @param {string|null} activeAlbumId
     */
    async refresh(activeAlbumId) {
        const albums = await listAlbums(); // core/file-manager/album.js
        const images = await listImages(); // core/file-manager/image.js
        const imageRecordsByKey = new Map(images.map((img) => [img.key, img]));

        renderAlbumStory(albums, activeAlbumId, imageRecordsByKey); // core/file-manager/photo-ui.js

        const activeAlbum = activeAlbumId ? albums.find((a) => a.id === activeAlbumId) : null;
        const filteredImages = activeAlbum
            ? images.filter((img) => activeAlbum.imageKeys.includes(img.key))
            : images;
        renderImageMasonry(filteredImages); // core/file-manager/photo-ui.js
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

    /** Ứng với 'fileManagerPhoto.image.click'.
     * @param {string} imageKey
     * @param {string|null} activeAlbumId
     */
    async openImagePreview(imageKey, activeAlbumId) {
        const record = await getImageRecord(imageKey); // data layer (core/db.js)
        if (!record) return; // guard: ảnh vừa bị xoá ở tab/thao tác khác

        openImagePreviewModal({ key: imageKey, ...record }, { // core/file-manager/photo-ui.js
            onDelete: async () => {
                await deleteImage(imageKey); // core/file-manager/image.js
                await this.refresh(activeAlbumId);
            }
        });
    }
};
