/**
 * core/gameplay/engine.js — core thuần dùng chung mọi mode Game: chấm điểm tier/combo, tổng kết cuối phiên (điểm trung
 * bình/sao/vòng %), hit-test vị trí, đếm ngược, hiệu ứng vỡ vụn, ghi game đang armed / độ khó ưa thích từng game, điều khiển
 * media lúc chơi. Mỗi hàm 1 việc, chỉ nhận tham số, không gọi hàm khác trong file.
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
 * Điểm cộng + combo MỚI (theo TỪNG TIER riêng) cho 1 lần chấm. `cfg.comboTierNames` xếp hạng best -> worst; tier T:
 *   - tăng streak của chính T; reset streak mọi tier TỐT HƠN T; giữ nguyên streak mọi tier KÉM HƠN T
 *     (đang combo Excellent, Perfect xen giữa không làm đứt chuỗi Excellent).
 * Tier không nằm trong bảng (good/bad/miss) -> reset tất cả về 0, điểm không nhân hệ số.
 * @param {object} comboByTierBefore - vd {perfect: 2, excellent: 0}
 * @returns {{ pointsGained: number, newComboByTier: object }}
 */
function computeComboScoreGain(tierName, tierScore, comboByTierBefore, cfg) {
    const ranking = cfg.comboTierNames; // best -> worst
    const rank = ranking.indexOf(tierName);
    const isComboTier = rank !== -1;
    const streak = isComboTier ? (comboByTierBefore[tierName] || 0) + 1 : 0;
    const newComboByTier = isComboTier ? { ...comboByTierBefore } : {};
    ranking.forEach((name, i) => { if (!isComboTier || i < rank) newComboByTier[name] = 0; }); // reset tier TỐT HƠN (hoặc tất cả)
    if (isComboTier) newComboByTier[tierName] = streak;
    const multiplier = isComboTier ? 1 + Math.floor(streak / cfg.comboMultiplierConfig[tierName].stepSize) * cfg.comboMultiplierConfig[tierName].stepValue : 1;
    return { pointsGained: isComboTier ? Math.floor(tierScore * multiplier) : tierScore, newComboByTier };
}

/** Tổng điểm/số lượt đã chấm/breakdown tier SAU 1 lần chấm (tap/commit/miss) — object MỚI, Workflow chỉ việc ghi lại appState.
 * @returns {{ totalScore: number, resolvedCount: number, hitCounts: object }} */
function computeScoreTotalsAfterResolve(totalScore, resolvedCount, hitCounts, tierName, pointsGained) {
    return {
        totalScore: totalScore + pointsGained,
        resolvedCount: resolvedCount + 1,
        hitCounts: { ...hitCounts, [tierName]: (hitCounts[tierName] || 0) + 1 },
    };
}

/** Như computeScoreTotalsAfterResolve() cho `missCount` lượt miss cùng lúc (wave tự hết hạn, mỗi lượt cộng `missScore`).
 * @returns {{ totalScore: number, resolvedCount: number, hitCounts: object }} */
function computeScoreTotalsAfterMisses(totalScore, resolvedCount, hitCounts, missCount, missScore) {
    return {
        totalScore: totalScore + missCount * missScore,
        resolvedCount: resolvedCount + missCount,
        hitCounts: { ...hitCounts, miss: (hitCounts.miss || 0) + missCount },
    };
}

/** Bước đếm ngược trước khi chơi: giá trị kế tiếp + còn đếm tiếp hay đã xong. @param {number} value @returns {{next:number, isRunning:boolean}} */
function computeGameplayCountdownStep(value) {
    const next = value - 1;
    return { next, isRunning: next > 0 };
}

/** Thêm 1 lượt chơi vào `meta.game[mode][difficulty]` — THUẦN, dùng làm `mutate` cho updateMediaMeta() (service/db.js). */
function appendGameplayScore(meta, mode, difficulty, finalScore) {
    const game = { ...(meta.game || {}) };
    const byMode = { ...(game[mode] || {}) };
    byMode[difficulty] = [...(byMode[difficulty] || []), { time: Date.now(), score: finalScore }];
    game[mode] = byMode;
    return { ...meta, game };
}

/** Tên hiển thị ở modal Kết quả của media vừa chơi: tag title (Song) > customName > tên file bỏ đuôi > key — cùng công thức
 * tên hiển thị toàn project (core/playlist/loader.js). @param {object} meta @param {string} key
 * @param {string} filenameStem - stripFileExtension(meta.filename) (core/file-manager/video.js) */
function resolveGameplayScoreTitle(meta, key, filenameStem) {
    return (meta.tag && meta.tag.title) || meta.customName || (meta.filename ? filenameStem : key);
}

/** Note bị tap theo Z-ORDER: `entries` xếp sẵn trên -> dưới (đúng thứ tự `gameplayWaves`, wave xuất hiện sớm hơn nằm trên),
 * trả phần tử ĐẦU TIÊN có tâm trong `tolerancePercent` px — "tap vào cái đang thấy", không xuyên xuống vòng nằm dưới dù tâm
 * vòng dưới gần hơn. */
