/**
 * event/listener/visualizer-misc-settings.js — TẤT CẢ listener của cụm
 * "visualizerMiscSettings".
 *
 * NẠP SAU: core/dom-refs.js (biến DOM), event/bus.js, event/router/visualizer-misc-settings.js.
 */

// (Drawer Visualizer Settings ĐÃ DỜI — Batch D3: mở giờ ở event/listener/visualizer-display.js
// (btnOpenVisualizerSettings, cùng router "visualizerDisplay" với 14 input còn lại của chính nó),
// đóng dùng CHUNG event/listener/settings-stack-nav.js (btnSettingsStackBack) —
// btnBackVisualizerSettings KHÔNG còn tồn tại tĩnh, không để `if(x)` rỗng.)

// (Drawer Subtitle Settings ĐÃ DỜI — Batch D2: mở giờ ở event/listener/subtitle-style-settings.js
// (btnOpenSubtitleSettings), đóng dùng CHUNG event/listener/settings-stack-nav.js
// (btnSettingsStackBack) — btnBackSubtitleSettings KHÔNG còn tồn tại tĩnh, không để `if(x)` rỗng.)

// ── Đổi kiểu hiệu ứng ───────────────────────────────────────────────────────
if (typeof visualizerTypeSelect !== 'undefined' && visualizerTypeSelect) {
    visualizerTypeSelect.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerMiscSettings', type: 'visualizerMiscSettings.visualizerType.change', payload: { value: e.target.value } });
    });
}

// ── Giữ màn hình sáng ────────────────────────────────────────────────────────
if (typeof keepScreenOnToggle !== 'undefined' && keepScreenOnToggle) {
    keepScreenOnToggle.addEventListener('change', (e) => {
        eventBus.send({ router: 'visualizerMiscSettings', type: 'visualizerMiscSettings.keepScreenOn.change', payload: { checked: e.target.checked } });
    });
}
