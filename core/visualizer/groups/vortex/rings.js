/**
 * core/visualizer/groups/vortex/rings.js — [LÀM PHẲNG, 05/09/2026, yêu cầu Giang] Style 'rings'
 * (vòng ánh sáng) tách riêng khỏi `core/visualizer/types/vortex.js` cũ (trước đây gộp chung với
 * 'bars'/'wave'). Nội dung hàm GIỮ NGUYÊN 100%.
 *
 * THUẦN, không appState/getActiveEffectConfig/getComputedColor/getVortexCenterAt (rà soát Rule 3)
 * — Workflow (`_tickVortexRender()`, event/workflow/visualizer-render.js) tự vòng lặp gọi RIÊNG
 * LẺ `stepVortexRingZ()` rồi `getVortexCenterAt()` (core/webgl/three-vortex.js) rồi
 * `getComputedColor()` (core/audio-analysis.js) rồi `finishVortexRingFrame()` cho TỪNG ring.
 * `ring` là object Three.js NHẬN QUA THAM SỐ — mutate trực tiếp thuộc tính KHÔNG vi phạm Rule 2.
 *
 * NẠP SAU: core/visualizer/groups/vortex/common.js.
 */

// ==================================== STYLE: rings ====================================

/** Tiến vị trí Z của 1 ring (sliding window, giống hệt bản gốc) — mutate trực tiếp `ring` (Three.js
 * mesh nhận qua tham số). */
function stepVortexRingZ(ring, tWarpSpeed, tCurrentWarpZ, tunnelDepth) {
    ring.position.z += tWarpSpeed * 0.8;
    if (ring.position.z > tCurrentWarpZ + 200) ring.position.z -= tunnelDepth;
}

/** Hoàn tất khung hình 1 ring — nhận `center` (đã `getVortexCenterAt(ring.position.z)` sẵn, GỌI SAU
 * `stepVortexRingZ()`) + `colorToApply` (đã resolve theo `cfg.mode` sẵn) làm tham số. */
function finishVortexRingFrame(ring, center, val, smoothedEnergy, colorToApply) {
    ring.position.x = center.x;
    ring.position.y = center.y;
    const s = 1 + (val / 255) * 0.5 * smoothedEnergy;
    ring.scale.set(s, s, s);
    ring.material.color.setStyle(colorToApply);
}
