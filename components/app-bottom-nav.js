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
            <svg xmlns="http://www.w3.org/2000/svg" class="" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9h.01M15 9h.01M9 15c1 1 5 1 6 0M7 5h10a5 5 0 015 5v4a5 5 0 01-5 5H7a5 5 0 01-5-5v-4a5 5 0 015-5z" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.game">${t('appPanelNav.tab.game')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="statis">
            <svg xmlns="http://www.w3.org/2000/svg" class="" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6m4 6V5m4 14v-9M5 19h14" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.statis">${t('appPanelNav.tab.statis')}</span>
        </button>
    </div>
`;
