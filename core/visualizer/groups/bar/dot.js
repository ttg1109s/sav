/**
 * core/visualizer/groups/bar/dot.js — style 'dot' của group bar: dãy `dotCount` dot đều nhau dọc 1 hình trục (chuyển từ
 * trục thời gian của connector brain). Mỗi beat thật sinh 1 CỤM 1-7 dot (theo nốt) từ đầu trục, dịch mượt dọc trục trong
 * DOT_CLUSTER_TRAVEL_MS; dot trong cụm phồng theo năng lượng dải tần riêng, làm mượt EMA.
 *   - Quãng đường mỗi cụm = năng lượng lúc beat (chuẩn hoá theo đỉnh gần đây, DOT_ENERGY_PEAK_TAU_MS) × toàn trục.
 *   - Kiểu tác động: 'radius' (phồng bán kính) | 'height' (2 nhánh vuông góc trục, dạng viên thuốc; `dotBend` bẻ góc
 *     'gt' (>) / 'lt' (<) / 'slash' (/) / 'backslash' (\) / 'none').
 *   - Hình trục: line, sinDown, sinUp, sinWave, squareWave, circle, square, triangle — chỉ quyết định VỊ TRÍ dot (không vẽ).
 *   - 'line' + `dotLineVibrate`: dây rung đàn hồi (7 vị trí theo nốt C..B, biên độ theo năng lượng đúng tần số nốt).
 *   - Mọi dot cùng 1 màu/frame (mode gradient: dải màu theo vị trí); dot tác động khác ở kích thước + glow (perf.blurMult).
 *   - `dotMoving`: 'snake' (đầu rắn bò lang thang, thân bám vết, quay về giữa khi sát mép, tốc độ theo năng lượng) | 'dna'
 *     (dãy tự nhân đôi -> 2 chuỗi xoắn kép quanh trục, có thanh nối, chuỗi sau nhỏ + mờ hơn; tắt thì đứt lần lượt từng cặp
 *     rồi khép lại). Đổi rắn <-> hình tĩnh trượt mượt (blendDotPositions()).
 * Hàm thuần / chỉ Canvas API, không appState, không gọi hàm tự viết khác. State (cụm, EMA, đỉnh, rung, hình cache) do
 * Workflow event/workflow/visualizer/bar.js giữ và truyền vào.
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

/** Hình khép kín (dot rải s = i/N, tiếp tuyến quấn vòng); còn lại là hình mở (s = i/(N-1), kẹp 2 đầu). */
const DOT_AXIS_CLOSED_SHAPES = ['circle', 'square', 'triangle'];

// Dựng hình trục (Workflow ghép, event/workflow/visualizer/bar.js::_ensureDotGeometry()): resolveDotAxisShape() ->
// computeDotAxisFrame() -> 1 hàm buildDotAxisRaw*() theo hình (polyline thô) -> measureDotAxisPath() -> kế hoạch rải dot
// mở / kín -> sampleDotAxisPoints() (vị trí + 2 điểm lân cận làm tiếp tuyến) -> assembleDotAxisGeometry(). Dot rải đều theo
// ĐỘ DÀI CUNG thật (xung vuông có cạnh đứng — rải theo tham số sẽ không có dot nào trên cạnh đứng).

/** Hình hợp lệ (lạ -> 'line') + kín/mở. @param {string} shape @returns {{shape: string, closed: boolean}} */
function resolveDotAxisShape(shape) {
    const resolved = DOT_AXIS_SHAPES.includes(shape) ? shape : 'line';
    return { shape: resolved, closed: DOT_AXIS_CLOSED_SHAPES.includes(resolved) };
}

/** Khung chung các hình: lề trái/phải hình mở, tâm, cạnh ngắn. @returns {{W, H, x0, x1, len, cx, cy, minWH}} */
function computeDotAxisFrame(W, H) {
    const x0 = W * DOT_AXIS_MARGIN_X_FRAC, x1 = W * (1 - DOT_AXIS_MARGIN_X_FRAC);
    return { W, H, x0, x1, len: x1 - x0, cx: W / 2, cy: H / 2, minWH: Math.min(W, H) };
}

