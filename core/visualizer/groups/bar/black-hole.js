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
 * `paintBlackHoleBarShapes()` (chỉ Canvas API, đổi tên 28/09/2026) — Workflow tự resolve màu rồi gọi paint cho từng
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

/** MỚI (28/09/2026, Giang) — bề rộng "ô" mỗi cột (px CSS) = độ rộng cột TỐI ĐA: số cột tính theo chu vi hố đen sao cho
 * cột rộng 15px nằm SÁT nhau ở chân (xoè hình quạt ra ngoài), cột hẹp hơn thì hở tương ứng.
 * SỬA (28/09/2026, Giang báo "quá thưa") — bản trước tính theo bán kính NỀN (radiusRatio, chưa cộng năng lượng/beat)
 * trong khi hố đen lúc phát to hơn nền gần gấp đôi -> cột cách nhau ~21px. Nay tính theo bán kính ĐANG VẼ kiểu giữ đỉnh
 * (BLACK_HOLE_BAR_RADIUS_ATTACK/RELEASE_MS) + trễ đổi số cột (BLACK_HOLE_BAR_COUNT_HYSTERESIS) để cột không nhảy theo từng beat;
 * làm tròn LÊN -> khoảng cách tâm-tâm ≤ 15px (chồng nhẹ khi hố đen co lại — chấp nhận, Giang chốt). */
const BLACK_HOLE_BAR_SLOT_PX = 15;
const BLACK_HOLE_BAR_WIDTH_MIN = 5, BLACK_HOLE_BAR_WIDTH_MAX = 15;
const BLACK_HOLE_BAR_TOP_RADIUS_MAX = 5;
/** Tỉ lệ dải bin dùng (vùng trầm/trung — giữ như bản cũ, 35% đầu phổ). */
const BLACK_HOLE_BAR_SPAN_FRAC = 0.35;
/** Bán kính dùng để đếm cột = "giữ đỉnh": bám lên NHANH khi hố đen phồng (cột không kịp thưa ra), nhả xuống CHẬM khi co
 * (số cột không nhảy theo từng beat — lúc co cột chồng nhẹ thành hình quạt). */
const BLACK_HOLE_BAR_RADIUS_ATTACK_MS = 120;
const BLACK_HOLE_BAR_RADIUS_RELEASE_MS = 2500;
/** Chỉ đổi số cột khi số cột "lý tưởng" (số thực) lệch khỏi số đang dùng quá ngưỡng này (tránh bập bênh ở ranh giới). */
const BLACK_HOLE_BAR_COUNT_HYSTERESIS = 0.6;

/** Bán kính "giữ đỉnh" (bám lên nhanh, nhả chậm, theo dt) — frame đầu (prev = 0) lấy luôn bán kính hiện tại. */
function smoothBlackHoleBarRadius(prevRadius, currentRadius, dtMs) {
    const tau = currentRadius > prevRadius ? BLACK_HOLE_BAR_RADIUS_ATTACK_MS : BLACK_HOLE_BAR_RADIUS_RELEASE_MS;
    const alpha = prevRadius > 0 ? 1 - Math.exp(-dtMs / tau) : 1;
    return prevRadius + (currentRadius - prevRadius) * alpha;
}

/** Số khoảng cột trên NỬA vòng: lý tưởng = π·R / ô (làm tròn lên); giữ số cũ nếu còn trong ngưỡng trễ. */
function resolveBlackHoleBarHalfCount(prevHalfCount, avgRadius, dpr) {
    const ideal = (Math.PI * avgRadius) / (BLACK_HOLE_BAR_SLOT_PX * dpr);
    const keep = prevHalfCount > 0 && Math.abs(ideal - prevHalfCount) <= BLACK_HOLE_BAR_COUNT_HYSTERESIS;
    return Math.max(2, keep ? prevHalfCount : Math.ceil(ideal));
}

/** Số cột trên nửa vòng (tính cả cột đỉnh/đáy dùng chung — vòng đủ = 2 × halfCount cột) + số bin phổ trải lên chúng.
 * @returns {{ usefulLength: number, spanBins: number }} */
function computeBlackHoleBarLayout(halfCount, bufferLength) {
    return {
        usefulLength: halfCount + 1,
        spanBins: Math.max(2, Math.floor(bufferLength * BLACK_HOLE_BAR_SPAN_FRAC)),
    };
}

