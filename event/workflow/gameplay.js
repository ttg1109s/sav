/**
 * event/workflow/gameplay.js — Workflow riêng mode "Circle": spawn wave theo lưới pitch→ô, vật lý wave, vẽ canvas, chấm tap,
 * tick() mỗi frame. Đếm ngược / modal Kết quả / lưu điểm dùng chung ở event/workflow/gameplay-engine.js.
 *
 * Lối vào: workflowGameplayEngine.startMode('circle') (tín hiệu 'gameplay.mediaChanged' khi game đang armed — gửi từ cả
 * workflowPlayer.playMedia() lẫn workflowVideoPlayer.playVideoByKey() — hoặc armGame() lúc đã có media). `gameplayPhase`
 * (idle -> ready -> countdown -> playing -> ended) tách biệt với `gameplayArmedGameId` (arm/disarm thuộc
 * event/workflow/game-catalog.js). tick() không có vòng rAF riêng — gọi từ vòng render chung (workflowGameplayEngine.
 * tickActiveMode()). Media luôn qua getActiveMediaElement() (core/player-controls.js) nên Song/Video cùng 1 đường (Photo không có Game);
 * pitch/BPM/energy của Video đúng vì graph Web Audio nối chung analyser.
 *
 * Spawn khoá theo BEAT thật: bộ theo dõi beat (`_beatTracker`, stepCircleBeatTracker()) so mốc beat mới nhất
 * (`audioAnalysis.lastBeatTime()`) với mốc đã dùng; đủ số beat theo độ khó + roll xác suất theo energy mới spawn. Vị trí từ
 * bảng pitch→ô (`gameplayPitchCellMap`), thời gian co theo BPM chốt vào wave lúc spawn (co theo performance.now(), độc lập
 * currentTime). Lịch sử flux theo BEAT (trung bình flux mỗi frame giữa 2 beat) cho detectMusicTransition() — độc lập fps.
 * Mọi ngẫu nhiên `Math.random()` ở đây rồi truyền vào core.
 *
 * NẠP SAU: event/workflow/gameplay-engine.js, core/gameplay/{circle-mode,circle-mode-ui,engine,engine-ui}.js,
 * core/player-controls.js, core/visualizer/beat-window.js, core/color-utils.js, core/custom-effect.js,
 * service/audio-analysis.js, core/modal-choice-ui.js (escapeHtml), core/playlist/state.js (formatTime).
 */
const GAMEPLAY_MISS_SHATTER_COLOR = '#f87171'; // đỏ-400, khớp màu .gameplay-tier-popup--miss (assets/css/gameplay.css)
const GAMEPLAY_SHATTER_SHARD_COUNT = 8;
const GAMEPLAY_CIRCLE_POPUP_LABEL_BY_TIER = { perfect: 'PERFECT', excellent: 'EXCELLENT', good: 'GOOD', bad: 'BAD', miss: 'MISS' };

// Màu wave theo mode effect đang chạy (resolveEffectConfig(), core/custom-effect.js), chốt lúc spawn. Mode lạ -> solid.
const GAMEPLAY_CIRCLE_WAVE_COLORS_BY_EFFECT_MODE = {
    gradient: () => {
        const hueOffset = audioAnalysis.hueOffset(); // service/audio-analysis.js
        return { colorMain: computeCircleColorGradientMain(hueOffset), colorLight: computeCircleColorGradientLight(hueOffset) }; // core/gameplay/circle-mode.js
    },
    dynamic: (effectCfg, spawnIndex) => {
        const colorMain = computeCircleColorDynamic(effectCfg.dynA, effectCfg.dynB, spawnIndex); // core/gameplay/circle-mode.js
        return { colorMain, colorLight: interpolateColor(colorMain, '#ffffff', 0.5) }; // core/color-utils.js
    },
    solid: (effectCfg) => ({ colorMain: effectCfg.solidColor, colorLight: interpolateColor(effectCfg.solidColor, '#ffffff', 0.5) }), // core/color-utils.js
};