/** Cung sin võng xuống ('sinDown') / vồng lên ('sinUp' — `inverted`, đối xứng qua trục ngang). @returns {{x, y}[]} */
function buildDotAxisRawSinArc(f, inverted) {
    const amp = f.minWH * DOT_SIN_ARC_AMP_FRAC, top = f.cy - amp / 2;
    const base = inverted ? amp : 0;
    const sign = inverted ? -1 : 1;
    const raw = [];
    for (let k = 0; k <= 240; k++) {
        const u = k / 240;
        raw.push({ x: f.x0 + u * f.len, y: top + base + sign * amp * Math.sin(u * Math.PI) });
    }
    return raw;
}

/** Sóng sin DOT_WAVE_PERIODS chu kỳ. @returns {{x, y}[]} */
function buildDotAxisRawSinWave(f) {
    const amp = f.minWH * DOT_WAVE_AMP_FRAC;
    const raw = [];
    for (let k = 0; k <= 480; k++) {
        const u = k / 480;
        raw.push({ x: f.x0 + u * f.len, y: f.cy - amp * Math.sin(u * Math.PI * 2 * DOT_WAVE_PERIODS) });
    }
    return raw;
}

/** Xung vuông DOT_SQUARE_PULSES xung (cạnh đứng thật). @returns {{x, y}[]} */
function buildDotAxisRawSquareWave(f) {
    const amp = f.minWH * DOT_WAVE_AMP_FRAC, w = f.len / DOT_SQUARE_PULSES;
    const raw = [{ x: f.x0, y: f.cy + amp }, { x: f.x0, y: f.cy - amp }];
    for (let p = 0; p < DOT_SQUARE_PULSES; p++) {
        const xm = f.x0 + p * w + w / 2, xe = f.x0 + (p + 1) * w;
        raw.push({ x: xm, y: f.cy - amp }, { x: xm, y: f.cy + amp }, { x: xe, y: f.cy + amp });
        if (p < DOT_SQUARE_PULSES - 1) raw.push({ x: xe, y: f.cy - amp });
    }
    return raw;
}

/** Vòng tròn (bắt đầu từ đỉnh trên, khép kín). @returns {{x, y}[]} */
function buildDotAxisRawCircle(f) {
    const r = Math.min(f.W * DOT_CLOSED_W_FRAC, f.H * DOT_CLOSED_H_FRAC) / 2;
    const raw = [];
    for (let k = 0; k <= 360; k++) {
        const a = -Math.PI / 2 + (k / 360) * Math.PI * 2;
        raw.push({ x: f.cx + Math.cos(a) * r, y: f.cy + Math.sin(a) * r });
    }
    return raw;
}

/** Hình vuông khép kín. @returns {{x, y}[]} */
function buildDotAxisRawSquare(f) {
    const h = Math.min(f.W * DOT_CLOSED_W_FRAC, f.H * DOT_CLOSED_H_FRAC) / 2;
    return [{ x: f.cx - h, y: f.cy - h }, { x: f.cx + h, y: f.cy - h }, { x: f.cx + h, y: f.cy + h }, { x: f.cx - h, y: f.cy + h }, { x: f.cx - h, y: f.cy - h }];
}

/** Tam giác đều khép kín (đỉnh trên). @returns {{x, y}[]} */
function buildDotAxisRawTriangle(f) {
    const hgt = Math.min(f.H * DOT_CLOSED_H_FRAC, f.W * DOT_CLOSED_W_FRAC * Math.sqrt(3) / 2), side = hgt * 2 / Math.sqrt(3);
    const top = f.cy - hgt / 2;
    return [{ x: f.cx, y: top }, { x: f.cx + side / 2, y: top + hgt }, { x: f.cx - side / 2, y: top + hgt }, { x: f.cx, y: top }];
}

/** Đường thẳng ngang giữa màn hình. @returns {{x, y}[]} */
function buildDotAxisRawLine(f) {
    return [{ x: f.x0, y: f.cy }, { x: f.x1, y: f.cy }];
}

