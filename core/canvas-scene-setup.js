/**
 * Cấp phát buffer phân tích âm thanh, tạo blob từ DataURI, resize canvas, khởi tạo các hiệu ứng (sao, rubik, mưa phố...).
 * (Trích từ file gốc, dòng 576-671 trong khối <script>)
 */

        function dataURItoBlobUrl(dataURI) {
            try {
                let parts = dataURI.split(','); let byteString = atob(parts[1]); let mimeString = parts[0].split(':')[1].split(';')[0];
                let ab = new ArrayBuffer(byteString.length); let ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                return URL.createObjectURL(new Blob([ab], {type: mimeString}));
            } catch(e) { return null; }
        }

        // [XOÁ — 28/09/2026, Phase 3 dọn visualizer] `resizeCanvas()` + `window.addEventListener('resize', resizeCanvas)`
        // ĐÃ BỎ: core tự nghe sự kiện cửa sổ (bỏ qua Listener -> Router) và tự gọi 6 core khác (initStars/
        // initThreeJS/initRubik/generateStreetScene...), kèm lỗi dựng lại cả scene Vortex mỗi lần resize (rò GPU).
        // Nay: event/listener/visualizer-viewport.js -> router -> workflowVisualizerRender.onViewportResize() —
        // Workflow đổi kích thước canvas/renderer rồi báo từng group (event/workflow/visualizer/*.js) tự dựng lại
        // phần của mình. 3 hàm thuần dưới đây là các mảnh tách ra từ thân resizeCanvas() cũ.

        /** Đặt kích thước pixel thật của canvas 2D theo khung nhìn CSS × dpr. */
        function resizeVisualizerCanvas(canvasEl, cssWidth, cssHeight, dpr) {
            canvasEl.width = cssWidth * dpr;
            canvasEl.height = cssHeight * dpr;
        }

        /** Giọt nước tĩnh trên kính (Rain glass) rải ngẫu nhiên khắp canvas — y hệt công thức trong resizeCanvas() cũ. */
        function buildGlassStaticDrops(count, width, height, dpr) {
            const drops = [];
            for (let i = 0; i < count; i++) drops.push({ x: Math.random() * width, y: Math.random() * height, r: (Math.random() * 1.5 + 0.5) * dpr });
            return drops;
        }

        /** Dãy nhà thành phố phía sau kính (Rain glass) — y hệt công thức trong resizeCanvas() cũ (màu cửa theo color
         * mode, xem core/visualizer/groups/rain/glass.js). */
        function buildRainCityBuildings(width, dpr, bldScale) {
            const buildings = []; let currentX = -50 * dpr;
            while (currentX < width + 50 * dpr) {
                const w = (Math.random() * 60 + 30) * dpr * bldScale; const h = (Math.random() * 250 + 80) * dpr;
                const winStepX = 14 * dpr * (bldScale > 1 ? 1.5 : 1); const winStepY = 18 * dpr * (bldScale > 1 ? 1.5 : 1);
                const cols = Math.floor(w / winStepX); const rows = Math.floor(h / winStepY); const windows = [];
                for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (Math.random() > 0.3) windows.push({ r: r, c: c, isAlwaysOn: Math.random() > 0.85, fftBin: Math.floor(Math.random() * 40) });
                buildings.push({ x: currentX, w: w, h: h, cols: cols, rows: rows, windows: windows }); currentX += w + (Math.random() * 15 * dpr);
            }
            return buildings;
        }

        // [TÁCH — 28/09/2026, Phase 5 dọn visualizer] allocateBuffers()/getPlayerBarSafeHeight()/generateStreetScene()/
        // initStars()/initRubik() ĐÃ BỎ (đọc appState, gọi getEffectConfig()/core khác, tự appState.set()). Nay các builder
        // THUẦN dưới đây trả dữ liệu; Workflow (host + group visualizer) đọc config/khung nhìn và ghi appState. Công thức và
        // thứ tự Math.random giữ nguyên.

        /** 3 bộ đệm phân tích audio theo độ phân giải FFT hiện tại (phổ vẽ, phổ frame trước cho flux, sóng cho pitch). */
        function createAnalysisBuffers(frequencyBinCount, pitchFftSize) {
            return {
                vizDataArray: new Uint8Array(frequencyBinCount),
                previousSpectrumArray: new Uint8Array(frequencyBinCount),
                pitchTimeDomainArray: new Float32Array(pitchFftSize),
            };
        }

        /** Sao Black Hole: 5 cụm góc, 3 lớp tốc độ/kích thước, vài sao ngả xanh/vàng (màu GỐC — sao KHÔNG theo Color mode,
         * Giang 29/09/2026). `vAngle`/`vDist` = vận tốc 1 frame chuẩn 60fps, bước vật lý ghi lại mỗi frame để vẽ vệt cong. */
        function buildBlackHoleStars(count, maxDist, dpr) {
            const starList = [];
            for (let i = 0; i < count; i++) {
                const clusterAngle = (Math.floor(Math.random() * 5) / 5) * Math.PI * 2; const angle = clusterAngle + (Math.random() * 1.5 - 0.75);
                const layer = Math.random();
                const baseSpeed = layer < 0.2 ? 0.1 : (layer < 0.7 ? 0.4 : 1.0);
                const sizeMult = layer < 0.2 ? 0.5 : (layer < 0.7 ? 1.0 : 2.0);
                const colorRand = Math.random();
                const colorTint = colorRand > 0.9 ? '200, 220, 255' : (colorRand > 0.8 ? '255, 240, 200' : '255, 255, 255');
                starList.push({ angle: angle, distance: Math.random() * maxDist, size: (Math.random() * 1.5 + 0.5) * sizeMult * dpr, baseSpeed: baseSpeed * dpr, colorTint: colorTint, vAngle: 0, vDist: 0 });
            }
            return starList;
        }

        /** 27 khối Rubik 3×3×3 (toạ độ lưới -1..1 + dải tần gán cho khối). */
        function buildRubikCubes() {
            const cubes = [];
            for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) cubes.push({ cx: x, cy: y, cz: z, binIdx: Math.abs(x * 9 + y * 3 + z) % 27 });
            return cubes;
        }

        /** Mặt đất phố (Rain street): 88% chiều cao nhưng luôn cao hơn vùng thanh điều khiển dưới cùng (130px × dpr). */
        function computeStreetGroundY(canvasHeight, dpr) {
            return Math.min(canvasHeight * 0.88, canvasHeight - 130 * dpr);
        }

        /** 3 đèn cố định (1 đèn chính) + đèn tuỳ chỉnh (customLamps, cao tối đa tới sát mép trên). */
        function buildStreetLamps(w, h, groundY, dpr, customLamps) {
            const lamps = [];
            lamps.push({ x: w * 0.28, baseY: groundY, height: h * 0.42, main: true, flicker: 1, depth: 0 });
            lamps.push({ x: w * 0.06, baseY: groundY, height: h * 0.26, main: false, flicker: 1, depth: 0.7 });
            lamps.push({ x: w * 0.85, baseY: groundY, height: h * 0.28, main: false, flicker: 1, depth: 0.6 });
            const maxCustomLampHeight = Math.max(20 * dpr, groundY - 20 * dpr);
            (customLamps || []).forEach((lamp) => {
                lamps.push({ x: w * (lamp.xPercent / 100), baseY: groundY, height: Math.min(lamp.heightPx * dpr, maxCustomLampHeight), main: false, flicker: 1, depth: 0.3, flareScale: lamp.flareScale });
            });
            return lamps;
        }

        /** Hạt mưa phố rải ngẫu nhiên. */
        function buildStreetRain(count, w, h, dpr) {
            const rain = [];
            for (let i = 0; i < count; i++) {
                rain.push({ x: Math.random() * w, y: Math.random() * h, len: (14 + Math.random() * 18) * dpr, speed: (10 + Math.random() * 8) * dpr, drift: (Math.random() - 0.5) * 0.6 });
            }
            return rain;
        }

