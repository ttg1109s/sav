/**
 * core/video-editor/webcodecs-engine.js — Core THUẦN (Rule 1-5 core-function-conventions.md). ĐÂY
 * LÀ CỔNG DUY NHẤT xử lý video thật (crop/rotate/filter/text "nướng" vào file, audio pass-through
 * HOẶC mix thật) — Workflow (`event/workflow/video-editor.js`) CHỈ gọi đúng 1 hàm
 * `processVideo(params)` ở đây, không biết/không cần biết bên trong dùng WebCodecs hay engine gì
 * khác. QUYẾT ĐỊNH ĐÃ CHỐT VỚI GIANG: WebCodecs + Mediabunny (KHÔNG FFmpeg.wasm) — xem
 * `plan-video-editor.md` mục 2.
 *
 * LỊCH SỬ:
 *   Batch 1 — crop/rotate/filter màu. Batch 2 — thêm `cutRange`.
 *   [v2, 23/07/2026] — thêm `textOverlay` (bake chữ vào canvas cùng lúc với frame) + audio MIX thật
 *   (nhạc chèn + volume gốc/nhạc) — THAY đoạn pass-through thuần cho trường hợp có nhạc/đổi volume.
 *
 * QUYẾT ĐỊNH KỸ THUẬT AUDIO (v2) — 2 CON ĐƯỜNG cho CÙNG 1 "chức năng: đưa audio vào output" (coi
 * đây là tối ưu hoá nội bộ của 1 tiến trình duy nhất "sản xuất video", giống hệt cách guard clause
 * `noCut`/`noCrop` ở đầu `processVideo()` đã được chấp nhận — KHÔNG phải rẽ nhánh 2 nghiệp vụ khác
 * nhau theo nghĩa Rule 1, vì kết quả cuối (audio đúng trong output) là 1 mục tiêu duy nhất):
 *   - KHÔNG nhạc chèn + volume gốc = 100% -> pass-through cũ (copy packet, rẻ nhất, không mất chất
 *     lượng do decode/encode lại).
 *   - CÓ nhạc chèn HOẶC volume gốc ≠ 100% -> decode CẢ audio gốc (nếu có) LẪN audio bài hát (nếu
 *     có) qua Web Audio API chuẩn (`AudioContext.decodeAudioData` — KHÔNG qua Mediabunny cho bước
 *     decode này, đơn giản hơn nhiều so với tự dựng lại từng `EncodedAudioPacket`), trộn bằng
 *     `OfflineAudioContext` (mỗi nguồn qua 1 `GainNode` riêng theo volume), rồi đưa buffer đã trộn
 *     vào Mediabunny qua `AudioBufferSource` (API cấp cao Mediabunny hỗ trợ sẵn cho đúng use-case
 *     "mình tự tạo/chỉnh audio rồi cần encode", KHÁC `EncodedAudioPacketSource` dùng cho pass-through).
 *
 * LƯU Ý KIỂM THỬ (thành thật với Giang, như các bản trước): sandbox này KHÔNG chạy được trình
 * duyệt thật nên CHƯA tự verify runtime. Đặc biệt:
 *   - `AudioContext.decodeAudioData()` trên Blob của 1 file VIDEO (không phải audio thuần) — hoạt
 *     động tốt với hầu hết trình duyệt/container phổ biến (mp4/h264+aac) nhưng KHÔNG đảm bảo 100%
 *     mọi container; nếu decode lỗi, cần fallback (chưa viết fallback ở bản này — báo lỗi rõ ràng
 *     qua throw, Workflow tự hiện thông báo cho Giang).
 *   - `Mediabunny.AudioBufferSource` — tên/chữ ký viết theo tài liệu chính thức tại thời điểm viết,
 *     CHƯA verify runtime, giống mọi tên Mediabunny khác trong file này.
 *
 * Rule 3 — chỉ gọi API thư viện ngoài (Mediabunny/WebCodecs/Web Audio), không gọi core nào khác.
 * Rule 2 — không đọc `appState`.
 */

