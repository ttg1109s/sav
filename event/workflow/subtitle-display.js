/**
 * event/workflow/subtitle-display.js — Workflow hiển thị phụ đề lúc phát (Song mode) + karaoke. THAY
 * processSubtitles()/clearAllActiveSubBlocks()/initSubtitleStateFromConfig() của core cũ.
 *
 * - sync(t): gọi mỗi 'timeupdate' / lúc kéo thanh tiến trình (workflowPlayerControls) — thêm/xoá khối dòng,
 *   chuyển pha Comming/In/Outing (CSS transition tự nội suy, không cần 60fps).
 * - SỬA (06/10/2026, Giang "kiểm tra timing phụ đề, chống lệch") — 'timeupdate' chỉ bắn mỗi 15-250ms (iOS/Chrome
 *   thường ~250ms), nên dòng hiện/đổi pha/ẩn TRỄ tới 1/4 giây (trung bình ~1/8 giây), lệch không đều giữa các dòng.
 *   Giờ mỗi sync() tính sẵn MỐC KẾ TIẾP (computeSubtitleLineNextBoundary(), core/subtitle/subtitle-transition.js);
 *   task raf 'subtitleClock' (chỉ chạy khi Song đang phát + còn mốc) mỗi khung hình chỉ so currentTime với mốc đó —
 *   tới mốc (hoặc tua lùi) mới gọi sync(): đúng khung hình, gần như 0 chi phí. 'timeupdate' vẫn giữ làm lưới an toàn.
 * - SỬA (06/10/2026, Giang chọn phương án A) — mọi thời điểm hiển thị (dòng + karaoke) = `currentTime` TRỪ độ trễ đầu ra
 *   của AudioContext (computeSubtitleDisplayTime(), core/subtitle/subtitle-transition.js) qua `_displayTime()`. sync()
 *   (public, nhận vị trí media thô) đổi 1 lần rồi gọi `_syncAt()`; đồng hồ mốc + karaoke tự đổi rồi dùng `_syncAt()`.
 * - Karaoke (dòng có `karaoke` hợp lệ + bật trong Settings): task raf 'subtitleKaraoke' chỉ chạy khi còn dòng
 *   karaoke hoặc hạt đang bay — bài không karaoke tốn 0 chi phí. Mỗi khung hình đọc audioPlayer.currentTime,
 *   tính pha/tô của từng từ (core/subtitle/subtitle-karaoke-display.js), chỉ ghi DOM khi giá trị đổi.
 * - Style: khung #subtitle-frame (mặc định / Element Style Editor) + biến CSS karaoke trên #subtitle-display.
 *   Karaoke luôn thắng style phụ đề (khai báo trực tiếp trên span từ > kế thừa từ khung).
 *
 * NẠP SAU: core/subtitle/*.js (transition, style-settings, display-ui, karaoke, karaoke-display, karaoke-display-ui),
 * core/element-style-editor.js, core/color-utils.js, core/dom-refs.js, service/task-manager.js.
 */
const SUBTITLE_KARAOKE_TASK = 'subtitleKaraoke';
const SUBTITLE_CLOCK_TASK = 'subtitleClock'; // MỚI 06/10/2026 — xem docstring đầu file
const SUBTITLE_KARAOKE_DPR_MAX = 2;

const SUBTITLE_BLOCK_ADD_BY_KARAOKE = {
    true: (entry) => workflowSubtitleDisplay._addKaraokeBlock(entry),
    false: (entry) => insertSubtitleBlockUi(subActiveLines, buildPlainSubtitleBlockUi(entry.sub)), // core/subtitle/subtitle-display-ui.js
};

const SUBTITLE_PHASE_APPLY_BY_PHASE = {
    comming: (block, entry, cfg, t) => workflowSubtitleDisplay._applyCommingPhase(block, entry, cfg, t),
    in: (block, entry, cfg) => workflowSubtitleDisplay._applyInPhase(block, cfg),
    outing: (block, entry, cfg, t) => workflowSubtitleDisplay._applyOutingPhase(block, entry, cfg, t),
};

const SUBTITLE_COMMING_BY_HAS_FX = {
    true: (block, fx, remainingMs) => playSubtitleCommingUi(block, fx, remainingMs),
    false: (block) => setSubtitleBlockStableUi(block, 'opacity:1'),
};

const SUBTITLE_OUTING_BY_HAS_FX = {
    true: (block, fx, remainingMs) => playSubtitleOutingUi(block, fx, remainingMs),
    false: (block) => setSubtitleBlockStableUi(block, 'opacity:0'),
};

