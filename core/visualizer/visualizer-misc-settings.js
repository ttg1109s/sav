/**
 * Visualizer Misc Settings — khởi tạo UI từ vizConfig, không còn addEventListener nào.
 *
 * ĐÃ TÁCH từ core/equalizer-settings.js (cũ, tên file gây nhầm) — các mục này thuộc về
 * Visualizer nói chung, không liên quan EQ.
 *
 * LISTENER đã XOÁ TOÀN BỘ khỏi file này — chuyển sang:
 *   event/router/visualizer-misc-settings.js  (router tên "visualizerMiscSettings")
 *   event/listener/visualizer-misc-settings.js (6 listener: 4 nút drawer + select + toggle)
 *
 * PHẢI nạp SAU: core/config.js (vizConfig/saveConfig/MODES), core/dom-refs.js,
 *               core/wakelock.js (requestWakeLock/releaseWakeLock),
 *               core/visualizer/visualizer-display.js (updateTypeUI).
 */

        /**
         * Đồng bộ TOÀN BỘ UI misc settings này theo vizConfig hiện tại — gọi từ loadConfig()
         * (core/config.js) qua guard `typeof === 'function'`.
         */
        function initVisualizerMiscSettingsUIFromConfig() {
            const cfg = appConfigViz.getAll();
            if (typeof keepScreenOnToggle !== 'undefined' && keepScreenOnToggle) keepScreenOnToggle.checked = cfg.keepScreenOn !== false;
            if (typeof visualEnabledToggle !== 'undefined' && visualEnabledToggle) visualEnabledToggle.checked = cfg.visualEnabled !== false;
            if (typeof visualizerTypeSelect !== 'undefined' && visualizerTypeSelect) visualizerTypeSelect.value = MODES[appState.get('currentModeIndex')];
            // MỚI (12/08/2026, Giang yêu cầu tái cấu trúc Setting Main mục 4b/4d) — "Chất lượng
            // render"/"Làm mờ" giờ SỐNG Ở MAIN (TĨNH), không còn đồng bộ qua
            // workflowVisualizerDisplay.openPanel() (panel con) nữa — đồng bộ NGAY ĐÂY như mọi
            // input tĩnh khác của Main.
            if (typeof qualitySelect !== 'undefined' && qualitySelect) qualitySelect.value = cfg.quality;
            if (typeof blurEnableToggle !== 'undefined' && blurEnableToggle) blurEnableToggle.checked = cfg.blurEnabled !== false;
        }
