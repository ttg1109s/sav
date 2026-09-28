/**
 * event/workflow/visualizer/rain.js — Group "rain" (canvas 2D, 2 style: glass / street).
 *
 * [TÁCH — 28/09/2026, Phase 3-4 dọn visualizer] Từ `_tickRain/_tickRainGlass/_tickRainStreet()` của
 * event/workflow/visualizer-render.js cũ. Hành vi mỗi frame giữ nguyên; rẽ nhánh -> guard + object map
 * (readme/event-bus-flow.md mục 7). Vòng đời (thay phần Rain của resizeCanvas() cũ): `onResize` dựng lại giọt
 * tĩnh, dãy nhà, cảnh phố; chọn style rain (`onStyleApplied`) cũng dựng lại như cũ.
 */

/** Cửa sổ nhà (glass): sáng -> đúng màu color mode; tắt -> màu tương phản. */
const RAIN_GLASS_WINDOW_COLOR_BY_LIT = {
    true: (litColor) => litColor.css,
    false: (litColor) => resolveRainCityOffColor(litColor.h, litColor.s, litColor.l), // core
};

/** Nền mặt đường (street) theo color mode — mode lạ dùng nền tối mặc định (nhánh `else` cũ). */
const RAIN_STREET_GROUND_STOPS_BY_MODE = {
    solid: (cfg) => [{ offset: 0, color: interpolateColor('#0f141c', cfg.solidColor, 0.08) }, { offset: 1, color: '#08090f' }], // core/color-utils.js
    dynamic: (cfg) => [{ offset: 0, color: interpolateColor('#0f141c', cfg.dynA, 0.1) }, { offset: 1, color: interpolateColor('#08090f', cfg.dynB, 0.1) }], // core/color-utils.js
    gradient: () => [{ offset: 0, color: 'rgba(15, 20, 28, 0.9)' }, { offset: 1, color: 'rgba(8, 10, 15, 0.95)' }],
};

