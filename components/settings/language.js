/**
 * Component (sub-template): Settings Drawer — Section "Ngôn ngữ" (MỚI, batch i18n).
 * Cùng pattern với 5 section khác trong js/components/settings/ — chỉ định nghĩa 1 biến
 * TPL_SETTINGS_* chứa HTML của riêng section này, JS xử lý thật ở js/core/language-settings.js.
 *
 * 3 phần:
 *   - <select id="setting-language-select">: liệt kê English (luôn có, cứng RAM) + mọi ngôn ngữ
 *     đã upload (đọc từ IndexedDB store `languages` — xem js/service/db.js, js/core/lang.js). Dựng
 *     <option> bằng JS (renderLanguageOptions() ở language-settings.js), không hard-code tĩnh ở
 *     đây vì danh sách phụ thuộc dữ liệu người dùng đã upload.
 *   - Nút "Tải lên ngôn ngữ mới (.json)" (label bọc input ẩn, đúng pattern setting-bg-upload/
 *     setting-video-upload đã dùng ổn định ở playlist-background.js — input[type=file] cần click
 *     NATIVE thật qua label, không gọi .click() bằng JS).
 *   - Nút "Xóa ngôn ngữ này" — chỉ HIỆN khi ngôn ngữ đang chọn KHÁC English (English luôn có sẵn,
 *     không thể xóa). Ẩn/hiện do JS (language-settings.js) tự bật/tắt theo lựa chọn hiện tại.
 */
const TPL_SETTINGS_LANGUAGE = `

        <!-- SECTION: NGÔN NGỮ (mới, batch i18n) -->
        <div>
            <h3 class="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2 ml-2" data-i18n="settingsLanguage.sectionTitle">${t('settingsLanguage.sectionTitle')}</h3>
            <div class="bg-white/5 rounded-2xl border border-white/10 flex flex-col overflow-hidden">
                <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                    <span class="text-sm font-medium flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 000 18M12.5 3a17 17 0 010 18M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span data-i18n="settingsLanguage.select.label">${t('settingsLanguage.select.label')}</span>
                    </span>
                    <select id="setting-language-select" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                        <!-- <option> dựng bằng JS — xem renderLanguageOptions() ở language-settings.js -->
                    </select>
                </div>
                <div class="flex justify-between items-center p-4 border-b border-white/5">
                    <span class="text-sm font-medium truncate" data-i18n="settingsLanguage.upload.label">${t('settingsLanguage.upload.label')}</span>
                    <label class="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 inline -mt-0.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3-3 3 3m-3-3v6" /></svg>
                        <span data-i18n="common.btn.upload">${t('common.btn.upload')}</span>
                        <input type="file" id="setting-language-upload" accept=".json,application/json" class="hidden">
                    </label>
                </div>
                <button id="setting-language-delete" class="hidden flex justify-between items-center p-4 hover:bg-rose-500/10 transition-colors w-full text-left">
                    <span class="text-sm font-medium text-rose-400" data-i18n="settingsLanguage.delete.label">${t('settingsLanguage.delete.label')}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
        </div>
`;
