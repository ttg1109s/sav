/**
 * core/visualizer/groups/connector/brain.js — style "brain" (Brain Filter) của group connector. THUẦN
 * canvas 2D (vẽ lên #visualizer, KHÔNG dùng WebGL/cnScene — khác synapse/circuit), Workflow
 * (_tickConnectorBrain(), event/workflow/visualizer-render.js) tự gom appState rồi gọi tuần tự.
 *
 * NGUỒN: Brain_Filter_Perception_Visualization.html (infographic "Brain Filter & Reality Perception") —
 * BÊ NGUYÊN khối pipeline "nguồn -> bộ lọc (ellipse + lưới nơ-ron) -> vài đường ra": công thức
 * Bézier, cách sinh đường vào/đường ra/65 node trong ellipse, burst tan rã ở thành filter. BỎ hẳn
 * vỏ trang (header/toolbar/banner/footer), drawLabelsAndTimeline() (nhãn chữ + trục thời gian),
 * pointer/pause/theme — SAV đã có tương đương.
 *
 * KHÁC nguồn (có chủ ý):
 *  1. AUDIO-DRIVEN thay Math.random()/tự chạy: mỗi đường vào = 1 dải tần tonotopic (tái dùng
 *     synapse.js); xung chỉ sinh khi dải đó onset; "Filter Strictness" = fireThreshold cộng
 *     adaptation/lateralInhibition (cùng cơ chế synapse/circuit) — vượt ngưỡng thì QUA lọc, không thì
 *     tan rã ở thành filter. Đường ra chọn theo pitch class (12 đường) như circuit chọn đích theo pitch.
 *  2. Bố cục nguồn là ngang 2:1 — điện thoại dọc thì ellipse chỉ còn ~35px. Layout dựng trong hệ
 *     LOGIC (u = dọc dòng chảy, v = ngang dòng chảy) rồi ánh xạ ra màn hình: khung dọc -> dòng chảy
 *     từ trên xuống dưới.
 *  3. BỎ shadowBlur (nguồn quên reset shadowBlur=20 trước vòng vẽ mesh -> mọi nét mesh đều có blur, rất
 *     nặng trên điện thoại): glow = vài nét/vòng tròn chồng nhau alpha thấp, nhân `glowMult`
 *     (getConnectorGlowMult(), core/custom-effect.js). Mesh gom 1 path/1 lần stroke; cạnh mesh tính
 *     SẴN 1 lần lúc dựng layout (nguồn tính lại O(n^2) khoảng cách mỗi frame).
 *  4. Mọi thời gian theo dt (giây) thay vì "mỗi frame" — không lệch tốc độ theo Hz màn hình.
 *
 * Mỗi hàm core dưới đây TỰ CHỨA (Rule 3 — core không gọi core): công thức Bézier được viết thẳng
 * trong stepBrainState() (đúng đa thức của getBezierPoint() nguồn) và cache toạ độ vào từng hạt,
 * các hàm paint chỉ đọc toạ độ đã cache.
 */

const BRAIN_OUTPUT_COUNT = 12;          // 12 pitch class (nguồn: 7 đường ra)
const BRAIN_NODE_COUNT = 65;            // GIỮ NGUYÊN nguồn
const BRAIN_MESH_LINK_RATIO = 0.75;     // GIỮ NGUYÊN nguồn: nối 2 node nếu cách nhau < rx * 0.75
const BRAIN_PERCEPTION_FLOOR_RATIO = 0.4; // xung "đi tới filter" khi năng lượng vượt fireThreshold*255*0.4 (thấp hơn ngưỡng QUA lọc)
const BRAIN_SPAWN_INTERVAL_SEC = 0.12;  // mỗi dải tối đa ~8 xung/giây — tránh onset liên tục làm đầy trần xung ngay lập tức

/**
 * Dựng toàn bộ layout + trạng thái chạy của style brain. Một lần cho mỗi (kích thước canvas,
 * inputCount) — Workflow so `signature` để biết khi nào phải dựng lại.
 * @param {{x0:number,y0:number,x1:number,y1:number}} rect vùng dùng được (px thiết bị) — Workflow chừa thanh player dưới
 * @param {number} dpr
 * @param {number} inputCount số đường vào = số dải tần (>= 2)
 * @param {string} signature
 * @returns {object} state: {signature, filter, inputPaths, outputPaths, nodes, edges, bands, inflow, outflow, bursts, flash, clock}
 */
