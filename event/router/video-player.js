/**
 * event/router/video-player.js — Router tên "videoPlayer", tự đăng ký với eventBus lúc nạp. MỚI
 * (21/07/2026, mục 4). CHỈ 1 msg.type — nút toggle "Play mode" ở header Visualizer (nút vật lý
 * Next/Prev/Play/Pause KHÔNG qua router này, xem event/router/player-controls.js — VirtualMachineState
 * branch theo `isVideoPlayerMode` ngay tại router đó, gọi thẳng `workflowVideoPlayer`).
 *
 * NẠP SAU: event/bus.js, event/workflow/video-player.js.
 */
const routerVideoPlayer = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'videoPlayer.toggle.click': {
                workflowVideoPlayer.toggleVideoPlayerMode(); // >1 hàm core nối tiếp (đọc DB + mutate state + điều khiển 2 element) -> workflow
                break;
            }

            default:
                console.warn(`[router:videoPlayer] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('videoPlayer', routerVideoPlayer);
