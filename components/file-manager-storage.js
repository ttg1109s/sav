/**
 * components/file-manager-storage.js — body Generic Drawer "Quản lý lưu trữ" (storageDrawer.title), mở từ tab Storage
 * của bottom nav (event/workflow/file-manager-storage.js::openPanel()). 4 khối:
 *   - Thống kê dung lượng 3 domain (Song/Video/Photo): thanh chia đoạn (ấn từng đoạn xem số byte thật) + list 3 hàng
 *     (nhãn - số lượng, chấm màu khớp thanh).
 *   - "Chọn mục xoá": 3 toggle nguồn ĐỘC LẬP (Song/Video/Photo) + 2 toggle hành động (Tải xuống trước / Xoá khỏi thư
 *     viện) + nút Thực hiện.
 *   - "Dọn file lỗi": nút quét mở modalChoice() riêng chọn loại quét (xem askScanBrokenScope()), khung kết quả + nút
 *     Sửa file lỗi / Bỏ qua.
 *   - "Dọn dẹp dữ liệu" (`#btn-file-manager-cleanup-run`, router 'fileManagerCleanup').
 * Thêm: danh sách kết quả quét (`renderStorageScanResultListHtml()`), thân modal chọn phạm vi quét
 * (`renderStorageScanScopeModalBodyHtml()`).
 * Sự kiện: delegate trên genericDrawerBody ở event/listener/file-manager-storage.js.
 * Lúc chạy: core/modal-choice-ui.js (escapeHtml).
 */
/** Body Generic Drawer Storage: `renderFileManagerStorageManagementPanelBody()` bọc `p-4` + màu chữ mặc định theo theme. */
function renderFileManagerStorageDrawerBody() {
    return `<div class="p-4" data-uitk="textPrimary">${renderFileManagerStorageManagementPanelBody()}</div>`;
}