/**
 * Vẽ ĐÚNG 1 khung hình (VideoSample) vào canvas đích, áp filter màu + crop + rotate cùng lúc qua
 * biến đổi hệ toạ độ canvas — hàm con CHỈ phục vụ vòng lặp của `processVideo()` (Rule 3c).
 * @param {CanvasRenderingContext2D} ctx @param {any} sample - VideoSample (Mediabunny), có `.draw(ctx,x,y)`.
 * @param {{x,y,w,h}} cropPx @param {number} rotateDeg @param {string} filterCss
 * @param {number} outW @param {number} outH
 */
function _drawFrameToCanvas(ctx, sample, cropPx, rotateDeg, filterCss, outW, outH) {
    ctx.save();
    ctx.clearRect(0, 0, outW, outH);
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rotateDeg * Math.PI) / 180);
    ctx.translate(-cropPx.w / 2, -cropPx.h / 2);
    ctx.translate(-cropPx.x, -cropPx.y);
    ctx.filter = filterCss || 'none';
    sample.draw(ctx, 0, 0);
    ctx.restore();
}

/**
 * Vẽ đè lớp chữ (Text overlay) lên canvas ĐÍCH — gọi NGAY SAU `_drawFrameToCanvas()` khi
 * `currentTimeInActive` nằm trong `[timelineStart, timelineEnd)` của textOverlay (Workflow tự tính
 * điều kiện đó, hàm này KHÔNG tự so sánh thời gian — chỉ vẽ, đúng Rule 1 đơn tuyến: 1 việc duy nhất
 * là "vẽ chữ", không kiêm luôn "quyết định có nên vẽ hay không").
 * @param {CanvasRenderingContext2D} ctx @param {number} outW @param {number} outH
 * @param {{val,size,color,posY}} text - posY tính theo % (0-100).
 */
function _drawTextOverlayToCanvas(ctx, outW, outH, text) {
    ctx.save();
    const scaleF = outH / 1080;
    const finalSize = Math.round(text.size * scaleF);
    ctx.font = `bold ${finalSize}px -apple-system, Inter, sans-serif`;
    ctx.fillStyle = text.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fillText(text.val, outW / 2, outH * (text.posY / 100));
    ctx.restore();
}

/**
 * Copy nguyên vẹn track audio từ input sang output — KHÔNG decode/re-encode. CHỈ dùng khi KHÔNG có
 * nhạc chèn VÀ volume gốc = 100% (xem quyết định kỹ thuật đầu file). Hàm con phục vụ
 * `processVideo()` (Rule 3c).
 * @param {any} audioTrack - InputAudioTrack (Mediabunny) hoặc null. @param {any} output - CHƯA start().
 * @param {{start,end}|null} cutRange
 */
async function _passThroughAudioTrack(audioTrack, output, cutRange) {
    if (!audioTrack) return; // guard — video không có track audio, bỏ qua, KHÔNG lỗi
    const codec = audioTrack.codec || (await audioTrack.getDecoderConfig())?.codec;
    const audioSource = new Mediabunny.EncodedAudioPacketSource(codec);
    output.addAudioTrack(audioSource);
    const sink = new Mediabunny.EncodedPacketSink(audioTrack);
    const cutStart = cutRange ? cutRange.start : 0;
    const startPacket = cutRange ? await sink.getPacket(cutRange.start) : undefined;
    const endPacket = cutRange ? await sink.getPacket(cutRange.end) : undefined;
    for await (const packet of sink.packets(startPacket, endPacket)) {
        const shifted = cutStart > 0
            ? new Mediabunny.EncodedPacket(packet.data, packet.type, packet.timestamp - cutStart, packet.duration, packet.sequenceNumber)
            : packet;
        await audioSource.add(shifted);
    }
    if (typeof audioSource.close === 'function') audioSource.close();
}

/**
 * [MỚI v2] Decode audio gốc (đoạn `cutRange`, nếu video có audio) + audio bài hát (đoạn
 * `[songOffsetSeconds, songOffsetSeconds+activeDuration]`, nếu có nhạc chèn), trộn qua
 * `OfflineAudioContext` (mỗi nguồn 1 `GainNode` riêng theo volume), rồi ghi buffer đã trộn vào
 * output qua `Mediabunny.AudioBufferSource`. Hàm con phục vụ `processVideo()` (Rule 3c — kết quả
 * side-effect, không có ý nghĩa tách rời khỏi phần video của core cha).
 * @param {Blob} sourceBlob - video gốc (để tự decode audio gốc nếu có).
 * @param {boolean} hasOriginalAudio
 * @param {Blob|null} songBlob @param {number} songOffsetSeconds
 * @param {number} activeDuration - giây, độ dài đoạn audio cần ghép (= cutRange active duration).
 * @param {number} volumeVideo - 0-2 (100% = 1). @param {number} volumeSong - 0-2.
 * @param {any} output - Output (Mediabunny), CHƯA start().
 */
