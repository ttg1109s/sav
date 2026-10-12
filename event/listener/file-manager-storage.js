/**
 * event/listener/file-manager-storage.js — TẤT CẢ listener của cụm "fileManagerStorage" (Generic Drawer Storage, mở từ
 * tab Storage của bottom nav). Delegate trên `genericDrawerBody` ('click' + 'change') và `genericDrawerHeader` (nút X).
 * Nút "Dọn dẹp dữ liệu" (`#btn-file-manager-cleanup-run`) nằm trong nội dung Storage nhưng gửi cho router
 * "fileManagerCleanup".
 *
 * QUY TẮC: listener KHÔNG biết nghiệp vụ, chỉ bắt sự kiện DOM + gửi message qua eventBus.send().
 *
 * NẠP SAU CÙNG (sau bus, core, workflow, router, VÀ SAU dom-refs.js).
 */



function handleFileManagerStorageDelegatedClick(e) {
    // Ấn vào 1 đoạn thanh dung lượng (mỗi đoạn có data-legend-key + dataset.bytes gắn lúc vẽ thống kê) -> hiện số byte
    // thật của đúng đoạn đó.
    const barSegment = e.target.closest('[data-legend-key]');
    if (barSegment && barSegment.id.startsWith('stat-storage-bar-')) {
        eventBus.send({
            router: 'fileManagerStorage',
            type: 'fileManagerStorage.storageBarSegment.click',
            payload: { bytes: Number(barSegment.dataset.bytes || 0), legendKey: barSegment.dataset.legendKey }
        });
        return;
    }

    // ===================== Dọn dẹp dữ liệu =====================
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
    if (e.target.closest('#btn-storage-fix-broken')) {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.fixBroken.click', payload: {} });
        return;
    }
    if (e.target.closest('#btn-storage-dismiss-scan')) {
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.dismissScan.click', payload: {} });
        return;
    }
}

/**
 * Delegate RIÊNG cho sự kiện 'change' — 3 toggle nguồn + 2 toggle
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

if (genericDrawerBody) {
    genericDrawerBody.addEventListener('click', handleFileManagerStorageDelegatedClick);
    genericDrawerBody.addEventListener('change', handleFileManagerStorageDelegatedChange);
}

// Nút X của Storage (header mang `data-storage-close`, xem workflowFileManagerStorage.openPanel()). Drawer khác không có
// attribute này -> bỏ qua.
if (genericDrawerHeader) {
    genericDrawerHeader.addEventListener('click', (e) => {
        if (!(e.target.closest && e.target.closest('[data-storage-close]'))) return;
        eventBus.send({ router: 'fileManagerStorage', type: 'fileManagerStorage.closePanel.click', payload: {} });
    });
}
