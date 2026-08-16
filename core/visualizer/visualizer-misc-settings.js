/**
 * Visualizer Misc Settings — khởi tạo UI từ vizConfig cho input TĨNH còn lại ở Main
 * (keepScreenOnToggle) lúc boot. Quality/blur/Hiện Visual ĐÃ DỜI vào panel "Display" ĐỘNG (đồng bộ
 * lúc mở panel, xem workflowVisualizerDisplay.openDisplayPanel()), không còn đồng bộ tĩnh ở đây.
 *
 * MỚI (16/08/2026, Game Mode Circle v1) — thêm đồng bộ `gameModeSettingToggle` (checkbox "GAME
 * MODE" trong Settings, components/settings/misc.js) — CÙNG diện "input tĩnh ở Main", đặt chung
 * hàm này cho gọn thay vì tạo 1 hàm init riêng chỉ cho 1 checkbox.
 *
 * PHẢI nạp SAU: core/config.js, core/dom-refs.js.
 */
        function initVisualizerMiscSettingsUIFromConfig() {
            const cfg = appConfigViz.getAll();
            if (typeof keepScreenOnToggle !== 'undefined' && keepScreenOnToggle) keepScreenOnToggle.checked = cfg.keepScreenOn !== false;
            if (typeof visualizerTypeSelect !== 'undefined' && visualizerTypeSelect) visualizerTypeSelect.value = MODES[appState.get('currentModeIndex')];
            if (typeof gameModeSettingToggle !== 'undefined' && gameModeSettingToggle) gameModeSettingToggle.checked = cfg.gameplayModeEnabled === true;
        }
