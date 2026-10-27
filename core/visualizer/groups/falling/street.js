/**
 * core/visualizer/groups/falling/street.js — Falling style 'street': phố & công viên về đêm (đèn đường, hàng rào, tuyết).
 *
 * Ánh sáng đèn: quầng tròn quanh bóng đèn + vũng sáng trên mặt đường ướt + vệt phản chiếu dọc (KHÔNG còn nón sáng —
 * Giang bỏ 22/10/2026); giọt nào nằm trong vùng sáng tròn của đèn được vẽ lại sáng theo màu đèn, nhạt dần theo khoảng cách.
 *
 * Vật lý bông tuyết (đơn vị px/frame ở 60 fps, × dpr; 1 m/s ≈ STREET_PX_PER_MPS px/frame):
 *   - Tốc độ rơi cuối v_t = a·D^b·e^(c·D) theo đường kính D (mm):
 *     tuyết — Locatelli & Hobbs 1974, bông kết tinh nhánh (0.8·D^0.16 ≈ 0.8–1.1 m/s).
 *   - Lực cản kéo vận tốc hạt về vận tốc gió với thời gian hồi τ = v_t / g (hạt bám gió theo quán tính).
 *   - Gió theo độ cao: luật lũy thừa u(z) = u_ref·(z/z_ref)^α, đô thị α ≈ 0.4 — trên cao gió mạnh, sát đất yếu dần nên
 *     bông tuyết trôi chéo rồi dựng dần lên; cộng rối (trường sin trôi theo thời gian) -> quỹ đạo cong mềm.
 *   - Quỹ đạo tuyết được tính từ vận tốc rơi, lực cản và gió theo độ cao; hạt không có vệt mưa.
 * Street Light chỉ dùng Snow; không còn kiểu mưa hoặc tia nước.
 * Âm thanh điều khiển: mật độ D_cuối = D_custom × (1 − Energy%/100) (sàn 10% — nhạc càng mạnh tuyết càng thưa); mỗi đèn theo
 * 1 dải tần (STREET_LAMP_BANDS) — sáng theo mức dải, loé + gợn nước khi dải có nốt mới, rung theo vibrato; vùng sáng thở
 * theo năng lượng; gió nghiêng theo hướng giai điệu, giật khi chuyển đoạn (tắt được —
 * streetWindEnabled); chớp trời khi chuyển đoạn trùng cú sub mạnh, có hồi chiêu.
 * Màu/nền do Workflow (event/workflow/visualizer/falling.js) resolve. Ghi state qua `appState.mutate(...)`.
 *
 * NẠP SAU: core/visualizer/groups/falling/common.js.
 */

// =================================== Kiểu 'street' — phố đêm ===================================

/** Vẽ nền gradient mặt đường từ các color-stop đã được Workflow resolve. */
function paintFallingGroundGradient(ctx, canvasWidth, canvasHeight, groundY, stopColors) {
    const gradient = ctx.createLinearGradient(0, groundY, 0, canvasHeight);
    stopColors.forEach((stop) => gradient.addColorStop(stop.offset, stop.color));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, groundY, canvasWidth, canvasHeight - groundY);
}

/** Hàng rào sắt công viên (cọc + 2 thanh ngang) dọc mép đất — tĩnh, màu tối, không cướp chú ý khỏi đèn/tuyết. */
function paintParkFence(ctx, canvasWidth, groundY, dpr) {
    const postSpacing = 26 * dpr;
    const postH = 34 * dpr;
    const postW = 2 * dpr;
    const fenceColor = '#0a0c11';
    const railTopY = groundY - postH * 0.78;
    const railBottomY = groundY - postH * 0.22;

    ctx.fillStyle = fenceColor;
    ctx.fillRect(0, railTopY - dpr, canvasWidth, 2 * dpr);
    ctx.fillRect(0, railBottomY - dpr, canvasWidth, 2 * dpr);

    for (let x = postSpacing * 0.5; x < canvasWidth; x += postSpacing) {
        ctx.fillRect(x - postW / 2, groundY - postH, postW, postH);
        ctx.beginPath();
        ctx.moveTo(x - postW * 1.3, groundY - postH);
        ctx.lineTo(x, groundY - postH - postW * 2.4);
        ctx.lineTo(x + postW * 1.3, groundY - postH);
        ctx.closePath();
        ctx.fill();
    }
}

