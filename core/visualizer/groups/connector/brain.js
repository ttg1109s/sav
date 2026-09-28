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
 *
 * [CHUYỂN — 25/09/2026, yêu cầu Giang] TOÀN BỘ trục thời gian (dãy dot + cụm sóng theo beat/nốt/năng
 * lượng dải, hình trục, mũi tên — các mục (4)/(9)/(11)/(13) ở trên) ĐÃ GỠ khỏi file này, chuyển thành
 * style độc lập 'dot' của group bar (core/visualizer/groups/bar/dot.js + event/workflow/visualizer-
 * render.js::_tickBarDot()). Brain giờ luôn căn giữa một mình. Field Custom Effect liên quan
 * (timelineShape/brainShowTimeline/brainTimelineDotCount/brainTimelineMaxTravel) đã xoá. Comment
 * lịch sử phía trên giữ lại để tra cứu, không còn khớp code.
  *
 * [REFACTOR — 28/09/2026, Phase 5 dọn visualizer, Giang chốt "brain.js refactor theo rule core"] Bỏ closure
 * `brainFilterOriginal` (≈40 biến trạng thái ẩn + 15 hàm gọi lẫn nhau + draw() tự điều phối). Nay:
 *   - Trạng thái: 1 object `createBrainState()` do Workflow giữ (workflowVizConnector._brain); tham số từ Custom
 *     Effect: object `computeBrainTuning(settings)` (thay _applySettings() ghi đè biến module).
 *   - Mỗi hàm core dưới đây 1 việc, chỉ đọc tham số (sửa tại chỗ state nhận vào), không gọi core khác, không appState.
 *     Toán dùng chung (bezier, năng lượng quanh 1 tần số, tra độ dài cung) là core RIÊNG; Workflow tính trước rồi
 *     đưa kết quả vào hàm vẽ/bước (event/workflow/visualizer/connector.js::_drawBrain()).
 *   - Màu 3 vai trò (0 = viền/node/hạt vào, 1 = viền phụ, 2 = dây ra) Workflow resolve 1 lần/frame bằng getComputedColor().
 *   - Công thức + thứ tự tiêu thụ Math.random giữ NGUYÊN — đã so khớp từng lời gọi canvas với bản cũ.
 */

// ===================== Hằng số =====================

const BRAIN_FILTER_FLUX_BAND_COUNT = 16;
const BRAIN_FILTER_FLUX_DECAY_TAU_MS = 90;
const BRAIN_FILTER_NODE_COUNT = 65;
const BRAIN_IN_CP1_X = 0.2, BRAIN_IN_CP1_Y = 1.95, BRAIN_IN_CP2_X = 0.82, BRAIN_IN_END_Y = 0.65;
const BRAIN_PUMP_BASELINE_TAU_MS = 800; // baseline chậm của beatScale — mức bass "nền" hiện tại
const BRAIN_PUMP_ATTACK_TAU_MS = 40;
const BRAIN_PUMP_RELEASE_TAU_MS = 260;
const BRAIN_ORBIT_FALLBACK_BPM = 90;
const BRAIN_ORBIT_SPEED_TAU_MS = 500;
const BRAIN_ORBIT_TRAIL_STEP_RAD = 0.035;
const BRAIN_ORBIT_CENTROID_LO = 0.5, BRAIN_ORBIT_CENTROID_HI = 0.85;
const BRAIN_ORBIT_CENTROID_TAU_MS = 200;
const BRAIN_STRING_COUNT = 7;
const BRAIN_STRING_NATURAL_OF_PC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const BRAIN_STRING_ENERGY_GAIN = 1.3;
const BRAIN_STRING_VIB_HZ_BASE = 5;
const BRAIN_STRING_VIB_HZ_STEP = 0.6;
const BRAIN_STRING_SAMPLES = 48;
const BRAIN_STRING_HARMONIC_SILENT = 0.02;
const BRAIN_STRING_GAP_SMOOTH_TAU_MS = 150;
const BRAIN_STRING_GAP_MAX_BACK = 0.8;
const BRAIN_STRING_DOT_MAX = 10;
const BRAIN_STRING_FALLBACK_BPM = 90;
const BRAIN_STRING_END_FLASH_TAU_MS = 280;
const BRAIN_STRING_END_DOT_RADIUS = 3.2;
const BRAIN_ARC_LUT_SAMPLES = 64;
const BRAIN_STAGE_ASPECT = 0.5625;
const BRAIN_DIRECTION_MATRIX = {
    ltr: [1, 0, 0, 1],
    rtl: [-1, 0, 0, 1],
    ttb: [0, 1, -1, 0],
    btt: [0, -1, 1, 0],
};
const BRAIN_CONTENT_X0 = 0.07, BRAIN_CONTENT_X1 = 0.93, BRAIN_CONTENT_HALF_T = 0.36;
const BRAIN_LAYOUT_MARGIN_FRAC = 0.06;
const BRAIN_MAX_WIDTH_FRAC = 0.86;
const BRAIN_MAX_LENGTH_FRAC = 0.8;

