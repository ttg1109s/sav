/**
 * core/visualizer/types/lighting.js — Core thuần cho visual "Lighting" (MODES key 'lighting'),
 * 2 style con qua customEffect.lighting.lightingStyle: 'thunder' (tia sét, style cũ đứng riêng
 * dưới tên 'lightning') và 'fireworks' (pháo hoa). Mỗi hàm 1 việc, KHÔNG hàm nào tự đọc appState
 * (Rule 2) hay gọi hàm khác trong CHÍNH FILE NÀY ngoài vòng lặp nội bộ thuần (Rule 3c) —
 * event/workflow/visualizer-render.js (_tickLighting()/_tickLightingThunder()/
 * _tickLightingFireworks()) đọc/ghi appState, tự gọi RIÊNG LẺ từng hàm dưới đây, cùng khuôn
 * core/visualizer/types/space.js. `flashThreshold` (chớp toàn màn hình) dùng CHUNG cho cả 2 style.
 *
 * NẠP SAU: core/dom-refs.js (canvas), core/config.js (FIREWORKS_STYLE_KEYS), core/custom-
 * effect.js (getActiveEffectConfig), core/audio-analysis.js (getComputedColor).
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

/** Tạo 1 tia sét mới — zig-zag từ trên xuống đáy màn hình. */
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

// ================================ Nhóm "lighting" — chớp màn hình =============================
// Dùng chung cho cả 2 style: thunder tô trước khi vẽ bolt, fireworks tô khi có burst lớn.

function drawLightingFlash(ctx, width, height, alpha) {
    if (alpha <= 0) return;
    ctx.fillStyle = `rgba(200, 220, 255, ${alpha})`;
    ctx.fillRect(0, 0, width, height);
}

// ================================ Style "fireworks" (pháo hoa) ================================
// Rocket — `depthScale` (0.4 xa .. 1.0 gần) quy định kích thước/tốc độ/độ sáng, tạo chiều sâu
// xa/gần giữa các lần bắn; `binIndex`/`launchBeatScale` (MỚI) là 2 nguồn "zoom to/nhỏ" theo nhạc
// (khác depthScale — đó là phối cảnh ngẫu nhiên, đây là do nhạc quyết định), xem
// computeFireworksSizeScale() + _fwLaunchOne() (event/workflow/visualizer-render.js).

/** @returns {object} rocket mới, bay từ (startX,startY) tới (targetX,targetY). `binIndex` = dải
 * tần FFT gán cho rocket này lúc bắn, đọc lại LÚC NỔ để lấy độ cao bin hiện tại (mục 4, phản hồi
 * Giang). `launchBeatScale` = độ mạnh bass TẠI THỜI ĐIỂM BẮN (mục 1, phản hồi Giang). */
function createFireworksRocket(startX, startY, targetX, targetY, style, color, depthScale, binIndex, launchBeatScale) {
    const distance = Math.hypot(targetX - startX, targetY - startY);
    const speed = Math.min(14, Math.max(8, distance / 35)) * (0.85 + depthScale * 0.3);
    const angle = Math.atan2(targetY - startY, targetX - startX);
    return {
        x: startX, y: startY, targetX, targetY, style, color, depthScale, binIndex, launchBeatScale,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        trail: [],
    };
}

/** Tiến 1 bước — sửa trực tiếp lên object nhận vào (không phải appState, an toàn). Vệt dài (12
 * điểm) để vệt bay rõ, mờ dần từ đuôi tới đầu khi vẽ (drawFireworksRocket()). */
function advanceFireworksRocket(rocket) {
    rocket.trail.push({ x: rocket.x, y: rocket.y });
    if (rocket.trail.length > 12) rocket.trail.shift();
    rocket.x += rocket.vx;
    rocket.y += rocket.vy;
}

function hasFireworksRocketArrived(rocket) {
    const distToTarget = Math.hypot(rocket.targetX - rocket.x, rocket.targetY - rocket.y);
    return (rocket.vy < 0 && rocket.y <= rocket.targetY) || distToTarget < 15;
}

