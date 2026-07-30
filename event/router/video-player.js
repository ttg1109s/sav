/**
 * event/router/video-player.js — Router tên "videoPlayer".
 *
 * `window.playSong()` (core/playlist/actions.js) dispatch msg này khi `mediaType==='video'` —
 * KỂ CẢ khi đang ở GIỮA session Video Player mode (Next/Prev/shuffle đều dùng chung `playNext()`/
 * `playPrev()` -> `window.playSong()` -> gửi LẠI ĐÚNG msg.type này). VirtualMachineState bên dưới
 * phân biệt 2 tình huống loại trừ nhau: đã ở mode (chỉ đổi video, `isTransition=true`) hay chưa
 * (vào mode đầy đủ lần đầu, `startFromPlaylist()`).
 *
 * Next/Prev vật lý KHÔNG qua router này (LUÔN gọi `playNext()`/`playPrev()` thẳng — xem event/
 * router/player-controls.js). Play/Pause vật lý qua router "playerControls" riêng.
 *
 * NẠP SAU: event/bus.js, event/workflow/video-player.js.
 */
const routerVideoPlayer = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'videoPlayer.startFromPlaylist.click': {
                // `switchScreen` (core/playlist/actions.js gửi kèm) — TÁCH khỏi việc chọn hàm nào
                // chạy (chỉ dựa isVideoPlayerMode); "có cần chuyển màn hình/cuộn không" là việc
                // riêng, độc lập. Router chỉ CHỌN HÀM rồi truyền switchScreen xuống — quyết định
                // switch màn hình thật sự nằm trong playVideoByKey()/startFromPlaylist() (đúng lúc
                // video mới đã sẵn sàng, xem event/workflow/video-player.js), không quyết ở đây.
                const { key, switchScreen = true } = msg.payload;
                VirtualMachineState.run([
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: true, callback: () => {
                        workflowVideoPlayer.playVideoByKey(key, switchScreen, true); // đã ở Video Player mode (Next/Prev/shuffle, hoặc bấm lại video đang phát từ Playlist) -> CHỈ đổi video, KHÔNG lặp lại bước "vào mode". isTransition=true — cưỡng chế bg thumb dự phòng (event/workflow/video-player.js::playVideoByKey())
                    } },
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: false, callback: () => {
                        workflowVideoPlayer.startFromPlaylist(key); // CHƯA ở mode -> vào mode đầy đủ (>1 hàm core nối tiếp: đọc DB + mutate state + điều khiển nhiều element) -> workflow, luôn switchScreen=true (vào mode lần đầu luôn cần chuyển màn), xem playVideoByKey() bên trong
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
