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
 *   - Kim giây chạy trơn (bỏ kiểu nhảy nấc). Chế độ 'track' làm mượt currentTime (lượt 5 đã bỏ chế độ này).
 *   - (lượt 2, đã thay ở lượt 4) Bánh răng xếp trên 1 vòng sát mép; kính phủ kín mặt số (paintClockGlass/
 *     paintClockGlassGlare); vỏ ẩn được (toggle); con lắc (toggle) — đồng hồ trượt lên, dây dài dần ra.
 *   - Kim thêm chế độ theo nốt (lượt 2 tách 'past'/'future', lượt 4 gộp 'pastFuture'): chạy thuận/ngược theo bậc nốt 1-7, bậc 4 = kẹt (rung tại chỗ,
 *     bánh răng khựng) — advanceClockPitchHands()/computeClockJamJitter().
 *   - Mọi hàm vẽ nhận gốc toạ độ = TÂM mặt số (Workflow translate + scale — scale dùng khi có con lắc).
 *
 * SỬA (26/09/2026, lượt 4, Giang): bánh răng RỜI nhau phủ kín mặt số (CLOCK_GEAR_DISCS, bỏ chuỗi ăn khớp);
 * 'past'/'future' gộp 1 chế độ 'pastFuture' (2 chiều đối xứng, × BPM); lật quanh trục (advanceClockFlip() — lượt 9 đã bỏ);
 * vòng quét cỗ máy thời gian quay theo chiều kim.
 *
 * SỬA (26/09/2026, lượt 5, Giang): kim CHỈ còn cơ chế Past & Future (bỏ realtime/track + dropdown chọn — bỏ luôn
 * smoothClockMediaTime()); vòng quét lượt 4 (3 vòng HUD + tia quét) thay bằng 6 vòng quỹ đạo 3D
 * (advanceClockOrbitRings()/paintClockOrbitRings()) — quay theo chiều kim, lật hướng kiểu Rubik theo bậc nốt.
 *
 * SỬA (27/09/2026, lượt 7, Giang — vòng "Time scan"): bán kính vòng rộng hơn (1.2-1.7R, cụm vừa 96% cạnh ngắn
 * màn hình thay vì khung clockSizeRatio — computeClockOrbitFitScale()); vòng dày theo slider `clockRingWidth`
 * 6-18px; vòng KHÔNG khựng như kim (không đứng khi mất nốt/kẹt, không rung — tốc độ có sàn, chiều giữ nguyên
 * tới khi kim thật sự đổi chiều); không có audio (không phát): kim chạy thuận 1 giây / giây như đồng hồ thường,
 * vòng chạy đều theo chiều + hướng hiện tại.
 * SỬA (27/09/2026, lượt 7b, Giang) — sửa khái niệm vòng: "xoay thuận/nghịch" = CẢ VÒNG xoay (+/-) trong không gian
 * 3D quanh trục đi qua tâm đồng hồ (không phải vệt/dot chạy dọc vòng — bỏ hẳn vệt + hạt); "đổi hướng" = nốt đổi
 * TRỤC XOAY của vòng (kiểu Rubik, bậc 1-3 -> vòng 1-3, 5-7 -> 4-6). Xem advanceClockOrbitRings().
 * SỬA (27/09/2026, lượt 8, Giang) — còn 4 vòng, trục xoay CỐ ĐỊNH: thẳng / ngang / chéo trái / chéo phải (bỏ đổi trục
 * theo nốt); tốc độ xoay độc lập từng vòng (tốc độ nền + dải tần riêng); độ dày `clockRingWidth` 1-6px.
 * SỬA (27/09/2026, lượt 9, Giang) — vòng đồng màu (bỏ sáng/tối theo chiều sâu); thêm bán kính vòng (`clockRingRadius`,
 * % bán kính mặt số — lượt 9b: cả 4 vòng cùng bán kính) + nền đĩa trong vòng (`clockRingBgOpacity` 0-0.5);
 * BỎ hẳn cơ chế lật "Moving flip" của thân đồng hồ (advanceClockFlip() + toggle clockFlip).
 * SỬA (lượt 9b, Giang) — 4 vòng cùng 1 bán kính, chỉnh chung bằng `clockRingRadius` (CLOCK_ORBIT_RADII).
 *
 * THUẦN, không side-effect, không đọc appState/getActiveEffectConfig, không gọi hàm tự viết khác (Rule
 * 1/2/3) — Workflow `_tickClock()` (event/workflow/visualizer-render.js) gom state, cache hình học, resolve
 * màu qua getComputedColor() rồi gọi RIÊNG LẺ từng hàm dưới đây.
 *
 * NẠP SAU: core/visualizer/groups/shape/common.js (chỉ để thứ tự đọc nhất quán).
 */

