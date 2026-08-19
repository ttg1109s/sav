/**
 * event/workflow/gameplay.js — Workflow RIÊNG mode "Circle": spawn wave theo lưới pitch→ô, vật lý
 * wave, vẽ canvas, tick() mỗi frame. Cooldown/modal Start-End/lưu điểm DÙNG CHUNG mọi mode đã tách
 * sang event/workflow/gameplay-engine.js — gọi vào đó cho mọi phần không đặc thù Circle.
 *
 * `vizConfig.gameplayModeEnabled` (PERSISTENT) bật ON -> mọi lần media đổi thật tự mở overlay (hook
 * `'gameplay.mediaChanged'`, event/router/gameplay.js — tín hiệu trung lập, gửi từ CẢ Song
 * (`workflowPlayer.playMedia()`) LẪN Video (`workflowVideoPlayer.playVideoByKey()`), KHÔNG phụ
 * thuộc domain "visualBg"). `gameplayPhase` (idle->ready->countdown->playing->ended, xem
 * service/state/gameplay-runtime.js) RIÊNG BIỆT với `gameplayModeEnabled`.
 *
 * `tick()` KHÔNG tự có RAF riêng — gọi TỪ BÊN TRONG event/workflow/visualizer-render.js::_tick()
 * (dùng chung vòng lặp, tránh 2 RAF song song). Mọi thao tác play/pause/currentTime đều qua
 * `getActiveMediaElement(isVideoPlayerMode)` (core/player-controls.js, DÙNG CHUNG với Next/Prev) —
 * hoạt động đúng cho cả Song lẫn Video, KHÔNG có đường riêng cho 2 nguồn. Pitch/BPM/Energy tự đúng
 * cho Video vì graph Web Audio đã nối CHUNG `analyser`/`analyserPitch` với Song (đợt VBG Audio B).
 *
 * Rule 3b: Workflow tự appState.get() TRƯỚC, gọi core/gameplay/circle-mode.js (spawn/lưới/vật lý
 * wave THUẦN Circle) + core/gameplay/engine.js (chấm điểm/hit-test/flux DÙNG CHUNG) +
 * core/gameplay/circle-mode-ui.js (canvas) THEO THỨ TỰ tại đây — Core KHÔNG được gọi lẫn nhau
 * (Rule 3a). Màu vòng (custom-effect.js) và globalHueOffset (audio-analysis.js) cũng đọc/gọi Ở ĐÂY.
 *
 * Spawn khoá theo BEAT THẬT: so global `lastBeatTime` (core/dom-refs.js, KHÔNG thuộc appState) với
 * mốc đã tiêu thụ (`_lastConsumedBeatTime`). Đủ điều kiện CẦN rồi còn qua `isBeatEligibleForSpawn()`
 * (lọc theo độ khó) VÀ roll xác suất theo Energy (`computeSpawnProbability()`) mới THẬT SỰ spawn.
 * Vị trí lấy từ lưới pitch→ô (`gameplayPitchCellMap`), `shrinkDurationMs` theo BPM hiện tại — LƯU
 * vào wave lúc spawn, wave co theo `performance.now()` riêng, độc lập audio.currentTime.
 *
 * [SỬA — nghiên cứu lại công thức flux, phản hồi Giang] `fluxHistory` (appState) đẩy 1 mẫu MỖI
 * FRAME render — dùng THẲNG cho detectFluxTransition() (windowSize=10 mẫu) từng bị nhiễu tức thời
 * chi phối (167ms@60fps, còn ít hơn ở máy fps cao) + threshold tuyệt đối không thích ứng độ to nhỏ
 * bài hát. `fluxHistory` KHÔNG được đổi (cũng là nguồn beat detection thật, core/audio-analysis.js)
 * — tick() giờ tự gộp `fluxHistory` thành `_beatFluxHistory` (1 mốc/BEAT, trung bình đoạn giữa 2
 * beat) TRƯỚC khi gọi detectFluxTransition() — độc lập fps máy, threshold đổi sang tỉ lệ tương đối.
 *
 * NẠP SAU: event/workflow/gameplay-engine.js, core/gameplay/circle-mode.js, core/gameplay/engine.js,
 * core/gameplay/circle-mode-ui.js, core/player-controls.js (getActiveMediaElement).
 */
