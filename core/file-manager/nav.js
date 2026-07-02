/**
 * core/file-manager/nav.js — DOM-patch THUẦN cho các drawer con của File Manager (Song/Folder
 * Detail/Photo & Album/Documents). CHỐT LẠI 03/07/2026 (xem plan-v12-multimedia-decisions.md mục
 * 1a/7): trước đây file này chứa logic "tab-switch" cho 1 overlay chung — KHÔNG còn nữa, vì mỗi
 * loại tài sản giờ là 1 drawer ĐỘC LẬP, mở/đóng riêng theo đúng nav-stack pattern (giống
 * openAboutDrawerAndRenderStats()/closeAboutDrawer() ở core/about-stats.js).
 *
 * Mỗi hàm dưới đây đơn tuyến, chỉ patch DOM (classList), không đọc/ghi appState, không I/O —
 * đúng Rule 1/2 core-function-conventions.md. Việc mở Song/Folder Detail CẦN thêm refresh dữ liệu
 * — đó là >1 hàm core nối tiếp nên đặt ở workflow (event/workflow/file-manager-song.js), KHÔNG ở
 * đây; hàm show/hide trong file này CHỈ lo phần DOM thuần, workflow gọi tới.
 *
 * NẠP SAU: core/dom-refs.js (drawerFileManagerSong/FolderDetail/Photo/Document).
 */

// ===================== Song =====================
function showFileManagerSongDrawer() {
    if (!drawerFileManagerSong) return; // guard
    drawerFileManagerSong.classList.remove('translate-y-full');
}
function hideFileManagerSongDrawer() {
    if (!drawerFileManagerSong) return; // guard
    drawerFileManagerSong.classList.add('translate-y-full');
}

// ===================== Folder Detail (Phase 2, MỚI — mục 1b/c) =====================
function showFileManagerFolderDetailDrawer() {
    if (!drawerFileManagerFolderDetail) return; // guard
    drawerFileManagerFolderDetail.classList.remove('translate-y-full');
}
function hideFileManagerFolderDetailDrawer() {
    if (!drawerFileManagerFolderDetail) return; // guard
    drawerFileManagerFolderDetail.classList.add('translate-y-full');
}

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
