/**
 * event/listener/document-picker.js — TẤT CẢ listener của cụm "documentPicker". NẠP SAU CÙNG
 * (sau bus, core, router, VÀ SAU dom-refs.js).
 *
 * VIẾT LẠI (10/07/2026, Nhóm A — mục 5/6 plan-v12-extended.md): CHỈ còn 1 listener tĩnh —
 * `btnOpenDocumentReader` (nút "Reader" ở Control Center, phần tử TĨNH thật sự duy nhất còn lại
 * của toàn bộ tính năng Documents-Reader). Mọi nút BÊN TRONG Generic Drawer (đóng/back/sửa/next/
 * prev/chọn dòng...) giờ được `event/workflow/document-reader.js` tự gắn `addEventListener` trực
 * tiếp SAU MỖI lần render lại, KHÔNG qua eventBus — xem docstring đầu core/generic-drawer.js.
 * event/listener/document-reader.js CŨ (từng chứa các listener đó) ĐÃ XOÁ HOÀN TOÀN — xoá tay nếu
 * còn sót trên máy.
 */

if (btnOpenDocumentReader) {
    btnOpenDocumentReader.addEventListener('click', () => {
        eventBus.send({ router: 'documentPicker', type: 'documentPicker.open.click', payload: {} });
    });
}
