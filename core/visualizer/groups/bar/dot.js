/**
 * core/visualizer/groups/bar/dot.js — [MỚI 25/09/2026, yêu cầu Giang] Style 'dot' của group bar: TRỤC
 * THỜI GIAN chuyển NGUYÊN từ connector brain (core/visualizer/groups/connector/brain.js, trước đây
 * `drawTimeline()` + khối TIMELINE_*) thành 1 visualizer effect độc lập. Cơ chế gốc giữ nguyên: dãy
 * `dotCount` dot đều nhau dọc 1 hình trục; mỗi beat THẬT (`lastBeatTime`) sinh 1 CỤM `clusterSize` dot
 * (1-7 theo nốt nhạc) từ đầu trục, dịch mượt dọc trục trong DOT_CLUSTER_TRAVEL_MS; dot trong cụm phồng
 * theo năng lượng dải tần riêng (computeNeuronBinEnergy(), synapse.js — Workflow tự gọi), làm mượt EMA.
 *
 * Khác bản trong brain (theo yêu cầu Giang 25/09/2026):
 *   (1) Dot đang bị tác động có glow blur — theo khối blur chung của Custom Effect (perf.blurMult).
 *   (2) Quãng đường sóng KHÔNG còn chỉnh tay (bỏ field "max travel" + sàn tối thiểu 15%): chiều dài
 *       trục chỉ là MỐC TỐI ĐA, quãng đường mỗi cụm = năng lượng lúc beat (chuẩn hoá theo đỉnh gần
 *       đây, DOT_ENERGY_PEAK_TAU_MS) × toàn trục.
 *   (3) Kiểu tác động: 'radius' (phồng bán kính — như cũ) | 'height' (kéo dài 2 bên VUÔNG GÓC trục,
 *       dạng viên thuốc; tối đa maxH × 0.5 mỗi bên, cùng quy ước bar mirror).
 *   (4) Thêm 2 hình: 'sinWave' (sóng sin lên xuống DOT_WAVE_PERIODS chu kỳ) + 'squareWave' (xung vuông
 *       DOT_SQUARE_PULSES xung). Dot rải theo ĐỘ DÀI CUNG thật (bản cũ theo tham số u) — xung vuông có
 *       cạnh đứng, rải theo u sẽ không có dot nào trên cạnh đứng.
 *   (5) Hình 'line' + toggle `dotLineVibrate`: dây rung đàn hồi như 7 dây output của brain — nốt đang
 *       phát (C..B, nốt thăng lấy nốt tự nhiên ngay dưới) gảy ĐÚNG 1/7 đoạn của line (tâm đoạn
 *       (k + 0.5) / 7), dạng dây gảy (2 đầu cố định, đỉnh tại điểm gảy), biên độ theo năng lượng FFT
 *       đúng tần số nốt, tắt dần. 7 vị trí rung độc lập, cộng dồn.
 *
 * SỬA (25/09/2026, Giang — lượt 2):
 *   (6) BỎ mũi tên + đường nối (nét đứt) giữa các dot — chỉ còn dãy dot. Hình trục vẫn quyết định
 *       VỊ TRÍ dot, không vẽ ra nữa.
 *   (7) ĐỒNG MÀU: mọi dot (nghỉ lẫn đang tác động) cùng 1 màu effect/frame — Workflow lấy 1 màu duy
 *       nhất, dot nghỉ không còn xám cố định. Dot tác động chỉ khác ở kích thước + glow.
 *   (8) Toggle `dotMoving` — chuỗi dot thành RẮN BÒ: đầu rắn (dot 0) bò lang thang, độ cong đường bò
 *       đổi ngẫu nhiên mượt sau mỗi quãng (không gắt hơn bán kính quay tối thiểu) + uốn lượn sin, sát
 *       mép (nhìn trước theo hướng bò) thì quay về giữa màn hình. [SỬA 25/09/2026 lượt 3 — Giang "bỏ mồi"] Bỏ hẳn con mồi (điểm
 *       đích) của bản trước. Thân (dot 1..N-1) bám đúng vết đầu đã bò, cách đều nhau. Tốc độ
 *       bò tăng theo năng lượng nhạc. Bật thì hình trục/rung đàn hồi không dùng. Sóng dot chạy từ đầu
 *       -> đuôi. Khối DOT_SNAKE_* + initDotSnake()/stepDotSnake()/sampleDotSnakeBody().
 *   (9) Kiểu 'height' + `dotBend`: 2 nhánh bẻ góc `dotBendAngle` độ quanh dot — 'gt' (>, đỉnh chỉ
 *       theo chiều chạy), 'lt' (<), 'slash' (/), 'backslash' (\), 'none' (thẳng như cũ).
 *   (10) [MỚI 25/09/2026 lượt 4, Giang] Moving có 2 kiểu `dotMoveType`: 'snake' (rắn bò, mục 8) | 'dna'.
 *       DNA: trên hình trục tĩnh, dãy dot tự NHÂN ĐÔI (chuỗi thứ 2 hiện dần tại chỗ, không cắt cứng)
 *       rồi 2 chuỗi tách ra xoắn kép quanh trục (2 sin lệch pha π theo pháp tuyến, xoay theo thời gian,
 *       ~DOT_DNA_PAIRS_PER_TURN cặp/vòng như DNA thật), có thanh nối từng cặp, chuỗi phía sau nhỏ + mờ
 *       hơn (chiều sâu). Tắt Moving / đổi sang Snake -> phá liên kết LẦN LƯỢT từng cặp từ cặp đầu
 *       (thanh nối rút về 2 dot), cặp nào đứt thì 2 dot khép lại nhập 1. Trạng thái từng cặp = `level`
 *       (0 = 1 chuỗi, 1 = xoắn hết cỡ) + `bond` (độ dài thanh nối 0-1) — stepDotDnaPairs().
 *       Đổi giữa vị trí rắn <-> hình tĩnh: blendDotPositions() trượt mượt từ vị trí cũ (không nhảy).
 *
 * Rule 2/3 — hàm THUẦN / chỉ Canvas API, không appState, không gọi hàm tự viết khác (helper cục bộ
 * khai BÊN TRONG hàm). Trạng thái (cụm, EMA, đỉnh năng lượng, biên độ rung, hình cache) do Workflow
 * (`_tickBarDot()`, event/workflow/visualizer-render.js) giữ và truyền vào.
 *
 * NẠP SAU: core/visualizer/groups/bar/common.js.
 */

