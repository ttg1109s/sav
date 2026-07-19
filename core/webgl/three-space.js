/**
 * Hằng số & hàm khởi tạo "Drifting Space" Engine bằng Three.js — trôi giữa các thiên thể (hành
 * tinh/ngôi sao/dải ngân hà), sao lấm chấm to dần khi tiến tới, sao băng/thiên thạch ngẫu nhiên,
 * rung + flash khi "va chạm".
 *
 * VIẾT LẠI LẦN 2 (19/07/2026, phản hồi Giang — "đập đi viết lại hết"). So với lần 1, đợt này:
 *   1. HÀNH TINH — canvas procedural texture (dải màu + đốm bão, giống kỹ thuật texture thủ tục
 *      chuẩn cho hành tinh hư cấu — KHÔNG còn màu phẳng đơn sắc).
 *   2. NGÔI SAO — corona giờ là Sprite billboard (luôn quay mặt về camera, dùng CHUNG texture glow
 *      với thiên thạch — TÁI DÙNG, không tạo thêm kỹ thuật mới) + THREE.PointLight THẬT tại vị trí
 *      sao (chiếu sáng vật lý thật, cường độ nhấp nháy theo audio).
 *   3. DẢI NGÂN HÀ — giữ nguyên kỹ thuật sinh xoắn ốc (đã là kỹ thuật chuẩn phổ biến, xem batch
 *      trước), thêm xoay + nhấp nháy kích thước theo audio.
 *   4. STAR FIELD MỚI — lớp "sao lấm chấm" RIÊNG (spFieldStarPoints, khác hẳn spStarPoints nền xa
 *      tĩnh), mỗi sao tự "tái sinh" theo kiểu sliding-window (TÁI DÙNG kỹ thuật tRings của Vortex)
 *      khi camera vượt qua — to dần khi tiến gần là nhờ `sizeAttenuation: true` CHUẨN CÓ SẴN của
 *      THREE.PointsMaterial (không cần shader tự chế).
 *   5. KHUNG KÍNH KHOANG LÁI — chuyển hẳn sang SVG DOM (#space-glass-frame, index.html), KHÔNG còn
 *      hàm canvas vẽ tay (đã xoá core/visualizer/draw/spaceship-frame.js).
 *   6. Camera Ken Burns (zoom+pan+chéo góc, audio-reactive) — LOGIC CHẠY ở
 *      core/visualizer/types/space.js::drawSpace(), state chuẩn bị ở đây (spPanAngle).
 *   7. GIỮ NGUYÊN: quỹ đạo cong nền (spPathParams/spPathTarget, tái dùng công thức Vortex), pool
 *      thiên thạch tái sử dụng, fade-in, composer bloom thật (THREE.EffectComposer/RenderPass/
 *      UnrealBloomPass — xem index.html khu CDN, có fallback an toàn).
 *
 * DÙNG CHUNG 1 WebGL renderer (#webgl-canvas, appState 'tRenderer') với Vortex. Mỗi kiểu tự có
 * Scene/Camera RIÊNG. MIỄN kiến trúc /event/ VÀ Rule 1-5 — giống hệt lý do three-vortex.js/
 * vortex.js được miễn.
 *
 * PHẢI nạp SAU: core/config.js, service/state.js, core/audio-analysis.js (getComputedColor()), 7
 * file postprocessing CDN (index.html). NẠP TRƯỚC core/visualizer/types/space.js.
 */
        const SPACE_DEPTH = 4000;
        const SPACE_SECTOR_KINDS = ['planet', 'star', 'galaxy'];

        let spDriftSpeed = 0;
        let spShakeFrames = 0;
        let spShakeMagnitude = 0;
        let spFlashOpacity = 0;

        /** Tính offset x/y của đường bay cong nền tại 1 điểm Z bất kỳ — TÁI DÙNG Y HỆT công thức
         * getVortexCenterAt() của Vortex. Camera VÀ mọi thiên thể/thiên thạch/sao lấy toạ độ tâm từ
         * CÙNG 1 hàm này tại đúng Z của chúng, nên toàn cảnh "uốn lượn" nhất quán với nhau. */
        function getSpacePathOffsetAt(z, pathParams) {
            return {
                x: Math.sin(z * pathParams.freqX + pathParams.phaseX) * pathParams.ampX,
                y: Math.cos(z * pathParams.freqY + pathParams.phaseY) * pathParams.ampY
            };
        }

        /** Đổi hướng bay cong nền (khi nhạc mạnh) — TÁI DÙNG kỹ thuật rollNewVortexCurve(). */
        function rollNewSpacePathCurve() {
            const jitter = (base, range) => base + (Math.random() - 0.5) * range;
            appState.mutate('spPathTarget', target => {
                target.freqX = Math.max(0.0003, Math.min(0.0013, jitter(target.freqX, 0.0004)));
                target.freqY = Math.max(0.0003, Math.min(0.0013, jitter(target.freqY, 0.0004)));
                target.ampX = Math.max(220, Math.min(680, jitter(target.ampX, 200)));
                target.ampY = Math.max(160, Math.min(520, jitter(target.ampY, 170)));
            }, { skipCheck: true });
        }

        /** Nội suy mượt hình dáng đường bay cong nền về phía target — TÁI DÙNG kỹ thuật
         * updateVortexCurveLerp(), hệ số k nhỏ hơn Vortex — trôi chậm rãi, "sải cánh" hơn. */
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

        /** Texture glow tròn dùng chung (canvas gradient, KHÔNG dùng ảnh asset ngoài) — dùng cho
         * sprite đầu thiên thạch VÀ corona ngôi sao (TÁI DÙNG 1 texture cho cả 2, không tạo thêm kỹ
         * thuật riêng). Dựng 1 LẦN DUY NHẤT. */
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

        /** Texture bề mặt hành tinh — kỹ thuật procedural texture THỦ TỤC CHUẨN (canvas 2D: dải
         * màu ngang kiểu "gas giant" + đốm bão/miệng hố ngẫu nhiên), thay vì màu phẳng đơn sắc (mục
         * 1 — nguyên nhân chính khiến hành tinh "chẳng khác gì hình tròn 2D" ở bản trước, KỂ CẢ sau
         * khi đã thêm ánh sáng, vì bề mặt vẫn hoàn toàn đồng nhất 1 màu). Tỉ lệ 2:1 (equirectangular)
         * đúng chuẩn UV mapping mặc định của THREE.SphereGeometry. */
        function _buildSpacePlanetTexture(baseColorHex) {
            const w = 256, h = 128;
            const cnv = document.createElement('canvas');
            cnv.width = w; cnv.height = h;
            const c = cnv.getContext('2d');
            c.fillStyle = baseColorHex; c.fillRect(0, 0, w, h);
            const bands = 4 + Math.floor(Math.random() * 4);
            for (let i = 0; i < bands; i++) {
                const y = (i / bands) * h;
                const bandH = h / bands;
                const lightness = 30 + Math.random() * 35;
                c.fillStyle = `hsla(${Math.random() * 360}, 45%, ${lightness}%, ${0.25 + Math.random() * 0.3})`;
                c.fillRect(0, y, w, bandH);
            }
            const blotchCount = 14 + Math.floor(Math.random() * 12);
            for (let i = 0; i < blotchCount; i++) {
                c.beginPath();
                c.ellipse(Math.random() * w, Math.random() * h, 5 + Math.random() * 16, 3 + Math.random() * 9, Math.random() * Math.PI, 0, Math.PI * 2);
                c.fillStyle = `hsla(${Math.random() * 360}, 55%, ${25 + Math.random() * 35}%, 0.35)`;
                c.fill();
            }
            const tex = new THREE.CanvasTexture(cnv);
            tex.wrapS = THREE.RepeatWrapping;
            return tex;
        }

        /** Dựng 1 hành tinh: SphereGeometry + MeshStandardMaterial CÓ TEXTURE bề mặt (mục 1, thay
         * màu phẳng) + phản ứng ánh sáng thật (AmbientLight/DirectionalLight, xem initThreeSpace())
         * + viền khí quyển mờ additive. Màu nền LẤY THEO vizConfig.mode qua getComputedColor()
         * (item 3, readme/visual-conventions.md). Bắt đầu scale 0 để fade-in. */
        function _createSpacePlanetMesh(perf) {
            const baseColor = getComputedColor(0, 1, Math.round(appState.get('beatScale') * 255)).fill;
            const geo = new THREE.SphereGeometry(140, perf.spaceDetail, perf.spaceDetail);
            const mat = new THREE.MeshStandardMaterial({ map: _buildSpacePlanetTexture(baseColor), roughness: 0.8, metalness: 0.1 });
            const mesh = new THREE.Mesh(geo, mat);
            const glowGeo = new THREE.SphereGeometry(152, Math.max(8, perf.spaceDetail - 8), Math.max(8, perf.spaceDetail - 8));
            const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(baseColor), transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, side: THREE.BackSide });
            mesh.add(new THREE.Mesh(glowGeo, glowMat));
            mesh.scale.setScalar(0.001);
            return mesh;
        }

        /** Dựng 1 "ngôi sao": khối cầu MeshStandardMaterial emissive CAO (tự phát sáng, mồi
         * UnrealBloomPass) + corona giờ là SPRITE billboard (TÁI DÙNG spGlowTexture chung, mục 2 —
         * luôn quay mặt về camera, đẹp hơn hẳn corona hình cầu BackSide cũ ở mọi góc nhìn) +
         * THREE.PointLight THẬT gắn kèm (chiếu sáng vật lý thật cho khung cảnh xung quanh, cường độ
         * nhấp nháy theo audio ở drawSpace()). Màu LẤY THEO vizConfig.mode. Fade-in giống hành tinh. */
        function _createSpaceStarMesh(perf, glowTexture) {
            const color = new THREE.Color(getComputedColor(0, 1, 255).fill);
            const geo = new THREE.SphereGeometry(90, perf.spaceDetail, perf.spaceDetail);
            const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0, emissive: color, emissiveIntensity: 1.6 });
            const mesh = new THREE.Mesh(geo, mat);

            const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
            corona.scale.set(620, 620, 1);
            mesh.add(corona);

            const starLight = new THREE.PointLight(color, 2.2, 2400, 1.6);
            mesh.add(starLight);
            mesh.userData.starLight = starLight;

            mesh.scale.setScalar(0.001);
            return mesh;
        }

        /** Dựng 1 dải ngân hà: đĩa xoắn ốc bằng THREE.Points — kỹ thuật sinh xoắn ốc CHUẨN, phổ
         * biến (phân bố bán kính ngẫu nhiên + góc xoắn tăng dần theo bán kính + màu chuyển dần từ
         * tâm ra rìa — đúng kỹ thuật "galaxy generator" tham khảo phổ biến, GIỮ NGUYÊN từ batch
         * trước). Thêm xoay + nhấp nháy kích thước theo audio (drawSpace()). 2 màu core/edge LẤY
         * THEO vizConfig.mode. Fade-in qua opacity (Points scale=0 sẽ trông sai). */
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
            points.userData.targetOpacity = 0.9;
            points.userData.baseSize = 6;
            return points;
        }

        /** Dựng NGẪU NHIÊN 1 thiên thể mới theo `kind`, LỆCH quanh TÂM đường bay cong nền tại đúng
         * Z đó (getSpacePathOffsetAt) — luôn nằm "trên hành trình" nhất quán với camera. */
        function _spawnSpaceSectorObject(kind, atZ, perf, pathParams, glowTexture) {
            let obj;
            if (kind === 'star') obj = _createSpaceStarMesh(perf, glowTexture);
            else if (kind === 'galaxy') obj = _createSpaceGalaxyPoints(perf);
            else obj = _createSpacePlanetMesh(perf);
            const center = getSpacePathOffsetAt(atZ, pathParams);
            const lateral = 220 + Math.random() * 280;
            const angle = Math.random() * Math.PI * 2;
            obj.position.set(center.x + Math.cos(angle) * lateral, center.y + Math.sin(angle) * lateral * 0.6, atZ);
            obj.userData.kind = kind;
            return obj;
        }

        /** Dựng lớp "sao lấm chấm" RIÊNG — mỗi sao tái sinh kiểu sliding-window (TÁI DÙNG kỹ thuật
         * tRings của Vortex) khi camera vượt qua, rải quanh TÂM đường bay cong tại đúng Z của nó.
         * "To dần khi tiến tới" là nhờ `sizeAttenuation: true` CHUẨN CÓ SẴN của PointsMaterial
         * (three.js tự tính theo phối cảnh — KHÔNG cần shader tự chế riêng). */
        function _createSpaceFieldStars(perf, pathParams) {
            const count = perf.spaceFieldStars;
            const positions = new Float32Array(count * 3);
            const zs = [];
            for (let i = 0; i < count; i++) {
                const z = -Math.random() * SPACE_DEPTH;
                const center = getSpacePathOffsetAt(z, pathParams);
                const lateral = 80 + Math.random() * 900;
                const angle = Math.random() * Math.PI * 2;
                positions[i * 3] = center.x + Math.cos(angle) * lateral;
                positions[i * 3 + 1] = center.y + Math.sin(angle) * lateral * 0.7;
                positions[i * 3 + 2] = z;
                zs.push(z);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const mat = new THREE.PointsMaterial({ color: 0xdff1ff, size: 5, sizeAttenuation: true, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
            appState.set('spFieldStarZs', zs, { skipCheck: true });
            return new THREE.Points(geo, mat);
        }

        /** Khởi tạo toàn bộ engine Space. Gọi 1 lần lúc chuyển sang kiểu 'space' lần đầu. */
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

            // Ánh sáng thật (giữ từ lần 1) — CƠ BẢN của three.js, không phải addon.
            appState.set('spAmbientLight', new THREE.AmbientLight(0x33406b, 0.55), { skipCheck: true });
            appState.get('spScene').add(appState.get('spAmbientLight'));
            appState.set('spKeyLight', new THREE.DirectionalLight(0xffffff, 1.15), { skipCheck: true });
            appState.get('spKeyLight').position.set(1, 1.2, 0.6);
            appState.get('spScene').add(appState.get('spKeyLight'));

            if (!appState.get('tRenderer')) {
                appState.set('tRenderer', new THREE.WebGLRenderer({ canvas: tCanvas, alpha: true, antialias: true }), { skipCheck: true });
                appState.get('tRenderer').setPixelRatio(window.devicePixelRatio);
            }
            appState.get('tRenderer').setSize(window.innerWidth, window.innerHeight);

            if (!appState.get('spGlowTexture')) appState.set('spGlowTexture', _buildSpaceGlowTexture(), { skipCheck: true });
            const glowTexture = appState.get('spGlowTexture');

            const defaultPath = { freqX: 0.0007, freqY: 0.0005, ampX: 380, ampY: 260, phaseX: 0, phaseY: 0 };
            appState.set('spPathParams', { ...defaultPath }, { skipCheck: true });
            appState.set('spPathTarget', { ...defaultPath }, { skipCheck: true });
            appState.set('spPanAngle', 0, { skipCheck: true });

            // Starfield nền xa TĨNH (giữ từ lần 1 — "bầu trời" bao quanh, trôi rất chậm/parallax).
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

            // MỚI (mục 4) — lớp "sao lấm chấm" tái sinh, to dần khi tiến tới.
            appState.set('spFieldStarPoints', _createSpaceFieldStars(perf, appState.get('spPathParams')), { skipCheck: true });
            appState.get('spScene').add(appState.get('spFieldStarPoints'));

            appState.set('spGroupSector', new THREE.Group(), { skipCheck: true });
            appState.get('spScene').add(appState.get('spGroupSector'));
            const firstKind = SPACE_SECTOR_KINDS[Math.floor(Math.random() * SPACE_SECTOR_KINDS.length)];
            appState.get('spGroupSector').add(_spawnSpaceSectorObject(firstKind, -900, perf, appState.get('spPathParams'), glowTexture));
            appState.set('spSectorKind', firstKind, { skipCheck: true });

            appState.set('spGroupMeteors', new THREE.Group(), { skipCheck: true });
            const meteorGeo = new THREE.BoxGeometry(10, 10, 160);
            const meteorPool = [];
            for (let i = 0; i < perf.spaceMeteorPool; i++) {
                const m = new THREE.Mesh(meteorGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
                const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
                glowSprite.scale.set(60, 60, 1);
                glowSprite.position.set(0, 0, 80);
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

            // Bloom thật (THREE.EffectComposer/RenderPass/UnrealBloomPass, giữ từ lần 1) — guard an
            // toàn, fallback render thẳng nếu CDN lỗi.
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

        /** Chọn 1 loại thiên thể MỚI khác loại hiện tại, dựng phía trước, LỆCH quanh tâm đường bay
         * cong nền tại đúng Z đó. */
        function rollNewSpaceSector(currentZ, perf) {
            const group = appState.get('spGroupSector');
            while (group.children.length > 0) group.remove(group.children[0]);
            const prevKind = appState.get('spSectorKind');
            let kind = prevKind;
            while (kind === prevKind) kind = SPACE_SECTOR_KINDS[Math.floor(Math.random() * SPACE_SECTOR_KINDS.length)];
            group.add(_spawnSpaceSectorObject(kind, currentZ - 1600, perf, appState.get('spPathParams'), appState.get('spGlowTexture')));
            appState.set('spSectorKind', kind, { skipCheck: true });
        }

        /** Kích hoạt 1 sao băng/thiên thạch còn RẢNH trong pool — xuất hiện GẦN tâm đường bay cong
         * tại đúng Z camera hiện tại, bay cắt chéo NGANG qua phía trước camera. */
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

        /** Bắt đầu 1 đợt rung camera + flash màu cam/trắng trên canvas 2D khi va chạm. */
        function triggerSpaceCollisionShake() {
            spShakeFrames = 22;
            spShakeMagnitude = 14 + Math.random() * 8;
            spFlashOpacity = 0.55;
        }
