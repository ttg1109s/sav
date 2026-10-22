/**
 * core/visualizer/groups/rain/street.js — Rain style 'street': phố & công viên về đêm (đèn đường, hàng rào, mưa).
 *
 * Ánh sáng đèn: mỗi đèn có nón sáng thể tích (computeStreetLampCone()) + vũng sáng trên mặt đường ướt + vệt phản chiếu
 * dọc; mưa chia 3 lớp xa/gần (STREET_RAIN_LAYERS) vẽ mờ, giọt nào lọt vào nón được vẽ lại sáng theo màu đèn
 * (paintStreetRainLit()); giọt chạm đất (cao độ theo lớp — gần thì chạm thấp hơn) bắn tia nước.
 * Âm thanh điều khiển (mỗi tín hiệu 1 vai): mật độ mưa NGHỊCH cường độ nhạc (tinh thần lõi — nhạc dịu thì mưa nặng hạt);
 * mỗi đèn theo 1 dải tần (STREET_LAMP_BANDS) — sáng theo mức dải, loé khi dải có nốt mới, rung nhẹ theo vibrato, gợn nước
 * dưới chân đèn đúng lúc đó; nón sáng thở theo năng lượng cả bài; snare (dải mid) bắn chùm tia nước; gió nghiêng theo
 * hướng giai điệu, giật 1 cơn khi nhạc chuyển đoạn; chớp trời chỉ khi chuyển đoạn trùng cú sub mạnh (drop), có hồi chiêu.
 * Màu/nền do Workflow (event/workflow/visualizer/rain.js) resolve. Ghi state qua `appState.mutate(...)` (Rule 2 chỉ cấm
 * đọc). Chớp màn hình dùng chung core/visualizer/draw/ + computeRainFlashEnergy() (rain/common.js).
 *
 * NẠP SAU: core/visualizer/groups/rain/common.js.
 */

// =================================== Kiểu 'street' — phố đêm ===================================

/** Hàng rào sắt công viên (cọc + 2 thanh ngang) dọc mép đất — tĩnh, màu tối, không cướp chú ý khỏi đèn/mưa. */
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

/** Cường độ mưa — tỉ lệ nghịch với năng lượng nhạc. */
function computeRainIntensity(isPlaying, smoothedEnergy) {
    return isPlaying ? (1 - smoothedEnergy * 0.75) : 1;
}

/** 3 lớp mưa theo độ sâu `drop.z` (0 xa – 1 gần): nét mảnh/mờ ở xa, dày/rõ ở gần. */
const STREET_RAIN_LAYERS = [
    { zMin: 0, zMax: 0.34, width: 0.7, alpha: 0.18 },
    { zMin: 0.34, zMax: 0.67, width: 1.1, alpha: 0.28 },
    { zMin: 0.67, zMax: 1.01, width: 1.6, alpha: 0.4 },
];
/** Số tia nước tối đa cùng lúc. */
const STREET_SPLASH_MAX = 120;

/** Dải tần của từng đèn theo thứ tự `streetLamps` (đèn chính = bass, 2 đèn phụ = lowMid/mid, đèn tuỳ chỉnh xoay vòng). */
const STREET_LAMP_BANDS = ['bass', 'lowMid', 'mid', 'highMid', 'treble', 'sub'];
/** Chớp trời: hồi chiêu giữa 2 lần, cửa sổ "vừa có cú sub", cửa sổ beat dò chuyển đoạn (như Vortex). */
const STREET_THUNDER_COOLDOWN_MS = 4000;
const STREET_THUNDER_SUB_WINDOW_MS = 200;
const STREET_THUNDER_SECTION_BEATS = 12;
const STREET_THUNDER_FLUX_THRESHOLD = 0.5;
/** Số tia nước của 1 chùm snare. */
const STREET_SNARE_SPLASHES = 8;

/** Tên dải tần cho `lampCount` đèn. @returns {string[]} */
function resolveStreetLampBands(lampCount) {
    return Array.from({ length: lampCount }, (_, i) => STREET_LAMP_BANDS[i % STREET_LAMP_BANDS.length]);
}

/** Gió chung (dx/dy của giọt): nền lắc chậm + nghiêng theo hướng giai điệu (-1/0/1, bám chậm); cơn giật khi nhạc chuyển
 * đoạn (`gustKick`) tắt dần. @param {{base:number, gust:number}|null} wind @returns {{base, gust, value}} */