// ===================== Trạng thái + tham số =====================

/** Trạng thái brain (Workflow giữ, các core dưới sửa tại chỗ). */
function createBrainState() {
    return {
        layoutKey: '',
        layout: null, // computeBrainLayout()
        filterNodes: [], inputPaths: [], outputPaths: [], particles: [], bursts: [],
        flux: { prev: new Float32Array(BRAIN_FILTER_FLUX_BAND_COUNT), flash: new Float32Array(BRAIN_FILTER_FLUX_BAND_COUNT), target: new Float32Array(BRAIN_FILTER_FLUX_BAND_COUNT), primed: false, lastTime: 0 },
        pump: { baseline: 0, envelope: 0, lastTime: 0 },
        orbit: { phase: 0, speed: 0, centroid: 0, lastTime: 0 },
        strings: { amp: new Float32Array(BRAIN_STRING_COUNT), endFlash: new Float32Array(BRAIN_STRING_COUNT), trains: [], prevNote: null, prevFresh: false, lastTime: 0 },
    };
}

/** Tham số brain từ Custom Effect connector (THAY _applySettings() ghi đè biến module cũ). */
function computeBrainTuning(st) {
    const num = (v, fb) => (typeof v === 'number' && isFinite(v) ? v : fb);
    return {
        glowMult: st.glowEnabled === false ? 0 : num(st.glowIntensity, 100) / 100,
        fluxNoiseFloor: num(st.fireThreshold, 0.55) * 0.04,
        lateralK: num(st.lateralInhibitStrength, 70) / 150 * 0.5,
        filterStrictness: num(st.brainFilterStrictness, 0.98),
        speedMultiplier: num(st.brainInputSpeed, 1.5),
        pumpSqueezeMax: num(st.brainPumpSqueeze, 22) / 100,
        pumpGain: num(st.brainPumpSensitivity, 4),
        fluxGain: num(st.brainNodeFlashSensitivity, 5),
        stringAmpMaxFrac: 0.045 * num(st.brainStringAmplitude, 100) / 100,
        stringDecayTauMs: num(st.brainStringDecayMs, 380),
        stringDotBeatsPerRun: num(st.brainStringDotBeats, 2),
        stringDotGapMin: num(st.brainStringDotGapMin, 2.5) / 100,
        stringDotGapMax: num(st.brainStringDotGapMax, 10) / 100,
        stringDotGapLive: st.brainStringDotGapLive !== false,
        orbitDotCount: Math.round(num(st.brainOrbitDotCount, 8)),
        orbitBeatsPerLap: num(st.brainOrbitBeatsPerLap, 8),
        orbitTrailCount: Math.round(num(st.brainOrbitTrail, 6)),
        showOrbit: st.brainShowOrbit !== false,
        showNodes: st.brainShowNodes !== false,
        showStrings: st.brainShowStrings !== false,
        signalCount: Math.round(num(st.brainSignalCount, 120)),
    };
}

// ===================== Bố cục (dựng lại khi đổi kích thước/hướng/số tín hiệu) =====================

/** Khoá bố cục — đổi thì Workflow dựng lại toàn bộ đường/hạt/node. */
function computeBrainLayoutKey(canvasWidth, canvasHeight, direction, signalCount) {
    return [canvasWidth, canvasHeight, direction, signalCount].join('|');
}

/** Sân khấu logic (dài L theo hướng chảy) + ma trận đặt lên canvas theo hướng + vị trí 3 khối (nguồn, lọc, đích). */
function computeBrainLayout(W, H, direction) {
    const dir = BRAIN_DIRECTION_MATRIX[direction] ? direction : 'ltr';
    const isVertical = dir === 'ttb' || dir === 'btt';
    const availH = Math.max(1, H - 2 * H * BRAIN_LAYOUT_MARGIN_FRAC);
    const alongK = BRAIN_CONTENT_X1 - BRAIN_CONTENT_X0;
    const crossK = 2 * BRAIN_CONTENT_HALF_T * BRAIN_STAGE_ASPECT;
    const kW = isVertical ? crossK : alongK, kH = isVertical ? alongK : crossK;
    const L = Math.max(1, Math.min(W * BRAIN_MAX_WIDTH_FRAC / kW, availH / kH, Math.max(W, H) * BRAIN_MAX_LENGTH_FRAC));
    const contentW = kW * L, contentH = kH * L;
    const top = (H - contentH) / 2;
    const width = L;
    const stageH = L * BRAIN_STAGE_ASPECT;
    const stageOffsetY = 0;
    const [a, b, c, d] = BRAIN_DIRECTION_MATRIX[dir];
    const xs = [BRAIN_CONTENT_X0 * L, BRAIN_CONTENT_X1 * L];
    const ys = [stageH * (0.5 - BRAIN_CONTENT_HALF_T), stageH * (0.5 + BRAIN_CONTENT_HALF_T)];
    let minX = Infinity, minY = Infinity;
    xs.forEach((x) => ys.forEach((y) => {
        minX = Math.min(minX, a * x + c * y);
        minY = Math.min(minY, b * x + d * y);
    }));
    return {
        width, stageH,
        matrix: { a, b, c, d, e: (W - contentW) / 2 - minX, f: top - minY },
        leftPersonPos: { x: width * 0.07, y: stageOffsetY + stageH * 0.5 },
        rightPersonPos: { x: width * 0.93, y: stageOffsetY + stageH * 0.5 },
        filterPos: { x: width * 0.54, y: stageOffsetY + stageH * 0.5, rx: width * 0.045, ry: stageH * 0.32 },
    };
}

