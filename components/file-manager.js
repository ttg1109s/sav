/**
 * components/file-manager.js — 3 drawer con của File Manager (Song/Photo & Album/Documents),
 * ver 12 "Multi Media". CHỐT LẠI 03/07/2026 (xem plan-v12-multimedia-decisions.md mục 1a/7,
 * đè lên quyết định ban đầu ở patch 02/07/2026):
 *
 * KHÔNG còn 1 overlay "File Manager" cấp cao với tab-bar 4 mục nữa. File Manager giờ chỉ là 1
 * SECTION bình thường trong Settings (xem components/settings/file-manager-section.js —
 * TPL_SETTINGS_FILE_MANAGER, 3 hàng Song/Photo & Album/Documents), mỗi hàng bấm vào PUSH THẲNG
 * sang 1 trong 3 drawer con định nghĩa ở file này — đúng pattern navigation stack đã có sẵn cho
 * About Drawer (components/about-drawer.js) / Visualizer Settings Drawer
 * (components/visualizer-settings-drawer.js): z-[90], transform translate-y-full, nút Back (mũi
 * tên trái) chỉ ẩn drawer con, không động tới #drawer-settings bên dưới. KHÔNG có màn "File
 * Manager" trung gian nào nằm giữa Settings và 3 drawer này.
 *
 * 4 biến export: TPL_FILE_MANAGER_SONG_DRAWER (ĐẦY ĐỦ — Folder mục 4.b1 + Quản lý dung lượng dời
 * từ storage-drawer.js cũ, giữ NGUYÊN VẸN mọi id phần tử so với patch trước) /
 * TPL_FILE_MANAGER_FOLDER_DETAIL_DRAWER (Phase 2, MỚI — xem danh sách bài trong 1 folder + gỡ bài
 * + "Áp dụng cho Playlist", tầng nav-stack sâu hơn Song 1 cấp) / TPL_FILE_MANAGER_PHOTO_DRAWER /
 * TPL_FILE_MANAGER_DOCUMENT_DRAWER (2 cái sau CHƯA code — b2/b3/b4 — hiện placeholder "sắp ra
 * mắt", khung nav-stack vẫn đầy đủ để lắp nội dung thật sau mà không phải sửa lại cơ chế mở/đóng).
 *
 * components/storage-drawer.js + biến TPL_STORAGE_DRAWER KHÔNG còn được mount (xem main.js) —
 * file cũ ĐỂ LẠI trong project làm tư liệu đối chiếu, KHÔNG xoá tự động, bác xoá tay khi rảnh.
 */

