/**
 * event/workflow/visualizer/shape.js — Group "shape" (canvas 2D, 2 style: rubik / clock).
 *
 * [TÁCH — 28/09/2026, Phase 4 dọn visualizer] Từ `_tickRubik()`/`_tickClock()` của event/workflow/visualizer-render.js
 * cũ + các biến `_clock*` (nay là trạng thái riêng của group). Hành vi mỗi frame giữ nguyên; rẽ nhánh -> guard +
 * object map (readme/event-bus-flow.md mục 7). Resize: dựng lại 27 khối Rubik (thay phần tương ứng của
 * resizeCanvas() cũ).
 */

const CLOCK_SECOND_HAND_COLOR = '#e0283f';
const CLOCK_GLOW_PX = 14;
const CLOCK_PENDULUM_GHOST_LAG = 0.09; // rad pha giữa 2 dây ma liên tiếp (bóng mờ dây con lắc)
const CLOCK_PITCH_FRESH_MS = 300; // cùng ngưỡng "nốt đang phát" với circuit/brain/dot

/** Xoay 1 điểm quanh đúng 1 trục (x/y/z) — trục lạ/không có (khối không đang xoay lớp) giữ nguyên điểm. */
const RUBIK_ROTATE_BY_AXIS = {
    x: (pos, angle) => rotate3D(pos, angle, 0, 0), // core/rubik-math.js
    y: (pos, angle) => rotate3D(pos, 0, angle, 0), // core/rubik-math.js
    z: (pos, angle) => rotate3D(pos, 0, 0, angle), // core/rubik-math.js
};
const RUBIK_KEEP_POS = (pos) => pos;

/** Đỉnh khối: khối thuộc lớp đang xoay (rubikAnim) -> xoay quanh tâm khối theo góc hiện tại; không -> giữ nguyên. */
const RUBIK_VERTEX_BY_LAYER_TURN = {
    true: (vertPos, c) => {
        const currentRot = rubikAnim.angle * rubikAnim.dir;
        const local = { x: vertPos.x - c.pos.x, y: vertPos.y - c.pos.y, z: vertPos.z - c.pos.z };
        const turned = (RUBIK_ROTATE_BY_AXIS[rubikAnim.axis] || RUBIK_KEEP_POS)(local, currentRot);
        return { x: turned.x + c.pos.x, y: turned.y + c.pos.y, z: turned.z + c.pos.z };
    },
    false: (vertPos) => vertPos,
};

/** Bóng mờ dây con lắc (toggle clockPendulumTrail) — 6 bóng lùi pha dần, tắt thì không có. */
const CLOCK_GHOST_SWINGS_BY_TRAIL = {
    true: (swingAt, phase) => [1, 2, 3, 4, 5, 6].map((g) => swingAt(phase - g * CLOCK_PENDULUM_GHOST_LAG)),
    false: () => [],
};

