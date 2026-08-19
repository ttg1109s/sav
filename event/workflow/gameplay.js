/**
 * event/workflow/gameplay.js — Workflow duy nhất điều phối Game Mode (Circle mode). Sở hữu:
 *   - `vizConfig.gameplayModeEnabled` (PERSISTENT, core/config.js) — bật/tắt qua setModeEnabled(),
 *     checkbox "Tự mở Game khi phát nhạc" trong Settings (components/settings/misc.js, section
 *     "GAME MODE"). Bật ON -> mọi lần media đổi thật sau đó tự mở overlay (hook ở
 *     `'gameplay.mediaChanged'`, event/router/gameplay.js — [SỬA, phản hồi Giang "visualBg.
 *     songChanged liên quan gì tới video play mode?"] TRƯỚC ĐÂY gắn ké vào case
 *     'visualBg.songChanged' (event/router/visual-bg.js, CHỈ Song dispatch được, không liên hệ
 *     khái niệm nào với Game Mode) — giờ có tín hiệu RIÊNG, trung lập, gửi từ CẢ
 *     `workflowPlayer.playMedia()` (Song) LẪN `workflowVideoPlayer.playVideoByKey()` (Video), hoạt
 *     động ĐÚNG cho cả 2 nguồn, KHÔNG còn phụ thuộc domain "visualBg" nữa);
 *   - vòng đời `gameplayPhase` (idle -> ready -> countdown -> playing -> ended, xem
 *     service/state/gameplay-runtime.js docstring) — RIÊNG BIỆT với gameplayModeEnabled ở trên;
 *   - tick() — KHÔNG tự có taskManager RAF riêng, được GỌI TỪ BÊN TRONG event/workflow/
 *     visualizer-render.js::_tick() (dùng CHUNG vòng lặp render có sẵn, tránh 2 RAF loop song song);
 *   - task đếm ngược 5s + task animation đếm điểm cuối bài (taskManager, đúng quy ước
 *     readme/task-manager-conventions.md, CẤM setTimeout thô);
 *   - lưu điểm cuối phiên vào record 'songs' (service/db.js, field `gameScores.circle`).
 *
 * [SỬA — Game Mode + Video Player mode, phản hồi Giang "áp dụng cho cả hai, dùng chung"] Toàn bộ
 * chỗ đụng trực tiếp `audioPlayer` (start/_beginPlaying/handleTap/tick/replay/exitToPlaylist) ĐÃ
 * ĐỔI sang `getActiveMediaElement(isVideoPlayerMode)` (core/player-controls.js — DÙNG CHUNG với
 * `workflowPlayerControls.goToNextTrack()`/`goToPrevTrack()`, KHÔNG viết thêm hàm riêng cho 2
 * đường). Router (event/router/player-controls.js) giờ gộp 1 case DÙNG CHUNG cho cả
 * 'playerControls.audio.ended' lẫn 'playerControls.video.ended' -> `onSongEnded()` (method này)
 * chạy đúng khi VIDEO hết bài lúc đang chơi Game Mode, không riêng Song nữa. Pitch/BPM/Energy
 * (đọc bởi tick() qua `currentCalculatedBpm`/`smoothedEnergy`/`lastValidMidiNote`, appState) KHÔNG
 * cần sửa gì — graph Web Audio của Video (`connectVideoElementToAnalyser()`, core/video-player.js)
 * đã nối CHUNG `analyser`/`analyserPitch` với Song từ trước (đợt VBG Audio B), tự hoạt động đúng
 * cho nguồn nào đang thực sự phát.
 *
 * Đúng Rule 3b (core-function-conventions.md): Workflow tự appState.get() TRƯỚC, gọi core/gameplay/
 * circle-mode.js (tính toán thuần) + core/gameplay/circle-mode-ui.js (canvas/DOM) THEO THỨ TỰ tại
 * đây — 2 file core đó TUYỆT ĐỐI không gọi lẫn nhau (Rule 3a). Màu vòng tròn (custom-effect.js::
 * getActiveEffectConfig() + core/color-utils.js::interpolateColor()) và globalHueOffset (audio-
 * analysis.js) cũng đọc/gọi Ở ĐÂY (Workflow), KHÔNG phải circle-mode.js — cùng lý do Rule 3a.
 *
 * Spawn khoá theo BEAT THẬT: so global `lastBeatTime` (core/dom-refs.js, KHÔNG thuộc appState) với
 * mốc đã tiêu thụ (`_lastConsumedBeatTime`) để biết vừa có beat mới hay chưa (điều kiện CẦN). Đủ
 * điều kiện rồi còn phải qua `isBeatEligibleForSpawn()` (độ khó Medium lọc bớt beat) VÀ roll xác
 * suất theo Energy (`computeSpawnProbability()`) mới THẬT SỰ spawn. Vị trí lấy từ lưới pitch→ô
 * (`gameplayPitchCellMap`, xây/refresh xem `_rebuildPitchCellMap()`), `shrinkDurationMs` theo BPM
 * hiện tại. Tất cả LƯU vào wave lúc spawn — sau đó wave co theo đồng hồ `performance.now()` riêng,
 * độc lập audio.currentTime (xem docstring đầy đủ ở core/gameplay/circle-mode.js).
 */
