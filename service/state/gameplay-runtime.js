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
 * SỬA (16/08/2026, đọc lại plan — mỗi note giờ là 1 CẶP circle+wave ĐỘC LẬP, xuất hiện ở vị trí
 * riêng, KHÔNG còn 1 vòng tròn tâm tĩnh dùng chung) — `gameplayWaves`: mảng { id, spawnedAt,
 * startRadius, shrinkDurationMs, x, y }. `x`/`y` là % vị trí trong `#gameplay-layer` (Pitch quyết
 * định y, ngẫu nhiên quyết định x — xem GAMEPLAY_CIRCLE_CONFIG), CỐ ĐỊNH lúc spawn, không đổi suốt
 * vòng đời wave. KHÔNG lưu radius/opacity hiện tại (giá trị suy ra mỗi frame từ spawnedAt/now/
 * shrinkDurationMs qua core/gameplay/circle-mode.js::computeWaveRadius()/computeWaveOpacity(),
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
         * Hằng số điều chỉnh cơ chế Circle — TẤT CẢ đơn vị px/ms. SỬA LẦN 2 (16/08/2026, đọc lại
         * plan §9 "Chọn cách sinh note theo audio" + chốt lại với Giang) — phân công ĐÚNG theo plan:
         *   - Beat quyết định "khi nào" -> thời điểm spawn (core/gameplay/circle-mode.js::
         *     shouldSpawnCircleWave(), khoá lastBeatTime thật) + gián tiếp duration (beatsPerWave,
         *     quyết định riêng của tôi, plan không gán rõ nguồn cho duration).
         *   - Pitch quyết định "ở đâu" -> vị trí Y (computeSpawnPositionY(), map TUYỆT ĐỐI
         *     lastValidMidiNote vào [pitchMidiMin, pitchMidiMax] -> [yMaxPercent, yMinPercent] —
         *     Giang chốt KHÔNG so lệch với rubikPitchAvg như core/visualizer/types/rubik.js đang làm
         *     cho Rubik effect, vì "mỗi bài khác nhau là đúng" — nốt tuyệt đối, không chuẩn hoá).
         *   - Energy quyết định "bao nhiêu" -> XÁC SUẤT spawn mỗi khi có beat mới (KHÔNG PHẢI kích
         *     thước wave như bản đầu tôi gán nhầm) — computeSpawnProbability().
         *   - Radius (waveStartRadius): plan KHÔNG gán cho beat/energy/pitch nào cả -> GIỮ CỐ ĐỊNH,
         *     cùng nhóm "độ khó/thị giác" với centerRadius/gap, cần playtest riêng.
         *   - Vị trí X: plan không gán nguồn nào -> ngẫu nhiên trong spawnZone (không có tín hiệu
         *     audio kiểu stereo pan có sẵn để bám vào).
         *
         * GIẢ ĐỊNH (CHƯA playtest, sửa 1 chỗ ở đây):
         *   - beatsPerWave=2, min/maxShrinkDurationMs, fallbackShrinkDurationMs: xem giải thích cũ,
         *     không đổi ở lần sửa này.
         *   - spawnProbabilityMin/Max (0.35 - 1.0): lúc smoothedEnergy=0 vẫn còn 35% cơ hội spawn
         *     (không im bặt hoàn toàn dù đoạn nhạc rất êm — vẫn phải "chơi được"), energy=1 gần như
         *     luôn spawn khi có beat.
         *   - pitchMidiMin/Max (36-96, ~C2-C7): dải phủ hầu hết nhạc cụ/giọng hát phổ biến — nốt
         *     ngoài dải bị clamp về 2 đầu, không tự mở rộng theo bài.
         *   - spawnZone: X ngẫu nhiên toàn dải 15-85%; Y clamp trong 25-82% (nốt map ra ngoài dải
         *     này vẫn bị kẹp lại) — 25% đủ thấp hơn hàng icon Control Center/stats/back Playlist
         *     (top-4), tương tự lý do đã chốt cho --gameplay-circle-top trước đây (giờ bỏ biến đó,
         *     thay bằng spawnZone vì vị trí không còn cố định 1 chỗ nữa).
         *   - 4 tier chia đều [0,1] theo cấp số cộng (0.25/0.5/0.75/1.0) — mô tả gốc chỉ nói "càng
         *     xa biên càng ít điểm", không cho số chính xác.
         *   - Combo NHÂN tuyến tính theo streak, KHÔNG trần (uncapped).
         *   - tapHitTolerancePercent=16: dung sai bấm trúng 1 note theo VỊ TRÍ (% theo cạnh ngắn
         *     hơn của layer, xem event/workflow/gameplay.js::handleTap()) — MỚI, cần khi vị trí
         *     không còn cố định 1 chỗ (nhiều circle rải khắp màn hình).
         */
        const GAMEPLAY_CIRCLE_CONFIG = Object.freeze({
            centerRadius: 42,          // px — bán kính vòng tròn tâm cố định (mục tiêu chạm khớp)
            gap: 34,                   // px — bề dày vùng hợp lệ bấm được (cả 2 phía quanh centerRadius)
            waveStartRadius: 230,      // px — CỐ ĐỊNH (plan không gán nguồn audio nào cho radius)
            beatsPerWave: 2,           // wave co hết trong đúng N nhịp beat hiện tại (currentCalculatedBpm)
            fallbackShrinkDurationMs: 1500, // ms — dùng khi CHƯA xác định được BPM
            minShrinkDurationMs: 500,  // ms — chặn dưới (BPM quá nhanh)
            maxShrinkDurationMs: 3000, // ms — chặn trên (BPM quá chậm)
            maxConcurrentWaves: 3,     // số wave tối đa cùng lúc trên màn hình
            spawnProbabilityMin: 0.35, // xác suất spawn lúc smoothedEnergy = 0 (nhạc êm -> vẫn còn note, chỉ thưa hơn)
            spawnProbabilityMax: 1.0,  // xác suất spawn lúc smoothedEnergy = 1 (nhạc mạnh -> gần như luôn spawn)
            pitchMidiMin: 36,          // nốt MIDI thấp nhất map được (~C2) -> yMaxPercent (thấp trên màn hình)
            pitchMidiMax: 96,          // nốt MIDI cao nhất map được (~C7) -> yMinPercent (cao trên màn hình)
            spawnZone: Object.freeze({
                xMinPercent: 15, xMaxPercent: 85,
                yMinPercent: 25, yMaxPercent: 82,
            }),
            tapHitTolerancePercent: 16, // % (theo cạnh ngắn hơn layer) — dung sai vị trí lúc chấm tap trúng note nào
            tiers: Object.freeze([
                Object.freeze({ name: 'perfect',   maxRatio: 0.15, score: 4 }),
                Object.freeze({ name: 'excellent', maxRatio: 0.40, score: 3 }),
                Object.freeze({ name: 'good',      maxRatio: 0.70, score: 2 }),
                Object.freeze({ name: 'bad',       maxRatio: 1.00, score: 1 }),
                // ratio > 1.00 -> miss, score 0 (không nằm trong bảng, xử lý qua classifyTapTier() trả null)
            ]),
            comboTierNames: Object.freeze(['perfect', 'excellent']), // tier nào được cộng dồn combo
        });
