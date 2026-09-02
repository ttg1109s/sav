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
        /**
         * `gameplayArmedGameId` (nullable-string) — MỚI (02/09/2026, Game Panel app-store list,
         * [SỬA cùng ngày] Giang yêu cầu "game mode không lưu, trạng thái tạm thời RAM"). ĐÚNG game
         * đang armed (nút Play trên card Game Panel đã đổi Exit) — null = không game nào armed.
         * SESSION-ONLY (mất khi reload trang, KHÔNG PERSISTENT — KHÁC mọi field khác cùng file này
         * chỉ ở điểm KHÔNG có bản sao nào trong AppConfig/vizConfig, đây LÀ field duy nhất của cụm
         * "Game Mode" từng cân nhắc lưu persistent (core/config.js, bản cũ boolean
         * `gameplayModeEnabled`) rồi bỏ hẳn ý định đó). Ghi/đọc qua
         * setGameplayArmedGameId()/appState.get() như mọi field khác — KHÔNG có cơ chế đặc biệt
         * nào, chỉ đơn giản là schema này KHÔNG có mặt trong core/config.js.
         */
        AppState.definePackage('gameplay-runtime', {
            schema: {
                gameplayPhase: 'string',
                gameplayMode: 'nullable-string',            // 'circle' | null — v1 chỉ có 'circle'
                gameplayArmedGameId: 'nullable-string',
                gameplayDifficulty: 'string',                // 'easy' | 'medium' | 'hard'
                gameplayWaves: 'array',
                gameplayComboByTier: 'any',                   // {perfect,excellent} — streak RIÊNG từng tier, xem computeComboScoreGain()
                gameplayTotalScore: 'number',                 // tổng điểm tier (đã nhân combo), CHƯA chia circleCount
                gameplayCircleCount: 'number',                // số vòng đã resolve (tap hợp lệ HOẶC miss)
                gameplayHitCounts: 'any',                     // {perfect,excellent,good,bad,miss} — số lần mỗi loại
                gameplayCountdownValue: 'number',
                // [SỬA — viết lại thuật toán pitch map, phản hồi Giang "dải MIDI cố định [0-127]"]
                // gameplayPitchRangeMin/Max ĐÃ XOÁ — dải MIDI giờ CỐ ĐỊNH, không còn "dải quan sát
                // được trong phiên" nào cần theo dõi (computePitchRangeUpdate() ĐÃ XOÁ, circle-mode.js).
                // Bảng gán MIDI (0-127) → ô lưới hiện hành: mảng ĐÚNG 128 phần tử, index = note MIDI,
                // value = {col, row, cellX, cellY} (cellX/cellY là tâm ô, px thật) — round-robin +
                // shuffle qua buildPitchCellMap() (circle-mode.js), xáo lại mỗi khi refresh (xem
                // gameplayRefreshPending ở dưới).
                gameplayPitchCellMap: 'array',
                gameplayRefreshPending: 'boolean',
            },
            buildDefaults() {
                return {
                    gameplayPhase: 'idle',
                    gameplayMode: null,
                    gameplayArmedGameId: null,
                    gameplayDifficulty: 'hard',
                    gameplayWaves: [],
                    gameplayComboByTier: { perfect: 0, excellent: 0 },
                    gameplayTotalScore: 0,
                    gameplayCircleCount: 0,
                    gameplayHitCounts: { perfect: 0, excellent: 0, good: 0, bad: 0, miss: 0 },
                    gameplayCountdownValue: GAMEPLAY_COUNTDOWN_SECONDS,
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
            fallbackShrinkDurationMs: 1500, // ms — dùng khi CHƯA xác định được BPM (TRƯỚC KHI nhân difficultyDurationMultiplier)
            // [SỬA — phản hồi Giang, dải duration hiệu chỉnh] chặn trên/dưới nới rộng 900-3000 ->
            // 500-5000 — đủ chỗ cho difficultyDurationMultiplier (dưới, mỗi độ khó) kéo dài/rút ngắn
            // thật sự có tác dụng thay vì bị chặn cụt ngay gần mức gốc.
            minShrinkDurationMs: 500,   // ms — chặn dưới, ÁP SAU khi nhân multiplier
            maxShrinkDurationMs: 5000,  // ms — chặn trên, ÁP SAU khi nhân multiplier
            spawnProbabilityMin: 0.35,  // xác suất spawn lúc smoothedEnergy = 0 (nhạc êm -> vẫn còn note, chỉ thưa hơn)
            spawnProbabilityMax: 1.0,   // xác suất spawn lúc smoothedEnergy = 1 (nhạc mạnh -> gần như luôn spawn)
            spawnZone: Object.freeze({  // % layer — vùng khả dụng để tính lưới ô (đổi ra px thật lúc runtime)
                xMinPercent: 15, xMaxPercent: 85,
                yMinPercent: 25, yMaxPercent: 82,
            }),
            gridCellSizePx: 55,          // px — kích thước 1 ô lưới pitch→vị trí
            cellJitterMarginPx: 1,       // px — lệch tâm ngẫu nhiên trong ô giới hạn (gridCellSizePx - margin)
            tapHitTolerancePx: 70,       // px — dung sai vị trí lúc chấm tap trúng note nào (toạ độ giờ là px thật, canvas — không còn % như bản DOM cũ)
            // maxRatio giờ áp cho tỉ lệ khoảng cách CHUẨN HOÁ THEO TỪNG PHÍA (bấm sớm chia gapOuter,
            // bấm trễ chia gapInner) — xem classifyTapTier() trong core/gameplay/engine.js.
            // [SỬA — phản hồi Giang, bảng điểm mới] Perfect 5, Excellent 3, Good 1, Bad 0, Miss -2
            // (MỚI — Miss giờ TRỪ điểm, trước đây luôn 0 dù tap trật hay wave tự hết hạn).
            tiers: Object.freeze([
                Object.freeze({ name: 'perfect',   maxRatio: 0.15, score: 5 }),
                Object.freeze({ name: 'excellent', maxRatio: 0.40, score: 3 }),
                Object.freeze({ name: 'good',      maxRatio: 0.70, score: 1 }),
                Object.freeze({ name: 'bad',       maxRatio: 1.00, score: 0 }),
                // ratio > 1.00 -> miss, dùng missScore ngay dưới (không nằm trong bảng — classifyTapTier() trả null, KHÁC lý do miss = tự hết hạn không qua classifyTapTier() luôn, xem event/workflow/gameplay.js)
            ]),
            missScore: -2, // [MỚI] áp cho CẢ 2 nguồn miss: tap trật (ratio>1, event/workflow/gameplay.js::handleTap()) LẪN wave tự hết hạn (tick()::missedEntries)
            // [SỬA — phản hồi Giang, combo theo từng tier riêng, xem computeComboScoreGain() +
            // docstring event/workflow/gameplay.js::handleTap()] Thứ tự mảng này LÀ bảng xếp hạng
            // (best -> worst) — 1 tier T tăng combo CHÍNH NÓ, RESET combo tier ĐỨNG TRƯỚC nó trong
            // mảng (tốt hơn), GIỮ NGUYÊN combo tier ĐỨNG SAU (kém hơn). KHÔNG tự ý đổi thứ tự.
            comboTierNames: Object.freeze(['perfect', 'excellent']),
            // [SỬA — phản hồi Giang "đồng bộ comboMultiplierStepSize/StepValue"] Combo giờ tách
            // RIÊNG từng tier (computeComboScoreGain(), engine.js) — 1 bậc step DÙNG CHUNG cho cả 2
            // không còn hợp lý: Perfect KHÓ giữ hơn Excellent (1 cú Excellent xen giữa reset ngay,
            // xem docstring computeComboScoreGain()), nên XỨNG ĐÁNG lên bậc NHANH HƠN + MỖI BẬC
            // ĐÁNG GIÁ HƠN để bù công giữ combo khó; Excellent dễ giữ hơn (Perfect xen giữa KHÔNG
            // phá) nên bậc xa hơn + nhẹ hơn. Tách theo tier, KHÔNG còn 1 cặp số chung.
            comboMultiplierConfig: Object.freeze({
                perfect:   Object.freeze({ stepSize: 5, stepValue: 0.15 }), // x1.15 tại streak 5, x1.30 tại 10...
                excellent: Object.freeze({ stepSize: 8, stepValue: 0.1 }),  // x1.1 tại streak 8, x1.2 tại 16...
            }),
            comboPopupScalePerStreak: 0.08, // MỚI — mỗi streak +1 phóng to chữ popup tier thêm 8%
            comboPopupScaleMax: 1.8,        // MỚI — trần phóng to, tránh chữ khổng lồ lúc streak rất cao
            opacityBase: 0.5,             // opacity cố định khi radius ngoài vùng gap
            opacityAtInnerEdge: 0.9,      // opacity đạt được đúng lúc radius chạm biên trong (centerRadius-gapInner)
            starMax: 5,
            starRoundingThreshold: 0.8,   // phần thập phân >= ngưỡng này mới làm tròn LÊN, xem computeStarRating()
            refreshBeatsForPhrase: 16,    // xấp xỉ 1 phrase = 16 beat (không có phrase detection thật)
            /**
             * [SỬA — phản hồi Giang, chỉnh lại độ khó] `fluxThreshold`: Easy 0.5, Medium 0.8 (tăng
             * từ 0.6), Hard giữ 0.3.
             *
             * `maxConcurrentWaves`: Easy=1 ("chỉ một nốt một"). Medium là KHOẢNG (roll ngẫu nhiên
             * mỗi lần xét spawn qua computeConcurrentWaveCap(), circle-mode.js — mật độ DAO ĐỘNG
             * thay vì cố định). Hard giữ Infinity.
             *
             * [SỬA — phản hồi Giang, tinh chỉnh thêm] Medium: `spawnEligibleEveryNBeats` 2 -> 1
             * ("thu hẹp khoảng cách xuất hiện wave tiếp" — cùng nhịp Hard, chỉ khác trần số
             * wave/threshold flux). `minConcurrentWaves` 2 -> 3 ("roll max 3-5", giữ trần trên 5).
             *
             * `chainReproductionEnabled`/`chainMaxLevel` — MỚI, CHỈ Hard: lúc spawn mà bảng CÒN
             * wave sống -> "sinh sản" thành chuỗi nhiều wave, NHẢ DẦN mỗi wave 1 (KHÔNG bung hết 1
             * lần — xem event/workflow/gameplay.js::_trySpawnWave()/_spawnNextChainedWave()) — cấp
             * độ chuỗi tăng dần qua MỖI lần trigger còn thấy wave sống, trần `chainMaxLevel`, đứt
             * chuỗi khi bảng sạch HOẶC lúc refresh (workflowGameplay._hardChainLevel/
             * _hardChainQueue, KHÔNG phải field ở đây). Quãng cách giữa 2 wave LIÊN TIẾP trong
             * chuỗi = NỬA `spawnEligibleEveryNBeats` (computeChainSpacingMs(), circle-mode.js —
             * quy đổi ra ms từ BPM, không đếm nguyên beat được vì là số lẻ 0.5).
             */
            difficulty: Object.freeze({
                easy:   Object.freeze({ maxConcurrentWaves: 1, spawnEligibleEveryNBeats: 1, shrinkDurationMultiplier: 1.3, energyWindowBeats: 4, sectionWindowBeats: 12, fluxThreshold: 0.5 }),
                medium: Object.freeze({ minConcurrentWaves: 3, maxConcurrentWaves: 5, spawnEligibleEveryNBeats: 1, shrinkDurationMultiplier: 1.2, energyWindowBeats: 3, sectionWindowBeats: 9, fluxThreshold: 0.8 }),
                hard:   Object.freeze({ maxConcurrentWaves: Infinity, spawnEligibleEveryNBeats: 1, shrinkDurationMultiplier: 1, energyWindowBeats: 2, sectionWindowBeats: 6, fluxThreshold: 0.3, chainReproductionEnabled: true, chainMaxLevel: 8 }),
            }),
        });
