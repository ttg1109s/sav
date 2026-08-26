/**
 * Cài đặt hiển thị Visualizer: kiểu hiệu ứng (cycle button), ảnh nền, độ mờ nền, volume, EQ preset,
 * vẽ lại CSS thanh tiến trình theo màu effect đang chạy.
 *
 * Màu sắc/blur/style con/kích thước hình học (12/08/2026 trở về trước từng ở đây) ĐÃ DỜI HẲN sang
 * customEffect[type] riêng từng effect — xem core/custom-effect.js + event/workflow/custom-effect.js
 * (Custom Effect Drawer, mở qua GIỮ 1.5s #btn-cycle-mode).
 *
 * PHẢI nạp SAU: core/player-controls.js, core/dom-refs.js, core/config.js, core/custom-effect.js.
 */
        // Biến NỘI BỘ (KHÔNG thuộc STATE): lưu tạm tone mapping mặc định của renderer dùng chung
        // (Vortex) để trả lại đúng giá trị khi rời khỏi 'space' — xem updateTypeUI() bên dưới.
        let _spDefaultToneMapping = null;
        // Bán kính vùng trôi của SpaceDust (đơn vị Three.js) — hằng số cấu hình.
        const SPACE_DUST_RANGE = 500;

        // Key i18n tên hiển thị cho từng giá trị MODES (service/state/visualizer-runtime.js), DÙNG
        // CHUNG bộ text đã có ở Custom Effect Drawer.
        const VISUALIZER_TYPE_LABEL_KEYS = {
            bar: 'settingsVisualizer.type.bar',
            lightning: 'settingsVisualizer.type.lightning',
            rubik: 'settingsVisualizer.type.rubik',
            vortex: 'settingsVisualizer.type.vortex',
            'black hole': 'settingsVisualizer.type.blackHole',
            rain: 'settingsVisualizer.type.rain',
            space: 'settingsVisualizer.type.space',
        };

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

        /** Màu progress bar theo effect ĐANG CHẠY (customEffect[type]) — không còn 1 màu chung. */
        function updateProgressBarCSS() {
            const ec = getActiveEffectConfig(); // core/custom-effect.js
            const percentage = (progressBar.value / (progressBar.max || 100)) * 100;
            const color = ec.mode === 'solid' ? ec.solidColor : (ec.mode === 'dynamic' ? ec.dynB : '#38bdf8');
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
            if (appConfigViz.getAll().autoSwitchVisualEnabled) return;
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
            const previousType = appConfigViz.getAll().type;
            appConfigViz.mutateAll(cfg => { cfg.type = MODES[currentModeIndex]; });
            const cfg = appConfigViz.getAll();
            modeBadge.textContent = `${currentModeIndex + 1}/${MODES.length}`;
            // FIX (12/08/2026, Giang yêu cầu — "icon Effect đổi text theo tên effect đang chạy") —
            // nhãn dưới icon #btn-cycle-mode giờ hiện ĐÚNG tên hiệu ứng đang chạy, CÙNG khuôn
            // #eq-badge-label (core/eq-presets.js::syncEqBadgeLabel()), thay vì chữ tĩnh "Hiệu ứng"
            // cố định trước đây.
            if (modeCycleLabel) modeCycleLabel.textContent = t(VISUALIZER_TYPE_LABEL_KEYS[cfg.type] || cfg.type);

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
                        const dustCount = getEffectConfig('space').dustCount; // core/custom-effect.js
                        const dustMesh = buildSpaceDustMesh(dustCount, SPACE_DUST_RANGE, appState.get('spGlowTexture'));
                        appState.get('spScene').add(dustMesh);
                        appState.set('spDustMesh', dustMesh);
                        appState.set('spGalaxyTypeBag', []); // túi xáo trộn hình thái, rỗng lúc đầu tự nạp lại ở lần spawn đầu tiên
                        appState.set('spTotalGalaxiesSpawned', 0);
                        // VIẾT LẠI (26/08/2026, phản hồi Giang — mô hình cụm thiên hà, thay hẳn
                        // bản đồ TĨNH + travel/rotate 2 pha cũ, xem đầu core/webgl/three-space.js)
                        // — KHÔNG dựng sẵn 5 cụm ở ĐÂY (mảng `spCurrentClusters` rỗng bên dưới tự
                        // báo hiệu "chưa dựng" cho event/workflow/visualizer-render.js::_tickSpace()
                        // tự phát hiện ở lần tick ĐẦU TIÊN và tự sinh 5 cụm + chọn cụm đầu tiên —
                        // tránh trùng lặp logic "sinh cụm" ở 2 nơi khác nhau).
                        appState.set('spCurrentClusters', []);
                        appState.set('spTargetCluster', undefined);
                        appState.set('spClusterSwitchPending', false);
                        appState.set('spTargetGalaxy', undefined);
                        appState.set('spPhase', 'clusterRotate');
                        appState.set('spForward', undefined);
                        appState.set('spRotateFromForward', undefined);
                        appState.set('spRotateToForward', undefined);
                        appState.set('spRotateElapsed', 0);
                        appState.set('spRotateDuration', 0);
                        appState.set('spTravelStartPos', undefined);
                        appState.set('spTravelNextPos', undefined);
                        appState.set('spTravelDistanceCovered', 0);
                        appState.set('spTravelTotalDistance', 0);
                        appState.set('spTravelSpeedRandomFactor', 1);
                        appState.set('spGalaxyTravelMidPos', undefined);
                        appState.set('spGalaxyTravelFromForward', undefined);
                        appState.set('spGalaxyTravelToForward', undefined);
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

            if(appState.get('analyser')) { appState.get('analyser').fftSize = (cfg.type === 'vortex' || cfg.type === 'lightning') ? APP_CONFIG.fftSizeHighRes : APP_CONFIG.fftSizeStandard; allocateBuffers(); }
        }

        // (Phần B, Galaxy — updateSpaceStyleUI() ĐÃ BỎ 21/07/2026, cùng panel tinh chỉnh reroll/jump)

        // applyEQPreset(mode) ĐÃ XOÁ HẲN — THAY bằng applyEqGains() (core/eq-presets.js).

        /**
         * `applyBgImage()`/`applyBgImageEnabled()` KHÔNG tự gọi `updatePlaylistBg()`/`saveConfig()`
         * nội bộ (Rule 0.5, batch "nền chung") — nơi gọi (Workflow) tự lo, xem event/workflow/
         * theme.js::pickNewBackgroundImage()/_commitThemeMode(). `bgImageEnableToggle.checked =
         * true` GIỮ NGUYÊN — ghi DOM tĩnh đơn giản, không phải core-gọi-core, không thuộc phạm vi
         * Rule 3.
         *
         * @param {Blob} file - Blob ảnh (từ store `images` qua picker Generic Drawer — KHÔNG
         *        validate định dạng ở đây, ảnh trong store `images` đã hợp lệ từ lúc upload vào đó)
         */
        async function applyBgImage(file) {
            await setMeta('bgImage', file);
            appConfigViz.mutateAll(cfg => {
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
            appConfigViz.mutateAll(cfg => {
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
            appConfigViz.mutateAll(cfg => { cfg.bgBlur = value; });
            valBgBlurDisplay.textContent = value + 'px';
        }

        /** Core thuần: màu bắt đầu (from) của Theme mode "Gradient" — màu NỀN app, khác màu vẽ
         * effect. @param {string} value */
        function setThemeGradientFrom(value) {
            appConfigViz.mutateAll(cfg => { cfg.gradientFrom = value; });
        }

        /** Core thuần: màu kết thúc (to) của Theme mode "Gradient". @param {string} value */
        function setThemeGradientTo(value) {
            appConfigViz.mutateAll(cfg => { cfg.gradientTo = value; });
        }

        /** Âm lượng tổng (masterGainNode). msg.type 'visualizerDisplay.volume.input'. @param {string} value */
        function setVolume(value) {
            appConfigViz.mutateAll(cfg => { cfg.volume = parseInt(value); });
            const volume = appConfigViz.getAll().volume;
            if(appState.get('masterGainNode')) appState.get('masterGainNode').gain.value = volume / 100; saveConfig();
            // Icon loa Volume HUD (core/volume-hud.js) luôn khớp dù đổi âm lượng từ đâu.
            if (typeof syncVolumeHudIcon === 'function') syncVolumeHudIcon(volume);
        }

        // setEQMode(value) ĐÃ XOÁ HẲN (đổi 'eqMode' cũ + updateEQSlidersUI() UI tĩnh cũ) — THAY
        // bằng workflowEqPresets.cyclePreset()/selectPresetForEdit() (event/workflow/eq-presets.js).
