/**
 * core/video-editor/webcodecs-engine.js — Core THUẦN (Rule 1-5 core-function-conventions.md). ĐÂY
 * LÀ CỔNG DUY NHẤT xử lý video thật — Workflow CHỈ gọi đúng 1 hàm `processVideo(params)`.
 *
 * [v3, 23/07/2026] — đổi kiến trúc lớn theo yêu cầu Giang:
 *   - Track Video giờ là MẢNG nhiều đoạn (`videoClips`) nối tiếp nhau trên timeline OUTPUT (không
 *     còn 1 `cutRange` duy nhất) — ghép bằng cách đọc `VideoSampleSink.samples(sourceStart,
 *     sourceEnd)` LẦN LƯỢT từng đoạn, dịch timestamp về đúng vị trí OUTPUT của đoạn đó.
 *   - Track Nhạc/Chữ giờ là MẢNG clip TỰ DO (`audioClips`/`textClips`, mỗi clip có
 *     `timelineStart`/`timelineEnd` riêng theo giây OUTPUT) — KHÔNG còn neo cứng theo Video.
 *   - GIỚI HẠN TỔNG (Giang yêu cầu): mọi phần Nhạc/Chữ vượt quá tổng thời lượng Video (tính từ
 *     `videoClips`) bị CẮT BỎ ở bước này — giao diện cho phép kéo vượt, nhưng xuất ra thì không.
 *   - Crop/Rotate vẫn là GIÁ TRỊ TOÀN CỤC (áp cho toàn bộ Video, KHÔNG tách riêng theo từng đoạn) —
 *     đơn giản hoá có chủ đích, Giang chưa yêu cầu xoay/crop riêng từng đoạn.
 *   - [SỬA 24/07/2026, mục d] — Filter (Brightness/Contrast/Saturation, `filterCss`) BỎ HẲN. Volume
 *     audio gốc (`volumeVideo`) KHÔNG còn toàn cục — mỗi đoạn Video (`videoClips[i].volume`) tự
 *     mang volume RIÊNG của nó (0-2, 1 = 100%), xem `_buildMixedAudioTrack()`.
 *   - BỎ `_passThroughAudioTrack()` (copy packet không decode) — với nhiều đoạn Video nối tiếp,
 *     pass-through packet-level phức tạp hơn nhiều lợi ích mang lại; guard clause đầu hàm đã lo
 *     đúng trường hợp "không sửa gì cả" (trả nguyên bản gốc, không đụng Mediabunny) — mọi trường hợp
 *     CÒN LẠI (kể cả chỉ cắt đơn giản) đều qua decode+mix audio thật (Web Audio API), đổi lấy code
 *     đơn giản/đúng hơn, chấp nhận chi phí decode/encode audio cao hơn bản pass-through cũ.
 *
 * LƯU Ý KIỂM THỬ (như các bản trước): sandbox này KHÔNG chạy được trình duyệt thật, CHƯA verify
 * runtime — đặc biệt `AudioContext.decodeAudioData()` trên Blob của 1 file VIDEO (không phải audio
 * thuần) và `Mediabunny.AudioBufferSource` (tên/chữ ký theo tài liệu tại thời điểm viết).
 *
 * Rule 3 — chỉ gọi API thư viện ngoài (Mediabunny/WebCodecs/Web Audio), không gọi core nào khác
 * (kể cả `core/video-editor/timeline-calc.js` — công thức cộng dồn output-time được LẶP LẠI ở đây,
 * chấp nhận trùng lặp nhỏ thay vì Core gọi Core, cùng tiền lệ `_formatSeconds` mỗi trang tự viết riêng).
 * Rule 2 — không đọc `appState`.
 */

/** Vẽ ĐÚNG 1 khung (VideoSample) vào canvas, áp crop+rotate. [SỬA 24/07/2026, mục d] — bỏ tham số
 * `filterCss` (tính năng "Chỉnh" bỏ hẳn). @param {CanvasRenderingContext2D} ctx */
