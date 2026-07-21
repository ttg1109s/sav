/**
 * event/listener/file-manager-video.js — TẤT CẢ listener của cụm "fileManagerVideo". MỚI
 * (21/07/2026). Panel Video push/pop động (core/settings-panel-stack.js), TOÀN BỘ listener bên
 * dưới (trừ `btnOpenFileManagerVideo`, Main tĩnh) delegation trên `settingsStackBody` — cùng CHUẨN
 * `event/listener/file-manager-photo.js`.
 *
 * 2 nút header ("+"/thùng rác xoá nhanh) wire TRỰC TIẾP trong Workflow
 * (`workflowFileManagerVideo._wireHeaderActionEvents()`) — KHÔNG delegated ở đây (đúng quy ước "nút
 * động do Workflow tự dựng thì Workflow tự wire").
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */

if (btnOpenFileManagerVideo) {
    btnOpenFileManagerVideo.addEventListener('click', () => {
        eventBus.send({ router: 'fileManagerVideo', type: 'fileManagerVideo.openPanel.click', payload: {} });
    });
}

function handleFileManagerVideoDelegatedClick(e) {
    // ===================== Lưới video (event/workflow/video-gallery-window.js) =====================
    // SỬA (21/07/2026) — thêm `anchorEl: tile` trong payload — workflowFileManagerVideo.
    // openVideoTileActionMenu() (dropdown, core/dropdown-menu.js) cần 1 anchorEl để định vị menu
    // sát tile vừa bấm (KHÁC hẳn preview fullscreen cũ, không cần biết vị trí gì).
    const tile = e.target.closest('[data-video-key]');
    if (tile && e.target.closest('.video-gallery-window')) {
        eventBus.send({ router: 'fileManagerVideo', type: 'fileManagerVideo.video.click', payload: { videoKey: tile.dataset.videoKey, anchorEl: tile } });
        return;
    }
}

function handleFileManagerVideoDelegatedChange(e) {
    if (e.target.id === 'file-manager-video-upload-input') {
        if (e.target.files.length === 0) return; // bấm Huỷ trên hộp thoại chọn file
        eventBus.send({ router: 'fileManagerVideo', type: 'fileManagerVideo.upload.change', payload: { files: e.target.files } });
    }
}

if (settingsStackBody) {
    settingsStackBody.addEventListener('click', handleFileManagerVideoDelegatedClick);
    settingsStackBody.addEventListener('change', handleFileManagerVideoDelegatedChange);
}
