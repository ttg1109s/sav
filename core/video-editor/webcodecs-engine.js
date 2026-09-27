/**
 * core/video-editor/webcodecs-engine.js — Core THUẦN (Rule 1-5 core-function-conventions.md). ĐÂY
 * LÀ CỔNG DUY NHẤT xử lý video thật — Workflow CHỈ gọi đúng 1 hàm `processVideo(params)`.
 *
 * VIẾT LẠI (v5, Phase 1 "editor video kiểu Story", 26/09/2026) — bỏ hẳn pipeline tự viết (đọc từng
 * khung qua VideoSampleSink → vẽ canvas → CanvasSource, audio giải mã CẢ FILE bằng decodeAudioData
 * rồi OfflineAudioContext → AudioBufferSource, output gom trong BufferTarget). Lý do (bug đã báo):
 *   - decodeAudioData cả file + BufferTarget giữ toàn bộ output trong RAM → video full-res dài dễ
 *     làm Safari reload tab.
 *   - AAC encode bắt buộc mỗi lần xuất (kể cả khi chỉ xoay) — máy thiếu AudioEncoder AAC là hỏng.
 *   - Kích thước crop lẻ → encoder H.264 (4:2:0) từ chối.
 * Thay bằng `Mediabunny.Conversion` (streaming, tự copy track nào không cần sửa, tự chọn codec
 * encode được): trim/xoay/lật/cắt khung khai báo, tắt tiếng = `audio.discard`. CẦN Mediabunny ≥
 * 1.57.0 (option `video.flip` có từ bản này) — nạp OFFLINE từ assets/vendor/mediabunny.js.
 *
 * THỨ TỰ BIẾN ĐỔI — preview trong modal (CSS `rotate(deg) scale() scaleX(-1)`) là: LẬT theo hướng
 * GỐC video trước, XOAY sau. Mediabunny ngược lại: xoay trước → lật → cắt khung. Quy đổi (R = xoay
 * thuận kim đồng hồ, F = lật ngang): R(d)·F = F·R(-d), nên khi có lật: mbRotate = (360 - d) % 360,
 * mbFlip = true (0°/180° giữ nguyên số độ). Khung crop (toạ độ px GỐC, chưa lật/xoay — cùng hệ với
 * session crop của modal) được đưa qua ĐÚNG biến đổi của preview để ra toạ độ khung hình ĐẦU RA,
 * nơi Mediabunny áp `crop` (sau xoay + lật) — xem `_mapCropRectToOutputFrame()`.
 *
 * Rule 3 — chỉ gọi API thư viện ngoài (Mediabunny/WebCodecs), không gọi core nào khác của project.
 * Rule 2 — không đọc `appState`. Đích ghi (OPFS writable) do Workflow chuẩn bị, truyền qua tham số.
 */

/** Đưa 1 điểm (px, hệ GỐC W×H) qua đúng biến đổi của preview: lật ngang (nếu có) rồi xoay `deg`
 * thuận kim đồng hồ. Hàm con phục vụ `_mapCropRectToOutputFrame()` (Rule 3c).
 * @returns {number[]} [x, y] trong khung đầu ra (W×H nếu 0/180, H×W nếu 90/270). */
function _mapPointToOutputFrame(x, y, w, h, deg, flipH) {
    const fx = flipH ? w - x : x;
    if (deg === 90) return [h - y, fx];
    if (deg === 180) return [w - fx, h - y];
    if (deg === 270) return [y, w - fx];
    return [fx, y];
}

/** Khung crop (px GỐC) → CropRectangle trong khung đầu ra, bề rộng/cao làm tròn XUỐNG số CHẴN
 * (H.264 4:2:0 từ chối kích thước lẻ), toạ độ trái/trên cũng chẵn. Hàm con (Rule 3c).
 * @returns {{left:number, top:number, width:number, height:number}} */
function _mapCropRectToOutputFrame(rect, w, h, deg, flipH) {
    const a = _mapPointToOutputFrame(rect.x, rect.y, w, h, deg, flipH);
    const b = _mapPointToOutputFrame(rect.x + rect.w, rect.y + rect.h, w, h, deg, flipH);
    const even = (n) => Math.max(0, Math.floor(n / 2) * 2);
    const left = even(Math.min(a[0], b[0])), top = even(Math.min(a[1], b[1]));
    const width = Math.max(2, even(Math.abs(b[0] - a[0]))), height = Math.max(2, even(Math.abs(b[1] - a[1])));
    return { left, top, width, height };
}