/** Độ dài cung tích luỹ của polyline. @param {{x, y}[]} raw @returns {{cum: number[], total: number}} */
function measureDotAxisPath(raw) {
    const cum = [0];
    for (let k = 1; k < raw.length; k++) cum.push(cum[k - 1] + Math.hypot(raw[k].x - raw[k - 1].x, raw[k].y - raw[k - 1].y));
    return { cum, total: Math.max(1e-6, cum[cum.length - 1]) };
}

/** Kế hoạch rải dot hình MỞ: dot i ở s = i/(N-1); 2 điểm lân cận ±eps kẹp trong [0, total].
 * @returns {{us: number[], ss: number[], sas: number[], sbs: number[], spacing: number}} */
function planDotAxisSamplingOpen(total, dotCount) {
    const n = Math.max(2, Math.round(dotCount));
    const eps = total / 960;
    const us = Array.from({ length: n }, (_, i) => i / (n - 1));
    const ss = us.map((u) => u * total);
    return { us, ss, sas: ss.map((s) => Math.max(0, s - eps)), sbs: ss.map((s) => Math.min(total, s + eps)), spacing: total / (n - 1) };
}

/** Kế hoạch rải dot hình KÍN: dot i ở s = i/N (không trùng điểm đầu); 2 điểm lân cận ±eps quấn vòng. @returns như trên */
function planDotAxisSamplingClosed(total, dotCount) {
    const n = Math.max(2, Math.round(dotCount));
    const eps = total / 960;
    const us = Array.from({ length: n }, (_, i) => i / n);
    const ss = us.map((u) => u * total);
    return { us, ss, sas: ss.map((s) => (s - eps + total) % total), sbs: ss.map((s) => (s + eps) % total), spacing: total / n };
}

/** Điểm trên polyline tại từng độ dài cung `sValues` (dò tuyến tính tiếp từ đoạn trước; s lùi thì dò lại từ đầu).
 * @param {{x, y}[]} raw @param {number[]} cum - measureDotAxisPath() @param {number[]} sValues @returns {{x, y}[]} */
function sampleDotAxisPoints(raw, cum, sValues) {
    let seg = 1;
    return sValues.map((s) => {
        if (s <= 0) { seg = 1; return { x: raw[0].x, y: raw[0].y }; }
        if (s < cum[seg - 1]) seg = 1;
        while (seg < raw.length - 1 && cum[seg] < s) seg++;
        const a = raw[seg - 1], b = raw[seg], d = cum[seg] - cum[seg - 1];
        const f = d > 0 ? Math.min(1, (s - cum[seg - 1]) / d) : 0;
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
    });
}

/** Ghép hình trục: vị trí + tiếp tuyến (qua 2 điểm lân cận) + pháp tuyến từng dot, bán kính theo khoảng cách dot.
 * @param {{shape: string, closed: boolean}} axis @param {{x, y}[]} points @param {{x, y}[]} before @param {{x, y}[]} after
 * @param {number[]} us @param {number} spacing @returns {{shape, closed, dots:{x,y,tx,ty,nx,ny,u}[], baseRadius, maxRadius}} */
