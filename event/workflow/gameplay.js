/**
 * event/workflow/gameplay.js — Workflow RIÊNG mode "Circle": spawn wave theo lưới pitch→ô, vật lý
 * wave, vẽ canvas, tick() mỗi frame. Cooldown/modal Start-End/lưu điểm DÙNG CHUNG mọi mode đã tách
 * sang event/workflow/gameplay-engine.js — gọi vào đó cho mọi phần không đặc thù Circle.
 *
 * `gameplayArmedGameId` (AppState, session-only — service/state/gameplay-runtime.js) khớp ĐÚNG mode này -> mọi lần
 * media đổi thật tự mở overlay (tín hiệu trung lập 'gameplay.mediaChanged', event/router/gameplay.js — gửi từ CẢ Song
 * `workflowPlayer.playMedia()` LẪN Video `workflowVideoPlayer.playVideoByKey()`). `gameplayPhase`
 * (idle->ready->countdown->playing->ended) RIÊNG BIỆT với `gameplayArmedGameId`. Armed/disarm (nút Play/Exit trên card
 * Game Panel, kèm đóng Game Panel + icon/chấm nav) do event/workflow/game-catalog.js sở hữu hoàn toàn — file này không
 * gọi ngược sang đó.
 *
 * `tick()` KHÔNG tự có RAF riêng — gọi TỪ BÊN TRONG event/workflow/visualizer-render.js::_tick()
 * (dùng chung vòng lặp, tránh 2 RAF song song). Mọi thao tác play/pause/currentTime đều qua
 * `getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode)` (core/player-controls.js, DÙNG CHUNG với Next/Prev) —
 * hoạt động đúng cho cả Song lẫn Video, KHÔNG có đường riêng cho 2 nguồn. Pitch/BPM/Energy tự đúng
 * cho Video vì graph Web Audio đã nối CHUNG `analyser`/`analyserPitch` với Song (đợt VBG Audio B).
 *
 * Rule 3b: Workflow tự appState.get() TRƯỚC, gọi core/gameplay/circle-mode.js (spawn/lưới/vật lý
 * wave THUẦN Circle) + core/gameplay/engine.js (chấm điểm/hit-test/flux DÙNG CHUNG) +
 * core/gameplay/circle-mode-ui.js (canvas) THEO THỨ TỰ tại đây — Core KHÔNG được gọi lẫn nhau
 * (Rule 3a). Màu vòng (custom-effect.js) và globalHueOffset (audio-analysis.js) cũng đọc/gọi Ở ĐÂY.
 *
 * Spawn khoá theo BEAT THẬT: so mốc beat mới nhất (`audioAnalysis.lastBeatTime()`, service/audio-analysis.js) với
 * mốc đã tiêu thụ (`_lastConsumedBeatTime`). Đủ điều kiện CẦN rồi còn qua `isBeatEligibleForSpawn()`
 * (lọc theo độ khó) VÀ roll xác suất theo Energy (`computeSpawnProbability()`) mới THẬT SỰ spawn.
 * Vị trí lấy từ lưới pitch→ô (`gameplayPitchCellMap`), `shrinkDurationMs` theo BPM hiện tại — LƯU
 * vào wave lúc spawn, wave co theo `performance.now()` riêng, độc lập audio.currentTime.
 *
 * `fluxHistory` (`audioAnalysis.fluxHistory()`, 1 mẫu MỖI FRAME render) là nguồn beat detection thật; `tick()` tự gộp thành `_beatFluxHistory` (1 mốc/BEAT, trung bình đoạn
 * giữa 2 beat) TRƯỚC khi gọi `detectMusicTransition()` — độc lập fps máy, threshold tỉ lệ tương đối.
 *
 * NẠP SAU: event/workflow/gameplay-engine.js, core/gameplay/circle-mode.js, core/gameplay/engine.js,
 * core/gameplay/circle-mode-ui.js, core/player-controls.js (getActiveMediaElement),
 * core/visualizer/beat-window.js (detectMusicTransition/isPhraseBoundary).
 */
const GAMEPLAY_MISS_SHATTER_COLOR = '#f87171'; // đỏ-400, khớp màu .gameplay-tier-popup--miss (assets/css/gameplay.css)

// mediaType (playlistCache) -> key nhãn nút Next ở modal Kết quả, xem onSongEnded().
const GAMEPLAY_NEXT_LABEL_KEY_BY_MEDIA = {
    song: 'gameplayCircle.ended.nextLabel',
    video: 'gameplayCircle.ended.nextVideoLabel',
    photo: 'gameplayCircle.ended.nextPhotoLabel',
};

