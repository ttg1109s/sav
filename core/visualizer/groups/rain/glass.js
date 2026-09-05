/**
 * core/visualizer/groups/rain/glass.js — [LÀM PHẲNG, 05/09/2026, yêu cầu Giang] Style 'glass'
 * (mưa trôi trên ô cửa kính nhìn ra thành phố ban đêm, có trăng) tách riêng khỏi
 * `core/visualizer/types/rain.js` cũ (trước đây gộp chung với 'street'). Nội dung hàm GIỮ NGUYÊN
 * 100%.
 *
 * [SỬA — rà soát Rule 3, không ngoại lệ] TRƯỚC ĐÂY `drawRainGlass()` tự `appState.get()` (Rule 2)
 * + tự gọi `getActiveEffectConfig()`/`getComputedColor()`/`getVisualBgFillStyle()`/
 * `drawWaterDrop()`/`drawWindowFrame()` (Rule 3 — cả cùng lẫn khác file). SỬA: mọi hàm dưới đây
 * giờ CHỈ nhận tham số; những chỗ cần gọi Core khác (getComputedColor/getVisualBgFillStyle/
 * drawWaterDrop/drawWindowFrame) đều chuyển ra Workflow (`_tickRainGlass()`, event/workflow/
 * visualizer-render.js) gọi RIÊNG LẺ. `appState.mutate('glassStreaks'/'glassStaticDrops', ...)`
 * GIỮ NGUYÊN bên trong — Rule 2 chỉ cấm ĐỌC, không cấm GHI.
 *
 * `computeRainFlashAlpha()`/`paintRainFlash()` (chớp sáng, dùng chung với style 'street') nằm ở
 * `core/visualizer/groups/rain/common.js`.
 *
 * NẠP SAU: core/visualizer/groups/rain/common.js.
 */

// =================================== Kiểu 'glass' — cửa kính ===================================

/** Khung hình Trăng — THUẦN, đọc `audioPlayer` (dom-ref TĨNH toàn cục, không phải `appState`, cùng
 * quy ước với `canvas`) trực tiếp như bản gốc. @returns {object|null} null nếu tắt (guard clause). */
function computeRainMoonFrame(canvasWidth, canvasHeight, dpr, smoothedEnergy, moonVisible) {
    if (moonVisible === false) return null;
    let progress = 0;
    if (audioPlayer && isFinite(audioPlayer.duration) && audioPlayer.duration > 0) progress = audioPlayer.currentTime / audioPlayer.duration;
    const moonX = canvasWidth * 0.70, moonY = canvasHeight * 0.35;
    const baseScale = 4 + Math.sin(progress * Math.PI) * 1;
    const baseMoonRadius = baseScale * 8 * dpr;
    const dynamicMoonRadius = baseMoonRadius + (smoothedEnergy * 8 * dpr);
    return {
        x: moonX, y: moonY, radius: Math.max(0.1, dynamicMoonRadius),
        shadowBlur: (30 + smoothedEnergy * 20) * dpr, alpha: 0.6 + (smoothedEnergy * 0.3),
    };
}

