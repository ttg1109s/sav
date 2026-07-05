/**
 * event/workflow/document-picker.js — Workflow cụm "documentPicker" (drawer trắng chọn tài liệu,
 * viết mới 04/07/2026 theo phản hồi Giang mục 3 — THAY hẳn dropdown nhỏ trong Reader cũ).
 *
 * ĐÂY LÀ ENTRY POINT DUY NHẤT của nút "Reader" ở Control Center — bấm "Reader" KHÔNG còn mở thẳng
 * `#document-reader-window` nữa, mà mở drawer NÀY trước; chọn xong MỚI gọi
 * `workflowDocumentReader.openDocument()`. Nút "list" (đổi tài liệu) trong Reader đang mở CŨNG mở
 * lại ĐÚNG drawer này (dùng chung — Workflow gọi Workflow khác tự do, không bị Rule 3).
 *
 * NẠP SAU: core/file-manager/document.js, core/file-manager/document-ui.js, core/dom-refs.js.
 * NẠP TRƯỚC: event/router/document-picker.js, event/listener/document-picker.js.
 */
const workflowDocumentPicker = {

    /** Mở drawer — vẽ lại danh sách MỚI NHẤT mỗi lần mở (phòng vừa thêm/xoá ở File Manager). */
    async open() {
        const documents = await listDocuments(); // core
        if (documentPickerEmpty) documentPickerEmpty.classList.toggle('hidden', documents.length > 0);
        const activeKey = (typeof workflowDocumentReader !== 'undefined') ? workflowDocumentReader._currentDocumentKey : null;
        renderDocumentPickerList(documentPickerList, documents, activeKey, (documentKey) => { // core/UI
            this.close();
            if (typeof workflowDocumentReader !== 'undefined') workflowDocumentReader.openDocument(documentKey);
        });
        setDocumentPickerVisible(documentPickerOverlay, documentPickerDrawer, true); // core/UI
    },

    close() {
        setDocumentPickerVisible(documentPickerOverlay, documentPickerDrawer, false); // core/UI
    },
};
