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
const DOT_PATH_SAMPLES = 480;            // số đoạn polyline vẽ trục (rải đều theo độ dài cung)
const DOT_BASE_RADIUS_FRAC = 0.22;       // × khoảng cách 2 dot — baseline
const DOT_MAX_RADIUS_FRAC = 0.48;        // × khoảng cách 2 dot — phồng hết cỡ (mode 'radius')
const DOT_CLUSTER_TRAVEL_MS = 700;       // thời gian 1 cụm dịch hết quãng đường của nó
const DOT_ENERGY_PEAK_TAU_MS = 4000;     // đỉnh năng lượng tắt dần ~4s — mốc chuẩn hoá quãng đường
const DOT_SMOOTH_ALPHA = 0.35;           // EMA mỗi frame độ phồng từng dot
const DOT_IMPACT_MIN = 0.02;             // boost dưới mức này coi như dot nghỉ (xám, không glow)
const DOT_REST_COLOR = '#94a3b8';
const DOT_AXIS_COLOR = '#334155';
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

/** Dựng hình trục: polyline vẽ (rải đều theo độ dài cung) + vị trí/pháp tuyến từng dot + mũi tên + bán
 * kính theo khoảng cách dot. Hình mở: dot i ở s = i/(N-1); hình kín: s = i/N (không trùng điểm đầu).
 * @returns {{shape, closed, path:{x,y,u}[], dots:{x,y,nx,ny,u}[], arrow:{x,y,angle}, baseRadius, maxRadius}} */
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

    const path = [];
    for (let k = 0; k <= DOT_PATH_SAMPLES; k++) {
        const u = k / DOT_PATH_SAMPLES;
        const pt = pointAt(u * total);
        path.push({ x: pt.x, y: pt.y, u });
    }

    const n = Math.max(2, Math.round(dotCount));
    const denom = closed ? n : n - 1;
    const eps = total / (DOT_PATH_SAMPLES * 2);
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
        dots.push({ x: p.x, y: p.y, nx: -ty, ny: tx, u });
    }

    const spacing = total / denom;
    const endPt = closed ? raw[0] : raw[raw.length - 1];
    const prevPt = pointAt(closed ? total * 0.995 : total * 0.985);
    return {
        shape: shp,
        closed,
        path,
        dots,
        arrow: { x: endPt.x, y: endPt.y, angle: Math.atan2(endPt.y - prevPt.y, endPt.x - prevPt.x) },
        baseRadius: spacing * DOT_BASE_RADIUS_FRAC,
        maxRadius: spacing * DOT_MAX_RADIUS_FRAC,
    };
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

/** Vẽ đường trục (nét đứt) qua `points` ({x,y}) — chỉ Canvas API. */
function paintDotAxisPath(ctx, points, closed, dpr) {
    ctx.save();
    ctx.strokeStyle = DOT_AXIS_COLOR;
    ctx.lineWidth = 1.5 * dpr;
    ctx.setLineDash([4 * dpr, 4 * dpr]);
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let k = 1; k < points.length; k++) ctx.lineTo(points[k].x, points[k].y);
    if (closed) ctx.closePath();
    ctx.stroke();
    ctx.restore();
}

/** Vẽ 1 dot. mode 'radius': tròn bán kính `r`; mode 'height': viên thuốc dày 2×`r`, kéo dài `halfLen`
 * mỗi bên theo pháp tuyến (nx, ny). `blurPx` = 0 -> không glow. Chỉ Canvas API. */
function paintDotAxisDot(ctx, x, y, nx, ny, mode, r, halfLen, color, glowColor, blurPx) {
    ctx.shadowBlur = blurPx;
    ctx.shadowColor = blurPx > 0 ? glowColor : 'transparent';
    if (mode === 'height' && halfLen > 0.01) {
        ctx.strokeStyle = color;
        ctx.lineWidth = r * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - nx * halfLen, y - ny * halfLen);
        ctx.lineTo(x + nx * halfLen, y + ny * halfLen);
        ctx.stroke();
        return;
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
}

/** Mũi tên cuối trục (hình kín: tại điểm đầu, chỉ chiều chạy). Chỉ Canvas API. */
function paintDotAxisArrow(ctx, arrow, dpr) {
    ctx.save();
    ctx.shadowBlur = 0;
    ctx.translate(arrow.x, arrow.y);
    ctx.rotate(arrow.angle);
    ctx.beginPath();
    ctx.moveTo(-6 * dpr, -4 * dpr);
    ctx.lineTo(0, 0);
    ctx.lineTo(-6 * dpr, 4 * dpr);
    ctx.strokeStyle = DOT_REST_COLOR;
    ctx.lineWidth = 2 * dpr;
    ctx.lineCap = 'butt';
    ctx.stroke();
    ctx.restore();
}
