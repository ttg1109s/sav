/**
 * event/listener/document-picker.js — TẤT CẢ listener của cụm "documentPicker". NẠP SAU CÙNG
 * (sau bus, core, router, VÀ SAU dom-refs.js).
 *
 * `btnOpenDocumentReader` (nút "Reader" ở Control Center) — CHUYỂN VỀ ĐÂY (04/07/2026, mục 3 phản
 * hồi Giang): giờ mở drawer chọn tài liệu TRƯỚC, KHÔNG mở thẳng Reader nữa.
 */

if (btnOpenDocumentReader) {
    btnOpenDocumentReader.addEventListener('click', () => {
        eventBus.send({ router: 'documentPicker', type: 'documentPicker.open.click', payload: {} });
    });
}

if (btnDocumentPickerClose) {
    btnDocumentPickerClose.addEventListener('click', () => {
        eventBus.send({ router: 'documentPicker', type: 'documentPicker.close', payload: {} });
    });
}

if (documentPickerOverlay) {
    documentPickerOverlay.addEventListener('click', () => {
        eventBus.send({ router: 'documentPicker', type: 'documentPicker.close', payload: {} });
    });
}
