/**
 * event/router/player-controls.js — Router tên "playerControls", tự đăng ký với eventBus lúc nạp.
 *
 * PHẠM VI: toàn bộ 17 `addEventListener` cũ của core/player-controls.js — 9 click UI (back-to-
 * playlist, play/pause, next/prev, shuffle, repeat, mở/đóng drawer Settings) + 8 audioPlayer/
 * progressBar event (play/pause/ended/loadedmetadata/error/timeupdate/seeked + progressBar
 * input/change). Quyết định CHỐT khác mục 2b.6 của plan.md: dù audioPlayer/progressBar là DOM cố
 * định (không phải listener nội bộ dùng-1-lần), VẪN đưa vào /event/ theo đúng nghĩa đen "DOM
 * listener cần tách" (quyết định của Giang, không áp dụng ngoại lệ 2b.6).
 *
 * QUY TẮC RẼ NHÁNH: 11/17 msg.type ở đây chỉ cần ĐÚNG 1 HÀM CORE (không có shield/modal, không cần
 * phối hợp nhiều hàm, không cần đọc appState nào khác) -> router gọi THẲNG. 'playerControls.
 * shuffle.click' (fix 03/07/2026, mục 3b) cần 2 hàm core nối tiếp có phụ thuộc thứ tự
 * (toggleShuffle() rồi updateShuffleArrayFromQueue() theo giá trị MỚI) -> giao event/workflow/
 * player-controls.js. 'playerControls.settingsDrawer.close' cần ≥2 hàm core nối tiếp (validate
 * video nền + reset ngăn xếp panel con + cuộn) -> giao Workflow — xem
 * workflowPlayerControls.closeSettingsDrawer().
 *
 * MỚI (21/07/2026, mục 4 — Video Player mode, xem event/workflow/video-player.js) — 4 case
 * 'playPause.click'/'next.click'/'prev.click'/'backToPlaylist.click' ĐỌC
 * `appState.get('isVideoPlayerMode')` + VirtualMachineState 2 nhánh loại trừ nhau: true -> giao
 * `workflowVideoPlayer` (video đang "làm bài hát"); false -> gọi THẲNG core cũ y hệt trước đây,
 * KHÔNG đổi hành vi gốc dù chỉ 1 dòng.
 *
 * VIẾT LẠI LẦN 2 (21/07/2026, cùng ngày — Giang phát hiện qua video test: `audioPlayer` không thực
 * sự chạy khi nhận blob video làm src trên 1 số trình duyệt/thiết bị, dù `bgVideoElement` vẫn phát
 * tiếng bình thường — xem docstring đầy đủ core/video-player.js) — BỎ HẲN ý tưởng "audioPlayer câm
 * nuôi mọi thứ cho video" của bản đầu. `bgVideoElement` giờ tự bắn 5 sự kiện CỦA CHÍNH NÓ (play/
 * pause/loadedmetadata/timeupdate/ended), dispatch qua message type RIÊNG `playerControls.video.*`
 * (xem event/listener/video-player.js, guard `isVideoPlayerMode` NGAY trong listener) — 5 case
 * NÀY gọi THẲNG `workflowVideoPlayer`, KHÔNG cần VirtualMachineState (KHÔNG dùng chung nguồn sự
 * kiện với Song, chỉ bgVideoElement mới bắn ra được). CHỈ 'progressBar.seeking'/'seekCommit' MỚI
 * cần VirtualMachineState — đây là 2 case DUY NHẤT còn dùng CHUNG 1 DOM listener/message type giữa
 * Song và Video (chỉ có 1 thanh progress bar vật lý). Các case 'audio.play'/'audio.pause'/
 * 'audio.loadedmetadata'/'audio.timeupdate'/'audio.ended' (từ `audioPlayer`) giữ NGUYÊN hành vi
 * gốc, KHÔNG branch gì — `audioPlayer` giờ HOÀN TOÀN không liên quan tới Video Player mode nữa.
 *
 * LỊCH SỬ (không còn áp dụng, giữ lại để tra cứu nếu cần) — batch 07-08/07/2026 (HOTFIX 7-10) đã
 * từng cho phép mở Settings NGAY TỪ Visualizer (nút #btn-settings trong Control Center), khiến cả
 * 2 msg.type này phải đọc `appState.get('isVisualizerActive')` + VirtualMachineState để rẽ nhánh
 * "đang ở Playlist" / "đang ở Visualizer". HOTFIX 11 (08/07/2026, Giang chốt) BỎ HẲN nút đó (xem
 * components/visualizer-overlay.js) sau khi nhiều lần vá vẫn không ổn định trên thiết bị thật —
 * Settings giờ LUÔN mở từ Playlist, không còn nhánh nào để rẽ, dọn sạch VirtualMachineState khỏi
 * cả 2 case.
 *
 * STATE CONTEXT: không có state RIÊNG của router này — `isVideoPlayerMode` (đọc ở 4 case mới) sống
 * ở appState (service/state.js), KHÔNG phải context cục bộ của router (đúng nguyên tắc: state cần
 * đọc CHÉO giữa 2 router — "playerControls" đọc, "videoPlayer" ghi — PHẢI qua appState).
 *
 * NẠP SAU: event/bus.js, event/workflow/player-controls.js, event/workflow/video-player.js (MỚI),
 * core/player-controls.js (cần toàn bộ hàm core ở trên, gồm scrollSideLeftToSettingsSmooth/
 * scrollSideLeftToPlaylistSmooth — HOTFIX 8), playlist/* (cần playNext/playPrev/window.playSong —
 * đã có từ trước). NẠP TRƯỚC: event/listener/player-controls.js.
 */
