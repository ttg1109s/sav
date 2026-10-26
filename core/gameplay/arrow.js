/**
 * core/gameplay/arrow.js — MỚI (07/10/2026, Giang yêu cầu game mới "Arrow"). Cấu hình và logic thuần cho mode Arrow (dữ liệu,
 * không logic — cùng bản chất core/gameplay/catalog.js) cho mode "Arrow": dải vòng tròn chứa mũi tên 8 hướng, thanh
 * tiến trình có vạch đích 80%, bàn phím tròn 8 hướng + nút Enter commit.
 *
 * Mọi hàm Core (core/gameplay/arrow.js) nhận object này qua THAM SỐ (giống GAMEPLAY_CIRCLE_CONFIG,
 * service/state/gameplay-runtime.js) — không đọc trực tiếp. Chấm điểm/combo/sao/modal End DÙNG CHUNG engine
 * (core/gameplay/engine.js + event/workflow/gameplay-engine.js) — nên config có ĐỦ các field engine đọc:
 * `comboTierNames`, `comboMultiplierConfig`, `comboPopupScalePerStreak/Max`, `starMax`, `starRoundingThreshold`
 * (giá trị y hệt Circle — 1 bảng điểm/combo cho mọi game).
 *
 * Hướng (`dir`) là số nguyên 0..7 theo chiều kim đồng hồ, 0 = lên: 0 ↑, 1 ↗, 2 →, 3 ↘, 4 ↓, 5 ↙, 6 ←, 7 ↖. Hướng
 * ngược = (dir + 4) % 8 (core/gameplay/arrow.js::buildArrowRoundArrows()).
 */
