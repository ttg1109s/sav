/**
 * Cài đặt hiển thị Visualizer: kiểu hiệu ứng (cycle button + select), màu sắc (solid/dynamic),
 * ảnh nền, độ mờ nền, độ cao/độ dày thanh, số lượng thanh mirror, chất lượng canvas, volume, EQ
 * preset, và vẽ lại CSS thanh tiến trình theo màu visualizer hiện tại.
 *
 * TÁCH FILE (ver 11, tái cấu trúc /event/, patch 1): toàn bộ nội dung file này TRƯỚC ĐÂY nằm
 * chung trong core/player-controls.js (dòng 383-510 bản cũ, phần cuối file) — dời sang đây vì
 * đúng ranh giới nghiệp vụ thật là "cấu hình Visualizer", không phải "điều khiển phát nhạc" (xem
 * comment đầu core/player-controls.js để biết lý do tách + thứ tự nạp).
 *
 * PHẢI nạp SAU core/player-controls.js (xem index.html, khu vực 4 VISUALIZERS).
 *
 * CŨNG PHẢI nạp SAU core/equalizer-settings.js, core/dom-refs.js (cần mọi ref DOM của các
 * select/slider/toggle bên dưới đã tồn tại — xem dom-refs.js dòng 125-140) và core/config.js
 * (EQ_PRESETS, APP_CONFIG).
 *
 * === Batch D3 (Settings restructure, 06/07/2026) ===
 * Panel Visualizer Settings giờ PUSH/POP động (core/settings-panel-stack.js) — 14 hàm `set*` dưới
 * đây (quality/bgColor/colorMode/solidColor.../dynColor.../vortexStyle/barStyle/rainStyle/glassFlash/
 * maxHeight/barWidth/mirrorCount) REFACTOR ĐẦY ĐỦ Rule 1-4 theo CHỐT của Giang (không hỏi lại mỗi
 * batch, xem Batch D2): bỏ hẳn gọi core khác (`resizeCanvas`/`updateDOMBackground`/
 * `updateColorMenuUI`/`updateProgressBarCSS`/`updateVortexVisibility`/`updateBarStyleUI`/
 * `saveConfig`) bên trong — dời hết ra event/workflow/visualizer-display.js. Hàm nào có DOM ghi
 * kèm (display span, hoặc ĐỒNG BỘ CHÉO 2 input màu solid) nhận phần tử đó qua tham số, KHÔNG dùng
 * dom-refs tĩnh (panel bị xoá/tạo lại mỗi lần đóng/mở).
 *
 * MỚI PHÁT SINH (khác About/Subtitle): `updateTypeUI()`/`updateColorMenuUI()`/`updateBarStyleUI()`
 * KHÔNG chỉ được gọi từ bên TRONG panel — còn bị gọi từ BÊN NGOÀI (select "Kiểu hiệu ứng" ở Main,
 * nút cycle Control Center, timer nền core/auto-switch-visual.js) — nếu panel đang ĐÓNG, các phần
 * tử bên trong nó (blockMaxHeight, blockVortex...) sẽ là `null`. Đã thêm GUARD 1 lần cho cả cụm
 * (check `blockMaxHeight` đại diện — cùng 1 panel nên cùng tồn tại/cùng bị xoá) — cùng tinh thần
 * guard đã có sẵn trước đó ở `initAutoSwitchVisualUI()`/`syncAutoSwitchTimeModeBlocks()`
 * (core/auto-switch-visual.js), KHÔNG phải pattern mới tự nghĩ ra. Đồng bộ lúc MỞ panel nằm ở
 * `workflowVisualizerDisplay.openPanel()`.
 *
 * ÁP DỤNG /event/ (ver 11, patch 2): TOÀN BỘ 20 `addEventListener` cũ của file này đã CHUYỂN HẾT
 * sang event/listener/visualizer-display.js — 14/20 nay dùng DELEGATION trên settingsStackBody
 * (Batch D3, xem file đó), 6 còn lại (bgImage/bgBlur/volume/eq/cycleMode) vẫn tĩnh (Main/Control
 * Center, không di chuyển). Logic nghiệp vụ trước đây nằm thẳng trong callback đã rút thành HÀM
 * CORE THUẦN bên dưới — đối chiếu event/router/visualizer-display.js để biết msg.type nào gọi hàm
 * nào. `applyBgImage()`/`applyBgImageEnabled()` là core thuần KHÔNG còn withLoadingShield/
 * alertModal bên trong (2 thứ này dời ra event/workflow/visualizer-display.js, đúng quy tắc "core
 * không biết shield/modal tồn tại"). FIX (03/07/2026, mục 1) — bỏ hẳn `validateBgImageFile()`/
 * upload file trực tiếp — `applyBgImage()` giờ CHỈ được gọi từ picker (event/workflow/visualizer-
 * display.js::pickBgImageFromLibrary, dùng Blob đã có sẵn trong store `images`, không cần validate
 * lại định dạng file).
 * Cross-call (updateTypeUI có 3 nguồn: cycle button, select ở equalizer-settings.js, timer
 * auto-switch-visual.js) vẫn GIỮ NGUYÊN lệnh gọi hàm trực tiếp — KHÔNG thuộc phạm vi patch này
 * (xem plan.md, đã chốt lùi việc đưa cross-call qua bus tới khi 134 listener gốc tách xong hết).
 */
        // MỚI (Phần B, Galaxy) — biến NỘI BỘ (KHÔNG thuộc STATE, cùng kiểu với `tWarpSpeed` ở
        // core/webgl/three-vortex.js): lưu tạm tone mapping mặc định của renderer dùng chung
        // (Vortex) để trả lại đúng giá trị khi rời khỏi 'space' — xem updateTypeUI() bên dưới.
        let _spDefaultToneMapping = null;
        // Bán kính vùng trôi của SpaceDust (đơn vị Three.js) — hằng số cấu hình, KHÔNG đổi theo
        // quality (chỉ SỐ LƯỢNG hạt bụi đổi theo quality qua PERFORMANCE_PROFILES.galaxyDustCount,
        // xem plan B6).
        const SPACE_DUST_RANGE = 500;

        /**
         * MỚI (20/07/2026, plan-space-galaxy.md Phần A, mục A3) — Core THUẦN tách từ đoạn toggle
         * `style.visibility` TRƯỚC ĐÂY nằm thẳng trong `drawVisualizer()`
         * (core/visualizer/draw-visualizer.js, nay đã RỖNG — logic dời sang
         * `event/workflow/visualizer-render.js::_tick()`, nơi DUY NHẤT gọi hàm này mỗi frame).
         * Guard clause thuần (Rule 1): xoá `if` đi, hàm vẫn còn ĐÚNG 1 kịch bản "đồng bộ hiển thị
         * theo isVisualOff", chỉ mất phần "bỏ qua nếu đã đúng trạng thái rồi" (tối ưu, tránh ghi
         * DOM thừa mỗi frame).
         * @param {HTMLElement} canvasEl - canvas 2D chính (#visualizer)
         * @param {HTMLElement} webglCanvasEl - canvas WebGL (#webgl-canvas, dùng chung Vortex/Space)
         * @param {boolean} isVisualOff
         */
        function updateCanvasVisibility(canvasEl, webglCanvasEl, isVisualOff) {
            if (isVisualOff) {
                if (canvasEl.style.visibility !== 'hidden') {
                    canvasEl.style.visibility = 'hidden';
                    webglCanvasEl.style.visibility = 'hidden';
                }
            } else if (canvasEl.style.visibility === 'hidden') {
                canvasEl.style.visibility = '';
                webglCanvasEl.style.visibility = '';
            }
        }

        function updateProgressBarCSS() {
            const cfg = appState.get('vizConfig');
            const percentage = (progressBar.value / (progressBar.max || 100)) * 100;
            const color = cfg.mode === 'solid' ? cfg.solidColor : (cfg.mode === 'dynamic' ? cfg.dynB : '#38bdf8');
            progressBar.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percentage}%, rgba(255,255,255,0.2) ${percentage}%, rgba(255,255,255,0.2) 100%)`;
        }

        /**
         * Xoay vòng kiểu hiệu ứng kế tiếp (MODES) — CHỈ chạy khi "Tự động đổi hiệu ứng" đang TẮT.
         *
         * FIX (yêu cầu mới): khi "Tự động đổi hiệu ứng" đang BẬT (vizConfig.autoSwitchVisualEnabled),
         * nút "Đổi hiệu ứng" (#btn-cycle-mode) ở Control Center PHẢI vô hiệu — không bấm được, bấm
         * cũng không có tác dụng gì. Trước đây nút này luôn hoạt động bất kể auto-switch đang bật
         * hay tắt, gây xung đột: tự động đang đếm giờ để đổi, nhưng người dùng bấm tay cũng đổi
         * được luôn, 2 cơ chế dẫm chân nhau. Kiểm tra ĐIỀU KIỆN NGAY ĐẦU hàm (không chỉ dựa vào
         * thuộc tính HTML `disabled` của nút — xem updateCycleModeButtonState() ở
         * auto-switch-visual.js, nơi đồng bộ CẢ thuộc tính disabled/style THỊ GIÁC lẫn cờ JS này)
         * để chắc chắn không có đường nào lách qua được, kể cả khi nút được kích hoạt bằng cách
         * khác ngoài click chuột thật (ví dụ gọi .click() bằng JS từ nơi khác).
         *
         * Ứng với msg.type 'visualizerDisplay.cycleMode.click'.
         */
        function cycleVisualizerType() {
            if (appState.get('vizConfig').autoSwitchVisualEnabled) return;
            appState.set('currentModeIndex', (appState.get('currentModeIndex') + 1) % MODES.length); updateTypeUI(); saveConfig();
        }

        /**
         * HOTFIX 2 (07/07/2026, bug do Giang báo qua screenshot lỗi thật khi phát nhạc — SỬA LẠI
         * cách guard batch trước, cách đó VẪN SAI): Batch D3 viết `if (blockMaxHeight) {...}` với
         * suy nghĩ "biến này = null khi panel đóng" — SAI HOÀN TOÀN: `const blockMaxHeight = ...`
         * đã bị XOÁ KHỎI core/dom-refs.js (không tồn tại nữa, không phải = null) — tham chiếu 1
         * biến CHƯA TỪNG KHAI BÁO ném `ReferenceError: Can't find variable` NGAY LẬP TỨC (khác hẳn
         * `if (null)`, vốn chỉ đơn giản là false, không ném gì). SỬA ĐÚNG: dùng
         * `document.getElementById()` TRUY VẤN TƯƠI mỗi lần gọi (an toàn tuyệt đối, trả `null` nếu
         * không tìm thấy, KHÔNG BAO GIỜ ném ReferenceError) THAY vì dựa vào biến toàn cục — đúng
         * bản chất "phần tử này sống động, có thể không tồn tại tại thời điểm gọi".
         */
        function updateTypeUI() {
            const currentModeIndex = appState.get('currentModeIndex');
            // MỚI (Phần B, Galaxy) — bắt lại kiểu CŨ TRƯỚC khi ghi đè, cần biết có đang RỜI KHỎI
            // 'space' hay không (trả tone mapping renderer dùng chung về mặc định của Vortex).
            const previousType = appState.get('vizConfig').type;
            appState.mutate('vizConfig', cfg => { cfg.type = MODES[currentModeIndex]; });
            const cfg = appState.get('vizConfig');
            modeBadge.textContent = `${currentModeIndex + 1}/${MODES.length}`;
            // Đồng bộ select "Kiểu hiệu ứng" trong Settings (ver 8 refine) — updateTypeUI() là
            // điểm DUY NHẤT mọi đường đổi kiểu hiệu ứng đều đi qua (cycle button HOẶC select), nên
            // đặt đồng bộ ở đây đảm bảo 2 UI luôn khớp nhau bất kể đổi từ đâu.
            if (typeof visualizerTypeSelect !== 'undefined' && visualizerTypeSelect) visualizerTypeSelect.value = cfg.type;

            if (cfg.type === 'vortex' || cfg.type === 'space') {
                // Space (MỚI, Phần B) DÙNG CHUNG canvas #webgl-canvas + tRenderer với Vortex — KHÔNG
                // tạo WebGLRenderer/resize listener riêng (plan B2) — vẫn cần initThreeJS() (Vortex)
                // chạy trước ÍT NHẤT 1 lần để tRenderer tồn tại, bất kể Space hay Vortex vào trước.
                if (!appState.get('tInitialized')) initThreeJS();
                if (cfg.type === 'vortex') {
                    updateVortexVisibility();
                } else {
                    // 'space' — khởi tạo engine Galaxy đúng 1 LẦN (spInitialized), TÁI SỬ DỤNG
                    // appState.get('tRenderer') vừa đảm bảo tồn tại ở dòng trên.
                    if (!appState.get('spInitialized')) {
                        const created = initThreeSpace(appState.get('tRenderer'));
                        appState.set('spScene', created.spScene);
                        appState.set('spCamera', created.spCamera);
                        appState.set('spGlowTexture', createGalaxyStarTexture());
                        appState.set('spNebulaTexture', createGalaxyNebulaTexture());
                        const dustCount = PERFORMANCE_PROFILES[cfg.quality].galaxyDustCount;
                        const dustMesh = buildSpaceDustMesh(dustCount, SPACE_DUST_RANGE, appState.get('spGlowTexture'));
                        appState.get('spScene').add(dustMesh);
                        appState.set('spDustMesh', dustMesh);
                        appState.set('spGalaxyClusters', []);
                        appState.set('spNextClusterIndex', 0);
                        appState.set('spTotalGalaxiesSpawned', 0);
                        appState.set('spCurrentTargetIndex', null);
                        // MỚI (21/07/2026, phản hồi Giang lượt 2) — mô hình "waypoint nối tiếp"
                        // (mục 3) — KHÔNG khởi tạo `spNextPos` ở đây (để trống/undefined có chủ
                        // đích): `event/workflow/visualizer-render.js::_tickSpace()` tự phát hiện
                        // `!appState.get('spNextPos')` ở lần tick ĐẦU TIÊN và tự sinh leg đầu tiên
                        // — tránh trùng lặp logic "sinh leg" ở 2 nơi khác nhau (ở đây và ở Workflow).
                        appState.set('spNextPos', undefined);
                        appState.set('spPendingNextPos', undefined);
                        // MỚI (21/07/2026, phản hồi Giang lượt 5, mục 5) — "roll camera sau mỗi
                        // lượt dựa theo note pick giống như rubik, nhưng sinh ngẫu nhiên, tái sử
                        // dụng": bảng 12 giá trị (1/nốt trong quãng tám), SINH NGẪU NHIÊN ĐÚNG 1
                        // LẦN ở đây (giống cấu trúc RUBIK_NOTE_TO_TURN, core/dom-refs.js, nhưng
                        // KHÔNG cố định tay) — TÁI SỬ DỤNG suốt phiên xem Space, không random lại
                        // mỗi leg (event/workflow/visualizer-render.js chỉ TRA BẢNG mỗi leg qua
                        // `_pickNoteRoll()`). Tham chiếu `SPACE_NOTE_ROLL_RANGE` định nghĩa ở
                        // event/workflow/visualizer-render.js — hợp lệ dù file đó nạp SAU file này
                        // (tham chiếu xảy ra lúc HÀM NÀY THỰC SỰ CHẠY, luôn sau khi toàn bộ
                        // <script> trong trang đã parse xong, không phải lúc parse).
                        appState.set('spNoteRollTable', Array.from({ length: 12 }, () => (Math.random() - 0.5) * 2 * SPACE_NOTE_ROLL_RANGE));
                        appState.set('spLegRoll', 0);
                        appState.set('spPendingRoll', 0);
                        appState.set('spPendingIsJump', false);
                        appState.set('spPendingJumpTargetIndex', null);
                        appState.set('spCurrentLegIsJump', false);
                        appState.set('spJumpLocked', false);
                        // MỚI (21/07/2026, phản hồi Giang lượt 2) — baseline 60 (~nốt Đô giữa,
                        // tầm trung phổ biến của nhạc cụ/giọng hát), KHÔNG phải 0 — tránh false-
                        // trigger "đỉnh nốt mới" ngay ở NỐT ĐẦU TIÊN sau khi vừa chuyển sang Space
                        // (mọi nốt bình thường đều > 0 nên sẽ luôn bị tính nhầm là đỉnh nếu baseline = 0).
                        appState.set('spHighestNoteSeen', 60);
                        appState.set('spInitialized', true);
                    }
                    // Tone mapping (plan B2) — lưu mặc định (Vortex, KHÔNG set tone mapping riêng —
                    // xem core/webgl/three-vortex.js — mặc định THREE.NoToneMapping) vào biến NỘI
                    // BỘ (KHÔNG thuộc STATE, cùng kiểu với `tWarpSpeed` ở three-vortex.js), set ACES
                    // khi VÀO 'space', trả lại mặc định khi RA (nhánh else phía dưới).
                    const tRenderer = appState.get('tRenderer');
                    if (tRenderer) {
                        if (_spDefaultToneMapping === null) _spDefaultToneMapping = tRenderer.toneMapping;
                        tRenderer.toneMapping = THREE.ACESFilmicToneMapping;
                    }
                }
                // FIX (04/07/2026, mục 4) — 'playlist-hidden' THAY '-translate-y-full' (dọc -> ngang).
                // SỬA (07/07/2026, batch gộp container) — class `playlist-hidden` đã DỜI từ
                // `#playlist-view` sang `#side-left-container`. HOTFIX 16 (08/07/2026) — dời TIẾP
                // sang `#app-stack` (components/app-view-stack.js) — `#side-left-container` giờ
                // KHÔNG BAO GIỜ còn mang class này nữa (chỉ lo cuộn ngang) — kiểm tra SAI phần tử ở
                // đây sẽ luôn trả về false, làm webgl-canvas không bao giờ hiện lại đúng lúc.
                if (!appStack.classList.contains('playlist-hidden')) {} else { document.getElementById('webgl-canvas').classList.remove('opacity-0'); }
            } else {
                document.getElementById('webgl-canvas').classList.add('opacity-0');
                // Rời khỏi 'space' — trả tone mapping renderer dùng chung về mặc định của Vortex.
                if (previousType === 'space') {
                    const tRenderer = appState.get('tRenderer');
                    if (tRenderer && _spDefaultToneMapping !== null) tRenderer.toneMapping = _spDefaultToneMapping;
                }
            }

            // HOTFIX 2 — truy vấn TƯƠI, KHÔNG dựa vào biến toàn cục (xem docstring hàm ngay trên).
            const blockMaxHeightEl = document.getElementById('block-max-height');
            if (blockMaxHeightEl) {
                const blockBarWidthEl = document.getElementById('block-bar-width');
                const blockVortexEl = document.getElementById('block-vortex');
                const blockRainEl = document.getElementById('block-rain');
                const blockBarStyleEl = document.getElementById('block-bar-style');

                blockMaxHeightEl.classList.add('hidden'); blockBarWidthEl.classList.add('hidden');
                blockVortexEl.classList.add('hidden'); blockRainEl.classList.add('hidden'); blockBarStyleEl.classList.add('hidden');

                if (cfg.type === 'vortex') { blockVortexEl.classList.remove('hidden'); blockVortexEl.classList.add('flex'); }
                // 'space' KHÔNG có panel tinh chỉnh riêng (đã bỏ 21/07/2026, phản hồi Giang mục 1)
                // — không cần nhánh nào ở đây, engine Galaxy tự khởi tạo ở khối phía trên.
                else if (cfg.type === 'rain') { blockRainEl.classList.remove('hidden'); blockRainEl.classList.add('flex'); }
                else if (cfg.type === 'bar') {
                    // "Độ cao tối đa" vẫn dùng chung cho Bar (cả mirror/cascade); "Độ dày thanh" KHÔNG
                    // áp dụng cho Bar nữa (chỉ Black Hole) — xem updateBarStyleUI cho 2 setting riêng
                    // của kiểu Phản chiếu (số lượng thanh, độ to vòng tròn).
                    blockMaxHeightEl.classList.remove('hidden'); blockMaxHeightEl.classList.add('flex');
                    blockBarStyleEl.classList.remove('hidden'); blockBarStyleEl.classList.add('flex');
                    updateBarStyleUI();
                }
                else if (cfg.type === 'black hole') {
                    // Black Hole là visual DUY NHẤT còn dùng "Độ dày thanh".
                    blockMaxHeightEl.classList.remove('hidden'); blockMaxHeightEl.classList.add('flex');
                    blockBarWidthEl.classList.remove('hidden'); blockBarWidthEl.classList.add('flex');
                }
                else if (cfg.type !== 'rubik' && cfg.type !== 'lightning') {
                    blockMaxHeightEl.classList.remove('hidden'); blockMaxHeightEl.classList.add('flex');
                }
            }

            if(appState.get('analyser')) { appState.get('analyser').fftSize = (cfg.type === 'vortex' || cfg.type === 'lightning') ? APP_CONFIG.fftSizeHighRes : APP_CONFIG.fftSizeStandard; allocateBuffers(); }
        }

        /** HOTFIX 2 (07/07/2026) — cùng sửa như updateTypeUI() ở trên: `barMirrorOptions` KHÔNG
         * tồn tại nữa (đã xoá khỏi dom-refs.js), `if (!barMirrorOptions)` ném ReferenceError chứ
         * không an toàn như tưởng — đổi sang `document.getElementById()` truy vấn tươi. */
        function updateBarStyleUI() {
            const barMirrorOptionsEl = document.getElementById('bar-mirror-options');
            if (!barMirrorOptionsEl) return;
            const isMirror = appState.get('vizConfig').barStyle === 'mirror';
            barMirrorOptionsEl.classList.toggle('hidden', !isMirror);
            barMirrorOptionsEl.classList.toggle('flex', isMirror);
        }

        // (Phần B, Galaxy — updateSpaceStyleUI() ĐÃ BỎ 21/07/2026, phản hồi Giang mục 1, cùng lúc
        // xoá panel tinh chỉnh 4 slider reroll/jump khỏi components/visualizer-settings-drawer.js)

        /** HOTFIX 2 (07/07/2026) — cùng sửa như updateTypeUI()/updateBarStyleUI(): `solidColorContainer`/
         * `dynColorContainer` KHÔNG tồn tại nữa — đổi sang `document.getElementById()` truy vấn tươi. */
        function updateColorMenuUI() {
            const mode = appState.get('vizConfig').mode;
            const solidColorContainerEl = document.getElementById('solid-color-container');
            if (solidColorContainerEl) {
                const dynColorContainerEl = document.getElementById('dynamic-color-container');
                if (mode === 'solid') { solidColorContainerEl.classList.remove('hidden'); dynColorContainerEl.classList.add('hidden'); dynColorContainerEl.classList.remove('flex'); }
                else if (mode === 'dynamic') { solidColorContainerEl.classList.add('hidden'); dynColorContainerEl.classList.remove('hidden'); dynColorContainerEl.classList.add('flex'); }
                else { solidColorContainerEl.classList.add('hidden'); dynColorContainerEl.classList.add('hidden'); dynColorContainerEl.classList.remove('flex'); }
            }
            updateProgressBarCSS();
        }

        function applyEQPreset(mode) {
            const eqBandNodes = appState.get('eqBandNodes');
            if (!eqBandNodes || eqBandNodes.length === 0) return;
            const gains = mode === 'manual' ? appState.get('vizConfig').manualEq : (EQ_PRESETS[mode] || EQ_PRESETS['flat']);
            for(let i = 0; i < eqBandNodes.length; i++) { if(eqBandNodes[i]) eqBandNodes[i].gain.value = gains[i] || 0; }
        }

        /**
         * Core thuần: đổi chất lượng canvas (low/medium/high...). Batch D3 — BỎ `resizeCanvas()`/
         * `saveConfig()` nội bộ (Rule 3), dời ra `workflowVisualizerDisplay.setQuality()`.
         */
        function setVisualizerQuality(value) {
            appState.mutate('vizConfig', cfg => { cfg.quality = value; });
        }

        /**
         * HOTFIX 3 (07/07/2026) — `applyBgImage()`/`applyBgImageEnabled()` bị XOÁ NHẦM hoàn toàn
         * khỏi file này ở Batch D3 (lỗi thao tác `str_replace` — `old_str` vô tình bao trùm luôn 2
         * hàm này dù không định đổi gì, `new_str` không viết lại nên mất trắng). Toggle "Ảnh nền"
         * ở Main list gọi 2 hàm này qua event/workflow/visualizer-display.js — bấm vào sẽ ném
         * `ReferenceError` từ lúc Batch D3 tới giờ. Khôi phục lại NGUYÊN VẸN logic gốc, ĐỒNG THỜI
         * áp refactor Rule 0.5 luôn (batch "nền chung" — Giang đã CHỐT làm đầy đủ từ D1): BỎ
         * `updatePlaylistBg()`/`saveConfig()` nội bộ, dời ra Workflow (xem event/workflow/
         * visualizer-display.js::toggleBgImage()). `bgImageEnableToggle.checked = true` GIỮ
         * NGUYÊN — ghi DOM tĩnh đơn giản, không phải core-gọi-core, không thuộc phạm vi Rule 3.
         *
         * @param {Blob} file - Blob ảnh (từ store `images` qua picker — xem event/workflow/
         *        visualizer-display.js::toggleBgImage; KHÔNG validate định dạng ở đây, ảnh trong
         *        store `images` đã hợp lệ từ lúc upload vào đó)
         */
        async function applyBgImage(file) {
            await setMeta('bgImage', file);
            appState.mutate('vizConfig', cfg => {
                if (cfg.bgImage && cfg.bgImage.startsWith('blob:')) URL.revokeObjectURL(cfg.bgImage);
                cfg.bgImage = URL.createObjectURL(file);
                cfg.bgImageEnabled = true;
            });
            // (07/07/2026: dòng `bgImageEnableToggle.checked = true` ĐÃ XOÁ — checkbox không còn
            // tồn tại, thay bằng 3 card Theme — event/workflow/theme.js tự vẽ lại UI card sau khi
            // gọi hàm này, xem selectThemeMode().)
        }

        /**
         * HOTFIX 3 — khôi phục (xem docstring applyBgImage() ngay trên) + refactor Rule 0.5.
         * FIX (04/07/2026, mục 1 phản hồi Giang) — TẮT KHÔNG xoá `meta.bgImage` trong IndexedDB,
         * chỉ dọn object URL runtime, GIỮ Blob thật để lần "gạt On" kế tiếp kích hoạt lại NGAY qua
         * `applyBgImage()` mà KHÔNG cần mở lại picker.
         * @param {boolean} enabled
         */
        function applyBgImageEnabled(enabled) {
            appState.mutate('vizConfig', cfg => {
                cfg.bgImageEnabled = enabled;
                if (!enabled) {
                    if (cfg.bgImage && cfg.bgImage.startsWith('blob:')) URL.revokeObjectURL(cfg.bgImage);
                    cfg.bgImage = '';
                }
            });
        }

        /** Độ mờ ảnh nền. msg.type 'visualizerDisplay.bgBlur.input'. Batch "nền chung" — BỎ
         * `updatePlaylistBg()`/`saveConfig()` nội bộ, dời ra Workflow. @param {string} value */
        function setBgBlur(value) {
            appState.mutate('vizConfig', cfg => { cfg.bgBlur = value; });
            valBgBlurDisplay.textContent = value + 'px';
        }

        /**
         * Core thuần: màu nền Visualizer (khi không dùng ảnh). Batch D3 — BỎ `updateDOMBackground()`/
         * `saveConfig()` nội bộ, dời ra `workflowVisualizerDisplay.setBgColor()`.
         */
        function setBgColor(value) {
            appState.mutate('vizConfig', cfg => { cfg.bgColor = value; });
        }

        /**
         * Core thuần: chế độ màu visualizer (solid/dynamic/none). Batch D3 — BỎ `updateColorMenuUI()`/
         * `saveConfig()` nội bộ, dời ra Workflow.
         */
        function setColorMode(value) {
            appState.mutate('vizConfig', cfg => { cfg.mode = value; });
        }

        /**
         * Core thuần: màu solid từ color picker — CẦN đồng bộ CHÉO sang ô text hex đi kèm.
         * Batch D3 — nhận `crossEl` (ô text) qua tham số thay vì dom-refs tĩnh `solidColorText`.
         * @param {string} value @param {HTMLElement} [crossEl]
         */
        function setSolidColorFromPicker(value, crossEl) {
            appState.mutate('vizConfig', cfg => { cfg.solidColor = value; });
            if (crossEl) crossEl.value = value;
        }

        /**
         * Core thuần: màu solid từ ô nhập text hex — chỉ áp dụng khi đúng định dạng #RRGGBB,
         * không thì bỏ qua im lặng (giữ đúng hành vi gốc). CẦN đồng bộ CHÉO sang color picker.
         * @param {string} value @param {HTMLElement} [crossEl]
         * @returns {boolean} true nếu giá trị hợp lệ và đã áp dụng (Workflow dựa vào đây để biết
         *          có cần gọi updateProgressBarCSS()/saveConfig() tiếp hay không).
         */
        function setSolidColorFromText(value, crossEl) {
            if (!/^#[0-9A-F]{6}$/i.test(value)) return false;
            appState.mutate('vizConfig', cfg => { cfg.solidColor = value; });
            if (crossEl) crossEl.value = value;
            return true;
        }

        /** Core thuần: màu A của gradient động. Batch D3 — BỎ `saveConfig()` nội bộ. */
        function setDynColorA(value) {
            appState.mutate('vizConfig', cfg => { cfg.dynA = value; });
        }

        /** Core thuần: màu B của gradient động. Batch D3 — BỎ `updateProgressBarCSS()`/`saveConfig()`. */
        function setDynColorB(value) {
            appState.mutate('vizConfig', cfg => { cfg.dynB = value; });
        }

        /** Core thuần: màu bắt đầu (from) của Theme mode "Gradient" (MỚI 09/07/2026) — KHÁC
         * `dynA`/`dynB` ở trên (đó là màu thanh Visualizer, đây là màu nền app) — xem docstring
         * DEFAULT_VIZ_CONFIG.gradientFrom, core/config.js. */
        function setThemeGradientFrom(value) {
            appState.mutate('vizConfig', cfg => { cfg.gradientFrom = value; });
        }

        /** Core thuần: màu kết thúc (to) của Theme mode "Gradient" (MỚI 09/07/2026). */
        function setThemeGradientTo(value) {
            appState.mutate('vizConfig', cfg => { cfg.gradientTo = value; });
        }

        /** Core thuần: kiểu hiệu ứng Vortex con. Batch D3 — BỎ `updateVortexVisibility()`/`saveConfig()`. */
        function setVortexStyle(value) {
            appState.mutate('vizConfig', cfg => { cfg.vortexStyle = value; });
        }

        /** Core thuần: kiểu hiệu ứng Bar con (mirror/cascade). Batch D3 — BỎ `updateBarStyleUI()`/`saveConfig()`. */
        function setBarStyle(value) {
            appState.mutate('vizConfig', cfg => { cfg.barStyle = value; });
        }

        /** Core thuần: kiểu hiệu ứng Rain con. Batch D3 — BỎ `resizeCanvas()`/`saveConfig()`. */
        function setRainStyle(value) {
            appState.mutate('vizConfig', cfg => { cfg.rainStyle = value; });
        }

        // (Phần B, Galaxy — setSpaceStyle()/setSpaceRerollThreshold()/setSpaceRerollChance()/
        // setSpaceJumpThreshold()/setSpaceJumpChance() ĐÃ BỎ 21/07/2026, phản hồi Giang mục 1 —
        // 4 giá trị ngưỡng/xác suất giờ là hằng số cố định trong
        // event/workflow/visualizer-render.js, KHÔNG còn chỉnh qua UI/vizConfig.)

        /** Core thuần: bật/tắt hiệu ứng chớp kính (Rain). Batch D3 — BỎ `saveConfig()` nội bộ. */
        function setGlassFlash(checked) {
            appState.mutate('vizConfig', cfg => { cfg.glassFlash = checked; });
        }

        /** Core thuần: độ cao tối đa của bar. Batch D3 — nhận `displayEl` qua tham số. @param {string} value @param {HTMLElement} [displayEl] */
        function setMaxHeight(value, displayEl) {
            const v = parseInt(value);
            appState.mutate('vizConfig', cfg => { cfg.maxH = v; });
            if (displayEl) displayEl.textContent = v;
        }

        /** Core thuần: độ dày thanh (Black Hole). Batch D3 — nhận `displayEl` qua tham số. @param {string} value @param {HTMLElement} [displayEl] */
        function setBarWidth(value, displayEl) {
            const v = parseInt(value);
            appState.mutate('vizConfig', cfg => { cfg.barWidth = v; });
            if (displayEl) displayEl.textContent = v;
        }

        /** Core thuần: số lượng thanh mirror. Batch D3 — nhận `displayEl` qua tham số. @param {string} value @param {HTMLElement} [displayEl] */
        function setMirrorCount(value, displayEl) {
            const v = parseInt(value);
            appState.mutate('vizConfig', cfg => { cfg.mirrorBarCount = v; });
            if (displayEl) displayEl.textContent = v;
        }

        /** Âm lượng tổng (masterGainNode). msg.type 'visualizerDisplay.volume.input'. @param {string} value */
        function setVolume(value) {
            appState.mutate('vizConfig', cfg => { cfg.volume = parseInt(value); });
            const volume = appState.get('vizConfig').volume;
            valVolumeDisplay.textContent = volume + '%'; 
            if(appState.get('masterGainNode')) appState.get('masterGainNode').gain.value = volume / 100; saveConfig();
        }

        /** Đổi preset EQ (hoặc 'manual'). msg.type 'visualizerDisplay.eqMode.change'. @param {string} value */
        function setEQMode(value) {
            appState.mutate('vizConfig', cfg => { cfg.eqMode = value; }); updateEQSlidersUI(value); applyEQPreset(value); saveConfig();
        }
