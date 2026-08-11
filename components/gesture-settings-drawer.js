/**
 * Component: panel body Settings "Cử chỉ" (components/settings/visualizer-geometry-color.js mở
 * qua #setting-open-gesture-settings). CHIA 4 section:
 *   1. Điều hướng — 4 dropdown action picker (vuốt lên/xuống/trái/phải).
 *   2. Tap — 2 dropdown action picker (tap đơn/đúp) + tap 3 lần (toggle bật/tắt + dropdown gán 1
 *      nút Control Center — THAY THẾ vuốt cạnh dưới đã bỏ hẳn, KHÔNG thuộc action picker).
 *   3. Seek — giữ tay ở nửa trái/phải màn hình để tua lùi/tiến lặp lại (event/workflow/
 *      visualizer-gesture.js) — toggle bật/tắt + 2 hàng mở time-picker RIÊNG (3 khái niệm thời
 *      gian TÁCH BIỆT HOÀN TOÀN — xem docstring event/workflow/visualizer-gesture.js):
 *        - Ngưỡng kích hoạt (2s): CỐ ĐỊNH, không hiện trong panel này.
 *        - "Bước tua" (Time 1, gestureSeekStepMs): đơn vị nhảy mỗi lần seek.
 *        - "Giữ để tua tiếp" (Time 2, gestureSeekHoldIntervalMs): sau khi đã vào seek mode, giữ
 *          thêm bao lâu thì kích hoạt 1 lệnh seek theo Time 1 — lặp lại liên tục.
 *   4. Vuốt cạnh — CHỈ còn rìa TRÊN (mở Control Center) — rìa DƯỚI đã bỏ hẳn, thay bằng tap 3 lần
 *      ở section Tap (phản hồi Giang).
 *
 * 6 dropdown action picker (section 1+2 phần đơn/đúp) CÙNG 1 pool 5 hành động dùng chung
 * (GESTURE_ACTIONS, event/workflow/visualizer-gesture.js): Tiếp theo/Trước đó/Play-Pause/Mở
 * Playlist/Không dùng. KHÔNG gồm icon center — dropdown gán nút Control Center CHỈ thuộc tap 3
 * lần (gestureTripleTapTarget), key khớp GESTURE_TRIPLE_TAP_TARGET_ELS.
 */
