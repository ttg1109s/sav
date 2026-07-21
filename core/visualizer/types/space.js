/**
 * core/visualizer/types/space.js — viết lại HOÀN TOÀN (20/07/2026, plan-space-galaxy.md Phần B)
 * — bản trước đã bị xoá trắng (0 byte). Vài hàm Core NHỎ, mỗi hàm 1 việc, chạy MỖI FRAME —
 * `event/workflow/visualizer-render.js::_tickSpace()` gọi RIÊNG LẺ từng hàm dưới đây theo đúng
 * thứ tự, KHÔNG hàm nào ở đây gọi hàm khác trong CHÍNH FILE NÀY, và CŨNG KHÔNG gọi bất kỳ hàm nào
 * ở `core/webgl/three-space.js` (2 file đứng NGANG HÀNG, cùng bị Workflow gọi riêng lẻ — xem quy
 * tắc đầy đủ ở đầu `core/webgl/three-space.js`).
 *
 * NẠP: SAU `core/webgl/three-space.js` (không phụ thuộc lẫn nhau về hàm, nhưng cùng nhóm
 * "engine Galaxy" nên đặt cạnh nhau trong index.html cho dễ đọc, giống cặp
 * three-vortex.js/types/vortex.js).
 *
 * VIẾT LẠI LẦN 3 (21/07/2026, phản hồi Giang lượt 6) — tách HẲN "di chuyển" và "xoay hướng" thành
 * 2 PHA riêng biệt, không chồng lên nhau (`spPhase`: 'travel' | 'rotating', xem
 * `event/workflow/visualizer-render.js`): pha TRAVEL camera di chuyển A->B theo hướng CỐ ĐỊNH
 * (không đổi hướng nhìn); đến B chuyển sang pha ROTATE — vị trí camera KHOÁ NGUYÊN tại B, chỉ
 * hướng NHÌN đổi dần X->Y. Rotate xong mới bắt đầu TRAVEL leg kế tiếp.
 *
 * VIẾT LẠI LẦN 4 (21/07/2026, phản hồi Giang lượt 9 — "thay vì vừa chuyển vừa tạo... ngay từ đầu
 * tạo 1 map thiên hà sẵn có 3D trải đều các hướng... khỏi cần tính việc sinh ra cụm và thiên hà
 * tính hướng") — BỎ HẲN `manageGalaxyChain()` (quản lý chuỗi thiên hà "vừa bay vừa spawn/dispose
 * theo cửa sổ phía trước") VÀ `assessGalaxyDensityAhead()` (kiểm tra mật độ TRƯỚC khi cho phép
 * xoay — không còn cần thiết vì bản đồ giờ TĨNH, dựng sẵn ĐỦ mọi hướng, không có khái niệm "chưa
 * kịp sinh thiên hà theo hướng mới" nữa). `findClusterTargetAhead()` bỏ ưu tiên khoảng xa (phản
 * hồi Giang — "không cần ưu tiên khoảng xa"), chọn NGẪU NHIÊN ĐỀU trong mọi cụm khớp nón.
 * `computeSpaceRotateDuration()` nhận thêm `musicSpeedFactor` (mục "tốc độ xoay camera... cần phải
 * phụ thuộc vào thông số nhạc"). THÊM MỚI `mirrorPositionIfOutOfBounds()` (mục "biên bản đồ — nếu
 * vượt biên thì lấy toạ độ ÂM").
 */

// (assessGalaxyDensityAhead() ĐÃ BỎ, 21/07/2026 lượt 9, phản hồi Giang — "khỏi cần tính việc sinh
// ra cụm và thiên hà tính hướng". Hàm này TỪNG dùng để kiểm tra mật độ thiên hà TRƯỚC khi cho phép
// chuyển sang pha ROTATE (đề phòng xoay vào hướng chưa kịp sinh thiên hà) — không còn cần thiết vì
// bản đồ giờ TĨNH, dựng sẵn ĐỦ mọi hướng ngay từ đầu, không có khái niệm "hướng chưa kịp sinh" nữa
// — `findClusterTargetAhead()` bên dưới CHẮC CHẮN tìm được mục tiêu hợp lệ, xem
// event/workflow/visualizer-render.js::_computeTravelWaypoint().)

