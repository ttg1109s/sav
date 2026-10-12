/**
 * event/listener/media-wait.js — Listener cụm "mediaWait": 4 sự kiện của 2 phần tử media tĩnh, chỉ eventBus.send (lượt chờ
 * xử lý ở event/workflow/media-wait.js).
 * NẠP SAU CÙNG trong nhóm Listener media (sau event/listener/player-controls.js, video-player.js, visual-bg.js) — lượt chờ
 * phải chạy SAU các listener media gắn sẵn.
 */
const MEDIA_WAIT_LISTEN_TARGETS = { audio: audioPlayer, bgVideo: bgVideoElement };
const MEDIA_WAIT_LISTEN_EVENTS = ['loadedmetadata', 'seeked', 'play', 'playing'];

Object.entries(MEDIA_WAIT_LISTEN_TARGETS).forEach(([target, mediaEl]) => {
    if (!mediaEl) return;
    MEDIA_WAIT_LISTEN_EVENTS.forEach((eventName) => {
        mediaEl.addEventListener(eventName, () => {
            eventBus.send({ router: 'mediaWait', type: 'mediaWait.event', payload: { target, eventName } });
        });
    });
});
