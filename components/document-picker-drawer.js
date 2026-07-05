/**
 * Component: Document Picker Drawer — VIẾT LẠI HOÀN TOÀN theo phản hồi Giang (04/07/2026, mục 3):
 * "Reader" ở Control Center KHÔNG mở thẳng cửa sổ đọc nữa — mở drawer NÀY trước (trắng, trượt từ
 * dưới lên, chiếm 70% màn hình, liệt kê tài liệu) — chọn 1 tài liệu MỚI đóng drawer này lại rồi
 * mới mở `#document-reader-window` (components/document-reader.js). File Manager -> Documents
 * (Settings) giờ CHỈ còn CRUD (upload/tạo/đổi tên/xoá) — KHÔNG còn mở Reader khi bấm vào hàng.
 *
 * Dùng CHUNG cho CẢ 2 ngữ cảnh: (a) bấm "Reader" ở Control Center lần đầu, (b) bấm nút đổi tài
 * liệu ngay trong Reader đang mở — cả 2 đều mở ĐÚNG 1 drawer này (xem
 * event/workflow/document-picker.js).
 */
const TPL_DOCUMENT_PICKER_DRAWER = `
    <div id="document-picker-overlay" class="hidden fixed inset-0 z-[39] bg-black/50 pointer-events-auto"></div>
    <div id="document-picker-drawer" class="hidden fixed inset-x-0 bottom-0 z-40 h-[70vh] bg-white rounded-t-3xl shadow-2xl flex flex-col transform translate-y-full transition-transform duration-300 ease-out pointer-events-auto">
        <div class="flex justify-center pt-3 pb-1 shrink-0">
            <div class="w-10 h-1.5 rounded-full bg-slate-300"></div>
        </div>
        <div class="flex justify-between items-center px-5 pb-3 border-b border-slate-200 shrink-0">
            <h3 class="text-base font-bold text-slate-900" data-i18n="documentPicker.title">${t('documentPicker.title')}</h3>
            <button id="btn-document-picker-close" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        <div id="document-picker-list" class="flex-1 overflow-y-auto px-4 py-3"></div>
        <p id="document-picker-empty" class="hidden text-sm text-slate-400 text-center py-10" data-i18n="documentPicker.empty">${t('documentPicker.empty')}</p>
    </div>
`;