function renderGestureSettingsPanelBody() {
    const actionOptions = `
        <option value="next" data-i18n="gestureSettings.action.next">${t('gestureSettings.action.next')}</option>
        <option value="prev" data-i18n="gestureSettings.action.prev">${t('gestureSettings.action.prev')}</option>
        <option value="playPause" data-i18n="gestureSettings.action.playPause">${t('gestureSettings.action.playPause')}</option>
        <option value="openPlaylist" data-i18n="gestureSettings.action.openPlaylist">${t('gestureSettings.action.openPlaylist')}</option>
        <option value="none" data-i18n="gestureSettings.action.none">${t('gestureSettings.action.none')}</option>
    `;
    const actionRow = (id, labelKey, lastInGroup) => `
        <div class="flex justify-between items-center p-4${lastInGroup ? '' : ' border-b border-white/5'}">
            <span class="text-sm font-medium" data-i18n="${labelKey}">${t(labelKey)}</span>
            <select id="${id}" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-32 text-right">${actionOptions}</select>
        </div>
    `;
    const sectionTitle = (labelKey, colorClass) => `<h3 class="text-xs font-bold ${colorClass} uppercase tracking-widest mb-2 ml-2" data-i18n="${labelKey}">${t(labelKey)}</h3>`;
    const controlCenterTargetOptions = `
        <option value="cycleMode" data-i18n="visualizerOverlay.cycleMode.label">${t('visualizerOverlay.cycleMode.label')}</option>
        <option value="shuffle" data-i18n="visualizerOverlay.shuffle.label">${t('visualizerOverlay.shuffle.label')}</option>
        <option value="repeat" data-i18n="visualizerOverlay.repeat.label">${t('visualizerOverlay.repeat.label')}</option>
        <option value="documentReader" data-i18n="visualizerOverlay.documentReader.label">${t('visualizerOverlay.documentReader.label')}</option>
        <option value="captureFrame" data-i18n="visualizerOverlay.captureFrame.label">${t('visualizerOverlay.captureFrame.label')}</option>
    `;

    return `
        <div class="flex flex-col gap-5">
            <div>
                ${sectionTitle('gestureSettings.sectionNav', 'text-sky-400')}
                <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                    ${actionRow('setting-gesture-action-swipe-up', 'gestureSettings.swipeUp.label')}
                    ${actionRow('setting-gesture-action-swipe-down', 'gestureSettings.swipeDown.label')}
                    ${actionRow('setting-gesture-action-swipe-left', 'gestureSettings.swipeLeft.label')}
                    ${actionRow('setting-gesture-action-swipe-right', 'gestureSettings.swipeRight.label', true)}
                </div>
            </div>

            <div>
                ${sectionTitle('gestureSettings.sectionTap', 'text-emerald-400')}
                <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                    ${actionRow('setting-gesture-action-tap-single', 'gestureSettings.tapSingle.label')}
                    ${actionRow('setting-gesture-action-tap-double', 'gestureSettings.tapDouble.label')}
                    <div class="flex justify-between items-center p-4 border-b border-white/5">
                        <div class="pr-3">
                            <div class="text-sm font-medium" data-i18n="gestureSettings.tripleTapEnable.label">${t('gestureSettings.tripleTapEnable.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5" data-i18n="gestureSettings.tripleTapEnable.hint">${t('gestureSettings.tripleTapEnable.hint')}</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" id="setting-gesture-triple-tap-enable" class="sr-only peer">
                            <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                        </label>
                    </div>
                    <div class="flex justify-between items-center p-4">
                        <span class="text-sm font-medium" data-i18n="gestureSettings.tripleTapTarget.label">${t('gestureSettings.tripleTapTarget.label')}</span>
                        <select id="setting-gesture-triple-tap-target" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right">${controlCenterTargetOptions}</select>
                    </div>
                </div>
            </div>

            <div>
                ${sectionTitle('gestureSettings.sectionSeek', 'text-amber-400')}
                <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                    <div class="flex justify-between items-center p-4 border-b border-white/5">
                        <div class="pr-3">
                            <div class="text-sm font-medium" data-i18n="gestureSettings.seekHoldEnable.label">${t('gestureSettings.seekHoldEnable.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5" data-i18n="gestureSettings.seekHoldEnable.hint">${t('gestureSettings.seekHoldEnable.hint')}</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" id="setting-gesture-seek-hold-enable" class="sr-only peer">
                            <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                        </label>
                    </div>
                    <button id="setting-gesture-open-seek-step-picker" type="button" class="flex justify-between items-center p-4 border-b border-white/5 hover:bg-white/5 transition-colors w-full text-left">
                        <span class="text-sm font-medium" data-i18n="gestureSettings.seekStep.label">${t('gestureSettings.seekStep.label')}</span>
                        <span id="gesture-seek-step-value" class="text-xs text-slate-300 font-mono"></span>
                    </button>
                    <button id="setting-gesture-open-seek-hold-interval-picker" type="button" class="flex justify-between items-center p-4 hover:bg-white/5 transition-colors w-full text-left">
                        <span class="text-sm font-medium" data-i18n="gestureSettings.seekHoldInterval.label">${t('gestureSettings.seekHoldInterval.label')}</span>
                        <span id="gesture-seek-hold-interval-value" class="text-xs text-slate-300 font-mono"></span>
                    </button>
                </div>
            </div>

            <div>
                ${sectionTitle('gestureSettings.sectionEdge', 'text-fuchsia-400')}
                <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                    <div class="flex justify-between items-center p-4">
                        <div class="pr-3">
                            <div class="text-sm font-medium" data-i18n="gestureSettings.edgeTop.label">${t('gestureSettings.edgeTop.label')}</div>
                            <div class="text-xs text-slate-400 mt-0.5" data-i18n="gestureSettings.edgeTop.hint">${t('gestureSettings.edgeTop.hint')}</div>
                        </div>
                        <label class="relative inline-flex items-center cursor-pointer shrink-0">
                            <input type="checkbox" id="setting-gesture-edge-top" class="sr-only peer">
                            <div class="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500 shadow-inner"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    `;
}
