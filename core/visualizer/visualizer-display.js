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
         * Batch D3 — THÊM guard `if (blockMaxHeight)` bao quanh TOÀN BỘ phần đồng bộ UI panel
         * Visualizer Settings (6 block ẩn/hiện theo kiểu hiệu ứng) — hàm này bị gọi từ NHIỀU nguồn
         * NGOÀI panel (select Main, cycle button, timer auto-switch) nên panel có thể đang ĐÓNG
         * (đã bị `.remove()` khỏi DOM, mọi block bên trong là `null`). Phần KHÔNG phụ thuộc panel
         * (badge, three.js, canvas, fftSize) vẫn chạy bình thường ở NGOÀI guard.
         */
        function updateTypeUI() {
            const currentModeIndex = appState.get('currentModeIndex');
            appState.mutate('vizConfig', cfg => { cfg.type = MODES[currentModeIndex]; });
            const cfg = appState.get('vizConfig');
            modeBadge.textContent = `${currentModeIndex + 1}/${MODES.length}`;
            // Đồng bộ select "Kiểu hiệu ứng" trong Settings (ver 8 refine) — updateTypeUI() là
            // điểm DUY NHẤT mọi đường đổi kiểu hiệu ứng đều đi qua (cycle button HOẶC select), nên
            // đặt đồng bộ ở đây đảm bảo 2 UI luôn khớp nhau bất kể đổi từ đâu.
            if (typeof visualizerTypeSelect !== 'undefined' && visualizerTypeSelect) visualizerTypeSelect.value = cfg.type;

            if (cfg.type === 'vortex') {
                if(!appState.get('tInitialized')) initThreeJS();
                updateVortexVisibility();
                // FIX (04/07/2026, mục 4) — 'playlist-hidden' THAY '-translate-y-full' (dọc -> ngang).
                if (!playlistView.classList.contains('playlist-hidden')) {} else { document.getElementById('webgl-canvas').classList.remove('opacity-0'); }
            } else { document.getElementById('webgl-canvas').classList.add('opacity-0'); }

            // GUARD (Batch D3) — mọi block dưới đây sống BÊN TRONG panel Visualizer Settings, panel
            // có thể đang đóng (null) nếu hàm này bị gọi từ select Main/cycle button/timer auto-switch.
            if (blockMaxHeight) {
                blockMaxHeight.classList.add('hidden'); blockBarWidth.classList.add('hidden');
                blockVortex.classList.add('hidden'); blockRain.classList.add('hidden'); blockBarStyle.classList.add('hidden');

                if (cfg.type === 'vortex') { blockVortex.classList.remove('hidden'); blockVortex.classList.add('flex'); }
                else if (cfg.type === 'rain') { blockRain.classList.remove('hidden'); blockRain.classList.add('flex'); }
                else if (cfg.type === 'bar') {
                    // "Độ cao tối đa" vẫn dùng chung cho Bar (cả mirror/cascade); "Độ dày thanh" KHÔNG
                    // áp dụng cho Bar nữa (chỉ Black Hole) — xem updateBarStyleUI cho 2 setting riêng
                    // của kiểu Phản chiếu (số lượng thanh, độ to vòng tròn).
                    blockMaxHeight.classList.remove('hidden'); blockMaxHeight.classList.add('flex');
                    blockBarStyle.classList.remove('hidden'); blockBarStyle.classList.add('flex');
                    updateBarStyleUI();
                }
                else if (cfg.type === 'black hole') {
                    // Black Hole là visual DUY NHẤT còn dùng "Độ dày thanh".
                    blockMaxHeight.classList.remove('hidden'); blockMaxHeight.classList.add('flex');
                    blockBarWidth.classList.remove('hidden'); blockBarWidth.classList.add('flex');
                }
                else if (cfg.type !== 'rubik' && cfg.type !== 'lightning') {
                    blockMaxHeight.classList.remove('hidden'); blockMaxHeight.classList.add('flex');
                }
            }

            if(appState.get('analyser')) { appState.get('analyser').fftSize = (cfg.type === 'vortex' || cfg.type === 'lightning') ? APP_CONFIG.fftSizeHighRes : APP_CONFIG.fftSizeStandard; allocateBuffers(); }
        }

        /** Batch D3 — thêm guard (xem updateTypeUI ở trên); `updateBarStyleUI()` cũng bị gọi từ
         * BÊN TRONG updateTypeUI() (khi panel CHẮC CHẮN đang mở, đã qua guard ngoài) NHƯNG cũng có
         * thể gọi trực tiếp từ Router lúc user đổi `setting-bar-style` — panel chắc chắn mở lúc đó
         * (event bắn ra từ input BÊN TRONG panel) nên guard ở đây chủ yếu phòng vệ cho nguồn gọi từ
         * updateTypeUI() khi type đổi thành 'bar' trong lúc panel đóng (nguồn: select Main/cycle). */
        function updateBarStyleUI() {
            if (!barMirrorOptions) return;
            const isMirror = appState.get('vizConfig').barStyle === 'mirror';
            barMirrorOptions.classList.toggle('hidden', !isMirror);
            barMirrorOptions.classList.toggle('flex', isMirror);
        }

        /** Batch D3 — thêm guard (cùng lý do updateTypeUI). */
        function updateColorMenuUI() {
            const mode = appState.get('vizConfig').mode;
            if (solidColorContainer) {
                if (mode === 'solid') { solidColorContainer.classList.remove('hidden'); dynColorContainer.classList.add('hidden'); dynColorContainer.classList.remove('flex'); }
                else if (mode === 'dynamic') { solidColorContainer.classList.add('hidden'); dynColorContainer.classList.remove('hidden'); dynColorContainer.classList.add('flex'); }
                else { solidColorContainer.classList.add('hidden'); dynColorContainer.classList.add('hidden'); dynColorContainer.classList.remove('flex'); }
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

        /** Độ mờ ảnh nền. msg.type 'visualizerDisplay.bgBlur.input'. @param {string} value */
        function setBgBlur(value) {
            appState.mutate('vizConfig', cfg => { cfg.bgBlur = value; }); valBgBlurDisplay.textContent = value + 'px'; updatePlaylistBg(); saveConfig();
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
