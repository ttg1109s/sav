/**
 * event/router/visualizer-misc-settings.js — Router tên "visualizerMiscSettings".
 *
 * Batch D2: 2 msg.type mở/đóng Subtitle Drawer ĐÃ DỜI sang router "subtitleStyleSettings".
 * Batch D3 (06/07/2026): 2 msg.type mở/đóng Visualizer Drawer ĐÃ DỜI sang router
 * "visualizerDisplay" (gọn hơn — cùng router với 14 input style của chính nó, xem
 * event/router/visualizer-display.js). File này giờ CHỈ còn 2 msg.type:
 *   - visualizerTypeSelect.change (đổi kiểu hiệu ứng, Main)
 *   - keepScreenOnToggle.change (bật/tắt giữ màn hình sáng, Main)
 *
 * Cả 2 msg.type chỉ cần gọi thẳng hàm core — KHÔNG có shield/modal — không cần workflow.
 *
 * NẠP SAU: event/bus.js, core/visualizer/visualizer-display.js (updateTypeUI),
 *           core/config.js (saveConfig, vizConfig, MODES, currentModeIndex),
 *           core/wakelock.js (requestWakeLock, releaseWakeLock).
 * NẠP TRƯỚC: event/listener/visualizer-misc-settings.js.
 */
const routerVisualizerMiscSettings = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            // (Drawer Visualizer Settings ĐÃ DỜI — Batch D3 — sang router "visualizerDisplay":
            // mở là 'visualizerDisplay.openPanel.click', đóng dùng CHUNG
            // 'settingsStackNav.back.click' cho MỌI panel.)

            // ── Drawer Subtitle Settings — DỜI sang router "subtitleStyleSettings" (Batch D2,
            // Settings restructure, 06/07/2026): mở giờ là 'subtitleStyleSettings.openPanel.click'
            // (push panel), đóng dùng CHUNG 'settingsStackNav.back.click' cho MỌI panel — xem
            // event/router/subtitle-style-settings.js + event/router/settings-stack-nav.js. -->

            // ── Đổi kiểu hiệu ứng ───────────────────────────────────────────
            case 'visualizerMiscSettings.visualizerType.change': {
                const idx = MODES.indexOf(msg.payload.value);
                if (idx === -1) break;
                appState.set('currentModeIndex', idx);
                updateTypeUI();
                saveConfig();
                break;
            }

            // ── Giữ màn hình sáng ────────────────────────────────────────────
            case 'visualizerMiscSettings.keepScreenOn.change': {
                appState.mutate('vizConfig', cfg => { cfg.keepScreenOn = msg.payload.checked; });
                saveConfig();
                if (appState.get('vizConfig').keepScreenOn) {
                    if (typeof audioPlayer !== 'undefined' && !audioPlayer.paused) requestWakeLock();
                } else {
                    releaseWakeLock();
                }
                break;
            }

            default:
                console.warn(`[routerVisualizerMiscSettings] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('visualizerMiscSettings', routerVisualizerMiscSettings);
