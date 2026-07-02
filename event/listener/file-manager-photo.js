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
