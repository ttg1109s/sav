/**
 * core/file-manager/nav.js — DOM-patch THUẦN cho 3 drawer con của File Manager (Song/Photo &
 * Album/Documents). CHỐT LẠI 03/07/2026 (xem plan-v12-multimedia-decisions.md mục 1a/7): trước
 * đây file này chứa logic "tab-switch" cho 1 overlay chung — KHÔNG còn nữa, vì mỗi loại tài sản
 * giờ là 1 drawer ĐỘC LẬP, mở/đóng riêng theo đúng nav-stack pattern (giống
 * openAboutDrawerAndRenderStats()/closeAboutDrawer() ở core/about-stats.js).
 *
 * Mỗi hàm dưới đây đơn tuyến, chỉ patch DOM (classList), không đọc/ghi appState, không I/O —
 * đúng Rule 1/2 core-function-conventions.md. Việc mở Song CẦN thêm refresh dữ liệu (folder list +
 * thống kê) — đó là >1 hàm core nối tiếp nên đặt ở workflow (event/workflow/file-manager-song.js),
 * KHÔNG ở đây; 2 hàm show/hide của Song trong file này CHỈ lo phần DOM thuần, workflow gọi tới.
 *
 * NẠP SAU: core/dom-refs.js (drawerFileManagerSong/Photo/Document).
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
