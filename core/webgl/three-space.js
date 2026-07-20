/**
 * core/webgl/three-space.js — Galaxy Journey engine, viết lại HOÀN TOÀN từ đầu (20/07/2026,
 * plan-space-galaxy.md Phần B) — bản trước đã bị xoá trắng (0 byte) theo yêu cầu Giang. KHÔNG
 * mang theo tư duy/công thức/con số từ bản Space cũ nào (Ken Burns sin/cos, Sun System, Vacuum
 * Void, cockpit frame) — trùng số với bản cũ (nếu có) là trùng hợp do chọn hợp lý cho bản MỚI.
 *
 * Tham khảo thiết kế/công thức hình học từ 1 file HTML demo độc lập Giang cung cấp (space.txt,
 * "Vũ Trụ Vô Tận" — KHÔNG dùng bloom/postprocessing, chỉ AdditiveBlending + texture sprite thuần),
 * viết lại toàn bộ theo kiến trúc SAV v12 (global script, không ES6 module — `class` KHÔNG liên
 * quan gì tới quy ước đó, chỉ cấm `import`/`export`).
 *
 * ============================== QUY TẮC BẮT BUỘC CỦA FILE NÀY ==============================
 * TẤT CẢ hàm/method dưới đây là Core THUẦN (`readme/core-function-conventions.md` Rule 1-4):
 *   - KHÔNG tự `appState.get()` (Rule 2) — mọi dữ liệu nhận qua tham số.
 *   - KHÔNG hàm/method nào gọi hàm/method KHÁC trong CHÍNH FILE NÀY (Rule 3, siết chặt hơn 1 bậc
 *     theo yêu cầu riêng của plan Phần B cho đúng engine Galaxy) — kể cả method cùng 1 class
 *     KHÔNG được gọi lẫn nhau (constructor KHÔNG tự gọi build(), build() KHÔNG tự gọi
 *     buildNebula()...). Gọi API thư viện ngoài (THREE.*, Math.*, `document.createElement`...)
 *     KHÔNG tính là "gọi hàm khác trong file này" — chỉ cấm gọi tên hàm/method TỰ VIẾT ở đây.
 *   - `event/workflow/visualizer-render.js` (`_tickSpace()`) đứng NGOÀI, tự gom
 *     `appState.get([...])` rồi gọi RIÊNG LẺ từng hàm/method dưới đây theo đúng thứ tự — bao gồm
 *     cả việc TỰ vòng lặp gọi 10 hàm `generate*Positions` (Workflow tự chọn đúng hàm qua bảng dữ
 *     liệu `GALAXY_GENERATORS`, KHÔNG có hàm Core nào ở đây tự chọn/tự gọi hộ).
 *
 * NẠP: SAU `core/webgl/three-vortex.js` (Space DÙNG CHUNG canvas/renderer với Vortex — KHÔNG tạo
 * `WebGLRenderer`/resize listener riêng, xem `initThreeSpace()`), TRƯỚC
 * `core/visualizer/types/space.js` (file đó chỉ chứa vài hàm nhỏ chạy MỖI FRAME, dùng ngược lại
 * KHÔNG ai trong 2 file gọi nhau).
 */

// ============================================================================================
// 1. HẰNG SỐ / DỮ LIỆU (không phải hàm — tham chiếu tự do, KHÔNG tính là "gọi hàm")
// ============================================================================================

/** Khoảng cách trục Z giữa 2 "nút" liên tiếp của sợi vũ trụ (mỗi nút sinh 2-3 thiên hà). */
const SPACE_CLUSTER_SPACING_Z = 200;

/** Định danh ngẫu nhiên chuẩn khoa học (giữ nguyên tinh thần bản demo, số liệu không kế thừa gì
 * đặc biệt — chỉ là 1 danh sách tên hợp lý cho bản MỚI). */
const SPACE_GALAXY_NAME_PREFIXES = ['Messier', 'Centaurus', 'Andromeda', 'Sagittarius', 'Perseus', 'Cassiopeia', 'Cygnus', 'Nebula', 'Kepler', 'Vortex', 'Surtur', 'Hyperion', 'Aether', 'Kronos', 'Pegasus', 'Orion', 'Sombrero', 'Cartwheel', 'Antennae', 'Helix'];
const SPACE_GALAXY_NAME_SUFFIXES = ['X-1', 'Prime', 'Alpha', 'Beta-9', 'V', 'Zeta', 'NGC-404', 'Epsilon', 'Omega', 'Proxima', 'Core', 'Infinity', 'Nova', 'Void', 'Galaxy', 'System'];

/** 10 hình thái thiên hà — khớp 1:1 với 10 hàm `generate*Positions` + `GALAXY_GENERATORS` bên dưới. */
const SPACE_GALAXY_TYPES = ['Spiral', 'Barred Spiral', 'Elliptical', 'Ring', 'Irregular', 'Lenticular', 'Flocculent Spiral', 'Sombrero', 'Cartwheel', 'Peculiar'];

/** Palette CỐ ĐỊNH cho 1 số hình thái đặc thù (KHÔNG đổi theo `mode`/`dynA`/`dynB` — màu này gắn
 * với chính hình dạng thiên hà, ví dụ thiên hà già Elliptical/Lenticular luôn ngả vàng-cam, không
 * phụ thuộc gu màu người dùng chọn). Hình thái KHÔNG có trong bảng này (Spiral/Barred Spiral/
 * Ring/Irregular/Flocculent Spiral) tôn trọng `vizConfig.mode` — xem `pickGalaxyPalette()`. */
