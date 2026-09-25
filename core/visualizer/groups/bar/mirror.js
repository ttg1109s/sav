/**
 * core/visualizer/groups/bar/mirror.js — [LÀM PHẲNG, 05/09/2026, yêu cầu Giang] Style 'mirror'
 * tách riêng khỏi `core/visualizer/types/bar.js` cũ (trước đây gộp chung với 'cascade'). Phản
 * chiếu — dải CÁNH BƯỚM, số lượng thanh mỗi bên TÙY CHỈNH 10-32 (mirrorBarCount), mỗi bar đối xứng
 * trên/dưới quanh centerY.
 *
 * [XOÁ — 15/09/2026, yêu cầu Giang] BAR TRUNG TÂM (đập theo beat) đã BỎ HẲN — field
 * centerBarBeatRatio cũng đã xoá.
 *
 * VIẾT LẠI (25/09/2026, Giang — "cải tiến theo lựa chọn tốt nhất nhưng giữ bản chất mirror + butterfly",
 * tham khảo audioMotion-analyzer + CAVA). GIỮ NGUYÊN bản chất:
 *   - MIRROR: trái/phải đối xứng gương thật (cùng khoảng cách tới tâm = cùng 1 dải tần), trên/dưới đối
 *     xứng quanh centerY.
 *   - BUTTERFLY: bass ở MÉP (cánh), treble ở TÂM (thân) — cánh cao dần ra ngoài. KHÔNG đưa bass vào giữa
 *     (sẽ thành dạng "núi", mất hình cánh bướm).
 * Thay đổi:
 *   1. Thang tần số LOG (40Hz..16kHz, trần = Nyquist) thay tuyến tính — trước đây 16/32 thanh gần tâm
 *      hiển thị 6-12kHz (gần như im lặng), toàn bộ 0-1kHz dồn vào ~3 thanh sát mép. Mỗi thanh lấy MAX
 *      các bin trong dải; dải hẹp hơn 1 bin (vùng bass) nội suy tại tần số giữa dải -> không bị bậc
 *      thang. Cần FFT 2048 riêng cho style này (needsHighResFft(group, style), service/state/
 *      visualizer-runtime.js).
 *   2. Dải dB -85..-25 (như audioMotion) thay -100..-30 mặc định của analyser — quy đổi NGAY TẠI ĐÂY từ
 *      byte + min/maxDecibels thật của analyser (không đổi analyser dùng chung với effect khác).
 *   3. Nâng treble (mirrorTilt, dB/quãng tám) CHỈ phía trên 1kHz — bass giữ nguyên để cánh vẫn cao hơn
 *      thân (khác tilt 2 chiều của FabFilter/SPAN vốn hạ bass, làm phẳng mất hình cánh bướm).
 *   4. Làm mượt kề kiểu Monstercat (CAVA) — mirrorSmoothSpread 0 = tắt.
 *   5. Vạch đỉnh (mirrorPeaks): giữ 500ms rồi rơi có gia tốc (~0.75s từ đỉnh về 0, như audioMotion).
 *   6. Khoảng giữa (thân bướm) = mirrorCenterGap × gap thường (1 = đều như gap giữa 2 thanh) — dải co lại
 *      cho VỪA nửa màn hình. Sửa lỗi cũ: centerOffset đẩy dải ra ngoài mà không co lại -> thanh ngoài
 *      cùng (bass) tràn khỏi mép nửa bề rộng.
 *   (Mục 7 cũ "gộp trên + dưới thành 1 rect" ĐÃ HUỶ cùng ngày — Giang báo mất dải ngược bên dưới, 2 dải
 *    dính liền. Mỗi bar/bên lại là 2 rect RIÊNG như bản gốc: dải trên mọc lên từ centerY + dải ngược
 *    mọc xuống từ centerY, mỗi rect tự bo góc -> khấc ở trục tách 2 dải là CHỦ ĐÍCH, không phải lỗi.)
 *
 * THUẦN, không side-effect, không đọc appState/getActiveEffectConfig (Rule 2/3) — Workflow
 * (`_tickBar()`, event/workflow/visualizer-render.js) tự gom state (vạch đỉnh giữ ở Workflow), tự gọi
 * RIÊNG LẺ: computeBarMirrorLevels() -> spreadBarMirrorLevels() -> stepBarMirrorPeaks() ->
 * computeBarMirrorFrame(), rồi resolve màu qua getComputedColor() + paintBarRects() (common.js).
 *
 * NẠP SAU: core/visualizer/groups/bar/common.js (chỉ để thứ tự đọc nhất quán).
 */
const BAR_MIRROR_COUNT_PER_SIDE = 32;
const BAR_MIRROR_FREQ_MIN_HZ = 40;
const BAR_MIRROR_FREQ_MAX_HZ = 16000;
const BAR_MIRROR_TILT_PIVOT_HZ = 1000;
const BAR_MIRROR_DB_FLOOR = -85;
const BAR_MIRROR_DB_CEIL = -25;
const BAR_MIRROR_PEAK_HOLD_MS = 500;
const BAR_MIRROR_PEAK_GRAVITY = 3.5; // chiều cao chuẩn hoá (0-1) / giây² — rơi từ 1 về 0 ≈ 0.75s