function _drawFrameToCanvas(ctx, sample, cropPx, rotateDeg, outW, outH) {
    ctx.save();
    ctx.clearRect(0, 0, outW, outH);
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rotateDeg * Math.PI) / 180);
    ctx.translate(-cropPx.w / 2, -cropPx.h / 2);
    ctx.translate(-cropPx.x, -cropPx.y);
    sample.draw(ctx, 0, 0);
    ctx.restore();
}

/** Vẽ đè 1 clip chữ lên canvas — gọi khi `outputTime` nằm trong `[timelineStart,timelineEnd)` của clip đó (Workflow/hàm cha tự so sánh, hàm này chỉ vẽ — Rule 1). ĐỒNG BỘ công thức với `drawTextOverlay()` (core/video-editor/preview-draw.js) để preview khớp CHÍNH XÁC kết quả xuất thật — xem docstring đầu file. */
function _drawTextOverlayToCanvas(ctx, outW, outH, text, outputTime) {
    ctx.save();
    const scaleF = outH / 1080;
    const finalSize = Math.round((text.size || 60) * scaleF);
    const weight = text.bold ? 'bold' : 'normal';
    const style = text.italic ? 'italic' : 'normal';
    const family = text.fontFamily || 'system-ui';
    ctx.font = `${style} ${weight} ${finalSize}px "${family}", -apple-system, Inter, sans-serif`;
    ctx.fillStyle = text.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let alpha = 1;
    if (text.transition === 'fade') {
        const FADE_SEC = 0.4;
        const clipDur = Math.max(0, text.timelineEnd - text.timelineStart);
        const fadeDur = Math.min(FADE_SEC, clipDur / 2);
        if (fadeDur > 0) {
            const distIn = outputTime - text.timelineStart;
            const distOut = text.timelineEnd - outputTime;
            alpha = Math.max(0, Math.min(1, Math.min(distIn, distOut) / fadeDur));
        }
    }
    ctx.globalAlpha = alpha;

    if (text.shadow !== false) {
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 4;
    }
    if (text.blur > 0) ctx.filter = `blur(${Math.round(text.blur * scaleF)}px)`;

    const cx = outW * ((text.posX ?? 50) / 100);
    const cy = outH * ((text.posY ?? 80) / 100);
    ctx.translate(cx, cy);
    ctx.rotate(((text.rotation || 0) * Math.PI) / 180);
    ctx.fillText(text.val, 0, 0);
    ctx.restore();
}

/**
 * Trộn TOÀN BỘ audio cho output: audio gốc của Video (lát theo từng đoạn `videoClips`, mỗi đoạn đặt
 * đúng vị trí OUTPUT của nó, KHUẾCH ĐẠI theo `clip.volume` RIÊNG của chính đoạn đó) + mọi clip trong
 * `audioClips` (đặt theo `timelineStart` riêng, cắt bớt nếu vượt `totalDuration` hoặc vượt chính độ
 * dài file nhạc gốc). Ghi kết quả vào `output` qua `Mediabunny.AudioBufferSource`. Hàm con phục vụ
 * `processVideo()` (Rule 3c).
 * [SỬA 24/07/2026, phản hồi Giang mục d] — Volume audio gốc của Video KHÔNG còn là 1 giá trị TOÀN
 * CỤC (`volumeVideo`, đã bỏ) — mỗi đoạn trong `videoClips` tự mang `volume` RIÊNG của nó (0-2, 1 =
 * 100%, mặc định 1 nếu thiếu — clip cũ trước bản cập nhật này chưa có field này).
 * @param {Blob} sourceBlob @param {boolean} hasOriginalAudio
 * @param {Array<{sourceStart:number,sourceEnd:number,volume:number}>} videoClips
 * @param {Array<{blob:Blob,offsetInSong:number,timelineStart:number,timelineEnd:number,volume:number}>} audioClips
 * @param {number} totalDuration - giây, tổng thời lượng OUTPUT (từ videoClips).
 * @param {any} output - Output (Mediabunny), CHƯA start().
 */
