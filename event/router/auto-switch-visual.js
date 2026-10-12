/**
 * event/router/auto-switch-visual.js — Router tên "autoSwitchVisual" (panel Auto-Switch Effect + sub panel "Effect
 * list"). Mọi msg.type giao workflowAutoSwitchVisual (event/workflow/auto-switch-visual.js).
 */
const routerAutoSwitchVisual = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'autoSwitchVisual.enable.change':
                workflowAutoSwitchVisual.setEnabled(msg.payload.checked);
                break;
            case 'autoSwitchVisual.openList.click': // sub panel "Effect list"
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
            // Kéo thả item — từng pha 1 msg.type (event/listener/auto-switch-visual.js)
            case 'autoSwitchVisual.drag.start':
                workflowAutoSwitchVisual.startItemDrag(msg.payload);
                break;
            case 'autoSwitchVisual.drag.move':
                workflowAutoSwitchVisual.moveItemDrag(msg.payload.clientY);
                break;
            case 'autoSwitchVisual.drag.end':
                workflowAutoSwitchVisual.endItemDrag();
                break;
            case 'autoSwitchVisual.drag.cancel':
                workflowAutoSwitchVisual.cancelItemDrag();
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
