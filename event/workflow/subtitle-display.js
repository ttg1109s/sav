/**
 * event/workflow/subtitle-display.js — Workflow hiển thị phụ đề lúc phát (Song) + karaoke.
 *
 * Đồng bộ dòng (`sync()` / `_syncAt()`): computeSubtitleLineStates() (core) cho các dòng đang hiệu lực + pha + MỐC KẾ TIẾP;
 * thêm/gỡ khối, hiện khung, các dòng còn lại trượt mượt về chỗ mới (FLIP — dòng chồng lấp không còn bị đẩy cứng), rồi ghim
 * hiệu ứng Comming/Outing theo thời gian media.
 *
 * Chống lệch timing:
 * - Thời điểm hiển thị = vị trí media TRỪ độ trễ đầu ra AudioContext (`_displayTime()`, Giang chọn phương án A 06/10/2026).
 * - Task raf 'subtitleClock' (chỉ chạy khi Song đang phát + còn mốc) so vị trí với mốc mỗi khung hình — tới mốc hoặc tua
 *   lùi (lặp bài) mới đồng bộ; 'timeupdate' (~250ms) là lưới an toàn.
 * - Hiệu ứng pha là Web Animation ĐƯỢC GHIM (computeSubtitlePhasePin(), core): mỗi lần đồng bộ đặt lại tiến độ = vị trí
 *   media trong khung, đứng yên khi media dừng/đang kéo, theo tốc độ phát — seek, pause, đổi tốc độ, ẩn tab lâu đều về đúng.
 * - Kéo thanh tiến trình / seek-hold: `preview(t)` — phụ đề + karaoke + đồng hồ mốc theo mốc kéo, không theo vị trí đang phát.
 * - Cổng seek đang nạp lại nguồn (currentTime tạm về 0): đồng hồ mốc + karaoke bỏ qua khung hình đó.
 * - App hiện lại sau khi ẩn (`resync()`): karaoke đặt thẳng đúng trạng thái, dòng đồng bộ lại.
 *
 * Karaoke (dòng có `karaoke` hợp lệ + bật trong Settings): task raf 'subtitleKaraoke' chỉ chạy khi còn dòng karaoke hoặc
 * hạt đang bay. Mỗi khung hình tính pha/tô từng từ (core/subtitle/subtitle-karaoke-display.js), chỉ ghi DOM khi đổi.
 * Style: khung #subtitle-frame (mặc định / Element Style Editor) + biến CSS karaoke trên #subtitle-display; karaoke thắng.
 *
 * NẠP SAU: core/subtitle/*.js (transition, style-settings, display-ui, karaoke, karaoke-display, karaoke-display-ui),
 * components/visualizer-overlay.js (renderKaraokeLineHtml), core/element-style-editor.js, core/color-utils.js,
 * core/dom-refs.js, service/task-manager.js. Gọi lúc chạy: event/workflow/player-controls.js (isHeldBySeekGate).
 */
