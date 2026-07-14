/**
 * components/file-manager.js — 3 drawer con của File Manager (Song/Photo & Album/Documents),
 * ver 12 "Multi Media". CHỐT LẠI 03/07/2026 (xem plan-v12-multimedia-decisions.md mục 1a/7,
 * đè lên quyết định ban đầu ở patch 02/07/2026):
 *
 * KHÔNG còn 1 overlay "File Manager" cấp cao với tab-bar 4 mục nữa. File Manager giờ chỉ là 1
 * SECTION bình thường trong Settings (xem components/settings/file-manager-section.js —
 * TPL_SETTINGS_FILE_MANAGER, 3 hàng Song/Photo & Album/Documents), mỗi hàng bấm vào PUSH THẲNG
 * sang 1 trong 3 khu vực định nghĩa ở file này.
 *
 * === Batch D5 (Settings restructure, 06/07/2026) — Song + Folder Detail ===
 * 2 hàm `renderFileManagerSongPanelBody()`/`renderFileManagerFolderDetailPanelBody()` THAY 2 biến
 * `TPL_FILE_MANAGER_SONG_DRAWER`/`TPL_FILE_MANAGER_FOLDER_DETAIL_DRAWER` cũ — PUSH ĐỘNG vào Settings
 * Stack (core/settings-panel-stack.js), Song ở cấp 1, Folder Detail ở cấp 2 (đè lên Song, ngăn xếp
 * hỗ trợ sẵn độ sâu tuỳ ý). Folder Detail KHÔNG còn header bar riêng (title động = tên folder) —
 * header dùng CHUNG chỉ nhận title CỐ ĐỊNH lúc push, tên folder THẬT giờ hiển thị bằng 1 heading
 * NGAY TRONG BODY panel (`#file-manager-folder-detail-title`, cập nhật qua setFolderDetailTitle()
 * sau khi đọc DB xong — xem event/workflow/file-manager-song.js::refreshFolderDetail()).
 *
 * `TPL_FILE_MANAGER_PHOTO_DRAWER` ĐÃ đổi ở Batch D6 (06/07/2026) — `renderFileManagerPhotoPanelBody()`,
 * push động `fullBleed: true` (masonry/story slider tràn viền, xem core/settings-panel-stack.js).
 * `TPL_FILE_MANAGER_DOCUMENT_DRAWER` ĐÃ đổi ở Batch D7 (06/07/2026, BATCH CUỐI Nhóm D restructure)
 * — `renderFileManagerDocumentPanelBody()`, push động bình thường (không fullBleed). CẢ 4 khu vực
 * (Song/Folder Detail/Photo/Documents) giờ ĐỀU là hàm push động — file này KHÔNG còn biến
 * `TPL_FILE_MANAGER_*` nào cả.
 *
 * components/storage-drawer.js + biến TPL_STORAGE_DRAWER KHÔNG còn được mount (xem main.js) —
 * file cũ ĐỂ LẠI trong project làm tư liệu đối chiếu, KHÔNG xoá tự động, bác xoá tay khi rảnh.
 *
 * MỚI (batch tiếp theo 03/07/2026, mục 2.2/2.3 plan-v12-multimedia-update-2.md — nợ kỹ thuật đã
 * xác nhận từ Batch 3) — panel Photo thêm 2 khối: `#file-manager-album-manage-bar`
 * (Đổi tên/Xoá album đang lọc + mở chế độ "Thêm ảnh có sẵn") và `#file-manager-image-selection-bar`
 * (thanh hành động khi đang chọn nhiều ảnh để thêm vào album). Xem core/file-manager/photo-ui.js
 * (render + modal đổi tên) và event/workflow/file-manager-photo.js (logic).
 *
 * MỚI (Batch 8, 03/07/2026, slideshow nền Visual) — `#file-manager-album-manage-bar` thêm nút
 * `#btn-file-manager-album-set-slideshow-bg` ("Dùng làm nền Slideshow" cho album đang lọc). Xem
 * event/workflow/slideshow.js (engine) + components/slideshow-settings-drawer.js (Settings Drawer
 * riêng, mở từ Settings chính — plan-v12-multimedia-update-3.md mục 3).
 */