function stepStreetWind(wind, melodyDirection, gustKick, frameIndex) {
    const prev = wind || { base: 0.12, gust: 0 };
    const target = 0.12 + 0.05 * Math.sin(frameIndex / 420) + 0.1 * melodyDirection;
    const base = prev.base + (target - prev.base) * 0.01;
    const gust = prev.gust * 0.97 + (gustKick ? 0.3 * (melodyDirection || 1) : 0);
    return { base, gust, value: Math.max(-0.5, Math.min(0.6, base + gust)) };
}

/** Chùm tia nước ngẫu nhiên trên mặt đường (cú snare) — cùng định dạng điểm chạm của advanceStreetRainDrops(). */
function buildStreetSplashBurst(canvasWidth, canvasHeight, groundY) {
    return Array.from({ length: STREET_SNARE_SPLASHES }, () => {
        const z = 0.4 + Math.random() * 0.6;
        return { x: Math.random() * canvasWidth, y: groundY + (canvasHeight - groundY) * z * 0.85, z };
    });
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

/** Số giọt đang rơi (ít nhất 20). */
function computeStreetActiveRainCount(totalDrops, rainIntensity) {
    return Math.min(totalDrops, Math.max(20, Math.floor(totalDrops * rainIntensity)));
}

/** Tiến `activeCount` giọt đầu: rơi theo độ sâu + gió; chạm đất (y chạm = groundY + phần mặt đường theo z) -> về đỉnh,
 * vị trí ngang mới. @returns {{x:number, y:number, z:number}[]} các điểm chạm frame này (cho tia nước). */
function advanceStreetRainDrops(canvasWidth, canvasHeight, groundY, dpr, activeCount, rainIntensity, wind) {
    const hits = [];
    const roadH = canvasHeight - groundY;
    const fall = 0.6 + rainIntensity * 0.8;
    appState.mutate('streetRain', (arr) => {
        for (let i = 0; i < activeCount; i++) {
            const drop = arr[i];
            const vy = drop.speed * fall * (0.55 + drop.z * 0.6);
            drop.y += vy;
            drop.x += vy * wind;
            const hitY = groundY + roadH * drop.z * 0.85;
            if (drop.y < hitY) continue;
            hits.push({ x: drop.x, y: hitY, z: drop.z });
            drop.y = -drop.len - Math.random() * 40 * dpr;
            drop.x = Math.random() * (canvasWidth + 80 * dpr) - 80 * dpr;
        }
    }, { skipCheck: true });
    return hits;
}

/** Vẽ 1 lớp mưa (giọt có z trong [zMin, zMax)) thành 1 path — đuôi giọt ngược chiều gió. */
function paintStreetRainLayer(ctx, drops, activeCount, layer, rainIntensity, wind, dpr) {
    ctx.strokeStyle = `rgba(200, 215, 230, ${layer.alpha * (0.5 + rainIntensity * 0.7)})`;
    ctx.lineWidth = layer.width * (0.8 + rainIntensity * 0.5) * dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < activeCount; i++) {
        const d = drops[i];
        if (d.z < layer.zMin || d.z >= layer.zMax) continue;
        const len = d.len * (0.6 + rainIntensity * 0.7) * (0.5 + d.z * 0.7);
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - wind * len, d.y - len);
    }
    ctx.stroke();
}

/** Nón sáng dưới chụp đèn: hình thang từ chụp đèn xuống chân cột, đáy nở/thu theo năng lượng cả bài (0-1). */
function computeStreetLampCone(spec, groundY, dpr, smoothedEnergy) {
    const topY = spec.postTopY + 6 * dpr;
    return {
        x: spec.x, topY, bottomY: groundY,
        topHalf: spec.capW * 0.35, bottomHalf: spec.haloR * 0.95 * (0.85 + 0.3 * smoothedEnergy),
        glow: spec.glow, depth: spec.depth, haloR: spec.haloR, capW: spec.capW,
    };
}

/** Độ rộng tương đối + độ đậm 3 lớp nón lồng nhau (ngoài nhạt -> lõi đậm) — viền nón mềm, không cần blur. */
const STREET_CONE_LAYERS = [
    { spread: 1, alpha: 0.35 },
    { spread: 0.68, alpha: 0.35 },
    { spread: 0.4, alpha: 0.3 },
];

