/**
 * core/file-manager/nav.js — DOM-patch THUẦN cho drawer con CÒN LẠI của File Manager (Documents —
 * CHƯA migrate, dự kiến D7). CHỐT LẠI 03/07/2026 (xem plan-v12-multimedia-decisions.md mục 1a/7).
 *
 * Batch D5 — 4 hàm show/hide Song + Folder Detail ĐÃ XOÁ (push/pop động).
 * Batch D6 (06/07/2026) — 2 hàm show/hide Photo & Album ĐÃ XOÁ (push/pop động, xem
 * event/workflow/file-manager-photo.js::openPanel()) — chỉ còn Documents.
 *
 * NẠP SAU: core/dom-refs.js (drawerFileManagerDocument).
 */

// ===================== Documents (placeholder — b4 CHƯA code) =====================
function showFileManagerDocumentDrawer() {
    if (!drawerFileManagerDocument) return; // guard
    drawerFileManagerDocument.classList.remove('translate-y-full');
}
function hideFileManagerDocumentDrawer() {
    if (!drawerFileManagerDocument) return; // guard
    drawerFileManagerDocument.classList.add('translate-y-full');
}
