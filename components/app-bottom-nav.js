/**
 * components/app-bottom-nav.js — Bottom nav CỐ ĐỊNH của App Panel (đợt tái cấu trúc bottom nav —
 * 5 mục Media/Folder/Storage/Game/Statis). Icon phía trên, tên phía dưới, cuộn ngang nếu tràn (xem
 * #app-bottom-nav ở assets/css/layout-nav.css).
 *
 * SỬA (Giang yêu cầu "loại bỏ photo, setting ở nav bottom") — 2 nút Photo/Setting BỎ HẲN khỏi
 * thanh nav (còn 5/7 mục cũ). Photo: đã hợp nhất vào Playlist làm 1 Nguồn (activeMediaSource=
 * 'photo', xem event/workflow/playlist.js::switchToPhotoSource()) — không còn cần entry riêng.
 * Setting: KHÔNG còn điểm vào nào khác trong UI sau khi bỏ nút này (trước đây CHỈ mở qua đây, xem
 * event/workflow/app-panel-nav.js::openSetting()) — router/workflow/listener của cả 2 (`photo`/
 * `setting` case trong event/router/app-panel-nav.js, workflowAppPanelNav.openPhoto()/
 * openSetting()) GIỮ NGUYÊN không xoá (Rule 0.5 — vô hại, không còn gì gọi tới, phòng khi cần nối
 * lại điểm vào khác sau này).
 *
 * Media = Home Screen mặc định của App Panel (nội dung #playlist-view LUÔN đứng dưới, các mục còn
 * lại đều là overlay full-screen/Generic Drawer đè lên trên, đóng lại thì về Media) — xem
 * event/workflow/app-panel-nav.js.
 *
 * `data-tab` trên mỗi nút — DUY NHẤT nguồn để Listener (event/listener/app-panel-nav.js) biết gửi
 * đúng msg.type nào, KHÔNG hardcode id riêng biệt.
 *
 * `#app-bottom-nav-game-dot` — MỚI (02/09/2026, Giang yêu cầu "icon game ở nav phải biểu thị đang ở
 * game mode"). Chấm TĨNH (mount sẵn, `hidden` mặc định) đè góc icon nút Game — hiện/ẩn + đổi màu
 * đỏ/xanh qua `classList.toggle(...)` (core/app-panel-nav.js::setAppBottomNavGameIndicator(), gọi từ
 * event/workflow/game-catalog.js::renderList() MỖI lần armed/disarm/đổi `gameplayPhase`) — KHÔNG
 * phải template render lại, chỉ class toggle trên phần tử có sẵn, đúng khuôn `.hidden` dùng xuyên
 * suốt project.
 *
 * `#app-bottom-nav-game-icon-idle`/`#app-bottom-nav-game-icon-playing` — [SỬA cùng ngày, Giang yêu
 * cầu "khi playgame cần chuyển sang icon máy chơi game cầm tay + nút chấm xanh"] 2 icon XẾP CHỒNG
 * (`absolute inset-0` trên icon thứ 2, span cha `relative`), CHỈ 1 hiện tại 1 thời điểm (class
 * `hidden` toggle qua ĐÚNG hàm trên) — icon thường (mask/game tổng quát, giữ nguyên icon gốc) và
 * icon máy chơi game cầm tay (D-pad + 2 nút bấm) RIÊNG cho lúc `gameplayPhase` khác 'idle' (đang
 * chơi thật, xem docstring setAppBottomNavGameIndicator()).
 *
 * Icon SVG bọc trong `<span class="relative inline-flex">` để chấm định vị `absolute` đúng góc icon
 * (CSS `.app-bottom-nav-btn svg` vẫn khớp bình thường — selector là descendant, không quan tâm độ
 * sâu).
 *
 * NẠP TRƯỚC: main.js (mount vào #app-root, NGAY SAU #side-left-container, xem components/
 * app-view-stack.js).
 */
const TPL_APP_BOTTOM_NAV = `
    <div id="app-bottom-nav">
        <button class="app-bottom-nav-btn active" data-tab="media">
            <svg xmlns="http://www.w3.org/2000/svg" class="" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.media">${t('appPanelNav.tab.media')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="folder">
            <svg xmlns="http://www.w3.org/2000/svg" class="" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.folder">${t('appPanelNav.tab.folder')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="storage">
            <svg xmlns="http://www.w3.org/2000/svg" class="" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.storage">${t('appPanelNav.tab.storage')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="game">
            <span class="relative inline-flex">
                <svg id="app-bottom-nav-game-icon-idle" xmlns="http://www.w3.org/2000/svg" class="" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9h.01M15 9h.01M9 15c1 1 5 1 6 0M7 5h10a5 5 0 015 5v4a5 5 0 01-5 5H7a5 5 0 01-5-5v-4a5 5 0 015-5z" /></svg>
                <svg id="app-bottom-nav-game-icon-playing" class="hidden absolute inset-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h10a5 5 0 015 4.7l.4 4.3a2.5 2.5 0 01-4.5 1.7l-1.1-1.5a2 2 0 00-1.6-.8H8.8a2 2 0 00-1.6.8l-1.1 1.5a2.5 2.5 0 01-4.5-1.7l.4-4.3A5 5 0 017 7z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7.5 10v3M6 11.5h3" /><circle cx="16" cy="10.5" r="1" fill="currentColor" stroke="none" /><circle cx="18.2" cy="12.7" r="1" fill="currentColor" stroke="none" /></svg>
                <span id="app-bottom-nav-game-dot" class="hidden app-bottom-nav-game-dot"></span>
            </span>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.game">${t('appPanelNav.tab.game')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="statis">
            <svg xmlns="http://www.w3.org/2000/svg" class="" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6m4 6V5m4 14v-9M5 19h14" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.statis">${t('appPanelNav.tab.statis')}</span>
        </button>
    </div>
`;
