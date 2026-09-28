/**
 * core/visualizer/frame-clock.js — [MỚI 28/09/2026, Phase 4 dọn visualizer] Bước thời gian giữa 2 frame vẽ, dùng
 * chung cho các effect tự tích phân theo thời gian (bar mirror/dot, shape clock). Trước đây mỗi nơi chép 1 dòng
 * `last ? Math.min(100, Math.max(0, now - last)) : 16` trong workflow.
 */

/** dt (ms) kể từ frame trước, kẹp 0-100ms (tab vừa hiện lại không nhảy vọt); frame đầu tiên coi như 16ms. */
function computeFrameDeltaMs(now, lastTime) {
    return lastTime ? Math.min(100, Math.max(0, now - lastTime)) : 16;
}
