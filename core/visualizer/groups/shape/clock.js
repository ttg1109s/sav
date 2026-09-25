/**
 * core/visualizer/groups/shape/clock.js — [MỚI 26/09/2026, Giang: "thêm shape clock — vẽ đồng hồ (không
 * dây đeo), bên trong chứa các bánh răng, thêm cả 3 kim"]. Style thứ 2 của group "shape" (cạnh rubik).
 *
 * Tham khảo cấu tạo máy đồng hồ cơ lộ máy (skeleton) — chuỗi truyền động (going train):
 *   hộp cót (barrel) -> bánh giữa (center wheel, mang kim phút, 1 vòng/giờ) -> bánh thứ 3 -> bánh thứ 4
 *   (seconds wheel) -> bánh thoát (escape wheel, 15 răng) -> càng hãm (pallet fork) -> bánh lắc (balance)
 *   + dây tóc (hairspring). Chân kính đỏ (jewel) ở tâm mỗi trục. Luật ăn khớp bánh răng: cùng module,
 *   khoảng cách tâm = module × (z1 + z2) / 2, tỉ số tốc độ = -z1/z2 (đổi chiều ở mỗi cặp).
 *
 * Phản ứng âm thanh:
 *   - Cả chuỗi bánh răng quay theo 1 góc chủ (bánh giữa): tốc độ = base + năng lượng × hệ số + cú giật khi
 *     bass bật lên (beatScale vượt smoothedEnergy — giống bánh thoát "nhả" 1 răng).
 *   - Mỗi bánh răng gắn 1 dải tần (bánh lớn = trầm, bánh nhỏ = cao) -> màu (color mode) + độ sáng.
 *   - Bánh lắc dao động, biên độ theo năng lượng; càng hãm lắc theo.
 *   - Vòng 60 vạch phút = phổ tần hình tròn (vạch dài ra theo dải tần của nó); 12 vạch giờ luôn dày hơn.
 *   - Kim: giờ thật của máy (mặc định) hoặc thời gian đã phát của bài (kiểu bấm giờ).
 *
 * THUẦN, không side-effect, không đọc appState/getActiveEffectConfig, không gọi hàm tự viết khác (Rule
 * 1/2/3) — Workflow `_tickClock()` (event/workflow/visualizer-render.js) gom state, cache hình học, resolve
 * màu qua getComputedColor() rồi gọi RIÊNG LẺ từng hàm dưới đây.
 *
 * NẠP SAU: core/visualizer/groups/shape/common.js (chỉ để thứ tự đọc nhất quán).
 */

/** Chuỗi bánh răng (đơn vị = bán kính mặt số). `parent` = bánh ăn khớp phía trước (-1 = bánh gốc ở tâm),
 * `jointDeg` = hướng từ tâm bánh cha tới tâm bánh này (độ, chiều kim đồng hồ trên canvas, 0 = hướng 3 giờ).
 * `band` = [bin đầu, bin cuối] của FFT 256 (~187Hz/bin). `spokes` = số nan (0 = đặc), `spiral` = vẽ dây cót. */
const CLOCK_GEAR_MODULE = 0.011;
const CLOCK_GEAR_TRAIN = [
    { key: 'center', z: 36, parent: -1, jointDeg: 0, band: [4, 10], spokes: 4 },
    { key: 'barrel', z: 52, parent: 0, jointDeg: 150, band: [1, 3], spokes: 0, spiral: true },
    { key: 'third', z: 30, parent: 0, jointDeg: -20, band: [10, 20], spokes: 5 },
    { key: 'fourth', z: 24, parent: 2, jointDeg: -80, band: [20, 35], spokes: 4 },
    { key: 'escape', z: 15, parent: 3, jointDeg: -150, band: [35, 60], spokes: 0, ratchet: true },
    { key: 'idler', z: 20, parent: 1, jointDeg: 60, band: [3, 6], spokes: 3 },
    { key: 'keyless', z: 18, parent: 2, jointDeg: 40, band: [15, 25], spokes: 0 },
    { key: 'crown', z: 14, parent: 6, jointDeg: 10, band: [25, 40], spokes: 0 },     // bánh vặn (hướng núm 3 giờ)
    { key: 'minute', z: 22, parent: 5, jointDeg: -10, band: [2, 5], spokes: 3 },     // bánh phút (motion work, dưới phải)
];
/** Bánh lắc (không ăn khớp — dao động). Toạ độ theo đơn vị bán kính mặt số, trục y hướng xuống. */
const CLOCK_BALANCE = { x: -0.2, y: -0.58, r: 0.15, band: [6, 14] };

