/**
 * core/visualizer/beat-window.js — "Cửa sổ beat flux" dùng chung cho các effect tự phát hiện CHUYỂN ĐOẠN
 * nhạc (Vortex rẽ ống, Connector circuit đổi góc máy, Brain burst, Fireworks finale).
 *
 * [MỚI — 28/09/2026, Phase 4 dọn visualizer] Thay 4 bộ biến chép y hệt nhau trong
 * event/workflow/visualizer-render.js cũ (`_vx*`/`_cn*`/`_br*`/`_fw*`: lastConsumedBeatTime,
 * pendingBeatFluxSum/Count, beatFluxHistory, beatsSinceLast*). Mỗi effect giữ RIÊNG 1 object cửa sổ
 * (`createBeatFluxWindow()`), các hàm dưới đây chỉ đọc/sửa tại chỗ object nhận vào (Rule 3b — sửa
 * chính cái vừa nhận), không đọc appState, không gọi core khác. Điều phối (lấy flux mới nhất, đẩy trung
 * bình vào lịch sử, thứ tự các bước riêng từng effect) ở event/workflow/visualizer/beat-window.js.
 *
 * Hot path (mỗi frame) nhưng viết đủ Rule 1-3 ngay từ đầu.
 */

/** Độ dài tối đa lịch sử flux-trung-bình-giữa-2-beat (giữ nguyên 24 như cũ). */
const VIZ_BEAT_FLUX_HISTORY_MAX = 24;

/** 1 cửa sổ mới. `beatsSinceTrigger` lớn sẵn — cho phép kích hoạt ngay lần đầu, không phải đợi. */
function createBeatFluxWindow() {
    return { lastConsumedBeatTime: 0, pendingSum: 0, pendingCount: 0, history: [], beatsSinceTrigger: 999 };
}

/** Cộng dồn flux của frame hiện tại vào khoảng đang mở (giữa 2 beat). */
function accumulateBeatFlux(win, latestFlux) {
    win.pendingSum += latestFlux;
    win.pendingCount++;
}

/** Mốc beat toàn cục (`lastBeatTime`) có phải beat MỚI so với lần cửa sổ này tiêu thụ gần nhất không. */
function isNewBeatForWindow(win, lastBeatTime) {
    return lastBeatTime > 0 && lastBeatTime !== win.lastConsumedBeatTime;
}

/** Đánh dấu đã tiêu thụ beat có mốc `lastBeatTime`. */
function markBeatConsumed(win, lastBeatTime) {
    win.lastConsumedBeatTime = lastBeatTime;
}

/** Đóng khoảng đang mở: trả flux trung bình của khoảng (null nếu khoảng không có frame nào) và đưa bộ
 * cộng dồn về 0 cho khoảng kế tiếp. */
function takeBeatIntervalMean(win) {
    const mean = win.pendingCount > 0 ? win.pendingSum / win.pendingCount : null;
    win.pendingSum = 0;
    win.pendingCount = 0;
    return mean;
}

/** +1 beat kể từ lần kích hoạt gần nhất (debounce "tối thiểu N beat giữa 2 lần kích hoạt"). */
function countBeatSinceTrigger(win) {
    win.beatsSinceTrigger++;
}

/** Vừa kích hoạt -> đếm lại từ 0. */
function resetBeatTriggerCount(win) {
    win.beatsSinceTrigger = 0;
}