const SPACE_GALAXY_SPECIAL_PALETTES = {
    'Elliptical': { in: '#f59e0b', out: '#b45309' },
    'Lenticular': { in: '#f59e0b', out: '#b45309' },
    'Cartwheel': { in: '#ec4899', out: '#06b6d4' },
    'Sombrero': { in: '#fffbeb', out: '#1e3a8a' },
    'Peculiar': { in: '#fb923c', out: '#22d3ee' },
};

/** Vận tốc trôi dạt tối đa (đơn vị/giây) gán ngẫu nhiên cho mỗi thiên hà lúc sinh — giữ hiệu ứng
 * "mỗi thiên hà tự trôi theo hướng riêng" của bản demo gốc. */
const SPACE_GALAXY_DRIFT_MAX_SPEED = 4.0;

/** Shader thuần AdditiveBlending + texture sprite (KHÔNG bloom/postprocessing — đúng xác nhận
 * B2). `uHueShift` là uniform MỚI (plan B4, bước "Hue-shift màu — làm sau cùng") — lệch hue tại
 * fragment shader, CHỈ áp dụng khi Workflow truyền giá trị khác 0 (mode 'dynamic'/'gradient'). */
const GalaxyShader = {
    vertexShader: `
        uniform float uTime;
        uniform float uSpeed;
        uniform float uOpacity;
        uniform float uDirection;

        attribute float size;
        varying vec3 vColor;

        void main() {
            vColor = color;

            float r = length(position.xz);

            // Thuyết quay vi sai Keplerian Flat-Curve (giữ nguyên công thức bản demo — hình học
            // thiên hà xoắn ốc thật SỰ vận hành theo đường cong này, không phải "kế thừa" gì).
            float rotationSpeed = uDirection * (15.0 / (12.0 + r * 0.12));
            float angleOffset = uTime * rotationSpeed * uSpeed;

            float cosA = cos(angleOffset);
            float sinA = sin(angleOffset);

            vec3 rotPos = position;
            rotPos.x = position.x * cosA - position.z * sinA;
            rotPos.z = position.x * sinA + position.z * cosA;

            vec4 mvPosition = modelViewMatrix * vec4(rotPos, 1.0);
            gl_Position = projectionMatrix * mvPosition;

            gl_PointSize = size * (280.0 / -mvPosition.z);
        }
    `,
    fragmentShader: `
        uniform sampler2D uTexture;
        uniform float uOpacity;
        uniform float uHueShift;
        varying vec3 vColor;

        vec3 rgb2hsv(vec3 c) {
            vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
            vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
            vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
            float d = q.x - min(q.w, q.y);
            float e = 1.0e-10;
            return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
        }
        vec3 hsv2rgb(vec3 c) {
            vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
            vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
            return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
        }

        void main() {
            vec4 texColor = texture2D(uTexture, gl_PointCoord);
            if (texColor.a < 0.05) discard;

            vec3 shifted = vColor;
            if (abs(uHueShift) > 0.0001) {
                vec3 hsv = rgb2hsv(vColor);
                hsv.x = fract(hsv.x + uHueShift / 360.0);
                shifted = hsv2rgb(hsv);
            }

            gl_FragColor = vec4(shifted * texColor.rgb, texColor.a * uOpacity);
        }
    `
};

// ============================================================================================
// 2. KHỞI TẠO SCENE/CAMERA/TEXTURE (gọi ĐÚNG 1 LẦN, lúc chuyển vào 'space' lần đầu)
// ============================================================================================

/**
 * Dựng `spScene`/`spCamera` MỚI — DÙNG CHUNG `tRenderer` (canvas #webgl-canvas) đã có sẵn từ
 * Vortex, KHÔNG tạo `WebGLRenderer` hay resize listener riêng (plan B2 — Workflow đảm bảo
 * `initThreeJS()` của Vortex đã chạy TRƯỚC khi gọi hàm này, xem
 * `core/visualizer/visualizer-display.js::updateTypeUI()`).
 * @param {THREE.WebGLRenderer} tRenderer - dùng chung với Vortex, CHỈ để đọc kích thước hiện tại.
 * @returns {{spScene: THREE.Scene, spCamera: THREE.PerspectiveCamera}}
 */
function initThreeSpace(tRenderer) {
    const spScene = new THREE.Scene();
    spScene.fog = new THREE.FogExp2(0x010103, 0.001);

    const spCamera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 4000);
    spCamera.position.set(0, 80, 200);

    return { spScene, spCamera };
}

/** Texture sprite ngôi sao (glow tròn trắng-lam) — dùng chung cho sao Galaxy VÀ SpaceDust. */
function createGalaxyStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, 'rgba(235, 250, 255, 0.95)');
    gradient.addColorStop(0.5, 'rgba(34, 211, 238, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(canvas);
}

/** Texture sprite tinh vân (glow tím-lam mờ, lớn hơn nhiều so với sao). */
function createGalaxyNebulaTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, 'rgba(168, 85, 247, 0.22)');
    gradient.addColorStop(0.4, 'rgba(59, 130, 246, 0.09)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
}

// ============================================================================================
// 3. HÌNH HỌC — 10 hàm generate*Positions (mỗi hàm 1 hình thái, THUẦN, KHÔNG gọi hàm nào khác)
// Chữ ký thống nhất: (positions, colors, sizes, i, config, colorIn, colorOut) — ghi thẳng vào 3
// mảng Float32Array được Workflow cấp sẵn (đã alloc đúng kích thước), theo đúng index ngôi sao i.
// ============================================================================================

