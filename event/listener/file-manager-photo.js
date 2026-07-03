/**
 * event/listener/file-manager-photo.js — TẤT CẢ listener của cụm "fileManagerPhoto".
 * NẠP SAU CÙNG (sau bus, core, router, VÀ SAU dom-refs.js).
 */

if (btnOpenFileManagerPhoto) {
    btnOpenFileManagerPhoto.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.open', payload: {} });
    });
}

if (btnBackFileManagerPhoto) {
    btnBackFileManagerPhoto.addEventListener('click', () => {
        // Back trong drawer Photo & Album chỉ ẩn drawer này — KHÔNG động vào #drawer-settings bên dưới.
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.close', payload: {} });
    });
}

// ===================== Story slider Album (Batch 3, 03/07/2026) =====================

if (fileManagerAlbumStory) {
    fileManagerAlbumStory.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-album-story-action]');
        if (!btn) return; // không bấm trúng item nào -> không gửi gì cả
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.album.storyClick', payload: { action: btn.dataset.albumStoryAction, albumId: btn.dataset.albumId } });
    });
}

// ===================== Masonry ảnh =====================

if (fileManagerImageMasonry) {
    fileManagerImageMasonry.addEventListener('click', (e) => {
        const tile = e.target.closest('button[data-image-key]');
        if (!tile) return; // không bấm trúng ảnh nào -> không gửi gì cả
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.image.click', payload: { imageKey: tile.dataset.imageKey } });
    });
}

// ===================== Upload =====================

if (btnFileManagerImageUploadTrigger) {
    btnFileManagerImageUploadTrigger.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.upload.click', payload: {} });
    });
}

if (fileManagerImageUploadInput) {
    fileManagerImageUploadInput.addEventListener('change', () => {
        if (fileManagerImageUploadInput.files.length === 0) return; // bấm Huỷ trên hộp thoại chọn file
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.upload.change', payload: { files: fileManagerImageUploadInput.files } });
    });
}
