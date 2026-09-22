/**
 * core/visualizer/groups/connector/brain.js — style "brain" (Brain Filter) của group connector.
 *
 * BÊ NGUYÊN phần canvas của Brain_Filter_Perception_Visualization.html — thân các hàm/hằng số dưới đây là
 * bản sao NGUYÊN VĂN từ file gốc (initNodesAndPaths, createParticle, getBezierPoint,
 * drawTimeline [đổi tên từ drawLabelsAndTimeline — xem SỬA 22/09/2026 bên dưới], drawBrainFilter,
 * drawCurvesAndParticles, triggerBurst): vẫn chạy tự do bằng
 * Math.random() (không nối audio), shadowBlur như gốc. BỎ vì không thuộc phần canvas: header/toolbar/
 * settings/banner/footer, listener nút bấm/slider/pointer.
 * Chỉ thêm phần KEO tối thiểu để chạy được trong SAV: đóng gói trong 1 object (tránh đè các global
 * cùng tên của SAV như canvas/ctx/resizeCanvas/config), và draw() thay cho resizeCanvas()+animate()
 * (SAV đã tự clear canvas + tự gọi mỗi frame, canvas do SAV set kích thước).
 *
 * SỬA (22/09/2026, yêu cầu Giang "màu theo 3 chế độ color của app") — bảng `themes` gốc (3 theme cố
 * định cyan/violet/gold, chọn qua `config.theme`) đã BỎ HẲN — điểm lệch THỨ NHẤT khỏi "verbatim,
 * không tự đổi" ban đầu. Toàn bộ màu (kể cả các chỗ trắng cố định '#ffffff' ở filter node/hạt input/
 * hạt output — gốc dùng trắng cố định bất kể theme) nay lấy từ hệ mode màu CHUNG của app (Custom
 * Effect group 'connector': solid/dynamic/gradient, `getComputedColor()`, core/audio-analysis.js) —
 * cùng hệ mà synapse.js/circuit.js đang dùng, đổi mode ở Element Style là thấy ngay (gọi lại mỗi
 * frame, không bake). Xem `getBrainRoleColor()` ở phần KEO cuối file. Không có audio thật (hiệu ứng
 * này vẫn free-running Math.random) nên dataValue truyền cố định — chỉ ảnh hưởng mode 'gradient'.
 * Giữ NGUYÊN, không đụng: nền gradient tối bên trong ellipse (chủ yếu slate trung tính, chỉ 1 stop
 * cuối tint cyan rất nhẹ 5% alpha — không convert an toàn được vì `.fill` có thể là hex/rgb()/hsla()
 * tuỳ mode, không tách alpha bằng string được).
 *
 * SỬA (22/09/2026, Giang báo "chiều ngang nhưng bị kéo giãn ra") — điểm lệch THỨ HAI: layout gốc
 * (ellipse, toả tia input/output, trục thời gian) tính theo `height` THẬT của canvas, đúng ý trang
 * landscape rộng của bản gốc — nhưng canvas SAV luôn full màn hình thật của máy (core/canvas-scene-
 * setup.js), trên điện thoại là portrait (height > width nhiều) nên bị kéo cao bất thường. Thêm
 * `stageH`/`stageOffsetY` (phần KEO, gần đầu file) giới hạn chiều cao DÙNG ĐỂ TÍNH layout theo tỉ lệ
 * cố định với width (16:9-ish), căn giữa dải đó theo chiều dọc màn hình thật.
 *
 * SỬA (22/09/2026, yêu cầu Giang "loại bỏ mấy text của connector brain") — điểm lệch THỨ BA: bỏ hẳn
 * 3 khối fillText() nhãn chữ ("1000000 INFORMATION SIGNALS"/"BRAIN FILTER"/"ONLY A FEW EVENTS REACH
 * YOUR AWARENESS") — hàm gốc `drawLabelsAndTimeline` đổi tên thành `drawTimeline` cho khớp (chỉ còn
 * vẽ trục thời gian dưới: đường đứt + dãy dot + mũi tên, không phải text nên giữ nguyên).
 *
 * SỬA (22/09/2026, yêu cầu Giang — trục thời gian phản ứng theo beat/nốt nhạc/năng lượng dải tần) —
 * điểm lệch THỨ TƯ, hiện trạng CUỐI CÙNG sau vài lần sửa lại (chi tiết từng lần + lý do xem comment
 * NGAY TẠI code, đầu khối `TIMELINE_*` và trong `drawTimeline()`): trục là 1 DÃY `TIMELINE_DOT_COUNT`
 * dot đều nhau; mỗi beat THẬT (đọc `lastBeatTime` — mốc do audio-analysis.js tự ghi ra appState, xem
 * service/state/visualizer-runtime.js, KHÔNG tự dựng detector riêng) sinh 1 cụm `clusterSize` dot
 * (1-7, theo nốt nhạc `lastValidMidiNote`) từ start pos, dịch mượt sang dot+1, quãng đường theo
 * `smoothedEnergy`; độ phồng từng dot theo năng lượng dải tần riêng (`computeNeuronBinEnergy()`, core/
 * visualizer/groups/connector/synapse.js), nội suy mượt giữa 2 dải liền kề + làm mượt theo thời gian
 * (EMA) trước khi vẽ. Đây là điểm audio ĐẦU TIÊN nối vào style brain — mọi phần khác (ellipse/curves/
 * particles) vẫn free-running Math.random(), CHƯA nối audio.
 */
