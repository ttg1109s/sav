/**
 * Component (sub-template): Settings Drawer — Section "File Manager".
 * CHỐT 03/07/2026 (xem plan-v12-multimedia-decisions.md mục 1a/7): File Manager KHÔNG còn là 1
 * overlay/drawer cấp cao riêng (khác hẳn patch 02/07/2026 trước đó) — giờ chỉ là 1 section BÌNH
 * THƯỜNG trong Settings, cùng dạng card với "Hệ thống & Playlist"/"Kiểu hiệu ứng"... 2 hàng bên
 * dưới (Song / Photo & Album) bấm vào PUSH THẲNG sang drawer con tương ứng (xem
 * components/file-manager.js — TPL_FILE_MANAGER_SONG_DRAWER/_PHOTO_DRAWER),
 * đúng pattern nav-stack `#setting-open-about` -> `#drawer-about` đã có sẵn — KHÔNG có màn "File
 * Manager" trung gian nào nằm giữa.
 *
 * Tái tổ chức (07/07/2026, phản hồi Giang mục 2) — đặt SAU "Phụ đề" (không còn ngay sau "Playlist"
 * như trước) — thứ tự 8 section giờ theo mức độ dùng thường xuyên, xem components/settings-
 * drawer.js để biết thứ tự đầy đủ + lý do.
 */
const TPL_SETTINGS_FILE_MANAGER = `

        <!-- SECTION: FILE MANAGER -->
        <div>
            <h3 class="text-xs font-bold text-teal-400 uppercase tracking-widest mb-2 ml-2" data-i18n="fileManager.sectionTitle">${t('fileManager.sectionTitle')}</h3>
            <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                <button id="setting-open-file-manager-song" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19V6l12-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" /></svg>
                        <span class="text-sm font-medium truncate" data-i18n="fileManager.entry.song">${t('fileManager.entry.song')}</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
                <button id="setting-open-file-manager-photo" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        <span class="text-sm font-medium truncate" data-i18n="fileManager.entry.photo">${t('fileManager.entry.photo')}</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
                <!-- XOÁ (ver12 "Song/Video Unification", Batch 6, mục 6d, phản hồi Giang) — hàng
                     "Video" riêng (từng đứng SAU Photo & Album) đã gộp hẳn vào "Song & Video" (hàng
                     đầu, Batch 5) — panel Video độc lập không còn tồn tại. XOÁ (loại bỏ Document
                     Reader khỏi app) — hàng "Documents" (từng đứng ngay đây) cũng bỏ hẳn, Photo giờ
                     là hàng cuối trước "Quản lý lưu trữ" nên giữ nguyên class border-b. -->
                <!-- MỚI (29/07/2026, yêu cầu Giang mục 2) — "Quản lý lưu trữ": panel MỚI gộp thống
                     kê dung lượng (3 domain: Song/Video/Photo) + chọn mục xoá + dọn file lỗi + dọn
                     dẹp dữ liệu — xem
                     components/file-manager-storage.js. THAY panel "Song & Video" cũ đã xoá (hàng
                     "Song & Video" phía trên giờ mở THẲNG Generic Drawer duyệt thư mục, không còn
                     panel trung gian nào để chứa các mục này nữa). Nút "Dọn dẹp dữ liệu" (trước ở
                     cuối section này, mục 04/07/2026) ĐÃ DỜI HẲN vào bên trong panel MỚI — hàng NÀY
                     giờ là hàng cuối thật sự của section. -->
                <button id="setting-open-file-manager-storage" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0H4" /></svg>
                        <span class="text-sm font-medium truncate" data-i18n="storageDrawer.title">${t('storageDrawer.title')}</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        </div>
`;
