/**
 * components/game-panel.js — Game, NGANG CẤP Statis (bottom nav App Panel). [SỬA — 02/09/2026,
 * Giang yêu cầu "nối game mode vào game overlay đang coming soon"] Khung TĨNH (Rule 5d — không đổi
 * giữa các lần mở/đóng) giữ NGUYÊN chỉ còn header + nút Close; phần "coming soon" cũ ĐÃ XOÁ, thay
 * bằng `#game-panel-list` — container RỖNG, nội dung THẬT SỰ (danh sách card game kiểu appstore) là
 * DATA ĐỘNG (số lượng game trong catalog, trạng thái armed/playing của từng card) nên KHÔNG thuộc
 * template tĩnh ở đây — dựng bởi core/gameplay/game-panel-ui.js::buildGamePanelListHtml(), đổ vào
 * qua `.innerHTML` bởi event/workflow/game-catalog.js::renderList() mỗi lần mở panel hoặc đổi
 * trạng thái armed/độ khó (đúng khuôn Rule 5d: "phần thật sự khác theo từng instance" render bằng
 * hàm Core-ui, không nội suy cứng vào chuỗi TPL_*).
 */
const TPL_GAME_PANEL = `
    <div id="game-panel" class="hidden flex flex-col" style="z-index: 128;">
        <div class="absolute top-0 left-0 right-0 flex items-center justify-center px-14 py-3 sm:px-16 h-14 z-10">
            <h2 class="text-base sm:text-lg font-semibold text-white truncate text-center" data-i18n="gamePanel.title">${t('gamePanel.title')}</h2>
            <button id="btn-game-panel-close" class="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-rose-500 transition-colors text-white shrink-0"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div id="game-panel-list" class="flex-1 overflow-y-auto pt-14"></div>
    </div>
`;