/**
 * Tìm 1 cụm thiên hà làm MỤC TIÊU camera bay tới/xuyên qua — trong 1 "nón" phía trước theo hướng
 * `forward`. VIẾT LẠI (21/07/2026, phản hồi Giang lượt 9 — "không cần ưu tiên khoảng xa"): bản
 * trước (lượt 7) ưu tiên cụm đủ xa (`minDist`) — Giang xác nhận KHÔNG CẦN nữa, giờ chọn NGẪU NHIÊN
 * ĐỀU trong TẤT CẢ cụm khớp nón, không phân biệt gần/xa. Khoảng cách dùng để lọc là khoảng cách 3D
 * THẬT (`offset.length()`, giữa 2 TOẠ ĐỘ đầy đủ x/y/z), KHÔNG PHẢI khoảng cách chiếu phẳng lên 1
 * mặt phẳng nào — camera CHẮC CHẮN di chuyển trùng khớp toạ độ với cụm được chọn (Workflow set
 * `nextPos` = TOẠ ĐỘ THẬT trả về ở đây, camera bay đúng theo Bezier tới ĐÚNG điểm này, xem
 * `_computeTravelWaypoint()`, event/workflow/visualizer-render.js).
 * @param {GalaxyCluster[]} clusters @param {THREE.Vector3} camPos @param {THREE.Vector3} forward
 * @param {number} maxAngleCos - cos(góc nón tối đa) — 1 = thẳng chính giữa, càng nhỏ nón càng rộng
 * @param {number} maxDist - khoảng cách 3D THẬT tối đa còn tính là "trong tầm"
 * @returns {THREE.Vector3|null} toạ độ THẬT của cụm được chọn, null nếu không có cụm nào khớp
 */
function findClusterTargetAhead(clusters, camPos, forward, maxAngleCos, maxDist) {
    const candidates = [];
    for (let i = 0; i < clusters.length; i++) {
        const offset = clusters[i].position.clone().sub(camPos);
        const dist = offset.length(); // khoảng cách 3D THẬT giữa 2 toạ độ đầy đủ x/y/z, KHÔNG phải chiếu phẳng
        if (dist <= 0 || dist > maxDist) continue;
        const cosAngle = offset.dot(forward) / dist;
        if (cosAngle < maxAngleCos) continue;
        candidates.push(clusters[i].position);
    }
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)].clone();
}

/**
 * Biên bản đồ — MỚI (21/07/2026, phản hồi Giang lượt 9 — "nếu nextPos = hoặc > biên hoặc < biên
 * với N nào đó chỉ cần cho nó di chuyển âm nextPos là được"). Bản đồ thiên hà TĨNH là 1 khối cầu
 * bán kính `mapRadius` quanh `centerPos` (xem `generateGalaxyMapNodePositions()`,
 * core/webgl/three-space.js) — nếu `pos` vượt biên (khoảng cách tới `centerPos` > `mapRadius`),
 * PHẢN CHIẾU qua tâm (lấy toạ độ ÂM tương đối, `centerPos - (pos - centerPos)`) thay vì mở rộng
 * bản đồ — do bản đồ đã phân bố ĐỀU quanh tâm nên phía đối xứng luôn có dữ liệu hợp lệ tương
 * đương, an toàn tuyệt đối để "gói gọn" camera lại trong vùng đã dựng sẵn.
 * @param {THREE.Vector3} pos @param {THREE.Vector3} centerPos @param {number} mapRadius
 * @returns {THREE.Vector3}
 */
function mirrorPositionIfOutOfBounds(pos, centerPos, mapRadius) {
    const offset = pos.clone().sub(centerPos);
    if (offset.length() <= mapRadius) return pos.clone();
    return centerPos.clone().sub(offset);
}

// (applySpaceRoll() ĐÃ BỎ, 21/07/2026, phản hồi Giang — "roll... đang bị hiểu nhầm thành rotate
// 2D chứ không phải bẻ hướng di chuyển của camera". Hàm này chỉ xoay trục lên/phải quanh CHÍNH
// hướng nhìn (cosmetic tilt/bank, KHÔNG đổi hướng ĐI) — sai bản chất yêu cầu. Thay bằng
// `steerSpaceForward3D()` (core/webgl/three-space.js, ĐỔI TÊN lượt 6 — thêm pitch, xem đầu file
// đó) — xoay THẲNG vector forward, đổi HƯỚNG ĐI thật sự, xem event/workflow/visualizer-render.js.)

