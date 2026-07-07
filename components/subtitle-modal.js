/**
 * Component: Subtitle Editor Modal (màn hình toàn màn hình để quản lý / chỉnh sửa phụ đề)
 * Biến này chứa chuỗi HTML, được main.js chèn vào DOM lúc khởi động.
 *
 * Ver 8 refine: nút "Bật Sub"/"Tắt Sub" (#btn-toggle-sub) ĐÃ CHUYỂN sang Cài đặt > Khung & Chữ
 * Phụ đề (toggle "Hiện phụ đề", xem js/components/settings/subtitle-style.js) — modal này giờ
 * chỉ còn lo việc SOẠN nội dung phụ đề (tải .srt, canh giờ tự động, thêm dòng, xuất .srt), không
 * còn điều khiển hiển thị, đúng nguyên tắc "mọi tuỳ chọn hiển thị nằm trong Cài đặt".
 *
 * === REDESIGN (07/07/2026, phản hồi Giang mục 4 — "đẹp và chuyên nghiệp hơn") ===
 * Modal này ĐỘC LẬP với Settings Stack (ngang hàng kiến trúc, đã xác nhận với Giang 06/07/2026) —
 * KHÔNG dùng chung header/panel Settings, nhưng áp DÙNG chung NGÔN NGỮ THIẾT KẾ (header canh giữa
 * kiểu iOS + nút đóng dạng icon tròn, thay vì nút chữ "Đóng" to bản cũ) cho nhất quán toàn app.
 * 4 nút hành động ĐỔI từ "icon-only vuông to, chỉ có tooltip" sang "icon + nhãn chữ" (rõ ràng hơn,
 * không phải đoán qua tooltip — đặc biệt quan trọng vì 4 nút làm 4 việc RẤT khác nhau: tải lên,
 * canh giờ tự động, thêm dòng thủ công, xuất file). GIỮ NGUYÊN 100% id/data-action (#srt-upload,
 * #btn-auto-timing, #icon-auto-timing-idle/recording, #btn-add-sub, #btn-apply-sub,
 * #btn-export-srt, #sub-list-container, #sub-empty-state) — core/subtitle/subtitles.js KHÔNG cần
 * sửa gì (chỉ đổi khung/style xung quanh, không đổi hành vi/logic).
 */
const TPL_SUBTITLE_MODAL = `
    <div id="subtitle-modal" class="fixed inset-0 z-[110] bg-[#0f172a] transform translate-y-full transition-transform duration-300 flex flex-col">
        <div class="relative flex items-center justify-center px-14 py-3 sm:px-16 h-14 shrink-0 glass-modal">
            <h3 class="text-base sm:text-lg font-bold tracking-wider text-white uppercase truncate text-center flex items-center gap-2 justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
                <span data-i18n="subtitleModal.title">${t('subtitleModal.title')}</span>
            </h3>
            <button id="btn-close-sub-modal" class="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-rose-500 transition-colors text-white shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
        <div class="flex-grow flex flex-col gap-5 overflow-hidden w-full bg-[#0f172a]">

            <!-- Thanh hành động — icon + nhãn chữ (REDESIGN 07/07/2026, thay icon-only cũ chỉ có
                 tooltip, khó đoán việc khi 4 nút làm 4 việc khác hẳn nhau). -->
            <div class="grid grid-cols-4 gap-2 shrink-0 pt-4 sm:pt-6 px-4 sm:px-6">
                <label class="flex flex-col items-center gap-1.5 cursor-pointer group">
                    <div class="w-full aspect-square bg-blue-600 group-hover:bg-blue-500 rounded-2xl shadow-lg flex items-center justify-center transition-colors">
                        <input type="file" id="srt-upload" accept=".srt" class="hidden">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    </div>
                    <span class="text-[11px] font-medium text-slate-300 text-center truncate w-full" data-i18n="subtitleModal.btnUpload.title">${t('subtitleModal.btnUpload.title')}</span>
                </label>
                <button id="btn-auto-timing" class="flex flex-col items-center gap-1.5">
                    <div class="w-full aspect-square bg-rose-600 hover:bg-rose-500 rounded-2xl shadow-lg flex items-center justify-center transition-colors relative">
                        <svg id="icon-auto-timing-idle" class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        <svg id="icon-auto-timing-recording" class="w-6 h-6 text-white hidden" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="6" class="animate-pulse"></circle></svg>
                    </div>
                    <span class="text-[11px] font-medium text-slate-300 text-center truncate w-full" data-i18n="subtitleModal.btnAutoTiming.title">${t('subtitleModal.btnAutoTiming.title')}</span>
                </button>
                <button id="btn-add-sub" class="flex flex-col items-center gap-1.5">
                    <div class="w-full aspect-square bg-indigo-500 hover:bg-indigo-400 rounded-2xl shadow-lg flex items-center justify-center transition-colors">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    </div>
                    <span class="text-[11px] font-medium text-slate-300 text-center truncate w-full" data-i18n="subtitleModal.btnAddSub.title">${t('subtitleModal.btnAddSub.title')}</span>
                </button>
                <button id="btn-apply-sub" class="flex flex-col items-center gap-1.5">
                    <div class="w-full aspect-square bg-emerald-500 hover:bg-emerald-400 rounded-2xl shadow-lg flex items-center justify-center transition-colors">
                        <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <span class="text-[11px] font-medium text-slate-300 text-center truncate w-full" data-i18n="subtitleModal.btnApplySub.title">${t('subtitleModal.btnApplySub.title')}</span>
                </button>
            </div>

            <div class="flex justify-between items-center gap-4 px-5 shrink-0">
                <span class="text-xs font-bold text-slate-400 uppercase tracking-wider" data-i18n="subtitleModal.listHeading">${t('subtitleModal.listHeading')}</span>
                <button id="btn-export-srt" class="flex items-center gap-1.5 text-sky-400 hover:text-sky-300 text-xs font-semibold transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0l-4 4m4-4v12"></path></svg>
                    <span data-i18n="subtitleModal.btnExportSrt">${t('subtitleModal.btnExportSrt')}</span>
                </button>
            </div>

            <div id="sub-list-container" class="flex-grow overflow-y-auto pb-10 px-2">
                <div class="flex flex-col items-center justify-center h-full text-slate-500 gap-3 opacity-60" id="sub-empty-state">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <span class="font-medium text-sm" data-i18n="subtitleModal.listEmpty">${t('subtitleModal.listEmpty')}</span>
                </div>
            </div>
        </div>
    </div>
`;
