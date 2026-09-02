/**
 * Visualizer Misc Settings — khởi tạo UI từ vizConfig cho input TĨNH còn lại ở Main
 * (keepScreenOnToggle) lúc boot. Quality/blur/Hiện Visual ĐÃ DỜI vào panel "Display" ĐỘNG (đồng bộ
 * lúc mở panel, xem workflowVisualizerDisplay.openDisplayPanel()), không còn đồng bộ tĩnh ở đây.
 *
 * MỚI (16/08/2026, Game Mode Circle v1) — thêm đồng bộ `gameModeSettingToggle` (checkbox "GAME
 * MODE" trong Settings, components/settings/misc.js) — CÙNG diện "input tĩnh ở Main", đặt chung
 * hàm này cho gọn thay vì tạo 1 hàm init riêng chỉ cho 1 checkbox.
 *
 * [SỬA — 02/09/2026, Giang yêu cầu "game mode không lưu, trạng thái tạm thời RAM"] `gameplayArmedGameId`
 * ĐÃ CHUYỂN hẳn sang AppState (service/state/gameplay-runtime.js, session-only) — KHÔNG còn ở
 * `cfg` (vizConfig/AppConfig, PERSISTENT) như bản đổi tên hồi sáng cùng ngày nữa. Checkbox này giờ
 * CHỈ còn phản ánh ĐÚNG 1 game 'circle' (game DUY NHẤT từng tồn tại lúc checkbox còn là cách duy
 * nhất bật Game Mode, xem event/workflow/gameplay.js::setModeEnabled() cho cùng phép ánh xạ tương
 * thích ngược này) — vì session-only nên MỖI LẦN app khởi động lại checkbox này LUÔN về unchecked
 * (đúng ý muốn — không còn gì để "khôi phục" từ lần trước).
 *
 * PHẢI nạp SAU: core/config.js, core/dom-refs.js, service/state/gameplay-runtime.js (AppState
 * package 'gameplay-runtime' phải đã `definePackage()` xong TRƯỚC lần `appState.get()` đầu tiên ở
 * đây).
 */
        function initVisualizerMiscSettingsUIFromConfig() {
            const cfg = appConfigViz.getAll();
            if (typeof keepScreenOnToggle !== 'undefined' && keepScreenOnToggle) keepScreenOnToggle.checked = cfg.keepScreenOn !== false;
            if (typeof visualizerTypeSelect !== 'undefined' && visualizerTypeSelect) visualizerTypeSelect.value = MODES[appState.get('currentModeIndex')];
            if (typeof gameModeSettingToggle !== 'undefined' && gameModeSettingToggle) gameModeSettingToggle.checked = appState.get('gameplayArmedGameId') === 'circle';
        }
