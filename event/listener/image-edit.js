/**
 * event/listener/image-edit.js — miền "imageEdit".
 *
 * MỚI (31/07/2026, Giang chỉ ra "Nhóm B không có ngoại lệ, phải dời hết vào đúng tầng") —
 * `document.pointermove`/`document.pointerup` theo dõi quá trình kéo `floatingText` (tool Text) —
 * ĐÂY LÀ DOM TĨNH THẬT SỰ (`document` không tự mất/tái tạo theo modal, KHÁC hẳn `interactCanvas`/
 * `floatingText` — 2 phần tử ĐÓ mới đúng "DOM động", tự wire trong core/file-manager/photo-ui.js
 * mỗi lần dựng modal). Nếu wire 2 listener này bên trong hàm dựng modal (chạy lại mỗi lần mở ảnh)
 * sẽ CHỒNG CHẤT qua nhiều lần mở/đóng — phải wire ĐÚNG 1 LẦN DUY NHẤT ở đây, đúng tầng Listener.
 *
 * Callback CHỈ `eventBus.send()` — bắn LIÊN TỤC bất kể có đang kéo Text hay không (mọi cử động
 * chuột/chạm TRÊN TOÀN APP, không chỉ lúc Photo Edit mở) — Router/Workflow (`imageEdit`) tự đọc
 * trạng thái đang kéo hay không rồi quyết định làm gì tiếp (thường là không làm gì, sớm return).
 * ĐÂY LÀ ĐÁNH ĐỔI THẬT — chi phí dispatch nhỏ nhưng KHÔNG bằng 0, chạy toàn app, mọi lúc — ghi nhận
 * rõ ràng thay vì giấu đi, đúng tài liệu (Rule 5a không có ngoại lệ theo tần suất event).
 */
document.addEventListener('pointermove', (e) => {
    eventBus.send({ router: 'imageEdit', type: 'imageEdit.floatingText.pointerMove', payload: { x: e.clientX, y: e.clientY } });
});
document.addEventListener('pointerup', () => {
    eventBus.send({ router: 'imageEdit', type: 'imageEdit.floatingText.pointerUp', payload: {} });
});

// Các điểm bắn eventBus({ router: 'imageEdit', ... }) KHÁC đều là nút/canvas ĐỘNG, tự wire trực
// tiếp tại nơi dựng ra nó (core/file-manager/photo-ui.js::openImagePreviewModal(), Rule 5a):
// toolsBtn/contextCancelBtn/contextApplyBtn/adjustDoneBtn/drawBrushBtn/drawEraserBtn/interactCanvas
// (pointerdown/move/up/leave)/floatingText (pointerdown)/adjustSliderEl/magicSliderEl (input). Item
// "Edit" (dropdown "...") wire ở event/workflow/file-manager-photo.js::openImageActionMenu(). Tile
// lưới tool (Generic Drawer) wire ở core/file-manager/photo-ui.js::
// wirePhotoEditToolGridDelegation().

