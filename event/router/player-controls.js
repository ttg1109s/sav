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
 * MỚI (21/07/2026, mục 4 — Video Player mode, xem event/workflow/video-player.js) — case
 * 'playPause.click' ĐỌC `appState.get('isVideoPlayerMode')` + VirtualMachineState 2 nhánh loại trừ
 * nhau: true -> giao `workflowVideoPlayer` (video đang "làm bài hát"); false -> gọi THẲNG core cũ y
 * hệt trước đây, KHÔNG đổi hành vi gốc dù chỉ 1 dòng.
 * XOÁ (phản hồi Giang — "đã hợp nhất Video & Song vào Playlist, không cần nữa") — 'backToPlaylist.
 * click'/'settingsDrawer.close' TỪNG CŨNG branch theo `isVideoPlayerMode` (Video Player mode TỪNG
 * bật được từ 1 checkbox sâu trong Settings → File Manager → Video, đã xoá hẳn từ Batch 6) — giờ
 * Video LUÔN được chọn TỪ Playlist (y hệt Song) nên 2 case này gọi THẲNG hành vi gốc, không còn
 * nhánh nào để rẽ (xem docstring tại từng case + event/workflow/video-player.js).
 * [SỬA — ver12 "Song/Video Unification", Batch 2, Giang chốt: "video thừa hưởng cơ chế Playlist,
 * không tạo cơ chế next/prev riêng"] 'next.click'/'prev.click' KHÔNG còn branch ở đây nữa — LUÔN
 * gọi `workflowPlayerControls.goToNextTrack()`/`goToPrevTrack()` (event/workflow/player-
 * controls.js, [SỬA — plan-playmedia-reorg.md] thay `playNext()`/`playPrev()` cũ ĐÃ XOÁ) bất kể
 * `isVideoPlayerMode`, xem case tương ứng bên dưới + docstring `event/workflow/video-player.js`.
 *
 * VIẾT LẠI LẦN 2 (21/07/2026, cùng ngày — Giang phát hiện qua video test: `audioPlayer` không thực
 * sự chạy khi nhận blob video làm src trên 1 số trình duyệt/thiết bị, dù `bgVideoElement` vẫn phát
 * tiếng bình thường — xem docstring đầy đủ core/video-player.js) — BỎ HẲN ý tưởng "audioPlayer câm
 * nuôi mọi thứ cho video" của bản đầu. `bgVideoElement` giờ tự bắn 5 sự kiện CỦA CHÍNH NÓ (play/
 * pause/loadedmetadata/timeupdate/ended), dispatch qua message type RIÊNG `playerControls.video.*`
 * (xem event/listener/video-player.js, guard `isVideoPlayerMode` NGAY trong listener). 4/5 case đó
 * ('video.play'/'video.pause'/'video.loadedmetadata'/'video.timeupdate') gọi THẲNG
 * `workflowVideoPlayer`, KHÔNG cần VirtualMachineState (KHÔNG dùng chung nguồn sự kiện với Song,
 * chỉ bgVideoElement mới bắn ra được). CHỈ 'progressBar.seeking'/'seekCommit' MỚI cần
 * VirtualMachineState riêng — đây là 2 case DUY NHẤT còn dùng CHUNG 1 DOM listener/message type
 * giữa Song và Video (chỉ có 1 thanh progress bar vật lý). Các case 'audio.play'/'audio.pause'/
 * 'audio.loadedmetadata'/'audio.timeupdate' (từ `audioPlayer`) giữ NGUYÊN hành vi gốc, KHÔNG branch
 * gì — `audioPlayer` HOÀN TOÀN không liên quan tới Video Player mode ở 4 case đó.
 *
 * [SỬA — Game Mode + Video Player mode, phản hồi Giang "áp dụng cho cả hai, dùng chung"]
 * 'video.ended' KHÔNG còn nằm trong cụm "gọi thẳng, không branch" ở trên nữa — GỘP CHUNG case với
 * 'audio.ended' (JS switch fallthrough, y hệt nhau — bài/video hết bài xử lý giống hệt, tách 2 case
 * trùng logic là dư thừa). Case gộp đó VẪN cần VirtualMachineState (branch theo `gameplayPhase`,
 * xem case bên dưới) — nên tổng còn lại thật sự "gọi thẳng, 0 rẽ nhánh" là 4 case video.* kể trên,
 * không phải 5 như bản viết lại lần 2 nữa.
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
 * NẠP SAU: event/bus.js, event/workflow/player-controls.js (cần `workflowPlayerControls.
 * goToNextTrack()`/`goToPrevTrack()`/`handleSongEnded()`/`handlePlayPauseClick()` — MỚI, plan-
 * playmedia-reorg.md), event/workflow/video-player.js, core/player-controls.js (cần
 * togglePlayPause/scrollSideLeftToSettingsSmooth/scrollSideLeftToPlaylistSmooth — HOTFIX 8).
 * NẠP TRƯỚC: event/listener/player-controls.js.
 */
