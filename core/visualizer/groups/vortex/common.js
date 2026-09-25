/**
 * core/visualizer/groups/vortex/common.js — Registry style con của group "vortex" (đăng ký theo
 * yêu cầu Giang, 05/09/2026 — tách "groups", làm phẳng file effect thành từng style riêng). Trước
 * đây `core/visualizer/types/vortex.js` gộp 3 style 'rings'/'bars'/'wave' — giờ mỗi style 1 file
 * riêng (`rings.js`/`bars.js`/`wave.js`, cùng thư mục).
 *
 * `computeVortexWarpSpeed()` + camera (`placeVortexCamera()`) + dời gốc/cuộn z
 * (`shiftVortexSceneZ()`/`wrapVortexObjectZ()`, 25/09/2026) là cơ chế CHUNG (Rule 2/3 — biến module-level ngoài STATE / chỉ nhận
 * tham số đã resolve sẵn) dùng bởi CẢ 3 style — đặt ở đây để 3 file đó không phải định nghĩa
 * trùng lặp. Workflow (`_tickVortexRender()`, event/workflow/visualizer-render.js) tự đọc TOÀN BỘ
 * appState/cfg TRƯỚC, tự chọn ĐÚNG style (Rule 1), rồi tự vòng lặp gọi RIÊNG LẺ từng hàm "1 bước/1
 * item" — mỗi hàm chỉ nhận Center (đã `getVortexCenterAt()` sẵn)/Color (đã `getComputedColor()`
 * sẵn) làm tham số, KHÔNG tự gọi 2 hàm đó nữa (Rule 3, core/webgl/three-vortex.js /
 * core/audio-analysis.js). `ring`/`wave`/`tBarsMesh`/`tCamera`/`dummy` là object Three.js NHẬN QUA
 * THAM SỐ — mutate trực tiếp thuộc tính của chúng KHÔNG vi phạm Rule 2 (rule chỉ cấm
 * `appState.get()`).
 *
 * NẠP: TRƯỚC `rings.js`/`bars.js`/`wave.js`.
 */

/** Danh sách style con thuộc group "vortex" — tên file khớp CHÍNH XÁC tên trong mảng này
 * (`<tên>.js`). */
const VORTEX_GROUP_STYLE_KEYS = ['rings', 'bars', 'wave'];

/** Tốc độ bay mượt theo nhạc — `tWarpSpeed` là biến module-level PERSISTENT (khai báo ở
 * `core/webgl/three-vortex.js`, tự ghi chú "KHÔNG thuộc STATE") — đọc/ghi trực tiếp KHÔNG vi phạm
 * Rule 2. @returns {number} tWarpSpeed mới. */
function computeVortexWarpSpeed(warpSpeedBase, warpSpeedEnergyMult, smoothedEnergy) {
    const targetWarpSpeed = warpSpeedBase + smoothedEnergy * warpSpeedEnergyMult;
    tWarpSpeed += (targetWarpSpeed - tWarpSpeed) * 0.025;
    return tWarpSpeed;
}
// =================================== Camera (dùng chung) ===================================

/** Đặt camera ĐÚNG tâm ống tại z camera — THAY `dampVortexCameraPosition()` + `applyVortexCameraClamp()`
 * cũ (25/09/2026, Giang báo "va đập"): damping 0.045 không đuổi kịp tâm khi ống rẽ -> camera bị lưới
 * kẹp cứng VORTEX_CAMERA_SAFE_RADIUS chặn lại đột ngột -> khựng/giật. Hình ống giờ đã mượt sẵn
 * (computeNextVortexPath(), core/webgl/three-vortex.js) nên bám thẳng tâm, cảm giác rẽ đến từ lookAt
 * phía trước. `camPos` = getVortexCenterAt(camZ, ...) đã resolve sẵn. Mutate trực tiếp `tCamera`. */
function placeVortexCamera(tCamera, camPos, camZ) {
    tCamera.position.set(camPos.x, camPos.y, camZ);
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
