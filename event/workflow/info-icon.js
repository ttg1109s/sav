/**
 * event/workflow/info-icon.js — "THẰNG THỰC THI CUỐI" của router "infoIcon".
 * MỚI (phản hồi Giang — icon (i) nhỏ dùng chung, xem core/info-icon-ui.js).
 */
const workflowInfoIcon = {
    /** Ứng với 'infoIcon.click'. SỬA (06/10/2026, Giang) — popover neo ngay tại icon thay popup giữa màn.
     * @param {string} text @param {HTMLElement} anchorEl - icon (i) vừa bấm */
    show(text, anchorEl) {
        showInfoPopover(text, anchorEl); // core/info-icon-ui.js
    },
};
