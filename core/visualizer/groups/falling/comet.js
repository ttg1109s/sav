/**
 * core/visualizer/groups/falling/comet.js
 * Comet Meteor Shower — thuần Canvas 2D cho group falling (registry hiện dùng key "rain").
 * Không tạo RAF/timer/listener; Workflow truyền frame, state và màu đã resolve.
 */

const COMET_DIRECTION_MODES = ['diagonal', 'vertical', 'horizontal', 'omnidirectional', 'directionalStream', 'perspectiveApproach', 'customAngle'];

function createCometMeteorState() {
    return { particles: [], mountains: [], lastSpawnMs: 0, lastFrameMs: 0, lastBeatTime: null, width: 0, height: 0, nextId: 1 };
}

function _cometHash(seed) {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
}

function buildCometMountainLayers(width, height, dpr, cfg) {
    const count = Math.max(1, Math.min(5, Math.round(Number(cfg.cometMountainLayerCount) || 3)));
    const horizon = height * (1 - Math.max(5, Math.min(45, Number(cfg.cometHorizonHeight) || 22)) / 100);
    const heightScale = Math.max(0.5, Math.min(1.8, Number(cfg.cometMountainHeight) || 100)) / 100;
    const layers = [];
    const safeWidth = Math.max(1, width);
    for (let layerIndex = 0; layerIndex < count; layerIndex++) {
        const depth = (layerIndex + 1) / count;
        const step = Math.max(8 * dpr, width / 100);
        const ridgeBase = horizon + depth * height * 0.13;
        const peakSpacing = Math.max(90 * dpr, width / (5.5 + layerIndex * 0.8));
        const phase = layerIndex * 0.37;
        const points = [];
        for (let x = -step; x <= width + step; x += step) {
            const cell = Math.floor((x + phase * peakSpacing) / peakSpacing);
            const local = ((x + phase * peakSpacing) / peakSpacing) - cell;
            const peakAt = 0.22 + _cometHash(cell * 9 + layerIndex * 31) * 0.56;
            const halfWidth = 0.28 + _cometHash(cell * 17 + layerIndex * 13) * 0.16;
            const distance = Math.abs(local - peakAt) / halfWidth;
            // Sườn núi có đỉnh rõ, hai vai dốc và chân núi liên tục, không phải sóng sin tròn.
            const peak = Math.pow(Math.max(0, 1 - distance), 1.35);
            const secondary = Math.pow(Math.max(0, 1 - Math.abs(local - (peakAt + 0.28)) / 0.24), 2) * 0.22;
            const ridgeNoise = (_cometHash(cell * 23 + layerIndex * 7) - 0.5) * 0.12;
            const mountainHeight = height * (0.075 + depth * 0.055) * heightScale;
            const y = ridgeBase - mountainHeight * Math.max(0, peak + secondary + ridgeNoise);
            points.push({ x, y });
        }
        const shade = Math.round(12 + (1 - depth) * 13);
        layers.push({
            layerIndex, depth, points,
            opacity: Math.max(0.18, Math.min(1, (Number(cfg.cometMountainOpacity) || 70) / 100)),
            color: cfg.cometMountainColor || `rgb(${shade}, ${shade + 5}, ${shade + 13})`,
            parallax: depth,
        });
    }
    return layers;
}
function resetCometMeteorState(state, width, height, dpr, cfg) {
    const mountainKey = [
        width, height, dpr, cfg.cometMountainLayerCount, cfg.cometHorizonHeight,
        cfg.cometMountainHeight, cfg.cometMountainOpacity, cfg.cometMountainColor
    ].join('|');
    const sizeChanged = state.width !== width || state.height !== height;
    if (sizeChanged) {
        state.particles.length = 0;
        state.lastSpawnMs = 0;
        state.lastFrameMs = 0;
        state.lastBeatTime = null;
    }
    state.width = width;
    state.height = height;
    // Không dựng lại dãy núi ở mỗi lần host gọi onResize với cùng thông số.
    // Đây là geometry tĩnh; cache tránh nhấp nháy do reset/rebuild liên tục.
    if (state.mountainKey !== mountainKey || !state.mountains.length) {
        state.mountains = buildCometMountainLayers(width, height, dpr, cfg);
        state.mountainKey = mountainKey;
    }
}

function _cometRandom(min, max) { return min + Math.random() * (max - min); }

function _cometDirection(cfg) {
    const mode = cfg.cometDirectionMode || 'diagonal';
    const spreadValue = Number.isFinite(Number(cfg.cometAngleSpread)) ? Number(cfg.cometAngleSpread) : 14;
    const spread = Math.max(0, Math.min(180, spreadValue)) * Math.PI / 180;
    if (mode === 'vertical') return Math.PI / 2;
    if (mode === 'horizontal') return Math.random() < 0.5 ? 0 : Math.PI;
    if (mode === 'omnidirectional') return _cometRandom(0, Math.PI * 2);
    if (mode === 'directionalStream') return (-Math.PI / 4) + _cometRandom(-spread, spread);
    if (mode === 'customAngle') return (Number(cfg.cometDirectionAngle) || 315) * Math.PI / 180;
    return (-Math.PI / 4) + _cometRandom(-spread, spread);
}

