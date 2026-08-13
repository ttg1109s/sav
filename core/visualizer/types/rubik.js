/**
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
 */
        function drawRubik(ctx, perf, isPlaying) {
            const dpr = appState.get('dpr');
            const smoothedEnergy = appState.get('smoothedEnergy');
            const beatScale = appState.get('beatScale');
            const vizDataArray = appState.get('vizDataArray');
            // ----- Kiểu 1: xoay tự thân theo pitch (nhanh/chậm so với pha trung bình động) -----
            const currentMidi = appState.get('lastValidMidiNote');
            // Hệ số tốc độ: 1.0 = trung bình (giống tốc độ gốc); >1 khi nốt cao hơn pha, <1 khi thấp
            // hơn pha. Lệch tối đa quy về ±12 nửa cung (1 quãng tám) để hệ số không vọt quá đà.
            let pitchSpeedFactor = 1;
            const rubikPitchAvg = appState.get('rubikPitchAvg');
            if (isPlaying && currentMidi != null && rubikPitchAvg > 0) {
                const semitoneDiff = Math.max(-12, Math.min(12, currentMidi - rubikPitchAvg));
                pitchSpeedFactor = 1 + (semitoneDiff / 12) * 0.9; // dao động khoảng 0.25x .. 1.75x
            }
            const selfSpinBase = isPlaying ? (0.01 + smoothedEnergy * 0.025) * pitchSpeedFactor : 0.003;
            rubikRotY += selfSpinBase * rubikSelfSpinDirY;
            rubikRotX += selfSpinBase * 0.6 * rubikSelfSpinDirX;

            // ----- Kiểu 2: xoay lớp theo nốt cụ thể (map cố định, không random) -----
            if (!rubikAnim.active && isPlaying && smoothedEnergy > 0.35 && currentMidi != null) {
                const noteIdx = ((currentMidi % 12) + 12) % 12;
                if (noteIdx !== rubikLastTurnNote) {
                    const turn = RUBIK_NOTE_TO_TURN[noteIdx];
                    rubikAnim.axis = turn.axis; rubikAnim.layer = turn.layer;
                    // Hướng xoay theo nốt cao hơn hay thấp hơn pha — nốt cao quay 1 chiều, thấp quay chiều ngược.
                    rubikAnim.dir = (currentMidi >= rubikPitchAvg) ? 1 : -1;
                    rubikAnim.angle = 0; rubikAnim.active = true; rubikLastTurnNote = noteIdx;
                }
            }
            if (rubikAnim.active) { rubikAnim.angle += 0.08 * (1 + smoothedEnergy * 2); if (rubikAnim.angle >= Math.PI / 2) { rubikAnim.angle = Math.PI / 2; rotateRubikIndices(rubikAnim.axis, rubikAnim.layer, rubikAnim.dir); rubikAnim.active = false; rubikAnim.angle = 0; } }

            const cubeSize = Math.min(canvas.width, canvas.height) * 0.08; const spacing = cubeSize * 1.05; const viewDist = cubeSize * 25; const fov = cubeSize * 18; 
            const unitVertices = [{x:-0.5,y:-0.5,z:-0.5}, {x:0.5,y:-0.5,z:-0.5}, {x:0.5,y:0.5,z:-0.5}, {x:-0.5,y:0.5,z:-0.5}, {x:-0.5,y:-0.5,z:0.5}, {x:0.5,y:-0.5,z:0.5}, {x:0.5,y:0.5,z:0.5}, {x:-0.5,y:0.5,z:0.5}];
            const faces = [ [0,1,2,3], [1,5,6,2], [5,4,7,6], [4,0,3,7], [3,2,6,7], [4,5,1,0] ]; let drawnCubes = [];
            const centerX = canvas.width / 2, centerY = canvas.height / 2;
            const rubikCubes = appState.get('rubikCubes');
            for(let i=0; i<rubikCubes.length; i++) {
                let rc = rubikCubes[i]; let val = vizDataArray[rc.binIdx * 4] || 0;
                // Phóng to/thu nhỏ NGAY TẠI TÂM RIÊNG của mảnh: kết hợp biên độ tần số riêng (val,
                // mỗi mảnh một bin khác nhau -> phản ứng khác nhau) VỚI cú đập beat chung
                // (beatScale) để toàn khối vẫn "thở" đồng bộ theo nhịp, không chỉ lắc lư rời rạc.
                let scaleBounce = 1 + (val / 255) * 0.4 + (isPlaying ? beatScale * 0.25 : 0);
                let extraDist = (val / 255) * cubeSize * 1.2 * (isPlaying ? 1 : 0); 
                let lx = rc.cx * spacing + Math.sign(rc.cx) * extraDist; let ly = rc.cy * spacing + Math.sign(rc.cy) * extraDist; let lz = rc.cz * spacing + Math.sign(rc.cz) * extraDist; let pos = {x: lx, y: ly, z: lz};
                if (rubikAnim.active && rc['c' + rubikAnim.axis] === rubikAnim.layer) {
                    let currentRot = rubikAnim.angle * rubikAnim.dir;
                    if (rubikAnim.axis === 'x') pos = rotate3D(pos, currentRot, 0, 0); if (rubikAnim.axis === 'y') pos = rotate3D(pos, 0, currentRot, 0); if (rubikAnim.axis === 'z') pos = rotate3D(pos, 0, 0, currentRot);
                }
                let cCenter = rotate3D(pos, rubikRotX, rubikRotY, 0); drawnCubes.push({ rc: rc, centerZ: cCenter.z, val: val, pos: pos, scale: scaleBounce });
            }
            drawnCubes.sort((a, b) => b.centerZ - a.centerZ); 
            for(let i=0; i<drawnCubes.length; i++) {
                let c = drawnCubes[i]; let colors = getComputedColor(c.rc.binIdx, 27, c.val); let projVerts = []; 
                for(let v=0; v<8; v++) {
                    let uv = unitVertices[v]; let vx = c.pos.x + uv.x * cubeSize * c.scale; let vy = c.pos.y + uv.y * cubeSize * c.scale; let vz = c.pos.z + uv.z * cubeSize * c.scale; let vertPos = {x: vx, y: vy, z: vz};
                    if (rubikAnim.active && c.rc['c' + rubikAnim.axis] === rubikAnim.layer) {
                        let currentRot = rubikAnim.angle * rubikAnim.dir; vertPos.x -= c.pos.x; vertPos.y -= c.pos.y; vertPos.z -= c.pos.z;
                        if (rubikAnim.axis === 'x') vertPos = rotate3D(vertPos, currentRot, 0, 0); if (rubikAnim.axis === 'y') vertPos = rotate3D(vertPos, 0, currentRot, 0); if (rubikAnim.axis === 'z') vertPos = rotate3D(vertPos, 0, 0, currentRot);
                        vertPos.x += c.pos.x; vertPos.y += c.pos.y; vertPos.z += c.pos.z;
                    }
                    let rotV = rotate3D(vertPos, rubikRotX, rubikRotY, 0); projVerts.push(project3D(rotV, fov, viewDist, centerX, centerY));
                }
                ctx.lineWidth = 1.5 * dpr; ctx.lineJoin = 'round';
                for(let f=0; f<6; f++) {
                    let face = faces[f]; let p0 = projVerts[face[0]], p1 = projVerts[face[1]], p2 = projVerts[face[2]];
                    let dx1 = p1.x - p0.x, dy1 = p1.y - p0.y; let dx2 = p2.x - p1.x, dy2 = p2.y - p1.y; let crossZ = dx1 * dy2 - dy1 * dx2;
                    if (crossZ > 0) { 
                        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); for(let vIdx=1; vIdx<4; vIdx++) ctx.lineTo(projVerts[face[vIdx]].x, projVerts[face[vIdx]].y); ctx.closePath();
                        let lightFactor = 0.5 + (f * 0.1); ctx.fillStyle = colors.fill; ctx.globalAlpha = 0.8 * lightFactor; ctx.fill(); ctx.globalAlpha = 1.0; ctx.strokeStyle = '#000000'; ctx.stroke();
                    }
                }
                if (c.val > 200 && perf.blurMult > 0) {
                    ctx.shadowBlur = 15 * dpr * perf.blurMult; ctx.shadowColor = colors.glow;
                    for(let f=0; f<6; f++) {
                        let face = faces[f]; let p0 = projVerts[face[0]], p1 = projVerts[face[1]], p2 = projVerts[face[2]];
                        let crossZ = (p1.x - p0.x)*(p2.y - p1.y) - (p1.y - p0.y)*(p2.x - p1.x);
                        if(crossZ > 0) { ctx.beginPath(); ctx.moveTo(p0.x, p0.y); for(let vIdx=1; vIdx<4; vIdx++) ctx.lineTo(projVerts[face[vIdx]].x, projVerts[face[vIdx]].y); ctx.closePath(); ctx.strokeStyle = colors.glow; ctx.stroke(); }
                    }
                    ctx.shadowBlur = 0;
                }
            }
        }
