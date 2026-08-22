/**
 * event/listener/file-manager-photo.js — TẤT CẢ listener của cụm "fileManagerPhoto".
 *
 * Panel Photo push/pop động (core/settings-panel-stack.js) — TOÀN BỘ listener bên dưới (trừ
 * `btnOpenFileManagerPhoto`, Main tĩnh) delegation trên `settingsStackBody`.
 *
 * Nút "Tải ảnh lên" + "xoá nhanh" nằm trong `headerActionHtml` (dựng ĐỘNG lúc `openPanel()`) —
 * WIRE TRỰC TIẾP tại Workflow (KHÔNG qua eventBus cho riêng click mở input file — cùng quy ước "nút
 * động do Workflow tự dựng thì Workflow tự wire", xem docstring core/generic-drawer.js).
 *
 * XOÁ (loại bỏ Album khỏi Photo Panel) — toàn bộ delegation cho Album List sub-panel
 * (`#btn-file-manager-open-album-list`/`#file-manager-album-filter-chip`/`#file-manager-album-list`/
 * `[data-album-id]`/`data-album-menu-action`) bỏ hẳn cùng tính năng. Picker Generic Drawer (chọn 1
 * ảnh, vd "Ảnh bìa"/Theme Background) sống NGOÀI `settingsStackBody` (Generic Drawer là ANH EM của
 * `#app-stack` trong `#app-root`) — click grid của picker đó KHÔNG qua đây, wire riêng TRỰC TIẾP
 * trong `workflowFileManagerPhoto._openImagePickerDrawer()`, xem file đó.
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (btnOpenFileManagerPhoto) {
    btnOpenFileManagerPhoto.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.openPanel.click', payload: {} });
    });
}

function handleFileManagerPhotoDelegatedClick(e) {
    // ===================== Lưới ảnh (event/workflow/photo-gallery-window.js — thay masonry/windowing tự viết cũ) ==
    // SỬA (rewrite Photo/Album, dùng fjGallery) — tile giờ là `<div class="fj-gallery-item">` (đúng
    // cấu trúc fjGallery yêu cầu), KHÔNG còn `<button>` như bản windowing tự viết cũ — selector đổi
    // theo, bỏ ràng buộc tag.
    const tile = e.target.closest('[data-image-key]');
    if (tile && e.target.closest('.photo-gallery-window')) {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.image.click', payload: { imageKey: tile.dataset.imageKey } });
        return;
    }
}

function handleFileManagerPhotoDelegatedChange(e) {
    if (e.target.id === 'file-manager-image-upload-input') {
        if (e.target.files.length === 0) return; // bấm Huỷ trên hộp thoại chọn file
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.upload.change', payload: { files: e.target.files } });
    }
}

if (settingsStackBody) {
    settingsStackBody.addEventListener('click', handleFileManagerPhotoDelegatedClick);
    settingsStackBody.addEventListener('change', handleFileManagerPhotoDelegatedChange);
}
