/**
 * core/file-manager/nav.js — DOM-patch THUẦN cho 2 drawer con CÒN LẠI của File Manager (Photo &
 * Album/Documents — CHƯA migrate, dự kiến D6/D7). CHỐT LẠI 03/07/2026 (xem plan-v12-multimedia-
 * decisions.md mục 1a/7): trước đây file này chứa logic "tab-switch" cho 1 overlay chung — KHÔNG
 * còn nữa, mỗi loại tài sản là 1 drawer ĐỘC LẬP, mở/đóng riêng theo nav-stack pattern (mỗi drawer
 * tự `classList` ẩn/hiện chính nó).
 *
 * Batch D5 (Settings restructure, 06/07/2026) — 4 hàm show/hide Song + Folder Detail ĐÃ XOÁ: 2
 * khu vực đó giờ push/pop động qua core/settings-panel-stack.js (xem event/workflow/file-manager-
 * song.js::openPanel()/openFolderDetail()), không còn drawer tĩnh riêng để patch classList nữa.
 *
 * Mỗi hàm dưới đây đơn tuyến, chỉ patch DOM (classList), không đọc/ghi appState, không I/O —
 * đúng Rule 1/2 core-function-conventions.md.
 *
 * NẠP SAU: core/dom-refs.js (drawerFileManagerPhoto/Document).
 */

// ===================== Photo & Album (placeholder — b2/b3 CHƯA code) =====================
function showFileManagerPhotoDrawer() {
    if (!drawerFileManagerPhoto) return; // guard
    drawerFileManagerPhoto.classList.remove('translate-y-full');
}
function hideFileManagerPhotoDrawer() {
    if (!drawerFileManagerPhoto) return; // guard
    drawerFileManagerPhoto.classList.add('translate-y-full');
}

// ===================== Documents (placeholder — b4 CHƯA code) =====================
function showFileManagerDocumentDrawer() {
    if (!drawerFileManagerDocument) return; // guard
    drawerFileManagerDocument.classList.remove('translate-y-full');
}
function hideFileManagerDocumentDrawer() {
    if (!drawerFileManagerDocument) return; // guard
    drawerFileManagerDocument.classList.add('translate-y-full');
}
