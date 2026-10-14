/**
 * event/workflow/ui-theme.js — đổi/khôi phục UI Theme (Light/Dark/Morphin — màu panel/card/chữ/nút) và các việc cấp trang
 * đi kèm: `color-scheme`, màu status bar iOS, bản sao cho preloader lần mở sau (localStorage). Đổi Color từ Settings đi qua
 * workflowAppSettings.handleUiThemeChange() (event/workflow/app-settings.js).
 *
 * NẠP SAU: core/ui-theme/registry.js, core/ui-theme/apply-ui.js, core/ui-theme/status-bar-color.js, core/config.js
 * (appConfigUiTheme, appConfigViz), service/db.js (getMeta/setMeta). Lúc chạy: core/theme-background.js,
 * event/workflow/{theme,app-panel-nav}.js.
 */
const UI_THEME_COLOR_SCHEME = { light: 'light', dark: 'dark', morphin: 'dark' }; // Morphin: chữ trắng trên kính tối -> popup/ô nhập kiểu tối

// Màu status bar theo nguồn do computeStatusBarColorSource() (core/theme-background.js) chọn.
const STATUS_BAR_COLOR_BY_SOURCE = {
    image: (source, viewportW, viewportH) => sampleImageTopEdgeColor(source.url, viewportW, viewportH, THEME_BG_OVERLAY_ALPHA), // core/ui-theme/status-bar-color.js
    gradient: (source, viewportW, viewportH) => computeGradientTopEdgeColor(source.from, source.to, viewportW, viewportH), // core/ui-theme/status-bar-color.js
    none: () => '',
};

// Bản sao nền cho preloader (service/boot-preloader.js đọc đồng bộ lần mở sau): Morphin -> ghi + đổi ngay nền preloader đang
// hiện (boot phát hiện media mất -> fallback ngay, không đợi lần mở sau); theme khác -> xoá key (preloader dùng nhánh class).
const BOOT_BACKDROP_MIRROR_BY_KEEP = {
    true: (mirror) => {
        localStorage.setItem('uiThemeBoot', mirror.storageJson);
        applyBootPreloaderBackground(mirror.preloaderBg); // core/ui-theme/status-bar-color.js
    },
    false: () => localStorage.removeItem('uiThemeBoot'),
};