const DOT_AXIS_SHAPES = ['line', 'sinDown', 'sinUp', 'sinWave', 'squareWave', 'circle', 'square', 'triangle'];
const DOT_AXIS_MARGIN_X_FRAC = 0.07;     // lề trái/phải hình mở × W
const DOT_SIN_ARC_AMP_FRAC = 0.12;       // độ võng cung sinDown/sinUp × min(W,H)
const DOT_WAVE_AMP_FRAC = 0.1;           // nửa biên độ sinWave/squareWave × min(W,H)
const DOT_WAVE_PERIODS = 2;              // số chu kỳ sinWave
const DOT_SQUARE_PULSES = 4;             // số xung squareWave
const DOT_CLOSED_W_FRAC = 0.7;           // hình kín ≤ 70% W
const DOT_CLOSED_H_FRAC = 0.5;           //         ≤ 50% H
const DOT_BASE_RADIUS_FRAC = 0.22;       // × khoảng cách 2 dot — baseline
const DOT_MAX_RADIUS_FRAC = 0.48;        // × khoảng cách 2 dot — phồng hết cỡ (mode 'radius')
const DOT_CLUSTER_TRAVEL_MS = 700;       // thời gian 1 cụm dịch hết quãng đường của nó
const DOT_ENERGY_PEAK_TAU_MS = 4000;     // đỉnh năng lượng tắt dần ~4s — mốc chuẩn hoá quãng đường
const DOT_SMOOTH_ALPHA = 0.35;           // EMA mỗi frame độ phồng từng dot
const DOT_IMPACT_MIN = 0.02;             // boost dưới mức này coi như dot nghỉ (xám, không glow)
const DOT_GLOW_BLUR_PX = 15;             // shadowBlur tối đa (× boost × dpr × blurMult) — cùng mức bar mirror
const DOT_NOTE_FRESH_MS = 300;           // nốt chỉ coi là "đang phát" trong khoảng này (cùng ngưỡng brain/circuit)
// Rung đàn hồi (hình line) — cùng thông số 7 dây output của brain
const DOT_VIB_SLOTS = 7;
const DOT_NATURAL_OF_PC = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // pitch class -> C D E F G A B
const DOT_VIB_AMP_FRAC = 0.06;           // biên độ tối đa × min(W,H)
const DOT_VIB_DECAY_TAU_MS = 380;
const DOT_VIB_ENERGY_GAIN = 1.3;
const DOT_VIB_HZ_BASE = 5;
const DOT_VIB_HZ_STEP = 0.6;

/** Dựng hình trục: vị trí/tiếp tuyến/pháp tuyến từng dot (rải đều theo độ dài cung) + bán kính theo
 * khoảng cách dot. Hình mở: dot i ở s = i/(N-1); hình kín: s = i/N (không trùng điểm đầu). SỬA (25/09/2026,
 * lượt 2): bỏ polyline vẽ + mũi tên (không còn vẽ đường nối/mũi tên).
 * @returns {{shape, closed, dots:{x,y,tx,ty,nx,ny,u}[], baseRadius, maxRadius}} */