const workflowVizShape = {
    defaultStyle: 'rubik',

    /** Trạng thái style clock (KHÔNG thuộc STATE) — trước đây là các biến `_clock*` cấp module. */
    _clock: { drive: null, lastTime: 0, geomKey: '', layout: null, outlines: null, pitch: null, pendulum: null, rings: null },

    styles: {
        rubik: (frame) => workflowVizShape._drawRubik(frame),
        clock: (frame) => workflowVizShape._drawClock(frame),
    },

    onResize() {
        initRubik(); // core/canvas-scene-setup.js (di sản)
    },

    // ===================== rubik =====================

    _drawRubik(frame) {
        const { ctx, canvas, cfg, dpr, isPlaying, smoothedEnergy, beatScale, vizDataArray } = frame;
        const currentMidi = frame.midiNote;
        const rubikPitchAvg = appState.get('rubikPitchAvg');

        advanceRubikSelfSpin(isPlaying, currentMidi, rubikPitchAvg, smoothedEnergy, cfg.pitchSensitivity); // core
        maybeTriggerRubikLayerTurn(isPlaying, smoothedEnergy, currentMidi, cfg.rotationEnergyThreshold, rubikPitchAvg); // core
        this._commitRubikTurn(advanceRubikLayerTurnProgress(cfg.layerTurnSpeed, smoothedEnergy)); // core

        const cubeSize = Math.min(canvas.width, canvas.height) * cfg.cubeSizeRatio;
        const spacing = cubeSize * 1.05;
        const viewDist = cubeSize * 25;
        const fov = cubeSize * 18;
        const centerX = canvas.width / 2, centerY = canvas.height / 2;

        const drawnCubes = appState.get('rubikCubes').map((rc) => {
            const val = vizDataArray[rc.binIdx * 4] || 0;
            const base = computeRubikCubeBase(rc, val, isPlaying, beatScale, cubeSize, spacing); // core
            const pos = (RUBIK_ROTATE_BY_AXIS[base.turnRotAxis] || RUBIK_KEEP_POS)(base.pos, base.turnRotAngle);
            const cCenter = rotate3D(pos, rubikRotX, rubikRotY, 0); // core/rubik-math.js
            return { rc, centerZ: cCenter.z, val, pos, scale: base.scale };
        });

        drawnCubes.sort((a, b) => b.centerZ - a.centerZ);
        drawnCubes.forEach((c) => {
            const colors = getComputedColor(c.rc.binIdx, 27, c.val); // core/audio-analysis.js
            const inTurningLayer = rubikAnim.active && c.rc['c' + rubikAnim.axis] === rubikAnim.layer;
            const projVerts = RUBIK_UNIT_VERTICES.map((uv) => {
                const vertPos = RUBIK_VERTEX_BY_LAYER_TURN[inTurningLayer](computeRubikVertexLocalPos(c.pos, uv, cubeSize, c.scale), c); // core
                const rotV = rotate3D(vertPos, rubikRotX, rubikRotY, 0); // core/rubik-math.js
                return project3D(rotV, fov, viewDist, centerX, centerY); // core/rubik-math.js
            });
            paintRubikCubeFaces(ctx, projVerts, colors.fill, dpr); // core
            this._paintRubikGlow(ctx, projVerts, colors.glow, dpr, c.val);
        });
    },

    /** Vừa xoay xong 1 lớp -> cập nhật chỉ số khối. */
    _commitRubikTurn(completedTurn) {
        if (!completedTurn) return;
        rotateRubikIndices(completedTurn.axis, completedTurn.layer, completedTurn.dir); // core/rubik-math.js
    },

    _paintRubikGlow(ctx, projVerts, glow, dpr, val) {
        if (val <= 140) return;
        paintRubikCubeGlow(ctx, projVerts, glow, dpr); // core
    },

    // ===================== clock =====================

    _drawClock(frame) {
        const { ctx, canvas, cfg, dpr, isPlaying, smoothedEnergy, beatScale, vizDataArray, analyser } = frame;
        const clock = this._clock;
        const W = canvas.width, H = canvas.height;
        const dialR = (Math.min(W, H) / 2) * (cfg.clockSizeRatio || 0.8) / 1.18;
        this._ensureClockGeometry(dialR);
        const now = performance.now();
        const dt = computeFrameDeltaMs(now, clock.lastTime); // core/visualizer/frame-clock.js
        clock.lastTime = now;
        const caseVisible = cfg.clockCaseVisible !== false;
        const glowPx = CLOCK_GLOW_PX * dpr * frame.perf.blurMult;

        const { lastValidNoteTime, currentCalculatedBpm } = appState.get(['lastValidNoteTime', 'currentCalculatedBpm']);
        const bpm = parseFloat(currentCalculatedBpm) || 0; // '---' (chưa đo) -> 0 -> core dùng ×1
        const noteFresh = isPitchNoteFresh(frame.midiNote, lastValidNoteTime, Date.now(), CLOCK_PITCH_FRESH_MS); // core/audio-analysis.js
        clock.pitch = advanceClockPitchHands(clock.pitch, dt, isPlaying, frame.midiNote, noteFresh, this._clockStartSec(), bpm); // core
        const totalSec = clock.pitch.virtualSec;
        const handsDir = clock.pitch.level / 2; // bánh răng + vòng quỹ đạo cùng chiều kim, bậc 1/7 = 1.5×
        const jam = clock.pitch.jam;

        clock.drive = advanceClockDrive(clock.drive, dt, isPlaying, beatScale, smoothedEnergy, cfg.clockGearSpeedBase, cfg.clockGearSpeedEnergyMult, handsDir, jam); // core
        const jitter = computeClockJamJitter(jam, now); // core
        const gearAngles = computeClockGearAngles(clock.layout.gears, clock.drive.masterAngle + jitter.gear); // core
        const levels = computeClockGearLevels(vizDataArray, clock.layout, isPlaying); // core
        const gearCount = clock.layout.gears.length;

        const accessory = cfg.clockAccessory || 'rings';
        const ringsOn = accessory === 'rings' && (!clock.pendulum || clock.pendulum.progress === 0);
        const pendulumOn = accessory === 'pendulum' && (!clock.rings || clock.rings.reveal === 0);
        const ringBandLevels = computeClockOrbitRingLevels(vizDataArray, analyser.frequencyBinCount, isPlaying); // core
        clock.rings = advanceClockOrbitRings(clock.rings, dt, ringsOn, handsDir, isPlaying, ringBandLevels); // core
        clock.pendulum = advanceClockPendulum(clock.pendulum, dt, pendulumOn, isPlaying, smoothedEnergy, jam); // core
        const ringE = clock.rings.reveal;
        const caseR = dialR * (caseVisible ? 1.08 : 1.0);
        const ringWidthPx = Math.max(1, Math.min(6, cfg.clockRingWidth || 3)) * dpr;
        const ringRadiusMul = Math.max(1.1, Math.min(2.2, (cfg.clockRingRadius || 170) / 100));
        const ringBgOpacity = Math.max(0, Math.min(0.5, cfg.clockRingBgOpacity || 0));
        const orbitFit = computeClockOrbitFitScale(dialR, Math.min(W, H) / 2, ringWidthPx / 2, ringRadiusMul); // core
        const topExtR = caseR + (orbitFit.outerR - caseR) * ringE;
        const baseScale = 1 + (orbitFit.scale - 1) * ringE;
        const pl = computeClockPendulumLayout(H, dialR, clock.pendulum.progress, caseVisible, topExtR, baseScale, cfg.clockPendulumLength); // core
        const caseColor = getComputedColor(0, 1, 200); // core/audio-analysis.js
        const paint = { ctx, cfg, dpr, dialR, glowPx, caseColor, isPlaying, smoothedEnergy, beatScale };

        ctx.save();
        ctx.translate(W / 2, pl.cy);
        ctx.scale(pl.scale, pl.scale);

        this._paintClockPendulum(paint, pl);
        const rings = { ringE, colors: this._clockRingColors(paint, ringE), lineW: ringWidthPx / pl.scale, radiusMul: ringRadiusMul, bgOpacity: ringBgOpacity }; // px màn hình -> px cục bộ (ctx đang scale cả cụm)
        this._paintClockRings(paint, rings, false); // nửa sau

        ctx.save();
        clock.layout.gears.forEach((g, i) => {
            const color = getComputedColor(i, gearCount + 1, levels[i]); // core/audio-analysis.js
            paintClockGear(ctx, g, clock.outlines[i], gearAngles[i], color.fill, color.glow, glowPx, levels[i] / 255, dpr); // core
        });
        const balLevel = levels[gearCount] / 255;
        const swing = Math.sin(clock.drive.balancePhase) * (0.5 + (isPlaying ? smoothedEnergy : 0) * 1.6) + jitter.gear * 3;
        const escapeGear = clock.layout.gears.find((g) => g.ratchet);
        const balColor = getComputedColor(gearCount, gearCount + 1, levels[gearCount]); // core/audio-analysis.js
        paintClockBalance(ctx, clock.layout.balance, escapeGear, swing, balColor.fill, balColor.glow, glowPx, balLevel, dpr); // core

        const glassVisible = cfg.clockGlassVisible !== false;
        this._paintClockGlass(paint, glassVisible); // kính phủ kín bánh răng
        this._paintClockTicks(paint, frame);
        this._paintClockCase(paint, caseVisible);

        const handAngles = computeClockHandAngles(totalSec); // core
        handAngles.hour += jitter.hour; handAngles.minute += jitter.minute; handAngles.second += jitter.second;
        paintClockHands(ctx, dialR, handAngles, caseColor.fill, caseColor.glow, CLOCK_SECOND_HAND_COLOR, glowPx, dpr); // core
        this._paintClockGlassGlare(paint, glassVisible); // vệt loá kính đè lên kim
        ctx.restore();
        this._paintClockRings(paint, rings, true); // nửa trước

        ctx.restore();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    },

    /** Bánh răng dựng lại khi bán kính mặt số đổi (đổi kích thước canvas / clockSizeRatio). */
    _ensureClockGeometry(dialR) {
        const clock = this._clock;
        const geomKey = dialR.toFixed(1);
        if (geomKey === clock.geomKey) return;
        clock.geomKey = geomKey;
        clock.layout = computeClockGearLayout(dialR); // core
        clock.outlines = clock.layout.gears.map((g) => buildClockGearOutline(g.z, g.r, g.m, g.ratchet)); // core
    },

    /** Mốc giây khởi đầu của kim "Past & Future": frame đầu tiên lấy giờ thật, sau đó core tự tích phân (0). */
    _clockStartSec() {
        if (this._clock.pitch) return 0;
        const d = new Date();
        return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds() + d.getMilliseconds() / 1000;
    },

    /** Con lắc (accessory 'pendulum') — chỉ vẽ khi đã trồi ra (progress > 0). */
    _paintClockPendulum(paint, pl) {
        const pendulum = this._clock.pendulum;
        if (pendulum.progress <= 0) return;
        const swingAt = (ph) => Math.sin(ph) * pendulum.amp * pl.reveal;
        const ghostSwings = CLOCK_GHOST_SWINGS_BY_TRAIL[paint.cfg.clockPendulumTrail !== false](swingAt, pendulum.phase);
        paintClockPendulum(paint.ctx, pl.pivotY, pl.length, pl.bobR, swingAt(pendulum.phase), pl.reveal, paint.caseColor.fill, paint.caseColor.glow, paint.glowPx, paint.dpr, ghostSwings); // core
    },

    /** Màu 4 vòng quỹ đạo — chỉ tính khi vòng đang hiện. */
    _clockRingColors(paint, ringE) {
        if (ringE <= 0) return null;
        return this._clock.rings.rings.map((r, k, all) => getComputedColor(k, all.length, 170 + 85 * (paint.isPlaying ? paint.smoothedEnergy : 0))); // core/audio-analysis.js
    },

    /** 1 nửa (sau/trước) của vòng quỹ đạo — chỉ khi vòng đang hiện. */
    _paintClockRings(paint, rings, isFrontHalf) {
        if (rings.ringE <= 0) return;
        paintClockOrbitRings(paint.ctx, paint.dialR, this._clock.rings, isFrontHalf, rings.colors, paint.glowPx, rings.lineW, paint.dpr, rings.radiusMul, rings.bgOpacity); // core
    },

    _paintClockGlass(paint, glassVisible) {
        if (!glassVisible) return;
        paintClockGlass(paint.ctx, paint.dialR, paint.caseColor.glow); // core
    },

    _paintClockGlassGlare(paint, glassVisible) {
        if (!glassVisible) return;
        paintClockGlassGlare(paint.ctx, paint.dialR, paint.dpr); // core
    },

    /** Vạch giờ = phổ (toggle clockTicksVisible). */
    _paintClockTicks(paint, frame) {
        if (paint.cfg.clockTicksVisible === false) return;
        const tickLevels = computeClockSpectrumTicks(frame.vizDataArray, frame.analyser.frequencyBinCount, frame.isPlaying, paint.cfg.clockTickGain); // core
        const tickColors = Array.from(tickLevels, (v, i) => getComputedColor(i, 60, v * 255)); // core/audio-analysis.js
        paintClockTicks(paint.ctx, paint.dialR, tickLevels, tickColors, paint.glowPx * 0.6, paint.dpr); // core
    },

    _paintClockCase(paint, caseVisible) {
        if (!caseVisible) return;
        paintClockCase(paint.ctx, paint.dialR, paint.caseColor.fill, paint.caseColor.glow, paint.glowPx, paint.isPlaying ? paint.beatScale : 0, paint.dpr); // core
    },
};

workflowVisualizerRender.registerGroup('shape', workflowVizShape);
