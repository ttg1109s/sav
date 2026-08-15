/**
 * Component: panel con "Phụ đề" (mục 2, phản hồi Giang — "loại bỏ toàn bộ khung box của
 * subtitles, chỉ giữ lại text trắng và shadow, toàn bộ tuỳ chọn -> xoá") — NESTED bên trong panel
 * "Display" (mục 2 tiếp — "vẫn cấp cho subtitle một sub panel ở trong Display Visualizer"), mở
 * qua nút `#setting-open-subtitle-panel` (components/settings/visualizer-display-panel.js).
 *
 * === VIẾT LẠI TOÀN BỘ (mục 2) === Trước đây file này ("Tùy chỉnh Phụ đề") có 10 input style
 * (màu/độ trong suốt nền, màu/độ trong suốt/độ dày/độ uốn viền khung, màu chữ, cỡ chữ, line-
 * height, letter-spacing) — TOÀN BỘ ĐÃ XOÁ. Khung nền phụ đề (bg/border/blur/shadow) không còn
 * tồn tại — chỉ còn chữ trắng + shadow CỐ ĐỊNH qua CSS tĩnh (`.sub-text-glow` + class `text-white`
 * gắn thẳng trên từng dòng phụ đề, xem core/subtitle/subtitle-display.js::addActiveSubBlock()) —
 * panel này giờ CHỈ còn ĐÚNG 1 toggle bật/tắt, đồng bộ qua
 * `workflowSubtitleStyleSettings.refresh()` (event/workflow/subtitle-style-settings.js).
 *
 * MỚI (15/08/2026, mục 4a) — thêm nút "Styling" mở Element Style Editor (event/workflow/
 * element-style-editor.js) áp CHUNG lên `subtitleFrame` (khung bao mọi dòng phụ đề đang active,
 * KHÔNG áp riêng từng dòng — xem event/workflow/subtitle-style-settings.js::openStyling()).
 *
 * MỚI (15/08/2026, mục 4b) — 3 hàng Comming/In/Outing (_renderSubtitleTransitionSection()) — đọc
 * `SUBTITLE_TRANSITION_EFFECTS`/`SUBTITLE_IN_EFFECTS` (core/subtitle/subtitle-transition.js) để
 * dựng option — file NÀY PHẢI nạp SAU file đó (xem index.html).
 */
function renderSubtitlePanelBody() {
    return `
                <div class="flex flex-col gap-4">
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4">
                            <div class="pr-3">
                                <div class="text-sm font-medium truncate" data-i18n="settingsSubtitleStyle.enable.label">${t('settingsSubtitleStyle.enable.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="settingsSubtitleStyle.enable.hint">${t('settingsSubtitleStyle.enable.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-subtitles-enabled" class="sr-only peer" checked>
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                    </div>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <button id="setting-open-subtitle-styling" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                            <div class="flex items-center gap-3 min-w-0">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10M12 17v4M5 3h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" /></svg>
                                <div class="min-w-0">
                                    <div class="text-sm font-medium truncate" data-i18n="settingsSubtitleStyle.styling.label">${t('settingsSubtitleStyle.styling.label')}</div>
                                    <div class="text-xs text-slate-400 mt-0.5 truncate" data-i18n="settingsSubtitleStyle.styling.hint">${t('settingsSubtitleStyle.styling.hint')}</div>
                                </div>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                    ${_renderSubtitleTransitionSection()}
                </div>
`;
}

/** MỚI (15/08/2026, mục 4b) — 3 hàng Comming/In/Outing. Dropdown effect DÙNG CHUNG cho MỌI dòng
 * phụ đề (KHÔNG lưu riêng từng dòng) — khung giờ thực tế mỗi dòng tự tính lúc phát dựa trên chính
 * start/end dòng đó (core/subtitle/subtitle-transition.js), xem event/workflow/subtitle-style-
 * settings.js. Comming/Outing có thêm 1 dropdown DẤU (+/-, MỚI — Giang yêu cầu "thêm dropdown tuỳ
 * chọn +-", THAY cho input số ÂM/DƯƠNG gộp chung trước đó) + 1 nút ĐỘ LỚN thuần dương [0,5] — nút
 * này SỬA (16/08/2026, mục 3) mở modal "bánh xe cuộn số" DÙNG CHUNG (core/time-picker-modal.js,
 * format 's-ms', TỪNG là `<input type="number" step="0.001">` thô) — Workflow tự GHÉP dấu (+/-) +
 * kết quả modal thành mili giây CÓ DẤU lúc ghi state (xem event/workflow/subtitle-style-
 * settings.js::openMagnitudePicker(), event/listener/subtitle-style-settings.js cho phần dấu).
 * Biên [0,5] — SUBTITLE_TRANSITION_MAX_MS, core/subtitle/subtitle-transition.js — biên ÁP DỤNG
 * THỰC TẾ còn bị kẹp thêm theo 1/3 tổng thời lượng từng dòng, nhắc rõ trong hint. "In" KHÔNG có nút
 * này (hiệu ứng LIÊN TỤC suốt lúc hiển thị, không có mốc thời gian riêng). */
