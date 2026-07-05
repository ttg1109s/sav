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

// MỚI (04/07/2026, tính năng Documents) — 2 nút upload TÁCH RIÊNG (mục 1 phản hồi Giang).
if (btnFileManagerDocumentUpload && fileManagerDocumentUploadInput) {
    btnFileManagerDocumentUpload.addEventListener('click', () => {
        fileManagerDocumentUploadInput.click();
    });
    fileManagerDocumentUploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return; // huỷ hộp thoại chọn file -> không gửi gì cả
        eventBus.send({ router: 'fileManagerDocument', type: 'fileManagerDocument.upload.change', payload: { file } });
    });
}

if (btnFileManagerDocumentCreate) {
    btnFileManagerDocumentCreate.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerDocument', type: 'fileManagerDocument.create.click', payload: {} });
    });
}
