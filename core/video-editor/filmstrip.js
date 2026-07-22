/**
 * core/video-editor/filmstrip.js — Core THUẦN (Rule 1-5 core-function-conventions.md), MỚI (phản
 * hồi Giang — "kéo dùng hình chữ nhật thẳng đứng như phần mềm biên tập mobile", thay hẳn cơ chế
 * time-picker-modal cũ cho Cut). Dùng `Mediabunny.CanvasSink` (đã có sẵn, không cần thư viện mới)
 * để trích N khung hình rải đều theo thời gian — Workflow ghép thành dải ảnh nền (filmstrip) cho
 * thanh kéo cắt video, để người dùng THẤY được cảnh tại mỗi điểm thay vì chỉ gõ số.
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
 * Trích `count` khung hình rải ĐỀU theo thời gian (kể cả điểm đầu/cuối) từ 1 Blob video.
 * @param {Blob} sourceBlob
 * @param {number} count - số khung hình cần trích.
 * @param {number} thumbWidth @param {number} thumbHeight - kích thước mỗi khung hình xuất ra (px).
 * @returns {Promise<Array<{timestamp:number, blob:Blob|null}>>} - `blob` null nếu khung đó lỗi (Workflow tự bỏ qua, không chặn cả dải).
 */
async function buildCutFilmstripFrames(sourceBlob, count, thumbWidth, thumbHeight) {
    const input = new Mediabunny.Input({ source: new Mediabunny.BlobSource(sourceBlob), formats: Mediabunny.ALL_FORMATS });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) return []; // guard — không có track video (không nên xảy ra, đã qua compat-guard trước đó)

    const sink = new Mediabunny.CanvasSink(videoTrack, { width: thumbWidth, height: thumbHeight });
    const startTimestamp = await videoTrack.getFirstTimestamp();
    const endTimestamp = await videoTrack.computeDuration();
    const span = Math.max(0, endTimestamp - startTimestamp);
    const timestamps = Array.from({ length: count }, (_, i) => startTimestamp + (count > 1 ? i / (count - 1) : 0) * span);

    const frames = [];
    for await (const result of sink.canvasesAtTimestamps(timestamps)) {
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
        frames.push({ timestamp: result.timestamp, blob });
    }
    return frames;
}
