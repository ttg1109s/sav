/**
 * core/visualizer/groups/bar/black-hole.js — [CHUYỂN NHÓM, 05/09/2026, yêu cầu Giang] Trước đây
 * đứng riêng `core/visualizer/types/black-hole.js` — giờ thuộc group "bar" (core/visualizer/
 * groups/bar/, cùng thư mục với `mirror.js`/`cascade.js`, xem registry ở `common.js`). Nội dung
 * hàm GIỮ NGUYÊN 100%, chỉ đổi đường dẫn file — dispatch (`cfg.type === 'black hole'`) CHƯA đổi
 * trong lượt này (xem ghi chú cuối tin nhắn). Giang cần XOÁ TAY file cũ `core/visualizer/types/
 * black-hole.js` (không tự xoá qua patch) — index.html cần cập nhật `<script src="...">`.
 *
 * Visual BLACK HOLE — các "sao" bị hút dần vào tâm hố đen, kèm tia sáng bùng phát khi nhạc dồn
 * và dải cột tần số bao quanh viền hố đen. Logic gốc giữ nguyên 1:1.
 *
 * [SỬA — rà soát Rule 3, không ngoại lệ] TRƯỚC ĐÂY `drawBlackHole()` tự `appState.get()` (Rule 2)
 * + tự gọi `getActiveEffectConfig()`/`getComputedColor()` (Rule 3). SỬA: mọi dữ liệu cần đọc giờ
 * nhận qua tham số (Workflow — `_tickBlackHole()`, event/workflow/visualizer-render.js — tự gom
 * `appState.get()` + `getActiveEffectConfig()` TRƯỚC khi gọi). `appState.mutate('stars', ...)` +
 * `appState.mutate('starFlashes', ...)` GIỮ NGUYÊN bên trong — Rule 2 chỉ cấm ĐỌC
 * (`appState.get()`), KHÔNG cấm GHI (`set`/`mutate`). Riêng vòng lặp cột tần số (màu đổi theo `i`,
 * cần `getComputedColor()`) tách thành `computeBlackHoleBarsFrame()` (thuần, trả SPEC) +
 * `paintBlackHoleBarLines()` (chỉ Canvas API) — Workflow tự resolve màu rồi gọi paint cho từng
 * spec, cùng khuôn `core/visualizer/groups/bar/mirror.js`/`cascade.js`.
 */

/**
 * Bước vật lý + vẽ "sao" bị hút vào tâm — vẫn 1 khối `appState.mutate('stars', ...)` như bản gốc
 * (Rule 2 chỉ cấm đọc, GHI qua mutate được phép), bên trong tự vẽ (Canvas API — không tính Rule 3)
 * và tự bắn `starFlashes` mới khi 1 sao rơi vào tâm (`appState.mutate('starFlashes', ...)`, cũng
 * là ghi — được phép).
 */
function stepAndDrawBlackHoleStars(ctx, dpr, centerX, centerY, maxDist, currentRadius, currentSuction) {
    appState.mutate('stars', (arr) => arr.forEach((star) => {
        const distRatio = Math.max(0.05, star.distance / maxDist);
        const accel = 1 + (0.05 / distRatio);
        star.angle += star.baseSpeed * 0.002 * accel;
        star.distance -= star.baseSpeed * currentSuction * accel;
        if (star.distance < currentRadius) {
            appState.mutate('starFlashes', (flashes) => flashes.push({
                x: centerX + Math.cos(star.angle) * currentRadius, y: centerY + Math.sin(star.angle) * currentRadius,
                alpha: 1, size: star.size,
            }), { skipCheck: true });
            star.distance = maxDist * (1 + Math.random() * 0.2);
            star.angle = Math.random() * Math.PI * 2;
        }
        const ratio = star.distance / maxDist;
        ctx.fillStyle = `rgba(${star.colorTint}, ${0.1 + ratio})`;
        ctx.beginPath();
        ctx.arc(centerX + Math.cos(star.angle) * star.distance, centerY + Math.sin(star.angle) * star.distance, Math.max(0.1, star.size * ratio + 0.5 * dpr), 0, Math.PI * 2);
        ctx.fill();
    }), { skipCheck: true });
}

/**
 * Tiến + vẽ các tia sáng bùng ("flash") khi sao vừa rơi vào tâm — nhận `starFlashes` qua tham số
 * (Workflow tự `appState.get()` trước), chỉ GHI lại qua `appState.mutate()` khi cần xoá phần tử đã
 * tắt hẳn (được phép, cùng lý do trên).
 */
