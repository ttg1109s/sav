/**
 * core/webgl/three-space.js — Galaxy Journey engine. Lịch sử: viết lại HOÀN TOÀN từ đầu
 * (20/07/2026, plan-space-galaxy.md Phần B), sau đó trải qua nhiều lượt sửa mô hình di chuyển
 * (bản đồ TĨNH + travel/rotate 2 pha, chốt 21/07/2026).
 *
 * VIẾT LẠI HOÀN TOÀN MÔ HÌNH DI CHUYỂN (26/08/2026, phản hồi Giang — "loại bỏ mô hình cũ, không
 * cần ý kiến"; SỬA LẠI CÙNG NGÀY, phản hồi Giang lượt 2 — tách RÕ 2 khái niệm từng bị gộp nhầm ở
 * bản đầu: (a) "chuyển pha" = điều kiện MOVE giữa các cụm — mục đích tham khảo/tái dùng
 * `detectFluxTransition()`/`isPhraseBoundary()` (core/gameplay/engine.js, core/gameplay/
 * circle-mode.js — game mode Circle dùng để rebuild pitch map); (b) "cụm tan đi/thêm vào" = vòng
 * đời QUẦN THỂ cụm, HOÀN TOÀN ĐỘC LẬP với (a), cụm mới mờ dần HIỆN, cụm cũ mờ dần TAN theo nhạc —
 * xem toàn bộ logic 2 việc này ở `event/workflow/visualizer-render.js`, file NÀY chỉ thêm tham số
 * `fadeOutMultiplier` vào `SpaceGalaxy.update()` để hỗ trợ (b)) — BỎ HẲN mô hình bản đồ TĨNH 1 lớp
 * (N "nút" rải đều quanh 1 tâm, mỗi nút mang vài thiên hà) + máy trạng thái travel/rotate cũ. THAY
 * BẰNG mô hình 2 LỚP đúng nghĩa thiên văn:
 *   - **Cụm thiên hà** (cluster) — quần thể DAO ĐỘNG (`SPACE_CLUSTER_INITIAL_COUNT`/`_MIN_COUNT`/
 *     `_MAX_COUNT`, event/workflow/visualizer-render.js) — ban đầu 5, sau đó có thể tan đi/thêm
 *     vào theo nhạc (KHÔNG cố định 5 mãi mãi), mỗi cụm có toạ độ TÂM + hướng quay riêng, chứa vài
 *     thiên hà thành viên.
 *   - **Thiên hà** (galaxy) — vẫn dùng NGUYÊN class dưới đây (đổi tên `GalaxyCluster` ->
 *     `SpaceGalaxy` cho khớp nghĩa thiên văn thật — 1 instance VẪN LÀ 1 thiên hà, KHÔNG đổi hành
 *     vi/method nào bên trong, chỉ đổi TÊN).
 * Máy trạng thái MỚI (4 pha, xem đầy đủ ở event/workflow/visualizer-render.js): chọn 1 cụm ->
 * xoay camera hướng tâm cụm (`clusterRotate`) -> bay tới đó (`clusterTravel`) -> "mắc kẹt" trong
 * cụm, LẶP LẠI chọn 1 thiên hà thành viên CHƯA ghé -> xoay hướng thiên hà đó (`galaxyRotate`) ->
 * bay A->B->C rồi quay lưng lại (`galaxyTravel`) -- cho tới khi ghé đủ mọi thiên hà trong cụm thì
 * quay lại bước chọn cụm (tái tạo 5 cụm MỚI quanh vị trí hiện tại).
 * `generateGalaxyMapNodePositions()`/`steerSpaceForward3D()` (bản đồ TĨNH + bẻ lái theo nốt) ĐÃ BỎ
 * HẲN — không còn khái niệm "bản đồ" hay "steer tự do", camera LUÔN xoay hướng tới 1 toạ độ ĐÍCH
 * cụ thể (tâm cụm hoặc tâm thiên hà), không còn "dò theo nón phía trước" nào nữa.
 *
 * Tham khảo thiết kế/công thức hình học 10 hình thái thiên hà từ 1 file HTML demo độc lập Giang
 * cung cấp (space.txt, "Vũ Trụ Vô Tận" — KHÔNG dùng bloom/postprocessing, chỉ AdditiveBlending +
 * texture sprite thuần) — PHẦN NÀY GIỮ NGUYÊN, không đụng ở lượt viết lại 26/08/2026 (chỉ mô hình
 * DI CHUYỂN thay đổi, hình học/màu sắc 1 thiên hà đơn lẻ không đổi).
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

/** Định danh ngẫu nhiên chuẩn khoa học (giữ nguyên tinh thần bản demo, số liệu không kế thừa gì
 * đặc biệt — chỉ là 1 danh sách tên hợp lý cho bản MỚI). */
