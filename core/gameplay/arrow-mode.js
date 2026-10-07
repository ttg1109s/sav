/**
 * core/gameplay/arrow-mode.js — MỚI (07/10/2026, Giang yêu cầu game "Arrow"). Core THUẦN riêng mode "Arrow": dựng dải
 * mũi tên theo level, thời lượng 1 vòng chạy của nút tròn (theo BPM + tăng tốc), tiến nút tròn mỗi frame, chấm 1 lần
 * nhập mũi tên, chấm commit theo vạch đích, lên level. Chấm combo/sao/điểm trung bình DÙNG CHUNG core/gameplay/
 * engine.js — Workflow (event/workflow/gameplay-arrow.js) tự gọi từng hàm theo thứ tự.
 *
 * Rule 1-3: mỗi hàm 1 việc, chỉ nhận tham số (config GAMEPLAY_ARROW_CONFIG truyền vào — core/gameplay/arrow-config.js),
 * không appState, không gọi hàm khác của project, không tự random (Workflow chuẩn bị sẵn mảng Math.random()). Mọi hàm
 * trả 1 object kết quả gộp để Workflow chỉ nhận rồi phân phát (event-bus-flow.md mục 7.1).
 *
 * Mũi tên trong dải: `{ dir, reversed, expectedDir }` — `dir` là hướng HIỂN THỊ (0..7, 0 = lên, theo chiều kim đồng
 * hồ), `reversed` = vòng ĐỎ (phải nhập ngược), `expectedDir` = hướng người chơi PHẢI bấm (= dir, hoặc dir + 4 nếu đỏ).
 */

/**
 * Dựng 1 dải mũi tên cho `level` (= số mũi tên). Hướng mỗi mũi tên ngẫu nhiên 0..7; số vòng ĐỎ roll 0..tối đa theo
 * `diffCfg.reversedMaxByLevel[level - 1]` (kẹp không vượt số mũi tên), vị trí vòng đỏ chọn ngẫu nhiên không trùng.
 * @param {number} level
 * @param {object} diffCfg - GAMEPLAY_ARROW_CONFIG.difficulty[độ khó]
 * @param {object} cfg - GAMEPLAY_ARROW_CONFIG
 * @param {number[]} randomValues - >= 2*level+1 số trong [0,1) (Workflow chuẩn bị, cfg.randomPoolSize)
 * @returns {{ dir: number, reversed: boolean, expectedDir: number }[]}
 */
function buildArrowRoundArrows(level, diffCfg, cfg, randomValues) {
    const count = Math.max(1, Math.floor(level));
    const directionCount = cfg.directionCount;
    const reversedMax = Math.min(count, diffCfg.reversedMaxByLevel[count - 1] || 0);
    const reversedCount = Math.min(reversedMax, Math.floor(randomValues[count] * (reversedMax + 1)));

    // Vị trí vòng đỏ: xếp chỉ số theo khoá ngẫu nhiên riêng từng ô, lấy reversedCount ô đầu (không trùng).
    const positionOrder = Array.from({ length: count }, (_, i) => i)
        .sort((a, b) => randomValues[count + 1 + a] - randomValues[count + 1 + b]);
    const reversedPositions = new Set(positionOrder.slice(0, reversedCount));

    const arrows = [];
    for (let i = 0; i < count; i++) {
        const dir = Math.min(directionCount - 1, Math.floor(randomValues[i] * directionCount));
        const reversed = reversedPositions.has(i);
        arrows.push({ dir, reversed, expectedDir: reversed ? (dir + directionCount / 2) % directionCount : dir });
    }
    return arrows;
}

/**
 * Thời lượng 1 vòng chạy 0 -> 100% của nút tròn. BPM hợp lệ: `beatsPerRound` nhịp, nhân đôi tới khi >= minBasePeriodMs;
 * không có BPM -> fallbackPeriodMs. Hệ số tốc độ = 1 + lap * speedUpPerLap (trần maxSpeedMultiplier, Easy luôn 1).
 * Kết quả chia hệ số tốc độ rồi kẹp [minPeriodMs, maxPeriodMs].
 * @param {string} bpmText - audioAnalysis.bpmText() ("---" khi chưa có)
 * @param {number} lap - số lần đã đi hết dải level và quay về level đầu (0 = lần đầu)
 * @returns {{ periodMs: number, speedMultiplier: number }}
 */
function computeArrowRoundTiming(bpmText, lap, diffCfg, cfg) {
    const bpm = parseFloat(bpmText);
    let basePeriodMs = (!Number.isFinite(bpm) || bpm <= 0) ? cfg.fallbackPeriodMs : (60000 / bpm) * cfg.beatsPerRound;
    while (basePeriodMs < cfg.minBasePeriodMs) basePeriodMs *= 2;
    const speedMultiplier = Math.max(1, Math.min(diffCfg.maxSpeedMultiplier, 1 + lap * diffCfg.speedUpPerLap));
    const periodMs = Math.min(cfg.maxPeriodMs, Math.max(cfg.minPeriodMs, basePeriodMs / speedMultiplier));
    return { periodMs, speedMultiplier };
}

