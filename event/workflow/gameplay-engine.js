/**
 * event/workflow/gameplay-engine.js — Workflow dùng chung mọi mode Game: điều phối theo mode (start/exit/hết media/tick),
 * đếm ngược trước khi chơi, modal Kết quả (vòng % + sao + đếm-lên điểm + breakdown tier, không tiêu đề), lưu điểm vào meta
 * media. Phần riêng từng mode: event/workflow/gameplay.js (Circle), event/workflow/gameplay-arrow.js (Arrow). Độ khó chọn sẵn
 * trên card Game Panel (event/workflow/game-catalog.js) — không có modal chọn độ khó.
 *
 * NẠP SAU: core/gameplay/engine.js, core/gameplay/engine-ui.js, components/gameplay-overlay.js, core/modal-choice-ui.js,
 * core/number-countup.js, event/workflow/number-countup.js, core/file-manager/video.js (stripFileExtension),
 * service/task-manager.js, service/db.js, lang/lang.js.
 */
const GAMEPLAY_COUNTDOWN_TASK = 'gameplayCountdown';
const GAMEPLAY_SCORE_COUNTUP_TASK = 'gameplayScoreCountUp';
const GAMEPLAY_SCORE_COUNTUP_STEPS = 24;
const GAMEPLAY_SCORE_RING_MAX_EXTRA_LAPS = 3;
const GAMEPLAY_SCORE_RING_PALETTE = ['#38bdf8', '#4ade80', '#fbbf24', '#f472b6']; // sky/emerald/amber/pink-400
// Điểm Game nằm trong META của media (service/db.js updateMediaMeta(), không đụng Blob); loại media hợp lệ làm `type`.
const GAMEPLAY_SCORE_MEDIA_TYPES = new Set(['song', 'video', 'photo']);

// Nhãn modal Kết quả dùng chung mọi mode (resolveEndModalLabels()).
const GAMEPLAY_TIER_ORDER = Object.freeze(['perfect', 'excellent', 'good', 'bad', 'miss']);
const GAMEPLAY_TIER_LABEL_KEY_BY_NAME = {
    perfect: 'gameplayCircle.ended.hitTier.perfect',
    excellent: 'gameplayCircle.ended.hitTier.excellent',
    good: 'gameplayCircle.ended.hitTier.good',
    bad: 'gameplayCircle.ended.hitTier.bad',
    miss: 'gameplayCircle.ended.hitTier.miss',
};
const GAMEPLAY_DIFFICULTY_LABEL_KEY_BY_ID = {
    easy: 'gameplayCircle.difficulty.easy',
    medium: 'gameplayCircle.difficulty.medium',
    hard: 'gameplayCircle.difficulty.hard',
};
// "Đã chơi N lần" số ít/nhiều (key số ít không có {count}, tFormat() trả nguyên chuỗi).
const GAMEPLAY_PLAY_COUNT_KEY_BY_PLURAL = {
    true: 'gameplayCircle.ended.playCountLabel.plural',
    false: 'gameplayCircle.ended.playCountLabel.singular',
};
// Nút Next theo loại media vừa chơi (Next đi tiếp trong cùng playlist nên cùng loại); loại lạ -> nhãn Song.
const GAMEPLAY_NEXT_LABEL_KEY_BY_MEDIA = {
    song: 'gameplayCircle.ended.nextLabel',
    video: 'gameplayCircle.ended.nextVideoLabel',
    photo: 'gameplayCircle.ended.nextPhotoLabel',
};

// Điều phối theo mode cho các lối vào dùng chung (event-bus-flow.md §7.2). Khoá = `id` game (core/gameplay/catalog.js) =
// `gameplayMode`; arrow function tra lúc chạy nên workflow mode nạp SAU file này vẫn an toàn. Thêm game: thêm 1 dòng mỗi bảng.
const GAMEPLAY_START_BY_MODE = {
    circle: () => workflowGameplay.start('circle'),
    arrow: () => workflowGameplayArrow.start(),
};
const GAMEPLAY_EXIT_BY_MODE = {
    circle: () => workflowGameplay.exitToPlaylist(),
    arrow: () => workflowGameplayArrow.exitToPlaylist(),
};
const GAMEPLAY_MEDIA_ENDED_BY_MODE = {
    circle: () => workflowGameplay.onSongEnded(),
    arrow: () => workflowGameplayArrow.onMediaEnded(),
};
const GAMEPLAY_TICK_BY_MODE = {
    circle: (nowPerf) => workflowGameplay.tick(nowPerf),
    arrow: (nowPerf) => workflowGameplayArrow.tick(nowPerf),
};

// 1 nhịp đếm ngược (computeGameplayCountdownStep()): còn đếm -> ghi + hiện số kế; hết -> ẩn rồi vào chơi.
const GAMEPLAY_COUNTDOWN_STEP_BY_RUNNING = {
    true: (next) => {
        appState.set('gameplayCountdownValue', next, { skipCheck: true });
        console.log(`writer: "workflowGameplayEngine._countdownTick", page: "gameplayCountdownValue", content: "${next}"`);
        showGameplayCountdown(gameplayCountdownScreen, gameplayCountdownNumber, next); // core/gameplay/engine-ui.js
    },
    false: (next, onComplete) => {
        hideGameplayCountdown(gameplayCountdownScreen); // core/gameplay/engine-ui.js
        onComplete();
    },
};