const routerPlayerControls = (() => {

    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            // ===================== Click UI =====================
            case 'playerControls.backToPlaylist.click': {
                // MỚI (21/07/2026, mục 4 — Video Player mode, Giang chỉ ra "cần quy trình khác,
                // phải dùng vmstate") — Video Player mode BẬT TỪ trang Settings (khác mọi lần gọi
                // switchToVisualizer() khác, LUÔN từ trang Playlist đang hiện sẵn) nên "Back" cần
                // tự cuộn lại về trang Playlist, xem event/workflow/video-player.js::
                // handleBackToPlaylistFromVideoMode(). Nhánh false GIỮ NGUYÊN hành vi gốc.
                VirtualMachineState.run([
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: true, callback: () => {
                        workflowVideoPlayer.handleBackToPlaylistFromVideoMode();
                    } },
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: false, callback: () => {
                        handleBackToPlaylistClick();
                    } },
                ]);
                break;
            }

            case 'playerControls.playPause.click': {
                // MỚI (21/07/2026, mục 4 — Video Player mode) — VirtualMachineState branch theo
                // `isVideoPlayerMode` (event/workflow/video-player.js). Nhánh false GỌI THẲNG
                // `togglePlayPause()` (core có sẵn, KHÔNG đổi gì) — giữ NGUYÊN hành vi gốc.
                VirtualMachineState.run([
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: true, callback: () => {
                        workflowVideoPlayer.togglePlayPauseVideo();
                    } },
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: false, callback: () => {
                        togglePlayPause();
                    } },
                ]);
                break;
            }

            case 'playerControls.next.click': {
                // MỚI (21/07/2026, mục 4 — Video Player mode), cùng khuôn 'playPause.click' ở trên.
                VirtualMachineState.run([
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: true, callback: () => {
                        workflowVideoPlayer.nextVideo(); // >1 hàm core (đọc DB + đổi src 2 element) -> workflow
                    } },
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: false, callback: () => {
                        playNext(true); // hàm core có sẵn, force=true giữ đúng hành vi gốc của nút Next
                    } },
                ]);
                break;
            }

            case 'playerControls.prev.click': {
                // MỚI (21/07/2026, mục 4 — Video Player mode), cùng khuôn 'next.click' ở trên.
                VirtualMachineState.run([
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: true, callback: () => {
                        workflowVideoPlayer.prevVideo();
                    } },
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: false, callback: () => {
                        playPrev();
                    } },
                ]);
                break;
            }

            case 'playerControls.shuffle.click': {
                workflowPlayerControls.toggleShuffleAndReshuffle(); // 2 hàm core nối tiếp, phụ thuộc thứ tự -> workflow (fix mục 3b)
                break;
            }

            case 'playerControls.repeat.click': {
                cycleRepeatMode();
                break;
            }

            case 'playerControls.settingsDrawer.open': {
                // VIẾT LẠI (08/07/2026, HOTFIX 11) — nút mở Settings từ Visualizer (#btn-settings,
                // Control Center) ĐÃ BỎ HẲN (xem components/visualizer-overlay.js) — msg.type này
                // giờ CHỈ có thể tới từ #btn-settings-playlist (đang ở Playlist), không còn cần
                // đọc `isVisualizerActive`/VirtualMachineState để rẽ nhánh nữa — gọi THẲNG core,
                // đúng (A) event-bus-flow.md (chỉ 1 hàm, message tự đủ nghĩa).
                scrollSideLeftToSettingsSmooth();
                break;
            }

            case 'playerControls.settingsDrawer.close': {
                // VIẾT LẠI (08/07/2026, HOTFIX 11) — cùng lý do ở trên: Settings giờ LUÔN mở từ
                // Playlist nên đóng cũng LUÔN về Playlist — không còn nhánh "về Visualizer" nào để
                // rẽ. Vẫn giao Workflow (không gọi thẳng core) vì cần ≥2 hàm core nối tiếp (validate
                // video nền + reset ngăn xếp panel con + cuộn) — đúng (B) event-bus-flow.md.
                workflowPlayerControls.closeSettingsDrawer();
                break;
            }

            // ===================== Sự kiện audioPlayer =====================
            case 'playerControls.audio.play': {
                handleAudioPlay();
                break;
            }

            case 'playerControls.audio.pause': {
                handleAudioPause();
                break;
            }

            case 'playerControls.audio.ended': {
                handleAudioEnded();
                break;
            }

            case 'playerControls.audio.loadedmetadata': {
                handleAudioLoadedMetadata();
                break;
            }

            case 'playerControls.audio.error': {
                handleAudioError();
                break;
            }

            case 'playerControls.audio.timeupdate': {
                handleAudioTimeUpdate();
                break;
            }

            case 'playerControls.audio.seeked': {
                updateMediaPositionState(); // hàm core có sẵn, dùng lại nguyên như listener cũ
                break;
            }

            // ===================== Sự kiện bgVideoElement (Video Player mode, MỚI 21/07/2026,
            // viết lại lần 2 — audioPlayer không còn dùng cho video) — 5 msg.type RIÊNG (KHÔNG
            // trùng 'audio.*' của Song, xem event/listener/video-player.js), mỗi cái CHỈ tới từ
            // bgVideoElement lúc isVideoPlayerMode=true (guard NGAY trong listener) -> gọi THẲNG,
            // KHÔNG cần VirtualMachineState (không có nhánh nào khác để rẽ tại ĐÂY, khác progressBar
            // seek ngay dưới — đó mới là nơi 2 nguồn thật sự DÙNG CHUNG 1 message type). =====
            case 'playerControls.video.play': {
                workflowVideoPlayer.handleVideoPlayState();
                break;
            }

            case 'playerControls.video.pause': {
                workflowVideoPlayer.handleVideoPauseState();
                break;
            }

            case 'playerControls.video.loadedmetadata': {
                workflowVideoPlayer.handleVideoLoadedMetadata();
                break;
            }

            case 'playerControls.video.timeupdate': {
                workflowVideoPlayer.handleVideoTimeUpdate();
                break;
            }

            case 'playerControls.video.ended': {
                workflowVideoPlayer.handleVideoPlayerEnded(); // >1 hàm core (stopListenClock + nextVideo async) -> workflow
                break;
            }

            // ===================== progressBar (kéo tay) =====================
            case 'playerControls.progressBar.seeking': {
                // MỚI (21/07/2026, mục 4 — Video Player mode) — CÙNG 1 DOM listener/message type
                // dùng chung giữa Song/Video (chỉ 1 thanh progress bar vật lý) -> BẮT BUỘC
                // VirtualMachineState (khác 5 case video.* ở trên, mỗi cái có nguồn sự kiện RIÊNG).
                const { value } = msg.payload;
                VirtualMachineState.run([
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: true, callback: () => {
                        workflowVideoPlayer.handleVideoSeeking(value);
                    } },
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: false, callback: () => {
                        handleProgressBarSeeking(value);
                    } },
                ]);
                break;
            }

            case 'playerControls.progressBar.seekCommit': {
                const { value } = msg.payload;
                VirtualMachineState.run([
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: true, callback: () => {
                        workflowVideoPlayer.handleVideoSeekCommit(value);
                    } },
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: false, callback: () => {
                        handleProgressBarSeekCommit(value);
                    } },
                ]);
                break;
            }

            default:
                console.warn(`[router:playerControls] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('playerControls', routerPlayerControls);
