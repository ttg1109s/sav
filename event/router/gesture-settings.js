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
                workflowGestureSettings.setSelectField('gestureActionSwipeUp', msg.payload.value);
                break;
            case 'gestureSettings.swipeDown.change':
                workflowGestureSettings.setSelectField('gestureActionSwipeDown', msg.payload.value);
                break;
            case 'gestureSettings.swipeLeft.change':
                workflowGestureSettings.setSelectField('gestureActionSwipeLeft', msg.payload.value);
                break;
            case 'gestureSettings.swipeRight.change':
                workflowGestureSettings.setSelectField('gestureActionSwipeRight', msg.payload.value);
                break;
            case 'gestureSettings.tapSingle.change':
                workflowGestureSettings.setSelectField('gestureActionTapSingle', msg.payload.value);
                break;
            case 'gestureSettings.tapDouble.change':
                workflowGestureSettings.setSelectField('gestureActionTapDouble', msg.payload.value);
                break;
            case 'gestureSettings.edgeTop.change':
                workflowGestureSettings.setToggle('gestureEdgeTopEnabled', msg.payload.checked);
                break;
            case 'gestureSettings.edgeBottom.change':
                workflowGestureSettings.setToggle('gestureEdgeBottomEnabled', msg.payload.checked);
                break;
            case 'gestureSettings.edgeBottomTarget.change':
                workflowGestureSettings.setSelectField('gestureEdgeBottomTarget', msg.payload.value);
                break;
            default:
                console.warn(`[routerGestureSettings] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('gestureSettings', routerGestureSettings);
