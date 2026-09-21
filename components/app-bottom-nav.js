/**
 * components/app-bottom-nav.js — Bottom nav CỐ ĐỊNH của App Panel (đợt tái cấu trúc bottom nav —
 * 4 mục Folder/Storage/Game/Statis). Icon phía trên, tên phía dưới, chia đều chiều ngang, cuộn ngang
 * nếu màn quá hẹp (xem #app-bottom-nav ở assets/css/layout-nav.css).
 *
 * SỬA (21/09/2026, Giang yêu cầu "loại bỏ media ở nav bottom") — nút Media BỎ HẲN khỏi thanh nav (còn
 * 4/5 mục). Media vẫn là Home Screen mặc định (xem đoạn dưới) nên KHÔNG cần nút riêng: mọi overlay
 * (Folder/Storage/Game/Statis) đóng lại đều tự về Media. Khi đứng ở Home, `appPanelActiveTab` vẫn là
 * 'media' nhưng KHÔNG nút nào khớp -> cả 4 nút cùng màu "không active" (đúng ý: Home không thuộc mục nào).
 * DỌN DEADCODE 21/09/2026: case 'appPanelNav.media.click' + workflowAppPanelNav.openMedia() (và case 'setting'/openSetting) ĐÃ XOÁ khỏi router/workflow — không còn nút nào gửi tới.
 */
const TPL_APP_BOTTOM_NAV = `
    <div id="app-bottom-nav" class="border-t" data-uitk="dividerBorder">
        <button class="app-bottom-nav-btn" data-tab="folder">
            <svg xmlns="http://www.w3.org/2000/svg" class="" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.folder">${t('appPanelNav.tab.folder')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="storage">
            <svg xmlns="http://www.w3.org/2000/svg" class="" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" /></svg>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.storage">${t('appPanelNav.tab.storage')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="game">
            <span class="relative inline-flex w-[26px] h-[26px] shrink-0">
                <svg id="app-bottom-nav-game-icon-idle" xmlns="http://www.w3.org/2000/svg" class="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 9h.01M15 9h.01M9 15c1 1 5 1 6 0M7 5h10a5 5 0 015 5v4a5 5 0 01-5 5H7a5 5 0 01-5-5v-4a5 5 0 015-5z" /></svg>
                <svg id="app-bottom-nav-game-icon-playing" class="hidden absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h10a5 5 0 015 4.7l.4 4.3a2.5 2.5 0 01-4.5 1.7l-1.1-1.5a2 2 0 00-1.6-.8H8.8a2 2 0 00-1.6.8l-1.1 1.5a2.5 2.5 0 01-4.5-1.7l.4-4.3A5 5 0 017 7z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7.5 10v3M6 11.5h3" /><circle cx="16" cy="10.5" r="1" fill="currentColor" stroke="none" /><circle cx="18.2" cy="12.7" r="1" fill="currentColor" stroke="none" /></svg>
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
