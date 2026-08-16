/**
 * event/workflow/gameplay.js — Workflow duy nhất điều phối Game Mode (Circle mode v1, MỚI
 * 16/08/2026). Sở hữu:
 *   - `vizConfig.gameplayModeEnabled` (PERSISTENT, core/config.js) — bật/tắt qua setModeEnabled(),
 *     checkbox "Tự mở Game khi phát nhạc" trong Settings (components/settings/misc.js, section
 *     "GAME MODE" — SỬA 16/08/2026, Giang chốt lại: KHÔNG phải nút icon Control Center như bản
 *     đầu). Bật ON -> MỌI lần bài hát đổi thật sau đó tự mở overlay (hook ở event/router/
 *     visual-bg.js case 'visualBg.songChanged', KHÔNG cần bấm gì mỗi lần);
 *   - vòng đời `gameplayPhase` (idle -> ready -> countdown -> playing -> ended, xem
 *     service/state/gameplay-runtime.js docstring) — RIÊNG BIỆT với gameplayModeEnabled ở trên:
 *     đây là trạng thái 1 PHIÊN chơi (reset mỗi bài/mỗi reload), KHÔNG lưu qua reload;
 *   - tick() — KHÔNG tự có taskManager RAF riêng, được GỌI TỪ BÊN TRONG event/workflow/
 *     visualizer-render.js::_tick() (dùng CHUNG vòng lặp render có sẵn, tránh 2 RAF loop song song
 *     — xem đoạn gọi ở đó);
 *   - task đếm ngược 5s (taskManager, mode 'timeout', count=GAMEPLAY_COUNTDOWN_SECONDS — đúng quy
 *     ước readme/task-manager-conventions.md mục 4, CẤM setTimeout thô);
 *   - lưu điểm cuối phiên vào record 'songs' (service/db.js, field `gameScores.circle`).
 *
 * Đúng Rule 3b (core-function-conventions.md): Workflow tự appState.get()/appConfigViz.getAll()
 * TRƯỚC, gọi core/gameplay/circle-mode.js (tính toán thuần) + core/gameplay/circle-mode-ui.js
 * (đồng bộ DOM) THEO THỨ TỰ tại đây — 2 file core đó TUYỆT ĐỐI không gọi lẫn nhau (Rule 3a).
 *
 * Wave KHOÁ SPAWN THEO BEAT THẬT (SỬA 16/08/2026, Giang yêu cầu "làm luôn") — so global `lastBeatTime`
 * (core/dom-refs.js, KHÔNG thuộc appState, audio-analysis.js ghi mỗi lần detect beat) với mốc đã
 * tiêu thụ (`_lastConsumedBeatTime`, closure field ở đây) để biết vừa có beat mới hay chưa. Mỗi
 * wave khi spawn tự tính RIÊNG `shrinkDurationMs` (theo BPM hiện tại) + `startRadius` (theo energy
 * hiện tại) rồi LƯU LUÔN vào wave — sau đó wave co theo đồng hồ `performance.now()` của riêng nó,
 * độc lập audio.currentTime (xem docstring core/gameplay/circle-mode.js).
 */
const GAMEPLAY_COUNTDOWN_TASK = 'gameplayCountdown';

