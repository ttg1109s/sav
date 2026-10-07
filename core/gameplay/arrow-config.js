/**
 * core/gameplay/arrow-config.js — MỚI (07/10/2026, Giang yêu cầu game mới "Arrow"). Hằng số TĨNH thuần (CHỈ dữ liệu,
 * không logic — cùng bản chất core/gameplay/catalog.js) cho mode "Arrow": dải vòng tròn chứa mũi tên 8 hướng, thanh
 * tiến trình có vạch đích 80%, bàn phím tròn 8 hướng + nút Enter commit.
 *
 * Mọi hàm Core (core/gameplay/arrow-mode.js) nhận object này qua THAM SỐ (giống GAMEPLAY_CIRCLE_CONFIG,
 * service/state/gameplay-runtime.js) — không đọc trực tiếp. Chấm điểm/combo/sao/modal End DÙNG CHUNG engine
 * (core/gameplay/engine.js + event/workflow/gameplay-engine.js) — nên config có ĐỦ các field engine đọc:
 * `comboTierNames`, `comboMultiplierConfig`, `comboPopupScalePerStreak/Max`, `starMax`, `starRoundingThreshold`
 * (giá trị y hệt Circle — 1 bảng điểm/combo cho mọi game).
 *
 * Hướng (`dir`) là số nguyên 0..7 theo chiều kim đồng hồ, 0 = lên: 0 ↑, 1 ↗, 2 →, 3 ↘, 4 ↓, 5 ↙, 6 ←, 7 ↖. Hướng
 * ngược = (dir + 4) % 8 (core/gameplay/arrow-mode.js::buildArrowRoundArrows()).
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
    // màn chạm). Chưa có BPM (Photo, đầu bài) -> fallbackPeriodMs. Sau đó CHIA hệ số tăng tốc (mỗi lần hết dải level
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
