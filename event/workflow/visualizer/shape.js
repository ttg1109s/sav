/**
 * event/workflow/visualizer/shape.js — Group "shape" (canvas 2D, 2 style: rubik / clock).
 *
 * [TÁCH — 28/09/2026, Phase 4 dọn visualizer] Từ `_tickRubik()`/`_tickClock()` của event/workflow/visualizer-render.js
 * cũ + các biến `_clock*` (nay là trạng thái riêng của group). Hành vi mỗi frame giữ nguyên; rẽ nhánh -> guard +
 * object map (readme/event-bus-flow.md mục 7). Resize: dựng lại 27 khối Rubik (thay phần tương ứng của
 * resizeCanvas() cũ).
 * SỬA (28/09/2026, Giang) — clock: bỏ vòng Time scan (chỉ còn toggle con lắc), vạch phút sáng/phóng theo kim giây
 * thay vì theo phổ, thêm ảnh nền mặt số (bìa bài hoặc ảnh thư viện, độ đục chỉnh được).
 */

/** Cỡ phổ VẼ của group (01/10/2026: group tự khai báo, host xin qua audioAnalysis.requireSpectrum()). */
const SHAPE_FFT_SIZE = 256;

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

/** Cách tải ảnh nền mặt số theo loại nguồn ('lib' = ảnh thư viện theo key, 'cover' = URL bìa bài đang phát). */
const CLOCK_BG_LOAD_BY_KIND = {
    lib: (imageKey, token) => workflowVizShape._loadClockBgFromLibrary(imageKey, token),
    cover: (url, token) => workflowVizShape._loadClockBgImage(url, token),
};

