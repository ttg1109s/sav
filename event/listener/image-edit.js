/**
 * event/listener/image-edit.js — miền "imageEdit". CỐ Ý RỖNG: không có DOM tĩnh/delegated nào cần
 * lắng nghe ở đây — cả 3 điểm bắn `eventBus.send({ router: 'imageEdit', ... })` đều là nút ĐỘNG, tự
 * wire trực tiếp tại nơi dựng ra nó (Rule 5a, core-function-conventions.md):
 *   - `toolsBtn` (header modal xem ảnh) — core/file-manager/photo-ui.js.
 *   - Item "Edit" (dropdown "...") — event/workflow/file-manager-photo.js::openImageActionMenu().
 *   - Tile trong lưới tool (Generic Drawer) — event/workflow/image-edit.js::
 *     _wireEditToolGridDelegation().
 * Giữ file này (thay vì bỏ hẳn) để khớp quy ước 1 router luôn có đủ bộ 3 listener/router/workflow,
 * và làm chỗ chứa sẵn nếu sau này Edit mode có DOM tĩnh cần delegate.
 */