/** Hình học chuỗi bánh răng theo pixel — Workflow cache theo (cx, cy, dialR).
 * @returns {{gears:{x,y,r,m,z,parent,joint,band,spokes,spiral,ratchet}[], balance:{x,y,r,band}}} */
function computeClockGearLayout(cx, cy, dialR) {
    const m = CLOCK_GEAR_MODULE * dialR;
    const gears = [];
    CLOCK_GEAR_TRAIN.forEach((g) => {
        const r = (m * g.z) / 2;
        const joint = (g.jointDeg * Math.PI) / 180;
        let x = cx, y = cy;
        if (g.parent >= 0) {
            const p = gears[g.parent];
            const d = p.r + r + m * 0.15; // = m × (z1 + z2) / 2 + khe hở nhỏ (răng hình thang, không phải involute)
            x = p.x + d * Math.cos(joint);
            y = p.y + d * Math.sin(joint);
        }
        gears.push({ x, y, r, m, z: g.z, parent: g.parent, joint, band: g.band, spokes: g.spokes, spiral: !!g.spiral, ratchet: !!g.ratchet });
    });
    return {
        gears,
        balance: { x: cx + CLOCK_BALANCE.x * dialR, y: cy + CLOCK_BALANCE.y * dialR, r: CLOCK_BALANCE.r * dialR, band: CLOCK_BALANCE.band },
    };
}

/** Viền răng của 1 bánh (góc quay 0, gốc toạ độ = tâm bánh) — mảng [x0,y0,x1,y1,...]. Răng hình thang
 * (đỉnh = r + m, chân = r - 1.25m); `ratchet` = răng cưa nghiêng kiểu bánh thoát. Workflow cache. */
function buildClockGearOutline(z, pitchR, m, ratchet) {
    const tipR = pitchR + m, rootR = pitchR - 1.25 * m;
    const step = (Math.PI * 2) / z;
    const pts = [];
    for (let i = 0; i < z; i++) {
        const a = i * step;
        if (ratchet) {
            // Đỉnh răng đặt ĐÚNG góc a (như răng thường) để công thức ăn khớp computeClockGearAngles() đúng pha.
            pts.push(rootR * Math.cos(a - step * 0.2), rootR * Math.sin(a - step * 0.2));
            pts.push(tipR * Math.cos(a), tipR * Math.sin(a));
            pts.push(rootR * Math.cos(a + step * 0.15), rootR * Math.sin(a + step * 0.15));
        } else {
            const rootHalf = step * 0.28, tipHalf = step * 0.15;
            pts.push(rootR * Math.cos(a - rootHalf), rootR * Math.sin(a - rootHalf));
            pts.push(tipR * Math.cos(a - tipHalf), tipR * Math.sin(a - tipHalf));
            pts.push(tipR * Math.cos(a + tipHalf), tipR * Math.sin(a + tipHalf));
            pts.push(rootR * Math.cos(a + rootHalf), rootR * Math.sin(a + rootHalf));
        }
    }
    return pts;
}

/** Góc quay từng bánh từ góc bánh gốc — ăn khớp đúng răng-vào-khe: θcon = -(zcha/zcon)(θcha - φ) + φ + π + π/zcon
 * (φ = hướng cha->con). Bánh cha luôn khai báo trước con. @returns {Float32Array} */
function computeClockGearAngles(gears, masterAngle) {
    const angles = new Float32Array(gears.length);
    for (let i = 0; i < gears.length; i++) {
        const g = gears[i];
        if (g.parent < 0) { angles[i] = masterAngle; continue; }
        const p = gears[g.parent];
        angles[i] = -(p.z / g.z) * (angles[g.parent] - g.joint) + g.joint + Math.PI + Math.PI / g.z;
    }
    return angles;
}

/** 1 bước động cơ: góc bánh gốc + pha bánh lắc. Trả state MỚI (không sửa `prev`).
 * @param {{masterAngle:number, balancePhase:number}|null} prev
 * @param {number} dtMs @param {number} beatScale - bass 0-1 khung này @param {number} smoothedEnergy - EMA 0-1
 * @param {number} speedBase @param {number} speedEnergyMult - rad/s */
