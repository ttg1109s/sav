/**
 * core/visualizer/beat-window.js — "Cửa sổ beat flux" dùng chung cho các effect tự phát hiện CHUYỂN ĐOẠN
 * nhạc (Vortex rẽ ống, Connector circuit đổi góc máy, Fireworks finale).
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

// =====================================================================================================================
// DỜI 01/10/2026 từ core/audio-analysis.js (Giang: "chuyển nốt") — phát hiện chuyển đoạn / ranh giới phrase trên lịch sử
// flux THEO BEAT mà từng nơi tự tích luỹ (cửa sổ ở trên với effect; Game Circle giữ lịch sử riêng). Logic giữ nguyên.
// =====================================================================================================================

/** "Nhạc vừa biến động" — so trung bình `windowSize` MỐC/BEAT gần nhất với `windowSize`
 * mốc trước đó, lệch tương đối (không phải tuyệt đối — bất biến độ to nhỏ bài hát/thiết
 * bị) >= `relativeThreshold`. Gộp SẴN 2 cửa sổ (ngắn = build-up/drop nhanh, dài = chuyển
 * đoạn verse/chorus) — nơi gọi chỉ cần đưa energyWindowBeats/sectionWindowBeats/
 * fluxThreshold, không tự OR 2 lần riêng nữa. Dùng chung cho game mode Circle, Space,
 * Fireworks — mỗi nơi tự tích luỹ `beatFluxHistory` RIÊNG (không dùng chung mảng giữa các
 * domain — mỗi domain 1 nhịp tiêu thụ khác nhau).
 * @param {number[]} beatFluxHistory - mỗi phần tử = flux trung bình đoạn giữa 2 beat liên tiếp.
 * @param {number} energyWindowBeats - cửa sổ ngắn, số BEAT.
 * @param {number} sectionWindowBeats - cửa sổ dài, số BEAT.
 * @param {number} relativeThreshold - tỉ lệ lệch tối thiểu, vd 0.35 = lệch 35%.
 */
function detectMusicTransition(beatFluxHistory, energyWindowBeats, sectionWindowBeats, relativeThreshold) {
    // SỬA (01/10/2026, dọn nợ core rule, Giang duyệt "xử lý toàn bộ") — bỏ 2 hàm con `avg`/`checkWindow` vi phạm
    // Rule 3c: `avg` trùng logic computeArrayMean() cùng file (3c-2), `checkWindow` không tự có vòng lặp (3c-1) và
    // gọi hàm con khác (3c-4). Viết thẳng 1 vòng lặp qua 2 cửa sổ. Không cần tính TRUNG BÌNH: 2 đoạn so sánh luôn
    // cùng độ dài `size`, nên |TB mới - TB cũ| / TB cũ = |tổng mới - tổng cũ| / tổng cũ — kết quả y hệt bản cũ,
    // chữ ký giữ nguyên (5 nơi gọi không đổi).
    const windowSizes = [energyWindowBeats, sectionWindowBeats];
    const len = beatFluxHistory.length;
    for (let w = 0; w < windowSizes.length; w++) {
        const size = windowSizes[w];
        if (len < size * 2) continue; // chưa đủ 2 đoạn để so
        let recentSum = 0, priorSum = 0;
        for (let i = len - size; i < len; i++) recentSum += beatFluxHistory[i];
        for (let i = len - size * 2; i < len - size; i++) priorSum += beatFluxHistory[i];
        if (priorSum <= 0) continue; // tránh chia 0 lúc đoạn trước hoàn toàn im lặng
        if (Math.abs(recentSum - priorSum) / priorSum >= relativeThreshold) return true;
    }
    return false;
}

/** Xấp xỉ ranh giới phrase bằng đếm beat cố định (không có phrase detection thật). Nơi gọi
 * tự đếm `beatsSincePhraseRefresh`, reset về 0 khi hàm này trả true. */
function isPhraseBoundary(beatsSincePhraseRefresh, refreshBeatsForPhrase) {
    return beatsSincePhraseRefresh >= refreshBeatsForPhrase;
}