/** 65 node rải đều trong elip bộ lọc; gán dải tần (band) theo độ cao — dưới = trầm. */
function buildBrainFilterNodes(filterPos) {
    const nodes = [];
    for (let i = 0; i < BRAIN_FILTER_NODE_COUNT; i++) {
        const u = Math.random();
        const v = Math.random();
        const r = Math.sqrt(u);
        const theta = v * 2 * Math.PI;
        const nx = filterPos.x + r * Math.cos(theta) * (filterPos.rx * 0.88);
        const ny = filterPos.y + r * Math.sin(theta) * (filterPos.ry * 0.88);
        nodes.push({
            x: nx, y: ny, baseX: nx, baseY: ny,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
            size: Math.random() * 2 + 1,
            pulse: Math.random() * Math.PI * 2,
            band: 0,
        });
    }
    const byY = nodes.slice().sort((p, q) => q.baseY - p.baseY);
    for (let k = 0; k < byY.length; k++) byY[k].band = Math.min(BRAIN_FILTER_FLUX_BAND_COUNT - 1, Math.floor(k / byY.length * BRAIN_FILTER_FLUX_BAND_COUNT));
    return nodes;
}

/** Bó đường vào (nguồn -> mép trái bộ lọc) + 1 hạt trên mỗi đường (tạo xen kẽ đúng thứ tự cũ). */
function buildBrainInputPathsAndParticles(signalCount, filterPos, leftPersonPos) {
    const inputPaths = [], particles = [];
    for (let i = 0; i < signalCount; i++) {
        const lane = (i / (signalCount - 1)) * 2 - 1;
        const endYRel = lane * BRAIN_IN_END_Y;
        const targetY = filterPos.y + endYRel * filterPos.ry;
        const targetX = filterPos.x - filterPos.rx * Math.sqrt(Math.max(0, 1 - endYRel * endYRel));
        const D = targetX - leftPersonPos.x;
        inputPaths.push({
            p0: { x: leftPersonPos.x, y: leftPersonPos.y },
            p1: { x: leftPersonPos.x + D * BRAIN_IN_CP1_X, y: leftPersonPos.y + lane * BRAIN_IN_CP1_Y * filterPos.ry },
            p2: { x: leftPersonPos.x + D * BRAIN_IN_CP2_X, y: targetY },
            p3: { x: targetX, y: targetY },
            alpha: Math.random() * 0.15 + 0.1,
            lane,
        });
        particles.push({ pathIndex: i, isInput: true, t: Math.random(), speed: (Math.random() * 0.003 + 0.002), size: Math.random() * 1.8 + 1, glow: 3 });
    }
    return { inputPaths, particles };
}

/** 7 dây ra (bộ lọc -> đích), uốn sóng xen kẽ. `arcLut` gắn sau bằng buildBrainArcLengthLut(). */
function buildBrainOutputPaths(filterPos, rightPersonPos, width, stageH) {
    const paths = [];
    for (let i = 0; i < BRAIN_STRING_COUNT; i++) {
        const lane = (i / (BRAIN_STRING_COUNT - 1)) * 2 - 1;
        const startY = filterPos.y + lane * 0.45 * filterPos.ry;
        const startX = filterPos.x + filterPos.rx * 0.4;
        const endX = rightPersonPos.x - Math.random() * width * 0.1;
        const endY = filterPos.y + lane * 0.75 * filterPos.ry;
        const waveFactor = (i % 2 === 0 ? 1 : -1) * (stageH * 0.025);
        paths.push({
            p0: { x: startX, y: startY },
            p1: { x: startX + (endX - startX) * 0.4, y: startY + waveFactor },
            p2: { x: startX + (endX - startX) * 0.6, y: endY - waveFactor },
            p3: { x: endX, y: endY },
        });
    }
    return paths;
}

