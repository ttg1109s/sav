/**
 * event/router/subtitle-modal.js — Router tên "subtitleModal", tự đăng ký với eventBus.
 *
 * SỬA (10/07/2026) — nút "Sub" ở Control Center giờ CHỈ toggle `isSubtitlesEnabled` (gọi thẳng
 * `setSubtitlesEnabled()`, core/subtitle/subtitle-style-settings.js — ĐÃ CÓ SẴN, dùng chung với
 * checkbox trong Settings) — KHÔNG còn điều hướng sang Subtitle Editor nữa (lối vào editor DUY
 * NHẤT giờ là menu 3 chấm mỗi bài hát trong Playlist, xem event/workflow/playlist.js).
 */
const routerSubtitleModal = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'subtitleModal.toggleEnabled.click': {
                setSubtitlesEnabled(!appState.get('isSubtitlesEnabled')); // core/subtitle/subtitle-style-settings.js
                break;
            }

            default:
                console.warn(`[routerSubtitleModal] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('subtitleModal', routerSubtitleModal);
