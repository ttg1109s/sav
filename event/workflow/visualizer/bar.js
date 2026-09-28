/**
 * event/workflow/visualizer/bar.js — Group "bar" (canvas 2D, 4 style: mirror / cascade / black hole / dot).
 *
 * [TÁCH — 28/09/2026, Phase 4 dọn visualizer] Từ `_tickBar()`/`_tickBarDot()` của event/workflow/visualizer-render.js
 * cũ + các biến `_mirror*`/`_dot*` (nay là trạng thái riêng của group này). Hành vi mỗi frame giữ nguyên; rẽ nhánh
 * -> guard + object map (readme/event-bus-flow.md mục 7). Resize (thay resizeCanvas() cũ): dựng lại sao Black Hole.
 */

/** Mirror: bật vạch đỉnh -> bước mô phỏng đỉnh; tắt -> bỏ trạng thái (bật lại khởi tạo từ mức hiện tại). */
const BAR_MIRROR_PEAKS_BY_ENABLED = {
    true: (levels, prevPeaks, dt) => stepBarMirrorPeaks(levels, prevPeaks, dt), // core
    false: () => null,
};

/** Dot: hình trục nền theo chế độ di chuyển (rắn bò hay hình tĩnh). */
const BAR_DOT_BASE_BY_SNAKE = {
    true: (frame, dotCount, dt) => workflowVizBar._sampleSnakeBase(frame, dotCount, dt),
    false: (frame, dotCount) => workflowVizBar._sampleStaticBase(frame, dotCount),
};

/** Dot: rung dây (chỉ hình 'line', đứng yên, không DNA) — trả biên độ px; tắt thì dây về 0. */
const BAR_DOT_VIBRATION_BY_ON = {
    true: (frame, dt) => workflowVizBar._stepDotVibration(frame, dt),
    false: () => workflowVizBar._silenceDotVibration(),
};

/** Dot: vị trí y của 1 dot trên trục (cộng dao động dây khi đang rung). */
const BAR_DOT_Y_BY_VIBRATE = {
    true: (d, time, vibAmpPx) => d.y + computeDotLineDisplacement(d.u, workflowVizBar._dot.vibAmps, time, vibAmpPx), // core
    false: (d) => d.y,
};

/** Dot: phần tử vẽ của 1 dot — cặp DNA (2 dot + dây nối) hay 1 dot thường. */
const BAR_DOT_ITEMS_BY_DNA = {
    true: (ctx, items, d, i, y, dna) => workflowVizBar._pushDnaPairItems(ctx, items, d, i, dna),
    false: (ctx, items, d, i, y) => items.push({ i, x: d.x, y, z: 0, scale: 1, alpha: 1 }),
};

/** Dot: màu dot đang "phồng" — 2 màu (mode dynamic) nội suy dynA->dynB theo độ phồng, còn lại dùng màu chung. */
const BAR_DOT_IMPACT_COLOR_BY_TWO_COLOR = {
    true: (cfg, boost) => {
        const c = interpolateColor(cfg.dynA, cfg.dynB, Math.sqrt(Math.min(1, Math.max(0, boost)))); // core/color-utils.js
        return { fill: c, glow: c };
    },
    false: (cfg, boost, color) => color,
};

/** Dot: màu từng dot — SỬA (28/09/2026, Giang "mode màu thứ 3 hiển cả dải màu như các bar effect"): mode gradient
 * trải dải màu theo VỊ TRÍ dot (getComputedColor(i, dotCount, mức phồng) — cùng cách bar mirror/cascade tô), các mode
 * khác dùng 1 màu chung như cũ. */
const BAR_DOT_COLORS_BY_GRADIENT = {
    true: (dotCount, smoothed) => Array.from({ length: dotCount }, (_, i) => getComputedColor(i, dotCount, 128 + 127 * Math.min(1, smoothed[i]))), // core/audio-analysis.js
    false: (dotCount, smoothed, shared) => new Array(dotCount).fill(shared),
};

