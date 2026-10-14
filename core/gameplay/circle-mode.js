/**
 * core/gameplay/circle-mode.js — core thuần riêng mode "Circle": nhịp spawn theo beat, lưới pitch→ô, chuỗi "sinh sản" Hard,
 * vật lý wave (bán kính/opacity/miss), màu vòng. Chấm điểm/hit-test/tổng kết dùng chung ở core/gameplay/engine.js. Mỗi hàm
 * 1 việc, chỉ nhận tham số, không gọi hàm khác trong file — phối hợp là việc của event/workflow/gameplay.js. Ngẫu nhiên do
 * Workflow `Math.random()` rồi truyền vào (tham số `*Random01` / `randomValues`).
 *
 * Mỗi note = 1 cặp target circle (x/y px) + wave co từ `waveStartRadius` về 0 tại đúng chỗ đó. Vùng tính điểm
 * (classifyTapTier()) khác vùng nhận tap (findTopmostNoteInTolerance()), cả 2 ở engine.js.
 */

        // ── Spawn timing/mật độ ──────────────────────────────────────────────────────────────

        /** Đủ số beat để xét spawn (`spawnEligibleEveryNBeats` theo độ khó; Easy/Hard = 1). Workflow đếm `beatsSinceEligible`,
         * đưa về 0 khi thật sự xét spawn. */
        function isBeatEligibleForSpawn(beatsSinceEligible, spawnEligibleEveryNBeats) {
            return beatsSinceEligible >= spawnEligibleEveryNBeats;
        }

        /** Xác suất spawn khi đủ điều kiện — nội suy tuyến tính theo smoothedEnergy (roll: isCircleSpawnRollHit()). */
        function computeSpawnProbability(smoothedEnergy, cfg) {
            const energy = Math.min(1, Math.max(0, smoothedEnergy));
            return cfg.spawnProbabilityMin + energy * (cfg.spawnProbabilityMax - cfg.spawnProbabilityMin);
        }

        /** Thời gian co (ms) của 1 wave = `beatsPerWave` nhịp theo BPM hiện tại x `difficultyMultiplier` (Easy chậm hơn), clamp
         * [minShrinkDurationMs, maxShrinkDurationMs] sau khi nhân. BPM không hợp lệ -> `fallbackShrinkDurationMs` (cũng nhân). */
        function computeShrinkDurationMs(bpmString, cfg, difficultyMultiplier) {
            const bpm = parseFloat(bpmString);
            const raw = (!Number.isFinite(bpm) || bpm <= 0) ? cfg.fallbackShrinkDurationMs : (60000 / bpm) * cfg.beatsPerWave;
            const adjusted = raw * difficultyMultiplier;
            return Math.min(cfg.maxShrinkDurationMs, Math.max(cfg.minShrinkDurationMs, adjusted));
        }

        /** Khoảng cách (ms) giữa 2 wave liên tiếp của chuỗi "sinh sản" Hard = 2/3 quãng `spawnEligibleEveryNBeats` beat theo
         * BPM. BPM không hợp lệ -> chu kỳ beat ≈ fallbackShrinkDurationMs / beatsPerWave. */
        function computeChainSpacingMs(bpmString, spawnEligibleEveryNBeats, cfg) {
            const bpm = parseFloat(bpmString);
            const beatPeriodMs = (!Number.isFinite(bpm) || bpm <= 0) ? (cfg.fallbackShrinkDurationMs / cfg.beatsPerWave) : (60000 / bpm);
            const baseSpacingMs = beatPeriodMs * spawnEligibleEveryNBeats;
            return baseSpacingMs - (baseSpacingMs / 3);
        }

        // ── Vị trí spawn: lưới pitch→ô ────────────────────────────────────────────────────────

        /** Số cột/hàng lưới khớp vùng spawn (px) — tính lại mỗi lần canvas đổi kích thước. */
        function computeGridGeometry(zoneWidthPx, zoneHeightPx, cellSizePx) {
            const cols = Math.max(1, Math.floor(zoneWidthPx / cellSizePx));
            const rows = Math.max(1, Math.floor(zoneHeightPx / cellSizePx));
            return { cols, rows };
        }

        // ── Thứ tự duyệt toàn bộ ô lưới ───────────────────────────────────────────────────────
        // 5 thuật toán tham số hoá (điểm xuất phát/chiều) phủ 14 kiểu duyệt; mỗi hàm trả đúng `cols*rows` phần tử {col,row},
        // không lặp. Workflow chọn ngẫu nhiên 1 hàm mỗi lần dựng lại (planCirclePitchMapRebuild()) rồi đưa vào buildPitchCellMap().

        /** Theo hàng — mọi hàng quét cùng 1 chiều cột. */
        function generateRowMajorOrder(cols, rows, startFromBottom, startFromRight) {
            const order = [];
            for (let ri = 0; ri < rows; ri++) {
                const r = startFromBottom ? (rows - 1 - ri) : ri;
                for (let ci = 0; ci < cols; ci++) {
                    const c = startFromRight ? (cols - 1 - ci) : ci;
                    order.push({ col: c, row: r });
                }
            }
            return order;
        }

        /** Theo cột — mọi cột quét cùng 1 chiều hàng. */
        function generateColumnMajorOrder(cols, rows, startFromRight, startFromBottom) {
            const order = [];
            for (let ci = 0; ci < cols; ci++) {
                const c = startFromRight ? (cols - 1 - ci) : ci;
                for (let ri = 0; ri < rows; ri++) {
                    const r = startFromBottom ? (rows - 1 - ri) : ri;
                    order.push({ col: c, row: r });
                }
            }
            return order;
        }

        /** Rắn bò theo hàng — chiều quét cột đảo mỗi hàng; `startFromRight` là chiều của hàng đầu. */
        function generateBoustrophedonRowOrder(cols, rows, startFromBottom, startFromRight) {
            const order = [];
            for (let ri = 0; ri < rows; ri++) {
                const r = startFromBottom ? (rows - 1 - ri) : ri;
                const reverseThisRow = (ri % 2 === 1) !== startFromRight; // hàng lẻ tự đảo chiều so với hàng đầu
                for (let ci = 0; ci < cols; ci++) {
                    const c = reverseThisRow ? (cols - 1 - ci) : ci;
                    order.push({ col: c, row: r });
                }
            }
            return order;
        }

        /** Rắn bò theo cột — chiều quét hàng đảo mỗi cột; `startFromRight` chọn cột đầu. */
        function generateBoustrophedonColumnOrder(cols, rows, startFromRight) {
            const order = [];
            for (let ci = 0; ci < cols; ci++) {
                const c = startFromRight ? (cols - 1 - ci) : ci;
                const reverseThisCol = ci % 2 === 1;
                for (let ri = 0; ri < rows; ri++) {
                    const r = reverseThisCol ? (rows - 1 - ri) : ri;
                    order.push({ col: c, row: r });
                }
            }
            return order;
        }

        /** Xoáy ốc quanh tâm lưới — `clockwise` chọn chiều, `outsideIn` xuất phát từ viền (false = đảo ngược, từ tâm ra). */
        function generateSpiralOrder(cols, rows, clockwise, outsideIn) {
            const order = [];
            let top = 0, bottom = rows - 1, left = 0, right = cols - 1;
            while (top <= bottom && left <= right) {
                if (clockwise) {
                    for (let c = left; c <= right; c++) order.push({ col: c, row: top });
                    for (let r = top + 1; r <= bottom; r++) order.push({ col: right, row: r });
                    if (top !== bottom) for (let c = right - 1; c >= left; c--) order.push({ col: c, row: bottom });
                    if (left !== right) for (let r = bottom - 1; r > top; r--) order.push({ col: left, row: r });
                } else {
                    for (let r = top; r <= bottom; r++) order.push({ col: left, row: r });
                    for (let c = left + 1; c <= right; c++) order.push({ col: c, row: bottom });
                    if (left !== right) for (let r = bottom - 1; r >= top; r--) order.push({ col: right, row: r });
                    if (top !== bottom) for (let c = right - 1; c > left; c--) order.push({ col: c, row: top });
                }
                top++; bottom--; left++; right--;
            }
            return outsideIn ? order : order.reverse();
        }

        // ── Bảng gán pitch→ô ──────────────────────────────────────────────────────────────────

        /**
         * Bảng gán pitch→ô trên dải MIDI cố định [0-127]: tâm các ô theo `traversalOrder` được xáo (Fisher-Yates, dùng
         * `randomValues`, cần ≥ `cols*rows` giá trị) rồi chia round-robin 128 note (hết ô thì vòng lại — số note/ô có thể không
         * đều). @returns {Array<{col,row,cellX,cellY}>} đúng 128 phần tử, index = note MIDI (findCellForPitch() tra O(1)).
         */
        function buildPitchCellMap(cols, rows, zoneOriginXPx, zoneOriginYPx, cfg, traversalOrder, randomValues) {
            const totalCells = cols * rows;
            const cellCenters = traversalOrder.map((cell) => ({
                col: cell.col, row: cell.row,
                cellX: zoneOriginXPx + cell.col * cfg.gridCellSizePx + cfg.gridCellSizePx / 2,
                cellY: zoneOriginYPx + cell.row * cfg.gridCellSizePx + cfg.gridCellSizePx / 2,
            }));

            let rvIndex = 0;
            for (let i = cellCenters.length - 1; i > 0; i--) {
                const j = Math.floor(randomValues[rvIndex++ % randomValues.length] * (i + 1));
                const tmp = cellCenters[i]; cellCenters[i] = cellCenters[j]; cellCenters[j] = tmp;
            }

            const cellForMidi = new Array(128);
            for (let midi = 0; midi < 128; midi++) {
                cellForMidi[midi] = cellCenters[midi % totalCells];
            }
            return cellForMidi;
        }

        // ── Chọn ô đặt wave ───────────────────────────────────────────────────────────────────

        const GAMEPLAY_NEIGHBOR_OFFSETS = Object.freeze([[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]); // 8 hướng — chỉ làm hướng xuất phát ngẫu nhiên, không quét tuần tự

        /**
         * Ô đặt wave: ô đích còn trống -> dùng luôn; bận -> thử 1 ô lân cận theo hướng NGẪU NHIÊN (lần 1), bận/ngoài biên ->
         * XOAY 90° hướng đó (cùng ma trận xoay rời rạc của rotateRubikIndices(), core/rubik-math.js) thử lần 2; vẫn không
         * được -> null (bỏ, không dò tiếp).
         * @param {{col:number,row:number,cellX:number,cellY:number}} targetCell
         * @param {number} startRandom01 - Math.random() của Workflow -> hướng xuất phát (0-7)
         * @param {number} rotationRandom01 - Math.random() của Workflow -> chiều xoay lần 2 (<0.5: thuận, còn lại: ngược)
         * @param {Set<string>} occupiedCellKeys - `"${col},${row}"` của MỌI wave đang sống (collectOccupiedCellKeys())
         * @returns {{col:number,row:number,cellX:number,cellY:number}|null}
         */
        function findAvailableCell(targetCell, cols, rows, cfg, zoneOriginXPx, zoneOriginYPx, startRandom01, rotationRandom01, occupiedCellKeys) {
            const isFree = (col, row) => !occupiedCellKeys.has(`${col},${row}`);
            if (isFree(targetCell.col, targetCell.row)) return targetCell;

            const toCellCenter = (col, row) => ({
                col, row,
                cellX: zoneOriginXPx + col * cfg.gridCellSizePx + cfg.gridCellSizePx / 2,
                cellY: zoneOriginYPx + row * cfg.gridCellSizePx + cfg.gridCellSizePx / 2,
            });
            const tryOffset = (dc, dr) => {
                const col = targetCell.col + dc, row = targetCell.row + dr;
                if (col < 0 || col >= cols || row < 0 || row >= rows) return null; // ngoài biên lưới -> tính là 1 LẦN THỬ HỎNG
                return isFree(col, row) ? toCellCenter(col, row) : null;
            };

            const startOffsetIndex = Math.floor(startRandom01 * 8);
            const rotateClockwise = rotationRandom01 < 0.5;
            const [dc1, dr1] = GAMEPLAY_NEIGHBOR_OFFSETS[startOffsetIndex % GAMEPLAY_NEIGHBOR_OFFSETS.length];
            const try1 = tryOffset(dc1, dr1);
            if (try1) return try1;
            return tryOffset(rotateClockwise ? -dr1 : dr1, rotateClockwise ? dc1 : -dc1);
        }

        /** Tập ô đang có wave sống (`"${col},${row}"`). @param {Array<{col:number,row:number}>} waves @returns {Set<string>} */
        function collectOccupiedCellKeys(waves) {
            return new Set(waves.map((w) => `${w.col},${w.row}`));
        }

        /** Ô dự phòng khi pitch chưa có ô (map rỗng/pitch null): ô GIỮA vùng spawn. */
        function computeFallbackGridCell(gridCols, gridRows, zoneOriginXPx, zoneOriginYPx, cfg) {
            return {
                col: Math.floor(gridCols / 2), row: Math.floor(gridRows / 2),
                cellX: zoneOriginXPx + (gridCols * cfg.gridCellSizePx) / 2,
                cellY: zoneOriginYPx + (gridRows * cfg.gridCellSizePx) / 2,
            };
        }

        /** Vùng spawn (px) trong canvas theo `cfg.spawnZone` (%): góc trên-trái + kích thước. */
        function computeSpawnZoneGeometry(canvasWidthPx, canvasHeightPx, zone) {
            return {
                originX: canvasWidthPx * zone.xMinPercent / 100,
                originY: canvasHeightPx * zone.yMinPercent / 100,
                widthPx: canvasWidthPx * (zone.xMaxPercent - zone.xMinPercent) / 100,
                heightPx: canvasHeightPx * (zone.yMaxPercent - zone.yMinPercent) / 100,
            };
        }

        /** Trần số wave cùng lúc: cfg có khoảng (Medium 2-5) -> roll trong khoảng mỗi lần xét (mật độ dao động); số cố định
         * (Easy 1, Hard Infinity) -> trả thẳng `maxConcurrentWaves`. */
        function computeConcurrentWaveCap(diffCfg, random01) {
            const hasRange = diffCfg.minConcurrentWaves != null && diffCfg.minConcurrentWaves !== diffCfg.maxConcurrentWaves;
            if (!hasRange) return diffCfg.maxConcurrentWaves;
            const span = diffCfg.maxConcurrentWaves - diffCfg.minConcurrentWaves + 1;
            return diffCfg.minConcurrentWaves + Math.floor(random01 * span);
        }

        /**
         * Chuỗi pitch của 1 lần spawn cấp `chainLevel` (cơ chế "sinh sản" Hard): phần tử 0 là `basePitch`; phần tử i = phần tử
         * i-1 + (i+1) bán cung (tính từ bản sao trước, không từ gốc), clamp [pitchMin, pitchMax].
         * @param {number} chainLevel - 1 = chỉ [basePitch] @returns {number[]} length = max(1, chainLevel)
         */
        function computeChainedPitches(basePitch, chainLevel, pitchMin, pitchMax) {
            const pitches = [basePitch];
            let current = basePitch;
            for (let i = 1; i < chainLevel; i++) {
                current = current + (i + 1);
                current = Math.min(pitchMax, Math.max(pitchMin, current));
                pitches.push(current);
            }
            return pitches;
        }

        /** Ô đã gán cho 1 pitch (index thẳng vào bảng 128 phần tử). Map rỗng / pitch null / ngoài [0,127] -> null. */
        function findCellForPitch(pitchCellMap, midiNote) {
            if (midiNote == null || midiNote < 0 || midiNote > 127) return null;
            return pitchCellMap[midiNote] || null;
        }

        /** Lệch tâm ngẫu nhiên trong ô, giới hạn (gridCellSizePx - cellJitterMarginPx) quanh tâm ô. */
        function applyCellJitter(cellX, cellY, cfg, randomX01, randomY01) {
            const usable = cfg.gridCellSizePx - cfg.cellJitterMarginPx;
            return { x: cellX + (randomX01 - 0.5) * usable, y: cellY + (randomY01 - 0.5) * usable };
        }

        // ── Nhịp spawn + refresh theo beat (bộ theo dõi beat sống ở Workflow, core sửa tại chỗ) ───────────────────

        /** Bộ theo dõi beat của 1 phiên Circle. `beatFluxHistory`: 1 mốc/BEAT (trung bình flux mỗi frame giữa 2 beat), trần 24 —
         * độc lập fps máy. @param {number} lastBeatTime - mốc beat hiện tại (beat cũ không tính là "mới") */
        function createCircleBeatTracker(lastBeatTime) {
            return { lastConsumedBeatTime: lastBeatTime, beatsSinceEligible: 0, beatsSincePhraseRefresh: 0, beatFluxHistory: [], pendingSum: 0, pendingCount: 0 };
        }

        /** Lúc bắt đầu phát (hết đếm ngược): chốt mốc beat hiện tại + đếm lại 2 bộ đếm — beat detect trước đó không bị hiểu là
         * "vừa có". Giữ lịch sử flux. @param {object} tracker @param {number} lastBeatTime */
        function resetCircleBeatTrackerCounters(tracker, lastBeatTime) {
            tracker.lastConsumedBeatTime = lastBeatTime;
            tracker.beatsSinceEligible = 0;
            tracker.beatsSincePhraseRefresh = 0;
        }

        /** 1 frame: cộng flux mới nhất vào bộ tích luỹ; có beat MỚI -> chốt mốc beat, tăng 2 bộ đếm, đẩy trung bình đoạn vào
         * lịch sử (trần 24) rồi reset bộ tích luỹ. Sửa `tracker` tại chỗ (hot path, không cấp phát). @returns {boolean} có beat mới */
        function stepCircleBeatTracker(tracker, fluxHistory, lastBeatTime) {
            if (fluxHistory.length > 0) {
                tracker.pendingSum += fluxHistory[fluxHistory.length - 1];
                tracker.pendingCount++;
            }
            if (!(lastBeatTime > 0 && lastBeatTime !== tracker.lastConsumedBeatTime)) return false;
            tracker.lastConsumedBeatTime = lastBeatTime;
            tracker.beatsSinceEligible++;
            tracker.beatsSincePhraseRefresh++;
            if (tracker.pendingCount > 0) {
                tracker.beatFluxHistory.push(tracker.pendingSum / tracker.pendingCount);
                if (tracker.beatFluxHistory.length > 24) tracker.beatFluxHistory.shift();
            }
            tracker.pendingSum = 0;
            tracker.pendingCount = 0;
            return true;
        }

        /** Dựng lại bảng gán pitch→ô: lần đầu (map rỗng) hoặc đang chờ refresh mà bảng đã sạch wave (không ép wave đang sống đổi
         * chỗ). */
        function shouldRebuildCirclePitchMap(pitchMapLength, refreshPending, liveWaveCount) {
            return pitchMapLength === 0 || (refreshPending && liveWaveCount === 0);
        }

        /** Yêu cầu refresh vị trí khi nhạc biến động / qua ranh giới phrase — chỉ khi map vừa không dựng lại và chưa đang chờ. */
        function shouldRequestCircleRefresh(justRebuilt, refreshPending, musicTransition, phraseBoundary) {
            return !justRebuilt && !refreshPending && (musicTransition || phraseBoundary);
        }

        /** Được xét spawn ở beat này: không chờ refresh, chưa chạm trần wave, không có chuỗi Hard đang nhả dở, đủ số beat. */
        function canConsiderCircleSpawn(refreshPending, liveWaveCount, concurrentWaveCap, chainQueueLength, eligibleBeat) {
            return !refreshPending && liveWaveCount < concurrentWaveCap && chainQueueLength === 0 && eligibleBeat;
        }

        /** Roll xác suất spawn. @param {number} random01 - Math.random() của Workflow */
        function isCircleSpawnRollHit(random01, probability) {
            return random01 < probability;
        }

        /** Cấp chuỗi "sinh sản" (chỉ Hard): spawn lúc bảng còn wave sống -> tăng 1 (trần `maxLevel`), bảng sạch -> về 1.
         * Không bật cơ chế -> giữ cấp đang lưu, chuỗi 1 (không sinh sản). @returns {{level:number, chainLevel:number}} */
        function computeHardChainLevel(enabled, currentLevel, liveWaveCount, maxLevel) {
            const level = liveWaveCount > 0 ? Math.min(currentLevel + 1, maxLevel) : 1;
            return { level: enabled ? level : currentLevel, chainLevel: enabled ? level : 1 };
        }

        /** Đến lượt nhả wave kế tiếp của chuỗi Hard (đủ quãng `spacingMs` kể từ lần nhả trước). */
        function isHardChainReleaseDue(enabled, queueLength, now, lastSpawnAt, spacingMs) {
            return enabled && queueLength > 0 && now - lastSpawnAt >= spacingMs;
        }

        /** Kế hoạch xáo lại bảng gán: 1 trong 5 kiểu duyệt lưới + 2 cờ hướng + số giá trị ngẫu nhiên cần cho bước shuffle.
         * @param {number} patternRandom01 @param {number} flagRandomA01 @param {number} flagRandomB01 - Math.random() của Workflow */
        function planCirclePitchMapRebuild(cols, rows, patternRandom01, flagRandomA01, flagRandomB01) {
            return {
                patternIndex: Math.floor(patternRandom01 * 5),
                flagA: flagRandomA01 < 0.5,
                flagB: flagRandomB01 < 0.5,
                randomCount: cols * rows + 8,
            };
        }

        /** Tách wave tự hết hạn khỏi wave còn sống trong 1 frame: danh sách miss + id, thứ tự VẼ (đảo — wave xuất hiện trước nằm
         * trên, canvas "vẽ sau đè lên") và vòng đích tương ứng. @param {Array<object>} entries - theo thứ tự `gameplayWaves`
         * @param {boolean[]} missedFlags - isWaveMissed() từng entry @param {number} centerRadius */
        function partitionCircleWaveEntries(entries, missedFlags, centerRadius) {
            const missed = [];
            const remaining = [];
            entries.forEach((entry, i) => (missedFlags[i] ? missed : remaining).push(entry));
            const drawOrder = remaining.slice().reverse();
            return {
                missed,
                missedIds: missed.map((entry) => entry.id),
                drawOrder,
                targetCircles: drawOrder.map((entry) => ({ x: entry.x, y: entry.y, centerRadius, colorMain: entry.colorMain })),
            };
        }

        /** Danh sách wave mới bỏ các id đã chấm/miss (giữ thứ tự). @param {Array<{id:number}>} waves @param {number[]} ids */
        function removeCircleWavesByIds(waves, ids) {
            return waves.filter((w) => !ids.includes(w.id));
        }

        /** Số liệu phụ cho modal Kết quả: điểm tối đa lý thuyết (mọi vòng Perfect) + nhãn số lượt chơi số nhiều hay ít.
         * @returns {{ maxScore: number, isPluralPlayCount: boolean }} */
        function computeCircleEndExtras(circleCount, playCount, cfg) {
            return { maxScore: circleCount * cfg.tiers.find((tier) => tier.name === 'perfect').score, isPluralPlayCount: playCount !== 1 };
        }

        // ── Vật lý wave: bán kính / opacity / ngưỡng miss ────────────────────────────────────

        /** Bán kính hiện tại — co tuyến tính từ startRadius về 0 trong `wave.shrinkDurationMs` (chốt lúc spawn). */
        function computeWaveRadius(wave, now) {
            const elapsed = now - wave.spawnedAt;
            const ratio = Math.min(1, Math.max(0, elapsed / wave.shrinkDurationMs));
            return wave.startRadius * (1 - ratio);
        }

        /** Opacity theo bán kính: `opacityBase` ngoài vùng gap, nội suy lên `opacityAtInnerEdge` trong [centerRadius-gapInner,
         * centerRadius+gapOuter], đạt đỉnh ở biên trong. */
        function computeWaveOpacity(radius, cfg) {
            const outerEdge = cfg.centerRadius + cfg.gapOuter;
            if (radius > outerEdge) return cfg.opacityBase;
            const innerEdge = cfg.centerRadius - cfg.gapInner;
            const clamped = Math.max(innerEdge, radius);
            const progress = (outerEdge - clamped) / (outerEdge - innerEdge);
            return cfg.opacityBase + progress * (cfg.opacityAtInnerEdge - cfg.opacityBase);
        }

        /** Wave co qua biên trong vùng hợp lệ (không còn cơ hội bấm) -> miss, dọn khỏi danh sách dù không ai bấm. */
        function isWaveMissed(radius, cfg) {
            return radius < (cfg.centerRadius - cfg.gapInner);
        }

        // ── Màu vòng tròn (theo effect đang chạy, chốt lúc spawn) ────────────────────────────

        /** Effect `dynamic` — luân phiên màu A/B theo thứ tự spawn. */
        function computeCircleColorDynamic(dynA, dynB, spawnIndex) {
            return spawnIndex % 2 === 0 ? dynA : dynB;
        }

        /** Effect `gradient` — 1 hue lấy từ hueOffset lúc spawn. */
        function computeCircleColorGradientMain(hueOffset) {
            const hue = ((hueOffset % 360) + 360) % 360;
            return `hsl(${hue}, 70%, 55%)`;
        }

        /** Màu vòng ngoài (nhạt hơn, không dùng opacity) cho effect `gradient` — cùng hue. Solid/dynamic dùng
         * interpolateColor(main, '#ffffff', 0.5) (core/color-utils.js). */
        function computeCircleColorGradientLight(hueOffset) {
            const hue = ((hueOffset % 360) + 360) % 360;
            return `hsl(${hue}, 50%, 80%)`;
        }

