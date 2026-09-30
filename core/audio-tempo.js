/**
 * core/audio-tempo.js — Ước lượng TEMPO (BPM) từ đường bao onset (spectral flux theo thời gian). Core THUẦN, Rule 1-3.
 *
 * [MỚI — 01/10/2026, Giang yêu cầu "fix BPM + nghiên cứu cách tính BPM chuẩn xác hơn"] THAY cách cũ "BPM = 60000 / trung
 * bình 5 khoảng cách beat liên tiếp" (computeBpmFromMeanInterval(), đã xoá). Cách cũ sai vì: (1) onset không phải beat —
 * hi-hat/snare sinh thêm onset, kick bị lỡ thì khoảng cách gấp đôi; (2) chỉ 5 mẫu nên nhảy liên tục; (3) 1 khoảng
 * vượt qua lúc pause/seek/đổi bài làm hỏng cả 5 beat sau đó.
 *
 * Cách mới (chuẩn MIR — Ellis 2007, cùng hướng `librosa.beat.tempo`): tự tương quan (autocorrelation) của đường bao
 * onset LIÊN TỤC trong ~8 s gần nhất, nhân "tempo prior" log-normal quanh 120 BPM để chọn đúng quãng tám, nội suy
 * parabol lấy lag lẻ. Dùng TOÀN BỘ năng lượng onset (không chỉ các đỉnh vượt ngưỡng) nên chịu được onset thừa/thiếu.
 * Đường bao onset = độ mạnh onset theo DẢI TẦN LOG (mỗi quãng tần ngang nhau, không để snare/hi-hat át kick). Workflow
 * (event/workflow/audio-analysis.js) ước lượng mỗi 500 ms, gập các ước lượng cũ về quãng tám của ước lượng mới nhất rồi
 * lấy TRUNG VỊ 5 lần gần nhất để số hiển thị ổn định.
 *
 * Chi phí: 1 lần ước lượng ≈ 480 mẫu × ~60 lag ≈ 30k phép nhân, 2 lần/giây — không cần Worker.
 *
 * Tick phân tích chạy theo requestAnimationFrame (60/120 Hz, có khi giật khung) nên mẫu onset lưu kèm MỐC THỜI GIAN
 * thật, rồi nội suy về lưới đều TEMPO_GRID_RATE_HZ trước khi tự tương quan.
 */

/** Sức chứa đường bao (mẫu) — đủ > 10 s kể cả màn hình 120 Hz. */
const TEMPO_ENVELOPE_CAPACITY = 1500;
/** Tần số lưới đều sau nội suy. */
const TEMPO_GRID_RATE_HZ = 60;
/** Độ dài cửa sổ phân tích tối đa / tối thiểu (chưa đủ tối thiểu -> chưa ước lượng). */
const TEMPO_WINDOW_MS = 8000;
const TEMPO_MIN_WINDOW_MS = 3000;
/** Dải tempo hợp lệ. */
const TEMPO_MIN_BPM = 50;
const TEMPO_MAX_BPM = 210;
/** Tempo prior: log-normal quanh 120 BPM, độ lệch chuẩn 1 quãng tám (giá trị mặc định của librosa). */
const TEMPO_PRIOR_BPM = 120;
const TEMPO_PRIOR_STD_OCTAVE = 1;
/** Nửa cửa sổ trung bình trượt khi khử xu hướng đường bao (ms). */
const TEMPO_DETREND_HALF_MS = 250;
/** Độ tin cậy tối thiểu (tự tương quan chuẩn hoá tại đỉnh) — dưới mức này coi như nhạc không có nhịp rõ, bỏ ước lượng. */
const TEMPO_MIN_CONFIDENCE = 0.25;
/** Nhịp ước lượng lại + số lần ước lượng gần nhất lấy trung vị. */
const TEMPO_ESTIMATE_INTERVAL_MS = 500;
const TEMPO_HISTORY_MAX = 5;
/** Sai số (tính theo quãng tám) để coi 1 ước lượng là "cùng tempo, lệch 1 quãng tám" với giá trị tham chiếu. */
const TEMPO_OCTAVE_FOLD_TOLERANCE = 0.08;
/** Nhịp NHANH GẤP ĐÔI được chọn thay nếu tự tương quan ở nửa lag đạt >= tỉ lệ này so với đỉnh — sửa lỗi báo nửa tempo
 * (vd rock 160 báo 80) khi nhịp nhanh vẫn có hỗ trợ mạnh. Đo trên nhạc mô phỏng: báo đúng <= 0.29, báo nửa tempo 0.75. */
