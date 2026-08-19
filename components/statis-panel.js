/**
 * components/statis-panel.js — Statis, MỚI (đợt tái cấu trúc bottom nav) — placeholder full-screen,
 * NGANG CẤP Photo/Setting. Chưa có logic gì — chỉ hiện tiêu đề + nút Close, xem
 * event/workflow/placeholder-panels.js.
 */
const TPL_STATIS_PANEL = `
    <div id="statis-panel" class="hidden flex flex-col items-center justify-center" style="z-index: 128;">
        <div class="absolute top-0 left-0 right-0 flex items-center justify-center px-14 py-3 sm:px-16 h-14">
            <h2 class="text-base sm:text-lg font-semibold text-white truncate text-center" data-i18n="statisPanel.title">${t('statisPanel.title')}</h2>
            <button id="btn-statis-panel-close" class="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-rose-500 transition-colors text-white shrink-0"><svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>
        <p class="text-sm text-slate-400" data-i18n="statisPanel.comingSoon">${t('statisPanel.comingSoon')}</p>
    </div>
`;
