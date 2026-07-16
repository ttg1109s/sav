/**
 * event/listener/file-manager-photo.js — TẤT CẢ listener của cụm "fileManagerPhoto".
 *
 * === Batch D6 (Settings restructure, 06/07/2026) ===
 * Panel Photo giờ push/pop động (core/settings-panel-stack.js) — TOÀN BỘ listener bên dưới (trừ
 * `btnOpenFileManagerPhoto`, Main tĩnh) ĐỔI sang delegation trên `settingsStackBody`, cùng CHUẨN
 * đã dùng ở Song (Batch D5). `btnBackFileManagerPhoto` ĐÃ XOÁ (Back dùng CHUNG).
 *
 * SỬA (14/07/2026, mục cuối) — nút "Tải ảnh lên" + "xoá nhanh" dời vào `headerActionHtml` (dựng
 * ĐỘNG lúc `openPanel()`, xem event/workflow/file-manager-photo.js::_wireHeaderActionEvents()) —
 * WIRE TRỰC TIẾP tại Workflow (KHÔNG qua eventBus cho riêng click mở input file — cùng quy ước "nút
 * động do Workflow tự dựng thì Workflow tự wire", xem docstring core/generic-drawer.js), block
 * delegated cũ cho `#btn-file-manager-image-upload-trigger` ĐÃ BỎ (tránh gọi `.click()` 2 lần).
 *
 * ĐẬP ĐI LÀM LẠI (Giai đoạn 3b, rewrite Photo/Album, mục 3a/4, Giang yêu cầu) — XOÁ HẲN delegation
 * cho story slider (`data-album-story-action`, `#file-manager-album-story-pagination-wrap`) và
 * thanh quản lý album inline (`#file-manager-album-manage-bar`) — THAY bằng Album List sub-panel
 * (`#btn-file-manager-open-album-list`, `#file-manager-album-filter-chip`, `#file-manager-album-list`
 * — vẫn delegated qua `settingsStackBody`, VÌ Album List sub-panel là panel push động, NẰM TRONG
 * `settingsStackBody` giống mọi panel khác). XOÁ delegation cho thanh chọn nhiều cũ
 * (`#btn-file-manager-image-selection-cancel/confirm`) — "thêm ảnh vào album" giờ là picker Generic
 * Drawer riêng, click grid của picker đó KHÔNG qua đây (Generic Drawer là ANH EM của `#app-stack`
 * trong `#app-root`, NẰM NGOÀI `settingsStackBody` — wire riêng TRỰC TIẾP trong
 * `workflowFileManagerPhoto.openAlbumImagePicker()`, xem file đó).
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (btnOpenFileManagerPhoto) {
    btnOpenFileManagerPhoto.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.openPanel.click', payload: {} });
    });
}

function handleFileManagerPhotoDelegatedClick(e) {
    // ===================== MỚI (Giai đoạn 3b) — panel Photo chính: mở Album List + bỏ lọc =========

    if (e.target.closest('#btn-file-manager-open-album-list')) {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.albumList.open.click', payload: {} });
        return;
    }
    if (e.target.closest('#btn-file-manager-album-filter-clear')) {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.albumFilter.clear.click', payload: {} });
        return;
    }

    // ===================== Album List sub-panel ==========================
    // VIẾT LẠI (Giang yêu cầu "làm giống y hệt Playlist UI, action ba chấm dropdown") — bỏ hẳn
    // `data-album-list-action` (4 icon rời cũ) — CHỈ còn nút "..." duy nhất (`data-album-menu-
    // action`), mở dropdown (core/dropdown-menu.js). `albumId` đọc từ DÒNG CHA (`[data-album-id]`,
    // đặt trên cả dòng — xem itemTemplateAlbumListRow(), components/items.js), KHÔNG còn đặt riêng
    // trên từng nút như trước (giờ chỉ có đúng 1 nút/dòng). `anchorBtn` truyền qua payload để dropdown
    // tự định vị — ĐÚNG tiền lệ `event/listener/playlist.js::'playlist.item.menuClick'`.

    const albumListCreateBtn = e.target.closest('#btn-file-manager-album-list-create');
    if (albumListCreateBtn) {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.albumList.create.click', payload: {} });
        return;
    }
    const albumListPaginationBtn = e.target.closest('#file-manager-album-list-pagination button[data-pagination-action="goto"]');
    if (albumListPaginationBtn) {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.albumList.page.click', payload: { pageIndex: Number(albumListPaginationBtn.dataset.pageIndex) } });
        return;
    }
    const albumMenuBtn = e.target.closest('button[data-album-menu-action]');
    if (albumMenuBtn) {
        const rowEl = albumMenuBtn.closest('[data-album-id]');
        if (rowEl) eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.albumList.menu.click', payload: { albumId: rowEl.dataset.albumId, anchorBtn: albumMenuBtn } });
        return;
    }

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