/** Vẽ từng đoạn vệt riêng (không phải 1 stroke() duy nhất) để mờ dần thật từ đuôi lên đầu; kích
 * thước/độ sáng nhân theo depthScale — rocket "xa" nhỏ/mờ hơn rocket "gần". */
function drawFireworksRocket(ctx, rocket, dpr) {
    const n = rocket.trail.length;
    for (let i = 1; i < n; i++) {
        ctx.globalAlpha = (i / n) * rocket.depthScale;
        ctx.beginPath();
        ctx.lineWidth = 2.5 * dpr * rocket.depthScale;
        ctx.strokeStyle = rocket.color;
        ctx.moveTo(rocket.trail[i - 1].x, rocket.trail[i - 1].y);
        ctx.lineTo(rocket.trail[i].x, rocket.trail[i].y);
        ctx.stroke();
    }
    ctx.globalAlpha = rocket.depthScale;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(rocket.x, rocket.y, 2.5 * dpr * rocket.depthScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

// ----- Particle -----

function createFireworksParticle(x, y, color, options = {}) {
    return {
        x, y, color,
        vx: options.vx || 0, vy: options.vy || 0,
        friction: options.friction || 0.96,
        gravity: options.gravity !== undefined ? options.gravity : 0.06,
        alpha: 1, decay: options.decay || (0.01 + Math.random() * 0.015),
        size: options.size || (1.5 + Math.random() * 2),
        trail: [], maxTrail: options.trailLength || 4,
        flicker: options.flicker || false,
        canSplit: options.canSplit || false, hasSplit: false,
        colorShift: options.colorShift || false, targetColor: options.targetColor || null, colorSwapped: false,
        depthAlpha: 1,
    };
}

/** Áp hệ số chiều sâu (0.4 xa .. 1.0 gần) lên 1 lô hạt vừa tạo — hạt xa nhỏ hơn/mờ hơn hạt gần,
 * tạo cảm giác pháo hoa có lớp xa/gần thay vì đồng nhất 1 mặt phẳng. Sửa trực tiếp lên các
 * object particle nhận vào (không phải appState). */
function applyFireworksDepth(particles, depthScale) {
    particles.forEach((p) => {
        p.size *= depthScale;
        p.depthAlpha = depthScale;
    });
    return particles;
}

/** Nhân thêm hệ số "zoom to/nhỏ" theo nhạc (độ cao bin FFT lúc nổ + độ mạnh beat lúc bắn, mục 1+4
 * phản hồi Giang) lên size hạt — ĐỘC LẬP với applyFireworksDepth() (đó là phối cảnh xa/gần ngẫu
 * nhiên, đây là do nhạc quyết định). Sửa trực tiếp lên các object particle nhận vào. */
function applyFireworksSizeScale(particles, sizeScale) {
    particles.forEach((p) => { p.size *= sizeScale; });
    return particles;
}

/** Tiến 1 bước — sửa trực tiếp lên object nhận vào. @returns {'alive'|'dead'|'split'} */
function updateFireworksParticle(particle) {
    if (particle.maxTrail > 0) {
        particle.trail.push({ x: particle.x, y: particle.y });
        if (particle.trail.length > particle.maxTrail) particle.trail.shift();
    }
    particle.vx *= particle.friction;
    particle.vy *= particle.friction;
    particle.vy += particle.gravity;
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.alpha -= particle.decay;

    // "Ghost" — đổi hẳn sang targetColor giữa vòng đời (thay vì nội suy từng kênh RGB, vì màu
    // trả về bởi getComputedColor() có thể là hex/rgb()/hsla() tuỳ mode, không parse chung được).
    if (particle.colorShift && !particle.colorSwapped && particle.alpha < 0.7) {
        particle.color = particle.targetColor || particle.color;
        particle.colorSwapped = true;
    }
    if (particle.canSplit && !particle.hasSplit && particle.alpha < 0.65) {
        particle.hasSplit = true;
        return 'split';
    }
    return particle.alpha > 0 ? 'alive' : 'dead';
}

/** @param {number} blurMult - 0..1, getActiveBlurMult() (core/audio-analysis.js) — 0 nếu tắt
 * "Glow/blur" ở Custom Effect Drawer. Glow ở ĐÚNG vùng nổ (shadowBlur quanh mỗi hạt). */
function drawFireworksParticle(ctx, particle, blurMult, dpr) {
    if (particle.alpha <= 0) return;
    const depthAlpha = particle.depthAlpha;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    if (blurMult > 0) {
        ctx.shadowBlur = 14 * dpr * blurMult * depthAlpha;
        ctx.shadowColor = particle.color;
    }
    if (particle.trail.length > 1) {
        ctx.beginPath();
        ctx.lineWidth = particle.size * 0.8;
        ctx.strokeStyle = particle.color;
        ctx.globalAlpha = particle.alpha * 0.5 * depthAlpha;
        particle.trail.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.stroke();
    }
    ctx.globalAlpha = (particle.flicker && Math.random() < 0.3 ? 0.2 : particle.alpha) * depthAlpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/** Crossette — 1 hạt "gãy" giữa không thành 4 hạt con, hướng vuông góc nhau. */
function splitFireworksParticle(particle) {
    return [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((dir) => createFireworksParticle(particle.x, particle.y, particle.color, {
        vx: Math.cos(dir) * 3.5, vy: Math.sin(dir) * 3.5,
        gravity: particle.gravity, friction: 0.94, decay: 0.025, size: 1.5, trailLength: 4,
    }));
}

// ----- 14 kiểu nổ — mỗi hàm ĐÚNG 1 kiểu (Rule 1: không switch/case chọn giữa nhiều kiểu trong 1
// hàm). Workflow tự chọn ĐÚNG hàm cần gọi qua FIREWORKS_EXPLODERS bên dưới. `spectrumBin` (0-255,
// 1 dải tần vizDataArray do Workflow truyền vào) lệch dần theo index hạt để tạo biến thiên màu ở
// mode 'gradient' — xem getComputedColor(), core/audio-analysis.js. -----

function explodeFireworksCluster(x, y, count, power, gravity, spectrumBin) {
    const particles = [];
    for (let i = 0; i < 30; i++) {
        const a = Math.random() * Math.PI * 2;
        const s = (Math.random() * 4 + 1) * power;
        particles.push(createFireworksParticle(x, y, '#ffffff', { vx: Math.cos(a) * s, vy: Math.sin(a) * s, gravity, friction: 0.94 }));
    }
    const subClusters = 7;
    const subRadius = 45 * power;
    for (let c = 0; c < subClusters; c++) {
        const clusterAngle = (c / subClusters) * Math.PI * 2;
        const cx = x + Math.cos(clusterAngle) * subRadius;
        const cy = y + Math.sin(clusterAngle) * subRadius;
        const clusterColor = getComputedColor(c, subClusters, spectrumBin).fill;
        const miniCount = Math.floor(count / subClusters);
        for (let i = 0; i < miniCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (Math.random() * 5 + 1) * power;
            particles.push(createFireworksParticle(cx, cy, clusterColor, {
                vx: Math.cos(angle) * speed + Math.cos(clusterAngle) * 1.5,
                vy: Math.sin(angle) * speed + Math.sin(clusterAngle) * 1.5,
                gravity: gravity * 0.8, friction: 0.95, trailLength: 5, flicker: Math.random() < 0.4,
            }));
        }
    }
    return particles;
}

function explodeFireworksKamuro(x, y, count, power, gravity, spectrumBin) {
    const particles = [];
    const kamuroCount = Math.floor(count * 1.5);
    for (let i = 0; i < kamuroCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 6.5 + 0.5) * power;
        const color = getComputedColor(i, kamuroCount, spectrumBin).fill;
        particles.push(createFireworksParticle(x, y, color, {
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.5,
            gravity: gravity * 0.4, friction: 0.975, decay: 0.004, trailLength: 16, size: 1.3, flicker: true,
        }));
    }
    return particles;
}

function explodeFireworksHorsetail(x, y, count, power, gravity, spectrumBin) {
    const particles = [];
    const tailCount = Math.floor(count * 1.1);
    const cascadeColor = getComputedColor(0, 1, spectrumBin).fill;
    for (let i = 0; i < tailCount; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
        const speed = (Math.random() * 5.5 + 2) * power;
        particles.push(createFireworksParticle(x, y, cascadeColor, {
            vx: Math.cos(angle) * speed * 0.6, vy: Math.sin(angle) * speed,
            gravity: gravity * 1.1, friction: 0.96, decay: 0.008, trailLength: 10, size: 1.6, flicker: Math.random() < 0.3,
        }));
    }
    return particles;
}

function explodeFireworksSpiral(x, y, count, power, gravity, spectrumBin) {
    const particles = [];
    const arms = 4;
    const particlesPerArm = Math.floor(count / arms);
    for (let a = 0; a < arms; a++) {
        const armBaseAngle = (a / arms) * Math.PI * 2;
        const armColor = getComputedColor(a, arms, spectrumBin).fill;
        for (let i = 0; i < particlesPerArm; i++) {
            const step = i / particlesPerArm;
            const angle = armBaseAngle + step * Math.PI * 2.5;
            const speed = (step * 6 + 1) * power;
            particles.push(createFireworksParticle(x, y, armColor, {
                vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity, friction: 0.95, trailLength: 6, size: 1.8,
            }));
        }
    }
    return particles;
}

function explodeFireworksDoublering(x, y, count, power, gravity, spectrumBin) {
    const particles = [];
    const outerColor = getComputedColor(0, 2, spectrumBin).fill;
    const innerColor = getComputedColor(1, 2, spectrumBin).fill;
    const outerCount = Math.floor(count * 0.65);
    for (let i = 0; i < outerCount; i++) {
        const angle = (i / outerCount) * Math.PI * 2;
        const speed = (6 + Math.random() * 0.4) * power;
        particles.push(createFireworksParticle(x, y, outerColor, { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: gravity * 0.6, friction: 0.96, trailLength: 6 }));
    }
    const innerCount = Math.floor(count * 0.35);
    for (let i = 0; i < innerCount; i++) {
        const angle = (i / innerCount) * Math.PI * 2;
        const speed = (3.2 + Math.random() * 0.3) * power;
        particles.push(createFireworksParticle(x, y, innerColor, { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: gravity * 0.6, friction: 0.96, trailLength: 5 }));
    }
    return particles;
}

function explodeFireworksGhost(x, y, count, power, gravity, spectrumBin) {
    const particles = [];
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 6 + 1.5) * power;
        const targetColor = getComputedColor(i, count, spectrumBin).fill;
        particles.push(createFireworksParticle(x, y, '#ffffff', {
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity, friction: 0.95, decay: 0.011,
            trailLength: 6, colorShift: true, targetColor,
        }));
    }
    return particles;
}

function explodeFireworksChrysanthemum(x, y, count, power, gravity, spectrumBin) {
    const particles = [];
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 6 + 1.5) * power;
        const color = Math.random() < 0.2 ? '#ffffff' : getComputedColor(i, count, spectrumBin).fill;
        particles.push(createFireworksParticle(x, y, color, { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity, friction: 0.95, trailLength: 6, flicker: Math.random() < 0.3 }));
    }
    return particles;
}

