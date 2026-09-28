/**
 * event/workflow/visualizer/beat-window.js — [MỚI 28/09/2026, Phase 4 dọn visualizer] Điều phối "cửa sổ beat
 * flux" (core/visualizer/beat-window.js) cho 4 effect tự phát hiện chuyển đoạn: Vortex (rẽ ống), Connector
 * circuit (đổi góc máy), Connector brain (burst), Lighting fireworks (finale). Mỗi effect giữ object cửa sổ riêng
 * và tự quyết thứ tự các bước (giữ đúng thứ tự từng bản cũ); file này chỉ gom 3 bước lặp lại ở cả 4 nơi.
 */

const workflowVizBeatWindow = {
    /** Cộng flux của frame hiện tại (phần tử cuối `fluxHistory`, task phân tích ghi) vào khoảng đang mở. */
    accumulateLatest(win, fluxHistory) {
        if (fluxHistory.length === 0) return;
        accumulateBeatFlux(win, fluxHistory[fluxHistory.length - 1]); // core/visualizer/beat-window.js
    },

    /** true = có beat MỚI (đã đánh dấu tiêu thụ); false = chưa có beat nào mới từ lần trước. */
    consumeNewBeat(win, lastBeatTime) {
        if (!isNewBeatForWindow(win, lastBeatTime)) return false; // core
        markBeatConsumed(win, lastBeatTime); // core
        return true;
    },

    /** Đóng khoảng giữa 2 beat: đẩy flux trung bình của khoảng vào lịch sử của cửa sổ. */
    closeInterval(win) {
        this._pushIntervalMean(win, takeBeatIntervalMean(win)); // core
    },

    /** Khoảng không có frame nào (null) thì không đẩy gì. */
    _pushIntervalMean(win, mean) {
        if (mean === null) return;
        pushBoundedHistory(win.history, mean, VIZ_BEAT_FLUX_HISTORY_MAX); // core/audio-analysis.js
    },
};
