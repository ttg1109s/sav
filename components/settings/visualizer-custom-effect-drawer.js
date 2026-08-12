/**
 * Component: panel body "Custom Effect" (components/settings/visualizer-geometry-color.js mở qua
 * #setting-open-visualizer-custom-effect, panel RIÊNG ngang hàng "Customize Visualizer").
 *
 * MỚI (12/08/2026, Giang yêu cầu tái cấu trúc Setting Main mục 4c/4d) — TÁCH từ card "VISUALIZER
 * GEOMETRY" cũ (từng là 1 trong 4 section bên trong panel "Customize Visualizer", components/
 * visualizer-settings-drawer.js) thành panel RIÊNG, đổi tên "Custom Effect" — ĐÚNG NGUYÊN markup
 * cũ, CHỈ bỏ 2 hàng "Chất lượng render" (#setting-quality) + "Làm mờ" (#setting-blur-enable) —
 * 2 hàng đó dời sang card "Visualizer Screen" ở Main (mục 4b/4d, xem
 * components/settings/visualizer-geometry-color.js), phần còn lại (Max height/Bar width/Vortex
 * style/Bar style+mirror count/Rain style+glass flash+3 toggle cảnh) GIỮ NGUYÊN 100% id/markup —
 * KHÔNG đổi gì về JS xử lý, vì:
 *   - Toàn bộ listener liên quan (VISUALIZER_DISPLAY_INPUT_MAP, event/listener/
 *     visualizer-display.js) DELEGATE trên `settingsStackBody` (khung CHUNG chứa MỌI panel, kể cả
 *     Main) — chuyển panel body này KHÔNG ảnh hưởng gì tới việc bắt sự kiện, chỉ cần id giữ nguyên.
 *   - Hiện/ẩn đúng khối theo kiểu hiệu ứng (block-max-height/block-bar-width/block-vortex/
 *     block-bar-style/block-rain) do updateTypeUI() (core/visualizer/visualizer-display.js) tự
 *     `document.getElementById()` TƯƠI mỗi lần gọi (HOTFIX 2, xem docstring hàm đó) — KHÔNG cache
 *     tham chiếu tĩnh, nên hoạt động đúng bất kể khối đang nằm trong panel nào, miễn panel đó đang
 *     mở lúc hàm chạy — xem event/workflow/visualizer-display.js::openCustomEffectPanel() (hàm MỚI,
 *     gọi updateTypeUI()/updateBarStyleUI() SAU khi push panel này, THAY vì trong openPanel() cũ).
 */