const workflowGameplay = {
    _nextWaveId: 1,
    _nextSpawnIndex: 0,                // luân phiên màu A/B (mode dynamic), reset mỗi phiên
    _lastConsumedBeatTime: 0,          // snapshot appState lastBeatTime đã dùng để xét spawn
    _beatsSinceEligible: 0,            // đếm beat để lọc "mỗi N beat mới xét spawn" theo độ khó
    _beatsSincePhraseRefresh: 0,       // xấp xỉ ranh giới phrase (đếm beat cố định)
    _beatFluxHistory: [],              // 1 mốc/BEAT (trung bình đoạn), cap 24 — xem docstring đầu file
    _pendingBeatFluxSum: 0, _pendingBeatFluxCount: 0, // tích luỹ giữa 2 beat, gộp lúc beat mới tới
    _hardChainLevel: 1,                // cấp độ chuỗi "sinh sản" (chỉ Hard), reset lúc bảng sạch/refresh
    _hardChainQueue: [],               // pitch còn lại trong chuỗi CHƯA spawn, nhả DẦN từng wave (không bung hết 1 lần)
    _hardChainLastSpawnAt: 0,          // mốc ms (performance.now()) lần nhả wave chuỗi gần nhất, so với computeChainSpacingMs()
    _gridCols: 1, _gridRows: 1,        // lưới pitch→ô hiện hành (tính lại lúc resize/vào ready)
    _zoneOriginX: 0, _zoneOriginY: 0,  // góc trên-trái spawnZone, px thật
    _canvasWidthPx: 0, _canvasHeightPx: 0,

    /** Ứng với tín hiệu 'gameplay.mediaChanged' (game đang armed, xem event/router/gameplay.js)
     * HOẶC được `workflowGameCatalog.armGame()` gọi thẳng khi armed lúc đã có bài load sẵn — mở
     * layer rồi NHẢY THẲNG vào countdown (độ khó đã chọn sẵn trên card Game Panel, không có modal
     * hỏi lại). Phase 'ready' vẫn set (mốc chuyển tiếp hợp lệ của enum gameplayPhase) nhưng chỉ tồn
     * tại trong đúng 1 lần gọi hàm này, không có UI riêng.
     *
     * Đóng Game Panel bằng ĐÚNG hành động nút X của panel (`workflowPlaceholderPanels.close(gamePanel)`)
     * — vô điều kiện, idempotent: `armGame()` cũng đã đóng panel lúc armed, dòng này là lớp phòng thủ
     * cho lối vào 'gameplay.mediaChanged' (media đổi lúc đã armed từ trước). */
    start(mode) {
        const { isVideoPlayerMode, isPhotoPlayerMode } = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode']);
        this._resetSessionCounters();
        appState.set('gameplayMode', mode, { skipCheck: true });
        console.log(`writer: "workflowGameplay.start", page: "gameplayMode", content: "${mode}"`);
        appState.set('gameplayPhase', 'ready', { skipCheck: true });
        console.log(`writer: "workflowGameplay.start", page: "gameplayPhase", content: "ready"`);

        workflowPlaceholderPanels.close(gamePanel); // event/workflow/placeholder-panels.js — liên tuyến domain, ĐÚNG hành động nút X

        // Media đang ở đâu (phát/dừng/seek dở) cũng reset: PAUSE TRƯỚC rồi mới seek 0 (seek trước có thể giật 1 khung
        // lúc còn phát). Vô điều kiện — pause/seek 0 trên phần tử đã dừng/đã ở 0 là no-op. Qua core (§7.1).
        resetGameplayMediaToStart(getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode)); // core (engine.js) + core/player-controls.js

        setGameplayLayerMode(gameplayLayer, 'circle'); // core-ui (engine-ui.js) — hiện canvas/tap-surface, ẩn stage Arrow
        showGameplayLayer(gameplayLayer); // core-ui (engine-ui.js)
        // Game Mode chặn toàn bộ thao tác ở player control bottom: chặn NGAY lúc mở overlay, gỡ ở ĐÚNG 1 nơi —
        // exitToPlaylist() (xem setPlayerControlsBlocked(), core/player-controls.js).
        setPlayerControlsBlocked(true); // core (player-controls.js)
        this._recomputeGridGeometry();

        this.startCountdown();
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
        this._lastConsumedBeatTime = audioAnalysis.lastBeatTime(); // service/audio-analysis.js
        this._beatsSinceEligible = 0;
        this._beatsSincePhraseRefresh = 0;
        this._nextSpawnIndex = 0;
        const isVideoPlayerMode = appState.get('isVideoPlayerMode');
        const isPhotoPlayerMode = appState.get('isPhotoPlayerMode');
        const activeEl = getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode); // core/player-controls.js
        if (isVideoPlayerMode) activeEl.play().catch((err) => console.error('[workflowGameplay] bgVideoElement.play() lỗi:', err));
        else activeEl.play();
    },

    /** Ứng với 'gameplay.tap.press' — chỉ tính khi phase='playing' VÀ nhạc/video đang phát.
     * @param {number} tapX @param {number} tapY - px thật khớp hệ toạ độ canvas. */
    handleTap(tapX, tapY) {
        if (appState.get('gameplayPhase') !== 'playing') return;
        if (getActiveMediaElement(appState.get('isVideoPlayerMode'), appState.get('isPhotoPlayerMode')).paused) return;
        const now = performance.now();
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const { gameplayWaves, gameplayComboByTier, gameplayTotalScore, gameplayCircleCount } = appState.get([
            'gameplayWaves', 'gameplayComboByTier', 'gameplayTotalScore', 'gameplayCircleCount',
        ]);
        if (gameplayWaves.length === 0) return;

        const entries = gameplayWaves.map(w => ({ id: w.id, x: w.x, y: w.y, radius: computeWaveRadius(w, now) })); // core (circle-mode.js) — ĐÚNG thứ tự gameplayWaves gốc (xuất hiện sớm hơn đứng trước) = z-order topmost-trước, xem docstring findTopmostNoteInTolerance()
        const nearest = findTopmostNoteInTolerance(entries, tapX, tapY, cfg.tapHitTolerancePx); // core (engine.js)
        if (!nearest) return;

        const tier = classifyTapTier(nearest.radius, cfg); // core (engine.js)
        const tierName = tier ? tier.name : 'miss';
        const tierScore = tier ? tier.score : cfg.missScore; // tap trật = cfg.missScore
        const { pointsGained, newComboByTier } = computeComboScoreGain(tierName, tierScore, gameplayComboByTier, cfg); // core (engine.js)
        const waveRef = gameplayWaves.find(w => w.id === nearest.id);

        appState.mutate('gameplayWaves', arr => {
            const idx = arr.findIndex(w => w.id === nearest.id);
            if (idx !== -1) arr.splice(idx, 1);
        }, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayWaves", content: "remove ${nearest.id}"`);
        appState.set('gameplayComboByTier', newComboByTier, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayComboByTier", content: "${JSON.stringify(newComboByTier)}"`);
        appState.set('gameplayTotalScore', gameplayTotalScore + pointsGained, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayTotalScore", content: "+${pointsGained}"`);
        appState.set('gameplayCircleCount', gameplayCircleCount + 1, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayCircleCount", content: "${gameplayCircleCount + 1}"`);
        appState.mutate('gameplayHitCounts', counts => { counts[tierName] = (counts[tierName] || 0) + 1; }, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayHitCounts", content: "${tierName}+1"`);

        // Combo hiện NGAY tại popup (streak riêng của tierName, 0 nếu tier không combo-eligible). Vỡ vụn màu ĐÚNG
        // wave vừa tap trúng.
        showTapTierPopup(gameplayTierPopupLayer, tierName.toUpperCase(), tierName, nearest.x, nearest.y, newComboByTier[tierName] || 0, cfg); // core-ui
        if (waveRef) showShatterEffect(gameplayTierPopupLayer, nearest.x, nearest.y, waveRef.colorMain); // core-ui — "tap hoàn thành"
    },

    /** Gọi MỖI FRAME từ visualizer-render.js — hot path 60fps, MIỄN Rule 4 cho set()/mutate() bên
     * trong (core-function-conventions.md Rule 4, ngoại lệ hot-path). */
    tick(now) {
        if (appState.get('gameplayPhase') !== 'playing') return;
        if (getActiveMediaElement(appState.get('isVideoPlayerMode'), appState.get('isPhotoPlayerMode')).paused) return;
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const {
            gameplayWaves, gameplayCircleCount, gameplayDifficulty, gameplayPitchCellMap,
            gameplayRefreshPending, gameplayTotalScore,
        } = appState.get([
            'gameplayWaves', 'gameplayCircleCount', 'gameplayDifficulty', 'gameplayPitchCellMap',
            'gameplayRefreshPending', 'gameplayTotalScore',
        ]);
        // Số liệu audio đọc từ kho audioAnalysis (service/audio-analysis.js). BPM giữ dạng chữ ("---" khi chưa có) vì core
        // gameplay tự parseFloat + rơi về giá trị dự phòng.
        const currentCalculatedBpm = audioAnalysis.bpmText();
        const smoothedEnergy = audioAnalysis.smoothedEnergy();
        const lastValidMidiNote = audioAnalysis.pitchMidi();
        const fluxHistory = audioAnalysis.fluxHistory();
        const lastBeatTime = audioAnalysis.lastBeatTime();
        const diffCfg = cfg.difficulty[gameplayDifficulty];

        // Gộp flux MỖI FRAME vào bộ tích luỹ giữa 2 beat — độc lập fps máy, xem docstring đầu file.
        if (fluxHistory.length > 0) {
            this._pendingBeatFluxSum += fluxHistory[fluxHistory.length - 1];
            this._pendingBeatFluxCount++;
        }

        // Bảng gán pitch→ô cố định theo hình học lưới trên dải MIDI [0-127] (không phụ thuộc note đã detect): build LẦN ĐẦU (map rỗng) HOẶC refresh khi pending VÀ vừa hết wave
        // (KHÔNG ép re-target wave đang sống — chỉ chặn spawn mới, chờ board rỗng rồi xáo lại).
        let activeMap = gameplayPitchCellMap;
        let justRebuilt = false;
        if (activeMap.length === 0 || (gameplayRefreshPending && gameplayWaves.length === 0)) {
            activeMap = this._rebuildPitchCellMap();
            justRebuilt = true;
            if (gameplayRefreshPending) appState.set('gameplayRefreshPending', false, { skipCheck: true });
            this._hardChainLevel = 1; // refresh chấm dứt chuỗi "sinh sản" Hard
            this._hardChainQueue = []; // refresh chấm dứt LUÔN phần chuỗi đang xếp hàng dở dang
            this._hardChainLastSpawnAt = 0;
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
            // fluxThreshold DÙNG CHUNG cho energy/section, chỉ khác nhau ở CỬA SỔ so sánh — gộp
            // sẵn trong detectMusicTransition() (core/visualizer/beat-window.js).
            if (!justRebuilt && !gameplayRefreshPending) {
                const musicTransition = detectMusicTransition(this._beatFluxHistory, diffCfg.energyWindowBeats, diffCfg.sectionWindowBeats, diffCfg.fluxThreshold); // core/visualizer/beat-window.js
                const phraseBoundary = isPhraseBoundary(this._beatsSincePhraseRefresh, cfg.refreshBeatsForPhrase); // core/visualizer/beat-window.js
                if (musicTransition || phraseBoundary) {
                    appState.set('gameplayRefreshPending', true, { skipCheck: true });
                    this._beatsSincePhraseRefresh = 0;
                }
            }

            // Trần số wave: Medium là 1 KHOẢNG (computeConcurrentWaveCap() roll lại MỖI LẦN xét — mật độ dao động);
            // Easy/Hard là số cố định (1/Infinity).
            const concurrentWaveCap = computeConcurrentWaveCap(diffCfg, Math.random()); // core (circle-mode.js)
            // Chuỗi "sinh sản" Hard không nhả ở đây (đếm nguyên beat không biểu diễn được nửa beat) — xem khối ngay dưới
            // khối isNewBeat (chạy mỗi frame, so mốc ms).
            if (!gameplayRefreshPending && gameplayWaves.length < concurrentWaveCap && this._hardChainQueue.length === 0 && isBeatEligibleForSpawn(this._beatsSinceEligible, diffCfg.spawnEligibleEveryNBeats)) { // core
                this._beatsSinceEligible = 0;
                const spawnProbability = computeSpawnProbability(smoothedEnergy, cfg); // core
                if (Math.random() < spawnProbability) {
                    this._trySpawnWave(now, cfg, diffCfg, activeMap, appState.get('gameplayWaves'), currentCalculatedBpm, lastValidMidiNote);
                    this._hardChainLastSpawnAt = now; // mốc bắt đầu đếm quãng s cho phần tử KẾ TIẾP trong chuỗi (nếu escalate ra hàng đợi)
                }
            }
        }

        // Nhả hàng đợi chuỗi "sinh sản" Hard — chạy MỖI FRAME, tự so `now` (ms) với mốc lần nhả trước, đủ
        // `computeChainSpacingMs()` mới nhả tiếp. Hàng đợi rỗng (đa số thời gian; Easy/Medium luôn rỗng) -> no-op.
        if (diffCfg.chainReproductionEnabled && this._hardChainQueue.length > 0) {
            const chainSpacingMs = computeChainSpacingMs(currentCalculatedBpm, diffCfg.spawnEligibleEveryNBeats, cfg); // core
            if (now - this._hardChainLastSpawnAt >= chainSpacingMs) {
                this._spawnNextChainedWave(now, cfg, diffCfg, activeMap, currentCalculatedBpm);
                this._hardChainLastSpawnAt = now;
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
            appState.set('gameplayComboByTier', { perfect: 0, excellent: 0 }, { skipCheck: true }); // reset TẤT CẢ, giống tier không combo-eligible (engine.js::computeComboScoreGain())
            appState.set('gameplayCircleCount', gameplayCircleCount + missedIds.length, { skipCheck: true });
            appState.mutate('gameplayHitCounts', counts => { counts.miss = (counts.miss || 0) + missedIds.length; }, { skipCheck: true });
            // Mỗi wave tự hết hạn bị phạt ĐÚNG cfg.missScore — cùng mức với tap-miss trong handleTap().
            appState.set('gameplayTotalScore', gameplayTotalScore + missedIds.length * cfg.missScore, { skipCheck: true });
            for (const entry of missedEntries) {
                showTapTierPopup(gameplayTierPopupLayer, 'MISS', 'miss', entry.x, entry.y, 0, cfg); // core-ui
                showShatterEffect(gameplayTierPopupLayer, entry.x, entry.y, GAMEPLAY_MISS_SHATTER_COLOR); // core-ui — "tự mất"
            }
        }

        const remainingEntries = radiusEntries.filter(e => !missedEntries.includes(e));
        // Wave xuất hiện TRƯỚC phải nằm TRÊN (Giang chốt). Mảng giữ thứ tự spawn (index 0 = sớm nhất) mà canvas 2D
        // "vẽ sau đè lên trên" -> đảo thứ tự CHỈ cho 2 lệnh vẽ (mảng mới, không đụng appState). Hit-test
        // (`findTopmostNoteInTolerance()`) dựng `entries` thẳng từ `gameplayWaves` nên vẫn topmost-trước.
        const drawOrderEntries = [...remainingEntries].reverse();
        const ctx = gameplayCanvas.getContext('2d');
        clearGameplayCanvas(ctx, this._canvasWidthPx, this._canvasHeightPx); // core-ui
        drawApproachRings(ctx, drawOrderEntries); // core-ui
        drawTargetCircles(ctx, drawOrderEntries.map(e => ({ x: e.x, y: e.y, centerRadius: cfg.centerRadius, colorMain: e.colorMain }))); // core-ui
    },

    /** Spawn ĐÚNG 1 wave tại 1 pitch — DÙNG CHUNG bởi cú spawn trigger đầu tiên (_trySpawnWave())
     * lẫn nhả từng phần tử hàng đợi chuỗi "sinh sản" Hard (_spawnNextChainedWave()), để chuỗi xuất hiện
     * lần lượt chứ không bung cùng lúc.
     * @returns {boolean} true nếu spawn thành công (đã push vào gameplayWaves) */
    _spawnOneWaveAtPitch(now, cfg, diffCfg, pitchCellMap, currentWaves, bpmString, pitch) {
        // Chưa detect pitch hợp lệ (map rỗng/pitch null) -> fallback ô GIỮA spawnZone — vẫn cần đúng {col,row}.
        const targetCell = findCellForPitch(pitchCellMap, pitch) || { // core
            col: Math.floor(this._gridCols / 2), row: Math.floor(this._gridRows / 2),
            cellX: this._zoneOriginX + (this._gridCols * cfg.gridCellSizePx) / 2,
            cellY: this._zoneOriginY + (this._gridRows * cfg.gridCellSizePx) / 2,
        };
        // Chọn ô kế cận kiểu xoay rubik, thử 2 lần: startOffsetIndex/rotationDir do Workflow random rồi truyền vào
        // (Core không tự random) — xem findAvailableCell(), core/gameplay/circle-mode.js.
        const occupiedCellKeys = new Set(currentWaves.map((w) => `${w.col},${w.row}`));
        const startOffsetIndex = Math.floor(Math.random() * 8);
        const rotationDir = Math.random() < 0.5 ? 1 : -1;
        const cell = findAvailableCell(targetCell, this._gridCols, this._gridRows, cfg, this._zoneOriginX, this._zoneOriginY, startOffsetIndex, rotationDir, occupiedCellKeys); // core
        if (!cell) return false; // hết chỗ (2 lần thử đều bận) -> bỏ

        const jittered = applyCellJitter(cell.cellX, cell.cellY, cfg, Math.random(), Math.random()); // core
        const shrinkDurationMs = computeShrinkDurationMs(bpmString, cfg, diffCfg.shrinkDurationMultiplier); // core

        const ec = getActiveEffectConfig(); // core (custom-effect.js)
        let colorMain, colorLight;
        if (ec.mode === 'gradient') {
            const hueOffset = audioAnalysis.hueOffset(); // service/audio-analysis.js
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

        const wave = { id: this._nextWaveId++, spawnedAt: now, startRadius: cfg.waveStartRadius, shrinkDurationMs, col: cell.col, row: cell.row, x: jittered.x, y: jittered.y, colorMain, colorLight };
        appState.mutate('gameplayWaves', arr => arr.push(wave), { skipCheck: true });
        return true;
    },

    /** Trigger 1 sự kiện spawn — CHỈ spawn NGAY pitch ĐẦU (bản gốc thật, đây là beat "khơi mào").
     * Phần còn lại của chuỗi "sinh sản" (nếu escalate, chỉ Hard) XẾP HÀNG vào `_hardChainQueue`,
     * nhả DẦN đúng 1 wave/eligible beat kế tiếp qua _spawnNextChainedWave() (tick()) — KHÔNG bung
     * hết trong lần gọi này (chuỗi xuất hiện lần lượt, cách quãng theo nhịp — computeChainSpacingMs()).
     *
     * [Cơ chế "sinh sản" CHỈ Hard] `diffCfg.chainReproductionEnabled` — lúc spawn mà bảng CÒN wave
     * sống (`currentWaves.length > 0`), `this._hardChainLevel` tăng thêm 1 (trần `chainMaxLevel`);
     * KHÔNG còn wave sống -> reset về 1 (chuỗi đứt, xem thêm điểm đứt "lúc refresh" ở tick()). Cấp
     * độ N -> tổng cộng N wave sẽ xuất hiện DẦN qua N eligible beat liên tiếp (computeChainedPitches(),
     * circle-mode.js — pitch[0]=gốc thật, pitch[i>=1]=pitch[i-1] + quãng(i+1)). */
    _trySpawnWave(now, cfg, diffCfg, pitchCellMap, currentWaves, bpmString, midiNote) {
        let chainLevel = 1;
        if (diffCfg.chainReproductionEnabled) {
            this._hardChainLevel = currentWaves.length > 0
                ? Math.min(this._hardChainLevel + 1, diffCfg.chainMaxLevel)
                : 1;
            chainLevel = this._hardChainLevel;
        }
        // Clamp chuỗi trong dải MIDI CỐ ĐỊNH [0,127].
        const pitchChain = computeChainedPitches(midiNote, chainLevel, 0, 127); // core

        this._spawnOneWaveAtPitch(now, cfg, diffCfg, pitchCellMap, currentWaves, bpmString, pitchChain[0]);
        if (pitchChain.length > 1) this._hardChainQueue.push(...pitchChain.slice(1)); // phần còn lại nhả DẦN, xem docstring
    },

    /** Nhả ĐÚNG 1 wave kế tiếp trong hàng đợi chuỗi "sinh sản" Hard — gọi từ tick() khi `_hardChainQueue` còn phần tử
     * và đã đủ quãng `computeChainSpacingMs()`, KHÔNG roll xác suất (đã "cam kết" từ lúc
     * escalate ở _trySpawnWave(), không phải quyết định ngẫu nhiên mới). */
    _spawnNextChainedWave(now, cfg, diffCfg, pitchCellMap, bpmString) {
        const pitch = this._hardChainQueue.shift();
        this._spawnOneWaveAtPitch(now, cfg, diffCfg, pitchCellMap, appState.get('gameplayWaves'), bpmString, pitch);
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

    /** Xáo lại bảng gán pitch→ô — CHỌN NGẪU NHIÊN 1 trong 5 kiểu duyệt lưới (mỗi lần rebuild đều
     * có thể ra kiểu khác, tạo cảm giác mới mỗi lần refresh — Rule 3a: Workflow tự chọn + gọi ĐÚNG
     * 1 hàm Core, không phải Core tự gọi Core khác), rồi phân phối 128 note MIDI (dải cố định [0-127])
     * round-robin + shuffle qua buildPitchCellMap() (circle-mode.js). */
    _rebuildPitchCellMap() {
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const cols = this._gridCols, rows = this._gridRows;
        const totalCells = cols * rows;

        const patternIndex = Math.floor(Math.random() * 5);
        const flagA = Math.random() < 0.5, flagB = Math.random() < 0.5;
        let traversalOrder;
        if (patternIndex === 0) traversalOrder = generateRowMajorOrder(cols, rows, flagA, flagB); // core
        else if (patternIndex === 1) traversalOrder = generateColumnMajorOrder(cols, rows, flagA, flagB); // core
        else if (patternIndex === 2) traversalOrder = generateBoustrophedonRowOrder(cols, rows, flagA, flagB); // core
        else if (patternIndex === 3) traversalOrder = generateBoustrophedonColumnOrder(cols, rows, flagA); // core
        else traversalOrder = generateSpiralOrder(cols, rows, flagA, flagB); // core

        const randomValues = Array.from({ length: totalCells + 8 }, () => Math.random());
        const map = buildPitchCellMap(cols, rows, this._zoneOriginX, this._zoneOriginY, cfg, traversalOrder, randomValues); // core
        appState.set('gameplayPitchCellMap', map, { skipCheck: true });
        console.log(`writer: "workflowGameplay._rebuildPitchCellMap", page: "gameplayPitchCellMap", content: "rebuilt pattern=${patternIndex}"`);
        return map;
    },

    /** Lưới pitch→ô phải khớp kích thước THẬT của `#gameplay-layer`. 2 nguồn kích hoạt, cùng đi Listener -> Router:
     *   - 'visualizerViewport.window.resize' (event/router/visualizer-viewport.js) — đổi kích thước cửa sổ/xoay máy.
     *   - 'gameplay.layer.resize' (ResizeObserver trên `#gameplay-layer`, event/listener/gameplay.js) — bắt cả lúc layer
     *     chuyển từ ẩn sang hiện: armed lúc còn ở Playlist thì `start()` đo canvas khi `#visualizer-ui` đang
     *     `display:none` -> 0×0, lưới suy biến 1×1; `window.resize` không bắn khi chỉ đổi `display` nên phải theo dõi
     *     chính layer để tự phục hồi dù quay lại Visualizer bằng đường nào.
     * Không có ván (phase 'idle') -> bỏ qua. Tính lại lưới VÀ xáo lại bảng gán luôn (sự kiện hiếm, chủ động, khác
     * trigger tự động theo audio nên không gate qua pending). */
    handleLayoutResize() {
        if (appState.get('gameplayPhase') === 'idle') return;
        this._recomputeGridGeometry();
        this._rebuildPitchCellMap();
    },

    /** Ứng với 'playerControls.audio.ended' HOẶC 'playerControls.video.ended' (1 case dùng chung
     * ở router) KHI gameplayPhase !== 'idle' — dừng đếm giờ nghe, hiện modal kết quả (engine) gồm
     * title/thời lượng/độ khó/số lượt chơi. Thời lượng ĐỌC TRƯỚC khi bài/video bị dọn (currentTime reset ở
     * replay()/nextSong() sau đó) — element vừa hết THẬT nên `.duration` vẫn hợp lệ tại đây. `title` escape ở TẦNG NÀY (Workflow, được
     * gọi Core tự do) — `core/gameplay/engine-ui.js` (Core-ui) KHÔNG được gọi `escapeHtml()`
     * (Rule 3a, hàm đó nằm ở modal-choice-ui.js, KHÁC file). */
    async onSongEnded() {
        workflowListenStats.stopClock(); // event/workflow/listen-stats.js — giữ parity với workflowPlayerControls.handleMediaEnded()
        const { gameplayTotalScore, gameplayCircleCount, gameplayHitCounts, gameplayDifficulty, isVideoPlayerMode, isPhotoPlayerMode } = appState.get([
            'gameplayTotalScore', 'gameplayCircleCount', 'gameplayHitCounts', 'gameplayDifficulty', 'isVideoPlayerMode', 'isPhotoPlayerMode',
        ]);
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const finalScore = computeFinalAverageScore(gameplayTotalScore, gameplayCircleCount); // core (engine.js)
        const perfectTier = cfg.tiers.find(tier => tier.name === 'perfect');
        const maxScore = gameplayCircleCount * perfectTier.score;
        const starRating = computeStarRating(gameplayTotalScore, maxScore, cfg); // core (engine.js)
        const durationLabel = formatTime(getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode).duration); // core (core/playlist/state.js)
        // Nhãn nút Next theo loại media ĐANG chơi (Next đi tiếp trong CÙNG playlist Nguồn đó nên cùng loại). Object map
        // (event-bus-flow.md §7). Đọc TRƯỚC khi persistScore()/Next đổi currentKey.
        const endedCached = appState.get('playlistCache').get(appState.get('currentKey'));
        const nextLabelKey = GAMEPLAY_NEXT_LABEL_KEY_BY_MEDIA[endedCached && endedCached.mediaType] || GAMEPLAY_NEXT_LABEL_KEY_BY_MEDIA.song;

        // Loại media ĐANG chơi -> ghi điểm đúng store. Chọn GIÁ TRỊ theo chế độ phát, cùng nguồn với getActiveMediaElement().
        const playingMediaType = isVideoPlayerMode ? 'video' : (isPhotoPlayerMode ? 'photo' : 'song');
        const { title, playCount } = await workflowGameplayEngine.persistScore('circle', gameplayDifficulty, finalScore, playingMediaType);

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
            title: escapeHtml(title), // core (modal-choice-ui.js) — title là dữ liệu người dùng (tên file/tag), PHẢI escape trước khi chèn HTML
            durationLabel,
            difficultyLabel: t('gameplayCircle.difficulty.' + gameplayDifficulty),
            // Số ít/nhiều tách 2 key riêng — tránh "Played 1 times" sai ngữ pháp.
            playCountLabel: playCount === 1
                ? t('gameplayCircle.ended.playCountLabel.singular')
                : tFormat('gameplayCircle.ended.playCountLabel.plural', { count: playCount }),
            nextLabel: t(nextLabelKey),
            onReplay: () => this.replay(),
            onNext: () => this.nextSong(),
            onEnd: () => this.exitToPlaylist(),
        });
    },

    /** Nút "Chơi lại" — phát lại ĐÚNG bài/video hiện tại từ đầu, nhảy thẳng countdown (cùng khuôn start()). PAUSE
     * TRƯỚC rồi mới seek 0 (xem comment trong start()), vô điều kiện; không `.play()` ngay — chỉ phát thật ở
     * _beginPlaying(). */
    replay() {
        const activeEl = getActiveMediaElement(appState.get('isVideoPlayerMode'), appState.get('isPhotoPlayerMode')); // core/player-controls.js
        activeEl.pause();
        activeEl.currentTime = 0;
        this._resetSessionCounters();
        appState.set('gameplayPhase', 'ready', { skipCheck: true });
        console.log(`writer: "workflowGameplay.replay", page: "gameplayPhase", content: "ready"`);
        this.startCountdown();
    },

    /** Nút "Bài tiếp theo" — `workflowPlayerControls.goToNextTrack(true)` TỰ wrap về đầu playlist
     * nếu đang ở bài cuối. Không tự mở lại ván: tín hiệu 'gameplay.mediaChanged' gửi VÔ ĐIỀU KIỆN mỗi lần
     * `playMedia()`/`playVideoByKey()` chạy (kể cả playlist chỉ có 1 bài — goToNextTrack(true) vẫn đi qua
     * playMedia() với đúng key cũ) và lo việc đó. */
    nextSong() {
        workflowPlayerControls.goToNextTrack(true); // event/workflow/player-controls.js
    },

    /** Ứng với 'gameplay.exit.click' HOẶC nút Cancel/"Về Playlist" trong modal — thoát hẳn Game
     * Mode, tái dùng luồng "Back to Playlist" có sẵn. Media reset về đầu: PAUSE TRƯỚC rồi seek 0 (cùng thứ tự
     * start()/replay()), vô điều kiện. */
    exitToPlaylist() {
        appState.set('gameplayPhase', 'idle', { skipCheck: true });
        console.log(`writer: "workflowGameplay.exitToPlaylist", page: "gameplayPhase", content: "idle"`);
        taskManager.kill(GAMEPLAY_COUNTDOWN_TASK);
        taskManager.kill(GAMEPLAY_SCORE_COUNTUP_TASK);

        const activeEl = getActiveMediaElement(appState.get('isVideoPlayerMode'), appState.get('isPhotoPlayerMode')); // core/player-controls.js
        activeEl.pause();
        activeEl.currentTime = 0;

        hideGameplayCountdown(gameplayCountdownScreen); // core-ui
        hideGameplayLayer(gameplayLayer); // core-ui
        setPlayerControlsBlocked(false); // core (player-controls.js) — gỡ lại ĐÚNG cặp với start()
        const ctx = gameplayCanvas.getContext('2d');
        clearGameplayCanvas(ctx, this._canvasWidthPx || gameplayCanvas.clientWidth, this._canvasHeightPx || gameplayCanvas.clientHeight); // core-ui

        eventBus.send({ router: 'playerControls', type: 'playerControls.backToPlaylist.click', payload: {} });
    },

    _resetSessionCounters() {
        this._lastConsumedBeatTime = audioAnalysis.lastBeatTime(); // tránh beat cũ (bài/phiên trước) bị tính là "mới"
        this._beatsSinceEligible = 0;
        this._beatsSincePhraseRefresh = 0;
        this._nextSpawnIndex = 0;
        this._beatFluxHistory = [];
        this._pendingBeatFluxSum = 0;
        this._pendingBeatFluxCount = 0;
        this._hardChainLevel = 1; // reset chuỗi "sinh sản" đầu mỗi phiên
        this._hardChainQueue = []; // xoá phần chuỗi dở dang (nếu có) từ phiên trước
        this._hardChainLastSpawnAt = 0;

        workflowGameplayEngine.resetScoreCounters();

        appState.set('gameplayWaves', [], { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayWaves", content: "reset"`);
        appState.set('gameplayPitchCellMap', [], { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayPitchCellMap", content: "reset"`);
        appState.set('gameplayRefreshPending', false, { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayRefreshPending", content: "false"`);

        if (this._canvasWidthPx) {
            const ctx = gameplayCanvas.getContext('2d');
            clearGameplayCanvas(ctx, this._canvasWidthPx, this._canvasHeightPx); // core-ui — canvas có thể chưa từng resize (lần đầu app boot, layer còn .hidden)
        }
    },
};