/** Số thanh MỖI BÊN (10-32), mặc định 32 nếu chưa từng đặt. Workflow dùng để khớp độ dài mảng
 * levels/vạch đỉnh với computeBarMirrorFrame(). */
function resolveBarMirrorCount(cfg) {
    return Math.max(10, Math.min(32, cfg.mirrorBarCount || BAR_MIRROR_COUNT_PER_SIDE));
}

/**
 * Mức 0-1 của từng dải tần LOG — chỉ số 0 = dải THẤP nhất (bass), cuối = cao nhất.
 * @param {Uint8Array} vizDataArray - getByteFrequencyData()
 * @param {number} binCount - analyser.frequencyBinCount
 * @param {number} sampleRate - analyser.context.sampleRate
 * @param {number} analyserDbMin @param {number} analyserDbMax - analyser.minDecibels/maxDecibels (quy đổi byte -> dB)
 * @param {number} bandCount @param {number} tiltDbPerOct - nâng treble phía trên 1kHz
 * @returns {Float32Array}
 */
function computeBarMirrorLevels(vizDataArray, binCount, sampleRate, analyserDbMin, analyserDbMax, bandCount, tiltDbPerOct) {
    const levels = new Float32Array(bandCount);
    const binHz = sampleRate / (2 * binCount);
    const fMin = BAR_MIRROR_FREQ_MIN_HZ;
    const fMax = Math.min(BAR_MIRROR_FREQ_MAX_HZ, sampleRate / 2);
    const ratio = fMax / fMin;
    const dbSpan = analyserDbMax - analyserDbMin;
    const tilt = tiltDbPerOct || 0;
    for (let b = 0; b < bandCount; b++) {
        const fLo = fMin * Math.pow(ratio, b / bandCount);
        const fHi = fMin * Math.pow(ratio, (b + 1) / bandCount);
        const fCenter = Math.sqrt(fLo * fHi);
        const i0 = Math.ceil(fLo / binHz);
        const i1 = Math.min(binCount - 1, Math.floor(fHi / binHz));
        let byte = 0;
        if (i1 >= i0) {
            // Dải rộng >= 1 bin — lấy MAX (giữ đỉnh nốt, không bị pha loãng như trung bình).
            for (let i = i0; i <= i1; i++) if (vizDataArray[i] > byte) byte = vizDataArray[i];
        } else {
            // Dải hẹp hơn 1 bin (vùng bass) — nội suy tuyến tính tại tần số giữa dải.
            const x = fCenter / binHz;
            const k = Math.min(binCount - 2, Math.floor(x));
            const t = x - k;
            byte = (vizDataArray[k] || 0) * (1 - t) + (vizDataArray[k + 1] || 0) * t;
        }
        if (byte <= 0) continue; // dưới minDecibels của analyser — im lặng thật
        let db = analyserDbMin + (byte / 255) * dbSpan;
        if (fCenter > BAR_MIRROR_TILT_PIVOT_HZ) db += tilt * Math.log2(fCenter / BAR_MIRROR_TILT_PIVOT_HZ);
        const level = (db - BAR_MIRROR_DB_FLOOR) / (BAR_MIRROR_DB_CEIL - BAR_MIRROR_DB_FLOOR);
        levels[b] = level < 0 ? 0 : (level > 1 ? 1 : level);
    }
    return levels;
}

/** Làm mượt kề kiểu "Monstercat" (CAVA): mỗi dải lan xuống các dải lân cận theo hệ số spread^khoảng
 * cách, giữ MAX — các thanh liền kề thành dạng đồi mềm. spread <= 0 trả nguyên mảng.
 * @param {Float32Array} levels @param {number} spread - 0..0.9 @returns {Float32Array} */
function spreadBarMirrorLevels(levels, spread) {
    if (!(spread > 0)) return levels;
    const n = levels.length;
    const out = Float32Array.from(levels);
    for (let z = 0; z < n; z++) {
        let v = levels[z];
        for (let m = z + 1; m < n; m++) { v *= spread; if (v < 0.005) break; if (v > out[m]) out[m] = v; }
        v = levels[z];
        for (let m = z - 1; m >= 0; m--) { v *= spread; if (v < 0.005) break; if (v > out[m]) out[m] = v; }
    }
    return out;
}

/** 1 bước vạch đỉnh: mức mới >= đỉnh -> đỉnh nhảy lên + giữ BAR_MIRROR_PEAK_HOLD_MS; hết giữ -> rơi có
 * gia tốc BAR_MIRROR_PEAK_GRAVITY, không thấp hơn mức hiện tại. Trả state MỚI (không sửa `prev`);
 * `prev` null/lệch độ dài -> khởi tạo từ `levels`.
 * @param {Float32Array} levels @param {{vals:Float32Array,holds:Float32Array,vels:Float32Array}|null} prev
 * @param {number} dtMs @returns {{vals:Float32Array,holds:Float32Array,vels:Float32Array}} */
