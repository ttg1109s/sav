/**
 * service/perf-probe.js — TẠM (02/10/2026, v5), CHỈ ĐỂ CHẨN ĐOÁN bug "về Playlist rồi chọn media -> giật toàn bộ
 * (video/motion/visual) kéo dài qua Next/Prev; pause rồi play lại thì mượt". KHÔNG thuộc kiến trúc event-bus — 1 HUD đo
 * đạc độc lập, xoá hẳn file + thẻ <script> cuối index.html sau khi chẩn đoán xong.
 *
 * v3 — manh mối mới: pause -> play chữa được. Pause/play của media đụng tới (đã rà code): React Beat (task raf
 * 'motionEngineBeatReactTick' pause -> resume), Point Move (Web Animation pause/resume), đồng hồ Auto switch, dựng lại
 * dòng Playlist đang phát (refreshSongNode), đĩa xoay ở player bottom, và chính pipeline của <video>. HUD + nút dưới đây
 * chia đôi từng phần để biết phần nào "chữa" được.
 *
 * v4 — số liệu v3 cho thấy: tick/s mọi task = fps (KHÔNG có chuỗi rAF nhân đôi), PL hiện 0/669 ở Visualizer, video gần như
 * không rơi frame. Cần tách tiếp: 1 frame ~130ms bị tiêu vào JS (callback raf) hay vào phần trình duyệt tự làm
 * (style/layout/paint/composite, task khác). Thêm dòng "ms/frame" + "RB đổi/s" (xem dưới).
 *
 * HUD (~2 lần/giây):
 *   fps / jank      — fps 2s gần nhất / số frame > 25ms trong 2s đó.
 *   tick/s          — số lần MỖI task raf của taskManager thực sự chạy callback trong 1 giây. Bình thường = fps.
 *                     Task nào ~2x, 3x fps => có 2, 3 chuỗi requestAnimationFrame chạy song song trong CÙNG 1 Loop
 *                     (chuỗi thừa chỉ chết khi Loop bị pause từ bên ngoài — khớp hiện tượng "pause/play là mượt").
 *   anim css/tr/js  — số animation đang chạy: CSS animation / CSS transition / Web Animation thuần (Point Move dùng loại này).
 *   ms/frame        — (v4) trung bình mỗi frame: tổng thời gian chạy callback raf (JS) / khoảng cách frame / phần còn lại
 *                     (= trình duyệt tự làm + task khác). Task nặng nhất kèm số ms/tick.
 *   RB đổi/s        — (v4) số lần transform của #visual-motion-react (React Beat) THẬT SỰ đổi giá trị mỗi giây.
 *   video rơi/s     — số frame video bị bỏ mỗi giây (getVideoPlaybackQuality của #bg-video).
 *   PL hiện         — số item Playlist đang được render / tổng (content-visibility).
 *
 * Nút (bấm khi ĐANG giật ở Visualizer, mỗi nút 1 lần, xem có hết giật không):
 *   [Raf P/R]  — pause rồi resume MỌI task raf (giết chuỗi rAF thừa nếu có, KHÔNG đụng media/motion state).
 *   [Motion P/R] — pause rồi resume Motion Stage (React Beat + Point Move) của bên đang mượn.
 *   [Dòng PL]  — dựng lại dòng Playlist đang phát (refreshSongNode), y như pause/play làm.
 *   [Dựng lại PL] — renderPlaylistFull().
 *   [Ẩn PL]    — (bật/tắt) ẩn hẳn #app-stack lúc ở Visualizer (visibility:hidden sau 0.5s trượt).
 *   [Chạm]     — (v5) KHÔNG làm gì, không ghi log. Giang báo bấm nút nào của v3 cũng hết giật, dù 5 nút làm 5 việc
 *                khác nhau (có nút chỉ đổi 1 class) -> nghi chính cú CHẠM là thứ chữa. Nút này mượt lại => xác nhận.
 *   [Chạm chặn] — (v5) cũng không làm gì, nhưng preventDefault() ngay touchstart (trình duyệt KHÔNG xử lý cú chạm
 *                theo kiểu native: không click, không tương tác cuộn). [Chạm] chữa mà [Chạm chặn] không => thứ chữa là
 *                xử lý chạm native của iOS (trạng thái tương tác/cuộn của WebKit), không phải code JS của app.
 * Mỗi lần đổi màn Playlist <-> Visualizer và mỗi lần bấm nút: ghi 1 dòng tóm tắt ra console (Debug console để copy).
 */
