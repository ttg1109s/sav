/**
 * core/subtitle/subtitle-karaoke-display.js — Core THUẦN hiển thị karaoke trên phụ đề Visualizer (Song mode).
 * Chỉ tính toán/dữ liệu: không DOM, không appState, không hàm nào gọi hàm khác (Rule 3). Workflow điều phối:
 * event/workflow/subtitle-display.js. Phần DOM: core/subtitle/subtitle-karaoke-display-ui.js.
 *
 * 4 kiểu (Giang chốt, chọn 1): 'k' tô cả từ khi tới lượt · 'kf' quét trái->phải trong từ · 'vanish' hát xong
 * thì từ tan ngay · 'reveal' từ kế tiếp hiện sớm hơn lúc hát một chút. Mọi trạng thái (tô, ẩn/hiện) là hàm
 * của thời gian media — pause/seek/tua lùi/đổi tốc độ luôn đúng; hạt bụi/khói chỉ là trang trí phát sinh khi
 * phát tới bình thường (bỏ qua khi nhảy thời gian).
 */

const KARAOKE_REVEAL_LEAD_SEC = 0.4; // 'reveal': từ hiện sớm hơn lúc bắt đầu hát bao nhiêu giây
const KARAOKE_REVEAL_MS = 400; // thời lượng hiệu ứng hiện (fade / hạt tụ lại) — khớp lead để hiện xong đúng lúc hát
const KARAOKE_VANISH_MS = 800; // thời lượng hiệu ứng tan (fade / hạt bay đi)
const KARAOKE_MAX_PARTICLES = 1500; // trần tổng số hạt trên màn hình (điện thoại)
const KARAOKE_TIME_JUMP_BACK_SEC = 0.05; // lùi quá ngưỡng = seek/tua lùi
const KARAOKE_TIME_JUMP_FORWARD_SEC = 0.5; // tiến quá ngưỡng trong 1 khung hình = seek

/** Bảng hành vi từng kiểu theo pha của từ ('before'|'lead'|'active'|'after'):
 * fill = phần đã tô (0..1) cố định theo pha; sweep = hệ số nhân tiến trình trong từ (chỉ 'kf' pha active);
 * opacity = từ hiện (1) hay ẩn (0). */
const KARAOKE_MODE_TABLE = {
    k: {
        fill: { before: 0, lead: 0, active: 1, after: 1 },
        sweep: { before: 0, lead: 0, active: 0, after: 0 },
        opacity: { before: 1, lead: 1, active: 1, after: 1 },
    },
    kf: {
        fill: { before: 0, lead: 0, active: 0, after: 1 },
        sweep: { before: 0, lead: 0, active: 1, after: 0 },
        opacity: { before: 1, lead: 1, active: 1, after: 1 },
    },
    vanish: {
        fill: { before: 0, lead: 0, active: 1, after: 1 },
        sweep: { before: 0, lead: 0, active: 0, after: 0 },
        opacity: { before: 1, lead: 1, active: 1, after: 0 },
    },
    reveal: {
        fill: { before: 0, lead: 0, active: 1, after: 1 },
        sweep: { before: 0, lead: 0, active: 0, after: 0 },
        opacity: { before: 0, lead: 1, active: 1, after: 1 },
    },
};

/** Thông số hạt cho hiệu ứng tan/hiện. step = bước lấy mẫu điểm ảnh chữ (px); spriteCore = điểm dừng lõi đặc của
 * sprite (0 = mềm như khói). drift = quãng bay (px) từ vị trí chữ. */
const KARAOKE_PARTICLE_PRESETS = {
    dust: { step: 2, maxCount: 320, size: 2.2, grow: 0.6, alpha: 1, driftXMin: 25, driftXMax: 90, driftYMin: -70, driftYMax: 15, staggerMs: 250, spriteCore: 0.7 },
    smoke: { step: 4, maxCount: 110, size: 7, grow: 3.2, alpha: 0.5, driftXMin: -20, driftXMax: 30, driftYMin: -90, driftYMax: -35, staggerMs: 200, spriteCore: 0 },
};