const workflowUiTheme = {
    _statusBarSyncToken: 0, // bỏ kết quả lấy mẫu ảnh CŨ khi đã có lần gọi mới hơn (đổi nền liên tiếp)
    _themeStatusBarColor: '', // màu status bar theo theme (Morphin: mép trên nền thật; còn lại '') — không phụ thuộc màn đang xem

    /**
     * Đổi + chốt theme: ghi `meta.uiThemeConfig` (setMeta mỗi lần đổi, tần suất rất thấp), rồi áp ngay vào DOM toàn trang.
     * Tên không cho chọn/lạ -> mặc định ngay từ đầu, để giá trị lưu luôn khớp theme thật sự áp.
     * @param {'light'|'dark'|'morphin'} themeName
     */
    async switchUiTheme(themeName) {
        const safeThemeName = resolveUiThemeName(themeName); // core/ui-theme/registry.js
        appConfigUiTheme.mutateAll((cfg) => { cfg.activeUiTheme = safeThemeName; }); // core/config.js
        console.log(`writer: "switchUiTheme", page: "uiTheme.activeUiTheme", content: "${safeThemeName}"`);
        await setMeta('uiThemeConfig', appConfigUiTheme.getAll()); // service/db.js
        this._applyTheme(safeThemeName);
    },

    /** Khôi phục theme đã lưu lúc boot (event/workflow/app-boot.js) + áp vào DOM. Chưa từng lưu -> giữ mặc định đã seed. */
    async loadPersistedUiThemeOnBoot() {
        const saved = await getMeta('uiThemeConfig'); // service/db.js
        if (saved && typeof saved === 'object') {
            appConfigUiTheme.mutateAll((cfg) => Object.assign(cfg, saved)); // core/config.js
            console.log(`writer: "loadPersistedUiThemeOnBoot", page: "uiTheme.activeUiTheme", content: "khôi phục từ meta.uiThemeConfig"`);
        }
        this._applyTheme(resolveUiThemeName(appConfigUiTheme.getAll().activeUiTheme)); // core/ui-theme/registry.js
        workflowTheme.syncBackgroundVideoPlayback(); // event/workflow/theme.js — video nền đã nạp lúc boot; đây quyết định có PHÁT không
    },

    /** Áp theme đã chuẩn hoá: cache key list dùng chung (lần dựng DOM kế tiếp dùng đúng theme), quét `data-uitk` toàn trang,
     * việc cấp trang, nút bottom nav (tô bằng class trực tiếp, không `data-uitk`), status bar. @param {string} themeName */
    _applyTheme(themeName) {
        const keyList = resolveUiThemeKeyList(themeName); // core/ui-theme/registry.js
        setActiveUiThemeKeyList(keyList); // core/ui-theme/apply-ui.js
        applyUiThemeToDom(document, keyList); // core/ui-theme/apply-ui.js
        this._applyPageLevelTheme(themeName);
        workflowAppPanelNav.paintActiveTab(appState.get('appPanelActiveTab')); // event/workflow/app-panel-nav.js
        this.syncStatusBarColor();
    },

    /** Tô status bar iOS khớp nền thật (Morphin) — gọi ở mọi nơi nền/theme đổi (file này + workflowTheme.commitThemeMode()).
     * Lấy mẫu ảnh là bất đồng bộ: lần gọi cũ về sau lần mới thì bỏ (`_statusBarSyncToken`). */
    async syncStatusBarColor() {
        const token = ++this._statusBarSyncToken;
        const source = computeStatusBarColorSource(appConfigUiTheme.getAll().activeUiTheme, appConfigViz.getAll()); // core/theme-background.js
        const color = await STATUS_BAR_COLOR_BY_SOURCE[source.kind](source, window.innerWidth, window.innerHeight);
        if (token !== this._statusBarSyncToken) return;
        this._themeStatusBarColor = color;
        this.applyStatusBarForCurrentScreen();
        this._mirrorBootBackdrop(color); // preloader luôn hiện TRƯỚC màn App Panel -> theo màu theme, không theo màn đang xem
    },

    /** Màu status bar theo theme chỉ áp ở màn App Panel; màn Visualizer (`#app-stack.playlist-hidden`) gỡ override để nền
     * Morphin không tràn sang Visualizer (nền Visualizer có cài đặt riêng). Gọi từ `syncStatusBarColor()` và
     * `workflowTheme.onAppStackScreenChange()`. */
    applyStatusBarForCurrentScreen() {
        const visualizerScreenActive = appStack.classList.contains('playlist-hidden'); // core/dom-refs.js
        const color = visualizerScreenActive ? '' : this._themeStatusBarColor;
        applyStatusBarColor(color); // core/ui-theme/status-bar-color.js
        console.log(`writer: "applyStatusBarForCurrentScreen", page: "statusBar", content: "${color || (visualizerScreenActive ? 'màn Visualizer — không override' : 'theo nền theme')}"`);
    },

    /** Ghi/xoá bản sao nền cho preloader (computeBootBackdropMirror(), core/theme-background.js). localStorage bị chặn
     * (Private Mode) -> bỏ qua, preloader Morphin dùng nền slate-900. @param {string} statusBarColor màu vừa tô ('' nếu không có) */
    _mirrorBootBackdrop(statusBarColor) {
        const mirror = computeBootBackdropMirror(appConfigUiTheme.getAll().activeUiTheme, appConfigViz.getAll(), statusBarColor); // core/theme-background.js
        try {
            BOOT_BACKDROP_MIRROR_BY_KEEP[mirror.keep](mirror);
        } catch (e) {
            console.warn('[ui-theme] Không ghi được localStorage[\'uiThemeBoot\'] (preloader Morphin sẽ dùng nền slate-900) — có thể do Private Mode:', e);
        }
    },

    /** Việc cấp trang đi kèm mỗi lần theme đổi/khôi phục: `color-scheme` của <html>; bản sao tên theme ở
     * `localStorage['uiThemeName']` cho service/boot-preloader.js (chạy trước mọi file JS, không đợi được IndexedDB). */
    _applyPageLevelTheme(themeName) {
        applyPageColorScheme(UI_THEME_COLOR_SCHEME[themeName] || 'light'); // core/ui-theme/apply-ui.js
        try {
            localStorage.setItem('uiThemeName', themeName);
        } catch (e) {
            console.warn('[ui-theme] Không ghi được localStorage[\'uiThemeName\'] (preloader sẽ dùng mặc định Light) — có thể do Private Mode:', e);
        }
    },
};
