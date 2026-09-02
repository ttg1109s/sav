/**
 * event/workflow/gameplay-engine.js — Workflow DÙNG CHUNG mọi mode Game (Rule 3b: Workflow tự
 * appState.get() rồi gọi core/gameplay/engine.js + engine-ui.js theo thứ tự). Sở hữu: cooldown
 * đếm ngược trước khi chơi, modal End (kết quả, ring % + sao + count-up + breakdown tier), lưu điểm
 * vào DB. `workflowGameplay` (event/workflow/gameplay.js, RIÊNG mode "Circle": spawn/lưới/vật lý
 * wave) gọi vào đây cho mọi phần KHÔNG đặc thù mode.
 *
 * [SỬA — 02/09/2026, Game Panel app-store list, Giang yêu cầu "bỏ modal chọn độ khó"] Modal "sẵn
 * sàng" (chọn độ khó + nút Start, `showStartModal()`/`_wireDifficultySelector()`) ĐÃ XOÁ HẲN — độ
 * khó giờ chọn SẴN trên card Game Panel TRƯỚC khi armed (nút cycle độ khó, core/gameplay/
 * game-panel-ui.js + event/workflow/game-catalog.js), `workflowGameplay.start()`/`replay()` giờ
 * nhảy thẳng `startCountdown()` (hàm NGAY DƯỚI ĐÂY, KHÔNG đổi gì) — chỉ modal End còn giữ lại.
 *
 * KHÔNG có tiêu đề ở modal End (phản hồi Giang — nội dung tự thân đã rõ ngữ nghĩa).
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

    /** Modal kết quả — thông tin bài/video vừa chơi (title/thời lượng/độ khó/số lượt) + ring %
     * (nhiều lap màu khi >100%) + 2 dòng điểm count-up chồng giữa + sao + breakdown tier.
     * `tierOrder`/`tierLabels` do mode tự truyền (tên/nhãn tier thuộc config riêng mode).
     * `durationLabel` đã FORMAT SẴN (mode tự gọi formatTime() — Core-ui/engine-ui.js không được gọi
     * hàm core khác file, Rule 3a). `onReplay`/`onNext`/`onEnd` do mode tự truyền. */
    showEndModal({ finalScore, totalScore, maxScore, starMax, starRating, hitCounts, tierOrder, tierLabels, title, durationLabel, difficultyLabel, playCountLabel, onReplay, onNext, onEnd }) {
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
            { bodyHtml: buildResultBodyHtml({ ringSvg, starMax, starRating, hitCounts, tierOrder, tierLabels, title, durationLabel, difficultyLabel, playCountLabel }), showCancel: false }
        ); // core (core/modal-choice-ui.js) — 3 lựa chọn -> TỰ ĐỘNG render dropdown+"Chọn"; showCancel:false vì màn Kết quả không có khái niệm "huỷ" (bắt buộc chọn 1 trong 3)
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
     * `game[mode][difficulty]` — KHÔNG cần bump DB_VERSION (IndexedDB không ràng buộc schema
     * value).
     *
     * [SỬA — phản hồi Giang "phân ra game { gamemode X {...}, gamemode Y }, sau này sẽ có nhiều
     * mode"] Field top-level ĐỔI TÊN `gameScores` -> `game` — tầng ĐẦU vẫn là `mode` ('circle' hiện
     * tại, mode SAU NÀY thêm chỉ cần key mới ngang hàng, KHÔNG đụng gì tới 'circle' đã lưu). Tầng
     * THỨ 2 `difficulty` (yêu cầu trước — "độ khó X và Y được tính là 1 lần riêng biệt") — mỗi độ
     * khó có mảng RIÊNG, lượt chơi/điểm số hoàn toàn tách biệt theo (bài, mode, độ khó).
     * @returns {{ title: string, playCount: number }} - title để hiện ở modal kết thúc (engine-
     *          ui.js), playCount = TỔNG số lượt đã chơi ĐÚNG (mode, difficulty) này, TÍNH CẢ lượt
     *          vừa xong (đã push trước khi đếm length).
     */
    async persistScore(mode, difficulty, finalScore) {
        const key = appState.get('currentKey');
        if (!key) return { title: '', playCount: 0 };
        const record = await getSongRecord(key); // service/db.js
        if (!record) return { title: '', playCount: 0 };
        if (!record.game) record.game = {};
        if (!record.game[mode]) record.game[mode] = {};
        if (!record.game[mode][difficulty]) record.game[mode][difficulty] = [];
        record.game[mode][difficulty].push({ time: Date.now(), score: finalScore });
        await setSongRecord(key, record); // service/db.js
        // [SỬA] `record.tag.title` CHỈ tồn tại cho Song — Video dùng `customName`/`filename` (KHÔNG
        // có `.tag`, xem core/file-manager/video.js), cùng công thức display title dùng chung toàn
        // project (vd core/playlist/loader.js dòng ~358 lúc build Adapter cho playlistCache).
        const title = (record.tag && record.tag.title)
            ? record.tag.title
            : (record.customName || (record.filename ? stripFileExtension(record.filename) : key)); // stripFileExtension: core/file-manager/video.js
        return { title, playCount: record.game[mode][difficulty].length };
    },
};
