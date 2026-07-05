/**
 * event/workflow/file-manager-cleanup.js — Workflow cụm "fileManagerCleanup" (nút "Dọn dẹp dữ
 * liệu" trong section File Manager, Settings). Lặp qua registry
 * `getRegisteredCleanupChecks()` (core/file-manager/cleanup.js) và gọi TỪNG hàm check — Workflow
 * được phép gọi nhiều hàm Core tuần tự (không bị Rule 3, rule đó CHỈ áp cho Core), ĐÚNG vai trò
 * "chuẩn bị + gọi core" của Workflow.
 *
 * NẠP SAU: core/file-manager/cleanup.js, core/dom-refs.js.
 * NẠP TRƯỚC: event/router/file-manager-cleanup.js, event/listener/file-manager-cleanup.js.
 */
const workflowFileManagerCleanup = {

    /** Ứng với bấm "Dọn dẹp dữ liệu" — chạy TOÀN BỘ check đã đăng ký, cộng dồn số mục đã dọn, hiện
     * kết quả tổng qua alertModal. */
    async run() {
        await withLoadingShield(t('fileManager.cleanup.running'), async () => {
            const checks = getRegisteredCleanupChecks(); // core
            let total = 0;
            for (const check of checks) {
                const count = await check.run();
                total += count;
                if (count > 0) console.log(`[fileManagerCleanup] "${check.name}": đã dọn ${count} mục.`);
            }
            await alertModal(total > 0
                ? tFormat('fileManager.cleanup.resultFound', { count: total })
                : t('fileManager.cleanup.resultClean'));
        });
    },
};
