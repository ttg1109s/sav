/**
 * core/visualizer/groups/falling/comet.js
 * Comet Meteor Shower — thuần Canvas 2D cho group falling (registry hiện dùng key "rain").
 * Không tạo RAF/timer/listener; Workflow truyền frame, state và màu đã resolve.
 */

const COMET_DIRECTION_MODES = ['diagonal', 'vertical', 'horizontal', 'omnidirectional', 'directionalStream', 'perspectiveApproach', 'customAngle'];

function createCometMeteorState() {
    return { particles: [], mountains: [], lastSpawnMs: 0, lastFrameMs: 0, width: 0, height: 0, nextId: 1 };
}

function buildCometMountainLayers(width, height, dpr, cfg) {
    const count = Math.max(1, Math.min(5, Math.round(cfg.cometMountainLayerCount || 3)));
    const horizon = height * (1 - Math.max(5, Math.min(45, cfg.cometHorizonHeight || 22)) / 100);
    const layers = [];
    for (let layerIndex = 0; layerIndex < count; layerIndex++) {
        const depth = (layerIndex + 1) / count;
        const points = [];
        const step = Math.max(24 * dpr, width / 22);
        const seed = 37 + layerIndex * 101;
        for (let x = -step; x <= width + step; x += step) {
            const waveA = Math.sin((x / width) * (3.1 + layerIndex * 0.9) * Math.PI + seed) * height * (0.035 + depth * 0.025);
            const waveB = Math.sin((x / width) * (7.7 + layerIndex) * Math.PI + seed * 0.31) * height * 0.018;
            const variation = ((Math.sin(x * 0.013 + seed) * 0.5) + (Math.cos(x * 0.027 + seed * 2) * 0.5)) * height * 0.018;
            points.push({ x, y: horizon + waveA + waveB + variation + depth * height * 0.12 });
        }
        layers.push({
            layerIndex,
            depth,
            points,
            opacity: Math.max(0.12, Math.min(1, (cfg.cometMountainOpacity || 70) / 100) * (0.35 + depth * 0.65)),
            color: cfg.cometMountainColor || '#101827',
            parallax: depth,
        });
    }
    return layers;
}

function resetCometMeteorState(state, width, height, dpr, cfg) {
    state.particles.length = 0;
    state.width = width;
    state.height = height;
    state.lastSpawnMs = 0;
    state.lastFrameMs = 0;
    state.mountains = buildCometMountainLayers(width, height, dpr, cfg);
}

function _cometRandom(min, max) { return min + Math.random() * (max - min); }

function _cometDirection(cfg) {
    const mode = cfg.cometDirectionMode || 'diagonal';
    if (mode === 'vertical') return Math.PI / 2;
    if (mode === 'horizontal') return Math.random() < 0.5 ? 0 : Math.PI;
    if (mode === 'omnidirectional') return _cometRandom(0, Math.PI * 2);
    if (mode === 'directionalStream') return (-Math.PI / 4) + _cometRandom(-0.16, 0.16);
    if (mode === 'customAngle') return (Number(cfg.cometDirectionAngle) || 315) * Math.PI / 180;
    return (-Math.PI / 4) + _cometRandom(-0.12, 0.12);
}

function _spawnCometMeteor(state, frame, energy) {
    const cfg = frame.cfg, W = frame.canvas.width, H = frame.canvas.height;
    const perspective = cfg.cometDirectionMode === 'perspectiveApproach';
    const angle = _cometDirection(cfg);
    const speed = Math.max(20, Number(cfg.cometSpeed) || 220) * _cometRandom(0.7, 1.3) * (1 + energy * 0.45);
    const x = _cometRandom(0, W);
    const y = _cometRandom(0, H * 0.72);
    const z = _cometRandom(0.15, 1);
    const spread = Math.max(0, Math.min(100, Number(cfg.cometSpawnSpread) || 70)) / 100;
    const behind = Math.random() < Math.max(0, Math.min(1, Number(cfg.cometBehindMountains) || 0.55));
    state.particles.push({
        id: state.nextId++, x: perspective ? (x - W / 2) * spread : x,
        y: perspective ? (y - H / 2) * spread : y,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        angle, z, age: 0, life: _cometRandom(1.1, 2.8),
        size: _cometRandom(0.7, 1.5), tail: Math.max(10, Number(cfg.cometTailLength) || 100),
        dust: Math.max(0, Math.min(32, Math.round(Number(cfg.cometDustPerMeteor) || 8))),
        dustParticles: [], behind, perspective,
        seed: Math.random() * 1000,
    });
}

function advanceCometMeteorState(state, frame, dtMs, energy, nowMs) {
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
            p.screenScale = Math.min(8, Math.max(0.08, (Number(cfg.cometNearScale) || 3) / Math.max(0.08, p.z)));
        } else {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.screenX = p.x; p.screenY = p.y; p.screenScale = 1;
        }
        if (p.dustParticles.length < p.dust && dustCount < dustMax && Math.random() < dt * 18) {
            p.dustParticles.push({ x: p.screenX || p.x, y: p.screenY || p.y, vx: _cometRandom(-28, 28), vy: _cometRandom(-28, 28), life: _cometRandom(0.15, 0.7), maxLife: 0.7, size: _cometRandom(0.4, 1.4) });
        }
        p.dustParticles.forEach(d => { d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt; dustCount++; });
        p.dustParticles = p.dustParticles.filter(d => d.life > 0);
    });
    state.particles = state.particles.filter(p => p.age < p.life && (p.perspective ? p.z > 0.035 : p.screenX > -W * 0.3 && p.screenX < W * 1.3 && p.screenY > -H * 0.3 && p.screenY < H * 1.3));
}

function paintCometMeteor(ctx, p, cfg, color) {
    const x = p.screenX, y = p.screenY, scale = p.screenScale;
    const fade = Math.max(0, 1 - p.age / p.life);
    const brightness = Math.max(0, Math.min(2, Number(cfg.cometBrightness) || 1)) * fade;
    const tail = p.tail * scale * (p.perspective ? 0.75 + (1 - p.z) : 1);
    const angle = p.perspective ? Math.atan2(y - ctx.canvas.height / 2, x - ctx.canvas.width / 2) : p.angle;
    const tx = x - Math.cos(angle) * tail, ty = y - Math.sin(angle) * tail;
    const grad = ctx.createLinearGradient(tx, ty, x, y);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(1, color.fill || '#ffffff');
    ctx.save();
    ctx.globalAlpha = brightness;
    ctx.lineCap = 'round';
    ctx.strokeStyle = grad;
    ctx.lineWidth = Math.max(0.5, p.size * scale * 1.5);
    ctx.shadowColor = color.glow || color.fill || '#ffffff';
    ctx.shadowBlur = Math.max(0, Number(cfg.cometGlow) || 16) * scale;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(x, y); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x, y, Math.max(0.7, p.size * scale), 0, Math.PI * 2); ctx.fill();
    p.dustParticles.forEach(d => {
        ctx.globalAlpha = brightness * Math.max(0, d.life / d.maxLife) * 0.75;
        ctx.fillStyle = color.fill || '#ffffff';
        ctx.beginPath(); ctx.arc(d.x, d.y, d.size * scale, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
}

function paintCometMountains(ctx, state, cfg) {
    state.mountains.forEach((layer) => {
        ctx.save();
        ctx.globalAlpha = layer.opacity;
        ctx.fillStyle = layer.color;
        ctx.beginPath();
        ctx.moveTo(0, ctx.canvas.height);
        layer.points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(ctx.canvas.width, ctx.canvas.height);
        ctx.closePath(); ctx.fill();
        ctx.restore();
    });
}
