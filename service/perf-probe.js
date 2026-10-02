/**
 * service/perf-probe.js — TẠM (02/10/2026, v8), CHỈ ĐỂ CHẨN ĐOÁN bug "về Playlist rồi chọn media -> giật toàn bộ
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
 *   [Chạm]     — (v5) KHÔNG làm gì, không ghi log. Giang báo bấm nút nào của v3 cũng hết giật, dù 5 nút làm 5 việc
 *                khác nhau (có nút chỉ đổi 1 class) -> nghi chính cú CHẠM là thứ chữa. Nút này mượt lại => xác nhận.
 *   [Chạm chặn] — (v5) cũng không làm gì, nhưng preventDefault() ngay touchstart (trình duyệt KHÔNG xử lý cú chạm
 *                theo kiểu native: không click, không tương tác cuộn). [Chạm] chữa mà [Chạm chặn] không => thứ chữa là
 *                xử lý chạm native của iOS (trạng thái tương tác/cuộn của WebKit), không phải code JS của app.
 *                -> Giang xác nhận (02/10/2026): [Chạm] chữa, [Chạm chặn] không; JS mọi task raf chỉ 0.7–2ms/frame cả lúc
 *                giật => trình duyệt tự hạ nhịp vẽ, không phải code nặng.
 *   [Khoá cuộn] — (v6, bật/tắt, BẬT TRƯỚC khi tái hiện) thử phương án sửa: lúc #app-stack mang `.playlist-hidden`
 *                (đang ở / đang trượt sang Visualizer) đổi khung cuộn Playlist sang `overflow: hidden` -> trên iOS khung
 *                cuộn native (UIScrollView) của nó bị gỡ, không còn tương tác cuộn nào treo lại được; về Playlist thì trả
 *                `overflow-y: auto` (scrollTop giữ nguyên, cuộn bằng code vẫn chạy bình thường). Bật mà KHÔNG còn tái hiện
 *                được giật => chốt nguyên nhân + phương án.
 *                -> Giang báo (02/10/2026): bật vẫn tái hiện được giật => KHÔNG phải khung cuộn Playlist. (v7: đã gỡ nút.)
 *
 * v7 — CHIA ĐÔI tìm BƯỚC gây ra trạng thái giật. Đã biết: giật bắt đầu đúng lúc ĐỔI MEDIA (chọn bài từ Playlist / Next),
 * chữa bằng 1 cú chạm native bất kỳ. Mỗi nút dưới là 1 công tắc (bật = xanh, BẬT TRƯỚC rồi mới tái hiện), tắt hẳn 1
 * bước trong luồng đổi media. Bật nút nào mà KHÔNG còn tái hiện được => bước đó là thủ phạm.
 *   [Không WL]      — requestWakeLock() thành no-op (bật lên thì nhả wake lock đang giữ 1 lần). Màn hình có thể tự tắt.
 *   [Không làm mới PL] — refreshSongNode() bỏ qua lúc Playlist đang ẩn (dòng đang phát sẽ hiển thị cũ — chỉ để đo).
 *   [Không cuộn]    — scrollToCurrentInstant()/scrollToCurrentWhenShown() thành no-op (về Playlist không nhảy tới bài).
 *   [Chạm]          — không làm gì (để gỡ giật khi cần).
 * Nhật ký chạm (v7): mỗi cú chạm bất kỳ (trừ nút probe) -> 3s sau ghi 1 dòng: phần tử được chạm, khoảng chặn main
 * thread dài nhất trong 1.5s đầu, fps sau 3s, các công tắc đang bật. Giang copy các dòng `[perf-probe] chạm` ở Debug console.
 * Mỗi lần đổi màn Playlist <-> Visualizer: ghi 1 dòng tóm tắt ra console (Debug console để copy).
 *
 * v9 — đã chốt cơ chế ẩn Playlist vào CSS chính. Probe chỉ còn HUD đo thụ động: FPS/jank, video frame rơi,
 * tick/thời gian callback RAF và snapshot sau khi đổi màn. Không còn nút, công tắc, wrapper luồng media,
 * quét animation/dòng Playlist hoặc nhật ký chạm để bản thân probe không làm nhiễu phép đo.
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
#perf-probe-hud { position: fixed; top: calc(env(safe-area-inset-top, 0px) + 4px); left: 4px; z-index: 2147483647;
  font: 10px/1.35 ui-monospace, Menlo, monospace; color: #fff; background: rgba(0,0,0,0.65); padding: 4px 6px;
  border-radius: 6px; white-space: pre; pointer-events: none; max-width: calc(100vw - 8px); overflow: hidden; }
`;
    document.head.appendChild(style);

    const hud = document.createElement('div');
    hud.id = 'perf-probe-hud';
    document.body.appendChild(hud);

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

    // ===== Thu số liệu =====
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
            + `ms/frame JS ${jsMs.toFixed(1)} / frame ${frameMs.toFixed(0)} / khác ${Math.max(0, frameMs - jsMs).toFixed(0)} | nặng: ${heaviest.replace(/Task$|Tick$/, '')} ${heaviestMs.toFixed(1)}ms`;
    }

    function tick() {
        const now = performance.now();
        if (lastFrameTs) frameLog.push([now, now - lastFrameTs]);
        lastFrameTs = now;
        wrapRafCallbacks();

        if (now - lastSecTs >= 1000) {
            tickRateByTask = Object.assign({}, tickCountByTask);
            Object.keys(tickCountByTask).forEach((n) => { tickCountByTask[n] = 0; });
            tickMsRateByTask = Object.assign({}, tickMsByTask);
            Object.keys(tickMsByTask).forEach((n) => { tickMsByTask[n] = 0; });
            Object.keys(tickMsRateByTask).forEach((n) => { if (!taskManager.plan[n]) delete tickMsRateByTask[n]; });
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
