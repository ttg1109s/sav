/**
 * event/workflow/gameplay-arrow.js — MỚI (07/10/2026, Giang yêu cầu game "Arrow"). Workflow RIÊNG mode "Arrow" (id
 * 'arrow', core/gameplay/catalog.js). Đếm ngược / reset điểm / modal End / lưu điểm DÙNG CHUNG
 * event/workflow/gameplay-engine.js (cùng khuôn Circle, event/workflow/gameplay.js). Lối vào chung (arm, đổi media,
 * nút X, hết media, tick) tới đây qua bảng điều phối theo mode của gameplay-engine.js.
 *
 * Cơ chế (yêu cầu Giang):
 *   - Mỗi VÒNG = nút tròn trên thanh tiến trình chạy 0 -> 100% (thời lượng theo BPM + tăng tốc —
 *     core/gameplay/arrow-mode.js::computeArrowRoundTiming()), kèm 1 dải mũi tên `level` ô.
 *   - Bấm hướng trên bàn phím tròn: đúng -> ô xanh lá, sang ô kế; sai -> không tính VÀ huỷ mọi ô đã đúng, nhập lại từ
 *     đầu (applyArrowInput()). Vòng đỏ = phải bấm NGƯỢC hướng hiển thị.
 *   - Enter: nút tròn trong vùng đích (tâm 80% + dải blur) VÀ đã nhập đủ dải -> perfect/excellent/good/bad theo độ lệch;
 *     ngoài vùng / chưa đủ dải -> miss. Chạy tới 100% mà chưa commit -> miss. Mỗi vòng chấm đúng 1 lần.
 *   - Hết vòng (100%) -> lên level (quá maxLevel quay về đầu, lap + 1 = mốc tăng tốc), mở dải mới từ 0%.
 *   - Điểm/combo/breakdown dùng chung field engine (`gameplayTotalScore`, `gameplayCircleCount` = số VÒNG đã chấm,
 *     `gameplayHitCounts`, `gameplayComboByTier`) + core chung engine.js (computeComboScoreGain/computeStarRating...).
 *
 * State 1 vòng (`_round`) + level/lap là field RIÊNG của Workflow này (chỉ file này đọc/ghi — cùng lý do field riêng của
 * workflowStatisPanel / `_hardChainQueue` của Circle), không đưa vào appState. Core trả object kết quả, Workflow chỉ gán
 * lại (event-bus-flow.md mục 7.1). Rẽ nhánh theo kết quả nhập = object map (mục 7.2).
 *
 * NẠP SAU: core/gameplay/arrow-config.js, core/gameplay/arrow-mode.js, core/gameplay/arrow-stage.js,
 * core/gameplay/engine.js, core/gameplay/engine-ui.js, components/gameplay-arrow-stage.js
 * (renderGameplayArrowStripHtml), core/player-controls.js (getActiveMediaElement, setPlayerControlsBlocked),
 * event/workflow/gameplay-engine.js, event/workflow/gameplay.js (GAMEPLAY_NEXT_LABEL_KEY_BY_MEDIA),
 * event/workflow/placeholder-panels.js, core/dom-refs.js.
 * NẠP TRƯỚC: event/router/gameplay.js.
 */