/**
 * Tiến nút tròn 1 frame. Mỗi frame cộng tối đa `maxFrameDeltaMs` (app ẩn rồi hiện lại / giật frame không làm nút nhảy
 * cóc). Chạm 100% -> `hasWrapped` (Workflow kết thúc vòng, mở dải mới từ 0%).
 * @returns {{ elapsedMs: number, progressPercent: number, hasWrapped: boolean }}
 */
function advanceArrowCursor(elapsedMs, lastTickAt, now, periodMs, maxFrameDeltaMs) {
    const deltaMs = Math.min(maxFrameDeltaMs, Math.max(0, now - lastTickAt));
    const nextElapsedMs = Math.min(periodMs, elapsedMs + deltaMs);
    return {
        elapsedMs: nextElapsedMs,
        progressPercent: (nextElapsedMs / periodMs) * 100,
        hasWrapped: nextElapsedMs >= periodMs,
    };
}

/**
 * Chấm 1 lần bấm hướng (yêu cầu 4b-4d): đúng mũi tên đang chờ -> sang ô kế; nhập đủ cả dải -> 'complete'; sai -> HUỶ
 * mọi ô đã đúng, về ô đầu ('wrong'); dải đã đủ mà bấm thêm -> 'ignored' (không đổi gì, chờ Enter).
 * @returns {{ inputIndex: number, outcome: 'correct'|'complete'|'wrong'|'ignored' }}
 */
function applyArrowInput(arrows, inputIndex, dir) {
    const isAlreadyComplete = inputIndex >= arrows.length;
    const isCorrect = !isAlreadyComplete && arrows[inputIndex].expectedDir === dir;
    const nextIndex = isAlreadyComplete ? inputIndex : (isCorrect ? inputIndex + 1 : 0);
    const outcome = isAlreadyComplete ? 'ignored' : (!isCorrect ? 'wrong' : (nextIndex >= arrows.length ? 'complete' : 'correct'));
    return { inputIndex: nextIndex, outcome };
}

/**
 * Chấm commit (Enter) — yêu cầu 4e: nút tròn nằm trong vùng đích (tâm ± (core + blur)) VÀ đã nhập đủ dải -> tier theo
 * tỉ lệ khoảng cách tới tâm; còn lại (ngoài vùng, hoặc dải chưa đủ) -> miss.
 * @returns {{ name: string, score: number }}
 */
function classifyArrowCommitTier(progressPercent, inputIndex, arrowCount, cfg) {
    const zoneHalfPercent = cfg.targetCoreHalfPercent + cfg.targetBlurPercent;
    const ratio = Math.abs(progressPercent - cfg.targetPercent) / zoneHalfPercent;
    const isSequenceComplete = arrowCount > 0 && inputIndex >= arrowCount;
    const tier = isSequenceComplete ? cfg.tiers.find((entry) => ratio <= entry.maxRatio) : null;
    return tier ? { name: tier.name, score: tier.score } : { name: 'miss', score: cfg.missScore };
}

/** Level vòng sau: +1; quá maxLevel -> về minLevel và lap + 1 (mốc tăng tốc). @returns {{ level: number, lap: number }} */
function computeNextArrowLevel(level, lap, diffCfg) {
    const wraps = level >= diffCfg.maxLevel;
    return { level: wraps ? diffCfg.minLevel : level + 1, lap: wraps ? lap + 1 : lap };
}

/** Hình học vùng đích (% bề ngang thanh) — CSS vẽ đúng vùng core chấm điểm (cùng 3 số config). */
function computeArrowTargetZoneGeometry(cfg) {
    const zoneHalfPercent = cfg.targetCoreHalfPercent + cfg.targetBlurPercent;
    return {
        zoneLeftPercent: cfg.targetPercent - zoneHalfPercent,
        zoneWidthPercent: zoneHalfPercent * 2,
        coreLeftPercent: cfg.targetPercent - cfg.targetCoreHalfPercent,
        coreWidthPercent: cfg.targetCoreHalfPercent * 2,
    };
}

/** Phần riêng Arrow của tổng kết cuối bài — điểm tối đa lý thuyết (mọi vòng Perfect) + số ít/nhiều cho nhãn lượt chơi.
 * Điểm trung bình/sao dùng chung engine.js (Workflow gọi riêng). @returns {{ maxScore: number, isPluralPlayCount: boolean }} */
function computeArrowEndExtras(roundCount, playCount, cfg) {
    const perfectTier = cfg.tiers.find((entry) => entry.name === 'perfect');
    return { maxScore: roundCount * perfectTier.score, isPluralPlayCount: playCount !== 1 };
}

/** Toạ độ (px, hệ toạ độ `#gameplay-tier-popup-layer` = `#gameplay-layer`) hiện tier popup ngay DƯỚI giữa dải (phía trên
 * là thanh tiến trình — popup đè lên sẽ che vạch đích). `stripRect`/`layerRect` = getBoundingClientRect() do Workflow đọc
 * (Rule 3b: core không tự đọc DOM). @returns {{ x: number, y: number }} */
function computeArrowPopupAnchor(stripRect, layerRect) {
    return {
        x: stripRect.left + stripRect.width / 2 - layerRect.left,
        y: stripRect.bottom - layerRect.top + 26,
    };
}
