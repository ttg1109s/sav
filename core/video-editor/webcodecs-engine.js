/**
 * core/video-editor/webcodecs-engine.js — Core THUẦN (Rule 1-5 core-function-conventions.md), MỚI
 * (Batch 1, module Video Editor). ĐÂY LÀ CỔNG DUY NHẤT xử lý video thật (crop/rotate/filter "nướng"
 * vào file) — Workflow (`event/workflow/video-editor.js`) CHỈ gọi đúng 1 hàm `processVideo(params)`
 * ở đây, không biết/không cần biết bên trong dùng WebCodecs hay engine gì khác.
 *
 * QUYẾT ĐỊNH ĐÃ CHỐT VỚI GIANG (không lặp lại ở đây, xem hội thoại): dùng WebCodecs + Mediabunny
 * (KHÔNG dùng FFmpeg.wasm) — nhẹ hơn nhiều, đổi lại rủi ro tương thích trình duyệt/định dạng ĐÃ
 * được chặn trước bằng `core/video-editor/compat-guard.js` (chạy lúc mở trang, TRƯỚC khi tới hàm
 * này). Engine có thể đổi sau (xem docstring hàm `processVideo()`) mà KHÔNG cần sửa Workflow/UI.
 *
 * PHẠM VI BATCH 1: chỉ crop/rotate/filter màu (brightness/contrast/saturation). Audio giữ NGUYÊN
 * VẸN qua cơ chế "pass-through" (copy thẳng packet đã encode sẵn, KHÔNG decode/re-encode lại —
 * đúng khuyến nghị chính thức của WebCodecs cho trường hợp không cần sửa âm thanh) — trộn nhạc mới/
 * chỉnh volume thuộc Batch 3, sẽ thay đúng đoạn pass-through này bằng bước mix thật.
 *
 * NẠP SAU: Mediabunny (CDN/vendor, script tag, global `Mediabunny`) — bản thân Mediabunny bọc quanh
 * WebCodecs (VideoDecoder/VideoEncoder toàn cục của trình duyệt), không cần nạp gì thêm.
 *
 * LƯU Ý KIỂM THỬ (thành thật với Giang): các tên thuộc tính/phương thức Mediabunny dưới đây viết
 * theo tài liệu chính thức (mediabunny.dev) tại thời điểm viết — sandbox này KHÔNG chạy được trình
 * duyệt thật nên CHƯA tự verify runtime. Đặc biệt đoạn lấy `codec` string cho audio pass-through
 * (đánh dấu rõ bên dưới) nên kiểm tra lại qua TypeScript autocomplete khi Giang test file thật.
 *
 * Rule 3 — chỉ gọi API thư viện ngoài (Mediabunny/WebCodecs), không gọi core nào khác của project.
 * Rule 2 — không đọc `appState` (trang `video-editor.html` không dùng `appState`).
 */

/**
 * Vẽ ĐÚNG 1 khung hình (VideoSample) vào canvas đích, áp filter màu + crop + rotate cùng lúc qua
 * biến đổi hệ toạ độ canvas — hàm con CHỈ phục vụ vòng lặp của `processVideo()` (Rule 3c: kết quả
 * (đã vẽ lên canvas) không phải 1 giá trị hoàn chỉnh tách biệt, phải có core cha (processVideo, lo
 * encode + ghép audio) xử lý tiếp mới thành video thật — hợp lệ làm hàm con).
 * @param {CanvasRenderingContext2D} ctx
 * @param {any} sample - VideoSample (Mediabunny), có `.draw(ctx, x, y)`.
 * @param {{x:number,y:number,w:number,h:number}} cropPx - vùng crop, ĐƠN VỊ PX theo kích thước gốc.
 * @param {number} rotateDeg - 0/90/180/270.
 * @param {string} filterCss - chuỗi CSS filter (vd "brightness(110%) contrast(100%) saturate(100%)").
 * @param {number} outW @param {number} outH - kích thước canvas ĐÍCH (đã tính sẵn theo rotate).
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
 * Copy nguyên vẹn track audio từ input sang output — KHÔNG decode/re-encode (pass-through đúng
 * khuyến nghị WebCodecs khi không cần sửa âm thanh). Hàm con phục vụ `processVideo()` — kết quả
 * (side-effect ghi vào audioSource) không có ý nghĩa độc lập, luôn phải đi kèm phần video của core
 * cha mới thành video hoàn chỉnh (Rule 3c, hợp lệ làm hàm con).
 * @param {any} audioTrack - InputAudioTrack (Mediabunny) hoặc null (video câm).
 * @param {any} output - Output (Mediabunny), CHƯA gọi `start()`.
 */