function advanceAndDrawBlackHoleFlashes(ctx, dpr, starFlashes, flashFadeSpeed) {
    for (let i = starFlashes.length - 1; i >= 0; i--) {
        const f = starFlashes[i];
        f.alpha -= flashFadeSpeed;
        f.size += 1.5 * dpr;
        if (f.alpha <= 0) {
            appState.mutate('starFlashes', (arr) => arr.splice(i, 1), { skipCheck: true });
        } else {
            ctx.beginPath();
            ctx.arc(f.x, f.y, Math.max(0.1, f.size), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${f.alpha})`;
            ctx.shadowBlur = 10 * dpr;
            ctx.shadowColor = 'white';
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }
}

/**
 * Tính khung hình dải cột tần số quanh viền hố đen — THUẦN, không appState/getActiveEffectConfig/
 * getComputedColor. Mỗi phần tử trả về là 1-2 đoạn thẳng (đối xứng trái/phải quanh centerX, đoạn
 * cuối cùng KHÔNG có bản sao trái — giữ đúng `if (i !== usefulLength - 1)` của bản gốc) + `colorArgs`
 * để Workflow tự `getComputedColor()`.
 * @returns {{colorArgs:number[], lines:object[]}[]}
 */
function computeBlackHoleBarsFrame(vizDataArray, usefulLength, minH, dpr, dynamicMaxBarHeight, centerX, centerY, currentRadius) {
    const scaledMinH = minH * dpr;
    const bars = [];
    for (let i = 0; i < usefulLength; i++) {
        const rawVal = vizDataArray[i] || 0;
        const freqBoost = 1 + (i / usefulLength) * 1.2;
        const boostedVal = Math.min(255, rawVal * freqBoost);
        let val = boostedVal;
        if (i > 0 && i < usefulLength - 1) {
            const prev = Math.min(255, (vizDataArray[i - 1] || 0) * (1 + ((i - 1) / usefulLength) * 1.2));
            const next = Math.min(255, (vizDataArray[i + 1] || 0) * (1 + ((i + 1) / usefulLength) * 1.2));
            val = (prev + boostedVal * 3 + next) / 5;
        }

        const normalized = val / 255;
        const contrastNormalized = Math.pow(normalized, 2.0);
        let barHeight = scaledMinH + (contrastNormalized * dynamicMaxBarHeight * 1.2);
        if (!vizDataArray[i] || vizDataArray[i] === 0) barHeight = scaledMinH;

        const angleOffset = (i / (usefulLength - 1)) * Math.PI;
        const angleR = (Math.PI / 2) - angleOffset, angleL = (Math.PI / 2) + angleOffset;

        const lines = [{
            x1: centerX + Math.cos(angleR) * currentRadius, y1: centerY + Math.sin(angleR) * currentRadius,
            x2: centerX + Math.cos(angleR) * (currentRadius + barHeight), y2: centerY + Math.sin(angleR) * (currentRadius + barHeight),
        }];
        if (i !== usefulLength - 1) {
            lines.push({
                x1: centerX + Math.cos(angleL) * currentRadius, y1: centerY + Math.sin(angleL) * currentRadius,
                x2: centerX + Math.cos(angleL) * (currentRadius + barHeight), y2: centerY + Math.sin(angleL) * (currentRadius + barHeight),
            });
        }
        bars.push({ colorArgs: [i, usefulLength, val], lines });
    }
    return bars;
}

/**
 * Bán kính hố đen mượt theo beat — `smoothedBeatRadius` là biến module-level PERSISTENT giữa các
 * frame (khai báo ở `core/dom-refs.js`, tự ghi chú "KHÔNG thuộc STATE"/không phải `appState`) —
 * đọc/ghi trực tiếp KHÔNG vi phạm Rule 2 (rule chỉ cấm `appState.get()`). Thuần về mặt Rule 3:
 * không gọi hàm core nào khác. @returns {number} currentRadius
 */
function computeBlackHoleRadius(minDimension, smoothedEnergy, beatScale, radiusRatio, radiusEnergyMult) {
    const targetRadius = (minDimension * radiusRatio) + (smoothedEnergy * minDimension * radiusEnergyMult);
    smoothedBeatRadius += (targetRadius - smoothedBeatRadius) * 0.15;
    return smoothedBeatRadius + (beatScale * minDimension * 0.03);
}

/** Thiết lập nét vẽ dùng chung cho cả dải cột tần số — gọi 1 lần TRƯỚC vòng lặp
 * `paintBlackHoleBarLines()`, khớp đúng vị trí bản gốc. Chỉ Canvas API. */
function paintBlackHoleBarsSetup(ctx, dpr, barWidth) {
    ctx.lineWidth = barWidth * dpr;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

/** Vẽ 1 lô đoạn thẳng CÙNG màu/glow đã resolve sẵn — chỉ gọi Canvas API (không tính Rule 3). */
function paintBlackHoleBarLines(ctx, lines, color, glow, dpr, blurMult) {
    ctx.strokeStyle = color;
    ctx.shadowColor = blurMult > 0 ? glow : 'transparent';
    ctx.shadowBlur = 10 * dpr * blurMult;
    lines.forEach((l) => {
        ctx.beginPath();
        ctx.moveTo(l.x1, l.y1);
        ctx.lineTo(l.x2, l.y2);
        ctx.stroke();
    });
}

/** Vẽ quầng bùng sáng (flare) khi nhạc dồn — thuần, không appState (Workflow tự đọc `globalHueOffset`
 * TRƯỚC khi gọi). Chỉ gọi Canvas API. */
function paintBlackHoleFlare(ctx, canvasWidth, canvasHeight, centerX, centerY, currentRadius, globalHueOffset, flareAlpha) {
    const grad = ctx.createRadialGradient(centerX, centerY, currentRadius, centerX, centerY, currentRadius * 4);
    grad.addColorStop(0, `hsla(${globalHueOffset}, 100%, 70%, ${flareAlpha * 0.3})`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

/** Vẽ tâm hố đen (đĩa đen tuyệt đối, không theo màu nền tuỳ chỉnh — xem ghi chú bản gốc). Thuần,
 * chỉ Canvas API. */
function paintBlackHoleCore(ctx, centerX, centerY, currentRadius) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(0.1, currentRadius), 0, 2 * Math.PI);
    ctx.fillStyle = '#000000';
    ctx.fill();
}