function renderVisualizerCustomEffectPanelBody() {
    return `
                <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                    <div id="block-max-height" class="flex flex-col w-full">
                        <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.maxHeight.label">${t('visualizerSettingsDrawer.maxHeight.label')}</span><span id="val-max" class="text-xs text-emerald-400 font-mono">400</span></div>
                            <input type="range" id="setting-max-height" data-value-target="val-max" min="50" max="1000" step="10" class="setting-slider">
                        </div>
                    </div>
                    <div id="block-bar-width" class="hidden flex-col w-full">
                        <div class="flex flex-col p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.barWidth.label">${t('visualizerSettingsDrawer.barWidth.label')}</span><span id="val-width" class="text-xs text-emerald-400 font-mono">4</span></div>
                            <input type="range" id="setting-bar-width" data-value-target="val-width" min="1" max="15" step="1" class="setting-slider">
                        </div>
                    </div>
                    <div id="block-vortex" class="hidden flex justify-between items-center p-4 hover:bg-white/5 transition-colors bg-indigo-900/10 border-b border-indigo-500/20">
                        <div><div class="text-sm font-medium text-indigo-300" data-i18n="visualizerSettingsDrawer.vortexStyle.label">${t('visualizerSettingsDrawer.vortexStyle.label')}</div></div>
                        <select id="setting-vortex-style" class="bg-black/60 border border-indigo-500/30 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-44 text-right">
                            <option value="rings" data-i18n="visualizerSettingsDrawer.vortexStyle.rings">${t('visualizerSettingsDrawer.vortexStyle.rings')}</option>
                            <option value="bars" data-i18n="visualizerSettingsDrawer.vortexStyle.bars">${t('visualizerSettingsDrawer.vortexStyle.bars')}</option>
                            <option value="wave" data-i18n="visualizerSettingsDrawer.vortexStyle.wave">${t('visualizerSettingsDrawer.vortexStyle.wave')}</option>
                        </select>
                    </div>
                    <div id="block-bar-style" class="hidden flex-col bg-emerald-900/10 border-b border-emerald-500/20">
                        <div class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors border-b border-emerald-500/10">
                            <div><div class="text-sm font-medium text-emerald-300" data-i18n="visualizerSettingsDrawer.barStyle.label">${t('visualizerSettingsDrawer.barStyle.label')}</div></div>
                            <select id="setting-bar-style" class="bg-black/60 border border-emerald-500/30 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right">
                                <option value="mirror" data-i18n="visualizerSettingsDrawer.barStyle.mirror">${t('visualizerSettingsDrawer.barStyle.mirror')}</option>
                                <option value="cascade" data-i18n="visualizerSettingsDrawer.barStyle.cascade">${t('visualizerSettingsDrawer.barStyle.cascade')}</option>
                            </select>
                        </div>
                        <div id="bar-mirror-options" class="hidden flex-col">
                            <div class="flex flex-col p-4 border-b border-emerald-500/10 hover:bg-white/5 transition-colors">
                                <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium text-emerald-300" data-i18n="visualizerSettingsDrawer.mirrorCount.label">${t('visualizerSettingsDrawer.mirrorCount.label')}</span><span id="val-mirror-count" class="text-xs text-emerald-400 font-mono">32</span></div>
                                <input type="range" id="setting-mirror-count" data-value-target="val-mirror-count" min="10" max="32" step="1" class="setting-slider">
                            </div>
                        </div>
                    </div>
                    <div id="block-rain" class="hidden flex-col bg-blue-900/10 border-b border-blue-500/20">
                        <div class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors border-b border-blue-500/10">
                            <div><div class="text-sm font-medium text-blue-300" data-i18n="visualizerSettingsDrawer.rainStyle.label">${t('visualizerSettingsDrawer.rainStyle.label')}</div></div>
                            <select id="setting-rain-style" class="bg-black/60 border border-blue-500/30 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                <option value="glass" data-i18n="visualizerSettingsDrawer.rainStyle.glass">${t('visualizerSettingsDrawer.rainStyle.glass')}</option><option value="street" data-i18n="visualizerSettingsDrawer.rainStyle.street">${t('visualizerSettingsDrawer.rainStyle.street')}</option>
                            </select>
                        </div>
                        <div class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors border-b border-blue-500/10">
                            <div><div class="text-sm font-medium text-blue-300" data-i18n="visualizerSettingsDrawer.glassFlash.label">${t('visualizerSettingsDrawer.glassFlash.label')}</div></div>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="setting-glass-flash" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <!-- CHỈ style 'glass' mới có 3 lớp cảnh Trăng/Big City/Khung cửa sổ, hiện/ẩn
                             theo rainStyle qua updateRainStyleUI() (core/visualizer/
                             visualizer-display.js), gọi từ setRainStyle() (workflow) +
                             updateTypeUI() (mở panel/đổi type). -->
                        <div id="rain-glass-options" class="hidden flex-col">
                            <div class="flex flex-col p-4 border-b border-blue-500/10 hover:bg-white/5 transition-colors">
                                <div class="flex justify-between items-center mb-2"><span class="text-sm font-medium text-blue-300" data-i18n="visualizerSettingsDrawer.rainCityOpacity.label">${t('visualizerSettingsDrawer.rainCityOpacity.label')}</span><span id="val-rain-city-opacity" class="text-xs text-blue-400 font-mono">40</span></div>
                                <input type="range" id="setting-rain-city-opacity" data-value-target="val-rain-city-opacity" min="0" max="100" step="5" class="setting-slider">
                            </div>
                            <div class="flex justify-between items-center p-4 border-b border-blue-500/10 hover:bg-white/5 transition-colors">
                                <span class="text-sm font-medium text-blue-300" data-i18n="visualizerSettingsDrawer.rainCityVisible.label">${t('visualizerSettingsDrawer.rainCityVisible.label')}</span>
                                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input type="checkbox" id="setting-rain-city-visible" class="sr-only peer">
                                    <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                                </label>
                            </div>
                            <div class="flex justify-between items-center p-4 border-b border-blue-500/10 hover:bg-white/5 transition-colors">
                                <span class="text-sm font-medium text-blue-300" data-i18n="visualizerSettingsDrawer.rainMoonVisible.label">${t('visualizerSettingsDrawer.rainMoonVisible.label')}</span>
                                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input type="checkbox" id="setting-rain-moon-visible" class="sr-only peer">
                                    <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                                </label>
                            </div>
                            <div class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors">
                                <span class="text-sm font-medium text-blue-300" data-i18n="visualizerSettingsDrawer.rainWindowVisible.label">${t('visualizerSettingsDrawer.rainWindowVisible.label')}</span>
                                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                    <input type="checkbox" id="setting-rain-window-visible" class="sr-only peer">
                                    <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                    <!-- (Phần B, Galaxy — dropdown kiểu con + 4 slider tinh chỉnh reroll/jump ĐÃ BỎ
                         HẲN 21/07/2026, phản hồi Giang mục 1 — 4 giá trị đó giờ là hằng số cố định
                         trong event/workflow/visualizer-render.js, không còn UI chỉnh. Kiểu hiệu
                         ứng "Space" vẫn chọn được bình thường qua Control Center/Action, CHỈ bỏ
                         panel tinh chỉnh chi tiết này.) -->
                </div>
`;
}
