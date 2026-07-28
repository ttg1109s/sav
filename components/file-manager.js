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
                <!-- SECTION: FOLDER — SỬA (Batch 5, "Song/Video Unification" mục 6e): danh sách
                     folder inline (tạo/phân trang/rename/xoá) ĐÃ THAY bằng 1 nút mở Generic Drawer
                     List↔Read ("Duyệt thư mục") — xem event/workflow/file-manager-folder-
                     browser.js. Cùng khuôn nút "Album List" của panel Photo
                     (#btn-file-manager-open-album-list). -->
                <button id="btn-file-manager-folder-browser-open" class="flex justify-between items-center p-4 rounded-2xl glass-modal hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" /></svg>
                        <span class="text-sm font-medium truncate" data-i18n="fileManager.folderBrowser.entryButton">${t('fileManager.folderBrowser.entryButton')}</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>

                <!-- SECTION: THỐNG KÊ DUNG LƯỢNG (dời từ storage-drawer.js, id giữ nguyên) -->
                <div>
                    <h3 class="text-xs font-bold text-sky-400 uppercase tracking-widest mb-2 ml-2" data-i18n="storageDrawer.statsSectionTitle">${t('storageDrawer.statsSectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <span class="text-sm font-medium text-slate-300" data-i18n="storageDrawer.statTotalSongs">${t('storageDrawer.statTotalSongs')}</span>
                            <span id="stat-storage-total-songs" class="text-sm font-mono text-sky-300">—</span>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <span class="text-sm font-medium text-slate-300" data-i18n="storageDrawer.statTotalBytes">${t('storageDrawer.statTotalBytes')}</span>
                            <span id="stat-storage-total-bytes" class="text-sm font-mono text-sky-300">—</span>
                        </div>
                        <!-- MỚI (ver12 "Song/Video Unification", Batch 5, mục 6a) — thống kê Video
                             song song thống kê Song, cùng khối (đã gộp panel "Song & Video"). -->
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <span class="text-sm font-medium text-slate-300" data-i18n="storageDrawer.statTotalVideos">${t('storageDrawer.statTotalVideos')}</span>
                            <span id="stat-storage-total-videos" class="text-sm font-mono text-violet-300">—</span>
                        </div>
                        <div class="flex justify-between items-center p-4">
                            <span class="text-sm font-medium text-slate-300" data-i18n="storageDrawer.statTotalVideoBytes">${t('storageDrawer.statTotalVideoBytes')}</span>
                            <span id="stat-storage-total-video-bytes" class="text-sm font-mono text-violet-300">—</span>
                        </div>
                    </div>
                </div>

                <!-- SECTION: GIẢI PHÓNG BỘ NHỚ — SỬA (Batch 5, "Song/Video Unification" mục 6b):
                     2 nút tách rời cũ (Tải xuống rồi xoá / Xoá không tải) THAY bằng 3 field cấu
                     hình độc lập: phạm vi (Song/Video/Cả hai) + 2 toggle (Tải xuống trước/Xoá khỏi
                     thư viện) + 1 nút Thực hiện (disable khi cả 2 toggle tắt). Đồng bộ qua
                     event/workflow/file-manager-song.js::updateStorageActionUI(). -->
                <div>
                    <h3 class="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2 ml-2" data-i18n="fileManager.song.storageAction.sectionTitle">${t('fileManager.song.storageAction.sectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <!-- SỬA (phản hồi Giang 28/07/2026, "hiển thị list source thành dropdown dạng
                             section option") — 3 nút pill cũ THAY bằng row + <select>, ĐÚNG khuôn
                             "Nguồn"/"Sắp xếp" đã dùng ở components/settings/playlist-view.js
                             (label trái + select phải, cùng class). -->
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <span class="text-sm font-medium truncate" data-i18n="fileManager.song.storageAction.scopeLabel">${t('fileManager.song.storageAction.scopeLabel')}</span>
                            <select id="setting-storage-scope" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                                <option value="song" data-i18n="fileManager.song.storageAction.scope.song">${t('fileManager.song.storageAction.scope.song')}</option>
                                <option value="video" data-i18n="fileManager.song.storageAction.scope.video">${t('fileManager.song.storageAction.scope.video')}</option>
                                <option value="both" data-i18n="fileManager.song.storageAction.scope.both">${t('fileManager.song.storageAction.scope.both')}</option>
                            </select>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="fileManager.song.storageAction.downloadToggle.label">${t('fileManager.song.storageAction.downloadToggle.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="fileManager.song.storageAction.downloadToggle.hint">${t('fileManager.song.storageAction.downloadToggle.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="toggle-storage-download" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
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

// ===================== Khu vực: Folder (Phase 2, MỚI — mục 1b/c) — ĐÃ THAY =====================
// SỬA (Batch 5, "Song/Video Unification" mục 6e) — renderFileManagerFolderDetailPanelBody() (panel
// cấp 2 kiểu Settings-panel-stack, đè lên panel Song) ĐÃ XOÁ HẲN — nội dung tương đương giờ dựng
// TRỰC TIẾP bên trong event/workflow/file-manager-folder-browser.js (Generic Drawer, trạng thái
// Read — _buildReadHeaderHtml()/_buildReadBodyHtml()), không còn ở file template này nữa.

// ===================== Khu vực: Photo & Album (Batch 3, 03/07/2026 — code thật) =====================
// Batch D6 (Settings restructure, 06/07/2026): TPL_FILE_MANAGER_PHOTO_DRAWER (khung `fixed
// inset-0 drawer-glass z-[90]` + header riêng) THAY bằng hàm `renderFileManagerPhotoPanelBody()`,
// PUSH ĐỘNG với `fullBleed: true` (masonry/story slider tràn viền, không dùng khung "max-w-2xl"
// mặc định — xem event/workflow/file-manager-photo.js::openPanel()).
//
// SỬA (14/07/2026, mục cuối, Giang yêu cầu):
//   1. Nút upload dời NGƯỢC LẠI lên header dùng chung (`headerActionHtml`, core/settings-panel-
//      stack-ui.js — MỚI thêm) — thanh nhỏ riêng đã bỏ hẳn. `#btn-file-manager-image-delete-mode`
//      (icon thùng rác, chế độ xoá nhanh — mục 2.2) ĐI CÙNG headerActionHtml, cả 2 nút build ở
//      event/workflow/file-manager-photo.js::openPanel() (không hardcode ở đây — trạng thái hiện/ẩn
//      của thùng rác phụ thuộc `images.length`, chỉ Workflow biết lúc mở panel).
//   2. Album story — THÊM pagination "arrow" (mục 2.3): nút "+" tạo album mới giờ CỐ ĐỊNH (tách
//      khỏi `renderAlbumStory()`, viết TĨNH ngay đây — không còn phụ thuộc dữ liệu album, không cần
//      vẽ lại mỗi refresh).
//
// SỬA (14/07/2026, Giang chỉnh lại — "dùng THẲNG core/pagination.js::buildPaginationArrowsHtml(),
// KHÔNG tự viết 2 nút ‹/› riêng; số 'trang hiện tại/tổng' hàm đó TỰ tạo ra thì ẩn bằng CSS, KHÔNG
// sửa core"): `#file-manager-album-story-pagination-wrap` RỖNG — Workflow đổ NGUYÊN chuỗi
// `buildPaginationArrowsHtml()` (core, KHÔNG sửa) vào đây mỗi lần đổi trang. `display: contents`
// (assets/css/style.css) "tháo" cái `<div>` bọc ngoài của hàm đó ra khỏi layout — 3 con bên trong
// (nút ‹, span "1/3", nút ›) trở thành con TRỰC TIẾP của hàng flex này, tự xếp lại vị trí bằng
// `order` (CSS thuần, KHÔNG đụng core): ‹ đứng đầu, "+ tạo mới"/danh sách album đứng giữa, › đứng
// cuối — số trang "1/3" bị ẩn hẳn (`display:none`, chọn theo `[data-pagination-action]` — thuộc
// tính core tự gắn sẵn, không cần thêm class/id gì mới vào core).
function renderFileManagerPhotoPanelBody() {
    return `
        <!-- SỬA (Giai đoạn 3b, rewrite Photo/Album, mục 3a — Giang yêu cầu "đập đi làm lại") — THAY
             HẲN story slider ngang + thanh quản lý album cũ (2 khối đã xoá, xem lịch sử git nếu cần
             đối chiếu) bằng 1 nút mở Album List sub-panel riêng (list phân trang, xem
             renderFileManagerAlbumListPanelBody() ngay dưới + event/workflow/file-manager-photo.js::
             openAlbumListPanel()). Toàn bộ quản lý album (đổi tên/xoá/thêm ảnh/xem) giờ SỐNG TRONG
             sub-panel đó — panel Photo chính CHỈ còn hiện chip lọc đơn giản (tên album đang lọc + nút
             bỏ lọc) khi có, KHÔNG còn thanh hành động đầy đủ như trước. -->
        <button id="btn-file-manager-open-album-list" class="flex justify-between items-center p-4 shrink-0 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
            <div class="flex items-center gap-3 min-w-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                <span class="text-sm font-medium truncate" id="file-manager-album-list-entry-label" data-i18n="fileManager.photo.albumList.entryButton">${t('fileManager.photo.albumList.entryButton')}</span>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
        </button>

        <!-- Chip lọc album đang xem — chỉ hiện khi activeAlbumId != null (toggle 'hidden'/'flex' ở
             workflow, xem event/workflow/file-manager-photo.js::refresh()). Đổi tên/xoá/thêm ảnh/xem
             album giờ đều làm TRONG Album List sub-panel — chip này CHỈ để bỏ lọc nhanh. -->
        <div id="file-manager-album-filter-chip" class="hidden items-center justify-between gap-2 px-4 py-2 border-b border-white/5 shrink-0 bg-white/5">
            <span id="file-manager-album-filter-name" class="text-sm font-semibold text-sky-300 truncate min-w-0"></span>
            <button id="btn-file-manager-album-filter-clear" class="p-1.5 rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-white shrink-0" title="${t('fileManager.photo.album.all')}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>

        <!-- Lưới ảnh — Item + window ảo (Patch mục 2, 14/07/2026, THAY masonry chunk-based cũ). Khung
             CUỘN chỉ còn #file-manager-image-empty tĩnh (vị trí hiển thị GIỮ NGUYÊN như bản cũ) —
             Workflow (event/workflow/file-manager-photo.js::setupPhotoGridWindow()) tự dựng cấu trúc
             "sizer + window" (id="file-manager-image-masonry" GIỮ NGUYÊN trên phần tử grid thật bên
             trong, để listener click delegated không cần đổi selector) NGAY LÚC panel mở, chèn TRƯỚC
             #file-manager-image-empty — KHÔNG hardcode div masonry ở template tĩnh này nữa.
             SỬA (15/07/2026, Giang chỉ ra "layout chưa giống Google Photos") — BỎ px-3 py-3 (viền
             ngoài 12px) — Google Photos lưới ảnh SÁT MÉP MÀN HÌNH THẬT SỰ, không có viền ngoài nào
             (chỉ có khe hở 2px GIỮA các ô, xem .photo-grid ở assets/css/style.css). Text rỗng
             (#file-manager-image-empty) tự thêm px-6 RIÊNG (không dựa vào padding container nữa)
             để không dính sát mép khi không có ảnh nào. -->
        <div id="file-manager-image-scroll" class="flex-grow min-h-0 overflow-y-auto pb-20 relative">
            <p id="file-manager-image-empty" class="hidden text-sm text-slate-400 text-center py-10 px-6" data-i18n="fileManager.photo.image.empty">${t('fileManager.photo.image.empty')}</p>
        </div>
`;
}

/**
 * MỚI (Giai đoạn 3b, rewrite Photo/Album, mục 3a) — Album List sub-panel, push TỪ TRONG panel Photo
 * (event/workflow/file-manager-photo.js::openAlbumListPanel(), pushSettingsPanel() lồng nhau — ĐÚNG
 * khuôn Folder List -> Folder Detail đã có sẵn ở event/workflow/file-manager-song.js::
 * openFolderDetail(), KHÔNG cần xử lý gì đặc biệt cho "back" — popSettingsPanel() tự quay đúng panel
 * Photo bên dưới). List phân trang kiểu 'list' (buildPaginationListHtml(), core/pagination.js —
 * ĐÚNG chữ Giang dùng "pagination dạng list page"), ~10 album/trang — mỗi hàng dựng qua
 * itemTemplateAlbumListRow() (components/items.js).
 * KHÔNG dùng windowing (workflowPhotoGalleryWindow) — số album của 1 người dùng thực tế luôn nhỏ (hàng
 * chục, không phải hàng nghìn như ảnh/bài hát), render thẳng 1 trang (~10 hàng) là đủ mượt, đúng
 * tinh thần "computePage() + render thẳng" Folder List đang dùng (không windowing).
 */
/**
 * VIẾT LẠI (Giang yêu cầu "bỏ khung viền container, bỏ padding, gap margin — làm giống y hệt
 * Playlist UI") — bỏ HẲN card `glass-modal rounded-2xl` cũ (list giờ tràn viền edge-to-edge, đúng
 * style Songs list — core/playlist/render.js::buildSongNode()). Cũng bỏ luôn `<h2>` tiêu đề + nút
 * "+" tự dựng tay ở đây — TRÙNG LẶP với header CHUẨN của `pushSettingsPanel({title, ...})` (đã hiện
 * sẵn tiêu đề + nút Back, xem core/settings-panel-stack-ui.js) — nút "+" giờ dời sang
 * `headerActionHtml` (đối xứng nút Back, đúng khuôn panel Photo chính đang làm với nút upload).
 * Panel này giờ PHẢI mở với `fullBleed: true` (event/workflow/file-manager-photo.js::
 * openAlbumListPanel()) để list tràn viền thật — nếu không, khung `max-w-2xl mx-auto px-4/px-8` mặc
 * định của `pushSettingsPanel()` vẫn ép lề 2 bên.
 */
function renderFileManagerAlbumListPanelBody() {
    return `
        <div id="file-manager-album-list" class="flex flex-col"></div>
        <p id="file-manager-album-list-empty" class="hidden text-sm text-slate-400 p-4 text-center" data-i18n="fileManager.photo.albumList.empty">${t('fileManager.photo.albumList.empty')}</p>
        <!-- ~10 album/trang, mode 'list' (dãy số trang, KHÔNG nút ‹ ›) — xem core/pagination.js +
             event/workflow/file-manager-photo.js::refreshAlbumListPanel(). Rỗng nếu totalPages <= 1. -->
        <div id="file-manager-album-list-pagination" class="border-t border-white/5 px-4"></div>
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
                <!-- MỚI (14/07/2026, Giang yêu cầu — 50 tài liệu/trang, mode 'list') — xem
                     core/pagination.js + event/workflow/file-manager-document.js::refresh(). -->
                <div id="file-manager-document-pagination"></div>
`;
}

// ===================== Khu vực: Video (MỚI, 21/07/2026) =====================================
// Mirror renderFileManagerPhotoPanelBody() — đơn giản hơn hẳn: KHÔNG có Album (không chip lọc,
// không nút mở Album List). Nút upload + nút "xoá nhanh" ở headerActionHtml (xem
// event/workflow/file-manager-video.js::openPanel()/_buildHeaderActionHtml() — không hardcode ở
// đây, cùng khuôn Photo). Lưới video là CSS Grid full-width (KHÔNG fjGallery, xem
// event/workflow/video-gallery-window.js) — Workflow tự dựng cấu trúc "day-group + grid" NGAY LÚC
// panel mở, chèn TRƯỚC #file-manager-video-empty.
function renderFileManagerVideoPanelBody() {
    return `
        <!-- [SỬA — ver12 "Song/Video Unification", Batch 2] Checkbox "Video Player mode" (từng
             đứng đầu panel này) ĐÃ BỎ HẲN — entry point vào Video Player mode giờ DUY NHẤT qua
             Playlist + toggle Nguồn (xem plan-v12-song-video-unification.md mục 3, cleanup Batch 2). -->
        <div id="file-manager-video-scroll" class="flex-grow min-h-0 overflow-y-auto pb-20 relative">
            <p id="file-manager-video-empty" class="hidden text-sm text-slate-400 text-center py-10 px-6" data-i18n="fileManager.video.empty">${t('fileManager.video.empty')}</p>
        </div>
`;
}
