/**
 * core/gameplay/circle-mode.js — Core THUẦN cho Game Mode "Circle" (mode 1). Mỗi hàm ĐÚNG 1 việc
 * (Rule 1), CHỈ nhận tham số — KHÔNG tự appState.get() (Rule 2), KHÔNG gọi hàm core nào khác kể cả
 * trong chính file này (Rule 3a) — nơi cần phối hợp nhiều hàm (vd tính radius rồi mới classify tier)
 * là event/workflow/gameplay.js, KHÔNG phải ở đây.
 *
 * SỬA (16/08/2026, Giang yêu cầu "làm luôn" phần khoá beat + audio quyết định duration/radius):
 *   - Spawn giờ KHOÁ THEO BEAT THẬT — không còn cooldown đều. `shouldSpawnCircleWave()` so sánh
 *     `lastBeatTime` (biến global core/dom-refs.js, KHÔNG thuộc appState — audio-analysis.js ghi
 *     mỗi lần flux vượt threshold, xem core/audio-analysis.js) với mốc beat GẦN NHẤT Workflow đã
 *     tiêu thụ — khác nhau (và > 0) nghĩa là vừa có 1 beat MỚI, spawn ngay. `lastBeatTime` là
 *     `Date.now()`, KHÔNG cùng gốc thời gian với `performance.now()` (dùng cho vòng đời wave) —
 *     chỉ dùng để SO SÁNH THAY ĐỔI (đổi giá trị = có beat mới), KHÔNG dùng để trừ ra khoảng cách.
 *   - `shrinkDurationMs`/`startRadius` giờ tính RIÊNG cho TỪNG wave lúc spawn, theo audio TẠI THỜI
 *     ĐIỂM ĐÓ (`currentCalculatedBpm`/`smoothedEnergy`, appState có sẵn) — LƯU LUÔN vào wave (KHÔNG
 *     đọc lại cfg tĩnh mỗi frame), vì BPM/energy đổi liên tục theo bài mà 1 wave đã spawn thì vòng
 *     đời của nó phải cố định, không "trôi" giữa chừng nếu nhạc đổi nhịp.
 *   - Wave co dần bán kính theo THỜI GIAN TỰ THÂN kể từ lúc spawn (`performance.now()`), độc lập
 *     audio.currentTime — chỉ ĐIỂM SPAWN (beat) + 2 tham số ban đầu (duration/radius) là do audio
 *     quyết định, bản thân quá trình co diễn ra như 1 animation cố định sau đó.
 *
 * Vùng hợp lệ bấm = dải `gap` px quanh biên `centerRadius` (bán kính vòng tròn tâm CỐ ĐỊNH, KHÔNG
 * đổi theo audio — đây là tham số ĐỘ KHÓ, cần playtest riêng, xem GAMEPLAY_CIRCLE_CONFIG). Tap càng
 * gần biên (radius ~= centerRadius) càng được điểm cao.
 */

        /** Guard: có nên spawn 1 wave mới lúc này không — chưa đạt max wave cùng lúc, VÀ vừa có 1
         * beat THẬT MỚI (khác mốc đã tiêu thụ lần trước, > 0 — audio-analysis.js chưa từng detect
         * beat nào thì lastBeatTime vẫn là 0, giá trị khởi tạo ở core/dom-refs.js). */
        function shouldSpawnCircleWave(activeWaveCount, lastConsumedBeatTime, currentBeatTime, cfg) {
            if (activeWaveCount >= cfg.maxConcurrentWaves) return false;
            return currentBeatTime > 0 && currentBeatTime !== lastConsumedBeatTime;
        }

        /** Quy đổi BPM hiện tại (chuỗi từ appState — "---" khi chưa xác định được, hoặc số dạng
         * chuỗi) thành thời gian co (ms) cho 1 wave = đúng `beatsPerWave` nhịp theo tempo đó, clamp
         * trong [minShrinkDurationMs, maxShrinkDurationMs]. BPM không hợp lệ -> dùng fallback cố
         * định (nhạc chưa đủ nhịp để khoá BPM — vẫn có lý do audio ĐANG phát, không chặn spawn). */
        function computeShrinkDurationMs(bpmString, cfg) {
            const bpm = parseFloat(bpmString);
            if (!Number.isFinite(bpm) || bpm <= 0) return cfg.fallbackShrinkDurationMs;
            const raw = (60000 / bpm) * cfg.beatsPerWave;
            return Math.min(cfg.maxShrinkDurationMs, Math.max(cfg.minShrinkDurationMs, raw));
        }

        /** Bán kính KHỞI ĐIỂM của 1 wave — nội suy giữa waveStartRadiusBase (energy=0) và
         * base+waveStartRadiusEnergyRange (energy=1) theo `smoothedEnergy` HIỆN TẠI lúc spawn. */
        function computeWaveStartRadius(smoothedEnergy, cfg) {
            const energy = Math.min(1, Math.max(0, smoothedEnergy));
            return cfg.waveStartRadiusBase + energy * cfg.waveStartRadiusEnergyRange;
        }

        /** Tạo 1 wave mới — value thuần, chưa ghi vào đâu cả (Workflow tự appState.mutate() push).
         * `startRadius`/`shrinkDurationMs` PHẢI đã được tính sẵn (computeWaveStartRadius()/
         * computeShrinkDurationMs() ở trên) rồi truyền vào — hàm này KHÔNG tự tính, chỉ đóng gói. */
        function createCircleWave(id, spawnedAt, startRadius, shrinkDurationMs) {
            return { id, spawnedAt, startRadius, shrinkDurationMs };
        }

        /** Bán kính HIỆN TẠI của 1 wave tại thời điểm `now` — co tuyến tính từ startRadius về 0
         * trong đúng `wave.shrinkDurationMs` CỦA RIÊNG wave đó (lưu lúc spawn, xem createCircleWave()),
         * clamp không âm. */
        function computeWaveRadius(wave, now) {
            const elapsed = now - wave.spawnedAt;
            const ratio = Math.min(1, Math.max(0, elapsed / wave.shrinkDurationMs));
            return wave.startRadius * (1 - ratio);
        }

        /** Wave đã co vượt quá mép TRONG của vùng hợp lệ (bấm trễ, không còn cơ hội) -> coi là miss,
         * PHẢI bị dọn khỏi danh sách wave đang sống dù không ai bấm tới. */
        function isWaveMissed(radius, centerRadius, gap) {
            return radius < (centerRadius - gap);
        }

        /**
         * Tìm entry gần biên centerRadius nhất trong 1 danh sách {id, radius} ĐÃ TÍNH SẴN (Workflow
         * tự map() qua computeWaveRadius() cho từng wave rồi mới gọi hàm này — không phải core gọi
         * core, đây chỉ là 1 phép tính min trên dữ liệu đã có, xem Rule 3c phép thử "giá trị trung
         * gian"). Trả null nếu mảng rỗng.
         */
        function findNearestRadiusEntry(radiusEntries, centerRadius) {
            if (radiusEntries.length === 0) return null;
            let best = null, bestDist = Infinity;
            for (const entry of radiusEntries) {
                const dist = Math.abs(entry.radius - centerRadius);
                if (dist < bestDist) { bestDist = dist; best = entry; }
            }
            return best;
        }

        /** Xếp tier theo tỉ lệ khoảng cách/gap — trả {name, score} hoặc null nếu ngoài vùng hợp lệ
         * (chưa vào vùng HOẶC đã co vượt quá, đều coi là miss/false theo đúng mô tả gốc). */
        function classifyTapTier(radius, centerRadius, gap, tiers) {
            const ratio = Math.abs(radius - centerRadius) / gap;
            if (ratio > 1) return null; // miss — ngoài vùng hợp lệ ở CẢ 2 phía
            for (const tier of tiers) {
                if (ratio <= tier.maxRatio) return { name: tier.name, score: tier.score };
            }
            return null; // an toàn — lý thuyết không tới được đây nếu tiers phủ hết [0,1]
        }

        /**
         * Điểm THẬT SỰ cộng vào tổng cho 1 lần tap, kèm combo streak MỚI. Chỉ tier nằm trong
         * `comboTierNames` mới CỘNG DỒN streak + nhân hệ số (streak SAU khi cộng); mọi tier khác
         * (kể cả tap hợp lệ nhưng thấp, good/bad) LÀM GÃY combo về 0, không nhân.
         */
        function computeComboScoreGain(tierName, tierScore, comboStreakBefore, comboTierNames) {
            const continuesCombo = comboTierNames.includes(tierName);
            if (!continuesCombo) return { pointsGained: tierScore, newComboStreak: 0 };
            const newComboStreak = comboStreakBefore + 1;
            return { pointsGained: tierScore * newComboStreak, newComboStreak };
        }

        /** GHI cấu hình bật/tắt Game Mode PERSISTENT (khác gameplayPhase — đó là 1 phiên, đây là
         * tuỳ chọn lưu qua reload). KHÔNG tự gọi saveConfig() (Rule 3a, Core cấm gọi Core khác) —
         * nơi gọi (Workflow) tự gọi saveConfig() (core/config.js) NGAY SAU, xem event/workflow/
         * gameplay.js::setModeEnabled(). */
        function setGameplayModeEnabled(checked) {
            appConfigViz.mutateAll(cfg => { cfg.gameplayModeEnabled = checked; });
            console.log(`writer: "setGameplayModeEnabled", page: "gameplayModeEnabled", content: "${checked}"`);
        }

        /** Điểm trung bình cuối phiên = tổng điểm / số vòng đã xuất hiện — KHÔNG làm tròn (số thực). */
        function computeFinalAverageScore(totalScore, circleCount) {
            if (circleCount <= 0) return 0;
            return totalScore / circleCount;
        }
