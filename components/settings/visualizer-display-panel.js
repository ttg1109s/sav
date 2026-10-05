/**
 * Component: panel "Display" (push/pop Settings Stack, nav từ Main "Visualizer Screen") — 6
 * toggle: Hiện Visual + Show subtitles + 3 toggle UI chrome cố định (bottom player/playlist
 * button/control center button) + Stats panel. Trước đây 4 toggle sau nằm trong panel "Customize
 * Visualizer" (đã xoá), "Hiện Visual" trước đây tĩnh ở Main — gộp cả vào 1 panel riêng theo yêu
 * cầu Giang.
 *
 * SỬA (15/08/2026, chốt LẦN 2, Giang yêu cầu "Không header bao gồm toggle on/off visual, và panel
 * setting của subtitle. Section header 'Thành phần' cho các mục còn lại") — THAY HẲN cách chia 3
 * section riêng ở bản trước — giờ CHỈ 2 khối:
 *   1. KHÔNG có `<h3>` header — 1 card GỘP Visual enable + nút mở panel con "Phụ đề" (2 mục quan
 *      trọng nhất/hay dùng nhất, đặt lên đầu, không cần tiêu đề mô tả).
 *   2. Header "Thành phần" (visualizerSettingsDrawer.section.components) — 1 card GỘP CHUNG Stats
 *      panel + Bottom player + Playlist button + Control Center button (4 toggle UI chrome còn
 *      lại — TRƯỚC tách riêng "Hiển thị"/"Giao diện điều khiển", giờ gộp làm 1 theo đúng yêu cầu).
 *
 * CHUYỂN (mục 1, Giang yêu cầu "chuyển Show subtitles sang Display > section card COMPONENTS") —
 * toggle `#setting-subtitles-enabled` DỜI TỪ panel con "Phụ đề" (components/subtitle-settings-
 * drawer.js) SANG ĐÂY, đặt làm hàng ĐẦU TIÊN trong card "Thành phần" (mục 2). Nút mở panel con
 * "Phụ đề" NGAY DƯỚI (khối 1) giờ CHỈ còn dẫn tới Custom Styling + Transition — hint của nút đó
 * đổi từ tái dùng `.enable.hint` (giờ SAI nghĩa — đã là hint của chính toggle mới) sang key MỚI
 * `settingsSubtitleStyle.openPanel.hint`. ID mọi input GIỮ NGUYÊN — workflowVisualizerDisplay.
 * openDisplayPanel() (event/workflow/visualizer-display.js) query theo ID, không phụ thuộc cấu
 * trúc DOM cha/con — đồng bộ giá trị toggle mới CŨNG chuyển sang đúng hàm đó (KHÔNG còn ở
 * workflowSubtitleStyleSettings.refresh(), event/workflow/subtitle-style-settings.js).
 *
 * SỬA (05/10/2026, Giang yêu cầu) — panel đổi tên "Components Display"; bỏ khối 1 + tiêu đề "Thành phần": giờ CHỈ 1
 * card không tiêu đề — "Show effect" (đổi tên từ "Show visual", mô tả rút gọn) lên đầu card, tiếp theo Show subtitles +
 * Stats panel + 3 toggle UI chrome. Nút mở panel con "Subtitles" DỜI ra Settings > Visualizer Screen > Subtitles.
 * Mô tả các bản trước ở trên giữ làm lịch sử.
 *
 * SỬA (09/09/2026, Giang yêu cầu "xử lý triệt để dark cũ") — viết LẠI TRỰC TIẾP bằng bảng màu sáng,
 * không còn phụ thuộc `.app-settings-scope` đè màu (assets/css/layout-nav.css). Accent icon phụ đề
 * + tiêu đề "Thành phần" giữ nguyên tông yellow (đậm từ -400 lên -600 để đủ tương phản trên nền
 * trắng).
 */
function renderVisualizerDisplayPanelBody() {
    // SỬA 23/09/2026 (rà soát theme) — tham số cuối là cờ có viền dưới (màu viền theo key dividerBorder), trước là chuỗi class cứng border-slate-200.
    const toggleRow = (id, labelKey, hintKey, checked, hasBorder) => `
                        <div class="flex justify-between items-center p-4 ${hasBorder ? 'border-b' : ''}"${hasBorder ? ' data-uitk="dividerBorder"' : ''}>
                            <div class="pr-3">
                                <div class="text-sm font-medium truncate" data-uitk="textPrimary" data-i18n="${labelKey}">${t(labelKey)}</div>
                                <div class="text-xs mt-0.5" data-uitk="textSecondary" data-i18n="${hintKey}">${t(hintKey)}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="${id}" class="sr-only peer" ${checked ? 'checked' : ''}>
                                <div class="w-9 h-5 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all shadow-inner" data-uitk="toggleTrackOff toggleTrackOn"></div>
                            </label>
                        </div>`;

    // SỬA (05/10/2026, Giang yêu cầu) — CHỈ 1 card, KHÔNG tiêu đề nhóm: "Show effect" (đổi tên từ "Show visual") đứng đầu,
    // sau đó các toggle thành phần như cũ. Nút mở panel con "Subtitles" ĐÃ DỜI ra Visualizer Screen (row 'subtitle',
    // event/workflow/app-settings.js::_renderVisualizerScreen()).
    return `
        <div class="rounded-2xl flex flex-col overflow-hidden" data-uitk="cardBg cardBorder">
            ${toggleRow('setting-visual-enable', 'settingsVisualizer.visualEnable.label', 'settingsVisualizer.visualEnable.hint', true, true)}
            ${toggleRow('setting-subtitles-enabled', 'settingsSubtitleStyle.enable.label', 'settingsSubtitleStyle.enable.hint', true, true)}
            ${toggleRow('setting-stats-panel-enable', 'visualizerSettingsDrawer.statsPanelEnable.label', 'visualizerSettingsDrawer.statsPanelEnable.hint', false, true)}
            ${toggleRow('setting-bottom-player-enable', 'visualizerSettingsDrawer.bottomPlayerEnable.label', 'visualizerSettingsDrawer.bottomPlayerEnable.hint', false, true)}
            ${toggleRow('setting-playlist-button-enable', 'visualizerSettingsDrawer.playlistButtonEnable.label', 'visualizerSettingsDrawer.playlistButtonEnable.hint', false, true)}
            ${toggleRow('setting-control-center-button-enable', 'visualizerSettingsDrawer.controlCenterButtonEnable.label', 'visualizerSettingsDrawer.controlCenterButtonEnable.hint', false, false)}
            <div class="px-4 py-3 text-xs border-t" data-uitk="dividerBorder textSecondary" data-i18n="visualizerSettingsDrawer.uiToggleGroupHint">${t('visualizerSettingsDrawer.uiToggleGroupHint')}</div>
        </div>
`;
}
