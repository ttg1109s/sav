/**
 * components/file-manager-storage.js — MỚI (29/07/2026, yêu cầu Giang).
 *
 * Panel "Quản lý lưu trữ" (storageDrawer.title) — THAY HẲN nội dung "thống kê + giải phóng bộ nhớ
 * + dọn file lỗi" từng nằm TRONG panel "Song & Video" cũ (renderFileManagerSongPanelBody(),
 * components/file-manager.js — ĐÃ XOÁ HẲN function đó). Panel Song & Video giờ KHÔNG còn tồn tại —
 * hàng "Song & Video" ở section chính (components/settings/file-manager-section.js) giờ mở THẲNG
 * Generic Drawer duyệt thư mục (event/workflow/file-manager-folder-browser.js::openList()), bỏ qua
 * mọi panel trung gian.
 *
 * MỞ RỘNG (mục 2a/2c, phản hồi Giang):
 *   - Thống kê dung lượng giờ gồm ĐỦ 4 domain (Song/Video/Photo/Document) — thanh chia đoạn 4 màu
 *     THAY 2 màu cũ, "vòng tròn số lượng" THAY bằng 1 LIST 4 hàng (nhãn trái - số lượng phải).
 *   - "Giải phóng bộ nhớ" đổi tên "Chọn mục xoá" — <select> phạm vi (song/video/both) cũ THAY bằng
 *     4 checkbox toggle ĐỘC LẬP (Song/Video/Photo/Document, không loại trừ nhau) — kết hợp CÙNG 2
 *     toggle sẵn có (Tải xuống trước/Xoá khỏi thư viện). "Dọn file lỗi" DÙNG CHUNG đúng 4 checkbox
 *     này để biết quét kho nào (xem event/workflow/file-manager-storage.js).
 *   - Nút "Dọn dẹp dữ liệu" (trước ở cuối section chính, components/settings/file-manager-
 *     section.js) DỜI VÀO ĐÂY (mục 2d) — ID giữ NGUYÊN (`btn-file-manager-cleanup-run`), router/
 *     workflow/core (fileManagerCleanup) KHÔNG đổi gì, chỉ đổi NƠI listener wiring (delegate qua
 *     `settingsStackBody`, xem event/listener/file-manager-storage.js — THAY static binding cũ ở
 *     event/listener/file-manager-cleanup.js đã xoá).
 *
 * Push ĐỘNG vào Settings Stack (core/settings-panel-stack.js), CÙNG khuôn panel Photo/Documents —
 * xem event/workflow/file-manager-storage.js::openPanel().
 */
