/**
 * event/listener/video-player.js — TẤT CẢ listener của cụm "videoPlayer".
 *
 * "Play mode" toggle sống ở panel File Manager -> Video (event/workflow/file-manager-video.js),
 * không phải ở đây.
 *
 * `bgVideoElement` tự bắn 5 sự kiện CỦA CHÍNH NÓ (play/pause/timeupdate/loadedmetadata/ended) —
 * KHÔNG dùng `audioPlayer` cho video (không đáng tin cậy cross-browser, xem docstring
 * core/video-player.js). Dispatch qua message type RIÊNG (`playerControls.video.*`, không trùng
 * `playerControls.audio.*` của Song). Guard `isVideoPlayerMode` ngay trong từng listener — sự kiện
 * lúc chỉ bật Video nền trang trí (không phải Player mode) phải là no-op.
 *
 * Cử chỉ vuốt next/prev video ĐÃ DỜI sang cụm "visualizerGesture" (lớp phủ chạm riêng
 * #visualizer-gesture-surface, dùng chung cho cả Song lẫn Video) — KHÔNG còn touchstart/touchend
 * ở đây nữa.
 *
 * NẠP SAU: core/dom-refs.js (bgVideoElement, btnCaptureVideoFrame).
 */
if (bgVideoElement) {
    bgVideoElement.addEventListener('play', () => {
        if (!appState.get('isVideoPlayerMode')) return;
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.play', payload: {} });
    });
    bgVideoElement.addEventListener('pause', () => {
        if (!appState.get('isVideoPlayerMode')) return;
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.pause', payload: {} });
    });
    bgVideoElement.addEventListener('loadedmetadata', () => {
        if (!appState.get('isVideoPlayerMode')) return;
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.loadedmetadata', payload: {} });
    });
    bgVideoElement.addEventListener('timeupdate', () => {
        if (!appState.get('isVideoPlayerMode')) return;
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.timeupdate', payload: {} });
    });
    bgVideoElement.addEventListener('ended', () => {
        if (!appState.get('isVideoPlayerMode')) return;
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.ended', payload: {} });
    });
}

if (btnCaptureVideoFrame) {
    btnCaptureVideoFrame.addEventListener('click', () => {
        eventBus.send({ router: 'videoPlayer', type: 'videoPlayer.captureFrame.click', payload: {} });
    });
}
