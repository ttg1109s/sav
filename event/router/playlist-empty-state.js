/**
 * event/router/playlist-empty-state.js — Router tên "playlistEmptyState".
 *
 * SỬA (fix 03/07/2026, mục 3a yêu cầu) — 2 msg.type giờ CẦN đọc appState.sectionQueueActive để
 * quyết định "chèn lại top-level trước khi phát" hay "phát thẳng như cũ" -> BẮT BUỘC qua
 * VirtualMachineState (event-bus-flow.md mục 4C — mọi rẽ nhánh theo state, kể cả đơn đích, không
 * viết if/else tay đọc appState trong case nữa). Nhánh sectionQueueActive=true giao
 * event/workflow/playlist-empty-state.js (MỚI — chuỗi ≥2 bước phụ thuộc thứ tự, đúng hình dạng
 * Workflow). Nhánh sectionQueueActive=false GIỮ NGUYÊN 100% hành vi gốc (gọi thẳng, dùng lại các
 * API/biến STATE đã có sẵn — window.playSong, appState.get('displayOrder')/('currentKey')/
 * ('isShuffle')/('playlistOrder')/('shuffleIndices'), btnShuffle).
 *
 * NẠP SAU: event/workflow/playlist-empty-state.js.
 */
const routerPlaylistEmptyState = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'playlistEmptyState.play.click': {
                const sectionActive = appState.get('sectionQueueActive');
                VirtualMachineState.run([
                    { state: sectionActive, operation: '===', value: true, callback: () => workflowPlaylistEmptyState.resetToTopLevelThenPlay() },
                    { state: sectionActive, operation: '===', value: false, callback: () => {
                        const displayOrder = appState.get('displayOrder');
                        if (displayOrder.length > 0) playSong(appState.get('currentKey') || displayOrder[0]);
                    } },
                ]);
                break;
            }
            case 'playlistEmptyState.shuffle.click': {
                const sectionActive = appState.get('sectionQueueActive');
                VirtualMachineState.run([
                    { state: sectionActive, operation: '===', value: true, callback: () => workflowPlaylistEmptyState.resetToTopLevelThenShuffle() },
                    { state: sectionActive, operation: '===', value: false, callback: () => {
                        if (!appState.get('isShuffle')) btnShuffle.click();
                        if (appState.get('playlistOrder').length > 0) playSong(appState.get('shuffleIndices')[0]);
                    } },
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
