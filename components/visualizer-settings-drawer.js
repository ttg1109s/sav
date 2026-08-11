/**
 * Component: Visualizer Settings panel body ("Tùy chỉnh Visualizer").
 *
 * === Batch D3 (Settings restructure, tiếp D1/D2) ===
 * TRƯỚC ĐÂY là `TPL_VISUALIZER_SETTINGS_DRAWER` (khung `fixed inset-0 drawer-glass z-[90]` + header
 * riêng, mount 1 lần lúc boot). GIỜ chỉ còn NỘI DUNG BODY của 1 panel — khung ngoài + header dùng
 * CHUNG ở `#drawer-settings` (core/settings-panel-stack.js), giống About/Subtitle.
 *
 * MỚI so với Subtitle: 3 slider có `data-value-target` (giống Subtitle) + 2 input màu CẦN đồng bộ
 * CHÉO lẫn nhau (`solid-color-picker` <-> `solid-color-text`, đổi bên này phải cập nhật bên kia)
 * dùng `data-cross-target` — listener delegate (event/listener/visualizer-display.js) đọc thuộc
 * tính này để tìm đúng phần tử cần ghi, KHÔNG cần core tự biết tên id của nhau.
 */
function renderVisualizerPanelBody() {
    return `
                <!-- SECTION: VISUALIZER (Chất lượng Render + Hình học theo từng kiểu) -->
                <div>
                    <h3 class="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-2 ml-2" data-i18n="visualizerSettingsDrawer.geometrySectionTitle">${t('visualizerSettingsDrawer.geometrySectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden mb-6">
                        <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                            <span class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.quality.label">${t('visualizerSettingsDrawer.quality.label')}</span>
                            <select id="setting-quality" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                                <option value="high" data-i18n="visualizerSettingsDrawer.quality.high">${t('visualizerSettingsDrawer.quality.high')}</option>
                                <option value="medium" data-i18n="visualizerSettingsDrawer.quality.medium">${t('visualizerSettingsDrawer.quality.medium')}</option>
                                <option value="low" data-i18n="visualizerSettingsDrawer.quality.low">${t('visualizerSettingsDrawer.quality.low')}</option>
                            </select>
                        </div>
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
                        </div>

                        <!-- (Phần B, Galaxy — dropdown kiểu con + 4 slider tinh chỉnh reroll/jump
                             ĐÃ BỎ HẲN 21/07/2026, phản hồi Giang mục 1 — 4 giá trị đó giờ là hằng
                             số cố định trong event/workflow/visualizer-render.js, không còn UI
                             chỉnh. Kiểu hiệu ứng "Space" vẫn chọn được bình thường qua select
                             chính "Kiểu hiệu ứng" ở components/settings/visualizer-geometry-color.js
                             — CHỈ bỏ panel tinh chỉnh chi tiết này.) -->
                    </div>
        
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

                <!-- SECTION: TỰ ĐỘNG ĐỔI HIỆU ỨNG (core/auto-switch-visual.js — id giữ NGUYÊN,
                     hàm đó chỉ cần các #id này tồn tại trong DOM lúc panel đang mở, KHÔNG quan tâm
                     nằm ở template nào — ĐÃ có null-guard sẵn từ trước, xem initAutoSwitchVisualUI()). -->
                <div>
                    <h3 class="text-xs font-bold text-fuchsia-400 uppercase tracking-widest mb-2 ml-2" data-i18n="visualizerSettingsDrawer.autoSwitchSectionTitle">${t('visualizerSettingsDrawer.autoSwitchSectionTitle')}</h3>
                    <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                        <div class="flex justify-between items-center p-4">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.autoSwitchEnable.label">${t('visualizerSettingsDrawer.autoSwitchEnable.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="visualizerSettingsDrawer.autoSwitchEnable.hint">${t('visualizerSettingsDrawer.autoSwitchEnable.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-auto-switch-enable" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>

                        <div id="auto-switch-options" class="hidden flex flex-col border-t border-white/5">
                            <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                                <span class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.autoSwitchMode.label">${t('visualizerSettingsDrawer.autoSwitchMode.label')}</span>
                                <select id="setting-auto-switch-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">
                                    <option value="sequential" data-i18n="visualizerSettingsDrawer.autoSwitchMode.sequential">${t('visualizerSettingsDrawer.autoSwitchMode.sequential')}</option>
                                    <option value="random" data-i18n="visualizerSettingsDrawer.autoSwitchMode.random">${t('visualizerSettingsDrawer.autoSwitchMode.random')}</option>
                                </select>
                            </div>

                            <div class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                                <span class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.autoSwitchTimeMode.label">${t('visualizerSettingsDrawer.autoSwitchTimeMode.label')}</span>
                                <select id="setting-auto-switch-time-mode" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-36 text-right">
                                    <option value="fixed" data-i18n="visualizerSettingsDrawer.autoSwitchTimeMode.fixed">${t('visualizerSettingsDrawer.autoSwitchTimeMode.fixed')}</option>
                                    <option value="random" data-i18n="visualizerSettingsDrawer.autoSwitchTimeMode.random">${t('visualizerSettingsDrawer.autoSwitchTimeMode.random')}</option>
                                    <option value="duration" data-i18n="visualizerSettingsDrawer.autoSwitchTimeMode.duration">${t('visualizerSettingsDrawer.autoSwitchTimeMode.duration')}</option>
                                </select>
                            </div>

                            <div id="auto-switch-time-fixed-block" class="hidden flex-col p-4 border-b border-white/5 gap-2">
                                <div class="flex justify-between items-center">
                                    <span class="text-xs text-slate-400" data-i18n="visualizerSettingsDrawer.autoSwitchFixed.label">${t('visualizerSettingsDrawer.autoSwitchFixed.label')}</span>
                                    <input type="number" id="setting-auto-switch-seconds-fixed" min="10" step="1" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-20 text-right">
                                </div>
                            </div>

                            <div id="auto-switch-time-random-block" class="hidden flex-col p-4 border-b border-white/5 gap-2">
                                <div class="flex justify-between items-center">
                                    <span class="text-xs text-slate-400" data-i18n="visualizerSettingsDrawer.autoSwitchRandom.label">${t('visualizerSettingsDrawer.autoSwitchRandom.label')}</span>
                                    <input type="number" id="setting-auto-switch-seconds-random" min="10" step="1" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-20 text-right">
                                </div>
                            </div>

                            <div id="auto-switch-time-duration-block" class="hidden flex-col p-4 gap-2">
                                <div class="flex justify-between items-center">
                                    <span class="text-xs text-slate-400" data-i18n="visualizerSettingsDrawer.autoSwitchDuration.label">${t('visualizerSettingsDrawer.autoSwitchDuration.label')}</span>
                                    <input type="number" id="setting-auto-switch-seconds-duration" min="10" step="1" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-20 text-right">
                                </div>
                                <p class="text-xs text-slate-400 leading-relaxed" data-i18n="visualizerSettingsDrawer.autoSwitchDuration.hint">${t('visualizerSettingsDrawer.autoSwitchDuration.hint')}</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- SECTION: HIỂN THỊ VISUALIZER — dải BPM/Pitch/Energy (dời từ nút Control
                     Center) + 3 toggle RIÊNG ẩn/hiện từng thành phần UI cố định (bỏ hẳn "full
                     mode" gộp chung) — vẫn mở lại được qua cử chỉ vuốt rìa dù đang ẩn, xem
                     event/workflow/visualizer-gesture.js. -->
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
                                <div class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.hideBottomPlayer.label">${t('visualizerSettingsDrawer.hideBottomPlayer.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="visualizerSettingsDrawer.hideBottomPlayer.hint">${t('visualizerSettingsDrawer.hideBottomPlayer.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-hide-bottom-player" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4 border-b border-white/5">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.hidePlaylistButton.label">${t('visualizerSettingsDrawer.hidePlaylistButton.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="visualizerSettingsDrawer.hidePlaylistButton.hint">${t('visualizerSettingsDrawer.hidePlaylistButton.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-hide-playlist-button" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                        <div class="flex justify-between items-center p-4">
                            <div class="pr-3">
                                <div class="text-sm font-medium" data-i18n="visualizerSettingsDrawer.hideControlCenterButton.label">${t('visualizerSettingsDrawer.hideControlCenterButton.label')}</div>
                                <div class="text-xs text-slate-400 mt-0.5" data-i18n="visualizerSettingsDrawer.hideControlCenterButton.hint">${t('visualizerSettingsDrawer.hideControlCenterButton.hint')}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" id="setting-hide-control-center-button" class="sr-only peer">
                                <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                            </label>
                        </div>
                    </div>
                </div>
`;
}
