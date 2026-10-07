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
            ${iconSvg('folder')}
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.folder">${t('appPanelNav.tab.folder')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="storage">
            ${iconSvg('storage')}
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.storage">${t('appPanelNav.tab.storage')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="game">
            <span class="relative inline-flex w-[26px] h-[26px] shrink-0">
                ${iconSvg('gamepad', 'w-full h-full', 'id="app-bottom-nav-game-icon-idle"')}
                ${iconSvg('gamepad-playing', 'hidden absolute inset-0 w-full h-full', 'id="app-bottom-nav-game-icon-playing"')}
                <span id="app-bottom-nav-game-dot" class="hidden app-bottom-nav-game-dot"></span>
            </span>
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.game">${t('appPanelNav.tab.game')}</span>
        </button>
        <button class="app-bottom-nav-btn" data-tab="statis">
            ${iconSvg('statistics')}
            <span class="app-bottom-nav-label" data-i18n="appPanelNav.tab.statis">${t('appPanelNav.tab.statis')}</span>
        </button>
    </div>
`;
