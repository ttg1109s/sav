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
 * core/number-countup.js, event/workflow/number-countup.js, service/task-manager.js, service/db.js,
 * lang/lang.js.
 */
const GAMEPLAY_COUNTDOWN_TASK = 'gameplayCountdown';
const GAMEPLAY_SCORE_COUNTUP_TASK = 'gameplayScoreCountUp';
const GAMEPLAY_SCORE_COUNTUP_STEPS = 24;
const GAMEPLAY_SCORE_RING_MAX_EXTRA_LAPS = 3;
const GAMEPLAY_SCORE_RING_PALETTE = ['#38bdf8', '#4ade80', '#fbbf24', '#f472b6']; // sky/emerald/amber/pink-400

// SỬA (06/10/2026, plan-media-db-split.md) — XOÁ bảng `GAMEPLAY_SCORE_RECORD_BY_MEDIA` (read/write/blobFields/coverOf theo
// từng store): điểm Game nằm trong META của media, ghi qua `updateMediaMeta(type, key, ...)` (service/db.js — CHỈ store
// meta, không đụng Blob) -> hết lỗi round-trip tận gốc (bài câm / "file hỏng" khi phát lại đúng bài vừa chơi), không
// còn rematerializeBlob() lẫn bước trỏ lại cover trong playlistCache. Loại media hợp lệ đi thẳng làm `type`.
const GAMEPLAY_SCORE_MEDIA_TYPES = new Set(['song', 'video', 'photo']);

/** Thêm 1 lượt chơi vào `meta.game[mode][difficulty]` — hàm THUẦN dùng làm `mutate` cho updateMediaMeta(). */
function appendGameplayScore(meta, mode, difficulty, finalScore) {
    const game = { ...(meta.game || {}) };
    const byMode = { ...(game[mode] || {}) };
    byMode[difficulty] = [...(byMode[difficulty] || []), { time: Date.now(), score: finalScore }];
    game[mode] = byMode;
    return { ...meta, game };
}

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
     * hàm core khác file, Rule 3a). `onReplay`/`onNext`/`onEnd` do mode tự truyền.
     * `nextLabel` MỚI (29/09/2026) — nhãn nút Next ĐÃ DỊCH SẴN theo loại media (Song/Video/Photo), mode tự chọn;
     * thiếu -> nhãn Song cũ. */
    showEndModal({ finalScore, totalScore, maxScore, starMax, starRating, hitCounts, tierOrder, tierLabels, title, durationLabel, difficultyLabel, playCountLabel, nextLabel, onReplay, onNext, onEnd }) {
        const deltaPercent = computeScoreDeltaPercent(totalScore, maxScore); // core (engine.js)
        const ringPercent = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
        const laps = computeScoreRingLaps(ringPercent, GAMEPLAY_SCORE_RING_MAX_EXTRA_LAPS); // core
        const ringSvg = buildScoreRingSvg(laps, GAMEPLAY_SCORE_RING_PALETTE); // core-ui

        modalChoice(
            '',
            [
                { label: t('gameplayCircle.ended.replayLabel'), onClick: onReplay },
                { label: nextLabel || t('gameplayCircle.ended.nextLabel'), onClick: onNext },
                { label: t('gameplayCircle.ended.endLabel'), onClick: onEnd },
            ],
            { bodyHtml: buildResultBodyHtml({ ringSvg, starMax, starRating, hitCounts, tierOrder, tierLabels, title, durationLabel, difficultyLabel, playCountLabel }), showCancel: false }
        ); // core (core/modal-choice-ui.js) — 3 lựa chọn -> TỰ ĐỘNG render dropdown+"Chọn"; showCancel:false vì màn Kết quả không có khái niệm "huỷ" (bắt buộc chọn 1 trong 3)
        renderHitBreakdown(tierOrder, hitCounts); // core-ui — 1 lần, không animate (số nguyên nhỏ)
        this._startScoreCountUpAnimation(finalScore, totalScore, maxScore, deltaPercent);
    },

    /** Count-up 2 dòng điểm (float chính + thực/tổng) đồng thời. SỬA 21/09/2026 (Giang yêu cầu tách
     * animation number thành core chung): vòng lặp timer dời sang `workflowNumberCountup.run()`
     * (event/workflow/number-countup.js), phần TÍNH giá trị mỗi bước dời sang `computeCountupValue()`
     * (core/number-countup.js) — hành vi GIỮ NGUYÊN (tuyến tính `easePower` 1, 24 bước x 35ms, chốt đúng
     * số cuối). % lệch KHÔNG hiện text riêng nữa — thể hiện qua ring (buildScoreRingSvg, đã dựng SẴN lúc
     * mở modal, tự animate qua CSS, không cần JS đợi count-up xong mới chạy). */
    _startScoreCountUpAnimation(finalScore, totalScore, maxScore, deltaPercent) {
        workflowNumberCountup.run(GAMEPLAY_SCORE_COUNTUP_TASK, {
            steps: GAMEPLAY_SCORE_COUNTUP_STEPS,
            intervalMs: 35,
            onFrame: (step, steps) => renderScoreCountupFrame(
                computeCountupValue(finalScore, step, steps, 1, 3), // core (number-countup.js) — điểm chính hiện 3 số lẻ (xem renderScoreCountupFrame)
                computeCountupValue(totalScore, step, steps, 1, 0), // số nguyên
                maxScore
            ), // core-ui
        });
    },

    /** Đọc + ghi record của media ĐANG chơi (SỬA 05/10/2026 — trước đây luôn store 'songs', xem
     * GAMEPLAY_SCORE_RECORD_BY_MEDIA) — CHỈ hợp lệ ở Workflow (Core cấm đọc DB). Field
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
     * @param {string} mode @param {string} difficulty @param {number} finalScore
     * @param {'song'|'video'|'photo'} mediaType - loại media ĐANG chơi (workflowGameplay.onSongEnded() chọn theo chế độ phát)
     */
    async persistScore(mode, difficulty, finalScore, mediaType) {
        const key = appState.get('currentKey');
        if (!key || !GAMEPLAY_SCORE_MEDIA_TYPES.has(mediaType)) return { title: '', playCount: 0 }; // guard
        const result = await updateMediaMeta(mediaType, key, (meta) => appendGameplayScore(meta, mode, difficulty, finalScore)); // service/db.js
        if (result.status === 'notFound') return { title: '', playCount: 0 };
        const meta = result.meta;
        // `meta.tag.title` CHỈ tồn tại cho Song — Video/Photo dùng `customName`/`filename`, cùng công thức display title
        // dùng chung toàn project (core/playlist/loader.js).
        const title = (meta.tag && meta.tag.title)
            ? meta.tag.title
            : (meta.customName || (meta.filename ? stripFileExtension(meta.filename) : key)); // stripFileExtension: core/file-manager/video.js
        console.log(`[workflowGameplayEngine.persistScore] ghi điểm ${finalScore} (${mode}/${difficulty}) vào meta ${mediaType} "${key}"`);
        return { title, playCount: meta.game[mode][difficulty].length };
    },

    // XOÁ (06/10/2026, plan-media-db-split.md) — `_pointCacheCoverToFreshBlob()`: chỉ tồn tại để chữa lỗi round-trip Blob,
    // giờ điểm Game ghi CHỈ vào meta nên cover trong playlistCache không bị ảnh hưởng.
};
