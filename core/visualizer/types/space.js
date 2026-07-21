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
 *
 * VIẾT LẠI LẦN 2 (21/07/2026, phản hồi Giang) — bỏ hẳn `updateSpaceCamera()`/
 * `updateSpaceViewDirLerp()`/`hasSpaceViewArrived()` (mô hình "hướng nhìn lerp liên tục + reroll
 * theo ngưỡng năng lượng" của lượt 1) — thay bằng mô hình "waypoint nối tiếp" (mục 3): camera
 * luôn di chuyển thẳng từ 1 điểm tới điểm kế tiếp (`spLegStartPos` -> `spNextPos`), Workflow tự
 * quản lý vòng đời từng leg — file này chỉ còn giữ các hàm TÍNH TOÁN thuần cho từng bước
 * (nội suy vị trí, dựng hướng camera ỔN ĐỊNH không lật roll, quản lý chuỗi thiên hà, bụi nền,
 * render).
 *
 * VIẾT LẠI LẦN 3 (21/07/2026, phản hồi Giang lượt 6) — tách HẲN "di chuyển" và "xoay hướng" thành
 * 2 PHA riêng biệt, không chồng lên nhau (`spPhase`: 'travel' | 'rotating', xem
 * `event/workflow/visualizer-render.js`): pha TRAVEL camera di chuyển A->B theo hướng CỐ ĐỊNH
 * (không đổi hướng nhìn); đến B, xác nhận đủ mật độ thiên hà hướng kế tiếp mới chuyển sang pha
 * ROTATE — vị trí camera KHOÁ NGUYÊN tại B, chỉ hướng NHÌN đổi dần X->Y. Rotate xong mới bắt đầu
 * TRAVEL leg kế tiếp. THÊM MỚI: `findClusterTargetAhead()` (waypoint chọn NGẪU NHIÊN 1 cụm thiên
 * hà, ƯU TIÊN cụm đủ xa, thay vì công thức mù), `computeSpaceLegControlPoint()` + đổi `computeSpaceLegPosition()` sang
 * Quadratic Bezier (quỹ đạo CONG thay vì thẳng tắp), `computeSpaceRotateForward()`/
 * `computeAngleBetweenForwards()`/`computeSpaceRotateDuration()` (nội suy + tính thời lượng pha
 * ROTATE, mượt theo góc — góc nhỏ xoay nhanh, góc lớn xoay chậm hơn, KHÔNG tuyến tính).
 */

/**
 * Đếm số thiên hà HIỆN CÓ nằm trong 1 "nón" hẹp phía trước theo hướng `forward` (trong phạm vi
 * `checkDistance` dọc trục, `lateralRadius` ngang trục) — MỚI (21/07/2026, phản hồi Giang —
 * "roll về hướng không có thiên hà nào, màn đen xì... cần tiên đoán trước hướng, kiểm tra tỉ lệ
 * mật độ thiên hà ở vùng đó rồi mới quyết định thêm hay không"). Hàm THUẦN, CHỈ đếm/tính toán,
 * KHÔNG tự spawn gì — Workflow tự đọc kết quả trả về rồi quyết định có cần bơm thêm thiên hà theo
 * hướng đó hay không TRƯỚC khi cam kết chuyển sang hướng này (xem
 * `event/workflow/visualizer-render.js::_stageNextLeg()`/`_advancePreSpawn()`).
 * @param {GalaxyCluster[]} clusters @param {THREE.Vector3} camPos @param {THREE.Vector3} forward
 * @param {number} checkDistance @param {number} lateralRadius
 * @returns {number} số thiên hà đang nằm trong vùng kiểm tra
 */
function assessGalaxyDensityAhead(clusters, camPos, forward, checkDistance, lateralRadius) {
    let count = 0;
    for (let i = 0; i < clusters.length; i++) {
        const offset = clusters[i].position.clone().sub(camPos);
        const along = offset.dot(forward);
        if (along <= 0 || along > checkDistance) continue;
        const lateralSq = Math.max(0, offset.lengthSq() - along * along);
        if (lateralSq < lateralRadius * lateralRadius) count++;
    }
    return count;
}

/**
 * Tìm 1 cụm thiên hà làm MỤC TIÊU camera bay tới/xuyên qua — VIẾT LẠI (21/07/2026, phản hồi Giang
 * lượt 7, mục 1 — "chọn một điểm ngẫu nhiên rồi bắt di chuyển đến đó... toạ độ camera phải di
 * chuyển trùng với vị trí của cụm hoặc thiên hà nào đó") — THAY HẲN chọn "gần nhất" (khiến mỗi
 * chặng bay quá NGẮN — do các nút sinh dày đặc, cụm gần nhất trong nón gần như LUÔN kề sát ngay
 * bên, camera liên tục nhảy sang hàng xóm sát vách thay vì bay hẳn 1 hành trình rõ rệt tới 1 thiên
 * hà cụ thể). Giờ chọn NGẪU NHIÊN trong số các cụm nằm trong 1 "nón" phía trước theo hướng
 * `forward`, ƯU TIÊN cụm đủ XA (`dist >= minDist`) — không đủ cụm xa mới nới lỏng chấp nhận CẢ cụm
 * gần hơn. Khoảng cách dùng để lọc là khoảng cách 3D THẬT (`offset.length()`, giữa 2 TOẠ ĐỘ đầy đủ
 * x/y/z), KHÔNG PHẢI khoảng cách chiếu phẳng lên 1 mặt phẳng nào — camera CHẮC CHẮN di chuyển
 * trùng khớp toạ độ với cụm được chọn (Workflow set `nextPos` = TOẠ ĐỘ THẬT trả về ở đây, camera
 * bay đúng theo Bezier tới ĐÚNG điểm này, xem `_computeTravelWaypoint()`,
 * event/workflow/visualizer-render.js).
 * @param {GalaxyCluster[]} clusters @param {THREE.Vector3} camPos @param {THREE.Vector3} forward
 * @param {number} maxAngleCos - cos(góc nón tối đa) — 1 = thẳng chính giữa, càng nhỏ nón càng rộng
 * @param {number} minDist - khoảng cách 3D THẬT tối thiểu ƯU TIÊN (đảm bảo hành trình đủ dài)
 * @param {number} maxDist - khoảng cách 3D THẬT tối đa còn tính là "trong tầm"
 * @returns {THREE.Vector3|null} toạ độ THẬT của cụm được chọn, null nếu không có cụm nào khớp
 */
function findClusterTargetAhead(clusters, camPos, forward, maxAngleCos, minDist, maxDist) {
    const farCandidates = [];
    const anyCandidates = [];
    for (let i = 0; i < clusters.length; i++) {
        const offset = clusters[i].position.clone().sub(camPos);
        const dist = offset.length(); // khoảng cách 3D THẬT giữa 2 toạ độ đầy đủ x/y/z, KHÔNG phải chiếu phẳng
        if (dist <= 0 || dist > maxDist) continue;
        const cosAngle = offset.dot(forward) / dist;
        if (cosAngle < maxAngleCos) continue;
        anyCandidates.push(clusters[i].position);
        if (dist >= minDist) farCandidates.push(clusters[i].position);
    }
    const pool = farCandidates.length > 0 ? farCandidates : anyCandidates;
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)].clone();
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
 * @param {number} angleDeg @param {number} minDuration @param {number} maxDuration @param {number} power
 * @returns {number} giây
 */
