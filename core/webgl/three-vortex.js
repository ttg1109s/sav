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

        const BARS_RINGS_COUNT = 40;
        const BARS_PER_RING = 24;

        // Tính toán tọa độ tâm của ống hầm tại một điểm Z bất kỳ
        function getVortexCenterAt(z) {
            const params = appState.get('tPathParams');
            return {
                x: Math.sin(z * params.freqX + params.phaseX) * params.ampX,
                y: Math.cos(z * params.freqY + params.phaseY) * params.ampY
            };
        }

        // Thay đổi hình dáng uốn lượn của ống (khi có bass) — thay đổi nhẹ nhàng so với target hiện tại,
        // tránh nhảy đột ngột sang một hình dạng hoàn toàn khác gây cảm giác giật khi nội suy.
        function rollNewVortexCurve() {
            const jitter = (base, range) => base + (Math.random() - 0.5) * range;
            appState.mutate('tPathTarget', target => {
                target.freqX = Math.max(0.0004, Math.min(0.0022, jitter(target.freqX, 0.0006)));
                target.freqY = Math.max(0.0004, Math.min(0.0022, jitter(target.freqY, 0.0006)));
                target.ampX = Math.max(180, Math.min(620, jitter(target.ampX, 160)));
                target.ampY = Math.max(130, Math.min(470, jitter(target.ampY, 120)));
            }, { skipCheck: true });
        }

        // Nội suy mượt mà hình dáng ống
        function updateVortexCurveLerp() {
            const k = 0.006;
            const target = appState.get('tPathTarget');
            appState.mutate('tPathParams', params => {
                params.freqX += (target.freqX - params.freqX) * k;
                params.freqY += (target.freqY - params.freqY) * k;
                params.ampX += (target.ampX - params.ampX) * k;
                params.ampY += (target.ampY - params.ampY) * k;
                // Tiến pha để ống luôn "sống"
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
            const totalBars = BARS_RINGS_COUNT * BARS_PER_RING;
            appState.set('tBarsMesh', new THREE.InstancedMesh(barGeo, barMat, totalBars), { skipCheck: true });
            
            // Vị trí Z ban đầu của từng vòng bar — dùng sliding window giống tRings, tránh trôi lệch theo thời gian
            appState.set('tBarRingZs', [], { skipCheck: true });
            for(let r=0; r<BARS_RINGS_COUNT; r++) appState.mutate('tBarRingZs', arr => arr.push(-(r / BARS_RINGS_COUNT) * TUNNEL_DEPTH), { skipCheck: true });

            const dummy = new THREE.Object3D();
            const tBarsMesh = appState.get('tBarsMesh');
            const tBarRingZs = appState.get('tBarRingZs');
            for(let r=0; r<BARS_RINGS_COUNT; r++) {
                const z = tBarRingZs[r];
                for(let b=0; b<BARS_PER_RING; b++) {
                    const ang = (b / BARS_PER_RING) * Math.PI * 2;
                    dummy.position.set(Math.cos(ang) * 350, Math.sin(ang) * 350, z);
                    // Xoay hộp hướng tâm
                    dummy.rotation.set(0, 0, ang - Math.PI/2); 
                    dummy.updateMatrix();
                    tBarsMesh.setMatrixAt(r * BARS_PER_RING + b, dummy.matrix);
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
            const cfg = appConfigViz.getAll();
            appState.get('tGroupRings').visible = (cfg.vortexStyle === 'rings');
            appState.get('tGroupBars').visible = (cfg.vortexStyle === 'bars');
            appState.get('tGroupWaves').visible = (cfg.vortexStyle === 'wave');
        }

        function updateThreeJSColors() {
            if(!appState.get('tInitialized')) return;
            // Sẽ được gọi trong frame render để làm màu động, ở đây chỉ để reset
        }
