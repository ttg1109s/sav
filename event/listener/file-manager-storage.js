/**
 * event/listener/file-manager-storage.js — TẤT CẢ listener của cụm "fileManagerStorage".
 *
 * XOÁ (đợt tái cấu trúc bottom nav App Panel) — `btnOpenFileManagerSong`/`btnOpenFileManagerStorage`
 * (2 nút TĨNH của section File Manager cũ trong Settings, `components/settings/
 * file-manager-section.js` — section đó KHÔNG còn mount, xem main.js) — Folder/Storage giờ mở từ
 * bottom nav App Panel (`event/workflow/app-panel-nav.js::openFolder()/openStorage()`), KHÔNG cần
 * 2 nút TĨNH này nữa. `core/dom-refs.js` vẫn giữ 2 dom-ref đó (trả `null`, vô hại — element không
 * còn tồn tại trong DOM, giữ nguyên không xoá theo tinh thần Rule 0.5).
 *
 * MỚI (mục 2d) — nút "Dọn dẹp dữ liệu" (`#btn-file-manager-cleanup-run`, router "fileManagerCleanup"
 * — KHÔNG đổi gì ở router/workflow/core đó) nằm TRONG nội dung Storage, giờ delegate qua
 * `genericDrawerBody` (đã migrate sang Generic Drawer, xem event/workflow/file-manager-storage.js).
 *
 * QUY TẮC: giống event/listener/playlist.js — listener KHÔNG biết nghiệp vụ, chỉ bắt sự kiện DOM +
 * gửi message qua eventBus.send().
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */



function handleFileManagerStorageDelegatedClick(e) {
    // MỚI (29/07/2026, yêu cầu Giang mục 2) — ấn vào 1 đoạn thanh dung lượng (4 div màu, mỗi đoạn
    // có sẵn data-legend-key + dataset.bytes gắn lúc renderStorageStats() vẽ lại — core/storage-
    // manager.js) -> hiện số byte thật của đúng đoạn đó.
    const barSegment = e.target.closest('[data-legend-key]');
    if (barSegment && barSegment.id.startsWith('stat-storage-bar-')) {
        eventBus.send({
            router: 'fileManagerStorage',
            type: 'fileManagerStorage.storageBarSegment.click',
            payload: { bytes: Number(barSegment.dataset.bytes || 0), legendKey: barSegment.dataset.legendKey }
        });
        return;
    }

    // ===================== Dọn dẹp dữ liệu (DỜI từ event/listener/file-manager-cleanup.js) =====
    if (e.target.closest('#btn-file-manager-cleanup-run')) {
        eventBus.send({ router: 'fileManagerCleanup', type: 'fileManagerCleanup.run.click', payload: {} });
        return;
    }

    // ===================== Chọn mục xoá =====================
    if (e.target.closest('#btn-storage-execute')) {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.storageExecute.click', payload: {} });
        return;
    }

    // ===================== Dọn file lỗi =====================
    if (e.target.closest('#btn-storage-scan-broken')) {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.scanBroken.click', payload: {} });
        return;
    }
    if (e.target.closest('#btn-storage-delete-broken')) {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.deleteBroken.click', payload: {} });
        return;
    }
    if (e.target.closest('#btn-storage-dismiss-scan')) {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.dismissScan.click', payload: {} });
        return;
    }
}

/**
 * Delegate RIÊNG cho sự kiện 'change' — 3 toggle nguồn (MỚI, THAY <select> phạm vi cũ) + 2 toggle
 * hành động (Tải xuống/Xoá) — 'click' không bắt được đổi trạng thái checkbox đúng ngữ nghĩa 'change'.
 */
function handleFileManagerStorageDelegatedChange(e) {
    if (e.target.id === 'toggle-storage-source-song') {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.sourceToggle.change', payload: { source: 'song', checked: e.target.checked } });
        return;
    }
    if (e.target.id === 'toggle-storage-source-video') {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.sourceToggle.change', payload: { source: 'video', checked: e.target.checked } });
        return;
    }
    if (e.target.id === 'toggle-storage-source-photo') {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.sourceToggle.change', payload: { source: 'photo', checked: e.target.checked } });
        return;
    }
    if (e.target.id === 'toggle-storage-download') {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.storageDownloadToggle.change', payload: { checked: e.target.checked } });
        return;
    }
    if (e.target.id === 'toggle-storage-delete') {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.storageDeleteToggle.change', payload: { checked: e.target.checked } });
        return;
    }
}

// SỬA (đợt tái cấu trúc bottom nav App Panel) — Storage KHÔNG còn sống trong `settingsStackBody`
// (đã chuyển hẳn sang `genericDrawerBody`, xem event/workflow/file-manager-storage.js) — bỏ
// binding cũ trên `settingsStackBody` (nay dành riêng cho Photo, xem event/listener/
// file-manager-photo.js), chỉ còn delegate trên `genericDrawerBody`.
if (genericDrawerBody) {
    genericDrawerBody.addEventListener('click', handleFileManagerStorageDelegatedClick);
    genericDrawerBody.addEventListener('change', handleFileManagerStorageDelegatedChange);
}
