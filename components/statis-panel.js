/**
 * components/statis-panel.js — Statis, NGANG CẤP Game (bottom nav App Panel). SỬA (Giang yêu cầu
 * "tích hợp 1+2+3" — stat-grid tổng quan + card so sánh Song/Video/Photo + Top list) — khung TĨNH
 * (Rule 5d) giữ NGUYÊN chỉ còn header + nút Close; phần "coming soon" cũ ĐÃ XOÁ, thay bằng
 * `#statis-panel-body` — container RỖNG, nội dung THẬT SỰ (3 khối kể trên) là DATA ĐỘNG (đọc toàn
 * bộ thư viện + mediaStatsMap) nên KHÔNG thuộc template tĩnh ở đây — dựng bởi
 * core/statis-panel-ui.js::buildStatisPanelBodyHtml(), đổ vào qua `.innerHTML` bởi
 * event/workflow/statis-panel.js::renderContent() mỗi lần mở panel hoặc đổi sort/filter — CÙNG
 * khuôn hệt `components/game-panel.js`.
 */
const TPL_STATIS_PANEL = `
    <div id="statis-panel" class="hidden flex flex-col" style="z-index: 128;" data-uitk="panelBg">
        <div class="absolute top-0 left-0 right-0 flex items-center justify-center px-14 py-3 sm:px-16 h-14 z-10 border-b" data-uitk="dividerBorder">
            <h2 class="text-base sm:text-lg font-semibold truncate text-center" data-uitk="textPrimary" data-i18n="statisPanel.title">${t('statisPanel.title')}</h2>
            <button id="btn-statis-panel-close" class="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-rose-500 hover:text-white transition-colors shrink-0" data-uitk="textPrimary"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <div id="statis-panel-body" class="flex-1 overflow-y-auto pt-14 px-4 pb-6"></div>
    </div>
`;
