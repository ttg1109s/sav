/**
 * event/workflow/gameplay-engine.js — Workflow DÙNG CHUNG mọi mode Game (Rule 3b: Workflow tự
 * appState.get() rồi gọi core/gameplay/engine.js + engine-ui.js theo thứ tự). Sở hữu: cooldown
 * đếm ngược trước khi chơi, modal Start (chọn độ khó) + modal End (kết quả, ring % + sao + count-up
 * + breakdown tier), lưu điểm vào DB. `workflowGameplay` (event/workflow/gameplay.js, RIÊNG mode
 * "Circle": spawn/lưới/vật lý wave) gọi vào đây cho mọi phần KHÔNG đặc thù mode.
 *
 * KHÔNG có tiêu đề ở modal Start/End (phản hồi Giang — nội dung tự thân đã rõ ngữ nghĩa).
 *
 * NẠP SAU: core/gameplay/engine.js, core/gameplay/engine-ui.js, core/modal-choice-ui.js,
 * service/task-manager.js, service/db.js, lang/lang.js.
 */
const GAMEPLAY_COUNTDOWN_TASK = 'gameplayCountdown';
const GAMEPLAY_SCORE_COUNTUP_TASK = 'gameplayScoreCountUp';
const GAMEPLAY_SCORE_COUNTUP_STEPS = 24;
const GAMEPLAY_SCORE_RING_MAX_EXTRA_LAPS = 3;
const GAMEPLAY_SCORE_RING_PALETTE = ['#38bdf8', '#4ade80', '#fbbf24', '#f472b6']; // sky/emerald/amber/pink-400