/**
 * Điểm điều khiển (control point) cho quỹ đạo CONG (Quadratic Bezier) — MỚI (21/07/2026, phản hồi
 * Giang mục 4 — "cung di chuyển uốn lượn cong trên hoặc dưới, trái phải hay phải trái thay vì
 * tuyến tính thẳng"). LƯU Ý: bản LUT sin cong trước đó đã bị chính Giang yêu cầu bỏ hẳn ("bỏ LUT +
 * bar hoàn toàn") — lần này KHÔNG dùng lại LUT, chỉ 1 điểm lệch NGẪU NHIÊN kết hợp CẢ `right` LẪN
 * `up` cùng lúc (cong được mọi hướng: lên/xuống/trái/phải/chéo) tại trung điểm quãng đường, sinh 1
 * LẦN lúc BẮT ĐẦU leg (pha TRAVEL), giữ nguyên suốt leg đó.
 * @param {THREE.Vector3} fromPos @param {THREE.Vector3} toPos @param {THREE.Vector3} right
 * @param {THREE.Vector3} up @param {number} curveStrength - biên độ lệch tối đa (đơn vị 3D)
 * @returns {THREE.Vector3}
 */
function computeSpaceLegControlPoint(fromPos, toPos, right, up, curveStrength) {
    const mid = fromPos.clone().lerp(toPos, 0.5);
    const lateral = (Math.random() - 0.5) * 2;
    const vertical = (Math.random() - 0.5) * 2;
    return mid.addScaledVector(right, lateral * curveStrength).addScaledVector(up, vertical * curveStrength);
}

/**
 * Nội suy vị trí camera dọc theo 1 "leg" (pha TRAVEL) — ĐỔI (21/07/2026, phản hồi Giang mục 4) từ
 * lerp THẲNG sang Quadratic Bezier (`fromPos`/`controlPoint`/`toPos`) — quỹ đạo CONG thay vì
 * đường thẳng tắp, `controlPoint` sinh ngẫu nhiên lúc bắt đầu leg (xem
 * `computeSpaceLegControlPoint()`). `progress` vẫn easing smoothstep như cũ (chậm lúc đầu/cuối,
 * nhanh giữa chừng) — CHỈ đổi ĐƯỜNG ĐI, không đổi nhịp độ tăng tốc.
 * @param {THREE.Vector3} fromPos @param {THREE.Vector3} controlPoint @param {THREE.Vector3} toPos
 * @param {number} progress - 0..1 (ngoài khoảng tự kẹp)
 * @returns {THREE.Vector3} */
function computeSpaceLegPosition(fromPos, controlPoint, toPos, progress) {
    const clamped = Math.max(0, Math.min(1, progress));
    const t = clamped * clamped * (3 - 2 * clamped); // smoothstep — chậm lúc đầu/cuối, nhanh giữa chừng
    const invT = 1 - t;
    return fromPos.clone().multiplyScalar(invT * invT)
        .addScaledVector(controlPoint, 2 * invT * t)
        .addScaledVector(toPos, t * t);
}

/**
 * Góc lệch (độ, 0-180) giữa 2 hướng nhìn — MỚI (21/07/2026, phản hồi Giang — thời lượng pha
 * ROTATE phải tỉ lệ theo góc quay, xem `computeSpaceRotateDuration()`).
 * @param {THREE.Vector3} fromForward @param {THREE.Vector3} toForward @returns {number}
 */
function computeAngleBetweenForwards(fromForward, toForward) {
    const dot = THREE.MathUtils.clamp(fromForward.dot(toForward), -1, 1);
    return THREE.MathUtils.radToDeg(Math.acos(dot));
}