const SPACE_GALAXY_NAME_PREFIXES = ['Messier', 'Centaurus', 'Andromeda', 'Sagittarius', 'Perseus', 'Cassiopeia', 'Cygnus', 'Nebula', 'Kepler', 'Vortex', 'Surtur', 'Hyperion', 'Aether', 'Kronos', 'Pegasus', 'Orion', 'Sombrero', 'Cartwheel', 'Antennae', 'Helix'];
const SPACE_GALAXY_NAME_SUFFIXES = ['X-1', 'Prime', 'Alpha', 'Beta-9', 'V', 'Zeta', 'NGC-404', 'Epsilon', 'Omega', 'Proxima', 'Core', 'Infinity', 'Nova', 'Void', 'Galaxy', 'System'];

/** 10 hình thái thiên hà — khớp 1:1 với 10 hàm `generate*Positions` + `GALAXY_GENERATORS` bên dưới. */
const SPACE_GALAXY_TYPES = ['Spiral', 'Barred Spiral', 'Elliptical', 'Ring', 'Irregular', 'Lenticular', 'Flocculent Spiral', 'Sombrero', 'Cartwheel', 'Peculiar'];

/** (21/07/2026 — KHÔNG CÒN dùng cho màu nữa, xem `pickGalaxyPalette()`) Palette từng CỐ ĐỊNH cho
 * 1 số hình thái đặc thù — GIỮ LẠI data này trong file phòng cần tái dùng cho mục đích KHÁC màu
 * (ví dụ tô điểm chi tiết hình dạng), tuyệt đối KHÔNG dùng lại cho việc chọn màu chủ đạo nữa (mọi
 * hình thái giờ đều theo `vizConfig.mode`, không ngoại lệ). */
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
/**
 * "Túi xáo trộn" (shuffle bag) chọn hình thái thiên hà — FIX (21/07/2026, phản hồi Giang — "hình
 * thái thiên hà phân bổ không đều, trùng lặp khá nhiều"): random ĐỘC LẬP thuần tuý (bản trước,
 * `pickGalaxyType()` — mỗi lần chọn không nhớ gì các lần trước) vẫn có thể ra liên tiếp NHIỀU lần
 * cùng 1 hình thái hoàn toàn hợp lệ về mặt xác suất (không phải bug, nhưng KHÓ CHỊU về mặt thị
 * giác — đúng phản ánh của Giang). Giờ đảm bảo mọi hình thái ĐANG BẬT xuất hiện ĐÚNG 1 LẦN mỗi chu
 * kỳ (thứ tự bên trong mỗi chu kỳ vẫn NGẪU NHIÊN, chỉ đảm bảo KHÔNG THIẾU/KHÔNG THỪA hình thái nào
 * trong 1 chu kỳ) — thuật toán Fisher-Yates chuẩn khi túi cạn.
 *
 * SỬA (27/08/2026, phản hồi Giang — "cho phép các hình thái thiên hà ở trong bag tạo", tức người
 * dùng bật/tắt TỪNG hình thái qua Custom Effect, `customEffect.space.enabledGalaxyTypes`) — thêm
 * tham số `enabledTypes`: túi giờ chỉ xoay vòng trong tập ĐANG BẬT (KHÔNG còn cố định
 * `SPACE_GALAXY_TYPES` toàn bộ 10 loại). Túi nhận vào được LỌC LẠI theo `enabledTypes` NGAY ĐẦU
 * hàm (không chỉ lúc nạp đầy) — nếu người dùng vừa tắt bớt 1 hình thái, phần tử thừa (thuộc hình
 * thái vừa tắt) còn sót trong túi cũ bị loại bỏ ngay, không phải đợi hết 1 chu kỳ mới "sạch".
 * @param {string[]} bag - túi hiện tại (Workflow tự lưu trong STATE, truyền vào đây mỗi lần gọi) —
 *   rỗng hoặc `null`/`undefined` thì tự nạp lại đầy + xáo trộn.
 * @param {string[]} [enabledTypes] - tập hình thái ĐANG BẬT — rỗng/`null`/`undefined` thì dùng
 *   toàn bộ `SPACE_GALAXY_TYPES` (an toàn nếu người dùng lỡ tắt hết, xem Workflow gọi hàm này).
 * @returns {{type: string, remainingBag: string[]}}
 */
