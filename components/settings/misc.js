/**
 * Component (sub-template): Settings Drawer — Section "Khác".
 * Tách từ js/components/settings-drawer.js (ver 8). Toggle "Giữ màn hình sáng" (wake lock) +
 * nút mở About Drawer ("Về trình phát").
 *
 * Ver 10 refine (bổ sung): thêm SECTION "Khắc phục sự cố" — 2 nút dành cho lúc trình phát gặp lỗi/
 * hành vi không bình thường (treo, kẹt khoá shield, UI lệch state...) mà người dùng không biết
 * chỉnh gì khác ngoài tự F5: "Khởi động lại app" (dọn state RAM tạm rồi reload — xem
 * js/core/app-recovery.js, KHÔNG đụng tới nhạc/playlist/cài đặt) và "Khôi phục cài đặt mặc định"
 * (CHỈ reset vizConfig — màu sắc/hiệu ứng/EQ/v.v. — về DEFAULT_VIZ_CONFIG, GIỮ NGUYÊN nhạc/playlist
 * đã upload, vì đó là dữ liệu người dùng tốn công thêm vào, không nên mất chỉ vì muốn reset giao
 * diện). Cả 2 đều hỏi xác nhận trước khi thực hiện (modalChoice(), tránh bấm nhầm).
 */
const TPL_SETTINGS_MISC = `

        <!-- SECTION: VỀ TRÌNH PHÁT -->
        <div>
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-2" data-i18n="settingsMisc.sectionTitle">${t('settingsMisc.sectionTitle')}</h3>
            <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                <div class="flex justify-between items-center p-4 border-b border-white/5">
                    <div class="pr-3">
                        <div class="text-sm font-medium truncate" data-i18n="settingsMisc.keepScreenOn.label">${t('settingsMisc.keepScreenOn.label')}</div>
                        <div class="text-xs text-slate-400 mt-0.5" data-i18n="settingsMisc.keepScreenOn.hint">${t('settingsMisc.keepScreenOn.hint')}</div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" id="setting-keep-screen-on" class="sr-only peer" checked>
                        <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                    </label>
                </div>
                <button id="setting-open-about" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span class="text-sm font-medium truncate" data-i18n="settingsMisc.openAbout.label">${t('settingsMisc.openAbout.label')}</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        </div>

        <!-- SECTION: GAME MODE (MỚI 16/08/2026) — bật/tắt tự động mở overlay Game khi vào
             Visualizer bằng cách chọn bài/Play/Shuffle (KHÔNG còn nút riêng ở Control Center, xem
             event/router/visual-bg.js case 'visualBg.songChanged'). Đặt ở Settings (SỬA 16/08/2026,
             Giang chốt lại — trước đó đặt nhầm thành nút icon trong Control Center). -->
        <div>
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-2">GAME MODE</h3>
            <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                <div class="flex justify-between items-center p-4">
                    <div class="pr-3">
                        <div class="text-sm font-medium truncate">Tự mở Game khi phát nhạc</div>
                        <div class="text-xs text-slate-400 mt-0.5">Chọn bài / bấm Play / Shuffle sẽ tự mở overlay Circle ở màn Visualizer</div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" id="setting-gameplay-mode-enabled" class="sr-only peer">
                        <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                    </label>
                </div>
            </div>
        </div>

        <!-- SECTION: KHẮC PHỤC SỰ CỐ (mới) — xem js/core/app-recovery.js -->
        <div>
            <h3 class="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2 ml-2" data-i18n="settingsMisc.troubleshootTitle">${t('settingsMisc.troubleshootTitle')}</h3>
            <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                <!-- MỚI (18/07/2026, Giang yêu cầu — xem log console ngay trong app, không cần
                     DevTools thật, hữu ích lúc test mobile — xem core/debug-console.js). Đặt ĐẦU
                     tiên trong section này — xem log thường là bước debug ĐẦU TIÊN trước khi quyết
                     định khởi động lại/khôi phục mặc định/xoá cache. -->
                <button id="setting-open-debug-console" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span class="text-sm font-medium truncate" data-i18n="settingsMisc.openDebugConsole.label">${t('settingsMisc.openDebugConsole.label')}</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
                <button id="setting-restart-app" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="pr-3">
                        <div class="text-sm font-medium truncate" data-i18n="settingsMisc.restartApp.label">${t('settingsMisc.restartApp.label')}</div>
                        <div class="text-xs text-slate-400 mt-0.5" data-i18n="settingsMisc.restartApp.hint">${t('settingsMisc.restartApp.hint')}</div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </button>
                <button id="setting-restore-defaults" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="pr-3">
                        <div class="text-sm font-medium truncate" data-i18n="settingsMisc.restoreDefaults.label">${t('settingsMisc.restoreDefaults.label')}</div>
                        <div class="text-xs text-slate-400 mt-0.5" data-i18n="settingsMisc.restoreDefaults.hint">${t('settingsMisc.restoreDefaults.hint')}</div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
                <!-- MỚI (14/07/2026, Giang yêu cầu — "nút xoá cache js/css cho page") -->
                <button id="setting-clear-cache" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="pr-3">
                        <div class="text-sm font-medium truncate" data-i18n="settingsMisc.clearCache.label">${t('settingsMisc.clearCache.label')}</div>
                        <div class="text-xs text-slate-400 mt-0.5" data-i18n="settingsMisc.clearCache.hint">${t('settingsMisc.clearCache.hint')}</div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </div>
`;