const GAMEPLAY_COUNTDOWN_TASK = 'gameplayCountdown';
const GAMEPLAY_SCORE_COUNTUP_TASK = 'gameplayScoreCountUp';
const GAMEPLAY_SCORE_COUNTUP_STEPS = 24;

const workflowGameplay = {
    _nextWaveId: 1,
    _nextSpawnIndex: 0,                // luân phiên màu A/B (mode dynamic), reset mỗi phiên
    _lastConsumedBeatTime: 0,          // snapshot lastBeatTime (global) đã dùng để xét spawn
    _beatsSinceEligible: 0,            // độ khó Medium: đếm beat để lọc "mỗi N beat mới xét spawn"
    _beatsSincePhraseRefresh: 0,       // xấp xỉ ranh giới phrase (đếm beat cố định)
    _gridCols: 1, _gridRows: 1,        // lưới pitch→ô hiện hành (tính lại lúc resize/vào ready)
    _zoneOriginX: 0, _zoneOriginY: 0,  // góc trên-trái spawnZone, px thật
    _canvasWidthPx: 0, _canvasHeightPx: 0,

    /** Ứng với 'gameplay.modeEnabled.change' (checkbox Settings). Bật ON kèm đang có bài load sẵn
     * -> mở LUÔN cho bài đó, không cần đợi bài kế tiếp. */
    setModeEnabled(checked) {
        setGameplayModeEnabled(checked); // core
        saveConfig(); // core — Workflow tự gọi CẢ HAI lần lượt (Rule 3a)

        if (checked && appState.get('currentKey')) this.start('circle');
    },

    /** Ứng với 'gameplay.start.click' — mở layer, vào phase 'ready', hiện modalChoice() hỏi Start
     * (kèm bộ chọn độ khó). CHƯA spawn wave nào (chờ người dùng bấm Start). Reset audio/video về 0
     * + pause NGAY — chỉ phát nhạc thật trong _beginPlaying() sau khi countdown xong.
     * [SỬA — Game Mode + Video Player mode, phản hồi Giang] `getActiveMediaElement(isVideoPlayerMode)`
     * (core/player-controls.js, DÙNG CHUNG với Next/Prev) thay hardcode `audioPlayer` — Game Mode
     * giờ hoạt động ĐÚNG khi đang phát Video (bgVideoElement) lẫn Song, không tạo cơ chế riêng. */
    start(mode) {
        this._resetSessionCounters();
        appState.set('gameplayMode', mode, { skipCheck: true });
        console.log(`writer: "workflowGameplay.start", page: "gameplayMode", content: "${mode}"`);
        appState.set('gameplayPhase', 'ready', { skipCheck: true });
        console.log(`writer: "workflowGameplay.start", page: "gameplayPhase", content: "ready"`);

        const activeEl = getActiveMediaElement(appState.get('isVideoPlayerMode')); // core/player-controls.js
        activeEl.currentTime = 0;
        activeEl.pause();

        showCircleGameplayLayer(gameplayLayer); // core-ui
        this._recomputeGridGeometry(); // canvas vừa hiện, clientWidth/Height đọc được rồi

        this._showReadyModal();
    },

    /** modalChoice() "Start" — DÙNG CHUNG cho start() VÀ replay(). bodyHtml nhúng bộ chọn độ khó
     * (mục "modalChoice bodyHtml"). 2 nút (Cancel/Start) -> vẫn hàng ngang bình thường (≤2). */
    _showReadyModal() {
        modalChoice(
            t('gameplayCircle.ready.text'),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => this.exitToPlaylist() },
                { label: t('gameplayCircle.ready.startLabel'), className: 'flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-sm font-semibold transition-colors', onClick: () => this.startCountdown() },
            ],
            { title: t('gameplayCircle.ready.title'), bodyHtml: this._buildDifficultySelectorHtml(appState.get('gameplayDifficulty')) }
        ); // core (core/modal-choice-ui.js)
        this._wireDifficultySelector();
    },

    _buildDifficultySelectorHtml(currentDifficulty) {
        const levels = ['easy', 'medium', 'hard'];
        const buttonsHtml = levels.map((level) => {
            const activeClass = level === currentDifficulty
                ? 'ring-2 ring-sky-400 bg-sky-500/20'
                : 'bg-slate-800 hover:bg-slate-700';
            return `<button type="button" data-difficulty="${level}" class="gameplay-difficulty-btn py-2 rounded-lg text-xs font-semibold transition-colors ${activeClass}">${t('gameplayCircle.difficulty.' + level)}</button>`;
        }).join('');
        return `<div class="grid grid-cols-3 gap-2">${buttonsHtml}</div>`;
    },

    /** Gắn click cho 3 nút độ khó vừa render qua bodyHtml — modalChoice() không biết gì về ngữ
     * nghĩa "độ khó", chỉ render đúng HTML đưa vào, nên phần tương tác riêng do Workflow tự lo (đọc
     * lại DOM qua #modal-choice-body — id cố định do modal-choice-ui.js luôn gán). */
    _wireDifficultySelector() {
        const buttons = document.querySelectorAll('#modal-choice-body .gameplay-difficulty-btn');
        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                appState.set('gameplayDifficulty', btn.dataset.difficulty, { skipCheck: true });
                console.log(`writer: "workflowGameplay._wireDifficultySelector", page: "gameplayDifficulty", content: "${btn.dataset.difficulty}"`);
                buttons.forEach((b) => b.classList.remove('ring-2', 'ring-sky-400', 'bg-sky-500/20'));
                buttons.forEach((b) => b.classList.add('bg-slate-800'));
                btn.classList.remove('bg-slate-800');
                btn.classList.add('ring-2', 'ring-sky-400', 'bg-sky-500/20');
            });
        });
    },

    /** Ứng với nút "Start" trong modalChoice() — bắt đầu đếm ngược GAMEPLAY_COUNTDOWN_SECONDS giây,
     * CHƯA spawn wave/phát nhạc trong lúc đếm. */
    startCountdown() {
        appState.set('gameplayPhase', 'countdown', { skipCheck: true });
        console.log(`writer: "workflowGameplay.startCountdown", page: "gameplayPhase", content: "countdown"`);
        appState.set('gameplayCountdownValue', GAMEPLAY_COUNTDOWN_SECONDS, { skipCheck: true });
        console.log(`writer: "workflowGameplay.startCountdown", page: "gameplayCountdownValue", content: "${GAMEPLAY_COUNTDOWN_SECONDS}"`);
        showGameplayCountdown(gameplayCountdownScreen, gameplayCountdownNumber, GAMEPLAY_COUNTDOWN_SECONDS); // core-ui

        taskManager.kill(GAMEPLAY_COUNTDOWN_TASK); // guard chống double-start nếu bấm Start dồn dập
        taskManager.addNew(GAMEPLAY_COUNTDOWN_TASK, { time: 1000, exe: () => this._countdownTick(), mode: 'timeout', count: GAMEPLAY_COUNTDOWN_SECONDS });
        taskManager.operator(GAMEPLAY_COUNTDOWN_TASK, 'enabled');
    },

    /** 1 nhịp đếm ngược — taskManager tự dừng sau đúng GAMEPLAY_COUNTDOWN_SECONDS lần. Lần cuối
     * (còn lại 0) -> chuyển sang playing. */
    _countdownTick() {
        const current = appState.get('gameplayCountdownValue');
        const next = current - 1;
        if (next > 0) {
            appState.set('gameplayCountdownValue', next, { skipCheck: true });
            console.log(`writer: "workflowGameplay._countdownTick", page: "gameplayCountdownValue", content: "${next}"`);
            showGameplayCountdown(gameplayCountdownScreen, gameplayCountdownNumber, next); // core-ui
            return;
        }
        hideGameplayCountdown(gameplayCountdownScreen); // core-ui
        this._beginPlaying();
    },

    /** Hết đếm ngược -> phát nhạc/video THẬT (mục cooldown — CHỈ ở đây, không phải lúc vào ready/
     * countdown) + cho phép tick() bắt đầu spawn wave từ frame kế tiếp.
     * [SỬA — Game Mode + Video Player mode] `.play()` qua `getActiveMediaElement()` — nhánh video
     * bọc `.catch()` (autoplay có thể bị chặn), CÙNG khuôn `workflowPlayerControls.goToNextTrack()`
     * xử lý repeat-mode-2. */
    _beginPlaying() {
        appState.set('gameplayPhase', 'playing', { skipCheck: true });
        console.log(`writer: "workflowGameplay._beginPlaying", page: "gameplayPhase", content: "playing"`);
        // Snapshot lastBeatTime NGAY LÚC NÀY — tránh 1 beat CŨ (detect trước khi countdown bắt đầu)
        // bị hiểu nhầm là "vừa mới có" rồi spawn ngay lập tức lúc vào playing.
        this._lastConsumedBeatTime = lastBeatTime;
        this._beatsSinceEligible = 0;
        this._beatsSincePhraseRefresh = 0;
        this._nextSpawnIndex = 0;
        const isVideoPlayerMode = appState.get('isVideoPlayerMode');
        const activeEl = getActiveMediaElement(isVideoPlayerMode); // core/player-controls.js
        if (isVideoPlayerMode) activeEl.play().catch((err) => console.error('[workflowGameplay] bgVideoElement.play() lỗi:', err));
        else activeEl.play();
    },

    /** Ứng với 'gameplay.tap.press' — CHỈ tính điểm khi phase='playing' (guard clause thuần).
     * @param {number} tapX @param {number} tapY — px thật (khớp hệ toạ độ canvas). */
    handleTap(tapX, tapY) {
        if (appState.get('gameplayPhase') !== 'playing') return;
        if (getActiveMediaElement(appState.get('isVideoPlayerMode')).paused) return; // tap lúc nhạc/video pause -> không tính, đồng bộ đúng lý do ở tick()
        const now = performance.now();
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const { gameplayWaves, gameplayComboStreak, gameplayTotalScore, gameplayCircleCount } = appState.get([
            'gameplayWaves', 'gameplayComboStreak', 'gameplayTotalScore', 'gameplayCircleCount',
        ]);
        if (gameplayWaves.length === 0) return; // không có wave nào -> không phải 1 note thật

        const entries = gameplayWaves.map(w => ({ id: w.id, x: w.x, y: w.y, radius: computeWaveRadius(w, now) })); // core, lặp ở Workflow
        const nearest = findNearestNoteByPosition(entries, tapX, tapY, cfg.tapHitTolerancePx); // core
        if (!nearest) return; // bấm hụt vào khoảng trống

        const tier = classifyTapTier(nearest.radius, cfg); // core
        const tierName = tier ? tier.name : 'miss';
        const tierScore = tier ? tier.score : 0;
        const { pointsGained, newComboStreak } = computeComboScoreGain(tierName, tierScore, gameplayComboStreak, cfg); // core

        const newTotalScore = gameplayTotalScore + pointsGained;
        const newCircleCount = gameplayCircleCount + 1;

        appState.mutate('gameplayWaves', arr => {
            const idx = arr.findIndex(w => w.id === nearest.id);
            if (idx !== -1) arr.splice(idx, 1);
        }, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayWaves", content: "remove ${nearest.id}"`);
        appState.set('gameplayComboStreak', newComboStreak, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayComboStreak", content: "${newComboStreak}"`);
        appState.set('gameplayTotalScore', newTotalScore, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayTotalScore", content: "+${pointsGained}"`);
        appState.set('gameplayCircleCount', newCircleCount, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayCircleCount", content: "${newCircleCount}"`);
        appState.mutate('gameplayHitCounts', counts => { counts[tierName] = (counts[tierName] || 0) + 1; }, { skipCheck: true });
        console.log(`writer: "workflowGameplay.handleTap", page: "gameplayHitCounts", content: "${tierName}+1"`);

        showTapTierPopup(gameplayTierPopupLayer, tierName.toUpperCase(), tierName, nearest.x, nearest.y); // core-ui
        updateGameplayHud(gameplayHudCombo, newComboStreak); // core-ui
    },

    /**
     * Gọi MỖI FRAME từ event/workflow/visualizer-render.js::_tick() — hot path 60fps, MIỄN Rule 4
     * console.log cho set()/mutate() bên trong (đúng ngoại lệ core-function-conventions.md Rule 4).
     */
    tick(now) {
        if (appState.get('gameplayPhase') !== 'playing') return;
        if (getActiveMediaElement(appState.get('isVideoPlayerMode')).paused) return; // overlay fullscreen khiến pause qua UI app không thể xảy ra lúc đang chơi — nhạc/video KHÔNG phát -> chưa/không còn circle nào tiến triển, hết
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

        // Nới dải pitch quan sát được — làm TRƯỚC bước spawn để note spawn ngay tick này (nếu có)
        // được hưởng dải mới nhất, không lệch 1 frame.
        const rangeUpdate = computePitchRangeUpdate(lastValidMidiNote, gameplayPitchRangeMin, gameplayPitchRangeMax); // core
        if (rangeUpdate.min !== gameplayPitchRangeMin || rangeUpdate.max !== gameplayPitchRangeMax) {
            appState.set('gameplayPitchRangeMin', rangeUpdate.min, { skipCheck: true });
            appState.set('gameplayPitchRangeMax', rangeUpdate.max, { skipCheck: true });
        }

        // Bảng gán pitch→ô: build LẦN ĐẦU (map rỗng) HOẶC refresh khi đang pending VÀ vừa hết wave
        // (KHÔNG ép re-target wave đang sống — chỉ chặn spawn mới, chờ board rỗng rồi mới xáo lại).
        let activeMap = gameplayPitchCellMap;
        let justRebuilt = false;
        if (activeMap.length === 0 || (gameplayRefreshPending && gameplayWaves.length === 0)) {
            activeMap = this._rebuildPitchCellMap(rangeUpdate.min, rangeUpdate.max);
            justRebuilt = true;
            if (gameplayRefreshPending) appState.set('gameplayRefreshPending', false, { skipCheck: true });
        }

        // `lastBeatTime` — biến GLOBAL (core/dom-refs.js, KHÔNG thuộc appState) — CHỈ dùng để SO
        // SÁNH THAY ĐỔI, không trừ khoảng cách.
        const isNewBeat = shouldSpawnCircleWave(gameplayWaves.length, diffCfg.maxConcurrentWaves, this._lastConsumedBeatTime, lastBeatTime); // core
        if (isNewBeat) {
            this._lastConsumedBeatTime = lastBeatTime;
            this._beatsSinceEligible++;
            this._beatsSincePhraseRefresh++;

            // Trigger refresh vị trí theo audio — CHỈ xét khi map đã có THẬT (tránh tự trigger ngay
            // sau lần build đầu) và CHƯA đang pending.
            if (!justRebuilt && !gameplayRefreshPending) {
                const energyTransition = detectFluxTransition(fluxHistory, 10, diffCfg.fluxDeltaEnergy); // core
                const sectionTransition = detectFluxTransition(fluxHistory, 10, diffCfg.fluxDeltaSection); // core
                const phraseBoundary = isPhraseBoundary(this._beatsSincePhraseRefresh, cfg.refreshBeatsForPhrase); // core
                if (energyTransition || sectionTransition || phraseBoundary) {
                    appState.set('gameplayRefreshPending', true, { skipCheck: true });
                    this._beatsSincePhraseRefresh = 0;
                }
            }

            if (!gameplayRefreshPending && isBeatEligibleForSpawn(this._beatsSinceEligible, diffCfg.spawnEligibleEveryNBeats)) { // core
                this._beatsSinceEligible = 0;
                const spawnProbability = computeSpawnProbability(smoothedEnergy, cfg); // core
                if (Math.random() < spawnProbability) {
                    this._trySpawnWave(now, cfg, activeMap, appState.get('gameplayWaves'), currentCalculatedBpm, lastValidMidiNote);
                }
            }
        }

        // Vật lý wave: bán kính/opacity mỗi frame + auto-miss.
        const waves = appState.get('gameplayWaves');
        const radiusEntries = waves.map((w) => {
            const radius = computeWaveRadius(w, now); // core
            return {
                id: w.id, x: w.x, y: w.y, radius,
                opacity: computeWaveOpacity(radius, cfg), // core
                colorMain: w.colorMain, colorLight: w.colorLight,
            };
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
                showTapTierPopup(gameplayTierPopupLayer, 'MISS', 'miss', entry.x, entry.y); // core-ui — fix bug: auto-miss trước đây không hiện popup, im lặng biến mất
            }
            updateGameplayHud(gameplayHudCombo, 0); // core-ui
        }

        const remainingEntries = radiusEntries.filter(e => !missedEntries.includes(e));
        const ctx = gameplayCanvas.getContext('2d');
        clearGameplayCanvas(ctx, this._canvasWidthPx, this._canvasHeightPx); // core-ui
        drawApproachRings(ctx, remainingEntries); // core-ui
        drawTargetCircles(ctx, remainingEntries.map(e => ({ x: e.x, y: e.y, centerRadius: cfg.centerRadius, colorMain: e.colorMain }))); // core-ui
    },

    /** Thử spawn 1 wave — tách khỏi tick() vì cần nhiều bước phụ thuộc nhau (tìm ô theo pitch, chống
     * đè hình, chọn màu theo effect đang chạy) không hợp để nhồi thẳng vào tick(). Bỏ qua lượt (chờ
     * beat kế) nếu vị trí quá gần 1 wave đang sống. */
    _trySpawnWave(now, cfg, pitchCellMap, currentWaves, bpmString, midiNote) {
        const cell = findCellForPitch(pitchCellMap, midiNote); // core
        const fallbackX = this._zoneOriginX + (this._gridCols * cfg.gridCellSizePx) / 2;
        const fallbackY = this._zoneOriginY + (this._gridRows * cfg.gridCellSizePx) / 2;
        const baseX = cell ? cell.cellX : fallbackX;
        const baseY = cell ? cell.cellY : fallbackY;
        const jittered = applyCellJitter(baseX, baseY, cfg, Math.random(), Math.random()); // core

        const activePositions = currentWaves.map(w => ({ x: w.x, y: w.y }));
        if (isPositionTooClose(jittered.x, jittered.y, activePositions, cfg.minSpawnDistancePx)) return; // core — bỏ lượt, chờ beat kế

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

        const wave = {
            id: this._nextWaveId++, spawnedAt: now, startRadius: cfg.waveStartRadius,
            shrinkDurationMs, x: jittered.x, y: jittered.y, colorMain, colorLight,
        };
        appState.mutate('gameplayWaves', arr => arr.push(wave), { skipCheck: true });
    },

    /** Tính lại lưới pitch→ô theo kích thước canvas HIỆN TẠI (đọc lại clientWidth/Height mỗi lần —
     * PHẢI gọi sau resize/lúc mở layer). Chỉ tính hình học lưới, KHÔNG tự xáo bảng gán (xem
     * _rebuildPitchCellMap() riêng — gọi tiếp ngay sau ở nơi cần cả 2). */
    _recomputeGridGeometry() {
        const size = resizeGameplayCanvas(gameplayCanvas); // core-ui
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

    /** Xáo lại bảng gán pitch→ô (bucket-hoá dải pitch quan sát được, shuffle vào lưới hiện hành) —
     * dùng cho build lần đầu, refresh theo audio (tick()), VÀ resize (_handleWindowResize()). */
    _rebuildPitchCellMap(pitchRangeMin, pitchRangeMax) {
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const totalCells = this._gridCols * this._gridRows;
        const randomValues = Array.from({ length: totalCells + 8 }, () => Math.random());
        const map = buildPitchCellMap(pitchRangeMin, pitchRangeMax, this._gridCols, this._gridRows, this._zoneOriginX, this._zoneOriginY, cfg, randomValues); // core
        appState.set('gameplayPitchCellMap', map, { skipCheck: true });
        console.log(`writer: "workflowGameplay._rebuildPitchCellMap", page: "gameplayPitchCellMap", content: "rebuilt ${map.length} cells"`);
        return map;
    },

    /** Resize/xoay màn hình giữa ván — tính lại lưới VÀ xáo lại bảng gán luôn (không gate qua
     * pending — đây là sự kiện hiếm, do người dùng chủ động, khác trigger tự động theo audio). */
    _handleWindowResize() {
        if (appState.get('gameplayPhase') === 'idle') return;
        this._recomputeGridGeometry();
        this._rebuildPitchCellMap(appState.get('gameplayPitchRangeMin'), appState.get('gameplayPitchRangeMax'));
    },

    /** Ứng với 'playerControls.audio.ended' HOẶC 'playerControls.video.ended' (DÙNG CHUNG 1 case ở
     * router, xem event/router/player-controls.js) KHI gameplayPhase !== 'idle'. Modal kết quả: sao
     * thật (reveal CSS animation) + điểm animation đếm dần lên (thực tế/lý thuyết) + % lệch +
     * breakdown hitCounts + 3 nút cơ chế cũ (Replay/Next/End — TỰ ĐỘNG thành dropdown vì >2 nút, xem
     * core/modal-choice-ui.js). */
    async onSongEnded() {
        stopListenClock(); // core — giữ PARITY với workflowPlayerControls.handleMediaEnded() thường
        const { gameplayTotalScore, gameplayCircleCount, gameplayHitCounts } = appState.get([
            'gameplayTotalScore', 'gameplayCircleCount', 'gameplayHitCounts',
        ]);
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const finalScore = computeFinalAverageScore(gameplayTotalScore, gameplayCircleCount); // core
        const perfectTier = cfg.tiers.find(tier => tier.name === 'perfect');
        const maxScore = gameplayCircleCount * perfectTier.score;
        const starRating = computeStarRating(gameplayTotalScore, maxScore, cfg); // core
        const deltaPercent = computeScoreDeltaPercent(gameplayTotalScore, maxScore); // core

        await this._persistScore(finalScore);

        appState.set('gameplayWaves', [], { skipCheck: true });
        console.log(`writer: "workflowGameplay.onSongEnded", page: "gameplayWaves", content: "cleared"`);
        appState.set('gameplayPhase', 'ended', { skipCheck: true });
        console.log(`writer: "workflowGameplay.onSongEnded", page: "gameplayPhase", content: "ended"`);

        const ctx = gameplayCanvas.getContext('2d');
        clearGameplayCanvas(ctx, this._canvasWidthPx, this._canvasHeightPx); // core-ui

        modalChoice(
            tFormat('gameplayCircle.ended.text', { score: finalScore.toFixed(3) }),
            [
                { label: t('gameplayCircle.ended.replayLabel'), onClick: () => this.replay() },
                { label: t('gameplayCircle.ended.nextLabel'), onClick: () => this.nextSong() },
                { label: t('gameplayCircle.ended.endLabel'), onClick: () => this.exitToPlaylist() },
            ],
            { title: t('gameplayCircle.ended.title'), bodyHtml: this._buildResultBodyHtml(starRating, gameplayHitCounts) }
        ); // core (core/modal-choice-ui.js) — 3 nút -> TỰ ĐỘNG render dropdown+"Chọn", không cần Workflow tự lo
        this._startScoreCountUpAnimation(gameplayTotalScore, maxScore, deltaPercent);
    },

    _buildResultBodyHtml(starRating, hitCounts) {
        const stars = Array.from({ length: GAMEPLAY_CIRCLE_CONFIG.starMax }, (_, i) => {
            const lit = i < starRating;
            return `<span class="gameplay-star${lit ? ' gameplay-star--lit' : ''}" style="animation-delay:${i * 150}ms">★</span>`;
        }).join('');

        const tierOrder = ['perfect', 'excellent', 'good', 'bad', 'miss'];
        const hitGrid = tierOrder.map((name) => `
            <div>
                <div class="font-mono font-bold text-white">${hitCounts[name] || 0}</div>
                <div class="text-[10px] text-slate-500">${t('gameplayCircle.ended.hitTier.' + name)}</div>
            </div>
        `).join('');

        return `
            <div class="flex flex-col items-center gap-3">
                <div class="flex gap-1 text-2xl" id="gameplay-star-row">${stars}</div>
                <div class="text-center">
                    <div class="font-mono text-2xl font-bold text-white" id="gameplay-score-countup">0</div>
                    <div class="text-xs mt-0.5" id="gameplay-score-delta"></div>
                </div>
                <div class="grid grid-cols-5 gap-2 text-center w-full pt-2 border-t border-white/10">${hitGrid}</div>
            </div>
        `;
    },

    /** Animation đếm điểm chạy dần lên 0 -> gameplayTotalScore/maxScore, kèm % lệch hiện SAU khi
     * đếm xong. Dùng taskManager mode 'interval' (CẤM setTimeout thô, đúng quy ước
     * readme/task-manager-conventions.md — cùng cách startCountdown() đang làm). */
    _startScoreCountUpAnimation(totalScore, maxScore, deltaPercent) {
        const scoreEl = document.getElementById('gameplay-score-countup');
        if (!scoreEl) return;
        let step = 0;

        taskManager.kill(GAMEPLAY_SCORE_COUNTUP_TASK);
        taskManager.addNew(GAMEPLAY_SCORE_COUNTUP_TASK, {
            time: 35,
            exe: () => {
                step++;
                const shown = Math.round(totalScore * (step / GAMEPLAY_SCORE_COUNTUP_STEPS));
                scoreEl.textContent = `${shown}/${maxScore}`;
                if (step >= GAMEPLAY_SCORE_COUNTUP_STEPS) {
                    scoreEl.textContent = `${totalScore}/${maxScore}`;
                    const deltaEl = document.getElementById('gameplay-score-delta');
                    if (deltaEl) {
                        const sign = deltaPercent > 0 ? '+' : (deltaPercent < 0 ? '-' : '');
                        const colorClass = deltaPercent > 0 ? 'text-emerald-400' : (deltaPercent < 0 ? 'text-rose-400' : 'text-slate-400');
                        deltaEl.textContent = `${sign}${Math.abs(deltaPercent).toFixed(1)}%`;
                        deltaEl.className = `text-xs mt-0.5 ${colorClass}`;
                    }
                    taskManager.operator(GAMEPLAY_SCORE_COUNTUP_TASK, 'disabled');
                }
            },
            mode: 'interval',
            count: GAMEPLAY_SCORE_COUNTUP_STEPS,
        });
        taskManager.operator(GAMEPLAY_SCORE_COUNTUP_TASK, 'enabled');
    },

    /** Đọc + ghi record 'songs' — CHỈ hợp lệ ở Workflow (Core cấm tuyệt đối đọc DB). Field
     * `gameScores.circle` — KHÔNG cần bump DB_VERSION (IndexedDB không ràng buộc schema value). */
    async _persistScore(finalScore) {
        const key = appState.get('currentKey');
        if (!key) return;
        const record = await getSongRecord(key); // service/db.js
        if (!record) return;
        if (!record.gameScores) record.gameScores = {};
        if (!record.gameScores.circle) record.gameScores.circle = [];
        record.gameScores.circle.push({ time: Date.now(), score: finalScore });
        await setSongRecord(key, record); // service/db.js
    },

    /** Nút "Chơi lại" — phát lại ĐÚNG bài/video hiện tại từ đầu, quay về phase 'ready' + hiện lại
     * modal Start (mọi lượt chơi đều qua Start/countdown, kể cả replay). Reset về 0 + PAUSE (không
     * `.play()` ngay — đúng gate cooldown, chỉ phát nhạc thật trong _beginPlaying()). */
    replay() {
        const activeEl = getActiveMediaElement(appState.get('isVideoPlayerMode')); // core/player-controls.js
        activeEl.currentTime = 0;
        activeEl.pause();
        this._resetSessionCounters();
        appState.set('gameplayPhase', 'ready', { skipCheck: true });
        console.log(`writer: "workflowGameplay.replay", page: "gameplayPhase", content: "ready"`);
        this._showReadyModal();
    },

    /** Nút "Bài tiếp theo" — `workflowPlayerControls.goToNextTrack(true)` (Workflow gọi Workflow
     * khác miền, tự do — event-bus-flow.md mục 3a; [SỬA — plan-playmedia-reorg.md] thay
     * `playNext(true)` cũ, core/player-controls.js, ĐÃ XOÁ) TỰ wrap về đầu playlist nếu đang ở bài
     * cuối. KHÔNG tự mở lại modal ready: hook TỰ ĐỘNG ở event/router/gameplay.js case
     * 'gameplay.mediaChanged' đã lo việc đó (thay case 'visualBg.songChanged' cũ — xem docstring
     * đầu file). CHỈ fallback gọi start() thủ công cho ĐÚNG 1 trường hợp: playlist chỉ có 1 bài ->
     * goToNextTrack(true) trả về NGUYÊN key cũ -> không bắn 'gameplay.mediaChanged'. */
    nextSong() {
        const previousKey = appState.get('currentKey');
        workflowPlayerControls.goToNextTrack(true); // event/workflow/player-controls.js
        if (appState.get('currentKey') === previousKey) this.start('circle');
    },

    /** Ứng với 'gameplay.exit.click' (nút X cố định) HOẶC nút "Cancel"/"Về Playlist" trong
     * modalChoice() — thoát hẳn Game Mode, tự pause nhạc/video, tái dùng luồng "Back to Playlist"
     * có sẵn. */
    exitToPlaylist() {
        appState.set('gameplayPhase', 'idle', { skipCheck: true });
        console.log(`writer: "workflowGameplay.exitToPlaylist", page: "gameplayPhase", content: "idle"`);
        taskManager.kill(GAMEPLAY_COUNTDOWN_TASK);
        taskManager.kill(GAMEPLAY_SCORE_COUNTUP_TASK);

        getActiveMediaElement(appState.get('isVideoPlayerMode')).pause(); // core/player-controls.js

        hideGameplayCountdown(gameplayCountdownScreen); // core-ui
        hideCircleGameplayLayer(gameplayLayer); // core-ui
        const ctx = gameplayCanvas.getContext('2d');
        clearGameplayCanvas(ctx, this._canvasWidthPx || gameplayCanvas.clientWidth, this._canvasHeightPx || gameplayCanvas.clientHeight); // core-ui

        eventBus.send({ router: 'playerControls', type: 'playerControls.backToPlaylist.click', payload: {} });
    },

    _resetSessionCounters() {
        this._lastConsumedBeatTime = lastBeatTime; // tránh beat cũ (bài/phiên trước) bị tính là "mới"
        this._beatsSinceEligible = 0;
        this._beatsSincePhraseRefresh = 0;
        this._nextSpawnIndex = 0;

        appState.set('gameplayWaves', [], { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayWaves", content: "reset"`);
        appState.set('gameplayComboStreak', 0, { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayComboStreak", content: "0"`);
        appState.set('gameplayTotalScore', 0, { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayTotalScore", content: "0"`);
        appState.set('gameplayCircleCount', 0, { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayCircleCount", content: "0"`);
        appState.set('gameplayHitCounts', { perfect: 0, excellent: 0, good: 0, bad: 0, miss: 0 }, { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayHitCounts", content: "reset"`);
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
// tiền lệ core/canvas-scene-setup.js cho canvas visualizer chính, cùng loại ngoại lệ browser-level
// đứng ngoài /event/ bus).
window.addEventListener('resize', () => workflowGameplay._handleWindowResize());
