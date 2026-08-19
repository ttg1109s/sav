/**
 * core/photo-panel.js — Core NGHIỆP VỤ hiện/ẩn `#photo-panel` (MỚI). DOM TĨNH có sẵn từ
 * dom-refs.js (`photoPanel`), KHÔNG tự `createElement` — KHÔNG cần hậu tố `-ui.js` (Rule 5c).
 *
 * 2 hàm ĐƠN TUYẾN riêng biệt (Rule 1 — "hiện"/"ẩn" là 2 TIẾN TRÌNH khác nhau, không phải 1 tiến
 * trình có nhánh rẽ) — đúng khuôn `showPlaceholderPanel()`/`hidePlaceholderPanel()`
 * (core/placeholder-panel.js) dùng cho Game/Statis.
 *
 * NẠP SAU: core/dom-refs.js (photoPanel).
 */

function showPhotoPanel() {
    photoPanel.classList.remove('hidden');
}

function hidePhotoPanel() {
    photoPanel.classList.add('hidden');
}