async function _passThroughAudioTrack(audioTrack, output) {
    if (!audioTrack) return; // guard — video không có track audio, bỏ qua, KHÔNG lỗi
    // GHI CHÚ KIỂM THỬ: `audioTrack.codec` là ức đoán DỰA TRÊN tài liệu (tương tự cách
    // `AudioBufferSource({ codec: 'aac' })` dùng mã ngắn) — kiểm tra lại đúng tên field khi test
    // thật, có thể cần đổi thành `(await audioTrack.getDecoderConfig()).codec` rồi map sang mã
    // ngắn Mediabunny nếu API thực tế khác tài liệu đã đọc được.
    const codec = audioTrack.codec || (await audioTrack.getDecoderConfig())?.codec;
    const audioSource = new Mediabunny.EncodedAudioPacketSource(codec);
    output.addAudioTrack(audioSource);
    const sink = new Mediabunny.EncodedPacketSink(audioTrack);
    for await (const packet of sink.packets()) {
        await audioSource.add(packet);
    }
    if (typeof audioSource.close === 'function') audioSource.close();
}

/**
 * CỔNG DUY NHẤT xử lý video (Batch 1: crop/rotate/filter). Workflow gọi hàm này với đầy đủ tham số
 * đã chuẩn bị sẵn (không tự `appState.get()`/DOM nào ở đây — đúng Rule 2).
 *
 * SAU NÀY ĐỔI ENGINE (vd chuyển sang FFmpeg.wasm) — CHỈ viết lại THÂN hàm này, giữ NGUYÊN chữ ký
 * (tham số vào/Blob ra) — Workflow/UI không cần sửa gì (xem thảo luận đã chốt với Giang).
 *
 * @param {object} params
 * @param {Blob} params.sourceBlob - video gốc.
 * @param {{x:number,y:number,w:number,h:number}|null} params.cropFraction - vùng crop theo TỈ LỆ
 *   (0-1) so với kích thước hiển thị gốc — null = không crop (dùng nguyên khung hình).
 * @param {number} params.rotateDeg - 0/90/180/270 (độ xoay THÊM, không phải rotation có sẵn của
 *   file gốc — `VideoSample.draw()` được kỳ vọng tự áp rotation gốc, xem ghi chú kiểm thử ở trên).
 * @param {string} params.filterCss - chuỗi CSS filter đã "nướng" (brightness/contrast/saturation).
 * @returns {Promise<Blob>} video đã xử lý xong, định dạng mp4.
 */
async function processVideo({ sourceBlob, cropFraction, rotateDeg, filterCss }) {
    const noCrop = !cropFraction;
    const noRotate = !rotateDeg || rotateDeg % 360 === 0;
    const noFilter = !filterCss || filterCss === 'none' || filterCss.trim() === '';
    if (noCrop && noRotate && noFilter) return sourceBlob; // guard clause — không có gì để xử lý, trả nguyên bản gốc

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

    const canvas = document.createElement('canvas'); // canvas nội bộ, KHÔNG gắn vào DOM — chỉ dùng làm bộ đệm pixel cho encode, không phải "dựng UI tương tác" (Rule 5 không áp dụng)
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');

    const output = new Mediabunny.Output({ format: new Mediabunny.Mp4OutputFormat(), target: new Mediabunny.BufferTarget() });
    const videoSource = new Mediabunny.CanvasSource(canvas, { codec: 'avc', bitrate: Mediabunny.QUALITY_HIGH });
    output.addVideoTrack(videoSource);
    await _passThroughAudioTrack(audioTrack, output); // gọi TRƯỚC output.start() — addAudioTrack() phải xong trước khi start (xem Quick start Mediabunny)

    await output.start();
    const sink = new Mediabunny.VideoSampleSink(videoTrack);
    for await (const sample of sink.samples()) {
        _drawFrameToCanvas(ctx, sample, cropPx, deg, filterCss, outW, outH);
        await videoSource.add(sample.timestamp, sample.duration);
        if (typeof sample.close === 'function') sample.close();
    }
    if (typeof videoSource.close === 'function') videoSource.close();
    await output.finalize();

    return new Blob([output.target.buffer], { type: 'video/mp4' });
}
