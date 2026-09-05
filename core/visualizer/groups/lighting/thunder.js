/**
 * core/visualizer/groups/lighting/thunder.js — [LÀM PHẲNG, 05/09/2026, yêu cầu Giang] Style
 * 'thunder' (tia sét) tách riêng khỏi `core/visualizer/types/lighting.js` cũ (trước đây gộp chung
 * với 'fireworks'). Nội dung hàm GIỮ NGUYÊN 100%. Port thuần từ `drawLightning()` cũ (đã xoá, vi
 * phạm Rule 2).
 *
 * THUẦN, không side-effect, không đọc appState/getActiveEffectConfig (rà soát Rule 3) — Workflow
 * (`_tickLightingThunder()`, event/workflow/visualizer-render.js) tự gom state rồi gọi RIÊNG LẺ
 * từng hàm dưới đây, tự resolve màu qua `getComputedColor()` TRƯỚC khi gọi `createLightningBolt()`.
 * `drawLightingFlash()` (chớp màn hình, dùng chung với style 'fireworks') nằm ở
 * `core/visualizer/groups/lighting/common.js`.
 *
 * NẠP SAU: core/visualizer/groups/lighting/common.js.
 */

// ================================= Style "thunder" (tia sét) =================================

/** Năng lượng tức thời dùng cho ngưỡng chớp/bolt — dải tần thứ 5, nhân smoothedEnergy để mượt. */
function computeLightningEnergySpike(smoothedEnergy, vizDataArray) {
    return smoothedEnergy * ((vizDataArray[5] || 0) / 255);
}

function computeLightningFlashAlpha(isPlaying, energySpike, flashThreshold) {
    return isPlaying && energySpike > flashThreshold ? (energySpike - flashThreshold) * 2.5 : 0;
}

function shouldSpawnLightningBolt(isPlaying, energySpike, boltThreshold, boltSpawnChance, activeBoltCount, maxBoltCount) {
    return isPlaying && energySpike > boltThreshold && Math.random() < boltSpawnChance && activeBoltCount < maxBoltCount;
}

/** Tạo 1 tia sét mới — zig-zag từ trên xuống đáy màn hình. `color` do Workflow tự resolve SẴN
 * (gọi getComputedColor() TRƯỚC khi gọi hàm này) — hàm này không tự gọi getComputedColor. */
function createLightningBolt(canvasWidth, canvasHeight, dpr, horizontalDeviation, segmentLength, color) {
    const startX = (Math.random() * 0.8 + 0.1) * canvasWidth;
    const bolt = { life: 1.0, color, segments: [] };
    let cx = startX, cy = 0;
    while (cy < canvasHeight) {
        const nx = cx + (Math.random() - 0.5) * horizontalDeviation * dpr;
        const ny = cy + (Math.random() * segmentLength + 20) * dpr;
        bolt.segments.push({ x1: cx, y1: cy, x2: nx, y2: ny });
        cx = nx; cy = ny;
    }
    return bolt;
}

/** Giảm tuổi thọ 1 tia sét — sửa trực tiếp lên object nhận vào. @returns {boolean} còn sống? */
function advanceLightningBolt(bolt, boltFadeSpeed, smoothedEnergy) {
    bolt.life -= boltFadeSpeed + (1 - Math.min(1, smoothedEnergy)) * 0.06;
    return bolt.life > 0;
}

function drawLightningBolt(ctx, bolt, dpr, blurMult) {
    ctx.beginPath();
    bolt.segments.forEach((seg) => { ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); });
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3 * dpr * bolt.life;
    if (blurMult > 0) { ctx.shadowBlur = 20 * dpr * blurMult; ctx.shadowColor = bolt.color.glow; }
    ctx.stroke();
    ctx.strokeStyle = bolt.color.fill;
    ctx.lineWidth = 8 * dpr * bolt.life;
    ctx.globalAlpha = bolt.life * 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur = 0;
}
