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
 * SỬA (26/09/2026, Giang, lượt 2):
 *   - Màu: mọi phần giờ đọc đúng {fill, glow} của getComputedColor() (trước đây truyền nguyên object vào
 *     fillStyle -> canvas bỏ qua, color mode không ăn). Có phát sáng theo khối Blur (glowPx) của Custom Effect.
 *   - Kim giây chạy trơn (bỏ kiểu nhảy nấc). Chế độ 'track' làm mượt currentTime (smoothClockMediaTime()).
 *   - Bánh răng xếp trên 1 vòng sát mép, chỉ cặp ăn khớp chạm nhau; kính phủ kín mặt số (paintClockGlass/
 *     paintClockGlassGlare); vỏ ẩn được (toggle); con lắc (toggle) — đồng hồ trượt lên, dây dài dần ra.
 *   - Kim thêm 2 chế độ 'past'/'future': chạy thuận/ngược theo bậc nốt 1-7, bậc 4 = kẹt (rung tại chỗ,
 *     bánh răng khựng) — advanceClockPitchHands()/computeClockJamJitter().
 *   - Mọi hàm vẽ nhận gốc toạ độ = TÂM mặt số (Workflow translate + scale — scale dùng khi có con lắc).
 *
 * THUẦN, không side-effect, không đọc appState/getActiveEffectConfig, không gọi hàm tự viết khác (Rule
 * 1/2/3) — Workflow `_tickClock()` (event/workflow/visualizer-render.js) gom state, cache hình học, resolve
 * màu qua getComputedColor() rồi gọi RIÊNG LẺ từng hàm dưới đây.
 *
 * NẠP SAU: core/visualizer/groups/shape/common.js (chỉ để thứ tự đọc nhất quán).
 */

/** Chuỗi bánh răng (đơn vị = bán kính mặt số, gốc toạ độ = TÂM mặt số — Workflow translate/scale canvas).
 * SỬA (26/09/2026, Giang báo "bánh răng đang chạm vào nhau, cần lùi ra sát mép") — bố cục cũ xếp bánh quanh
 * tâm theo hướng tự do nên các bánh KHÔNG ăn khớp đè lên nhau. Nay mọi bánh nằm trên 1 VÒNG SÁT MÉP: đỉnh răng
 * mỗi bánh chạm đúng vòng `CLOCK_GEAR_RIM`, tâm bánh con tính bằng định lý cos từ tâm bánh cha (khoảng cách tâm
 * = luật ăn khớp) -> chỉ các cặp ăn khớp chạm nhau, tâm mặt số để trống cho 3 kim. Bánh gốc (hộp cót) đặt ở
 * `CLOCK_GEAR_ROOT_DEG`, 2 nhánh toả 2 chiều quanh vòng: `side` +1 = theo chiều kim đồng hồ (trên canvas),
 * -1 = ngược lại. `band` = [bin đầu, bin cuối] FFT 256. `spokes` = số nan (0 = đặc), `spiral` = dây cót.
 * Đã kiểm số: với module/số răng dưới đây không cặp KHÔNG ăn khớp nào chạm nhau (kể cả bánh lắc). */