/** 1. Thiên hà Xoắn ốc cổ điển (Spiral). */
function generateSpiralPositions(positions, colors, sizes, i, config, colorIn, colorOut) {
    const r = Math.pow(Math.random(), 1.8) * config.radius;
    const armIndex = i % config.arms;
    const armAngle = (armIndex / config.arms) * Math.PI * 2;
    const twistAngle = Math.pow(r / config.radius, 0.65) * config.twist * Math.PI * 2.5;
    const totalAngle = armAngle + twistAngle;

    const dispersion = config.dispersion * (0.15 + 0.85 * (r / config.radius));
    const rx = (Math.random() - 0.5) * dispersion * config.radius * 0.45;
    const ry = (Math.random() - 0.5) * dispersion * config.radius * 0.15;
    const rz = (Math.random() - 0.5) * dispersion * config.radius * 0.45;

    const idx = i * 3;
    positions[idx] = Math.cos(totalAngle) * r + rx;
    positions[idx + 1] = ry;
    positions[idx + 2] = Math.sin(totalAngle) * r + rz;

    const mixColor = colorIn.clone().lerp(colorOut, r / config.radius);
    if (r < config.radius * 0.12) mixColor.addScalar(0.28);

    colors[idx] = mixColor.r; colors[idx + 1] = mixColor.g; colors[idx + 2] = mixColor.b;
    sizes[i] = (Math.random() * 0.8 + 0.3) * config.starSize;
}

/** 2. Thiên hà Xoắn ốc có thanh ngang (Barred Spiral). */
function generateBarredSpiralPositions(positions, colors, sizes, i, config, colorIn, colorOut) {
    const idx = i * 3;
    const r = Math.pow(Math.random(), 1.7) * config.radius;
    const barLength = config.radius * 0.38;

    let x = 0, y = 0, z = 0;
    const dispersion = config.dispersion * (0.15 + 0.85 * (r / config.radius));
    const rx = (Math.random() - 0.5) * dispersion * config.radius * 0.4;
    const ry = (Math.random() - 0.5) * dispersion * config.radius * 0.12;
    const rz = (Math.random() - 0.5) * dispersion * config.radius * 0.4;

    if (r < barLength) {
        const side = (i % 2 === 0) ? 1 : -1;
        const ratio = r / barLength;
        x = ratio * barLength * side;
        z = (Math.random() - 0.5) * barLength * 0.22;
    } else {
        const side = (i % 2 === 0) ? 0 : Math.PI;
        const armRatio = (r - barLength) / (config.radius - barLength);
        const twistAngle = armRatio * config.twist * Math.PI * 1.8;
        const totalAngle = side + twistAngle;
        x = Math.cos(totalAngle) * r;
        z = Math.sin(totalAngle) * r;
    }

    positions[idx] = x + rx; positions[idx + 1] = ry; positions[idx + 2] = z + rz;

    const mixColor = colorIn.clone().lerp(colorOut, r / config.radius);
    colors[idx] = mixColor.r; colors[idx + 1] = mixColor.g; colors[idx + 2] = mixColor.b;
    sizes[i] = (Math.random() * 0.7 + 0.3) * config.starSize;
}

/** 3. Thiên hà Hình Elip cổ già (Elliptical). */
function generateEllipticalPositions(positions, colors, sizes, i, config, colorIn, colorOut) {
    const idx = i * 3;
    const r = Math.pow(Math.random(), 3.5) * config.radius;
    const u = Math.random(); const v = Math.random();
    const theta = u * Math.PI * 2; const phi = Math.acos(v * 2 - 1);
    const scaleX = 1.0, scaleY = 0.55, scaleZ = 0.75;

    positions[idx] = r * Math.sin(phi) * Math.cos(theta) * scaleX;
    positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta) * scaleY;
    positions[idx + 2] = r * Math.cos(phi) * scaleZ;

    const mixColor = colorIn.clone().lerp(colorOut, r / config.radius);
    colors[idx] = mixColor.r; colors[idx + 1] = mixColor.g; colors[idx + 2] = mixColor.b;
    sizes[i] = (Math.random() * 0.6 + 0.4) * config.starSize;
}

/** 4. Thiên hà Dạng Vòng phát sáng (Ring). */
function generateRingPositions(positions, colors, sizes, i, config, colorIn, colorOut) {
    const idx = i * 3;
    let r;
    if (Math.random() < 0.28) r = Math.pow(Math.random(), 2.2) * (config.radius * 0.15);
    else r = config.radius * (0.65 + Math.random() * 0.22);

    const angle = Math.random() * Math.PI * 2;
    const dispersion = config.dispersion * 0.55;
    const rx = (Math.random() - 0.5) * dispersion * config.radius;
    const ry = (Math.random() - 0.5) * dispersion * config.radius * 0.25;
    const rz = (Math.random() - 0.5) * dispersion * config.radius;

    positions[idx] = Math.cos(angle) * r + rx; positions[idx + 1] = ry; positions[idx + 2] = Math.sin(angle) * r + rz;

    const mixColor = colorIn.clone().lerp(colorOut, r / config.radius);
    colors[idx] = mixColor.r; colors[idx + 1] = mixColor.g; colors[idx + 2] = mixColor.b;
    sizes[i] = (Math.random() * 0.7 + 0.3) * config.starSize;
}

