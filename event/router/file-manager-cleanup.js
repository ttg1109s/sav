/**
 * event/router/file-manager-cleanup.js — Router tên "fileManagerCleanup", tự đăng ký với eventBus
 * lúc nạp. Chỉ 1 msg.type, luôn giao workflow (chạy nhiều check tuần tự + cần shield).
 *
 * NẠP SAU: event/bus.js, event/workflow/file-manager-cleanup.js.
 * NẠP TRƯỚC: event/listener/file-manager-cleanup.js.
 */
const routerFileManagerCleanup = (() => {
    /** @param {import('../bus.js').EventMessage} msg */
    function handle(msg) {
        switch (msg.type) {
            case 'fileManagerCleanup.run.click':
                workflowFileManagerCleanup.run();
                break;
            default:
                console.warn(`[routerFileManagerCleanup] msg.type không xác định: "${msg.type}"`, msg);
        }
    }

    return { handle };
})();

eventBus.register('fileManagerCleanup', routerFileManagerCleanup);
