/**
 * Cấp phát buffer phân tích âm thanh, tạo blob từ DataURI, resize canvas, khởi tạo các hiệu ứng (sao, rubik, mưa phố...).
 * (Trích từ file gốc, dòng 576-671 trong khối <script>)
 */
        function allocateBuffers() {
            if(!appState.get('analyser') || !appState.get('analyserPitch')) return;
            appState.set('vizDataArray', new Uint8Array(appState.get('analyser').frequencyBinCount));
            appState.set('previousSpectrumArray', new Uint8Array(appState.get('analyser').frequencyBinCount));
            appState.set('pitchTimeDomainArray', new Float32Array(appState.get('analyserPitch').fftSize));
        }

        function dataURItoBlobUrl(dataURI) {
            try {
                let parts = dataURI.split(','); let byteString = atob(parts[1]); let mimeString = parts[0].split(':')[1].split(';')[0];
                let ab = new ArrayBuffer(byteString.length); let ia = new Uint8Array(ab);
                for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
                return URL.createObjectURL(new Blob([ab], {type: mimeString}));
            } catch(e) { return null; }
        }

        function resizeCanvas() {
            appState.set('dpr', window.devicePixelRatio || 1);
            const dpr = appState.get('dpr');
            canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr;
            const tRenderer = appState.get('tRenderer');
            if(tRenderer) {
                tRenderer.setSize(window.innerWidth, window.innerHeight);
                if (appState.get('tInitialized') && appState.get('tCamera')) {
                    const tCamera = appState.get('tCamera');
                    tCamera.aspect = window.innerWidth/window.innerHeight; tCamera.updateProjectionMatrix();
                }
            }
            
            initStars(); initThreeJS(); updateThreeJSColors(); initRubik();
            appState.set('ripples', []);
            appState.set('glassStaticDrops', []); appState.set('glassStreaks', []); appState.set('activeLightnings', []); appState.set('starFlashes', []);
            
            const cfg = appState.get('vizConfig');
            const perfProfile = PERFORMANCE_PROFILES[cfg.quality];

            for(let i=0; i < perfProfile.glassDrops; i++) appState.mutate('glassStaticDrops', arr => arr.push({x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: (Math.random() * 1.5 + 0.5) * dpr}));
            
            let buildings = []; let currentX = -50 * dpr;
            while(currentX < canvas.width + 50 * dpr) {
                let w = (Math.random() * 60 + 30) * dpr * perfProfile.bldMult; let h = (Math.random() * 250 + 80) * dpr;
                let winStepX = 14 * dpr * (perfProfile.bldMult > 1 ? 1.5 : 1); let winStepY = 18 * dpr * (perfProfile.bldMult > 1 ? 1.5 : 1);
                let cols = Math.floor(w / winStepX); let rows = Math.floor(h / winStepY); let windows = [];
                for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (Math.random() > 0.3) windows.push({ r: r, c: c, isAlwaysOn: Math.random() > 0.85, fftBin: Math.floor(Math.random() * 40), colorType: Math.random() > 0.6 ? '#fff5e6' : '#ffdd44' });
                buildings.push({x: currentX, w: w, h: h, cols: cols, rows: rows, windows: windows}); currentX += w + (Math.random() * 15 * dpr); 
            }
            appState.set('cityBuildings', buildings);

            generateStreetScene();
        }
        window.addEventListener('resize', resizeCanvas);

        // Chiều cao (px thiết bị, đã *dpr) của vùng thanh điều khiển dưới cùng (progress bar + tên
        // bài/control/thời gian) — mặt đất của visual Street PHẢI nằm cao hơn mốc này để không bị
        // thanh điều khiển che mất, bất kể kích thước màn hình.
        function getPlayerBarSafeHeight() {
            return 130 * appState.get('dpr');
        }

        function generateStreetScene() {
            // Công viên về đêm dưới mưa: 1 cột đèn đường chính (lệch trái) + vài cột đèn phụ mờ
            // phía xa để tạo chiều sâu phố/công viên.
            // Mặt đất (groundY) luôn được đặt cao hơn vùng thanh điều khiển dưới cùng (tên bài,
            // nút play/pause, thanh tiến trình) để không bao giờ bị che mất bởi visual.
            const dpr = appState.get('dpr');
            const w = canvas.width, h = canvas.height;
            const safeGroundY = Math.min(h * 0.88, h - getPlayerBarSafeHeight());
            appState.set('streetGroundY', safeGroundY);

            let lamps = [];
            const mainLampX = w * 0.28;
            lamps.push({ x: mainLampX, baseY: safeGroundY, height: h * 0.42, main: true, flicker: 1, depth: 0 });
            // Đèn phụ phía xa hai bên, nhỏ và mờ hơn — chân cột vẫn chạm cùng mặt đất (safeGroundY)
            // như đèn chính, chỉ thân đèn thấp hơn để gợi cảm giác xa/nhỏ hơn theo chiều sâu.
            lamps.push({ x: w * 0.06, baseY: safeGroundY, height: h * 0.26, main: false, flicker: 1, depth: 0.7 });
            lamps.push({ x: w * 0.85, baseY: safeGroundY, height: h * 0.28, main: false, flicker: 1, depth: 0.6 });
            appState.set('streetLamps', lamps);

            // Mưa phố: các hạt mưa rơi xiên nhẹ, mật độ/độ dài sẽ được điều biến theo nhạc lúc vẽ.
            // Số lượng hạt khởi tạo theo PERFORMANCE_PROFILES để giảm tải ở chế độ hiệu năng thấp.
            const perfProfile = PERFORMANCE_PROFILES[appState.get('vizConfig').quality];
            let rain = [];
            for (let i = 0; i < perfProfile.streetRain; i++) {
                rain.push({
                    x: Math.random() * w, y: Math.random() * h,
                    len: (14 + Math.random() * 18) * dpr,
                    speed: (10 + Math.random() * 8) * dpr,
                    drift: (Math.random() - 0.5) * 0.6
                });
            }
            appState.set('streetRain', rain);
        }

        function initStars() {
            const dpr = appState.get('dpr');
            let starList = []; const maxDist = Math.max(canvas.width, canvas.height); const count = PERFORMANCE_PROFILES[appState.get('vizConfig').quality].stars;
            for(let i=0; i < count; i++) {
                let clusterAngle = (Math.floor(Math.random() * 5) / 5) * Math.PI * 2; let angle = clusterAngle + (Math.random() * 1.5 - 0.75); 
                let layer = Math.random(); let baseSpeed, sizeMult;
                if (layer < 0.2) { baseSpeed = 0.1; sizeMult = 0.5; } else if (layer < 0.7) { baseSpeed = 0.4; sizeMult = 1.0; } else { baseSpeed = 1.0; sizeMult = 2.0; } 
                let colorTint = '255, 255, 255'; let colorRand = Math.random();
                if (colorRand > 0.9) colorTint = '200, 220, 255'; else if (colorRand > 0.8) colorTint = '255, 240, 200'; 
                starList.push({ angle: angle, distance: Math.random() * maxDist, size: (Math.random() * 1.5 + 0.5) * sizeMult * dpr, baseSpeed: baseSpeed * dpr, colorTint: colorTint });
            }
            appState.set('stars', starList);
        }

        function initRubik() {
            let cubes = [];
            for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) cubes.push({ cx: x, cy: y, cz: z, binIdx: Math.abs(x*9 + y*3 + z) % 27 });
            appState.set('rubikCubes', cubes);
        }

