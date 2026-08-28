/**
 * Visual VORTEX — cập nhật mỗi khung hình cho đường ống bay xuyên không gian dựng bằng Three.js
 * (khởi tạo scene/camera/group nằm ở core/webgl/three-vortex.js, hàm initThreeJS() — dời vào core/webgl/ 19/07/2026). File này chỉ
 * chứa phần cập nhật vị trí/màu/camera mỗi frame, gọi từ vòng lặp render chính. Logic gốc giữ
 * nguyên 1:1.
 */
        function drawVortex(perf, isPlaying) {
            if (!appState.get('tInitialized')) return;
            const bufferLength = appState.get('analyser').frequencyBinCount;
            const smoothedEnergy = appState.get('smoothedEnergy');
            const cfg = getActiveEffectConfig(); // core/custom-effect.js
            const vizDataArray = appState.get('vizDataArray');

            // 1. Nội suy mượt hình dáng ống — hướng rẽ MỚI (theo nốt nhạc + music transition) do
            // Workflow tự tính riêng (_tickVortexCurve(), event/workflow/visualizer-render.js),
            // ghi thẳng vào tPathTarget; ở đây chỉ còn việc nội suy dần tới target đó.
            updateVortexCurveLerp();

            // 2. Cập nhật tốc độ bay (Gia tốc rất mượt theo nhạc, tránh tăng/giảm tốc đột ngột)
            const targetWarpSpeed = cfg.warpSpeedBase + smoothedEnergy * cfg.warpSpeedEnergyMult;
            tWarpSpeed += (targetWarpSpeed - tWarpSpeed) * 0.025;
            appState.set('tCurrentWarpZ', appState.get('tCurrentWarpZ') - tWarpSpeed, { skipCheck: true }); // Bay sâu vào âm Z
            const tCurrentWarpZ = appState.get('tCurrentWarpZ');

            // -> STYLE: RINGS (Vòng ánh sáng)
            if (cfg.vortexStyle === 'rings') {
                const tRings = appState.get('tRings');
                appState.mutate('tRings', arr => arr.forEach((ring, idx) => {
                    ring.position.z += tWarpSpeed * 0.8;
                    if (ring.position.z > tCurrentWarpZ + 200) ring.position.z -= TUNNEL_DEPTH;
                    
                    const center = getVortexCenterAt(ring.position.z);
                    ring.position.x = center.x; ring.position.y = center.y;
                    
                    // Scale giật theo nhạc
                    const val = vizDataArray[idx % bufferLength] || 0;
                    const s = 1 + (val/255)*0.5 * smoothedEnergy;
                    ring.scale.set(s, s, s);

                    const color = getComputedColor(idx, tRings.length, val);
                    if (cfg.mode === 'gradient') ring.material.color.setStyle(color.fill);
                    else if (cfg.mode === 'dynamic') ring.material.color.setStyle(idx % 2 === 0 ? cfg.dynA : cfg.dynB);
                    else ring.material.color.setStyle(cfg.solidColor);
                }), { skipCheck: true });
            }

            // -> STYLE: BARS 3D (kiểu xoắn chuỗi / lò xo DNA)
            else if (cfg.vortexStyle === 'bars') {
                const dummy = new THREE.Object3D();
                const barsRingCount = cfg.barsRingCount, barsPerRing = cfg.barsPerRing;
                // Mỗi vòng lệch thêm một góc cố định so với vòng trước -> tạo hình xoắn lò xo dọc ống.
                // Toàn bộ "lò xo" còn tự xoay chậm theo thời gian để luôn có cảm giác sống động.
                const twistPerRing = (Math.PI * 2 / barsRingCount) * cfg.barsTwistFactor; // số vòng xoắn trọn ống
                const globalTwist = appState.get('frameCounter') * 0.004;
                const tBarsMesh = appState.get('tBarsMesh');

                for(let r=0; r<barsRingCount; r++) {
                    // Sliding window đúng cách: tích lũy vị trí mỗi frame (giống tRings), không tính lại từ modulo
                    appState.mutate('tBarRingZs', arr => {
                        arr[r] += tWarpSpeed * 0.8;
                        if (arr[r] > tCurrentWarpZ + 200) arr[r] -= TUNNEL_DEPTH;
                    }, { skipCheck: true });
                    const z = appState.get('tBarRingZs')[r];

                    const center = getVortexCenterAt(z);
                    const val = vizDataArray[r % 40] || 0;
                    const barScaleY = 1 + (val/255) * 8 * smoothedEnergy;
                    const ringTwist = r * twistPerRing + globalTwist;

                    const color = getComputedColor(r, barsRingCount, val);
                    let ringColor;
                    if (cfg.mode === 'gradient') ringColor = color.fill;
                    else if (cfg.mode === 'dynamic') ringColor = (r % 2 === 0) ? cfg.dynA : cfg.dynB;
                    else ringColor = cfg.solidColor;
                    const threeColor = new THREE.Color(ringColor);

                    for(let b=0; b<barsPerRing; b++) {
                        const ang = (b / barsPerRing) * Math.PI * 2 + ringTwist;
                        dummy.position.set(center.x + Math.cos(ang)*350, center.y + Math.sin(ang)*350, z);
                        dummy.rotation.set(0, 0, ang - Math.PI/2);
                        dummy.scale.set(1, barScaleY, 1);
                        dummy.updateMatrix();
                        tBarsMesh.setMatrixAt(r * barsPerRing + b, dummy.matrix);
                        tBarsMesh.setColorAt(r * barsPerRing + b, threeColor);
                    }
                }
                tBarsMesh.instanceMatrix.needsUpdate = true;
                if(tBarsMesh.instanceColor) tBarsMesh.instanceColor.needsUpdate = true;
            }

            // -> STYLE: WAVE FADE
            else if (cfg.vortexStyle === 'wave') {
                const tWaveMeshes = appState.get('tWaveMeshes');
                appState.mutate('tWaveMeshes', arr => arr.forEach((wave, idx) => {
                    wave.position.z += tWarpSpeed * 1.2;
                    if (wave.position.z > tCurrentWarpZ + 200) wave.position.z -= TUNNEL_DEPTH;
                    
                    const center = getVortexCenterAt(wave.position.z);
                    wave.position.x = center.x; wave.position.y = center.y;
                    
                    // Xoay tròn từ từ, tăng tốc theo bass
                    wave.rotation.z += cfg.waveRotationBase + smoothedEnergy * cfg.waveRotationEnergyMult;
                    wave.scale.setScalar(cfg.waveScaleBase + smoothedEnergy * cfg.waveScaleEnergyMult);

                    const val = vizDataArray[idx % bufferLength] || 0;
                    const color = getComputedColor(idx, tWaveMeshes.length, val);
                    if (cfg.mode === 'gradient') wave.material.color.setStyle(color.fill);
                    else if (cfg.mode === 'dynamic') wave.material.color.setStyle(idx % 2 === 0 ? cfg.dynA : cfg.dynB);
                    else wave.material.color.setStyle(cfg.solidColor);
                }), { skipCheck: true });
            }

            // 4. Cinematic Camera — chỉ bám theo độ cong của ống (trái/phải/trên/dưới), hoàn toàn
            // không có dao động/rung lắc nào khác (không sway, không FOV breathing).
            const camTargetPos = getVortexCenterAt(tCurrentWarpZ);
            // Camera bắt kịp rất chậm rãi (Smooth damping nhẹ hơn để tránh giật khi đường ống đổi hướng)
            const tCamera = appState.get('tCamera');
            tCamera.position.x += (camTargetPos.x - tCamera.position.x) * 0.045;
            tCamera.position.y += (camTargetPos.y - tCamera.position.y) * 0.045;
            tCamera.position.z = tCurrentWarpZ;

            // LookAt điểm phía trước một đoạn, theo đúng đường cong của ống — cố định, không lắc
            const lookAheadZ = tCurrentWarpZ - 800;
            const lookPos = getVortexCenterAt(lookAheadZ);
            tCamera.lookAt(lookPos.x, lookPos.y, lookAheadZ);

            appState.get('tRenderer').render(appState.get('tScene'), tCamera);
        }
