/**
 * Component: Storage Management Drawer (ngăn kéo "Quản lý dung lượng" — mục 5)
 * Biến này chứa chuỗi HTML, được main.js chèn vào DOM lúc khởi động.
 * Mở chồng lên About (z-[90]) theo đúng kiểu navigation stack: Settings (z-[80]) -> About
 * (z-[90]) -> Quản lý dung lượng (z-[100]). Back ở đây chỉ ẩn drawer này, không động tới
 * About hay Settings bên dưới.
 */
const TPL_STORAGE_DRAWER = `
    <div id="drawer-storage" class="fixed inset-0 drawer-glass z-[100] transform translate-y-full transition-transform duration-500 ease-in-out flex flex-col">
        <div class="flex justify-between items-center px-4 py-3 sm:px-6 border-b border-white/10 shrink-0 bg-black/40">
            <div class="flex items-center gap-2">
                <button id="btn-back-storage" class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white" data-i18n-title="storageDrawer.backToAbout.title" title="${t('storageDrawer.backToAbout.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 class="text-base sm:text-lg font-bold tracking-wider text-white uppercase" data-i18n="storageDrawer.title">${t('storageDrawer.title')}</h2>
            </div>
        </div>

        <div class="flex-grow overflow-y-auto px-4 py-6 sm:px-8 pb-20">
            <div class="max-w-2xl mx-auto space-y-8">

                <!-- SECTION: THỐNG KÊ DUNG LƯỢNG -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="storageDrawer.statsSectionTitle">${t('storageDrawer.statsSectionTitle')}</h3>
                    <div class="bg-white/5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <span class="text-sm font-medium text-slate-300" data-i18n="storageDrawer.statTotalSongs">${t('storageDrawer.statTotalSongs')}</span>
                            <span id="stat-storage-total-songs" class="text-sm font-mono text-sky-300">—</span>
                        </div>
                        <div class="flex justify-between items-center p-4">
                            <span class="text-sm font-medium text-slate-300" data-i18n="storageDrawer.statTotalBytes">${t('storageDrawer.statTotalBytes')}</span>
                            <span id="stat-storage-total-bytes" class="text-sm font-mono text-sky-300">—</span>
                        </div>
                    </div>
                </div>

                <!-- SECTION: GIẢI PHÓNG BỘ NHỚ -->
                <div>
                    <h3 class="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2 ml-2" data-i18n="storageDrawer.freeSpaceSectionTitle">${t('storageDrawer.freeSpaceSectionTitle')}</h3>
                    <div class="bg-white/5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                        <button id="btn-storage-download-then-clear" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                            <div>
                                <div class="text-sm font-medium text-emerald-300" data-i18n="storageDrawer.downloadThenClear.label">${t('storageDrawer.downloadThenClear.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="storageDrawer.downloadThenClear.hint">${t('storageDrawer.downloadThenClear.hint')}</div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-8-4V4m0 0L8 8m4-4l4 4" /></svg>
                        </button>
                        <button id="btn-storage-clear-no-download" class="flex justify-between items-center p-4 hover:bg-rose-500/10 transition-colors w-full text-left">
                            <div>
                                <div class="text-sm font-medium text-rose-400" data-i18n="storageDrawer.clearNoDownload.label">${t('storageDrawer.clearNoDownload.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="storageDrawer.clearNoDownload.hint">${t('storageDrawer.clearNoDownload.hint')}</div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </div>

                <!-- SECTION: DỌN FILE LỖI -->
                <div>
                    <h3 class="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2 ml-2" data-i18n="storageDrawer.brokenSectionTitle">${t('storageDrawer.brokenSectionTitle')}</h3>
                    <div class="bg-white/5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                        <button id="btn-storage-scan-broken" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                            <div>
                                <div class="text-sm font-medium" data-i18n="storageDrawer.scanBroken.label">${t('storageDrawer.scanBroken.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="storageDrawer.scanBroken.hint">${t('storageDrawer.scanBroken.hint')}</div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
                        </button>
                        <div id="storage-scan-result" class="hidden border-t border-white/5 p-4 flex flex-col gap-3">
                            <p id="storage-scan-summary" class="text-sm text-slate-300"></p>
                            <div id="storage-scan-list" class="flex flex-col gap-1.5 max-h-48 overflow-y-auto text-xs text-slate-400"></div>
                            <div class="flex gap-3 mt-1">
                                <button id="btn-storage-delete-broken" class="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-sm font-semibold transition-colors" data-i18n="storageDrawer.btnDeleteBroken">${t('storageDrawer.btnDeleteBroken')}</button>
                                <button id="btn-storage-dismiss-scan" class="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors" data-i18n="storageDrawer.btnDismissScan">${t('storageDrawer.btnDismissScan')}</button>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    </div>
`;
