/**
 * core/visualizer/groups/shape/rubik.js — [CHUYỂN NHÓM, 05/09/2026, yêu cầu Giang] Trước đây đứng
 * riêng `core/visualizer/types/rubik.js` — giờ thuộc group "shape" (core/visualizer/groups/shape/,
 * xem registry ở common.js cùng thư mục). Nội dung hàm GIỮ NGUYÊN 100%, chỉ đổi đường dẫn file.
 * Giang cần XOÁ TAY file cũ `core/visualizer/types/rubik.js` (không tự xoá qua patch) — index.html
 * cần cập nhật `<script src="...">` tương ứng.
 *
 * Visual RUBIK — khối Rubik 3x3x3 chiếu phối cảnh thủ công (không dùng Three.js).
 *
 * Mỗi mảnh (rubikCubes[i]) phóng to/thu nhỏ NGAY TẠI TÂM CỦA RIÊNG NÓ (không lệch khối) theo
 * biên độ bin tần số đại diện của mảnh đó CỘNG với cú đập beat chung (beatScale) — mỗi mảnh vẫn
 * phản ánh âm thanh riêng nhưng cùng "thở" theo nhịp nhạc.
 *
 * XOAY THEO NHẠC (không còn ngẫu nhiên) — 2 kiểu xoay áp dụng đồng thời, dựa vào pitch (nốt nhạc
 * YIN phát hiện được ở js/core/audio-analysis.js):
 *   - Kiểu 1 (xoay TỰ THÂN, rubikRotX/rubikRotY) : lấy "pha" = nốt MIDI trung bình động gần đây
 *     (rubikPitchAvg) làm mốc trung bình. Nốt hiện tại THẤP hơn pha -> xoay CHẬM lại; nốt hiện tại
 *     CAO hơn pha -> xoay NHANH lên. Hướng xoay tự thân của mỗi trục (rubikSelfSpinDirX/Y) chọn
 *     ngẫu nhiên một lần khi khởi động rồi giữ cố định — chỉ tốc độ đổi theo nhạc, hướng không bị
 *     đảo liên tục gây cảm giác giật.
 *   - Kiểu 2 (xoay MẶT/LỚP, rubikAnim)         : mỗi 1 trong 12 nốt (C..B, xem
 *     RUBIK_NOTE_TO_TURN ở js/core/dom-refs.js) map CỐ ĐỊNH ra một cặp (trục x/y/z, lớp -1/0/1).
 *     Khi nốt hiện tại đổi khác nốt vừa kích hoạt lượt xoay gần nhất VÀ năng lượng nhạc đủ cao,
 *     kích hoạt lượt xoay lớp tương ứng — không còn chọn random như bản cũ.
 *
 * [SỬA — rà soát Rule 3, không ngoại lệ] TRƯỚC ĐÂY `drawRubik(ctx, isPlaying)` tự `appState.get()`
 * (Rule 2, ~7 khoá) + tự gọi `getActiveEffectConfig()`/`getComputedColor()`/`rotate3D()`/
 * `project3D()`/`rotateRubikIndices()` (Rule 3 — `rotate3D`/`project3D`/`rotateRubikIndices` ở
 * KHÁC file, core/rubik-math.js, và dù cùng file cũng không đạt điều kiện Rule 3c vì KHÔNG tự chứa
 * vòng lặp). SỬA: `drawRubik()` xoá hẳn. Workflow (`_tickRubik()`, event/workflow/
 * visualizer-render.js) tự gom appState/cfg TRƯỚC, tự vòng lặp gọi RIÊNG LẺ `rotate3D()`/
 * `project3D()`/`getComputedColor()`/`rotateRubikIndices()` cho từng đỉnh/khối — các hàm dưới đây
 * chỉ nhận toạ độ ĐÃ xoay/chiếu sẵn hoặc trả về toạ độ THÔ (trước khi xoay) để Workflow tự xoay.
 * `rubikRotX`/`rubikRotY`/`rubikAnim`/`rubikSelfSpinDirX/Y`/`rubikLastTurnNote` là biến module-level
 * (khai báo ở `core/dom-refs.js`, tự ghi chú "KHÔNG thuộc STATE") — đọc/ghi trực tiếp KHÔNG vi phạm
 * Rule 2 (rule chỉ cấm `appState.get()`), Workflow cũng đọc trực tiếp được (cùng phạm vi global).
 */