const workflowGameplayEngine = {

    /** Mở phiên chơi cho game `mode` — router 'gameplay.mediaChanged' (game đang armed) và workflowGameCatalog.armGame()
     * (armed lúc đã có media). Id lạ -> bỏ qua. */
    startMode(mode) {
        const startFn = GAMEPLAY_START_BY_MODE[mode];
        if (!startFn) return;
        startFn();
    },

    /** Thoát phiên theo `gameplayMode` — nút X overlay (router 'gameplay.exit.click') và workflowGameCatalog.disarmGame().
     * Chưa có mode (null) -> luồng Circle. */
    exitActiveMode() {
        (GAMEPLAY_EXIT_BY_MODE[appState.get('gameplayMode')] || GAMEPLAY_EXIT_BY_MODE.circle)();
    },

    /** Hết bài/video/ảnh lúc đang ở Game (router player-controls, chủ thể 'game') — modal Kết quả của đúng mode. */
    onActiveModeMediaEnded() {
        (GAMEPLAY_MEDIA_ENDED_BY_MODE[appState.get('gameplayMode')] || GAMEPLAY_MEDIA_ENDED_BY_MODE.circle)();
    },

    /** Mỗi frame từ event/workflow/audio-analysis.js::_tick() (hot path — object map + guard). Chưa từng vào Game -> bỏ qua. */
    tickActiveMode(nowPerf) {
        const tickFn = GAMEPLAY_TICK_BY_MODE[appState.get('gameplayMode')];
        if (!tickFn) return;
        tickFn(nowPerf);
    },

    /** Đếm ngược GAMEPLAY_COUNTDOWN_SECONDS giây (taskManager 'timeout', 1 nhịp/giây) rồi gọi `onComplete()`. */
    startCountdown(onComplete) {
        appState.set('gameplayCountdownValue', GAMEPLAY_COUNTDOWN_SECONDS, { skipCheck: true });
        console.log(`writer: "workflowGameplayEngine.startCountdown", page: "gameplayCountdownValue", content: "${GAMEPLAY_COUNTDOWN_SECONDS}"`);
        showGameplayCountdown(gameplayCountdownScreen, gameplayCountdownNumber, GAMEPLAY_COUNTDOWN_SECONDS); // core/gameplay/engine-ui.js

        taskManager.kill(GAMEPLAY_COUNTDOWN_TASK); // chống chạy chồng khi bắt đầu dồn dập
        taskManager.addNew(GAMEPLAY_COUNTDOWN_TASK, {
            time: 1000, mode: 'timeout', count: GAMEPLAY_COUNTDOWN_SECONDS,
            exe: () => this._countdownTick(onComplete),
        });
        taskManager.operator(GAMEPLAY_COUNTDOWN_TASK, 'enabled');
    },

    _countdownTick(onComplete) {
        const step = computeGameplayCountdownStep(appState.get('gameplayCountdownValue')); // core/gameplay/engine.js
        GAMEPLAY_COUNTDOWN_STEP_BY_RUNNING[step.isRunning](step.next, onComplete);
    },

    /** Reset điểm/combo/hit-count — phần dùng chung khi mode reset phiên (state riêng mode do mode tự reset). */
    resetScoreCounters() {
        appState.set('gameplayComboByTier', { perfect: 0, excellent: 0 }, { skipCheck: true });
        console.log(`writer: "workflowGameplayEngine.resetScoreCounters", page: "gameplayComboByTier", content: "reset"`);
        appState.set('gameplayTotalScore', 0, { skipCheck: true });
        console.log(`writer: "workflowGameplayEngine.resetScoreCounters", page: "gameplayTotalScore", content: "0"`);
        appState.set('gameplayCircleCount', 0, { skipCheck: true });
        console.log(`writer: "workflowGameplayEngine.resetScoreCounters", page: "gameplayCircleCount", content: "0"`);
        appState.set('gameplayHitCounts', { perfect: 0, excellent: 0, good: 0, bad: 0, miss: 0 }, { skipCheck: true });
        console.log(`writer: "workflowGameplayEngine.resetScoreCounters", page: "gameplayHitCounts", content: "reset"`);
    },

    /** Nhãn đã dịch cho modal Kết quả (phần giống nhau mọi mode). @param {string} difficulty @param {number} playCount
     * @param {boolean} isPluralPlayCount @param {string} endedMediaType - mediaType trong playlistCache của media vừa chơi */
    resolveEndModalLabels(difficulty, playCount, isPluralPlayCount, endedMediaType) {
        return {
            tierOrder: GAMEPLAY_TIER_ORDER,
            tierLabels: {
                perfect: t(GAMEPLAY_TIER_LABEL_KEY_BY_NAME.perfect),
                excellent: t(GAMEPLAY_TIER_LABEL_KEY_BY_NAME.excellent),
                good: t(GAMEPLAY_TIER_LABEL_KEY_BY_NAME.good),
                bad: t(GAMEPLAY_TIER_LABEL_KEY_BY_NAME.bad),
                miss: t(GAMEPLAY_TIER_LABEL_KEY_BY_NAME.miss),
            },
            difficultyLabel: t(GAMEPLAY_DIFFICULTY_LABEL_KEY_BY_ID[difficulty] || GAMEPLAY_DIFFICULTY_LABEL_KEY_BY_ID.hard),
            playCountLabel: tFormat(GAMEPLAY_PLAY_COUNT_KEY_BY_PLURAL[isPluralPlayCount], { count: playCount }),
            nextLabel: t(GAMEPLAY_NEXT_LABEL_KEY_BY_MEDIA[endedMediaType] || GAMEPLAY_NEXT_LABEL_KEY_BY_MEDIA.song),
        };
    },

    /**
     * Modal Kết quả: thông tin media + vòng % (nhiều lap màu khi >100%) + 2 dòng điểm đếm-lên + sao + breakdown tier. Mode
     * truyền nhãn đã dịch (resolveEndModalLabels()), `durationLabel` đã định dạng, `title` đã escapeHtml(), và 3 callback nút.
     */
    showEndModal({ finalScore, totalScore, maxScore, starMax, starRating, hitCounts, tierOrder, tierLabels, title, durationLabel, difficultyLabel, playCountLabel, nextLabel, onReplay, onNext, onEnd }) {
        const laps = computeScoreRingLaps(computeScoreRingPercent(totalScore, maxScore), GAMEPLAY_SCORE_RING_MAX_EXTRA_LAPS); // core/gameplay/engine.js
        const ringSvg = renderGameplayScoreRingSvg(computeScoreRingGeometry(laps, GAMEPLAY_SCORE_RING_PALETTE)); // components/gameplay-overlay.js + core

        modalChoice(
            '',
            [
                { label: t('gameplayCircle.ended.replayLabel'), onClick: onReplay },
                { label: nextLabel || t('gameplayCircle.ended.nextLabel'), onClick: onNext },
                { label: t('gameplayCircle.ended.endLabel'), onClick: onEnd },
            ],
            { bodyHtml: renderGameplayResultBodyHtml({ ringSvg, starMax, starRating, tierOrder, tierLabels, title, durationLabel, difficultyLabel, playCountLabel }), showCancel: false }
        ); // core/modal-choice-ui.js — 3 lựa chọn tự thành dropdown + "Chọn"; không có "huỷ" (bắt buộc chọn 1)
        renderHitBreakdown(tierOrder, hitCounts); // core/gameplay/engine-ui.js
        this._startScoreCountUpAnimation(finalScore, totalScore, maxScore);
    },

    /** Đếm-lên 2 dòng điểm cùng lúc (24 bước x 35ms, tuyến tính, chốt đúng số cuối) — vòng lặp ở workflowNumberCountup,
     * giá trị từng bước computeCountupValue() (core/number-countup.js). */
    _startScoreCountUpAnimation(finalScore, totalScore, maxScore) {
        workflowNumberCountup.run(GAMEPLAY_SCORE_COUNTUP_TASK, {
            steps: GAMEPLAY_SCORE_COUNTUP_STEPS,
            intervalMs: 35,
            onFrame: (step, steps) => renderScoreCountupFrame(
                computeCountupValue(finalScore, step, steps, 1, 3), // điểm chính 3 số lẻ
                computeCountupValue(totalScore, step, steps, 1, 0), // số nguyên
                maxScore
            ), // core/gameplay/engine-ui.js
        });
    },

    /**
     * Thêm 1 lượt chơi vào `meta.game[mode][difficulty]` của media đang chơi (mỗi bộ (media, mode, độ khó) 1 mảng riêng).
     * @param {string} mode @param {string} difficulty @param {number} finalScore
     * @param {'song'|'video'|'photo'} mediaType - loại media đang chơi (mode chọn theo chế độ phát)
     * @returns {Promise<{ title: string, playCount: number }>} tên hiển thị + tổng lượt đã chơi (mode, độ khó) này, tính cả
     *          lượt vừa xong
     */
    async persistScore(mode, difficulty, finalScore, mediaType) {
        const key = appState.get('currentKey');
        if (!key || !GAMEPLAY_SCORE_MEDIA_TYPES.has(mediaType)) return { title: '', playCount: 0 };
        const result = await updateMediaMeta(mediaType, key, (meta) => appendGameplayScore(meta, mode, difficulty, finalScore)); // service/db.js + core/gameplay/engine.js
        if (result.status === 'notFound') return { title: '', playCount: 0 };
        const meta = result.meta;
        const title = resolveGameplayScoreTitle(meta, key, stripFileExtension(meta.filename)); // core/gameplay/engine.js + core/file-manager/video.js
        console.log(`[workflowGameplayEngine.persistScore] ghi điểm ${finalScore} (${mode}/${difficulty}) vào meta ${mediaType} "${key}"`);
        return { title, playCount: meta.game[mode][difficulty].length };
    },
};
