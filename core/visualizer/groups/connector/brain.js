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
 *
 * SỬA (23/09/2026, yêu cầu Giang — node trong ellipse nhấp nháy theo audio) — điểm lệch THỨ NĂM:
 * node lưới thần kinh loé theo SPECTRAL FLUX TỪNG DẢI (phần TĂNG dương của năng lượng dải so với
 * frame trước), CỐ Ý khác đại lượng trục thời gian đang dùng (MỨC năng lượng dải) để 2 phần không
 * trùng lặp: âm ngân dài (pad/dây kéo) chỉ làm trục phồng, còn node chỉ loé đúng lúc có âm MỚI
 * đánh vào (trống/gảy/phụ âm) rồi tắt nhanh. Node xếp dải theo toạ độ y (đáy = bass, đỉnh =
 * treble). Chi tiết: khối `FILTER_FLUX_*` + `_updateFilterNodeFlux()`.
 *
 * SỬA (23/09/2026, yêu cầu Giang) — điểm lệch THỨ SÁU + BẢY:
 * (6) Tia input CO BÓP theo bass: `beatScale` (năng lượng dải bass thô mỗi frame) TRỪ 1 baseline
 *     chậm của chính nó (chỉ phần VỌT LÊN mới bóp — bass đều liên tục không làm bụng thắt cứng mãi),
 *     qua envelope attack nhanh/release chậm -> thắt bụng (hệ số cp1 dọc) tới PUMP_SQUEEZE_MAX.
 *     Khối `PUMP_*` + `_updateInputPump()`.
 * (7) Dot chạy quanh vòng phụ ellipse — CỐ Ý không dùng lastBeatTime/nốt nhạc/smoothedEnergy (trục
 *     thời gian đã dùng cả 3): tốc độ theo TEMPO (`currentCalculatedBpm` — BPM app tự tính sẵn,
 *     ORBIT_BEATS_PER_LAP beat / 1 vòng), độ sáng + cỡ dot theo SPECTRAL CENTROID (độ "sáng" âm sắc,
 *     tính từ vizDataArray). Khối `ORBIT_*` + `_updateOrbitDots()`/`drawOrbitDots()`.
 *
 * SỬA (23/09/2026, yêu cầu Giang) — điểm lệch THỨ TÁM → MƯỜI MỘT:
 * (8)  7 tia output = 7 DÂY ĐÀN ứng 7 nốt tự nhiên C D E F G A B (nốt thăng lấy nốt tự nhiên ngay
 *      dưới; C = dây dưới cùng, B = dây trên cùng). Nốt đang phát (`lastValidMidiNote`, còn "tươi")
 *      làm ĐÚNG dây của nó rung (sóng đứng, 2 đầu cố định, tắt dần đàn hồi) — biên độ theo năng lượng
 *      FFT ĐÚNG tần số nốt đó. Mỗi lần nốt MỚI xuất hiện (đổi nốt / nốt quay lại sau khoảng lặng) bắn
 *      1 đoàn dot chạy dọc dây: số dot theo QUÃNG (octave) của nốt, tốc độ theo BPM lúc bắn. Hạt
 *      output ngẫu nhiên gốc (hạt input lọt filter -> 1 hạt output) ĐÃ BỎ — hạt lọt filter giờ chỉ
 *      biến mất vào ellipse. Khối `STRING_*` + `_updateStrings()`/`drawOutputStrings()`.
 * (9)  `timelineShape` (Custom Effect): trục thời gian vẽ theo line / sinDown / sinUp / circle /
 *      square / triangle — toạ độ MÀN HÌNH, độc lập hoàn toàn với chiều brain filter.
 * (10) `brainDirection` (Custom Effect): ltr / rtl / ttb / btt — toàn bộ brain filter (tia input,
 *      ellipse, dây output, dot quanh ellipse) vẽ trong 1 KHUNG CỤC BỘ (dòng chảy luôn theo +x cục
 *      bộ, dài L, dày T = L × BRAIN_STAGE_ASPECT) rồi ctx.transform() xoay/lật ra màn hình — tỉ lệ
 *      1:1, KHÔNG co giãn. Chiều dọc được L lớn hơn (tận dụng màn hình portrait). Thay hẳn cơ chế
 *      stageH/stageOffsetY theo màn hình cũ (giờ stageH = T, stageOffsetY = 0 trong khung cục bộ).
 * (12) (23/09/2026, Giang "thêm hết custom effect + nối cái đã có") — mọi hằng số tinh chỉnh dạng
 *      `let` VIẾT HOA dưới đây chỉ là GIÁ TRỊ MẶC ĐỊNH, bị ghi đè MỖI FRAME từ Custom Effect qua
 *      `_applySettings(frame.settings)` (xem cuối file). Field connector sẵn có nay cũng nối vào
 *      brain: glowEnabled/glowIntensity -> hệ số `glowMult` nhân vào MỌI shadowBlur; fireThreshold ->
 *      ngưỡng nhiễu flux của node; lateralInhibitStrength -> dải loé đè bớt độ loé 2 dải kề nó.
 * (13) (23/09/2026, Giang báo "sóng dot chưa bao giờ vượt quá 50% trục") — nguyên nhân: quãng
 *      đường cụm = MIN + smoothedEnergy × (MAX − MIN) với MAX 0.7, mà smoothedEnergy là EMA của
 *      beatScale = TRUNG BÌNH 10% bin thấp nhất / 255 — trung bình nhiều bin nên thực tế chỉ quanh
 *      0.3–0.6, gần như không bao giờ chạm 1 -> quãng đường ~0.3–0.45 trục (+ vài dot bề rộng cụm).
 *      Sửa: chuẩn hoá smoothedEnergy theo ĐỈNH GẦN ĐÂY của chính nó (peak-hold tắt dần
 *      TIMELINE_ENERGY_PEAK_TAU_MS) trước khi tính quãng đường, và MAX thành Custom Effect (mặc
 *      định 90%) — đoạn nhạc to nhất so với vài giây gần đây sẽ chạy gần hết trục.
 * (11) Gap giữa brain filter và trục thời gian tăng lên BRAIN_TIMELINE_GAP_FRAC × min(W,H), tính
 *      theo mép NỘI DUNG thật (không phải mép khung) nên giữ đều ở mọi chiều. Xem `_layout()`.
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
        let TIMELINE_DOT_COUNT = 40;
        const TIMELINE_CLUSTER_TRAVEL_MS = 700; // thời gian cụm dịch hết quãng đường của nó
        const TIMELINE_CLUSTER_MIN_TRAVEL_FRAC = 0.15; // smoothedEnergy thấp -> cụm dịch tối thiểu 15% trục
        let TIMELINE_CLUSTER_MAX_TRAVEL_FRAC = 0.9;  // năng lượng (đã chuẩn hoá theo đỉnh gần đây) cao nhất -> tối đa 90% trục (Custom Effect)
        const TIMELINE_ENERGY_PEAK_TAU_MS = 4000;    // đỉnh smoothedEnergy tắt dần ~4s — mốc chuẩn hoá, xem điểm lệch (13) đầu file
        let _tlEnergyPeak = 0, _tlLastTime = 0;
        const TIMELINE_DOT_SMOOTH_ALPHA = 0.35; // EMA mỗi frame cho độ phồng từng dot — chặn giật do dữ liệu FFT thô, xem drawTimeline()
        let _lastSeenBeatTime = 0;
        let timelineClusters = []; // { startTime, clusterSize, travelDots }
        let timelineDotSmoothed = new Float32Array(TIMELINE_DOT_COUNT); // độ phồng ĐÃ LÀM MƯỢT từng dot, giữ nguyên qua các frame

        // SỬA (22/09/2026, Giang báo "dot bé quá chẳng thấy gì" rồi "to chả bà") — lần đầu đổi bán
        // kính sang tỉ lệ CỐ ĐỊNH theo `width` nhưng không đối chiếu với khoảng cách giữa 40 dot ->
        // dot baseline đã to hơn khoảng cách giữa 2 dot liền kề, chồng lên nhau thành 1 vệt đặc thay
        // vì dãy chấm rời — đúng nguyên nhân "to chả bà". Sửa ĐÚNG: tính bán kính theo TỈ LỆ của
        // chính khoảng cách giữa 2 dot (`dotSpacing`, tính ở _buildTimelineGeometry() — theo độ dài THẬT của hình trục) — luôn nhỏ hơn nửa
        // khoảng cách nên không bao giờ chồng lấn nhau dù đổi TIMELINE_DOT_COUNT hay kích thước màn
        // hình.
        const TIMELINE_DOT_BASE_RADIUS_FRAC = 0.22; // × dotSpacing — baseline lúc không có cụm
        const TIMELINE_DOT_MAX_RADIUS_FRAC = 0.48;   // × dotSpacing — lúc phồng hết cỡ (boost = 1)
        let timelineDotBaseRadius = 3, timelineDotMaxRadius = 7; // giá trị mặc định trước lần layout đầu — ghi đè ngay ở _buildTimelineGeometry()

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

            // SỬA (23/09/2026, điểm lệch 13) — đỉnh gần đây của smoothedEnergy (peak-hold tắt dần theo
            // dt thật) làm mốc chuẩn hoá: năng lượng tương đối 0-1 so với đoạn nhạc vừa qua.
            const dt = _tlLastTime ? Math.min(100, Math.max(0, time - _tlLastTime)) : 16;
            _tlLastTime = time;
            const e = isFinite(smoothedEnergy) ? smoothedEnergy : 0;
            _tlEnergyPeak = Math.max(e, _tlEnergyPeak * Math.exp(-dt / TIMELINE_ENERGY_PEAK_TAU_MS));

            if (isOnset) {
                _lastSeenBeatTime = lastBeatTime;
                const normEnergy = Math.min(1, e / Math.max(_tlEnergyPeak, 0.05));
                const maxFrac = Math.max(TIMELINE_CLUSTER_MIN_TRAVEL_FRAC, TIMELINE_CLUSTER_MAX_TRAVEL_FRAC);
                const travelFrac = TIMELINE_CLUSTER_MIN_TRAVEL_FRAC + normEnergy * (maxFrac - TIMELINE_CLUSTER_MIN_TRAVEL_FRAC);
                timelineClusters.push({
                    startTime: time,
                    clusterSize: _pitchToClusterSize(midiNote),
                    travelDots: travelFrac * (TIMELINE_DOT_COUNT - 1) // theo số KHOẢNG giữa các dot — 100% = dot đầu cụm tới đúng dot cuối
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

        // KEO (23/09/2026, Giang chốt "spectral flux theo dải" cho node trong ellipse) — node loé theo
        // độ TĂNG ĐỘT NGỘT năng lượng dải của chính nó (onset/transient), không theo mức năng lượng
        // (trục thời gian đã dùng mức — xem drawTimeline()). `FILTER_FLUX_BAND_COUNT` dải tonotopic
        // (log, tonotopicBinRange() qua computeNeuronBinEnergy(), core/visualizer/groups/connector/
        // synapse.js); node gán dải theo THỨ HẠNG baseY (chia đều số node mỗi dải — ellipse hẹp ở 2
        // đầu nên chia theo toạ độ thẳng sẽ lệch số node), đáy = dải 0 (bass), đỉnh = dải cao nhất.
        // KHÔNG dùng `previousSpectrumArray` của app: nó bị updateStatsDashboard() ghi đè bằng frame
        // hiện tại TRƯỚC khi brain vẽ (lệch = 0) -> tự giữ bản sao frame trước theo từng dải
        // (`filterBandPrev`). Loé: attack tức thì (lấy max), decay theo thời gian thật (hàm mũ,
        // FILTER_FLUX_DECAY_TAU_MS) — không phụ thuộc fps.
        const FILTER_FLUX_BAND_COUNT = 16;
        let FILTER_FLUX_NOISE_FLOOR = 0.02;  // flux (0-1) dưới mức này coi là nhiễu FFT, bỏ qua
        let FILTER_FLUX_GAIN = 5;            // (flux - noise floor) × gain -> độ loé mục tiêu, kẹp 0-1
        const FILTER_FLUX_DECAY_TAU_MS = 90;   // hằng số thời gian tắt — ~200ms thì gần như tắt hẳn
        let filterBandPrev = new Float32Array(FILTER_FLUX_BAND_COUNT);
        let filterBandFlash = new Float32Array(FILTER_FLUX_BAND_COUNT);
        let _filterBandTarget = new Float32Array(FILTER_FLUX_BAND_COUNT);
        let FILTER_LATERAL_K = 0.23; // 0-0.5 — lateralInhibitStrength (0-150) quy đổi, xem _applySettings()
        let _filterFluxPrimed = false; // frame đầu chỉ lấy baseline — tránh loé toàn bộ do lệch từ 0 lên
        let _filterFluxLastTime = 0;

        /** Mỗi frame: tính flux dương từng dải -> cập nhật độ loé từng dải (attack tức thì, decay
         * mũ theo dt thật). Chưa có dữ liệu FFT (audio context chưa init) thì chỉ decay dần. */
        function _updateFilterNodeFlux(time, vizDataArray, bufferLength) {
            const dt = _filterFluxLastTime ? Math.min(100, Math.max(0, time - _filterFluxLastTime)) : 16;
            _filterFluxLastTime = time;
            const decay = Math.exp(-dt / FILTER_FLUX_DECAY_TAU_MS);
            const hasData = !!(vizDataArray && bufferLength);

            for (let b = 0; b < FILTER_FLUX_BAND_COUNT; b++) {
                let target = 0;
                if (hasData) {
                    const cur = computeNeuronBinEnergy(vizDataArray, bufferLength, b, FILTER_FLUX_BAND_COUNT) / 255; // core/visualizer/groups/connector/synapse.js
                    if (_filterFluxPrimed) {
                        const flux = cur - filterBandPrev[b];
                        if (flux > FILTER_FLUX_NOISE_FLOOR) target = Math.min(1, (flux - FILTER_FLUX_NOISE_FLOOR) * FILTER_FLUX_GAIN);
                    }
                    filterBandPrev[b] = cur;
                }
                _filterBandTarget[b] = target;
            }
            // Lateral inhibition (23/09/2026 — nối field sẵn có lateralInhibitStrength): dải loé đè bớt
            // độ loé mục tiêu của 2 dải KỀ nó (tính trên mảng target GỐC, không dây chuyền) — tránh cả
            // cụm dải cùng loé vì 1 tiếng động phổ rộng, cùng tinh thần applyLateralInhibition() của synapse.
            for (let b = 0; b < FILTER_FLUX_BAND_COUNT; b++) {
                const left = b > 0 ? _filterBandTarget[b - 1] : 0;
                const right = b < FILTER_FLUX_BAND_COUNT - 1 ? _filterBandTarget[b + 1] : 0;
                const inhibited = Math.max(0, _filterBandTarget[b] - FILTER_LATERAL_K * Math.max(left, right));
                filterBandFlash[b] = Math.max(filterBandFlash[b] * decay, inhibited);
            }
            if (hasData) _filterFluxPrimed = true;
        }

        // KEO (23/09/2026) — hệ số hình dạng tia input (fit từ ảnh mẫu, xem initNodesAndPaths()) — đưa
        // ra scope ngoài vì _updateInputPump() cần IN_CP1_Y để tính lại cp1 mỗi frame.
        const IN_CP1_X = 0.2, IN_CP1_Y = 1.95, IN_CP2_X = 0.82, IN_END_Y = 0.65;

        // KEO (23/09/2026, Giang — tia input "co bóp") — xem điểm lệch (6) đầu file.
        const PUMP_BASELINE_TAU_MS = 800;  // baseline chậm của beatScale — mức bass "nền" hiện tại
        let PUMP_GAIN = 4;               // (beatScale - baseline) × gain -> lực bóp mục tiêu, kẹp 0-1
        const PUMP_ATTACK_TAU_MS = 40;     // bóp vào nhanh
        const PUMP_RELEASE_TAU_MS = 260;   // nhả ra chậm
        let PUMP_SQUEEZE_MAX = 0.22;     // bóp hết cỡ = bụng thắt 22%
        let pumpBaseline = 0, pumpEnvelope = 0, _pumpLastTime = 0;

        /** Mỗi frame: cập nhật envelope bóp rồi tính lại cp1.y của mọi tia input (hạt đang chạy
         * trên path nên tự đi theo hình mới). Không phát nhạc -> nhả dần về 0. */
        function _updateInputPump(time, beatScale, isPlaying) {
            const dt = _pumpLastTime ? Math.min(100, Math.max(0, time - _pumpLastTime)) : 16;
            _pumpLastTime = time;
            const level = isPlaying && isFinite(beatScale) ? beatScale : 0;
            pumpBaseline += (level - pumpBaseline) * (1 - Math.exp(-dt / PUMP_BASELINE_TAU_MS));
            const drive = Math.min(1, Math.max(0, (level - pumpBaseline) * PUMP_GAIN));
            const tau = drive > pumpEnvelope ? PUMP_ATTACK_TAU_MS : PUMP_RELEASE_TAU_MS;
            pumpEnvelope += (drive - pumpEnvelope) * (1 - Math.exp(-dt / tau));

            const bulbY = IN_CP1_Y * filterPos.ry * (1 - PUMP_SQUEEZE_MAX * pumpEnvelope);
            for (let i = 0; i < inputPaths.length; i++) {
                inputPaths[i].p1.y = leftPersonPos.y + inputPaths[i].lane * bulbY;
            }
        }

        // KEO (23/09/2026, Giang — dot chạy quanh ellipse) — xem điểm lệch (7) đầu file. Dot chạy trên
        // đúng vòng phụ (rx×1.08, ry×1.05) đã vẽ sẵn ở drawBrainFilter(), đều nhau, mỗi dot kéo đuôi
        // ORBIT_TRAIL_COUNT điểm mờ dần. Chưa có BPM ("---") -> ORBIT_FALLBACK_BPM. Tốc độ + centroid
        // đều làm mượt theo thời gian thật (không giật khi BPM nhảy số).
        let ORBIT_DOT_COUNT = 8;
        let ORBIT_BEATS_PER_LAP = 8;
        const ORBIT_FALLBACK_BPM = 90;
        const ORBIT_SPEED_TAU_MS = 500;
        let ORBIT_TRAIL_COUNT = 6;
        const ORBIT_TRAIL_STEP_RAD = 0.035;
        const ORBIT_CENTROID_LO = 0.5, ORBIT_CENTROID_HI = 0.85; // log-centroid thô -> 0-1 (âm trầm -> 0, âm sáng -> 1)
        const ORBIT_CENTROID_TAU_MS = 200;
        let orbitPhase = 0, orbitSpeed = 0, orbitCentroid = 0, _orbitLastTime = 0;

        /** Spectral centroid của khung FFT, quy về 0-1 theo thang log (bin trọng tâm / số bin). */
        function _computeCentroidNorm(vizDataArray, bufferLength) {
            if (!vizDataArray || !bufferLength) return 0;
            let sumV = 0, sumIV = 0;
            for (let i = 1; i < bufferLength; i++) { const v = vizDataArray[i]; sumV += v; sumIV += i * v; }
            if (sumV < bufferLength * 2) return 0; // gần như im lặng
            const logPos = Math.log2(1 + sumIV / sumV) / Math.log2(bufferLength);
            return Math.min(1, Math.max(0, (logPos - ORBIT_CENTROID_LO) / (ORBIT_CENTROID_HI - ORBIT_CENTROID_LO)));
        }

        function _updateOrbitDots(time, bpm, isPlaying, vizDataArray, bufferLength) {
            const dt = _orbitLastTime ? Math.min(100, Math.max(0, time - _orbitLastTime)) : 16;
            _orbitLastTime = time;
            const effBpm = isFinite(bpm) && bpm > 0 ? bpm : ORBIT_FALLBACK_BPM;
            const targetSpeed = isPlaying ? (Math.PI * 2) * (effBpm / 60000) / ORBIT_BEATS_PER_LAP : 0; // rad/ms
            orbitSpeed += (targetSpeed - orbitSpeed) * (1 - Math.exp(-dt / ORBIT_SPEED_TAU_MS));
            orbitPhase = (orbitPhase + orbitSpeed * dt) % (Math.PI * 2);
            const c = isPlaying ? _computeCentroidNorm(vizDataArray, bufferLength) : 0;
            orbitCentroid += (c - orbitCentroid) * (1 - Math.exp(-dt / ORBIT_CENTROID_TAU_MS));
        }

        function drawOrbitDots() {
            const primary = getBrainRoleColor(0);
            const orx = filterPos.rx * 1.08, ory = filterPos.ry * 1.05;
            const baseR = Math.max(1.5, filterPos.rx * 0.05) * (1 + orbitCentroid * 0.8);
            ctx.save();
            ctx.fillStyle = primary.glow;
            ctx.shadowColor = primary.glow;
            for (let d = 0; d < ORBIT_DOT_COUNT; d++) {
                const a0 = orbitPhase + d * (Math.PI * 2 / ORBIT_DOT_COUNT);
                for (let k = ORBIT_TRAIL_COUNT; k >= 0; k--) { // đuôi trước, đầu dot vẽ sau cùng (đè lên)
                    const a = a0 - k * ORBIT_TRAIL_STEP_RAD;
                    const fade = 1 - k / (ORBIT_TRAIL_COUNT + 1);
                    ctx.globalAlpha = (0.35 + 0.65 * orbitCentroid) * fade;
                    ctx.shadowBlur = (k === 0 ? 6 + orbitCentroid * 12 : 0) * glowMult;
                    ctx.beginPath();
                    ctx.arc(filterPos.x + Math.cos(a) * orx, filterPos.y + Math.sin(a) * ory, baseR * (0.4 + 0.6 * fade), 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
        }

        // KEO (23/09/2026, Giang — "7 dây = 7 nốt cơ bản") — xem điểm lệch (8) đầu file.
        const STRING_NATURAL_OF_PC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // pitch class -> C D E F G A B (thăng -> nốt tự nhiên ngay dưới)
        let STRING_AMP_MAX_FRAC = 0.045;     // biên độ rung tối đa × stageH (T)
        let STRING_DECAY_TAU_MS = 380;       // tắt dần đàn hồi sau khi nốt ngưng/đổi dây
        const STRING_ENERGY_GAIN = 1.3;        // năng lượng FFT tại tần số nốt (0-1) × gain -> biên độ mục tiêu, kẹp 0-1
        const STRING_VIB_HZ_BASE = 5;          // tần số rung (nhìn thấy) của dây C
        const STRING_VIB_HZ_STEP = 0.6;        // mỗi dây cao hơn rung nhanh hơn chút
        const STRING_SAMPLES = 48;             // số đoạn polyline khi vẽ 1 dây đang rung
        let STRING_DOT_BEATS_PER_RUN = 2;    // 1 dot chạy hết dây trong N beat (theo BPM lúc bắn)
        // SỬA (23/09/2026, Giang — "khoảng cách giữa các dot phải dựa trên tham số audio, không đều") —
        // bỏ khoảng cách cố định STRING_DOT_SPACING. Khoảng cách giữa dot j và j+1 theo PHỔ HOÀ ÂM của
        // nốt lúc bắn: năng lượng hoạ âm thứ (j+2) (tần số (j+2)·f0 — hoạ âm 2, 3, 4...), chuẩn hoá theo
        // hoạ âm mạnh nhất trong đoàn -> hoạ âm mạnh = cách xa, yếu = sát nhau. Mỗi nhạc cụ/giọng có
        // âm sắc khác nhau nên cùng 1 nốt ra "nhịp dot" khác nhau. Tham số này chưa phần nào dùng
        // (dây đã dùng: năng lượng nốt = biên độ rung, quãng = số dot, BPM = tốc độ). Khoảng cách tính
        // theo phân số ĐỘ DÀI dây (u 0-1). Min/max là Custom Effect.
        let STRING_DOT_GAP_MIN = 0.025;       // hoạ âm yếu nhất (hoặc không có) -> 2.5% độ dài dây
        let STRING_DOT_GAP_MAX = 0.1;         // hoạ âm mạnh nhất -> 10%
        const STRING_HARMONIC_SILENT = 0.02;  // cả đoàn đều dưới mức này -> coi như không có hoạ âm, dùng khoảng giữa
        // MỚI (23/09/2026, Giang — "co giãn liên tục trong lúc chạy") — bật `STRING_DOT_GAP_LIVE` thì mỗi
        // frame tính lại khoảng cách theo hoạ âm HIỆN TẠI của nốt của đoàn, rồi trượt dần tới đó:
        //  - EMA theo dt thật (STRING_GAP_SMOOTH_TAU_MS) — chặn giật do FFT thô;
        //  - mỗi frame 1 dot chỉ được lùi tối đa STRING_GAP_MAX_BACK × quãng đầu đoàn vừa tiến -> dot
        //    luôn còn đi TỚI (chậm lại/nhanh lên), không bao giờ chạy lùi;
        //  - dot đã chạm dot cuối thì khoá vị trí (không "hiện lại" trên dây), dot sau luôn cách dot
        //    trước ≥ nửa khoảng min (không chồng/vượt nhau).
        let STRING_DOT_GAP_LIVE = true;
        const STRING_GAP_SMOOTH_TAU_MS = 150;
        const STRING_GAP_MAX_BACK = 0.8;
        const STRING_DOT_MAX = 10;             // quãng -1..9 -> 1..10 dot
        const STRING_FALLBACK_BPM = 90;
        let stringAmp = new Float32Array(7);   // biên độ hiện tại (0-1) từng dây, index = outputPaths
        let stringTrains = [];                 // { stringIdx, startTime, count, runMs, arrived }
        let stringEndFlash = new Float32Array(7); // độ loé (0-1) dot cuối từng dây
        const STRING_END_FLASH_TAU_MS = 280;   // dot cuối tắt dần sau mỗi lần 1 dot chạm tới
        const STRING_END_DOT_RADIUS = 3.2;     // bán kính dot cuối lúc nghỉ (to lên tới 2× khi loé)
        let _stringPrevNote = null, _stringPrevFresh = false, _stringLastTime = 0;

        /** Năng lượng FFT (0-1) tại tần số `freq` — đỉnh của bin gần nhất ±1. Vượt dải FFT -> 0. */
        function _freqBinEnergy(freq, vizDataArray, bufferLength, sampleRate) {
            if (!vizDataArray || !bufferLength) return 0;
            const binWidth = (sampleRate || 44100) / (bufferLength * 2);
            const bin = Math.round(freq / binWidth);
            if (bin >= bufferLength) return 0;
            let peak = 0;
            for (let i = Math.max(0, bin - 1); i <= Math.min(bufferLength - 1, bin + 1); i++) peak = Math.max(peak, vizDataArray[i] || 0);
            return peak / 255;
        }

        /** Năng lượng FFT (0-1) tại đúng tần số nốt MIDI. */
        function _noteBinEnergy(midiNote, vizDataArray, bufferLength, sampleRate) {
            return _freqBinEnergy(440 * Math.pow(2, (midiNote - 69) / 12), vizDataArray, bufferLength, sampleRate);
        }

        /** Vị trí (phân số độ dài, lùi sau đầu đoàn) của từng dot trong đoàn: offsets[0] = 0, khoảng
         * cách j -> j+1 theo năng lượng hoạ âm (j+2) của nốt, chuẩn hoá theo hoạ âm mạnh nhất. */
        function _computeTrainOffsets(midiNote, count, frame) {
            const f0 = 440 * Math.pow(2, (midiNote - 69) / 12);
            const energies = [];
            let maxE = 0;
            for (let j = 0; j < count - 1; j++) {
                const e = _freqBinEnergy(f0 * (j + 2), frame.vizDataArray, frame.bufferLength, frame.sampleRate);
                energies.push(e);
                maxE = Math.max(maxE, e);
            }
            const gapMin = Math.min(STRING_DOT_GAP_MIN, STRING_DOT_GAP_MAX), gapMax = Math.max(STRING_DOT_GAP_MIN, STRING_DOT_GAP_MAX);
            const offsets = [0];
            for (let j = 0; j < energies.length; j++) {
                const rel = maxE < STRING_HARMONIC_SILENT ? 0.5 : energies[j] / maxE;
                offsets.push(offsets[j] + gapMin + rel * (gapMax - gapMin));
            }
            return offsets;
        }

        /** Mỗi frame: dây của nốt đang phát giữ biên độ = năng lượng nốt (lấy max với phần đang tắt
         * dần), mọi dây khác tắt dần đàn hồi. Nốt MỚI (đổi nốt / quay lại sau khi hết "tươi") -> bắn
         * 1 đoàn dot: số dot theo quãng, thời gian chạy hết dây theo BPM lúc bắn. */
        function _updateStrings(time, frame) {
            const dt = _stringLastTime ? Math.min(100, Math.max(0, time - _stringLastTime)) : 16;
            _stringLastTime = time;
            const decay = Math.exp(-dt / STRING_DECAY_TAU_MS);
            const midi = frame.midiNote;
            const fresh = !!frame.noteFresh && !!frame.isPlaying && midi !== null && midi !== undefined;
            let activeIdx = -1, targetAmp = 0;
            if (fresh && outputPaths.length === 7) {
                activeIdx = 6 - STRING_NATURAL_OF_PC[((midi % 12) + 12) % 12]; // C = dây dưới cùng (index 6)
                targetAmp = Math.min(1, _noteBinEnergy(midi, frame.vizDataArray, frame.bufferLength, frame.sampleRate) * STRING_ENERGY_GAIN);
                if (!_stringPrevFresh || midi !== _stringPrevNote) {
                    const octave = Math.floor(midi / 12) - 1; // -1..9
                    const bpm = isFinite(frame.bpm) && frame.bpm > 0 ? frame.bpm : STRING_FALLBACK_BPM;
                    const count = Math.min(STRING_DOT_MAX, Math.max(1, octave + 1));
                    stringTrains.push({
                        stringIdx: activeIdx,
                        startTime: time,
                        count,
                        midi, // nốt của đoàn — tính lại hoạ âm mỗi frame khi STRING_DOT_GAP_LIVE bật
                        offsets: _computeTrainOffsets(midi, count, frame), // khoảng cách theo hoạ âm, xem STRING_DOT_GAP_*
                        runMs: STRING_DOT_BEATS_PER_RUN * 60000 / bpm,
                        arrived: 0 // số dot đã chạm dot cuối dây
                    });
                }
            }
            _stringPrevFresh = fresh;
            _stringPrevNote = midi;
            for (let s = 0; s < stringAmp.length; s++) {
                stringAmp[s] = s === activeIdx ? Math.max(stringAmp[s] * decay, targetAmp) : stringAmp[s] * decay;
            }
            // Dot cuối dây (23/09/2026): mỗi dot của đoàn chạm cuối dây -> dot cuối loé lại (attack tức
            // thì), rồi tắt dần mũ theo dt thật. Đếm số dot ĐÃ tới đích để loé đúng 1 lần/dot.
            const endDecay = Math.exp(-dt / STRING_END_FLASH_TAU_MS);
            for (let s = 0; s < stringEndFlash.length; s++) stringEndFlash[s] *= endDecay;
            const gapAlpha = 1 - Math.exp(-dt / STRING_GAP_SMOOTH_TAU_MS);
            const halfMinGap = Math.min(STRING_DOT_GAP_MIN, STRING_DOT_GAP_MAX) * 0.5;
            for (let k = stringTrains.length - 1; k >= 0; k--) {
                const tr = stringTrains[k];
                const head = (time - tr.startTime) / tr.runMs;
                if (STRING_DOT_GAP_LIVE && tr.count > 1) {
                    const target = _computeTrainOffsets(tr.midi, tr.count, frame);
                    const maxBack = (dt / tr.runMs) * STRING_GAP_MAX_BACK; // offset tăng = dot lùi lại so với đầu đoàn
                    for (let j = Math.max(1, tr.arrived); j < tr.count; j++) {
                        let next = tr.offsets[j] + (target[j] - tr.offsets[j]) * gapAlpha;
                        next = Math.min(next, tr.offsets[j] + maxBack);
                        next = Math.max(next, tr.offsets[j - 1] + halfMinGap);
                        tr.offsets[j] = next;
                    }
                }
                let arrived = 0;
                while (arrived < tr.count && head - tr.offsets[arrived] >= 1) arrived++; // offsets tăng dần
                if (arrived > tr.arrived) { stringEndFlash[tr.stringIdx] = 1; tr.arrived = arrived; }
                if (head - tr.offsets[tr.count - 1] > 1) stringTrains.splice(k, 1);
            }
        }

        // SỬA (23/09/2026, Giang báo "các dot truyền vào có khoảng cách không giống nhau") — nguyên nhân:
        // dot chạy theo THAM SỐ t của bezier, mà t KHÔNG tỉ lệ với độ dài (dây có cp1/cp2 ở 40%/60%
        // quãng -> tốc độ theo t ở giữa dây chỉ ~0.75× ở 2 đầu) -> dot dồn lại ở giữa, giãn ra ở 2 đầu,
        // cả khoảng cách lẫn tốc độ đều lệch. Sửa: bảng tra độ dài cung (ARC_LUT_SAMPLES đoạn) cho mỗi
        // dây, dot tính theo phân số ĐỘ DÀI u (0-1) rồi đổi sang t — khoảng cách + tốc độ đều thật.
        const ARC_LUT_SAMPLES = 64;
        function _buildArcLengthLut(path) {
            const lut = new Float32Array(ARC_LUT_SAMPLES + 1);
            let prev = getBezierPoint(path, 0), total = 0;
            for (let k = 1; k <= ARC_LUT_SAMPLES; k++) {
                const pt = getBezierPoint(path, k / ARC_LUT_SAMPLES);
                total += Math.hypot(pt.x - prev.x, pt.y - prev.y);
                lut[k] = total;
                prev = pt;
            }
            for (let k = 1; k <= ARC_LUT_SAMPLES; k++) lut[k] /= total || 1;
            return lut;
        }
        /** Phân số độ dài u (0-1) -> tham số t của bezier (nội suy tuyến tính trong bảng). */
        function _arcToT(lut, u) {
            if (u <= 0) return 0;
            if (u >= 1) return 1;
            let lo = 0, hi = ARC_LUT_SAMPLES;
            while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (lut[mid] < u) lo = mid; else hi = mid; }
            const span = lut[hi] - lut[lo] || 1;
            return (lo + (u - lut[lo]) / span) / ARC_LUT_SAMPLES;
        }

        /** Điểm trên dây `s` tại t (0-1) kể cả độ rung: sóng đứng mode 1 (2 đầu cố định), lệch theo
         * y cục bộ (dây gần như nằm ngang trong khung cục bộ). */
        function _stringPointAt(s, t, time) {
            const pt = getBezierPoint(outputPaths[s], t);
            const hz = STRING_VIB_HZ_BASE + (6 - s) * STRING_VIB_HZ_STEP;
            pt.y += stringAmp[s] * stageH * STRING_AMP_MAX_FRAC * Math.sin(Math.PI * t) * Math.sin(time * 0.001 * Math.PI * 2 * hz);
            return pt;
        }

        function drawOutputStrings(time) {
            const outputLine = getBrainRoleColor(2);
            ctx.save();
            ctx.strokeStyle = outputLine.fill;
            ctx.shadowColor = outputLine.glow;
            for (let s = 0; s < outputPaths.length; s++) {
                const amp = stringAmp[s];
                ctx.beginPath();
                if (amp < 0.01) {
                    const path = outputPaths[s];
                    ctx.moveTo(path.p0.x, path.p0.y);
                    ctx.bezierCurveTo(path.p1.x, path.p1.y, path.p2.x, path.p2.y, path.p3.x, path.p3.y);
                } else {
                    for (let k = 0; k <= STRING_SAMPLES; k++) {
                        const pt = _stringPointAt(s, k / STRING_SAMPLES, time);
                        if (k === 0) ctx.moveTo(pt.x, pt.y); else ctx.lineTo(pt.x, pt.y);
                    }
                }
                ctx.globalAlpha = 0.65 + 0.35 * amp;
                ctx.lineWidth = 2 + amp * 1.5;
                ctx.shadowBlur = (8 + amp * 10) * glowMult;
                ctx.stroke();
            }

            // Đoàn dot chạy dọc dây (như hạt output gốc: size 2.8, glow 12). SỬA (23/09/2026): vị trí theo
            // phân số ĐỘ DÀI (u -> t qua bảng cung, khoảng cách đều); chỉ mờ dần ở ĐẦU dây, giữ sáng
            // tới khi chạm dot cuối (trước mờ dần cả 2 đầu — trông như tắt trước khi tới đích).
            ctx.fillStyle = outputLine.glow;
            ctx.shadowBlur = (12) * glowMult;
            for (let k = 0; k < stringTrains.length; k++) {
                const tr = stringTrains[k];
                const head = (time - tr.startTime) / tr.runMs;
                const lut = outputPaths[tr.stringIdx].arcLut;
                for (let j = 0; j < tr.count; j++) {
                    const u = head - tr.offsets[j];
                    if (u < 0 || u > 1) continue;
                    const pt = _stringPointAt(tr.stringIdx, _arcToT(lut, u), time);
                    ctx.globalAlpha = Math.min(1, u / 0.12);
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, 2.8, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            // Dot cuối mỗi dây (23/09/2026, theo ảnh mẫu) — nghỉ: mờ, nhỏ; mỗi dot tới nơi: loé to + glow.
            for (let s = 0; s < outputPaths.length; s++) {
                const end = outputPaths[s].p3; // điểm cuối cố định (sóng đứng = 0 ở 2 đầu)
                const flash = stringEndFlash[s];
                ctx.globalAlpha = 0.5 + 0.5 * flash;
                ctx.shadowBlur = (6 + flash * 20) * glowMult;
                ctx.beginPath();
                ctx.arc(end.x, end.y, STRING_END_DOT_RADIUS * (1 + flash), 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // KEO (23/09/2026, Giang — "chiều cho toàn bộ brain filter") — THAY cơ chế stageH/stageOffsetY
        // theo màn hình (22/09/2026) bằng KHUNG CỤC BỘ: mọi hình của brain filter tính trong khung dài
        // `width` (= L, chiều dòng chảy, luôn +x) × dày `stageH` (= T = L × BRAIN_STAGE_ASPECT, tỉ lệ
        // 16:9 của trang gốc), `stageOffsetY` = 0 — nên mọi công thức cũ `width * X`/`stageOffsetY +
        // stageH * X` GIỮ NGUYÊN nghĩa. Lúc vẽ: ctx.transform(brainMatrix) xoay/lật khung ra màn hình
        // (ma trận thuần xoay 90°/lật, tỉ lệ 1:1 -> không méo, lineWidth giữ đúng px). `height` = T.
        let width, height;
        const BRAIN_STAGE_ASPECT = 0.5625;
        let stageH = 0, stageOffsetY = 0;
        let leftPersonPos = { x: 0, y: 0 };
        let rightPersonPos = { x: 0, y: 0 };
        let filterPos = { x: 0, y: 0, rx: 0, ry: 0 };

        // [a, b, c, d] của ctx.transform(): x' = a·x + c·y + e, y' = b·x + d·y + f (e/f tính ở _layout()).
        const BRAIN_DIRECTION_MATRIX = {
            ltr: [1, 0, 0, 1],   // trái -> phải (gốc)
            rtl: [-1, 0, 0, 1],  // phải -> trái (lật ngang)
            ttb: [0, 1, -1, 0],  // trên -> dưới (+x cục bộ -> +y màn hình)
            btt: [0, -1, 1, 0],  // dưới -> trên (+x cục bộ -> -y màn hình)
        };
        // Vùng NỘI DUNG thật trong khung cục bộ (không phải cả khung): dọc dòng chảy 7%..93% L (2 điểm
        // nguồn/đích), ngang ±0.36 T quanh tâm (bụng tia input tối đa ~0.34 T, vòng phụ ellipse ~0.34 T).
        const BRAIN_CONTENT_X0 = 0.07, BRAIN_CONTENT_X1 = 0.93, BRAIN_CONTENT_HALF_T = 0.36;
        const BRAIN_LAYOUT_MARGIN_FRAC = 0.06;   // lề trên/dưới × H — chừa chỗ status bar/bottom player
        const BRAIN_TIMELINE_GAP_FRAC = 0.1;     // gap nội dung brain <-> trục thời gian × min(W,H) (Giang: "tăng gap")
        const BRAIN_MAX_WIDTH_FRAC = 0.86;       // bề ngang nội dung brain ≤ 86% W (ở mọi chiều)
        const BRAIN_MAX_LENGTH_FRAC = 0.8;       // L ≤ 80% cạnh dài màn hình — chiều dọc không phình quá cỡ
        let brainMatrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

        // KEO (23/09/2026, Giang — "shape cho trục thời gian") — hình trục, toạ độ MÀN HÌNH, đặt dưới
        // nội dung brain + gap. Open (line/sin): dot i ở u = i/(N-1), có mũi tên cuối. Closed (tròn/
        // vuông/tam giác): dot i ở u = i/N (không trùng điểm đầu-cuối), bắt đầu từ đỉnh, chạy theo
        // chiều kim đồng hồ, mũi tên tại điểm đầu chỉ chiều chạy.
        const TIMELINE_SHAPES = ['line', 'sinDown', 'sinUp', 'circle', 'square', 'triangle'];
        const TIMELINE_SIN_AMP_FRAC = 0.12;        // độ võng của cung sin × min(W,H)
        const TIMELINE_CLOSED_W_FRAC = 0.42;       // cỡ hình kín ≤ 42% W
        const TIMELINE_CLOSED_H_FRAC = 0.28;       //            ≤ 28% H
        const TIMELINE_PATH_SAMPLES = 240;
        let tlGeom = null;       // { shape, closed, left, right, top, amp, size, cx }
        let tlDots = [];         // [{x, y}] × TIMELINE_DOT_COUNT
        let tlPath = [];         // polyline để vẽ đường đứt
        let tlArrow = { x: 0, y: 0, angle: 0 };

        /** Điểm tại u (0-1) trên trục thời gian theo tlGeom. */
        function _timelinePointAt(u) {
            const g = tlGeom;
            const len = g.right - g.left;
            // SỬA (23/09/2026, Giang: "võng xuống/võng lên") — nửa chu kỳ sin (1 cung), không phải 1 sóng
            // trọn chu kỳ: sinDown võng xuống (2 đầu ở mép trên vùng trục), sinUp vồng lên (2 đầu ở mép dưới).
            if (g.shape === 'sinDown') return { x: g.left + u * len, y: g.top + g.amp * Math.sin(u * Math.PI) };
            if (g.shape === 'sinUp') return { x: g.left + u * len, y: g.top + g.amp - g.amp * Math.sin(u * Math.PI) };
            if (g.shape === 'circle') {
                const r = g.size / 2, a = -Math.PI / 2 + u * Math.PI * 2;
                return { x: g.cx + Math.cos(a) * r, y: g.top + r + Math.sin(a) * r };
            }
            if (g.shape === 'square') {
                const side = g.size, x0 = g.cx - side / 2, y0 = g.top;
                const s4 = Math.min(u, 0.99999) * 4, seg = Math.floor(s4), f = s4 - seg;
                if (seg === 0) return { x: x0 + f * side, y: y0 };
                if (seg === 1) return { x: x0 + side, y: y0 + f * side };
                if (seg === 2) return { x: x0 + side - f * side, y: y0 + side };
                return { x: x0, y: y0 + side - f * side };
            }
            if (g.shape === 'triangle') {
                const h = g.size, side = h * 2 / Math.sqrt(3);
                const v = [{ x: g.cx, y: g.top }, { x: g.cx + side / 2, y: g.top + h }, { x: g.cx - side / 2, y: g.top + h }];
                const s3 = Math.min(u, 0.99999) * 3, seg = Math.floor(s3), f = s3 - seg;
                const A = v[seg], B = v[(seg + 1) % 3];
                return { x: A.x + (B.x - A.x) * f, y: A.y + (B.y - A.y) * f };
            }
            return { x: g.left + u * len, y: g.top }; // line
        }

        /** Dựng hình trục (polyline + vị trí dot + mũi tên + bán kính dot theo khoảng cách dot). */
        function _buildTimelineGeometry() {
            tlPath = [];
            let pathLen = 0;
            for (let k = 0; k <= TIMELINE_PATH_SAMPLES; k++) {
                const pt = _timelinePointAt(k / TIMELINE_PATH_SAMPLES);
                if (k > 0) pathLen += Math.hypot(pt.x - tlPath[k - 1].x, pt.y - tlPath[k - 1].y);
                tlPath.push(pt);
            }
            const denom = tlGeom.closed ? TIMELINE_DOT_COUNT : TIMELINE_DOT_COUNT - 1;
            tlDots = [];
            for (let i = 0; i < TIMELINE_DOT_COUNT; i++) tlDots.push(_timelinePointAt(i / denom));
            const dotSpacing = pathLen / denom;
            timelineDotBaseRadius = dotSpacing * TIMELINE_DOT_BASE_RADIUS_FRAC;
            timelineDotMaxRadius = dotSpacing * TIMELINE_DOT_MAX_RADIUS_FRAC;
            const endPt = tlGeom.closed ? _timelinePointAt(0) : _timelinePointAt(1);
            const prevPt = _timelinePointAt(tlGeom.closed ? 0.995 : 0.985);
            tlArrow = { x: endPt.x, y: endPt.y, angle: Math.atan2(endPt.y - prevPt.y, endPt.x - prevPt.x) };
        }

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
                    pulse: Math.random() * Math.PI * 2,
                    band: 0 // gán ngay dưới theo thứ hạng baseY
                });
            }

            // KEO (23/09/2026) — gán dải tần theo thứ hạng baseY: node thấp nhất (y lớn nhất trên
            // canvas) = dải 0 (bass), cao nhất = dải cuối (treble), số node mỗi dải chia đều.
            const byY = filterNodes.slice().sort((a, b) => b.baseY - a.baseY);
            for (let k = 0; k < byY.length; k++) {
                byY[k].band = Math.min(FILTER_FLUX_BAND_COUNT - 1, Math.floor(k / byY.length * FILTER_FLUX_BAND_COUNT));
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
            // (4 hệ số IN_* khai ở scope ngoài — _updateInputPump() dùng lại IN_CP1_Y mỗi frame.)
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
                    alpha: Math.random() * 0.15 + 0.1,
                    lane: lane // _updateInputPump() tính lại p1.y theo lane mỗi frame
                });

                // Spawn initial floating particles on path
                particles.push(createParticle(i, true));
            }

            // Generate Output Curves (Only a few sparse events reach awareness!)
            // (23/09/2026) 7 đường này giờ là 7 DÂY ĐÀN C..B (dây 0 trên cùng = B, dây 6 dưới cùng = C) —
            // xem khối STRING_*. Hình dạng tĩnh giữ nguyên như dưới, rung được cộng thêm lúc vẽ.
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

                const outPath = {
                    p0: { x: startX, y: startY },
                    p1: { x: cp1x, y: cp1y },
                    p2: { x: cp2x, y: cp2y },
                    p3: { x: endX, y: endY }
                };
                outPath.arcLut = _buildArcLengthLut(outPath); // (23/09/2026) dot chạy đều theo độ dài thật, xem _arcToT()
                outputPaths.push(outPath);
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

            // Bottom Axis Timeline Line — SỬA (23/09/2026): vẽ theo polyline của hình trục đã chọn
            // (tlPath, _buildTimelineGeometry()), hình kín thì khép đường.
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(tlPath[0].x, tlPath[0].y);
            for (let k = 1; k < tlPath.length; k++) ctx.lineTo(tlPath[k].x, tlPath[k].y);
            if (tlGeom.closed) ctx.closePath();
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
                const dotPt = tlDots[i]; // vị trí dot trên hình trục (23/09/2026)
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
                ctx.arc(dotPt.x, dotPt.y, timelineDotBaseRadius + boost * (timelineDotMaxRadius - timelineDotBaseRadius), 0, Math.PI * 2);
                if (boost > 0.02) {
                    ctx.fillStyle = primary.glow;
                    ctx.shadowColor = primary.glow;
                    ctx.shadowBlur = (6 * boost) * glowMult;
                } else {
                    ctx.fillStyle = '#94a3b8';
                    ctx.shadowBlur = 0;
                }
                ctx.fill();
            }
            ctx.shadowBlur = 0;

            // Right Arrow head on Timeline — SỬA (23/09/2026): đặt ở điểm cuối (hình kín: điểm đầu),
            // xoay theo tiếp tuyến của hình trục (tlArrow).
            ctx.translate(tlArrow.x, tlArrow.y);
            ctx.rotate(tlArrow.angle);
            ctx.beginPath();
            ctx.moveTo(-6, -4);
            ctx.lineTo(0, 0);
            ctx.lineTo(-6, 4);
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
            ctx.shadowBlur = (20) * glowMult;
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

            // (23/09/2026) Custom Effect "lưới node" tắt -> bỏ vẽ cả đường nối lẫn node (vẫn giữ ellipse).
            if (SHOW_NODES) {
            // 2. Draw Connections between internal filter nodes (Neural Mesh)
            // SỬA (23/09/2026) — alpha từng đường: nền 0.35 như gốc, sáng thêm theo độ loé của node
            // YẾU hơn trong 2 đầu (chỉ sáng hẳn khi CẢ 2 node cùng loé — tránh cả lưới bừng lên vì 1 node).
            ctx.strokeStyle = primary.fill;
            ctx.lineWidth = 0.8;
            for (let i = 0; i < filterNodes.length; i++) {
                for (let j = i + 1; j < filterNodes.length; j++) {
                    let dx = filterNodes[i].x - filterNodes[j].x;
                    let dy = filterNodes[i].y - filterNodes[j].y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < filterPos.rx * 0.75) {
                        ctx.globalAlpha = 0.35 + 0.55 * Math.min(filterBandFlash[filterNodes[i].band], filterBandFlash[filterNodes[j].band]);
                        ctx.beginPath();
                        ctx.moveTo(filterNodes[i].x, filterNodes[i].y);
                        ctx.lineTo(filterNodes[j].x, filterNodes[j].y);
                        ctx.stroke();
                    }
                }
            }

            // 3. Update & Draw Neural Filter Nodes
            // SỬA (23/09/2026) — loé theo spectral flux dải của node (filterBandFlash): nghỉ mờ hơn gốc
            // (alpha 0.55 thay 0.9 cố định — cần độ tương phản để thấy nhấp nháy), loé thì alpha 1,
            // bán kính to tới 2.2×, glow 6 -> 20.
            filterNodes.forEach(node => {
                // Slight floating motion
                node.pulse += 0.04;
                node.x = node.baseX + Math.sin(node.pulse) * 2;
                node.y = node.baseY + Math.cos(node.pulse) * 2;

                const flash = filterBandFlash[node.band];
                ctx.globalAlpha = 0.55 + 0.45 * flash;
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.size * (1 + flash * 1.2), 0, Math.PI * 2);
                ctx.fillStyle = primary.glow; // trước trắng cố định — nay theo màu app (Giang: "chuyển hết")
                ctx.shadowColor = primary.glow;
                ctx.shadowBlur = (6 + flash * 14) * glowMult;
                ctx.fill();
            });
            } // SHOW_NODES

            ctx.restore();
        }

        function drawCurvesAndParticles(time) {
            const primary = getBrainRoleColor(0);

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

            // 2. (23/09/2026) Tia output giờ là 7 dây đàn — vẽ ở drawOutputStrings() (rung + dot theo nốt).

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
                    ctx.shadowBlur = (p.glow) * glowMult;
                    ctx.globalAlpha = Math.sin(p.t * Math.PI); // Smooth fade-in/fade-out
                    ctx.fill();

                    // When particle hits the Brain Filter boundary (t >= 1)
                    if (p.t >= 1) {
                        // Filter logic: strictness determines how many get blocked
                        let passFilter = Math.random() > config.filterStrictness;

                        // SỬA (23/09/2026) — hạt LỌT filter không còn sinh hạt output ngẫu nhiên nữa (dot
                        // trên 7 dây output giờ do nốt nhạc bắn, xem _updateStrings()) — chỉ biến mất vào
                        // ellipse. Hạt BỊ CHẶN vẫn loé tia lửa như gốc.
                        if (!passFilter) {
                            // Dissolved/Filtered out! Spawn micro burst spark
                            bursts.push({
                                x: pt.x,
                                y: pt.y,
                                radius: Math.random() * 4 + 2,
                                alpha: 0.8,
                                color: primary.glow
                            });
                        }

                        // SỬA (23/09/2026) — hạt do triggerBurst() sinh (oneShot) chạy 1 lần rồi BỎ, không
                        // reset như hạt nền — gốc reset cả hạt burst nên mỗi lần bấm là tăng vĩnh viễn số
                        // hạt; nay burst tự bắn theo Music Transition nên phải dọn, không thì phình mãi.
                        if (p.oneShot) {
                            particles.splice(i, 1);
                            continue;
                        }
                        // Reset input particle to start again
                        p.t = 0;
                        p.speed = Math.random() * 0.003 + 0.002;
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
                ctx.shadowBlur = (6) * glowMult;
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
        // (23/09/2026) Giờ gọi tự động khi nhạc chuyển đoạn (detectMusicTransition()) — Workflow
        // _tickConnectorBrain(), event/workflow/visualizer-render.js, toggle `burstEnabled`.
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
                    glow: 8,
                    oneShot: true // (23/09/2026) chạy 1 lần rồi bỏ — xem vòng hạt ở drawCurvesAndParticles()
                });
            }
        }

        // ===== Phần KEO (không có trong gốc) =====

        /** Layout (23/09/2026 — thay _layoutFromCanvas() cũ): tính L theo chiều + chỗ trống thật, đặt
         * nội dung brain + gap + trục thời gian thành 1 khối căn giữa dọc màn hình, dựng ma trận
         * khung cục bộ -> màn hình. Phần tính vị trí trong khung cục bộ (leftPersonPos/filterPos...)
         * GIỮ NGUYÊN công thức resizeCanvas() gốc. */
        function _layout(direction, shape) {
            const W = canvas.width, H = canvas.height, minWH = Math.min(W, H);
            const dir = BRAIN_DIRECTION_MATRIX[direction] ? direction : 'ltr';
            const shp = TIMELINE_SHAPES.includes(shape) ? shape : 'line';
            const isVertical = dir === 'ttb' || dir === 'btt';
            const closed = shp === 'circle' || shp === 'square' || shp === 'triangle';

            // Vùng trục thời gian (màn hình)
            let tlH = 0, amp = 0, size = 0;
            if (shp === 'sinDown' || shp === 'sinUp') { amp = minWH * TIMELINE_SIN_AMP_FRAC; tlH = amp; }
            else if (closed) {
                size = Math.min(W * TIMELINE_CLOSED_W_FRAC, H * TIMELINE_CLOSED_H_FRAC);
                if (shp === 'triangle') size = Math.min(size, W * TIMELINE_CLOSED_W_FRAC * Math.sqrt(3) / 2); // cạnh đáy ≤ giới hạn bề ngang
                tlH = size;
            }
            if (!SHOW_TIMELINE) tlH = 0; // (23/09/2026) trục tắt -> brain căn giữa một mình, không chừa gap
            const gap = SHOW_TIMELINE ? minWH * BRAIN_TIMELINE_GAP_FRAC : 0;
            const availH = Math.max(1, H - 2 * H * BRAIN_LAYOUT_MARGIN_FRAC - gap - tlH);

            // Kích thước nội dung brain trên màn hình tính theo L
            const alongK = BRAIN_CONTENT_X1 - BRAIN_CONTENT_X0;
            const crossK = 2 * BRAIN_CONTENT_HALF_T * BRAIN_STAGE_ASPECT;
            const kW = isVertical ? crossK : alongK, kH = isVertical ? alongK : crossK;
            const L = Math.max(1, Math.min(W * BRAIN_MAX_WIDTH_FRAC / kW, availH / kH, Math.max(W, H) * BRAIN_MAX_LENGTH_FRAC));
            const contentW = kW * L, contentH = kH * L;
            const top = (H - (contentH + gap + tlH)) / 2;

            // Khung cục bộ
            width = L;
            height = stageH = L * BRAIN_STAGE_ASPECT;
            stageOffsetY = 0;

            // Ma trận: map 4 góc vùng nội dung (e=f=0) -> lấy góc min rồi tịnh tiến về đúng chỗ
            const [a, b, c, d] = BRAIN_DIRECTION_MATRIX[dir];
            const xs = [BRAIN_CONTENT_X0 * L, BRAIN_CONTENT_X1 * L];
            const ys = [stageH * (0.5 - BRAIN_CONTENT_HALF_T), stageH * (0.5 + BRAIN_CONTENT_HALF_T)];
            let minX = Infinity, minY = Infinity;
            xs.forEach((x) => ys.forEach((y) => {
                minX = Math.min(minX, a * x + c * y);
                minY = Math.min(minY, b * x + d * y);
            }));
            brainMatrix = { a, b, c, d, e: (W - contentW) / 2 - minX, f: top - minY };

            // Compute positions based on dimensions (khung cục bộ — công thức gốc)
            leftPersonPos = { x: width * 0.07, y: stageOffsetY + stageH * 0.5 };
            rightPersonPos = { x: width * 0.93, y: stageOffsetY + stageH * 0.5 };
            filterPos = {
                x: width * 0.54,
                y: stageOffsetY + stageH * 0.5,
                rx: width * 0.045,
                ry: stageH * 0.32
            };
            initNodesAndPaths();

            // Trục thời gian (màn hình)
            tlGeom = { shape: shp, closed, left: W * 0.07, right: W * 0.93, top: top + contentH + gap, amp, size, cx: W / 2 };
            _buildTimelineGeometry();
        }

        // Thay animate(time) gốc: bỏ clearRect (SAV đã clear) và requestAnimationFrame (SAV tự gọi mỗi frame).
        // ĐỔI (23/09/2026) — tham số audio/config gom vào 1 object `frame` (danh sách tham số rời đã quá
        // dài). Workflow (_tickConnectorBrain(), event/workflow/visualizer-render.js) tự đọc appState/
        // config rồi dựng object này (Rule 2 — core không appState.get()). Các field:
        //   time, lastBeatTime, smoothedEnergy, vizDataArray, bufferLength, midiNote, noteFresh,
        //   beatScale, isPlaying, bpm (số, NaN nếu chưa có), sampleRate, direction, timelineShape
        // KEO (23/09/2026, điểm lệch 12) — Custom Effect -> tham số. Mặc định trùng core/config.js
        // (DEFAULT_CUSTOM_EFFECT.connector), fallback lại chính giá trị hiện tại nếu field thiếu.
        let glowMult = 1;
        let SHOW_TIMELINE = true, SHOW_ORBIT = true, SHOW_NODES = true, SHOW_STRINGS = true;
        const _num = (v, fallback) => (typeof v === 'number' && isFinite(v) ? v : fallback);
        function _applySettings(st) {
            if (!st) return;
            glowMult = st.glowEnabled === false ? 0 : _num(st.glowIntensity, 100) / 100;
            FILTER_FLUX_NOISE_FLOOR = _num(st.fireThreshold, 0.55) * 0.04;          // 0-1 -> 0-0.04 flux
            FILTER_LATERAL_K = _num(st.lateralInhibitStrength, 70) / 150 * 0.5;     // 0-150 -> 0-0.5
            config.filterStrictness = _num(st.brainFilterStrictness, 0.98);
            config.speedMultiplier = _num(st.brainInputSpeed, 1.5);
            PUMP_SQUEEZE_MAX = _num(st.brainPumpSqueeze, 22) / 100;
            PUMP_GAIN = _num(st.brainPumpSensitivity, 4);
            FILTER_FLUX_GAIN = _num(st.brainNodeFlashSensitivity, 5);
            STRING_AMP_MAX_FRAC = 0.045 * _num(st.brainStringAmplitude, 100) / 100;
            STRING_DECAY_TAU_MS = _num(st.brainStringDecayMs, 380);
            STRING_DOT_BEATS_PER_RUN = _num(st.brainStringDotBeats, 2);
            STRING_DOT_GAP_MIN = _num(st.brainStringDotGapMin, 2.5) / 100;
            STRING_DOT_GAP_MAX = _num(st.brainStringDotGapMax, 10) / 100;
            STRING_DOT_GAP_LIVE = st.brainStringDotGapLive !== false;
            ORBIT_DOT_COUNT = Math.round(_num(st.brainOrbitDotCount, 8));
            ORBIT_BEATS_PER_LAP = _num(st.brainOrbitBeatsPerLap, 8);
            ORBIT_TRAIL_COUNT = Math.round(_num(st.brainOrbitTrail, 6));
            TIMELINE_CLUSTER_MAX_TRAVEL_FRAC = _num(st.brainTimelineMaxTravel, 90) / 100;
            SHOW_ORBIT = st.brainShowOrbit !== false;
            SHOW_NODES = st.brainShowNodes !== false;
            SHOW_STRINGS = st.brainShowStrings !== false;
            // 3 field dưới đổi HÌNH (số tia/số dot/bố cục) -> draw() so khoá layout, khác thì dựng lại
            config.signalCount = Math.round(_num(st.brainSignalCount, 120));
            const dotCount = Math.round(_num(st.brainTimelineDotCount, 40));
            if (dotCount !== TIMELINE_DOT_COUNT) {
                TIMELINE_DOT_COUNT = dotCount;
                timelineDotSmoothed = new Float32Array(TIMELINE_DOT_COUNT);
                timelineClusters = [];
            }
            SHOW_TIMELINE = st.brainShowTimeline !== false;
        }
        let _lastLayoutKey = '';

        // Thay animate(time) gốc: bỏ clearRect (SAV đã clear) và requestAnimationFrame (SAV tự gọi mỗi frame).
        // ĐỔI (23/09/2026) — tham số audio/config gom vào 1 object `frame` (danh sách tham số rời đã quá
        // dài). Workflow (_tickConnectorBrain(), event/workflow/visualizer-render.js) tự đọc appState/
        // config rồi dựng object này (Rule 2 — core không appState.get()). Các field:
        //   time, lastBeatTime, smoothedEnergy, vizDataArray, bufferLength, midiNote, noteFresh,
        //   beatScale, isPlaying, bpm (số, NaN nếu chưa có), sampleRate, direction, timelineShape,
        //   settings (object Custom Effect connector — xem _applySettings())
        function draw(ctxArg, canvasEl, frame) {
            ctx = ctxArg;
            canvas = canvasEl;
            _applySettings(frame.settings);
            const direction = frame.direction || 'ltr';
            const shape = frame.timelineShape || 'line';
            const layoutKey = [canvas.width, canvas.height, direction, shape, config.signalCount, TIMELINE_DOT_COUNT, SHOW_TIMELINE].join('|');
            if (layoutKey !== _lastLayoutKey) {
                _lastLayoutKey = layoutKey;
                _layout(direction, shape);
            }
            const time = frame.time;

            // Trục thời gian — toạ độ màn hình, KHÔNG qua ma trận chiều
            if (SHOW_TIMELINE) drawTimeline(time, frame.lastBeatTime, frame.smoothedEnergy, frame.vizDataArray, frame.bufferLength, frame.midiNote);

            // Cập nhật trạng thái audio (không vẽ)
            _updateInputPump(time, frame.beatScale, frame.isPlaying);
            _updateFilterNodeFlux(time, frame.vizDataArray, frame.bufferLength);
            _updateOrbitDots(time, frame.bpm, frame.isPlaying, frame.vizDataArray, frame.bufferLength);
            _updateStrings(time, frame);

            // Brain filter — vẽ trong khung cục bộ, xoay/lật theo chiều đã chọn
            ctx.save();
            ctx.transform(brainMatrix.a, brainMatrix.b, brainMatrix.c, brainMatrix.d, brainMatrix.e, brainMatrix.f);
            drawCurvesAndParticles(time);
            if (SHOW_STRINGS) drawOutputStrings(time);
            drawBrainFilter(time);
            if (SHOW_ORBIT) drawOrbitDots();
            ctx.restore();
        }

        return { draw, triggerBurst };
})();
