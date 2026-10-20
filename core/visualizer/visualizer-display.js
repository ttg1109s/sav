/**
 * core/visualizer/visualizer-display.js — Hiển thị màn Visualizer: nhãn style/group, ẩn/hiện canvas, thanh tiến trình theo
 * màu effect đang chạy, panel "Display", ghi style vào vizConfig, kính App Panel. Modal chọn effect: Workflow
 * (event/workflow/visualizer-display.js::openEffectPicker()) + components/settings/visualizer-display-panel.js.
 *
 * NẠP SAU: core/dom-refs.js, core/config.js (appConfigViz), service/state/visualizer-runtime.js.
 */

/** Key i18n tên từng STYLE con (nhãn dưới #btn-cycle-mode, header Custom Effect Drawer, modal chọn effect). */
const VISUALIZER_STYLE_LABEL_KEYS = {
    mirror: 'visualizerSettingsDrawer.barStyle.mirror',
    cascade: 'visualizerSettingsDrawer.barStyle.cascade',
    'black hole': 'visualizerSettingsDrawer.barStyle.blackHole',
    dot: 'visualizerSettingsDrawer.barStyle.dot',
    thunder: 'visualizerSettingsDrawer.lightingStyle.thunder',
    fireworks: 'visualizerSettingsDrawer.lightingStyle.fireworks',
    glass: 'visualizerSettingsDrawer.rainStyle.glass',
    street: 'visualizerSettingsDrawer.rainStyle.street',
    rings: 'visualizerSettingsDrawer.vortexStyle.rings',
    bars: 'visualizerSettingsDrawer.vortexStyle.bars',
    wave: 'visualizerSettingsDrawer.vortexStyle.wave',
    rubik: 'visualizerSettingsDrawer.shapeStyle.rubik',
    clock: 'visualizerSettingsDrawer.shapeStyle.clock',
    circuit: 'visualizerSettingsDrawer.connectorStyle.circuit',
    brain: 'visualizerSettingsDrawer.connectorStyle.brain',
};

/** Key i18n tên từng GROUP (dropdown group của modal chọn effect, Auto-switch). */
const VISUALIZER_GROUP_LABEL_KEYS = {
    bar: 'settingsVisualizer.type.bar',
    lighting: 'settingsVisualizer.type.lighting',
    rain: 'settingsVisualizer.type.rain',
    vortex: 'settingsVisualizer.type.vortex',
    shape: 'settingsVisualizer.group.shape',
    connector: 'settingsVisualizer.type.connector',
};


/** Ẩn/hiện 2 canvas theo `isVisualOff` (gọi mỗi frame — chỉ ghi khi trạng thái đổi).
 * @param {HTMLElement} canvasEl - #visualizer @param {HTMLElement} webglCanvasEl - #webgl-canvas @param {boolean} isVisualOff */
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

/** Màu phần đã phát của thanh tiến trình theo effect đang chạy (resolveEffectConfig(), core/custom-effect.js). Gradient có bảng
 * 7 màu tuỳ chỉnh -> màu đầu bảng. @param {{mode: string, solidColor: string, dynB: string, gradientPalette: string[]}} ec
 * @returns {string} */
function computeProgressBarFillColor(ec) {
    const gradientColor = ec.gradientPaletteRgb ? ec.gradientPalette[0] : '#38bdf8';
    return ec.mode === 'solid' ? ec.solidColor : (ec.mode === 'dynamic' ? ec.dynB : gradientColor);
}

/** Đặt màu nhấn của Bottom Player (biến CSS `--progress-fill` — track, nút kéo, quầng nút Play; sliders.css + player-control.css).
 * @param {HTMLElement} playerEl - #player-container @param {string} color */
function setProgressBarFillColor(playerEl, color) {
    playerEl.style.setProperty('--progress-fill', color);
}

/** Phần đã phát của thanh tiến trình theo giá trị hiện tại (biến `--progress-pct`, track vẽ ở sliders.css). */
function updateProgressBarCSS() {
    const percentage = (progressBar.value / (progressBar.max || 100)) * 100;
    progressBar.style.setProperty('--progress-pct', `${percentage}%`);
}

/** Giá trị các toggle panel "Display" (components/settings/visualizer-display-panel.js). Thiếu field = bật.
 * @param {object} vizCfg @param {object} playerCfg @returns {Object<string, boolean>} id ô -> checked */
function computeVisualizerDisplayPanelView(vizCfg, playerCfg) {
    return {
        'setting-visual-enable': vizCfg.visualEnabled !== false,
        'setting-subtitles-enabled': vizCfg.subtitlesEnabled !== false,
        'setting-stats-panel-enable': playerCfg.isStatsPanelVisible !== false,
        'setting-bottom-player-enable': vizCfg.bottomPlayerVisible !== false,
        'setting-playlist-button-enable': vizCfg.playlistButtonVisible !== false,
        'setting-control-center-button-enable': vizCfg.controlCenterButtonVisible !== false,
    };
}

/** @param {HTMLElement} panelEl @param {Object<string, boolean>} view - computeVisualizerDisplayPanelView() */
function fillVisualizerDisplayPanel(panelEl, view) {
    Object.entries(view).forEach(([id, checked]) => {
        const el = panelEl.querySelector(`#${id}`);
        if (el) el.checked = checked;
    });
}

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

/** Độ nhoè kính các màn App Panel chính khi nền Morphin là Background media — số nguyên, kẹp 10-40px (Giang: min 10px).
 * Gọi bởi workflowTheme.setAppGlassBlur(). @param {string|number} value */
function setAppGlassBlur(value) {
    const px = Math.max(10, Math.min(40, parseInt(value, 10) || 10));
    appConfigViz.mutateAll(cfg => { cfg.appGlassBlur = px; });
    console.log(`writer: "setAppGlassBlur", page: "viz.appGlassBlur", content: "${px}"`);
}

/** Độ đục nền trắng của kính các màn App Panel chính — số nguyên, kẹp 5-40% (Giang: min 5%). Gọi bởi
 * workflowTheme.setAppGlassTint(). @param {string|number} value */
function setAppGlassTint(value) {
    const pct = Math.max(5, Math.min(40, parseInt(value, 10) || 5));
    appConfigViz.mutateAll(cfg => { cfg.appGlassTint = pct; });
    console.log(`writer: "setAppGlassTint", page: "viz.appGlassTint", content: "${pct}"`);
}

/** Màu bắt đầu của Theme mode "Gradient" (màu nền app, khác màu vẽ effect). @param {string} value */
function setThemeGradientFrom(value) {
    appConfigViz.mutateAll(cfg => { cfg.gradientFrom = value; });
}

/** Màu kết thúc của Theme mode "Gradient". @param {string} value */
function setThemeGradientTo(value) {
    appConfigViz.mutateAll(cfg => { cfg.gradientTo = value; });
}
