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
            dot: 'visualizerSettingsDrawer.barStyle.dot', // MỚI 25/09/2026
            thunder: 'visualizerSettingsDrawer.lightingStyle.thunder',
            fireworks: 'visualizerSettingsDrawer.lightingStyle.fireworks',
            glass: 'visualizerSettingsDrawer.rainStyle.glass',
            street: 'visualizerSettingsDrawer.rainStyle.street',
            rings: 'visualizerSettingsDrawer.vortexStyle.rings',
            bars: 'visualizerSettingsDrawer.vortexStyle.bars',
            wave: 'visualizerSettingsDrawer.vortexStyle.wave',
            rubik: 'visualizerSettingsDrawer.shapeStyle.rubik',
            clock: 'visualizerSettingsDrawer.shapeStyle.clock', // MỚI 26/09/2026
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

        // [DỜI — 28/09/2026, Phase 3 dọn visualizer] `applyVisualizerStyleChoice(style)` ĐÃ BỎ khỏi core: hàm đó
        // điều phối cả chuỗi (ghi currentModeIndex -> updateTypeUI -> saveConfig -> resizeCanvas/updateVortexVisibility)
        // — việc của Workflow. Nay là `workflowVisualizerRender.applyStyle(style)` (event/workflow/visualizer-render.js).

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


        // [TÁCH — 28/09/2026, Phase 3 dọn visualizer] `updateTypeUI()` ĐÃ BỎ khỏi core (đọc appState, gọi 6 core khác,
        // rẽ nhánh theo DOM `playlist-hidden` với 1 nhánh rỗng). Điều phối nay là
        // `workflowVisualizerRender.activateCurrentStyle()`; 3 hàm thuần dưới đây là các mảnh DOM/config tách ra.

        /** Ghi group + style đang chạy vào vizConfig (tạo bucket customEffect của group nếu chưa có). */
        function applyStyleToVizConfig(group, styleField, style) {
            appConfigViz.mutateAll((cfg) => {
                cfg.type = group;
                if (!cfg.customEffect[group]) cfg.customEffect[group] = { ...DEFAULT_CUSTOM_EFFECT[group] };
                cfg.customEffect[group][styleField] = style;
            });
            console.log(`writer: "applyStyleToVizConfig", page: "vizConfig", content: "type=${group}, ${styleField}=${style}"`);
        }

        /** Nhãn dưới icon #btn-cycle-mode = tên style đang chạy (phần tử có thể chưa có trong DOM -> bỏ qua). */
        function setModeCycleLabelText(labelEl, text) {
            if (!labelEl) return;
            labelEl.textContent = text;
        }

        /** Ẩn/hiện #webgl-canvas (class opacity-0) — Vortex/Connector dùng chung canvas này. */
        function setWebglCanvasHidden(webglCanvasEl, hidden) {
            webglCanvasEl.classList.toggle('opacity-0', hidden);
        }

        // (Phần B, Galaxy — updateSpaceStyleUI() ĐÃ BỎ 21/07/2026, cùng panel tinh chỉnh reroll/jump)

        // applyEQPreset(mode) ĐÃ XOÁ HẲN — THAY bằng applyEqGains() (core/eq-presets.js).

        // XOÁ 21/09/2026 (dọn deadcode sau khi nền App đổi sang tham chiếu item thư viện): `applyBgImage()` (copy blob vào meta.bgImage) và
        // `applyBgImageEnabled()` không còn ai gọi — thay bằng workflowTheme._applyPickedMedia()/resolveAppBgMedia() (event/workflow/theme.js, core/config.js).

        /** Core thuần: độ NHOÈ kính các màn App Panel chính (Playlist chính) khi nền Morphin là Background media — MỚI 23/09/2026
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

        // XOÁ 23/09/2026: setThemeSolidColor() — nền Solid đã bỏ (Giang: thay bằng None, không dùng nền).

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