/**
 * CỔNG DUY NHẤT xử lý video — cắt đoạn [cutStart,cutEnd) + cắt khung + xoay + lật ngang + tắt tiếng.
 * Guard clause trả nguyên `sourceBlob` nếu không có gì thay đổi.
 * @param {object} params
 * @param {Blob} params.sourceBlob - video gốc.
 * @param {number} params.cutStart @param {number} params.cutEnd - giây, hệ toạ độ file gốc.
 * @param {number} params.sourceDuration - tổng thời lượng gốc (giây, từ `<video>`), để biết có cắt đầu/cuối hay không.
 * @param {{x:number,y:number,w:number,h:number}|null} params.cropRect - px GỐC (chưa lật/xoay), null = không cắt khung.
 * @param {number} params.sourceWidth @param {number} params.sourceHeight - kích thước hiển thị gốc (px).
 * @param {number} params.rotateDeg - 0/90/180/270.
 * @param {boolean} params.flipH
 * @param {boolean} params.muteAudio - true = bỏ hẳn track audio.
 * @param {FileSystemWritableFileStream|null} params.writable - đích OPFS (Workflow mở sẵn); null = ghi RAM (BufferTarget).
 * @param {(fraction:number) => void} [params.onProgress] - 0..1.
 * @returns {Promise<{status:'unchanged', blob:Blob} | {status:'ok', blob:Blob|null, audioDropped:boolean} | {status:'invalid', reasons:string[]}>}
 *   `blob` null khi đã ghi thẳng vào `writable` (Workflow tự đọc lại file OPFS).
 */
async function processVideo({ sourceBlob, cutStart, cutEnd, sourceDuration, cropRect, sourceWidth, sourceHeight, rotateDeg, flipH, muteAudio, writable, onProgress }) {
    const deg = (((rotateDeg || 0) % 360) + 360) % 360;
    const trimStart = cutStart > 0.001;
    const trimEnd = cutEnd < sourceDuration - 0.05;
    if (!cropRect && deg === 0 && !flipH && !muteAudio && !trimStart && !trimEnd) return { status: 'unchanged', blob: sourceBlob }; // guard clause — không có gì để xử lý

    const input = new Mediabunny.Input({ source: new Mediabunny.BlobSource(sourceBlob), formats: Mediabunny.ALL_FORMATS });
    const target = writable ? new Mediabunny.StreamTarget(writable) : new Mediabunny.BufferTarget();
    const output = new Mediabunny.Output({
        format: new Mediabunny.Mp4OutputFormat({ fastStart: writable ? false : 'in-memory' }), // stream ghi tuần tự -> moov cuối file; RAM -> moov đầu file
        target,
    });

    const video = { allowTransformationMetadata: false }; // "nướng" xoay/lật vào khung hình — không phụ thuộc trình phát có hiểu metadata lật hay không
    if (deg !== 0 || flipH) {
        video.rotate = flipH && (deg === 90 || deg === 270) ? (360 - deg) % 360 : deg;
        video.flip = !!flipH;
    }
    if (cropRect) video.crop = _mapCropRectToOutputFrame(cropRect, sourceWidth, sourceHeight, deg, flipH);

    const trim = {};
    if (trimStart) trim.start = cutStart; // đặt start ép transcode cả video lẫn audio (giới hạn Mediabunny) — chỉ đặt khi thật sự cắt đầu
    if (trimEnd) trim.end = cutEnd;

    const conversion = await Mediabunny.Conversion.init({
        input,
        output,
        tracks: 'primary',
        video,
        audio: muteAudio ? { discard: true } : undefined,
        trim: (trimStart || trimEnd) ? trim : undefined,
    });
    if (!conversion.isValid) {
        return { status: 'invalid', reasons: conversion.discardedTracks.map((d) => `${d.track.type}:${d.reason}`) };
    }
    const audioDropped = !muteAudio && conversion.discardedTracks.some((d) => d.track.type === 'audio' && d.reason !== 'discarded_by_user');
    if (onProgress) conversion.onProgress = onProgress;
    await conversion.execute();

    const blob = writable ? null : new Blob([output.target.buffer], { type: 'video/mp4' });
    return { status: 'ok', blob, audioDropped };
}
