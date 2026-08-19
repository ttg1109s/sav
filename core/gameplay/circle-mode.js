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
         * [SỬA — phản hồi Giang "không chia nửa, mà chỉ trừ đi 1/3 của nó"] Khoảng cách (ms) giữa 2
         * wave LIÊN TIẾP trong chuỗi "sinh sản" Hard — quãng s gốc (`spawnEligibleEveryNBeats` quy
         * đổi ra ms từ BPM) TRỪ ĐI 1/3 CHÍNH NÓ, tức còn lại 2/3 quãng s gốc (KHÔNG còn chia đôi như
         * bản trước — 2/3 > 1/2, quãng cách giờ DÀI hơn, chuỗi giãn ra chậm hơn bản trước).
         * BPM không hợp lệ -> fallback CÙNG công thức computeShrinkDurationMs() (beatPeriodMs xấp xỉ
         * = fallbackShrinkDurationMs / beatsPerWave).
         */
        function computeChainSpacingMs(bpmString, spawnEligibleEveryNBeats, cfg) {
            const bpm = parseFloat(bpmString);
            const beatPeriodMs = (!Number.isFinite(bpm) || bpm <= 0) ? (cfg.fallbackShrinkDurationMs / cfg.beatsPerWave) : (60000 / bpm);
            const baseSpacingMs = beatPeriodMs * spawnEligibleEveryNBeats;
            return baseSpacingMs - (baseSpacingMs / 3);
        }

        // ── Vị trí spawn: lưới pitch→ô ────────────────────────────────────────────────────────

        /** Số cột/hàng lưới thật (px) khớp vùng spawnZone hiện tại của canvas — tính lại mỗi khi
         * resize HOẶC mỗi lần refresh bảng gán (xem gameplayRefreshPending). */
        function computeGridGeometry(zoneWidthPx, zoneHeightPx, cellSizePx) {
            const cols = Math.max(1, Math.floor(zoneWidthPx / cellSizePx));
            const rows = Math.max(1, Math.floor(zoneHeightPx / cellSizePx));
            return { cols, rows, totalCells: cols * rows };
        }

        // ── Sinh thứ tự duyệt toàn bộ ô lưới (traversal order) ───────────────────────────────
        // [MỚI — phản hồi Giang, viết lại thuật toán pitch map] 5 hàm THAM SỐ HOÁ (không phải 14
        // hàm riêng — Rule 1/3a: đây là CÙNG 1 thuật toán mỗi loại, chỉ khác điểm xuất phát/chiều,
        // không phải nhiều tiến trình khác nhau) phủ hết 14 kiểu Giang liệt kê + vài biến thể đối
        // xứng tự nhiên đi kèm. Mỗi hàm trả ĐÚNG `cols*rows` phần tử {col,row}, không lặp, không
        // thiếu ô nào — Workflow tự chọn 1 hàm + tham số (random mỗi lần rebuild, xem
        // event/workflow/gameplay.js::_rebuildPitchCellMap()) rồi truyền vào buildPitchCellMap().

        /** Theo hàng (row-major) — hàng nào cũng quét CÙNG 1 chiều cột. `startFromBottom`/
         * `startFromRight` chọn hàng đầu tiên/chiều quét cột — phủ 4 kiểu Giang liệt kê (1-4). */
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

        /** Theo cột (column-major) — cột nào cũng quét CÙNG 1 chiều hàng. `startFromRight`/
         * `startFromBottom` chọn cột đầu tiên/chiều quét hàng — phủ 4 kiểu Giang liệt kê (8-11). */
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

        /** Rắn bò (boustrophedon) theo hàng — chiều quét cột TỰ ĐẢO mỗi hàng kế tiếp (hàng 1 trái
         * qua phải, hàng 2 phải qua trái, hàng 3 lại trái qua phải...). `startFromBottom` chọn hàng
         * đầu tiên, `startFromRight` chọn chiều quét cột CỦA HÀNG ĐẦU (hàng sau tự đảo theo) — phủ
         * kiểu Giang liệt kê (12-13, cả biến thể "xuất phát từ trên/dưới" lẫn trái/phải). */
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

        /** Rắn bò (boustrophedon) theo cột — chiều quét hàng TỰ ĐẢO mỗi cột kế tiếp. `startFromRight`
         * chọn cột đầu tiên — phủ kiểu Giang liệt kê (14). */
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

        /** Xoáy ốc (spiral) quanh tâm lưới — `clockwise` chọn chiều, `outsideIn` chọn xuất phát từ
         * viền ngoài hay tâm (đảo ngược mảng outside-in để ra inside-out, CÙNG 1 đường đi hình học,
         * chỉ khác thứ tự đọc) — phủ kiểu Giang liệt kê (5-7) + 1 biến thể đối xứng tự nhiên
         * (ngược chiều kim đồng hồ, từ trong ra ngoài — Giang không liệt kê riêng nhưng cùng công
         * thức, không thêm thuật toán mới). */
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
         * [SỬA — phản hồi Giang, viết lại thuật toán pitch map] Dải MIDI giờ CỐ ĐỊNH [0-127] (toàn
         * bộ dải MIDI hợp lệ) — KHÔNG còn theo dõi "dải đã quan sát được" (computePitchRangeUpdate()
         * ĐÃ XOÁ, cùng 2 field gameplayPitchRangeMin/Max) — bỏ hẳn nhóm code + edge case "dải chưa
         * đủ rộng"/"chưa detect nốt nào -> map rỗng" của bản trước.
         *
         * Thuật toán: (1) phân phối ROUND-ROBIN toàn bộ 128 note vào ĐÚNG `traversalOrder` (1 trong
         * 5 hàm generate*Order() ở trên, Workflow tự chọn + truyền vào) — note 0 -> traversalOrder[0],
         * note 1 -> traversalOrder[1], ..., hết ô lại VÒNG LẠI từ traversalOrder[0] (note thứ
         * totalCells lại rơi vào ô đầu) — CHẤP NHẬN số note/ô không đều nếu 128 không chia hết
         * totalCells (Giang xác nhận chấp nhận được). (2) SAU ĐÓ shuffle — hoán vị VỊ TRÍ VẬT LÝ mỗi
         * ô trong traversalOrder (Fisher-Yates), giữ NGUYÊN cụm note đã gán cho ô đó, chỉ đổi ô đó
         * NẰM Ở ĐÂU trên lưới thật.
         *
         * Trả về mảng ĐÚNG 128 phần tử (index = note MIDI, 0-127) — `findCellForPitch()` giờ tra
         * cứu O(1) bằng index thẳng, không còn tìm kiếm tuyến tính qua pitchMin/pitchMax.
         * `randomValues` PHẢI do Workflow tự sinh sẵn (Core không tự random) — cần ít nhất
         * `cols*rows` phần tử (dùng cho bước shuffle).
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
        /** [SỬA — viết lại thuật toán pitch map] Tra cứu O(1) bằng index thẳng — `pitchCellMap` giờ
         * LUÔN đúng 128 phần tử (index = note MIDI), không còn tìm kiếm tuyến tính qua
         * pitchMin/pitchMax (bucket range ĐÃ XOÁ). `midiNote` ngoài [0,127] hoặc null -> null (Rule
         * 2: Core không tự biết "chưa detect" nghĩa là gì, chỉ trả null cho input không hợp lệ). */
        function findCellForPitch(pitchCellMap, midiNote) {
            if (midiNote == null || midiNote < 0 || midiNote > 127) return null;
            return pitchCellMap[midiNote] || null;
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
        // [SỬA — viết lại thuật toán pitch map, phản hồi Giang] computePitchRangeUpdate() ĐÃ XOÁ —
        // dải MIDI giờ CỐ ĐỊNH [0-127], không còn "dải đã quan sát được" nào cần theo dõi/cập nhật.

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