const TEMPO_DOUBLE_SUPPORT_RATIO = 0.5;
/** Số dải tần log (30 Hz - 8 kHz) để tính đường bao onset — mỗi dải đóng góp NGANG nhau (xem computeBandedOnsetStrength). */
const TEMPO_ONSET_BAND_COUNT = 8;
const TEMPO_ONSET_FREQ_MIN_HZ = 30;
const TEMPO_ONSET_FREQ_MAX_HZ = 8000;

/**
 * Mép các dải tần log (chỉ số bin) cho computeBandedOnsetStrength() — tính 1 lần theo cỡ FFT/sampleRate cố định.
 * Mỗi dải >= 1 bin. @returns {Int32Array} độ dài bandCount + 1
 */
function buildOnsetBandEdges(binCount, sampleRate, fMinHz, fMaxHz, bandCount) {
    const binHz = sampleRate / (2 * binCount);
    const top = Math.min(fMaxHz, sampleRate / 2);
    const edges = new Int32Array(bandCount + 1);
    for (let b = 0; b <= bandCount; b++) {
        const bin = Math.round(fMinHz * Math.pow(top / fMinHz, b / bandCount) / binHz);
        edges[b] = Math.min(binCount - 1, Math.max(b === 0 ? 1 : edges[b - 1] + 1, bin));
    }
    return edges;
}

/**
 * Độ mạnh onset 1 frame = tổng theo dải của TRUNG BÌNH phần tăng biên độ (byte dB) trong dải. Khác spectral flux thường
 * (cộng mọi bin): snare/hi-hat trải hàng trăm bin sẽ át tiếng kick chỉ vài bin — tempo bị báo theo chu kỳ snare (nửa
 * tempo). Chia theo dải log thì mỗi quãng tần đóng góp ngang nhau. Baseline chưa hợp lệ -> 0.
 * @param {Uint8Array} spectrum @param {Uint8Array} prevSpectrum @param {Int32Array} bandEdges @param {boolean} baselineValid
 */
function computeBandedOnsetStrength(spectrum, prevSpectrum, bandEdges, baselineValid) {
    if (!baselineValid) return 0;
    let total = 0;
    for (let b = 0; b < bandEdges.length - 1; b++) {
        let sum = 0;
        for (let i = bandEdges[b]; i < bandEdges[b + 1]; i++) sum += Math.max(0, spectrum[i] - prevSpectrum[i]);
        total += sum / (bandEdges[b + 1] - bandEdges[b]);
    }
    return total;
}

/** Đường bao onset rỗng (ring buffer, mốc thời gian ms + giá trị). @param {number} capacity */
function createOnsetEnvelope(capacity) {
    return { times: new Float64Array(capacity), values: new Float32Array(capacity), head: 0, count: 0 };
}

/** Xoá sạch đường bao (sửa tại chỗ) — gọi khi dòng thời gian bị ngắt (pause/seek/đổi bài/app ẩn). */
function clearOnsetEnvelope(env) {
    env.head = 0;
    env.count = 0;
}

/** Thêm 1 mẫu onset (sửa tại chỗ), đầy thì đè mẫu cũ nhất. @param {number} timeMs @param {number} value */
function pushOnsetSample(env, timeMs, value) {
    const cap = env.times.length;
    env.times[env.head] = timeMs;
    env.values[env.head] = value;
    env.head = (env.head + 1) % cap;
    if (env.count < cap) env.count++;
}

