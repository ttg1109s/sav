/**
 * components/settings/app-settings-main.js — Nội dung màn Main của Setting (đợt tái cấu trúc bottom
 * nav App Panel + phân phối lại section, phản hồi Giang). 5 row: Playlist/System/Visualizer
 * Screen/Troubleshooting/Reset app — mỗi row `data-app-settings-nav="<key>"`, click do
 * `event/workflow/app-settings.js` tự delegate (KHÔNG addEventListener ở đây — Rule 5d, hàm chỉ
 * trả chuỗi HTML thuần).
 *
 * Đúng Rule 5d — gọi lại MỖI LẦN mở (không phải TPL_* tĩnh) vì nội suy `t()` mỗi lần.
 */
function renderAppSettingsMainBody() {
    const rows = [
        { key: 'playlist', icon: 'M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z', labelKey: 'appSettings.row.playlist' },
        { key: 'system', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z', labelKey: 'appSettings.row.system' },
        { key: 'visualizerScreen', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM8 21h8m-4-4v4', labelKey: 'appSettings.row.visualizerScreen' },
        { key: 'troubleshooting', icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z', labelKey: 'appSettings.row.troubleshooting' },
        { key: 'resetApp', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', labelKey: 'appSettings.row.resetApp' },
    ];
    const rowsHtml = rows.map((row, idx) => `
        <button type="button" data-app-settings-nav="${row.key}" class="flex justify-between items-center p-4 ${idx < rows.length - 1 ? 'border-b border-white/5' : ''} w-full text-left hover:bg-white/5 transition-colors">
            <div class="flex items-center gap-3 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-sky-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${row.icon}" /></svg>
                <span class="text-sm font-medium truncate" data-i18n="${row.labelKey}">${t(row.labelKey)}</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>
    `).join('');
    return `<div class="glass-modal rounded-2xl flex flex-col overflow-hidden">${rowsHtml}</div>`;
}

/** Dùng lại cho màn "System" (Theme/Gesture/Slideshow/Language) — CÙNG khuôn row trên, tham số hoá
 * để không lặp code. @param {{key:string, icon:string, labelKey:string, hintKey?:string}[]} rows */
function renderAppSettingsRowList(rows) {
    const rowsHtml = rows.map((row, idx) => `
        <button type="button" data-app-settings-nav="${row.key}" class="flex justify-between items-center p-4 ${idx < rows.length - 1 ? 'border-b border-white/5' : ''} w-full text-left hover:bg-white/5 transition-colors">
            <div class="flex items-center gap-3 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-sky-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${row.icon}" /></svg>
                <div class="min-w-0">
                    <div class="text-sm font-medium truncate" data-i18n="${row.labelKey}">${t(row.labelKey)}</div>
                    ${row.hintKey ? `<div class="text-xs text-slate-400 mt-0.5 truncate" data-i18n="${row.hintKey}">${t(row.hintKey)}</div>` : ''}
                </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>
    `).join('');
    return `<div class="glass-modal rounded-2xl flex flex-col overflow-hidden">${rowsHtml}</div>`;
}