function _spawnCometMeteor(state, frame, energy) {
    const cfg = frame.cfg, W = frame.canvas.width, H = frame.canvas.height;
    const perspective = cfg.cometDirectionMode === 'perspectiveApproach';
    const angle = _cometDirection(cfg);
    const speedVariation = Math.max(0, Math.min(100, (Number.isFinite(Number(cfg.cometSpeedVariation)) ? Number(cfg.cometSpeedVariation) : 30))) / 100;
    const speed = Math.max(20, Number(cfg.cometSpeed) || 220) * _cometRandom(1 - speedVariation, 1 + speedVariation) * (1 + energy * (Math.max(0, Number.isFinite(Number(cfg.cometAudioSensitivity)) ? Number(cfg.cometAudioSensitivity) : 0.8) * 0.45));
    let x = _cometRandom(0, W);
    let y = _cometRandom(0, H * 0.72);
    const region = cfg.cometSpawnRegion || 'random';
    if (!perspective) {
        if (region === 'top') y = _cometRandom(0, H * 0.22);
        else if (region === 'bottom') y = _cometRandom(H * 0.65, H);
        else if (region === 'left') x = _cometRandom(0, W * 0.2);
        else if (region === 'right') x = _cometRandom(W * 0.8, W);
    }
    const z = _cometRandom(0.65, 1);
    const spread = Math.max(0, Math.min(100, Number(cfg.cometSpawnSpread) || 70)) / 100;
    const behindRatio = Number.isFinite(Number(cfg.cometBehindMountains)) ? Number(cfg.cometBehindMountains) : 0.55;
    const behind = Math.random() < Math.max(0, Math.min(1, behindRatio));
    // -1 ở sau toàn bộ núi; 0..N-1 ở giữa từng lớp; N ở trước toàn bộ núi.
    const mountainBand = behind ? -1 : Math.floor(_cometRandom(0, state.mountains.length + 1));
    state.particles.push({
        id: state.nextId++, x: perspective ? ((x - W / 2) / Math.max(1, W)) * spread : x,
        y: perspective ? ((y - H / 2) / Math.max(1, H)) * spread : y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        angle, z, age: 0, fadeInDuration: 0.28, mountainBand, life: _cometRandom(1.1, 2.8) * Math.max(0.25, Math.min(3, Number(cfg.cometLifetime) || 1)),
        size: _cometRandom(0.7, 1.5) * Math.max(0.2, Number(cfg.cometSize) || 1) * Math.max(0.2, Number(cfg.cometOverallScale) || 1), tail: Math.max(10, Number(cfg.cometTailLength) || 100) * Math.max(0.2, Number(cfg.cometOverallScale) || 1),
        dust: Math.max(0, Math.min(32, Math.round(Number.isFinite(Number(cfg.cometDustPerMeteor)) ? Number(cfg.cometDustPerMeteor) : 8))),
        dustParticles: [], behind, perspective, dustSpread: Math.max(0, Number(cfg.cometDustSpread) || 1),
        seed: Math.random() * 1000,
    });
}

function advanceCometMeteorState(state, frame, dtMs, energy, nowMs, highFrequency) {
    const cfg = frame.cfg, W = frame.canvas.width, H = frame.canvas.height;
    const dt = Math.min(0.1, Math.max(0, dtMs / 1000));
    const maxMeteors = Math.max(1, Math.min(100, Math.round(Number(cfg.cometMaxMeteors) || 18)));
    const spawnRate = Math.max(0.1, Math.min(30, Number(cfg.cometSpawnRate) || 3));
    if (frame.isPlaying && state.particles.length < maxMeteors && nowMs - state.lastSpawnMs >= 1000 / spawnRate) {
        _spawnCometMeteor(state, frame, energy);
        state.lastSpawnMs = nowMs;
    }
    const dustMax = Math.max(0, Math.min(2400, maxMeteors * 32));
    let dustCount = 0;
    state.particles.forEach((p) => {
        p.age += dt;
        if (p.perspective) {
            p.z -= dt * (Math.max(0.05, Number(cfg.cometApproachSpeed) || 0.28)) * (1 + energy * 0.3);
            const focal = Math.max(0.1, Number(cfg.cometPerspectiveStrength) || 0.85) * Math.min(W, H);
            p.screenX = W / 2 + p.x * focal / Math.max(0.04, p.z);
            p.screenY = H / 2 + p.y * focal / Math.max(0.04, p.z);
            const farScale = Math.max(0.05, Number(cfg.cometFarScale) || 0.35);
            const nearScale = Math.max(farScale, Number(cfg.cometNearScale) || 3);
            p.screenScale = Math.min(8, Math.max(0.08, farScale + (nearScale - farScale) * (1 - Math.max(0, Math.min(1, p.z)))));
        } else {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.screenX = p.x; p.screenY = p.y; p.screenScale = 1;
        }
        if (p.dustParticles.length < p.dust && dustCount < dustMax && Math.random() < dt * (18 + energy * Math.max(0, (Number.isFinite(Number(cfg.cometAudioSensitivity)) ? Number(cfg.cometAudioSensitivity) : 0.8)) * 18 + Math.max(0, Number.isFinite(Number(cfg.cometHighFrequencySensitivity)) ? Number(cfg.cometHighFrequencySensitivity) : 0.8) * Math.max(0, highFrequency || 0) * 30)) {
            p.dustParticles.push({ x: p.screenX || p.x, y: p.screenY || p.y, vx: _cometRandom(-28, 28) * p.dustSpread, vy: _cometRandom(-28, 28) * p.dustSpread, life: _cometRandom(0.15, 0.7), maxLife: 0.7, size: _cometRandom(0.4, 1.4) * Math.max(0.2, Number(cfg.cometOverallScale) || 1) });
        }
        p.dustParticles.forEach(d => { d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; dustCount++; });
        p.dustParticles = p.dustParticles.filter(d => d.life > 0);
    });
    state.particles = state.particles.filter(p => p.age < p.life && (p.perspective ? p.z > 0.035 : p.screenX > -W * 0.3 && p.screenX < W * 1.3 && p.screenY > -H * 0.3 && p.screenY < H * 1.3));
}

