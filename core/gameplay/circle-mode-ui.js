/**
 * core/gameplay/circle-mode-ui.js — vẽ canvas mode "Circle" (`#gameplay-canvas`): approach ring + target circle. Không đọc
 * appState, không gọi core khác.
 *
 * Mỗi frame 2 pass: approach ring (drawApproachRings) luôn trước target circle (drawTargetCircles) -> target của mọi note nổi
 * trên ring của mọi note. Trong mỗi pass `entries` đã được đảo ngược thứ tự spawn (partitionCircleWaveEntries(),
 * core/gameplay/circle-mode.js) — wave xuất hiện sớm hơn vẽ sau cùng (nằm trên), khớp thứ tự hit-test
 * (findTopmostNoteInTolerance(), core/gameplay/engine.js).
 */

/** Đặt kích thước bộ đệm canvas theo devicePixelRatio — gọi lại mỗi khi layer resize. Trả kích thước CSS px (không nhân
 * dpr) để Workflow tính lưới pitch→ô. */
function resizeGameplayCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const widthPx = canvas.clientWidth;
    const heightPx = canvas.clientHeight;
    canvas.width = widthPx * dpr;
    canvas.height = heightPx * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { widthPx, heightPx };
}

/** Xoá toàn bộ canvas — nền trong suốt (không fillRect), visualizer phía sau xuyên qua. Xoá theo bộ đệm thật (bỏ transform
 * dpr tạm thời) nên không cần biết kích thước CSS, kể cả canvas chưa từng resize. */
function clearGameplayCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

/** Pass 1 — approach ring (wave co dần): glow mờ, không viền cứng. `entries`: [{x,y,radius,opacity,colorLight}]. */
function drawApproachRings(canvas, entries) {
    const ctx = canvas.getContext('2d');
    for (const entry of entries) {
        ctx.save();
        ctx.globalAlpha = entry.opacity;
        ctx.beginPath();
        ctx.arc(entry.x, entry.y, entry.radius, 0, Math.PI * 2);
        ctx.fillStyle = entry.colorLight;
        ctx.shadowColor = entry.colorLight;
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.restore();
    }
}

/** Pass 2 — target circle cố định, vẽ sau (nổi trên) approach ring. `entries`: [{x,y,centerRadius,colorMain}]. */
function drawTargetCircles(canvas, entries) {
    const ctx = canvas.getContext('2d');
    for (const entry of entries) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(entry.x, entry.y, entry.centerRadius, 0, Math.PI * 2);
        ctx.fillStyle = entry.colorMain;
        ctx.shadowColor = entry.colorMain;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
    }
}
