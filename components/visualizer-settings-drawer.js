/**
 * Component: Visualizer Settings panel body ("Tùy chỉnh Visualizer" / "Customize Visualizer").
 *
 * === Batch D3 (Settings restructure, tiếp D1/D2) ===
 * TRƯỚC ĐÂY là `TPL_VISUALIZER_SETTINGS_DRAWER` (khung `fixed inset-0 drawer-glass z-[90]` + header
 * riêng, mount 1 lần lúc boot). GIỜ chỉ còn NỘI DUNG BODY của 1 panel — khung ngoài + header dùng
 * CHUNG ở `#drawer-settings` (core/settings-panel-stack.js), giống About/Subtitle.
 *
 * SỬA (12/08/2026, Giang yêu cầu tái cấu trúc Setting Main mục 4c/4f/4h) — panel này TRƯỚC ĐÂY có
 * 4 section (Geometry/Colors/Auto-switch/Display), giờ CHỈ CÒN 2 (Colors/Display) + 1 hàng điều
 * hướng MỚI (Cử chỉ):
 *   - "VISUALIZER GEOMETRY" (mục 4c) ĐÃ RỜI HẲN thành panel riêng "Custom Effect"
 *     (components/settings/visualizer-custom-effect-drawer.js), ngang hàng panel này ở Main.
 *   - "AUTO-SWITCH EFFECT" (mục 4f) ĐÃ RỜI HẲN thành panel riêng "Auto-Switch Effect"
 *     (components/settings/visualizer-auto-switch-drawer.js), CŨNG ngang hàng panel này.
 *   - "Cử chỉ" (mục 4h) DỜI VÀO ĐÂY từ Main (components/settings/visualizer-geometry-color.js) —
 *     nút #setting-open-gesture-settings GIỮ NGUYÊN 100%, bấm vẫn mở ĐÚNG panel Cử chỉ cũ (KHÔNG
 *     nhúng lồng gì cả — chỉ đổi panel CHA của nút bấm, từ Main sang panel này).
 *   - "VISUALIZER COLORS"/"VISUALIZER DISPLAY" (mục 4g) CHỈ đổi TÊN hiển thị -> "Colors"/"Display"
 *     (bớt chữ "Visualizer" thừa, đã ở trong panel Visualizer rồi) — VỊ TRÍ giữ nguyên, không di
 *     chuyển đi đâu.
 *
 * MỚI so với Subtitle: 2 input màu CẦN đồng bộ CHÉO lẫn nhau (`solid-color-picker` <->
 * `solid-color-text`, đổi bên này phải cập nhật bên kia) dùng `data-cross-target` — listener
 * delegate (event/listener/visualizer-display.js) đọc thuộc tính này để tìm đúng phần tử cần ghi,
 * KHÔNG cần core tự biết tên id của nhau.
 */
