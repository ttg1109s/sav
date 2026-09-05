/**
 * core/visualizer/groups/vortex/bars.js — [LÀM PHẲNG, 05/09/2026, yêu cầu Giang] Style 'bars'
 * (xoắn chuỗi/lò xo DNA, InstancedMesh) tách riêng khỏi `core/visualizer/types/vortex.js` cũ
 * (trước đây gộp chung với 'rings'/'wave'). Nội dung hàm GIỮ NGUYÊN 100%.
 *
 * `stepVortexBarRingZ()` vẫn `appState.mutate('tBarRingZs', ...)` như bản gốc (Rule 2 chỉ cấm
 * ĐỌC). Workflow (`_tickVortexRender()`, event/workflow/visualizer-render.js) tự vòng lặp gọi
 * RIÊNG LẺ hàm này rồi `getVortexCenterAt()` (core/webgl/three-vortex.js) rồi
 * `getComputedColor()` (core/audio-analysis.js) rồi `computeVortexBarsRingFrame()` cho TỪNG vòng
 * bar. `dummy`/`tBarsMesh` là object Three.js NHẬN QUA THAM SỐ.
 *
 * NẠP SAU: core/visualizer/groups/vortex/common.js.
 */

// ===================================== STYLE: bars =====================================

/** Tiến vị trí Z của 1 vòng bar — vẫn `appState.mutate('tBarRingZs', ...)` như bản gốc (Rule 2 chỉ
 * cấm ĐỌC). Không cần đọc lại mảng — mutate() tự cấp `arr` cho callback (kênh GHI). */
function stepVortexBarRingZ(r, tWarpSpeed, tCurrentWarpZ, tunnelDepth) {
    appState.mutate('tBarRingZs', (arr) => {
        arr[r] += tWarpSpeed * 0.8;
        if (arr[r] > tCurrentWarpZ + 200) arr[r] -= tunnelDepth;
    }, { skipCheck: true });
}

/** Cập nhật ma trận + màu TOÀN BỘ bar trong 1 vòng — nhận `center`/`threeColor` đã resolve sẵn.
 * `dummy` (THREE.Object3D scratch) + `tBarsMesh` (THREE.InstancedMesh) nhận qua tham số. */
function computeVortexBarsRingFrame(dummy, tBarsMesh, r, barsPerRing, z, center, val, smoothedEnergy, twistPerRing, globalTwist, threeColor) {
    const barScaleY = 1 + (val / 255) * 8 * smoothedEnergy;
    const ringTwist = r * twistPerRing + globalTwist;
    for (let b = 0; b < barsPerRing; b++) {
        const ang = (b / barsPerRing) * Math.PI * 2 + ringTwist;
        dummy.position.set(center.x + Math.cos(ang) * 350, center.y + Math.sin(ang) * 350, z);
        dummy.rotation.set(0, 0, ang - Math.PI / 2);
        dummy.scale.set(1, barScaleY, 1);
        dummy.updateMatrix();
        tBarsMesh.setMatrixAt(r * barsPerRing + b, dummy.matrix);
        tBarsMesh.setColorAt(r * barsPerRing + b, threeColor);
    }
}
