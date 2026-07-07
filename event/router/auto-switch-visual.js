/**
 * event/router/auto-switch-visual.js — Router tên "autoSwitchVisual".
 *
 * Batch D3 (Settings restructure, 06/07/2026) — core đã refactor Rule 1-4 đầy đủ (Batch D2 CHỐT
 * áp dụng chung), không còn tự gọi core khác nội bộ — cả 4 msg.type giờ ĐỔI sang gọi workflow
 * (event/workflow/auto-switch-visual.js), KHÔNG còn gọi thẳng core như trước.
 */
const routerAutoSwitchVisual = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'autoSwitchVisual.enable.change':
                workflowAutoSwitchVisual.setEnabled(msg.payload.checked, msg.payload.optionsEl);
                break;
            case 'autoSwitchVisual.mode.change':
                workflowAutoSwitchVisual.setMode(msg.payload.value);
                break;
            case 'autoSwitchVisual.timeMode.change':
                workflowAutoSwitchVisual.setTimeMode(msg.payload.value, msg.payload.blockFixedEl, msg.payload.blockRandomEl, msg.payload.blockDurationEl);
                break;
            case 'autoSwitchVisual.secondsField.change':
                workflowAutoSwitchVisual.setSecondsField(msg.payload.fieldName, msg.payload.rawValue, msg.payload.inputEl);
                break;
            default:
                console.warn(`[routerAutoSwitchVisual] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('autoSwitchVisual', routerAutoSwitchVisual);
