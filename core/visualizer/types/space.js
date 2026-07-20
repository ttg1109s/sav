/**
 * core/visualizer/types/space.js — viết lại HOÀN TOÀN (20/07/2026, plan-space-galaxy.md Phần B)
 * — bản trước đã bị xoá trắng (0 byte). Vài hàm Core NHỎ, mỗi hàm 1 việc, chạy MỖI FRAME —
 * `event/workflow/visualizer-render.js::_tickSpace()` gọi RIÊNG LẺ từng hàm dưới đây theo đúng
 * thứ tự (camera -> chain -> dust -> render), KHÔNG hàm nào ở đây gọi hàm khác trong CHÍNH FILE
 * NÀY, và CŨNG KHÔNG gọi bất kỳ hàm nào ở `core/webgl/three-space.js` (2 file đứng NGANG HÀNG,
 * cùng bị Workflow gọi riêng lẻ — xem quy tắc đầy đủ ở đầu `core/webgl/three-space.js`).
 *
 * NẠP: SAU `core/webgl/three-space.js` (không phụ thuộc lẫn nhau về hàm, nhưng cùng nhóm
 * "engine Galaxy" nên đặt cạnh nhau trong index.html cho dễ đọc, giống cặp
 * three-vortex.js/types/vortex.js).
 */

/** Bước camera 1 frame: giảm tốc khi xuyên lõi thiên hà mục tiêu, tiến theo `viewDir` (ĐÃ hợp
 * nhất "hướng bay" và "hướng nhìn" làm 1, plan B3 — KHÔNG có zoom/dolly riêng, 360° xoay + tịnh
 * tiến theo `viewDir` đã tự bao gồm hiệu ứng gần/xa/lên/xuống).
 * @param {THREE.PerspectiveCamera} camera
 * @param {THREE.Vector3} viewDir - đã lerp sẵn về phía `viewDirTarget` (xem `updateSpaceViewDirLerp`)
 * @param {THREE.Vector3|null} targetGalaxyPos - vị trí thiên hà đang khoá mục tiêu (null nếu chưa có)
 * @param {number} baseSpeed - tốc độ hành trình cơ sở (đã tính từ BPM+energy, xem Workflow)
 * @param {number} delta - giây kể từ frame trước
 * @returns {number} quãng đường vừa đi được (dùng để cộng dồn thống kê nếu cần)
 */
function updateSpaceCamera(camera, viewDir, targetGalaxyPos, baseSpeed, delta) {
    let speedModifier = 1.0;
    if (targetGalaxyPos) {
        const distToCore = camera.position.distanceTo(targetGalaxyPos);
        if (distToCore < 80) {
            speedModifier = THREE.MathUtils.mapLinear(Math.max(distToCore, 12), 12, 80, 0.38, 0.95);
        }
    }
    const moveStep = viewDir.clone().multiplyScalar(baseSpeed * speedModifier * delta);
    camera.position.add(moveStep);
    camera.lookAt(camera.position.clone().add(viewDir));
    return moveStep.length();
}

/** Lerp `viewDir` (hướng HIỆN TẠI) về phía `viewDirTarget` (hướng MỤC TIÊU, chỉ đổi lúc "reroll")
 * — tạo đúng cảm giác "momen" rẽ trái/phải/trên/dưới từng đợt thay vì xoay đều liên tục (plan B3).
 * Mutate `viewDir` TRỰC TIẾP (tham số truyền vào là chính THREE.Vector3 đang sống trong appState,
 * KHÔNG phải gọi `appState.mutate` — giống hệt cách `tCamera.position.x += ...` mutate trực tiếp
 * 1 THREE object reference trong `core/visualizer/types/vortex.js::drawVortex()`).
 * @param {THREE.Vector3} viewDir @param {THREE.Vector3} viewDirTarget @param {number} lerpFactor */
function updateSpaceViewDirLerp(viewDir, viewDirTarget, lerpFactor) {
    viewDir.lerp(viewDirTarget, lerpFactor);
    viewDir.normalize();
}