/** Biên độ hiệu ứng từ đang hát (1 nhịp theo thời lượng từ). */
const KARAOKE_EFFECT_SWELL_SCALE = 0.25;
const KARAOKE_EFFECT_JUMP_EM = 0.35;
const KARAOKE_EFFECT_SQUASH_RATIO = 0.3;

/** Tách text dòng thành token giữ nguyên khoảng trắng/xuống dòng — các token 'word' khớp đúng thứ tự từ mà
 * isKaraokeMatchingText() (core/subtitle/subtitle-karaoke.js) kiểm tra. @param {string} text
 * @returns {Array<{kind: 'word'|'space'|'break', text: string}>} */
function tokenizeKaraokeSubtitleText(text) {
    return String(text || '').trim().split(/(\s+)/).filter((part) => part.length > 0).map((part) => {
        if (!/^\s+$/.test(part)) return { kind: 'word', text: part };
        return { kind: part.includes('\n') ? 'break' : 'space', text: part };
    });
}

/** Mốc tuyệt đối (giây) từng từ từ `[[từ, ms]]` + start dòng. @param {Array<Array>} karaokeArray
 * @param {number} lineStartSec @returns {Array<{startSec: number, endSec: number}>} */
function buildKaraokeWordTimeline(karaokeArray, lineStartSec) {
    let cumMs = 0;
    return karaokeArray.map(([, ms]) => {
        const startSec = lineStartSec + cumMs / 1000;
        cumMs += Number(ms) || 0;
        return { startSec, endSec: lineStartSec + cumMs / 1000 };
    });
}

/** Pha của 1 từ tại thời điểm `t`. @returns {'before'|'lead'|'active'|'after'} */
function resolveKaraokeWordPhase(t, startSec, endSec, leadSec) {
    if (t >= endSec) return 'after';
    if (t >= startSec) return 'active';
    if (t >= startSec - leadSec) return 'lead';
    return 'before';
}

/** Tiến trình trong từ (0..1). */
function computeKaraokeWordProgress(t, startSec, endSec) {
    const span = Math.max(0.001, endSec - startSec);
    return Math.max(0, Math.min(1, (t - startSec) / span));
}

/** Phần đã tô (0..1) theo hàng bảng kiểu + pha + tiến trình. @param {Object} modeRow KARAOKE_MODE_TABLE[mode] */
function computeKaraokeWordFill(modeRow, phase, progress) {
    return Math.min(1, modeRow.fill[phase] + modeRow.sweep[phase] * progress);
}

/** Thời gian media nhảy (seek/tua lùi/lần đầu) hay chạy liền mạch. @param {number|null} prevT @param {number} t */
function isKaraokeTimeJump(prevT, t) {
    if (prevT === null) return true;
    const dt = t - prevT;
    return dt < -KARAOKE_TIME_JUMP_BACK_SEC || dt > KARAOKE_TIME_JUMP_FORWARD_SEC;
}

/** Cách đổi độ hiện của 1 từ khi đổi pha: 'none' (không đổi) · 'snap' (đặt thẳng — lần đầu/nhảy thời gian) ·
 * 'in' (hiện có hiệu ứng) · 'out' (tan có hiệu ứng). */
function resolveKaraokeOpacityChange(prevOpacity, nextOpacity, isJump) {
    if (prevOpacity === nextOpacity) return 'none';
    if (isJump || prevOpacity === null) return 'snap';
    return nextOpacity > prevOpacity ? 'in' : 'out';
}

/** 1 nhịp lên-xuống theo tiến trình (0 -> đỉnh ở giữa -> 0). */
function computeKaraokePulse(progress) {
    return Math.sin(Math.PI * Math.max(0, Math.min(1, progress)));
}

/** transform 'phồng lên'. */
function computeKaraokeSwellTransform(pulse) {
    return `scale(${(1 + KARAOKE_EFFECT_SWELL_SCALE * pulse).toFixed(4)})`;
}

/** transform 'nảy lên' rồi về chỗ cũ. */
function computeKaraokeBounceUpTransform(pulse) {
    return `translateY(${(-KARAOKE_EFFECT_JUMP_EM * pulse).toFixed(4)}em)`;
}