const GAMEPLAY_ARROW_CONFIG = Object.freeze({
    directionCount: 8,

    // ── Thanh tiến trình (đơn vị %, 0..100 dọc thanh) ───────────────────────────────────────────
    // Vạch đích ở 80%. Vùng tính điểm = tâm vạch ± (targetCoreHalfPercent + targetBlurPercent) — "bao gồm tâm + dải
    // blur" (yêu cầu 4e). Ngoài vùng này commit -> miss. Vẽ vùng (CSS) và chấm điểm (core) cùng đọc 3 số này.
    targetPercent: 80,
    targetCoreHalfPercent: 1.5,   // nửa bề rộng vạch tâm (nhấp nháy)
    targetBlurPercent: 7,         // bề rộng dải blur MỖI bên vạch tâm

    // Tier theo tỉ lệ |progress - 80| / (core + blur) — 0 = trúng tâm, 1 = mép ngoài dải blur.
    tiers: Object.freeze([
        Object.freeze({ name: 'perfect',   maxRatio: 0.2,  score: 5 }),
        Object.freeze({ name: 'excellent', maxRatio: 0.45, score: 3 }),
        Object.freeze({ name: 'good',      maxRatio: 0.75, score: 1 }),
        Object.freeze({ name: 'bad',       maxRatio: 1.0,  score: 0 }),
    ]),
    missScore: -2, // commit ngoài vùng / commit khi chưa nhập đủ dải / chạy tới 100% mà không commit

    // ── Thời lượng 1 vòng chạy 0 -> 100% của nút tròn ──────────────────────────────────────────────
    // Theo BPM bài đang phát: beatsPerRound nhịp, nhân đôi tới khi >= minBasePeriodMs (bài nhanh không quá gấp trên
    // màn chạm). Chưa có BPM (đầu bài) -> fallbackPeriodMs. Sau đó CHIA hệ số tăng tốc (mỗi lần hết dải level
    // quay về level đầu, xem difficulty.*.speedUpPerLap), kẹp [minPeriodMs, maxPeriodMs].
    beatsPerRound: 4,
    minBasePeriodMs: 2600,
    fallbackPeriodMs: 3200,
    minPeriodMs: 1500,
    maxPeriodMs: 6000,
    maxFrameDeltaMs: 100,         // 1 frame tối đa cộng chừng này ms — app ẩn/giật frame không làm nút "nhảy cóc"

    randomPoolSize: 32,           // số Math.random() Workflow chuẩn bị sẵn cho 1 dải (>= 2*level+1 với level tối đa 9)

    // ── Engine dùng chung (giống Circle) ───────────────────────────────────────────────────────────
    comboTierNames: Object.freeze(['perfect', 'excellent']),
    comboMultiplierConfig: Object.freeze({
        perfect:   Object.freeze({ stepSize: 5, stepValue: 0.15 }),
        excellent: Object.freeze({ stepSize: 8, stepValue: 0.1 }),
    }),
    comboPopupScalePerStreak: 0.08,
    comboPopupScaleMax: 1.8,
    starMax: 5,
    starRoundingThreshold: 0.8,

    /**
     * Độ khó (yêu cầu 6):
     *   - `minLevel..maxLevel` — level = SỐ mũi tên trong 1 dải. Mỗi vòng chạy (0 -> 100%) lên 1 level, quá maxLevel
     *     quay về minLevel (1 "lap").
     *   - `speedUpPerLap` / `maxSpeedMultiplier` — hệ số tốc độ = 1 + lap * speedUpPerLap, trần maxSpeedMultiplier.
     *     Easy = 0 (không tăng tốc).
     *   - `reversedMaxByLevel[level - 1]` — số mũi tên ĐỎ (nhập ngược hướng) TỐI ĐA trong 1 dải ở level đó; số thật
     *     roll ngẫu nhiên 0..tối đa. Medium: tối đa 1 mọi level. Hard: level 3-5 tối đa 2, 7-9 tối đa 4 — level 1, 2, 6
     *     KHÔNG có mũi tên đỏ (đọc đúng nguyên văn yêu cầu "3-5 (tối đa 2), 7-9 (tối đa 4)").
     */
    difficulty: Object.freeze({
        easy:   Object.freeze({ minLevel: 1, maxLevel: 7, speedUpPerLap: 0,    maxSpeedMultiplier: 1,   reversedMaxByLevel: Object.freeze([0, 0, 0, 0, 0, 0, 0]) }),
        medium: Object.freeze({ minLevel: 1, maxLevel: 7, speedUpPerLap: 0.12, maxSpeedMultiplier: 1.6, reversedMaxByLevel: Object.freeze([1, 1, 1, 1, 1, 1, 1]) }),
        hard:   Object.freeze({ minLevel: 1, maxLevel: 9, speedUpPerLap: 0.15, maxSpeedMultiplier: 1.9, reversedMaxByLevel: Object.freeze([0, 0, 2, 2, 2, 0, 4, 4, 4]) }),
    }),
});


// ─────────────────────────────────────────────────────────────────────────────

/**
 * core/gameplay/arrow.js — MỚI (07/10/2026, Giang yêu cầu game "Arrow"). Core THUẦN riêng mode "Arrow": dựng dải
 * mũi tên theo level, thời lượng 1 vòng chạy của nút tròn (theo BPM + tăng tốc), tiến nút tròn mỗi frame, chấm 1 lần
 * nhập mũi tên, chấm commit theo vạch đích, lên level. Chấm combo/sao/điểm trung bình DÙNG CHUNG core/gameplay/
 * engine.js — Workflow (event/workflow/gameplay-arrow.js) tự gọi từng hàm theo thứ tự.
 *
 * Rule 1-3: mỗi hàm 1 việc, chỉ nhận tham số (config GAMEPLAY_ARROW_CONFIG truyền vào — core/gameplay/arrow.js),
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


// ─────────────────────────────────────────────────────────────────────────────

/**
 * core/gameplay/arrow.js — MỚI (07/10/2026, game "Arrow"). Core RIÊNG mode "Arrow" ghi lên DOM TĨNH của stage
 * (components/gameplay-arrow-stage.js — tra qua core/dom-refs.js, Workflow truyền element vào). KHÔNG hậu tố `-ui`
 * (Rule 5c): file không tự createElement cụm DOM mới, chỉ gán class/style/text/innerHTML lên phần tử có sẵn — cùng khuôn
 * core/generic-drawer.js. Không appState.get() (Rule 2), không gọi hàm khác của project (Rule 3a), không đọc DOM để lấy
 * giá trị (Rule 3b — đo kích thước do Workflow đọc rồi truyền vào), không addEventListener (listener tĩnh ở
 * event/listener/gameplay.js). HTML dải mũi tên do components/gameplay-arrow-stage.js::renderGameplayArrowStripHtml()
 * dựng — Workflow truyền chuỗi xuống paintArrowStrip() (Rule 5d: core không giữ markup).
 *
 * Mọi hàm là 1 lần ghi cùng tập vị trí (chỉ khác giá trị) hoặc switch A/B trên 1 phần tử — Rule 1 PASS.
 */

