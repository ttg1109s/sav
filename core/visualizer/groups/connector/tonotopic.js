/**
 * core/visualizer/groups/connector/tonotopic.js — helper THUẦN ánh xạ phổ audio theo kiểu ốc tai (tonotopic) + trạng thái
 * bắn của 1 node (thích nghi / ức chế bên / mượt hoá / ổn định lại sau seek). Workflow tự gom rồi gọi.
 *
 * [ĐỔI TÊN — 06/10/2026, Giang "xoá toàn bộ effect synapse"] Trước là core/visualizer/groups/connector/synapse.js. Style
 * synapse ĐÃ XOÁ HẲN; phần riêng synapse (applyNeuronExcitement/stepActionPotential/computeSignalSpeedMult) bỏ theo. Phần còn
 * lại là cơ chế DÙNG CHUNG — chip circuit (event/workflow/visualizer/connector.js) và dot của group bar
 * (event/workflow/visualizer/bar.js: tonotopicBinRange + computeBinRangePeak) vẫn gọi. Tên hàm giữ nguyên ("neuron" = node
 * bất kỳ mang các field prevBinEnergy/smoothedBinEnergy/adaptation/lateralInhibition/energy).
 */

// MỚI (yêu cầu Giang 17/09/2026 — "mapping audio giống dẫn truyền tín hiệu thần kinh khi nghe âm
// thanh", tìm hiểu qua nghiên cứu thính giác thật): ỐC TAI KHÔNG chia dải tần số ĐỀU theo Hz — vị
// trí dọc ốc tai ánh xạ theo hàm LOG (tonotopic map / hàm Greenwood: mỗi quãng 8 chiếm gần như cùng
// 1 khoảng "không gian thần kinh", KHÔNG PHẢI cùng số Hz) — âm trầm (nơi nhạc cụ/kick/bassline có
// nhiều nốt phân biệt) được cấp KHÔNG GIAN LỚN, âm cao (thường trải rộng/ồn, ít nốt rời rạc) bị NÉN
// lại. TRƯỚC ĐÂY chia bufferLength thành N đoạn ĐỀU NHAU tuyến tính theo index bin FFT (Hz tuyến
// tính) — dồn gần hết bass vào vài neuron đầu, lãng phí phần lớn neuron cho treble. Đổi sang chia
// theo tỷ lệ HÌNH HỌC (geometric/log) giữa TONOTOPIC_MIN_BIN (bỏ qua vài bin DC/hạ-âm gần như luôn
// ồn, không mang giai điệu) và bin cao nhất — mỗi neuron phủ 1 TỶ LỆ tần số không đổi (gần đúng "1
// quãng 8"), không phải 1 số Hz cố định.
const TONOTOPIC_MIN_BIN = 2;

function tonotopicBinRange(neuronIndex, neuronCount, bufferLength) {
    const minBin = TONOTOPIC_MIN_BIN;
    const maxBin = Math.max(minBin + 1, bufferLength - 1);
    const ratio = maxBin / minBin;
    const t0 = neuronIndex / neuronCount;
    const t1 = (neuronIndex + 1) / neuronCount;
    const start = Math.floor(minBin * Math.pow(ratio, t0));
    const end = Math.min(bufferLength, Math.max(start + 1, Math.floor(minBin * Math.pow(ratio, t1))));
    return { start, end };
}

// MỚI (yêu cầu Giang — circuit "map đích theo pitch, đúng dải tần"): tra NGƯỢC tonotopicBinRange()
// — node nào có dải bin chứa tần số `frequencyHz`. Dùng ĐÚNG tonotopicBinRange() (không tự tính
// lại công thức log) vì dải thật ở đầu trầm bị ép tối thiểu 1 bin/node (start+1) nên KHÔNG còn
// log thuần — công thức lý tưởng sẽ lệch node. Tần số nằm ngoài dải/rơi vào kẽ hở giữa 2 dải
// thì lấy node gần nhất. Bin width analyser = sampleRate / fftSize = sampleRate / (2*bufferLength).
// SỬA (28/09/2026, Phase 5 — không core gọi core) — THAY tonotopicNodeIndexForFrequency() (tự gọi tonotopicBinRange() cho
// từng node): Workflow dựng sẵn mảng dải bin (`ranges[j] = tonotopicBinRange(j, nodeCount, bufferLength)`) rồi tra bằng 2
// hàm dưới. Thuật toán giữ nguyên (khớp dải chứa bin, không khớp -> dải gần nhất).
/** Tần số (Hz) -> chỉ số bin FFT gần nhất. */
function frequencyToFftBin(frequencyHz, bufferLength, sampleRate) {
    return Math.round(frequencyHz / (sampleRate / (bufferLength * 2)));
}

