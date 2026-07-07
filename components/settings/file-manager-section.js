/**
 * Component (sub-template): Settings Drawer — Section "File Manager".
 * CHỐT 03/07/2026 (xem plan-v12-multimedia-decisions.md mục 1a/7): File Manager KHÔNG còn là 1
 * overlay/drawer cấp cao riêng (khác hẳn patch 02/07/2026 trước đó) — giờ chỉ là 1 section BÌNH
 * THƯỜNG trong Settings, cùng dạng card với "Hệ thống & Playlist"/"Kiểu hiệu ứng"... 3 hàng bên
 * dưới (Song / Photo & Album / Documents) bấm vào PUSH THẲNG sang drawer con tương ứng (xem
 * components/file-manager.js — TPL_FILE_MANAGER_SONG_DRAWER/_PHOTO_DRAWER/_DOCUMENT_DRAWER),
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
                <button id="setting-open-file-manager-document" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <span class="text-sm font-medium truncate" data-i18n="fileManager.entry.document">${t('fileManager.entry.document')}</span>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
                <!-- MỚI (04/07/2026, mục 2 phản hồi Giang) — công cụ dọn rác chung File Manager,
                     CỐ Ý đặt cuối cùng (sau mọi tính năng khác) — xem core/file-manager/cleanup.js
                     (registry) + event/workflow/file-manager-cleanup.js. -->
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