function buildDotAxisGeometry(shape, W, H, dotCount) {
    const shp = DOT_AXIS_SHAPES.includes(shape) ? shape : 'line';
    const minWH = Math.min(W, H);
    const closed = shp === 'circle' || shp === 'square' || shp === 'triangle';
    const x0 = W * DOT_AXIS_MARGIN_X_FRAC, x1 = W * (1 - DOT_AXIS_MARGIN_X_FRAC), len = x1 - x0;
    const cx = W / 2, cy = H / 2;

    // 1) Polyline thô theo hình
    const raw = [];
    if (shp === 'sinDown' || shp === 'sinUp') {
        const amp = minWH * DOT_SIN_ARC_AMP_FRAC, top = cy - amp / 2;
        for (let k = 0; k <= 240; k++) {
            const u = k / 240;
            raw.push({ x: x0 + u * len, y: shp === 'sinDown' ? top + amp * Math.sin(u * Math.PI) : top + amp - amp * Math.sin(u * Math.PI) });
        }
    } else if (shp === 'sinWave') {
        const amp = minWH * DOT_WAVE_AMP_FRAC;
        for (let k = 0; k <= 480; k++) {
            const u = k / 480;
            raw.push({ x: x0 + u * len, y: cy - amp * Math.sin(u * Math.PI * 2 * DOT_WAVE_PERIODS) });
        }
    } else if (shp === 'squareWave') {
        const amp = minWH * DOT_WAVE_AMP_FRAC, w = len / DOT_SQUARE_PULSES;
        raw.push({ x: x0, y: cy + amp }, { x: x0, y: cy - amp });
        for (let p = 0; p < DOT_SQUARE_PULSES; p++) {
            const xm = x0 + p * w + w / 2, xe = x0 + (p + 1) * w;
            raw.push({ x: xm, y: cy - amp }, { x: xm, y: cy + amp }, { x: xe, y: cy + amp });
            if (p < DOT_SQUARE_PULSES - 1) raw.push({ x: xe, y: cy - amp });
        }
    } else if (shp === 'circle') {
        const r = Math.min(W * DOT_CLOSED_W_FRAC, H * DOT_CLOSED_H_FRAC) / 2;
        for (let k = 0; k <= 360; k++) {
            const a = -Math.PI / 2 + (k / 360) * Math.PI * 2;
            raw.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
        }
    } else if (shp === 'square') {
        const side = Math.min(W * DOT_CLOSED_W_FRAC, H * DOT_CLOSED_H_FRAC), h = side / 2;
        raw.push({ x: cx - h, y: cy - h }, { x: cx + h, y: cy - h }, { x: cx + h, y: cy + h }, { x: cx - h, y: cy + h }, { x: cx - h, y: cy - h });
    } else if (shp === 'triangle') {
        const hgt = Math.min(H * DOT_CLOSED_H_FRAC, W * DOT_CLOSED_W_FRAC * Math.sqrt(3) / 2), side = hgt * 2 / Math.sqrt(3);
        const top = cy - hgt / 2;
        raw.push({ x: cx, y: top }, { x: cx + side / 2, y: top + hgt }, { x: cx - side / 2, y: top + hgt }, { x: cx, y: top });
    } else {
        raw.push({ x: x0, y: cy }, { x: x1, y: cy });
    }

    // 2) Độ dài cung tích luỹ + hàm lấy điểm theo độ dài (helper CỤC BỘ)
    const cum = [0];
    for (let k = 1; k < raw.length; k++) cum.push(cum[k - 1] + Math.hypot(raw[k].x - raw[k - 1].x, raw[k].y - raw[k - 1].y));
    const total = Math.max(1e-6, cum[cum.length - 1]);
    let seg = 1;
    const pointAt = (s) => { // s tăng dần qua mỗi lần gọi trong cùng 1 vòng -> dò tuyến tính tiếp từ seg cũ
        if (s <= 0) { seg = 1; return { x: raw[0].x, y: raw[0].y }; }
        if (s < cum[seg - 1]) seg = 1;
        while (seg < raw.length - 1 && cum[seg] < s) seg++;
        const a = raw[seg - 1], b = raw[seg], d = cum[seg] - cum[seg - 1];
        const f = d > 0 ? Math.min(1, (s - cum[seg - 1]) / d) : 0;
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    };

    const n = Math.max(2, Math.round(dotCount));
    const denom = closed ? n : n - 1;
    const eps = total / 960;
    const dots = [];
    for (let i = 0; i < n; i++) {
        const u = i / denom, s = u * total;
        const p = pointAt(s);
        // Tiếp tuyến qua 2 điểm lân cận ±eps (hình kín quấn vòng, hình mở kẹp 2 đầu) — pointAt dò tuyến
        // tính nên gọi riêng (không làm lệch seg của vòng chính: seg tự dò lại khi s lùi).
        const sa = closed ? (s - eps + total) % total : Math.max(0, s - eps);
        const sb = closed ? (s + eps) % total : Math.min(total, s + eps);
        const pa = pointAt(sa), pb = pointAt(sb);
        let tx = pb.x - pa.x, ty = pb.y - pa.y;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl; ty /= tl;
        dots.push({ x: p.x, y: p.y, tx, ty, nx: -ty, ny: tx, u });
    }

    const spacing = total / denom;
    return { shape: shp, closed, dots, baseRadius: spacing * DOT_BASE_RADIUS_FRAC, maxRadius: spacing * DOT_MAX_RADIUS_FRAC };
}

