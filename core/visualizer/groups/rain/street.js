/**
 * core/visualizer/groups/rain/street.js — [LÀM PHẲNG, 05/09/2026, yêu cầu Giang] Style 'street'
 * (mưa phố & công viên về đêm — đèn đường 3 cột + hàng rào công viên) tách riêng khỏi
 * `core/visualizer/types/rain.js` cũ (trước đây gộp chung với 'glass'). Nội dung hàm GIỮ NGUYÊN
 * 100%.
 *
 * [SỬA — rà soát Rule 3, không ngoại lệ] TRƯỚC ĐÂY `drawRainStreet()`/`drawParkFence()` tự
 * `appState.get()` (Rule 2) + tự gọi `getActiveEffectConfig()`/`getComputedColor()`/
 * `getVisualBgFillStyle()`/`interpolateColor()`/`drawParkFence()` nội bộ (Rule 3). SỬA: mọi hàm
 * dưới đây giờ CHỈ nhận tham số; những chỗ cần gọi Core khác đều chuyển ra Workflow
 * (`_tickRainStreet()`, event/workflow/visualizer-render.js) gọi RIÊNG LẺ. `appState.mutate(
 * 'streetRain'/'streetLamps'/'ripples', ...)` GIỮ NGUYÊN bên trong — Rule 2 chỉ cấm ĐỌC, không
 * cấm GHI.
 *
 * `computeRainFlashAlpha()`/`paintRainFlash()` (chớp sáng, dùng chung với style 'glass') nằm ở
 * `core/visualizer/groups/rain/common.js`.
 *
 * NẠP SAU: core/visualizer/groups/rain/common.js.
 */

// =================================== Kiểu 'street' — phố đêm ===================================

// Hàng rào kiểu cổng/rào công viên cổ điển — một dãy cọc thẳng đứng nối bằng 2 thanh
// ngang, chạy dọc suốt chiều ngang màn hình ngay trên mặt đất (groundY). Vẽ tĩnh, màu tối
// gần với màu nền/cột đèn để gợi cảm giác hàng rào sắt cũ đứng yên trong mưa, không cướp
// sự chú ý khỏi đèn đường hay mưa.
function paintParkFence(ctx, canvasWidth, groundY, dpr) {
    const postSpacing = 26 * dpr;
    const postH = 34 * dpr;
    const postW = 2 * dpr;
    const fenceColor = '#0a0c11';
    const railTopY = groundY - postH * 0.78;
    const railBottomY = groundY - postH * 0.22;

    ctx.fillStyle = fenceColor;
    ctx.fillRect(0, railTopY - dpr, canvasWidth, 2 * dpr);
    ctx.fillRect(0, railBottomY - dpr, canvasWidth, 2 * dpr);

    for (let x = postSpacing * 0.5; x < canvasWidth; x += postSpacing) {
        ctx.fillRect(x - postW / 2, groundY - postH, postW, postH);
        ctx.beginPath();
        ctx.moveTo(x - postW * 1.3, groundY - postH);
        ctx.lineTo(x, groundY - postH - postW * 2.4);
        ctx.lineTo(x + postW * 1.3, groundY - postH);
        ctx.closePath();
        ctx.fill();
    }
}

/** Cường độ mưa — tỉ lệ nghịch với năng lượng nhạc. Thuần. */
function computeRainIntensity(isPlaying, smoothedEnergy) {
    return isPlaying ? (1 - smoothedEnergy * 0.75) : 1;
}

/** Vẽ + tiến vật lý 1 lượt các hạt mưa "active" — đúng khuôn `appState.mutate('streetRain', ...)`
 * bản gốc (Rule 2 chỉ cấm ĐỌC, GHI qua mutate được phép nguyên trạng). `streetRainLength` nhận qua
 * tham số (Workflow tự đọc `.length` TRƯỚC). */
function paintRainStreetDrops(ctx, canvasWidth, canvasHeight, dpr, streetRainLength, rainIntensity) {
    const activeRainCount = Math.max(20, Math.floor(streetRainLength * rainIntensity));
    ctx.strokeStyle = `rgba(200, 215, 230, ${0.35 * rainIntensity + 0.15})`;
    ctx.lineWidth = (1 + rainIntensity * 0.8) * dpr;
    ctx.lineCap = 'round';
    ctx.beginPath();
    appState.mutate('streetRain', (arr) => {
        for (let i = 0; i < activeRainCount; i++) {
            const drop = arr[i];
            drop.y += drop.speed * (0.6 + rainIntensity * 0.8);
            drop.x += drop.drift * dpr;
            if (drop.y > canvasHeight) { drop.y = -drop.len; drop.x = Math.random() * canvasWidth; }
            if (drop.x < -20 * dpr) drop.x = canvasWidth + 20 * dpr;
            if (drop.x > canvasWidth + 20 * dpr) drop.x = -20 * dpr;
            const dropLen = drop.len * (0.6 + rainIntensity * 0.7);
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x + drop.drift * 4 * dpr, drop.y - dropLen);
        }
    }, { skipCheck: true });
    ctx.stroke();
}

/** Vẽ mặt đất công viên (gradient) từ danh sách color-stop ĐÃ resolve sẵn (Workflow tự
 * `interpolateColor()` theo `cfg.mode` TRƯỚC — Rule 3, cùng khuôn). Chỉ Canvas API. */
