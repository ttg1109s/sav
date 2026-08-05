/**
 * core/video-editor/webcodecs-engine.js — Core THUẦN (Rule 1-5 core-function-conventions.md). ĐÂY
 * LÀ CỔNG DUY NHẤT xử lý video thật — Workflow CHỈ gọi đúng 1 hàm `processVideo(params)`.
 *
 * VIẾT LẠI (v4, "Song/Video Unification" v12, gộp Video Editor vào Modal xem Video — Giang yêu
 * cầu "loại bỏ hoàn toàn edit video, chỉ giữ lại một số core cụ thể") — Video Editor đa-clip/đa-
 * track (Nhạc/Chữ riêng, nhiều đoạn Video nối tiếp) ĐÃ XOÁ HẲN, thay bằng modal xem Video (đúng
 * khuôn modal xem Ảnh) chỉ còn CẮT 1 đoạn duy nhất (start/end) + Crop + Rotate. File này SIMPLIFY
 * lại theo đúng phạm vi mới:
 *   - `videoClips`(mảng nhiều đoạn)/`textClips`/`audioClips` (nhạc thêm/chữ) BỎ HẲN — không còn
 *     lời gọi nào truyền các tham số này nữa (modal mới không có 2 tính năng đó).
 *   - Tham số MỚI: `cutStart`/`cutEnd` (giây, 1 khoảng DUY NHẤT trong file gốc — không phải mảng).
 *   - `_buildMixedAudioTrack()`/`_drawFrameToCanvas()` GIỮ NGUYÊN Ý NGHĨA (audio gốc của Video +
 *     crop/rotate khung hình) nhưng bỏ hẳn phần "mix thêm nhạc ngoài" (không còn `audioClips`).
 *   - `_drawTextOverlayToCanvas()` XOÁ HẲN (0 lời gọi — tính năng Chữ không còn tồn tại).
 *
 * LƯU Ý KIỂM THỬ (như các bản trước): sandbox này KHÔNG chạy được trình duyệt thật, CHƯA verify
 * runtime — đặc biệt `AudioContext.decodeAudioData()` trên Blob của 1 file VIDEO (không phải audio
 * thuần) và `Mediabunny.AudioBufferSource` (tên/chữ ký theo tài liệu tại thời điểm viết).
 *
 * Rule 3 — chỉ gọi API thư viện ngoài (Mediabunny/WebCodecs/Web Audio), không gọi core nào khác.
 * Rule 2 — không đọc `appState`.
 */

/** Vẽ ĐÚNG 1 khung (VideoSample) vào canvas, áp crop+rotate+flip. THỨ TỰ ghép transform khớp preview
 * LIVE trong modal (`event/workflow/video-preview.js::_getRotateTransform()`, CSS `rotate(deg)
 * scale(fit) scaleX(-1)`) — Canvas2D compose theo thứ tự GỌI (lệnh gọi trước = áp SAU cùng lên điểm
 * vẽ), nên gọi `ctx.rotate()` TRƯỚC rồi `ctx.scale(-1,1)` SAU sẽ cho đúng kết quả "lật theo hướng
 * GỐC video, xoay xảy ra sau" — khớp 1-1 với CSS `rotate(...) scaleX(-1)` (mục 4, phản hồi Giang
 * 05/08/2026 — trước đó nút Lật ngang hoàn toàn chưa tồn tại, XUẤT file không có gì để áp).
 * @param {CanvasRenderingContext2D} ctx @param {boolean} flipH */
function _drawFrameToCanvas(ctx, sample, cropPx, rotateDeg, outW, outH, flipH) {
    ctx.save();
    ctx.clearRect(0, 0, outW, outH);
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rotateDeg * Math.PI) / 180);
    if (flipH) ctx.scale(-1, 1);
    ctx.translate(-cropPx.w / 2, -cropPx.h / 2);
    ctx.translate(-cropPx.x, -cropPx.y);
    sample.draw(ctx, 0, 0);
    ctx.restore();
}

/**
 * Trích ĐÚNG 1 đoạn audio gốc của Video ([cutStart,cutEnd)) — decode+re-encode qua
 * OfflineAudioContext (KHÔNG pass-through packet — cần vì canvas đã vẽ lại khung hình crop/rotate,
 * timestamp audio phải dịch lại về mốc 0 cho khớp output mới). Hàm con phục vụ `processVideo()`
 * (Rule 3c).
 * @param {Blob} sourceBlob @param {number} cutStart @param {number} cutEnd @param {any} output - Output (Mediabunny), CHƯA start().
 */
