/**
 * event/router/player-controls.js — Router "playerControls": nút điều khiển phát (Back, Play/Pause, Next/Prev, Phát lại,
 * Shuffle, Repeat, mở/đóng Settings), sự kiện `audioPlayer` (`playerControls.audio.*`), sự kiện `bgVideoElement` của Video
 * Player mode (`playerControls.video.*` — Block gate chặn lúc không ở mode đó, event/block.js), thanh tiến trình
 * (`progressBar.seeking`/`seekCommit` — 1 thanh dùng chung Song/Video), đồng hồ giả Photo (`photo.ended`).
 *
 * Rẽ theo state (loại media đang phát, chủ thể của 'ended') qua VirtualMachineState; còn lại giao thẳng Workflow.
 *
 * NẠP SAU: event/bus.js, event/workflow/{player-controls,video-player,photo-player}.js. NẠP TRƯỚC:
 * event/listener/player-controls.js.
 */
const routerPlayerControls = (() => {

    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {

            // ===================== Click UI / bố cục =====================
            // Bố cục màn hình đổi qua mốc 1024px lúc đang chạy (event/listener/player-controls.js).
            case 'playerControls.screenLayout.change': {
                workflowPlayerControls.handleScreenLayoutChange(msg.payload.isStacked);
                break;
            }

            case 'playerControls.backToPlaylist.click': {
                workflowPlayerControls.handleBackToPlaylistClick();
                break;
            }

            case 'playerControls.playPause.click': {
                // `mode` gộp 2 cờ thành 3 giá trị loại trừ nhau — VirtualMachineState chạy MỌI rule khớp, so 2 cờ riêng thì
                // lúc Photo đang phát cả rule "không Video" lẫn rule "Photo" cùng khớp.
                const mode = appState.get('isVideoPlayerMode') ? 'video' : appState.get('isPhotoPlayerMode') ? 'photo' : 'song';
                VirtualMachineState.run([
                    { state: mode, operation: '===', value: 'video', callback: () => {
                        workflowVideoPlayer.togglePlayPauseVideo();
                    } },
                    { state: mode, operation: '===', value: 'photo', callback: () => {
                        workflowPhotoPlayer.togglePlayPausePhoto(); // event/workflow/photo-player.js
                    } },
                    { state: mode, operation: '===', value: 'song', callback: () => {
                        workflowPlayerControls.handlePlayPauseClick();
                    } },
                ]);
                break;
            }

            case 'playerControls.next.click': {
                // Song/Video/Photo dùng chung hàng đợi Playlist — workflowPlayer.playMedia() tự phân loại media.
                workflowPlayerControls.goToNextTrack(true); // force=true — bấm Next là ý định rõ ràng (bỏ qua lặp 1 bài)
                break;
            }

            case 'playerControls.prev.click': {
                workflowPlayerControls.goToPrevTrack();
                break;
            }

            case 'playerControls.restart.click': { // icon "Phát lại" Control Center, Song/Video/Photo dùng chung (workflow tự phân loại)
                workflowPlayerControls.restartCurrentTrack();
                break;
            }

            case 'playerControls.shuffle.click': {
                workflowPlayerControls.toggleShuffleAndReshuffle();
                break;
            }

            case 'playerControls.repeat.click': {
                workflowPlayerControls.cycleRepeatModeAndPersist();
                break;
            }

            case 'playerControls.settingsDrawer.open': {
                workflowAppSettings.open(); // liên tuyến — Settings mở trong Generic Drawer (event/workflow/app-settings.js)
                break;
            }

            case 'playerControls.settingsDrawer.close': {
                workflowAppSettings.close();
                break;
            }

            // ===================== Sự kiện audioPlayer =====================
            case 'playerControls.audio.play': {
                workflowPlayerControls.handleAudioPlayEvent();
                break;
            }

            case 'playerControls.audio.pause': {
                workflowPlayerControls.handleAudioPauseEvent();
                // Pause từ ngoài (tai nghe, màn hình khoá, cuộc gọi) lúc đang ghi = như bấm X. Tự guard recordPhase ===
                // 'recording' — pause do chính lệnh dừng ghi bắn ra tới lúc phase đã là 'stopping' nên không lặp.
                workflowRecorder.handleInterruption();
                break;
            }

            case 'playerControls.audio.ended':
            case 'playerControls.video.ended':
            case 'playerControls.photo.ended': {
                // Hết bài/video/ảnh xử lý chung 1 case. Chủ thể của 'ended': phiên ghi âm (đánh dấu hết + dừng ghi; Huỷ/Lưu
                // xong mới sang bài kế) > Game (modal kết quả của mode đang chơi) > player (tự sang bài kế, tôn trọng
                // repeatMode). Ghi âm và Game loại trừ nhau (Block gate 'recorder.start.click'); Photo không có Game.
                const { gameplayPhase, recordPhase } = appState.get(['gameplayPhase', 'recordPhase']);
                const endedOwner = recordPhase !== 'idle' ? 'recorder' : (gameplayPhase !== 'idle' ? 'game' : 'player');
                VirtualMachineState.run([
                    { state: endedOwner, operation: '===', value: 'player', callback: () => workflowPlayerControls.handleMediaEnded() },
                    { state: endedOwner, operation: '===', value: 'game', callback: () => workflowGameplayEngine.onActiveModeMediaEnded() },
                    { state: endedOwner, operation: '===', value: 'recorder', callback: () => workflowRecorder.onMediaEnded() },
                ]);
                break;
            }

            case 'playerControls.audio.loadedmetadata': {
                workflowPlayerControls.handleAudioLoadedMetadataEvent();
                break;
            }

            case 'playerControls.audio.error': {
                workflowPlayerControls.handleAudioErrorEvent();
                break;
            }

            case 'playerControls.audio.timeupdate': {
                workflowPlayerControls.handleAudioTimeUpdateEvent();
                break;
            }

            case 'playerControls.audio.seeked': {
                updateMediaPositionState(); // core/player-controls.js — (A) không cần state
                break;
            }

            // ===================== Sự kiện bgVideoElement (Video Player mode) =====================
            // Chỉ tới lúc isVideoPlayerMode = true (Block gate, event/block.js); 'video.ended' đi chung case 'ended' ở trên.
            case 'playerControls.video.play': {
                workflowVideoPlayer.handleVideoPlayState();
                break;
            }

            case 'playerControls.video.pause': {
                workflowVideoPlayer.handleVideoPauseState();
                workflowRecorder.handleInterruption(); // cùng lý do case 'playerControls.audio.pause'
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

            // ===================== progressBar (kéo tay / seek-hold) =====================
            // 1 thanh dùng chung Song/Video. Photo không có nhánh — thanh seek ẩn hẳn ở Photo Player mode.
            case 'playerControls.progressBar.seeking': {
                const { value } = msg.payload;
                const mode = appState.get('isVideoPlayerMode') ? 'video' : 'song';
                VirtualMachineState.run([
                    { state: mode, operation: '===', value: 'video', callback: () => {
                        workflowVideoPlayer.handleVideoSeeking(value);
                    } },
                    { state: mode, operation: '===', value: 'song', callback: () => {
                        workflowPlayerControls.handleSongSeeking(value); // + phụ đề theo vị trí kéo
                    } },
                ]);
                break;
            }

            case 'playerControls.progressBar.seekCommit': {
                const { value } = msg.payload; // kéo tay hoặc seek-hold (event/workflow/visualizer-gesture.js) — cùng 1 đường
                const mode = appState.get('isVideoPlayerMode') ? 'video' : 'song';
                VirtualMachineState.run([
                    { state: mode, operation: '===', value: 'video', callback: () => {
                        workflowVideoPlayer.handleVideoSeekCommit(value);
                    } },
                    { state: mode, operation: '===', value: 'song', callback: () => {
                        workflowPlayerControls.handleSongSeekCommit(value); // event/workflow/player-controls.js — cổng seek
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
