/**
 * core/visualizer/groups/connector/brain.js — style "brain" (Brain Filter) của group connector.
 *
 * BÊ NGUYÊN phần canvas của Brain_Filter_Perception_Visualization.html — thân các hàm/hằng số dưới đây là
 * bản sao NGUYÊN VĂN từ file gốc (initNodesAndPaths, createParticle, getBezierPoint,
 * drawLabelsAndTimeline, drawBrainFilter, drawCurvesAndParticles, triggerBurst): vẫn chạy tự do bằng
 * Math.random() (không nối audio), shadowBlur như gốc. BỎ vì không thuộc phần canvas: header/toolbar/
 * settings/banner/footer, listener nút bấm/slider/pointer.
 * Chỉ thêm phần KEO tối thiểu để chạy được trong SAV: đóng gói trong 1 object (tránh đè các global
 * cùng tên của SAV như canvas/ctx/resizeCanvas/config), và draw() thay cho resizeCanvas()+animate()
 * (SAV đã tự clear canvas + tự gọi mỗi frame, canvas do SAV set kích thước).
 *
 * SỬA (22/09/2026, yêu cầu Giang "màu theo 3 chế độ color của app") — bảng `themes` gốc (3 theme cố
 * định cyan/violet/gold, chọn qua `config.theme`) đã BỎ HẲN, đây là điểm DUY NHẤT lệch khỏi "verbatim,
 * không tự đổi" ban đầu. Toàn bộ màu (kể cả các chỗ trắng cố định '#ffffff' ở filter node/hạt input/
 * hạt output — gốc dùng trắng cố định bất kể theme) nay lấy từ hệ mode màu CHUNG của app (Custom
 * Effect group 'connector': solid/dynamic/gradient, `getComputedColor()`, core/audio-analysis.js) —
 * cùng hệ mà synapse.js/circuit.js đang dùng, đổi mode ở Element Style là thấy ngay (gọi lại mỗi
 * frame, không bake). Xem `getBrainRoleColor()` ở phần KEO cuối file. Không có audio thật (hiệu ứng
 * này vẫn free-running Math.random) nên dataValue truyền cố định — chỉ ảnh hưởng mode 'gradient'.
 * Giữ NGUYÊN, không đụng: nền gradient tối bên trong ellipse (chủ yếu slate trung tính, chỉ 1 stop
 * cuối tint cyan rất nhẹ 5% alpha — không convert an toàn được vì `.fill` có thể là hex/rgb()/hsla()
 * tuỳ mode, không tách alpha bằng string được) và màu chữ nhãn/trục thời gian (trắng/xám cố định,
 * gốc y hệt ở cả 3 theme cũ — không thuộc bộ nhận diện màu của connector).
 */
