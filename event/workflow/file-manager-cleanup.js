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
     * kết quả tổng qua alertModal.
     * FIX (04/07/2026, phản hồi Giang) — BUG "treo ở Scanning...": trước đây `alertModal()` bị gọi
     * LỒNG BÊN TRONG callback của `withLoadingShield()` — shield (z-[200], `pointer-events-auto`
     * suốt thời gian `fn()` chạy, xem core/loading-shield-util.js) che kín + chặn click luôn cả
     * alertModal (z-[130], THẤP HƠN shield) mọc ra bên trong nó, khiến người dùng KHÔNG THỂ bấm
     * "OK" để `alertModal()` resolve -> `fn()` không bao giờ xong -> shield "Scanning..." kẹt vĩnh
     * viễn. ĐÚNG cách (xem tiền lệ event/workflow/file-manager-photo.js): `withLoadingShield()`
     * PHẢI await XONG HẲN (đã tự đóng shield) rồi MỚI gọi `alertModal()` ở NGOÀI, KHÔNG lồng vào
     * trong. */
    async run() {
        const total = await withLoadingShield(t('fileManager.cleanup.running'), async () => {
            const checks = getRegisteredCleanupChecks(); // core
            let sum = 0;
            for (const check of checks) {
                const count = await check.run();
                sum += count;
                if (count > 0) console.log(`[fileManagerCleanup] "${check.name}": đã dọn ${count} mục.`);
            }
            return sum;
        });
        await alertModal(total > 0
            ? tFormat('fileManager.cleanup.resultFound', { count: total })
            : t('fileManager.cleanup.resultClean'));
    },
};
