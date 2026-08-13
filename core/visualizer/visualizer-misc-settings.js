/**
 * Visualizer Misc Settings — khởi tạo UI từ vizConfig cho input TĨNH còn lại ở Main
 * (keepScreenOnToggle) lúc boot. Quality/blur/Hiện Visual ĐÃ DỜI vào panel "Display" ĐỘNG (đồng bộ
 * lúc mở panel, xem workflowVisualizerDisplay.openDisplayPanel()), không còn đồng bộ tĩnh ở đây.
 *
 * PHẢI nạp SAU: core/config.js, core/dom-refs.js.
 */
        function initVisualizerMiscSettingsUIFromConfig() {
            const cfg = appConfigViz.getAll();
            if (typeof keepScreenOnToggle !== 'undefined' && keepScreenOnToggle) keepScreenOnToggle.checked = cfg.keepScreenOn !== false;
            if (typeof visualizerTypeSelect !== 'undefined' && visualizerTypeSelect) visualizerTypeSelect.value = MODES[appState.get('currentModeIndex')];
        }
