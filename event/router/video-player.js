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
 * [SỬA — cùng Batch 2, Giang chốt "video thừa hưởng cơ chế Playlist, không tạo cơ chế next/prev
 * riêng"] `playNext()`/`playPrev()` (core/player-controls.js) giờ DÙNG CHUNG cho Video — nghĩa là
 * MỖI LẦN chuyển bài (kể cả đang ở GIỮA session Video Player mode) đều đi qua `window.playSong()`
 * -> gửi LẠI ĐÚNG msg.type này. VirtualMachineState bên dưới phân biệt 2 tình huống LOẠI TRỪ NHAU:
 * đã ở Video Player mode từ trước (chỉ cần đổi video, KHÔNG lặp lại toàn bộ bước "vào mode" —
 * pause Song cũ/nền đen/switchToVisualizer() một lần nữa là thừa/giật màn hình) HAY chưa (vào mode
 * đầy đủ lần đầu, xem `startFromPlaylist()`).
 *
 * Nút Next/Prev vật lý (`playerControls.next/prev.click`) KHÔNG còn qua router này (đã bỏ branch
 * theo `isVideoPlayerMode`, LUÔN gọi `playNext()`/`playPrev()` — xem event/router/player-controls.js).
 * Play/Pause vật lý vẫn qua router "playerControls" riêng (khác biệt DUY NHẤT còn lại là element
 * nào đang phát, không phải "danh sách phát tiếp theo").
 *
 * NẠP SAU: event/bus.js, event/workflow/video-player.js.
 */
const routerVideoPlayer = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'videoPlayer.startFromPlaylist.click': {
                const { key } = msg.payload;
                VirtualMachineState.run([
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: true, callback: () => {
                        workflowVideoPlayer.playVideoByKey(key); // đã ở Video Player mode (vd Next/Prev/shuffle vừa gọi lại msg này) -> CHỈ đổi video, KHÔNG lặp lại bước "vào mode"
                    } },
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: false, callback: () => {
                        workflowVideoPlayer.startFromPlaylist(key); // CHƯA ở mode -> vào mode đầy đủ (>1 hàm core nối tiếp: đọc DB + mutate state + điều khiển nhiều element) -> workflow
                    } },
                ]);
                break;
            }

            default:
                console.warn(`[router:videoPlayer] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`, msg);
        }
    }

    return { handle };
})();

eventBus.register('videoPlayer', routerVideoPlayer);