async function _buildTrimmedAudioTrack(sourceBlob, cutStart, cutEnd, output) {
    const duration = Math.max(0, cutEnd - cutStart);
    if (duration <= 0) return; // guard — không có gì để ghép
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const originalBuffer = await audioCtx.decodeAudioData(await sourceBlob.arrayBuffer());
    const sampleRate = originalBuffer.sampleRate;
    const offline = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);

    const src = offline.createBufferSource();
    src.buffer = originalBuffer;
    src.connect(offline.destination);
    const playDur = Math.min(duration, Math.max(0, originalBuffer.duration - cutStart));
    if (playDur > 0) src.start(0, cutStart, playDur);

    const mixedBuffer = await offline.startRendering();
    const audioSource = new Mediabunny.AudioBufferSource({ codec: 'aac', bitrate: Mediabunny.QUALITY_HIGH });
    output.addAudioTrack(audioSource);
    await audioSource.add(mixedBuffer);
    if (typeof audioSource.close === 'function') audioSource.close();
    if (typeof audioCtx.close === 'function') audioCtx.close();
}

/**
 * CỔNG DUY NHẤT xử lý video — cắt 1 đoạn [cutStart,cutEnd) + crop + rotate + lật ngang (toàn cục, áp
 * cho cả đoạn đã cắt). Guard clause trả nguyên `sourceBlob` nếu không có gì thay đổi (không crop/
 * rotate/lật, và cutStart/cutEnd trùng khít toàn bộ video gốc) — tránh decode/encode lại vô ích.
 * @param {object} params
 * @param {Blob} params.sourceBlob - video gốc.
 * @param {number} params.cutStart @param {number} params.cutEnd - giây, trong hệ toạ độ file gốc.
 * @param {{x,y,w,h}|null} params.cropFraction - tỉ lệ 0-1, null = không crop.
 * @param {number} params.rotateDeg - 0/90/180/270.
 * @param {boolean} params.flipH - lật ngang (mục 4, phản hồi Giang 05/08/2026).
 * @returns {Promise<Blob>} video mp4 đã xử lý.
 */
async function processVideo({ sourceBlob, cutStart, cutEnd, cropFraction, rotateDeg, flipH }) {
    const noCrop = !cropFraction;
    const noRotate = !rotateDeg || rotateDeg % 360 === 0;
    const noFlip = !flipH;

    const input = new Mediabunny.Input({ source: new Mediabunny.BlobSource(sourceBlob), formats: Mediabunny.ALL_FORMATS });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error('[processVideo] file không có track video.');
    const fullSourceDuration = await videoTrack.computeDuration();
    const isFullRange = cutStart <= 0.001 && Math.abs(cutEnd - fullSourceDuration) <= 0.001;
    if (noCrop && noRotate && noFlip && isFullRange) return sourceBlob; // guard clause — không có gì để xử lý

    const nativeW = await videoTrack.getDisplayWidth();
    const nativeH = await videoTrack.getDisplayHeight();
    const cropPx = cropFraction
        ? { x: Math.round(cropFraction.x * nativeW), y: Math.round(cropFraction.y * nativeH), w: Math.round(cropFraction.w * nativeW), h: Math.round(cropFraction.h * nativeH) }
        : { x: 0, y: 0, w: nativeW, h: nativeH };
    const deg = ((rotateDeg % 360) + 360) % 360;
    const isSideways = deg === 90 || deg === 270;
    const outW = isSideways ? cropPx.h : cropPx.w;
    const outH = isSideways ? cropPx.w : cropPx.h;

    const canvas = document.createElement('canvas'); // canvas nội bộ, không gắn DOM (Rule 5 không áp dụng)
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');

    const output = new Mediabunny.Output({ format: new Mediabunny.Mp4OutputFormat(), target: new Mediabunny.BufferTarget() });
    const videoSource = new Mediabunny.CanvasSource(canvas, { codec: 'avc', bitrate: Mediabunny.QUALITY_HIGH });
    output.addVideoTrack(videoSource);
    const audioTrack = await input.getPrimaryAudioTrack();
    if (audioTrack) await _buildTrimmedAudioTrack(sourceBlob, cutStart, cutEnd, output); // addAudioTrack() PHẢI xong TRƯỚC output.start()

    await output.start();
    const sink = new Mediabunny.VideoSampleSink(videoTrack);
    for await (const sample of sink.samples(cutStart, cutEnd)) {
        const outputTime = sample.timestamp - cutStart;
        _drawFrameToCanvas(ctx, sample, cropPx, deg, outW, outH, flipH);
        await videoSource.add(outputTime, sample.duration);
        if (typeof sample.close === 'function') sample.close();
    }
    if (typeof videoSource.close === 'function') videoSource.close();
    await output.finalize();

    return new Blob([output.target.buffer], { type: 'video/mp4' });
}