// ===================== Toán dùng chung =====================

/** Điểm trên bezier bậc 3 tại t (0-1). */
function computeBrainBezierPoint(p, t) {
    const cx = 3 * (p.p1.x - p.p0.x);
    const bx = 3 * (p.p2.x - p.p1.x) - cx;
    const ax = p.p3.x - p.p0.x - cx - bx;
    const cy = 3 * (p.p1.y - p.p0.y);
    const by = 3 * (p.p2.y - p.p1.y) - cy;
    const ay = p.p3.y - p.p0.y - cy - by;
    return { x: ax * Math.pow(t, 3) + bx * Math.pow(t, 2) + cx * t + p.p0.x, y: ay * Math.pow(t, 3) + by * Math.pow(t, 2) + cy * t + p.p0.y };
}

/** Bảng độ dài cung chuẩn hoá từ BRAIN_ARC_LUT_SAMPLES + 1 điểm mẫu (Workflow lấy bằng computeBrainBezierPoint()). */
function buildBrainArcLengthLut(samplePoints) {
    const lut = new Float32Array(BRAIN_ARC_LUT_SAMPLES + 1);
    let total = 0;
    for (let k = 1; k <= BRAIN_ARC_LUT_SAMPLES; k++) {
        total += Math.hypot(samplePoints[k].x - samplePoints[k - 1].x, samplePoints[k].y - samplePoints[k - 1].y);
        lut[k] = total;
    }
    for (let k = 1; k <= BRAIN_ARC_LUT_SAMPLES; k++) lut[k] /= total || 1;
    return lut;
}

/** Độ dài cung chuẩn hoá u -> tham số t (tìm nhị phân trên LUT) — dot chạy đều tốc độ dọc dây. */
function computeBrainArcT(lut, u) {
    if (u <= 0) return 0;
    if (u >= 1) return 1;
    let lo = 0, hi = BRAIN_ARC_LUT_SAMPLES;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (lut[mid] < u) lo = mid; else hi = mid; }
    const span = lut[hi] - lut[lo] || 1;
    return (lo + (u - lut[lo]) / span) / BRAIN_ARC_LUT_SAMPLES;
}

/** Độ lệch y do rung của dây s tại t (biên độ theo stringAmp, bụng giữa dây, tần số rung riêng từng dây). */
function computeBrainStringOffsetY(amp, stageH, ampMaxFrac, stringIdx, t, time) {
    const hz = BRAIN_STRING_VIB_HZ_BASE + (6 - stringIdx) * BRAIN_STRING_VIB_HZ_STEP;
    return amp * stageH * ampMaxFrac * Math.sin(Math.PI * t) * Math.sin(time * 0.001 * Math.PI * 2 * hz);
}

/** Tần số của nốt MIDI. */
function computeBrainNoteFrequency(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
}

/** Năng lượng 0-1 quanh 1 tần số (đỉnh 3 bin lân cận). */
function computeBrainFreqEnergy(freq, vizDataArray, bufferLength, sampleRate) {
    if (!vizDataArray || !bufferLength) return 0;
    const bin = Math.round(freq / ((sampleRate || 44100) / (bufferLength * 2)));
    if (bin >= bufferLength) return 0;
    let peak = 0;
    for (let i = Math.max(0, bin - 1); i <= Math.min(bufferLength - 1, bin + 1); i++) peak = Math.max(peak, vizDataArray[i] || 0);
    return peak / 255;
}

/** Trọng tâm phổ (thang log) chuẩn hoá 0-1 — phổ "sáng" -> dot quỹ đạo to/sáng hơn. */
function computeBrainSpectralCentroid(vizDataArray, bufferLength) {
    if (!vizDataArray || !bufferLength) return 0;
    let sumV = 0, sumIV = 0;
    for (let i = 1; i < bufferLength; i++) { const v = vizDataArray[i]; sumV += v; sumIV += i * v; }
    if (sumV < bufferLength * 2) return 0;
    const logPos = Math.log2(1 + sumIV / sumV) / Math.log2(bufferLength);
    return Math.min(1, Math.max(0, (logPos - BRAIN_ORBIT_CENTROID_LO) / (BRAIN_ORBIT_CENTROID_HI - BRAIN_ORBIT_CENTROID_LO)));
}

/** Khoảng cách các dot của 1 đoàn theo năng lượng hoạ âm (`harmonicEnergies[j]` = hoạ âm bậc j+2) — hoạ âm mạnh dãn xa. */
function computeBrainTrainOffsets(harmonicEnergies, gapMinRaw, gapMaxRaw) {
    let maxE = 0;
    harmonicEnergies.forEach((e) => { maxE = Math.max(maxE, e); });
    const gapMin = Math.min(gapMinRaw, gapMaxRaw), gapMax = Math.max(gapMinRaw, gapMaxRaw);
    const offsets = [0];
    for (let j = 0; j < harmonicEnergies.length; j++) {
        const rel = maxE < BRAIN_STRING_HARMONIC_SILENT ? 0.5 : harmonicEnergies[j] / maxE;
        offsets.push(offsets[j] + gapMin + rel * (gapMax - gapMin));
    }
    return offsets;
}