/**
 * Thời lượng (giây) cho pha XOAY HƯỚNG (ROTATE) — MỚI (21/07/2026, phản hồi Giang — "xoay hướng
 * này phải được làm mềm... dù quay 1-30 độ hay 1-180 độ cảm giác mượt vẫn là như nhau" — tức
 * KHÔNG tuyến tính, chỉ minh hoạ bằng ví dụ, không áp cứng số). Power-law: góc càng lớn thời
 * lượng càng dài, mũ < 1 khiến góc nhỏ đã tăng nhanh rồi thoải dần về `maxDuration` lúc góc gần
 * 180° (đường lõm, không tuyến tính).
 *
 * THÊM (21/07/2026, lượt 9, phản hồi Giang — "tốc độ xoay camera từ hướng này sang hướng khác
 * cũng cần phải phụ thuộc vào thông số nhạc") — `musicSpeedFactor` (Workflow tự tính từ BPM/energy,
 * CÙNG công thức tinh thần với tốc độ TRAVEL, xem `_tryCommitRotatePhase()`,
 * event/workflow/visualizer-render.js) CHIA vào thời lượng gốc (theo góc) — nhạc nhanh/năng lượng
 * cao (factor > 1) rút ngắn thời lượng (xoay NHANH hơn), nhạc chậm/yên tĩnh (factor < 1) kéo dài
 * ra (xoay CHẬM hơn) — KHÔNG thay thế yếu tố góc, chỉ điều biến thêm lên trên.
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
 * xoay dự phòng khi 2 vector gần như ngược hướng nhau — KHÔNG suy biến như nlerp thô ở góc này,
 * cần thiết vì pitch KHÔNG giới hạn biên độ, xem `steerSpaceForward3D()`). Camera KHÔNG đổi VỊ TRÍ
 * trong pha này (Workflow tự khoá `spCamera.position`, xem
 * `event/workflow/visualizer-render.js::_advanceSpaceRotate()`), chỉ hướng NHÌN đổi dần.
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
 * (xem `computeSpaceForwardBasis()`, core/webgl/three-space.js) — THAY hẳn
 * `Object3D.lookAt()` (Three.js), nguồn gốc THẬT SỰ của hiện tượng "hard cut" Giang báo (mục 1,
 * phản hồi 21/07/2026): `lookAt()` tự tính lại right/up từ forward + world-up MỖI LẦN gọi, dùng
 * ĐÚNG công thức `cross()` như `computeSpaceForwardBasis()` nhưng KHÔNG có nhánh dự phòng khi
 * forward gần song song world-up (~camera nhìn gần thẳng đứng) — vector right suy biến gần 0,
 * hướng "lên" của camera random hoá đột ngột, nhìn như camera bị LẬT/XOAY ROLL trong 1 khung hình
 * (đúng nghĩa đen "hard cut"). Dùng LUÔN basis đã tính ổn định (Workflow tính 1 lần/frame qua
 * `computeSpaceForwardBasis()` rồi truyền vào đây) -> KHÔNG BAO GIỜ suy biến -> roll LUÔN khoá ổn
 * định (đúng yêu cầu "lock roll camera", mục 2).
 * @param {THREE.Camera} camera @param {THREE.Vector3} forward @param {THREE.Vector3} right @param {THREE.Vector3} up */
function applyStableSpaceOrientation(camera, forward, right, up) {
    const m = new THREE.Matrix4().makeBasis(right, up, forward.clone().negate());
    camera.quaternion.setFromRotationMatrix(m);
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

// (manageGalaxyChain() ĐÃ BỎ, 21/07/2026 lượt 9, phản hồi Giang — "thay vì vừa chuyển vừa tạo".
// Hàm này TỪNG quản lý dispose/spawn thiên hà theo 1 "cửa sổ nhìn xa" trượt theo camera (mô hình
// streaming) — KHÔNG còn cần thiết vì bản đồ giờ TĨNH, dựng sẵn 1 lần rồi giữ nguyên (chỉ tái tạo
// TOÀN BỘ theo điều kiện năng lượng+trạng thái đứng yên, xem
// event/workflow/visualizer-render.js::_ensureGalaxyMap()), không còn khái niệm "phía trước"/
// "phía sau" cần dispose/spawn liên tục theo từng frame nữa.)

// (hasSpaceViewArrived() ĐÃ BỎ, 21/07/2026 — mô hình waypoint mới không cần arrival-gate góc:
// mỗi leg tự có `spLegDuration` riêng, hướng leg KẾ TIẾP chỉ áp dụng khi leg HIỆN TẠI đã đến đích
// đúng nghĩa đen (progress>=1, xem Workflow), không có khái niệm "lerp dở dang" nữa.)

/** Render scene Galaxy — bọc `renderer.render()` thành 1 hàm Core cho nhất quán với các bước
 * khác (thay vì Workflow gọi thẳng API renderer — vẫn hợp lệ, nhưng để đúng tinh thần "Workflow
 * gọi RIÊNG LẺ từng hàm Core" của plan B2/B8).
 * @param {THREE.WebGLRenderer} renderer @param {THREE.Scene} scene @param {THREE.Camera} camera */
function renderSpaceScene(renderer, scene, camera) {
    renderer.render(scene, camera);
}
