/**
 * event/router/gameplay.js — Router tên "gameplay" (Game Mode). Case chỉ 1 hàm Workflow -> gọi THẲNG, không giữ state
 * context riêng. Riêng 'gameplay.mediaChanged' đọc appState để quyết định CÓ mở ván hay không -> VirtualMachineState
 * (event-bus-flow.md mục 4C).
 *
 * Nút trong modal Start/Kết quả (modalChoice()) gọi THẲNG method Workflow (startCountdown()/replay()/nextSong()), không
 * đi qua đây.
 *
 * 'gameplay.mediaChanged': tín hiệu trung lập "Song HOẶC Video vừa đổi THẬT", gửi từ `workflowPlayer.playMedia()`
 * (event/workflow/player.js) LẪN `workflowVideoPlayer.playVideoByKey()` (event/workflow/video-player.js) — Game Mode tự
 * mở đúng cho cả 2 nguồn, không phụ thuộc domain khác.
 *
 * NẠP SAU: event/bus.js, event/virtual-machine-state.js, event/workflow/gameplay.js.
 */
const routerGameplay = (() => {
    function handle(msg) {
        switch (msg.type) {

            case 'gameplay.tap.press':
                workflowGameplay.handleTap(msg.payload.x, msg.payload.y);
                break;

            case 'gameplay.exit.click':
                // Nút X dùng chung mọi mode -> thoát ĐÚNG mode đang chơi.
                workflowGameplayEngine.exitActiveMode();
                break;

            // Game "Arrow" — bàn phím tròn 8 hướng + nút Enter (event/listener/gameplay.js).
            case 'gameplay.arrow.direction.press':
                workflowGameplayArrow.handleDirection(msg.payload.dir);
                break;

            case 'gameplay.arrow.commit.press':
                workflowGameplayArrow.handleCommit();
                break;

            // `#gameplay-layer` đổi kích thước (ResizeObserver, event/listener/gameplay.js) — kể cả lúc chuyển ẩn -> hiện.
            case 'gameplay.layer.resize':
                workflowGameplay.handleLayoutResize();
                break;

            case 'gameplay.mediaChanged': {
                // `gameplayArmedGameId` sống ở appState (session-only, service/state/gameplay-runtime.js). Khai báo đủ 2
                // trường hợp: có game armed -> mở ĐÚNG game đó (bảng điều phối theo mode, event/workflow/gameplay-engine.js);
                // không armed (trường hợp bình thường) -> no-op có chủ đích, tránh cảnh báo "không rule nào khớp".
                const armedGameId = appState.get('gameplayArmedGameId');
                VirtualMachineState.run([
                    { state: armedGameId, operation: '!==', value: null, callback: () => workflowGameplayEngine.startMode(armedGameId) },
                    { state: armedGameId, operation: '===', value: null, callback: () => {} },
                ]);
                break;
            }

            default:
                console.warn(`[routerGameplay] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('gameplay', routerGameplay);