/** Đỉnh năng lượng gần đây (peak-hold tắt dần theo dt thật) — mốc chuẩn hoá quãng đường sóng. THUẦN. */
function computeDotEnergyPeak(prevPeak, energy, dt) {
    const e = isFinite(energy) ? energy : 0;
    return Math.max(e, prevPeak * Math.exp(-dt / DOT_ENERGY_PEAK_TAU_MS));
}

/** Nốt MIDI -> số dot trong cụm (1-7, chia đều 12 semitone thành 7 mức). null -> 1. THUẦN. */
function pitchToDotClusterSize(midiNote) {
    if (midiNote === null || midiNote === undefined) return 1;
    const level = Math.floor(((midiNote % 12 + 12) % 12) / 12 * 7);
    return Math.min(7, Math.max(1, level + 1));
}

/** Danh sách cụm MỚI: thêm cụm (nếu `spawn` != null) + bỏ cụm đã dịch hết (t >= 1). Quãng đường cụm =
 * năng lượng chuẩn hoá (0-1) × toàn trục — trục chỉ là mốc tối đa. THUẦN.
 * @param spawn {{ normEnergy:number, clusterSize:number } | null} */
function stepDotClusters(clusters, time, spawn, dotCount) {
    const next = clusters.filter((c) => (time - c.startTime) / DOT_CLUSTER_TRAVEL_MS < 1);
    if (spawn) {
        next.push({
            startTime: time,
            clusterSize: spawn.clusterSize,
            travelDots: Math.min(1, Math.max(0, spawn.normEnergy)) * (dotCount - 1),
        });
    }
    return next;
}

/** Độ phồng MỤC TIÊU từng dot (0-1) — MAX qua mọi cụm (không cộng dồn). `clusterEnergies[c][k]` = năng
 * lượng dải tần (0-1) của dot thứ k trong cụm c (Workflow tính sẵn bằng computeNeuronBinEnergy()); nội
 * suy tuyến tính giữa 2 dải liền kề theo vị trí thực, mép cụm chuyển mượt qua đúng 1 dot. THUẦN.
 * @returns {Float32Array} */
function computeDotTargetBoosts(clusters, clusterEnergies, time, dotCount) {
    const out = new Float32Array(dotCount);
    for (let c = 0; c < clusters.length; c++) {
        const cl = clusters[c];
        const t = (time - cl.startTime) / DOT_CLUSTER_TRAVEL_MS;
        if (t < 0 || t > 1) continue;
        const start = t * cl.travelDots, size = cl.clusterSize, en = clusterEnergies[c];
        const iFrom = Math.max(0, Math.floor(start) - 1), iTo = Math.min(dotCount - 1, Math.ceil(start + size));
        for (let i = iFrom; i <= iTo; i++) {
            const rel = i - start;
            if (rel <= -1 || rel >= size) continue;
            const coverage = (rel >= 0 && rel <= size - 1) ? 1 : (rel < 0 ? 1 + rel : 1 - (rel - (size - 1)));
            const lo = Math.min(size - 1, Math.max(0, Math.floor(rel)));
            const hi = Math.min(size - 1, lo + 1);
            const f = rel - Math.floor(rel);
            const e = en[lo] + (en[hi] - en[lo]) * f;
            out[i] = Math.max(out[i], coverage * e);
        }
    }
    return out;
}

/** EMA độ phồng — mutate `smoothed` (Float32Array nhận qua tham số, Workflow giữ). */
function smoothDotBoosts(smoothed, targets) {
    for (let i = 0; i < smoothed.length; i++) smoothed[i] += (targets[i] - smoothed[i]) * DOT_SMOOTH_ALPHA;
}

/** Năng lượng FFT (0-1) đúng tần số nốt MIDI (đỉnh bin gần nhất ±1) — cùng công thức dây output brain.
 * THUẦN. */
function computeDotNoteEnergy(midiNote, vizDataArray, bufferLength, sampleRate) {
    if (midiNote === null || midiNote === undefined || !vizDataArray || !bufferLength) return 0;
    const freq = 440 * Math.pow(2, (midiNote - 69) / 12);
    const bin = Math.round(freq / ((sampleRate || 44100) / (bufferLength * 2)));
    if (bin >= bufferLength) return 0;
    let peak = 0;
    for (let i = Math.max(0, bin - 1); i <= Math.min(bufferLength - 1, bin + 1); i++) peak = Math.max(peak, vizDataArray[i] || 0);
    return peak / 255;
}

/** Bước biên độ 7 vị trí rung — mutate `amps` (Float32Array(7), Workflow giữ): mọi vị trí tắt dần theo
 * dt thật; nốt đang phát (`midiNote` != null) giữ vị trí của nó >= năng lượng nốt. */
