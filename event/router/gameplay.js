/**
 * event/router/gameplay.js — Router tên "gameplay" (Game Mode, Circle v1, MỚI 16/08/2026). 3/4 case
 * CHỈ 1 hàm Workflow -> gọi THẲNG, KHÔNG giữ state context riêng (cùng khuôn router
 * 'visualizerControlCenter'). Case còn lại ('gameplay.mediaChanged', MỚI) đọc appState để quyết
 * định CÓ gọi hay không -> VirtualMachineState (event-bus-flow.md mục 4C).
 *
 * SỬA (16/08/2026, Giang yêu cầu dùng modalChoice() thay overlay riêng cho màn Start/Kết quả) — bỏ
 * 3 case cũ ('gameplay.startCountdown.click'/'gameplay.scoreScreen.replay.click'/'gameplay.
 * scoreScreen.next.click') — nút trong modalChoice() giờ gọi THẲNG method Workflow (this.
 * startCountdown()/this.replay()/this.nextSong()), không còn DOM button riêng để dispatch qua đây
 * nữa (xem event/workflow/gameplay.js::start()/onSongEnded()).
 *
 * MỚI (phản hồi Giang "visualBg.songChanged liên quan gì tới video play mode?") —
 * 'gameplay.mediaChanged': tín hiệu "Song HOẶC Video vừa đổi THẬT", trung lập, KHÔNG thuộc domain
 * nào khác — TRƯỚC ĐÂY Game Mode tự mở khi bài đổi được gắn ké vào case 'visualBg.songChanged'
 * (event/router/visual-bg.js, CHỈ Song mới dispatch được, event đó vốn dành riêng cho domain
 * "Visual Background"), không có liên hệ khái niệm nào với Game Mode lẫn Video Player mode — tách
 * hẳn ra đây, gửi từ CẢ `workflowPlayer.playMedia()` (event/workflow/player.js) LẪN
 * `workflowVideoPlayer.playVideoByKey()` (event/workflow/video-player.js), Game Mode giờ tự mở
 * ĐÚNG cho cả 2 nguồn, không còn phụ thuộc router "visualBg" nữa.
 *
 * NẠP SAU: event/bus.js, event/virtual-machine-state.js, event/workflow/gameplay.js.
 */
const routerGameplay = (() => {
    function handle(msg) {
        switch (msg.type) {

            case 'gameplay.modeEnabled.change':
                workflowGameplay.setModeEnabled(msg.payload.checked);
                break;

            case 'gameplay.tap.press':
                workflowGameplay.handleTap(msg.payload.x, msg.payload.y);
                break;

            case 'gameplay.exit.click':
                workflowGameplay.exitToPlaylist();
                break;

            case 'gameplay.mediaChanged': {
                // [SỬA — 02/09/2026, Game Panel app-store list] `gameplayModeEnabled` (boolean, chỉ
                // biết bật/tắt) ĐÃ THAY bằng `gameplayArmedGameId` (nullable-string, biết ĐÚNG game
                // nào đang armed) — armed(id) khác null -> vào ĐÚNG mode id đó, KHÔNG còn hard-code
                // 'circle' ở đây nữa (tổng quát cho catalog nhiều game sau này, xem
                // core/gameplay/catalog.js).
                const armedGameId = appConfigViz.getAll().gameplayArmedGameId;
                VirtualMachineState.run([
                    { state: armedGameId, operation: '!==', value: null, callback: () => workflowGameplay.start(armedGameId) },
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