function _cometClamp01(value) { return Math.max(0, Math.min(1, value)); }

function _cometExitFade(p, width, height) {
    const x = p.screenX, y = p.screenY;
    const dx = p.perspective ? (x - width / 2) : (p.vx || 0);
    const dy = p.perspective ? (y - height / 2) : (p.vy || 0);
    const distances = [];
    if (dx > 0.001) distances.push((width - x) / dx);
    else if (dx < -0.001) distances.push(x / -dx);
    if (dy > 0.001) distances.push((height - y) / dy);
    else if (dy < -0.001) distances.push(y / -dy);
    if (!distances.length) return 1;
    const secondsToExit = Math.min(...distances);
    return _cometClamp01(secondsToExit / 0.32);
}

function paintCometMeteor(ctx, p, cfg, color, energy) {
    const x = p.screenX, y = p.screenY, scale = p.screenScale;
    const fadeOut = Math.pow(Math.max(0, 1 - p.age / p.life), Math.max(0.1, Math.min(4, Number(cfg.cometBrightnessFalloff) || 1)));
    const fadeIn = _cometClamp01(p.age / Math.max(0.1, p.fadeInDuration || 0.28));
    const edgeFade = _cometExitFade(p, ctx.canvas.width, ctx.canvas.height);
    const fade = fadeOut * fadeIn * edgeFade;
    const brightness = Math.max(0, Math.min(2, Number(cfg.cometBrightness) || 1)) * fade * (1 + Math.max(0, Number(cfg.cometAudioSensitivity) || 0.8) * Math.max(0, energy || 0) * 0.8);
    const tail = p.tail * scale * Math.max(0.2, Number(cfg.cometTailStretch) || 1) * (p.perspective ? 0.75 + (1 - p.z) : 1);
    const angle = p.perspective ? Math.atan2(y - ctx.canvas.height / 2, x - ctx.canvas.width / 2) : p.angle;
    const tx = x - Math.cos(angle) * tail, ty = y - Math.sin(angle) * tail;
    const grad = ctx.createLinearGradient(tx, ty, x, y);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, color.fill || '#ffffff');
    ctx.save();
    ctx.globalAlpha = brightness * Math.max(0, Math.min(1, Number(cfg.cometTailOpacity) || 0.75));
    ctx.lineCap = 'round';
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(0.35, p.size * scale * 1.5);
    ctx.shadowColor = color.glow || color.fill || '#ffffff';
    ctx.shadowBlur = Math.max(0, Number.isFinite(Number(cfg.cometGlow)) ? Number(cfg.cometGlow) : 16) * scale * Math.max(0.2, Number(cfg.cometOverallScale) || 1);
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.globalAlpha = brightness;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.35, p.size * scale), 0, Math.PI * 2); ctx.fill();
    p.dustParticles.forEach(d => {
        ctx.globalAlpha = brightness * Math.max(0, d.life / d.maxLife) * 0.75;
        ctx.fillStyle = color.fill || '#ffffff';
        ctx.beginPath(); ctx.arc(d.x, d.y, d.size * scale, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
}

function paintCometMountainLayer(ctx, layer) {
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.fillStyle = layer.color;
    ctx.beginPath();
    ctx.moveTo(0, ctx.canvas.height);
    layer.points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(ctx.canvas.width, ctx.canvas.height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function paintCometMountains(ctx, state) {
    state.mountains.slice().sort((a, b) => a.depth - b.depth)
        .forEach(layer => paintCometMountainLayer(ctx, layer));
}