function computeSpaceRotateDuration(angleDeg, minDuration, maxDuration, power) {
    const clampedAngle = Math.max(0, Math.min(180, angleDeg));
    const ratio = Math.pow(clampedAngle / 180, power);
    return minDuration + (maxDuration - minDuration) * ratio;
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

/**
 * Phân tích trạng thái chuỗi thiên hà — CHỈ TÍNH TOÁN/QUYẾT ĐỊNH, KHÔNG tự dispose/spawn gì cả
 * (Workflow tự đọc kết quả trả về rồi tự gọi `cluster.dispose(scene)`/tự spawn cụm mới — Rule 2
 * "chỉ nhận tham số", Rule 3 "không tự gọi hàm khác"). Guard/lookup thuần, không rẽ nhánh giữa 2
 * tiến trình nghiệp vụ khác nhau — chỉ 1 kịch bản duy nhất "đánh giá chuỗi hiện tại".
 *
 * FIX (21/07/2026, phản hồi Giang mục 2d — "quay hướng khác thì không sinh thiên hà, nền tối"):
 * bản trước dùng TOẠ ĐỘ Z THẾ GIỚI thô (`camZ`) để quyết định "phía trước"/"phía sau" — chỉ đúng
 * khi camera luôn bay theo -Z. VIẾT LẠI: "phía trước"/"phía sau" giờ là CHIẾU (dot product) vị trí
 * thiên hà lên trục `forward` (hướng leg camera ĐANG BAY, `spLegForward`) kể từ `camPos` — đúng với
 * MỌI hướng bay, không riêng -Z. Dispose THÊM 1 tiêu chí mới: thiên hà lệch quá xa NGANG khỏi trục
 * bay hiện tại (`disposeLateralDistance`) cũng bị dọn — cần thiết vì sau khi camera quay hướng
 * khác nhiều, thiên hà cũ (thuộc hướng bay TRƯỚC ĐÓ) có thể không còn tính là "phía sau" theo
 * nghĩa dot-product (nằm lệch sang 1 bên) nhưng vẫn nên dọn để tránh chuỗi phình to vô hạn.
 * @param {GalaxyCluster[]} clusters @param {THREE.Vector3} camPos @param {THREE.Vector3} forward
 * @param {number} disposeDistance - dispose khi đã trôi lại phía sau (dọc trục forward) quá khoảng này
 * @param {number} disposeLateralDistance - dispose khi lệch NGANG khỏi trục forward quá khoảng này
 * @param {number} aheadWindow - tầm nhìn xa cần đảm bảo luôn có thiên hà phủ tới (CỐ ĐỊNH 1500, plan B6)
 * @param {number} aheadMargin - biên tối thiểu phía trước camera để tính "đã ở phía trước"
 * @returns {{toDisposeIndices: number[], furthestAheadDist: number, needsMoreSpawns: boolean, nearestAheadIndex: (number|null)}}
 */
function manageGalaxyChain(clusters, camPos, forward, disposeDistance, disposeLateralDistance, aheadWindow, aheadMargin) {
    const alongDists = new Array(clusters.length);
    const toDisposeIndices = [];

    for (let i = clusters.length - 1; i >= 0; i--) {
        const offset = clusters[i].position.clone().sub(camPos);
        const along = offset.dot(forward);
        alongDists[i] = along;
        const lateralSq = Math.max(0, offset.lengthSq() - along * along);
        if (along < -disposeDistance || lateralSq > disposeLateralDistance * disposeLateralDistance) {
            toDisposeIndices.push(i);
        }
    }

    let furthestAheadDist = -Infinity;
    let nearestAheadIndex = null;
    let nearestAheadDist = Infinity;
    for (let i = 0; i < clusters.length; i++) {
        if (toDisposeIndices.indexOf(i) !== -1) continue;
        const d = alongDists[i];
        if (d > furthestAheadDist) furthestAheadDist = d;
        if (d > aheadMargin && d < nearestAheadDist) { nearestAheadDist = d; nearestAheadIndex = clusters[i].index; }
    }
    if (furthestAheadDist === -Infinity) furthestAheadDist = 0; // không còn thiên hà nào phía trước (mảng rỗng hoặc vừa dispose hết)

    const needsMoreSpawns = furthestAheadDist < aheadWindow;
    return { toDisposeIndices, furthestAheadDist, needsMoreSpawns, nearestAheadIndex };
}

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
