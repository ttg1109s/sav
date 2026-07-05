/**
 * event/listener/document-reader.js — TẤT CẢ listener của cụm "documentReader". NẠP SAU CÙNG
 * (sau bus, core, router, VÀ SAU dom-refs.js).
 *
 * VIẾT LẠI (04/07/2026, mục 3 phản hồi Giang) — bỏ listener `btnOpenDocumentReader` (chuyển hẳn
 * sang cụm "documentPicker" — event/listener/document-picker.js — nút "Reader" ở Control Center
 * giờ mở drawer chọn tài liệu TRƯỚC, không mở thẳng Reader nữa).
 */

if (btnDocumentReaderClose) {
    btnDocumentReaderClose.addEventListener('click', () => {
        eventBus.send({ router: 'documentReader', type: 'documentReader.close', payload: {} });
    });
}

if (documentReaderOverlay) {
    documentReaderOverlay.addEventListener('click', () => {
        eventBus.send({ router: 'documentReader', type: 'documentReader.close', payload: {} });
    });
}

if (btnDocumentReaderPrev) {
    btnDocumentReaderPrev.addEventListener('click', () => {
        eventBus.send({ router: 'documentReader', type: 'documentReader.prev.click', payload: {} });
    });
}

if (btnDocumentReaderNext) {
    btnDocumentReaderNext.addEventListener('click', () => {
        eventBus.send({ router: 'documentReader', type: 'documentReader.next.click', payload: {} });
    });
}

if (btnDocumentReaderListToggle) {
    btnDocumentReaderListToggle.addEventListener('click', () => {
        eventBus.send({ router: 'documentReader', type: 'documentReader.listToggle.click', payload: {} });
    });
}

if (btnDocumentReaderEdit) {
    btnDocumentReaderEdit.addEventListener('click', () => {
        eventBus.send({ router: 'documentReader', type: 'documentReader.edit.click', payload: {} });
    });
}

if (btnDocumentReaderEditCancel) {
    btnDocumentReaderEditCancel.addEventListener('click', () => {
        eventBus.send({ router: 'documentReader', type: 'documentReader.editCancel.click', payload: {} });
    });
}

if (btnDocumentReaderEditSave) {
    btnDocumentReaderEditSave.addEventListener('click', () => {
        eventBus.send({ router: 'documentReader', type: 'documentReader.editSave.click', payload: {} });
    });
}
