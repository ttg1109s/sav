/**
 * Visual BLACK HOLE — các "sao" bị hút dần vào tâm hố đen, kèm tia sáng bùng phát khi nhạc dồn
 * và dải cột tần số bao quanh viền hố đen. Logic gốc giữ nguyên 1:1.
 */
        function drawBlackHole(ctx, perf, isPlaying) {
            const cfg = getActiveEffectConfig(); // core/custom-effect.js
            const dpr = appState.get('dpr');
            const vizDataArray = appState.get('vizDataArray');
            const smoothedEnergy = appState.get('smoothedEnergy');
            const beatScale = appState.get('beatScale');
            const centerX = canvas.width / 2, centerY = canvas.height / 2;
            const minDimension = Math.min(canvas.width, canvas.height); const maxDist = Math.max(canvas.width, canvas.height);
            const targetRadius = (minDimension * cfg.radiusRatio) + (smoothedEnergy * minDimension * cfg.radiusEnergyMult);
            smoothedBeatRadius += (targetRadius - smoothedBeatRadius) * 0.15; const currentRadius = smoothedBeatRadius + (beatScale * minDimension * 0.03); 
            let currentSuction = cfg.suctionBase + (isPlaying ? smoothedEnergy * cfg.suctionEnergyMult : 0); 

            if (isPlaying && smoothedEnergy > cfg.flareThreshold) {
                let flareAlpha = (smoothedEnergy - cfg.flareThreshold) * 2.5; let grad = ctx.createRadialGradient(centerX, centerY, currentRadius, centerX, centerY, currentRadius * 4);
                grad.addColorStop(0, `hsla(${appState.get('globalHueOffset')}, 100%, 70%, ${flareAlpha * 0.3})`); grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            appState.mutate('stars', arr => arr.forEach(star => {
                let distRatio = Math.max(0.05, star.distance / maxDist); let accel = 1 + (0.05 / distRatio); 
                star.angle += star.baseSpeed * 0.002 * accel; star.distance -= star.baseSpeed * currentSuction * accel;
                if (star.distance < currentRadius) { 
                    appState.mutate('starFlashes', flashes => flashes.push({ x: centerX + Math.cos(star.angle) * currentRadius, y: centerY + Math.sin(star.angle) * currentRadius, alpha: 1, size: star.size }), { skipCheck: true });
                    star.distance = maxDist * (1 + Math.random() * 0.2); star.angle = Math.random() * Math.PI * 2; 
                }
                let ratio = star.distance / maxDist; ctx.fillStyle = `rgba(${star.colorTint}, ${0.1 + ratio})`; ctx.beginPath(); 
                ctx.arc(centerX + Math.cos(star.angle) * star.distance, centerY + Math.sin(star.angle) * star.distance, Math.max(0.1, star.size * ratio + 0.5 * dpr), 0, Math.PI*2); ctx.fill();
            }), { skipCheck: true });

            const starFlashes = appState.get('starFlashes');
            for(let i = starFlashes.length - 1; i >= 0; i--) {
                let f = starFlashes[i]; f.alpha -= cfg.flashFadeSpeed; f.size += 1.5 * dpr;
                if(f.alpha <= 0) appState.mutate('starFlashes', arr => arr.splice(i, 1), { skipCheck: true });
                else { ctx.beginPath(); ctx.arc(f.x, f.y, Math.max(0.1, f.size), 0, Math.PI*2); ctx.fillStyle = `rgba(255, 255, 255, ${f.alpha})`; ctx.shadowBlur = 10 * dpr; ctx.shadowColor = 'white'; ctx.fill(); ctx.shadowBlur = 0; }
            }

            const bufferLength = appState.get('analyser').frequencyBinCount;
            const usefulLength = Math.floor(bufferLength * 0.35); let dynamicMaxBarHeight = (cfg.maxH / 1000) * (minDimension * 0.25);
            ctx.lineWidth = cfg.barWidth * dpr; ctx.lineCap = 'round'; ctx.lineJoin = 'round';

            for (let i = 0; i < usefulLength; i++) {
                let rawVal = vizDataArray[i] || 0; let freqBoost = 1 + (i / usefulLength) * 1.2; let boostedVal = Math.min(255, rawVal * freqBoost);
                let val = boostedVal;
                if (i > 0 && i < usefulLength - 1) {
                    let prev = Math.min(255, (vizDataArray[i-1] || 0) * (1 + ((i-1)/usefulLength)*1.2)); let next = Math.min(255, (vizDataArray[i+1] || 0) * (1 + ((i+1)/usefulLength)*1.2));
                    val = (prev + boostedVal * 3 + next) / 5; 
                }

                let normalized = val / 255; let contrastNormalized = Math.pow(normalized, 2.0);
                const scaledMinH = cfg.minH * dpr;
                let barHeight = scaledMinH + (contrastNormalized * dynamicMaxBarHeight * 1.2); if (!vizDataArray[i] || vizDataArray[i] === 0) barHeight = scaledMinH;
                
                let angleOffset = (i / (usefulLength - 1)) * Math.PI; let angleR = (Math.PI / 2) - angleOffset, angleL = (Math.PI / 2) + angleOffset;

                const colors = getComputedColor(i, usefulLength, val); ctx.strokeStyle = colors.fill; ctx.shadowColor = perf.blurMult > 0 ? colors.glow : 'transparent'; ctx.shadowBlur = 10 * dpr * perf.blurMult; 
                ctx.beginPath(); ctx.moveTo(centerX + Math.cos(angleR) * currentRadius, centerY + Math.sin(angleR) * currentRadius); ctx.lineTo(centerX + Math.cos(angleR) * (currentRadius + barHeight), centerY + Math.sin(angleR) * (currentRadius + barHeight)); ctx.stroke();
                if (i !== usefulLength - 1) { ctx.beginPath(); ctx.moveTo(centerX + Math.cos(angleL) * currentRadius, centerY + Math.sin(angleL) * currentRadius); ctx.lineTo(centerX + Math.cos(angleL) * (currentRadius + barHeight), centerY + Math.sin(angleL) * (currentRadius + barHeight)); ctx.stroke(); }
            }
            ctx.shadowBlur = 0;
            // FIX (phản hồi Giang — "mất nền đen của hình tròn, đang bị trong suốt") — TRƯỚC ĐÂY
            // tô `cfg.bgColor` (màu nền TUỲ CHỈNH của người dùng cho toàn trang, Settings -> Màu
            // sắc) — đúng ra hố đen PHẢI LUÔN đen tuyệt đối bất kể người dùng chọn màu nền gì
            // (khái niệm "hố đen" đòi hỏi tâm phải tối, không phải theo màu tuỳ chỉnh). Đổi sang
            // hằng số đen cố định.
            ctx.beginPath(); ctx.arc(centerX, centerY, Math.max(0.1, currentRadius), 0, 2 * Math.PI); ctx.fillStyle = '#000000'; ctx.fill();
        }