/** Bánh răng phủ kín mặt số — SỬA (26/09/2026, lượt 4, Giang: "bánh răng vẫn đè lên nhau" + "thêm bánh răng
 * để phủ toàn bộ"). Bố cục chuỗi ăn khớp sát mép (lượt 2) bỏ hẳn: răng các cặp ăn khớp vẫn lồng vào nhau nên
 * nhìn như đè. Nay mọi bánh RỜI nhau (khe tối thiểu 0.03 giữa 2 đỉnh răng), phủ cả mặt số từ tâm ra mép.
 * `CLOCK_GEAR_DISCS` = [x, y, bán kính đỉnh răng] (đơn vị = bán kính mặt số, gốc = tâm, y hướng xuống) — đóng gói
 * SẴN offline bằng thuật toán "hình tròn trống lớn nhất" (greedy, trần 0.23 / sàn 0.065, giới hạn vành 0.95,
 * chừa chỗ bánh lắc), hardcode để không tốn tính toán lúc chạy. Phần tử 0 = bánh tâm (đồng trục kim).
 * Bánh không ăn khớp nhau nên mỗi bánh quay theo tỉ số riêng (24/z) với chiều NGƯỢC bánh gần nó nhất (như có
 * bánh con ẩn truyền động) — xem computeClockGearLayout(). */
const CLOCK_GEAR_MODULE = 0.013;
const CLOCK_GEAR_DISCS = [
    [0.000, 0.000, 0.200], [-0.716, -0.074, 0.230], [-0.590, 0.400, 0.230], [-0.500, -0.518, 0.230], [-0.188, 0.682, 0.230],
    [-0.050, -0.716, 0.230], [0.220, 0.406, 0.230], [0.454, -0.098, 0.230], [0.676, 0.310, 0.204], [0.382, -0.680, 0.170],
    [0.136, -0.350, 0.145], [-0.326, -0.164, 0.134], [0.190, 0.796, 0.131], [-0.212, 0.292, 0.131], [0.526, 0.634, 0.122],
    [0.826, -0.014, 0.121], [-0.146, -0.362, 0.103], [-0.392, 0.094, 0.102], [0.826, -0.254, 0.086], [-0.512, 0.718, 0.066],
];
/** Bánh lắc (không răng — dao động), vị trí cố định cùng lượt đóng gói ở trên. */
const CLOCK_BALANCE = { x: 0.655, y: -0.459, r: 0.15, band: [6, 14] };
const CLOCK_GEAR_RATIO_REF_Z = 24; // bánh 24 răng quay đúng tốc độ góc chủ

/** Hình học bánh răng theo pixel, gốc = tâm mặt số — Workflow cache theo dialR. Dải tần: bánh lớn -> trầm (chia
 * luỹ thừa bin 1-60 theo thứ hạng kích thước). Bánh lớn nhất (trừ bánh tâm) = hộp cót (dây cót), bánh gần bánh
 * lắc nhất = bánh thoát (răng cưa). @returns {{gears:{x,y,r,m,z,band,spokes,spiral,ratchet,ratio,phase}[],
 * balance:{x,y,r,band}}} */