function pickGalaxyTypeFromBag(bag, enabledTypes) {
    const pool = (enabledTypes && enabledTypes.length > 0) ? enabledTypes : SPACE_GALAXY_TYPES;
    let currentBag = (bag || []).filter((t) => pool.includes(t));
    if (currentBag.length === 0) {
        currentBag = pool.slice();
        for (let i = currentBag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = currentBag[i]; currentBag[i] = currentBag[j]; currentBag[j] = tmp;
        }
    }
    const type = currentBag.pop();
    return { type, remainingBag: currentBag };
}

/** Sinh tên ngẫu nhiên kiểu "Messier Prime-482". */
function generateRandomGalaxyName() {
    const p = SPACE_GALAXY_NAME_PREFIXES[Math.floor(Math.random() * SPACE_GALAXY_NAME_PREFIXES.length)];
    const s = SPACE_GALAXY_NAME_SUFFIXES[Math.floor(Math.random() * SPACE_GALAXY_NAME_SUFFIXES.length)];
    const r = Math.floor(Math.random() * 900) + 100;
    return `${p} ${s}-${r}`;
}

/**
 * Palette (colorIn/colorOut) — FIX (21/07/2026, phản hồi Giang lượt 2, mục 4 — "vẫn chưa áp dụng
 * chế độ màu... đã bảo phải theo setting"): bản trước vẫn còn NGOẠI LỆ cho 5/10 hình thái
 * (Elliptical/Lenticular/Cartwheel/Sombrero/Peculiar dùng `SPACE_GALAXY_SPECIAL_PALETTES` CỐ ĐỊNH,
 * phớt lờ `mode`) — vì `pickGalaxyType()` chọn ĐỀU NGẪU NHIÊN trong 10 hình thái, ~50% thiên hà
 * hiển thị ra sẽ KHÔNG BAO GIỜ đổi màu theo setting, đúng triệu chứng Giang báo. BỎ HẲN ngoại lệ
 * đó — MỌI hình thái, KHÔNG trừ ai, đều theo `vizConfig.mode`: 'solid' dùng `solidColor` (cho cả
 * colorIn/colorOut, đúng bản chất "1 màu duy nhất" mọi visual khác áp dụng), còn lại dùng
 * `dynA`/`dynB` ('gradient' còn hue-shift theo `globalHueOffset` mỗi frame, xem
 * `SpaceGalaxy.update()`, KHÔNG đụng ở hàm này). `SPACE_GALAXY_SPECIAL_PALETTES` ở trên GIỮ
 * LẠI trong file nhưng KHÔNG còn được dùng cho MÀU nữa (không xoá hẳn — có thể tái dùng sau này
 * cho mục đích khác, ví dụ tô điểm hình dạng theo hình thái, KHÔNG liên quan màu sắc người dùng
 * chọn).
 * @param {string} mode @param {string} solidColor @param {string} dynA @param {string} dynB
 * @returns {{in: string, out: string}}
 */
function pickGalaxyPalette(mode, solidColor, dynA, dynB) {
    if (mode === 'solid') return { in: solidColor, out: solidColor };
    return { in: dynA, out: dynB };
}

/**
 * Hệ số tốc độ trôi dạt (nhân vào `SPACE_GALAXY_DRIFT_MAX_SPEED`) — MỚI (21/07/2026, phản hồi
 * Giang — "tốc độ di chuyển tự thân thiên hà làm 1 phổ số ngẫu nhiên dựa trên dải FFT bin audio
 * tại thời điểm nó xuất hiện", tham khảo cách Vortex đọc `vizDataArray[idx % bufferLength]` theo
 * từng ring/bar riêng). Lấy TRUNG BÌNH 1 dải bin (`binIndex` ± `binSpread`) trong phổ FFT hiện có
 * — Workflow tự chọn `binIndex` (thường theo thứ tự spawn, đảm bảo mỗi thiên hà "bốc" 1 vùng phổ
 * khác nhau) rồi gọi hàm THUẦN này — SNAPSHOT 1 LẦN lúc spawn (one-shot), KHÔNG đổi lại sau đó,
 * cùng tinh thần với `densityRatio`/`starsCount` ở `_spawnGalaxyNodeMembers()`.
 * @param {Uint8Array} vizDataArray @param {number} binIndex @param {number} binSpread
 * @returns {number} 0.3 - 1.6
 */