const workflowVizShape = {
    defaultStyle: 'rubik',
    /** Cỡ phổ VẼ style cần — host gọi khi kích hoạt style để xin qua audioAnalysis.requireSpectrum() (01/10/2026). */
    spectrumSize() { return SHAPE_FFT_SIZE; },

    /** Trạng thái style clock (KHÔNG thuộc STATE) — trước đây là các biến `_clock*` cấp module. `tickGlow` = mức 60
     * vạch phút vừa được kim giây quét (28/09/2026, thay vạch theo phổ). */
    _clock: { drive: null, lastTime: 0, geomKey: '', layout: null, outlines: null, pitch: null, pendulum: null, tickGlow: new Float32Array(60) },

    /** Ảnh nền mặt số (28/09/2026): `sourceId` = nguồn đang dùng ('lib:<key>' | 'cover:<url>' | ''), `image` = ảnh đã
     * tải xong (null khi chưa có/đang tải), `objectUrl` = URL tự tạo từ blob thư viện (phải revoke khi đổi nguồn). */
    _clockBg: { sourceId: '', image: null, objectUrl: null, loadToken: 0 },

    styles: {
        rubik: (frame) => workflowVizShape._drawRubik(frame),
        clock: (frame) => workflowVizShape._drawClock(frame),
    },

    onResize() {
        appState.set('rubikCubes', buildRubikCubes()); // core/canvas-scene-setup.js
        console.log('writer: "workflowVizShape.onResize", page: "rubikCubes", content: "27 khối"');
    },

    // ===================== rubik =====================

    _drawRubik(frame) {
        const { ctx, canvas, cfg, dpr, isPlaying } = frame;
        const smoothedEnergy = frame.audio.smoothedEnergy(); // service/audio-analysis.js
        const beatScale = frame.audio.beatScale(); // service/audio-analysis.js
        const vizDataArray = frame.audio.spectrum(SHAPE_FFT_SIZE); // service/audio-analysis.js
        const currentMidi = frame.audio.pitchMidi();
        const rubikPitchAvg = frame.audio.pitchAverage(); // service/audio-analysis.js (01/10/2026, trước đây appState rubikPitchAvg)

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
            const colors = getComputedColor(c.rc.binIdx, 27, c.val); // core/visualizer/effect-paint.js
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
        const { ctx, canvas, cfg, dpr, isPlaying } = frame;
        const smoothedEnergy = frame.audio.smoothedEnergy(); // service/audio-analysis.js
        const beatScale = frame.audio.beatScale(); // service/audio-analysis.js
        const vizDataArray = frame.audio.spectrum(SHAPE_FFT_SIZE); // service/audio-analysis.js
        const analyser = frame.audio.spectrumAnalyser(SHAPE_FFT_SIZE); // service/audio-analysis.js
        const clock = this._clock;
        const W = canvas.width, H = canvas.height;
        const dialR = (Math.min(W, H) / 2) * (cfg.clockSizeRatio || 0.8) / 1.18;
        this._ensureClockGeometry(dialR);
        const now = performance.now();
        const dt = computeFrameDeltaMs(now, clock.lastTime); // core/visualizer/frame-clock.js
        clock.lastTime = now;
        const caseVisible = cfg.clockCaseVisible !== false;
        const glowPx = CLOCK_GLOW_PX * dpr * frame.perf.blurMult;

        const bpm = frame.audio.bpmOr(0); // service/audio-analysis.js — chưa đo -> 0 -> core dùng ×1
        const noteFresh = frame.audio.isPitchFresh(CLOCK_PITCH_FRESH_MS); // service/audio-analysis.js (01/10/2026)
        clock.pitch = advanceClockPitchHands(clock.pitch, dt, isPlaying, frame.audio.pitchMidi(), noteFresh, this._clockStartSec(), bpm); // core
        const totalSec = clock.pitch.virtualSec;
        const handsDir = clock.pitch.level / 2; // bánh răng + vòng quỹ đạo cùng chiều kim, bậc 1/7 = 1.5×
        const jam = clock.pitch.jam;

        clock.drive = advanceClockDrive(clock.drive, dt, isPlaying, beatScale, smoothedEnergy, cfg.clockGearSpeedBase, cfg.clockGearSpeedEnergyMult, handsDir, jam); // core
        const jitter = computeClockJamJitter(jam, now); // core
        const gearAngles = computeClockGearAngles(clock.layout.gears, clock.drive.masterAngle + jitter.gear); // core
        const levels = computeClockGearLevels(vizDataArray, clock.layout, isPlaying); // core
        const gearCount = clock.layout.gears.length;

        // SỬA (28/09/2026, Giang) — bỏ vòng Time scan: chỉ còn toggle con lắc (clockPendulumEnabled).
        clock.pendulum = advanceClockPendulum(clock.pendulum, dt, cfg.clockPendulumEnabled !== false, isPlaying, smoothedEnergy, jam); // core
        const caseR = dialR * (caseVisible ? 1.08 : 1.0);
        const pl = computeClockPendulumLayout(H, dialR, clock.pendulum.progress, caseVisible, caseR, 1, cfg.clockPendulumLength); // core
        const caseColor = getComputedColor(0, 1, 200); // core/visualizer/effect-paint.js
        const paint = { ctx, cfg, dpr, dialR, glowPx, caseColor, isPlaying, smoothedEnergy, beatScale };

        this._syncClockBackground(cfg);

        ctx.save();
        ctx.translate(W / 2, pl.cy);
        ctx.scale(pl.scale, pl.scale);

        this._paintClockBackdrop(paint);
        this._paintClockPendulum(paint, pl);

        ctx.save();
        clock.layout.gears.forEach((g, i) => {
            const color = getComputedColor(i, gearCount + 1, levels[i]); // core/visualizer/effect-paint.js
            paintClockGear(ctx, g, clock.outlines[i], gearAngles[i], color.fill, color.glow, glowPx, levels[i] / 255, dpr); // core
        });
        const balLevel = levels[gearCount] / 255;
        const swing = Math.sin(clock.drive.balancePhase) * (0.5 + (isPlaying ? smoothedEnergy : 0) * 1.6) + jitter.gear * 3;
        const escapeGear = clock.layout.gears.find((g) => g.ratchet);
        const balColor = getComputedColor(gearCount, gearCount + 1, levels[gearCount]); // core/visualizer/effect-paint.js
        paintClockBalance(ctx, clock.layout.balance, escapeGear, swing, balColor.fill, balColor.glow, glowPx, balLevel, dpr); // core

        const glassVisible = cfg.clockGlassVisible !== false;
        this._paintClockGlass(paint, glassVisible); // kính phủ kín bánh răng
        this._paintClockCase(paint, caseVisible);

        const handAngles = computeClockHandAngles(totalSec); // core
        handAngles.hour += jitter.hour; handAngles.minute += jitter.minute; handAngles.second += jitter.second;
        stepClockTickGlow(clock.tickGlow, handAngles.second, dt); // core — vạch kim giây vừa quét sáng/phóng, rồi thu về
        this._paintClockTicks(paint);
        paintClockHands(ctx, dialR, handAngles, caseColor.fill, caseColor.glow, CLOCK_SECOND_HAND_COLOR, glowPx, dpr); // core
        this._paintClockGlassGlare(paint, glassVisible); // vệt loá kính đè lên kim
        ctx.restore();

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

    _paintClockGlass(paint, glassVisible) {
        if (!glassVisible) return;
        paintClockGlass(paint.ctx, paint.dialR, paint.caseColor.glow); // core
    },

    _paintClockGlassGlare(paint, glassVisible) {
        if (!glassVisible) return;
        paintClockGlassGlare(paint.ctx, paint.dialR, paint.dpr); // core
    },

    /** 60 vạch phút (toggle clockTicksVisible) — SỬA 28/09/2026: sáng/phóng theo kim giây (tickGlow), không theo phổ.
     * Vẽ SAU kính + vỏ để vạch đang sáng không bị kính che. */
    _paintClockTicks(paint) {
        if (paint.cfg.clockTicksVisible === false) return;
        const glows = this._clock.tickGlow;
        const tickColors = Array.from(glows, (g, i) => getComputedColor(i, 60, 150 + g * 105)); // core/visualizer/effect-paint.js
        paintClockTicks(paint.ctx, paint.dialR, glows, tickColors, paint.glowPx, paint.dpr); // core
    },

    // ===================== clock — ảnh nền mặt số (MỚI 28/09/2026) =====================

    /** Lớp DƯỚI CÙNG của đồng hồ — chỉ khi bật và ảnh nguồn đã tải xong. */
    _paintClockBackdrop(paint) {
        const image = this._clockBg.image;
        if (paint.cfg.clockBgEnabled !== true || !image) return;
        paintClockBackground(paint.ctx, paint.dialR * 0.98, image, paint.cfg.clockBgOpacity); // core
    },

    /** Nguồn ảnh nền: ảnh thư viện đã chọn (clockBgImageKey) hoặc bìa bài đang phát. Nguồn đổi -> tải lại (bất đồng
     * bộ, frame chờ tải không vẽ nền). Tắt nền -> giữ nguyên ảnh đã tải (bật lại hiện ngay). */
    _syncClockBackground(cfg) {
        if (cfg.clockBgEnabled !== true) return;
        const sourceId = cfg.clockBgImageKey ? `lib:${cfg.clockBgImageKey}` : `cover:${appState.get('currentCoverObjectURL') || ''}`;
        if (sourceId === this._clockBg.sourceId) return;
        this._releaseClockBackground();
        this._clockBg.sourceId = sourceId;
        CLOCK_BG_LOAD_BY_KIND[sourceId.slice(0, sourceId.indexOf(':'))](sourceId.slice(sourceId.indexOf(':') + 1), ++this._clockBg.loadToken);
    },

    /** Bỏ ảnh cũ + revoke URL tự tạo (URL bìa thuộc player, không revoke). */
    _releaseClockBackground() {
        const bg = this._clockBg;
        bg.image = null;
        this._revokeClockBgUrl(bg.objectUrl);
        bg.objectUrl = null;
    },

    _revokeClockBgUrl(url) {
        if (!url) return;
        URL.revokeObjectURL(url);
    },

    /** Ảnh thư viện: đọc blob trong DB rồi tải. Ảnh đã bị xoá -> không có nền (giữ key, người dùng tự bỏ/chọn lại). */
    async _loadClockBgFromLibrary(imageKey, token) {
        const record = await getImageRecord(imageKey); // service/db.js
        if (!record || !record.blob || token !== this._clockBg.loadToken) return;
        const url = URL.createObjectURL(record.blob);
        this._clockBg.objectUrl = url;
        this._loadClockBgImage(url, token);
    },

    /** Tải 1 URL thành Image; chỉ nhận nếu nguồn chưa đổi trong lúc tải (token). URL rỗng (bài không bìa) -> không nền. */
    _loadClockBgImage(url, token) {
        if (!url) return;
        const img = new Image();
        img.onload = () => this._acceptClockBgImage(img, token);
        img.src = url;
    },

    _acceptClockBgImage(img, token) {
        if (token !== this._clockBg.loadToken) return;
        this._clockBg.image = img;
    },

    _paintClockCase(paint, caseVisible) {
        if (!caseVisible) return;
        paintClockCase(paint.ctx, paint.dialR, paint.caseColor.fill, paint.caseColor.glow, paint.glowPx, paint.isPlaying ? paint.beatScale : 0, paint.dpr); // core
    },
};

workflowVisualizerRender.registerGroup('shape', workflowVizShape);
