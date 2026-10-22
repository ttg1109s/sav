/**
 * core/visualizer/groups/vortex/common.js — phần dùng chung của 3 style group "vortex" (`rings.js`, `bars.js`,
 * `wave.js`): tốc độ bay `computeVortexWarpSpeed()`, camera `aimVortexCamera()`, dời gốc/cuộn z
 * (`shiftVortexSceneZ()`, `wrapVortexObjectZ()`). `tWarpSpeed` là biến module ngoài STATE
 * (core/webgl/three-vortex.js); object Three.js nhận qua tham số. Điều phối: event/workflow/visualizer/vortex.js.
 *
 * NẠP TRƯỚC: `rings.js`, `bars.js`, `wave.js`.
 */

/** Tốc độ bay mượt theo nhạc (ghi biến module `tWarpSpeed`, không thuộc STATE). @returns {number} tWarpSpeed mới. */
function computeVortexWarpSpeed(warpSpeedBase, warpSpeedEnergyMult, smoothedEnergy) {
    const targetWarpSpeed = warpSpeedBase + smoothedEnergy * warpSpeedEnergyMult;
    tWarpSpeed += (targetWarpSpeed - tWarpSpeed) * 0.025;
    return tWarpSpeed;
}

// =================================== Camera (dùng chung) ===================================

/** Camera luôn ở tâm ống (độ lệch tại camera = 0, getVortexCenterAt()), nhìn tới `look` (computeVortexLookTarget()).
 * Mutate trực tiếp `tCamera`. */
function aimVortexCamera(tCamera, camZ, look) {
    tCamera.position.set(0, 0, camZ);
    tCamera.lookAt(look.x, look.y, look.z);
}

// ================================ Dời gốc toạ độ (dùng chung) ================================

/** Dời TOÀN BỘ object ống theo +shift trên trục z (MỚI 25/09/2026 — chặn z tịnh tiến vô hạn). Dời cả
 * object của style đang ẩn để lúc đổi style chúng vẫn nằm đúng quanh camera. Tâm ống chỉ phụ thuộc
 * camZ - z (getVortexCenterAt()) nên dời gốc không đổi hình. Mutate trực tiếp mesh Three.js nhận qua
 * tham số; mảng z của bars trả về BẢN MỚI, Workflow tự ghi appState. @returns {number[]} tBarRingZs mới. */
function shiftVortexSceneZ(shift, rings, waves, barRingZs) {
    rings.forEach((ring) => { ring.position.z += shift; });
    waves.forEach((wave) => { wave.position.z += shift; });
    return barRingZs.map((z) => z + shift);
}

/** z mới của 1 object sau khi tiến `step`, cuộn về phía trước đủ SỐ LẦN tunnelDepth nếu đã lọt ra
 * sau camera (SỬA 25/09/2026 — bản cũ chỉ trừ 1 lần/frame: object của style đang ẩn không được tiến
 * nên bị bỏ lại rất xa, đổi style xong phải chờ hàng trăm frame mới cuộn về -> ống trống). THUẦN. */
function wrapVortexObjectZ(z, step, tCurrentWarpZ, tunnelDepth) {
    const next = z + step;
    const over = next - (tCurrentWarpZ + 200);
    return over > 0 ? next - Math.ceil(over / tunnelDepth) * tunnelDepth : next;
}