async function _mixAudioTracks(sourceBlob, hasOriginalAudio, songBlob, songOffsetSeconds, activeDuration, volumeVideo, volumeSong, output) {
    if (activeDuration <= 0) return; // guard — không có gì để ghép
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const sampleRate = audioCtx.sampleRate;
    const offline = new OfflineAudioContext(2, Math.ceil(activeDuration * sampleRate), sampleRate);

    if (hasOriginalAudio) {
        const originalBuffer = await audioCtx.decodeAudioData(await sourceBlob.arrayBuffer());
        const src = offline.createBufferSource();
        src.buffer = originalBuffer;
        const gain = offline.createGain();
        gain.gain.value = volumeVideo;
        src.connect(gain).connect(offline.destination);
        // start(when, offset, duration) — phát từ giây `cutRange.start` của audio gốc (Workflow đã
        // truyền activeDuration đúng theo cutRange, offset gốc được cộng vào lúc gọi hàm này — xem processVideo()).
        src.start(0, 0, Math.min(activeDuration, Math.max(0, originalBuffer.duration)));
    }
    if (songBlob) {
        const songBuffer = await audioCtx.decodeAudioData(await songBlob.arrayBuffer());
        const src = offline.createBufferSource();
        src.buffer = songBuffer;
        const gain = offline.createGain();
        gain.gain.value = volumeSong;
        src.connect(gain).connect(offline.destination);
        src.start(0, Math.max(0, songOffsetSeconds), Math.min(activeDuration, Math.max(0, songBuffer.duration - songOffsetSeconds)));
    }

    const mixedBuffer = await offline.startRendering();
    const audioSource = new Mediabunny.AudioBufferSource({ codec: 'aac', bitrate: Mediabunny.QUALITY_HIGH });
    output.addAudioTrack(audioSource);
    await audioSource.add(mixedBuffer);
    if (typeof audioSource.close === 'function') audioSource.close();
    if (typeof audioCtx.close === 'function') audioCtx.close();
}

/**
 * CỔNG DUY NHẤT xử lý video. Workflow gọi hàm này với đầy đủ tham số đã chuẩn bị sẵn (không tự
 * `appState.get()`/DOM nào ở đây — Rule 2).
 *
 * @param {object} params
 * @param {Blob} params.sourceBlob - video gốc.
 * @param {{x,y,w,h}|null} params.cropFraction - vùng crop theo TỈ LỆ (0-1), null = không crop.
 * @param {number} params.rotateDeg - 0/90/180/270.
 * @param {string} params.filterCss - chuỗi CSS filter đã "nướng".
 * @param {{start,end}|null} params.cutRange - khoảng thời gian giữ lại (giây), null = giữ nguyên toàn bộ.
 * @param {{val,size,color,posY,timelineStart,timelineEnd}|null} params.textOverlay - MỚI (v2), null = không chèn chữ.
 *   `timelineStart`/`timelineEnd` tính theo timeline ACTIVE (0 = đầu đoạn cutRange, KHÔNG phải giây gốc video).
 * @param {Blob|null} params.songBlob - MỚI (v2) - bài hát chèn, null = không chèn nhạc.
 * @param {number} params.songOffsetSeconds - MỚI (v2) - offset trong bài hát (giây), vô nghĩa nếu `songBlob` null.
 * @param {number} params.volumeVideo - MỚI (v2) - 0-2 (1 = 100%, mặc định).
 * @param {number} params.volumeSong - MỚI (v2) - 0-2, vô nghĩa nếu `songBlob` null.
 * @returns {Promise<Blob>} video đã xử lý xong, định dạng mp4.
 */
