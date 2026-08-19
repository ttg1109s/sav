/**
 * core/gameplay/circle-mode.js — Core thuần RIÊNG cho mode "Circle": spawn theo lưới pitch→ô, vật
 * lý wave (bán kính/opacity/miss), màu vòng. Chấm điểm/hit-test/tổng kết/flux dùng CHUNG mọi mode
 * đã tách sang core/gameplay/engine.js. Rule 1-3: mỗi hàm 1 việc, chỉ nhận tham số, không gọi hàm
 * khác trong cùng file — phối hợp nhiều hàm là việc của event/workflow/gameplay.js.
 *
 * Mỗi note là 1 CẶP circle (đích, x/y px thật) + wave (co từ waveStartRadius về 0 tại đúng x/y đó).
 * Vùng hợp lệ TÍNH ĐIỂM (classifyTapTier(), engine.js) khác vùng hợp lệ VỊ TRÍ tap
 * (findNearestNoteByPosition(), engine.js).
 */

        // ── Spawn timing/mật độ ──────────────────────────────────────────────────────────────

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

        /** Chia dải pitch quan sát được thành các nhóm liên tiếp — SỐ NHÓM tối đa = totalCells (bucket
         * CUỐI hấp thụ hết phần dư nếu chia không hết, chấp nhận lệch size). Mỗi nhóm gán ngẫu nhiên
         * (shuffle) vào 1 ô lưới; ô dư (totalCells > số nhóm, dải pitch hẹp hơn lưới) để RỖNG — không
         * gán trùng nhóm nào lên đó (tránh 1 pitch trỏ nhiều ô không liên quan) — ô nào trống cũng đã
         * tự phân bố ngẫu nhiên nhờ cellCenters shuffle TRƯỚC khi biết số nhóm. Dải chưa đủ rộng
         * (< pitchMinSpanSemitones) hoặc chưa detect nốt nào -> trả mảng rỗng (Workflow tự fallback
         * về giữa spawnZone khi map rỗng). `randomValues` PHẢI do Workflow tự sinh sẵn (Core không tự
         * random) — cần ít nhất `totalCells` phần tử (dùng cho bước shuffle). */
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
            const bucketCount = Math.min(totalCells, pitchSpan); // không thể có nhiều bucket hơn số nốt thật quan sát được
            const pitchesPerCell = Math.max(1, Math.floor(pitchSpan / bucketCount));
            const buckets = [];
            let cursor = pitchRangeMin;
            for (let i = 0; i < bucketCount; i++) {
                const isLast = i === bucketCount - 1;
                // Bucket CUỐI hấp thụ hết phần dư (chấp nhận lệch size so với các bucket khác) —
                // KHÔNG tạo thêm bucket mới ngoài đúng bucketCount, tránh 1 ô bị 2 dải pitch không
                // liên quan cùng trỏ tới (do vòng lại i % cellCenters.length).
                const bucketMax = isLast ? pitchRangeMax : Math.min(pitchRangeMax, cursor + pitchesPerCell - 1);
                buckets.push({ pitchMin: cursor, pitchMax: bucketMax });
                cursor = bucketMax + 1;
            }

            const map = buckets.map((bucket, i) => ({
                pitchMin: bucket.pitchMin,
                pitchMax: bucket.pitchMax,
                cellX: cellCenters[i % cellCenters.length].cellX,
                cellY: cellCenters[i % cellCenters.length].cellY,
            }));
            // Ô dư (totalCells > số bucket) — KHÔNG lấp đầy bằng cách gán trùng bucket đã có (từng
            // làm 1 pitch trỏ vào 2 ô, đã bỏ). Cứ để RỖNG — cellCenters đã shuffle trước khi biết số
            // bucket (đoạn Fisher-Yates phía trên), nên chính bucket nào rơi vào cellCenters[0..N-1]
            // và ô nào bị bỏ trống (cellCenters[N..cuối]) đã tự phân bố ngẫu nhiên rồi, không cần
            // random gì thêm ở đây.
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