function paintRainGroundGradient(ctx, canvasWidth, canvasHeight, groundY, stopColors) {
    const grad = ctx.createLinearGradient(0, groundY, 0, canvasHeight);
    stopColors.forEach((s) => grad.addColorStop(s.offset, s.color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY, canvasWidth, canvasHeight - groundY);
}

/**
 * Tiến flicker + tính khung hình TỪNG đèn đường — vẫn 1 khối `appState.mutate('streetLamps', ...)`
 * như bản gốc (Rule 2 chỉ cấm đọc). KHÔNG tự gọi `getComputedColor()` — trả `colorArgs` để Workflow
 * tự resolve rồi `paintRainLamp()` cho từng spec (Rule 3, cùng khuôn `_fwMaterializeSpecs()`).
 * @returns {object[]} specs, cùng thứ tự `streetLamps`.
 */
function advanceRainLampsAndBuildSpecs(streetLamps, isPlaying, beatScale, dpr) {
    const specs = [];
    appState.mutate('streetLamps', (arr) => arr.forEach((lamp, lampIdx) => {
        const bassKick = isPlaying ? beatScale : 0;
        const flickerTarget = 0.65 + bassKick * (1 - lamp.depth * 0.6) * 1.15 + (Math.random() < 0.06 ? -0.22 : 0);
        lamp.flicker += (flickerTarget - lamp.flicker) * 0.3;
        const glow = Math.max(0.12, Math.min(1.5, lamp.flicker));
        const postTopY = lamp.baseY - lamp.height;
        const postW = (lamp.main ? 5 : 3.5) * dpr;
        const capW = postW * 3.2;
        const flareScale = lamp.flareScale || 1;
        const haloR = (lamp.main ? 150 : 95) * dpr * (1 - lamp.depth * 0.3) * (0.7 + glow * 0.55) * flareScale;
        specs.push({
            colorArgs: [lampIdx, streetLamps.length, Math.round(glow * 255)],
            x: lamp.x, main: lamp.main, depth: lamp.depth, height: lamp.height,
            postTopY, postW, capW, haloR, glow,
            postColor: lamp.depth > 0 ? `rgba(15,18,24,${0.9 - lamp.depth * 0.3})` : '#15181f',
        });
    }), { skipCheck: true });
    return specs;
}

/** Vẽ 1 đèn đường (cột + chụp + quầng sáng + bóng đèn) từ spec đã tính + `lampFill` đã resolve sẵn
 * (Workflow tự chọn theo `cfg.mode` — solid/dynamic dùng thẳng màu cấu hình, gradient dùng
 * `colorArgs` đã resolve, cùng logic `getComputedColor()` vốn đã tự chọn nội bộ). Chỉ Canvas API. */
function paintRainLamp(ctx, spec, lampFill, dpr) {
    ctx.fillStyle = spec.postColor;
    ctx.fillRect(spec.x - spec.postW / 2, spec.postTopY, spec.postW, spec.height);

    ctx.beginPath();
    ctx.moveTo(spec.x - spec.capW / 2, spec.postTopY);
    ctx.lineTo(spec.x + spec.capW / 2, spec.postTopY);
    ctx.lineTo(spec.x + spec.capW * 0.32, spec.postTopY - spec.capW * 0.5);
    ctx.lineTo(spec.x - spec.capW * 0.32, spec.postTopY - spec.capW * 0.5);
    ctx.closePath();
    ctx.fillStyle = '#0c0e12';
    ctx.fill();

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const lampGlow = ctx.createRadialGradient(spec.x, spec.postTopY + 6 * dpr, 1, spec.x, spec.postTopY + 6 * dpr, spec.haloR);
    ctx.globalAlpha = 0.6 * spec.glow * (1 - spec.depth * 0.4);
    lampGlow.addColorStop(0, lampFill);
    lampGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = lampGlow;
    ctx.beginPath();
    ctx.arc(spec.x, spec.postTopY + 6 * dpr, spec.haloR, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = Math.min(1, spec.glow);
    ctx.fillStyle = lampFill;
    ctx.beginPath();
    ctx.arc(spec.x, spec.postTopY + 6 * dpr, (spec.main ? 5 : 3.5) * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1.0;
    ctx.restore();
}

/** Sinh 1 gợn nước dưới chân đèn chính — chỉ GHI qua `appState.mutate()` (được phép). `color`/`glow`
 * đã resolve sẵn (Workflow tự `getComputedColor(0, 1, 200)` TRƯỚC — giá trị cố định, không cần spec). */
function spawnRainRipple(lampX, groundY, canvasHeight, dpr, color, glow) {
    appState.mutate('ripples', (arr) => arr.push({
        x: lampX + (Math.random() - 0.5) * 60 * dpr, y: groundY + (canvasHeight - groundY) * 0.4,
        radius: 4 * dpr, maxRadius: 50 * dpr, speed: 1.5 * dpr, alpha: 0.5, color, glow,
    }), { skipCheck: true });
}

/** Tiến + vẽ toàn bộ gợn nước hiện có — nhận `ripples` qua tham số (Workflow tự `appState.get()`
 * TRƯỚC, Rule 2). Không cần màu mới (đã lưu sẵn trên từng ripple lúc sinh). Chỉ GHI qua
 * `appState.mutate()` khi xoá gợn đã tắt hẳn (được phép). */
function advanceAndDrawRainRipples(ctx, ripples, dpr) {
    for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        rip.radius += rip.speed;
        rip.alpha -= (rip.speed / rip.maxRadius) * 1.2;
        if (rip.alpha <= 0) {
            appState.mutate('ripples', (arr) => arr.splice(i, 1), { skipCheck: true });
        } else {
            ctx.beginPath();
            ctx.ellipse(rip.x, rip.y, Math.max(0.1, rip.radius), Math.max(0.1, rip.radius * 0.3), 0, 0, Math.PI * 2);
            ctx.strokeStyle = rip.color;
            ctx.globalAlpha = Math.max(0, rip.alpha);
            ctx.lineWidth = 1.5 * dpr;
            ctx.stroke();
        }
    }
}
