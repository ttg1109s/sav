/**
 * event/workflow/visualizer/lighting.js — Group "lighting" (canvas 2D, 2 style: thunder / fireworks).
 *
 * [TÁCH — 28/09/2026, Phase 4 dọn visualizer] Từ `_tickLighting*()` + `_fw*()` của event/workflow/visualizer-render.js
 * cũ + các biến `_fw*` (nay là trạng thái riêng của group). Hành vi mỗi frame giữ nguyên; beat flux của Finale
 * dùng cửa sổ chung; rẽ nhánh -> guard + object map (readme/event-bus-flow.md mục 7). Resize: xoá tia sét đang
 * hiện (thay phần tương ứng của resizeCanvas() cũ).
 */

const FIREWORKS_SIZE_BIN_MIN = 2;
const FIREWORKS_SIZE_BIN_MAX = 40;
const FIREWORKS_FINALE_ROCKET_COUNT = 10;

/** Pháo thăng thiên: tới đỉnh -> nổ thành hạt; chưa tới -> tiếp tục bay. */
const FIREWORKS_ROCKET_STEP_BY_ARRIVED = {
    true: (rocket, step) => workflowVizLighting._explodeRocket(rocket, step),
    false: (rocket, step) => step.remainingRockets.push(rocket),
};

/** Trạng thái hạt sau 1 bước (updateFireworksParticle()): tách -> sinh hạt con; còn sống -> giữ; 'dead' -> bỏ. */
const FIREWORKS_PARTICLE_BY_STATUS = {
    split: (particle, survivors) => {
        const splitParticles = workflowVizLighting._materializeSpecs(splitFireworksParticle(particle)); // core — trả SPEC thuần
        survivors.push(...applyFireworksDepth(splitParticles, particle.depthAlpha)); // core
    },
    alive: (particle, survivors) => survivors.push(particle),
};

/** Màu 1 spec hạt: màu cố định có sẵn hay tra color mode theo colorArgs. */
const FIREWORKS_SPEC_COLOR_BY_FIXED = {
    true: (spec) => spec.fixedColor,
    false: (spec) => getComputedColor(...spec.colorArgs).fill, // core/visualizer/effect-paint.js
};

/** Tuỳ chọn hạt: có màu đích (hiệu ứng "ghost" đổi màu giữa vòng đời) hay giữ nguyên. */
const FIREWORKS_SPEC_OPTIONS_BY_TARGET = {
    true: (spec) => ({ ...spec.options, targetColor: getComputedColor(...spec.targetColorArgs).fill }), // core
    false: (spec) => spec.options,
};

