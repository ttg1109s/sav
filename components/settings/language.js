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
 *
 * SỬA (09/09/2026, Giang yêu cầu "xử lý triệt để dark cũ") — bản gốc viết cho `#drawer-settings`
 * nền tối (glass-modal, border-white/5, bg-black/50 input, accent cyan-400) — nay sống hẳn trong
 * Generic Drawer nền trắng qua `.app-settings-scope` (đè màu CSS, xem assets/css/layout-nav.css).
 * Viết LẠI TRỰC TIẾP bằng đúng bảng màu sáng (bg-slate-50/border-slate-200 card, bg-white/
 * border-slate-300 input, accent sky) — KHÔNG còn phụ thuộc override để hiện đúng màu.
 */
const TPL_SETTINGS_LANGUAGE = `

        <!-- SECTION: NGÔN NGỮ (mới, batch i18n) -->
        <div>
            <h3 class="text-xs font-bold uppercase tracking-widest mb-2 ml-2" data-uitk="accentText" data-i18n="settingsLanguage.sectionTitle">${t('settingsLanguage.sectionTitle')}</h3>
            <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
                <div class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder cardHoverBg">
                    <span class="text-sm font-medium flex items-center gap-2">
                        ${iconSvg('globe', 'h-4 w-4', 'data-uitk="accentTextSoft"')}
                        <span data-i18n="settingsLanguage.select.label">${t('settingsLanguage.select.label')}</span>
                    </span>
                    <select id="setting-language-select" class="rounded-lg px-2 py-1.5 text-xs outline-none w-36 text-right" data-uitk="inputBg inputBorder inputText">
                        <!-- <option> dựng bằng JS — xem renderLanguageOptions() ở language-settings.js -->
                    </select>
                </div>
                <div class="flex justify-between items-center p-4 border-b" data-uitk="dividerBorder">
                    <span class="text-sm font-medium truncate" data-i18n="settingsLanguage.upload.label">${t('settingsLanguage.upload.label')}</span>
                    <label class="px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors shadow" data-uitk="btnPrimaryPillBg btnPrimaryPillHoverBg textOnAccent">
                        ${iconSvg('cloud-upload', 'h-4 w-4 inline -mt-0.5 mr-1')}
                        <span data-i18n="common.btn.upload">${t('common.btn.upload')}</span>
                        <input type="file" id="setting-language-upload" accept=".json,application/json" class="hidden">
                    </label>
                </div>
                <button id="setting-language-delete" class="hidden flex justify-between items-center p-4 transition-colors w-full text-left" data-uitk="hoverDestructiveBg">
                    <span class="text-sm font-medium" data-uitk="destructiveText" data-i18n="settingsLanguage.delete.label">${t('settingsLanguage.delete.label')}</span>
                    ${iconSvg('trash', 'h-5 w-5 shrink-0', 'data-uitk="destructiveText"')}
                </button>
            </div>
        </div>
`;
