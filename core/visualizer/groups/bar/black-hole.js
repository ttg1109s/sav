/**
 * core/visualizer/groups/bar/black-hole.js — Style 'black hole' của group bar (CHUYỂN NHÓM 05/09/2026 từ
 * `core/visualizer/types/black-hole.js`). Sao bị hút vào tâm hố đen + quầng sáng khi nhạc dồn + vòng cột tần số quanh
 * viền + (MỚI 29/09/2026) tia bức xạ Hawking bắn ngang 2 bên khi beat mạnh.
 *
 * CẢI TIẾN (29/09/2026, Giang duyệt sau phần nghiên cứu):
 *   1. [HOÀN NGUYÊN cùng ngày — Giang: "bar scale lộn xộn, chỗ cao chỗ thấp, không dàn đều"] Chia dải LOG qua core mirror
 *      + FFT 2048 đã BỎ. Mức cột quay về ánh xạ cũ: FFT 256, 35% đầu phổ trải đều lên số cột, đỉnh trong cửa sổ bin/cột,
 *      tăng cường tần cao tuyến tính, làm mượt 3 cột kề, tương phản pow 2 (`computeBlackHoleBarLevels()`).
 *   2. Chuyển động: envelope cột theo dt (lên nhanh, xuống chậm) — KHÔNG có vạch đỉnh (Giang). Mọi bước theo frame cũ
 *      (bán kính mượt ×0.15/frame, sao cộng mỗi frame) đổi sang dt — màn 90/120Hz chạy cùng tốc độ màn 60Hz.
 *      `smoothedBeatRadius` (biến global ở core/dom-refs.js) chuyển thành trạng thái riêng của Workflow.
 *   3. Màu + hiệu năng: flare/tia theo Color mode (getComputedColor() — Workflow resolve rồi truyền vào). SAO GIỮ MÀU GỐC
 *      (trắng, vài sao ngả xanh/vàng — Giang: sao không nối vào Color mode). Glow cột
 *      không còn `shadowBlur` từng cột: vẽ 1 lượt vào 2 lớp canvas phụ độ phân giải thấp rồi phóng lên (downsample-blur).
 *      Hiệu ứng CHỚP khi sao va vào viền hố đen ĐÃ BỎ HẲN (Giang) — cùng state `starFlashes` + field `flashFadeSpeed`.
 *   4. Hình ảnh: sao vẽ thành VỆT CONG bám đúng quỹ đạo xoắn ốc sao đang đi (đuôi mờ + mảnh dần, đầu là chấm sao gốc;
 *      sát viền đuôi kéo dài theo phương tiếp tuyến — giả thấu kính hấp dẫn);
 *      sóng xung kích -> tia chớp ngang dày, mờ kiểu bức xạ Hawking, phóng ra từ 2 bên hố đen, nằm SAU vòng cột (Giang).
 *
 * Mọi hàm THUẦN theo Rule 2/3 (không appState.get(), không gọi core khác) — riêng `stepBlackHoleStars()` GHI
 * `appState.mutate('stars')` (Rule 2 cho phép ghi; hot path nên không log, Rule 4 ngoại lệ). Điều phối ở
 * event/workflow/visualizer/bar.js (`_drawBlackHole()`).
 *
 */

/** Tỉ lệ đổi bước "theo frame" cũ sang dt: 1 = 1 frame 60fps. */
const BLACK_HOLE_FRAME_MS = 1000 / 60;

// ===================== bán kính hố đen =====================

/** Bán kính đích (chưa làm mượt) theo năng lượng. */
function computeBlackHoleTargetRadius(minDimension, smoothedEnergy, radiusRatio, radiusEnergyMult) {
    return (minDimension * radiusRatio) + (smoothedEnergy * minDimension * radiusEnergyMult);
}

/** Làm mượt bán kính nền — tương đương EMA 0.15/frame 60fps của bản cũ nhưng theo dt. prev = 0 (lần đầu) -> hố đen
 * "nở" từ 0 như bản cũ. */
function smoothBlackHoleBaseRadius(prevRadius, targetRadius, dtMs) {
    const alpha = 1 - Math.pow(0.85, dtMs / BLACK_HOLE_FRAME_MS);
    return prevRadius + (targetRadius - prevRadius) * alpha;
}