/**
 * Tính khung hình dải cột tần số quanh viền hố đen — THUẦN, không appState/getActiveEffectConfig/
 * getComputedColor. Mỗi phần tử = 1 mức tần số, vẽ thành 1-2 cột đối xứng trái/phải quanh trục dọc (cột đầu/cuối nằm
 * trên trục dọc nên chỉ 1 bản). SỬA (28/09/2026): `usefulLength` cột trải lại lên `spanBins` bin phổ (số cột giờ
 * theo bán kính, không còn = số bin); trả GÓC + chiều cao thay vì đoạn thẳng (cột vẽ thành khối bo góc đỉnh, xem
 * paintBlackHoleBarShapes()).
 * @returns {{colorArgs:number[], angles:number[], height:number}[]}
 */
function computeBlackHoleBarsFrame(vizDataArray, usefulLength, spanBins, minH, dpr, dynamicMaxBarHeight) {
    const scaledMinH = minH * dpr;
    const binAt = (i) => Math.min(spanBins - 1, Math.floor((i * spanBins) / usefulLength));
    const boosted = (i) => Math.min(255, (vizDataArray[binAt(i)] || 0) * (1 + (i / usefulLength) * 1.2));
    const bars = [];
    for (let i = 0; i < usefulLength; i++) {
        const boostedVal = boosted(i);
        const val = i > 0 && i < usefulLength - 1 ? (boosted(i - 1) + boostedVal * 3 + boosted(i + 1)) / 5 : boostedVal;
        const contrastNormalized = Math.pow(val / 255, 2.0);
        const height = vizDataArray[binAt(i)] ? scaledMinH + (contrastNormalized * dynamicMaxBarHeight * 1.2) : scaledMinH;
        const angleOffset = (i / (usefulLength - 1)) * Math.PI;
        // Cột đầu (đáy) và cột cuối (đỉnh) nằm trên trục dọc -> chỉ 1 bản (bản cũ vẽ trùng 2 lần cột đầu).
        const onAxis = i === 0 || i === usefulLength - 1;
        const angles = onAxis ? [(Math.PI / 2) - angleOffset] : [(Math.PI / 2) - angleOffset, (Math.PI / 2) + angleOffset];
        bars.push({ colorArgs: [i, usefulLength, val], angles, height });
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

/** SỬA (28/09/2026, Giang) — THAY paintBlackHoleBarsSetup()/paintBlackHoleBarLines() (nét thẳng đầu tròn): mỗi cột
 * là 1 khối chữ nhật mọc từ viền hố đen ra ngoài theo `angles`, chân phẳng, 2 góc ĐỈNH bo `topRadiusPx` (px CSS,
 * 0-5, tự kẹp theo nửa bề rộng/chiều cao). `widthPx` px CSS (5-15). Màu/glow đã resolve sẵn. Chỉ Canvas API. */
function paintBlackHoleBarShapes(ctx, angles, height, centerX, centerY, radius, widthPx, topRadiusPx, color, glow, dpr, blurMult) {
    const w = Math.max(BLACK_HOLE_BAR_WIDTH_MIN, Math.min(BLACK_HOLE_BAR_WIDTH_MAX, widthPx)) * dpr;
    const r = Math.max(0, Math.min(Math.min(BLACK_HOLE_BAR_TOP_RADIUS_MAX, topRadiusPx) * dpr, w / 2, height));
    const hw = w / 2;
    ctx.fillStyle = color;
    ctx.shadowColor = blurMult > 0 ? glow : 'transparent';
    ctx.shadowBlur = 10 * dpr * blurMult;
    angles.forEach((a) => {
        ctx.save();
        ctx.translate(centerX + Math.cos(a) * radius, centerY + Math.sin(a) * radius);
        ctx.rotate(a); // trục x hướng ra ngoài tâm
        ctx.beginPath();
        ctx.moveTo(0, -hw);
        ctx.lineTo(height - r, -hw);
        ctx.arcTo(height, -hw, height, -hw + r, r);
        ctx.lineTo(height, hw - r);
        ctx.arcTo(height, hw, height - r, hw, r);
        ctx.lineTo(0, hw);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
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
