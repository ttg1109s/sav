/**
 * event/workflow/app-settings.js — "THẰNG THỰC THI CUỐI" cho Setting (VIẾT LẠI, phản hồi Giang —
 * "tận dụng UI cũ, không đổi logic code, chỉ phân phối lại section + styling theo generic drawer").
 *
 * KIẾN TRÚC: Setting dùng THẲNG `core/generic-drawer.js` (singleton chung, Giang chỉ định rõ), 90vh.
 * Điều hướng nhiều cấp (Main -> System -> Theme/Gesture/Slideshow/Language, Main -> Playlist ->
 * Sắp xếp/Lọc...) KHÔNG dùng lại `core/settings-panel-stack-ui.js` (cơ chế push/pop CŨ, DOM đó giờ
 * thuộc về Photo, xem components/photo-panel.js) — mà dùng đúng "cơ chế swap nội dung của Generic
 * Drawer đã có" (Giang chỉ định): `updateGenericDrawer()` (đã dùng bởi eq-presets.js/custom-
 * effect.js/document-reader.js) + 1 NGĂN XẾP JS thuần (`_screenStack`, mảng hàm render) để Back
 * biết quay lại ĐÚNG màn trước, KHÔNG phải DOM push/pop.
 *
 * TÁI DÙNG NGUYÊN VẸN mọi hàm render/hàm đồng bộ giá trị đã có (renderGestureSettingsPanelBody(),
 * workflowGestureSettings.openPanel(), renderSlideshowPanelBody(), workflowSlideshow.openPanel(),
 * TPL_SETTINGS_LANGUAGE, renderLanguageOptions(), renderDebugConsolePanelBody(),
 * workflowSettingsMisc.openDebugConsole(), TPL_SETTINGS_PLAYLIST_VIEW, workflowPlaylist.
 * openSortPanel()/openFilterPanel(), 3 hàm askRestartApp/askRestoreDefaults/askClearCache) — các
 * hàm đó ĐÃ được sửa (đợt này) để đọc/ghi qua `genericDrawerBody` thay vì panel push động cũ
 * (`fooPanelEl = pushSettingsPanel(...)` -> `fooPanelEl = genericDrawerBody`) — bản thân NGHIỆP VỤ
 * (field nào ghi gì, gọi core nào) HOÀN TOÀN KHÔNG đổi, chỉ đổi "nội dung sống ở container nào".
 *
 * STYLING: bodyHtml mọi màn đều bọc trong `.app-settings-scope` — CSS đè màu sang light theme khớp
 * Generic Drawer (assets/css/layout-nav.css), KHÔNG sửa màu trực tiếp trong từng template cũ.
 *
 * Visualizer Screen (Display/Auto-Switch/Visual Background, kể cả 2 sub-panel Gradient/Video Audio
 * + picker con video/ảnh/album của Visual Background) ĐÃ migrate xong (đợt "làm nốt visualizer") —
 * cùng khuôn Gesture/Slideshow/Language/Troubleshooting. Slideshow mở được từ CẢ 2 nơi (System VÀ
 * bên trong Visual Background — "Tuỳ chỉnh Trình chiếu...") đều qua `navigateTo()`, Back luôn quay
 * đúng chỗ vừa đến.
 *
 * CÒN NỢ (đã biết, chưa sửa — dời lại theo yêu cầu Giang "logic bổ sung tính sau"): nút Cancel của
 * picker chọn THƯ MỤC video (1 trong 4 nguồn Visual Background) chưa tự quay lại Visual Background
 * — hạ tầng `workflowPlaylist._openFolderPickerDrawer()` dùng CHUNG với Playlist, chưa sửa vì rủi ro
 * ảnh hưởng nơi khác. 3 picker còn lại (ảnh đơn/video đơn/album) đã tự quay lại đúng (xem
 * `_closePickerDrawer()`/`openSingleImagePicker()`, event/workflow/visual-bg.js).
 *
 * NẠP SAU: core/generic-drawer.js, core/app-panel-nav.js, components/settings/app-settings-main.js,
 * components/settings/playlist-view.js, components/settings/language.js, components/gesture-
 * settings-drawer.js, components/slideshow-settings-drawer.js, components/debug-console-drawer.js,
 * components/playlist-sort-drawer.js, components/playlist-filter-drawer.js, components/settings/
 * visualizer-display-panel.js, components/settings/visualizer-auto-switch-drawer.js, components/
 * visual-bg-settings-drawer.js, components/visual-bg-gradient-drawer.js, components/visual-bg-
 * video-audio-drawer.js, event/workflow/generic-drawer-helpers.js, event/workflow/app-panel-nav.js,
 * event/workflow/gesture-settings.js, event/workflow/slideshow.js, event/workflow/playlist.js,
 * event/workflow/settings-misc.js, event/workflow/visualizer-display.js, event/workflow/
 * visual-bg.js, lang/language-settings.js (renderLanguageOptions/updateLanguageDeleteButtonVisibility).
 * NẠP TRƯỚC: event/router/player-controls.js, event/router/app-settings.js,
 * event/router/app-panel-nav.js, event/router/visual-bg.js.
 */
