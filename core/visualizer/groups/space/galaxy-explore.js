/**
 * core/visualizer/groups/space/galaxy-explore.js — [ĐỔI TÊN + CHUYỂN NHÓM, 05/09/2026, yêu cầu
 * Giang] Trước đây `core/visualizer/types/space.js` ("space"/Galaxy) — giờ thuộc group "space"
 * (core/visualizer/groups/space/), tên style đổi thành "galaxy explore". Nội dung hàm GIỮ NGUYÊN
 * 100%, chỉ đổi đường dẫn/tên file. Giang cần XOÁ TAY file cũ `core/visualizer/types/space.js`
 * (không tự xoá qua patch) — xem index.html cần cập nhật `<script src="...">` tương ứng.
 *
 * Vài hàm Core NHỎ, mỗi hàm 1 việc, chạy MỖI FRAME — `event/workflow/visualizer-render.js` gọi
 * RIÊNG LẺ từng hàm dưới đây theo đúng thứ tự, KHÔNG hàm nào ở đây gọi hàm khác trong CHÍNH FILE
 * NÀY, và CŨNG KHÔNG gọi bất kỳ hàm nào ở `core/webgl/three-space.js` (2 file đứng NGANG HÀNG,
 * cùng bị Workflow gọi riêng lẻ — xem quy tắc đầy đủ ở đầu `core/webgl/three-space.js`).
 *
 * NẠP: SAU `core/visualizer/groups/space/common.js` (registry, không phụ thuộc hàm) và SAU
 * `core/webgl/three-space.js` (không phụ thuộc lẫn nhau về hàm, nhưng cùng nhóm "engine Galaxy"
 * nên đặt cạnh nhau trong index.html cho dễ đọc, giống cặp three-vortex.js/vortex group).
 *
 * VIẾT LẠI HOÀN TOÀN (26/08/2026, phản hồi Giang — "loại bỏ mô hình cũ, không cần ý kiến") — BỎ
 * HẲN 4 hàm thuộc mô hình bản đồ TĨNH + quỹ đạo Bezier cũ: `findClusterTargetAhead()` (dò cụm
 * trong 1 "nón" phía trước — không còn khái niệm "dò", đích LUÔN là toạ độ TÂM cụm/thiên hà đã
 * biết chính xác), `mirrorPositionIfOutOfBounds()` (kẹp biên bản đồ TĨNH — không còn "bản đồ" nào
 * để có biên), `computeSpaceLegControlPoint()`/`computeSpaceLegPosition()` (nội suy Quadratic
 * Bezier cong — quỹ đạo giờ là các ĐOẠN THẲNG nối tiếp, dùng `computeSpaceSegmentPosition()` MỚI
 * bên dưới). THÊM MỚI `computeSpaceSegmentPosition()` (thay Bezier) và `computeSpaceDriftPoint()`
 * (điểm C — mục 2b(5), "khoảng cách trôi từ B đến C dựa vào beat"). 6 hàm còn lại (góc lệch/thời
 * lượng xoay/nội suy hướng nhìn/orientation ổn định/bụi nền/render) GIỮ NGUYÊN 100% — vẫn đúng nhu
 * cầu cho mô hình MỚI (pha ROTATE của cả 2 cấp cụm/thiên hà dùng CHUNG các hàm này).
 */

/**
 * Vị trí camera tại 1 điểm dọc 1 ĐOẠN THẲNG, ĐÃ easing (smoothstep — chậm lúc đầu/cuối, nhanh giữa
 * chừng) — thay hẳn nội suy Quadratic Bezier cũ (ĐÃ BỎ cùng mô hình bản đồ TĨNH, xem đầu file).
 * Quỹ đạo MỚI là các đoạn thẳng nối tiếp (A->tâm cụm cho pha `clusterTravel`; A->B->C — GỌI HÀM
 * NÀY 2 LẦN, 1 lần mỗi đoạn — cho pha `galaxyTravel`, xem event/workflow/visualizer-render.js).
 * @param {THREE.Vector3} fromPos @param {THREE.Vector3} toPos @param {number} progress - 0..1 (tự kẹp)
 * @returns {THREE.Vector3}
 */
function computeSpaceSegmentPosition(fromPos, toPos, progress) {
    const clamped = Math.max(0, Math.min(1, progress));
    const eased = clamped * clamped * (3 - 2 * clamped); // smoothstep
    return fromPos.clone().lerp(toPos, eased);
}

/**
 * Điểm C (mục 2b(5), MỚI 26/08/2026) — "trôi" tiếp từ B theo ĐÚNG hướng vừa bay tới B (hướng
 * A->B), xa thêm 1 đoạn phụ thuộc cường độ beat TẠI THỜI ĐIỂM vừa xác định xong B ("khoảng cách
 * trôi từ B đến C dựa vào beat lúc đấy") — beat càng mạnh trôi càng xa. Workflow tự đọc
 * `beatScale` rồi truyền vào đây NGAY lúc bắt đầu pha `galaxyTravel` (snapshot 1 lần, KHÔNG đổi
 * lại giữa chừng — cùng tinh thần các giá trị "chốt lúc bắt đầu" khác trong engine này).
 * @param {THREE.Vector3} fromPos - điểm A @param {THREE.Vector3} midPos - điểm B
 * @param {number} baseDistance @param {number} beatScale - 0..~1+ @param {number} beatMultiplier
 * @returns {THREE.Vector3}
 */
function computeSpaceDriftPoint(fromPos, midPos, baseDistance, beatScale, beatMultiplier) {
    const direction = midPos.clone().sub(fromPos).normalize();
    const driftDistance = baseDistance + beatScale * beatMultiplier;
    return midPos.clone().addScaledVector(direction, driftDistance);
}