function renderFileManagerStorageManagementPanelBody() {
    // Lớp bọc `space-y-5` tạo khoảng cách giữa các khối "tiêu đề + card" (cùng khuôn mọi màn dạng list tiêu đề + card).
    return `
                <div class="space-y-5">
                <!-- SECTION: THỐNG KÊ DUNG LƯỢNG (3 domain: Song/Video/Photo) -->
                <div>
                    <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2" data-uitk="accentText" data-i18n="storageDrawer.statsSectionTitle">${t('storageDrawer.statsSectionTitle')}</h3>
                    <div class="rounded-2xl p-4 flex flex-col gap-3" data-uitk="cardBg cardBorder">
                        <div class="flex items-baseline justify-between">
                            <span class="text-sm font-medium" data-uitk="textPrimary" data-i18n="storageDrawer.statTotalBytes">${t('storageDrawer.statTotalBytes')}</span>
                            <span id="stat-storage-total-bytes" class="text-lg font-bold font-mono tabular-nums" data-uitk="textPrimary">—</span>
                        </div>
                        <!-- Mỗi đoạn ấn được (data-legend-key) — hiện số byte THẬT của đoạn đó
                             (workflowFileManagerStorage.showSegmentBytes()). Có navigator.storage.estimate():
                             thang đo = quota của app — 3 đoạn media + "Khác" (usage origin trừ media), phần
                             track còn lại = còn trống. Không có estimate (trình duyệt cũ/file://): tỉ lệ giữa
                             3 media, dòng "còn trống" ẩn. Đoạn "Khác" màu inline (slate-400) vì bg-slate-400
                             chưa có trong assets/css/tailwind.css. -->
                        <div class="flex flex-col gap-1.5">
                            <div class="h-2.5 w-full rounded-full overflow-hidden flex" data-uitk="progressTrackBg">
                                <div id="stat-storage-bar-songs" class="h-full bg-sky-400 transition-[width] duration-500 cursor-pointer" data-legend-key="storageDrawer.legendSongs" style="width:0%"></div>
                                <div id="stat-storage-bar-videos" class="h-full bg-violet-400 transition-[width] duration-500 cursor-pointer" data-legend-key="storageDrawer.legendVideos" style="width:0%"></div>
                                <div id="stat-storage-bar-photos" class="h-full bg-emerald-400 transition-[width] duration-500 cursor-pointer" data-legend-key="storageDrawer.legendPhotos" style="width:0%"></div>
                                <div id="stat-storage-bar-other" class="h-full transition-[width] duration-500 cursor-pointer" data-legend-key="storageDrawer.legendOther" style="width:0%;background-color:#94a3b8"></div>
                            </div>
                            <div id="stat-storage-free-row" class="hidden flex items-baseline justify-between">
                                <!-- icon (i) giải thích con số ước lượng (components/info-icon.js) -->
                                <span class="flex items-center gap-1.5">
                                    <span class="text-xs" data-uitk="textSecondary" data-i18n="storageDrawer.statFreeBytes">${t('storageDrawer.statFreeBytes')}</span>
                                    ${renderInfoIconHtml(t('storageDrawer.statFreeBytesInfo'))}
                                </span>
                                <span id="stat-storage-free-bytes" class="text-xs font-mono tabular-nums" data-uitk="textSecondary">—</span>
                            </div>
                        </div>
                        <!-- List số lượng 3 domain, chấm màu khớp màu thanh chia đoạn ở trên. -->
                        <div class="flex flex-col divide-y mt-1" data-uitk="divideBorder">
                            <div class="flex items-center justify-between py-2">
                                <span class="flex items-center gap-2 text-sm" data-uitk="textPrimary"><span class="w-2 h-2 rounded-full bg-sky-400 shrink-0"></span><span data-i18n="storageDrawer.legendSongs">${t('storageDrawer.legendSongs')}</span></span>
                                <span id="stat-storage-count-song" class="text-sm font-semibold font-mono tabular-nums" data-uitk="textPrimary">—</span>
                            </div>
                            <div class="flex items-center justify-between py-2">
                                <span class="flex items-center gap-2 text-sm" data-uitk="textPrimary"><span class="w-2 h-2 rounded-full bg-violet-400 shrink-0"></span><span data-i18n="storageDrawer.legendVideos">${t('storageDrawer.legendVideos')}</span></span>
                                <span id="stat-storage-count-video" class="text-sm font-semibold font-mono tabular-nums" data-uitk="textPrimary">—</span>
                            </div>
                            <div class="flex items-center justify-between py-2">
                                <span class="flex items-center gap-2 text-sm" data-uitk="textPrimary"><span class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span><span data-i18n="storageDrawer.legendPhotos">${t('storageDrawer.legendPhotos')}</span></span>
                                <span id="stat-storage-count-photo" class="text-sm font-semibold font-mono tabular-nums" data-uitk="textPrimary">—</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECTION: CHỌN MỤC XOÁ — 3 toggle nguồn ĐỘC LẬP (bật nhiều cùng lúc được) + 2 toggle
                     hành động (Tải xuống trước / Xoá khỏi thư viện) + nút Thực hiện. -->
                <div>
                    <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2" data-uitk="categoryAccent:rose" data-i18n="storageDrawer.selectSourceSectionTitle">${t('storageDrawer.selectSourceSectionTitle')}</h3>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                        <div class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder">
                            <span class="text-sm font-medium truncate" data-i18n="storageDrawer.legendSongs">${t('storageDrawer.legendSongs')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="toggle-storage-source-song" class="sr-only peer">
                                <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner" data-uitk="toggleTrackOff toggleTrackOn"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder">
                            <span class="text-sm font-medium truncate" data-i18n="storageDrawer.legendVideos">${t('storageDrawer.legendVideos')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="toggle-storage-source-video" class="sr-only peer">
                                <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-500 shadow-inner" data-uitk="toggleTrackOff"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder">
                            <span class="text-sm font-medium truncate" data-i18n="storageDrawer.legendPhotos">${t('storageDrawer.legendPhotos')}</span>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="toggle-storage-source-photo" class="sr-only peer">
                                <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 shadow-inner" data-uitk="toggleTrackOff"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="fileManager.song.storageAction.downloadToggle.label">${t('fileManager.song.storageAction.downloadToggle.label')}</div>
                                <div class="text-xs mt-0.5" data-uitk="textSecondary" data-i18n="fileManager.song.storageAction.downloadToggle.hint">${t('fileManager.song.storageAction.downloadToggle.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="toggle-storage-download" class="sr-only peer">
                                <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 shadow-inner" data-uitk="toggleTrackOff"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-uitk="categoryAccent:rose" data-i18n="fileManager.song.storageAction.deleteToggle.label">${t('fileManager.song.storageAction.deleteToggle.label')}</div>
                                <div class="text-xs mt-0.5" data-uitk="textSecondary" data-i18n="fileManager.song.storageAction.deleteToggle.hint">${t('fileManager.song.storageAction.deleteToggle.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="toggle-storage-delete" class="sr-only peer">
                                <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500 shadow-inner" data-uitk="toggleTrackOff"></div>
                            </label>
                        </div>
                        <button id="btn-storage-execute" disabled class="p-4 text-sm font-bold disabled:opacity-40 disabled:pointer-events-none" data-uitk="cardHoverBg textPrimary" data-i18n="fileManager.song.storageAction.btnExecute">${t('fileManager.song.storageAction.btnExecute')}</button>
                    </div>
                </div>

                <!-- SECTION: DỌN FILE LỖI — nút quét mở modalChoice() RIÊNG chọn loại quét (Tất cả/Song/
                     Video/Photo), không dùng chung 3 toggle nguồn ở trên — xem askScanBrokenScope(). -->
                <div>
                    <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2" data-uitk="categoryAccent:amber" data-i18n="storageDrawer.brokenSectionTitle">${t('storageDrawer.brokenSectionTitle')}</h3>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                        <button id="btn-storage-scan-broken" class="flex justify-between items-center p-4 w-full text-left" data-uitk="cardHoverBg">
                            <div>
                                <div class="text-sm font-medium" data-i18n="storageDrawer.scanBroken.label">${t('storageDrawer.scanBroken.label')}</div>
                                <div class="text-xs mt-0.5" data-uitk="textSecondary" data-i18n="storageDrawer.scanBroken.hint">${t('storageDrawer.scanBroken.hint')}</div>
                            </div>
                            ${iconSvg('search', 'h-5 w-5 shrink-0', 'data-uitk="categoryAccent:amber"')}
                        </button>
                        <div id="storage-scan-result" class="hidden p-4 flex flex-col gap-3 border-t" data-uitk="dividerBorder">
                            <p id="storage-scan-summary" class="text-sm" data-uitk="textPrimary"></p>
                            <div id="storage-scan-list" class="flex flex-col gap-1.5 max-h-48 overflow-y-auto text-xs" data-uitk="textSecondary"></div>
                            <div class="flex gap-3 mt-1">
                                <!-- Màu nút tĩnh destructive (đa số lô quét có phần xoá thật) — modal xác nhận
                                     (askFixBroken()) mới đổi màu/nội dung đúng theo từng lô. -->
                                <button id="btn-storage-fix-broken" class="flex-1 py-2.5 rounded-xl text-sm font-semibold" data-uitk="btnDestructiveBg btnDestructiveHoverBg textOnAccent" data-i18n="storageDrawer.btnFixBroken">${t('storageDrawer.btnFixBroken')}</button>
                                <button id="btn-storage-dismiss-scan" class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors" data-uitk="btnNeutralBg btnNeutralHoverBg btnNeutralText" data-i18n="storageDrawer.btnDismissScan">${t('storageDrawer.btnDismissScan')}</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECTION: DỌN DẸP DỮ LIỆU — core/file-manager/cleanup.js (registry) +
                     event/workflow/file-manager-cleanup.js. -->
                <div>
                    <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                        <button id="btn-file-manager-cleanup-run" class="flex justify-between items-center p-4 w-full text-left" data-uitk="cardHoverBg">
                            <div>
                                <div class="text-sm font-medium truncate" data-i18n="fileManager.cleanup.label">${t('fileManager.cleanup.label')}</div>
                                <div class="text-xs mt-0.5" data-uitk="textSecondary" data-i18n="fileManager.cleanup.hint">${t('fileManager.cleanup.hint')}</div>
                            </div>
                            ${iconSvg('trash', 'h-5 w-5 shrink-0', 'data-uitk="textMutedIcon"')}
                        </button>
                    </div>
                </div>
                </div>
`;
}

/** Danh sách kết quả quét file lỗi (Storage + Troubleshooting > thumb video). Tên file/lý do có thể chứa mime đọc từ
 * file -> escape. @param {Array<{filename: string, reason: string}>} results @returns {string} */
function renderStorageScanResultListHtml(results) {
    return results.map((r) => `<div class="truncate"><span class="text-amber-400">●</span> ${escapeHtml(r.filename)} — ${escapeHtml(r.reason)}</div>`).join('');
}

/** Thân modal chọn phạm vi quét file lỗi — `<select id="modal-scan-scope">` nằm trong phần chữ của modalChoice(). */
function renderStorageScanScopeModalBodyHtml() {
    return `${t('storageDrawer.scanBroken.modalBody')}
<select id="modal-scan-scope" class="mt-3 w-full rounded-lg px-3 py-2.5 text-sm outline-none" data-uitk="inputBg inputBorder inputText">
    <option value="all">${t('storageDrawer.scanBroken.scopeAll')}</option>
    <option value="song">${t('storageDrawer.legendSongs')}</option>
    <option value="video">${t('storageDrawer.legendVideos')}</option>
    <option value="photo">${t('storageDrawer.legendPhotos')}</option>
</select>`;
}