/** Số dot của đoàn = số quãng tám của nốt (1-10). */
function computeBrainTrainCount(midiNote) {
    return Math.min(BRAIN_STRING_DOT_MAX, Math.max(1, Math.floor(midiNote / 12) - 1 + 1));
}

// ===================== Bước mỗi frame =====================

/** Flux theo 16 dải (`bandEnergies[b]` 0-1, Workflow tính) -> chớp node bộ lọc, ức chế bên giữa dải kề, mờ dần. */
function stepBrainFilterFlux(state, tuning, time, bandEnergies) {
    const f = state.flux;
    const dt = f.lastTime ? Math.min(100, Math.max(0, time - f.lastTime)) : 16;
    f.lastTime = time;
    const decay = Math.exp(-dt / BRAIN_FILTER_FLUX_DECAY_TAU_MS);
    for (let b = 0; b < BRAIN_FILTER_FLUX_BAND_COUNT; b++) {
        const cur = bandEnergies[b];
        const flux = cur - f.prev[b];
        f.target[b] = f.primed && flux > tuning.fluxNoiseFloor ? Math.min(1, (flux - tuning.fluxNoiseFloor) * tuning.fluxGain) : 0;
        f.prev[b] = cur;
    }
    for (let b = 0; b < BRAIN_FILTER_FLUX_BAND_COUNT; b++) {
        const left = b > 0 ? f.target[b - 1] : 0;
        const right = b < BRAIN_FILTER_FLUX_BAND_COUNT - 1 ? f.target[b + 1] : 0;
        const inhibited = Math.max(0, f.target[b] - tuning.lateralK * Math.max(left, right));
        f.flash[b] = Math.max(f.flash[b] * decay, inhibited);
    }
    f.primed = true;
}

/** Bó đường vào "bóp" theo bass (bao đường beatScale vượt baseline). */
function stepBrainInputPump(state, tuning, time, beatScale, isPlaying) {
    const pump = state.pump, layout = state.layout;
    const dt = pump.lastTime ? Math.min(100, Math.max(0, time - pump.lastTime)) : 16;
    pump.lastTime = time;
    const level = isPlaying && isFinite(beatScale) ? beatScale : 0;
    pump.baseline += (level - pump.baseline) * (1 - Math.exp(-dt / BRAIN_PUMP_BASELINE_TAU_MS));
    const drive = Math.min(1, Math.max(0, (level - pump.baseline) * tuning.pumpGain));
    const tau = drive > pump.envelope ? BRAIN_PUMP_ATTACK_TAU_MS : BRAIN_PUMP_RELEASE_TAU_MS;
    pump.envelope += (drive - pump.envelope) * (1 - Math.exp(-dt / tau));
    const bulbY = BRAIN_IN_CP1_Y * layout.filterPos.ry * (1 - tuning.pumpSqueezeMax * pump.envelope);
    for (let i = 0; i < state.inputPaths.length; i++) state.inputPaths[i].p1.y = layout.leftPersonPos.y + state.inputPaths[i].lane * bulbY;
}

/** Dot quỹ đạo quanh bộ lọc: 1 vòng / N beat theo BPM, kích thước/độ sáng theo trọng tâm phổ (`centroid`, Workflow tính). */
function stepBrainOrbit(state, tuning, time, bpm, isPlaying, centroid) {
    const o = state.orbit;
    const dt = o.lastTime ? Math.min(100, Math.max(0, time - o.lastTime)) : 16;
    o.lastTime = time;
    const effBpm = isFinite(bpm) && bpm > 0 ? bpm : BRAIN_ORBIT_FALLBACK_BPM;
    const targetSpeed = isPlaying ? (Math.PI * 2) * (effBpm / 60000) / tuning.orbitBeatsPerLap : 0;
    o.speed += (targetSpeed - o.speed) * (1 - Math.exp(-dt / BRAIN_ORBIT_SPEED_TAU_MS));
    o.phase = (o.phase + o.speed * dt) % (Math.PI * 2);
    o.centroid += (centroid - o.centroid) * (1 - Math.exp(-dt / BRAIN_ORBIT_CENTROID_TAU_MS));
}