const workflowGameplayEngine = {

    /** Modal "sẵn sàng" — chọn độ khó + nút Start/Cancel. `onStart()`/`onCancel()` do mode tự
     * truyền vào (Circle: startCountdown()/exitToPlaylist()). */
    showStartModal({ bodyTextKey, onStart, onCancel }) {
        modalChoice(
            t(bodyTextKey),
            [
                { label: t('common.cancel'), className: 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: onCancel },
                { label: t('gameplayCircle.ready.startLabel'), className: 'flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-sm font-semibold transition-colors', onClick: onStart },
            ],
            { bodyHtml: buildDifficultySelectorHtml(appState.get('gameplayDifficulty'), t) }
        ); // core (core/modal-choice-ui.js)
        this._wireDifficultySelector();
    },

    /** Gắn click 3 nút độ khó vừa render qua bodyHtml — modalChoice() không biết ngữ nghĩa "độ
     * khó", Workflow tự đọc lại DOM qua #modal-choice-body (id cố định do modal-choice-ui.js gán).
     * Rule 5a áp cho Core, KHÔNG áp cho Workflow — appState.set() thẳng trong callback hợp lệ.
     * Cập nhật kèm dòng hint mô tả cơ chế (renderDifficultyHint, engine-ui.js — mục "cải tiến
     * start modal", phản hồi Giang). */
    _wireDifficultySelector() {
        const buttons = document.querySelectorAll('#modal-choice-body .gameplay-difficulty-btn');
        buttons.forEach((btn) => {
            btn.addEventListener('click', () => {
                appState.set('gameplayDifficulty', btn.dataset.difficulty, { skipCheck: true });
                console.log(`writer: "workflowGameplayEngine._wireDifficultySelector", page: "gameplayDifficulty", content: "${btn.dataset.difficulty}"`);
                buttons.forEach((b) => b.classList.remove('ring-2', 'ring-sky-400', 'bg-sky-500/20'));
                buttons.forEach((b) => b.classList.add('bg-slate-800'));
                btn.classList.remove('bg-slate-800');
                btn.classList.add('ring-2', 'ring-sky-400', 'bg-sky-500/20');
                renderDifficultyHint(btn.dataset.difficulty, t); // core-ui (engine-ui.js)
            });
        });
    },

    /** Đếm ngược GAMEPLAY_COUNTDOWN_SECONDS giây rồi gọi `onComplete()` — taskManager mode
     * 'timeout' (CẤM setTimeout thô, readme/task-manager-conventions.md). */
    startCountdown(onComplete) {
        appState.set('gameplayCountdownValue', GAMEPLAY_COUNTDOWN_SECONDS, { skipCheck: true });
        console.log(`writer: "workflowGameplayEngine.startCountdown", page: "gameplayCountdownValue", content: "${GAMEPLAY_COUNTDOWN_SECONDS}"`);
        showGameplayCountdown(gameplayCountdownScreen, gameplayCountdownNumber, GAMEPLAY_COUNTDOWN_SECONDS); // core-ui (engine-ui.js)

        taskManager.kill(GAMEPLAY_COUNTDOWN_TASK); // guard chống double-start nếu bấm Start dồn dập
        taskManager.addNew(GAMEPLAY_COUNTDOWN_TASK, {
            time: 1000, mode: 'timeout', count: GAMEPLAY_COUNTDOWN_SECONDS,
            exe: () => this._countdownTick(onComplete),
        });
        taskManager.operator(GAMEPLAY_COUNTDOWN_TASK, 'enabled');
    },

    _countdownTick(onComplete) {
        const next = appState.get('gameplayCountdownValue') - 1;
        if (next > 0) {
            appState.set('gameplayCountdownValue', next, { skipCheck: true });
            console.log(`writer: "workflowGameplayEngine._countdownTick", page: "gameplayCountdownValue", content: "${next}"`);
            showGameplayCountdown(gameplayCountdownScreen, gameplayCountdownNumber, next); // core-ui
            return;
        }
        hideGameplayCountdown(gameplayCountdownScreen); // core-ui
        onComplete();
    },

    /** Reset điểm/combo/hit-count — phần DÙNG CHUNG của `_resetSessionCounters()` mode (state
     * riêng mode như wave/lưới pitch KHÔNG thuộc đây, mode tự reset lấy). */
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

    /** Modal kết quả — ring % (nhiều lap màu khi >100%) + 2 dòng điểm count-up chồng giữa + sao +
     * breakdown tier. `tierOrder`/`tierLabels` do mode tự truyền (tên/nhãn tier thuộc config riêng
     * mode). `onReplay`/`onNext`/`onEnd` do mode tự truyền. */
    showEndModal({ finalScore, totalScore, maxScore, starMax, starRating, hitCounts, tierOrder, tierLabels, onReplay, onNext, onEnd }) {
        const deltaPercent = computeScoreDeltaPercent(totalScore, maxScore); // core (engine.js)
        const ringPercent = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
        const laps = computeScoreRingLaps(ringPercent, GAMEPLAY_SCORE_RING_MAX_EXTRA_LAPS); // core
        const ringSvg = buildScoreRingSvg(laps, GAMEPLAY_SCORE_RING_PALETTE); // core-ui

        modalChoice(
            '',
            [
                { label: t('gameplayCircle.ended.replayLabel'), onClick: onReplay },
                { label: t('gameplayCircle.ended.nextLabel'), onClick: onNext },
                { label: t('gameplayCircle.ended.endLabel'), onClick: onEnd },
            ],
            { bodyHtml: buildResultBodyHtml({ ringSvg, starMax, starRating, hitCounts, tierOrder, tierLabels }) }
        ); // core (core/modal-choice-ui.js) — 3 nút -> TỰ ĐỘNG render dropdown+"Chọn"
        renderHitBreakdown(tierOrder, hitCounts); // core-ui — 1 lần, không animate (số nguyên nhỏ)
        this._startScoreCountUpAnimation(finalScore, totalScore, maxScore, deltaPercent);
    },

    /** Count-up 2 dòng điểm (float chính + thực/tổng) đồng thời, cùng nhịp taskManager 'interval'
     * (CẤM setTimeout thô). % lệch KHÔNG hiện text riêng nữa — thể hiện qua ring (buildScoreRingSvg,
     * đã dựng SẴN lúc mở modal, tự animate qua CSS, không cần JS đợi count-up xong mới chạy). */
    _startScoreCountUpAnimation(finalScore, totalScore, maxScore, deltaPercent) {
        let step = 0;
        taskManager.kill(GAMEPLAY_SCORE_COUNTUP_TASK);
        taskManager.addNew(GAMEPLAY_SCORE_COUNTUP_TASK, {
            time: 35, mode: 'interval', count: GAMEPLAY_SCORE_COUNTUP_STEPS,
            exe: () => {
                step++;
                const ratio = step / GAMEPLAY_SCORE_COUNTUP_STEPS;
                renderScoreCountupFrame(finalScore * ratio, Math.round(totalScore * ratio), maxScore); // core-ui
                if (step >= GAMEPLAY_SCORE_COUNTUP_STEPS) {
                    renderScoreCountupFrame(finalScore, totalScore, maxScore); // core-ui — chốt đúng số cuối, tránh sai số làm tròn dồn qua từng bước
                    taskManager.operator(GAMEPLAY_SCORE_COUNTUP_TASK, 'disabled');
                }
            },
        });
        taskManager.operator(GAMEPLAY_SCORE_COUNTUP_TASK, 'enabled');
    },

    /** Đọc + ghi record 'songs' — CHỈ hợp lệ ở Workflow (Core cấm đọc DB). Field
     * `gameScores[mode]` — KHÔNG cần bump DB_VERSION (IndexedDB không ràng buộc schema value). */
    async persistScore(mode, finalScore) {
        const key = appState.get('currentKey');
        if (!key) return;
        const record = await getSongRecord(key); // service/db.js
        if (!record) return;
        if (!record.gameScores) record.gameScores = {};
        if (!record.gameScores[mode]) record.gameScores[mode] = [];
        record.gameScores[mode].push({ time: Date.now(), score: finalScore });
        await setSongRecord(key, record); // service/db.js
    },
};