function _renderSubtitleTransitionSection() {
    const effectOptions = (map) => {
        let opts = `<option value="none">${t('settingsSubtitleStyle.effect.none')}</option>`;
        Object.keys(map).forEach((key) => { opts += `<option value="${key}">${t(`settingsSubtitleStyle.effect.${key}`)}</option>`; });
        return opts;
    };
    // SỬA (16/08/2026, mục 3 — Giang hỏi "sao ô nhập s không dùng timer picker modal với đơn vị
    // s:ms?") — `<input type="number" step="0.001">` cũ ĐỔI thành `<button>` mở modal "bánh xe cuộn
    // số" DÙNG CHUNG (core/time-picker-modal.js::openTimePickerModal(), format 's-ms' — CÙNG hệ
    // token 's:ms' đã dùng cho Slideshow transitionDuration, xem event/workflow/slideshow.js::
    // openTransitionDurationPicker()) — id GIỮ NGUYÊN (setting-subtitle-${prefix}-magnitude) để
    // event/listener/subtitle-style-settings.js tra cứu không đổi, chỉ đổi Ý NGHĨA sự kiện wire
    // ('click' mở modal, KHÔNG còn 'change' đọc .value trực tiếp) — xem
    // event/workflow/subtitle-style-settings.js::openMagnitudePicker(). `data-ms` = giá trị mili
    // giây ĐANG có (Workflow tự đồng bộ mỗi lần đổi, KHÔNG cần đọc ngược từ chữ hiển thị).
    const valueField = (prefix) => `
                            <select id="setting-subtitle-${prefix}-sign" class="bg-black/50 border border-white/10 rounded-lg px-1.5 py-1.5 text-xs text-white outline-none">
                                <option value="+">+</option>
                                <option value="-">−</option>
                            </select>
                            <button type="button" id="setting-subtitle-${prefix}-magnitude" data-ms="0" class="w-16 bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none text-right hover:bg-white/10 transition-colors">0.0s</button>`;

    return `
                    <div>
                        <h3 class="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-2 ml-2" data-i18n="settingsSubtitleStyle.transition.sectionTitle">${t('settingsSubtitleStyle.transition.sectionTitle')}</h3>
                        <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                            <div class="flex flex-col gap-2 p-4 border-b border-white/5">
                                <div class="flex justify-between items-center gap-2">
                                    <span class="text-sm font-medium" data-i18n="settingsSubtitleStyle.comming.label">${t('settingsSubtitleStyle.comming.label')}</span>
                                    <div class="flex items-center gap-2">
                                        <select id="setting-subtitle-comming-effect" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none">${effectOptions(SUBTITLE_TRANSITION_EFFECTS)}</select>
                                        ${valueField('comming')}
                                    </div>
                                </div>
                                <p class="text-[11px] text-slate-500" data-i18n="settingsSubtitleStyle.transition.hint">${t('settingsSubtitleStyle.transition.hint')}</p>
                            </div>
                            <div class="flex justify-between items-center p-4 border-b border-white/5 gap-2">
                                <span class="text-sm font-medium" data-i18n="settingsSubtitleStyle.in.label">${t('settingsSubtitleStyle.in.label')}</span>
                                <select id="setting-subtitle-in-effect" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none">${effectOptions(SUBTITLE_IN_EFFECTS)}</select>
                            </div>
                            <div class="flex justify-between items-center p-4 gap-2">
                                <span class="text-sm font-medium" data-i18n="settingsSubtitleStyle.outing.label">${t('settingsSubtitleStyle.outing.label')}</span>
                                <div class="flex items-center gap-2">
                                    <select id="setting-subtitle-outing-effect" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none">${effectOptions(SUBTITLE_TRANSITION_EFFECTS)}</select>
                                    ${valueField('outing')}
                                </div>
                            </div>
                        </div>
                    </div>
`;
}
