/**
 * Component: panel "Display" (push/pop Settings Stack, nav từ Main "Visualizer Screen") — 5
 * toggle: Hiện Visual + 3 toggle UI chrome cố định (bottom player/playlist button/control center
 * button) + Stats panel. Trước đây 4 toggle sau nằm trong panel "Customize Visualizer" (đã xoá),
 * "Hiện Visual" trước đây tĩnh ở Main — gộp cả 5 vào 1 panel riêng theo yêu cầu Giang.
 *
 * SỬA (15/08/2026, chốt LẦN 2, Giang yêu cầu "Không header bao gồm toggle on/off visual, và panel
 * setting của subtitle. Section header 'Thành phần' cho các mục còn lại") — THAY HẲN cách chia 3
 * section riêng ở bản trước — giờ CHỈ 2 khối:
 *   1. KHÔNG có `<h3>` header — 1 card GỘP Visual enable + nút mở panel con "Phụ đề" (2 mục quan
 *      trọng nhất/hay dùng nhất, đặt lên đầu, không cần tiêu đề mô tả).
 *   2. Header "Thành phần" (visualizerSettingsDrawer.section.components) — 1 card GỘP CHUNG Stats
 *      panel + Bottom player + Playlist button + Control Center button (4 toggle UI chrome còn
 *      lại — TRƯỚC tách riêng "Hiển thị"/"Giao diện điều khiển", giờ gộp làm 1 theo đúng yêu cầu).
 * ID mọi input GIỮ NGUYÊN — workflowVisualizerDisplay.openDisplayPanel() (event/workflow/
 * visualizer-display.js) query theo ID, không phụ thuộc cấu trúc DOM cha/con.
 */
function renderVisualizerDisplayPanelBody() {
    const toggleRow = (id, labelKey, hintKey, checked, borderClass) => `
                        <div class="flex justify-between items-center p-4 ${borderClass}">
                            <div class="pr-3">
                                <div class="text-sm font-medium truncate" data-i18n="${labelKey}">${t(labelKey)}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="${hintKey}">${t(hintKey)}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="${id}" class="sr-only peer" ${checked ? 'checked' : ''}>
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>`;

    return `
        <div class="flex flex-col gap-4">
            <!-- KHÔNG header — Visual enable + nút mở panel con "Phụ đề" (mục 2, phản hồi Giang
                 "vẫn cấp cho subtitle một sub panel ở trong Display Visualizer"). Panel con giờ
                 có thêm Styling + coming/in/outing (mục 4), xem components/subtitle-settings-
                 drawer.js. -->
            <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                ${toggleRow('setting-visual-enable', 'settingsVisualizer.visualEnable.label', 'settingsVisualizer.visualEnable.hint', true, 'border-b border-white/5')}
                <button id="setting-open-subtitle-panel" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                        <div class="min-w-0">
                            <!-- SỬA (15/08/2026) — TRƯỚC dùng 'settingsSubtitleStyle.openDrawer.label'/'.hint',
                                 2 KEY ĐÃ BỊ XOÁ khỏi lang (xem comment "XOÁ (mục 2)" ở lang/patch/
                                 patch-subtitle-settings.js) nhưng code cũ VẪN gọi t() với key đó (bug có
                                 sẵn, hiện text thô ra UI) — đổi đúng theo 2 key comment đó CHỈ ĐỊNH thay
                                 thế: tái dùng 'sectionTitle'/'.enable.hint'. -->
                            <div class="text-sm font-medium truncate" data-i18n="settingsSubtitleStyle.sectionTitle">${t('settingsSubtitleStyle.sectionTitle')}</div>
                            <div class="text-xs text-slate-400 mt-0.5 truncate" data-i18n="settingsSubtitleStyle.enable.hint">${t('settingsSubtitleStyle.enable.hint')}</div>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
            </div>

            <!-- SECTION: THÀNH PHẦN — gộp chung Stats panel + 3 toggle UI chrome cố định. -->
            <div>
                <h3 class="text-xs font-bold text-yellow-400 uppercase tracking-widest mb-2 ml-2" data-i18n="visualizerSettingsDrawer.section.components">${t('visualizerSettingsDrawer.section.components')}</h3>
                <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                    ${toggleRow('setting-stats-panel-enable', 'visualizerSettingsDrawer.statsPanelEnable.label', 'visualizerSettingsDrawer.statsPanelEnable.hint', false, 'border-b border-white/5')}
                    ${toggleRow('setting-bottom-player-enable', 'visualizerSettingsDrawer.bottomPlayerEnable.label', 'visualizerSettingsDrawer.bottomPlayerEnable.hint', false, 'border-b border-white/5')}
                    ${toggleRow('setting-playlist-button-enable', 'visualizerSettingsDrawer.playlistButtonEnable.label', 'visualizerSettingsDrawer.playlistButtonEnable.hint', false, 'border-b border-white/5')}
                    ${toggleRow('setting-control-center-button-enable', 'visualizerSettingsDrawer.controlCenterButtonEnable.label', 'visualizerSettingsDrawer.controlCenterButtonEnable.hint', false, '')}
                    <div class="px-4 py-3 text-xs text-slate-400 border-t border-white/5" data-i18n="visualizerSettingsDrawer.uiToggleGroupHint">${t('visualizerSettingsDrawer.uiToggleGroupHint')}</div>
                </div>
            </div>
        </div>
`;
}