const workflowAppSettings = {

    _screenStack: [], // mảng hàm render (KHÔNG gồm màn hiện tại) — back() pop ra màn NGAY TRƯỚC

    open() {
        this._screenStack = [];
        this._renderMain();
        workflowAppPanelNav.setActiveTab('setting');
    },

    close() {
        this._screenStack = [];
        workflowGenericDrawerHelpers.closeFully(); // event/workflow/generic-drawer-helpers.js
        workflowAppPanelNav.activateMedia(); // event/workflow/app-panel-nav.js
    },

    /** Điều hướng TỚI 1 màn mới — đẩy màn HIỆN TẠI vào ngăn xếp để back() quay lại đúng.
     * @param {() => void} renderFn */
    navigateTo(renderFn) {
        this._screenStack.push(this._currentRenderFn);
        renderFn();
    },

    /** Ứng với nút Back động ở header (mọi màn trừ Main). */
    back() {
        const prev = this._screenStack.pop();
        if (!prev) { this.close(); return; } // không còn gì để lùi (không nên xảy ra — Main không có nút Back) -> đóng hẳn cho an toàn
        prev();
    },

    // ===================== Khung dùng chung =====================

    /** Dựng header (Back nếu không phải Main + Close X luôn có) + bodyHtml bọc `.app-settings-scope`
     * rồi mở/swap Generic Drawer + gọi `onMount(genericDrawerBody)` để màn tự đồng bộ giá trị/wire.
     * @param {string} title @param {string} bodyHtml @param {(body: HTMLElement) => void} [onMount] */
    _render(title, bodyHtml, onMount) {
        const hasBack = this._screenStack.length > 0;
        const config = {
            height: '90vh',
            headerHtml: `
                <div class="relative flex items-center justify-center px-14 py-3 border-b border-slate-200">
                    ${hasBack ? `
                    <button id="btn-app-settings-back" class="absolute left-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                    </button>` : ''}
                    <h3 class="text-base font-bold text-slate-900 truncate text-center">${title}</h3>
                    <button id="btn-generic-drawer-close" class="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-600">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            `,
            bodyHtml: `<div class="app-settings-scope p-4">${bodyHtml}</div>`,
            bodyClass: 'overflow-y-auto',
        };
        if (genericDrawerPanel.classList.contains('hidden')) openGenericDrawer(config); else updateGenericDrawer(config); // core/generic-drawer.js
        wireAppSettingsHeader(genericDrawerHeader); // core/app-settings-ui.js — Rule 5a

        if (onMount) onMount(genericDrawerBody);
    },

    // ===================== Main =====================

    _renderMain() {
        this._currentRenderFn = () => this._renderMain();
        this._render(t('appSettings.title'), renderAppSettingsMainBody(), wireAppSettingsMain); // core/app-settings-ui.js
    },

    // ===================== Playlist (TÁI DÙNG TPL_SETTINGS_PLAYLIST_VIEW + workflowPlaylist) =====

    _renderPlaylist() {
        this._currentRenderFn = () => this._renderPlaylist();
        this._render(t('appSettings.row.playlist'), TPL_SETTINGS_PLAYLIST_VIEW, (body) => {
            const mediaSourceSelect = body.querySelector('#setting-playlist-media-source');
            if (mediaSourceSelect) mediaSourceSelect.value = appState.get('activeMediaSource');
            const viewModeSelect = body.querySelector('#setting-playlist-view-mode');
            if (viewModeSelect) viewModeSelect.value = appState.get('displayViewMode');
            wireAppSettingsPlaylist(body); // core/app-settings-ui.js
        });
    },

    _renderPlaylistSort() {
        this._currentRenderFn = () => this._renderPlaylistSort();
        this._render(t('playlistSortPanel.title'), renderPlaylistSortPanelBody(), () => {
            workflowPlaylist.openSortPanel(); // event/workflow/playlist.js — đồng bộ giá trị (đã migrate sang genericDrawerBody)
        });
    },

    _renderPlaylistFilter() {
        this._currentRenderFn = () => this._renderPlaylistFilter();
        const source = appState.get('activeMediaSource');
        this._render(t('playlistFilterPanel.title'), renderPlaylistFilterPanelBody(source), () => {
            workflowPlaylist.openFilterPanel(); // event/workflow/playlist.js
        });
    },

    // ===================== System (Theme/Gesture/Slideshow/Language) =====================

    _renderSystem() {
        this._currentRenderFn = () => this._renderSystem();
        const rows = [
            { key: 'theme', icon: 'M7 21a4 4 0 01-4-4V5a2 2 0 012-2h9a2 2 0 012 2v12a4 4 0 01-4 4H7zm0 0h10a2 2 0 002-2v-9', labelKey: 'appSettings.system.theme.label', hintKey: 'appSettings.system.theme.hint' },
            { key: 'gesture', icon: 'M7 11.5V9a2 2 0 114 0v1.5M11 9.5V6a2 2 0 114 0v5m0-3.5V8a2 2 0 114 0v4c0 4-2 6-6 6s-5.5-1-7-4l-1.5-3a1.7 1.7 0 012.6-2.1L8 10', labelKey: 'appSettings.system.gesture.label', hintKey: 'appSettings.system.gesture.hint' },
            { key: 'slideshow', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', labelKey: 'appSettings.system.slideshow.label', hintKey: 'appSettings.system.slideshow.hint' },
            { key: 'language', icon: 'M3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 000 18M12.5 3a17 17 0 010 18M21 12a9 9 0 11-18 0 9 9 0 0118 0z', labelKey: 'appSettings.system.language.label', hintKey: 'appSettings.system.language.hint' },
        ];
        this._render(t('appSettings.row.system'), renderAppSettingsRowList(rows), wireAppSettingsSystem); // core/app-settings-ui.js
    },

    // ===================== Theme (VIẾT LẠI UI theo yêu cầu — dropdown, TÁI DÙNG NGUYÊN core/
    // workflow: 'theme.selectMode.click' + 'theme.gradientFrom/To.input', event/router/theme.js
    // KHÔNG đổi gì) =====================

    /** "Glass trong suốt" gộp 3 mode cũ (background/gradient + "solid" MỚI) — "solid" TÁI DÙNG
     * mode 'gradient' có sẵn (core KHÔNG đổi gì), chỉ gán 2 màu Từ/Đến CÙNG 1 giá trị — 1 màu duy
     * nhất nhìn như nền phẳng, không cần thêm field/schema mới. */
    _renderTheme() {
        this._currentRenderFn = () => this._renderTheme();
        const cfg = appConfigViz.getAll();
        const isGlass = cfg.themeMode === 'background' || cfg.themeMode === 'gradient';
        const isSolidGuess = cfg.themeMode === 'gradient' && cfg.gradientFrom === cfg.gradientTo;
        const glassType = cfg.themeMode === 'background' ? 'image' : (isSolidGuess ? 'solid' : 'gradient');
        const bodyHtml = `
            <div class="glass-modal rounded-2xl flex flex-col overflow-hidden">
                <div class="flex justify-between items-center p-4 ${isGlass ? 'border-b border-white/5' : ''}">
                    <span class="text-sm font-medium truncate" data-i18n="appSettings.theme.select.label">${t('appSettings.theme.select.label')}</span>
                    <select id="app-settings-theme-select" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right">
                        <option value="light" data-i18n="appSettings.theme.select.light">${t('appSettings.theme.select.light')}</option>
                        <option value="dark" data-i18n="appSettings.theme.select.dark">${t('appSettings.theme.select.dark')}</option>
                        <option value="glass" data-i18n="appSettings.theme.select.glass">${t('appSettings.theme.select.glass')}</option>
                    </select>
                </div>
                <div id="app-settings-theme-glass-row" class="${isGlass ? '' : 'hidden'} flex-col">
                    <div class="flex justify-between items-center p-4 border-b border-white/5">
                        <span class="text-sm font-medium truncate" data-i18n="appSettings.theme.glassType.label">${t('appSettings.theme.glassType.label')}</span>
                        <select id="app-settings-theme-glass-type" class="bg-black/50 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white outline-none w-40 text-right">
                            <option value="solid" data-i18n="appSettings.theme.glassType.solid">${t('appSettings.theme.glassType.solid')}</option>
                            <option value="gradient" data-i18n="appSettings.theme.glassType.gradient">${t('appSettings.theme.glassType.gradient')}</option>
                            <option value="image" data-i18n="appSettings.theme.glassType.image">${t('appSettings.theme.glassType.image')}</option>
                        </select>
                    </div>
                    <div id="app-settings-theme-solid-row" class="${glassType === 'solid' ? '' : 'hidden'} flex justify-between items-center p-4">
                        <span class="text-sm font-medium truncate" data-i18n="appSettings.theme.solidColor.label">${t('appSettings.theme.solidColor.label')}</span>
                        <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" id="app-settings-theme-solid-color" class="w-10 h-10 -m-1 cursor-pointer"></div>
                    </div>
                    <div id="app-settings-theme-gradient-row" class="${glassType === 'gradient' ? '' : 'hidden'} flex justify-between items-center p-4">
                        <span class="text-sm font-medium truncate" data-i18n="settingsTheme.gradient.label">${t('settingsTheme.gradient.label')}</span>
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" id="app-settings-theme-gradient-from" class="w-10 h-10 -m-1 cursor-pointer"></div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                            <div class="w-8 h-8 rounded-full border border-white/20 overflow-hidden shrink-0"><input type="color" id="app-settings-theme-gradient-to" class="w-10 h-10 -m-1 cursor-pointer"></div>
                        </div>
                    </div>
                    <div id="app-settings-theme-image-row" class="${glassType === 'image' ? '' : 'hidden'} p-4 text-xs text-slate-400" data-i18n="settingsTheme.background">
                        ${t('settingsTheme.background')} — <button type="button" id="app-settings-theme-image-pick" class="text-sky-500 font-semibold underline">${t('common.btn.upload')}</button>
                    </div>
                </div>
            </div>
        `;
        this._render(t('appSettings.system.theme.label'), bodyHtml, (body) => {
            const modeSelect = body.querySelector('#app-settings-theme-select');
            modeSelect.value = isGlass ? 'glass' : cfg.themeMode;
            const solidColorInput = body.querySelector('#app-settings-theme-solid-color');
            const gradientFromInput = body.querySelector('#app-settings-theme-gradient-from');
            const gradientToInput = body.querySelector('#app-settings-theme-gradient-to');
            if (solidColorInput) solidColorInput.value = cfg.gradientFrom || '#38bdf8';
            if (gradientFromInput) gradientFromInput.value = cfg.gradientFrom || '#38bdf8';
            if (gradientToInput) gradientToInput.value = cfg.gradientTo || '#a855f7';
            wireAppSettingsTheme(body); // core/app-settings-ui.js
        });
    },

    /** Ứng với 'appSettings.theme.selectMode.change' (Router gọi). mode !== 'glass' -> TÁI DÙNG
     * THẲNG luồng 'theme' gốc (eventBus.send, KHÔNG phải gọi thẳng workflowTheme — vẫn cần qua
     * Router "theme" vì đó là nơi tính VirtualMachineState, xem event/router/theme.js) rồi render
     * lại Theme để phản ánh cfg mới. mode === 'glass' CHỈ hiện khối "loại nền" — CHƯA commit gì
     * (người dùng chưa chọn solid/gradient/image), patch DOM trực tiếp (đang ở trong Workflow, gọi
     * bởi Router — KHÁC listener DOM thô, không vi phạm Rule 5a). */
    handleThemeSelectMode(mode) {
        if (mode !== 'glass') {
            eventBus.send({ router: 'theme', type: 'theme.selectMode.click', payload: { mode } });
            this._renderTheme();
            return;
        }
        const glassRow = genericDrawerBody.querySelector('#app-settings-theme-glass-row');
        if (glassRow) glassRow.classList.remove('hidden');
    },

    /** Ứng với 'appSettings.theme.selectGlassType.change'. */
    handleThemeSelectGlassType(glassType, solidColor) {
        if (glassType === 'image') eventBus.send({ router: 'theme', type: 'theme.selectMode.click', payload: { mode: 'background' } });
        else if (glassType === 'gradient') eventBus.send({ router: 'theme', type: 'theme.selectMode.click', payload: { mode: 'gradient' } });
        else if (glassType === 'solid') {
            // "solid" = TÁI DÙNG mode 'gradient' có sẵn, 2 màu CÙNG 1 giá trị (xem docstring _renderTheme()).
            eventBus.send({ router: 'theme', type: 'theme.selectMode.click', payload: { mode: 'gradient' } });
            eventBus.send({ router: 'theme', type: 'theme.gradientFrom.input', payload: { value: solidColor } });
            eventBus.send({ router: 'theme', type: 'theme.gradientTo.input', payload: { value: solidColor } });
        }
        this._renderTheme();
    },

    // ===================== Gesture (TÁI DÙNG NGUYÊN renderGestureSettingsPanelBody() +
    // workflowGestureSettings — ĐÃ migrate sang genericDrawerBody) =====================

    _renderGesture() {
        this._currentRenderFn = () => this._renderGesture();
        this._render(t('gestureSettings.title'), renderGestureSettingsPanelBody(), () => {
            workflowGestureSettings.openPanel(); // event/workflow/gesture-settings.js
        });
    },

    // ===================== Slideshow (TÁI DÙNG NGUYÊN renderSlideshowPanelBody() +
    // workflowSlideshow — ĐÃ migrate sang genericDrawerBody) =====================
    //
    // CHƯA làm (đợt sau, cần thiết kế thêm — không đoán bừa): toggle bật/tắt riêng cho màn này +
    // dropdown "áp dụng cho" [Ảnh nền/Video nền] + nút Apply, cấu hình khác nhau theo từng chế độ
    // Visual Background (Giang yêu cầu mục System > Slideshow) — hiện `enable` vẫn nằm ở panel
    // Visual Background (cha), CHƯA tách ra đây được vì Visual Background chính nó CHƯA migrate
    // (xem _renderVisualizerScreen()). Nội dung Transition + Ken Burns bên dưới ĐÃ hoạt động đầy đủ.

    _renderSlideshow() {
        this._currentRenderFn = () => this._renderSlideshow();
        this._render(t('slideshowSettingsDrawer.title'), renderSlideshowPanelBody(), () => {
            workflowSlideshow.openPanel(); // event/workflow/slideshow.js
        });
    },

    // ===================== Language (TÁI DÙNG NGUYÊN TPL_SETTINGS_LANGUAGE +
    // renderLanguageOptions()/updateLanguageDeleteButtonVisibility() — ĐÃ migrate sang
    // genericDrawerBody, listener cụm "languageSettings" KHÔNG đổi gì) =====================

    _renderLanguage() {
        this._currentRenderFn = () => this._renderLanguage();
        this._render(t('appSettings.system.language.label'), TPL_SETTINGS_LANGUAGE, async () => {
            await renderLanguageOptions(); // lang/language-settings.js
        });
    },

    // ===================== Visualizer Screen — Display/Auto-Switch/Visual Background (TÁI DÙNG
    // NGUYÊN 5 hàm render + workflowVisualizerDisplay/workflowVisualBg — ĐÃ migrate sang
    // genericDrawerBody) =====================

    _renderVisualizerScreen() {
        this._currentRenderFn = () => this._renderVisualizerScreen();
        const rows = [
            { key: 'display', icon: 'M4 5a1 1 0 011-1h14a1 1 0 011 1v10a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM8 21h8m-4-4v4', labelKey: 'settingsVisualizer.openDisplay.label', hintKey: 'settingsVisualizer.openDisplay.hint' },
            { key: 'autoSwitch', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15', labelKey: 'settingsVisualizer.openAutoSwitch.label', hintKey: 'settingsVisualizer.openAutoSwitch.hint' },
            { key: 'visualBg', icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z', labelKey: 'settingsVisualizer.visualBg.label', hintKey: 'settingsVisualizer.visualBg.hint' },
        ];
        this._render(t('appSettings.row.visualizerScreen'), renderAppSettingsRowList(rows), wireAppSettingsSystem); // core/app-settings-ui.js — data-app-settings-nav, TÁI DÙNG cơ chế chung
    },

    _renderDisplay() {
        this._currentRenderFn = () => this._renderDisplay();
        this._render(t('visualizerDisplayPanel.title'), renderVisualizerDisplayPanelBody(), () => {
            workflowVisualizerDisplay.openDisplayPanel(); // event/workflow/visualizer-display.js
        });
    },

    _renderAutoSwitch() {
        this._currentRenderFn = () => this._renderAutoSwitch();
        this._render(t('visualizerAutoSwitchDrawer.title'), renderVisualizerAutoSwitchPanelBody(), () => {
            workflowVisualizerDisplay.openAutoSwitchPanel(); // event/workflow/visualizer-display.js
        });
    },

    /** Visual Background — Main. Tự mở thêm 2 sub-panel (Gradient/Video Audio, xem
     * _renderVisualBgGradient()/_renderVisualBgVideoAudio() ngay dưới) + picker Generic Drawer con
     * (video/ảnh/album/folder — event/workflow/visual-bg.js tự gọi thẳng `navigateTo()`/
     * `_renderVisualBg()` để quay lại đúng chỗ, xem docstring tại đó). */
    _renderVisualBg() {
        this._currentRenderFn = () => this._renderVisualBg();
        this._render(t('visualBgSettingsDrawer.title'), renderVisualBgPanelBody(), () => {
            workflowVisualBg.openPanel(); // event/workflow/visual-bg.js
        });
    },

    _renderVisualBgGradient() {
        this._currentRenderFn = () => this._renderVisualBgGradient();
        this._render(t('visualBgSettingsDrawer.openGradient.label'), renderVisualBgGradientPanelBody(), () => {
            workflowVisualBg.openGradientPanel(); // event/workflow/visual-bg.js
        });
    },

    _renderVisualBgVideoAudio() {
        this._currentRenderFn = () => this._renderVisualBgVideoAudio();
        this._render(t('visualBgSettingsDrawer.openVideoAudio.label'), renderVisualBgVideoAudioPanelBody(), () => {
            workflowVisualBg.openVideoAudioPanel(); // event/workflow/visual-bg.js
        });
    },

    /** Subtitle — MỚI phát hiện lúc migrate: nằm LỒNG bên trong Display (nút "Phụ đề", components/
     * settings/visualizer-display-panel.js), không phải row riêng ở Visualizer Screen — đúng vị trí
     * cũ, chỉ đổi cơ chế hiển thị. Mở TỪ event/router/subtitle-style-settings.js (navigateTo()),
     * KHÔNG có row Main/System nào trỏ thẳng vào đây. */
    _renderSubtitle() {
        this._currentRenderFn = () => this._renderSubtitle();
        this._render(t('subtitleSettingsDrawer.title'), renderSubtitlePanelBody(), () => {
            workflowSubtitleStyleSettings.openPanel(); // event/workflow/subtitle-style-settings.js
        });
    },

    // ===================== Troubleshooting = Debug console (TÁI DÙNG NGUYÊN
    // renderDebugConsolePanelBody() + workflowSettingsMisc — ĐÃ migrate) =====================

    _renderTroubleshooting() {
        this._currentRenderFn = () => this._renderTroubleshooting();
        this._render(t('settingsMisc.debugConsole.title'), renderDebugConsolePanelBody(), () => {
            workflowSettingsMisc.openDebugConsole(); // event/workflow/settings-misc.js
        });
    },

    // ===================== Reset app — modalChoice, TÁI DÙNG NGUYÊN 3 hàm ask*() có sẵn
    // (event/workflow/settings-misc.js, KHÔNG đổi gì — không cần Generic Drawer, modalChoice() là
    // overlay riêng, đứng độc lập) =====================

    _openResetAppMenu() {
        modalChoice(
            '',
            [
                { label: t('appSettings.resetApp.restartApp.label'), className: 'w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => workflowSettingsMisc.askRestartApp({ onConfirmSend: () => eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.restartApp.confirm', payload: {} }) }) },
                { label: t('appSettings.resetApp.restoreDefaults.label'), className: 'w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => workflowSettingsMisc.askRestoreDefaults({ onConfirmSend: () => eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.restoreDefaults.confirm', payload: {} }) }) },
                { label: t('appSettings.resetApp.clearCache.label'), className: 'w-full py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-sm font-semibold transition-colors', onClick: () => workflowSettingsMisc.askClearCache({ onConfirmSend: () => eventBus.send({ router: 'settingsMisc', type: 'settingsMisc.clearCache.confirm', payload: {} }) }) },
                { label: t('common.cancel'), className: 'w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold transition-colors mt-1', onClick: () => {} },
            ],
            { title: t('appSettings.resetApp.title') }
        );
    },
};
