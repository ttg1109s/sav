/**
 * core/video-editor/filmstrip.js — Core THUẦN (Rule 1-5 core-function-conventions.md), MỚI (phản
 * hồi Giang — "kéo dùng hình chữ nhật thẳng đứng như phần mềm biên tập mobile", thay hẳn cơ chế
 * time-picker-modal cũ cho Cut). Dùng `Mediabunny.CanvasSink` (đã có sẵn, không cần thư viện mới)
 * để trích N khung hình rải đều theo thời gian — Workflow ghép thành dải ảnh nền (filmstrip) cho
 * thanh kéo cắt video, để người dùng THẤY được cảnh tại mỗi điểm thay vì chỉ gõ số. GIỮ NGUYÊN sau
 * khi Video Editor NLE xoá hẳn — nơi gọi giờ là `event/workflow/video-preview.js::open()`
 * ("Song/Video Unification" v12, gộp vào Modal xem Video, đúng khuôn modal xem Ảnh).
 *
 * NẠP SAU: Mediabunny (CDN/vendor, script tag, global `Mediabunny`).
 * Rule 3 — chỉ gọi API thư viện ngoài (Mediabunny), không gọi core nào khác của project.
 * Rule 2 — không đọc `appState`.
 *
 * GHI CHÚ KIỂM THỬ: `CanvasSink.canvasesAtTimestamps()` trả về canvas/OffscreenCanvas theo tài
 * liệu Mediabunny — hàm dưới đây CHỦ Ý vẽ lại (`drawImage`) vào 1 `<canvas>` tự tạo trước khi
 * `toBlob()`, để không phụ thuộc chính xác kiểu trả về là gì (`drawImage` nhận cả 2 loại) — CHƯA
 * verify runtime (sandbox này không chạy được trình duyệt thật).
 */

/**
 * Trích khung hình dải phim từ 1 Blob video. SỬA (06/10/2026, Giang #4: "lấy tổng time của video / 10 lấy được các mốc
 * khung ảnh") — `count` ô chia ĐỀU thời lượng, ô thứ i lấy khung tại mốc `start + (i + offsetFraction) / count × span`
 * (mặc định offsetFraction = 0 -> mốc 0, span/count, 2·span/count... — KHÔNG còn lấy đúng mốc CUỐI file như bản cũ
 * `i/(count-1)`, mốc đó hay không có khung -> ô đen). `options.indices` (tuỳ chọn) = chỉ trích các ô này — Workflow dùng
 * để trích LẠI những ô còn thiếu ảnh, với `offsetFraction` khác (vd 0.5 = giữa ô).
 * @param {Blob} sourceBlob
 * @param {number} count - số ô của cả dải.
 * @param {number} thumbWidth @param {number} thumbHeight - kích thước mỗi khung hình xuất ra (px).
 * @param {(done:number, total:number) => void} [onProgress] - gọi sau MỖI khung trích xong.
 * @param {{indices?: number[], offsetFraction?: number}} [options]
 * @returns {Promise<Array<{index:number, timestamp:number|null, blob:Blob|null}>>} - theo đúng thứ tự `indices` (mặc định
 *   0..count-1); `blob` null nếu khung đó lỗi/không có (Workflow tự xử lý, không chặn cả dải).
 */
async function buildCutFilmstripFrames(sourceBlob, count, thumbWidth, thumbHeight, onProgress, options) {
    const opts = options || {};
    const indices = opts.indices || Array.from({ length: count }, (_, i) => i);
    const offsetFraction = opts.offsetFraction || 0;
    const input = new Mediabunny.Input({ source: new Mediabunny.BlobSource(sourceBlob), formats: Mediabunny.ALL_FORMATS });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) { if (typeof input.dispose === 'function') input.dispose(); return []; } // guard — không có track video (không nên xảy ra, đã qua compat-guard trước đó)

    const sink = new Mediabunny.CanvasSink(videoTrack, { width: thumbWidth, height: thumbHeight });
    const startTimestamp = await videoTrack.getFirstTimestamp();
    const endTimestamp = await videoTrack.computeDuration();
    const span = Math.max(0, endTimestamp - startTimestamp);
    const timestamps = indices.map((i) => startTimestamp + ((i + offsetFraction) / count) * span);

    const frames = [];
    for await (const result of sink.canvasesAtTimestamps(timestamps)) {
        const index = indices[frames.length];
        // Phase 1 — bản Mediabunny mới có thể trả `null` cho mốc không có khung hình -> giữ ô trống, không crash cả dải.
        if (!result) { frames.push({ index, timestamp: null, blob: null }); if (onProgress) onProgress(frames.length, indices.length); continue; }
        let blob = null;
        try {
            const out = document.createElement('canvas'); // canvas nội bộ, KHÔNG gắn DOM — chỉ làm bộ đệm pixel (Rule 5 không áp dụng)
            out.width = thumbWidth;
            out.height = thumbHeight;
            out.getContext('2d').drawImage(result.canvas, 0, 0, thumbWidth, thumbHeight);
            blob = await new Promise((resolve) => out.toBlob(resolve, 'image/jpeg', 0.7));
        } catch (err) {
            console.error('[buildCutFilmstripFrames] lỗi vẽ 1 khung hình filmstrip, bỏ qua khung đó:', err);
        }
        frames.push({ index, timestamp: result.timestamp, blob });
        if (onProgress) onProgress(frames.length, indices.length);
    }
    // MỚI (Phase 1) — giải phóng tài nguyên đọc file (trước đây Input không bao giờ được dispose).
    if (typeof input.dispose === 'function') input.dispose();
    return frames;
}
