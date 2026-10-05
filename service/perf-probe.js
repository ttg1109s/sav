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
 * HUD (góc trái trên, không nhận chạm), cập nhật ~2 lần/giây:
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
    const PROBE_TASK = 'perfProbe';
    const WINDOW_MS = 2000; // cửa sổ thống kê fps/jank
    const JANK_MS = 25; // frame dài hơn mức này = 1 lần giật
    const HUD_REFRESH_MS = 500;
    const SNAPSHOT_DELAY_MS = 1500; // đợi trượt xong + vài frame rồi mới chụp số liệu sau khi đổi màn
    const TAP_BLOCK_WINDOW_MS = 1500;
    const TAP_REPORT_DELAY_MS = 3000;
    const HUD_CSS = `
#perf-probe-hud { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 4px); left: 4px; z-index: 2147483647;
  font: 10px/1.35 ui-monospace, Menlo, monospace; color: #fff; background: rgba(0,0,0,0.65); padding: 4px 6px;
  border-radius: 6px; white-space: pre; pointer-events: none; max-width: calc(100vw - 8px); overflow: hidden; }`;

    let enabled = false;
    let styleEl = null;
    let hudEl = null;

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

    function buildReport(now) {
        const { fps, jank } = frameStats(now);
        const screen = appStack.classList.contains('playlist-hidden') ? 'VIS' : 'PL';
        const shortName = (n) => n.replace(/Task$|Tick$/, '');
        const ticks = Object.keys(tickRateByTask).map((n) => `${shortName(n)}:${tickRateByTask[n]}`).join(' ');
        const framesPerSec = Math.max(1, fps);
        const jsMs = Object.keys(tickMsRateByTask).reduce((acc, n) => acc + tickMsRateByTask[n], 0) / framesPerSec;
        const frameMs = 1000 / framesPerSec;
        let heaviest = '';
        let heaviestMs = 0;
        Object.keys(tickMsRateByTask).forEach((n) => {
            const perTick = tickMsRateByTask[n] / Math.max(1, tickRateByTask[n] || 0);
            if (perTick > heaviestMs) { heaviestMs = perTick; heaviest = n; }
        });
        return `${screen} fps ${fps} | jank ${jank}/2s | video rơi/s ${droppedPerSec}\n`
            + `tick/s ${ticks}\n`
            + `ms/frame JS ${jsMs.toFixed(1)} / frame ${frameMs.toFixed(0)} / khác ${Math.max(0, frameMs - jsMs).toFixed(0)} | nặng: ${shortName(heaviest)} ${heaviestMs.toFixed(1)}ms\n`
            + `anim css/tr/js ${countAnimations()} | PL hiện ${countRenderedRows()}`;
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
            hudEl.textContent = buildReport(now);
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
        hudEl = document.createElement('div');
        hudEl.id = 'perf-probe-hud';
        document.body.appendChild(hudEl);
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

        /** Boot: bật lại nếu lần trước đang bật. */
        restoreOnBoot() {
            if (localStorage.getItem(STORAGE_KEY) === 'true') enable();
        },
    };
})();

perfProbe.restoreOnBoot();