// ----------------------------------- Hằng số vật lý / hình ảnh -----------------------------------

const STREET_PX_PER_MPS = 2.2;
const STREET_FPS = 60;
const STREET_GRAVITY = 9.81;
/** wind.value = 1 ứng với gió 10 m/s. */
const STREET_WIND_MPS = 10;
const STREET_WIND_SHEAR_ALPHA = 0.4;
/** Sát đất vẫn còn 15% gió (thay vì về 0 tuyệt đối). */
const STREET_WIND_SHEAR_FLOOR = 0.15;
/** Biên độ rối so với gió nền. */
const STREET_WIND_TURBULENCE = 0.45;
/** Mật độ tối thiểu khi nhạc rất mạnh. */
const STREET_SNOW_MIN_DENSITY_RATIO = 0.1;
const STREET_SNOW_COLOR = 'rgb(236, 242, 250)';

/** Gió tắt (streetWindEnabled = false): tuyết rơi thẳng, không giật. */
const STREET_WIND_CALM = Object.freeze({ base: 0, gust: 0, value: 0 });

/** Thông số từng kiểu: số hạt = mật độ × countMult; đường kính (mm) rải lệch về cỡ nhỏ theo sizeSkew (D = min + Δ·r^skew);
 * hệ số v_t = fallA·D^fallB·e^(fallC·D); đung đưa (m/s); thời gian phơi vệt (frame) + độ dài vệt tối đa (px CSS); bán kính bông
 * tuyết (px CSS mỗi mm). */
const STREET_SNOW_SPEC = Object.freeze({
    countMult: 3, diameterMinMm: 1.0, diameterMaxMm: 8.0, sizeSkew: 2.5, fallA: 0.8, fallB: 0.16, fallC: 0,
    flutterMps: 0.35, flakePxPerMm: 0.18,
});

/** Lớp theo độ sâu `z` (0 xa – 1 gần): nét mảnh/mờ ở xa, dày/rõ ở gần. */
const STREET_SNOW_LAYERS = [
    { zMin: 0, zMax: 0.34, alpha: 0.45 },
    { zMin: 0.34, zMax: 0.67, alpha: 0.65 },
    { zMin: 0.67, zMax: 1.01, alpha: 0.85 },
];

/** Dải tần của từng đèn theo thứ tự `streetLamps` (đèn chính = bass, 2 đèn phụ = lowMid/mid, đèn tuỳ chỉnh xoay vòng). */
const STREET_LAMP_BANDS = ['bass', 'lowMid', 'mid', 'highMid', 'treble', 'sub'];
/** Chớp trời: hồi chiêu giữa 2 lần, cửa sổ "vừa có cú sub", cửa sổ beat dò chuyển đoạn (như Vortex). */
const STREET_THUNDER_COOLDOWN_MS = 4000;
const STREET_THUNDER_SUB_WINDOW_MS = 200;
const STREET_THUNDER_SECTION_BEATS = 12;
const STREET_THUNDER_FLUX_THRESHOLD = 0.5;

/** Tên dải tần cho `lampCount` đèn. @returns {string[]} */
function resolveStreetLampBands(lampCount) {
    return Array.from({ length: lampCount }, (_, i) => STREET_LAMP_BANDS[i % STREET_LAMP_BANDS.length]);
}