/** Bán kính đang vẽ = nền đã mượt + nhún theo beat (tức thời, như bản cũ). */
function computeBlackHoleBeatRadius(baseRadius, beatScale, minDimension) {
    return baseRadius + (beatScale * minDimension * 0.03);
}

// ===================== sao =====================

/** Vệt sao = quãng đường của bấy nhiêu frame 60fps, chia BLACK_HOLE_STAR_TRAIL_SEGMENTS đoạn lấy mẫu trên quỹ đạo thật. */
const BLACK_HOLE_STAR_TRAIL_FRAMES = 14;
const BLACK_HOLE_STAR_TRAIL_SEGMENTS = 4;
/** Kéo dài vệt theo phương tiếp tuyến khi sát viền: × (1 + GAIN × (R/d)²). */
const BLACK_HOLE_STAR_LENS_GAIN = 4;

/** Bước vật lý sao (công thức cũ, nhân `frameScale` = dt / 1 frame 60fps). Lưu vận tốc 1 frame chuẩn vào
 * `vAngle`/`vDist` để vẽ vệt. Sao rơi qua viền -> tái sinh ở rìa ngoài (KHÔNG còn chớp — Giang bỏ). */
function stepBlackHoleStars(maxDist, currentRadius, currentSuction, frameScale) {
    appState.mutate('stars', (arr) => arr.forEach((star) => {
        const distRatio = Math.max(0.05, star.distance / maxDist);
        const accel = 1 + (0.05 / distRatio);
        star.vAngle = star.baseSpeed * 0.002 * accel;
        star.vDist = star.baseSpeed * currentSuction * accel;
        star.angle += star.vAngle * frameScale;
        star.distance -= star.vDist * frameScale;
        if (star.distance >= currentRadius) return;
        star.distance = maxDist * (1 + Math.random() * 0.2);
        star.angle = Math.random() * Math.PI * 2;
    }), { skipCheck: true });
}

/** Vẽ sao: ĐẦU = chấm sao gốc (màu `colorTint`, alpha 0.1 + tỉ lệ khoảng cách, bán kính size·tỉ lệ + 0.5px — y bản gốc);
 * ĐUÔI = vệt CONG lấy mẫu lùi dọc quỹ đạo xoắn ốc (góc lùi theo vAngle, bán kính lùi theo vDist), mờ + mảnh dần về
 * cuối. Đuôi ngắn hơn 1px (sao ở xa, gần như đứng yên) -> chỉ vẽ chấm. Chỉ Canvas API. */
