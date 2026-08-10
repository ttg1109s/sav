/**
 * Component: panel body Settings "Cử chỉ" (components/settings/visualizer-geometry-color.js mở
 * qua #setting-open-gesture-settings). 6 toggle riêng cho từng nhóm cử chỉ (event/workflow/
 * visualizer-gesture.js) + 1 select chọn nút Control Center gán cho vuốt cạnh dưới — key khớp
 * GESTURE_EDGE_BOTTOM_TARGET_ELS (event/workflow/visualizer-gesture.js).
 */
function renderGestureSettingsPanelBody() {
    return `
        <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
            <div class="flex justify-between items-center p-4 border-b border-white/5">
                <div class="pr-3">
                    <div class="text-sm font-medium" data-i18n="gestureSettings.videoNav.label">${t('gestureSettings.videoNav.label')}</div>
                    <div class="text-xs text-slate-400 mt-0.5" data-i18n="gestureSettings.videoNav.hint">${t('gestureSettings.videoNav.hint')}</div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" id="setting-gesture-video-nav" class="sr-only peer">
                    <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                </label>
            </div>
            <div class="flex justify-between items-center p-4 border-b border-white/5">
                <div class="pr-3">
                    <div class="text-sm font-medium" data-i18n="gestureSettings.songNav.label">${t('gestureSettings.songNav.label')}</div>
                    <div class="text-xs text-slate-400 mt-0.5" data-i18n="gestureSettings.songNav.hint">${t('gestureSettings.songNav.hint')}</div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" id="setting-gesture-song-nav" class="sr-only peer">
                    <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                </label>
            </div>
            <div class="flex justify-between items-center p-4 border-b border-white/5">
                <div class="pr-3">
                    <div class="text-sm font-medium" data-i18n="gestureSettings.tapPlayPause.label">${t('gestureSettings.tapPlayPause.label')}</div>
                    <div class="text-xs text-slate-400 mt-0.5" data-i18n="gestureSettings.tapPlayPause.hint">${t('gestureSettings.tapPlayPause.hint')}</div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" id="setting-gesture-tap-play-pause" class="sr-only peer">
                    <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                </label>
            </div>
            <div class="flex justify-between items-center p-4 border-b border-white/5">
                <div class="pr-3">
                    <div class="text-sm font-medium" data-i18n="gestureSettings.doubleTapPlaylist.label">${t('gestureSettings.doubleTapPlaylist.label')}</div>
                    <div class="text-xs text-slate-400 mt-0.5" data-i18n="gestureSettings.doubleTapPlaylist.hint">${t('gestureSettings.doubleTapPlaylist.hint')}</div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" id="setting-gesture-double-tap-playlist" class="sr-only peer">
                    <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                </label>
            </div>
            <div class="flex justify-between items-center p-4 border-b border-white/5">
                <div class="pr-3">
                    <div class="text-sm font-medium" data-i18n="gestureSettings.edgeTop.label">${t('gestureSettings.edgeTop.label')}</div>
                    <div class="text-xs text-slate-400 mt-0.5" data-i18n="gestureSettings.edgeTop.hint">${t('gestureSettings.edgeTop.hint')}</div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" id="setting-gesture-edge-top" class="sr-only peer">
                    <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                </label>
            </div>
            <div class="flex justify-between items-center p-4 border-b border-white/5">
                <div class="pr-3">
                    <div class="text-sm font-medium" data-i18n="gestureSettings.edgeBottom.label">${t('gestureSettings.edgeBottom.label')}</div>
                    <div class="text-xs text-slate-400 mt-0.5" data-i18n="gestureSettings.edgeBottom.hint">${t('gestureSettings.edgeBottom.hint')}</div>
                </div>
                <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" id="setting-gesture-edge-bottom" class="sr-only peer">
                    <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                </label>
            </div>
            <div class="flex justify-between items-center p-4">
                <span class="text-sm font-medium" data-i18n="gestureSettings.edgeBottomTarget.label">${t('gestureSettings.edgeBottomTarget.label')}</span>
                <select id="setting-gesture-edge-bottom-target" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right">
                    <option value="cycleMode" data-i18n="visualizerOverlay.cycleMode.label">${t('visualizerOverlay.cycleMode.label')}</option>
                    <option value="subtitleToggle" data-i18n="visualizerOverlay.subtitle.label">${t('visualizerOverlay.subtitle.label')}</option>
                    <option value="shuffle" data-i18n="visualizerOverlay.shuffle.label">${t('visualizerOverlay.shuffle.label')}</option>
                    <option value="repeat" data-i18n="visualizerOverlay.repeat.label">${t('visualizerOverlay.repeat.label')}</option>
                    <option value="documentReader" data-i18n="visualizerOverlay.documentReader.label">${t('visualizerOverlay.documentReader.label')}</option>
                    <option value="captureFrame" data-i18n="visualizerOverlay.captureFrame.label">${t('visualizerOverlay.captureFrame.label')}</option>
                </select>
            </div>
        </div>
    `;
}