const workflowVizRain = {
    defaultStyle: 'glass',

    styles: {
        glass: (frame) => workflowVizRain._drawGlass(frame),
        street: (frame) => workflowVizRain._drawStreet(frame),
    },

    // ===================== Vòng đời =====================

    /** Khung nhìn đổi (hoặc Custom Effect refresh 'resizeCanvas'): xoá gợn sóng/vệt chảy, rải lại giọt tĩnh, dựng
     * lại dãy nhà + cảnh phố theo kích thước mới. */
    onResize(viewport) {
        const rainCfg = getEffectConfig('rain'); // core/custom-effect.js
        appState.set('ripples', []);
        appState.set('glassStreaks', []);
        appState.set('glassStaticDrops', buildGlassStaticDrops(rainCfg.glassDropDensity, canvas.width, canvas.height, viewport.dpr)); // core/canvas-scene-setup.js
        appState.set('cityBuildings', buildRainCityBuildings(canvas.width, viewport.dpr, rainCfg.streetBuildingScale)); // core
        console.log('writer: "workflowVizRain.onResize", page: "ripples/glassStreaks/glassStaticDrops/cityBuildings", content: "dựng lại cảnh Rain theo khung nhìn"');
        generateStreetScene(); // core/canvas-scene-setup.js (di sản)
    },

    /** Vừa chọn 1 style Rain (tay hoặc auto-switch) — dựng lại cảnh như `resizeCanvas()` cũ từng làm ở đây. */
    onStyleApplied(viewport) {
        this.onResize(viewport);
    },

    // ===================== glass =====================

    _drawGlass(frame) {
        const { ctx, canvas, cfg, dpr, isPlaying, smoothedEnergy, vizDataArray } = frame;
        ctx.lineCap = 'round';
        this._paintBackdrop(frame);

        const moon = computeRainMoonFrame(canvas.width, canvas.height, dpr, smoothedEnergy, cfg.glassMoonVisible); // core
        paintRainMoon(ctx, moon); // core

        const flashAlpha = computeScreenFlashAlpha(cfg.flashEnabled, isPlaying, computeRainFlashEnergy(smoothedEnergy, vizDataArray), cfg.flashThreshold, cfg.flashMaxOpacity); // core
        drawScreenFlash(ctx, canvas.width, canvas.height, flashAlpha); // core/visualizer/draw

        this._paintGlassCity(frame);

        ctx.globalAlpha = 1.0;
        ctx.fillStyle = 'rgba(10, 15, 25, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        appState.get('glassStaticDrops').forEach((d) => drawWaterDrop(ctx, d.x, d.y, d.r, 0.6)); // core

        maybeSpawnRainStreak(canvas.width, vizDataArray, isPlaying, smoothedEnergy, cfg.glassStreakFrequency, dpr); // core

        const { glassStreaks, glassStaticDrops } = appState.get(['glassStreaks', 'glassStaticDrops']);
        for (let i = glassStreaks.length - 1; i >= 0; i--) {
            const result = advanceRainStreak(glassStreaks[i], glassStaticDrops, smoothedEnergy, dpr, canvas.width, canvas.height, cfg.glassDropDensity); // core
            drawWaterDrop(ctx, ...result.drawArgs); // core
            this._removeDeadStreak(result, i);
        }

        const glassGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        glassGradient.addColorStop(0, 'rgba(255, 255, 255, 0.0)'); glassGradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.02)');
        glassGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.08)'); glassGradient.addColorStop(0.41, 'transparent'); glassGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = glassGradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawWindowFrame(ctx); // core
    },

    /** Dãy nhà thành phố sau kính (toggle glassCityVisible) — cửa sổ theo color mode. */
    _paintGlassCity(frame) {
        const { ctx, canvas, cfg, dpr, isPlaying, vizDataArray } = frame;
        if (cfg.glassCityVisible === false) return;
        const cityOpacity = (typeof cfg.glassCityOpacity === 'number' ? cfg.glassCityOpacity : 40) / 100;
        const cityFrame = computeRainCityFrame(canvas.width, canvas.height, appState.get('cityBuildings'), dpr, vizDataArray, isPlaying); // core
        const palette = {
            mode: cfg.mode, solid: hexToRgb(cfg.solidColor), dynA: hexToRgb(cfg.dynA), dynB: hexToRgb(cfg.dynB), // core/color-utils.js
            hueOffset: frame.hue,
        };
        const windowColors = cityFrame.windows.map((w) => RAIN_GLASS_WINDOW_COLOR_BY_LIT[!!w.lit](resolveRainCityLitColor(palette, w.t, w.value))); // core
        paintRainCity(ctx, cityFrame, windowColors, cityOpacity); // core
    },

    /** Vệt nước chảy hết đường -> bỏ khỏi danh sách. */
    _removeDeadStreak(result, index) {
        if (result.alive) return;
        appState.mutate('glassStreaks', (arr) => arr.splice(index, 1), { skipCheck: true });
    },

    /** Nền tối riêng của Rain — chỉ khi KHÔNG có Visual Background (ảnh/video/folder) và không ở Video Player mode. */
    _paintBackdrop(frame) {
        const hasCustomBg = appConfigVisualBg.getAll().source.list.some((k) => k !== null) || appState.get('isVideoPlayerMode');
        if (hasCustomBg) return;
        const { ctx, canvas } = frame;
        ctx.fillStyle = getVisualBgFillStyle(ctx, canvas.width, canvas.height); // core/visual-bg.js
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    },

    // ===================== street =====================

    _drawStreet(frame) {
        const { ctx, canvas, cfg, dpr, isPlaying, smoothedEnergy, beatScale, vizDataArray } = frame;
        ctx.lineCap = 'round';
        this._paintBackdrop(frame);

        const flashAlpha = computeScreenFlashAlpha(cfg.flashEnabled, isPlaying, computeRainFlashEnergy(smoothedEnergy, vizDataArray), cfg.flashThreshold, cfg.flashMaxOpacity); // core
        drawScreenFlash(ctx, canvas.width, canvas.height, flashAlpha); // core/visualizer/draw

        const rainIntensity = computeRainIntensity(isPlaying, smoothedEnergy); // core
        paintRainStreetDrops(ctx, canvas.width, canvas.height, dpr, appState.get('streetRain').length, rainIntensity); // core

        const groundY = appState.get('streetGroundY') || canvas.height * 0.88;
        const stopColors = (RAIN_STREET_GROUND_STOPS_BY_MODE[cfg.mode] || RAIN_STREET_GROUND_STOPS_BY_MODE.gradient)(cfg);
        paintRainGroundGradient(ctx, canvas.width, canvas.height, groundY, stopColors); // core

        paintParkFence(ctx, canvas.width, groundY, dpr); // core

        const streetLamps = appState.get('streetLamps');
        const lampSpecs = advanceRainLampsAndBuildSpecs(streetLamps, isPlaying, beatScale, dpr); // core
        lampSpecs.forEach((spec) => {
            const lampColor = getComputedColor(...spec.colorArgs); // core/audio-analysis.js
            const lampFill = workflowVisualizerRender.modeColor(cfg, spec.colorArgs[0], lampColor.fill, 'gradient');
            paintRainLamp(ctx, spec, lampFill, dpr); // core
        });

        this._spawnRippleOnBeat(frame, streetLamps, groundY);
        advanceAndDrawRainRipples(ctx, appState.get('ripples'), dpr); // core
        ctx.globalAlpha = 1.0;
    },

    /** Gợn sóng dưới chân đèn chính theo beat mạnh (xác suất 8% mỗi frame khi beatScale > 0.55). */
    _spawnRippleOnBeat(frame, streetLamps, groundY) {
        if (!frame.isPlaying || frame.beatScale <= 0.55) return;
        if (Math.random() <= 0.92) return;
        const mainLamp = streetLamps.find((l) => l.main);
        if (!mainLamp) return;
        const rippleColor = getComputedColor(0, 1, 200); // core/audio-analysis.js
        spawnRainRipple(mainLamp.x, groundY, frame.canvas.height, frame.dpr, rippleColor.fill, rippleColor.glow); // core
    },
};

workflowVisualizerRender.registerGroup('rain', workflowVizRain);
