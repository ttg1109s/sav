/**
 * event/router/video-player.js — Router tên "videoPlayer", tự đăng ký với eventBus lúc nạp. MỚI
 * (21/07/2026, mục 4).
 *
 * [SỬA — ver12 "Song/Video Unification", Batch 2] Case DUY NHẤT trước đây ('videoPlayer.toggle.
 * click' -> `workflowVideoPlayer.toggleVideoPlayerMode()`) là CODE MỒ CÔI phát hiện lúc sửa batch
 * này — `toggleVideoPlayerMode()` KHÔNG TỒN TẠI ở bất kỳ đâu trong event/workflow/video-player.js
 * (grep 0 kết quả định nghĩa hàm), và KHÔNG có Listener nào gửi msg.type đó (di sản từ 1 thiết kế
 * "nút toggle ở header Visualizer" trước khi pivot sang checkbox trong panel File Manager -> Video
 * — checkbox đó giờ CŨNG đã bỏ, xem event/workflow/file-manager-video.js). Case đó ĐÃ XOÁ, thay
 * bằng case THẬT cho entry point MỚI (mục 3, dispatch theo `mediaType` từ
 * `core/playlist/actions.js::window.playSong()`) — TÁI DÙNG ĐÚNG router 'videoPlayer' có sẵn (tên
 * đã khớp đúng miền, không cần router mới) + Block gate mới (event/block.js) cho msg.type này.
 *
 * Nút Next/Prev/Play/Pause vật lý KHÔNG qua router này (xem event/router/player-controls.js —
 * VirtualMachineState branch theo `isVideoPlayerMode` ngay tại router đó, gọi thẳng
 * `workflowVideoPlayer`).
 *
 * NẠP SAU: event/bus.js, event/workflow/video-player.js.
 */
const routerVideoPlayer = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'videoPlayer.startFromPlaylist.click': {
                const { key } = msg.payload;
                workflowVideoPlayer.startFromPlaylist(key); // >1 hàm core nối tiếp (đọc DB + mutate state + điều khiển nhiều element) -> workflow
                break;
            }

            default:
                console.warn(`[router:videoPlayer] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('videoPlayer', routerVideoPlayer);
