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
 * FIX (29/09/2026, Giang báo: "cắt phần đầu -> video mới bấm vào tự nhảy về giữa, kéo lùi cũng bị ép về giữa",
 * cắt cuối thì đúng) — NGUYÊN NHÂN: bản Mediabunny đang dùng KHÔNG còn ép transcode khi có `trim.start` (giả định
 * cũ trong comment trước đây đã sai). Mặc định `copy.mode='preferred'` + `copy.boundaryPolicy='expand'` -> track
 * video được COPY nguyên gói từ KEYFRAME ĐỨNG TRƯỚC điểm cắt, phần dư trước điểm cắt mang timestamp ÂM (MP4 hỗ trợ
 * `negativeTimestampSupport: 'full'` qua edit list). Trình phát WebKit xử lý đoạn âm này sai -> mốc bắt đầu thật
 * của file lệch vào giữa, không seek lùi được. SỬA: CHỈ khi cắt đầu — video `forceTranscode` (cắt đúng khung hình
 * tại điểm cắt, timestamp bắt đầu từ 0) + `copy.boundaryPolicy='shrink'` (audio vẫn COPY, không cần AAC encoder,
 * nhưng bắt đầu từ gói ĐẦU TIÊN SAU điểm cắt -> không còn timestamp âm). Cắt cuối (đang đúng) giữ nguyên hành vi cũ.
 *
 * FIX (06/10/2026, Giang báo: "crop không cắt đúng vùng chọn mà chỉ resize" — xác nhận lỗi ở FILE ĐÃ LƯU, màn xem đúng):
 * option `video.crop` của Mediabunny cắt bằng `drawImage(VideoFrame, sx, sy, sw, sh, ...)` (lấy 1 VÙNG NGUỒN từ chính
 * VideoFrame). WebKit/iOS có tiền sử xử lý sai vùng nguồn của drawImage, và với VideoFrame thì kết quả đúng là triệu chứng
 * Giang thấy: CẢ khung hình bị ép vào kích thước vùng crop (resize) thay vì cắt. Khi CÓ cắt khung, engine giờ KHÔNG giao
 * crop/xoay/lật cho Mediabunny nữa mà tự làm qua `video.process` (`_buildCropProcess()`): (1) vẽ NGUYÊN khung hình
 * (không vùng nguồn) vào canvas W×H đúng hướng hiển thị; (2) vẽ canvas đó (canvas->canvas — đường WebKit làm đúng) sang
 * canvas đầu ra bằng 1 ma trận affine = lật -> xoay -> dời gốc về góc vùng crop — CÙNG thứ tự với preview và với
 * `_mapCropRectToOutputFrame()`, phần ngoài vùng crop tự rơi ra ngoài canvas. Không cắt khung (chỉ xoay/lật) giữ nguyên
 * đường Mediabunny cũ (đang chạy đúng).
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

/** Ma trận affine canvas [a,b,c,d,e,f] đưa điểm (x,y) hệ GỐC W×H sang khung đầu ra — ĐÚNG phép của
 * `_mapPointToOutputFrame()` (lật ngang rồi xoay `deg`), viết dạng ma trận để canvas tự biến đổi cả khung hình. Hàm con
 * phục vụ `_buildCropProcess()` (Rule 3c). @returns {number[]} */
function _computeOutputFrameMatrix(w, h, deg, flipH) {
    const s = flipH ? -1 : 1, t = flipH ? w : 0; // fx = s·x + t
    if (deg === 90) return [0, s, -1, 0, h, t];          // X = h - y, Y = fx
    if (deg === 180) return [-s, 0, 0, -1, w - t, h];    // X = w - fx, Y = h - y
    if (deg === 270) return [0, -s, 1, 0, 0, w - t];     // X = y, Y = w - fx
    return [s, 0, 0, 1, t, 0];                           // X = fx, Y = y
}

/** MỚI (06/10/2026) — hàm `process` cho Mediabunny Conversion khi có cắt khung (xem docstring đầu file). 2 canvas nội bộ
 * (bộ đệm pixel, không gắn DOM) tạo 1 lần, dùng lại mọi khung hình (Mediabunny tự chụp nội dung canvas trả về thành
 * VideoSample ngay lúc nhận — cùng cách engine biến đổi của chính nó dùng lại 1 canvas). Hàm con (Rule 3c).
 * @param {{left:number, top:number, width:number, height:number}} outRect - vùng crop trong khung đầu ra (số chẵn).
 * @returns {(sample: object) => HTMLCanvasElement} */
function _buildCropProcess(outRect, w, h, deg, flipH) {
    const fullCanvas = document.createElement('canvas'); // khung hình nguyên vẹn, đúng hướng hiển thị W×H
    fullCanvas.width = w;
    fullCanvas.height = h;
    const fullCtx = fullCanvas.getContext('2d');
    const outCanvas = document.createElement('canvas'); // khung đầu ra = đúng vùng crop
    outCanvas.width = outRect.width;
    outCanvas.height = outRect.height;
    const outCtx = outCanvas.getContext('2d');
    const m = _computeOutputFrameMatrix(w, h, deg, flipH);
    return (sample) => {
        sample.drawWithFit(fullCtx, { fit: 'fill' }); // nguyên khung (tự áp hướng xoay gốc của file), KHÔNG vùng nguồn
        outCtx.setTransform(1, 0, 0, 1, 0, 0);
        outCtx.fillStyle = '#000';
        outCtx.fillRect(0, 0, outCanvas.width, outCanvas.height);
        outCtx.setTransform(m[0], m[1], m[2], m[3], m[4] - outRect.left, m[5] - outRect.top); // lật -> xoay -> dời gốc về góc vùng crop
        outCtx.drawImage(fullCanvas, 0, 0);
        outCtx.setTransform(1, 0, 0, 1, 0, 0);
        return outCanvas;
    };
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
    if (cropRect) {
        // FIX 06/10/2026 — cắt khung tự làm qua `process` (gồm luôn xoay/lật), KHÔNG dùng video.crop/rotate/flip của Mediabunny.
        const outRect = _mapCropRectToOutputFrame(cropRect, sourceWidth, sourceHeight, deg, flipH);
        video.process = _buildCropProcess(outRect, sourceWidth, sourceHeight, deg, flipH);
        video.processedWidth = outRect.width;
        video.processedHeight = outRect.height;
    } else if (deg !== 0 || flipH) {
        video.rotate = flipH && (deg === 90 || deg === 270) ? (360 - deg) % 360 : deg;
        video.flip = !!flipH;
    }
    // FIX 29/09/2026 — cắt đầu: transcode video để khung đầu tiên nằm ĐÚNG điểm cắt ở timestamp 0 (xem docstring đầu file).
    if (trimStart) video.forceTranscode = true;

    const trim = {};
    if (trimStart) trim.start = cutStart; // chỉ đặt khi thật sự cắt đầu
    if (trimEnd) trim.end = cutEnd;

    const conversion = await Mediabunny.Conversion.init({
        input,
        output,
        tracks: 'primary',
        video,
        audio: muteAudio ? { discard: true } : undefined,
        trim: (trimStart || trimEnd) ? trim : undefined,
        // FIX 29/09/2026 — cắt đầu: gói audio copy bắt đầu SAU điểm cắt (không kéo gói trước điểm cắt vào với
        // timestamp âm). Không cắt đầu -> mặc định Mediabunny ('expand'), đúng hành vi cắt cuối đang chạy tốt.
        copy: trimStart ? { boundaryPolicy: 'shrink' } : undefined,
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