// ===================== Khu vực: Song (ĐẦY ĐỦ — dời nguyên nội dung từ bản overlay cũ) =====================
function renderFileManagerSongPanelBody() {
    return `
                <!-- SECTION: FOLDER (mục 4.b1) -->
                <div>
                    <h3 class="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 ml-2" data-i18n="fileManager.song.folderSectionTitle">${t('fileManager.song.folderSectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex gap-2 p-3 border-b border-white/5">
                            <input id="file-manager-new-folder-input" type="text" placeholder="${t('fileManager.song.newFolderPlaceholder')}" class="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 transition-colors">
                            <button id="btn-file-manager-create-folder" class="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors shrink-0" data-i18n="fileManager.song.btnCreateFolder">${t('fileManager.song.btnCreateFolder')}</button>
                        </div>
                        <div id="file-manager-folder-list" class="flex flex-col divide-y divide-white/5"></div>
                        <p id="file-manager-folder-empty" class="hidden text-sm text-slate-400 p-4 text-center" data-i18n="fileManager.song.folderEmpty">${t('fileManager.song.folderEmpty')}</p>
                        <!-- MỚI (14/07/2026, tích hợp pagination — Giang yêu cầu, 10 folder/trang,
                             control "full": ‹ trang/tổng ›) — xem core/pagination.js +
                             event/workflow/file-manager-song.js::refreshSongTab(). Rỗng nếu
                             totalPages <= 1 (buildPaginationFullHtml() tự trả chuỗi rỗng). -->
                        <div id="file-manager-folder-pagination" class="border-t border-white/5"></div>
                    </div>
                </div>

                <!-- SECTION: THỐNG KÊ DUNG LƯỢNG (dời từ storage-drawer.js, id giữ nguyên) -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="storageDrawer.statsSectionTitle">${t('storageDrawer.statsSectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
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
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
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

`;
}

// ===================== Khu vực: Folder Detail (Phase 2, MỚI — mục 1b/c) =====================
// Cấp 2 trong ngăn xếp (đè lên panel Song) — mở khi bấm vào 1 hàng folder trong
// renderFileManagerSongPanelBody() ở trên. Back (dùng chung) chỉ lùi về panel Song, KHÔNG đóng
// cả 2 — core/settings-panel-stack.js tự quản lý thứ tự pop đúng theo ngăn xếp.
function renderFileManagerFolderDetailPanelBody() {
    return `
                <!-- MỚI (14/07/2026, Giang yêu cầu — layout lại) — flex-between: tên folder BÊN
                     TRÁI, 2 icon (Sửa tên/Áp dụng) BÊN PHẢI. Trước đây: <h2> riêng 1 hàng + nút
                     "Áp dụng"/"Bỏ áp dụng" CHỮ ĐẦY CHIỀU RỘNG ngay dưới — giờ gộp 1 hàng, 2 nút
                     Sửa/Áp dụng thành ICON (title/màu vẫn phân biệt trạng thái, xem
                     event/workflow/file-manager-song.js::_updateApplyButtonMode()). BỎ class
                     "uppercase" ở tên (đợt 6, điểm 4 cũ) — đây là tên THẬT của folder, ép hoa toàn
                     bộ khiến 2 folder khác tên chỉ do khác hoa/thường trông giống hệt nhau. -->
                <div class="flex items-center justify-between gap-2 -mt-2">
                    <h2 id="file-manager-folder-detail-title" class="text-lg font-bold tracking-wider text-white truncate min-w-0">—</h2>
                    <div class="flex items-center gap-1 shrink-0">
                        <button id="btn-file-manager-folder-detail-rename" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-slate-300" title="${t('fileManager.song.folderDetail.renameTitle')}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button id="btn-file-manager-folder-apply-to-playlist" data-mode="apply" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-sky-400" title="${t('fileManager.song.folderDetail.btnApply')}">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                    </div>
                </div>

                <!-- MỚI (14/07/2026) — BỎ tiêu đề "SONGS IN THIS FOLDER" (Giang yêu cầu) — danh
                     sách bài đứng thẳng dưới header, không cần nhãn giới thiệu riêng. -->
                <div>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div id="file-manager-folder-detail-song-list" class="flex flex-col divide-y divide-white/5"></div>
                        <p id="file-manager-folder-detail-empty" class="hidden text-sm text-slate-400 p-4 text-center" data-i18n="fileManager.song.folderDetail.empty">${t('fileManager.song.folderDetail.empty')}</p>
                    </div>
                </div>

                <!-- MỚI (14/07/2026, Giang yêu cầu) — "Xoá hết bài" (CHỈ dọn rỗng folder, KHÔNG
                     xoá folder — khác hẳn "Xoá folder" ở panel Song) — nút CĂN GIỮA, tự ẩn khi
                     folder đã rỗng sẵn (renderFolderDetailSongList() toggle 'hidden', xem
                     core/file-manager/folder-detail-ui.js). -->
                <div class="flex justify-center">
                    <button id="btn-file-manager-folder-detail-remove-all" class="hidden px-5 py-2.5 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-rose-400 text-sm font-semibold transition-colors" data-i18n="fileManager.song.folderDetail.btnRemoveAll">${t('fileManager.song.folderDetail.btnRemoveAll')}</button>
                </div>
`;
}

