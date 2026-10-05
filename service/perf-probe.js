/**
 * service/perf-probe.js — HUD đo hiệu năng trên máy (không cần DevTools). Bật/tắt + xoay ngang/dọc ở Settings >
 * Troubleshooting > "Performance HUD" (components/settings/troubleshooting.js -> router 'settingsMisc' ->
 * workflowSettingsMisc.setPerfProbeEnabled()/setPerfProbeOrientation() -> `perfProbe.setEnabled()/setOrientation()`).
 * Nhớ qua localStorage: `sav_perfProbeEnabled`, `sav_perfProbeOrientation`, `sav_perfProbePosition`.
 *
 * LỊCH SỬ: ra đời 02/10/2026 (v1–v10) để chẩn đoán bug "về Playlist rồi vào lại thì giật toàn bộ video/motion/visual".
 * v11 (05/10/2026): chỉ còn đo đạc, không can thiệp luồng app; bật/tắt ở Troubleshooting.
 * v12 (05/10/2026): dải icon hoá, ăn theme, kéo thả bằng tay cầm, xoay ngang/dọc.
 * v13 (05/10/2026, Giang góp ý "không có màu nền, chữ không tương phản, không xuống dòng, nhỏ quá" + "bỏ thông số
 * không cần thiết" + "tham khảo icon trên mạng"):
 *   - Nền: lớp nền theme (`modalCardBg`) ĐỤC 80% (opacity 0.8) — chữ `textPrimary` cùng theme nên luôn tương phản
 *     đúng với Light/Dark/Morphin.
 *   - To hơn: chữ 13px, icon 16px, padding rộng hơn; số dùng tabular-nums (không nhảy bề rộng).
 *   - Dải ngang tự XUỐNG DÒNG khi chạm mép màn hình (flex-wrap, max-width = bề rộng màn hình).
 *   - Icon: bộ Lucide (lucide.dev, giấy phép ISC — nét 2px, đầu tròn, viewBox 24), path chép theo bản gốc.
 *   - Chỉ giữ 5 chỉ số đọc được ngay giật hay không + vì đâu; BỎ tick/s từng task, task nặng nhất, số animation,
 *     số item Playlist đang render (đều là số liệu chẩn đoán riêng của đợt điều tra 02–05/10, đã xong vai trò).
 *
 * 5 chỉ số (thứ tự trong dải), cập nhật ~2 lần/giây:
 *   gauge           — FPS trung bình 2s gần nhất.
 *   triangle-alert  — số frame giật (> 25ms) trong 2s gần nhất.
 *   timer           — thời gian 1 frame trung bình (ms).
 *   code            — thời gian JS của MỌI task raf (taskManager) trong 1 frame (ms). Frame lâu mà JS nhỏ = trình duyệt
 *                     tự làm (style/layout/paint/composite); JS lớn = code app nặng.
 *   film            — số frame video bị bỏ mỗi giây (#bg-video, getVideoPlaybackQuality()).
 * Console (Debug console để copy): 1 dòng tóm tắt 1,5s sau mỗi lần đổi màn Playlist <-> Visualizer, và 1 dòng cho mỗi
 * cú chạm (3s sau chạm hoặc khi có cú chạm kế): phần tử được chạm, khoảng chặn main thread dài nhất 1,5s đầu, fps.
 *
 * Độc lập kiến trúc event-bus (dịch vụ chẩn đoán). Cần: taskManager (service/task-manager.js), appStack
 * (core/dom-refs.js), applyUiThemeToDom/_activeUiThemeKeyList (core/ui-theme/apply-ui.js). Nạp CUỐI index.html.
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
    // data-uitk. Nền là 1 lớp riêng (opacity 0.8) để chữ/icon không mờ theo.
    const HUD_CSS = `
#perf-probe-hud { position: fixed; z-index: 2147483647; width: max-content; max-width: calc(100vw - ${EDGE_GAP_PX * 2}px);
  pointer-events: none; font: 600 13px/1.25 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-variant-numeric: tabular-nums; border-radius: 14px; }
#perf-probe-hud .pp-bg { position: absolute; inset: 0; border-radius: inherit; opacity: 0.8; pointer-events: none; }
#perf-probe-hud .pp-strip { position: relative; display: flex; flex-wrap: wrap; align-items: center; column-gap: 14px;
  row-gap: 6px; padding: 8px 12px; }
#perf-probe-hud.pp-vertical .pp-strip { flex-direction: column; flex-wrap: nowrap; align-items: flex-start; row-gap: 8px; }
#perf-probe-hud .pp-item { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
#perf-probe-hud .pp-item svg { width: 16px; height: 16px; flex-shrink: 0; }
#perf-probe-hud .pp-unit { font-weight: 500; font-size: 11px; opacity: 0.7; }
#perf-probe-hud .pp-handle { pointer-events: auto; touch-action: none; cursor: grab; padding: 4px; margin: -4px 0 -4px -6px; }
#perf-probe-hud.pp-vertical .pp-handle { align-self: center; margin: -4px 0; }
#perf-probe-hud .pp-handle svg { width: 18px; height: 18px; }`;

    // Icon Lucide (https://lucide.dev, ISC) — phần tử con bên trong <svg viewBox="0 0 24 24" stroke-width="2"
    // stroke-linecap="round" stroke-linejoin="round">. `unit` hiện nhỏ sau số.
    const HUD_ITEMS = [
        { id: 'fps', unit: 'fps', icon: '<path d="M12 15l3.5-3.5"/><path d="M20.3 18c.4-1 .7-2.2.7-3.4C21 9.8 17 6 12 6s-9 3.8-9 8.6c0 1.2.3 2.4.7 3.4"/>' }, // gauge
        { id: 'jank', unit: '/2s', icon: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>' }, // triangle-alert
        { id: 'frame', unit: 'ms', icon: '<line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/>' }, // timer
        { id: 'js', unit: 'ms', icon: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>' }, // code
        { id: 'drop', unit: '/s', icon: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>' }, // film
    ];
    const GRIP_ICON = '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>'; // grip-vertical
    const svgOf = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

    let enabled = false;
    let styleEl = null;
    let hudEl = null;
    let valueEls = {}; // id chỉ số -> <span> giá trị (chỉ đổi textContent)
    let orientation = localStorage.getItem(ORIENTATION_KEY) === 'vertical' ? 'vertical' : 'horizontal';
    let dragState = null; // {pointerId, offsetX, offsetY} khi đang kéo

    // ===== Số liệu =====
    const frameLog = []; // [timestamp, delta]
    let lastFrameTs = 0;
    let lastHudTs = 0;
    let lastSecTs = 0;
    let lastScreen = false;
    let snapshotDueTs = 0;
    let snapshotLabel = '';
    let tapRecord = null; // {ts, label, maxGapMs}
    let jsMsThisSec = 0; // tổng ms JS của mọi task raf trong giây đang đếm
    let jsMsLastSec = 0;
    let lastDropped = null;
    let droppedPerSec = 0;

    // ===== Đo thời gian JS của mọi task raf =====
    // Bọc `loop.callback` (thuộc tính công khai của Loop, #runRaf() gọi `this.callback()`); task tạo sau (addNew) được
    // bọc ở lượt tick kế tiếp của probe. Khi tắt: không cộng (chỉ còn 1 phép so sánh mỗi lần gọi).
    function wrapRafCallbacks() {
        Object.keys(taskManager.plan).forEach((name) => {
            const loop = taskManager.plan[name];
            if (!loop || loop.mode !== 'raf' || loop.callback.__probeWrapped || name === PROBE_TASK) return;
            const original = loop.callback;
            const wrapped = function probeTimedCallback() {
                if (!enabled) return original.apply(this, arguments);
                const t0 = performance.now();
                try {
                    return original.apply(this, arguments);
                } finally {
                    jsMsThisSec += performance.now() - t0;
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

    function sampleDroppedFrames() {
        const video = document.getElementById('bg-video');
        if (!video || typeof video.getVideoPlaybackQuality !== 'function') { droppedPerSec = '-'; return; }
        const dropped = video.getVideoPlaybackQuality().droppedVideoFrames;
        droppedPerSec = lastDropped === null ? 0 : Math.max(0, dropped - lastDropped);
        lastDropped = dropped;
    }

    /** 1 lượt số liệu. @returns {{screen:string, fps:number, jank:number, frameMs:number, jsMs:number, drop:(number|string)}} */
    function buildMetrics(now) {
        const { fps, jank } = frameStats(now);
        const framesPerSec = Math.max(1, fps);
        return {
            screen: appStack.classList.contains('playlist-hidden') ? 'VIS' : 'PL',
            fps,
            jank,
            frameMs: 1000 / framesPerSec,
            jsMs: jsMsLastSec / framesPerSec,
            drop: droppedPerSec,
        };
    }

    /** Dòng chữ đầy đủ nhãn — CHỈ dùng ghi console (Debug console để copy). */
    function buildReport(now) {
        const m = buildMetrics(now);
        return `${m.screen} fps ${m.fps} | jank ${m.jank}/2s | frame ${m.frameMs.toFixed(0)}ms | JS ${m.jsMs.toFixed(1)}ms | video rơi ${m.drop}/s`;
    }

    /** Ghi giá trị mới vào dải (chỉ textContent). */
    function renderHud(now) {
        const m = buildMetrics(now);
        const VALUES = {
            fps: `${m.fps}`,
            jank: `${m.jank}`,
            frame: m.frameMs.toFixed(0),
            js: m.jsMs.toFixed(1),
            drop: `${m.drop}`,
        };
        Object.keys(VALUES).forEach((id) => { if (valueEls[id]) valueEls[id].textContent = VALUES[id]; });
    }

    // ===== Dựng dải HUD + kéo thả =====
    function buildHudDom() {
        hudEl = document.createElement('div');
        hudEl.id = 'perf-probe-hud';
        hudEl.setAttribute('data-uitk', 'textPrimary');
        const itemsHtml = HUD_ITEMS.map((item) => `<div class="pp-item"><span class="pp-icon" data-uitk="accentText">${svgOf(item.icon)}</span><span data-pp-value="${item.id}">-</span><span class="pp-unit">${item.unit}</span></div>`).join('');
        hudEl.innerHTML = '<div class="pp-bg" data-uitk="modalCardBg modalCardBorder"></div>'
            + `<div class="pp-strip"><div class="pp-item pp-handle" data-uitk="textSecondary">${svgOf(GRIP_ICON)}</div>${itemsHtml}</div>`;
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
            jsMsLastSec = jsMsThisSec;
            jsMsThisSec = 0;
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
            console.log(`[perf-probe] SAU ${snapshotLabel} :: ${buildReport(now)}`);
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
        jsMsThisSec = 0;
        jsMsLastSec = 0;
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
