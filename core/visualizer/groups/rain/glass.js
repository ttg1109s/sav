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
 * `computeRainFlashEnergy()` (nguồn năng lượng chớp, dùng chung với style 'street') nằm ở
 * `core/visualizer/groups/rain/common.js`; alpha + vẽ dùng chung `computeScreenFlashAlpha()`/`drawScreenFlash()`
 * (core/visualizer/draw/).
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

/** Big City — [VIẾT LẠI 25/09/2026, Giang: "áp chế độ màu custom effect cho đèn big city"] TRƯỚC ĐÂY cửa
 * sáng lấy màu cố định `win.colorType` (#ffdd44/#fff5e6, gán lúc dựng scene) — style glass KHÔNG dùng
 * color mode dù card Color vẫn hiện; cửa TẮT không vẽ -> trông y hệt tường, không phân biệt được "cửa
 * đang tắt" với "không có cửa". Giờ tách 3 bước (Rule 3 — Workflow `_tickRainGlass()` gọi RIÊNG LẺ):
 *   1. computeRainCityFrame()     — hình học + trạng thái sáng/tắt + alpha (giữ NGUYÊN luật sáng cũ:
 *      15% cửa luôn sáng mờ, còn lại sáng khi bin FFT của nó > 140).
 *   2. resolveRainCityLitColor()  — màu cửa SÁNG = ĐÚNG màu mode (Giang chốt: không pha):
 *      solid = solidColor, dynamic = dynA->dynB theo vị trí ngang, gradient = THEO TỪNG CỬA, cùng công
 *      thức getComputedColor() (core/audio-analysis.js).
 *   3. resolveRainCityOffColor()  — màu cửa TẮT TƯƠNG PHẢN với màu sáng (Giang chốt): hue đối (+180°),
 *      độ sáng lật phía (sáng >= 50% -> tắt tối 25%, sáng tối -> tắt 70%); màu gần xám (S < 15%) giữ
 *      xám, chỉ lật độ sáng. Vẽ ở alpha thấp RAIN_CITY_OFF_ALPHA.
 * paintRainCity() chỉ Canvas API. SỬA kèm: alpha cửa trước đây GHI ĐÈ globalAlpha (bỏ qua cityOpacity —
 * kéo độ mờ Thành phố về 0 cửa vẫn hiện); giờ nhân với cityOpacity. */
const RAIN_CITY_WALL_COLOR = '#03060a';
const RAIN_CITY_OFF_ALPHA = 0.2;

/** Khung hình Big City — THUẦN. @returns {{walls:object[], windows:{x,y,w,h,lit,alpha,t,value}[]}}
 * `t` = vị trí ngang 0-1 (tâm cửa / canvasWidth), `value` = byte FFT của cửa (0 khi không phát). */
function computeRainCityFrame(canvasWidth, canvasHeight, cityBuildings, dpr, vizDataArray, isPlaying) {
    const walls = [], windows = [];
    const winW = 3 * dpr, winH = 5 * dpr;
    cityBuildings.forEach((b) => {
        walls.push({ x: b.x, y: canvasHeight - b.h, w: b.w, h: b.h });
        const paddingX = (b.w - (b.cols * winW)) / (b.cols + 1);
        const paddingY = (b.h - (b.rows * winH)) / (b.rows + 1);
        b.windows.forEach((win) => {
            const wx = b.x + paddingX + win.c * (winW + paddingX);
            const wy = canvasHeight - b.h + paddingY + win.r * (winH + paddingY);
            const audioVal = isPlaying ? (vizDataArray[win.fftBin] || 0) : 0;
            let lit = win.isAlwaysOn;
            let alpha = lit ? 0.3 : 0;
            if (audioVal > 140) { lit = true; alpha = Math.max(alpha, (audioVal / 255) * 0.9); }
            const t = Math.max(0, Math.min(1, (wx + winW / 2) / canvasWidth));
            windows.push({ x: wx, y: wy, w: winW, h: winH, lit, alpha: lit ? alpha * 0.6 : RAIN_CITY_OFF_ALPHA, t, value: audioVal });
        });
    });
    return { walls, windows };
}

/** Màu cửa SÁNG theo color mode — trả css + HSL (h 0-360, s/l 0-100) để resolveRainCityOffColor() lật.
 * @param {{mode:string, solid:{r,g,b}, dynA:{r,g,b}, dynB:{r,g,b}, hueOffset:number}} palette - Workflow
 * tự hexToRgb() 1 lần/frame. @param {number} t - vị trí ngang 0-1 @param {number} value - byte FFT 0-255 */
function resolveRainCityLitColor(palette, t, value) {
    if (palette.mode === 'gradient') {
        // Cùng công thức nhánh gradient của getComputedColor() (core/audio-analysis.js), i/total = t.
        const h = (palette.hueOffset + t * 240 + (value / 255) * 80) % 360;
        const s = Math.round(70 + (value / 255) * 30);
        const l = Math.round(40 + (value / 255) * 30);
        return { css: `hsl(${h}, ${s}%, ${l}%)`, h, s, l };
    }
    let r, g, b;
    if (palette.mode === 'dynamic') {
        r = palette.dynA.r + (palette.dynB.r - palette.dynA.r) * t;
        g = palette.dynA.g + (palette.dynB.g - palette.dynA.g) * t;
        b = palette.dynA.b + (palette.dynB.b - palette.dynA.b) * t;
    } else {
        r = palette.solid.r; g = palette.solid.g; b = palette.solid.b;
    }
    // RGB -> HSL (chuẩn), để bước "tắt" lật được hue/độ sáng.
    const rn = r / 255, gn = g / 255, bn = b / 255;
    const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
        else if (max === gn) h = ((bn - rn) / d + 2) * 60;
        else h = ((rn - gn) / d + 4) * 60;
    }
    return { css: `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`, h, s: s * 100, l: l * 100 };
}

/** Màu cửa TẮT tương phản với màu sáng (h/s/l từ resolveRainCityLitColor()): hue đối +180°, độ sáng lật
 * phía; màu gần xám giữ xám. @returns {string} css */
function resolveRainCityOffColor(h, s, l) {
    const offH = (h + 180) % 360;
    const offS = s < 15 ? s : Math.min(s, 60);
    const offL = l >= 50 ? 25 : 70;
    return `hsl(${offH}, ${Math.round(offS)}%, ${offL}%)`;
}

/** Vẽ Big City — tường rồi cửa (màu đã resolve, `colors[i]` ứng `frame.windows[i]`). Chỉ Canvas API. */
function paintRainCity(ctx, frame, colors, cityOpacity) {
    ctx.globalAlpha = cityOpacity;
    ctx.fillStyle = RAIN_CITY_WALL_COLOR;
    frame.walls.forEach((w) => ctx.fillRect(w.x, w.y, w.w, w.h));
    frame.windows.forEach((win, i) => {
        ctx.globalAlpha = win.alpha * cityOpacity;
        ctx.fillStyle = colors[i];
        ctx.fillRect(win.x, win.y, win.w, win.h);
    });
    ctx.globalAlpha = cityOpacity;
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