// 8 đỉnh đơn vị của 1 khối lập phương + 6 mặt (chỉ số đỉnh) — dữ liệu THUẦN, dời từ local const
// trong drawRubik() cũ ra module-level (không đổi giá trị).
const RUBIK_UNIT_VERTICES = [
    { x: -0.5, y: -0.5, z: -0.5 }, { x: 0.5, y: -0.5, z: -0.5 }, { x: 0.5, y: 0.5, z: -0.5 }, { x: -0.5, y: 0.5, z: -0.5 },
    { x: -0.5, y: -0.5, z: 0.5 }, { x: 0.5, y: -0.5, z: 0.5 }, { x: 0.5, y: 0.5, z: 0.5 }, { x: -0.5, y: 0.5, z: 0.5 },
];
const RUBIK_FACES = [[0, 1, 2, 3], [1, 5, 6, 2], [5, 4, 7, 6], [4, 0, 3, 7], [3, 2, 6, 7], [4, 5, 1, 0]];

/** Kiểu 1 — xoay tự thân theo pitch. Mutate trực tiếp `rubikRotX`/`rubikRotY` (module-level, không
 * phải appState). */
function advanceRubikSelfSpin(isPlaying, currentMidi, rubikPitchAvg, smoothedEnergy, pitchSensitivity) {
    let pitchSpeedFactor = 1;
    if (isPlaying && currentMidi != null && rubikPitchAvg > 0) {
        const semitoneDiff = Math.max(-12, Math.min(12, currentMidi - rubikPitchAvg));
        pitchSpeedFactor = 1 + (semitoneDiff / 12) * pitchSensitivity;
    }
    const selfSpinBase = isPlaying ? (0.01 + smoothedEnergy * 0.025) * pitchSpeedFactor : 0.003;
    rubikRotY += selfSpinBase * rubikSelfSpinDirY;
    rubikRotX += selfSpinBase * 0.6 * rubikSelfSpinDirX;
}

/** Kiểu 2 — kích hoạt 1 lượt xoay lớp mới nếu đủ điều kiện (nốt đổi + năng lượng đủ cao). Guard
 * clause liên tiếp (Rule 1 — vẫn 1 tiến trình, chỉ dừng sớm). Mutate `rubikAnim`/`rubikLastTurnNote`
 * (module-level). */
function maybeTriggerRubikLayerTurn(isPlaying, smoothedEnergy, currentMidi, rotationEnergyThreshold, rubikPitchAvg) {
    if (rubikAnim.active || !isPlaying || smoothedEnergy <= rotationEnergyThreshold || currentMidi == null) return;
    const noteIdx = ((currentMidi % 12) + 12) % 12;
    if (noteIdx === rubikLastTurnNote) return;
    const turn = RUBIK_NOTE_TO_TURN[noteIdx];
    rubikAnim.axis = turn.axis;
    rubikAnim.layer = turn.layer;
    rubikAnim.dir = (currentMidi >= rubikPitchAvg) ? 1 : -1;
    rubikAnim.angle = 0;
    rubikAnim.active = true;
    rubikLastTurnNote = noteIdx;
}

/** Tiến progress lượt xoay đang chạy (nếu có). @returns {{axis:string,layer:number,dir:number}|null}
 * thông tin lượt xoay VỪA HOÀN TẤT (để Workflow tự gọi `rotateRubikIndices()`, core/rubik-math.js —
 * Rule 3, cross-file), null nếu chưa xong/không có lượt nào đang chạy. Mutate `rubikAnim`. */
function advanceRubikLayerTurnProgress(layerTurnSpeed, smoothedEnergy) {
    if (!rubikAnim.active) return null;
    rubikAnim.angle += layerTurnSpeed * (1 + smoothedEnergy * 2);
    if (rubikAnim.angle >= Math.PI / 2) {
        rubikAnim.angle = Math.PI / 2;
        const completed = { axis: rubikAnim.axis, layer: rubikAnim.layer, dir: rubikAnim.dir };
        rubikAnim.active = false;
        rubikAnim.angle = 0;
        return completed;
    }
    return null;
}