const workflowGameplay = {
    _nextWaveId: 1,
    _nextSpawnIndex: 0,                // luân phiên màu A/B (mode dynamic), reset mỗi phiên
    _lastConsumedBeatTime: 0,          // snapshot lastBeatTime (global) đã dùng để xét spawn
    _beatsSinceEligible: 0,            // đếm beat để lọc "mỗi N beat mới xét spawn" theo độ khó
    _beatsSincePhraseRefresh: 0,       // xấp xỉ ranh giới phrase (đếm beat cố định)
    _beatFluxHistory: [],              // 1 mốc/BEAT (trung bình đoạn), cap 24 — xem docstring đầu file
    _pendingBeatFluxSum: 0, _pendingBeatFluxCount: 0, // tích luỹ giữa 2 beat, gộp lúc beat mới tới
    _gridCols: 1, _gridRows: 1,        // lưới pitch→ô hiện hành (tính lại lúc resize/vào ready)
    _zoneOriginX: 0, _zoneOriginY: 0,  // góc trên-trái spawnZone, px thật
    _canvasWidthPx: 0, _canvasHeightPx: 0,

    /** Ứng với 'gameplay.modeEnabled.change'. Bật ON kèm đang có bài load sẵn -> mở LUÔN. */
    setModeEnabled(checked) {
        setGameplayModeEnabled(checked); // core (engine.js)
        saveConfig(); // core
        if (checked && appState.get('currentKey')) this.start('circle');
    },

    /** Ứng với 'gameplay.start.click' — mở layer, vào phase 'ready', hiện modal Start (engine).
     * CHƯA spawn wave (chờ bấm Start). Reset audio/video về 0 + pause — chỉ phát thật ở
     * _beginPlaying() sau countdown. */
    start(mode) {
        this._resetSessionCounters();
        appState.set('gameplayMode', mode, { skipCheck: true });
        console.log(`writer: "workflowGameplay.start", page: "gameplayMode", content: "${mode}"`);
        appState.set('gameplayPhase', 'ready', { skipCheck: true });
        console.log(`writer: "workflowGameplay.start", page: "gameplayPhase", content: "ready"`);

        const activeEl = getActiveMediaElement(appState.get('isVideoPlayerMode')); // core/player-controls.js
        activeEl.currentTime = 0;
        activeEl.pause();

        showGameplayLayer(gameplayLayer); // core-ui (engine-ui.js)
        this._recomputeGridGeometry();

        workflowGameplayEngine.showStartModal({
            bodyTextKey: 'gameplayCircle.ready.text',
            onStart: () => this.startCountdown(),
            onCancel: () => this.exitToPlaylist(),
        });
    },

    startCountdown() {
        appState.set('gameplayPhase', 'countdown', { skipCheck: true });
        console.log(`writer: "workflowGameplay.startCountdown", page: "gameplayPhase", content: "countdown"`);
        workflowGameplayEngine.startCountdown(() => this._beginPlaying());
    },

    /** Hết đếm ngược -> phát nhạc/video THẬT, cho phép tick() bắt đầu spawn từ frame kế tiếp. */
    _beginPlaying() {
        appState.set('gameplayPhase', 'playing', { skipCheck: true });
        console.log(`writer: "workflowGameplay._beginPlaying", page: "gameplayPhase", content: "playing"`);
        // Snapshot lastBeatTime NGAY LÚC NÀY — tránh 1 beat CŨ (detect trước khi countdown bắt đầu)
        // bị hiểu nhầm là "vừa mới có" rồi spawn ngay lập tức.
        this._lastConsumedBeatTime = lastBeatTime;
        this._beatsSinceEligible = 0;
        this._beatsSincePhraseRefresh = 0;
        this._nextSpawnIndex = 0;
        const isVideoPlayerMode = appState.get('isVideoPlayerMode');
        const activeEl = getActiveMediaElement(isVideoPlayerMode); // core/player-controls.js
        if (isVideoPlayerMode) activeEl.play().catch((err) => console.error('[workflowGameplay] bgVideoElement.play() lỗi:', err));
        else activeEl.play();
    },

    /** Ứng với 'gameplay.tap.press' — chỉ tính khi phase='playing' VÀ nhạc/video đang phát.
     * @param {number} tapX @param {number} tapY - px thật khớp hệ toạ độ canvas. */
    handleTap(tapX, tapY) {
        if (appState.get('gameplayPhase') !== 'playing') return;
        if (getActiveMediaElement(appState.get('isVideoPlayerMode')).paused) return;
        const now = performance.now();
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const { gameplayWaves, gameplayComboStreak, gameplayTotalScore, gameplayCircleCount } = appState.get([
            'gameplayWaves', 'gameplayComboStreak', 'gameplayTotalScore', 'gameplayCircleCount',
        ]);
        if (gameplayWaves.length === 0) return;

        const entries = gameplayWaves.map(w => ({ id: w.id, x: w.x, y: w.y, radius: computeWaveRadius(w, now) })); // core (circle-mode.js)
        const nearest = findNearestNoteByPosition(entries, tapX, tapY, cfg.tapHitTolerancePx); // core (engine.js)
        if (!nearest) return;

        const tier = classifyTapTier(nearest.radius, cfg); // core (engine.js)
        const tierName = tier ? tier.name : 'miss';
        const tierScore = tier ? tier.score : 0;
        const { pointsGained, newComboStreak } = computeComboScoreGain(tierName, tierScore, gameplayComboStreak, cfg); // core (engine.js)

        appState.mutate('gameplayWaves', arr => {
            const idx = arr.findIndex(w => w.id === nearest.id);
            if (idx !== -1) arr.splice(idx, 1);
        }, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayWaves", content: "remove ${nearest.id}"`);
        appState.set('gameplayComboStreak', newComboStreak, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayComboStreak", content: "${newComboStreak}"`);
        appState.set('gameplayTotalScore', gameplayTotalScore + pointsGained, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayTotalScore", content: "+${pointsGained}"`);
        appState.set('gameplayCircleCount', gameplayCircleCount + 1, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayCircleCount", content: "${gameplayCircleCount + 1}"`);
        appState.mutate('gameplayHitCounts', counts => { counts[tierName] = (counts[tierName] || 0) + 1; }, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayHitCounts", content: "${tierName}+1"`);

        showTapTierPopup(gameplayTierPopupLayer, tierName.toUpperCase(), tierName, nearest.x, nearest.y); // core-ui (engine-ui.js)
        updateGameplayHud(gameplayHudCombo, newComboStreak); // core-ui (engine-ui.js)
    },

    /** Gọi MỖI FRAME từ visualizer-render.js — hot path 60fps, MIỄN Rule 4 cho set()/mutate() bên
     * trong (core-function-conventions.md Rule 4, ngoại lệ hot-path). */
    tick(now) {
        if (appState.get('gameplayPhase') !== 'playing') return;
        if (getActiveMediaElement(appState.get('isVideoPlayerMode')).paused) return;
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const {
            gameplayWaves, gameplayCircleCount, gameplayDifficulty, gameplayPitchCellMap,
            gameplayRefreshPending, currentCalculatedBpm, smoothedEnergy, lastValidMidiNote,
            gameplayPitchRangeMin, gameplayPitchRangeMax, fluxHistory,
        } = appState.get([
            'gameplayWaves', 'gameplayCircleCount', 'gameplayDifficulty', 'gameplayPitchCellMap',
            'gameplayRefreshPending', 'currentCalculatedBpm', 'smoothedEnergy', 'lastValidMidiNote',
            'gameplayPitchRangeMin', 'gameplayPitchRangeMax', 'fluxHistory',
        ]);
        const diffCfg = cfg.difficulty[gameplayDifficulty];

        // Gộp flux MỖI FRAME vào bộ tích luỹ giữa 2 beat — độc lập fps máy, xem docstring đầu file.
        if (fluxHistory.length > 0) {
            this._pendingBeatFluxSum += fluxHistory[fluxHistory.length - 1];
            this._pendingBeatFluxCount++;
        }

        // Nới dải pitch quan sát được — TRƯỚC bước spawn để note spawn ngay tick này được hưởng
        // dải mới nhất.
        const rangeUpdate = computePitchRangeUpdate(lastValidMidiNote, gameplayPitchRangeMin, gameplayPitchRangeMax); // core
        if (rangeUpdate.min !== gameplayPitchRangeMin || rangeUpdate.max !== gameplayPitchRangeMax) {
            appState.set('gameplayPitchRangeMin', rangeUpdate.min, { skipCheck: true });
            appState.set('gameplayPitchRangeMax', rangeUpdate.max, { skipCheck: true });
        }

        // Bảng gán pitch→ô: build LẦN ĐẦU (map rỗng) HOẶC refresh khi pending VÀ vừa hết wave
        // (KHÔNG ép re-target wave đang sống — chỉ chặn spawn mới, chờ board rỗng rồi xáo lại).
        let activeMap = gameplayPitchCellMap;
        let justRebuilt = false;
        if (activeMap.length === 0 || (gameplayRefreshPending && gameplayWaves.length === 0)) {
            activeMap = this._rebuildPitchCellMap(rangeUpdate.min, rangeUpdate.max);
            justRebuilt = true;
            if (gameplayRefreshPending) appState.set('gameplayRefreshPending', false, { skipCheck: true });
        }

        const isNewBeat = lastBeatTime > 0 && lastBeatTime !== this._lastConsumedBeatTime;
        if (isNewBeat) {
            this._lastConsumedBeatTime = lastBeatTime;
            this._beatsSinceEligible++;
            this._beatsSincePhraseRefresh++;

            // Chốt mốc flux/BEAT (trung bình đoạn vừa tích luỹ) rồi reset bộ tích luỹ.
            if (this._pendingBeatFluxCount > 0) {
                this._beatFluxHistory.push(this._pendingBeatFluxSum / this._pendingBeatFluxCount);
                if (this._beatFluxHistory.length > 24) this._beatFluxHistory.shift();
            }
            this._pendingBeatFluxSum = 0;
            this._pendingBeatFluxCount = 0;

            // Trigger refresh vị trí theo audio — CHỈ xét khi map đã có THẬT và CHƯA đang pending.
            if (!justRebuilt && !gameplayRefreshPending) {
                const energyTransition = detectFluxTransition(this._beatFluxHistory, diffCfg.energyWindowBeats, diffCfg.fluxDeltaEnergy); // core (engine.js)
                const sectionTransition = detectFluxTransition(this._beatFluxHistory, diffCfg.sectionWindowBeats, diffCfg.fluxDeltaSection); // core
                const phraseBoundary = isPhraseBoundary(this._beatsSincePhraseRefresh, cfg.refreshBeatsForPhrase); // core (circle-mode.js)
                if (energyTransition || sectionTransition || phraseBoundary) {
                    appState.set('gameplayRefreshPending', true, { skipCheck: true });
                    this._beatsSincePhraseRefresh = 0;
                }
            }

            if (!gameplayRefreshPending && gameplayWaves.length < diffCfg.maxConcurrentWaves && isBeatEligibleForSpawn(this._beatsSinceEligible, diffCfg.spawnEligibleEveryNBeats)) { // core
                this._beatsSinceEligible = 0;
                const spawnProbability = computeSpawnProbability(smoothedEnergy, cfg); // core
                if (Math.random() < spawnProbability) {
                    this._trySpawnWave(now, cfg, diffCfg, activeMap, appState.get('gameplayWaves'), currentCalculatedBpm, lastValidMidiNote);
                }
            }
        }

        // Vật lý wave: bán kính/opacity mỗi frame + auto-miss.
        const waves = appState.get('gameplayWaves');
        const radiusEntries = waves.map((w) => {
            const radius = computeWaveRadius(w, now); // core
            return { id: w.id, x: w.x, y: w.y, radius, opacity: computeWaveOpacity(radius, cfg), colorMain: w.colorMain, colorLight: w.colorLight }; // core
        });

        const missedEntries = radiusEntries.filter(e => isWaveMissed(e.radius, cfg)); // core
        if (missedEntries.length > 0) {
            const missedIds = missedEntries.map(e => e.id);
            appState.mutate('gameplayWaves', arr => {
                for (let i = arr.length - 1; i >= 0; i--) if (missedIds.includes(arr[i].id)) arr.splice(i, 1);
            }, { skipCheck: true });
            appState.set('gameplayComboStreak', 0, { skipCheck: true });
            appState.set('gameplayCircleCount', gameplayCircleCount + missedIds.length, { skipCheck: true });
            appState.mutate('gameplayHitCounts', counts => { counts.miss = (counts.miss || 0) + missedIds.length; }, { skipCheck: true });
            for (const entry of missedEntries) {
                showTapTierPopup(gameplayTierPopupLayer, 'MISS', 'miss', entry.x, entry.y); // core-ui
            }
            updateGameplayHud(gameplayHudCombo, 0); // core-ui
        }

        const remainingEntries = radiusEntries.filter(e => !missedEntries.includes(e));
        const ctx = gameplayCanvas.getContext('2d');
        clearGameplayCanvas(ctx, this._canvasWidthPx, this._canvasHeightPx); // core-ui
        drawApproachRings(ctx, remainingEntries); // core-ui
        drawTargetCircles(ctx, remainingEntries.map(e => ({ x: e.x, y: e.y, centerRadius: cfg.centerRadius, colorMain: e.colorMain }))); // core-ui
    },

    /** Thử spawn 1 wave — tách khỏi tick() vì cần nhiều bước phụ thuộc nhau (tìm ô theo pitch,
     * chống đè hình, chọn màu theo effect đang chạy). Bỏ qua lượt (chờ beat kế) nếu vị trí quá gần
     * 1 wave đang sống. */
    _trySpawnWave(now, cfg, diffCfg, pitchCellMap, currentWaves, bpmString, midiNote) {
        const cell = findCellForPitch(pitchCellMap, midiNote); // core
        const fallbackX = this._zoneOriginX + (this._gridCols * cfg.gridCellSizePx) / 2;
        const fallbackY = this._zoneOriginY + (this._gridRows * cfg.gridCellSizePx) / 2;
        const baseX = cell ? cell.cellX : fallbackX;
        const baseY = cell ? cell.cellY : fallbackY;
        const jittered = applyCellJitter(baseX, baseY, cfg, Math.random(), Math.random()); // core

        const activePositions = currentWaves.map(w => ({ x: w.x, y: w.y }));
        if (isPositionTooClose(jittered.x, jittered.y, activePositions, diffCfg.minSpawnDistancePx)) return; // core — bỏ lượt, chờ beat kế

        const shrinkDurationMs = computeShrinkDurationMs(bpmString, cfg); // core

        const ec = getActiveEffectConfig(); // core (custom-effect.js)
        let colorMain, colorLight;
        if (ec.mode === 'gradient') {
            const hueOffset = appState.get('globalHueOffset');
            colorMain = computeCircleColorGradientMain(hueOffset); // core
            colorLight = computeCircleColorGradientLight(hueOffset); // core
        } else if (ec.mode === 'dynamic') {
            colorMain = computeCircleColorDynamic(ec.dynA, ec.dynB, this._nextSpawnIndex); // core
            colorLight = interpolateColor(colorMain, '#ffffff', 0.5); // core (color-utils.js)
        } else {
            colorMain = ec.solidColor;
            colorLight = interpolateColor(colorMain, '#ffffff', 0.5); // core
        }
        this._nextSpawnIndex++;

        const wave = { id: this._nextWaveId++, spawnedAt: now, startRadius: cfg.waveStartRadius, shrinkDurationMs, x: jittered.x, y: jittered.y, colorMain, colorLight };
        appState.mutate('gameplayWaves', arr => arr.push(wave), { skipCheck: true });
    },

    /** Tính lại lưới pitch→ô theo kích thước canvas HIỆN TẠI — PHẢI gọi sau resize/lúc mở layer.
     * Chỉ tính hình học lưới, KHÔNG xáo bảng gán (xem _rebuildPitchCellMap()). */
    _recomputeGridGeometry() {
        const size = resizeGameplayCanvas(gameplayCanvas); // core-ui (circle-mode-ui.js)
        this._canvasWidthPx = size.widthPx;
        this._canvasHeightPx = size.heightPx;
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const zone = cfg.spawnZone;
        this._zoneOriginX = size.widthPx * zone.xMinPercent / 100;
        this._zoneOriginY = size.heightPx * zone.yMinPercent / 100;
        const zoneWidthPx = size.widthPx * (zone.xMaxPercent - zone.xMinPercent) / 100;
        const zoneHeightPx = size.heightPx * (zone.yMaxPercent - zone.yMinPercent) / 100;
        const geometry = computeGridGeometry(zoneWidthPx, zoneHeightPx, cfg.gridCellSizePx); // core
        this._gridCols = geometry.cols;
        this._gridRows = geometry.rows;
    },

    /** Xáo lại bảng gán pitch→ô — bucket-hoá dải pitch quan sát được, shuffle vào lưới hiện hành. */
    _rebuildPitchCellMap(pitchRangeMin, pitchRangeMax) {
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const totalCells = this._gridCols * this._gridRows;
        const randomValues = Array.from({ length: totalCells + 8 }, () => Math.random());
        const map = buildPitchCellMap(pitchRangeMin, pitchRangeMax, this._gridCols, this._gridRows, this._zoneOriginX, this._zoneOriginY, cfg, randomValues); // core
        appState.set('gameplayPitchCellMap', map, { skipCheck: true });
        console.log(`writer: "workflowGameplay._rebuildPitchCellMap", page: "gameplayPitchCellMap", content: "rebuilt ${map.length} cells"`);
        return map;
    },

    /** Resize/xoay màn hình giữa ván — tính lại lưới VÀ xáo lại bảng gán luôn (sự kiện hiếm, chủ
     * động, khác trigger tự động theo audio nên không gate qua pending). */
    _handleWindowResize() {
        if (appState.get('gameplayPhase') === 'idle') return;
        this._recomputeGridGeometry();
        this._rebuildPitchCellMap(appState.get('gameplayPitchRangeMin'), appState.get('gameplayPitchRangeMax'));
    },

    /** Ứng với 'playerControls.audio.ended' HOẶC 'playerControls.video.ended' (1 case dùng chung
     * ở router) KHI gameplayPhase !== 'idle' — dừng đếm giờ nghe, hiện modal kết quả (engine). */
    async onSongEnded() {
        stopListenClock(); // core — giữ parity với workflowPlayerControls.handleMediaEnded()
        const { gameplayTotalScore, gameplayCircleCount, gameplayHitCounts } = appState.get([
            'gameplayTotalScore', 'gameplayCircleCount', 'gameplayHitCounts',
        ]);
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const finalScore = computeFinalAverageScore(gameplayTotalScore, gameplayCircleCount); // core (engine.js)
        const perfectTier = cfg.tiers.find(tier => tier.name === 'perfect');
        const maxScore = gameplayCircleCount * perfectTier.score;
        const starRating = computeStarRating(gameplayTotalScore, maxScore, cfg); // core (engine.js)

        await workflowGameplayEngine.persistScore('circle', finalScore);

        appState.set('gameplayWaves', [], { skipCheck: true });
        console.log(`writer: "workflowGameplay.onSongEnded", page: "gameplayWaves", content: "cleared"`);
        appState.set('gameplayPhase', 'ended', { skipCheck: true });
        console.log(`writer: "workflowGameplay.onSongEnded", page: "gameplayPhase", content: "ended"`);

        const ctx = gameplayCanvas.getContext('2d');
        clearGameplayCanvas(ctx, this._canvasWidthPx, this._canvasHeightPx); // core-ui

        const tierOrder = ['perfect', 'excellent', 'good', 'bad', 'miss'];
        workflowGameplayEngine.showEndModal({
            finalScore, totalScore: gameplayTotalScore, maxScore, starMax: cfg.starMax, starRating,
            hitCounts: gameplayHitCounts, tierOrder,
            tierLabels: Object.fromEntries(tierOrder.map(name => [name, t('gameplayCircle.ended.hitTier.' + name)])),
            onReplay: () => this.replay(),
            onNext: () => this.nextSong(),
            onEnd: () => this.exitToPlaylist(),
        });
    },

    /** Nút "Chơi lại" — phát lại ĐÚNG bài/video hiện tại từ đầu, quay về phase 'ready' + hiện lại
     * modal Start. Reset về 0 + PAUSE (không `.play()` ngay — chỉ phát thật ở _beginPlaying()). */
    replay() {
        const activeEl = getActiveMediaElement(appState.get('isVideoPlayerMode')); // core/player-controls.js
        activeEl.currentTime = 0;
        activeEl.pause();
        this._resetSessionCounters();
        appState.set('gameplayPhase', 'ready', { skipCheck: true });
        console.log(`writer: "workflowGameplay.replay", page: "gameplayPhase", content: "ready"`);
        workflowGameplayEngine.showStartModal({
            bodyTextKey: 'gameplayCircle.ready.text',
            onStart: () => this.startCountdown(),
            onCancel: () => this.exitToPlaylist(),
        });
    },

    /** Nút "Bài tiếp theo" — `workflowPlayerControls.goToNextTrack(true)` TỰ wrap về đầu playlist
     * nếu đang ở bài cuối. KHÔNG tự mở lại modal ready: hook TỰ ĐỘNG ở 'gameplay.mediaChanged' (xem
     * docstring đầu file) đã lo việc đó. CHỈ fallback gọi start() thủ công cho ĐÚNG 1 trường hợp:
     * playlist chỉ có 1 bài -> goToNextTrack(true) trả về NGUYÊN key cũ -> không bắn tín hiệu đổi. */
    nextSong() {
        const previousKey = appState.get('currentKey');
        workflowPlayerControls.goToNextTrack(true); // event/workflow/player-controls.js
        if (appState.get('currentKey') === previousKey) this.start('circle');
    },

    /** Ứng với 'gameplay.exit.click' HOẶC nút Cancel/"Về Playlist" trong modal — thoát hẳn Game
     * Mode, tự pause nhạc/video, tái dùng luồng "Back to Playlist" có sẵn. */
    exitToPlaylist() {
        appState.set('gameplayPhase', 'idle', { skipCheck: true });
        console.log(`writer: "workflowGameplay.exitToPlaylist", page: "gameplayPhase", content: "idle"`);
        taskManager.kill(GAMEPLAY_COUNTDOWN_TASK);
        taskManager.kill(GAMEPLAY_SCORE_COUNTUP_TASK);

        getActiveMediaElement(appState.get('isVideoPlayerMode')).pause(); // core/player-controls.js

        hideGameplayCountdown(gameplayCountdownScreen); // core-ui
        hideGameplayLayer(gameplayLayer); // core-ui
        const ctx = gameplayCanvas.getContext('2d');
        clearGameplayCanvas(ctx, this._canvasWidthPx || gameplayCanvas.clientWidth, this._canvasHeightPx || gameplayCanvas.clientHeight); // core-ui

        eventBus.send({ router: 'playerControls', type: 'playerControls.backToPlaylist.click', payload: {} });
    },

    _resetSessionCounters() {
        this._lastConsumedBeatTime = lastBeatTime; // tránh beat cũ (bài/phiên trước) bị tính là "mới"
        this._beatsSinceEligible = 0;
        this._beatsSincePhraseRefresh = 0;
        this._nextSpawnIndex = 0;
        this._beatFluxHistory = [];
        this._pendingBeatFluxSum = 0;
        this._pendingBeatFluxCount = 0;

        workflowGameplayEngine.resetScoreCounters();

        appState.set('gameplayWaves', [], { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayWaves", content: "reset"`);
        appState.set('gameplayPitchRangeMin', null, { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayPitchRangeMin", content: "null"`);
        appState.set('gameplayPitchRangeMax', null, { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayPitchRangeMax", content: "null"`);
        appState.set('gameplayPitchCellMap', [], { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayPitchCellMap", content: "reset"`);
        appState.set('gameplayRefreshPending', false, { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayRefreshPending", content: "false"`);

        if (this._canvasWidthPx) {
            const ctx = gameplayCanvas.getContext('2d');
            clearGameplayCanvas(ctx, this._canvasWidthPx, this._canvasHeightPx); // core-ui — canvas có thể chưa từng resize (lần đầu app boot, layer còn .hidden)
        }
        updateGameplayHud(gameplayHudCombo, 0); // core-ui
    },
};

// Lưới pitch→ô phải khớp kích thước layer thật — resize/xoay màn hình giữa ván phải tính lại (đúng
// tiền lệ core/canvas-scene-setup.js cho canvas visualizer chính, ngoại lệ browser-level đứng ngoài
// /event/ bus).
window.addEventListener('resize', () => workflowGameplay._handleWindowResize());