const workflowVizLighting = {
    defaultStyle: 'thunder',

    _fwFlashAlpha: 0,
    _fwLastLaunchAt: 0,
    _fwTextIndex: 0,
    _fwNextBinIndex: 0,
    /** Cửa sổ beat flux của Finale (riêng, không dùng chung với Vortex/Circle). */
    _finaleWin: createBeatFluxWindow(), // core/visualizer/beat-window.js

    styles: {
        thunder: (frame) => workflowVizLighting._drawThunder(frame),
        fireworks: (frame) => workflowVizLighting._drawFireworks(frame),
    },

    onResize() {
        appState.set('activeLightnings', []);
        console.log('writer: "workflowVizLighting.onResize", page: "activeLightnings", content: "[]"');
    },

    // ===================== thunder =====================

    _drawThunder(frame) {
        const { ctx, canvas, cfg, isPlaying, smoothedEnergy, vizDataArray } = frame;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'miter';

        const energySpike = computeLightningEnergySpike(smoothedEnergy, vizDataArray); // core
        const flashAlpha = computeScreenFlashAlpha(cfg.flashEnabled, isPlaying, energySpike, cfg.flashThreshold, cfg.flashMaxOpacity); // core
        drawScreenFlash(ctx, canvas.width, canvas.height, flashAlpha); // core/visualizer/draw

        this._spawnBolt(frame, energySpike);

        const survivors = [];
        appState.get('activeLightnings').forEach((bolt) => {
            if (!advanceLightningBolt(bolt, cfg.boltFadeSpeed, smoothedEnergy)) return; // core — tắt hẳn -> bỏ
            drawLightningBolt(ctx, bolt, frame.dpr, frame.perf.blurMult); // core
            survivors.push(bolt);
        });
        appState.set('activeLightnings', survivors, { skipCheck: true });
    },

    _spawnBolt(frame, energySpike) {
        const cfg = frame.cfg;
        if (!shouldSpawnLightningBolt(frame.isPlaying, energySpike, cfg.boltThreshold, cfg.boltSpawnChance, appState.get('activeLightnings').length, cfg.maxBoltCount)) return; // core
        const color = getComputedColor(Math.floor(Math.random() * 10), 10, 255); // core/visualizer/effect-paint.js
        const bolt = createLightningBolt(frame.canvas.width, frame.canvas.height, frame.dpr, cfg.boltHorizontalDeviation, cfg.boltSegmentLength, color); // core
        appState.mutate('activeLightnings', (arr) => arr.push(bolt), { skipCheck: true });
    },

    // ===================== fireworks =====================

    _drawFireworks(frame) {
        const { ctx, canvas, cfg, dpr, isPlaying, beatScale, vizDataArray } = frame;

        this._autoLaunch(frame);
        this._updateFinaleTrigger(frame);

        const { fwRockets, fwParticles } = appState.get(['fwRockets', 'fwParticles']);
        const step = {
            frame,
            spectrumBin: (vizDataArray && vizDataArray.length > 0) ? vizDataArray[Math.floor(Math.random() * Math.min(32, vizDataArray.length))] : 0,
            remainingRockets: [],
            burstParticles: [],
            flashTarget: 0,
        };
        fwRockets.forEach((rocket) => {
            advanceFireworksRocket(rocket); // core
            FIREWORKS_ROCKET_STEP_BY_ARRIVED[hasFireworksRocketArrived(rocket)](rocket, step); // core
        });

        this._fwFlashAlpha = Math.max(step.flashTarget, this._fwFlashAlpha * 0.85);
        drawScreenFlash(ctx, canvas.width, canvas.height, this._fwFlashAlpha); // core/visualizer/draw

        step.remainingRockets.forEach((rocket) => drawFireworksRocket(ctx, rocket, dpr)); // core
        appState.set('fwRockets', step.remainingRockets, { skipCheck: true });

        const survivors = [];
        fwParticles.concat(step.burstParticles).forEach((particle) => {
            (FIREWORKS_PARTICLE_BY_STATUS[updateFireworksParticle(particle)] || VIZ_NOOP)(particle, survivors); // core
        });
        // SỬA (28/09/2026, Giang "pháo hoa loại bỏ custom blur/glow") — hạt vẽ KHÔNG glow (blurMult = 0); Drawer ẩn khối
        // Blur ở style này (CUSTOM_EFFECT_NO_BLUR_STYLES, core/custom-effect.js).
        survivors.forEach((particle) => drawFireworksParticle(ctx, particle, 0, dpr)); // core
        appState.set('fwParticles', survivors, { skipCheck: true });
    },

    /** Pháo tới đỉnh: nổ theo kiểu của nó, cỡ theo biên độ dải tần + beat lúc phóng, góp vào chớp màn hình. */
    _explodeRocket(rocket, step) {
        const { cfg, isPlaying, beatScale, vizDataArray } = step.frame;
        const binValue01 = (vizDataArray && vizDataArray[rocket.binIndex] !== undefined) ? vizDataArray[rocket.binIndex] / 255 : 0;
        const sizeScale = computeFireworksSizeScale(binValue01, rocket.launchBeatScale); // core
        const power = computeFireworksBurstPower(cfg.burstPower, beatScale) * sizeScale; // core
        const exploder = FIREWORKS_EXPLODERS[rocket.style] || FIREWORKS_EXPLODERS.chrysanthemum; // core
        const count = Math.max(8, Math.round(cfg.particleCount * rocket.depthScale * sizeScale));
        const burstSpecs = exploder(rocket.x, rocket.y, count, power, cfg.gravity, step.spectrumBin); // core — trả SPEC thuần
        const burst = this._materializeSpecs(burstSpecs);
        const scaled = applyFireworksSizeScale(applyFireworksDepth(burst, rocket.depthScale), sizeScale); // core
        step.burstParticles = step.burstParticles.concat(scaled);
        step.flashTarget = Math.max(step.flashTarget, computeScreenFlashAlpha(cfg.flashEnabled, isPlaying, beatScale, cfg.flashThreshold, cfg.flashMaxOpacity) * rocket.depthScale); // core — 3 field chớp dùng chung thunder + rain
    },

    /** Tự phóng theo nhịp BPM/mật độ/năng lượng, tối đa maxConcurrentRockets pháo cùng lúc. */
    _autoLaunch(frame) {
        const cfg = frame.cfg;
        const bpm = frame.audio.bpmOr(120); // service/audio-analysis.js (01/10/2026)
        const intervalMs = computeFireworksAutoLaunchIntervalMs(bpm, cfg.autoLaunchDensity, frame.smoothedEnergy, frame.isPlaying); // core
        const now = performance.now();
        if (now - this._fwLastLaunchAt < intervalMs) return;
        if (appState.get('fwRockets').length >= cfg.maxConcurrentRockets) return;
        this._fwLastLaunchAt = now;
        this._launchOne(cfg, frame.beatScale);
    },

    /** Vật chất hoá SPEC (core trả về) thành hạt thật: resolve màu + màu đích theo color mode. */
    _materializeSpecs(specs) {
        return specs.map((spec) => {
            const color = FIREWORKS_SPEC_COLOR_BY_FIXED[spec.fixedColor !== undefined](spec);
            const options = FIREWORKS_SPEC_OPTIONS_BY_TARGET[!!spec.targetColorArgs](spec);
            return createFireworksParticle(spec.x, spec.y, color, options); // core
        });
    },

    _launchOne(cfg, beatScale) {
        const enabledStyles = resolveEnabledFireworksStyles(cfg.enabledStyles); // core
        const style = pickRandomFireworksStyle(enabledStyles); // core
        const depthScale = 0.4 + Math.random() * 0.6;
        const yMin = canvas.height * 0.15;
        const yMax = canvas.height * (0.25 + depthScale * 0.3);
        const targetY = yMin + Math.random() * (yMax - yMin);
        const targetX = Math.random() * (canvas.width * 0.8) + canvas.width * 0.1;
        const rawStartX = targetX + (Math.random() - 0.5) * canvas.width * 0.35;
        const startX = Math.min(canvas.width * 0.95, Math.max(canvas.width * 0.05, rawStartX));
        const color = getComputedColor(0, 1, 0).fill; // core/visualizer/effect-paint.js
        const binRange = FIREWORKS_SIZE_BIN_MAX - FIREWORKS_SIZE_BIN_MIN;
        this._fwNextBinIndex = FIREWORKS_SIZE_BIN_MIN + ((this._fwNextBinIndex - FIREWORKS_SIZE_BIN_MIN + 7) % binRange);
        const rocket = createFireworksRocket(startX, canvas.height, targetX, targetY, style, color, depthScale, this._fwNextBinIndex, beatScale || 0); // core
        appState.mutate('fwRockets', (arr) => arr.push(rocket), { skipCheck: true });
    },

    /** Finale khi nhạc chuyển đoạn (toggle finaleEnabled) — cửa sổ beat flux riêng. */
    _updateFinaleTrigger(frame) {
        const cfg = frame.cfg;
        const win = this._finaleWin;
        workflowVizBeatWindow.accumulateLatest(win, frame.audio.fluxHistory()); // service/audio-analysis.js (01/10/2026)
        if (!workflowVizBeatWindow.consumeNewBeat(win, frame.lastBeatTime)) return;
        workflowVizBeatWindow.closeInterval(win);
        if (!frame.isPlaying || !cfg.finaleEnabled) return;
        if (!detectMusicTransition(win.history, 2, cfg.sectionWindowBeats, cfg.fluxThreshold)) return; // core (audio-analysis.js)
        this._fireFinale(cfg, frame.beatScale);
    },

    /** Loạt pháo + chữ tuỳ chỉnh kế tiếp (nếu có). */
    _fireFinale(cfg, beatScale) {
        for (let i = 0; i < FIREWORKS_FINALE_ROCKET_COUNT; i++) {
            if (appState.get('fwRockets').length >= cfg.maxConcurrentRockets) break;
            this._launchOne(cfg, beatScale);
        }
        const picked = pickNextFireworksText(cfg.customTexts, this._fwTextIndex); // core
        if (!picked) return;
        this._fwTextIndex = picked.nextIndex;
        const points = buildFireworksTextPoints(picked.text); // core
        const textSpecs = explodeFireworksText(canvas.width / 2, canvas.height * 0.35, points, cfg.burstPower, 0); // core — trả SPEC thuần
        const particles = this._materializeSpecs(textSpecs);
        appState.mutate('fwParticles', (arr) => { particles.forEach((p) => arr.push(p)); }, { skipCheck: true });
    },
};

workflowVisualizerRender.registerGroup('lighting', workflowVizLighting);
