/**
 * Component: Document Reader — cửa sổ đọc tài liệu (mục 4.b4/4.e plan-v12-multimedia.md, code
 * 04/07/2026).
 *
 * VIẾT LẠI LUỒNG MỞ (04/07/2026, mục 3 phản hồi Giang) — KHÔNG còn mở trực tiếp từ nút "Reader" ở
 * Control Center nữa. Luồng ĐÚNG: bấm "Reader" -> mở `#document-picker-drawer`
 * (components/document-picker-drawer.js, trắng, trượt từ dưới lên, 70vh, liệt kê tài liệu) TRƯỚC
 * -> chọn 1 tài liệu -> đóng picker drawer -> MỚI mở cửa sổ này. Nút "list" ở header (đổi tài liệu
 * khi đang đọc) cũng mở LẠI CHÍNH picker drawer đó — KHÔNG còn dropdown nhỏ riêng (đã xoá).
 *
 * Layout: KHÔNG full width/height — cửa sổ nổi (card) giữa màn hình, có backdrop mờ phía sau.
 * Header: tiêu đề (trái) + nút đóng X (phải), `justify-between`. Dưới header là khung body phân
 * trang (CSS multi-column — xem core/file-manager/document-ui.js).
 *
 * Z-INDEX (CHỐT theo phản hồi Giang): Reader PHẢI THẤP HƠN Control Center
 * (`#control-center-overlay` z-45/`#visualizer-control-center` z-46) — dùng z-39 (overlay)/z-40
 * (window). Cao hơn `#visualizer-ui` (z-30, chứa `#subtitle-display` z-60 NỘI BỘ — không ảnh hưởng
 * thứ tự toàn cục vì subtitle-display nằm LỒNG trong stacking context riêng của visualizer-ui).
 *
 * FIX (05/07/2026, mục 5 phản hồi Giang): chế độ Sửa đổi từ `<textarea>` thuần sang Toast UI Editor
 * (WYSIWYG, mount vào `#document-reader-edit-mount` — xem event/workflow/document-reader.js) —
 * content giờ là Markdown (`string`), không còn mảng đoạn văn.
 */
const TPL_DOCUMENT_READER = `
    <div id="document-reader-overlay" class="hidden fixed inset-0 z-[39] bg-black/70 pointer-events-auto"></div>
    <div id="document-reader-window" class="hidden fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-none">
        <div class="pointer-events-auto w-full max-w-2xl h-[78vh] max-h-[720px] bg-[#16161a] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-white/10 relative">

            <div class="flex justify-between items-center px-4 py-3 border-b border-white/10 shrink-0 gap-2">
                <div class="flex items-center gap-2 min-w-0">
                    <button id="btn-document-reader-list-toggle" class="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white shrink-0" data-i18n-title="documentReader.listTitle" title="${t('documentReader.listTitle')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
                    </button>
                    <h3 id="document-reader-title" class="text-sm font-bold text-white truncate"></h3>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <button id="btn-document-reader-edit" class="hidden w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white" data-i18n-title="documentReader.btnEdit" title="${t('documentReader.btnEdit')}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button id="btn-document-reader-close" class="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            </div>

            <div id="document-reader-body" class="flex-1 relative overflow-hidden px-6 py-5">
                <div id="document-reader-pages" class="text-slate-200 text-[15px]"></div>
                <p id="document-reader-empty" class="hidden text-sm text-slate-400 text-center py-10" data-i18n="documentReader.empty">${t('documentReader.empty')}</p>
            </div>

            <div id="document-reader-nav" class="flex items-center justify-between px-4 py-2.5 border-t border-white/10 shrink-0">
                <button id="btn-document-reader-prev" class="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white disabled:opacity-30" disabled>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                </button>
                <span id="document-reader-page-indicator" class="text-xs text-slate-400 font-mono">1 / 1</span>
                <button id="btn-document-reader-next" class="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white disabled:opacity-30" disabled>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            <!-- Chế độ Sửa (CHỈ tài liệu createdBy='user') — thay hẳn khung phân trang bằng Toast UI
                 Editor (WYSIWYG, mục 5 phản hồi Giang 05/07/2026 — trước đây là <textarea> thuần).
                 #document-reader-edit-mount là container RỖNG, mount/destroy Editor theo
                 enterEditMode()/cancelEdit()/saveEdit() (event/workflow/document-reader.js). -->
            <div id="document-reader-edit-mode" class="hidden absolute inset-0 bg-[#16161a] flex flex-col">
                <div class="flex justify-between items-center px-4 py-3 border-b border-white/10 shrink-0">
                    <h3 class="text-sm font-bold text-white" data-i18n="documentReader.editTitle">${t('documentReader.editTitle')}</h3>
                </div>
                <div id="document-reader-edit-mount" class="flex-1 min-h-0"></div>
                <div class="flex justify-end gap-2 px-4 py-3 border-t border-white/10 shrink-0">
                    <button id="btn-document-reader-edit-cancel" class="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors" data-i18n="common.cancel">${t('common.cancel')}</button>
                    <button id="btn-document-reader-edit-save" class="px-5 py-2 rounded-lg text-xs font-bold bg-sky-500 hover:bg-sky-400 text-white transition-colors" data-i18n="common.save">${t('common.save')}</button>
                </div>
            </div>
        </div>
    </div>
`;