function createBrainState(rect, dpr, inputCount, signature) {
    const rectW = rect.x1 - rect.x0, rectH = rect.y1 - rect.y0;
    const flowIsY = rectH > rectW; // khung dọc: dòng chảy đi theo trục Y
    // Hệ số ánh xạ (u dọc dòng chảy, v ngang dòng chảy) -> (x, y) màn hình — không rẽ nhánh sau khi đã chọn hệ số.
    const ux = flowIsY ? 0 : 1, uy = flowIsY ? 1 : 0;
    const vx = flowIsY ? 1 : 0, vy = flowIsY ? 0 : 1;
    const lw = flowIsY ? rectH : rectW; // "width" logic của nguồn (dọc dòng chảy)
    const lh = flowIsY ? rectW : rectH; // "height" logic của nguồn (ngang dòng chảy)

    // Mọi điểm dựng trong hệ logic (x=u, y=v) được gom vào đây rồi ánh xạ ra màn hình 1 lượt ở cuối.
    // MỖI điểm là 1 object RIÊNG (không chia sẻ tham chiếu) — ánh xạ tại chỗ, chia sẻ sẽ bị ánh xạ 2 lần.
    const allPoints = [];
    const leftU = lw * 0.07, rightU = lw * 0.93, centerV = lh * 0.5;
    const filterLogic = { x: lw * 0.54, y: centerV };
    allPoints.push(filterLogic);
    const frx = lw * 0.045, fry = lh * 0.32; // bán trục logic: frx dọc dòng chảy, fry ngang dòng chảy

    // ---- 65 node trong ellipse (GIỮ NGUYÊN công thức nguồn) ----
    const nodes = [];
    for (let i = 0; i < BRAIN_NODE_COUNT; i++) {
        const r = Math.sqrt(Math.random());
        const theta = Math.random() * 2 * Math.PI;
        const pt = {
            x: filterLogic.x + r * Math.cos(theta) * (frx * 0.88),
            y: filterLogic.y + r * Math.sin(theta) * (fry * 0.88),
        };
        allPoints.push(pt);
        nodes.push({ pt, size: (Math.random() * 2 + 1) * dpr, pulse: Math.random() * Math.PI * 2 });
    }

    // ---- Đường vào: nguồn (trái) -> fan Bézier hội tụ lên ellipse (GIỮ NGUYÊN công thức nguồn) ----
    const inputPaths = [];
    for (let i = 0; i < inputCount; i++) {
        const k = i / (inputCount - 1) - 0.5;
        const angle = Math.PI * 0.85 * k;
        const targetV = filterLogic.y + Math.sin(angle) * fry * 0.95;
        const targetU = filterLogic.x - Math.cos(angle) * (frx * 0.5);
        const spread = k * (lh * 0.7);
        const path = {
            p0: { x: leftU, y: centerV },
            p1: { x: leftU + (filterLogic.x - leftU) * 0.35, y: centerV + spread },
            p2: { x: leftU + (filterLogic.x - leftU) * 0.75, y: targetV },
            p3: { x: targetU, y: targetV },
            alpha: Math.random() * 0.15 + 0.1,
        };
        allPoints.push(path.p0, path.p1, path.p2, path.p3);
        inputPaths.push(path);
    }

    // ---- Đường ra: từ ellipse -> người nhận (phải) — thưa (GIỮ NGUYÊN công thức nguồn, 7 -> 12 đường) ----
    const outputPaths = [];
    for (let i = 0; i < BRAIN_OUTPUT_COUNT; i++) {
        const startAngle = Math.PI * 0.6 * (i / (BRAIN_OUTPUT_COUNT - 1) - 0.5);
        const startV = filterLogic.y + Math.sin(startAngle) * (fry * 0.6);
        const startU = filterLogic.x + frx * 0.4;
        const waveFactor = (i % 2 === 0 ? 1 : -1) * (lh * 0.08);
        const path = {
            p0: { x: startU, y: startV },
            p1: { x: startU + (rightU - startU) * 0.35, y: startV + waveFactor },
            p2: { x: startU + (rightU - startU) * 0.7, y: centerV - waveFactor * 0.5 },
            p3: { x: rightU, y: centerV },
        };
        allPoints.push(path.p0, path.p1, path.p2, path.p3);
        outputPaths.push(path);
    }

    // ---- Ánh xạ hệ logic -> màn hình ----
    for (let i = 0; i < allPoints.length; i++) {
        const pt = allPoints[i];
        const u = pt.x, v = pt.y;
        pt.x = rect.x0 + u * ux + v * vx;
        pt.y = rect.y0 + u * uy + v * vy;
    }

    const screenNodes = nodes.map((n) => ({
        x: n.pt.x, y: n.pt.y, baseX: n.pt.x, baseY: n.pt.y, size: n.size, pulse: n.pulse,
    }));

    // ---- Cạnh mesh: tính SẴN 1 lần (nguồn tính lại mỗi frame) — khoảng cách bất biến qua ánh xạ nên dùng bán trục logic frx ----
    const edges = [];
    const linkDist = frx * BRAIN_MESH_LINK_RATIO;
    for (let i = 0; i < screenNodes.length; i++) {
        for (let j = i + 1; j < screenNodes.length; j++) {
            const dx = screenNodes[i].baseX - screenNodes[j].baseX;
            const dy = screenNodes[i].baseY - screenNodes[j].baseY;
            if (Math.sqrt(dx * dx + dy * dy) < linkDist) edges.push([i, j]);
        }
    }

    // ---- Trạng thái từng dải tần — đúng các field mà synapse.js (applyTonotopicSmoothing/
    // computeEffectiveFireThresholdByte/triggerNeuronAdaptation/applyLateralInhibition/decayNeuronState) đọc/ghi ----
    const bands = [];
    for (let i = 0; i < inputCount; i++) {
        bands.push({ smoothedBinEnergy: 0, prevBinEnergy: 0, energy: 0, adaptation: 0, lateralInhibition: 0, cooldown: 0 });
    }

    return {
        signature,
        filter: {
            x: filterLogic.x, y: filterLogic.y,
            rx: flowIsY ? fry : frx, // bán trục theo trục X màn hình
            ry: flowIsY ? frx : fry, // bán trục theo trục Y màn hình
        },
        inputPaths, outputPaths, nodes: screenNodes, edges, bands,
        inflow: [],   // hạt đang bay tới filter
        outflow: [],  // hạt đã QUA lọc, đang bay tới "nhận thức"
        bursts: [],   // tia tan rã ở thành filter
        flash: 0,     // 0..1 — quầng filter sáng lên mỗi khi 1 xung tới đích
        clock: 0,     // giây tích luỹ — nhịp thở vòng ngoài
    };
}