async function _buildMixedAudioTrack(sourceBlob, hasOriginalAudio, videoClips, audioClips, totalDuration, output) {
    if (totalDuration <= 0) return; // guard — không có gì để ghép
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const sampleRate = audioCtx.sampleRate;
    const offline = new OfflineAudioContext(2, Math.ceil(totalDuration * sampleRate), sampleRate);

    if (hasOriginalAudio) {
        const originalBuffer = await audioCtx.decodeAudioData(await sourceBlob.arrayBuffer());
        let cursor = 0; // cộng dồn vị trí OUTPUT của từng đoạn Video (LẶP LẠI công thức timeline-calc.js — xem Rule 3 ở docstring đầu file)
        for (const clip of videoClips) {
            const dur = Math.max(0, clip.sourceEnd - clip.sourceStart);
            if (dur > 0 && clip.sourceStart < originalBuffer.duration) {
                const src = offline.createBufferSource();
                src.buffer = originalBuffer;
                const gain = offline.createGain();
                gain.gain.value = clip.volume === undefined || clip.volume === null ? 1 : clip.volume;
                src.connect(gain).connect(offline.destination);
                const playDur = Math.min(dur, Math.max(0, originalBuffer.duration - clip.sourceStart));
                if (playDur > 0) src.start(cursor, clip.sourceStart, playDur);
            }
            cursor += dur;
        }
    }

    // Cache decode theo Blob (tránh decode lại CÙNG 1 bài hát dùng ở nhiều clip).
    const decodedSongCache = new Map();
    for (const clip of audioClips) {
        const clipStart = Math.max(0, clip.timelineStart);
        const clipEndClamped = Math.min(clip.timelineEnd, totalDuration); // GIỚI HẠN — cắt bỏ phần vượt tổng thời lượng Video
        const clipDuration = clipEndClamped - clipStart;
        if (clipDuration <= 0) continue; // guard — clip nằm hoàn toàn ngoài vùng Video (đã vượt quá, bỏ qua)
        let songBuffer = decodedSongCache.get(clip.blob);
        if (!songBuffer) {
            songBuffer = await audioCtx.decodeAudioData(await clip.blob.arrayBuffer());
            decodedSongCache.set(clip.blob, songBuffer);
        }
        const playDur = Math.min(clipDuration, Math.max(0, songBuffer.duration - clip.offsetInSong));
        if (playDur <= 0) continue;
        const src = offline.createBufferSource();
        src.buffer = songBuffer;
        const gain = offline.createGain();
        gain.gain.value = clip.volume;
        src.connect(gain).connect(offline.destination);
        src.start(clipStart, Math.max(0, clip.offsetInSong), playDur);
    }

    const mixedBuffer = await offline.startRendering();
    const audioSource = new Mediabunny.AudioBufferSource({ codec: 'aac', bitrate: Mediabunny.QUALITY_HIGH });
    output.addAudioTrack(audioSource);
    await audioSource.add(mixedBuffer);
    if (typeof audioSource.close === 'function') audioSource.close();
    if (typeof audioCtx.close === 'function') audioCtx.close();
}

