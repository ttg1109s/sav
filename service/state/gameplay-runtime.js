/**
 * service/state/gameplay-runtime.js — Package STATE domain "gameplay-runtime": trạng thái phiên
 * chơi Game Mode trên màn Visualizer (mode 1 "Circle"). Xem cơ chế package ở service/state.js.
 * PHẢI nạp SAU service/state.js, TRƯỚC service/state/record/index.js (registry('player','all')
 * cần package này đã định nghĩa xong).
 *
 * Đặt TÊN FIELD có tiền tố `gameplay` để tránh trùng flat key với các package khác đã có (field
 * KHÔNG namespace theo tên package — appState.get('...') đọc thẳng flat key).
 *
 * `gameplayWaves`: mảng { id, spawnedAt, startRadius, shrinkDurationMs, x, y, colorMain, colorLight }.
 * `x`/`y` là PX THẬT trong hệ toạ độ canvas gameplay (không phải %, canvas vẽ trực tiếp bằng px) —
 * xác định lúc spawn qua lưới pitch→ô (core/gameplay/circle-mode.js), CỐ ĐỊNH suốt vòng đời wave.
 * `colorMain`/`colorLight` cũng chốt 1 lần lúc spawn theo effect đang chạy (core/custom-effect.js),
 * đóng băng suốt vòng đời wave — không đổi màu giữa chừng dù effect nền có đổi. KHÔNG lưu radius/
 * opacity hiện tại (suy ra mỗi frame từ spawnedAt/now/shrinkDurationMs qua circle-mode.js::
 * computeWaveRadius()/computeWaveOpacity(), tránh 2 nguồn sự thật).
 */
        /**
         * `gameplayPhase` (enum string) — 5 giá trị hợp lệ:
         *   'idle'      — chưa vào Game Mode, #gameplay-layer ẩn hẳn.
         *   'ready'     — layer đã mở, hiện modal Start (kèm chọn độ khó), CHƯA spawn wave nào.
         *   'countdown' — đang đếm ngược (gameplayCountdownValue N->0), CHƯA spawn wave, CHƯA phát nhạc.
         *   'playing'   — nhạc đang phát, wave đang spawn/tick/nhận tap thật.
         *   'ended'     — hết bài, hiện modal kết quả (Replay/Next/End).
         *
         * `gameplayPositionRefreshPending` — true khi 1 trigger audio (section/energy/phrase, xem
         * circle-mode.js) vừa nổ ra: chặn spawn wave MỚI, chờ `gameplayWaves` rỗng rồi mới xáo lại
         * bảng gán pitch→ô (`gameplayPitchCellMap`) và tắt cờ này — KHÔNG ép các wave đang sống đổi
         * vị trí giữa chừng.
         */
        AppState.definePackage('gameplay-runtime', {
            schema: {
                gameplayPhase: 'string',
                gameplayMode: 'nullable-string',            // 'circle' | null — v1 chỉ có 'circle'
                gameplayDifficulty: 'string',                // 'easy' | 'medium' | 'hard'
                gameplayWaves: 'array',
                gameplayComboStreak: 'number',                // số lần perfect/excellent liên tiếp hiện tại
                gameplayTotalScore: 'number',                 // tổng điểm tier (đã nhân combo), CHƯA chia circleCount
                gameplayCircleCount: 'number',                // số vòng đã resolve (tap hợp lệ HOẶC miss)
                gameplayHitCounts: 'any',                     // {perfect,excellent,good,bad,miss} — số lần mỗi loại
                gameplayCountdownValue: 'number',
                // Dải MIDI thấp nhất/cao nhất QUAN SÁT ĐƯỢC trong chính phiên chơi này (không phải
                // hằng số cố định) — input cho lưới pitch→ô, xem circle-mode.js::
                // computeSpawnPositionCell()/computePitchRangeUpdate(). null = chưa detect nốt nào.
                gameplayPitchRangeMin: 'nullable-number',
                gameplayPitchRangeMax: 'nullable-number',
                // Bảng gán bucket-pitch → ô lưới hiện hành: mảng {pitchMin, pitchMax, cellX, cellY}
                // (cellX/cellY là tâm ô, px thật) — xáo lại mỗi khi refresh (xem
                // gameplayPositionRefreshPending ở trên).
                gameplayPitchCellMap: 'array',
                gameplayRefreshPending: 'boolean',
            },
            buildDefaults() {
                return {
                    gameplayPhase: 'idle',
                    gameplayMode: null,
                    gameplayDifficulty: 'hard',
                    gameplayWaves: [],
                    gameplayComboStreak: 0,
                    gameplayTotalScore: 0,
                    gameplayCircleCount: 0,
                    gameplayHitCounts: { perfect: 0, excellent: 0, good: 0, bad: 0, miss: 0 },
                    gameplayCountdownValue: GAMEPLAY_COUNTDOWN_SECONDS,
                    gameplayPitchRangeMin: null,
                    gameplayPitchRangeMax: null,
                    gameplayPitchCellMap: [],
                    gameplayRefreshPending: false,
                };
            },
        });

        /** Số giây đếm ngược trước khi wave đầu tiên được spawn — Workflow (event/workflow/
         * gameplay.js::startCountdown()) đọc hằng số này khi taskManager.addNew(). */
        const GAMEPLAY_COUNTDOWN_SECONDS = 5;

        /**
         * Hằng số điều chỉnh cơ chế Circle — TẤT CẢ đơn vị px/ms trừ khi ghi rõ khác. Mọi hàm Core
         * (core/gameplay/circle-mode.js) nhận object này qua THAM SỐ, không đọc trực tiếp từ đây
         * (giữ Core thuần/dễ test — đúng cùng nguyên tắc "chỉ nhận tham số" dù đây là hằng số tĩnh
         * chứ không phải appState).
         */
        const GAMEPLAY_CIRCLE_CONFIG = Object.freeze({
            centerRadius: 42,           // px — bán kính vòng tròn đích cố định (mục tiêu chạm khớp)
            waveStartRadius: 84,        // px — 2× centerRadius (cỡ approach ring lúc spawn)
            gapOuter: 20,               // px — biên NGOÀI vùng tính điểm (centerRadius + gapOuter, bấm sớm)
            gapInner: 5,                // px — biên TRONG vùng tính điểm (centerRadius - gapInner, bấm trễ)
            beatsPerWave: 3,            // wave co hết trong đúng N nhịp beat hiện tại (currentCalculatedBpm)
            fallbackShrinkDurationMs: 1500, // ms — dùng khi CHƯA xác định được BPM
            minShrinkDurationMs: 900,   // ms — chặn dưới (BPM quá nhanh)
            maxShrinkDurationMs: 3000,  // ms — chặn trên (BPM quá chậm)
            spawnProbabilityMin: 0.35,  // xác suất spawn lúc smoothedEnergy = 0 (nhạc êm -> vẫn còn note, chỉ thưa hơn)
            spawnProbabilityMax: 1.0,   // xác suất spawn lúc smoothedEnergy = 1 (nhạc mạnh -> gần như luôn spawn)
            pitchMinSpanSemitones: 5,   // dải pitch quan sát được PHẢI rộng >= ngưỡng này mới bucket-hoá theo lưới
            spawnZone: Object.freeze({  // % layer — vùng khả dụng để tính lưới ô (đổi ra px thật lúc runtime)
                xMinPercent: 15, xMaxPercent: 85,
                yMinPercent: 25, yMaxPercent: 82,
            }),
            gridCellSizePx: 55,          // px — kích thước 1 ô lưới pitch→vị trí
            cellJitterMarginPx: 1,       // px — lệch tâm ngẫu nhiên trong ô giới hạn (gridCellSizePx - margin)
            minSpawnDistancePx: 84,      // px — khoảng cách tối thiểu giữa 2 wave đang sống lúc spawn mới (chống đè hình)
            tapHitTolerancePx: 70,       // px — dung sai vị trí lúc chấm tap trúng note nào (toạ độ giờ là px thật, canvas — không còn % như bản DOM cũ)
            // maxRatio giờ áp cho tỉ lệ khoảng cách CHUẨN HOÁ THEO TỪNG PHÍA (bấm sớm chia gapOuter,
            // bấm trễ chia gapInner) — xem classifyTapTier() trong circle-mode.js.
            tiers: Object.freeze([
                Object.freeze({ name: 'perfect',   maxRatio: 0.15, score: 4 }),
                Object.freeze({ name: 'excellent', maxRatio: 0.40, score: 3 }),
                Object.freeze({ name: 'good',      maxRatio: 0.70, score: 2 }),
                Object.freeze({ name: 'bad',       maxRatio: 1.00, score: 1 }),
                // ratio > 1.00 -> miss, score 0 (không nằm trong bảng, classifyTapTier() trả null)
            ]),
            comboTierNames: Object.freeze(['perfect', 'excellent']), // tier nào được cộng dồn combo
            comboMultiplierStepSize: 10,  // mỗi 10 combo tăng 1 bậc multiplier
            comboMultiplierStepValue: 0.1, // +0.1 mỗi bậc (multiplier = 1 + floor(combo/step)*stepValue)
            opacityBase: 0.5,             // opacity cố định khi radius ngoài vùng gap
            opacityAtInnerEdge: 0.9,      // opacity đạt được đúng lúc radius chạm biên trong (centerRadius-gapInner)
            starMax: 5,
            starRoundingThreshold: 0.8,   // phần thập phân >= ngưỡng này mới làm tròn LÊN, xem computeStarRating()
            refreshBeatsForPhrase: 16,    // xấp xỉ 1 phrase = 16 beat (không có phrase detection thật)
            // Ngưỡng lệch flux (2 cửa sổ trượt 10 giá trị gần nhất trên fluxHistory) để kích hoạt
            // refresh vị trí — số khởi điểm, CẦN tinh chỉnh qua playtest thật, không phải số cuối.
            difficulty: Object.freeze({
                // maxConcurrentWaves: CHỈ Easy có giới hạn thật (=1, đúng yêu cầu gốc "không hiện B
                // khi A chưa xong") — Medium/Hard KHÔNG có yêu cầu nào giới hạn số wave cùng lúc, để
                // Infinity (tự nhiên bao nhiêu cũng được, chỉ bị chặn bởi nhịp beat thật + xác suất
                // spawn + khoảng cách chống đè hình — không cần thêm trần nhân tạo).
                easy:   Object.freeze({ maxConcurrentWaves: 1,        spawnEligibleEveryNBeats: 1, fluxDeltaEnergy: 60, fluxDeltaSection: 100 }),
                medium: Object.freeze({ maxConcurrentWaves: Infinity, spawnEligibleEveryNBeats: 3, fluxDeltaEnergy: 35, fluxDeltaSection: 60 }),
                hard:   Object.freeze({ maxConcurrentWaves: Infinity, spawnEligibleEveryNBeats: 1, fluxDeltaEnergy: 15, fluxDeltaSection: 30 }),
            }),
        });
