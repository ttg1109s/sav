/**
 * Visual SPACE — VIẾT LẠI HOÀN TOÀN LẦN 3 (19/07/2026, phản hồi Giang "xoá hết viết lại hết
 * space") — dispatcher cập nhật mỗi khung hình theo `vizConfig.spaceStyle` (galaxyExplore/
 * sunSystem/vacuumVoid), gọi từ core/visualizer/draw-visualizer.js. Xem docstring đầu
 * core/webgl/three-space.js để biết đầy đủ kiến trúc 3 kiểu con.
 *
 * GIỮ NGUYÊN (yêu cầu Giang "giữ nguyên movement"): quỹ đạo cong nền (spPathParams, công thức TÁI
 * DÙNG từ Vortex) + lớp Ken Burns (spPanAngle, zoom+pan+chéo góc, audio-reactive) — dùng CHUNG cho
 * Galaxy Explore/Vacuum Void y hệt trước. Sun System TÁI SỬ DỤNG CÙNG CƠ CHẾ (spPanAngle quét liên
 * tục theo audio) nhưng đổi Ý NGHĨA: pan angle -> góc quỹ đạo camera bay quanh hệ/hành tinh tiêu
 * điểm, dolly -> khoảng cách quan sát (xa=toàn hệ lúc nhạc êm, gần=áp sát hành tinh lúc nhạc dồn) —
 * KHÔNG dùng quỹ đạo cong nền cho vị trí camera ở kiểu này (hệ mặt trời neo tại 1 điểm, không phải
 * "bay xuyên qua" như 2 kiểu kia).
 *
 * MIỄN kiến trúc /event/ và Rule 1-5 — giống Vortex.
 */
        function drawSpace(perf, isPlaying) {
            if (!appState.get('spInitialized')) return;
            const smoothedEnergy = appState.get('smoothedEnergy');
            const beatScale = appState.get('beatScale');
            const style = appState.get('vizConfig').spaceStyle;
            const cam = appState.get('spCamera');

            // Quỹ đạo cong nền + Ken Burns — GIỮ NGUYÊN cơ chế, dùng cho Galaxy Explore/Vacuum Void.
            // Sun System vẫn cập nhật (để chuyển kiểu mượt) nhưng KHÔNG dùng cho vị trí camera.
            updateSpacePathLerp();
            if (isPlaying && smoothedEnergy > 0.6 && Math.random() > 0.985) rollNewSpacePathCurve();
            const pathParams = appState.get('spPathParams');

            const targetSpeed = (style === 'sunSystem' ? 0.6 : 6) + smoothedEnergy * (style === 'sunSystem' ? 0.4 : 26);
            spDriftSpeed += (targetSpeed - spDriftSpeed) * 0.02;
            appState.set('spCurrentDriftZ', appState.get('spCurrentDriftZ') - spDriftSpeed, { skipCheck: true });
            const currentZ = appState.get('spCurrentDriftZ');

            if (style === 'sunSystem') {
                drawSunSystemFrame(perf, isPlaying, smoothedEnergy, beatScale, cam);
            } else if (style === 'vacuumVoid') {
                drawVacuumVoidFrame(perf, isPlaying, smoothedEnergy, beatScale, cam, currentZ, pathParams);
            } else {
                drawGalaxyExploreFrame(perf, isPlaying, smoothedEnergy, beatScale, cam, currentZ, pathParams);
            }

            if (spFlashOpacity > 0) spFlashOpacity *= 0.87;

            const composer = appState.get('spComposer');
            if (composer) composer.render();
            else appState.get('tRenderer').render(appState.get('spScene'), cam);
        }

        /** Cập nhật + render khung hình cho kiểu GALAXY EXPLORE — camera xuyên thẳng qua nhiều
         * thiên hà liên tiếp (đường bay cong nền + Ken Burns GIỮ NGUYÊN như trước). */
        function drawGalaxyExploreFrame(perf, isPlaying, smoothedEnergy, beatScale, cam, currentZ, pathParams) {
            updateGalaxyExplore(currentZ, pathParams, perf, beatScale, smoothedEnergy);
            updateSpaceFieldStars(currentZ, pathParams, beatScale);
            applySpaceKenBurnsCamera(cam, currentZ, pathParams, smoothedEnergy, beatScale, 0, 0);
            appState.get('spStarPoints').position.z = currentZ * 0.15;
        }

        /** Cập nhật + render khung hình cho kiểu VACUUM VOID — chỉ có hạt/thiên thạch, va chạm =
         * kính vỡ + sóng năng lượng (đường bay cong nền + Ken Burns GIỮ NGUYÊN). */
        function drawVacuumVoidFrame(perf, isPlaying, smoothedEnergy, beatScale, cam, currentZ, pathParams) {
            updateSpaceFieldStars(currentZ, pathParams, beatScale);
            applySpaceKenBurnsCamera(cam, currentZ, pathParams, smoothedEnergy, beatScale, 0, 0);
            appState.get('spStarPoints').position.z = currentZ * 0.15;

            // Thiên thạch — NGƯỠNG XUẤT HIỆN + VA CHẠM đều NÂNG LÊN (mục "hiếm hơn, kịch tính hơn"
            // Giang yêu cầu — trước đây 0.05+energy*0.12, giờ giảm xuống để hiếm hơn RÕ RỆT).
            if (isPlaying && Math.random() < 0.025 + smoothedEnergy * 0.05) trySpawnSpaceMeteor(currentZ, pathParams);
            const meteorPool = appState.get('spMeteorPool');
            meteorPool.forEach(m => {
                if (!m.userData.active) return;
                m.position.x += m.userData.vx;
                m.position.y += m.userData.vy;
                m.position.z += m.userData.vz;
                m.userData.life -= 0.018;
                const op = Math.max(0, Math.min(1, m.userData.life * 1.4)) * 0.95;
                m.material.opacity = op;
                m.userData.glowSprite.material.opacity = op;

                // NGƯỠNG VA CHẠM NÂNG LÊN (mục Giang) — khoảng cách phải RẤT gần (trước 110/130,
                // giờ 70/85) VÀ xác suất thấp hơn (trước >0.45, giờ >0.72) — va chạm hiếm, mỗi lần
                // xảy ra đáng nhớ, KHÔNG còn xảy ra liên tục vụn vặt.
                const distToCam = Math.abs(m.position.z - currentZ);
                if (distToCam < 70 && Math.abs(m.position.x - cam.position.x) < 85 && Math.abs(m.position.y - cam.position.y) < 85 && Math.random() > 0.72) {
                    triggerSpaceCollisionShake(m.position.clone(), m.material.color.getHex());
                }
                if (m.userData.life <= 0) { m.userData.active = false; m.visible = false; }
            });

            updateVacuumVoidEffects();
        }

        /** Cập nhật mảnh vỡ kính + sóng năng lượng đang hoạt động (mục Vacuum Void, MỚI 19/07/2026)
         * — mảnh vỡ bay xa dần + rơi nhẹ + xoay + mờ dần; sóng năng lượng nở to dần + mờ dần. Cả 2
         * tự dọn khỏi scene khi hết đời (life<=0), KHÔNG rò rỉ bộ nhớ. */
        function updateVacuumVoidEffects() {
            const shards = appState.get('spShatterShards');
            for (let i = shards.length - 1; i >= 0; i--) {
                const s = shards[i];
                s.mesh.position.x += s.vx; s.mesh.position.y += s.vy; s.mesh.position.z += s.vz;
                s.vy -= 0.15; // trọng lực giả nhẹ
                s.mesh.rotation.x += s.rvx; s.mesh.rotation.y += s.rvy; s.mesh.rotation.z += s.rvz;
                s.life -= 0.02;
                s.mesh.material.opacity = Math.max(0, s.life) * 0.85;
                if (s.life <= 0) {
                    appState.get('spContentGroup').remove(s.mesh);
                    shards.splice(i, 1);
                }
            }
            const waves = appState.get('spEnergyWaves');
            for (let i = waves.length - 1; i >= 0; i--) {
                const w = waves[i];
                w.life -= 0.03;
                const scale = 1 + (1 - w.life) * 90;
                w.mesh.scale.setScalar(scale);
                w.mesh.material.opacity = Math.max(0, w.life) * 0.9;
                w.mesh.lookAt(appState.get('spCamera').position);
                if (w.life <= 0) {
                    appState.get('spContentGroup').remove(w.mesh);
                    waves.splice(i, 1);
                }
            }
        }

        /** Cập nhật + render khung hình cho kiểu SUN SYSTEM — hành tinh tự quay quanh Mặt Trời
         * (updateSunSystem(), tốc độ cố định), CAMERA orbit quanh hệ/hành tinh tiêu điểm — TÁI
         * DÙNG spPanAngle (Ken Burns) nhưng đổi ý nghĩa thành GÓC QUỸ ĐẠO camera, zoomLerp (0=toàn
         * hệ lúc nhạc êm, 1=áp sát hành tinh lúc nhạc dồn) thay cho dolly tuyến tính trước đây —
         * ĐÚNG yêu cầu Giang "nhạc chậm zoom out quan sát toàn hệ, nhạc nhanh zoom in + di chuyển
         * qua lại giữa các hành tinh", VẪN dựa vào audio xuyên suốt. */
        function drawSunSystemFrame(perf, isPlaying, smoothedEnergy, beatScale, cam) {
            updateSunSystem(perf);
            const planets = appState.get('spSunPlanets');
            if (planets.length === 0) return;
            const sun = planets.find(p => p.isSun) || planets[0];

            // Đổi hành tinh tiêu điểm khi nhạc đủ mạnh — "di chuyển qua lại giữa các hành tinh".
            if (isPlaying && smoothedEnergy > 0.6 && Math.random() > 0.985) {
                appState.set('spSunFocusIndex', 1 + Math.floor(Math.random() * (planets.length - 1)), { skipCheck: true });
            }
            const focus = planets[appState.get('spSunFocusIndex')] || sun;

            // zoomLerp: nội suy CHẬM theo smoothedEnergy — 0 = toàn hệ (nhạc êm), 1 = áp sát hành
            // tinh (nhạc dồn dập) — mượt, không giật cục theo từng khung hình đơn lẻ.
            const targetZoom = smoothedEnergy;
            appState.set('spSunZoomLerp', appState.get('spSunZoomLerp') + (targetZoom - appState.get('spSunZoomLerp')) * 0.008, { skipCheck: true });
            const zoomLerp = appState.get('spSunZoomLerp');

            const wideDistance = 1500, closeDistance = 220;
            const distance = wideDistance + (closeDistance - wideDistance) * zoomLerp;
            const lookAtX = sun.mesh.position.x + (focus.mesh.position.x - sun.mesh.position.x) * zoomLerp;
            const lookAtY = sun.mesh.position.y + (focus.mesh.position.y - sun.mesh.position.y) * zoomLerp;
            const lookAtZ = sun.mesh.position.z + (focus.mesh.position.z - sun.mesh.position.z) * zoomLerp;

            // Góc quỹ đạo camera (TÁI DÙNG spPanAngle, Ken Burns) — quét liên tục theo audio, cho
            // cảm giác "bay lượn quanh hệ" thay vì đứng yên 1 góc.
            appState.set('spPanAngle', appState.get('spPanAngle') + 0.0012 + smoothedEnergy * 0.0025, { skipCheck: true });
            const panAngle = appState.get('spPanAngle');
            const camTargetX = lookAtX + Math.cos(panAngle) * distance;
            const camTargetZ = lookAtZ + Math.sin(panAngle) * distance;
            const camTargetY = lookAtY + 140 + Math.sin(panAngle * 0.4) * 70 - zoomLerp * 60;

            cam.position.x += (camTargetX - cam.position.x) * 0.04;
            cam.position.y += (camTargetY - cam.position.y) * 0.04;
            cam.position.z += (camTargetZ - cam.position.z) * 0.04;
            cam.lookAt(lookAtX, lookAtY, lookAtZ);

            const targetFov = 65 - beatScale * 6;
            cam.fov += (targetFov - cam.fov) * 0.08;
            cam.updateProjectionMatrix();
        }

        /** Áp dụng camera Ken Burns (zoom+pan+chéo góc, GIỮ NGUYÊN công thức từ trước) bám theo
         * quỹ đạo cong nền — dùng chung cho Galaxy Explore + Vacuum Void. `extraPanX/extraPanY` dự
         * phòng mở rộng sau này (hiện truyền 0). */
        function applySpaceKenBurnsCamera(cam, currentZ, pathParams, smoothedEnergy, beatScale, extraPanX, extraPanY) {
            appState.set('spPanAngle', appState.get('spPanAngle') + 0.0007 + smoothedEnergy * 0.0013, { skipCheck: true });
            const panAngle = appState.get('spPanAngle');
            const panRadius = 55 + smoothedEnergy * 95;
            const kenBurnsPanX = Math.cos(panAngle) * panRadius + extraPanX;
            const kenBurnsPanY = Math.sin(panAngle * 0.72) * panRadius * 0.6 + extraPanY;
            const kenBurnsDolly = Math.sin(panAngle * 0.35) * (70 + smoothedEnergy * 130);

            const targetFov = 70 - beatScale * 8 - Math.sin(panAngle * 0.35) * 4;
            cam.fov += (targetFov - cam.fov) * 0.08;
            cam.updateProjectionMatrix();

            const camTargetPos = getSpacePathOffsetAt(currentZ, pathParams);
            let shakeX = 0, shakeY = 0;
            if (spShakeFrames > 0) {
                shakeX = (Math.random() - 0.5) * spShakeMagnitude;
                shakeY = (Math.random() - 0.5) * spShakeMagnitude;
                spShakeMagnitude *= 0.9;
                spShakeFrames--;
            }
            cam.position.x += (camTargetPos.x + kenBurnsPanX + shakeX - cam.position.x) * 0.05;
            cam.position.y += (camTargetPos.y + kenBurnsPanY + shakeY - cam.position.y) * 0.05;
            cam.position.z = currentZ + kenBurnsDolly;

            const lookAheadZ = currentZ - 800;
            const lookPos = getSpacePathOffsetAt(lookAheadZ, pathParams);
            cam.lookAt(lookPos.x, lookPos.y, lookAheadZ);
        }