/** Vẽ Trăng từ khung hình đã tính — không vẽ gì nếu `moon` null (tắt). Chỉ Canvas API. */
function paintRainMoon(ctx, moon) {
    if (!moon) return;
    ctx.beginPath();
    ctx.arc(moon.x, moon.y, moon.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#e0e8ff';
    ctx.shadowBlur = moon.shadowBlur;
    ctx.shadowColor = '#aaccff';
    ctx.globalAlpha = moon.alpha;
    ctx.fill();
    ctx.shadowBlur = 0;
}

/** Big City (toà nhà + cửa sổ sáng) — không cần `getComputedColor()` (màu cửa sổ lấy thẳng
 * `win.colorType` đã lưu sẵn trên từng cửa sổ) nên compute+paint gộp 1 hàm, chỉ nhận tham số.
 * Chỉ Canvas API. */
function paintRainCity(ctx, canvasHeight, cityBuildings, dpr, vizDataArray, isPlaying, cityOpacity) {
    ctx.globalAlpha = cityOpacity;
    cityBuildings.forEach((b) => {
        ctx.fillStyle = '#03060a';
        ctx.fillRect(b.x, canvasHeight - b.h, b.w, b.h);
        const winW = 3 * dpr, winH = 5 * dpr;
        const paddingX = (b.w - (b.cols * winW)) / (b.cols + 1);
        const paddingY = (b.h - (b.rows * winH)) / (b.rows + 1);
        b.windows.forEach((win) => {
            const wx = b.x + paddingX + win.c * (winW + paddingX);
            const wy = canvasHeight - b.h + paddingY + win.r * (winH + paddingY);
            let isLit = win.isAlwaysOn;
            let alpha = isLit ? 0.3 : 0;
            if (isPlaying) {
                const audioVal = vizDataArray[win.fftBin] || 0;
                if (audioVal > 140) { isLit = true; alpha = Math.max(alpha, (audioVal / 255) * 0.9); }
            }
            if (isLit) {
                ctx.fillStyle = win.colorType;
                ctx.globalAlpha = alpha * 0.6;
                ctx.fillRect(wx, wy, winW, winH);
            }
        });
        ctx.globalAlpha = cityOpacity;
    });
}

/** Có thể sinh 1 giọt trôi (streak) mới trên kính — chỉ GHI qua `appState.mutate()` (được phép),
 * không đọc gì thêm ngoài tham số. Guard clause đầu hàm (Rule 1 — vẫn 1 tiến trình, chỉ dừng sớm). */
function maybeSpawnRainStreak(canvasWidth, vizDataArray, isPlaying, smoothedEnergy, streakFrequency, dpr) {
    if (!(isPlaying && smoothedEnergy > 0.4 && Math.random() > (1 - streakFrequency / 100))) return;
    const cVal = vizDataArray[Math.floor(Math.random() * 10)] || 0;
    appState.mutate('glassStreaks', (arr) => arr.push({
        x: Math.random() * canvasWidth, y: -20, r: (Math.random() * 2 + 1.5) * dpr,
        speed: (Math.random() * 2 + 3) * dpr, colorVal: cVal,
    }), { skipCheck: true });
}

/**
 * Tiến 1 streak (vật lý + va chạm giọt tĩnh, đúng thứ tự bản gốc) — trả `{drawArgs, alive}` thay vì
 * tự gọi `drawWaterDrop()` (Rule 3, cross-file — Workflow tự gọi cho từng streak còn sống, xem
 * `_tickRainGlass()`). `glassStaticDrops` nhận qua tham số (Workflow tự `appState.get()` TRƯỚC,
 * Rule 2) — mảng SỐNG, hàm này mutate trực tiếp thuộc tính (`drop`) + tự `appState.mutate()` khi
 * cần thêm/bớt phần tử (được phép, Rule 2 chỉ cấm ĐỌC).
 */
function advanceRainStreak(streak, glassStaticDrops, smoothedEnergy, dpr, canvasWidth, canvasHeight, glassDropDensity) {
    streak.y += streak.speed + (smoothedEnergy * 8 * dpr);
    streak.x += (Math.random() - 0.5) * 2 * dpr;

    for (let j = glassStaticDrops.length - 1; j >= 0; j--) {
        const drop = glassStaticDrops[j];
        const dx = drop.x - streak.x, dy = drop.y - streak.y;
        if (dx * dx + dy * dy < (streak.r + drop.r) * (streak.r + drop.r)) {
            streak.r = Math.min(streak.r + drop.r * 0.3, 4.5 * dpr);
            appState.mutate('glassStaticDrops', (arr) => {
                arr.splice(j, 1);
                arr.push({ x: Math.random() * canvasWidth, y: Math.random() * canvasHeight, r: (Math.random() * 1.5 + 0.5) * dpr });
            }, { skipCheck: true });
        }
    }
    if (Math.random() > 0.7 && glassStaticDrops.length <= (glassDropDensity * 2)) {
        appState.mutate('glassStaticDrops', (arr) => arr.push({
            x: streak.x + (Math.random() - 0.5) * 4 * dpr, y: streak.y - streak.r * 1.5, r: Math.max(0.1, streak.r * 0.3),
        }), { skipCheck: true });
    }
    if (glassStaticDrops.length > (glassDropDensity * 2) + 50) {
        appState.mutate('glassStaticDrops', (arr) => arr.shift(), { skipCheck: true });
    }

    return { drawArgs: [streak.x, streak.y, streak.r, 0.9], alive: streak.y <= canvasHeight + 50 };
}
