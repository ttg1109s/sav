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

/**
 * Điểm cộng + combo MỚI (theo TỪNG TIER riêng, KHÔNG phải 1 số chung) cho 1 lần tap.
 *
 * [SỬA — phản hồi Giang] `cfg.comboTierNames` là bảng XẾP HẠNG best->worst. Tier T được tap:
 *   - Tăng combo CHÍNH T (streak riêng của T).
 *   - RESET combo mọi tier ĐỨNG TRƯỚC T trong bảng (tốt hơn T) — 1 cú kém hơn phá vỡ chuỗi của
 *     tier giỏi hơn (VD: đang combo Perfect, tap Excellent -> combo Perfect reset).
 *   - GIỮ NGUYÊN combo mọi tier ĐỨNG SAU T (kém hơn T) — 1 cú tốt hơn KHÔNG ảnh hưởng chuỗi tier
 *     kém hơn (VD: đang combo Excellent, tap Perfect xen giữa -> combo Excellent KHÔNG đổi, vẫn
 *     tiếp tục đúng số khi Excellent lặp lại — đã kiểm chứng bằng test tay 2 kịch bản Giang đưa).
 * Tier KHÔNG combo-eligible (good/bad/miss) -> reset TẤT CẢ về 0.
 * @param {object} comboByTierBefore - vd {perfect: 2, excellent: 0}
 * @returns {{ pointsGained: number, newComboByTier: object }}
 */
function computeComboScoreGain(tierName, tierScore, comboByTierBefore, cfg) {
    const ranking = cfg.comboTierNames; // best -> worst
    const rank = ranking.indexOf(tierName);
    if (rank === -1) {
        const resetAll = {};
        ranking.forEach((name) => { resetAll[name] = 0; });
        return { pointsGained: tierScore, newComboByTier: resetAll };
    }
    const newComboByTier = { ...comboByTierBefore };
    const streak = (comboByTierBefore[tierName] || 0) + 1;
    newComboByTier[tierName] = streak;
    for (let i = 0; i < rank; i++) newComboByTier[ranking[i]] = 0; // reset tier TỐT HƠN
    const multiplier = 1 + Math.floor(streak / cfg.comboMultiplierConfig[tierName].stepSize) * cfg.comboMultiplierConfig[tierName].stepValue;
    return { pointsGained: Math.floor(tierScore * multiplier), newComboByTier };
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

/** Phát hiện "nhạc vừa biến động" (energy/section) — DỜI sang core/audio-analysis.js
 * (detectMusicTransition(), gộp sẵn 2 cửa sổ) 28/08/2026, dùng chung ngoài phạm vi gameplay
 * (Space, Fireworks). Xem event/workflow/gameplay.js để biết cách gọi hiện tại. */

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

/** Ghi ĐÚNG game đang "armed" PERSISTENT (nullable — null = không game nào armed), khác
 * `gameplayPhase` (đó là trạng thái 1 PHIÊN chơi, không lưu qua reload). [SỬA — 02/09/2026, Game
 * Panel app-store list] THAY `setGameplayModeEnabled(checked)` (1 boolean DUY NHẤT) — giờ catalog
 * (core/gameplay/catalog.js) có thể có ≥2 game, cần biết ARM ĐÚNG game nào chứ không còn 1 cờ
 * chung. Không tự gọi saveConfig() (Rule 3a) — Workflow tự gọi ngay sau. */
function setGameplayArmedGameId(gameId) {
    appConfigViz.mutateAll(cfg => { cfg.gameplayArmedGameId = gameId; });
    console.log(`writer: "setGameplayArmedGameId", page: "gameplayArmedGameId", content: "${gameId}"`);
}
