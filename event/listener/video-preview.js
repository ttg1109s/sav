/**
 * event/listener/video-preview.js — miền "videoPreview".
 *
 * 4 listener TĨNH THẬT SỰ trên `document` — theo dõi TIẾP các thao tác kéo bắt đầu bằng
 * 'pointerdown' trên phần tử ĐỘNG (tay cầm Start/End, dải trim, canvas Crop): phần tử khởi điểm nhỏ
 * hoặc không phủ hết vùng thao tác, ngón tay dễ trượt ra ngoài giữa chừng — PHẢI theo dõi trên
 * `document` mới không mất dấu, đúng khuôn `event/listener/image-edit.js::floatingText` drag. Bắn
 * LIÊN TỤC bất kể có đang kéo hay không (mọi cử động chuột/chạm TRÊN TOÀN APP) — Router/Workflow
 * (`videoPreview`) tự đọc `videoPreviewActiveDrag`/`videoPreviewCropSession.activeHandle` rồi quyết
 * định làm gì tiếp (thường sớm return nếu rỗng), cùng đánh đổi đã ghi nhận ở event/listener/
 * image-edit.js (Rule 5a không có ngoại lệ theo tần suất event).
 *
 * SỬA (05/08/2026, phản hồi Giang đợt 4 — "crop không kéo được") — 2 listener CROP MỚI thêm ở đây.
 * TRƯỚC ĐÓ `cropCanvasEl` tự lắng nghe pointermove/pointerup/pointerleave TRÊN CHÍNH NÓ (docstring cũ
 * tự nhận "canvas phủ kín preview nên không cần document, giống `interactCanvas` core/file-manager/
 * photo-ui.js") — SAI: canvas chỉ khớp đúng vùng ẢNH THẬT của video (`_syncCropCanvasBox()`), có thể
 * nhỏ hơn màn hình nhiều tuỳ tỉ lệ video, ngón tay trượt ra khỏi biên canvas giữa chừng là mất dấu
 * hoàn toàn (không `setPointerCapture`) — ĐÚNG lý do 2 tay cầm Start/End đã dùng `document` từ đầu,
 * Crop lại không được áp dụng cùng lý do dù cùng bản chất. Xem chi tiết ở event/workflow/
 * video-preview.js::_syncCropCanvasBox()/handleCropCanvasPointerDown().
 *
 * Mọi điểm bắn eventBus({ router: 'videoPreview', ... }) KHÁC đều là nút/canvas ĐỘNG, tự wire
 * TRỰC TIẾP tại nơi dựng ra nó (core/file-manager/video-ui.js::openVideoPreviewModal(), Rule 5a):
 * closeBtn/saveBtn/rotateBtn/resetBtn/startHandleEl/endHandleEl/filmstripTrackEl
 * ('pointerdown' — CHỈ báo bắt đầu kéo/tua, theo dõi tiếp mới ở đây)/cropCanvasEl ('pointerdown' —
 * CHỈ báo bắt đầu + hit-test, theo dõi tiếp mới ở đây).
 *
 * NẠP SAU: event/bus.js, event/router/video-preview.js, event/workflow/video-preview.js.
 */
document.addEventListener('pointermove', (e) => {
    eventBus.send({ router: 'videoPreview', type: 'videoPreview.trimDrag.move', payload: { clientX: e.clientX } });
});
document.addEventListener('pointerup', () => {
    eventBus.send({ router: 'videoPreview', type: 'videoPreview.trimDrag.end', payload: {} });
});
document.addEventListener('pointermove', (e) => {
    eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropCanvas.pointerMove', payload: { clientX: e.clientX, clientY: e.clientY } });
});
document.addEventListener('pointerup', () => {
    eventBus.send({ router: 'videoPreview', type: 'videoPreview.cropCanvas.pointerUp', payload: {} });
});