/** 5. Thiên hà Vô định hình (Irregular). */
function generateIrregularPositions(positions, colors, sizes, i, config, colorIn, colorOut) {
    const idx = i * 3;
    const clusterCount = 3;
    const clusterIndex = i % clusterCount;

    let centerOffset = new THREE.Vector3();
    if (clusterIndex === 1) centerOffset.set(config.radius * 0.32, config.radius * 0.12, -config.radius * 0.2);
    else if (clusterIndex === 2) centerOffset.set(-config.radius * 0.25, -config.radius * 0.18, config.radius * 0.35);

    const r = Math.pow(Math.random(), 1.6) * (config.radius * 0.48);
    const u = Math.random(); const v = Math.random();
    const theta = u * Math.PI * 2; const phi = Math.acos(v * 2 - 1);

    positions[idx] = r * Math.sin(phi) * Math.cos(theta) + centerOffset.x;
    positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.85 + centerOffset.y;
    positions[idx + 2] = r * Math.cos(phi) + centerOffset.z;

    const mixColor = colorIn.clone().lerp(colorOut, Math.random());
    colors[idx] = mixColor.r; colors[idx + 1] = mixColor.g; colors[idx + 2] = mixColor.b;
    sizes[i] = (Math.random() * 0.85 + 0.25) * config.starSize * 1.25;
}

/** 6. Thiên hà Thấu Kính phẳng mượt (Lenticular - S0). */
function generateLenticularPositions(positions, colors, sizes, i, config, colorIn, colorOut) {
    const idx = i * 3;
    const isCore = Math.random() < 0.45;

    if (isCore) {
        const r = Math.pow(Math.random(), 2.0) * config.radius * 0.3;
        const u = Math.random(); const v = Math.random();
        const theta = u * Math.PI * 2; const phi = Math.acos(v * 2 - 1);
        positions[idx] = r * Math.sin(phi) * Math.cos(theta);
        positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[idx + 2] = r * Math.cos(phi);
        const mixColor = colorIn.clone().addScalar(0.15);
        colors[idx] = mixColor.r; colors[idx + 1] = mixColor.g; colors[idx + 2] = mixColor.b;
    } else {
        const r = (0.3 + Math.pow(Math.random(), 1.5) * 0.7) * config.radius;
        const angle = Math.random() * Math.PI * 2;
        const rx = (Math.random() - 0.5) * config.dispersion * config.radius * 0.15;
        const ry = (Math.random() - 0.5) * config.dispersion * config.radius * 0.05;
        const rz = (Math.random() - 0.5) * config.dispersion * config.radius * 0.15;
        positions[idx] = Math.cos(angle) * r + rx; positions[idx + 1] = ry; positions[idx + 2] = Math.sin(angle) * r + rz;
        const mixColor = colorIn.clone().lerp(colorOut, r / config.radius);
        colors[idx] = mixColor.r; colors[idx + 1] = mixColor.g; colors[idx + 2] = mixColor.b;
    }
    sizes[i] = (Math.random() * 0.6 + 0.4) * config.starSize;
}

/** 7. Thiên hà Xoắn Ốc Bông Tơi xốp (Flocculent Spiral). */
function generateFlocculentPositions(positions, colors, sizes, i, config, colorIn, colorOut) {
    const idx = i * 3;
    const arms = 10;
    const armIndex = i % arms;
    const r = Math.pow(Math.random(), 1.6) * config.radius;
    const armAngle = (armIndex / arms) * Math.PI * 2;
    const patchFactor = Math.sin(r * 0.45) > 0 ? 1.0 : 0.4;
    const twistAngle = Math.pow(r / config.radius, 0.75) * 4.5 * Math.PI;
    const totalAngle = armAngle + twistAngle + (Math.random() - 0.5) * 0.65;

    const dispersion = config.dispersion * 1.6;
    const rx = (Math.random() - 0.5) * dispersion * config.radius * 0.5;
    const ry = (Math.random() - 0.5) * dispersion * config.radius * 0.2;
    const rz = (Math.random() - 0.5) * dispersion * config.radius * 0.5;

    positions[idx] = Math.cos(totalAngle) * r + rx; positions[idx + 1] = ry; positions[idx + 2] = Math.sin(totalAngle) * r + rz;

    const mixColor = colorIn.clone().lerp(colorOut, r / config.radius);
    if (Math.random() < 0.25) mixColor.add(new THREE.Color(0x00ffff)).multiplyScalar(1.2);
    colors[idx] = mixColor.r; colors[idx + 1] = mixColor.g; colors[idx + 2] = mixColor.b;
    sizes[i] = (Math.random() * 0.85 + 0.25) * config.starSize * patchFactor;
}

/** 8. Thiên hà Mũ Sombrero lõi khổng lồ (Sombrero - M104). */
function generateSombreroPositions(positions, colors, sizes, i, config, colorIn, colorOut) {
    const idx = i * 3;
    const isBulge = Math.random() < 0.58;

    if (isBulge) {
        const r = Math.pow(Math.random(), 1.7) * config.radius * 0.48;
        const u = Math.random(); const v = Math.random();
        const theta = u * Math.PI * 2; const phi = Math.acos(v * 2 - 1);
        positions[idx] = r * Math.sin(phi) * Math.cos(theta);
        positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.88;
        positions[idx + 2] = r * Math.cos(phi);
        const mixColor = colorIn.clone().lerp(colorOut, r / (config.radius * 0.48));
        colors[idx] = mixColor.r + 0.15; colors[idx + 1] = mixColor.g + 0.15; colors[idx + 2] = mixColor.b + 0.08;
    } else {
        const r = config.radius * (0.68 + Math.random() * 0.24);
        const angle = Math.random() * Math.PI * 2;
        const rx = (Math.random() - 0.5) * 5.0;
        const ry = (Math.random() - 0.5) * 1.5;
        const rz = (Math.random() - 0.5) * 5.0;
        positions[idx] = Math.cos(angle) * r + rx; positions[idx + 1] = ry; positions[idx + 2] = Math.sin(angle) * r + rz;
        const mixColor = colorOut.clone().multiplyScalar(0.72);
        colors[idx] = mixColor.r; colors[idx + 1] = mixColor.g; colors[idx + 2] = mixColor.b;
    }
    sizes[i] = (Math.random() * 0.75 + 0.25) * config.starSize;
}

