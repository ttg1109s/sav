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
 * QUY TẮC RẼ NHÁNH: 14/17 msg.type ở đây chỉ cần ĐÚNG 1 HÀM CORE (không có shield/modal, không cần
 * phối hợp nhiều hàm, không cần đọc appState nào khác) -> router gọi THẲNG. 'playerControls.
 * shuffle.click' (fix 03/07/2026, mục 3b) cần 2 hàm core nối tiếp có phụ thuộc thứ tự
 * (toggleShuffle() rồi updateShuffleArrayFromQueue() theo giá trị MỚI) -> giao event/workflow/
 * player-controls.js. 'playerControls.settingsDrawer.open'/'.close' (VIẾT LẠI 08/07/2026, HOTFIX
 * 8) cần đọc `appState.get('isVisualizerActive')` để rẽ nhánh -> LUÔN qua VirtualMachineState
 * (Rule 2/3, xem readme/event-bus-flow.md mục 4C); nhánh "đang ở Visualizer" của cả 2 msg.type này
 * cần ≥2 hàm core nối tiếp -> giao Workflow, nhánh "đang ở Playlist" chỉ 1 hàm core -> gọi thẳng
 * ngay trong callback của VirtualMachineState (xem comment đầu file đó).
 *
 * STATE CONTEXT: không có — mọi msg.type độc lập, không có "hồ sơ vụ việc giữa 2 lượt" nào cần nhớ
 * ở tầng router/EventStore cho cụm này.
 *
 * NẠP SAU: event/bus.js, event/workflow/player-controls.js, core/player-controls.js (cần toàn bộ
 * hàm core ở trên, gồm scrollSideLeftToSettingsSmooth/scrollSideLeftToPlaylistSmooth — HOTFIX 8),
 * event/virtual-machine-state.js (VirtualMachineState — dùng trực tiếp trong 2 case Settings),
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
                // VIẾT LẠI (08/07/2026, HOTFIX 8, đúng quy trình Giang chốt) — Router tự
                // `appState.get('isVisualizerActive')` MỘT LẦN rồi rẽ nhánh bằng VirtualMachineState
                // (Rule 2/3: rẽ nhánh theo appState KHÁC luôn qua VMState, không if/else tay):
                // đang ở Visualizer -> giao Workflow (2 bước phụ thuộc thứ tự, xem
                // workflowPlayerControls.openSettingsDrawerFromVisualizer()); đang ở Playlist ->
                // gọi THẲNG core (chỉ 1 hàm, không có bước 2 phụ thuộc — đúng (A) event-bus-flow.md).
                const isVisualizerActive = appState.get('isVisualizerActive');
                VirtualMachineState.run([
                    { state: isVisualizerActive, operation: '===', value: true, callback: () => workflowPlayerControls.openSettingsDrawerFromVisualizer() },
                    { state: isVisualizerActive, operation: '===', value: false, callback: () => scrollSideLeftToSettingsSmooth() },
                ]);
                break;
            }

            case 'playerControls.settingsDrawer.close': {
                // VIẾT LẠI (08/07/2026, HOTFIX 8) — CÙNG lý do ở trên, cả 2 nhánh giờ đi qua
                // Workflow (mỗi nhánh đều cần ≥2 hàm core nối tiếp: validate video nền + reset
                // ngăn xếp panel con + cuộn/trượt — xem workflowPlayerControls.
                // closeSettingsDrawerToPlaylist()/closeSettingsDrawerToVisualizer()).
                const isVisualizerActive = appState.get('isVisualizerActive');
                VirtualMachineState.run([
                    { state: isVisualizerActive, operation: '===', value: true, callback: () => workflowPlayerControls.closeSettingsDrawerToVisualizer() },
                    { state: isVisualizerActive, operation: '===', value: false, callback: () => workflowPlayerControls.closeSettingsDrawerToPlaylist() },
                ]);
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
