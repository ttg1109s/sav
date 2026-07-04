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
 * ÁP DỤNG /event/ (ver 11, patch 2): TOÀN BỘ 20 `addEventListener` cũ của file này đã CHUYỂN HẾT
 * sang event/listener/visualizer-display.js. Logic nghiệp vụ trước đây nằm thẳng trong callback
 * đã rút thành HÀM CORE THUẦN bên dưới — đối chiếu event/router/visualizer-display.js để biết
 * msg.type nào gọi hàm nào. `applyBgImage()`/`applyBgImageEnabled()` là core thuần KHÔNG còn
 * withLoadingShield/alertModal bên trong (2 thứ này dời ra event/workflow/visualizer-display.js,
 * đúng quy tắc "core không biết shield/modal tồn tại"). FIX (03/07/2026, mục 1) — bỏ hẳn
 * `validateBgImageFile()`/upload file trực tiếp — `applyBgImage()` giờ CHỈ được gọi từ picker
 * (event/workflow/visualizer-display.js::pickBgImageFromLibrary, dùng Blob đã có sẵn trong store
 * `images`, không cần validate lại định dạng file).
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

        function updateTypeUI() {
            const currentModeIndex = appState.get('currentModeIndex');
            appState.mutate('vizConfig', cfg => { cfg.type = MODES[currentModeIndex]; });
            const cfg = appState.get('vizConfig');
            modeBadge.textContent = `${currentModeIndex + 1}/${MODES.length}`;
            // Đồng bộ select "Kiểu hiệu ứng" trong Settings (ver 8 refine) — updateTypeUI() là
            // điểm DUY NHẤT mọi đường đổi kiểu hiệu ứng đều đi qua (cycle button HOẶC select), nên
            // đặt đồng bộ ở đây đảm bảo 2 UI luôn khớp nhau bất kể đổi từ đâu.
            if (typeof visualizerTypeSelect !== 'undefined' && visualizerTypeSelect) visualizerTypeSelect.value = cfg.type;
            blockMaxHeight.classList.add('hidden'); blockBarWidth.classList.add('hidden');
            blockVortex.classList.add('hidden'); blockRain.classList.add('hidden'); blockBarStyle.classList.add('hidden');
            
            if (cfg.type === 'vortex') {
                if(!appState.get('tInitialized')) initThreeJS();
                updateVortexVisibility();
                // FIX (04/07/2026, mục 4) — 'playlist-hidden' THAY '-translate-y-full' (dọc -> ngang).
                if (!playlistView.classList.contains('playlist-hidden')) {} else { document.getElementById('webgl-canvas').classList.remove('opacity-0'); }
            } else { document.getElementById('webgl-canvas').classList.add('opacity-0'); }

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

            if(appState.get('analyser')) { appState.get('analyser').fftSize = (cfg.type === 'vortex' || cfg.type === 'lightning') ? APP_CONFIG.fftSizeHighRes : APP_CONFIG.fftSizeStandard; allocateBuffers(); }
        }

        function updateBarStyleUI() {
            const isMirror = appState.get('vizConfig').barStyle === 'mirror';
            barMirrorOptions.classList.toggle('hidden', !isMirror);
            barMirrorOptions.classList.toggle('flex', isMirror);
        }

        function updateColorMenuUI() {
            const mode = appState.get('vizConfig').mode;
            if (mode === 'solid') { solidColorContainer.classList.remove('hidden'); dynColorContainer.classList.add('hidden'); dynColorContainer.classList.remove('flex'); } 
            else if (mode === 'dynamic') { solidColorContainer.classList.add('hidden'); dynColorContainer.classList.remove('hidden'); dynColorContainer.classList.add('flex'); } 
            else { solidColorContainer.classList.add('hidden'); dynColorContainer.classList.add('hidden'); dynColorContainer.classList.remove('flex'); }
            updateProgressBarCSS();
        }

        function applyEQPreset(mode) {
            const eqBandNodes = appState.get('eqBandNodes');
            if (!eqBandNodes || eqBandNodes.length === 0) return;
            const gains = mode === 'manual' ? appState.get('vizConfig').manualEq : (EQ_PRESETS[mode] || EQ_PRESETS['flat']);
            for(let i = 0; i < eqBandNodes.length; i++) { if(eqBandNodes[i]) eqBandNodes[i].gain.value = gains[i] || 0; }
        }

        /** Đổi chất lượng canvas (low/medium/high...). msg.type 'visualizerDisplay.quality.change'. */
        function setVisualizerQuality(value) {
            appState.mutate('vizConfig', cfg => { cfg.quality = value; }); resizeCanvas(); saveConfig();
        }

        /**
         * Lưu ảnh nền mới vào IndexedDB + áp dụng vào vizConfig/UI. Core thuần, KHÔNG tự bọc
         * shield (workflow bọc withLoadingShield() quanh lệnh gọi hàm async này — xem quy tắc
         * "core không biết shield/modal tồn tại").
         * @param {Blob} file - Blob ảnh (từ store `images` qua picker — xem
         *        event/workflow/visualizer-display.js::pickBgImageFromLibrary; KHÔNG còn validate
         *        định dạng ở đây, ảnh trong store `images` đã hợp lệ từ lúc upload vào đó)
         */
        async function applyBgImage(file) {
            await setMeta('bgImage', file);
            appState.mutate('vizConfig', cfg => {
                if (cfg.bgImage && cfg.bgImage.startsWith('blob:')) URL.revokeObjectURL(cfg.bgImage);
                cfg.bgImage = URL.createObjectURL(file);
                cfg.bgImageEnabled = true;
            });
            bgImageEnableToggle.checked = true;
            updatePlaylistBg(); saveConfig();
        }

        /**
         * Bật/tắt dùng ảnh nền (checkbox). Core thuần xử lý phần state/DOM — KHÔNG tự bọc shield.
         * FIX (04/07/2026, mục 1 phản hồi Giang — ĐẢO NGƯỢC quyết định trước, xem lịch sử patch):
         * TẮT KHÔNG CÒN xoá `meta.bgImage` trong IndexedDB nữa — chỉ dọn object URL runtime, GIỮ
         * NGUYÊN Blob thật để lần "gạt On" kế tiếp kích hoạt lại NGAY qua `applyBgImage()` (đọc lại
         * chính blob này) mà KHÔNG cần mở lại picker.
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
            updatePlaylistBg(); saveConfig();
        }

        /** Độ mờ ảnh nền. msg.type 'visualizerDisplay.bgBlur.input'. @param {string} value */
        function setBgBlur(value) {
            appState.mutate('vizConfig', cfg => { cfg.bgBlur = value; }); valBgBlurDisplay.textContent = value + 'px'; updatePlaylistBg(); saveConfig();
        }

        /** Màu nền (khi không dùng ảnh). msg.type 'visualizerDisplay.bgColor.input'. @param {string} value */
        function setBgColor(value) {
            appState.mutate('vizConfig', cfg => { cfg.bgColor = value; }); updateDOMBackground(); saveConfig();
        }

        /** Chế độ màu visualizer (solid/dynamic/none). msg.type 'visualizerDisplay.colorMode.change'. @param {string} value */
        function setColorMode(value) {
            appState.mutate('vizConfig', cfg => { cfg.mode = value; }); updateColorMenuUI(); saveConfig();
        }

        /** Màu solid từ color picker. msg.type 'visualizerDisplay.solidColor.pickerInput'. @param {string} value */
        function setSolidColorFromPicker(value) {
            appState.mutate('vizConfig', cfg => { cfg.solidColor = value; }); solidColorText.value = value; updateProgressBarCSS(); saveConfig();
        }

        /**
         * Màu solid từ ô nhập text hex — chỉ áp dụng khi đúng định dạng #RRGGBB, không thì bỏ qua
         * im lặng (giữ đúng hành vi gốc, không báo lỗi). msg.type
         * 'visualizerDisplay.solidColor.textInput'. @param {string} value
         */
        function setSolidColorFromText(value) {
            if (!/^#[0-9A-F]{6}$/i.test(value)) return;
            appState.mutate('vizConfig', cfg => { cfg.solidColor = value; }); solidColorPicker.value = value; updateProgressBarCSS(); saveConfig();
        }

        /** Màu A của gradient động. msg.type 'visualizerDisplay.dynColorA.input'. @param {string} value */
        function setDynColorA(value) {
            appState.mutate('vizConfig', cfg => { cfg.dynA = value; }); saveConfig();
        }

        /** Màu B của gradient động (cũng là màu thanh tiến trình lúc mode='dynamic'). msg.type
         * 'visualizerDisplay.dynColorB.input'. @param {string} value */
        function setDynColorB(value) {
            appState.mutate('vizConfig', cfg => { cfg.dynB = value; }); updateProgressBarCSS(); saveConfig();
        }

        /** Kiểu hiệu ứng Vortex con. msg.type 'visualizerDisplay.vortexStyle.change'. @param {string} value */
        function setVortexStyle(value) {
            appState.mutate('vizConfig', cfg => { cfg.vortexStyle = value; }); updateVortexVisibility(); saveConfig();
        }

        /** Kiểu hiệu ứng Bar con (mirror/cascade). msg.type 'visualizerDisplay.barStyle.change'. @param {string} value */
        function setBarStyle(value) {
            appState.mutate('vizConfig', cfg => { cfg.barStyle = value; }); updateBarStyleUI(); saveConfig();
        }

        /** Kiểu hiệu ứng Rain con. msg.type 'visualizerDisplay.rainStyle.change'. @param {string} value */
        function setRainStyle(value) {
            appState.mutate('vizConfig', cfg => { cfg.rainStyle = value; }); resizeCanvas(); saveConfig();
        }

        /** Bật/tắt hiệu ứng chớp kính (Rain). msg.type 'visualizerDisplay.glassFlash.change'. @param {boolean} checked */
        function setGlassFlash(checked) {
            appState.mutate('vizConfig', cfg => { cfg.glassFlash = checked; }); saveConfig();
        }

        /** Độ cao tối đa của bar. msg.type 'visualizerDisplay.maxHeight.input'. @param {string} value */
        function setMaxHeight(value) {
            appState.mutate('vizConfig', cfg => { cfg.maxH = parseInt(value); }); valMaxDisplay.textContent = appState.get('vizConfig').maxH; saveConfig();
        }

        /** Độ dày thanh (Black Hole). msg.type 'visualizerDisplay.barWidth.input'. @param {string} value */
        function setBarWidth(value) {
            appState.mutate('vizConfig', cfg => { cfg.barWidth = parseInt(value); }); valWidthDisplay.textContent = appState.get('vizConfig').barWidth; saveConfig();
        }

        /** Số lượng thanh mirror. msg.type 'visualizerDisplay.mirrorCount.input'. @param {string} value */
        function setMirrorCount(value) {
            appState.mutate('vizConfig', cfg => { cfg.mirrorBarCount = parseInt(value); }); valMirrorCountDisplay.textContent = appState.get('vizConfig').mirrorBarCount; saveConfig();
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