/** Tạo gợn sáng tại chân đèn khi dải âm thanh có onset. */
function spawnRainRipple(x, groundY, canvasHeight, dpr, color, glowColor) {
    const ripples = appState.get('ripples') || [];
    ripples.push({
        x, y: groundY, radius: 2 * dpr,
        maxRadius: Math.min(canvasHeight * 0.12, 110 * dpr),
        alpha: 0.7, color: color || '#dce8ff',
        glowColor: glowColor || color || '#dce8ff',
        lineWidth: 1.5 * dpr,
    });
    if (ripples.length > 80) ripples.splice(0, ripples.length - 80);
    appState.set('ripples', ripples, { skipCheck: true });
}

/** Tiến hoá gợn sáng; chỉ giữ các gợn còn nhìn thấy. */
function advanceRainRipples() {
    appState.mutate('ripples', (ripples) => {
        for (const ripple of ripples) {
            ripple.radius += Math.max(0.7, ripple.lineWidth * 0.55);
            ripple.alpha *= 0.965;
        }
        return ripples.filter((ripple) => ripple.alpha > 0.035 && ripple.radius < ripple.maxRadius);
    }, { skipCheck: true });
}

/** Vẽ gợn sáng elip trên mặt đường, màu theo đèn phát onset. */
function paintRainRipples(ctx, ripples, dpr) {
    if (!Array.isArray(ripples) || ripples.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const ripple of ripples) {
        const progress = Math.max(0, Math.min(1, ripple.radius / ripple.maxRadius));
        ctx.globalAlpha = ripple.alpha * (1 - progress);
        ctx.strokeStyle = ripple.color;
        ctx.lineWidth = Math.max(0.6 * dpr, ripple.lineWidth * (1 - progress * 0.45));
        ctx.beginPath();
        ctx.ellipse(ripple.x, ripple.y, ripple.radius, Math.max(0.6 * dpr, ripple.radius * 0.16), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = ripple.alpha * 0.2 * (1 - progress);
        ctx.strokeStyle = ripple.glowColor;
        ctx.lineWidth = Math.max(1 * dpr, ripple.lineWidth * 2);
        ctx.beginPath();
        ctx.ellipse(ripple.x, ripple.y, ripple.radius * 1.08, Math.max(0.8 * dpr, ripple.radius * 0.19), 0, 0, Math.PI * 2);
        ctx.stroke();
    }
    ctx.restore();
}

/**
 * Cập nhật nhịp sáng từng đèn và dựng thông số hình học cho frame hiện tại.
 * bandLevels là mức dải âm thanh; onsetTimes là timestamp của onset theo performance.now().
 */
function advanceRainLampsAndBuildSpecs(streetLamps, isPlaying, bandLevels, onsetTimes, vibrato, nowMs, dpr) {
    const specs = [];
    const shimmer = isPlaying && vibrato.active ? Math.sin((nowMs / 1000) * Math.PI * 2 * vibrato.rateHz) * 0.08 : 0;
    appState.mutate('streetLamps', (arr) => arr.forEach((lamp, lampIdx) => {
        const level = isPlaying ? bandLevels[lampIdx] || 0 : 0;
        const onset = isPlaying && onsetTimes[lampIdx] > (lamp.lastOnsetMs || 0);
        lamp.lastOnsetMs = onsetTimes[lampIdx];
        const flickerTarget = 0.6 + level * (1 - lamp.depth * 0.6) * 1.2 + shimmer;
        const eased = lamp.flicker + (flickerTarget - lamp.flicker) * 0.3;
        lamp.flicker = onset ? Math.max(eased, flickerTarget + 0.4) : eased;
        const glow = Math.max(0.12, Math.min(1.5, lamp.flicker));
        const postTopY = lamp.baseY - lamp.height;
        const postW = (lamp.main ? 5 : 3.5) * dpr;
        const capW = postW * 3.2;
        const flareScale = lamp.flareScale || 1;
        const haloR = (lamp.main ? 150 : 95) * dpr * (1 - lamp.depth * 0.3) * (0.7 + glow * 0.55) * flareScale;
        specs.push({
            colorArgs: [lampIdx, streetLamps.length, Math.round(glow * 255)],
            x: lamp.x, main: lamp.main, depth: lamp.depth, height: lamp.height,
            postTopY, postW, capW, haloR, glow, onset,
            postColor: lamp.depth > 0 ? `rgba(15,18,24,${0.9 - lamp.depth * 0.3})` : '#15181f',
        });
    }), { skipCheck: true });
    return specs;
}

/** Vẽ cột, tay đèn, chụp và bóng đèn; quầng/mặt đường được vẽ riêng trong workflow. */
function paintRainLamp(ctx, spec, lampFill, dpr) {
    ctx.fillStyle = spec.postColor;
    ctx.fillRect(spec.x - spec.postW / 2, spec.postTopY, spec.postW, spec.height);

    ctx.beginPath();
    ctx.moveTo(spec.x - spec.capW / 2, spec.postTopY);
    ctx.lineTo(spec.x + spec.capW / 2, spec.postTopY);
    ctx.lineTo(spec.x + spec.capW * 0.32, spec.postTopY - spec.capW * 0.5);
    ctx.lineTo(spec.x - spec.capW * 0.32, spec.postTopY - spec.capW * 0.5);
    ctx.closePath();
    ctx.fillStyle = '#0c0e12';
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const lampGlow = ctx.createRadialGradient(spec.x, spec.postTopY + 6 * dpr, 1, spec.x, spec.postTopY + 6 * dpr, spec.haloR);
    ctx.globalAlpha = 0.6 * spec.glow * (1 - spec.depth * 0.4);
    lampGlow.addColorStop(0, lampFill);
    lampGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = lampGlow;
    ctx.beginPath();
    ctx.arc(spec.x, spec.postTopY + 6 * dpr, spec.haloR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = Math.min(1, spec.glow);
    ctx.fillStyle = lampFill;
    ctx.beginPath();
    ctx.arc(spec.x, spec.postTopY + 6 * dpr, (spec.main ? 5 : 3.5) * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.restore();
}

/** Gió chung (wind.value, 1 ≈ 10 m/s): nền lắc chậm + nghiêng theo hướng giai điệu (-1/0/1, bám chậm); cơn giật khi nhạc
 * chuyển đoạn (`gustKick`) tắt dần. @param {{base:number, gust:number}|null} wind @returns {{base, gust, value}} */
function stepStreetWind(wind, melodyDirection, gustKick, frameIndex) {
    const prev = wind || { base: 0.12, gust: 0 };
    const target = 0.12 + 0.05 * Math.sin(frameIndex / 420) + 0.1 * melodyDirection;
    const base = prev.base + (target - prev.base) * 0.01;
    const gust = prev.gust * 0.97 + (gustKick ? 0.3 * (melodyDirection || 1) : 0);
    return { base, gust, value: Math.max(-0.5, Math.min(0.6, base + gust)) };
}

/** Có bắt đầu chớp trời không: bật, nhạc vừa chuyển đoạn, sub vừa có nốt mới đủ mạnh (`threshold` = mức dải sub), đã qua
 * hồi chiêu kể từ lần trước (`lastAtMs`). */
function shouldStartStreetThunder(enabled, isTransition, subOnsetAgeMs, subLevel, threshold, nowMs, lastAtMs) {
    return enabled !== false && isTransition && subOnsetAgeMs <= STREET_THUNDER_SUB_WINDOW_MS
        && subLevel >= threshold && nowMs - lastAtMs >= STREET_THUNDER_COOLDOWN_MS;
}

/** Độ đục chớp trời theo thời gian từ lúc đánh (`startAtMs`): loé — tối — loé lần 2 — tắt dần, kẹp `maxOpacity`. */
function computeStreetThunderAlpha(nowMs, startAtMs, maxOpacity) {
    const t = nowMs - startAtMs;
    const cap = Number.isFinite(maxOpacity) ? Math.max(0, Math.min(maxOpacity, SCREEN_FLASH_MAX_ALPHA)) : SCREEN_FLASH_MAX_ALPHA;
    const env = t < 0 ? 0 : t < 70 ? 1 : t < 150 ? 0.15 : t < 240 ? 0.75 : 0.75 * Math.exp(-(t - 240) / 350);
    return cap * env;
}

// ----------------------------------- Tuyết: dựng, mật độ, vật lý -----------------------------------

/** Bể hạt tuyết (`spec` = STREET_SNOW_SPEC): rải ngẫu nhiên, mỗi hạt 1 đường kính -> v_t, τ = v_t/g, độ sâu `z`,
 * bán kính bông `size`; advanceStreetSnowflakes() tính vị trí và vận tốc mỗi frame. */
function buildStreetSnowPool(density, canvasWidth, canvasHeight, dpr, spec) {
    return Array.from({ length: Math.round(density * spec.countMult) }, () => {
        const diameterMm = spec.diameterMinMm + Math.pow(Math.random(), spec.sizeSkew) * (spec.diameterMaxMm - spec.diameterMinMm);
        const vtMps = spec.fallA * Math.pow(diameterMm, spec.fallB) * Math.exp(spec.fallC * diameterMm);
        const vt = vtMps * STREET_PX_PER_MPS * dpr;
        const x = Math.random() * canvasWidth;
        const y = Math.random() * canvasHeight;
        return {
            x, y, vx: 0, vy: vt, z: Math.random(), vt,
            tau: Math.max(1, (vtMps / STREET_GRAVITY) * STREET_FPS),
            flutter: spec.flutterMps * STREET_PX_PER_MPS * dpr,
            size: diameterMm * spec.flakePxPerMm * dpr,
            phase: Math.random() * Math.PI * 2, parked: false,
        };
    });
}

/** EMA của Energy % (0-100) — mật độ không giật theo từng frame. */
function smoothStreetSnowEnergy(prevEnergyPercent, energyPercent) {
    return prevEnergyPercent + (energyPercent - prevEnergyPercent) * 0.04;
}

/** Mật độ cuối: tỉ lệ = 1 − Energy%/100 (sàn STREET_SNOW_MIN_DENSITY_RATIO; dừng phát = đủ mật độ), số hạt đang rơi =
 * bể × tỉ lệ. @returns {{ratio:number, activeCount:number}} */
function computeStreetSnowDensity(poolSize, isPlaying, energyPercent) {
    const ratio = isPlaying ? Math.max(STREET_SNOW_MIN_DENSITY_RATIO, 1 - energyPercent / 100) : 1;
    return { ratio, activeCount: Math.round(poolSize * ratio) };
}

/** Tiến mọi hạt 1 frame. Hạt thứ i >= `activeCount` vẫn rơi nốt rồi "đỗ" trên đỉnh (không biến mất giữa trời); hạt đang
 * đỗ mà i < activeCount thì rơi tiếp — mật độ đổi mượt. Gió tại hạt = wind × hồ sơ độ cao × (1 + rối) + rung phùn; vận tốc
 * hồi về gió theo τ; quấn ngang khi trôi ra mép; chạm đất (y chạm = groundY + phần mặt đường theo z) -> về đỉnh.
 */
function advanceStreetSnowflakes(canvasWidth, canvasHeight, groundY, dpr, activeCount, wind, nowMs) {
    const roadH = canvasHeight - groundY;
    const windPx = wind * STREET_WIND_MPS * STREET_PX_PER_MPS * dpr;
    const margin = 60 * dpr;
    const span = canvasWidth + margin * 2;
    const kx = (Math.PI * 2) / (canvasWidth * 0.55);
    const ky = (Math.PI * 2) / (canvasHeight * 0.4);
    const t = nowMs / 1000;
    appState.mutate('streetRain', (arr) => {
        for (let i = 0; i < arr.length; i++) {
            const d = arr[i];
            if (d.parked && i >= activeCount) continue;
            d.parked = false;
            const hitY = groundY + roadH * d.z * 0.85;
            const persp = 0.55 + d.z * 0.6;
            const heightRatio = Math.min(1, Math.max(0, (hitY - d.y) / hitY));
            const shear = STREET_WIND_SHEAR_FLOOR + (1 - STREET_WIND_SHEAR_FLOOR) * Math.pow(heightRatio, STREET_WIND_SHEAR_ALPHA);
            const eddy = Math.sin(d.x * kx + d.y * ky * 0.6 + t * 1.1);
            const flutterX = d.flutter * Math.sin(d.y * ky - d.x * kx * 0.7 - t * 0.8 + d.phase);
            const targetVx = windPx * shear * (1 + STREET_WIND_TURBULENCE * eddy) + flutterX;
            const targetVy = d.vt + d.flutter * 0.5 * Math.sin(d.phase + t * 2.3);
            d.vx += (targetVx - d.vx) / d.tau;
            d.vy += (targetVy - d.vy) / d.tau;
            d.x = ((d.x + d.vx * persp + margin) % span + span) % span - margin;
            d.y += d.vy * persp;

            if (d.y >= hitY) {
                d.y = -Math.random() * canvasHeight * 0.3 - 10 * dpr;
                d.x = Math.random() * span - margin;
                d.vx = targetVx; d.vy = d.vt;
                d.parked = i >= activeCount;
            }

        }
    }, { skipCheck: true });
}

// ----------------------------------- Tuyết: vẽ -----------------------------------

/** Tuyết, 1 lớp độ sâu: mỗi bông = chấm tròn (bán kính = cỡ bông × độ gần) + 2 viền mờ (×1.3, ×1.7) nhạt dần cho mép mềm. */
function paintStreetSnowLayer(ctx, drops, layer, dpr) {
    const outer = new Path2D();
    const inner = new Path2D();
    const cores = new Path2D();
    for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        if (d.parked || d.z < layer.zMin || d.z >= layer.zMax) continue;
        const r = Math.max(0.6 * dpr, d.size * (0.45 + 0.75 * d.z));
        outer.moveTo(d.x + r * 1.7, d.y);
        outer.arc(d.x, d.y, r * 1.7, 0, Math.PI * 2);
        inner.moveTo(d.x + r * 1.3, d.y);
        inner.arc(d.x, d.y, r * 1.3, 0, Math.PI * 2);
        cores.moveTo(d.x + r, d.y);
        cores.arc(d.x, d.y, r, 0, Math.PI * 2);
    }
    ctx.save();
    ctx.fillStyle = STREET_SNOW_COLOR;
    ctx.globalAlpha = layer.alpha * 0.08;
    ctx.fill(outer);
    ctx.globalAlpha = layer.alpha * 0.16;
    ctx.fill(inner);
    ctx.globalAlpha = layer.alpha;
    ctx.fill(cores);
    ctx.restore();
}

/** Vùng sáng tròn của 1 đèn (thay nón sáng cũ): tâm bóng đèn, bán kính thở theo năng lượng cả bài; phía trên chụp đèn
 * (capY) không được chiếu. */
function computeStreetLampLight(spec, groundY, dpr, smoothedEnergy) {
    return {
        x: spec.x, bulbY: spec.postTopY + 6 * dpr, capY: spec.postTopY - spec.capW * 0.5, groundY,
        litR: spec.haloR * 1.3 * (0.85 + 0.3 * smoothedEnergy),
        glow: spec.glow, depth: spec.depth, haloR: spec.haloR, capW: spec.capW,
    };
}

/** Mưa thường lọt vùng sáng: vẽ lại cộng sáng màu đèn, nhạt dần theo khoảng cách tới bóng đèn. */
/** Tuyết lọt vùng sáng: tô lại bông cộng sáng màu đèn, nhạt dần theo khoảng cách + vài bông loé lấp lánh ở tâm (pha riêng
 * từng bông theo thời gian). */
function paintStreetSnowLit(ctx, drops, light, lampFill, dpr, nowMs) {
    const r2 = light.litR * light.litR;
    const flakes = new Path2D();
    const sparkles = new Path2D();
    for (let i = 0; i < drops.length; i++) {
        const d = drops[i];
        const dx = d.x - light.x, dy = d.y - light.bulbY;
        if (d.parked || d.y < light.capY || dx * dx + dy * dy > r2) continue;
        const r = Math.max(0.6 * dpr, d.size * (0.45 + 0.75 * d.z));
        flakes.moveTo(d.x + r * 1.3, d.y);
        flakes.arc(d.x, d.y, r * 1.3, 0, Math.PI * 2);
        if (Math.sin(d.phase * 7 + nowMs * 0.004) <= 0.85) continue;
        sparkles.moveTo(d.x + r * 0.6, d.y);
        sparkles.arc(d.x, d.y, r * 0.6, 0, Math.PI * 2);
    }
    const grad = ctx.createRadialGradient(light.x, light.bulbY, 0, light.x, light.bulbY, light.litR);
    grad.addColorStop(0, lampFill);
    grad.addColorStop(1, 'transparent');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.globalAlpha = Math.min(1, light.glow * (1 - light.depth * 0.4));
    ctx.fill(flakes);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.9;
    ctx.fill(sparkles);
    ctx.restore();
}

/** Tuyết: quầng tán xạ tròn quanh đèn (ánh sáng toả trong màn tuyết), đậm theo mật độ. */
function paintStreetSnowLampHaze(ctx, light, lampFill, densityRatio) {
    const r = light.litR * 1.15;
    const grad = ctx.createRadialGradient(light.x, light.bulbY, 0, light.x, light.bulbY, r);
    grad.addColorStop(0, lampFill);
    grad.addColorStop(1, 'transparent');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, 0.22 * light.glow * densityRatio * (1 - light.depth * 0.4));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(light.x, light.bulbY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/** Tuyết: màn tuyết mờ dày dần về phía mặt đất (tầm nhìn giảm), đậm theo mật độ. */
function paintStreetSnowMist(ctx, canvasWidth, canvasHeight, groundY, densityRatio) {
    const a = 0.1 * densityRatio;
    const grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
    grad.addColorStop(0, 'rgba(195, 205, 222, 0)');
    grad.addColorStop(Math.min(1, (groundY * 0.5) / canvasHeight), `rgba(195, 205, 222, ${a * 0.4})`);
    grad.addColorStop(Math.min(1, groundY / canvasHeight), `rgba(195, 205, 222, ${a})`);
    grad.addColorStop(1, `rgba(195, 205, 222, ${a * 0.5})`);
    ctx.save();
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.restore();
}

/** Mặt đường ướt dưới đèn: vũng sáng elip + vệt phản chiếu dọc thon dần kéo xuống phía người xem. */
function paintStreetLampPool(ctx, light, lampFill, canvasHeight, dpr) {
    const fade = 1 - light.depth * 0.5;
    const roadH = canvasHeight - light.groundY;
    const poolRx = light.haloR * 1.5;
    const poolRy = Math.max(4 * dpr, roadH * 0.18);
    const reflRx = light.capW * 0.7;
    const reflRy = Math.max(4 * dpr, Math.min(roadH, (light.groundY - light.bulbY) * 0.7));
    ctx.save();
    ctx.beginPath();
    ctx.rect(light.x - poolRx, light.groundY, poolRx * 2, roadH); // chỉ trên mặt đường
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    [[poolRx, poolRy, light.groundY + poolRy * 0.4, 0.32], [reflRx, reflRy, light.groundY, 0.55]].forEach(([rx, ry, cy, a]) => {
        ctx.save();
        ctx.translate(light.x, cy);
        ctx.scale(1, ry / rx);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, lampFill);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha = Math.min(1, a * light.glow * fade);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
    ctx.restore();
}

