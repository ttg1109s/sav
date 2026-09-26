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
            // VIẾT LẠI (26/09/2026, Giang "cải tiến lại Auto-Switch Effect") — thêm listBy/item/groupStyle/fixedKind/
            // seconds picker; bỏ 'secondsField.change' (3 input số giây cũ).
            case 'autoSwitchVisual.enable.change':
                workflowAutoSwitchVisual.setEnabled(msg.payload.checked);
                break;
            case 'autoSwitchVisual.openList.click': // MỚI 26/09/2026 — sub panel "Effect list"
                workflowAutoSwitchVisual.openListPanel();
                break;
            case 'autoSwitchVisual.listBy.change':
                workflowAutoSwitchVisual.setListBy(msg.payload.value);
                break;
            case 'autoSwitchVisual.item.toggle':
                workflowAutoSwitchVisual.setItemEnabled(msg.payload.listBy, msg.payload.key, msg.payload.checked);
                break;
            case 'autoSwitchVisual.groupStyle.change':
                workflowAutoSwitchVisual.setGroupStyle(msg.payload.groupKey, msg.payload.style);
                break;
            case 'autoSwitchVisual.item.move':
                workflowAutoSwitchVisual.moveItem(msg.payload.listBy, msg.payload.fromKey, msg.payload.toKey);
                break;
            case 'autoSwitchVisual.mode.change':
                workflowAutoSwitchVisual.setMode(msg.payload.value);
                break;
            case 'autoSwitchVisual.timeMode.change':
                workflowAutoSwitchVisual.setTimeMode(msg.payload.value);
                break;
            case 'autoSwitchVisual.fixedKind.change':
                workflowAutoSwitchVisual.setFixedKind(msg.payload.value);
                break;
            case 'autoSwitchVisual.seconds.click':
                workflowAutoSwitchVisual.openSecondsPicker(msg.payload.fieldName);
                break;
            default:
                console.warn(`[routerAutoSwitchVisual] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('autoSwitchVisual', routerAutoSwitchVisual);
