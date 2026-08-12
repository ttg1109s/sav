/**
 * event/router/gesture-settings.js — Router tên "gestureSettings".
 *
 * NẠP SAU: event/bus.js, event/workflow/gesture-settings.js.
 * NẠP TRƯỚC: event/listener/gesture-settings.js.
 */
const routerGestureSettings = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'gestureSettings.openPanel.click':
                workflowGestureSettings.openPanel();
                break;
            case 'gestureSettings.swipeUp.change':
                workflowGestureSettings.setField('gestureActionSwipeUp', msg.payload.value);
                break;
            case 'gestureSettings.swipeDown.change':
                workflowGestureSettings.setField('gestureActionSwipeDown', msg.payload.value);
                break;
            case 'gestureSettings.swipeLeft.change':
                workflowGestureSettings.setField('gestureActionSwipeLeft', msg.payload.value);
                break;
            case 'gestureSettings.swipeRight.change':
                workflowGestureSettings.setField('gestureActionSwipeRight', msg.payload.value);
                break;
            case 'gestureSettings.tapSingle.change':
                workflowGestureSettings.setField('gestureActionTapSingle', msg.payload.value);
                break;
            case 'gestureSettings.tapDouble.change':
                workflowGestureSettings.setField('gestureActionTapDouble', msg.payload.value);
                break;
            case 'gestureSettings.tripleTapTarget.change':
                workflowGestureSettings.setField('gestureTripleTapTarget', msg.payload.value);
                break;
            // MỚI (12/08/2026, Giang yêu cầu — "Action") — 3 dropdown section Action, CÙNG
            // setField() DÙNG CHUNG như mọi field khác ở router này (khác field, không phải khác
            // kịch bản nghiệp vụ).
            case 'gestureSettings.actionSlot1.change':
                workflowGestureSettings.setField('gestureActionSlot1', msg.payload.value);
                break;
            case 'gestureSettings.actionSlot2.change':
                workflowGestureSettings.setField('gestureActionSlot2', msg.payload.value);
                break;
            case 'gestureSettings.actionSlot3.change':
                workflowGestureSettings.setField('gestureActionSlot3', msg.payload.value);
                break;
            case 'gestureSettings.seekHoldEnable.change':
                workflowGestureSettings.setToggle('gestureSeekHoldEnabled', msg.payload.checked);
                break;
            case 'gestureSettings.openSeekStepPicker.click':
                workflowGestureSettings.openSeekStepPicker();
                break;
            case 'gestureSettings.openSeekHoldIntervalPicker.click':
                workflowGestureSettings.openSeekHoldIntervalPicker();
                break;
            case 'gestureSettings.edgeTop.change':
                workflowGestureSettings.setToggle('gestureEdgeTopEnabled', msg.payload.checked);
                break;
            default:
                console.warn(`[routerGestureSettings] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('gestureSettings', routerGestureSettings);