const SUBTITLE_FRAME_STYLE_BY_CUSTOM = {
    true: (cfg) => applyElementStyleToDom(subtitleFrame, cfg.subtitleBoxCss), // core/element-style-editor.js
    false: (cfg) => applySubtitleFrameDefaultStyle(subtitleFrame, cfg.subtitleDefaultColor, cfg.subtitleDefaultFontSize), // core/subtitle/subtitle-style-settings.js
};

const SUBTITLE_ENABLED_APPLY_BY_ENABLED = {
    true: () => workflowSubtitleDisplay.sync(audioPlayer.currentTime),
    false: () => workflowSubtitleDisplay.clearAll(),
};

const KARAOKE_OPACITY_CHANGE_BY_KIND = {
    none: () => {},
    snap: (w, opacity) => { w.revealAt = 0; setKaraokeWordOpacityUi(w.el, opacity, 0); },
    in: (w, opacity, nowMs, kcfg) => KARAOKE_DISSOLVE_IN_BY_KIND[kcfg.dissolve](w, nowMs),
    out: (w, opacity, nowMs, kcfg) => KARAOKE_DISSOLVE_OUT_BY_KIND[kcfg.dissolve](w, nowMs, kcfg),
};

const KARAOKE_DISSOLVE_IN_BY_KIND = {
    fade: (w) => setKaraokeWordOpacityUi(w.el, 1, KARAOKE_REVEAL_MS),
    dust: (w, nowMs) => workflowSubtitleDisplay._revealWithParticles(w, 'dust', nowMs),
    smoke: (w, nowMs) => workflowSubtitleDisplay._revealWithParticles(w, 'smoke', nowMs),
};

const KARAOKE_DISSOLVE_OUT_BY_KIND = {
    fade: (w) => setKaraokeWordOpacityUi(w.el, 0, KARAOKE_VANISH_MS),
    dust: (w, nowMs, kcfg) => workflowSubtitleDisplay._vanishWithParticles(w, 'dust', nowMs, kcfg),
    smoke: (w, nowMs, kcfg) => workflowSubtitleDisplay._vanishWithParticles(w, 'smoke', nowMs, kcfg),
};

const KARAOKE_ACTIVE_TOGGLE_BY_ENTERING = {
    true: (lineId, w, kcfg) => workflowSubtitleDisplay._onKaraokeWordEnter(lineId, w, kcfg),
    false: (lineId, w) => workflowSubtitleDisplay._onKaraokeWordLeave(w),
};

const KARAOKE_EFFECT_TRANSFORM_BY_NAME = {
    swell: (pulse) => computeKaraokeSwellTransform(pulse), // core/subtitle/subtitle-karaoke-display.js
    bounceUp: (pulse) => computeKaraokeBounceUpTransform(pulse),
    dropDown: (pulse) => computeKaraokeDropDownTransform(pulse),
    squashX: (pulse, sign) => computeKaraokeSquashXTransform(pulse, sign),
    squashY: (pulse, sign) => computeKaraokeSquashYTransform(pulse, sign),
};

const KARAOKE_POINTER_PLACE_BY_VISIBLE = {
    true: (w, kcfg) => positionKaraokePointerUi(subtitleKaraokePointer, w.el, subtitleDisplay, kcfg.pointerShape.anchor, ''), // trượt sang từ mới
    false: (w, kcfg) => {
        positionKaraokePointerUi(subtitleKaraokePointer, w.el, subtitleDisplay, kcfg.pointerShape.anchor, 'none'); // hiện lần đầu: đặt thẳng
        setKaraokePointerVisibleUi(subtitleKaraokePointer, true);
    },
};

