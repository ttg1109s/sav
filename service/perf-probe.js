/**
 * service/perf-probe.js — HUD đo hiệu năng trên máy (không cần DevTools). Bật/tắt ở Settings > Troubleshooting >
 * "Performance HUD" (components/settings/troubleshooting.js -> router 'settingsMisc' ->
 * workflowSettingsMisc.setPerfProbeEnabled() -> `perfProbe.setEnabled()`). Trạng thái nhớ ở localStorage
 * (`sav_perfProbeEnabled`) — boot tự bật lại nếu lần trước đang bật.
 *
 * LỊCH SỬ: ra đời 02/10/2026 (v1–v10) để chẩn đoán bug "về Playlist rồi vào lại thì giật toàn bộ video/motion/visual".
 * v11 (05/10/2026, Giang yêu cầu "thêm 1 nút ở Troubleshooting để bật/tắt"): bỏ hẳn các nút thí nghiệm A/B (đã xong
 * vai trò) và mọi chỗ bọc hàm app — CHỈ còn đo đạc, không can thiệp luồng nào. Tắt = gỡ HUD + dừng task đo; phần bọc
 * callback task raf (đếm tick/s, ms/frame) vẫn nằm đó nhưng không ghi gì khi tắt.
 *
 * v12 (05/10/2026, Giang yêu cầu): HUD thành 1 DẢI icon hoá `⠿  ⚡ fps  ⚠ jank  🎞 rơi  ⟳ tick  ⏱ ms  ▣ nặng  ✦ anim
 * ☰ PL` (KHÔNG vạch phân cách — các mục cách nhau bằng khoảng trống), bọc 1 box vừa nội dung (fit-content) có padding, ĂN THEO THEME (data-uitk + applyUiThemeToDom(),
 * core/ui-theme/apply-ui.js) — lớp NỀN trong suốt ~80% (chữ/icon giữ rõ). Xoay ngang/dọc chọn ở Settings >
 * Troubleshooting > Performance HUD (`setOrientation()`). Nắm tay cầm ⠿ kéo đi khắp màn hình (vị trí nhớ lại). Mọi giá
 * trị chỉ đổi textContent (không dựng lại DOM mỗi lượt).
 *
 * Các chỉ số (thứ tự trong dải), cập nhật ~2 lần/giây:
 *   fps / jank      — fps 2s gần nhất / số frame > 25ms trong 2s đó / số frame video bị bỏ mỗi giây (#bg-video).
 *   tick/s          — số lần MỖI task raf của taskManager thật sự chạy callback mỗi giây (bình thường = fps).
 *   ms/frame        — JS của mọi task raf mỗi frame / khoảng cách frame / phần còn lại (trình duyệt tự làm + task
 *                     khác) + task nặng nhất (ms/tick).
 *   anim css/tr/js  — số animation đang chạy (CSS animation / CSS transition / Web Animation).
 *   PL hiện         — số item Playlist trình duyệt đang render / tổng (content-visibility).
 * Console (Debug console để copy): 1 dòng tóm tắt 1,5s sau mỗi lần đổi màn Playlist <-> Visualizer, và 1 dòng cho mỗi
 * cú chạm (3s sau chạm hoặc khi có cú chạm kế): phần tử được chạm, khoảng chặn main thread dài nhất 1,5s đầu, fps.
 *
 * Độc lập kiến trúc event-bus (dịch vụ chẩn đoán). Cần: taskManager (service/task-manager.js), appState, appStack
 * (core/dom-refs.js). Nạp CUỐI index.html.
 */
