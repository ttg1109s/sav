/**
 * "Drifting Space" Engine — VIẾT LẠI HOÀN TOÀN LẦN 3 (19/07/2026, phản hồi Giang — "xoá hết viết
 * lại hết space, bỏ hết mọi thứ cũ") — tách thành 3 KIỂU CON chọn ở Settings (spaceStyle, xem
 * components/visualizer-settings-drawer.js + setSpaceStyle()):
 *
 *   1. GALAXY EXPLORE — nhiều dải ngân hà xoắn ốc, camera xuyên thẳng qua từng thiên hà, tái sinh
 *      liên tục (sliding window) để KHÔNG BAO GIỜ khựng/giật/pop đột ngột. Tốc độ xoay/kích thước
 *      theo audio.
 *   2. SUN SYSTEM — hệ mặt trời THẬT (THREEx.Planets nếu dùng được — ĐÃ XÁC NHẬN CHẠY qua console
 *      log Giang gửi, chỉ có warning deprecated, không lỗi — fallback procedural nếu không). Nhạc
 *      chậm -> camera lùi xa quan sát toàn hệ; nhạc nhanh -> áp sát, di chuyển qua lại giữa các
 *      hành tinh.
 *   3. VACUUM VOID — chỉ có hạt/thiên thạch, va chạm hiển thị MẢNH VỠ KÍNH bay ra + VÒNG SÓNG NĂNG
 *      LƯỢNG nở ra (thay rung+flash đơn giản trước đây), ngưỡng va chạm NÂNG LÊN (hiếm hơn, mỗi lần
 *      xảy ra rõ ràng/kịch tính hơn).
 *
 * GIỮ NGUYÊN theo đúng yêu cầu Giang ("giữ nguyên movement"): quỹ đạo cong nền (spPathParams/
 * spPathTarget, công thức TÁI DÙNG từ Vortex) + lớp Ken Burns (zoom+pan+chéo góc, spPanAngle) —
 * xem getSpacePathOffsetAt()/rollNewSpacePathCurve()/updateSpacePathLerp() không đổi gì so với 2
 * lần viết trước. Sun System TÁI SỬ DỤNG cùng cơ chế Ken Burns nhưng đổi Ý NGHĨA: pan angle ->
 * góc quỹ đạo camera quanh hệ, dolly -> khoảng cách quan sát (xa=toàn hệ, gần=1 hành tinh).
 *
 * BỎ HẲN (theo yêu cầu "bao gồm thư viện đã dùng"): three-nebula (không lộ window.Nebula) và
 * @newkrok/three-particles (chưa xác nhận chạy) — Vacuum Void quay lại pool THREE.Points gốc
 * (thuộc bản thân three.js, KHÔNG phải addon ngoài, đã xác nhận ổn định qua mọi lần trước).
 *
 * GIỮ: THREE.EffectComposer/RenderPass/UnrealBloomPass (bloom thật, ĐÃ XÁC NHẬN không báo lỗi qua
 * console log Giang gửi) — dùng chung cho cả 3 kiểu. GIỮ: THREEx.Planets (ĐÃ XÁC NHẬN CHẠY, dùng
 * cho Sun System — đúng nghĩa "sử dụng thư viện" Giang yêu cầu riêng cho kiểu này).
 *
 * DÙNG CHUNG 1 WebGL renderer (#webgl-canvas, appState 'tRenderer') với Vortex. MIỄN kiến trúc
 * /event/ VÀ Rule 1-5 — giống hệt lý do three-vortex.js/vortex.js được miễn.
 *
 * PHẢI nạp SAU: core/config.js, service/state.js, core/audio-analysis.js (getComputedColor()), 3
 * file CDN (bloom + THREEx.Planets, xem index.html). NẠP TRƯỚC core/visualizer/types/space.js.
 */
        const SPACE_DEPTH = 4000;
        const SPACE_GALAXY_SPACING = 1500;      // khoảng cách Z giữa 2 thiên hà liên tiếp (Galaxy Explore)
        const SPACE_SUN_ORBIT_RADII = [260, 380, 500, 620, 760, 900]; // bán kính quỹ đạo các hành tinh quanh Mặt Trời

        let spDriftSpeed = 0;
        let spShakeFrames = 0;
        let spShakeMagnitude = 0;
        let spFlashOpacity = 0;

        /** Tính offset x/y của đường bay cong nền tại 1 điểm Z bất kỳ — TÁI DÙNG Y HỆT công thức
         * getVortexCenterAt() của Vortex. GIỮ NGUYÊN không đổi (yêu cầu Giang "giữ nguyên movement"). */
        function getSpacePathOffsetAt(z, pathParams) {
            return {
                x: Math.sin(z * pathParams.freqX + pathParams.phaseX) * pathParams.ampX,
                y: Math.cos(z * pathParams.freqY + pathParams.phaseY) * pathParams.ampY
            };
        }

        /** Đổi hướng bay cong nền (khi nhạc mạnh) — GIỮ NGUYÊN. */
        function rollNewSpacePathCurve() {
            const jitter = (base, range) => base + (Math.random() - 0.5) * range;
            appState.mutate('spPathTarget', target => {
                target.freqX = Math.max(0.0003, Math.min(0.0013, jitter(target.freqX, 0.0004)));
                target.freqY = Math.max(0.0003, Math.min(0.0013, jitter(target.freqY, 0.0004)));
                target.ampX = Math.max(220, Math.min(680, jitter(target.ampX, 200)));
                target.ampY = Math.max(160, Math.min(520, jitter(target.ampY, 170)));
            }, { skipCheck: true });
        }

        /** Nội suy mượt hình dáng đường bay cong nền — GIỮ NGUYÊN. */
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

        /** Texture glow tròn dùng chung (canvas gradient) — GIỮ NGUYÊN. */
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

        /** Texture bề mặt hành tinh procedural (canvas: dải màu + đốm bão) — dùng làm FALLBACK cho
         * Sun System khi THREEx.Planets không dựng được 1 hành tinh cụ thể nào đó. GIỮ NGUYÊN. */
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

        /** Thử dựng 1 hành tinh CỤ THỂ bằng THREEx.Planets (ĐÃ XÁC NHẬN chạy được qua console log
         * Giang gửi — chỉ warning ImageUtils.loadTexture deprecated, không lỗi). `creatorName` là
         * tên hàm chính xác (vd 'createSun', 'createEarth') — Sun System gọi TỪNG hành tinh theo
         * thứ tự cố định, không random như bản trước (mục "quan sát toàn hệ" cần bố cục ổn định).
         * Trả về `null` nếu thư viện không có/lỗi bất kỳ — gọi trong try/catch ở nơi dùng. */
        function _tryCreateThreexPlanet(creatorName) {
            if (typeof THREEx === 'undefined' || !THREEx.Planets || typeof THREEx.Planets[creatorName] !== 'function') return null;
            const mesh = THREEx.Planets[creatorName]();
            if (!mesh || !mesh.isObject3D) return null;
            const box = new THREE.Box3().setFromObject(mesh);
            const size = box.getSize(new THREE.Vector3());
            const currentRadius = Math.max(size.x, size.y, size.z) / 2 || 1;
            mesh.userData.naturalRadius = currentRadius;
            return mesh;
        }

        /** Dựng 1 hành tinh FALLBACK (procedural, khi THREEx.Planets không có/lỗi) — SphereGeometry
         * + MeshStandardMaterial có texture canvas, phản ứng ánh sáng thật. Màu LẤY THEO
         * vizConfig.mode qua getComputedColor() (item 3). */
        function _createFallbackPlanetMesh(radius, colorSeed, perf) {
            const baseColor = getComputedColor(0, 1, colorSeed).fill;
            const detail = perf ? perf.spaceDetail : 20;
            const geo = new THREE.SphereGeometry(radius, detail, detail);
            const mat = new THREE.MeshStandardMaterial({ map: _buildSpacePlanetTexture(baseColor), roughness: 0.8, metalness: 0.1 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData.naturalRadius = radius;
            return mesh;
        }

        /** Dựng lớp "sao lấm chấm" tái sinh (sliding-window, TÁI DÙNG kỹ thuật tRings Vortex — GIỮ
         * NGUYÊN từ lần viết trước) — dùng cho Galaxy Explore + Vacuum Void (KHÔNG dùng ở Sun
         * System, sao bay vèo qua sẽ phá cảm giác "quan sát hệ hành tinh"). To dần khi tiến gần là
         * nhờ sizeAttenuation CHUẨN của PointsMaterial. */
        function _createSpaceFieldStars(perf, pathParams, currentZ) {
            const count = perf.spaceFieldStars;
            const positions = new Float32Array(count * 3);
            const zs = [];
            for (let i = 0; i < count; i++) {
                const z = currentZ - Math.random() * SPACE_DEPTH;
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
            const points = new THREE.Points(geo, mat);
            appState.get('spScene').add(points);
            return points;
        }

        /** Cập nhật lớp "sao lấm chấm" tái sinh mỗi khung hình — gọi từ drawSpace() khi
         * spFieldStarPoints tồn tại (Galaxy Explore/Vacuum Void). */
        function updateSpaceFieldStars(currentZ, pathParams, beatScale) {
            const fieldPoints = appState.get('spFieldStarPoints');
            if (!fieldPoints) return;
            const posAttr = fieldPoints.geometry.attributes.position;
            const zs = appState.get('spFieldStarZs');
            for (let i = 0; i < zs.length; i++) {
                if (zs[i] > currentZ + 40) {
                    const newZ = currentZ - SPACE_DEPTH * (0.6 + Math.random() * 0.4);
                    const center = getSpacePathOffsetAt(newZ, pathParams);
                    const lateral = 80 + Math.random() * 900;
                    const angle = Math.random() * Math.PI * 2;
                    posAttr.array[i * 3] = center.x + Math.cos(angle) * lateral;
                    posAttr.array[i * 3 + 1] = center.y + Math.sin(angle) * lateral * 0.7;
                    posAttr.array[i * 3 + 2] = newZ;
                    zs[i] = newZ;
                }
            }
            posAttr.needsUpdate = true;
            fieldPoints.material.size = 5 + beatScale * 6;
        }

        // ============================================================================
        // GALAXY EXPLORE — nhiều thiên hà xoắn ốc, camera xuyên qua liên tục, tái sinh mượt
        // ============================================================================

        /** Dựng 1 thiên hà xoắn ốc — kỹ thuật ĐÃ ĐỐI CHIẾU với demo Giang gửi
         * (threejsdemos.com/demos/particles/galaxy: 4 nhánh, spinAngle=radius*1.2 ở bán kính tối đa
         * 15 -> ~18 rad xoắn) — quy đổi đúng tỉ lệ độ xoắn cho world-scale 380 của Space (GIỮ
         * NGUYÊN từ bản chỉnh trước, không đổi công thức). Bắt đầu opacity 0 để fade-in mượt —
         * KHÔNG BAO GIỜ "pop" đột ngột (mục yêu cầu Giang). */
        function _createGalaxySpiralPoints(perf) {
            const count = perf.spaceGalaxyStars;
            const positions = new Float32Array(count * 3);
            const colors = new Float32Array(count * 3);
            const colorCore = new THREE.Color(getComputedColor(0, 2, 200).fill);
            const colorEdge = new THREE.Color(getComputedColor(1, 2, 120).fill);
            const maxRadius = 380;
            const arms = 4;
            const spinCoefficient = 0.05;
            const randomness = 0.2;
            for (let i = 0; i < count; i++) {
                const radius = Math.random() * maxRadius;
                const armAngle = ((i % arms) / arms) * Math.PI * 2;
                const spinAngle = radius * spinCoefficient;
                const jitter = () => Math.pow(Math.random(), 2) * (Math.random() < 0.5 ? 1 : -1) * randomness * radius * 0.3;
                const angle = armAngle + spinAngle;
                positions[i * 3] = Math.cos(angle) * radius + jitter();
                positions[i * 3 + 1] = jitter() * 0.25;
                positions[i * 3 + 2] = Math.sin(angle) * radius + jitter();
                const mixed = colorCore.clone().lerp(colorEdge, radius / maxRadius);
                colors[i * 3] = mixed.r; colors[i * 3 + 1] = mixed.g; colors[i * 3 + 2] = mixed.b;
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            const mat = new THREE.PointsMaterial({ size: 6, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
            return new THREE.Points(geo, mat);
        }

        /** Khởi tạo Galaxy Explore — dựng `perf.spaceGalaxyCount` thiên hà, rải ĐỀU dọc trục Z
         * phía trước (cách nhau SPACE_GALAXY_SPACING) — LUÔN có sẵn >=2 thiên hà "đang tới" cùng
         * lúc, không đợi 1 thiên hà biến mất mới dựng cái mới (mục "không khựng/giật"). */
        function _initGalaxyExplore(perf, pathParams, currentZ) {
            appState.set('spFieldStarPoints', _createSpaceFieldStars(perf, pathParams, currentZ), { skipCheck: true });
            const slots = [];
            for (let i = 0; i < perf.spaceGalaxyCount; i++) {
                const z = currentZ - 600 - i * SPACE_GALAXY_SPACING;
                const points = _createGalaxySpiralPoints(perf);
                const center = getSpacePathOffsetAt(z, pathParams);
                points.position.set(center.x, center.y, z);
                appState.get('spContentGroup').add(points);
                slots.push({ points, z });
            }
            appState.set('spGalaxySlots', slots, { skipCheck: true });
        }

        /** Cập nhật Galaxy Explore mỗi khung hình — xoay + nhấp nháy kích thước theo audio, fade-in
         * opacity, VÀ tái sinh (sliding window, TÁI DÙNG kỹ thuật tRings Vortex) khi camera đã vượt
         * qua — thiên hà MỚI luôn dựng SẴN + fade-in TỪ TRƯỚC khi thiên hà cũ vừa khuất, đảm bảo
         * "không khựng/giật/pop đột ngột" như Giang yêu cầu. */
        function updateGalaxyExplore(currentZ, pathParams, perf, beatScale, smoothedEnergy) {
            const slots = appState.get('spGalaxySlots');
            slots.forEach(slot => {
                slot.points.rotation.y += 0.0012 + smoothedEnergy * 0.004;
                slot.points.material.size = 6 + beatScale * 4;
                if (slot.points.material.opacity < 0.89) slot.points.material.opacity += (0.9 - slot.points.material.opacity) * 0.03;

                if (slot.z > currentZ + 400) {
                    // Camera đã vượt qua xa — tái sinh NGAY thành thiên hà mới ở tận cùng phía
                    // trước hàng đợi (giữ khoảng cách đều giữa các thiên hà đang hoạt động).
                    const farthestZ = Math.min(...slots.map(s => s.z));
                    const newZ = farthestZ - SPACE_GALAXY_SPACING;
                    const center = getSpacePathOffsetAt(newZ, pathParams);
                    slot.points.position.set(center.x, center.y, newZ);
                    slot.points.material.opacity = 0; // fade-in lại từ đầu, mượt, không pop
                    slot.z = newZ;
                }
            });
        }

        // ============================================================================
        // SUN SYSTEM — hệ mặt trời thật (THREEx.Planets), camera zoom theo audio
        // ============================================================================

        /** Khởi tạo Sun System — dựng Mặt Trời + tối đa 6 hành tinh (Mercury/Venus/Earth/Mars/
         * Jupiter/Saturn — ĐÚNG THỨ TỰ khoảng cách thật, không random như bản trước, để bố cục
         * "toàn hệ" luôn giống nhau, dễ nhận biết) neo tại 1 điểm CỐ ĐỊNH phía trước camera. Mỗi
         * hành tinh tự quay quanh Mặt Trời (orbitSpeed riêng, hành tinh xa quay chậm hơn — đúng vật
         * lý cơ bản). THỬ THREEx.Planets TRƯỚC cho từng hành tinh, fallback procedural nếu lỗi. */
        function _initSunSystem(perf, pathParams, currentZ) {
            const anchorZ = currentZ - 900;
            const center = getSpacePathOffsetAt(anchorZ, pathParams);
            const planets = [];

            let sunMesh = null;
            try { sunMesh = _tryCreateThreexPlanet('createSun'); } catch (e) { console.warn('[three-space] THREEx.Planets.createSun lỗi — fallback procedural:', e); }
            if (!sunMesh) sunMesh = _createFallbackPlanetMesh(140, 255, perf);
            const sunScale = 130 / (sunMesh.userData.naturalRadius || 130);
            sunMesh.scale.setScalar(sunScale * 0.001);
            sunMesh.position.set(center.x, center.y, anchorZ);
            appState.get('spContentGroup').add(sunMesh);
            planets.push({ mesh: sunMesh, orbitRadius: 0, orbitSpeed: 0, angle: 0, isSun: true, targetScale: sunScale });

            const creators = ['createMercury', 'createVenus', 'createEarth', 'createMars', 'createJupiter', 'createSaturn'];
            creators.forEach((creatorName, idx) => {
                let mesh = null;
                try { mesh = _tryCreateThreexPlanet(creatorName); } catch (e) { console.warn(`[three-space] THREEx.Planets.${creatorName} lỗi — fallback procedural:`, e); }
                const desiredRadius = 40 + idx * 8;
                if (!mesh) mesh = _createFallbackPlanetMesh(desiredRadius, idx * 40, perf);
                const scaleFactor = desiredRadius / (mesh.userData.naturalRadius || desiredRadius);
                mesh.scale.setScalar(scaleFactor * 0.001);
                const orbitRadius = SPACE_SUN_ORBIT_RADII[idx];
                const angle = Math.random() * Math.PI * 2;
                mesh.position.set(center.x + Math.cos(angle) * orbitRadius, center.y, anchorZ + Math.sin(angle) * orbitRadius);
                appState.get('spContentGroup').add(mesh);
                planets.push({ mesh, orbitRadius, orbitSpeed: 0.12 / (idx + 1.5), angle, isSun: false, targetScale: scaleFactor });
            });

            appState.set('spSunPlanets', planets, { skipCheck: true });
            appState.set('spSunFocusIndex', 1, { skipCheck: true }); // bắt đầu tại hành tinh gần nhất (idx 0 = Mặt Trời)
            appState.set('spSunZoomLerp', 0, { skipCheck: true });
        }

        /** Cập nhật Sun System mỗi khung hình — hành tinh tự quay quanh Mặt Trời (tốc độ CỐ ĐỊNH,
         * không theo audio — quỹ đạo thật không nên "giật cục" theo nhịp nhạc); fade-in scale;
         * CAMERA mới là phần audio-reactive chính (xem drawSpace() — spSunZoomLerp/spSunFocusIndex). */
        function updateSunSystem(perf) {
            const planets = appState.get('spSunPlanets');
            const anchor = planets.find(p => p.isSun);
            planets.forEach(p => {
                const targetScale = p.targetScale;
                if (p.mesh.scale.x < targetScale - 0.0005) {
                    p.mesh.scale.setScalar(p.mesh.scale.x + (targetScale - p.mesh.scale.x) * 0.04);
                }
                if (!p.isSun && anchor) {
                    p.angle += p.orbitSpeed * 0.01;
                    p.mesh.position.x = anchor.mesh.position.x + Math.cos(p.angle) * p.orbitRadius;
                    p.mesh.position.z = anchor.mesh.position.z + Math.sin(p.angle) * p.orbitRadius;
                }
                p.mesh.rotation.y += 0.004;
            });
        }

        // ============================================================================
        // VACUUM VOID — chỉ có hạt/thiên thạch, va chạm = kính vỡ + sóng năng lượng
        // ============================================================================

        /** Khởi tạo Vacuum Void — dựng pool thiên thạch THREE.Points gốc (ĐÃ XÁC NHẬN ổn định qua
         * mọi lần thử trước — BỎ HẲN thư viện particle ngoài theo yêu cầu Giang). Không có sector
         * content nào khác (spContentGroup trống — "chỉ có các hạt"). */
        function _initVacuumVoid(perf, pathParams, currentZ) {
            appState.set('spFieldStarPoints', _createSpaceFieldStars(perf, pathParams, currentZ), { skipCheck: true });
            appState.set('spGroupMeteors', new THREE.Group(), { skipCheck: true });
            appState.get('spScene').add(appState.get('spGroupMeteors'));
            const meteorGeo = new THREE.BoxGeometry(10, 10, 160);
            const glowTex = appState.get('spGlowTexture');
            const meteorPool = [];
            for (let i = 0; i < perf.spaceMeteorPool; i++) {
                const m = new THREE.Mesh(meteorGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
                const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
                glowSprite.scale.set(60, 60, 1);
                glowSprite.position.set(0, 0, 80);
                m.add(glowSprite);
                m.visible = false;
                m.userData = { active: false, life: 0, vx: 0, vy: 0, vz: 0, glowSprite };
                meteorPool.push(m);
                appState.get('spGroupMeteors').add(m);
            }
            appState.set('spMeteorPool', meteorPool, { skipCheck: true });
            appState.set('spShatterShards', [], { skipCheck: true });
            appState.set('spEnergyWaves', [], { skipCheck: true });
        }

        /** Kích hoạt 1 thiên thạch còn RẢNH trong pool. GIỮ NGUYÊN pool THREE.Points gốc (đã xác
         * nhận ổn định). */
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

        /** Tạo 1 đợt "kính vỡ" — MỚI (19/07/2026, yêu cầu Giang "va chạm hiển thị dạng kính vỡ") —
         * ~14 mảnh tam giác nhỏ (PlaneGeometry cắt góc, MeshBasicMaterial trong mờ như kính) bay
         * toé ra từ điểm va chạm theo hướng ngẫu nhiên, tự xoay + mờ dần + rơi nhẹ (trọng lực giả). */
        function _spawnGlassShatter(position, color) {
            const shards = appState.get('spShatterShards');
            const shardGeo = new THREE.PlaneGeometry(14, 18);
            for (let i = 0; i < 14; i++) {
                const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
                const mesh = new THREE.Mesh(shardGeo, mat);
                mesh.position.copy(position);
                mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                const dir = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5), (Math.random() - 0.5)).normalize();
                const speed = 6 + Math.random() * 10;
                appState.get('spContentGroup').add(mesh);
                shards.push({
                    mesh, life: 1,
                    vx: dir.x * speed, vy: dir.y * speed + 2, vz: dir.z * speed,
                    rvx: (Math.random() - 0.5) * 0.2, rvy: (Math.random() - 0.5) * 0.2, rvz: (Math.random() - 0.5) * 0.2,
                });
            }
        }

        /** Tạo 1 vòng "sóng năng lượng" nở ra — MỚI (19/07/2026, yêu cầu Giang "bùng nổ năng lượng
         * wave") — THREE.RingGeometry additive, scale tăng dần + opacity giảm dần theo thời gian
         * sống, tạo cảm giác 1 đợt xung lan ra từ điểm va chạm. */
        function _spawnEnergyWave(position, color) {
            const waves = appState.get('spEnergyWaves');
            const geo = new THREE.RingGeometry(1, 1.4, 32);
            const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.copy(position);
            appState.get('spContentGroup').add(mesh);
            waves.push({ mesh, life: 1 });
        }

        /** Va chạm thiên thạch (mục Vacuum Void) — NGƯỠNG NÂNG LÊN (hiếm hơn, kịch tính hơn, theo
         * yêu cầu Giang) — kích hoạt rung camera + flash 2D + MẢNH VỠ KÍNH + SÓNG NĂNG LƯỢNG cùng
         * lúc tại đúng vị trí va chạm. */
        function triggerSpaceCollisionShake(position, color) {
            spShakeFrames = 24;
            spShakeMagnitude = 16 + Math.random() * 9;
            spFlashOpacity = 0.6;
            try {
                _spawnGlassShatter(position, color);
                _spawnEnergyWave(position, color);
            } catch (e) {
                console.warn('[three-space] Lỗi khi dựng hiệu ứng va chạm (kính vỡ/sóng năng lượng):', e);
            }
        }

        // ============================================================================
        // KHỞI TẠO CHUNG + CHUYỂN KIỂU CON
        // ============================================================================

        /** Khởi tạo TOÀN BỘ hạ tầng dùng chung: scene/camera/renderer/ánh sáng/đường bay cong/
         * starfield nền/composer bloom — CHỈ CHẠY 1 LẦN (gọi từ updateTypeUI() khi chuyển sang
         * kiểu 'space' lần đầu). Nội dung RIÊNG theo từng kiểu con dựng ở reinitSpaceStyleContent(). */
        function initThreeSpace() {
            const perf = PERFORMANCE_PROFILES[appState.get('vizConfig').quality];
            const tCanvas = document.getElementById('webgl-canvas');

            appState.set('spScene', new THREE.Scene(), { skipCheck: true });
            appState.get('spScene').fog = new THREE.FogExp2(0x000000, 0.00035);

            appState.set('spCamera', new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, SPACE_DEPTH), { skipCheck: true });
            appState.get('spCamera').position.set(0, 0, 0);

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

            const defaultPath = { freqX: 0.0007, freqY: 0.0005, ampX: 380, ampY: 260, phaseX: 0, phaseY: 0 };
            appState.set('spPathParams', { ...defaultPath }, { skipCheck: true });
            appState.set('spPathTarget', { ...defaultPath }, { skipCheck: true });
            appState.set('spPanAngle', 0, { skipCheck: true });

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

            appState.set('spCurrentDriftZ', 0, { skipCheck: true });
            appState.set('spInitialized', true, { skipCheck: true });

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

            reinitSpaceStyleContent();
        }

        /** Xoá SẠCH nội dung RIÊNG của kiểu con hiện tại (spContentGroup + pool thiên thạch/mảnh
         * vỡ/sóng năng lượng nếu có) rồi dựng lại theo `vizConfig.spaceStyle` — gọi lúc
         * initThreeSpace() lần đầu VÀ mỗi lần người dùng đổi kiểu con (setSpaceStyle(), xem
         * event/workflow/visualizer-display.js). KHÔNG đụng camera/renderer/ánh sáng/đường bay
         * cong/starfield nền dùng chung. */
        function reinitSpaceStyleContent() {
            const oldGroup = appState.get('spContentGroup');
            if (oldGroup) appState.get('spScene').remove(oldGroup);
            const oldMeteorGroup = appState.get('spGroupMeteors');
            if (oldMeteorGroup) appState.get('spScene').remove(oldMeteorGroup);
            const oldFieldStars = appState.get('spFieldStarPoints');
            if (oldFieldStars) appState.get('spScene').remove(oldFieldStars);

            appState.set('spContentGroup', new THREE.Group(), { skipCheck: true });
            appState.get('spScene').add(appState.get('spContentGroup'));
            appState.set('spGalaxySlots', [], { skipCheck: true });
            appState.set('spSunPlanets', [], { skipCheck: true });
            appState.set('spMeteorPool', [], { skipCheck: true });
            appState.set('spShatterShards', [], { skipCheck: true });
            appState.set('spEnergyWaves', [], { skipCheck: true });
            appState.set('spFieldStarPoints', undefined, { skipCheck: true });
            appState.set('spFieldStarZs', [], { skipCheck: true });

            const perf = PERFORMANCE_PROFILES[appState.get('vizConfig').quality];
            const pathParams = appState.get('spPathParams');
            const currentZ = appState.get('spCurrentDriftZ');
            const style = appState.get('vizConfig').spaceStyle;

            if (style === 'sunSystem') {
                _initSunSystem(perf, pathParams, currentZ);
            } else if (style === 'vacuumVoid') {
                _initVacuumVoid(perf, pathParams, currentZ);
            } else {
                _initGalaxyExplore(perf, pathParams, currentZ);
            }
        }
