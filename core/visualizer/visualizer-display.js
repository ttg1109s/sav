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
 * core/modal-choice-ui.js (modalChoice() — TÁI DÙNG cho openEffectPickerModal(), không tự dựng
 * modal riêng).
 */
        // [XOÁ — 15/09/2026, yêu cầu Giang, "dọn sạch visualizer effect space"] Group "space"
        // (Galaxy Journey) đã BỎ HẲN — 2 biến nội bộ _spDefaultToneMapping/SPACE_DUST_RANGE trước
        // đây ở đây (chỉ dùng trong nhánh 'space' của updateTypeUI()) đã xoá theo, cùng entry
        // 'galaxy explore'/'space' bên dưới.

        // [SỬA — 05/09/2026, yêu cầu Giang, "group hoá" effect picker] Key i18n tên hiển thị CHO
        // TỪNG STYLE con (không phải group nữa) — nhãn dưới icon #btn-cycle-mode + header Custom
        // Effect Drawer (components/custom-effect-drawer.js) giờ hiện tên STYLE. TÁI DÙNG bộ text
        // đã có ở Custom Effect Drawer/Settings (visualizerSettingsDrawer.*Style.*), 2 style
        // "black hole"/"rubik" cần thêm i18n key mới (trước đây là tên GROUP, không phải "style
        // con", nên chưa có key dạng barStyle.blackHole/shapeStyle.rubik — xem lang/patch/
        // patch-visualizer.js).
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
            synapse: 'visualizerSettingsDrawer.connectorStyle.synapse',
            circuit: 'visualizerSettingsDrawer.connectorStyle.circuit',
            brain: 'visualizerSettingsDrawer.connectorStyle.brain',
        };

        // Key i18n tên hiển thị CHO TỪNG GROUP — dùng ở dropdown 1 (chọn group) của modal chọn
        // effect, xem openEffectPickerModal() bên dưới. 4/5 group TÁI DÙNG nguyên nhãn "type" cũ
        // (bar/lighting/rain/vortex không đổi tên); 'shape' MỚI (trước đây group tên 'rubik').
        const VISUALIZER_GROUP_LABEL_KEYS = {
            bar: 'settingsVisualizer.type.bar',
            lighting: 'settingsVisualizer.type.lighting',
            rain: 'settingsVisualizer.type.rain',
            vortex: 'settingsVisualizer.type.vortex',
            shape: 'settingsVisualizer.group.shape',
            connector: 'settingsVisualizer.type.connector',
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
         * @param {HTMLElement} webglCanvasEl - canvas WebGL (#webgl-canvas, Vortex)
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
         * [SỬA — 05/09/2026, yêu cầu Giang, "modal choice hỗ trợ html, dùng 2 dropdown đồng thời"]
         * Modal chọn effect: TÁI DÙNG THẲNG `modalChoice()` có sẵn (core/modal-choice-ui.js) — CHỈ
         * 1 LẦN GỌI DUY NHẤT (KHÔNG còn 2 modal nối tiếp như bản trước) — 2 dropdown (group + style
         * con của group đang chọn) nhét vào CÙNG 1 modal qua `options.bodyHtml` (HTML tự do,
         * modalChoice() đã hỗ trợ sẵn cho đúng trường hợp "nội dung không hợp trong 1 dòng text
         * đơn giản"). `choices` truyền ĐÚNG 1 lựa chọn thật ("Chọn") — modalChoice() tự render hàng
         * [Huỷ][Chọn] (≤1 lựa chọn thật, xem docstring `modalChoice()`) — bấm "Chọn" mới đọc giá
         * trị 2 dropdown lúc đó qua `document.getElementById()` (DOM đã có sẵn trong `document.body`
         * ngay khi `modalChoice()` return — đồng bộ, không cần đợi gì thêm) rồi gọi `onConfirm(style)`.
         *
         * Đổi dropdown 1 (group) tự nạp lại dropdown 2 (style) theo group mới — wiring 'change'
         * gắn NGAY SAU lời gọi `modalChoice()` (cùng lý do: DOM đã tồn tại đồng bộ).
         *
         * Mở qua CLICK #btn-cycle-mode (`onCycleModeClick()`, event/workflow/custom-effect.js) —
         * GIỮ (hold) KHÔNG đụng, vẫn mở thẳng Custom Effect Drawer như trước.
         * @param {function(string):void} onConfirm - nhận style con ĐÃ chọn khi bấm "Chọn".
         */
        function openEffectPickerModal(onConfirm) {
            const currentStyle = MODES[appState.get('currentModeIndex')];
            const currentGroup = STYLE_TO_GROUP[currentStyle];

            function renderStyleOptions(group, preselectStyle) {
                return EFFECT_GROUPS[group].map((style) => // service/state/visualizer-runtime.js
                    `<option value="${style}" ${style === preselectStyle ? 'selected' : ''}>${t(VISUALIZER_STYLE_LABEL_KEYS[style] || style)}</option>`
                ).join('');
            }
            const groupOptions = Object.keys(EFFECT_GROUPS).map((group) =>
                `<option value="${group}" ${group === currentGroup ? 'selected' : ''}>${t(VISUALIZER_GROUP_LABEL_KEYS[group] || group)}</option>`
            ).join('');

            const bodyHtml = `
                <div class="flex flex-col gap-3">
                    <div class="flex flex-col gap-1">
                        <span class="text-xs text-slate-400">${t('effectPicker.groupLabel')}</span>
                        <select id="effect-picker-group" class="w-full py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-600 text-sm text-white outline-none">${groupOptions}</select>
                    </div>
                    <div class="flex flex-col gap-1">
                        <span class="text-xs text-slate-400">${t('effectPicker.styleLabel')}</span>
                        <select id="effect-picker-style" class="w-full py-2.5 px-3 rounded-xl bg-slate-800 border border-slate-600 text-sm text-white outline-none">${renderStyleOptions(currentGroup, currentStyle)}</select>
                    </div>
                </div>
            `;

            // Khai TRƯỚC (chưa gán) — onClick bên dưới CHỈ đọc lúc bấm "Chọn" (rất sau, sau khi 2
            // dòng querySelector cuối hàm đã chạy xong) nên đóng vai trò biến CHUNG bình thường,
            // không phải lỗi thứ tự khai báo.
            let groupSelect, styleSelect;

            modalChoice('', [ // core/modal-choice-ui.js — text='' (nội dung thật nằm ở bodyHtml)
                {
                    label: t('common.select'),
                    className: 'flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors', themeKeys: 'btnPrimaryBg btnPrimaryHoverBg textOnAccent',
                    // FIX QUAN TRỌNG: modalChoice() tự đóng modal (gỡ khỏi DOM) NGAY TRƯỚC khi gọi
                    // onClick (xem docstring/_appendButtonRow() modalChoice() — `closeModal()` LUÔN
                    // chạy trước) — lúc onClick này thực thi, `#effect-picker-style` KHÔNG CÒN nằm
                    // trong `document` nữa, `document.getElementById()` sẽ trả `null`. Đọc qua
                    // THAM CHIẾU `styleSelect` đã giữ sẵn (biến JS, không phải querySelector lại) —
                    // đọc `.value` trên phần tử ĐÃ GỠ KHỎI DOM vẫn hoạt động bình thường (thuộc
                    // tính của node JS không mất khi chỉ bị gỡ khỏi cây DOM).
                    onClick: () => onConfirm(styleSelect.value),
                },
            ], { title: t('effectPicker.title'), bodyHtml });

            // DOM đã có sẵn (modalChoice() dựng + gắn document.body ĐỒNG BỘ, không async) — giữ
            // tham chiếu NGAY ở đây (KHÔNG được query lại trong onClick ở trên — xem FIX ngay trên).
            groupSelect = document.getElementById('effect-picker-group');
            styleSelect = document.getElementById('effect-picker-style');
            groupSelect.addEventListener('change', () => {
                styleSelect.innerHTML = renderStyleOptions(groupSelect.value, null);
            });
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
            const style = MODES[currentModeIndex];
            const group = STYLE_TO_GROUP[style];
            const styleField = GROUP_STYLE_FIELD[group];
            appConfigViz.mutateAll(cfg => {
                cfg.type = group;
                if (!cfg.customEffect[group]) cfg.customEffect[group] = { ...DEFAULT_CUSTOM_EFFECT[group] };
                cfg.customEffect[group][styleField] = style;
            });
            const cfg = appConfigViz.getAll();
            // BỎ (05/09/2026, yêu cầu Giang) — trước đây có dòng `modeBadge.textContent =
            // "${currentModeIndex + 1}/${MODES.length}"` ghi số thứ tự "x/tổng" lên badge góc icon
            // — badge đó (`#mode-badge`, components/visualizer-overlay.js) ĐÃ XOÁ khỏi HTML, không
            // còn hiện đếm số nữa.
            // FIX (12/08/2026, Giang yêu cầu — "icon Effect đổi text theo tên effect đang chạy") —
            // nhãn dưới icon #btn-cycle-mode giờ hiện ĐÚNG tên hiệu ứng đang chạy, CÙNG khuôn
            // #eq-badge-label (core/eq-presets.js::syncEqBadgeLabel()), thay vì chữ tĩnh "Hiệu ứng"
            // cố định trước đây. SỬA (05/09/2026) — hiện tên STYLE (không phải group).
            if (modeCycleLabel) modeCycleLabel.textContent = t(VISUALIZER_STYLE_LABEL_KEYS[style] || style);

            if (cfg.type === 'vortex' || cfg.type === 'connector') {
                // 2 group dùng CHUNG canvas #webgl-canvas + tRenderer, scene RIÊNG mỗi group.
                if (cfg.type === 'vortex') { if (!appState.get('tInitialized')) initThreeJS(); updateVortexVisibility(); }
                else { if (!appState.get('cnInitialized')) initThreeJSConnector(); updateConnectorVisibility(); } // core/webgl/three-connector.js
                // FIX (04/07/2026, mục 4) — 'playlist-hidden' THAY '-translate-y-full', giờ ở
                // `#app-stack` (components/app-view-stack.js), KHÔNG phải `#side-left-container`.
                if (!appStack.classList.contains('playlist-hidden')) {} else { document.getElementById('webgl-canvas').classList.remove('opacity-0'); }
            } else {
                document.getElementById('webgl-canvas').classList.add('opacity-0');
            }

            if(appState.get('analyser')) { appState.get('analyser').fftSize = needsHighResFft(cfg.type) ? APP_CONFIG.fftSizeHighRes : APP_CONFIG.fftSizeStandard; allocateBuffers(); } // service/state/visualizer-runtime.js
        }

        // (Phần B, Galaxy — updateSpaceStyleUI() ĐÃ BỎ 21/07/2026, cùng panel tinh chỉnh reroll/jump)

        // applyEQPreset(mode) ĐÃ XOÁ HẲN — THAY bằng applyEqGains() (core/eq-presets.js).

        // XOÁ 21/09/2026 (dọn deadcode sau khi nền App đổi sang tham chiếu item thư viện): `applyBgImage()` (copy blob vào meta.bgImage) và
        // `applyBgImageEnabled()` không còn ai gọi — thay bằng workflowTheme._applyPickedMedia()/resolveAppBgMedia() (event/workflow/theme.js, core/config.js).

        /** Core thuần: độ NHOÈ kính các màn App Panel chính (Playlist/Game catalog/Statistics) khi nền Morphin là Background media — MỚI 23/09/2026
         * (THAY `setThemeBgBlur()` blur ảnh nền, Giang bỏ). Ép số nguyên, kẹp 10-40px (SỬA 23/09/2026 — Giang: min 10px). Gọi bởi workflowTheme.setAppGlassBlur(). @param {string|number} value */
        function setAppGlassBlur(value) {
            const px = Math.max(10, Math.min(40, parseInt(value, 10) || 10));
            appConfigViz.mutateAll(cfg => { cfg.appGlassBlur = px; });
            console.log(`writer: "setAppGlassBlur", page: "viz.appGlassBlur", content: "${px}"`);
        }

        /** Core thuần: độ ĐỤC nền trắng của kính các màn App Panel chính — MỚI 23/09/2026. Ép số nguyên, kẹp 5-40% (SỬA 23/09/2026 — Giang: min 5%). Gọi bởi
         * workflowTheme.setAppGlassTint(). @param {string|number} value */
        function setAppGlassTint(value) {
            const pct = Math.max(5, Math.min(40, parseInt(value, 10) || 5));
            appConfigViz.mutateAll(cfg => { cfg.appGlassTint = pct; });
            console.log(`writer: "setAppGlassTint", page: "viz.appGlassTint", content: "${pct}"`);
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

        /** Core thuần: màu của Theme mode "Solid" — MỚI 21/09/2026 (Solid có màu RIÊNG `bgSolidColor`, không dùng chung 2 màu gradient). @param {string} value */
        function setThemeSolidColor(value) {
            appConfigViz.mutateAll(cfg => { cfg.bgSolidColor = value; });
        }

        /** Âm lượng tổng (masterGainNode). msg.type 'visualizerDisplay.volume.input'. @param {string} value */
        function setVolume(value) {
            appConfigViz.mutateAll(cfg => { cfg.volume = parseInt(value); });
            const volume = appConfigViz.getAll().volume;
            if(appState.get('masterGainNode')) appState.get('masterGainNode').gain.value = volume / 100; saveConfig();
            // Icon loa Volume HUD (core/hud.js) luôn khớp dù đổi âm lượng từ đâu.
            if (typeof syncVolumeHudIcon === 'function') syncVolumeHudIcon(volume);
        }

        // setEQMode(value) ĐÃ XOÁ HẲN (đổi 'eqMode' cũ + updateEQSlidersUI() UI tĩnh cũ) — THAY
        // bằng workflowEqPresets.cyclePreset()/selectPresetForEdit() (event/workflow/eq-presets.js).