const brainFilterOriginal = (function () {
        let canvas = null;
        let ctx = null;

        // App State (gốc: đọc từ slider — giữ đúng giá trị mặc định của gốc)
        let isPaused = false;
        let config = {
            signalCount: 120,
            filterStrictness: 98 / 100,
            speedMultiplier: 1.5
        };

        // KEO (22/09/2026) — 3 vai trò màu trong hình vẽ (trước là field của bảng themes cyan/
        // violet/gold): primary (viền/mesh/tia lửa/hạt input), secondary (viền phụ mờ), outputLine
        // (đường + hạt output). Lấy từ hệ mode màu chung của app qua getComputedColor() (core/
        // audio-analysis.js, global — nạp trước file này) thay vì bảng cố định. roleIndex/3 chỉ để
        // 3 vai trò tách hue nhau ở mode 'gradient' (mode 'solid'/'dynamic' vốn không đổi theo
        // index nên cả 3 vai trò cùng 1 màu — đúng ý "1 màu đồng bộ" của 2 mode đó). dataValue
        // truyền cố định (không có audio thật) — chỉ mode 'gradient' đọc field này để lệch hue nhẹ.
        const BRAIN_COLOR_DATA_VALUE = 128;
        function getBrainRoleColor(roleIndex) {
            return getComputedColor(roleIndex, 3, BRAIN_COLOR_DATA_VALUE); // { fill, fillNoAlpha, glow }
        }

        // KEO (22/09/2026, thiết kế lại theo Giang) — THAY HẲN cơ chế "sóng lan liên tục + 3 dot bump"
        // ở bản trước (đã gỡ): trục thời gian giờ là 1 DÃY dot đều nhau (TIMELINE_DOT_COUNT) từ start
        // pos (leftPersonPos.x) đến end pos (rightPersonPos.x) — không còn 3 dot đặc biệt trái/giữa/
        // phải, mọi dot "phẳng" như nhau. Mỗi beat MỚI sinh 1 CỤM (`timelineClusters`, mảng, nhiều cụm
        // chồng nhau được): `clusterSize` dot liên tiếp bắt đầu từ dot 0 (start pos) được scale lên,
        // rồi dịch MƯỢT (nội suy dot theo t liên tục, không nhảy cứng số nguyên) sang dot+1, +2...
        //
        // SỬA (22/09/2026, Giang báo liên tiếp "beat chỉ bắn 1 lần rồi dừng" RỒI "sóng không theo
        // beat dù audio rõ nhiều beat") — đã thử 2 bộ phát hiện TỰ CHẾ (envelope peak-hold-decay, rồi
        // so beatScale/smoothedEnergy theo tỉ lệ) — cả 2 đều là XẤP XỈ kém tin cậy hơn bộ phát hiện
        // beat THẬT app đã có sẵn (spectral flux + ngưỡng thích ứng, dùng để tính BPM, core/audio-
        // analysis.js). Sửa ĐÚNG gốc: bỏ hẳn detector riêng, đọc THẲNG `lastBeatTime` — mốc beat thật
        // audio-analysis.js đã ghi ra appState (service/state/visualizer-runtime.js) mỗi lần nó tự bắn
        // — chỉ cần so lệch với giá trị đã thấy lần trước là biết "vừa có 1 beat mới", không tự đoán.
        const TIMELINE_DOT_COUNT = 40;
        const TIMELINE_CLUSTER_TRAVEL_MS = 700; // thời gian cụm dịch hết quãng đường của nó
        const TIMELINE_CLUSTER_MIN_TRAVEL_FRAC = 0.15; // smoothedEnergy thấp -> cụm dịch tối thiểu 15% trục
        const TIMELINE_CLUSTER_MAX_TRAVEL_FRAC = 0.7;  // smoothedEnergy cao -> tối đa 70% trục
        const TIMELINE_DOT_SMOOTH_ALPHA = 0.35; // EMA mỗi frame cho độ phồng từng dot — chặn giật do dữ liệu FFT thô, xem drawTimeline()
        let _lastSeenBeatTime = 0;
        let timelineClusters = []; // { startTime, clusterSize, travelDots }
        let timelineDotSmoothed = new Float32Array(TIMELINE_DOT_COUNT); // độ phồng ĐÃ LÀM MƯỢT từng dot, giữ nguyên qua các frame

        // SỬA (22/09/2026, Giang báo "dot bé quá chẳng thấy gì" rồi "to chả bà") — lần đầu đổi bán
        // kính sang tỉ lệ CỐ ĐỊNH theo `width` nhưng không đối chiếu với khoảng cách giữa 40 dot ->
        // dot baseline đã to hơn khoảng cách giữa 2 dot liền kề, chồng lên nhau thành 1 vệt đặc thay
        // vì dãy chấm rời — đúng nguyên nhân "to chả bà". Sửa ĐÚNG: tính bán kính theo TỈ LỆ của
        // chính khoảng cách giữa 2 dot (`dotSpacing`, tính ở _layoutFromCanvas()) — luôn nhỏ hơn nửa
        // khoảng cách nên không bao giờ chồng lấn nhau dù đổi TIMELINE_DOT_COUNT hay kích thước màn
        // hình.
        const TIMELINE_DOT_BASE_RADIUS_FRAC = 0.22; // × dotSpacing — baseline lúc không có cụm
        const TIMELINE_DOT_MAX_RADIUS_FRAC = 0.48;   // × dotSpacing — lúc phồng hết cỡ (boost = 1)
        let timelineDotBaseRadius = 3, timelineDotMaxRadius = 7; // giá trị mặc định trước lần layout đầu — ghi đè ngay ở _layoutFromCanvas()

        /** Nốt MIDI (0-127, appState.lastValidMidiNote — Workflow tự đọc rồi truyền vào, Rule 2) ->
         * số dot trong cụm (1-7): chia đều 12 semitone trong 1 quãng 8 thành 7 mức (yêu cầu Giang).
         * Không có nốt hợp lệ gần đây (null/undefined) -> mặc định 1 dot. */
        function _pitchToClusterSize(midiNote) {
            if (midiNote === null || midiNote === undefined) return 1;
            const level = Math.floor(((midiNote % 12 + 12) % 12) / 12 * 7); // 0-6
            return Math.min(7, Math.max(1, level + 1));
        }

        /** Cập nhật mỗi frame: phát hiện beat MỚI bằng `lastBeatTime` đổi khác lần thấy trước (sinh
         * cụm — quãng đường theo smoothedEnergy HIỆN TẠI lúc sinh, kích cỡ theo nốt nhạc HIỆN TẠI lúc
         * sinh) + dọn cụm đã dịch hết quãng đường (t >= 1). */
        function _updateTimelineClusters(time, lastBeatTime, smoothedEnergy, midiNote) {
            const isOnset = lastBeatTime && lastBeatTime !== _lastSeenBeatTime;

            if (isOnset) {
                _lastSeenBeatTime = lastBeatTime;
                const travelFrac = TIMELINE_CLUSTER_MIN_TRAVEL_FRAC + smoothedEnergy * (TIMELINE_CLUSTER_MAX_TRAVEL_FRAC - TIMELINE_CLUSTER_MIN_TRAVEL_FRAC);
                timelineClusters.push({
                    startTime: time,
                    clusterSize: _pitchToClusterSize(midiNote),
                    travelDots: travelFrac * TIMELINE_DOT_COUNT
                });
            }

            for (let i = timelineClusters.length - 1; i >= 0; i--) {
                if ((time - timelineClusters[i].startTime) / TIMELINE_CLUSTER_TRAVEL_MS >= 1) timelineClusters.splice(i, 1);
            }
        }

        /** Độ phủ (0-1) của dot `dotIndex` bởi 1 cụm có dot ĐẦU đang ở `startDotIndex` (số thực —
         * nội suy mượt, không phải số nguyên), rộng `clusterSize` dot — lõi cụm phủ đầy (1), mép mỗi
         * bên chuyển mượt qua đúng 1 dot (0→1) thay vì bật/tắt cứng, khớp ý "dịch mượt dần". */
        function _clusterCoverage(dotIndex, startDotIndex, clusterSize) {
            const rel = dotIndex - startDotIndex;
            if (rel <= -1 || rel >= clusterSize) return 0;
            if (rel >= 0 && rel <= clusterSize - 1) return 1;
            return rel < 0 ? (1 + rel) : (1 - (rel - (clusterSize - 1)));
        }

        let width, height;
        // KEO (22/09/2026, Giang báo "chiều ngang nhưng bị kéo giãn ra") — bản gốc là trang
        // landscape rộng (height nhỏ hơn width nhiều) nên mọi công thức `height * tỉ lệ` ra hình
        // cân đối; canvas SAV luôn full màn hình THẬT của máy (core/canvas-scene-setup.js), trên
        // điện thoại là PORTRAIT (height > width nhiều) -> dùng thẳng height thật làm ellipse/toả
        // tia bị kéo cao bất thường. Sửa: `stageH` = chiều cao DÙNG ĐỂ TÍNH layout, giới hạn theo
        // tỉ lệ cố định với width (không bao giờ vượt quá height thật — landscape/tablet không đổi
        // gì), `stageOffsetY` căn dải đó vào giữa theo chiều dọc màn hình thật. Mọi `height * X` cũ
        // (vị trí/kích thước dọc) đổi thành `stageOffsetY + stageH * X`.
        const BRAIN_STAGE_ASPECT = 0.5625; // 16:9 — landscape phổ biến, gần đúng tỉ lệ trang gốc
        let stageH = 0, stageOffsetY = 0;
        let leftPersonPos = { x: 0, y: 0 };
        let rightPersonPos = { x: 0, y: 0 };
        let filterPos = { x: 0, y: 0, rx: 0, ry: 0 };

        let inputPaths = [];
        let outputPaths = [];
        let particles = [];
        let filterNodes = [];
        let bursts = [];


        function initNodesAndPaths() {
            inputPaths = [];
            outputPaths = [];
            particles = [];
            filterNodes = [];

            // Generate Filter Internal Neural Network Nodes inside ellipse
            const nodeCount = 65;
            for (let i = 0; i < nodeCount; i++) {
                // Random point inside ellipse
                let u = Math.random();
                let v = Math.random();
                let r = Math.sqrt(u);
                let theta = v * 2 * Math.PI;
                let nx = filterPos.x + r * Math.cos(theta) * (filterPos.rx * 0.88);
                let ny = filterPos.y + r * Math.sin(theta) * (filterPos.ry * 0.88);

                filterNodes.push({
                    x: nx,
                    y: ny,
                    baseX: nx,
                    baseY: ny,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: (Math.random() - 0.5) * 0.3,
                    size: Math.random() * 2 + 1,
                    pulse: Math.random() * Math.PI * 2
                });
            }

            // Generate Input Signal Bezier Curves (Fan Out from human source -> converge onto filter ellipse)
            // SỬA (23/09/2026, Giang gửi ảnh mẫu "uốn đúng như ảnh") — gốc đặt cp1 ở 35% quãng ngang
            // với độ toả ±0.35 stageH, cp2 = targetY -> các tia toả thành hình QUẠT/nêm, không có
            // "bụng" tròn rồi thắt cổ trước filter như ảnh. Thay bằng 4 hệ số (fit số từ ảnh mẫu, tính
            // theo filterPos.ry = R, D = khoảng ngang từ nguồn tới mép trái ellipse): tia NGOÀI CÙNG
            // xuất phát gần như dựng đứng (cp1 = 20% D, cao 1.95R), phình tối đa ~1.07R ở ~42% D, rồi
            // thắt dần và vào mép trái ellipse NẰM NGANG ở độ cao 0.65R (cp2 = 82% D, cùng độ cao
            // điểm cuối). Tia bên trong co tuyến tính theo `lane` (-1..1) -> mật độ đều trong bụng.
            // Điểm cuối nằm ĐÚNG trên viền ellipse (gốc: lọt vào trong 0.5 rx).
            const IN_CP1_X = 0.2, IN_CP1_Y = 1.95, IN_CP2_X = 0.82, IN_END_Y = 0.65;
            for (let i = 0; i < config.signalCount; i++) {
                let lane = (i / (config.signalCount - 1)) * 2 - 1; // -1 (trên) .. 1 (dưới)
                let endYRel = lane * IN_END_Y; // tỉ lệ theo ry
                let targetY = filterPos.y + endYRel * filterPos.ry;
                let targetX = filterPos.x - filterPos.rx * Math.sqrt(Math.max(0, 1 - endYRel * endYRel));
                let D = targetX - leftPersonPos.x;

                let cp1x = leftPersonPos.x + D * IN_CP1_X;
                let cp1y = leftPersonPos.y + lane * IN_CP1_Y * filterPos.ry;
                let cp2x = leftPersonPos.x + D * IN_CP2_X;
                let cp2y = targetY;

                inputPaths.push({
                    p0: { x: leftPersonPos.x, y: leftPersonPos.y },
                    p1: { x: cp1x, y: cp1y },
                    p2: { x: cp2x, y: cp2y },
                    p3: { x: targetX, y: targetY },
                    alpha: Math.random() * 0.15 + 0.1
                });

                // Spawn initial floating particles on path
                particles.push(createParticle(i, true));
            }

            // Generate Output Curves (Only a few sparse events reach awareness!)
            // SỬA (23/09/2026, theo ảnh mẫu của Giang) — gốc: 7 đường cùng HỘI TỤ về 1 điểm
            // rightPersonPos, sóng ±0.08 stageH xen kẽ chiều -> các đường cắt chéo nhau. Ảnh mẫu: các
            // đường TOẢ NHẸ ra, song song, không cắt nhau, gợn S nhỏ, kết thúc ở các độ cao khác nhau
            // (±0.75 ry) và độ dài hơi lệch nhau. Sửa: đầu ±0.45 ry -> cuối ±0.75 ry theo `lane`,
            // cp1/cp2 ở 40%/60% quãng, sóng nhỏ ±0.025 stageH, điểm cuối lùi ngẫu nhiên tới 10% width.
            const outputCount = 7;
            for (let i = 0; i < outputCount; i++) {
                let lane = (i / (outputCount - 1)) * 2 - 1;
                let startY = filterPos.y + lane * 0.45 * filterPos.ry;
                let startX = filterPos.x + filterPos.rx * 0.4;
                let endX = rightPersonPos.x - Math.random() * width * 0.1;
                let endY = filterPos.y + lane * 0.75 * filterPos.ry;

                let waveFactor = (i % 2 === 0 ? 1 : -1) * (stageH * 0.025);
                let cp1x = startX + (endX - startX) * 0.4;
                let cp1y = startY + waveFactor;
                let cp2x = startX + (endX - startX) * 0.6;
                let cp2y = endY - waveFactor;

                outputPaths.push({
                    p0: { x: startX, y: startY },
                    p1: { x: cp1x, y: cp1y },
                    p2: { x: cp2x, y: cp2y },
                    p3: { x: endX, y: endY }
                });
            }
        }

        function createParticle(pathIndex, isInput = true) {
            return {
                pathIndex: pathIndex,
                isInput: isInput,
                t: Math.random(), // position along curve [0..1]
                speed: (Math.random() * 0.003 + 0.002),
                size: isInput ? Math.random() * 1.8 + 1 : Math.random() * 2.5 + 2,
                glow: isInput ? 3 : 8
            };
        }

        // Compute 2D Cubic Bezier point
        function getBezierPoint(p, t) {
            let cx = 3 * (p.p1.x - p.p0.x);
            let bx = 3 * (p.p2.x - p.p1.x) - cx;
            let ax = p.p3.x - p.p0.x - cx - bx;

            let cy = 3 * (p.p1.y - p.p0.y);
            let by = 3 * (p.p2.y - p.p1.y) - cy;
            let ay = p.p3.y - p.p0.y - cy - by;

            let xt = ax * Math.pow(t, 3) + bx * Math.pow(t, 2) + cx * t + p.p0.x;
            let yt = ay * Math.pow(t, 3) + by * Math.pow(t, 2) + cy * t + p.p0.y;

            return { x: xt, y: yt };
        }

        // SỬA (22/09/2026, yêu cầu Giang "loại bỏ mấy text của connector brain") — bỏ hẳn 3 khối
        // fillText() gốc (nhãn "1000000 INFORMATION SIGNALS" trái, "BRAIN FILTER" giữa, "ONLY A FEW
        // EVENTS REACH YOUR AWARENESS" phải) — điểm lệch THỨ HAI khỏi "verbatim, không tự đổi" ban
        // đầu (điểm đầu là màu, xem đầu file). Giữ nguyên trục thời gian dưới (đường đứt + mũi tên).
        // Đổi tên hàm cho khớp (không còn vẽ label nữa).
        //
        // SỬA TIẾP (22/09/2026, thiết kế lại theo Giang — xem khối TIMELINE_* đầu file) — vẽ dãy
        // `TIMELINE_DOT_COUNT` dot đều nhau dọc trục, cụm dot (nếu có) phồng + sáng theo năng lượng
        // dải tần riêng từng dot trong cụm (tái dùng computeNeuronBinEnergy(), core/visualizer/
        // groups/connector/synapse.js).
        //
        // SỬA (22/09/2026, Giang báo "dot scale dạng sóng cũng chẳng mượt") — 2 nguồn giật:
        // (1) `withinCluster` TRƯỚC làm tròn số nguyên -> dot lân cận BẬT/TẮT dải tần đột ngột mỗi khi
        //     cụm dịch qua ranh giới .5 (dù vị trí cụm tự nó đã nội suy mượt); SỬA: nội suy TUYẾN TÍNH
        //     giữa 2 dải tần liền kề theo đúng vị trí thực (số thực) thay vì chọn cứng 1 dải.
        // (2) `computeNeuronBinEnergy()` trả giá trị FFT THÔ của ĐÚNG frame đó, không có làm mượt theo
        //     thời gian (khác các effect khác vốn dựa vào `analyser.smoothingTimeConstant` sẵn có ở
        //     tầng Web Audio) -> nhảy giữa các frame liên tiếp. SỬA: thêm `timelineDotSmoothed` (EMA,
        //     alpha `TIMELINE_DOT_SMOOTH_ALPHA`) cho ĐỘ PHỒNG cuối cùng của từng dot, giữ nguyên qua
        //     các frame — đúng kỹ thuật smoothing tiêu chuẩn cho audio-reactive visual (tránh giật do
        //     nhiễu FFT thô, xem energyOnsets/spectral-flux + EMA display value ở các lib phổ biến).
        function drawTimeline(time, lastBeatTime, smoothedEnergy, vizDataArray, bufferLength, midiNote) {
            ctx.save();

            _updateTimelineClusters(time, lastBeatTime, smoothedEnergy, midiNote);

            // Bottom Axis Timeline Line
            let axisY = stageOffsetY + stageH * 0.88;
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(leftPersonPos.x, axisY);
            ctx.lineTo(rightPersonPos.x, axisY);
            ctx.stroke();
            ctx.setLineDash([]); // reset line dash

            // Mỗi cụm đang hoạt động: tính TRƯỚC vị trí + năng lượng dải tần riêng từng dot trong cụm
            // (1 lần/cụm/frame — tránh gọi computeNeuronBinEnergy() lặp lại cho từng dot ở vòng dưới).
            const activeClusters = [];
            for (let c = 0; c < timelineClusters.length; c++) {
                const cluster = timelineClusters[c];
                const t = (time - cluster.startTime) / TIMELINE_CLUSTER_TRAVEL_MS;
                if (t < 0 || t > 1) continue;
                const binEnergies = [];
                for (let k = 0; k < cluster.clusterSize; k++) {
                    binEnergies.push(computeNeuronBinEnergy(vizDataArray, bufferLength, k, cluster.clusterSize) / 255); // core/visualizer/groups/connector/synapse.js
                }
                activeClusters.push({ startDotIndex: t * cluster.travelDots, clusterSize: cluster.clusterSize, binEnergies });
            }

            // Dãy dot dọc trục — dot nằm trong 1 cụm đang hoạt động thì phồng + sáng theo năng lượng
            // dải tần riêng của chính nó trong cụm đó (nội suy mượt giữa 2 dải liền kề); dot khác giữ
            // nguyên baseline xám cố định. Độ phồng cuối cùng qua EMA (timelineDotSmoothed) trước khi
            // vẽ — không vẽ thẳng giá trị thô của frame này.
            // SỬA (22/09/2026, crash "null is not an object (evaluating 'primary.glow')") — TRƯỚC chỉ
            // lấy màu khi `activeClusters.length > 0`, nhưng `boost` là giá trị ĐÃ LÀM MƯỢT (EMA,
            // timelineDotSmoothed) nên vẫn > 0 vài frame SAU KHI cụm đã bị dọn khỏi mảng (đang decay
            // dần về 0) — `primary` lúc đó là null nhưng vòng dưới vẫn cố đọc `primary.glow`. Sửa:
            // luôn lấy màu (getBrainRoleColor() rẻ, không cần tối ưu bỏ qua).
            const primary = getBrainRoleColor(0);
            for (let i = 0; i < TIMELINE_DOT_COUNT; i++) {
                const dx = leftPersonPos.x + (i / (TIMELINE_DOT_COUNT - 1)) * (rightPersonPos.x - leftPersonPos.x);
                let targetBoost = 0; // MAX qua mọi cụm — không cộng dồn, tránh phồng quá đà khi nhiều cụm chồng nhau
                for (let c = 0; c < activeClusters.length; c++) {
                    const ac = activeClusters[c];
                    const coverage = _clusterCoverage(i, ac.startDotIndex, ac.clusterSize);
                    if (coverage <= 0) continue;
                    const rel = i - ac.startDotIndex; // vị trí dot trong cụm — số thực, không làm tròn
                    const idxLow = Math.min(ac.clusterSize - 1, Math.max(0, Math.floor(rel)));
                    const idxHigh = Math.min(ac.clusterSize - 1, idxLow + 1);
                    const frac = rel - Math.floor(rel);
                    const energyHere = ac.binEnergies[idxLow] + (ac.binEnergies[idxHigh] - ac.binEnergies[idxLow]) * frac; // nội suy tuyến tính giữa 2 dải tần liền kề
                    targetBoost = Math.max(targetBoost, coverage * energyHere);
                }
                timelineDotSmoothed[i] += (targetBoost - timelineDotSmoothed[i]) * TIMELINE_DOT_SMOOTH_ALPHA; // EMA — chặn giật frame-to-frame
                const boost = timelineDotSmoothed[i];

                ctx.beginPath();
                ctx.arc(dx, axisY, timelineDotBaseRadius + boost * (timelineDotMaxRadius - timelineDotBaseRadius), 0, Math.PI * 2);
                if (boost > 0.02) {
                    ctx.fillStyle = primary.glow;
                    ctx.shadowColor = primary.glow;
                    ctx.shadowBlur = 6 * boost;
                } else {
                    ctx.fillStyle = '#94a3b8';
                    ctx.shadowBlur = 0;
                }
                ctx.fill();
            }
            ctx.shadowBlur = 0;

            // Right Arrow head on Timeline
            ctx.beginPath();
            ctx.moveTo(rightPersonPos.x - 6, axisY - 4);
            ctx.lineTo(rightPersonPos.x, axisY);
            ctx.lineTo(rightPersonPos.x - 6, axisY + 4);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.restore();
        }

        function drawBrainFilter(time) {
            const primary = getBrainRoleColor(0);
            const secondary = getBrainRoleColor(1);
            ctx.save();

            // 1. Outer Glowing Ellipse Aura
            ctx.beginPath();
            ctx.ellipse(filterPos.x, filterPos.y, filterPos.rx, filterPos.ry, 0, 0, Math.PI * 2);
            ctx.strokeStyle = primary.fill;
            ctx.lineWidth = 3;
            ctx.shadowColor = primary.glow;
            ctx.shadowBlur = 20;
            ctx.stroke();

            // Secondary subtle outer ring
            ctx.beginPath();
            ctx.ellipse(filterPos.x, filterPos.y, filterPos.rx * 1.08, filterPos.ry * 1.05, 0, 0, Math.PI * 2);
            ctx.strokeStyle = secondary.fill;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.4 + Math.sin(time * 0.003) * 0.2;
            ctx.stroke();

            // Fill Ellipse background gradient
            let fillGrad = ctx.createRadialGradient(
                filterPos.x, filterPos.y, 5,
                filterPos.x, filterPos.y, filterPos.ry
            );
            fillGrad.addColorStop(0, 'rgba(15, 23, 42, 0.7)');
            fillGrad.addColorStop(0.8, 'rgba(30, 41, 59, 0.4)');
            fillGrad.addColorStop(1, 'rgba(56, 189, 248, 0.05)');
            ctx.fillStyle = fillGrad;
            ctx.fill();

            // 2. Draw Connections between internal filter nodes (Neural Mesh)
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = primary.fill;
            ctx.lineWidth = 0.8;
            for (let i = 0; i < filterNodes.length; i++) {
                for (let j = i + 1; j < filterNodes.length; j++) {
                    let dx = filterNodes[i].x - filterNodes[j].x;
                    let dy = filterNodes[i].y - filterNodes[j].y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < filterPos.rx * 0.75) {
                        ctx.beginPath();
                        ctx.moveTo(filterNodes[i].x, filterNodes[i].y);
                        ctx.lineTo(filterNodes[j].x, filterNodes[j].y);
                        ctx.stroke();
                    }
                }
            }

            // 3. Update & Draw Neural Filter Nodes
            ctx.globalAlpha = 0.9;
            filterNodes.forEach(node => {
                // Slight floating motion
                node.pulse += 0.04;
                node.x = node.baseX + Math.sin(node.pulse) * 2;
                node.y = node.baseY + Math.cos(node.pulse) * 2;

                ctx.beginPath();
                ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
                ctx.fillStyle = primary.glow; // trước trắng cố định — nay theo màu app (Giang: "chuyển hết")
                ctx.shadowColor = primary.glow;
                ctx.shadowBlur = 6;
                ctx.fill();
            });

            ctx.restore();
        }

        function drawCurvesAndParticles(time) {
            const primary = getBrainRoleColor(0);
            const outputLine = getBrainRoleColor(2);

            // 1. Draw Dense Input Bezier Curves (Left -> Filter)
            ctx.save();
            inputPaths.forEach((path, idx) => {
                ctx.beginPath();
                ctx.moveTo(path.p0.x, path.p0.y);
                ctx.bezierCurveTo(path.p1.x, path.p1.y, path.p2.x, path.p2.y, path.p3.x, path.p3.y);
                ctx.strokeStyle = primary.fill;
                ctx.globalAlpha = path.alpha;
                ctx.lineWidth = 1;
                ctx.stroke();
            });
            ctx.restore();

            // 2. Draw Sparse Output Bezier Curves (Filter -> Right)
            ctx.save();
            outputPaths.forEach(path => {
                ctx.beginPath();
                ctx.moveTo(path.p0.x, path.p0.y);
                ctx.bezierCurveTo(path.p1.x, path.p1.y, path.p2.x, path.p2.y, path.p3.x, path.p3.y);
                ctx.strokeStyle = outputLine.fill;
                ctx.globalAlpha = 0.65;
                ctx.lineWidth = 2;
                ctx.shadowColor = outputLine.glow;
                ctx.shadowBlur = 8;
                ctx.stroke();
            });
            ctx.restore();

            // 3. Update & Render Flowing Particles
            ctx.save();
            for (let i = particles.length - 1; i >= 0; i--) {
                let p = particles[i];
                if (!isPaused) {
                    p.t += p.speed * config.speedMultiplier;
                }

                if (p.isInput) {
                    let path = inputPaths[p.pathIndex];
                    if (!path) continue;

                    let pt = getBezierPoint(path, p.t);

                    // Render input particle
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = primary.glow; // trước currentTheme.particle (trắng cố định ở cả 3 theme gốc)
                    ctx.shadowColor = primary.glow;
                    ctx.shadowBlur = p.glow;
                    ctx.globalAlpha = Math.sin(p.t * Math.PI); // Smooth fade-in/fade-out
                    ctx.fill();

                    // When particle hits the Brain Filter boundary (t >= 1)
                    if (p.t >= 1) {
                        // Filter logic: strictness determines how many get blocked
                        let passFilter = Math.random() > config.filterStrictness;

                        if (passFilter) {
                            // Passed through brain filter! Spawn output particle
                            let randomOutIdx = Math.floor(Math.random() * outputPaths.length);
                            particles.push({
                                pathIndex: randomOutIdx,
                                isInput: false,
                                t: 0,
                                speed: Math.random() * 0.004 + 0.003,
                                size: 2.8,
                                glow: 12
                            });
                        } else {
                            // Dissolved/Filtered out! Spawn micro burst spark
                            bursts.push({
                                x: pt.x,
                                y: pt.y,
                                radius: Math.random() * 4 + 2,
                                alpha: 0.8,
                                color: primary.glow
                            });
                        }

                        // Reset input particle to start again
                        p.t = 0;
                        p.speed = Math.random() * 0.003 + 0.002;
                    }
                } else {
                    // Output Particle moving towards right awareness
                    let path = outputPaths[p.pathIndex];
                    if (!path) continue;

                    let pt = getBezierPoint(path, p.t);

                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = outputLine.glow; // trước trắng cố định — nay theo màu app
                    ctx.shadowColor = outputLine.glow;
                    ctx.shadowBlur = p.glow;
                    ctx.globalAlpha = Math.sin(p.t * Math.PI);
                    ctx.fill();

                    if (p.t >= 1) {
                        // Reached awareness figure!
                        particles.splice(i, 1);
                    }
                }
            }
            ctx.restore();

            // 4. Render Dissolve Spark Bursts at Filter Wall
            ctx.save();
            for (let b = bursts.length - 1; b >= 0; b--) {
                let burst = bursts[b];
                ctx.beginPath();
                ctx.arc(burst.x, burst.y, burst.radius, 0, Math.PI * 2);
                ctx.fillStyle = burst.color;
                ctx.globalAlpha = burst.alpha;
                ctx.shadowColor = burst.color;
                ctx.shadowBlur = 6;
                ctx.fill();

                if (!isPaused) {
                    burst.radius += 0.3;
                    burst.alpha -= 0.06;
                }

                if (burst.alpha <= 0) {
                    bursts.splice(b, 1);
                }
            }
            ctx.restore();
        }
        // Interactive Signal Burst on Click or Touch
        function triggerBurst(clickX, clickY) {
            // Spawn temporary burst of signals from left person
            for (let i = 0; i < 25; i++) {
                let randomInputIdx = Math.floor(Math.random() * inputPaths.length);
                particles.push({
                    pathIndex: randomInputIdx,
                    isInput: true,
                    t: 0,
                    speed: Math.random() * 0.008 + 0.005,
                    size: Math.random() * 2.5 + 1.5,
                    glow: 8
                });
            }
        }

        // ===== Phần KEO (không có trong gốc) =====
        let _lastW = 0, _lastH = 0;

        // Thân = phần tính vị trí của resizeCanvas() gốc (nguyên văn), chỉ bỏ dòng set canvas.width/height
        // vì SAV đã set kích thước canvas.
        function _layoutFromCanvas() {
            width = canvas.width;
            height = canvas.height;
            stageH = Math.min(height, width * BRAIN_STAGE_ASPECT);
            stageOffsetY = (height - stageH) / 2;

            // Compute positions based on dimensions
            leftPersonPos = { x: width * 0.07, y: stageOffsetY + stageH * 0.5 };
            rightPersonPos = { x: width * 0.93, y: stageOffsetY + stageH * 0.5 };

            const dotSpacing = (rightPersonPos.x - leftPersonPos.x) / (TIMELINE_DOT_COUNT - 1);
            timelineDotBaseRadius = dotSpacing * TIMELINE_DOT_BASE_RADIUS_FRAC;
            timelineDotMaxRadius = dotSpacing * TIMELINE_DOT_MAX_RADIUS_FRAC;

            filterPos = {
                x: width * 0.54,
                y: stageOffsetY + stageH * 0.5,
                rx: width * 0.045,
                ry: stageH * 0.32
            };

            initNodesAndPaths();
        }

        // Thay animate(time) gốc: bỏ clearRect (SAV đã clear) và requestAnimationFrame (SAV tự gọi mỗi frame).
        // Nhận thêm audio params (22/09/2026, dot trục thời gian) — Workflow tự đọc appState rồi
        // truyền vào (Rule 2, core không tự appState.get()), xem _tickConnectorBrain() ở
        // event/workflow/visualizer-render.js. `lastBeatTime` (thay `beatScale`, xem SỬA phía trên) —
        // mốc beat THẬT, đổi khác lần trước = vừa có 1 beat mới.
        function draw(ctxArg, canvasEl, time, lastBeatTime, smoothedEnergy, vizDataArray, bufferLength, midiNote) {
            ctx = ctxArg;
            canvas = canvasEl;
            if (canvas.width !== _lastW || canvas.height !== _lastH) {
                _lastW = canvas.width; _lastH = canvas.height;
                _layoutFromCanvas();
            }
            drawTimeline(time, lastBeatTime, smoothedEnergy, vizDataArray, bufferLength, midiNote);
            drawCurvesAndParticles(time);
            drawBrainFilter(time);
        }

        return { draw, triggerBurst };
})();