/**
 * CỔNG DUY NHẤT xử lý video. Workflow gọi hàm này với tham số đã chuẩn bị sẵn (Rule 2).
 *
 * [SỬA 24/07/2026, phản hồi Giang mục d] — bỏ hẳn `filterCss`/`volumeVideo` TOÀN CỤC (tính năng
 * "Chỉnh" bỏ hẳn) — Volume audio gốc giờ đọc TRỰC TIẾP từ `clip.volume` của từng đoạn trong
 * `videoClips` (xem `_buildMixedAudioTrack()`).
 *
 * @param {object} params
 * @param {Blob} params.sourceBlob - video gốc.
 * @param {Array<{sourceStart:number,sourceEnd:number,volume:number}>} params.videoClips - các đoạn Video, THEO THỨ TỰ, nối tiếp nhau trên output, mỗi đoạn tự mang volume RIÊNG (0-2, 1 = 100%).
 * @param {{x,y,w,h}|null} params.cropFraction - toàn cục, tỉ lệ 0-1, null = không crop.
 * @param {number} params.rotateDeg - toàn cục, 0/90/180/270.
 * @param {Array<{val,size,color,posY,timelineStart,timelineEnd}>} params.textClips - giây OUTPUT, có thể rỗng.
 * @param {Array<{blob,offsetInSong,timelineStart,timelineEnd,volume}>} params.audioClips - giây OUTPUT, có thể rỗng.
 * @returns {Promise<Blob>} video mp4 đã xử lý.
 */
async function processVideo({ sourceBlob, videoClips, cropFraction, rotateDeg, textClips, audioClips }) {
    const clips = videoClips && videoClips.length ? videoClips : [];
    const noCrop = !cropFraction;
    const noRotate = !rotateDeg || rotateDeg % 360 === 0;
    const noText = !textClips || textClips.length === 0;
    const noAudioClips = !audioClips || audioClips.length === 0;
    const noVolumeChange = clips.every((c) => (c.volume === undefined || c.volume === null ? 1 : c.volume) === 1);

    const input = new Mediabunny.Input({ source: new Mediabunny.BlobSource(sourceBlob), formats: Mediabunny.ALL_FORMATS });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) throw new Error('[processVideo] file không có track video.');
    const fullSourceDuration = await videoTrack.computeDuration();
    const isSingleFullClip = clips.length === 1 && clips[0].sourceStart <= 0.001 && Math.abs(clips[0].sourceEnd - fullSourceDuration) <= 0.001;
    if (noCrop && noRotate && noText && noAudioClips && noVolumeChange && isSingleFullClip) return sourceBlob; // guard clause — không có gì để xử lý

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
    const totalDuration = clips.reduce((sum, c) => sum + Math.max(0, c.sourceEnd - c.sourceStart), 0);

    const canvas = document.createElement('canvas'); // canvas nội bộ, không gắn DOM (Rule 5 không áp dụng)
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');

    const output = new Mediabunny.Output({ format: new Mediabunny.Mp4OutputFormat(), target: new Mediabunny.BufferTarget() });
    const videoSource = new Mediabunny.CanvasSource(canvas, { codec: 'avc', bitrate: Mediabunny.QUALITY_HIGH });
    output.addVideoTrack(videoSource);
    await _buildMixedAudioTrack(sourceBlob, !!audioTrack, clips, audioClips || [], totalDuration, output); // addAudioTrack() PHẢI xong TRƯỚC output.start()

    await output.start();
    const sink = new Mediabunny.VideoSampleSink(videoTrack);
    let outputCursor = 0; // cộng dồn vị trí OUTPUT của từng đoạn (giống _buildMixedAudioTrack — Rule 3, chấp nhận trùng lặp nhỏ)
    for (const clip of clips) {
        const clipDuration = Math.max(0, clip.sourceEnd - clip.sourceStart);
        for await (const sample of sink.samples(clip.sourceStart, clip.sourceEnd)) {
            const outputTime = outputCursor + (sample.timestamp - clip.sourceStart);
            _drawFrameToCanvas(ctx, sample, cropPx, deg, outW, outH);
            if (!noText) {
                for (const text of textClips) {
                    if (outputTime >= text.timelineStart && outputTime < text.timelineEnd) _drawTextOverlayToCanvas(ctx, outW, outH, text, outputTime);
                }
            }
            await videoSource.add(outputTime, sample.duration);
            if (typeof sample.close === 'function') sample.close();
        }
        outputCursor += clipDuration;
    }
    if (typeof videoSource.close === 'function') videoSource.close();
    await output.finalize();

    return new Blob([output.target.buffer], { type: 'video/mp4' });
}