/** Nốt hiện tại trên 7 dây ra: dây ứng bậc nốt rung theo năng lượng nốt (`noteEnergy`), dây khác tắt dần; đầu dây chớp
 * mờ dần. Trả { dt, newTrain } — `newTrain` = đoàn dot cần bắt đầu (nốt mới vừa vang) hoặc null; Workflow tính khoảng
 * cách dot rồi gọi startBrainStringTrain(). */
function stepBrainStringNote(state, tuning, time, midiNote, noteFresh, isPlaying, bpm, noteEnergy) {
    const st = state.strings;
    const dt = st.lastTime ? Math.min(100, Math.max(0, time - st.lastTime)) : 16;
    st.lastTime = time;
    const decay = Math.exp(-dt / tuning.stringDecayTauMs);
    const fresh = !!noteFresh && !!isPlaying && midiNote !== null && midiNote !== undefined;
    const sounding = fresh && state.outputPaths.length === BRAIN_STRING_COUNT;
    const activeIdx = sounding ? 6 - BRAIN_STRING_NATURAL_OF_PC[((midiNote % 12) + 12) % 12] : -1;
    const targetAmp = sounding ? Math.min(1, noteEnergy * BRAIN_STRING_ENERGY_GAIN) : 0;
    const isNewNote = sounding && (!st.prevFresh || midiNote !== st.prevNote);
    const effBpm = isFinite(bpm) && bpm > 0 ? bpm : BRAIN_STRING_FALLBACK_BPM;
    const newTrain = isNewNote ? { stringIdx: activeIdx, startTime: time, count: 0, midi: midiNote, runMs: tuning.stringDotBeatsPerRun * 60000 / effBpm, arrived: 0 } : null;
    st.prevFresh = fresh;
    st.prevNote = midiNote;
    for (let s = 0; s < st.amp.length; s++) st.amp[s] = s === activeIdx ? Math.max(st.amp[s] * decay, targetAmp) : st.amp[s] * decay;
    const endDecay = Math.exp(-dt / BRAIN_STRING_END_FLASH_TAU_MS);
    for (let s = 0; s < st.endFlash.length; s++) st.endFlash[s] *= endDecay;
    return { dt, newTrain };
}

/** Thêm 1 đoàn dot (số dot + khoảng cách do Workflow tính). */
function startBrainStringTrain(state, train, count, offsets) {
    train.count = count;
    train.offsets = offsets;
    state.strings.trains.push(train);
}

/** Tiến các đoàn dot dọc dây: bám khoảng cách hoạ âm mới (`liveTargets[k]`, null = không bám), đếm dot tới đích (chớp
 * đầu dây), bỏ đoàn đã tới hết. */
function advanceBrainStringTrains(state, tuning, time, dt, liveTargets) {
    const st = state.strings;
    const gapAlpha = 1 - Math.exp(-dt / BRAIN_STRING_GAP_SMOOTH_TAU_MS);
    const halfMinGap = Math.min(tuning.stringDotGapMin, tuning.stringDotGapMax) * 0.5;
    for (let k = st.trains.length - 1; k >= 0; k--) {
        const tr = st.trains[k];
        const head = (time - tr.startTime) / tr.runMs;
        const target = liveTargets[k];
        const maxBack = (dt / tr.runMs) * BRAIN_STRING_GAP_MAX_BACK;
        for (let j = Math.max(1, tr.arrived); target && j < tr.count; j++) {
            let next = tr.offsets[j] + (target[j] - tr.offsets[j]) * gapAlpha;
            next = Math.min(next, tr.offsets[j] + maxBack);
            next = Math.max(next, tr.offsets[j - 1] + halfMinGap);
            tr.offsets[j] = next;
        }
        let arrived = 0;
        while (arrived < tr.count && head - tr.offsets[arrived] >= 1) arrived++;
        st.endFlash[tr.stringIdx] = arrived > tr.arrived ? 1 : st.endFlash[tr.stringIdx];
        tr.arrived = Math.max(tr.arrived, arrived);
        if (head - tr.offsets[tr.count - 1] > 1) st.trains.splice(k, 1);
    }
}

/** Hạt trên đường vào tiến theo tốc độ × hệ số. */
function advanceBrainParticles(particles, speedMultiplier) {
    particles.forEach((p) => { p.t += p.speed * speedMultiplier; });
}

/** Hạt tới cuối đường (t >= 1): bị bộ lọc chặn (xác suất theo strictness) -> nổ đốm tại chỗ; hạt 1 lần (burst) bị bỏ,
 * hạt thường quay về đầu với tốc độ mới. `points[i]` = vị trí hạt i (null = không có đường). Duyệt ngược như bản cũ. */
function settleBrainParticles(particles, points, bursts, filterStrictness, burstColor) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        const pt = points[i];
        if (!pt || p.t < 1) continue;
        const passFilter = Math.random() > filterStrictness;
        if (!passFilter) bursts.push({ x: pt.x, y: pt.y, radius: Math.random() * 4 + 2, alpha: 0.8, color: burstColor });
        if (p.oneShot) { particles.splice(i, 1); continue; }
        p.t = 0;
        p.speed = Math.random() * 0.003 + 0.002;
    }
}

