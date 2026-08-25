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
    // File Manager không còn overlay/drawer riêng nào mount tĩnh ở đây — Song/Folder Detail/
    // Documents đều là panel động PUSH vào Settings Stack (xem event/workflow/file-manager-*.js);
    // Photo đã hợp nhất vào Playlist làm 1 Source, không còn panel riêng nào cả (components/
    // file-manager.js — từng chứa renderFileManagerPhotoPanelBody() cho panel đó — đã xoá hẳn).
    // Settings/About/Subtitle Settings/Slideshow Settings cũng đều là panel động qua Generic
    // Drawer (event/workflow/app-settings.js) hoặc Settings Stack — không còn TPL_*_DRAWER nào
    // mount tĩnh cho các khu vực này.
    // TPL_GAME_PANEL/TPL_STATIS_PANEL — 2 khung full-screen NGANG CẤP #app-stack (không lồng bên
    // trong), đặt SAU TPL_APP_VIEW_STACK_CLOSE, TRƯỚC TPL_VISUALIZER_OVERLAY — thứ tự DOM không
    // quan trọng cho stacking (đều z-index riêng qua style inline/CSS, xem assets/css/
    // layout-nav.css).
    appRoot.innerHTML =
        TPL_LOADING_SHIELD +
        TPL_APP_VIEW_STACK_OPEN +
        TPL_PLAYLIST_VIEW +
        TPL_APP_VIEW_STACK_CLOSE_SIDE +
        TPL_APP_BOTTOM_NAV +
        TPL_APP_VIEW_STACK_CLOSE_OUTER +
        TPL_GAME_PANEL +
        TPL_STATIS_PANEL +
        TPL_VISUALIZER_OVERLAY +
        TPL_BOTTOM_PLAYER +
        TPL_GENERIC_DRAWER;
})();