function explodeFireworksWillow(x, y, count, power, gravity, spectrumBin) {
    const particles = [];
    const willowCount = Math.floor(count * 1.2);
    const willowColor = getComputedColor(0, 1, spectrumBin).fill;
    for (let i = 0; i < willowCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 5 + 0.5) * power;
        particles.push(createFireworksParticle(x, y, willowColor, {
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity: gravity * 0.6, friction: 0.97, decay: 0.007, trailLength: 12, size: 1.2, flicker: true,
        }));
    }
    return particles;
}

function explodeFireworksHeart(x, y, count, power, gravity, spectrumBin) {
    const particles = [];
    const points = Math.floor(count * 0.9);
    const heartColor = getComputedColor(0, 1, spectrumBin).fill;
    for (let i = 0; i < points; i++) {
        const t = (i / points) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        const scale = 0.35 * power;
        particles.push(createFireworksParticle(x, y, heartColor, { vx: hx * scale, vy: hy * scale, gravity: gravity * 0.5, friction: 0.94, decay: 0.012, trailLength: 5 }));
    }
    return particles;
}

function explodeFireworksRing(x, y, count, power, gravity, spectrumBin) {
    const particles = [];
    const ringColor = getComputedColor(0, 2, spectrumBin).fill;
    for (let i = 0; i < Math.floor(count * 0.4); i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 * power;
        particles.push(createFireworksParticle(x, y, '#ffffff', { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity }));
    }
    const ringCount = Math.floor(count * 0.8);
    const tiltAngle = Math.PI / 6;
    for (let i = 0; i < ringCount; i++) {
        const angle = (i / ringCount) * Math.PI * 2;
        const speed = (5 + Math.random() * 0.5) * power;
        particles.push(createFireworksParticle(x, y, ringColor, {
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * Math.sin(tiltAngle), gravity: gravity * 0.4, friction: 0.96, trailLength: 6,
        }));
    }
    return particles;
}

