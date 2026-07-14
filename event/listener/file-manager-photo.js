/**
 * event/listener/file-manager-photo.js — TẤT CẢ listener của cụm "fileManagerPhoto".
 *
 * === Batch D6 (Settings restructure, 06/07/2026) ===
 * Panel Photo giờ push/pop động (core/settings-panel-stack.js) — TOÀN BỘ listener bên dưới (trừ
 * `btnOpenFileManagerPhoto`, Main tĩnh) ĐỔI sang delegation trên `settingsStackBody`, cùng CHUẨN
 * đã dùng ở Song (Batch D5). `btnBackFileManagerPhoto` ĐÃ XOÁ (Back dùng CHUNG).
 *
 * Nút "Tải ảnh lên" (`#btn-file-manager-image-upload-trigger`) chỉ CLICK HỘ input file ẩn kế bên
 * (`#file-manager-image-upload-input`) — thao tác DOM proxy thuần, KHÔNG cần round-trip qua
 * eventBus/router (router cũ cũng chỉ gọi thẳng `.click()`, không có logic nghiệp vụ nào).
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (btnOpenFileManagerPhoto) {
    btnOpenFileManagerPhoto.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.openPanel.click', payload: {} });
    });
}

function handleFileManagerPhotoDelegatedClick(e) {
    // ===================== Story slider Album (Batch 3) =====================
    const storyBtn = e.target.closest('button[data-album-story-action]');
    if (storyBtn && e.target.closest('#file-manager-album-story')) {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.album.storyClick', payload: { action: storyBtn.dataset.albumStoryAction, albumId: storyBtn.dataset.albumId } });
        return;
    }

    // ===================== Thanh quản lý album đang lọc =====================
    if (e.target.closest('#file-manager-album-manage-bar')) {
        const btn = e.target.closest('button[id]');
        if (!btn) return;
        const actionById = {
            'btn-file-manager-album-add-images': 'addImages',
            'btn-file-manager-album-set-slideshow-bg': 'setSlideshowBg',
            'btn-file-manager-album-rename': 'rename',
            'btn-file-manager-album-delete': 'delete',
        };
        const action = actionById[btn.id];
        if (!action) return; // bấm trúng phần tử khác trong thanh (vd tên album) -> không gửi gì cả
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.album.manageClick', payload: { action } });
        return;
    }

    // ===================== Lưới ảnh (Patch mục 2, 14/07/2026 — Item + window ảo, THAY masonry cũ) ==
    const tile = e.target.closest('button[data-image-key]');
    if (tile && e.target.closest('#file-manager-image-masonry')) {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.image.click', payload: { imageKey: tile.dataset.imageKey } });
        return;
    }

    // ===================== Thanh hành động chọn nhiều =====================
    if (e.target.closest('#btn-file-manager-image-selection-cancel')) {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imageSelection.cancel', payload: {} });
        return;
    }
    if (e.target.closest('#btn-file-manager-image-selection-confirm')) {
        eventBus.send({ router: 'fileManagerPhoto', type: 'fileManagerPhoto.imageSelection.confirm', payload: {} });
        return;
    }

    // ===================== Upload (DOM proxy thuần, không qua eventBus) =====================
    if (e.target.closest('#btn-file-manager-image-upload-trigger')) {
        const panel = e.target.closest('.settings-stack-panel');
        const input = panel ? panel.querySelector('#file-manager-image-upload-input') : null;
        if (input) input.click();
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
