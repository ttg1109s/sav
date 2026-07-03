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
 * QUY TẮC RẼ NHÁNH: 16/17 msg.type ở đây chỉ cần ĐÚNG 1 HÀM CORE (không có shield/modal, không cần
 * phối hợp nhiều hàm) -> router gọi THẲNG. RIÊNG 'playerControls.shuffle.click' (fix 03/07/2026,
 * mục 3b) giờ cần 2 hàm core nối tiếp có phụ thuộc thứ tự (toggleShuffle() rồi
 * updateShuffleArrayFromQueue() theo giá trị MỚI) -> giao event/workflow/player-controls.js (xem
 * comment đầu file đó).
 *
 * STATE CONTEXT: không có — mọi msg.type độc lập, không có "hồ sơ vụ việc giữa 2 lượt" nào cần nhớ
 * ở tầng router/EventStore cho cụm này.
 *
 * NẠP SAU: event/bus.js, event/workflow/player-controls.js, core/player-controls.js (cần toàn bộ
 * hàm core ở trên), playlist/* (cần playNext/playPrev/window.playSong — đã có từ trước). NẠP
 * TRƯỚC: event/listener/player-controls.js.
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
                openSettingsDrawer();
                break;
            }

            case 'playerControls.settingsDrawer.close': {
                closeSettingsDrawer();
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