function advanceClockDrive(prev, dtMs, isPlaying, beatScale, smoothedEnergy, speedBase, speedEnergyMult) {
    const state = prev || { masterAngle: 0, balancePhase: 0 };
    const dt = dtMs / 1000;
    const energy = isPlaying ? smoothedEnergy : 0;
    const kick = isPlaying ? Math.max(0, beatScale - smoothedEnergy) * 8 : 0; // bass bật lên -> giật (nhả răng)
    const omega = speedBase + speedEnergyMult * energy + kick;
    return {
        masterAngle: (state.masterAngle + omega * dt) % (Math.PI * 2000),
        balancePhase: (state.balancePhase + dt * Math.PI * 2 * (2.5 + energy * 2)) % (Math.PI * 2),
    };
}

/** Góc 3 kim (rad, 0 = 12 giờ, chiều kim đồng hồ) từ giờ/phút/giây/ms. `secondTick` = kim giây nhảy nấc
 * (nảy nhẹ kiểu back-out trong 180ms đầu mỗi giây), ngược lại chạy trơn. */
function computeClockHandAngles(hours, minutes, seconds, ms, secondTick) {
    let secPos;
    if (secondTick) {
        const p = Math.min(1, ms / 180);
        const c1 = 1.70158, c3 = c1 + 1;
        const eased = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
        secPos = seconds - 1 + eased;
    } else {
        secPos = seconds + ms / 1000;
    }
    const minPos = minutes + (seconds + ms / 1000) / 60;
    const hourPos = (hours % 12) + minPos / 60;
    const TAU = Math.PI * 2;
    return { hour: (hourPos / 12) * TAU, minute: (minPos / 60) * TAU, second: (secPos / 60) * TAU };
}

/** Mức 60 vạch phút (phổ tròn) 0-1 — chia dải bin theo luỹ thừa (dày ở vùng trầm/trung), `gain` nhân độ nhạy.
 * Vạch 0 = 12 giờ, đi theo chiều kim đồng hồ. @returns {Float32Array} */
function computeClockSpectrumTicks(vizDataArray, binCount, isPlaying, gain) {
    const out = new Float32Array(60);
    if (!isPlaying) return out;
    const maxBin = Math.floor(binCount * 0.7);
    for (let i = 0; i < 60; i++) {
        const lo = 1 + Math.floor((maxBin - 1) * Math.pow(i / 60, 1.8));
        const hi = Math.max(lo, 1 + Math.floor((maxBin - 1) * Math.pow((i + 1) / 60, 1.8)) - 1);
        let v = 0;
        for (let b = lo; b <= hi; b++) if (vizDataArray[b] > v) v = vizDataArray[b];
        out[i] = Math.min(1, (v / 255) * gain);
    }
    return out;
}

/** Mức (byte 0-255, trung bình dải) của từng bánh răng + bánh lắc (phần tử cuối). @returns {Float32Array} */
function computeClockGearLevels(vizDataArray, layout, isPlaying) {
    const bands = layout.gears.map((g) => g.band).concat([layout.balance.band]);
    const out = new Float32Array(bands.length);
    if (!isPlaying) return out;
    bands.forEach((band, i) => {
        let sum = 0;
        for (let b = band[0]; b <= band[1]; b++) sum += vizDataArray[b] || 0;
        out[i] = sum / (band[1] - band[0] + 1);
    });
    return out;
}

/** Vỏ đồng hồ (không dây đeo): vành ngoài dày + vành trong mảnh + núm vặn ở hướng 3 giờ. `pulse` 0-1 (bass)
 * làm vành ngoài dày lên nhẹ. Chỉ Canvas API. */
