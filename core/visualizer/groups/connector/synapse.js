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

// GIỮ NGUYÊN công thức Hooke's Law + decay energy (1.7/s) của updatePhysicsAndSignals() gốc.
// SỬA (phản hồi Giang 16/09/2026 — "đàn hồi mạnh, thậm chí văng mất"): xung Z giờ LUÔN CÙNG DẤU
// (+Z, xem _tickConnectorSynapse, event/workflow/visualizer-render.js — trước đây 3 trục ngẫu
// nhiên tự triệt tiêu bớt lẫn nhau, giờ không còn). Nơ-ron bậc-vào cao (nhiều dây tới — đặc biệt
// sau khi buildSynapseGraph() đảm bảo tối thiểu 1 dây/nơ-ron) có thể nhận NHIỀU xung dồn dập gần
// như cùng lúc (xung khi tín hiệu TỚI không qua cooldown, khác xung tự bắn theo onset) -> vận
// tốc/độ lệch cộng dồn không giới hạn theo thời gian -> văng khỏi mặt lưới. Kẹp velocity.z +
// position.z (theo neuron.scale — nơ-ron to thì biên độ đàn hồi cho phép lớn hơn theo) NGAY TẠI
// ĐÂY — lớp bảo vệ CUỐI CÙNG, đúng bất kể xung tới từ đâu/dồn bao nhiêu lần, không cần sửa từng
// nơi phát xung.
const MAX_ELASTIC_VELOCITY = 34;
const MAX_ELASTIC_OFFSET = 40;

// MỚI (yêu cầu Giang 17/09/2026 — "đàn hồi cơ học, sợi dây tách khỏi nơ-ron lân cận, đáng lẽ phải
// kéo nhẹ neuron lân cận"): trước đây MỖI nơ-ron dao động HOÀN TOÀN độc lập — lò xo Hooke's Law
// riêng chỉ kéo về `restPosition` của chính nó, không hề biết tới nơ-ron nào đang nối dây (dù
// `connectedSynapses` đã có sẵn danh sách). Thêm 1 lực coupling NHẸ: mỗi nơ-ron bị kéo về phía độ
// lệch Z TRUNG BÌNH của các nơ-ron nối dây trực tiếp (cả chiều dây RA `connectedSynapses` lẫn dây
// TỚI `incomingSynapses`, xem createPhysicalSynapticAxon(), core/webgl/three-connector.js) — đúng
// cơ chế lò xo nối giữa 2 nút trong lưới vải (mass-spring mesh), không thay thế lò xo riêng
// (Hooke's law) bên dưới, chỉ CỘNG THÊM. NEIGHBOR_COUPLE_STRENGTH cố tình nhỏ hơn hẳn stiffness
// riêng — mục đích tạo cảm giác "cả lưới rung lan toả", không làm nơ-ron lân cận nảy MẠNH bằng
// nơ-ron vừa bắn. Đọc `.position.z` của neighbor NGAY TRONG vòng lặp neurons.forEach()
// (visualizer-render.js) nên 1 phần neighbor đã bước frame này/1 phần chưa (kiểu Gauss-Seidel) —
// chấp nhận được, không cần tách thêm 1 pass riêng chỉ để đồng bộ tuyệt đối.
const NEIGHBOR_COUPLE_STRENGTH = 0.05;

function stepNeuronSpring(neuron, stiffness, damping, deltaTime) {
    const neighborCount = neuron.connectedSynapses.length + neuron.incomingSynapses.length;
    if (neighborCount > 0) {
        const selfOffsetZ = neuron.position.z - neuron.restPosition.z;
        let neighborOffsetSum = 0;
        neuron.connectedSynapses.forEach((s) => { neighborOffsetSum += (s.toNeuron.position.z - s.toNeuron.restPosition.z); });
        neuron.incomingSynapses.forEach((s) => { neighborOffsetSum += (s.fromNeuron.position.z - s.fromNeuron.restPosition.z); });
        const avgNeighborOffsetZ = neighborOffsetSum / neighborCount;
        neuron.velocity.z += (avgNeighborOffsetZ - selfOffsetZ) * NEIGHBOR_COUPLE_STRENGTH;
    }

    const displacement = neuron.position.clone().sub(neuron.restPosition);
    neuron.velocity.add(displacement.multiplyScalar(-stiffness));
    neuron.velocity.multiplyScalar(damping);
    neuron.velocity.z = Math.max(-MAX_ELASTIC_VELOCITY, Math.min(MAX_ELASTIC_VELOCITY, neuron.velocity.z));
    neuron.position.add(neuron.velocity);
    const maxOffset = MAX_ELASTIC_OFFSET * neuron.scale;
    neuron.position.z = Math.max(neuron.restPosition.z - maxOffset, Math.min(neuron.restPosition.z + maxOffset, neuron.position.z));
    neuron.container.position.copy(neuron.position);
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
