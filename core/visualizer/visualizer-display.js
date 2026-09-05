/**
 * Cài đặt hiển thị Visualizer: kiểu hiệu ứng (CLICK #btn-cycle-mode mở modal chọn effect — MỚI
 * 05/09/2026, xem openEffectPickerModal()/applyVisualizerStyleChoice()), ảnh nền, độ mờ nền,
 * volume, EQ preset, vẽ lại CSS thanh tiến trình theo màu effect đang chạy.
 *
 * Màu sắc/blur/style con/kích thước hình học (12/08/2026 trở về trước từng ở đây) ĐÃ DỜI HẲN sang
 * customEffect[group] riêng từng group — xem core/custom-effect.js + event/workflow/custom-effect.js
 * (Custom Effect Drawer, mở qua GIỮ 1.5s #btn-cycle-mode — KHÔNG đổi, vẫn mở thẳng Drawer).
 *
 * [SỬA — 05/09/2026, yêu cầu Giang, "group hoá" effect picker] `MODES` (service/state/
 * visualizer-runtime.js) giờ là 12 STYLE con phẳng (trước đây 7 GROUP) — `cfg.type` = GROUP,
 * style con hiện tại lưu ở `cfg.customEffect[group][GROUP_STYLE_FIELD[group]]`. Icon hiện tên
 * STYLE (VISUALIZER_STYLE_LABEL_KEYS), modal chọn effect (CLICK) cho chọn thẳng group + style
 * bất kỳ thay vì phải bấm nhiều lần mới tới đúng cái cần.
 *
 * PHẢI nạp SAU: core/player-controls.js, core/dom-refs.js, core/config.js, core/custom-effect.js,
 * service/state/visualizer-runtime.js (MODES/EFFECT_GROUPS/STYLE_TO_GROUP/GROUP_STYLE_FIELD),
 * service/z-index.js (Z_INDEX, openEffectPickerModal()).
 */
        // Biến NỘI BỘ (KHÔNG thuộc STATE): lưu tạm tone mapping mặc định của renderer dùng chung
        // (Vortex) để trả lại đúng giá trị khi rời khỏi 'space' — xem updateTypeUI() bên dưới.
        let _spDefaultToneMapping = null;
        // Bán kính vùng trôi của SpaceDust (đơn vị Three.js) — hằng số cấu hình.
        const SPACE_DUST_RANGE = 500;

        // [SỬA — 05/09/2026, yêu cầu Giang, "group hoá" effect picker] Key i18n tên hiển thị CHO
        // TỪNG STYLE con (không phải group nữa) — nhãn dưới icon #btn-cycle-mode + header Custom
        // Effect Drawer (components/custom-effect-drawer.js) giờ hiện tên STYLE. TÁI DÙNG bộ text
        // đã có ở Custom Effect Drawer/Settings (visualizerSettingsDrawer.*Style.*), 3 style
        // "black hole"/"rubik"/"galaxy explore" cần thêm i18n key mới (trước đây là tên GROUP,
        // không phải "style con", nên chưa có key dạng barStyle.blackHole/shapeStyle.rubik/
        // spaceStyle.galaxyExplore — xem lang/patch/patch-visualizer.js).
        const VISUALIZER_STYLE_LABEL_KEYS = {
            mirror: 'visualizerSettingsDrawer.barStyle.mirror',
            cascade: 'visualizerSettingsDrawer.barStyle.cascade',
            'black hole': 'visualizerSettingsDrawer.barStyle.blackHole',
            thunder: 'visualizerSettingsDrawer.lightingStyle.thunder',
            fireworks: 'visualizerSettingsDrawer.lightingStyle.fireworks',
            glass: 'visualizerSettingsDrawer.rainStyle.glass',
            street: 'visualizerSettingsDrawer.rainStyle.street',
            rings: 'visualizerSettingsDrawer.vortexStyle.rings',
            bars: 'visualizerSettingsDrawer.vortexStyle.bars',
            wave: 'visualizerSettingsDrawer.vortexStyle.wave',
            rubik: 'visualizerSettingsDrawer.shapeStyle.rubik',
            'galaxy explore': 'visualizerSettingsDrawer.spaceStyle.galaxyExplore',
        };

        // Key i18n tên hiển thị CHO TỪNG GROUP — dùng ở dropdown 1 (chọn group) của modal chọn
        // effect, xem openEffectPickerModal() bên dưới. 4/6 group TÁI DÙNG nguyên nhãn "type" cũ
        // (bar/lighting/rain/vortex không đổi tên); 'shape' MỚI (trước đây group tên 'rubik');
        // 'space' TÁI DÙNG nhãn cũ (group không đổi tên, chỉ style bên trong đổi thành
        // "galaxy explore").
        const VISUALIZER_GROUP_LABEL_KEYS = {
            bar: 'settingsVisualizer.type.bar',
            lighting: 'settingsVisualizer.type.lighting',
            rain: 'settingsVisualizer.type.rain',
            vortex: 'settingsVisualizer.type.vortex',
            shape: 'settingsVisualizer.group.shape',
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
         * [MỚI — 05/09/2026, yêu cầu Giang] Áp 1 STYLE cụ thể đã chọn (modal chọn effect, mở qua
         * CLICK #btn-cycle-mode — xem openEffectPickerModal() bên dưới) — KHÔNG check
         * autoSwitchVisualEnabled (khác cycleVisualizerType() cũ ĐÃ XOÁ: người dùng CHỦ ĐỘNG mở
         * modal + chọn, nút cycle tự khoá cứng — disabled — khi auto-switch đang bật nên modal
         * còn không mở được nếu tính năng đó đang bật, xem updateCycleModeButtonState(),
         * core/auto-switch-visual.js). Refresh thêm resizeCanvas()/updateVortexVisibility() khi
         * cần — CÙNG lý do + CÙNG chỗ gọi với `#ce-style` dropdown cũ ĐÃ BỎ (components/
         * custom-effect-drawer.js).
         * @param {string} style - 1 trong MODES (service/state/visualizer-runtime.js)
         */
        function applyVisualizerStyleChoice(style) {
            const idx = MODES.indexOf(style);
            if (idx === -1) return;
            appState.set('currentModeIndex', idx);
            updateTypeUI();
            saveConfig();
            const group = STYLE_TO_GROUP[style];
            if (group === 'rain') resizeCanvas();
            else if (group === 'vortex') updateVortexVisibility();
        }

        /**
         * [MỚI — 05/09/2026, yêu cầu Giang, "cải tiến -> modal choice, 2 dropdown + select"] Modal
         * chọn effect: dropdown 1 = GROUP (Object.keys(EFFECT_GROUPS), service/state/
         * visualizer-runtime.js), dropdown 2 = STYLE con của group ĐANG chọn ở dropdown 1 — đổi
         * dropdown 1 tự nạp lại dropdown 2 theo đúng group mới. Bấm "Chọn" gọi `onConfirm(style)`
         * với style ĐANG chọn ở dropdown 2, bấm "Huỷ" chỉ đóng modal.
         *
         * KHÔNG dùng `modalChoice()` (core/modal-choice-ui.js) — component đó chỉ hỗ trợ ĐÚNG 1
         * dropdown phẳng (N lựa chọn -> 1 hành động), không có khái niệm "2 dropdown lồng nhau, đổi
         * cái này nạp lại cái kia". Modal này TỰ DỰNG DOM riêng — CÙNG phong cách thị giác (class
         * Tailwind, `Z_INDEX.MODAL_CHOICE`) để nhất quán, KHÔNG sửa/mở rộng `modal-choice-ui.js`
         * (tránh rủi ro cho mọi chỗ khác đang dùng `modalChoice()` chung trong app).
         *
         * Mở qua CLICK #btn-cycle-mode (`onCycleModeClick()`, event/workflow/custom-effect.js) —
         * GIỮ (hold) KHÔNG đụng, vẫn mở thẳng Custom Effect Drawer như trước.
         * @param {function(string):void} onConfirm - nhận style con ĐÃ chọn khi bấm "Chọn".
         */
        function openEffectPickerModal(onConfirm) {
            const stale = document.getElementById('effect-picker-overlay');
            if (stale) stale.remove();

            const currentStyle = MODES[appState.get('currentModeIndex')];
            const currentGroup = STYLE_TO_GROUP[currentStyle];

            const overlay = document.createElement('div');
            overlay.id = 'effect-picker-overlay';
            overlay.className = 'fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center px-5';
            overlay.style.zIndex = String(Z_INDEX.MODAL_CHOICE); // service/z-index.js — cùng lớp modalChoice()

            const card = document.createElement('div');
            card.className = 'bg-[#0f172a] border border-white/10 rounded-2xl w-full max-w-sm p-5 shadow-2xl flex flex-col gap-4';

            const titleEl = document.createElement('h3');
            titleEl.className = 'text-base font-bold text-white';
            titleEl.textContent = t('effectPicker.title');
            card.appendChild(titleEl);

            function buildSelectRow(labelKey) {
                const row = document.createElement('div');
                row.className = 'flex flex-col gap-1';
                const label = document.createElement('span');
                label.className = 'text-xs text-slate-400';
                label.textContent = t(labelKey);
                const select = document.createElement('select');
                select.className = 'w-full py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-600 text-sm text-white outline-none';
                row.appendChild(label);
                row.appendChild(select);
                card.appendChild(row);
                return select;
            }

            const groupSelect = buildSelectRow('effectPicker.groupLabel');
            Object.keys(EFFECT_GROUPS).forEach((group) => { // service/state/visualizer-runtime.js
                const opt = document.createElement('option');
                opt.value = group;
                opt.textContent = t(VISUALIZER_GROUP_LABEL_KEYS[group] || group);
                if (group === currentGroup) opt.selected = true;
                groupSelect.appendChild(opt);
            });

            const styleSelect = buildSelectRow('effectPicker.styleLabel');
            function populateStyles(group, preselectStyle) {
                styleSelect.innerHTML = '';
                EFFECT_GROUPS[group].forEach((style) => {
                    const opt = document.createElement('option');
                    opt.value = style;
                    opt.textContent = t(VISUALIZER_STYLE_LABEL_KEYS[style] || style);
                    if (style === preselectStyle) opt.selected = true;
                    styleSelect.appendChild(opt);
                });
            }
            populateStyles(currentGroup, currentStyle);
            // Đổi group -> nạp lại style theo group MỚI — không giữ style cũ (khác group thì
            // không còn nghĩa lý), luôn chọn style ĐẦU TIÊN của group mới.
            groupSelect.addEventListener('change', () => populateStyles(groupSelect.value, null));

            function closeModal() { overlay.remove(); }

            const btnRow = document.createElement('div');
            btnRow.className = 'flex gap-3 mt-1';
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors';
            cancelBtn.textContent = t('common.cancel');
            cancelBtn.addEventListener('click', closeModal);
            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold transition-colors';
            confirmBtn.textContent = t('common.select');
            confirmBtn.addEventListener('click', () => {
                const chosenStyle = styleSelect.value;
                closeModal();
                onConfirm(chosenStyle);
            });
            btnRow.appendChild(cancelBtn);
            btnRow.appendChild(confirmBtn);
            card.appendChild(btnRow);

            overlay.appendChild(card);
            document.body.appendChild(overlay);
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
         *
         * [SỬA — 05/09/2026, yêu cầu Giang, "group hoá" effect picker] `MODES[currentModeIndex]`
         * giờ là 1 STYLE con phẳng (không phải group) — suy ra `group`/`styleField` từ
         * STYLE_TO_GROUP/GROUP_STYLE_FIELD (service/state/visualizer-runtime.js) rồi ghi CẢ
         * `cfg.type` (= group) LẪN `cfg.customEffect[group][styleField]` (= style). Nhãn icon
         * (`modeCycleLabel`) giờ hiện tên STYLE (VISUALIZER_STYLE_LABEL_KEYS), không phải tên
         * group nữa.
         */
        function updateTypeUI() {
            const currentModeIndex = appState.get('currentModeIndex');
            // MỚI (Phần B, Galaxy) — bắt lại kiểu CŨ TRƯỚC khi ghi đè, cần biết có đang RỜI KHỎI
            // 'space' hay không (trả tone mapping renderer dùng chung về mặc định của Vortex).
            const previousType = appConfigViz.getAll().type;
            const style = MODES[currentModeIndex];
            const group = STYLE_TO_GROUP[style];
            const styleField = GROUP_STYLE_FIELD[group];
            appConfigViz.mutateAll(cfg => {
                cfg.type = group;
                if (!cfg.customEffect[group]) cfg.customEffect[group] = { ...DEFAULT_CUSTOM_EFFECT[group] };
                cfg.customEffect[group][styleField] = style;
            });
            const cfg = appConfigViz.getAll();
            modeBadge.textContent = `${currentModeIndex + 1}/${MODES.length}`;
            // FIX (12/08/2026, Giang yêu cầu — "icon Effect đổi text theo tên effect đang chạy") —
            // nhãn dưới icon #btn-cycle-mode giờ hiện ĐÚNG tên hiệu ứng đang chạy, CÙNG khuôn
            // #eq-badge-label (core/eq-presets.js::syncEqBadgeLabel()), thay vì chữ tĩnh "Hiệu ứng"
            // cố định trước đây. SỬA (05/09/2026) — hiện tên STYLE (không phải group).
            if (modeCycleLabel) modeCycleLabel.textContent = t(VISUALIZER_STYLE_LABEL_KEYS[style] || style);

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

            // fftSizeHighRes cho 'vortex' (mượt tunnel) và 'lighting' (cả 2 style thunder/
            // fireworks đều đọc vizDataArray theo bin cụ thể, cần độ phân giải phổ cao hơn).
            if(appState.get('analyser')) { appState.get('analyser').fftSize = (cfg.type === 'vortex' || cfg.type === 'lighting') ? APP_CONFIG.fftSizeHighRes : APP_CONFIG.fftSizeStandard; allocateBuffers(); }
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
