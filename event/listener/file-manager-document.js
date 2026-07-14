/**
 * event/listener/file-manager-document.js — TẤT CẢ listener của cụm "fileManagerDocument".
 *
 * === Batch D7 (Settings restructure, 06/07/2026 — batch CUỐI Nhóm D) ===
 * Panel Document giờ push/pop động — TOÀN BỘ listener bên dưới (trừ `btnOpenFileManagerDocument`,
 * Main tĩnh) ĐỔI sang delegation trên `settingsStackBody`, cùng CHUẨN Song/Photo (Batch D5/D6).
 * `btnBackFileManagerDocument` ĐÃ XOÁ (Back dùng CHUNG). Nút upload chỉ click hộ input file ẩn —
 * DOM proxy thuần, xử lý trực tiếp trong listener (giống Photo, không qua eventBus).
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (btnOpenFileManagerDocument) {
    btnOpenFileManagerDocument.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerDocument', type: 'fileManagerDocument.openPanel.click', payload: {} });
    });
}

function handleFileManagerDocumentDelegatedClick(e) {
    if (e.target.closest('#btn-file-manager-document-upload')) {
        const panel = e.target.closest('.settings-stack-panel');
        const input = panel ? panel.querySelector('#file-manager-document-upload-input') : null;
        if (input) input.click();
        return;
    }
    if (e.target.closest('#btn-file-manager-document-create')) {
        eventBus.send({ router: 'fileManagerDocument', type: 'fileManagerDocument.create.click', payload: {} });
        return;
    }
    // MỚI (14/07/2026, tích hợp pagination) — mode 'list' (buildPaginationListHtml(),
    // core/pagination.js) của danh sách document.
    const documentPagination = e.target.closest('#file-manager-document-pagination');
    if (documentPagination) {
        const gotoBtn = e.target.closest('button[data-pagination-action="goto"]');
        if (!gotoBtn) return; // bấm trúng vùng trống -> không gửi gì
        eventBus.send({ router: 'fileManagerDocument', type: 'fileManagerDocument.page.goto', payload: { pageIndex: Number(gotoBtn.dataset.pageIndex) } });
        return;
    }
}

function handleFileManagerDocumentDelegatedChange(e) {
    if (e.target.id === 'file-manager-document-upload-input') {
        const file = e.target.files[0];
        e.target.value = '';
        if (!file) return; // huỷ hộp thoại chọn file -> không gửi gì cả
        eventBus.send({ router: 'fileManagerDocument', type: 'fileManagerDocument.upload.change', payload: { file } });
    }
}

if (settingsStackBody) {
    settingsStackBody.addEventListener('click', handleFileManagerDocumentDelegatedClick);
    settingsStackBody.addEventListener('change', handleFileManagerDocumentDelegatedChange);
}
