/**
 * core/perf-hud.js — MỚI (05/10/2026, Giang yêu cầu "đưa perf-probe từ service về thành core riêng chịu rule core,
 * event bus"). Phần TÍNH TOÁN THUẦN của Performance HUD — thay khối "Số liệu" của service/perf-probe.js cũ (ĐÃ XOÁ).
 * Mọi hàm: chỉ nhận tham số, trả giá trị (hoặc sửa tại chỗ đúng mảng nhận vào), KHÔNG appState/taskManager/DOM toàn
 * cục, KHÔNG gọi core khác (Rule 1-3). Điều phối (vòng raf, hẹn giờ chạm giữ, lưu config) ở event/workflow/perf-hud.js;
 * dựng/ghi DOM ở core/perf-hud-ui.js; template ở components/perf-hud.js.
 *
 * Hằng số PERF_HUD_* dùng chung cho Workflow + component (cùng khuôn RECORDER_LATENCY_* ở core/recorder.js).
 */
const PERF_HUD_STYLES = ['strip', 'detail']; // Kiểu HUD: dải (strip) | thẻ chi tiết (detail)
const PERF_HUD_ORIENTATIONS = ['horizontal', 'vertical']; // Chiều dải — chỉ áp cho kiểu strip
const PERF_HUD_WINDOW_MS = 2000; // cửa sổ thống kê fps/giật
const PERF_HUD_JANK_MS = 25; // frame dài hơn mức này = 1 lần giật
const PERF_HUD_REFRESH_MS = 500; // nhịp ghi số mới lên HUD
const PERF_HUD_SNAPSHOT_DELAY_MS = 1500; // sau khi đổi màn Playlist <-> Visualizer, đợi trượt xong rồi mới ghi 1 dòng console
const PERF_HUD_TAP_BLOCK_WINDOW_MS = 1500; // đo khoảng chặn main thread dài nhất trong 1,5s đầu sau 1 cú chạm
const PERF_HUD_TAP_REPORT_DELAY_MS = 3000; // ghi dòng console của 1 cú chạm sau 3s (hoặc khi có cú chạm kế)
const PERF_HUD_LONG_PRESS_MS = 450; // chạm giữ bao lâu thì HUD "nhấc lên" để kéo
const PERF_HUD_DRAG_SLOP_PX = 8; // lệch quá mức này TRƯỚC khi đủ thời gian chạm giữ = không phải chạm giữ -> huỷ
const PERF_HUD_EDGE_GAP_PX = 4; // khoảng hở tối thiểu với mép màn hình
const PERF_HUD_DEFAULT_POSITION = { left: 4, top: 48 }; // góc trái trên, dưới vùng tai thỏ/status bar
const PERF_HUD_SPARK_BARS = 24; // số cột biểu đồ FPS ở kiểu detail (24 x 0,5s = 12s gần nhất)
const PERF_HUD_SPARK_MIN_PEAK = 60; // đỉnh thang đo tối thiểu (máy 120Hz tự nới theo giá trị lớn nhất)

/** Chuẩn hoá config đã lưu (meta.perfHudConfig) — field lạ/thiếu nhận mặc định. Chọn GIÁ TRỊ, không rẽ tiến trình.
 * @param {object} saved @param {{enabled:boolean, style:string, orientation:string, position:(object|null)}} defaults
 * @returns {{enabled:boolean, style:string, orientation:string, position:(object|null)}} */
function normalizePerfHudConfig(saved, defaults) {
    const pos = saved.position;
    const hasPosition = !!pos && typeof pos.left === 'number' && typeof pos.top === 'number';
    return {
        enabled: saved.enabled === true,
        style: PERF_HUD_STYLES.includes(saved.style) ? saved.style : defaults.style,
        orientation: PERF_HUD_ORIENTATIONS.includes(saved.orientation) ? saved.orientation : defaults.orientation,
        position: hasPosition ? { left: pos.left, top: pos.top } : null,
    };
}

/** @param {*} value @returns {'strip'|'detail'} */
function normalizePerfHudStyle(value) {
    return PERF_HUD_STYLES.includes(value) ? value : PERF_HUD_STYLES[0];
}

/** @param {*} value @returns {'horizontal'|'vertical'} */
function normalizePerfHudOrientation(value) {
    return PERF_HUD_ORIENTATIONS.includes(value) ? value : PERF_HUD_ORIENTATIONS[0];
}

/** Bỏ các frame cũ hơn cửa sổ thống kê — sửa TẠI CHỖ mảng nhận vào.
 * @param {Array<[number, number]>} frameLog - [timestamp, delta] @param {number} now @param {number} windowMs */
function trimPerfFrameLog(frameLog, now, windowMs) {
    while (frameLog.length && now - frameLog[0][0] > windowMs) frameLog.shift();
}

/** FPS trung bình + số frame giật trong cửa sổ. @param {Array<[number, number]>} frameLog @param {number} jankMs
 * @returns {{fps:number, jank:number}} */