// 5 kiểu duyệt lưới cho bảng pitch→ô (planCirclePitchMapRebuild().patternIndex).
const GAMEPLAY_CIRCLE_TRAVERSAL_BY_PATTERN = [
    (cols, rows, flagA, flagB) => generateRowMajorOrder(cols, rows, flagA, flagB),
    (cols, rows, flagA, flagB) => generateColumnMajorOrder(cols, rows, flagA, flagB),
    (cols, rows, flagA, flagB) => generateBoustrophedonRowOrder(cols, rows, flagA, flagB),
    (cols, rows, flagA) => generateBoustrophedonColumnOrder(cols, rows, flagA),
    (cols, rows, flagA, flagB) => generateSpiralOrder(cols, rows, flagA, flagB),
];

// Đầu mỗi frame: bảng pitch→ô cần dựng lại (shouldRebuildCirclePitchMap()) -> dựng + chấm dứt chuỗi Hard; không -> giữ bảng.
const GAMEPLAY_CIRCLE_PITCH_MAP_BY_REBUILD = {
    true: (currentMap, refreshPending) => workflowGameplay._restartPitchMap(refreshPending),
    false: (currentMap) => currentMap,
};

const workflowGameplay = {
    _nextWaveId: 1,
    _nextSpawnIndex: 0,                // luân phiên màu A/B (effect dynamic), reset mỗi phiên
    _beatTracker: createCircleBeatTracker(0), // core/gameplay/circle-mode.js — đếm beat / lịch sử flux theo beat
    _hardChainLevel: 1,                // cấp chuỗi "sinh sản" (chỉ Hard), về 1 khi bảng sạch / refresh
    _hardChainQueue: [],               // pitch còn lại của chuỗi, nhả dần từng wave
    _hardChainLastSpawnAt: 0,          // mốc performance.now() lần nhả gần nhất (so với computeChainSpacingMs())
    _gridCols: 1, _gridRows: 1,        // lưới pitch→ô hiện hành (tính lại lúc resize / mở layer)
    _zoneOriginX: 0, _zoneOriginY: 0,  // góc trên-trái vùng spawn, px

    /** Mở layer rồi vào thẳng đếm ngược (độ khó chọn sẵn trên card Game Panel). Pha 'ready' chỉ là mốc chuyển tiếp. Đóng
     * Game Panel (đúng hành động nút X, idempotent — phòng lối vào 'gameplay.mediaChanged'), chặn player control đáy màn
     * (gỡ ở exitToPlaylist()), đưa media về đầu. */
    start(mode) {
        this._resetSessionCounters();
        appState.set('gameplayMode', mode, { skipCheck: true });
        console.log(`writer: "workflowGameplay.start", page: "gameplayMode", content: "${mode}"`);
        appState.set('gameplayPhase', 'ready', { skipCheck: true });
        console.log(`writer: "workflowGameplay.start", page: "gameplayPhase", content: "ready"`);

        workflowPlaceholderPanels.close(gamePanel); // event/workflow/placeholder-panels.js
        workflowGameplayEngine.rewindActiveMedia(); // event/workflow/gameplay-engine.js

        setGameplayLayerMode(gameplayLayer, 'circle'); // core/gameplay/engine-ui.js — hiện canvas/tap-surface, ẩn stage Arrow
        showGameplayLayer(gameplayLayer); // core/gameplay/engine-ui.js
        setPlayerControlsBlocked(true); // core/player-controls.js
        this._recomputeGridGeometry();

        this.startCountdown();
    },

    startCountdown() {
        appState.set('gameplayPhase', 'countdown', { skipCheck: true });
        console.log(`writer: "workflowGameplay.startCountdown", page: "gameplayPhase", content: "countdown"`);
        workflowGameplayEngine.startCountdown(() => this._beginPlaying());
    },

    /** Hết đếm ngược -> phát media thật; tick() spawn từ frame kế. Chốt mốc beat hiện tại để beat detect trước đó không bị
     * hiểu là "vừa có". */
    _beginPlaying() {
        appState.set('gameplayPhase', 'playing', { skipCheck: true });
        console.log(`writer: "workflowGameplay._beginPlaying", page: "gameplayPhase", content: "playing"`);
        resetCircleBeatTrackerCounters(this._beatTracker, audioAnalysis.lastBeatTime()); // core/gameplay/circle-mode.js + service/audio-analysis.js
        this._nextSpawnIndex = 0;
        workflowGameplayEngine.playActiveMedia(); // event/workflow/gameplay-engine.js
    },

    /** 'gameplay.tap.press' — chỉ tính khi đang 'playing' và media đang phát. @param {number} tapX @param {number} tapY - px
     * theo hệ toạ độ canvas. */
    handleTap(tapX, tapY) {
        const {
            gameplayPhase, isVideoPlayerMode,
            gameplayWaves, gameplayComboByTier, gameplayTotalScore, gameplayCircleCount, gameplayHitCounts,
        } = appState.get([
            'gameplayPhase', 'isVideoPlayerMode',
            'gameplayWaves', 'gameplayComboByTier', 'gameplayTotalScore', 'gameplayCircleCount', 'gameplayHitCounts',
        ]);
        if (gameplayPhase !== 'playing') return;
        if (getActiveMediaElement(isVideoPlayerMode).paused) return;
        if (gameplayWaves.length === 0) return;
        const now = performance.now();
        const cfg = GAMEPLAY_CIRCLE_CONFIG;

        // Đúng thứ tự gameplayWaves (xuất hiện sớm hơn đứng trước) = z-order trên -> dưới cho hit-test.
        const entries = gameplayWaves.map((w) => ({ id: w.id, x: w.x, y: w.y, radius: computeWaveRadius(w, now), colorMain: w.colorMain })); // core/gameplay/circle-mode.js
        const nearest = findTopmostNoteInTolerance(entries, tapX, tapY, cfg.tapHitTolerancePx); // core/gameplay/engine.js
        if (!nearest) return;

        const tier = classifyTapTier(nearest.radius, cfg); // core/gameplay/engine.js
        const tierName = tier ? tier.name : 'miss';
        const tierScore = tier ? tier.score : cfg.missScore;
        const { pointsGained, newComboByTier } = computeComboScoreGain(tierName, tierScore, gameplayComboByTier, cfg); // core/gameplay/engine.js
        const totals = computeScoreTotalsAfterResolve(gameplayTotalScore, gameplayCircleCount, gameplayHitCounts, tierName, pointsGained); // core/gameplay/engine.js

        appState.set('gameplayWaves', removeCircleWavesByIds(gameplayWaves, [nearest.id]), { skipCheck: true }); // core/gameplay/circle-mode.js
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayWaves", content: "remove ${nearest.id}"`);
        appState.set('gameplayComboByTier', newComboByTier, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayComboByTier", content: "${JSON.stringify(newComboByTier)}"`);
        appState.set('gameplayTotalScore', totals.totalScore, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayTotalScore", content: "+${pointsGained}"`);
        appState.set('gameplayCircleCount', totals.resolvedCount, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayCircleCount", content: "${totals.resolvedCount}"`);
        appState.set('gameplayHitCounts', totals.hitCounts, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayHitCounts", content: "${tierName}+1"`);

        // Combo (streak riêng của tier, 0 nếu tier không tính combo) hiện ngay trên popup; vỡ vụn màu đúng wave vừa tap.
        this._showResolveEffects(nearest.x, nearest.y, tierName, newComboByTier[tierName] || 0, nearest.colorMain);
    },

    /** Mỗi frame từ vòng render chung — hot path 60fps (object map + guard, không log; miễn Rule 4 cho set()). */
    tick(now) {
        const {
            gameplayPhase, isVideoPlayerMode,
            gameplayWaves, gameplayCircleCount, gameplayDifficulty, gameplayPitchCellMap,
            gameplayRefreshPending, gameplayTotalScore, gameplayHitCounts,
        } = appState.get([
            'gameplayPhase', 'isVideoPlayerMode',
            'gameplayWaves', 'gameplayCircleCount', 'gameplayDifficulty', 'gameplayPitchCellMap',
            'gameplayRefreshPending', 'gameplayTotalScore', 'gameplayHitCounts',
        ]);
        if (gameplayPhase !== 'playing') return;
        if (getActiveMediaElement(isVideoPlayerMode).paused) return;
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const diffCfg = cfg.difficulty[gameplayDifficulty];
        // BPM giữ dạng chữ ("---" khi chưa có) — core tự parseFloat + rơi về giá trị dự phòng.
        const bpmText = audioAnalysis.bpmText(); // service/audio-analysis.js

        // Bảng pitch→ô: dựng lần đầu, hoặc khi đang chờ refresh và bảng vừa sạch wave (không ép wave đang sống đổi chỗ).
        const justRebuilt = shouldRebuildCirclePitchMap(gameplayPitchCellMap.length, gameplayRefreshPending, gameplayWaves.length); // core/gameplay/circle-mode.js
        const activeMap = GAMEPLAY_CIRCLE_PITCH_MAP_BY_REBUILD[justRebuilt](gameplayPitchCellMap, gameplayRefreshPending);

        const isNewBeat = stepCircleBeatTracker(this._beatTracker, audioAnalysis.fluxHistory(), audioAnalysis.lastBeatTime()); // core/gameplay/circle-mode.js
        if (isNewBeat) this._handleNewBeat(now, cfg, diffCfg, activeMap, justRebuilt, gameplayRefreshPending, gameplayWaves.length, bpmText);

        // Nhả chuỗi "sinh sản" Hard — mỗi frame so mốc ms (đếm nguyên beat không biểu diễn được quãng 2/3 beat).
        const chainSpacingMs = computeChainSpacingMs(bpmText, diffCfg.spawnEligibleEveryNBeats, cfg); // core/gameplay/circle-mode.js
        if (isHardChainReleaseDue(diffCfg.chainReproductionEnabled, this._hardChainQueue.length, now, this._hardChainLastSpawnAt, chainSpacingMs)) this._spawnNextChainedWave(now, cfg, diffCfg, activeMap, bpmText); // core/gameplay/circle-mode.js

        // Vật lý wave: bán kính/opacity + tự miss, rồi vẽ.
        const waves = appState.get('gameplayWaves');
        const entries = waves.map((w) => {
            const radius = computeWaveRadius(w, now); // core/gameplay/circle-mode.js
            return { id: w.id, x: w.x, y: w.y, radius, opacity: computeWaveOpacity(radius, cfg), colorMain: w.colorMain, colorLight: w.colorLight }; // core
        });
        const frame = partitionCircleWaveEntries(entries, entries.map((e) => isWaveMissed(e.radius, cfg)), cfg.centerRadius); // core/gameplay/circle-mode.js
        if (frame.missed.length > 0) this._resolveMissedWaves(frame, waves, gameplayTotalScore, gameplayCircleCount, gameplayHitCounts, cfg);

        clearGameplayCanvas(gameplayCanvas); // core/gameplay/circle-mode-ui.js
        drawApproachRings(gameplayCanvas, frame.drawOrder); // core/gameplay/circle-mode-ui.js
        drawTargetCircles(gameplayCanvas, frame.targetCircles); // core/gameplay/circle-mode-ui.js
    },

    /** Có beat mới: xin refresh vị trí khi nhạc biến động / qua ranh giới phrase; đủ điều kiện + roll trúng -> spawn. `refreshPending`
     * và `liveWaveCount` là ảnh chụp đầu frame (refresh vừa xin ở beat này chưa chặn spawn của chính beat này). */
    _handleNewBeat(now, cfg, diffCfg, activeMap, justRebuilt, refreshPending, liveWaveCount, bpmText) {
        const tracker = this._beatTracker;
        const musicTransition = detectMusicTransition(tracker.beatFluxHistory, diffCfg.energyWindowBeats, diffCfg.sectionWindowBeats, diffCfg.fluxThreshold); // core/visualizer/beat-window.js
        const phraseBoundary = isPhraseBoundary(tracker.beatsSincePhraseRefresh, cfg.refreshBeatsForPhrase); // core/visualizer/beat-window.js
        if (shouldRequestCircleRefresh(justRebuilt, refreshPending, musicTransition, phraseBoundary)) this._requestPitchMapRefresh(); // core/gameplay/circle-mode.js

        const concurrentWaveCap = computeConcurrentWaveCap(diffCfg, Math.random()); // core/gameplay/circle-mode.js — Medium roll lại mỗi lần xét
        const eligibleBeat = isBeatEligibleForSpawn(tracker.beatsSinceEligible, diffCfg.spawnEligibleEveryNBeats); // core/gameplay/circle-mode.js
        if (!canConsiderCircleSpawn(refreshPending, liveWaveCount, concurrentWaveCap, this._hardChainQueue.length, eligibleBeat)) return; // core/gameplay/circle-mode.js
        tracker.beatsSinceEligible = 0;
        if (!isCircleSpawnRollHit(Math.random(), computeSpawnProbability(audioAnalysis.smoothedEnergy(), cfg))) return; // core/gameplay/circle-mode.js + service/audio-analysis.js
        this._trySpawnWave(now, cfg, diffCfg, activeMap, appState.get('gameplayWaves'), bpmText, audioAnalysis.pitchMidi());
        this._hardChainLastSpawnAt = now; // mốc tính quãng cho wave kế tiếp của chuỗi (nếu có)
    },

    /** Chờ refresh bảng pitch→ô (chặn spawn mới tới khi bảng sạch wave) + đếm lại ranh giới phrase. */
    _requestPitchMapRefresh() {
        appState.set('gameplayRefreshPending', true, { skipCheck: true });
        this._beatTracker.beatsSincePhraseRefresh = 0;
    },

    /** Dựng lại bảng pitch→ô (lần đầu / refresh) và chấm dứt chuỗi "sinh sản" Hard đang dở. @returns {Array} bảng mới */
    _restartPitchMap(refreshPending) {
        const map = this._rebuildPitchCellMap();
        if (refreshPending) appState.set('gameplayRefreshPending', false, { skipCheck: true });
        this._hardChainLevel = 1;
        this._hardChainQueue = [];
        this._hardChainLastSpawnAt = 0;
        return map;
    },

    /** Wave tự hết hạn trong frame: gỡ khỏi bảng, reset mọi combo, mỗi wave tính 1 lượt miss (`cfg.missScore`, cùng mức tap
     * trật), popup MISS + vỡ vụn đỏ. Tổng điểm/lượt là ảnh chụp đầu frame (frame không đổi chúng trước bước này). */
    _resolveMissedWaves(frame, waves, totalScore, circleCount, hitCounts, cfg) {
        const totals = computeScoreTotalsAfterMisses(totalScore, circleCount, hitCounts, frame.missedIds.length, cfg.missScore); // core/gameplay/engine.js
        appState.set('gameplayWaves', removeCircleWavesByIds(waves, frame.missedIds), { skipCheck: true }); // core/gameplay/circle-mode.js
        appState.set('gameplayComboByTier', { perfect: 0, excellent: 0 }, { skipCheck: true });
        appState.set('gameplayCircleCount', totals.resolvedCount, { skipCheck: true });
        appState.set('gameplayHitCounts', totals.hitCounts, { skipCheck: true });
        appState.set('gameplayTotalScore', totals.totalScore, { skipCheck: true });
        frame.missed.forEach((entry) => this._showResolveEffects(entry.x, entry.y, 'miss', 0, GAMEPLAY_MISS_SHATTER_COLOR));
    },

    /** Popup tier (kèm combo) + vỡ vụn tại (x,y). */
    _showResolveEffects(x, y, tierName, comboStreak, shatterColor) {
        showTapTierPopup(gameplayTierPopupLayer, GAMEPLAY_CIRCLE_POPUP_LABEL_BY_TIER[tierName], tierName, x, y, comboStreak, GAMEPLAY_CIRCLE_CONFIG); // core/gameplay/engine-ui.js
        const randomValues = Array.from({ length: GAMEPLAY_SHATTER_SHARD_COUNT * 2 }, () => Math.random());
        showShatterEffect(gameplayTierPopupLayer, x, y, shatterColor, computeShatterShardLayout(GAMEPLAY_SHATTER_SHARD_COUNT, randomValues)); // core/gameplay/engine-ui.js + engine.js
    },

    /** Spawn đúng 1 wave tại 1 pitch (dùng cho wave khơi mào lẫn từng wave của chuỗi Hard). Pitch chưa có ô -> ô giữa vùng
     * spawn; ô bận -> thử 2 ô lân cận (findAvailableCell()), vẫn bận -> bỏ. @returns {boolean} đã spawn */
    _spawnOneWaveAtPitch(now, cfg, diffCfg, pitchCellMap, currentWaves, bpmText, pitch) {
        const targetCell = findCellForPitch(pitchCellMap, pitch) || computeFallbackGridCell(this._gridCols, this._gridRows, this._zoneOriginX, this._zoneOriginY, cfg); // core/gameplay/circle-mode.js
        const occupiedCellKeys = collectOccupiedCellKeys(currentWaves); // core/gameplay/circle-mode.js
        const startRandom01 = Math.random();
        const rotationRandom01 = Math.random();
        const cell = findAvailableCell(targetCell, this._gridCols, this._gridRows, cfg, this._zoneOriginX, this._zoneOriginY, startRandom01, rotationRandom01, occupiedCellKeys); // core/gameplay/circle-mode.js
        if (!cell) return false;

        const jittered = applyCellJitter(cell.cellX, cell.cellY, cfg, Math.random(), Math.random()); // core/gameplay/circle-mode.js
        const shrinkDurationMs = computeShrinkDurationMs(bpmText, cfg, diffCfg.shrinkDurationMultiplier); // core/gameplay/circle-mode.js
        const effectCfg = workflowVisualizerRender.currentEffectConfig(); // event/workflow/visualizer-render.js
        const colors = (GAMEPLAY_CIRCLE_WAVE_COLORS_BY_EFFECT_MODE[effectCfg.mode] || GAMEPLAY_CIRCLE_WAVE_COLORS_BY_EFFECT_MODE.solid)(effectCfg, this._nextSpawnIndex);
        this._nextSpawnIndex++;

        const wave = { id: this._nextWaveId++, spawnedAt: now, startRadius: cfg.waveStartRadius, shrinkDurationMs, col: cell.col, row: cell.row, x: jittered.x, y: jittered.y, colorMain: colors.colorMain, colorLight: colors.colorLight };
        appState.mutate('gameplayWaves', (arr) => arr.push(wave), { skipCheck: true });
        return true;
    },

    /**
     * 1 lần spawn trigger: spawn ngay pitch gốc; phần còn lại của chuỗi "sinh sản" (chỉ Hard) xếp hàng `_hardChainQueue`, tick()
     * nhả dần cách quãng computeChainSpacingMs(). Cấp chuỗi tăng 1 khi bảng còn wave sống (trần `chainMaxLevel`), về 1 khi bảng
     * sạch (computeHardChainLevel()); cấp N -> N wave (computeChainedPitches(), clamp MIDI [0,127]).
     */
    _trySpawnWave(now, cfg, diffCfg, pitchCellMap, currentWaves, bpmText, midiNote) {
        const chain = computeHardChainLevel(diffCfg.chainReproductionEnabled, this._hardChainLevel, currentWaves.length, diffCfg.chainMaxLevel); // core/gameplay/circle-mode.js
        this._hardChainLevel = chain.level;
        const pitchChain = computeChainedPitches(midiNote, chain.chainLevel, 0, 127); // core/gameplay/circle-mode.js

        this._spawnOneWaveAtPitch(now, cfg, diffCfg, pitchCellMap, currentWaves, bpmText, pitchChain[0]);
        this._hardChainQueue.push(...pitchChain.slice(1));
    },

    /** Nhả 1 wave kế tiếp của chuỗi Hard — không roll xác suất (đã cam kết lúc khơi mào). */
    _spawnNextChainedWave(now, cfg, diffCfg, pitchCellMap, bpmText) {
        const pitch = this._hardChainQueue.shift();
        this._spawnOneWaveAtPitch(now, cfg, diffCfg, pitchCellMap, appState.get('gameplayWaves'), bpmText, pitch);
        this._hardChainLastSpawnAt = now;
    },

    /** Tính lại lưới pitch→ô theo kích thước canvas hiện tại (không xáo bảng gán — _rebuildPitchCellMap()). */
    _recomputeGridGeometry() {
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const size = resizeGameplayCanvas(gameplayCanvas); // core/gameplay/circle-mode-ui.js
        const zone = computeSpawnZoneGeometry(size.widthPx, size.heightPx, cfg.spawnZone); // core/gameplay/circle-mode.js
        const grid = computeGridGeometry(zone.widthPx, zone.heightPx, cfg.gridCellSizePx); // core/gameplay/circle-mode.js
        this._zoneOriginX = zone.originX;
        this._zoneOriginY = zone.originY;
        this._gridCols = grid.cols;
        this._gridRows = grid.rows;
    },

    /** Xáo lại bảng pitch→ô: 1 trong 5 kiểu duyệt lưới (ngẫu nhiên mỗi lần) rồi chia 128 note (buildPitchCellMap()). */
    _rebuildPitchCellMap() {
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const cols = this._gridCols, rows = this._gridRows;
        const plan = planCirclePitchMapRebuild(cols, rows, Math.random(), Math.random(), Math.random()); // core/gameplay/circle-mode.js
        const traversalOrder = GAMEPLAY_CIRCLE_TRAVERSAL_BY_PATTERN[plan.patternIndex](cols, rows, plan.flagA, plan.flagB); // core/gameplay/circle-mode.js
        const randomValues = Array.from({ length: plan.randomCount }, () => Math.random());
        const map = buildPitchCellMap(cols, rows, this._zoneOriginX, this._zoneOriginY, cfg, traversalOrder, randomValues); // core/gameplay/circle-mode.js
        appState.set('gameplayPitchCellMap', map, { skipCheck: true });
        console.log(`writer: "workflowGameplay._rebuildPitchCellMap", page: "gameplayPitchCellMap", content: "rebuilt pattern=${plan.patternIndex}"`);
        return map;
    },

    /** Lưới phải khớp kích thước thật của `#gameplay-layer`. 2 nguồn (cùng Listener -> Router): 'visualizerViewport.window.resize'
     * (đổi cửa sổ/xoay máy) và 'gameplay.layer.resize' (ResizeObserver trên layer — bắt cả lúc layer từ ẩn sang hiện: armed lúc
     * còn ở Playlist thì start() đo canvas 0×0, lưới suy biến 1×1). Không có ván -> bỏ qua. Tính lại lưới và xáo bảng luôn. */
    handleLayoutResize() {
        if (appState.get('gameplayPhase') === 'idle') return;
        this._recomputeGridGeometry();
        this._rebuildPitchCellMap();
    },

    /** 'playerControls.audio.ended' / 'playerControls.video.ended' lúc đang ở Game — dừng đếm giờ nghe, lưu điểm, hiện modal
     * Kết quả. Thời lượng / loại media đọc TRƯỚC khi replay()/Next dọn media hay đổi currentKey. */
    async onSongEnded() {
        workflowListenStats.stopClock(); // event/workflow/listen-stats.js — giống workflowPlayerControls.handleMediaEnded()
        const {
            gameplayTotalScore, gameplayCircleCount, gameplayHitCounts, gameplayDifficulty,
            isVideoPlayerMode, playlistCache, currentKey,
        } = appState.get([
            'gameplayTotalScore', 'gameplayCircleCount', 'gameplayHitCounts', 'gameplayDifficulty',
            'isVideoPlayerMode', 'playlistCache', 'currentKey',
        ]);
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const finalScore = computeFinalAverageScore(gameplayTotalScore, gameplayCircleCount); // core/gameplay/engine.js
        const durationLabel = formatTime(getActiveMediaElement(isVideoPlayerMode).duration); // core/playlist/state.js
        const endedCached = playlistCache.get(currentKey);
        const playingMediaType = isVideoPlayerMode ? 'video' : 'song'; // cùng nguồn getActiveMediaElement()
        const { title, playCount } = await workflowGameplayEngine.persistScore('circle', gameplayDifficulty, finalScore, playingMediaType);
        const extras = computeCircleEndExtras(gameplayCircleCount, playCount, cfg); // core/gameplay/circle-mode.js
        const starRating = computeStarRating(gameplayTotalScore, extras.maxScore, cfg); // core/gameplay/engine.js

        appState.set('gameplayWaves', [], { skipCheck: true });
        console.log(`writer: "workflowGameplay.onSongEnded", page: "gameplayWaves", content: "cleared"`);
        appState.set('gameplayPhase', 'ended', { skipCheck: true });
        console.log(`writer: "workflowGameplay.onSongEnded", page: "gameplayPhase", content: "ended"`);
        clearGameplayCanvas(gameplayCanvas); // core/gameplay/circle-mode-ui.js

        workflowGameplayEngine.showEndModal({
            finalScore, totalScore: gameplayTotalScore, maxScore: extras.maxScore, starMax: cfg.starMax, starRating,
            hitCounts: gameplayHitCounts,
            ...workflowGameplayEngine.resolveEndModalLabels(gameplayDifficulty, playCount, extras.isPluralPlayCount, endedCached && endedCached.mediaType),
            title: escapeHtml(title), // core/modal-choice-ui.js — tên file/tag là dữ liệu người dùng
            durationLabel,
            onReplay: () => this.replay(),
            onNext: () => this.nextSong(),
            onEnd: () => this.exitToPlaylist(),
        });
    },

    /** "Chơi lại" — media hiện tại về đầu rồi vào thẳng đếm ngược (phát thật ở _beginPlaying()). */
    replay() {
        workflowGameplayEngine.rewindActiveMedia(); // event/workflow/gameplay-engine.js — vừa hết bài: qua cổng seek (iOS lọt đuôi tiếng cũ)
        this._resetSessionCounters();
        appState.set('gameplayPhase', 'ready', { skipCheck: true });
        console.log(`writer: "workflowGameplay.replay", page: "gameplayPhase", content: "ready"`);
        this.startCountdown();
    },

    /** "Bài tiếp theo" — goToNextTrack(true) tự vòng về đầu playlist; ván mới do tín hiệu 'gameplay.mediaChanged' (gửi mỗi lần
     * playMedia()/playVideoByKey() chạy, kể cả playlist 1 bài) tự mở. */
    nextSong() {
        workflowPlayerControls.goToNextTrack(true); // event/workflow/player-controls.js
    },

    /** 'gameplay.exit.click' hoặc nút "Về Playlist" của modal — thoát hẳn Game Mode qua luồng Back to Playlist, media về đầu. */
    exitToPlaylist() {
        appState.set('gameplayPhase', 'idle', { skipCheck: true });
        console.log(`writer: "workflowGameplay.exitToPlaylist", page: "gameplayPhase", content: "idle"`);
        taskManager.kill(GAMEPLAY_COUNTDOWN_TASK);
        taskManager.kill(GAMEPLAY_SCORE_COUNTUP_TASK);

        workflowGameplayEngine.rewindActiveMedia(); // event/workflow/gameplay-engine.js
        hideGameplayCountdown(gameplayCountdownScreen); // core/gameplay/engine-ui.js
        hideGameplayLayer(gameplayLayer); // core/gameplay/engine-ui.js
        setPlayerControlsBlocked(false); // core/player-controls.js — cặp với start()
        clearGameplayCanvas(gameplayCanvas); // core/gameplay/circle-mode-ui.js

        eventBus.send({ router: 'playerControls', type: 'playerControls.backToPlaylist.click', payload: {} });
    },

    _resetSessionCounters() {
        this._beatTracker = createCircleBeatTracker(audioAnalysis.lastBeatTime()); // core/gameplay/circle-mode.js — beat của bài/phiên trước không tính là "mới"
        this._nextSpawnIndex = 0;
        this._hardChainLevel = 1;
        this._hardChainQueue = [];
        this._hardChainLastSpawnAt = 0;

        workflowGameplayEngine.resetScoreCounters();

        appState.set('gameplayWaves', [], { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayWaves", content: "reset"`);
        appState.set('gameplayPitchCellMap', [], { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayPitchCellMap", content: "reset"`);
        appState.set('gameplayRefreshPending', false, { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayRefreshPending", content: "false"`);

        clearGameplayCanvas(gameplayCanvas); // core/gameplay/circle-mode-ui.js
    },
};