function stepDotLineVibration(amps, dt, midiNote, noteEnergy) {
    const decay = Math.exp(-dt / DOT_VIB_DECAY_TAU_MS);
    const active = (midiNote === null || midiNote === undefined) ? -1 : DOT_NATURAL_OF_PC[((midiNote % 12) + 12) % 12];
    const target = Math.min(1, noteEnergy * DOT_VIB_ENERGY_GAIN);
    for (let k = 0; k < amps.length; k++) amps[k] = k === active ? Math.max(amps[k] * decay, target) : amps[k] * decay;
}

/** Độ lệch (px, theo pháp tuyến) của line đang rung tại vị trí u (0-1) — tổng 7 dây gảy: vị trí k gảy
 * tại u0 = (k + 0.5) / 7, dạng dây gảy (0 ở 2 đầu, đỉnh tại u0), dao động sin tần số riêng. THUẦN. */
function computeDotLineDisplacement(u, amps, time, ampPx) {
    let d = 0;
    for (let k = 0; k < amps.length; k++) {
        if (amps[k] < 0.001) continue;
        const u0 = (k + 0.5) / DOT_VIB_SLOTS;
        const shape = u <= u0 ? Math.sin((Math.PI / 2) * (u / u0)) : Math.sin((Math.PI / 2) * ((1 - u) / (1 - u0)));
        const hz = DOT_VIB_HZ_BASE + k * DOT_VIB_HZ_STEP;
        d += amps[k] * shape * Math.sin(time * 0.001 * Math.PI * 2 * hz);
    }
    return d * ampPx;
}

// ======================================== Rắn bò ========================================
const DOT_SNAKE_SPEED_FRAC = 0.22;          // tốc độ bò nền × min(W,H) / giây
const DOT_SNAKE_SPEED_ENERGY_FRAC = 0.45;   // + smoothedEnergy × hệ số này × min(W,H) / giây
const DOT_SNAKE_TURN_RADIUS_FRAC = 0.1;     // bán kính vòng quay nhỏ nhất × min(W,H) — quay theo QUÃNG bò (nhanh hay chậm đều vòng như nhau), không bẻ gắt
const DOT_SNAKE_EDGE_FRAC = 0.1;            // điểm NHÌN TRƯỚC của đầu rắn lọt ra ngoài lề này (× W/H) -> quay về giữa màn hình
const DOT_SNAKE_LOOKAHEAD_FRAC = 0.3;       // nhìn trước theo hướng bò × min(W,H) — né mép từ sớm, không đâm ra rồi mới quay
const DOT_SNAKE_SLITHER_AMP = 0.55;         // biên độ uốn lượn (rad) quanh hướng bò
const DOT_SNAKE_SLITHER_WAVELEN_FRAC = 0.28; // bước sóng uốn lượn × min(W,H) (theo quãng đã bò)
// Lang thang (THAY con mồi, 25/09/2026 lượt 3): sau mỗi quãng ngẫu nhiên chọn độ cong mới (−1..1 × độ
// cong tối đa × hệ số dưới), độ cong hiện tại tiến mượt về đó theo quãng bò.
const DOT_SNAKE_WANDER_CURV_FRAC = 0.6;     // độ cong mục tiêu tối đa × độ cong tối đa (1 / bán kính quay)
const DOT_SNAKE_WANDER_MIN_FRAC = 0.3;      // quãng giữ 1 độ cong: từ × min(W,H)
const DOT_SNAKE_WANDER_RANGE_FRAC = 0.5;    //                    + ngẫu nhiên tới × min(W,H)
const DOT_SNAKE_CURV_EASE_FRAC = 0.2;       // độ cong hiện tại tiến hết về mục tiêu sau ~ × min(W,H) quãng bò

/** Rắn mới: nằm ngang giữa màn hình (đầu bên phải, thân kéo sang trái, hướng bò sang phải), khoảng cách
 * dot bằng đúng khoảng cách hình 'line' nên cỡ dot khớp style tĩnh. THUẦN.
 * @returns {{head, heading, phase, curv, curvTarget, wanderLeft, trail:{x,y}[], spacing, baseRadius, maxRadius, W, H}} */
function initDotSnake(W, H, dotCount) {
    const n = Math.max(2, Math.round(dotCount));
    const len = W * (1 - 2 * DOT_AXIS_MARGIN_X_FRAC);
    const spacing = len / (n - 1);
    const head = { x: W / 2 + len / 2, y: H / 2 };
    const trail = [];
    for (let k = 0; k <= 64; k++) trail.push({ x: head.x - (k / 64) * len, y: head.y });
    return {
        head, heading: 0, phase: 0, curv: 0, curvTarget: 0, wanderLeft: 0, trail,
        spacing, baseRadius: spacing * DOT_BASE_RADIUS_FRAC, maxRadius: spacing * DOT_MAX_RADIUS_FRAC, W, H,
    };
}

