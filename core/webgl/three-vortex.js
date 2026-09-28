/**
 * DỜI (19/07/2026, yêu cầu Giang) — file này TRƯỚC ĐÂY ở `core/three-vortex.js`, giờ chuyển vào
 * `core/webgl/three-vortex.js` (thư mục webgl/ gom các engine khởi tạo
 * Three.js) — NỘI DUNG KHÔNG ĐỔI GÌ khác ngoài đường dẫn. Giang cần XOÁ TAY file cũ
 * `core/three-vortex.js` (không tự xoá qua patch). Cập nhật `<script src="...">` tương ứng trong
 * index.html — xem thứ tự nạp GIỮ NGUYÊN như cũ.
 *
 * Hằng số & toàn bộ hàm khởi tạo / cập nhật Vortex Engine bằng Three.js (đường ống tunnel, particles, rings, bars, waves).
 * (Trích từ file gốc, dòng 100-272 trong khối <script>)
 */
        let tWarpSpeed = 0; // biến NỘI BỘ (không thuộc STATE) — chỉ dùng trong drawVortex()
        const TUNNEL_DEPTH = 3000;

        // ============================================================================================
        // [VIẾT LẠI — 25/09/2026, Giang báo "tham số bị ghi tịnh tiến, va đập, liên tục đổi hướng gây
        // loạn màn hình"] Đường ống giờ tính theo TOẠ ĐỘ TƯƠNG ĐỐI camera, không còn theo z tuyệt đối.
        //
        // Nguyên nhân cũ: tâm ống = sin(z·freq + phase)·amp với z = tCurrentWarpZ giảm MÃI (camera bay
        // tới trước, không bao giờ reset) — vài phút là |z| lên hàng trăm nghìn/triệu. Mỗi lần rẽ, freq
        // bị jitter rồi lerp dần: lệch freq chỉ 0.0001 nhân |z| = 1.000.000 đã ra 100 rad -> suốt lúc
        // lerp, pha tại camera quay hàng chục vòng -> ống quất qua lại loạn màn hình, và CÀNG CHẠY LÂU
        // CÀNG NẶNG. phaseX/phaseY target cũng giải theo -z·freq (số tuyệt đối khổng lồ). Camera damping
        // 0.045 không đuổi kịp -> đâm vào lưới kẹp cứng VORTEX_CAMERA_SAFE_RADIUS -> khựng/giật ("va
        // đập"). Pha nền +0.005/frame còn bị lerp kéo ngược lại, cân bằng ở độ lệch cố định ~0.83 rad
        // so với hướng đã chọn (hướng rẽ theo nốt chưa bao giờ đúng).
        //
        // Mô hình mới: d = camZ - z (khoảng cách phía trước camera, luôn trong ~[-200, TUNNEL_DEPTH]),
        // tâm = (sin(phaseX + d·freqX)·ampX, cos(phaseY + d·freqY)·ampY). Mỗi frame camera đi được s thì
        // phase += s·freq (CÙNG lượng cho params và target) -> hình ống vẫn đứng yên trong không gian
        // như cũ, nhưng đổi freq chỉ ảnh hưởng tối đa d·Δfreq (≤ 3000·0.0006 ≈ 1.8 rad ở cuối ống, 0 tại
        // camera) — không còn phụ thuộc thời gian đã bay. phase luôn gói về [0, 2π). Camera đặt ĐÚNG tâm
        // ống (không damping, không cần kẹp) -> hết va đập. Toàn bộ z (camera/ring/bar/wave) được dời về
        // gốc định kỳ (VORTEX_REBASE_Z) — tâm chỉ phụ thuộc camZ - z nên dời gốc không đổi hình gì cả.
        // ============================================================================================

        /** Khoảng nhìn trước của camera (lookAt) — cũng là khoảng dùng để giải pha "bẻ đúng hướng". */
        const VORTEX_LOOK_AHEAD = 800;
        /** Camera bay quá mốc này (theo -z) thì dời gốc toàn bộ scene về 0 — chặn z tịnh tiến vô hạn. */
        const VORTEX_REBASE_Z = 30000;
        /** Tốc độ nội suy hình ống về target mỗi frame (cũ 0.006). Bước pha tối đa π·k ≈ 0.031 rad/frame. */
        const VORTEX_PATH_LERP = 0.01;
        /** Lượt rẽ trước phải hội tụ (lệch pha còn < ngưỡng này, rad) mới nhận lượt rẽ mới — chặn target
         * bị ghi đè liên tục khi nhạc biến động kéo dài (nguyên nhân "liên tục đổi hướng"). */
        const VORTEX_TURN_SETTLE_RAD = 0.25;

        const VORTEX_TWO_PI = Math.PI * 2;
        /** Gói góc về [0, 2π). */
        function wrapVortexAngle(a) {
            return ((a % VORTEX_TWO_PI) + VORTEX_TWO_PI) % VORTEX_TWO_PI;
        }

        /** Tâm ống tại z — THUẦN (SỬA 25/09/2026: nhận params/camZ qua tham số, không tự appState.get()). */
        function getVortexCenterAt(z, params, camZ) {
            const d = camZ - z;
            return {
                x: Math.sin(params.phaseX + d * params.freqX) * params.ampX,
                y: Math.cos(params.phaseY + d * params.freqY) * params.ampY,
            };
        }

        // 8 hướng compass rẽ ống — vector đơn vị dùng để giải phaseX/phaseY mục tiêu.
        const VORTEX_DIRECTION_VECTORS = {
            right:     { x: 1, y: 0 },
            left:      { x: -1, y: 0 },
            up:        { x: 0, y: 1 },
            down:      { x: 0, y: -1 },
            upRight:   { x: 0.7071, y: 0.7071 },
            upLeft:    { x: -0.7071, y: 0.7071 },
            downRight: { x: 0.7071, y: -0.7071 },
            downLeft:  { x: -0.7071, y: -0.7071 },
        };
        const VORTEX_DIRECTION_KEYS = Object.keys(VORTEX_DIRECTION_VECTORS);

        // 12 nốt (chromatic, currentMidi % 12, C..B) -> 1 trong 8 hướng — bảng cố định, tham khảo
        // RUBIK_NOTE_TO_TURN (core/dom-refs.js). 12 không chia hết 8 nên 4 hướng thẳng (G#/A/A#/B)
        // lặp lại, 4 hướng chéo chỉ xuất hiện 1 lần.
        const VORTEX_NOTE_TO_DIRECTION = [
            'right', 'upRight', 'up', 'upLeft', 'left', 'downLeft', 'down', 'downRight', // C..G
            'right', 'up', 'left', 'down',                                              // G#, A, A#, B
        ];

        /** Chọn hướng rẽ theo nốt MIDI TỨC THỜI (`lastValidMidiNote`) — null (chưa detect được
         * pitch) fallback random trong 8 hướng. */
        function pickVortexDirectionFromNote(midiNote) {
            if (midiNote == null) return VORTEX_DIRECTION_KEYS[Math.floor(Math.random() * VORTEX_DIRECTION_KEYS.length)];
            const noteIdx = ((midiNote % 12) + 12) % 12;
            return VORTEX_NOTE_TO_DIRECTION[noteIdx];
        }

        /** Target MỚI cho đường ống khi rẽ — freqX/freqY/ampX/ampY vẫn rung nhẹ ngẫu nhiên (giữ cảm giác
         * hữu cơ). SỬA (25/09/2026): phaseX/phaseY giải sao cho đoạn ống từ camera tới điểm nhìn
         * (VORTEX_LOOK_AHEAD) BẺ ĐÚNG hướng trên màn hình — bẻ phải = x(look) - x(0) lớn nhất:
         * sin(φ+a) - sin φ = 2cos(φ+a/2)sin(a/2) -> φ = -a/2 (trái: π - a/2); bẻ lên = y(look) - y(0)
         * lớn nhất: cos(φ+b) - cos φ = -2sin(φ+b/2)sin(b/2) -> φ = -π/2 - b/2 (xuống: π/2 - b/2), với
         * a = freqX·look, b = freqY·look. Không còn phụ thuộc z hiện tại (bản cũ giải theo -z·freq nên
         * pha là số tuyệt đối khổng lồ và "hướng" lại là vị trí tâm tại camera — camera bám tâm nên thực
         * tế không nhìn ra hướng đó). Thuần — Workflow tự đọc tPathTarget rồi ghi kết quả. */
        function computeVortexCurveTarget(currentTarget, direction) {
            const jitter = (base, range) => base + (Math.random() - 0.5) * range;
            const vec = VORTEX_DIRECTION_VECTORS[direction] || VORTEX_DIRECTION_VECTORS.right;
            const freqX = Math.max(0.0004, Math.min(0.0022, jitter(currentTarget.freqX, 0.0006)));
            const freqY = Math.max(0.0004, Math.min(0.0022, jitter(currentTarget.freqY, 0.0006)));
            const ampX = Math.max(180, Math.min(620, jitter(currentTarget.ampX, 160)));
            const ampY = Math.max(130, Math.min(470, jitter(currentTarget.ampY, 120)));
            const a = freqX * VORTEX_LOOK_AHEAD, b = freqY * VORTEX_LOOK_AHEAD;
            // SỬA (28/09/2026, Phase 5 — không core gọi core): trả pha CHƯA quấn về [0, 2π) — Workflow quấn qua
            // wrapVortexAngle() (event/workflow/visualizer/vortex.js::_wrapPathPhases()).
            const phaseX = vec.x === 0 ? currentTarget.phaseX : (vec.x > 0 ? -a / 2 : Math.PI - a / 2);
            const phaseY = vec.y === 0 ? currentTarget.phaseY : (vec.y > 0 ? -Math.PI / 2 - b / 2 : Math.PI / 2 - b / 2);
            return { freqX, freqY, ampX, ampY, phaseX, phaseY };
        }

        /** Lệch NGẮN NHẤT theo chu kỳ 2π giữa 2 góc — vd 0.1 và 6.2 lệch nhau ~0.18, không phải ~6.1. */
        function shortestAngleDelta(from, to) {
            let d = (to - from) % VORTEX_TWO_PI;
            if (d > Math.PI) d -= VORTEX_TWO_PI;
            if (d < -Math.PI) d += VORTEX_TWO_PI;
            return d;
        }

        /** 1 bước hình ống — THUẦN (THAY `updateVortexCurveLerp()` cũ, vốn tự appState.get/mutate).
         * `travel` = quãng camera vừa bay frame này (tWarpSpeed). Pha của CẢ params lẫn target cùng tiến
         * travel·freq(params) -> hình ống đứng yên trong không gian, khoảng cách tới target chỉ còn đúng
         * phần "đang rẽ" và được lerp dần. Bỏ pha nền +0.005/frame cũ (bị lerp kéo ngược nên không tạo
         * chuyển động thật, chỉ làm lệch hướng rẽ). @returns {{params:object, target:object}} */
        // SỬA (28/09/2026, Phase 5 — không core gọi core): nhận SẴN độ lệch pha ngắn nhất `deltaX/deltaY`
        // (shortestAngleDelta(params.phaseX, target.phaseX) — Workflow tính trước) và trả pha CHƯA quấn (Workflow quấn
        // qua wrapVortexAngle()). Công thức giữ nguyên.
        function computeNextVortexPath(params, target, travel, deltaX, deltaY) {
            const k = VORTEX_PATH_LERP;
            const advX = travel * params.freqX;
            const advY = travel * params.freqY;
            return {
                params: {
                    freqX: params.freqX + (target.freqX - params.freqX) * k,
                    freqY: params.freqY + (target.freqY - params.freqY) * k,
                    ampX: params.ampX + (target.ampX - params.ampX) * k,
                    ampY: params.ampY + (target.ampY - params.ampY) * k,
                    phaseX: params.phaseX + advX + deltaX * k,
                    phaseY: params.phaseY + advY + deltaY * k,
                },
                target: { ...target, phaseX: target.phaseX + advX, phaseY: target.phaseY + advY },
            };
        }

        /** Lượt rẽ hiện tại đã hội tụ chưa (lệch pha lớn nhất < `tolRad`) — THUẦN. */
        // SỬA (28/09/2026, Phase 5 — không core gọi core): nhận SẴN 2 độ lệch pha (shortestAngleDelta(), Workflow tính).
        function isVortexTurnSettled(deltaX, deltaY, tolRad) {
            return Math.max(Math.abs(deltaX), Math.abs(deltaY)) < tolRad;
        }

        // [TÁCH — 28/09/2026, Phase 5 dọn visualizer] initThreeJS()/updateVortexVisibility()/updateThreeJSColors() ĐÃ BỎ:
        // initThreeJS() đọc/ghi appState, tự tạo renderer dùng chung, gọi getEffectConfig() + 2 core khác; updateVortexVisibility()
        // đọc appState + config. Nay: 3 core THUẦN dưới đây (builder three.js được ở core — Giang chốt 28/09/2026), điều phối
        // (đọc config, tạo renderer dùng chung, ghi appState, ẩn/hiện theo style) ở event/workflow/visualizer/vortex.js.

        /** Dựng TOÀN BỘ scene Vortex (3 nhóm mesh rings/bars/wave + camera) — thuần: chỉ nhận số lượng + tỉ lệ khung,
         * trả object, không đụng appState/renderer. Công thức/thứ tự tạo giữ nguyên initThreeJS() cũ. */
        function buildVortexScene(tunnelRingCount, barsRingCount, barsPerRing, aspect) {
            const scene = new THREE.Scene();
            scene.fog = new THREE.FogExp2(0x000000, 0.0006); // Sương mù tạo chiều sâu fade
            const camera = new THREE.PerspectiveCamera(75, aspect, 1, TUNNEL_DEPTH);
            camera.position.set(0, 0, 0);

            const groupRings = new THREE.Group();
            const rings = [];
            const ringGeo = new THREE.TorusGeometry(350, 6, 8, 48);
            for (let i = 0; i < tunnelRingCount; i++) {
                const z = -(i / tunnelRingCount) * TUNNEL_DEPTH;
                const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
                const mesh = new THREE.Mesh(ringGeo, mat);
                mesh.position.z = z;
                mesh.userData = { initialZ: z };
                rings.push(mesh);
                groupRings.add(mesh);
            }
            scene.add(groupRings);

            const groupBars = new THREE.Group();
            const barGeo = new THREE.BoxGeometry(15, 15, 60);
            barGeo.translate(0, 7.5, 0);
            const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
            const barsMesh = new THREE.InstancedMesh(barGeo, barMat, barsRingCount * barsPerRing);
            const barRingZs = [];
            for (let r = 0; r < barsRingCount; r++) barRingZs.push(-(r / barsRingCount) * TUNNEL_DEPTH);
            const dummy = new THREE.Object3D();
            for (let r = 0; r < barsRingCount; r++) {
                const z = barRingZs[r];
                for (let b = 0; b < barsPerRing; b++) {
                    const ang = (b / barsPerRing) * Math.PI * 2;
                    dummy.position.set(Math.cos(ang) * 350, Math.sin(ang) * 350, z);
                    dummy.rotation.set(0, 0, ang - Math.PI / 2);
                    dummy.updateMatrix();
                    barsMesh.setMatrixAt(r * barsPerRing + b, dummy.matrix);
                }
            }
            groupBars.add(barsMesh);
            scene.add(groupBars);

            const groupWaves = new THREE.Group();
            const waveMeshes = [];
            const waveGeo = new THREE.TorusGeometry(300, 40, 12, 48);
            const waveCount = 20;
            for (let i = 0; i < waveCount; i++) {
                const z = -(i / waveCount) * TUNNEL_DEPTH;
                const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, wireframe: true, blending: THREE.AdditiveBlending });
                const mesh = new THREE.Mesh(waveGeo, mat);
                mesh.position.z = z;
                mesh.userData = { initialZ: z, rotZOffset: Math.random() * Math.PI };
                waveMeshes.push(mesh);
                groupWaves.add(mesh);
            }
            scene.add(groupWaves);

            return { scene, camera, groupRings, rings, groupBars, barsMesh, barRingZs, groupWaves, waveMeshes };
        }

        /** Chỉ nhóm mesh của style đang chọn được hiện. */
        function applyVortexStyleVisibility(groupRings, groupBars, groupWaves, vortexStyle) {
            groupRings.visible = vortexStyle === 'rings';
            groupBars.visible = vortexStyle === 'bars';
            groupWaves.visible = vortexStyle === 'wave';
        }
