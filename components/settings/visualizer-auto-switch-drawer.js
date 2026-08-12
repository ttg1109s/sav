/**
 * Component: panel body "Auto-Switch Effect" (components/settings/visualizer-geometry-color.js mở
 * qua #setting-open-visualizer-auto-switch, panel RIÊNG ngang hàng "Customize Visualizer").
 *
 * MỚI (12/08/2026, Giang yêu cầu tái cấu trúc Setting Main mục 4f) — TÁCH từ card "AUTO-SWITCH
 * EFFECT" cũ (từng là 1 trong 4 section bên trong panel "Customize Visualizer", components/
 * visualizer-settings-drawer.js) thành panel RIÊNG — ĐÚNG NGUYÊN markup/id/logic cũ (core/
 * auto-switch-visual.js, event/workflow/visualizer-display.js::openAutoSwitchPanel(), hàm MỚI TÁCH
 * từ openPanel() — xem docstring ở đó), KHÔNG đổi gì ngoài vị trí. Bỏ H3 tiêu đề card lặp lại tên
 * panel (panel header đã có sẵn "Auto-Switch Effect" — CÙNG khuôn panel Cử chỉ/EQ, không panel nào
 * lặp lại tên chính nó thành 1 section con bên trong).
 */
function renderVisualizerAutoSwitchPanelBody() {
    return `
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
`;
}