/** 1 bước rắn — trả state MỚI: lang thang theo độ cong ngẫu nhiên mượt (sát mép thì quay về tâm màn
 * hình với độ cong tối đa), bò theo hướng đó + uốn lượn sin theo quãng đã bò, ghi vết đầu (cắt bớt
 * phần dài hơn thân). `dtSec` giây, `energy` 0-1. THUẦN (Math.random cho độ cong mục tiêu). */
function stepDotSnake(snake, dtSec, energy, dotCount) {
    const W = snake.W, H = snake.H, minWH = Math.min(W, H);
    const speed = minWH * (DOT_SNAKE_SPEED_FRAC + (isFinite(energy) ? Math.max(0, energy) : 0) * DOT_SNAKE_SPEED_ENERGY_FRAC);
    const dist = speed * dtSec;
    const maxCurv = 1 / (minWH * DOT_SNAKE_TURN_RADIUS_FRAC);

    // Chọn độ cong mục tiêu mới sau mỗi quãng lang thang
    let curvTarget = snake.curvTarget, wanderLeft = snake.wanderLeft - dist;
    if (wanderLeft <= 0) {
        curvTarget = (Math.random() * 2 - 1) * maxCurv * DOT_SNAKE_WANDER_CURV_FRAC;
        wanderLeft = minWH * (DOT_SNAKE_WANDER_MIN_FRAC + Math.random() * DOT_SNAKE_WANDER_RANGE_FRAC);
    }
    let curv = snake.curv + (curvTarget - snake.curv) * Math.min(1, dist / (minWH * DOT_SNAKE_CURV_EASE_FRAC));

    // Điểm nhìn trước sắp ra mép -> quay về tâm màn hình (lệch ngắn nhất theo 2π), độ cong tối đa
    const ex = W * DOT_SNAKE_EDGE_FRAC, ey = H * DOT_SNAKE_EDGE_FRAC, look = minWH * DOT_SNAKE_LOOKAHEAD_FRAC;
    const lx = snake.head.x + Math.cos(snake.heading) * look, ly = snake.head.y + Math.sin(snake.heading) * look;
    const nearEdge = lx < ex || lx > W - ex || ly < ey || ly > H - ey;
    let turn = curv * dist;
    if (nearEdge) {
        let d = (Math.atan2(H / 2 - snake.head.y, W / 2 - snake.head.x) - snake.heading) % (Math.PI * 2);
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        turn = Math.max(-maxCurv * dist, Math.min(maxCurv * dist, d));
        curv = turn / Math.max(dist, 1e-6); // ra khỏi mép tiếp tục cong mượt từ độ cong đang quay
    }
    const heading = (snake.heading + turn) % (Math.PI * 2);

    // Uốn lượn — pha tiến theo quãng đã bò (không theo thời gian) -> đứng yên thì không lắc
    const phase = (snake.phase + (dist / (minWH * DOT_SNAKE_SLITHER_WAVELEN_FRAC)) * Math.PI * 2) % (Math.PI * 2);
    const moveAngle = heading + DOT_SNAKE_SLITHER_AMP * Math.sin(phase);
    const head = { x: snake.head.x + Math.cos(moveAngle) * dist, y: snake.head.y + Math.sin(moveAngle) * dist };

    // Vết: đầu mới ở [0]; bỏ điểm quá gần (đứng yên) và cắt phần dài hơn thân + 1 khoảng dot
    const bodyLen = snake.spacing * (Math.max(2, Math.round(dotCount)) - 1) + snake.spacing;
    const trail = [head];
    let acc = 0;
    for (let k = 0; k < snake.trail.length; k++) {
        const prev = trail[trail.length - 1], p = snake.trail[k];
        const seg = Math.hypot(p.x - prev.x, p.y - prev.y);
        if (k === 0 && seg < 0.5) continue;
        trail.push(p);
        acc += seg;
        if (acc > bodyLen) break;
    }

    return { ...snake, head, heading, phase, curv, curvTarget, wanderLeft, trail };
}

/** Vị trí dot dọc vết rắn: dot i cách đầu i × spacing (theo độ dài cung), tiếp tuyến chỉ từ đầu -> đuôi
 * (cùng quy ước chiều chạy sóng dot 0 -> N-1). Vết ngắn hơn thân (vừa tăng số dot) -> dot dồn ở cuối
 * vết. THUẦN. @returns {{x,y,tx,ty,nx,ny,u}[]} */