const SUBTITLE_KARAOKE_TASK = 'subtitleKaraoke';
const SUBTITLE_CLOCK_TASK = 'subtitleClock';
const SUBTITLE_KARAOKE_DPR_MAX = 2;
const SUBTITLE_REFLOW_MS = 280; // dòng xê dịch khi dòng khác thêm/bớt
const SUBTITLE_POINTER_REFLOW_TRANSITION = `transform ${SUBTITLE_REFLOW_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;

const SUBTITLE_SYNC_BY_ENABLED = {
    true: (s, t) => workflowSubtitleDisplay._syncLines(s, t),
    false: () => workflowSubtitleDisplay.clearAll(),
};

const SUBTITLE_BLOCK_ADD_BY_KARAOKE = {
    true: (entry) => workflowSubtitleDisplay._addKaraokeBlock(entry),
    false: (entry) => insertSubtitleBlockUi(subActiveLines, buildPlainSubtitleBlockUi(entry.sub)), // core/subtitle/subtitle-display-ui.js
};

// Thêm/bớt dòng: chụp vị trí đang thấy TRƯỚC khi đổi DOM, rồi cho các dòng còn lại trượt về chỗ mới.
const SUBTITLE_MEASURE_BY_LAYOUT_CHANGE = {
    true: () => measureSubtitleBlockTopsUi(subActiveLines), // core/subtitle/subtitle-display-ui.js
    false: () => null,
};
const SUBTITLE_REFLOW_BY_LAYOUT_CHANGE = {
    true: (beforeTops) => workflowSubtitleDisplay._reflowLines(beforeTops),
    false: () => {},
};

// Pha vừa đổi: chỉ pha In có việc thêm (class hiệu ứng In).
const SUBTITLE_PHASE_ENTER_BY_PHASE = {
    comming: () => {},
    in: (block, cfg) => workflowSubtitleDisplay._addInEffect(block, SUBTITLE_IN_EFFECTS[cfg.subtitleInEffect]),
    outing: () => {},
};

// Mỗi lần đồng bộ: ghim hiệu ứng Comming/Outing theo thời gian media (In không có hiệu ứng ghim).
const SUBTITLE_PHASE_PIN_BY_PHASE = {
    comming: (block, entry, cfg, t, clock) => workflowSubtitleDisplay._pinPhase(block, cfg.subtitleCommingEffect, 'comming', entry.commingWindow, t, clock),
    in: () => {},
    outing: (block, entry, cfg, t, clock) => workflowSubtitleDisplay._pinPhase(block, cfg.subtitleOutingEffect, 'outing', entry.outingWindow, t, clock),
};

const SUBTITLE_CLOCK_TICK_BY_IDLE = {
    true: () => taskManager.kill(SUBTITLE_CLOCK_TASK), // 'timeupdate' lúc play/seek gọi sync() bật lại
    false: () => workflowSubtitleDisplay._checkSubtitleClock(),
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
    _nextBoundarySec: Infinity,   // mốc (giây) gần nhất mà 1 dòng sẽ đổi pha, tính ở mỗi lần đồng bộ
    _lastClockSec: null,          // thời điểm hiển thị ở khung hình trước của 'subtitleClock' (phát hiện tua lùi)
    _seekPreviewSec: 0,           // mốc đang kéo (thanh tiến trình / seek-hold) — dùng khi `isSeeking`
    _pointerWord: null,           // từ karaoke pointer đang chỉ (đặt lại khi các dòng xê dịch)
    _loggedLatencyContext: null,  // AudioContext đã log độ trễ đầu ra (1 lần mỗi context)

    // ===================== Boot / cài đặt =====================

    /** Gọi từ event/workflow/app-boot.js ngay sau loadConfig(). */
    initFromConfig() {
        setSubtitlesEnabledState(appConfigViz.getAll().subtitlesEnabled !== false); // core
        this.applyFrameStyle();
        this.applyKaraokeConfig();
    },

    /** Style khung #subtitle-frame theo Custom styling (Element Style Editor) hay mặc định (màu + cỡ chữ). */
    applyFrameStyle() {
        const cfg = appConfigViz.getAll();
        resetSubtitleFrameStyle(subtitleFrame); // core
        SUBTITLE_FRAME_STYLE_BY_CUSTOM[!!cfg.subtitleUseCustomStyling](cfg);
    },

    /** Chụp cấu hình karaoke (vòng raf khỏi đọc config mỗi khung hình) + biến CSS + hình pointer. Mọi từ đang hiện tính
     * lại từ đầu ở khung hình kế (đặt thẳng, không hiệu ứng). */
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
        this._resetAllKaraokeWords();
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

    // ===================== Dòng phụ đề =====================

    /** Đồng bộ theo vị trí media THÔ (chưa bù độ trễ) — 'timeupdate', play, xong cổng seek. */
    sync(currentTime) {
        this._syncAt(this._displayTime(currentTime));
    },

    /** Đang kéo thanh tiến trình / seek-hold: phụ đề + karaoke theo mốc kéo (media vẫn phát ở chỗ cũ). */
    preview(currentTime) {
        this._seekPreviewSec = currentTime;
        this.sync(currentTime);
    },

    /** Đồng bộ lại toàn bộ (app hiện lại sau khi ẩn): karaoke đặt thẳng đúng trạng thái ở khung hình kế. */
    resync() {
        this._resetAllKaraokeWords();
        appState.set('karaokeLastMediaTime', null, { skipCheck: true });
        this.sync(this._currentMediaSec(appState.get('isSeeking')));
    },

    /** Vị trí media -> thời điểm phụ đề nên hiển thị (outputLatency đọc sống — đổi khi đổi tai nghe/loa). */
    _displayTime(mediaTimeSec) {
        const ctx = appState.get('audioContext');
        return computeSubtitleDisplayTime(mediaTimeSec, ctx && ctx.baseLatency, ctx && ctx.outputLatency); // core/subtitle/subtitle-transition.js
    },

    /** Vị trí media mà phụ đề đang theo: mốc kéo khi đang kéo, không thì vị trí phát. @param {boolean} isSeeking */
    _currentMediaSec(isSeeking) {
        return isSeeking ? this._seekPreviewSec : audioPlayer.currentTime;
    },

    /** `t` = thời điểm hiển thị ĐÃ bù độ trễ. */
    _syncAt(t) {
        const s = appState.get(['isSubtitlesEnabled', 'subtitles', 'activeSubIds', 'isSeeking']);
        SUBTITLE_SYNC_BY_ENABLED[!!s.isSubtitlesEnabled](s, t);
    },

    _syncLines(s, t) {
        const cfg = appConfigViz.getAll();
        const { entries, nextBoundarySec } = computeSubtitleLineStates(s.subtitles, t, cfg); // core/subtitle/subtitle-transition.js
        this._nextBoundarySec = nextBoundarySec;
        const diff = diffSubtitleActiveLines(s.activeSubIds, entries); // core
        const beforeTops = SUBTITLE_MEASURE_BY_LAYOUT_CHANGE[diff.layoutChanged]();
        diff.removeIds.forEach((id) => this._removeBlock(id));
        diff.addEntries.forEach((entry) => SUBTITLE_BLOCK_ADD_BY_KARAOKE[this._isKaraokeEligible(entry.sub)](entry));
        appState.set('activeSubIds', diff.nextIds, { skipCheck: true });
        this._syncDisplayVisibility(); // hiện khung TRƯỚC khi đo/ghim — dòng đầu tiên / sau quãng trống cũng có hiệu ứng
        SUBTITLE_REFLOW_BY_LAYOUT_CHANGE[diff.layoutChanged](beforeTops);
        const clock = computeSubtitleMediaClock(audioPlayer.paused, s.isSeeking, audioPlayer.playbackRate); // core
        entries.forEach((entry) => this._applyBlockPhase(entry, cfg, t, clock));
        this._resumeKaraokeLoop(); // play lại / seek lúc pause -> vòng raf chạy tiếp (tự dừng khi pause)
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

    _removeBlock(id) {
        removeSubtitleBlockUi(subActiveLines, id); // core
        this._dropKaraokeLine(id);
    },

    /** Dòng hiện karaoke khi: bật karaoke + dòng có timing đã Apply + timing còn khớp chữ. */
    _isKaraokeEligible(sub) {
        const kcfg = appState.get('karaokeRenderConfig');
        return !!kcfg && kcfg.enabled && Array.isArray(sub.karaoke) && isKaraokeMatchingText(sub.karaoke, sub.text); // core/subtitle/subtitle-karaoke.js
    },

    /** Các dòng còn lại trượt từ chỗ cũ về chỗ mới; pointer karaoke trượt theo cùng nhịp. */
    _reflowLines(beforeTops) {
        cancelSubtitleReflowUi(subActiveLines); // core/subtitle/subtitle-display-ui.js — đo đúng bố cục mới
        this._realignKaraokePointer();
        playSubtitleReflowUi(subActiveLines, beforeTops, SUBTITLE_REFLOW_MS);
    },

    _applyBlockPhase(entry, cfg, t, clock) {
        const block = findSubtitleBlockUi(subActiveLines, entry.sub.id); // core
        if (!block) return;
        if (markSubtitleBlockPhaseUi(block, entry.phase)) SUBTITLE_PHASE_ENTER_BY_PHASE[entry.phase](block, cfg); // core — chỉ khi pha vừa đổi
        SUBTITLE_PHASE_PIN_BY_PHASE[entry.phase](block, entry, cfg, t, clock);
    },

    _pinPhase(block, effectName, phase, phaseWindow, t, clock) {
        const anim = resolveSubtitlePhaseAnimation(effectName, phase); // core/subtitle/subtitle-transition.js
        if (!anim) return;
        pinSubtitlePhaseAnimationUi(block, anim.keyframes, anim.easing, computeSubtitlePhasePin(phaseWindow, t, clock.running), clock.rate); // core -ui + core
    },

    _addInEffect(block, inClass) {
        if (!inClass) return;
        addSubtitleInEffectUi(block, inClass); // core
    },

    /** Khung chiếm chỗ khi còn dòng đang hiện hoặc hạt karaoke còn bay. */
    _syncDisplayVisibility() {
        const { activeSubIds, karaokeFxDirty } = appState.get(['activeSubIds', 'karaokeFxDirty']);
        setSubtitleDisplayVisibleUi(subtitleDisplay, activeSubIds.size > 0 || karaokeFxDirty); // core
    },

    // ===================== Karaoke — dựng/dọn dòng =====================

    _addKaraokeBlock(entry) {
        const sub = fitSubtitlesKaraokeToDuration([entry.sub], new Set([entry.sub.id]))[0]; // core — dữ liệu cũ lệch thời lượng
        const tokens = tokenizeKaraokeSubtitleText(sub.text); // core
        const wordTexts = collectKaraokeWordTexts(tokens); // core
        const timeline = buildKaraokeWordTimeline(sub.karaoke, sub.start); // core
        const built = buildKaraokeSubtitleBlockUi(sub.id, sub.start, renderKaraokeLineHtml(tokens), wordTexts); // core -ui + components/visualizer-overlay.js
        const words = built.words.map((els, i) => ({
            ...els, text: wordTexts[i], startSec: timeline[i].startSec, endSec: timeline[i].endSec,
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

    /** Bố cục đổi (dòng khác thêm/bớt) -> pointer trượt lên đúng từ đang chỉ ở vị trí mới, cùng nhịp với dòng (Giang báo
     * 06/10/2026: nhiều dòng karaoke, 1 dòng mất trước -> trục Y pointer sai). Bỏ transform hiệu ứng của từ trước khi đo —
     * khung hình karaoke kế tự áp lại. */
    _realignKaraokePointer() {
        const w = this._pointerWord;
        const { karaokePointerLineId, karaokeRenderConfig } = appState.get(['karaokePointerLineId', 'karaokeRenderConfig']);
        if (!w || karaokePointerLineId === null) return; // pointer đang ẩn
        if (!w.el.isConnected) return; // từ đã bị gỡ cùng dòng
        setKaraokeWordTransformUi(w.el, ''); // core -ui
        positionKaraokePointerUi(subtitleKaraokePointer, w.el, subtitleDisplay, karaokeRenderConfig.pointerShape.anchor, SUBTITLE_POINTER_REFLOW_TRANSITION); // core -ui
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

    _resetAllKaraokeWords() {
        appState.get('karaokeLines').forEach((line) => line.words.forEach((w) => this._resetKaraokeWord(w)));
    },

    // ===================== Karaoke — vòng raf =====================

    _ensureKaraokeLoop() {
        if (taskManager.isTaskRunning(SUBTITLE_KARAOKE_TASK)) return;
        taskManager.addNew(SUBTITLE_KARAOKE_TASK, { time: 0, exe: () => this._tickKaraoke(), mode: 'raf', count: 0 }); // service/task-manager.js
        taskManager.operator(SUBTITLE_KARAOKE_TASK, 'enabled');
    },

    _tickKaraoke() {
        const nowMs = performance.now();
        // Cổng seek đang nạp lại nguồn (currentTime tạm về 0) -> bỏ qua khung hình này, không tô nhầm về đầu bài.
        if (!workflowPlayerControls.isHeldBySeekGate(audioPlayer)) this._tickKaraokeWords(nowMs); // event/workflow/player-controls.js
        this._tickKaraokeParticles(nowMs);
        this._stopKaraokeLoopIfIdle();
    },

    _tickKaraokeWords(nowMs) {
        const k = appState.get(['karaokeLastMediaTime', 'karaokeRenderConfig', 'karaokeLines', 'isSeeking']);
        const t = this._displayTime(this._currentMediaSec(k.isSeeking)); // bù độ trễ đầu ra, khớp dòng phụ đề
        const isJump = isKaraokeTimeJump(k.karaokeLastMediaTime, t); // core — seek / lặp bài / ẩn tab lâu -> đặt thẳng
        appState.set('karaokeLastMediaTime', t, { skipCheck: true });
        k.karaokeLines.forEach((line) => {
            line.words.forEach((w) => this._tickKaraokeWord(line.id, w, t, nowMs, isJump, k.karaokeRenderConfig));
        });
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
        w.revealAt = computeKaraokeRevealAt(nowMs); // core
    },

    /** Tan bằng hạt: lấy mẫu chữ (đang màu karaoke) TRƯỚC rồi mới ẩn chữ thật. */
    _vanishWithParticles(w, presetName, nowMs, kcfg) {
        this._spawnKaraokeParticles(w, presetName, kcfg.color, false, KARAOKE_VANISH_MS, nowMs);
        setKaraokeWordOpacityUi(w.el, 0, 0); // core -ui
    },

    // ===================== Karaoke — hạt bụi / sương khói =====================

    /** Bộ vẽ hạt (canvas hiệu ứng + canvas nháp lấy mẫu chữ) — tạo 1 lần. */
    _ensureKaraokeFx() {
        const existing = appState.get('karaokeFx');
        if (existing) return existing;
        const fx = createKaraokeFxHandleUi(subtitleKaraokeFx, window.devicePixelRatio, SUBTITLE_KARAOKE_DPR_MAX); // core -ui
        appState.set('karaokeFx', fx);
        return fx;
    },

    /** Sprite theo màu + độ mềm, cache theo khoá. @returns {string} khoá sprite */
    _ensureKaraokeSprite(color, spriteCore) {
        const key = computeKaraokeSpriteKey(color, spriteCore); // core
        if (appState.get('karaokeSprites').has(key)) return key;
        const sprite = buildKaraokeParticleSpriteUi(color, spriteCore); // core -ui
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
        appState.set('karaokeParticles', pruneKaraokeParticles(appState.get('karaokeParticles'), nowMs, spawned), { skipCheck: true }); // core
        appState.set('karaokeFxDirty', true, { skipCheck: true });
    },

    /** Vẽ hạt khi còn hạt; hết hạt vẽ thêm 1 lần (xoá canvas) rồi thôi. */
    _tickKaraokeParticles(nowMs) {
        const { karaokeFxDirty, karaokeParticles, karaokeSprites } = appState.get(['karaokeFxDirty', 'karaokeParticles', 'karaokeSprites']);
        if (!karaokeFxDirty) return;
        const fx = this._ensureKaraokeFx();
        const alive = pruneKaraokeParticles(karaokeParticles, nowMs); // core
        appState.set('karaokeParticles', alive, { skipCheck: true });
        syncKaraokeFxCanvasSizeUi(subtitleKaraokeFx, fx.dpr); // core -ui
        drawKaraokeParticlesUi(fx.ctx, alive, nowMs, karaokeSprites, fx.dpr); // core -ui
        appState.set('karaokeFxDirty', alive.length > 0, { skipCheck: true });
    },

    _clearKaraokeFx() {
        const { karaokeFx, karaokeSprites } = appState.get(['karaokeFx', 'karaokeSprites']);
        appState.set('karaokeFxDirty', false, { skipCheck: true });
        if (!karaokeFx) return;
        drawKaraokeParticlesUi(karaokeFx.ctx, [], 0, karaokeSprites, karaokeFx.dpr); // core -ui — xoá canvas
    },

    _resumeKaraokeLoop() {
        if (appState.get('karaokeLines').size === 0) return;
        this._ensureKaraokeLoop();
    },

    /** Dừng raf khi hết việc: hết hạt VÀ (không còn dòng karaoke HOẶC media đang pause — khung hình cuối đã vẽ đúng;
     * play/seek gọi _resumeKaraokeLoop()). */
    _stopKaraokeLoopIfIdle() {
        const { karaokeLines, karaokeFxDirty } = appState.get(['karaokeLines', 'karaokeFxDirty']);
        const hasLines = karaokeLines.size > 0;
        if (karaokeFxDirty || (hasLines && !audioPlayer.paused)) return;
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

    // ===================== Đồng hồ mốc phụ đề =====================

    /** Bật 'subtitleClock' nếu Song đang phát và còn mốc phía trước. Gọi cuối mỗi lần đồng bộ. */
    _ensureSubtitleClock() {
        if (taskManager.isTaskRunning(SUBTITLE_CLOCK_TASK)) return;
        if (isSubtitleClockIdle(audioPlayer.paused, this._nextBoundarySec)) return; // core — không có gì để canh
        this._lastClockSec = null;
        taskManager.addNew(SUBTITLE_CLOCK_TASK, { time: 0, exe: () => this._tickSubtitleClock(), mode: 'raf', count: 0 }); // service/task-manager.js
        taskManager.operator(SUBTITLE_CLOCK_TASK, 'enabled');
        this._logAudioLatencyOnce();
    },

    _tickSubtitleClock() {
        SUBTITLE_CLOCK_TICK_BY_IDLE[isSubtitleClockIdle(audioPlayer.paused, this._nextBoundarySec)](); // core
    },

    /** Mỗi khung hình: chỉ đọc vị trí + so mốc; tới mốc hoặc tua lùi mới đồng bộ. */
    _checkSubtitleClock() {
        if (workflowPlayerControls.isHeldBySeekGate(audioPlayer)) return; // cổng seek đang nạp lại nguồn, currentTime tạm về 0
        const t = this._displayTime(this._currentMediaSec(appState.get('isSeeking')));
        const last = this._lastClockSec;
        this._lastClockSec = t;
        if (!shouldSyncSubtitleClock(t, last, this._nextBoundarySec)) return; // core
        this._syncAt(t);
    },

    /** Chẩn đoán (Debug console) — độ trễ đầu ra đang bù vào phụ đề, log 1 lần mỗi AudioContext. */
    _logAudioLatencyOnce() {
        const ctx = appState.get('audioContext');
        if (!ctx || ctx === this._loggedLatencyContext) return;
        this._loggedLatencyContext = ctx;
        console.log(formatSubtitleLatencyLog(ctx.baseLatency, ctx.outputLatency)); // core/subtitle/subtitle-transition.js
    },
};
