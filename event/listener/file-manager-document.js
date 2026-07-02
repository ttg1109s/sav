/**
 * event/listener/file-manager-document.js — TẤT CẢ listener của cụm "fileManagerDocument".
 * NẠP SAU CÙNG (sau bus, core, router, VÀ SAU dom-refs.js).
 */

if (btnOpenFileManagerDocument) {
    btnOpenFileManagerDocument.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerDocument', type: 'fileManagerDocument.open', payload: {} });
    });
}

if (btnBackFileManagerDocument) {
    btnBackFileManagerDocument.addEventListener('click', () => {
        // Back trong drawer Documents chỉ ẩn drawer này — KHÔNG động vào #drawer-settings bên dưới.
        eventBus.send({ router: 'fileManagerDocument', type: 'fileManagerDocument.close', payload: {} });
    });
}