function assembleDotAxisGeometry(axis, points, before, after, us, spacing) {
    const dots = points.map((p, i) => {
        let tx = after[i].x - before[i].x, ty = after[i].y - before[i].y;
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl; ty /= tl;
        return { x: p.x, y: p.y, tx, ty, nx: -ty, ny: tx, u: us[i] };
    });
    return { shape: axis.shape, closed: axis.closed, dots, baseRadius: spacing * DOT_BASE_RADIUS_FRAC, maxRadius: spacing * DOT_MAX_RADIUS_FRAC };
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

/** Kiểu vẽ 1 dot: mode 'height' còn chiều dài nhánh -> 2 nhánh; còn lại tròn. @returns {'branches'|'round'} */
function resolveDotAxisPaintKind(mode, halfLen) {
    return mode === 'height' && halfLen > 0.01 ? 'branches' : 'round';
}

/** Dot mode 'height': 2 nhánh dài `halfLen` từ tâm, dày 2×`r`, đầu tròn — `bend` 'none' thẳng theo pháp tuyến (n); 'gt'
 * (>) 2 nhánh ngả NGƯỢC chiều chạy t (đỉnh chỉ theo t); 'lt' (<) ngả THEO t; 'slash'/'backslash' cả dải xoay ±góc (/ hoặc
 * \). `bendDeg` = góc lệch khỏi pháp tuyến. `blurPx` = 0 -> không glow. Trả globalAlpha về 1. Chỉ Canvas API. */
function paintDotAxisDotBranches(ctx, dot, x, y, r, halfLen, bend, bendDeg, color, glowColor, blurPx, alpha) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha; // chiều sâu / hiện dần của DNA
    ctx.shadowBlur = blurPx;
    ctx.shadowColor = blurPx > 0 ? glowColor : 'transparent';
    const a = (bend && bend !== 'none' ? bendDeg : 0) * Math.PI / 180;
    const c = Math.cos(a), sn = Math.sin(a);
    // Hướng nhánh trên (u) và nhánh dưới (l): tổ hợp pháp tuyến n và tiếp tuyến t
    // (n = (-ty, tx): trục trái->phải thì n chỉ XUỐNG màn hình — '/' = nhánh n ngả về -t, nhánh -n về +t)
    const tShiftU = bend === 'gt' ? -sn : bend === 'lt' ? sn : bend === 'slash' ? -sn : bend === 'backslash' ? sn : 0;
    const tShiftL = bend === 'gt' ? -sn : bend === 'lt' ? sn : bend === 'slash' ? sn : bend === 'backslash' ? -sn : 0;
    const ux = dot.nx * c + dot.tx * tShiftU, uy = dot.ny * c + dot.ty * tShiftU;
    const lx = -dot.nx * c + dot.tx * tShiftL, ly = -dot.ny * c + dot.ty * tShiftL;
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
}

/** Dot tròn bán kính `r` (mode 'radius', hoặc dot nghỉ). Trả globalAlpha về 1. Chỉ Canvas API. */
function paintDotAxisDotRound(ctx, x, y, r, color, glowColor, blurPx, alpha) {
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.shadowBlur = blurPx;
    ctx.shadowColor = blurPx > 0 ? glowColor : 'transparent';
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

/** DNA bật — nhân đôi + xoắn: mọi cặp cùng tiến, thanh nối dài theo độ tách. Mutate `levels`/`bonds` (Float32Array,
 * Workflow giữ). @returns {number} level lớn nhất */
function stepDotDnaSpawnPairs(levels, bonds, dt) {
    let maxLevel = 0;
    for (let i = 0; i < levels.length; i++) {
        levels[i] = Math.min(1, levels[i] + dt / DOT_DNA_SPAWN_MS);
        const sep = Math.max(0, (levels[i] - DOT_DNA_APPEAR_FRAC) / (1 - DOT_DNA_APPEAR_FRAC));
        bonds[i] = sep * sep * (3 - 2 * sep);
        if (levels[i] > maxLevel) maxLevel = levels[i];
    }
    return maxLevel;
}

/** DNA tắt — phá liên kết: cặp i bắt đầu khi `breakClockMs` ≥ i × stagger; thanh nối rút trước, rút hết thì cặp khép lại
 * (level giảm). Mutate `levels`/`bonds`. @returns {number} level lớn nhất (0 = hết DNA) */
function stepDotDnaBreakPairs(levels, bonds, dt, breakClockMs) {
    let maxLevel = 0;
    for (let i = 0; i < levels.length; i++) {
        if (levels[i] > 0 && breakClockMs >= i * DOT_DNA_BREAK_STAGGER_MS) {
            const bond = bonds[i];
            bonds[i] = Math.max(0, bond - dt / DOT_DNA_BOND_BREAK_MS);
            levels[i] = Math.max(0, levels[i] - (bond > 0 ? 0 : dt / DOT_DNA_MERGE_MS)); // còn thanh nối -> chưa khép
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