const perfProbe = (function createPerfProbe() {
    const STORAGE_KEY = 'sav_perfProbeEnabled';
    const ORIENTATION_KEY = 'sav_perfProbeOrientation'; // 'horizontal' | 'vertical'
    const POSITION_KEY = 'sav_perfProbePosition'; // JSON {left, top} (px)
    const EDGE_GAP_PX = 4;
    const PROBE_TASK = 'perfProbe';
    const WINDOW_MS = 2000; // cửa sổ thống kê fps/jank
    const JANK_MS = 25; // frame dài hơn mức này = 1 lần giật
    const HUD_REFRESH_MS = 500;
    const SNAPSHOT_DELAY_MS = 1500; // đợi trượt xong + vài frame rồi mới chụp số liệu sau khi đổi màn
    const TAP_BLOCK_WINDOW_MS = 1500;
    const TAP_REPORT_DELAY_MS = 3000;
    // Cấu trúc/khoảng cách viết CSS thuần (tailwind.css là bản dựng sẵn, class mới không có); MÀU lấy từ theme qua
    // data-uitk. Nền là 1 lớp riêng (opacity 0.2 = trong suốt 80%) để chữ/icon không mờ theo.
    const HUD_CSS = `
#perf-probe-hud { position: fixed; z-index: 2147483647; width: max-content; pointer-events: none;
  font: 600 10px/1.2 ui-monospace, Menlo, monospace; border-radius: 10px; }
#perf-probe-hud .pp-bg { position: absolute; inset: 0; border-radius: inherit; opacity: 0.2; pointer-events: none; }
#perf-probe-hud .pp-strip { position: relative; display: flex; align-items: center; gap: 8px; padding: 4px 8px; }
#perf-probe-hud.pp-vertical .pp-strip { flex-direction: column; align-items: flex-start; gap: 4px; padding: 6px 8px; }
#perf-probe-hud .pp-item { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
#perf-probe-hud .pp-item svg { width: 12px; height: 12px; flex-shrink: 0; }
#perf-probe-hud .pp-handle { pointer-events: auto; touch-action: none; cursor: grab; justify-content: center; padding: 2px; }
#perf-probe-hud.pp-vertical .pp-handle { align-self: center; }
#perf-probe-hud .pp-handle svg { width: 14px; height: 14px; }`;

    let enabled = false;
    let styleEl = null;
    let hudEl = null;
    let valueEls = {}; // id chỉ số -> <span> giá trị (chỉ đổi textContent)
    let orientation = localStorage.getItem(ORIENTATION_KEY) === 'vertical' ? 'vertical' : 'horizontal';
    let dragState = null; // {pointerId, offsetX, offsetY} khi đang kéo

    // Icon (path Heroicons outline, stroke = màu chữ theme) — mỗi chỉ số 1 icon, thứ tự = thứ tự trong dải.
    const HUD_ITEMS = [
        { id: 'fps', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
        { id: 'jank', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
        { id: 'drop', icon: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z' },
        { id: 'tick', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
        { id: 'ms', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
        { id: 'heavy', icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z' },
        { id: 'anim', icon: 'M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z' },
        { id: 'pl', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
    ];
    const GRIP_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>';

    // ===== Số liệu =====
    const frameLog = []; // [timestamp, delta]
    let lastFrameTs = 0;
    let lastHudTs = 0;
    let lastSecTs = 0;
    let lastScreen = false;
    let snapshotDueTs = 0;
    let snapshotLabel = '';
    let tapRecord = null; // {ts, label, maxGapMs}
    const tickCountByTask = {};
    const tickMsByTask = {};
    let tickRateByTask = {};
    let tickMsRateByTask = {};
    let lastDropped = null;
    let droppedPerSec = 0;

    // ===== Đếm callback THẬT SỰ chạy của từng task raf =====
    // Bọc `loop.callback` (thuộc tính công khai của Loop, #runRaf() gọi `this.callback()`); task tạo sau (addNew) được
    // bọc ở lượt tick kế tiếp của probe. Khi tắt: không đếm (chỉ còn 1 phép so sánh mỗi lần gọi).
    function wrapRafCallbacks() {
        Object.keys(taskManager.plan).forEach((name) => {
            const loop = taskManager.plan[name];
            if (!loop || loop.mode !== 'raf' || loop.callback.__probeWrapped || name === PROBE_TASK) return;
            const original = loop.callback;
            const wrapped = function probeCountedCallback() {
                if (!enabled) return original.apply(this, arguments);
                tickCountByTask[name] = (tickCountByTask[name] || 0) + 1;
                const t0 = performance.now();
                try {
                    return original.apply(this, arguments);
                } finally {
                    tickMsByTask[name] = (tickMsByTask[name] || 0) + (performance.now() - t0);
                }
            };
            wrapped.__probeWrapped = true;
            loop.callback = wrapped;
        });
    }

    function frameStats(now) {
        while (frameLog.length && now - frameLog[0][0] > WINDOW_MS) frameLog.shift();
        const n = frameLog.length;
        const jank = frameLog.reduce((acc, f) => acc + (f[1] > JANK_MS ? 1 : 0), 0);
        const fps = n > 1 ? Math.round((n - 1) * 1000 / (frameLog[n - 1][0] - frameLog[0][0])) : 0;
        return { fps, jank };
    }

    function countRenderedRows() {
        const container = document.getElementById('playlist-container');
        if (!container) return '0/0';
        let rendered = 0;
        let total = 0;
        for (let i = 0; i < container.children.length; i++) {
            const row = container.children[i];
            if (row.classList.contains('hidden')) continue;
            total++;
            const child = row.firstElementChild;
            if (child && typeof child.checkVisibility === 'function' && child.checkVisibility({ contentVisibilityAuto: true })) rendered++;
        }
        return `${rendered}/${total}`;
    }

    function countAnimations() {
        if (typeof document.getAnimations !== 'function') return 'n/a';
        const running = document.getAnimations().filter((a) => a.playState === 'running');
        const css = running.filter((a) => typeof CSSAnimation !== 'undefined' && a instanceof CSSAnimation).length;
        const tr = running.filter((a) => typeof CSSTransition !== 'undefined' && a instanceof CSSTransition).length;
        return `${css}/${tr}/${running.length - css - tr}`;
    }

    function sampleDroppedFrames() {
        const video = document.getElementById('bg-video');
        if (!video || typeof video.getVideoPlaybackQuality !== 'function') { droppedPerSec = 'n/a'; return; }
        const dropped = video.getVideoPlaybackQuality().droppedVideoFrames;
        droppedPerSec = lastDropped === null ? 0 : Math.max(0, dropped - lastDropped);
        lastDropped = dropped;
    }

    /** Tính 1 lượt số liệu. @returns {object} */
    function buildMetrics(now) {
        const { fps, jank } = frameStats(now);
        const shortName = (n) => n.replace(/Task$|Tick$/, '');
        const taskNames = Object.keys(tickRateByTask).sort();
        const framesPerSec = Math.max(1, fps);
        const jsMs = Object.keys(tickMsRateByTask).reduce((acc, n) => acc + tickMsRateByTask[n], 0) / framesPerSec;
        const frameMs = 1000 / framesPerSec;
        let heaviest = '';
        let heaviestMs = 0;
        Object.keys(tickMsRateByTask).forEach((n) => {
            const perTick = tickMsRateByTask[n] / Math.max(1, tickRateByTask[n] || 0);
            if (perTick > heaviestMs) { heaviestMs = perTick; heaviest = n; }
        });
        return {
            screen: appStack.classList.contains('playlist-hidden') ? 'VIS' : 'PL',
            fps, jank, drop: droppedPerSec,
            tickValues: taskNames.map((n) => tickRateByTask[n]).join('·'),
            tickNamed: taskNames.map((n) => `${shortName(n)}:${tickRateByTask[n]}`).join(' '),
            jsMs, frameMs, otherMs: Math.max(0, frameMs - jsMs),
            heaviest: shortName(heaviest), heaviestMs,
            anim: countAnimations(), pl: countRenderedRows(),
        };
    }

    /** Dòng chữ đầy đủ nhãn — CHỈ dùng ghi console (Debug console để copy). */
    function buildReport(now) {
        const m = buildMetrics(now);
        return `${m.screen} fps ${m.fps} | jank ${m.jank}/2s | video rơi/s ${m.drop} | tick/s ${m.tickNamed}`
            + ` | ms/frame JS ${m.jsMs.toFixed(1)} / frame ${m.frameMs.toFixed(0)} / khác ${m.otherMs.toFixed(0)}`
            + ` | nặng: ${m.heaviest} ${m.heaviestMs.toFixed(1)}ms | anim css/tr/js ${m.anim} | PL hiện ${m.pl}`;
    }

    /** Ghi giá trị mới vào dải (chỉ textContent). */
    function renderHud(now) {
        const m = buildMetrics(now);
        const VALUES = {
            fps: `${m.fps}`,
            jank: `${m.jank}`,
            drop: `${m.drop}`,
            tick: m.tickValues || '-',
            ms: `${m.jsMs.toFixed(1)}/${m.frameMs.toFixed(0)}/${m.otherMs.toFixed(0)}`,
            heavy: `${m.heaviest.slice(0, 10)} ${m.heaviestMs.toFixed(1)}`,
            anim: m.anim,
            pl: m.pl,
        };
        Object.keys(VALUES).forEach((id) => { if (valueEls[id]) valueEls[id].textContent = VALUES[id]; });
    }

    // ===== Dựng dải HUD + kéo thả =====
    function buildHudDom() {
        hudEl = document.createElement('div');
        hudEl.id = 'perf-probe-hud';
        hudEl.setAttribute('data-uitk', 'textPrimary');
        const itemsHtml = HUD_ITEMS.map((item) => `<div class="pp-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-uitk="accentText"><path d="${item.icon}"/></svg><span data-pp-value="${item.id}">-</span></div>`).join('');
        hudEl.innerHTML = '<div class="pp-bg" data-uitk="modalCardBg modalCardBorder"></div>'
            + `<div class="pp-strip"><div class="pp-item pp-handle">${GRIP_SVG}</div>${itemsHtml}</div>`;
        valueEls = {};
        hudEl.querySelectorAll('[data-pp-value]').forEach((el) => { valueEls[el.dataset.ppValue] = el; });
        applyOrientationClass();
        document.body.appendChild(hudEl);
        if (typeof applyUiThemeToDom === 'function' && typeof _activeUiThemeKeyList !== 'undefined') applyUiThemeToDom(hudEl, _activeUiThemeKeyList); // core/ui-theme/apply-ui.js — đổi theme sau đó: lượt quét toàn `document` tự cập nhật
        restorePosition();
        const handle = hudEl.querySelector('.pp-handle');
        handle.addEventListener('pointerdown', onHandleDown);
        handle.addEventListener('pointermove', onHandleMove);
        handle.addEventListener('pointerup', onHandleUp);
        handle.addEventListener('pointercancel', onHandleUp);
    }

    function applyOrientationClass() {
        if (hudEl) hudEl.classList.toggle('pp-vertical', orientation === 'vertical');
    }

    /** Đặt HUD tại (left, top), kẹp trong màn hình. */
    function placeHud(left, top) {
        const maxLeft = Math.max(EDGE_GAP_PX, window.innerWidth - hudEl.offsetWidth - EDGE_GAP_PX);
        const maxTop = Math.max(EDGE_GAP_PX, window.innerHeight - hudEl.offsetHeight - EDGE_GAP_PX);
        hudEl.style.left = `${Math.min(maxLeft, Math.max(EDGE_GAP_PX, left))}px`;
        hudEl.style.top = `${Math.min(maxTop, Math.max(EDGE_GAP_PX, top))}px`;
    }

    function restorePosition() {
        let pos = null;
        try { pos = JSON.parse(localStorage.getItem(POSITION_KEY)); } catch (err) { pos = null; }
        if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') { placeHud(pos.left, pos.top); return; }
        placeHud(EDGE_GAP_PX, 48); // mặc định: góc trái trên, dưới vùng tai thỏ/status bar
    }

    function onHandleDown(e) {
        e.preventDefault();
        e.stopPropagation();
        const rect = hudEl.getBoundingClientRect();
        dragState = { pointerId: e.pointerId, offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
        e.currentTarget.setPointerCapture(e.pointerId);
    }

    function onHandleMove(e) {
        if (!dragState || e.pointerId !== dragState.pointerId) return; // guard — không đang kéo
        e.preventDefault();
        placeHud(e.clientX - dragState.offsetX, e.clientY - dragState.offsetY);
    }

    function onHandleUp(e) {
        if (!dragState || e.pointerId !== dragState.pointerId) return; // guard
        dragState = null;
        localStorage.setItem(POSITION_KEY, JSON.stringify({ left: parseFloat(hudEl.style.left), top: parseFloat(hudEl.style.top) }));
    }

    // ===== Nhật ký chạm =====
    function describeTapTarget(el) {
        if (!el || !el.closest) return '?';
        const withId = el.closest('[id]');
        const text = (el.textContent || '').trim().slice(0, 16);
        return `${withId ? '#' + withId.id : el.tagName.toLowerCase()}${text ? ' "' + text + '"' : ''}`;
    }

    function flushTapRecord(now) {
        const { fps } = frameStats(now);
        console.log(`[perf-probe] chạm ${tapRecord.label} | chặn max ${tapRecord.maxGapMs.toFixed(0)}ms | fps sau ${((now - tapRecord.ts) / 1000).toFixed(1)}s ${fps} | màn ${appStack.classList.contains('playlist-hidden') ? 'VIS' : 'PL'}`);
        tapRecord = null;
    }

    // Pha capture trên document, passive — chỉ ghi nhận, không can thiệp.
    function onPointerDown(e) {
        if (hudEl && hudEl.contains(e.target)) return; // guard — kéo HUD, không phải thao tác app
        if (tapRecord) flushTapRecord(performance.now()); // chạm dồn dập -> chốt bản trước
        tapRecord = { ts: performance.now(), label: describeTapTarget(e.target), maxGapMs: 0 };
    }

    // ===== Vòng đo (task raf của chính probe) =====
    function tick() {
        const now = performance.now();
        if (lastFrameTs) frameLog.push([now, now - lastFrameTs]);
        if (tapRecord && lastFrameTs && now - tapRecord.ts <= TAP_BLOCK_WINDOW_MS) {
            tapRecord.maxGapMs = Math.max(tapRecord.maxGapMs, now - lastFrameTs);
        }
        if (tapRecord && now - tapRecord.ts >= TAP_REPORT_DELAY_MS) flushTapRecord(now);
        lastFrameTs = now;
        wrapRafCallbacks();

        if (now - lastSecTs >= 1000) {
            tickRateByTask = Object.assign({}, tickCountByTask);
            tickMsRateByTask = Object.assign({}, tickMsByTask);
            Object.keys(tickCountByTask).forEach((n) => { tickCountByTask[n] = 0; });
            Object.keys(tickMsByTask).forEach((n) => { tickMsByTask[n] = 0; });
            Object.keys(tickRateByTask).forEach((n) => {
                if (!taskManager.plan[n]) { delete tickRateByTask[n]; delete tickMsRateByTask[n]; }
            });
            sampleDroppedFrames();
            lastSecTs = now;
        }

        const screenNow = appStack.classList.contains('playlist-hidden');
        if (screenNow !== lastScreen) {
            lastScreen = screenNow;
            snapshotLabel = `đổi màn -> ${screenNow ? 'Visualizer' : 'Playlist'}`;
            snapshotDueTs = now + SNAPSHOT_DELAY_MS;
        }

        if (now - lastHudTs >= HUD_REFRESH_MS) {
            lastHudTs = now;
            renderHud(now);
        }

        if (snapshotDueTs && now >= snapshotDueTs) {
            snapshotDueTs = 0;
            console.log(`[perf-probe] SAU ${snapshotLabel} :: ${buildReport(now).replace(/\n/g, ' | ')}`);
        }
    }

    // ===== Bật / tắt =====
    function enable() {
        if (enabled) return; // guard
        enabled = true;
        styleEl = document.createElement('style');
        styleEl.textContent = HUD_CSS;
        document.head.appendChild(styleEl);
        buildHudDom();
        frameLog.length = 0;
        lastFrameTs = 0;
        lastSecTs = performance.now();
        lastScreen = appStack.classList.contains('playlist-hidden');
        lastDropped = null;
        document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
        taskManager.addNew(PROBE_TASK, { time: 0, exe: tick, mode: 'raf', count: 0 }); // service/task-manager.js
        taskManager.operator(PROBE_TASK, 'enabled');
    }

    function disable() {
        if (!enabled) return; // guard
        enabled = false;
        taskManager.kill(PROBE_TASK);
        document.removeEventListener('pointerdown', onPointerDown, { capture: true });
        if (hudEl) hudEl.remove();
        if (styleEl) styleEl.remove();
        hudEl = null;
        styleEl = null;
        valueEls = {};
        dragState = null;
        tapRecord = null;
        snapshotDueTs = 0;
    }

    return {
        /** @returns {boolean} */
        isEnabled() {
            return enabled;
        },

        /** Bật/tắt HUD và nhớ lựa chọn cho lần boot sau. @param {boolean} on */
        setEnabled(on) {
            localStorage.setItem(STORAGE_KEY, on ? 'true' : 'false');
            if (on) enable(); else disable();
        },

        /** @returns {'horizontal'|'vertical'} */
        getOrientation() {
            return orientation;
        },

        /** Xoay dải HUD ngang/dọc + nhớ cho lần sau; đang hiện thì áp ngay rồi kẹp lại trong màn hình.
         * @param {'horizontal'|'vertical'} next */
        setOrientation(next) {
            orientation = next === 'vertical' ? 'vertical' : 'horizontal';
            localStorage.setItem(ORIENTATION_KEY, orientation);
            if (!hudEl) return; // guard — HUD đang tắt
            applyOrientationClass();
            placeHud(parseFloat(hudEl.style.left) || EDGE_GAP_PX, parseFloat(hudEl.style.top) || EDGE_GAP_PX);
        },

        /** Boot: bật lại nếu lần trước đang bật. */
        restoreOnBoot() {
            if (localStorage.getItem(STORAGE_KEY) === 'true') enable();
        },
    };
})();

perfProbe.restoreOnBoot();
