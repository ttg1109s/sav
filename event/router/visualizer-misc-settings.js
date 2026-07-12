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
 * SỬA (12/07/2026, audit kiến trúc `/event/` — xem readme/changelog/v12.md mục 14/16) — CẢ 2
 * msg.type ĐÃ DỜI logic sang `event/workflow/visualizer-misc-settings.js` (MỚI). Câu "chỉ cần gọi
 * thẳng hàm core... không cần workflow" ở bản cũ SAI theo quy ước hiện hành: cả 2 case đều hoặc
 * gọi ≥2 hàm side-effect nối tiếp, hoặc tự chuẩn bị `appState` cho Core — cả hai đều bắt buộc
 * Workflow (readme/event-bus-flow.md mục 4B), không phải ngoại lệ "không có shield/modal".
 *
 * NẠP SAU: event/bus.js, event/workflow/visualizer-misc-settings.js.
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
                workflowVisualizerMiscSettings.applyVisualizerType(msg.payload.value);
                break;
            }

            // ── Giữ màn hình sáng ────────────────────────────────────────────
            case 'visualizerMiscSettings.keepScreenOn.change': {
                workflowVisualizerMiscSettings.setKeepScreenOn(msg.payload.checked);
                break;
            }

            default:
                console.warn(`[routerVisualizerMiscSettings] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('visualizerMiscSettings', routerVisualizerMiscSettings);