/**
 * Sinh 1 hạt vào trên đường `pathIndex` (kết quả QUA/KHÔNG QUA lọc đã quyết ngay lúc sinh theo
 * ngưỡng hiệu dụng của dải — nguồn quyết bằng Math.random() lúc hạt tới thành filter).
 * @param {object} state @param {number} pathIndex @param {number} speedMult 0.6–1.6 (theo độ mạnh onset)
 * @param {boolean} passes @param {number} outIndex đường ra sẽ đi nếu qua lọc @param {number} size px thiết bị
 */
function spawnBrainInflowParticle(state, pathIndex, speedMult, passes, outIndex, size) {
    state.inflow.push({ pathIndex, t: 0, speed: speedMult, size, glow: 3, passes, outIndex, x: 0, y: 0 });
}

/**
 * 1 bước mô phỏng theo dt: nhịp thở/flash, node lơ lửng, hạt vào/ra bay dọc Bézier (cache toạ độ),
 * tới đích thì QUA lọc -> sinh hạt ra / TAN RÃ -> sinh burst, burst nở ra rồi mờ dần.
 * @param {object} state @param {number} dt giây @param {number} speedFrac phần đường đi được mỗi giây (x speed riêng hạt) @param {number} dpr
 */
function stepBrainState(state, dt, speedFrac, dpr) {
    state.clock += dt;
    state.flash = Math.max(0, state.flash - dt * 2.2);

    // Node lơ lửng (nguồn: pulse += 0.04/frame, biên độ 2px)
    const nodes = state.nodes;
    for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.pulse += 2.4 * dt;
        n.x = n.baseX + Math.sin(n.pulse) * 2 * dpr;
        n.y = n.baseY + Math.cos(n.pulse) * 2 * dpr;
    }

    // Hạt VÀO
    for (let i = state.inflow.length - 1; i >= 0; i--) {
        const p = state.inflow[i];
        const path = state.inputPaths[p.pathIndex];
        p.t += p.speed * speedFrac * dt;
        const tc = Math.min(1, p.t);
        // Đa thức Bézier bậc 3 — đúng getBezierPoint() của nguồn
        const cx = 3 * (path.p1.x - path.p0.x), bx = 3 * (path.p2.x - path.p1.x) - cx, ax = path.p3.x - path.p0.x - cx - bx;
        const cy = 3 * (path.p1.y - path.p0.y), by = 3 * (path.p2.y - path.p1.y) - cy, ay = path.p3.y - path.p0.y - cy - by;
        p.x = ax * tc * tc * tc + bx * tc * tc + cx * tc + path.p0.x;
        p.y = ay * tc * tc * tc + by * tc * tc + cy * tc + path.p0.y;

        if (p.t >= 1) {
            if (p.passes) {
                state.outflow.push({ pathIndex: p.outIndex, t: 0, speed: 1.4, size: 2.8 * dpr, glow: 12 * dpr, x: 0, y: 0 });
            } else {
                state.bursts.push({ x: path.p3.x, y: path.p3.y, radius: (Math.random() * 4 + 2) * dpr, alpha: 0.8 });
            }
            state.inflow.splice(i, 1);
        }
    }

    // Hạt RA
    for (let i = state.outflow.length - 1; i >= 0; i--) {
        const p = state.outflow[i];
        const path = state.outputPaths[p.pathIndex];
        p.t += p.speed * speedFrac * dt;
        const tc = Math.min(1, p.t);
        const cx = 3 * (path.p1.x - path.p0.x), bx = 3 * (path.p2.x - path.p1.x) - cx, ax = path.p3.x - path.p0.x - cx - bx;
        const cy = 3 * (path.p1.y - path.p0.y), by = 3 * (path.p2.y - path.p1.y) - cy, ay = path.p3.y - path.p0.y - cy - by;
        p.x = ax * tc * tc * tc + bx * tc * tc + cx * tc + path.p0.x;
        p.y = ay * tc * tc * tc + by * tc * tc + cy * tc + path.p0.y;

        if (p.t >= 1) { // tới "nhận thức" — quầng filter sáng lên 1 nhịp
            state.flash = Math.min(1, state.flash + 0.35);
            state.outflow.splice(i, 1);
        }
    }

    // Burst tan rã (nguồn: radius += 0.3/frame, alpha -= 0.06/frame)
    for (let i = state.bursts.length - 1; i >= 0; i--) {
        const b = state.bursts[i];
        b.radius += 18 * dpr * dt;
        b.alpha -= 3.6 * dt;
        if (b.alpha <= 0) state.bursts.splice(i, 1);
    }
}