// ===================== Drawer con: Song (ĐẦY ĐỦ — dời nguyên nội dung từ bản overlay cũ) =====================
const TPL_FILE_MANAGER_SONG_DRAWER = `
    <div id="drawer-file-manager-song" class="fixed inset-0 drawer-glass z-[90] transform translate-y-full transition-transform duration-500 ease-in-out flex flex-col">
        <div class="flex justify-between items-center px-4 py-3 sm:px-6 border-b border-white/10 shrink-0 bg-black/40">
            <div class="flex items-center gap-2">
                <button id="btn-back-file-manager-song" class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white" data-i18n-title="fileManager.song.back.title" title="${t('fileManager.song.back.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 class="text-base sm:text-lg font-bold tracking-wider text-white uppercase" data-i18n="fileManager.song.title">${t('fileManager.song.title')}</h2>
            </div>
        </div>

        <div class="flex-grow overflow-y-auto px-4 py-6 sm:px-8 pb-20">
            <div class="max-w-2xl mx-auto space-y-8">

                <!-- SECTION: FOLDER (mục 4.b1) -->
                <div>
                    <h3 class="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 ml-2" data-i18n="fileManager.song.folderSectionTitle">${t('fileManager.song.folderSectionTitle')}</h3>
                    <div class="bg-white/5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                        <div class="flex gap-2 p-3 border-b border-white/5">
                            <input id="file-manager-new-folder-input" type="text" placeholder="${t('fileManager.song.newFolderPlaceholder')}" class="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 transition-colors">
                            <button id="btn-file-manager-create-folder" class="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors shrink-0" data-i18n="fileManager.song.btnCreateFolder">${t('fileManager.song.btnCreateFolder')}</button>
                        </div>
                        <div id="file-manager-folder-list" class="flex flex-col divide-y divide-white/5"></div>
                        <p id="file-manager-folder-empty" class="hidden text-sm text-slate-400 p-4 text-center" data-i18n="fileManager.song.folderEmpty">${t('fileManager.song.folderEmpty')}</p>
                    </div>
                </div>

                <!-- SECTION: THỐNG KÊ DUNG LƯỢNG (dời từ storage-drawer.js, id giữ nguyên) -->
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

                <!-- SECTION: GIẢI PHÓNG BỘ NHỚ (dời từ storage-drawer.js, id giữ nguyên) -->
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

                <!-- SECTION: DỌN FILE LỖI (dời từ storage-drawer.js, id giữ nguyên) -->
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

// ===================== Drawer con: Folder Detail (Phase 2, MỚI — mục 1b/c) =====================
// Tầng nav-stack SÂU HƠN drawer Song 1 cấp (z-[91] > z-[90]) — mở khi bấm vào 1 hàng folder trong
// TPL_FILE_MANAGER_SONG_DRAWER ở trên. Back chỉ ẩn drawer NÀY, KHÔNG động tới drawer Song bên dưới
// (vẫn mở nguyên) — đúng nav-stack pattern.
const TPL_FILE_MANAGER_FOLDER_DETAIL_DRAWER = `
    <div id="drawer-file-manager-folder-detail" class="fixed inset-0 drawer-glass z-[91] transform translate-y-full transition-transform duration-500 ease-in-out flex flex-col">
        <div class="flex justify-between items-center px-4 py-3 sm:px-6 border-b border-white/10 shrink-0 bg-black/40">
            <div class="flex items-center gap-2 min-w-0">
                <button id="btn-back-file-manager-folder-detail" class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0" data-i18n-title="fileManager.song.folderDetail.back.title" title="${t('fileManager.song.folderDetail.back.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 id="file-manager-folder-detail-title" class="text-base sm:text-lg font-bold tracking-wider text-white uppercase truncate">—</h2>
            </div>
        </div>

        <div class="flex-grow overflow-y-auto px-4 py-6 sm:px-8 pb-20">
            <div class="max-w-2xl mx-auto space-y-6">

                <button id="btn-file-manager-folder-apply-to-playlist" data-mode="apply" class="w-full py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors shadow" data-i18n="fileManager.song.folderDetail.btnApply">${t('fileManager.song.folderDetail.btnApply')}</button>

                <div>
                    <h3 class="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 ml-2" data-i18n="fileManager.song.folderDetail.songListTitle">${t('fileManager.song.folderDetail.songListTitle')}</h3>
                    <div class="bg-white/5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                        <div id="file-manager-folder-detail-song-list" class="flex flex-col divide-y divide-white/5"></div>
                        <p id="file-manager-folder-detail-empty" class="hidden text-sm text-slate-400 p-4 text-center" data-i18n="fileManager.song.folderDetail.empty">${t('fileManager.song.folderDetail.empty')}</p>
                    </div>
                </div>

            </div>
        </div>
    </div>
`;
const TPL_FILE_MANAGER_PHOTO_DRAWER = `
    <div id="drawer-file-manager-photo" class="fixed inset-0 drawer-glass z-[90] transform translate-y-full transition-transform duration-500 ease-in-out flex flex-col">
        <div class="flex justify-between items-center px-4 py-3 sm:px-6 border-b border-white/10 shrink-0 bg-black/40">
            <div class="flex items-center gap-2">
                <button id="btn-back-file-manager-photo" class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white" data-i18n-title="fileManager.photo.back.title" title="${t('fileManager.photo.back.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 class="text-base sm:text-lg font-bold tracking-wider text-white uppercase" data-i18n="fileManager.photo.title">${t('fileManager.photo.title')}</h2>
            </div>
        </div>
        <div class="flex-grow overflow-y-auto px-4 py-6 sm:px-8 pb-20">
            <div class="max-w-2xl mx-auto">
                <p class="text-sm text-slate-400 text-center py-10" data-i18n="fileManager.comingSoon">${t('fileManager.comingSoon')}</p>
            </div>
        </div>
    </div>
`;

// ===================== Drawer con: Documents (placeholder — b4 CHƯA code) =====================
const TPL_FILE_MANAGER_DOCUMENT_DRAWER = `
    <div id="drawer-file-manager-document" class="fixed inset-0 drawer-glass z-[90] transform translate-y-full transition-transform duration-500 ease-in-out flex flex-col">
        <div class="flex justify-between items-center px-4 py-3 sm:px-6 border-b border-white/10 shrink-0 bg-black/40">
            <div class="flex items-center gap-2">
                <button id="btn-back-file-manager-document" class="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white" data-i18n-title="fileManager.document.back.title" title="${t('fileManager.document.back.title')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <h2 class="text-base sm:text-lg font-bold tracking-wider text-white uppercase" data-i18n="fileManager.document.title">${t('fileManager.document.title')}</h2>
            </div>
        </div>
        <div class="flex-grow overflow-y-auto px-4 py-6 sm:px-8 pb-20">
            <div class="max-w-2xl mx-auto">
                <p class="text-sm text-slate-400 text-center py-10" data-i18n="fileManager.comingSoon">${t('fileManager.comingSoon')}</p>
            </div>
        </div>
    </div>
`;