function stepBarMirrorPeaks(levels, prev, dtMs) {
    const n = levels.length;
    if (!prev || prev.vals.length !== n) {
        return { vals: Float32Array.from(levels), holds: new Float32Array(n).fill(BAR_MIRROR_PEAK_HOLD_MS), vels: new Float32Array(n) };
    }
    const vals = new Float32Array(n), holds = new Float32Array(n), vels = new Float32Array(n);
    const dt = dtMs / 1000;
    for (let i = 0; i < n; i++) {
        if (levels[i] >= prev.vals[i]) {
            vals[i] = levels[i]; holds[i] = BAR_MIRROR_PEAK_HOLD_MS; vels[i] = 0;
        } else if (prev.holds[i] > 0) {
            vals[i] = prev.vals[i]; holds[i] = prev.holds[i] - dtMs; vels[i] = 0;
        } else {
            vels[i] = prev.vels[i] + BAR_MIRROR_PEAK_GRAVITY * dt;
            vals[i] = Math.max(levels[i], prev.vals[i] - vels[i] * dt);
            holds[i] = 0;
        }
    }
    return { vals, holds, vels };
}

/**
 * Khung hình BAR MIRROR — THUẦN.
 * @param {object} cfg - getActiveEffectConfig()
 * @param {Float32Array} levels - 0-1 theo dải, chỉ số 0 = bass (độ dài = resolveBarMirrorCount(cfg))
 * @param {Float32Array|null} peaks - vạch đỉnh 0-1 cùng độ dài, null = tắt
 * @returns {{ bars: {colorArgs:number[], rects:object[]}[] }}
 */
function computeBarMirrorFrame(cfg, canvasWidth, canvasHeight, dpr, levels, peaks) {
    const centerX = canvasWidth / 2, centerY = canvasHeight / 2;
    const halfWidth = canvasWidth / 2;
    const maxBarLen = cfg.maxH * dpr * 0.5;
    const barCount = levels.length;
    const fill = cfg.barFillRatio;
    const centerGapMult = Math.max(1, Math.min(6, cfg.mirrorCenterGap || 1));

    // Bố cục 1 cánh: [nửa thân][bar gap bar gap ... bar][nửa gap tới mép]. Thân = centerGapMult × gap
    // thường. Giải slot sao cho thanh cuối kết thúc đúng halfWidth - gap/2 (VỪA màn hình, không tràn):
    //   gap*mult/2 + n*slot - gap = halfWidth - gap/2, gap = slot*(1-fill)
    //   -> slot = halfWidth / (n + (1-fill)*(mult-1)/2). mult = 1 -> slot = halfWidth/n, mọi gap đều nhau.
    const slot = halfWidth / (barCount + (1 - fill) * (centerGapMult - 1) / 2);
    const barW = slot * fill;
    const gapW = slot - barW;
    const bodyHalf = gapW * centerGapMult / 2;
    const cornerR = cfg.barCornerRadius * dpr;
    const capH = 2 * dpr, capGap = 2 * dpr;

    const bars = [];
    for (let i = 0; i < barCount; i++) {
        // i = 0 sát THÂN (treble) -> i lớn ra MÉP cánh (bass): dải = barCount-1-i (BUTTERFLY, giữ như cũ).
        const band = barCount - 1 - i;
        const level = levels[band];
        const len = level * maxBarLen;
        const rx = centerX + bodyHalf + i * slot;
        const lx = centerX - bodyHalf - i * slot - barW;
        const rects = [];
        if (len > 0) {
            // Dải trên (mọc lên từ trục) + dải NGƯỢC bên dưới (mọc xuống từ trục) — 2 rect RIÊNG như bản gốc.
            rects.push({ x: rx, y: centerY - len, w: barW, h: len, cornerR });
            rects.push({ x: rx, y: centerY, w: barW, h: len, cornerR });
            rects.push({ x: lx, y: centerY - len, w: barW, h: len, cornerR });
            rects.push({ x: lx, y: centerY, w: barW, h: len, cornerR });
        }
        if (peaks && peaks[band] > 0.01) {
            const pLen = peaks[band] * maxBarLen;
            const capR = Math.min(cornerR, capH / 2);
            rects.push({ x: rx, y: centerY - pLen - capGap - capH, w: barW, h: capH, cornerR: capR });
            rects.push({ x: rx, y: centerY + pLen + capGap, w: barW, h: capH, cornerR: capR });
            rects.push({ x: lx, y: centerY - pLen - capGap - capH, w: barW, h: capH, cornerR: capR });
            rects.push({ x: lx, y: centerY + pLen + capGap, w: barW, h: capH, cornerR: capR });
        }
        if (rects.length) bars.push({ colorArgs: [i, barCount, Math.round(level * 255)], rects });
    }
    return { bars };
}
