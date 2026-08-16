/**
 * service/state/gameplay-runtime.js — Package STATE domain "gameplay-runtime": trạng thái phiên
 * chơi Game Mode trên màn Visualizer (MỚI, 16/08/2026, plan gameplay — mode 1 "Circle" trước tiên,
 * xem readme/... khi có). Xem cơ chế package ở service/state.js. PHẢI nạp SAU service/state.js,
 * TRƯỚC service/state/record/index.js (registry('player','all') cần package này đã định nghĩa xong).
 *
 * Đặt TÊN FIELD có tiền tố `gameplay` để tránh trùng flat key với 18 package khác đã có (field
 * KHÔNG namespace theo tên package — appState.get('...') đọc thẳng flat key, xem các package khác
 * như visualizer-runtime.js).
 *
 * `gameplayWaves`: mảng { id, spawnedAt, startRadius } — KHÔNG lưu radius hiện tại (giá trị suy ra
 * mỗi frame từ spawnedAt/now/shrinkDurationMs qua core/gameplay/circle-mode.js::computeWaveRadius(),
 * không phải state — tránh 2 nguồn sự thật).
 */
        /**
         * SỬA (16/08/2026, Giang yêu cầu thêm màn "Start" + đếm ngược 5s trước khi wave bắt đầu
         * spawn) — gộp 2 field rời `gameplayActive`/`gameplayScoreScreenVisible` (bản đầu) thành 1
         * field DUY NHẤT `gameplayPhase` (enum string) để tránh tổ hợp cờ vô nghĩa (vd active=true
         * VÀ scoreScreenVisible=true cùng lúc — trạng thái không tồn tại trong thực tế nhưng 2
         * boolean độc lập vẫn cho phép biểu diễn sai). 5 giá trị hợp lệ:
         *   'idle'      — chưa vào Game Mode, #gameplay-layer ẩn hẳn.
         *   'ready'     — layer đã mở, hiện màn chờ + nút Start, CHƯA spawn wave nào.
         *   'countdown' — đang đếm 5s (gameplayCountdownValue 5->0), CHƯA spawn wave.
         *   'playing'   — wave đang spawn/tick/nhận tap thật.
         *   'ended'     — hết bài, hiện màn kết quả (Replay/Next/End).
         */
        AppState.definePackage('gameplay-runtime', {
            schema: {
                gameplayPhase: 'string',                    // 'idle' | 'ready' | 'countdown' | 'playing' | 'ended'
                gameplayMode: 'nullable-string',           // 'circle' | null — v1 chỉ có 'circle'
                gameplayWaves: 'array',
                gameplayComboStreak: 'number',              // số lần Excellent/Perfect liên tiếp hiện tại
                gameplayTotalScore: 'number',               // tổng điểm tier (đã nhân combo), CHƯA chia circleCount
                gameplayCircleCount: 'number',              // số vòng đã resolve (tap hợp lệ HOẶC miss)
                gameplayCountdownValue: 'number',           // số hiện tại đang hiện lúc phase='countdown' (5->0)
            },
            buildDefaults() {
                return {
                    gameplayPhase: 'idle',
                    gameplayMode: null,
                    gameplayWaves: [],
                    gameplayComboStreak: 0,
                    gameplayTotalScore: 0,
                    gameplayCircleCount: 0,
                    gameplayCountdownValue: GAMEPLAY_COUNTDOWN_SECONDS,
                };
            },
        });

        /** Số giây đếm ngược trước khi wave đầu tiên được spawn — 1 nơi duy nhất định nghĩa, Workflow
         * (event/workflow/gameplay.js::startCountdown()) đọc hằng số này khi taskManager.addNew(). */
        const GAMEPLAY_COUNTDOWN_SECONDS = 5;

        /**
         * Hằng số điều chỉnh cơ chế Circle — TẤT CẢ đơn vị px/ms. SỬA (16/08/2026, Giang chốt —
         * "duration, radius của wave phải theo audio chứ?") — `shrinkDurationMs`/`waveStartRadius`
         * KHÔNG còn là 2 số cố định: mỗi wave tự tính riêng lúc spawn theo BPM/energy hiện tại
         * (xem core/gameplay/circle-mode.js::computeShrinkDurationMs()/computeWaveStartRadius()) —
         * dưới đây là các HẰNG SỐ tham gia công thức đó, không phải giá trị áp thẳng.
         *
         * `centerRadius`/`gap`/`tiers`/`maxConcurrentWaves` VẪN cố định — đây là tham số ĐỘ KHÓ
         * (kích thước/dung sai vùng bấm), không có lý do để đổi theo audio, cần Giang playtest rồi
         * chỉnh riêng (chưa đổi gì ở đợt này).
         *
         * GIẢ ĐỊNH (CHƯA playtest, sửa 1 chỗ ở đây):
         *   - beatsPerWave=2: wave co hết trong đúng 2 nhịp beat (BPM 120 -> 1000ms, BPM 90 ->
         *     ~1333ms). Số nhịp/wave lớn hơn = wave "trôi" chậm hơn, dễ hơn; nhỏ hơn = nhanh/khó hơn.
         *   - min/maxShrinkDurationMs: chặn 2 đầu khi BPM quá nhanh/chậm (BPM cực cao -> duration
         *     không xuống dưới 500ms, tránh không kịp phản xạ; BPM cực thấp -> không vượt 3000ms,
         *     tránh chờ quá lâu mất nhịp chơi).
         *   - fallbackShrinkDurationMs=1500: dùng khi audio-analysis.js CHƯA khoá được BPM
         *     (currentCalculatedBpm === "---", vd vài giây đầu bài hoặc đoạn nhạc không rõ beat).
         *   - waveStartRadiusBase/EnergyRange (150/150 -> dải 150-300px): năng lượng thấp -> wave
         *     nhỏ/gọn, năng lượng cao (đoạn nhạc mạnh) -> wave to/kịch tính hơn — KHÔNG ảnh hưởng độ
         *     khó chấm điểm (vẫn cùng centerRadius/gap), chỉ ảnh hưởng thị giác + gián tiếp tốc độ co
         *     (cùng duration, radius to hơn thì co nhanh hơn theo px/ms).
         *   - 4 tier chia đều [0,1] theo cấp số cộng (0.25/0.5/0.75/1.0) — mô tả gốc chỉ nói "càng
         *     xa biên càng ít điểm", không cho số chính xác.
         *   - Combo NHÂN tuyến tính theo streak, KHÔNG trần (uncapped).
         */
        const GAMEPLAY_CIRCLE_CONFIG = Object.freeze({
            centerRadius: 42,          // px — bán kính vòng tròn tâm cố định (mục tiêu chạm khớp)
            gap: 34,                   // px — bề dày vùng hợp lệ bấm được (cả 2 phía quanh centerRadius)
            beatsPerWave: 2,           // wave co hết trong đúng N nhịp beat hiện tại (currentCalculatedBpm)
            fallbackShrinkDurationMs: 1500, // ms — dùng khi CHƯA xác định được BPM
            minShrinkDurationMs: 500,  // ms — chặn dưới (BPM quá nhanh)
            maxShrinkDurationMs: 3000, // ms — chặn trên (BPM quá chậm)
            waveStartRadiusBase: 150,  // px — bán kính wave lúc smoothedEnergy = 0
            waveStartRadiusEnergyRange: 150, // px — CỘNG THÊM tối đa lúc smoothedEnergy = 1 (dải 150-300px)
            maxConcurrentWaves: 3,     // số wave tối đa cùng lúc trên màn hình
            tiers: Object.freeze([
                Object.freeze({ name: 'perfect',   maxRatio: 0.15, score: 4 }),
                Object.freeze({ name: 'excellent', maxRatio: 0.40, score: 3 }),
                Object.freeze({ name: 'good',      maxRatio: 0.70, score: 2 }),
                Object.freeze({ name: 'bad',       maxRatio: 1.00, score: 1 }),
                // ratio > 1.00 -> miss, score 0 (không nằm trong bảng, xử lý qua classifyTapTier() trả null)
            ]),
            comboTierNames: Object.freeze(['perfect', 'excellent']), // tier nào được cộng dồn combo
        });