/** Vẽ nón sáng thể tích (cộng sáng, nhạt dần xuống đất, viền mềm nhờ 3 lớp lồng nhau). */
function paintStreetLampCone(ctx, cone, lampFill) {
    const grad = ctx.createLinearGradient(0, cone.topY, 0, cone.bottomY);
    grad.addColorStop(0, lampFill);
    grad.addColorStop(1, 'transparent');
    const base = 0.22 * cone.glow * (1 - cone.depth * 0.5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    STREET_CONE_LAYERS.forEach((layer) => {
        ctx.globalAlpha = Math.min(1, base * layer.alpha);
        ctx.beginPath();
        ctx.moveTo(cone.x - cone.topHalf * layer.spread, cone.topY);
        ctx.lineTo(cone.x + cone.topHalf * layer.spread, cone.topY);
        ctx.lineTo(cone.x + cone.bottomHalf * layer.spread, cone.bottomY);
        ctx.lineTo(cone.x - cone.bottomHalf * layer.spread, cone.bottomY);
        ctx.closePath();
        ctx.fill();
    });
    ctx.restore();
}

/** Mặt đường ướt dưới đèn: vũng sáng elip + vệt phản chiếu dọc thon dần kéo xuống phía người xem. */
function paintStreetLampPool(ctx, cone, lampFill, canvasHeight, dpr) {
    const fade = 1 - cone.depth * 0.5;
    const roadH = canvasHeight - cone.bottomY;
    const poolRx = cone.haloR * 1.5;
    const poolRy = Math.max(4 * dpr, roadH * 0.18);
    const reflRx = cone.capW * 0.7;
    const reflRy = Math.max(4 * dpr, Math.min(roadH, (cone.bottomY - cone.topY) * 0.7));
    ctx.save();
    ctx.beginPath();
    ctx.rect(cone.x - poolRx, cone.bottomY, poolRx * 2, roadH); // chỉ trên mặt đường
    ctx.clip();
    ctx.globalCompositeOperation = 'lighter';
    [[poolRx, poolRy, cone.bottomY + poolRy * 0.4, 0.32], [reflRx, reflRy, cone.bottomY, 0.55]].forEach(([rx, ry, cy, a]) => {
        ctx.save();
        ctx.translate(cone.x, cy);
        ctx.scale(1, ry / rx);
        const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
        g.addColorStop(0, lampFill);
        g.addColorStop(1, 'transparent');
        ctx.globalAlpha = Math.min(1, a * cone.glow * fade);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, rx, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
    ctx.restore();
}

/** Vẽ lại sáng (cộng sáng, màu đèn, nhạt dần xuống đất) các giọt nằm trong nón của 1 đèn. */
function paintStreetRainLit(ctx, drops, activeCount, cone, lampFill, rainIntensity, wind, dpr) {
    const span = cone.bottomY - cone.topY;
    const grad = ctx.createLinearGradient(0, cone.topY, 0, cone.bottomY);
    grad.addColorStop(0, lampFill);
    grad.addColorStop(0.6, lampFill);
    grad.addColorStop(1, 'transparent');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, cone.glow * (1 - cone.depth * 0.4));
    ctx.strokeStyle = grad;
    ctx.lineWidth = (1.4 + rainIntensity * 0.7) * dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < activeCount; i++) {
        const d = drops[i];
        const t = (d.y - cone.topY) / span;
        if (t < 0 || t > 1) continue;
        if (Math.abs(d.x - cone.x) > cone.topHalf + (cone.bottomHalf - cone.topHalf) * t) continue;
        const len = d.len * (0.6 + rainIntensity * 0.7) * (0.5 + d.z * 0.7);
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - wind * len, d.y - len);
    }
    ctx.stroke();
    ctx.restore();
}

/** Sinh tia nước tại các điểm chạm (bỏ giọt quá xa — tia quá nhỏ; đủ STREET_SPLASH_MAX thì thôi). */
function spawnStreetSplashes(hits, dpr) {
    appState.mutate('streetSplashes', (arr) => {
        for (let i = 0; i < hits.length && arr.length < STREET_SPLASH_MAX; i++) {
            const h = hits[i];
            if (h.z < 0.3) continue;
            arr.push({ x: h.x, y: h.y, size: (1.5 + h.z * 3.5) * dpr, age: 0, life: 10 + Math.round(h.z * 8) });
        }
    }, { skipCheck: true });
}