const brainFilterOriginal = (function () {
        let canvas = null;
        let ctx = null;

        // App State (gốc: đọc từ slider — giữ đúng giá trị mặc định của gốc)
        let isPaused = false;
        let config = {
            signalCount: 120,
            filterStrictness: 98 / 100,
            speedMultiplier: 1.5
        };

        // KEO (22/09/2026) — 3 vai trò màu trong hình vẽ (trước là field của bảng themes cyan/
        // violet/gold): primary (viền/mesh/tia lửa/hạt input), secondary (viền phụ mờ), outputLine
        // (đường + hạt output). Lấy từ hệ mode màu chung của app qua getComputedColor() (core/
        // audio-analysis.js, global — nạp trước file này) thay vì bảng cố định. roleIndex/3 chỉ để
        // 3 vai trò tách hue nhau ở mode 'gradient' (mode 'solid'/'dynamic' vốn không đổi theo
        // index nên cả 3 vai trò cùng 1 màu — đúng ý "1 màu đồng bộ" của 2 mode đó). dataValue
        // truyền cố định (không có audio thật) — chỉ mode 'gradient' đọc field này để lệch hue nhẹ.
        const BRAIN_COLOR_DATA_VALUE = 128;
        function getBrainRoleColor(roleIndex) {
            return getComputedColor(roleIndex, 3, BRAIN_COLOR_DATA_VALUE); // { fill, fillNoAlpha, glow }
        }

        let width, height;
        // KEO (22/09/2026, Giang báo "chiều ngang nhưng bị kéo giãn ra") — bản gốc là trang
        // landscape rộng (height nhỏ hơn width nhiều) nên mọi công thức `height * tỉ lệ` ra hình
        // cân đối; canvas SAV luôn full màn hình THẬT của máy (core/canvas-scene-setup.js), trên
        // điện thoại là PORTRAIT (height > width nhiều) -> dùng thẳng height thật làm ellipse/toả
        // tia bị kéo cao bất thường. Sửa: `stageH` = chiều cao DÙNG ĐỂ TÍNH layout, giới hạn theo
        // tỉ lệ cố định với width (không bao giờ vượt quá height thật — landscape/tablet không đổi
        // gì), `stageOffsetY` căn dải đó vào giữa theo chiều dọc màn hình thật. Mọi `height * X` cũ
        // (vị trí/kích thước dọc) đổi thành `stageOffsetY + stageH * X`.
        const BRAIN_STAGE_ASPECT = 0.5625; // 16:9 — landscape phổ biến, gần đúng tỉ lệ trang gốc
        let stageH = 0, stageOffsetY = 0;
        let leftPersonPos = { x: 0, y: 0 };
        let rightPersonPos = { x: 0, y: 0 };
        let filterPos = { x: 0, y: 0, rx: 0, ry: 0 };

        let inputPaths = [];
        let outputPaths = [];
        let particles = [];
        let filterNodes = [];
        let bursts = [];


        function initNodesAndPaths() {
            inputPaths = [];
            outputPaths = [];
            particles = [];
            filterNodes = [];

            // Generate Filter Internal Neural Network Nodes inside ellipse
            const nodeCount = 65;
            for (let i = 0; i < nodeCount; i++) {
                // Random point inside ellipse
                let u = Math.random();
                let v = Math.random();
                let r = Math.sqrt(u);
                let theta = v * 2 * Math.PI;
                let nx = filterPos.x + r * Math.cos(theta) * (filterPos.rx * 0.88);
                let ny = filterPos.y + r * Math.sin(theta) * (filterPos.ry * 0.88);

                filterNodes.push({
                    x: nx,
                    y: ny,
                    baseX: nx,
                    baseY: ny,
                    vx: (Math.random() - 0.5) * 0.3,
                    vy: (Math.random() - 0.5) * 0.3,
                    size: Math.random() * 2 + 1,
                    pulse: Math.random() * Math.PI * 2
                });
            }

            // Generate Input Signal Bezier Curves (Fan Out from human source -> converge onto filter ellipse)
            for (let i = 0; i < config.signalCount; i++) {
                // Target angle on filter boundary
                let angle = (Math.PI * 0.85) * (i / (config.signalCount - 1) - 0.5); // spread vertical angle
                let targetY = filterPos.y + Math.sin(angle) * filterPos.ry * 0.95;
                let targetX = filterPos.x - Math.cos(angle) * (filterPos.rx * 0.5);

                // Control points for organic flowing curves
                let spread = (i / (config.signalCount - 1) - 0.5) * (stageH * 0.7);
                let cp1x = leftPersonPos.x + (filterPos.x - leftPersonPos.x) * 0.35;
                let cp1y = leftPersonPos.y + spread;
                let cp2x = leftPersonPos.x + (filterPos.x - leftPersonPos.x) * 0.75;
                let cp2y = targetY;

                inputPaths.push({
                    p0: { x: leftPersonPos.x, y: leftPersonPos.y },
                    p1: { x: cp1x, y: cp1y },
                    p2: { x: cp2x, y: cp2y },
                    p3: { x: targetX, y: targetY },
                    alpha: Math.random() * 0.15 + 0.1
                });

                // Spawn initial floating particles on path
                particles.push(createParticle(i, true));
            }

            // Generate Output Curves (Only a few sparse events reach awareness!)
            const outputCount = 7;
            for (let i = 0; i < outputCount; i++) {
                let startAngle = (Math.PI * 0.6) * (i / (outputCount - 1) - 0.5);
                let startY = filterPos.y + Math.sin(startAngle) * (filterPos.ry * 0.6);
                let startX = filterPos.x + filterPos.rx * 0.4;

                let waveFactor = (i % 2 === 0 ? 1 : -1) * (stageH * 0.08);
                let cp1x = startX + (rightPersonPos.x - startX) * 0.35;
                let cp1y = startY + waveFactor;
                let cp2x = startX + (rightPersonPos.x - startX) * 0.7;
                let cp2y = rightPersonPos.y - waveFactor * 0.5;

                outputPaths.push({
                    p0: { x: startX, y: startY },
                    p1: { x: cp1x, y: cp1y },
                    p2: { x: cp2x, y: cp2y },
                    p3: { x: rightPersonPos.x, y: rightPersonPos.y }
                });
            }
        }

        function createParticle(pathIndex, isInput = true) {
            return {
                pathIndex: pathIndex,
                isInput: isInput,
                t: Math.random(), // position along curve [0..1]
                speed: (Math.random() * 0.003 + 0.002),
                size: isInput ? Math.random() * 1.8 + 1 : Math.random() * 2.5 + 2,
                glow: isInput ? 3 : 8
            };
        }

        // Compute 2D Cubic Bezier point
        function getBezierPoint(p, t) {
            let cx = 3 * (p.p1.x - p.p0.x);
            let bx = 3 * (p.p2.x - p.p1.x) - cx;
            let ax = p.p3.x - p.p0.x - cx - bx;

            let cy = 3 * (p.p1.y - p.p0.y);
            let by = 3 * (p.p2.y - p.p1.y) - cy;
            let ay = p.p3.y - p.p0.y - cy - by;

            let xt = ax * Math.pow(t, 3) + bx * Math.pow(t, 2) + cx * t + p.p0.x;
            let yt = ay * Math.pow(t, 3) + by * Math.pow(t, 2) + cy * t + p.p0.y;

            return { x: xt, y: yt };
        }

        function drawLabelsAndTimeline() {
            ctx.save();
            
            // Scaled Font setup
            let fontBase = Math.max(10, Math.round(width * 0.012));
            ctx.textAlign = 'center';

            // 1. Left Label: 1000000 INFORMATION SIGNALS
            ctx.font = `700 ${fontBase * 1.1}px 'Space Grotesk', sans-serif`;
            ctx.fillStyle = '#f8fafc';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText("1000000", leftPersonPos.x + width * 0.08, stageOffsetY + stageH * 0.18);
            ctx.font = `600 ${fontBase * 0.85}px 'Space Grotesk', sans-serif`;
            ctx.fillStyle = '#94a3b8';
            ctx.fillText("INFORMATION SIGNALS", leftPersonPos.x + width * 0.08, stageOffsetY + stageH * 0.18 + fontBase * 1.2);

            // 2. Middle Label: BRAIN FILTER
            ctx.font = `700 ${fontBase * 1.05}px 'Space Grotesk', sans-serif`;
            ctx.fillStyle = '#f8fafc';
            ctx.fillText("BRAIN FILTER", filterPos.x, filterPos.y - filterPos.ry - fontBase * 1.2);

            // 3. Right Label: ONLY A FEW EVENTS REACH YOUR AWARENESS
            ctx.font = `700 ${fontBase * 1.05}px 'Space Grotesk', sans-serif`;
            ctx.fillStyle = '#f8fafc';
            ctx.fillText("ONLY A FEW EVENTS", rightPersonPos.x - width * 0.06, stageOffsetY + stageH * 0.18);
            ctx.font = `600 ${fontBase * 0.85}px 'Space Grotesk', sans-serif`;
            ctx.fillStyle = '#94a3b8';
            ctx.fillText("REACH YOUR AWARENESS", rightPersonPos.x - width * 0.06, stageOffsetY + stageH * 0.18 + fontBase * 1.2);

            // 4. Bottom Axis Timeline Line
            let axisY = stageOffsetY + stageH * 0.88;
            ctx.strokeStyle = '#334155';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(leftPersonPos.x, axisY);
            ctx.lineTo(rightPersonPos.x, axisY);
            ctx.stroke();
            ctx.setLineDash([]); // reset line dash

            // Timeline Node Points & Arrows
            let axisNodes = [leftPersonPos.x, filterPos.x, rightPersonPos.x];
            axisNodes.forEach(nx => {
                ctx.beginPath();
                ctx.arc(nx, axisY, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#94a3b8';
                ctx.fill();
            });

            // Right Arrow head on Timeline
            ctx.beginPath();
            ctx.moveTo(rightPersonPos.x - 6, axisY - 4);
            ctx.lineTo(rightPersonPos.x, axisY);
            ctx.lineTo(rightPersonPos.x - 6, axisY + 4);
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 2;
            ctx.stroke();

            ctx.restore();
        }

        function drawBrainFilter(time) {
            const primary = getBrainRoleColor(0);
            const secondary = getBrainRoleColor(1);
            ctx.save();

            // 1. Outer Glowing Ellipse Aura
            ctx.beginPath();
            ctx.ellipse(filterPos.x, filterPos.y, filterPos.rx, filterPos.ry, 0, 0, Math.PI * 2);
            ctx.strokeStyle = primary.fill;
            ctx.lineWidth = 3;
            ctx.shadowColor = primary.glow;
            ctx.shadowBlur = 20;
            ctx.stroke();

            // Secondary subtle outer ring
            ctx.beginPath();
            ctx.ellipse(filterPos.x, filterPos.y, filterPos.rx * 1.08, filterPos.ry * 1.05, 0, 0, Math.PI * 2);
            ctx.strokeStyle = secondary.fill;
            ctx.lineWidth = 1;
            ctx.globalAlpha = 0.4 + Math.sin(time * 0.003) * 0.2;
            ctx.stroke();

            // Fill Ellipse background gradient
            let fillGrad = ctx.createRadialGradient(
                filterPos.x, filterPos.y, 5,
                filterPos.x, filterPos.y, filterPos.ry
            );
            fillGrad.addColorStop(0, 'rgba(15, 23, 42, 0.7)');
            fillGrad.addColorStop(0.8, 'rgba(30, 41, 59, 0.4)');
            fillGrad.addColorStop(1, 'rgba(56, 189, 248, 0.05)');
            ctx.fillStyle = fillGrad;
            ctx.fill();

            // 2. Draw Connections between internal filter nodes (Neural Mesh)
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = primary.fill;
            ctx.lineWidth = 0.8;
            for (let i = 0; i < filterNodes.length; i++) {
                for (let j = i + 1; j < filterNodes.length; j++) {
                    let dx = filterNodes[i].x - filterNodes[j].x;
                    let dy = filterNodes[i].y - filterNodes[j].y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < filterPos.rx * 0.75) {
                        ctx.beginPath();
                        ctx.moveTo(filterNodes[i].x, filterNodes[i].y);
                        ctx.lineTo(filterNodes[j].x, filterNodes[j].y);
                        ctx.stroke();
                    }
                }
            }

            // 3. Update & Draw Neural Filter Nodes
            ctx.globalAlpha = 0.9;
            filterNodes.forEach(node => {
                // Slight floating motion
                node.pulse += 0.04;
                node.x = node.baseX + Math.sin(node.pulse) * 2;
                node.y = node.baseY + Math.cos(node.pulse) * 2;

                ctx.beginPath();
                ctx.arc(node.x, node.y, node.size, 0, Math.PI * 2);
                ctx.fillStyle = primary.glow; // trước trắng cố định — nay theo màu app (Giang: "chuyển hết")
                ctx.shadowColor = primary.glow;
                ctx.shadowBlur = 6;
                ctx.fill();
            });

            ctx.restore();
        }

        function drawCurvesAndParticles(time) {
            const primary = getBrainRoleColor(0);
            const outputLine = getBrainRoleColor(2);

            // 1. Draw Dense Input Bezier Curves (Left -> Filter)
            ctx.save();
            inputPaths.forEach((path, idx) => {
                ctx.beginPath();
                ctx.moveTo(path.p0.x, path.p0.y);
                ctx.bezierCurveTo(path.p1.x, path.p1.y, path.p2.x, path.p2.y, path.p3.x, path.p3.y);
                ctx.strokeStyle = primary.fill;
                ctx.globalAlpha = path.alpha;
                ctx.lineWidth = 1;
                ctx.stroke();
            });
            ctx.restore();

            // 2. Draw Sparse Output Bezier Curves (Filter -> Right)
            ctx.save();
            outputPaths.forEach(path => {
                ctx.beginPath();
                ctx.moveTo(path.p0.x, path.p0.y);
                ctx.bezierCurveTo(path.p1.x, path.p1.y, path.p2.x, path.p2.y, path.p3.x, path.p3.y);
                ctx.strokeStyle = outputLine.fill;
                ctx.globalAlpha = 0.65;
                ctx.lineWidth = 2;
                ctx.shadowColor = outputLine.glow;
                ctx.shadowBlur = 8;
                ctx.stroke();
            });
            ctx.restore();

            // 3. Update & Render Flowing Particles
            ctx.save();
            for (let i = particles.length - 1; i >= 0; i--) {
                let p = particles[i];
                if (!isPaused) {
                    p.t += p.speed * config.speedMultiplier;
                }

                if (p.isInput) {
                    let path = inputPaths[p.pathIndex];
                    if (!path) continue;

                    let pt = getBezierPoint(path, p.t);

                    // Render input particle
                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = primary.glow; // trước currentTheme.particle (trắng cố định ở cả 3 theme gốc)
                    ctx.shadowColor = primary.glow;
                    ctx.shadowBlur = p.glow;
                    ctx.globalAlpha = Math.sin(p.t * Math.PI); // Smooth fade-in/fade-out
                    ctx.fill();

                    // When particle hits the Brain Filter boundary (t >= 1)
                    if (p.t >= 1) {
                        // Filter logic: strictness determines how many get blocked
                        let passFilter = Math.random() > config.filterStrictness;

                        if (passFilter) {
                            // Passed through brain filter! Spawn output particle
                            let randomOutIdx = Math.floor(Math.random() * outputPaths.length);
                            particles.push({
                                pathIndex: randomOutIdx,
                                isInput: false,
                                t: 0,
                                speed: Math.random() * 0.004 + 0.003,
                                size: 2.8,
                                glow: 12
                            });
                        } else {
                            // Dissolved/Filtered out! Spawn micro burst spark
                            bursts.push({
                                x: pt.x,
                                y: pt.y,
                                radius: Math.random() * 4 + 2,
                                alpha: 0.8,
                                color: primary.glow
                            });
                        }

                        // Reset input particle to start again
                        p.t = 0;
                        p.speed = Math.random() * 0.003 + 0.002;
                    }
                } else {
                    // Output Particle moving towards right awareness
                    let path = outputPaths[p.pathIndex];
                    if (!path) continue;

                    let pt = getBezierPoint(path, p.t);

                    ctx.beginPath();
                    ctx.arc(pt.x, pt.y, p.size, 0, Math.PI * 2);
                    ctx.fillStyle = outputLine.glow; // trước trắng cố định — nay theo màu app
                    ctx.shadowColor = outputLine.glow;
                    ctx.shadowBlur = p.glow;
                    ctx.globalAlpha = Math.sin(p.t * Math.PI);
                    ctx.fill();

                    if (p.t >= 1) {
                        // Reached awareness figure!
                        particles.splice(i, 1);
                    }
                }
            }
            ctx.restore();

            // 4. Render Dissolve Spark Bursts at Filter Wall
            ctx.save();
            for (let b = bursts.length - 1; b >= 0; b--) {
                let burst = bursts[b];
                ctx.beginPath();
                ctx.arc(burst.x, burst.y, burst.radius, 0, Math.PI * 2);
                ctx.fillStyle = burst.color;
                ctx.globalAlpha = burst.alpha;
                ctx.shadowColor = burst.color;
                ctx.shadowBlur = 6;
                ctx.fill();

                if (!isPaused) {
                    burst.radius += 0.3;
                    burst.alpha -= 0.06;
                }

                if (burst.alpha <= 0) {
                    bursts.splice(b, 1);
                }
            }
            ctx.restore();
        }
        // Interactive Signal Burst on Click or Touch
        function triggerBurst(clickX, clickY) {
            // Spawn temporary burst of signals from left person
            for (let i = 0; i < 25; i++) {
                let randomInputIdx = Math.floor(Math.random() * inputPaths.length);
                particles.push({
                    pathIndex: randomInputIdx,
                    isInput: true,
                    t: 0,
                    speed: Math.random() * 0.008 + 0.005,
                    size: Math.random() * 2.5 + 1.5,
                    glow: 8
                });
            }
        }

        // ===== Phần KEO (không có trong gốc) =====
        let _lastW = 0, _lastH = 0;

        // Thân = phần tính vị trí của resizeCanvas() gốc (nguyên văn), chỉ bỏ dòng set canvas.width/height
        // vì SAV đã set kích thước canvas.
        function _layoutFromCanvas() {
            width = canvas.width;
            height = canvas.height;
            stageH = Math.min(height, width * BRAIN_STAGE_ASPECT);
            stageOffsetY = (height - stageH) / 2;

            // Compute positions based on dimensions
            leftPersonPos = { x: width * 0.07, y: stageOffsetY + stageH * 0.5 };
            rightPersonPos = { x: width * 0.93, y: stageOffsetY + stageH * 0.5 };
            
            filterPos = {
                x: width * 0.54,
                y: stageOffsetY + stageH * 0.5,
                rx: width * 0.045,
                ry: stageH * 0.32
            };

            initNodesAndPaths();
        }

        // Thay animate(time) gốc: bỏ clearRect (SAV đã clear) và requestAnimationFrame (SAV tự gọi mỗi frame).
        function draw(ctxArg, canvasEl, time) {
            ctx = ctxArg;
            canvas = canvasEl;
            if (canvas.width !== _lastW || canvas.height !== _lastH) {
                _lastW = canvas.width; _lastH = canvas.height;
                _layoutFromCanvas();
            }
            drawLabelsAndTimeline();
            drawCurvesAndParticles(time);
            drawBrainFilter(time);
        }

        return { draw, triggerBurst };
})();
