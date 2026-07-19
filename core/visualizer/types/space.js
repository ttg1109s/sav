/**
 * Visual SPACE — "Drifting Space": trôi giữa các thiên thể (hành tinh/ngôi sao/dải ngân hà) theo
 * đường bay CONG (không còn đâm thẳng) — cập nhật mỗi khung hình, gọi từ vòng lặp render chính
 * (core/visualizer/draw-visualizer.js). Khởi tạo scene/camera/ánh sáng/nhóm thiên thể/pool sao
 * băng/composer bloom nằm ở core/webgl/three-space.js — xem file đó để biết đầy đủ.
 *
 * VIẾT LẠI TOÀN DIỆN (19/07/2026, phản hồi Giang) — cùng đợt với core/webgl/three-space.js, xem
 * docstring đầu file đó để biết đầy đủ 6 mục đã sửa (ánh sáng thật/quỹ đạo cong/thiên thạch to-
 * sáng hơn/fade-in/va chạm rõ ràng/tích hợp UnrealBloomPass thật).
 *
 * File này CHỈ chứa phần cập nhật vị trí/tốc độ/camera mỗi khung hình — CÙNG NGOẠI LỆ /event/ và
 * Rule 1-5 như Vortex.
 */
        function drawSpace(perf, isPlaying) {
            if (!appState.get('spInitialized')) return;
            const smoothedEnergy = appState.get('smoothedEnergy');
            const beatScale = appState.get('beatScale');

            // 1. Tốc độ trôi theo nhạc — lerp mượt, TRÁNH tăng/giảm tốc đột ngột.
            const targetSpeed = 6 + smoothedEnergy * 26;
            spDriftSpeed += (targetSpeed - spDriftSpeed) * 0.02;
            appState.set('spCurrentDriftZ', appState.get('spCurrentDriftZ') - spDriftSpeed, { skipCheck: true });
            const currentZ = appState.get('spCurrentDriftZ');

            // 2. Đường bay CONG (mục 2, viết lại) — nội suy hình dáng hiện tại, thỉnh thoảng đổi
            // hướng mới khi nhạc đủ mạnh (TÁI DÙNG kỹ thuật Vortex, xem core/webgl/three-space.js).
            updateSpacePathLerp();
            if (isPlaying && smoothedEnergy > 0.6 && Math.random() > 0.985) rollNewSpacePathCurve();
            const pathParams = appState.get('spPathParams');

            // 3. "Sang khu vực khác theo nhạc" — khi camera đã trôi gần hết khoảng cách tới thiên
            // thể hiện tại, HOẶC nhạc đủ mạnh, roll sang thiên thể MỚI (khác loại).
            const sectorObj = appState.get('spGroupSector').children[0];
            const gapToSector = sectorObj ? (currentZ - sectorObj.position.z) : Infinity;
            const closeToSector = gapToSector < 300;
            if (isPlaying && (closeToSector || (smoothedEnergy > 0.7 && Math.random() > 0.99))) {
                rollNewSpaceSector(currentZ, perf);
            }

            // 3b. FADE-IN thiên thể (mục 4) — Mesh (planet/star) fade bằng scale 0->1, Points
            // (galaxy) fade bằng opacity 0->targetOpacity (Points scale=0 sẽ trông sai vì mật độ
            // hạt không đổi, chỉ có kích thước chấm nhỏ lại — dùng opacity đúng bản chất hơn).
            if (sectorObj) {
                if (sectorObj.isPoints) {
                    if (sectorObj.material.opacity < sectorObj.userData.targetOpacity - 0.01) {
                        sectorObj.material.opacity += (sectorObj.userData.targetOpacity - sectorObj.material.opacity) * 0.04;
                    }
                } else if (sectorObj.scale.x < 0.999) {
                    const s = sectorObj.scale.x + (1 - sectorObj.scale.x) * 0.05;
                    sectorObj.scale.setScalar(s);
                }
            }

            // 4. Xa/gần thiên thể theo nhạc — bass mạnh kéo cảm giác lại gần hơn bằng FOV thở nhẹ.
            const cam = appState.get('spCamera');
            const targetFov = 70 - beatScale * 8;
            cam.fov += (targetFov - cam.fov) * 0.08;
            cam.updateProjectionMatrix();

            // 5. Sao băng/thiên thạch — xác suất xuất hiện THEO TỈ LỆ NĂNG LƯỢNG, TĂNG đáng kể so
            // với bản trước (mục 3 — trước đây quá hiếm + quá xa 2 bên nên "không thấy").
            if (isPlaying && Math.random() < 0.05 + smoothedEnergy * 0.12) trySpawnSpaceMeteor(currentZ, pathParams);
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

                // Va chạm: thiên thạch bay NGANG QUA rất gần trục camera -> rung + flash (mục 5).
                const distToCam = Math.abs(m.position.z - currentZ);
                if (distToCam < 110 && Math.abs(m.position.x - cam.position.x) < 130 && Math.abs(m.position.y - cam.position.y) < 130 && Math.random() > 0.45) {
                    triggerSpaceCollisionShake();
                }
                if (m.userData.life <= 0) { m.userData.active = false; m.visible = false; }
            });

            // 6. Camera bám theo TÂM đường bay cong (mục 2, viết lại — trước đây đâm thẳng dọc Z,
            // giờ trôi lệch trái/phải/lên/xuống theo getSpacePathOffsetAt(), y hệt tinh thần Vortex
            // theo tunnel nhưng biên độ/tần số rộng-chậm hơn cho cảm giác "sải cánh" giữa không
            // gian mở). Rung nhẹ CỘNG THÊM vào vị trí cong khi vừa va chạm.
            const camTargetPos = getSpacePathOffsetAt(currentZ, pathParams);
            let shakeX = 0, shakeY = 0;
            if (spShakeFrames > 0) {
                shakeX = (Math.random() - 0.5) * spShakeMagnitude;
                shakeY = (Math.random() - 0.5) * spShakeMagnitude;
                spShakeMagnitude *= 0.9;
                spShakeFrames--;
            }
            cam.position.x += (camTargetPos.x + shakeX - cam.position.x) * 0.05;
            cam.position.y += (camTargetPos.y + shakeY - cam.position.y) * 0.05;
            cam.position.z = currentZ;

            const lookAheadZ = currentZ - 800;
            const lookPos = getSpacePathOffsetAt(lookAheadZ, pathParams);
            cam.lookAt(lookPos.x, lookPos.y, lookAheadZ);

            // 7. Flash va chạm (mục 5) tắt dần mỗi khung hình — vẽ thật ở draw-visualizer.js qua
            // drawSpaceCollisionFlash() (canvas 2D, xem core/visualizer/draw/space-collision-flash.js).
            if (spFlashOpacity > 0) spFlashOpacity *= 0.87;

            // 8. Starfield nền trôi CHẬM hơn hẳn thiên thể chính (thị sai/parallax).
            appState.get('spStarPoints').position.z = currentZ * 0.15;

            // 9. Render — ƯU TIÊN qua composer bloom (thư viện thật, mục 6) nếu khởi tạo thành
            // công; FALLBACK render thẳng renderer.render() nếu composer null (CDN lỗi mạng...).
            const composer = appState.get('spComposer');
            if (composer) composer.render();
            else appState.get('tRenderer').render(appState.get('spScene'), cam);
        }
