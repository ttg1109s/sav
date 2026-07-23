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

/**
 * [MỚI, audit 23/07/2026 — chuyển từ event/workflow/video-editor.js vào đây, đúng vai Core] Tổng
 * giây OUTPUT của mọi đoạn TRƯỚC `index` (không tính đoạn đó) — dùng để đổi giây NGUỒN đang xem
 * TRONG 1 đoạn ra giây OUTPUT, NHẸ HƠN gọi `computeVideoClipsLayout()` (không cần tính luôn px của
 * MỌI đoạn chỉ để đọc 1 field).
 * @param {Array<{sourceStart:number,sourceEnd:number}>} videoClips @param {number} index
 * @returns {number}
 */
function computeOutputStartForClipIndex(videoClips, index) {
    let sum = 0;
    for (let i = 0; i < index; i++) sum += Math.max(0, videoClips[i].sourceEnd - videoClips[i].sourceStart);
    return sum;
}

/**
 * [MỚI, audit 23/07/2026] Độ rộng OUTPUT cần hiển thị trên timeline = MAX giữa tổng thời lượng
 * Video và mọi clip Nhạc/Chữ (được phép kéo vượt quá trên giao diện, xem docstring
 * `processVideo()` — webcodecs-engine.js). LẶP LẠI công thức cộng dồn của `computeVideoTotalDuration()`
 * (Rule 3 — Core KHÔNG được gọi Core khác dù cùng file, chấp nhận trùng lặp nhỏ, cùng tiền lệ
 * `webcodecs-engine.js`).
 * @param {Array<{sourceStart:number,sourceEnd:number}>} videoClips
 * @param {Array<{timelineEnd:number}>} audioClips @param {Array<{timelineEnd:number}>} textClips
 * @returns {number}
 */
function computeTimelineRenderWidthSeconds(videoClips, audioClips, textClips) {
    let maxEnd = videoClips.reduce((sum, c) => sum + Math.max(0, c.sourceEnd - c.sourceStart), 0);
    audioClips.forEach((c) => { if (c.timelineEnd > maxEnd) maxEnd = c.timelineEnd; });
    textClips.forEach((c) => { if (c.timelineEnd > maxEnd) maxEnd = c.timelineEnd; });
    return maxEnd;
}

/**
 * [MỚI, audit 23/07/2026 — chuyển từ `handleTimelineDragMove()`] Kéo tay cầm START của 1 đoạn
 * Video — RIPPLE vào láng giềng liền TRƯỚC (nếu có) để GIỮ CỐ ĐỊNH outputEnd của chính đoạn đang
 * kéo (Giang yêu cầu: "kéo start thì phải cố định end rồi dịch"). Chứng minh toán học: nếu
 * `clip.sourceStart` và `prevClip.sourceEnd` CÙNG cộng thêm `delta`, thì `prevClip` giãn/co đúng
 * `delta` (bù trừ), còn `clip` co/giãn đúng `-delta` — tổng 2 đoạn không đổi nên outputEnd của
 * `clip` (= outputStart của đoạn kế) không xê dịch. Đoạn ĐẦU TIÊN (không láng giềng trước) dùng biên
 * tự do (tổng thời lượng Video đổi theo, y hệt hành vi cũ). KHÔNG mutate `videoClips` — nơi gọi tự
 * áp `newSourceStart`/`prevSourceEnd` (nếu khác null) vào đúng object.
 * @param {Array<{sourceStart:number,sourceEnd:number}>} videoClips @param {number} index
 * @param {number} deltaSec @param {number} minGap @param {number} fullSourceDuration
 * @returns {{newSourceStart:number, prevSourceEnd:number|null}}
 */
function computeVideoStartTrim(videoClips, index, deltaSec, minGap, fullSourceDuration) {
    const clip = videoClips[index];
    const prevClip = videoClips[index - 1];
    if (prevClip) {
        const minDelta = Math.max(-clip.sourceStart, prevClip.sourceStart + minGap - prevClip.sourceEnd);
        const maxDelta = Math.min(clip.sourceEnd - minGap - clip.sourceStart, fullSourceDuration - prevClip.sourceEnd);
        const clamped = Math.max(minDelta, Math.min(deltaSec, maxDelta));
        return { newSourceStart: clip.sourceStart + clamped, prevSourceEnd: prevClip.sourceEnd + clamped };
    }
    return { newSourceStart: Math.max(0, Math.min(clip.sourceStart + deltaSec, clip.sourceEnd - minGap)), prevSourceEnd: null };
}