/** 9. Thiên hà Va Chạm Bánh Xe (Cartwheel Collisional Ring). */
function generateCartwheelPositions(positions, colors, sizes, i, config, colorIn, colorOut) {
    const idx = i * 3;
    const rand = Math.random();

    if (rand < 0.28) {
        const r = Math.pow(Math.random(), 1.5) * config.radius * 0.22;
        const angle = Math.random() * Math.PI * 2;
        positions[idx] = Math.cos(angle) * r; positions[idx + 1] = (Math.random() - 0.5) * 2.2; positions[idx + 2] = Math.sin(angle) * r;
        colors[idx] = colorIn.r; colors[idx + 1] = colorIn.g; colors[idx + 2] = colorIn.b;
    } else if (rand < 0.68) {
        const r = config.radius * (0.82 + Math.random() * 0.12);
        const angle = Math.random() * Math.PI * 2;
        positions[idx] = Math.cos(angle) * r + (Math.random() - 0.5) * 4.5;
        positions[idx + 1] = (Math.random() - 0.5) * 2.5;
        positions[idx + 2] = Math.sin(angle) * r + (Math.random() - 0.5) * 4.5;
        colors[idx] = colorOut.r; colors[idx + 1] = colorOut.g; colors[idx + 2] = colorOut.b;
    } else {
        const spokeCount = 8;
        const spokeIndex = i % spokeCount;
        const spokeAngle = (spokeIndex / spokeCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.08;
        const r = config.radius * (0.22 + Math.random() * 0.6);
        positions[idx] = Math.cos(spokeAngle) * r; positions[idx + 1] = (Math.random() - 0.5) * 2.0; positions[idx + 2] = Math.sin(spokeAngle) * r;
        const mixColor = colorIn.clone().lerp(colorOut, r / config.radius);
        colors[idx] = mixColor.r * 0.75; colors[idx + 1] = mixColor.g * 0.75; colors[idx + 2] = mixColor.b * 0.75;
    }
    sizes[i] = (Math.random() * 0.8 + 0.35) * config.starSize;
}

/** 10. Thiên hà Tương tác Đuôi Thủy Triều va chạm (Peculiar / Interacting). */
function generatePeculiarPositions(positions, colors, sizes, i, config, colorIn, colorOut) {
    const idx = i * 3;
    const rand = Math.random();
    const coreDistance = 26;

    if (rand < 0.32) {
        const r = Math.pow(Math.random(), 2.0) * config.radius * 0.14;
        const u = Math.random(); const v = Math.random();
        const theta = u * Math.PI * 2; const phi = Math.acos(v * 2 - 1);
        positions[idx] = r * Math.sin(phi) * Math.cos(theta) - coreDistance;
        positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.75;
        positions[idx + 2] = r * Math.cos(phi);
        colors[idx] = colorIn.r; colors[idx + 1] = colorIn.g; colors[idx + 2] = colorIn.b;
    } else if (rand < 0.64) {
        const r = Math.pow(Math.random(), 2.0) * config.radius * 0.14;
        const u = Math.random(); const v = Math.random();
        const theta = u * Math.PI * 2; const phi = Math.acos(v * 2 - 1);
        positions[idx] = r * Math.sin(phi) * Math.cos(theta) + coreDistance;
        positions[idx + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.75;
        positions[idx + 2] = r * Math.cos(phi);
        colors[idx] = colorOut.r; colors[idx + 1] = colorOut.g; colors[idx + 2] = colorOut.b;
    } else {
        const isTailA = i % 2 === 0;
        const t = Math.random();
        if (isTailA) {
            const angle = t * Math.PI * 1.45;
            const r = t * config.radius * 0.85;
            positions[idx] = -coreDistance - Math.cos(angle) * r;
            positions[idx + 1] = (Math.random() - 0.5) * 5.5;
            positions[idx + 2] = Math.sin(angle) * r;
            colors[idx] = colorIn.r; colors[idx + 1] = colorIn.g; colors[idx + 2] = colorIn.b;
        } else {
            const angle = t * Math.PI * 1.45 + Math.PI;
            const r = t * config.radius * 0.85;
            positions[idx] = coreDistance - Math.cos(angle) * r;
            positions[idx + 1] = (Math.random() - 0.5) * 5.5;
            positions[idx + 2] = Math.sin(angle) * r;
            colors[idx] = colorOut.r; colors[idx + 1] = colorOut.g; colors[idx + 2] = colorOut.b;
        }
    }
    sizes[i] = (Math.random() * 0.7 + 0.3) * config.starSize;
}

/** Bảng tra type -> hàm generate — DỮ LIỆU, không phải "hàm chọn hàm" (bản thân bảng KHÔNG gọi
 * gì cả). `event/workflow/visualizer-render.js` tự tra bảng này rồi TỰ vòng lặp gọi đúng 1 hàm
 * cho toàn bộ N sao của 1 thiên hà — do đó bảng này KHÔNG vi phạm Rule 1 (không có function nào
 * ở ĐÂY "chọn" cả, chỉ Workflow tự tra + tự gọi). */
const GALAXY_GENERATORS = {
    'Spiral': generateSpiralPositions,
    'Barred Spiral': generateBarredSpiralPositions,
    'Elliptical': generateEllipticalPositions,
    'Ring': generateRingPositions,
    'Irregular': generateIrregularPositions,
    'Lenticular': generateLenticularPositions,
    'Flocculent Spiral': generateFlocculentPositions,
    'Sombrero': generateSombreroPositions,
    'Cartwheel': generateCartwheelPositions,
    'Peculiar': generatePeculiarPositions,
};

// ============================================================================================
// 4. LỰA CHỌN NGẪU NHIÊN (type/tên/palette/config hình học) — mỗi hàm 1 việc, THUẦN
// ============================================================================================

/** Chọn ngẫu nhiên 1 trong 10 hình thái. */
function pickGalaxyType() {
    return SPACE_GALAXY_TYPES[Math.floor(Math.random() * SPACE_GALAXY_TYPES.length)];
}

/** Sinh tên ngẫu nhiên kiểu "Messier Prime-482". */
function generateRandomGalaxyName() {
    const p = SPACE_GALAXY_NAME_PREFIXES[Math.floor(Math.random() * SPACE_GALAXY_NAME_PREFIXES.length)];
    const s = SPACE_GALAXY_NAME_SUFFIXES[Math.floor(Math.random() * SPACE_GALAXY_NAME_SUFFIXES.length)];
    const r = Math.floor(Math.random() * 900) + 100;
    return `${p} ${s}-${r}`;
}

/**
 * Palette (colorIn/colorOut) theo hình thái — 5 hình thái ĐẶC THÙ dùng màu CỐ ĐỊNH
 * (`SPACE_GALAXY_SPECIAL_PALETTES`, gắn với chính hình dạng vật lý, KHÔNG đổi theo `mode`), 5 hình
 * thái còn lại tôn trọng `vizConfig.mode` — ĐÚNG yêu cầu #3 `readme/visual-conventions.md` ("màu
 * phải lấy từ helper màu chung/solidColor/dynA-dynB theo lựa chọn người dùng", KHÔNG hard-code):
 * FIX (21/07/2026, phản hồi Giang mục 4 — "chưa áp dụng file md visualizer") — bản trước LUÔN
 * dùng `dynA`/`dynB` bất kể `mode` đang là gì, kể cả khi người dùng chọn 'solid' — SAI, đã sửa:
 * `mode === 'solid'` giờ dùng `solidColor` cho CẢ colorIn/colorOut (đúng bản chất "1 màu duy
 * nhất" mà mọi visual khác áp dụng cho mode này); `dynamic`/`gradient` dùng `dynA`/`dynB` (gradient
 * còn được hue-shift theo `globalHueOffset` mỗi frame — xem `GalaxyCluster.update()`/
 * `event/workflow/visualizer-render.js`, KHÔNG đụng ở hàm này).
 * Guard clause thuần (Rule 1) — KHÔNG phải rẽ nhánh 2 tiến trình khác nhau: xoá `if` đi, hàm vẫn
 * còn ĐÚNG 1 kịch bản "tra bảng lấy palette", chỉ mất phần "trường hợp đặc biệt có palette cố định".
 * @param {string} type @param {string} mode @param {string} solidColor @param {string} dynA @param {string} dynB
 * @returns {{in: string, out: string}}
 */
function pickGalaxyPalette(type, mode, solidColor, dynA, dynB) {
    if (SPACE_GALAXY_SPECIAL_PALETTES[type]) return SPACE_GALAXY_SPECIAL_PALETTES[type];
    if (mode === 'solid') return { in: solidColor, out: solidColor };
    return { in: dynA, out: dynB };
}

/** Config hình học (bán kính/số nhánh/độ xoắn/độ tán xạ/cỡ sao) dùng chung cho cả 10 hàm generate. */
function buildGalaxyGeometryConfig(radius) {
    return {
        radius,
        arms: 2 + Math.floor(Math.random() * 3),
        twist: 1.8 + Math.random() * 1.6,
        dispersion: 0.11 + Math.random() * 0.05,
        starSize: 1.8 + Math.random() * 1.2,
    };
}

// ============================================================================================
// 5. CHUỖI THIÊN HÀ — toán học vị trí "nút" sợi vũ trụ + phân tán thành viên quanh nút
// ============================================================================================

/**
 * Hệ trục cục bộ (phải/trên) TỪ hướng bay hiện tại `forward` — dùng để đặt các "nút" chuỗi thiên
 * hà lệch trái/phải/trên/dưới quanh trục tiến, THAY vì cố định theo trục X/Y thế giới (bản trước) —
 * cần thiết từ khi camera có thể quay bất kỳ hướng nào (xem `computeGalaxyClusterCore` ngay dưới).
 * Guard: khi `forward` gần như thẳng đứng (nhìn gần thẳng lên/xuống), `cross(forward, worldUp)`
 * suy biến gần 0 (2 vector gần song song) — dùng trục X thế giới làm tham chiếu dự phòng.
 * @param {THREE.Vector3} forward - ĐÃ normalize
 * @returns {{right: THREE.Vector3, up: THREE.Vector3}}
 */
function computeSpaceForwardBasis(forward) {
    const worldUp = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, worldUp);
    if (right.lengthSq() < 0.0001) right.set(1, 0, 0); else right.normalize();
    const up = new THREE.Vector3().crossVectors(right, forward).normalize();
    return { right, up };
}

/**
 * Toạ độ "nút" của sợi vũ trụ, đo `distanceAhead` ĐƠN VỊ KHOẢNG CÁCH (KHÔNG còn phải index) TỪ
 * `originPos` (vị trí camera NGAY LÚC gọi hàm), THEO ĐÚNG hướng camera đang bay (`forward`/
 * `right`/`up`, xem `computeSpaceForwardBasis`) — THAY HẲN cách tính bản trước (trục Z thế giới
 * CỐ ĐỊNH, giả định camera luôn bay -Z).
 *
 * FIX (21/07/2026, phản hồi Giang mục 2d — "quay hướng khác thì không sinh thiên hà, nền tối"):
 * bản trước tính vị trí "nút" bằng `-clusterIdx * spacingZ` trên trục Z THẾ GIỚI tuyệt đối — chỉ
 * đúng khi camera luôn bay theo -Z. Từ khi hướng bay hợp nhất với hướng nhìn (`spViewDir`, plan
 * B3) và có thể quay bất kỳ hướng nào (mục 2c), chuỗi thiên hà PHẢI sinh dọc theo hướng camera
 * ĐANG NHÌN, không phải trục Z cố định — nếu không, quay sang hướng khác sẽ không có gì phía
 * trước (đúng triệu chứng Giang báo). Gọi hàm này với `originPos`/`forward` LẤY TỪ vị trí/hướng
 * camera HIỆN TẠI mỗi lần cần sinh thêm (xem `event/workflow/visualizer-render.js::_manageSpaceChain()`)
 * — quay hướng nào, chuỗi tự "mọc" theo đúng hướng đó trong vài khung hình.
 *
 * `wobbleSeed` giữ nguyên công thức sin/cos uốn lượn cũ (KHÔNG kế thừa ý nghĩa gì đặc biệt, chỉ
 * là hằng số hợp lý cho hình dạng lượn sóng) — áp theo trục `right`/`up` CỤC BỘ thay vì trục X/Y
 * thế giới.
 * @param {THREE.Vector3} originPos @param {THREE.Vector3} forward @param {THREE.Vector3} right
 * @param {THREE.Vector3} up @param {number} distanceAhead @param {number} wobbleSeed
 * @returns {THREE.Vector3}
 */
function computeGalaxyClusterCore(originPos, forward, right, up, distanceAhead, wobbleSeed) {
    const rightWobble = Math.sin(wobbleSeed * 0.95) * 110;
    const upWobble = Math.cos(wobbleSeed * 0.7) * 45;
    return originPos.clone()
        .addScaledVector(forward, distanceAhead)
        .addScaledVector(right, rightWobble)
        .addScaledVector(up, upWobble);
}

/** Offset ngẫu nhiên (phân tán chặt quanh 1 nút) cho 1 thành viên trong cụm 2-3 thiên hà.
 * @returns {THREE.Vector3} */
function computeGalaxyMemberOffset() {
    const dispRadius = 40 + Math.random() * 45;
    const angle = Math.random() * Math.PI * 2;
    const elevation = (Math.random() - 0.5) * Math.PI * 0.5;
    return new THREE.Vector3(
        Math.cos(angle) * Math.cos(elevation) * dispRadius,
        Math.sin(elevation) * dispRadius,
        Math.sin(angle) * Math.cos(elevation) * dispRadius
    );
}

/** Biên độ pitch (radian) khi "reroll" hướng nhìn mới — TĂNG so với bản trước (0.5π) theo yêu cầu
 * "tăng ngưỡng có thể xoay lên cao hơn" (phản hồi 21/07/2026, mục 2c). */
const SPACE_REROLL_PITCH_RANGE = Math.PI * 0.85;

/** Hướng nhìn/di chuyển MỤC TIÊU mới lúc "reroll" (plan B3/B4) — hình nón ngẫu nhiên hướng về
 * phía trước (-Z), lệch theo `pitchBias` (nốt cao -> thiên hướng "lên", nốt thấp -> "xuống").
 * @param {number} pitchBias - radian, âm/dương lệch trục pitch, đã tính sẵn bởi Workflow.
 * @returns {THREE.Vector3} */
function rollNewSpaceViewDirTarget(pitchBias) {
    const yaw = (Math.random() - 0.5) * Math.PI * 0.9;
    const pitch = (Math.random() - 0.5) * SPACE_REROLL_PITCH_RANGE + pitchBias;
    return new THREE.Vector3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch)
    ).normalize();
}