/** Node có dải bin chứa `bin`; không node nào chứa (ngoài dải/kẽ hở) -> node có dải gần nhất. */
function findTonotopicNodeForBin(ranges, bin) {
    let best = 0, bestDist = Infinity;
    for (let j = 0; j < ranges.length; j++) {
        const { start, end } = ranges[j];
        if (bin >= start && bin < end) return j;
        const dist = bin < start ? start - bin : bin - (end - 1);
        if (dist < bestDist) { bestDist = dist; best = j; }
    }
    return best;
}

// SỬA (phản hồi Giang — bắn quá thưa, không rõ theo nhạc): LẤY ĐỈNH (max) của dải thay vì trung
// bình — nhạy đúng với 1 nốt/nhạc cụ nổi lên trong dải đó. GIỮ NGUYÊN tinh thần đó — chỉ đổi cách
// tính range (start/end) sang tonotopicBinRange() ở trên (log) thay vì chia đều tuyến tính cũ.
// [BỎ — 28/09/2026, Phase 5] computeNeuronBinEnergy() (gọi tonotopicBinRange()) — Workflow dùng cặp
// tonotopicBinRange() + computeBinRangePeak() bên dưới.

/** MỚI (28/09/2026, Phase 5) — đỉnh biên độ trong 1 dải bin (dải = tonotopicBinRange(), Workflow tính trước). Workflow dùng
 * cặp tonotopicBinRange() + computeBinRangePeak() thay computeNeuronBinEnergy() (đã bỏ). */
function computeBinRangePeak(vizDataArray, range) {
    let peak = 0;
    for (let i = range.start; i < range.end; i++) peak = Math.max(peak, vizDataArray[i] || 0);
    return peak;
}

// MỚI (yêu cầu Giang — nguyên lý "volley/rate coding": sợi thần kinh thính giác mã hoá âm TRẦM bằng
// phase-locking — bắn khớp từng chu kỳ sóng, sắc và tức thời; âm CAO vượt quá giới hạn phase-locking
// (ước tính vật lý ~4-5kHz) nên chuyển hẳn sang place/rate coding — mã hoá bằng NHỊP BẮN trung bình,
// mượt hơn, không theo kịp từng chu kỳ. Mô phỏng bằng 1 bộ lọc mượt-hoá (EMA) có ĐỘ MƯỢT tăng dần
// theo vị trí tonotopic: neuron trầm gần như không mượt hoá (bắt đúng từng nốt/onset tức thời,
// giống phase-locking), neuron cao mượt mạnh hơn hẳn (phản ứng theo xu hướng trung bình, giống rate
// coding). `neuron.smoothedBinEnergy` là trạng thái riêng từng neuron (three-connector.js::
// createAnatomicalNeuron()), reset về 0 mỗi khi đổi bài (resetConnectorPerTrackState()).
function applyTonotopicSmoothing(neuron, rawPeak, neuronIndex, neuronCount) {
    const t = neuronIndex / Math.max(1, neuronCount - 1); // 0 = trầm nhất, 1 = cao nhất
    const smoothAlpha = 0.1 + t * 0.65;
    neuron.smoothedBinEnergy += (rawPeak - neuron.smoothedBinEnergy) * (1 - smoothAlpha);
    return neuron.smoothedBinEnergy;
}

// MỚI (yêu cầu Giang — "spike-frequency adaptation" thay cooldown cứng cũ): TRƯỚC ĐÂY
// CONNECTOR_FIRE_COOLDOWN_FRAMES (visualizer-render.js, ĐÃ XOÁ) so `frameCounter -
// neuron.lastFiredFrame` — 1 cổng NHỊ PHÂN cứng (khoá hẳn/mở hẳn), gắn liền với bug frameCounter
// đứng yên phát hiện 17/09/2026 (xem lịch sử SAV). Neuron thật không khoá/mở cứng kiểu đó — sau khi
// bắn, ngưỡng bắn TĂNG VỌT (refractory) rồi TỰ HẠ DẦN theo thời gian (relative refractory), không
// phải 1 mốc thời gian cố định rồi mở bung ngay lập tức. `neuron.adaptation` (đơn vị byte, cộng
// thẳng vào ngưỡng hiệu dụng ở computeEffectiveFireThresholdByte() bên dưới) mô phỏng đúng dáng đó —
// GRADED, không nhị phân.
const ADAPTATION_FIRE_BYTES = 130;
const ADAPTATION_DECAY_PER_SEC = 480;

function triggerNeuronAdaptation(neuron) {
    neuron.adaptation = ADAPTATION_FIRE_BYTES;
}