function computeClockGearLayout(dialR) {
    const m = CLOCK_GEAR_MODULE * dialR;
    const n = CLOCK_GEAR_DISCS.length;
    const order = CLOCK_GEAR_DISCS.map((d, i) => i).sort((a, b) => CLOCK_GEAR_DISCS[b][2] - CLOCK_GEAR_DISCS[a][2]);
    const bandOf = new Array(n);
    order.forEach((gi, k) => {
        const lo = Math.round(Math.pow(60, k / n));
        bandOf[gi] = [lo, Math.max(lo, Math.round(Math.pow(60, (k + 1) / n)) - 1)];
    });
    const spiralIdx = order.find((i) => i !== 0);
    let ratchetIdx = 1, bestD = Infinity;
    CLOCK_GEAR_DISCS.forEach((d, i) => {
        if (i === 0) return;
        const e = Math.hypot(d[0] - CLOCK_BALANCE.x, d[1] - CLOCK_BALANCE.y) - d[2];
        if (e < bestD) { bestD = e; ratchetIdx = i; }
    });
    const dirs = [];
    const gears = CLOCK_GEAR_DISCS.map((d, i) => {
        // Chiều quay: ngược bánh đã xếp gần nhất (theo khoảng cách mép).
        let dir = 1;
        if (i > 0) {
            let nj = 0, nd = Infinity;
            for (let j = 0; j < i; j++) {
                const e = Math.hypot(d[0] - CLOCK_GEAR_DISCS[j][0], d[1] - CLOCK_GEAR_DISCS[j][1]) - CLOCK_GEAR_DISCS[j][2] - d[2];
                if (e < nd) { nd = e; nj = j; }
            }
            dir = -dirs[nj];
        }
        dirs.push(dir);
        const z = Math.max(8, Math.round((2 * (d[2] * dialR - m)) / m));
        return {
            x: d[0] * dialR, y: d[1] * dialR, r: (m * z) / 2, m, z,
            band: bandOf[i],
            spokes: i === ratchetIdx ? 0 : z >= 40 ? 5 : z >= 28 ? 4 : z >= 18 ? 3 : 0,
            spiral: i === spiralIdx, ratchet: i === ratchetIdx,
            ratio: (dir * CLOCK_GEAR_RATIO_REF_Z) / z,
            phase: i * 1.7,
        };
    });
    return {
        gears,
        balance: { x: CLOCK_BALANCE.x * dialR, y: CLOCK_BALANCE.y * dialR, r: CLOCK_BALANCE.r * dialR, band: CLOCK_BALANCE.band },
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

/** Góc quay từng bánh từ góc chủ — lượt 4: bánh rời nhau, mỗi bánh = góc chủ × tỉ số riêng (có dấu) + pha lệch.
 * @returns {Float64Array} */
function computeClockGearAngles(gears, masterAngle) {
    const angles = new Float64Array(gears.length); // Float64: góc chủ tích luỹ lớn, Float32 sẽ rung
    for (let i = 0; i < gears.length; i++) angles[i] = masterAngle * gears[i].ratio + gears[i].phase;
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

/** Nốt MIDI -> bậc 1-7 (C D E F G A B; nốt thăng gộp về bậc tự nhiên bên dưới). null -> 0. */
const CLOCK_DEGREE_OF_PC = [1, 1, 2, 2, 3, 4, 4, 5, 5, 6, 6, 7];
/** Tốc độ kim chế độ Past & Future (giây ảo / giây thật, mốc 120 BPM) theo |bậc - 4| = 0..3, nội suy tuyến
 * tính. SỬA (lượt 4, Giang: "Future & past là một mục chọn") — gộp 1 chế độ, 2 chiều ĐỐI XỨNG (bỏ bảng
 * "chiều ưu tiên" nhanh/chậm của lượt 2). */
const CLOCK_PITCH_RATE = [0, 10, 45, 160];
const CLOCK_PITCH_CHASE_MS = 180;   // hằng thời gian bám theo nốt mới
const CLOCK_PITCH_RELEASE_MS = 600; // mất nốt -> chậm dần về đứng
const CLOCK_JAM_IN_MS = 90, CLOCK_JAM_OUT_MS = 250;
/** MỚI (26/09/2026, lượt 3, Giang "tích hợp bpm speed cho past và future") — tốc độ kim nhân thêm BPM / 120
 * (bảng tốc độ ở trên là mốc 120 BPM), kẹp [0.4, 1.8]; chưa đo được BPM -> ×1. Hệ số làm mượt riêng để BPM
 * nhảy giá trị không làm kim giật. */
const CLOCK_BPM_REF = 120;
const CLOCK_BPM_MUL_MIN = 0.4, CLOCK_BPM_MUL_MAX = 1.8;
const CLOCK_BPM_SMOOTH_MS = 800;
/** MỚI (27/09/2026, lượt 7, Giang: "khi không có audio, kim di chuyển tịnh tiến thuận 1s một") — không phát thì
 * kim chạy như đồng hồ thường: 1 giây ảo / 1 giây thật, chiều thuận, không nhân BPM. Chuyển qua lại giữa 2 chế độ
 * trộn mượt theo `idle` 0-1 (EMA) để kim không giật lúc bấm Play/Pause. */
const CLOCK_IDLE_RATE = 1;
const CLOCK_IDLE_BLEND_MS = 400;

/** MỚI (26/09/2026, Giang) — kim chế độ 'pastFuture' chạy theo nốt: bậc < 4 chạy NGƯỢC, > 4 chạy THUẬN
 * (càng xa bậc 4 càng nhanh), bậc 4 = KẸT (kim đứng tại chỗ rung lắc, bánh răng khựng). Mức `level`
 * (= bậc - 4, -3..3) và độ kẹt `jam` (0-1) đều làm mượt (EMA theo dt thật) nên đổi chiều/tốc độ không giật.
 * Không có nốt / không phát -> chậm dần rồi đứng. `startSec` = giờ ảo
 * khởi đầu khi `prev` null. `bpm` (số, <= 0/NaN = chưa đo được) nhân tốc độ — xem CLOCK_BPM_REF. Trả state MỚI
 * {virtualSec, level, jam, bpmMul, idle}. Lượt 7 — không phát (`isPlaying` false) -> trộn dần sang CLOCK_IDLE_RATE
 * (kim chạy thuận 1s/giây), xem CLOCK_IDLE_BLEND_MS. */
function advanceClockPitchHands(prev, dtMs, isPlaying, midiNote, noteFresh, startSec, bpm) {
    const state = prev || { virtualSec: startSec, level: 0, jam: 0, bpmMul: 1, idle: isPlaying ? 0 : 1 };
    const targetBpmMul = bpm > 0 ? Math.max(CLOCK_BPM_MUL_MIN, Math.min(CLOCK_BPM_MUL_MAX, bpm / CLOCK_BPM_REF)) : 1;
    const bpmMul = state.bpmMul + (targetBpmMul - state.bpmMul) * (1 - Math.exp(-dtMs / CLOCK_BPM_SMOOTH_MS));
    const hasNote = isPlaying && noteFresh && midiNote !== null && midiNote !== undefined;
    const degree = hasNote ? CLOCK_DEGREE_OF_PC[((Math.round(midiNote) % 12) + 12) % 12] : 0;
    const targetLevel = hasNote ? degree - 4 : 0;
    const targetJam = hasNote && degree === 4 ? 1 : 0;
    const kLevel = 1 - Math.exp(-dtMs / (hasNote ? CLOCK_PITCH_CHASE_MS : CLOCK_PITCH_RELEASE_MS));
    const kJam = 1 - Math.exp(-dtMs / (targetJam > state.jam ? CLOCK_JAM_IN_MS : CLOCK_JAM_OUT_MS));
    const level = state.level + (targetLevel - state.level) * kLevel;
    const jam = state.jam + (targetJam - state.jam) * kJam;
    const mag = Math.min(3, Math.abs(level));
    const table = CLOCK_PITCH_RATE;
    const i0 = Math.floor(mag), i1 = Math.min(3, i0 + 1);
    const pitchRate = (table[i0] + (table[i1] - table[i0]) * (mag - i0)) * Math.sign(level) * bpmMul;
    const prevIdle = state.idle || 0;
    const idle = prevIdle + ((isPlaying ? 0 : 1) - prevIdle) * (1 - Math.exp(-dtMs / CLOCK_IDLE_BLEND_MS));
    const rate = pitchRate * (1 - idle) + CLOCK_IDLE_RATE * idle;
    return { virtualSec: state.virtualSec + rate * (dtMs / 1000), level, jam, bpmMul, idle };
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
 * 2 đoạn gối nhau). Tắt thì chạy ngược (dây thu vào trước rồi đồng hồ hạ xuống). Cả cụm được căn giữa theo
 * chiều dọc; màn không đủ cao (ngang) thì thu nhỏ cả cụm. SỬA (lượt 4) — `topExtR` = mép trên của cụm (vỏ, hoặc
 * vòng quét khi đang hiện, px cục bộ) và `baseScale` = hệ số co sẵn (chừa chỗ vòng quét) khi chưa có con lắc.
 * Lượt 6 — `lengthPct` 20-100 = % chiều dài tối đa vừa màn hình (xem thân hàm).
 * @returns {{cy:number, scale:number, pivotY:number, length:number, bobR:number, reveal:number}} — pivotY/
 *   length/bobR theo đơn vị pixel CỤC BỘ (trước scale, gốc = tâm mặt số). */
function computeClockPendulumLayout(canvasH, dialR, progress, caseVisible, topExtR, baseScale, lengthPct) {
    const ease = (x) => { const t = Math.max(0, Math.min(1, x)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    const shiftE = ease(progress / 0.55);
    const lenE = ease((progress - 0.35) / 0.65);
    const caseR = dialR * (caseVisible ? 1.08 : 1.0);
    const bobR = dialR * 0.15;
    // Lượt 6 (Giang: "chiều dài < chiều cao màn hình, kiểm tra trước") — chiều dài tối đa = phần màn hình còn trống
    // dưới đồng hồ (92% chiều cao, ở scale gốc) trừ quả lắc -> 100% = quả lắc chạm vừa mép dưới, KHÔNG làm đồng
    // hồ co lại và dây không bao giờ dài quá màn hình. Màn quá thấp (ngang) thì giữ tối thiểu 0.4R và co cả cụm.
    const usable = (canvasH * 0.92) / baseScale;
    const maxLen = usable - topExtR - caseR - bobR * 2;
    const pct = Math.max(0.2, Math.min(1, (lengthPct || 70) / 100));
    const fullLen = Math.max(dialR * 0.4, maxLen * pct);
    const tail = fullLen + bobR * 2;
    const fitScale = Math.min(baseScale, (canvasH * 0.92) / (topExtR + caseR + tail));
    const scale = baseScale + (fitScale - baseScale) * shiftE;
    return {
        cy: canvasH / 2 - shiftE * ((caseR + tail - topExtR) / 2) * scale,
        scale,
        pivotY: caseR,
        length: fullLen * lenE,
        bobR,
        reveal: lenE,
    };
}

/** VÒNG QUỸ ĐẠO 3D quanh đồng hồ (lượt 5, Giang — thay 3 vòng HUD + tia quét lượt 4).
 * SỬA (27/09/2026, lượt 7b, Giang): "xoay thuận/nghịch" = CẢ VÒNG xoay (+/-) trong không gian 3D quanh trục đi qua
 * tâm đồng hồ, không phải vệt/dot chạy dọc vòng.
 * SỬA (27/09/2026, lượt 8, Giang: "giảm 6 xuống 4 vòng; cố định: 1 vòng thẳng, 1 vòng ngang, 2 vòng chéo 2 bên; 4
 * vòng xoay, tốc độ độc lập nhau") — bỏ cơ chế đổi trục theo nốt (Rubik) của lượt 5-7b. Mỗi vòng có TRỤC XOAY CỐ
 * ĐỊNH nằm trong mặt phẳng màn hình, đi qua tâm, và chính là 1 đường kính của vòng -> vòng xoay quanh đường kính đó
 * (như quả địa cầu), nhìn trên màn hình vòng luôn giữ đúng phương của mình (thẳng / ngang / chéo), chỉ bề rộng hình
 * elip co giãn theo góc xoay. Thứ tự vòng 1-4: thẳng (trục dọc), ngang (trục ngang), chéo trái, chéo phải.
 *   - CHIỀU xoay (+/-): theo chiều kim, dùng chung cho 4 vòng (`dir`/`vel`, xem CLOCK_ORBIT_MIN_MUL — không khựng,
 *     không rung, có sàn tốc độ; không phát -> xoay đều theo chiều hiện tại).
 *   - TỐC ĐỘ: độc lập từng vòng — tốc độ nền riêng (CLOCK_ORBIT_SPEED) × năng lượng DẢI TẦN RIÊNG của vòng đó
 *     (computeClockOrbitRingLevels(), làm mượt riêng từng vòng) thay cho năng lượng chung.
 * Ma trận hiển thị 3×3 `view` (hàng trước, toạ độ màn hình: x phải, y xuống, z hướng vào người xem) — vòng nằm trong
 * mặt phẳng local XY; local X = trục xoay (cố định), local Y = đường kính vuông góc, xoay quanh trục theo `phase`. */
// Tỉ lệ bán kính 4 vòng — bán kính thật = tỉ lệ × `radiusMul` (clockRingRadius / 100). Lượt 9b (27/09/2026, Giang:
// "cả 4 ring đều tuỳ chỉnh bằng nhau về bán kính") — 4 vòng CÙNG bán kính (trước: 1.25/1.4/1.55/1.7 lệch nhau),
// slider Ring radius chỉnh đồng thời cả 4; các vòng giao nhau như quả cầu (khung armillary).
const CLOCK_ORBIT_RADII = [1, 1, 1, 1];
const CLOCK_ORBIT_SPEED = [0.95, 0.7, 0.55, 0.82];                   // rad/s nền của từng vòng (khác nhau)
/** Trục xoay cố định (phương trên màn hình, y hướng xuống): thẳng, ngang, chéo trái (\), chéo phải (/). */
const CLOCK_ORBIT_AXES = [[0, 1, 0], [1, 0, 0], [Math.SQRT1_2, Math.SQRT1_2, 0], [Math.SQRT1_2, -Math.SQRT1_2, 0]];
const CLOCK_ORBIT_PHASE0 = [1.1, 0.4, 2.0, 2.7];                     // lệch pha ban đầu để 4 vòng không phẳng cùng lúc
const CLOCK_ORBIT_BAND_GAIN = 1.2;                                   // tốc độ × (1 + mức dải tần × hệ số này)
const CLOCK_ORBIT_LEVEL_MS = 250;                                    // làm mượt mức dải tần từng vòng
const CLOCK_ORBIT_ANIM_MS = 700;                                     // hiện/ẩn
/** Lượt 7 (Giang: "không bị khựng lại như kim đồng hồ") — hệ số tốc độ chung có dấu (`vel`) bám theo kim nhưng: độ
 * lớn không dưới CLOCK_ORBIT_MIN_MUL (mất nốt / bậc 4 kẹt vẫn xoay, không rung); chiều (`dir`) chỉ đổi khi
 * |handsDir| vượt CLOCK_ORBIT_DIR_MIN, còn lại giữ chiều hiện tại. Không phát -> xoay đều CLOCK_ORBIT_MIN_MUL theo
 * chiều hiện tại. `vel` làm mượt EMA -> đổi chiều là quay đầu mượt. */
const CLOCK_ORBIT_MIN_MUL = 0.6;
const CLOCK_ORBIT_DIR_MIN = 0.15;
const CLOCK_ORBIT_VEL_MS = 350;
/** Cụm vòng quỹ đạo được phép chiếm tới 96% nửa cạnh ngắn màn hình (lượt 7 — trước đây bị gò trong khung
 * clockSizeRatio nên vòng rộng ra chỉ làm đồng hồ co lại). */
const CLOCK_ORBIT_FIT = 0.96;

/** MỚI (27/09/2026, lượt 7) — hệ số co cả cụm (≤ 1) để vòng ngoài cùng (kể cả nửa độ dày `halfWidthPx`, pixel màn
 * hình) nằm trong CLOCK_ORBIT_FIT × `halfMinSide` (nửa cạnh ngắn canvas). Đồng hồ chỉ co khi vòng không vừa.
 * Lượt 9 — `radiusMul` = bán kính vòng ngoài cùng / bán kính mặt số.
 * @returns {{scale:number, outerR:number}} — outerR = bán kính vòng ngoài cùng (px cục bộ, trước scale). */
function computeClockOrbitFitScale(dialR, halfMinSide, halfWidthPx, radiusMul) {
    const outerR = CLOCK_ORBIT_RADII[CLOCK_ORBIT_RADII.length - 1] * radiusMul * dialR;
    const scale = Math.max(0.3, Math.min(1, (halfMinSide * CLOCK_ORBIT_FIT - halfWidthPx) / outerR));
    return { scale, outerR };
}

/** MỚI (27/09/2026, lượt 8) — mức 0-1 của 4 dải tần (chia luỹ thừa trên 70% bin đầu, trầm -> cao) ứng vòng 1-4,
 * để mỗi vòng xoay theo nhịp riêng. Không phát -> toàn 0. @returns {Float32Array} */
function computeClockOrbitRingLevels(vizDataArray, binCount, isPlaying) {
    const n = CLOCK_ORBIT_RADII.length;
    const out = new Float32Array(n);
    if (!isPlaying) return out;
    const maxBin = Math.floor(binCount * 0.7);
    for (let k = 0; k < n; k++) {
        const lo = 1 + Math.floor((maxBin - 1) * Math.pow(k / n, 2));
        const hi = Math.max(lo, 1 + Math.floor((maxBin - 1) * Math.pow((k + 1) / n, 2)) - 1);
        let sum = 0;
        for (let b = lo; b <= hi; b++) sum += vizDataArray[b] || 0;
        out[k] = Math.min(1, sum / (hi - lo + 1) / 255);
    }
    return out;
}

/** 1 bước 4 vòng quỹ đạo. `bandLevels` = kết quả computeClockOrbitRingLevels(). Trả state MỚI (không sửa `prev`):
 * {reveal, dir, vel, rings:[{phase, level, view}]} — `phase` = góc đã xoay quanh trục cố định, `level` = mức dải
 * tần đã làm mượt, `view` = ma trận hiển thị. */
function advanceClockOrbitRings(prev, dtMs, enabled, handsDir, isPlaying, bandLevels) {
    const state = prev || {
        reveal: 0, dir: 1, vel: CLOCK_ORBIT_MIN_MUL,
        rings: CLOCK_ORBIT_RADII.map((r, k) => ({ phase: CLOCK_ORBIT_PHASE0[k], level: 0, view: null })),
    };
    const step = dtMs / CLOCK_ORBIT_ANIM_MS;
    const reveal = enabled ? Math.min(1, state.reveal + step) : Math.max(0, state.reveal - step);
    // Chiều xoay: chỉ đổi khi kim đang chạy rõ theo chiều mới; mất nốt / kẹt / không phát -> giữ chiều cũ.
    const dir = Math.abs(handsDir) > CLOCK_ORBIT_DIR_MIN ? Math.sign(handsDir) : state.dir;
    const targetMag = isPlaying ? Math.max(CLOCK_ORBIT_MIN_MUL, Math.abs(handsDir)) : CLOCK_ORBIT_MIN_MUL;
    const vel = state.vel + (dir * targetMag - state.vel) * (1 - Math.exp(-dtMs / CLOCK_ORBIT_VEL_MS));
    const kLevel = 1 - Math.exp(-dtMs / CLOCK_ORBIT_LEVEL_MS);
    const rings = state.rings.map((ring, k) => {
        const level = ring.level + (((bandLevels && bandLevels[k]) || 0) - ring.level) * kLevel;
        const omega = CLOCK_ORBIT_SPEED[k] * vel * (1 + level * CLOCK_ORBIT_BAND_GAIN);
        const phase = (ring.phase + omega * (dtMs / 1000)) % (Math.PI * 2);
        // local X = trục a (cố định); local Y = b·cos(phase) + z·sin(phase) với b = a xoay 90° trong mặt phẳng màn hình.
        const a = CLOCK_ORBIT_AXES[k], bx = -a[1], by = a[0];
        const c = Math.cos(phase), s = Math.sin(phase);
        const ux = bx * c, uy = by * c, uz = s;                        // local Y
        const nx = a[1] * uz, ny = -a[0] * uz, nz = a[0] * uy - a[1] * ux; // local Z = a × localY
        return { phase, level, view: [a[0], ux, nx, a[1], uy, ny, a[2], uz, nz] };
    });
    return { reveal, dir, vel, rings };
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
 * `ghostSwings` (lượt 6) = góc các dây mờ phía sau cho bóng mờ.
 * Vẽ TRƯỚC thân đồng hồ để đầu dây chui dưới vỏ. Gốc = tâm mặt số. Chỉ Canvas API. */
function paintClockPendulum(ctx, pivotY, length, bobR, swing, reveal, color, glowColor, glowPx, dpr, ghostSwings) {
    if (reveal <= 0.001) return;
    const alpha = Math.min(1, reveal * 4);
    const ex = Math.sin(swing) * length, ey = pivotY + Math.cos(swing) * length;
    const bx = ex + Math.sin(swing) * bobR, by = ey + Math.cos(swing) * bobR;
    const r = bobR * (0.35 + 0.65 * reveal);
    // Móc treo.
    ctx.globalAlpha = 0.9 * alpha;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, pivotY, Math.max(3 * dpr, bobR * 0.14), 0, Math.PI * 2); ctx.fill();
    // Lượt 6 (Giang) — bóng mờ của dây: các dây "ma" ở góc lệch pha phía sau (`ghostSwings`, gần -> xa), mờ dần,
    // như vệt nhoè chuyển động. Mảng rỗng = tắt.
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    if (ghostSwings && ghostSwings.length) {
        ctx.lineWidth = Math.max(2, dpr * 3);
        ghostSwings.forEach((gs, g) => {
            ctx.globalAlpha = alpha * 0.3 * (1 - g / ghostSwings.length);
            ctx.beginPath(); ctx.moveTo(0, pivotY); ctx.lineTo(Math.sin(gs) * length, pivotY + Math.cos(gs) * length); ctx.stroke();
        });
        ctx.globalAlpha = 0.9 * alpha;
    }
    // Dây.
    ctx.lineWidth = Math.max(1.5, dpr * 2);
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

/** Vẽ 4 vòng quỹ đạo, TÁCH 2 LƯỢT theo chiều sâu CHỈ ĐỂ CHE KHUẤT: `front` false = nửa phía sau (z < 0, vẽ TRƯỚC thân
 * đồng hồ), true = nửa phía trước (z >= 0, vẽ SAU thân đồng hồ) -> vòng như bao quanh đồng hồ thật. Chiếu trực giao.
 * `colors[k]` = {fill, glow}. `lineW` = độ dày vòng (px CỤC BỘ — Workflow quy đổi từ `clockRingWidth` 1-6px màn hình
 * ÷ scale cụm). Gốc = tâm mặt số.
 * SỬA (27/09/2026, lượt 9, Giang: "bỏ phần nửa sáng nửa tối của ring, cho đồng màu hết") — 2 lượt cùng độ đậm + cùng
 * glow (bỏ mức sáng theo chiều sâu). Thêm `radiusMul` (bán kính vòng ngoài cùng / bán kính mặt số) và `bgOpacity`
 * 0-0.5: nền = đĩa phẳng bên trong vòng, cùng màu vòng, xoay theo vòng; nửa đĩa trước/sau tách theo đường kính
 * nằm trên mặt phẳng màn hình (z = 0) giống thân vòng. */
function paintClockOrbitRings(ctx, dialR, orbit, front, colors, glowPx, lineW, dpr, radiusMul, bgOpacity) {
    const reveal = orbit.reveal;
    if (reveal <= 0.001) return;
    const TAU = Math.PI * 2, N = 144;
    const w = Math.max(1, lineW) * (0.6 + 0.4 * reveal);
    const bgA = Math.max(0, Math.min(0.5, bgOpacity || 0));
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'round';
    ctx.lineWidth = w;
    orbit.rings.forEach((ring, k) => {
        const R = CLOCK_ORBIT_RADII[k] * radiusMul * dialR * (0.85 + 0.15 * reveal);
        const v = ring.view;
        // Nửa vòng thuộc lượt này: z(a) = v6·cos a + v7·sin a = 0 tại a0 = atan2(-v6, v7) và a0 + π; nửa [a0, a0+π]
        // có z > 0 (phía trước). Cung = 1 polyline (khép bằng dây cung = nửa đĩa). Vòng đối diện người xem (v6 = v7
        // = 0) -> cả vòng thuộc lượt trước.
        const facing = Math.abs(v[6]) + Math.abs(v[7]) < 1e-6;
        if (facing && !front) return;
        const a0 = facing ? 0 : Math.atan2(-v[6], v[7]) + (front ? 0 : Math.PI);
        const span = facing ? TAU : Math.PI;
        const steps = facing ? N : N / 2;
        const arc = [];
        for (let j = 0; j <= steps; j++) {
            const a = a0 + (span * j) / steps;
            arc.push((v[0] * Math.cos(a) + v[1] * Math.sin(a)) * R, (v[3] * Math.cos(a) + v[4] * Math.sin(a)) * R);
        }
        const trace = () => {
            ctx.beginPath();
            ctx.moveTo(arc[0], arc[1]);
            for (let i = 2; i < arc.length; i += 2) ctx.lineTo(arc[i], arc[i + 1]);
        };
        if (bgA > 0) {
            ctx.shadowBlur = 0;
            ctx.globalAlpha = reveal * bgA;
            ctx.fillStyle = colors[k].fill;
            trace(); ctx.closePath(); ctx.fill();
        }
        ctx.globalAlpha = reveal;
        ctx.strokeStyle = colors[k].fill;
        ctx.shadowColor = colors[k].glow;
        ctx.shadowBlur = glowPx;
        trace(); ctx.stroke();
        ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;
    ctx.lineJoin = 'miter';
}