// ===================== Khu vực: Photo & Album (Batch 3, 03/07/2026 — code thật) =====================
// Batch D6 (Settings restructure, 06/07/2026): TPL_FILE_MANAGER_PHOTO_DRAWER (khung `fixed
// inset-0 drawer-glass z-[90]` + header riêng) THAY bằng hàm `renderFileManagerPhotoPanelBody()`,
// PUSH ĐỘNG với `fullBleed: true` (masonry/story slider tràn viền, không dùng khung "max-w-2xl"
// mặc định — xem event/workflow/file-manager-photo.js::openPanel()). Nút upload
// (`#btn-file-manager-image-upload-trigger`) TRƯỚC ĐÂY nằm trong header bar riêng (cạnh title) —
// header giờ dùng CHUNG (chỉ title + Back), nút upload dời xuống 1 THANH NHỎ ngay đầu body.
function renderFileManagerPhotoPanelBody() {
    return `
        <div class="flex justify-end items-center px-4 py-2 border-b border-white/5 shrink-0">
            <button id="btn-file-manager-image-upload-trigger" class="w-8 h-8 flex items-center justify-center rounded-full bg-sky-500 hover:bg-sky-400 transition-colors text-white shrink-0" data-i18n-title="fileManager.photo.uploadTitle" title="${t('fileManager.photo.uploadTitle')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            </button>
            <input type="file" id="file-manager-image-upload-input" accept="image/png,image/jpeg,image/webp" multiple class="hidden">
        </div>

        <!-- Story slider Album (mục 3, lazy load qua IntersectionObserver — core/file-manager/photo-ui.js) -->
        <div id="file-manager-album-story" class="flex gap-4 overflow-x-auto px-4 py-4 snap-x snap-mandatory shrink-0 border-b border-white/5"></div>

        <!-- Thanh quản lý album đang lọc: chỉ hiện khi activeAlbumId != null (toggle 'hidden'/
             'flex' ở workflow, xem event/workflow/file-manager-photo.js::refresh()). 3 nút: Thêm
             ảnh có sẵn (mở chế độ chọn nhiều trong masonry) / Đổi tên / Xoá album. -->
        <div id="file-manager-album-manage-bar" class="hidden items-center justify-between gap-2 px-4 py-2 border-b border-white/5 shrink-0 bg-white/5">
            <span id="file-manager-album-manage-name" class="text-sm font-semibold text-sky-300 truncate min-w-0"></span>
            <div class="flex items-center gap-1 shrink-0">
                <button id="btn-file-manager-album-add-images" class="p-1.5 rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-sky-400" data-i18n-title="fileManager.photo.album.addImagesTitle" title="${t('fileManager.photo.album.addImagesTitle')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v4m-2-2h4" /></svg>
                </button>
                <!-- MỚI (Batch 8, slideshow) — "Dùng làm nền Slideshow" cho album đang lọc, xem
                     event/workflow/file-manager-photo.js::setAsSlideshowBackground(). -->
                <button id="btn-file-manager-album-set-slideshow-bg" class="p-1.5 rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-fuchsia-400" data-i18n-title="fileManager.photo.album.setSlideshowBgTitle" title="${t('fileManager.photo.album.setSlideshowBgTitle')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 22V12h6v10" /></svg>
                </button>
                <button id="btn-file-manager-album-rename" class="p-1.5 rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-emerald-400" data-i18n-title="fileManager.photo.album.renameTitle" title="${t('fileManager.photo.album.renameTitle')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
                <button id="btn-file-manager-album-delete" class="p-1.5 rounded-full hover:bg-rose-500/10 transition-colors text-slate-400 hover:text-rose-400" data-i18n-title="fileManager.photo.album.deleteTitle" title="${t('fileManager.photo.album.deleteTitle')}">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </div>

        <!-- Masonry ảnh (grid ô vuông đều — mục 3, VIẾT LẠI 04/07/2026). -->
        <div class="flex-grow overflow-y-auto px-3 py-3 pb-20 relative">
            <div id="file-manager-image-masonry" class="grid grid-cols-3 sm:grid-cols-4 gap-1"></div>
            <p id="file-manager-image-empty" class="hidden text-sm text-slate-400 text-center py-10" data-i18n="fileManager.photo.image.empty">${t('fileManager.photo.image.empty')}</p>
        </div>

        <!-- Thanh hành động khi đang chọn nhiều ảnh để thêm vào album đang xem (bật qua nút "Thêm
             ảnh có sẵn" ở thanh quản lý album phía trên). "absolute bottom-0" neo theo chính panel
             (fullBleed panel là position:absolute + flex flex-col, cha gần nhất lập context
             định vị) — cần "relative" ở div masonry ngay trên để "absolute" ở đây neo đúng theo
             panel tổng thể chứ không theo riêng div masonry (khác bản gốc dùng #drawer cha làm
             mốc — panel giờ đã tự là mốc đó). -->
        <div id="file-manager-image-selection-bar" class="hidden absolute bottom-0 inset-x-0 z-20 bg-[#0f172a]/95 backdrop-blur-md border-t border-white/10 px-4 py-3 flex items-center justify-between gap-2">
            <span id="file-manager-image-selection-count" class="text-sm font-semibold text-slate-200"></span>
            <div class="flex items-center gap-2 shrink-0">
                <button id="btn-file-manager-image-selection-cancel" class="px-3.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-sm font-semibold transition-colors" data-i18n="common.cancel">${t('common.cancel')}</button>
                <button id="btn-file-manager-image-selection-confirm" class="px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors" data-i18n="fileManager.photo.album.btnAddSelected">${t('fileManager.photo.album.btnAddSelected')}</button>
            </div>
        </div>
`;
}