function computePerfFrameStats(frameLog, jankMs) {
    const n = frameLog.length;
    const jank = frameLog.reduce((acc, f) => acc + (f[1] > jankMs ? 1 : 0), 0);
    const spanMs = n > 1 ? frameLog[n - 1][0] - frameLog[0][0] : 0;
    const fps = spanMs > 0 ? Math.round((n - 1) * 1000 / spanMs) : 0;
    return { fps, jank };
}

/** Gộp số liệu 1 lượt. @param {{fps:number, jank:number, jsMsLastSec:number, droppedPerSec:(number|string)}} input
 * @returns {{fps:number, jank:number, frameMs:number, jsMs:number, drop:(number|string)}} */
function computePerfHudMetrics({ fps, jank, jsMsLastSec, droppedPerSec }) {
    const framesPerSec = Math.max(1, fps);
    return { fps, jank, frameMs: 1000 / framesPerSec, jsMs: jsMsLastSec / framesPerSec, drop: droppedPerSec };
}

/** Chuỗi hiển thị theo id ô số liệu của template (components/perf-hud.js, `data-pph-value`).
 * @param {{fps:number, jank:number, frameMs:number, jsMs:number, drop:(number|string)}} m @returns {Object<string,string>} */
function formatPerfHudValues(m) {
    return {
        fps: `${m.fps}`,
        jank: `${m.jank}`,
        frame: m.frameMs.toFixed(1),
        js: m.jsMs.toFixed(1),
        drop: `${m.drop}`,
    };
}

/** Dòng chữ đủ nhãn — CHỈ để ghi console (Debug console copy được). @param {string} screenLabel
 * @param {{fps:number, jank:number, frameMs:number, jsMs:number, drop:(number|string)}} m @returns {string} */
function formatPerfHudReport(screenLabel, m) {
    return `${screenLabel} fps ${m.fps} | jank ${m.jank}/2s | frame ${m.frameMs.toFixed(1)}ms | JS ${m.jsMs.toFixed(1)}ms | video rơi ${m.drop}/s`;
}

/** Nhãn màn đang hiện cho console. @param {boolean} isPlaylistHidden @returns {'VIS'|'PL'} */
function resolvePerfScreenLabel(isPlaylistHidden) {
    return isPlaylistHidden ? 'VIS' : 'PL';
}

/** Số frame video bị bỏ trong giây vừa qua. Không đo được (dropped null) = '-'; lần đo đầu (chưa có mốc) = 0.
 * @param {(number|null)} dropped @param {(number|null)} lastDropped @returns {(number|string)} */
function computePerfDroppedPerSec(dropped, lastDropped) {
    if (dropped === null) return '-';
    return lastDropped === null ? 0 : Math.max(0, dropped - lastDropped);
}

/** Đẩy 1 mẫu FPS vào lịch sử biểu đồ, giữ tối đa `maxLen` mẫu — sửa TẠI CHỖ mảng nhận vào.
 * @param {number[]} history @param {number} fps @param {number} maxLen */
function pushPerfFpsHistory(history, fps, maxLen) {
    history.push(fps);
    while (history.length > maxLen) history.shift();
}

/** Chiều cao (%) từng cột biểu đồ FPS, cột phải cùng = mẫu mới nhất; thiếu mẫu thì các cột đầu = 0.
 * @param {number[]} history @param {number} barCount @param {number} minPeak @returns {number[]} */
function computePerfHudSparkHeights(history, barCount, minPeak) {
    const peak = Math.max(minPeak, ...history);
    const padding = Math.max(0, barCount - history.length);
    const heights = [];
    for (let i = 0; i < barCount; i++) {
        const sample = i < padding ? 0 : history[i - padding];
        heights.push(Math.max(4, Math.round(sample / peak * 100)));
    }
    return heights;
}

/** Vị trí HUD (px) kẹp trong màn hình. @returns {{left:number, top:number}} */
function computePerfHudPosition(left, top, width, height, viewportW, viewportH, gapPx) {
    const maxLeft = Math.max(gapPx, viewportW - width - gapPx);
    const maxTop = Math.max(gapPx, viewportH - height - gapPx);
    return {
        left: Math.min(maxLeft, Math.max(gapPx, left)),
        top: Math.min(maxTop, Math.max(gapPx, top)),
    };
}

/** Ngón tay đã lệch quá ngưỡng so với điểm chạm đầu chưa (chưa đủ thời gian chạm giữ mà lệch = vuốt, huỷ kéo).
 * @returns {boolean} */
function isPerfHudDragSlopExceeded(startX, startY, x, y, slopPx) {
    return Math.hypot(x - startX, y - startY) > slopPx;
}

/** Mô tả ngắn phần tử được chạm cho nhật ký console: `#id gần nhất "chữ đầu"`.
 * @param {Element} el @returns {string} */
function describePerfTapTarget(el) {
    if (!el || !el.closest) return '?';
    const withId = el.closest('[id]');
    const text = (el.textContent || '').trim().slice(0, 16);
    return `${withId ? '#' + withId.id : el.tagName.toLowerCase()}${text ? ' "' + text + '"' : ''}`;
}
