/**
 * core/video-editor/compat-guard.js — Core THUẦN (Rule 1-5 core-function-conventions.md), MỚI
 * (Batch 1, module Video Editor). Kiểm tra 1 file video CÓ giải mã được bằng WebCodecs (qua
 * Mediabunny) hay không — chạy lúc MỞ `video-editor.html`, TÁCH BIỆT HẲN với guard lúc upload
 * (`event/workflow/file-manager-video.js::_extractVideoThumbAndMeta()` — guard đó chỉ kiểm tra thẻ
 * `<video>` PHÁT được, KHÔNG đảm bảo WebCodecs giải mã được cùng file, xem thảo luận đã chốt với
 * Giang trước khi viết Batch này).
 *
 * LÝ DO CẦN GUARD RIÊNG: `<video>` dùng decoder nền tảng (thường hỗ trợ rộng hơn), còn
 * `VideoDecoder` (WebCodecs) chỉ hỗ trợ 1 tập hẹp hơn (H.264 rộng nhất; VP9/AV1/HEVC tuỳ máy) — 1
 * video có thể PHÁT được (qua guard upload) nhưng KHÔNG giải mã được ở đây.
 *
 * NẠP SAU: Mediabunny (CDN/vendor, script tag, global `Mediabunny`).
 *
 * Rule 3 — file này KHÔNG gọi core nào khác của project, chỉ gọi API thư viện ngoài (Mediabunny,
 * WebCodecs) — không tính là "core gọi core" (Rule 3 chỉ cấm gọi core TỰ VIẾT của project).
 * Rule 2 — không đọc `appState` (trang `video-editor.html` không dùng `appState`, cùng lý do
 * `image-edit.html`/`subtitle-editor.html` — state của trang này sống trong `workflowVideoEditor`).
 */

/**
 * Kiểm tra 1 Blob video có mở được (đúng container Mediabunny nhận diện) VÀ track video chính có
 * giải mã được bằng WebCodecs hay không (`InputVideoTrack.canDecode()` — Mediabunny tự gọi
 * `VideoDecoder.isConfigSupported()` bên trong, không cần tự viết lại).
 * @param {Blob} videoBlob
 * @returns {Promise<{ supported: true, videoTrack: object, audioTrack: object|null } | { supported: false, reason: string }>}
 */
async function checkVideoEditorCompat(videoBlob) {
    // MỚI (phản hồi Giang — "rõ là H.264 vẫn không mở được", cần phân biệt 2 nguyên nhân KHÁC hẳn
    // nhau: (a) CDN Mediabunny tải lỗi (404/mạng) — sửa được bằng cách đổi lại URL CDN, KHÔNG liên
    // quan trình duyệt/codec; (b) trình duyệt thật sự không có WebCodecs — không sửa được. Trước
    // đây gộp chung 1 lý do 'unsupportedBrowser' → hiểu lầm là do định dạng/trình duyệt, trong khi
    // rất có thể chỉ là script CDN chưa tải xong/lỗi 404.
    if (typeof Mediabunny === 'undefined') {
        console.error('[checkVideoEditorCompat] window.Mediabunny không tồn tại — script CDN Mediabunny CHƯA TẢI ĐƯỢC (kiểm tra tab Network / debug console: 404? sai URL? mất mạng?).');
        return { supported: false, reason: 'mediabunnyNotLoaded' };
    }
    if (typeof VideoDecoder === 'undefined') {
        return { supported: false, reason: 'unsupportedBrowser' }; // Mediabunny CÓ tải được nhưng trình duyệt thật sự không có WebCodecs (vd Firefox Android, Safari quá cũ)
    }
    let input;
    try {
        input = new Mediabunny.Input({ source: new Mediabunny.BlobSource(videoBlob), formats: Mediabunny.ALL_FORMATS });
        const videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) return { supported: false, reason: 'noVideoTrack' };
        const decodable = await videoTrack.canDecode();
        if (!decodable) return { supported: false, reason: 'codecNotSupported' };
        const audioTrack = await input.getPrimaryAudioTrack(); // có thể null — video câm vẫn hợp lệ
        return { supported: true, videoTrack, audioTrack: audioTrack || null };
    } catch (err) {
        console.error('[checkVideoEditorCompat] không đọc được file bằng Mediabunny:', err);
        return { supported: false, reason: 'unreadableFile' };
    }
}