function sampleDotSnakeBody(snake, dotCount) {
    const n = Math.max(2, Math.round(dotCount));
    const tr = snake.trail;
    const dots = [];
    let seg = 1, segStart = 0;
    for (let i = 0; i < n; i++) {
        const s = i * snake.spacing;
        while (seg < tr.length - 1 && segStart + Math.hypot(tr[seg].x - tr[seg - 1].x, tr[seg].y - tr[seg - 1].y) < s) {
            segStart += Math.hypot(tr[seg].x - tr[seg - 1].x, tr[seg].y - tr[seg - 1].y);
            seg++;
        }
        const a = tr[Math.min(seg - 1, tr.length - 1)], b = tr[Math.min(seg, tr.length - 1)];
        const segLen = Math.hypot(b.x - a.x, b.y - a.y);
        const f = segLen > 0 ? Math.min(1, Math.max(0, (s - segStart) / segLen)) : 0;
        let tx = b.x - a.x, ty = b.y - a.y;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl; ty /= tl;
        if (segLen === 0) { tx = -Math.cos(snake.heading); ty = -Math.sin(snake.heading); }
        dots.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, tx, ty, nx: -ty, ny: tx, u: i / (n - 1) });
    }
    return dots;
}

// ======================================= Vẽ =======================================

/** Vẽ 1 dot. mode 'radius': tròn bán kính `r`. mode 'height': 2 nhánh dài `halfLen` từ tâm dot, dày 2×`r`,
 * đầu tròn — `bend` 'none' thẳng theo pháp tuyến (n); 'gt' (>) 2 nhánh ngả NGƯỢC chiều chạy t (đỉnh chỉ
 * theo t); 'lt' (<) ngả THEO t; 'slash'/'backslash' cả dải xoay ±góc (/ hoặc \). `bendDeg` = góc lệch
 * khỏi pháp tuyến. `blurPx` = 0 -> không glow. `alpha` (mặc định 1) — trả globalAlpha về 1 sau khi vẽ.
 * Chỉ Canvas API. */
function paintDotAxisDot(ctx, dot, x, y, mode, r, halfLen, bend, bendDeg, color, glowColor, blurPx, alpha) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha; // (25/09/2026 lượt 4) chiều sâu / hiện dần của DNA
    ctx.shadowBlur = blurPx;
    ctx.shadowColor = blurPx > 0 ? glowColor : 'transparent';
    if (mode === 'height' && halfLen > 0.01) {
        const a = (bend && bend !== 'none' ? bendDeg : 0) * Math.PI / 180;
        const c = Math.cos(a), sn = Math.sin(a);
        // Hướng nhánh trên (u) và nhánh dưới (l): tổ hợp pháp tuyến n và tiếp tuyến t
        let ux = dot.nx * c, uy = dot.ny * c, lx = -dot.nx * c, ly = -dot.ny * c;
        // (n = (-ty, tx): trục trái->phải thì n chỉ XUỐNG màn hình — '/' = nhánh n ngả về -t, nhánh -n về +t)
        const tShiftU = bend === 'gt' ? -sn : bend === 'lt' ? sn : bend === 'slash' ? -sn : bend === 'backslash' ? sn : 0;
        const tShiftL = bend === 'gt' ? -sn : bend === 'lt' ? sn : bend === 'slash' ? sn : bend === 'backslash' ? -sn : 0;
        ux += dot.tx * tShiftU; uy += dot.ty * tShiftU;
        lx += dot.tx * tShiftL; ly += dot.ty * tShiftL;
        ctx.strokeStyle = color;
        ctx.lineWidth = r * 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x + lx * halfLen, y + ly * halfLen);
        ctx.lineTo(x, y);
        ctx.lineTo(x + ux * halfLen, y + uy * halfLen);
        ctx.stroke();
        ctx.globalAlpha = 1;
        return;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}

// ================================== Chuyển vị trí mượt ==================================
const DOT_BASE_BLEND_MS = 650; // trượt từ vị trí cũ sang vị trí mới khi đổi rắn <-> hình tĩnh

/** Vị trí dot trộn từ `from` ({x,y}[]) sang `to` (dot đầy đủ) theo t (0-1, ease in-out). Giữ tiếp/pháp
 * tuyến của `to`. Độ dài lệch nhau -> trả nguyên `to`. THUẦN. */
