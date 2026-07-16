/**
 * main.js — Bootstrap của ứng dụng.
 *
 * File này PHẢI được nạp NGAY SAU các file components/*.js (chúng chỉ định nghĩa
 * các biến TPL_* chứa chuỗi HTML) và PHẢI chạy TRƯỚC TOÀN BỘ các file js/core/*.js
 * và core/visualizer/*.js, vì các file đó dùng document.getElementById(...) ngay khi
 * được nạp — nếu DOM chưa có các phần tử tương ứng, code sẽ lỗi (null reference).
 *
 * Cơ chế: mỗi component là một chuỗi HTML (TPL_...) được "lắp" (mount) vào đúng vị
 * trí của nó trong <div id="app-root"> bằng innerHTML, theo đúng thứ tự xuất hiện
 * trong file gốc ban đầu (loading-shield, playlist-view, visualizer-overlay,
 * bottom-player, settings-drawer).
 *
 * Không dùng fetch()/import vì ứng dụng được thiết kế để chạy trực tiếp qua
 * file:// (mở file index.html bằng double-click), không qua server.
 */
(function mountComponents() {
    const appRoot = document.getElementById('app-root');
    if (!appRoot) {
        console.error('[main.js] Không tìm thấy #app-root trong index.html — không thể lắp giao diện.');
        return;
    }

    // Thứ tự lắp ghép PHẢI giống thứ tự các block trong file HTML gốc.
    // Ver 12 "Multi Media" — CHỐT 03/07/2026 (plan-v12-multimedia-decisions.md mục 1a/7):
    // TPL_FILE_MANAGER (overlay cấp cao + tab-bar, patch 02/07/2026) ĐÃ BỎ — thay bằng 3 drawer
    // con độc lập (TPL_FILE_MANAGER_SONG_DRAWER/_PHOTO_DRAWER/_DOCUMENT_DRAWER, xem
    // components/file-manager.js), mở trực tiếp từ 1 section trong chính TPL_SETTINGS_DRAWER
    // (components/settings/file-manager-section.js) — cùng cấp nav-stack với Visualizer Settings
    // (nay panel động, xem Batch D3 dưới), không cần màn trung gian nào. File
    // components/storage-drawer.js CŨ không còn được mount ở đây nữa (còn để lại trong project
    // làm tư liệu, không tự xoá).
    //
    // Batch D1 (Settings restructure, 06/07/2026) — TPL_ABOUT_DRAWER ĐÃ BỎ khỏi danh sách mount:
    // About không còn là template tĩnh mount 1 lần lúc boot — nội dung của nó giờ là 1 HÀM
    // (components/about-drawer.js::renderAboutPanelBody()), được PUSH ĐỘNG vào ngăn xếp bên trong
    // #drawer-settings (đã có sẵn trong TPL_SETTINGS_DRAWER) mỗi lần người dùng mở About — xem
    // core/settings-panel-stack.js + event/workflow/settings-misc.js::openAbout().
    // Batch D2 (Settings restructure, 06/07/2026) — TPL_SUBTITLE_SETTINGS_DRAWER ĐÃ BỎ khỏi mount
    // tĩnh, cùng lý do TPL_ABOUT_DRAWER ở Batch D1: nội dung giờ là 1 HÀM
    // (components/subtitle-settings-drawer.js::renderSubtitlePanelBody()), PUSH ĐỘNG vào ngăn
    // xếp — xem event/workflow/subtitle-style-settings.js::openPanel().
    // Batch D3 (Settings restructure, 06/07/2026) — TPL_VISUALIZER_SETTINGS_DRAWER ĐÃ BỎ khỏi
    // mount tĩnh, cùng lý do TPL_ABOUT_DRAWER/TPL_SUBTITLE_SETTINGS_DRAWER ở D1/D2: nội dung giờ
    // là 1 HÀM (components/visualizer-settings-drawer.js::renderVisualizerPanelBody()), PUSH ĐỘNG
    // vào ngăn xếp — xem event/workflow/visualizer-display.js::openPanel().
    // HOTFIX 6 (08/07/2026, bug do Giang báo qua ảnh lỗi thật — "TypeError: null is not an object
    // (evaluating 'sideLeftContainer.classList')" lúc bấm Play): components/app-view-stack.js định
    // nghĩa TPL_APP_VIEW_STACK_OPEN/_CLOSE (khung #side-left-container bọc chung Playlist+Settings,
    // xem docstring đầu file đó) NHƯNG danh sách mount dưới đây CHƯA BAO GIỜ được cập nhật để thực
    // sự chèn 2 biến này — #side-left-container do đó KHÔNG TỒN TẠI trong DOM, mọi nơi gọi
    // sideLeftContainer.classList (core/player-controls.js, core/visualizer/visualizer-display.js)
    // ném ReferenceError/TypeError ngay khi được gọi. SỬA: bọc TPL_APP_VIEW_STACK_OPEN/_CLOSE quanh
    // ĐÚNG 2 trang cạnh nhau bên trong nó — TPL_PLAYLIST_VIEW rồi TPL_SETTINGS_DRAWER, KHÔNG có gì
    // chen giữa 2 template này (đúng yêu cầu "2 trang cạnh nhau cuộn qua lại" trong 1 flex container)
    // — dời TPL_SETTINGS_DRAWER từ vị trí cũ (sau TPL_BOTTOM_PLAYER) lên ngay sau TPL_PLAYLIST_VIEW.
    // Vị trí TPL_APP_VIEW_STACK_OPEN/_CLOSE trong chuỗi tổng không quan trọng cho stacking (container
    // là `fixed` + `z-[60]` tự quyết định lớp hiển thị, không phụ thuộc thứ tự DOM).
    appRoot.innerHTML =
        TPL_LOADING_SHIELD +
        TPL_APP_VIEW_STACK_OPEN +
        TPL_PLAYLIST_VIEW +
        TPL_SETTINGS_DRAWER +
        TPL_APP_VIEW_STACK_CLOSE +
        TPL_VISUALIZER_OVERLAY +
        // TPL_SUBTITLE_MODAL ĐÃ BỎ (10/07/2026) — Subtitle Editor chuyển sang trang riêng
        // (subtitle-editor.html), không còn modal ở trang chính.
        TPL_BOTTOM_PLAYER +
        // Batch D5 (Settings restructure, 06/07/2026) — TPL_FILE_MANAGER_SONG_DRAWER/
        // _FOLDER_DETAIL_DRAWER ĐÃ BỎ khỏi mount tĩnh: nội dung giờ là 2 HÀM
        // (components/file-manager.js::renderFileManagerSongPanelBody()/
        // renderFileManagerFolderDetailPanelBody()), PUSH ĐỘNG vào ngăn xếp (2 cấp) — xem
        // event/workflow/file-manager-song.js::openPanel()/openFolderDetail().
        // Batch D6 (Settings restructure, 06/07/2026) — TPL_FILE_MANAGER_PHOTO_DRAWER ĐÃ BỎ khỏi
        // mount tĩnh: nội dung giờ là 1 HÀM (components/file-manager.js::
        // renderFileManagerPhotoPanelBody()), PUSH ĐỘNG (fullBleed) — xem event/workflow/file-
        // manager-photo.js::openPanel().
        // Batch D7 (06/07/2026, BATCH CUỐI Nhóm D restructure) — TPL_FILE_MANAGER_DOCUMENT_DRAWER
        // ĐÃ BỎ khỏi mount tĩnh: nội dung giờ là 1 HÀM (components/file-manager.js::
        // renderFileManagerDocumentPanelBody()), PUSH ĐỘNG — xem event/workflow/file-manager-
        // document.js::openPanel(). CẢ 4 khu vực File Manager (Song/Folder Detail/Photo/Documents)
        // giờ ĐỀU là panel động — KHÔNG còn TPL_FILE_MANAGER_* nào mount tĩnh ở đây nữa.
        // Batch D4 (Settings restructure, 06/07/2026) — TPL_SLIDESHOW_SETTINGS_DRAWER ĐÃ BỎ khỏi
        // mount tĩnh (nội dung giờ là renderSlideshowPanelBody(), push động — xem event/workflow/
        // slideshow.js::openPanel()).
        // ĐÃ GỠ (Giai đoạn 4, rewrite Photo/Album, mục 1 — Giang yêu cầu "bỏ modal đi mà áp dụng
        // gentic drawer") — TPL_SLIDESHOW_ALBUM_PICKER (panel chọn Album kiểu "notify center", mount
        // tĩnh) KHÔNG còn — panel chọn Album Slideshow giờ dùng Generic Drawer ĐỘNG, xem
        // event/workflow/slideshow.js::openAlbumPicker().
        // Nhóm A (10/07/2026, plan-v12-extended.md mục 2) — TPL_DOCUMENT_READER/
        // TPL_DOCUMENT_PICKER_DRAWER CŨ ĐÃ BỎ (components/document-reader.js/
        // document-picker-drawer.js đã xoá) — THAY bằng 1 khung TRẮNG dùng CHUNG duy nhất cho cả
        // Document List+Reader, xem components/generic-drawer.js.
        TPL_GENERIC_DRAWER;
})();
