/**
 * Visual LIGHTNING — chớp sấm sét bay ngang màn hình, cường độ/độ dài tia phản ứng theo năng
 * lượng nhạc tức thời (energySpike). Logic gốc giữ nguyên 1:1.
 */
        function drawLightning(ctx, perf, isPlaying) {
            const cfg = getActiveEffectConfig(); // core/custom-effect.js
            const dpr = appState.get('dpr');
            const smoothedEnergy = appState.get('smoothedEnergy');
            const vizDataArray = appState.get('vizDataArray');
            ctx.lineCap = 'round'; ctx.lineJoin = 'miter';
            let energySpike = smoothedEnergy * ((vizDataArray[5] || 0)/255);
            let flashAlpha = isPlaying && energySpike > cfg.flashThreshold ? (energySpike - cfg.flashThreshold) * 2.5 : 0;
            if (flashAlpha > 0) { ctx.fillStyle = `rgba(200, 220, 255, ${flashAlpha * 0.5})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }

            if (isPlaying && energySpike > cfg.boltThreshold && Math.random() < cfg.boltSpawnChance && appState.get('activeLightnings').length < cfg.maxBoltCount) {
                let startX = (Math.random() * 0.8 + 0.1) * canvas.width; let boltColor = getComputedColor(Math.floor(Math.random()*10), 10, 255);
                let bolt = { life: 1.0, color: boltColor, segments: [] }; let cx = startX, cy = 0;
                while (cy < canvas.height) { let nx = cx + (Math.random() - 0.5) * cfg.boltHorizontalDeviation * dpr; let ny = cy + (Math.random() * cfg.boltSegmentLength + 20) * dpr; bolt.segments.push({x1: cx, y1: cy, x2: nx, y2: ny}); cx = nx; cy = ny; }
                appState.mutate('activeLightnings', arr => arr.push(bolt), { skipCheck: true });
            }

            const activeLightnings = appState.get('activeLightnings');
            for (let i = activeLightnings.length - 1; i >= 0; i--) {
                let b = activeLightnings[i]; b.life -= cfg.boltFadeSpeed + (1 - Math.min(1, smoothedEnergy)) * 0.06;
                if (b.life <= 0) { appState.mutate('activeLightnings', arr => arr.splice(i, 1), { skipCheck: true }); continue; }
                ctx.beginPath(); b.segments.forEach(seg => { ctx.moveTo(seg.x1, seg.y1); ctx.lineTo(seg.x2, seg.y2); });
                ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * dpr * b.life;
                if (perf.blurMult > 0) { ctx.shadowBlur = 20 * dpr * perf.blurMult; ctx.shadowColor = b.color.glow; }
                ctx.stroke(); ctx.strokeStyle = b.color.fill; ctx.lineWidth = 8 * dpr * b.life; ctx.globalAlpha = b.life * 0.6; ctx.stroke(); ctx.globalAlpha = 1.0; ctx.shadowBlur = 0;
            }
        }