const routerPlayerControls = (() => {

    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            // ===================== Click UI =====================
            case 'playerControls.backToPlaylist.click': {
                // XOÁ (phản hồi Giang — "đã hợp nhất Video & Song vào Playlist, không cần nữa") —
                // nhánh isVideoPlayerMode===true (workflowVideoPlayer.handleBackToPlaylistFromVideoMode(),
                // cuộn về Settings thay vì Playlist) TỪNG cần thiết vì Video Player mode CHỈ bật
                // được từ checkbox SÂU trong Settings → File Manager → Video (đã xoá hẳn từ Batch
                // 6). Giờ Video LUÔN được chọn TỪ Playlist (y hệt Song, dropdown/menu 3 chấm thống
                // nhất) nên "Back" luôn đúng là về Playlist — KHÔNG còn 2 nhánh, gọi THẲNG.
                handleBackToPlaylistClick();
                break;
            }

            case 'playerControls.playPause.click': {
                // MỚI (21/07/2026, mục 4 — Video Player mode) — VirtualMachineState branch theo
                // `isVideoPlayerMode` (event/workflow/video-player.js). Nhánh false GỌI
                // `workflowPlayerControls.handlePlayPauseClick()` — [SỬA, plan-playmedia-reorg.md]
                // TRƯỚC ĐÂY gọi thẳng `togglePlayPause()` (Core) — hàm đó tự đọc appState + tự
                // gộp 2 tiến trình khác nhau ("chưa có gì đang tải -> phát bài đầu" / "toggle")
                // nên KHÔNG còn đạt điều kiện (A) "gọi thẳng core" nữa (event-bus-flow.md mục 4A:
                // case cần chuẩn bị appState cho core, dù chỉ gọi đúng 1 hàm, đã là (B) Workflow).
                VirtualMachineState.run([
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: true, callback: () => {
                        workflowVideoPlayer.togglePlayPauseVideo();
                    } },
                    { state: appState.get('isVideoPlayerMode'), operation: '===', value: false, callback: () => {
                        workflowPlayerControls.handlePlayPauseClick();
                    } },
                ]);
                break;
            }

            case 'playerControls.next.click': {
                // [SỬA — ver12 "Song/Video Unification", Batch 2, Giang chốt: "video thừa hưởng
                // cơ chế Playlist, không tạo cơ chế next/prev riêng"] KHÔNG có VirtualMachineState
                // branch theo isVideoPlayerMode ở ĐÂY — LUÔN gọi `workflowPlayerControls.
                // goToNextTrack(true)` (DÙNG CHUNG với Song, đọc displayOrder/shuffleIndices/
                // currentKey — đã đúng cho Video từ Batch 1/2) rồi tự dispatch đúng mediaType qua
                // `workflowPlayer.playMedia()`. workflowVideoPlayer.nextVideo() (mảng videoPlaylist
                // riêng) ĐÃ XOÁ HẲN, xem event/workflow/video-player.js.
                // [SỬA — plan-playmedia-reorg.md] `playNext()` (Core) ĐÃ XOÁ — thay bằng
                // `workflowPlayerControls.goToNextTrack()` (event/workflow/player-controls.js).
                workflowPlayerControls.goToNextTrack(true); // force=true giữ đúng hành vi gốc của nút Next
                break;
            }

            case 'playerControls.prev.click': {
                // Cùng lý do 'next.click' ngay trên. [SỬA — plan-playmedia-reorg.md] `playPrev()`
                // (Core) ĐÃ XOÁ — thay bằng `workflowPlayerControls.goToPrevTrack()`.
                workflowPlayerControls.goToPrevTrack();
                break;
            }

            case 'playerControls.shuffle.click': {
                workflowPlayerControls.toggleShuffleAndReshuffle(); // 2 hàm core nối tiếp, phụ thuộc thứ tự -> workflow (fix mục 3b)
                break;
            }

            case 'playerControls.repeat.click': {
                // SỬA (phản hồi Giang, mục 3 "nhớ trạng thái shuffle/repeat/stats") — trước đây
                // gọi THẲNG 1 hàm core (cycleRepeatMode()) — giờ cần thêm bước lưu bền config
                // (`_persistPlayerConfig()`, async, đụng IndexedDB) NGAY SAU, thành ≥2 bước phối
                // hợp -> giao cho workflowPlayerControls đúng quy ước đầu file này.
                workflowPlayerControls.cycleRepeatModeAndPersist();
                break;
            }

            case 'playerControls.settingsDrawer.open': {
                // SỬA (đợt tái cấu trúc bottom nav App Panel, phản hồi Giang) — Settings không còn
                // là "trang" trong #side-left-container (scrollSideLeftToSettingsSmooth() đã xoá,
                // xem core/player-controls.js) — giờ mở qua core/generic-drawer.js (90vh). Liên
                // tuyến domain (event-bus-flow.md mục 3a, TH2) — router "playerControls" gọi thẳng
                // workflow miền "appSettings" (tái dùng, KHÔNG viết lại logic mở drawer).
                workflowAppSettings.open();
                break;
            }

            case 'playerControls.settingsDrawer.close': {
                // SỬA (đợt tái cấu trúc bottom nav App Panel) — đóng Settings giờ là đóng Generic
                // Drawer (workflowAppSettings.close(), tự gọi workflowGenericDrawerHelpers.closeFully()
                // + workflowAppPanelNav.activateMedia()) — KHÔNG còn resetSettingsStackToMain()/
                // scrollSideLeftToPlaylistSmooth() (mechanism cũ, đã xoá).
                workflowAppSettings.close();
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

            case 'playerControls.audio.ended':
            case 'playerControls.video.ended': {
                // [SỬA — Game Mode + Video Player mode, phản hồi Giang "áp dụng cho cả hai, dùng
                // chung"] GỘP 2 msg.type (audio VÀ video) vào ĐÚNG 1 case — trước đây video.ended
                // có case RIÊNG gọi thẳng workflowVideoPlayer.handleVideoPlayerEnded() (ĐÃ XOÁ),
                // KHÔNG hề check gameplayPhase -> video hết bài lúc đang chơi Game Mode tự next im
                // lặng, không hiện màn kết quả (khác hẳn audio, vốn đã có nhánh này từ 16/08/2026).
                // Bài/video hết đều xử lý Y HỆT nhau (Rule: Song/Video Unification, "dùng chung cơ
                // chế Playlist, không tạo cơ chế riêng") — viết 2 case trùng logic là đúng thứ
                // "hai đường không cần thiết" cần tránh, nên gộp fallthrough JS chuẩn (switch-case
                // không có break giữa 2 nhãn = cùng chạy 1 thân).
                //
                // SỬA (16/08/2026, Game Mode Circle v1) — khi đang ở Game Mode (mọi phase KHÁC
                // 'idle'), hết bài/video PHẢI dừng lại hiện màn kết quả (workflowGameplay.
                // onSongEnded()), KHÔNG auto next như bình thường
                // (workflowPlayerControls.handleMediaEnded()). 2 tiến trình khác hẳn nhau chọn
                // theo appState -> đúng chỗ dùng VirtualMachineState.
                // [SỬA — plan-playmedia-reorg.md] `handleAudioEnded()` (Core) ĐÃ XOÁ — thay bằng
                // `workflowPlayerControls.handleMediaEnded()` (event/workflow/player-controls.js,
                // DÙNG CHUNG cho cả audio lẫn video — thay `handleSongEnded()`/
                // `workflowVideoPlayer.handleVideoPlayerEnded()` cũ, 2 hàm TRÙNG THÂN đã gộp làm 1).
                const gameplayPhase = appState.get('gameplayPhase');
                VirtualMachineState.run([
                    { state: gameplayPhase, operation: '===', value: 'idle', callback: () => workflowPlayerControls.handleMediaEnded() },
                    { state: gameplayPhase, operation: '!==', value: 'idle', callback: () => workflowGameplay.onSongEnded() },
                ]);
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
            // viết lại lần 2 — audioPlayer không còn dùng cho video) — 4 msg.type RIÊNG (KHÔNG
            // trùng 'audio.*' của Song, xem event/listener/video-player.js), mỗi cái CHỈ tới từ
            // bgVideoElement lúc isVideoPlayerMode=true (guard NGAY trong listener) -> gọi THẲNG,
            // KHÔNG cần VirtualMachineState (không có nhánh nào khác để rẽ tại ĐÂY, khác progressBar
            // seek ngay dưới — đó mới là nơi 2 nguồn thật sự DÙNG CHUNG 1 message type).
            // 'video.ended' KHÔNG còn ở cụm này — đã gộp CHUNG case với 'audio.ended' ở trên, xem
            // comment tại đó. =====
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
