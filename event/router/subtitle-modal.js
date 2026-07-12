/**
 * event/router/subtitle-modal.js — Router tên "subtitleModal", tự đăng ký với eventBus.
 *
 * SỬA (10/07/2026) — nút "Sub" ở Control Center giờ CHỈ toggle `isSubtitlesEnabled` (gọi
 * `setSubtitlesEnabled()`, core/subtitle/subtitle-style-settings.js — ĐÃ CÓ SẴN, dùng chung với
 * checkbox trong Settings) — KHÔNG còn điều hướng sang Subtitle Editor nữa (lối vào editor DUY
 * NHẤT giờ là menu 3 chấm mỗi bài hát trong Playlist, xem event/workflow/playlist.js).
 *
 * SỬA (12/07/2026, audit kiến trúc `/event/` — xem readme/changelog/v12.md mục 16) — logic ĐÃ DỜI
 * sang `workflowSubtitleModal.toggleSubtitlesEnabled()` (event/workflow/subtitle-modal.js): case
 * này tự đọc `appState.get('isSubtitlesEnabled')` để chuẩn bị input cho Core — "chuẩn bị state cho
 * Core" tự nó là Workflow (readme/event-bus-flow.md mục 4B), dù chỉ 1 key, dù chỉ gọi đúng 1 hàm.
 */
const routerSubtitleModal = (() => {
    function handle(msg) {
        switch (msg.type) {
            case 'subtitleModal.toggleEnabled.click': {
                workflowSubtitleModal.toggleSubtitlesEnabled();
                break;
            }

            default:
                console.warn(`[routerSubtitleModal] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('subtitleModal', routerSubtitleModal);
