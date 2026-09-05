/**
 * core/visualizer/groups/vortex/wave.js — [LÀM PHẲNG, 05/09/2026, yêu cầu Giang] Style 'wave'
 * (nhiễu động sóng) tách riêng khỏi `core/visualizer/types/vortex.js` cũ (trước đây gộp chung với
 * 'rings'/'bars'). Nội dung hàm GIỮ NGUYÊN 100%.
 *
 * THUẦN, không appState/getActiveEffectConfig/getComputedColor/getVortexCenterAt (rà soát Rule 3)
 * — Workflow (`_tickVortexRender()`, event/workflow/visualizer-render.js) tự vòng lặp gọi RIÊNG
 * LẺ `stepVortexWaveZ()` rồi `getVortexCenterAt()` (core/webgl/three-vortex.js) rồi
 * `getComputedColor()` (core/audio-analysis.js) rồi `finishVortexWaveFrame()` cho TỪNG wave mesh.
 * `wave` là object Three.js NHẬN QUA THAM SỐ — mutate trực tiếp thuộc tính KHÔNG vi phạm Rule 2.
 *
 * NẠP SAU: core/visualizer/groups/vortex/common.js.
 */

// ===================================== STYLE: wave =====================================

/** Tiến vị trí Z của 1 wave mesh — mutate trực tiếp `wave` (Three.js mesh nhận qua tham số). */
function stepVortexWaveZ(wave, tWarpSpeed, tCurrentWarpZ, tunnelDepth) {
    wave.position.z += tWarpSpeed * 1.2;
    if (wave.position.z > tCurrentWarpZ + 200) wave.position.z -= tunnelDepth;
}

/** Hoàn tất khung hình 1 wave mesh — nhận `center`/`colorToApply` đã resolve sẵn (GỌI SAU
 * `stepVortexWaveZ()`). */
function finishVortexWaveFrame(wave, center, waveRotationBase, waveRotationEnergyMult, waveScaleBase, waveScaleEnergyMult, smoothedEnergy, colorToApply) {
    wave.position.x = center.x;
    wave.position.y = center.y;
    wave.rotation.z += waveRotationBase + smoothedEnergy * waveRotationEnergyMult;
    wave.scale.setScalar(waveScaleBase + smoothedEnergy * waveScaleEnergyMult);
    wave.material.color.setStyle(colorToApply);
}