// ============================================================================================
// 6. class GalaxyCluster — 1 instance = 1 thiên hà. Method KHÔNG gọi lẫn nhau (xem đầu file).
// ============================================================================================

class GalaxyCluster {
    /**
     * Constructor CHỈ gán field thuần — KHÔNG tự gọi build()/buildNebula() (Workflow tự gọi 2
     * method đó RIÊNG, theo đúng thứ tự, ngay sau khi `new`).
     */
    constructor(position, index, name, type, radius, starsCount, rotationDir, rotationSpeed, rotation) {
        this.id = THREE.MathUtils.generateUUID();
        this.index = index;
        this.name = name;
        this.position = position.clone();
        this.type = type;
        this.radius = radius;
        this.starsCount = starsCount;
        this.rotationDir = rotationDir;
        this.rotationSpeed = rotationSpeed;

        this.driftVelocity = new THREE.Vector3(
            (Math.random() - 0.5) * SPACE_GALAXY_DRIFT_MAX_SPEED,
            (Math.random() - 0.5) * SPACE_GALAXY_DRIFT_MAX_SPEED,
            (Math.random() - 0.5) * SPACE_GALAXY_DRIFT_MAX_SPEED
        );

        this.mesh = null;
        this.material = null;
        this.nebulaMesh = null;
        this.nebulaMaterial = null;

        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.rotation.copy(rotation);

        this.fadeInProgress = 0.0;
    }

