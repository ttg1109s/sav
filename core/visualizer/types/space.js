/**
 * Visual SPACE — "Drifting Space": trôi giữa các thiên thể theo đường bay CONG (quỹ đạo nền, tái
 * dùng công thức Vortex) CỘNG THÊM lớp chuyển động kiểu Ken Burns (zoom + pan mọi hướng kể cả chéo
 * góc, audio-reactive — tư duy y hệt slideshow Ken Burns, xem core/file-manager/slideshow.js,
 * SLIDESHOW_KENBURNS_MODES: panLeft/Right/Top/Bottom, zoomIn/Out, zoomPanLeft/Right/Top/Bottom).
 * Cập nhật mỗi khung hình, gọi từ core/visualizer/draw-visualizer.js.
 *
 * VIẾT LẠI LẦN 2 (19/07/2026, phản hồi Giang "đập đi viết lại hết") — xem docstring đầu
 * core/webgl/three-space.js để biết đầy đủ những gì đã đổi (planet texture/star sprite+light/star
 * field tái sinh/khung kính SVG). File này thêm:
 *   - Lớp Ken Burns: pan theo góc quét LIÊN TỤC (spPanAngle, tần số X/Y LỆCH nhau → quét kiểu
 *     Lissajous, tự nhiên đi qua MỌI hướng kể cả chéo góc theo thời gian, không cần liệt kê rời rạc
 *     8 hướng như slideshow vì camera 3D di chuyển liên tục) + "zoom" THẬT gồm CẢ dolly (tiến/lùi
 *     dọc trục nhìn) LẪN FOV thở — biên độ/tốc độ đều tăng theo smoothedEnergy (BẮT BUỘC dựa vào
 *     audio, theo yêu cầu Giang).
 *   - Cập nhật lớp "sao lấm chấm" tái sinh (spFieldStarPoints/spFieldStarZs) mỗi khung hình —
 *     kích thước điểm cũng nhấp nháy theo beatScale.
 *   - Ngôi sao: cường độ PointLight thật nhấp nháy theo audio. Dải ngân hà: xoay + kích thước điểm
 *     nhấp nháy theo audio.
 *
 * MIỄN kiến trúc /event/ và Rule 1-5 — giống Vortex.
 */
        function drawSpace(perf, isPlaying) {
            if (!appState.get('spInitialized')) return;
            const smoothedEnergy = appState.get('smoothedEnergy');
            const beatScale = appState.get('beatScale');

            // 1. Tốc độ trôi dọc quỹ đạo nền theo nhạc.
            const targetSpeed = 6 + smoothedEnergy * 26;
            spDriftSpeed += (targetSpeed - spDriftSpeed) * 0.02;
            appState.set('spCurrentDriftZ', appState.get('spCurrentDriftZ') - spDriftSpeed, { skipCheck: true });
            const currentZ = appState.get('spCurrentDriftZ');

            // 2. Quỹ đạo cong NỀN (tái dùng kỹ thuật Vortex) — vẫn giữ, đây là "khung xương" lớn;
            // Ken Burns (bước 6) là lớp chuyển động THÊM VÀO trên nền này, không thay thế.
            updateSpacePathLerp();
            if (isPlaying && smoothedEnergy > 0.6 && Math.random() > 0.985) rollNewSpacePathCurve();
            const pathParams = appState.get('spPathParams');

            // 3. "Sang khu vực khác theo nhạc".
            const sectorObj = appState.get('spGroupSector').children[0];
            const gapToSector = sectorObj ? (currentZ - sectorObj.position.z) : Infinity;
            const closeToSector = gapToSector < 300;
            if (isPlaying && (closeToSector || (smoothedEnergy > 0.7 && Math.random() > 0.99))) {
                rollNewSpaceSector(currentZ, perf);
            }

            // 3b. Fade-in + hiệu ứng RIÊNG theo loại thiên thể (audio-reactive — mục "quan trọng
            // phải dựa vào audio"): NGÔI SAO -> PointLight thật nhấp nháy cường độ theo beat; DẢI
            // NGÂN HÀ -> xoay liên tục (nhanh hơn khi nhạc mạnh) + kích thước điểm nhấp nháy.
            if (sectorObj) {
                if (sectorObj.isPoints) {
                    if (sectorObj.material.opacity < sectorObj.userData.targetOpacity - 0.01) {
                        sectorObj.material.opacity += (sectorObj.userData.targetOpacity - sectorObj.material.opacity) * 0.04;
                    }
                    if (sectorObj.userData.kind === 'galaxy') {
                        sectorObj.rotation.y += 0.0012 + smoothedEnergy * 0.004;
                        sectorObj.material.size = sectorObj.userData.baseSize + beatScale * 4;
                    }
                } else {
                    if (sectorObj.scale.x < 0.999) {
                        const s = sectorObj.scale.x + (1 - sectorObj.scale.x) * 0.05;
                        sectorObj.scale.setScalar(s);
                    }
                    if (sectorObj.userData.kind === 'star' && sectorObj.userData.starLight) {
                        sectorObj.userData.starLight.intensity = 1.6 + beatScale * 2.2 + smoothedEnergy * 1.2;
                    }
                }
            }

            // 4. Star field tái sinh (mục "sao lấm chấm to dần khi tiến tới") — sliding-window TÁI
            // DÙNG kỹ thuật tRings của Vortex: sao nào camera đã vượt qua -> đưa lại thật xa phía
            // trước, quanh tâm quỹ đạo cong tại Z mới. To dần khi tiến gần là do sizeAttenuation
            // CHUẨN của PointsMaterial (không tự chế shader) — hoàn toàn tự động, không cần code gì
            // thêm ở đây ngoài việc dời vị trí lúc tái sinh.
            const fieldPoints = appState.get('spFieldStarPoints');
            if (fieldPoints) {
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
                fieldPoints.material.size = 5 + beatScale * 6; // audio-reactive: to hẳn theo nhịp
            }

            // 5. Sao băng/thiên thạch.
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

                const cam = appState.get('spCamera');
                const distToCam = Math.abs(m.position.z - currentZ);
                if (distToCam < 110 && Math.abs(m.position.x - cam.position.x) < 130 && Math.abs(m.position.y - cam.position.y) < 130 && Math.random() > 0.45) {
                    triggerSpaceCollisionShake();
                }
                if (m.userData.life <= 0) { m.userData.active = false; m.visible = false; }
            });

            // 6. KEN BURNS (MỚI — "zoom + pan mọi chiều, kể cả chéo góc", tư duy y hệt slideshow) —
            // spPanAngle quét LIÊN TỤC (rad, không giới hạn), lấy sin/cos ở 2 TẦN SỐ LỆCH NHAU cho
            // trục X/Y (kiểu Lissajous) -> tự nhiên vẽ nên đường quét đi qua MỌI hướng kể cả chéo
            // góc theo thời gian, không lặp lại y hệt chu kỳ trước. Biên độ + tốc độ quét đều tăng
            // theo smoothedEnergy (BẮT BUỘC dựa vào audio). "Zoom" THẬT gồm dolly (đẩy camera tiến/
            // lùi dọc trục Z so với quỹ đạo nền) CỘNG FOV thở — không chỉ đổi FOV suông.
            appState.set('spPanAngle', appState.get('spPanAngle') + 0.0007 + smoothedEnergy * 0.0013, { skipCheck: true });
            const panAngle = appState.get('spPanAngle');
            const panRadius = 55 + smoothedEnergy * 95;
            const kenBurnsPanX = Math.cos(panAngle) * panRadius;
            const kenBurnsPanY = Math.sin(panAngle * 0.72) * panRadius * 0.6; // tần số Y lệch X -> Lissajous, quét chéo góc
            const kenBurnsDolly = Math.sin(panAngle * 0.35) * (70 + smoothedEnergy * 130); // "zoom" thật: tiến/lùi dọc trục nhìn

            const cam = appState.get('spCamera');
            const targetFov = 70 - beatScale * 8 - Math.sin(panAngle * 0.35) * 4; // FOV thở CỘNG THÊM zoom nhịp beat
            cam.fov += (targetFov - cam.fov) * 0.08;
            cam.updateProjectionMatrix();

            // 7. Camera bám theo TÂM quỹ đạo cong nền + Ken Burns pan CỘNG THÊM + rung va chạm.
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

            // 8. Flash va chạm tắt dần.
            if (spFlashOpacity > 0) spFlashOpacity *= 0.87;

            // 9. Starfield nền xa trôi CHẬM hơn hẳn (thị sai/parallax).
            appState.get('spStarPoints').position.z = currentZ * 0.15;

            // 10. Render — ưu tiên composer bloom thật, fallback render thẳng nếu không tải được.
            const composer = appState.get('spComposer');
            if (composer) composer.render();
            else appState.get('tRenderer').render(appState.get('spScene'), cam);
        }
