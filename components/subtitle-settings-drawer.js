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
 */
function renderSubtitlePanelBody() {
    return `
                <div>
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
                </div>
`;
}