/** Khoảng thời gian (ms) đường bao đang phủ, từ mẫu cũ nhất tới mới nhất. */
function computeOnsetEnvelopeSpanMs(env) {
    if (env.count < 2) return 0;
    const cap = env.times.length;
    return env.times[(env.head - 1 + cap) % cap] - env.times[(env.head - env.count + cap) % cap];
}

/**
 * Nội suy tuyến tính đường bao về lưới đều `rateHz`, phủ tối đa `windowMs` gần nhất (điểm cuối lưới = mẫu mới nhất).
 * Ghi vào `out` (sửa tại chỗ), trả số điểm đã ghi.
 * @param {object} env @param {number} rateHz @param {number} windowMs @param {Float32Array} out @returns {number}
 */
function resampleOnsetEnvelope(env, rateHz, windowMs, out) {
    if (env.count < 2) return 0;
    const cap = env.times.length;
    const first = (env.head - env.count + cap) % cap;
    const newestT = env.times[(env.head - 1 + cap) % cap];
    const spanMs = Math.min(windowMs, newestT - env.times[first]);
    const n = Math.min(out.length, Math.floor(spanMs * rateHz / 1000) + 1);
    const stepMs = 1000 / rateHz;
    let i = 0; // thứ tự thời gian của mẫu đứng ngay TRƯỚC điểm lưới đang xét
    for (let k = 0; k < n; k++) {
        const t = newestT - (n - 1 - k) * stepMs;
        while (i < env.count - 2 && env.times[(first + i + 1) % cap] <= t) i++;
        const ia = (first + i) % cap;
        const ib = (first + i + 1) % cap;
        const ta = env.times[ia];
        const tb = env.times[ib];
        const f = tb > ta ? Math.min(1, Math.max(0, (t - ta) / (tb - ta))) : 0;
        out[k] = env.values[ia] + (env.values[ib] - env.values[ia]) * f;
    }
    return n;
}

/**
 * Tempo từ đường bao onset trên lưới đều: khử xu hướng (trừ trung bình trượt, cắt phần âm) -> tự tương quan chuẩn hoá
 * ở các lag ứng với [minBpm, maxBpm] -> nhân prior log-normal -> đỉnh lớn nhất, nội suy parabol -> nếu nhịp nhanh gấp
 * đôi vẫn có hỗ trợ mạnh thì chọn nhịp nhanh.
 * Chưa đủ dữ liệu (ít hơn 2 lần lag dài nhất) hoặc đường bao phẳng -> null.
 * @param {Float32Array} samples @param {number} count - số điểm hợp lệ đầu mảng
 * @param {number} rateHz @param {number} minBpm @param {number} maxBpm @param {number} priorBpm @param {number} priorStdOctave
 * @param {number} detrendHalfMs @param {number} doubleSupportRatio - xem TEMPO_DOUBLE_SUPPORT_RATIO
 * @returns {{bpm: number, confidence: number}|null} confidence = tự tương quan chuẩn hoá tại đỉnh (0..~1)
 */