/** transform 'rơi xuống' rồi về chỗ cũ. */
function computeKaraokeDropDownTransform(pulse) {
    return `translateY(${(KARAOKE_EFFECT_JUMP_EM * pulse).toFixed(4)}em)`;
}

/** transform 'co theo chiều dài' — `directionSign` -1 thu vào, +1 phóng ra. */
function computeKaraokeSquashXTransform(pulse, directionSign) {
    return `scaleX(${(1 + directionSign * KARAOKE_EFFECT_SQUASH_RATIO * pulse).toFixed(4)})`;
}

/** transform 'co theo chiều dọc' — `directionSign` -1 thu vào, +1 phóng ra. */
function computeKaraokeSquashYTransform(pulse, directionSign) {
    return `scaleY(${(1 + directionSign * KARAOKE_EFFECT_SQUASH_RATIO * pulse).toFixed(4)})`;
}

/** Ẩn/hiện các hàng phụ thuộc trong panel Karaoke (Settings). @param {Object} cfg vizConfig
 * @returns {{body: boolean, dissolve: boolean, squashDir: boolean, outlineParams: boolean, pointerShape: boolean}} */
function resolveKaraokeSettingsVisibility(cfg) {
    return {
        body: cfg.subtitleKaraokeEnabled !== false,
        dissolve: cfg.subtitleKaraokeMode === 'vanish' || cfg.subtitleKaraokeMode === 'reveal',
        squashDir: cfg.subtitleKaraokeActiveEffect === 'squashX' || cfg.subtitleKaraokeActiveEffect === 'squashY',
        outlineParams: !!cfg.subtitleKaraokeOutline,
        pointerShape: !!cfg.subtitleKaraokePointer,
    };
}

/** Dựng hạt từ các điểm ảnh của chữ. `reverse` = hiện (hạt từ xa tụ về chữ, sống đúng `lifeMs` để khớp lúc chữ
 * hiện); ngược lại = tan (hạt từ chữ bay đi, sống lệch ngẫu nhiên + so le khởi động).
 * @param {Array<{x: number, y: number}>} points toạ độ CSS px trong canvas hiệu ứng
 * @param {string} spriteKey khoá sprite (màu + độ mềm) @param {Object} preset KARAOKE_PARTICLE_PRESETS[...]
 * @param {boolean} reverse @param {number} nowMs @param {number} lifeMs @returns {Array<Object>} */
function buildKaraokeParticles(points, spriteKey, preset, reverse, nowMs, lifeMs) {
    const stride = Math.max(1, Math.ceil(points.length / preset.maxCount));
    const particles = [];
    for (let i = 0; i < points.length; i += stride) {
        const glyph = points[i];
        const far = {
            x: glyph.x + preset.driftXMin + Math.random() * (preset.driftXMax - preset.driftXMin),
            y: glyph.y + preset.driftYMin + Math.random() * (preset.driftYMax - preset.driftYMin),
        };
        const from = reverse ? far : glyph;
        const to = reverse ? glyph : far;
        particles.push({
            x0: from.x, y0: from.y, x1: to.x, y1: to.y,
            s0: reverse ? preset.size * preset.grow : preset.size,
            s1: reverse ? preset.size : preset.size * preset.grow,
            a0: reverse ? 0 : preset.alpha,
            a1: reverse ? preset.alpha : 0,
            t0: nowMs + (reverse ? 0 : Math.random() * preset.staggerMs),
            life: reverse ? lifeMs : lifeMs * (0.7 + Math.random() * 0.6),
            key: spriteKey,
        });
    }
    return particles;
}

/** Bỏ hạt đã hết đời + giữ trần KARAOKE_MAX_PARTICLES (bỏ hạt cũ nhất). @returns {Array<Object>} mảng MỚI */
function pruneKaraokeParticles(particles, nowMs) {
    const alive = particles.filter((p) => nowMs < p.t0 + p.life);
    return alive.length > KARAOKE_MAX_PARTICLES ? alive.slice(alive.length - KARAOKE_MAX_PARTICLES) : alive;
}
