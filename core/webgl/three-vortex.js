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

        // Bán kính an toàn CỨNG cho camera — nhỏ hơn mép trong của style hẹp nhất (wave: 300−40=260,
        // rings/bars: 350) — đảm bảo camera KHÔNG BAO GIỜ văng ra ngoài thành ống dù damping có lag
        // tới đâu (mục "loại bỏ hoàn toàn va đập thành ống", phản hồi Giang).
        const VORTEX_CAMERA_SAFE_RADIUS = 200;

        /** Kẹp cứng offset camera khỏi tâm ống về trong `safeRadius` — khác `updateVortexCurveLerp()`
         * (làm camera đuổi theo tâm MƯỢT nhưng không có gì chặn khi tâm di chuyển nhanh hơn tốc độ
         * đuổi), hàm này là LƯỚI AN TOÀN CUỐI — luôn đảm bảo camera nằm trong ống bất kể mọi lag. */
        function clampVortexCameraOffset(cameraX, cameraY, centerX, centerY, safeRadius) {
            const dx = cameraX - centerX;
            const dy = cameraY - centerY;
            const dist = Math.hypot(dx, dy);
            if (dist <= safeRadius) return { x: cameraX, y: cameraY };
            const scale = safeRadius / dist;
            return { x: centerX + dx * scale, y: centerY + dy * scale };
        }

        // Tính toán tọa độ tâm của ống hầm tại một điểm Z bất kỳ
        function getVortexCenterAt(z) {
            const params = appState.get('tPathParams');
            return {
                x: Math.sin(z * params.freqX + params.phaseX) * params.ampX,
                y: Math.cos(z * params.freqY + params.phaseY) * params.ampY
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

        /** Target MỚI cho đường ống khi rẽ — freqX/freqY/ampX/ampY vẫn rung nhẹ ngẫu nhiên (giữ
         * cảm giác hữu cơ), riêng phaseX/phaseY GIẢI THEO HƯỚNG (không random) để ống bẻ rõ về
         * đúng hướng compass ứng với nốt nhạc, TẠI z hiện tại của camera (`currentZ`, truyền vào =
         * tCurrentWarpZ lúc gọi). Thuần — không appState, Workflow tự đọc tPathTarget/
         * tCurrentWarpZ rồi ghi kết quả trả về. */
        function computeVortexCurveTarget(currentTarget, direction, currentZ) {
            const jitter = (base, range) => base + (Math.random() - 0.5) * range;
            const vec = VORTEX_DIRECTION_VECTORS[direction] || VORTEX_DIRECTION_VECTORS.right;
            const freqX = Math.max(0.0004, Math.min(0.0022, jitter(currentTarget.freqX, 0.0006)));
            const freqY = Math.max(0.0004, Math.min(0.0022, jitter(currentTarget.freqY, 0.0006)));
            const ampX = Math.max(180, Math.min(620, jitter(currentTarget.ampX, 160)));
            const ampY = Math.max(130, Math.min(470, jitter(currentTarget.ampY, 120)));
            const phaseX = vec.x === 0 ? currentTarget.phaseX : (vec.x > 0 ? Math.PI / 2 : -Math.PI / 2) - currentZ * freqX;
            const phaseY = vec.y === 0 ? currentTarget.phaseY : (vec.y > 0 ? 0 : Math.PI) - currentZ * freqY;
            return { freqX, freqY, ampX, ampY, phaseX, phaseY };
        }

        // Nội suy mượt mà hình dáng ống
        /** Lệch NGẮN NHẤT theo chu kỳ 2π giữa 2 góc — vd 0.1 và 6.2 (≈2π-0.08) lệch nhau chỉ
         * ~0.18, KHÔNG phải ~6.1 nếu trừ thẳng. Chặn phaseX/phaseY nhảy số tuyệt đối (mục 2, phản
         * hồi Giang — target.phaseX giải theo z hiện tại nên là số tuyệt đối lớn dần theo thời
         * gian, trừ thẳng sẽ ra hiệu số khổng lồ). */
        function shortestAngleDelta(from, to) {
            const twoPi = Math.PI * 2;
            let d = (to - from) % twoPi;
            if (d > Math.PI) d -= twoPi;
            if (d < -Math.PI) d += twoPi;
            return d;
        }

        function updateVortexCurveLerp() {
            const k = 0.006;
            const target = appState.get('tPathTarget');
            appState.mutate('tPathParams', params => {
                params.freqX += (target.freqX - params.freqX) * k;
                params.freqY += (target.freqY - params.freqY) * k;
                params.ampX += (target.ampX - params.ampX) * k;
                params.ampY += (target.ampY - params.ampY) * k;
                // Rẽ theo hướng (phaseX/phaseY, computeVortexCurveTarget()) — nội suy theo lệch
                // NGẮN NHẤT (không trừ thẳng số tuyệt đối), bước tối đa mỗi frame bị chặn ở ±π·k
                // (~0.019 rad/frame) dù target lệch bao xa — không còn giật/nhảy khi rẽ.
                params.phaseX += shortestAngleDelta(params.phaseX, target.phaseX) * k;
                params.phaseY += shortestAngleDelta(params.phaseY, target.phaseY) * k;
                // Tiến pha nền để ống luôn "sống" NGAY CẢ giữa 2 lần rẽ (không có target mới).
                params.phaseX += 0.005;
                params.phaseY += 0.005;
            }, { skipCheck: true });
        }

        function initThreeJS() {
            if (appState.get('tInitialized') && appState.get('tScene')) { const sc = appState.get('tScene'); while(sc.children.length > 0){ sc.remove(sc.children[0]); } }
            
            const tCanvas = document.getElementById('webgl-canvas');
            appState.set('tScene', new THREE.Scene(), { skipCheck: true });
            appState.get('tScene').fog = new THREE.FogExp2(0x000000, 0.0006); // Sương mù tạo chiều sâu fade

            appState.set('tCamera', new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, TUNNEL_DEPTH), { skipCheck: true });
            appState.get('tCamera').position.set(0, 0, 0);

            if(!appState.get('tRenderer')) {
                appState.set('tRenderer', new THREE.WebGLRenderer({ canvas: tCanvas, alpha: true, antialias: true }), { skipCheck: true });
                appState.get('tRenderer').setPixelRatio(window.devicePixelRatio);
            }
            appState.get('tRenderer').setSize(window.innerWidth, window.innerHeight);

            const tunnelRingCount = getEffectConfig('vortex').tunnelRingCount; // core/custom-effect.js
            const vortexCfg = getEffectConfig('vortex');
            const barsRingCount = vortexCfg.barsRingCount, barsPerRing = vortexCfg.barsPerRing;
            // Nhóm 1: Vòng Ring
            appState.set('tGroupRings', new THREE.Group(), { skipCheck: true });
            appState.set('tRings', [], { skipCheck: true });
            const ringGeo = new THREE.TorusGeometry(350, 6, 8, 48);
            for(let i=0; i<tunnelRingCount; i++) {
                const z = -(i / tunnelRingCount) * TUNNEL_DEPTH;
                const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending });
                const mesh = new THREE.Mesh(ringGeo, mat);
                mesh.position.z = z;
                mesh.userData = { initialZ: z };
                appState.mutate('tRings', arr => arr.push(mesh), { skipCheck: true });
                appState.get('tGroupRings').add(mesh);
            }
            appState.get('tScene').add(appState.get('tGroupRings'));

            // Nhóm 2: Đoạn Bar 3D (InstancedMesh)
            appState.set('tGroupBars', new THREE.Group(), { skipCheck: true });
            const barGeo = new THREE.BoxGeometry(15, 15, 60);
            // Dời tâm khối hộp lên một chút để scaleY mọc ra ngoài thay vì ra 2 hướng
            barGeo.translate(0, 7.5, 0); 
            const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
            const totalBars = barsRingCount * barsPerRing;
            appState.set('tBarsMesh', new THREE.InstancedMesh(barGeo, barMat, totalBars), { skipCheck: true });
            
            // Vị trí Z ban đầu của từng vòng bar — dùng sliding window giống tRings, tránh trôi lệch theo thời gian
            appState.set('tBarRingZs', [], { skipCheck: true });
            for(let r=0; r<barsRingCount; r++) appState.mutate('tBarRingZs', arr => arr.push(-(r / barsRingCount) * TUNNEL_DEPTH), { skipCheck: true });

            const dummy = new THREE.Object3D();
            const tBarsMesh = appState.get('tBarsMesh');
            const tBarRingZs = appState.get('tBarRingZs');
            for(let r=0; r<barsRingCount; r++) {
                const z = tBarRingZs[r];
                for(let b=0; b<barsPerRing; b++) {
                    const ang = (b / barsPerRing) * Math.PI * 2;
                    dummy.position.set(Math.cos(ang) * 350, Math.sin(ang) * 350, z);
                    // Xoay hộp hướng tâm
                    dummy.rotation.set(0, 0, ang - Math.PI/2); 
                    dummy.updateMatrix();
                    tBarsMesh.setMatrixAt(r * barsPerRing + b, dummy.matrix);
                }
            }
            appState.get('tGroupBars').add(tBarsMesh);
            appState.get('tScene').add(appState.get('tGroupBars'));

            // Nhóm 3: Nhiễu động sóng (Wave/Fade)
            appState.set('tGroupWaves', new THREE.Group(), { skipCheck: true });
            appState.set('tWaveMeshes', [], { skipCheck: true });
            const waveGeo = new THREE.TorusGeometry(300, 40, 12, 48);
            const waveCount = 20;
            for(let i=0; i<waveCount; i++) {
                const z = -(i / waveCount) * TUNNEL_DEPTH;
                // Wireframe với Additive Blending tạo hiệu ứng mờ ảo
                const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, wireframe: true, blending: THREE.AdditiveBlending });
                const mesh = new THREE.Mesh(waveGeo, mat);
                mesh.position.z = z;
                mesh.userData = { initialZ: z, rotZOffset: Math.random() * Math.PI };
                appState.mutate('tWaveMeshes', arr => arr.push(mesh), { skipCheck: true });
                appState.get('tGroupWaves').add(mesh);
            }
            appState.get('tScene').add(appState.get('tGroupWaves'));

            appState.set('tCurrentWarpZ', 0, { skipCheck: true });
            appState.set('tInitialized', true, { skipCheck: true });
            updateThreeJSColors();
            updateVortexVisibility();
        }

        function updateVortexVisibility() {
            if(!appState.get('tInitialized')) return;
            const vortexStyle = getEffectConfig('vortex').vortexStyle; // core/custom-effect.js
            appState.get('tGroupRings').visible = (vortexStyle === 'rings');
            appState.get('tGroupBars').visible = (vortexStyle === 'bars');
            appState.get('tGroupWaves').visible = (vortexStyle === 'wave');
        }

        function updateThreeJSColors() {
            if(!appState.get('tInitialized')) return;
            // Sẽ được gọi trong frame render để làm màu động, ở đây chỉ để reset
        }