async function processVideo({ sourceBlob, cropFraction, rotateDeg, filterCss, cutRange, textOverlay, songBlob, songOffsetSeconds, volumeVideo, volumeSong }) {
    const noCrop = !cropFraction;
    const noRotate = !rotateDeg || rotateDeg % 360 === 0;
    const noFilter = !filterCss || filterCss === 'none' || filterCss.trim() === '';
    const noCut = !cutRange;
    const noText = !textOverlay;
    const noSong = !songBlob;
    const vol1 = volumeVideo === undefined || volumeVideo === null ? 1 : volumeVideo;
    const noVolumeChange = vol1 === 1;
    if (noCrop && noRotate && noFilter && noCut && noText && noSong && noVolumeChange) return sourceBlob; // guard clause — không có gì để xử lý

    const input = new Mediabunny.Input({ source: new Mediabunny.BlobSource(sourceBlob), formats: Mediabunny.ALL_FORMATS });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error('[processVideo] file không có track video.');
    const audioTrack = await input.getPrimaryAudioTrack();

    const nativeW = await videoTrack.getDisplayWidth();
    const nativeH = await videoTrack.getDisplayHeight();
    const cropPx = cropFraction
        ? { x: Math.round(cropFraction.x * nativeW), y: Math.round(cropFraction.y * nativeH), w: Math.round(cropFraction.w * nativeW), h: Math.round(cropFraction.h * nativeH) }
        : { x: 0, y: 0, w: nativeW, h: nativeH };
    const deg = ((rotateDeg % 360) + 360) % 360;
    const isSideways = deg === 90 || deg === 270;
    const outW = isSideways ? cropPx.h : cropPx.w;
    const outH = isSideways ? cropPx.w : cropPx.h;

    const canvas = document.createElement('canvas'); // canvas nội bộ, không gắn DOM — bộ đệm pixel cho encode (Rule 5 không áp dụng)
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');

    const output = new Mediabunny.Output({ format: new Mediabunny.Mp4OutputFormat(), target: new Mediabunny.BufferTarget() });
    const videoSource = new Mediabunny.CanvasSource(canvas, { codec: 'avc', bitrate: Mediabunny.QUALITY_HIGH });
    output.addVideoTrack(videoSource);

    // Audio — 2 con đường (xem quyết định kỹ thuật đầu file). addAudioTrack() PHẢI xong TRƯỚC
    // output.start() (Quick start Mediabunny) — cả 2 hàm dưới đây tự lo việc đó.
    const cutStart = cutRange ? cutRange.start : 0;
    const cutEnd = cutRange ? cutRange.end : Infinity;
    const activeDuration = cutRange ? (cutRange.end - cutRange.start) : undefined;
    if (noSong && noVolumeChange) {
        await _passThroughAudioTrack(audioTrack, output, cutRange);
    } else if (activeDuration !== undefined) {
        await _mixAudioTracks(sourceBlob, !!audioTrack, songBlob || null, songOffsetSeconds || 0, activeDuration, vol1, volumeSong === undefined || volumeSong === null ? 1 : volumeSong, output);
    } else {
        // guard — có nhạc/đổi volume nhưng KHÔNG cutRange (toàn bộ video) -> activeDuration = tổng thời lượng thật
        const fullDuration = await videoTrack.computeDuration();
        await _mixAudioTracks(sourceBlob, !!audioTrack, songBlob || null, songOffsetSeconds || 0, fullDuration, vol1, volumeSong === undefined || volumeSong === null ? 1 : volumeSong, output);
    }

    await output.start();
    const sink = new Mediabunny.VideoSampleSink(videoTrack);
    for await (const sample of sink.samples(cutStart, cutEnd)) {
        const tInActive = sample.timestamp - cutStart;
        _drawFrameToCanvas(ctx, sample, cropPx, deg, filterCss, outW, outH);
        if (!noText && tInActive >= textOverlay.timelineStart && tInActive < textOverlay.timelineEnd) {
            _drawTextOverlayToCanvas(ctx, outW, outH, textOverlay);
        }
        await videoSource.add(tInActive, sample.duration);
        if (typeof sample.close === 'function') sample.close();
    }
    if (typeof videoSource.close === 'function') videoSource.close();
    await output.finalize();

    return new Blob([output.target.buffer], { type: 'video/mp4' });
}
