/**
 * event/workflow/visualizer/falling.js — Group "falling" (canvas 2D, 2 style: glass / street). Rẽ nhánh -> guard + object map.
 * `onResize` (và chọn style) dựng lại giọt tĩnh, dãy nhà, cảnh phố.
 */

/** Cỡ phổ VẼ của group (01/10/2026: group tự khai báo, host xin qua audioAnalysis.requireSpectrum()). */
const FALLING_FFT_SIZE = 256;
const FALLING_COMET_FFT_SIZE = 256;

/** Cửa sổ nhà (glass): sáng -> đúng màu color mode; tắt -> màu tương phản. */
const FALLING_GLASS_WINDOW_COLOR_BY_LIT = {
    true: (litColor) => litColor.css,
    false: (litColor) => resolveRainCityOffColor(litColor.h, litColor.s, litColor.l), // core
};

/** Màu cửa SÁNG (glass) theo luật màu (resolveEffectColorRule(), core/visualizer/effect-paint.js) — mỗi luật 1 core riêng. */
const FALLING_CITY_LIT_COLOR_BY_RULE = {
    gradient: (p, t, value) => resolveRainCityLitColorHsl(p.hueOffset, t, value), // core
    palette: (p, t, value) => resolveRainCityLitColorFromRgb(computeGradientPaletteRgb(p.gradientRgb, p.hueOffset, t, value)), // core + core/visualizer/effect-paint.js
    dynamic: (p, t) => resolveRainCityLitColorFromRgb(interpolateRgb(p.dynA, p.dynB, t)), // core + core/color-utils.js
    solid: (p) => resolveRainCityLitColorFromRgb(p.solid), // core
};

/** Nền mặt đường (street) theo color mode — mode lạ dùng nền tối mặc định (nhánh `else` cũ). */
const FALLING_STREET_GROUND_STOPS_BY_MODE = {
    solid: (cfg) => [{ offset: 0, color: interpolateColor('#0f141c', cfg.solidColor, 0.08) }, { offset: 1, color: '#08090f' }], // core/color-utils.js
    dynamic: (cfg) => [{ offset: 0, color: interpolateColor('#0f141c', cfg.dynA, 0.1) }, { offset: 1, color: interpolateColor('#08090f', cfg.dynB, 0.1) }], // core/color-utils.js
    gradient: () => [{ offset: 0, color: 'rgba(15, 20, 28, 0.9)' }, { offset: 1, color: 'rgba(8, 10, 15, 0.95)' }],
};

/** Street Light dùng duy nhất Snow — thông số bể hạt, lớp vẽ, màn mờ + quầng, vùng sáng. */
const FALLING_STREET_SNOW = {
    spec: STREET_SNOW_SPEC, layers: STREET_SNOW_LAYERS, // core
    paintMist: paintStreetSnowMist, // core
    paintLampHaze: paintStreetSnowLampHaze, // core
    paintLayer: paintStreetSnowLayer, // core
    paintLit: paintStreetSnowLit, // core
};

/** Gió street theo toggle streetWindEnabled: bật -> gió theo giai điệu + giật khi chuyển đoạn; tắt -> lặng (rơi thẳng). */
const FALLING_STREET_WIND_BY_ENABLED = {
    true: (wind, audio, isTransition) => stepStreetWind(wind, audio.melodyDirection(), isTransition, audio.frameIndex()), // core
    false: () => STREET_WIND_CALM, // core
};

