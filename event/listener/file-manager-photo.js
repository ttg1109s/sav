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

    // ===================== MỚI (Giai đoạn 3b) — Album List sub-panel ==========================
    // Check `data-album-list-action` (icon) — vùng tên/số lượng KHÔNG còn bấm được nữa (fix bug 2,
    // Giang yêu cầu "ấn vào album lại ra sub panel -> bỏ" — xem itemTemplateAlbumListRow(),
    // components/items.js).

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
    const albumListActionBtn = e.target.closest('button[data-album-list-action]');
    if (albumListActionBtn && e.target.closest('#file-manager-album-list')) {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.albumList.action.click', payload: { action: albumListActionBtn.dataset.albumListAction, albumId: albumListActionBtn.dataset.albumId } });
        return;
    }

    // ===================== Lưới ảnh (Patch mục 2, 14/07/2026 — Item + window ảo, THAY masonry cũ) ==
    const tile = e.target.closest('button[data-image-key]');
    if (tile && e.target.closest('#file-manager-image-masonry')) {
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