    /**
     * Lắp ráp mesh sao chính từ 3 mảng ĐÃ LẤP ĐẦY SẴN (Workflow tự vòng lặp gọi
     * `GALAXY_GENERATORS[type]` cho từng sao TRƯỚC khi gọi method này — method này KHÔNG tự chọn/
     * gọi hàm generate nào, chỉ dựng geometry/material/mesh từ dữ liệu đã có).
     * @param {Float32Array} positions @param {Float32Array} colors @param {Float32Array} sizes
     * @param {THREE.Texture} starTexture @param {THREE.Scene} scene
     */
    build(positions, colors, sizes, starTexture, scene) {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        this.material = new THREE.ShaderMaterial({
            vertexShader: GalaxyShader.vertexShader,
            fragmentShader: GalaxyShader.fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uSpeed: { value: 1.0 },
                uOpacity: { value: 0.0 },
                uDirection: { value: this.rotationDir * this.rotationSpeed },
                uHueShift: { value: 0 },
                uTexture: { value: starTexture }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexColors: true
        });

        this.mesh = new THREE.Points(geometry, this.material);
        this.group.add(this.mesh);
        scene.add(this.group);
    }

    /** Dựng lớp tinh vân bao quanh (điểm sprite lớn, thưa) — gọi SAU `build()`.
     * @param {THREE.Color} color @param {THREE.Texture} nebulaTexture @param {number} nebulaCount */
    buildNebula(color, nebulaTexture, nebulaCount) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(nebulaCount * 3);
        const col = new Float32Array(nebulaCount * 3);
        const sizes = new Float32Array(nebulaCount);