/** Vẽ vùng đích (dải blur) + vạch tâm theo hình học % do core/gameplay/arrow.js::computeArrowTargetZoneGeometry()
 * trả — CÙNG số core dùng chấm điểm, nên mắt thấy đúng vùng được tính. */
function paintArrowTargetZone(zoneEl, targetEl, geometry) {
    zoneEl.style.left = `${geometry.zoneLeftPercent}%`;
    zoneEl.style.width = `${geometry.zoneWidthPercent}%`;
    targetEl.style.left = `${geometry.coreLeftPercent}%`;
    targetEl.style.width = `${geometry.coreWidthPercent}%`;
}

/** Nút tròn + phần thanh đã chạy — gọi MỖI FRAME (hot path), chỉ đổi transform (không layout). Rail rộng đúng bằng
 * thanh nên translateX(%) của rail = % dọc thanh. */
function paintArrowCursor(railEl, fillEl, progressPercent) {
    railEl.style.transform = `translate3d(${progressPercent}%, 0, 0)`;
    fillEl.style.transform = `scaleX(${progressPercent / 100})`;
}

/** Đổ dải mới (chuỗi HTML đã dựng sẵn) — xoá kết quả/hiệu ứng sai của dải trước. Ô mới tự chạy animation vào (CSS). */
function paintArrowStrip(stripEl, html) {
    stripEl.removeAttribute('data-result');
    stripEl.classList.remove('is-wrong');
    stripEl.innerHTML = html;
}

/** Trạng thái từng ô theo số mũi tên đã nhập đúng: trước `inputIndex` = 'done' (xanh lá), đúng `inputIndex` = 'current'
 * (vòng sáng chờ nhập), sau = 'pending'. */
function paintArrowStripProgress(stripEl, inputIndex) {
    const cells = stripEl.children;
    for (let i = 0; i < cells.length; i++) {
        cells[i].dataset.state = i < inputIndex ? 'done' : (i === inputIndex ? 'current' : 'pending');
    }
}

/** Rung dải khi nhập sai — chạy lại animation bằng remove + reflow + add (cùng khuôn showGameplayCountdown()). */
function flashArrowStripWrong(stripEl) {
    stripEl.classList.remove('is-wrong');
    void stripEl.offsetWidth; // ép reflow để animation chạy lại từ đầu
    stripEl.classList.add('is-wrong');
}

/** Đánh dấu kết quả vòng (tier name) lên dải — CSS: 'miss' tối + đỏ, tier khác bừng sáng. */
function paintArrowStripResult(stripEl, tierName) {
    stripEl.dataset.result = tierName;
}

/** Nút Enter sáng lên khi đã nhập đủ dải (chờ commit đúng vạch). */
function paintArrowCommitReady(commitBtnEl, ready) {
    commitBtnEl.classList.toggle('is-ready', ready);
}

/** Level + hệ số tốc độ ở HUD. */
function paintArrowHud(levelEl, speedEl, level, speedMultiplier) {
    levelEl.textContent = String(level);
    speedEl.textContent = `×${speedMultiplier.toFixed(2)}`;
}