const workflowSubtitleDisplay = {
    _nextBoundarySec: Infinity,   // MỚI 06/10/2026 — mốc (giây) gần nhất mà 1 dòng sẽ đổi pha, tính ở sync()
    _lastClockSec: null,          // currentTime ở khung hình trước của 'subtitleClock' (phát hiện tua lùi)
    _pointerWord: null,           // MỚI 06/10/2026 — từ karaoke pointer đang chỉ (đặt lại khi các dòng xê dịch)
    _loggedLatencyContext: null,  // AudioContext đã log độ trễ đầu ra (chỉ log 1 lần mỗi context)

    // ===================== Boot / cài đặt =====================

    /** Gọi từ event/workflow/app-boot.js ngay sau loadConfig(). */
    initFromConfig() {
        setSubtitlesEnabledState(appConfigViz.getAll().subtitlesEnabled !== false); // core
        this.applyFrameStyle();
        this.applyKaraokeConfig();
    },

    /** Áp style khung #subtitle-frame theo Custom styling (Element Style Editor) hay mặc định (màu + cỡ chữ). */
    applyFrameStyle() {
        const cfg = appConfigViz.getAll();
        resetSubtitleFrameStyle(subtitleFrame); // core
        SUBTITLE_FRAME_STYLE_BY_CUSTOM[!!cfg.subtitleUseCustomStyling](cfg);
    },

    /** Chụp cấu hình karaoke (dùng trong vòng raf, khỏi đọc config mỗi khung hình) + áp biến CSS + hình pointer.
     * Mọi từ đang hiện tính lại từ đầu ở khung hình kế (đặt thẳng, không hiệu ứng). */
    applyKaraokeConfig() {
        const cfg = appConfigViz.getAll();
        const kcfg = {
            enabled: cfg.subtitleKaraokeEnabled !== false,
            modeRow: KARAOKE_MODE_TABLE[cfg.subtitleKaraokeMode] || KARAOKE_MODE_TABLE.kf,
            dissolve: KARAOKE_DISSOLVE_IN_BY_KIND[cfg.subtitleKaraokeDissolve] ? cfg.subtitleKaraokeDissolve : 'fade',
            effect: KARAOKE_EFFECT_TRANSFORM_BY_NAME[cfg.subtitleKaraokeActiveEffect] ? cfg.subtitleKaraokeActiveEffect : 'none',
            squashSign: cfg.subtitleKaraokeSquashDirection === 'in' ? -1 : 1,
            outline: !!cfg.subtitleKaraokeOutline,
            pointer: !!cfg.subtitleKaraokePointer,
            pointerShape: KARAOKE_POINTER_SHAPES[cfg.subtitleKaraokePointerShape] || KARAOKE_POINTER_SHAPES.default,
            color: cfg.subtitleKaraokeColor || '#facc15',
        };
        appState.set('karaokeRenderConfig', kcfg);
        applyKaraokeStyleVarsUi(subtitleDisplay, hexToRgb(kcfg.color), cfg.subtitleKaraokeOutlineWidth, cfg.subtitleKaraokeOutlineOpacity, cfg.subtitleKaraokeOutlineGlow, cfg.subtitleKaraokeOutlineBlur); // core/color-utils.js + core -ui
        setKaraokePointerShapeUi(subtitleKaraokePointer, kcfg.pointerShape);
        setKaraokePointerVisibleUi(subtitleKaraokePointer, false);
        appState.set('karaokePointerLineId', null);
        this._pointerWord = null;
        appState.get('karaokeLines').forEach((line) => line.words.forEach((w) => this._resetKaraokeWord(w)));
        this._resumeKaraokeLoop(); // đang pause vẫn vẽ lại ngay 1 khung hình
    },

    /** Bật/tắt karaoke đổi cấu trúc khối (từ tách span <-> text thường) -> dựng lại các dòng đang hiện. */
    rebuildActiveBlocks() {
        this.clearAll();
        this.sync(audioPlayer.currentTime);
    },

    /** Toggle "Show subtitles". */
    setEnabled(enabled) {
        setSubtitlesEnabledState(enabled); // core
        SUBTITLE_ENABLED_APPLY_BY_ENABLED[enabled]();
    },

    // ===================== Dòng phụ đề (theo 'timeupdate') =====================

    /** Đồng bộ các khối dòng với vị trí media `currentTime` (THÔ, chưa bù độ trễ — mọi nơi gọi bên ngoài truyền thẳng
     * audioPlayer.currentTime / vị trí đang kéo). */
    sync(currentTime) {
        this._syncAt(this._displayTime(currentTime));
    },

    /** MỚI (06/10/2026) — vị trí media -> thời điểm phụ đề nên hiển thị (trừ độ trễ đầu ra, đọc sống mỗi lần vì
     * outputLatency đổi khi đổi tai nghe/loa). @param {number} mediaTimeSec @returns {number} */
    _displayTime(mediaTimeSec) {
        const ctx = appState.get('audioContext');
        return computeSubtitleDisplayTime(mediaTimeSec, ctx && ctx.baseLatency, ctx && ctx.outputLatency); // core/subtitle/subtitle-transition.js
    },

    /** Thân sync() cũ — `currentTime` ở đây là thời điểm hiển thị ĐÃ bù độ trễ. */
    _syncAt(currentTime) {
        const s = appState.get(['isSubtitlesEnabled', 'subtitles', 'activeSubIds']);
        if (!s.isSubtitlesEnabled) { this.clearAll(); return; }
        const cfg = appConfigViz.getAll();
        const { nowActive, nextBoundarySec } = this._collectActiveLines(s.subtitles, currentTime, cfg);
        this._nextBoundarySec = nextBoundarySec;
        let layoutChanged = false; // có khối dòng nào thêm/bớt -> các dòng còn lại xê dịch
        s.activeSubIds.forEach((id) => { layoutChanged = this._removeBlockIfInactive(id, nowActive) || layoutChanged; });
        nowActive.forEach((entry, id) => { layoutChanged = this._addBlockIfNew(id, entry, s.activeSubIds) || layoutChanged; });
        appState.set('activeSubIds', new Set(nowActive.keys()), { skipCheck: true });
        nowActive.forEach((entry, id) => this._applyBlockPhase(id, entry, cfg, currentTime));
        this._syncDisplayVisibility();
        this._realignKaraokePointer(layoutChanged);
        this._resumeKaraokeLoop(); // play lại / seek lúc pause -> vòng raf chạy tiếp (nó tự dừng khi pause, xem _stopKaraokeLoopIfIdle())
        this._ensureSubtitleClock();
    },

    /** Xoá sạch mọi khối + karaoke (đổi bài, sang Video/Photo, tắt phụ đề). */
    clearAll() {
        removeAllSubtitleBlocksUi(subActiveLines); // core
        appState.set('activeSubIds', new Set());
        appState.set('karaokeLines', new Map());
        appState.set('karaokeParticles', [], { skipCheck: true });
        appState.set('karaokePointerLineId', null);
        taskManager.kill(SUBTITLE_KARAOKE_TASK);
        taskManager.kill(SUBTITLE_CLOCK_TASK);
        this._nextBoundarySec = Infinity;
        this._pointerWord = null;
        appState.set('karaokeLastMediaTime', null, { skipCheck: true });
        this._clearKaraokeFx();
        setKaraokePointerVisibleUi(subtitleKaraokePointer, false); // core -ui
        setSubtitleDisplayVisibleUi(subtitleDisplay, false); // core -ui
    },

    /** SỬA 06/10/2026 — trả thêm `nextBoundarySec` (mốc gần nhất > t mà pha 1 dòng bất kỳ sẽ đổi, xem 'subtitleClock').
     * @returns {{nowActive: Map<string, {sub: Object, commingWindow: Object, outingWindow: Object, phase: string}>, nextBoundarySec: number}} */
    _collectActiveLines(subtitles, t, cfg) {
        const commingOn = cfg.subtitleCommingEffect !== 'none';
        const outingOn = cfg.subtitleOutingEffect !== 'none';
        const nowActive = new Map();
        let nextBoundarySec = Infinity;
        subtitles.forEach((sub) => {
            const commingWindow = computeSubtitleTransitionWindow(sub.start, cfg.subtitleCommingValueMs, sub.start, sub.end); // core
            const outingWindow = computeSubtitleTransitionWindow(sub.end, cfg.subtitleOutingValueMs, sub.start, sub.end); // core
            nextBoundarySec = Math.min(nextBoundarySec, computeSubtitleLineNextBoundary(t, sub, commingWindow, outingWindow, commingOn, outingOn)); // core
            const phase = resolveSubtitleLinePhase(t, sub, commingWindow, outingWindow, commingOn, outingOn); // core
            if (!phase) return;
            nowActive.set(sub.id, { sub, commingWindow, outingWindow, phase });
        });
        return { nowActive, nextBoundarySec };
    },

    /** @returns {boolean} true = đã gỡ 1 khối (bố cục đổi) */
    _removeBlockIfInactive(id, nowActive) {
        if (nowActive.has(id)) return false;
        removeSubtitleBlockUi(subActiveLines, id); // core
        this._dropKaraokeLine(id);
        return true;
    },

    /** @returns {boolean} true = đã thêm 1 khối (bố cục đổi) */
    _addBlockIfNew(id, entry, activeSubIds) {
        if (activeSubIds.has(id)) return false;
        SUBTITLE_BLOCK_ADD_BY_KARAOKE[this._isKaraokeEligible(entry.sub)](entry);
        return true;
    },

    /** Dòng hiện karaoke khi: bật karaoke + dòng có timing đã Apply + timing còn khớp chữ. */
    _isKaraokeEligible(sub) {
        const kcfg = appState.get('karaokeRenderConfig');
        return !!kcfg && kcfg.enabled && Array.isArray(sub.karaoke) && isKaraokeMatchingText(sub.karaoke, sub.text); // core/subtitle/subtitle-karaoke.js
    },

    _applyBlockPhase(id, entry, cfg, t) {
        const block = document.getElementById(`sub-active-${id}`);
        if (!block || block.dataset.phase === entry.phase) return; // phase chưa đổi -> không bắn lại transition
        markSubtitleBlockPhaseUi(block, entry.phase); // core
        SUBTITLE_PHASE_APPLY_BY_PHASE[entry.phase](block, entry, cfg, t);
    },

    _applyCommingPhase(block, entry, cfg, t) {
        const fx = SUBTITLE_TRANSITION_EFFECTS[cfg.subtitleCommingEffect];
        SUBTITLE_COMMING_BY_HAS_FX[!!fx](block, fx, Math.max(0, (entry.commingWindow.to - t) * 1000));
    },

    _applyInPhase(block, cfg) {
        const commingFx = SUBTITLE_TRANSITION_EFFECTS[cfg.subtitleCommingEffect];
        setSubtitleBlockStableUi(block, commingFx ? commingFx.visibleCss : 'opacity:1'); // core
        this._addInEffect(block, SUBTITLE_IN_EFFECTS[cfg.subtitleInEffect]);
    },

    _addInEffect(block, inClass) {
        if (!inClass) return;
        addSubtitleInEffectUi(block, inClass); // core
    },

    _applyOutingPhase(block, entry, cfg, t) {
        const fx = SUBTITLE_TRANSITION_EFFECTS[cfg.subtitleOutingEffect];
        SUBTITLE_OUTING_BY_HAS_FX[!!fx](block, fx, Math.max(0, (entry.outingWindow.to - t) * 1000));
    },

    /** Khung chiếm chỗ khi còn dòng đang hiện hoặc hạt karaoke còn bay. */
    _syncDisplayVisibility() {
        setSubtitleDisplayVisibleUi(subtitleDisplay, appState.get('activeSubIds').size > 0 || appState.get('karaokeFxDirty')); // core
    },

    // ===================== Karaoke — dựng/dọn dòng =====================

    _addKaraokeBlock(entry) {
        const sub = fitSubtitlesKaraokeToDuration([entry.sub], new Set([entry.sub.id]))[0]; // core — dữ liệu cũ lệch thời lượng
        const tokens = tokenizeKaraokeSubtitleText(sub.text); // core
        const wordTokens = tokens.filter((token) => token.kind === 'word');
        const timeline = buildKaraokeWordTimeline(sub.karaoke, sub.start); // core
        const built = buildKaraokeSubtitleBlockUi(sub.id, sub.start, tokens); // core -ui
        const words = built.words.map((els, i) => ({
            ...els, text: wordTokens[i].text, startSec: timeline[i].startSec, endSec: timeline[i].endSec,
            phase: null, fill: -1, opacity: null, revealAt: 0,
        }));
        insertSubtitleBlockUi(subActiveLines, built.block); // core
        appState.mutate('karaokeLines', (lines) => lines.set(sub.id, { id: sub.id, words }));
        this._ensureKaraokeLoop();
    },

    _dropKaraokeLine(id) {
        if (!appState.get('karaokeLines').has(id)) return;
        appState.mutate('karaokeLines', (lines) => lines.delete(id));
        this._hidePointerOfLine(id);
    },

    _hidePointerOfLine(id) {
        if (appState.get('karaokePointerLineId') !== id) return;
        appState.set('karaokePointerLineId', null);
        this._pointerWord = null;
        setKaraokePointerVisibleUi(subtitleKaraokePointer, false); // core -ui
    },

    /** MỚI (06/10/2026, Giang báo: nhiều dòng karaoke cùng hiện, 1 dòng mất trước -> trục Y của pointer sai) — pointer chỉ
     * được đặt lúc 1 từ BẮT ĐẦU hát; khối dòng khác thêm/bớt (#sub-active-lines xếp dọc, neo đáy) làm dòng đang hát xê
     * dịch nhưng pointer đứng nguyên chỗ cũ. Giờ mỗi lần bố cục đổi thì đặt lại pointer lên đúng từ đang chỉ (đặt thẳng,
     * không trượt). Bỏ transform hiệu ứng (swell/bounce...) của từ trước khi đo — khung hình karaoke kế tự áp lại. */
    _realignKaraokePointer(layoutChanged) {
        if (!layoutChanged) return;
        const w = this._pointerWord;
        if (!w || appState.get('karaokePointerLineId') === null) return; // guard: pointer đang ẩn
        if (!w.el.isConnected) return; // guard: từ đã bị gỡ cùng dòng của nó
        setKaraokeWordTransformUi(w.el, ''); // core -ui
        positionKaraokePointerUi(subtitleKaraokePointer, w.el, subtitleDisplay, appState.get('karaokeRenderConfig').pointerShape.anchor, 'none'); // core -ui
    },

    /** Đưa từ về trạng thái "chưa tính" — khung hình kế đặt thẳng đúng trạng thái (không hiệu ứng). */
    _resetKaraokeWord(w) {
        w.phase = null;
        w.fill = -1;
        w.opacity = null;
        w.revealAt = 0;
        setKaraokeWordTransformUi(w.el, ''); // core -ui
        setKaraokeWordOutlineUi(w.el, false);
    },

    // ===================== Karaoke — vòng raf =====================

    _ensureKaraokeLoop() {
        if (taskManager.isTaskRunning(SUBTITLE_KARAOKE_TASK)) return;
        taskManager.addNew(SUBTITLE_KARAOKE_TASK, { time: 0, exe: () => this._tickKaraoke(), mode: 'raf', count: 0 }); // service/task-manager.js
        taskManager.operator(SUBTITLE_KARAOKE_TASK, 'enabled');
    },

    _tickKaraoke() {
        const nowMs = performance.now();
        const t = this._displayTime(audioPlayer.currentTime); // SỬA 06/10/2026 — bù độ trễ đầu ra, khớp dòng phụ đề
        const isJump = isKaraokeTimeJump(appState.get('karaokeLastMediaTime'), t); // core
        appState.set('karaokeLastMediaTime', t, { skipCheck: true });
        const kcfg = appState.get('karaokeRenderConfig');
        appState.get('karaokeLines').forEach((line) => {
            line.words.forEach((w) => this._tickKaraokeWord(line.id, w, t, nowMs, isJump, kcfg));
        });
        this._tickKaraokeParticles(nowMs);
        this._stopKaraokeLoopIfIdle();
    },

    _tickKaraokeWord(lineId, w, t, nowMs, isJump, kcfg) {
        const phase = resolveKaraokeWordPhase(t, w.startSec, w.endSec, KARAOKE_REVEAL_LEAD_SEC); // core
        const progress = computeKaraokeWordProgress(t, w.startSec, w.endSec); // core
        this._updateKaraokeFill(w, computeKaraokeWordFill(kcfg.modeRow, phase, progress)); // core
        this._updateKaraokePhase(lineId, w, phase, isJump, nowMs, kcfg);
        this._finishKaraokeReveal(w, nowMs);
        this._updateKaraokeEffect(w, phase, progress, kcfg);
    },

    _updateKaraokeFill(w, fill) {
        if (fill === w.fill) return;
        w.fill = fill;
        setKaraokeWordFillUi(w.fillEl, fill); // core -ui
    },

    /** Đổi pha: bật/tắt trạng thái "đang hát" TRƯỚC (bỏ transform để đo vị trí chữ đúng), rồi đổi độ hiện. */
    _updateKaraokePhase(lineId, w, phase, isJump, nowMs, kcfg) {
        if (phase === w.phase) return;
        const wasActive = w.phase === 'active';
        w.phase = phase;
        this._toggleKaraokeActive(lineId, w, wasActive, phase === 'active', kcfg);
        const nextOpacity = kcfg.modeRow.opacity[phase];
        const change = resolveKaraokeOpacityChange(w.opacity, nextOpacity, isJump); // core
        w.opacity = nextOpacity;
        KARAOKE_OPACITY_CHANGE_BY_KIND[change](w, nextOpacity, nowMs, kcfg);
    },

    _toggleKaraokeActive(lineId, w, wasActive, isActive, kcfg) {
        if (wasActive === isActive) return;
        KARAOKE_ACTIVE_TOGGLE_BY_ENTERING[isActive](lineId, w, kcfg);
    },

    _onKaraokeWordEnter(lineId, w, kcfg) {
        setKaraokeWordOutlineUi(w.el, kcfg.outline); // core -ui
        this._moveKaraokePointer(lineId, w, kcfg);
    },

    _onKaraokeWordLeave(w) {
        setKaraokeWordTransformUi(w.el, ''); // core -ui
        setKaraokeWordOutlineUi(w.el, false);
    },

    _moveKaraokePointer(lineId, w, kcfg) {
        if (!kcfg.pointer) return;
        KARAOKE_POINTER_PLACE_BY_VISIBLE[appState.get('karaokePointerLineId') !== null](w, kcfg);
        appState.set('karaokePointerLineId', lineId, { skipCheck: true });
        this._pointerWord = w;
    },

    /** Hiệu ứng từ đang hát: 1 nhịp theo đúng thời lượng từ. */
    _updateKaraokeEffect(w, phase, progress, kcfg) {
        if (phase !== 'active' || kcfg.effect === 'none') return;
        setKaraokeWordTransformUi(w.el, KARAOKE_EFFECT_TRANSFORM_BY_NAME[kcfg.effect](computeKaraokePulse(progress), kcfg.squashSign)); // core
    },

    /** Hiện bằng hạt: chữ ẩn trong lúc hạt tụ về, hết thời gian thì hiện chữ thật. */
    _finishKaraokeReveal(w, nowMs) {
        if (!w.revealAt || nowMs < w.revealAt) return;
        w.revealAt = 0;
        setKaraokeWordOpacityUi(w.el, 1, 120); // core -ui
    },

    _revealWithParticles(w, presetName, nowMs) {
        setKaraokeWordOpacityUi(w.el, 0, 0); // core -ui
        this._spawnKaraokeParticles(w, presetName, readKaraokeTextStyleUi(w.baseEl).color, true, KARAOKE_REVEAL_MS, nowMs);
        w.revealAt = nowMs + KARAOKE_REVEAL_MS;
    },

    /** Tan bằng hạt: lấy mẫu chữ (đang màu karaoke) TRƯỚC rồi mới ẩn chữ thật. */
    _vanishWithParticles(w, presetName, nowMs, kcfg) {
        this._spawnKaraokeParticles(w, presetName, kcfg.color, false, KARAOKE_VANISH_MS, nowMs);
        setKaraokeWordOpacityUi(w.el, 0, 0); // core -ui
    },

    // ===================== Karaoke — hạt bụi / sương khói =====================

    /** Canvas hiệu ứng + canvas nháp lấy mẫu chữ — tạo 1 lần. */
    _ensureKaraokeFx() {
        const existing = appState.get('karaokeFx');
        if (existing) return existing;
        const fx = {
            ctx: subtitleKaraokeFx.getContext('2d'),
            scratch: createKaraokeScratchCanvasUi(), // core -ui
            dpr: Math.min(SUBTITLE_KARAOKE_DPR_MAX, window.devicePixelRatio || 1),
        };
        appState.set('karaokeFx', fx);
        return fx;
    },

    /** Sprite theo màu + độ mềm, cache theo khoá. @returns {string} khoá sprite */
    _ensureKaraokeSprite(color, core) {
        const key = `${color}|${core}`;
        if (appState.get('karaokeSprites').has(key)) return key;
        const sprite = buildKaraokeParticleSpriteUi(color, core); // core -ui
        appState.mutate('karaokeSprites', (sprites) => sprites.set(key, sprite));
        return key;
    },

    _spawnKaraokeParticles(w, presetName, color, reverse, lifeMs, nowMs) {
        const fx = this._ensureKaraokeFx();
        const preset = KARAOKE_PARTICLE_PRESETS[presetName];
        syncKaraokeFxCanvasSizeUi(subtitleKaraokeFx, fx.dpr); // core -ui
        const box = measureKaraokeWordBoxUi(w.el, subtitleKaraokeFx); // core -ui
        const points = sampleKaraokeGlyphPointsUi(fx.scratch, w.text, readKaraokeTextStyleUi(w.baseEl).font, box, preset.step); // core -ui
        const key = this._ensureKaraokeSprite(color, preset.spriteCore);
        const spawned = buildKaraokeParticles(points, key, preset, reverse, nowMs, lifeMs); // core
        appState.set('karaokeParticles', pruneKaraokeParticles(appState.get('karaokeParticles').concat(spawned), nowMs), { skipCheck: true }); // core
        appState.set('karaokeFxDirty', true, { skipCheck: true });
    },

    /** Vẽ hạt khi còn hạt; hết hạt vẽ thêm 1 lần (xoá canvas) rồi thôi. */
    _tickKaraokeParticles(nowMs) {
        if (!appState.get('karaokeFxDirty')) return;
        const fx = this._ensureKaraokeFx();
        const alive = pruneKaraokeParticles(appState.get('karaokeParticles'), nowMs); // core
        appState.set('karaokeParticles', alive, { skipCheck: true });
        syncKaraokeFxCanvasSizeUi(subtitleKaraokeFx, fx.dpr); // core -ui
        drawKaraokeParticlesUi(fx.ctx, alive, nowMs, appState.get('karaokeSprites'), fx.dpr); // core -ui
        appState.set('karaokeFxDirty', alive.length > 0, { skipCheck: true });
    },

    _clearKaraokeFx() {
        const fx = appState.get('karaokeFx');
        appState.set('karaokeFxDirty', false, { skipCheck: true });
        if (!fx) return;
        drawKaraokeParticlesUi(fx.ctx, [], 0, appState.get('karaokeSprites'), fx.dpr); // core -ui — xoá canvas
    },

    _resumeKaraokeLoop() {
        if (appState.get('karaokeLines').size === 0) return;
        this._ensureKaraokeLoop();
    },

    /** Dừng raf khi không còn việc: hết hạt VÀ (không còn dòng karaoke HOẶC media đang pause — khung hình cuối đã
     * vẽ đúng trạng thái; 'timeupdate' lúc play/seek gọi _resumeKaraokeLoop()). */
    _stopKaraokeLoopIfIdle() {
        const hasLines = appState.get('karaokeLines').size > 0;
        if (appState.get('karaokeFxDirty') || (hasLines && !audioPlayer.paused)) return;
        taskManager.kill(SUBTITLE_KARAOKE_TASK);
        this._resetKaraokeIdleUi(hasLines);
    },

    /** Hết hẳn dòng karaoke -> ẩn pointer, quên mốc thời gian, trả khung về đúng trạng thái hiện/ẩn. */
    _resetKaraokeIdleUi(hasLines) {
        if (hasLines) return;
        appState.set('karaokeLastMediaTime', null, { skipCheck: true });
        appState.set('karaokePointerLineId', null);
        this._pointerWord = null;
        setKaraokePointerVisibleUi(subtitleKaraokePointer, false); // core -ui
        this._syncDisplayVisibility();
    },

    // ===================== Đồng hồ mốc phụ đề (MỚI 06/10/2026) =====================

    /** Bật 'subtitleClock' nếu Song đang phát và còn mốc phía trước. Gọi cuối mỗi sync(). */
    _ensureSubtitleClock() {
        if (taskManager.isTaskRunning(SUBTITLE_CLOCK_TASK)) return;
        if (audioPlayer.paused || this._nextBoundarySec === Infinity) return; // guard: không có gì để canh
        this._lastClockSec = null;
        taskManager.addNew(SUBTITLE_CLOCK_TASK, { time: 0, exe: () => this._tickSubtitleClock(), mode: 'raf', count: 0 }); // service/task-manager.js
        taskManager.operator(SUBTITLE_CLOCK_TASK, 'enabled');
        this._logAudioLatencyOnce();
    },

    /** Mỗi khung hình: chỉ đọc currentTime + so mốc; tới mốc hoặc tua lùi mới sync(). */
    _tickSubtitleClock() {
        if (this._stopSubtitleClockIfIdle()) return;
        if (workflowPlayerControls.isHeldBySeekGate(audioPlayer)) return; // guard: cổng seek đang nạp lại nguồn, currentTime tạm về 0 (event/workflow/player-controls.js)
        const t = this._displayTime(audioPlayer.currentTime); // mốc tính theo thời điểm hiển thị (đã bù độ trễ)
        const last = this._lastClockSec;
        this._lastClockSec = t;
        const jumpedBack = last !== null && t < last;
        if (t < this._nextBoundarySec && !jumpedBack) return; // guard: chưa tới mốc
        this._syncAt(t);
    },

    /** Pause / hết mốc -> tắt đồng hồ ('timeupdate' lúc play/seek gọi sync() bật lại). @returns {boolean} true = đã tắt */
    _stopSubtitleClockIfIdle() {
        if (!audioPlayer.paused && this._nextBoundarySec !== Infinity) return false;
        taskManager.kill(SUBTITLE_CLOCK_TASK);
        return true;
    },

    /** Chẩn đoán (Debug console) — độ trễ từ lúc audio rời Web Audio tới loa/tai nghe, ĐANG được bù vào phụ đề
     * (`_displayTime()`). "n/a" = trình duyệt không báo -> phần đó không bù. */
    _logAudioLatencyOnce() {
        const ctx = appState.get('audioContext');
        if (!ctx || ctx === this._loggedLatencyContext) return;
        this._loggedLatencyContext = ctx;
        const fmt = (v) => (typeof v === 'number' ? `${v.toFixed(3)}s` : 'n/a');
        console.log(`[workflowSubtitleDisplay] độ trễ đầu ra AudioContext: baseLatency=${fmt(ctx.baseLatency)}, outputLatency=${fmt(ctx.outputLatency)} — đang bù vào phụ đề (n/a = trình duyệt không báo, không bù)`);
    },
};