const CLOCK_GEAR_MODULE = 0.016;
const CLOCK_GEAR_RIM = 0.95;       // đỉnh răng ngoài cùng (× bán kính mặt số)
const CLOCK_GEAR_ROOT_DEG = 165;   // hướng hộp cót (0 = 3 giờ, chiều kim đồng hồ)
const CLOCK_GEAR_TRAIN = [
    { key: 'barrel', z: 40, parent: -1, side: 0, band: [1, 3], spokes: 0, spiral: true },
    { key: 'center', z: 32, parent: 0, side: 1, band: [4, 10], spokes: 4 },
    { key: 'third', z: 26, parent: 1, side: 1, band: [10, 20], spokes: 5 },
    { key: 'fourth', z: 22, parent: 2, side: 1, band: [20, 35], spokes: 4 },
    { key: 'escape', z: 15, parent: 3, side: 1, band: [35, 60], spokes: 0, ratchet: true },
    { key: 'idler', z: 20, parent: 0, side: -1, band: [3, 6], spokes: 3 },
    { key: 'minute', z: 28, parent: 5, side: -1, band: [2, 5], spokes: 3 },
    { key: 'keyless', z: 18, parent: 6, side: -1, band: [15, 25], spokes: 0 },
    { key: 'crown', z: 14, parent: 7, side: -1, band: [25, 40], spokes: 0 },
    { key: 'ratchetWheel', z: 24, parent: 8, side: -1, band: [12, 18], spokes: 6 }, // lấp cung 3 giờ (tới gần bánh lắc)
];
/** Bánh lắc (không ăn khớp — dao động), đặt sát mép ngay SAU bánh thoát theo chiều kim đồng hồ, cách vành
 * bánh thoát `gap` (chỗ cho càng hãm). */
const CLOCK_BALANCE = { r: 0.16, gap: 0.05, band: [6, 14] };

/** Hình học chuỗi bánh răng theo pixel, gốc = tâm mặt số — Workflow cache theo dialR.
 * @returns {{gears:{x,y,r,m,z,parent,joint,band,spokes,spiral,ratchet}[], balance:{x,y,r,band}}} */
