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
                // MỚI (16/08/2026, Giang phản hồi "phân bổ high/low gây thiên lệch, cần đều hơn
                // nhưng vẫn dùng pitch") — dải MIDI THẤP NHẤT/CAO NHẤT đã QUAN SÁT ĐƯỢC trong CHÍNH
                // phiên chơi này (KHÔNG phải hằng số cố định nữa) — xem core/gameplay/circle-mode.js
                // ::computeSpawnPositionY()/computePitchRangeUpdate(). null = chưa detect được nốt
                // nào trong phiên này.
                gameplayPitchRangeMin: 'nullable-number',
                gameplayPitchRangeMax: 'nullable-number',
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
                    gameplayPitchRangeMin: null,
                    gameplayPitchRangeMax: null,
                };
            },
        });

        /** Số giây đếm ngược trước khi wave đầu tiên được spawn — 1 nơi duy nhất định nghĩa, Workflow
         * (event/workflow/gameplay.js::startCountdown()) đọc hằng số này khi taskManager.addNew(). */
        const GAMEPLAY_COUNTDOWN_SECONDS = 5;

        /**
         * Hằng số điều chỉnh cơ chế Circle — TẤT CẢ đơn vị px/ms. SỬA LẦN 3 (16/08/2026, phản hồi
         * Giang — fade sai chỗ + vòng tròn biến mất quá nhanh + vị trí Y thiên lệch):
         *   - `pitchMidiMin`/`pitchMidiMax` (dải MIDI CỐ ĐỊNH) ĐÃ BỎ — thay bằng dải THÍCH ỨNG quan
         *     sát được TRONG CHÍNH phiên chơi (gameplayPitchRangeMin/Max, appState) — vẫn dùng
         *     pitch tuyệt đối (KHÔNG so lệch động như Rubik, đúng ý "mỗi bài khác nhau"), nhưng dải
         *     map co giãn theo ĐÚNG âm vực bài đang phát thay vì 1 dải rộng cố định 36-96 (đa số bài
         *     chỉ dùng 1 phần nhỏ dải đó -> vị trí dồn cục vào 1 vùng màn hình, đúng lỗi Giang chỉ
         *     ra) -> tự nhiên trải đều hơn, xem computeSpawnPositionY()/computePitchRangeUpdate().
         *   - `beatsPerWave` 2 -> 3, `minShrinkDurationMs` 500 -> 900: kéo dài thời gian wave tồn
         *     tại (Giang: "nhiều vòng tròn xuất hiện rồi nhanh chóng biến mất ngay") — CHƯA chắc
         *     chắn đây có phải bug thật hay không (soát code không thấy lỗi tính toán, elapsed/
         *     radius/miss-threshold đều đúng), nhiều khả năng fade quá nhanh (xem điểm dưới) làm
         *     wave MỜ ĐI sớm dù vẫn "sống" tạo cảm giác biến mất — tăng cả 2 để chắc chắn hơn nữa.
         *   - `computeWaveOpacity()` (core/gameplay/circle-mode.js) SỬA HẲN thuật toán — bản trước
         *     mờ dần ĐỀU suốt từ lúc spawn (1.0 -> 0.3 tuyến tính cả hành trình) — Giang chỉ rõ:
         *     "wave fade" là hiệu ứng CHỖ vòng ngoài THU VÀO vòng tâm, KHÔNG PHẢI mờ dần đều toàn bộ
         *     hành trình -> giờ giữ NGUYÊN opacity=1 suốt 70% đầu hành trình, CHỈ mờ dần ở 30% CUỐI
         *     (lúc sắp hợp nhất vào vòng tròn tâm).
         *
         * GIẢ ĐỊNH (CHƯA playtest lại, sửa 1 chỗ ở đây):
         *   - fallbackShrinkDurationMs/maxShrinkDurationMs: không đổi.
         *   - spawnProbabilityMin/Max, tiers, comboTierNames, spawnZone, tapHitTolerancePercent:
         *     không đổi ở lần sửa này.
         *   - pitchMinSpanSemitones=5: dải quan sát được PHẢI rộng ít nhất 5 nửa cung mới bắt đầu
         *     map theo tỉ lệ — dưới ngưỡng này (đầu bài, mới detect 1-2 nốt gần nhau) fallback về
         *     giữa spawnZone, tránh dồn cục ở y hệt 1 điểm ngay từ đầu bài.
         */
        const GAMEPLAY_CIRCLE_CONFIG = Object.freeze({
            centerRadius: 42,          // px — bán kính vòng tròn tâm cố định (mục tiêu chạm khớp)
            gap: 34,                   // px — bề dày vùng hợp lệ bấm được (cả 2 phía quanh centerRadius)
            waveStartRadius: 230,      // px — CỐ ĐỊNH (plan không gán nguồn audio nào cho radius)
            beatsPerWave: 3,           // wave co hết trong đúng N nhịp beat hiện tại (currentCalculatedBpm)
            fallbackShrinkDurationMs: 1500, // ms — dùng khi CHƯA xác định được BPM
            minShrinkDurationMs: 900,  // ms — chặn dưới (BPM quá nhanh)
            maxShrinkDurationMs: 3000, // ms — chặn trên (BPM quá chậm)
            maxConcurrentWaves: 3,     // số wave tối đa cùng lúc trên màn hình
            spawnProbabilityMin: 0.35, // xác suất spawn lúc smoothedEnergy = 0 (nhạc êm -> vẫn còn note, chỉ thưa hơn)
            spawnProbabilityMax: 1.0,  // xác suất spawn lúc smoothedEnergy = 1 (nhạc mạnh -> gần như luôn spawn)
            pitchMinSpanSemitones: 5,  // dải pitch quan sát được PHẢI rộng >= ngưỡng này mới map theo tỉ lệ, xem trên
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