// ===================== Khu vực: Documents (04/07/2026 — code thật, thay placeholder) ========
// 2 nút upload TÁCH RIÊNG (không dùng chung 1 cơ chế "tự phân loại", đúng yêu cầu Giang — "mỗi cái
// một upload riêng cho dễ"): "Tải lên tài liệu" (chọn .txt/.docx có sẵn) và "Tạo tài liệu mới"
// (.txt rỗng, mở thẳng vào Reader ở chế độ Sửa). Danh sách bên dưới — xem
// core/file-manager/document-ui.js::renderDocumentList().
//
// Batch D7 (Settings restructure, 06/07/2026 — BATCH CUỐI Nhóm D): TPL_FILE_MANAGER_DOCUMENT_DRAWER
// (khung `fixed inset-0 drawer-glass z-[90]` + header riêng) THAY bằng hàm
// `renderFileManagerDocumentPanelBody()`, PUSH ĐỘNG vào Settings Stack — header dùng CHUNG (title +
// Back), không còn header riêng.
function renderFileManagerDocumentPanelBody() {
    return `
                <div class="flex gap-3">
                    <button id="btn-file-manager-document-upload" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition-colors shadow">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3-3 3 3m-3-3v6" /></svg>
                        <span data-i18n="fileManager.document.btnUpload">${t('fileManager.document.btnUpload')}</span>
                        <input type="file" id="file-manager-document-upload-input" accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" class="hidden">
                    </button>
                    <button id="btn-file-manager-document-create" class="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 rounded-xl text-xs font-bold transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                        <span data-i18n="fileManager.document.btnCreate">${t('fileManager.document.btnCreate')}</span>
                    </button>
                </div>
                <div id="file-manager-document-list" class="flex flex-col gap-2"></div>
                <p id="file-manager-document-empty" class="hidden text-sm text-slate-400 text-center py-10" data-i18n="fileManager.document.empty">${t('fileManager.document.empty')}</p>
`;
}
