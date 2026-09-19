/**
 * core/visualizer/groups/connector/synapse.js — bước 1 khung hình, style synapse. THUẦN, Workflow
 * (_tickConnectorSynapse(), event/workflow/visualizer-render.js) tự gom appState rồi gọi.
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
function tonotopicNodeIndexForFrequency(frequencyHz, nodeCount, bufferLength, sampleRate) {
    const binWidthHz = sampleRate / (bufferLength * 2);
    const bin = Math.round(frequencyHz / binWidthHz);
    let best = 0, bestDist = Infinity;
    for (let j = 0; j < nodeCount; j++) {
        const { start, end } = tonotopicBinRange(j, nodeCount, bufferLength);
        if (bin >= start && bin < end) return j;
        const dist = bin < start ? start - bin : bin - (end - 1);
        if (dist < bestDist) { bestDist = dist; best = j; }
    }
    return best;
}

// SỬA (phản hồi Giang — bắn quá thưa, không rõ theo nhạc): LẤY ĐỈNH (max) của dải thay vì trung
// bình — nhạy đúng với 1 nốt/nhạc cụ nổi lên trong dải đó. GIỮ NGUYÊN tinh thần đó — chỉ đổi cách
// tính range (start/end) sang tonotopicBinRange() ở trên (log) thay vì chia đều tuyến tính cũ.
function computeNeuronBinEnergy(vizDataArray, bufferLength, neuronIndex, neuronCount) {
    const { start, end } = tonotopicBinRange(neuronIndex, neuronCount, bufferLength);
    let peak = 0;
    for (let i = start; i < end; i++) peak = Math.max(peak, vizDataArray[i] || 0);
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

// MỚI (yêu cầu Giang — tốc độ lan tín hiệu nên phản ánh ĐỘ MẠNH của chính đợt onset đã kích hoạt
// nó, không chỉ 1 tốc độ chung cho cả mạng): `diff` là độ lệch năng lượng đã kích hoạt spark này
// (tính sẵn ở _tickConnectorSynapse, visualizer-render.js) — onset càng mạnh, spark bắn ra càng
// NHANH, khớp trực giác nhân-quả (nghe cú đánh mạnh, thấy xung bắn nhanh/gọn ngay tại đúng chỗ đó),
// khác với tốc độ NỀN chung (cfg.synapseSpeedBase + smoothedEnergy, đại diện "không khí" cả bài).
// Nhân 2 tầng lại với nhau ở _tickConnectorSynapse() (Workflow truyền `speed * signal.speedMult`
// vào stepActionPotential() bên dưới).
function computeSignalSpeedMult(diff) {
    return Math.max(0.6, Math.min(1.6, 0.7 + diff / 180));
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
// connectedSynapses/incomingSynapses, three-connector.js) bị tạm NÂNG ngưỡng bắn lên (khó bắn hơn)
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
// sáng (energy, dùng ở applyNeuronExcitement() bên dưới), tự thích nghi (adaptation) và bị hàng xóm
// ức chế (lateralInhibition) — gộp chung 1 hàm vì cùng là "trạng thái tạm thời decay theo thời
// gian", gọi 1 lần/nơ-ron/frame từ _tickConnectorSynapse() (visualizer-render.js).
function decayNeuronState(neuron, deltaTime) {
    if (neuron.energy > 0) neuron.energy = Math.max(0, neuron.energy - deltaTime * 1.7);
    if (neuron.adaptation > 0) neuron.adaptation = Math.max(0, neuron.adaptation - deltaTime * ADAPTATION_DECAY_PER_SEC);
    if (neuron.lateralInhibition > 0) neuron.lateralInhibition = Math.max(0, neuron.lateralInhibition - deltaTime * LATERAL_INHIBIT_DECAY_PER_SEC);
}

// GIỮ NGUYÊN công thức "bioluminescent excitation" gốc — chỉ đổi base hue từ hardcode 0.52 sang
// HSL của màu getComputedColor() đang active. MỚI (16/09/2026): glow pulse theo neuron.scale —
// đồng bộ với nhân/dây đã scale theo màn hình (xem createAnatomicalNeuron(), core/webgl/three-connector.js).
//
// SỬA TIẾP (yêu cầu Giang 17/09/2026 — "đổi màu phải render lại từ đầu chứ không chuyển ngay tức
// thì, render không có tính liên tục"): TRƯỚC ĐÂY hàm này chỉ chạm `somaMesh.material.color` —
// nucleus/dendrite/glowSprite/axon (hillock/core/myelin/bouton, bake ở createAnatomicalNeuron()/
// createPhysicalSynapticAxon(), three-connector.js) hoàn toàn KHÔNG được đọc lại, đứng yên màu lúc
// buildSynapseNetwork() dựng lưới. Trong khi các effect khác (bar/vortex — xem
// _tickVortexRender()/_tickBar(), visualizer-render.js) gọi getComputedColor() MỖI FRAME cho MỌI
// phần tử nên đổi mode/dynA/dynB/solidColor tự thấy ngay, connector lại là mesh Three.js SỐNG LÂU
// DÀI (persistent) — bake xong không ai đụng lại. Cách duy nhất thấy màu mới ĐÚNG ở mọi nơi trước
// đây là rebuild cả lưới (initThreeJSConnector(), cơ chế `refresh` hiện chỉ gắn cho
// neuronCount/nodeCount — CỐ Ý không gắn cho field màu chung, gắn vào sẽ ép MỌI effect khác cũng
// phải rebuild cứng mỗi lần đổi màu, phá luôn tính liên tục vốn có của chúng).
// Sửa: đồng bộ SỐNG mỗi frame ở ĐÚNG NGAY HÀM NÀY (được gọi mỗi frame/mỗi nơ-ron từ
// _tickConnectorSynapse(), visualizer-render.js, với `color.fill`/`color.glow` tính MỚI mỗi lần) —
// nucleus/soma (base + emissive), dendrite, glowSprite, VÀ lan qua toàn bộ axon của các synapse
// XUẤT PHÁT từ nơ-ron này (`connectedSynapses` — màu axon vốn lấy nguyên từ fromNeuron.fillColorHex
// lúc build, nay đồng bộ sống theo đúng gốc đó thay vì bake chết). `.set()` (không phải `.setHex()`)
// vì `fillColorHex`/`glowColorHex` tham số có thể là chuỗi hsla()/hex tuỳ mode màu (getComputedColor(),
// core/audio-analysis.js) — THREE.Color.set() tự nhận diện được cả 2 dạng.
function applyNeuronExcitement(neuron, fillColorHex, glowColorHex) {
    const excite = Math.min(1.0, neuron.energy);
    const hsl = {};
    new THREE.Color(fillColorHex).getHSL(hsl);

    neuron.nucleusMesh.material.color.set(fillColorHex);
    neuron.nucleusMesh.material.emissive.set(fillColorHex);
    neuron.nucleusMesh.material.emissiveIntensity = 0.95 + excite * 3.5;

    neuron.somaMesh.material.emissive.set(fillColorHex);
    neuron.somaMesh.material.emissiveIntensity = 0.65 + excite * 2.8;
    neuron.somaMesh.material.color.setHSL((hsl.h + excite * 0.08) % 1, 1.0, Math.min(0.9, hsl.l + excite * 0.4));

    neuron.dendriteMat.color.set(fillColorHex);
    neuron.dendriteMat.emissive.set(fillColorHex);

    neuron.glowSprite.material.color.set(glowColorHex);
    neuron.glowSprite.scale.setScalar((25 + excite * 20) * neuron.scale);

    neuron.connectedSynapses.forEach((synapse) => {
        synapse.hillockMesh.material.color.set(fillColorHex);
        synapse.hillockMesh.material.emissive.set(fillColorHex);
        synapse.axonCoreMesh.material.color.set(fillColorHex);
        synapse.axonCoreMesh.material.emissive.set(fillColorHex);
        synapse.myelinMat.color.set(fillColorHex);
        synapse.myelinMat.emissive.set(fillColorHex);
        synapse.boutonMesh.material.color.set(fillColorHex);
        synapse.boutonMesh.material.emissive.set(fillColorHex);
    });
}

// GIỮ NGUYÊN mechanic lan truyền + saltatory pulse gần Node of Ranvier của gốc.
function stepActionPotential(signal, synapse, speed, deltaTime) {
    signal.progress += (speed * deltaTime) / synapse.totalDistance;
    if (signal.progress >= 1) return true;
    const p = synapse.axonCurve.getPoint(Math.min(1, signal.progress));
    signal.mesh.position.copy(p);
    let nearNode = false;
    synapse.nodesOfRanvier.forEach((nodePos) => { if (p.distanceTo(nodePos) < 2.8) nearNode = true; });
    signal.mesh.scale.setScalar(nearNode ? 1.95 : 1.0);
    return false;
}