const workflowGameplay = {
    _nextWaveId: 1,
    _lastConsumedBeatTime: 0, // snapshot `lastBeatTime` (global) đã dùng để spawn — khác nghĩa với "0 = chưa từng" của lastBeatTime gốc, xem _beginPlaying()

    /** Ứng với 'gameplay.modeEnabled.change' (checkbox "Tự mở Game khi phát nhạc" trong Settings —
     * SỬA 16/08/2026, Giang chốt lại: KHÔNG phải nút icon trong Control Center — đó là 1 tuỳ chọn
     * PERSISTENT, thuộc Settings). Bật ON kèm đang có bài load sẵn -> mở LUÔN cho bài đó, không
     * cần đợi bài kế tiếp. */
    setModeEnabled(checked) {
        setGameplayModeEnabled(checked); // core
        saveConfig(); // core — Workflow tự gọi CẢ HAI lần lượt (Rule 3a, KHÔNG để core gọi core)

        if (checked && appState.get('currentKey')) this.start('circle');
    },

    /** Ứng với 'gameplay.start.click' — GIỜ CHỈ còn 2 nơi gọi: setModeEnabled() (bật ON kèm bài
     * đang phát) và hook TỰ ĐỘNG ở event/router/visual-bg.js case 'visualBg.songChanged' (mọi lần
     * bài đổi thật trong lúc gameplayModeEnabled=true, xem docstring đầu file NÀY) — mở layer, vào
     * phase 'ready', CHƯA spawn wave nào (chờ người dùng bấm Start). */
    start(mode) {
        this._resetSessionCounters();
        appState.set('gameplayMode', mode, { skipCheck: true });
        console.log(`writer: "workflowGameplay.start", page: "gameplayMode", content: "${mode}"`);
        appState.set('gameplayPhase', 'ready', { skipCheck: true });
        console.log(`writer: "workflowGameplay.start", page: "gameplayPhase", content: "ready"`);

        showCircleGameplayLayer(gameplayLayer, gameplayCenterCircle, GAMEPLAY_CIRCLE_CONFIG.centerRadius); // core-ui
        showGameplayReadyScreen(gameplayReadyScreen); // core-ui
    },

    /** Ứng với 'gameplay.startCountdown.click' (nút "Start" trên màn ready) — bắt đầu đếm ngược
     * GAMEPLAY_COUNTDOWN_SECONDS giây, CHƯA spawn wave nào trong lúc đếm. */
    startCountdown() {
        hideGameplayReadyScreen(gameplayReadyScreen); // core-ui
        appState.set('gameplayPhase', 'countdown', { skipCheck: true });
        console.log(`writer: "workflowGameplay.startCountdown", page: "gameplayPhase", content: "countdown"`);
        appState.set('gameplayCountdownValue', GAMEPLAY_COUNTDOWN_SECONDS, { skipCheck: true });
        console.log(`writer: "workflowGameplay.startCountdown", page: "gameplayCountdownValue", content: "${GAMEPLAY_COUNTDOWN_SECONDS}"`);
        showGameplayCountdown(gameplayCountdownScreen, gameplayCountdownNumber, GAMEPLAY_COUNTDOWN_SECONDS); // core-ui

        taskManager.kill(GAMEPLAY_COUNTDOWN_TASK); // guard chống double-start nếu bấm Start dồn dập
        taskManager.addNew(GAMEPLAY_COUNTDOWN_TASK, { time: 1000, exe: () => this._countdownTick(), mode: 'timeout', count: GAMEPLAY_COUNTDOWN_SECONDS });
        taskManager.operator(GAMEPLAY_COUNTDOWN_TASK, 'enabled');
    },

    /** 1 nhịp đếm ngược — tự chạy đúng GAMEPLAY_COUNTDOWN_SECONDS lần rồi taskManager tự dừng (xem
     * addNew() ở startCountdown(), count > 0). Lần chạy CUỐI (còn lại 0) -> chuyển sang playing. */
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

    /** Hết đếm ngược -> cho phép tick() bắt đầu spawn wave từ frame kế tiếp. */
    _beginPlaying() {
        appState.set('gameplayPhase', 'playing', { skipCheck: true });
        console.log(`writer: "workflowGameplay._beginPlaying", page: "gameplayPhase", content: "playing"`);
        // Snapshot `lastBeatTime` (global, core/dom-refs.js) NGAY LÚC NÀY làm mốc "đã tiêu thụ" —
        // tránh 1 beat CŨ (detect từ TRƯỚC khi countdown bắt đầu, hoặc từ bài trước) bị hiểu nhầm
        // là "vừa mới có" rồi spawn ngay lập tức lúc vào playing (xem shouldSpawnCircleWave()).
        this._lastConsumedBeatTime = lastBeatTime;
    },

    /** Ứng với 'gameplay.tap.press' — CHỈ tính điểm khi phase='playing' (guard clause thuần —
     * countdown/ready/ended: tap không có tác dụng, KHÔNG phải rẽ nhánh xử lý khác nhau). */
    handleTap() {
        if (appState.get('gameplayPhase') !== 'playing') return;
        if (audioPlayer.paused) return; // tap trong lúc nhạc đang pause -> không tính (đồng bộ đúng lý do đã ghi ở tick())
        const now = performance.now();
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const { gameplayWaves, gameplayComboStreak, gameplayTotalScore, gameplayCircleCount } = appState.get([
            'gameplayWaves', 'gameplayComboStreak', 'gameplayTotalScore', 'gameplayCircleCount',
        ]);
        if (gameplayWaves.length === 0) return; // không có wave nào -> không phải 1 note thật, không tính miss

        const radiusEntries = gameplayWaves.map(w => ({ id: w.id, radius: computeWaveRadius(w, now) })); // core, lặp ở Workflow (Rule 3b/3c)
        const nearest = findNearestRadiusEntry(radiusEntries, cfg.centerRadius); // core
        const tier = classifyTapTier(nearest.radius, cfg.centerRadius, cfg.gap, cfg.tiers); // core

        const tierName = tier ? tier.name : 'miss';
        const tierScore = tier ? tier.score : 0;
        const { pointsGained, newComboStreak } = computeComboScoreGain(tierName, tierScore, gameplayComboStreak, cfg.comboTierNames); // core

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

        showTapTierPopup(gameplayTierPopupLayer, tierName.toUpperCase(), tierName); // core-ui
        updateGameplayHud(gameplayHudScore, gameplayHudCombo, newTotalScore, newCircleCount, newComboStreak); // core-ui
    },

    /**
     * Gọi MỖI FRAME từ event/workflow/visualizer-render.js::_tick() — hot path 60fps, MIỄN Rule 4
     * console.log cho set()/mutate() bên trong (đúng ngoại lệ đã ghi core-function-conventions.md
     * Rule 4, cùng lý do chính _tick() của visualizer-render.js đang áp dụng).
     */
    tick(now) {
        if (appState.get('gameplayPhase') !== 'playing') return;
        // SỬA (16/08/2026, phản hồi Giang — "audio chạy lúc nào thì mới có circle hiển thị, không
        // cần quan tâm nó chạy lúc nào, Start chỉ kích hoạt hoạt động") — BỎ cơ chế bù trừ thời
        // gian pause (bản trước có `_pauseStartedAt` dời spawnedAt mỗi wave) — overlay fullscreen
        // (point 2) khiến pause qua UI app KHÔNG THỂ xảy ra trong lúc đang chơi, guard đơn giản này
        // là đủ: audio KHÔNG phát -> chưa (hoặc chưa còn) có circle nào hiển thị/tiến triển, hết.
        if (audioPlayer.paused) return;
        const cfg = GAMEPLAY_CIRCLE_CONFIG;
        const { gameplayWaves, gameplayCircleCount, currentCalculatedBpm, smoothedEnergy } = appState.get([
            'gameplayWaves', 'gameplayCircleCount', 'currentCalculatedBpm', 'smoothedEnergy',
        ]);

        // `lastBeatTime` — biến GLOBAL (core/dom-refs.js, KHÔNG qua appState.get vì không thuộc
        // appState — audio-analysis.js ghi Date.now() mỗi lần detect beat thật, khác gốc thời gian
        // với `now` (performance.now()) ở đây — CHỈ dùng để SO SÁNH THAY ĐỔI, không trừ khoảng cách.
        if (shouldSpawnCircleWave(gameplayWaves.length, this._lastConsumedBeatTime, lastBeatTime, cfg)) { // core
            this._lastConsumedBeatTime = lastBeatTime;
            const shrinkDurationMs = computeShrinkDurationMs(currentCalculatedBpm, cfg); // core
            const startRadius = computeWaveStartRadius(smoothedEnergy, cfg); // core
            const wave = createCircleWave(this._nextWaveId++, now, startRadius, shrinkDurationMs); // core
            appState.mutate('gameplayWaves', arr => arr.push(wave), { skipCheck: true });
        }

        const waves = appState.get('gameplayWaves');
        const radiusEntries = waves.map(w => ({ id: w.id, radius: computeWaveRadius(w, now) })); // core, lặp ở Workflow
        for (const entry of radiusEntries) entry.armed = Math.abs(entry.radius - cfg.centerRadius) <= cfg.gap; // cờ hiển thị thuần (core-ui đọc), KHÔNG ảnh hưởng chấm điểm

        const missedIds = radiusEntries.filter(e => isWaveMissed(e.radius, cfg.centerRadius, cfg.gap)).map(e => e.id); // core
        if (missedIds.length > 0) {
            appState.mutate('gameplayWaves', arr => {
                for (let i = arr.length - 1; i >= 0; i--) if (missedIds.includes(arr[i].id)) arr.splice(i, 1);
            }, { skipCheck: true });
            appState.set('gameplayComboStreak', 0, { skipCheck: true });
            appState.set('gameplayCircleCount', gameplayCircleCount + missedIds.length, { skipCheck: true });
        }

        const remainingEntries = radiusEntries.filter(e => !missedIds.includes(e.id));
        syncCircleWaveElements(gameplayWavesContainer, remainingEntries); // core-ui
    },

    /** Ứng với 'playerControls.audio.ended' KHI gameplayPhase !== 'idle' (branch qua
     * VirtualMachineState ở event/router/player-controls.js — xem file đó). */
    async onSongEnded() {
        stopListenClock(); // core — giữ PARITY với handleAudioEnded() thường, KHÔNG bỏ qua vì đang chơi game
        const { gameplayTotalScore, gameplayCircleCount } = appState.get(['gameplayTotalScore', 'gameplayCircleCount']);
        const finalScore = computeFinalAverageScore(gameplayTotalScore, gameplayCircleCount); // core

        await this._persistScore(finalScore);

        appState.set('gameplayWaves', [], { skipCheck: true });
        console.log(`writer: "workflowGameplay.onSongEnded", page: "gameplayWaves", content: "cleared"`);
        appState.set('gameplayPhase', 'ended', { skipCheck: true });
        console.log(`writer: "workflowGameplay.onSongEnded", page: "gameplayPhase", content: "ended"`);

        clearCircleWaveElements(gameplayWavesContainer); // core-ui
        showScoreScreen(gameplayScoreScreen, gameplayFinalScore, finalScore); // core-ui
    },

    /** Đọc + ghi record 'songs' — CHỈ hợp lệ ở Workflow (Core cấm tuyệt đối đọc DB, xem bảng tổng
     * hợp core-function-conventions.md). Field mới `gameScores.circle` — KHÔNG cần bump DB_VERSION
     * (IndexedDB không ràng buộc schema trong value 1 store, xem service/db.js dòng khai báo
     * DB_VERSION, đúng tiền lệ field `folder` đã có). */
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

    /** Nút "Chơi lại" (màn kết quả) — phát lại ĐÚNG bài hiện tại từ đầu, quay về phase 'ready'
     * (KHÔNG nhảy thẳng 'playing' — mọi lượt chơi đều phải qua Start/countdown, kể cả replay, cho
     * nhất quán trải nghiệm). */
    replay() {
        hideScoreScreen(gameplayScoreScreen); // core-ui
        audioPlayer.currentTime = 0;
        audioPlayer.play();
        this._resetSessionCounters();
        appState.set('gameplayPhase', 'ready', { skipCheck: true });
        console.log(`writer: "workflowGameplay.replay", page: "gameplayPhase", content: "ready"`);
        showGameplayReadyScreen(gameplayReadyScreen); // core-ui
    },

    /** Nút "Bài tiếp theo" — playNext(true) (core có sẵn) đã TỰ wrap về đầu playlist nếu đang ở
     * bài cuối. SỬA (16/08/2026) — KHÔNG tự mở lại màn ready ở đây nữa: hook TỰ ĐỘNG ở event/
     * router/visual-bg.js case 'visualBg.songChanged' đã lo việc đó (gameplayModeEnabled vẫn ĐANG
     * true suốt từ lúc start() — không cách nào tắt được giữa chừng, xem setModeEnabled()). CHỈ fallback
     * gọi start() thủ công cho ĐÚNG 1 trường hợp: playlist CHỈ có 1 bài -> playNext(true) trả về
     * NGUYÊN key cũ -> playSong() short-circuit ở nhánh `key === currentKey` (core/playlist/
     * actions.js), KHÔNG bắn 'visualBg.songChanged' -> hook không có gì để chạy. */
    nextSong() {
        hideScoreScreen(gameplayScoreScreen); // core-ui
        const previousKey = appState.get('currentKey');
        playNext(true); // core
        if (appState.get('currentKey') === previousKey) this.start('circle');
    },

    /** Ứng với 'gameplay.exit.click' (nút X cố định, đúng vị trí #btn-open-control-center — SỬA
     * 16/08/2026, Giang yêu cầu gộp 2 nút thoát cũ + thêm khả năng thoát giữa lúc playing/countdown)
     * — thoát hẳn Game Mode, tái dùng NGUYÊN VẸN luồng "Back to Playlist" có sẵn (KHÔNG viết lại,
     * chỉ gửi lại đúng message). */
    exitToPlaylist() {
        appState.set('gameplayPhase', 'idle', { skipCheck: true });
        console.log(`writer: "workflowGameplay.exitToPlaylist", page: "gameplayPhase", content: "idle"`);
        taskManager.kill(GAMEPLAY_COUNTDOWN_TASK);

        hideScoreScreen(gameplayScoreScreen); // core-ui
        hideGameplayReadyScreen(gameplayReadyScreen); // core-ui
        hideGameplayCountdown(gameplayCountdownScreen); // core-ui
        hideCircleGameplayLayer(gameplayLayer); // core-ui
        clearCircleWaveElements(gameplayWavesContainer); // core-ui

        eventBus.send({ router: 'playerControls', type: 'playerControls.backToPlaylist.click', payload: {} });
    },

    _resetSessionCounters() {
        this._lastConsumedBeatTime = lastBeatTime; // tránh beat cũ (bài/phiên trước) bị tính là "mới" ngay khi vào ready
        appState.set('gameplayWaves', [], { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayWaves", content: "reset"`);
        appState.set('gameplayComboStreak', 0, { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayComboStreak", content: "0"`);
        appState.set('gameplayTotalScore', 0, { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayTotalScore", content: "0"`);
        appState.set('gameplayCircleCount', 0, { skipCheck: true });
        console.log(`writer: "workflowGameplay._resetSessionCounters", page: "gameplayCircleCount", content: "0"`);

        clearCircleWaveElements(gameplayWavesContainer); // core-ui
        updateGameplayHud(gameplayHudScore, gameplayHudCombo, 0, 0, 0); // core-ui
    },
};