const GAMEPLAY_ARROW_MODE_ID = 'arrow';
const GAMEPLAY_ARROW_TIER_ORDER = ['perfect', 'excellent', 'good', 'bad', 'miss'];
const GAMEPLAY_ARROW_TIER_LABEL_KEY_BY_NAME = {
    perfect: 'gameplayCircle.ended.hitTier.perfect',
    excellent: 'gameplayCircle.ended.hitTier.excellent',
    good: 'gameplayCircle.ended.hitTier.good',
    bad: 'gameplayCircle.ended.hitTier.bad',
    miss: 'gameplayCircle.ended.hitTier.miss',
};
// Nhãn "Đã chơi N lần" số ít/nhiều — khoá boolean do core computeArrowEndExtras() trả. Key số ít không có {count},
// tFormat() trả nguyên chuỗi.
const GAMEPLAY_ARROW_PLAY_COUNT_KEY_BY_PLURAL = {
    true: 'gameplayCircle.ended.playCountLabel.plural',
    false: 'gameplayCircle.ended.playCountLabel.singular',
};
// Nhãn độ khó ở modal kết quả — tra bảng thay vì ghép chuỗi key trong Workflow (§7.1).
const GAMEPLAY_ARROW_DIFFICULTY_LABEL_KEY_BY_ID = {
    easy: 'gameplayCircle.difficulty.easy',
    medium: 'gameplayCircle.difficulty.medium',
    hard: 'gameplayCircle.difficulty.hard',
};
// Phản hồi theo kết quả 1 lần bấm hướng (core applyArrowInput() trả `outcome`).
const GAMEPLAY_ARROW_INPUT_FEEDBACK_BY_OUTCOME = {
    correct: () => workflowGameplayArrow._paintInputProgress(false),
    complete: () => workflowGameplayArrow._paintInputProgress(true),
    wrong: () => workflowGameplayArrow._paintWrongInput(),
    ignored: () => {}, // dải đã đủ, chờ Enter — no-op có chủ đích
};