function blendDotPositions(from, to, t) {
    if (!from || from.length !== to.length || t >= 1) return to;
    const k = t <= 0 ? 0 : (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    return to.map((d, i) => ({ ...d, x: from[i].x + (d.x - from[i].x) * k, y: from[i].y + (d.y - from[i].y) * k }));
}

// ========================================= DNA =========================================
const DOT_DNA_PAIRS_PER_TURN = 10;       // cặp dot / 1 vòng xoắn (DNA thật ~10.5 cặp base/vòng)
const DOT_DNA_RADIUS_FRAC = 0.08;        // bán kính xoắn × min(W,H)
const DOT_DNA_ROT_SPEED = 1.1;           // tốc độ xoay nền (rad/giây)
const DOT_DNA_ROT_ENERGY = 2.2;          // + smoothedEnergy × hệ số này (rad/giây)
const DOT_DNA_SPAWN_MS = 1500;           // nhân đôi + xoắn hết cỡ (mọi cặp cùng lúc)
const DOT_DNA_APPEAR_FRAC = 0.3;         // level 0 -> 0.3: chuỗi 2 HIỆN DẦN tại chỗ; 0.3 -> 1: tách + xoắn
const DOT_DNA_BREAK_STAGGER_MS = 45;     // cặp i bắt đầu đứt sau i × khoảng này (lần lượt từ cặp đầu)
const DOT_DNA_BOND_BREAK_MS = 180;       // thanh nối rút hết về 2 dot
const DOT_DNA_MERGE_MS = 450;            // 2 dot của cặp đã đứt khép lại nhập 1
const DOT_DNA_BACK_ALPHA = 0.5;          // chuỗi phía sau: độ đậm tối thiểu
const DOT_DNA_DEPTH_SCALE = 0.25;        // ± cỡ dot theo chiều sâu
const DOT_DNA_BOND_WIDTH = 1.5;          // × dpr
const DOT_DNA_BOND_ALPHA = 0.45;

/** Bước trạng thái từng cặp — mutate `levels`/`bonds` (Float32Array, Workflow giữ). `dnaOn`: nhân đôi +
 * xoắn (mọi cặp cùng tiến, thanh nối dài theo độ tách); tắt: cặp i bắt đầu khi `breakClockMs` ≥ i ×
 * stagger — thanh nối rút trước, rút hết thì cặp khép lại. @returns {number} level lớn nhất (0 = hết DNA). */
function stepDotDnaPairs(levels, bonds, dt, dnaOn, breakClockMs) {
    let maxLevel = 0;
    for (let i = 0; i < levels.length; i++) {
        if (dnaOn) {
            levels[i] = Math.min(1, levels[i] + dt / DOT_DNA_SPAWN_MS);
            const sep = Math.max(0, (levels[i] - DOT_DNA_APPEAR_FRAC) / (1 - DOT_DNA_APPEAR_FRAC));
            bonds[i] = sep * sep * (3 - 2 * sep);
        } else if (levels[i] > 0 && breakClockMs >= i * DOT_DNA_BREAK_STAGGER_MS) {
            if (bonds[i] > 0) bonds[i] = Math.max(0, bonds[i] - dt / DOT_DNA_BOND_BREAK_MS);
            else levels[i] = Math.max(0, levels[i] - dt / DOT_DNA_MERGE_MS);
        }
        if (levels[i] > maxLevel) maxLevel = levels[i];
    }
    return maxLevel;
}

/** Vị trí + chiều sâu 2 dot của cặp i quanh dot gốc `dot` (lệch theo pháp tuyến). `level` 0-1 (xem
 * DOT_DNA_APPEAR_FRAC), `rot` góc xoay hiện tại, `radius` px. THUẦN.
 * @returns {{ax, ay, az, bx, by, bz, sep, appear}} — az/bz ∈ [-1,1] (1 = phía trước), sep = độ tách 0-1,
 * appear = độ hiện của chuỗi 2 (0-1). */
function computeDotDnaPair(dot, i, level, rot, radius) {
    const appear = Math.min(1, level / DOT_DNA_APPEAR_FRAC);
    const t = Math.max(0, (level - DOT_DNA_APPEAR_FRAC) / (1 - DOT_DNA_APPEAR_FRAC));
    const sep = t * t * (3 - 2 * t);
    const th = (i / DOT_DNA_PAIRS_PER_TURN) * Math.PI * 2 + rot;
    const off = Math.sin(th) * radius * sep, z = Math.cos(th);
    return { ax: dot.x + dot.nx * off, ay: dot.y + dot.ny * off, az: z, bx: dot.x - dot.nx * off, by: dot.y - dot.ny * off, bz: -z, sep, appear };
}

/** Hệ số cỡ + độ đậm theo chiều sâu z (-1 sau .. 1 trước), ăn theo độ tách `sep` (chưa tách = 1/1). THUẦN. */
function computeDotDnaDepth(z, sep) {
    const f = (z + 1) / 2;
    return { scale: 1 + (f * 2 - 1) * DOT_DNA_DEPTH_SCALE * sep, alpha: 1 - (1 - (DOT_DNA_BACK_ALPHA + (1 - DOT_DNA_BACK_ALPHA) * f)) * sep };
}

/** Thanh nối 1 cặp: 2 nửa từ mỗi dot về điểm giữa, dài theo `bond` (0-1) — mọc ra khi xoắn, rút về 2
 * dot khi đứt. Chỉ Canvas API. */
function paintDotDnaBond(ctx, ax, ay, bx, by, bond, color, dpr) {
    if (bond <= 0.001) return;
    const mx = (ax + bx) / 2, my = (ay + by) / 2;
    ctx.save();
    ctx.globalAlpha = DOT_DNA_BOND_ALPHA;
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = DOT_DNA_BOND_WIDTH * dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ax, ay); ctx.lineTo(ax + (mx - ax) * bond, ay + (my - ay) * bond);
    ctx.moveTo(bx, by); ctx.lineTo(bx + (mx - bx) * bond, by + (my - by) * bond);
    ctx.stroke();
    ctx.restore();
}
