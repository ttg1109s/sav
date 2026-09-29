/**
 * event/workflow/visualizer/bar.js — Group "bar" (canvas 2D, 4 style: mirror / cascade / black hole / dot).
 *
 * [TÁCH — 28/09/2026, Phase 4 dọn visualizer] Từ `_tickBar()`/`_tickBarDot()` của event/workflow/visualizer-render.js
 * cũ + các biến `_mirror*`/`_dot*` (nay là trạng thái riêng của group này). Hành vi mỗi frame giữ nguyên; rẽ nhánh
 * -> guard + object map (readme/event-bus-flow.md mục 7). Resize (thay resizeCanvas() cũ): dựng lại sao Black Hole; onNewMedia: dọn tia Hawking.
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

    /** Khung nhìn đổi: rải lại sao Black Hole (thay phần tương ứng của resizeCanvas() cũ). SỬA (29/09/2026) — chớp sao
     * (`starFlashes`) đã bỏ hẳn. Lớp glow tự dựng lại theo kích thước ở frame kế. */
    onResize(viewport) {
        appState.set('stars', buildBlackHoleStars(getEffectConfig('bar').starCount, Math.max(canvas.width, canvas.height), viewport.dpr)); // core/canvas-scene-setup.js + core/custom-effect.js
        console.log('writer: "workflowVizBar.onResize", page: "stars", content: "rải lại sao Black Hole"');
    },

    /** MỚI (29/09/2026) — đổi bài/video: dọn tia bức xạ Hawking còn đang bay (trạng thái riêng, không thuộc STATE). */
    onNewMedia() {
        this._blackHole.bursts = [];
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
    // CẢI TIẾN (29/09/2026, Giang duyệt) — xem docblock core/visualizer/groups/bar/black-hole.js: envelope cột + mọi bước
    // theo dt, flare/tia theo Color mode, glow qua lớp phụ, sao vệt cong (màu gốc), tia bức xạ Hawking; bỏ chớp sao.
    // Mức cột HOÀN NGUYÊN ánh xạ cũ (FFT 256, 35% phổ) — bỏ dải LOG qua core mirror (Giang: lộn xộn).
    // Thứ tự lớp: flare -> sao -> tia Hawking -> glow cột -> cột -> tâm (tia nằm SAU vòng cột).

    /** Trạng thái Black Hole (KHÔNG thuộc STATE): bán kính nền đã mượt (thay biến global `smoothedBeatRadius` cũ ở
     * core/dom-refs.js), đếm cột (bán kính đầu cột giữ đỉnh, số cột nửa vòng, cao trung bình frame trước, khoá config +
     * số frame bám ngay), envelope mức từng dải, tia Hawking đang bay + mức bass trung bình tại beat + cửa sổ beat riêng,
     * lớp glow. */
    _blackHole: {
        baseRadius: 0, refRadius: 0, halfCount: 0, meanHeight: 0, lastTime: 0, configKey: '', snapFrames: 0,
        levels: new Float32Array(0),
        bursts: [], beatAvg: 0, beatWin: createBeatFluxWindow(), // core/visualizer/beat-window.js (nạp trước file này)
        glow: null,
    },

    _drawBlackHole(frame) {
        const { ctx, canvas, cfg } = frame;
        const bh = this._blackHole;
        const centerX = canvas.width / 2, centerY = canvas.height / 2;
        const minDimension = Math.min(canvas.width, canvas.height);
        const maxDist = Math.max(canvas.width, canvas.height);
        const now = performance.now();
        const dt = computeFrameDeltaMs(now, bh.lastTime); // core/visualizer/frame-clock.js
        bh.lastTime = now;

        const targetRadius = computeBlackHoleTargetRadius(minDimension, frame.smoothedEnergy, cfg.radiusRatio, cfg.radiusEnergyMult); // core
        bh.baseRadius = smoothBlackHoleBaseRadius(bh.baseRadius, targetRadius, dt); // core
        const currentRadius = computeBlackHoleBeatRadius(bh.baseRadius, frame.beatScale, minDimension); // core
        const currentSuction = cfg.suctionBase + (frame.isPlaying ? frame.smoothedEnergy * cfg.suctionEnergyMult : 0);

        this._paintBlackHoleFlare(frame, centerX, centerY, currentRadius);
        this._drawBlackHoleStars(frame, centerX, centerY, maxDist, currentRadius, currentSuction, dt);
        this._drawBlackHoleBursts(frame, centerX, centerY, currentRadius, dt);
        this._drawBlackHoleRing(frame, centerX, centerY, minDimension, currentRadius, dt);
        paintBlackHoleCore(ctx, centerX, centerY, currentRadius); // core
    },

    /** Quầng sáng quanh lỗ đen — chỉ khi đang phát và năng lượng vượt ngưỡng flare; màu theo Color mode. */
    _paintBlackHoleFlare(frame, centerX, centerY, currentRadius) {
        const cfg = frame.cfg;
        if (!frame.isPlaying || frame.smoothedEnergy <= cfg.flareThreshold) return;
        const flareAlpha = (frame.smoothedEnergy - cfg.flareThreshold) * 2.5;
        const rgb = resolveBlackHoleRgb(frame.ctx, getComputedColor(0, 1, Math.round(frame.smoothedEnergy * 255)).glow); // core + core/audio-analysis.js
        paintBlackHoleFlare(frame.ctx, frame.canvas.width, frame.canvas.height, centerX, centerY, currentRadius, rgb, flareAlpha); // core
    },

    /** Sao: bước vật lý theo dt rồi vẽ (chấm sao màu gốc + vệt cong dọc quỹ đạo). */
    _drawBlackHoleStars(frame, centerX, centerY, maxDist, currentRadius, currentSuction, dt) {
        stepBlackHoleStars(maxDist, currentRadius, currentSuction, dt / BLACK_HOLE_FRAME_MS); // core
        drawBlackHoleStarStreaks(frame.ctx, appState.get('stars'), centerX, centerY, maxDist, currentRadius, frame.dpr); // core
    },

    /** Tia bức xạ Hawking: bắn tia mới nếu có beat mạnh, già đi theo dt, đổi hình tia chớp định kỳ, vẽ. */
    _drawBlackHoleBursts(frame, centerX, centerY, currentRadius, dt) {
        const bh = this._blackHole;
        this._spawnBlackHoleBurst(frame);
        bh.bursts = stepBlackHoleBursts(bh.bursts, dt); // core
        if (bh.bursts.length === 0) return;
        const rgb = resolveBlackHoleRgb(frame.ctx, getComputedColor(0, 1, 200).glow); // core + core/audio-analysis.js
        bh.bursts.forEach((burst) => {
            this._renewBlackHoleBolt(burst);
            paintBlackHoleBurst(frame.ctx, burst, centerX, centerY, currentRadius, frame.canvas.width, frame.dpr, rgb); // core
        });
    },

    /** Beat MỚI (cửa sổ riêng của Black Hole — tiêu thụ trước để beat cũ lúc tạm dừng không bắn khi phát lại) + đang
     * phát + nổi hơn mặt bằng các beat gần đây (so TRƯỚC khi cập nhật mặt bằng) + chưa đủ số tia tối đa -> thêm 1 tia. */
    _spawnBlackHoleBurst(frame) {
        const bh = this._blackHole;
        if (!workflowVizBeatWindow.consumeNewBeat(bh.beatWin, frame.lastBeatTime)) return;
        if (!frame.isPlaying) return;
        const isStrong = isBlackHoleBurstBeat(frame.beatScale, bh.beatAvg); // core
        bh.beatAvg = updateBlackHoleBeatAverage(bh.beatAvg, frame.beatScale); // core
        if (!isStrong) return;
        if (bh.bursts.length >= BLACK_HOLE_BURST_MAX) return;
        bh.bursts.push(createBlackHoleBurst(frame.beatScale)); // core
    },

    /** Đổi hình tia chớp khi đã tới hạn (nhấp nháy). */
    _renewBlackHoleBolt(burst) {
        if (!isBlackHoleBoltStale(burst)) return; // core
        renewBlackHoleBolt(burst); // core
    },

    /** Vòng cột: số cột nửa vòng (theo chu vi đầu cột) -> mức theo ánh xạ cũ -> envelope theo dt -> cột -> glow (lớp phụ)
     * -> tô theo chiều kim đồng hồ + khép vòng. */
    _drawBlackHoleRing(frame, centerX, centerY, minDimension, currentRadius, dt) {
        const { ctx, cfg, dpr } = frame;
        const bh = this._blackHole;
        const layout = computeBlackHoleBarLayout(this._resolveBlackHoleHalfCount(cfg, currentRadius, dpr, dt), frame.bufferLength); // core
        const targetLevels = computeBlackHoleBarLevels(frame.vizDataArray, layout.usefulLength, layout.spanBins); // core
        bh.levels = stepBlackHoleBarEnvelope(resampleBlackHoleLevels(bh.levels, layout.usefulLength), targetLevels, dt); // core
        const dynamicMaxBarHeight = (cfg.maxH / 1000) * (minDimension * 0.25);
        const bars = computeBlackHoleBarsFrame(bh.levels, cfg.minH, dpr, dynamicMaxBarHeight); // core
        bh.meanHeight = computeBlackHoleMeanBarHeight(bars); // core — frame sau đếm cột theo đầu cột
        // Cột tô màu ĐẶC (fillNoAlpha) để cột trên che hẳn cột dưới (29/09/2026).
        const colors = bars.map((b) => {
            const c = getComputedColor(...b.colorArgs); // core/audio-analysis.js
            return { fill: c.fillNoAlpha, glow: c.glow };
        });
        const entries = orderBlackHoleBarsClockwise(bars, colors); // core
        this._paintBlackHoleBarGlow(frame, entries, centerX, centerY, currentRadius);
        entries.forEach((e) => paintBlackHoleBar(ctx, e, e.fill, centerX, centerY, currentRadius, cfg.barWidth, cfg.barTopRadius, dpr)); // core
        this._closeBlackHoleSeam(ctx, entries, centerX, centerY, currentRadius, cfg, dpr);
    },

    /** Số cột nửa vòng theo bán kính ĐẦU CỘT (hố đen + cao trung bình) — giữ đỉnh khi phát; đổi bán kính/chiều cao trong
     * Custom Effect thì bám NGAY (bỏ giữ đỉnh + ngưỡng trễ vài frame) thay vì chờ nhả chậm. */
    _resolveBlackHoleHalfCount(cfg, currentRadius, dpr, dt) {
        const bh = this._blackHole;
        this._snapBlackHoleCountOnConfigChange([cfg.radiusRatio, cfg.radiusEnergyMult, cfg.maxH, cfg.minH].join('|'));
        const snapping = bh.snapFrames > 0;
        bh.snapFrames = Math.max(0, bh.snapFrames - 1);
        bh.refRadius = smoothBlackHoleBarRadius(bh.refRadius, currentRadius + bh.meanHeight, snapping ? Infinity : dt); // core — Infinity = bám ngay
        bh.halfCount = resolveBlackHoleBarHalfCount(snapping ? 0 : bh.halfCount, bh.refRadius, dpr); // core
        return bh.halfCount;
    },

    /** Config kích thước hố đen/cột vừa đổi -> bám ngay trong vài frame (chiều cao trung bình cần 1-2 frame để cập nhật). */
    _snapBlackHoleCountOnConfigChange(configKey) {
        const bh = this._blackHole;
        if (configKey === bh.configKey) return;
        bh.configKey = configKey;
        bh.snapFrames = 6;
    },

    /** Glow cột (thay shadowBlur từng cột): vẽ cột màu glow vào lớp phụ thu nhỏ rồi phóng lên sau lưng vòng cột — chỉ khi
     * Blur của Custom Effect đang bật; độ mạnh = cường độ blur. */
    _paintBlackHoleBarGlow(frame, entries, centerX, centerY, currentRadius) {
        const blurMult = frame.perf.blurMult;
        if (!(blurMult > 0)) return;
        const layers = this._ensureBlackHoleGlowLayers(frame);
        beginBlackHoleGlowPass(layers); // core
        entries.forEach((e) => paintBlackHoleBar(layers.near.ctx, e, e.glow, centerX, centerY, currentRadius, frame.cfg.barWidth, frame.cfg.barTopRadius, frame.dpr)); // core
        paintBlackHoleGlowLayers(frame.ctx, layers, frame.canvas.width, frame.canvas.height, blurMult); // core
    },

    /** Lớp glow khớp kích thước canvas hiện tại — dựng lại khi canvas/dpr đổi. */
    _ensureBlackHoleGlowLayers(frame) {
        const bh = this._blackHole;
        const key = computeBlackHoleGlowKey(frame.canvas.width, frame.canvas.height, frame.dpr); // core
        if (bh.glow && bh.glow.key === key) return bh.glow;
        bh.glow = createBlackHoleGlowLayers(frame.canvas.width, frame.canvas.height, frame.dpr); // core
        return bh.glow;
    },

    /** Khép vòng: vẽ lại cột đầu tiên, chỉ trong nửa phía cột vẽ cuối, để nó đè lên cột đó (đúng luật "bị cột kế tiếp che"). */
    _closeBlackHoleSeam(ctx, entries, centerX, centerY, radius, cfg, dpr) {
        if (entries.length < 2) return;
        const first = entries[0];
        beginBlackHoleSeamClip(ctx, first, centerX, centerY, radius, Math.max(...entries.map((e) => e.height))); // core
        paintBlackHoleBar(ctx, first, first.fill, centerX, centerY, radius, cfg.barWidth, cfg.barTopRadius, dpr); // core
        endBlackHoleSeamClip(ctx); // core
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