/**
 * Góc lệch (độ, 0-180) giữa 2 hướng nhìn — thời lượng pha ROTATE (cả `clusterRotate` LẪN
 * `galaxyRotate`) tỉ lệ theo góc này, xem `computeSpaceRotateDuration()`.
 * @param {THREE.Vector3} fromForward @param {THREE.Vector3} toForward @returns {number}
 */
function computeAngleBetweenForwards(fromForward, toForward) {
    const dot = THREE.MathUtils.clamp(fromForward.dot(toForward), -1, 1);
    return THREE.MathUtils.radToDeg(Math.acos(dot));
}

/**
 * Thời lượng (giây) cho pha XOAY HƯỚNG (dùng CHUNG `clusterRotate`/`galaxyRotate`) — "xoay hướng
 * này phải được làm mềm... dù quay 1-30 độ hay 1-180 độ cảm giác mượt vẫn là như nhau" — tức
 * KHÔNG tuyến tính. Power-law: góc càng lớn thời lượng càng dài, mũ < 1 khiến góc nhỏ đã tăng
 * nhanh rồi thoải dần về `maxDuration` lúc góc gần 180° (đường lõm, không tuyến tính).
 * `musicSpeedFactor` (Workflow tự tính từ BPM/energy) CHIA vào thời lượng gốc (theo góc) — nhạc
 * nhanh/năng lượng cao (factor > 1) rút ngắn thời lượng (xoay NHANH hơn), nhạc chậm/yên tĩnh
 * (factor < 1) kéo dài ra (xoay CHẬM hơn) — KHÔNG thay thế yếu tố góc, chỉ điều biến thêm lên trên.
 * @param {number} angleDeg @param {number} minDuration @param {number} maxDuration @param {number} power
 * @param {number} musicSpeedFactor - > 1 xoay nhanh hơn, < 1 xoay chậm hơn, 1 = không đổi
 * @returns {number} giây
 */
function computeSpaceRotateDuration(angleDeg, minDuration, maxDuration, power, musicSpeedFactor) {
    const clampedAngle = Math.max(0, Math.min(180, angleDeg));
    const ratio = Math.pow(clampedAngle / 180, power);
    const baseDuration = minDuration + (maxDuration - minDuration) * ratio;
    return baseDuration / musicSpeedFactor;
}

/**
 * Hướng camera TẠI 1 thời điểm giữa pha ROTATE — nội suy quaternion (slerp) từ `fromForward` sang
 * `toForward`, PHỦ ĐỦ mọi góc kể cả gần/đúng 180° đối cực (`setFromUnitVectors()` tự chọn trục
 * xoay dự phòng khi 2 vector gần như ngược hướng nhau). Dùng CHUNG cho 3 tình huống: pha
 * `clusterRotate`/`galaxyRotate` (vị trí camera KHOÁ NGUYÊN, chỉ hướng nhìn đổi) VÀ pha
 * `galaxyTravel` (vị trí CÓ đổi theo `computeSpaceSegmentPosition()`, nhưng hướng nhìn nội suy
 * SONG SONG, độc lập, theo ĐÚNG progress — mục 2b(5) "đồng thời camera phải quay ngược lại chính
 * hướng vừa đi").
 * @param {THREE.Vector3} fromForward @param {THREE.Vector3} toForward @param {number} t - 0..1 (đã easing)
 * @returns {THREE.Vector3}
 */
function computeSpaceRotateForward(fromForward, toForward, t) {
    const qTarget = new THREE.Quaternion().setFromUnitVectors(fromForward, toForward);
    const qCurrent = new THREE.Quaternion().slerp(qTarget, t);
    return fromForward.clone().applyQuaternion(qCurrent).normalize();
}

/**
 * Dựng hướng camera TRỰC TIẾP từ 3 trục trực chuẩn (forward/right/up) ĐÃ CÓ SẴN NHÁNH DỰ PHÒNG
 * (xem `computeSpaceForwardBasis()`, core/webgl/three-space.js) — THAY hẳn `Object3D.lookAt()`
 * (Three.js), nguồn gốc THẬT SỰ của hiện tượng "hard cut": `lookAt()` tự tính lại right/up từ
 * forward + world-up MỖI LẦN gọi, KHÔNG có nhánh dự phòng khi forward gần song song world-up
 * (~camera nhìn gần thẳng đứng) — vector right suy biến gần 0, hướng "lên" của camera random hoá
 * đột ngột. Dùng LUÔN basis đã tính ổn định (Workflow tính 1 lần/frame qua
 * `computeSpaceForwardBasis()` rồi truyền vào đây) -> KHÔNG BAO GIỜ suy biến -> roll LUÔN khoá ổn
 * định.
 * @param {THREE.Camera} camera @param {THREE.Vector3} forward @param {THREE.Vector3} right @param {THREE.Vector3} up */
function applyStableSpaceOrientation(camera, forward, right, up) {
    const m = new THREE.Matrix4().makeBasis(right, up, forward.clone().negate());
    camera.quaternion.setFromRotationMatrix(m);
}

/** Cập nhật vị trí bụi vũ trụ nền theo camera (wrap 3D quanh camera, cảm giác bụi vô hạn) +
 * "twinkle" (độ sáng tổng nhấp nháy nhẹ theo `beatScale` thô).
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

/** Render scene Galaxy — bọc `renderer.render()` thành 1 hàm Core cho nhất quán với các bước
 * khác (thay vì Workflow gọi thẳng API renderer — vẫn hợp lệ, nhưng để đúng tinh thần "Workflow
 * gọi RIÊNG LẺ từng hàm Core").
 * @param {THREE.WebGLRenderer} renderer @param {THREE.Scene} scene @param {THREE.Camera} camera */
function renderSpaceScene(renderer, scene, camera) {
    renderer.render(scene, camera);
}
