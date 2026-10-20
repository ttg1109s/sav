/**
 * event/listener/video-player.js — Listener cụm "videoPlayer" + 5 sự kiện của `bgVideoElement` cho Video Player mode.
 *
 * Video Player phát bằng chính `bgVideoElement` (không qua `audioPlayer` — không đáng tin cậy cross-browser, xem
 * core/video-player.js), message RIÊNG `playerControls.video.*`. Lúc `#bg-video` chỉ làm nền trang trí (không phải Player
 * mode) 5 message này bị Block gate chặn (event/block.js) — Listener chỉ gửi. Cử chỉ vuốt next/prev: cụm "visualizerGesture".
 *
 * NẠP SAU: core/dom-refs.js (bgVideoElement, btnCaptureVideoFrame), event/block.js.
 */
if (bgVideoElement) {
    bgVideoElement.addEventListener('play', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.play', payload: {} });
    });
    bgVideoElement.addEventListener('pause', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.pause', payload: {} });
    });
    bgVideoElement.addEventListener('loadedmetadata', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.loadedmetadata', payload: {} });
    });
    bgVideoElement.addEventListener('timeupdate', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.timeupdate', payload: {} });
    });
    bgVideoElement.addEventListener('ended', () => {
        eventBus.send({ router: 'playerControls', type: 'playerControls.video.ended', payload: {} });
    });
}

if (btnCaptureVideoFrame) {
    btnCaptureVideoFrame.addEventListener('click', () => {
        eventBus.send({ router: 'videoPlayer', type: 'videoPlayer.captureFrame.click', payload: {} });
    });
}