/** Vị trí + hệ số scale của 1 khối TRƯỚC KHI xoay (offset theo tâm riêng + lệch xa tâm theo biên
 * độ, giống hệt bản gốc) — thuần, KHÔNG gọi `rotate3D()`. Nếu khối đang nằm trong lớp đang xoay,
 * trả kèm `turnRotAxis`/`turnRotAngle` để Workflow tự áp `rotate3D()` (Rule 3). */
function computeRubikCubeBase(rc, val, isPlaying, beatScale, cubeSize, spacing) {
    const scaleBounce = 1 + (val / 255) * 0.4 + (isPlaying ? beatScale * 0.25 : 0);
    const extraDist = (val / 255) * cubeSize * 1.2 * (isPlaying ? 1 : 0);
    const lx = rc.cx * spacing + Math.sign(rc.cx) * extraDist;
    const ly = rc.cy * spacing + Math.sign(rc.cy) * extraDist;
    const lz = rc.cz * spacing + Math.sign(rc.cz) * extraDist;
    const result = { pos: { x: lx, y: ly, z: lz }, scale: scaleBounce, turnRotAxis: null, turnRotAngle: 0 };
    if (rubikAnim.active && rc['c' + rubikAnim.axis] === rubikAnim.layer) {
        result.turnRotAxis = rubikAnim.axis;
        result.turnRotAngle = rubikAnim.angle * rubikAnim.dir;
    }
    return result;
}

/** Toạ độ 1 đỉnh khối TRƯỚC KHI xoay (offset theo tâm khối + scale, tại vị trí `pos` ĐÃ xoay lớp
 * sẵn nếu có) — thuần, KHÔNG gọi `rotate3D()`. */
function computeRubikVertexLocalPos(pos, uv, cubeSize, scale) {
    return { x: pos.x + uv.x * cubeSize * scale, y: pos.y + uv.y * cubeSize * scale, z: pos.z + uv.z * cubeSize * scale };
}

/** Vẽ 6 mặt khối (chỉ mặt quay ra ngoài, test `crossZ > 0` giống hệt bản gốc) từ 8 đỉnh ĐÃ CHIẾU
 * (`projVerts`, toạ độ màn hình — Workflow tự `rotate3D()`/`project3D()` sẵn) + màu ĐÃ resolve sẵn
 * (Workflow tự `getComputedColor()` sẵn). Chỉ gọi Canvas API (không tính Rule 3). */
function paintRubikCubeFaces(ctx, projVerts, fillColor, dpr) {
    ctx.lineWidth = 1.5 * dpr;
    ctx.lineJoin = 'round';
    RUBIK_FACES.forEach((face, f) => {
        const p0 = projVerts[face[0]], p1 = projVerts[face[1]], p2 = projVerts[face[2]];
        const dx1 = p1.x - p0.x, dy1 = p1.y - p0.y, dx2 = p2.x - p1.x, dy2 = p2.y - p1.y;
        const crossZ = dx1 * dy2 - dy1 * dx2;
        if (crossZ > 0) {
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            for (let vIdx = 1; vIdx < 4; vIdx++) ctx.lineTo(projVerts[face[vIdx]].x, projVerts[face[vIdx]].y);
            ctx.closePath();
            const lightFactor = 0.5 + (f * 0.1);
            ctx.fillStyle = fillColor;
            ctx.globalAlpha = 0.8 * lightFactor;
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = '#000000';
            ctx.stroke();
        }
    });
}

/** Viền glow khối đang sáng nhất (`val > 140`, kiểm tra ở Workflow trước khi gọi) — cùng test
 * `crossZ > 0`. Chỉ gọi Canvas API. */
function paintRubikCubeGlow(ctx, projVerts, glowColor, dpr) {
    ctx.shadowBlur = 15 * dpr;
    ctx.shadowColor = glowColor;
    RUBIK_FACES.forEach((face) => {
        const p0 = projVerts[face[0]], p1 = projVerts[face[1]], p2 = projVerts[face[2]];
        const crossZ = (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
        if (crossZ > 0) {
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            for (let vIdx = 1; vIdx < 4; vIdx++) ctx.lineTo(projVerts[face[vIdx]].x, projVerts[face[vIdx]].y);
            ctx.closePath();
            ctx.strokeStyle = glowColor;
            ctx.stroke();
        }
    });
    ctx.shadowBlur = 0;
}