/** Cập nhật vị trí bụi vũ trụ nền theo camera (wrap 3D quanh camera, cảm giác bụi vô hạn) +
 * "twinkle" (độ sáng tổng nhấp nháy nhẹ theo `beatScale` thô — Rẻ, plan B4).
 * @param {THREE.Points} dustMesh @param {THREE.Vector3} camPos @param {number} range @param {number} beatScale */
function updateSpaceDustEachFrame(dustMesh, camPos, range, beatScale) {
    const positions = dustMesh.geometry.attributes.position.array;
    const halfRange = range / 2;
    const count = positions.length / 3;
    for (let i = 0; i < count; i++) {
        const dx = positions[i * 3] - camPos.x;
        const dy = positions[i * 3 + 1] - camPos.y;
        const dz = positions[i * 3 + 2] - camPos.z;
        if (dx < -halfRange) positions[i * 3] += range; else if (dx > halfRange) positions[i * 3] -= range;
        if (dy < -halfRange) positions[i * 3 + 1] += range; else if (dy > halfRange) positions[i * 3 + 1] -= range;
        if (dz < -halfRange) positions[i * 3 + 2] += range; else if (dz > halfRange) positions[i * 3 + 2] -= range;
    }
    dustMesh.geometry.attributes.position.needsUpdate = true;
    dustMesh.position.copy(camPos);
    dustMesh.material.opacity = 0.4 + beatScale * 0.3;
}

/**
 * Phân tích trạng thái chuỗi thiên hà — CHỈ TÍNH TOÁN/QUYẾT ĐỊNH, KHÔNG tự dispose/spawn gì cả
 * (Workflow tự đọc kết quả trả về rồi tự gọi `cluster.dispose(scene)`/tự spawn cụm mới — Rule 2
 * "chỉ nhận tham số", Rule 3 "không tự gọi hàm khác"). Guard/lookup thuần, không rẽ nhánh giữa 2
 * tiến trình nghiệp vụ khác nhau — chỉ 1 kịch bản duy nhất "đánh giá chuỗi hiện tại".
 * @param {GalaxyCluster[]} clusters @param {number} camZ
 * @param {number} disposeDistance - dispose khi thiên hà đã trôi lại phía sau quá khoảng này
 * @param {number} aheadWindow - tầm nhìn xa cần đảm bảo luôn có thiên hà phủ tới (CỐ ĐỊNH 1500, plan B6)
 * @param {number} aheadMargin - biên tối thiểu phía trước camera để tính "đã ở phía trước"
 * @returns {{toDisposeIndices: number[], furthestZ: number, needsMoreSpawns: boolean, nearestAheadIndex: (number|null)}}
 */
function manageGalaxyChain(clusters, camZ, disposeDistance, aheadWindow, aheadMargin) {
    const toDisposeIndices = [];
    for (let i = clusters.length - 1; i >= 0; i--) {
        if (clusters[i].position.z > camZ + disposeDistance) toDisposeIndices.push(i);
    }

    const remaining = clusters.filter((_, i) => toDisposeIndices.indexOf(i) === -1);
    const furthestZ = remaining.length > 0 ? Math.min(...remaining.map(c => c.position.z)) : camZ;
    const needsMoreSpawns = furthestZ > camZ - aheadWindow;

    const ahead = remaining.filter(c => c.position.z < camZ - aheadMargin).sort((a, b) => b.position.z - a.position.z);
    const nearestAheadIndex = ahead.length > 0 ? ahead[0].index : null;

    return { toDisposeIndices, furthestZ, needsMoreSpawns, nearestAheadIndex };
}

/** Render scene Galaxy — bọc `renderer.render()` thành 1 hàm Core cho nhất quán với các bước
 * khác (thay vì Workflow gọi thẳng API renderer — vẫn hợp lệ, nhưng để đúng tinh thần "Workflow
 * gọi RIÊNG LẺ từng hàm Core" của plan B2/B8).
 * @param {THREE.WebGLRenderer} renderer @param {THREE.Scene} scene @param {THREE.Camera} camera */
function renderSpaceScene(renderer, scene, camera) {
    renderer.render(scene, camera);
}