function computeGalaxyDriftSpeedFactor(vizDataArray, binIndex, binSpread) {
    let sum = 0, count = 0;
    for (let i = binIndex - binSpread; i <= binIndex + binSpread; i++) {
        if (i < 0 || i >= vizDataArray.length) continue;
        sum += vizDataArray[i]; count++;
    }
    const avg = count > 0 ? sum / count : 0;
    return 0.3 + (avg / 255) * 1.3;
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
// 5. MÔ HÌNH CỤM THIÊN HÀ — toạ độ tâm cụm + phân tán thiên hà thành viên quanh tâm cụm (VIẾT LẠI
// HOÀN TOÀN 26/08/2026 — xem đầu file. Thay hẳn "nút bản đồ TĨNH" + "bẻ lái theo nốt" cũ.)
// ============================================================================================

/**
 * Hệ trục cục bộ (phải/trên) TỪ hướng nhìn hiện tại `forward` — dùng để dựng ma trận hướng camera
 * ổn định (`applyStableSpaceOrientation()`), THAY `Object3D.lookAt()` (nguồn gây "hard cut" khi
 * `forward` gần thẳng đứng). Guard: khi `forward` gần như thẳng đứng, `cross(forward, worldUp)`
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
 * Toạ độ TÂM 1 cụm thiên hà MỚI — MỚI (26/08/2026, mô hình cụm) — 1 điểm ngẫu nhiên trong lớp vỏ
 * cầu [distMin, distMax] quanh `originPos` (thường là vị trí camera hiện tại lúc cần tái tạo 5
 * cụm, xem `event/workflow/visualizer-render.js::_spawnClusterBatch()`). Phân bố ĐỀU trên hướng
 * (toạ độ cầu ngẫu nhiên thật) — khoảng cách CHỈ giới hạn trong [distMin, distMax], KHÔNG cần lệch
 * mật độ về tâm như bản đồ TĨNH cũ ĐÃ BỎ (chỉ 5 cụm rời rạc, không cần lấp đầy cả khối cầu lớn).
 * @param {THREE.Vector3} originPos @param {number} distMin @param {number} distMax
 * @returns {THREE.Vector3}
 */
function generateSpaceClusterCenterPosition(originPos, distMin, distMax) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const dist = distMin + Math.random() * (distMax - distMin);
    return new THREE.Vector3(
        originPos.x + dist * Math.sin(phi) * Math.cos(theta),
        originPos.y + dist * Math.sin(phi) * Math.sin(theta),
        originPos.z + dist * Math.cos(phi)
    );
}

/**
 * Offset ngẫu nhiên (phân tán quanh 1 tâm) — bán kính lấy ngẫu nhiên trong [radiusMin, radiusMax].
 * ĐỔI TÊN + THAM SỐ HOÁ (26/08/2026, trước `computeGalaxyMemberOffset()`, bán kính CỐ ĐỊNH
 * 40-85) — giờ dùng CHUNG cho CẢ (1) rải các thiên hà thành viên quanh TÂM 1 cụm (radiusMin/Max
 * lớn, theo `customEffect.space.clusterSpreadRadius`) LẪN (2) lệch nhẹ điểm hạ cánh B khi bay tới
 * gần đúng tâm 1 thiên hà cụ thể (radiusMin/Max nhỏ, hằng số cố định — xem
 * event/workflow/visualizer-render.js).
 * @param {number} radiusMin @param {number} radiusMax
 * @returns {THREE.Vector3}
 */
function computeSpaceRandomOffset(radiusMin, radiusMax) {
    const dispRadius = radiusMin + Math.random() * (radiusMax - radiusMin);
    const angle = Math.random() * Math.PI * 2;
    const elevation = (Math.random() - 0.5) * Math.PI * 0.5;
    return new THREE.Vector3(
        Math.cos(angle) * Math.cos(elevation) * dispRadius,
        Math.sin(elevation) * dispRadius,
        Math.sin(angle) * Math.cos(elevation) * dispRadius
    );
}

// ============================================================================================
// 6. class SpaceGalaxy (ĐỔI TÊN 26/08/2026, trước `GalaxyCluster` — khớp nghĩa thiên văn thật:
// 1 instance = 1 THIÊN HÀ, KHÔNG phải 1 cụm; "cụm" giờ là khái niệm RIÊNG, xem mục 5 phía trên +
// event/workflow/visualizer-render.js). Method KHÔNG gọi lẫn nhau (xem đầu file) — HÀNH VI bên
// trong class GIỮ NGUYÊN 100%, chỉ đổi tên.
// ============================================================================================

