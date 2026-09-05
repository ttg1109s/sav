/**
 * core/visualizer/groups/vortex/common.js — Registry style con của group "vortex" (đăng ký theo
 * yêu cầu Giang, 05/09/2026 — tách "groups", làm phẳng file effect thành từng style riêng). Trước
 * đây `core/visualizer/types/vortex.js` gộp 3 style 'rings'/'bars'/'wave' — giờ mỗi style 1 file
 * riêng (`rings.js`/`bars.js`/`wave.js`, cùng thư mục).
 *
 * `computeVortexWarpSpeed()` + 2 hàm camera (`dampVortexCameraPosition()`/
 * `applyVortexCameraClamp()`) là cơ chế CHUNG (Rule 2/3 — biến module-level ngoài STATE / chỉ nhận
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

/** Camera bám theo tâm ống (damping nhẹ) — nhận `camTargetPos` (đã `getVortexCenterAt(tCurrentWarpZ)`
 * sẵn) làm tham số. Mutate trực tiếp `tCamera` (Three.js camera nhận qua tham số). */
function dampVortexCameraPosition(tCamera, camTargetPos, tCurrentWarpZ) {
    tCamera.position.x += (camTargetPos.x - tCamera.position.x) * 0.045;
    tCamera.position.y += (camTargetPos.y - tCamera.position.y) * 0.045;
    tCamera.position.z = tCurrentWarpZ;
}

/** Áp kết quả kẹp cứng (đã `clampVortexCameraOffset()` sẵn, GỌI SAU `dampVortexCameraPosition()`)
 * lên `tCamera`. */
function applyVortexCameraClamp(tCamera, clampedPos) {
    tCamera.position.x = clampedPos.x;
    tCamera.position.y = clampedPos.y;
}
