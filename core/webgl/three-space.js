/**
 * Hằng số & hàm khởi tạo/cập nhật "Drifting Space" Engine bằng Three.js — trôi giữa các thiên thể
 * (hành tinh/ngôi sao/dải ngân hà), sao băng/thiên thạch xuất hiện ngẫu nhiên theo năng lượng
 * nhạc, rung nhẹ + flash camera khi "va chạm".
 *
 * VIẾT LẠI TOÀN DIỆN (19/07/2026, phản hồi Giang — bản đầu "rất tệ": khối cầu phẳng như hình
 * tròn 2D, thiên thạch không thấy, quỹ đạo chỉ đâm thẳng không bay vòng/lên xuống, va chạm không
 * thấy gì, xuất hiện đột ngột, không tích hợp thư viện nào). Batch này:
 *   1. ÁNH SÁNG THẬT (AmbientLight + DirectionalLight) + MeshStandardMaterial thay MeshBasicMaterial
 *      cho hành tinh/sao — có bóng đổ/gradient thật theo góc chiếu sáng, không còn phẳng.
 *   2. QUỸ ĐẠO CONG — TÁI DÙNG đúng kỹ thuật sin/cos của Vortex (getVortexCenterAt/
 *      rollNewVortexCurve/updateVortexCurveLerp, xem core/webgl/three-vortex.js) cho cả camera
 *      lẫn vị trí thiên thể/thiên thạch — spPathParams/spPathTarget (giống hệt tPathParams/
 *      tPathTarget), tự động cho bay vòng trái/phải + lên/xuống thay vì đâm thẳng.
 *   3. THIÊN THẠCH to hơn ~3 lần + sprite glow (texture canvas gradient dựng 1 lần, KHÔNG dùng
 *      ảnh asset ngoài) + sinh dày hơn + quỹ đạo cắt ngang tầm nhìn thật (trước đây sinh quá xa 2
 *      bên, ra ngoài FOV).
 *   4. FADE-IN — thiên thể mới scale từ 0 lên 1 trong ~1.5s, không còn "pop" đột ngột.
 *   5. VA CHẠM RÕ RÀNG — rung camera MẠNH hơn + flash màu cam/trắng trên canvas 2D (xem
 *      core/visualizer/draw/space-collision-flash.js), không chỉ rung nhẹ khó nhận ra.
 *   6. TÍCH HỢP THƯ VIỆN THẬT (Giang yêu cầu — không tự chế mọi thứ): THREE.EffectComposer +
 *      THREE.RenderPass + THREE.UnrealBloomPass — bộ postprocessing CHÍNH THỨC của three.js
 *      (examples/js/postprocessing/*, cùng version r128 với three.min.js đang dùng, nạp qua
 *      jsdelivr — xem index.html khu CDN). Có GUARD an toàn: nếu vì lý do gì đó 3 class này chưa
 *      tồn tại (CDN lỗi mạng...), tự động fallback về renderer.render() thẳng như cũ — KHÔNG BAO
 *      GIỜ crash toàn bộ visualizer chỉ vì bloom không tải được.
 *
 * DÙNG CHUNG 1 WebGL renderer (#webgl-canvas, appState 'tRenderer') với Vortex — 2 kiểu KHÔNG BAO
 * GIỜ active cùng lúc. Mỗi kiểu tự có Scene/Camera RIÊNG (tiền tố "sp" cho biến STATE của Space).
 *
 * MIỄN kiến trúc /event/ VÀ Rule 1-5 — giống hệt lý do three-vortex.js/vortex.js được miễn (module
 * hiệu ứng nhúng, đọc/ghi state trực tiếp mỗi khung hình).
 *
 * PHẢI nạp SAU: core/config.js (PERFORMANCE_PROFILES), service/state.js (appState),
 * core/audio-analysis.js (getComputedColor()), VÀ SAU 7 file postprocessing CDN (xem index.html —
 * chỉ ĐỊNH NGHĨA hàm ở đây, không gọi ngay lúc parse, nên thứ tự nạp thực tế trong index.html an
 * toàn dù đứng trước — chỉ cần tồn tại trước lúc initThreeSpace() THỰC SỰ CHẠY, tức lúc người dùng
 * chọn kiểu 'space', luôn sau khi mọi script đã nạp xong). NẠP TRƯỚC core/visualizer/types/space.js.
 */
        const SPACE_DEPTH = 4000;   // khoảng cách trôi tối đa theo trục Z (giống TUNNEL_DEPTH của Vortex)

        // 3 loại thiên thể xoay vòng khi "sang khu vực khác" — luôn chọn KHÁC loại đang có.
        const SPACE_SECTOR_KINDS = ['planet', 'star', 'galaxy'];

        let spDriftSpeed = 0;       // biến NỘI BỘ — tốc độ trôi hiện tại, chỉ dùng trong drawSpace()
        let spShakeFrames = 0;      // số khung hình rung lắc còn lại sau va chạm thiên thạch
        let spShakeMagnitude = 0;   // biên độ rung hiện tại (giảm dần mỗi khung hình)
        let spFlashOpacity = 0;     // độ mờ flash va chạm trên canvas 2D (giảm dần mỗi khung hình) — xem draw/space-collision-flash.js

        /** Tính offset x/y của đường bay cong tại 1 điểm Z bất kỳ — TÁI DÙNG Y HỆT công thức
         * getVortexCenterAt() của Vortex (core/webgl/three-vortex.js), chỉ đổi tên tham số cho rõ
         * ngữ cảnh Space. Đây là gốc rễ khắc phục "quỹ đạo chỉ đâm thẳng, không bay vòng/lên
         * xuống" — camera VÀ thiên thể/thiên thạch đều lấy toạ độ tâm từ CÙNG 1 hàm này tại đúng Z
         * của chúng, nên toàn cảnh cùng "uốn lượn" nhất quán với nhau. */
        function getSpacePathOffsetAt(z, pathParams) {
            return {
                x: Math.sin(z * pathParams.freqX + pathParams.phaseX) * pathParams.ampX,
                y: Math.cos(z * pathParams.freqY + pathParams.phaseY) * pathParams.ampY
            };
        }

        /** Đổi hướng bay cong (khi nhạc mạnh) — TÁI DÙNG kỹ thuật rollNewVortexCurve(): đổi nhẹ
         * nhàng so với target hiện tại (nội suy dần ở updateSpacePathLerp()), tránh nhảy đột ngột.
         * Biên độ/tần số RỘNG hơn Vortex (không gian mở, không phải đường ống hẹp — camera nên "lượn
         * sải" chứ không "xóc nảy" như tunnel). */
        function rollNewSpacePathCurve() {
            const jitter = (base, range) => base + (Math.random() - 0.5) * range;
            appState.mutate('spPathTarget', target => {
                target.freqX = Math.max(0.0003, Math.min(0.0013, jitter(target.freqX, 0.0004)));
                target.freqY = Math.max(0.0003, Math.min(0.0013, jitter(target.freqY, 0.0004)));
                target.ampX = Math.max(220, Math.min(680, jitter(target.ampX, 200)));
                target.ampY = Math.max(160, Math.min(520, jitter(target.ampY, 170)));
            }, { skipCheck: true });
        }

        /** Nội suy mượt hình dáng đường bay cong về phía target — TÁI DÙNG kỹ thuật
         * updateVortexCurveLerp(), hệ số k nhỏ hơn Vortex (0.004 so với 0.006) — trôi chậm rãi,
         * "sải cánh" hơn hẳn cảm giác gấp gáp của đường ống hẹp Vortex. */
        function updateSpacePathLerp() {
            const k = 0.004;
            const target = appState.get('spPathTarget');
            appState.mutate('spPathParams', params => {
                params.freqX += (target.freqX - params.freqX) * k;
                params.freqY += (target.freqY - params.freqY) * k;
                params.ampX += (target.ampX - params.ampX) * k;
                params.ampY += (target.ampY - params.ampY) * k;
                params.phaseX += 0.003;
                params.phaseY += 0.003;
            }, { skipCheck: true });
        }

        /** Dựng 1 texture glow tròn (canvas gradient, KHÔNG dùng ảnh asset ngoài — đúng tinh thần
         * dự án chạy qua file://) — dùng làm sprite phát sáng cho đầu thiên thạch, tạo cảm giác
         * "sao băng" rõ ràng thay vì 1 khối hộp mỏng 3px gần như vô hình như bản trước. Dựng 1 LẦN
         * DUY NHẤT (lưu vào appState 'spGlowTexture'), tái sử dụng cho mọi sprite. */
        function _buildSpaceGlowTexture() {
            const size = 128;
            const cnv = document.createElement('canvas');
            cnv.width = cnv.height = size;
            const c = cnv.getContext('2d');
            const grad = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
            grad.addColorStop(1, 'rgba(255,255,255,0)');
            c.fillStyle = grad; c.fillRect(0, 0, size, size);
            return new THREE.CanvasTexture(cnv);
        }

        /** Dựng 1 hành tinh: khối cầu MeshStandardMaterial (phản ứng ánh sáng thật, KHÔNG còn
         * MeshBasicMaterial phẳng như hình tròn 2D — mục 1) + viền khí quyển mờ additive. Màu LẤY
         * THEO vizConfig.mode qua getComputedColor() (item 3, readme/visual-conventions.md). Bắt
         * đầu scale 0 để fade-in (mục 4, xem drawSpace()). */
        function _createSpacePlanetMesh(perf) {
            const color = new THREE.Color(getComputedColor(0, 1, Math.round(appState.get('beatScale') * 255)).fill);
            const geo = new THREE.SphereGeometry(140, perf.spaceDetail, perf.spaceDetail);
            const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.15, emissive: color, emissiveIntensity: 0.1 });
            const mesh = new THREE.Mesh(geo, mat);
            const glowGeo = new THREE.SphereGeometry(152, Math.max(8, perf.spaceDetail - 8), Math.max(8, perf.spaceDetail - 8));
            const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, side: THREE.BackSide });
            mesh.add(new THREE.Mesh(glowGeo, glowMat));
            mesh.scale.setScalar(0.001);
            return mesh;
        }

        /** Dựng 1 "ngôi sao": khối cầu MeshStandardMaterial emissive CAO (tự phát sáng mạnh — vừa
         * đúng vật lý sao thật, vừa "mồi" UnrealBloomPass tạo quầng sáng rực, mục 6) + corona mờ
         * additive lồng ngoài. Màu LẤY THEO vizConfig.mode (item 3). Fade-in giống hành tinh. */
        function _createSpaceStarMesh(perf) {
            const color = new THREE.Color(getComputedColor(0, 1, 255).fill);
            const geo = new THREE.SphereGeometry(90, perf.spaceDetail, perf.spaceDetail);
            const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0, emissive: color, emissiveIntensity: 1.6 });
            const mesh = new THREE.Mesh(geo, mat);
            const coronaGeo = new THREE.SphereGeometry(240, Math.max(8, perf.spaceDetail - 8), Math.max(8, perf.spaceDetail - 8));
            const coronaMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, side: THREE.BackSide });
            mesh.add(new THREE.Mesh(coronaGeo, coronaMat));
            mesh.scale.setScalar(0.001);
            return mesh;
        }

        /** Dựng 1 dải ngân hà: đĩa xoắn ốc bằng THREE.Points (kỹ thuật phổ biến — phân bố bán kính
         * ngẫu nhiên + góc xoắn tăng dần theo bán kính). 2 màu core/edge LẤY THEO vizConfig.mode
         * (item 3). Fade-in qua opacity (Points không nên scale 0 — mật độ hạt sẽ trông sai, dùng
         * material.opacity thay vì scale cho riêng loại này). */
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
            const mat = new THREE.PointsMaterial({ size: 6, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            const points = new THREE.Points(geo, mat);
            points.userData.targetOpacity = 0.9; // fade-in đích (xem drawSpace())
            return points;
        }

        /** Dựng NGẪU NHIÊN 1 thiên thể mới theo `kind`, đặt tại Z=`atZ`, LỆCH quanh TÂM đường bay
         * cong tại chính Z đó (getSpacePathOffsetAt) thay vì quanh gốc toạ độ thế giới cố định như
         * bản trước — để thiên thể luôn nằm "trên hành trình" nhất quán với đường camera đang lượn
         * (mục 2), không trôi lệch ra xa khỏi tầm nhìn khi đường cong đổi hướng. */
        function _spawnSpaceSectorObject(kind, atZ, perf, pathParams) {
            let obj;
            if (kind === 'star') obj = _createSpaceStarMesh(perf);
            else if (kind === 'galaxy') obj = _createSpaceGalaxyPoints(perf);
            else obj = _createSpacePlanetMesh(perf);
            const center = getSpacePathOffsetAt(atZ, pathParams);
            const lateral = 220 + Math.random() * 280;
            const angle = Math.random() * Math.PI * 2;
            obj.position.set(center.x + Math.cos(angle) * lateral, center.y + Math.sin(angle) * lateral * 0.6, atZ);
            obj.userData.kind = kind;
            return obj;
        }

        /** Khởi tạo toàn bộ engine Space: scene/camera/renderer (dùng chung Vortex)/ánh sáng/
         * starfield nền/nhóm thiên thể chính/pool thiên thạch/texture glow/composer bloom. Gọi 1
         * lần lúc chuyển sang kiểu 'space' lần đầu (xem updateTypeUI()). */
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

            // ÁNH SÁNG THẬT (mục 1) — thiếu ánh sáng là NGUYÊN NHÂN CHÍNH khiến khối cầu
            // MeshBasicMaterial bản trước trông phẳng như hình tròn 2D (KHÔNG có gradient sáng/tối
            // nào theo góc nhìn). AmbientLight cho sáng nền tối thiểu (không bao giờ đen tuyền phía
            // khuất), DirectionalLight tạo rõ mặt sáng/mặt tối trên khối cầu — đây là 2 loại ánh
            // sáng CƠ BẢN NHẤT của three.js, không phải addon, luôn có sẵn.
            appState.set('spAmbientLight', new THREE.AmbientLight(0x33406b, 0.55), { skipCheck: true });
            appState.get('spScene').add(appState.get('spAmbientLight'));
            appState.set('spKeyLight', new THREE.DirectionalLight(0xffffff, 1.15), { skipCheck: true });
            appState.get('spKeyLight').position.set(1, 1.2, 0.6);
            appState.get('spScene').add(appState.get('spKeyLight'));

            // Renderer DÙNG CHUNG với Vortex.
            if (!appState.get('tRenderer')) {
                appState.set('tRenderer', new THREE.WebGLRenderer({ canvas: tCanvas, alpha: true, antialias: true }), { skipCheck: true });
                appState.get('tRenderer').setPixelRatio(window.devicePixelRatio);
            }
            appState.get('tRenderer').setSize(window.innerWidth, window.innerHeight);

            // Texture glow dùng chung cho sprite đầu thiên thạch (mục 3) — dựng 1 lần, tái sử dụng.
            if (!appState.get('spGlowTexture')) appState.set('spGlowTexture', _buildSpaceGlowTexture(), { skipCheck: true });

            // Đường bay cong (mục 2) — reset về mặc định mỗi lần init lại, tự nội suy dần khi chạy.
            const defaultPath = { freqX: 0.0007, freqY: 0.0005, ampX: 380, ampY: 260, phaseX: 0, phaseY: 0 };
            appState.set('spPathParams', { ...defaultPath }, { skipCheck: true });
            appState.set('spPathTarget', { ...defaultPath }, { skipCheck: true });

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
            appState.get('spGroupSector').add(_spawnSpaceSectorObject(firstKind, -900, perf, appState.get('spPathParams')));
            appState.set('spSectorKind', firstKind, { skipCheck: true });

            // Pool sao băng/thiên thạch — mỗi mesh giờ có thêm 1 Sprite glow con (mục 3), TO HƠN
            // ~3 lần bản trước, tái sử dụng (không tạo/xoá mesh liên tục mỗi khung hình).
            appState.set('spGroupMeteors', new THREE.Group(), { skipCheck: true });
            const meteorGeo = new THREE.BoxGeometry(10, 10, 160);
            const glowTex = appState.get('spGlowTexture');
            const meteorPool = [];
            for (let i = 0; i < perf.spaceMeteorPool; i++) {
                const m = new THREE.Mesh(meteorGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
                const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
                glowSprite.scale.set(60, 60, 1);
                glowSprite.position.set(0, 0, 80); // đầu thiên thạch (phía trước theo hướng bay)
                m.add(glowSprite);
                m.visible = false;
                m.userData = { active: false, life: 0, vx: 0, vy: 0, vz: 0, glowSprite };
                meteorPool.push(m);
                appState.get('spGroupMeteors').add(m);
            }
            appState.set('spMeteorPool', meteorPool, { skipCheck: true });
            appState.get('spScene').add(appState.get('spGroupMeteors'));

            appState.set('spCurrentDriftZ', 0, { skipCheck: true });
            appState.set('spInitialized', true, { skipCheck: true });

            // TÍCH HỢP THƯ VIỆN THẬT (mục 6) — THREE.EffectComposer + RenderPass + UnrealBloomPass,
            // bộ postprocessing CHÍNH THỨC của three.js (không tự chế shader nào). GUARD: nếu vì lý
            // do gì đó (mạng lỗi lúc nạp CDN...) 1 trong 3 class chưa tồn tại, spComposer = null —
            // drawSpace() tự fallback render thẳng renderer.render(), KHÔNG BAO GIỜ crash.
            if (typeof THREE.EffectComposer === 'function' && typeof THREE.RenderPass === 'function' && typeof THREE.UnrealBloomPass === 'function') {
                try {
                    const composer = new THREE.EffectComposer(appState.get('tRenderer'));
                    composer.addPass(new THREE.RenderPass(appState.get('spScene'), appState.get('spCamera')));
                    const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.55, 0.72);
                    composer.addPass(bloom);
                    composer.setSize(window.innerWidth, window.innerHeight);
                    appState.set('spComposer', composer, { skipCheck: true });
                } catch (e) {
                    console.warn('[three-space] UnrealBloomPass init lỗi — fallback render thẳng, không bloom:', e);
                    appState.set('spComposer', null, { skipCheck: true });
                }
            } else {
                console.warn('[three-space] Không tìm thấy THREE.EffectComposer/RenderPass/UnrealBloomPass (CDN?) — fallback render thẳng, không bloom.');
                appState.set('spComposer', null, { skipCheck: true });
            }
        }

        /** Chọn 1 loại thiên thể MỚI khác loại hiện tại, dựng nó ở phía trước (cách `currentZ` một
         * khoảng xa, LỆCH quanh tâm đường bay cong tại đúng Z đó — mục 2), xoá thiên thể cũ. */
        function rollNewSpaceSector(currentZ, perf) {
            const group = appState.get('spGroupSector');
            while (group.children.length > 0) group.remove(group.children[0]);
            const prevKind = appState.get('spSectorKind');
            let kind = prevKind;
            while (kind === prevKind) kind = SPACE_SECTOR_KINDS[Math.floor(Math.random() * SPACE_SECTOR_KINDS.length)];
            group.add(_spawnSpaceSectorObject(kind, currentZ - 1600, perf, appState.get('spPathParams')));
            appState.set('spSectorKind', kind, { skipCheck: true });
        }

        /** Kích hoạt 1 sao băng/thiên thạch còn RẢNH trong pool — xuất hiện GẦN tâm đường bay cong
         * tại đúng Z camera hiện tại (mục 3 — bản trước sinh quá xa 2 bên, hay ra NGOÀI khung hình
         * FOV nên "không thấy"), bay cắt chéo NGANG qua phía trước camera, TO + sáng hơn hẳn (sprite
         * glow ở đầu, xem initThreeSpace()). */
        function trySpawnSpaceMeteor(cameraZ, pathParams) {
            const pool = appState.get('spMeteorPool');
            const idx = pool.findIndex(m => !m.userData.active);
            if (idx === -1) return false;
            const m = pool[idx];
            const center = getSpacePathOffsetAt(cameraZ, pathParams);
            const side = Math.random() < 0.5 ? -1 : 1;
            m.position.set(center.x + side * (140 + Math.random() * 160), center.y + (Math.random() - 0.5) * 260, cameraZ - 320 - Math.random() * 180);
            const speed = 12 + Math.random() * 9;
            m.userData.vx = -side * speed * 1.15;
            m.userData.vy = (Math.random() - 0.5) * 3.5;
            m.userData.vz = speed * 1.3;
            m.userData.active = true;
            m.userData.life = 1;
            m.material.opacity = 0;
            m.userData.glowSprite.material.opacity = 0;
            const meteorColor = getComputedColor(0, 1, Math.round(appState.get('beatScale') * 255)).fill;
            m.material.color.set(meteorColor);
            m.userData.glowSprite.material.color.set(meteorColor);
            m.visible = true;
            m.lookAt(m.position.x + m.userData.vx, m.position.y + m.userData.vy, m.position.z + m.userData.vz);
            return true;
        }

        /** Bắt đầu 1 đợt rung camera (mục 5 — MẠNH hơn hẳn bản trước, "không thấy va chạm" là do
         * biên độ quá nhỏ) + kích hoạt flash màu cam/trắng trên canvas 2D (spFlashOpacity, xem
         * core/visualizer/draw/space-collision-flash.js) — va chạm giờ CÓ 2 tín hiệu rõ ràng cùng
         * lúc thay vì chỉ rung nhẹ mờ nhạt. */
        function triggerSpaceCollisionShake() {
            spShakeFrames = 22;
            spShakeMagnitude = 14 + Math.random() * 8;
            spFlashOpacity = 0.55;
        }
