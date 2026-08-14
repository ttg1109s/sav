/**
 * Visual RAIN — 2 kiểu (rainStyle):
 *   - 'glass'  : mưa trôi trên ô cửa kính nhìn ra thành phố ban đêm, có trăng.
 *   - 'street' : mưa phố & công viên về đêm — đèn đường (3 cột) + hàng rào công viên.
 *
 * Chớp sáng (glassFlash) dùng CHUNG một hàm cho cả 2 kiểu.
 */

        function drawRainFlash(ctx, isPlaying, flashTint) {
            if (!getActiveEffectConfig().glassFlash || !isPlaying) return;
            let energySpike = appState.get('smoothedEnergy') * ((appState.get('vizDataArray')[3] || 0) / 255);
            let flashAlpha = energySpike > 0.4 ? (energySpike - 0.4) * 1.2 : 0;
            if (flashAlpha > 0) {
                ctx.fillStyle = flashTint(Math.min(flashAlpha, 0.4));
                ctx.globalAlpha = 1.0; ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        }

        function drawRainGlass(ctx, isPlaying) {
            const cfg = getActiveEffectConfig(); // core/custom-effect.js
            const dpr = appState.get('dpr');
            const smoothedEnergy = appState.get('smoothedEnergy');
            const vizDataArray = appState.get('vizDataArray');
            // `hasCustomBg` quyết định có tô lớp phủ nền hay không — có BẤT KỲ nguồn nền tuỳ chỉnh
            // nào (video/ảnh Visual/slideshow) thì bỏ tô, để nền thật hiện xuyên qua canvas. Không
            // có thì tô đúng màu/gradient VBG đang hiển thị (kể cả khung hình Movement LIVE).
            const hasCustomBg = appConfigVisualBg.getAll().source.list.some((k) => k !== null) || appState.get('isVideoPlayerMode');
            if (!hasCustomBg) { ctx.fillStyle = getVisualBgFillStyle(ctx, canvas.width, canvas.height); ctx.fillRect(0, 0, canvas.width, canvas.height); } // core/visual-bg.js
            let progress = 0; if (audioPlayer && isFinite(audioPlayer.duration) && audioPlayer.duration > 0) progress = audioPlayer.currentTime / audioPlayer.duration;
            let moonX = canvas.width * 0.70; let moonY = canvas.height * 0.35; let baseScale = 4 + Math.sin(progress * Math.PI) * 1; let baseMoonRadius = baseScale * 8 * dpr; 
            let dynamicMoonRadius = baseMoonRadius + (smoothedEnergy * 8 * dpr);

            // FIX (31/07/2026, Giang chốt) — Trăng + BigCity giờ LUÔN vẽ, kể cả khi videoBgEnabled/
            // isVideoPlayerMode (TRƯỚC ĐÂY 2 khối này tự bỏ qua khi có video, ĐÈ ngược lại đúng thứ
            // tự z-index vốn có — canvas ('chính visualizer đang vẽ') vốn z-index CAO HƠN #bg-video,
            // xem assets/css/style.css — nên 2 lớp này phải luôn hiện TRÊN video, không phải video
            // che mất chúng). LƯU Ý: trên WKWebView/iOS Safari, `<video>` giải mã hardware nằm ở
            // compositing layer riêng do OS quản lý, có thể vẫn đè lên bất kể z-index (đã xác nhận
            // qua 3 lần thử ở tình huống khác — xem core/video-player.js) — cần Giang tự kiểm tra
            // trên thiết bị thật; nếu vẫn bị che, đây là giới hạn nền tảng, không phải sai chỗ này.
            // 3 lớp cảnh (Trăng/Big City/Khung cửa sổ): Trăng+City ẩn/hiện theo toggle riêng, Big
            // City có độ trong tuỳ chỉnh (glassCityOpacity) — Khung cửa sổ LUÔN hiện (không còn toggle).
            if (cfg.glassMoonVisible !== false) {
                ctx.beginPath(); ctx.arc(moonX, moonY, Math.max(0.1, dynamicMoonRadius), 0, Math.PI * 2); ctx.fillStyle = '#e0e8ff';
                // Quầng sáng Trăng — phối cảnh cố định, LUÔN bật, không qua blurEnabled/blurIntensity.
                ctx.shadowBlur = (30 + smoothedEnergy * 20) * dpr; ctx.shadowColor = '#aaccff';
                ctx.globalAlpha = 0.6 + (smoothedEnergy * 0.3); ctx.fill(); ctx.shadowBlur = 0;
            }

            drawRainFlash(ctx, isPlaying, (a) => `rgba(200, 220, 255, ${a})`);

            if (cfg.glassCityVisible !== false) {
                const cityOpacity = (typeof cfg.glassCityOpacity === 'number' ? cfg.glassCityOpacity : 40) / 100;
                ctx.globalAlpha = cityOpacity;
                appState.get('cityBuildings').forEach(b => {
                    ctx.fillStyle = '#03060a'; ctx.fillRect(b.x, canvas.height - b.h, b.w, b.h);
                    let winW = 3 * dpr; let winH = 5 * dpr; let paddingX = (b.w - (b.cols * winW)) / (b.cols + 1); let paddingY = (b.h - (b.rows * winH)) / (b.rows + 1);
                    b.windows.forEach(win => {
                        let wx = b.x + paddingX + win.c * (winW + paddingX); let wy = canvas.height - b.h + paddingY + win.r * (winH + paddingY);
                        let isLit = win.isAlwaysOn; let alpha = isLit ? 0.3 : 0;
                        if (isPlaying) { let audioVal = vizDataArray[win.fftBin] || 0; if (audioVal > 140) { isLit = true; alpha = Math.max(alpha, (audioVal / 255) * 0.9); } }
                        if (isLit) { ctx.fillStyle = win.colorType; ctx.globalAlpha = alpha * 0.6; ctx.fillRect(wx, wy, winW, winH); }
                    }); ctx.globalAlpha = cityOpacity;
                });
            }
            ctx.globalAlpha = 1.0; ctx.fillStyle = 'rgba(10, 15, 25, 0.2)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            const glassStaticDropsRead = appState.get('glassStaticDrops');
            for (let i = 0; i < glassStaticDropsRead.length; i++) { let drop = glassStaticDropsRead[i]; drawWaterDrop(ctx, drop.x, drop.y, drop.r, 0.6); }

            if (isPlaying && smoothedEnergy > 0.4 && Math.random() > (1 - cfg.glassStreakFrequency / 100)) {
                let cVal = vizDataArray[Math.floor(Math.random() * 10)] || 0;
                appState.mutate('glassStreaks', arr => arr.push({ x: Math.random() * canvas.width, y: -20, r: (Math.random() * 2 + 1.5) * dpr, speed: (Math.random() * 2 + 3) * dpr, colorVal: cVal }), { skipCheck: true });
            }

            const glassStreaks = appState.get('glassStreaks');
            for (let i = glassStreaks.length - 1; i >= 0; i--) {
                let streak = glassStreaks[i]; streak.y += streak.speed + (smoothedEnergy * 8 * dpr); streak.x += (Math.random() - 0.5) * 2 * dpr; 
                const glassStaticDrops = appState.get('glassStaticDrops');
                for (let j = glassStaticDrops.length - 1; j >= 0; j--) {
                    let drop = glassStaticDrops[j]; let dx = drop.x - streak.x; let dy = drop.y - streak.y;
                    if (dx*dx + dy*dy < (streak.r + drop.r) * (streak.r + drop.r)) {
                        streak.r = Math.min(streak.r + drop.r * 0.3, 4.5 * dpr);
                        appState.mutate('glassStaticDrops', arr => {
                            arr.splice(j, 1);
                            arr.push({x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: (Math.random() * 1.5 + 0.5) * dpr});
                        }, { skipCheck: true });
                    }
                }
                if (Math.random() > 0.7 && appState.get('glassStaticDrops').length <= (cfg.glassDropDensity * 2)) appState.mutate('glassStaticDrops', arr => arr.push({x: streak.x + (Math.random()-0.5)*4*dpr, y: streak.y - streak.r*1.5, r: Math.max(0.1, streak.r * 0.3)}), { skipCheck: true });
                if(appState.get('glassStaticDrops').length > (cfg.glassDropDensity * 2) + 50) appState.mutate('glassStaticDrops', arr => arr.shift(), { skipCheck: true });
                drawWaterDrop(ctx, streak.x, streak.y, streak.r, 0.9); if (streak.y > canvas.height + 50) appState.mutate('glassStreaks', arr => arr.splice(i, 1), { skipCheck: true });
            }
            
            let glassGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            glassGradient.addColorStop(0, 'rgba(255, 255, 255, 0.0)'); glassGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.02)');
            glassGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.08)'); glassGradient.addColorStop(0.41, 'transparent'); glassGradient.addColorStop(1, 'transparent');
            ctx.fillStyle = glassGradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawWindowFrame(ctx);
        }

        // Hàng rào kiểu cổng/rào công viên cổ điển — một dãy cọc thẳng đứng nối bằng 2 thanh
        // ngang, chạy dọc suốt chiều ngang màn hình ngay trên mặt đất (groundY). Vẽ tĩnh, màu tối
        // gần với màu nền/cột đèn để gợi cảm giác hàng rào sắt cũ đứng yên trong mưa, không cướp
        // sự chú ý khỏi đèn đường hay mưa.
        function drawParkFence(ctx, groundY) {
            const dpr = appState.get('dpr');
            const postSpacing = 26 * dpr;
            const postH = 34 * dpr;
            const postW = 2 * dpr;
            const fenceColor = '#0a0c11';
            const railTopY = groundY - postH * 0.78;
            const railBottomY = groundY - postH * 0.22;

            ctx.fillStyle = fenceColor;
            // 2 thanh ngang nối các cọc
            ctx.fillRect(0, railTopY - dpr, canvas.width, 2 * dpr);
            ctx.fillRect(0, railBottomY - dpr, canvas.width, 2 * dpr);

            // Cọc đứng + đầu cọc nhọn (mác giáo nhỏ) kiểu rào sắt công viên
            for (let x = postSpacing * 0.5; x < canvas.width; x += postSpacing) {
                ctx.fillRect(x - postW / 2, groundY - postH, postW, postH);
                ctx.beginPath();
                ctx.moveTo(x - postW * 1.3, groundY - postH);
                ctx.lineTo(x, groundY - postH - postW * 2.4);
                ctx.lineTo(x + postW * 1.3, groundY - postH);
                ctx.closePath();
                ctx.fill();
            }
        }

        function drawRainStreet(ctx, isPlaying) {
            const cfg = getActiveEffectConfig(); // core/custom-effect.js
            const dpr = appState.get('dpr');
            const smoothedEnergy = appState.get('smoothedEnergy');
            const beatScale = appState.get('beatScale');
            // Nền trời: chỉ tô khi KHÔNG có nền tuỳ chỉnh nào (video/ảnh Visual/slideshow) đang
            // hoạt động — có thì để trống cho nền thật hiện xuyên qua, cảnh công viên (đất/đèn/mưa)
            // vẫn vẽ đè lên như cũ. Không có thì tô đúng màu/gradient VBG đang hiển thị (CÙNG khuôn
            // drawRainGlass() — trước đây dùng màu riêng của effect Rain, không phải VBG, đã sửa).
            const hasCustomBg = appConfigVisualBg.getAll().source.list.some((k) => k !== null) || appState.get('isVideoPlayerMode');
            if (!hasCustomBg) { ctx.fillStyle = getVisualBgFillStyle(ctx, canvas.width, canvas.height); ctx.fillRect(0, 0, canvas.width, canvas.height); } // core/visual-bg.js

            drawRainFlash(ctx, isPlaying, (a) => `rgba(220, 225, 255, ${a * 0.8})`);

            // Mưa rơi TỈ LỆ NGHỊCH với năng lượng nhạc: nhạc nhẹ -> mưa to/dày; nhạc mạnh lên -> mưa nhỏ/thưa lại.
            const rainIntensity = isPlaying ? (1 - smoothedEnergy * 0.75) : 1; // 0.25 (nhạc rất mạnh) .. 1 (nhạc nhẹ/im lặng)
            const streetRain = appState.get('streetRain');
            const activeRainCount = Math.max(20, Math.floor(streetRain.length * rainIntensity));

            ctx.strokeStyle = `rgba(200, 215, 230, ${0.35 * rainIntensity + 0.15})`;
            ctx.lineWidth = (1 + rainIntensity * 0.8) * dpr; ctx.lineCap = 'round';
            ctx.beginPath();
            appState.mutate('streetRain', arr => {
                for (let i = 0; i < activeRainCount; i++) {
                    const drop = arr[i];
                    drop.y += drop.speed * (0.6 + rainIntensity * 0.8); drop.x += drop.drift * dpr;
                    if (drop.y > canvas.height) { drop.y = -drop.len; drop.x = Math.random() * canvas.width; }
                    if (drop.x < -20 * dpr) drop.x = canvas.width + 20 * dpr; if (drop.x > canvas.width + 20 * dpr) drop.x = -20 * dpr;
                    const dropLen = drop.len * (0.6 + rainIntensity * 0.7);
                    ctx.moveTo(drop.x, drop.y); ctx.lineTo(drop.x + drop.drift * 4 * dpr, drop.y - dropLen);
                }
            }, { skipCheck: true });
            ctx.stroke();

            // Mặt đất công viên — luôn cao hơn vùng thanh điều khiển dưới cùng (xem getPlayerBarSafeHeight),
            // tô theo chế độ màu đã chọn để đồng nhất với toàn bộ visualizer.
            const groundY = appState.get('streetGroundY') || canvas.height * 0.88;
            let groundGrad = ctx.createLinearGradient(0, groundY, 0, canvas.height);
            if (cfg.mode === 'solid') {
                groundGrad.addColorStop(0, interpolateColor('#0f141c', cfg.solidColor, 0.08)); groundGrad.addColorStop(1, '#08090f');
            } else if (cfg.mode === 'dynamic') {
                groundGrad.addColorStop(0, interpolateColor('#0f141c', cfg.dynA, 0.1)); groundGrad.addColorStop(1, interpolateColor('#08090f', cfg.dynB, 0.1));
            } else {
                groundGrad.addColorStop(0, 'rgba(15, 20, 28, 0.9)'); groundGrad.addColorStop(1, 'rgba(8, 10, 15, 0.95)');
            }
            ctx.fillStyle = groundGrad; ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

            // Hàng rào công viên — chạy dọc theo mặt đất, NGAY SAU lưng các cột đèn (vẽ trước đèn
            // để đèn/quầng sáng luôn nổi lên trên, không bị hàng rào che mất).
            drawParkFence(ctx, groundY);

            // Đèn đường — đèn chính nhấp nháy theo beat/bass, đèn phụ mờ phía xa ổn định hơn.
            // Màu ánh đèn theo vizConfig.mode (đơn sắc/pha trộn/gradient theo nhạc) thay vì vàng cam cố định.
            const streetLamps = appState.get('streetLamps');
            appState.mutate('streetLamps', arr => arr.forEach((lamp, lampIdx) => {
                const bassKick = isPlaying ? beatScale : 0;
                // Nhấp nháy rõ rệt hơn bản cũ: biên độ giật theo bass lớn hơn + xác suất "chớp tắt" ngẫu
                // nhiên cao hơn một chút để có cảm giác đèn đường cũ kỹ, sống động hơn.
                const flickerTarget = 0.65 + bassKick * (1 - lamp.depth * 0.6) * 1.15 + (Math.random() < 0.06 ? -0.22 : 0);
                lamp.flicker += (flickerTarget - lamp.flicker) * 0.3;
                const glow = Math.max(0.12, Math.min(1.5, lamp.flicker));

                const postTopY = lamp.baseY - lamp.height;
                const postW = (lamp.main ? 5 : 3.5) * dpr;

                // Cột đèn
                ctx.fillStyle = lamp.depth > 0 ? `rgba(15,18,24,${0.9 - lamp.depth*0.3})` : '#15181f';
                ctx.fillRect(lamp.x - postW/2, postTopY, postW, lamp.height);
                // Chụp đèn (hình thang nhỏ)
                const capW = postW * 3.2;
                ctx.beginPath();
                ctx.moveTo(lamp.x - capW/2, postTopY); ctx.lineTo(lamp.x + capW/2, postTopY);
                ctx.lineTo(lamp.x + capW*0.32, postTopY - capW*0.5); ctx.lineTo(lamp.x - capW*0.32, postTopY - capW*0.5);
                ctx.closePath(); ctx.fillStyle = '#0c0e12'; ctx.fill();

                // Màu ánh sáng đèn: theo chế độ màu hiện hành (dùng trực tiếp globalAlpha để tương thích
                // mọi định dạng màu trả về — hex ở mode solid/dynamic, hsla() ở mode gradient).
                const lampColor = getComputedColor(lampIdx, streetLamps.length, Math.round(glow * 255));
                let lampFill;
                if (cfg.mode === 'solid') lampFill = cfg.solidColor;
                else if (cfg.mode === 'dynamic') lampFill = lampIdx % 2 === 0 ? cfg.dynA : cfg.dynB;
                else lampFill = lampColor.fill;

                // Quầng sáng đèn — cộng dồn (lighter). flareScale riêng của đèn custom (mặc định 1).
                const flareScale = lamp.flareScale || 1;
                ctx.save();
                ctx.globalCompositeOperation = 'lighter';
                const haloR = (lamp.main ? 150 : 95) * dpr * (1 - lamp.depth * 0.3) * (0.7 + glow * 0.55) * flareScale;
                let lampGlow = ctx.createRadialGradient(lamp.x, postTopY + 6*dpr, 1, lamp.x, postTopY + 6*dpr, haloR);
                ctx.globalAlpha = 0.6 * glow * (1 - lamp.depth * 0.4);
                lampGlow.addColorStop(0, lampFill); lampGlow.addColorStop(1, 'transparent');
                ctx.fillStyle = lampGlow; ctx.beginPath(); ctx.arc(lamp.x, postTopY + 6*dpr, haloR, 0, Math.PI*2); ctx.fill();
                // Bóng đèn nhỏ sáng rõ ngay tâm chụp
                ctx.globalAlpha = Math.min(1, glow);
                ctx.fillStyle = lampFill;
                ctx.beginPath(); ctx.arc(lamp.x, postTopY + 6*dpr, (lamp.main ? 5 : 3.5) * dpr, 0, Math.PI*2); ctx.fill();
                ctx.globalAlpha = 1.0;
                ctx.restore();
            }), { skipCheck: true });

            // Vũng nước lăn tăn dưới chân đèn chính khi nhạc dồn (gợn sóng nhẹ phản chiếu ánh đèn)
            if (isPlaying && beatScale > 0.55 && Math.random() > 0.92) {
                const mainLamp = streetLamps.find(l => l.main);
                if (mainLamp) {
                    const rippleColors = getComputedColor(0, 1, 200);
                    appState.mutate('ripples', arr => arr.push({ x: mainLamp.x + (Math.random()-0.5)*60*dpr, y: groundY + (canvas.height - groundY) * 0.4, radius: 4*dpr, maxRadius: 50*dpr, speed: 1.5*dpr, alpha: 0.5, color: rippleColors.fill, glow: rippleColors.glow }), { skipCheck: true });
                }
            }
            const ripples = appState.get('ripples');
            for (let i = ripples.length - 1; i >= 0; i--) {
                let rip = ripples[i]; rip.radius += rip.speed; rip.alpha -= (rip.speed / rip.maxRadius) * 1.2;
                if (rip.alpha <= 0) appState.mutate('ripples', arr => arr.splice(i, 1), { skipCheck: true });
                else { ctx.beginPath(); ctx.ellipse(rip.x, rip.y, Math.max(0.1, rip.radius), Math.max(0.1, rip.radius * 0.3), 0, 0, Math.PI*2); ctx.strokeStyle = rip.color; ctx.globalAlpha = Math.max(0, rip.alpha); ctx.lineWidth = 1.5*dpr; ctx.stroke(); }
            }
            ctx.globalAlpha = 1.0;
        }

        function drawRain(ctx, isPlaying) {
            ctx.lineCap = 'round';
            if (getActiveEffectConfig().rainStyle === 'street') drawRainStreet(ctx, isPlaying);
            else drawRainGlass(ctx, isPlaying);
        }