function renderVisualizerPanelBody() {
    return `
                <div>
                    <h3 class="text-xs font-bold text-rose-400 uppercase tracking-widest mb-2 ml-2" data-i18n="visualizerSettingsDrawer.colorSectionTitle">${t('visualizerSettingsDrawer.colorSectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <!-- XOÁ (v13) — hàng "Màu nền đen" (#bg-color-picker) ĐÃ DỜI sang panel
                             "Visual Background": nền màn Visualizer giờ gom về đúng 1 nơi (màu/ảnh/
                             video), và có thêm chế độ gradient. Card này chỉ còn màu VẼ của
                             visualizer, không còn màu NỀN. -->
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.colorMode.label">${t('visualizerSettingsDrawer.colorMode.label')}</span>
                            <select id="setting-color-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                <option value="solid" data-i18n="visualizerSettingsDrawer.colorMode.solid">${t('visualizerSettingsDrawer.colorMode.solid')}</option><option value="dynamic" data-i18n="visualizerSettingsDrawer.colorMode.dynamic">${t('visualizerSettingsDrawer.colorMode.dynamic')}</option><option value="gradient" data-i18n="visualizerSettingsDrawer.colorMode.gradient">${t('visualizerSettingsDrawer.colorMode.gradient')}</option>
                            </select>
                        </div>
                        <div id="solid-color-container" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors bg-black/20">
                            <span class="text-sm text-slate-300" data-i18n="visualizerSettingsDrawer.solidColor.label">${t('visualizerSettingsDrawer.solidColor.label')}</span>
                            <div class="flex items-center gap-2">
                                <input type="text" id="solid-color-text" data-cross-target="solid-color-picker" class="w-20 bg-transparent border-b border-white/20 px-1 py-0.5 text-xs text-white outline-none font-mono text-right uppercase">
                                <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" id="solid-color-picker" data-cross-target="solid-color-text" class="w-10 h-10 -m-1 cursor-pointer"></div>
                            </div>
                        </div>
                        <div id="dynamic-color-container" class="hidden flex justify-between items-center p-4 hover:bg-white/5 transition-colors bg-black/20">
                            <span class="text-sm text-slate-300" data-i18n="visualizerSettingsDrawer.dynamicColor.label">${t('visualizerSettingsDrawer.dynamicColor.label')}</span>
                            <div class="flex items-center gap-2">
                                <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" id="dyn-color-a" class="w-10 h-10 -m-1 cursor-pointer"></div>
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                                <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" id="dyn-color-b" class="w-10 h-10 -m-1 cursor-pointer"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECTION: HIỂN THỊ VISUALIZER — dải BPM/Pitch/Energy (dời từ nút Control
                     Center) + 3 toggle RIÊNG hiện/ẩn từng thành phần UI cố định (bỏ hẳn "full
                     mode" gộp chung) — vẫn mở lại được qua cử chỉ vuốt rìa dù đang tắt, xem
                     event/workflow/visualizer-gesture.js. NHẤT QUÁN đặt tên KHẲNG ĐỊNH + mặc định
                     BẬT với statsPanelEnable. MỖI HÀNG 1 MÔ TẢ RIÊNG, tả ĐÚNG thành phần đó là gì
                     (cùng khuôn statsPanelEnable.hint — phản hồi Giang: "đã bảo mỗi dòng một mô
                     tả, tham khảo mô tả stats") — KHÔNG lặp lại y hệt "tắt để ẩn..." ở cả 3 hàng
                     nữa (bản trước đó gộp chung 1 dòng cũng SAI Ý — Giang muốn mô tả RIÊNG, không
                     phải bỏ mô tả). Cơ chế "vuốt rìa mở lại" dùng CHUNG cho cả 3 nên vẫn giữ 1 dòng
                     chú thích cuối card — đó là chi tiết CƠ CHẾ, khác với mô tả THÀNH PHẦN từng hàng. -->
                <div>
                    <h3 class="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2 ml-2" data-i18n="visualizerSettingsDrawer.displaySectionTitle">${t('visualizerSettingsDrawer.displaySectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.statsPanelEnable.label">${t('visualizerSettingsDrawer.statsPanelEnable.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="visualizerSettingsDrawer.statsPanelEnable.hint">${t('visualizerSettingsDrawer.statsPanelEnable.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-stats-panel-enable" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.bottomPlayerEnable.label">${t('visualizerSettingsDrawer.bottomPlayerEnable.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="visualizerSettingsDrawer.bottomPlayerEnable.hint">${t('visualizerSettingsDrawer.bottomPlayerEnable.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-bottom-player-enable" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.playlistButtonEnable.label">${t('visualizerSettingsDrawer.playlistButtonEnable.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="visualizerSettingsDrawer.playlistButtonEnable.hint">${t('visualizerSettingsDrawer.playlistButtonEnable.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-playlist-button-enable" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.controlCenterButtonEnable.label">${t('visualizerSettingsDrawer.controlCenterButtonEnable.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="visualizerSettingsDrawer.controlCenterButtonEnable.hint">${t('visualizerSettingsDrawer.controlCenterButtonEnable.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-control-center-button-enable" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="px-4 py-3 text-xs text-slate-400" data-i18n="visualizerSettingsDrawer.uiToggleGroupHint">${t('visualizerSettingsDrawer.uiToggleGroupHint')}</div>
                    </div>
                </div>

                <!-- MỚI (12/08/2026, Giang yêu cầu mục 4h) — "Cử chỉ" DỜI VÀO ĐÂY từ Main
                     (components/settings/visualizer-geometry-color.js) — nút GIỮ NGUYÊN 100% id,
                     bấm vẫn mở ĐÚNG panel Cử chỉ cũ (components/gesture-settings-drawer.js), KHÔNG
                     nhúng lồng gì cả, chỉ đổi panel CHA của nút. -->
                <button id="setting-open-gesture-settings" class="flex justify-between items-center p-4 glass-modal rounded-2xl hover:bg-white/5 transition-colors w-full text-left">
                    <div class="flex items-center gap-3 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-fuchsia-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11.5V9a2 2 0 114 0v1.5M11 9.5V6a2 2 0 114 0v5m0-3.5V8a2 2 0 114 0v4c0 4-2 6-6 6s-5.5-1-7-4l-1.5-3a1.7 1.7 0 012.6-2.1L8 10" /></svg>
                        <div class="min-w-0">
                            <div class="text-sm font-medium truncate" data-i18n="settingsVisualizer.gesture.label">${t('settingsVisualizer.gesture.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5 truncate" data-i18n="settingsVisualizer.gesture.hint">${t('settingsVisualizer.gesture.hint')}</div>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                </button>
`;
}