const workflowVizFalling = {
    defaultStyle: 'glass',
    /** Cỡ phổ VẼ style cần — host gọi khi kích hoạt style để xin qua audioAnalysis.requireSpectrum() (01/10/2026). */
    spectrumSize() { return FALLING_FFT_SIZE; },

    styles: {
        glass: (frame) => workflowVizFalling._drawGlass(frame),
        street: (frame) => workflowVizFalling._drawStreet(frame),
        comet: (frame) => workflowVizFalling._drawComet(frame),
    },

    _comet: createCometMeteorState(),
    _cometColorIndex: 0,

    /** Trạng thái riêng của street: dải tần từng đèn, gió, Energy % đã làm mượt, mốc chớp trời, cửa sổ beat dò chuyển đoạn. */
    _street: { bands: [], wind: null, energy: 0, thunderAt: -Infinity, beatWin: createBeatFluxWindow() }, // core/visualizer/beat-window.js

    // ===================== Comet Meteor Shower =====================

    /** Sao băng và núi dùng cùng canvas của host; không tạo RAF/timer riêng. */
    _drawComet(frame) {
        const state = this._comet;
        const now = performance.now();
        const dt = computeFrameDeltaMs(now, state.lastFrameMs); // core/visualizer/frame-clock.js
        state.lastFrameMs = now;
        const energy = frame.audio.smoothedEnergy();
        const spectrum = frame.audio.spectrum(FALLING_COMET_FFT_SIZE) || [];
        let highFrequency = 0;
        const highStart = Math.floor(spectrum.length * 0.7);
        for (let i = highStart; i < spectrum.length; i++) highFrequency += spectrum[i] || 0;
        highFrequency = spectrum.length > highStart ? highFrequency / ((spectrum.length - highStart) * 255) : 0;
        advanceCometMeteorState(state, frame, dt, energy, now, highFrequency); // core/visualizer/groups/falling/comet.js
        // Beat mới tạo burst nhỏ, luôn tôn trọng hard cap số meteor.
        const beatTime = frame.audio.lastBeatTime();
        if (state.lastBeatTime === null) state.lastBeatTime = beatTime;
        else if (frame.isPlaying && frame.cfg.cometBeatBurst !== false && beatTime > state.lastBeatTime) {
            const cap = Math.max(1, Math.min(100, Math.round(Number(frame.cfg.cometMaxMeteors) || 18)));
            const burst = Math.min(4, cap - state.particles.length);
            for (let i = 0; i < burst; i++) _spawnCometMeteor(state, frame, energy);
            state.lastBeatTime = beatTime;
        } else if (beatTime > state.lastBeatTime) state.lastBeatTime = beatTime;
        this._paintBackdrop(frame);
        const colorOf = (p, i) => workflowVisualizerRender.colorAt(i, Math.max(1, state.particles.length), energy);
        // Lớp sau núi -> dãy núi từ xa tới gần -> lớp trước núi.
        state.particles.filter(p => p.behind).forEach((p, i) => paintCometMeteor(frame.ctx, p, frame.cfg, colorOf(p, i), energy));
        paintCometMountains(frame.ctx, state, frame.cfg);
        state.particles.filter(p => !p.behind).forEach((p, i) => paintCometMeteor(frame.ctx, p, frame.cfg, colorOf(p, i + state.particles.length), energy));
    },

    // ===================== Vòng đời =====================

    /** Khung nhìn đổi (hoặc Custom Effect refresh 'resizeCanvas'): xoá gợn sóng/vệt chảy, rải lại giọt tĩnh, dựng
     * lại dãy nhà + cảnh phố theo kích thước mới. */
    onResize(viewport) {
        const rainCfg = resolveEffectConfig(appConfigViz.getAll().customEffect, 'rain'); // core/custom-effect.js
        resetCometMeteorState(this._comet, canvas.width, canvas.height, viewport.dpr, rainCfg);
        appState.set('ripples', []);
        appState.set('glassStreaks', []);
        appState.set('glassStaticDrops', buildGlassStaticDrops(rainCfg.glassDropDensity, canvas.width, canvas.height, viewport.dpr)); // core/canvas-scene-setup.js
        appState.set('cityBuildings', buildRainCityBuildings(canvas.width, viewport.dpr, rainCfg.streetBuildingScale)); // core
        const groundY = computeStreetGroundY(canvas.height, viewport.dpr); // core/canvas-scene-setup.js
        appState.set('streetGroundY', groundY);
        const streetLamps = buildStreetLamps(canvas.width, canvas.height, groundY, viewport.dpr, rainCfg.customLamps); // core
        appState.set('streetLamps', streetLamps);
        this._street.bands = resolveStreetLampBands(streetLamps.length); // core/visualizer/groups/falling/street.js
        const style = FALLING_STREET_SNOW;
        appState.set('streetRain', buildStreetSnowPool(rainCfg.streetDensity, canvas.width, canvas.height, viewport.dpr, style.spec)); // core
        console.log('writer: "workflowVizFalling.onResize", page: "ripples/glassStreaks/glassStaticDrops/cityBuildings/street*", content: "dựng lại cảnh Falling theo khung nhìn"');
    },

    /** Vừa chọn 1 style Rain (tay hoặc auto-switch) — dựng lại cảnh như `resizeCanvas()` cũ từng làm ở đây. */
    onStyleApplied(viewport) {
        this.onResize(viewport);
    },

    // ===================== glass =====================

    _drawGlass(frame) {
        const { ctx, canvas, cfg, dpr, isPlaying } = frame;
        const smoothedEnergy = frame.audio.smoothedEnergy(); // service/audio-analysis.js
        const vizDataArray = frame.audio.spectrum(FALLING_FFT_SIZE); // service/audio-analysis.js
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
        drawWindowFrame(ctx, canvas.width, canvas.height, dpr); // core/visualizer/draw/window-frame.js
    },

    /** Dãy nhà thành phố sau kính (toggle glassCityVisible) — cửa sổ theo color mode. */
    _paintGlassCity(frame) {
        const { ctx, canvas, cfg, dpr, isPlaying } = frame;
        const vizDataArray = frame.audio.spectrum(FALLING_FFT_SIZE); // service/audio-analysis.js
        if (cfg.glassCityVisible === false) return;
        const cityOpacity = (typeof cfg.glassCityOpacity === 'number' ? cfg.glassCityOpacity : 40) / 100;
        const cityFrame = computeRainCityFrame(canvas.width, canvas.height, appState.get('cityBuildings'), dpr, vizDataArray, isPlaying); // core
        const palette = {
            solid: hexToRgb(cfg.solidColor), dynA: hexToRgb(cfg.dynA), dynB: hexToRgb(cfg.dynB), // core/color-utils.js
            gradientRgb: cfg.gradientPaletteRgb,
            hueOffset: frame.audio.hueOffset(),
        };
        const litColorOf = RAIN_CITY_LIT_COLOR_BY_RULE[resolveEffectColorRule(cfg)]; // core/visualizer/effect-paint.js
        const windowColors = cityFrame.windows.map((w) => RAIN_GLASS_WINDOW_COLOR_BY_LIT[!!w.lit](litColorOf(palette, w.t, w.value)));
        paintRainCity(ctx, cityFrame, windowColors, cityOpacity); // core
    },

    /** Vệt nước chảy hết đường -> bỏ khỏi danh sách. */
    _removeDeadStreak(result, index) {
        if (result.alive) return;
        appState.mutate('glassStreaks', (arr) => arr.splice(index, 1), { skipCheck: true });
    },

    /** Nền tối riêng của Rain — chỉ khi KHÔNG có Visual Background (ảnh/video/folder) và không ở Video Player mode. */
    _paintBackdrop(frame) {
        const vbgCfg = appConfigVisualBg.getAll();
        const hasCustomBg = (vbgCfg.enabled !== false && vbgCfg.source.list.some((k) => k !== null)) || appState.get('isVideoPlayerMode'); // SỬA 29/09/2026 — VBG tắt (toggle tổng) = không có media, Rain tự sơn nền
        if (hasCustomBg) return;
        const { ctx, canvas } = frame;
        ctx.fillStyle = workflowVisualBg.canvasFillStyle(ctx, canvas.width, canvas.height); // event/workflow/visual-bg-common.js
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    },

    // ===================== street =====================

    /** Thứ tự lớp: nền -> chớp trời -> đất -> hàng rào -> màn tuyết -> đèn (cột/quầng) + mặt đường ướt + quầng tán
     * xạ -> hạt tuyết 3 lớp -> hạt sáng trong vùng đèn -> gợn nước. Âm thanh -> cảnh: xem đầu
     * core/visualizer/groups/falling/street.js. */
    _drawStreet(frame) {
        const { ctx, canvas, cfg, dpr, isPlaying, audio } = frame;
        const W = canvas.width, H = canvas.height;
        const nowMs = performance.now();
        const smoothedEnergy = audio.smoothedEnergy(); // service/audio-analysis.js
        const st = this._street;
        const style = FALLING_STREET_SNOW;
        const s = appState.get(['streetRain', 'streetGroundY', 'streetLamps', 'ripples']);
        this._paintBackdrop(frame);

        const isTransition = this._detectStreetTransition(frame);
        this._strikeThunderOnDrop(frame, isTransition, nowMs);
        drawScreenFlash(ctx, W, H, computeStreetThunderAlpha(nowMs, st.thunderAt, cfg.flashMaxOpacity)); // core/visualizer/draw + core

        const groundY = s.streetGroundY || computeStreetGroundY(H, dpr); // core/canvas-scene-setup.js
        const stopColors = (FALLING_STREET_GROUND_STOPS_BY_MODE[cfg.mode] || FALLING_STREET_GROUND_STOPS_BY_MODE.gradient)(cfg);
        paintFallingGroundGradient(ctx, W, H, groundY, stopColors); // core
        paintParkFence(ctx, W, groundY, dpr); // core

        st.energy = smoothStreetSnowEnergy(st.energy, audio.energySpectrumPercent()); // core — giữ thang phổ cũ để mật độ tuyết không đổi khi Energy chính chuyển sang RMS
        const density = computeStreetSnowDensity(s.streetRain.length, isPlaying, st.energy); // core — nghịch Energy phổ % (chủ đích)
        style.paintMist(ctx, W, H, groundY, density.ratio);

        const bandLevels = st.bands.map((b) => audio.band(b)); // service/audio-analysis.js
        const onsetTimes = st.bands.map((b) => audio.lastBandOnsetTime(b));
        const specs = advanceRainLampsAndBuildSpecs(s.streetLamps, isPlaying, bandLevels, onsetTimes, audio.vibrato(), nowMs, dpr); // core
        const lamps = specs.map((spec) => {
            const lampColor = workflowVisualizerRender.colorAt(...spec.colorArgs); // event/workflow/visualizer-render.js
            return { spec, fill: workflowVisualizerRender.modeColor(cfg, spec.colorArgs[0], lampColor.fill, 'gradient'), light: computeStreetLampLight(spec, groundY, dpr, smoothedEnergy) }; // core
        });
        lamps.forEach((l) => {
            paintRainLamp(ctx, l.spec, l.fill, dpr); // core
            paintStreetLampPool(ctx, l.light, l.fill, H, dpr); // core
            style.paintLampHaze(ctx, l.light, l.fill, density.ratio);
            this._rippleOnLampOnset(l, groundY, H, dpr);
        });

        st.wind = FALLING_STREET_WIND_BY_ENABLED[cfg.streetWindEnabled !== false](st.wind, audio, isTransition);
        advanceStreetSnowflakes(W, H, groundY, dpr, density.activeCount, st.wind.value, nowMs); // core
        style.layers.forEach((layer) => style.paintLayer(ctx, s.streetRain, layer, dpr));
        lamps.forEach((l) => style.paintLit(ctx, s.streetRain, l.light, l.fill, dpr, nowMs));

        advanceRainRipples(); // core
        paintRainRipples(ctx, s.ripples, dpr); // core
    },

    /** Nhạc vừa chuyển đoạn chưa (beat mới, cách lượt trước >= 2 beat, detectMusicTransition()) — dùng cho chớp trời + gió giật. */
    _detectStreetTransition(frame) {
        const win = this._street.beatWin;
        workflowVizBeatWindow.accumulateLatest(win, frame.audio.fluxHistory()); // event/workflow/visualizer/beat-window.js
        if (!workflowVizBeatWindow.consumeNewBeat(win, frame.audio.lastBeatTime())) return false;
        workflowVizBeatWindow.closeInterval(win);
        countBeatSinceTrigger(win); // core/visualizer/beat-window.js
        if (!frame.isPlaying || win.beatsSinceTrigger < 2) return false;
        if (!detectMusicTransition(win.history, 2, STREET_THUNDER_SECTION_BEATS, STREET_THUNDER_FLUX_THRESHOLD)) return false; // core
        resetBeatTriggerCount(win); // core
        return true;
    },

    /** Chớp trời: chuyển đoạn trùng cú sub đủ mạnh (cfg.flashThreshold = mức dải sub), qua hồi chiêu -> ghi mốc đánh. */
    _strikeThunderOnDrop(frame, isTransition, nowMs) {
        const { cfg, audio } = frame;
        if (!shouldStartStreetThunder(cfg.flashEnabled, isTransition, audio.msSinceBandOnset('sub'), audio.band('sub'), cfg.flashThreshold, nowMs, this._street.thunderAt)) return; // core
        this._street.thunderAt = nowMs;
    },

    /** Dải của đèn vừa có nốt mới -> gợn nước màu đèn dưới chân đèn. */
    _rippleOnLampOnset(lamp, groundY, H, dpr) {
        if (!lamp.spec.onset) return;
        spawnRainRipple(lamp.spec.x, groundY, H, dpr, lamp.fill, lamp.fill); // core
    },

};

workflowVisualizerRender.registerGroup('rain', workflowVizFalling);
