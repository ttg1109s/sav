/**
 * components/app-bottom-nav.js — Bottom nav CỐ ĐỊNH của App Panel (MỚI, đợt tái cấu trúc bottom
 * nav — 7 mục Media/Folder/Photo/Storage/Game/Statis/Setting). Icon phía trên, tên phía dưới, cuộn
 * ngang nếu tràn (xem #app-bottom-nav ở assets/css/layout-nav.css).
 *
 * Media = Home Screen mặc định của App Panel (nội dung #playlist-view LUÔN đứng dưới, các mục còn
 * lại đều là overlay full-screen/Generic Drawer đè lên trên, đóng lại thì về Media) — xem
 * event/workflow/app-panel-nav.js.
 *
 * `data-tab` trên mỗi nút — DUY NHẤT nguồn để Listener (event/listener/app-panel-nav.js) biết gửi
 * đúng msg.type nào, KHÔNG hardcode 7 id riêng biệt.
 *
 * NẠP TRƯỚC: main.js (mount vào #app-root, NGAY SAU #side-left-container, xem components/
 * app-view-stack.js).
 */
const TPL_APP_BOTTOM_NAV = `
    <div id="app-bottom-nav">
        <button class="app-bottom-nav-btn active" data-tab="media">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.media">${t('appPanelNav.tab.media')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="folder">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.folder">${t('appPanelNav.tab.folder')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="photo">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.photo">${t('appPanelNav.tab.photo')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="storage">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.storage">${t('appPanelNav.tab.storage')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="game">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9h.01M15 9h.01M9 15c1 1 5 1 6 0M7 5h10a5 5 0 015 5v4a5 5 0 01-5 5H7a5 5 0 01-5-5v-4a5 5 0 015-5z" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.game">${t('appPanelNav.tab.game')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="statis">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6m4 6V5m4 14v-9M5 19h14" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.statis">${t('appPanelNav.tab.statis')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="setting">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.setting">${t('appPanelNav.tab.setting')}</span>
        </button>
    </div>
`;
