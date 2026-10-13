/**
 * event/workflow/playlist-empty-state.js — Workflow của router "playlistEmptyState": 2 nút to "Phát"/"Trộn bài" ở hàng 3
 * header Playlist (#btn-playlist-empty-play / #btn-playlist-empty-shuffle; tên cụm giữ từ thời chỉ dùng cho trạng thái rỗng).
 *
 * 2 nút luôn làm việc trên TOÀN BỘ top-level: đang phát 1 section con ("Phát bài đã chọn" ghi đè displayOrder) thì đưa
 * hàng đợi về top-level trước rồi mới phát/trộn. "Trộn bài" luôn trộn mới, kể cả Shuffle đã bật sẵn.
 *
 * NẠP SAU: event/workflow/playlist-order.js, event/workflow/playlist-render.js, event/workflow/player.js,
 * event/workflow/player-controls.js, core/playlist/order.js, core/playlist/render.js. NẠP TRƯỚC:
 * event/router/playlist-empty-state.js.
 */

/** Nút "Phát" — việc cần làm do core resolvePlaylistEmptyPlayAction() trả. */
const PLAYLIST_EMPTY_PLAY_BY_ACTION = {
    visualizer: () => workflowPlayerControls.returnToVisualizer(), // event/workflow/player-controls.js
    resetTopLevel: () => workflowPlaylistEmptyState.resetToTopLevelThenPlay(),
    play: (key) => workflowPlayer.playMedia(key), // event/workflow/player.js
    none: () => {}, // Nguồn rỗng
};

/** Trộn lại top-level theo trạng thái Shuffle: đang tắt -> bật + trộn (đúng việc của nút Shuffle Control Center); đã bật ->
 * trộn lại thẳng với cờ true (gọi toggle sẽ TẮT cờ). updateShuffleArrayFromQueue() luôn random mới. */
const PLAYLIST_EMPTY_RESHUFFLE_BY_SHUFFLE_ON = {
    false: () => workflowPlayerControls.toggleShuffleAndReshuffle(), // event/workflow/player-controls.js
    true: (displayOrder, playlistOrder) => updateShuffleArrayFromQueue(displayOrder, playlistOrder, true), // core/playlist/order.js
};

const workflowPlaylistEmptyState = {

    /** 'playlistEmptyState.play.click' — "đang phát" tính lại từ state mỗi lần bấm (cùng công thức đặt nhãn nút,
     * workflowPlaylistRender.syncPlayButtonPlayingState()), không dựa vào cache trên nút. */
    handlePlayClick() {
        const { currentKey, isVideoPlayerMode, isPhotoPlayerMode, activeMediaSource, displayOrder, sectionQueueActive } = appState.get(['currentKey', 'isVideoPlayerMode', 'isPhotoPlayerMode', 'activeMediaSource', 'displayOrder', 'sectionQueueActive']);
        const playingMediaType = resolvePlayingMediaType(isVideoPlayerMode, isPhotoPlayerMode); // core/playlist/render.js
        const isPlayingListed = isPlayingMediaListed(currentKey, playingMediaType, activeMediaSource, displayOrder); // core/playlist/render.js
        const { action, key } = resolvePlaylistEmptyPlayAction({ isPlayingListed, sectionActive: sectionQueueActive, playingMediaType, activeMediaSource, currentKey, displayOrder }); // core/playlist/order.js
        PLAYLIST_EMPTY_PLAY_BY_ACTION[action](key);
    },

    /** "Phát" khi đang phát 1 section: về top-level, resync shuffleIndices (phòng Shuffle đang bật), phát tiếp bài đang
     * phát nếu còn hợp lệ, không thì bài đầu. */
    resetToTopLevelThenPlay() {
        this._resetToTopLevel();
        const { displayOrder, playlistOrder, isShuffle, currentKey } = appState.get(['displayOrder', 'playlistOrder', 'isShuffle', 'currentKey']);
        updateShuffleArrayFromQueue(displayOrder, playlistOrder, isShuffle); // core/playlist/order.js
        if (displayOrder.length === 0) return;
        workflowPlayer.playMedia(resolveTopLevelResumeKey(currentKey, displayOrder)); // core/playlist/order.js
    },

    /** "Trộn bài" khi đang phát 1 section: về top-level rồi trộn + phát. */
    resetToTopLevelThenShuffle() {
        this._resetToTopLevel();
        this.reshuffleTopLevelAlways();
    },

    /** "Trộn bài" (không có section): luôn trộn mới rồi phát bài đầu hàng đợi shuffle. */
    reshuffleTopLevelAlways() {
        const { isShuffle, displayOrder, playlistOrder } = appState.get(['isShuffle', 'displayOrder', 'playlistOrder']);
        PLAYLIST_EMPTY_RESHUFFLE_BY_SHUFFLE_ON[!!isShuffle](displayOrder, playlistOrder);
        this._playShuffleHead();
    },

    /** Đưa displayOrder về top-level (recomputeDisplayOrder() tự đặt sectionQueueActive=false) + vẽ lại danh sách. */
    _resetToTopLevel() {
        workflowPlaylistOrder.recomputeDisplayOrder(); // event/workflow/playlist-order.js
        workflowPlaylistOrder.recomputeRenderOrder();
        workflowPlaylistRender.renderPlaylistDiff(); // event/workflow/playlist-render.js
    },

    /** Phát bài đầu của hàng đợi shuffle vừa trộn. */
    _playShuffleHead() {
        const { playlistOrder, shuffleIndices } = appState.get(['playlistOrder', 'shuffleIndices']);
        if (playlistOrder.length === 0) return;
        workflowPlayer.playMedia(shuffleIndices[0]); // event/workflow/player.js
    },
};