// MỚI (yêu cầu Giang — "lateral inhibition": trong hệ thính giác trung ương, tế bào ức chế điều
// hưởng RỘNG chiếu lên tế bào kích thích điều hưởng HẸP lân cận, tăng độ tương phản phổ — nguyên
// nhân sinh học THẬT cho đúng thứ mình từng vá bằng tay hôm 17/09 (chain-reaction khiến toàn mạng
// đều phát tín hiệu): khi 1 neuron bắn, các neuron LÂN CẬN (nối dây trực tiếp —
// nay là chip.neighbors của circuit) bị tạm NÂNG ngưỡng bắn lên (khó bắn hơn)
// — neuron "trúng" nhất thắng, hàng xóm bị đè xuống thay vì cùng sáng loạt. `cfg.lateralInhibitStrength`
// (slider, core/custom-effect.js) là mức NÂNG mỗi lần 1 hàng xóm bắn — 0 = tắt hẳn ức chế chéo (mọi
// neuron độc lập hoàn toàn như trước 17/09).
const LATERAL_INHIBIT_CAP_BYTES = 200;
const LATERAL_INHIBIT_DECAY_PER_SEC = 380;

function applyLateralInhibition(neuron, inhibitAmount) {
    neuron.lateralInhibition = Math.min(LATERAL_INHIBIT_CAP_BYTES, neuron.lateralInhibition + inhibitAmount);
}

// Ngưỡng bắn HIỆU DỤNG = ngưỡng gốc (slider fireThreshold, 0-1 * 255) + phần tự thích nghi
// (adaptation, tự đè lên SAU KHI CHÍNH NÓ vừa bắn) + phần bị hàng xóm đè (lateralInhibition, sau khi
// LÂN CẬN vừa bắn) — cả 2 cùng đơn vị byte (0-255) nên cộng thẳng được, cả 2 cùng tự decay mỗi frame
// qua decayNeuronState() ngay dưới.
function computeEffectiveFireThresholdByte(neuron, cfg) {
    return cfg.fireThreshold * 255 + neuron.adaptation + neuron.lateralInhibition;
}

// XOÁ TOÀN BỘ (yêu cầu Giang 17/09/2026 — "loại bỏ tính đàn hồi"): trước đây ở đây là
// stepNeuronSpring() — vật lý lò xo Hooke's Law. Đã bỏ hẳn — nơ-ron đứng CỐ ĐỊNH đúng `restPosition`.
// ĐỔI TÊN decayNeuronExcitement() -> decayNeuronState() (cùng đợt sửa 17/09 — thêm 2 trạng thái mới
// ở trên): hàm này giờ decay CẢ BA trạng thái tạm thời của 1 nơ-ron mỗi frame — năng lượng bừng
// sáng (energy — nay là độ bừng sáng của chip circuit, applyChipEnergyGlow(), common.js), tự thích nghi (adaptation) và bị hàng xóm
// ức chế (lateralInhibition) — gộp chung 1 hàm vì cùng là "trạng thái tạm thời decay theo thời
// gian", gọi 1 lần/node/frame từ Workflow (event/workflow/visualizer/connector.js).
function decayNeuronState(neuron, deltaTime) {
    if (neuron.energy > 0) neuron.energy = Math.max(0, neuron.energy - deltaTime * 1.7);
    if (neuron.adaptation > 0) neuron.adaptation = Math.max(0, neuron.adaptation - deltaTime * ADAPTATION_DECAY_PER_SEC);
    if (neuron.lateralInhibition > 0) neuron.lateralInhibition = Math.max(0, neuron.lateralInhibition - deltaTime * LATERAL_INHIBIT_DECAY_PER_SEC);
}

/** MỚI (28/09/2026, Phase 4) — "Ổn định lại" 1 neuron/chip sau seek: lấy biên độ hiện tại làm mốc, xoá kích thích/
 * thích nghi/ức chế bên — frame này không phải onset. Sửa tại chỗ object nhận vào. */
function rebaselineTonotopicNode(node, rawPeak) {
    node.smoothedBinEnergy = rawPeak;
    node.prevBinEnergy = rawPeak;
    node.energy = 0;
    node.adaptation = 0;
    node.lateralInhibition = 0;
}

/** MỚI (28/09/2026, Phase 4) — Neuron/chip có bắn ở frame này không: đang phát, không trong cửa sổ ổn định lại
 * sau seek, biên độ đang TĂNG và vượt ngưỡng hiệu dụng (đã cộng thích nghi + ức chế bên). */
function shouldFireTonotopicNode(isPlaying, isSettling, diff, energyByte, thresholdByte) {
    return isPlaying && !isSettling && diff > 0 && energyByte > thresholdByte;
}
