/**
 * core/visualizer/groups/connector/synapse.js — bước 1 khung hình, style synapse. THUẦN, Workflow
 * (_tickConnectorSynapse(), event/workflow/visualizer-render.js) tự gom appState rồi gọi.
 */

// SỬA (phản hồi Giang — bắn quá thưa, không rõ theo nhạc): trung bình 34 bin/nơ-ron (1024 bin ÷
// 30) làm loãng hẳn đỉnh phổ — 1 tần số nổi bật giữa nhiều bin yên tĩnh vẫn bị kéo tụt xuống dưới
// ngưỡng. Đổi sang LẤY ĐỈNH (max) của dải — nhạy đúng với 1 nốt/nhạc cụ nổi lên trong dải đó.
function computeNeuronBinEnergy(vizDataArray, bufferLength, neuronIndex, neuronCount) {
    const segment = Math.max(1, Math.floor(bufferLength / neuronCount));
    const start = neuronIndex * segment;
    let peak = 0;
    for (let i = 0; i < segment; i++) peak = Math.max(peak, vizDataArray[start + i] || 0);
    return peak;
}

// XOÁ TOÀN BỘ (yêu cầu Giang 17/09/2026 — "loại bỏ tính đàn hồi"): trước đây ở đây là
// stepNeuronSpring() — vật lý lò xo Hooke's Law (bake theo restPosition, xung Z lúc bắn, kẹp
// velocity/offset qua 2 hằng số MAX_ELASTIC_VELOCITY/MAX_ELASTIC_OFFSET, coupling nhẹ với
// connectedSynapses/incomingSynapses thêm hôm trước). Toàn bộ đã bỏ — nơ-ron giờ đứng CỐ ĐỊNH đúng
// `restPosition` (đặt 1 lần lúc createAnatomicalNeuron(), three-connector.js, không ai đụng lại).
// CHỈ giữ lại đúng phần "fade năng lượng bừng sáng" của stepNeuronSpring() cũ — KHÔNG liên quan vị
// trí/đàn hồi, chỉ là fade độ sáng excite (dùng ở applyNeuronExcitement() bên dưới) theo thời gian
// — chuyển qua hàm riêng, nhỏ gọn, tên phản ánh đúng việc nó làm.
function decayNeuronExcitement(neuron, deltaTime) {
    if (neuron.energy > 0) neuron.energy = Math.max(0, neuron.energy - deltaTime * 1.7);
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
