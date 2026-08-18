/**
 * core/gameplay/circle-mode.js — Core THUẦN cho Game Mode "Circle" (mode 1). Mỗi hàm ĐÚNG 1 việc
 * (Rule 1), CHỈ nhận tham số — KHÔNG tự appState.get() (Rule 2), KHÔNG gọi core nào khác kể cả
 * trong chính file này (Rule 3a). Nơi cần phối hợp nhiều hàm (vd tính radius rồi mới classify tier,
 * hay chọn hàm màu theo effect mode) là event/workflow/gameplay.js, KHÔNG phải ở đây.
 *
 * Mỗi note là 1 CẶP circle (đích, vị trí x/y px thật trong canvas) + wave (co từ waveStartRadius về
 * 0 tại đúng x/y đó). Vùng hợp lệ TÍNH ĐIỂM lệch tâm (khác vùng hợp lệ VỊ TRÍ tap, xem
 * findNearestNoteByPosition()) — bán kính trong [centerRadius-gapInner, centerRadius+gapOuter],
 * càng gần centerRadius điểm càng cao, 2 phía chuẩn hoá riêng vì độ rộng gapOuter/gapInner khác nhau.
 */

        // ── Spawn timing/mật độ ──────────────────────────────────────────────────────────────

        /** Guard: có nên XÉT spawn 1 wave mới lúc này không — chưa đạt max wave cùng lúc (theo độ
         * khó hiện hành, Workflow tự resolve đúng số), VÀ vừa có 1 beat THẬT MỚI (khác mốc đã tiêu
         * thụ lần trước). Đây CHỈ là điều kiện CẦN — Workflow còn roll xác suất qua
         * computeSpawnProbability() + xét thêm isBeatEligibleForSpawn() (độ khó Medium) mới quyết
         * định spawn THẬT. */
        function shouldSpawnCircleWave(activeWaveCount, maxConcurrentWaves, lastConsumedBeatTime, currentBeatTime) {
            if (activeWaveCount >= maxConcurrentWaves) return false;
            return currentBeatTime > 0 && currentBeatTime !== lastConsumedBeatTime;
        }

        /** Độ khó Medium chỉ xét spawn mỗi N beat (Easy/Hard N=1, không lọc gì thêm ở đây — Workflow
         * tự truyền N đúng theo độ khó). Workflow tự đếm `beatsSinceEligible`, reset về 0 khi hàm này
         * trả true. */
        function isBeatEligibleForSpawn(beatsSinceEligible, spawnEligibleEveryNBeats) {
            return beatsSinceEligible >= spawnEligibleEveryNBeats;
        }

        /** Xác suất spawn thật khi đủ điều kiện cần — nội suy tuyến tính theo smoothedEnergy hiện
         * tại. Workflow tự roll Math.random() so với số trả về đây (Core không tự random). */
        function computeSpawnProbability(smoothedEnergy, cfg) {
            const energy = Math.min(1, Math.max(0, smoothedEnergy));
            return cfg.spawnProbabilityMin + energy * (cfg.spawnProbabilityMax - cfg.spawnProbabilityMin);
        }

        /** Quy đổi BPM hiện tại thành thời gian co (ms) cho 1 wave = đúng beatsPerWave nhịp theo
         * tempo đó, clamp trong [minShrinkDurationMs, maxShrinkDurationMs]. BPM không hợp lệ ->
         * fallback cố định. */
        function computeShrinkDurationMs(bpmString, cfg) {
            const bpm = parseFloat(bpmString);
            if (!Number.isFinite(bpm) || bpm <= 0) return cfg.fallbackShrinkDurationMs;
            const raw = (60000 / bpm) * cfg.beatsPerWave;
            return Math.min(cfg.maxShrinkDurationMs, Math.max(cfg.minShrinkDurationMs, raw));
        }

        // ── Vị trí spawn: lưới pitch→ô ────────────────────────────────────────────────────────

        /** Số cột/hàng lưới thật (px) khớp vùng spawnZone hiện tại của canvas — tính lại mỗi khi
         * resize HOẶC mỗi lần refresh bảng gán (xem gameplayRefreshPending). */
        function computeGridGeometry(zoneWidthPx, zoneHeightPx, cellSizePx) {
            const cols = Math.max(1, Math.floor(zoneWidthPx / cellSizePx));
            const rows = Math.max(1, Math.floor(zoneHeightPx / cellSizePx));
            return { cols, rows, totalCells: cols * rows };
        }

        /** Chia dải pitch quan sát được thành các nhóm liên tiếp kích thước
         * floor(pitchSpan/totalCells) (chấp nhận nhóm cuối lẻ), gán ngẫu nhiên (shuffle) mỗi nhóm
         * vào 1 ô lưới; ô dư (totalCells > số nhóm) lấp bằng cách gán lại 1 nhóm đã có (random). Dải
         * chưa đủ rộng (< pitchMinSpanSemitones) hoặc chưa detect nốt nào -> trả mảng rỗng (Workflow
         * tự fallback về giữa spawnZone khi map rỗng). `randomValues` PHẢI do Workflow tự sinh sẵn
         * (Core không tự random) — cần ít nhất `totalCells` phần tử. */
        function buildPitchCellMap(pitchRangeMin, pitchRangeMax, cols, rows, zoneOriginXPx, zoneOriginYPx, cfg, randomValues) {
            const totalCells = cols * rows;
            const cellCenters = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    cellCenters.push({
                        cellX: zoneOriginXPx + c * cfg.gridCellSizePx + cfg.gridCellSizePx / 2,
                        cellY: zoneOriginYPx + r * cfg.gridCellSizePx + cfg.gridCellSizePx / 2,
                    });
                }
            }
            let rvIndex = 0;
            for (let i = cellCenters.length - 1; i > 0; i--) {
                const j = Math.floor(randomValues[rvIndex++ % randomValues.length] * (i + 1));
                const tmp = cellCenters[i]; cellCenters[i] = cellCenters[j]; cellCenters[j] = tmp;
            }

            if (pitchRangeMin == null || pitchRangeMax == null || (pitchRangeMax - pitchRangeMin) < cfg.pitchMinSpanSemitones) {
                return [];
            }

            const pitchSpan = pitchRangeMax - pitchRangeMin + 1;
            const pitchesPerCell = Math.max(1, Math.floor(pitchSpan / totalCells));
            const buckets = [];
            let cursor = pitchRangeMin;
            while (cursor <= pitchRangeMax) {
                const bucketMax = Math.min(pitchRangeMax, cursor + pitchesPerCell - 1);
                buckets.push({ pitchMin: cursor, pitchMax: bucketMax });
                cursor = bucketMax + 1;
            }

            const map = buckets.map((bucket, i) => ({
                pitchMin: bucket.pitchMin,
                pitchMax: bucket.pitchMax,
                cellX: cellCenters[i % cellCenters.length].cellX,
                cellY: cellCenters[i % cellCenters.length].cellY,
            }));
            for (let i = buckets.length; i < cellCenters.length; i++) {
                const pick = buckets[Math.floor(randomValues[rvIndex++ % randomValues.length] * buckets.length)];
                map.push({ pitchMin: pick.pitchMin, pitchMax: pick.pitchMax, cellX: cellCenters[i].cellX, cellY: cellCenters[i].cellY });
            }
            return map;
        }

        /** Tìm ô đã gán cho 1 pitch trong bảng map hiện hành — null nếu map rỗng hoặc pitch chưa
         * detect. */
        function findCellForPitch(pitchCellMap, midiNote) {
            if (midiNote == null) return null;
            for (const entry of pitchCellMap) {
                if (midiNote >= entry.pitchMin && midiNote <= entry.pitchMax) return entry;
            }
            return null;
        }

        /** Lệch tâm ngẫu nhiên trong ô, giới hạn (gridCellSizePx - cellJitterMarginPx) quanh tâm ô.
         * `randomX01`/`randomY01` PHẢI do Workflow tự Math.random() rồi truyền vào. */
        function applyCellJitter(cellX, cellY, cfg, randomX01, randomY01) {
            const usable = cfg.gridCellSizePx - cfg.cellJitterMarginPx;
            return { x: cellX + (randomX01 - 0.5) * usable, y: cellY + (randomY01 - 0.5) * usable };
        }

        /** true nếu (x,y) quá gần 1 vị trí đang sống trong activePositions (< minSpawnDistancePx) —
         * Workflow gọi TRƯỚC khi chấp nhận spawn, bỏ lượt (chờ beat kế) nếu true — chặn đè hình dù
         * lưới đã tách theo pitch (ô liền kề vẫn có thể đè, cùng pitch lặp lại càng chắc chắn đè). */
        function isPositionTooClose(x, y, activePositions, minSpawnDistancePx) {
            for (const pos of activePositions) {
                const dx = pos.x - x, dy = pos.y - y;
                if (Math.sqrt(dx * dx + dy * dy) < minSpawnDistancePx) return true;
            }
            return false;
        }

        /** Cập nhật dải pitch quan sát được (min/max) — `midiNote` null (chưa detect) giữ nguyên
         * dải cũ. */
        function computePitchRangeUpdate(midiNote, currentMin, currentMax) {
            if (midiNote == null) return { min: currentMin, max: currentMax };
            const newMin = currentMin == null ? midiNote : Math.min(currentMin, midiNote);
            const newMax = currentMax == null ? midiNote : Math.max(currentMax, midiNote);
            return { min: newMin, max: newMax };
        }

        // ── Trigger refresh vị trí (section/energy/phrase) ───────────────────────────────────

        /** So sánh trung bình `windowSize` giá trị flux gần nhất với `windowSize` giá trị TRƯỚC đó
         * trong fluxHistory — lệch >= threshold coi là 1 "transition". Cùng 1 hàm dùng cho cả energy
         * (threshold thấp) lẫn section (threshold cao) — Workflow tự truyền đúng threshold theo độ
         * khó (GAMEPLAY_CIRCLE_CONFIG.difficulty[x].fluxDelta*). Chưa đủ lịch sử (< 2×windowSize) ->
         * false. */
        function detectFluxTransition(fluxHistory, windowSize, threshold) {
            if (fluxHistory.length < windowSize * 2) return false;
            const recent = fluxHistory.slice(-windowSize);
            const prior = fluxHistory.slice(-windowSize * 2, -windowSize);
            const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
            return Math.abs(avg(recent) - avg(prior)) >= threshold;
        }

        /** Xấp xỉ ranh giới phrase bằng đếm beat cố định (không có phrase detection thật). Workflow
         * tự đếm `beatsSincePhraseRefresh`, reset về 0 khi hàm này trả true. */
        function isPhraseBoundary(beatsSincePhraseRefresh, refreshBeatsForPhrase) {
            return beatsSincePhraseRefresh >= refreshBeatsForPhrase;
        }

        // ── Vật lý wave: bán kính / opacity / ngưỡng miss ────────────────────────────────────

        /** Bán kính hiện tại của 1 wave — co tuyến tính từ startRadius về 0 trong đúng
         * wave.shrinkDurationMs của riêng wave đó, clamp không âm. */
        function computeWaveRadius(wave, now) {
            const elapsed = now - wave.spawnedAt;
            const ratio = Math.min(1, Math.max(0, elapsed / wave.shrinkDurationMs));
            return wave.startRadius * (1 - ratio);
        }

        /** Opacity theo BÁN KÍNH hiện tại (không theo thời gian) — cố định opacityBase ngoài vùng
         * gap, nội suy tuyến tính lên opacityAtInnerEdge khi đi vào [centerRadius-gapInner,
         * centerRadius+gapOuter], đạt đỉnh đúng lúc chạm biên trong. */
        function computeWaveOpacity(radius, cfg) {
            const outerEdge = cfg.centerRadius + cfg.gapOuter;
            if (radius > outerEdge) return cfg.opacityBase;
            const innerEdge = cfg.centerRadius - cfg.gapInner;
            const clamped = Math.max(innerEdge, radius);
            const progress = (outerEdge - clamped) / (outerEdge - innerEdge);
            return cfg.opacityBase + progress * (cfg.opacityAtInnerEdge - cfg.opacityBase);
        }

        /** Wave đã co vượt quá biên TRONG vùng hợp lệ (bấm trễ, không còn cơ hội) -> miss, PHẢI bị
         * dọn khỏi danh sách wave đang sống dù không ai bấm tới. */
        function isWaveMissed(radius, cfg) {
            return radius < (cfg.centerRadius - cfg.gapInner);
        }

        // ── Chấm điểm tap ─────────────────────────────────────────────────────────────────────

        /** Tìm note GẦN VỊ TRÍ TAP NHẤT trong 1 danh sách {id, x, y} đã tính sẵn vị trí hiện tại.
         * Chỉ tính note trong bán kính `tolerancePercent` quanh điểm tap — ngoài dung sai coi như
         * không trúng note nào (null). */
        function findNearestNoteByPosition(entries, tapX, tapY, tolerancePercent) {
            let best = null, bestDist = Infinity;
            for (const entry of entries) {
                const dx = entry.x - tapX, dy = entry.y - tapY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist <= tolerancePercent && dist < bestDist) { bestDist = dist; best = entry; }
            }
            return best;
        }

        /** Xếp tier theo khoảng cách CHUẨN HOÁ tới centerRadius — 2 phía dùng mẫu số khác nhau
         * (gapOuter cho bấm sớm/radius lớn hơn, gapInner cho bấm trễ/radius nhỏ hơn) vì độ rộng
         * vùng hợp lệ 2 phía không bằng nhau. Trả {name, score} hoặc null nếu ngoài vùng hợp lệ. */
        function classifyTapTier(radius, cfg) {
            const diff = radius - cfg.centerRadius;
            const ratio = diff >= 0 ? diff / cfg.gapOuter : -diff / cfg.gapInner;
            if (ratio > 1) return null;
            for (const tier of cfg.tiers) {
                if (ratio <= tier.maxRatio) return { name: tier.name, score: tier.score };
            }
            return null;
        }

        /** Điểm THẬT SỰ cộng vào tổng cho 1 lần tap, kèm combo streak MỚI. Chỉ tier trong
         * comboTierNames mới cộng dồn streak + nhân multiplier bậc thang (streak SAU khi cộng); mọi
         * tier khác (kể cả tap hợp lệ nhưng thấp) làm gãy combo về 0, không nhân. */
        function computeComboScoreGain(tierName, tierScore, comboStreakBefore, cfg) {
            const continuesCombo = cfg.comboTierNames.includes(tierName);
            if (!continuesCombo) return { pointsGained: tierScore, newComboStreak: 0 };
            const newComboStreak = comboStreakBefore + 1;
            const multiplier = 1 + Math.floor(newComboStreak / cfg.comboMultiplierStepSize) * cfg.comboMultiplierStepValue;
            return { pointsGained: Math.floor(tierScore * multiplier), newComboStreak };
        }

        // ── Màu vòng tròn (theo effect đang chạy, chốt lúc spawn) ────────────────────────────

        /** Mode `dynamic` — luân phiên nguyên bản A/B theo thứ tự spawn (không blend, không đổi
         * theo audio). */
        function computeCircleColorDynamic(dynA, dynB, spawnIndex) {
            return spawnIndex % 2 === 0 ? dynA : dynB;
        }

        /** Mode `gradient` — 1 hue duy nhất lấy từ hueOffset TẠI lúc spawn (Workflow đọc
         * globalHueOffset ngay lúc gọi), không dựng gradient nhiều màu trong 1 vòng tròn. */
        function computeCircleColorGradientMain(hueOffset) {
            const hue = ((hueOffset % 360) + 360) % 360;
            return `hsl(${hue}, 70%, 55%)`;
        }

        /** Màu vòng ngoài (nhạt hơn, KHÔNG dùng opacity) cho mode `gradient` — cùng hue, tăng
         * lightness/giảm saturation trực tiếp. Mode solid/dynamic dùng
         * core/color-utils.js::interpolateColor(main, '#ffffff', factor) có sẵn — Workflow tự gọi,
         * không cần hàm riêng ở đây (Core cấm gọi Core khác). */
        function computeCircleColorGradientLight(hueOffset) {
            const hue = ((hueOffset % 360) + 360) % 360;
            return `hsl(${hue}, 50%, 80%)`;
        }

        // ── Tổng kết điểm cuối phiên ──────────────────────────────────────────────────────────

        /** Điểm trung bình cuối phiên = tổng điểm / số vòng đã xuất hiện — KHÔNG làm tròn. */
        function computeFinalAverageScore(totalScore, circleCount) {
            if (circleCount <= 0) return 0;
            return totalScore / circleCount;
        }

        /** Số sao (0..starMax) từ tổng điểm thật so với điểm lý thuyết tối đa (circleCount × điểm
         * tier perfect) — làm tròn theo threshold (phần thập phân >= threshold mới làm tròn lên),
         * clamp về [0, starMax] kể cả khi totalScore vượt maxScore (combo bonus). */
        function computeStarRating(totalScore, maxScore, cfg) {
            if (maxScore <= 0) return 0;
            const raw = Math.max(0, (totalScore / maxScore) * cfg.starMax);
            const frac = raw % 1;
            const rounded = frac >= cfg.starRoundingThreshold ? Math.ceil(raw) : Math.floor(raw);
            return Math.min(cfg.starMax, rounded);
        }

        /** % lệch điểm thực tế so với điểm lý thuyết tối đa — dấu +/- theo đúng chiều (Workflow tự
         * format chuỗi hiển thị, 0 không kèm dấu). */
        function computeScoreDeltaPercent(totalScore, maxScore) {
            if (maxScore <= 0) return 0;
            return ((totalScore - maxScore) / maxScore) * 100;
        }

        // ── Config Game Mode persistent (bật/tắt) ────────────────────────────────────────────

        /** Ghi cấu hình bật/tắt Game Mode PERSISTENT (khác gameplayPhase — đó là 1 phiên, đây là
         * tuỳ chọn lưu qua reload). Không tự gọi saveConfig() (Rule 3a) — Workflow tự gọi ngay sau,
         * xem event/workflow/gameplay.js::setModeEnabled(). */
        function setGameplayModeEnabled(checked) {
            appConfigViz.mutateAll(cfg => { cfg.gameplayModeEnabled = checked; });
            console.log(`writer: "setGameplayModeEnabled", page: "gameplayModeEnabled", content: "${checked}"`);
        }