const workflowGameplayArrow = {
    _diffCfg: GAMEPLAY_ARROW_CONFIG.difficulty.hard,
    _level: 1,
    _lap: 0,
    _round: null, // { arrows, inputIndex, periodMs, elapsedMs, lastTickAt, progressPercent, isResolved } | null

    // ===================== Vòng đời phiên =====================

    /** Mở phiên — từ workflowGameplayEngine.startMode('arrow') (game armed + media đổi, hoặc armed lúc đã có media).
     * Đóng Game Panel (đúng hành động nút X), media về đầu, hiện stage Arrow, khoá + ẩn thanh phát nhạc đáy màn (chỗ cho
     * bàn phím), vẽ vùng đích theo config, rồi THẲNG vào đếm ngược (cùng khuôn workflowGameplay.start()). */
    start() {
        const { isVideoPlayerMode, isPhotoPlayerMode, gameplayDifficulty } = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode', 'gameplayDifficulty']);
        this._resetSession(gameplayDifficulty);
        appState.set('gameplayMode', GAMEPLAY_ARROW_MODE_ID, { skipCheck: true });
        console.log(`writer: "workflowGameplayArrow.start", page: "gameplayMode", content: "${GAMEPLAY_ARROW_MODE_ID}"`);
        appState.set('gameplayPhase', 'ready', { skipCheck: true });
        console.log(`writer: "workflowGameplayArrow.start", page: "gameplayPhase", content: "ready"`);

        workflowPlaceholderPanels.close(gamePanel); // event/workflow/placeholder-panels.js — idempotent
        resetGameplayMediaToStart(getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode)); // core (engine.js) + core/player-controls.js

        setGameplayLayerMode(gameplayLayer, GAMEPLAY_ARROW_MODE_ID); // core-ui (engine-ui.js)
        showGameplayLayer(gameplayLayer); // core-ui (engine-ui.js)
        setPlayerControlsBlocked(true); // core (player-controls.js)
        setGameplayPlayerBarHidden(playerContainer, true); // core-ui (engine-ui.js)
        paintArrowTargetZone(gameplayArrowZone, gameplayArrowTarget, computeArrowTargetZoneGeometry(GAMEPLAY_ARROW_CONFIG)); // core (arrow-stage.js) + core
        this._paintIdleStage();

        this.startCountdown();
    },

    startCountdown() {
        appState.set('gameplayPhase', 'countdown', { skipCheck: true });
        console.log(`writer: "workflowGameplayArrow.startCountdown", page: "gameplayPhase", content: "countdown"`);
        workflowGameplayEngine.startCountdown(() => this._beginPlaying());
    },

    /** Hết đếm ngược -> mở vòng đầu + phát media thật. */
    _beginPlaying() {
        const { isVideoPlayerMode, isPhotoPlayerMode } = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode']);
        appState.set('gameplayPhase', 'playing', { skipCheck: true });
        console.log(`writer: "workflowGameplayArrow._beginPlaying", page: "gameplayPhase", content: "playing"`);
        this._beginRound(performance.now());
        startGameplayMedia(getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode)); // core (engine.js)
    },

    /** Nút "Chơi lại" ở modal kết quả — media về đầu, phiên mới từ level đầu, thẳng vào đếm ngược. */
    replay() {
        const { isVideoPlayerMode, isPhotoPlayerMode, gameplayDifficulty } = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode', 'gameplayDifficulty']);
        resetGameplayMediaToStart(getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode)); // core (engine.js)
        this._resetSession(gameplayDifficulty);
        appState.set('gameplayPhase', 'ready', { skipCheck: true });
        console.log(`writer: "workflowGameplayArrow.replay", page: "gameplayPhase", content: "ready"`);
        this._paintIdleStage();
        this.startCountdown();
    },

    /** Thoát hẳn — nút X overlay / "Về Playlist" ở modal / disarm trên Game Panel (qua workflowGameplayEngine.
     * exitActiveMode()). Dừng mọi task phiên, media về đầu, ẩn layer, mở lại + hiện thanh phát nhạc, về Playlist. */
    exitToPlaylist() {
        const { isVideoPlayerMode, isPhotoPlayerMode } = appState.get(['isVideoPlayerMode', 'isPhotoPlayerMode']);
        appState.set('gameplayPhase', 'idle', { skipCheck: true });
        console.log(`writer: "workflowGameplayArrow.exitToPlaylist", page: "gameplayPhase", content: "idle"`);
        taskManager.kill(GAMEPLAY_COUNTDOWN_TASK);
        taskManager.kill(GAMEPLAY_SCORE_COUNTUP_TASK);
        this._round = null;

        resetGameplayMediaToStart(getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode)); // core (engine.js)
        hideGameplayCountdown(gameplayCountdownScreen); // core-ui
        hideGameplayLayer(gameplayLayer); // core-ui
        setPlayerControlsBlocked(false); // core (player-controls.js)
        setGameplayPlayerBarHidden(playerContainer, false); // core-ui
        this._paintIdleStage();

        eventBus.send({ router: 'playerControls', type: 'playerControls.backToPlaylist.click', payload: {} });
    },

    /** Hết bài/video/ảnh lúc đang ở Game (router player-controls -> workflowGameplayEngine.onActiveModeMediaEnded()).
     * Vòng đang dở (chưa chấm) bỏ qua, không tính. Đọc thời lượng/loại media TRƯỚC khi lưu điểm (Next đổi currentKey). */
    async onMediaEnded() {
        workflowListenStats.stopClock(); // event/workflow/listen-stats.js — parity với Circle / handleMediaEnded()
        const cfg = GAMEPLAY_ARROW_CONFIG;
        const {
            gameplayTotalScore, gameplayCircleCount, gameplayHitCounts, gameplayDifficulty,
            isVideoPlayerMode, isPhotoPlayerMode, playlistCache, currentKey,
        } = appState.get([
            'gameplayTotalScore', 'gameplayCircleCount', 'gameplayHitCounts', 'gameplayDifficulty',
            'isVideoPlayerMode', 'isPhotoPlayerMode', 'playlistCache', 'currentKey',
        ]);
        this._round = null; // tick()/bàn phím dừng ngay, kể cả lúc chờ lưu điểm
        this._paintIdleStage();

        const durationLabel = formatTime(getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode).duration); // core (core/playlist/state.js)
        const endedCached = playlistCache.get(currentKey);
        const nextLabelKey = GAMEPLAY_NEXT_LABEL_KEY_BY_MEDIA[endedCached && endedCached.mediaType] || GAMEPLAY_NEXT_LABEL_KEY_BY_MEDIA.song; // event/workflow/gameplay.js
        const playingMediaType = isVideoPlayerMode ? 'video' : (isPhotoPlayerMode ? 'photo' : 'song'); // chọn giá trị, cùng nguồn getActiveMediaElement()

        const finalScore = computeFinalAverageScore(gameplayTotalScore, gameplayCircleCount); // core (engine.js)
        const { title, playCount } = await workflowGameplayEngine.persistScore(GAMEPLAY_ARROW_MODE_ID, gameplayDifficulty, finalScore, playingMediaType);
        const extras = computeArrowEndExtras(gameplayCircleCount, playCount, cfg); // core (arrow-mode.js)
        const starRating = computeStarRating(gameplayTotalScore, extras.maxScore, cfg); // core (engine.js)

        appState.set('gameplayPhase', 'ended', { skipCheck: true });
        console.log(`writer: "workflowGameplayArrow.onMediaEnded", page: "gameplayPhase", content: "ended"`);

        workflowGameplayEngine.showEndModal({
            finalScore, totalScore: gameplayTotalScore, maxScore: extras.maxScore, starMax: cfg.starMax, starRating,
            hitCounts: gameplayHitCounts,
            tierOrder: GAMEPLAY_ARROW_TIER_ORDER,
            tierLabels: {
                perfect: t(GAMEPLAY_ARROW_TIER_LABEL_KEY_BY_NAME.perfect),
                excellent: t(GAMEPLAY_ARROW_TIER_LABEL_KEY_BY_NAME.excellent),
                good: t(GAMEPLAY_ARROW_TIER_LABEL_KEY_BY_NAME.good),
                bad: t(GAMEPLAY_ARROW_TIER_LABEL_KEY_BY_NAME.bad),
                miss: t(GAMEPLAY_ARROW_TIER_LABEL_KEY_BY_NAME.miss),
            },
            title: escapeHtml(title), // core (modal-choice-ui.js) — tên file/tag là dữ liệu người dùng
            durationLabel,
            difficultyLabel: t(GAMEPLAY_ARROW_DIFFICULTY_LABEL_KEY_BY_ID[gameplayDifficulty] || GAMEPLAY_ARROW_DIFFICULTY_LABEL_KEY_BY_ID.hard),
            playCountLabel: tFormat(GAMEPLAY_ARROW_PLAY_COUNT_KEY_BY_PLURAL[extras.isPluralPlayCount], { count: playCount }),
            nextLabel: t(nextLabelKey),
            onReplay: () => this.replay(),
            onNext: () => workflowPlayerControls.goToNextTrack(true), // event/workflow/player-controls.js — sang media kế; 'gameplay.mediaChanged' tự mở lại phiên (game vẫn armed)
            onEnd: () => this.exitToPlaylist(),
        });
    },

    // ===================== Mỗi frame =====================

    /** Hot path (event/workflow/audio-analysis.js -> workflowGameplayEngine.tickActiveMode()) — CHỈ guard + core.
     * Media đang dừng -> nút tròn đứng yên (mốc frame trước giữ nguyên; frame chạy lại đầu tiên bị kẹp maxFrameDeltaMs). */
    tick(now) {
        const { gameplayPhase, isVideoPlayerMode, isPhotoPlayerMode } = appState.get(['gameplayPhase', 'isVideoPlayerMode', 'isPhotoPlayerMode']);
        const round = this._round;
        if (gameplayPhase !== 'playing' || !round) return;
        if (getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode).paused) return; // core/player-controls.js

        const step = advanceArrowCursor(round.elapsedMs, round.lastTickAt, now, round.periodMs, GAMEPLAY_ARROW_CONFIG.maxFrameDeltaMs); // core
        round.elapsedMs = step.elapsedMs;
        round.lastTickAt = now;
        round.progressPercent = step.progressPercent;
        paintArrowCursor(gameplayArrowCursorRail, gameplayArrowTrackFill, step.progressPercent); // core (arrow-stage.js)

        if (step.hasWrapped) this._finishRound(now); // bước tuỳ chọn — chạm 100%
    },

    // ===================== Bàn phím =====================

    /** 'gameplay.arrow.direction.press' — 1 lần bấm hướng (0..7). Vòng đã chấm (đã commit) -> bỏ qua tới vòng sau. */
    handleDirection(dir) {
        const { gameplayPhase, isVideoPlayerMode, isPhotoPlayerMode } = appState.get(['gameplayPhase', 'isVideoPlayerMode', 'isPhotoPlayerMode']);
        const round = this._round;
        if (gameplayPhase !== 'playing' || !round || round.isResolved) return;
        if (getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode).paused) return;

        const result = applyArrowInput(round.arrows, round.inputIndex, dir); // core
        round.inputIndex = result.inputIndex;
        GAMEPLAY_ARROW_INPUT_FEEDBACK_BY_OUTCOME[result.outcome]();
    },

    /** 'gameplay.arrow.commit.press' — Enter: chấm theo vị trí nút tròn hiện tại (frame gần nhất). Mỗi vòng 1 lần. */
    handleCommit() {
        const { gameplayPhase, isVideoPlayerMode, isPhotoPlayerMode } = appState.get(['gameplayPhase', 'isVideoPlayerMode', 'isPhotoPlayerMode']);
        const round = this._round;
        if (gameplayPhase !== 'playing' || !round || round.isResolved) return;
        if (getActiveMediaElement(isVideoPlayerMode, isPhotoPlayerMode).paused) return;

        const tier = classifyArrowCommitTier(round.progressPercent, round.inputIndex, round.arrows.length, GAMEPLAY_ARROW_CONFIG); // core
        this._resolveRound(tier);
    },

    // ===================== Nội bộ =====================

    /** Phiên mới: level đầu của độ khó, lap 0, xoá vòng, reset điểm/combo chung (engine). Độ khó lạ -> hard. */
    _resetSession(difficulty) {
        this._diffCfg = GAMEPLAY_ARROW_CONFIG.difficulty[difficulty] || GAMEPLAY_ARROW_CONFIG.difficulty.hard;
        this._level = this._diffCfg.minLevel;
        this._lap = 0;
        this._round = null;
        workflowGameplayEngine.resetScoreCounters();
    },

    /** Mở 1 vòng: dải mũi tên theo level (random do Workflow chuẩn bị), thời lượng theo BPM + lap, vẽ lại stage. */
    _beginRound(now) {
        const cfg = GAMEPLAY_ARROW_CONFIG;
        const randomValues = Array.from({ length: cfg.randomPoolSize }, () => Math.random()); // chuẩn bị input ngẫu nhiên (Core không tự random)
        const arrows = buildArrowRoundArrows(this._level, this._diffCfg, cfg, randomValues); // core
        const timing = computeArrowRoundTiming(audioAnalysis.bpmText(), this._lap, this._diffCfg, cfg); // core + service/audio-analysis.js
        this._round = { arrows, inputIndex: 0, periodMs: timing.periodMs, elapsedMs: 0, lastTickAt: now, progressPercent: 0, isResolved: false };

        paintArrowStrip(gameplayArrowStrip, renderGameplayArrowStripHtml(arrows)); // core (arrow-stage.js) + components/gameplay-arrow-stage.js
        paintArrowStripProgress(gameplayArrowStrip, 0); // core (arrow-stage.js)
        paintArrowCommitReady(btnGameplayArrowCommit, false); // core (arrow-stage.js)
        paintArrowCursor(gameplayArrowCursorRail, gameplayArrowTrackFill, 0); // core (arrow-stage.js)
        paintArrowHud(gameplayArrowLevel, gameplayArrowSpeed, this._level, timing.speedMultiplier); // core (arrow-stage.js)
    },

    /** Nút tròn chạm 100%: vòng chưa commit -> miss; lên level rồi mở vòng mới. */
    _finishRound(now) {
        if (!this._round.isResolved) this._resolveRound({ name: 'miss', score: GAMEPLAY_ARROW_CONFIG.missScore }); // bước tuỳ chọn
        const next = computeNextArrowLevel(this._level, this._lap, this._diffCfg); // core
        this._level = next.level;
        this._lap = next.lap;
        this._beginRound(now);
    },

    /** Chấm 1 vòng (commit hoặc hết giờ) — điểm + combo + breakdown (core chung engine.js), khoá vòng, hiện kết quả. */
    _resolveRound(tier) {
        const cfg = GAMEPLAY_ARROW_CONFIG;
        const { gameplayComboByTier, gameplayTotalScore, gameplayCircleCount, gameplayHitCounts } = appState.get([
            'gameplayComboByTier', 'gameplayTotalScore', 'gameplayCircleCount', 'gameplayHitCounts',
        ]);
        const { pointsGained, newComboByTier } = computeComboScoreGain(tier.name, tier.score, gameplayComboByTier, cfg); // core (engine.js)
        const totals = computeScoreTotalsAfterResolve(gameplayTotalScore, gameplayCircleCount, gameplayHitCounts, tier.name, pointsGained); // core (engine.js)
        this._round.isResolved = true;

        appState.set('gameplayComboByTier', newComboByTier, { skipCheck: true });
        console.log(`writer: "workflowGameplayArrow._resolveRound", page: "gameplayComboByTier", content: "${JSON.stringify(newComboByTier)}"`);
        appState.set('gameplayTotalScore', totals.totalScore, { skipCheck: true });
        console.log(`writer: "workflowGameplayArrow._resolveRound", page: "gameplayTotalScore", content: "${totals.totalScore}"`);
        appState.set('gameplayCircleCount', totals.resolvedCount, { skipCheck: true });
        console.log(`writer: "workflowGameplayArrow._resolveRound", page: "gameplayCircleCount", content: "${totals.resolvedCount}"`);
        appState.set('gameplayHitCounts', totals.hitCounts, { skipCheck: true });
        console.log(`writer: "workflowGameplayArrow._resolveRound", page: "gameplayHitCounts", content: "${tier.name}+1"`);

        paintArrowStripResult(gameplayArrowStrip, tier.name); // core (arrow-stage.js)
        paintArrowCommitReady(btnGameplayArrowCommit, false); // core (arrow-stage.js)
        const anchor = computeArrowPopupAnchor(gameplayArrowStrip.getBoundingClientRect(), gameplayLayer.getBoundingClientRect()); // đọc kích thước (chuẩn bị) -> core thuần tính toạ độ
        showTapTierPopup(gameplayTierPopupLayer, t(GAMEPLAY_ARROW_TIER_LABEL_KEY_BY_NAME[tier.name]), tier.name, anchor.x, anchor.y, newComboByTier[tier.name] || 0, cfg); // core-ui (engine-ui.js)
    },

    /** Bấm đúng — tô lại tiến độ dải; `isComplete` -> nút Enter sáng chờ commit. */
    _paintInputProgress(isComplete) {
        paintArrowStripProgress(gameplayArrowStrip, this._round.inputIndex); // core (arrow-stage.js)
        paintArrowCommitReady(btnGameplayArrowCommit, isComplete); // core (arrow-stage.js)
    },

    /** Bấm sai — mọi ô về chưa nhập, dải rung. */
    _paintWrongInput() {
        paintArrowStripProgress(gameplayArrowStrip, this._round.inputIndex); // core (arrow-stage.js) (inputIndex đã về 0)
        paintArrowCommitReady(btnGameplayArrowCommit, false); // core (arrow-stage.js)
        flashArrowStripWrong(gameplayArrowStrip); // core (arrow-stage.js)
    },

    /** Stage rỗng (trước đếm ngược / sau khi thoát / hết bài): không dải, nút tròn ở 0%, Enter tắt, HUD level đầu. */
    _paintIdleStage() {
        paintArrowStrip(gameplayArrowStrip, ''); // core (arrow-stage.js)
        paintArrowCursor(gameplayArrowCursorRail, gameplayArrowTrackFill, 0); // core (arrow-stage.js)
        paintArrowCommitReady(btnGameplayArrowCommit, false); // core (arrow-stage.js)
        paintArrowHud(gameplayArrowLevel, gameplayArrowSpeed, this._level, 1); // core (arrow-stage.js)
    },
};
