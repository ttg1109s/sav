/**
 * core/gameplay/circle-mode.js — Core THUẦN cho Game Mode "Circle" (mode 1). Mỗi hàm ĐÚNG 1 việc
 * (Rule 1), CHỈ nhận tham số — KHÔNG tự appState.get() (Rule 2), KHÔNG gọi hàm core nào khác kể cả
 * trong chính file này (Rule 3a) — nơi cần phối hợp nhiều hàm (vd tính radius rồi mới classify tier)
 * là event/workflow/gameplay.js, KHÔNG phải ở đây.
 *
 * SỬA LẦN 3 (16/08/2026, phản hồi Giang — fade sai chỗ + vị trí thiên lệch) trên nền SỬA LẦN 2 (đọc
 * lại plan §9 "Chọn cách sinh note theo audio"):
 *   - Beat quyết định "khi nào" -> `shouldSpawnCircleWave()` khoá `lastBeatTime` thật (global,
 *     core/dom-refs.js, KHÔNG thuộc appState) — khác mốc đã tiêu thụ = vừa có beat mới.
 *   - Energy quyết định "bao nhiêu" -> `computeSpawnProbability()`: mỗi khi có beat mới, KHÔNG
 *     chắc chắn spawn — xác suất tăng theo `smoothedEnergy` hiện tại (nhạc êm -> note thưa, nhạc
 *     mạnh -> note dày). Workflow tự Math.random() rồi so với xác suất này (Core không tự random).
 *   - Pitch quyết định "ở đâu" -> `computeSpawnPositionY()`: map TUYỆT ĐỐI `lastValidMidiNote` vào
 *     DẢI THÍCH ỨNG quan sát được TRONG CHÍNH phiên chơi (appState `gameplayPitchRangeMin/Max`,
 *     tự nới theo `computePitchRangeUpdate()`) -> [yMaxPercent, yMinPercent] — KHÔNG so lệch với 1
 *     mốc trung bình động (khác cách core/visualizer/types/rubik.js đang làm cho Rubik effect) —
 *     Giang chốt "mỗi bài khác nhau là đúng, vẫn dùng pitch" NHƯNG dải cố định 36-96 gây thiên lệch
 *     (đa số bài chỉ dùng 1 phần nhỏ dải rộng đó) -> SỬA sang dải thích ứng, vừa giữ đúng "mỗi bài
 *     khác nhau" (mỗi bài tự nới dải riêng theo âm vực THẬT của nó) vừa trải đều hơn khắp màn hình.
 *   - Vị trí X: plan KHÔNG gán nguồn audio nào -> `computeSpawnPositionX()` ngẫu nhiên trong
 *     spawnZone (Workflow truyền vào 1 số random 0-1, Core chỉ nội suy — xem lý do tương tự
 *     spawnProbability, giữ Core deterministic/dễ test).
 *   - `shrinkDurationMs`: plan không gán rõ nguồn — quyết định riêng (mở rộng nhóm Beat): theo BPM
 *     hiện tại, xem `computeShrinkDurationMs()`.
 *   - `startRadius` (waveStartRadius): plan không gán nguồn nào -> GIỮ CỐ ĐỊNH (GAMEPLAY_CIRCLE_
 *     CONFIG.waveStartRadius, cùng nhóm độ khó/thị giác với centerRadius/gap).
 *   - `computeWaveOpacity()`: fade CHỈ xảy ra ở đoạn CUỐI hành trình (lúc wave sắp thu vào vòng
 *     tròn tâm) — xem docstring ngay tại hàm đó, đúng ý Giang "wave fade = chỗ thu vào vòng giữa".
 *
 * Mỗi note giờ là 1 CẶP circle (mục tiêu, vị trí x/y cố định) + wave (co từ startRadius về 0 tại
 * ĐÚNG x/y đó) — KHÔNG còn 1 vòng tròn tâm tĩnh dùng chung cho mọi wave (xem docstring service/
 * state/gameplay-runtime.js). Tap phải TRÚNG VỊ TRÍ (x,y) của note đó (event/workflow/gameplay.js::
 * handleTap(), dùng findNearestNoteByPosition() bên dưới), KHÔNG còn tính theo "wave gần biên nhất"
 * bất kể ở đâu trên màn hình như bản đầu.
 *
 * Vùng hợp lệ TÍNH ĐIỂM (khác vùng hợp lệ VỊ TRÍ ở trên) = dải `gap` px quanh biên `centerRadius`
 * (bán kính vòng tròn tâm, CỐ ĐỊNH). Tap càng gần biên (radius ~= centerRadius) càng được điểm cao.
 */

        /** Guard: có nên XÉT spawn 1 wave mới lúc này không — chưa đạt max wave cùng lúc, VÀ vừa
         * có 1 beat THẬT MỚI (khác mốc đã tiêu thụ lần trước, > 0 — audio-analysis.js chưa từng
         * detect beat nào thì lastBeatTime vẫn là 0, giá trị khởi tạo ở core/dom-refs.js). Đây CHỈ
         * là điều kiện CẦN — Workflow còn phải roll xác suất qua computeSpawnProbability() nữa mới
         * quyết định spawn THẬT (xem event/workflow/gameplay.js::tick()). */
        function shouldSpawnCircleWave(activeWaveCount, lastConsumedBeatTime, currentBeatTime, cfg) {
            if (activeWaveCount >= cfg.maxConcurrentWaves) return false;
            return currentBeatTime > 0 && currentBeatTime !== lastConsumedBeatTime;
        }

        /** Xác suất THẬT SỰ spawn 1 wave khi đủ điều kiện cần (shouldSpawnCircleWave() = true) —
         * nội suy tuyến tính giữa spawnProbabilityMin (energy=0) và spawnProbabilityMax (energy=1)
         * theo `smoothedEnergy` HIỆN TẠI. Workflow tự roll Math.random() so với số trả về đây. */
        function computeSpawnProbability(smoothedEnergy, cfg) {
            const energy = Math.min(1, Math.max(0, smoothedEnergy));
            return cfg.spawnProbabilityMin + energy * (cfg.spawnProbabilityMax - cfg.spawnProbabilityMin);
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

        /** Vị trí Y (%) — map TUYỆT ĐỐI `midiNote` hiện tại vào DẢI THÍCH ỨNG (SỬA 16/08/2026,
         * Giang chỉ ra dải cố định 36-96 gây "thiên lệch" — đa số bài chỉ dùng 1 phần nhỏ dải rộng
         * đó nên vị trí dồn cục 1 vùng màn hình) — `rangeMin`/`rangeMax` là nốt THẤP NHẤT/CAO NHẤT
         * ĐÃ QUAN SÁT ĐƯỢC trong CHÍNH phiên chơi này (appState `gameplayPitchRangeMin/Max`, tự nới
         * dần theo computePitchRangeUpdate() bên dưới) — KHÔNG phải 1 mốc trung bình động (KHÁC hẳn
         * cách core/visualizer/types/rubik.js làm cho Rubik effect) — vẫn giữ đúng yêu cầu "mỗi bài
         * khác nhau là đúng, vẫn dùng pitch" (mỗi bài tự nới ra 1 dải riêng theo âm vực THẬT của
         * chính nó, KHÔNG chuẩn hoá chung 1 công thức tĩnh cho mọi bài), nhưng dải đó LUÔN VỪA KHỚP
         * nội dung đang phát -> tự nhiên trải đều hơn khắp `spawnZone`, không còn dồn cục.
         * `rangeMin`/`rangeMax` null (chưa detect được nốt nào) HOẶC dải quá hẹp (< pitchMinSpan
         * Semitones — mới vào bài, chỉ có 1-2 nốt gần nhau) -> fallback về GIỮA spawnZone. */
        function computeSpawnPositionY(midiNote, rangeMin, rangeMax, cfg) {
            const zone = cfg.spawnZone;
            const mid = (zone.yMinPercent + zone.yMaxPercent) / 2;
            if (midiNote == null || rangeMin == null || rangeMax == null) return mid;
            const span = rangeMax - rangeMin;
            if (span < cfg.pitchMinSpanSemitones) return mid;
            const clampedMidi = Math.min(rangeMax, Math.max(rangeMin, midiNote));
            const ratio = (clampedMidi - rangeMin) / span; // 0 (thấp nhất ĐÃ THẤY) -> 1 (cao nhất ĐÃ THẤY)
            return zone.yMaxPercent - ratio * (zone.yMaxPercent - zone.yMinPercent); // ratio cao -> Y nhỏ (cao trên màn hình)
        }

        /** Cập nhật dải pitch quan sát được (min/max) — value thuần, KHÔNG tự appState.set() (Rule
         * 2, Workflow tự ghi sau khi gọi). `midiNote` null (chưa detect được) -> giữ nguyên dải cũ. */
        function computePitchRangeUpdate(midiNote, currentMin, currentMax) {
            if (midiNote == null) return { min: currentMin, max: currentMax };
            const newMin = currentMin == null ? midiNote : Math.min(currentMin, midiNote);
            const newMax = currentMax == null ? midiNote : Math.max(currentMax, midiNote);
            return { min: newMin, max: newMax };
        }

        /** Vị trí X (%) — ngẫu nhiên trong spawnZone (plan không gán nguồn audio nào cho trục X).
         * `randomRoll01` PHẢI do Workflow tự Math.random() rồi truyền vào (Core không tự random —
         * giữ hàm deterministic/dễ test, xem docstring đầu file). */
        function computeSpawnPositionX(randomRoll01, cfg) {
            const zone = cfg.spawnZone;
            return zone.xMinPercent + randomRoll01 * (zone.xMaxPercent - zone.xMinPercent);
        }

        /** Tạo 1 wave (note) mới — value thuần, chưa ghi vào đâu cả (Workflow tự appState.mutate()
         * push). `startRadius`/`shrinkDurationMs`/`x`/`y` PHẢI đã được tính sẵn (các hàm compute*
         * ở trên) rồi truyền vào — hàm này KHÔNG tự tính, chỉ đóng gói. */
        function createCircleWave(id, spawnedAt, startRadius, shrinkDurationMs, x, y) {
            return { id, spawnedAt, startRadius, shrinkDurationMs, x, y };
        }

        /** Bán kính HIỆN TẠI của 1 wave tại thời điểm `now` — co tuyến tính từ startRadius về 0
         * trong đúng `wave.shrinkDurationMs` CỦA RIÊNG wave đó (lưu lúc spawn, xem createCircleWave()),
         * clamp không âm. */
        function computeWaveRadius(wave, now) {
            const elapsed = now - wave.spawnedAt;
            const ratio = Math.min(1, Math.max(0, elapsed / wave.shrinkDurationMs));
            return wave.startRadius * (1 - ratio);
        }

        /** Độ mờ (opacity, 0-1) HIỆN TẠI của 1 wave — hiệu ứng "wave fade" ĐÚNG NGHĨA (SỬA lần 2,
         * 16/08/2026, Giang chỉ rõ: "đó là vòng tròn thứ hai thu vào vòng tròn giữa — đấy mới là
         * chỗ cần wave fade") — KHÔNG mờ dần đều suốt hành trình như bản đầu (gây cảm giác wave
         * "biến mất" quá sớm dù vẫn đang sống) — giữ NGUYÊN opacity=1 suốt `fadeStartRatio` đầu
         * hành trình, CHỈ mờ dần tuyến tính về 0 ở đoạn CUỐI (lúc wave sắp co hết vào vòng tròn
         * tâm — ĐÚNG đoạn "thu vào" Giang mô tả). */
        function computeWaveOpacity(wave, now) {
            const elapsed = now - wave.spawnedAt;
            const ratio = Math.min(1, Math.max(0, elapsed / wave.shrinkDurationMs));
            const fadeStartRatio = 0.7;
            if (ratio <= fadeStartRatio) return 1;
            const fadeProgress = (ratio - fadeStartRatio) / (1 - fadeStartRatio);
            return 1 - fadeProgress;
        }

        /** Wave đã co vượt quá mép TRONG của vùng hợp lệ (bấm trễ, không còn cơ hội) -> coi là miss,
         * PHẢI bị dọn khỏi danh sách wave đang sống dù không ai bấm tới. */
        function isWaveMissed(radius, centerRadius, gap) {
            return radius < (centerRadius - gap);
        }

        /**
         * Tìm note GẦN VỊ TRÍ TAP NHẤT trong 1 danh sách {id, x, y, ...} ĐÃ TÍNH SẴN vị trí hiện tại
         * (Workflow tự chuẩn bị mảng này). Chỉ tính các note trong bán kính `tolerancePercent` quanh
         * điểm tap — ngoài dung sai này coi như KHÔNG trúng note nào (trả null), KHÁC bản đầu (tính
         * theo "gần biên centerRadius nhất" bất kể vị trí — SAI từ khi mỗi note có 1 vị trí riêng).
         * @param {{id:*,x:number,y:number}[]} entries
         */
        function findNearestNoteByPosition(entries, tapX, tapY, tolerancePercent) {
            let best = null, bestDist = Infinity;
            for (const entry of entries) {
                const dx = entry.x - tapX, dy = entry.y - tapY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= tolerancePercent && dist < bestDist) { bestDist = dist; best = entry; }
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
