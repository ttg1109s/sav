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
                // SỬA (fix router video, phản hồi Giang 29/07/2026, "về visualizer không hoạt
                // động") — `switchScreen` (MỚI, core/playlist/actions.js gửi kèm, mặc định `true`
                // nếu không có trong payload) — TÁCH HẲN khỏi việc chọn playVideoByKey() hay
                // startFromPlaylist() (việc đó VẪN chỉ dựa isVideoPlayerMode, đúng ý nghĩa "gọi
                // hàm nào"). "Có cần chuyển màn hình/cuộn không" là việc RIÊNG, độc lập.
                //
                // SỬA LẦN 2 (fix "chớp đen next/prev" + "chờ video mới thật sự hiện ra mới đổi
                // UI", phản hồi Giang 29/07/2026) — router KHÔNG còn tự gọi switchToVisualizer()/
                // scrollToCurrentKeyAnimated() ngay tại đây nữa (TRƯỚC ĐÂY gọi ngay sau
                // playVideoByKey(key), KHÔNG đợi gì — video còn đang tải/giải mã thì UI đã nhảy
                // sang bài mới rồi, sai yêu cầu "UI chỉ đổi khi hình đã đổi"). Quyết định switch
                // màn hình/cuộn giờ NẰM HẲN TRONG playVideoByKey()/startFromPlaylist() (event/
                // workflow/video-player.js), chạy đúng lúc video mới đã thật sự sẵn sàng — router
                // chỉ còn việc CHỌN HÀM NÀO rồi truyền `switchScreen` xuống, không tự quyết định gì
                // thêm ở tầng này nữa.
                const { key, switchScreen = true } = msg.payload;
                console.log('[DBG-video] router videoPlayer.startFromPlaylist.click — key:', key, 'switchScreen:', switchScreen, 'isVideoPlayerMode:', appState.get('isVideoPlayerMode'));
                VirtualMachineState.run([
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: true, callback: () => {
                        workflowVideoPlayer.playVideoByKey(key, switchScreen); // đã ở Video Player mode (Next/Prev/shuffle, hoặc bấm lại video đang phát từ Playlist) -> CHỈ đổi video, KHÔNG lặp lại bước "vào mode"
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
