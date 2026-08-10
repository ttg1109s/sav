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
            case 'gestureSettings.videoNav.change':
                workflowGestureSettings.setToggle('gestureVideoNavEnabled', msg.payload.checked);
                break;
            case 'gestureSettings.songNav.change':
                workflowGestureSettings.setToggle('gestureSongNavEnabled', msg.payload.checked);
                break;
            case 'gestureSettings.tapPlayPause.change':
                workflowGestureSettings.setToggle('gestureTapPlayPauseEnabled', msg.payload.checked);
                break;
            case 'gestureSettings.doubleTapPlaylist.change':
                workflowGestureSettings.setToggle('gestureDoubleTapPlaylistEnabled', msg.payload.checked);
                break;
            case 'gestureSettings.edgeTop.change':
                workflowGestureSettings.setToggle('gestureEdgeTopEnabled', msg.payload.checked);
                break;
            case 'gestureSettings.edgeBottom.change':
                workflowGestureSettings.setToggle('gestureEdgeBottomEnabled', msg.payload.checked);
                break;
            case 'gestureSettings.edgeBottomTarget.change':
                workflowGestureSettings.setEdgeBottomTarget(msg.payload.value);
                break;
            default:
                console.warn(`[routerGestureSettings] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('gestureSettings', routerGestureSettings);
