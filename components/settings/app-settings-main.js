/**
 * components/settings/app-settings-main.js — Nội dung màn Main của Setting + helper dùng chung cho
 * mọi màn danh sách row (System, Visualizer Screen...).
 *
 * SỬA (phản hồi Giang mục 4 — "styling lại toàn bộ generic drawer setting, tham khảo EQ/Custom
 * Effect") — bỏ hẳn bảng màu TỐI (`glass-modal`/`border-white/5`) từng dùng ở đây — ĐÚNG bảng màu
 * SÁNG mà components/eq-presets-drawer.js/custom-effect-drawer.js đã dùng (Generic Drawer thuộc
 * vùng LOẠI TRỪ theme, nền LUÔN TRẮNG — xem docstring components/generic-drawer.js): card
 * `bg-slate-50 border border-slate-200`, text `text-slate-900/500/400`, icon nhấn `text-sky-500`.
 *
 * 5 row Main: Playlist/System/Visualizer Screen/Troubleshooting/Reset app — mỗi row
 * `data-app-settings-nav="<key>"`, click do `event/workflow/app-settings.js` tự delegate qua
 * core/app-settings-ui.js (Rule 5d — hàm chỉ trả chuỗi HTML thuần, KHÔNG addEventListener ở đây).
 */
function renderAppSettingsMainBody() {
    const rows = [
        { key: 'playlist', icon: 'M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z', labelKey: 'appSettings.row.playlist' },
        { key: 'system', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2z', labelKey: 'appSettings.row.system' },
        { key: 'visualizerScreen', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM8 21h8m-4-4v4', labelKey: 'appSettings.row.visualizerScreen' },
        { key: 'troubleshooting', icon: 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z', labelKey: 'appSettings.row.troubleshooting' },
        { key: 'resetApp', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', labelKey: 'appSettings.row.resetApp' },
    ];
    return renderAppSettingsRowList(rows);
}

/** Khuôn row dùng CHUNG cho MỌI màn danh sách của Setting (Main/System/Visualizer Screen...) —
 * ĐÚNG khuôn `renderEqListBody()` (components/eq-presets-drawer.js): mỗi row 1 card
 * `bg-slate-50 border border-slate-200 rounded-2xl`, không còn danh sách "dính liền" bọc trong 1
 * khối lớn như bản glass-modal cũ.
 * @param {{key:string, icon:string, labelKey:string, hintKey?:string}[]} rows */
function renderAppSettingsRowList(rows) {
    return rows.map((row) => `
        <button type="button" data-app-settings-nav="${row.key}" class="w-full text-left px-4 py-3.5 rounded-2xl mb-2 flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors">
            <div class="flex items-center gap-3 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-sky-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${row.icon}" /></svg>
                <div class="min-w-0">
                    <div class="text-sm font-semibold text-slate-800 truncate">${t(row.labelKey)}</div>
                    ${row.hintKey ? `<div class="text-xs text-slate-400 mt-0.5 truncate">${t(row.hintKey)}</div>` : ''}
                </div>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>
    `).join('');
}
