/**
 * core/visualizer/groups/connector/brain.js — style "brain" (Brain Filter) của group connector.
 *
 * BÊ NGUYÊN phần canvas của Brain_Filter_Perception_Visualization.html — thân các hàm/hằng số dưới đây là
 * bản sao NGUYÊN VĂN từ file gốc (themes, initNodesAndPaths, createParticle, getBezierPoint,
 * drawLabelsAndTimeline, drawBrainFilter, drawCurvesAndParticles, triggerBurst), KHÔNG chỉnh gì:
 * vẫn chạy tự do bằng Math.random() (không nối audio), theme cố định 'cyan', shadowBlur như gốc.
 * Chỉ thêm phần KEO tối thiểu để chạy được trong SAV: đóng gói trong 1 object (tránh đè các global
 * cùng tên của SAV như canvas/ctx/resizeCanvas/config), và draw() thay cho resizeCanvas()+animate()
 * (SAV đã tự clear canvas + tự gọi mỗi frame, canvas do SAV set kích thước).
 * BỎ vì không thuộc phần canvas: header/toolbar/settings/banner/footer, listener nút bấm/slider/pointer.
 */
const brainFilterOriginal = (function () {
        let canvas = null;
        let ctx = null;

        // App State (gốc: đọc từ slider — giữ đúng giá trị mặc định của gốc)
        let isPaused = false;
        let config = {
            signalCount: 120,
            filterStrictness: 98 / 100,
            speedMultiplier: 1.5,
            theme: 'cyan'
        };

        // Theme colors configurations
        const themes = {
            cyan: {
                primary: '#38bdf8',
                secondary: '#818cf8',
                accent: '#c084fc',
                filterGlow: 'rgba(56, 189, 248, 0.4)',
                lineAlpha: 0.18,
                particle: '#ffffff',
                outputLine: '#60a5fa'
            },
            violet: {
                primary: '#c084fc',
                secondary: '#f472b6',
                accent: '#38bdf8',
                filterGlow: 'rgba(192, 132, 252, 0.4)',
                lineAlpha: 0.18,
                particle: '#ffffff',
                outputLine: '#e879f9'
            },
            gold: {
                primary: '#fbbf24',
                secondary: '#f97316',
                accent: '#38bdf8',
                filterGlow: 'rgba(251, 191, 36, 0.4)',
                lineAlpha: 0.18,
                particle: '#ffffff',
                outputLine: '#fde047'
            }
        };

        let width, height;
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
                let spread = (i / (config.signalCount - 1) - 0.5) * (height * 0.7);
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

                let waveFactor = (i % 2 === 0 ? 1 : -1) * (height * 0.08);
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
            const currentTheme = themes[config.theme];
            ctx.save();
            
            // Scaled Font setup
            let fontBase = Math.max(10, Math.round(width * 0.012));
            ctx.textAlign = 'center';

            // 1. Left Label: 1000000 INFORMATION SIGNALS
            ctx.font = `700 ${fontBase * 1.1}px 'Space Grotesk', sans-serif`;
            ctx.fillStyle = '#f8fafc';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText("1000000", leftPersonPos.x + width * 0.08, height * 0.18);
            ctx.font = `600 ${fontBase * 0.85}px 'Space Grotesk', sans-serif`;
            ctx.fillStyle = '#94a3b8';
            ctx.fillText("INFORMATION SIGNALS", leftPersonPos.x + width * 0.08, height * 0.18 + fontBase * 1.2);

            // 2. Middle Label: BRAIN FILTER
            ctx.font = `700 ${fontBase * 1.05}px 'Space Grotesk', sans-serif`;
            ctx.fillStyle = '#f8fafc';
            ctx.fillText("BRAIN FILTER", filterPos.x, filterPos.y - filterPos.ry - fontBase * 1.2);

            // 3. Right Label: ONLY A FEW EVENTS REACH YOUR AWARENESS
            ctx.font = `700 ${fontBase * 1.05}px 'Space Grotesk', sans-serif`;
            ctx.fillStyle = '#f8fafc';
            ctx.fillText("ONLY A FEW EVENTS", rightPersonPos.x - width * 0.06, height * 0.18);
            ctx.font = `600 ${fontBase * 0.85}px 'Space Grotesk', sans-serif`;
            ctx.fillStyle = '#94a3b8';
            ctx.fillText("REACH YOUR AWARENESS", rightPersonPos.x - width * 0.06, height * 0.18 + fontBase * 1.2);

            // 4. Bottom Axis Timeline Line
            let axisY = height * 0.88;
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
            const currentTheme = themes[config.theme];
            ctx.save();

            // 1. Outer Glowing Ellipse Aura
            ctx.beginPath();
            ctx.ellipse(filterPos.x, filterPos.y, filterPos.rx, filterPos.ry, 0, 0, Math.PI * 2);
            ctx.strokeStyle = currentTheme.primary;
            ctx.lineWidth = 3;
            ctx.shadowColor = currentTheme.primary;
            ctx.shadowBlur = 20;
            ctx.stroke();

            // Secondary subtle outer ring
            ctx.beginPath();
            ctx.ellipse(filterPos.x, filterPos.y, filterPos.rx * 1.08, filterPos.ry * 1.05, 0, 0, Math.PI * 2);
            ctx.strokeStyle = currentTheme.secondary;
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
            ctx.strokeStyle = currentTheme.primary;
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
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = currentTheme.primary;
                ctx.shadowBlur = 6;
                ctx.fill();
            });

            ctx.restore();
        }

        function drawCurvesAndParticles(time) {
            const currentTheme = themes[config.theme];

            // 1. Draw Dense Input Bezier Curves (Left -> Filter)
            ctx.save();
            inputPaths.forEach((path, idx) => {
                ctx.beginPath();
                ctx.moveTo(path.p0.x, path.p0.y);
                ctx.bezierCurveTo(path.p1.x, path.p1.y, path.p2.x, path.p2.y, path.p3.x, path.p3.y);
                ctx.strokeStyle = currentTheme.primary;
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
                ctx.strokeStyle = currentTheme.outputLine;
                ctx.globalAlpha = 0.65;
                ctx.lineWidth = 2;
                ctx.shadowColor = currentTheme.outputLine;
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
                    ctx.fillStyle = currentTheme.particle;
                    ctx.shadowColor = currentTheme.primary;
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
                                color: currentTheme.primary
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
                    ctx.fillStyle = '#ffffff';
                    ctx.shadowColor = currentTheme.outputLine;
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

            // Compute positions based on dimensions
            leftPersonPos = { x: width * 0.07, y: height * 0.5 };
            rightPersonPos = { x: width * 0.93, y: height * 0.5 };
            
            filterPos = {
                x: width * 0.54,
                y: height * 0.5,
                rx: width * 0.045,
                ry: height * 0.32
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