/** Đốm nổ lớn dần + mờ dần; tắt hẳn thì bỏ. */
function advanceBrainBursts(bursts) {
    for (let b = bursts.length - 1; b >= 0; b--) {
        bursts[b].radius += 0.3;
        bursts[b].alpha -= 0.06;
        if (bursts[b].alpha <= 0) bursts.splice(b, 1);
    }
}

/** Node bộ lọc lắc nhẹ quanh vị trí gốc. */
function advanceBrainFilterNodes(nodes) {
    nodes.forEach((node) => {
        node.pulse += 0.04;
        node.x = node.baseX + Math.sin(node.pulse) * 2;
        node.y = node.baseY + Math.cos(node.pulse) * 2;
    });
}

/** Nhạc chuyển đoạn: bắn thêm 25 hạt nhanh (1 lần) vào các đường vào ngẫu nhiên. */
function triggerBrainBurst(state) {
    for (let i = 0; i < 25; i++) {
        state.particles.push({
            pathIndex: Math.floor(Math.random() * state.inputPaths.length), isInput: true, t: 0,
            speed: Math.random() * 0.008 + 0.005, size: Math.random() * 2.5 + 1.5, glow: 8, oneShot: true,
        });
    }
}

// ===================== Vẽ (chỉ Canvas API) =====================

/** Mở lớp vẽ brain: lưu trạng thái canvas + đặt ma trận hướng chảy. */
function beginBrainPaint(ctx, matrix) {
    ctx.save();
    ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f);
}

/** Lưu / trả trạng thái canvas quanh 1 lớp con. */
function saveBrainCanvas(ctx) {
    ctx.save();
}
function restoreBrainCanvas(ctx) {
    ctx.restore();
}

/** Bó đường vào (bezier mảnh, alpha riêng từng đường). */
function drawBrainInputCurves(ctx, inputPaths, color) {
    ctx.save();
    inputPaths.forEach((path) => {
        ctx.beginPath();
        ctx.moveTo(path.p0.x, path.p0.y);
        ctx.bezierCurveTo(path.p1.x, path.p1.y, path.p2.x, path.p2.y, path.p3.x, path.p3.y);
        ctx.strokeStyle = color.fill;
        ctx.globalAlpha = path.alpha;
        ctx.lineWidth = 1;
        ctx.stroke();
    });
    ctx.restore();
}

/** Hạt trên đường vào (duyệt ngược như bản cũ), mờ ở 2 đầu đường. */
function drawBrainParticles(ctx, particles, points, color, glowMult) {
    ctx.save();
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i], pt = points[i];
        if (!pt) continue;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = color.glow;
        ctx.shadowColor = color.glow;
        ctx.shadowBlur = (p.glow) * glowMult;
        ctx.globalAlpha = Math.sin(p.t * Math.PI);
        ctx.fill();
    }
    ctx.restore();
}

/** Đốm nổ (hạt bị lọc chặn). */
function drawBrainBursts(ctx, bursts, glowMult) {
    ctx.save();
    for (let b = bursts.length - 1; b >= 0; b--) {
        const burst = bursts[b];
        ctx.beginPath();
        ctx.arc(burst.x, burst.y, burst.radius, 0, Math.PI * 2);
        ctx.fillStyle = burst.color;
        ctx.globalAlpha = burst.alpha;
        ctx.shadowColor = burst.color;
        ctx.shadowBlur = (6) * glowMult;
        ctx.fill();
    }
    ctx.restore();
}

/** 7 dây ra: dây đứng yên vẽ bezier, dây đang rung vẽ theo điểm mẫu (`lines[s]`, null = đứng yên) + đoàn dot
 * (`trainDots`, đã tính vị trí/alpha) + chấm đầu dây chớp khi dot tới. */
