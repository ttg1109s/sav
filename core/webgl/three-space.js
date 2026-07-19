/**
 * Hằng số & hàm khởi tạo/cập nhật "Drifting Space" Engine bằng Three.js — trôi giữa các thiên thể
 * (hành tinh/ngôi sao/dải ngân hà), sao băng/thiên thạch xuất hiện ngẫu nhiên theo năng lượng
 * nhạc, rung nhẹ camera khi "va chạm". Batch mới (19/07/2026, yêu cầu Giang — visualizer "Drifting
 * Space") — CÙNG NHÓM với core/webgl/three-vortex.js (init/scene, xem file đó làm mẫu) +
 * core/visualizer/types/space.js (cập nhật mỗi khung hình, xem file đó). Đặt sẵn ở
 * `core/webgl/` ngay từ đầu (KHÔNG như three-vortex.js phải dời sau) theo đúng yêu cầu gom nhóm
 * "2 file three vào thư mục webgl" của Giang.
 *
 * DÙNG CHUNG 1 WebGL renderer (#webgl-canvas, appState 'tRenderer') với Vortex — 2 kiểu KHÔNG BAO
 * GIỜ active cùng lúc (chỉ 1 vizConfig.type tại 1 thời điểm), nên tái dùng renderer đã tạo (nếu
 * có) y hệt guard `if(!appState.get('tRenderer'))` ở initThreeJS(). Mỗi kiểu tự có Scene/Camera
 * RIÊNG (tiền tố "sp" cho biến STATE của Space, tránh trùng "t*" của Vortex).
 *
 * MIỄN kiến trúc /event/ VÀ Rule 1-5 (core-function-conventions.md) — giống hệt lý do
 * three-vortex.js/vortex.js được miễn: đây là module hiệu ứng nhúng (rendering engine tự chứa,
 * đọc/ghi state trực tiếp mỗi khung hình để né việc phải truyền hàng chục ref qua tham số 60
 * lần/giây) — KHÔNG phải luồng nghiệp vụ người dùng thao tác qua UI (những setter Settings của
 * Space, vd setSpaceGlassFrame(), VẪN đi qua /event/ bình thường — xem core/visualizer/
 * visualizer-display.js).
 *
 * PHẢI nạp SAU: core/config.js (PERFORMANCE_PROFILES), service/state.js (appState),
 * core/audio-analysis.js (getComputedColor() — dùng để tô màu hành tinh/sao/thiên hà/thiên thạch
 * theo ĐÚNG vizConfig.mode, xem readme/visual-conventions.md mục 3 — BẮT BUỘC, không hard-code màu).
 * Chỉ là ĐỊNH NGHĨA hàm ở file này, không gọi ngay lúc parse, nên thứ tự nạp thực tế trong
 * index.html an toàn dù đứng trước audio-analysis.js (giống mọi core/visualizer khác). NẠP TRƯỚC
 * core/visualizer/types/space.js (dùng chung SPACE_SECTOR_KINDS/rollNewSpaceSector()/
 * trySpawnSpaceMeteor()/triggerSpaceCollisionShake() + biến nội bộ spDriftSpeed/spShakeFrames/
 * spShakeMagnitude khai báo ở đây — không có ES6 module, mọi file chia sẻ 1 global scope, xem
 * readme/why-no-es6-module.md).
 */
        const SPACE_DEPTH = 4000;   // khoảng cách trôi tối đa theo trục Z trước khi coi là "rất xa" (giống TUNNEL_DEPTH của Vortex)

        // 3 loại thiên thể xoay vòng khi "sang khu vực khác" — luôn chọn KHÁC loại đang có, xem
        // rollNewSpaceSector() bên dưới.
        const SPACE_SECTOR_KINDS = ['planet', 'star', 'galaxy'];

        let spDriftSpeed = 0;       // biến NỘI BỘ (không thuộc STATE) — tốc độ trôi hiện tại, chỉ dùng trong drawSpace()
        let spShakeFrames = 0;      // số khung hình rung lắc còn lại sau va chạm thiên thạch
        let spShakeMagnitude = 0;   // biên độ rung hiện tại (giảm dần mỗi khung hình)

        /** Dựng 1 hành tinh: khối cầu + 1 lớp khí quyển mờ additive lồng bên ngoài. Màu LẤY THEO
         * vizConfig.mode (item 3, readme/visual-conventions.md — BẮT BUỘC qua getComputedColor(),
         * KHÔNG hard-code) — giống hệt cách Vortex tô màu rings/bars/waves. */
        function _createSpacePlanetMesh(perf) {
            const color = new THREE.Color(getComputedColor(0, 1, Math.round(appState.get('beatScale') * 255)).fill);
            const geo = new THREE.SphereGeometry(140, perf.spaceDetail, perf.spaceDetail);
            const mat = new THREE.MeshBasicMaterial({ color });
            const mesh = new THREE.Mesh(geo, mat);
            const glowGeo = new THREE.SphereGeometry(152, Math.max(8, perf.spaceDetail - 8), Math.max(8, perf.spaceDetail - 8));
            const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, side: THREE.BackSide });
            mesh.add(new THREE.Mesh(glowGeo, glowMat));
            return mesh;
        }

        /** Dựng 1 "ngôi sao": khối cầu phát sáng + quầng sáng lớn additive lồng ngoài (corona).
         * Màu LẤY THEO vizConfig.mode (item 3) — dùng dataValue=255 (khác hành tinh) để 2 loại
         * thiên thể không trùng hệt sắc độ dù cùng qua chung 1 helper màu. */
        function _createSpaceStarMesh(perf) {
            const color = new THREE.Color(getComputedColor(0, 1, 255).fill);
            const geo = new THREE.SphereGeometry(90, perf.spaceDetail, perf.spaceDetail);
            const mat = new THREE.MeshBasicMaterial({ color });
            const mesh = new THREE.Mesh(geo, mat);
            const coronaGeo = new THREE.SphereGeometry(240, Math.max(8, perf.spaceDetail - 8), Math.max(8, perf.spaceDetail - 8));
            const coronaMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, side: THREE.BackSide });
            mesh.add(new THREE.Mesh(coronaGeo, coronaMat));
            return mesh;
        }

        /** Dựng 1 dải ngân hà: đĩa xoắn ốc bằng THREE.Points (kỹ thuật phổ biến — phân bố bán kính
         * ngẫu nhiên + góc xoắn tăng dần theo bán kính). 2 màu core/edge LẤY THEO vizConfig.mode
         * (item 3 — qua getComputedColor(0,2,...)/getComputedColor(1,2,...), giống cách Vortex lấy
         * màu cho từng ring theo idx/totalLength), KHÔNG hard-code amber/blue nữa. */
        function _createSpaceGalaxyPoints(perf) {
            const count = perf.spaceGalaxyStars;
            const positions = new Float32Array(count * 3);
            const colors = new Float32Array(count * 3);
            const colorCore = new THREE.Color(getComputedColor(0, 2, 200).fill);
            const colorEdge = new THREE.Color(getComputedColor(1, 2, 120).fill);
            const arms = 3, spin = 1.4, randomness = 0.35;
            for (let i = 0; i < count; i++) {
                const radius = Math.random() * 380;
                const armAngle = ((i % arms) / arms) * Math.PI * 2;
                const spinAngle = radius * spin * 0.01;
                const jitter = () => Math.pow(Math.random(), 2) * (Math.random() < 0.5 ? 1 : -1) * randomness * radius * 0.3;
                const angle = armAngle + spinAngle;
                positions[i * 3] = Math.cos(angle) * radius + jitter();
                positions[i * 3 + 1] = jitter() * 0.4;
                positions[i * 3 + 2] = Math.sin(angle) * radius + jitter();
                const mixed = colorCore.clone().lerp(colorEdge, radius / 380);
                colors[i * 3] = mixed.r; colors[i * 3 + 1] = mixed.g; colors[i * 3 + 2] = mixed.b;
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            const mat = new THREE.PointsMaterial({ size: 6, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
            return new THREE.Points(geo, mat);
        }

        /** Dựng NGẪU NHIÊN 1 thiên thể mới theo `kind`, đặt tại vị trí Z=`atZ` (phía trước camera,
         * lệch ngang/dọc ngẫu nhiên quanh trục trôi) — dùng chung cho lúc khởi tạo lẫn lúc
         * rollNewSpaceSector(). */
        function _spawnSpaceSectorObject(kind, atZ, perf) {
            let obj;
            if (kind === 'star') obj = _createSpaceStarMesh(perf);
            else if (kind === 'galaxy') obj = _createSpaceGalaxyPoints(perf);
            else obj = _createSpacePlanetMesh(perf);
            const lateral = 260 + Math.random() * 260;
            const angle = Math.random() * Math.PI * 2;
            obj.position.set(Math.cos(angle) * lateral, Math.sin(angle) * lateral * 0.5, atZ);
            obj.userData.kind = kind;
            return obj;
        }

        /** Khởi tạo toàn bộ engine Space: scene/camera/renderer (dùng chung với Vortex)/starfield
         * nền/nhóm thiên thể chính/pool thiên thạch tái sử dụng. Gọi 1 lần lúc chuyển sang kiểu
         * 'space' lần đầu (xem updateTypeUI(), core/visualizer/visualizer-display.js) — y hệt cách
         * initThreeJS() được gọi cho Vortex. */
        function initThreeSpace() {
            if (appState.get('spInitialized') && appState.get('spScene')) {
                const sc = appState.get('spScene');
                while (sc.children.length > 0) sc.remove(sc.children[0]);
            }

            const perf = PERFORMANCE_PROFILES[appState.get('vizConfig').quality];
            const tCanvas = document.getElementById('webgl-canvas');

            appState.set('spScene', new THREE.Scene(), { skipCheck: true });
            appState.get('spScene').fog = new THREE.FogExp2(0x000000, 0.00035);

            appState.set('spCamera', new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, SPACE_DEPTH), { skipCheck: true });
            appState.get('spCamera').position.set(0, 0, 0);

            // Renderer DÙNG CHUNG với Vortex — guard y hệt initThreeJS() (three-vortex.js): chỉ
            // tạo mới nếu Vortex CHƯA từng tạo, vì chỉ có đúng 1 <canvas id="webgl-canvas">.
            if (!appState.get('tRenderer')) {
                appState.set('tRenderer', new THREE.WebGLRenderer({ canvas: tCanvas, alpha: true, antialias: true }), { skipCheck: true });
                appState.get('tRenderer').setPixelRatio(window.devicePixelRatio);
            }
            appState.get('tRenderer').setSize(window.innerWidth, window.innerHeight);

            // Starfield nền tĩnh (Points, bao quanh toàn bộ đường trôi) — mật độ theo quality.
            const starCount = perf.spaceStars;
            const starPositions = new Float32Array(starCount * 3);
            for (let i = 0; i < starCount; i++) {
                starPositions[i * 3] = (Math.random() - 0.5) * 3600;
                starPositions[i * 3 + 1] = (Math.random() - 0.5) * 3600;
                starPositions[i * 3 + 2] = (Math.random() - 0.5) * SPACE_DEPTH * 2;
            }
            const starGeo = new THREE.BufferGeometry();
            starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
            const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
            appState.set('spStarPoints', new THREE.Points(starGeo, starMat), { skipCheck: true });
            appState.get('spScene').add(appState.get('spStarPoints'));

            // Nhóm thiên thể đang "trôi qua" — luôn giữ ĐÚNG 1 thiên thể chính tại 1 thời điểm.
            appState.set('spGroupSector', new THREE.Group(), { skipCheck: true });
            appState.get('spScene').add(appState.get('spGroupSector'));
            const firstKind = SPACE_SECTOR_KINDS[Math.floor(Math.random() * SPACE_SECTOR_KINDS.length)];
            appState.get('spGroupSector').add(_spawnSpaceSectorObject(firstKind, -900, perf));
            appState.set('spSectorKind', firstKind, { skipCheck: true });

            // Pool sao băng/thiên thạch — dựng trước đủ số lượng (theo quality), ẩn hết, TÁI SỬ
            // DỤNG mỗi lần bắn (đúng nguyên tắc "không tạo/xoá mesh liên tục mỗi khung hình" đã áp
            // dụng cho Vortex/Rain — xem core/webgl/three-vortex.js/core/visualizer/types/rain.js).
            appState.set('spGroupMeteors', new THREE.Group(), { skipCheck: true });
            const meteorGeo = new THREE.BoxGeometry(3, 3, 70);
            const meteorPool = [];
            for (let i = 0; i < perf.spaceMeteorPool; i++) {
                const m = new THREE.Mesh(meteorGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
                m.visible = false;
                m.userData = { active: false, life: 0, vx: 0, vy: 0, vz: 0 };
                meteorPool.push(m);
                appState.get('spGroupMeteors').add(m);
            }
            appState.set('spMeteorPool', meteorPool, { skipCheck: true });
            appState.get('spScene').add(appState.get('spGroupMeteors'));

            appState.set('spCurrentDriftZ', 0, { skipCheck: true });
            appState.set('spInitialized', true, { skipCheck: true });
        }

        /** Chọn 1 loại thiên thể MỚI khác loại hiện tại, dựng nó ở phía trước (cách `currentZ` một
         * khoảng xa), xoá thiên thể cũ khỏi nhóm — gọi khi camera trôi gần hết khoảng cách hiện tại
         * HOẶC nhạc đủ mạnh (giống rollNewVortexCurve() của Vortex, xem điều kiện gọi ở
         * core/visualizer/types/space.js::drawSpace()). */
        function rollNewSpaceSector(currentZ, perf) {
            const group = appState.get('spGroupSector');
            while (group.children.length > 0) group.remove(group.children[0]);
            const prevKind = appState.get('spSectorKind');
            let kind = prevKind;
            while (kind === prevKind) kind = SPACE_SECTOR_KINDS[Math.floor(Math.random() * SPACE_SECTOR_KINDS.length)];
            group.add(_spawnSpaceSectorObject(kind, currentZ - 1600, perf));
            appState.set('spSectorKind', kind, { skipCheck: true });
        }

        /** Kích hoạt 1 sao băng/thiên thạch còn RẢNH trong pool (không tạo mesh mới) — xuất hiện ở
         * rìa tầm nhìn, bay cắt chéo qua phía trước camera. Trả về true nếu có slot trống để bắn
         * (pool hết chỗ trống thì bỏ qua lượt này, không ảnh hưởng gì — item 3: "xuất hiện ngẫu
         * nhiên theo tỉ lệ năng lượng", xem xác suất gọi hàm này ở drawSpace()). */
        function trySpawnSpaceMeteor(cameraZ) {
            const pool = appState.get('spMeteorPool');
            const idx = pool.findIndex(m => !m.userData.active);
            if (idx === -1) return false;
            const m = pool[idx];
            const side = Math.random() < 0.5 ? -1 : 1;
            m.position.set(side * (500 + Math.random() * 300), (Math.random() - 0.5) * 500, cameraZ - 700 - Math.random() * 300);
            const speed = 22 + Math.random() * 18;
            m.userData.vx = -side * speed * 1.4;
            m.userData.vy = (Math.random() - 0.5) * 6;
            m.userData.vz = speed * 2.2;
            m.userData.active = true;
            m.userData.life = 1;
            m.material.opacity = 0;
            m.material.color.set(getComputedColor(0, 1, Math.round(appState.get('beatScale') * 255)).fill); // item 3 — theo vizConfig.mode, KHÔNG hard-code
            m.visible = true;
            m.lookAt(m.position.x + m.userData.vx, m.position.y + m.userData.vy, m.position.z + m.userData.vz);
            return true;
        }

        /** Bắt đầu 1 đợt rung camera nhẹ (item 3 — "va chạm gây rung lắc nhẹ cho camera") — biên
         * độ nhỏ, tự tắt dần trong ~18 khung hình (áp dụng ở drawSpace(), core/visualizer/types/
         * space.js). KHÔNG dùng cho bất kỳ mục đích nào khác ngoài va chạm thiên thạch. */
        function triggerSpaceCollisionShake() {
            spShakeFrames = 18;
            spShakeMagnitude = 6 + Math.random() * 5;
        }