function explodeFireworksCrossette(x, y, count, power, gravity, spectrumBin) {
    const particles = [];
    const color = getComputedColor(0, 1, spectrumBin).fill;
    for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI * 2;
        const speed = 6 * power;
        particles.push(createFireworksParticle(x, y, color, { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity, friction: 0.95, decay: 0.015, size: 2.5, canSplit: true }));
    }
    return particles;
}

function explodeFireworksPalm(x, y, count, power, gravity, spectrumBin) {
    const particles = [];
    const palmColor = getComputedColor(0, 1, spectrumBin).fill;
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 6 + 2) * power;
        particles.push(createFireworksParticle(x, y, palmColor, {
            vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.5, gravity: gravity * 0.8, friction: 0.94, decay: 0.01, size: 2.2, trailLength: 8,
        }));
    }
    return particles;
}

function explodeFireworksCrackle(x, y, count, power, gravity, spectrumBin) {
    const particles = [];
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 7 + 1) * power;
        const color = Math.random() < 0.5 ? '#ffffff' : getComputedColor(i, count, spectrumBin).fill;
        particles.push(createFireworksParticle(x, y, color, { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity, friction: 0.92, decay: 0.02 + Math.random() * 0.02, flicker: true, trailLength: 3 }));
    }
    return particles;
}

