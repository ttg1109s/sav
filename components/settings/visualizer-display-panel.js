/**
 * Component: panel "Display" (push/pop Settings Stack, nav từ Main "Visualizer Screen") — 5
 * toggle: Hiện Visual + 3 toggle UI chrome cố định (bottom player/playlist button/control center
 * button) + Stats panel. Trước đây 4 toggle sau nằm trong panel "Customize Visualizer" (đã xoá),
 * "Hiện Visual" trước đây tĩnh ở Main — gộp cả 5 vào 1 panel riêng theo yêu cầu Giang.
 */
function renderVisualizerDisplayPanelBody() {
    return `
                <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                    <div class="flex justify-between items-center p-4 border-b border-white/5">
                        <div class="pr-3">
                            <div class="text-sm font-medium truncate" data-i18n="settingsVisualizer.visualEnable.label">${t('settingsVisualizer.visualEnable.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5" data-i18n="settingsVisualizer.visualEnable.hint">${t('settingsVisualizer.visualEnable.hint')}</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" id="setting-visual-enable" class="sr-only peer" checked>
                            <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                        </label>
                    </div>
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
                    <div class="flex justify-between items-center p-4">
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
`;
}
