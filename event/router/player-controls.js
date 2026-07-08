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
 * QUY TẮC RẼ NHÁNH: 15/17 msg.type ở đây chỉ cần ĐÚNG 1 HÀM CORE (không có shield/modal, không cần
 * phối hợp nhiều hàm, không cần đọc appState nào khác) -> router gọi THẲNG. 'playerControls.
 * shuffle.click' (fix 03/07/2026, mục 3b) cần 2 hàm core nối tiếp có phụ thuộc thứ tự
 * (toggleShuffle() rồi updateShuffleArrayFromQueue() theo giá trị MỚI) -> giao event/workflow/
 * player-controls.js. 'playerControls.settingsDrawer.close' cần ≥2 hàm core nối tiếp (validate
 * video nền + reset ngăn xếp panel con + cuộn) -> giao Workflow — xem
 * workflowPlayerControls.closeSettingsDrawer().
 *
 * LỊCH SỬ (không còn áp dụng, giữ lại để tra cứu nếu cần) — batch 07-08/07/2026 (HOTFIX 7-10) đã
 * từng cho phép mở Settings NGAY TỪ Visualizer (nút #btn-settings trong Control Center), khiến cả
 * 2 msg.type này phải đọc `appState.get('isVisualizerActive')` + VirtualMachineState để rẽ nhánh
 * "đang ở Playlist" / "đang ở Visualizer". HOTFIX 11 (08/07/2026, Giang chốt) BỎ HẲN nút đó (xem
 * components/visualizer-overlay.js) sau khi nhiều lần vá vẫn không ổn định trên thiết bị thật —
 * Settings giờ LUÔN mở từ Playlist, không còn nhánh nào để rẽ, dọn sạch VirtualMachineState khỏi
 * cả 2 case.
 *
 * STATE CONTEXT: không có — mọi msg.type độc lập, không có "hồ sơ vụ việc giữa 2 lượt" nào cần nhớ
 * ở tầng router/EventStore cho cụm này.
 *
 * NẠP SAU: event/bus.js, event/workflow/player-controls.js, core/player-controls.js (cần toàn bộ
 * hàm core ở trên, gồm scrollSideLeftToSettingsSmooth/scrollSideLeftToPlaylistSmooth — HOTFIX 8),
 * playlist/* (cần playNext/playPrev/window.playSong — đã có từ trước). NẠP TRƯỚC:
 * event/listener/player-controls.js.
 */
const routerPlayerControls = (() => {

    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            // ===================== Click UI =====================
            case 'playerControls.backToPlaylist.click': {
                handleBackToPlaylistClick();
                break;
            }

            case 'playerControls.playPause.click': {
                togglePlayPause();
                break;
            }

            case 'playerControls.next.click': {
                playNext(true); // hàm core có sẵn, force=true giữ đúng hành vi gốc của nút Next
                break;
            }

            case 'playerControls.prev.click': {
                playPrev();
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

            // ===================== progressBar (kéo tay) =====================
            case 'playerControls.progressBar.seeking': {
                const { value } = msg.payload;
                handleProgressBarSeeking(value);
                break;
            }

            case 'playerControls.progressBar.seekCommit': {
                const { value } = msg.payload;
                handleProgressBarSeekCommit(value);
                break;
            }

            default:
                console.warn(`[router:playerControls] Không nhận diện được msg.type "${msg.type}" — bỏ qua.`);
        }
    }

    return { handle };
})();

eventBus.register('playerControls', routerPlayerControls);