/** Dot: vẽ 1 dot — đang phồng (vượt DOT_IMPACT_MIN) hay ở trạng thái nghỉ. */
const BAR_DOT_PAINT_BY_IMPACT = {
    true: (p) => {
        const r = (p.mode === 'radius' ? p.baseRadius + p.boost * (p.maxRadius - p.baseRadius) * p.swell : p.baseRadius) * p.it.scale;
        const halfLen = p.mode === 'height' ? p.boost * p.maxHalf * p.it.scale : 0;
        const c = BAR_DOT_IMPACT_COLOR_BY_TWO_COLOR[p.isTwoColor](p.cfg, p.boost, p.colors[p.it.i]);
        paintDotAxisDot(p.ctx, p.d, p.it.x, p.it.y, p.mode, r, halfLen, p.bend, p.bendDeg, c.fill, c.glow, DOT_GLOW_BLUR_PX * p.boost * p.dpr * p.blurMult, p.it.alpha); // core
    },
    false: (p) => {
        const c = p.colors[p.it.i];
        paintDotAxisDot(p.ctx, p.d, p.it.x, p.it.y, 'radius', p.baseRadius * p.it.scale, 0, 'none', 0, c.fill, c.glow, 0, p.it.alpha); // core
    },
};

const workflowVizBar = {
    defaultStyle: 'mirror',

    _mirrorPeaks: null,
    _mirrorLastTime: 0,

    /** Trạng thái style dot (KHÔNG thuộc STATE) — trước đây là ~20 biến `_dot*` cấp module của visualizer-render.js. */
    _dot: {
        geom: null, geomKey: '',
        snake: null, snakeKey: '',
        clusters: [],
        smoothed: new Float32Array(0),
        energyPeak: 0, lastTime: 0, lastSeenBeatTime: 0,
        vibAmps: new Float32Array(DOT_VIB_SLOTS), // core/visualizer/groups/bar/dot.js (nạp trước file này)
        dnaLevels: new Float32Array(0), dnaBonds: new Float32Array(0),
        dnaBreakClock: 0, dnaRot: 0,
        baseKind: '', lastBase: null, blendFrom: null, blendStart: 0,
    },

    styles: {
        mirror: (frame) => workflowVizBar._drawMirror(frame),
        cascade: (frame) => workflowVizBar._drawCascade(frame),
        'black hole': (frame) => workflowVizBar._drawBlackHole(frame),
        dot: (frame) => workflowVizBar._drawDot(frame),
    },

    /** Khung nhìn đổi: rải lại sao + xoá chớp sao của Black Hole (thay phần tương ứng của resizeCanvas() cũ). */
    onResize(viewport) {
        appState.set('stars', buildBlackHoleStars(getEffectConfig('bar').starCount, Math.max(canvas.width, canvas.height), viewport.dpr)); // core/canvas-scene-setup.js + core/custom-effect.js
        appState.set('starFlashes', []);
        console.log('writer: "workflowVizBar.onResize", page: "starFlashes", content: "[]"');
    },

    // ===================== cascade =====================

    _drawCascade(frame) {
        const { ctx, canvas, cfg, dpr } = frame;
        const keys = computeBarCascadeFrame(cfg, canvas.width, canvas.height, dpr, frame.vizDataArray); // core
        keys.forEach((k) => {
            const color = getComputedColor(...k.colorArgs); // core/audio-analysis.js
            paintBarRects(ctx, [k.shadowRect, k.capRect], color.fill, color.glow, dpr, frame.perf.blurMult, 10); // core
        });
        ctx.shadowBlur = 0;
    },

    // ===================== black hole =====================

    _drawBlackHole(frame) {
        const { ctx, canvas, cfg, dpr } = frame;
        const centerX = canvas.width / 2, centerY = canvas.height / 2;
        const minDimension = Math.min(canvas.width, canvas.height);
        const maxDist = Math.max(canvas.width, canvas.height);

        const currentRadius = computeBlackHoleRadius(minDimension, frame.smoothedEnergy, frame.beatScale, cfg.radiusRatio, cfg.radiusEnergyMult); // core
        const currentSuction = cfg.suctionBase + (frame.isPlaying ? frame.smoothedEnergy * cfg.suctionEnergyMult : 0);

        this._paintBlackHoleFlare(frame, centerX, centerY, currentRadius);

        stepAndDrawBlackHoleStars(ctx, dpr, centerX, centerY, maxDist, currentRadius, currentSuction); // core
        advanceAndDrawBlackHoleFlashes(ctx, dpr, appState.get('starFlashes'), cfg.flashFadeSpeed); // core

        // SỬA (28/09/2026, Giang) — số cột theo bán kính NỀN hố đen (ô 15px/cột — cột rộng nhất chỉ chạm mép), cột bo góc đỉnh.
        const layout = computeBlackHoleBarLayout(minDimension * cfg.radiusRatio, dpr, frame.bufferLength); // core
        const dynamicMaxBarHeight = (cfg.maxH / 1000) * (minDimension * 0.25);
        const bars = computeBlackHoleBarsFrame(frame.vizDataArray, layout.usefulLength, layout.spanBins, cfg.minH, dpr, dynamicMaxBarHeight); // core
        bars.forEach((b) => {
            const color = getComputedColor(...b.colorArgs); // core/audio-analysis.js
            paintBlackHoleBarShapes(ctx, b.angles, b.height, centerX, centerY, currentRadius, cfg.barWidth, cfg.barTopRadius, color.fill, color.glow, dpr, frame.perf.blurMult); // core
        });
        ctx.shadowBlur = 0;

        paintBlackHoleCore(ctx, centerX, centerY, currentRadius); // core
    },

    /** Quầng sáng quanh lỗ đen — chỉ khi đang phát và năng lượng vượt ngưỡng flare. */
    _paintBlackHoleFlare(frame, centerX, centerY, currentRadius) {
        const cfg = frame.cfg;
        if (!frame.isPlaying || frame.smoothedEnergy <= cfg.flareThreshold) return;
        const flareAlpha = (frame.smoothedEnergy - cfg.flareThreshold) * 2.5;
        paintBlackHoleFlare(frame.ctx, frame.canvas.width, frame.canvas.height, centerX, centerY, currentRadius, frame.hue, flareAlpha); // core
    },

    // ===================== mirror =====================

    _drawMirror(frame) {
        const { ctx, canvas, cfg, dpr, analyser } = frame;
        const time = performance.now();
        const dt = computeFrameDeltaMs(time, this._mirrorLastTime); // core/visualizer/frame-clock.js
        this._mirrorLastTime = time;
        const barCount = resolveBarMirrorCount(cfg); // core
        const rawLevels = computeBarMirrorLevels(frame.vizDataArray, analyser.frequencyBinCount, analyser.context.sampleRate, analyser.minDecibels, analyser.maxDecibels, barCount, cfg.mirrorTilt); // core
        const levels = spreadBarMirrorLevels(rawLevels, cfg.mirrorSmoothSpread); // core
        this._mirrorPeaks = BAR_MIRROR_PEAKS_BY_ENABLED[cfg.mirrorPeaks !== false](levels, this._mirrorPeaks, dt);
        const peaks = this._mirrorPeaks ? this._mirrorPeaks.vals : null;
        const mirrorFrame = computeBarMirrorFrame(cfg, canvas.width, canvas.height, dpr, levels, peaks); // core
        mirrorFrame.bars.forEach((b) => {
            const color = getComputedColor(...b.colorArgs); // core/audio-analysis.js
            paintBarRects(ctx, b.rects, color.fill, color.glow, dpr, frame.perf.blurMult, 15); // core
        });
        ctx.shadowBlur = 0;
    },

    // ===================== dot =====================

    _drawDot(frame) {
        const { ctx, canvas, cfg, dpr } = frame;
        const dot = this._dot;
        const time = performance.now();
        const dt = computeFrameDeltaMs(time, dot.lastTime); // core/visualizer/frame-clock.js
        dot.lastTime = time;

        const dotCount = Math.max(2, Math.round(cfg.dotCount || 40));
        this._ensureDotBuffers(dotCount);

        const moving = cfg.dotMoving === true;
        const dnaOn = moving && cfg.dotMoveType === 'dna';
        const snakeOn = moving && !dnaOn;
        const base = BAR_DOT_BASE_BY_SNAKE[snakeOn](frame, dotCount, dt);
        this._startDotBlendOnKindChange(snakeOn ? 'snake' : 'static', time);
        const dots = this._applyDotBlend(base.dots, time);
        dot.lastBase = dots;

        dot.dnaBreakClock = dnaOn ? 0 : dot.dnaBreakClock + dt;
        const dnaMax = stepDotDnaPairs(dot.dnaLevels, dot.dnaBonds, dt, dnaOn, dot.dnaBreakClock); // core
        this._advanceDnaRotation(frame, dnaMax, dt);

        dot.energyPeak = computeDotEnergyPeak(dot.energyPeak, frame.smoothedEnergy, dt); // core
        const isOnset = frame.isPlaying && frame.lastBeatTime && frame.lastBeatTime !== dot.lastSeenBeatTime;
        dot.lastSeenBeatTime = frame.lastBeatTime || dot.lastSeenBeatTime;
        dot.clusters = stepDotClusters(dot.clusters, time, this._buildDotSpawn(frame, isOnset), dotCount); // core
        const clusterEnergies = dot.clusters.map((cl) => {
            const arr = [];
            for (let k = 0; k < cl.clusterSize; k++) arr.push(computeBinRangePeak(frame.vizDataArray, tonotopicBinRange(k, cl.clusterSize, frame.bufferLength)) / 255); // core/visualizer/groups/connector/synapse.js
            return arr;
        });
        const targets = computeDotTargetBoosts(dot.clusters, clusterEnergies, time, dotCount); // core
        smoothDotBoosts(dot.smoothed, targets); // core

        const vibrate = !moving && dnaMax <= 0 && base.shape === 'line' && cfg.dotLineVibrate !== false; // DNA còn dở (đang nhập lại) thì chưa rung
        const vibAmpPx = BAR_DOT_VIBRATION_BY_ON[vibrate](frame, dt);

        const color = getComputedColor(0, 1, 128); // core/audio-analysis.js
        const colors = BAR_DOT_COLORS_BY_GRADIENT[cfg.mode === 'gradient'](dotCount, dot.smoothed, color);
        const mode = cfg.dotImpactMode === 'height' ? 'height' : 'radius';
        const paint = {
            ctx, cfg, dpr, colors, mode,
            isTwoColor: cfg.mode === 'dynamic',
            baseRadius: base.baseRadius, maxRadius: base.maxRadius,
            swell: (isFinite(cfg.dotSwell) ? cfg.dotSwell : 100) / 100,
            maxHalf: (cfg.maxH || 400) * dpr * 0.5, // cùng quy ước bar mirror (maxH × dpr × 0.5 mỗi bên)
            bend: mode === 'height' ? (cfg.dotBend || 'none') : 'none',
            bendDeg: isFinite(cfg.dotBendAngle) ? cfg.dotBendAngle : 35,
            blurMult: frame.perf.blurMult,
        };
        const dna = { max: dnaMax, radius: Math.min(canvas.width, canvas.height) * DOT_DNA_RADIUS_FRAC, colors, dpr };
        const items = [];
        for (let i = 0; i < dotCount; i++) {
            const d = dots[i];
            const y = BAR_DOT_Y_BY_VIBRATE[vibrate](d, time, vibAmpPx);
            BAR_DOT_ITEMS_BY_DNA[dnaMax > 0 && dot.dnaLevels[i] > 0](ctx, items, d, i, y, dna);
        }
        for (let pass = 0; pass < 2; pass++) {
            for (let k = 0; k < items.length; k++) {
                const it = items[k];
                if ((pass === 0) !== (it.z < 0)) continue;
                const boost = dot.smoothed[it.i];
                BAR_DOT_PAINT_BY_IMPACT[boost > DOT_IMPACT_MIN]({ ...paint, it, d: dots[it.i], boost });
            }
        }
        ctx.shadowBlur = 0;
        ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; // paintDotAxisDot() mode 'height' đặt round — trả về mặc định canvas
    },

    /** Đổi số dot -> cấp phát lại mọi mảng theo dot + bỏ cụm/blend dở dang. */
    _ensureDotBuffers(dotCount) {
        const dot = this._dot;
        if (dot.smoothed.length === dotCount) return;
        dot.smoothed = new Float32Array(dotCount); dot.clusters = [];
        dot.dnaLevels = new Float32Array(dotCount); dot.dnaBonds = new Float32Array(dotCount);
        dot.lastBase = null; dot.blendFrom = null;
    },

    /** Rắn bò (toggle dotMoving): dựng lại khi đổi kích thước canvas, đồng bộ khoảng cách khi đổi số dot, bò khi
     * đang phát. */
    _sampleSnakeBase(frame, dotCount, dt) {
        const dot = this._dot;
        const { canvas } = frame;
        this._ensureDotSnake(canvas, dotCount);
        this._syncDotSnakeSpacing(canvas.width * (1 - 2 * DOT_AXIS_MARGIN_X_FRAC) / (dotCount - 1));
        this._stepDotSnake(frame, dotCount, dt);
        return { dots: sampleDotSnakeBody(dot.snake, dotCount), baseRadius: dot.snake.baseRadius, maxRadius: dot.snake.maxRadius, shape: 'snake' }; // core
    },

    _ensureDotSnake(canvas, dotCount) {
        const dot = this._dot;
        const snakeKey = [canvas.width, canvas.height].join('|');
        if (dot.snake && snakeKey === dot.snakeKey) return;
        dot.snakeKey = snakeKey;
        dot.snake = initDotSnake(canvas.width, canvas.height, dotCount); // core
    },

    _syncDotSnakeSpacing(expectSpacing) {
        const dot = this._dot;
        if (Math.abs(expectSpacing - dot.snake.spacing) <= 1e-6) return;
        dot.snake = { ...dot.snake, spacing: expectSpacing, baseRadius: expectSpacing * DOT_BASE_RADIUS_FRAC, maxRadius: expectSpacing * DOT_MAX_RADIUS_FRAC };
    },

    _stepDotSnake(frame, dotCount, dt) {
        if (!frame.isPlaying) return;
        this._dot.snake = stepDotSnake(this._dot.snake, dt / 1000, frame.smoothedEnergy, dotCount); // core
    },

    /** Hình trục tĩnh — dựng lại khi đổi kích thước canvas/hình/số dot. */
    _sampleStaticBase(frame, dotCount) {
        const dot = this._dot;
        const { canvas, cfg } = frame;
        this._ensureDotGeometry([canvas.width, canvas.height, cfg.dotShape, dotCount].join('|'), cfg.dotShape, canvas, dotCount);
        return { dots: dot.geom.dots, baseRadius: dot.geom.baseRadius, maxRadius: dot.geom.maxRadius, shape: dot.geom.shape };
    },

    _ensureDotGeometry(geomKey, shape, canvas, dotCount) {
        const dot = this._dot;
        if (geomKey === dot.geomKey) return;
        dot.geomKey = geomKey;
        dot.geom = buildDotAxisGeometry(shape, canvas.width, canvas.height, dotCount); // core
    },

    /** Vừa đổi giữa rắn bò <-> hình tĩnh -> bắt đầu chuyển mượt từ vị trí cuối của kiểu cũ. */
    _startDotBlendOnKindChange(baseKind, time) {
        const dot = this._dot;
        const changed = dot.baseKind && baseKind !== dot.baseKind && dot.lastBase;
        dot.baseKind = baseKind;
        if (!changed) return;
        dot.blendFrom = dot.lastBase;
        dot.blendStart = time;
    },

    /** Đang chuyển mượt -> nội suy vị trí; hết thời gian chuyển thì thôi. */
    _applyDotBlend(dots, time) {
        const dot = this._dot;
        if (!dot.blendFrom) return dots;
        const blendT = (time - dot.blendStart) / DOT_BASE_BLEND_MS;
        const blended = blendDotPositions(dot.blendFrom, dots, blendT); // core
        dot.blendFrom = blendT >= 1 ? null : dot.blendFrom;
        return blended;
    },

    /** Xoắn DNA quay khi đang phát và còn cặp DNA hiện. */
    _advanceDnaRotation(frame, dnaMax, dt) {
        if (!frame.isPlaying || dnaMax <= 0) return;
        const energy = isFinite(frame.smoothedEnergy) ? frame.smoothedEnergy : 0;
        this._dot.dnaRot = (this._dot.dnaRot + (dt / 1000) * (DOT_DNA_ROT_SPEED + energy * DOT_DNA_ROT_ENERGY)) % (Math.PI * 2);
    },

    /** Beat THẬT mới -> 1 cụm sóng mới (quãng đường theo năng lượng chuẩn hoá, cỡ cụm theo pitch); không thì null. */
    _buildDotSpawn(frame, isOnset) {
        if (!isOnset) return null;
        return {
            normEnergy: (isFinite(frame.smoothedEnergy) ? frame.smoothedEnergy : 0) / Math.max(this._dot.energyPeak, 0.05),
            clusterSize: pitchToDotClusterSize(frame.midiNote), // core
        };
    },

    _stepDotVibration(frame, dt) {
        const { lastValidNoteTime, audioContext } = appState.get(['lastValidNoteTime', 'audioContext']);
        const noteFresh = frame.isPlaying && isPitchNoteFresh(frame.midiNote, lastValidNoteTime, Date.now(), DOT_NOTE_FRESH_MS); // core/audio-analysis.js
        const midi = noteFresh ? frame.midiNote : null;
        const noteEnergy = computeDotNoteEnergy(midi, frame.vizDataArray, frame.bufferLength, audioContext ? audioContext.sampleRate : 44100); // core
        stepDotLineVibration(this._dot.vibAmps, dt, midi, noteEnergy); // core
        return Math.min(frame.canvas.width, frame.canvas.height) * DOT_VIB_AMP_FRAC;
    },

    _silenceDotVibration() {
        this._dot.vibAmps.fill(0);
        return 0;
    },

    /** Cặp DNA: vẽ dây nối trước, rồi thêm 2 dot (trước/sau theo chiều sâu) vào danh sách vẽ. */
    _pushDnaPairItems(ctx, items, d, i, dna) {
        const dot = this._dot;
        const pair = computeDotDnaPair(d, i, dot.dnaLevels[i], dot.dnaRot, dna.radius); // core
        paintDotDnaBond(ctx, pair.ax, pair.ay, pair.bx, pair.by, dot.dnaBonds[i], dna.colors[i].fill, dna.dpr); // core
        const da = computeDotDnaDepth(pair.az, pair.sep), db = computeDotDnaDepth(pair.bz, pair.sep); // core
        items.push({ i, x: pair.ax, y: pair.ay, z: pair.az * pair.sep, scale: da.scale, alpha: da.alpha });
        items.push({ i, x: pair.bx, y: pair.by, z: pair.bz * pair.sep, scale: db.scale, alpha: db.alpha * pair.appear });
    },
};

workflowVisualizerRender.registerGroup('bar', workflowVizBar);