/**
 * [MỚI, audit 23/07/2026 — chuyển từ `handleTimelineDragMove()`] Đối xứng với `computeVideoStartTrim()`
 * — kéo tay cầm END, RIPPLE vào láng giềng liền SAU để giữ cố định outputStart của chính đoạn đang
 * kéo. Đoạn CUỐI CÙNG (không láng giềng sau) dùng biên tự do.
 * @param {Array<{sourceStart:number,sourceEnd:number}>} videoClips @param {number} index
 * @param {number} deltaSec @param {number} minGap @param {number} fullSourceDuration
 * @returns {{newSourceEnd:number, nextSourceStart:number|null}}
 */
function computeVideoEndTrim(videoClips, index, deltaSec, minGap, fullSourceDuration) {
    const clip = videoClips[index];
    const nextClip = videoClips[index + 1];
    if (nextClip) {
        const minDelta = Math.max(clip.sourceStart + minGap - clip.sourceEnd, -nextClip.sourceStart);
        const maxDelta = Math.min(fullSourceDuration - clip.sourceEnd, nextClip.sourceEnd - minGap - nextClip.sourceStart);
        const clamped = Math.max(minDelta, Math.min(deltaSec, maxDelta));
        return { newSourceEnd: clip.sourceEnd + clamped, nextSourceStart: nextClip.sourceStart + clamped };
    }
    return { newSourceEnd: Math.min(fullSourceDuration, Math.max(clip.sourceEnd + deltaSec, clip.sourceStart + minGap)), nextSourceStart: null };
}

/**
 * [MỚI, audit 23/07/2026 — chuyển từ `handleTimelineDragMove()`] Kéo tay cầm start/end/move của 1
 * clip TỰ DO (Nhạc/Chữ) — trả về cặp timelineStart/End MỚI, KHÔNG mutate `clip` truyền vào.
 * @param {{timelineStart:number,timelineEnd:number}} clip @param {'start'|'end'|'move'} handleType
 * @param {number} deltaSec @param {number} minGap
 * @returns {{timelineStart:number, timelineEnd:number}}
 */
function computeFreeClipDrag(clip, handleType, deltaSec, minGap) {
    if (handleType === 'start') {
        return { timelineStart: Math.max(0, Math.min(clip.timelineStart + deltaSec, clip.timelineEnd - minGap)), timelineEnd: clip.timelineEnd };
    }
    if (handleType === 'end') {
        // KHÔNG chặn trên — cho phép kéo vượt tổng thời lượng Video (Giang yêu cầu, xem processVideo()).
        return { timelineStart: clip.timelineStart, timelineEnd: Math.max(clip.timelineEnd + deltaSec, clip.timelineStart + minGap) };
    }
    const length = clip.timelineEnd - clip.timelineStart;
    const newStart = Math.max(0, clip.timelineStart + deltaSec);
    return { timelineStart: newStart, timelineEnd: newStart + length };
}

/**
 * [MỞ RỘNG, 23/07/2026 — Text giờ có `posX` (trước chỉ `posY`, luôn canh giữa ngang)] Tìm clip Chữ
 * ĐANG HIỂN THỊ tại `outputTime` và GẦN vị trí chạm nhất theo khoảng cách 2 CHIỀU (X+Y, % kích
 * thước canvas) — dùng cho kéo Text trực tiếp trên preview.
 * @param {Array<{posX:number,posY:number,timelineStart:number,timelineEnd:number}>} textClips
 * @param {number} outputTime @param {number} touchXPercent @param {number} touchYPercent @param {number} maxDistance
 * @returns {number|null} index trong `textClips`, null nếu không có clip nào đủ gần/đang hiển thị.
 */
function findNearestActiveTextClip(textClips, outputTime, touchXPercent, touchYPercent, maxDistance) {
    let bestIndex = null;
    let bestDist = Infinity;
    textClips.forEach((c, index) => {
        if (outputTime < c.timelineStart || outputTime >= c.timelineEnd) return;
        const dx = (c.posX ?? 50) - touchXPercent;
        const dy = (c.posY ?? 80) - touchYPercent;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < bestDist) { bestDist = dist; bestIndex = index; }
    });
    return bestDist <= maxDistance ? bestIndex : null;
}
