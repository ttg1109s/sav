/**
 * core/webgl/three-common.js — Core thuần dùng chung cho 2 scene WebGL (Vortex, Connector): dọn tài
 * nguyên GPU và co giãn theo khung nhìn.
 *
 * [MỚI — 28/09/2026, Phase 3 dọn visualizer] Sửa 2 lỗi vòng đời:
 *   - Resize cửa sổ trước đây gọi `initThreeJS()` -> dựng lại TOÀN BỘ scene Vortex (geometry/material mới),
 *     scene cũ chỉ bị `remove()` chứ không `dispose()` -> bộ nhớ GPU tích tụ mỗi lần xoay máy/đổi kích thước.
 *     Nay resize CHỈ đổi camera + renderer (+ composer của Connector).
 *   - Connector dựng lại (kéo slider số neuron/node) bỏ lại scene cũ, texture, render target của bloom và
 *     OrbitControls cũ (listener chồng dần lên canvas). Nay Workflow dọn hết trước khi dựng lại.
 * Mỗi hàm 1 việc, chỉ nhận tham số, không đọc appState, không gọi core khác. Gọi API three.js/gsap trực
 * tiếp — cùng quy ước các builder WebGL hiện có (Giang chốt 28/09/2026: builder three.js được ở core nếu
 * không vi phạm rule core). Điều phối ở event/workflow/visualizer/vortex.js + connector.js.
 */

/** Giải phóng geometry + material (kể cả mảng material) của MỌI object trong cây `root`. Geometry dùng
 * chung giữa nhiều mesh bị dispose() nhiều lần — three.js coi là vô hại. */
function disposeThreeObjectTree(root) {
    root.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        [].concat(obj.material || []).forEach((material) => material.dispose());
    });
}

/** Giải phóng 2 render target của EffectComposer + tài nguyên riêng của từng pass (UnrealBloomPass có
 * render target/material riêng; pass nào không có dispose() thì bỏ qua). */
function disposeThreeComposer(composer) {
    composer.renderTarget1.dispose();
    composer.renderTarget2.dispose();
    composer.passes.forEach((pass) => {
        if (typeof pass.dispose !== 'function') return;
        pass.dispose();
    });
}

/** Gỡ listener OrbitControls đã gắn lên canvas. */
function disposeOrbitControls(controls) {
    controls.dispose();
}

/** Giải phóng 1 texture. */
function disposeThreeTexture(texture) {
    texture.dispose();
}

/** Dừng mọi tween GSAP đang chạy trên camera + điểm nhìn (cinematic shift của circuit). */
function stopThreeCameraTweens(camera, controls) {
    gsap.killTweensOf(camera.position);
    gsap.killTweensOf(controls.target);
}

/** Đổi tỉ lệ khung hình camera phối cảnh. */
function resizeThreeCamera(camera, aspect) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
}

/** Đổi kích thước vùng vẽ của renderer (px CSS — pixelRatio đã đặt lúc tạo renderer). */
function resizeThreeRenderer(renderer, cssWidth, cssHeight) {
    renderer.setSize(cssWidth, cssHeight);
}

/** Đổi kích thước EffectComposer — tự setSize() mọi pass bên trong (bloom tính lại render target). */
function resizeThreeComposer(composer, cssWidth, cssHeight) {
    composer.setSize(cssWidth, cssHeight);
}

/** MỚI (28/09/2026, Phase 5) — Renderer WebGL DÙNG CHUNG Vortex + Connector trên #webgl-canvas (nền trong suốt để lộ
 * Visual Background). Trước đây initThreeJS()/initThreeJSConnector() mỗi hàm tự tạo nếu chưa có. `pixelRatio` do
 * group tạo trước quyết định (giữ nguyên: Vortex = devicePixelRatio, Connector = tối đa 2). */
function createSharedWebglRenderer(canvasEl, pixelRatio) {
    const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: true });
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearAlpha(0); // tường minh — clear về trong suốt
    return renderer;
}

