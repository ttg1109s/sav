/**
 * core/video-editor/timeline-calc.js — Core THUẦN (Rule 1-4 core-function-conventions.md), MỚI (v2,
 * 23/07/2026). Thay cho `recalcTimeline()`/`updateTimelineLayout()` inline của `video.txt` — tách
 * thành các hàm đơn tuyến, nhận tham số, KHÔNG đụng DOM (chỉ tính toán số/pixel, Workflow tự áp kết
 * quả vào style của clip — đúng Rule 2/3).
 *
 * Rule 2 — không đọc appState (trang này không dùng appState). Rule 3 — không gọi core nào khác.
 */

/** Độ dài video đang active (sau cắt) — giây. @param {{start:number,end:number}} cutRange */
function computeActiveDuration(cutRange) {
    return Math.max(0, cutRange.end - cutRange.start);
}

/**
 * Vị trí + độ rộng (px) của 1 clip trên timeline, theo mật độ pixel/giây hiện tại.
 * @param {number} startSec @param {number} lengthSec @param {number} pixelsPerSecond
 * @returns {{leftPx:number, widthPx:number}}
 */
function computeClipLayoutPx(startSec, lengthSec, pixelsPerSecond) {
    return { leftPx: Math.max(0, startSec) * pixelsPerSecond, widthPx: Math.max(0, lengthSec) * pixelsPerSecond };
}

/** Vị trí playhead (px) theo thời gian hiện tại (đã tính theo timeline ACTIVE, 0 = đầu đoạn cắt). */
function computePlayheadLeftPx(currentTimeSec, pixelsPerSecond) {
    return Math.max(0, currentTimeSec) * pixelsPerSecond;
}

/**
 * Đổi 1 toạ độ px trên timeline (đo từ mép trái #video-editor-timeline-content) thành giây, theo
 * mật độ pixel/giây — dùng khi kéo tay cầm/playhead (Workflow tự đo `getBoundingClientRect()` rồi
 * gọi hàm này, KHÔNG tự đọc DOM ở đây).
 * @param {number} offsetPx - khoảng cách từ mép trái timeline tới điểm chạm/kéo.
 * @param {number} pixelsPerSecond
 * @returns {number} giây, KHÔNG kẹp biên (nơi gọi tự kẹp theo ngữ cảnh — Rule 1, hàm này chỉ đổi đơn vị).
 */
function pxToSeconds(offsetPx, pixelsPerSecond) {
    return pixelsPerSecond > 0 ? offsetPx / pixelsPerSecond : 0;
}

/** "m:ss" — dùng cho nhãn thời gian timeline/transport bar. @param {number} totalSeconds */
function formatClipTimeLabel(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
}