function findTopmostNoteInTolerance(entries, tapX, tapY, tolerancePercent) {
    for (const entry of entries) {
        const dx = entry.x - tapX, dy = entry.y - tapY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= tolerancePercent) return entry;
    }
    return null;
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

/**
 * Chia % điểm (có thể >100%) thành các LAP cho vòng tròn kết quả — lap[0] luôn ≤100 (vòng chính);
 * mỗi 100% dư thêm 1 lap TRONG, tối đa `maxExtraLaps` lap thêm (phần dư sau đó bỏ). VD totalPercent=250,
 * maxExtraLaps=3 -> [100, 100, 50].
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

/** % điểm cho vòng tròn kết quả (totalScore/maxScore x 100; maxScore 0 -> 0). */
function computeScoreRingPercent(totalScore, maxScore) {
    return maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
}

/** Bố cục `shardCount` mảnh vỡ toả đều quanh tâm, lệch góc ±10° + quãng bay 26-40px ngẫu nhiên.
 * @param {number[]} randomValues - Math.random() của Workflow, 2 giá trị/mảnh theo thứ tự (góc, quãng)
 * @returns {Array<{angleDeg:number, distancePx:number}>} */
function computeShatterShardLayout(shardCount, randomValues) {
    return Array.from({ length: shardCount }, (_, i) => ({
        angleDeg: (360 / shardCount) * i + (randomValues[i * 2] * 20 - 10),
        distancePx: 26 + randomValues[i * 2 + 1] * 14,
    }));
}

/** Hình học vòng tròn % điểm — mỗi lap (computeScoreRingLaps()) 1 vòng bán kính giảm dần, màu theo `palette` (lặp nếu nhiều lap
 * hơn palette), trễ animation so le. `circumference` = điểm xuất phát (rỗng), `target` = đích (CSS @keyframes gameplayRingFill).
 * @param {number[]} laps @param {string[]} palette
 * @returns {{size:number, cx:number, cy:number, strokeWidth:number, circles:Array<{r:number, circumference:number, target:number, color:string, delayMs:number}>}} */
function computeScoreRingGeometry(laps, palette) {
    const size = 120, cx = 60, cy = 60, baseRadius = 52, radiusStep = 11, strokeWidth = 7;
    const circles = laps.map((percent, i) => {
        const r = baseRadius - i * radiusStep;
        const circumference = 2 * Math.PI * r;
        return { r, circumference, target: circumference * (1 - percent / 100), color: palette[i % palette.length], delayMs: i * 220 };
    });
    return { size, cx, cy, strokeWidth, circles };
}

/** Ghi game đang "armed" (null = không game nào) — AppState session-only (service/state/gameplay-runtime.js), không lưu;
 * khác `gameplayPhase` (trạng thái 1 phiên chơi). */
function setGameplayArmedGameId(gameId) {
    appState.set('gameplayArmedGameId', gameId, { skipCheck: true });
    console.log(`writer: "setGameplayArmedGameId", page: "gameplayArmedGameId", content: "${gameId}"`);
}

/** Ghi độ khó đã chọn cho 1 game — PERSISTENT (`gameplayDifficultyByGame`, core/config.js), khác `gameplayDifficulty`
 * (AppState, độ khó của phiên đang chơi). Workflow tự `saveConfig()` ngay sau.
 * @param {string} gameId
 * @param {'easy'|'medium'|'hard'} difficulty */
function setGameDifficultyPreference(gameId, difficulty) {
    appConfigViz.mutateAll(cfg => { cfg.gameplayDifficultyByGame[gameId] = difficulty; });
    console.log(`writer: "setGameDifficultyPreference", page: "gameplayDifficultyByGame.${gameId}", content: "${difficulty}"`);
}

// ── Điều khiển media lúc chơi (Workflow không tự .pause()/.play()/.currentTime=, event-bus-flow.md §7.1) ──────────
// `mediaEl` = getActiveMediaElement() (core/player-controls.js): audio hoặc video. Điều phối: workflowGameplayEngine.
// rewindActiveMedia() / playActiveMedia() (event/workflow/gameplay-engine.js).

/** Đưa media về đầu — PAUSE trước rồi seek 0 (seek trước có thể giật 1 khung lúc còn phát). Vô hại khi đã dừng/đã ở 0. */
function resetGameplayMediaToStart(mediaEl) {
    mediaEl.pause();
    mediaEl.currentTime = 0;
}

/** Về đầu phải qua cổng seek (nạp lại nguồn) khi media ĐÃ dừng mà chưa ở đầu (vừa hết bài, dừng giữa chừng): không có
 * 'pause' nào để xả hàng đợi tiếng iOS, gán `currentTime = 0` trần thì lần phát kế lọt đuôi tiếng cũ. Đang phát -> 'pause'
 * THẬT tự xả (workflowPlayerControls/workflowVideoPlayer); đang ở 0 (vừa nạp) -> không có gì để xả.
 * @param {boolean} isPaused @param {number} currentTimeSec @returns {boolean} */
function shouldGateGameplayRewind(isPaused, currentTimeSec) {
    return isPaused && currentTimeSec > 0;
}
