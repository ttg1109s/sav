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
         * tempo đó, nhân `difficultyMultiplier` (Easy chậm hơn, Hard gốc), clamp trong
         * [minShrinkDurationMs, maxShrinkDurationMs] SAU KHI nhân. BPM không hợp lệ -> fallback cố
         * định, CŨNG bị nhân multiplier (nhất quán giữa mọi độ khó dù có/không xác định được BPM). */
        function computeShrinkDurationMs(bpmString, cfg, difficultyMultiplier) {
            const bpm = parseFloat(bpmString);
            const raw = (!Number.isFinite(bpm) || bpm <= 0) ? cfg.fallbackShrinkDurationMs : (60000 / bpm) * cfg.beatsPerWave;
            const adjusted = raw * difficultyMultiplier;
            return Math.min(cfg.maxShrinkDurationMs, Math.max(cfg.minShrinkDurationMs, adjusted));
        }

        /**
         * [MỚI — phản hồi Giang "Hard giảm quãng s mỗi wave chuỗi còn khoảng spawnEligibleEveryNBeats
         * / 2"] Khoảng cách (ms) giữa 2 wave LIÊN TIẾP trong chuỗi "sinh sản" Hard — bằng ĐÚNG NỬA
         * nhịp `spawnEligibleEveryNBeats` hiện hành, quy đổi ra THỜI GIAN THẬT (ms) từ BPM (0.5 beat
         * không biểu diễn được bằng đếm nguyên beat như isBeatEligibleForSpawn() — bắt buộc dùng ms).
         * BPM không hợp lệ -> fallback CÙNG công thức computeShrinkDurationMs() (beatPeriodMs xấp xỉ
         * = fallbackShrinkDurationMs / beatsPerWave).
         */
        function computeChainSpacingMs(bpmString, spawnEligibleEveryNBeats, cfg) {
            const bpm = parseFloat(bpmString);
            const beatPeriodMs = (!Number.isFinite(bpm) || bpm <= 0) ? (cfg.fallbackShrinkDurationMs / cfg.beatsPerWave) : (60000 / bpm);
            return (beatPeriodMs * spawnEligibleEveryNBeats) / 2;
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
         * random) — cần ít nhất `totalCells` phần tử (dùng cho bước shuffle).
         *
         * [SỬA — phản hồi Giang "1 ô chứa [note,note,...] đều có thể đúng"] Mỗi entry giờ CÓ THÊM
         * `col`/`row` (chỉ số nguyên trong lưới, KHÔNG chỉ px) — dùng cho findAvailableCell() xác
         * định ô lân cận/occupancy CHÍNH XÁC bằng chỉ số, không suy ngược từ toạ độ px (tránh sai số
         * làm tròn). Bucket pitchMin-pitchMax càng rộng (dải pitch quan sát được rộng hơn số ô lưới)
         * càng CHỨA NHIỀU note khác nhau cùng trỏ 1 ô — ĐÚNG NHƯ THIẾT KẾ, không phải lỗi. */
        function buildPitchCellMap(pitchRangeMin, pitchRangeMax, cols, rows, zoneOriginXPx, zoneOriginYPx, cfg, randomValues) {
            const totalCells = cols * rows;
            const cellCenters = [];
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    cellCenters.push({
                        col: c, row: r,
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
                col: cellCenters[i % cellCenters.length].col,
                row: cellCenters[i % cellCenters.length].row,
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

        const GAMEPLAY_NEIGHBOR_OFFSETS = Object.freeze([[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]); // 8 hướng la bàn — CHỈ dùng làm điểm xuất phát random, KHÔNG quét tuần tự

        /** Xoay 90° 1 offset (dc,dr) — CÙNG công thức ma trận xoay dùng cho rotateRubikIndices()
         * (core/rubik-math.js, hiệu ứng Rubik's Cube): dir>0 xoay 1 chiều, dir<=0 xoay chiều ngược
         * lại. Áp cho offset ô lân cận (2D) thay vì toạ độ khối lập phương (3D) — cùng nguyên lý ma
         * trận xoay 90° rời rạc. */
        function rotateNeighborOffset90(dc, dr, dir) {
            return dir > 0 ? { dc: -dr, dr: dc } : { dc: dr, dr: -dc };
        }

        /**
         * [SỬA — phản hồi Giang "dùng thuật toán xoay của rubik để chọn ô kế cận, try 2 lần, lần 2
         * false thì bỏ luôn"] Thay HẲN cách quét tuần tự 8 ô cố định + fallback ô rỗng-bucket (đã
         * xoá `listUnusedGridCells()`) — giờ CHỌN 1 hướng NGẪU NHIÊN làm điểm xuất phát
         * (`startOffsetIndex`), thử ô đó (lần 1); KHÔNG trống (hoặc ngoài biên) -> XOAY 90°
         * (rotateNeighborOffset90(), CÙNG công thức rotateRubikIndices()) ra hướng thứ 2, thử tiếp
         * (lần 2); lần 2 CŨNG không trống -> bỏ luôn (null), KHÔNG còn dò tiếp ô nào khác nữa.
         * @param {{col:number,row:number,cellX:number,cellY:number}} targetCell
         * @param {number} startOffsetIndex - 0-7, Workflow tự Math.random() rồi truyền vào
         * @param {1|-1} rotationDir - chiều xoay cho lần thử thứ 2, Workflow tự random
         * @param {Set<string>} occupiedCellKeys - `"${col},${row}"` của MỌI wave đang sống
         * @returns {{col:number,row:number,cellX:number,cellY:number}|null}
         */
        function findAvailableCell(targetCell, cols, rows, cfg, zoneOriginXPx, zoneOriginYPx, startOffsetIndex, rotationDir, occupiedCellKeys) {
            const isFree = (col, row) => !occupiedCellKeys.has(`${col},${row}`);
            if (isFree(targetCell.col, targetCell.row)) return targetCell;

            const toCellCenter = (col, row) => ({
                col, row,
                cellX: zoneOriginXPx + col * cfg.gridCellSizePx + cfg.gridCellSizePx / 2,
                cellY: zoneOriginYPx + row * cfg.gridCellSizePx + cfg.gridCellSizePx / 2,
            });
            const tryOffset = (dc, dr) => {
                const col = targetCell.col + dc, row = targetCell.row + dr;
                if (col < 0 || col >= cols || row < 0 || row >= rows) return null; // ngoài biên lưới -> tính là 1 LẦN THỬ HỎNG (vẫn trừ vào quota 2 lần)
                return isFree(col, row) ? toCellCenter(col, row) : null;
            };

            const [dc1, dr1] = GAMEPLAY_NEIGHBOR_OFFSETS[startOffsetIndex % GAMEPLAY_NEIGHBOR_OFFSETS.length];
            const try1 = tryOffset(dc1, dr1);
            if (try1) return try1;

            const rotated = rotateNeighborOffset90(dc1, dr1, rotationDir);
            const try2 = tryOffset(rotated.dc, rotated.dr);
            if (try2) return try2;

            return null; // 2 lần thử đều không trống (hoặc ngoài biên) -> bỏ luôn
        }

        /** Trần số wave cùng lúc — cfg có khoảng (`minConcurrentWaves`/`maxConcurrentWaves` khác
         * nhau, vd Medium 2-5) thì ROLL NGẪU NHIÊN trong khoảng đó MỖI LẦN gọi (mật độ dao động
         * thay vì cố định 1 số) — cfg chỉ có 1 số cố định (Easy=1, Hard=Infinity, hoặc
         * min===max) thì trả thẳng `maxConcurrentWaves`. `random01` PHẢI do Workflow tự
         * Math.random() rồi truyền vào (Core không tự random). */
        function computeConcurrentWaveCap(diffCfg, random01) {
            const hasRange = diffCfg.minConcurrentWaves != null && diffCfg.minConcurrentWaves !== diffCfg.maxConcurrentWaves;
            if (!hasRange) return diffCfg.maxConcurrentWaves;
            const span = diffCfg.maxConcurrentWaves - diffCfg.minConcurrentWaves + 1;
            return diffCfg.minConcurrentWaves + Math.floor(random01 * span);
        }

        /**
         * [MỚI — phản hồi Giang, cơ chế "sinh sản" riêng Hard] Chuỗi pitch cho 1 sự kiện spawn cấp
         * `chainLevel` (2..8) — phần tử 0 LUÔN là `basePitch` (note gốc thật, không đổi); phần tử i
         * (i>=1) = phần tử (i-1) + (i+1) bán cung ("quãng (i+1)": quãng 2 cho bản sao đầu, quãng 3
         * cho bản sao kế TÍNH TỪ bản sao trước đó — KHÔNG phải từ gốc — đúng chuỗi Giang mô tả).
         * Clamp mỗi bước vào [pitchMin, pitchMax] (dải pitch quan sát được) — tránh note vọt ra
         * ngoài dải, không map được ô nào.
         * @param {number} chainLevel - 1 = không sinh sản (chỉ [basePitch]), 2..8 = số phần tử trả về
         * @returns {number[]} length === chainLevel (hoặc 1 nếu chainLevel<=1)
         */
        function computeChainedPitches(basePitch, chainLevel, pitchMin, pitchMax) {
            const pitches = [basePitch];
            let current = basePitch;
            for (let i = 1; i < chainLevel; i++) {
                current = current + (i + 1); // "quãng (i+1)" TÍNH TỪ phần tử vừa thêm, không phải từ gốc
                current = Math.min(pitchMax, Math.max(pitchMin, current));
                pitches.push(current);
            }
            return pitches;
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

        // [SỬA — phản hồi Giang] isPositionTooClose() ĐÃ XOÁ (đo khoảng cách px, có thể lọt nếu
        // jitter xui rơi xa nhau ngay trong CÙNG 1 ô — xem thảo luận) — thay HẲN bằng
        // findAvailableCell() ở trên (occupancy chính xác theo chỉ số ô col/row).

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