function renderFileManagerStorageManagementPanelBody() {
    return `
                <!-- SECTION: THỐNG KÊ DUNG LƯỢNG (4 domain: Song/Video/Photo/Document) -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="storageDrawer.statsSectionTitle">${t('storageDrawer.statsSectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl p-4 flex flex-col gap-3">
                        <div class="flex items-baseline justify-between">
                            <span class="text-sm font-medium text-slate-300" data-i18n="storageDrawer.statTotalBytes">${t('storageDrawer.statTotalBytes')}</span>
                            <span id="stat-storage-total-bytes" class="text-lg font-bold text-white font-mono tabular-nums">—</span>
                        </div>
                        <div class="h-2.5 w-full rounded-full overflow-hidden flex bg-white/10">
                            <div id="stat-storage-bar-songs" class="h-full bg-sky-400 transition-[width] duration-500" style="width:0%"></div>
                            <div id="stat-storage-bar-videos" class="h-full bg-violet-400 transition-[width] duration-500" style="width:0%"></div>
                            <div id="stat-storage-bar-photos" class="h-full bg-emerald-400 transition-[width] duration-500" style="width:0%"></div>
                            <div id="stat-storage-bar-documents" class="h-full bg-amber-400 transition-[width] duration-500" style="width:0%"></div>
                        </div>
                        <!-- MỚI (mục 2b, phản hồi Giang "list ngay dưới song/video/photo/document
                             (bên trái) - count items (bên phải)") — THAY hẳn 2 "vòng tròn số lượng"
                             cũ (song/video), giờ 1 list 4 hàng, chấm màu khớp ĐÚNG màu thanh chia
                             đoạn ở trên cho từng domain. -->
                        <div class="flex flex-col divide-y divide-white/5 mt-1">
                            <div class="flex items-center justify-between py-2">
                                <span class="flex items-center gap-2 text-sm text-slate-300"><span class="w-2 h-2 rounded-full bg-sky-400 shrink-0"></span><span data-i18n="storageDrawer.legendSongs">${t('storageDrawer.legendSongs')}</span></span>
                                <span id="stat-storage-count-song" class="text-sm font-semibold text-white font-mono tabular-nums">—</span>
                            </div>
                            <div class="flex items-center justify-between py-2">
                                <span class="flex items-center gap-2 text-sm text-slate-300"><span class="w-2 h-2 rounded-full bg-violet-400 shrink-0"></span><span data-i18n="storageDrawer.legendVideos">${t('storageDrawer.legendVideos')}</span></span>
                                <span id="stat-storage-count-video" class="text-sm font-semibold text-white font-mono tabular-nums">—</span>
                            </div>
                            <div class="flex items-center justify-between py-2">
                                <span class="flex items-center gap-2 text-sm text-slate-300"><span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span><span data-i18n="storageDrawer.legendPhotos">${t('storageDrawer.legendPhotos')}</span></span>
                                <span id="stat-storage-count-photo" class="text-sm font-semibold text-white font-mono tabular-nums">—</span>
                            </div>
                            <div class="flex items-center justify-between py-2">
                                <span class="flex items-center gap-2 text-sm text-slate-300"><span class="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span><span data-i18n="storageDrawer.legendDocuments">${t('storageDrawer.legendDocuments')}</span></span>
                                <span id="stat-storage-count-document" class="text-sm font-semibold text-white font-mono tabular-nums">—</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECTION: CHỌN MỤC XOÁ — VIẾT LẠI (mục 2c, phản hồi Giang "dropdown source ->
                     checkbox toggle cho song/video/photo/document, kết hợp option trước") — 1
                     <select> phạm vi cũ (song/video/both) THAY bằng 4 toggle ĐỘC LẬP (không loại
                     trừ nhau, có thể bật nhiều cái cùng lúc) — GIỮ NGUYÊN 2 toggle sẵn có (Tải
                     xuống trước/Xoá khỏi thư viện) + nút Thực hiện. "Dọn file lỗi" (section ngay
                     dưới) DÙNG CHUNG đúng 4 toggle nguồn này để biết quét kho nào. -->
                <div>
                    <h3 class="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2 ml-2" data-i18n="storageDrawer.selectSourceSectionTitle">${t('storageDrawer.selectSourceSectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <span class="text-sm font-medium truncate" data-i18n="storageDrawer.legendSongs">${t('storageDrawer.legendSongs')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="toggle-storage-source-song" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <span class="text-sm font-medium truncate" data-i18n="storageDrawer.legendVideos">${t('storageDrawer.legendVideos')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="toggle-storage-source-video" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <span class="text-sm font-medium truncate" data-i18n="storageDrawer.legendPhotos">${t('storageDrawer.legendPhotos')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="toggle-storage-source-photo" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <span class="text-sm font-medium truncate" data-i18n="storageDrawer.legendDocuments">${t('storageDrawer.legendDocuments')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="toggle-storage-source-document" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 bg-white/[0.03]">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="fileManager.song.storageAction.downloadToggle.label">${t('fileManager.song.storageAction.downloadToggle.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="fileManager.song.storageAction.downloadToggle.hint">${t('fileManager.song.storageAction.downloadToggle.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="toggle-storage-download" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5 bg-white/[0.03]">
                            <div class="pr-3">
                                <div class="text-sm font-medium text-rose-300" data-i18n="fileManager.song.storageAction.deleteToggle.label">${t('fileManager.song.storageAction.deleteToggle.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="fileManager.song.storageAction.deleteToggle.hint">${t('fileManager.song.storageAction.deleteToggle.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="toggle-storage-delete" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500 shadow-inner"></div>
                            </label>
                        </div>
                        <button id="btn-storage-execute" disabled class="p-4 text-sm font-bold text-slate-300 hover:bg-white/5 transition-colors disabled:opacity-40 disabled:pointer-events-none" data-i18n="fileManager.song.storageAction.btnExecute">${t('fileManager.song.storageAction.btnExecute')}</button>
                    </div>
                </div>

                <!-- SECTION: DỌN FILE LỖI — quét theo ĐÚNG các nguồn đang bật ở "Chọn mục xoá" trên. -->
                <div>
                    <h3 class="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2 ml-2" data-i18n="storageDrawer.brokenSectionTitle">${t('storageDrawer.brokenSectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
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

                <!-- SECTION: DỌN DẸP DỮ LIỆU — DỜI TỪ section chính File Manager (mục 2d, phản hồi
                     Giang), ID GIỮ NGUYÊN — xem core/file-manager/cleanup.js (registry) +
                     event/workflow/file-manager-cleanup.js (KHÔNG đổi gì, chỉ đổi nơi wiring click,
                     xem event/listener/file-manager-storage.js). -->
                <div>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <button id="btn-file-manager-cleanup-run" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                            <div>
                                <div class="text-sm font-medium truncate" data-i18n="fileManager.cleanup.label">${t('fileManager.cleanup.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="fileManager.cleanup.hint">${t('fileManager.cleanup.hint')}</div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                    </div>
                </div>
`;
}
