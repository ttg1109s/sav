/**
 * event/listener/video-preview.js — miền "videoPreview".
 *
 * CHỈ 2 listener TĨNH THẬT SỰ (`document.pointermove`/`document.pointerup`, theo dõi TIẾP quá
 * trình kéo tay cầm Start/End trên dải phim SAU khi đã 'pointerdown' — tay cầm nhỏ, ngón tay dễ
 * trượt ra ngoài, PHẢI theo dõi trên `document` mới không mất dấu, đúng khuôn `event/listener/
 * image-edit.js::floatingText` drag). Bắn LIÊN TỤC bất kể có đang kéo hay không (mọi cử động
 * chuột/chạm TRÊN TOÀN APP) — Router/Workflow (`videoPreview`) tự đọc `videoPreviewActiveDrag`
 * rồi quyết định làm gì tiếp (thường sớm return nếu null), cùng đánh đổi đã ghi nhận ở
 * event/listener/image-edit.js (Rule 5a không có ngoại lệ theo tần suất event).
 *
 * Mọi điểm bắn eventBus({ router: 'videoPreview', ... }) KHÁC đều là nút/canvas ĐỘNG, tự wire
 * TRỰC TIẾP tại nơi dựng ra nó (core/file-manager/video-ui.js::openVideoPreviewModal(), Rule 5a):
 * closeBtn/saveBtn/scrubInputEl/rotateLeftBtn/rotateRightBtn/resetBtn/extractBtn/startHandleEl/
 * endHandleEl ('pointerdown' — CHỈ báo bắt đầu kéo, theo dõi tiếp mới ở đây)/cropCanvasEl
 * (pointerdown/move/up/leave — tự đủ, KHÔNG cần document vì canvas gần như phủ kín preview, cùng
 * khuôn `interactCanvas` ở core/file-manager/photo-ui.js).
 *
 * NẠP SAU: event/bus.js, event/router/video-preview.js, event/workflow/video-preview.js.
 */
document.addEventListener('pointermove', (e) => {
    eventBus.send({ router: 'videoPreview', type: 'videoPreview.trimDrag.move', payload: { clientX: e.clientX } });
});
document.addEventListener('pointerup', () => {
    eventBus.send({ router: 'videoPreview', type: 'videoPreview.trimDrag.end', payload: {} });
});