(function setupPerfProbe() {
    const PROBE_TASK = 'perfProbe';
    const WINDOW_MS = 2000;
    const JANK_MS = 25;
    const HUD_REFRESH_MS = 500;
    const SNAPSHOT_DELAY_MS = 1500;

    // ===== CSS =====
    const style = document.createElement('style');
    style.textContent = `
@media (max-width: 1023px) {
  html.probe-hide-pl #app-stack { transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), visibility 0s linear 0s; }
  html.probe-hide-pl #app-stack.playlist-hidden { visibility: hidden; transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1), visibility 0s linear 0.5s; }
}
#perf-probe-hud { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 4px); left: 4px; z-index: 2147483647;
  font: 10px/1.35 ui-monospace, Menlo, monospace; color: #fff; background: rgba(0,0,0,0.65); padding: 4px 6px;
  border-radius: 6px; white-space: pre; pointer-events: none; max-width: calc(100vw - 8px); overflow: hidden; }
#perf-probe-btns { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 140px); left: 4px; right: 4px; z-index: 2147483647;
  display: flex; flex-wrap: wrap; gap: 4px; pointer-events: none; }
#perf-probe-btns button { pointer-events: auto; font: 10px ui-monospace, Menlo, monospace; color: #fff; background: rgba(0,0,0,0.65);
  border: 1px solid rgba(255,255,255,0.4); border-radius: 6px; padding: 4px 6px; }
#perf-probe-btns button[aria-pressed="true"] { background: #16a34a; }
`;
    document.head.appendChild(style);

    const hud = document.createElement('div');
    hud.id = 'perf-probe-hud';
    const btnWrap = document.createElement('div');
    btnWrap.id = 'perf-probe-btns';
    btnWrap.innerHTML = '<button type="button" data-probe-action="rafPauseResume">Raf P/R</button>'
        + '<button type="button" data-probe-action="motionPauseResume">Motion P/R</button>'
        + '<button type="button" data-probe-action="refreshRow">Dòng PL</button>'
        + '<button type="button" data-probe-action="rebuild">Dựng lại PL</button>'
        + '<button type="button" data-probe="probe-hide-pl" aria-pressed="false">Ẩn PL</button>'
        + '<button type="button" data-probe-noop="plain">Chạm</button>'
        + '<button type="button" data-probe-noop="blocked">Chạm chặn</button>';
    document.body.appendChild(hud);
    document.body.appendChild(btnWrap);

    ['pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach((type) => {
        btnWrap.addEventListener(type, (e) => e.stopPropagation(), { passive: true });
    });
    // (v5) [Chạm chặn] — chặn xử lý chạm native ngay từ touchstart (listener KHÔNG passive mới gọi được preventDefault).
    const blockedTouchBtn = btnWrap.querySelector('button[data-probe-noop="blocked"]');
    blockedTouchBtn.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    blockedTouchBtn.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); }, { passive: false });

    // ===== Đếm số lần callback THẬT SỰ chạy của từng task raf =====
    // Bọc `loop.callback` (thuộc tính công khai của Loop, #runRaf() gọi `this.callback()`) — task mới tạo sau (addNew)
    // được bọc ở lượt tick kế tiếp của probe.
    const tickCountByTask = {};
    let tickRateByTask = {};
    const tickMsByTask = {}; // (v4) tổng ms callback trong giây hiện tại
    let tickMsRateByTask = {}; // (v4) tổng ms/giây của giây trước
    function wrapRafCallbacks() {
        Object.keys(taskManager.plan).forEach((name) => {
            const loop = taskManager.plan[name];
            if (!loop || loop.mode !== 'raf' || loop.callback.__probeWrapped || name === PROBE_TASK) return;
            const original = loop.callback;
            const wrapped = function probeCountedCallback() {
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

    // ===== Thí nghiệm =====
    const PROBE_ACTIONS = {
        rafPauseResume: () => {
            const names = Object.keys(taskManager.plan).filter((n) => n !== PROBE_TASK && taskManager.plan[n].mode === 'raf' && taskManager.isTaskRunning(n));
            names.forEach((n) => taskManager.pause(n));
            names.forEach((n) => taskManager.resume(n));
            return `Raf P/R: ${names.join(',')}`;
        },
        motionPauseResume: () => {
            const lease = workflowMotionStage._lease; // event/workflow/motion-stage.js
            if (!lease) return 'Motion P/R: không ai đang mượn Stage';
            workflowMotionStage.pause(lease.token);
            workflowMotionStage.resume(lease.token);
            return `Motion P/R: token ${lease.token}`;
        },
        refreshRow: () => {
            const key = appState.get('currentKey');
            if (!key) return 'Dòng PL: chưa phát gì';
            workflowPlaylistRender.refreshSongNode(key); // event/workflow/playlist-render.js
            return `Dòng PL: ${key}`;
        },
        rebuild: () => {
            const t0 = performance.now();
            workflowPlaylistRender.renderPlaylistFull(); // event/workflow/playlist-render.js
            return `Dựng lại PL (${(performance.now() - t0).toFixed(0)}ms)`;
        },
    };

    btnWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        const actionBtn = e.target.closest('button[data-probe-action]');
        if (actionBtn) {
            const before = buildReport(performance.now()).replace(/\n/g, ' | ');
            const what = PROBE_ACTIONS[actionBtn.dataset.probeAction]();
            console.log(`[perf-probe] TRƯỚC ${what} :: ${before}`);
            pendingAfterLabel = what;
            snapshotDueTs = performance.now() + 2500; // đủ 1 cửa sổ 2s sau thí nghiệm
            return;
        }
        const btn = e.target.closest('button[data-probe]');
        if (!btn) return;
        const isOn = document.documentElement.classList.toggle(btn.dataset.probe);
        btn.setAttribute('aria-pressed', String(isOn));
        console.log(`[perf-probe] ${btn.dataset.probe} = ${isOn}`);
    });

    // ===== Thu số liệu =====
    const container = document.getElementById('playlist-container');

    function countRenderedRows() {
        if (!container) return '0/0';
        const rows = container.children;
        let rendered = 0;
        let total = 0;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
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

    // (v4) React Beat có thật sự đổi transform không (so giá trị inline mỗi frame của probe).
    const reactLayer = document.getElementById('visual-motion-react');
    let lastReactTransform = '';
    let reactChangeCount = 0;
    let reactChangePerSec = 0;
    function sampleReactTransform() {
        if (!reactLayer) return;
        const value = reactLayer.style.transform;
        if (value !== lastReactTransform) reactChangeCount++;
        lastReactTransform = value;
    }

    let lastDropped = null;
    let droppedPerSec = 0;
    function sampleDroppedFrames() {
        const video = document.getElementById('bg-video');
        if (!video || typeof video.getVideoPlaybackQuality !== 'function') { droppedPerSec = 'n/a'; return; }
        const dropped = video.getVideoPlaybackQuality().droppedVideoFrames;
        droppedPerSec = lastDropped === null ? 0 : Math.max(0, dropped - lastDropped);
        lastDropped = dropped;
    }

    // ===== Vòng đo =====
    const frameLog = [];
    let lastFrameTs = 0;
    let lastHudTs = 0;
    let lastSecTs = performance.now();
    let lastScreen = appStack.classList.contains('playlist-hidden');
    let snapshotDueTs = 0;
    let pendingAfterLabel = '';

    function frameStats(now) {
        while (frameLog.length && now - frameLog[0][0] > WINDOW_MS) frameLog.shift();
        const n = frameLog.length;
        const jank = frameLog.reduce((acc, f) => acc + (f[1] > JANK_MS ? 1 : 0), 0);
        const fps = n > 1 ? Math.round((n - 1) * 1000 / (frameLog[n - 1][0] - frameLog[0][0])) : 0;
        return { fps, jank };
    }

    function buildReport(now) {
        const { fps, jank } = frameStats(now);
        const screen = appStack.classList.contains('playlist-hidden') ? 'VIS' : 'PL';
        const ticks = Object.keys(tickRateByTask).map((n) => `${n.replace(/Task$|Tick$/, '')}:${tickRateByTask[n]}`).join(' ');
        // (v4) ms/frame: JS raf (tổng mọi task) / khoảng cách frame / còn lại
        const jsMsPerSec = Object.keys(tickMsRateByTask).reduce((acc, n) => acc + tickMsRateByTask[n], 0);
        const framesPerSec = Math.max(1, fps);
        const jsMs = jsMsPerSec / framesPerSec;
        const frameMs = 1000 / framesPerSec;
        let heaviest = '';
        let heaviestMs = 0;
        Object.keys(tickMsRateByTask).forEach((n) => {
            const perTick = tickMsRateByTask[n] / Math.max(1, tickRateByTask[n] || 0);
            if (perTick > heaviestMs) { heaviestMs = perTick; heaviest = n; }
        });
        return `${screen} fps ${fps} | jank ${jank}/2s | video rơi/s ${droppedPerSec}\n`
            + `tick/s ${ticks}\n`
            + `ms/frame JS ${jsMs.toFixed(1)} / frame ${frameMs.toFixed(0)} / khác ${Math.max(0, frameMs - jsMs).toFixed(0)} | nặng: ${heaviest.replace(/Task$|Tick$/, '')} ${heaviestMs.toFixed(1)}ms\n`
            + `anim css/tr/js ${countAnimations()} | RB đổi/s ${reactChangePerSec} | PL hiện ${countRenderedRows()}`;
    }

    function tick() {
        const now = performance.now();
        if (lastFrameTs) frameLog.push([now, now - lastFrameTs]);
        lastFrameTs = now;
        wrapRafCallbacks();
        sampleReactTransform();

        if (now - lastSecTs >= 1000) {
            tickRateByTask = Object.assign({}, tickCountByTask);
            Object.keys(tickCountByTask).forEach((n) => { tickCountByTask[n] = 0; });
            tickMsRateByTask = Object.assign({}, tickMsByTask);
            Object.keys(tickMsByTask).forEach((n) => { tickMsByTask[n] = 0; });
            Object.keys(tickMsRateByTask).forEach((n) => { if (!taskManager.plan[n]) delete tickMsRateByTask[n]; });
            reactChangePerSec = reactChangeCount;
            reactChangeCount = 0;
            Object.keys(tickRateByTask).forEach((n) => { if (!taskManager.plan[n]) delete tickRateByTask[n]; });
            sampleDroppedFrames();
            lastSecTs = now;
        }

        const screenNow = appStack.classList.contains('playlist-hidden');
        if (screenNow !== lastScreen) {
            lastScreen = screenNow;
            pendingAfterLabel = `đổi màn -> ${screenNow ? 'Visualizer' : 'Playlist'}`;
            snapshotDueTs = now + SNAPSHOT_DELAY_MS;
        }

        if (now - lastHudTs >= HUD_REFRESH_MS) {
            lastHudTs = now;
            hud.textContent = buildReport(now);
        }

        if (snapshotDueTs && now >= snapshotDueTs) {
            snapshotDueTs = 0;
            console.log(`[perf-probe] SAU ${pendingAfterLabel} :: ${buildReport(now).replace(/\n/g, ' | ')}`);
        }
    }

    taskManager.addNew(PROBE_TASK, { time: 0, exe: tick, mode: 'raf', count: 0 }); // service/task-manager.js
    taskManager.operator(PROBE_TASK, 'enabled');
})();