/**
 * Vẽ đường cong: fan đường vào (mờ, sáng lên theo năng lượng dải + nháy khi dải vừa QUA lọc) và
 * các đường ra thưa (đậm hơn, có quầng).
 * @param {CanvasRenderingContext2D} ctx @param {object} state
 * @param {{primary:string,secondary:string,output:string,particle:string}} colors
 * @param {number} glowMult 0..1 @param {number} dpr
 */
function paintBrainCurves(ctx, state, colors, glowMult, dpr) {
    ctx.save();
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = Math.max(1, dpr * 0.8);
    for (let i = 0; i < state.inputPaths.length; i++) {
        const path = state.inputPaths[i];
        const band = state.bands[i];
        ctx.globalAlpha = Math.min(0.9, path.alpha + band.energy * 0.35 + (band.smoothedBinEnergy / 255) * 0.3);
        ctx.beginPath();
        ctx.moveTo(path.p0.x, path.p0.y);
        ctx.bezierCurveTo(path.p1.x, path.p1.y, path.p2.x, path.p2.y, path.p3.x, path.p3.y);
        ctx.stroke();
    }

    ctx.strokeStyle = colors.output;
    for (let i = 0; i < state.outputPaths.length; i++) {
        const path = state.outputPaths[i];
        ctx.beginPath();
        ctx.moveTo(path.p0.x, path.p0.y);
        ctx.bezierCurveTo(path.p1.x, path.p1.y, path.p2.x, path.p2.y, path.p3.x, path.p3.y);
        ctx.globalAlpha = 0.12 * glowMult; // quầng thay shadowBlur=8 của nguồn
        ctx.lineWidth = 7 * dpr;
        ctx.stroke();
        ctx.globalAlpha = 0.65;
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();
    }
    ctx.restore();
}