class SpaceGalaxy {
    /**
     * Constructor CHỈ gán field thuần — KHÔNG tự gọi build()/buildNebula() (Workflow tự gọi 2
     * method đó RIÊNG, theo đúng thứ tự, ngay sau khi `new`).
     * @param {number} driftSpeedFactor - MỚI (21/07/2026, phản hồi Giang mục audio — "tốc độ di
     *   chuyển tự thân thiên hà làm 1 phổ số ngẫu nhiên dựa trên dải FFT bin audio tại thời điểm
     *   nó xuất hiện") — hệ số 0.3-1.6 nhân vào biên độ trôi dạt, Workflow tự tính SẴN từ 1 dải bin
     *   `vizDataArray` TẠI THỜI ĐIỂM SPAWN (xem `computeGalaxyDriftSpeedFactor()` + gọi tại
     *   `event/workflow/visualizer-render.js::_spawnGalaxyNodeMembers()`), "bake" 1 lần vào đây,
     *   KHÔNG đổi lại sau đó — cùng tinh thần snapshot với `starsCount`/`densityRatio`.
     */
    constructor(position, index, name, type, radius, starsCount, rotationDir, rotationSpeed, rotation, driftSpeedFactor) {
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
            (Math.random() - 0.5) * SPACE_GALAXY_DRIFT_MAX_SPEED * driftSpeedFactor,
            (Math.random() - 0.5) * SPACE_GALAXY_DRIFT_MAX_SPEED * driftSpeedFactor,
            (Math.random() - 0.5) * SPACE_GALAXY_DRIFT_MAX_SPEED * driftSpeedFactor
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
     * này cho TỪNG thiên hà trong vòng lặp (`event/workflow/visualizer-render.js`).
     * @param {number} delta - giây kể từ frame trước
     * @param {number} speed - tốc độ chung (BPM baseline + energy), dùng CHUNG cho trôi dạt/tự
     *        quay sao (uSpeed)/quay nebula.
     * @param {number} globalTime - đồng hồ tích luỹ (giây), feed vào uTime cho xoay Keplerian.
     * @param {number} hueShift - độ lệch hue (0 nếu mode không phải dynamic/gradient).
     * @param {number} smoothedEnergy - cộng thêm vào độ sáng nebula.
     * @param {number} fadeOutMultiplier - MỚI (26/08/2026, phản hồi Giang — cụm thiên hà "có thể
     *   tan đi... theo nhạc", KHÔNG biến mất đột ngột) — 1 = hiện đầy đủ (cụm đang 'in'/'stable'),
     *   giảm dần về 0 khi cụm chứa thiên hà này đang ở trạng thái 'out' (Workflow tự tính từ
     *   `cluster.fadeProgress`, xem `_advanceClusterFades()`) — NHÂN THẲNG vào opacity, cùng cơ
     *   chế với `fadeInProgress` (2 hệ số độc lập, nhân dồn).
     */
    update(delta, speed, globalTime, hueShift, smoothedEnergy, fadeOutMultiplier) {
        const speedMult = delta * speed * 0.45;
        this.position.addScaledVector(this.driftVelocity, speedMult);
        this.group.position.copy(this.position);

        if (this.fadeInProgress < 1.0) {
            this.fadeInProgress = Math.min(1.0, this.fadeInProgress + delta * 0.75);
        }

        if (this.material && this.material.uniforms) {
            this.material.uniforms.uTime.value = globalTime;
            this.material.uniforms.uSpeed.value = speed;
            this.material.uniforms.uOpacity.value = 0.9 * this.fadeInProgress * fadeOutMultiplier;
            this.material.uniforms.uHueShift.value = hueShift;
        }

        if (this.nebulaMesh) {
            this.nebulaMesh.rotation.y += this.rotationDir * this.rotationSpeed * delta * 0.08 * speed;
            if (this.nebulaMaterial) {
                this.nebulaMaterial.opacity = (0.32 + smoothedEnergy * 0.2) * this.fadeInProgress * fadeOutMultiplier;
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
// 7. SpaceDust — bụi vũ trụ nền, KHÔNG cần "cụm nhiều instance" như SpaceGalaxy nên KHÔNG cần
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