        for (let i = 0; i < nebulaCount; i++) {
            const idx = i * 3;
            const r = Math.random() * (this.radius * 0.85);
            const angle = Math.random() * Math.PI * 2;
            pos[idx] = Math.cos(angle) * r;
            pos[idx + 1] = (Math.random() - 0.5) * (this.radius * 0.12);
            pos[idx + 2] = Math.sin(angle) * r;
            col[idx] = color.r; col[idx + 1] = color.g; col[idx + 2] = color.b;
            sizes[i] = 160 + Math.random() * 150;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        this.nebulaMaterial = new THREE.PointsMaterial({
            size: 180, sizeAttenuation: true, map: nebulaTexture,
            blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
            opacity: 0.0, vertexColors: true
        });

        this.nebulaMesh = new THREE.Points(geo, this.nebulaMaterial);
        this.group.add(this.nebulaMesh);
    }

    /**
     * Cập nhật MỖI FRAME — trôi dạt, fade-in, uniform shader, xoay nebula. Workflow gọi method
     * này cho TỪNG cluster trong vòng lặp (`event/workflow/visualizer-render.js`).
     * @param {number} delta - giây kể từ frame trước
     * @param {number} speed - tốc độ chung (BPM baseline + energy, plan B4), dùng CHUNG cho trôi
     *        dạt/tự quay sao (uSpeed)/quay nebula — "miễn phí" đúng plan B4.
     * @param {number} globalTime - đồng hồ tích luỹ (giây), feed vào uTime cho xoay Keplerian.
     * @param {number} hueShift - độ lệch hue (0 nếu mode không phải dynamic/gradient).
     * @param {number} smoothedEnergy - cộng thêm vào độ sáng nebula (plan B4).
     */
    update(delta, speed, globalTime, hueShift, smoothedEnergy) {
        const speedMult = delta * speed * 0.45;
        this.position.addScaledVector(this.driftVelocity, speedMult);
        this.group.position.copy(this.position);

        if (this.fadeInProgress < 1.0) {
            this.fadeInProgress = Math.min(1.0, this.fadeInProgress + delta * 0.75);
        }

        if (this.material && this.material.uniforms) {
            this.material.uniforms.uTime.value = globalTime;
            this.material.uniforms.uSpeed.value = speed;
            this.material.uniforms.uOpacity.value = 0.9 * this.fadeInProgress;
            this.material.uniforms.uHueShift.value = hueShift;
        }

        if (this.nebulaMesh) {
            this.nebulaMesh.rotation.y += this.rotationDir * this.rotationSpeed * delta * 0.08 * speed;
            if (this.nebulaMaterial) {
                this.nebulaMaterial.opacity = (0.32 + smoothedEnergy * 0.2) * this.fadeInProgress;
            }
        }
    }

    /** Giải phóng hoàn toàn khỏi scene + dispose geometry/material (tránh rò rỉ GPU memory).
     * @param {THREE.Scene} scene */
    dispose(scene) {
        scene.remove(this.group);
        if (this.mesh) { this.mesh.geometry.dispose(); this.material.dispose(); }
        if (this.nebulaMesh) { this.nebulaMesh.geometry.dispose(); this.nebulaMaterial.dispose(); }
    }
}

// ============================================================================================
// 7. SpaceDust — bụi vũ trụ nền, KHÔNG cần "cụm nhiều instance" như GalaxyCluster nên KHÔNG cần
// class riêng (thay `SpaceDust` bản demo — B7: "spDustMesh, MỚI, thay SpaceDust") — 1 hàm THUẦN
// dựng mesh (cập nhật mỗi frame nằm ở core/visualizer/types/space.js, xem đầu file).
// ============================================================================================

/** Dựng 1 mesh Points bụi trải đều trong 1 khối lập phương quanh gốc toạ độ.
 * @param {number} count @param {number} range @param {THREE.Texture} starTexture
 * @returns {THREE.Points} */
function buildSpaceDustMesh(count, range, starTexture) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        pos[i * 3] = (Math.random() - 0.5) * range;
        pos[i * 3 + 1] = (Math.random() - 0.5) * range;
        pos[i * 3 + 2] = (Math.random() - 0.5) * range;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
        size: 1.3, color: 0xec4899, transparent: true, opacity: 0.5,
        map: starTexture, blending: THREE.AdditiveBlending, depthWrite: false
    });
    return new THREE.Points(geo, mat);
}
