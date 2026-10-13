/**
 * event/workflow/file-manager-cleanup.js — Workflow cụm "fileManagerCleanup" (nút "Dọn dẹp dữ liệu", Settings). Chạy lần
 * lượt các bước dọn rác ở `FILE_MANAGER_CLEANUP_STEPS` — mỗi bước tự đọc DB cần cho nó rồi giao core
 * (core/file-manager/cleanup.js) dọn — rồi báo tổng số mục đã dọn. Thêm 1 kiểu rác mới = thêm 1 hàm core + 1 dòng ở bảng.
 *
 * NẠP SAU: core/file-manager/cleanup.js, service/db.js, core/loading-shield-util.js, core/modal-choice-ui.js.
 * NẠP TRƯỚC: event/router/file-manager-cleanup.js.
 */

// Thứ tự chạy = thứ tự trong mảng. `run()` trả số mục đã dọn.
const FILE_MANAGER_CLEANUP_STEPS = [
    { name: 'orphanedSongFolderFields', run: () => workflowFileManagerCleanup._cleanSongFolderFields() },
    { name: 'orphanedFolderSongMaps', run: () => workflowFileManagerCleanup._cleanFolderSongMaps() },
    { name: 'orphanedZipTempFiles', run: () => cleanupOrphanedZipTempFiles() }, // core/file-manager/cleanup.js
];

const workflowFileManagerCleanup = {

    /** Bấm "Dọn dẹp dữ liệu" — chạy mọi bước dưới shield, rồi báo kết quả. `alertModal()` phải gọi SAU khi shield đã đóng
     * (gọi bên trong thì shield z-[200] che mất nút OK, kẹt "Scanning..."). */
    async run() {
        const total = await withLoadingShield(t('fileManager.cleanup.running'), () => this._runAllSteps()); // core/loading-shield-util.js
        await alertModal(total > 0 // core/modal-choice-ui.js
            ? tFormat('fileManager.cleanup.resultFound', { count: total })
            : t('fileManager.cleanup.resultClean'));
    },

    /** @returns {Promise<number>} tổng số mục đã dọn */
    async _runAllSteps() {
        const counts = [];
        for (const step of FILE_MANAGER_CLEANUP_STEPS) {
            const count = await step.run();
            counts.push(count);
            this._logStepResult(step.name, count);
        }
        return sumCleanupCounts(counts); // core/file-manager/cleanup.js
    },

    _logStepResult(name, count) {
        if (count === 0) return; // guard: bước sạch
        console.log(`[fileManagerCleanup] "${name}": đã dọn ${count} mục.`);
    },

    async _cleanSongFolderFields() {
        const [songMetas, deletedFolderIds] = await Promise.all([getAllMediaMeta('song'), getMeta('deletedFolderIds')]); // service/db.js
        return cleanupOrphanedSongFolderFields(songMetas, deletedFolderIds || []); // core/file-manager/cleanup.js
    },

    async _cleanFolderSongMaps() {
        const [liveFolderIds, mapKeys] = await Promise.all([getAllFolderKeys(), getAllFolderSongKeys()]); // service/db.js
        return cleanupOrphanedFolderSongMaps(liveFolderIds, mapKeys); // core/file-manager/cleanup.js
    },
};
