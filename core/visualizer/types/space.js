/**
 * Visual SPACE — "Drifting Space": trôi giữa các thiên thể (hành tinh/ngôi sao/dải ngân hà) —
 * cập nhật mỗi khung hình, gọi từ vòng lặp render chính (core/visualizer/draw-visualizer.js).
 * (Khởi tạo scene/camera/nhóm thiên thể/pool sao băng nằm ở core/webgl/three-space.js, hàm
 * initThreeSpace() — xem file đó để biết đầy đủ cấu trúc dữ liệu dùng ở đây.)
 *
 * File này CHỈ chứa phần cập nhật vị trí/tốc độ/camera mỗi khung hình — CÙNG NGOẠI LỆ /event/ và
 * Rule 1-5 như Vortex (xem comment đầu core/webgl/three-space.js/core/visualizer/types/vortex.js).
 */
        function drawSpace(perf, isPlaying) {
            if (!appState.get('spInitialized')) return;
            const smoothedEnergy = appState.get('smoothedEnergy');
            const beatScale = appState.get('beatScale');

            // 1. Tốc độ trôi theo nhạc (item 3: "tốc độ trôi theo nhạc") — lerp mượt, TRÁNH tăng/
            // giảm tốc đột ngột, đúng tinh thần tWarpSpeed của Vortex.
            const targetSpeed = 6 + smoothedEnergy * 26;
            spDriftSpeed += (targetSpeed - spDriftSpeed) * 0.02;
            appState.set('spCurrentDriftZ', appState.get('spCurrentDriftZ') - spDriftSpeed, { skipCheck: true });
            const currentZ = appState.get('spCurrentDriftZ');

            // 2. "Sang khu vực khác theo nhạc" (item 3) — khi camera đã trôi gần hết khoảng cách
            // tới thiên thể hiện tại, HOẶC nhạc đủ mạnh (bất ngờ đổi hướng sớm), roll sang thiên
            // thể MỚI (khác loại) — cùng cơ chế rollNewVortexCurve() của Vortex.
            const sectorObj = appState.get('spGroupSector').children[0];
            const gapToSector = sectorObj ? (currentZ - sectorObj.position.z) : Infinity; // dương = còn cách, tiến dần về 0 khi trôi qua gần
            const closeToSector = gapToSector < 300;
            if (isPlaying && (closeToSector || (smoothedEnergy > 0.7 && Math.random() > 0.99))) {
                rollNewSpaceSector(currentZ, perf);
            }

            // 3. "Xa/gần thiên thể theo nhạc" (item 3) — bass mạnh kéo cảm giác lại gần hơn 1 chút
            // bằng cách thở FOV nhẹ (tránh đổi vị trí camera, dễ xung đột với lookAt bên dưới).
            const cam = appState.get('spCamera');
            const targetFov = 70 - beatScale * 8;
            cam.fov += (targetFov - cam.fov) * 0.08;
            cam.updateProjectionMatrix();

            // 4. Sao băng/thiên thạch — xác suất xuất hiện THEO TỈ LỆ NĂNG LƯỢNG (item 3), càng
            // mạnh nhạc càng dễ bắn thêm. Cập nhật + tái sử dụng pool (không tạo mesh mới mỗi lần).
            if (isPlaying && Math.random() < 0.02 + smoothedEnergy * 0.05) trySpawnSpaceMeteor(currentZ);
            const meteorPool = appState.get('spMeteorPool');
            meteorPool.forEach(m => {
                if (!m.userData.active) return;
                m.position.x += m.userData.vx;
                m.position.y += m.userData.vy;
                m.position.z += m.userData.vz;
                m.userData.life -= 0.02;
                m.material.opacity = Math.max(0, Math.min(1, m.userData.life * 1.4)) * 0.9;

                // "Có tỉ lệ sẽ bị va chạm gây rung lắc nhẹ cho camera" (item 3) — thiên thạch bay
                // NGANG QUA rất gần trục camera -> xác suất nhỏ kích hoạt rung (không phải va chạm
                // nào cũng rung, đúng chữ "có tỉ lệ").
                const distToCam = Math.abs(m.position.z - currentZ);
                if (distToCam < 60 && Math.abs(m.position.x) < 90 && Math.abs(m.position.y) < 90 && Math.random() > 0.6) {
                    triggerSpaceCollisionShake();
                }
                if (m.userData.life <= 0) { m.userData.active = false; m.visible = false; }
            });

            // 5. Camera trôi thẳng dọc Z (không gian mở, không uốn cong theo tunnel như Vortex) —
            // rung nhẹ khi vừa va chạm, biên độ giảm dần mỗi khung hình (item 3).
            let shakeX = 0, shakeY = 0;
            if (spShakeFrames > 0) {
                shakeX = (Math.random() - 0.5) * spShakeMagnitude;
                shakeY = (Math.random() - 0.5) * spShakeMagnitude;
                spShakeMagnitude *= 0.9;
                spShakeFrames--;
            }
            cam.position.set(shakeX, shakeY, currentZ);
            cam.lookAt(shakeX, shakeY, currentZ - 800);

            // 6. Starfield nền trôi CHẬM hơn hẳn thiên thể chính (thị sai/parallax) — tạo cảm giác
            // chiều sâu thay vì mọi lớp trôi cứng nhắc cùng 1 tốc độ.
            appState.get('spStarPoints').position.z = currentZ * 0.15;

            appState.get('tRenderer').render(appState.get('spScene'), cam);
        }