function drawBlackHoleStarStreaks(ctx, stars, centerX, centerY, maxDist, currentRadius, dpr) {
    const stepFrames = BLACK_HOLE_STAR_TRAIL_FRAMES / BLACK_HOLE_STAR_TRAIL_SEGMENTS;
    ctx.save();
    ctx.lineCap = 'round';
    stars.forEach((star) => {
        const ratio = star.distance / maxDist;
        const alpha = Math.min(1, 0.1 + ratio);
        const headR = Math.max(0.1, star.size * ratio + 0.5 * dpr);
        const lens = 1 + BLACK_HOLE_STAR_LENS_GAIN * Math.pow(currentRadius / Math.max(currentRadius, star.distance), 2);
        const pointAt = (k) => {
            const a = star.angle - star.vAngle * lens * stepFrames * k;
            const d = star.distance + star.vDist * stepFrames * k;
            return { x: centerX + Math.cos(a) * d, y: centerY + Math.sin(a) * d };
        };
        const head = pointAt(0);
        const tail = pointAt(BLACK_HOLE_STAR_TRAIL_SEGMENTS);
        if (Math.hypot(tail.x - head.x, tail.y - head.y) >= dpr) {
            let prev = head;
            for (let k = 1; k <= BLACK_HOLE_STAR_TRAIL_SEGMENTS; k++) {
                const next = pointAt(k);
                const fade = 1 - k / (BLACK_HOLE_STAR_TRAIL_SEGMENTS + 1);
                ctx.strokeStyle = `rgba(${star.colorTint}, ${alpha * fade * 0.7})`;
                ctx.lineWidth = Math.max(0.2, 2 * headR * fade * 0.8);
                ctx.beginPath();
                ctx.moveTo(prev.x, prev.y);
                ctx.lineTo(next.x, next.y);
                ctx.stroke();
                prev = next;
            }
        }
        ctx.fillStyle = `rgba(${star.colorTint}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(head.x, head.y, headR, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.restore();
}

// ===================== màu =====================

/** Màu CSS bất kỳ (hex/hsl/hsla/rgb) -> "r, g, b" để ghép rgba(…, alpha) cho gradient mờ dần (canvas nội suy gradient
 * KHÔNG premultiplied — dừng ở 'transparent' sẽ ngả đen). Dùng bộ chuẩn hoá màu của chính canvas: gán fillStyle rồi
 * đọc lại luôn ra '#rrggbb' hoặc 'rgba(r, g, b, a)'. Trả lại fillStyle cũ. */
function resolveBlackHoleRgb(ctx, css) {
    const prev = ctx.fillStyle;
    ctx.fillStyle = '#ffffff';
    ctx.fillStyle = css;
    const s = String(ctx.fillStyle);
    ctx.fillStyle = prev;
    const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(s);
    const parts = hex ? hex.slice(1, 4).map((h) => parseInt(h, 16)) : (s.match(/[\d.]+/g) || [255, 255, 255]).slice(0, 3);
    return parts.join(', ');
}

// ===================== vòng cột tần số =====================

/** Ô mỗi cột (px CSS) = độ rộng cột TỐI ĐA — số cột tính theo chu vi ĐẦU CỘT (hố đen + cao trung bình) để cột rộng nhất
 * chạm nhau ở đầu, chồng hình quạt ở chân (28-29/09/2026, Giang). */
const BLACK_HOLE_BAR_SLOT_PX = 10;
const BLACK_HOLE_BAR_WIDTH_MIN = 5, BLACK_HOLE_BAR_WIDTH_MAX = 10;
const BLACK_HOLE_BAR_TOP_RADIUS_MAX = 5;
/** Bán kính đếm cột "giữ đỉnh": bám lên nhanh, nhả chậm; + ngưỡng trễ đổi số cột. */
const BLACK_HOLE_BAR_RADIUS_ATTACK_MS = 120;
const BLACK_HOLE_BAR_RADIUS_RELEASE_MS = 2500;
const BLACK_HOLE_BAR_COUNT_HYSTERESIS = 0.6;
/** Tỉ lệ dải bin dùng (vùng trầm/trung — 35% đầu phổ FFT 256, như bản cũ). */
const BLACK_HOLE_BAR_SPAN_FRAC = 0.35;
/** Envelope cột: hằng thời gian lên / xuống (ms). */
const BLACK_HOLE_BAR_ATTACK_MS = 25;
const BLACK_HOLE_BAR_RELEASE_MS = 220;
/** Hệ số chiều cao tối đa (giữ như bản cũ: 1.2 × maxH động). */
const BLACK_HOLE_BAR_HEIGHT_GAIN = 1.2;

/** Bán kính "giữ đỉnh" (theo dt) — prev = 0 hoặc dt = Infinity -> bám ngay. */
function smoothBlackHoleBarRadius(prevRadius, currentRadius, dtMs) {
    const tau = currentRadius > prevRadius ? BLACK_HOLE_BAR_RADIUS_ATTACK_MS : BLACK_HOLE_BAR_RADIUS_RELEASE_MS;
    const alpha = prevRadius > 0 ? 1 - Math.exp(-dtMs / tau) : 1;
    return prevRadius + (currentRadius - prevRadius) * alpha;
}

/** Chiều cao cột trung bình (px thiết bị) — Workflow cộng vào bán kính để đếm cột theo đầu cột. */
function computeBlackHoleMeanBarHeight(bars) {
    if (bars.length === 0) return 0;
    return bars.reduce((sum, b) => sum + b.height, 0) / bars.length;
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
 * Mức 0-1 từng cột — ÁNH XẠ CŨ giữ nguyên công thức (HOÀN NGUYÊN 29/09/2026): cột i đặt tại bin liên tục
 * i × (spanBins − 1) / (usefulLength − 1) (cột đầu = bin 0, cột cuối = bin cuối), lấy ĐỈNH trong cửa sổ ± nửa khoảng
 * bin/cột (nội suy ở 2 mép), tăng cường tần cao tuyến tính, làm mượt 3 cột kề (1-3-1), tương phản pow 2. Chỉ tách phần
 * "ra chiều cao" sang computeBlackHoleBarsFrame() để envelope theo dt chen vào giữa. Bin im lặng (raw = 0) -> 0.
 * @returns {Float32Array}
 */
function computeBlackHoleBarLevels(vizDataArray, usefulLength, spanBins) {
    const binStep = usefulLength > 1 ? (spanBins - 1) / (usefulLength - 1) : 0;
    const binAt = (b) => vizDataArray[b] || 0;
    const sampleAt = (x) => {
        const b0 = Math.floor(x), f = x - b0;
        return binAt(b0) * (1 - f) + binAt(Math.min(spanBins - 1, b0 + 1)) * f;
    };
    const raw = [];
    for (let i = 0; i < usefulLength; i++) {
        const center = i * binStep;
        const lo = Math.max(0, center - binStep / 2), hi = Math.min(spanBins - 1, center + binStep / 2);
        let peak = Math.max(sampleAt(lo), sampleAt(hi));
        for (let b = Math.ceil(lo); b <= Math.floor(hi); b++) peak = Math.max(peak, binAt(b));
        raw.push(peak);
    }
    const boosted = raw.map((v, i) => Math.min(255, v * (1 + (i / usefulLength) * 1.2)));
    const levels = new Float32Array(usefulLength);
    for (let i = 0; i < usefulLength; i++) {
        const val = i > 0 && i < usefulLength - 1 ? (boosted[i - 1] + boosted[i] * 3 + boosted[i + 1]) / 5 : boosted[i];
        levels[i] = raw[i] > 0 ? Math.pow(val / 255, 2.0) : 0;
    }
    return levels;
}

/** Envelope trước đó (0-1) kéo giãn về `count` phần tử bằng nội suy tuyến tính — số cột đổi theo bán kính thì cột không
 * sụp về 0. Cùng độ dài -> trả nguyên mảng. */
function resampleBlackHoleLevels(prevLevels, count) {
    if (prevLevels.length === count) return prevLevels;
    const out = new Float32Array(count);
    if (prevLevels.length === 0) return out;
    const scale = count > 1 ? (prevLevels.length - 1) / (count - 1) : 0;
    for (let i = 0; i < count; i++) {
        const x = i * scale, k = Math.floor(x), f = x - k;
        out[i] = prevLevels[k] * (1 - f) + (prevLevels[Math.min(prevLevels.length - 1, k + 1)] || 0) * f;
    }
    return out;
}

/** 1 bước envelope: mức mới cao hơn -> bám lên nhanh (ATTACK), thấp hơn -> nhả chậm (RELEASE), theo dt. Trả mảng MỚI. */
function stepBlackHoleBarEnvelope(prevLevels, targetLevels, dtMs) {
    const up = 1 - Math.exp(-dtMs / BLACK_HOLE_BAR_ATTACK_MS);
    const down = 1 - Math.exp(-dtMs / BLACK_HOLE_BAR_RELEASE_MS);
    const out = new Float32Array(targetLevels.length);
    for (let i = 0; i < targetLevels.length; i++) {
        const prev = prevLevels[i] || 0, target = targetLevels[i];
        out[i] = prev + (target - prev) * (target > prev ? up : down);
    }
    return out;
}

/**
 * Khung hình vòng cột — THUẦN. `levels[i]` 0-1 (computeBlackHoleBarLevels() + envelope), i = 0 là cột ĐÁY (bin thấp),
 * cuối = cột ĐỈNH; chiều cao = minH + mức × maxH động × 1.2 (như bản cũ). Mỗi mức vẽ thành 2 cột đối xứng trái/phải
 * quanh trục dọc (cột đáy/đỉnh nằm trên trục -> 1 bản). Giá trị màu = √mức × 255 (= byte đã làm mượt của bản cũ).
 * @returns {{colorArgs:number[], angles:number[], height:number}[]}
 */
function computeBlackHoleBarsFrame(levels, minH, dpr, dynamicMaxBarHeight) {
    const n = levels.length;
    const scaledMinH = minH * dpr;
    const bars = [];
    for (let i = 0; i < n; i++) {
        const level = levels[i];
        const height = scaledMinH + level * dynamicMaxBarHeight * BLACK_HOLE_BAR_HEIGHT_GAIN;
        const angleOffset = (i / Math.max(1, n - 1)) * Math.PI;
        const onAxis = i === 0 || i === n - 1;
        const angles = onAxis ? [(Math.PI / 2) - angleOffset] : [(Math.PI / 2) - angleOffset, (Math.PI / 2) + angleOffset];
        bars.push({ colorArgs: [i, n, Math.round(Math.sqrt(level) * 255)], angles, height });
    }
    return bars;
}

/** Trải cột thành danh sách PHẲNG (1 phần tử / góc) kèm màu đã resolve (`colors[k]` ứng `bars[k]`), xếp theo CHIỀU KIM
 * ĐỒNG HỒ từ hướng 3 giờ — mỗi cột bị cột kế tiếp theo chiều kim che (29/09/2026, Giang).
 * @returns {{angle:number, height:number, fill:string, glow:string}[]} */
function orderBlackHoleBarsClockwise(bars, colors) {
    const TAU = Math.PI * 2;
    const entries = [];
    bars.forEach((b, k) => b.angles.forEach((a) => entries.push({ angle: ((a % TAU) + TAU) % TAU, height: b.height, fill: colors[k].fill, glow: colors[k].glow })));
    return entries.sort((p, q) => p.angle - q.angle);
}

/** 1 cột: khối chữ nhật mọc từ viền ra ngoài, chân phẳng, 2 góc ĐỈNH bo `topRadiusPx` (px CSS 0-5). `widthPx` px CSS
 * (5-10). Tô bằng `color` (không shadow — glow vẽ riêng qua lớp phụ, xem paintBlackHoleGlowLayers()). Chỉ Canvas API;
 * ghép được với transform sẵn có của ctx (lớp glow thu nhỏ). */
function paintBlackHoleBar(ctx, entry, color, centerX, centerY, radius, widthPx, topRadiusPx, dpr) {
    const w = Math.max(BLACK_HOLE_BAR_WIDTH_MIN, Math.min(BLACK_HOLE_BAR_WIDTH_MAX, widthPx)) * dpr;
    const h = entry.height;
    const r = Math.max(0, Math.min(Math.min(BLACK_HOLE_BAR_TOP_RADIUS_MAX, topRadiusPx) * dpr, w / 2, h));
    const hw = w / 2;
    ctx.save();
    ctx.fillStyle = color;
    ctx.translate(centerX + Math.cos(entry.angle) * radius, centerY + Math.sin(entry.angle) * radius);
    ctx.rotate(entry.angle); // trục x hướng ra ngoài tâm, +y = phía theo chiều kim đồng hồ
    ctx.beginPath();
    ctx.moveTo(0, -hw);
    ctx.lineTo(h - r, -hw);
    ctx.arcTo(h, -hw, h, -hw + r, r);
    ctx.lineTo(h, hw - r);
    ctx.arcTo(h, hw, h - r, hw, r);
    ctx.lineTo(0, hw);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

/** Khép vòng: mở vùng cắt = nửa NGƯỢC chiều kim của cột vẽ đầu tiên (rộng dư 2 bên) để Workflow vẽ lại cột đó đè đúng
 * thứ tự lên cột vẽ cuối. Đóng bằng endBlackHoleSeamClip(). */
function beginBlackHoleSeamClip(ctx, entry, centerX, centerY, radius, maxHeight) {
    const reach = radius + maxHeight;
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(entry.angle);
    ctx.beginPath();
    ctx.rect(-reach * 0.25, -reach, reach * 1.5, reach); // nửa y < 0 = phía ngược chiều kim
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clip();
}

function endBlackHoleSeamClip(ctx) {
    ctx.restore();
}

// ===================== glow (downsample-blur) =====================

/** Lớp glow: `near` = 1 texel / 2px CSS (quầng sát), `far` = 1 texel / 6px CSS (quầng loang). Phóng lên bằng nội suy
 * song tuyến -> mờ gần giống shadowBlur nhưng chỉ tốn 2 drawImage/frame thay vì shadowBlur từng cột. */
const BLACK_HOLE_GLOW_NEAR_CSS_PX = 2;
const BLACK_HOLE_GLOW_FAR_CSS_PX = 6;

/** Tạo 2 canvas phụ (không gắn DOM — chỉ là bộ đệm pixel) theo kích thước canvas chính. */
function createBlackHoleGlowLayers(canvasWidth, canvasHeight, dpr) {
    const make = (cssPerTexel) => {
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.ceil(canvasWidth / (cssPerTexel * dpr)));
        c.height = Math.max(1, Math.ceil(canvasHeight / (cssPerTexel * dpr)));
        return { canvas: c, ctx: c.getContext('2d'), scale: c.width / canvasWidth };
    };
    return { key: `${canvasWidth}x${canvasHeight}@${dpr}`, near: make(BLACK_HOLE_GLOW_NEAR_CSS_PX), far: make(BLACK_HOLE_GLOW_FAR_CSS_PX) };
}

/** Khoá kích thước để Workflow biết lớp glow còn khớp canvas chính không. */
function computeBlackHoleGlowKey(canvasWidth, canvasHeight, dpr) {
    return `${canvasWidth}x${canvasHeight}@${dpr}`;
}

/** Xoá lớp near + đặt transform thu nhỏ (toạ độ vẽ vẫn là px thiết bị của canvas chính). */
function beginBlackHoleGlowPass(layers) {
    const n = layers.near;
    n.ctx.setTransform(1, 0, 0, 1, 0, 0);
    n.ctx.clearRect(0, 0, n.canvas.width, n.canvas.height);
    n.ctx.setTransform(n.scale, 0, 0, n.scale, 0, 0);
}

/** near -> thu tiếp vào far, rồi phóng cả 2 lên canvas chính (far loang trước, near sát sau) với độ mạnh `alpha`. */
function paintBlackHoleGlowLayers(ctx, layers, canvasWidth, canvasHeight, alpha) {
    const f = layers.far;
    f.ctx.setTransform(1, 0, 0, 1, 0, 0);
    f.ctx.clearRect(0, 0, f.canvas.width, f.canvas.height);
    f.ctx.imageSmoothingEnabled = true;
    f.ctx.drawImage(layers.near.canvas, 0, 0, f.canvas.width, f.canvas.height);
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = Math.min(1, alpha);
    ctx.drawImage(f.canvas, 0, 0, canvasWidth, canvasHeight);
    ctx.globalAlpha = Math.min(1, alpha * 0.8);
    ctx.drawImage(layers.near.canvas, 0, 0, canvasWidth, canvasHeight);
    ctx.restore();
}

// ===================== flare + tâm =====================

/** Quầng bùng sáng khi nhạc dồn — `rgb` = "r, g, b" (Color mode, Workflow resolve), mờ dần về chính màu đó alpha 0. */
function paintBlackHoleFlare(ctx, canvasWidth, canvasHeight, centerX, centerY, currentRadius, rgb, flareAlpha) {
    const grad = ctx.createRadialGradient(centerX, centerY, currentRadius, centerX, centerY, currentRadius * 4);
    grad.addColorStop(0, `rgba(${rgb}, ${Math.min(1, flareAlpha * 0.3)})`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

/** Tâm hố đen — đĩa đen tuyệt đối (không theo màu nền tuỳ chỉnh). */
function paintBlackHoleCore(ctx, centerX, centerY, currentRadius) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(0.1, currentRadius), 0, 2 * Math.PI);
    ctx.fillStyle = '#000000';
    ctx.fill();
}

// ===================== tia bức xạ Hawking =====================
// MỚI (29/09/2026, Giang — thay "sóng xung kích"): beat mạnh -> tia chớp NGANG, dày, mờ, phóng từ 2 bên hố đen ra mép
// màn hình, nằm SAU vòng cột. Gợi hình minh hoạ bức xạ Hawking: dải sáng nhiệt mềm toả ra từ chân trời sự kiện + hạt
// thoát ra ngoài; lõi là tia chớp gấp khúc có nhánh, đổi hình liên tục (nhấp nháy).

const BLACK_HOLE_BURST_MAX = 3;          // số tia tồn tại cùng lúc
const BLACK_HOLE_BURST_LIFE_MS = 700;    // tuổi thọ 1 tia
const BLACK_HOLE_BURST_GROW_MS = 160;    // thời gian phóng từ viền ra tới mép
const BLACK_HOLE_BOLT_REFRESH_MS = 45;   // đổi hình tia chớp (nhấp nháy)
const BLACK_HOLE_BOLT_SEGMENTS = 14;
const BLACK_HOLE_BURST_PARTICLES = 6;    // hạt thoát mỗi bên
const BLACK_HOLE_BURST_MIN_BEAT = 0.2;   // beat quá nhỏ (đoạn nhạc rất nhẹ) không bắn
const BLACK_HOLE_BURST_BEAT_RATIO = 1.03; // beat phải mạnh hơn mức beat trung bình gần đây ≥ 3%
const BLACK_HOLE_BURST_AVG_ALPHA = 0.2;   // EMA mức bass tại các beat (theo từng BEAT, không theo frame)

/** Beat MỚI (Workflow đã xác nhận) có đủ "mạnh" để bắn tia không: bass lúc beat vượt ngưỡng tối thiểu VÀ vượt mức bass
 * trung bình của các beat gần đây (`beatAvg`) — tương đối nên bất biến độ to nhỏ bài hát (chỉ các beat nổi hơn mặt
 * bằng mới bắn). `beatAvg` = 0 (beat đầu tiên) -> bắn. */
function isBlackHoleBurstBeat(beatScale, beatAvg) {
    return beatScale >= BLACK_HOLE_BURST_MIN_BEAT && beatScale >= beatAvg * BLACK_HOLE_BURST_BEAT_RATIO;
}

/** Cập nhật mức bass trung bình tại các beat (EMA theo beat). Lần đầu (0) lấy luôn giá trị beat. */
function updateBlackHoleBeatAverage(beatAvg, beatScale) {
    return beatAvg > 0 ? beatAvg + (beatScale - beatAvg) * BLACK_HOLE_BURST_AVG_ALPHA : beatScale;
}

/** 1 tia mới. `strength` 0-1 (bass lúc beat) quyết định độ dày/độ sáng. Hạt thoát: vị trí đầu `t0` (tỉ lệ quãng đường),
 * tốc độ `v` (quãng đường đầy / tuổi thọ), lệch dọc `off` (đơn vị nửa bề dày). */
function createBlackHoleBurst(strength) {
    const particles = () => Array.from({ length: BLACK_HOLE_BURST_PARTICLES }, () => ({
        t0: Math.random() * 0.25, v: 0.9 + Math.random() * 0.9, off: (Math.random() - 0.5) * 1.4, size: 0.8 + Math.random() * 1.2,
    }));
    return { age: 0, life: BLACK_HOLE_BURST_LIFE_MS, strength: Math.max(0.3, Math.min(1, strength)), boltAge: 0, bolt: null, particles: { left: particles(), right: particles() } };
}

/** Tăng tuổi mọi tia theo dt, trả danh sách tia còn sống (mảng MỚI). */
function stepBlackHoleBursts(bursts, dtMs) {
    bursts.forEach((b) => { b.age += dtMs; b.boltAge += dtMs; });
    return bursts.filter((b) => b.age < b.life);
}

/** Tia chớp của tia này đã tới lúc đổi hình chưa (chưa có hoặc quá BLACK_HOLE_BOLT_REFRESH_MS). */
function isBlackHoleBoltStale(burst) {
    return burst.bolt === null || burst.boltAge >= BLACK_HOLE_BOLT_REFRESH_MS;
}

/** Dựng lại hình tia chớp (sửa tại chỗ `burst` vừa nhận — Rule 3b): mỗi bên 1 đường gấp khúc toạ độ CHUẨN HOÁ
 * {t: 0..1 dọc tia, off: -1..1 theo nửa bề dày} + 2 nhánh rẽ ngắn toả ra ngoài. */
function renewBlackHoleBolt(burst) {
    const side = () => {
        const pts = [{ t: 0, off: 0 }];
        let off = 0;
        for (let k = 1; k <= BLACK_HOLE_BOLT_SEGMENTS; k++) {
            off = Math.max(-1, Math.min(1, off + (Math.random() - 0.5) * 0.9));
            pts.push({ t: k === BLACK_HOLE_BOLT_SEGMENTS ? 1 : (k + (Math.random() - 0.5) * 0.6) / BLACK_HOLE_BOLT_SEGMENTS, off });
        }
        const forks = [0, 1].map(() => {
            const from = pts[2 + Math.floor(Math.random() * (BLACK_HOLE_BOLT_SEGMENTS - 5))];
            const dir = Math.random() < 0.5 ? -1 : 1;
            const fork = [{ t: from.t, off: from.off }];
            for (let k = 1; k <= 3; k++) {
                const last = fork[fork.length - 1];
                fork.push({ t: last.t + 0.03 + Math.random() * 0.04, off: last.off + dir * (0.3 + Math.random() * 0.5) });
            }
            return fork;
        });
        return { pts, forks };
    };
    burst.bolt = { left: side(), right: side() };
    burst.boltAge = 0;
}

/**
 * Vẽ 1 tia (2 bên) — chỉ Canvas API. `rgb` = "r, g, b" (Color mode). Mỗi bên: (1) dải nhiệt mềm hình thoi (dày ở viền,
 * nhọn ở đầu) tô gradient ngang-thân mờ 2 mép, (2) tia chớp gấp khúc + nhánh vẽ 3 lớp nét (quầng rộng mờ -> lõi mảnh
 * sáng), (3) hạt thoát bay dọc tia. Độ dài phóng ra theo tuổi (ease-out), độ sáng tắt dần + nhấp nháy nhẹ. Hoà trộn
 * 'lighter' (cộng sáng) trong save/restore.
 */
function paintBlackHoleBurst(ctx, burst, centerX, centerY, radius, canvasWidth, dpr, rgb) {
    const life01 = burst.age / burst.life;
    const grow = 1 - Math.pow(1 - Math.min(1, burst.age / BLACK_HOLE_BURST_GROW_MS), 3);
    const alpha = burst.strength * Math.pow(1 - life01, 1.5) * (0.85 + Math.random() * 0.15);
    const halfT = (18 + 34 * burst.strength) * dpr;
    const startInset = radius * 0.9;
    const fullReach = canvasWidth / 2 - startInset + 20 * dpr;
    const reach = fullReach * grow;
    const col = (a) => `rgba(${rgb}, ${Math.max(0, Math.min(1, a))})`;
    const drawSide = (dir, bolt, particles) => {
        const x0 = centerX + dir * startInset;
        const px = (t) => x0 + dir * t * reach;
        const py = (off) => centerY + off * halfT * 0.4;
        // (1) dải nhiệt mềm — 2 lớp (rộng mờ + hẹp đậm)
        [[1, 0.55], [0.45, 0.85]].forEach(([w, a]) => {
            const h = halfT * w;
            const grad = ctx.createLinearGradient(0, centerY - h, 0, centerY + h);
            grad.addColorStop(0, col(0));
            grad.addColorStop(0.5, col(alpha * a));
            grad.addColorStop(1, col(0));
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(x0, centerY - h);
            ctx.quadraticCurveTo(x0 + dir * reach * 0.55, centerY - h * 0.8, px(1), centerY);
            ctx.quadraticCurveTo(x0 + dir * reach * 0.55, centerY + h * 0.8, x0, centerY + h);
            ctx.closePath();
            ctx.fill();
        });
        // (2) tia chớp + nhánh — quầng rộng -> lõi mảnh
        const stroke = (pts) => {
            ctx.beginPath();
            pts.forEach((p, k) => (k === 0 ? ctx.moveTo(px(p.t), py(p.off)) : ctx.lineTo(px(p.t), py(p.off))));
            ctx.stroke();
        };
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        [[halfT * 0.35, 0.3], [3 * dpr, 0.6], [1.3 * dpr, 1]].forEach(([width, a]) => {
            ctx.lineWidth = width;
            ctx.strokeStyle = col(alpha * a);
            stroke(bolt.pts);
            ctx.lineWidth = width * 0.6;
            bolt.forks.forEach(stroke);
        });
        // (3) hạt thoát
        ctx.fillStyle = col(alpha);
        particles.forEach((p) => {
            const t = p.t0 + p.v * life01;
            if (t > 1.1) return;
            ctx.beginPath();
            ctx.arc(x0 + dir * t * fullReach, centerY + p.off * halfT, p.size * 1.5 * dpr, 0, Math.PI * 2);
            ctx.fill();
        });
    };
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // cộng sáng như nguồn phát xạ (chồng lên sao/flare sáng hơn, không che)
    drawSide(-1, burst.bolt.left, burst.particles.left);
    drawSide(1, burst.bolt.right, burst.particles.right);
    ctx.restore();
}