function explodeFireworksStrobe(x, y, count, power, gravity, spectrumBin) {
    const particles = [];
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 6 + 1) * power;
        const color = getComputedColor(i, count, (spectrumBin + i * 23) % 256).fill;
        particles.push(createFireworksParticle(x, y, color, { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, gravity, friction: 0.95, flicker: true, decay: 0.012, trailLength: 5 }));
    }
    return particles;
}

/** Bảng tra kiểu nổ -> hàm explode — key PHẢI khớp y hệt FIREWORKS_STYLE_KEYS (core/config.js). */
const FIREWORKS_EXPLODERS = {
    cluster: explodeFireworksCluster,
    kamuro: explodeFireworksKamuro,
    horsetail: explodeFireworksHorsetail,
    spiral: explodeFireworksSpiral,
    doublering: explodeFireworksDoublering,
    ghost: explodeFireworksGhost,
    chrysanthemum: explodeFireworksChrysanthemum,
    willow: explodeFireworksWillow,
    heart: explodeFireworksHeart,
    ring: explodeFireworksRing,
    crossette: explodeFireworksCrossette,
    palm: explodeFireworksPalm,
    crackle: explodeFireworksCrackle,
    strobe: explodeFireworksStrobe,
};

// ----- Lựa chọn kiểu / nhịp bắn — thuần, không appState -----

/** Guard clause: bỏ check hết -> coi như chưa đủ điều kiện, fallback về đủ 14 kiểu. */
function resolveEnabledFireworksStyles(enabledStyles) {
    return enabledStyles && enabledStyles.length > 0 ? enabledStyles : FIREWORKS_STYLE_KEYS;
}

function pickRandomFireworksStyle(enabledStyles) {
    return enabledStyles[Math.floor(Math.random() * enabledStyles.length)];
}