/** Tiến tuổi tia nước, bỏ tia đã hết đời. */
function advanceStreetSplashes() {
    appState.mutate('streetSplashes', (arr) => {
        for (let i = arr.length - 1; i >= 0; i--) {
            arr[i].age += 1;
            if (arr[i].age >= arr[i].life) arr.splice(i, 1);
        }
    }, { skipCheck: true });
}

/** Vẽ tia nước: 2 tia bắn chéo lên + gợn elip nhỏ loang ra, mờ dần theo tuổi. */
function paintStreetSplashes(ctx, splashes, dpr) {
    ctx.save();
    ctx.strokeStyle = 'rgba(205, 220, 235, 1)';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, 0.9 * dpr);
    splashes.forEach((sp) => {
        const k = sp.age / sp.life;
        const up = sp.size * 2.2 * Math.sin(k * Math.PI);
        const out = sp.size * (0.6 + k * 1.6);
        ctx.globalAlpha = 0.55 * (1 - k);
        ctx.beginPath();
        ctx.moveTo(sp.x - out * 0.4, sp.y);
        ctx.lineTo(sp.x - out, sp.y - up);
        ctx.moveTo(sp.x + out * 0.4, sp.y);
        ctx.lineTo(sp.x + out, sp.y - up);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, out * 1.3, out * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
    });
    ctx.restore();
}

/** Mặt đất (gradient) từ các color-stop Workflow đã resolve theo color mode. */
function paintRainGroundGradient(ctx, canvasWidth, canvasHeight, groundY, stopColors) {
    const grad = ctx.createLinearGradient(0, groundY, 0, canvasHeight);
    stopColors.forEach((s) => grad.addColorStop(s.offset, s.color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY, canvasWidth, canvasHeight - groundY);
}

/** Tiến flicker + khung hình từng đèn. Mỗi đèn sáng theo mức dải tần của nó (`bandLevels[i]`), loé khi dải có nốt mới
 * (`onsetTimes[i]` mới hơn lần trước đèn đã thấy), rung nhẹ theo vibrato. Trả `colorArgs` để Workflow resolve màu
 * (colorAt()) + `onset` (để Workflow sinh gợn nước). @returns {object[]} specs, cùng thứ tự `streetLamps`. */
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

/** Vẽ 1 đèn đường (cột + chụp + quầng sáng + bóng đèn) từ spec + `lampFill` Workflow đã resolve. */
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

/** Sinh 1 gợn nước dưới chân đèn chính (`color`/`glow` Workflow đã resolve). */
function spawnRainRipple(lampX, groundY, canvasHeight, dpr, color, glow) {
    appState.mutate('ripples', (arr) => arr.push({
        x: lampX + (Math.random() - 0.5) * 60 * dpr, y: groundY + (canvasHeight - groundY) * 0.4,
        radius: 4 * dpr, maxRadius: 50 * dpr, speed: 1.5 * dpr, alpha: 0.5, color, glow,
    }), { skipCheck: true });
}

/** Tiến gợn nước (loang ra, mờ dần), bỏ gợn đã tắt hẳn. */
function advanceRainRipples() {
    appState.mutate('ripples', (arr) => {
        for (let i = arr.length - 1; i >= 0; i--) {
            const rip = arr[i];
            rip.radius += rip.speed;
            rip.alpha -= (rip.speed / rip.maxRadius) * 1.2;
            if (rip.alpha <= 0) arr.splice(i, 1);
        }
    }, { skipCheck: true });
}

/** Vẽ gợn nước còn sống, mới trước cũ sau (màu đã lưu trên từng gợn lúc sinh). Kết thúc với globalAlpha = 1. */
function paintRainRipples(ctx, ripples, dpr) {
    ctx.lineWidth = 1.5 * dpr;
    for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        ctx.beginPath();
        ctx.ellipse(rip.x, rip.y, Math.max(0.1, rip.radius), Math.max(0.1, rip.radius * 0.3), 0, 0, Math.PI * 2);
        ctx.strokeStyle = rip.color;
        ctx.globalAlpha = Math.max(0, rip.alpha);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}
