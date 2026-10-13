/**
 * event/router/playlist-empty-state.js — Router "playlistEmptyState" (2 nút to "Phát"/"Trộn bài" header Playlist).
 * "Phát" giao hẳn Workflow (cần đọc state + tính việc cần làm); "Trộn bài" rẽ theo `sectionQueueActive` bằng
 * VirtualMachineState.
 *
 * NẠP SAU: event/workflow/playlist-empty-state.js.
 */
const routerPlaylistEmptyState = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'playlistEmptyState.play.click':
                workflowPlaylistEmptyState.handlePlayClick();
                break;
            case 'playlistEmptyState.shuffle.click': {
                const sectionActive = appState.get('sectionQueueActive');
                VirtualMachineState.run([
                    { state: sectionActive, operation: '===', value: true, callback: () => workflowPlaylistEmptyState.resetToTopLevelThenShuffle() },
                    { state: sectionActive, operation: '===', value: false, callback: () => workflowPlaylistEmptyState.reshuffleTopLevelAlways() },
                ]);
                break;
            }
            default:
                console.warn(`[routerPlaylistEmptyState] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('playlistEmptyState', routerPlaylistEmptyState);