function computeClockGearLayout(dialR) {
    const m = CLOCK_GEAR_MODULE * dialR;
    const rim = CLOCK_GEAR_RIM * dialR;
    // Góc lệch (rad) giữa tâm A (vòng rA) và tâm B (vòng rB) để 2 tâm cách nhau đúng d — định lý cos (closure nội bộ).
    const ringStep = (rA, rB, d) => Math.acos(Math.max(-1, Math.min(1, (rA * rA + rB * rB - d * d) / (2 * rA * rB))));
    const gears = [];
    CLOCK_GEAR_TRAIN.forEach((g) => {
        const r = (m * g.z) / 2;
        const ringR = rim - r - m; // đỉnh răng chạm vòng rim
        let th = (CLOCK_GEAR_ROOT_DEG * Math.PI) / 180;
        let joint = 0;
        if (g.parent >= 0) {
            const p = gears[g.parent];
            const d = p.r + r + m * 0.15; // = m × (z1 + z2) / 2 + khe hở nhỏ (răng hình thang, không phải involute)
            th = p.th + g.side * ringStep(p.ringR, ringR, d);
        }
        const x = Math.cos(th) * ringR, y = Math.sin(th) * ringR;
        if (g.parent >= 0) joint = Math.atan2(y - gears[g.parent].y, x - gears[g.parent].x);
        gears.push({ x, y, r, m, z: g.z, th, ringR, parent: g.parent, joint, band: g.band, spokes: g.spokes, spiral: !!g.spiral, ratchet: !!g.ratchet });
    });
    const esc = gears.find((g) => g.ratchet);
    const balR = CLOCK_BALANCE.r * dialR;
    const balRing = rim - balR - m;
    const balTh = esc.th + ringStep(esc.ringR, balRing, esc.r + m + balR + CLOCK_BALANCE.gap * dialR);
    return {
        gears,
        balance: { x: Math.cos(balTh) * balRing, y: Math.sin(balTh) * balRing, r: balR, band: CLOCK_BALANCE.band },
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
 * (φ = hướng cha->con). Bánh cha luôn khai báo trước con. @returns {Float64Array} */
function computeClockGearAngles(gears, masterAngle) {
    const angles = new Float64Array(gears.length); // Float64: góc chủ tích luỹ tới ~2000π, Float32 sẽ rung răng
    for (let i = 0; i < gears.length; i++) {
        const g = gears[i];
        if (g.parent < 0) { angles[i] = masterAngle; continue; }
        const p = gears[g.parent];
        angles[i] = -(p.z / g.z) * (angles[g.parent] - g.joint) + g.joint + Math.PI + Math.PI / g.z;
    }
    return angles;
}

/** 1 bước động cơ: góc bánh gốc + pha bánh lắc. Trả state MỚI (không sửa `prev`).
 * SỬA (26/09/2026) — thêm `direction` (hệ số có dấu: 1 = quay thuận như cũ, âm = quay ngược, 0 = đứng) và
 * `jam` 0-1 (kẹt — bánh lắc cũng khựng lại). Chế độ kim Past/Future truyền direction theo nốt (xem
 * advanceClockPitchHands()), 2 chế độ còn lại luôn truyền 1 / 0.
 * @param {{masterAngle:number, balancePhase:number}|null} prev
 * @param {number} dtMs @param {number} beatScale - bass 0-1 khung này @param {number} smoothedEnergy - EMA 0-1
 * @param {number} speedBase @param {number} speedEnergyMult - rad/s */
function advanceClockDrive(prev, dtMs, isPlaying, beatScale, smoothedEnergy, speedBase, speedEnergyMult, direction, jam) {
    const state = prev || { masterAngle: 0, balancePhase: 0 };
    const dt = dtMs / 1000;
    const energy = isPlaying ? smoothedEnergy : 0;
    const kick = isPlaying ? Math.max(0, beatScale - smoothedEnergy) * 8 : 0; // bass bật lên -> giật (nhả răng)
    const omega = (speedBase + speedEnergyMult * energy + kick) * direction;
    return {
        masterAngle: (state.masterAngle + omega * dt) % (Math.PI * 2000),
        balancePhase: (state.balancePhase + dt * Math.PI * 2 * (2.5 + energy * 2) * (1 - jam)) % (Math.PI * 2),
    };
}

/** Góc 3 kim (rad, 0 = 12 giờ, chiều kim đồng hồ) từ tổng số giây (số thực, âm được — tự quy về 12 giờ).
 * SỬA (26/09/2026, Giang: "kim giây chạy mượt thay vì nẩy từng nấc") — bỏ hẳn kiểu nhảy nấc, cả 3 kim luôn
 * chạy trơn theo phần lẻ của giây. */
function computeClockHandAngles(totalSec) {
    const T = ((totalSec % 43200) + 43200) % 43200;
    const TAU = Math.PI * 2;
    return { hour: (T / 43200) * TAU, minute: ((T % 3600) / 3600) * TAU, second: ((T % 60) / 60) * TAU };
}

/** Thời gian bài làm mượt cho kim (chế độ 'track'): `media.currentTime` trên một số trình duyệt chỉ cập nhật
 * theo nhịp thưa -> kim giây giật. Giữa 2 lần currentTime đổi, ngoại suy theo đồng hồ thật × playbackRate
 * (tối đa 0.5s); giá trị mới lùi NHẸ (< 0.25s, do ngoại suy vượt) thì giữ nguyên chỗ đang hiện để kim không
 * giật lùi — seek thật (lệch lớn) nhảy ngay. Trả state MỚI {raw, at, base, t}. */
function smoothClockMediaTime(prev, rawSec, nowMs, isPlaying, rate) {
    if (!prev || !isPlaying) return { raw: rawSec, at: nowMs, base: rawSec, t: rawSec };
    if (rawSec !== prev.raw) {
        const back = prev.t - rawSec;
        const base = back > 0 && back < 0.25 ? prev.t : rawSec;
        return { raw: rawSec, at: nowMs, base, t: base };
    }
    const t = prev.base + Math.min(0.5, (nowMs - prev.at) / 1000) * (rate || 1);
    return { raw: rawSec, at: prev.at, base: prev.base, t: Math.max(prev.t, t) };
}

/** Nốt MIDI -> bậc 1-7 (C D E F G A B; nốt thăng gộp về bậc tự nhiên bên dưới). null -> 0. */
const CLOCK_DEGREE_OF_PC = [1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6, 7];
/** Tốc độ kim chế độ Past/Future (giây ảo / giây thật) theo |bậc - 4| = 0..3, nội suy tuyến tính. Chiều
 * "ưu tiên" (Past = lùi, Future = tiến) chạy nhanh, chiều ngược lại chạy chậm. */
const CLOCK_PITCH_RATE_FAVORED = [0, 20, 90, 300];
const CLOCK_PITCH_RATE_OTHER = [0, 5, 20, 60];
const CLOCK_PITCH_CHASE_MS = 180;   // hằng thời gian bám theo nốt mới
const CLOCK_PITCH_RELEASE_MS = 600; // mất nốt -> chậm dần về đứng
const CLOCK_JAM_IN_MS = 90, CLOCK_JAM_OUT_MS = 250;

/** MỚI (26/09/2026, Giang) — kim chế độ 'past'/'future' chạy theo nốt: bậc < 4 chạy NGƯỢC, > 4 chạy THUẬN
 * (càng xa bậc 4 càng nhanh), bậc 4 = KẸT (kim đứng tại chỗ rung lắc, bánh răng khựng). Mức `level`
 * (= bậc - 4, -3..3) và độ kẹt `jam` (0-1) đều làm mượt (EMA theo dt thật) nên đổi chiều/tốc độ không giật.
 * Không có nốt / không phát -> chậm dần rồi đứng. `favorSign` -1 (past) | +1 (future). `startSec` = giờ ảo
 * khởi đầu khi `prev` null. Trả state MỚI {virtualSec, level, jam}. */
function advanceClockPitchHands(prev, dtMs, isPlaying, midiNote, noteFresh, favorSign, startSec) {
    const state = prev || { virtualSec: startSec, level: 0, jam: 0 };
    const hasNote = isPlaying && noteFresh && midiNote !== null && midiNote !== undefined;
    const degree = hasNote ? CLOCK_DEGREE_OF_PC[((Math.round(midiNote) % 12) + 12) % 12] : 0;
    const targetLevel = hasNote ? degree - 4 : 0;
    const targetJam = hasNote && degree === 4 ? 1 : 0;
    const kLevel = 1 - Math.exp(-dtMs / (hasNote ? CLOCK_PITCH_CHASE_MS : CLOCK_PITCH_RELEASE_MS));
    const kJam = 1 - Math.exp(-dtMs / (targetJam > state.jam ? CLOCK_JAM_IN_MS : CLOCK_JAM_OUT_MS));
    const level = state.level + (targetLevel - state.level) * kLevel;
    const jam = state.jam + (targetJam - state.jam) * kJam;
    const mag = Math.min(3, Math.abs(level));
    const table = Math.sign(level) === favorSign ? CLOCK_PITCH_RATE_FAVORED : CLOCK_PITCH_RATE_OTHER;
    const i0 = Math.floor(mag), i1 = Math.min(3, i0 + 1);
    const rate = (table[i0] + (table[i1] - table[i0]) * (mag - i0)) * Math.sign(level);
    return { virtualSec: state.virtualSec + rate * (dtMs / 1000), level, jam };
}

/** Độ rung lắc lúc kẹt (rad) cho 3 kim + bánh răng — tổng 2 sin tần số lệch nhau (trông như giật cục), biên
 * độ × jam. `tMs` = đồng hồ thật. */
function computeClockJamJitter(jam, tMs) {
    if (jam < 0.001) return { hour: 0, minute: 0, second: 0, gear: 0 };
    const t = tMs / 1000;
    const shake = (f1, f2, p) => Math.sin(t * f1 + p) * 0.65 + Math.sin(t * f2 + p * 1.7) * 0.35;
    return {
        hour: jam * 0.03 * shake(47, 83, 0.3),
        minute: jam * 0.035 * shake(53, 91, 1.1),
        second: jam * 0.05 * shake(61, 97, 2.2),
        gear: jam * 0.03 * shake(57, 89, 0.7),
    };
}

/** MỚI (26/09/2026, Giang) — con lắc: `progress` 0-1 chạy tuyến tính về đích (bật = 1, tắt = 0) trong
 * `CLOCK_PENDULUM_ANIM_MS`; pha dao động chu kỳ cố định; biên độ bám năng lượng (EMA). Trả state MỚI. */
const CLOCK_PENDULUM_ANIM_MS = 1400;
const CLOCK_PENDULUM_PERIOD_S = 1.6;
function advanceClockPendulum(prev, dtMs, enabled, isPlaying, smoothedEnergy, jam) {
    const state = prev || { progress: 0, phase: 0, amp: 0.12 };
    const step = dtMs / CLOCK_PENDULUM_ANIM_MS;
    const progress = enabled ? Math.min(1, state.progress + step) : Math.max(0, state.progress - step);
    const targetAmp = (0.12 + (isPlaying ? smoothedEnergy : 0) * 0.3) * (1 - 0.85 * jam);
    const amp = state.amp + (targetAmp - state.amp) * (1 - Math.exp(-dtMs / 700));
    const phase = (state.phase + (dtMs / 1000) * ((Math.PI * 2) / CLOCK_PENDULUM_PERIOD_S)) % (Math.PI * 2);
    return { progress, phase, amp };
}

/** Bố cục khi có con lắc (theo `progress`): nửa đầu đồng hồ trượt lên, nửa sau dây dài dần ra (easeInOutCubic,
 * 2 đoạn gối nhau). Tắt thì chạy ngược (dây thu vào trước rồi đồng hồ hạ xuống). Cả cụm đồng hồ + con lắc
 * được căn giữa theo chiều dọc; màn không đủ cao (ngang) thì thu nhỏ cả cụm (`scale`).
 * @returns {{cy:number, scale:number, pivotY:number, length:number, bobR:number, reveal:number}} — pivotY/
 *   length/bobR theo đơn vị pixel CỤC BỘ (trước scale, gốc = tâm mặt số). */
function computeClockPendulumLayout(canvasH, dialR, progress, caseVisible) {
    const ease = (x) => { const t = Math.max(0, Math.min(1, x)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    const shiftE = ease(progress / 0.55);
    const lenE = ease((progress - 0.35) / 0.65);
    const caseR = dialR * (caseVisible ? 1.08 : 1.0);
    const fullLen = dialR * 1.3, bobR = dialR * 0.15;
    const tail = fullLen + bobR * 2;
    const fitScale = Math.min(1, (canvasH * 0.92) / (caseR * 2 + tail));
    const scale = 1 + (fitScale - 1) * shiftE;
    return {
        cy: canvasH / 2 - shiftE * (tail / 2) * scale,
        scale,
        pivotY: caseR,
        length: fullLen * lenE,
        bobR,
        reveal: lenE,
    };
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
 * làm vành ngoài dày lên nhẹ. SỬA (26/09/2026) — nhận màu color mode (`color` = fill, `glowColor`) + phát sáng
 * `glowPx` (0 = tắt, khối Blur của Custom Effect). Gốc toạ độ = tâm mặt số. Chỉ Canvas API. */
function paintClockCase(ctx, dialR, color, glowColor, glowPx, pulse, dpr) {
    const caseR = dialR * 1.08;
    // Núm vặn (crown) — vẽ trước để vành vỏ đè lên chân núm.
    const crownW = dialR * 0.1, crownH = dialR * 0.2;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(caseR - crownW * 0.2, -crownH / 2, crownW, crownH, crownW * 0.3);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, dpr);
    for (let i = 1; i < 5; i++) {
        const y = -crownH / 2 + (crownH * i) / 5;
        ctx.beginPath(); ctx.moveTo(caseR, y); ctx.lineTo(caseR + crownW * 0.75, y); ctx.stroke();
    }
    // Vành vỏ + vành mặt số.
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowPx;
    ctx.globalAlpha = 0.95;
    ctx.strokeStyle = color;
    ctx.lineWidth = dialR * (0.06 + pulse * 0.02);
    ctx.beginPath(); ctx.arc(0, 0, caseR, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, dpr * 1.2);
    ctx.beginPath(); ctx.arc(0, 0, dialR * 1.01, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
}

/** MỚI (26/09/2026, Giang "phủ kính kín bánh răng") — lớp kính phủ kín cả mặt số, vẽ NGAY SAU bánh răng/bánh
 * lắc (trước vạch/kim): phủ 1 lớp màu nhạt theo color mode + tối dần ra mép (độ dày kính) + 1 vệt loá mờ.
 * Gốc = tâm mặt số. Chỉ Canvas API. */
function paintClockGlass(ctx, dialR, tintColor) {
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, dialR * 1.01, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = tintColor;
    ctx.fillRect(-dialR * 1.05, -dialR * 1.05, dialR * 2.1, dialR * 2.1);
    ctx.globalAlpha = 1;
    const depth = ctx.createRadialGradient(0, 0, dialR * 0.35, 0, 0, dialR * 1.01);
    depth.addColorStop(0, 'rgba(255,255,255,0.05)');
    depth.addColorStop(0.8, 'rgba(255,255,255,0.03)');
    depth.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = depth;
    ctx.fillRect(-dialR * 1.05, -dialR * 1.05, dialR * 2.1, dialR * 2.1);
    ctx.restore();
}

/** Vệt loá của kính — vẽ SAU CÙNG (đè cả kim, đúng như mặt kính thật): 1 dải sáng chéo góc trên-trái + viền
 * sáng mảnh ở mép trên. Chỉ Canvas API. */
function paintClockGlassGlare(ctx, dialR, dpr) {
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, dialR * 1.01, 0, Math.PI * 2); ctx.clip();
    ctx.rotate(-Math.PI / 4);
    const glare = ctx.createLinearGradient(0, -dialR, 0, -dialR * 0.1);
    glare.addColorStop(0, 'rgba(255,255,255,0.20)');
    glare.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glare;
    ctx.beginPath(); ctx.ellipse(0, -dialR * 0.55, dialR * 0.95, dialR * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath(); ctx.arc(0, 0, dialR * 0.97, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke();
    ctx.globalAlpha = 1;
}

/** 60 vạch phút (phổ tròn) — vạch giờ (mỗi 5 vạch) dày + dài hơn. `colors[i]` = {fill, glow} (getComputedColor)
 * ứng vạch i; `glowPx` > 0 thì phát sáng theo glow. Gốc = tâm mặt số. Chỉ Canvas API. */
function paintClockTicks(ctx, dialR, levels, colors, glowPx, dpr) {
    ctx.lineCap = 'round';
    ctx.shadowBlur = glowPx;
    for (let i = 0; i < 60; i++) {
        const isHour = i % 5 === 0;
        const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const baseLen = dialR * (isHour ? 0.09 : 0.04);
        const len = baseLen + dialR * 0.08 * levels[i];
        const r0 = dialR * 0.97, r1 = r0 - len;
        ctx.globalAlpha = 0.45 + 0.55 * levels[i];
        ctx.strokeStyle = colors[i].fill;
        if (glowPx > 0) ctx.shadowColor = colors[i].glow;
        ctx.lineWidth = dpr * (isHour ? 3 : 1.4);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
}

/** 1 bánh răng lộ máy: viền răng (outline) + vành trong + nan hoa (hoặc đặc / dây cót) + trục + chân kính đỏ.
 * `level` 0-1 làm sáng thân bánh; `glowPx` > 0 -> viền răng phát sáng màu `glowColor`. Chỉ Canvas API. */
function paintClockGear(ctx, gear, outline, angle, color, glowColor, glowPx, level, dpr) {
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
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowPx * (0.5 + level);
    ctx.stroke();
    ctx.shadowBlur = 0;

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
function paintClockBalance(ctx, balance, escapeGear, swing, color, glowColor, glowPx, level, dpr) {
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
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowPx * (0.5 + level);
    ctx.beginPath(); ctx.arc(0, 0, balance.r, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
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
    ctx.strokeStyle = color;
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

/** MỚI (26/09/2026, Giang) — con lắc treo dưới đáy đồng hồ: móc treo + dây (cứng, dài `length`) + quả lắc tròn
 * (vành + vòng trong + chân kính). `swing` rad (0 = thẳng đứng), `reveal` 0-1 làm quả lắc hiện dần theo dây.
 * Vẽ TRƯỚC thân đồng hồ để đầu dây chui dưới vỏ. Gốc = tâm mặt số. Chỉ Canvas API. */
function paintClockPendulum(ctx, pivotY, length, bobR, swing, reveal, color, glowColor, glowPx, dpr) {
    if (reveal <= 0.001) return;
    const alpha = Math.min(1, reveal * 4);
    const ex = Math.sin(swing) * length, ey = pivotY + Math.cos(swing) * length;
    const bx = ex + Math.sin(swing) * bobR, by = ey + Math.cos(swing) * bobR;
    const r = bobR * (0.35 + 0.65 * reveal);
    // Móc treo.
    ctx.globalAlpha = 0.9 * alpha;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, pivotY, Math.max(3 * dpr, bobR * 0.14), 0, Math.PI * 2); ctx.fill();
    // Dây.
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, dpr * 2);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, pivotY); ctx.lineTo(ex, ey); ctx.stroke();
    // Quả lắc.
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = glowPx;
    ctx.globalAlpha = 0.3 * alpha;
    ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.95 * alpha;
    ctx.lineWidth = Math.max(1.5, r * 0.14);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.globalAlpha = 0.6 * alpha;
    ctx.beginPath(); ctx.arc(bx, by, r * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.9 * alpha;
    ctx.fillStyle = '#c0183a';
    ctx.beginPath(); ctx.arc(bx, by, Math.max(2 * dpr, r * 0.14), 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
}

/** 3 kim (giờ ngắn-dày, phút dài, giây mảnh có đuôi đối trọng) + nắp tâm. Viền tối để nổi trên bánh răng;
 * `glowPx` > 0 -> thân kim phát sáng (kim giây theo màu accent của nó). Gốc = tâm mặt số. Chỉ Canvas API. */
function paintClockHands(ctx, dialR, angles, color, glowColor, accentColor, glowPx, dpr) {
    const drawHand = (angle, len, tail, width, fill, glow) => {
        const a = angle - Math.PI / 2;
        const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
        ctx.beginPath();
        ctx.moveTo(-ux * tail + nx * width * 0.5, -uy * tail + ny * width * 0.5);
        ctx.lineTo(ux * len + nx * width * 0.18, uy * len + ny * width * 0.18);
        ctx.lineTo(ux * (len + width * 0.6), uy * (len + width * 0.6));
        ctx.lineTo(ux * len - nx * width * 0.18, uy * len - ny * width * 0.18);
        ctx.lineTo(-ux * tail - nx * width * 0.5, -uy * tail - ny * width * 0.5);
        ctx.closePath();
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = Math.max(2, dpr * 2.5);
        ctx.strokeStyle = '#000000';
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = fill;
        ctx.shadowColor = glow;
        ctx.shadowBlur = glowPx;
        ctx.fill();
        ctx.shadowBlur = 0;
    };
    drawHand(angles.hour, dialR * 0.5, dialR * 0.08, dialR * 0.07, color, glowColor);
    drawHand(angles.minute, dialR * 0.78, dialR * 0.1, dialR * 0.045, color, glowColor);
    drawHand(angles.second, dialR * 0.86, dialR * 0.2, dialR * 0.018, accentColor, accentColor);
    // Đối trọng đuôi kim giây + nắp tâm.
    const sa = angles.second - Math.PI / 2;
    ctx.fillStyle = accentColor;
    ctx.beginPath(); ctx.arc(-Math.cos(sa) * dialR * 0.14, -Math.sin(sa) * dialR * 0.14, dialR * 0.025, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, dialR * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#c0183a';
    ctx.beginPath(); ctx.arc(0, 0, dialR * 0.018, 0, Math.PI * 2); ctx.fill();
}