function estimateTempoFromOnsets(samples, count, rateHz, minBpm, maxBpm, priorBpm, priorStdOctave, detrendHalfMs, doubleSupportRatio) {
    const lagMin = Math.max(1, Math.floor(60 * rateHz / maxBpm));
    const lagMax = Math.ceil(60 * rateHz / minBpm);
    if (count < lagMax * 2) return null;

    // 1) Khử xu hướng: độ to thay đổi chậm (đoạn nhỏ/lớn) không được tính là "nhịp".
    const half = Math.max(1, Math.round(detrendHalfMs * rateHz / 1000));
    const x = new Float32Array(count);
    let runSum = 0;
    let lo = 0;
    let hi = -1;
    for (let k = 0; k < count; k++) {
        const wantLo = Math.max(0, k - half);
        const wantHi = Math.min(count - 1, k + half);
        while (hi < wantHi) { hi++; runSum += samples[hi]; }
        while (lo < wantLo) { runSum -= samples[lo]; lo++; }
        const v = samples[k] - runSum / (hi - lo + 1);
        x[k] = v > 0 ? v : 0;
    }
    // Trừ trung bình SAU khi cắt âm: nhiễu nền (nhạc không có nhịp) sau khi cắt âm vẫn có trung bình > 0, không trừ thì
    // tự tương quan ở MỌI lag đều ~1/π (≈ 0.32) và nhạc ambient sẽ "có tempo" giả.
    let mean = 0;
    for (let k = 0; k < count; k++) mean += x[k];
    mean /= count;
    let energy = 0;
    for (let k = 0; k < count; k++) { x[k] -= mean; energy += x[k] * x[k]; }
    if (energy <= 0) return null;
    const meanEnergy = energy / count;

    // 2) Tự tương quan chuẩn hoá (bù số cặp giảm dần theo lag) x prior.
    const acf = new Float32Array(lagMax + 1);
    const score = new Float32Array(lagMax + 1);
    let best = lagMin;
    for (let lag = lagMin; lag <= lagMax; lag++) {
        let s = 0;
        for (let k = lag; k < count; k++) s += x[k] * x[k - lag];
        const r = (s / (count - lag)) / meanEnergy;
        const z = Math.log2((60 * rateHz / lag) / priorBpm) / priorStdOctave;
        acf[lag] = r;
        score[lag] = r * Math.exp(-0.5 * z * z);
        if (score[lag] > score[best]) best = lag;
    }

    // 3) Nội suy parabol quanh đỉnh (đỉnh nằm ở mép dải thì giữ nguyên lag nguyên).
    let lagExact = best;
    if (best > lagMin && best < lagMax) {
        const a = score[best - 1];
        const b = score[best];
        const c = score[best + 1];
        const den = a - 2 * b + c;
        lagExact = den < 0 ? best + 0.5 * (a - c) / den : best;
    }

    // 4) Nhịp nhanh gấp đôi có hỗ trợ mạnh (tự tương quan ở nửa lag, nội suy tuyến tính) -> chọn nhịp nhanh.
    const halfLag = lagExact / 2;
    const h0 = Math.floor(halfLag);
    const hf = halfLag - h0;
    const halfAcf = h0 >= lagMin && h0 + 1 <= lagMax ? acf[h0] * (1 - hf) + acf[h0 + 1] * hf : 0;
    const preferDouble = acf[best] > 0 && halfAcf >= acf[best] * doubleSupportRatio && 120 * rateHz / lagExact <= maxBpm;
    const finalLag = preferDouble ? halfLag : lagExact;
    return { bpm: 60 * rateHz / finalLag, confidence: acf[best] };
}

/**
 * Gập 1 ước lượng về cùng quãng tám với tempo tham chiếu nếu nó chỉ lệch đúng ×2/×½ (…). Workflow gập các ước lượng CŨ
 * trong lịch sử về quãng tám của ước lượng MỚI NHẤT (cửa sổ dài nhất, đáng tin nhất) rồi lấy trung vị — ước lượng đầu
 * (mới 3 s dữ liệu) chọn sai quãng tám thì tự sửa được, không bị "neo" mãi. Lệch không phải bội quãng tám -> giữ nguyên.
 * @param {number} bpm @param {number|null} referenceBpm @param {number} toleranceOctave @returns {number}
 */
function foldTempoToReference(bpm, referenceBpm, toleranceOctave) {
    if (!(referenceBpm > 0)) return bpm;
    const octaves = Math.round(Math.log2(bpm / referenceBpm));
    const folded = bpm / Math.pow(2, octaves);
    return Math.abs(Math.log2(folded / referenceBpm)) < toleranceOctave ? folded : bpm;
}

/** Trung vị 1 mảng số (không sửa mảng gốc) — rỗng trả 0. */
function computeArrayMedian(values) {
    if (values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = sorted.length >> 1;
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