/** Khoảng cách (ms) giữa 2 lần auto-launch — BPM cao + nhạc dồn dập -> bắn dày hơn. */
function computeFireworksAutoLaunchIntervalMs(bpm, autoLaunchDensity, smoothedEnergy, isPlaying) {
    const baseMs = 2200 - autoLaunchDensity * 18; // density 5->2110ms, density 100->400ms
    if (!isPlaying) return baseMs * 2;
    const bpmFactor = 120 / (bpm || 120);
    const energyFactor = 1 - smoothedEnergy * 0.6;
    return Math.max(120, baseMs * bpmFactor * energyFactor);
}

/** Lực nổ tức thời = burstPower cấu hình, nhân thêm theo bass hiện tại (beatScale). */
function computeFireworksBurstPower(burstPower, beatScale) {
    return burstPower * (1 + beatScale * 0.6);
}

/** "Zoom to/nhỏ" theo nhạc (mục 1+4, phản hồi Giang) — kết hợp độ cao bin FFT gán cho rocket này
 * ĐỌC LẠI LÚC NỔ (`binValue01`, 0..1 — bin im ắng lúc nổ -> nhỏ, bin đang cao -> to) với độ mạnh
 * bass TẠI THỜI ĐIỂM BẮN (`launchBeatScale` — quyết định "hạng cỡ" rocket đó ngay từ lúc phóng).
 * Nhân vào particleCount/burstPower/size hạt (xem _tickLightingFireworks()) — hoàn toàn khác
 * `depthScale` (phối cảnh xa/gần ngẫu nhiên, không liên quan nhạc). */
function computeFireworksSizeScale(binValue01, launchBeatScale) {
    const binFactor = 0.6 + binValue01 * 1.2;       // bin im ắng lúc nổ -> 0.6x, bin cực đại -> 1.8x
    const beatFactor = 0.8 + launchBeatScale * 0.6; // beat yếu lúc bắn -> 0.8x, beat mạnh -> 1.4x
    return Math.min(2.2, binFactor * beatFactor);
}

/** Chớp màn hình khi có burst lớn — xem drawLightingFlash() ở nhóm "lighting" phía trên. */
function computeFireworksFlashAlpha(beatScale, threshold) {
    return beatScale > threshold ? Math.min(0.5, (beatScale - threshold) * 2.5) : 0;
}

// ----- Chữ bắn pháo hoa -----

/** Lấy mẫu 1 chuỗi chữ thành tập điểm cục bộ (canvas ẩn), dùng làm hình dạng nổ. Thuần — không
 * appState, không vẽ lên canvas chính. @returns {{x:number,y:number}[]} */
function buildFireworksTextPoints(text) {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = 400;
    offCanvas.height = 150;
    const offCtx = offCanvas.getContext('2d');
    offCtx.fillStyle = '#ffffff';
    offCtx.font = 'bold 70px Inter, sans-serif';
    offCtx.textAlign = 'center';
    offCtx.textBaseline = 'middle';
    offCtx.fillText(text.toUpperCase(), 200, 75);
    const data = offCtx.getImageData(0, 0, 400, 150).data;
    const points = [];
    for (let py = 0; py < 150; py += 4) {
        for (let px = 0; px < 400; px += 4) {
            if (data[(py * 400 + px) * 4 + 3] > 128) points.push({ x: (px - 200) * 0.8, y: (py - 75) * 0.8 });
        }
    }
    return points;
}

function explodeFireworksText(x, y, points, power, spectrumBin) {
    const color = getComputedColor(0, 1, spectrumBin).fill;
    return points.map((pt) => createFireworksParticle(x, y, color, {
        vx: pt.x * 0.08 * power + (Math.random() - 0.5) * 0.5,
        vy: pt.y * 0.08 * power + (Math.random() - 0.5) * 0.5,
        gravity: 0.02, friction: 0.95, decay: 0.009, size: 1.8, trailLength: 3, flicker: true,
    }));
}

/** Round-robin qua customTexts — thuần, trả state kế tiếp để Workflow tự ghi lại. */
function pickNextFireworksText(customTexts, currentIndex) {
    if (!customTexts || customTexts.length === 0) return null;
    const index = currentIndex % customTexts.length;
    return { text: customTexts[index], nextIndex: (index + 1) % customTexts.length };
}
