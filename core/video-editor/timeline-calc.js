/**
 * core/video-editor/timeline-calc.js — Core THUẦN (Rule 1-4 core-function-conventions.md).
 *
 * [v3, 23/07/2026] — đổi kiến trúc lớn theo yêu cầu Giang: track Video giờ là MẢNG nhiều đoạn
 * (`videoClips: [{sourceStart, sourceEnd}]`) nối tiếp NHAU trên timeline OUTPUT (không hở, không
 * đè — vị trí mỗi đoạn suy ra từ THỨ TỰ + độ dài, không tự đặt vị trí riêng được, khác Nhạc/Chữ).
 * Nhạc/Chữ giờ là clip TỰ DO (vị trí + độ dài riêng, xem `event/workflow/video-editor.js`).
 *
 * Rule 2 — không đọc appState. Rule 3 — không gọi core nào khác.
 */

/** Tổng thời lượng OUTPUT của track Video = tổng độ dài từng đoạn (sourceEnd-sourceStart). */
function computeVideoTotalDuration(videoClips) {
    return videoClips.reduce((sum, clip) => sum + Math.max(0, clip.sourceEnd - clip.sourceStart), 0);
}

/**
 * Layout TOÀN BỘ track Video — mỗi đoạn nối tiếp đoạn trước (Rule 1: 1 việc — tính vị trí nối
 * tiếp, không kiêm luôn áp DOM).
 * @param {Array<{sourceStart:number,sourceEnd:number}>} videoClips
 * @param {number} pixelsPerSecond
 * @returns {Array<{leftPx:number, widthPx:number, outputStart:number, outputEnd:number}>}
 */
function computeVideoClipsLayout(videoClips, pixelsPerSecond) {
    let cursor = 0;
    return videoClips.map((clip) => {
        const duration = Math.max(0, clip.sourceEnd - clip.sourceStart);
        const outputStart = cursor;
        cursor += duration;
        return { leftPx: outputStart * pixelsPerSecond, widthPx: duration * pixelsPerSecond, outputStart, outputEnd: cursor };
    });
}

/**
 * Đoạn Video nào (index) đang chứa 1 mốc thời gian OUTPUT — dùng cho "Cắt tại current". Trả về
 * TOẠ ĐỘ NGUỒN tương ứng (để tách đúng điểm trong file gốc, không phải điểm trên output).
 * @param {Array<{sourceStart:number,sourceEnd:number}>} videoClips @param {number} outputTime
 * @returns {{index:number, sourceSplitPoint:number}|null} - null nếu outputTime nằm ngoài toàn bộ track.
 */
function findVideoClipAtOutputTime(videoClips, outputTime) {
    let cursor = 0;
    for (let i = 0; i < videoClips.length; i++) {
        const clip = videoClips[i];
        const duration = Math.max(0, clip.sourceEnd - clip.sourceStart);
        if (outputTime >= cursor && outputTime < cursor + duration) {
            return { index: i, sourceSplitPoint: clip.sourceStart + (outputTime - cursor) };
        }
        cursor += duration;
    }
    return null;
}

/**
 * Tách 1 khoảng [start,end] thành 2 khoảng liền kề tại `splitPoint` — dùng CHUNG cho Split của cả
 * 3 track (Video: sourceStart/sourceEnd; Nhạc/Chữ: timelineStart/timelineEnd — nơi gọi tự đổi tên
 * field theo ngữ cảnh, hàm này chỉ làm việc trên 2 con số).
 * @param {number} start @param {number} end @param {number} splitPoint - PHẢI nằm trong (start,end), nơi gọi tự đảm bảo.
 * @returns {[{start:number,end:number},{start:number,end:number}]}
 */
function splitRangeAt(start, end, splitPoint) {
    const clamped = Math.max(start, Math.min(end, splitPoint));
    return [{ start, end: clamped }, { start: clamped, end }];
}

/**
 * Vị trí + độ rộng (px) của 1 clip TỰ DO (Nhạc/Chữ) trên timeline, theo mật độ pixel/giây.
 * @param {number} startSec @param {number} lengthSec @param {number} pixelsPerSecond
 * @returns {{leftPx:number, widthPx:number}}
 */
function computeClipLayoutPx(startSec, lengthSec, pixelsPerSecond) {
    return { leftPx: Math.max(0, startSec) * pixelsPerSecond, widthPx: Math.max(0, lengthSec) * pixelsPerSecond };
}

/** Vị trí playhead (px) theo thời gian OUTPUT hiện tại. */
function computePlayheadLeftPx(currentTimeSec, pixelsPerSecond) {
    return Math.max(0, currentTimeSec) * pixelsPerSecond;
}

/**
 * Đổi 1 toạ độ px trên timeline (đo từ mép trái #video-editor-timeline-content) thành giây.
 * @param {number} offsetPx @param {number} pixelsPerSecond
 * @returns {number} giây, KHÔNG kẹp biên (nơi gọi tự kẹp theo ngữ cảnh).
 */
function pxToSeconds(offsetPx, pixelsPerSecond) {
    return pixelsPerSecond > 0 ? offsetPx / pixelsPerSecond : 0;
}

/** "m:ss" — dùng cho nhãn thời gian timeline/transport bar. @param {number} totalSeconds */
function formatClipTimeLabel(totalSeconds) {
    const s = Math.max(0, Math.round(totalSeconds));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
}
