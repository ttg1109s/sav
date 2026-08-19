/**
 * core/gameplay/engine.js — Core thuần DÙNG CHUNG cho mọi mode Game (không riêng Circle): chấm
 * điểm tier/combo, tổng kết cuối phiên (final/star/delta%), hit-test vị trí, phát hiện chuyển đoạn
 * nhạc theo flux, bật/tắt Game Mode. Rule 1-3: mỗi hàm 1 việc, chỉ nhận tham số, không gọi hàm khác
 * trong cùng file.
 */

/** Tier theo khoảng cách chuẩn hoá tới centerRadius (gapOuter/gapInner 2 phía khác mẫu số). */
function classifyTapTier(radius, cfg) {
    const diff = radius - cfg.centerRadius;
    const ratio = diff >= 0 ? diff / cfg.gapOuter : -diff / cfg.gapInner;
    if (ratio > 1) return null;
    for (const tier of cfg.tiers) {
        if (ratio <= tier.maxRatio) return { name: tier.name, score: tier.score };
    }
    return null;
}

/** Điểm cộng + combo streak mới cho 1 lần tap. Chỉ tier trong comboTierNames cộng dồn + nhân
 * multiplier bậc thang; tier khác làm gãy combo về 0. */
function computeComboScoreGain(tierName, tierScore, comboStreakBefore, cfg) {
    const continuesCombo = cfg.comboTierNames.includes(tierName);
    if (!continuesCombo) return { pointsGained: tierScore, newComboStreak: 0 };
    const newComboStreak = comboStreakBefore + 1;
    const multiplier = 1 + Math.floor(newComboStreak / cfg.comboMultiplierStepSize) * cfg.comboMultiplierStepValue;
    return { pointsGained: Math.floor(tierScore * multiplier), newComboStreak };
}

/** Note gần vị trí tap nhất trong dung sai `tolerancePercent` — null nếu ngoài dung sai. */
function findNearestNoteByPosition(entries, tapX, tapY, tolerancePercent) {
    let best = null, bestDist = Infinity;
    for (const entry of entries) {
        const dx = entry.x - tapX, dy = entry.y - tapY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= tolerancePercent && dist < bestDist) { bestDist = dist; best = entry; }
    }
    return best;
}

/** Điểm trung bình cuối phiên = tổng điểm / số vòng đã xuất hiện. */
function computeFinalAverageScore(totalScore, circleCount) {
    if (circleCount <= 0) return 0;
    return totalScore / circleCount;
}

/** Số sao (0..starMax) theo tỉ lệ totalScore/maxScore, làm tròn theo threshold, clamp 2 đầu. */
function computeStarRating(totalScore, maxScore, cfg) {
    if (maxScore <= 0) return 0;
    const raw = Math.max(0, (totalScore / maxScore) * cfg.starMax);
    const frac = raw % 1;
    const rounded = frac >= cfg.starRoundingThreshold ? Math.ceil(raw) : Math.floor(raw);
    return Math.min(cfg.starMax, rounded);
}

/** % lệch totalScore so với maxScore, giữ dấu +/- (KHÔNG clamp — vượt 100% khi combo bonus vượt lý
 * thuyết, nơi gọi tự quyết định hiển thị thế nào, xem engine-ui.js::buildScoreRingSvg()). */
function computeScoreDeltaPercent(totalScore, maxScore) {
    if (maxScore <= 0) return 0;
    return ((totalScore - maxScore) / maxScore) * 100;
}

/**
 * Phát hiện "chuyển đoạn" (energy/section) — so trung bình `windowSize` MỐC gần nhất với
 * `windowSize` mốc trước đó, lệch tương đối (KHÔNG phải tuyệt đối — bất biến theo độ to nhỏ tổng
 * thể của bài hát/thiết bị) >= `relativeThreshold` (vd 0.35 = lệch 35%).
 *
 * [SỬA — nghiên cứu lại công thức flux, phản hồi Giang] TRƯỚC ĐÂY nhận thẳng `fluxHistory`
 * (appState, đẩy 1 mẫu MỖI FRAME render — core/audio-analysis.js) với `windowSize=10` cố định:
 * ở 60fps chỉ là 167ms/cửa sổ (ở 120fps còn 83ms) — bị nhiễu tức thời chi phối, KHÔNG phản ánh
 * chuyển đoạn nhạc thật (vốn diễn ra trong ≥0.5-4s), và cùng threshold nhạy khác nhau tuỳ fps máy.
 * Threshold cũ (15/35/60) cũng là số TUYỆT ĐỐI — không thích ứng theo độ to nhỏ tổng thể từng bài.
 * Nơi gọi (event/workflow/gameplay-engine.js) giờ PHẢI truyền vào 1 mốc/BEAT (đã gộp trung bình
 * đoạn giữa 2 beat, KHÔNG phải giá trị thô mỗi frame) — đơn vị "beat" độc lập hoàn toàn fps máy,
 * và threshold đổi sang tỉ lệ tương đối — bất biến theo độ to nhỏ bài hát.
 * @param {number[]} beatFluxHistory - mỗi phần tử = flux trung bình đoạn giữa 2 beat liên tiếp.
 * @param {number} windowSize - số BEAT (không phải số frame).
 * @param {number} relativeThreshold - tỉ lệ lệch tối thiểu, vd 0.35.
 */
function detectFluxTransition(beatFluxHistory, windowSize, relativeThreshold) {
    if (beatFluxHistory.length < windowSize * 2) return false;
    const recent = beatFluxHistory.slice(-windowSize);
    const prior = beatFluxHistory.slice(-windowSize * 2, -windowSize);
    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const recentAvg = avg(recent), priorAvg = avg(prior);
    if (priorAvg <= 0) return false; // tránh chia 0 lúc đoạn trước hoàn toàn im lặng
    return Math.abs(recentAvg - priorAvg) / priorAvg >= relativeThreshold;
}

/**
 * Chia % điểm (có thể >100%) thành các LAP cho vòng tròn kết quả — lap[0] luôn ≤100 (vòng chính);
 * mỗi 100% dư thêm 1 lap TRONG, tối đa `maxExtraLaps` lap thêm (dư nữa dồn hết vào lap cuối, KHÔNG
 * tràn vô hạn). VD totalPercent=250, maxExtraLaps=3 -> [100, 100, 50].
 * @returns {number[]} mỗi phần tử trong (0,100], length <= 1+maxExtraLaps
 */
function computeScoreRingLaps(totalPercent, maxExtraLaps) {
    const clamped = Math.max(0, totalPercent);
    const laps = [Math.min(100, clamped)];
    let remaining = clamped - 100;
    while (remaining > 0 && laps.length <= maxExtraLaps) {
        laps.push(Math.min(100, remaining));
        remaining -= 100;
    }
    return laps;
}

/** Ghi cấu hình bật/tắt Game Mode PERSISTENT (khác gameplayPhase — đó là 1 phiên). Không tự gọi
 * saveConfig() (Rule 3a) — Workflow tự gọi ngay sau. */
function setGameplayModeEnabled(checked) {
    appConfigViz.mutateAll(cfg => { cfg.gameplayModeEnabled = checked; });
    console.log(`writer: "setGameplayModeEnabled", page: "gameplayModeEnabled", content: "${checked}"`);
}
