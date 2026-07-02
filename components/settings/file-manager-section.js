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
 * Đặt ngay sau section "Hệ thống & Playlist" (TPL_SETTINGS_PLAYLIST_BG) vì liên quan trực tiếp
 * tới nhạc/thư viện — xem thứ tự ghép ở components/settings-drawer.js.
 */
const TPL_SETTINGS_FILE_MANAGER = `

        <!-- SECTION: FILE MANAGER -->
        <div>
            <h3 class="text-xs font-bold text-teal-400 uppercase tracking-widest mb-2 ml-2" data-i18n="fileManager.sectionTitle">${t('fileManager.sectionTitle')}</h3>
            <div class="bg-white/5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                <button id="setting-open-file-manager-song" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                    <span class="text-sm font-medium" data-i18n="fileManager.entry.song">${t('fileManager.entry.song')}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
                <button id="setting-open-file-manager-photo" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                    <span class="text-sm font-medium" data-i18n="fileManager.entry.photo">${t('fileManager.entry.photo')}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
                <button id="setting-open-file-manager-document" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                    <span class="text-sm font-medium" data-i18n="fileManager.entry.document">${t('fileManager.entry.document')}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>
        </div>
`;