function drawBrainOutputStrings(ctx, outputPaths, amps, lines, trainDots, endFlash, color, glowMult) {
    ctx.save();
    ctx.strokeStyle = color.fill;
    ctx.shadowColor = color.glow;
    for (let s = 0; s < outputPaths.length; s++) {
        const amp = amps[s];
        const line = lines[s];
        const path = outputPaths[s];
        ctx.beginPath();
        if (line) line.forEach((pt, k) => (k === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        else { ctx.moveTo(path.p0.x, path.p0.y); ctx.bezierCurveTo(path.p1.x, path.p1.y, path.p2.x, path.p2.y, path.p3.x, path.p3.y); }
        ctx.globalAlpha = 0.65 + 0.35 * amp;
        ctx.lineWidth = 2 + amp * 1.5;
        ctx.shadowBlur = (8 + amp * 10) * glowMult;
        ctx.stroke();
    }
    ctx.fillStyle = color.glow;
    ctx.shadowBlur = (12) * glowMult;
    trainDots.forEach((dot) => {
        ctx.globalAlpha = dot.alpha;
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 2.8, 0, Math.PI * 2);
        ctx.fill();
    });
    for (let s = 0; s < outputPaths.length; s++) {
        const end = outputPaths[s].p3;
        const flash = endFlash[s];
        ctx.globalAlpha = 0.5 + 0.5 * flash;
        ctx.shadowBlur = (6 + flash * 20) * glowMult;
        ctx.beginPath();
        ctx.arc(end.x, end.y, BRAIN_STRING_END_DOT_RADIUS * (1 + flash), 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
}

/** Vỏ bộ lọc: elip chính (glow) + elip phụ nhịp thở + nền gradient. Để nguyên trạng thái canvas cho lớp node vẽ tiếp
 * (dùng chung shadow) — Workflow bọc bằng saveBrainCanvas()/restoreBrainCanvas(). */
function drawBrainFilterShell(ctx, filterPos, time, primary, secondary, glowMult) {
    ctx.beginPath();
    ctx.ellipse(filterPos.x, filterPos.y, filterPos.rx, filterPos.ry, 0, 0, Math.PI * 2);
    ctx.strokeStyle = primary.fill;
    ctx.lineWidth = 3;
    ctx.shadowColor = primary.glow;
    ctx.shadowBlur = (20) * glowMult;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(filterPos.x, filterPos.y, filterPos.rx * 1.08, filterPos.ry * 1.05, 0, 0, Math.PI * 2);
    ctx.strokeStyle = secondary.fill;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.4 + Math.sin(time * 0.003) * 0.2;
    ctx.stroke();
    const fillGrad = ctx.createRadialGradient(filterPos.x, filterPos.y, 5, filterPos.x, filterPos.y, filterPos.ry);
    fillGrad.addColorStop(0, 'rgba(15, 23, 42, 0.7)');
    fillGrad.addColorStop(0.8, 'rgba(30, 41, 59, 0.4)');
    fillGrad.addColorStop(1, 'rgba(56, 189, 248, 0.05)');
    ctx.fillStyle = fillGrad;
    ctx.fill();
}

/** Dây nối giữa các node gần nhau (sáng theo dải chớp yếu hơn của 2 đầu). */
function drawBrainFilterLinks(ctx, nodes, bandFlash, filterPos, primary) {
    ctx.strokeStyle = primary.fill;
    ctx.lineWidth = 0.8;
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            if (Math.sqrt(dx * dx + dy * dy) >= filterPos.rx * 0.75) continue;
            ctx.globalAlpha = 0.35 + 0.55 * Math.min(bandFlash[nodes[i].band], bandFlash[nodes[j].band]);
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
        }
    }
}

/** Node bộ lọc (phồng + glow theo chớp dải của node). */
function drawBrainFilterNodes(ctx, nodes, bandFlash, primary, glowMult) {
    nodes.forEach((node) => {
        const flash = bandFlash[node.band];
        ctx.globalAlpha = 0.55 + 0.45 * flash;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.size * (1 + flash * 1.2), 0, Math.PI * 2);
        ctx.fillStyle = primary.glow;
        ctx.shadowColor = primary.glow;
        ctx.shadowBlur = (6 + flash * 14) * glowMult;
        ctx.fill();
    });
}

/** Dot quỹ đạo quanh bộ lọc (kèm vệt đuôi). */
function drawBrainOrbitDots(ctx, orbit, tuning, filterPos, primary) {
    const orx = filterPos.rx * 1.08, ory = filterPos.ry * 1.05;
    const baseR = Math.max(1.5, filterPos.rx * 0.05) * (1 + orbit.centroid * 0.8);
    ctx.save();
    ctx.fillStyle = primary.glow;
    ctx.shadowColor = primary.glow;
    for (let d = 0; d < tuning.orbitDotCount; d++) {
        const a0 = orbit.phase + d * (Math.PI * 2 / tuning.orbitDotCount);
        for (let k = tuning.orbitTrailCount; k >= 0; k--) {
            const a = a0 - k * BRAIN_ORBIT_TRAIL_STEP_RAD;
            const fade = 1 - k / (tuning.orbitTrailCount + 1);
            ctx.globalAlpha = (0.35 + 0.65 * orbit.centroid) * fade;
            ctx.shadowBlur = (k === 0 ? 6 + orbit.centroid * 12 : 0) * tuning.glowMult;
            ctx.beginPath();
            ctx.arc(filterPos.x + Math.cos(a) * orx, filterPos.y + Math.sin(a) * ory, baseR * (0.4 + 0.6 * fade), 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.restore();
}