function paintClockCase(ctx, cx, cy, dialR, color, pulse, dpr) {
    const caseR = dialR * 1.08;
    // Núm vặn (crown) — vẽ trước để vành vỏ đè lên chân núm.
    const crownW = dialR * 0.1, crownH = dialR * 0.2;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(cx + caseR - crownW * 0.2, cy - crownH / 2, crownW, crownH, crownW * 0.3);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, dpr);
    for (let i = 1; i < 5; i++) {
        const y = cy - crownH / 2 + (crownH * i) / 5;
        ctx.beginPath(); ctx.moveTo(cx + caseR, y); ctx.lineTo(cx + caseR + crownW * 0.75, y); ctx.stroke();
    }
    // Vành vỏ + vành mặt số.
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = color;
    ctx.lineWidth = dialR * (0.06 + pulse * 0.02);
    ctx.beginPath(); ctx.arc(cx, cy, caseR, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, dpr * 1.2);
    ctx.beginPath(); ctx.arc(cx, cy, dialR * 1.01, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
}

/** 60 vạch phút (phổ tròn) — vạch giờ (mỗi 5 vạch) dày + dài hơn. `colors[i]` ứng vạch i. Chỉ Canvas API. */
function paintClockTicks(ctx, cx, cy, dialR, levels, colors, dpr) {
    ctx.lineCap = 'round';
    for (let i = 0; i < 60; i++) {
        const isHour = i % 5 === 0;
        const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const baseLen = dialR * (isHour ? 0.09 : 0.04);
        const len = baseLen + dialR * 0.08 * levels[i];
        const r0 = dialR * 0.97, r1 = r0 - len;
        ctx.globalAlpha = 0.45 + 0.55 * levels[i];
        ctx.strokeStyle = colors[i];
        ctx.lineWidth = dpr * (isHour ? 3 : 1.4);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
}

/** 1 bánh răng lộ máy: viền răng (outline) + vành trong + nan hoa (hoặc đặc / dây cót) + trục + chân kính đỏ.
 * `level` 0-1 làm sáng thân bánh. Chỉ Canvas API. */
function paintClockGear(ctx, gear, outline, angle, color, level, dpr) {
    ctx.save();
    ctx.translate(gear.x, gear.y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(outline[0], outline[1]);
    for (let i = 2; i < outline.length; i += 2) ctx.lineTo(outline[i], outline[i + 1]);
    ctx.closePath();
    ctx.globalAlpha = 0.14 + 0.3 * level;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = 0.6 + 0.4 * level;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, dpr * 1.2);
    ctx.stroke();

    const rimR = gear.r - 2.4 * gear.m;
    const hubR = Math.max(gear.r * 0.16, 3 * dpr);
    if (gear.spokes > 0 && rimR > hubR * 1.5) {
        // Lộ máy: vành trong + nan hoa, phần giữa nan để trống (thấy xuyên qua).
        ctx.beginPath(); ctx.arc(0, 0, rimR, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = Math.max(1, gear.r * 0.07);
        for (let s = 0; s < gear.spokes; s++) {
            const a = (s / gear.spokes) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * hubR, Math.sin(a) * hubR);
            ctx.lineTo(Math.cos(a) * rimR, Math.sin(a) * rimR);
            ctx.stroke();
        }
    } else if (gear.spiral) {
        // Hộp cót: nắp đặc + dây cót xoắn (hé theo góc quay).
        ctx.globalAlpha = 0.18 + 0.25 * level;
        ctx.beginPath(); ctx.arc(0, 0, rimR, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.5 + 0.4 * level;
        ctx.lineWidth = Math.max(1, dpr);
        ctx.beginPath();
        const turns = 4.5, steps = 90;
        for (let k = 0; k <= steps; k++) {
            const t = k / steps;
            const a = t * turns * Math.PI * 2;
            const r = hubR + (rimR * 0.92 - hubR) * t;
            if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.stroke();
    }
    // Trục + chân kính (ruby).
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, hubR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0183a';
    ctx.beginPath(); ctx.arc(0, 0, hubR * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
}

/** Bánh lắc + dây tóc + càng hãm hướng về bánh thoát. `swing` = góc lệch hiện tại (rad), `level` 0-1.
 * Chỉ Canvas API. */
function paintClockBalance(ctx, balance, escapeGear, swing, color, level, dpr) {
    // Càng hãm (pallet fork): thanh từ tâm bánh lắc hướng về bánh thoát, lắc theo swing.
    const dir = Math.atan2(escapeGear.y - balance.y, escapeGear.x - balance.x);
    const forkLen = Math.hypot(escapeGear.x - balance.x, escapeGear.y - balance.y) - escapeGear.r;
    const forkA = dir + swing * 0.12;
    const fx = balance.x + Math.cos(forkA) * forkLen, fy = balance.y + Math.sin(forkA) * forkLen;
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, dpr * 2);
    ctx.beginPath(); ctx.moveTo(balance.x, balance.y); ctx.lineTo(fx, fy); ctx.stroke();
    const px = -Math.sin(forkA) * escapeGear.r * 0.35, py = Math.cos(forkA) * escapeGear.r * 0.35;
    ctx.beginPath(); ctx.moveTo(fx - px, fy - py); ctx.lineTo(fx + px, fy + py); ctx.stroke();
    ctx.fillStyle = '#c0183a';
    ctx.beginPath(); ctx.arc(fx - px, fy - py, 2 * dpr, 0, Math.PI * 2); ctx.arc(fx + px, fy + py, 2 * dpr, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(balance.x, balance.y);
    ctx.rotate(swing);
    ctx.globalAlpha = 0.6 + 0.4 * level;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, balance.r * 0.1);
    ctx.beginPath(); ctx.arc(0, 0, balance.r, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = Math.max(1, balance.r * 0.06);
    for (let s = 0; s < 3; s++) {
        const a = (s / 3) * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * balance.r, Math.sin(a) * balance.r); ctx.stroke();
    }
    // Vít cân bằng trên vành.
    ctx.fillStyle = color;
    for (let s = 0; s < 8; s++) {
        const a = (s / 8) * Math.PI * 2 + Math.PI / 8;
        ctx.beginPath(); ctx.arc(Math.cos(a) * balance.r, Math.sin(a) * balance.r, Math.max(1.5, balance.r * 0.06), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    // Dây tóc (hairspring): xoắn ốc, "thở" theo swing (không xoay cứng theo bánh).
    ctx.globalAlpha = 0.45 + 0.4 * level;
    ctx.lineWidth = Math.max(1, dpr * 0.8);
    ctx.beginPath();
    const turns = 5, steps = 110, inner = balance.r * 0.12, outer = balance.r * 0.72;
    for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const a = t * turns * Math.PI * 2 + swing * (1 - t);
        const r = inner + (outer - inner) * t;
        const x = balance.x + Math.cos(a) * r, y = balance.y + Math.sin(a) * r;
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#c0183a';
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(balance.x, balance.y, Math.max(2 * dpr, balance.r * 0.08), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
}

/** 3 kim (giờ ngắn-dày, phút dài, giây mảnh có đuôi đối trọng) + nắp tâm. Viền tối để nổi trên bánh răng.
 * Chỉ Canvas API. */
function paintClockHands(ctx, cx, cy, dialR, angles, color, accentColor, dpr) {
    const drawHand = (angle, len, tail, width, fill) => {
        const a = angle - Math.PI / 2;
        const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
        ctx.beginPath();
        ctx.moveTo(cx - ux * tail + nx * width * 0.5, cy - uy * tail + ny * width * 0.5);
        ctx.lineTo(cx + ux * len + nx * width * 0.18, cy + uy * len + ny * width * 0.18);
        ctx.lineTo(cx + ux * (len + width * 0.6), cy + uy * (len + width * 0.6));
        ctx.lineTo(cx + ux * len - nx * width * 0.18, cy + uy * len - ny * width * 0.18);
        ctx.lineTo(cx - ux * tail - nx * width * 0.5, cy - uy * tail - ny * width * 0.5);
        ctx.closePath();
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = Math.max(2, dpr * 2.5);
        ctx.strokeStyle = '#000000';
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = fill;
        ctx.fill();
    };
    drawHand(angles.hour, dialR * 0.5, dialR * 0.08, dialR * 0.07, color);
    drawHand(angles.minute, dialR * 0.78, dialR * 0.1, dialR * 0.045, color);
    drawHand(angles.second, dialR * 0.86, dialR * 0.2, dialR * 0.018, accentColor);
    // Đối trọng đuôi kim giây + nắp tâm.
    const sa = angles.second - Math.PI / 2;
    ctx.fillStyle = accentColor;
    ctx.beginPath(); ctx.arc(cx - Math.cos(sa) * dialR * 0.14, cy - Math.sin(sa) * dialR * 0.14, dialR * 0.025, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, dialR * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0183a';
    ctx.beginPath(); ctx.arc(cx, cy, dialR * 0.018, 0, Math.PI * 2); ctx.fill();
}