/**
 * Vẽ hạt vào (mờ dần ở 2 đầu như nguồn), hạt ra (to, sáng) và burst tan rã. Quầng = 1 vòng tròn
 * lớn alpha thấp dưới lõi trắng, thay shadowBlur.
 */
function paintBrainParticles(ctx, state, colors, glowMult, dpr) {
    ctx.save();
    for (let i = 0; i < state.inflow.length; i++) {
        const p = state.inflow[i];
        const alpha = Math.sin(Math.min(1, p.t) * Math.PI);
        ctx.fillStyle = colors.primary;
        ctx.globalAlpha = alpha * 0.28 * glowMult;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3.2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = colors.particle;
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < state.outflow.length; i++) {
        const p = state.outflow[i];
        const alpha = Math.sin(Math.min(1, p.t) * Math.PI);
        ctx.fillStyle = colors.output;
        ctx.globalAlpha = alpha * 0.35 * glowMult;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size + p.glow, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = colors.particle;
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < state.bursts.length; i++) {
        const b = state.bursts[i];
        ctx.fillStyle = colors.primary;
        ctx.globalAlpha = Math.max(0, b.alpha) * 0.3 * glowMult;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius * 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = Math.max(0, b.alpha);
        ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

/**
 * Vẽ "Brain Filter": vòng ngoài + quầng, vòng phụ nhấp nháy, nền gradient, lưới mesh (1 path, 1
 * lần stroke, cạnh tính sẵn) và các node trắng có quầng (gom 1 path mỗi loại).
 */
function paintBrainFilter(ctx, state, colors, glowMult, dpr) {
    const f = state.filter;
    ctx.save();

    // 1. Vòng ngoài + quầng (thay shadowBlur=20 bằng 2 nét rộng alpha thấp) — sáng thêm khi có xung tới đích
    ctx.strokeStyle = colors.primary;
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, Math.PI * 2);
    ctx.globalAlpha = (0.07 + state.flash * 0.12) * glowMult;
    ctx.lineWidth = 14 * dpr;
    ctx.stroke();
    ctx.globalAlpha = (0.16 + state.flash * 0.2) * glowMult;
    ctx.lineWidth = 7 * dpr;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = (3 + state.flash * 1.5) * dpr;
    ctx.stroke();

    // Vòng phụ nhấp nháy (nguồn: 0.4 + sin(time*0.003)*0.2, time = ms)
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.rx * 1.08, f.ry * 1.05, 0, 0, Math.PI * 2);
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = Math.max(1, dpr);
    ctx.globalAlpha = Math.min(1, 0.4 + Math.sin(state.clock * 3) * 0.2 + state.flash * 0.3);
    ctx.stroke();

    // Nền gradient (GIỮ NGUYÊN màu nguồn; bán kính = bán trục lớn để khung dọc/ngang đều phủ hết)
    const fillGrad = ctx.createRadialGradient(f.x, f.y, 5 * dpr, f.x, f.y, Math.max(f.rx, f.ry));
    fillGrad.addColorStop(0, 'rgba(15, 23, 42, 0.7)');
    fillGrad.addColorStop(0.8, 'rgba(30, 41, 59, 0.4)');
    fillGrad.addColorStop(1, 'rgba(56, 189, 248, 0.05)');
    ctx.beginPath();
    ctx.ellipse(f.x, f.y, f.rx, f.ry, 0, 0, Math.PI * 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // 2. Lưới mesh — 1 path cho toàn bộ cạnh
    ctx.beginPath();
    for (let i = 0; i < state.edges.length; i++) {
        const a = state.nodes[state.edges[i][0]], b = state.nodes[state.edges[i][1]];
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
    }
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = Math.max(0.6, dpr * 0.8);
    ctx.stroke();

    // 3. Node: quầng (1 path) rồi lõi trắng (1 path)
    ctx.fillStyle = colors.primary;
    ctx.globalAlpha = 0.22 * glowMult;
    ctx.beginPath();
    for (let i = 0; i < state.nodes.length; i++) {
        const n = state.nodes[i];
        ctx.moveTo(n.x + n.size * 3, n.y);
        ctx.arc(n.x, n.y, n.size * 3, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.fillStyle = colors.particle;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let i = 0; i < state.nodes.length; i++) {
        const n = state.nodes[i];
        ctx.moveTo(n.x + n.size, n.y);
        ctx.arc(n.x, n.y, n.size, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.restore();
}
